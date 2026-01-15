<template>
  <BasicInput
    v-model.number="value.amount"
    label="amount"
    type="number"
    :default-value="0"
  />
  <IdEditor v-model="value.iD" />
</template>

<script setup lang="ts">
import { FallbackFoodNutrient } from '@trace.market/types';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';
import IdEditor from './IdEditor.vue';

const props = defineProps<{ modelValue: FallbackFoodNutrient }>();

const value = ref(props.modelValue);

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
