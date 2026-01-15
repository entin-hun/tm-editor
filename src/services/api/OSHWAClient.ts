/**
 * OSHWA (Open Source Hardware Association) API client
 * Note: API endpoint may be unavailable, falls back to HTML scraping
 */

import { BaseAPIClient } from './BaseAPIClient';
import { API_CONFIGS } from '../../config/apiConfig';
import type { APIResponse } from '../../types/decomposition';
import axios from 'axios';

/**
 * OSHWA certification data
 */
export interface OSHWACertification {
  uid: string; // e.g., "US000123"
  projectName: string;
  projectUrl?: string;
  projectDescription?: string;
  certificationDate?: string;
  certificationType?: 'hardware' | 'software' | 'documentation';
  country?: string;
  responsibleParty?: string;
  // BOM data (if available)
  components?: Array<{
    name: string;
    description?: string;
    quantity?: number;
    partNumber?: string;
    supplier?: string;
  }>;
  // Documentation links
  documentation?: {
    schematic?: string;
    bom?: string;
    assembly?: string;
    designFiles?: string;
  };
}

/**
 * OSHWA certification list response (from HTML scraping)
 */
interface OSHWAListResponse {
  certifications: Array<{
    uid: string;
    name: string;
    type: string;
    date: string;
  }>;
  total: number;
}

/**
 * OSHWA API client
 */
export class OSHWAClient extends BaseAPIClient {
  constructor() {
    super(API_CONFIGS.oshwa, 'OSHWA');
  }

  /**
   * Fetch certification by UID
   * Falls back to HTML scraping if API is unavailable
   */
  async fetchData(
    uid: string,
    forceRefresh = false
  ): Promise<APIResponse<OSHWACertification>> {
    // Try API first
    const apiResponse = await this.fetchFromAPI(uid, forceRefresh);

    if (apiResponse.success) {
      return apiResponse;
    }

    // Fallback to HTML scraping
    console.log(`[OSHWA] API failed, falling back to HTML scraping for ${uid}`);
    return this.fetchFromHTML(uid, forceRefresh);
  }

  /**
   * Try fetching from API endpoint
   */
  private async fetchFromAPI(
    uid: string,
    forceRefresh: boolean
  ): Promise<APIResponse<OSHWACertification>> {
    const url = `/api/v1/projects/${uid}`;
    return this.makeRequest<OSHWACertification>(
      url,
      { method: 'GET' },
      `oshwa:api:${uid}`,
      forceRefresh
    );
  }

  /**
   * Fallback: scrape certification list HTML
   */
  private async fetchFromHTML(
    uid: string,
    forceRefresh: boolean
  ): Promise<APIResponse<OSHWACertification>> {
    const cacheKey = `oshwa:html:${uid}`;

    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = await this.cache.get<OSHWACertification>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached.data,
            fromCache: true,
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.warn('[OSHWA] Cache read error:', error);
      }
    }

    try {
      // Fetch certification list HTML
      const response = await axios.get(`${this.config.baseUrl}/list.html`, {
        timeout: this.config.timeout,
      });

      const html = response.data as string;

      // Parse HTML to extract certification data
      // This is a simplified parser - in production, you'd want a proper HTML parser
      const cert = this.parseHTMLForCertification(html, uid);

      if (!cert) {
        return {
          success: false,
          error: `Certification ${uid} not found in OSHWA list`,
          fromCache: false,
          timestamp: new Date().toISOString(),
        };
      }

      // Cache the result
      await this.cache.set(cacheKey, cert, this.config.cacheTtl);

      return {
        success: true,
        data: cert,
        fromCache: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fromCache: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Parse HTML to extract certification data
   * Note: This is a simplified implementation
   */
  private parseHTMLForCertification(
    html: string,
    uid: string
  ): OSHWACertification | null {
    // Look for table rows containing the UID
    const pattern = new RegExp(
      `<tr[^>]*>.*?${uid}.*?<td[^>]*>([^<]+)</td>.*?<td[^>]*>([^<]+)</td>.*?<td[^>]*>([^<]+)</td>.*?</tr>`,
      'is'
    );

    const match = html.match(pattern);

    if (!match) {
      return null;
    }

    return {
      uid,
      projectName: match[1].trim(),
      certificationType: match[2].toLowerCase() as
        | 'hardware'
        | 'software'
        | 'documentation',
      certificationDate: match[3].trim(),
      projectUrl: `${this.config.baseUrl}/certification/${uid}`,
    };
  }

  /**
   * Search certifications by name
   */
  async searchByName(query: string): Promise<APIResponse<OSHWAListResponse>> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/list.html`, {
        timeout: this.config.timeout,
      });

      const html = response.data as string;
      const certifications = this.parseHTMLList(html, query);

      return {
        success: true,
        data: {
          certifications,
          total: certifications.length,
        },
        fromCache: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fromCache: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Parse HTML list to extract matching certifications
   */
  private parseHTMLList(
    html: string,
    query: string
  ): OSHWAListResponse['certifications'] {
    const results: OSHWAListResponse['certifications'] = [];
    const lowerQuery = query.toLowerCase();

    // Extract all table rows
    const rowPattern =
      /<tr[^>]*>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([^<]+)<\/td>.*?<td[^>]*>([^<]+)<\/td>.*?<\/tr>/gis;

    let match;
    while ((match = rowPattern.exec(html)) !== null) {
      const name = match[1].trim();
      const uid = match[2].trim();
      const type = match[3].trim();
      const date = match[4].trim();

      // Filter by query
      if (
        name.toLowerCase().includes(lowerQuery) ||
        uid.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ name, uid, type, date });
      }
    }

    return results;
  }
}

/**
 * Singleton instance
 */
export const oshwaClient = new OSHWAClient();
