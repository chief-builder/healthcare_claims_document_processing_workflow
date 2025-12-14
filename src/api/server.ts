/**
 * Express server configuration with Socket.IO
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server as HttpServer } from 'http';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { defaultRateLimiter } from './middleware/rateLimit.js';
import { initializeWebSocket, getConnectedClients } from './websocket.js';

let app: Express | null = null;
let httpServer: HttpServer | null = null;

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const application = express();
  const config = getConfig();

  // Security middleware
  application.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  }));

  // CORS configuration
  application.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24 hours
  }));

  // Body parsing
  application.use(express.json({ limit: '10mb' }));
  application.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID middleware
  application.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Request logging middleware
  application.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.headers['x-request-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    });

    next();
  });

  // Default rate limiting
  application.use('/api', defaultRateLimiter);

  // API routes
  application.use('/api', routes);

  // Root endpoint
  application.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Healthcare Claims IDP API',
      version: process.env.npm_package_version || '1.0.0',
      status: 'running',
      documentation: '/api/health',
      endpoints: {
        health: '/api/health',
        claims: '/api/claims',
        reviewQueue: '/api/review-queue',
        query: '/api/query',
      },
    });
  });

  // API info endpoint
  application.get('/api', async (_req: Request, res: Response) => {
    const connectedClients = await getConnectedClients();

    res.json({
      name: 'Healthcare Claims IDP API',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.nodeEnv,
      endpoints: {
        'POST /api/claims': 'Submit document for processing',
        'GET /api/claims': 'List all claims',
        'GET /api/claims/:id': 'Get claim details',
        'GET /api/claims/:id/extraction': 'Get extracted data',
        'GET /api/claims/:id/validation': 'Get validation results',
        'GET /api/claims/:id/adjudication': 'Get adjudication decision',
        'DELETE /api/claims/:id': 'Delete a claim',
        'GET /api/review-queue': 'List claims pending review',
        'POST /api/claims/:id/review': 'Submit review decision',
        'POST /api/query': 'Query claims using natural language',
        'GET /api/query/claims/:id/similar': 'Find similar claims',
        'GET /api/health': 'Health check',
        'GET /api/health/detailed': 'Detailed health status',
      },
      websocket: {
        connected: connectedClients,
        events: [
          'claim:created',
          'claim:status_changed',
          'claim:extraction_complete',
          'claim:validation_complete',
          'claim:review_required',
          'claim:adjudication_complete',
          'claim:completed',
          'claim:failed',
        ],
      },
    });
  });

  // 404 handler
  application.use(notFoundHandler);

  // Error handler (must be last)
  application.use(errorHandler);

  return application;
}

/**
 * Start the server
 */
export async function startServer(port?: number): Promise<{ app: Express; server: HttpServer }> {
  const config = getConfig();
  const serverPort = port || config.server.port;

  app = createApp();
  httpServer = createServer(app);

  // Initialize WebSocket
  initializeWebSocket(httpServer);

  return new Promise((resolve, reject) => {
    httpServer!.listen(serverPort, () => {
      logger.info(`Server started`, {
        port: serverPort,
        environment: config.server.nodeEnv,
        pid: process.pid,
      });

      console.log(`
╔════════════════════════════════════════════════════════════╗
║     Healthcare Claims IDP API Server                        ║
╠════════════════════════════════════════════════════════════╣
║  🚀 Server running on port ${serverPort.toString().padEnd(30)}║
║  📡 WebSocket enabled                                       ║
║  🔒 API Key authentication required                         ║
║                                                             ║
║  Endpoints:                                                 ║
║    GET  /api/health          - Health check                 ║
║    POST /api/claims          - Submit document              ║
║    GET  /api/claims          - List claims                  ║
║    GET  /api/review-queue    - Review queue                 ║
║    POST /api/query           - RAG query                    ║
╚════════════════════════════════════════════════════════════╝
      `);

      resolve({ app: app!, server: httpServer! });
    });

    httpServer!.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${serverPort} is already in use`);
      }
      reject(error);
    });
  });
}

/**
 * Stop the server
 */
export async function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!httpServer) {
      resolve();
      return;
    }

    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      logger.info('Server stopped');
      app = null;
      httpServer = null;
      resolve();
    });
  });
}

/**
 * Get the Express app instance
 */
export function getApp(): Express | null {
  return app;
}

/**
 * Get the HTTP server instance
 */
export function getHttpServer(): HttpServer | null {
  return httpServer;
}
