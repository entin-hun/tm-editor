<template>
  <div class="q-pa-md text-white">
    <div class="text-h6 q-mb-md flex items-center justify-between">
      <div>
        <q-icon name="eco" class="q-mr-sm" color="green-4" />
        Eco Impact Estimate
      </div>
      <div>
        <q-btn
          v-if="!loading"
          flat
          dense
          icon="auto_awesome"
          label="Enhance with AI"
          color="accent"
          @click="enhance"
        >
          <q-tooltip>Use AI to find missing carbon benchmarks</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-6">
        <q-card dark bordered class="bg-grey-9">
          <q-card-section>
            <div class="text-caption text-grey-4">Total Carbon Footprint</div>
            <div class="text-h5 text-weight-bold text-green-4">
              <q-spinner-dots v-if="loading" color="green-4" size="0.8em" />
              <span v-else>{{ result.carbon.toFixed(2) }}</span>
              <span class="text-caption text-white q-ml-xs">kg CO2e</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6">
        <q-card dark bordered class="bg-grey-9">
          <q-card-section>
            <div class="text-caption text-grey-4">Carbon Intensity</div>
            <div class="text-h5 text-weight-bold">
              <q-spinner-dots v-if="loading" color="white" size="0.8em" />
              <span v-else>{{ result.intensity.toFixed(3) }}</span>
              <span class="text-caption text-grey-4 q-ml-xs">kg/kg</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="q-mb-md flex items-center q-gutter-x-md">
      <q-badge :color="badgeColor">
        Source: {{ result.source.toUpperCase() }}
      </q-badge>
      <div v-if="status" class="text-caption text-accent fade-in">
        <q-spinner-dots class="q-mr-xs" /> {{ status }}
      </div>
    </div>

    <div class="text-caption text-grey-5 q-mb-md">API: {{ apiUrl }}</div>

    <div class="text-subtitle2 q-mb-sm">Breakdown</div>
    <q-markup-table dark dense flat bordered class="bg-grey-9 eco-table">
      <thead>
        <tr>
          <th class="text-left text-weight-bold">Component</th>
          <th class="text-right text-weight-bold">Share</th>
          <th class="text-right text-weight-bold">kg CO2e</th>
          <th class="text-right text-weight-bold">Range</th>
          <th class="text-left text-weight-bold">Source</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, idx) in displayBreakdown" :key="idx">
          <td class="text-left">
            {{ item.name }}
            <q-icon
              v-if="item.warning"
              name="info"
              size="xs"
              class="q-ml-xs text-warning cursor-pointer"
            >
              <q-tooltip>{{ item.warning }}</q-tooltip>
            </q-icon>
          </td>
          <td class="text-right">{{ item.percentage.toFixed(1) }}%</td>
          <td class="text-right">{{ item.impact.toFixed(3) }}</td>
          <td class="text-right">
            <span v-if="item.impactMin !== null && item.impactMax !== null">
              {{ item.impactMin.toFixed(3) }} – {{ item.impactMax.toFixed(3) }}
            </span>
            <span v-else>—</span>
          </td>
          <td class="text-left">
            <span>{{ item.source ?? '—' }}</span>
            <q-btn
              v-if="item.sourceUrl"
              dense
              flat
              icon="open_in_new"
              size="sm"
              :href="item.sourceUrl"
              target="_blank"
              rel="noopener"
              class="q-ml-xs"
            />
          </td>
        </tr>
        <tr v-if="displayBreakdown.length === 0">
          <td colspan="5" class="text-center text-grey">
            No breakdown available (Direct match or no data)
          </td>
        </tr>
      </tbody>
    </q-markup-table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { Pokedex } from '@trace.market/types';
import {
  estimateEco,
  estimateEcoWithAI,
  EcoImpactResult,
} from 'src/services/ecoService';
import { calculateImpacts } from 'src/services/openLCAClient';
import {
  fetchNonFoodCarbon,
  type NonFoodCarbonResponse,
} from 'src/services/nonFoodService';

type ApiBreakdownRow = {
  name: string;
  impact: number;
  percentage: number;
  source?: string | null;
  sourceUrl?: string | null;
  warning?: string | null;
  impactMin: number | null;
  impactMax: number | null;
};

const props = defineProps<{
  pokedex: Pokedex;
}>();

const FOOD_API_URL = 'https://lca.trace.market/result/calculate';
const NON_FOOD_API_URL = 'https://add.trace.market/suggest/non-food';

const result = ref<EcoImpactResult>(estimateEco(props.pokedex));
const loading = ref(false);
const status = ref('');
const apiBreakdown = ref<ApiBreakdownRow[]>([]);
// const tooltipStates = ref<Record<number, boolean>>({}); // Removed to restore default hover behavior

const productCategory = computed(() => {
  const category = (props.pokedex?.instance as any)?.category;
  return typeof category === 'string' ? category.toLowerCase() : '';
});

const isFoodProduct = computed(() => productCategory.value === 'food');

const apiUrl = computed(() =>
  isFoodProduct.value ? FOOD_API_URL : NON_FOOD_API_URL
);

const badgeColor = computed(() => {
  switch (result.value.source) {
    case 'database':
      return 'green';
    case 'calculated':
      return 'blue';
    case 'ai-estimated':
      return 'purple';
    default:
      return 'grey';
  }
});

watch(
  () => props.pokedex,
  (newVal) => {
    if (!loading.value) {
      result.value = estimateEco(newVal);
      apiBreakdown.value = [];
    }
  },
  { deep: true, immediate: true }
);

const displayBreakdown = computed(() => {
  const rows = apiBreakdown.value.length
    ? apiBreakdown.value
    : result.value.breakdown.map((item) => ({
        name: item.name,
        impact: item.impact,
        percentage: item.percentage,
        source: null,
        sourceUrl: null,
        warning: null,
        impactMin: null,
        impactMax: null,
      }));

  return [...rows].sort((a, b) => b.percentage - a.percentage);
});

/* function toggleTooltip(idx: number) {
  tooltipStates.value[idx] = !tooltipStates.value[idx];
} */

async function requestApiEstimate() {
  loading.value = true;
  status.value = isFoodProduct.value
    ? 'Requesting carbon estimate from API...'
    : 'Requesting non-food carbon estimate...';
  try {
    if (isFoodProduct.value) {
      await requestFoodApiEstimate();
    } else {
      await requestNonFoodApiEstimate();
    }
  } catch (e) {
    status.value = 'API request failed';
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function requestFoodApiEstimate() {
  const apiResult = await calculateImpacts(props.pokedex);
  if (apiResult?.success) {
    console.log('[EcoPanel] OpenLCA API response:', apiResult.data);

    const data = apiResult.data as any;
    const totalCO2 = Number(data?.totalCO2 ?? 0);
    const breakdownItems = Array.isArray(data?.breakdown) ? data.breakdown : [];
    const breakdown = breakdownItems.map((item: any) => {
      const impact = Number(item?.impact ?? 0);
      return {
        name: String(item?.name ?? 'Unknown'),
        impact,
        percentage: totalCO2 > 0 ? (impact / totalCO2) * 100 : 0,
      };
    });

    const hasAi = breakdownItems.some((item: any) =>
      String(item?.source ?? '')
        .toLowerCase()
        .includes('ai')
    );
    const source: EcoImpactResult['source'] = hasAi
      ? 'ai-estimated'
      : 'calculated';

    const quantityKg = getInstanceQuantityKg();
    const intensity = quantityKg > 0 ? totalCO2 / quantityKg : 0;

    result.value = {
      carbon: totalCO2,
      intensity,
      breakdown,
      source,
    };

    apiBreakdown.value = breakdownItems.map((item: any) => {
      const impact = Number(item?.impact ?? 0);
      const impactMin =
        item?.impactMin !== undefined ? Number(item.impactMin) : null;
      const impactMax =
        item?.impactMax !== undefined ? Number(item.impactMax) : null;
      return {
        name: String(item?.name ?? 'Unknown'),
        impact,
        percentage: totalCO2 > 0 ? (impact / totalCO2) * 100 : 0,
        source: item?.source ?? null,
        sourceUrl: item?.sourceUrl ?? null,
        warning: item?.warning ?? null,
        impactMin: Number.isFinite(impactMin as number) ? impactMin : null,
        impactMax: Number.isFinite(impactMax as number) ? impactMax : null,
      };
    });

    status.value = 'API response received';
  } else if (apiResult?.error) {
    status.value = `API error: ${apiResult.error}`;
  } else {
    status.value = 'API did not return a response';
  }
}

async function requestNonFoodApiEstimate() {
  const query = buildNonFoodQuery();
  if (!query) {
    status.value = 'Missing product info for non-food estimate';
    apiBreakdown.value = [];
    return;
  }

  const apiResult = await fetchNonFoodCarbon(query);
  if (!apiResult) {
    status.value = 'Non-food carbon API returned no data';
    apiBreakdown.value = [];
    return;
  }

  const totalCO2 = Number(apiResult.carbon_footprint ?? 0);
  const breakdownRows = buildNonFoodBreakdownRows(apiResult, totalCO2);

  apiBreakdown.value = breakdownRows;
  result.value = {
    carbon: totalCO2,
    intensity: computeIntensity(totalCO2),
    breakdown: breakdownRows.map((row) => ({
      name: row.name,
      impact: row.impact,
      percentage: row.percentage,
    })),
    source: 'ai-estimated',
  };

  status.value = 'Non-food carbon data received';
}

function buildNonFoodQuery(): string | null {
  const instance = props.pokedex?.instance as
    | Record<string, unknown>
    | undefined;
  if (!instance) return null;

  const candidates = [
    instance['title'],
    instance['brand'],
    instance['type'],
    instance['category'],
    instance['description'],
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((val) => val.length);

  if (candidates.length) {
    return candidates.join(' ');
  }

  const ids = (instance['ids'] ?? instance['iDs']) as
    | Array<{ id?: string }>
    | undefined;
  if (Array.isArray(ids) && ids[0]?.id) {
    return ids[0].id;
  }

  return null;
}

function buildNonFoodBreakdownRows(
  apiResult: NonFoodCarbonResponse,
  totalCO2: number
): ApiBreakdownRow[] {
  const details = (apiResult.details ?? {}) as Record<string, any>;
  const sourceUrl =
    typeof details.link === 'string' && details.link ? details.link : null;

  const shareEntries: Array<{ key: string; label: string }> = [
    { key: 'manufacturing_share', label: 'Manufacturing' },
    { key: 'use_phase_share', label: 'Use Phase' },
    { key: 'transport_share', label: 'Transport' },
  ];

  const rows = shareEntries
    .map(({ key, label }) => {
      const shareValueRaw = Number(details[key]);
      if (!Number.isFinite(shareValueRaw) || shareValueRaw <= 0) return null;
      const shareValue =
        shareValueRaw > 1 && shareValueRaw <= 100
          ? shareValueRaw / 100
          : shareValueRaw;
      const boundedShare = Math.min(Math.max(shareValue, 0), 1);
      if (boundedShare <= 0) return null;
      return {
        name: label,
        impact: boundedShare * totalCO2,
        percentage: boundedShare * 100,
        source: apiResult.source ?? null,
        sourceUrl,
        warning: null,
        impactMin: null,
        impactMax: null,
      };
    })
    .filter((row): row is ApiBreakdownRow => Boolean(row));

  if (!rows.length) {
    rows.push({
      name: apiResult.name ?? 'Carbon Estimate',
      impact: totalCO2,
      percentage: 100,
      source: apiResult.source ?? null,
      sourceUrl,
      warning: null,
      impactMin: null,
      impactMax: null,
    });
  }

  return rows;
}

function getInstanceQuantityKg() {
  return Number((props.pokedex?.instance as any)?.quantity ?? 0) / 1000;
}

function computeIntensity(totalCO2: number) {
  const quantityKg = getInstanceQuantityKg();
  return quantityKg > 0 ? totalCO2 / quantityKg : totalCO2;
}

onMounted(() => {
  requestApiEstimate();
});

async function enhance() {
  loading.value = true;
  status.value = 'Preparing...';
  try {
    result.value = await estimateEcoWithAI(props.pokedex, (msg) => {
      status.value = msg;
    });
  } catch (e) {
    status.value = 'Error in estimation';
    console.error(e);
  } finally {
    loading.value = false;
    status.value = '';
  }
}
</script>

<style scoped>
.fade-in {
  animation: fadeIn 0.5s;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.eco-table {
  width: 100%;
  table-layout: auto;
}

.eco-table td,
.eco-table th {
  white-space: normal;
  word-break: break-word;
}
</style>
