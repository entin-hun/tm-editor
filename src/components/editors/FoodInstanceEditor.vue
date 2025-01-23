<template>
  <div class="column">
    <BasicInput v-model="value.type" label="type" />
    <q-checkbox v-model="value.bio" label="bio" />
    <BasicInput v-model="value.ownerId" label="ownerId" />
    <BasicInput v-model="value.grade" label="grade" />
    <BasicInput v-model="value.size" label="size" />
    <BasicInput
      v-model.number="value.quantity"
      label="quantity"
      type="number"
    />
    <BasicInput v-model="value.format" label="format" />
    <TimestampInput v-model="value.expiryDate" label="expiryDate" />
    <IdArrayEditor v-model="value.iDs" label="iDs" />
    <FallbackFoodNutrientArrayEditor
      v-model="value.nutrients"
      label="nutrients"
    />
    <q-card class="q-mt-md">
      <q-expansion-item label="process" default-opened>
        <div class="q-pa-md">
          <q-select
            :options="processTypes"
            v-model="processType"
            label="type"
            clearable
            @clear="processType = undefined"
          />
          <PrintingProcessEditor
            v-if="value.process?.type === 'printing'"
            v-model="value.process"
          />
          <MillingProcessEditor
            v-if="value.process?.type === 'milling'"
            v-model="value.process"
          />
          <FreezeDryingProcessEditor
            v-if="value.process?.type === 'freezedrying'"
            v-model="value.process"
          />
          <BlendingProcessEditor
            v-if="value.process?.type === 'blending'"
            v-model="value.process"
          />
          <HarvestProcessEditor
            v-if="value.process?.type === 'harvest'"
            v-model="value.process"
          />
        </div>
      </q-expansion-item>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { FoodInstance, Process } from '@fairfooddata/types';
import { ref, watch } from 'vue';

import BasicInput from './BasicInput.vue';
import TimestampInput from './TimestampInput.vue';

import PrintingProcessEditor from './processes/PrintingProcessEditor.vue';
import MillingProcessEditor from './processes/MillingProcessEditor.vue';
import FreezeDryingProcessEditor from './processes/FreezeDryingProcessEditor.vue';
import BlendingProcessEditor from './processes/BlendingProcessEditor.vue';
import HarvestProcessEditor from './processes/HarvestProcessEditor.vue';

import FallbackFoodNutrientArrayEditor from './FallbackFoodNutrientArrayEditor.vue';

import {
  clone,
  defaultBlendingProcess,
  defaultFoodInstance,
  defaultFreezeDryingProcess,
  defaultHarvestProcess,
  defaultMillingProcess,
  defaultPrintingProcess,
} from './defaults';
import IdArrayEditor from './IdArrayEditor.vue';

const props = defineProps<{
  modelValue: FoodInstance | undefined;
}>();
const emit = defineEmits(['update:modelValue']);

const value = ref<FoodInstance>(props.modelValue ?? clone(defaultFoodInstance));

const processTypeFactory: { [type: string]: Process } = {
  printing: defaultPrintingProcess,
  milling: defaultMillingProcess,
  freezedrying: defaultFreezeDryingProcess,
  blending: defaultBlendingProcess,
  harvest: defaultHarvestProcess,
};

const processTypes = [
  'printing',
  'milling',
  'freezedrying',
  'blending',
  'harvest',
];

const processType = ref<string | undefined>();

watch(
  processType,
  (newValue) =>
    (value.value.process =
      newValue === undefined ? undefined : clone(processTypeFactory[newValue]))
);

watch(value.value, (newValue) => emit('update:modelValue', newValue));
</script>
