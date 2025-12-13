import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseAgent, AgentResult } from './base.js';
import {
  ClaimRecord,
  ExtractedClaim,
  ValidationResult,
  ValidationError,
  RequiredFieldsByDocType,
  createValidationResult,
  createValidationError,
} from '../models/index.js';
import { getLLMService } from '../services/index.js';
import {
  validateNPI,
  isValidICD10Format,
  isValidCPTFormat,
  isValidHCPCSFormat,
  isValidDateFormat,
  isDateNotFuture,
  isPositiveNumber,
  isValidDiagnosisPointer,
  diagnosisPointerToIndex,
  calculateAge,
  logValidationError,
} from '../utils/index.js';
import { logger } from '../utils/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ValidationInput {
  extractedClaim: ExtractedClaim;
}

export interface ValidationOutput {
  validationResult: ValidationResult;
  lowConfidenceFields: string[];
}

export class ValidationAgent extends BaseAgent<ValidationInput, ValidationOutput> {
  private icd10Codes: Set<string> = new Set();
  private cptCodes: Set<string> = new Set();
  private hcpcsCodes: Set<string> = new Set();
  private posCodes: Set<string> = new Set();
  private initialized = false;

  constructor() {
    super('ValidationAgent');
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const dataPath = path.join(__dirname, '..', 'data');

      // Load code sets
      const icd10Data = JSON.parse(
        await fs.readFile(path.join(dataPath, 'icd10-codes.json'), 'utf-8')
      );
      this.icd10Codes = new Set(Object.keys(icd10Data));

      const cptData = JSON.parse(
        await fs.readFile(path.join(dataPath, 'cpt-codes.json'), 'utf-8')
      );
      this.cptCodes = new Set(Object.keys(cptData));

      const hcpcsData = JSON.parse(
        await fs.readFile(path.join(dataPath, 'hcpcs-codes.json'), 'utf-8')
      );
      this.hcpcsCodes = new Set(Object.keys(hcpcsData));

      const posData = JSON.parse(
        await fs.readFile(path.join(dataPath, 'pos-codes.json'), 'utf-8')
      );
      this.posCodes = new Set(Object.keys(posData));

      this.initialized = true;
      logger.info('Validation agent initialized', {
        icd10Count: this.icd10Codes.size,
        cptCount: this.cptCodes.size,
        hcpcsCount: this.hcpcsCodes.size,
      });
    } catch (error) {
      logger.error('Failed to load code sets', { error });
      throw error;
    }
  }

  async process(input: ValidationInput, claim: ClaimRecord): Promise<AgentResult<ValidationOutput>> {
    await this.initialize();

    const { extractedClaim } = input;
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const lowConfidenceFields: string[] = [];

    // Validate required fields
    this.validateRequiredFields(extractedClaim, errors);

    // Validate NPI
    this.validateProviderNPI(extractedClaim, errors);

    // Validate diagnosis codes
    this.validateDiagnosisCodes(extractedClaim, errors);

    // Validate procedure codes
    this.validateProcedureCodes(extractedClaim, errors);

    // Validate dates
    this.validateDates(extractedClaim, errors);

    // Validate amounts
    this.validateAmounts(extractedClaim, errors, warnings);

    // Validate diagnosis pointers
    this.validateDiagnosisPointers(extractedClaim, errors);

    // Validate place of service codes
    this.validatePOSCodes(extractedClaim, warnings);

    // Semantic validation using LLM
    await this.validateSemantics(extractedClaim, warnings);

    // Check for low confidence fields
    for (const [field, confidence] of Object.entries(extractedClaim.confidenceScores)) {
      if (confidence < this.config.correctionThreshold) {
        lowConfidenceFields.push(field);
      }
    }

    // Log all errors
    for (const error of errors) {
      logValidationError(claim.id, error.field, error.errorType, error.message);
    }

    const isValid = errors.length === 0;
    const overallConfidence = this.calculateValidationConfidence(
      extractedClaim.confidenceScores,
      errors.length,
      warnings.length
    );

    const validationResult = createValidationResult(isValid, errors, warnings, overallConfidence);

    logger.info('Validation completed', {
      claimId: claim.id,
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      lowConfidenceFieldCount: lowConfidenceFields.length,
    });

    // Determine next status
    let nextStatus: 'correcting' | 'adjudicating' | 'pending_review';
    let requiresHumanReview = false;
    let reviewReason: string | undefined;

    if (!isValid || lowConfidenceFields.length > 0) {
      const correctableErrors = errors.filter((e) => e.isCorrectable);
      if (correctableErrors.length > 0 || lowConfidenceFields.length > 0) {
        nextStatus = 'correcting';
      } else {
        nextStatus = 'pending_review';
        requiresHumanReview = true;
        reviewReason = `Validation failed with ${errors.length} non-correctable errors`;
      }
    } else {
      nextStatus = 'adjudicating';
    }

    return {
      success: true,
      data: { validationResult, lowConfidenceFields },
      nextStatus,
      confidence: overallConfidence,
      requiresHumanReview,
      reviewReason,
    };
  }

  private validateRequiredFields(claim: ExtractedClaim, errors: ValidationError[]): void {
    const required = RequiredFieldsByDocType[claim.documentType] ?? RequiredFieldsByDocType.unknown;

    for (const fieldPath of required) {
      const value = this.getNestedValue(claim, fieldPath);

      if (value === undefined || value === null || value === '') {
        errors.push(
          createValidationError(fieldPath, 'business_rule', `Required field missing: ${fieldPath}`, {
            isCorrectable: false,
          })
        );
      } else if (Array.isArray(value) && value.length === 0) {
        errors.push(
          createValidationError(fieldPath, 'business_rule', `Required array is empty: ${fieldPath}`, {
            isCorrectable: false,
          })
        );
      }
    }
  }

  private validateProviderNPI(claim: ExtractedClaim, errors: ValidationError[]): void {
    if (!claim.provider.npi) return;

    const result = validateNPI(claim.provider.npi);
    if (!result.isValid) {
      errors.push(
        createValidationError('provider.npi', 'syntax', result.error ?? 'Invalid NPI', {
          currentValue: claim.provider.npi,
          isCorrectable: true,
        })
      );
    }
  }

  private validateDiagnosisCodes(claim: ExtractedClaim, errors: ValidationError[]): void {
    for (let i = 0; i < claim.diagnoses.length; i++) {
      const diagnosis = claim.diagnoses[i];
      const code = diagnosis.code.toUpperCase();

      // Check format
      if (!isValidICD10Format(code)) {
        errors.push(
          createValidationError(
            `diagnoses[${i}].code`,
            'syntax',
            `Invalid ICD-10 code format: ${code}`,
            {
              currentValue: code,
              isCorrectable: true,
            }
          )
        );
        continue;
      }

      // Check if code exists in our reference set
      if (!this.icd10Codes.has(code)) {
        errors.push(
          createValidationError(
            `diagnoses[${i}].code`,
            'domain',
            `ICD-10 code not found in reference: ${code}`,
            {
              currentValue: code,
              isCorrectable: true,
            }
          )
        );
      }
    }
  }

  private validateProcedureCodes(claim: ExtractedClaim, errors: ValidationError[]): void {
    for (let i = 0; i < claim.serviceLines.length; i++) {
      const line = claim.serviceLines[i];
      const code = line.procedureCode.toUpperCase();

      // Check format (CPT or HCPCS)
      const isCPT = isValidCPTFormat(code);
      const isHCPCS = isValidHCPCSFormat(code);

      if (!isCPT && !isHCPCS) {
        errors.push(
          createValidationError(
            `serviceLines[${i}].procedureCode`,
            'syntax',
            `Invalid procedure code format: ${code}`,
            {
              currentValue: code,
              isCorrectable: true,
            }
          )
        );
        continue;
      }

      // Check if code exists
      if (isCPT && !this.cptCodes.has(code)) {
        errors.push(
          createValidationError(
            `serviceLines[${i}].procedureCode`,
            'domain',
            `CPT code not found in reference: ${code}`,
            {
              currentValue: code,
              isCorrectable: true,
            }
          )
        );
      } else if (isHCPCS && !this.hcpcsCodes.has(code)) {
        errors.push(
          createValidationError(
            `serviceLines[${i}].procedureCode`,
            'domain',
            `HCPCS code not found in reference: ${code}`,
            {
              currentValue: code,
              isCorrectable: true,
            }
          )
        );
      }
    }
  }

  private validateDates(claim: ExtractedClaim, errors: ValidationError[]): void {
    // Patient DOB
    if (claim.patient.dateOfBirth) {
      if (!isValidDateFormat(claim.patient.dateOfBirth)) {
        errors.push(
          createValidationError(
            'patient.dateOfBirth',
            'syntax',
            `Invalid date format: ${claim.patient.dateOfBirth}`,
            {
              currentValue: claim.patient.dateOfBirth,
              isCorrectable: true,
            }
          )
        );
      } else if (!isDateNotFuture(claim.patient.dateOfBirth)) {
        errors.push(
          createValidationError(
            'patient.dateOfBirth',
            'business_rule',
            'Date of birth cannot be in the future',
            {
              currentValue: claim.patient.dateOfBirth,
              isCorrectable: false,
            }
          )
        );
      }
    }

    // Service line dates
    for (let i = 0; i < claim.serviceLines.length; i++) {
      const line = claim.serviceLines[i];

      if (!isValidDateFormat(line.dateOfService)) {
        errors.push(
          createValidationError(
            `serviceLines[${i}].dateOfService`,
            'syntax',
            `Invalid date format: ${line.dateOfService}`,
            {
              currentValue: line.dateOfService,
              isCorrectable: true,
            }
          )
        );
      } else if (!isDateNotFuture(line.dateOfService)) {
        errors.push(
          createValidationError(
            `serviceLines[${i}].dateOfService`,
            'business_rule',
            'Date of service cannot be in the future',
            {
              currentValue: line.dateOfService,
              isCorrectable: false,
            }
          )
        );
      }
    }
  }

  private validateAmounts(
    claim: ExtractedClaim,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Validate total charges is positive
    if (!isPositiveNumber(claim.totals.totalCharges)) {
      errors.push(
        createValidationError(
          'totals.totalCharges',
          'business_rule',
          'Total charges must be a positive number',
          {
            currentValue: String(claim.totals.totalCharges),
            isCorrectable: false,
          }
        )
      );
    }

    // Validate service line charges
    let calculatedTotal = 0;
    for (let i = 0; i < claim.serviceLines.length; i++) {
      const line = claim.serviceLines[i];

      if (!isPositiveNumber(line.chargeAmount)) {
        errors.push(
          createValidationError(
            `serviceLines[${i}].chargeAmount`,
            'business_rule',
            'Charge amount must be a positive number',
            {
              currentValue: String(line.chargeAmount),
              isCorrectable: false,
            }
          )
        );
      } else {
        calculatedTotal += line.chargeAmount * line.units;
      }
    }

    // Check if line totals match claim total
    const tolerance = 0.01; // Allow for rounding
    if (Math.abs(calculatedTotal - claim.totals.totalCharges) > tolerance) {
      warnings.push(
        createValidationError(
          'totals.totalCharges',
          'business_rule',
          `Sum of service line charges (${calculatedTotal.toFixed(2)}) does not match total charges (${claim.totals.totalCharges.toFixed(2)})`,
          {
            currentValue: String(claim.totals.totalCharges),
            suggestedValue: String(calculatedTotal),
            isCorrectable: true,
          }
        )
      );
    }
  }

  private validateDiagnosisPointers(claim: ExtractedClaim, errors: ValidationError[]): void {
    const diagnosisCount = claim.diagnoses.length;

    for (let i = 0; i < claim.serviceLines.length; i++) {
      const line = claim.serviceLines[i];

      for (const pointer of line.diagnosisPointers) {
        if (!isValidDiagnosisPointer(pointer)) {
          errors.push(
            createValidationError(
              `serviceLines[${i}].diagnosisPointers`,
              'syntax',
              `Invalid diagnosis pointer: ${pointer}`,
              {
                currentValue: pointer,
                isCorrectable: true,
              }
            )
          );
          continue;
        }

        const index = diagnosisPointerToIndex(pointer);
        if (index >= diagnosisCount) {
          errors.push(
            createValidationError(
              `serviceLines[${i}].diagnosisPointers`,
              'business_rule',
              `Diagnosis pointer ${pointer} references non-existent diagnosis (only ${diagnosisCount} diagnoses)`,
              {
                currentValue: pointer,
                isCorrectable: false,
              }
            )
          );
        }
      }
    }
  }

  private validatePOSCodes(claim: ExtractedClaim, warnings: ValidationError[]): void {
    for (let i = 0; i < claim.serviceLines.length; i++) {
      const line = claim.serviceLines[i];

      if (line.placeOfService && !this.posCodes.has(line.placeOfService)) {
        warnings.push(
          createValidationError(
            `serviceLines[${i}].placeOfService`,
            'domain',
            `Unknown place of service code: ${line.placeOfService}`,
            {
              currentValue: line.placeOfService,
              isCorrectable: true,
            }
          )
        );
      }
    }
  }

  private async validateSemantics(
    claim: ExtractedClaim,
    warnings: ValidationError[]
  ): Promise<void> {
    try {
      const llm = getLLMService();
      const result = await llm.validateSemantics(claim);

      for (const issue of result.issues) {
        warnings.push(
          createValidationError(issue.field, 'semantic', issue.issue, {
            isCorrectable: false,
          })
        );
      }
    } catch (error) {
      logger.warn('Semantic validation failed', { error });
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private calculateValidationConfidence(
    confidenceScores: Record<string, number>,
    errorCount: number,
    warningCount: number
  ): number {
    const scores = Object.values(confidenceScores);
    if (scores.length === 0) return 0;

    const avgConfidence = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Reduce confidence based on errors and warnings
    const errorPenalty = Math.min(errorCount * 0.1, 0.5);
    const warningPenalty = Math.min(warningCount * 0.02, 0.1);

    return Math.max(0, avgConfidence - errorPenalty - warningPenalty);
  }
}
