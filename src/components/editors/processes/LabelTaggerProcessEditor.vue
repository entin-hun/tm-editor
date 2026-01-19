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
  <q-select
    v-model="value.name"
    :options="labelOptions"
    label="label"
    use-input
    new-value-mode="add"
    clearable
    @new-value="addLabel"
  />
</template>

<script setup lang="ts">
import { LabelTaggerProcess } from '@trace.market/types';
import { ref, watch, computed } from 'vue';
import GenericProcessEditor from './GenericProcessEditor.vue';
import MachineInstanceEditor from '../MachineInstanceEditor.vue';
import KnowHowEditor from '../KnowHowEditor.vue';
import HrEditor from '../HrEditor.vue';
import { clone, defaultLabelTaggerProcess } from '../defaults';
import { BASE_LABEL_OPTIONS, FOOD_ONLY_LABELS } from './labelOptions';

const props = defineProps<{
  modelValue: LabelTaggerProcess | undefined;
  foodLabels?: boolean;
}>();
const foodLabels = props.foodLabels ?? false;
const emit = defineEmits(['update:modelValue']);

const value = ref(props.modelValue ?? clone(defaultLabelTaggerProcess));
const baseLabelOptions = ref<string[]>([...BASE_LABEL_OPTIONS]);

const labelOptions = computed(() =>
  foodLabels
    ? [...FOOD_ONLY_LABELS, ...baseLabelOptions.value]
    : baseLabelOptions.value
);

function addLabel(val: string) {
  const trimmed = val?.trim();
  if (!trimmed) return;
  if (!baseLabelOptions.value.includes(trimmed)) {
    baseLabelOptions.value.push(trimmed);
  }
  value.value.name = trimmed;
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultLabelTaggerProcess);
    }
  }
);

watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);
</script>
