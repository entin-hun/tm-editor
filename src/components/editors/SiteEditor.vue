<template>
  <q-card class="q-my-md">
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <BasicInput
          v-model="value.label"
          label="label"
          :default-value="undefined"
        />
        <LocationEditor v-model="value.location" label="location" />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Site } from '@fairfooddata/types';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';
import LocationEditor from './LocationEditor.vue';

const props = defineProps<{ modelValue: Site; label: string }>();

const value = ref(props.modelValue);

const emit = defineEmits(['update:modelValue']);

watch(value, (newValue) => {
  emit('update:modelValue', newValue);
});
</script>
