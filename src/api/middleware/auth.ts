/**
 * Authentication middleware for the API
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Extended request with user info
 */
export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  user?: {
    id: string;
    role: 'admin' | 'user' | 'reviewer';
  };
}

/**
 * API key authentication middleware
 *
 * Supports API key in:
 * - Header: X-API-Key
 * - Header: Authorization: Bearer <key>
 * - Query: ?api_key=<key>
 */
export const apiKeyAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  // Extract API key from various sources
  let apiKey: string | undefined;

  // Check X-API-Key header
  const xApiKey = req.headers['x-api-key'];
  if (xApiKey && typeof xApiKey === 'string') {
    apiKey = xApiKey;
  }

  // Check Authorization header (Bearer token)
  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7);
    }
  }

  // Check query parameter (least secure, for development)
  if (!apiKey && req.query.api_key && typeof req.query.api_key === 'string') {
    apiKey = req.query.api_key;
  }

  if (!apiKey) {
    throw ApiError.unauthorized('API key required');
  }

  // Validate API key
  const config = getConfig();
  const validKeys = getValidApiKeys(config);

  if (!validKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path,
      keyPrefix: apiKey.slice(0, 8) + '...',
    });
    throw ApiError.unauthorized('Invalid API key');
  }

  // Attach API key info to request
  req.apiKey = apiKey;
  req.user = {
    id: 'api-user',
    role: 'user',
  };

  next();
};

/**
 * Optional authentication - allows both authenticated and unauthenticated requests
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Try to authenticate, but don't fail if no key provided
    const xApiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    if (xApiKey || authHeader) {
      apiKeyAuth(req, res, next);
    } else {
      next();
    }
  } catch {
    // If authentication fails, continue without auth
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (...roles: Array<'admin' | 'user' | 'reviewer'>) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Role ${req.user.role} not authorized for this action`);
    }

    next();
  };
};

/**
 * Get valid API keys from config/environment
 */
function getValidApiKeys(config: ReturnType<typeof getConfig>): string[] {
  const keys: string[] = [];

  // Add OAuth token as valid API key
  if (config.anthropic.apiKey) {
    keys.push(config.anthropic.apiKey);
  }

  // Add additional API keys from environment
  const additionalKeys = process.env.API_KEYS;
  if (additionalKeys) {
    keys.push(...additionalKeys.split(',').map((k) => k.trim()));
  }

  // For development, allow a default key
  if (config.server.nodeEnv === 'development') {
    keys.push('dev-api-key');
  }

  return keys;
}
