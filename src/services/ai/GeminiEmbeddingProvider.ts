import { EmbeddingProvider } from './EmbeddingProvider';
import type {
  EmbeddingResult,
  GeminiEmbeddingRequest,
  GeminiEmbeddingResponse,
} from '../../types/ai';
import { AI_ENDPOINTS } from '../../config/aiConfig';
import axios, { type AxiosInstance } from 'axios';

/**
 * Gemini embedding provider using text-embedding-004 model
 * Recommended for this use case: native embeddings, high quality, generous free tier
 */
export class GeminiEmbeddingProvider extends EmbeddingProvider {
  private client: AxiosInstance;
  private dimensions = 768; // text-embedding-004 produces 768-dim vectors

  constructor(apiKey: string, model = 'text-embedding-004') {
    super(apiKey, model, 'gemini');

    this.client = axios.create({
      baseURL: AI_ENDPOINTS.gemini,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Remove 'models/' prefix if present in the model name to avoid duplication
      // because the base URL logic or the request might be appending it.
      // But looking at the error: .../models/models/text-embedding-004...
      // It implies this.model has 'models/' and the code adds another one.

      const cleanModelName = this.model.startsWith('models/')
        ? this.model.substring(7)
        : this.model;

      const request: GeminiEmbeddingRequest = {
        model: `models/${cleanModelName}`,
        content: {
          parts: [{ text }],
        },
      };

      // API endpoint reference: https://ai.google.dev/api/embeddings#v1beta.models.embedContent
      // POST https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent

      console.log(
        `[GeminiEmbedding] Requesting embedding for model: ${cleanModelName}`
      );

      const response = await this.client.post<GeminiEmbeddingResponse>(
        `/models/${cleanModelName}:embedContent?key=${this.apiKey}`,
        request
      );

      if (!response.data.embedding?.values) {
        throw new Error('Invalid response: missing embedding values');
      }

      return {
        embedding: response.data.embedding.values,
        model: this.model,
        provider: this.provider,
        dimensions: response.data.embedding.values.length,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Invalid Gemini API key');
        }
        if (error.response?.status === 429) {
          throw new Error('Gemini rate limit exceeded. Try again later.');
        }
        if (error.response?.data?.error?.message) {
          throw new Error(
            `Gemini API error: ${error.response.data.error.message}`
          );
        }
      }
      throw new Error(
        `Failed to generate Gemini embedding: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Gemini supports batch embedding via batchEmbedContents endpoint
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    // For now, use sequential calls (batch endpoint has different API)
    // TODO: Implement batchEmbedContents for efficiency
    return super.generateEmbeddings(texts);
  }
}

export const createGeminiProvider = (apiKey: string, model?: string) => {
  return new GeminiEmbeddingProvider(apiKey, model);
};
