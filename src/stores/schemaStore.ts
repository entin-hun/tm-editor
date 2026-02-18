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

  const useMergedSchema =
    typeof import.meta !== 'undefined' &&
    ((import.meta as any)?.env?.VITE_USE_MERGED_SCHEMA === '1' ||
      (import.meta as any)?.env?.VITE_USE_MERGED_SCHEMA === 'true');
  const mergedSchemaUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta as any)?.env?.VITE_MERGED_SCHEMA_URL) ||
    '/merged-descriptions.json';

  // Actions
  async function fetchVersion(version: string) {
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
    if (!useMergedSchema) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await axios.get(mergedSchemaUrl, { timeout: 3000 });
      if (response.data) {
        descriptions.value = response.data;
        currentVersion.value = 'merged';
        console.log('[SchemaStore] Loaded merged schema');
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
      if (fieldDesc?.dataType) {
        properties[fieldName] = buildJsonSchema(fieldDesc.dataType, depth - 1);
      } else {
        properties[fieldName] = { type: inferPrimitiveType(fieldName) };
      }
    });

    return { type: 'object', properties };
  }

  if (useMergedSchema) {
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
    buildJsonSchema,
  };
});
