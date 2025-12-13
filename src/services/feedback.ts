import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../config/index.js';
import { ExtractedClaim, ValidationError } from '../models/index.js';
import { ExtractionQualityScore } from './quality.js';
import { logger } from '../utils/index.js';

/**
 * Feedback loop service for continuous learning and improvement
 */

export interface FieldCorrection {
  fieldPath: string;
  originalValue: unknown;
  correctedValue: unknown;
  correctionSource: 'human' | 'llm' | 'rule';
  timestamp: string;
}

export interface FeedbackRecord {
  id: string;
  claimId: string;
  documentType: string;
  timestamp: string;

  // Original extraction
  originalExtraction: ExtractedClaim;

  // Corrections made
  corrections: FieldCorrection[];

  // Quality assessment
  qualityScore?: ExtractionQualityScore;

  // Validation errors that led to corrections
  validationErrors: ValidationError[];

  // Context for learning
  ocrConfidence: number;
  extractionMethod: string;

  // Outcome
  finalStatus: 'approved' | 'rejected' | 'reprocessed';
  reviewerNotes?: string;
}

export interface LearningInsight {
  pattern: string;
  frequency: number;
  fieldPath: string;
  commonErrors: Array<{
    errorType: string;
    originalPattern: string;
    correctedPattern: string;
    occurrences: number;
  }>;
  suggestedRule?: string;
}

export interface ExtractionPattern {
  fieldPath: string;
  documentType: string;
  contextPatterns: string[];
  successRate: number;
  avgConfidence: number;
  sampleCount: number;
}

export interface FeedbackStats {
  totalRecords: number;
  byDocumentType: Record<string, number>;
  avgQualityScore: number;
  commonCorrections: Array<{ field: string; count: number }>;
  accuracyTrend: Array<{ date: string; accuracy: number }>;
}

export class FeedbackService {
  private feedbackPath: string;
  private patternsPath: string;
  private insightsPath: string;

  constructor() {
    const config = getConfig();
    const basePath = config.storage.storagePath;
    this.feedbackPath = path.join(basePath, 'feedback');
    this.patternsPath = path.join(basePath, 'patterns');
    this.insightsPath = path.join(basePath, 'insights');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.feedbackPath, { recursive: true });
    await fs.mkdir(this.patternsPath, { recursive: true });
    await fs.mkdir(this.insightsPath, { recursive: true });
    logger.info('Feedback service initialized');
  }

  /**
   * Record feedback from a human review or correction
   */
  async recordFeedback(record: Omit<FeedbackRecord, 'id' | 'timestamp'>): Promise<string> {
    await this.initialize();

    const id = `FB-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fullRecord: FeedbackRecord = {
      ...record,
      id,
      timestamp: new Date().toISOString(),
    };

    const filePath = path.join(this.feedbackPath, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(fullRecord, null, 2));

    // Update patterns based on this feedback
    await this.updatePatterns(fullRecord);

    logger.info('Feedback recorded', {
      feedbackId: id,
      claimId: record.claimId,
      correctionCount: record.corrections.length,
    });

    return id;
  }

  /**
   * Record a field correction
   */
  async recordCorrection(
    claimId: string,
    fieldPath: string,
    originalValue: unknown,
    correctedValue: unknown,
    source: 'human' | 'llm' | 'rule'
  ): Promise<void> {
    await this.initialize();

    const correction: FieldCorrection = {
      fieldPath,
      originalValue,
      correctedValue,
      correctionSource: source,
      timestamp: new Date().toISOString(),
    };

    // Store in corrections log
    const logPath = path.join(this.feedbackPath, 'corrections.jsonl');
    const entry = JSON.stringify({ claimId, ...correction }) + '\n';
    await fs.appendFile(logPath, entry);

    // Update field-specific statistics
    await this.updateFieldStats(fieldPath, originalValue, correctedValue);
  }

  /**
   * Get learning insights from accumulated feedback
   */
  async getLearningInsights(): Promise<LearningInsight[]> {
    await this.initialize();

    const insights: LearningInsight[] = [];
    const feedbackFiles = await fs.readdir(this.feedbackPath);

    // Aggregate corrections by field
    const correctionsByField = new Map<string, FieldCorrection[]>();

    for (const file of feedbackFiles) {
      if (!file.endsWith('.json') || file === 'corrections.jsonl') continue;

      try {
        const content = await fs.readFile(path.join(this.feedbackPath, file), 'utf-8');
        const record = JSON.parse(content) as FeedbackRecord;

        for (const correction of record.corrections) {
          const existing = correctionsByField.get(correction.fieldPath) ?? [];
          existing.push(correction);
          correctionsByField.set(correction.fieldPath, existing);
        }
      } catch {
        // Skip invalid files
      }
    }

    // Generate insights for fields with significant corrections
    for (const [fieldPath, corrections] of correctionsByField) {
      if (corrections.length < 3) continue; // Need minimum sample

      const errorPatterns = this.analyzeErrorPatterns(corrections);

      insights.push({
        pattern: `Field "${fieldPath}" frequently corrected`,
        frequency: corrections.length,
        fieldPath,
        commonErrors: errorPatterns,
        suggestedRule: this.suggestCorrectionRule(fieldPath, errorPatterns),
      });
    }

    // Sort by frequency
    insights.sort((a, b) => b.frequency - a.frequency);

    return insights;
  }

  /**
   * Get extraction patterns for a specific field/document type
   */
  async getExtractionPatterns(
    fieldPath: string,
    documentType?: string
  ): Promise<ExtractionPattern | null> {
    await this.initialize();

    const patternFile = path.join(
      this.patternsPath,
      `${fieldPath.replace(/\./g, '_')}${documentType ? `_${documentType}` : ''}.json`
    );

    try {
      const content = await fs.readFile(patternFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get overall feedback statistics
   */
  async getStats(): Promise<FeedbackStats> {
    await this.initialize();

    const feedbackFiles = await fs.readdir(this.feedbackPath);
    const records: FeedbackRecord[] = [];

    for (const file of feedbackFiles) {
      if (!file.endsWith('.json') || file === 'corrections.jsonl') continue;

      try {
        const content = await fs.readFile(path.join(this.feedbackPath, file), 'utf-8');
        records.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }

    // Calculate statistics
    const byDocumentType: Record<string, number> = {};
    const correctionCounts = new Map<string, number>();
    let totalQualityScore = 0;
    let qualityScoreCount = 0;

    for (const record of records) {
      // Count by document type
      byDocumentType[record.documentType] = (byDocumentType[record.documentType] ?? 0) + 1;

      // Count corrections by field
      for (const correction of record.corrections) {
        const count = correctionCounts.get(correction.fieldPath) ?? 0;
        correctionCounts.set(correction.fieldPath, count + 1);
      }

      // Sum quality scores
      if (record.qualityScore) {
        totalQualityScore += record.qualityScore.overallScore;
        qualityScoreCount++;
      }
    }

    // Get common corrections
    const commonCorrections = Array.from(correctionCounts.entries())
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate accuracy trend (by day)
    const accuracyByDay = this.calculateAccuracyTrend(records);

    return {
      totalRecords: records.length,
      byDocumentType,
      avgQualityScore: qualityScoreCount > 0 ? totalQualityScore / qualityScoreCount : 0,
      commonCorrections,
      accuracyTrend: accuracyByDay,
    };
  }

  /**
   * Get suggested improvements based on feedback
   */
  async getSuggestedImprovements(): Promise<Array<{
    type: 'prompt' | 'validation' | 'preprocessing';
    description: string;
    priority: 'low' | 'medium' | 'high';
    affectedFields: string[];
    estimatedImpact: number;
  }>> {
    const insights = await this.getLearningInsights();
    const suggestions: Array<{
      type: 'prompt' | 'validation' | 'preprocessing';
      description: string;
      priority: 'low' | 'medium' | 'high';
      affectedFields: string[];
      estimatedImpact: number;
    }> = [];

    for (const insight of insights) {
      // Suggest prompt improvements for frequent extraction errors
      if (insight.frequency >= 5) {
        const mainError = insight.commonErrors[0];
        if (mainError) {
          suggestions.push({
            type: 'prompt',
            description: `Add extraction hint for ${insight.fieldPath}: common error "${mainError.errorType}" (${mainError.occurrences} times)`,
            priority: insight.frequency >= 10 ? 'high' : 'medium',
            affectedFields: [insight.fieldPath],
            estimatedImpact: insight.frequency / 100,
          });
        }
      }

      // Suggest validation rules for correctable patterns
      if (insight.suggestedRule) {
        suggestions.push({
          type: 'validation',
          description: insight.suggestedRule,
          priority: 'medium',
          affectedFields: [insight.fieldPath],
          estimatedImpact: insight.frequency / 200,
        });
      }
    }

    return suggestions.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  /**
   * Export feedback data for model fine-tuning
   */
  async exportTrainingData(format: 'jsonl' | 'csv' = 'jsonl'): Promise<string> {
    await this.initialize();

    const feedbackFiles = await fs.readdir(this.feedbackPath);
    const trainingData: Array<{
      input: string;
      output: string;
      field: string;
    }> = [];

    for (const file of feedbackFiles) {
      if (!file.endsWith('.json') || file === 'corrections.jsonl') continue;

      try {
        const content = await fs.readFile(path.join(this.feedbackPath, file), 'utf-8');
        const record = JSON.parse(content) as FeedbackRecord;

        // Create training examples from corrections
        for (const correction of record.corrections) {
          if (correction.correctionSource === 'human') {
            trainingData.push({
              input: String(correction.originalValue),
              output: String(correction.correctedValue),
              field: correction.fieldPath,
            });
          }
        }
      } catch {
        // Skip invalid files
      }
    }

    const exportPath = path.join(this.insightsPath, `training_data.${format}`);

    if (format === 'jsonl') {
      const content = trainingData.map((d) => JSON.stringify(d)).join('\n');
      await fs.writeFile(exportPath, content);
    } else {
      const header = 'field,input,output\n';
      const rows = trainingData
        .map((d) => `"${d.field}","${String(d.input).replace(/"/g, '""')}","${String(d.output).replace(/"/g, '""')}"`)
        .join('\n');
      await fs.writeFile(exportPath, header + rows);
    }

    logger.info('Training data exported', {
      format,
      recordCount: trainingData.length,
      path: exportPath,
    });

    return exportPath;
  }

  // Private helper methods

  private async updatePatterns(record: FeedbackRecord): Promise<void> {
    for (const correction of record.corrections) {
      const patternFile = path.join(
        this.patternsPath,
        `${correction.fieldPath.replace(/\./g, '_')}_${record.documentType}.json`
      );

      let pattern: ExtractionPattern;

      try {
        const content = await fs.readFile(patternFile, 'utf-8');
        pattern = JSON.parse(content);
        pattern.sampleCount++;
        // Update success rate (correction means failure)
        pattern.successRate = (pattern.successRate * (pattern.sampleCount - 1)) / pattern.sampleCount;
      } catch {
        pattern = {
          fieldPath: correction.fieldPath,
          documentType: record.documentType,
          contextPatterns: [],
          successRate: 0,
          avgConfidence: record.ocrConfidence,
          sampleCount: 1,
        };
      }

      await fs.writeFile(patternFile, JSON.stringify(pattern, null, 2));
    }
  }

  private async updateFieldStats(
    fieldPath: string,
    originalValue: unknown,
    correctedValue: unknown
  ): Promise<void> {
    const statsFile = path.join(this.patternsPath, `field_stats.json`);

    let stats: Record<string, { corrections: number; examples: Array<{ from: unknown; to: unknown }> }> = {};

    try {
      const content = await fs.readFile(statsFile, 'utf-8');
      stats = JSON.parse(content);
    } catch {
      // Start fresh
    }

    if (!stats[fieldPath]) {
      stats[fieldPath] = { corrections: 0, examples: [] };
    }

    stats[fieldPath].corrections++;
    stats[fieldPath].examples.push({ from: originalValue, to: correctedValue });

    // Keep only last 100 examples
    if (stats[fieldPath].examples.length > 100) {
      stats[fieldPath].examples = stats[fieldPath].examples.slice(-100);
    }

    await fs.writeFile(statsFile, JSON.stringify(stats, null, 2));
  }

  private analyzeErrorPatterns(corrections: FieldCorrection[]): Array<{
    errorType: string;
    originalPattern: string;
    correctedPattern: string;
    occurrences: number;
  }> {
    const patterns = new Map<string, { original: string; corrected: string; count: number }>();

    for (const correction of corrections) {
      const orig = String(correction.originalValue);
      const corr = String(correction.correctedValue);

      // Identify error type
      let errorType = 'unknown';
      if (orig.length !== corr.length) {
        errorType = 'length_mismatch';
      } else if (orig.toLowerCase() === corr.toLowerCase()) {
        errorType = 'case_error';
      } else if (this.isTransposition(orig, corr)) {
        errorType = 'transposition';
      } else if (this.isOCRConfusion(orig, corr)) {
        errorType = 'ocr_confusion';
      }

      const key = `${errorType}:${orig.substring(0, 3)}`;
      const existing = patterns.get(key);
      if (existing) {
        existing.count++;
      } else {
        patterns.set(key, { original: orig, corrected: corr, count: 1 });
      }
    }

    return Array.from(patterns.entries())
      .map(([key, value]) => ({
        errorType: key.split(':')[0],
        originalPattern: value.original,
        correctedPattern: value.corrected,
        occurrences: value.count,
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);
  }

  private isTransposition(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diffs++;
    }
    return diffs === 2;
  }

  private isOCRConfusion(a: string, b: string): boolean {
    const confusions = [
      ['0', 'O'], ['1', 'I'], ['1', 'l'], ['5', 'S'],
      ['8', 'B'], ['6', 'G'], ['2', 'Z'],
    ];

    for (const [char1, char2] of confusions) {
      if (a.includes(char1) && b.includes(char2)) return true;
      if (a.includes(char2) && b.includes(char1)) return true;
    }
    return false;
  }

  private suggestCorrectionRule(
    fieldPath: string,
    errors: Array<{ errorType: string; occurrences: number }>
  ): string | undefined {
    const mainError = errors[0];
    if (!mainError || mainError.occurrences < 3) return undefined;

    switch (mainError.errorType) {
      case 'ocr_confusion':
        return `Add OCR confusion correction for ${fieldPath}: check for 0/O, 1/I/l substitutions`;
      case 'case_error':
        return `Normalize case for ${fieldPath} before validation`;
      case 'length_mismatch':
        return `Validate ${fieldPath} length and trim whitespace`;
      default:
        return undefined;
    }
  }

  private calculateAccuracyTrend(
    records: FeedbackRecord[]
  ): Array<{ date: string; accuracy: number }> {
    const byDay = new Map<string, { total: number; correct: number }>();

    for (const record of records) {
      const date = record.timestamp.split('T')[0];
      const existing = byDay.get(date) ?? { total: 0, correct: 0 };
      existing.total++;
      if (record.corrections.length === 0) {
        existing.correct++;
      }
      byDay.set(date, existing);
    }

    return Array.from(byDay.entries())
      .map(([date, stats]) => ({
        date,
        accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }
}

// Singleton instance
let feedbackServiceInstance: FeedbackService | null = null;

export async function getFeedbackService(): Promise<FeedbackService> {
  if (!feedbackServiceInstance) {
    feedbackServiceInstance = new FeedbackService();
    await feedbackServiceInstance.initialize();
  }
  return feedbackServiceInstance;
}
