<template>
  <BasicInput v-model="value.format" label="format" default-value="" />
  <BasicInput v-model="value.ownerId" label="ownerId" default-value="" />
  <BasicInput
    v-model.number="value.quantity"
    label="quantity"
    type="number"
    :default-value="0"
  />
</template>

<script setup lang="ts">
import { GenericImpact } from '@trace.market/types';
import BasicInput from '../BasicInput.vue';
import { ref, watch } from 'vue';

const props = defineProps<{ modelValue: GenericImpact }>();

const value = ref(props.modelValue);

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
