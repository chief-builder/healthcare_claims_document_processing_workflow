import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/index.js';

/**
 * Embeddings Service
 *
 * Generates vector embeddings for text chunks using various strategies.
 * Supports local embeddings (for development) and can be extended for
 * external embedding APIs.
 */

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface ChunkingOptions {
  strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic';
  maxChunkSize: number;
  overlap: number;
  preserveStructure: boolean;
}

export interface TextChunk {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  metadata: {
    page?: number;
    section?: string;
    type?: 'header' | 'paragraph' | 'table' | 'list';
    [key: string]: unknown;
  };
}

export interface EmbeddedChunk extends TextChunk {
  embedding: number[];
  embeddingModel: string;
}

// Simple local embedding using character/word frequency (for development)
// In production, use OpenAI, Cohere, or sentence-transformers
class LocalEmbedding {
  private dimensions: number;

  constructor(dimensions: number = 384) {
    this.dimensions = dimensions;
  }

  embed(text: string): number[] {
    const normalized = text.toLowerCase();
    const embedding = new Array(this.dimensions).fill(0);

    // Character frequency features (first 128 dims)
    for (let i = 0; i < Math.min(normalized.length, 1000); i++) {
      const charCode = normalized.charCodeAt(i);
      if (charCode < 128) {
        embedding[charCode % 128] += 1;
      }
    }

    // Word-level features (next 128 dims)
    const words = normalized.split(/\s+/);
    for (const word of words) {
      const hash = this.simpleHash(word);
      embedding[128 + (hash % 128)] += 1;
    }

    // N-gram features (next 128 dims)
    for (let i = 0; i < normalized.length - 2; i++) {
      const trigram = normalized.substring(i, i + 3);
      const hash = this.simpleHash(trigram);
      embedding[256 + (hash % 128)] += 1;
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export class EmbeddingsService {
  private localEmbedding: LocalEmbedding;
  private client: Anthropic;
  private model: string;
  private embeddingModel: string;

  constructor() {
    const config = getConfig();
    this.localEmbedding = new LocalEmbedding(384);
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
    this.embeddingModel = 'local-384'; // Or 'openai-ada-002', 'cohere-embed', etc.
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // Use local embedding for development
    // In production, call external API
    const embedding = this.localEmbedding.embed(text);

    return {
      text: text.substring(0, 100), // Truncate for storage
      embedding,
      model: this.embeddingModel,
      dimensions: embedding.length,
    };
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      results.push(await this.embed(text));
    }

    return results;
  }

  /**
   * Chunk text using specified strategy
   */
  chunkText(text: string, options: Partial<ChunkingOptions> = {}): TextChunk[] {
    const opts: ChunkingOptions = {
      strategy: options.strategy ?? 'paragraph',
      maxChunkSize: options.maxChunkSize ?? 500,
      overlap: options.overlap ?? 50,
      preserveStructure: options.preserveStructure ?? true,
    };

    switch (opts.strategy) {
      case 'fixed':
        return this.fixedChunking(text, opts);
      case 'sentence':
        return this.sentenceChunking(text, opts);
      case 'paragraph':
        return this.paragraphChunking(text, opts);
      case 'semantic':
        return this.semanticChunking(text, opts);
      default:
        return this.paragraphChunking(text, opts);
    }
  }

  /**
   * Chunk and embed text in one operation
   */
  async chunkAndEmbed(
    text: string,
    options: Partial<ChunkingOptions> = {},
    metadata: Record<string, unknown> = {}
  ): Promise<EmbeddedChunk[]> {
    const chunks = this.chunkText(text, options);
    const embeddedChunks: EmbeddedChunk[] = [];

    for (const chunk of chunks) {
      const embedding = await this.embed(chunk.text);
      embeddedChunks.push({
        ...chunk,
        metadata: { ...chunk.metadata, ...metadata },
        embedding: embedding.embedding,
        embeddingModel: embedding.model,
      });
    }

    logger.info('Text chunked and embedded', {
      totalChunks: embeddedChunks.length,
      strategy: options.strategy ?? 'paragraph',
    });

    return embeddedChunks;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // Chunking strategies

  private fixedChunking(text: string, options: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = [];
    let startOffset = 0;
    let chunkIndex = 0;

    while (startOffset < text.length) {
      const endOffset = Math.min(startOffset + options.maxChunkSize, text.length);
      let chunkText = text.substring(startOffset, endOffset);

      // Try to break at word boundary
      if (endOffset < text.length) {
        const lastSpace = chunkText.lastIndexOf(' ');
        if (lastSpace > options.maxChunkSize * 0.8) {
          chunkText = chunkText.substring(0, lastSpace);
        }
      }

      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText.trim(),
        startOffset,
        endOffset: startOffset + chunkText.length,
        metadata: { type: 'paragraph' },
      });

      startOffset += chunkText.length - options.overlap;
      chunkIndex++;
    }

    return chunks;
  }

  private sentenceChunking(text: string, options: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = [];

    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];

    let currentChunk = '';
    let startOffset = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > options.maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: currentChunk.trim(),
          startOffset,
          endOffset: startOffset + currentChunk.length,
          metadata: { type: 'paragraph' },
        });

        startOffset += currentChunk.length;
        currentChunk = options.overlap > 0 ? currentChunk.slice(-options.overlap) : '';
        chunkIndex++;
      }

      currentChunk += sentence;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        startOffset,
        endOffset: startOffset + currentChunk.length,
        metadata: { type: 'paragraph' },
      });
    }

    return chunks;
  }

  private paragraphChunking(text: string, options: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = [];

    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = '';
    let startOffset = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmedPara = paragraph.trim();
      if (!trimmedPara) continue;

      // If paragraph alone is too long, use sentence chunking
      if (trimmedPara.length > options.maxChunkSize) {
        if (currentChunk.length > 0) {
          chunks.push({
            id: `chunk_${chunkIndex}`,
            text: currentChunk.trim(),
            startOffset,
            endOffset: startOffset + currentChunk.length,
            metadata: { type: 'paragraph' },
          });
          startOffset += currentChunk.length;
          currentChunk = '';
          chunkIndex++;
        }

        const subChunks = this.sentenceChunking(trimmedPara, options);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            id: `chunk_${chunkIndex}`,
            startOffset: startOffset + subChunk.startOffset,
            endOffset: startOffset + subChunk.endOffset,
          });
          chunkIndex++;
        }
        startOffset += trimmedPara.length;
        continue;
      }

      if (currentChunk.length + trimmedPara.length + 2 > options.maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: currentChunk.trim(),
          startOffset,
          endOffset: startOffset + currentChunk.length,
          metadata: { type: 'paragraph' },
        });

        startOffset += currentChunk.length;
        currentChunk = '';
        chunkIndex++;
      }

      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        startOffset,
        endOffset: startOffset + currentChunk.length,
        metadata: { type: 'paragraph' },
      });
    }

    return chunks;
  }

  private semanticChunking(text: string, options: ChunkingOptions): TextChunk[] {
    // Semantic chunking tries to keep related content together
    // by detecting topic shifts using simple heuristics

    const chunks: TextChunk[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];

    let currentChunk: string[] = [];
    let currentTopicWords = new Set<string>();
    let startOffset = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const words = this.extractKeywords(sentence);
      const overlap = this.calculateWordOverlap(currentTopicWords, words);

      // If topic shift detected (low overlap) or chunk too long
      const currentLength = currentChunk.join(' ').length;
      const isTopicShift = currentTopicWords.size > 0 && overlap < 0.2;
      const isTooLong = currentLength + sentence.length > options.maxChunkSize;

      if ((isTopicShift || isTooLong) && currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: chunkText.trim(),
          startOffset,
          endOffset: startOffset + chunkText.length,
          metadata: { type: 'paragraph', topicShift: isTopicShift },
        });

        startOffset += chunkText.length + 1;
        currentChunk = [];
        currentTopicWords = new Set();
        chunkIndex++;
      }

      currentChunk.push(sentence);
      words.forEach((w) => currentTopicWords.add(w));
    }

    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText.trim(),
        startOffset,
        endOffset: startOffset + chunkText.length,
        metadata: { type: 'paragraph' },
      });
    }

    return chunks;
  }

  private extractKeywords(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
      'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this',
      'that', 'these', 'those', 'what', 'which', 'who', 'whom',
    ]);

    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
    return new Set(words.filter((w) => !stopWords.has(w)));
  }

  private calculateWordOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;

    let overlap = 0;
    for (const word of set2) {
      if (set1.has(word)) overlap++;
    }

    return overlap / Math.max(set1.size, set2.size);
  }
}

// Singleton instance
let embeddingsServiceInstance: EmbeddingsService | null = null;

export function getEmbeddingsService(): EmbeddingsService {
  if (!embeddingsServiceInstance) {
    embeddingsServiceInstance = new EmbeddingsService();
  }
  return embeddingsServiceInstance;
}
