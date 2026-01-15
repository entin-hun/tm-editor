/**
 * Composable for using type descriptions in Vue components
 */

import { computed, type ComputedRef } from 'vue';
import type { FieldDescription, TypeDescription } from '@trace.market/types';
import {
  getFieldDescriptionInfo,
  getTypeDescriptionInfo,
  getAllFieldDescriptions,
} from './descriptionUtils';

interface UseTypeDescriptionsOptions {
  typeName?: string;
}

interface UseTypeDescriptionsReturn {
  typeDescription: ComputedRef<TypeDescription | undefined>;
  getFieldDescription: (fieldName: string) => FieldDescription | undefined;
  allFieldDescriptions: ComputedRef<
    Record<string, FieldDescription> | undefined
  >;
}

/**
 * Composable to access type descriptions in components
 * @param options Configuration options
 * @returns Object with computed descriptions and helper functions
 */
export function useTypeDescriptions(
  options: UseTypeDescriptionsOptions
): UseTypeDescriptionsReturn {
  const typeDescription = computed(() => {
    if (options.typeName) {
      return getTypeDescriptionInfo(options.typeName);
    }
    return undefined;
  });

  const allFieldDescriptions = computed(() => {
    if (options.typeName) {
      return getAllFieldDescriptions(options.typeName);
    }
    return undefined;
  });

  const getFieldDescription = (
    fieldName: string
  ): FieldDescription | undefined => {
    if (options.typeName) {
      return getFieldDescriptionInfo(options.typeName)?.fields[fieldName];
    }
    return undefined;
  };

  return {
    typeDescription,
    getFieldDescription,
    allFieldDescriptions,
  };
}
