/**
 * Claim State Manager
 *
 * Manages claim state transitions, persistence, and history tracking.
 * Provides a centralized way to track claim processing status.
 */

import { EventEmitter } from 'events';
import {
  ClaimRecord,
  ClaimStatus,
  ExtractedClaim,
  createClaimRecord,
  updateClaimStatus,
} from '../models/index.js';
import { getStorageService } from '../services/storage.js';
import type { StorageService } from '../services/storage.js';
import { logger } from '../utils/index.js';

export interface StateTransition {
  claimId: string;
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
  timestamp: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ClaimState {
  claim: ClaimRecord;
  extractedClaim?: ExtractedClaim;
  validationResult?: unknown;
  adjudicationResult?: unknown;
  qualityResult?: unknown;
  correctionAttempts: number;
  lastError?: string;
}

export interface StateManagerConfig {
  maxCorrectionAttempts: number;
  autoProcessThreshold: number;
  correctionThreshold: number;
}

const DEFAULT_CONFIG: StateManagerConfig = {
  maxCorrectionAttempts: 3,
  autoProcessThreshold: 0.85,
  correctionThreshold: 0.60,
};

/**
 * State Manager for claim processing
 *
 * Events emitted:
 * - 'state:created' - New claim state created
 * - 'state:updated' - Claim state updated
 * - 'state:transition' - Status transition occurred
 * - 'state:completed' - Claim processing completed
 * - 'state:failed' - Claim processing failed
 * - 'state:review_required' - Human review required
 */
export class StateManager extends EventEmitter {
  private states: Map<string, ClaimState> = new Map();
  private storage: StorageService | null = null;
  private config: StateManagerConfig;

  constructor(config: Partial<StateManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async getStorage(): Promise<StorageService> {
    if (!this.storage) {
      this.storage = await getStorageService();
    }
    return this.storage;
  }

  /**
   * Create a new claim state
   */
  async createState(
    claimId: string,
    documentId: string,
    documentHash: string,
    priority: 'normal' | 'high' | 'urgent' = 'normal',
    metadata?: Record<string, string>
  ): Promise<ClaimState> {
    const claim = createClaimRecord(claimId, documentId, documentHash, priority, metadata);

    const state: ClaimState = {
      claim,
      correctionAttempts: 0,
    };

    this.states.set(claimId, state);

    // Persist to storage
    const storage = await this.getStorage();
    await storage.storeClaim(claim);

    logger.info('Claim state created', { claimId, status: claim.status });
    this.emit('state:created', { claimId, state });

    return state;
  }

  /**
   * Get claim state
   */
  async getState(claimId: string): Promise<ClaimState | null> {
    // Check in-memory first
    let state = this.states.get(claimId);

    if (!state) {
      // Try loading from storage
      const storage = await this.getStorage();
      const claim = await storage.getClaim(claimId);
      if (claim) {
        state = {
          claim,
          correctionAttempts: 0,
        };
        this.states.set(claimId, state);
      }
    }

    return state ?? null;
  }

  /**
   * Transition claim to a new status
   */
  async transitionTo(
    claimId: string,
    newStatus: ClaimStatus,
    message?: string,
    metadata?: Record<string, unknown>
  ): Promise<ClaimState> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    const fromStatus = state.claim.status;

    // Validate transition
    if (!this.isValidTransition(fromStatus, newStatus)) {
      throw new Error(`Invalid transition from ${fromStatus} to ${newStatus}`);
    }

    // Update claim
    state.claim = updateClaimStatus(state.claim, newStatus, message);

    // Persist
    const storage = await this.getStorage();
    await storage.storeClaim(state.claim);

    const transition: StateTransition = {
      claimId,
      fromStatus,
      toStatus: newStatus,
      timestamp: new Date().toISOString(),
      message,
      metadata,
    };

    logger.info('Claim status transition', {
      claimId,
      from: fromStatus,
      to: newStatus,
      message,
    });

    this.emit('state:transition', transition);
    this.emit('state:updated', { claimId, state });

    // Emit specific events for terminal states
    if (newStatus === 'completed') {
      this.emit('state:completed', { claimId, state });
    } else if (newStatus === 'failed') {
      this.emit('state:failed', { claimId, state, error: message });
    } else if (newStatus === 'pending_review') {
      this.emit('state:review_required', { claimId, state, reason: message });
    }

    return state;
  }

  /**
   * Update extracted claim data
   */
  async setExtractedClaim(claimId: string, extractedClaim: ExtractedClaim): Promise<void> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    state.extractedClaim = extractedClaim;
    state.claim.extractedClaim = extractedClaim;

    const storage = await this.getStorage();
    await storage.storeClaim(state.claim);
    this.emit('state:updated', { claimId, state });
  }

  /**
   * Update validation result
   */
  async setValidationResult(claimId: string, validationResult: unknown): Promise<void> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    state.validationResult = validationResult;
    this.emit('state:updated', { claimId, state });
  }

  /**
   * Update adjudication result
   */
  async setAdjudicationResult(claimId: string, adjudicationResult: unknown): Promise<void> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    state.adjudicationResult = adjudicationResult;
    this.emit('state:updated', { claimId, state });
  }

  /**
   * Update quality result
   */
  async setQualityResult(claimId: string, qualityResult: unknown): Promise<void> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    state.qualityResult = qualityResult;
    this.emit('state:updated', { claimId, state });
  }

  /**
   * Record a correction attempt
   */
  async incrementCorrectionAttempts(claimId: string): Promise<number> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    state.correctionAttempts++;
    this.emit('state:updated', { claimId, state });

    return state.correctionAttempts;
  }

  /**
   * Check if more correction attempts are allowed
   */
  canAttemptCorrection(state: ClaimState): boolean {
    return state.correctionAttempts < this.config.maxCorrectionAttempts;
  }

  /**
   * Set error on claim
   */
  async setError(claimId: string, error: string): Promise<void> {
    const state = await this.getState(claimId);
    if (!state) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    state.lastError = error;
    this.emit('state:updated', { claimId, state });
  }

  /**
   * Determine next action based on confidence score
   */
  determineNextAction(confidence: number): 'auto_process' | 'correct' | 'review' {
    if (confidence >= this.config.autoProcessThreshold) {
      return 'auto_process';
    }
    if (confidence >= this.config.correctionThreshold) {
      return 'correct';
    }
    return 'review';
  }

  /**
   * Get all claims by status
   */
  async getClaimsByStatus(status: ClaimStatus): Promise<ClaimState[]> {
    const results: ClaimState[] = [];

    for (const state of this.states.values()) {
      if (state.claim.status === status) {
        results.push(state);
      }
    }

    return results;
  }

  /**
   * Get claims pending review
   */
  async getPendingReview(): Promise<ClaimState[]> {
    return this.getClaimsByStatus('pending_review');
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    total: number;
    byStatus: Record<ClaimStatus, number>;
    averageCorrectionAttempts: number;
  } {
    const byStatus: Record<ClaimStatus, number> = {
      received: 0,
      parsing: 0,
      extracting: 0,
      validating: 0,
      correcting: 0,
      pending_review: 0,
      adjudicating: 0,
      completed: 0,
      failed: 0,
    };

    let totalCorrectionAttempts = 0;

    for (const state of this.states.values()) {
      byStatus[state.claim.status]++;
      totalCorrectionAttempts += state.correctionAttempts;
    }

    return {
      total: this.states.size,
      byStatus,
      averageCorrectionAttempts:
        this.states.size > 0 ? totalCorrectionAttempts / this.states.size : 0,
    };
  }

  /**
   * List all claims with optional filtering
   */
  async listStates(filters?: {
    status?: string;
    priority?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ClaimState[]> {
    const results: ClaimState[] = [];

    for (const state of this.states.values()) {
      // Apply filters
      if (filters?.status && state.claim.status !== filters.status) {
        continue;
      }
      if (filters?.priority && state.claim.priority !== filters.priority) {
        continue;
      }
      if (filters?.fromDate) {
        const createdAt = new Date(state.claim.createdAt);
        if (createdAt < filters.fromDate) {
          continue;
        }
      }
      if (filters?.toDate) {
        const createdAt = new Date(state.claim.createdAt);
        if (createdAt > filters.toDate) {
          continue;
        }
      }
      results.push(state);
    }

    return results;
  }

  /**
   * Delete a claim state
   */
  async deleteState(claimId: string): Promise<boolean> {
    const state = this.states.get(claimId);
    if (!state) {
      return false;
    }

    this.states.delete(claimId);

    // Also delete from storage
    const storage = await this.getStorage();
    await storage.deleteClaim(claimId);

    this.emit('state:deleted', { claimId });
    return true;
  }

  /**
   * Validate if a status transition is allowed
   */
  private isValidTransition(from: ClaimStatus, to: ClaimStatus): boolean {
    const validTransitions: Record<ClaimStatus, ClaimStatus[]> = {
      received: ['parsing', 'failed'],
      parsing: ['extracting', 'failed'],
      extracting: ['validating', 'pending_review', 'failed'],
      validating: ['correcting', 'pending_review', 'adjudicating', 'failed'],
      correcting: ['validating', 'pending_review', 'failed'],
      pending_review: ['validating', 'adjudicating', 'completed', 'failed'],
      adjudicating: ['completed', 'pending_review', 'failed'],
      completed: [], // Terminal state
      failed: ['received'], // Can retry from failed
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Clear in-memory state (for testing)
   */
  clear(): void {
    this.states.clear();
  }
}

// Singleton instance
let stateManagerInstance: StateManager | null = null;

export function getStateManager(config?: Partial<StateManagerConfig>): StateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager(config);
  }
  return stateManagerInstance;
}

export function resetStateManager(): void {
  if (stateManagerInstance) {
    stateManagerInstance.clear();
  }
  stateManagerInstance = null;
}
