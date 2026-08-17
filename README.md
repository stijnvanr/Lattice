# Lattice

A local-first architecture studio — graph, docs, and diagrams in the browser.

The typed graph is the source of truth. Pages are prose with `@mentions`. Diagrams are views: live maps layout from the graph, boards remember positions. Connecting two component nodes creates a typed reference.

First launch loads **Northstar**, a small invoicing-SaaS sample. It shows the client story (capabilities, workflows, pages) and the delivery story (applications, interfaces, technology) on the same graph.

## Features

- **Catalog** — organizations, capabilities, workflows, processes, applications, people, technology, and interfaces
- **Typed references** — `contains`, `supports`, `realizes`, `uses`, `depends on`, `owned by`, `integrates with`, `runs on`
- **Pages** — wiki-style documents that mention catalog objects
- **Diagrams** — live maps (capability, workflow, application landscape, neighborhood) and freeform boards
- **Local-first storage** — SQLite in the browser via sql.js; Origin Private File Storage with IndexedDB fallback
- **Portable JSON** — export and import a workspace bundle, validated on every write

Nothing is written to a file on disk. The workspace stays in the browser until you export it.

## Requirements

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 11 or later

## Getting started

```bash
pnpm install
pnpm schema:export
pnpm test
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### Day one

1. Read **Start here** on Pages
2. Catalog: capabilities, then workflows, then applications
3. Live maps: capability map, workflow map, application landscape
4. Board: connect two apps to create a reference
5. Export JSON; import as a second workspace
6. Header overflow **Reset to sample** reloads Northstar

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck and production build |
| `pnpm preview` | Serve the production build |
| `pnpm test` | Vitest |
| `pnpm lint` | Oxlint |
| `pnpm schema:export` | Write JSON Schema from Zod |

## Schema contract

Zod in `src/schema` is the only type source. `pnpm schema:export` writes `schemas/*.schema.json` (JSON Schema Draft 2020-12). Every write and import `safeParse`s.

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

Validate with `schemas/bundle.schema.json`. Diagram node labels are not source of truth — join `componentId` to `components[]`. See [schemas/README.md](schemas/README.md).

## Project layout

```
src/
  schema/     Zod models and metamodel rules
  db/         sql.js, Drizzle, persistence, integrity
  store/      workspace actions
  pages/      Home, Catalog, Pages, Diagrams
  data/       Northstar sample
schemas/      generated JSON Schema (AI/assistant contract)
scripts/      schema export
```

## Stack

React 19, Vite, Tailwind, Zod 4, Drizzle, sql.js, TipTap, xyflow, elkjs.

## License

[MIT](LICENSE) © Dennis Vercauteren
