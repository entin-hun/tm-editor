<template>
  <q-card class="q-my-md" dark style="max-width: 100%">
    <div class="q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-sm">
        <div class="text-caption text-grey-5">What to Add?</div>
        <q-btn-toggle
          v-model="selectedTarget"
          :options="targetOptions"
          dense
          no-caps
          toggle-color="primary"
          color="grey-9"
          text-color="white"
          unelevated
          class="edit-target-toggle"
        />
        <div class="col"></div>
        <slot name="actions" />
      </div>
      <q-card class="q-mt-md" dark v-show="selectedTarget === 'instance'">
        <q-card-section class="q-pa-md">
          <div class="text-subtitle2 q-mb-sm">Instance</div>
          <ProductInstanceEditor
            v-model="value.instance"
            label="instance"
            priced
            is-root
            :show-process="true"
          />
          <BasicInput
            v-model="value.contract"
            label="contract"
            default-value=""
          />
          <BasicInput
            v-model="value.description"
            label="notes"
            default-value=""
          />
          <q-select
            v-model="value.typesVersion"
            label="typesVersion (schema)"
            :options="availableVersions"
            :loading="loadingVersions"
            emit-value
            map-options
          />
        </q-card-section>
      </q-card>
      <q-card class="q-mt-md" dark v-show="selectedTarget === 'machine'">
        <q-card-section class="q-pa-md">
          <div class="text-subtitle2 q-mb-sm">Tool</div>
          <MachineInstanceEditor
            v-model="machineDraft"
            label="tool"
            :show-reference-hash="false"
            :show-fields="true"
            :show-hr="false"
          />
        </q-card-section>
      </q-card>
      <q-card class="q-mt-md" dark v-show="selectedTarget === 'knowHow'">
        <q-card-section class="q-pa-md">
          <div class="text-subtitle2 q-mb-sm">Know-How</div>
          <KnowHowEditor
            v-model="knowHowDraft"
            label="knowHow"
            :show-reference-hash="false"
            :show-fields="true"
            :show-price="false"
          />
        </q-card-section>
      </q-card>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { Pokedex, MachineInstance, KnowHow } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import {
  clone,
  defaultKnowHow,
  defaultMachineInstance,
  defaultPokedex,
} from './defaults';
import { ref, watch, onMounted } from 'vue';
import ProductInstanceEditor from './ProductInstanceEditor.vue';
import MachineInstanceEditor from './MachineInstanceEditor.vue';
import KnowHowEditor from './KnowHowEditor.vue';
import axios from 'axios';
import { useSchemaStore } from '../../stores/schemaStore';

const props = defineProps<{
  modelValue: Pokedex;
  machineDraft?: MachineInstance;
  knowHowDraft?: KnowHow;
}>();
const schemaStore = useSchemaStore();

const value = ref(props.modelValue ?? clone(defaultPokedex));
const machineDraft = ref(props.machineDraft ?? clone(defaultMachineInstance));
const knowHowDraft = ref(props.knowHowDraft ?? clone(defaultKnowHow));
const selectedTarget = ref<'instance' | 'machine' | 'knowHow'>('instance');
const targetOptions = [
  { label: 'Instance', value: 'instance' },
  { label: 'Tool', value: 'machine' },
  { label: 'Know-How', value: 'knowHow' },
];
const availableVersions = ref<string[]>([]);
const loadingVersions = ref(false);

const emit = defineEmits([
  'update:modelValue',
  'update:selectedTarget',
  'update:machineDraft',
  'update:knowHowDraft',
]);

async function fetchVersions() {
  loadingVersions.value = true;
  try {
    // Try to fetch from jsdelivr as it supports CORS and lists versions
    const response = await axios.get(
      'https://data.jsdelivr.com/v1/package/npm/@trace.market/types'
    );
    if (response.data && Array.isArray(response.data.versions)) {
      availableVersions.value = response.data.versions;
      // Default to latest if not set
      if (!value.value.typesVersion && availableVersions.value.length > 0) {
        value.value.typesVersion = availableVersions.value[0];
      }
    }
  } catch (e) {
    console.error('Failed to fetch types versions', e);
  } finally {
    loadingVersions.value = false;
  }
}

// Watch for version changes and update the schema store
watch(
  () => value.value.typesVersion,
  async (newVersion) => {
    if (newVersion) {
      await schemaStore.fetchVersion(newVersion);
    }
  },
  { immediate: true }
);

onMounted(() => {
  fetchVersions();
});

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

watch(
  selectedTarget,
  (newValue) => {
    emit('update:selectedTarget', newValue);
  },
  { immediate: true }
);

watch(
  machineDraft,
  (newValue) => {
    emit('update:machineDraft', newValue);
  },
  { deep: true }
);

watch(
  knowHowDraft,
  (newValue) => {
    emit('update:knowHowDraft', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    console.log('[PokedexEditor] props.modelValue changed');
    if (newVal !== value.value) {
      console.log('[PokedexEditor] Updating internal value ref');
      value.value = newVal ?? clone(defaultPokedex);
    }
  }
);

watch(
  () => props.machineDraft,
  (newVal) => {
    if (newVal && newVal !== machineDraft.value) {
      machineDraft.value = newVal;
    }
  }
);

watch(
  () => props.knowHowDraft,
  (newVal) => {
    if (newVal && newVal !== knowHowDraft.value) {
      knowHowDraft.value = newVal;
    }
  }
);
</script>

<style scoped>
.edit-target-toggle {
  display: flex;
  gap: 15px;
}
.edit-target-toggle .q-btn-group {
  display: flex;
  gap: 15px;
}
.edit-target-toggle .q-btn {
  margin-right: 15px !important;
}
.edit-target-toggle .q-btn:last-child {
  margin-right: 0 !important;
}
</style>
