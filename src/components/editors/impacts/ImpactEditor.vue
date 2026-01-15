<template>
  <BasicInput v-model="value.category" readonly />

  <CarbonImpactEditor v-if="value.category === 'carbon'" v-model="value" />
  <WaterImpactEditor v-if="value.category === 'water'" v-model="value" />
</template>

<script setup lang="ts">
import BasicInput from '../BasicInput.vue';
import { Impact } from '@trace.market/types';
import CarbonImpactEditor from './CarbonImpactEditor.vue';
import WaterImpactEditor from './WaterImpactEditor.vue';
import { ref } from 'vue';

const props = defineProps<{ modelValue: Impact }>();

const value = ref(props.modelValue);
</script>
