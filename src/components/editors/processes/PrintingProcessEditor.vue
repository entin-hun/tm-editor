<template>
  <GenericProcessEditor v-model="value" />
  <MachineInstanceEditor
    v-model="value.machineInstance"
    label="machineInstance"
  />
  <KnowHowEditor v-model="value.knowHow" label="knowHow" />
  <BasicInput v-model="value.shape" label="shape" default-value="" />
</template>

<script setup lang="ts">
import { PrintingProcess } from '@trace.market/types';
import GenericProcessEditor from './GenericProcessEditor.vue';
import BasicInput from '../BasicInput.vue';
import KnowHowEditor from '../KnowHowEditor.vue';
import MachineInstanceEditor from '../MachineInstanceEditor.vue';

import { ref, watch } from 'vue';
import { clone, defaultPrintingProcess } from '../defaults';

const props = defineProps<{ modelValue: PrintingProcess | undefined }>();

const value = ref(props.modelValue ?? clone(defaultPrintingProcess));

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
