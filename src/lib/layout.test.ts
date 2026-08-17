import { describe, expect, it } from "vitest";
import { buildSampleWorkspace } from "@/data/seed";
import { chooseGrid, layoutLiveViewSync } from "@/lib/layout";

describe("chooseGrid", () => {
  it("packs six children toward a 4:3 map", () => {
    const grid = chooseGrid(6);
    expect(grid.cols * grid.rows).toBeGreaterThanOrEqual(6);
    expect(Math.abs(grid.cols / grid.rows - 4 / 3)).toBeLessThan(1.5);
  });
});

describe("layoutLiveViewSync", () => {
  const bundle = buildSampleWorkspace();

  it("nests capabilities instead of a spaghetti graph", () => {
    const layout = layoutLiveViewSync("capability_map", bundle.components, bundle.references);
    const acquire = layout.nodes.find((n) => n.id === "cmp_acquire");
    const selfserve = layout.nodes.find((n) => n.id === "cmp_selfserve");
    expect(acquire?.kind).toBe("frame");
    expect(selfserve?.parentId).toBe("cmp_acquire");
    expect(layout.nodes.some((n) => n.kind === "chip" && n.componentId === "cmp_web")).toBe(true);
    expect(layout.edges).toEqual([]);
    const frames = layout.nodes.filter((n) => n.kind === "frame" && !n.parentId);
    expect(frames).toHaveLength(3);
    expect(frames[0]?.position.y).toBe(frames[1]?.position.y);
    expect(frames[1]?.position.x).toBeGreaterThan(frames[0]!.position.x);
  });

  it("does not overlap sibling L1 frames", () => {
    const layout = layoutLiveViewSync("capability_map", bundle.components, bundle.references);
    const roots = layout.nodes.filter((n) => n.kind === "frame" && !n.parentId);
    for (let i = 0; i < roots.length; i += 1) {
      for (let j = i + 1; j < roots.length; j += 1) {
        const a = roots[i]!;
        const b = roots[j]!;
        const separate =
          a.position.x + a.size.width <= b.position.x || b.position.x + b.size.width <= a.position.x;
        expect(separate).toBe(true);
      }
    }
  });

  it("lays workflow steps out left to right", () => {
    const layout = layoutLiveViewSync("workflow_map", bundle.components, bundle.references);
    const signup = layout.nodes.find((n) => n.id === "cmp_wf_signup");
    const account = layout.nodes.find((n) => n.id === "cmp_wf_account");
    const email = layout.nodes.find((n) => n.id === "cmp_wf_email");
    expect(signup?.kind).toBe("frame");
    expect(account?.parentId).toBe("cmp_wf_signup");
    expect(email?.parentId).toBe("cmp_wf_signup");
    expect(email!.position.x).toBeGreaterThan(account!.position.x);
    expect(layout.nodes.some((n) => n.kind === "chip" && n.componentId === "cmp_web")).toBe(true);
    const roots = layout.nodes.filter((n) => n.kind === "frame" && !n.parentId);
    expect(roots).toHaveLength(3);
    expect(roots[1]!.position.y).toBeGreaterThan(roots[0]!.position.y);
  });

  it("puts landscape systems on aligned swimlanes", () => {
    const layout = layoutLiveViewSync("application_landscape", bundle.components, bundle.references);
    const lanes = layout.nodes.filter((n) => n.kind === "lane");
    expect(lanes.map((n) => n.label)).toEqual(["Applications", "Interfaces", "Technology"]);
    const web = layout.nodes.find((n) => n.id === "cmp_web");
    expect(web?.parentId).toBe("lane:application");
    expect(layout.edges.some((e) => e.type === "integrates_with")).toBe(true);
  });
});
