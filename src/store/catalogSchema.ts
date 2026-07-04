import type { BD09, CatalogData, Place, Route, Trip } from '../types';
import { isValidCoord, isValidRating } from '../domain/validation';

export const CATALOG_VERSION = 1;

export function emptyCatalog(): CatalogData {
  return { version: CATALOG_VERSION, coordSystem: 'BD09', places: [], routes: [], trips: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Validate an optional array of coordinates (waypoints / path geometry). */
function parseCoordArray(value: unknown): BD09[] | null {
  if (!Array.isArray(value) || !value.every(isValidCoord)) return null;
  return value as BD09[];
}

/** Fields shared by places and routes. Returns null when any is invalid. */
function parseEntityBase(
  p: Record<string, unknown>,
): Pick<Place, 'id' | 'name' | 'tags' | 'status' | 'rating' | 'notes'> | null {
  if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
  if (!isStringArray(p.tags)) return null;
  if (p.status !== 'visited' && p.status !== 'wishlist') return null;
  if (p.rating !== undefined && !isValidRating(p.rating)) return null;
  if (p.rating !== undefined && p.status !== 'visited') return null;
  return {
    id: p.id,
    name: p.name,
    tags: p.tags,
    status: p.status,
    rating: p.rating as Place['rating'],
    notes: typeof p.notes === 'string' ? p.notes : undefined,
  };
}

/** Parse a destination place (kind === 'destination'). */
export function parsePlace(value: unknown): Place | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  if (p.kind !== 'destination') return null;
  const base = parseEntityBase(p);
  if (!base) return null;
  if (!isValidCoord(p.coord)) return null;
  return { ...base, kind: 'destination', coord: p.coord };
}

/** Parse a scenic route (kind === 'road'), including its endpoints, waypoints, and path geometry. */
export function parseRoute(value: unknown): Route | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  if (p.kind !== 'road') return null;
  const base = parseEntityBase(p);
  if (!base) return null;
  if (!isValidCoord(p.entry) || !isValidCoord(p.exit)) return null;

  // waypoints and path are optional; if present they must all be valid coords.
  let waypoints: BD09[] | undefined;
  if (p.waypoints !== undefined) {
    const parsed = parseCoordArray(p.waypoints);
    if (!parsed) return null;
    waypoints = parsed;
  }
  let path: BD09[] | undefined;
  if (p.path !== undefined) {
    const parsed = parseCoordArray(p.path);
    if (!parsed) return null;
    path = parsed;
  }

  return { ...base, kind: 'road', entry: p.entry, exit: p.exit, waypoints, path };
}

function parseTrip(value: unknown): Trip | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.name !== 'string') return null;
  if (!isStringArray(t.placeIds)) return null;
  // routeIds is newly required, but tolerate older trips that predate it.
  const routeIds = t.routeIds === undefined ? [] : t.routeIds;
  if (!isStringArray(routeIds)) return null;
  if (!Array.isArray(t.constraints)) return null;
  // Constraints/order/metrics are trusted structurally; deeper validation is
  // not required to load a trip safely (they are recomputable).
  return {
    id: t.id,
    name: t.name,
    placeIds: t.placeIds,
    routeIds,
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
 *
 * Accepts both the new shape ({ places, routes, trips }) and the legacy shape
 * where destinations and roads were mixed in a single `places` array, so older
 * exports/seeds still import cleanly.
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
  // routes is optional for backward compatibility with legacy single-array exports.
  if (obj.routes !== undefined && !Array.isArray(obj.routes)) {
    return { ok: false, error: '“routes” 必须是数组。' };
  }

  const places: Place[] = [];
  const routes: Route[] = [];

  // New-shape entries (kind === 'destination') live in `places`; any legacy
  // road entries mixed into `places` are routed to the routes collection.
  for (const [i, p] of obj.places.entries()) {
    const kind = (p as Record<string, unknown> | null)?.kind;
    if (kind === 'road') {
      const route = parseRoute(p);
      if (!route) return { ok: false, error: `第 ${i} 项道路无效。` };
      routes.push(route);
      continue;
    }
    const place = parsePlace(p);
    if (!place) return { ok: false, error: `第 ${i} 项地点无效。` };
    places.push(place);
  }

  for (const [i, r] of (obj.routes ?? []).entries()) {
    const route = parseRoute(r);
    if (!route) return { ok: false, error: `第 ${i} 项道路无效。` };
    routes.push(route);
  }

  const trips: Trip[] = [];
  for (const [i, t] of obj.trips.entries()) {
    const parsed = parseTrip(t);
    if (!parsed) return { ok: false, error: `第 ${i} 项行程无效。` };
    trips.push(parsed);
  }

  return {
    ok: true,
    data: { version: obj.version, coordSystem: obj.coordSystem, places, routes, trips },
  };
}

/** Serialize catalog data to a pretty JSON string for export. */
export function serializeCatalog(data: CatalogData): string {
  return JSON.stringify({ ...data, version: CATALOG_VERSION }, null, 2);
}

/** Merge two catalogs, deduplicating places, routes, and trips by id (incoming wins). */
export function mergeCatalogs(base: CatalogData, incoming: CatalogData): CatalogData {
  const placeById = new Map<string, Place>();
  for (const p of base.places) placeById.set(p.id, p);
  for (const p of incoming.places) placeById.set(p.id, p);

  const routeById = new Map<string, Route>();
  for (const r of base.routes) routeById.set(r.id, r);
  for (const r of incoming.routes) routeById.set(r.id, r);

  const tripById = new Map<string, Trip>();
  for (const t of base.trips) tripById.set(t.id, t);
  for (const t of incoming.trips) tripById.set(t.id, t);

  return {
    version: CATALOG_VERSION,
    coordSystem: 'BD09',
    places: [...placeById.values()],
    routes: [...routeById.values()],
    trips: [...tripById.values()],
  };
}
