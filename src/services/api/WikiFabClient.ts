/**
 * WikiFab API client
 * Documentation: https://www.mediawiki.org/wiki/API:Main_page
 */

import { BaseAPIClient } from './BaseAPIClient';
import { API_CONFIGS } from '../../config/apiConfig';
import type { APIResponse } from '../../types/decomposition';

/**
 * WikiFab tutorial data
 */
export interface WikiFabTutorial {
  pageId: number;
  title: string;
  url: string;
  description?: string;
  imageUrl?: string;
  // Tutorial steps
  steps?: Array<{
    number: number;
    title: string;
    description: string;
    imageUrl?: string;
  }>;
  // Materials/tools needed
  materials?: Array<{
    name: string;
    quantity?: string;
    unit?: string;
    notes?: string;
  }>;
  tools?: string[];
  // Metadata
  difficulty?: string;
  duration?: string;
  cost?: string;
  license?: string;
  author?: string;
  lastModified?: string;
}

/**
 * MediaWiki API search response
 */
interface MediaWikiSearchResponse {
  query: {
    search: Array<{
      pageid: number;
      title: string;
      snippet: string;
      timestamp: string;
    }>;
  };
}

/**
 * MediaWiki API page response
 */
interface MediaWikiPageResponse {
  query: {
    pages: Record<
      string,
      {
        pageid: number;
        title: string;
        extract?: string;
        revisions?: Array<{
          content?: string;
          timestamp?: string;
        }>;
        images?: Array<{
          title: string;
        }>;
      }
    >;
  };
}

/**
 * WikiFab API client
 */
export class WikiFabClient extends BaseAPIClient {
  constructor() {
    super(API_CONFIGS.wikiFab, 'WikiFab');
  }

  /**
   * Fetch tutorial by title or page ID
   */
  async fetchData(
    identifier: string,
    forceRefresh = false
  ): Promise<APIResponse<WikiFabTutorial>> {
    // Identifier can be page ID or title
    const isPageId = /^\d+$/.test(identifier);

    if (isPageId) {
      return this.fetchByPageId(parseInt(identifier, 10), forceRefresh);
    } else {
      return this.fetchByTitle(identifier, forceRefresh);
    }
  }

  /**
   * Fetch tutorial by page ID
   */
  private async fetchByPageId(
    pageId: number,
    forceRefresh: boolean
  ): Promise<APIResponse<WikiFabTutorial>> {
    const cacheKey = `wikifab:page:${pageId}`;

    const response = await this.makeRequest<MediaWikiPageResponse>(
      '',
      {
        method: 'GET',
        params: {
          action: 'query',
          format: 'json',
          pageids: pageId,
          prop: 'revisions|images|extracts',
          rvprop: 'content|timestamp',
          rvslots: 'main',
          exintro: true,
          explaintext: true,
        },
      },
      cacheKey,
      forceRefresh
    );

    if (!response.success || !response.data) {
      return response as APIResponse<WikiFabTutorial>;
    }

    // Transform MediaWiki response to WikiFabTutorial
    const tutorial = this.transformPageResponse(response.data);

    return {
      success: true,
      data: tutorial,
      fromCache: response.fromCache,
      timestamp: response.timestamp,
    };
  }

  /**
   * Fetch tutorial by title
   */
  private async fetchByTitle(
    title: string,
    forceRefresh: boolean
  ): Promise<APIResponse<WikiFabTutorial>> {
    const cacheKey = `wikifab:title:${title}`;

    const response = await this.makeRequest<MediaWikiPageResponse>(
      '',
      {
        method: 'GET',
        params: {
          action: 'query',
          format: 'json',
          titles: title,
          prop: 'revisions|images|extracts',
          rvprop: 'content|timestamp',
          rvslots: 'main',
          exintro: true,
          explaintext: true,
        },
      },
      cacheKey,
      forceRefresh
    );

    if (!response.success || !response.data) {
      return response as APIResponse<WikiFabTutorial>;
    }

    // Transform MediaWiki response to WikiFabTutorial
    const tutorial = this.transformPageResponse(response.data);

    return {
      success: true,
      data: tutorial,
      fromCache: response.fromCache,
      timestamp: response.timestamp,
    };
  }

  /**
   * Search tutorials by keywords
   */
  async searchByKeywords(
    query: string,
    limit = 20
  ): Promise<APIResponse<WikiFabTutorial[]>> {
    const response = await this.makeRequest<MediaWikiSearchResponse>(
      '',
      {
        method: 'GET',
        params: {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: query,
          srlimit: limit,
        },
      },
      `wikifab:search:${query}`,
      false
    );

    if (!response.success || !response.data) {
      return response as APIResponse<WikiFabTutorial[]>;
    }

    // Transform search results
    const tutorials: WikiFabTutorial[] = response.data.query.search.map(
      (result) => ({
        pageId: result.pageid,
        title: result.title,
        url: `https://wikifab.org/wiki/${encodeURIComponent(result.title)}`,
        description: result.snippet.replace(/<[^>]+>/g, ''), // Strip HTML tags
        lastModified: result.timestamp,
      })
    );

    return {
      success: true,
      data: tutorials,
      fromCache: response.fromCache,
      timestamp: response.timestamp,
    };
  }

  /**
   * Transform MediaWiki page response to WikiFabTutorial
   */
  private transformPageResponse(
    response: MediaWikiPageResponse
  ): WikiFabTutorial {
    const pages = Object.values(response.query.pages);
    const page = pages[0];

    if (!page) {
      throw new Error('No page data found');
    }

    const wikitext = page.revisions?.[0]?.content || '';

    return {
      pageId: page.pageid,
      title: page.title,
      url: `https://wikifab.org/wiki/${encodeURIComponent(page.title)}`,
      description: page.extract,
      steps: this.parseSteps(wikitext),
      materials: this.parseMaterials(wikitext),
      tools: this.parseTools(wikitext),
      lastModified: page.revisions?.[0]?.timestamp,
    };
  }

  /**
   * Parse tutorial steps from wikitext
   */
  private parseSteps(wikitext: string): WikiFabTutorial['steps'] {
    const steps: WikiFabTutorial['steps'] = [];

    // Look for step patterns (WikiFab uses specific templates)
    const stepPattern =
      /\{\{Tuto Step\s*\|.*?title\s*=\s*([^\|]+).*?\|.*?content\s*=\s*([^\}]+)\}\}/gis;

    let match;
    let stepNumber = 1;

    while ((match = stepPattern.exec(wikitext)) !== null) {
      steps.push({
        number: stepNumber++,
        title: match[1].trim(),
        description: match[2].trim(),
      });
    }

    return steps.length > 0 ? steps : undefined;
  }

  /**
   * Parse materials from wikitext
   */
  private parseMaterials(wikitext: string): WikiFabTutorial['materials'] {
    const materials: WikiFabTutorial['materials'] = [];

    // Look for materials section
    const materialsPattern = /\{\{Tuto Materials\s*\|(.*?)\}\}/is;
    const match = wikitext.match(materialsPattern);

    if (match) {
      const materialsText = match[1];

      // Parse individual materials
      const materialLines = materialsText
        .split(/\n/)
        .filter((line) => line.trim());

      for (const line of materialLines) {
        // Format: |material=Name, quantity, unit
        const materialMatch = line.match(
          /\|material\s*=\s*([^,]+)(?:,\s*([^,]+))?(?:,\s*([^,]+))?/
        );

        if (materialMatch) {
          materials.push({
            name: materialMatch[1].trim(),
            quantity: materialMatch[2]?.trim(),
            unit: materialMatch[3]?.trim(),
          });
        }
      }
    }

    return materials.length > 0 ? materials : undefined;
  }

  /**
   * Parse tools from wikitext
   */
  private parseTools(wikitext: string): string[] | undefined {
    const tools: string[] = [];

    // Look for tools section
    const toolsPattern = /\{\{Tuto Tools\s*\|(.*?)\}\}/is;
    const match = wikitext.match(toolsPattern);

    if (match) {
      const toolsText = match[1];

      // Parse individual tools
      const toolLines = toolsText.split(/\n/).filter((line) => line.trim());

      for (const line of toolLines) {
        const toolMatch = line.match(/\|tool\s*=\s*(.+)/);
        if (toolMatch) {
          tools.push(toolMatch[1].trim());
        }
      }
    }

    return tools.length > 0 ? tools : undefined;
  }
}

/**
 * Singleton instance
 */
export const wikiFabClient = new WikiFabClient();
