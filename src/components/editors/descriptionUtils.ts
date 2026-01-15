/**
 * Utility functions for working with type descriptions in components
 */

import {
  getFieldDescription,
  getTypeDescription,
  type FieldDescription,
  type TypeDescription,
} from '@trace.market/types';

/**
 * Get field description with sensible defaults
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
  const description = getFieldDescription(typeName, fieldName);
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
