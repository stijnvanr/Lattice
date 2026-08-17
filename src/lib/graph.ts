import type { Component } from "@/schema/component";
import type { LivePreset } from "@/schema/diagram";
import type { Reference } from "@/schema/reference";

export type GraphNode = {
  id: string;
  componentId: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  referenceId: string;
  type: Reference["type"];
};

export function queryLiveGraph(
  preset: LivePreset,
  components: Component[],
  references: Array<Pick<Reference, "id" | "type" | "sourceId" | "targetId" | "viaId">>,
  rootId?: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const byId = new Map(components.map((c) => [c.id, c]));

  if (preset === "capability_map") {
    const keep = new Set(
      components
        .filter(
          (c) =>
            c.type === "capability" ||
            c.type === "application" ||
            c.type === "process" ||
            c.type === "workflow",
        )
        .map((c) => c.id),
    );
    const edges = references.filter(
      (r) =>
        keep.has(r.sourceId) &&
        keep.has(r.targetId) &&
        (r.type === "contains" || r.type === "supports" || r.type === "realizes"),
    );
    const used = new Set<string>();
    for (const e of edges) {
      used.add(e.sourceId);
      used.add(e.targetId);
    }
    for (const c of components) {
      if (c.type === "capability") used.add(c.id);
    }
    return pack(used, edges);
  }

  if (preset === "workflow_map") {
    const keep = new Set(
      components
        .filter((c) => c.type === "workflow" || c.type === "application")
        .map((c) => c.id),
    );
    const edges = references.filter(
      (r) =>
        keep.has(r.sourceId) &&
        keep.has(r.targetId) &&
        (r.type === "contains" || r.type === "supports"),
    );
    const used = new Set<string>();
    for (const c of components) {
      if (c.type === "workflow") used.add(c.id);
    }
    for (const e of edges) {
      used.add(e.sourceId);
      used.add(e.targetId);
    }
    return pack(used, edges);
  }

  if (preset === "application_landscape") {
    const keep = new Set(
      components
        .filter((c) => c.type === "application" || c.type === "technology" || c.type === "interface")
        .map((c) => c.id),
    );
    const edges = references.filter(
      (r) =>
        keep.has(r.sourceId) &&
        keep.has(r.targetId) &&
        (r.type === "uses" ||
          r.type === "depends_on" ||
          r.type === "integrates_with" ||
          r.type === "runs_on"),
    );
    const used = new Set<string>();
    for (const c of components) {
      if (c.type === "application") used.add(c.id);
    }
    for (const e of edges) {
      used.add(e.sourceId);
      used.add(e.targetId);
      if (e.viaId) used.add(e.viaId);
    }
    return pack(used, edges);
  }

  const root = rootId ? byId.get(rootId) : undefined;
  if (!root) return { nodes: [], edges: [] };
  const used = new Set<string>([root.id]);
  const edges = references.filter((r) => r.sourceId === root.id || r.targetId === root.id);
  for (const e of edges) {
    used.add(e.sourceId);
    used.add(e.targetId);
    if (e.viaId) used.add(e.viaId);
  }
  return pack(used, edges);
}

function pack(
  used: Set<string>,
  edges: Array<Pick<Reference, "id" | "type" | "sourceId" | "targetId" | "viaId">>,
) {
  return {
    nodes: [...used].map((id) => ({ id, componentId: id })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      referenceId: e.id,
      type: e.type,
    })),
  };
}
