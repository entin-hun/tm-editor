import { EmbeddingProvider } from './EmbeddingProvider';
import type {
  EmbeddingResult,
  GroqChatRequest,
  GroqChatResponse,
} from '../../types/ai';
import { AI_ENDPOINTS } from '../../config/aiConfig';
import axios, { type AxiosInstance } from 'axios';

/**
 * Groq embedding provider using chat model with text encoding
 *
 * Note: Groq doesn't have native embedding API, so we use a workaround:
 * 1. Ask the model to generate a semantic summary/representation
 * 2. Use a simple hash/encoding of the response as embedding
 * 3. This is less accurate than native embeddings but very fast
 *
 * Alternative: Could use sentence transformers in browser via ONNX
 */
export class GroqEmbeddingProvider extends EmbeddingProvider {
  private client: AxiosInstance;
  private dimensions = 384; // Fixed dimension for deterministic encoding

  constructor(apiKey: string, model = 'llama-3.3-70b-versatile') {
    super(apiKey, model, 'groq');

    this.client = axios.create({
      baseURL: AI_ENDPOINTS.groq,
      timeout: 10000, // Groq is fast, but allow extra time
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate pseudo-embedding by encoding chat response
   * This is a workaround since Groq lacks native embedding API
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Ask model to generate semantic representation
      const request: GroqChatRequest = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a semantic analyzer. Given a product name or description, output ONLY the most important semantic keywords separated by spaces, no other text.',
          },
          {
            role: 'user',
            content: `Product: ${text}`,
          },
        ],
        temperature: 0.1, // Low temperature for deterministic output
        max_tokens: 50,
      };

      const response = await this.client.post<GroqChatResponse>(
        '/chat/completions',
        request
      );

      if (!response.data.choices || response.data.choices.length === 0) {
        throw new Error('Invalid response: no choices returned');
      }

      const semanticText = response.data.choices[0].message.content.trim();

      // Encode the semantic text into a fixed-dimension vector
      const embedding = this.encodeTextToVector(semanticText);

      return {
        embedding,
        model: this.model,
        provider: this.provider,
        dimensions: this.dimensions,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Invalid Groq API key');
        }
        if (error.response?.status === 429) {
          throw new Error('Groq rate limit exceeded. Try again later.');
        }
        if (error.response?.data?.error?.message) {
          throw new Error(
            `Groq API error: ${error.response.data.error.message}`
          );
        }
      }
      throw new Error(
        `Failed to generate Groq embedding: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Encode text into a fixed-dimension vector using character-based features
   * This is a simple deterministic encoding, not a true semantic embedding
   */
  private encodeTextToVector(text: string): number[] {
    const normalized = text.toLowerCase();
    const vector = new Array(this.dimensions).fill(0);

    // Split into tokens
    const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);

    // Encode each token into vector components
    tokens.forEach((token, tokenIdx) => {
      for (let i = 0; i < token.length; i++) {
        const charCode = token.charCodeAt(i);
        const position = (tokenIdx * 31 + i * 17 + charCode) % this.dimensions;
        vector[position] += 1.0 / (tokenIdx + 1); // Weight by token position
      }
    });

    // Normalize vector to unit length
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }
}

export const createGroqProvider = (apiKey: string, model?: string) => {
  return new GroqEmbeddingProvider(apiKey, model);
};
