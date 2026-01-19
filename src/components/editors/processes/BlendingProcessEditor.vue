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
import { BlendingProcess } from '@trace.market/types';
import GenericProcessEditor from './GenericProcessEditor.vue';
import KnowHowEditor from '../KnowHowEditor.vue';
import MachineInstanceEditor from '../MachineInstanceEditor.vue';
import HrEditor from '../HrEditor.vue';

import { ref, watch } from 'vue';
import { clone, defaultBlendingProcess } from '../defaults';

const props = defineProps<{
  modelValue: BlendingProcess | undefined;
  foodLabels?: boolean;
}>();
const foodLabels = props.foodLabels ?? false;

const value = ref(props.modelValue ?? clone(defaultBlendingProcess));

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
    console.log('[BlendingProcessEditor] props.modelValue changed');
    if (newVal !== value.value) {
      console.log('[BlendingProcessEditor] Updating internal value ref');
      value.value = newVal ?? clone(defaultBlendingProcess);
    }
  }
);
</script>
