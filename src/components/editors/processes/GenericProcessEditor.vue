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
import { GenericProcess } from '@fairfooddata/types';
import { ref, watch } from 'vue';

import TimestampInput from '../TimestampInput.vue';
import BasicInput from '../BasicInput.vue';
import TemperatureRangeEditor from '../TemperatureRangeEditor.vue';
import InputInstanceArrayEditor from '../InputInstanceArrayEditor.vue';
import PriceEditor from '../PriceEditor.vue';
import ImpactArrayEditor from '../impacts/ImpactArrayEditor.vue';
import SiteEditor from '../SiteEditor.vue';

const props = defineProps<{ modelValue: GenericProcess }>();

const value = ref(props.modelValue);

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => emit('update:modelValue', newValue));
</script>
