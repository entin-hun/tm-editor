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
            Paste a tool NFT hash to load its details into this editor.
          </div>
        </template>
        <template v-if="showFields">
          <BasicInput
            v-model="value.category"
            label="category"
            default-value=""
          />
          <BasicInput
            v-model="value.ownerId"
            label="ownerId"
            default-value=""
          />
          <BasicInput
            v-model.number="value.quantity"
            label="quantity"
            default-value=""
            type="number"
          />
          <BasicInput
            v-model.number="toolValue.ratedPowerKW"
            label="ratedPowerKW"
            default-value=""
            type="number"
          />
          <BasicInput v-model="value.size" label="size" default-value="" />
          <BasicInput
            v-model="value.providerSDomain"
            label="providerSDomain"
            default-value=""
          />
        </template>
        <HrEditor
          v-if="showHr"
          v-model="value.hr"
          label="hr"
          default-value=""
        />
      </div>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { MachineInstance } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import { clone, defaultMachineInstance } from './defaults';
import { ref, watch, inject, type Ref } from 'vue';
import HrEditor from './HrEditor.vue';
import { api } from 'src/boot/axios';
import { useQuasar } from 'quasar';

const props = defineProps<{
  modelValue: MachineInstance | undefined;
  label: string;
  showReferenceHash?: boolean;
  showFields?: boolean;
  showHr?: boolean;
}>();

const value = ref(props.modelValue ?? clone(defaultMachineInstance));
const toolValue = value as Ref<MachineInstance & { ratedPowerKW?: number }>;
const showReferenceHash = props.showReferenceHash ?? true;
const showFields = props.showFields ?? true;
const showHr = props.showHr ?? true;
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

function isMachineInstance(candidate: unknown): candidate is MachineInstance {
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    'providerSDomain' in (candidate as MachineInstance) &&
    'hr' in (candidate as MachineInstance)
  );
}

function sanitizeMachineInstance(candidate: MachineInstance): MachineInstance {
  const cleaned: Partial<MachineInstance> = { ...candidate };

  if (!cleaned.category?.trim()) delete cleaned.category;
  if (!cleaned.ownerId?.trim()) delete cleaned.ownerId;
  if (!cleaned.size?.trim()) delete cleaned.size;
  if (!cleaned.providerSDomain?.trim()) delete cleaned.providerSDomain;
  if (cleaned.quantity === 0) delete cleaned.quantity;

  if (cleaned.hr) {
    const { tasks, assignee } = cleaned.hr;
    if (!tasks?.trim() && !assignee?.trim()) {
      delete cleaned.hr;
    }
  }

  return cleaned as MachineInstance;
}

async function resolveMachineHash() {
  const tokenId = hashReference.value.trim();
  if (!tokenId) return;

  isResolving.value = true;
  try {
    const response = await api.get<{ content: { instance?: unknown } }>(
      `/metadata/${tokenId}`
    );
    const candidate = response.data?.content?.instance ?? null;
    if (isMachineInstance(candidate)) {
      value.value = sanitizeMachineInstance(candidate);
      return;
    }
    $q.notify({
      message: 'No machine instance found for that hash.',
      color: 'warning',
    });
  } catch (error) {
    console.error('[MachineInstanceEditor] Failed to load hash', error);
    $q.notify({
      message: 'Failed to load machine NFT from hash.',
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
    resolveMachineHash();
  }, 500);
});
</script>
