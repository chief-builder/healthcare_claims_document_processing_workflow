/**
 * Rate limiting middleware
 */

import rateLimit from 'express-rate-limit';
import { ApiError } from './error.js';

/**
 * Default rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req, _res, _next, options) => {
    throw ApiError.tooManyRequests(
      `Too many requests. Limit: ${options.max} per ${options.windowMs / 60000} minutes`
    );
  },
});

/**
 * Strict rate limiter for expensive operations (document upload, processing)
 * 20 requests per 15 minutes per IP
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: { error: 'Too many document uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, _next, options) => {
    throw ApiError.tooManyRequests(
      `Too many uploads. Limit: ${options.max} per ${options.windowMs / 60000} minutes`
    );
  },
});

/**
 * Lenient rate limiter for read-only endpoints
 * 500 requests per 15 minutes per IP
 */
export const lenientRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, _next, options) => {
    throw ApiError.tooManyRequests(
      `Too many requests. Limit: ${options.max} per ${options.windowMs / 60000} minutes`
    );
  },
});

/**
 * Rate limiter for RAG query endpoints (uses LLM, expensive)
 * 30 requests per 15 minutes per IP
 */
export const queryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: { error: 'Too many queries, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, _next, options) => {
    throw ApiError.tooManyRequests(
      `Too many queries. Limit: ${options.max} per ${options.windowMs / 60000} minutes`
    );
  },
});
