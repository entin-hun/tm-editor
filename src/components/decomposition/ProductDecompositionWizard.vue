<template>
  <q-card class="decomposition-wizard column fit flat">
    <!-- Header -->
    <q-card-section class="bg-primary text-white row items-center q-py-sm">
      <div class="text-h6 col">Import Wizard</div>
      <q-btn flat round icon="settings" @click="$emit('open-settings')">
        <q-tooltip>AI Settings</q-tooltip>
      </q-btn>
    </q-card-section>

    <!-- Progress -->
    <q-linear-progress
      :value="currentStep / 5"
      color="secondary"
      class="q-mt-none"
    />

    <!-- Content -->
    <q-card-section class="col scroll q-pa-none">
      <!-- Step 1: Select Product Type -->
      <div v-if="currentStep === 1" class="q-pa-md">
        <div class="text-h6 q-mb-md">Select Product Type</div>
        <p class="text-body2 text-grey-7 q-mb-lg">
          Choose the category of product you want to import. This determines
          which external databases we search.
        </p>
        <q-option-group
          v-model="localProductType"
          :options="productTypeOptions"
          color="primary"
          type="radio"
        />
        <div class="row q-mt-lg justify-end">
          <q-btn
            color="primary"
            label="Next"
            @click="handleStep1"
            :disable="!localProductType"
          />
        </div>
      </div>

      <!-- Step 2: Search -->
      <div v-if="currentStep === 2" class="q-pa-md">
        <div class="text-h6 q-mb-md">Search Product</div>
        <div class="row items-center q-mb-md">
          <p class="text-body2 text-grey-7 col q-mb-none">
            Enter a product name or barcode.
          </p>
        </div>

        <q-input
          v-model="searchQuery"
          outlined
          dense
          placeholder="Search..."
          @keyup.enter="handleSearch"
          autofocus
        >
          <template #append>
            <q-btn
              flat
              round
              icon="search"
              @click="handleSearch"
              :loading="isLoading"
            />
          </template>
        </q-input>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="q-mt-md">
          <div class="text-subtitle2 q-mb-sm text-grey-8">Results</div>
          <q-list bordered separator class="rounded-borders">
            <q-item
              v-for="result in searchResults"
              :key="result.id"
              clickable
              v-ripple
              @click="selectSearchResult(result)"
              :active="selectedResult?.id === result.id"
              active-class="bg-blue-1"
            >
              <q-item-section avatar v-if="result.imageUrl">
                <q-avatar rounded>
                  <img :src="result.imageUrl" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ result.name }}</q-item-label>
                <q-item-label caption lines="2">
                  {{ result.description }}
                </q-item-label>
                <q-item-label
                  caption
                  class="row items-center q-gutter-x-sm q-mt-xs"
                >
                  <data-source-badge :source="result.source" size="xs" />
                  <q-badge
                    outline
                    :color="confidenceColor(result.confidence)"
                    :label="`${Math.round(result.confidence * 100)}% conf.`"
                  />
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- No Results -->
        <div
          v-if="searchQuery && !isLoading && searchResults.length === 0"
          class="q-mt-md"
        >
          <q-banner class="bg-warning text-white rounded-borders">
            <template #avatar>
              <q-icon name="warning" />
            </template>
            No results found.
          </q-banner>
        </div>

        <div class="row q-mt-lg justify-between">
          <q-btn flat label="Back" @click="previousStep" />
        </div>
      </div>

      <!-- Step 3: Generating -->
      <div
        v-if="currentStep === 3"
        class="q-pa-md flex flex-center column"
        style="min-height: 200px"
      >
        <q-spinner-dots color="primary" size="50px" />
        <p class="text-body1 q-mt-md">Generating preview...</p>
      </div>

      <!-- Step 4: Preview -->
      <div v-if="currentStep === 4" class="q-pa-md">
        <div class="text-h6 q-mb-md">Review Data</div>
        <p class="text-body2 text-grey-7 q-mb-md">
          Hierarchy generated from external sources.
        </p>

        <decomposition-tree-view
          v-if="previewTree"
          :tree="previewTree"
          @toggle-expansion="handleToggleExpansion"
          @edit-node="handleEditNode"
        />
        <div v-else class="text-center text-grey">No preview available.</div>

        <div class="row q-mt-lg justify-between items-center">
          <q-btn flat label="Back" @click="previousStep" />
          <q-btn
            color="positive"
            icon="check"
            label="Import Data"
            @click="handleAccept"
          />
        </div>
      </div>

      <!-- Error Display -->
      <q-banner
        v-if="errorMessage"
        class="bg-negative text-white q-mt-md q-mx-md"
      >
        <template #avatar>
          <q-icon name="error" />
        </template>
        {{ errorMessage }}
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useDecompositionStore } from '../../stores/decomposition';
import DecompositionTreeView from './DecompositionTreeView.vue';
import DataSourceBadge from './DataSourceBadge.vue';
import { storeToRefs } from 'pinia';
import type {
  SearchResult,
  DecompositionNode,
} from '../../types/decomposition';
import type { ProductType } from '../../services/DecompositionEngine';

// Props
interface Props {
  modelValue?: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  accept: [data: any];
  close: [];
  'open-settings': [];
}>();

// Store
const decompositionStore = useDecompositionStore();
const {
  currentStep,
  productType,
  searchQuery: storeSearchQuery,
  searchResults,
  selectedResult,
  previewTree,
  loading: isLoading,
  error: errorMessage,
} = storeToRefs(decompositionStore);

const searchQuery = ref('');
const localProductType = ref<ProductType | undefined>(productType.value);

// Sync local ref with store
watch(localProductType, (val) => {
  if (val) decompositionStore.setProductType(val);
});

// Options
const productTypeOptions = [
  { label: 'Food / Consumer Goods', value: 'Food' as ProductType },
  { label: 'Hardware / Electronics', value: 'Hardware' as ProductType },
  { label: 'Manufacturing / DIY', value: 'Manufacturing' as ProductType },
];

function handleStep1() {
  decompositionStore.nextStep();
}

function handleSearch() {
  if (searchQuery.value) {
    decompositionStore.searchDatabases(searchQuery.value);
  }
}

function confidenceColor(score: number) {
  if (score >= 0.8) return 'positive';
  if (score >= 0.5) return 'warning';
  return 'negative';
}

function selectSearchResult(result: SearchResult) {
  // Select and trigger generation
  decompositionStore.selectResult(result);
  decompositionStore.nextStep(); // Goes to step 3 (Loading/Generating)
  decompositionStore.generatePreview();
}

function handleAccept() {
  decompositionStore.finishWizard();
}

function previousStep() {
  decompositionStore.previousStep();
}

function handleToggleExpansion(nodeId: string) {
  decompositionStore.toggleNodeExpansion(nodeId);
}

function handleEditNode(payload: { nodeId: string; updates: any }) {
  // Implement edit logic
  console.log('Edit node', payload);
}
</script>

<style scoped>
.decomposition-wizard {
  /* Fits container */
}
</style>
