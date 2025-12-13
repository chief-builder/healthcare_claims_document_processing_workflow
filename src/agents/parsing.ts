import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { BaseAgent, AgentResult } from './base.js';
import { ClaimRecord, DocumentType } from '../models/index.js';
import {
  getOCRService,
  getLLMService,
  getStorageService,
  OCRResult,
  Table,
  Checkbox,
} from '../services/index.js';
import { logger } from '../utils/index.js';

export interface ParsingInput {
  documentId: string;
  mimeType: string;
}

export interface ParsingOutput {
  ocrResult: OCRResult;
  tables: Table[];
  checkboxes: Checkbox[];
  documentType: DocumentType;
  readingOrderText: string;
}

export class ParsingAgent extends BaseAgent<ParsingInput, ParsingOutput> {
  constructor() {
    super('ParsingAgent');
  }

  async process(input: ParsingInput, claim: ClaimRecord): Promise<AgentResult<ParsingOutput>> {
    const storage = await getStorageService();
    const ocr = getOCRService();
    const llm = getLLMService();

    // Get document from storage
    const documentBuffer = await storage.getDocument(input.documentId);

    // Convert to images for OCR
    const imageBuffers = await this.documentToImages(documentBuffer, input.mimeType);

    logger.info('Document converted to images', {
      claimId: claim.id,
      pageCount: imageBuffers.length,
    });

    // Perform OCR on all pages
    await ocr.initialize();
    const ocrResult = await ocr.extractMultiPage(imageBuffers);

    logger.info('OCR completed', {
      claimId: claim.id,
      overallConfidence: ocrResult.overallConfidence,
      pageCount: ocrResult.pages.length,
    });

    // Detect tables
    const tables: Table[] = [];
    for (const page of ocrResult.pages) {
      const pageTables = await ocr.detectTables(page);
      tables.push(...pageTables);
    }

    // Detect checkboxes
    const checkboxes: Checkbox[] = [];
    for (let i = 0; i < ocrResult.pages.length; i++) {
      const pageCheckboxes = await ocr.detectCheckboxes(
        imageBuffers[i],
        ocrResult.pages[i].blocks
      );
      checkboxes.push(...pageCheckboxes);
    }

    // Reconstruct reading order
    const orderedBlocks = ocrResult.pages.flatMap((page) =>
      ocr.reconstructReadingOrder(page.blocks)
    );
    const readingOrderText = orderedBlocks.map((block) => block.text).join('\n');

    // Classify document type using LLM
    const classification = await llm.classifyDocument(readingOrderText);
    const documentType = classification.type;

    logger.info('Document classified', {
      claimId: claim.id,
      documentType,
      classificationConfidence: classification.confidence,
    });

    // Calculate overall confidence
    const confidence = this.calculateParsingConfidence(ocrResult, classification.confidence);

    return {
      success: true,
      data: {
        ocrResult,
        tables,
        checkboxes,
        documentType,
        readingOrderText,
      },
      nextStatus: 'extracting',
      confidence,
    };
  }

  private async documentToImages(buffer: Buffer, mimeType: string): Promise<Buffer[]> {
    if (mimeType === 'application/pdf') {
      return this.pdfToImages(buffer);
    }

    // Already an image
    return [buffer];
  }

  private async pdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    logger.debug('Processing PDF', { pageCount });

    // For each page, we need to render to image
    // pdf-lib doesn't support rendering, so we'll use a simplified approach
    // In production, you'd use pdf2pic, poppler, or similar

    // For now, we'll return the raw PDF buffer and handle it in OCR
    // Tesseract.js can handle PDFs directly
    const images: Buffer[] = [];

    // Try to use sharp to convert if it's a single-page PDF with embedded image
    try {
      // This is a simplified approach - in production use proper PDF rendering
      const image = await sharp(pdfBuffer, { pages: -1 })
        .png()
        .toBuffer();

      // If multi-page, sharp returns all pages
      // We need to split them
      const metadata = await sharp(pdfBuffer).metadata();

      if (metadata.pages && metadata.pages > 1) {
        // Extract each page separately
        for (let i = 0; i < Math.min(metadata.pages, 100); i++) {
          const pageImage = await sharp(pdfBuffer, { page: i })
            .png()
            .toBuffer();
          images.push(pageImage);
        }
      } else {
        images.push(image);
      }
    } catch {
      // If sharp can't handle it, return raw buffer
      // Tesseract will try to process it directly
      logger.warn('Could not convert PDF to images with sharp, using raw buffer');
      images.push(pdfBuffer);
    }

    return images;
  }

  private calculateParsingConfidence(
    ocrResult: OCRResult,
    classificationConfidence: number
  ): number {
    // Weight OCR confidence more heavily
    return this.calculateWeightedConfidence([
      { score: ocrResult.overallConfidence, weight: 0.7 },
      { score: classificationConfidence, weight: 0.3 },
    ]);
  }
}
