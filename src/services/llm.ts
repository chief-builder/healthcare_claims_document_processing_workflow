import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config/index.js';
import {
  DocumentType,
  ExtractedClaim,
  Patient,
  Provider,
  Diagnosis,
  ServiceLine,
  ClaimTotals,
} from '../models/index.js';
import { logger } from '../utils/index.js';

export interface FieldInference {
  value: string;
  confidence: number;
  reasoning: string;
}

export interface CorrectionResult {
  success: boolean;
  correctedValue: string | null;
  confidence: number;
  reasoning: string;
}

export interface ExtractionContext {
  ocrText: string;
  documentType: DocumentType;
  pageCount: number;
}

export class LLMService {
  private client: Anthropic;
  private model: string;

  constructor() {
    const config = getConfig();
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
  }

  async classifyDocument(ocrText: string): Promise<{ type: DocumentType; confidence: number }> {
    const prompt = `Analyze the following OCR text from a healthcare document and classify it as one of these types:
- cms_1500: CMS-1500 Health Insurance Claim Form (professional claims)
- ub_04: UB-04 Uniform Billing Form (institutional claims)
- eob: Explanation of Benefits document
- unknown: Unable to determine document type

Look for identifying features:
- CMS-1500: Fields like "PLACE OF SERVICE", "DIAGNOSIS OR NATURE OF ILLNESS", professional services
- UB-04: Fields like "PATIENT CONTROL NO", "TYPE OF BILL", revenue codes
- EOB: Payment amounts, "EXPLANATION OF BENEFITS", claim payment details

OCR Text:
${ocrText.substring(0, 4000)}

Respond in JSON format:
{
  "documentType": "cms_1500" | "ub_04" | "eob" | "unknown",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));
      return {
        type: parsed.documentType as DocumentType,
        confidence: parsed.confidence,
      };
    } catch (error) {
      logger.error('Document classification failed', { error });
      return { type: 'unknown', confidence: 0 };
    }
  }

  async extractClaim(context: ExtractionContext): Promise<{
    claim: Partial<ExtractedClaim>;
    confidenceScores: Record<string, number>;
  }> {
    const prompt = this.buildExtractionPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));
      return this.parseExtractionResponse(parsed);
    } catch (error) {
      logger.error('Claim extraction failed', { error });
      throw error;
    }
  }

  private buildExtractionPrompt(context: ExtractionContext): string {
    const basePrompt = `Extract structured data from this ${context.documentType} healthcare claim document.

For each field, provide the extracted value and a confidence score (0.0-1.0) based on:
- Text clarity and OCR quality
- Whether the field was explicitly present vs inferred
- Consistency with other extracted data

If a field is not present or cannot be determined, use null.

OCR Text:
${context.ocrText}

Extract the following and respond in JSON format:
{
  "patient": {
    "memberId": { "value": string | null, "confidence": number },
    "firstName": { "value": string | null, "confidence": number },
    "lastName": { "value": string | null, "confidence": number },
    "dateOfBirth": { "value": "YYYY-MM-DD" | null, "confidence": number },
    "gender": { "value": "M" | "F" | "U" | null, "confidence": number },
    "address": {
      "value": { "street1": string, "city": string, "state": string, "zipCode": string } | null,
      "confidence": number
    }
  },
  "provider": {
    "npi": { "value": string | null, "confidence": number },
    "name": { "value": string | null, "confidence": number },
    "taxId": { "value": string | null, "confidence": number },
    "specialty": { "value": string | null, "confidence": number }
  },
  "diagnoses": [
    {
      "code": { "value": string, "confidence": number },
      "description": { "value": string | null, "confidence": number },
      "isPrimary": { "value": boolean, "confidence": number }
    }
  ],
  "serviceLines": [
    {
      "lineNumber": { "value": number, "confidence": number },
      "dateOfService": { "value": "YYYY-MM-DD", "confidence": number },
      "procedureCode": { "value": string, "confidence": number },
      "modifiers": { "value": string[], "confidence": number },
      "diagnosisPointers": { "value": string[], "confidence": number },
      "units": { "value": number, "confidence": number },
      "chargeAmount": { "value": number, "confidence": number },
      "placeOfService": { "value": string | null, "confidence": number }
    }
  ],
  "totals": {
    "totalCharges": { "value": number, "confidence": number },
    "amountPaid": { "value": number | null, "confidence": number },
    "patientResponsibility": { "value": number | null, "confidence": number }
  },
  "statementDate": { "value": "YYYY-MM-DD" | null, "confidence": number },
  "admissionDate": { "value": "YYYY-MM-DD" | null, "confidence": number },
  "dischargeDate": { "value": "YYYY-MM-DD" | null, "confidence": number }
}`;

    return basePrompt;
  }

  private parseExtractionResponse(parsed: Record<string, unknown>): {
    claim: Partial<ExtractedClaim>;
    confidenceScores: Record<string, number>;
  } {
    const confidenceScores: Record<string, number> = {};

    const extractValue = <T>(
      obj: { value: T; confidence: number } | null | undefined,
      path: string
    ): T | undefined => {
      if (!obj || obj.value === null) return undefined;
      confidenceScores[path] = obj.confidence;
      return obj.value;
    };

    const patientData = parsed.patient as Record<string, { value: unknown; confidence: number }>;
    const providerData = parsed.provider as Record<string, { value: unknown; confidence: number }>;
    const totalsData = parsed.totals as Record<string, { value: unknown; confidence: number }>;

    const patient: Patient = {
      memberId: extractValue(patientData?.memberId as { value: string; confidence: number }, 'patient.memberId') ?? '',
      firstName: extractValue(patientData?.firstName as { value: string; confidence: number }, 'patient.firstName') ?? '',
      lastName: extractValue(patientData?.lastName as { value: string; confidence: number }, 'patient.lastName') ?? '',
      dateOfBirth: extractValue(patientData?.dateOfBirth as { value: string; confidence: number }, 'patient.dateOfBirth') ?? '',
      gender: extractValue(patientData?.gender as { value: 'M' | 'F' | 'U'; confidence: number }, 'patient.gender'),
      address: extractValue(patientData?.address as { value: { street1: string; city: string; state: string; zipCode: string }; confidence: number }, 'patient.address')
        ? { ...extractValue(patientData?.address as { value: { street1: string; city: string; state: string; zipCode: string }; confidence: number }, 'patient.address')!, country: 'US' }
        : undefined,
    };

    const provider: Provider = {
      npi: extractValue(providerData?.npi as { value: string; confidence: number }, 'provider.npi') ?? '',
      name: extractValue(providerData?.name as { value: string; confidence: number }, 'provider.name') ?? '',
      taxId: extractValue(providerData?.taxId as { value: string; confidence: number }, 'provider.taxId'),
      specialty: extractValue(providerData?.specialty as { value: string; confidence: number }, 'provider.specialty'),
    };

    const diagnosesData = parsed.diagnoses as Array<Record<string, { value: unknown; confidence: number }>>;
    const diagnoses: Diagnosis[] = (diagnosesData ?? []).map((d, i) => ({
      code: extractValue(d.code as { value: string; confidence: number }, `diagnoses.${i}.code`) ?? '',
      description: extractValue(d.description as { value: string; confidence: number }, `diagnoses.${i}.description`),
      isPrimary: extractValue(d.isPrimary as { value: boolean; confidence: number }, `diagnoses.${i}.isPrimary`) ?? (i === 0),
    }));

    const serviceLinesData = parsed.serviceLines as Array<Record<string, { value: unknown; confidence: number }>>;
    const serviceLines: ServiceLine[] = (serviceLinesData ?? []).map((sl, i) => ({
      lineNumber: extractValue(sl.lineNumber as { value: number; confidence: number }, `serviceLines.${i}.lineNumber`) ?? (i + 1),
      dateOfService: extractValue(sl.dateOfService as { value: string; confidence: number }, `serviceLines.${i}.dateOfService`) ?? '',
      procedureCode: extractValue(sl.procedureCode as { value: string; confidence: number }, `serviceLines.${i}.procedureCode`) ?? '',
      modifiers: extractValue(sl.modifiers as { value: string[]; confidence: number }, `serviceLines.${i}.modifiers`) ?? [],
      diagnosisPointers: extractValue(sl.diagnosisPointers as { value: string[]; confidence: number }, `serviceLines.${i}.diagnosisPointers`) ?? [],
      units: extractValue(sl.units as { value: number; confidence: number }, `serviceLines.${i}.units`) ?? 1,
      chargeAmount: extractValue(sl.chargeAmount as { value: number; confidence: number }, `serviceLines.${i}.chargeAmount`) ?? 0,
      placeOfService: extractValue(sl.placeOfService as { value: string; confidence: number }, `serviceLines.${i}.placeOfService`),
    }));

    const totals: ClaimTotals = {
      totalCharges: extractValue(totalsData?.totalCharges as { value: number; confidence: number }, 'totals.totalCharges') ?? 0,
      amountPaid: extractValue(totalsData?.amountPaid as { value: number; confidence: number }, 'totals.amountPaid'),
      patientResponsibility: extractValue(totalsData?.patientResponsibility as { value: number; confidence: number }, 'totals.patientResponsibility'),
    };

    const claim: Partial<ExtractedClaim> = {
      patient,
      provider,
      diagnoses,
      serviceLines,
      totals,
      statementDate: extractValue(parsed.statementDate as { value: string; confidence: number }, 'statementDate'),
      admissionDate: extractValue(parsed.admissionDate as { value: string; confidence: number }, 'admissionDate'),
      dischargeDate: extractValue(parsed.dischargeDate as { value: string; confidence: number }, 'dischargeDate'),
    };

    return { claim, confidenceScores };
  }

  async inferField(
    fieldName: string,
    currentValue: string | undefined,
    context: string
  ): Promise<FieldInference> {
    const prompt = `You are helping to correct an extracted value from a healthcare claim document.

Field: ${fieldName}
Current extracted value: ${currentValue ?? 'null'}

Context from the document:
${context}

Based on the context, what should the correct value for "${fieldName}" be?
Consider:
- Healthcare coding standards (ICD-10, CPT, HCPCS formats)
- Common OCR errors (0/O, 1/I, etc.)
- Typical field formats

Respond in JSON format:
{
  "value": "the corrected value or null if cannot determine",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of correction"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return JSON.parse(this.extractJSON(content.text));
    } catch (error) {
      logger.error('Field inference failed', { error, fieldName });
      return {
        value: currentValue ?? '',
        confidence: 0,
        reasoning: 'Inference failed',
      };
    }
  }

  async correctField(
    fieldName: string,
    currentValue: string,
    validationError: string,
    context: string
  ): Promise<CorrectionResult> {
    const prompt = `You are correcting an invalid value from a healthcare claim document.

Field: ${fieldName}
Current value: ${currentValue}
Validation error: ${validationError}

Context from the document:
${context}

Determine the correct value. Consider:
- The validation error message
- Common OCR misreadings
- Healthcare code formats
- Surrounding context

Respond in JSON format:
{
  "success": boolean,
  "correctedValue": "the corrected value or null if cannot correct",
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return JSON.parse(this.extractJSON(content.text));
    } catch (error) {
      logger.error('Field correction failed', { error, fieldName });
      return {
        success: false,
        correctedValue: null,
        confidence: 0,
        reasoning: 'Correction failed',
      };
    }
  }

  async validateSemantics(claim: Partial<ExtractedClaim>): Promise<{
    issues: Array<{ field: string; issue: string; severity: 'warning' | 'error' }>;
  }> {
    const prompt = `Analyze this healthcare claim for semantic inconsistencies or unusual combinations.

Claim data:
${JSON.stringify(claim, null, 2)}

Check for issues like:
- Age-inappropriate diagnoses (pediatric codes on adults, etc.)
- Procedure/diagnosis mismatches
- Unusual modifier combinations
- Service dates that don't make sense
- Gender-specific procedures on wrong gender

List any semantic issues found. Respond in JSON:
{
  "issues": [
    { "field": "field path", "issue": "description", "severity": "warning" | "error" }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return JSON.parse(this.extractJSON(content.text));
    } catch (error) {
      logger.error('Semantic validation failed', { error });
      return { issues: [] };
    }
  }

  private extractJSON(text: string): string {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response');
  }
}

// Singleton instance
let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}
