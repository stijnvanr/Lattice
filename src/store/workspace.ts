import { create } from "zustand";
import { attachFlushListeners, bootEngine, getEngine, markDirty, resetEngine } from "@/db/client";
import { WorkspaceRepo } from "@/db/repository";
import { createId, nowIso, slugify } from "@/lib/ids";
import type { Bundle } from "@/schema/bundle";
import type { Component, ComponentDraft } from "@/schema/component";
import type { Diagram } from "@/schema/diagram";
import { emptyDoc, type Page, type TiptapDoc } from "@/schema/page";
import type { Reference } from "@/schema/reference";
import type { FieldError, Result } from "@/schema/result";
import type { Workspace } from "@/schema/workspace";

const CURRENT_KEY = "lattice.currentWorkspaceId";
const DATA_EPOCH_KEY = "lattice.dataEpoch";
const DATA_EPOCH = "northstar-1";
const LEGACY_CURRENT_KEY = "kubuz.currentWorkspaceId";
const LEGACY_EPOCH_KEY = "kubuz.dataEpoch";

function repo() {
  return new WorkspaceRepo(getEngine());
}

function persistId(id: string) {
  localStorage.setItem(CURRENT_KEY, id);
}

type Graph = {
  workspace: Workspace;
  components: Component[];
  references: Reference[];
  pages: Page[];
  diagrams: Diagram[];
};

type Store = {
  ready: boolean;
  saving: boolean;
  error: string | null;
  workspaces: Workspace[];
  currentId: string | null;
  graph: Graph | null;
  boot: () => Promise<void>;
  refresh: () => void;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name?: string) => Result<Workspace>;
  updateWorkspace: (patch: Partial<Pick<Workspace, "name" | "description">>) => Result<Workspace>;
  deleteWorkspace: (id: string) => Result<{ id: string }>;
  resetLocalData: () => Promise<void>;
  createComponent: (input: ComponentDraft & { id?: string }) => Result<Component>;
  updateComponent: (id: string, patch: Record<string, unknown>) => Result<Component>;
  deleteComponent: (id: string) => Result<{ id: string }>;
  createReference: (input: Omit<Reference, "id" | "workspaceId" | "createdAt" | "updatedAt"> & { id?: string }) => Result<Reference>;
  deleteReference: (id: string) => Result<{ id: string }>;
  createPage: (input: { title: string; parentId?: string; doc?: TiptapDoc }) => Result<Page>;
  updatePage: (id: string, patch: Partial<Page>) => Result<Page>;
  deletePage: (id: string) => Result<{ id: string }>;
  createDiagram: (input: Omit<Diagram, "id" | "workspaceId" | "createdAt" | "updatedAt">) => Result<Diagram>;
  updateDiagram: (id: string, patch: Partial<Diagram>) => Result<Diagram>;
  deleteDiagram: (id: string) => Result<{ id: string }>;
  exportBundle: () => Result<Bundle>;
  importBundle: (raw: unknown, mode: "new" | "replace") => Result<Bundle>;
};

function hydrate(currentId?: string | null): Pick<Store, "workspaces" | "currentId" | "graph"> {
  const r = repo();
  const workspaces = r.listWorkspaces();
  const preferred = currentId ?? localStorage.getItem(CURRENT_KEY);
  const current = workspaces.find((w) => w.id === preferred) ?? workspaces[0] ?? null;
  if (!current) {
    return { workspaces, currentId: null, graph: null };
  }
  persistId(current.id);
  const bundle = r.loadWorkspace(current.id);
  if (!bundle) return { workspaces, currentId: current.id, graph: null };
  return {
    workspaces,
    currentId: current.id,
    graph: {
      workspace: bundle.workspace,
      components: bundle.components,
      references: bundle.references,
      pages: bundle.pages,
      diagrams: bundle.diagrams,
    },
  };
}

function afterWrite<T>(set: (partial: Partial<Store>) => void, result: Result<T>): Result<T> {
  if (result.ok) {
    markDirty();
    set({ ...hydrate(), saving: false });
  }
  return result;
}

export const useWorkspace = create<Store>((set, get) => ({
  ready: false,
  saving: false,
  error: null,
  workspaces: [],
  currentId: null,
  graph: null,

  boot: async () => {
    try {
      await bootEngine();
      attachFlushListeners();
      if (localStorage.getItem(DATA_EPOCH_KEY) !== DATA_EPOCH) {
        await resetEngine();
        localStorage.setItem(DATA_EPOCH_KEY, DATA_EPOCH);
        localStorage.removeItem(CURRENT_KEY);
        localStorage.removeItem(LEGACY_CURRENT_KEY);
        localStorage.removeItem(LEGACY_EPOCH_KEY);
      } else if (get().ready && !get().error) {
        return;
      }
      repo().seedIfEmpty();
      markDirty();
      set({ ready: true, error: null, ...hydrate() });
    } catch (error) {
      set({
        ready: true,
        error: error instanceof Error ? error.message : "Failed to open local database",
      });
    }
  },

  refresh: () => set(hydrate(get().currentId)),

  switchWorkspace: (id) => set(hydrate(id)),

  createWorkspace: (name) => {
    const result = repo().createEmptyWorkspace(name);
    if (result.ok) {
      persistId(result.data.id);
      markDirty();
      set({ ...hydrate(result.data.id) });
    }
    return result;
  },

  updateWorkspace: (patch) => {
    const id = get().currentId;
    if (!id) return { ok: false, errors: [{ path: "id", message: "no workspace" }] };
    return afterWrite(set, repo().updateWorkspace(id, patch));
  },

  deleteWorkspace: (id) => {
    const result = repo().deleteWorkspace(id);
    if (result.ok) {
      markDirty();
      set(hydrate());
    }
    return result;
  },

  resetLocalData: async () => {
    await resetEngine();
    localStorage.setItem(DATA_EPOCH_KEY, DATA_EPOCH);
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(LEGACY_CURRENT_KEY);
    localStorage.removeItem(LEGACY_EPOCH_KEY);
    repo().seedIfEmpty();
    markDirty();
    const untitled = repo().listWorkspaces()[0];
    if (untitled) persistId(untitled.id);
    set({ ...hydrate(), error: null });
  },

  createComponent: (input) => {
    const graph = get().graph;
    if (!graph) return { ok: false, errors: [{ path: "workspaceId", message: "no workspace" }] };
    const now = nowIso();
    const component = {
      ...input,
      id: input.id ?? createId("component"),
      workspaceId: graph.workspace.id,
      createdAt: now,
      updatedAt: now,
    } as Component;
    return afterWrite(set, repo().createComponent(component));
  },

  updateComponent: (id, patch) => afterWrite(set, repo().updateComponent(id, patch)),
  deleteComponent: (id) => afterWrite(set, repo().deleteComponent(id)),

  createReference: (input) => {
    const graph = get().graph;
    if (!graph) return { ok: false, errors: [{ path: "workspaceId", message: "no workspace" }] };
    const now = nowIso();
    const reference: Reference = {
      ...input,
      id: input.id ?? createId("reference"),
      workspaceId: graph.workspace.id,
      createdAt: now,
      updatedAt: now,
    };
    return afterWrite(set, repo().createReference(reference));
  },

  deleteReference: (id) => afterWrite(set, repo().deleteReference(id)),

  createPage: (input) => {
    const graph = get().graph;
    if (!graph) return { ok: false, errors: [{ path: "workspaceId", message: "no workspace" }] };
    const now = nowIso();
    const siblings = graph.pages.filter((p) => p.parentId === input.parentId && !p.componentId);
    const page: Page = {
      id: createId("page"),
      workspaceId: graph.workspace.id,
      parentId: input.parentId,
      title: input.title,
      slug: slugify(input.title),
      order: siblings.length,
      doc: input.doc ?? emptyDoc(),
      createdAt: now,
      updatedAt: now,
    };
    return afterWrite(set, repo().createPage(page));
  },

  updatePage: (id, patch) => afterWrite(set, repo().updatePage(id, patch)),
  deletePage: (id) => afterWrite(set, repo().deletePage(id)),

  createDiagram: (input) => {
    const graph = get().graph;
    if (!graph) return { ok: false, errors: [{ path: "workspaceId", message: "no workspace" }] };
    const now = nowIso();
    const diagram: Diagram = {
      ...input,
      id: createId("diagram"),
      workspaceId: graph.workspace.id,
      createdAt: now,
      updatedAt: now,
    };
    return afterWrite(set, repo().createDiagram(diagram));
  },

  updateDiagram: (id, patch) => afterWrite(set, repo().updateDiagram(id, patch)),
  deleteDiagram: (id) => afterWrite(set, repo().deleteDiagram(id)),

  exportBundle: () => {
    const id = get().currentId;
    if (!id) return { ok: false, errors: [{ path: "workspaceId", message: "no workspace" }] };
    return repo().exportBundle(id);
  },

  importBundle: (raw, mode) => {
    const currentId = get().currentId;
    const result =
      mode === "replace" && currentId
        ? repo().importBundle(raw, { type: "replace", workspaceId: currentId })
        : repo().importBundle(raw, { type: "new" });
    if (result.ok) {
      persistId(result.data.workspace.id);
      markDirty();
      set(hydrate(result.data.workspace.id));
    }
    return result;
  },
}));

export function wikiPages(pages: Page[]) {
  return pages.filter((page) => !page.componentId);
}

export function autoPageFor(pages: Page[], componentId: string) {
  return pages.find((page) => page.componentId === componentId);
}

export function toastErrors(errors: FieldError[]) {
  return errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join("\n");
}
