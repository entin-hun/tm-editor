<template>
  <GenericProcessEditor v-model="value" />
  <MachineInstanceEditor
    v-model="value.machineInstance"
    label="machineInstance"
  />
  <KnowHowEditor v-model="value.knowHow" label="knowHow" />
</template>

<script setup lang="ts">
import { FreezeDryingProcess } from '@trace.market/types';
import GenericProcessEditor from './GenericProcessEditor.vue';
import KnowHowEditor from '../KnowHowEditor.vue';
import MachineInstanceEditor from '../MachineInstanceEditor.vue';

import { ref, watch } from 'vue';
import { clone, defaultPrintingProcess } from '../defaults';

const props = defineProps<{ modelValue: FreezeDryingProcess | undefined }>();

const value = ref(props.modelValue ?? clone(defaultPrintingProcess));

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
