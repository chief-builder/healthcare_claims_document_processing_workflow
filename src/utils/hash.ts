import CryptoJS from 'crypto-js';

/**
 * Calculate SHA-256 hash of document content for deduplication
 */
export function calculateDocumentHash(buffer: Buffer): string {
  const wordArray = CryptoJS.lib.WordArray.create(buffer as unknown as number[]);
  return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}

/**
 * Calculate hash of a string
 */
export function calculateStringHash(content: string): string {
  return CryptoJS.SHA256(content).toString(CryptoJS.enc.Hex);
}

/**
 * Generate a short hash (first 12 characters) for display purposes
 */
export function shortHash(hash: string): string {
  return hash.substring(0, 12);
}

/**
 * Compare two hashes for equality
 */
export function hashesMatch(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}
