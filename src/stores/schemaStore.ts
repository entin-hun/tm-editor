import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  typeDescriptions as localDescriptions,
  getFieldDescription as localGetFieldDescription,
  getTypeDescription as localGetTypeDescription,
  TypeDescription,
  FieldDescription,
} from '@trace.market/types';
import axios from 'axios';

// Define the store
export const useSchemaStore = defineStore('schema', () => {
  // State
  const descriptions = ref<Record<string, TypeDescription>>({
    ...localDescriptions,
  });
  const currentVersion = ref<string>('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const processTypeOptions = ref<string[]>([]);

  const useMergedSchema =
    typeof import.meta !== 'undefined' &&
    ((import.meta as any)?.env?.VITE_USE_MERGED_SCHEMA === '1' ||
      (import.meta as any)?.env?.VITE_USE_MERGED_SCHEMA === 'true');
  const autoTryMergedInDev =
    typeof import.meta !== 'undefined' && !!(import.meta as any)?.env?.DEV;
  const shouldLoadMergedSchema = useMergedSchema || autoTryMergedInDev;
  const mergedSchemaUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta as any)?.env?.VITE_MERGED_SCHEMA_URL) ||
    '/merged-descriptions.json';
  const mergedTypesIndexUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta as any)?.env?.VITE_MERGED_TYPES_INDEX_URL) ||
    '/types-index.d.ts';

  function parseProcessTypeLiterals(typeSource: string): string[] {
    const interfacePattern =
      /export\s+interface\s+(\w+)\s+extends\s+GenericProcess\s*\{([\s\S]*?)\}/g;
    const literals: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = interfacePattern.exec(typeSource)) !== null) {
      const [, ifaceName, body] = match;
      if (!ifaceName.endsWith('Process')) continue;
      const typeMatch = body.match(/\btype\s*:\s*"([^"]+)"/);
      if (typeMatch?.[1]) {
        literals.push(typeMatch[1].trim());
      }
    }

    return Array.from(new Set(literals.filter(Boolean)));
  }

  async function loadProcessTypesFromTypeSource(version?: string) {
    try {
      const url = shouldLoadMergedSchema
        ? mergedTypesIndexUrl
        : `https://cdn.jsdelivr.net/npm/@trace.market/types@${version}/src/index.d.ts`;
      const response = await axios.get(url, { timeout: 5000 });
      if (typeof response.data === 'string') {
        processTypeOptions.value = parseProcessTypeLiterals(response.data);
        if (processTypeOptions.value.length > 0) {
          console.log(
            `[SchemaStore] Loaded ${processTypeOptions.value.length} process types from index.d.ts`
          );
        }
      }
    } catch (e: any) {
      console.warn(
        '[SchemaStore] Failed to load process types from index.d.ts',
        e
      );
    }
  }

  // Actions
  async function fetchVersion(version: string) {
    // In merged-schema mode, keep merged descriptions authoritative.
    if (shouldLoadMergedSchema) {
      if (currentVersion.value !== 'merged') {
        await loadMergedSchema();
      }
      if (processTypeOptions.value.length === 0) {
        await loadProcessTypesFromTypeSource();
      }
      return;
    }

    if (!version || version === currentVersion.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      // Fetch the JSON file from jsDelivr
      // Note: We need to ensure the package structure supports this path
      const url = `https://cdn.jsdelivr.net/npm/@trace.market/types@${version}/src/descriptions.json`;

      const response = await axios.get(url);
      if (response.data) {
        descriptions.value = response.data;
        currentVersion.value = version;
        console.log(`[SchemaStore] Loaded types version ${version}`);
        await loadProcessTypesFromTypeSource(version);
      }
    } catch (e: any) {
      console.error(`[SchemaStore] Failed to load version ${version}`, e);
      error.value = `Failed to load schema version ${version}. Falling back to local defaults.`;
      // Don't clear descriptions, keep the last good state (or local default)
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMergedSchema() {
    if (!shouldLoadMergedSchema) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await axios.get(mergedSchemaUrl, { timeout: 3000 });
      if (response.data) {
        descriptions.value = response.data;
        currentVersion.value = 'merged';
        console.log('[SchemaStore] Loaded merged schema');
        await loadProcessTypesFromTypeSource();
      }
    } catch (e: any) {
      console.warn('[SchemaStore] Failed to load merged schema', e);
      error.value =
        'Failed to load merged schema. Falling back to local defaults.';
    } finally {
      isLoading.value = false;
    }
  }

  function getFieldDescription(
    typeName: string,
    fieldName: string
  ): FieldDescription | undefined {
    return descriptions.value[typeName]?.fields[fieldName];
  }

  function getTypeDescription(typeName: string): TypeDescription | undefined {
    return descriptions.value[typeName];
  }

  function getAllTypeNames(): string[] {
    return Object.keys(descriptions.value);
  }

  function getProcessTypeOptions(): string[] {
    if (processTypeOptions.value.length > 0) {
      return [...processTypeOptions.value];
    }

    return Object.keys(descriptions.value)
      .filter((name) => name.endsWith('Process'))
      .map((name) => {
        const field = descriptions.value[name]?.fields?.type as
          | (FieldDescription & { examples?: string[] })
          | undefined;
        const literal = field?.examples?.find((item) => !!String(item).trim());
        return (literal || name.replace(/Process$/, '').toLowerCase()).trim();
      })
      .filter(Boolean);
  }

  type JsonSchema = {
    type?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
  };

  const numericFields = new Set([
    'quantity',
    'amount',
    'timestamp',
    'duration',
    'min',
    'max',
  ]);
  const booleanFields = new Set(['bio', 'recyclable']);

  function inferPrimitiveType(fieldName: string): string | undefined {
    if (numericFields.has(fieldName)) return 'number';
    if (booleanFields.has(fieldName)) return 'boolean';
    return 'string';
  }

  function buildJsonSchema(typeName: string, depth = 2): JsonSchema {
    const typeDesc = getTypeDescription(typeName);
    if (!typeDesc || depth < 0) return { type: 'object' };

    const properties: Record<string, JsonSchema> = {};
    Object.entries(typeDesc.fields || {}).forEach(([fieldName, fieldDesc]) => {
      const schemaField = fieldDesc as FieldDescription & { dataType?: string };
      if (schemaField?.dataType) {
        properties[fieldName] = buildJsonSchema(
          schemaField.dataType,
          depth - 1
        );
      } else {
        properties[fieldName] = { type: inferPrimitiveType(fieldName) };
      }
    });

    return { type: 'object', properties };
  }

  if (shouldLoadMergedSchema) {
    void loadMergedSchema();
  }

  return {
    descriptions,
    currentVersion,
    isLoading,
    error,
    loadMergedSchema,
    fetchVersion,
    getFieldDescription,
    getTypeDescription,
    getAllTypeNames,
    getProcessTypeOptions,
    buildJsonSchema,
  };
});
