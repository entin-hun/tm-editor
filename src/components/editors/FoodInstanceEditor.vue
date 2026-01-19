<template>
  <div class="column q-gutter-md">
    <q-card class="q-mt-md" dark>
      <q-expansion-item label="Add Product" default-opened>
        <div class="q-pa-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.type" label="type" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.title" label="title" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.ownerId" label="ownerId" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.grade" label="grade" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.format" label="format" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.size" label="size" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput v-model="value.pictureURL" label="pictureURL" />
            </div>

            <div class="col-12 col-sm-6 col-md-4">
              <BasicInput
                v-model.number="value.quantity"
                label="quantity (grams)"
                type="number"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <q-checkbox v-model="value.bio" label="bio" />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <TimestampInput v-model="value.expiryDate" label="expiryDate" />
            </div>
            <div class="col-12 col-md-8">
              <BasicInput v-model="value.description" label="description" />
            </div>
          </div>
          <IdArrayEditor v-model="value.iDs" label="iDs" />
          <FallbackFoodNutrientArrayEditor
            v-model="value.nutrients"
            label="nutrients"
          />
          <q-select
            v-model="processType"
            :options="processTypes"
            label="process type"
          />
          <PrintingProcessEditor
            v-if="value.process?.type === 'printing'"
            v-model="value.process"
            :food-labels="true"
          />
          <MillingProcessEditor
            v-else-if="value.process?.type === 'milling'"
            v-model="value.process"
            :food-labels="true"
          />
          <FreezeDryingProcessEditor
            v-else-if="value.process?.type === 'freezedrying'"
            v-model="value.process"
            :food-labels="true"
          />
          <BlendingProcessEditor
            v-else-if="value.process?.type === 'blending'"
            v-model="value.process"
            :food-labels="true"
          />
          <HarvestProcessEditor
            v-else-if="value.process?.type === 'harvest'"
            v-model="value.process"
            :food-labels="true"
          />
          <GenericProcessEditor
            v-else-if="value.process"
            v-model="value.process"
            :show-temperature-range="true"
            :food-labels="true"
          />
        </div>
      </q-expansion-item>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { FoodInstance, Process } from '@trace.market/types';
import { computed, ref, watch } from 'vue';

import BasicInput from './BasicInput.vue';
import TimestampInput from './TimestampInput.vue';
import FallbackFoodNutrientArrayEditor from './FallbackFoodNutrientArrayEditor.vue';

import PrintingProcessEditor from './processes/PrintingProcessEditor.vue';
import MillingProcessEditor from './processes/MillingProcessEditor.vue';
import FreezeDryingProcessEditor from './processes/FreezeDryingProcessEditor.vue';
import BlendingProcessEditor from './processes/BlendingProcessEditor.vue';
import HarvestProcessEditor from './processes/HarvestProcessEditor.vue';
import GenericProcessEditor from './processes/GenericProcessEditor.vue';

import {
  clone,
  defaultBlendingProcess,
  defaultFoodInstance,
  defaultFreezeDryingProcess,
  defaultGenericProcess,
  defaultHarvestProcess,
  defaultLabelTaggerProcess,
  defaultMillingProcess,
  defaultPrintingProcess,
} from './defaults';
import IdArrayEditor from './IdArrayEditor.vue';
import { useSchemaStore } from 'src/stores/schemaStore';

const props = defineProps<{
  modelValue: FoodInstance | undefined;
  isRoot?: boolean;
}>();
const emit = defineEmits(['update:modelValue']);

const value = ref<FoodInstance>(props.modelValue ?? clone(defaultFoodInstance));
const schemaStore = useSchemaStore();

const processTypeFactory: { [type: string]: Process } = {
  printing: defaultPrintingProcess,
  milling: defaultMillingProcess,
  freezedrying: defaultFreezeDryingProcess,
  blending: defaultBlendingProcess,
  harvest: defaultHarvestProcess,
};

const processTypes = computed(() => {
  const names = schemaStore
    .getAllTypeNames()
    .filter((name) => name.endsWith('Process'));
  const derived = names.map((name) =>
    name.replace(/Process$/, '').toLowerCase()
  );
  return derived.length
    ? derived
    : ['printing', 'milling', 'freezedrying', 'blending', 'harvest'];
});

const processType = ref<string | undefined>();

watch(processType, (newValue) => {
  if (newValue === value.value.process?.type) return;

  value.value.process =
    newValue === undefined
      ? undefined
      : clone(
          processTypeFactory[newValue] || (defaultGenericProcess as Process)
        );

  // If the process type wasn't in the factory (e.g. from AI), explicitly set the type name
  // because the fallback 'defaultGenericProcess' won't have the specific type.
  if (value.value.process && newValue && !processTypeFactory[newValue]) {
    const process = value.value.process as Process & { name?: string };
    process.type = newValue;
    process.name = newValue;
  }

});

// Keep the select in sync when a process is injected (e.g., AI suggestions)
watch(
  () => value.value.process?.type,
  (newType) => {
    processType.value = newType;
  },
  { immediate: true }
);


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
    console.log('[FoodInstanceEditor] props.modelValue changed:', newVal);
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultFoodInstance);
    }
    if (!value.value.process && props.isRoot) {
      value.value.process = clone(defaultBlendingProcess);
    }
    processType.value =
      value.value.process?.type ?? (props.isRoot ? 'blending' : undefined);
  }
);

if (!value.value.process && props.isRoot) {
  value.value.process = clone(defaultBlendingProcess);
}
processType.value =
  value.value.process?.type ?? (props.isRoot ? 'blending' : undefined);


</script>
