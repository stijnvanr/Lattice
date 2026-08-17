---
name: edit-northstar
description: Edits the Northstar sample workspace or empty-workspace seed. Use when changing seed data, sample components, Start here pages, sample diagrams, or reset-to-sample behavior.
---

# Edit Northstar seed

Canonical file: `src/data/seed.ts`.

## Constraints

- Use `createId()` prefixes (`ws_`, `cmp_`, `ref_`, `pg_`, `dia_`) or the existing stable seed IDs already in the file. Do not invent unprefixed IDs.
- Every component `parentId` needs a matching `contains` reference; every `ownerId` needs `owned_by`.
- Mentions in TipTap docs: `{ type: "mention", attrs: { id, label, mentionType: "component" | "page" } }`.
- Live diagrams need `kind: "live"` and `query.preset`. Neighborhood needs `query.rootId`.
- `workspace.metamodelId` is `METAMODEL_ID`. `schemaVersion` is `SCHEMA_VERSION`.

## Verify

```bash
pnpm test
```

Northstar must satisfy:

```ts
bundleSchema.safeParse(buildSampleWorkspace()).success === true
integrityErrors(buildSampleWorkspace()) === []
```

Optional: MCP `lattice_validate_bundle` with the seed JSON.

After seed changes, **Reset to sample** in the app header (overflow) reloads Northstar only when the data epoch in `src/store/workspace.ts` changes. If existing browsers must pick up a new sample, bump `DATA_EPOCH`.
