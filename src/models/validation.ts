import { z } from 'zod';

// Error types for validation
export const ErrorTypeSchema = z.enum(['syntax', 'domain', 'business_rule', 'semantic']);
export type ErrorType = z.infer<typeof ErrorTypeSchema>;

// Validation error
export const ValidationErrorSchema = z.object({
  field: z.string(),
  errorType: ErrorTypeSchema,
  message: z.string(),
  currentValue: z.string().optional(),
  suggestedValue: z.string().optional(),
  isCorrectable: z.boolean(),
});
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// Validation result
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationErrorSchema),
  overallConfidence: z.number().min(0).max(1),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Field validation status (for tracking individual field validation)
export const FieldValidationStatusSchema = z.object({
  fieldName: z.string(),
  isValid: z.boolean(),
  confidence: z.number().min(0).max(1),
  errors: z.array(ValidationErrorSchema),
  correctionAttempts: z.number(),
  lastCorrectionAt: z.string().optional(),
});
export type FieldValidationStatus = z.infer<typeof FieldValidationStatusSchema>;

// Correction attempt record
export const CorrectionAttemptSchema = z.object({
  attemptNumber: z.number(),
  timestamp: z.string(),
  fieldName: z.string(),
  originalValue: z.string().optional(),
  correctedValue: z.string().optional(),
  correctionMethod: z.enum(['re_ocr', 'llm_inference', 'rule_based', 'manual']),
  confidence: z.number().min(0).max(1),
  success: z.boolean(),
  errorMessage: z.string().optional(),
});
export type CorrectionAttempt = z.infer<typeof CorrectionAttemptSchema>;

// Correction result
export const CorrectionResultSchema = z.object({
  claimId: z.string(),
  fieldsCorrected: z.array(z.string()),
  fieldsEscalated: z.array(z.string()),
  attempts: z.array(CorrectionAttemptSchema),
  requiresHumanReview: z.boolean(),
  escalationReason: z.string().optional(),
});
export type CorrectionResult = z.infer<typeof CorrectionResultSchema>;

// Required fields by document type
export const RequiredFieldsByDocType: Record<string, string[]> = {
  cms_1500: [
    'patient.memberId',
    'patient.firstName',
    'patient.lastName',
    'patient.dateOfBirth',
    'provider.npi',
    'provider.name',
    'diagnoses',
    'serviceLines',
    'totals.totalCharges',
  ],
  ub_04: [
    'patient.memberId',
    'patient.firstName',
    'patient.lastName',
    'patient.dateOfBirth',
    'provider.npi',
    'provider.name',
    'diagnoses',
    'serviceLines',
    'totals.totalCharges',
    'admissionDate',
  ],
  eob: ['patient.memberId', 'patient.firstName', 'patient.lastName', 'totals.totalCharges'],
  unknown: ['patient.memberId', 'totals.totalCharges'],
};

// Factory functions
export function createValidationResult(
  isValid: boolean,
  errors: ValidationError[] = [],
  warnings: ValidationError[] = [],
  overallConfidence: number = 0
): ValidationResult {
  return {
    isValid,
    errors,
    warnings,
    overallConfidence,
  };
}

export function createValidationError(
  field: string,
  errorType: ErrorType,
  message: string,
  options: {
    currentValue?: string;
    suggestedValue?: string;
    isCorrectable?: boolean;
  } = {}
): ValidationError {
  return {
    field,
    errorType,
    message,
    currentValue: options.currentValue,
    suggestedValue: options.suggestedValue,
    isCorrectable: options.isCorrectable ?? false,
  };
}

export function createCorrectionAttempt(
  attemptNumber: number,
  fieldName: string,
  correctionMethod: CorrectionAttempt['correctionMethod'],
  options: {
    originalValue?: string;
    correctedValue?: string;
    confidence?: number;
    success?: boolean;
    errorMessage?: string;
  } = {}
): CorrectionAttempt {
  return {
    attemptNumber,
    timestamp: new Date().toISOString(),
    fieldName,
    correctionMethod,
    originalValue: options.originalValue,
    correctedValue: options.correctedValue,
    confidence: options.confidence ?? 0,
    success: options.success ?? false,
    errorMessage: options.errorMessage,
  };
}
