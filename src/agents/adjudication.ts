import { BaseAgent, AgentResult } from './base.js';
import {
  ClaimRecord,
  ExtractedClaim,
  AdjudicationDecision,
  LineDecision,
  DenialReason,
  EligibilityCheck,
  CoverageCheck,
  MemberBenefits,
  DenialCodes,
  createLineDecision,
  createAdjudicationDecision,
  createDenialReason,
} from '../models/index.js';
import { logger } from '../utils/index.js';

export interface AdjudicationInput {
  extractedClaim: ExtractedClaim;
}

export interface AdjudicationOutput {
  decision: AdjudicationDecision;
}

// Mock data - in production, these would come from external systems
const MOCK_ELIGIBILITY: Record<string, EligibilityCheck> = {
  DEFAULT: {
    memberId: 'DEFAULT',
    isEligible: true,
    effectiveDate: '2020-01-01',
    terminationDate: '2099-12-31',
    planId: 'PLAN001',
    planName: 'Standard PPO',
  },
};

const MOCK_BENEFITS: Record<string, MemberBenefits> = {
  DEFAULT: {
    memberId: 'DEFAULT',
    planId: 'PLAN001',
    deductible: 500,
    deductibleMet: 250,
    outOfPocketMax: 5000,
    outOfPocketMet: 1000,
    copay: {
      office: 25,
      specialist: 50,
      emergency: 150,
    },
    coinsurance: 0.2, // 20% coinsurance
  },
};

const MOCK_FEE_SCHEDULE: Record<string, number> = {
  '99213': 125.0,
  '99214': 175.0,
  '99215': 225.0,
  '99203': 150.0,
  '99204': 200.0,
  '99205': 275.0,
  '36415': 10.0,
  '71046': 75.0,
  '80053': 35.0,
  '85025': 15.0,
  '93000': 50.0,
  DEFAULT: 100.0,
};

const COVERED_PROCEDURES = new Set([
  '99201', '99202', '99203', '99204', '99205',
  '99211', '99212', '99213', '99214', '99215',
  '36415', '71046', '80053', '85025', '93000',
  '90471', '90472', '97110', '97140',
]);

export class AdjudicationAgent extends BaseAgent<AdjudicationInput, AdjudicationOutput> {
  constructor() {
    super('AdjudicationAgent');
  }

  async process(input: AdjudicationInput, claim: ClaimRecord): Promise<AgentResult<AdjudicationOutput>> {
    const { extractedClaim } = input;

    // Check member eligibility
    const eligibility = await this.checkEligibility(
      extractedClaim.patient.memberId,
      extractedClaim.serviceLines[0]?.dateOfService
    );

    if (!eligibility.isEligible) {
      // Deny entire claim due to ineligibility
      const lineDecisions = extractedClaim.serviceLines.map((line) =>
        createLineDecision(line.lineNumber, line.chargeAmount, {
          status: 'denied',
          denialReasons: [createDenialReason(DenialCodes.INELIGIBLE.code, DenialCodes.INELIGIBLE.description)],
        })
      );

      const decision = createAdjudicationDecision(claim.id, lineDecisions, {
        explanation: `Claim denied: ${eligibility.reason ?? 'Member not eligible on date of service'}`,
        policyCitations: ['Member Eligibility Policy Section 3.1'],
        decidedBy: 'system',
      });

      return {
        success: true,
        data: { decision },
        nextStatus: 'completed',
        confidence: 1.0,
      };
    }

    // Get member benefits
    const benefits = await this.getMemberBenefits(extractedClaim.patient.memberId);

    // Process each service line
    const lineDecisions: LineDecision[] = [];
    const policyCitations: string[] = [];

    for (const line of extractedClaim.serviceLines) {
      const lineDecision = await this.adjudicateLine(line, benefits, extractedClaim);
      lineDecisions.push(lineDecision);

      if (lineDecision.denialReasons) {
        for (const reason of lineDecision.denialReasons) {
          if (!policyCitations.includes(`Denial Code ${reason.code}`)) {
            policyCitations.push(`Denial Code ${reason.code}`);
          }
        }
      }
    }

    const decision = createAdjudicationDecision(claim.id, lineDecisions, {
      policyCitations,
      decidedBy: 'system',
    });

    logger.info('Adjudication completed', {
      claimId: claim.id,
      status: decision.status,
      totalPaid: decision.totals.totalPaid,
      approvedLines: lineDecisions.filter((ld) => ld.status === 'approved').length,
      deniedLines: lineDecisions.filter((ld) => ld.status === 'denied').length,
    });

    return {
      success: true,
      data: { decision },
      nextStatus: 'completed',
      confidence: 1.0,
    };
  }

  private async checkEligibility(
    memberId: string,
    dateOfService?: string
  ): Promise<EligibilityCheck> {
    // In production, this would call an eligibility API
    const eligibility = MOCK_ELIGIBILITY[memberId] ?? {
      ...MOCK_ELIGIBILITY.DEFAULT,
      memberId,
    };

    // Check if DOS is within coverage period
    if (dateOfService) {
      const dos = new Date(dateOfService);
      const effectiveDate = new Date(eligibility.effectiveDate);
      const termDate = eligibility.terminationDate
        ? new Date(eligibility.terminationDate)
        : new Date('2099-12-31');

      if (dos < effectiveDate || dos > termDate) {
        return {
          ...eligibility,
          isEligible: false,
          reason: 'Date of service outside coverage period',
        };
      }
    }

    return eligibility;
  }

  private async getMemberBenefits(memberId: string): Promise<MemberBenefits> {
    // In production, this would call a benefits API
    return MOCK_BENEFITS[memberId] ?? {
      ...MOCK_BENEFITS.DEFAULT,
      memberId,
    };
  }

  private async adjudicateLine(
    line: ExtractedClaim['serviceLines'][0],
    benefits: MemberBenefits,
    claim: ExtractedClaim
  ): Promise<LineDecision> {
    const denialReasons: DenialReason[] = [];

    // Check coverage
    const coverage = await this.checkCoverage(line.procedureCode, claim);
    if (!coverage.isCovered) {
      denialReasons.push(
        createDenialReason(DenialCodes.NOT_COVERED.code, DenialCodes.NOT_COVERED.description)
      );
    }

    // Check prior auth if required
    if (coverage.requiresPriorAuth && !coverage.hasPriorAuth) {
      denialReasons.push(
        createDenialReason(DenialCodes.NO_PRIOR_AUTH.code, DenialCodes.NO_PRIOR_AUTH.description)
      );
    }

    // If any denial reasons, deny the line
    if (denialReasons.length > 0) {
      return createLineDecision(line.lineNumber, line.chargeAmount, {
        status: 'denied',
        denialReasons,
      });
    }

    // Calculate allowed amount from fee schedule
    const allowedAmount = this.getAllowedAmount(line.procedureCode, line.units);

    // Calculate patient responsibility
    const { paidAmount, patientResponsibility } = this.calculatePayment(
      allowedAmount,
      line.chargeAmount,
      benefits
    );

    return createLineDecision(line.lineNumber, line.chargeAmount, {
      status: 'approved',
      allowedAmount,
      paidAmount,
      patientResponsibility,
    });
  }

  private async checkCoverage(
    procedureCode: string,
    _claim: ExtractedClaim
  ): Promise<CoverageCheck> {
    // In production, this would check against plan benefits
    const isCovered = COVERED_PROCEDURES.has(procedureCode);

    // Some procedures require prior auth (mock)
    const requiresPriorAuth = ['97110', '97140'].includes(procedureCode);

    return {
      procedureCode,
      isCovered,
      requiresPriorAuth,
      hasPriorAuth: false, // In production, check auth system
    };
  }

  private getAllowedAmount(procedureCode: string, units: number): number {
    const unitAllowed = MOCK_FEE_SCHEDULE[procedureCode] ?? MOCK_FEE_SCHEDULE.DEFAULT;
    return unitAllowed * units;
  }

  private calculatePayment(
    allowedAmount: number,
    _billedAmount: number,
    benefits: MemberBenefits
  ): { paidAmount: number; patientResponsibility: number } {
    // Start with allowed amount
    let amountAfterDeductible = allowedAmount;

    // Apply remaining deductible
    const remainingDeductible = benefits.deductible - benefits.deductibleMet;
    if (remainingDeductible > 0) {
      const deductibleApplied = Math.min(remainingDeductible, allowedAmount);
      amountAfterDeductible -= deductibleApplied;
    }

    // Apply coinsurance (calculate member's portion)
    const memberPays = amountAfterDeductible * benefits.coinsurance;

    // Check out-of-pocket max
    const remainingOOP = benefits.outOfPocketMax - benefits.outOfPocketMet;
    const actualMemberPays = Math.min(memberPays + (allowedAmount - amountAfterDeductible), remainingOOP);

    return {
      paidAmount: Math.round((allowedAmount - actualMemberPays) * 100) / 100,
      patientResponsibility: Math.round(actualMemberPays * 100) / 100,
    };
  }
}
