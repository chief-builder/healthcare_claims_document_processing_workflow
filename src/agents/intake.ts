import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, AgentResult } from './base.js';
import {
  ClaimRecord,
  DocumentType,
  Priority,
  createClaimRecord,
} from '../models/index.js';
import { getStorageService } from '../services/index.js';
import { calculateDocumentHash } from '../utils/index.js';
import { logger } from '../utils/index.js';

export interface IntakeInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  priority?: Priority;
  metadata?: Record<string, string>;
}

export interface IntakeOutput {
  claimId: string;
  documentId: string;
  documentType: DocumentType;
  pageCount: number;
  preprocessed: boolean;
}

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
];

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_PAGES = 100;

export class IntakeAgent extends BaseAgent<IntakeInput, IntakeOutput> {
  constructor() {
    super('IntakeAgent');
  }

  async process(input: IntakeInput, _claim: ClaimRecord): Promise<AgentResult<IntakeOutput>> {
    // Validate file type
    if (!SUPPORTED_MIME_TYPES.includes(input.mimeType)) {
      return {
        success: false,
        error: `Unsupported file type: ${input.mimeType}. Supported types: PDF, PNG, JPEG, TIFF`,
      };
    }

    // Validate file size
    const maxSize = input.mimeType === 'application/pdf' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
    if (input.buffer.length > maxSize) {
      return {
        success: false,
        error: `File size ${input.buffer.length} exceeds maximum ${maxSize} bytes`,
      };
    }

    // Check for duplicates
    const storage = await getStorageService();
    const existingDocId = await storage.checkDuplicate(input.buffer);
    if (existingDocId) {
      return {
        success: false,
        error: `Duplicate document detected. Existing document ID: ${existingDocId}`,
      };
    }

    // Preprocess if image
    let processedBuffer = input.buffer;
    let preprocessed = false;

    if (input.mimeType.startsWith('image/')) {
      try {
        processedBuffer = await this.preprocessImage(input.buffer);
        preprocessed = true;
      } catch (error) {
        logger.warn('Image preprocessing failed, using original', { error });
      }
    }

    // Store document
    const storedDoc = await storage.storeDocument(processedBuffer, {
      originalFilename: input.filename,
      mimeType: input.mimeType,
      size: processedBuffer.length,
    });

    // Classify document type (using first page text if available)
    let documentType: DocumentType = 'unknown';
    let pageCount = 1;

    try {
      const classification = await this.classifyDocument(processedBuffer, input.mimeType);
      documentType = classification.type;
      pageCount = classification.pageCount;
    } catch (error) {
      logger.warn('Document classification failed', { error });
    }

    // Generate claim ID and create record
    const claimId = `CLM-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const documentHash = calculateDocumentHash(processedBuffer);

    const claimRecord = createClaimRecord(
      claimId,
      storedDoc.id,
      documentHash,
      input.priority ?? 'normal',
      input.metadata
    );
    claimRecord.documentType = documentType;

    await storage.storeClaim(claimRecord);

    return {
      success: true,
      data: {
        claimId,
        documentId: storedDoc.id,
        documentType,
        pageCount,
        preprocessed,
      },
      nextStatus: 'parsing',
      confidence: 1.0,
    };
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();

    let pipeline = sharp(buffer);

    // Convert to grayscale for better OCR
    pipeline = pipeline.grayscale();

    // Normalize contrast
    pipeline = pipeline.normalize();

    // Sharpen
    pipeline = pipeline.sharpen();

    // If image is tilted, try to correct (basic deskew)
    // Note: True deskew would require more sophisticated processing

    // Ensure reasonable DPI (upscale if too low)
    if (metadata.density && metadata.density < 200) {
      const scale = 300 / metadata.density;
      pipeline = pipeline.resize({
        width: Math.round((metadata.width ?? 0) * scale),
        height: Math.round((metadata.height ?? 0) * scale),
        fit: 'fill',
      });
    }

    // Output as PNG for best OCR compatibility
    return pipeline.png().toBuffer();
  }

  private async classifyDocument(
    buffer: Buffer,
    mimeType: string
  ): Promise<{ type: DocumentType; pageCount: number }> {
    let pageCount = 1;

    if (mimeType === 'application/pdf') {
      // For PDF, we'd need to extract text first
      // For now, we'll classify based on LLM after parsing
      // Just estimate page count
      pageCount = await this.estimatePDFPageCount(buffer);

      if (pageCount > MAX_PAGES) {
        throw new Error(`Document has ${pageCount} pages, exceeding maximum of ${MAX_PAGES}`);
      }
    }

    // For initial classification, use simple heuristics
    // Full classification will happen after OCR in parsing agent
    return {
      type: 'unknown', // Will be classified after OCR
      pageCount,
    };
  }

  private async estimatePDFPageCount(buffer: Buffer): Promise<number> {
    // Simple PDF page count estimation
    // Look for /Type /Page occurrences
    const content = buffer.toString('binary');
    const matches = content.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 1;
  }

  // Static method for initial intake (before claim record exists)
  static async intake(input: IntakeInput): Promise<AgentResult<IntakeOutput>> {
    const agent = new IntakeAgent();

    // Create a temporary claim record for the process method
    const tempClaim: ClaimRecord = {
      id: 'temp',
      status: 'received',
      priority: input.priority ?? 'normal',
      documentId: '',
      documentHash: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingHistory: [],
      metadata: input.metadata,
    };

    return agent.execute(input, tempClaim);
  }
}
