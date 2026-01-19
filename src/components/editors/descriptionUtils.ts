/**
 * Utility functions for working with type descriptions in components
 */

import {
  type FieldDescription,
  type TypeDescription,
} from '@trace.market/types';
import { useSchemaStore } from '../../stores/schemaStore';

/**
 * Get field description with sensible defaults (reactive to schema version changes)
 * @param typeName - Name of the type
 * @param fieldName - Name of the field
 * @param fallbackLabel - Fallback label if description not found
 * @returns Field description or a minimal object with the label
 */
export function getFieldDescriptionOrDefault(
  typeName: string,
  fieldName: string,
  fallbackLabel?: string
): FieldDescription | { label: string; description: string } {
  // Use the store instance. Note: This function must be called inside a component/composable context
  // or after Pinia is installed.
  const schemaStore = useSchemaStore();
  const description = schemaStore.getFieldDescription(typeName, fieldName);
  
  if (description) {
    return description;
  }
  return {
    label: fallbackLabel || fieldName,
    description: `No description available for ${fieldName}`,
  };
}


/**
 * Get type description
 */
export function getTypeDescriptionInfo(
  typeName: string
): TypeDescription | undefined {
  return getTypeDescription(typeName);
}

/**
 * Get all field descriptions for a type
 * @param typeName - Name of the type
 * @returns Object with all field descriptions
 */
export function getAllFieldDescriptions(
  typeName: string
): Record<string, FieldDescription> | undefined {
  const typeDesc = getTypeDescription(typeName);
  return typeDesc?.fields;
}
