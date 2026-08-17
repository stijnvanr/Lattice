---
name: add-component-field
description: Adds a type-specific field on a Lattice component (application extras, capability level, person email/role). Use when adding lifecycle, criticality, vendor, URL, level, email, or other per-type attributes stored in extras JSON.
---

# Add a component field

Type-specific data is **not** a new SQLite column. It lives in `components.extras` JSON.

## Steps

1. Add the field on the matching Zod object in `src/schema/component.ts` (e.g. `applicationSchema`).
2. Extend `extrasFrom` and `rowToComponent` in `src/db/repository.ts` so the field round-trips.
3. Default it in `src/lib/draft.ts`.
4. Edit UI in `src/pages/CatalogDetailPage.tsx` (and create dialog in `CatalogPage.tsx` only if the field is required at create time).
5. Update Northstar in `src/data/seed.ts` if the sample should show it.
6. Add a `safeParse` failure path test in `src/schema/schema.test.ts` (copy the `lifecycle: "nope"` pattern).
7. `pnpm schema:export && pnpm test`

## Pattern

```ts
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
```

Do not add columns to `src/db/migrate.ts` for extras fields. Shared fields (name, status, tags, parent, owner) stay as columns.
