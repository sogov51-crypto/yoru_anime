const CATALOG_DB_NAME = "yoruCatalogDB_v2";
const CATALOG_DB_STORE = "catalog";
const CATALOG_DB_KEY = "anime_catalog_20000_v2";

let catalogDbPromise = null;
let catalogCacheWritePromise = Promise.resolve();

function openCatalogDB() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (catalogDbPromise) return catalogDbPromise;
  catalogDbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(CATALOG_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CATALOG_DB_STORE)) db.createObjectStore(CATALOG_DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = request.onblocked = () => resolve(null);
    } catch (error) { resolve(null); }
  });
  return catalogDbPromise;
}

async function readCatalogCache() {
  const db = await openCatalogDB();
  if (!db) return null;
  // Prefer the 10k cache, but reuse the previous 5k cache as an instant starting point.
  // The background loader will continue from its saved page set instead of starting over.
  return new Promise(resolve => {
    try {
      const tx = db.transaction(CATALOG_DB_STORE, "readonly");
      const store = tx.objectStore(CATALOG_DB_STORE);
      const currentRequest = store.get(CATALOG_DB_KEY);
      const legacyRequest = store.get("popular_5000");
      tx.oncomplete = () => resolve(currentRequest.result || legacyRequest.result || null);
      tx.onerror = tx.onabort = () => resolve(null);
    } catch (error) { resolve(null); }
  });
}

async function writeCatalogCache() {
  const db = await openCatalogDB();
  if (!db) return false;
  const snapshot = {
    items: animeList,
    pages: Array.from(catalogLoadedPages).sort((a, b) => a - b),
    updatedAt: Date.now(),
    target: CATALOG_TARGET,
    catalogSchema: 4
  };
  return new Promise(resolve => {
    try {
      const tx = db.transaction(CATALOG_DB_STORE, "readwrite");
      tx.objectStore(CATALOG_DB_STORE).put(snapshot, CATALOG_DB_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    } catch (error) { resolve(false); }
  });
}

function queueCatalogCacheWrite() {
  // Serialize writes so an older snapshot can never overwrite a newer one.
  catalogCacheWritePromise = catalogCacheWritePromise.then(() => writeCatalogCache()).catch(() => false);
  return catalogCacheWritePromise;
}
