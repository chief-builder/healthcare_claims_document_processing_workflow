import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../config/index.js';
import { EmbeddedChunk, getEmbeddingsService } from './embeddings.js';
import { logger } from '../utils/index.js';

/**
 * Vector Store Service
 *
 * A simple file-based vector store for development.
 * In production, use FAISS, Pinecone, Chroma, Weaviate, or Qdrant.
 */

export interface VectorDocument {
  id: string;
  documentId: string;
  claimId?: string;
  chunks: EmbeddedChunk[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  chunk: EmbeddedChunk;
  documentId: string;
  claimId?: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  filter?: {
    documentId?: string;
    claimId?: string;
    documentType?: string;
    [key: string]: unknown;
  };
}

export interface VectorStoreStats {
  totalDocuments: number;
  totalChunks: number;
  avgChunksPerDocument: number;
  embeddingDimensions: number;
  storageSize: number;
}

export class VectorStore {
  private storePath: string;
  private indexPath: string;
  private documents: Map<string, VectorDocument> = new Map();
  private initialized = false;

  constructor() {
    const config = getConfig();
    this.storePath = path.join(config.storage.storagePath, 'vectorstore');
    this.indexPath = path.join(this.storePath, 'index.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(this.storePath, { recursive: true });
    await this.loadIndex();
    this.initialized = true;

    logger.info('Vector store initialized', {
      documentCount: this.documents.size,
    });
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(indexData) as { documentIds: string[] };

      for (const docId of index.documentIds) {
        const docPath = path.join(this.storePath, `${docId}.json`);
        try {
          const docData = await fs.readFile(docPath, 'utf-8');
          const doc = JSON.parse(docData) as VectorDocument;
          this.documents.set(docId, doc);
        } catch {
          logger.warn('Failed to load vector document', { docId });
        }
      }
    } catch {
      // No index yet
      this.documents = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const index = {
      documentIds: Array.from(this.documents.keys()),
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Add a document with its chunks to the store
   */
  async addDocument(
    documentId: string,
    chunks: EmbeddedChunk[],
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.initialize();

    const vectorDoc: VectorDocument = {
      id: `vec_${documentId}`,
      documentId,
      claimId: metadata.claimId as string | undefined,
      chunks,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.documents.set(vectorDoc.id, vectorDoc);

    // Persist to disk
    const docPath = path.join(this.storePath, `${vectorDoc.id}.json`);
    await fs.writeFile(docPath, JSON.stringify(vectorDoc, null, 2));
    await this.saveIndex();

    logger.info('Document added to vector store', {
      documentId,
      chunkCount: chunks.length,
    });
  }

  /**
   * Add chunks directly (for incremental updates)
   */
  async addChunks(
    documentId: string,
    newChunks: EmbeddedChunk[],
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.initialize();

    const existingId = `vec_${documentId}`;
    const existing = this.documents.get(existingId);

    if (existing) {
      existing.chunks.push(...newChunks);
      existing.updatedAt = new Date().toISOString();

      const docPath = path.join(this.storePath, `${existingId}.json`);
      await fs.writeFile(docPath, JSON.stringify(existing, null, 2));
    } else {
      await this.addDocument(documentId, newChunks, metadata);
    }
  }

  /**
   * Search for similar chunks
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize();

    const embeddingsService = getEmbeddingsService();
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.5;

    // Embed the query
    const queryEmbedding = await embeddingsService.embed(query);

    const results: SearchResult[] = [];

    // Search through all documents
    for (const doc of this.documents.values()) {
      // Apply filters
      if (options.filter) {
        if (options.filter.documentId && doc.documentId !== options.filter.documentId) continue;
        if (options.filter.claimId && doc.claimId !== options.filter.claimId) continue;
        if (options.filter.documentType && doc.metadata.documentType !== options.filter.documentType) continue;
      }

      // Score each chunk
      for (const chunk of doc.chunks) {
        const score = embeddingsService.cosineSimilarity(
          queryEmbedding.embedding,
          chunk.embedding
        );

        if (score >= minScore) {
          results.push({
            chunk,
            documentId: doc.documentId,
            claimId: doc.claimId,
            score,
            metadata: doc.metadata,
          });
        }
      }
    }

    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Search by embedding (pre-computed)
   */
  async searchByEmbedding(
    embedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    await this.initialize();

    const embeddingsService = getEmbeddingsService();
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.5;

    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      if (options.filter) {
        if (options.filter.documentId && doc.documentId !== options.filter.documentId) continue;
        if (options.filter.claimId && doc.claimId !== options.filter.claimId) continue;
      }

      for (const chunk of doc.chunks) {
        const score = embeddingsService.cosineSimilarity(embedding, chunk.embedding);

        if (score >= minScore) {
          results.push({
            chunk,
            documentId: doc.documentId,
            claimId: doc.claimId,
            score,
            metadata: doc.metadata,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Find similar documents
   */
  async findSimilarDocuments(
    documentId: string,
    topK: number = 5
  ): Promise<Array<{ documentId: string; score: number }>> {
    await this.initialize();

    const sourceDoc = this.documents.get(`vec_${documentId}`);
    if (!sourceDoc || sourceDoc.chunks.length === 0) {
      return [];
    }

    // Use the first chunk as representative
    const representativeEmbedding = sourceDoc.chunks[0].embedding;

    const scores = new Map<string, number[]>();

    for (const doc of this.documents.values()) {
      if (doc.documentId === documentId) continue;

      for (const chunk of doc.chunks) {
        const embeddingsService = getEmbeddingsService();
        const score = embeddingsService.cosineSimilarity(
          representativeEmbedding,
          chunk.embedding
        );

        const existing = scores.get(doc.documentId) ?? [];
        existing.push(score);
        scores.set(doc.documentId, existing);
      }
    }

    // Calculate average score per document
    const results: Array<{ documentId: string; score: number }> = [];
    for (const [docId, docScores] of scores) {
      const avgScore = docScores.reduce((a, b) => a + b, 0) / docScores.length;
      results.push({ documentId: docId, score: avgScore });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Delete a document from the store
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    await this.initialize();

    const id = `vec_${documentId}`;
    if (!this.documents.has(id)) {
      return false;
    }

    this.documents.delete(id);

    const docPath = path.join(this.storePath, `${id}.json`);
    try {
      await fs.unlink(docPath);
    } catch {
      // File might not exist
    }

    await this.saveIndex();

    logger.info('Document deleted from vector store', { documentId });
    return true;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<VectorDocument | null> {
    await this.initialize();
    return this.documents.get(`vec_${documentId}`) ?? null;
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<VectorStoreStats> {
    await this.initialize();

    let totalChunks = 0;
    let embeddingDimensions = 0;

    for (const doc of this.documents.values()) {
      totalChunks += doc.chunks.length;
      if (doc.chunks.length > 0 && embeddingDimensions === 0) {
        embeddingDimensions = doc.chunks[0].embedding.length;
      }
    }

    // Estimate storage size
    let storageSize = 0;
    try {
      const files = await fs.readdir(this.storePath);
      for (const file of files) {
        const stat = await fs.stat(path.join(this.storePath, file));
        storageSize += stat.size;
      }
    } catch {
      // Ignore
    }

    return {
      totalDocuments: this.documents.size,
      totalChunks,
      avgChunksPerDocument: this.documents.size > 0 ? totalChunks / this.documents.size : 0,
      embeddingDimensions,
      storageSize,
    };
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    await this.initialize();

    for (const id of this.documents.keys()) {
      const docPath = path.join(this.storePath, `${id}.json`);
      try {
        await fs.unlink(docPath);
      } catch {
        // Ignore
      }
    }

    this.documents.clear();
    await this.saveIndex();

    logger.warn('Vector store cleared');
  }
}

// Singleton instance
let vectorStoreInstance: VectorStore | null = null;

export async function getVectorStore(): Promise<VectorStore> {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
    await vectorStoreInstance.initialize();
  }
  return vectorStoreInstance;
}
