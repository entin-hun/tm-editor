<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { Components } from "@baklavajs/renderer-vue";
import type { AbstractNode, NodeInterface } from "@baklavajs/core";
import type { Hr, Impact, InputInstance, ProductInstance } from "@trace.market/types";
import InputInstanceEditor from "../../components/editors/InputInstanceEditor.vue";
import ProductInstanceEditor from "../../components/editors/ProductInstanceEditor.vue";
import HrEditor from "../../components/editors/HrEditor.vue";
import SiteEditor from "../../components/editors/SiteEditor.vue";
import ImpactArrayEditor from "../../components/editors/impacts/ImpactArrayEditor.vue";
import type { KnowHow } from "@trace.market/types";

type Location = "left" | "right" | "top" | "bottom";
type PortMeta = {
  location?: Location;
};

const props = defineProps<{
  node: AbstractNode;
  onDelete?: () => void;
  onOutputConnector?: (intf: NodeInterface<unknown>) => void;
  onInputConnector?: (intf: NodeInterface<unknown>) => void;
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
const controlSite = computed(() => (props.node as AbstractNode & { site?: unknown }).site);
const controlHr = computed(() => (props.node as AbstractNode & { hr?: Hr }).hr);
const impactArray = computed(() => (props.node as AbstractNode & { impacts?: Impact[] }).impacts);
const knowHowValue = computed(() => (props.node as AbstractNode & { knowHow?: KnowHow }).knowHow);
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

const applyControlSite = (next: unknown) => {
  const node = props.node as AbstractNode & { site?: unknown; onSiteUpdate?: (site?: unknown) => void };
  node.site = next;
  node.onSiteUpdate?.(next);
};

const applyControlHr = (next: Hr | undefined) => {
  const node = props.node as AbstractNode & { hr?: Hr; onHrUpdate?: (hr?: Hr) => void };
  node.hr = next;
  node.onHrUpdate?.(next);
};

const applyImpacts = (next: Impact[] | undefined) => {
  const node = props.node as AbstractNode & { impacts?: Impact[]; onImpactsUpdate?: (impacts?: Impact[]) => void };
  node.impacts = next;
  node.onImpactsUpdate?.(next);
};

const applyOutputInstance = (next: ProductInstance | PricedProduct) => {
  const node = props.node as AbstractNode & {
    outputInstance?: ProductInstance | PricedProduct;
    onOutputUpdate?: (output: ProductInstance | PricedProduct) => void;
  };
  node.outputInstance = next;
  node.onOutputUpdate?.(next);
};

const syncFieldsUpdate = () => {
  const fields = readFields();
  const node = props.node as AbstractNode & { onFieldsUpdate?: (fields: ResourceFields) => void };
  node.onFieldsUpdate?.(fields);
};

const titleDraft = ref(readTitle());
const syncTitle = () => {
  (props.node as AbstractNode & { title?: string }).title = titleDraft.value.trim();
  const node = props.node as AbstractNode & { onTitleUpdate?: (title: string) => void };
  node.onTitleUpdate?.(titleDraft.value.trim());
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
  syncFieldsUpdate();
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
  syncFieldsUpdate();
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
  syncFieldsUpdate();
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
  syncFieldsUpdate();
};

const detailsDraft = ref("");
const syncDetails = () => {
  const fields = readFields();
  fields.details = detailsDraft.value;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  syncFieldsUpdate();
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
  syncFieldsUpdate();
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
  syncFieldsUpdate();
};

const parametersDraft = ref("");
const syncParameters = () => {
  const fields = readFields();
  fields.parameters = parametersDraft.value;
  (props.node as AbstractNode & { fields?: ResourceFields }).fields = fields;
  syncFieldsUpdate();
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
const isSite = computed(() => resourceType.value === "site");
const isHr = computed(() => resourceType.value === "hr");
const isImpact = computed(() => resourceType.value === "impact");
const isKnowHow = computed(() => resourceType.value === "knowhow");
const isQuantityNode = computed(() => ["energy", "gas", "water"].includes(resourceType.value));
const isTimedNode = computed(() => ["service", "property"].includes(resourceType.value));

const outputPointerStart = ref<{ x: number; y: number } | null>(null);
const handleOutputPointerDown = (event: PointerEvent, intf: NodeInterface<unknown>) => {
  if (!isOutput.value) return;
  if (readLocation(intf) !== "right") return;
  event.stopPropagation();
  event.preventDefault();
  outputPointerStart.value = { x: event.clientX, y: event.clientY };
};

const handleOutputPointerUp = (event: PointerEvent, intf: NodeInterface<unknown>) => {
  if (!isOutput.value) return;
  if (readLocation(intf) !== "right") return;
  event.stopPropagation();
  event.preventDefault();
  const start = outputPointerStart.value;
  outputPointerStart.value = null;
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.hypot(dx, dy) > 6) return;
  props.onOutputConnector?.(intf);
};

/* Input connector: + badge on the left side of input nodes */
const inputPointerStart = ref<{ x: number; y: number } | null>(null);
const handleInputPointerDown = (event: PointerEvent, intf: NodeInterface<unknown>) => {
  if (!isInput.value) return;
  event.stopPropagation();
  event.preventDefault();
  inputPointerStart.value = { x: event.clientX, y: event.clientY };
};

const handleInputPointerUp = (event: PointerEvent, intf: NodeInterface<unknown>) => {
  if (!isInput.value) return;
  event.stopPropagation();
  event.preventDefault();
  const start = inputPointerStart.value;
  inputPointerStart.value = null;
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.hypot(dx, dy) > 6) return;
  props.onInputConnector?.(intf);
};

/* Standalone input connector handlers (when no left ports exist yet) */
const handleInputPointerDownStandalone = (event: PointerEvent) => {
  if (!isInput.value) return;
  event.stopPropagation();
  event.preventDefault();
  inputPointerStart.value = { x: event.clientX, y: event.clientY };
};

const handleInputPointerUpStandalone = (event: PointerEvent) => {
  if (!isInput.value) return;
  event.stopPropagation();
  event.preventDefault();
  const start = inputPointerStart.value;
  inputPointerStart.value = null;
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.hypot(dx, dy) > 6) return;
  /* Pass the right-side output as the interface reference; the
     FlowEditor handler will create the actual left-side input port. */
  const rightIntf = rightPorts.value[0];
  if (rightIntf) props.onInputConnector?.(rightIntf);
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

/** Position for the + badge next to a right-side port */
const getBadgeStyle = (index: number, count: number): CSSProperties => {
  const safeCount = clampCount(count);
  const fraction = (index + 1) / (safeCount + 1);
  return {
    position: "absolute",
    left: "calc(100% + 10px)",
    top: `${fraction * 100}%`,
    transform: "translate(0, -50%)",
  };
};

/** Position for the + badge to the left of a left-side port */
const getBadgeStyleLeft = (index: number, count: number): CSSProperties => {
  const safeCount = clampCount(count);
  const fraction = (index + 1) / (safeCount + 1);
  return {
    position: "absolute",
    left: "calc(0% - 26px)",
    top: `${fraction * 100}%`,
    transform: "translate(0, -50%)",
  };
};

const NodeInterfaceView = Components.NodeInterface;

const controlTypeDraft = ref<"site" | "hr" | "machine">("hr");
const canSwitchControlType = computed(() => {
  const node = props.node as AbstractNode & { onControlKindUpdate?: (next: "site" | "hr" | "machine") => void };
  return typeof node.onControlKindUpdate === "function";
});

watch(
  () => readResourceType(),
  (next) => {
    if (next === "site" || next === "machine") {
      controlTypeDraft.value = next;
      return;
    }
    controlTypeDraft.value = "hr";
  },
  { immediate: true }
);

const applyControlType = () => {
  const nextType = controlTypeDraft.value;
  const node = props.node as AbstractNode & {
    resourceType?: string;
    onControlKindUpdate?: (next: "site" | "hr" | "machine") => void;
  };
  node.resourceType = nextType;
  node.onControlKindUpdate?.(nextType);
};

const applyKnowHow = (next: KnowHow | undefined) => {
  const node = props.node as AbstractNode & { knowHow?: KnowHow; onKnowHowUpdate?: (knowHow?: KnowHow) => void };
  node.knowHow = next;
  node.onKnowHowUpdate?.(next);
};

const machineHashDraft = ref("");
const syncMachineHashFromNode = () => {
  const machine = (props.node as AbstractNode & { machineInstance?: unknown }).machineInstance;
  if (machine && typeof machine === "object" && "hash" in (machine as Record<string, unknown>)) {
    const raw = (machine as Record<string, unknown>).hash;
    machineHashDraft.value = typeof raw === "string" ? raw : "";
    return;
  }
  machineHashDraft.value = "";
};

watch(machineInstance, syncMachineHashFromNode, { immediate: true, deep: true });

const syncMachineHash = () => {
  const node = props.node as AbstractNode & {
    machineInstance?: unknown;
    onMachineUpdate?: (machine: unknown) => void;
  };
  const current = node.machineInstance;
  const next = {
    ...(current && typeof current === "object" ? current as Record<string, unknown> : {}),
    hash: machineHashDraft.value.trim(),
  };
  node.machineInstance = next;
  node.onMachineUpdate?.(next);
};

const knowHowHashDraft = ref("");
const syncKnowHowHashFromNode = () => {
  const hash = knowHowValue.value?.hash;
  knowHowHashDraft.value = typeof hash === "string" ? hash : "";
};

watch(knowHowValue, syncKnowHowHashFromNode, { immediate: true, deep: true });

const syncKnowHowHash = () => {
  const current = knowHowValue.value;
  const next: KnowHow = {
    owner: current?.owner ?? "",
    hash: knowHowHashDraft.value.trim(),
    inputs: current?.inputs ?? "",
    outputs: current?.outputs ?? "",
    licenseFee: current?.licenseFee ?? { amount: 0, currency: "", type: "budget" },
  };
  applyKnowHow(next);
};
</script>

<template>
  <div class="resource-node">
    <template v-for="(intf, index) in leftPorts" :key="intf.id">
      <NodeInterfaceView
        :node="node"
        :intf="intf"
        :style="getPortStyle('left', index, leftPorts.length)"
      />
      <!-- + badge on the left side of input nodes (when left ports exist) -->
      <span
        v-if="isInput"
        class="output-add-badge"
        :style="getBadgeStyleLeft(index, leftPorts.length)"
        @pointerdown.capture.stop.prevent="handleInputPointerDown($event, intf)"
        @pointerup.capture.stop.prevent="handleInputPointerUp($event, intf)"
      >+</span>
    </template>

    <!-- Standalone + badge for input nodes that have no left ports yet -->
    <span
      v-if="isInput && leftPorts.length === 0"
      class="output-add-badge"
      :style="{ position: 'absolute', left: 'calc(0% - 26px)', top: '50%', transform: 'translate(0, -50%)' }"
      @pointerdown.capture.stop.prevent="handleInputPointerDownStandalone($event)"
      @pointerup.capture.stop.prevent="handleInputPointerUpStandalone($event)"
    >+</span>

    <template v-for="(intf, index) in rightPorts" :key="intf.id">
      <NodeInterfaceView
        :node="node"
        :intf="intf"
        :style="getPortStyle('right', index, rightPorts.length)"
      />
      <!-- + badge positioned next to the port; uses same port-style origin -->
      <span
        v-if="isOutput"
        class="output-add-badge"
        :style="getBadgeStyle(index, rightPorts.length)"
        @pointerdown.capture.stop.prevent="handleOutputPointerDown($event, intf)"
        @pointerup.capture.stop.prevent="handleOutputPointerUp($event, intf)"
      >+</span>
    </template>

    <NodeInterfaceView
      v-for="(intf, index) in topPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('top', index, topPorts.length)"
    />

    <NodeInterfaceView
      v-for="(intf, index) in bottomPorts"
      :key="intf.id"
      :node="node"
      :intf="intf"
      :style="getPortStyle('bottom', index, bottomPorts.length)"
    />

    <div class="resource-title">
      <select
        v-if="canSwitchControlType"
        v-model="controlTypeDraft"
        class="control-type-select"
        @change="applyControlType"
      >
        <option value="hr">Hr</option>
        <option value="site">Site</option>
        <option value="machine">Machine</option>
      </select>
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
      <div class="field-row">
        <span class="field-label">hash</span>
        <input
          v-model="machineHashDraft"
          class="field-input"
          type="text"
          placeholder="machine hash"
          @blur="syncMachineHash"
          @keyup.enter="syncMachineHash"
        />
      </div>
    </div>

    <div v-else-if="isSite" class="resource-fields">
      <div class="resource-form">
        <SiteEditor
          :model-value="controlSite"
          label="site"
          @update:model-value="applyControlSite"
        />
      </div>
    </div>

    <div v-else-if="isHr" class="resource-fields">
      <div class="resource-form">
        <HrEditor
          :model-value="controlHr"
          label="hr"
          @update:model-value="applyControlHr"
        />
      </div>
    </div>

    <div v-else-if="isImpact" class="resource-fields">
      <div class="resource-form">
        <ImpactArrayEditor
          :model-value="impactArray"
          label="impacts"
          @update:model-value="applyImpacts"
        />
      </div>
    </div>

    <div v-else-if="isKnowHow" class="resource-fields">
      <div class="field-row">
        <span class="field-label">hash</span>
        <input
          v-model="knowHowHashDraft"
          class="field-input"
          type="text"
          placeholder="knowhow hash"
          @blur="syncKnowHowHash"
          @keyup.enter="syncKnowHowHash"
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

.output-add-badge {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #ffb74d;
  color: #101418;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
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

.control-type-select {
  border: 1px solid rgba(255, 183, 77, 0.8);
  background: #101418;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  padding: 4px 6px;
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
