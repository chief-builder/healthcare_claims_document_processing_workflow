import { BaseAgent, AgentResult } from './base.js';
import {
  ClaimRecord,
  ExtractedClaim,
  ValidationResult,
  CorrectionResult,
  CorrectionAttempt,
  createCorrectionAttempt,
} from '../models/index.js';
import { getOCRService, getLLMService, getStorageService, OCRResult } from '../services/index.js';
import { logger, logCorrectionAttempt } from '../utils/index.js';
import { getConfig } from '../config/index.js';

export interface CorrectionInput {
  extractedClaim: ExtractedClaim;
  validationResult: ValidationResult;
  ocrResult: OCRResult;
  lowConfidenceFields: string[];
}

export interface CorrectionOutput {
  correctedClaim: ExtractedClaim;
  correctionResult: CorrectionResult;
}

export class CorrectionAgent extends BaseAgent<CorrectionInput, CorrectionOutput> {
  private maxAttempts: number;

  constructor() {
    super('CorrectionAgent');
    this.maxAttempts = getConfig().processing.maxCorrectionAttempts;
  }

  async process(input: CorrectionInput, claim: ClaimRecord): Promise<AgentResult<CorrectionOutput>> {
    const { extractedClaim, validationResult, ocrResult, lowConfidenceFields } = input;

    const llm = getLLMService();
    const ocr = getOCRService();

    const attempts: CorrectionAttempt[] = [];
    const fieldsCorrected: string[] = [];
    const fieldsEscalated: string[] = [];

    // Create a mutable copy of the claim
    const correctedClaim = JSON.parse(JSON.stringify(extractedClaim)) as ExtractedClaim;

    // Collect all fields that need correction
    const fieldsToCorrect = new Set<string>();

    // Add fields with validation errors
    for (const error of validationResult.errors) {
      if (error.isCorrectable) {
        fieldsToCorrect.add(error.field);
      }
    }

    // Add low confidence fields
    for (const field of lowConfidenceFields) {
      fieldsToCorrect.add(field);
    }

    logger.info('Starting correction', {
      claimId: claim.id,
      fieldsToCorrect: fieldsToCorrect.size,
    });

    // Attempt to correct each field
    for (const fieldPath of fieldsToCorrect) {
      let corrected = false;

      for (let attemptNum = 1; attemptNum <= this.maxAttempts && !corrected; attemptNum++) {
        const currentValue = this.getNestedValue(correctedClaim, fieldPath);
        const validationError = validationResult.errors.find((e) => e.field === fieldPath);
        const errorMessage = validationError?.message ?? 'Low confidence extraction';

        // Get context from OCR result
        const context = this.getFieldContext(fieldPath, ocrResult);

        let attempt: CorrectionAttempt;

        // First try LLM inference
        try {
          const llmResult = await llm.correctField(
            fieldPath,
            String(currentValue ?? ''),
            errorMessage,
            context
          );

          if (llmResult.success && llmResult.correctedValue !== null) {
            // Update the field value
            this.setNestedValue(correctedClaim, fieldPath, llmResult.correctedValue);

            // Update confidence score
            correctedClaim.confidenceScores[fieldPath] = llmResult.confidence;

            // Update provenance
            if (correctedClaim.provenance[fieldPath]) {
              correctedClaim.provenance[fieldPath] = {
                ...correctedClaim.provenance[fieldPath],
                confidence: llmResult.confidence,
                extractionMethod: 'llm',
              };
            }

            attempt = createCorrectionAttempt(attemptNum, fieldPath, 'llm_inference', {
              originalValue: String(currentValue ?? ''),
              correctedValue: llmResult.correctedValue,
              confidence: llmResult.confidence,
              success: true,
            });

            corrected = llmResult.confidence >= this.config.correctionThreshold;
          } else {
            attempt = createCorrectionAttempt(attemptNum, fieldPath, 'llm_inference', {
              originalValue: String(currentValue ?? ''),
              confidence: 0,
              success: false,
              errorMessage: llmResult.reasoning,
            });
          }
        } catch (error) {
          attempt = createCorrectionAttempt(attemptNum, fieldPath, 'llm_inference', {
            originalValue: String(currentValue ?? ''),
            confidence: 0,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        attempts.push(attempt);
        logCorrectionAttempt(claim.id, fieldPath, attemptNum, attempt.success);

        // If LLM didn't work, try re-OCR for specific region
        if (!corrected && attemptNum < this.maxAttempts) {
          const provenance = correctedClaim.provenance[fieldPath];

          if (provenance?.boundingBox) {
            try {
              const storage = await getStorageService();
              const documentBuffer = await storage.getDocument(claim.documentId);

              const reOcrResult = await ocr.extractRegion(documentBuffer, provenance.boundingBox);

              if (reOcrResult.confidence > (correctedClaim.confidenceScores[fieldPath] ?? 0)) {
                this.setNestedValue(correctedClaim, fieldPath, reOcrResult.text);
                correctedClaim.confidenceScores[fieldPath] = reOcrResult.confidence;
                correctedClaim.provenance[fieldPath] = {
                  ...provenance,
                  confidence: reOcrResult.confidence,
                  extractionMethod: 'ocr',
                };

                const reOcrAttempt = createCorrectionAttempt(attemptNum, fieldPath, 're_ocr', {
                  originalValue: String(currentValue ?? ''),
                  correctedValue: reOcrResult.text,
                  confidence: reOcrResult.confidence,
                  success: reOcrResult.confidence >= this.config.correctionThreshold,
                });

                attempts.push(reOcrAttempt);
                corrected = reOcrResult.confidence >= this.config.correctionThreshold;
              }
            } catch (error) {
              logger.warn('Re-OCR failed', { error, fieldPath });
            }
          }
        }
      }

      if (corrected) {
        fieldsCorrected.push(fieldPath);
      } else {
        fieldsEscalated.push(fieldPath);
      }
    }

    const requiresHumanReview = fieldsEscalated.length > 0;

    const correctionResult: CorrectionResult = {
      claimId: claim.id,
      fieldsCorrected,
      fieldsEscalated,
      attempts,
      requiresHumanReview,
      escalationReason: requiresHumanReview
        ? `Unable to correct ${fieldsEscalated.length} field(s) after ${this.maxAttempts} attempts each`
        : undefined,
    };

    logger.info('Correction completed', {
      claimId: claim.id,
      correctedCount: fieldsCorrected.length,
      escalatedCount: fieldsEscalated.length,
      totalAttempts: attempts.length,
    });

    // Determine next status
    const nextStatus = requiresHumanReview ? 'pending_review' : 'validating';

    // Calculate new overall confidence
    const newConfidence = this.calculateOverallConfidence(
      Object.values(correctedClaim.confidenceScores)
    );

    return {
      success: true,
      data: { correctedClaim, correctionResult },
      nextStatus,
      confidence: newConfidence,
      requiresHumanReview,
      reviewReason: correctionResult.escalationReason,
    };
  }

  private getFieldContext(fieldPath: string, ocrResult: OCRResult): string {
    // Get surrounding text for context
    const allText = ocrResult.pages.map((p) => p.text).join('\n');

    // Find the field name in the text and get surrounding context
    const fieldName = fieldPath.split('.').pop() ?? fieldPath;
    const searchTerms = this.getSearchTermsForField(fieldName);

    for (const term of searchTerms) {
      const index = allText.toLowerCase().indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 200);
        const end = Math.min(allText.length, index + 300);
        return allText.substring(start, end);
      }
    }

    // Return first 500 chars if no context found
    return allText.substring(0, 500);
  }

  private getSearchTermsForField(fieldName: string): string[] {
    const mappings: Record<string, string[]> = {
      memberId: ['member id', 'subscriber id', 'id number', 'member'],
      firstName: ['patient name', 'first name', 'name'],
      lastName: ['last name', 'patient name'],
      dateOfBirth: ['date of birth', 'dob', 'birth date', 'birthdate'],
      npi: ['npi', 'national provider', 'provider id'],
      code: ['diagnosis', 'icd', 'cpt', 'procedure'],
      procedureCode: ['procedure', 'cpt', 'hcpcs', 'service'],
      chargeAmount: ['charge', 'amount', 'fee', 'total'],
      totalCharges: ['total', 'charges', 'amount due'],
    };

    return mappings[fieldName] ?? [fieldName.replace(/([A-Z])/g, ' $1').trim()];
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;

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

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        const arr = current[key] as unknown[];
        current = arr[parseInt(index, 10)] as Record<string, unknown>;
      } else {
        current = current[part] as Record<string, unknown>;
      }
    }

    const lastPart = parts[parts.length - 1];
    const arrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      (current[key] as unknown[])[parseInt(index, 10)] = value;
    } else {
      current[lastPart] = value;
    }
  }
}
