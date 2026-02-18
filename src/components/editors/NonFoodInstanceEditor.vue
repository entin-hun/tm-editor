<template>
  <div class="column q-gutter-md">
    <q-card class="q-mt-md" dark>
      <q-expansion-item label="Non-Food Product" default-opened>
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
              <BasicInput
                v-model.number="value.quantity"
                label="quantity"
                type="number"
              />
            </div>
            <div class="col-12 col-sm-6 col-md-4">
              <TimestampInput v-model="value.expiryDate" label="expiryDate" />
            </div>
            <div class="col-12 col-md-12">
              <BasicInput v-model="value.description" label="description" />
            </div>
            <div class="col-12 col-md-4">
              <BasicInput v-model="value.pictureURL" label="pictureURL" />
            </div>
          </div>

          <q-card v-if="showProcess" class="q-mt-md" dark>
            <q-expansion-item label="process" default-opened>
              <div class="q-pa-md">
                <q-select
                  :options="processTypes"
                  v-model="processType"
                  label="type"
                />
                <ProcessEditor
                  v-if="value.process"
                  v-model="value.process"
                  :show-temperature-range="false"
                />
              </div>
            </q-expansion-item>
          </q-card>
        </div>
      </q-expansion-item>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { NonFoodInstance, Process } from '@trace.market/types';
import { computed, ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';
import TimestampInput from './TimestampInput.vue';
import ProcessEditor from './processes/ProcessEditor.vue';
import {
  clone,
  defaultGenericProcess,
  defaultNonFoodInstance,
} from './defaults';
import { useSchemaStore } from 'src/stores/schemaStore';

const props = defineProps<{
  modelValue: NonFoodInstance | undefined;
  showProcess?: boolean;
}>();
const emit = defineEmits(['update:modelValue']);

const schemaStore = useSchemaStore();
const value = ref<NonFoodInstance>(
  props.modelValue ?? clone(defaultNonFoodInstance)
);
const showProcess = props.showProcess ?? true;

const processTypeFactory: { [type: string]: Process } = {};

const DEFAULT_NON_FOOD_PROCESS = 'assembling';

const processTypes = computed(() => {
  const names = schemaStore
    .getAllTypeNames()
    .filter((name) => name.endsWith('Process'));
  const derived = names.map((name) =>
    name.replace(/Process$/, '').toLowerCase()
  );
  const fallback = [
    'assembling',
    'printing',
    'milling',
    'freezedrying',
    'blending',
    'harvest',
    'sale',
    'labeltagger',
  ];
  const list = derived.length ? derived : fallback;
  const withoutAssembling = list.filter((item) => item !== 'assembling');
  return ['assembling', ...withoutAssembling];
});

const processType = ref<string | undefined>(
  showProcess
    ? value.value.process?.type ?? DEFAULT_NON_FOOD_PROCESS
    : undefined
);

watch(processType, (newValue) => {
  if (!showProcess) return;
  if (newValue === value.value.process?.type) return;

  value.value.process =
    newValue === undefined
      ? undefined
      : clone(
          processTypeFactory[newValue] || (defaultGenericProcess as Process)
        );

  if (value.value.process && newValue && !processTypeFactory[newValue]) {
    value.value.process.type = newValue;
    (value.value.process as any).name = newValue;
  }
});

watch(
  () => value.value.process?.type,
  (newType) => {
    if (!showProcess) return;
    processType.value = newType ?? DEFAULT_NON_FOOD_PROCESS;
  },
  { immediate: true }
);

watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultNonFoodInstance);
    }
    if (showProcess) {
      processType.value = value.value.process?.type ?? DEFAULT_NON_FOOD_PROCESS;
    }
  }
);
</script>
