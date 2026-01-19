<template>
  <TimestampInput v-model="value.timestamp" label="timestamp" />
  <BasicInput v-model.number="value.duration" label="duration" type="number" />
  <SiteEditor v-model="value.site" label="site" />
  <q-select
    v-model="processLabels"
    :options="labelOptions"
    label="labels"
    use-input
    multiple
    use-chips
    new-value-mode="add-unique"
    clearable
    @new-value="addLabel"
  />
  <TemperatureRangeEditor
    v-if="showTemperatureRange"
    v-model="value.temperatureRange"
    label="temperatureRange"
  />
  <InputInstanceArrayEditor
    v-if="showInputInstances"
    v-model="value.inputInstances"
    label="inputInstances"
  />
  <ImpactArrayEditor v-model="value.impacts" label="impacts" />
  <PriceEditor v-model="value.price" label="price" />
</template>

<script setup lang="ts">
import { GenericProcess } from '@trace.market/types';
import { ref, watch, computed } from 'vue';
import TimestampInput from '../TimestampInput.vue';
import BasicInput from '../BasicInput.vue';
import TemperatureRangeEditor from '../TemperatureRangeEditor.vue';
import InputInstanceArrayEditor from '../InputInstanceArrayEditor.vue';
import PriceEditor from '../PriceEditor.vue';
import ImpactArrayEditor from '../impacts/ImpactArrayEditor.vue';
import SiteEditor from '../SiteEditor.vue';
import { BASE_LABEL_OPTIONS, FOOD_ONLY_LABELS } from './labelOptions';

const props = defineProps<{
  modelValue: GenericProcess | undefined;
  showTemperatureRange?: boolean;
  showInputInstances?: boolean;
  foodLabels?: boolean;
}>();
const showTemperatureRange = props.showTemperatureRange ?? true;
const showInputInstances = props.showInputInstances ?? false;
const foodLabels = props.foodLabels ?? false;
const emit = defineEmits(['update:modelValue']);
type ProcessWithName = GenericProcess & { name?: string | string[] };
const processLabels = computed<string[]>({
  get: () => {
    const name = (value.value as ProcessWithName)?.name;
    if (Array.isArray(name)) return name.filter(Boolean);
    if (typeof name === 'string') {
      return name
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  },
  set: (labels: string[]) => {
    const next = value.value as ProcessWithName;
    if (!labels || labels.length === 0) {
      next.name = undefined;
      return;
    }
    next.name = labels.join(', ');
  },
});
const baseLabelOptions = ref<string[]>([...BASE_LABEL_OPTIONS]);

const labelOptions = computed(() =>
  foodLabels
    ? [...FOOD_ONLY_LABELS, ...baseLabelOptions.value]
    : baseLabelOptions.value
);

function addLabel(val: string, done: (val?: string, mode?: string) => void) {
  const trimmed = val?.trim();
  if (!trimmed) {
    done();
    return;
  }
  if (!baseLabelOptions.value.includes(trimmed)) {
    baseLabelOptions.value.push(trimmed);
  }
  done(trimmed, 'add-unique');
}

// Initialize with props.modelValue
const value = ref(props.modelValue);

// Watch for external updates (e.g. from parent/AI)
watch(
  () => props.modelValue,
  (newVal) => {
    console.log(
      '[GenericProcessEditor] props.modelValue updated',
      newVal?.inputInstances?.length
    );
    if (newVal !== value.value) {
      value.value = newVal;
    }
  }
);

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);
</script>
