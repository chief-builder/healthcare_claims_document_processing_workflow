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

export {
  LLMService,
  getLLMService,
} from './llm.js';

export type {
  FieldInference,
  CorrectionResult,
  ExtractionContext,
} from './llm.js';

export {
  StorageService,
  getStorageService,
} from './storage.js';

export type {
  DocumentMetadata,
  StoredDocument,
} from './storage.js';

export {
  QueueService,
  getQueueService,
} from './queue.js';

export type {
  ReviewQueueItem,
  ReviewDecision,
  PaginationOptions,
} from './queue.js';
