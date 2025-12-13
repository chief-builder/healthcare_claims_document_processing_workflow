import { z } from 'zod';

// Adjudication status
export const AdjudicationStatusSchema = z.enum(['approved', 'denied', 'partial', 'pending_review']);
export type AdjudicationStatus = z.infer<typeof AdjudicationStatusSchema>;

// Line decision status
export const LineDecisionStatusSchema = z.enum(['approved', 'denied']);
export type LineDecisionStatus = z.infer<typeof LineDecisionStatusSchema>;

// Denial reason
export const DenialReasonSchema = z.object({
  code: z.string(),
  description: z.string(),
  appealInstructions: z.string().optional(),
});
export type DenialReason = z.infer<typeof DenialReasonSchema>;

// Line decision
export const LineDecisionSchema = z.object({
  lineNumber: z.number(),
  status: LineDecisionStatusSchema,
  billedAmount: z.number(),
  allowedAmount: z.number(),
  paidAmount: z.number(),
  patientResponsibility: z.number(),
  denialReasons: z.array(DenialReasonSchema).optional(),
  adjustmentReasons: z.array(z.string()).optional(),
});
export type LineDecision = z.infer<typeof LineDecisionSchema>;

// Adjudication totals
export const AdjudicationTotalsSchema = z.object({
  totalBilled: z.number(),
  totalAllowed: z.number(),
  totalPaid: z.number(),
  totalPatientResponsibility: z.number(),
});
export type AdjudicationTotals = z.infer<typeof AdjudicationTotalsSchema>;

// Adjudication decision
export const AdjudicationDecisionSchema = z.object({
  claimId: z.string(),
  status: AdjudicationStatusSchema,
  lineDecisions: z.array(LineDecisionSchema),
  totals: AdjudicationTotalsSchema,
  explanation: z.string(),
  policyCitations: z.array(z.string()),
  decidedAt: z.string(),
  decidedBy: z.string(),
});
export type AdjudicationDecision = z.infer<typeof AdjudicationDecisionSchema>;

// Eligibility check result
export const EligibilityCheckSchema = z.object({
  memberId: z.string(),
  isEligible: z.boolean(),
  effectiveDate: z.string(),
  terminationDate: z.string().optional(),
  planId: z.string(),
  planName: z.string(),
  reason: z.string().optional(),
});
export type EligibilityCheck = z.infer<typeof EligibilityCheckSchema>;

// Coverage check result
export const CoverageCheckSchema = z.object({
  procedureCode: z.string(),
  isCovered: z.boolean(),
  requiresPriorAuth: z.boolean(),
  hasPriorAuth: z.boolean().optional(),
  frequencyLimit: z.number().optional(),
  frequencyUsed: z.number().optional(),
  reason: z.string().optional(),
});
export type CoverageCheck = z.infer<typeof CoverageCheckSchema>;

// Fee schedule entry
export const FeeScheduleEntrySchema = z.object({
  procedureCode: z.string(),
  modifier: z.string().optional(),
  allowedAmount: z.number(),
  effectiveDate: z.string(),
  expirationDate: z.string().optional(),
  placeOfService: z.string().optional(),
});
export type FeeScheduleEntry = z.infer<typeof FeeScheduleEntrySchema>;

// Member benefits
export const MemberBenefitsSchema = z.object({
  memberId: z.string(),
  planId: z.string(),
  deductible: z.number(),
  deductibleMet: z.number(),
  outOfPocketMax: z.number(),
  outOfPocketMet: z.number(),
  copay: z.record(z.string(), z.number()),
  coinsurance: z.number(),
});
export type MemberBenefits = z.infer<typeof MemberBenefitsSchema>;

// Common denial codes
export const DenialCodes = {
  INELIGIBLE: {
    code: 'D001',
    description: 'Member not eligible on date of service',
  },
  NOT_COVERED: {
    code: 'D002',
    description: 'Service not covered under member plan',
  },
  NO_PRIOR_AUTH: {
    code: 'D003',
    description: 'Prior authorization required but not obtained',
  },
  FREQUENCY_EXCEEDED: {
    code: 'D004',
    description: 'Service exceeds frequency limitation',
  },
  INVALID_DIAGNOSIS: {
    code: 'D005',
    description: 'Diagnosis code not valid for procedure',
  },
  DUPLICATE_CLAIM: {
    code: 'D006',
    description: 'Duplicate claim previously processed',
  },
  TIMELY_FILING: {
    code: 'D007',
    description: 'Claim not filed within timely filing period',
  },
  PROVIDER_NOT_PARTICIPATING: {
    code: 'D008',
    description: 'Provider not participating in network',
  },
} as const;

// Factory functions
export function createLineDecision(
  lineNumber: number,
  billedAmount: number,
  options: {
    status?: LineDecisionStatus;
    allowedAmount?: number;
    paidAmount?: number;
    patientResponsibility?: number;
    denialReasons?: DenialReason[];
  } = {}
): LineDecision {
  const status = options.status ?? 'approved';
  const allowedAmount = options.allowedAmount ?? billedAmount;
  const paidAmount = status === 'denied' ? 0 : (options.paidAmount ?? allowedAmount);
  const patientResponsibility = options.patientResponsibility ?? billedAmount - paidAmount;

  return {
    lineNumber,
    status,
    billedAmount,
    allowedAmount: status === 'denied' ? 0 : allowedAmount,
    paidAmount,
    patientResponsibility,
    denialReasons: options.denialReasons,
  };
}

export function createAdjudicationDecision(
  claimId: string,
  lineDecisions: LineDecision[],
  options: {
    explanation?: string;
    policyCitations?: string[];
    decidedBy?: string;
  } = {}
): AdjudicationDecision {
  const approvedCount = lineDecisions.filter((ld) => ld.status === 'approved').length;
  const deniedCount = lineDecisions.filter((ld) => ld.status === 'denied').length;

  let status: AdjudicationStatus;
  if (approvedCount === lineDecisions.length) {
    status = 'approved';
  } else if (deniedCount === lineDecisions.length) {
    status = 'denied';
  } else {
    status = 'partial';
  }

  const totals: AdjudicationTotals = {
    totalBilled: lineDecisions.reduce((sum, ld) => sum + ld.billedAmount, 0),
    totalAllowed: lineDecisions.reduce((sum, ld) => sum + ld.allowedAmount, 0),
    totalPaid: lineDecisions.reduce((sum, ld) => sum + ld.paidAmount, 0),
    totalPatientResponsibility: lineDecisions.reduce((sum, ld) => sum + ld.patientResponsibility, 0),
  };

  return {
    claimId,
    status,
    lineDecisions,
    totals,
    explanation: options.explanation ?? generateExplanation(status, lineDecisions),
    policyCitations: options.policyCitations ?? [],
    decidedAt: new Date().toISOString(),
    decidedBy: options.decidedBy ?? 'system',
  };
}

function generateExplanation(status: AdjudicationStatus, lineDecisions: LineDecision[]): string {
  switch (status) {
    case 'approved':
      return 'All service lines have been approved for payment based on member eligibility and plan coverage.';
    case 'denied':
      const denialReason = lineDecisions[0]?.denialReasons?.[0]?.description ?? 'See denial codes';
      return `Claim denied: ${denialReason}`;
    case 'partial':
      const approvedLines = lineDecisions.filter((ld) => ld.status === 'approved').length;
      const deniedLines = lineDecisions.filter((ld) => ld.status === 'denied').length;
      return `Partial approval: ${approvedLines} line(s) approved, ${deniedLines} line(s) denied.`;
    default:
      return 'Claim requires additional review.';
  }
}

export function createDenialReason(
  code: string,
  description: string,
  appealInstructions?: string
): DenialReason {
  return {
    code,
    description,
    appealInstructions,
  };
}
