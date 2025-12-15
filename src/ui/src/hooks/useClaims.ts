/**
 * React Query hooks for claims data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../lib/api';

// ============ Claims Hooks ============

export function useClaims(params: api.ListClaimsParams = {}) {
  return useQuery({
    queryKey: ['claims', params],
    queryFn: () => api.listClaims(params),
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useClaim(id: string | undefined) {
  return useQuery({
    queryKey: ['claim', id],
    queryFn: () => api.getClaim(id!),
    enabled: !!id,
    refetchInterval: 5000, // Refresh every 5 seconds while viewing
  });
}

export function useClaimExtraction(id: string | undefined) {
  return useQuery({
    queryKey: ['claim', id, 'extraction'],
    queryFn: () => api.getClaimExtraction(id!),
    enabled: !!id,
  });
}

export function useClaimValidation(id: string | undefined) {
  return useQuery({
    queryKey: ['claim', id, 'validation'],
    queryFn: () => api.getClaimValidation(id!),
    enabled: !!id,
  });
}

export function useClaimAdjudication(id: string | undefined) {
  return useQuery({
    queryKey: ['claim', id, 'adjudication'],
    queryFn: () => api.getClaimAdjudication(id!),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useDeleteClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteClaim,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

// ============ Review Queue Hooks ============

export function useReviewQueue(params: api.ListReviewQueueParams = {}) {
  return useQuery({
    queryKey: ['review-queue', params],
    queryFn: () => api.listReviewQueue(params),
    refetchInterval: 10000,
  });
}

export function useReviewDetails(id: string | undefined) {
  return useQuery({
    queryKey: ['review', id],
    queryFn: () => api.getReviewDetails(id!),
    enabled: !!id,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: api.SubmitReviewParams }) =>
      api.submitReview(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useReviewStats() {
  return useQuery({
    queryKey: ['review-stats'],
    queryFn: api.getReviewStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// ============ Health Hooks ============

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });
}

export function useDetailedHealth() {
  return useQuery({
    queryKey: ['health', 'detailed'],
    queryFn: api.getDetailedHealth,
    refetchInterval: 30000,
  });
}

// ============ RAG Query Hook ============

export function useRAGQuery() {
  return useMutation({
    mutationFn: api.queryRAG,
  });
}
