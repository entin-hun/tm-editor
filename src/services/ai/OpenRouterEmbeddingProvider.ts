import { EmbeddingProvider } from './EmbeddingProvider';
import type {
  EmbeddingResult,
  OpenRouterEmbeddingRequest,
  OpenRouterEmbeddingResponse,
} from '../../types/ai';
import { AI_ENDPOINTS } from '../../config/aiConfig';
import axios, { type AxiosInstance } from 'axios';

/**
 * OpenRouter embedding provider
 * Supports OpenAI embedding models via OpenRouter proxy
 */
export class OpenRouterEmbeddingProvider extends EmbeddingProvider {
  private client: AxiosInstance;

  constructor(apiKey: string, model = 'openai/text-embedding-3-small') {
    super(apiKey, model, 'openrouter');

    this.client = axios.create({
      baseURL: AI_ENDPOINTS.openrouter,
      timeout: 5000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trace.market',
        'X-Title': 'Trace Market Editor',
      },
    });
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const request: OpenRouterEmbeddingRequest = {
        model: this.model,
        input: text,
      };

      const response = await this.client.post<OpenRouterEmbeddingResponse>(
        '/embeddings',
        request
      );

      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('Invalid response: no embeddings returned');
      }

      const embedding = response.data.data[0].embedding;

      return {
        embedding,
        model: this.model,
        provider: this.provider,
        dimensions: embedding.length,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Invalid OpenRouter API key');
        }
        if (error.response?.status === 429) {
          throw new Error('OpenRouter rate limit exceeded. Try again later.');
        }
        if (error.response?.data?.error?.message) {
          throw new Error(
            `OpenRouter API error: ${error.response.data.error.message}`
          );
        }
      }
      throw new Error(
        `Failed to generate OpenRouter embedding: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * OpenRouter supports native batch embedding
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];

    try {
      const request: OpenRouterEmbeddingRequest = {
        model: this.model,
        input: texts,
      };

      const response = await this.client.post<OpenRouterEmbeddingResponse>(
        '/embeddings',
        request
      );

      if (!response.data.data || response.data.data.length !== texts.length) {
        throw new Error('Invalid response: embedding count mismatch');
      }

      // Sort by index to ensure order matches input texts
      const sortedData = response.data.data.sort((a, b) => a.index - b.index);

      return sortedData.map((item) => ({
        embedding: item.embedding,
        model: this.model,
        provider: this.provider,
        dimensions: item.embedding.length,
        generatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error(
        'Batch embedding failed, falling back to sequential:',
        error
      );
      // Fallback to sequential if batch fails
      return super.generateEmbeddings(texts);
    }
  }
}

export const createOpenRouterProvider = (apiKey: string, model?: string) => {
  return new OpenRouterEmbeddingProvider(apiKey, model);
};
