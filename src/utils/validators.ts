/**
 * Healthcare code and data validators
 */

// ICD-10 format: Letter followed by 2 digits, optional decimal and 1-4 more digits
const ICD10_REGEX = /^[A-Z]\d{2}(\.\d{1,4})?$/;

// CPT format: 5 digits
const CPT_REGEX = /^\d{5}$/;

// HCPCS format: Letter followed by 4 digits
const HCPCS_REGEX = /^[A-Z]\d{4}$/;

// Date format: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Modifier format: 2 alphanumeric characters
const MODIFIER_REGEX = /^[A-Z0-9]{2}$/;

/**
 * Validate ICD-10 code format
 */
export function isValidICD10Format(code: string): boolean {
  return ICD10_REGEX.test(code.toUpperCase());
}

/**
 * Validate CPT code format
 */
export function isValidCPTFormat(code: string): boolean {
  return CPT_REGEX.test(code);
}

/**
 * Validate HCPCS code format
 */
export function isValidHCPCSFormat(code: string): boolean {
  return HCPCS_REGEX.test(code.toUpperCase());
}

/**
 * Validate procedure code (CPT or HCPCS)
 */
export function isValidProcedureCodeFormat(code: string): boolean {
  return isValidCPTFormat(code) || isValidHCPCSFormat(code);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
  if (!DATE_REGEX.test(date)) {
    return false;
  }

  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Validate date is not in the future
 */
export function isDateNotFuture(date: string): boolean {
  if (!isValidDateFormat(date)) {
    return false;
  }

  const parsed = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return parsed <= today;
}

/**
 * Validate date is within reasonable range (not more than 1 year in past)
 */
export function isDateWithinRange(date: string, maxDaysBack: number = 365): boolean {
  if (!isValidDateFormat(date)) {
    return false;
  }

  const parsed = new Date(date);
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - maxDaysBack);

  return parsed >= minDate && parsed <= today;
}

/**
 * Validate modifier format
 */
export function isValidModifierFormat(modifier: string): boolean {
  return MODIFIER_REGEX.test(modifier.toUpperCase());
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validate member ID format (alphanumeric, 5-20 characters)
 */
export function isValidMemberIdFormat(memberId: string): boolean {
  return /^[A-Z0-9]{5,20}$/i.test(memberId);
}

/**
 * Validate Tax ID format (9 digits, with or without dash)
 */
export function isValidTaxIdFormat(taxId: string): boolean {
  const cleaned = taxId.replace(/-/g, '');
  return /^\d{9}$/.test(cleaned);
}

/**
 * Validate Place of Service code (2 digits)
 */
export function isValidPOSCode(pos: string): boolean {
  return /^\d{2}$/.test(pos);
}

/**
 * Parse date string to Date object
 */
export function parseDate(date: string): Date | null {
  if (!isValidDateFormat(date)) {
    return null;
  }

  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: string, asOfDate?: string): number | null {
  const dobDate = parseDate(dob);
  if (!dobDate) {
    return null;
  }

  const refDate = asOfDate ? parseDate(asOfDate) : new Date();
  if (!refDate) {
    return null;
  }

  let age = refDate.getFullYear() - dobDate.getFullYear();
  const monthDiff = refDate.getMonth() - dobDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < dobDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Normalize code to uppercase without spaces
 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().trim().replace(/\s+/g, '');
}

/**
 * Validate diagnosis pointer (A-L)
 */
export function isValidDiagnosisPointer(pointer: string): boolean {
  return /^[A-L]$/.test(pointer.toUpperCase());
}

/**
 * Convert diagnosis pointer to index (A=0, B=1, etc.)
 */
export function diagnosisPointerToIndex(pointer: string): number {
  const upper = pointer.toUpperCase();
  if (!isValidDiagnosisPointer(upper)) {
    return -1;
  }
  return upper.charCodeAt(0) - 'A'.charCodeAt(0);
}
