<template>
  <GenericProcessEditor v-model="value" :food-labels="foodLabels" />
  <MachineInstanceEditor
    v-model="value.machineInstance"
    label="toolInstance"
    :show-reference-hash="true"
    :show-fields="false"
    :show-hr="false"
  />
  <HrEditor
    v-if="value.machineInstance"
    v-model="value.machineInstance.hr"
    label="hr"
  />
  <KnowHowEditor
    v-model="value.knowHow"
    label="knowHow"
    :show-reference-hash="true"
    :show-fields="false"
    :show-price="false"
  />
</template>

<script setup lang="ts">
import { FreezeDryingProcess } from '@trace.market/types';
import GenericProcessEditor from './GenericProcessEditor.vue';
import KnowHowEditor from '../KnowHowEditor.vue';
import MachineInstanceEditor from '../MachineInstanceEditor.vue';
import HrEditor from '../HrEditor.vue';

import { ref, watch } from 'vue';
import { clone, defaultPrintingProcess } from '../defaults';

const props = defineProps<{
  modelValue: FreezeDryingProcess | undefined;
  foodLabels?: boolean;
}>();
const foodLabels = props.foodLabels ?? false;

const value = ref(props.modelValue ?? clone(defaultPrintingProcess));

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
