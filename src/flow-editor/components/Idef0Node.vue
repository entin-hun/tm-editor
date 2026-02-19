<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import type { AbstractNode, NodeInterface } from "@baklavajs/core";
import { Components } from "@baklavajs/renderer-vue";
import type { GenericProcess } from "@trace.market/types";

type Location = "left" | "right" | "top" | "bottom";

type PortMeta = {
  location?: Location;
};

const props = defineProps<{
  node: AbstractNode;
  onAddInput?: () => void;
  onAddOutput?: () => void;
  onAddMechanism?: () => void;
  onDelete?: () => void;
}>();

const titleDraft = ref("");
const readTitle = () => (props.node as AbstractNode & { title?: string }).title ?? "";
const syncTitle = () => {
  (props.node as AbstractNode & { title?: string }).title = titleDraft.value.trim();
};

watch(
  () => readTitle(),
  (next) => {
    titleDraft.value = next;
  },
  { immediate: true }
);

const detailsDraft = ref("");
const readDetails = () => (props.node as AbstractNode & { details?: string }).details ?? "";
const syncDetails = () => {
  (props.node as AbstractNode & { details?: string }).details = detailsDraft.value;
};

watch(
  () => readDetails(),
  (next) => {
    detailsDraft.value = next;
  },
  { immediate: true }
);

const readLocation = (intf: NodeInterface<unknown>) =>
  (intf as NodeInterface<unknown> & { data?: PortMeta }).data?.location;

const leftInputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.inputs).filter((intf) => readLocation(intf) === "left") as NodeInterface<unknown>[]
);
const topOutputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.outputs).filter((intf) => readLocation(intf) === "top") as NodeInterface<unknown>[]
);
const topInputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.inputs).filter((intf) => readLocation(intf) === "top") as NodeInterface<unknown>[]
);
const rightOutputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.outputs).filter((intf) => readLocation(intf) === "right") as NodeInterface<unknown>[]
);
const bottomInputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.inputs).filter((intf) => readLocation(intf) === "bottom") as NodeInterface<unknown>[]
);
const rightInputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.inputs).filter((intf) => readLocation(intf) === "right") as NodeInterface<unknown>[]
);
const leftOutputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.outputs).filter((intf) => readLocation(intf) === "left") as NodeInterface<unknown>[]
);
const bottomOutputPorts = computed<NodeInterface<unknown>[]>(() =>
  Object.values(props.node.outputs).filter((intf) => readLocation(intf) === "bottom") as NodeInterface<unknown>[]
);

type ProcessWithName = GenericProcess & { name?: string | string[]; price?: { amount?: number; currency?: string; type?: string } };
const processData = computed(() => (props.node as AbstractNode & { process?: ProcessWithName }).process);

/* ── label chip selector (mirrors GenericProcessEditor q-select) ── */
const BASE_LABEL_OPTIONS = [
  "plant-based", "organic", "fair-trade", "cruelty-free", "non-GMO",
  "plastic-free", "zero-waste", "renewable-energy", "recyclable",
  "biodegradable", "compostable", "upcycled", "regenerative",
  "durable", "washable", "repairable", "energy-efficient",
  "water-efficient", "BPA-free", "lead-free", "phthalate-free",
  "pesticide-free", "hormone-free", "antibiotic-free",
  "FSC-certified", "rainforest-alliance", "eu-ecolabel",
  "clinically-proven", "hypoallergenic", "dermatologically-tested",
];
const allLabelOptions = ref<string[]>([...BASE_LABEL_OPTIONS]);

const processLabels = computed<string[]>({
  get() {
    const name = processData.value?.name;
    if (Array.isArray(name)) return name.filter(Boolean);
    if (typeof name === "string") {
      return name.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  },
  set(labels: string[]) {
    const process = processData.value;
    if (!process) return;
    process.name = labels.length > 0 ? labels.join(", ") : undefined;
    syncProcess();
  },
});

const labelSearch = ref("");
const showLabelDropdown = ref(false);
const filteredLabelOptions = computed(() => {
  const current = new Set(processLabels.value);
  const q = labelSearch.value.toLowerCase();
  return allLabelOptions.value.filter(
    (opt) => !current.has(opt) && (!q || opt.toLowerCase().includes(q))
  );
});

const addLabel = (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) return;
  if (!allLabelOptions.value.includes(trimmed)) {
    allLabelOptions.value.push(trimmed);
  }
  const next = [...processLabels.value];
  if (!next.includes(trimmed)) next.push(trimmed);
  processLabels.value = next;
  labelSearch.value = "";
};

const removeLabel = (label: string) => {
  processLabels.value = processLabels.value.filter((l) => l !== label);
};

const addLabelFromInput = () => {
  const trimmed = labelSearch.value.trim();
  if (trimmed) addLabel(trimmed);
  showLabelDropdown.value = false;
};

const closeLabelDropdown = () => {
  globalThis.setTimeout(() => { showLabelDropdown.value = false; }, 150);
};

/* ── price ── */
const priceDraft = ref("");
const currencyDraft = ref("EUR");

watch(
  processData,
  (next) => {
    const price = (next as any)?.price;
    priceDraft.value = price?.amount != null ? String(price.amount) : "";
    currencyDraft.value = price?.currency || "EUR";
  },
  { immediate: true, deep: true }
);

const syncPrice = () => {
  const process = processData.value;
  if (!process) return;
  const amount = Number(priceDraft.value);
  (process as any).price = {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: currencyDraft.value || "EUR",
    type: "budget",
  };
  syncProcess();
};

/* ── site (inline, mirrors SiteEditor) ── */
const siteDraft = ref("");

watch(
  processData,
  (next) => {
    const site = (next as any)?.site;
    siteDraft.value = typeof site === "string" ? site : (site?.name || site?.hash || "");
  },
  { immediate: true, deep: true }
);

const syncSite = () => {
  const process = processData.value;
  if (!process) return;
  const trimmed = siteDraft.value.trim();
  (process as any).site = trimmed ? { name: trimmed, hash: trimmed } : undefined;
  syncProcess();
};

const syncProcess = () => {
  const process = processData.value;
  if (!process) return;
  const node = props.node as AbstractNode & { onProcessUpdate?: (next: ProcessWithName) => void };
  node.onProcessUpdate?.(process);
};

const toDatetimeLocalValue = (timestamp?: number) => {
  if (!timestamp || Number.isNaN(timestamp)) return "";
  const date = new Date(timestamp);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDatetimeLocalValue = (value: string) => {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const timestampDraft = ref("");
watch(
  processData,
  (next) => {
    timestampDraft.value = toDatetimeLocalValue(next?.timestamp as number | undefined);
  },
  { immediate: true, deep: true }
);

const syncTimestamp = () => {
  const process = processData.value;
  if (!process) return;
  process.timestamp = fromDatetimeLocalValue(timestampDraft.value) as any;
  syncProcess();
};

const syncTemperatureMin = (event: Event) => {
  const process = processData.value;
  if (!process) return;
  process.temperatureRange = process.temperatureRange || { min: 0, max: 100 };
  process.temperatureRange.min = Number((event.target as HTMLInputElement).value || 0);
  syncProcess();
};

const syncTemperatureMax = (event: Event) => {
  const process = processData.value;
  if (!process) return;
  process.temperatureRange = process.temperatureRange || { min: 0, max: 100 };
  process.temperatureRange.max = Number((event.target as HTMLInputElement).value || 0);
  syncProcess();
};

const syncDuration = (event: Event) => {
  const process = processData.value;
  if (!process) return;
  process.duration = Number((event.target as HTMLInputElement).value || 0) as any;
  syncProcess();
};

const getPortStyle = (side: Location): CSSProperties => {
  if (side === "left") {
    return {
      position: "absolute",
      left: "0%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  if (side === "right") {
    return {
      position: "absolute",
      left: "100%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  if (side === "top") {
    return {
      position: "absolute",
      left: "50%",
      top: "0%",
      transform: "translate(-50%, -50%)",
    };
  }

  return {
    position: "absolute",
    left: "50%",
    top: "100%",
    transform: "translate(-50%, -50%)",
  };
};

const getAddButtonStyle = (side: Location): CSSProperties => {
  const base = getPortStyle(side);
  if (side === "left") {
    return { ...base, left: "-12px" };
  }
  if (side === "right") {
    return { ...base, left: "calc(100% + 12px)" };
  }
  if (side === "top") {
    return { ...base, top: "-12px" };
  }
  return { ...base, top: "calc(100% + 12px)" };
};

const NodeInterfaceView = Components.NodeInterface;
</script>

<template>
  <div class="idef0-node">
    <NodeInterfaceView
      v-for="intf in topInputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('top')"
    />

    <NodeInterfaceView
      v-for="intf in topOutputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('top')"
    />

    <NodeInterfaceView
      v-for="intf in leftInputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('left')"
    />

    <NodeInterfaceView
      v-for="intf in leftOutputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('left')"
    />
    <button
      v-if="props.onAddInput"
      class="add-port-btn"
      type="button"
      title="Add input"
      :style="getAddButtonStyle('left')"
      @click.stop="props.onAddInput?.()"
    >
      +
    </button>

    <NodeInterfaceView
      v-for="intf in rightOutputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('right')"
    />

    <NodeInterfaceView
      v-for="intf in rightInputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('right')"
    />
    <button
      v-if="props.onAddOutput"
      class="add-port-btn"
      type="button"
      title="Add output"
      :style="getAddButtonStyle('right')"
      @click.stop="props.onAddOutput?.()"
    >
      +
    </button>

    <div class="node-content">
      <div class="title-row">
        <input
          v-model="titleDraft"
          class="title-input"
          type="text"
          @input="syncTitle"
          @blur="syncTitle"
        />
        <button v-if="props.onDelete" class="delete-btn" type="button" title="Delete" @click.stop="props.onDelete?.()">
          ×
        </button>
      </div>
      <div class="details-row">
        <div v-if="processData" class="process-fields">
          <label class="process-field">
            <span class="process-field-label">labels</span>
            <div class="label-chips-area">
              <span
                v-for="label in processLabels"
                :key="label"
                class="label-chip"
              >
                {{ label }}
                <button type="button" class="chip-remove" @click.stop="removeLabel(label)">&times;</button>
              </span>
              <div class="label-input-wrap">
                <input
                  v-model="labelSearch"
                  class="label-search-input"
                  type="text"
                  placeholder="add label…"
                  @focus="showLabelDropdown = true"
                  @blur="closeLabelDropdown"
                  @keydown.enter.prevent="addLabelFromInput"
                />
                <div v-if="showLabelDropdown && filteredLabelOptions.length > 0" class="label-dropdown">
                  <div
                    v-for="opt in filteredLabelOptions.slice(0, 10)"
                    :key="opt"
                    class="label-dropdown-item"
                    @pointerdown.prevent="addLabel(opt)"
                  >
                    {{ opt }}
                  </div>
                </div>
              </div>
            </div>
          </label>

          <label class="process-field">
            <span class="process-field-label">site</span>
            <input
              v-model="siteDraft"
              class="process-field-input"
              type="text"
              placeholder="site name / hash"
              @blur="syncSite"
            />
          </label>

          <label class="process-field process-field-inline">
            <span class="process-field-label">temperature range</span>
            <div class="temp-pair">
              <input
                :value="processData.temperatureRange?.min ?? ''"
                class="process-field-input"
                type="number"
                @input="syncTemperatureMin"
              />
              <input
                :value="processData.temperatureRange?.max ?? ''"
                class="process-field-input"
                type="number"
                @input="syncTemperatureMax"
              />
            </div>
          </label>

          <label class="process-field">
            <span class="process-field-label">timestamp</span>
            <input
              v-model="timestampDraft"
              class="process-field-input"
              type="datetime-local"
              @change="syncTimestamp"
              @blur="syncTimestamp"
            />
          </label>

          <label class="process-field">
            <span class="process-field-label">duration</span>
            <input
              :value="processData.duration ?? ''"
              class="process-field-input"
              type="number"
              @input="syncDuration"
            />
          </label>

          <label class="process-field process-field-inline">
            <span class="process-field-label">price</span>
            <div class="price-pair">
              <input
                v-model="priceDraft"
                class="process-field-input"
                type="number"
                placeholder="0"
                @blur="syncPrice"
              />
              <select v-model="currencyDraft" class="process-field-input" @change="syncPrice">
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
                <option>HUF</option>
                <option>CHF</option>
              </select>
            </div>
          </label>
        </div>

        <textarea
          v-model="detailsDraft"
          class="details-input"
          placeholder="details / notes"
          @blur="syncDetails"
        />
      </div>
    </div>

    <NodeInterfaceView
      v-for="intf in bottomInputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('bottom')"
    />

    <NodeInterfaceView
      v-for="intf in bottomOutputPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('bottom')"
    />
    <button
      v-if="props.onAddMechanism"
      class="add-port-btn"
      type="button"
      title="Add mechanism"
      :style="getAddButtonStyle('bottom')"
      @click.stop="props.onAddMechanism?.()"
    >
      +
    </button>

  </div>
</template>

<style scoped>
.idef0-node {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 440px;
  max-width: 440px;
  padding: 10px;
  background: #2a2a2a;
  border: 2px solid #4fc3f7;
  border-radius: 6px;
  position: relative;
}

.idef0-node.selected {
  border-color: #111;
}

.port-area {
  display: flex;
  gap: 6px;
  padding: 6px;
  min-height: 28px;
}

.port-area.top {
  grid-area: top;
  justify-content: center;
  flex-wrap: wrap;
  border-bottom: 1px solid #000;
}

.port-area.bottom {
  grid-area: bottom;
  justify-content: center;
  flex-wrap: wrap;
  border-top: 1px solid #000;
}

.idef0-node :deep(.baklava-node-interface) {
  width: 12px;
  height: 12px;
  padding: 0;
  margin: 0;
  line-height: 0;
  font-size: 0;
}

.idef0-node :deep(.baklava-node-interface > span) {
  display: none;
}

.add-port-btn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #4fc3f7;
  background: #101418;
  color: #fff;
  font-size: 12px;
  line-height: 14px;
  padding: 0;
  cursor: pointer;
}

@media (max-width: 768px) {
  .add-port-btn {
    width: 20px;
    height: 20px;
    font-size: 14px;
    line-height: 18px;
  }

  .title-input {
    font-size: 13px;
    padding: 6px 8px;
  }

  .details-input {
    min-height: 140px;
    font-size: 12px;
  }
}

.port-area.left,
.port-area.right {
  flex-direction: column;
  justify-content: center;
}

.port-area.left {
  grid-area: left;
  border-right: 1px solid #000;
}

.port-area.right {
  grid-area: right;
  border-left: 1px solid #000;
}

.node-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  user-select: none;
  padding: 4px;
  cursor: move;
  width: 100%;
  min-height: 160px;
}

.node-content:active {
  cursor: grabbing;
}

.port-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1.2;
}

.port-wrapper.horizontal {
  flex-direction: row;
}

.label {
  color: #111;
  white-space: nowrap;
}

.title-row {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.title-input {
  width: 100%;
  border: 1px solid #4fc3f7;
  background: #101418;
  color: #fff;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  padding: 4px 6px;
  text-align: center;
}

.delete-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid #4fc3f7;
  background: #101418;
  color: #fff;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.delete-btn:hover {
  background: #1b2a33;
}

.details-row {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  flex: 1;
}

.process-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.process-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
}

.process-field-inline {
  gap: 6px;
}

.process-field-label {
  font-size: 11px;
  color: #9eb1bc;
}

.temp-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.price-pair {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

/* ── label chip selector ── */
.label-chips-area {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  background: #101418;
  border: 1px solid #4fc3f7;
  border-radius: 4px;
  padding: 4px 6px;
  min-height: 30px;
  align-items: center;
}

.label-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #263238;
  color: #b2ebf2;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 12px;
  white-space: nowrap;
}

.chip-remove {
  background: none;
  border: none;
  color: #b2ebf2;
  font-size: 12px;
  cursor: pointer;
  padding: 0 0 0 2px;
  line-height: 1;
}

.label-input-wrap {
  position: relative;
  flex: 1;
  min-width: 60px;
}

.label-search-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 11px;
  padding: 2px 0;
}

.label-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1b2027;
  border: 1px solid #4fc3f7;
  border-radius: 4px;
  max-height: 160px;
  overflow-y: auto;
  z-index: 100;
  margin-top: 2px;
}

.label-dropdown-item {
  padding: 4px 8px;
  font-size: 11px;
  color: #fff;
  cursor: pointer;
}

.label-dropdown-item:hover {
  background: #263238;
}

.process-field-input {
  width: 100%;
  background: #101418;
  border: 1px solid #4fc3f7;
  color: #fff;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 4px;
}

.details-input {
  background: #101418;
  border: 1px solid #4fc3f7;
  color: #fff;
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 4px;
  width: 100%;
  min-height: 120px;
  flex: 1;
  outline: none;
  resize: vertical;
}

:deep(.__port) {
  transform: scale(0.95);
}
</style>
