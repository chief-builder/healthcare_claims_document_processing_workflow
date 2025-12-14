/**
 * Shared types for the Healthcare Claims UI
 */

export type ClaimStatus =
  | 'received'
  | 'parsing'
  | 'extracting'
  | 'validating'
  | 'correcting'
  | 'pending_review'
  | 'adjudicating'
  | 'completed'
  | 'failed';

export type Priority = 'normal' | 'high' | 'urgent';

export interface Claim {
  id: string;
  status: ClaimStatus;
  priority: Priority;
  documentId: string;
  documentHash?: string;
  createdAt: string;
  updatedAt: string;
  processingHistory?: ProcessingStep[];
  metadata?: Record<string, unknown>;
  hasExtractedClaim?: boolean;
  hasValidationResult?: boolean;
  hasAdjudicationResult?: boolean;
}

export interface ProcessingStep {
  stage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ExtractedClaim {
  documentType: string;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    memberId: string;
    groupNumber?: string;
  };
  provider: {
    name: string;
    npi: string;
    taxId?: string;
    address?: string;
  };
  serviceLines: ServiceLine[];
  totals: {
    totalCharges: number;
    amountPaid?: number;
    patientResponsibility?: number;
  };
  confidenceScores: {
    overall: number;
    patient: number;
    provider: number;
    services: number;
  };
}

export interface ServiceLine {
  lineNumber: number;
  dateOfService: string;
  procedureCode: string;
  description: string;
  quantity: number;
  chargeAmount: number;
  diagnosisCodes: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidenceScore: number;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: 'warning';
}

export interface AdjudicationResult {
  decision: 'approved' | 'denied' | 'partial';
  approvedAmount: number;
  deniedAmount: number;
  adjustments: Adjustment[];
  reasoning: string;
}

export interface Adjustment {
  lineNumber: number;
  adjustmentCode: string;
  adjustmentAmount: number;
  reason: string;
}

export interface ReviewQueueItem {
  claimId: string;
  priority: Priority;
  createdAt: string;
  waitingTime: number;
  documentType?: string;
  patientName?: string;
  totalCharges?: number;
  confidenceScore?: number;
  validationErrors: number;
  validationWarnings: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ClaimEvent {
  type: 'status_change' | 'processing_update' | 'error';
  claimId: string;
  timestamp: string;
  data: {
    previousStatus?: ClaimStatus;
    newStatus?: ClaimStatus;
    stage?: string;
    message?: string;
    error?: string;
  };
}
