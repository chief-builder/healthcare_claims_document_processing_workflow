/**
 * Review queue API routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { defaultRateLimiter, lenientRateLimiter } from '../middleware/rateLimit.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  claimIdSchema,
  paginationSchema,
  reviewBodySchema,
} from '../middleware/validation.js';
import {
  getStateManager,
  getWorkflowOrchestrator,
  ClaimState,
} from '../../orchestrator/index.js';
import { ExtractedClaim } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Apply authentication to all routes
router.use(apiKeyAuth);

/**
 * Get review queue (claims pending human review)
 * GET /api/review-queue
 */
router.get(
  '/',
  lenientRateLimiter,
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, sortOrder } = req.query as Record<string, unknown>;
    const stateManager = getStateManager();

    // Get claims pending review
    const allStates = await stateManager.listStates({
      status: 'pending_review',
    });

    // Sort by priority (urgent first), then by date
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const sortedStates = [...allStates].sort((a, b) => {
      const aPriority = priorityOrder[a.claim.priority as keyof typeof priorityOrder] ?? 2;
      const bPriority = priorityOrder[b.claim.priority as keyof typeof priorityOrder] ?? 2;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      const order = sortOrder === 'asc' ? 1 : -1;
      return a.claim.createdAt > b.claim.createdAt ? order : -order;
    });

    // Paginate
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedStates = sortedStates.slice(startIdx, startIdx + limitNum);

    // Transform to response format with review-relevant data
    const reviewItems = paginatedStates.map((state) => ({
      claimId: state.claim.id,
      priority: state.claim.priority,
      createdAt: state.claim.createdAt,
      waitingTime: Date.now() - new Date(state.claim.createdAt).getTime(),
      documentType: state.extractedClaim?.documentType,
      patientName: state.extractedClaim
        ? `${state.extractedClaim.patient.firstName} ${state.extractedClaim.patient.lastName}`
        : undefined,
      totalCharges: state.extractedClaim?.totals?.totalCharges,
      confidenceScore: state.extractedClaim?.confidenceScores?.overall,
      validationErrors: (state.validationResult as { errors?: unknown[] } | undefined)?.errors?.length ?? 0,
      validationWarnings: (state.validationResult as { warnings?: unknown[] } | undefined)?.warnings?.length ?? 0,
    }));

    res.json({
      success: true,
      data: reviewItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: sortedStates.length,
        totalPages: Math.ceil(sortedStates.length / limitNum),
      },
      summary: {
        total: sortedStates.length,
        byPriority: {
          urgent: sortedStates.filter((s) => s.claim.priority === 'urgent').length,
          high: sortedStates.filter((s) => s.claim.priority === 'high').length,
          normal: sortedStates.filter((s) => s.claim.priority === 'normal').length,
        },
      },
    });
  })
);

/**
 * Get review details for a specific claim
 * GET /api/review-queue/:id
 */
router.get(
  '/:id',
  lenientRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stateManager = getStateManager();

    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    if (state.claim.status !== 'pending_review') {
      throw ApiError.badRequest(`Claim ${id} is not pending review (status: ${state.claim.status})`);
    }

    res.json({
      success: true,
      data: {
        claim: {
          id: state.claim.id,
          status: state.claim.status,
          priority: state.claim.priority,
          documentId: state.claim.documentId,
          createdAt: state.claim.createdAt,
          processingHistory: state.claim.processingHistory,
        },
        extraction: state.extractedClaim,
        validation: state.validationResult,
        reviewActions: ['approve', 'reject', 'correct'],
      },
    });
  })
);

/**
 * Submit review decision
 * POST /api/claims/:id/review
 */
router.post(
  '/:id/review',
  defaultRateLimiter,
  validateParams(claimIdSchema),
  validateBody(reviewBodySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, corrections, reason } = req.body;

    const stateManager = getStateManager();
    const orchestrator = getWorkflowOrchestrator();

    // Verify claim exists and is in pending_review
    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    if (state.claim.status !== 'pending_review') {
      throw ApiError.badRequest(
        `Claim ${id} is not pending review (status: ${state.claim.status})`
      );
    }

    logger.info('Review submitted', {
      claimId: id,
      action,
      hasCorrections: !!corrections,
      reason,
    });

    // Submit the review
    const result = await orchestrator.submitReview(
      id,
      action as 'approve' | 'reject' | 'correct',
      corrections as Partial<ExtractedClaim> | undefined,
      reason
    );

    res.json({
      success: result.success,
      data: {
        claimId: id,
        action,
        finalStatus: result.finalStatus,
        processingTimeMs: result.processingTimeMs,
      },
      message: result.success
        ? `Review ${action} completed successfully`
        : `Review failed: ${result.error}`,
      error: result.error,
    });
  })
);

/**
 * Get review statistics
 * GET /api/review-queue/stats
 */
router.get(
  '/stats/summary',
  lenientRateLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    const stateManager = getStateManager();
    const stats = stateManager.getStatistics();

    const pendingReviewCount = stats.byStatus.pending_review || 0;

    // Get all pending reviews for more detailed stats
    const pendingReviews = await stateManager.listStates({
      status: 'pending_review',
    });

    // Calculate average wait time
    const now = Date.now();
    const waitTimes = pendingReviews.map(
      (s: ClaimState) => now - new Date(s.claim.createdAt).getTime()
    );
    const avgWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a: number, b: number) => a + b, 0) / waitTimes.length
      : 0;

    // Calculate average confidence
    const confidences = pendingReviews
      .map((s: ClaimState) => s.extractedClaim?.confidenceScores?.overall)
      .filter((c): c is number => c !== undefined);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
      : 0;

    res.json({
      success: true,
      data: {
        pendingReviewCount,
        averageWaitTimeMs: Math.round(avgWaitTime),
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        oldestPendingMs: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
        byPriority: {
          urgent: pendingReviews.filter((s: ClaimState) => s.claim.priority === 'urgent').length,
          high: pendingReviews.filter((s: ClaimState) => s.claim.priority === 'high').length,
          normal: pendingReviews.filter((s: ClaimState) => s.claim.priority === 'normal').length,
        },
        totalProcessed: stats.total,
        completedCount: stats.byStatus.completed || 0,
        failedCount: stats.byStatus.failed || 0,
      },
    });
  })
);

export default router;
