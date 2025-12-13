import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config/index.js';
import { Address, ExtractedClaim, Provider } from '../models/index.js';
import { logger } from '../utils/index.js';

/**
 * Document Enrichment & Normalization Service
 * Handles address normalization, date formatting, phone validation,
 * and external data enrichment
 */

// ============== Types ==============

export interface NormalizationResult<T> {
  original: T;
  normalized: T;
  confidence: number;
  changes: string[];
  source: 'rule' | 'llm' | 'external';
}

export interface AddressValidation {
  isValid: boolean;
  normalized: Address;
  corrections: string[];
  confidence: number;
}

export interface PhoneValidation {
  isValid: boolean;
  normalized: string;
  formatted: string;
  type?: 'mobile' | 'landline' | 'voip' | 'unknown';
}

export interface NPILookupResult {
  isValid: boolean;
  npi: string;
  providerName?: string;
  providerType?: string;
  specialty?: string;
  address?: Address;
  phone?: string;
  lastUpdated?: string;
}

export interface EnrichmentResult {
  claimId: string;
  enrichedClaim: ExtractedClaim;
  normalizations: Array<{
    field: string;
    original: unknown;
    normalized: unknown;
    method: string;
  }>;
  enrichments: Array<{
    field: string;
    addedData: unknown;
    source: string;
  }>;
  overallConfidence: number;
}

// ============== US State Codes ==============

const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

// ============== Address Normalization ==============

export class AddressNormalizer {
  private streetAbbreviations: Record<string, string> = {
    'street': 'ST', 'st': 'ST', 'str': 'ST',
    'avenue': 'AVE', 'ave': 'AVE', 'av': 'AVE',
    'boulevard': 'BLVD', 'blvd': 'BLVD',
    'drive': 'DR', 'dr': 'DR',
    'road': 'RD', 'rd': 'RD',
    'lane': 'LN', 'ln': 'LN',
    'court': 'CT', 'ct': 'CT',
    'circle': 'CIR', 'cir': 'CIR',
    'place': 'PL', 'pl': 'PL',
    'highway': 'HWY', 'hwy': 'HWY',
    'parkway': 'PKWY', 'pkwy': 'PKWY',
    'apartment': 'APT', 'apt': 'APT',
    'suite': 'STE', 'ste': 'STE',
    'unit': 'UNIT',
    'floor': 'FL', 'flr': 'FL',
    'building': 'BLDG', 'bldg': 'BLDG',
    'north': 'N', 'south': 'S', 'east': 'E', 'west': 'W',
    'northeast': 'NE', 'northwest': 'NW', 'southeast': 'SE', 'southwest': 'SW',
  };

  normalize(address: Address): NormalizationResult<Address> {
    const changes: string[] = [];
    const normalized: Address = { ...address };

    // Normalize street address
    if (address.street1) {
      const normalizedStreet = this.normalizeStreetAddress(address.street1);
      if (normalizedStreet !== address.street1) {
        changes.push(`street1: "${address.street1}" → "${normalizedStreet}"`);
        normalized.street1 = normalizedStreet;
      }
    }

    if (address.street2) {
      const normalizedStreet2 = this.normalizeStreetAddress(address.street2);
      if (normalizedStreet2 !== address.street2) {
        changes.push(`street2: "${address.street2}" → "${normalizedStreet2}"`);
        normalized.street2 = normalizedStreet2;
      }
    }

    // Normalize city (title case)
    if (address.city) {
      const normalizedCity = this.titleCase(address.city.trim());
      if (normalizedCity !== address.city) {
        changes.push(`city: "${address.city}" → "${normalizedCity}"`);
        normalized.city = normalizedCity;
      }
    }

    // Normalize state to 2-letter code
    if (address.state) {
      const normalizedState = this.normalizeState(address.state);
      if (normalizedState !== address.state) {
        changes.push(`state: "${address.state}" → "${normalizedState}"`);
        normalized.state = normalizedState;
      }
    }

    // Normalize ZIP code
    if (address.zipCode) {
      const normalizedZip = this.normalizeZipCode(address.zipCode);
      if (normalizedZip !== address.zipCode) {
        changes.push(`zipCode: "${address.zipCode}" → "${normalizedZip}"`);
        normalized.zipCode = normalizedZip;
      }
    }

    return {
      original: address,
      normalized,
      confidence: changes.length === 0 ? 1.0 : 0.9,
      changes,
      source: 'rule',
    };
  }

  private normalizeStreetAddress(street: string): string {
    let normalized = street.trim();

    // Replace abbreviations
    for (const [full, abbr] of Object.entries(this.streetAbbreviations)) {
      const regex = new RegExp(`\\b${full}\\b`, 'gi');
      normalized = normalized.replace(regex, abbr);
    }

    // Capitalize properly
    normalized = normalized.replace(/\b\w/g, (c) => c.toUpperCase());

    // Fix common patterns
    normalized = normalized.replace(/\s+/g, ' '); // Multiple spaces
    normalized = normalized.replace(/,\s*/g, ', '); // Comma spacing
    normalized = normalized.replace(/#\s*/g, '# '); // Hash spacing

    return normalized;
  }

  private normalizeState(state: string): string {
    const cleaned = state.trim().toLowerCase();

    // Already a 2-letter code
    if (/^[a-z]{2}$/i.test(cleaned)) {
      return cleaned.toUpperCase();
    }

    // Look up full name
    return US_STATES[cleaned] ?? state.toUpperCase();
  }

  private normalizeZipCode(zip: string): string {
    // Remove non-numeric except dash
    const cleaned = zip.replace(/[^\d-]/g, '');

    // Handle ZIP+4
    if (/^\d{9}$/.test(cleaned)) {
      return `${cleaned.substring(0, 5)}-${cleaned.substring(5)}`;
    }

    // Standard 5-digit ZIP
    if (/^\d{5}/.test(cleaned)) {
      return cleaned.substring(0, 5);
    }

    return cleaned;
  }

  private titleCase(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// ============== Date Normalizer ==============

export class DateNormalizer {
  private datePatterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, order: ['month', 'day', 'year'] },
    // YYYY/MM/DD or YYYY-MM-DD (ISO)
    { pattern: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, order: ['year', 'month', 'day'] },
    // DD/MM/YYYY (European)
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, order: ['day', 'month', 'year'], european: true },
    // Month DD, YYYY
    { pattern: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, order: ['month_name', 'day', 'year'] },
    // DD Month YYYY
    { pattern: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/, order: ['day', 'month_name', 'year'] },
  ];

  private monthNames: Record<string, number> = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
    'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12,
  };

  normalize(dateStr: string): NormalizationResult<string> {
    const original = dateStr.trim();

    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(original)) {
      return {
        original,
        normalized: original,
        confidence: 1.0,
        changes: [],
        source: 'rule',
      };
    }

    // Try each pattern
    for (const { pattern, order } of this.datePatterns) {
      const match = original.match(pattern);
      if (match) {
        try {
          const parts: Record<string, number> = {};

          for (let i = 0; i < order.length; i++) {
            const key = order[i];
            const value = match[i + 1];

            if (key === 'month_name') {
              parts['month'] = this.monthNames[value.toLowerCase()] ?? 0;
            } else {
              parts[key] = parseInt(value, 10);
            }
          }

          const year = parts['year'];
          const month = parts['month'];
          const day = parts['day'];

          if (year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Validate the date is real
            const date = new Date(normalized);
            if (!isNaN(date.getTime())) {
              return {
                original,
                normalized,
                confidence: 0.95,
                changes: [`"${original}" → "${normalized}"`],
                source: 'rule',
              };
            }
          }
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Could not parse
    return {
      original,
      normalized: original,
      confidence: 0.5,
      changes: ['Could not normalize date format'],
      source: 'rule',
    };
  }

  normalizeToAge(dateOfBirth: string, asOfDate?: string): number | null {
    const dob = this.normalize(dateOfBirth);
    const dobDate = new Date(dob.normalized);

    if (isNaN(dobDate.getTime())) return null;

    const refDate = asOfDate ? new Date(this.normalize(asOfDate).normalized) : new Date();

    let age = refDate.getFullYear() - dobDate.getFullYear();
    const monthDiff = refDate.getMonth() - dobDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < dobDate.getDate())) {
      age--;
    }

    return age;
  }
}

// ============== Phone Normalizer ==============

export class PhoneNormalizer {
  normalize(phone: string): PhoneValidation {
    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');

    // Check if it's a valid US phone number
    if (digits.length === 10) {
      return {
        isValid: true,
        normalized: digits,
        formatted: `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`,
        type: 'unknown',
      };
    }

    // With country code
    if (digits.length === 11 && digits.startsWith('1')) {
      const nationalNumber = digits.substring(1);
      return {
        isValid: true,
        normalized: nationalNumber,
        formatted: `(${nationalNumber.substring(0, 3)}) ${nationalNumber.substring(3, 6)}-${nationalNumber.substring(6)}`,
        type: 'unknown',
      };
    }

    return {
      isValid: false,
      normalized: digits,
      formatted: phone,
      type: 'unknown',
    };
  }
}

// ============== Currency Normalizer ==============

export class CurrencyNormalizer {
  normalize(value: string | number): NormalizationResult<number> {
    if (typeof value === 'number') {
      return {
        original: value,
        normalized: Math.round(value * 100) / 100,
        confidence: 1.0,
        changes: [],
        source: 'rule',
      };
    }

    const originalStr = value;

    // Remove currency symbols and commas
    let cleaned = value.replace(/[$,]/g, '').trim();

    // Handle parentheses for negative
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }

    const parsed = parseFloat(cleaned);

    if (isNaN(parsed)) {
      return {
        original: 0,
        normalized: 0,
        confidence: 0,
        changes: ['Could not parse currency value'],
        source: 'rule',
      };
    }

    const normalized = Math.round(parsed * 100) / 100;

    return {
      original: parsed,
      normalized,
      confidence: 0.95,
      changes: originalStr !== String(normalized) ? [`"${originalStr}" → ${normalized}`] : [],
      source: 'rule',
    };
  }
}

// ============== Code Normalizer ==============

export class CodeNormalizer {
  normalizeICD10(code: string): NormalizationResult<string> {
    const original = code;
    let normalized = code.toUpperCase().trim();

    // Remove invalid characters
    normalized = normalized.replace(/[^A-Z0-9.]/g, '');

    // Ensure decimal point placement
    if (normalized.length > 3 && !normalized.includes('.')) {
      normalized = normalized.substring(0, 3) + '.' + normalized.substring(3);
    }

    return {
      original,
      normalized,
      confidence: normalized === original.toUpperCase() ? 1.0 : 0.9,
      changes: normalized !== original ? [`"${original}" → "${normalized}"`] : [],
      source: 'rule',
    };
  }

  normalizeCPT(code: string): NormalizationResult<string> {
    const original = code;
    let normalized = code.replace(/\D/g, '').substring(0, 5);

    // Pad with zeros if needed
    normalized = normalized.padStart(5, '0');

    return {
      original,
      normalized,
      confidence: normalized === original ? 1.0 : 0.85,
      changes: normalized !== original ? [`"${original}" → "${normalized}"`] : [],
      source: 'rule',
    };
  }

  normalizeNPI(npi: string): NormalizationResult<string> {
    const original = npi;
    const normalized = npi.replace(/\D/g, '').substring(0, 10);

    return {
      original,
      normalized,
      confidence: normalized.length === 10 ? 0.95 : 0.5,
      changes: normalized !== original ? [`"${original}" → "${normalized}"`] : [],
      source: 'rule',
    };
  }

  normalizeModifier(modifier: string): NormalizationResult<string> {
    const original = modifier;
    const normalized = modifier.toUpperCase().trim().substring(0, 2);

    return {
      original,
      normalized,
      confidence: 1.0,
      changes: normalized !== original ? [`"${original}" → "${normalized}"`] : [],
      source: 'rule',
    };
  }
}

// ============== External Enrichment (Mock NPPES) ==============

export class ExternalEnrichment {
  private client: Anthropic;
  private model: string;

  // Mock NPPES data (in production, call actual NPPES API)
  private mockNPPES: Record<string, NPILookupResult> = {
    '1234567893': {
      isValid: true,
      npi: '1234567893',
      providerName: 'John Smith MD',
      providerType: 'Individual',
      specialty: 'Internal Medicine',
      address: {
        street1: '123 Medical Center Dr',
        city: 'Boston',
        state: 'MA',
        zipCode: '02115',
        country: 'US',
      },
      phone: '6175551234',
      lastUpdated: '2024-01-15',
    },
  };

  constructor() {
    const config = getConfig();
    this.client = new Anthropic({
      authToken: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
  }

  async lookupNPI(npi: string): Promise<NPILookupResult> {
    // Check mock data first
    if (this.mockNPPES[npi]) {
      return this.mockNPPES[npi];
    }

    // In production, call NPPES API:
    // https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1

    logger.info('NPI lookup (mock)', { npi });

    return {
      isValid: false,
      npi,
    };
  }

  async enrichProviderFromNPI(provider: Provider): Promise<{
    enriched: Provider;
    additions: string[];
  }> {
    const npiResult = await this.lookupNPI(provider.npi);

    if (!npiResult.isValid) {
      return { enriched: provider, additions: [] };
    }

    const enriched = { ...provider };
    const additions: string[] = [];

    // Add missing specialty
    if (!enriched.specialty && npiResult.specialty) {
      enriched.specialty = npiResult.specialty;
      additions.push(`Added specialty: ${npiResult.specialty}`);
    }

    // Add missing address
    if (!enriched.address && npiResult.address) {
      enriched.address = npiResult.address;
      additions.push('Added address from NPPES');
    }

    return { enriched, additions };
  }

  async inferMissingData(
    claim: ExtractedClaim,
    ocrText: string
  ): Promise<{ field: string; value: unknown; confidence: number }[]> {
    const prompt = `Analyze this healthcare claim and OCR text to infer any missing data.

## Current Extracted Claim
${JSON.stringify(claim, null, 2)}

## OCR Text
${ocrText.substring(0, 4000)}

## Task
Identify fields that are null/empty in the claim but might be inferrable from the OCR text or context.

For example:
- If gender is missing but diagnosis codes suggest a gender-specific condition
- If place of service is missing but can be inferred from procedure codes
- If specialty is missing but can be inferred from procedure types

Respond in JSON:
{
  "inferences": [
    {
      "field": "field.path",
      "value": "inferred value",
      "confidence": 0.0-1.0,
      "reasoning": "why this inference is reasonable"
    }
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

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.inferences ?? [];
    } catch (error) {
      logger.error('Missing data inference failed', { error });
      return [];
    }
  }
}

// ============== Main Enrichment Service ==============

export class EnrichmentService {
  private addressNormalizer = new AddressNormalizer();
  private dateNormalizer = new DateNormalizer();
  private currencyNormalizer = new CurrencyNormalizer();
  private codeNormalizer = new CodeNormalizer();
  private externalEnrichment = new ExternalEnrichment();

  async enrichClaim(
    claim: ExtractedClaim,
    ocrText?: string
  ): Promise<EnrichmentResult> {
    const normalizations: EnrichmentResult['normalizations'] = [];
    const enrichments: EnrichmentResult['enrichments'] = [];

    // Create a deep copy to modify
    const enrichedClaim: ExtractedClaim = JSON.parse(JSON.stringify(claim));

    // 1. Normalize patient address
    if (enrichedClaim.patient.address) {
      const result = this.addressNormalizer.normalize(enrichedClaim.patient.address);
      if (result.changes.length > 0) {
        enrichedClaim.patient.address = result.normalized;
        normalizations.push({
          field: 'patient.address',
          original: result.original,
          normalized: result.normalized,
          method: 'address_normalization',
        });
      }
    }

    // 2. Normalize patient DOB
    if (enrichedClaim.patient.dateOfBirth) {
      const result = this.dateNormalizer.normalize(enrichedClaim.patient.dateOfBirth);
      if (result.changes.length > 0) {
        enrichedClaim.patient.dateOfBirth = result.normalized;
        normalizations.push({
          field: 'patient.dateOfBirth',
          original: result.original,
          normalized: result.normalized,
          method: 'date_normalization',
        });
      }
    }

    // 3. Normalize provider address
    if (enrichedClaim.provider.address) {
      const result = this.addressNormalizer.normalize(enrichedClaim.provider.address);
      if (result.changes.length > 0) {
        enrichedClaim.provider.address = result.normalized;
        normalizations.push({
          field: 'provider.address',
          original: result.original,
          normalized: result.normalized,
          method: 'address_normalization',
        });
      }
    }

    // 4. Normalize NPI
    if (enrichedClaim.provider.npi) {
      const result = this.codeNormalizer.normalizeNPI(enrichedClaim.provider.npi);
      if (result.changes.length > 0) {
        enrichedClaim.provider.npi = result.normalized;
        normalizations.push({
          field: 'provider.npi',
          original: result.original,
          normalized: result.normalized,
          method: 'npi_normalization',
        });
      }
    }

    // 5. Normalize diagnosis codes
    for (let i = 0; i < enrichedClaim.diagnoses.length; i++) {
      const result = this.codeNormalizer.normalizeICD10(enrichedClaim.diagnoses[i].code);
      if (result.changes.length > 0) {
        enrichedClaim.diagnoses[i].code = result.normalized;
        normalizations.push({
          field: `diagnoses[${i}].code`,
          original: result.original,
          normalized: result.normalized,
          method: 'icd10_normalization',
        });
      }
    }

    // 6. Normalize service lines
    for (let i = 0; i < enrichedClaim.serviceLines.length; i++) {
      const line = enrichedClaim.serviceLines[i];

      // Date of service
      const dateResult = this.dateNormalizer.normalize(line.dateOfService);
      if (dateResult.changes.length > 0) {
        enrichedClaim.serviceLines[i].dateOfService = dateResult.normalized;
        normalizations.push({
          field: `serviceLines[${i}].dateOfService`,
          original: dateResult.original,
          normalized: dateResult.normalized,
          method: 'date_normalization',
        });
      }

      // Procedure code
      const codeResult = /^\d{5}$/.test(line.procedureCode.replace(/\D/g, ''))
        ? this.codeNormalizer.normalizeCPT(line.procedureCode)
        : { original: line.procedureCode, normalized: line.procedureCode.toUpperCase(), changes: [], source: 'rule' as const, confidence: 1 };

      if (codeResult.changes.length > 0) {
        enrichedClaim.serviceLines[i].procedureCode = codeResult.normalized;
        normalizations.push({
          field: `serviceLines[${i}].procedureCode`,
          original: codeResult.original,
          normalized: codeResult.normalized,
          method: 'procedure_code_normalization',
        });
      }

      // Modifiers
      for (let j = 0; j < line.modifiers.length; j++) {
        const modResult = this.codeNormalizer.normalizeModifier(line.modifiers[j]);
        if (modResult.changes.length > 0) {
          enrichedClaim.serviceLines[i].modifiers[j] = modResult.normalized;
        }
      }
    }

    // 7. Normalize amounts
    const chargeResult = this.currencyNormalizer.normalize(enrichedClaim.totals.totalCharges);
    if (chargeResult.changes.length > 0) {
      enrichedClaim.totals.totalCharges = chargeResult.normalized;
      normalizations.push({
        field: 'totals.totalCharges',
        original: chargeResult.original,
        normalized: chargeResult.normalized,
        method: 'currency_normalization',
      });
    }

    // 8. Enrich provider from NPI lookup
    const { enriched: enrichedProvider, additions } = await this.externalEnrichment.enrichProviderFromNPI(
      enrichedClaim.provider
    );
    enrichedClaim.provider = enrichedProvider;
    for (const addition of additions) {
      enrichments.push({
        field: 'provider',
        addedData: addition,
        source: 'NPPES',
      });
    }

    // 9. Infer missing data using LLM (if OCR text provided)
    if (ocrText) {
      const inferences = await this.externalEnrichment.inferMissingData(enrichedClaim, ocrText);
      for (const inference of inferences) {
        if (inference.confidence >= 0.8) {
          this.setNestedValue(enrichedClaim, inference.field, inference.value);
          enrichments.push({
            field: inference.field,
            addedData: inference.value,
            source: 'llm_inference',
          });
        }
      }
    }

    // Calculate overall confidence
    const overallConfidence = this.calculateConfidence(normalizations, enrichments);

    logger.info('Claim enrichment completed', {
      claimId: claim.id,
      normalizations: normalizations.length,
      enrichments: enrichments.length,
      overallConfidence,
    });

    return {
      claimId: claim.id,
      enrichedClaim,
      normalizations,
      enrichments,
      overallConfidence,
    };
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);

      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = (current[key] as unknown[])[parseInt(index, 10)] as Record<string, unknown>;
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  private calculateConfidence(
    normalizations: EnrichmentResult['normalizations'],
    enrichments: EnrichmentResult['enrichments']
  ): number {
    // Start with base confidence
    let confidence = 1.0;

    // Slight reduction for each normalization (data was changed)
    confidence -= normalizations.length * 0.01;

    // Slight reduction for inferred enrichments
    const inferredCount = enrichments.filter((e) => e.source === 'llm_inference').length;
    confidence -= inferredCount * 0.02;

    return Math.max(0.5, confidence);
  }
}

// Singleton instance
let enrichmentServiceInstance: EnrichmentService | null = null;

export function getEnrichmentService(): EnrichmentService {
  if (!enrichmentServiceInstance) {
    enrichmentServiceInstance = new EnrichmentService();
  }
  return enrichmentServiceInstance;
}

