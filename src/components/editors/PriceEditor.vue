<template>
  <q-card class="q-mt-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md row">
        <div class="col q-pr-sm">
          <BasicInput
            v-model.number="value.amount"
            label="amount"
            :default-value="0"
            type="number"
          />
        </div>
        <div class="col q-px-sm">
          <q-select
            v-model="value.currency"
            label="currency"
            :options="currencyOptions"
            emit-value
            map-options
          />
        </div>
        <div class="col q-pl-sm">
          <q-select
            v-model="value.type"
            label="type"
            :options="typeOptions"
            emit-value
            map-options
          />
        </div>
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Price } from '@trace.market/types';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';

const props = defineProps<{
  modelValue: Price | undefined;
  label: string;
  defaultValue?: Price | undefined;
}>();

const CHIADO_EURE = '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71';
const currencyOptions = [
  { label: 'EURe', value: CHIADO_EURE },
  { label: 'GBPe', value: '0x436AF2954BB436b6821Ab401112092e14CDBd546' },
  { label: 'USDe', value: '0x8bf987c9d041176758FE9C1180885bD4DA011a5a' },
];
const typeOptions = [
  { label: 'is', value: 'is' },
  { label: 'budget', value: 'budget' },
  { label: '%', value: '%' },
  { label: 'payin30days', value: 'payin30days' },
  { label: 'payin60days', value: 'payin60days' },
];

const value = ref<Price>(
  props.modelValue ??
    props.defaultValue ?? {
      amount: 0,
      currency: CHIADO_EURE,
      type: 'is',
    }
);

const emit = defineEmits(['update:modelValue']);

const internalUpdate = ref(false);

// Emit deep changes so parent stays in sync without dropping object when partial
watch(
  value,
  (newValue) => {
    if (internalUpdate.value) return;
    emit('update:modelValue', { ...newValue });
  },
  { deep: true }
);

// Sync internal state when parent replaces price (e.g., JSON edits)
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && newVal !== value.value) {
      internalUpdate.value = true;
      value.value = { ...newVal };
      // allow next tick before emitting again
      setTimeout(() => {
        internalUpdate.value = false;
      }, 0);
    }
  }
);
</script>
