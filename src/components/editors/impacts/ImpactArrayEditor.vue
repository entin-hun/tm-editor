<template>
  <q-card class="q-mt-md" dark>
    <q-expansion-item :label="label" default-opened>
      <div class="q-pa-md">
        <div
          v-if="openLCAActions !== null"
          class="row items-center q-gutter-sm q-mb-md flex-wrap"
        >
          <q-btn
            icon="analytics"
            color="secondary"
            outline
            size="sm"
            label="Estimate impacts"
            @click="openLCAActions.estimate()"
            class="q-mb-sm"
          />
          <q-btn-dropdown icon="add" color="primary" size="sm" class="q-mb-sm">
            <q-list>
              <q-item
                clickable
                v-close-popup
                @click="addElement(clone(defaultWaterImpact))"
              >
                <q-item-section>
                  <q-item-label>WaterImpact</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="addElement(clone(defaultCarbonImpact))"
              >
                <q-item-section>
                  <q-item-label>CarbonImpact</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
        <div v-if="array !== undefined">
          <template v-for="(item, index) in array" :key="[index, item]">
            <q-card class="row q-pa-md q-mb-md" dark>
              <div class="col">
                <ImpactEditor v-model="array[index]" />
              </div>
              <div>
                <q-btn
                  round
                  @click="removeElement(index)"
                  icon="remove"
                  color="primary"
                  class="q-ml-md"
                />
              </div>
            </q-card>
          </template>
        </div>
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { Impact } from '@trace.market/types';
import { computed, inject, ref, watch } from 'vue';
import { clone, defaultWaterImpact, defaultCarbonImpact } from '../defaults';
import ImpactEditor from './ImpactEditor.vue';

const props = defineProps<{
  modelValue: Impact[] | undefined;
  label: string;
}>();

const openLCAActions = inject<{
  estimate: () => void;
  exportData: () => void;
} | null>('openlcaActions', null);

const array = ref(props.modelValue);

function addElement(element: Impact) {
  if (array.value === undefined) array.value = [];
  array.value.push(element);
}

function removeElement(index: number) {
  if (array.value === undefined) return;

  array.value.splice(index, 1);
  if (array.value.length === 0) array.value = undefined;
}

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
    if (newVal !== array.value) {
      array.value = newVal;
    }
  }
);

const label = computed(() => `${props.label} (${array.value?.length ?? 0})`);
</script>
