<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <BasicInput v-model="value.owner" label="owner" default-value="" />
        <BasicInput v-model="value.logoURL" label="logoURL" />
        <BasicInput v-model="value.hash" label="hash" default-value="" />
        <BasicInput v-model="value.inputs" label="inputs" default-value="" />
        <BasicInput v-model="value.outputs" label="outputs" default-value="" />
        <PriceEditor
          v-model="value.licenseFee"
          label="licenseFee"
          :default-value="defaultPrice"
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { KnowHow } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import PriceEditor from './PriceEditor.vue';
import { clone, defaultKnowHow } from './defaults';
import { ref, watch } from 'vue';
import { defaultPrice } from './defaults';

const props = defineProps<{ modelValue: KnowHow | undefined; label: string }>();

const value = ref(props.modelValue ?? clone(defaultKnowHow));

const emit = defineEmits(['update:modelValue']);
const internalUpdate = ref(false);

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    if (internalUpdate.value) return;
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && JSON.stringify(newVal) !== JSON.stringify(value.value)) {
      internalUpdate.value = true;
      value.value = newVal;
      setTimeout(() => {
        internalUpdate.value = false;
      }, 0);
    }
  }
);
</script>
