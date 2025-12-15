import { Priority } from '../models/index.js';
import { logger } from '../utils/index.js';

export interface ReviewQueueItem {
  claimId: string;
  priority: Priority;
  reason: string;
  addedAt: string;
  assignedTo?: string;
  assignedAt?: string;
  lowConfidenceFields: string[];
}

export interface ReviewDecision {
  action: 'approve' | 'reject' | 'return';
  reviewerId: string;
  fieldCorrections?: Record<string, string>;
  comments?: string;
  decidedAt: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'priority' | 'addedAt';
  sortOrder?: 'asc' | 'desc';
}

export class QueueService {
  private reviewQueue: Map<string, ReviewQueueItem> = new Map();
  private reviewHistory: Map<string, ReviewDecision[]> = new Map();

  async addToReview(
    claimId: string,
    reason: string,
    priority: Priority,
    lowConfidenceFields: string[] = []
  ): Promise<void> {
    const item: ReviewQueueItem = {
      claimId,
      priority,
      reason,
      addedAt: new Date().toISOString(),
      lowConfidenceFields,
    };

    this.reviewQueue.set(claimId, item);

    logger.info('Claim added to review queue', {
      claimId,
      priority,
      reason,
      fieldCount: lowConfidenceFields.length,
    });
  }

  async removeFromReview(claimId: string): Promise<boolean> {
    const removed = this.reviewQueue.delete(claimId);
    if (removed) {
      logger.info('Claim removed from review queue', { claimId });
    }
    return removed;
  }

  async getReviewQueue(options: PaginationOptions = {}): Promise<{
    items: ReviewQueueItem[];
    total: number;
  }> {
    let items = Array.from(this.reviewQueue.values());

    // Sort
    const sortBy = options.sortBy ?? 'priority';
    const sortOrder = options.sortOrder ?? 'desc';

    items.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'priority') {
        const priorityOrder = { urgent: 3, high: 2, normal: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else {
        comparison = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = items.length;

    // Paginate
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async getQueueItem(claimId: string): Promise<ReviewQueueItem | null> {
    return this.reviewQueue.get(claimId) ?? null;
  }

  async assignReviewer(claimId: string, reviewerId: string): Promise<boolean> {
    const item = this.reviewQueue.get(claimId);
    if (!item) return false;

    item.assignedTo = reviewerId;
    item.assignedAt = new Date().toISOString();

    logger.info('Reviewer assigned', { claimId, reviewerId });
    return true;
  }

  async unassignReviewer(claimId: string): Promise<boolean> {
    const item = this.reviewQueue.get(claimId);
    if (!item) return false;

    item.assignedTo = undefined;
    item.assignedAt = undefined;

    logger.info('Reviewer unassigned', { claimId });
    return true;
  }

  async submitReview(claimId: string, decision: Omit<ReviewDecision, 'decidedAt'>): Promise<boolean> {
    const item = this.reviewQueue.get(claimId);
    if (!item) return false;

    const fullDecision: ReviewDecision = {
      ...decision,
      decidedAt: new Date().toISOString(),
    };

    // Store in history
    if (!this.reviewHistory.has(claimId)) {
      this.reviewHistory.set(claimId, []);
    }
    this.reviewHistory.get(claimId)!.push(fullDecision);

    // Remove from queue (except for 'return' which keeps it)
    if (decision.action !== 'return') {
      this.reviewQueue.delete(claimId);
    }

    logger.info('Review decision submitted', {
      claimId,
      action: decision.action,
      reviewerId: decision.reviewerId,
    });

    return true;
  }

  async getReviewHistory(claimId: string): Promise<ReviewDecision[]> {
    return this.reviewHistory.get(claimId) ?? [];
  }

  async getQueueStats(): Promise<{
    total: number;
    byPriority: Record<Priority, number>;
    assigned: number;
    unassigned: number;
    averageWaitTimeMs: number;
  }> {
    const items = Array.from(this.reviewQueue.values());
    const now = Date.now();

    const byPriority: Record<Priority, number> = {
      normal: 0,
      high: 0,
      urgent: 0,
    };

    let assigned = 0;
    let totalWaitTime = 0;

    for (const item of items) {
      byPriority[item.priority]++;
      if (item.assignedTo) assigned++;
      totalWaitTime += now - new Date(item.addedAt).getTime();
    }

    return {
      total: items.length,
      byPriority,
      assigned,
      unassigned: items.length - assigned,
      averageWaitTimeMs: items.length > 0 ? totalWaitTime / items.length : 0,
    };
  }

  async getClaimsByReviewer(reviewerId: string): Promise<ReviewQueueItem[]> {
    return Array.from(this.reviewQueue.values()).filter(
      (item) => item.assignedTo === reviewerId
    );
  }

  async updatePriority(claimId: string, priority: Priority): Promise<boolean> {
    const item = this.reviewQueue.get(claimId);
    if (!item) return false;

    const oldPriority = item.priority;
    item.priority = priority;

    logger.info('Queue item priority updated', { claimId, oldPriority, newPriority: priority });
    return true;
  }

  // For testing/debugging
  async clearQueue(): Promise<void> {
    this.reviewQueue.clear();
    logger.warn('Review queue cleared');
  }
}

// Singleton instance
let queueServiceInstance: QueueService | null = null;

export function getQueueService(): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService();
  }
  return queueServiceInstance;
}
