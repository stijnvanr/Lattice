import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/sql-js";
import sqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { migrate } from "@/db/migrate";
import { WorkspaceRepo } from "@/db/repository";
import * as schema from "@/db/schema";
import { buildSampleWorkspace } from "@/data/seed";
import { draftForType } from "@/lib/draft";
import { createId, nowIso } from "@/lib/ids";
import type { Component } from "@/schema/component";

const require = createRequire(import.meta.url);

async function repo() {
  const initSqlJs = typeof sqlJs === "function" ? sqlJs : (sqlJs as unknown as { default: typeof sqlJs }).default;
  const SQL = await initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
  });
  const sqlite = new SQL.Database();
  migrate(sqlite);
  return new WorkspaceRepo({ sqlite, db: drizzle(sqlite, { schema }) });
}

function component(workspaceId: string, type: Component["type"], name: string): Component {
  const now = nowIso();
  return {
    ...draftForType(type, name),
    id: createId("component"),
    workspaceId,
    createdAt: now,
    updatedAt: now,
  } as Component;
}

describe("WorkspaceRepo", () => {
  it("creates a workspace, component, auto-page, and typed reference", async () => {
    const r = await repo();
    const ws = r.createEmptyWorkspace("Lattice");
    expect(ws.ok).toBe(true);
    if (!ws.ok) return;
    const cap = r.createComponent(component(ws.data.id, "capability", "Sell"));
    expect(cap.ok).toBe(true);
    if (!cap.ok) return;
    const app = r.createComponent(component(ws.data.id, "application", "Shop"));
    expect(app.ok).toBe(true);
    if (!app.ok) return;
    const now = nowIso();
    const ref = r.createReference({
      id: createId("reference"),
      workspaceId: ws.data.id,
      type: "supports",
      sourceId: app.data.id,
      targetId: cap.data.id,
      createdAt: now,
      updatedAt: now,
    });
    expect(ref.ok).toBe(true);
    const loaded = r.loadWorkspace(ws.data.id);
    expect(loaded?.pages.some((p) => p.componentId === app.data.id)).toBe(true);
    expect(loaded?.references).toHaveLength(1);
  });

  it("blocks deleting a page that still has children", async () => {
    const r = await repo();
    const ws = r.createEmptyWorkspace("Docs");
    expect(ws.ok).toBe(true);
    if (!ws.ok) return;
    const now = nowIso();
    const parent = r.createPage({
      id: createId("page"),
      workspaceId: ws.data.id,
      title: "Parent",
      slug: "parent",
      order: 0,
      doc: { type: "doc", content: [{ type: "paragraph" }] },
      createdAt: now,
      updatedAt: now,
    });
    expect(parent.ok).toBe(true);
    if (!parent.ok) return;
    const child = r.createPage({
      id: createId("page"),
      workspaceId: ws.data.id,
      parentId: parent.data.id,
      title: "Child",
      slug: "child",
      order: 0,
      doc: { type: "doc", content: [{ type: "paragraph" }] },
      createdAt: now,
      updatedAt: now,
    });
    expect(child.ok).toBe(true);
    const blocked = r.deletePage(parent.data.id);
    expect(blocked.ok).toBe(false);
  });

  it("rejects unknown schemaVersion and accepts a valid import", async () => {
    const r = await repo();
    const rejected = r.importBundle(
      { ...buildSampleWorkspace(), schemaVersion: "9.9.9" },
      { type: "new" },
    );
    expect(rejected.ok).toBe(false);
    const accepted = r.importBundle(buildSampleWorkspace(), { type: "new" });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.data.workspace.id).not.toBe("ws_northstar");
    expect(accepted.data.components.length).toBeGreaterThan(0);
  });

  it("clears viaId when the interface is deleted", async () => {
    const r = await repo();
    const imported = r.importBundle(buildSampleWorkspace(), { type: "new" });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const iface = imported.data.components.find((c) => c.type === "interface");
    expect(iface).toBeTruthy();
    if (!iface) return;
    const deleted = r.deleteComponent(iface.id);
    expect(deleted.ok).toBe(true);
    const loaded = r.loadWorkspace(imported.data.workspace.id);
    expect(loaded?.references.some((ref) => ref.viaId === iface.id)).toBe(false);
    expect(loaded?.references.some((ref) => ref.type === "integrates_with")).toBe(true);
  });

  it("makes component type immutable", async () => {
    const r = await repo();
    const ws = r.createEmptyWorkspace("Types");
    expect(ws.ok).toBe(true);
    if (!ws.ok) return;
    const created = r.createComponent(component(ws.data.id, "process", "Order to Cash"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = r.updateComponent(created.data.id, { type: "application" });
    expect(updated.ok).toBe(false);
  });
});
