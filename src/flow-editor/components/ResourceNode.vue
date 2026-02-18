<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { Components } from "@baklavajs/renderer-vue";
import type { AbstractNode, NodeInterface } from "@baklavajs/core";
import type { InputInstance, ProductInstance } from "@trace.market/types";
import InputInstanceEditor from "../../components/editors/InputInstanceEditor.vue";
import ProductInstanceEditor from "../../components/editors/ProductInstanceEditor.vue";
import MachineInstanceEditor from "../../components/editors/MachineInstanceEditor.vue";

type Location = "left" | "right" | "top" | "bottom";
type PortMeta = {
  location?: Location;
};

const props = defineProps<{
  node: AbstractNode;
  onDelete?: () => void;
  onOutputConnector?: (intf: NodeInterface<unknown>) => void;
}>();

type ResourceFields = {
  origin?: string;
  inputQuantity?: number;
  details?: string;
  outputKg?: number;
  destination?: string;
  quantity?: number;
  duration?: string;
  parameters?: string;
};

const readFields = () => (props.node as AbstractNode & { fields?: ResourceFields }).fields ?? {};
const readResourceType = () => (props.node as AbstractNode & { resourceType?: string }).resourceType ?? "";
const readTitle = () => (props.node as AbstractNode & { title?: string }).title ?? "";

const inputInstance = computed(() => (props.node as AbstractNode & { inputInstance?: InputInstance }).inputInstance);
const machineInstance = computed(
  () => (props.node as AbstractNode & { machineInstance?: unknown }).machineInstance
);
type PricedProduct = ProductInstance & { price?: unknown };
const outputInstance = computed(
  () => (props.node as AbstractNode & { outputInstance?: ProductInstance | PricedProduct }).outputInstance
);

const applyInputInstance = (next: InputInstance) => {
  const node = props.node as AbstractNode & { inputInstance?: InputInstance; onInputUpdate?: (input: InputInstance) => void };
  node.inputInstance = next;
  node.onInputUpdate?.(next);
};

const applyMachineInstance = (next: unknown) => {
  const node = props.node as AbstractNode & { machineInstance?: unknown; onMachineUpdate?: (machine: unknown) => void };
  node.machineInstance = next;
  node.onMachineUpdate?.(next);
};

const applyOutputInstance = (next: ProductInstance | PricedProduct) => {
  const node = props.node as AbstractNode & {
    outputInstance?: ProductInstance | PricedProduct;
    onOutputUpdate?: (output: ProductInstance | PricedProduct) => void;
  };
  node.outputInstance = next;
  node.onOutputUpdate?.(next);
};

const titleDraft = ref(readTitle());
const syncTitle = () => {
  (props.node as AbstractNode & { title?: string }).title = titleDraft.value.trim();
};

watch(
  () => readTitle(),
  (next) => {
    if (next !== titleDraft.value) {
      titleDraft.value = next;
    }
  }
);

const editingOrigin = ref(false);
const originDraft = ref("");
const startEditOrigin = () => {
  originDraft.value = readFields().origin ?? "";
  editingOrigin.value = true;
};
const saveOrigin = () => {
  const fields = readFields();
  fields.origin = originDraft.value.trim();
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  editingOrigin.value = false;
};

const editingOutputKg = ref(false);
const outputKgDraft = ref("1");
const startEditOutputKg = () => {
  const current = readFields().outputKg;
  outputKgDraft.value = current === undefined || Number.isNaN(current) ? "1" : String(current);
  editingOutputKg.value = true;
};
const saveOutputKg = () => {
  const parsed = Number(outputKgDraft.value);
  const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const fields = readFields();
  fields.outputKg = safeValue;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  outputKgDraft.value = String(safeValue);
  editingOutputKg.value = false;
};

const editingDestination = ref(false);
const destinationDraft = ref("");
const startEditDestination = () => {
  destinationDraft.value = readFields().destination ?? "";
  editingDestination.value = true;
};
const saveDestination = () => {
  const fields = readFields();
  fields.destination = destinationDraft.value.trim();
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  editingDestination.value = false;
};

const editingInputQuantity = ref(false);
const inputQuantityDraft = ref("0");
const startEditInputQuantity = () => {
  const current = readFields().inputQuantity;
  inputQuantityDraft.value = current === undefined || Number.isNaN(current) ? "0" : String(current);
  editingInputQuantity.value = true;
};
const saveInputQuantity = () => {
  const parsed = Number(inputQuantityDraft.value);
  const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const fields = readFields();
  fields.inputQuantity = safeValue;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  inputQuantityDraft.value = String(safeValue);
  editingInputQuantity.value = false;
};

const detailsDraft = ref("");
const syncDetails = () => {
  const fields = readFields();
  fields.details = detailsDraft.value;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
};

watch(
  () => readFields().details,
  (next) => {
    detailsDraft.value = next ?? "";
  },
  { immediate: true }
);

const editingQuantity = ref(false);
const quantityDraft = ref("0");
const startEditQuantity = () => {
  const current = readFields().quantity;
  quantityDraft.value = current === undefined || Number.isNaN(current) ? "0" : String(current);
  editingQuantity.value = true;
};
const saveQuantity = () => {
  const parsed = Number(quantityDraft.value);
  const safeValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const fields = readFields();
  fields.quantity = safeValue;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  quantityDraft.value = String(safeValue);
  editingQuantity.value = false;
};

const editingDuration = ref(false);
const durationDraft = ref("");
const startEditDuration = () => {
  durationDraft.value = readFields().duration ?? "";
  editingDuration.value = true;
};
const saveDuration = () => {
  const fields = readFields();
  fields.duration = durationDraft.value.trim();
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  editingDuration.value = false;
};

const parametersDraft = ref("");
const syncParameters = () => {
  const fields = readFields();
  fields.parameters = parametersDraft.value;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
};

watch(
  () => readFields().parameters,
  (next) => {
    parametersDraft.value = next ?? "";
  },
  { immediate: true }
);

const readLocation = (intf: NodeInterface<unknown>) =>
  (intf as NodeInterface<unknown> & { data?: PortMeta }).data?.location;

/** Detect portrait / vertical screen orientation */
const isVertical = ref(false);
const updateOrientation = () => {
  isVertical.value = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
};
onMounted(() => {
  updateOrientation();
  window.addEventListener("resize", updateOrientation);
});
onUnmounted(() => {
  window.removeEventListener("resize", updateOrientation);
});

/**
 * In portrait mode, remap resource-node port sides:
 *   right (input outputs)     → bottom  (face process top from above)
 *   left  (output inputs)     → top     (face process bottom from below)
 *   top   (mechanism outputs) → left    (face process right from the right side)
 *   bottom                    → bottom  (no change)
 */
const remapSide = (side: Location): Location => {
  if (!isVertical.value) return side;
  const map: Record<Location, Location> = { right: "bottom", left: "top", top: "left", bottom: "bottom" };
  return map[side] ?? side;
};

const allPorts = computed<NodeInterface<unknown>[]>(
  () => [...Object.values(props.node.inputs), ...Object.values(props.node.outputs)] as NodeInterface<unknown>[]
);
const leftPorts = computed<NodeInterface<unknown>[]>(
  () => allPorts.value.filter((intf) => readLocation(intf) === "left") as NodeInterface<unknown>[]
);
const rightPorts = computed<NodeInterface<unknown>[]>(
  () => allPorts.value.filter((intf) => readLocation(intf) === "right") as NodeInterface<unknown>[]
);
const topPorts = computed<NodeInterface<unknown>[]>(
  () => allPorts.value.filter((intf) => readLocation(intf) === "top") as NodeInterface<unknown>[]
);
const bottomPorts = computed<NodeInterface<unknown>[]>(
  () => allPorts.value.filter((intf) => readLocation(intf) === "bottom") as NodeInterface<unknown>[]
);

const resourceType = computed(() => readResourceType());
const isInput = computed(() => resourceType.value === "input");
const isOutput = computed(() => resourceType.value === "output");
const isMachine = computed(() => resourceType.value === "machine");
const isQuantityNode = computed(() => ["energy", "gas", "water"].includes(resourceType.value));
const isTimedNode = computed(() => ["machine", "service", "property"].includes(resourceType.value));

const outputPointerStart = ref<{ x: number; y: number } | null>(null);
const handleOutputPointerDown = (event: PointerEvent, intf: NodeInterface<unknown>) => {
  if (!isOutput.value) return;
  if (readLocation(intf) !== "right") return;
  outputPointerStart.value = { x: event.clientX, y: event.clientY };
};

const handleOutputPointerUp = (event: PointerEvent, intf: NodeInterface<unknown>) => {
  if (!isOutput.value) return;
  if (readLocation(intf) !== "right") return;
  const start = outputPointerStart.value;
  outputPointerStart.value = null;
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.hypot(dx, dy) > 6) return;
  props.onOutputConnector?.(intf);
};

const clampCount = (count: number) => (count > 0 ? count : 1);
const getPortStyle = (side: Location, index: number, count: number): CSSProperties => {
  const safeCount = clampCount(count);
  const fraction = (index + 1) / (safeCount + 1);

  if (side === "left") {
    return {
      position: "absolute",
      left: "0%",
      top: `${fraction * 100}%`,
      transform: "translate(-50%, -50%)",
    };
  }

  if (side === "right") {
    return {
      position: "absolute",
      left: "100%",
      top: `${fraction * 100}%`,
      transform: "translate(-50%, -50%)",
    };
  }

  if (side === "top") {
    return {
      position: "absolute",
      left: `${fraction * 100}%`,
      top: "0%",
      transform: "translate(-50%, -50%)",
    };
  }

  return {
    position: "absolute",
    left: `${fraction * 100}%`,
    top: "100%",
    transform: "translate(-50%, -50%)",
  };
};

const NodeInterfaceView = Components.NodeInterface;
</script>

<template>
  <div class="resource-node">
    <NodeInterfaceView
      v-for="(intf, index) in leftPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle(remapSide('left'), index, leftPorts.length)"
    />

    <div
      v-for="(intf, index) in rightPorts"
      :key="intf.id"
      :style="getPortStyle(remapSide('right'), index, rightPorts.length)"
      @pointerdown.capture="handleOutputPointerDown($event, intf)"
      @pointerup.capture="handleOutputPointerUp($event, intf)"
    >
      <NodeInterfaceView
        :node="node"
        :intf="intf"
      />
    </div>

    <NodeInterfaceView
      v-for="(intf, index) in topPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle(remapSide('top'), index, topPorts.length)"
    />

    <NodeInterfaceView
      v-for="(intf, index) in bottomPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle(remapSide('bottom'), index, bottomPorts.length)"
    />

    <div class="resource-title">
      <input
        v-model="titleDraft"
        class="title-input"
        type="text"
        @input="syncTitle"
        @blur="syncTitle"
      />
      <button class="delete-btn" type="button" title="Delete" @click.stop="props.onDelete?.()">
        ×
      </button>
    </div>

    <div v-if="isInput" class="resource-fields">
      <div v-if="inputInstance" class="resource-form">
        <InputInstanceEditor
          :model-value="inputInstance"
          @update:model-value="applyInputInstance"
        />
      </div>
      <template v-else>
        <div class="field-row">
          <span class="field-label">origin</span>
          <template v-if="editingOrigin">
            <input
              v-model="originDraft"
              class="field-input"
              type="text"
              placeholder=""
              @keyup.enter="saveOrigin"
              @blur="saveOrigin"
            />
          </template>
          <button v-else type="button" class="field-value" @click.stop="startEditOrigin">
            {{ readFields().origin || "-" }}
          </button>
        </div>
        <div class="field-row">
          <span class="field-label">quantity</span>
          <template v-if="editingInputQuantity">
            <input
              v-model="inputQuantityDraft"
              class="field-input"
              type="number"
              min="0"
              step="0.01"
              @keyup.enter="saveInputQuantity"
              @blur="saveInputQuantity"
            />
          </template>
          <button v-else type="button" class="field-value" @click.stop="startEditInputQuantity">
            {{ readFields().inputQuantity ?? 0 }}
          </button>
        </div>
        <div class="field-row">
          <span class="field-label">details</span>
          <textarea
            v-model="detailsDraft"
            class="field-textarea"
            rows="2"
            @blur="syncDetails"
          />
        </div>
      </template>
    </div>

    <div v-else-if="isOutput" class="resource-fields">
      <div v-if="outputInstance" class="resource-form">
        <ProductInstanceEditor
          :model-value="outputInstance"
          label="output"
          :priced="true"
          :is-root="true"
          :show-process="false"
          @update:model-value="applyOutputInstance"
        />
      </div>
      <template v-else>
        <div class="field-row">
          <span class="field-label">kg per output</span>
          <template v-if="editingOutputKg">
            <input
              v-model="outputKgDraft"
              class="field-input"
              type="number"
              min="0.000001"
              step="0.01"
              @keyup.enter="saveOutputKg"
              @blur="saveOutputKg"
            />
          </template>
          <button v-else type="button" class="field-value" @click.stop="startEditOutputKg">
            {{ readFields().outputKg ?? 1 }}
          </button>
        </div>
        <div class="field-row">
          <span class="field-label">destination</span>
          <template v-if="editingDestination">
            <input
              v-model="destinationDraft"
              class="field-input"
              type="text"
              placeholder=""
              @keyup.enter="saveDestination"
              @blur="saveDestination"
            />
          </template>
          <button v-else type="button" class="field-value" @click.stop="startEditDestination">
            {{ readFields().destination || "-" }}
          </button>
        </div>
      </template>
    </div>

    <div v-else-if="isMachine" class="resource-fields">
      <div class="resource-form">
        <MachineInstanceEditor
          :model-value="machineInstance as any"
          label="machine"
          :show-reference-hash="false"
          :show-fields="true"
          :show-hr="true"
          @update:model-value="applyMachineInstance"
        />
      </div>
    </div>

    <div v-else-if="isQuantityNode" class="resource-fields">
      <div class="field-row">
        <span class="field-label">quantity</span>
        <template v-if="editingQuantity">
          <input
            v-model="quantityDraft"
            class="field-input"
            type="number"
            min="0"
            step="0.01"
            @keyup.enter="saveQuantity"
            @blur="saveQuantity"
          />
        </template>
        <button v-else type="button" class="field-value" @click.stop="startEditQuantity">
          {{ readFields().quantity ?? 0 }}
        </button>
      </div>
    </div>

    <div v-else-if="isTimedNode" class="resource-fields">
      <div class="field-row">
        <span class="field-label">duration</span>
        <template v-if="editingDuration">
          <input
            v-model="durationDraft"
            class="field-input"
            type="text"
            placeholder=""
            @keyup.enter="saveDuration"
            @blur="saveDuration"
          />
        </template>
        <button v-else type="button" class="field-value" @click.stop="startEditDuration">
          {{ readFields().duration || "-" }}
        </button>
      </div>
      <div class="field-row">
        <span class="field-label">parameters</span>
        <textarea
          v-model="parametersDraft"
          class="field-textarea"
          rows="2"
          @blur="syncParameters"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-node {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 440px;
  max-width: 440px;
  padding: 10px;
  background: #1b1f24;
  border: 2px solid #ffb74d;
  border-radius: 8px;
  position: relative;
  color: #fff;
}

.resource-node.selected {
  border-color: #fff;
}

.resource-node :deep(.baklava-node-interface) {
  width: 12px;
  height: 12px;
  padding: 0;
  margin: 0;
  line-height: 0;
  font-size: 0;
}

.resource-node :deep(.baklava-node-interface > span) {
  display: none;
}

.resource-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-input {
  width: 100%;
  border: 1px solid rgba(255, 183, 77, 0.8);
  background: #101418;
  color: #fff;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 6px;
  text-align: center;
}

.delete-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid rgba(255, 183, 77, 0.8);
  background: #101418;
  color: #fff;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.resource-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resource-form :deep(.q-card) {
  background: #11161b;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}

.field-label {
  color: #b0bec5;
  font-size: 11px;
  min-width: 70px;
}

.field-input,
.field-textarea {
  flex: 1;
  background: #101418;
  border: 1px solid rgba(255, 183, 77, 0.6);
  color: #fff;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 4px;
  outline: none;
}

.field-value {
  flex: 1;
  border: 1px solid rgba(255, 183, 77, 0.6);
  background: #101418;
  color: #fff;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 4px;
  text-align: left;
  cursor: pointer;
}

.field-textarea {
  min-height: 52px;
  resize: vertical;
}
</style>
