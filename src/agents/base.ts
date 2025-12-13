import { ClaimStatus, ClaimRecord } from '../models/index.js';
import { logger, logAgentStart, logAgentComplete, logAgentError } from '../utils/index.js';
import { getConfig } from '../config/index.js';

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  nextStatus?: ClaimStatus;
  confidence?: number;
  requiresHumanReview?: boolean;
  reviewReason?: string;
}

export interface AgentConfig {
  name: string;
  autoProcessThreshold: number;
  correctionThreshold: number;
  maxRetries: number;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected config: AgentConfig;

  constructor(name: string) {
    const appConfig = getConfig();
    this.config = {
      name,
      autoProcessThreshold: appConfig.processing.autoProcessConfidenceThreshold,
      correctionThreshold: appConfig.processing.correctionConfidenceThreshold,
      maxRetries: 3,
    };
  }

  abstract process(input: TInput, claim: ClaimRecord): Promise<AgentResult<TOutput>>;

  async execute(input: TInput, claim: ClaimRecord): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    logAgentStart(this.config.name, claim.id);

    try {
      const result = await this.process(input, claim);
      const duration = Date.now() - startTime;

      logAgentComplete(this.config.name, claim.id, duration, result.success);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logAgentError(this.config.name, claim.id, err);

      return {
        success: false,
        error: err.message,
      };
    }
  }

  protected calculateOverallConfidence(scores: number[]): number {
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  protected calculateWeightedConfidence(
    scores: Array<{ score: number; weight: number }>
  ): number {
    if (scores.length === 0) return 0;
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) return 0;
    return scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
  }

  protected shouldAutoProcess(confidence: number): boolean {
    return confidence >= this.config.autoProcessThreshold;
  }

  protected shouldAttemptCorrection(confidence: number): boolean {
    return (
      confidence >= this.config.correctionThreshold &&
      confidence < this.config.autoProcessThreshold
    );
  }

  protected shouldEscalate(confidence: number): boolean {
    return confidence < this.config.correctionThreshold;
  }

  protected determineNextAction(confidence: number): {
    action: 'auto_process' | 'correct' | 'escalate';
    nextStatus: ClaimStatus;
  } {
    if (this.shouldAutoProcess(confidence)) {
      return { action: 'auto_process', nextStatus: 'adjudicating' };
    }
    if (this.shouldAttemptCorrection(confidence)) {
      return { action: 'correct', nextStatus: 'correcting' };
    }
    return { action: 'escalate', nextStatus: 'pending_review' };
  }

  protected logTransition(
    claimId: string,
    from: ClaimStatus,
    to: ClaimStatus,
    reason?: string
  ): void {
    logger.info('Claim status transition', {
      agent: this.config.name,
      claimId,
      from,
      to,
      reason,
    });
  }

  protected async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Operation failed, retrying', {
          agent: this.config.name,
          attempt,
          maxAttempts,
          error: lastError.message,
        });

        if (attempt < maxAttempts) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    throw lastError;
  }
}
