# Lattice

Local-first architecture studio. Typed graph is source of truth; pages are prose with `@mentions`; diagrams are views (live maps layout from the graph, boards remember positions).

## Stack

React 19, Vite, Tailwind 4, Zod 4, Drizzle, sql.js (browser SQLite), Zustand, TipTap, xyflow, elkjs. Package manager: **pnpm**.

## Layout

| Path | Role |
| --- | --- |
| `src/schema/` | Only type source. Zod models; `safeParse` on every write/import |
| `schemas/` | Generated JSON Schema Draft 2020-12. Never hand-edit |
| `src/db/` | sql.js + Drizzle tables, migrations, repository, integrity |
| `src/store/workspace.ts` | Zustand. UI calls store; store calls `WorkspaceRepo` |
| `src/data/seed.ts` | Northstar sample + empty workspace |
| `src/lib/graph.ts` | Live-map queries |
| `src/lib/layout.ts` | ELK / map layout |
| `src/components/ui/` | Existing primitives (Radix + CVA). Reuse before adding |

Alias: `@/` → `src/`.

## Commands

```bash
pnpm install
pnpm schema:export    # after any src/schema change
pnpm test
pnpm lint
pnpm dev              # http://localhost:5173
pnpm build
```

Storage is OPFS (IndexedDB fallback). Nothing is written to a workspace file on disk.

## Invariants

- Writes return `Result<T>` (`src/schema/result.ts`). Surface `errors[].path` (e.g. `components[3].lifecycle`). Never swallow Zod failures.
- `parentId` must match a `contains` edge; `ownerId` must match `owned_by`. Same-type contains only. One parent, one owner.
- Diagram node labels are not source of truth — join `componentId` to `components[]`.
- IDs: `ws_`, `cmp_`, `ref_`, `pg_`, `dia_` + 12-char nanoid (`src/lib/ids.ts`).
- Type-specific fields live in SQLite `components.extras` JSON via `extrasFrom` in `src/db/repository.ts`.
- Mentions need `id`, `label`, `mentionType`. Images must be http(s), never `data:` / `blob:`.

## Metamodel (`starter-v1`)

Types: organization, capability, workflow, process, application, person, technology, interface.

Legal edges: see `src/schema/metamodel.ts`. Use the **lattice** MCP (`lattice_metamodel`, `lattice_legal_references`, `lattice_validate_bundle`) instead of guessing.

## Agent tools

- **lattice MCP**: live metamodel + bundle validation against Zod and integrity.
- **Context7 MCP**: current docs for Zod 4, React 19, TipTap, xyflow, Drizzle, Tailwind 4.
- **Browser MCP**: UI checks at `http://localhost:5173` after `pnpm dev`. First launch loads Northstar.

Prefer `pnpm test` over re-deriving seed/integrity by hand.
