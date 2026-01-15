/**
 * Pinia store for product decomposition workflow
 */

import { defineStore } from 'pinia';
import type {
  ImportWizardState,
  SearchResult,
  DecompositionNode,
} from '../types/decomposition';
import type { ProductType } from '../services/DecompositionEngine';
import { decompositionEngine } from '../services/DecompositionEngine';
import { openFoodFactsClient } from '../services/api/OpenFoodFactsClient';
import { oshwaClient } from '../services/api/OSHWAClient';
import { wikiFabClient } from '../services/api/WikiFabClient';
import { semanticSearchEngine } from '../services/SemanticSearchEngine';
import type { SemanticSearchResult } from '../types/ai';

export const useDecompositionStore = defineStore('decomposition', {
  state: (): ImportWizardState & {
    decompositionProgress: {
      currentDepth: number;
      nodesProcessed: number;
      totalNodes: number;
      message: string;
    } | null;
    isWizardActive: boolean;
    onWizardAccept?: (node: DecompositionNode) => void;
  } => ({
    currentStep: 1,
    productType: undefined,
    searchQuery: '',
    searchResults: [],
    selectedResult: undefined,
    previewTree: undefined,
    loading: false,
    error: undefined,
    decompositionProgress: null,
    isWizardActive: false,
    onWizardAccept: undefined,
  }),

  actions: {
    /**
     * Initialize wizard
     */
    startWizard(onAccept?: (node: DecompositionNode) => void) {
      this.currentStep = 1;
      this.productType = undefined;
      this.searchQuery = '';
      this.searchResults = [];
      this.selectedResult = undefined;
      this.previewTree = undefined;
      this.loading = false;
      this.error = undefined;
      this.decompositionProgress = null;
      this.isWizardActive = true;
      this.onWizardAccept = onAccept;
    },

    closeWizard() {
      this.isWizardActive = false;
      this.onWizardAccept = undefined;
    },

    /**
     * Go to next step
     */
    nextStep() {
      if (this.currentStep < 5) {
        this.currentStep++;
      }
    },

    /**
     * Go to previous step
     */
    previousStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
      }
    },

    /**
     * Set product type (step 1)
     */
    setProductType(type: ProductType) {
      this.productType = type;
      this.error = undefined;
    },

    /**
     * Search external databases (step 2)
     */
    async searchDatabases(query: string) {
      this.searchQuery = query;
      this.loading = true;
      this.error = undefined;
      this.searchResults = [];

      try {
        const results: SearchResult[] = [];

        switch (this.productType) {
          case 'Food': {
            const response = await openFoodFactsClient.searchByName(
              query,
              1,
              20
            );

            console.log(
              '[DecompositionStore] OpenFoodFacts response keys:',
              response?.data ? Object.keys(response.data) : 'no data'
            );

            const products = response?.data?.products ?? [];

            // Filter out products without decomposition data (ingredients)
            const validProducts = products.filter(
              (p: any) =>
                Array.isArray(p.ingredients) && p.ingredients.length > 0
            );

            if (
              response.success &&
              Array.isArray(validProducts) &&
              validProducts.length > 0
            ) {
              results.push(
                ...validProducts.map((product, index) => ({
                  source: 'OpenFoodFacts',
                  id: (product as { code?: string }).code || `product-${index}`,
                  name:
                    (product as { product_name?: string }).product_name ||
                    'Unknown Product',
                  description: (product as { brands?: string }).brands,
                  imageUrl: (product as { image_small_url?: string })
                    .image_small_url,
                  confidence:
                    (product as { completeness?: number }).completeness || 0.5,
                  metadata: product,
                }))
              );
            } else {
              console.warn(
                `[DecompositionStore] OpenFoodFacts returned no products with decomposition data for query "${query}".`
              );
            }
            break;
          }

          case 'Hardware': {
            const response = await oshwaClient.searchByName(query);
            console.log('[DecompositionStore] OSHWA response:', response);
            const certifications = response?.data?.certifications ?? [];

            if (
              response.success &&
              Array.isArray(certifications) &&
              certifications.length > 0
            ) {
              results.push(
                ...certifications.map((cert) => ({
                  source: 'OSHWA',
                  id: cert.uid,
                  name: cert.name,
                  description: `${cert.type} - Certified ${cert.date}`,
                  confidence: 0.8, // OSHWA certifications are fairly reliable
                  metadata: cert,
                }))
              );
            } else {
              console.warn(
                '[DecompositionStore] OSHWA returned no certifications for query',
                query
              );
            }
            break;
          }

          case 'General': {
            const response = await wikiFabClient.searchByKeywords(query, 20);
            console.log('[DecompositionStore] WikiFab response:', response);
            const tutorials = response?.data ?? [];

            if (
              response.success &&
              Array.isArray(tutorials) &&
              tutorials.length > 0
            ) {
              results.push(
                ...tutorials.map((tutorial) => ({
                  source: 'WikiFab',
                  id: tutorial.pageId.toString(),
                  name: tutorial.title,
                  description: tutorial.description,
                  imageUrl: tutorial.imageUrl,
                  confidence: 0.7, // WikiFab tutorials vary in quality
                  metadata: tutorial,
                }))
              );
            } else {
              console.warn(
                '[DecompositionStore] WikiFab returned no tutorials for query',
                query
              );
            }
            break;
          }
        }

        // Apply semantic search if AI is configured
        if (semanticSearchEngine.isAvailable() && results.length > 0) {
          console.log(
            '[DecompositionStore] Applying semantic search re-ranking'
          );
          try {
            const semanticResults = await semanticSearchEngine.reRankResults(
              query,
              results
            );
            // Map semantic results back to SearchResult format with similarity
            this.searchResults = Array.isArray(semanticResults)
              ? semanticResults.map((sr) => ({
                  ...sr,
                  similarityScore: sr.similarityScore,
                }))
              : results;
          } catch (error) {
            console.warn(
              '[DecompositionStore] Semantic search failed, using keyword results:',
              error
            );
            this.searchResults = results;
          }
        } else {
          this.searchResults = results;
        }

        if (this.searchResults.length === 0) {
          this.error = 'No results found. Try a different search term.';
        }
      } catch (error) {
        console.error('[DecompositionStore] Search error:', error);
        this.error =
          error instanceof Error
            ? error.message
            : 'Search failed. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Select a search result (step 3)
     */
    selectResult(result: SearchResult) {
      this.selectedResult = result;
      this.error = undefined;
    },

    /**
     * Generate decomposition preview (step 3 → 4)
     */
    async generatePreview() {
      if (!this.selectedResult || !this.productType) {
        this.error = 'No result selected';
        return;
      }

      this.loading = true;
      this.error = undefined;
      this.decompositionProgress = null;

      try {
        const tree = await decompositionEngine.decomposeProduct(
          this.selectedResult.id,
          this.productType,
          {
            maxDepth: 3,
            parallel: true,
            forceRefresh: false,
            onProgress: (progress) => {
              this.decompositionProgress = progress;
            },
          }
        );

        this.previewTree = tree;
        this.currentStep = 4; // Move to preview step
      } catch (error) {
        console.error('[DecompositionStore] Decomposition error:', error);
        this.error =
          error instanceof Error
            ? error.message
            : 'Failed to generate decomposition. Please try again.';
      } finally {
        this.loading = false;
        this.decompositionProgress = null;
      }
    },

    /**
     * Toggle node expansion in preview tree
     */
    toggleNodeExpansion(nodeId: string) {
      if (!this.previewTree) return;

      const toggleNode = (node: DecompositionNode): boolean => {
        if (node.id === nodeId) {
          node.expanded = !node.expanded;
          return true;
        }

        for (const child of node.children) {
          if (toggleNode(child)) {
            return true;
          }
        }

        return false;
      };

      toggleNode(this.previewTree);
    },

    /**
     * Edit a node in preview tree
     */
    updateNode(nodeId: string, updates: Partial<DecompositionNode['data']>) {
      if (!this.previewTree) return;

      const updateNode = (node: DecompositionNode): boolean => {
        if (node.id === nodeId) {
          // Merge updates into node data
          Object.assign(node.data, updates);

          // Mark as manually edited
          if (node.data.decompositionMetadata) {
            node.data.decompositionMetadata.manuallyEdited = true;
          }

          return true;
        }

        for (const child of node.children) {
          if (updateNode(child)) {
            return true;
          }
        }

        return false;
      };

      updateNode(this.previewTree);
    },

    /**
     * Accept preview and return data (step 5)
     */
    acceptPreview(): DecompositionNode | null {
      if (!this.previewTree) {
        this.error = 'No preview available';
        return null;
      }

      return this.previewTree;
    },

    finishWizard() {
      const data = this.acceptPreview();
      if (data && this.onWizardAccept) {
        this.onWizardAccept(data);
      }
      this.closeWizard();
    },

    /**
     * Cancel wizard
     */
    cancelWizard() {
      this.closeWizard();
    },

    /**
     * Clear cache for all APIs
     */
    async clearCache() {
      try {
        await Promise.all([
          openFoodFactsClient.clearCache(),
          oshwaClient.clearCache(),
          wikiFabClient.clearCache(),
        ]);
      } catch (error) {
        console.error('[DecompositionStore] Clear cache error:', error);
        throw error;
      }
    },
  },

  getters: {
    /**
     * Check if current step is valid
     */
    canProceed(): boolean {
      switch (this.currentStep) {
        case 1:
          return this.productType !== undefined;
        case 2:
          return this.searchResults.length > 0;
        case 3:
          return this.selectedResult !== undefined;
        case 4:
          return this.previewTree !== undefined;
        case 5:
          return true;
        default:
          return false;
      }
    },

    /**
     * Get step title
     */
    stepTitle(): string {
      const titles = [
        'Select Product Type',
        'Search Database',
        'Select Product',
        'Preview Decomposition',
        'Confirm & Import',
      ];
      return titles[this.currentStep - 1] || '';
    },

    /**
     * Check if loading
     */
    isLoading(): boolean {
      return this.loading;
    },

    /**
     * Get error message
     */
    errorMessage(): string | undefined {
      return this.error;
    },

    /**
     * Get progress message
     */
    progressMessage(): string {
      if (this.decompositionProgress) {
        return this.decompositionProgress.message;
      }
      return '';
    },

    /**
     * Get progress percentage
     */
    progressPercentage(): number {
      if (!this.decompositionProgress) return 0;

      const { nodesProcessed, totalNodes } = this.decompositionProgress;
      if (totalNodes === 0) return 0;

      return Math.min(100, Math.round((nodesProcessed / totalNodes) * 100));
    },

    /**
     * Check if semantic search is available
     */
    useSemanticSearch(): boolean {
      return semanticSearchEngine.isAvailable();
    },
  },
});
