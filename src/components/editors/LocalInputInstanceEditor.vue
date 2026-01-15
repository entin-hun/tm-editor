<template>
  <GenericInputInstanceEditor v-model="value" />
</template>

<script setup lang="ts">
import { LocalInputInstance } from '@trace.market/types';
import { clone, defaultLocalInputInstance } from './defaults';
import { ref, watch } from 'vue';
import GenericInputInstanceEditor from './GenericInputInstanceEditor.vue';

const props = defineProps<{ modelValue: LocalInputInstance | undefined }>();

const value = ref(props.modelValue ?? clone(defaultLocalInputInstance));

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
      value.value = newVal ?? clone(defaultLocalInputInstance);
    }
  }
);
</script>
