<template>
  <div class="flow-root" ref="rootEl" @focusout="onFocusOut">
    <div class="q-pa-md" style="flex-shrink: 0">
      <q-card flat bordered class="q-pa-md">
        <div class="row items-center justify-between">
          <div>
            <div class="text-subtitle2">Inputs</div>
            <div class="text-caption">
              {{ inputInstances.length }} inputs for {{ outputLabel }} ·
              {{ totalQuantity.toFixed(3) }} total qty
            </div>
            <div
              v-if="Object.keys(costByCurrency).length"
              class="text-caption q-mt-xs"
            >
              <div v-for="(amount, currency) in costByCurrency" :key="currency">
                Total cost: {{ amount.toFixed(2) }} {{ currency }}
              </div>
            </div>
            <div v-else class="text-caption q-mt-xs">Total cost: —</div>
          </div>
          <div class="row items-center q-gutter-sm">
            <q-btn
              flat
              color="primary"
              label="Enrich"
              :loading="isLoading"
              @click="handleEnrichClick"
            />
            <q-spinner v-if="isLoading" color="primary" size="2em" />
          </div>
        </div>
      </q-card>
    </div>

    <div class="graph-shell">
      <div class="inputs-bracket" :data-process="processLabel">
        <div
          v-for="(inp, idx) in inputInstances"
          :key="idx"
          class="node"
          :class="expandedIndex === idx ? 'node--selected' : ''"
        >
          <div class="row items-center no-wrap">
            <div class="col" style="min-width: 0">
              <div class="text-body2">{{ inputLabel(inp, idx) }}</div>
              <div class="text-caption">
                qty: {{ Number(inp?.quantity ?? 0) }}
              </div>
              <div class="text-caption">
                unit: {{ unitPriceText(inp) }} · total: {{ lineTotalText(inp) }}
              </div>
            </div>
            <div
              style="flex-shrink: 0"
              class="q-ml-md row items-center no-wrap"
            >
              <q-btn
                dense
                flat
                color="negative"
                icon="delete"
                class="q-mr-sm"
                @click="removeInput(idx)"
              />
              <q-btn
                dense
                flat
                color="primary"
                :label="expandedIndex === idx ? 'Collapse' : 'Expand'"
                @click="toggleExpand(idx)"
              />
            </div>
          </div>

          <div v-if="expandedIndex === idx" class="q-mt-md">
            <q-card flat bordered class="q-pa-md">
              <InputInstanceEditor :value="inp" />
            </q-card>
          </div>
        </div>

        <div
          v-if="missingQuantity > 0"
          class="node node--placeholder text-center cursor-pointer q-pa-md row items-center justify-center q-gutter-x-sm"
          style="
            border: 2px dashed rgba(255, 255, 255, 0.3);
            opacity: 0.8;
            border-radius: 8px;
          "
        >
          <q-icon name="add_circle" size="sm" color="warning" />
          <div class="text-warning">
            Add remaining {{ missingQuantity.toFixed(2) }}
          </div>
          <q-select
            v-model="missingCategory"
            :options="missingCategoryOptions"
            dense
            outlined
            style="min-width: 160px"
            @click.stop
          />
          <q-btn
            dense
            flat
            color="warning"
            label="Add"
            @click="addMissingInput"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type {
  InputInstance,
  Pokedex,
  Price,
  Process,
  ProductInstance,
  TokenIdOr,
} from '@trace.market/types';
import InputInstanceEditor from 'src/components/editors/InputInstanceEditor.vue';
import {
  isAiReadyForSuggestions,
  suggestInputsFromQuery,
  type SuggestionParams,
} from 'src/services/ai/AiInputSuggester';
import { fetchNonFoodDecomposition } from 'src/services/nonFoodService';
import { useSchemaStore } from 'src/stores/schemaStore';

const props = defineProps<{ modelValue: Pokedex }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: Pokedex): void;
  (e: 'open-ai-settings'): void;
}>();

const value = ref<Pokedex>(props.modelValue);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== value.value) value.value = newVal;
  }
);

watch(
  value,
  (newVal) => {
    emit('update:modelValue', newVal);
  },
  { deep: true }
);

const outputInstance = computed<ProductInstance>(() => value.value.instance);

const productCategory = computed(() => {
  const category = (outputInstance.value as any)?.category;
  return typeof category === 'string' ? category.toLowerCase() : '';
});

const isFoodProduct = computed(() => productCategory.value === 'food');

function getProcess(instance: ProductInstance): Process | undefined {
  // Only some instances (e.g. FoodInstance) carry a `process`.
  if (instance && typeof instance === 'object' && 'process' in instance) {
    return (instance as unknown as { process?: Process }).process;
  }
  return undefined;
}

function ensureProcessWithInputs(): Process | null {
  const inst = outputInstance.value as unknown as
    | { process?: Process }
    | undefined;
  if (!inst) return null;
  if (!inst.process) {
    inst.process = {
      type: (inst as any)?.type || 'process',
      category: 'process',
      name: (inst as any)?.type || 'process',
      inputInstances: [],
    } as Process;
  }
  if (!Array.isArray((inst.process as any).inputInstances)) {
    (inst.process as any).inputInstances = [];
  }
  inst.process.type = inst.process.type || 'process';
  (inst.process as any).category = (inst.process as any).category || 'process';
  (inst.process as any).name = (inst.process as any).name || inst.process.type;
  return inst.process as Process;
}

const process = computed<Process | undefined>(() =>
  getProcess(outputInstance.value)
);
const inputInstances = computed<InputInstance[]>(
  () => process.value?.inputInstances ?? []
);

const processLabel = computed(() => process.value?.type ?? 'process');
const outputLabel = computed(
  () => outputInstance.value?.title ?? outputInstance.value?.type ?? 'output'
);

const rootEl = ref<HTMLElement | null>(null);
const expandedIndex = ref<number | null>(null);
const aiReady = ref(false);
const suggesting = ref(false);
const lastQuery = ref<string | null>(null);
const suppressedTypes = ref<Set<string>>(new Set());
const dirtySinceBlur = ref(false);
const isLoading = computed(() => suggesting.value);
const schemaStore = useSchemaStore();

const missingCategory = ref('food');
const missingCategoryOptions = computed(() => {
  const desc = schemaStore.getFieldDescription('ProductInstance', 'category');
  const examples = desc?.examples?.length
    ? desc.examples.filter((item) => item !== 'cartridge')
    : ['food', 'non-food'];
  return examples.length ? examples : ['food', 'non-food'];
});

function logSuggest(message: string, extra?: unknown) {
  // Browser console visibility for AI suggestion flow
  // eslint-disable-next-line no-console
  console.log('[InputsFlow][AI]', message, extra ?? '');
}

async function handleEnrichClick() {
  if (suggesting.value) return;
  if (!aiReady.value) {
    emit('open-ai-settings');
    return;
  }
  await maybeSuggest();
}

function refreshAiReady() {
  aiReady.value = isAiReadyForSuggestions();
  logSuggest('AI ready state changed', { aiReady: aiReady.value });
}

function buildSuggestParams(): SuggestionParams | null {
  const out = outputInstance.value as ProductInstance | undefined;
  if (!out) return null;

  const ids = (out as any)?.ids ?? (out as any)?.iDs;
  const normalizedIds = Array.isArray(ids) ? ids : undefined;
  const ownerId = (out as any)?.ownerId;
  const size = (out as any)?.size;
  const format = (out as any)?.format;
  const quantity = Number((out as any)?.quantity);

  const params: SuggestionParams = {
    title: (out as any)?.title,
    brand: (out as any)?.brand || ownerId,
    category: (out as any)?.category,
    type: out?.type,
    quantity: Number.isFinite(quantity) ? quantity : undefined,
    size: typeof size === 'string' ? size : undefined,
    format: typeof format === 'string' ? format : undefined,
    ownerId: typeof ownerId === 'string' ? ownerId : undefined,
    ids: normalizedIds,
  };

  // Build a stable query fall-back so the server has something to search with
  params.query =
    (params.title && String(params.title).trim()) ||
    (params.type && String(params.type).trim()) ||
    (params.category && String(params.category).trim()) ||
    (params.brand && String(params.brand).trim()) ||
    (normalizedIds && normalizedIds[0]?.id);

  if (!params.query) return null;
  return params;
}

function normalizeType(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function maybeSuggest() {
  const params = buildSuggestParams();
  if (!params || !params.query) {
    logSuggest('Skip suggest: need at least a title/type/category/url');
    return;
  }

  const useNonFoodApi = !isFoodProduct.value;

  if (!useNonFoodApi && !aiReady.value) {
    logSuggest('AI not ready — trying fallback');
  }
  if (suggesting.value) {
    logSuggest('Skip suggest: already running');
    return;
  }

  const queryKey = JSON.stringify({ params, useNonFoodApi });
  if (queryKey === lastQuery.value) {
    logSuggest('Skip suggest: same params as last time', params);
    return;
  }

  suggesting.value = true;
  try {
    let handled = false;
    if (useNonFoodApi) {
      handled = await requestNonFoodDecomposition(params.query);
    } else {
      if (aiReady.value) {
        handled = await requestFoodSuggestions(params);
      }
      if (!handled) {
        handled = await requestNonFoodDecomposition(params.query);
      }
    }

    if (handled) {
      lastQuery.value = queryKey;
    } else {
      lastQuery.value = null;
    }
  } finally {
    suggesting.value = false;
  }
}

async function requestFoodSuggestions(params: SuggestionParams) {
  logSuggest('Suggesting with params', params);
  const suggestions = await suggestInputsFromQuery(params);
  logSuggest('Suggestions returned', { count: suggestions.length });
  const targetProcess = ensureProcessWithInputs();
  if (!targetProcess?.inputInstances || !suggestions.length) return false;

  const flattened: InputInstance[] = [];
  let processMeta: Process | undefined;

  for (const suggestion of suggestions) {
    const inst = suggestion?.instance as any;
    const nestedInputs: InputInstance[] | undefined =
      inst?.process?.inputInstances;
    if (!processMeta && inst?.process) {
      processMeta = inst.process as Process;
    }
    if (Array.isArray(nestedInputs) && nestedInputs.length) {
      flattened.push(...nestedInputs);
    } else {
      flattened.push(suggestion);
    }
  }

  if (processMeta) {
    targetProcess.type = processMeta.type ?? targetProcess.type ?? 'process';
    (targetProcess as any).category =
      (processMeta as any)?.category ?? (targetProcess as any)?.category;
    (targetProcess as any).name =
      (processMeta as any)?.name ?? (targetProcess as any)?.name;
  }

  let added = false;
  for (const suggestion of flattened) {
    const sugInst = suggestion?.instance;
    if (isTokenIdOrObject<ProductInstance>(sugInst)) {
      const rawType = sugInst.type ?? sugInst.title;
      const norm = normalizeType(rawType);
      if (norm && suppressedTypes.value.has(norm)) {
        logSuggest('Skip suggestion (suppressed type)', rawType);
        continue;
      }
      if (norm) {
        sugInst.type = rawType ? rawType.toLowerCase() : norm;
      }
      const exists = targetProcess.inputInstances.some((inp) => {
        const inst = inp?.instance;
        if (!isTokenIdOrObject<ProductInstance>(inst)) return false;
        return normalizeType(inst.type ?? inst.title) === norm;
      });
      if (exists) {
        logSuggest('Skip suggestion (duplicate type)', rawType);
        continue;
      }
      if (norm) suppressedTypes.value.add(norm);
    }
    logSuggest(
      'Adding suggestion',
      (suggestion as any)?.instance?.type || (suggestion as any)?.type
    );
    targetProcess.inputInstances.push(suggestion);
    added = true;
  }

  return added;
}

function buildNonFoodPayload(
  baseQuery?: string | null
): Record<string, unknown> | null {
  const instance = outputInstance.value as Record<string, any> | undefined;
  const payload: Record<string, unknown> = {};

  const addStringField = (key: string, value: unknown) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) payload[key] = trimmed;
    }
  };

  if (instance) {
    addStringField('title', instance.title ?? instance.name);
    addStringField('brand', instance.brand);
    addStringField('category', instance.category);
    addStringField('type', instance.type);
    addStringField('description', instance.description);
    addStringField('format', instance.format);
    addStringField('size', instance.size);
    addStringField('ownerId', instance.ownerId);
    addStringField('packaging', instance.packaging);

    const quantity = Number(instance.quantity);
    if (Number.isFinite(quantity)) {
      payload.quantity = quantity;
    }

    const ids = instance.ids ?? instance.iDs;
    if (Array.isArray(ids) && ids.length) {
      payload.ids = ids;
    }
  }

  const primaryQuery =
    typeof baseQuery === 'string' && baseQuery.trim().length
      ? baseQuery.trim()
      : '';

  const fallbackQuery =
    (payload.title as string) ??
    (payload.type as string) ??
    (payload.category as string) ??
    (payload.brand as string) ??
    (payload.description as string);

  const idsQuery = Array.isArray(payload.ids)
    ? (payload.ids as Array<{ id?: string }>).find(
        (item) => typeof item?.id === 'string' && item.id.trim().length
      )?.id
    : undefined;

  const query = primaryQuery || fallbackQuery || idsQuery;
  if (!query) {
    return null;
  }

  return {
    ...payload,
    query,
  };
}

async function requestNonFoodDecomposition(baseQuery: string) {
  const payload = buildNonFoodPayload(baseQuery);
  if (!payload) {
    logSuggest('Non-food payload missing query context');
    return false;
  }

  logSuggest('Requesting non-food decomposition', payload);
  const response = await fetchNonFoodDecomposition(payload);
  if (!response?.process?.inputInstances?.length) {
    logSuggest('Non-food decomposition did not return inputs');
    return false;
  }

  const targetProcess = ensureProcessWithInputs();
  if (!targetProcess?.inputInstances) return false;

  const normalized = response.process.inputInstances.map((raw, idx) =>
    normalizeNonFoodInput(raw, idx)
  );

  targetProcess.inputInstances.splice(
    0,
    targetProcess.inputInstances.length,
    ...normalized
  );

  targetProcess.type =
    response.process?.type ?? targetProcess.type ?? 'process';
  (targetProcess as any).name =
    response.process?.name ?? (targetProcess as any)?.name ?? 'process';
  (targetProcess as any).category =
    response.category ?? (targetProcess as any)?.category ?? 'process';

  suppressedTypes.value.clear();
  for (const inp of normalized) {
    const inst = inp.instance;
    if (isTokenIdOrObject<ProductInstance>(inst)) {
      const norm = normalizeType(inst.type ?? inst.title);
      if (norm) suppressedTypes.value.add(norm);
    }
  }

  logSuggest('Non-food decomposition applied', {
    count: normalized.length,
  });

  return normalized.length > 0;
}

function normalizeNonFoodInput(
  raw: { quantity?: number; priceShare?: number; instance?: any },
  idx: number
): InputInstance {
  const rawInstance = (raw?.instance ?? {}) as Record<string, any>;
  const fallbackName = `Component ${idx + 1}`;
  const nameSource = rawInstance.name ?? rawInstance.type ?? fallbackName;
  const title =
    typeof nameSource === 'string' && nameSource.trim().length
      ? nameSource
      : fallbackName;
  const typeValue =
    typeof rawInstance.type === 'string' && rawInstance.type.trim().length
      ? rawInstance.type
      : title || fallbackName;

  const normalizedInstance: ProductInstance = {
    ...(rawInstance as ProductInstance),
    title,
    type: typeValue,
    category:
      typeof rawInstance.category === 'string' &&
      rawInstance.category.trim().length
        ? rawInstance.category
        : 'component',
    quantity: Number(rawInstance.quantity ?? 0),
  } as ProductInstance;

  return {
    // Always treat as local so editor renders full form
    type: 'local',
    quantity: Number(raw?.quantity ?? 0),
    priceShare: Number(raw?.priceShare ?? 0),
    instance: normalizedInstance,
  } as InputInstance;
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  const root = rootEl.value;
  if (root && next && root.contains(next)) {
    return;
  }
  if (!dirtySinceBlur.value) return;
  dirtySinceBlur.value = false;
}

function toggleExpand(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index;
}

function removeInput(idx: number) {
  if (process.value?.inputInstances) {
    const removed = process.value.inputInstances[idx];
    const inst = removed?.instance;
    if (isTokenIdOrObject<ProductInstance>(inst)) {
      const norm = normalizeType(inst.type ?? inst.title);
      if (norm) suppressedTypes.value.add(norm);
    }
    process.value.inputInstances.splice(idx, 1);
  }
}

function isTokenIdOrObject<T extends object>(value: TokenIdOr<T>): value is T {
  return (
    typeof value === 'object' && value !== null && !('errorMessage' in value)
  );
}

function isPrice(value: unknown): value is Price {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'amount' in value &&
      'currency' in value &&
      'type' in value
  );
}

function inputLabel(inp: InputInstance | null | undefined, idx: number) {
  if (!inp) return `#${idx + 1}`;
  const inst = inp.instance;
  if (!isTokenIdOrObject<ProductInstance>(inst)) return `#${idx + 1} (token)`;
  return inst.title ?? inst.type ?? `#${idx + 1}`;
}

function unitPriceText(inp: InputInstance | null | undefined) {
  if (!inp) return '—';
  const inst = inp.instance;
  const price = isTokenIdOrObject<ProductInstance>(inst)
    ? inst.price
    : undefined;
  if (!price) return '—';
  const amount = Number(price.amount ?? 0);
  const currency = String(price.currency ?? '');
  return currency ? `${amount} ${currency}` : String(amount);
}

function lineTotalText(inp: InputInstance | null) {
  if (!inp) return '—';
  const qty = Number(inp.quantity ?? 0);
  const inst = inp.instance;
  const price = isTokenIdOrObject<ProductInstance>(inst)
    ? inst.price
    : undefined;
  if (!price || !isPrice(price)) return '—';
  const amount = Number(price.amount ?? 0);
  const currency = String(price.currency ?? '');
  const total = qty * amount;
  return currency ? `${total} ${currency}` : String(total);
}

const totalQuantity = computed(() =>
  inputInstances.value.reduce((sum, inp) => sum + Number(inp?.quantity ?? 0), 0)
);

const outputQuantity = computed(() =>
  Number((outputInstance.value as any)?.quantity ?? 0)
);

const missingQuantity = computed(() => {
  const diff = outputQuantity.value - totalQuantity.value;
  return diff > 0.000001 ? diff : 0;
});

function addMissingInput() {
  const proc = ensureProcessWithInputs();
  if (!proc) return;
  const qty = missingQuantity.value;
  const category = missingCategory.value || 'food';

  proc.inputInstances.push({
    type: 'local',
    quantity: qty,
    priceShare: 0,
    instance: {
      category,
      type: 'New Ingredient',
      quantity: 1000,
    } as any,
  } as InputInstance);

  // Expand the new item
  requestAnimationFrame(() => {
    expandedIndex.value = proc.inputInstances.length - 1;
  });
}

const costByCurrency = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  for (const inp of inputInstances.value) {
    const qty = Number(inp.quantity ?? 0);
    const inst = inp.instance;
    const price = isTokenIdOrObject<ProductInstance>(inst)
      ? inst.price
      : undefined;
    if (!price || !isPrice(price)) continue;
    const amount = Number(price.amount ?? 0);
    const currency = String(price.currency ?? '') || 'UNKNOWN';
    totals[currency] = (totals[currency] ?? 0) + qty * amount;
  }
  return totals;
});

watch(
  () => inputInstances.value.length,
  () => {
    if (expandedIndex.value !== null) {
      const nextIndex = Math.min(
        expandedIndex.value,
        Math.max(0, inputInstances.value.length - 1)
      );
      expandedIndex.value = inputInstances.value.length ? nextIndex : null;
    }
  }
);

watch(
  inputInstances,
  () => {
    dirtySinceBlur.value = true;
  },
  { deep: true }
);

onMounted(() => {
  refreshAiReady();
  window.addEventListener('ai-config-updated', refreshAiReady);
});

watch(
  () => outputInstance.value,
  () => {
    dirtySinceBlur.value = true;
  },
  { deep: true }
);

onUnmounted(() => {
  window.removeEventListener('ai-config-updated', refreshAiReady);
});
</script>

<style scoped>
.flow-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.graph-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.inputs-bracket {
  position: relative;
  padding-left: 46px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inputs-bracket::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 4px;
  bottom: 4px;
  width: 12px;
  border-left: 2px solid rgba(255, 255, 255, 0.22);
  border-top: 2px solid rgba(255, 255, 255, 0.22);
  border-bottom: 2px solid rgba(255, 255, 255, 0.22);
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
}

.inputs-bracket::after {
  content: attr(data-process);
  position: absolute;
  left: 0px;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.55);
  user-select: none;
  pointer-events: none;
}

.node {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  background: rgba(20, 20, 20, 0.7);
  cursor: pointer;
}

.node--selected {
  border-color: rgba(100, 181, 246, 0.9);
  box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.2);
}
</style>
