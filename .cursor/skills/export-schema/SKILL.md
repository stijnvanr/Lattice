---
name: export-schema
description: Regenerates Lattice JSON Schema from Zod after src/schema changes. Use when editing Zod models, SCHEMA_VERSION, bundle/component/page/diagram schemas, or when the user mentions schema export, JSON Schema, or schemas/*.schema.json.
---

# Export JSON Schema

`src/schema` is the source. `schemas/*.schema.json` is generated.

## Steps

1. Change Zod only under `src/schema`.
2. Run `pnpm schema:export` (see `scripts/schema-export.ts`).
3. Confirm `schemas/*.schema.json` `$id` stays `https://lattice.local/schemas/{name}.schema.json` and dialect Draft 2020-12.
4. Run `pnpm test`.
5. If `SCHEMA_VERSION` changed, update seed bundles and any docs that mention `1.0.0`.

## Do not

- Hand-edit `schemas/*.schema.json`
- Skip export after a Zod change (import/export and assistants consume the JSON files)
- Use Zod 3 APIs — this repo is Zod 4 (`z.toJSONSchema`, `z.discriminatedUnion`)
