<template>
  <NonFoodInstanceEditor v-model="value" />
</template>

<script setup lang="ts">
import { NonFoodInstance } from '@trace.market/types';
import { clone, defaultNonFoodInstance } from './defaults';
import { ref, watch } from 'vue';
import NonFoodInstanceEditor from './NonFoodInstanceEditor.vue';

const props = defineProps<{ modelValue: NonFoodInstance | undefined }>();

const value = ref(props.modelValue ?? clone(defaultNonFoodInstance));

const emit = defineEmits(['update:modelValue']);

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
      value.value = newVal ?? clone(defaultNonFoodInstance);
    }
  }
);
</script>
