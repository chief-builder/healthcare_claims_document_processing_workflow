import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../config/index.js';
import { ClaimRecord, ClaimStatus, ValidationResult, ExtractedClaim } from '../models/index.js';
import { AdjudicationDecision } from '../models/adjudication.js';
import { calculateDocumentHash } from '../utils/index.js';
import { logger } from '../utils/index.js';

export interface DocumentMetadata {
  originalFilename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface StoredDocument {
  id: string;
  hash: string;
  metadata: DocumentMetadata;
  path: string;
}

export class StorageService {
  private storagePath: string;
  private uploadPath: string;
  private claimsPath: string;
  private documentsPath: string;
  private hashIndex: Map<string, string> = new Map(); // hash -> documentId

  constructor() {
    const config = getConfig();
    this.storagePath = config.storage.storagePath;
    this.uploadPath = config.storage.uploadPath;
    this.claimsPath = path.join(this.storagePath, 'claims');
    this.documentsPath = path.join(this.storagePath, 'documents');
  }

  async initialize(): Promise<void> {
    // Create directories if they don't exist
    await fs.mkdir(this.claimsPath, { recursive: true });
    await fs.mkdir(this.documentsPath, { recursive: true });
    await fs.mkdir(this.uploadPath, { recursive: true });

    // Load hash index
    await this.loadHashIndex();

    logger.info('Storage service initialized', {
      storagePath: this.storagePath,
      uploadPath: this.uploadPath,
    });
  }

  private async loadHashIndex(): Promise<void> {
    const indexPath = path.join(this.storagePath, 'hash-index.json');
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data) as Record<string, string>;
      this.hashIndex = new Map(Object.entries(index));
    } catch {
      // Index doesn't exist yet
      this.hashIndex = new Map();
    }
  }

  private async saveHashIndex(): Promise<void> {
    const indexPath = path.join(this.storagePath, 'hash-index.json');
    const index = Object.fromEntries(this.hashIndex);
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  async storeDocument(
    buffer: Buffer,
    metadata: Omit<DocumentMetadata, 'uploadedAt'>
  ): Promise<StoredDocument> {
    const hash = calculateDocumentHash(buffer);
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const docPath = path.join(this.documentsPath, id);

    // Store the document
    await fs.writeFile(docPath, buffer);

    // Store metadata
    const fullMetadata: DocumentMetadata = {
      ...metadata,
      uploadedAt: new Date().toISOString(),
    };
    await fs.writeFile(`${docPath}.meta.json`, JSON.stringify(fullMetadata, null, 2));

    // Update hash index
    this.hashIndex.set(hash, id);
    await this.saveHashIndex();

    logger.info('Document stored', { documentId: id, hash: hash.substring(0, 12) });

    return {
      id,
      hash,
      metadata: fullMetadata,
      path: docPath,
    };
  }

  async getDocument(documentId: string): Promise<Buffer> {
    const docPath = path.join(this.documentsPath, documentId);
    return fs.readFile(docPath);
  }

  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata> {
    const metaPath = path.join(this.documentsPath, `${documentId}.meta.json`);
    const data = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(data) as DocumentMetadata;
  }

  async checkDuplicate(buffer: Buffer): Promise<string | null> {
    const hash = calculateDocumentHash(buffer);
    return this.hashIndex.get(hash) ?? null;
  }

  async checkDuplicateByHash(hash: string): Promise<string | null> {
    return this.hashIndex.get(hash) ?? null;
  }

  async storeClaim(claim: ClaimRecord): Promise<void> {
    const claimPath = path.join(this.claimsPath, `${claim.id}.json`);
    await fs.writeFile(claimPath, JSON.stringify(claim, null, 2));
    logger.debug('Claim stored', { claimId: claim.id, status: claim.status });
  }

  async getClaim(claimId: string): Promise<ClaimRecord | null> {
    const claimPath = path.join(this.claimsPath, `${claimId}.json`);
    try {
      const data = await fs.readFile(claimPath, 'utf-8');
      return JSON.parse(data) as ClaimRecord;
    } catch {
      return null;
    }
  }

  async updateClaimStatus(
    claimId: string,
    status: ClaimStatus,
    message?: string
  ): Promise<ClaimRecord | null> {
    const claim = await this.getClaim(claimId);
    if (!claim) return null;

    const now = new Date().toISOString();
    const updatedClaim: ClaimRecord = {
      ...claim,
      status,
      updatedAt: now,
      processingHistory: [
        ...claim.processingHistory,
        { status, timestamp: now, message },
      ],
    };

    await this.storeClaim(updatedClaim);
    return updatedClaim;
  }

  async updateClaimExtraction(
    claimId: string,
    extractedClaim: ExtractedClaim
  ): Promise<ClaimRecord | null> {
    const claim = await this.getClaim(claimId);
    if (!claim) return null;

    const updatedClaim: ClaimRecord = {
      ...claim,
      extractedClaim,
      updatedAt: new Date().toISOString(),
    };

    await this.storeClaim(updatedClaim);
    return updatedClaim;
  }

  async storeValidationResult(claimId: string, result: ValidationResult): Promise<void> {
    const resultPath = path.join(this.claimsPath, `${claimId}.validation.json`);
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
  }

  async getValidationResult(claimId: string): Promise<ValidationResult | null> {
    const resultPath = path.join(this.claimsPath, `${claimId}.validation.json`);
    try {
      const data = await fs.readFile(resultPath, 'utf-8');
      return JSON.parse(data) as ValidationResult;
    } catch {
      return null;
    }
  }

  async storeAdjudicationDecision(claimId: string, decision: AdjudicationDecision): Promise<void> {
    const decisionPath = path.join(this.claimsPath, `${claimId}.adjudication.json`);
    await fs.writeFile(decisionPath, JSON.stringify(decision, null, 2));
  }

  async getAdjudicationDecision(claimId: string): Promise<AdjudicationDecision | null> {
    const decisionPath = path.join(this.claimsPath, `${claimId}.adjudication.json`);
    try {
      const data = await fs.readFile(decisionPath, 'utf-8');
      return JSON.parse(data) as AdjudicationDecision;
    } catch {
      return null;
    }
  }

  async listClaims(options: {
    status?: ClaimStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ claims: ClaimRecord[]; total: number }> {
    const files = await fs.readdir(this.claimsPath);
    const claimFiles = files.filter((f) => f.endsWith('.json') && !f.includes('.'));

    let claims: ClaimRecord[] = [];

    for (const file of claimFiles) {
      const claimPath = path.join(this.claimsPath, file);
      const data = await fs.readFile(claimPath, 'utf-8');
      const claim = JSON.parse(data) as ClaimRecord;

      if (!options.status || claim.status === options.status) {
        claims.push(claim);
      }
    }

    // Sort by createdAt descending
    claims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = claims.length;

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    claims = claims.slice(offset, offset + limit);

    return { claims, total };
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const docPath = path.join(this.documentsPath, documentId);
      await fs.unlink(docPath);
      await fs.unlink(`${docPath}.meta.json`).catch(() => {});

      // Remove from hash index
      for (const [hash, id] of this.hashIndex) {
        if (id === documentId) {
          this.hashIndex.delete(hash);
          await this.saveHashIndex();
          break;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async deleteClaim(claimId: string): Promise<boolean> {
    try {
      const claimPath = path.join(this.claimsPath, `${claimId}.json`);
      await fs.unlink(claimPath);
      await fs.unlink(path.join(this.claimsPath, `${claimId}.validation.json`)).catch(() => {});
      await fs.unlink(path.join(this.claimsPath, `${claimId}.adjudication.json`)).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export async function getStorageService(): Promise<StorageService> {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
    await storageServiceInstance.initialize();
  }
  return storageServiceInstance;
}
