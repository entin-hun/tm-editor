<template>
  <q-select v-model="type" :options="typeOptions" />

  <template v-if="type === 'hash'">
    <BasicInput
      v-model.number="value.quantity"
      label="quantity (grams)"
      type="number"
    />
    <BasicInput
      v-model="value.instance"
      label="hash"
      default-value=""
      @focus="switchToTab('tm-list')"
    />
  </template>

  <template v-else>
    <ProductInstanceEditor
      :priced="false"
      v-model="value.instance"
      label="instance"
      v-if="
        typeof value.instance === 'object' &&
        !('errorMessage' in value.instance)
      "
    />
    <BasicInput
      v-else
      v-model="value.instance"
      label="instance"
      default-value=""
    />
    <BasicInput
      v-model.number="value.quantity"
      label="quantity (grams)"
      type="number"
    />
  </template>
</template>

<script setup lang="ts">
import { GenericInputInstance } from '@trace.market/types';
import { ref, watch, inject } from 'vue';
import { defineAsyncComponent } from 'vue';
import {
  clone,
  defaultFoodInstance,
  defaultGenericInputInstance,
} from './defaults';
import BasicInput from './BasicInput.vue';

const ProductInstanceEditor = defineAsyncComponent(
  () => import('./ProductInstanceEditor.vue')
);

const props = defineProps<{ modelValue: GenericInputInstance | undefined }>();

const value = ref(props.modelValue ?? clone(defaultGenericInputInstance));
const type = ref<'hash' | 'json'>(
  typeof value.value.instance === 'string' ? 'hash' : 'json'
);

const typeOptions = ['hash', 'json'];

const emit = defineEmits(['update:modelValue']);

// Inject tab switching capability
const { switchToTab } = inject('tabActions', {
  switchToTab: (tab: string) => {
    void tab;
  },
});

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
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultGenericInputInstance);
      const isHash = typeof value.value.instance === 'string';
      type.value = isHash ? 'hash' : 'json';
    }
  }
);

watch(type, (newValue) => {
  switch (newValue) {
    case 'hash':
      value.value.instance = '0x0';
      break;
    case 'json':
      value.value.instance = clone(defaultFoodInstance);
      break;
  }
});
</script>
