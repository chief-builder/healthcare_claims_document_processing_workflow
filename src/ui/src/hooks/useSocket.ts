/**
 * Socket.IO hook for real-time claim updates
 */

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import type { ClaimEvent, ClaimStatus } from '../types';

// ============ Socket State Store ============

interface SocketState {
  connected: boolean;
  events: ClaimEvent[];
  setConnected: (connected: boolean) => void;
  addEvent: (event: ClaimEvent) => void;
  clearEvents: () => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  events: [],
  setConnected: (connected) => set({ connected }),
  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 100), // Keep last 100 events
    })),
  clearEvents: () => set({ events: [] }),
}));

// ============ Socket Manager ============

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

// ============ Socket Hook ============

export function useSocket() {
  const queryClient = useQueryClient();
  const { setConnected, addEvent } = useSocketStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    // Event handlers
    socket.on('claim:status_change', (data: {
      claimId: string;
      previousStatus: ClaimStatus;
      newStatus: ClaimStatus;
      timestamp: string;
    }) => {
      console.log('Claim status changed:', data);

      // Add to events
      addEvent({
        type: 'status_change',
        claimId: data.claimId,
        timestamp: data.timestamp,
        data: {
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
        },
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claim', data.claimId] });

      if (data.newStatus === 'pending_review') {
        queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      }
    });

    socket.on('claim:processing_update', (data: {
      claimId: string;
      stage: string;
      status: string;
      timestamp: string;
    }) => {
      console.log('Processing update:', data);

      addEvent({
        type: 'processing_update',
        claimId: data.claimId,
        timestamp: data.timestamp,
        data: {
          stage: data.stage,
          message: `${data.stage}: ${data.status}`,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['claim', data.claimId] });
    });

    socket.on('claim:error', (data: {
      claimId: string;
      error: string;
      timestamp: string;
    }) => {
      console.log('Claim error:', data);

      addEvent({
        type: 'error',
        claimId: data.claimId,
        timestamp: data.timestamp,
        data: {
          error: data.error,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claim', data.claimId] });
    });

    // Connect
    socket.connect();

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [queryClient, setConnected, addEvent]);

  // Subscribe to specific claim
  const subscribeToClaim = useCallback((claimId: string) => {
    socketRef.current?.emit('subscribe:claim', claimId);
  }, []);

  // Unsubscribe from specific claim
  const unsubscribeFromClaim = useCallback((claimId: string) => {
    socketRef.current?.emit('unsubscribe:claim', claimId);
  }, []);

  // Subscribe to all events
  const subscribeToAll = useCallback(() => {
    socketRef.current?.emit('subscribe:all');
  }, []);

  return {
    subscribeToClaim,
    unsubscribeFromClaim,
    subscribeToAll,
  };
}

// ============ Hook for Claim-Specific Subscriptions ============

export function useClaimSubscription(claimId: string | undefined) {
  const { subscribeToClaim, unsubscribeFromClaim } = useSocket();

  useEffect(() => {
    if (claimId) {
      subscribeToClaim(claimId);
      return () => unsubscribeFromClaim(claimId);
    }
  }, [claimId, subscribeToClaim, unsubscribeFromClaim]);
}
