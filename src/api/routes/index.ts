/**
 * API Routes aggregation
 */

import { Router } from 'express';
import claimsRouter from './claims.js';
import reviewRouter from './review.js';
import queryRouter from './query.js';
import healthRouter from './health.js';

const router = Router();

// Mount route modules
router.use('/claims', claimsRouter);
router.use('/review-queue', reviewRouter);
router.use('/query', queryRouter);
router.use('/health', healthRouter);

export default router;
