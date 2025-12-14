/**
 * RAG Query API routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { queryRateLimiter, lenientRateLimiter } from '../middleware/rateLimit.js';
import {
  validateBody,
  validateParams,
  claimIdSchema,
  queryBodySchema,
} from '../middleware/validation.js';
import { getRAGService } from '../../services/rag.js';
import { getStateManager } from '../../orchestrator/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Apply authentication to all routes
router.use(apiKeyAuth);

/**
 * Query claims using natural language
 * POST /api/query
 */
router.post(
  '/',
  queryRateLimiter,
  validateBody(queryBodySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { question, maxChunks, claimId, documentId } = req.body;

    logger.info('RAG query received', {
      question: question.substring(0, 100),
      maxChunks,
      claimId,
      documentId,
    });

    const ragService = getRAGService();

    const result = await ragService.query({
      question,
      maxChunks,
      claimId,
      documentId,
    });

    res.json({
      success: true,
      data: {
        answer: result.answer,
        confidence: result.confidence,
        sources: result.sources.map((s) => ({
          claimId: s.claimId,
          documentId: s.documentId,
          relevance: s.relevanceScore,
          snippet: s.text,
        })),
      },
    });
  })
);

/**
 * Find similar claims
 * GET /api/claims/:id/similar
 */
router.get(
  '/claims/:id/similar',
  lenientRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    // Verify claim exists
    const stateManager = getStateManager();
    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    const ragService = getRAGService();
    const similarClaims = await ragService.findSimilarClaims(id, limit);

    res.json({
      success: true,
      data: {
        claimId: id,
        similarClaims: similarClaims.map((s) => ({
          claimId: s.claimId,
          similarity: Math.round(s.similarity * 100) / 100,
        })),
      },
    });
  })
);

/**
 * Index a claim for RAG queries
 * POST /api/claims/:id/index
 */
router.post(
  '/claims/:id/index',
  queryRateLimiter,
  validateParams(claimIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Verify claim exists and has extracted data
    const stateManager = getStateManager();
    const state = await stateManager.getState(id);
    if (!state) {
      throw ApiError.notFound(`Claim ${id} not found`);
    }

    if (!state.extractedClaim) {
      throw ApiError.badRequest(`Claim ${id} has not been extracted yet`);
    }

    const ragService = getRAGService();
    await ragService.indexClaim(state.extractedClaim);

    logger.info('Claim indexed for RAG', { claimId: id });

    res.json({
      success: true,
      message: `Claim ${id} indexed successfully`,
    });
  })
);

/**
 * Get RAG service statistics
 * GET /api/query/stats
 */
router.get(
  '/stats',
  lenientRateLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    // RAG stats not yet implemented - return placeholder
    res.json({
      success: true,
      data: {
        indexedClaims: 0,
        totalChunks: 0,
        message: 'RAG statistics endpoint - implementation pending',
      },
    });
  })
);

export default router;
