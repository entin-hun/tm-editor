/**
 * Configuration for external API integrations
 */

import type { APIClientConfig } from '../types/decomposition';

/**
 * API client configurations
 */
export const API_CONFIGS: Record<string, APIClientConfig> = {
  openFoodFacts: {
    baseUrl: 'https://world.openfoodfacts.org/api/v0',
    timeout: 10000, // 10 seconds
    rateLimit: 10, // 10 requests per second (conservative estimate)
    cacheTtl: 7 * 24 * 60 * 60, // 7 days
    requiresAuth: false,
  },

  openLCA: {
    baseUrl: 'https://lca.trace.market/result', // Existing endpoint
    timeout: 15000, // 15 seconds (LCA calculations can be slow)
    rateLimit: 5, // 5 requests per second
    cacheTtl: 14 * 24 * 60 * 60, // 14 days (LCA data changes less frequently)
    requiresAuth: true, // May require credentials for full access
    auth: {
      // Credentials can be set via environment variables or settings
      username: process.env.OPENLCA_USERNAME,
      password: process.env.OPENLCA_PASSWORD,
    },
  },

  oshwa: {
    baseUrl: 'https://certification.oshwa.org',
    timeout: 10000,
    rateLimit: 5, // Conservative, since we may need to scrape HTML
    cacheTtl: 30 * 24 * 60 * 60, // 30 days (certifications are stable)
    requiresAuth: false,
  },

  wikiFab: {
    baseUrl: 'https://wikifab.org/w/api.php',
    timeout: 10000,
    rateLimit: 10,
    cacheTtl: 7 * 24 * 60 * 60, // 7 days
    requiresAuth: false,
  },
};

/**
 * Decomposition engine configuration
 */
export const DECOMPOSITION_CONFIG = {
  /** Maximum depth for recursive decomposition */
  maxDepth: 3,
  /** Maximum number of parallel API requests */
  maxParallelRequests: 5,
  /** Timeout for entire decomposition operation (seconds) */
  decompositionTimeout: 60,
  /** Minimum confidence score to accept data (0.0-1.0) */
  minConfidenceThreshold: 0.1,
};

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /** Cache version (increment to invalidate all caches) */
  version: 2,
  /** Maximum cache size in MB */
  maxSizeInMb: 50,
  /** IndexedDB database name */
  dbName: 'tm-editor-decomposition-cache',
  /** IndexedDB store name */
  storeName: 'api-responses',
};

/**
 * Confidence score penalty factors
 */
export const CONFIDENCE_PENALTIES = {
  missingRequiredField: 0.3,
  missingOptionalField: 0.1,
  invalidDataType: 0.5,
  incompleteData: 0.2,
  oldData: 0.1, // Per year of age
};

/**
 * API-specific data source priorities (higher = preferred)
 */
export const DATA_SOURCE_PRIORITIES: Record<string, number> = {
  // User manual entry always wins
  manual: 100,

  // Domain-specific sources get priority for their domain
  openFoodFacts: {
    food: 90,
    default: 50,
  } as unknown as number,

  openLCA: {
    industrial: 90,
    environmental: 95,
    default: 70,
  } as unknown as number,

  oshwa: {
    hardware: 90,
    electronics: 95,
    default: 50,
  } as unknown as number,

  wikiFab: {
    diy: 90,
    general: 80,
    default: 60,
  } as unknown as number,
};

/**
 * Get priority for a data source in a specific domain
 */
export function getSourcePriority(source: string, domain?: string): number {
  const priority = DATA_SOURCE_PRIORITIES[source];

  if (typeof priority === 'number') {
    return priority;
  }

  if (typeof priority === 'object' && domain) {
    return (
      (priority as Record<string, number>)[domain] ||
      (priority as Record<string, number>).default ||
      50
    );
  }

  return 50; // Default priority
}
