/**
 * Base API client with caching, retry logic, and rate limiting
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  APIClientConfig,
  APIResponse,
  CacheEntry,
} from '../../types/decomposition';
import { CACHE_CONFIG } from '../../config/apiConfig';

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private readonly requestsPerSecond: number;
  private readonly interval: number;

  constructor(requestsPerSecond: number) {
    this.requestsPerSecond = requestsPerSecond;
    this.interval = 1000 / requestsPerSecond; // ms between requests
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const task = this.queue.shift();

    if (task) {
      await task();
      await this.delay(this.interval);
    }

    this.processing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Cache manager using IndexedDB
 */
class CacheManager {
  private db: IDBDatabase | null = null;
  private dbInitPromise: Promise<void>;

  constructor() {
    this.dbInitPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CACHE_CONFIG.dbName, CACHE_CONFIG.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CACHE_CONFIG.storeName)) {
          db.createObjectStore(CACHE_CONFIG.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    await this.dbInitPromise;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CACHE_CONFIG.storeName],
        'readonly'
      );
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if cache is expired
        const now = Date.now();
        const age = (now - entry.cachedAt) / 1000; // seconds

        if (age > entry.ttl || entry.version !== CACHE_CONFIG.version) {
          // Cache expired or version mismatch, delete it
          this.delete(key);
          resolve(null);
        } else {
          resolve(entry);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    await this.dbInitPromise;
    if (!this.db) return;

    const entry: CacheEntry<T> = {
      key,
      data,
      cachedAt: Date.now(),
      ttl,
      version: CACHE_CONFIG.version,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CACHE_CONFIG.storeName],
        'readwrite'
      );
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    await this.dbInitPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CACHE_CONFIG.storeName],
        'readwrite'
      );
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.dbInitPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [CACHE_CONFIG.storeName],
        'readwrite'
      );
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Abstract base API client
 */
export abstract class BaseAPIClient {
  protected readonly config: APIClientConfig;
  protected readonly axios: AxiosInstance;
  protected readonly rateLimiter: RateLimiter;
  protected readonly cache: CacheManager;
  protected readonly sourceName: string;

  constructor(config: APIClientConfig, sourceName: string) {
    this.config = config;
    this.sourceName = sourceName;

    // Initialize axios instance
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth if required
    if (config.requiresAuth && config.auth) {
      if (config.auth.apiKey) {
        this.axios.defaults.headers.common['X-API-Key'] = config.auth.apiKey;
      } else if (config.auth.token) {
        this.axios.defaults.headers.common[
          'Authorization'
        ] = `Bearer ${config.auth.token}`;
      } else if (config.auth.username && config.auth.password) {
        this.axios.defaults.auth = {
          username: config.auth.username,
          password: config.auth.password,
        };
      }
    }

    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.cache = new CacheManager();
  }

  /**
   * Make a cached API request with retry logic
   */
  protected async makeRequest<T>(
    url: string,
    options: AxiosRequestConfig = {},
    cacheKey?: string,
    forceRefresh = false
  ): Promise<APIResponse<T>> {
    const effectiveCacheKey = cacheKey || `${this.sourceName}:${url}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = await this.cache.get<T>(effectiveCacheKey);
        if (cached) {
          console.log(`[${this.sourceName}] Cache hit: ${effectiveCacheKey}`);
          return {
            success: true,
            data: cached.data,
            fromCache: true,
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.warn(`[${this.sourceName}] Cache read error:`, error);
        // Continue with API request if cache fails
      }
    }

    // Make API request with rate limiting and retry
    return this.rateLimiter.throttle(async () => {
      return this.makeRequestWithRetry<T>(url, options, effectiveCacheKey);
    });
  }

  /**
   * Make request with exponential backoff retry
   */
  private async makeRequestWithRetry<T>(
    url: string,
    options: AxiosRequestConfig,
    cacheKey: string,
    attempt = 1,
    maxRetries = 3
  ): Promise<APIResponse<T>> {
    try {
      console.log(`[${this.sourceName}] Request (attempt ${attempt}): ${url}`);

      const response = await this.axios.request<T>({
        url,
        ...options,
      });

      // Cache successful response
      try {
        await this.cache.set(cacheKey, response.data, this.config.cacheTtl);
      } catch (error) {
        console.warn(`[${this.sourceName}] Cache write error:`, error);
        // Continue even if caching fails
      }

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
        fromCache: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error(
        `[${this.sourceName}] Request error (attempt ${attempt}):`,
        error
      );

      // Handle rate limiting (429)
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = parseInt(
          error.response.headers['retry-after'] || '5',
          10
        );
        console.log(
          `[${this.sourceName}] Rate limited, waiting ${retryAfter}s`
        );
        await this.delay(retryAfter * 1000);

        if (attempt < maxRetries) {
          return this.makeRequestWithRetry<T>(
            url,
            options,
            cacheKey,
            attempt + 1,
            maxRetries
          );
        }
      }

      // Retry on timeout or 5xx errors
      if (attempt < maxRetries) {
        const shouldRetry =
          axios.isAxiosError(error) &&
          (error.code === 'ECONNABORTED' ||
            (error.response?.status && error.response.status >= 500));

        if (shouldRetry) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.log(`[${this.sourceName}] Retrying in ${delay}ms...`);
          await this.delay(delay);
          return this.makeRequestWithRetry<T>(
            url,
            options,
            cacheKey,
            attempt + 1,
            maxRetries
          );
        }
      }

      // Return error response
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? error.message
          : error instanceof Error
          ? error.message
          : String(error),
        statusCode: axios.isAxiosError(error)
          ? error.response?.status
          : undefined,
        fromCache: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear cache for this client
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract fetchData(
    identifier: string,
    forceRefresh?: boolean
  ): Promise<APIResponse<unknown>>;
}
