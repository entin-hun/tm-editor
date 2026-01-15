<template>
  <div class="column">
    <div class="row q-gutter-sm items-start flex-wrap">
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.type" label="type" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.title" label="title" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.ownerId" label="ownerId" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.grade" label="grade" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.format" label="format" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.size" label="size" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput v-model="value.pictureURL" label="pictureURL" />
      </div>

      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <BasicInput
          v-model.number="value.quantity"
          label="quantity (grams)"
          type="number"
        />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <q-checkbox v-model="value.bio" label="bio" />
      </div>
      <div style="flex: 0 1 32%; min-width: 150px; max-width: 250px">
        <TimestampInput v-model="value.expiryDate" label="expiryDate" />
      </div>
      <div style="flex: 0 1 62%; min-width: 150px; max-width: 650px">
        <BasicInput v-model="value.description" label="description" />
      </div>
    </div>
    <IdArrayEditor v-model="value.iDs" label="iDs" />
    <FallbackFoodNutrientArrayEditor
      v-model="value.nutrients"
      label="nutrients"
    />
    <q-card class="q-mt-md" dark>
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
import { FoodInstance, Process } from '@trace.market/types';
import { ref, watch } from 'vue';
import axios from 'axios';

import BasicInput from './BasicInput.vue';
import TimestampInput from './TimestampInput.vue';
import FallbackFoodNutrientArrayEditor from './FallbackFoodNutrientArrayEditor.vue';

import PrintingProcessEditor from './processes/PrintingProcessEditor.vue';
import MillingProcessEditor from './processes/MillingProcessEditor.vue';
import FreezeDryingProcessEditor from './processes/FreezeDryingProcessEditor.vue';
import BlendingProcessEditor from './processes/BlendingProcessEditor.vue';
import HarvestProcessEditor from './processes/HarvestProcessEditor.vue';

import {
  clone,
  defaultBlendingProcess,
  defaultFoodInstance,
  defaultFreezeDryingProcess,
  defaultGenericProcess,
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

const typeOptions = ref<string[]>([]);
const typeLoading = ref(false);
const typeError = ref<string | null>(null);

let typeAbortController: AbortController | null = null;
let typeRequestId = 0;

async function filterType(
  val: string,
  update: (cb: () => void) => void,
  _abort?: () => void
) {
  const trimmed = val?.trim() ?? '';
  typeError.value = null;

  if (!trimmed || trimmed.length < 2) {
    typeAbortController?.abort();
    typeAbortController = null;
    typeLoading.value = false;
    update(() => {
      typeOptions.value = [];
    });
    return;
  }

  const requestId = ++typeRequestId;
  typeAbortController?.abort();
  typeAbortController = new AbortController();

  typeLoading.value = true;
  try {
    const url = 'https://world.openfoodfacts.org/api/v3/taxonomy_suggestions';
    const resp = await axios.get(url, {
      params: {
        tagtype: 'categories',
        string: trimmed,
      },
      timeout: 10000,
      signal: typeAbortController.signal,
    });

    if (typeAbortController.signal.aborted || requestId !== typeRequestId) {
      return;
    }

    const tags = resp.data?.tags ?? [];
    update(() => {
      typeOptions.value = tags.map((t: any) => t.name).filter(Boolean);
    });
  } catch (error: any) {
    if (typeAbortController?.signal.aborted || requestId !== typeRequestId) {
      return;
    }

    const message = axios.isAxiosError(error)
      ? error.response?.status
        ? `${error.message} (status ${error.response.status})`
        : error.message
      : error?.message ?? String(error);

    typeError.value = `Autocomplete failed: ${message}`;
    update(() => {
      typeOptions.value = [];
    });
    console.error('type autocomplete error', {
      input: trimmed,
      message,
      error,
    });
  } finally {
    if (!typeAbortController?.signal.aborted && requestId === typeRequestId) {
      typeLoading.value = false;
    }
  }
}

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
    value.value.process.type = newValue;
    // We cast to any because specific Process types restrict the 'type' string literal,
    // but here we are dealing with a dynamic/new type.
    (value.value.process as any).name = newValue;
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
  }
);
</script>
