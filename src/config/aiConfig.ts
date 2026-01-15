import type { AIModel, AIProvider } from '../types/ai';

// Available AI models per provider
export const AI_MODELS: Record<AIProvider, AIModel[]> = {
  gemini: [
    {
      name: 'text-embedding-004',
      displayName: 'Gemini Text Embedding 004',
      dimensions: 768,
      maxTokens: 2048,
      type: 'embedding',
      cost: 'Free (1500 req/day)',
    },
  ],
  groq: [
    {
      name: 'llama-3.3-70b-versatile',
      displayName: 'Llama 3.3 70B (pooled embeddings)',
      type: 'chat',
      maxTokens: 32768,
      cost: 'Free (generous limits)',
    },
  ],
  openrouter: [
    {
      name: 'openai/text-embedding-3-small',
      displayName: 'OpenAI Text Embedding 3 Small',
      dimensions: 1536,
      maxTokens: 8191,
      type: 'embedding',
      cost: '$0.02/1M tokens',
    },
    {
      name: 'openai/text-embedding-3-large',
      displayName: 'OpenAI Text Embedding 3 Large',
      dimensions: 3072,
      maxTokens: 8191,
      type: 'embedding',
      cost: '$0.13/1M tokens',
    },
  ],
};

// Embedding generation configuration
export const EMBEDDING_CONFIG = {
  cacheEnabled: true,
  cacheTtl: 2592000, // 30 days (embeddings are deterministic)
  cacheVersion: 1, // increment to invalidate all cached embeddings
  batchSize: 10, // embed multiple texts in single API call
  similarityThreshold: 0.5, // minimum cosine similarity to include result
  timeout: 5000, // 5 seconds per API call
  retries: 2, // retry failed calls
};

// API endpoints
export const AI_ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

// Default models per provider (used when user hasn't selected)
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'text-embedding-004',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openai/text-embedding-3-small',
};

// Get model configuration by provider and name
export function getModelConfig(
  provider: AIProvider,
  modelName: string
): AIModel | undefined {
  return AI_MODELS[provider].find((m) => m.name === modelName);
}

// Get default model for provider
export function getDefaultModel(provider: AIProvider): AIModel {
  const modelName = DEFAULT_MODELS[provider];
  const model = getModelConfig(provider, modelName);
  if (!model) {
    throw new Error(
      `Default model ${modelName} not found for provider ${provider}`
    );
  }
  return model;
}
