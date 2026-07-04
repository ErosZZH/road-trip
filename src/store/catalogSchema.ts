import type { BD09, CatalogData, Place, Trip } from '../types';
import { isValidCoord, isValidRating } from '../domain/validation';

export const CATALOG_VERSION = 1;

export function emptyCatalog(): CatalogData {
  return { version: CATALOG_VERSION, coordSystem: 'BD09', places: [], trips: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function parsePlace(value: unknown): Place | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
  if (!isStringArray(p.tags)) return null;
  if (p.status !== 'visited' && p.status !== 'wishlist') return null;
  if (p.rating !== undefined && !isValidRating(p.rating)) return null;
  if (p.rating !== undefined && p.status !== 'visited') return null;

  if (p.kind === 'destination') {
    if (!isValidCoord(p.coord)) return null;
    return {
      id: p.id,
      kind: 'destination',
      name: p.name,
      tags: p.tags,
      status: p.status,
      rating: p.rating as Place['rating'],
      notes: typeof p.notes === 'string' ? p.notes : undefined,
      coord: p.coord,
    };
  }
  if (p.kind === 'road') {
    if (!isValidCoord(p.entry) || !isValidCoord(p.exit)) return null;
    // waypoints are optional; if present they must all be valid coords.
    let waypoints: BD09[] | undefined;
    if (p.waypoints !== undefined) {
      if (!Array.isArray(p.waypoints) || !p.waypoints.every(isValidCoord)) return null;
      waypoints = p.waypoints as BD09[];
    }
    return {
      id: p.id,
      kind: 'road',
      name: p.name,
      tags: p.tags,
      status: p.status,
      rating: p.rating as Place['rating'],
      notes: typeof p.notes === 'string' ? p.notes : undefined,
      entry: p.entry,
      exit: p.exit,
      waypoints,
    };
  }
  return null;
}

function parseTrip(value: unknown): Trip | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.name !== 'string') return null;
  if (!isStringArray(t.placeIds)) return null;
  if (!Array.isArray(t.constraints)) return null;
  // Constraints/order/metrics are trusted structurally; deeper validation is
  // not required to load a trip safely (they are recomputable).
  return {
    id: t.id,
    name: t.name,
    placeIds: t.placeIds,
    constraints: t.constraints as Trip['constraints'],
    order: t.order as Trip['order'],
    metrics: t.metrics as Trip['metrics'],
    needsReview: typeof t.needsReview === 'boolean' ? t.needsReview : undefined,
  };
}

export interface ParseResult {
  ok: boolean;
  data?: CatalogData;
  error?: string;
}

/**
 * Parse and validate a raw object (e.g. from JSON.parse) into CatalogData.
 * Returns ok:false with a message rather than throwing, so imports can be
 * rejected without mutating existing data.
 */
export function parseCatalog(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '文件不是 JSON 对象。' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== 'number') {
    return { ok: false, error: '缺少或无效的 “version” 字段。' };
  }
  if (obj.coordSystem !== 'BD09' && obj.coordSystem !== 'GCJ02' && obj.coordSystem !== 'WGS84') {
    return { ok: false, error: '缺少或无效的 “coordSystem” 字段。' };
  }
  if (!Array.isArray(obj.places) || !Array.isArray(obj.trips)) {
    return { ok: false, error: '需要 “places” 和 “trips” 数组。' };
  }

  const places: Place[] = [];
  for (const [i, p] of obj.places.entries()) {
    const parsed = parsePlace(p);
    if (!parsed) return { ok: false, error: `第 ${i} 项地点无效。` };
    places.push(parsed);
  }

  const trips: Trip[] = [];
  for (const [i, t] of obj.trips.entries()) {
    const parsed = parseTrip(t);
    if (!parsed) return { ok: false, error: `第 ${i} 项行程无效。` };
    trips.push(parsed);
  }

  return {
    ok: true,
    data: { version: obj.version, coordSystem: obj.coordSystem, places, trips },
  };
}

/** Serialize catalog data to a pretty JSON string for export. */
export function serializeCatalog(data: CatalogData): string {
  return JSON.stringify({ ...data, version: CATALOG_VERSION }, null, 2);
}

/** Merge two catalogs, deduplicating places and trips by id (incoming wins). */
export function mergeCatalogs(base: CatalogData, incoming: CatalogData): CatalogData {
  const placeById = new Map<string, Place>();
  for (const p of base.places) placeById.set(p.id, p);
  for (const p of incoming.places) placeById.set(p.id, p);

  const tripById = new Map<string, Trip>();
  for (const t of base.trips) tripById.set(t.id, t);
  for (const t of incoming.trips) tripById.set(t.id, t);

  return {
    version: CATALOG_VERSION,
    coordSystem: 'BD09',
    places: [...placeById.values()],
    trips: [...tripById.values()],
  };
}
