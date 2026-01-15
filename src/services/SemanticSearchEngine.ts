import type {
  EmbeddingProvider,
  embeddingCache as EmbeddingCacheType,
} from './ai/EmbeddingProvider';
import { embeddingCache } from './ai/EmbeddingProvider';
import { createGeminiProvider } from './ai/GeminiEmbeddingProvider';
import { createOpenRouterProvider } from './ai/OpenRouterEmbeddingProvider';
import { createGroqProvider } from './ai/GroqEmbeddingProvider';
import { aiConfigStorage } from './ai/AIConfigStorage';
import type { SemanticSearchResult } from '../types/ai';
import { EMBEDDING_CONFIG } from '../config/aiConfig';

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    console.warn(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Search result interface for input
 */
interface SearchResultInput {
  id: string;
  name: string;
  description?: string;
  source: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Semantic Search Engine using AI embeddings
 * Re-ranks keyword search results by semantic similarity
 */
export class SemanticSearchEngine {
  private provider: EmbeddingProvider | null = null;
  private cache: typeof EmbeddingCacheType;

  constructor() {
    this.cache = embeddingCache;
  }

  /**
   * Initialize provider from stored config
   */
  private async initProvider(): Promise<boolean> {
    const config = aiConfigStorage.getConfig();

    if (!config || !config.enabled || !config.apiKey) {
      return false;
    }

    try {
      switch (config.provider) {
        case 'gemini':
          this.provider = createGeminiProvider(config.apiKey, config.model);
          break;
        case 'openrouter':
          this.provider = createOpenRouterProvider(config.apiKey, config.model);
          break;
        case 'groq':
          this.provider = createGroqProvider(config.apiKey, config.model);
          break;
        default:
          console.error(`Unknown AI provider: ${config.provider}`);
          return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize embedding provider:', error);
      return false;
    }
  }

  /**
   * Get embedding for text, using cache if available
   */
  private async getEmbedding(
    text: string
  ): Promise<{ embedding: number[]; cached: boolean }> {
    if (!this.provider) {
      throw new Error('Embedding provider not initialized');
    }

    const config = aiConfigStorage.getConfig();
    if (!config) {
      throw new Error('AI config not found');
    }

    // Check cache first
    if (EMBEDDING_CONFIG.cacheEnabled) {
      const cached = await this.cache.get(config.provider, config.model, text);
      if (cached && cached.embedding.length > 0) {
        return { embedding: cached.embedding, cached: true };
      }
    }

    // Generate new embedding
    const result = await this.provider.generateEmbedding(text);

    // Cache it
    if (EMBEDDING_CONFIG.cacheEnabled && result.embedding.length > 0) {
      await this.cache.set({
        text,
        provider: config.provider,
        model: config.model,
        embedding: result.embedding,
        dimensions: result.dimensions,
        cachedAt: new Date().toISOString(),
        version: EMBEDDING_CONFIG.cacheVersion,
      });
    }

    return { embedding: result.embedding, cached: false };
  }

  /**
   * Re-rank search results by semantic similarity to query
   *
   * @param query - User's search query
   * @param results - Keyword search results to re-rank
   * @param options - Configuration options
   * @returns Re-ranked results with similarity scores
   */
  async reRankResults(
    query: string,
    results: SearchResultInput[],
    options: {
      threshold?: number;
      topK?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const threshold = options.threshold ?? EMBEDDING_CONFIG.similarityThreshold;
    const topK = options.topK;

    // Check if AI is configured
    if (!aiConfigStorage.isConfigured()) {
      console.log('AI not configured, skipping semantic search');
      return results.map((r) => ({
        ...r,
        description: r.description || '',
        confidence: r.confidence ?? 0,
        similarityScore: 0,
        embeddingCached: false,
      }));
    }

    // Initialize provider
    const initialized = await this.initProvider();
    if (!initialized || !this.provider) {
      console.warn(
        'Failed to initialize AI provider, skipping semantic search'
      );
      return results.map((r) => ({
        ...r,
        description: r.description || '',
        confidence: r.confidence ?? 0,
        similarityScore: 0,
        embeddingCached: false,
      }));
    }

    try {
      // Generate query embedding
      const queryEmbeddingResult = await this.getEmbedding(query);
      const queryEmbedding = queryEmbeddingResult.embedding;

      // Generate embeddings for all results (batch if provider supports it)
      const resultEmbeddings = await Promise.all(
        results.map(async (result) => {
          try {
            const embResult = await this.getEmbedding(result.name);
            return embResult;
          } catch (error) {
            console.error(
              `Failed to generate embedding for "${result.name}":`,
              error
            );
            return { embedding: [], cached: false };
          }
        })
      );

      // Calculate similarities and create semantic results
      const semanticResults: SemanticSearchResult[] = results.map(
        (result, idx) => {
          const resultEmbedding = resultEmbeddings[idx];

          let similarityScore = 0;
          if (
            resultEmbedding.embedding.length > 0 &&
            queryEmbedding.length > 0
          ) {
            similarityScore = cosineSimilarity(
              queryEmbedding,
              resultEmbedding.embedding
            );
            // Normalize to 0-1 range (cosine similarity is -1 to 1)
            similarityScore = (similarityScore + 1) / 2;
          }

          return {
            id: result.id,
            name: result.name,
            description: result.description || '',
            source: result.source,
            confidence: result.confidence ?? 0,
            similarityScore,
            embeddingCached: resultEmbedding.cached,
            metadata: result.metadata,
          };
        }
      );

      // Filter by threshold
      const filtered = semanticResults.filter(
        (r) => r.similarityScore >= threshold
      );

      // Sort by similarity score (descending)
      filtered.sort((a, b) => b.similarityScore - a.similarityScore);

      // Apply topK limit if specified
      const finalResults = topK ? filtered.slice(0, topK) : filtered;

      console.log(
        `Semantic search: ${results.length} → ${finalResults.length} results (threshold: ${threshold})`
      );

      return finalResults;
    } catch (error) {
      console.error('Semantic search failed:', error);
      // Return original results on error
      return results.map((r) => ({
        ...r,
        description: r.description || '',
        confidence: r.confidence ?? 0,
        similarityScore: 0,
        embeddingCached: false,
      }));
    }
  }

  /**
   * Check if semantic search is available
   */
  isAvailable(): boolean {
    return aiConfigStorage.isConfigured();
  }

  /**
   * Validate AI configuration
   */
  async validateConfig(): Promise<boolean> {
    const initialized = await this.initProvider();
    if (!initialized || !this.provider) {
      return false;
    }

    try {
      const isValid = await this.provider.validate();
      aiConfigStorage.markValidated(
        isValid,
        isValid ? undefined : 'Validation failed'
      );
      return isValid;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      aiConfigStorage.markValidated(false, errorMessage);
      return false;
    }
  }

  /**
   * Clear embedding cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}

// Singleton instance
export const semanticSearchEngine = new SemanticSearchEngine();
