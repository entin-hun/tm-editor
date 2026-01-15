/**
 * Decomposition engine for recursive product breakdown
 * Handles depth limits, circular dependencies, and parallel fetching
 */

import type {
  DecompositionNode,
  FoodInstanceWithSources,
  ProductInstanceWithSources,
  ProcessInstanceWithSources,
} from '../types/decomposition';
import type { InputInstance } from '@trace.market/types';
import { DECOMPOSITION_CONFIG } from '../config/apiConfig';
import { openFoodFactsClient } from './api/OpenFoodFactsClient';
import { oshwaClient } from './api/OSHWAClient';
import { wikiFabClient } from './api/WikiFabClient';
import { openFoodFactsTransformer } from './transformers/OpenFoodFactsTransformer';
import { oshwaTransformer } from './transformers/OSHWATransformer';
import { wikiFabTransformer } from './transformers/WikiFabTransformer';

/**
 * Product type for data source selection
 */
export type ProductType = 'Food' | 'Hardware' | 'General';

/**
 * Decomposition progress callback
 */
export type ProgressCallback = (status: {
  currentDepth: number;
  nodesProcessed: number;
  totalNodes: number;
  message: string;
}) => void;

/**
 * Decomposition options
 */
export interface DecompositionOptions {
  /** Maximum depth (default from config) */
  maxDepth?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Whether to fetch in parallel (default: true) */
  parallel?: boolean;
  /** Force refresh cached data */
  forceRefresh?: boolean;
  /** Stop on first error (default: false, continues with partial results) */
  stopOnError?: boolean;
}

/**
 * Decomposition engine
 */
export class DecompositionEngine {
  private visited = new Set<string>();
  private nodesProcessed = 0;
  private totalNodes = 0;

  /**
   * Decompose a product recursively
   */
  async decomposeProduct(
    identifier: string,
    productType: ProductType,
    options: DecompositionOptions = {}
  ): Promise<DecompositionNode> {
    // Reset state
    this.visited.clear();
    this.nodesProcessed = 0;
    this.totalNodes = 1;

    const maxDepth = options.maxDepth ?? DECOMPOSITION_CONFIG.maxDepth;

    // Start decomposition
    return this.decomposeRecursive(
      identifier,
      productType,
      0,
      maxDepth,
      options
    );
  }

  /**
   * Recursive decomposition with depth tracking
   */
  private async decomposeRecursive(
    identifier: string,
    productType: ProductType,
    currentDepth: number,
    maxDepth: number,
    options: DecompositionOptions
  ): Promise<DecompositionNode> {
    const nodeId = `${productType}:${identifier}:${currentDepth}`;

    // Check circular dependency
    if (this.visited.has(nodeId)) {
      console.warn(`[Decomposition] Circular dependency detected: ${nodeId}`);
      return this.createTruncatedNode(
        nodeId,
        identifier,
        currentDepth,
        'circular_dependency'
      );
    }

    // Check depth limit
    if (currentDepth >= maxDepth) {
      console.log(`[Decomposition] Max depth reached: ${currentDepth}`);
      return this.createTruncatedNode(
        nodeId,
        identifier,
        currentDepth,
        'depth_limit'
      );
    }

    // Mark as visited
    this.visited.add(nodeId);

    // Report progress
    this.nodesProcessed++;
    options.onProgress?.({
      currentDepth,
      nodesProcessed: this.nodesProcessed,
      totalNodes: this.totalNodes,
      message: `Fetching ${productType}: ${identifier}`,
    });

    // Fetch and transform data based on product type
    try {
      const node = await this.fetchAndTransform(
        identifier,
        productType,
        currentDepth,
        options.forceRefresh ?? false
      );

      // Get inputs for recursive decomposition
      const inputs = this.extractInputs(node);

      if (inputs.length > 0 && currentDepth < maxDepth - 1) {
        // Update total nodes estimate
        this.totalNodes += inputs.length;

        // Decompose inputs
        if (options.parallel !== false) {
          // Parallel decomposition
          node.children = await this.decomposeInputsParallel(
            inputs,
            currentDepth + 1,
            maxDepth,
            options
          );
        } else {
          // Sequential decomposition
          node.children = await this.decomposeInputsSequential(
            inputs,
            currentDepth + 1,
            maxDepth,
            options
          );
        }
      }

      return node;
    } catch (error) {
      console.error(`[Decomposition] Error fetching ${identifier}:`, error);

      if (options.stopOnError) {
        throw error;
      }

      // Return error node
      return this.createErrorNode(
        nodeId,
        identifier,
        currentDepth,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Fetch and transform data from appropriate API
   */
  private async fetchAndTransform(
    identifier: string,
    productType: ProductType,
    depth: number,
    forceRefresh: boolean
  ): Promise<DecompositionNode> {
    let data: FoodInstanceWithSources | ProductInstanceWithSources;
    let process: ProcessInstanceWithSources | undefined;

    switch (productType) {
      case 'Food': {
        const response = await openFoodFactsClient.fetchData(
          identifier,
          forceRefresh
        );

        if (!response.success || !response.data) {
          throw new Error(
            response.error || 'Failed to fetch from OpenFoodFacts'
          );
        }

        // Handle case where product is not found (common for ingredients like "en:water")
        if (response.data.status === 0 || !response.data.product) {
          data = {
            type: identifier,
            category: 'food',
            bio: false,
            quantity: 1,
            grade: 'standard',
            size: 'standard',
            externalSources: [
              {
                source: 'OpenFoodFacts',
                id: identifier,
                url: `https://world.openfoodfacts.org/product/${identifier}`,
                confidence: 0.5, // Lower confidence for unverified ingredients
                fetchedAt: new Date().toISOString(),
              },
            ],
            decompositionMetadata: {
              autoGenerated: true,
              manuallyEdited: false,
              depth,
              truncated: true, // Mark as truncated/leaf since we can't find details
            },
          };
          // No process or ingredients available
          break;
        }

        const transformResult = openFoodFactsTransformer.transform(
          response.data
        );

        if (transformResult.errors && transformResult.errors.length > 0) {
          throw new Error(
            `Transformation errors: ${transformResult.errors.join(', ')}`
          );
        }

        data = transformResult.data;

        // Transform ingredients separately (FoodInstance doesn't hold them directly)
        const ingredients = openFoodFactsTransformer.transformIngredients(
          response.data.product.ingredients
        );

        // Extract process from NOVA classification
        const novaProcess = openFoodFactsTransformer.extractProcessFromNova(
          (response.data.product as { nova_group?: number }).nova_group
        );

        if (novaProcess || ingredients.length > 0) {
          // As requested: ensure we use a blending process with inputInstances
          process = {
            type:
              ingredients.length > 0
                ? 'blending'
                : novaProcess?.processType || 'unknown',
            // Standard Process fields defaults
            timestamp: Date.now(),

            category: 'food_processing',
            description:
              novaProcess?.processDescription ||
              'Composition from OpenFoodFacts',
            externalSources: data.externalSources,
            inputInstances: ingredients,
            decompositionMetadata: {
              autoGenerated: true,
              manuallyEdited: false,
              depth,
              truncated: false,
            },
          } as any;
        }
        break;
      }

      case 'Hardware': {
        const response = await oshwaClient.fetchData(identifier, forceRefresh);

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to fetch from OSHWA');
        }

        const transformResult = oshwaTransformer.transform(response.data);

        if (transformResult.errors && transformResult.errors.length > 0) {
          throw new Error(
            `Transformation errors: ${transformResult.errors.join(', ')}`
          );
        }

        data = transformResult.data;
        process = oshwaTransformer.extractAssemblyProcess(response.data) as any;
        break;
      }

      case 'General': {
        const response = await wikiFabClient.fetchData(
          identifier,
          forceRefresh
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to fetch from WikiFab');
        }

        const transformResult = wikiFabTransformer.transform(response.data);

        if (transformResult.errors && transformResult.errors.length > 0) {
          throw new Error(
            `Transformation errors: ${transformResult.errors.join(', ')}`
          );
        }

        data = transformResult.data;

        // Extract first manufacturing step as main process
        const processes = wikiFabTransformer.extractProcesses(response.data);
        process = processes[0] as any;
        break;
      }

      default:
        throw new Error(`Unknown product type: ${productType}`);
    }

    // Build decomposition node
    return {
      id: `${productType}:${identifier}:${depth}`,
      data,
      process,
      children: [],
      expanded: depth === 0, // Expand root node by default
      loading: false,
      metadata: {
        autoGenerated: true,
        manuallyEdited: false,
        depth,
        truncated: false,
      },
    };
  }

  /**
   * Extract inputs from decomposition node
   */
  private extractInputs(node: DecompositionNode): InputInstance[] {
    // Check for process inputs (preferred)
    const nodeProcess = node.process as any;
    if (nodeProcess && nodeProcess.inputInstances) {
      return nodeProcess.inputInstances;
    }

    // Check for inputs (ProductInstance)
    // Cast to any because 'inputs' might not exist on all ProductInstance types
    const nodeData = node.data as any;
    if (nodeData.inputs) {
      return nodeData.inputs;
    }

    return [];
  }

  /**
   * Decompose inputs in parallel
   */
  private async decomposeInputsParallel(
    inputs: InputInstance[],
    currentDepth: number,
    maxDepth: number,
    options: DecompositionOptions
  ): Promise<DecompositionNode[]> {
    // Limit parallelism
    const chunkSize = DECOMPOSITION_CONFIG.maxParallelRequests;
    const children: DecompositionNode[] = [];

    for (let i = 0; i < inputs.length; i += chunkSize) {
      const chunk = inputs.slice(i, i + chunkSize);

      const results = await Promise.all(
        chunk.map((input) =>
          this.decomposeInput(input, currentDepth, maxDepth, options)
        )
      );

      children.push(...results);
    }

    return children;
  }

  /**
   * Decompose inputs sequentially
   */
  private async decomposeInputsSequential(
    inputs: InputInstance[],
    currentDepth: number,
    maxDepth: number,
    options: DecompositionOptions
  ): Promise<DecompositionNode[]> {
    const children: DecompositionNode[] = [];

    for (const input of inputs) {
      const child = await this.decomposeInput(
        input,
        currentDepth,
        maxDepth,
        options
      );
      children.push(child);
    }

    return children;
  }

  /**
   * Decompose a single input
   */
  private async decomposeInput(
    input: InputInstance,
    currentDepth: number,
    maxDepth: number,
    options: DecompositionOptions
  ): Promise<DecompositionNode> {
    // Safety check: if instance is a string (TokenId), we can't extract much
    if (typeof input.instance === 'string') {
      return this.createLeafNode(input, currentDepth);
    }

    const instance = input.instance as any; // Cast to access extra properties like externalSources
    const productType = this.inferProductType(instance.category);

    // Try to find the technical identifier (e.g. from OpenFoodFacts source)
    // fallback to type/name
    let identifier = '';

    if (instance.externalSources && instance.externalSources.length > 0) {
      // Prefer OFF or similar authoritative ID
      const source = instance.externalSources.find(
        (s: any) => s.source === 'OpenFoodFacts'
      );
      if (source) identifier = source.id;
      else identifier = instance.externalSources[0].id;
    }

    if (!identifier) {
      identifier = instance.type || ''; // Name of the product
    }

    if (!identifier) {
      // Can't decompose without identifier
      return this.createLeafNode(input, currentDepth);
    }

    try {
      return await this.decomposeRecursive(
        identifier,
        productType,
        currentDepth,
        maxDepth,
        options
      );
    } catch (error) {
      console.error(
        `[Decomposition] Error decomposing input ${identifier}:`,
        error
      );

      // Return leaf node with the input data
      return this.createLeafNode(input, currentDepth);
    }
  }

  /**
   * Infer product type from category
   */
  private inferProductType(category?: string): ProductType {
    if (!category) return 'General';

    const lower = category.toLowerCase();

    if (lower.includes('food') || lower.includes('ingredient')) {
      return 'Food';
    }

    if (lower.includes('hardware') || lower.includes('electronic')) {
      return 'Hardware';
    }

    return 'General';
  }

  /**
   * Create a truncated node (depth limit or circular dependency)
   */
  private createTruncatedNode(
    id: string,
    identifier: string,
    depth: number,
    reason: 'depth_limit' | 'circular_dependency'
  ): DecompositionNode {
    return {
      id,
      data: {
        type: identifier,
        category: 'food',
        bio: false,
        quantity: 1,
        grade: 'standard',
        size: 'standard',
        decompositionMetadata: {
          autoGenerated: false,
          manuallyEdited: false,
          depth,
          truncated: true,
          truncationReason: reason,
        },
      } as ProductInstanceWithSources,
      children: [],
      expanded: false,
      loading: false,
      metadata: {
        autoGenerated: false,
        manuallyEdited: false,
        depth,
        truncated: true,
        truncationReason: reason,
      },
    };
  }

  /**
   * Create an error node
   */
  private createErrorNode(
    id: string,
    identifier: string,
    depth: number,
    errorMessage: string
  ): DecompositionNode {
    return {
      id,
      data: {
        type: identifier,
        category: 'food',
        bio: false,
        quantity: 1,
        grade: 'standard',
        size: 'standard',
        decompositionMetadata: {
          autoGenerated: false,
          manuallyEdited: false,
          depth,
          truncated: true,
          truncationReason: 'api_error',
        },
      } as ProductInstanceWithSources,
      children: [],
      expanded: false,
      loading: false,
      error: errorMessage,
      metadata: {
        autoGenerated: false,
        manuallyEdited: false,
        depth,
        truncated: true,
        truncationReason: 'api_error',
      },
    };
  }

  /**
   * Create a leaf node from input instance
   */
  private createLeafNode(
    input: InputInstance,
    depth: number
  ): DecompositionNode {
    // Extract ID from instance if possible
    let id = 'unknown';
    let data_object: any = input;

    if (typeof input.instance !== 'string') {
      const pInstance = input.instance as any;
      if (pInstance.externalSources?.[0]?.id) {
        id = pInstance.externalSources[0].id;
      } else {
        id = pInstance.type || 'unknown';
      }
      // For the leaf node "data", we used to return the input itself (ProductInstance-ish)
      // But the DecompositionNode.data expects ProductInstanceWithSources.
      // We can extract the inner instance.
      const defaultData = {
        grade: 'standard',
        size: 'standard',
        bio: false,
        quantity: 1,
      };

      data_object = {
        ...defaultData,
        ...pInstance,
        decompositionMetadata: {
          autoGenerated: false,
          manuallyEdited: false,
          depth,
          truncated: false,
        },
      };
    }

    return {
      id: `input:${id}:${depth}`,
      data: data_object,
      children: [],
      expanded: false,
      loading: false,
      metadata: {
        autoGenerated: false,
        manuallyEdited: false,
        depth,
        truncated: false,
      },
    };
  }
}

/**
 * Singleton instance
 */
export const decompositionEngine = new DecompositionEngine();
