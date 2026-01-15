<template>
  <q-card class="q-my-md" dark>
    <div class="q-pa-md">
      <BasicInput v-model="value.contract" label="contract" default-value="" />
      <BasicInput
        v-model="value.description"
        label="description"
        default-value=""
      />
      <BasicInput
        v-model="value.feedchainVersion"
        label="feedchainVersion"
        default-value=""
      />
      <BasicInput v-model="value.token" label="token" default-value="" />
      <ProductInstanceEditor v-model="value.instance" label="instance" priced />
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { Pokedex } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import { clone, defaultPokedex } from './defaults';
import { ref, watch } from 'vue';
import ProductInstanceEditor from './ProductInstanceEditor.vue';

const props = defineProps<{ modelValue: Pokedex }>();

const value = ref(props.modelValue ?? clone(defaultPokedex));

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
    console.log('[PokedexEditor] props.modelValue changed');
    if (newVal !== value.value) {
      console.log('[PokedexEditor] Updating internal value ref');
      value.value = newVal ?? clone(defaultPokedex);
    }
  }
);
</script>
