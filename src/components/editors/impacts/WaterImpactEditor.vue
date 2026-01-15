<template>
  <GenericImpactEditor v-model="value" />
</template>

<script setup lang="ts">
import { WaterImpact } from '@trace.market/types';
import GenericImpactEditor from './GenericImpactEditor.vue';
import { ref } from 'vue';

const props = defineProps<{ modelValue: WaterImpact }>();

const value = ref(props.modelValue);
</script>
