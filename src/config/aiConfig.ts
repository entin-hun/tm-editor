import type { AIModel, AIProvider } from '../types/ai';

// Available AI models per provider
export const AI_MODELS: Record<AIProvider, AIModel[]> = {
  gemini: [
    {
      name: 'models/gemini-2.0-flash-exp',
      displayName: 'Gemini 2.0 Flash (Experimental)',
      type: 'chat',
      maxTokens: 8192,
      cost: 'Free (high limits)',
    },
    {
      name: 'models/gemini-1.5-flash',
      displayName: 'Gemini 1.5 Flash',
      type: 'chat',
      maxTokens: 8192,
      cost: 'Free (high limits)',
    },
    {
      name: 'models/gemini-1.5-flash-8b',
      displayName: 'Gemini 1.5 Flash 8B',
      type: 'chat',
      maxTokens: 8192,
      cost: 'Free (very high limits)',
    },
    {
      name: 'models/gemini-1.5-pro',
      displayName: 'Gemini 1.5 Pro',
      type: 'chat',
      maxTokens: 8192,
      cost: 'Free (moderate limits)',
    },
    {
      name: 'models/text-embedding-004',
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
      displayName: 'Llama 3.3 70B Versatile',
      type: 'chat',
      maxTokens: 32768,
      cost: 'Free (generous limits)',
    },
    {
      name: 'llama-3.1-70b-versatile',
      displayName: 'Llama 3.1 70B Versatile',
      type: 'chat',
      maxTokens: 131072,
      cost: 'Free (generous limits)',
    },
    {
      name: 'llama-3.1-8b-instant',
      displayName: 'Llama 3.1 8B Instant',
      type: 'chat',
      maxTokens: 131072,
      cost: 'Free (very high limits)',
    },
    {
      name: 'mixtral-8x7b-32768',
      displayName: 'Mixtral 8x7B',
      type: 'chat',
      maxTokens: 32768,
      cost: 'Free (generous limits)',
    },
    {
      name: 'gemma2-9b-it',
      displayName: 'Gemma 2 9B',
      type: 'chat',
      maxTokens: 8192,
      cost: 'Free (very high limits)',
    },
  ],
  openrouter: [
    {
      name: 'openai/gpt-4o',
      displayName: 'GPT-4o (OpenAI)',
      type: 'chat',
      maxTokens: 128000,
      cost: '$2.50/1M in + $10/1M out',
    },
    {
      name: 'openai/gpt-4o-mini',
      displayName: 'GPT-4o Mini (OpenAI)',
      type: 'chat',
      maxTokens: 128000,
      cost: '$0.15/1M in + $0.60/1M out',
    },
    {
      name: 'anthropic/claude-3.5-sonnet',
      displayName: 'Claude 3.5 Sonnet (Anthropic)',
      type: 'chat',
      maxTokens: 200000,
      cost: '$3/1M in + $15/1M out',
    },
    {
      name: 'anthropic/claude-3-haiku',
      displayName: 'Claude 3 Haiku (Anthropic)',
      type: 'chat',
      maxTokens: 200000,
      cost: '$0.25/1M in + $1.25/1M out',
    },
    {
      name: 'google/gemini-2.0-flash-exp:free',
      displayName: 'Gemini 2.0 Flash (Free)',
      type: 'chat',
      maxTokens: 8192,
      cost: 'Free (via OpenRouter)',
    },
    {
      name: 'meta-llama/llama-3.3-70b-instruct',
      displayName: 'Llama 3.3 70B Instruct',
      type: 'chat',
      maxTokens: 128000,
      cost: '$0.35/1M in + $0.40/1M out',
    },
    {
      name: 'qwen/qwen-2.5-72b-instruct',
      displayName: 'Qwen 2.5 72B Instruct',
      type: 'chat',
      maxTokens: 32768,
      cost: '$0.35/1M in + $0.40/1M out',
    },
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
  gemini: 'models/gemini-2.0-flash-exp',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'google/gemini-2.0-flash-exp:free',
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

/**
 * Task types for automatic model selection
 */
export type TaskType =
  | 'chat' // Conversational responses
  | 'extraction' // Structured data extraction
  | 'generation' // Content generation
  | 'embedding' // Semantic embeddings
  | 'suggestion'; // Ingredient/input suggestions

/**
 * Automatically select the best model for a given task type
 * @param provider The AI provider
 * @param taskType The type of task being performed
 * @param userSelectedModel Optional user's preferred model (used if compatible)
 * @returns The best model name for the task
 */
export function selectModelForTask(
  provider: AIProvider,
  taskType: TaskType,
  userSelectedModel?: string
): string {
  const availableModels = AI_MODELS[provider];

  // If user selected a model and it's compatible with the task, use it
  if (userSelectedModel) {
    const userModel = availableModels.find((m) => m.name === userSelectedModel);
    const isCompatible =
      (taskType === 'embedding' && userModel?.type === 'embedding') ||
      (taskType !== 'embedding' && userModel?.type === 'chat');

    if (isCompatible) {
      return userSelectedModel;
    }
  }

  // Otherwise, pick the best model for the task type
  switch (taskType) {
    case 'embedding':
      // Need embedding model
      const embeddingModel = availableModels.find(
        (m) => m.type === 'embedding'
      );
      return embeddingModel?.name || DEFAULT_MODELS[provider];

    case 'chat':
    case 'extraction':
    case 'generation':
    case 'suggestion':
      // Need chat/generative model - prefer fastest
      const chatModels = availableModels.filter((m) => m.type === 'chat');
      if (chatModels.length > 0) {
        // Prefer Flash models for speed, then Pro for quality
        const flashModel = chatModels.find((m) => m.name.includes('flash'));
        return flashModel?.name || chatModels[0].name;
      }
      return DEFAULT_MODELS[provider];

    default:
      return DEFAULT_MODELS[provider];
  }
}
