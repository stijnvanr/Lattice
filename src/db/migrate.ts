import type { Database } from "sql.js";

const statements = [
  `PRAGMA foreign_keys = ON;`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    slug TEXT NOT NULL,
    metamodel_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    tags TEXT NOT NULL,
    owner_id TEXT,
    parent_id TEXT,
    extras TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "references" (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    via_id TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    doc TEXT NOT NULL,
    component_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    query TEXT,
    view TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS references_edge ON "references"(source_id, target_id, type);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pages_component_id ON pages(component_id) WHERE component_id IS NOT NULL;`,
];

export function migrate(sqlite: Database) {
  for (const sql of statements) {
    sqlite.run(sql);
  }
}
