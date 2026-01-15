<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <BasicInput
          v-model="value.label"
          label="label"
          :default-value="undefined"
        />
        <LocationEditor v-model="value.location" label="location" />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Site } from '@trace.market/types';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';
import LocationEditor from './LocationEditor.vue';
import { defaultSite, clone } from './defaults';

const props = defineProps<{ modelValue: Site | undefined; label: string }>();

const value = ref(props.modelValue ?? clone(defaultSite));

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
      value.value = newVal ?? clone(defaultSite);
    }
  }
);
</script>
