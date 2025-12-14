/**
 * Error handling middleware for the API
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger.js';

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, message, 'CONFLICT', details);
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(429, message, 'TOO_MANY_REQUESTS');
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Global error handling middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  // Build error response
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] as string | undefined,
  };

  let statusCode = 500;

  // Handle specific error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    response.error.code = err.code || 'ERROR';
    response.error.message = err.message;
    if (err.details) {
      response.error.details = err.details;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    response.error.code = 'VALIDATION_ERROR';
    response.error.message = 'Request validation failed';
    response.error.details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    response.error.code = 'FILE_UPLOAD_ERROR';
    response.error.message = err.message;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    response.error.code = 'INVALID_JSON';
    response.error.message = 'Invalid JSON in request body';
  }

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development') {
    (response.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 handler for unknown routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
