/**
 * Client for openLCA API
 * API endpoint: https://lca.trace.market/result/calculate
 * Documentation: https://greendelta.github.io/openLCA-ApiDoc/
 */

import axios from 'axios';
import type { Pokedex } from '@trace.market/types';
import { convertToOpenLCA, exportProcesses } from './openLCATransformer';

const OPENLCA_API_URL = 'https://lca.trace.market/result/calculate';

export interface OpenLCACalculationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Submit a product system to openLCA for LCA calculation
 */
export async function calculateImpacts(
  pokedex: Pokedex
): Promise<OpenLCACalculationResult> {
  try {
    // Convert Trace Market data to openLCA format
    const productSystem = convertToOpenLCA(pokedex);

    if (!productSystem) {
      return {
        success: false,
        error: 'Could not convert product data to openLCA format',
      };
    }

    // Send to openLCA API for calculation
    const response = await axios.post(OPENLCA_API_URL, {
      productSystem,
      // Add calculation parameters
      calculationSetup: {
        impactMethod: {
          '@type': 'ImpactMethod',
          '@id': 'default-method-id', // Would need to be configured
          name: 'Default Impact Method',
        },
        allocationMethod: 'PHYSICAL_ALLOCATION',
        withCosts: true,
        withRegionalization: false,
      },
    });

    return {
      success: true,
      data: response.data as unknown,
    };
  } catch (error: unknown) {
    console.error('OpenLCA calculation error:', error);
    return {
      success: false,
      error:
        (error instanceof Error ? error.message : String(error)) ||
        'Failed to calculate impacts',
    };
  }
}

/**
 * Get estimated impacts without full LCA calculation
 * This is a simplified version that uses the existing impact data
 */
export function estimateImpacts(pokedex: Pokedex): {
  carbon: number;
  water: number;
} {
  const impacts = {
    carbon: 0,
    water: 0,
  };

  type ImpactRecord = { category: string; quantity: number };
  type ProcessInstance = {
    category?: string;
    process?: {
      impacts?: ImpactRecord[];
      inputInstances?: Array<{ instance?: ProcessInstance }>;
    };
  };

  function traverseProcess(instance?: ProcessInstance) {
    if (!instance) return;

    if (instance.category === 'food' && instance.process) {
      // Add impacts from this process
      instance.process.impacts?.forEach((impact) => {
        if (impact.category === 'carbon') {
          impacts.carbon += impact.quantity;
        } else if (impact.category === 'water') {
          impacts.water += impact.quantity;
        }
      });

      // Traverse inputs
      instance.process.inputInstances?.forEach((input) => {
        if (input.instance) {
          traverseProcess(input.instance);
        }
      });
    }
  }

  traverseProcess(pokedex.instance as ProcessInstance);

  return impacts;
}

/**
 * Export processes for manual import into openLCA desktop application
 */
export function exportForOpenLCA(pokedex: Pokedex): Blob {
  const processes = exportProcesses(pokedex);
  const processesArray = Array.from(processes.values());

  // Create JSON file for export
  const exportData = {
    '@context': 'http://greendelta.github.io/olca-schema/context.jsonld',
    '@graph': processesArray,
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Download openLCA export file
 */
export function downloadOpenLCAExport(pokedex: Pokedex, filename?: string) {
  const blob = exportForOpenLCA(pokedex);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${pokedex.instance.type}_openLCA.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
