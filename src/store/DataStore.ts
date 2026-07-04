import type { CatalogData } from '../types';
import {
  emptyCatalog,
  mergeCatalogs,
  parseCatalog,
  serializeCatalog,
  type ParseResult,
} from './catalogSchema';

const DB_NAME = 'road-trip-planner';
const STORE_NAME = 'catalog';
const RECORD_KEY = 'main';
const LS_KEY = 'road-trip-planner:catalog';

/**
 * Persists the catalog (places + trips). IndexedDB is the primary backend;
 * localStorage is a fallback when IndexedDB is unavailable (private mode,
 * old browsers). Also handles JSON export/import and seeding from a bundled
 * catalog when storage is empty (design.md decision #6).
 */
export class DataStore {
  private idbAvailable: boolean;

  constructor() {
    this.idbAvailable = typeof indexedDB !== 'undefined';
  }

  /** Load persisted data, or null if nothing is stored yet. */
  async load(): Promise<CatalogData | null> {
    if (this.idbAvailable) {
      try {
        return await this.idbLoad();
      } catch {
        this.idbAvailable = false; // fall through to localStorage
      }
    }
    return this.lsLoad();
  }

  /** Persist the given catalog. */
  async save(data: CatalogData): Promise<void> {
    if (this.idbAvailable) {
      try {
        await this.idbSave(data);
        return;
      } catch {
        this.idbAvailable = false;
      }
    }
    this.lsSave(data);
  }

  /**
   * Resolve the initial catalog: stored data → bundled seed → empty.
   * Persists the seed so subsequent loads are stable.
   */
  async loadInitial(seed?: CatalogData): Promise<CatalogData> {
    const stored = await this.load();
    if (stored) return stored;
    if (seed) {
      await this.save(seed);
      return seed;
    }
    return emptyCatalog();
  }

  /** Produce a downloadable JSON string of the catalog. */
  export(data: CatalogData): string {
    return serializeCatalog(data);
  }

  /**
   * Parse an imported JSON string. Returns a ParseResult; on success the
   * caller decides whether to replace or merge. Never throws on bad input.
   */
  parseImport(json: string): ParseResult {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return { ok: false, error: '文件不是有效的 JSON。' };
    }
    return parseCatalog(raw);
  }

  /** Merge an imported catalog into an existing one (incoming wins on id clash). */
  merge(base: CatalogData, incoming: CatalogData): CatalogData {
    return mergeCatalogs(base, incoming);
  }

  // ---- IndexedDB backend ----

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    });
  }

  private async idbLoad(): Promise<CatalogData | null> {
    const db = await this.openDb();
    try {
      return await new Promise<CatalogData | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        req.onsuccess = () => resolve((req.result as CatalogData | undefined) ?? null);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      });
    } finally {
      db.close();
    }
  }

  private async idbSave(data: CatalogData): Promise<void> {
    const db = await this.openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data, RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      });
    } finally {
      db.close();
    }
  }

  // ---- localStorage fallback ----

  private lsLoad(): CatalogData | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const result = parseCatalog(JSON.parse(raw));
      return result.ok && result.data ? result.data : null;
    } catch {
      return null;
    }
  }

  private lsSave(data: CatalogData): void {
    try {
      localStorage.setItem(LS_KEY, serializeCatalog(data));
    } catch {
      // Storage full or unavailable — nothing more we can do without a backend.
    }
  }
}

/** Trigger a browser download of the exported catalog JSON. */
export function downloadCatalog(json: string, filename = 'road-trip-catalog.json'): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
