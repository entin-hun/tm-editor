<template>
  <BasicInput v-model="value.id" label="id" default-value="" />
  <BasicInput v-model="value.registry" label="registry" default-value="" />
</template>

<script setup lang="ts">
import { ID } from '@trace.market/types';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';

const props = defineProps<{ modelValue: ID }>();

const value = ref(props.modelValue);

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
