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
          <BasicInput
            v-model="value.currency"
            label="currency"
            :default-value="''"
          />
        </div>
        <div class="col q-pl-sm">
          <q-select v-model="value.type" label="type" :options="typeOptions" />
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

const typeOptions = ['budget', 'is', '%', 'payin30days', 'payin60days'];

const value = ref<Price>(
  props.modelValue ??
    props.defaultValue ?? {
      amount: 0,
      currency: '',
      type: 'budget',
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
