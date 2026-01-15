<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <GenericProcessEditor v-model="value" />
        <PriceEditor v-model="value.price" label="price" />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { SaleProcess } from '@trace.market/types';
import GenericProcessEditor from './GenericProcessEditor.vue';
import { ref, watch } from 'vue';
import { clone, defaultSaleProcess } from '../defaults';
import PriceEditor from './PriceEditor.vue';

const props = defineProps<{
  modelValue: SaleProcess | undefined;
  label: string;
}>();

const value = ref(props.modelValue ?? clone(defaultSaleProcess));

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
