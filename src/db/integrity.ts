import type { Bundle } from "@/schema/bundle";
import type { Component } from "@/schema/component";
import { isReferenceAllowed } from "@/schema/metamodel";
import { assertHttpsImages, assertMentions } from "@/schema/page";
import type { FieldError } from "@/schema/result";

function err(path: string, message: string): FieldError {
  return { path, message };
}

function hasCycle(ids: Map<string, string | undefined>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const parent = ids.get(id);
    if (parent && visit(parent)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of ids.keys()) {
    if (visit(id)) return true;
  }
  return false;
}

export function stripDanglingDiagramNodes(bundle: Bundle) {
  const ids = new Set(bundle.components.map((c) => c.id));
  const warnings: string[] = [];
  const diagrams = bundle.diagrams.map((diagram) => {
    const kept = diagram.view.nodes.filter((node) => {
      if (node.kind !== "component" || !node.componentId) return true;
      return ids.has(node.componentId);
    });
    const stripped = diagram.view.nodes.length - kept.length;
    if (stripped > 0) {
      warnings.push(`${diagram.name}: removed ${stripped} dangling node(s)`);
    }
    return { ...diagram, view: { ...diagram.view, nodes: kept } };
  });
  return { bundle: { ...bundle, diagrams }, warnings };
}

export function integrityErrors(bundle: Bundle): FieldError[] {
  const errors: FieldError[] = [];
  const wsId = bundle.workspace.id;
  const components = new Map(bundle.components.map((c) => [c.id, c]));
  const pages = new Map(bundle.pages.map((p) => [p.id, p]));

  const unique = (items: { id: string }[], path: string) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) errors.push(err(`${path}[${index}].id`, "duplicate id"));
      seen.add(item.id);
    });
  };
  unique(bundle.components, "components");
  unique(bundle.references, "references");
  unique(bundle.pages, "pages");
  unique(bundle.diagrams, "diagrams");

  bundle.components.forEach((component, index) => {
    if (component.workspaceId !== wsId) {
      errors.push(err(`components[${index}].workspaceId`, "must match workspace.id"));
    }
    if (component.parentId && !components.has(component.parentId)) {
      errors.push(err(`components[${index}].parentId`, "parent does not exist"));
    }
    if (component.ownerId && !components.has(component.ownerId)) {
      errors.push(err(`components[${index}].ownerId`, "owner does not exist"));
    }
  });

  bundle.references.forEach((reference, index) => {
    if (reference.workspaceId !== wsId) {
      errors.push(err(`references[${index}].workspaceId`, "must match workspace.id"));
    }
    if (reference.sourceId === reference.targetId) {
      errors.push(err(`references[${index}]`, "self-references are not allowed"));
    }
    const source = components.get(reference.sourceId);
    const target = components.get(reference.targetId);
    if (!source) errors.push(err(`references[${index}].sourceId`, "source does not exist"));
    if (!target) errors.push(err(`references[${index}].targetId`, "target does not exist"));
    if (source && target && !isReferenceAllowed(reference.type, source.type, target.type)) {
      errors.push(
        err(
          `references[${index}].type`,
          `${reference.type} is not allowed from ${source.type} to ${target.type}`,
        ),
      );
    }
    if (reference.viaId) {
      const via = components.get(reference.viaId);
      if (!via) errors.push(err(`references[${index}].viaId`, "interface does not exist"));
      else if (via.type !== "interface") {
        errors.push(err(`references[${index}].viaId`, "viaId must be an interface"));
      }
    }
  });

  const seenEdges = new Set<string>();
  const containsByChild = new Map<string, string>();
  const ownedBySource = new Map<string, string>();
  bundle.references.forEach((reference, index) => {
    const key = `${reference.sourceId}\0${reference.targetId}\0${reference.type}`;
    if (seenEdges.has(key)) {
      errors.push(err(`references[${index}]`, "duplicate edge"));
    }
    seenEdges.add(key);
    if (reference.type === "contains") {
      if (containsByChild.has(reference.targetId)) {
        errors.push(err(`references[${index}]`, "a component can have only one parent"));
      }
      containsByChild.set(reference.targetId, reference.sourceId);
    }
    if (reference.type === "owned_by") {
      if (ownedBySource.has(reference.sourceId)) {
        errors.push(err(`references[${index}]`, "a component can have only one owner"));
      }
      ownedBySource.set(reference.sourceId, reference.targetId);
    }
  });

  bundle.components.forEach((component, index) => {
    const parentFromEdge = containsByChild.get(component.id);
    if ((component.parentId ?? undefined) !== parentFromEdge) {
      errors.push(err(`components[${index}].parentId`, "must match the contains edge"));
    }
    const ownerFromEdge = ownedBySource.get(component.id);
    if ((component.ownerId ?? undefined) !== ownerFromEdge) {
      errors.push(err(`components[${index}].ownerId`, "must match the owned_by edge"));
    }
  });

  const parentOf = new Map<string, string | undefined>();
  bundle.pages.forEach((page, index) => {
    if (page.workspaceId !== wsId) {
      errors.push(err(`pages[${index}].workspaceId`, "must match workspace.id"));
    }
    if (page.parentId && !pages.has(page.parentId)) {
      errors.push(err(`pages[${index}].parentId`, "parent page does not exist"));
    }
    if (page.componentId && !components.has(page.componentId)) {
      errors.push(err(`pages[${index}].componentId`, "linked component does not exist"));
    }
    parentOf.set(page.id, page.parentId);
    errors.push(
      ...assertMentions(page.doc).map((message) => err(`pages[${index}].doc`, message)),
    );
    errors.push(
      ...assertHttpsImages(page.doc).map((message) => err(`pages[${index}].doc`, message)),
    );
  });
  if (hasCycle(parentOf)) {
    errors.push(err("pages", "page parent cycle detected"));
  }

  const componentParents = new Map<string, string | undefined>();
  for (const component of bundle.components) {
    componentParents.set(component.id, component.parentId);
  }
  if (hasCycle(componentParents)) {
    errors.push(err("components", "component parent cycle detected"));
  }

  bundle.diagrams.forEach((diagram, index) => {
    if (diagram.workspaceId !== wsId) {
      errors.push(err(`diagrams[${index}].workspaceId`, "must match workspace.id"));
    }
    if (diagram.kind === "live" && !diagram.query) {
      errors.push(err(`diagrams[${index}].query`, "live diagrams require a query"));
    }
    if (diagram.query?.preset === "neighborhood" && !diagram.query.rootId) {
      errors.push(err(`diagrams[${index}].query.rootId`, "neighborhood requires rootId"));
    }
  });

  return errors;
}

export function componentById(components: Component[], id: string) {
  return components.find((c) => c.id === id);
}
