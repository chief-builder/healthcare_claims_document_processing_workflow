/**
 * API Module Exports
 */

// Server
export {
  createApp,
  startServer,
  stopServer,
  getApp,
  getHttpServer,
} from './server.js';

// WebSocket
export {
  initializeWebSocket,
  emitClaimEvent,
  getSocketIO,
  getConnectedClients,
  type ClaimEvent,
} from './websocket.js';

// Middleware
export { ApiError, asyncHandler, errorHandler, notFoundHandler } from './middleware/error.js';
export { apiKeyAuth, optionalAuth, requireRole, type AuthenticatedRequest } from './middleware/auth.js';
export { uploadDocument, uploadDocuments, getUploadedFile, getUploadedFiles, uploadConfig } from './middleware/upload.js';
export { defaultRateLimiter, strictRateLimiter, lenientRateLimiter, queryRateLimiter } from './middleware/rateLimit.js';
export {
  validateBody,
  validateQuery,
  validateParams,
  claimIdSchema,
  paginationSchema,
  claimsListSchema,
  uploadBodySchema,
  reviewBodySchema,
  queryBodySchema,
} from './middleware/validation.js';
