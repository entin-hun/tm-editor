<template>
  <q-card class="q-my-md">
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
import { Pokedex } from '@fairfooddata/types';
import BasicInput from './BasicInput.vue';
import { clone, defaultPokedex } from './defaults';
import { ref, watch } from 'vue';
import ProductInstanceEditor from './ProductInstanceEditor.vue';

const props = defineProps<{ modelValue: Pokedex }>();

const value = ref(props.modelValue ?? clone(defaultPokedex));

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
