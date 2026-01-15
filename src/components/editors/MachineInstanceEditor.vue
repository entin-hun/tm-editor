<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <BasicInput
          v-model="value.category"
          label="category"
          default-value=""
        />
        <BasicInput v-model="value.ownerId" label="ownerId" default-value="" />
        <BasicInput
          v-model.number="value.quantity"
          label="quantity"
          default-value=""
          type="number"
        />
        <BasicInput v-model="value.size" label="size" default-value="" />
        <HrEditor v-model="value.hr" label="hr" default-value="" />
        <BasicInput
          v-model="value.providerSDomain"
          label="providerSDomain"
          default-value=""
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { MachineInstance } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import { clone, defaultMachineInstance } from './defaults';
import { ref, watch } from 'vue';
import HrEditor from './HrEditor.vue';

const props = defineProps<{
  modelValue: MachineInstance | undefined;
  label: string;
}>();

const value = ref(props.modelValue ?? clone(defaultMachineInstance));

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
