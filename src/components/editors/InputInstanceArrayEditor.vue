<template>
  <q-card class="q-mt-md" dark>
    <q-expansion-item :label="label" default-opened>
      <div class="q-pa-md">
        <template v-for="(item, index) in array" :key="index">
          <q-card class="row q-pa-md q-mb-md" dark>
            <div class="col">
              <InputInstanceEditor :value="item" />
            </div>
            <div>
              <q-btn
                round
                @click="array.splice(index, 1)"
                icon="remove"
                color="primary"
                class="q-ml-md"
              />
            </div>
          </q-card>
        </template>
        <q-btn-dropdown icon="add" color="primary">
          <q-list>
            <q-item
              clickable
              v-close-popup
              @click="array.push(clone(defaultLocalInputInstance))"
            >
              <q-item-section>
                <q-item-label>LocalInputInstance</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              clickable
              v-close-popup
              @click="array.push(clone(defaultTransportedInputInstance))"
            >
              <q-item-section>
                <q-item-label>TransportedInputInstance</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { InputInstance } from '@trace.market/types';
import { computed, ref, watch } from 'vue';
import {
  clone,
  defaultLocalInputInstance,
  defaultTransportedInputInstance,
} from './defaults';
import InputInstanceEditor from './InputInstanceEditor.vue';

const props = defineProps<{ modelValue: InputInstance[]; label: string }>();

const array = ref<InputInstance[]>(props.modelValue ?? []);

const emit = defineEmits(['update:modelValue']);

// Emit deep changes so parent stays in sync
watch(
  array,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the array (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    console.log(
      '[InputInstanceArrayEditor] props.modelValue updated, length:',
      newVal?.length
    );
    if (newVal !== array.value) {
      array.value = newVal ?? [];
    }
  }
);

const label = computed(() => `${props.label} (${array.value?.length ?? 0})`);
</script>
