---
name: change-metamodel
description: Adds or changes Lattice component types, reference types, or legal edge pairs in starter-v1. Use when the user mentions metamodel, component type, reference type, contains/supports/realizes/uses/depends_on/owned_by/integrates_with/runs_on, or allowed relationships.
---

# Change the Lattice metamodel

Do not invent edge rules. Read `src/schema/metamodel.ts` and confirm with the **lattice** MCP (`lattice_metamodel`, `lattice_legal_references`).

## Checklist

Copy and track:

```
- [ ] src/schema/common.ts (enums)
- [ ] src/schema/component.ts (discriminated union + extras fields)
- [ ] src/schema/metamodel.ts (referenceRules + componentTypeMeta + helpers)
- [ ] src/lib/draft.ts (draftForType)
- [ ] src/db/repository.ts (extrasFrom / rowToComponent if new extras)
- [ ] src/pages/CatalogDetailPage.tsx (type-specific fields)
- [ ] src/lib/graph.ts (live presets if the type should appear on a map)
- [ ] src/lib/layout.ts (only if a new visual kind is required)
- [ ] src/data/seed.ts (Northstar example)
- [ ] src/schema/schema.test.ts (allow + reject cases)
- [ ] pnpm schema:export
- [ ] pnpm test
```

## Rules that must stay true

- `contains` is same-type only (`isContainsPair`). `canHaveParent` / `canHaveOwner` derive from `referenceRules`.
- One `contains` parent and one `owned_by` owner. Columns `parentId` / `ownerId` must match those edges (`src/db/integrity.ts`).
- `viaId` is an `interface` component, used on application-to-application edges.
- Type colors: add `label`, `plural`, `color`, `hex` to `componentTypeMeta`. UI reads that map.

## After code changes

1. `pnpm schema:export`
2. `lattice_validate_bundle` on `buildSampleWorkspace()` output, or `pnpm test`
3. If a live map should show the new type, update the preset filter in `src/lib/graph.ts`

Do not hand-edit `schemas/*.schema.json`.
