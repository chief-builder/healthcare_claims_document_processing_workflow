/**
 * Health check endpoints
 */

import { Router, Request, Response } from 'express';
import { getStateManager } from '../../orchestrator/index.js';

const router = Router();

/**
 * Basic health check
 * GET /api/health
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check with component status
 * GET /api/health/detailed
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const stateManager = getStateManager();
  const stats = stateManager.getStatistics();

  const health = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    components: {
      stateManager: {
        status: 'healthy',
        totalClaims: stats.total,
        claimsByStatus: stats.byStatus,
      },
      storage: {
        status: 'healthy',
      },
    },
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
  };

  res.json(health);
});

/**
 * Readiness probe (for Kubernetes)
 * GET /api/health/ready
 */
router.get('/ready', (_req: Request, res: Response) => {
  // Check if all required services are available
  try {
    getStateManager();
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false, error: 'Services not initialized' });
  }
});

/**
 * Liveness probe (for Kubernetes)
 * GET /api/health/live
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({ alive: true });
});

export default router;
