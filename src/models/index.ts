// Claim models
export {
  DocumentTypeSchema,
  PrioritySchema,
  ClaimStatusSchema,
  GenderSchema,
  AddressSchema,
  BoundingBoxSchema,
  ExtractionMethodSchema,
  ProvenanceSchema,
  PatientSchema,
  ProviderSchema,
  DiagnosisSchema,
  ServiceLineSchema,
  ClaimTotalsSchema,
  ExtractedClaimSchema,
  ClaimSubmissionSchema,
  ClaimRecordSchema,
  createClaimRecord,
  updateClaimStatus,
} from './claim.js';

export type {
  DocumentType,
  Priority,
  ClaimStatus,
  Gender,
  Address,
  BoundingBox,
  ExtractionMethod,
  Provenance,
  Patient,
  Provider,
  Diagnosis,
  ServiceLine,
  ClaimTotals,
  ExtractedClaim,
  ClaimSubmission,
  ClaimRecord,
} from './claim.js';

// Validation models
export {
  ErrorTypeSchema,
  ValidationErrorSchema,
  ValidationResultSchema,
  FieldValidationStatusSchema,
  CorrectionAttemptSchema,
  CorrectionResultSchema,
  RequiredFieldsByDocType,
  createValidationResult,
  createValidationError,
  createCorrectionAttempt,
} from './validation.js';

export type {
  ErrorType,
  ValidationError,
  ValidationResult,
  FieldValidationStatus,
  CorrectionAttempt,
  CorrectionResult,
} from './validation.js';

// Adjudication models
export {
  AdjudicationStatusSchema,
  LineDecisionStatusSchema,
  DenialReasonSchema,
  LineDecisionSchema,
  AdjudicationTotalsSchema,
  AdjudicationDecisionSchema,
  EligibilityCheckSchema,
  CoverageCheckSchema,
  FeeScheduleEntrySchema,
  MemberBenefitsSchema,
  DenialCodes,
  createLineDecision,
  createAdjudicationDecision,
  createDenialReason,
} from './adjudication.js';

export type {
  AdjudicationStatus,
  LineDecisionStatus,
  DenialReason,
  LineDecision,
  AdjudicationTotals,
  AdjudicationDecision,
  EligibilityCheck,
  CoverageCheck,
  FeeScheduleEntry,
  MemberBenefits,
} from './adjudication.js';
