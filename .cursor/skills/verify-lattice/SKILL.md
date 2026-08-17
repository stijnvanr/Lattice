---
name: verify-lattice
description: Runs Lattice tests, schema export, lint, and optional browser checks on localhost:5173. Use when verifying a change, before claiming done, or when the user asks to test, lint, or click through the app.
---

# Verify Lattice

## Always

```bash
pnpm schema:export
pnpm test
pnpm lint
```

If you changed `src/schema`, confirm `git diff schemas/` is the expected JSON Schema churn only.

## Optional typecheck/build

```bash
pnpm build
```

Use when touching `tsconfig`, Vite, or sql.js WASM loading.

## UI (when the change is visible)

1. `pnpm dev` if nothing is on port 5173.
2. Browser MCP: open `http://localhost:5173`.
3. First load shows **Northstar**. Check the surface you changed (Catalog / Pages / Diagrams).
4. Header overflow **Reset to sample** if the graph looks like stale local data.

Do not treat diagram labels as data — inspect catalog records. Export JSON from the header if you need a bundle to pass to `lattice_validate_bundle`.
