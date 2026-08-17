import ELK from "elkjs/lib/elk.bundled.js";
import type { DiagramNode } from "@/schema/diagram";

const elk = new ELK();

export async function layoutWithElk(
  nodes: Array<{ id: string; width?: number; height?: number }>,
  edges: Array<{ id: string; source: string; target: string }>,
  direction: "RIGHT" | "DOWN" = "RIGHT",
): Promise<DiagramNode[]> {
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[24,24,24,24]",
      "elk.spacing.nodeNode": "56",
      "elk.spacing.edgeNode": "24",
      "elk.layered.spacing.nodeNodeBetweenLayers": "88",
      "elk.layered.spacing.edgeNodeBetweenLayers": "40",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.thoroughness": "12",
      "elk.separateConnectedComponents": "true",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width ?? 200,
      height: node.height ?? 64,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });

  return (graph.children ?? []).map((child) => ({
    id: child.id,
    kind: "component" as const,
    componentId: child.id,
    position: { x: child.x ?? 0, y: child.y ?? 0 },
    size: { width: child.width ?? 200, height: child.height ?? 64 },
  }));
}
