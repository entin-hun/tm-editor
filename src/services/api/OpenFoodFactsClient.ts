/**
 * OpenFoodFacts API client
 * Documentation: https://wiki.openfoodfacts.org/API
 */

import { BaseAPIClient } from './BaseAPIClient';
import { API_CONFIGS } from '../../config/apiConfig';
import type { APIResponse } from '../../types/decomposition';

/**
 * OpenFoodFacts product response
 */
export interface OFFProductResponse {
  code: string; // Barcode
  product: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    categories?: string;
    categories_tags?: string[];
    ingredients?: Array<{
      id: string;
      text?: string;
      percent_estimate?: number;
      rank?: number;
      vegan?: 'yes' | 'no' | 'maybe';
      vegetarian?: 'yes' | 'no' | 'maybe';
    }>;
    ingredients_text?: string;
    packaging?: string;
    packaging_tags?: string[];
    quantity?: string;
    nova_group?: number; // 1-4 (1=unprocessed, 4=ultra-processed)
    nova_groups?: string;
    nutrition_grades?: string; // A-E
    ecoscore_grade?: string; // A-E
    image_url?: string;
    image_small_url?: string;
    countries_tags?: string[];
    manufacturing_places?: string;
    origins?: string;
    labels?: string;
    labels_tags?: string[];
    allergens?: string;
    traces?: string;
    completeness?: number; // 0-1
    last_modified_t?: number; // Unix timestamp
    nutriments?: any; // Contains energy, fa, sugar, etc.
  };
  status: number; // 0 = not found, 1 = found
  status_verbose?: string;
}

/**
 * OpenFoodFacts search response
 */
export interface OFFSearchResponse {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  products: OFFProductResponse['product'][];
}

/**
 * OpenFoodFacts API client
 */
export class OpenFoodFactsClient extends BaseAPIClient {
  constructor() {
    super(API_CONFIGS.openFoodFacts, 'OpenFoodFacts');
  }

  /**
   * Fetch product by barcode
   */
  async fetchData(
    barcode: string,
    forceRefresh = false
  ): Promise<APIResponse<OFFProductResponse>> {
    const url = `/product/${barcode}.json`;
    return this.makeRequest<OFFProductResponse>(
      url,
      { method: 'GET' },
      `off:barcode:${barcode}`,
      forceRefresh
    );
  }

  /**
   * Search products by name
   */
  async searchByName(
    query: string,
    page = 1,
    pageSize = 20
  ): Promise<APIResponse<OFFSearchResponse>> {
    // Search endpoint is not under /api/v0, so use absolute URL
    const url = `https://world.openfoodfacts.org/cgi/search.pl`;
    return this.makeRequest<OFFSearchResponse>(
      url,
      {
        method: 'GET',
        params: {
          search_terms: query,
          page,
          page_size: pageSize,
          json: 1,
          states_tags: 'en:ingredients-completed',
          fields:
            'code,product_name,brands,image_small_url,nova_group,nutrition_grades,completeness,ingredients',
        },
      },
      `off:search:${query}:${page}:filtered`,
      false // Cache search results
    );
  }

  /**
   * Get autocomplete suggestions for product types
   * (Uses taxonomy suggestions endpoint)
   */
  async getTypeSuggestions(
    query: string
  ): Promise<APIResponse<{ suggestions: string[] }>> {
    const url = `https://world.openfoodfacts.org/cgi/taxonomy_suggestions.pl`;
    return this.makeRequest<{ suggestions: string[] }>(
      url,
      {
        method: 'GET',
        params: {
          tagtype: 'categories',
          string: query,
        },
      },
      `off:suggestions:${query}`,
      false
    );
  }

  /**
   * Get product ingredients (for decomposition)
   */
  async getIngredients(
    barcode: string
  ): Promise<APIResponse<OFFProductResponse>> {
    return this.fetchData(barcode);
  }
}

/**
 * Singleton instance
 */
export const openFoodFactsClient = new OpenFoodFactsClient();
