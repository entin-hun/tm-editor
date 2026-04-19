<template>
  <q-card class="q-my-md" dark>
    <q-expansion-item :label="$props.label" default-opened>
      <div class="q-pa-md">
        <!-- Feed actions -->
        <div class="row q-gutter-xs q-mb-sm">
          <q-btn
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
            v-if="loadedKey"
            flat dense no-caps size="sm"
            icon="upload" label="Update"
            color="warning"
            :loading="isFeedSaving"
            @click="onFeedUpdate"
          >
            <q-tooltip>Update linked feed entry with current values</q-tooltip>
          </q-btn>
        </div>
        <div v-if="loadedKey" class="text-caption text-grey-5 q-mb-sm">
          feed ref: #{{ loadedKey }}
        </div>
        <BasicInput
          v-model="value.label"
          label="label"
          :default-value="undefined"
        />
        <LocationEditor v-model="value.location" label="location" />
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
          No items in your site feed yet.
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
import { Site } from '@trace.market/types';
import { ref, watch } from 'vue';
import BasicInput from './BasicInput.vue';
import LocationEditor from './LocationEditor.vue';
import { defaultSite, clone } from './defaults';
import { useQuasar } from 'quasar';
import { useSwarmInventoryFeed, type FeedEntry } from 'src/composables/useSwarmInventoryFeed';

const props = defineProps<{ modelValue: Site | undefined; label: string }>();

const value = ref(props.modelValue ?? clone(defaultSite));

const emit = defineEmits(['update:modelValue']);
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
    const { key } = await saveItem('site', JSON.parse(JSON.stringify(value.value)));
    loadedKey.value = key;
    $q.notify({ message: 'Site saved to feed', color: 'positive' });
  } catch (e: unknown) {
    $q.notify({ message: `Save failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedSaving.value = false;
  }
}

async function onFeedLoadOpen() {
  isFeedLoading.value = true;
  try {
    feedPickerItems.value = await loadItems('site');
    showFeedPicker.value = true;
  } catch (e: unknown) {
    $q.notify({ message: `Load failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedLoading.value = false;
  }
}

function onFeedPick(entry: FeedEntry) {
  if (entry.value && typeof entry.value === 'object') {
    value.value = { ...clone(defaultSite), ...(entry.value as object) };
  }
  loadedKey.value = entry.key;
  $q.notify({ message: `Loaded feed entry #${entry.key}`, color: 'positive' });
}

async function onFeedUpdate() {
  if (!loadedKey.value) return;
  isFeedSaving.value = true;
  try {
    await saveItem('site', JSON.parse(JSON.stringify(value.value)), loadedKey.value);
    $q.notify({ message: 'Feed entry updated', color: 'positive' });
  } catch (e: unknown) {
    $q.notify({ message: `Update failed: ${e instanceof Error ? e.message : String(e)}`, color: 'negative', icon: 'error' });
  } finally {
    isFeedSaving.value = false;
  }
}

// Emit deep changes so parent stays in sync
watch(
  value,
  (newValue) => {
    emit('update:modelValue', newValue);
  },
  { deep: true }
);

// Update internal state when parent replaces the object (e.g., JSON editor)
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) {
      value.value = newVal ?? clone(defaultSite);
    }
  }
);
</script>
