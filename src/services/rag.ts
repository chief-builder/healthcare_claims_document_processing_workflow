import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config/index.js';
import { ExtractedClaim } from '../models/index.js';
import { getEmbeddingsService, EmbeddingsService, ChunkingOptions } from './embeddings.js';
import { getVectorStore, VectorStore, SearchResult, SearchOptions } from './vectorstore.js';
import { logger } from '../utils/index.js';

/**
 * RAG (Retrieval Augmented Generation) Pipeline
 *
 * Combines vector search with LLM generation for document Q&A,
 * claim analysis, and context-aware responses.
 */

export interface RAGQuery {
  question: string;
  claimId?: string;
  documentId?: string;
  documentType?: string;
  maxChunks?: number;
  minRelevance?: number;
}

export interface RAGResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    text: string;
    documentId: string;
    claimId?: string;
    relevanceScore: number;
    page?: number;
  }>;
  reasoning?: string;
}

export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  documentType: string;
  pageCount: number;
  confidence: number;
}

export interface ClaimComparison {
  claimId1: string;
  claimId2: string;
  similarities: string[];
  differences: string[];
  recommendation: string;
}

export class RAGService {
  private client: Anthropic;
  private model: string;
  private embeddingsService: EmbeddingsService;
  private vectorStore: VectorStore | null = null;

  constructor() {
    const config = getConfig();
    this.client = new Anthropic({
      authToken: config.anthropic.apiKey,
    });
    this.model = config.anthropic.model;
    this.embeddingsService = getEmbeddingsService();
  }

  private async getStore(): Promise<VectorStore> {
    if (!this.vectorStore) {
      this.vectorStore = await getVectorStore();
    }
    return this.vectorStore;
  }

  /**
   * Index a document for RAG queries
   */
  async indexDocument(
    documentId: string,
    text: string,
    metadata: Record<string, unknown> = {},
    chunkingOptions?: Partial<ChunkingOptions>
  ): Promise<void> {
    const store = await this.getStore();

    // Chunk and embed the text
    const chunks = await this.embeddingsService.chunkAndEmbed(
      text,
      chunkingOptions ?? { strategy: 'semantic', maxChunkSize: 500, overlap: 50 },
      { documentId, ...metadata }
    );

    // Add to vector store
    await store.addDocument(documentId, chunks, metadata);

    logger.info('Document indexed for RAG', {
      documentId,
      chunkCount: chunks.length,
    });
  }

  /**
   * Index extracted claim data
   */
  async indexClaim(claim: ExtractedClaim, ocrText?: string): Promise<void> {
    const store = await this.getStore();

    // Create structured text from claim
    const claimText = this.claimToText(claim);

    // Index claim data
    const claimChunks = await this.embeddingsService.chunkAndEmbed(
      claimText,
      { strategy: 'paragraph', maxChunkSize: 300 },
      {
        claimId: claim.id,
        documentType: claim.documentType,
        type: 'claim_data',
      }
    );

    await store.addDocument(`claim_${claim.id}`, claimChunks, {
      claimId: claim.id,
      documentType: claim.documentType,
      type: 'claim_data',
    });

    // Also index OCR text if provided
    if (ocrText) {
      const ocrChunks = await this.embeddingsService.chunkAndEmbed(
        ocrText,
        { strategy: 'semantic', maxChunkSize: 500, overlap: 50 },
        {
          claimId: claim.id,
          documentType: claim.documentType,
          type: 'ocr_text',
        }
      );

      await store.addChunks(`claim_${claim.id}`, ocrChunks, {
        claimId: claim.id,
        type: 'ocr_text',
      });
    }

    logger.info('Claim indexed for RAG', { claimId: claim.id });
  }

  /**
   * Answer a question using RAG
   */
  async query(ragQuery: RAGQuery): Promise<RAGResponse> {
    const store = await this.getStore();

    // Search for relevant chunks
    const searchOptions: SearchOptions = {
      topK: ragQuery.maxChunks ?? 5,
      minScore: ragQuery.minRelevance ?? 0.5,
      filter: {},
    };

    if (ragQuery.claimId) {
      searchOptions.filter!.claimId = ragQuery.claimId;
    }
    if (ragQuery.documentId) {
      searchOptions.filter!.documentId = ragQuery.documentId;
    }
    if (ragQuery.documentType) {
      searchOptions.filter!.documentType = ragQuery.documentType;
    }

    const searchResults = await store.search(ragQuery.question, searchOptions);

    if (searchResults.length === 0) {
      return {
        answer: 'I could not find relevant information to answer your question.',
        confidence: 0,
        sources: [],
      };
    }

    // Build context from search results
    const context = this.buildContext(searchResults);

    // Generate answer using LLM
    const response = await this.generateAnswer(ragQuery.question, context, searchResults);

    return response;
  }

  /**
   * Ask a question about a specific claim
   */
  async askAboutClaim(claimId: string, question: string): Promise<RAGResponse> {
    return this.query({
      question,
      claimId,
      maxChunks: 10,
      minRelevance: 0.4,
    });
  }

  /**
   * Find claims similar to a given claim
   */
  async findSimilarClaims(claimId: string, topK: number = 5): Promise<Array<{
    claimId: string;
    similarity: number;
    summary: string;
  }>> {
    const store = await this.getStore();
    const similarDocs = await store.findSimilarDocuments(`claim_${claimId}`, topK);

    const results: Array<{ claimId: string; similarity: number; summary: string }> = [];

    for (const doc of similarDocs) {
      if (doc.documentId.startsWith('claim_')) {
        const similarClaimId = doc.documentId.replace('claim_', '');
        results.push({
          claimId: similarClaimId,
          similarity: doc.score,
          summary: `Similar claim with ${Math.round(doc.score * 100)}% similarity`,
        });
      }
    }

    return results;
  }

  /**
   * Generate a summary of a document
   */
  async summarizeDocument(documentId: string): Promise<DocumentSummary> {
    const store = await this.getStore();
    const doc = await store.getDocument(documentId);

    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Combine all chunks
    const fullText = doc.chunks.map((c) => c.text).join('\n\n');

    const prompt = `Summarize the following healthcare document:

${fullText.substring(0, 8000)}

Provide:
1. A concise summary (2-3 sentences)
2. Key points (bullet list of important information)
3. Document type (claim, EOB, medical record, etc.)

Respond in JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "documentType": "..."
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        documentType: parsed.documentType ?? (doc.metadata.documentType as string) ?? 'unknown',
        pageCount: doc.chunks.length,
        confidence: 0.9,
      };
    } catch (error) {
      logger.error('Document summarization failed', { error, documentId });
      return {
        summary: 'Unable to generate summary',
        keyPoints: [],
        documentType: 'unknown',
        pageCount: doc.chunks.length,
        confidence: 0,
      };
    }
  }

  /**
   * Compare two claims
   */
  async compareClaims(claimId1: string, claimId2: string): Promise<ClaimComparison> {
    const store = await this.getStore();

    const doc1 = await store.getDocument(`claim_${claimId1}`);
    const doc2 = await store.getDocument(`claim_${claimId2}`);

    if (!doc1 || !doc2) {
      throw new Error('One or both claims not found');
    }

    const text1 = doc1.chunks.map((c) => c.text).join('\n');
    const text2 = doc2.chunks.map((c) => c.text).join('\n');

    const prompt = `Compare these two healthcare claims:

## Claim 1 (${claimId1})
${text1.substring(0, 4000)}

## Claim 2 (${claimId2})
${text2.substring(0, 4000)}

Identify:
1. Similarities (what they have in common)
2. Differences (how they differ)
3. Recommendation (are they related? duplicates? etc.)

Respond in JSON:
{
  "similarities": ["...", "..."],
  "differences": ["...", "..."],
  "recommendation": "..."
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        claimId1,
        claimId2,
        similarities: parsed.similarities ?? [],
        differences: parsed.differences ?? [],
        recommendation: parsed.recommendation ?? 'Unable to determine relationship',
      };
    } catch (error) {
      logger.error('Claim comparison failed', { error, claimId1, claimId2 });
      return {
        claimId1,
        claimId2,
        similarities: [],
        differences: [],
        recommendation: 'Comparison failed',
      };
    }
  }

  /**
   * Semantic search across all claims
   */
  async semanticSearch(
    query: string,
    options: {
      documentType?: string;
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const store = await this.getStore();

    return store.search(query, {
      topK: options.limit ?? 10,
      minScore: options.minScore ?? 0.5,
      filter: options.documentType ? { documentType: options.documentType } : undefined,
    });
  }

  // Private helper methods

  private claimToText(claim: ExtractedClaim): string {
    const lines: string[] = [
      `Healthcare Claim: ${claim.id}`,
      `Document Type: ${claim.documentType}`,
      '',
      '## Patient Information',
      `Member ID: ${claim.patient.memberId}`,
      `Name: ${claim.patient.firstName} ${claim.patient.lastName}`,
      `Date of Birth: ${claim.patient.dateOfBirth}`,
      claim.patient.gender ? `Gender: ${claim.patient.gender}` : '',
      '',
      '## Provider Information',
      `NPI: ${claim.provider.npi}`,
      `Name: ${claim.provider.name}`,
      claim.provider.specialty ? `Specialty: ${claim.provider.specialty}` : '',
      '',
      '## Diagnoses',
      ...claim.diagnoses.map(
        (d, i) => `${i + 1}. ${d.code}${d.description ? ` - ${d.description}` : ''}${d.isPrimary ? ' (Primary)' : ''}`
      ),
      '',
      '## Service Lines',
      ...claim.serviceLines.map(
        (sl) =>
          `Line ${sl.lineNumber}: ${sl.procedureCode} on ${sl.dateOfService} - $${sl.chargeAmount} (${sl.units} units)`
      ),
      '',
      '## Totals',
      `Total Charges: $${claim.totals.totalCharges}`,
      claim.totals.amountPaid !== undefined ? `Amount Paid: $${claim.totals.amountPaid}` : '',
      claim.totals.patientResponsibility !== undefined
        ? `Patient Responsibility: $${claim.totals.patientResponsibility}`
        : '',
    ];

    return lines.filter(Boolean).join('\n');
  }

  private buildContext(results: SearchResult[]): string {
    const contextParts: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      contextParts.push(
        `[Source ${i + 1}] (Relevance: ${Math.round(result.score * 100)}%)`,
        result.chunk.text,
        ''
      );
    }

    return contextParts.join('\n');
  }

  private async generateAnswer(
    question: string,
    context: string,
    sources: SearchResult[]
  ): Promise<RAGResponse> {
    const prompt = `You are a healthcare claims expert assistant. Answer the question based ONLY on the provided context.

## Context
${context}

## Question
${question}

## Instructions
1. Answer based ONLY on the information in the context above
2. If the answer is not in the context, say "I don't have enough information to answer that"
3. Be specific and cite which source(s) you used
4. For numerical data, be precise

Respond in JSON:
{
  "answer": "your answer here",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of how you arrived at this answer",
  "sourceIndices": [1, 2] // which sources were most relevant
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Map sources
      const responseSourceIndices = (parsed.sourceIndices ?? []) as number[];
      const mappedSources = responseSourceIndices
        .filter((idx: number) => idx >= 1 && idx <= sources.length)
        .map((idx: number) => {
          const source = sources[idx - 1];
          return {
            text: source.chunk.text.substring(0, 200) + '...',
            documentId: source.documentId,
            claimId: source.claimId,
            relevanceScore: source.score,
            page: source.chunk.metadata.page as number | undefined,
          };
        });

      // If no specific sources cited, include top 3
      if (mappedSources.length === 0) {
        for (let i = 0; i < Math.min(3, sources.length); i++) {
          const source = sources[i];
          mappedSources.push({
            text: source.chunk.text.substring(0, 200) + '...',
            documentId: source.documentId,
            claimId: source.claimId,
            relevanceScore: source.score,
            page: source.chunk.metadata.page as number | undefined,
          });
        }
      }

      return {
        answer: parsed.answer,
        confidence: parsed.confidence ?? 0.8,
        sources: mappedSources,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      logger.error('RAG answer generation failed', { error, question });
      return {
        answer: 'I was unable to generate an answer. Please try rephrasing your question.',
        confidence: 0,
        sources: sources.slice(0, 3).map((s) => ({
          text: s.chunk.text.substring(0, 200) + '...',
          documentId: s.documentId,
          claimId: s.claimId,
          relevanceScore: s.score,
          page: s.chunk.metadata.page as number | undefined,
        })),
      };
    }
  }
}

// Singleton instance
let ragServiceInstance: RAGService | null = null;

export function getRAGService(): RAGService {
  if (!ragServiceInstance) {
    ragServiceInstance = new RAGService();
  }
  return ragServiceInstance;
}
