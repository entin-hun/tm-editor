<template>
  <q-select
    v-model="type"
    :options="typeOptions"
    label="type"
    dense
    outlined
  />
  <LocalInputInstanceEditor v-if="type === 'local'" v-model="value" />
  <TransportedInputInstanceEditor v-if="type === 'transported'" v-model="value" />
</template>

<script setup lang="ts">
import { InputInstance } from '@trace.market/types';
import LocalInputInstanceEditor from './LocalInputInstanceEditor.vue';
import TransportedInputInstanceEditor from './TransportedInputInstanceEditor.vue';
import { ref, watch } from 'vue';
import { clone, defaultLocalInputInstance, defaultTransportedInputInstance } from './defaults';

const props = defineProps<{ modelValue: InputInstance }>();
const emit = defineEmits(['update:modelValue']);

const value = ref<InputInstance>(props.modelValue);
const typeOptions = ['local', 'transported'];
const type = ref<'local' | 'transported'>(props.modelValue.type);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) {
      value.value = newVal;
      type.value = newVal.type;
    }
  }
);

watch(
  value,
  (newVal) => {
    emit('update:modelValue', newVal);
  },
  { deep: true }
);

watch(type, (newType) => {
  if (newType === value.value.type) return;
  const base =
    newType === 'local'
      ? clone(defaultLocalInputInstance)
      : clone(defaultTransportedInputInstance);
  const current = value.value as any;
  const next = base as any;
  if (current?.instance !== undefined) next.instance = current.instance;
  if (current?.quantity !== undefined) next.quantity = current.quantity;
  if (current?.priceShare !== undefined) next.priceShare = current.priceShare;
  value.value = next as InputInstance;
});
</script>
