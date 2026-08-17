const IDB_NAME = "lattice";
const IDB_STORE = "kv";
const IDB_KEY = "lattice.db";
const OPFS_FILE = "lattice.db";
const LEGACY_IDB_NAME = "kubuz";
const LEGACY_OPFS_FILE = "kubuz.db";

async function idbOpen(name = IDB_NAME): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available");
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readIdb(): Promise<Uint8Array | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => {
      const value = req.result;
      resolve(value instanceof Uint8Array ? value : null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function writeIdb(bytes: Uint8Array) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function opfsHandle(file = OPFS_FILE, create = true) {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  return root.getFileHandle(file, { create });
}

export async function readPersisted(): Promise<Uint8Array | null> {
  try {
    const handle = await opfsHandle();
    if (handle) {
      const file = await handle.getFile();
      if (file.size === 0) return readIdb();
      return new Uint8Array(await file.arrayBuffer());
    }
  } catch {
    // fall through to IndexedDB
  }
  return readIdb();
}

export async function writePersisted(bytes: Uint8Array) {
  try {
    const handle = await opfsHandle();
    if (handle) {
      const writable = await handle.createWritable();
      const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
      copy.set(bytes);
      await writable.write(copy);
      await writable.close();
      return;
    }
  } catch {
    // fall through
  }
  await writeIdb(bytes);
}

async function removeOpfs(file: string) {
  try {
    if ("storage" in navigator && navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(file).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

async function deleteIdb(name: string) {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

export async function clearLegacyPersisted() {
  await removeOpfs(LEGACY_OPFS_FILE);
  await deleteIdb(LEGACY_IDB_NAME);
}

export async function clearPersisted() {
  await removeOpfs(OPFS_FILE);
  await clearLegacyPersisted();
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    await deleteIdb(IDB_NAME);
  }
}
