<template>
  <GenericProcessEditor v-model="value" :food-labels="foodLabels" />
</template>

<script setup lang="ts">
import { HarvestProcess } from '@trace.market/types';
import GenericProcessEditor from './GenericProcessEditor.vue';

import { ref, watch } from 'vue';
import { clone, defaultHarvestProcess } from '../defaults';

const props = defineProps<{
  modelValue: HarvestProcess | undefined;
  foodLabels?: boolean;
}>();
const foodLabels = props.foodLabels ?? false;

const value = ref(props.modelValue ?? clone(defaultHarvestProcess));

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
