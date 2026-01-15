<template>
  <TimestampInput v-model="value.timestamp" label="timestamp" />
  <BasicInput v-model.number="value.duration" label="duration" type="number" />
  <SiteEditor v-model="value.site" label="site" />
  <TemperatureRangeEditor
    v-model="value.temperatureRange"
    label="temperatureRange"
  />
  <InputInstanceArrayEditor
    v-model="value.inputInstances"
    label="inputInstances"
  />
  <ImpactArrayEditor v-model="value.impacts" label="impacts" />
  <PriceEditor v-model="value.price" label="price" />
</template>

<script setup lang="ts">
import { GenericProcess } from '@trace.market/types';
import { ref, watch } from 'vue';
import TimestampInput from '../TimestampInput.vue';
import BasicInput from '../BasicInput.vue';
import TemperatureRangeEditor from '../TemperatureRangeEditor.vue';
import InputInstanceArrayEditor from '../InputInstanceArrayEditor.vue';
import PriceEditor from '../PriceEditor.vue';
import ImpactArrayEditor from '../impacts/ImpactArrayEditor.vue';
import SiteEditor from '../SiteEditor.vue';

const props = defineProps<{ modelValue: GenericProcess | undefined }>();
const emit = defineEmits(['update:modelValue']);

// Initialize with props.modelValue
const value = ref(props.modelValue);

// Watch for external updates (e.g. from parent/AI)
watch(
  () => props.modelValue,
  (newVal) => {
    console.log(
      '[GenericProcessEditor] props.modelValue updated',
      newVal?.inputInstances?.length
    );
    if (newVal !== value.value) {
      value.value = newVal;
    }
  }
);

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);
</script>
