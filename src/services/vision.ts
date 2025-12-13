import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { getConfig } from '../config/index.js';
import {
  DocumentType,
  ExtractedClaim,
  Patient,
  Provider,
  Diagnosis,
  ServiceLine,
  ClaimTotals,
  BoundingBox,
} from '../models/index.js';
import { logger } from '../utils/index.js';

/**
 * Vision LLM Service
 *
 * Uses multimodal LLMs (Claude 3+ with vision) to directly process
 * document images for extraction, bypassing traditional OCR for
 * complex layouts, charts, and handwritten text.
 */

export interface VisionExtractionResult {
  extractedClaim: Partial<ExtractedClaim>;
  confidenceScores: Record<string, number>;
  layoutAnalysis: LayoutAnalysis;
  detectedElements: DetectedElement[];
}

export interface LayoutAnalysis {
  pageCount: number;
  documentType: DocumentType;
  hasHandwriting: boolean;
  hasTables: boolean;
  hasCharts: boolean;
  hasImages: boolean;
  quality: 'high' | 'medium' | 'low';
  orientation: 'portrait' | 'landscape';
  regions: PageRegion[];
}

export interface PageRegion {
  type: 'header' | 'body' | 'table' | 'form_field' | 'signature' | 'stamp' | 'image' | 'chart';
  page: number;
  boundingBox: BoundingBox;
  confidence: number;
  content?: string;
}

export interface DetectedElement {
  type: 'table' | 'chart' | 'checkbox' | 'signature' | 'handwriting' | 'stamp' | 'barcode' | 'logo';
  page: number;
  boundingBox: BoundingBox;
  content: unknown;
  confidence: number;
}

export interface TableExtraction {
  headers: string[];
  rows: string[][];
  markdown: string;
  html: string;
  confidence: number;
}

export interface ChartExtraction {
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'other';
  title?: string;
  data: Array<{ label: string; value: number | string }>;
  description: string;
  mermaid?: string;
  confidence: number;
}

export interface FormFieldExtraction {
  fields: Array<{
    label: string;
    value: string;
    type: 'text' | 'checkbox' | 'date' | 'number' | 'signature';
    confidence: number;
    boundingBox?: BoundingBox;
  }>;
}

export interface VisionComparisonResult {
  matches: boolean;
  discrepancies: Array<{
    field: string;
    ocrValue: string;
    visionValue: string;
    recommendation: 'use_ocr' | 'use_vision' | 'manual_review';
  }>;
  overallConfidence: number;
}

export class VisionService {
  private client: Anthropic;
  private model: string;
  private maxImageSize = 5 * 1024 * 1024; // 5MB for Claude vision

  constructor() {
    const config = getConfig();
    this.client = new Anthropic({
      authToken: config.anthropic.apiKey,
    });
    // Use Claude 3.5 Sonnet for vision tasks
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Analyze document layout using vision
   */
  async analyzeLayout(imageBuffer: Buffer): Promise<LayoutAnalysis> {
    const base64Image = await this.prepareImage(imageBuffer);

    const prompt = `Analyze this healthcare document image and describe its layout.

Identify:
1. Document type (CMS-1500, UB-04, EOB, or other)
2. Whether it contains handwritten text
3. Whether it contains tables
4. Whether it contains charts/graphs
5. Whether it contains embedded images
6. Image quality (high/medium/low)
7. Orientation (portrait/landscape)
8. Key regions and their types

Respond in JSON:
{
  "documentType": "cms_1500" | "ub_04" | "eob" | "unknown",
  "hasHandwriting": boolean,
  "hasTables": boolean,
  "hasCharts": boolean,
  "hasImages": boolean,
  "quality": "high" | "medium" | "low",
  "orientation": "portrait" | "landscape",
  "regions": [
    {
      "type": "header" | "body" | "table" | "form_field" | "signature" | "stamp" | "image" | "chart",
      "description": "brief description",
      "approximateLocation": "top-left" | "top-center" | "top-right" | "middle-left" | "center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right"
    }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));

      // Convert regions to PageRegion format
      const regions: PageRegion[] = (parsed.regions ?? []).map((r: { type: string; approximateLocation: string }) => ({
        type: r.type as PageRegion['type'],
        page: 1,
        boundingBox: this.locationToBoundingBox(r.approximateLocation),
        confidence: 0.8,
      }));

      return {
        pageCount: 1,
        documentType: parsed.documentType as DocumentType,
        hasHandwriting: parsed.hasHandwriting ?? false,
        hasTables: parsed.hasTables ?? false,
        hasCharts: parsed.hasCharts ?? false,
        hasImages: parsed.hasImages ?? false,
        quality: parsed.quality ?? 'medium',
        orientation: parsed.orientation ?? 'portrait',
        regions,
      };
    } catch (error) {
      logger.error('Vision layout analysis failed', { error });
      return {
        pageCount: 1,
        documentType: 'unknown',
        hasHandwriting: false,
        hasTables: false,
        hasCharts: false,
        hasImages: false,
        quality: 'medium',
        orientation: 'portrait',
        regions: [],
      };
    }
  }

  /**
   * Extract claim data directly from document image
   */
  async extractFromImage(imageBuffer: Buffer, documentType?: DocumentType): Promise<VisionExtractionResult> {
    const base64Image = await this.prepareImage(imageBuffer);

    // First analyze layout
    const layoutAnalysis = await this.analyzeLayout(imageBuffer);
    const detectedType = documentType ?? layoutAnalysis.documentType;

    const prompt = this.buildExtractionPrompt(detectedType);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));
      const { claim, confidenceScores } = this.parseExtractionResponse(parsed);

      // Detect special elements
      const detectedElements = await this.detectElements(imageBuffer, layoutAnalysis);

      return {
        extractedClaim: {
          ...claim,
          documentType: detectedType,
        },
        confidenceScores,
        layoutAnalysis,
        detectedElements,
      };
    } catch (error) {
      logger.error('Vision extraction failed', { error });
      throw error;
    }
  }

  /**
   * Extract table from image
   */
  async extractTable(imageBuffer: Buffer, region?: BoundingBox): Promise<TableExtraction> {
    let processedImage = imageBuffer;

    // Crop to region if specified
    if (region) {
      processedImage = await sharp(imageBuffer)
        .extract({
          left: Math.round(region.x),
          top: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        })
        .toBuffer();
    }

    const base64Image = await this.prepareImage(processedImage);

    const prompt = `Extract the table from this image.

Provide:
1. Column headers
2. All row data
3. Markdown representation
4. HTML representation

Respond in JSON:
{
  "headers": ["col1", "col2", ...],
  "rows": [
    ["val1", "val2", ...],
    ...
  ],
  "confidence": 0.0-1.0
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));

      // Generate markdown
      const headers = parsed.headers as string[];
      const rows = parsed.rows as string[][];

      const markdown = this.tableToMarkdown(headers, rows);
      const html = this.tableToHTML(headers, rows);

      return {
        headers,
        rows,
        markdown,
        html,
        confidence: parsed.confidence ?? 0.85,
      };
    } catch (error) {
      logger.error('Vision table extraction failed', { error });
      return {
        headers: [],
        rows: [],
        markdown: '',
        html: '',
        confidence: 0,
      };
    }
  }

  /**
   * Extract chart/graph data from image
   */
  async extractChart(imageBuffer: Buffer, region?: BoundingBox): Promise<ChartExtraction> {
    let processedImage = imageBuffer;

    if (region) {
      processedImage = await sharp(imageBuffer)
        .extract({
          left: Math.round(region.x),
          top: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        })
        .toBuffer();
    }

    const base64Image = await this.prepareImage(processedImage);

    const prompt = `Analyze this chart/graph image.

Extract:
1. Chart type (bar, line, pie, scatter, other)
2. Title (if visible)
3. Data points with labels and values
4. Description of what the chart shows

If possible, provide a Mermaid diagram representation.

Respond in JSON:
{
  "chartType": "bar" | "line" | "pie" | "scatter" | "other",
  "title": "chart title or null",
  "data": [
    { "label": "label", "value": "numeric or string value" }
  ],
  "description": "what the chart shows",
  "mermaid": "mermaid diagram code or null",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));

      return {
        chartType: parsed.chartType ?? 'other',
        title: parsed.title,
        data: parsed.data ?? [],
        description: parsed.description ?? 'Unable to describe chart',
        mermaid: parsed.mermaid,
        confidence: parsed.confidence ?? 0.7,
      };
    } catch (error) {
      logger.error('Vision chart extraction failed', { error });
      return {
        chartType: 'other',
        data: [],
        description: 'Extraction failed',
        confidence: 0,
      };
    }
  }

  /**
   * Extract form fields from image
   */
  async extractFormFields(imageBuffer: Buffer): Promise<FormFieldExtraction> {
    const base64Image = await this.prepareImage(imageBuffer);

    const prompt = `Extract all form fields from this healthcare document image.

For each field, identify:
1. The label/name of the field
2. The value filled in (or empty if blank)
3. The type of field (text, checkbox, date, number, signature)
4. Your confidence in the extraction

Respond in JSON:
{
  "fields": [
    {
      "label": "field label",
      "value": "extracted value",
      "type": "text" | "checkbox" | "date" | "number" | "signature",
      "confidence": 0.0-1.0
    }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));

      return {
        fields: parsed.fields ?? [],
      };
    } catch (error) {
      logger.error('Vision form field extraction failed', { error });
      return { fields: [] };
    }
  }

  /**
   * Compare vision extraction with OCR extraction
   */
  async compareWithOCR(
    imageBuffer: Buffer,
    ocrExtraction: Partial<ExtractedClaim>
  ): Promise<VisionComparisonResult> {
    const visionResult = await this.extractFromImage(imageBuffer);
    const visionExtraction = visionResult.extractedClaim;

    const discrepancies: VisionComparisonResult['discrepancies'] = [];

    // Compare key fields
    const fieldsToCompare = [
      { path: 'patient.memberId', label: 'Member ID' },
      { path: 'patient.firstName', label: 'Patient First Name' },
      { path: 'patient.lastName', label: 'Patient Last Name' },
      { path: 'patient.dateOfBirth', label: 'Date of Birth' },
      { path: 'provider.npi', label: 'Provider NPI' },
      { path: 'provider.name', label: 'Provider Name' },
      { path: 'totals.totalCharges', label: 'Total Charges' },
    ];

    for (const { path, label } of fieldsToCompare) {
      const ocrValue = String(this.getNestedValue(ocrExtraction, path) ?? '');
      const visionValue = String(this.getNestedValue(visionExtraction, path) ?? '');

      if (ocrValue !== visionValue && (ocrValue || visionValue)) {
        const ocrConf = ocrExtraction.confidenceScores?.[path] ?? 0;
        const visionConf = visionResult.confidenceScores[path] ?? 0;

        let recommendation: 'use_ocr' | 'use_vision' | 'manual_review';
        if (Math.abs(ocrConf - visionConf) < 0.1) {
          recommendation = 'manual_review';
        } else if (ocrConf > visionConf) {
          recommendation = 'use_ocr';
        } else {
          recommendation = 'use_vision';
        }

        discrepancies.push({
          field: label,
          ocrValue,
          visionValue,
          recommendation,
        });
      }
    }

    return {
      matches: discrepancies.length === 0,
      discrepancies,
      overallConfidence: discrepancies.length === 0 ? 0.95 : 0.7,
    };
  }

  /**
   * Extract handwritten text from image region
   */
  async extractHandwriting(imageBuffer: Buffer, region?: BoundingBox): Promise<{
    text: string;
    confidence: number;
    words: Array<{ text: string; confidence: number }>;
  }> {
    let processedImage = imageBuffer;

    if (region) {
      processedImage = await sharp(imageBuffer)
        .extract({
          left: Math.round(region.x),
          top: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        })
        .toBuffer();
    }

    const base64Image = await this.prepareImage(processedImage);

    const prompt = `Read the handwritten text in this image.

Provide:
1. Full text transcription
2. Individual words with confidence scores

Be careful with healthcare-specific terms (diagnoses, medications, etc.)

Respond in JSON:
{
  "text": "full transcription",
  "confidence": 0.0-1.0,
  "words": [
    { "text": "word", "confidence": 0.0-1.0 }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(this.extractJSON(content.text));

      return {
        text: parsed.text ?? '',
        confidence: parsed.confidence ?? 0.6,
        words: parsed.words ?? [],
      };
    } catch (error) {
      logger.error('Handwriting extraction failed', { error });
      return {
        text: '',
        confidence: 0,
        words: [],
      };
    }
  }

  // Private helper methods

  private async prepareImage(buffer: Buffer): Promise<string> {
    // Resize if too large
    const metadata = await sharp(buffer).metadata();
    let processedBuffer = buffer;

    if (buffer.length > this.maxImageSize) {
      // Resize to reduce file size
      const scale = Math.sqrt(this.maxImageSize / buffer.length);
      processedBuffer = await sharp(buffer)
        .resize({
          width: Math.round((metadata.width ?? 1000) * scale),
          height: Math.round((metadata.height ?? 1000) * scale),
          fit: 'inside',
        })
        .png({ quality: 80 })
        .toBuffer();
    }

    // Convert to PNG if not already
    if (metadata.format !== 'png') {
      processedBuffer = await sharp(processedBuffer).png().toBuffer();
    }

    return processedBuffer.toString('base64');
  }

  private buildExtractionPrompt(documentType: DocumentType): string {
    const basePrompt = `Extract all data from this ${documentType} healthcare claim document image.

For each field, provide the extracted value and a confidence score (0.0-1.0).

Extract:
1. Patient Information: member ID, name, DOB, gender, address
2. Provider Information: NPI, name, tax ID, specialty, address
3. Diagnoses: ICD-10 codes with descriptions
4. Service Lines: dates, procedure codes, modifiers, units, charges
5. Totals: total charges, amounts paid, patient responsibility

Important:
- Read the actual values from the document image
- Don't guess or hallucinate values not visible
- For unclear text, provide lower confidence scores
- Pay special attention to handwritten sections

Respond in JSON:
{
  "patient": {
    "memberId": { "value": string | null, "confidence": number },
    "firstName": { "value": string | null, "confidence": number },
    "lastName": { "value": string | null, "confidence": number },
    "dateOfBirth": { "value": "YYYY-MM-DD" | null, "confidence": number },
    "gender": { "value": "M" | "F" | "U" | null, "confidence": number }
  },
  "provider": {
    "npi": { "value": string | null, "confidence": number },
    "name": { "value": string | null, "confidence": number },
    "taxId": { "value": string | null, "confidence": number }
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
      "units": { "value": number, "confidence": number },
      "chargeAmount": { "value": number, "confidence": number }
    }
  ],
  "totals": {
    "totalCharges": { "value": number, "confidence": number },
    "amountPaid": { "value": number | null, "confidence": number }
  }
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

    const patientData = parsed.patient as Record<string, { value: unknown; confidence: number }> | undefined;
    const providerData = parsed.provider as Record<string, { value: unknown; confidence: number }> | undefined;
    const totalsData = parsed.totals as Record<string, { value: unknown; confidence: number }> | undefined;

    const patient: Patient = {
      memberId: extractValue(patientData?.memberId as { value: string; confidence: number }, 'patient.memberId') ?? '',
      firstName: extractValue(patientData?.firstName as { value: string; confidence: number }, 'patient.firstName') ?? '',
      lastName: extractValue(patientData?.lastName as { value: string; confidence: number }, 'patient.lastName') ?? '',
      dateOfBirth: extractValue(patientData?.dateOfBirth as { value: string; confidence: number }, 'patient.dateOfBirth') ?? '',
      gender: extractValue(patientData?.gender as { value: 'M' | 'F' | 'U'; confidence: number }, 'patient.gender'),
    };

    const provider: Provider = {
      npi: extractValue(providerData?.npi as { value: string; confidence: number }, 'provider.npi') ?? '',
      name: extractValue(providerData?.name as { value: string; confidence: number }, 'provider.name') ?? '',
      taxId: extractValue(providerData?.taxId as { value: string; confidence: number }, 'provider.taxId'),
    };

    const diagnosesData = parsed.diagnoses as Array<Record<string, { value: unknown; confidence: number }>> | undefined;
    const diagnoses: Diagnosis[] = (diagnosesData ?? []).map((d, i) => ({
      code: extractValue(d.code as { value: string; confidence: number }, `diagnoses.${i}.code`) ?? '',
      description: extractValue(d.description as { value: string; confidence: number }, `diagnoses.${i}.description`),
      isPrimary: extractValue(d.isPrimary as { value: boolean; confidence: number }, `diagnoses.${i}.isPrimary`) ?? (i === 0),
    }));

    const serviceLinesData = parsed.serviceLines as Array<Record<string, { value: unknown; confidence: number }>> | undefined;
    const serviceLines: ServiceLine[] = (serviceLinesData ?? []).map((sl, i) => ({
      lineNumber: extractValue(sl.lineNumber as { value: number; confidence: number }, `serviceLines.${i}.lineNumber`) ?? (i + 1),
      dateOfService: extractValue(sl.dateOfService as { value: string; confidence: number }, `serviceLines.${i}.dateOfService`) ?? '',
      procedureCode: extractValue(sl.procedureCode as { value: string; confidence: number }, `serviceLines.${i}.procedureCode`) ?? '',
      modifiers: extractValue(sl.modifiers as { value: string[]; confidence: number }, `serviceLines.${i}.modifiers`) ?? [],
      diagnosisPointers: [],
      units: extractValue(sl.units as { value: number; confidence: number }, `serviceLines.${i}.units`) ?? 1,
      chargeAmount: extractValue(sl.chargeAmount as { value: number; confidence: number }, `serviceLines.${i}.chargeAmount`) ?? 0,
    }));

    const totals: ClaimTotals = {
      totalCharges: extractValue(totalsData?.totalCharges as { value: number; confidence: number }, 'totals.totalCharges') ?? 0,
      amountPaid: extractValue(totalsData?.amountPaid as { value: number; confidence: number }, 'totals.amountPaid'),
    };

    return {
      claim: { patient, provider, diagnoses, serviceLines, totals },
      confidenceScores,
    };
  }

  private async detectElements(
    _imageBuffer: Buffer,
    layout: LayoutAnalysis
  ): Promise<DetectedElement[]> {
    const elements: DetectedElement[] = [];

    // Add detected elements based on layout analysis
    for (const region of layout.regions) {
      if (region.type === 'table') {
        elements.push({
          type: 'table',
          page: region.page,
          boundingBox: region.boundingBox,
          content: null,
          confidence: region.confidence,
        });
      } else if (region.type === 'chart') {
        elements.push({
          type: 'chart',
          page: region.page,
          boundingBox: region.boundingBox,
          content: null,
          confidence: region.confidence,
        });
      } else if (region.type === 'signature') {
        elements.push({
          type: 'signature',
          page: region.page,
          boundingBox: region.boundingBox,
          content: null,
          confidence: region.confidence,
        });
      }
    }

    return elements;
  }

  private locationToBoundingBox(location: string): BoundingBox {
    // Map approximate locations to bounding boxes (assuming 1000x1000 canvas)
    const mappings: Record<string, BoundingBox> = {
      'top-left': { x: 0, y: 0, width: 333, height: 333 },
      'top-center': { x: 333, y: 0, width: 334, height: 333 },
      'top-right': { x: 667, y: 0, width: 333, height: 333 },
      'middle-left': { x: 0, y: 333, width: 333, height: 334 },
      'center': { x: 333, y: 333, width: 334, height: 334 },
      'middle-right': { x: 667, y: 333, width: 333, height: 334 },
      'bottom-left': { x: 0, y: 667, width: 333, height: 333 },
      'bottom-center': { x: 333, y: 667, width: 334, height: 333 },
      'bottom-right': { x: 667, y: 667, width: 333, height: 333 },
    };

    return mappings[location] ?? { x: 0, y: 0, width: 1000, height: 1000 };
  }

  private tableToMarkdown(headers: string[], rows: string[][]): string {
    if (headers.length === 0) return '';

    const headerRow = `| ${headers.join(' | ')} |`;
    const separator = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');

    return `${headerRow}\n${separator}\n${dataRows}`;
  }

  private tableToHTML(headers: string[], rows: string[][]): string {
    if (headers.length === 0) return '';

    const headerCells = headers.map((h) => `<th>${h}</th>`).join('');
    const headerRow = `<tr>${headerCells}</tr>`;

    const dataRows = rows
      .map((row) => {
        const cells = row.map((cell) => `<td>${cell}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('\n');

    return `<table>\n<thead>${headerRow}</thead>\n<tbody>\n${dataRows}\n</tbody>\n</table>`;
  }

  private getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
    if (!obj) return undefined;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private extractJSON(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response');
  }
}

// Singleton instance
let visionServiceInstance: VisionService | null = null;

export function getVisionService(): VisionService {
  if (!visionServiceInstance) {
    visionServiceInstance = new VisionService();
  }
  return visionServiceInstance;
}
