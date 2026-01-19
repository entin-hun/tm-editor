<template>
  <q-card class="q-mt-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <div class="row q-mb-sm">
          <div class="col text-caption">Min: {{ range.min }}°C</div>
          <div class="col text-caption text-right">Max: {{ range.max }}°C</div>
        </div>
        <q-range
          v-model="range"
          :min="-50"
          :max="120"
          :step="1"
          color="primary"
          label
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { TemperatureRange } from '@trace.market/types';
import { ref, watch } from 'vue';
import { clone, defaultTemperatureRange } from './defaults';

const props = defineProps<{
  modelValue: TemperatureRange | undefined;
  label: string;
}>();

const value = ref(props.modelValue ?? clone(defaultTemperatureRange));
const range = ref({
  min: value.value.min,
  max: value.value.max,
});

const emit = defineEmits(['update:modelValue']);

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

watch(
  range,
  (newRange) => {
    value.value = {
      ...value.value,
      min: newRange.min,
      max: newRange.max,
    };
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultTemperatureRange);
      range.value = { min: value.value.min, max: value.value.max };
    }
  }
);
</script>
