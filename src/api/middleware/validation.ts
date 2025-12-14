/**
 * Request validation middleware using Zod
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ApiError } from './error.js';

/**
 * Validate request body against a Zod schema
 */
export const validateBody = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.badRequest('Invalid request body', result.error.errors);
    }
    req.body = result.data;
    next();
  };
};

/**
 * Validate request query parameters against a Zod schema
 */
export const validateQuery = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw ApiError.badRequest('Invalid query parameters', result.error.errors);
    }
    req.query = result.data;
    next();
  };
};

/**
 * Validate request params against a Zod schema
 */
export const validateParams = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      throw ApiError.badRequest('Invalid URL parameters', result.error.errors);
    }
    req.params = result.data;
    next();
  };
};

// ============ Common Validation Schemas ============

/**
 * Claim ID parameter schema
 */
export const claimIdSchema = z.object({
  id: z.string().min(1, 'Claim ID is required'),
});

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Claims list query schema
 */
export const claimsListSchema = paginationSchema.extend({
  status: z.enum([
    'received',
    'parsing',
    'extracting',
    'validating',
    'correcting',
    'pending_review',
    'adjudicating',
    'completed',
    'failed',
  ]).optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

/**
 * Document upload body schema
 */
export const uploadBodySchema = z.object({
  priority: z.enum(['normal', 'high', 'urgent']).default('normal'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Review submission body schema
 */
export const reviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'correct']),
  corrections: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
});

/**
 * RAG query body schema
 */
export const queryBodySchema = z.object({
  question: z.string().min(1, 'Question is required').max(1000),
  maxChunks: z.number().int().positive().max(20).default(5),
  claimId: z.string().optional(),
  documentId: z.string().optional(),
});

/**
 * Type exports for validated data
 */
export type ClaimIdParams = z.infer<typeof claimIdSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type ClaimsListQuery = z.infer<typeof claimsListSchema>;
export type UploadBody = z.infer<typeof uploadBodySchema>;
export type ReviewBody = z.infer<typeof reviewBodySchema>;
export type QueryBody = z.infer<typeof queryBodySchema>;
