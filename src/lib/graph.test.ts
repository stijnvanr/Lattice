import { describe, expect, it } from "vitest";
import { buildSampleWorkspace } from "@/data/seed";
import { queryLiveGraph } from "@/lib/graph";

describe("queryLiveGraph", () => {
  const bundle = buildSampleWorkspace();

  it("builds a capability map with contains/supports/realizes edges", () => {
    const graph = queryLiveGraph("capability_map", bundle.components, bundle.references);
    expect(graph.nodes.length).toBeGreaterThan(10);
    expect(graph.edges.length).toBeGreaterThan(10);
    expect(graph.edges.every((e) => ["contains", "supports", "realizes"].includes(e.type))).toBe(true);
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(graph.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it("builds a workflow map with steps and supporting apps", () => {
    const graph = queryLiveGraph("workflow_map", bundle.components, bundle.references);
    expect(graph.nodes.some((n) => n.id === "cmp_wf_signup")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "cmp_web")).toBe(true);
    expect(graph.edges.some((e) => e.type === "contains")).toBe(true);
    expect(graph.edges.some((e) => e.type === "supports")).toBe(true);
  });

  it("builds an application landscape with integration edges", () => {
    const graph = queryLiveGraph("application_landscape", bundle.components, bundle.references);
    expect(graph.nodes.some((n) => n.id === "cmp_web")).toBe(true);
    expect(graph.edges.some((e) => e.type === "integrates_with")).toBe(true);
  });

  it("builds a neighborhood around a root", () => {
    const graph = queryLiveGraph("neighborhood", bundle.components, bundle.references, "cmp_web");
    expect(graph.nodes.some((n) => n.id === "cmp_web")).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
  });
});
