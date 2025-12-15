/**
 * WebSocket handler using Socket.IO
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { getStateManager, getWorkflowOrchestrator } from '../orchestrator/index.js';
import { logger } from '../utils/logger.js';

let io: Server | null = null;

/**
 * WebSocket event types
 */
export interface ClaimEvent {
  claimId: string;
  status?: string;
  previousStatus?: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Initialize Socket.IO server
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      address: socket.handshake.address,
    });

    // Subscribe to specific claim updates
    socket.on('subscribe:claim', (claimId: string) => {
      socket.join(`claim:${claimId}`);
      logger.debug('Client subscribed to claim', {
        socketId: socket.id,
        claimId,
      });
    });

    // Unsubscribe from claim updates
    socket.on('unsubscribe:claim', (claimId: string) => {
      socket.leave(`claim:${claimId}`);
      logger.debug('Client unsubscribed from claim', {
        socketId: socket.id,
        claimId,
      });
    });

    // Subscribe to all claim updates
    socket.on('subscribe:all', () => {
      socket.join('claims:all');
      logger.debug('Client subscribed to all claims', {
        socketId: socket.id,
      });
    });

    // Unsubscribe from all claim updates
    socket.on('unsubscribe:all', () => {
      socket.leave('claims:all');
      logger.debug('Client unsubscribed from all claims', {
        socketId: socket.id,
      });
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        reason,
      });
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        error: error.message,
      });
    });
  });

  // Connect orchestrator events to WebSocket broadcasts
  connectOrchestratorEvents();

  logger.info('WebSocket server initialized');

  return io;
}

/**
 * Connect orchestrator events to WebSocket broadcasts
 */
function connectOrchestratorEvents(): void {
  const stateManager = getStateManager();
  const orchestrator = getWorkflowOrchestrator();

  // State Manager events
  stateManager.on('state:created', (data) => {
    emitClaimEvent('claim:created', {
      claimId: data.claimId,
      status: 'received',
      timestamp: new Date().toISOString(),
    });
  });

  stateManager.on('state:transition', (data) => {
    emitClaimEvent('claim:status_changed', {
      claimId: data.claimId,
      status: data.toStatus,
      previousStatus: data.fromStatus,
      timestamp: new Date().toISOString(),
    });

    // Emit specific events for key transitions
    if (data.toStatus === 'pending_review') {
      emitClaimEvent('claim:review_required', {
        claimId: data.claimId,
        status: 'pending_review',
        timestamp: new Date().toISOString(),
      });
    }
  });

  stateManager.on('state:completed', (data) => {
    emitClaimEvent('claim:completed', {
      claimId: data.claimId,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
  });

  // Workflow events
  orchestrator.on('workflow:started', (data) => {
    emitClaimEvent('workflow:started', {
      claimId: data.claimId,
      timestamp: new Date().toISOString(),
    });
  });

  orchestrator.on('workflow:stage_completed', (data) => {
    const eventMap: Record<string, string> = {
      extraction: 'claim:extraction_complete',
      validation: 'claim:validation_complete',
      adjudication: 'claim:adjudication_complete',
    };

    const eventName = eventMap[data.stage];
    if (eventName) {
      emitClaimEvent(eventName, {
        claimId: data.claimId,
        timestamp: new Date().toISOString(),
        data: { stage: data.stage },
      });
    }
  });

  orchestrator.on('workflow:completed', (data) => {
    emitClaimEvent('workflow:completed', {
      claimId: data.claimId,
      timestamp: new Date().toISOString(),
      data: { success: data.success },
    });
  });

  orchestrator.on('workflow:failed', (data) => {
    emitClaimEvent('claim:failed', {
      claimId: data.claimId,
      status: 'failed',
      timestamp: new Date().toISOString(),
      data: { error: data.error },
    });
  });
}

/**
 * Emit a claim event to subscribed clients
 */
export function emitClaimEvent(eventName: string, event: ClaimEvent): void {
  if (!io) {
    return;
  }

  // Emit to specific claim room
  io.to(`claim:${event.claimId}`).emit(eventName, event);

  // Emit to all claims room
  io.to('claims:all').emit(eventName, event);

  logger.debug('WebSocket event emitted', {
    event: eventName,
    claimId: event.claimId,
  });
}

/**
 * Get the Socket.IO server instance
 */
export function getSocketIO(): Server | null {
  return io;
}

/**
 * Get connected client count
 */
export async function getConnectedClients(): Promise<number> {
  if (!io) {
    return 0;
  }
  const sockets = await io.fetchSockets();
  return sockets.length;
}
