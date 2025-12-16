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
  // Backend uses 'status' as the stage name (ClaimStatus value like 'received', 'parsing', etc.)
  status: ClaimStatus;
  timestamp: string;
  message?: string;
  // Legacy fields for backwards compatibility (not used by backend)
  stage?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ExtractedClaim {
  id?: string;
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
  // Backend stores confidence scores as Record<string, number> with keys like 'patient.firstName', etc.
  confidenceScores: Record<string, number>;
}

export interface ServiceLine {
  lineNumber: number;
  dateOfService: string;
  procedureCode: string;
  description?: string; // May not be present from backend
  modifiers?: string[];
  units: number; // Backend uses 'units' not 'quantity'
  chargeAmount: number;
  diagnosisPointers?: string[]; // Backend uses 'diagnosisPointers' not 'diagnosisCodes'
  placeOfService?: string;
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
  claimId?: string;
  status: 'approved' | 'denied' | 'partial' | 'pending_review';
  lineDecisions?: LineDecision[];
  totals: {
    totalBilled: number;
    totalAllowed: number;
    totalPaid: number;
    totalPatientResponsibility: number;
  };
  explanation: string;
  policyCitations?: string[];
  decidedAt?: string;
  decidedBy?: string;
}

export interface LineDecision {
  lineNumber: number;
  status: 'approved' | 'denied';
  billedAmount: number;
  allowedAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  denialReasons?: Array<{ code: string; description: string }>;
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
