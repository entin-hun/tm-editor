<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { DependencyEngine } from "@baklavajs/engine";
import { BaklavaEditor, Components, setNodePosition, useBaklava } from "@baklavajs/renderer-vue";
import type { InputInstance, MachineInstance, Pokedex, ProductInstance } from "@trace.market/types";
import Idef0Node from "./components/Idef0Node.vue";
import ResourceNodeVue from "./components/ResourceNode.vue";
import { ProcessNode } from "./nodes/ProcessNode";
import { ResourceNode } from "./nodes/ResourceNode";
import { clone, defaultLocalInputInstance, defaultMachineInstance } from "../components/editors/defaults";
import "./style.css";
import "@baklavajs/plugin-renderer-vue/dist/styles.css";
import "@baklavajs/themes/dist/syrup-dark.css";

const props = defineProps<{ modelValue: Pokedex }>();
const emit = defineEmits<{ (e: "update:modelValue", value: Pokedex): void }>();

const value = ref<Pokedex>(props.modelValue);
watch(
  () => props.modelValue,
  (next) => {
    if (next !== value.value) value.value = next;
  }
);

watch(
  value,
  (next) => {
    emit("update:modelValue", next);
  },
  { deep: true }
);

const baklava = useBaklava();
const rootEl = ref<HTMLElement | null>(null);
const debugEnabled = false;

baklava.settings.sidebar.enabled = false;
baklava.settings.sidebar.resizable = false;
baklava.settings.toolbar.enabled = false;
baklava.settings.palette.enabled = false;

const applyMobileSettings = () => {
  if (typeof window === "undefined") return;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isNarrow = window.matchMedia("(max-width: 768px)").matches;
  if (!isTouch && !isNarrow) return;

  baklava.settings.panZoom.minScale = 0.3;
  baklava.settings.panZoom.maxScale = 2.5;
  baklava.settings.background.gridSize = 80;
  baklava.settings.background.gridDivision = 4;
  baklava.settings.nodes.resizable = false;
  baklava.settings.nodes.defaultWidth = 400;
  baklava.settings.nodes.minWidth = 320;
  baklava.settings.nodes.maxWidth = 520;
};

applyMobileSettings();

baklava.editor.registerNodeType(ProcessNode, {
  category: "Trace Market",
  title: "Process Node",
});

baklava.editor.registerNodeType(ResourceNode, {
  category: "Trace Market",
  title: "Resource Node",
});

const engine = new DependencyEngine(baklava.editor);
engine.start();


const installConnectionMarkers = () => {
  const svg = document.querySelector(".connections-container svg") as SVGSVGElement | null;
  if (!svg) return false;

  const existing = svg.querySelector("#connection-arrow") as SVGMarkerElement | null;
  if (existing) return true;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "connection-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "8");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("markerUnits", "strokeWidth");
  marker.setAttribute("orient", "auto");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  path.setAttribute("fill", "currentColor");

  marker.appendChild(path);
  defs.appendChild(marker);
  svg.prepend(defs);
  return true;
};

const refreshConnectionCoords = () => {
  const graph = baklava.displayedGraph;
  if (graph.nodes.length === 0) return;

  const epsilon = 0.01;
  requestAnimationFrame(() => {
    graph.nodes.forEach((node: any) => {
      setNodePosition(node as any, node.position.x + epsilon, node.position.y + epsilon);
    });
    requestAnimationFrame(() => {
      graph.nodes.forEach((node: any) => {
        setNodePosition(node as any, node.position.x - epsilon, node.position.y - epsilon);
      });
    });
  });
};

type ProcessShape = {
  type?: string;
  category?: string;
  name?: string;
  inputInstances: InputInstance[];
  machineInstance?: MachineInstance;
};

const ensureProcessWithInputs = (): ProcessShape | null => {
  const inst = value.value.instance as unknown as { process?: ProcessShape } | undefined;
  if (!inst) return null;
  if (!inst.process) {
    inst.process = {
      type: (inst as any)?.type || "process",
      category: "process",
      name: (inst as any)?.type || "process",
      inputInstances: [],
    } as ProcessShape;
  }
  if (!Array.isArray((inst.process as any).inputInstances)) {
    (inst.process as any).inputInstances = [];
  }
  inst.process.type = inst.process.type || "process";
  (inst.process as any).category = (inst.process as any).category || "process";
  (inst.process as any).name = (inst.process as any).name || inst.process.type;
  return inst.process as ProcessShape;
};

const inputLabel = (input: InputInstance, index: number) => {
  const instance = (input as any)?.instance;
  const title = typeof instance === "object" ? instance?.title || instance?.type : undefined;
  return title || `Input ${index + 1}`;
};

type PricedProduct = ProductInstance & { price?: unknown };
const outputLabel = (output: ProductInstance | PricedProduct | undefined) => {
  if (!output) return "Output";
  return output.title || output.type || "Output";
};

const clearGraph = () => {
  const graph = baklava.displayedGraph as any;
  if (!graph?.removeNode) return;
  [...graph.nodes].forEach((node) => graph.removeNode(node));
};

const buildGraphFromModel = () => {
  const graph = baklava.displayedGraph;
  const process = ensureProcessWithInputs();
  if (!graph || !process) return;

  clearGraph();

  const processNode = graph.addNode(new ProcessNode());
  if (!processNode) return;
  processNode.title = process.type || "Process";
  (processNode as any).process = process;
  (processNode as any).onProcessUpdate = (next: ProcessShape) => {
    const target = ensureProcessWithInputs();
    if (!target) return;
    Object.assign(target, next);
  };

  const outputInstance = value.value.instance as ProductInstance | PricedProduct | undefined;
  const outputNode = graph.addNode(new ResourceNode("output"));
  if (outputNode) {
    (outputNode as any).outputInstance = outputInstance;
    (outputNode as any).onOutputUpdate = (next: ProductInstance | PricedProduct) => {
      value.value.instance = next as any;
    };
    outputNode.title = outputLabel(outputInstance);

    const outputPort = processNode.addOutputPort("Output");
    const outputInput = Object.values(outputNode.inputs)[0];
    if (outputPort && outputInput) graph.addConnection(outputPort, outputInput);
  }

  const machineInstance = process.machineInstance ?? clone(defaultMachineInstance);
  process.machineInstance = machineInstance;
  const machineNode = graph.addNode(new ResourceNode("machine"));
  if (machineNode) {
    (machineNode as any).machineInstance = machineInstance;
    (machineNode as any).onMachineUpdate = (next: MachineInstance) => {
      const target = ensureProcessWithInputs();
      if (!target) return;
      target.machineInstance = next;
    };
    machineNode.title = "Machine";

    const machinePort = processNode.addInputPort("Machine");
    const machineOutput = Object.values(machineNode.outputs)[0];
    if (machinePort && machineOutput) graph.addConnection(machineOutput, machinePort);
  }

  process.inputInstances.forEach((input, index) => {
    const inputNode = graph.addNode(new ResourceNode("input"));
    if (!inputNode) return;
    (inputNode as any).inputInstance = input;
    (inputNode as any).onInputUpdate = (next: InputInstance) => {
      process.inputInstances.splice(index, 1, next);
    };
    inputNode.title = inputLabel(input, index);

    const inputPort = processNode.addInputPort(`Input ${index + 1}`);
    const inputOutput = Object.values(inputNode.outputs)[0];
    if (inputOutput && inputPort) graph.addConnection(inputOutput, inputPort);
  });

  nextTick(() => {
    autoArrangeNodes();
    refreshConnectionCoords();
  });
};

const autoArrangeNodes = () => {
  const graph = baklava.displayedGraph;
  const nodes = graph.nodes;
  if (nodes.length === 0) return;

  const processNode = nodes.find((node: any) => node.type === "ProcessNode") as ProcessNode | undefined;
  const inputNodes = nodes.filter(
    (node: any) => node.type === "ResourceNode" && (node as any).resourceType === "input"
  ) as ResourceNode[];
  const outputNodes = nodes.filter(
    (node: any) => node.type === "ResourceNode" && (node as any).resourceType === "output"
  ) as ResourceNode[];
  const machineNodes = nodes.filter(
    (node: any) => node.type === "ResourceNode" && (node as any).resourceType === "machine"
  ) as ResourceNode[];

  const getNodeSize = (node: any, fallback: { width: number; height: number }) => {
    const el = document.getElementById(node.id);
    if (!el) return fallback;
    const rect = el.getBoundingClientRect();
    const scale = graph.scaling || 1;
    return {
      width: rect.width / scale,
      height: rect.height / scale,
    };
  };

  const bounds = rootEl.value?.getBoundingClientRect();
  const viewWidth = bounds?.width ?? window.innerWidth;
  const viewHeight = bounds?.height ?? window.innerHeight;
  const centerX = viewWidth / (2 * graph.scaling) - graph.panning.x;
  const centerY = viewHeight / (2 * graph.scaling) - graph.panning.y;

  const setPos = (node: any, x: number, y: number) => {
    node.position.x = x;
    node.position.y = y;
    setNodePosition(node, x, y);
    if (debugEnabled) {
      console.log("setPos", node.type, node.title, { x, y });
    }
  };

  if (processNode) {
    const size = getNodeSize(processNode, { width: 440, height: 260 });
    const x = centerX - size.width / 2;
    const y = centerY - size.height / 2;
    setPos(processNode, x, y);

    const inputGap = 30;
    const outputGap = 30;
    const inputSizes = inputNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }));
    const outputSizes = outputNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }));
    const inputTotalHeight =
      inputSizes.reduce((sum, size) => sum + size.height, 0) + Math.max(0, inputSizes.length - 1) * inputGap;
    const outputTotalHeight =
      outputSizes.reduce((sum, size) => sum + size.height, 0) + Math.max(0, outputSizes.length - 1) * outputGap;

    let inputY = centerY - inputTotalHeight / 2;
    inputNodes.forEach((node, index) => {
      const size = inputSizes[index];
      const xPos = centerX - size.width - 260;
      const yPos = inputY;
      setPos(node, xPos, yPos);
      inputY += size.height + inputGap;
    });

    let outputY = centerY - outputTotalHeight / 2;
    outputNodes.forEach((node, index) => {
      const size = outputSizes[index];
      const xPos = centerX + size.width + 220;
      const yPos = outputY;
      setPos(node, xPos, yPos);
      outputY += size.height + outputGap;
    });

    if (machineNodes.length > 0) {
      const machineNode = machineNodes[0];
      const machineSize = getNodeSize(machineNode, { width: 440, height: 260 });
      const machineX = centerX - machineSize.width / 2;
      const machineY = y + size.height + 40;
      setPos(machineNode, machineX, machineY);
    }
  }
};

const addInputInstance = () => {
  const process = ensureProcessWithInputs();
  if (!process) return;
  process.inputInstances.push(clone(defaultLocalInputInstance));
  buildGraphFromModel();
};

const deleteResourceNode = (node: ResourceNode) => {
  const process = ensureProcessWithInputs();
  if (!process) return;
  if ((node as any).resourceType === "output") return;
  const instance = (node as any).inputInstance as InputInstance | undefined;
  if (!instance) return;
  const index = process.inputInstances.findIndex((item) => item === instance);
  if (index >= 0) {
    process.inputInstances.splice(index, 1);
  }
  buildGraphFromModel();
};

let markerObserver: MutationObserver | null = null;

onMounted(() => {
  const tryInstall = () => {
    if (installConnectionMarkers()) return;
    requestAnimationFrame(tryInstall);
  };

  tryInstall();
  markerObserver = new MutationObserver(() => installConnectionMarkers());
  markerObserver.observe(document.body, { childList: true, subtree: true });

  buildGraphFromModel();
});

onUnmounted(() => {
  if (markerObserver) {
    markerObserver.disconnect();
    markerObserver = null;
  }
});

watch(
  () => props.modelValue,
  () => {
    buildGraphFromModel();
  }
);

watch(
  () => ensureProcessWithInputs()?.inputInstances.length,
  () => {
    buildGraphFromModel();
  }
);

watch(
  () => [baklava.displayedGraph.nodes.length, baklava.displayedGraph.connections.length],
  () => {
    setTimeout(() => autoArrangeNodes(), 50);
    setTimeout(() => refreshConnectionCoords(), 100);
  }
);
</script>

<template>
  <div class="flow-editor-root" ref="rootEl">
    <BaklavaEditor :view-model="baklava">
      <template #node="{ node, selected, dragging, onStartDrag, onSelect }">
        <template v-if="node.type && (node.type.includes('Subgraph') || node.type.includes('__baklava'))">
          <div style="display: none;"></div>
        </template>
        <template v-else-if="node instanceof ProcessNode || node.type === 'ProcessNode'">
          <Components.Node
            :node="node"
            :selected="selected"
            :dragging="dragging"
            :on-start-drag="onStartDrag"
            :on-select="(event?: any) => onSelect(event)"
          >
            <template #title></template>
            <template #nodeInterface></template>
            <template #content>
              <Idef0Node
                :node="node"
                :on-add-input="addInputInstance"
                :on-delete="undefined"
              />
            </template>
          </Components.Node>
        </template>
        <template v-else-if="node instanceof ResourceNode || node.type === 'ResourceNode'">
          <Components.Node
            :node="node"
            :selected="selected"
            :dragging="dragging"
            :on-start-drag="onStartDrag"
            :on-select="(event?: any) => onSelect(event)"
          >
            <template #title></template>
            <template #nodeInterface></template>
            <template #content>
              <ResourceNodeVue
                :node="node"
                :on-delete="() => deleteResourceNode(node as ResourceNode)"
              />
            </template>
          </Components.Node>
        </template>
        <template v-else>
          <Components.Node
            :node="node"
            :selected="selected"
            :dragging="dragging"
            :on-start-drag="onStartDrag"
            :on-select="(event?: any) => onSelect(event)"
          />
        </template>
      </template>
    </BaklavaEditor>
  </div>
</template>
