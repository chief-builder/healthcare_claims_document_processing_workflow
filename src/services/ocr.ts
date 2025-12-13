import { createWorker, Worker, RecognizeResult } from 'tesseract.js';
import sharp from 'sharp';
import { BoundingBox } from '../models/index.js';
import { logger } from '../utils/index.js';

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words: OCRWord[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  lines: OCRLine[];
  blockType: 'text' | 'table' | 'image';
}

export interface OCRPage {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRResult {
  pages: OCRPage[];
  fullText: string;
  overallConfidence: number;
}

export interface TableCell {
  row: number;
  column: number;
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface Table {
  rows: number;
  columns: number;
  cells: TableCell[];
  boundingBox: BoundingBox;
}

export interface Checkbox {
  checked: boolean;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface OCRServiceConfig {
  language?: string;
  preprocessImages?: boolean;
  fallbackThreshold?: number;
}

export class OCRService {
  private worker: Worker | null = null;
  private config: OCRServiceConfig;

  constructor(config: OCRServiceConfig = {}) {
    this.config = {
      language: config.language ?? 'eng',
      preprocessImages: config.preprocessImages ?? true,
      fallbackThreshold: config.fallbackThreshold ?? 0.85,
    };
  }

  async initialize(): Promise<void> {
    if (!this.worker) {
      this.worker = await createWorker(this.config.language);
      logger.info('OCR worker initialized', { language: this.config.language });
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      logger.info('OCR worker terminated');
    }
  }

  async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    if (!this.config.preprocessImages) {
      return imageBuffer;
    }

    try {
      // Apply preprocessing: grayscale, normalize, sharpen
      const processed = await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();

      logger.debug('Image preprocessed successfully');
      return processed;
    } catch (error) {
      logger.warn('Image preprocessing failed, using original', { error });
      return imageBuffer;
    }
  }

  async extractText(imageBuffer: Buffer): Promise<OCRResult> {
    await this.initialize();

    const processedImage = await this.preprocessImage(imageBuffer);
    const result = await this.worker!.recognize(processedImage);

    const page = this.parseRecognizeResult(result, 1);
    const overallConfidence = page.confidence / 100;

    // Check if we need fallback
    if (overallConfidence < this.config.fallbackThreshold!) {
      logger.info('Low confidence detected, attempting fallback OCR', {
        confidence: overallConfidence,
        threshold: this.config.fallbackThreshold,
      });
      return this.fallbackExtraction(imageBuffer);
    }

    return {
      pages: [page],
      fullText: page.text,
      overallConfidence,
    };
  }

  async extractMultiPage(imageBuffers: Buffer[]): Promise<OCRResult> {
    await this.initialize();

    const pages: OCRPage[] = [];
    let fullText = '';
    let totalConfidence = 0;

    for (let i = 0; i < imageBuffers.length; i++) {
      const processedImage = await this.preprocessImage(imageBuffers[i]);
      const result = await this.worker!.recognize(processedImage);

      const page = this.parseRecognizeResult(result, i + 1);
      pages.push(page);
      fullText += (i > 0 ? '\n\n--- PAGE BREAK ---\n\n' : '') + page.text;
      totalConfidence += page.confidence;
    }

    const overallConfidence = (totalConfidence / pages.length) / 100;

    return {
      pages,
      fullText,
      overallConfidence,
    };
  }

  private parseRecognizeResult(result: RecognizeResult, pageNumber: number): OCRPage {
    const { data } = result;
    const blocks: OCRBlock[] = [];

    if (data.blocks) {
      for (const block of data.blocks) {
        const lines: OCRLine[] = [];

        if (block.paragraphs) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.lines) {
              for (const line of paragraph.lines) {
                const words: OCRWord[] = [];

                if (line.words) {
                  for (const word of line.words) {
                    words.push({
                      text: word.text,
                      confidence: word.confidence / 100,
                      boundingBox: {
                        x: word.bbox.x0,
                        y: word.bbox.y0,
                        width: word.bbox.x1 - word.bbox.x0,
                        height: word.bbox.y1 - word.bbox.y0,
                      },
                    });
                  }
                }

                lines.push({
                  text: line.text,
                  confidence: line.confidence / 100,
                  boundingBox: {
                    x: line.bbox.x0,
                    y: line.bbox.y0,
                    width: line.bbox.x1 - line.bbox.x0,
                    height: line.bbox.y1 - line.bbox.y0,
                  },
                  words,
                });
              }
            }
          }
        }

        blocks.push({
          text: block.text,
          confidence: block.confidence / 100,
          boundingBox: {
            x: block.bbox.x0,
            y: block.bbox.y0,
            width: block.bbox.x1 - block.bbox.x0,
            height: block.bbox.y1 - block.bbox.y0,
          },
          lines,
          blockType: 'text',
        });
      }
    }

    return {
      pageNumber,
      width: (data as unknown as Record<string, unknown>).imageWidth as number ?? 0,
      height: (data as unknown as Record<string, unknown>).imageHeight as number ?? 0,
      text: data.text,
      confidence: data.confidence,
      blocks,
    };
  }

  private async fallbackExtraction(imageBuffer: Buffer): Promise<OCRResult> {
    // Apply different preprocessing for fallback
    const enhancedImage = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .modulate({ brightness: 1.1 })
      .sharpen({ sigma: 2 })
      .threshold(128)
      .png()
      .toBuffer();

    const result = await this.worker!.recognize(enhancedImage);
    const page = this.parseRecognizeResult(result, 1);

    logger.info('Fallback OCR completed', {
      originalConfidence: page.confidence,
    });

    return {
      pages: [page],
      fullText: page.text,
      overallConfidence: page.confidence / 100,
    };
  }

  async detectTables(page: OCRPage): Promise<Table[]> {
    // Simple table detection based on alignment of text blocks
    const tables: Table[] = [];

    // Group blocks by approximate y-position (rows)
    const rowThreshold = 20; // pixels
    const rows = new Map<number, OCRBlock[]>();

    for (const block of page.blocks) {
      const rowKey = Math.round(block.boundingBox.y / rowThreshold) * rowThreshold;
      if (!rows.has(rowKey)) {
        rows.set(rowKey, []);
      }
      rows.get(rowKey)!.push(block);
    }

    // Find rows with multiple aligned columns (potential table)
    const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);

    let tableStartRow = -1;
    let tableRows: OCRBlock[][] = [];

    for (let i = 0; i < sortedRows.length; i++) {
      const [, rowBlocks] = sortedRows[i];

      // Consider it a table row if it has 2+ aligned items
      if (rowBlocks.length >= 2) {
        if (tableStartRow === -1) {
          tableStartRow = i;
        }
        tableRows.push(rowBlocks);
      } else if (tableRows.length >= 2) {
        // End of table
        tables.push(this.createTableFromRows(tableRows));
        tableRows = [];
        tableStartRow = -1;
      }
    }

    // Handle table at end of page
    if (tableRows.length >= 2) {
      tables.push(this.createTableFromRows(tableRows));
    }

    return tables;
  }

  private createTableFromRows(tableRows: OCRBlock[][]): Table {
    const cells: TableCell[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = 0,
      maxY = 0;

    // Determine column positions
    const allBlocks = tableRows.flat();
    const columnPositions = this.detectColumnPositions(allBlocks);
    const numColumns = columnPositions.length;

    for (let rowIdx = 0; rowIdx < tableRows.length; rowIdx++) {
      const rowBlocks = tableRows[rowIdx];

      for (const block of rowBlocks) {
        // Find which column this block belongs to
        const colIdx = this.findColumnIndex(block.boundingBox.x, columnPositions);

        cells.push({
          row: rowIdx,
          column: colIdx,
          text: block.text.trim(),
          confidence: block.confidence,
          boundingBox: block.boundingBox,
        });

        // Update table bounds
        minX = Math.min(minX, block.boundingBox.x);
        minY = Math.min(minY, block.boundingBox.y);
        maxX = Math.max(maxX, block.boundingBox.x + block.boundingBox.width);
        maxY = Math.max(maxY, block.boundingBox.y + block.boundingBox.height);
      }
    }

    return {
      rows: tableRows.length,
      columns: numColumns,
      cells,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }

  private detectColumnPositions(blocks: OCRBlock[]): number[] {
    // Cluster x positions to find columns
    const xPositions = blocks.map((b) => b.boundingBox.x).sort((a, b) => a - b);
    const columnThreshold = 50;
    const columns: number[] = [];

    for (const x of xPositions) {
      if (columns.length === 0 || x - columns[columns.length - 1] > columnThreshold) {
        columns.push(x);
      }
    }

    return columns;
  }

  private findColumnIndex(x: number, columnPositions: number[]): number {
    for (let i = columnPositions.length - 1; i >= 0; i--) {
      if (x >= columnPositions[i] - 25) {
        return i;
      }
    }
    return 0;
  }

  async detectCheckboxes(_imageBuffer: Buffer, blocks: OCRBlock[]): Promise<Checkbox[]> {
    // Simple checkbox detection based on common patterns
    const checkboxes: Checkbox[] = [];

    // Look for common checkbox text patterns
    const checkboxPatterns = [/^\[x\]$/i, /^\[ \]$/, /^☑$/, /^☐$/, /^✓$/, /^✗$/];

    for (const block of blocks) {
      for (const line of block.lines) {
        for (const word of line.words) {
          const text = word.text.trim();

          for (const pattern of checkboxPatterns) {
            if (pattern.test(text)) {
              const isChecked =
                /^\[x\]$/i.test(text) || text === '☑' || text === '✓';

              checkboxes.push({
                checked: isChecked,
                confidence: word.confidence,
                boundingBox: word.boundingBox,
              });
              break;
            }
          }
        }
      }
    }

    return checkboxes;
  }

  async extractRegion(
    imageBuffer: Buffer,
    boundingBox: BoundingBox
  ): Promise<{ text: string; confidence: number }> {
    await this.initialize();

    // Crop the region from the image
    const croppedImage = await sharp(imageBuffer)
      .extract({
        left: Math.round(boundingBox.x),
        top: Math.round(boundingBox.y),
        width: Math.round(boundingBox.width),
        height: Math.round(boundingBox.height),
      })
      .png()
      .toBuffer();

    const processedImage = await this.preprocessImage(croppedImage);
    const result = await this.worker!.recognize(processedImage);

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence / 100,
    };
  }

  reconstructReadingOrder(blocks: OCRBlock[]): OCRBlock[] {
    // Sort blocks by position: top-to-bottom, left-to-right
    // Handle multi-column layouts by detecting column boundaries

    // First, detect if this is a multi-column layout
    const columnBoundaries = this.detectColumnBoundaries(blocks);

    if (columnBoundaries.length <= 1) {
      // Single column - simple top-to-bottom ordering
      return [...blocks].sort((a, b) => {
        const yDiff = a.boundingBox.y - b.boundingBox.y;
        if (Math.abs(yDiff) > 10) return yDiff;
        return a.boundingBox.x - b.boundingBox.x;
      });
    }

    // Multi-column layout
    const columns: OCRBlock[][] = columnBoundaries.map(() => []);

    for (const block of blocks) {
      const colIdx = this.findColumnIndex(block.boundingBox.x, columnBoundaries);
      columns[colIdx].push(block);
    }

    // Sort each column by y position
    for (const column of columns) {
      column.sort((a, b) => a.boundingBox.y - b.boundingBox.y);
    }

    // Flatten columns (read left-to-right, column by column)
    return columns.flat();
  }

  private detectColumnBoundaries(blocks: OCRBlock[]): number[] {
    if (blocks.length < 2) return [0];

    // Cluster left edges of blocks
    const leftEdges = blocks.map((b) => b.boundingBox.x).sort((a, b) => a - b);
    const gaps: { position: number; size: number }[] = [];

    for (let i = 1; i < leftEdges.length; i++) {
      const gap = leftEdges[i] - leftEdges[i - 1];
      if (gap > 100) {
        // Significant gap indicates column boundary
        gaps.push({ position: (leftEdges[i] + leftEdges[i - 1]) / 2, size: gap });
      }
    }

    // Return column start positions
    const boundaries = [0];
    for (const gap of gaps) {
      boundaries.push(gap.position);
    }

    return boundaries;
  }
}

// Singleton instance
let ocrServiceInstance: OCRService | null = null;

export function getOCRService(config?: OCRServiceConfig): OCRService {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new OCRService(config);
  }
  return ocrServiceInstance;
}

export async function shutdownOCRService(): Promise<void> {
  if (ocrServiceInstance) {
    await ocrServiceInstance.terminate();
    ocrServiceInstance = null;
  }
}
