import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import type { Database } from "sql.js";
import sqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { migrate } from "./migrate";
import { clearPersisted, readPersisted, writePersisted } from "./persist";
import * as schema from "./schema";

export type Db = SQLJsDatabase<typeof schema>;

type Engine = {
  sqlite: Database;
  db: Db;
};

const g = globalThis as typeof globalThis & {
  __latticeEngine?: Engine;
  __latticeBoot?: Promise<Engine>;
};

let flushTimer: number | undefined;
let dirty = false;

async function loadSql() {
  const initSqlJs = typeof sqlJs === "function" ? sqlJs : (sqlJs as unknown as { default: typeof sqlJs }).default;
  return initSqlJs({
    locateFile: () => sqlWasmUrl,
  });
}

export async function createEngine(bytes?: Uint8Array | null): Promise<Engine> {
  const SQL = await loadSql();
  const sqlite = bytes ? new SQL.Database(bytes) : new SQL.Database();
  migrate(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export async function bootEngine(): Promise<Engine> {
  if (g.__latticeEngine) return g.__latticeEngine;
  if (!g.__latticeBoot) {
    g.__latticeBoot = (async () => {
      const bytes = await readPersisted();
      const engine = await createEngine(bytes);
      g.__latticeEngine = engine;
      return engine;
    })();
  }
  return g.__latticeBoot;
}

export function getEngine(): Engine {
  if (!g.__latticeEngine) throw new Error("Database is not ready");
  return g.__latticeEngine;
}

export function markDirty() {
  dirty = true;
  if (flushTimer !== undefined) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    void flushNow();
  }, 400);
}

export async function flushNow() {
  if (!g.__latticeEngine || !dirty) return;
  dirty = false;
  const bytes = g.__latticeEngine.sqlite.export();
  await writePersisted(bytes);
}

let flushAttached = false;

export function attachFlushListeners() {
  if (flushAttached) return;
  flushAttached = true;
  const onHide = () => {
    void flushNow();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
  window.addEventListener("pagehide", onHide);
}

export async function replaceEngine(bytes?: Uint8Array | null) {
  const engine = await createEngine(bytes);
  g.__latticeEngine = engine;
  dirty = true;
  await flushNow();
  return engine;
}

export async function resetEngine() {
  await clearPersisted();
  const engine = await createEngine(null);
  g.__latticeEngine = engine;
  dirty = true;
  await flushNow();
  return engine;
}
