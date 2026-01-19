// AI Configuration Types for Semantic Search

export type AIProvider = 'gemini' | 'groq' | 'openrouter';

export interface ProviderConfig {
  apiKey: string; // stored with basic obfuscation
  validated?: boolean; // explicit flag that validation succeeded
  lastValidated?: string; // ISO timestamp
  lastError?: string;
}

export interface AIConfig {
  providers: Partial<Record<AIProvider, ProviderConfig>>;
  activeProvider: AIProvider; // Currently active provider for task execution
  enabled: boolean;
}

export interface AIModel {
  name: string;
  displayName: string;
  dimensions?: number; // for embedding models
  maxTokens?: number;
  type?: 'embedding' | 'chat'; // chat models can generate embeddings via pooling
  cost?: string; // display string like "Free" or "$0.02/1M tokens"
}

export interface EmbeddingResult {
  embedding: number[]; // vector of floats
  model: string;
  provider: AIProvider;
  dimensions: number;
  generatedAt: string; // ISO timestamp
}

export interface SemanticSearchResult {
  id: string;
  name: string;
  description: string;
  source: string;
  confidence: number;
  similarityScore: number; // 0.0-1.0 cosine similarity
  embeddingCached: boolean;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingCacheEntry {
  text: string;
  provider: AIProvider;
  model: string;
  embedding: number[];
  dimensions: number;
  cachedAt: string; // ISO timestamp
  version: number; // for cache invalidation
}

// API Request/Response Types

export interface GeminiEmbeddingRequest {
  model: string;
  content: {
    parts: [{ text: string }];
  };
}

export interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

export interface OpenRouterEmbeddingRequest {
  model: string;
  input: string | string[];
}

export interface OpenRouterEmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface GroqChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export interface GroqChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
