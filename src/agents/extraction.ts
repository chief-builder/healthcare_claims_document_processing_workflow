import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, AgentResult } from './base.js';
import {
  ClaimRecord,
  DocumentType,
  ExtractedClaim,
  Provenance,
} from '../models/index.js';
import { getLLMService, OCRResult, OCRBlock } from '../services/index.js';
import { logger } from '../utils/index.js';

export interface ExtractionInput {
  ocrResult: OCRResult;
  documentType: DocumentType;
  readingOrderText: string;
}

export interface ExtractionOutput {
  extractedClaim: ExtractedClaim;
}

export class ExtractionAgent extends BaseAgent<ExtractionInput, ExtractionOutput> {
  constructor() {
    super('ExtractionAgent');
  }

  async process(input: ExtractionInput, claim: ClaimRecord): Promise<AgentResult<ExtractionOutput>> {
    const llm = getLLMService();

    // Use LLM to extract structured data
    const { claim: extractedData, confidenceScores } = await llm.extractClaim({
      ocrText: input.readingOrderText,
      documentType: input.documentType,
      pageCount: input.ocrResult.pages.length,
    });

    // Build provenance mapping
    const provenance = this.buildProvenance(extractedData, input.ocrResult, confidenceScores);

    // Create the full extracted claim
    const extractedClaim: ExtractedClaim = {
      id: claim.id,
      documentType: input.documentType,
      patient: extractedData.patient ?? {
        memberId: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
      },
      provider: extractedData.provider ?? {
        npi: '',
        name: '',
      },
      diagnoses: extractedData.diagnoses ?? [],
      serviceLines: extractedData.serviceLines ?? [],
      totals: extractedData.totals ?? {
        totalCharges: 0,
      },
      statementDate: extractedData.statementDate,
      admissionDate: extractedData.admissionDate,
      dischargeDate: extractedData.dischargeDate,
      confidenceScores,
      provenance,
    };

    // Calculate overall confidence
    const overallConfidence = this.calculateExtractionConfidence(confidenceScores);

    logger.info('Extraction completed', {
      claimId: claim.id,
      overallConfidence,
      fieldCount: Object.keys(confidenceScores).length,
      diagnosisCount: extractedClaim.diagnoses.length,
      serviceLineCount: extractedClaim.serviceLines.length,
    });

    // Determine next status based on confidence
    const { action, nextStatus } = this.determineNextAction(overallConfidence);

    return {
      success: true,
      data: { extractedClaim },
      nextStatus,
      confidence: overallConfidence,
      requiresHumanReview: action === 'escalate',
      reviewReason:
        action === 'escalate'
          ? `Low extraction confidence: ${(overallConfidence * 100).toFixed(1)}%`
          : undefined,
    };
  }

  private buildProvenance(
    extractedData: Partial<ExtractedClaim>,
    ocrResult: OCRResult,
    confidenceScores: Record<string, number>
  ): Record<string, Provenance> {
    const provenance: Record<string, Provenance> = {};

    // For each extracted field, try to find its source in OCR blocks
    for (const [fieldPath, confidence] of Object.entries(confidenceScores)) {
      const value = this.getFieldValue(extractedData, fieldPath);

      if (value) {
        const location = this.findValueInOCR(String(value), ocrResult);

        provenance[fieldPath] = {
          page: location?.page ?? 1,
          boundingBox: location?.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
          confidence,
          extractionMethod: 'llm',
        };
      }
    }

    return provenance;
  }

  private getFieldValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;

      // Handle array indices
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  private findValueInOCR(
    value: string,
    ocrResult: OCRResult
  ): { page: number; boundingBox: { x: number; y: number; width: number; height: number } } | null {
    const searchValue = value.toLowerCase().trim();

    for (const page of ocrResult.pages) {
      for (const block of page.blocks) {
        // Check block text
        if (block.text.toLowerCase().includes(searchValue)) {
          return {
            page: page.pageNumber,
            boundingBox: block.boundingBox,
          };
        }

        // Check lines
        for (const line of block.lines) {
          if (line.text.toLowerCase().includes(searchValue)) {
            return {
              page: page.pageNumber,
              boundingBox: line.boundingBox,
            };
          }

          // Check words
          for (const word of line.words) {
            if (word.text.toLowerCase() === searchValue) {
              return {
                page: page.pageNumber,
                boundingBox: word.boundingBox,
              };
            }
          }
        }
      }
    }

    return null;
  }

  private calculateExtractionConfidence(confidenceScores: Record<string, number>): number {
    const scores = Object.values(confidenceScores);
    if (scores.length === 0) return 0;

    // Weight critical fields more heavily
    const criticalFields = [
      'patient.memberId',
      'patient.firstName',
      'patient.lastName',
      'provider.npi',
      'totals.totalCharges',
    ];

    const criticalScores: number[] = [];
    const otherScores: number[] = [];

    for (const [field, score] of Object.entries(confidenceScores)) {
      if (criticalFields.some((cf) => field.startsWith(cf))) {
        criticalScores.push(score);
      } else {
        otherScores.push(score);
      }
    }

    // Critical fields get 60% weight, others get 40%
    const criticalAvg =
      criticalScores.length > 0
        ? criticalScores.reduce((a, b) => a + b, 0) / criticalScores.length
        : 0;

    const otherAvg =
      otherScores.length > 0 ? otherScores.reduce((a, b) => a + b, 0) / otherScores.length : 0;

    return criticalAvg * 0.6 + otherAvg * 0.4;
  }

  protected determineNextAction(confidence: number): {
    action: 'auto_process' | 'correct' | 'escalate';
    nextStatus: 'validating' | 'correcting' | 'pending_review';
  } {
    if (this.shouldAutoProcess(confidence)) {
      return { action: 'auto_process', nextStatus: 'validating' };
    }
    if (this.shouldAttemptCorrection(confidence)) {
      return { action: 'correct', nextStatus: 'correcting' };
    }
    return { action: 'escalate', nextStatus: 'pending_review' };
  }
}
