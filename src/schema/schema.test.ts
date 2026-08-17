import { describe, expect, it } from "vitest";
import { z } from "zod";
import { integrityErrors, stripDanglingDiagramNodes } from "@/db/integrity";
import { buildEmptyWorkspace, buildSampleWorkspace } from "@/data/seed";
import { bundleSchema } from "@/schema/bundle";
import { componentSchema } from "@/schema/component";
import { isReferenceAllowed, legalReferenceTypes } from "@/schema/metamodel";
import { assertHttpsImages, emptyDoc } from "@/schema/page";
import { fieldPathErrors } from "@/schema/result";

describe("metamodel", () => {
  it("allows application supports capability", () => {
    expect(isReferenceAllowed("supports", "application", "capability")).toBe(true);
  });

  it("rejects application contains organization", () => {
    expect(isReferenceAllowed("contains", "application", "organization")).toBe(false);
  });

  it("requires contains to stay within the same type", () => {
    expect(isReferenceAllowed("contains", "capability", "capability")).toBe(true);
    expect(isReferenceAllowed("contains", "capability", "process")).toBe(false);
  });

  it("allows a workflow to realize a capability and an app to support a workflow", () => {
    expect(isReferenceAllowed("realizes", "workflow", "capability")).toBe(true);
    expect(isReferenceAllowed("supports", "application", "workflow")).toBe(true);
    expect(isReferenceAllowed("contains", "workflow", "workflow")).toBe(true);
  });

  it("lists legal types for an application pair", () => {
    expect(legalReferenceTypes("application", "application")).toEqual(
      expect.arrayContaining(["uses", "depends_on", "integrates_with"]),
    );
  });
});

describe("field-path errors", () => {
  it("formats nested paths", () => {
    const result = componentSchema.safeParse({
      id: "cmp_1",
      workspaceId: "ws_1",
      type: "application",
      name: "ERP",
      description: "",
      status: "active",
      tags: [],
      createdAt: "t",
      updatedAt: "t",
      lifecycle: "nope",
      criticality: "medium",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldPathErrors(result.error);
    expect(errors.some((e) => e.path === "lifecycle")).toBe(true);
  });

  it("formats bundle array paths", () => {
    const bundle = buildSampleWorkspace();
    const index = bundle.components.findIndex((c) => c.type === "application");
    expect(index).toBeGreaterThanOrEqual(0);
    const broken = {
      ...bundle,
      components: bundle.components.map((c, i) =>
        i === index && c.type === "application" ? { ...c, lifecycle: "nope" } : c,
      ),
    };
    const result = bundleSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = fieldPathErrors(result.error).map((e) => e.path);
    expect(paths.some((p) => /components\[\d+\]\.lifecycle/.test(p))).toBe(true);
  });
});

describe("seed bundle", () => {
  it("validates and passes integrity", () => {
    const bundle = buildSampleWorkspace();
    const parsed = bundleSchema.safeParse(bundle);
    expect(parsed.success).toBe(true);
    expect(integrityErrors(bundle)).toEqual([]);
  });

  it("empty workspace validates", () => {
    const bundle = buildEmptyWorkspace("Untitled");
    expect(bundleSchema.safeParse(bundle).success).toBe(true);
    expect(integrityErrors(bundle)).toEqual([]);
    expect(bundle.components).toEqual([]);
  });
});

describe("integrity", () => {
  it("rejects a typed edge that the metamodel does not allow", () => {
    const bundle = buildSampleWorkspace();
    const sap = bundle.components.find((c) => c.name === "Northstar Web");
    const ingrid = bundle.components.find((c) => c.name === "Ava Chen");
    expect(sap && ingrid).toBeTruthy();
    if (!sap || !ingrid) return;
    const broken = {
      ...bundle,
      references: [
        ...bundle.references,
        {
          id: "ref_bad",
          workspaceId: bundle.workspace.id,
          type: "supports" as const,
          sourceId: sap.id,
          targetId: ingrid.id,
          createdAt: bundle.exportedAt,
          updatedAt: bundle.exportedAt,
        },
      ],
    };
    const errors = integrityErrors(broken);
    expect(errors.some((e) => e.path.includes("references") && e.message.includes("supports"))).toBe(
      true,
    );
  });

  it("rejects duplicate edges", () => {
    const bundle = buildSampleWorkspace();
    const first = bundle.references[0];
    expect(first).toBeTruthy();
    if (!first) return;
    const broken = {
      ...bundle,
      references: [...bundle.references, { ...first, id: "ref_dup" }],
    };
    expect(integrityErrors(broken).some((e) => e.message.includes("duplicate"))).toBe(true);
  });

  it("rejects parentId that does not match contains", () => {
    const bundle = buildSampleWorkspace();
    const child = bundle.components.find((c) => c.parentId);
    expect(child).toBeTruthy();
    if (!child) return;
    const broken = {
      ...bundle,
      components: bundle.components.map((c) =>
        c.id === child.id ? { ...c, parentId: undefined } : c,
      ),
    };
    expect(integrityErrors(broken).some((e) => e.path.includes("parentId"))).toBe(true);
  });
});

describe("import contract", () => {
  it("accepts a valid bundle", () => {
    const result = bundleSchema.safeParse(buildSampleWorkspace());
    expect(result.success).toBe(true);
  });

  it("rejects unknown schemaVersion", () => {
    const bundle = { ...buildSampleWorkspace(), schemaVersion: "9.9.9" };
    const result = bundleSchema.safeParse(bundle);
    expect(result.success).toBe(false);
  });

  it("strips dangling diagram nodes with a warning", () => {
    const bundle = buildSampleWorkspace();
    const board = bundle.diagrams.find((d) => d.kind === "board");
    expect(board).toBeTruthy();
    if (!board) return;
    const dirty = {
      ...bundle,
      diagrams: bundle.diagrams.map((diagram) =>
        diagram.id !== board.id
          ? diagram
          : {
              ...diagram,
              view: {
                ...diagram.view,
                nodes: [
                  ...diagram.view.nodes,
                  {
                    id: "n_ghost",
                    kind: "component" as const,
                    componentId: "cmp_missing",
                    position: { x: 0, y: 0 },
                  },
                ],
              },
            },
      ),
    };
    const stripped = stripDanglingDiagramNodes(dirty);
    expect(stripped.warnings.length).toBeGreaterThan(0);
    expect(
      stripped.bundle.diagrams
        .find((d) => d.id === board.id)
        ?.view.nodes.some((n) => n.componentId === "cmp_missing"),
    ).toBe(false);
  });
});

describe("json schema export", () => {
  it("emits draft 2020-12", () => {
    const json = z.toJSONSchema(bundleSchema, {
      target: "draft-2020-12",
      reused: "ref",
      unrepresentable: "any",
    }) as { $schema?: string };
    expect(json.$schema).toContain("2020-12");
  });
});

describe("images", () => {
  it("rejects blob and data URLs", () => {
    expect(
      assertHttpsImages({
        type: "doc",
        content: [{ type: "image", attrs: { src: "blob:http://localhost/1" } }],
      }),
    ).not.toEqual([]);
    expect(
      assertHttpsImages({
        type: "doc",
        content: [{ type: "image", attrs: { src: "data:image/png;base64,xx" } }],
      }),
    ).not.toEqual([]);
    expect(
      assertHttpsImages({
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://example.com/a.png" } }],
      }),
    ).toEqual([]);
    expect(assertHttpsImages(emptyDoc())).toEqual([]);
  });
});
