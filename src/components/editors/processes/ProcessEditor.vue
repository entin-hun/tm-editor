<template>
  <q-card class="q-pa-md" dark>
    <div class="column">
      <GenericProcessEditor v-model="model" />
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { Process } from '@trace.market/types';
import { ref } from 'vue';

import GenericProcessEditor from './GenericProcessEditor.vue';

const props = defineProps<{ modelValue: Process }>();

const model = ref(props.modelValue);
</script>
