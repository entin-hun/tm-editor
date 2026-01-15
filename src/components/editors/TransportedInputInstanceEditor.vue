<template>
  <TransportEditor v-model="value.transport" label="transport" />
  <GenericInputInstanceEditor v-model="value" />
</template>

<script setup lang="ts">
import { TransportedInputInstance } from '@trace.market/types';
import { ref, watch } from 'vue';
import { clone, defaultTransportedInputInstance } from './defaults';
import TransportEditor from './TransportEditor.vue';
import GenericInputInstanceEditor from './GenericInputInstanceEditor.vue';

const props = defineProps<{
  modelValue: TransportedInputInstance | undefined;
}>();

const value = ref(props.modelValue ?? clone(defaultTransportedInputInstance));

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
      value.value = newVal ?? clone(defaultTransportedInputInstance);
    }
  }
);
</script>
