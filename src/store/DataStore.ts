import type { CatalogData, Place, Route, Trip } from '../types';
import { emptyCatalog, parseCatalog, serializeCatalog, type ParseResult } from './catalogSchema';

/**
 * Client for the standalone data server (design.md decision #1/#4). All places,
 * routes, and trips live in files on disk owned by the backend; this class is
 * the frontend's only persistence path. No IndexedDB, no localStorage.
 */

const API = '/api';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `请求失败（${res.status}）。`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export class DataStore {
  /** Load the whole catalog from disk. */
  async load(): Promise<CatalogData> {
    const res = await fetch(`${API}/catalog`);
    const data = await jsonOrThrow<CatalogData>(res);
    // Normalize through the parser so older/partial files get sane defaults.
    const parsed = parseCatalog(data);
    return parsed.ok && parsed.data ? parsed.data : emptyCatalog();
  }

  /** Create or update a place (upsert by id). Returns the persisted place. */
  savePlace(place: Place): Promise<Place> {
    return this.saveEntity('places', place);
  }

  /** Create or update a route (upsert by id). Returns the persisted route. */
  saveRoute(route: Route): Promise<Route> {
    return this.saveEntity('routes', route);
  }

  /** Create or update a trip (upsert by id). Returns the persisted trip. */
  saveTrip(trip: Trip): Promise<Trip> {
    return this.saveEntity('trips', trip);
  }

  deletePlace(id: string): Promise<void> {
    return this.deleteEntity('places', id);
  }

  deleteRoute(id: string): Promise<void> {
    return this.deleteEntity('routes', id);
  }

  deleteTrip(id: string): Promise<void> {
    return this.deleteEntity('trips', id);
  }

  /** Fetch a fresh export document from the server and serialize it for download. */
  async export(): Promise<string> {
    const res = await fetch(`${API}/export`);
    const data = await jsonOrThrow<CatalogData>(res);
    return serializeCatalog(data);
  }

  /**
   * Send an imported catalog to the server, replacing or merging on disk.
   * Returns the resulting catalog as persisted.
   */
  async import(data: CatalogData, mode: 'replace' | 'merge'): Promise<CatalogData> {
    const res = await fetch(`${API}/import?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serializeCatalog(data),
    });
    return jsonOrThrow<CatalogData>(res);
  }

  /**
   * Parse an imported JSON string client-side before sending, so an invalid
   * file is rejected without touching the server. Never throws on bad input.
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

  private async saveEntity<T extends { id: string }>(
    collection: 'places' | 'routes' | 'trips',
    entity: T,
  ): Promise<T> {
    const res = await fetch(`${API}/${collection}/${encodeURIComponent(entity.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entity),
    });
    return jsonOrThrow<T>(res);
  }

  private async deleteEntity(
    collection: 'places' | 'routes' | 'trips',
    id: string,
  ): Promise<void> {
    const res = await fetch(`${API}/${collection}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      await jsonOrThrow(res);
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
