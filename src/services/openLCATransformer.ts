/**
 * Transformer to convert Trace Market ProductInstance data to openLCA schema format
 * OpenLCA API: https://lca.trace.market/api
 * OpenLCA Schema: https://greendelta.github.io/olca-schema/
 */

import type {
  ProductInstance,
  FoodInstance,
  Process,
  InputInstance,
  Impact,
  Pokedex,
} from '@trace.market/types';

/**
 * OpenLCA Schema Types
 */

interface OpenLCARef {
  '@type': string;
  '@id': string;
  name: string;
}

interface OpenLCAExchange {
  '@type': 'Exchange';
  internalId: number;
  amount: number;
  isAvoidedProduct: boolean;
  isInput: boolean;
  isQuantitativeReference: boolean;
  flow: OpenLCARef;
  unit: OpenLCARef;
  flowProperty: OpenLCARef;
  description?: string;
  location?: OpenLCARef;
}

interface OpenLCAProcess {
  '@type': 'Process';
  '@id': string;
  name: string;
  description?: string;
  processType: 'UNIT_PROCESS' | 'LCI_RESULT';
  location?: OpenLCARef;
  exchanges: OpenLCAExchange[];
  lastInternalId: number;
  processDocumentation?: {
    copyright: boolean;
    creationDate: string;
  };
}

interface OpenLCAProcessLink {
  '@type': 'ProcessLink';
  provider: OpenLCARef;
  flow: OpenLCARef;
  process: OpenLCARef;
  exchange: {
    '@type': 'ExchangeRef';
    internalId: number;
  };
}

interface OpenLCAProductSystem {
  '@type': 'ProductSystem';
  '@id': string;
  name: string;
  description?: string;
  refProcess: OpenLCARef;
  refExchange: {
    '@type': 'ExchangeRef';
    internalId: number;
  };
  targetAmount: number;
  targetFlowProperty: OpenLCARef;
  targetUnit: OpenLCARef;
  processes: OpenLCARef[];
  processLinks: OpenLCAProcessLink[];
}

/**
 * Standard unit and flow property references for openLCA
 */
const MASS_FLOW_PROPERTY: OpenLCARef = {
  '@type': 'FlowProperty',
  '@id': '93a60a56-a3c8-11da-a746-0800200b9a66',
  name: 'Mass',
};

const KG_UNIT: OpenLCARef = {
  '@type': 'Unit',
  '@id': '20aadc24-a391-41cf-b340-3e4529f44bde',
  name: 'kg',
};

/**
 * Context for tracking IDs and references during conversion
 */
interface ConversionContext {
  processes: Map<string, OpenLCAProcess>;
  flows: Map<string, OpenLCARef>;
  exchangeIdCounter: number;
}

/**
 * Create a unique ID for openLCA entities
 * Uses a simple UUID v4 implementation without external dependencies
 */
function createId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (c: string) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
  );
}

/**
 * Convert Trace Market timestamp to ISO date string
 */
const timestampToISO = (timestamp?: number): string => {
  // Handle missing or invalid timestamps by defaulting to now
  if (!timestamp || Number.isNaN(timestamp)) {
    return new Date().toISOString();
  }
  return new Date(timestamp * 1000).toISOString();
};

/**
 * Create a flow reference for a product
 */
function createFlowRef(
  instance: ProductInstance,
  context: ConversionContext
): OpenLCARef {
  const flowKey = `${instance.category}_${instance.type}`;

  const existingFlow = context.flows.get(flowKey);
  if (existingFlow) return existingFlow;

  const flowRef: OpenLCARef = {
    '@type': 'Flow',
    '@id': createId(),
    name: instance.title || instance.type,
  };
  context.flows.set(flowKey, flowRef);

  return flowRef;
}

/**
 * Create location reference from geographic coordinates
 */
function createLocationRef(
  locationName?: string,
  coordinates?: [number, number]
): OpenLCARef | undefined {
  if (!locationName && !coordinates) return undefined;

  return {
    '@type': 'Location',
    '@id': createId(),
    name: locationName || `Location [${coordinates?.[0]}, ${coordinates?.[1]}]`,
  };
}

/**
 * Convert InputInstance to OpenLCA Exchange
 */
function convertInputToExchange(
  input: InputInstance,
  context: ConversionContext
): OpenLCAExchange | null {
  if (typeof input.instance === 'string') {
    // Unresolved token ID - skip
    return null;
  }

  if ('errorMessage' in input.instance) {
    // Fetch error - skip
    return null;
  }

  const flowRef = createFlowRef(input.instance, context);
  const exchangeId = ++context.exchangeIdCounter;

  const exchange: OpenLCAExchange = {
    '@type': 'Exchange',
    internalId: exchangeId,
    amount: input.quantity / 1000, // Convert grams to kg
    isAvoidedProduct: false,
    isInput: true,
    isQuantitativeReference: false,
    flow: flowRef,
    unit: KG_UNIT,
    flowProperty: MASS_FLOW_PROPERTY,
    description: `Input: ${input.instance.type}${
      input.type === 'transported' ? ' (transported)' : ''
    }`,
  };

  // Add location if transported
  if (input.type === 'transported' && 'transport' in input) {
    // Could extract location from transport data if available
  }

  return exchange;
}

/**
 * Convert environmental impacts to exchanges (emissions)
 */
function convertImpactsToExchanges(
  impacts: Impact[] | undefined,
  context: ConversionContext
): OpenLCAExchange[] {
  if (!impacts) return [];

  return impacts.map((impact) => {
    const exchangeId = ++context.exchangeIdCounter;

    // Create flow for the impact
    const impactFlowKey = `${impact.category}_emission`;
    let flowRef = context.flows.get(impactFlowKey);
    if (!flowRef) {
      flowRef = {
        '@type': 'Flow',
        '@id': createId(),
        name: impact.category === 'carbon' ? 'Carbon dioxide' : 'Water',
      };
      context.flows.set(impactFlowKey, flowRef);
    }

    return {
      '@type': 'Exchange' as const,
      internalId: exchangeId,
      amount: impact.quantity,
      isAvoidedProduct: false,
      isInput: false, // Emissions are outputs
      isQuantitativeReference: false,
      flow: flowRef,
      unit:
        impact.category === 'carbon'
          ? KG_UNIT
          : { '@type': 'Unit', '@id': createId(), name: 'l' },
      flowProperty: MASS_FLOW_PROPERTY,
      description: `${impact.category} impact: ${impact.format}`,
    };
  });
}

/**
 * Convert Trace Market Process to OpenLCA Process
 */
function convertProcess(
  process: Process,
  outputInstance: ProductInstance,
  context: ConversionContext
): OpenLCAProcess {
  const processId = createId();

  // Create output exchange (what this process produces)
  const outputFlow = createFlowRef(outputInstance, context);
  const quantitativeRefId = ++context.exchangeIdCounter;

  const outputExchange: OpenLCAExchange = {
    '@type': 'Exchange',
    internalId: quantitativeRefId,
    amount: outputInstance.quantity / 1000, // Convert grams to kg
    isAvoidedProduct: false,
    isInput: false,
    isQuantitativeReference: true,
    flow: outputFlow,
    unit: KG_UNIT,
    flowProperty: MASS_FLOW_PROPERTY,
    description: `Output: ${outputInstance.type}`,
  };

  // Convert input exchanges
  const inputExchanges = process.inputInstances
    .map((input) => convertInputToExchange(input, context))
    .filter((ex): ex is OpenLCAExchange => ex !== null);

  // Convert environmental impacts to exchanges
  const impactExchanges = convertImpactsToExchanges(process.impacts, context);

  // Create location reference
  const location = createLocationRef(
    process.site?.label,
    process.site?.location?.coordinates as [number, number] | undefined
  );

  const openLCAProcess: OpenLCAProcess = {
    '@type': 'Process',
    '@id': processId,
    name: `${outputInstance.type} - ${process.type}`,
    description: `${process.type} process for ${outputInstance.type}`,
    processType: 'UNIT_PROCESS',
    location,
    exchanges: [outputExchange, ...inputExchanges, ...impactExchanges],
    lastInternalId: context.exchangeIdCounter,
    processDocumentation: {
      copyright: false,
      creationDate: timestampToISO(process.timestamp),
    },
  };

  context.processes.set(processId, openLCAProcess);

  return openLCAProcess;
}

/**
 * Convert nested product instance with supply chain to multiple processes
 */
function convertProductInstanceRecursive(
  instance: ProductInstance,
  context: ConversionContext
): OpenLCAProcess | null {
  if (instance.category !== 'food' || !instance.process) {
    return null;
  }

  const foodInstance = instance as FoodInstance;

  // First, recursively convert all input processes
  foodInstance.process.inputInstances.forEach((input) => {
    if (typeof input.instance === 'object' && 'category' in input.instance) {
      convertProductInstanceRecursive(input.instance, context);
    }
  });

  // Then convert this process
  return convertProcess(foodInstance.process, instance, context);
}

/**
 * Main conversion function: Convert Pokedex to OpenLCA ProductSystem
 */
export function convertToOpenLCA(
  pokedex: Pokedex
): OpenLCAProductSystem | null {
  const context: ConversionContext = {
    processes: new Map(),
    flows: new Map(),
    exchangeIdCounter: 0,
  };

  const instance = pokedex.instance;

  if (instance.category !== 'food' || !instance.process) {
    throw new Error(
      'Only food instances with processes can be converted to openLCA'
    );
  }

  // Convert all processes in the supply chain
  const mainProcess = convertProductInstanceRecursive(instance, context);

  if (!mainProcess) {
    return null;
  }

  // Create product system
  const systemId = createId();
  const productSystem: OpenLCAProductSystem = {
    '@type': 'ProductSystem',
    '@id': systemId,
    name: pokedex.instance.title || pokedex.instance.type,
    description: pokedex.description,
    refProcess: {
      '@type': 'Process',
      '@id': mainProcess['@id'],
      name: mainProcess.name,
    },
    refExchange: {
      '@type': 'ExchangeRef',
      internalId: 1, // The quantitative reference is always the first exchange (output)
    },
    targetAmount: instance.quantity / 1000, // Convert to kg
    targetFlowProperty: MASS_FLOW_PROPERTY,
    targetUnit: KG_UNIT,
    processes: Array.from(context.processes.values()),
    processLinks: [], // TODO: Create process links based on input-output relationships
  };

  return productSystem;
}

/**
 * Export all processes as individual files for openLCA zip package
 */
export function exportProcesses(pokedex: Pokedex): Map<string, OpenLCAProcess> {
  const context: ConversionContext = {
    processes: new Map(),
    flows: new Map(),
    exchangeIdCounter: 0,
  };

  convertProductInstanceRecursive(pokedex.instance, context);

  return context.processes;
}
