<template>
  <q-card class="q-mt-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md row">
        <div class="col q-pr-sm">
          <BasicInput v-model.number="value.min" label="min" type="number" />
        </div>
        <div class="col q-pl-sm">
          <BasicInput v-model.number="value.max" label="max" type="number" />
        </div>
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { TemperatureRange } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import { ref, watch } from 'vue';
import { clone, defaultTemperatureRange } from './defaults';

const props = defineProps<{
  modelValue: TemperatureRange | undefined;
  label: string;
}>();

const value = ref(props.modelValue ?? clone(defaultTemperatureRange));

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
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultTemperatureRange);
    }
  }
);
</script>
