import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config/index.js';
import { ExtractedClaim, ValidationResult } from '../models/index.js';
import { logger } from '../utils/index.js';

/**
 * Quality assessment using LLM-as-judge pattern
 */

export interface QualityDimension {
  name: string;
  score: number; // 0-1
  reasoning: string;
  issues: string[];
}

export interface ExtractionQualityScore {
  overallScore: number; // 0-1
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    completeness: QualityDimension;
    accuracy: QualityDimension;
    consistency: QualityDimension;
    formatting: QualityDimension;
  };
  recommendations: string[];
  requiresReview: boolean;
  reviewPriority: 'low' | 'medium' | 'high' | 'critical';
}

export interface JudgementRequest {
  extractedClaim: ExtractedClaim;
  ocrText: string;
  validationResult?: ValidationResult;
}

export interface ComparisonJudgement {
  preferredExtraction: 'A' | 'B' | 'tie';
  confidence: number;
  reasoning: string;
  dimensionComparisons: Array<{
    dimension: string;
    winner: 'A' | 'B' | 'tie';
    explanation: string;
  }>;
}

export class QualityService {
  private client: Anthropic;
  private model: string;

  constructor() {
    const config = getConfig();
    this.client = new Anthropic({
      authToken: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
  }

  /**
   * LLM-as-Judge: Evaluate extraction quality
   */
  async evaluateExtraction(request: JudgementRequest): Promise<ExtractionQualityScore> {
    const prompt = `You are an expert healthcare claims auditor evaluating the quality of an automated extraction.

## Source OCR Text (Ground Truth)
${request.ocrText.substring(0, 6000)}

## Extracted Claim Data
${JSON.stringify(request.extractedClaim, null, 2)}

${request.validationResult ? `## Validation Results
Errors: ${request.validationResult.errors.length}
Warnings: ${request.validationResult.warnings.length}
${request.validationResult.errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}` : ''}

## Evaluation Task
Evaluate the extraction quality across these dimensions:

1. **Completeness** (0-1): Are all visible fields from the source extracted?
   - Check: patient info, provider info, diagnoses, service lines, totals
   - Penalize: Missing fields that are clearly visible in source

2. **Accuracy** (0-1): Do extracted values match the source exactly?
   - Check: Names, codes, dates, amounts match OCR text
   - Penalize: Typos, wrong values, hallucinated data not in source

3. **Consistency** (0-1): Is the data internally consistent?
   - Check: Totals match line items, dates are logical, pointers valid
   - Penalize: Math errors, impossible dates, broken references

4. **Formatting** (0-1): Are values in correct formats?
   - Check: Date formats (YYYY-MM-DD), code formats (ICD-10, CPT)
   - Penalize: Inconsistent formats, malformed codes

Respond in JSON:
{
  "dimensions": {
    "completeness": { "score": 0.0-1.0, "reasoning": "...", "issues": ["..."] },
    "accuracy": { "score": 0.0-1.0, "reasoning": "...", "issues": ["..."] },
    "consistency": { "score": 0.0-1.0, "reasoning": "...", "issues": ["..."] },
    "formatting": { "score": 0.0-1.0, "reasoning": "...", "issues": ["..."] }
  },
  "recommendations": ["specific improvements..."],
  "criticalIssues": ["any blocking problems..."]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));
      return this.buildQualityScore(parsed);
    } catch (error) {
      logger.error('Quality evaluation failed', { error });
      // Return a default score indicating evaluation failure
      return this.createDefaultScore();
    }
  }

  /**
   * LLM-as-Judge: Compare two extractions (A/B testing)
   */
  async compareExtractions(
    extractionA: ExtractedClaim,
    extractionB: ExtractedClaim,
    ocrText: string
  ): Promise<ComparisonJudgement> {
    const prompt = `You are an expert healthcare claims auditor comparing two automated extractions.

## Source OCR Text (Ground Truth)
${ocrText.substring(0, 4000)}

## Extraction A
${JSON.stringify(extractionA, null, 2)}

## Extraction B
${JSON.stringify(extractionB, null, 2)}

## Comparison Task
Compare these extractions and determine which is better overall.

For each dimension, indicate the winner:
1. Completeness: Which extraction captured more fields?
2. Accuracy: Which has fewer errors compared to source?
3. Consistency: Which has better internal consistency?
4. Formatting: Which has better formatted values?

Respond in JSON:
{
  "preferredExtraction": "A" | "B" | "tie",
  "confidence": 0.0-1.0,
  "reasoning": "overall explanation",
  "dimensionComparisons": [
    { "dimension": "completeness", "winner": "A"|"B"|"tie", "explanation": "..." },
    { "dimension": "accuracy", "winner": "A"|"B"|"tie", "explanation": "..." },
    { "dimension": "consistency", "winner": "A"|"B"|"tie", "explanation": "..." },
    { "dimension": "formatting", "winner": "A"|"B"|"tie", "explanation": "..." }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return JSON.parse(this.extractJSON(content.text));
    } catch (error) {
      logger.error('Extraction comparison failed', { error });
      return {
        preferredExtraction: 'tie',
        confidence: 0,
        reasoning: 'Comparison failed',
        dimensionComparisons: [],
      };
    }
  }

  /**
   * Validate specific field extraction with LLM
   */
  async validateFieldExtraction(
    fieldName: string,
    extractedValue: string,
    ocrContext: string
  ): Promise<{ isCorrect: boolean; confidence: number; correctValue?: string; reasoning: string }> {
    const prompt = `You are validating a single field extraction from a healthcare document.

Field: ${fieldName}
Extracted Value: "${extractedValue}"

Source Context:
${ocrContext}

Questions:
1. Is "${extractedValue}" present in or derivable from the source context?
2. If not, what should the correct value be?

Respond in JSON:
{
  "isCorrect": true|false,
  "confidence": 0.0-1.0,
  "correctValue": "only if isCorrect is false",
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return JSON.parse(this.extractJSON(content.text));
    } catch (error) {
      logger.error('Field validation failed', { error, fieldName });
      return {
        isCorrect: true, // Assume correct on failure
        confidence: 0,
        reasoning: 'Validation failed',
      };
    }
  }

  /**
   * Calculate extraction scoring metrics
   */
  calculateExtractionMetrics(
    extracted: ExtractedClaim,
    _groundTruth?: Partial<ExtractedClaim>
  ): {
    fieldCoverage: number;
    avgConfidence: number;
    lowConfidenceFields: string[];
    missingRequiredFields: string[];
  } {
    const confidenceScores = Object.values(extracted.confidenceScores);
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    const lowConfidenceFields = Object.entries(extracted.confidenceScores)
      .filter(([_, score]) => score < 0.8)
      .map(([field, _]) => field);

    const requiredFields = [
      'patient.memberId',
      'patient.firstName',
      'patient.lastName',
      'provider.npi',
      'totals.totalCharges',
    ];

    const missingRequiredFields = requiredFields.filter((field) => {
      const value = this.getNestedValue(extracted, field);
      return value === undefined || value === null || value === '';
    });

    // Calculate field coverage
    const totalExpectedFields = this.countExpectedFields(extracted.documentType);
    const populatedFields = this.countPopulatedFields(extracted);
    const fieldCoverage = totalExpectedFields > 0 ? populatedFields / totalExpectedFields : 0;

    return {
      fieldCoverage,
      avgConfidence,
      lowConfidenceFields,
      missingRequiredFields,
    };
  }

  private buildQualityScore(parsed: {
    dimensions: {
      completeness: { score: number; reasoning: string; issues: string[] };
      accuracy: { score: number; reasoning: string; issues: string[] };
      consistency: { score: number; reasoning: string; issues: string[] };
      formatting: { score: number; reasoning: string; issues: string[] };
    };
    recommendations: string[];
    criticalIssues?: string[];
  }): ExtractionQualityScore {
    const dimensions = {
      completeness: { name: 'Completeness', ...parsed.dimensions.completeness },
      accuracy: { name: 'Accuracy', ...parsed.dimensions.accuracy },
      consistency: { name: 'Consistency', ...parsed.dimensions.consistency },
      formatting: { name: 'Formatting', ...parsed.dimensions.formatting },
    };

    // Calculate weighted overall score
    const weights = { completeness: 0.3, accuracy: 0.35, consistency: 0.2, formatting: 0.15 };
    const overallScore =
      dimensions.completeness.score * weights.completeness +
      dimensions.accuracy.score * weights.accuracy +
      dimensions.consistency.score * weights.consistency +
      dimensions.formatting.score * weights.formatting;

    // Determine grade
    const grade = this.scoreToGrade(overallScore);

    // Determine review priority
    const hasCriticalIssues = (parsed.criticalIssues && parsed.criticalIssues.length > 0) ?? false;
    const reviewPriority = this.determineReviewPriority(overallScore, hasCriticalIssues);

    return {
      overallScore,
      grade,
      dimensions,
      recommendations: parsed.recommendations,
      requiresReview: overallScore < 0.8 || hasCriticalIssues,
      reviewPriority,
    };
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  private determineReviewPriority(
    score: number,
    hasCriticalIssues: boolean
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (hasCriticalIssues || score < 0.5) return 'critical';
    if (score < 0.7) return 'high';
    if (score < 0.85) return 'medium';
    return 'low';
  }

  private createDefaultScore(): ExtractionQualityScore {
    return {
      overallScore: 0.5,
      grade: 'C',
      dimensions: {
        completeness: { name: 'Completeness', score: 0.5, reasoning: 'Evaluation unavailable', issues: [] },
        accuracy: { name: 'Accuracy', score: 0.5, reasoning: 'Evaluation unavailable', issues: [] },
        consistency: { name: 'Consistency', score: 0.5, reasoning: 'Evaluation unavailable', issues: [] },
        formatting: { name: 'Formatting', score: 0.5, reasoning: 'Evaluation unavailable', issues: [] },
      },
      recommendations: ['Manual review recommended due to evaluation failure'],
      requiresReview: true,
      reviewPriority: 'medium',
    };
  }

  private countExpectedFields(documentType: string): number {
    const expectedCounts: Record<string, number> = {
      cms_1500: 25,
      ub_04: 30,
      eob: 15,
      unknown: 10,
    };
    return expectedCounts[documentType] ?? 10;
  }

  private countPopulatedFields(claim: ExtractedClaim): number {
    let count = 0;

    // Patient fields
    if (claim.patient.memberId) count++;
    if (claim.patient.firstName) count++;
    if (claim.patient.lastName) count++;
    if (claim.patient.dateOfBirth) count++;
    if (claim.patient.gender) count++;
    if (claim.patient.address) count++;

    // Provider fields
    if (claim.provider.npi) count++;
    if (claim.provider.name) count++;
    if (claim.provider.taxId) count++;
    if (claim.provider.specialty) count++;

    // Diagnoses
    count += claim.diagnoses.length;

    // Service lines (count each line as multiple fields)
    count += claim.serviceLines.length * 5;

    // Totals
    if (claim.totals.totalCharges) count++;
    if (claim.totals.amountPaid !== undefined) count++;
    if (claim.totals.patientResponsibility !== undefined) count++;

    return count;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private extractJSON(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response');
  }
}

// Singleton instance
let qualityServiceInstance: QualityService | null = null;

export function getQualityService(): QualityService {
  if (!qualityServiceInstance) {
    qualityServiceInstance = new QualityService();
  }
  return qualityServiceInstance;
}
