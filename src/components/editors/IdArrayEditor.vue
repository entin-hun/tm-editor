<template>
  <q-card class="q-mt-md" dark>
    <q-expansion-item :label="label" default-opened>
      <div class="q-pa-md">
        <div v-if="array !== undefined">
          <template v-for="(item, index) in array" :key="item">
            <q-card class="row q-pa-md q-mb-md" dark>
              <div class="col">
                <IdEditor v-model="array[index]" />
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
        <q-btn
          icon="add"
          @click="addElement(clone(defaultId))"
          color="primary"
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { ID } from '@trace.market/types';
import { Ref, computed, ref, watch } from 'vue';
import { clone, defaultId } from './defaults';
import IdEditor from './IdEditor.vue';

const props = defineProps<{ modelValue: ID[] | undefined; label: string }>();

let array: Ref<ID[] | undefined>;

if (props.modelValue === undefined) {
  array = ref(undefined);
} else {
  array = ref(props.modelValue);
}

function addElement(element: ID) {
  if (array.value === undefined) array.value = [];
  array.value.push(element);
}

function removeElement(index: number) {
  if (array.value === undefined) return;

  array.value.splice(index, 1);
  if (array.value.length === 0) array.value = undefined;
}

const emit = defineEmits(['update:modelValue']);

watch(array, (newValue) => {
  emit(
    'update:modelValue',
    newValue !== undefined && newValue.length > 0 ? newValue : undefined
  );
});

const label = computed(() => `${props.label} (${array.value?.length ?? 0})`);

if (props.modelValue === undefined)
  emit(
    'update:modelValue',
    array.value !== undefined && array.value.length > 0
      ? undefined
      : array.value
  );
</script>
