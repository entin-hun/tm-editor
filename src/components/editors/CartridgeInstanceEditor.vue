<template>
  <BasicInput v-model="value.type" label="type" />
  <BasicInput v-model="value.title" label="title" />
  <BasicInput v-model="value.description" label="description" />
  <BasicInput v-model="value.pictureURL" label="pictureURL" />
  <q-checkbox v-model="value.bio" label="bio" />
  <BasicInput v-model="value.ownerId" label="ownerId" default-value="" />
  <BasicInput v-model="value.grade" label="grade" default-value="" />
  <BasicInput
    v-model.number="value.quantity"
    label="quantity (grams)"
    type="number"
  />
  <BasicInput v-model="value.size" label="size" />
</template>

<script setup lang="ts">
import { CartridgeInstance } from '@trace.market/types';
import { clone, defaultCartridgeInstance } from './defaults';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';

const props = defineProps<{ modelValue: CartridgeInstance | undefined }>();

const value = ref(props.modelValue ?? clone(defaultCartridgeInstance));

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
      value.value = newVal ?? clone(defaultCartridgeInstance);
    }
  }
);
</script>
