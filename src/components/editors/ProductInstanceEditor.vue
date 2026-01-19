<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <!-- Import from External Sources Button (hidden per UX request) -->
        <q-btn
          v-if="false"
          flat
          color="primary"
          icon="cloud_download"
          label="Import from External Sources"
          @click="startImport"
          class="q-mb-md"
        />

        <q-select
          label="category"
          :options="instanceCategories"
          v-model="instanceCategory"
        />
        <FoodInstanceEditor
          v-if="value.category === 'food'"
          v-model="value"
          :is-root="isRoot"
          :show-process="showProcess"
        />
        <NonFoodInstanceEditor
          v-model="value"
          v-else-if="value.category === 'non-food'"
          :show-process="showProcess"
        />
        <PriceEditor
          v-if="'price' in value"
          v-model="value.price"
          label="price"
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Priced, ProductInstance } from '@trace.market/types';
import { ref, watch, computed } from 'vue';
import FoodInstanceEditor from './FoodInstanceEditor.vue';
import NonFoodInstanceEditor from './NonFoodInstanceEditor.vue';
import {
  clone,
  defaultFoodInstance,
  defaultNonFoodInstance,
  defaultPricedProductInstance,
  defaultProductInstance,
} from './defaults';
import PriceEditor from './PriceEditor.vue';
import type { DecompositionNode } from '../../types/decomposition';
import { useDecompositionStore } from 'src/stores/decomposition';
import { useSchemaStore } from 'src/stores/schemaStore';

const props = defineProps<{
  modelValue: ProductInstance | Priced<ProductInstance> | undefined;
  label: string;
  priced: boolean;
  isRoot?: boolean;
  showProcess?: boolean;
}>();

const emit = defineEmits(['update:modelValue']);
const decompositionStore = useDecompositionStore();
const schemaStore = useSchemaStore();


const value = ref<ProductInstance | Priced<ProductInstance>>(
  props.modelValue ??
    (props.priced
      ? clone(defaultPricedProductInstance)
      : clone(defaultProductInstance))
);
const showProcess = props.showProcess ?? true;

function normalizeCategory(category: string | undefined): string | undefined {
  if (category === 'cartridge') return 'non-food';
  return category;
}

const instanceCategory = ref(normalizeCategory(value.value.category));
if (instanceCategory.value !== value.value.category && instanceCategory.value) {
  value.value.category = instanceCategory.value as any;
}

const instanceCategories = computed(() => {
  const desc = schemaStore.getFieldDescription('ProductInstance', 'category');
  const examples = desc?.examples?.length
    ? desc.examples.filter((item) => item !== 'cartridge')
    : ['food', 'non-food'];
  const current = instanceCategory.value;
  return current && !examples.includes(current)
    ? [...examples, current]
    : examples;
});

const productInstanceFactory: { [type: string]: ProductInstance } = {
  food: defaultFoodInstance,
  'non-food': defaultNonFoodInstance,
};

function startImport() {
  decompositionStore.startWizard((data) => {
    handleImportAccept(data);
  });
}

function handleImportAccept(node: DecompositionNode | null) {
  if (!node) return;

  const { data, process } = node;

  // Handle different product categories
  const normalizedCategory = normalizeCategory(data.category);
  if (normalizedCategory === 'food' && value.value.category !== 'food') {
    instanceCategory.value = 'food';
    value.value = clone(defaultFoodInstance);
  } else if (
    normalizedCategory === 'non-food' &&
    value.value.category !== 'non-food'
  ) {
    instanceCategory.value = 'non-food';
    value.value = clone(defaultNonFoodInstance);
  }

  // Merge instance data details (e.g. type, nutrients, etc.)
  Object.assign(value.value, data, {
    category: normalizedCategory ?? data.category,
  });

  // Set process if available (contains decomposition inputs/ingredients)
  if (process) {
    if (!('process' in value.value) || !value.value.process) {
      // If process missing, attach the imported one
      (value.value as any).process = clone(process);
    } else {
      // Merge into existing process logic
      Object.assign((value.value as any).process, process);
    }
  }

  // Handle other fields explicitly if needed
  if (data.type) {
    value.value.type = data.type;
  }

  // Copy external sources metadata
  if (data.externalSources) {
    (value.value as any).externalSources = data.externalSources;
  }

  console.log('Imported data from external sources', node);
}

watch(instanceCategory, (newValue) => {
  // Prevent redundant updates
  if (newValue === value.value.category) return;

  value.value = clone(
    productInstanceFactory[newValue] || defaultProductInstance
  );

  // If the category was not in the factory, preserve the new category
  if (!productInstanceFactory[newValue] && newValue) {
    value.value.category = newValue as any;
  }
});

// Sync local category ref if external model changes (e.g. AI update)
watch(
  () => value.value.category,
  (newCategory) => {
    const normalized = normalizeCategory(newCategory);
    if (normalized && normalized !== newCategory) {
      value.value.category = normalized as any;
    }
    if (normalized !== instanceCategory.value) {
      instanceCategory.value = normalized;
    }
  },
  { immediate: true }
);

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    console.log('[ProductInstanceEditor] props.modelValue changed:', newVal);
    if (newVal !== value.value) {
      console.log('[ProductInstanceEditor] Updating internal value ref');
      value.value =
        newVal ??
        (props.priced
          ? clone(defaultPricedProductInstance)
          : clone(defaultProductInstance));
    } else {
      console.log(
        '[ProductInstanceEditor] Skipping update (newVal === value.value)'
      );
    }
  }
);
</script>
