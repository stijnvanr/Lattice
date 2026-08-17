import type { Component } from "@/schema/component";
import type { ComponentType, ReferenceType } from "@/schema/common";
import type { Reference } from "@/schema/reference";
import { layoutWithElk } from "@/lib/elk";

export type LayoutKind = "component" | "frame" | "chip" | "lane";

export type LayoutNode = {
  id: string;
  componentId?: string;
  kind: LayoutKind;
  type: ComponentType | "lane";
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  parentId?: string;
  level?: number;
  zIndex?: number;
};

export type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  referenceId: string;
  type: ReferenceType;
};

export type LiveLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
};

const ORIGIN = 32;
const HEADER = 36;
const PAD = 14;
const GAP = 12;
const ROOT_GAP = 28;
const CHIP_W = 168;
const CHIP_H = 38;
const MIN_LEAF_W = 196;
const LANE_HEADER = 28;
const LANE_GAP = 72;
const CELL_W = 220;
const CELL_H = 84;
const CELL_GAP = 24;
const NODE_W = 200;
const NODE_H = 72;

type RefLite = Pick<Reference, "id" | "type" | "sourceId" | "targetId" | "viaId">;

export function chooseGrid(count: number, targetAspect = 4 / 3) {
  if (count <= 1) return { cols: Math.max(count, 1), rows: 1 };
  let best = { cols: count, rows: 1, score: Number.POSITIVE_INFINITY };
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const empty = cols * rows - count;
    const aspect = cols / rows;
    const score = empty * 2.2 + Math.abs(aspect - targetAspect) * 5;
    if (score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

export function snapToGrid(value: number, grid = 24) {
  return Math.round(value / grid) * grid;
}

export function snapPosition(position: { x: number; y: number }, grid = 24) {
  return { x: snapToGrid(position.x, grid), y: snapToGrid(position.y, grid) };
}

export function alignToNeighbors(
  position: { x: number; y: number },
  others: Array<{ x: number; y: number }>,
  threshold = 8,
) {
  let { x, y } = position;
  let guideX: number | null = null;
  let guideY: number | null = null;
  for (const other of others) {
    if (Math.abs(x - other.x) <= threshold) {
      x = other.x;
      guideX = other.x;
    }
    if (Math.abs(y - other.y) <= threshold) {
      y = other.y;
      guideY = other.y;
    }
  }
  return { position: { x, y }, guideX, guideY };
}

export function layoutLiveViewSync(
  preset: "capability_map" | "workflow_map" | "application_landscape",
  components: Component[],
  references: RefLite[],
  direction: "RIGHT" | "DOWN" = "DOWN",
): LiveLayout {
  if (preset === "capability_map") return layoutCapabilityMap(components, references);
  if (preset === "workflow_map") return layoutWorkflowMap(components, references);
  return layoutApplicationLandscape(components, references, direction);
}

export async function layoutLiveView(
  preset: "capability_map" | "workflow_map" | "application_landscape" | "neighborhood",
  components: Component[],
  references: RefLite[],
  direction: "RIGHT" | "DOWN" = "DOWN",
  rootId?: string,
): Promise<LiveLayout> {
  if (preset === "neighborhood") return layoutNeighborhood(components, references, rootId, direction);
  return layoutLiveViewSync(preset, components, references, direction);
}

function layoutCapabilityMap(components: Component[], references: RefLite[]): LiveLayout {
  const byId = new Map(components.map((c) => [c.id, c]));
  const capabilities = components.filter((c) => c.type === "capability");
  const childIds = new Map<string, string[]>();
  for (const cap of capabilities) childIds.set(cap.id, []);

  for (const ref of references) {
    if (ref.type !== "contains") continue;
    const source = byId.get(ref.sourceId);
    const target = byId.get(ref.targetId);
    if (source?.type !== "capability" || target?.type !== "capability") continue;
    const list = childIds.get(source.id);
    if (list && !list.includes(target.id)) list.push(target.id);
  }
  for (const cap of capabilities) {
    if (!cap.parentId) continue;
    const parent = byId.get(cap.parentId);
    if (parent?.type !== "capability") continue;
    const list = childIds.get(parent.id);
    if (list && !list.includes(cap.id)) list.push(cap.id);
  }
  for (const list of childIds.values()) {
    list.sort((a, b) => indexOf(components, a) - indexOf(components, b));
  }

  const nested = new Set<string>();
  for (const list of childIds.values()) for (const id of list) nested.add(id);
  const roots = capabilities.filter((c) => !nested.has(c.id));

  const packed = roots.map((root) => packCapability(root, byId, childIds, components, references));
  const maxH = Math.max(...packed.map((p) => p.height), MIN_LEAF_W);
  let x = ORIGIN;
  const nodes: LayoutNode[] = [];
  for (const box of packed) {
    box.height = maxH;
    emitPacked(box, undefined, x, ORIGIN, nodes);
    x += box.width + ROOT_GAP;
  }
  return { nodes, edges: [] };
}

type PackedChip = {
  id: string;
  componentId: string;
  label: string;
  type: ComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PackedBox = {
  id: string;
  componentId: string;
  label: string;
  type: ComponentType;
  level?: number;
  width: number;
  height: number;
  x: number;
  y: number;
  children: PackedBox[];
  chips: PackedChip[];
};

function packCapability(
  cap: Extract<Component, { type: "capability" }>,
  byId: Map<string, Component>,
  childIds: Map<string, string[]>,
  components: Component[],
  references: RefLite[],
): PackedBox {
  const nested = (childIds.get(cap.id) ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is Extract<Component, { type: "capability" }> => c?.type === "capability")
    .map((child) => packCapability(child, byId, childIds, components, references));
  const chips = supportingChips(cap.id, byId, references);

  if (nested.length === 0) {
    const cols = Math.min(2, Math.max(1, chips.length));
    const rows = chips.length === 0 ? 0 : Math.ceil(chips.length / cols);
    const innerW = Math.max(MIN_LEAF_W - 2 * PAD, cols * CHIP_W + Math.max(cols - 1, 0) * GAP);
    const innerH = rows === 0 ? 12 : rows * CHIP_H + (rows - 1) * GAP;
    const placed = placeChips(chips, cols, PAD, HEADER + PAD);
    return {
      id: cap.id,
      componentId: cap.id,
      label: cap.name,
      type: "capability",
      level: cap.level,
      width: innerW + 2 * PAD,
      height: HEADER + PAD + innerH + PAD,
      x: 0,
      y: 0,
      children: [],
      chips: placed,
    };
  }

  const { cols, rows } = chooseGrid(nested.length);
  const cellW = Math.max(...nested.map((n) => n.width));
  const cellH = Math.max(...nested.map((n) => n.height));
  nested.forEach((child, index) => {
    child.width = cellW;
    child.height = cellH;
    const col = index % cols;
    const row = Math.floor(index / cols);
    child.x = PAD + col * (cellW + GAP);
    child.y = HEADER + PAD + row * (cellH + GAP);
  });

  let width = PAD + cols * cellW + (cols - 1) * GAP + PAD;
  let height = HEADER + PAD + rows * cellH + (rows - 1) * GAP + PAD;
  let chipStartY = height - PAD + GAP;
  if (chips.length > 0) {
    const chipCols = Math.min(2, chips.length);
    const placed = placeChips(chips, chipCols, PAD, chipStartY);
    const chipRows = Math.ceil(chips.length / chipCols);
    width = Math.max(width, PAD + chipCols * CHIP_W + (chipCols - 1) * GAP + PAD);
    height = chipStartY + chipRows * CHIP_H + (chipRows - 1) * GAP + PAD;
    return {
      id: cap.id,
      componentId: cap.id,
      label: cap.name,
      type: "capability",
      level: cap.level,
      width,
      height,
      x: 0,
      y: 0,
      children: nested,
      chips: placed,
    };
  }

  return {
    id: cap.id,
    componentId: cap.id,
    label: cap.name,
    type: "capability",
    level: cap.level,
    width,
    height,
    x: 0,
    y: 0,
    children: nested,
    chips: [],
  };
}

function layoutWorkflowMap(components: Component[], references: RefLite[]): LiveLayout {
  const byId = new Map(components.map((c) => [c.id, c]));
  const workflows = components.filter((c) => c.type === "workflow");
  const childIds = new Map<string, string[]>();
  for (const workflow of workflows) childIds.set(workflow.id, []);

  for (const ref of references) {
    if (ref.type !== "contains") continue;
    const source = byId.get(ref.sourceId);
    const target = byId.get(ref.targetId);
    if (source?.type !== "workflow" || target?.type !== "workflow") continue;
    const list = childIds.get(source.id);
    if (list && !list.includes(target.id)) list.push(target.id);
  }
  for (const workflow of workflows) {
    if (!workflow.parentId) continue;
    const parent = byId.get(workflow.parentId);
    if (parent?.type !== "workflow") continue;
    const list = childIds.get(parent.id);
    if (list && !list.includes(workflow.id)) list.push(workflow.id);
  }
  for (const list of childIds.values()) {
    list.sort((a, b) => indexOf(components, a) - indexOf(components, b));
  }

  const nested = new Set<string>();
  for (const list of childIds.values()) for (const id of list) nested.add(id);
  const roots = workflows.filter((c) => !nested.has(c.id));

  const packed = roots.map((root) => packWorkflow(root, byId, childIds, components, references));
  const nodes: LayoutNode[] = [];
  let y = ORIGIN;
  for (const box of packed) {
    emitPacked(box, undefined, ORIGIN, y, nodes);
    y += box.height + ROOT_GAP;
  }
  return { nodes, edges: [] };
}

function packWorkflow(
  workflow: Extract<Component, { type: "workflow" }>,
  byId: Map<string, Component>,
  childIds: Map<string, string[]>,
  components: Component[],
  references: RefLite[],
): PackedBox {
  const nested = (childIds.get(workflow.id) ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is Extract<Component, { type: "workflow" }> => c?.type === "workflow")
    .map((child) => packWorkflow(child, byId, childIds, components, references));
  const chips = supportingChips(workflow.id, byId, references).filter((chip) => chip.type === "application");
  const depth = workflow.parentId ? 2 : 1;

  if (nested.length === 0) {
    const cols = Math.min(2, Math.max(1, chips.length));
    const rows = chips.length === 0 ? 0 : Math.ceil(chips.length / cols);
    const innerW = Math.max(MIN_LEAF_W - 2 * PAD, cols * CHIP_W + Math.max(cols - 1, 0) * GAP);
    const innerH = rows === 0 ? 12 : rows * CHIP_H + (rows - 1) * GAP;
    const placed = placeChips(chips, cols, PAD, HEADER + PAD);
    return {
      id: workflow.id,
      componentId: workflow.id,
      label: workflow.name,
      type: "workflow",
      level: depth,
      width: innerW + 2 * PAD,
      height: HEADER + PAD + innerH + PAD,
      x: 0,
      y: 0,
      children: [],
      chips: placed,
    };
  }

  const cellW = Math.max(...nested.map((n) => n.width));
  const cellH = Math.max(...nested.map((n) => n.height));
  nested.forEach((child, index) => {
    child.width = cellW;
    child.height = cellH;
    child.x = PAD + index * (cellW + GAP);
    child.y = HEADER + PAD;
  });

  let width = PAD + nested.length * cellW + (nested.length - 1) * GAP + PAD;
  let height = HEADER + PAD + cellH + PAD;
  if (chips.length > 0) {
    const chipCols = Math.min(nested.length, Math.max(1, chips.length));
    const placed = placeChips(chips, chipCols, PAD, height - PAD + GAP);
    const chipRows = Math.ceil(chips.length / chipCols);
    width = Math.max(width, PAD + chipCols * CHIP_W + (chipCols - 1) * GAP + PAD);
    height = height + GAP + chipRows * CHIP_H + (chipRows - 1) * GAP + PAD;
    return {
      id: workflow.id,
      componentId: workflow.id,
      label: workflow.name,
      type: "workflow",
      level: depth,
      width,
      height,
      x: 0,
      y: 0,
      children: nested,
      chips: placed,
    };
  }

  return {
    id: workflow.id,
    componentId: workflow.id,
    label: workflow.name,
    type: "workflow",
    level: depth,
    width,
    height,
    x: 0,
    y: 0,
    children: nested,
    chips: [],
  };
}

function supportingChips(capId: string, byId: Map<string, Component>, references: RefLite[]): PackedChip[] {
  const chips: PackedChip[] = [];
  for (const ref of references) {
    if (ref.targetId !== capId) continue;
    if (ref.type !== "supports" && ref.type !== "realizes") continue;
    const source = byId.get(ref.sourceId);
    if (!source || (source.type !== "application" && source.type !== "process" && source.type !== "workflow")) continue;
    chips.push({
      id: `${source.id}__${capId}`,
      componentId: source.id,
      label: source.name,
      type: source.type,
      x: 0,
      y: 0,
      width: CHIP_W,
      height: CHIP_H,
    });
  }
  chips.sort((a, b) => a.label.localeCompare(b.label));
  return chips;
}

function placeChips(chips: PackedChip[], cols: number, left: number, top: number) {
  return chips.map((chip, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      ...chip,
      x: left + col * (CHIP_W + GAP),
      y: top + row * (CHIP_H + GAP),
    };
  });
}

function emitPacked(box: PackedBox, parentId: string | undefined, x: number, y: number, nodes: LayoutNode[]) {
  nodes.push({
    id: box.id,
    componentId: box.componentId,
    kind: "frame",
    type: box.type,
    label: box.label,
    position: { x, y },
    size: { width: box.width, height: box.height },
    parentId,
    level: box.level,
    zIndex: parentId ? 1 : 0,
  });
  for (const child of box.children) {
    emitPacked(child, box.id, child.x, child.y, nodes);
  }
  for (const chip of box.chips) {
    nodes.push({
      id: chip.id,
      componentId: chip.componentId,
      kind: "chip",
      type: chip.type,
      label: chip.label,
      position: { x: chip.x, y: chip.y },
      size: { width: chip.width, height: chip.height },
      parentId: box.id,
      zIndex: 2,
    });
  }
}

function layoutApplicationLandscape(
  components: Component[],
  references: RefLite[],
  direction: "RIGHT" | "DOWN",
): LiveLayout {
  const keep = new Set(
    components
      .filter((c) => c.type === "application" || c.type === "technology" || c.type === "interface")
      .map((c) => c.id),
  );
  const used = new Set(components.filter((c) => c.type === "application").map((c) => c.id));
  const edges: LayoutEdge[] = [];
  for (const ref of references) {
    if (!keep.has(ref.sourceId) || !keep.has(ref.targetId)) continue;
    if (
      ref.type !== "uses" &&
      ref.type !== "depends_on" &&
      ref.type !== "integrates_with" &&
      ref.type !== "runs_on"
    ) {
      continue;
    }
    used.add(ref.sourceId);
    used.add(ref.targetId);
    if (ref.viaId) used.add(ref.viaId);
    edges.push({
      id: ref.id,
      source: ref.sourceId,
      target: ref.targetId,
      referenceId: ref.id,
      type: ref.type,
    });
  }

  const byType = {
    application: components.filter((c) => c.type === "application" && used.has(c.id)),
    interface: components.filter((c) => c.type === "interface" && used.has(c.id)),
    technology: components.filter((c) => c.type === "technology" && used.has(c.id)),
  };
  const lanes = (
    [
      { key: "application" as const, label: "Applications", items: byType.application },
      { key: "interface" as const, label: "Interfaces", items: byType.interface },
      { key: "technology" as const, label: "Technology", items: byType.technology },
    ] as const
  ).filter((lane) => lane.items.length > 0);

  const nodes: LayoutNode[] = [];
  let cursor = ORIGIN;
  const stacked = direction !== "RIGHT";
  for (const lane of lanes) {
    const cols = stacked
      ? Math.min(4, Math.max(1, lane.items.length))
      : 1;
    const rows = Math.ceil(lane.items.length / cols);
    const width = PAD * 2 + cols * CELL_W + Math.max(cols - 1, 0) * CELL_GAP;
    const height = LANE_HEADER + PAD + rows * CELL_H + Math.max(rows - 1, 0) * CELL_GAP + PAD;
    const laneId = `lane:${lane.key}`;
    nodes.push({
      id: laneId,
      kind: "lane",
      type: "lane",
      label: lane.label,
      position: stacked ? { x: ORIGIN, y: cursor } : { x: cursor, y: ORIGIN },
      size: { width, height },
      zIndex: 0,
    });
    lane.items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      nodes.push({
        id: item.id,
        componentId: item.id,
        kind: "component",
        type: item.type,
        label: item.name,
        parentId: laneId,
        position: {
          x: PAD + col * (CELL_W + CELL_GAP),
          y: LANE_HEADER + PAD + row * (CELL_H + CELL_GAP),
        },
        size: { width: CELL_W, height: CELL_H },
        zIndex: 1,
      });
    });
    cursor += (stacked ? height : width) + LANE_GAP;
  }
  return { nodes, edges };
}

async function layoutNeighborhood(
  components: Component[],
  references: RefLite[],
  rootId: string | undefined,
  direction: "RIGHT" | "DOWN",
): Promise<LiveLayout> {
  const root = rootId ? components.find((c) => c.id === rootId) : undefined;
  if (!root) return { nodes: [], edges: [] };
  const used = new Set<string>([root.id]);
  const edges: LayoutEdge[] = [];
  for (const ref of references) {
    if (ref.sourceId !== root.id && ref.targetId !== root.id) continue;
    used.add(ref.sourceId);
    used.add(ref.targetId);
    if (ref.viaId) used.add(ref.viaId);
    edges.push({
      id: ref.id,
      source: ref.sourceId,
      target: ref.targetId,
      referenceId: ref.id,
      type: ref.type,
    });
  }
  const ordered = [...used]
    .map((id) => components.find((c) => c.id === id))
    .filter((c): c is Component => Boolean(c));
  const laidOut = await layoutWithElk(
    ordered.map((c) => ({ id: c.id, width: NODE_W, height: NODE_H })),
    edges,
    direction,
  );
  const nodes: LayoutNode[] = laidOut.map((node) => {
    const component = components.find((c) => c.id === node.id);
    return {
      id: node.id,
      componentId: node.id,
      kind: "component",
      type: component?.type ?? "application",
      label: component?.name ?? node.id,
      position: {
        x: ORIGIN + snapToGrid(node.position.x),
        y: ORIGIN + snapToGrid(node.position.y),
      },
      size: { width: NODE_W, height: NODE_H },
    };
  });
  return { nodes, edges };
}

function indexOf(components: Component[], id: string) {
  const index = components.findIndex((c) => c.id === id);
  return index === -1 ? 9999 : index;
}
