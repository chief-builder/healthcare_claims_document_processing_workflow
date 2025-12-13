/**
 * NPI (National Provider Identifier) Validator
 *
 * NPI is a 10-digit number that uses the Luhn algorithm for checksum validation.
 * The NPI has a prefix of "80840" for the Luhn calculation.
 */

/**
 * Validates NPI format (10 digits)
 */
export function isValidNPIFormat(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

/**
 * Validates NPI checksum using Luhn algorithm
 * The NPI uses a prefix of "80840" for calculation
 */
export function isValidNPIChecksum(npi: string): boolean {
  if (!isValidNPIFormat(npi)) {
    return false;
  }

  // Prefix with 80840 for healthcare identifier
  const prefixedNPI = '80840' + npi;

  // Luhn algorithm
  let sum = 0;
  let alternate = false;

  for (let i = prefixedNPI.length - 1; i >= 0; i--) {
    let digit = parseInt(prefixedNPI[i], 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Full NPI validation (format + checksum)
 */
export function validateNPI(npi: string): {
  isValid: boolean;
  error?: string;
} {
  if (!npi) {
    return { isValid: false, error: 'NPI is required' };
  }

  const trimmedNPI = npi.trim();

  if (!isValidNPIFormat(trimmedNPI)) {
    return { isValid: false, error: 'NPI must be exactly 10 digits' };
  }

  if (!isValidNPIChecksum(trimmedNPI)) {
    return { isValid: false, error: 'NPI checksum is invalid' };
  }

  return { isValid: true };
}

/**
 * Calculate check digit for a 9-digit NPI prefix
 */
export function calculateNPICheckDigit(npiPrefix: string): string | null {
  if (!/^\d{9}$/.test(npiPrefix)) {
    return null;
  }

  // Try each digit 0-9 as check digit
  for (let checkDigit = 0; checkDigit <= 9; checkDigit++) {
    const fullNPI = npiPrefix + checkDigit.toString();
    if (isValidNPIChecksum(fullNPI)) {
      return checkDigit.toString();
    }
  }

  return null;
}
