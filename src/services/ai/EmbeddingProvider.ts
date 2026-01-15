import type { EmbeddingResult, AIProvider } from '../../types/ai';
import type { EmbeddingCacheEntry } from '../../types/ai';
import { EMBEDDING_CONFIG } from '../../config/aiConfig';

/**
 * Abstract base class for embedding generation providers
 */
export abstract class EmbeddingProvider {
  protected apiKey: string;
  protected model: string;
  protected provider: AIProvider;

  constructor(apiKey: string, model: string, provider: AIProvider) {
    this.apiKey = apiKey;
    this.model = model;
    this.provider = provider;
  }

  /**
   * Generate embedding for a single text
   */
  abstract generateEmbedding(text: string): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple texts in batch
   * Default implementation calls generateEmbedding sequentially
   * Override for providers with native batch support
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      try {
        const result = await this.generateEmbedding(text);
        results.push(result);
      } catch (error) {
        console.error(
          `Failed to generate embedding for text "${text.substring(
            0,
            50
          )}...":`,
          error
        );
        // Return zero vector as fallback
        results.push({
          embedding: [],
          model: this.model,
          provider: this.provider,
          dimensions: 0,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Validate API key by making a test embedding call
   */
  async validate(): Promise<boolean> {
    try {
      const result = await this.generateEmbedding('test');
      return result.embedding.length > 0;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }
}

/**
 * Cache manager for embeddings
 */
export class EmbeddingCache {
  private dbName = 'tm-editor-embeddings';
  private storeName = 'embeddings';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.dbName,
        EMBEDDING_CONFIG.cacheVersion
      );

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Delete old store if exists
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }

        // Create new store with compound key
        const store = db.createObjectStore(this.storeName, {
          keyPath: ['provider', 'model', 'text'],
        });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      };
    });
  }

  async get(
    provider: AIProvider,
    model: string,
    text: string
  ): Promise<EmbeddingCacheEntry | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get([provider, model, text]);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as EmbeddingCacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        const age = Date.now() - new Date(entry.cachedAt).getTime();
        if (age > EMBEDDING_CONFIG.cacheTtl * 1000) {
          this.delete(provider, model, text); // Clean up expired entry
          resolve(null);
          return;
        }

        // Check version
        if (entry.version !== EMBEDDING_CONFIG.cacheVersion) {
          this.delete(provider, model, text); // Clean up outdated entry
          resolve(null);
          return;
        }

        resolve(entry);
      };
    });
  }

  async set(entry: EmbeddingCacheEntry): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const entryWithVersion = {
        ...entry,
        version: EMBEDDING_CONFIG.cacheVersion,
      };
      const request = store.put(entryWithVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(
    provider: AIProvider,
    model: string,
    text: string
  ): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete([provider, model, text]);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Singleton cache instance
export const embeddingCache = new EmbeddingCache();
