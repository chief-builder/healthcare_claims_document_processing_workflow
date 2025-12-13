// OCR Service
export {
  OCRService,
  getOCRService,
  shutdownOCRService,
} from './ocr.js';

export type {
  OCRWord,
  OCRLine,
  OCRBlock,
  OCRPage,
  OCRResult,
  TableCell,
  Table,
  Checkbox,
  OCRServiceConfig,
} from './ocr.js';

// LLM Service
export {
  LLMService,
  getLLMService,
} from './llm.js';

export type {
  FieldInference,
  CorrectionResult,
  ExtractionContext,
} from './llm.js';

// Storage Service
export {
  StorageService,
  getStorageService,
} from './storage.js';

export type {
  DocumentMetadata,
  StoredDocument,
} from './storage.js';

// Queue Service
export {
  QueueService,
  getQueueService,
} from './queue.js';

export type {
  ReviewQueueItem,
  ReviewDecision,
  PaginationOptions,
} from './queue.js';

// Quality Service (LLM-as-Judge)
export {
  QualityService,
  getQualityService,
} from './quality.js';

export type {
  QualityDimension,
  ExtractionQualityScore,
  JudgementRequest,
  ComparisonJudgement,
} from './quality.js';

// Feedback Service (Continuous Learning)
export {
  FeedbackService,
  getFeedbackService,
} from './feedback.js';

export type {
  FieldCorrection,
  FeedbackRecord,
  LearningInsight,
  ExtractionPattern,
  FeedbackStats,
} from './feedback.js';

// Enrichment Service (Normalization)
export {
  EnrichmentService,
  getEnrichmentService,
  AddressNormalizer,
  DateNormalizer,
  PhoneNormalizer,
  CurrencyNormalizer,
  CodeNormalizer,
  ExternalEnrichment,
} from './enrichment.js';

export type {
  NormalizationResult,
  AddressValidation,
  PhoneValidation,
  NPILookupResult,
  EnrichmentResult,
} from './enrichment.js';

// Embeddings Service
export {
  EmbeddingsService,
  getEmbeddingsService,
} from './embeddings.js';

export type {
  EmbeddingResult,
  ChunkingOptions,
  TextChunk,
  EmbeddedChunk,
} from './embeddings.js';

// Vector Store
export {
  VectorStore,
  getVectorStore,
} from './vectorstore.js';

export type {
  VectorDocument,
  SearchResult,
  SearchOptions,
  VectorStoreStats,
} from './vectorstore.js';

// RAG Service
export {
  RAGService,
  getRAGService,
} from './rag.js';

export type {
  RAGQuery,
  RAGResponse,
  DocumentSummary,
  ClaimComparison,
} from './rag.js';

// Vision Service (Multimodal LLM)
export {
  VisionService,
  getVisionService,
} from './vision.js';

export type {
  VisionExtractionResult,
  LayoutAnalysis,
  PageRegion,
  DetectedElement,
  TableExtraction,
  ChartExtraction,
  FormFieldExtraction,
  VisionComparisonResult,
} from './vision.js';
