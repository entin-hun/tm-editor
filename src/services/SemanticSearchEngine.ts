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
import { EMBEDDING_CONFIG, selectModelForTask } from '../config/aiConfig';

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
    console.log('[SemanticSearch] Checking if configured...');
    const isConfigured = aiConfigStorage.isConfigured();
    console.log(`[SemanticSearch] isConfigured: ${isConfigured}`);

    if (!isConfigured) {
      const config = aiConfigStorage.getConfig();
      console.log('[SemanticSearch] Config:', config);
      return false;
    }

    const apiKey = aiConfigStorage.getActiveApiKey();
    const provider = aiConfigStorage.getActiveProvider();

    console.log(
      `[SemanticSearch] Provider: ${provider}, API key length: ${
        apiKey?.length || 0
      }`
    );

    if (!apiKey || !provider) {
      return false;
    }

    // Use embedding model for this provider
    const model = selectModelForTask(provider, 'embedding');
    console.log(
      `[SemanticSearch] Selected model: ${model} for provider: ${provider}`
    );

    try {
      switch (provider) {
        case 'gemini':
          this.provider = createGeminiProvider(apiKey, model);
          break;
        case 'openrouter':
          this.provider = createOpenRouterProvider(apiKey, model);
          break;
        case 'groq':
          this.provider = createGroqProvider(apiKey, model);
          break;
        default:
          console.error(`Unknown AI provider: ${provider}`);
          return false;
      }

      console.log(`[SemanticSearch] Provider created successfully`);
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

    const provider = aiConfigStorage.getActiveProvider();
    if (!provider) {
      throw new Error('AI provider not configured');
    }

    const model = selectModelForTask(provider, 'embedding');

    // Check cache first
    if (EMBEDDING_CONFIG.cacheEnabled) {
      const cached = await this.cache.get(provider, model, text);
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
        provider,
        model,
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
    console.log('[SemanticSearch] Starting validation...');
    const initialized = await this.initProvider();
    console.log(`[SemanticSearch] Provider initialized: ${initialized}`);

    if (!initialized || !this.provider) {
      console.log(
        '[SemanticSearch] Validation failed: provider not initialized'
      );
      return false;
    }

    const provider = aiConfigStorage.getActiveProvider();
    const apiKey = aiConfigStorage.getActiveApiKey();

    console.log(
      `[SemanticSearch] Active provider: ${provider}, has key: ${!!apiKey}`
    );

    if (!provider || !apiKey) {
      console.log('[SemanticSearch] Validation failed: no provider or API key');
      return false;
    }

    try {
      console.log(`[SemanticSearch] Calling provider.validate()...`);
      const isValid = await this.provider.validate();
      console.log(`[SemanticSearch] Provider validation result: ${isValid}`);

      // Update provider's validation status
      aiConfigStorage.updateProvider(
        provider,
        apiKey,
        isValid,
        isValid ? undefined : 'Validation failed'
      );
      return isValid;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[SemanticSearch] Validation error:', errorMessage);
      aiConfigStorage.updateProvider(provider, apiKey, false, errorMessage);
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
