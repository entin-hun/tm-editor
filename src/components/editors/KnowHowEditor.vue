<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <template v-if="showReferenceHash">
          <q-input
            v-model="hashReference"
            label="reference hash"
            dense
            stack-label
            :loading="isResolving"
            @focus="switchToTab('tm-list')"
          />
          <div class="text-caption text-grey-6 q-mb-md">
            Paste a know-how NFT hash to load its fields into this editor.
          </div>
        </template>
        <template v-if="showFields">
          <BasicInput v-model="value.owner" label="owner" default-value="" />
          <BasicInput v-model="value.logoURL" label="logoURL" />
          <BasicInput v-model="value.hash" label="hash" default-value="" />
          <JsonataInputsEditor v-model="value.inputs" />
          <BasicInput v-model="value.outputs" label="outputs" default-value="" />
        </template>
        <PriceEditor
          v-if="showPrice"
          v-model="value.licenseFee"
          label="licenseFee"
          :default-value="defaultPrice"
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { KnowHow } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import PriceEditor from './PriceEditor.vue';
import { clone, defaultKnowHow } from './defaults';
import { ref, watch, inject } from 'vue';
import { defaultPrice } from './defaults';
import { api } from 'src/boot/axios';
import { useQuasar } from 'quasar';
import JsonataInputsEditor from './JsonataInputsEditor.vue';

const props = defineProps<{
  modelValue: KnowHow | undefined;
  label: string;
  showReferenceHash?: boolean;
  showFields?: boolean;
  showPrice?: boolean;
}>();

const value = ref(props.modelValue ?? clone(defaultKnowHow));
const showReferenceHash = props.showReferenceHash ?? true;
const showFields = props.showFields ?? true;
const showPrice = props.showPrice ?? true;
const hashReference = ref('');
const isResolving = ref(false);
let resolveTimer: number | null = null;
const $q = useQuasar();

const { switchToTab } = inject('tabActions', {
  switchToTab: (tab: string) => {
    void tab;
  },
});

const emit = defineEmits(['update:modelValue']);
const internalUpdate = ref(false);

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    if (internalUpdate.value) return;
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && JSON.stringify(newVal) !== JSON.stringify(value.value)) {
      internalUpdate.value = true;
      value.value = newVal;
      setTimeout(() => {
        internalUpdate.value = false;
      }, 0);
    }
  }
);

function isKnowHow(candidate: unknown): candidate is KnowHow {
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    'hash' in (candidate as KnowHow) &&
    'inputs' in (candidate as KnowHow) &&
    'outputs' in (candidate as KnowHow)
  );
}

function sanitizeKnowHow(candidate: KnowHow): KnowHow {
  const cleaned: Partial<KnowHow> = { ...candidate };

  if (!cleaned.owner?.trim()) delete cleaned.owner;
  if (!cleaned.hash?.trim()) delete cleaned.hash;
  if (!cleaned.inputs?.trim()) delete cleaned.inputs;
  if (!cleaned.outputs?.trim()) delete cleaned.outputs;
  if (!cleaned.logoURL?.trim()) delete cleaned.logoURL;
  if (!cleaned.note) delete cleaned.note;

  if (cleaned.licenseFee) {
    const fee = cleaned.licenseFee;
    const isEmptyFee =
      fee.amount === 0 && !fee.currency?.trim() && fee.type === 'budget';
    if (isEmptyFee) {
      delete cleaned.licenseFee;
    }
  }

  return cleaned as KnowHow;
}

async function resolveKnowHowHash() {
  const tokenId = hashReference.value.trim();
  if (!tokenId) return;

  isResolving.value = true;
  try {
    const response = await api.get<{ content: { instance?: unknown } }>(
      `/metadata/${tokenId}`
    );
    const candidate = response.data?.content?.instance ?? null;
    if (isKnowHow(candidate)) {
      value.value = sanitizeKnowHow(candidate);
      return;
    }
    $q.notify({
      message: 'No know-how instance found for that hash.',
      color: 'warning',
    });
  } catch (error) {
    console.error('[KnowHowEditor] Failed to load hash', error);
    $q.notify({
      message: 'Failed to load know-how NFT from hash.',
      color: 'negative',
    });
  } finally {
    isResolving.value = false;
  }
}

watch(hashReference, (newValue) => {
  if (!newValue?.trim()) return;
  if (resolveTimer) {
    window.clearTimeout(resolveTimer);
  }
  resolveTimer = window.setTimeout(() => {
    resolveKnowHowHash();
  }, 500);
});
</script>
