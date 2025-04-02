<template>
  <BasicInput v-model.number="value.quantity" label="quantity" type="number" />
  <q-select v-model="type" :options="typeOptions" />
  <BasicInput
    v-model="value.instance"
    label="instance"
    v-if="typeof value.instance === 'string'"
    default-value=""
  />
  <ProductInstanceEditor
    :priced="false"
    v-model="value.instance"
    label="instance"
    v-else-if="
      typeof value.instance === 'object' && !('errorMessage' in value.instance)
    "
  />
</template>

<script setup lang="ts">
import { GenericInputInstance } from '@fairfooddata/types';
import { ref, watch } from 'vue';
import {
  clone,
  defaultFoodInstance,
  defaultGenericInputInstance,
} from './defaults';
import BasicInput from './BasicInput.vue';
import ProductInstanceEditor from './ProductInstanceEditor.vue';

const props = defineProps<{ modelValue: GenericInputInstance | undefined }>();

const value = ref(props.modelValue ?? clone(defaultGenericInputInstance));
const type = ref<'hash' | 'json'>('hash');

const typeOptions = ['hash', 'json'];

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});

watch(type, (newValue) => {
  switch (newValue) {
    case 'hash':
      value.value.instance = '0x0';
      break;
    case 'json':
      value.value.instance = clone(defaultFoodInstance);
      break;
  }
});
</script>
