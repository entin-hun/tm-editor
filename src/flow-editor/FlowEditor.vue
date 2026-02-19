<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { DependencyEngine } from "@baklavajs/engine";
import { BaklavaEditor, Components, setNodePosition, useBaklava } from "@baklavajs/renderer-vue";
import type { NodeInterface } from "@baklavajs/core";
import type { Hr, Impact, InputInstance, KnowHow, MachineInstance, Pokedex, ProductInstance } from "@trace.market/types";
import Idef0Node from "./components/Idef0Node.vue";
import ResourceNodeVue from "./components/ResourceNode.vue";
import { ProcessNode } from "./nodes/ProcessNode";
import { ResourceNode } from "./nodes/ResourceNode";
import {
  clone,
  defaultHr,
  defaultMachineInstance,
  defaultLocalInputInstance,
  defaultSite,
} from "../components/editors/defaults";
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
  const svg = document.querySelector(".connections-container") as SVGSVGElement | null;
  if (!svg) return false;

  const existing = svg.querySelector("#connection-arrow") as SVGMarkerElement | null;
  const existingStart = svg.querySelector("#connection-arrow-start") as SVGMarkerElement | null;
  if (existing && existingStart) return true;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.prepend(defs);
  }
  const makeMarker = (id: string, orient: string) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", id);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "5");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("markerUnits", "userSpaceOnUse");
    marker.setAttribute("orient", orient);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    path.setAttribute("fill", "hsl(152, 76%, 42%)");
    marker.appendChild(path);
    return marker;
  };

  if (!existing) {
    defs.appendChild(makeMarker("connection-arrow", "auto"));
  }
  if (!existingStart) {
    defs.appendChild(makeMarker("connection-arrow-start", "auto-start-reverse"));
  }
  return true;
};

const bezierMidpoint = (
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number
) => {
  const t = 0.5;
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  const mx = mt3 * x1 + 3 * mt2 * t * cx1 + 3 * mt * t2 * cx2 + t3 * x2;
  const my = mt3 * y1 + 3 * mt2 * t * cy1 + 3 * mt * t2 * cy2 + t3 * y2;

  const dx = 3 * mt2 * (cx1 - x1) + 6 * mt * t * (cx2 - cx1) + 3 * t2 * (x2 - cx2);
  const dy = 3 * mt2 * (cy1 - y1) + 6 * mt * t * (cy2 - cy1) + 3 * t2 * (y2 - cy2);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return { mx, my, angle };
};

const parseBezierPath = (d: string) => {
  const nums = d.match(/-?[\d.]+/g);
  if (!nums) return null;
  if (nums.length >= 8) {
    return nums.slice(0, 8).map(Number) as [number, number, number, number, number, number, number, number];
  }
  if (nums.length >= 4) {
    const [x1, y1, x2, y2] = nums.map(Number);
    return [x1, y1, x1, y1, x2, y2, x2, y2] as [number, number, number, number, number, number, number, number];
  }
  return null;
};

const updateConnectionArrows = () => {
  const svg = document.querySelector(".connections-container") as SVGSVGElement | null;
  if (!svg) return;

  svg.querySelectorAll(".connection-arrow-overlay").forEach((el) => el.remove());
  const nodeRects = Array.from(document.querySelectorAll(".flow-editor-root .baklava-node")).map((nodeEl) =>
    (nodeEl as HTMLElement).getBoundingClientRect()
  );
  const isPointInsideNode = (x: number, y: number) =>
    nodeRects.some((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);

  const paths = svg.querySelectorAll<SVGPathElement>(".baklava-connection");
  paths.forEach((pathEl) => {
    pathEl.removeAttribute("marker-start");
    const d = pathEl.getAttribute("d");
    if (!d) return;
    const coords = parseBezierPath(d);
    if (!coords) return;

    const [x1, y1, cx1, cy1, cx2, cy2, x2, y2] = coords;
    const { mx, my, angle } = bezierMidpoint(x1, y1, cx1, cy1, cx2, cy2, x2, y2);

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    arrow.setAttribute("class", "connection-arrow-overlay");
    arrow.setAttribute("points", "-10,-8 10,0 -10,8");
    arrow.setAttribute("fill", "hsl(152, 76%, 42%)");
    arrow.setAttribute("transform", `translate(${mx},${my}) rotate(${angle})`);
    arrow.style.pointerEvents = "none";
    svg.appendChild(arrow);

    if (isPointInsideNode(mx, my)) {
      pathEl.setAttribute("marker-start", "url(#connection-arrow-start)");
    }
  });
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
      requestAnimationFrame(() => updateConnectionArrows());
    });
  });
};

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

type OutputMeta = {
  title?: string;
  fields?: ResourceFields;
  outputInstance?: ProductInstance | PricedProduct;
};

type ControlMeta = {
  kind: "site" | "hr" | "machine";
  title?: string;
  site?: unknown;
  hr?: Hr;
  machine?: MachineInstance;
};

type ProcessShape = {
  type?: string;
  category?: string;
  name?: string;
  inputInstances: InputInstance[];
  machineInstance?: MachineInstance;
  impacts?: Impact[];
  knowHow?: KnowHow;
  site?: unknown;
  hr?: Hr;
  outputNodes?: OutputMeta[];
  controlNodes?: ControlMeta[];
};

type NodeMeta =
  | { kind: "input"; index: number }
  | { kind: "output-root" }
  | { kind: "output-extra"; index: number }
  | { kind: "machine" }
  | { kind: "site-main" }
  | { kind: "hr-main" }
  | { kind: "control-extra"; index: number }
  | { kind: "knowhow" }
  | { kind: "impact" }
  | { kind: "spawned-output"; parentId: string; index: number }
  | { kind: "spawned-control"; parentId: string; index: number }
  | { kind: "spawned-input"; parentId: string; index: number };

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
  if (!Array.isArray((inst.process as any).outputNodes)) {
    (inst.process as any).outputNodes = [];
  }
  if (!Array.isArray((inst.process as any).controlNodes)) {
    (inst.process as any).controlNodes = [];
  }
  inst.process.type = inst.process.type || "process";
  (inst.process as any).controlNodes = (inst.process as any).controlNodes.filter(
    (item: ControlMeta) => item && (item.kind === "site" || item.kind === "hr" || item.kind === "machine")
  );
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

const nodePositionCache = new Map<string, { x: number; y: number }>();

/** Track spawned (connector-added) process nodes for deletion and anti-stacking */
const spawnedProcessNodes = new Set<string>();
const spawnedProcessChildren = new Map<string, Set<string>>();

/** Pending reconnections saved by clearGraph, consumed by buildGraphFromModel */
const pendingSpawnReconnections: {
  spawnedNodeId: string;
  centralMeta: NodeMeta;
  direction: "central-to-spawned" | "spawned-to-central";
  spawnedPortKey: string | null;
  centralPortKey: string | null;
}[] = [];

const trackSpawnedChild = (parentId: string, childId: string) => {
  let set = spawnedProcessChildren.get(parentId);
  if (!set) {
    set = new Set<string>();
    spawnedProcessChildren.set(parentId, set);
  }
  set.add(childId);
};

const isInteractiveTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, button, option, [contenteditable='true'], .baklava-node-interface")
  );
};

const handleNodePointerDown = (
  event: PointerEvent,
  node: any,
  onStartDrag?: (event: PointerEvent) => void,
  onSelect?: (event?: any) => void,
) => {
  if (!onStartDrag) return;
  if (isInteractiveTarget(event.target)) return;
  /* Ensure the node is in selectedNodes before starting drag –
     Baklava's startDrag iterates selectedNodes array. */
  const selectedNodes = baklava.displayedGraph.selectedNodes as any[];
  if (!selectedNodes.includes(node)) {
    selectedNodes.length = 0;
    selectedNodes.push(node);
  }
  /* Stop propagation so the editor's panZoom handler doesn't start
     a competing drag/pan, which causes the "node follows cursor
     forever" bug. */
  event.stopPropagation();
  onStartDrag(event);
};

const nodeKeyFromMeta = (meta?: NodeMeta) => {
  if (!meta) return null;
  if (meta.kind === "input") return `input:${meta.index}`;
  if (meta.kind === "output-root") return "output-root";
  if (meta.kind === "output-extra") return `output-extra:${meta.index}`;
  if (meta.kind === "machine") return "machine";
  if (meta.kind === "site-main") return "site-main";
  if (meta.kind === "hr-main") return "hr-main";
  if (meta.kind === "control-extra") return `control-extra:${meta.index}`;
  if (meta.kind === "knowhow") return "knowhow";
  if (meta.kind === "impact") return "impact";
  return null;
};

const snapshotNodePositions = () => {
  const graph = baklava.displayedGraph;
  graph.nodes.forEach((node: any) => {
    const key = node.__tmKey as string | undefined;
    if (!key) return;
    nodePositionCache.set(key, { x: node.position.x, y: node.position.y });
  });
};

const applyCachedPosition = (node: any, key: string) => {
  node.__tmKey = key;
  const cached = nodePositionCache.get(key);
  if (!cached) return false;
  node.position.x = cached.x;
  node.position.y = cached.y;
  setNodePosition(node, cached.x, cached.y);
  return true;
};

const isPortraitLayout = () => {
  const bounds = rootEl.value?.getBoundingClientRect();
  const width = bounds?.width ?? window.innerWidth;
  const height = bounds?.height ?? window.innerHeight;
  return height > width;
};

const getNodeSizeForLayout = (node: any, fallback = { width: 440, height: 260 }) => {
  const el = document.getElementById(node.id);
  if (!el) return fallback;
  const rect = el.getBoundingClientRect();
  const scale = baklava.displayedGraph?.scaling || 1;
  return {
    width: rect.width / scale,
    height: rect.height / scale,
  };
};

const rectsOverlap = (
  first: { left: number; top: number; right: number; bottom: number },
  second: { left: number; top: number; right: number; bottom: number }
) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;

const placeNodeAvoidingOverlap = (
  graph: any,
  node: any,
  startX: number,
  startY: number,
  axis: "x" | "y",
  ignoreNodeIds: string[] = []
) => {
  const gap = 24;
  const size = getNodeSizeForLayout(node);
  let x = startX;
  let y = startY;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const nextRect = { left: x, top: y, right: x + size.width, bottom: y + size.height };
    const collides = graph.nodes.some((other: any) => {
      if (!other || other.id === node.id || ignoreNodeIds.includes(other.id)) return false;
      const otherSize = getNodeSizeForLayout(other);
      const otherRect = {
        left: other.position.x,
        top: other.position.y,
        right: other.position.x + otherSize.width,
        bottom: other.position.y + otherSize.height,
      };
      return rectsOverlap(nextRect, otherRect);
    });
    if (!collides) break;
    if (axis === "y") {
      y += size.height + gap;
    } else {
      x += size.width + gap;
    }
  }

  setNodePosition(node, x, y);
};

const isSpawnedProcessNode = (node: any) =>
  Boolean((node as any).__tmSpawned) || spawnedProcessNodes.has((node as any).id);
const isSpawnedResourceNode = (node: any) => {
  const meta = (node as any).__tmMeta as { kind?: string } | undefined;
  return typeof meta?.kind === "string" && meta.kind.startsWith("spawned-");
};

const isSpawnedProcess = (node: any) =>
  Boolean((node as any).__tmSpawned) || spawnedProcessNodes.has((node as any).id);

/** Bumped whenever spawned connections change so template expressions re-evaluate. */
const spawnedConnectionVer = ref(0);

/** True when a spawned process is connected INTO this node's left input ports.
 *  Used to hide the left-side "+" badge (one process per input). */
const nodeHasLeftSpawnedProcess = (node: any): boolean => {
  void spawnedConnectionVer.value; // reactive dependency
  const graph = baklava.displayedGraph as any;
  if (!graph?.connections) return false;
  /* Collect IDs of this node's input (left) ports */
  const inputPortIds = new Set<string>();
  if (node.inputs) {
    Object.values(node.inputs).forEach((intf: any) => {
      if (intf?.id) inputPortIds.add(intf.id);
    });
  }
  if (inputPortIds.size === 0) return false;
  /* Check if any connection targets one of these input ports from a spawned node */
  return graph.connections.some((c: any) => {
    if (!inputPortIds.has(c.to?.id)) return false;
    const fromNode = graph.nodes.find((n: any) => n.id === c.from?.nodeId);
    return fromNode && isSpawnedProcessNode(fromNode);
  });
};

/** True when this central node has ANY spawned process or spawned resource
 *  connected to it (used to hide X delete button). */
const nodeHasSpawnedConnection = (node: any): boolean => {
  void spawnedConnectionVer.value; // reactive dependency
  const graph = baklava.displayedGraph as any;
  if (!graph?.connections) return false;
  const nodeId = node.id;
  const hasSpawned = graph.connections.some((c: any) => {
    const fromNodeId = c.from?.nodeId;
    const toNodeId = c.to?.nodeId;
    if (fromNodeId === nodeId) {
      const otherNode = graph.nodes.find((n: any) => n.id === toNodeId);
      const isSpawned = otherNode && (isSpawnedProcessNode(otherNode) || isSpawnedResourceNode(otherNode));
      if (isSpawned) {
        console.log('nodeHasSpawnedConnection: node', nodeId, 'connected TO spawned node', toNodeId, otherNode?.__tmMeta);
      }
      return isSpawned;
    }
    if (toNodeId === nodeId) {
      const otherNode = graph.nodes.find((n: any) => n.id === fromNodeId);
      const isSpawned = otherNode && (isSpawnedProcessNode(otherNode) || isSpawnedResourceNode(otherNode));
      if (isSpawned) {
        console.log('nodeHasSpawnedConnection: node', nodeId, 'connected FROM spawned node', fromNodeId, otherNode?.__tmMeta);
      }
      return isSpawned;
    }
    return false;
  });
  console.log('nodeHasSpawnedConnection result for', nodeId, (node as any).__tmMeta?.kind, ':', hasSpawned);
  return hasSpawned;
};

const handleAddOutputForNode = (node: any) => {
  if (isSpawnedProcess(node)) {
    addOutputInstanceForProcessNode(node as ProcessNode);
    return;
  }
  addOutputInstance();
};

const handleAddInputForNode = (node: any) => {
  if (isSpawnedProcess(node)) {
    addInputInstanceForProcessNode(node as ProcessNode);
    return;
  }
  addInputInstance();
};

const handleAddMechanismForNode = (node: any) => {
  if (isSpawnedProcess(node)) {
    addControlNodeForProcessNode(node as ProcessNode);
    return;
  }
  addControlNode();
};

const handleDeleteForNode = (node: any) => {
  if (isSpawnedProcess(node)) {
    deleteSpawnedProcess(node);
  }
};

const clearGraph = () => {
  const graph = baklava.displayedGraph as any;
  if (!graph?.removeNode) return;
  snapshotNodePositions();

  /* Preserve spawned nodes: only remove central (non-spawned) nodes.
     Also remove connections that touch any removed (central) node. */
  const nodesToRemove = [...graph.nodes].filter(
    (n: any) => !isSpawnedProcessNode(n) && !isSpawnedResourceNode(n)
  );
  const removedIds = new Set(nodesToRemove.map((n: any) => n.id));

  /* Snapshot how spawned processes are connected to central nodes so we
     can re-establish those connections after rebuild.  Each entry records
     which central-node meta a spawned process was linked to. */
  pendingSpawnReconnections.length = 0;
  graph.connections.forEach((c: any) => {
    const fromId = c.from?.nodeId;
    const toId = c.to?.nodeId;
    if (!fromId || !toId) return;
    /* Central → Spawned (output connector → spawned process input) */
    if (removedIds.has(fromId) && !removedIds.has(toId)) {
      const centralNode = graph.nodes.find((n: any) => n.id === fromId);
      const meta = centralNode?.__tmMeta as NodeMeta | undefined;
      if (meta) {
        const toPortKey = Object.entries((graph.nodes.find((n: any) => n.id === toId) as any)?.inputs ?? {}).find(
          ([, intf]: [string, any]) => intf.id === c.to?.id
        )?.[0];
        pendingSpawnReconnections.push({
          spawnedNodeId: toId,
          centralMeta: meta,
          direction: "central-to-spawned",
          spawnedPortKey: toPortKey ?? null,
          centralPortKey: Object.entries(centralNode?.outputs ?? {}).find(
            ([, intf]: [string, any]) => intf.id === c.from?.id
          )?.[0] ?? null,
        });
      }
    }
    /* Spawned → Central (spawned process output → input node input) */
    if (!removedIds.has(fromId) && removedIds.has(toId)) {
      const centralNode = graph.nodes.find((n: any) => n.id === toId);
      const meta = centralNode?.__tmMeta as NodeMeta | undefined;
      if (meta) {
        const fromPortKey = Object.entries((graph.nodes.find((n: any) => n.id === fromId) as any)?.outputs ?? {}).find(
          ([, intf]: [string, any]) => intf.id === c.from?.id
        )?.[0];
        pendingSpawnReconnections.push({
          spawnedNodeId: fromId,
          centralMeta: meta,
          direction: "spawned-to-central",
          spawnedPortKey: fromPortKey ?? null,
          centralPortKey: Object.entries(centralNode?.inputs ?? {}).find(
            ([, intf]: [string, any]) => intf.id === c.to?.id
          )?.[0] ?? null,
        });
      }
    }
  });

  /* Remove connections touching central nodes */
  const connectionsToRemove = [...graph.connections].filter(
    (c: any) => removedIds.has(c.from?.nodeId) || removedIds.has(c.to?.nodeId)
  );
  connectionsToRemove.forEach((c: any) => graph.removeConnection(c));

  /* Remove central nodes */
  nodesToRemove.forEach((node: any) => graph.removeNode(node));
};

const scheduleLayoutRefresh = () => {
  const delays = [0, 120, 280, 520];
  delays.forEach((delay) => {
    setTimeout(() => {
      autoArrangeNodes();
      refreshConnectionCoords();
    }, delay);
  });
};

const buildGraphFromModel = () => {
  const graph = baklava.displayedGraph;
  const process = ensureProcessWithInputs();
  if (!graph || !process) return;
  const isPortrait = isPortraitLayout();

  clearGraph();

  const processNode = graph.addNode(new ProcessNode());
  if (!processNode) return;
  let hasNewUnpositionedNode = false;
  if (!applyCachedPosition(processNode as any, "process")) {
    hasNewUnpositionedNode = true;
  }
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
        if (!applyCachedPosition(outputNode as any, "output-root")) {
          hasNewUnpositionedNode = true;
        }
    (outputNode as any).__tmMeta = { kind: "output-root" } as NodeMeta;
    (outputNode as any).outputInstance = outputInstance;
    (outputNode as any).onOutputUpdate = (next: ProductInstance | PricedProduct) => {
      value.value.instance = next as any;
    };
    outputNode.title = outputLabel(outputInstance);

    const outputPort = processNode.addOutputPort("Output 1", "right");
    const outputInput = Object.values(outputNode.inputs)[0];
    if (outputPort && outputInput) graph.addConnection(outputPort, outputInput);
  }

  process.outputNodes = process.outputNodes || [];
  process.outputNodes.forEach((meta, index) => {
    const extraNode = graph.addNode(new ResourceNode("output"));
    if (!extraNode) return;
    (extraNode as any).__tmMeta = { kind: "output-extra", index } as NodeMeta;
    if (!applyCachedPosition(extraNode as any, `output-extra:${index}`)) {
      hasNewUnpositionedNode = true;
    }
    (extraNode as any).outputInstance = meta.outputInstance;
    (extraNode as any).onOutputUpdate = (next: ProductInstance | PricedProduct) => {
      meta.outputInstance = next;
    };
    (extraNode as any).fields = meta.fields || {};
    (extraNode as any).onFieldsUpdate = (fields: ResourceFields) => {
      meta.fields = { ...fields };
    };
    (extraNode as any).onTitleUpdate = (title: string) => {
      meta.title = title;
    };
    extraNode.title = meta.title || `Output ${index + 2}`;

    const extraPort = processNode.addOutputPort(`Output ${index + 2}`, "right");
    const extraInput = Object.values(extraNode.inputs)[0];
    if (extraPort && extraInput) graph.addConnection(extraPort, extraInput);
  });

  if (process.machineInstance) {
    const machineNode = graph.addNode(new ResourceNode("machine"));
    if (machineNode) {
      (machineNode as any).__tmMeta = { kind: "machine" } as NodeMeta;
      if (!applyCachedPosition(machineNode as any, "machine")) {
        hasNewUnpositionedNode = true;
      }
      (machineNode as any).machineInstance = process.machineInstance;
      (machineNode as any).controlKind = "machine";
      (machineNode as any).onMachineUpdate = (next: MachineInstance) => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        target.machineInstance = next;
      };
      (machineNode as any).onControlKindUpdate = (next: "site" | "hr" | "machine") => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        if (next === "site") {
          target.site = target.site || clone(defaultSite);
          target.machineInstance = undefined;
        }
        if (next === "hr") {
          target.hr = target.hr || clone(defaultHr);
          target.machineInstance = undefined;
        }
        if (next === "machine") {
          target.machineInstance = target.machineInstance || clone(defaultMachineInstance);
        }
        buildGraphFromModel();
      };
      machineNode.title = "Machine";

      const machinePort = processNode.addInputPort("Machine", isPortrait ? "right" : "bottom");
      const machineOutput = Object.values(machineNode.outputs)[0];
      if (machinePort && machineOutput) graph.addConnection(machineOutput, machinePort);
    }
  }

  process.inputInstances.forEach((input, index) => {
    const inputNode = graph.addNode(new ResourceNode("input"));
    if (!inputNode) return;
    (inputNode as any).__tmMeta = { kind: "input", index } as NodeMeta;
    if (!applyCachedPosition(inputNode as any, `input:${index}`)) {
      hasNewUnpositionedNode = true;
    }
    (inputNode as any).inputInstance = input;
    (inputNode as any).onInputUpdate = (next: InputInstance) => {
      process.inputInstances.splice(index, 1, next);
    };
    inputNode.title = inputLabel(input, index);

    const inputPort = processNode.addInputPort(`Input ${index + 1}`, isPortrait ? "top" : "left");
    const inputOutput = Object.values(inputNode.outputs)[0];
    if (inputOutput && inputPort) graph.addConnection(inputOutput, inputPort);
  });

  if (process.impacts !== undefined) {
    const impactNode = graph.addNode(new ResourceNode("impact"));
    if (impactNode) {
      (impactNode as any).__tmMeta = { kind: "impact" } as NodeMeta;
      if (!applyCachedPosition(impactNode as any, "impact")) {
        hasNewUnpositionedNode = true;
      }
      (impactNode as any).impacts = process.impacts || [];
      (impactNode as any).onImpactsUpdate = (next: Impact[] | undefined) => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        target.impacts = next;
      };
      impactNode.title = "Impacts";
      const impactPort = isPortrait
        ? processNode.addOutputPort("Impacts", "left")
        : processNode.addImpactPort("Impacts");
      const impactInput = Object.values(impactNode.inputs)[0];
      if (impactPort && impactInput) graph.addConnection(impactPort, impactInput);
    }
  }

  if (process.knowHow !== undefined) {
    const knowHowNode = graph.addNode(new ResourceNode("knowhow"));
    if (knowHowNode) {
      (knowHowNode as any).__tmMeta = { kind: "knowhow" } as NodeMeta;
      if (!applyCachedPosition(knowHowNode as any, "knowhow")) {
        hasNewUnpositionedNode = true;
      }
      (knowHowNode as any).knowHow = process.knowHow;
      (knowHowNode as any).onKnowHowUpdate = (next?: KnowHow) => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        target.knowHow = next;
      };
      knowHowNode.title = "KnowHow";
      const knowHowPort = processNode.addInputPort("KnowHow", "top");
      const knowHowOutput = Object.values(knowHowNode.outputs)[0];
      if (knowHowPort && knowHowOutput) graph.addConnection(knowHowOutput, knowHowPort);
    }
  }

  if (process.site !== undefined) {
    const siteNode = graph.addNode(new ResourceNode("site"));
    if (siteNode) {
      (siteNode as any).__tmMeta = { kind: "site-main" } as NodeMeta;
      if (!applyCachedPosition(siteNode as any, "site-main")) {
        hasNewUnpositionedNode = true;
      }
      (siteNode as any).site = process.site;
      (siteNode as any).onSiteUpdate = (next?: unknown) => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        target.site = next;
      };
      (siteNode as any).controlKind = "site";
      (siteNode as any).onControlKindUpdate = (next: "site" | "hr" | "machine") => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        if (next === "site") {
          target.site = target.site || clone(defaultSite);
        }
        if (next === "hr") {
          target.hr = target.hr || clone(defaultHr);
          target.site = undefined;
        }
        if (next === "machine") {
          target.machineInstance = target.machineInstance || clone(defaultMachineInstance);
          target.site = undefined;
        }
        buildGraphFromModel();
      };
      siteNode.title = "Site";
      const sitePort = processNode.addInputPort("Site", isPortrait ? "right" : "bottom");
      const siteOutput = Object.values(siteNode.outputs)[0];
      if (sitePort && siteOutput) graph.addConnection(siteOutput, sitePort);
    }
  }

  if (process.hr !== undefined) {
    const hrNode = graph.addNode(new ResourceNode("hr"));
    if (hrNode) {
      (hrNode as any).__tmMeta = { kind: "hr-main" } as NodeMeta;
      if (!applyCachedPosition(hrNode as any, "hr-main")) {
        hasNewUnpositionedNode = true;
      }
      (hrNode as any).hr = process.hr;
      (hrNode as any).onHrUpdate = (next?: Hr) => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        target.hr = next;
      };
      (hrNode as any).controlKind = "hr";
      (hrNode as any).onControlKindUpdate = (next: "site" | "hr" | "machine") => {
        const target = ensureProcessWithInputs();
        if (!target) return;
        if (next === "site") {
          target.site = target.site || clone(defaultSite);
          target.hr = undefined;
        }
        if (next === "hr") {
          target.hr = target.hr || clone(defaultHr);
        }
        if (next === "machine") {
          target.machineInstance = target.machineInstance || clone(defaultMachineInstance);
          target.hr = undefined;
        }
        buildGraphFromModel();
      };
      hrNode.title = "Hr";
      const hrPort = processNode.addInputPort("Hr", isPortrait ? "right" : "bottom");
      const hrOutput = Object.values(hrNode.outputs)[0];
      if (hrPort && hrOutput) graph.addConnection(hrOutput, hrPort);
    }
  }

  process.controlNodes = process.controlNodes || [];
  process.controlNodes.forEach((meta, index) => {
    const extraControl = graph.addNode(new ResourceNode(meta.kind));
    if (!extraControl) return;
    (extraControl as any).__tmMeta = { kind: "control-extra", index } as NodeMeta;
    if (!applyCachedPosition(extraControl as any, `control-extra:${index}`)) {
      hasNewUnpositionedNode = true;
    }
    if (meta.kind === "site") {
      (extraControl as any).site = meta.site;
      (extraControl as any).controlKind = "site";
      (extraControl as any).onSiteUpdate = (next?: unknown) => {
        meta.site = next;
      };
    }
    if (meta.kind === "hr") {
      (extraControl as any).hr = meta.hr;
      (extraControl as any).controlKind = "hr";
      (extraControl as any).onHrUpdate = (next?: Hr) => {
        meta.hr = next;
      };
    }
    if (meta.kind === "machine") {
      (extraControl as any).machineInstance = meta.machine || clone(defaultMachineInstance);
      (extraControl as any).controlKind = "machine";
      (extraControl as any).onMachineUpdate = (next: MachineInstance) => {
        meta.machine = next;
      };
    }
    (extraControl as any).onControlKindUpdate = (next: "site" | "hr" | "machine") => {
      meta.kind = next;
      if (next === "site") {
        meta.site = meta.site || clone(defaultSite);
        meta.hr = undefined;
        meta.machine = undefined;
      } else {
        if (next === "hr") {
          meta.hr = meta.hr || clone(defaultHr);
          meta.site = undefined;
          meta.machine = undefined;
        }
        if (next === "machine") {
          meta.machine = meta.machine || clone(defaultMachineInstance);
          meta.site = undefined;
          meta.hr = undefined;
        }
      }
      buildGraphFromModel();
    };
    extraControl.title = meta.title || `${meta.kind === "site" ? "Site" : meta.kind === "hr" ? "Hr" : "Machine"} ${index + 2}`;

    const controlPort = processNode.addInputPort(extraControl.title, isPortrait ? "right" : "bottom");
    const controlOutput = Object.values(extraControl.outputs)[0];
    if (controlPort && controlOutput) graph.addConnection(controlOutput, controlPort);
  });

  /* Reconnect spawned processes that were preserved across clearGraph */
  if (pendingSpawnReconnections.length > 0) {
    const allNodes = [...graph.nodes];
    const metaKey = (m: NodeMeta) => `${m.kind}:${"index" in m ? m.index : ""}`;
    const nodeByMeta = new Map<string, any>();
    for (const n of allNodes) {
      const m = (n as any).__tmMeta as NodeMeta | undefined;
      if (m) nodeByMeta.set(metaKey(m), n);
    }
    for (const rec of pendingSpawnReconnections) {
      const centralNode = nodeByMeta.get(metaKey(rec.centralMeta));
      const spawnedNode = allNodes.find((n: any) => n.id === rec.spawnedNodeId);
      if (!centralNode || !spawnedNode) continue;

      try {
        if (rec.direction === "central-to-spawned") {
          /* Central output port → spawned input port */
          const fromIntf = rec.centralPortKey
            ? (centralNode.outputs as any)?.[rec.centralPortKey]
            : Object.values(centralNode.outputs ?? {})[0];
          const toIntf = rec.spawnedPortKey
            ? (spawnedNode.inputs as any)?.[rec.spawnedPortKey]
            : Object.values(spawnedNode.inputs ?? {})[0];
          if (fromIntf && toIntf) graph.addConnection(fromIntf, toIntf);
        } else {
          /* Spawned output port → central input port.
             The central input ResourceNode may not have a left-side input
             port after rebuild — recreate it if needed. */
          const fromIntf = rec.spawnedPortKey
            ? (spawnedNode.outputs as any)?.[rec.spawnedPortKey]
            : Object.values(spawnedNode.outputs ?? {})[0];

          let toIntf = rec.centralPortKey
            ? (centralNode.inputs as any)?.[rec.centralPortKey]
            : null;

          /* If input ResourceNode has no matching left port, add one */
          if (!toIntf && typeof centralNode.addInputPort === "function") {
            toIntf = centralNode.addInputPort("Source", "left");
          }

          if (fromIntf && toIntf) graph.addConnection(fromIntf, toIntf);
        }
      } catch (e) {
        console.warn("[FlowEditor] Failed to reconnect spawned node", rec, e);
      }
    }
    pendingSpawnReconnections.length = 0;
  }

  /* When spawned nodes exist, do NOT run the full auto-arrange (it resets
     ALL central positions and causes overlaps).  Instead, position only
     the unpositioned central nodes smartly, then refresh connections. */
  if (hasNewUnpositionedNode && spawnedProcessNodes.size > 0) {
    const allGraphNodes = [...graph.nodes];
    const isPortrait2 = isPortraitLayout();

    allGraphNodes.forEach((n: any) => {
      const key = n.__tmKey as string | undefined;
      if (!key) return;
      if (nodePositionCache.has(key)) return; // already positioned
      if (isSpawnedProcessNode(n) || isSpawnedResourceNode(n)) return;

      const meta = n.__tmMeta as NodeMeta | undefined;
      if (!meta) return;

      /* Determine the x/y lane for this node's type */
      let startX = processNode.position.x;
      let startY = processNode.position.y;
      const nodeSize = getNodeSizeForLayout(n);
      const processSize = getNodeSizeForLayout(processNode);

      if (meta.kind === "input") {
        startX = processNode.position.x - nodeSize.width - 120;
        /* Find lowest Y of same-lane central inputs + all spawned nodes */
        let lowestY = processNode.position.y;
        allGraphNodes.forEach((other: any) => {
          if (other === n) return;
          const oMeta = other.__tmMeta as NodeMeta | undefined;
          const isSameLane = oMeta?.kind === "input";
          const isSpawned = isSpawnedProcessNode(other) || isSpawnedResourceNode(other);
          if (!isSameLane && !isSpawned) return;
          const oSize = getNodeSizeForLayout(other);
          const bot = (other.position?.y ?? 0) + oSize.height;
          if (bot > lowestY) lowestY = bot;
        });
        startY = lowestY + 24;
      } else if (meta.kind === "output-extra") {
        startX = processNode.position.x + processSize.width + 120;
        let lowestY = processNode.position.y;
        allGraphNodes.forEach((other: any) => {
          if (other === n) return;
          const oMeta = other.__tmMeta as NodeMeta | undefined;
          const isOutputLane = oMeta?.kind === "output-root" || oMeta?.kind === "output-extra";
          const isSpawned = isSpawnedProcessNode(other) || isSpawnedResourceNode(other);
          if (!isOutputLane && !isSpawned) return;
          const oSize = getNodeSizeForLayout(other);
          const bot = (other.position?.y ?? 0) + oSize.height;
          if (bot > lowestY) lowestY = bot;
        });
        startY = lowestY + 24;
      } else if (meta.kind === "control-extra" || meta.kind === "machine"
                 || meta.kind === "site-main" || meta.kind === "hr-main") {
        startY = processNode.position.y + processSize.height + 40;
      } else {
        startX = processNode.position.x;
        startY = processNode.position.y - nodeSize.height - 80;
      }

      placeNodeAvoidingOverlap(graph, n, startX, startY, isPortrait2 ? "x" : "y", [processNode.id]);
      nodePositionCache.set(key, { x: n.position.x, y: n.position.y });
    });
    hasNewUnpositionedNode = false;
  }

  spawnedConnectionVer.value++;

  nextTick(() => {
    if (hasNewUnpositionedNode) {
      scheduleLayoutRefresh();
    } else {
      refreshConnectionCoords();
    }
  });
};

const autoArrangeNodes = () => {
  const graph = baklava.displayedGraph;
  const nodes = graph.nodes;
  if (nodes.length === 0) return;

  /* Safety net: save every spawned-process position so that nothing below
     can accidentally move them (e.g. indirect reactive cascades). */
  const savedSpawnedPositions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n: any) => {
    if (isSpawnedProcessNode(n) || isSpawnedResourceNode(n)) {
      savedSpawnedPositions.set(n.id, { x: n.position?.x ?? 0, y: n.position?.y ?? 0 });
    }
  });

  const processNode = nodes.find(
    (node: any) => node.type === "ProcessNode" && !isSpawnedProcessNode(node)
  ) as ProcessNode | undefined;
  if (!processNode) return;
  const inputNodes = nodes.filter(
    (node: any) =>
      node.type === "ResourceNode" &&
      (node as any).resourceType === "input" &&
      !isSpawnedResourceNode(node)
  ) as ResourceNode[];
  const outputNodes = nodes.filter(
    (node: any) =>
      node.type === "ResourceNode" &&
      (node as any).resourceType === "output" &&
      !isSpawnedResourceNode(node)
  ) as ResourceNode[];
  const machineNodes = nodes.filter(
    (node: any) =>
      node.type === "ResourceNode" &&
      (node as any).resourceType === "machine" &&
      !isSpawnedResourceNode(node)
  ) as ResourceNode[];
  const controlNodes = nodes.filter(
    (node: any) =>
      node.type === "ResourceNode" &&
      ((node as any).resourceType === "site" || (node as any).resourceType === "hr") &&
      !isSpawnedResourceNode(node)
  ) as ResourceNode[];
  const impactNodes = nodes.filter(
    (node: any) =>
      node.type === "ResourceNode" &&
      (node as any).resourceType === "impact" &&
      !isSpawnedResourceNode(node)
  ) as ResourceNode[];
  const knowHowNodes = nodes.filter(
    (node: any) =>
      node.type === "ResourceNode" &&
      (node as any).resourceType === "knowhow" &&
      !isSpawnedResourceNode(node)
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

    const isPortrait = viewHeight > viewWidth;
    const rowGap = 24;
    const colGap = 24;

    const placeRow = (nodesToPlace: ResourceNode[], rowY: number) => {
      if (nodesToPlace.length === 0) return;
      const sizes = nodesToPlace.map((node) => getNodeSize(node, { width: 440, height: 260 }));
      const totalWidth = sizes.reduce((sum, item) => sum + item.width, 0) + Math.max(0, nodesToPlace.length - 1) * rowGap;
      let currentX = centerX - totalWidth / 2;
      nodesToPlace.forEach((node, index) => {
        const nodeSize = sizes[index];
        setPos(node, currentX, rowY);
        currentX += nodeSize.width + rowGap;
      });
    };

    const placeColumn = (nodesToPlace: ResourceNode[], colX: number, startY: number) => {
      if (nodesToPlace.length === 0) return;
      let currentY = startY;
      nodesToPlace.forEach((node) => {
        const nodeSize = getNodeSize(node, { width: 440, height: 260 });
        setPos(node, colX, currentY);
        currentY += nodeSize.height + colGap;
      });
    };

    if (isPortrait) {
      const inputMaxHeight = inputNodes.length > 0
        ? Math.max(...inputNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }).height))
        : 0;
      placeRow(inputNodes, y - 120 - inputMaxHeight);

      placeColumn(outputNodes, x + size.width + 120, y);

      if (knowHowNodes.length > 0) {
        const knowHowSize = getNodeSize(knowHowNodes[0], { width: 440, height: 260 });
        setPos(knowHowNodes[0], centerX - knowHowSize.width / 2, y - knowHowSize.height - 80);
      }

      if (impactNodes.length > 0) {
        const impactSize = getNodeSize(impactNodes[0], { width: 440, height: 260 });
        setPos(impactNodes[0], x - impactSize.width - 120, centerY - impactSize.height / 2);
      }

      placeRow(controlNodes, y + size.height + 40);

      if (machineNodes.length > 0) {
        const hasControls = controlNodes.length > 0;
        const controlsHeight = hasControls
          ? Math.max(...controlNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }).height))
          : 0;
        const machineY = y + size.height + 40 + (hasControls ? controlsHeight + 40 : 0);
        placeRow(machineNodes, machineY);
      }
    } else {
      const inputSizes = inputNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }));
      const outputSizes = outputNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }));
      const inputTotalHeight =
        inputSizes.reduce((sum, item) => sum + item.height, 0) + Math.max(0, inputNodes.length - 1) * colGap;
      const outputTotalHeight =
        outputSizes.reduce((sum, item) => sum + item.height, 0) + Math.max(0, outputNodes.length - 1) * colGap;

      /* Place inputs on the left, accounting for spawned chains.
         After placing each input node, find the lowest spawned node
         connected to it (directly or transitively) and ensure the next
         input starts below that bounding box. */
      const spawnedNodesArr = nodes.filter(
        (n: any) => isSpawnedProcessNode(n) || isSpawnedResourceNode(n)
      );

      /** Return the bottom-most Y coordinate of any spawned node connected
       *  (directly) to the given central input node. */
      const spawnedChainBottom = (centralNode: any): number => {
        let bottom = -Infinity;
        const centralId = centralNode.id;
        /* Collect spawned nodes directly connected to this central node */
        const directConnected = new Set<string>();
        (graph.connections as any[]).forEach((c: any) => {
          if (c.from?.nodeId === centralId || c.to?.nodeId === centralId) {
            const otherId = c.from?.nodeId === centralId ? c.to?.nodeId : c.from?.nodeId;
            if (otherId) directConnected.add(otherId);
          }
        });
        /* Expand to spawned children transitively */
        const visited = new Set<string>();
        const queue = [...directConnected];
        while (queue.length > 0) {
          const id = queue.pop()!;
          if (visited.has(id)) continue;
          visited.add(id);
          const childIds = spawnedProcessChildren.get(id);
          if (childIds) childIds.forEach((cid) => queue.push(cid));
        }
        for (const sn of spawnedNodesArr) {
          if (!visited.has(sn.id) && !directConnected.has(sn.id)) continue;
          const sr = getNodeSize(sn, { width: 440, height: 260 });
          const sb = ((sn as any).position?.y ?? 0) + sr.height;
          if (sb > bottom) bottom = sb;
        }
        return bottom;
      };

      let inputY = centerY - inputTotalHeight / 2;
      inputNodes.forEach((node, index) => {
        const nodeSize = inputSizes[index];
        setPos(node, x - nodeSize.width - 120, inputY);
        /* Advance Y past the node itself */
        let nextY = inputY + nodeSize.height + colGap;
        /* If this node has spawned chains, ensure next node starts below them */
        const chainBottom = spawnedChainBottom(node);
        if (chainBottom > nextY) {
          nextY = chainBottom + colGap;
        }
        inputY = nextY;
      });

      let outputY = centerY - outputTotalHeight / 2;
      outputNodes.forEach((node, index) => {
        const nodeSize = outputSizes[index];
        setPos(node, x + size.width + 120, outputY);
        let nextOY = outputY + nodeSize.height + colGap;
        const chainBot = spawnedChainBottom(node);
        if (chainBot > nextOY) {
          nextOY = chainBot + colGap;
        }
        outputY = nextOY;
      });

      if (knowHowNodes.length > 0) {
        const knowHowSize = getNodeSize(knowHowNodes[0], { width: 440, height: 260 });
        setPos(knowHowNodes[0], centerX - knowHowSize.width / 2, y - knowHowSize.height - 80);
      }

      if (impactNodes.length > 0) {
        const impactSize = getNodeSize(impactNodes[0], { width: 440, height: 260 });
        setPos(impactNodes[0], x - impactSize.width - 120, y - impactSize.height - 20);
      }

      placeRow(controlNodes, y + size.height + 40);

      if (machineNodes.length > 0) {
        const hasControls = controlNodes.length > 0;
        const controlsHeight = hasControls
          ? Math.max(...controlNodes.map((node) => getNodeSize(node, { width: 440, height: 260 }).height))
          : 0;
        const machineY = y + size.height + 40 + (hasControls ? controlsHeight + 40 : 0);
        placeRow(machineNodes, machineY);
      }
    }

    const resolveOverlaps = () => {
      const spacing = 24;
      const movable = nodes.filter(
        (node: any) => !isSpawnedProcessNode(node) && !isSpawnedResourceNode(node)
      );
      const getRect = (node: any) => {
        const nodeSize = getNodeSize(node, { width: 440, height: 260 });
        return {
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + nodeSize.width,
          bottom: node.position.y + nodeSize.height,
        };
      };

      for (let pass = 0; pass < 4; pass += 1) {
        for (let i = 0; i < movable.length; i += 1) {
          for (let j = i + 1; j < movable.length; j += 1) {
            const a = movable[i] as any;
            const b = movable[j] as any;
            const ra = getRect(a);
            const rb = getRect(b);
            const overlapX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const overlapY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const shiftX = overlapX / 2 + spacing;
            const shiftY = overlapY / 2 + spacing;
            const isProcessA = a.type === "ProcessNode";
            const isProcessB = b.type === "ProcessNode";

            if (isProcessA && !isProcessB) {
              setPos(b, b.position.x + shiftX, b.position.y + shiftY);
              continue;
            }
            if (!isProcessA && isProcessB) {
              setPos(a, a.position.x - shiftX, a.position.y - shiftY);
              continue;
            }

            setPos(a, a.position.x - shiftX, a.position.y - shiftY);
            setPos(b, b.position.x + shiftX, b.position.y + shiftY);
          }
        }
      }

      const processRect = {
        left: processNode.position.x,
        top: processNode.position.y,
        right: processNode.position.x + size.width,
        bottom: processNode.position.y + size.height,
      };

      const inflate = 28;
      const expanded = {
        left: processRect.left - inflate,
        top: processRect.top - inflate,
        right: processRect.right + inflate,
        bottom: processRect.bottom + inflate,
      };

      const intersects = (nodeRect: { left: number; top: number; right: number; bottom: number }) =>
        !(nodeRect.right <= expanded.left || nodeRect.left >= expanded.right || nodeRect.bottom <= expanded.top || nodeRect.top >= expanded.bottom);

      const sideForNode = (node: any): "left" | "right" | "top" | "bottom" => {
        const resourceType = (node as any).resourceType;
        if (resourceType === "knowhow") return "top";
        if (resourceType === "output") return "right";
        if (isPortrait) {
          if (resourceType === "input") return "top";
          if (resourceType === "impact") return "left";
          return "bottom";
        }
        if (resourceType === "input") return "left";
        if (resourceType === "impact") return "top";
        return "bottom";
      };

      movable.forEach((node) => {
        if ((node as any).type === "ProcessNode") return;
        const rect = getRect(node as any);
        if (!intersects(rect)) return;

        const lane = sideForNode(node as any);
        const nodeSize = getNodeSize(node as any, { width: 440, height: 260 });
        if (lane === "left") {
          setPos(node as any, expanded.left - nodeSize.width - 20, (node as any).position.y);
          return;
        }
        if (lane === "right") {
          setPos(node as any, expanded.right + 20, (node as any).position.y);
          return;
        }
        if (lane === "top") {
          setPos(node as any, (node as any).position.x, expanded.top - nodeSize.height - 20);
          return;
        }
        setPos(node as any, (node as any).position.x, expanded.bottom + 20);
      });

      const lanePriority = (node: any): number => {
        const lane = sideForNode(node);
        if (lane === "left") return 0;
        if (lane === "top") return 1;
        if (lane === "right") return 2;
        return 3;
      };

      const moveByLane = (node: any, shiftX: number, shiftY: number) => {
        const lane = sideForNode(node);
        if (lane === "left" || lane === "right") {
          setPos(node, node.position.x, node.position.y + shiftY);
          return;
        }
        setPos(node, node.position.x + shiftX, node.position.y);
      };

      const nonProcess = movable.filter((node: any) => node.type !== "ProcessNode");
      for (let pass = 0; pass < 8; pass += 1) {
        nonProcess.sort((first: any, second: any) => {
          const laneDelta = lanePriority(first) - lanePriority(second);
          if (laneDelta !== 0) return laneDelta;
          if (Math.abs(first.position.y - second.position.y) > 1) return first.position.y - second.position.y;
          return first.position.x - second.position.x;
        });

        let changed = false;
        for (let i = 0; i < nonProcess.length; i += 1) {
          for (let j = i + 1; j < nonProcess.length; j += 1) {
            const first = nonProcess[i] as any;
            const second = nonProcess[j] as any;
            const firstRect = getRect(first);
            const secondRect = getRect(second);
            const overlapX = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
            const overlapY = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
            if (overlapX <= 0 || overlapY <= 0) continue;

            const shiftX = overlapX + spacing;
            const shiftY = overlapY + spacing;
            moveByLane(second, shiftX, shiftY);
            changed = true;
          }
        }
        if (!changed) break;
      }
    };

    resolveOverlaps();
  }

  /* Restore every spawned-process / spawned-resource position so that
     no reactive side-effect of the central layout can move them. */
  savedSpawnedPositions.forEach((pos, id) => {
    const n = graph.nodes.find((nd: any) => nd.id === id) as any;
    if (n) {
      n.position.x = pos.x;
      n.position.y = pos.y;
      setNodePosition(n, pos.x, pos.y);
    }
  });

  /* After restoring spawned positions, push central nodes that now overlap
     with spawned nodes so they don't stack on top of each other. */
  if (savedSpawnedPositions.size > 0) {
    const spacing = 24;
    const movable = nodes.filter(
      (n: any) => !isSpawnedProcessNode(n) && !isSpawnedResourceNode(n)
    );
    const spawned = nodes.filter(
      (n: any) => isSpawnedProcessNode(n) || isSpawnedResourceNode(n)
    );

    const getRect = (node: any) => {
      const el = document.getElementById((node as any).id);
      const scale = graph.scaling || 1;
      const fallback = { width: 440, height: 260 };
      const sz = el
        ? { width: el.getBoundingClientRect().width / scale, height: el.getBoundingClientRect().height / scale }
        : fallback;
      return {
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + sz.width,
        bottom: node.position.y + sz.height,
      };
    };

    for (let pass = 0; pass < 6; pass += 1) {
      let changed = false;
      for (const cNode of movable) {
        if ((cNode as any).type === "ProcessNode") continue;
        const cr = getRect(cNode);
        for (const sNode of spawned) {
          const sr = getRect(sNode);
          const overlapX = Math.min(cr.right, sr.right) - Math.max(cr.left, sr.left);
          const overlapY = Math.min(cr.bottom, sr.bottom) - Math.max(cr.top, sr.top);
          if (overlapX <= 0 || overlapY <= 0) continue;

          /* Push the central node away from the spawned node along the
             shorter overlap axis, biasing by which side the central node sits on. */
          const shiftY = overlapY + spacing;
          const midC = (cr.top + cr.bottom) / 2;
          const midS = (sr.top + sr.bottom) / 2;
          const dir = midC >= midS ? 1 : -1;
          setNodePosition(cNode as any, (cNode as any).position.x, (cNode as any).position.y + dir * shiftY);
          (cNode as any).position.y += dir * shiftY;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }
};

const addInputInstance = () => {
  const process = ensureProcessWithInputs();
  if (!process) return;
  process.inputInstances.push(clone(defaultLocalInputInstance));
  buildGraphFromModel();
};

/** Add an input ResourceNode to a spawned process (positioned to the left). */
const addInputInstanceForProcessNode = (node: ProcessNode) => {
  const graph = baklava.displayedGraph;
  if (!graph) return;
  const process = (node as any).process as ProcessShape | undefined;
  if (!process) return;
  process.inputInstances = process.inputInstances || [];
  const nextInput = clone(defaultLocalInputInstance);
  process.inputInstances.push(nextInput);
  const nextIndex = process.inputInstances.length;

  const inputNode = graph.addNode(new ResourceNode("input"));
  if (!inputNode) return;
  (inputNode as any).__tmMeta = { kind: "spawned-input", parentId: node.id, index: nextIndex - 1 } as NodeMeta;
  (inputNode as any).inputInstance = nextInput;
  (inputNode as any).onInputUpdate = (next: InputInstance) => {
    process.inputInstances.splice(nextIndex - 1, 1, next);
  };
  (inputNode as any).onTitleUpdate = (title: string) => {
    inputNode.title = title;
  };
  inputNode.title = inputLabel(nextInput, nextIndex - 1);

  const isPortrait = isPortraitLayout();
  const inputPort = node.addInputPort(`Input ${nextIndex}`, isPortrait ? "top" : "left");
  const inputOutput = Object.values(inputNode.outputs)[0];
  if (inputOutput && inputPort) graph.addConnection(inputOutput, inputPort);

  /* Position to the LEFT of the spawned process, stacking downward */
  const baseX = (node as any).position?.x ?? 0;
  const baseY = (node as any).position?.y ?? 0;
  const inputSize = getNodeSizeForLayout(inputNode);
  const colGap = 24;
  const offsetX = -(inputSize.width + 120);
  const offsetY = (nextIndex - 1) * (inputSize.height + colGap);
  placeNodeAvoidingOverlap(graph, inputNode, baseX + offsetX, baseY + offsetY, "y", [node.id]);
  trackSpawnedChild(node.id, inputNode.id);

  nextTick(() => refreshConnectionCoords());
};

const addOutputInstance = () => {
  const process = ensureProcessWithInputs();
  if (!process) return;
  process.outputNodes = process.outputNodes || [];
  const rootOutput = value.value.instance as ProductInstance | PricedProduct | undefined;
  process.outputNodes.push({
    title: `Output ${process.outputNodes.length + 2}`,
    fields: { outputKg: 1, destination: "" },
    outputInstance: rootOutput ? clone(rootOutput) : undefined,
  });
  buildGraphFromModel();
};

const addOutputInstanceForProcessNode = (node: ProcessNode) => {
  const graph = baklava.displayedGraph;
  if (!graph) return;
  const process = (node as any).process as ProcessShape | undefined;
  if (!process) return;
  const spawnTemplate = (node as any).__tmSpawnTemplate as OutputMeta | undefined;
  process.outputNodes = process.outputNodes || [];
  const nextIndex = process.outputNodes.length + 1;
  const outputMeta = {
    title: `Output ${nextIndex}`,
    fields: spawnTemplate?.fields ? clone(spawnTemplate.fields) : { outputKg: 1, destination: "" },
    outputInstance: spawnTemplate?.outputInstance ? clone(spawnTemplate.outputInstance) : undefined,
  } as OutputMeta;
  process.outputNodes.push(outputMeta);

  const outputNode = graph.addNode(new ResourceNode("output"));
  if (!outputNode) return;
  (outputNode as any).__tmMeta = { kind: "spawned-output", parentId: node.id, index: nextIndex - 1 } as NodeMeta;
  (outputNode as any).outputInstance = outputMeta.outputInstance;
  (outputNode as any).onOutputUpdate = (next: ProductInstance | PricedProduct) => {
    outputMeta.outputInstance = next;
  };
  (outputNode as any).fields = outputMeta.fields || {};
  (outputNode as any).onFieldsUpdate = (fields: ResourceFields) => {
    outputMeta.fields = { ...fields };
  };
  (outputNode as any).onTitleUpdate = (title: string) => {
    outputMeta.title = title;
  };
  outputNode.title = outputMeta.title || `Output ${nextIndex}`;

  const outputPort = node.addOutputPort(`Output ${nextIndex}`, "right");
  const outputInput = Object.values(outputNode.inputs)[0];
  if (outputPort && outputInput) graph.addConnection(outputPort, outputInput);

  const baseX = (node as any).position?.x ?? 0;
  const baseY = (node as any).position?.y ?? 0;
  const processSize = getNodeSizeForLayout(node);
  const outputSize = getNodeSizeForLayout(outputNode);
  const colGap = 24;
  const offsetX = processSize.width + 120;
  const offsetY = (nextIndex - 1) * (outputSize.height + colGap);
  placeNodeAvoidingOverlap(graph, outputNode, baseX + offsetX, baseY + offsetY, "y", [node.id]);
  trackSpawnedChild(node.id, outputNode.id);

  /* Only refresh connection visuals – never re-run central auto-arrange
     when mutating spawned-process children, otherwise the central layout
     engine can indirectly shift the spawned process position. */
  nextTick(() => refreshConnectionCoords());
};

const addProcessFromOutputConnector = (node: ResourceNode, intf: NodeInterface<unknown>) => {
  if ((node as any).resourceType !== "output") return;
  const graph = baklava.displayedGraph;
  if (!graph) return;

  /* Create a full ProcessNode with initial process data so it renders
     identically to the central process (Idef0Node with all fields). */
  const nextProcess = graph.addNode(new ProcessNode());
  if (!nextProcess) return;
    /* Mark as spawned immediately, before any new connection events trigger
      auto-arrange, so this node is never mistaken for the central process. */
    spawnedProcessNodes.add(nextProcess.id);
    (nextProcess as any).__tmSpawned = true;

  const newProcessData = {
    type: "process",
    category: "process",
    name: undefined,
    inputInstances: [],
    outputNodes: [],
    controlNodes: [],
  } as any;

  (nextProcess as any).process = newProcessData;
  (nextProcess as any).__tmSpawnTemplate = {
    outputInstance: (node as any).outputInstance ? clone((node as any).outputInstance) : undefined,
    fields: (node as any).fields ? clone((node as any).fields) : undefined,
  } as OutputMeta;
  (nextProcess as any).onProcessUpdate = (next: ProcessShape) => {
    Object.assign(newProcessData, next);
  };
  nextProcess.title = "Process";

  const isPortrait = isPortraitLayout();
  /* Connect from Output's right-side output port → new Process left/top input */
  const inputPort = nextProcess.addInputPort("Input 1", isPortrait ? "top" : "left");
  /* Also give it a default output port on the right */
  nextProcess.addOutputPort("Output 1", "right");

  if (inputPort) graph.addConnection(intf, inputPort);
  spawnedConnectionVer.value++;

  /* Position the spawned process relative to the output node it spawned
     from, using collision-aware placement so recursive (multi-level)
     spawns never stack on top of each other. */
  const baseX = (node as any).position?.x ?? 0;
  const baseY = (node as any).position?.y ?? 0;
  const nodeSize = getNodeSizeForLayout(node);
  const startX = baseX + (isPortrait ? 0 : nodeSize.width + 80);
  const startY = baseY + (isPortrait ? nodeSize.height + 80 : 0);
  placeNodeAvoidingOverlap(graph, nextProcess, startX, startY, isPortrait ? "x" : "y", [node.id]);

  /* Only refresh connection visuals – never re-run the central
     auto-arrange, which would shift the spawned process position.
     Use delayed retries so Vue has time to mount the DOM. */
  nextTick(() => {
    const delays = [0, 120, 280];
    delays.forEach((d) => setTimeout(() => refreshConnectionCoords(), d));
  });
};

/** Spawn a process to the LEFT of an input ResourceNode.
 *  The spawned process's output connects to a new left-side input on the
 *  input node, mirroring the right-side spawn from output nodes. */
const addProcessFromInputConnector = (node: ResourceNode, _intf: NodeInterface<unknown>) => {
  if ((node as any).resourceType !== "input") return;
  const graph = baklava.displayedGraph;
  if (!graph) return;

  const nextProcess = graph.addNode(new ProcessNode());
  if (!nextProcess) return;
  spawnedProcessNodes.add(nextProcess.id);
  (nextProcess as any).__tmSpawned = true;

  const newProcessData = {
    type: "process",
    category: "process",
    name: undefined,
    inputInstances: [],
    outputNodes: [],
    controlNodes: [],
  } as any;

  (nextProcess as any).process = newProcessData;
  (nextProcess as any).onProcessUpdate = (next: ProcessShape) => {
    Object.assign(newProcessData, next);
  };
  nextProcess.title = "Process";

  const isPortrait = isPortraitLayout();
  /* Give the spawned process an input port and an output port.
     The output connects back to the input resource node. */
  nextProcess.addInputPort("Input 1", isPortrait ? "top" : "left");
  const outputPort = nextProcess.addOutputPort("Output 1", "right");

  /* Add a left-side input port on the input resource node so the
     spawned process output can connect into it. */
  const inputPortOnResource = (node as ResourceNode).addInputPort("Source", "left");
  if (outputPort && inputPortOnResource) graph.addConnection(outputPort, inputPortOnResource);
  spawnedConnectionVer.value++;

  /* Position to the LEFT of the input node, with collision avoidance */
  const baseX = (node as any).position?.x ?? 0;
  const baseY = (node as any).position?.y ?? 0;
  const processSize = getNodeSizeForLayout(nextProcess);
  const startX = baseX - processSize.width - 80;
  const startY = baseY;
  placeNodeAvoidingOverlap(graph, nextProcess, startX, startY, isPortrait ? "x" : "y", [node.id]);

  nextTick(() => {
    const delays = [0, 120, 280];
    delays.forEach((d) => setTimeout(() => refreshConnectionCoords(), d));
  });
};

const deleteSpawnedProcess = (node: any) => {
  const graph = baklava.displayedGraph;
  if (!graph) return;
  spawnedProcessNodes.delete(node.id);
  const children = spawnedProcessChildren.get(node.id);
  if (children) {
    children.forEach((childId) => {
      const childNode = graph.findNodeById(childId);
      if (!childNode) return;
      const childConnections = graph.connections.filter(
        (c: any) => c.from?.nodeId === childId || c.to?.nodeId === childId
      );
      childConnections.forEach((c: any) => graph.removeConnection(c));
      graph.removeNode(childNode);
    });
    spawnedProcessChildren.delete(node.id);
  }
  /* Remove all connections attached to this node */
  const toRemove = graph.connections.filter(
    (c: any) => c.from?.nodeId === node.id || c.to?.nodeId === node.id
  );
  toRemove.forEach((c: any) => graph.removeConnection(c));
  graph.removeNode(node);
  spawnedConnectionVer.value++;
  nextTick(() => refreshConnectionCoords());
};

const addControlNodeForProcessNode = (node: ProcessNode) => {
  const graph = baklava.displayedGraph;
  if (!graph) return;
  const process = (node as any).process as ProcessShape | undefined;
  if (!process) return;
  process.controlNodes = process.controlNodes || [];
  const meta: ControlMeta = { kind: "hr", hr: clone(defaultHr) };
  process.controlNodes.push(meta);
  const index = process.controlNodes.length - 1;

  const createControlNode = (kind: "site" | "hr" | "machine") => {
    const controlNode = graph.addNode(new ResourceNode(kind));
    if (!controlNode) return null;
    (controlNode as any).__tmMeta = { kind: "spawned-control", parentId: node.id, index } as NodeMeta;
    (controlNode as any).controlKind = kind;
    if (kind === "site") (controlNode as any).site = meta.site;
    if (kind === "hr") (controlNode as any).hr = meta.hr;
    if (kind === "machine") (controlNode as any).machineInstance = meta.machine || clone(defaultMachineInstance);

    (controlNode as any).onSiteUpdate = (next?: unknown) => {
      meta.site = next;
    };
    (controlNode as any).onHrUpdate = (next?: Hr) => {
      meta.hr = next;
    };
    (controlNode as any).onMachineUpdate = (next: MachineInstance) => {
      meta.machine = next;
    };
    (controlNode as any).onControlKindUpdate = (next: "site" | "hr" | "machine") => {
      meta.kind = next;
      if (next === "site") {
        meta.site = meta.site || clone(defaultSite);
        meta.hr = undefined;
        meta.machine = undefined;
      } else if (next === "hr") {
        meta.hr = meta.hr || clone(defaultHr);
        meta.site = undefined;
        meta.machine = undefined;
      } else {
        meta.machine = meta.machine || clone(defaultMachineInstance);
        meta.site = undefined;
        meta.hr = undefined;
      }

      const prevX = (controlNode as any).position?.x ?? 0;
      const prevY = (controlNode as any).position?.y ?? 0;
      const toRemove = graph.connections.filter(
        (c: any) => c.from?.nodeId === controlNode.id || c.to?.nodeId === controlNode.id
      );
      toRemove.forEach((c: any) => graph.removeConnection(c));
      graph.removeNode(controlNode);
      const set = spawnedProcessChildren.get(node.id);
      if (set) set.delete(controlNode.id);
      const nextNode = createControlNode(next);
      if (nextNode) {
        setNodePosition(nextNode, prevX, prevY);
        const nextOutput = Object.values(nextNode.outputs)[0];
        if (controlPort && nextOutput) graph.addConnection(nextOutput, controlPort);
        trackSpawnedChild(node.id, nextNode.id);
      }
      nextTick(() => refreshConnectionCoords());
    };

    return controlNode;
  };

  const controlTitle = `${meta.kind === "site" ? "Site" : meta.kind === "hr" ? "Hr" : "Machine"} ${index + 1}`;
  const controlPort = node.addInputPort(controlTitle, isPortraitLayout() ? "right" : "bottom");
  const controlNode = createControlNode(meta.kind);
  const controlOutput = controlNode ? Object.values(controlNode.outputs)[0] : undefined;
  if (controlPort && controlOutput) graph.addConnection(controlOutput, controlPort);

  /* Place controls in a vertical column below the spawned process,
     stacking each new control under the previously existing ones. */
  const baseX = (node as any).position?.x ?? 0;
  const baseY = (node as any).position?.y ?? 0;
  const processSize = getNodeSizeForLayout(node);
  const colGapCtrl = 24;
  /* Calculate vertical offset: start below the process, then stack
     below any existing control children. */
  let offsetY = processSize.height + 40;
  const children = spawnedProcessChildren.get(node.id);
  if (children) {
    children.forEach((childId) => {
      const childNode = graph.nodes.find((n: any) => n.id === childId) as any;
      if (!childNode) return;
      const childMeta = childNode.__tmMeta as { kind?: string } | undefined;
      if (childMeta?.kind !== "spawned-control") return;
      const childSize = getNodeSizeForLayout(childNode);
      const childBottom = (childNode.position?.y ?? 0) + childSize.height + colGapCtrl;
      const candidateOffset = childBottom - baseY;
      if (candidateOffset > offsetY) offsetY = candidateOffset;
    });
  }
  if (controlNode) {
    placeNodeAvoidingOverlap(graph, controlNode, baseX, baseY + offsetY, "y", [node.id]);
    trackSpawnedChild(node.id, controlNode.id);
  }

  nextTick(() => refreshConnectionCoords());
};

const deleteSpawnedResourceNode = (node: ResourceNode) => {
  const graph = baklava.displayedGraph;
  if (!graph) return;
  const meta = (node as any).__tmMeta as { parentId?: string } | undefined;
  if (meta?.parentId) {
    const set = spawnedProcessChildren.get(meta.parentId);
    if (set) set.delete(node.id);
  }
  const toRemove = graph.connections.filter(
    (c: any) => c.from?.nodeId === node.id || c.to?.nodeId === node.id
  );
  toRemove.forEach((c: any) => graph.removeConnection(c));
  graph.removeNode(node);
  spawnedConnectionVer.value++;
  nextTick(() => refreshConnectionCoords());
};

const addControlNode = () => {
  const process = ensureProcessWithInputs();
  if (!process) return;
  process.controlNodes = process.controlNodes || [];
  process.controlNodes.push({
    kind: "hr",
    hr: clone(defaultHr),
  });
  buildGraphFromModel();
};

const deleteResourceNode = (node: ResourceNode) => {
  const process = ensureProcessWithInputs();
  if (!process) return;

  const meta = (node as any).__tmMeta as NodeMeta | undefined;
  const cacheKey = nodeKeyFromMeta(meta);
  if (cacheKey) {
    nodePositionCache.delete(cacheKey);
  }
  if (meta) {
    if (meta.kind === "input") {
      process.inputInstances.splice(meta.index, 1);
    }
    if (meta.kind === "output-extra") {
      process.outputNodes = process.outputNodes || [];
      process.outputNodes.splice(meta.index, 1);
    }
    if (meta.kind === "machine") {
      process.machineInstance = undefined;
    }
    if (meta.kind === "site-main") {
      process.site = undefined;
    }
    if (meta.kind === "hr-main") {
      process.hr = undefined;
    }
    if (meta.kind === "control-extra") {
      process.controlNodes = process.controlNodes || [];
      process.controlNodes.splice(meta.index, 1);
    }
    if (meta.kind === "knowhow") {
      process.knowHow = undefined;
    }
    if (meta.kind === "impact") {
      process.impacts = undefined;
    }
    buildGraphFromModel();
    return;
  }

  const instance = (node as any).inputInstance as InputInstance | undefined;
  if (instance) {
    const index = process.inputInstances.findIndex((item) => item === instance);
    if (index >= 0) {
      process.inputInstances.splice(index, 1);
    }
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
  let arrowUpdateTimer: number | null = null;
  markerObserver = new MutationObserver(() => {
    installConnectionMarkers();
    if (arrowUpdateTimer) cancelAnimationFrame(arrowUpdateTimer);
    arrowUpdateTimer = requestAnimationFrame(() => updateConnectionArrows());
  });
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
    /* Avoid re-running full auto-arrange on every graph mutation; this was
       causing spawned process position jumps during + actions. */
    refreshConnectionCoords();
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
              <div
                class="tm-node-drag-surface"
                @pointerdown="(event) => handleNodePointerDown(event as PointerEvent, node, onStartDrag, onSelect)"
              >
                <Idef0Node
                  :node="node"
                  :on-add-input="() => handleAddInputForNode(node)"
                  :on-add-output="() => handleAddOutputForNode(node)"
                  :on-add-mechanism="() => handleAddMechanismForNode(node)"
                  :on-delete="isSpawnedProcess(node) ? () => handleDeleteForNode(node) : undefined"
                />
              </div>
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
              <div
                class="tm-node-drag-surface"
                @pointerdown="(event) => handleNodePointerDown(event as PointerEvent, node, onStartDrag, onSelect)"
              >
                <ResourceNodeVue
                  :node="node"
                  :on-delete="
                    (node as any).__tmMeta?.kind === 'output-root'
                      ? undefined
                      : nodeHasSpawnedConnection(node) && !String((node as any).__tmMeta?.kind || '').startsWith('spawned-')
                        ? undefined
                        : String((node as any).__tmMeta?.kind || '').startsWith('spawned-')
                          ? () => deleteSpawnedResourceNode(node as ResourceNode)
                          : () => deleteResourceNode(node as ResourceNode)
                  "
                  :on-output-connector="(intf) => addProcessFromOutputConnector(node as ResourceNode, intf)"
                  :on-input-connector="nodeHasLeftSpawnedProcess(node) ? undefined : (intf) => addProcessFromInputConnector(node as ResourceNode, intf)"
                />
              </div>
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
