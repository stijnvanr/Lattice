# Lattice JSON Schemas

These files are generated from Zod in `src/schema` (`pnpm schema:export`).
They are the AI/assistant contract for a workspace export.

- Dialect: JSON Schema Draft 2020-12
- `$id`: `https://lattice.local/schemas/{name}.schema.json`

## Bundle

A workspace export is one JSON document:

```json
{
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-03-01T09:00:00.000Z",
  "workspace": {},
  "components": [],
  "references": [],
  "pages": [],
  "diagrams": []
}
```

Validate with `bundle.schema.json`. Writes in the app use the same Zod models (`safeParse`) and return field paths such as `components[3].lifecycle`.

Do not treat diagram node labels as source of truth. Join `componentId` to `components[]`.
