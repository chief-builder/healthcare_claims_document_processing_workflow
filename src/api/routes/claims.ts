/**
 * Claims API routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { apiKeyAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { uploadDocument, getUploadedFile } from '../middleware/upload.js';
import { strictRateLimiter, lenientRateLimiter } from '../middleware/rateLimit.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  claimIdSchema,
  claimsListSchema,
  uploadBodySchema,
} from '../middleware/validation.js';
import {
  getStateManager,
  getWorkflowOrchestrator,
} from '../../orchestrator/index.js';
import { Priority } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Apply authentication to all routes
router.use(apiKeyAuth);

/**
 * Submit a new document for processing
 * POST /api/claims
 */
router.post(
  '/',
  strictRateLimiter,
  uploadDocument,
  validateBody(uploadBodySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = getUploadedFile(req);
    if (!file) {
      throw ApiError.badRequest('Document file is required');
    }

    const { priority, metadata } = req.body;

    logger.info('Claim upload received', {
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      priority,
    });

    // Process the document
    const orchestrator = getWorkflowOrchestrator();
    const result = await orchestrator.processDocument({
      buffer: file.buffer,
      filename: file.filename,
      mimeType: file.mimeType,
      priority: priority as Priority,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: {
        claimId: result.claimId,
        status: result.finalStatus,
        processingTimeMs: result.processingTimeMs,
      },
      message: 'Document submitted for processing',
    });
  })
);

/**
 * List claims with filtering and pagination
 * GET /api/claims
 */
router.get(
  '/',
  lenientRateLimiter,
  validateQuery(claimsListSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, sortBy, sortOrder, status, priority, fromDate, toDate } = req.query as Record<string, unknown>;
    const stateManager = getStateManager();

    // Get all states and filter
    const allStates = await stateManager.listStates({
      status: status as string | undefined,
      priority: priority as string | undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });

    // Sort
    const sortedStates = [...allStates].sort((a, b) => {
      const field = (sortBy as string) || 'createdAt';
      const aVal = a.claim[field as keyof typeof a.claim] ?? '';
      const bVal = b.claim[field as keyof typeof b.claim] ?? '';
      const order = sortOrder === 'asc' ? 1 : -1;
      return aVal > bVal ? order : -order;
    });

    // Paginate
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedStates = sortedStates.slice(startIdx, startIdx + limitNum);

    // Transform to response format
    const claims = paginatedStates.map((state) => ({
      id: state.claim.id,
      status: state.claim.status,
      priority: state.claim.priority,
      documentId: state.claim.documentId,
      createdAt: state.claim.createdAt,
      updatedAt: state.claim.updatedAt,
      hasExtractedClaim: !!state.extractedClaim,
      hasValidationResult: !!state.validationResult,
      hasAdjudicationResult: !!state.adjudicationResult,
    }));

    res.json({
      success: true,
      data: claims,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: sortedStates.length,
        totalPages: Math.ceil(sortedStates.length / limitNum),
      },
    });
  })
);

/**
 * Get claim status and details
 * GET /api/claims/:id
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

    res.json({
      success: true,
      data: {
        id: state.claim.id,
        status: state.claim.status,
        priority: state.claim.priority,
        documentId: state.claim.documentId,
        documentHash: state.claim.documentHash,
        createdAt: state.claim.createdAt,
        updatedAt: state.claim.updatedAt,
        processingHistory: state.claim.processingHistory,
        metadata: state.claim.metadata,
      },
    });
  })
);

/**
 * Get extracted claim data
 * GET /api/claims/:id/extraction
 */
router.get(
  '/:id/extraction',
  lenientRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stateManager = getStateManager();

    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    if (!state.extractedClaim) {
      throw ApiError.notFound(`Extraction not available for claim ${id}`);
    }

    res.json({
      success: true,
      data: state.extractedClaim,
    });
  })
);

/**
 * Get validation results
 * GET /api/claims/:id/validation
 */
router.get(
  '/:id/validation',
  lenientRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stateManager = getStateManager();

    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    if (!state.validationResult) {
      throw ApiError.notFound(`Validation results not available for claim ${id}`);
    }

    res.json({
      success: true,
      data: state.validationResult,
    });
  })
);

/**
 * Get adjudication decision
 * GET /api/claims/:id/adjudication
 */
router.get(
  '/:id/adjudication',
  lenientRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stateManager = getStateManager();

    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    if (!state.adjudicationResult) {
      throw ApiError.notFound(`Adjudication not available for claim ${id}`);
    }

    res.json({
      success: true,
      data: state.adjudicationResult,
    });
  })
);

/**
 * Get processing history
 * GET /api/claims/:id/history
 */
router.get(
  '/:id/history',
  lenientRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stateManager = getStateManager();

    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    res.json({
      success: true,
      data: {
        claimId: id,
        history: state.claim.processingHistory,
      },
    });
  })
);

/**
 * Delete a claim
 * DELETE /api/claims/:id
 */
router.delete(
  '/:id',
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const stateManager = getStateManager();

    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    await stateManager.deleteState(id);

    logger.info('Claim deleted', { claimId: id });

    res.json({
      success: true,
      message: `Claim ${id} deleted`,
    });
  })
);

export default router;
