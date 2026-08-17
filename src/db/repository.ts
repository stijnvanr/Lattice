import { and, eq, or } from "drizzle-orm";
import type { Database } from "sql.js";
import type { z } from "zod";
import { createId, nowIso, slugify } from "@/lib/ids";
import { buildEmptyWorkspace, buildSampleWorkspace } from "@/data/seed";
import { bundleSchema, type Bundle } from "@/schema/bundle";
import { componentSchema, type Component } from "@/schema/component";
import { diagramSchema, type Diagram } from "@/schema/diagram";
import { isReferenceAllowed } from "@/schema/metamodel";
import {
  assertHttpsImages,
  assertMentions,
  emptyDoc,
  pageSchema,
  remapMentionIds,
  type Page,
} from "@/schema/page";
import { referenceSchema, type Reference } from "@/schema/reference";
import { fieldPathErrors, type FieldError, type Result } from "@/schema/result";
import { workspaceSchema, type Workspace } from "@/schema/workspace";
import type { Db } from "./client";
import { integrityErrors, stripDanglingDiagramNodes } from "./integrity";
import * as tables from "./schema";

type Engine = { sqlite: Database; db: Db };

function fail(errors: FieldError[]): Result<never> {
  return { ok: false, errors };
}

function failMsg(path: string, message: string): Result<never> {
  return fail([{ path, message }]);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): Result<T> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return fail(fieldPathErrors(result.error));
}

function extrasFrom(component: Component): Record<string, unknown> {
  if (component.type === "application") {
    return {
      lifecycle: component.lifecycle,
      criticality: component.criticality,
      vendor: component.vendor,
      url: component.url,
    };
  }
  if (component.type === "capability") return { level: component.level };
  if (component.type === "person") return { email: component.email, role: component.role };
  return {};
}

function rowToComponent(row: typeof tables.components.$inferSelect): Component {
  const extras = JSON.parse(row.extras) as Record<string, unknown>;
  const parsed = componentSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    name: row.name,
    description: row.description,
    status: row.status,
    tags: JSON.parse(row.tags) as string[],
    ownerId: row.ownerId ?? undefined,
    parentId: row.parentId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
  });
  return parsed;
}

function rowToPage(row: typeof tables.pages.$inferSelect): Page {
  return pageSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    parentId: row.parentId ?? undefined,
    title: row.title,
    slug: row.slug,
    order: row.order,
    doc: JSON.parse(row.doc),
    componentId: row.componentId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function rowToDiagram(row: typeof tables.diagrams.$inferSelect): Diagram {
  return diagramSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    kind: row.kind,
    query: row.query ? JSON.parse(row.query) : undefined,
    view: JSON.parse(row.view),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function rowToReference(row: typeof tables.references.$inferSelect): Reference {
  return referenceSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    sourceId: row.sourceId,
    targetId: row.targetId,
    viaId: row.viaId ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function remapBundle(bundle: Bundle, workspaceId: string): Bundle {
  const map = new Map<string, string>();
  map.set(bundle.workspace.id, workspaceId);
  for (const component of bundle.components) map.set(component.id, createId("component"));
  for (const reference of bundle.references) map.set(reference.id, createId("reference"));
  for (const page of bundle.pages) map.set(page.id, createId("page"));
  for (const diagram of bundle.diagrams) map.set(diagram.id, createId("diagram"));
  const id = (old?: string) => (old ? map.get(old) ?? old : undefined);

  return {
    schemaVersion: bundle.schemaVersion,
    exportedAt: bundle.exportedAt,
    workspace: { ...bundle.workspace, id: workspaceId },
    components: bundle.components.map((component) => ({
      ...component,
      id: map.get(component.id) ?? component.id,
      workspaceId,
      parentId: id(component.parentId),
      ownerId: id(component.ownerId),
    })),
    references: bundle.references.map((reference) => ({
      ...reference,
      id: map.get(reference.id) ?? reference.id,
      workspaceId,
      sourceId: map.get(reference.sourceId) ?? reference.sourceId,
      targetId: map.get(reference.targetId) ?? reference.targetId,
      viaId: id(reference.viaId),
    })),
    pages: bundle.pages.map((page) => ({
      ...page,
      id: map.get(page.id) ?? page.id,
      workspaceId,
      parentId: id(page.parentId),
      componentId: id(page.componentId),
      doc: remapMentionIds(page.doc, map),
    })),
    diagrams: bundle.diagrams.map((diagram) => ({
      ...diagram,
      id: map.get(diagram.id) ?? diagram.id,
      workspaceId,
      query: diagram.query
        ? { ...diagram.query, rootId: id(diagram.query.rootId) }
        : undefined,
      view: {
        ...diagram.view,
        nodes: diagram.view.nodes.map((node) => ({
          ...node,
          id: createId("n"),
          componentId: id(node.componentId),
        })),
      },
    })),
  };
}

export class WorkspaceRepo {
  private engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  private get db() {
    return this.engine.db;
  }

  private get sqlite() {
    return this.engine.sqlite;
  }

  private tx<T>(fn: () => T): T {
    this.sqlite.run("BEGIN");
    try {
      const value = fn();
      this.sqlite.run("COMMIT");
      return value;
    } catch (error) {
      this.sqlite.run("ROLLBACK");
      throw error;
    }
  }

  listWorkspaces(): Workspace[] {
    return this.db
      .select()
      .from(tables.workspaces)
      .all()
      .map((row) => workspaceSchema.parse(row));
  }

  loadWorkspace(id: string): Bundle | null {
    const workspace = this.db
      .select()
      .from(tables.workspaces)
      .where(eq(tables.workspaces.id, id))
      .get();
    if (!workspace) return null;
    const components = this.db
      .select()
      .from(tables.components)
      .where(eq(tables.components.workspaceId, id))
      .all()
      .map(rowToComponent);
    const references = this.db
      .select()
      .from(tables.references)
      .where(eq(tables.references.workspaceId, id))
      .all()
      .map(rowToReference);
    const pages = this.db
      .select()
      .from(tables.pages)
      .where(eq(tables.pages.workspaceId, id))
      .all()
      .map(rowToPage);
    const diagrams = this.db
      .select()
      .from(tables.diagrams)
      .where(eq(tables.diagrams.workspaceId, id))
      .all()
      .map(rowToDiagram);
    return {
      schemaVersion: "1.0.0",
      exportedAt: nowIso(),
      workspace: workspaceSchema.parse(workspace),
      components,
      references,
      pages,
      diagrams,
    };
  }

  private insertWorkspaceRow(workspace: Workspace) {
    this.db.insert(tables.workspaces).values(workspace).run();
  }

  private insertComponentRow(component: Component) {
    this.db
      .insert(tables.components)
      .values({
        id: component.id,
        workspaceId: component.workspaceId,
        type: component.type,
        name: component.name,
        description: component.description,
        status: component.status,
        tags: JSON.stringify(component.tags),
        ownerId: component.ownerId ?? null,
        parentId: component.parentId ?? null,
        extras: JSON.stringify(extrasFrom(component)),
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
      })
      .run();
  }

  private insertReferenceRow(reference: Reference) {
    this.db
      .insert(tables.references)
      .values({
        id: reference.id,
        workspaceId: reference.workspaceId,
        type: reference.type,
        sourceId: reference.sourceId,
        targetId: reference.targetId,
        viaId: reference.viaId ?? null,
        description: reference.description ?? null,
        createdAt: reference.createdAt,
        updatedAt: reference.updatedAt,
      })
      .run();
  }

  private insertPageRow(page: Page) {
    this.db
      .insert(tables.pages)
      .values({
        id: page.id,
        workspaceId: page.workspaceId,
        parentId: page.parentId ?? null,
        title: page.title,
        slug: page.slug,
        order: page.order,
        doc: JSON.stringify(page.doc),
        componentId: page.componentId ?? null,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      })
      .run();
  }

  private insertDiagramRow(diagram: Diagram) {
    this.db
      .insert(tables.diagrams)
      .values({
        id: diagram.id,
        workspaceId: diagram.workspaceId,
        name: diagram.name,
        kind: diagram.kind,
        query: diagram.query ? JSON.stringify(diagram.query) : null,
        view: JSON.stringify(diagram.view),
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
      })
      .run();
  }

  private insertBundle(bundle: Bundle) {
    this.insertWorkspaceRow(bundle.workspace);
    for (const component of bundle.components) this.insertComponentRow(component);
    for (const reference of bundle.references) this.insertReferenceRow(reference);
    for (const page of bundle.pages) this.insertPageRow(page);
    for (const diagram of bundle.diagrams) this.insertDiagramRow(diagram);
  }

  private deleteWorkspaceRows(id: string) {
    this.db.delete(tables.references).where(eq(tables.references.workspaceId, id)).run();
    this.db.delete(tables.pages).where(eq(tables.pages.workspaceId, id)).run();
    this.db.delete(tables.diagrams).where(eq(tables.diagrams.workspaceId, id)).run();
    this.db.delete(tables.components).where(eq(tables.components.workspaceId, id)).run();
    this.db.delete(tables.workspaces).where(eq(tables.workspaces.id, id)).run();
  }

  seedIfEmpty() {
    const count = this.db.select().from(tables.workspaces).all().length;
    if (count > 0) return this.listWorkspaces()[0] ?? null;
    const bundle = buildSampleWorkspace();
    this.tx(() => this.insertBundle(bundle));
    return bundle.workspace;
  }

  createEmptyWorkspace(name?: string): Result<Workspace> {
    const bundle = buildEmptyWorkspace(name);
    const parsed = parse<Bundle>(bundleSchema, bundle);
    if (!parsed.ok) return parsed;
    this.tx(() => this.insertBundle(parsed.data));
    return { ok: true, data: parsed.data.workspace };
  }

  updateWorkspace(id: string, patch: Partial<Pick<Workspace, "name" | "description" | "slug">>): Result<Workspace> {
    const current = this.loadWorkspace(id);
    if (!current) return failMsg("id", "workspace not found");
    const next = {
      ...current.workspace,
      ...patch,
      slug: patch.slug ?? (patch.name ? slugify(patch.name) : current.workspace.slug),
      updatedAt: nowIso(),
    };
    const parsed = parse<Workspace>(workspaceSchema, next);
    if (!parsed.ok) return parsed;
    this.db
      .update(tables.workspaces)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        slug: parsed.data.slug,
        updatedAt: parsed.data.updatedAt,
      })
      .where(eq(tables.workspaces.id, id))
      .run();
    return { ok: true, data: parsed.data };
  }

  deleteWorkspace(id: string): Result<{ id: string }> {
    const remaining = this.listWorkspaces().filter((w) => w.id !== id);
    if (remaining.length === 0) return failMsg("id", "cannot delete the last workspace");
    this.tx(() => this.deleteWorkspaceRows(id));
    return { ok: true, data: { id } };
  }

  resetToSample(): Workspace {
    const ids = this.listWorkspaces().map((w) => w.id);
    const bundle = buildSampleWorkspace();
    this.tx(() => {
      for (const id of ids) this.deleteWorkspaceRows(id);
      this.insertBundle(bundle);
    });
    return bundle.workspace;
  }

  private componentsOf(workspaceId: string) {
    return this.db
      .select()
      .from(tables.components)
      .where(eq(tables.components.workspaceId, workspaceId))
      .all()
      .map(rowToComponent);
  }

  private upsertContains(workspaceId: string, childId: string, parentId: string | undefined) {
    this.db
      .delete(tables.references)
      .where(
        and(
          eq(tables.references.workspaceId, workspaceId),
          eq(tables.references.type, "contains"),
          eq(tables.references.targetId, childId),
        ),
      )
      .run();
    if (!parentId) return;
    const existing = this.db
      .select()
      .from(tables.references)
      .where(
        and(
          eq(tables.references.workspaceId, workspaceId),
          eq(tables.references.type, "contains"),
          eq(tables.references.sourceId, parentId),
          eq(tables.references.targetId, childId),
        ),
      )
      .get();
    if (existing) return;
    const now = nowIso();
    this.insertReferenceRow({
      id: createId("reference"),
      workspaceId,
      type: "contains",
      sourceId: parentId,
      targetId: childId,
      createdAt: now,
      updatedAt: now,
    });
  }

  private upsertOwnedBy(workspaceId: string, sourceId: string, ownerId: string | undefined) {
    this.db
      .delete(tables.references)
      .where(
        and(
          eq(tables.references.workspaceId, workspaceId),
          eq(tables.references.type, "owned_by"),
          eq(tables.references.sourceId, sourceId),
        ),
      )
      .run();
    if (!ownerId) return;
    const now = nowIso();
    this.insertReferenceRow({
      id: createId("reference"),
      workspaceId,
      type: "owned_by",
      sourceId,
      targetId: ownerId,
      createdAt: now,
      updatedAt: now,
    });
  }

  createComponent(input: Component): Result<Component> {
    const parsed = parse<Component>(componentSchema, input);
    if (!parsed.ok) return parsed;
    const component = parsed.data;
    const all = this.componentsOf(component.workspaceId);
    if (component.parentId) {
      const parent = all.find((c) => c.id === component.parentId);
      if (!parent) return failMsg("parentId", "parent does not exist");
      if (!isReferenceAllowed("contains", parent.type, component.type)) {
        return failMsg("parentId", "parent must be the same type");
      }
    }
    if (component.ownerId) {
      const owner = all.find((c) => c.id === component.ownerId);
      if (!owner) return failMsg("ownerId", "owner does not exist");
      if (!isReferenceAllowed("owned_by", component.type, owner.type)) {
        return failMsg("ownerId", "owner must be a person or organization");
      }
    }
    const page: Page = {
      id: createId("page"),
      workspaceId: component.workspaceId,
      title: component.name,
      slug: slugify(component.name),
      order: 1000,
      doc: emptyDoc(),
      componentId: component.id,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
    };
    this.tx(() => {
      this.insertComponentRow(component);
      this.insertPageRow(page);
      this.upsertContains(component.workspaceId, component.id, component.parentId);
      this.upsertOwnedBy(component.workspaceId, component.id, component.ownerId);
    });
    return { ok: true, data: component };
  }

  updateComponent(id: string, patch: Record<string, unknown>): Result<Component> {
    const row = this.db.select().from(tables.components).where(eq(tables.components.id, id)).get();
    if (!row) return failMsg("id", "component not found");
    const current = rowToComponent(row);
    if (patch.type && patch.type !== current.type) {
      return failMsg("type", "component type is immutable");
    }
    const next = { ...current, ...patch, type: current.type, id: current.id, updatedAt: nowIso() };
    const parsed = parse<Component>(componentSchema, next);
    if (!parsed.ok) return parsed;
    const component = parsed.data;
    const all = this.componentsOf(component.workspaceId).filter((c) => c.id !== id);
    if (component.parentId === component.id) return failMsg("parentId", "self-references are not allowed");
    if (component.parentId) {
      const parent = [...all, current].find((c) => c.id === component.parentId);
      if (!parent) return failMsg("parentId", "parent does not exist");
      if (!isReferenceAllowed("contains", parent.type, component.type)) {
        return failMsg("parentId", "parent must be the same type");
      }
    }
    this.tx(() => {
      this.db.delete(tables.components).where(eq(tables.components.id, id)).run();
      this.insertComponentRow(component);
      if (component.name !== current.name) {
        this.db
          .update(tables.pages)
          .set({ title: component.name, slug: slugify(component.name), updatedAt: component.updatedAt })
          .where(eq(tables.pages.componentId, id))
          .run();
      }
      if (component.parentId !== current.parentId) {
        this.upsertContains(component.workspaceId, component.id, component.parentId);
      }
      if (component.ownerId !== current.ownerId) {
        this.upsertOwnedBy(component.workspaceId, component.id, component.ownerId);
      }
    });
    return { ok: true, data: component };
  }

  deleteComponent(id: string): Result<{ id: string }> {
    const row = this.db.select().from(tables.components).where(eq(tables.components.id, id)).get();
    if (!row) return failMsg("id", "component not found");
    this.tx(() => {
      this.db
        .delete(tables.references)
        .where(or(eq(tables.references.sourceId, id), eq(tables.references.targetId, id)))
        .run();
      this.db
        .update(tables.components)
        .set({ parentId: null, updatedAt: nowIso() })
        .where(eq(tables.components.parentId, id))
        .run();
      this.db
        .update(tables.components)
        .set({ ownerId: null, updatedAt: nowIso() })
        .where(eq(tables.components.ownerId, id))
        .run();
      this.db.delete(tables.pages).where(eq(tables.pages.componentId, id)).run();
      this.db
        .update(tables.references)
        .set({ viaId: null, updatedAt: nowIso() })
        .where(eq(tables.references.viaId, id))
        .run();
      const diagrams = this.db
        .select()
        .from(tables.diagrams)
        .where(eq(tables.diagrams.workspaceId, row.workspaceId))
        .all();
      for (const diagram of diagrams) {
        const parsed = rowToDiagram(diagram);
        const nodes = parsed.view.nodes.filter((node) => node.componentId !== id);
        if (nodes.length !== parsed.view.nodes.length) {
          this.db
            .update(tables.diagrams)
            .set({
              view: JSON.stringify({ ...parsed.view, nodes }),
              updatedAt: nowIso(),
            })
            .where(eq(tables.diagrams.id, diagram.id))
            .run();
        }
      }
      this.db.delete(tables.components).where(eq(tables.components.id, id)).run();
    });
    return { ok: true, data: { id } };
  }

  createReference(input: Reference): Result<Reference> {
    const parsed = parse<Reference>(referenceSchema, input);
    if (!parsed.ok) return parsed;
    const reference = parsed.data;
    if (reference.sourceId === reference.targetId) {
      return failMsg("targetId", "self-references are not allowed");
    }
    const sourceRow = this.db.select().from(tables.components).where(eq(tables.components.id, reference.sourceId)).get();
    const targetRow = this.db.select().from(tables.components).where(eq(tables.components.id, reference.targetId)).get();
    if (!sourceRow) return failMsg("sourceId", "source does not exist");
    if (!targetRow) return failMsg("targetId", "target does not exist");
    const source = rowToComponent(sourceRow);
    const target = rowToComponent(targetRow);
    if (!isReferenceAllowed(reference.type, source.type, target.type)) {
      return failMsg("type", `${reference.type} is not allowed from ${source.type} to ${target.type}`);
    }
    if (reference.viaId) {
      const viaRow = this.db.select().from(tables.components).where(eq(tables.components.id, reference.viaId)).get();
      if (!viaRow) return failMsg("viaId", "interface does not exist");
      if (rowToComponent(viaRow).type !== "interface") return failMsg("viaId", "viaId must be an interface");
    }
    const dup = this.db
      .select()
      .from(tables.references)
      .where(
        and(
          eq(tables.references.sourceId, reference.sourceId),
          eq(tables.references.targetId, reference.targetId),
          eq(tables.references.type, reference.type),
        ),
      )
      .get();
    if (dup) return { ok: true, data: rowToReference(dup) };
    this.tx(() => {
      if (reference.type === "contains") {
        this.db
          .delete(tables.references)
          .where(
            and(
              eq(tables.references.type, "contains"),
              eq(tables.references.targetId, reference.targetId),
            ),
          )
          .run();
        this.db
          .update(tables.components)
          .set({ parentId: reference.sourceId, updatedAt: nowIso() })
          .where(eq(tables.components.id, reference.targetId))
          .run();
      }
      if (reference.type === "owned_by") {
        this.db
          .delete(tables.references)
          .where(
            and(
              eq(tables.references.type, "owned_by"),
              eq(tables.references.sourceId, reference.sourceId),
            ),
          )
          .run();
        this.db
          .update(tables.components)
          .set({ ownerId: reference.targetId, updatedAt: nowIso() })
          .where(eq(tables.components.id, reference.sourceId))
          .run();
      }
      this.insertReferenceRow(reference);
    });
    return { ok: true, data: reference };
  }

  deleteReference(id: string): Result<{ id: string }> {
    const row = this.db.select().from(tables.references).where(eq(tables.references.id, id)).get();
    if (!row) return failMsg("id", "reference not found");
    this.tx(() => {
      if (row.type === "contains") {
        this.db
          .update(tables.components)
          .set({ parentId: null, updatedAt: nowIso() })
          .where(eq(tables.components.id, row.targetId))
          .run();
      }
      if (row.type === "owned_by") {
        this.db
          .update(tables.components)
          .set({ ownerId: null, updatedAt: nowIso() })
          .where(eq(tables.components.id, row.sourceId))
          .run();
      }
      this.db.delete(tables.references).where(eq(tables.references.id, id)).run();
    });
    return { ok: true, data: { id } };
  }

  createPage(input: Page): Result<Page> {
    const parsed = parse<Page>(pageSchema, input);
    if (!parsed.ok) return parsed;
    const page = parsed.data;
    const mentionErrors = [
      ...assertMentions(page.doc),
      ...assertHttpsImages(page.doc),
    ].map((message) => ({ path: "doc", message }));
    if (mentionErrors.length) return fail(mentionErrors);
    if (page.parentId) {
      const parent = this.db.select().from(tables.pages).where(eq(tables.pages.id, page.parentId)).get();
      if (!parent) return failMsg("parentId", "parent page does not exist");
    }
    this.insertPageRow(page);
    return { ok: true, data: page };
  }

  updatePage(id: string, patch: Partial<Page>): Result<Page> {
    const row = this.db.select().from(tables.pages).where(eq(tables.pages.id, id)).get();
    if (!row) return failMsg("id", "page not found");
    const current = rowToPage(row);
    const next = { ...current, ...patch, id: current.id, updatedAt: nowIso() };
    const parsed = parse<Page>(pageSchema, next);
    if (!parsed.ok) return parsed;
    const page = parsed.data;
    const mentionErrors = [
      ...assertMentions(page.doc),
      ...assertHttpsImages(page.doc),
    ].map((message) => ({ path: "doc", message }));
    if (mentionErrors.length) return fail(mentionErrors);
    if (page.parentId === page.id) return failMsg("parentId", "self-references are not allowed");
    this.db.delete(tables.pages).where(eq(tables.pages.id, id)).run();
    this.insertPageRow(page);
    return { ok: true, data: page };
  }

  deletePage(id: string): Result<{ id: string }> {
    const row = this.db.select().from(tables.pages).where(eq(tables.pages.id, id)).get();
    if (!row) return failMsg("id", "page not found");
    const children = this.db.select().from(tables.pages).where(eq(tables.pages.parentId, id)).all();
    if (children.length > 0) return failMsg("id", "delete child pages first");
    this.db.delete(tables.pages).where(eq(tables.pages.id, id)).run();
    return { ok: true, data: { id } };
  }

  createDiagram(input: Diagram): Result<Diagram> {
    const parsed = parse<Diagram>(diagramSchema, input);
    if (!parsed.ok) return parsed;
    if (parsed.data.kind === "live" && !parsed.data.query) {
      return failMsg("query", "live diagrams require a query");
    }
    this.insertDiagramRow(parsed.data);
    return { ok: true, data: parsed.data };
  }

  updateDiagram(id: string, patch: Partial<Diagram>): Result<Diagram> {
    const row = this.db.select().from(tables.diagrams).where(eq(tables.diagrams.id, id)).get();
    if (!row) return failMsg("id", "diagram not found");
    const current = rowToDiagram(row);
    const next = { ...current, ...patch, id: current.id, updatedAt: nowIso() };
    const parsed = parse<Diagram>(diagramSchema, next);
    if (!parsed.ok) return parsed;
    this.db.delete(tables.diagrams).where(eq(tables.diagrams.id, id)).run();
    this.insertDiagramRow(parsed.data);
    return { ok: true, data: parsed.data };
  }

  deleteDiagram(id: string): Result<{ id: string }> {
    const row = this.db.select().from(tables.diagrams).where(eq(tables.diagrams.id, id)).get();
    if (!row) return failMsg("id", "diagram not found");
    this.db.delete(tables.diagrams).where(eq(tables.diagrams.id, id)).run();
    return { ok: true, data: { id } };
  }

  exportBundle(workspaceId: string): Result<Bundle> {
    const loaded = this.loadWorkspace(workspaceId);
    if (!loaded) return failMsg("workspaceId", "workspace not found");
    const bundle = { ...loaded, exportedAt: nowIso() };
    const parsed = parse<Bundle>(bundleSchema, bundle);
    if (!parsed.ok) return parsed;
    const integrity = integrityErrors(parsed.data);
    if (integrity.length) return fail(integrity);
    return { ok: true, data: parsed.data };
  }

  importBundle(raw: unknown, mode: { type: "new" } | { type: "replace"; workspaceId: string }): Result<Bundle> {
    const parsed = parse<Bundle>(bundleSchema, raw);
    if (!parsed.ok) return parsed;
    const stripped = stripDanglingDiagramNodes(parsed.data);
    const integrity = integrityErrors(stripped.bundle);
    if (integrity.length) return fail(integrity);
    if (mode.type === "new") {
      const remapped = remapBundle(stripped.bundle, createId("workspace"));
      const again = parse<Bundle>(bundleSchema, remapped);
      if (!again.ok) return again;
      this.tx(() => this.insertBundle(again.data));
      return { ok: true, data: again.data, warnings: stripped.warnings };
    }
    const remapped = remapBundle(stripped.bundle, mode.workspaceId);
    const again = parse<Bundle>(bundleSchema, remapped);
    if (!again.ok) return again;
    this.tx(() => {
      this.deleteWorkspaceRows(mode.workspaceId);
      this.insertBundle(again.data);
    });
    return { ok: true, data: again.data, warnings: stripped.warnings };
  }
}
