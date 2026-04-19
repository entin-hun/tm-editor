<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <!-- Feed actions -->
        <div class="row q-gutter-xs q-mb-sm">
          <q-btn
            v-if="!loadedKey"
            flat dense no-caps size="sm"
            icon="save" label="Save"
            color="primary"
            :loading="isFeedSaving"
            @click="onFeedSave"
          >
            <q-tooltip>Save to Swarm inventory feed</q-tooltip>
          </q-btn>
          <q-btn
            flat dense no-caps size="sm"
            icon="cloud_download" label="Load"
            color="grey-4"
            :loading="isFeedLoading"
            @click="onFeedLoadOpen"
          >
            <q-tooltip>Load reference from inventory feed</q-tooltip>
          </q-btn>
          <q-btn
            v-if="loadedKey && isDirty"
            flat dense no-caps size="sm"
            icon="upload" label="Update"
            color="warning"
            :loading="isFeedSaving"
            @click="onFeedUpdate"
          >
            <q-tooltip>Update linked feed entry with current values</q-tooltip>
          </q-btn>
        </div>

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

  <!-- Feed item picker dialog -->
  <q-dialog v-model="showFeedPicker">
    <q-card dark style="min-width:320px;max-width:480px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Load from feed</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section>
        <div v-if="!feedPickerItems.length" class="text-grey-5 text-caption">
          No items in your tool feed yet.
        </div>
        <q-list v-else separator>
          <q-item
            v-for="entry in feedPickerItems"
            :key="entry.key"
            clickable
            v-close-popup
            @click="onFeedPick(entry)"
          >
            <q-item-section>
              <q-item-label>{{ entry.name || entry.key }}</q-item-label>
              <q-item-label caption>{{ entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="primary" :label="'#' + entry.key" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { MachineInstance } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import { clone, defaultMachineInstance } from './defaults';
import { ref, watch, inject, computed, type Ref } from 'vue';
import HrEditor from './HrEditor.vue';
import { api } from 'src/boot/axios';
import { useQuasar } from 'quasar';
import { useSwarmInventoryFeed, type FeedEntry } from 'src/composables/useSwarmInventoryFeed';

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

const { saveItem, loadItems } = useSwarmInventoryFeed();
const isFeedSaving = ref(false);
const isFeedLoading = ref(false);
const showFeedPicker = ref(false);
const feedPickerItems = ref<FeedEntry[]>([]);
const loadedKey = ref<string | null>(null);
const loadedSnapshot = ref<string | null>(null);
const isDirty = computed(() =>
  loadedSnapshot.value !== null && JSON.stringify(value.value) !== loadedSnapshot.value
);

async function onFeedSave() {
  isFeedSaving.value = true;
  try {
    const { key } = await saveItem('machine', JSON.parse(JSON.stringify(value.value)));
    loadedKey.value = key;
    hashReference.value = key;
    $q.notify({ message: 'Tool saved to feed', color: 'positive' });
  } catch (e: unknown) {
    $q.notify({ message: `Save failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedSaving.value = false;
  }
}

async function onFeedLoadOpen() {
  isFeedLoading.value = true;
  try {
    feedPickerItems.value = await loadItems('machine');
    showFeedPicker.value = true;
  } catch (e: unknown) {
    $q.notify({ message: `Load failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedLoading.value = false;
  }
}

function onFeedPick(entry: FeedEntry) {
  if (entry.value && typeof entry.value === 'object') {
    value.value = entry.value as MachineInstance;
  }
  loadedKey.value = entry.key;
  hashReference.value = entry.key;
  loadedSnapshot.value = JSON.stringify(value.value);
  $q.notify({ message: `Loaded feed entry #${entry.key}`, color: 'positive' });
}

async function onFeedUpdate() {
  if (!loadedKey.value) return;
  isFeedSaving.value = true;
  try {
    await saveItem('machine', JSON.parse(JSON.stringify(value.value)), loadedKey.value);
    $q.notify({ message: 'Feed entry updated', color: 'positive' });
  } catch (e: unknown) {
    $q.notify({ message: `Update failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedSaving.value = false;
  }
}

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
