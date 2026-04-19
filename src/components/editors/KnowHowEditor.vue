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
          >
            <template #append>
              <q-icon
                name="inventory_2"
                class="cursor-pointer"
                title="Open List"
                @click.stop="switchToTab('tm-list')"
              />
            </template>
          </q-input>
          <div class="text-caption text-grey-6 q-mb-md">
            Paste a know-how NFT hash to load its fields into this editor.
          </div>
        </template>

        <!-- Feed actions -->
        <div class="row q-gutter-xs q-mb-sm">
          <q-btn
            flat dense no-caps size="sm"
            icon="save" label="Save"
            color="primary"
            :loading="isFeedSaving"
            @click="onFeedSave"
          >
            <q-tooltip>Save full JSON to Swarm inventory feed</q-tooltip>
          </q-btn>
          <q-btn
            flat dense no-caps size="sm"
            icon="cloud_download" label="Load"
            color="grey-4"
            :loading="isFeedLoading"
            @click="onFeedLoadOpen"
          >
            <q-tooltip>Load fields from inventory feed</q-tooltip>
          </q-btn>
          <q-btn
            v-if="loadedKey"
            flat dense no-caps size="sm"
            icon="upload" label="Update"
            color="warning"
            :loading="isFeedSaving"
            @click="onFeedUpdate"
          >
            <q-tooltip>Update feed entry with current JSON</q-tooltip>
          </q-btn>
        </div>
        <template v-if="showFields">
          <BasicInput v-model="value.owner" label="owner" default-value="" />
          <BasicInput v-model="value.logoURL" label="logoURL" />
          <BasicInput v-model="value.hash" label="hash" default-value="" />
          <JsonataInputsEditor v-model="value.inputs" />
          <ProductInstanceEditor
            v-model="outputsInstance"
            label="outputs"
            :priced="false"
            :show-process="false"
          />
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
          No items in your know-how feed yet.
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
import { KnowHow, ProductInstance } from '@trace.market/types';
import BasicInput from './BasicInput.vue';
import PriceEditor from './PriceEditor.vue';
import { clone, defaultKnowHow, defaultProductInstance } from './defaults';
import { ref, watch, inject } from 'vue';
import { defaultPrice } from './defaults';
import { api } from 'src/boot/axios';
import { useQuasar } from 'quasar';
import JsonataInputsEditor from './JsonataInputsEditor.vue';
import ProductInstanceEditor from './ProductInstanceEditor.vue';
import { useSwarmInventoryFeed, type FeedEntry } from 'src/composables/useSwarmInventoryFeed';

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
const outputsSyncing = ref(false);
const outputsTouched = ref(false);
const outputsInstance = ref<ProductInstance>(clone(defaultProductInstance));
let resolveTimer: number | null = null;
const $q = useQuasar();

const { saveItem, loadItems } = useSwarmInventoryFeed();
const isFeedSaving = ref(false);
const isFeedLoading = ref(false);
const showFeedPicker = ref(false);
const feedPickerItems = ref<FeedEntry[]>([]);
const loadedKey = ref<string | null>(null);

async function onFeedSave() {
  isFeedSaving.value = true;
  try {
    const { key } = await saveItem('knowHow', JSON.parse(JSON.stringify(value.value)));
    loadedKey.value = key;
    hashReference.value = key;
    $q.notify({ message: 'Know-how saved to feed', color: 'positive' });
  } catch (e: unknown) {
    $q.notify({ message: `Save failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedSaving.value = false;
  }
}

async function onFeedLoadOpen() {
  isFeedLoading.value = true;
  try {
    feedPickerItems.value = await loadItems('knowHow');
    showFeedPicker.value = true;
  } catch (e: unknown) {
    $q.notify({ message: `Load failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedLoading.value = false;
  }
}

function onFeedPick(entry: FeedEntry) {
  // Populate all fields from the selected feed entry's full JSON.
  if (entry.value && typeof entry.value === 'object') {
    value.value = entry.value as KnowHow;
  }
  loadedKey.value = entry.key;
  hashReference.value = entry.key;
  $q.notify({ message: `Loaded #${entry.key} from feed`, color: 'positive' });
}

async function onFeedUpdate() {
  if (!loadedKey.value) return;
  isFeedSaving.value = true;
  try {
    await saveItem('knowHow', JSON.parse(JSON.stringify(value.value)), loadedKey.value);
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

function parseOutputs(raw: string | undefined): ProductInstance | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as ProductInstance;
    }
  } catch {
    return null;
  }
  return null;
}

function syncOutputsFromValue() {
  if (outputsSyncing.value) return;
  const parsed = parseOutputs(value.value.outputs);
  if (parsed) {
    outputsInstance.value = parsed;
  }
}

syncOutputsFromValue();

watch(
  () => value.value.outputs,
  () => {
    syncOutputsFromValue();
  }
);

watch(
  outputsInstance,
  (next) => {
    if (!outputsTouched.value && !value.value.outputs) {
      outputsTouched.value = true;
    }
    if (!outputsTouched.value) return;
    outputsSyncing.value = true;
    value.value.outputs = JSON.stringify(next, null, 2);
    outputsSyncing.value = false;
  },
  { deep: true }
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
