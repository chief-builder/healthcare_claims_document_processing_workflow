/**
 * Workflow Orchestrator
 *
 * Manages the automated claim processing pipeline.
 * Routes claims through agents based on confidence thresholds.
 */

import { EventEmitter } from 'events';
import { ClaimStatus, ExtractedClaim, Priority } from '../models/index.js';
import { StateManager, getStateManager, ClaimState } from './state.js';
import { IntakeAgent, IntakeOutput } from '../agents/intake.js';
import { AgentResult } from '../agents/base.js';
import { ValidationAgent } from '../agents/validation.js';
import { AdjudicationAgent } from '../agents/adjudication.js';
import { getEnrichmentService } from '../services/enrichment.js';
import { getQualityService } from '../services/quality.js';
import { getRAGService } from '../services/rag.js';
import { getQueueService } from '../services/queue.js';
import { logger } from '../utils/index.js';

export interface WorkflowConfig {
  autoProcessThreshold: number;
  correctionThreshold: number;
  maxCorrectionAttempts: number;
  enableRAGIndexing: boolean;
  enableQualityAssessment: boolean;
}

const DEFAULT_CONFIG: WorkflowConfig = {
  autoProcessThreshold: 0.85,
  correctionThreshold: 0.60,
  maxCorrectionAttempts: 3,
  enableRAGIndexing: true,
  enableQualityAssessment: true,
};

export interface WorkflowResult {
  success: boolean;
  claimId: string;
  finalStatus: ClaimStatus;
  extractedClaim?: ExtractedClaim;
  validationResult?: unknown;
  adjudicationResult?: unknown;
  qualityResult?: unknown;
  error?: string;
  processingTimeMs: number;
}

export interface DocumentInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  priority?: Priority;
  metadata?: Record<string, string>;
}

/**
 * Workflow Orchestrator
 *
 * Events emitted:
 * - 'workflow:started' - Processing started
 * - 'workflow:stage_started' - Stage started (parsing, extracting, etc.)
 * - 'workflow:stage_completed' - Stage completed
 * - 'workflow:completed' - Processing completed successfully
 * - 'workflow:failed' - Processing failed
 * - 'workflow:review_required' - Human review required
 */
export class WorkflowOrchestrator extends EventEmitter {
  private stateManager: StateManager;
  private config: WorkflowConfig;
  private validationAgent: ValidationAgent;
  private adjudicationAgent: AdjudicationAgent;

  constructor(config: Partial<WorkflowConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateManager = getStateManager({
      maxCorrectionAttempts: this.config.maxCorrectionAttempts,
      autoProcessThreshold: this.config.autoProcessThreshold,
      correctionThreshold: this.config.correctionThreshold,
    });
    this.validationAgent = new ValidationAgent();
    this.adjudicationAgent = new AdjudicationAgent();

    // Forward state manager events
    this.stateManager.on('state:transition', (data) => this.emit('state:transition', data));
    this.stateManager.on('state:review_required', (data) => this.emit('workflow:review_required', data));
  }

  /**
   * Process a document through the full pipeline
   */
  async processDocument(input: DocumentInput): Promise<WorkflowResult> {
    const startTime = Date.now();
    let claimId = '';

    try {
      // Stage 1: Intake
      this.emit('workflow:stage_started', { stage: 'intake' });
      const intakeResult = await this.runIntake(input);

      if (!intakeResult.success || !intakeResult.data) {
        throw new Error(intakeResult.error || 'Intake failed');
      }

      claimId = intakeResult.data.claimId;
      this.emit('workflow:started', { claimId });
      this.emit('workflow:stage_completed', { stage: 'intake', claimId });

      // Get state
      const state = await this.stateManager.getState(claimId);
      if (!state) {
        throw new Error('Failed to get claim state');
      }

      // Stage 2: Process through pipeline
      const result = await this.runPipeline(state);

      const processingTimeMs = Date.now() - startTime;

      if (result.success) {
        this.emit('workflow:completed', { claimId, result, processingTimeMs });
      }

      return {
        ...result,
        processingTimeMs,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const processingTimeMs = Date.now() - startTime;

      logger.error('Workflow failed', { claimId, error: err.message });

      if (claimId) {
        await this.stateManager.transitionTo(claimId, 'failed', err.message);
      }

      this.emit('workflow:failed', { claimId, error: err.message, processingTimeMs });

      return {
        success: false,
        claimId,
        finalStatus: 'failed',
        error: err.message,
        processingTimeMs,
      };
    }
  }

  /**
   * Process an existing claim through the pipeline
   */
  async processClaim(claimId: string): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      const state = await this.stateManager.getState(claimId);
      if (!state) {
        throw new Error(`Claim not found: ${claimId}`);
      }

      this.emit('workflow:started', { claimId });

      const result = await this.runPipeline(state);
      const processingTimeMs = Date.now() - startTime;

      if (result.success) {
        this.emit('workflow:completed', { claimId, result, processingTimeMs });
      }

      return {
        ...result,
        processingTimeMs,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const processingTimeMs = Date.now() - startTime;

      logger.error('Workflow failed', { claimId, error: err.message });
      await this.stateManager.transitionTo(claimId, 'failed', err.message);

      this.emit('workflow:failed', { claimId, error: err.message, processingTimeMs });

      return {
        success: false,
        claimId,
        finalStatus: 'failed',
        error: err.message,
        processingTimeMs,
      };
    }
  }

  /**
   * Process with pre-extracted claim data (skip OCR/extraction)
   */
  async processExtractedClaim(
    extractedClaim: ExtractedClaim,
    priority: Priority = 'normal'
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const claimId = extractedClaim.id;

    try {
      // Create state
      const state = await this.stateManager.createState(
        claimId,
        `extracted_${claimId}`,
        `hash_${claimId}`,
        priority
      );

      // Set extracted claim
      await this.stateManager.setExtractedClaim(claimId, extractedClaim);

      // Transition to validating (skip parsing/extracting)
      await this.stateManager.transitionTo(claimId, 'parsing', 'Skipping parsing - pre-extracted');
      await this.stateManager.transitionTo(claimId, 'extracting', 'Skipping extraction - pre-extracted');
      await this.stateManager.transitionTo(claimId, 'validating', 'Starting validation');

      this.emit('workflow:started', { claimId });

      // Run validation through completion
      const result = await this.runValidationAndBeyond(state);
      const processingTimeMs = Date.now() - startTime;

      if (result.success) {
        this.emit('workflow:completed', { claimId, result, processingTimeMs });
      }

      return {
        ...result,
        processingTimeMs,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const processingTimeMs = Date.now() - startTime;

      logger.error('Workflow failed', { claimId, error: err.message });
      await this.stateManager.transitionTo(claimId, 'failed', err.message);

      this.emit('workflow:failed', { claimId, error: err.message, processingTimeMs });

      return {
        success: false,
        claimId,
        finalStatus: 'failed',
        error: err.message,
        processingTimeMs,
      };
    }
  }

  /**
   * Submit review decision
   */
  async submitReview(
    claimId: string,
    decision: 'approve' | 'reject' | 'correct',
    corrections?: Partial<ExtractedClaim>,
    reviewerNotes?: string
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      const state = await this.stateManager.getState(claimId);
      if (!state) {
        throw new Error(`Claim not found: ${claimId}`);
      }

      if (state.claim.status !== 'pending_review') {
        throw new Error(`Claim is not pending review: ${state.claim.status}`);
      }

      if (decision === 'approve') {
        // Continue to adjudication
        await this.stateManager.transitionTo(claimId, 'adjudicating', 'Approved by reviewer');
        const result = await this.runAdjudication(state);
        return { ...result, processingTimeMs: Date.now() - startTime };
      } else if (decision === 'reject') {
        // Mark as failed
        await this.stateManager.transitionTo(claimId, 'failed', `Rejected by reviewer: ${reviewerNotes}`);
        return {
          success: false,
          claimId,
          finalStatus: 'failed',
          error: `Rejected: ${reviewerNotes}`,
          processingTimeMs: Date.now() - startTime,
        };
      } else if (decision === 'correct' && corrections) {
        // Apply corrections and revalidate
        if (state.extractedClaim) {
          const correctedClaim = { ...state.extractedClaim, ...corrections };
          await this.stateManager.setExtractedClaim(claimId, correctedClaim);
        }
        await this.stateManager.transitionTo(claimId, 'validating', 'Corrected by reviewer');
        const result = await this.runValidationAndBeyond(state);
        return { ...result, processingTimeMs: Date.now() - startTime };
      }

      throw new Error('Invalid review decision');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        claimId,
        finalStatus: 'failed',
        error: err.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get workflow statistics
   */
  getStatistics(): {
    stateStats: ReturnType<StateManager['getStatistics']>;
    config: WorkflowConfig;
  } {
    return {
      stateStats: this.stateManager.getStatistics(),
      config: this.config,
    };
  }

  // Private methods

  private async runIntake(input: DocumentInput): Promise<AgentResult<IntakeOutput>> {
    return IntakeAgent.intake({
      buffer: input.buffer,
      filename: input.filename,
      mimeType: input.mimeType,
      priority: input.priority ?? 'normal',
      metadata: input.metadata,
    });
  }

  private async runPipeline(state: ClaimState): Promise<WorkflowResult> {
    const claimId = state.claim.id;

    // For now, we need extracted claim data to proceed
    // In full implementation, parsing and extraction agents would run here
    if (!state.extractedClaim) {
      // Transition through parsing and extracting stages
      // This is a placeholder - full implementation would use OCR and LLM extraction
      await this.stateManager.transitionTo(claimId, 'parsing', 'Parsing document');
      await this.stateManager.transitionTo(claimId, 'extracting', 'Extracting fields');

      // For demo, we'll mark as needing review since we don't have extraction
      await this.stateManager.transitionTo(claimId, 'pending_review', 'Manual extraction required');

      const queueService = getQueueService();
      await queueService.addToReview(claimId, 'No extracted data - manual entry required', state.claim.priority);

      return {
        success: false,
        claimId,
        finalStatus: 'pending_review',
        error: 'Manual extraction required',
        processingTimeMs: 0,
      };
    }

    // Transition to validating
    await this.stateManager.transitionTo(claimId, 'validating', 'Starting validation');

    return this.runValidationAndBeyond(state);
  }

  private async runValidationAndBeyond(state: ClaimState): Promise<WorkflowResult> {
    const claimId = state.claim.id;

    if (!state.extractedClaim) {
      throw new Error('No extracted claim data');
    }

    // Stage 3: Enrichment
    this.emit('workflow:stage_started', { stage: 'enrichment', claimId });
    const enrichmentService = getEnrichmentService();
    const enrichmentResult = await enrichmentService.enrichClaim(state.extractedClaim);
    const enrichedClaim = enrichmentResult.enrichedClaim;
    await this.stateManager.setExtractedClaim(claimId, enrichedClaim);
    this.emit('workflow:stage_completed', { stage: 'enrichment', claimId });

    // Stage 4: Validation
    this.emit('workflow:stage_started', { stage: 'validation', claimId });
    const validationResult = await this.validationAgent.execute(
      { extractedClaim: enrichedClaim },
      state.claim
    );
    await this.stateManager.setValidationResult(claimId, validationResult.data?.validationResult);
    this.emit('workflow:stage_completed', { stage: 'validation', claimId, result: validationResult });

    // Calculate overall confidence
    const confidence = this.calculateConfidence(enrichedClaim, validationResult.data?.validationResult);
    const nextAction = this.stateManager.determineNextAction(confidence);

    logger.info('Validation completed', {
      claimId,
      isValid: validationResult.data?.validationResult.isValid,
      confidence,
      nextAction,
    });

    // Route based on confidence
    if (!validationResult.data?.validationResult.isValid) {
      if (nextAction === 'correct' && this.stateManager.canAttemptCorrection(state)) {
        // Attempt correction
        await this.stateManager.transitionTo(claimId, 'correcting', 'Attempting auto-correction');
        await this.stateManager.incrementCorrectionAttempts(claimId);

        // For now, just go back to validation (full implementation would use CorrectionAgent)
        await this.stateManager.transitionTo(claimId, 'validating', 'Re-validating after correction');

        // If still failing after correction attempts, escalate
        if (!this.stateManager.canAttemptCorrection(state)) {
          return this.escalateToReview(state, 'Max correction attempts reached');
        }
      } else if (nextAction === 'review') {
        return this.escalateToReview(state, 'Low confidence - human review required');
      }
    }

    // Stage 5: Quality Assessment (optional)
    // Quality assessment requires OCR text - check if available
    const ocrText = (enrichedClaim as unknown as { rawText?: string }).rawText || '';
    if (this.config.enableQualityAssessment && ocrText) {
      this.emit('workflow:stage_started', { stage: 'quality', claimId });
      const qualityService = getQualityService();
      const qualityResult = await qualityService.evaluateExtraction({
        extractedClaim: enrichedClaim,
        ocrText,
        validationResult: validationResult.data?.validationResult,
      });
      await this.stateManager.setQualityResult(claimId, qualityResult);
      this.emit('workflow:stage_completed', { stage: 'quality', claimId, result: qualityResult });

      // Check if quality requires review
      if (qualityResult.requiresReview && qualityResult.overallScore < this.config.autoProcessThreshold) {
        return this.escalateToReview(state, `Quality grade ${qualityResult.grade} requires review`);
      }
    } else if (this.config.enableQualityAssessment) {
      logger.debug('Quality assessment skipped - no OCR text available', { claimId });
    }

    // Stage 6: Adjudication
    await this.stateManager.transitionTo(claimId, 'adjudicating', 'Starting adjudication');
    return this.runAdjudication(state);
  }

  private async runAdjudication(state: ClaimState): Promise<WorkflowResult> {
    const claimId = state.claim.id;

    if (!state.extractedClaim) {
      throw new Error('No extracted claim data');
    }

    this.emit('workflow:stage_started', { stage: 'adjudication', claimId });

    const adjudicationResult = await this.adjudicationAgent.execute(
      { extractedClaim: state.extractedClaim },
      { ...state.claim, status: 'adjudicating' }
    );

    await this.stateManager.setAdjudicationResult(claimId, adjudicationResult.data?.decision);
    this.emit('workflow:stage_completed', { stage: 'adjudication', claimId, result: adjudicationResult });

    // Stage 7: RAG Indexing (optional)
    if (this.config.enableRAGIndexing) {
      this.emit('workflow:stage_started', { stage: 'indexing', claimId });
      try {
        const ragService = getRAGService();
        await ragService.indexClaim(state.extractedClaim);
        this.emit('workflow:stage_completed', { stage: 'indexing', claimId });
      } catch (error) {
        logger.warn('RAG indexing failed', { claimId, error });
        // Don't fail the workflow for indexing errors
      }
    }

    // Mark as completed
    await this.stateManager.transitionTo(claimId, 'completed', 'Processing completed');

    // Refresh state
    const finalState = await this.stateManager.getState(claimId);

    return {
      success: true,
      claimId,
      finalStatus: 'completed',
      extractedClaim: finalState?.extractedClaim,
      validationResult: finalState?.validationResult,
      adjudicationResult: finalState?.adjudicationResult,
      qualityResult: finalState?.qualityResult,
      processingTimeMs: 0, // Will be set by caller
    };
  }

  private async escalateToReview(state: ClaimState, reason: string): Promise<WorkflowResult> {
    const claimId = state.claim.id;

    await this.stateManager.transitionTo(claimId, 'pending_review', reason);

    const queueService = getQueueService();
    await queueService.addToReview(claimId, reason, state.claim.priority);

    return {
      success: false,
      claimId,
      finalStatus: 'pending_review',
      extractedClaim: state.extractedClaim,
      validationResult: state.validationResult,
      error: reason,
      processingTimeMs: 0,
    };
  }

  private calculateConfidence(
    extractedClaim: ExtractedClaim,
    validationResult?: { isValid: boolean; errors: unknown[] }
  ): number {
    // Calculate based on:
    // 1. Field confidence scores
    // 2. Validation result

    const confidenceScores = Object.values(extractedClaim.confidenceScores || {});
    const avgFieldConfidence =
      confidenceScores.length > 0
        ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
        : 0.8;

    // Penalize for validation errors
    const errorPenalty = validationResult?.errors?.length
      ? Math.min(0.3, validationResult.errors.length * 0.05)
      : 0;

    // Boost for valid claims
    const validBonus = validationResult?.isValid ? 0.1 : 0;

    return Math.min(1, Math.max(0, avgFieldConfidence - errorPenalty + validBonus));
  }
}

// Singleton instance
let orchestratorInstance: WorkflowOrchestrator | null = null;

export function getWorkflowOrchestrator(config?: Partial<WorkflowConfig>): WorkflowOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WorkflowOrchestrator(config);
  }
  return orchestratorInstance;
}

export function resetWorkflowOrchestrator(): void {
  orchestratorInstance = null;
}
