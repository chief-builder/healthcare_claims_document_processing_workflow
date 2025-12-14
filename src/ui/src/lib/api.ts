/**
 * API client for Healthcare Claims IDP
 */

import type {
  Claim,
  ExtractedClaim,
  ValidationResult,
  AdjudicationResult,
  ReviewQueueItem,
  ApiResponse,
} from '../types';

const API_BASE = '/api';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-api-key';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...fetchOptions.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `API error: ${response.status}`);
  }

  return data;
}

// ============ Claims API ============

export interface ListClaimsParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listClaims(
  params: ListClaimsParams = {}
): Promise<ApiResponse<Claim[]>> {
  return fetchApi('/claims', { params: params as Record<string, string | number> });
}

export async function getClaim(id: string): Promise<ApiResponse<Claim>> {
  return fetchApi(`/claims/${id}`);
}

export async function getClaimExtraction(
  id: string
): Promise<ApiResponse<ExtractedClaim>> {
  return fetchApi(`/claims/${id}/extraction`);
}

export async function getClaimValidation(
  id: string
): Promise<ApiResponse<ValidationResult>> {
  return fetchApi(`/claims/${id}/validation`);
}

export async function getClaimAdjudication(
  id: string
): Promise<ApiResponse<AdjudicationResult>> {
  return fetchApi(`/claims/${id}/adjudication`);
}

export async function deleteClaim(id: string): Promise<ApiResponse<void>> {
  return fetchApi(`/claims/${id}`, { method: 'DELETE' });
}

// ============ Document Upload ============

export interface UploadDocumentParams {
  file: File;
  priority?: 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export async function uploadDocument(
  params: UploadDocumentParams
): Promise<ApiResponse<{ claimId: string; status: string; processingTimeMs: number }>> {
  const formData = new FormData();
  formData.append('document', params.file);
  formData.append('priority', params.priority || 'normal');
  if (params.metadata) {
    formData.append('metadata', JSON.stringify(params.metadata));
  }

  const response = await fetch(`${API_BASE}/claims`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Upload failed: ${response.status}`);
  }

  return data;
}

// ============ Review Queue API ============

export interface ListReviewQueueParams {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export async function listReviewQueue(
  params: ListReviewQueueParams = {}
): Promise<ApiResponse<ReviewQueueItem[]> & { summary?: { total: number; byPriority: Record<string, number> } }> {
  return fetchApi('/review-queue', { params: params as Record<string, string | number> });
}

export async function getReviewDetails(id: string): Promise<
  ApiResponse<{
    claim: Claim;
    extraction: ExtractedClaim;
    validation: ValidationResult;
    reviewActions: string[];
  }>
> {
  return fetchApi(`/review-queue/${id}`);
}

export interface SubmitReviewParams {
  action: 'approve' | 'reject' | 'correct';
  corrections?: Partial<ExtractedClaim>;
  reason?: string;
}

export async function submitReview(
  id: string,
  params: SubmitReviewParams
): Promise<ApiResponse<{ claimId: string; action: string; finalStatus: string }>> {
  return fetchApi(`/review-queue/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getReviewStats(): Promise<
  ApiResponse<{
    pendingReviewCount: number;
    averageWaitTimeMs: number;
    averageConfidence: number;
    byPriority: Record<string, number>;
  }>
> {
  return fetchApi('/review-queue/stats/summary');
}

// ============ Health API ============

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  components?: Record<string, { status: string; [key: string]: unknown }>;
}

export async function getHealth(): Promise<ApiResponse<HealthStatus>> {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

export async function getDetailedHealth(): Promise<ApiResponse<HealthStatus>> {
  const response = await fetch(`${API_BASE}/health/detailed`);
  return response.json();
}

// ============ RAG Query API ============

export interface QueryParams {
  question: string;
  maxChunks?: number;
  claimId?: string;
  documentId?: string;
}

export async function queryRAG(
  params: QueryParams
): Promise<
  ApiResponse<{
    question: string;
    answer: string;
    sources: Array<{ documentId: string; text: string; relevanceScore: number }>;
    processingTimeMs: number;
  }>
> {
  return fetchApi('/query', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
