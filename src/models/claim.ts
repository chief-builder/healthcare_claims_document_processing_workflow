import { z } from 'zod';

// Document types
export const DocumentTypeSchema = z.enum(['cms_1500', 'ub_04', 'eob', 'unknown']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// Priority levels
export const PrioritySchema = z.enum(['normal', 'high', 'urgent']);
export type Priority = z.infer<typeof PrioritySchema>;

// Claim status
export const ClaimStatusSchema = z.enum([
  'received',
  'parsing',
  'extracting',
  'validating',
  'correcting',
  'pending_review',
  'adjudicating',
  'completed',
  'failed',
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

// Gender
export const GenderSchema = z.enum(['M', 'F', 'U']);
export type Gender = z.infer<typeof GenderSchema>;

// Address
export const AddressSchema = z.object({
  street1: z.string(),
  street2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  country: z.string().default('US'),
});
export type Address = z.infer<typeof AddressSchema>;

// Bounding box for provenance
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// Extraction method
export const ExtractionMethodSchema = z.enum(['ocr', 'llm', 'rule', 'manual']);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

// Provenance - tracks where each field came from
export const ProvenanceSchema = z.object({
  page: z.number(),
  boundingBox: BoundingBoxSchema,
  confidence: z.number().min(0).max(1),
  extractionMethod: ExtractionMethodSchema,
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

// Patient information
export const PatientSchema = z.object({
  memberId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: GenderSchema.optional(),
  address: AddressSchema.optional(),
});
export type Patient = z.infer<typeof PatientSchema>;

// Provider information
export const ProviderSchema = z.object({
  npi: z.string(),
  name: z.string(),
  taxId: z.string().optional(),
  specialty: z.string().optional(),
  address: AddressSchema.optional(),
});
export type Provider = z.infer<typeof ProviderSchema>;

// Diagnosis
export const DiagnosisSchema = z.object({
  code: z.string(),
  description: z.string().optional(),
  isPrimary: z.boolean(),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

// Service line
export const ServiceLineSchema = z.object({
  lineNumber: z.number(),
  dateOfService: z.string(),
  procedureCode: z.string(),
  modifiers: z.array(z.string()),
  diagnosisPointers: z.array(z.string()),
  units: z.number(),
  chargeAmount: z.number(),
  placeOfService: z.string().optional(),
});
export type ServiceLine = z.infer<typeof ServiceLineSchema>;

// Claim totals
export const ClaimTotalsSchema = z.object({
  totalCharges: z.number(),
  amountPaid: z.number().optional(),
  patientResponsibility: z.number().optional(),
});
export type ClaimTotals = z.infer<typeof ClaimTotalsSchema>;

// Extracted claim - the main claim data structure
export const ExtractedClaimSchema = z.object({
  id: z.string(),
  documentType: DocumentTypeSchema,
  patient: PatientSchema,
  provider: ProviderSchema,
  diagnoses: z.array(DiagnosisSchema),
  serviceLines: z.array(ServiceLineSchema),
  totals: ClaimTotalsSchema,
  statementDate: z.string().optional(),
  admissionDate: z.string().optional(),
  dischargeDate: z.string().optional(),
  confidenceScores: z.record(z.string(), z.number()),
  provenance: z.record(z.string(), ProvenanceSchema),
});
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

// Claim submission input
export const ClaimSubmissionSchema = z.object({
  documentType: DocumentTypeSchema.optional(),
  priority: PrioritySchema.default('normal'),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type ClaimSubmission = z.infer<typeof ClaimSubmissionSchema>;

// Claim record - full claim state in storage
export const ClaimRecordSchema = z.object({
  id: z.string(),
  status: ClaimStatusSchema,
  priority: PrioritySchema,
  documentId: z.string(),
  documentType: DocumentTypeSchema.optional(),
  documentHash: z.string(),
  extractedClaim: ExtractedClaimSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  processingHistory: z.array(
    z.object({
      status: ClaimStatusSchema,
      timestamp: z.string(),
      message: z.string().optional(),
    })
  ),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type ClaimRecord = z.infer<typeof ClaimRecordSchema>;

// Factory functions
export function createClaimRecord(
  id: string,
  documentId: string,
  documentHash: string,
  priority: Priority = 'normal',
  metadata?: Record<string, string>
): ClaimRecord {
  const now = new Date().toISOString();
  return {
    id,
    status: 'received',
    priority,
    documentId,
    documentHash,
    createdAt: now,
    updatedAt: now,
    processingHistory: [
      {
        status: 'received',
        timestamp: now,
        message: 'Claim received',
      },
    ],
    metadata,
  };
}

export function updateClaimStatus(
  claim: ClaimRecord,
  status: ClaimStatus,
  message?: string
): ClaimRecord {
  const now = new Date().toISOString();
  return {
    ...claim,
    status,
    updatedAt: now,
    processingHistory: [
      ...claim.processingHistory,
      {
        status,
        timestamp: now,
        message,
      },
    ],
  };
}
