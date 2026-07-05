import type { BD09, CatalogEntity, Route, RouteLeg, RouteMetrics, RouteStop } from '../types';
import { HOME } from '../config/home';
import { getMapProvider } from '../map';
import type { DrivingRouteResult } from '../map/MapProvider';
import { optimizeRoute, stopEndpoints, type CostFn } from '../domain/optimizer';
import { unsatisfiedConstraints } from '../domain/validation';
import { haversineMeters } from '../map/coords';
import { mapPool } from '../util/concurrent';
import type { AppState } from './appStore';

type SetState = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
type GetState = () => AppState;

/** Max concurrent Baidu driving-route requests while building the time matrix. */
const ROUTE_POOL = 6;
/** Speed used to estimate duration when real routing is unavailable (~60 km/h). */
const ASSUMED_SPEED_MPS = 60_000 / 3600;
/** Speed used to estimate scenic-road-body duration from stored geometry (~35 km/h). */
const SCENIC_SPEED_MPS = 35_000 / 3600;

/**
 * Plan the current trip:
 * 1. Enforce tag constraints.
 * 2. Fetch real Baidu *quickest* driving routes between every endpoint pair once
 *    (path + distance + duration), cached.
 * 3. Order the loop to minimize total drive *time* (quickest, not shortest).
 * 4. Draw each connecting leg along its real road curve, and each scenic road
 *    along its own entry→waypoints→exit geometry.
 *
 * Every leg degrades independently (a single failing route straightens only that
 * leg, never the whole loop). A full straight-line fallback is used only when the
 * routing service is entirely unavailable.
 */
export async function runPlanTrip(set: SetState, get: GetState): Promise<void> {
  const state = get();
  const byId = new Map<string, CatalogEntity>([
    ...state.places.map((p) => [p.id, p] as const),
    ...state.routes.map((r) => [r.id, r] as const),
  ]);
  const selected: CatalogEntity[] = [...state.tripSelection, ...state.tripRouteSelection]
    .map((id) => byId.get(id))
    .filter((e): e is CatalogEntity => Boolean(e));

  // Constraint gate (spec: trip-planner "Constraint not satisfiable").
  const unmet = unsatisfiedConstraints(selected, state.constraints);
  if (unmet.length > 0) {
    set({
      planError: `所选地点缺少必需的标签：${unmet.map((c) => c.tag).join('、')}。`,
      activeOrder: null,
      activeRoute: null,
    });
    return;
  }

  set({ planning: true, planError: null });

  // Trivial: nothing selected.
  if (selected.length === 0) {
    set({ planning: false, activeOrder: [], activeRoute: emptyMetrics() });
    return;
  }

  // Fetch the driving matrix between all endpoints (never throws). Each pair
  // prefers the shorter of Baidu's quickest/shortest routes.
  const matrix = await buildMatrix(selected);

  // Routing entirely unavailable (e.g. no SDK / key) → straight-line fallback.
  if (matrix.total > 0 && matrix.failures === matrix.total) {
    const { order } = optimizeRoute(HOME.coord, selected);
    set({
      planning: false,
      activeOrder: order,
      activeRoute: fallbackMetrics(order, selected),
      planError: '无法获取实时驾车距离，显示直线距离估算值。',
    });
    return;
  }

  // Order the loop by real drive *time* using the matrix.
  const { order } = optimizeRoute(HOME.coord, selected, makeCost(matrix.cache));

  try {
    const metrics = await buildLegs(order, selected, matrix.cache);
    set({ planning: false, activeOrder: order, activeRoute: metrics, planError: null });
  } catch {
    // Unexpected failure while assembling geometry — degrade to straight lines.
    set({
      planning: false,
      activeOrder: order,
      activeRoute: fallbackMetrics(order, selected),
      planError: '无法获取实时驾车距离，显示直线距离估算值。',
    });
  }
}

function emptyMetrics(): RouteMetrics {
  return { totalDistanceMeters: 0, totalDurationSeconds: 0, legs: [] };
}

// ---- Endpoint / cache keys -------------------------------------------------

function coordKey(c: BD09): string {
  return `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`;
}

function pairKey(a: BD09, b: BD09): string {
  return `${coordKey(a)}->${coordKey(b)}`;
}

function sameCoord(a: BD09, b: BD09): boolean {
  return coordKey(a) === coordKey(b);
}

/** All distinct endpoints to route between: home + each entity's endpoint(s). */
function collectEndpoints(entities: CatalogEntity[]): BD09[] {
  const seen = new Set<string>();
  const pts: BD09[] = [];
  const add = (c: BD09): void => {
    const k = coordKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      pts.push(c);
    }
  };
  add(HOME.coord);
  for (const e of entities) {
    if (e.kind === 'destination') add(e.coord);
    else {
      add(e.entry);
      add(e.exit);
    }
  }
  return pts;
}

/** A straight-line pseudo driving result used when a route call fails. */
function pseudoResult(a: BD09, b: BD09): DrivingRouteResult {
  const distance = haversineMeters(a, b);
  return { distanceMeters: distance, durationSeconds: distance / ASSUMED_SPEED_MPS, path: [a, b] };
}

interface Matrix {
  cache: Map<string, DrivingRouteResult>;
  failures: number;
  total: number;
}

/**
 * Fetch a driving route between two points, preferring the SHORTER of Baidu's
 * quickest (TIME_PRIORITY) and shortest (DISTANCE) policies.
 *
 * Why prefer shorter: the Baidu JS `DrivingRoute` API has no live-traffic
 * signal, so its "quickest" time estimate can rank a longer detour ahead of the
 * route the traffic-aware website actually recommends. For our inter-city legs
 * the recommended path is consistently the shorter one, so preferring shorter
 * matches Baidu's recommendation far better. Returns null only if BOTH fail.
 */
/**
 * Given a driving result already fetched with the `quickest` policy, also fetch
 * the `shortest` route and return whichever is shorter by distance.
 *
 * Why prefer shorter: the Baidu JS `DrivingRoute` API has no live-traffic
 * signal, so its "quickest" time estimate can rank a longer detour ahead of the
 * route the traffic-aware website actually recommends. For our inter-city legs
 * the recommended path is consistently the shorter one, so preferring shorter
 * matches Baidu's recommendation far better. Only the drawn legs pay this extra
 * call; the ordering matrix uses the quickest result alone.
 */
async function preferShorter(
  provider: ReturnType<typeof getMapProvider>,
  quickest: DrivingRouteResult | undefined,
  a: BD09,
  b: BD09,
): Promise<DrivingRouteResult> {
  let shortest: DrivingRouteResult | undefined;
  try {
    const r = await provider.drivingRoute(a, b, { policy: 'shortest' });
    if (r.path.length >= 2) shortest = r;
  } catch {
    shortest = undefined;
  }
  const candidates = [quickest, shortest].filter(
    (r): r is DrivingRouteResult => Boolean(r) && r!.path.length >= 2,
  );
  if (candidates.length === 0) return quickest ?? pseudoResult(a, b);
  return candidates.reduce((m, r) => (r.distanceMeters < m.distanceMeters ? r : m));
}

/**
 * Fetch the quickest driving route between every unordered endpoint pair once
 * (bounded concurrency), caching both directions for the ordering matrix. The
 * reverse direction stores the reversed path so drawn legs still trace real
 * roads. Never rejects — a pair whose request fails becomes a straight
 * pseudo-result.
 */
async function buildMatrix(entities: CatalogEntity[]): Promise<Matrix> {
  const provider = getMapProvider();
  const endpoints = collectEndpoints(entities);
  const pairs: Array<[BD09, BD09]> = [];
  for (let i = 0; i < endpoints.length; i += 1) {
    for (let j = i + 1; j < endpoints.length; j += 1) {
      pairs.push([endpoints[i]!, endpoints[j]!]);
    }
  }

  const cache = new Map<string, DrivingRouteResult>();
  let failures = 0;

  await mapPool(pairs, ROUTE_POOL, async ([a, b]) => {
    try {
      const r = await provider.drivingRoute(a, b, { policy: 'quickest' });
      const fwd: DrivingRouteResult = r.path.length >= 2 ? r : { ...r, path: [a, b] };
      cache.set(pairKey(a, b), fwd);
      cache.set(pairKey(b, a), { ...fwd, path: [...fwd.path].reverse() });
    } catch {
      failures += 1;
      cache.set(pairKey(a, b), pseudoResult(a, b));
      cache.set(pairKey(b, a), pseudoResult(b, a));
    }
  });

  return { cache, failures, total: pairs.length };
}

/** Cost function for the optimizer: real drive time between two endpoints. */
function makeCost(cache: Map<string, DrivingRouteResult>): CostFn {
  return (a, b) => {
    if (sameCoord(a, b)) return 0;
    const r = cache.get(pairKey(a, b));
    return r ? r.durationSeconds : haversineMeters(a, b) / ASSUMED_SPEED_MPS;
  };
}

// ---- Leg assembly ----------------------------------------------------------

/** Build a home → stops → home node list with resolved endpoints. */
function routePoints(order: RouteStop[], entities: CatalogEntity[]) {
  const byId = new Map(entities.map((p) => [p.id, p] as const));
  const points = [{ id: '@home', arrive: HOME.coord, depart: HOME.coord }];
  for (const stop of order) {
    const entity = byId.get(stop.placeId);
    if (!entity) continue;
    const { arrive, depart } = stopEndpoints(stop, entity);
    points.push({ id: stop.placeId, arrive, depart });
  }
  points.push({ id: '@home', arrive: HOME.coord, depart: HOME.coord });
  return points;
}

/** Sum of great-circle distances along a path (approximate road length). */
function pathDistance(path: BD09[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) total += haversineMeters(path[i]!, path[i + 1]!);
  return total;
}

/**
 * Assemble the loop's legs from the cached matrix:
 * - a `connector` leg between each pair of consecutive stops (real quickest route);
 * - an extra `road` leg for each scenic road, drawn along its own scenic geometry.
 */
async function buildLegs(
  order: RouteStop[],
  entities: CatalogEntity[],
  cache: Map<string, DrivingRouteResult>,
): Promise<RouteMetrics> {
  const byId = new Map(entities.map((p) => [p.id, p] as const));
  const points = routePoints(order, entities);
  const legs: RouteLeg[] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  const addLeg = (leg: RouteLeg): void => {
    legs.push(leg);
    totalDistance += leg.distanceMeters;
    totalDuration += leg.durationSeconds;
  };

  const provider = getMapProvider();

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;

    // Connector: from.depart → to.arrive. Draw the shorter of Baidu's quickest
    // (already cached) and shortest routes, so it matches Baidu's recommendation.
    const quickest = cache.get(pairKey(from.depart, to.arrive));
    const r = await preferShorter(provider, quickest, from.depart, to.arrive);
    const path = r.path.length >= 2 ? r.path : [from.depart, to.arrive];
    const distance = r.distanceMeters || haversineMeters(from.depart, to.arrive);
    const duration = r.durationSeconds || distance / ASSUMED_SPEED_MPS;
    addLeg({
      fromId: from.id,
      toId: to.id,
      distanceMeters: distance,
      durationSeconds: duration,
      path,
      kind: 'connector',
    });

    // Scenic road body: draw the road along its own entry→waypoints→exit curve.
    const entity = byId.get(to.id);
    if (entity && entity.kind === 'road') {
      addLeg(await roadBodyLeg(entity, sameCoord(to.arrive, entity.entry)));
    }
  }

  return { totalDistanceMeters: totalDistance, totalDurationSeconds: totalDuration, legs };
}

/**
 * A scenic road's own leg, drawn along its geometry (respect the road first).
 * Prefers the persisted `path`; otherwise resolves entry→waypoints→exit via
 * chained quickest-driving routes, degrading per-segment to a straight line.
 */
async function roadBodyLeg(road: Route, forward: boolean): Promise<RouteLeg> {
  // Stored geometry: use it directly (reversed if traversed exit→entry).
  if (road.path && road.path.length >= 2) {
    const path = forward ? road.path : [...road.path].reverse();
    const distance = pathDistance(path);
    return {
      fromId: road.id,
      toId: road.id,
      distanceMeters: distance,
      durationSeconds: distance / SCENIC_SPEED_MPS,
      path,
      kind: 'road',
      name: road.name,
    };
  }

  // Resolve along the pinned scenic path (entry → waypoints → exit, or reversed).
  const provider = getMapProvider();
  const wpts = road.waypoints ?? [];
  const pins = forward
    ? [road.entry, ...wpts, road.exit]
    : [road.exit, ...[...wpts].reverse(), road.entry];

  const path: BD09[] = [];
  let distance = 0;
  let duration = 0;
  for (let i = 0; i < pins.length - 1; i += 1) {
    const a = pins[i]!;
    const b = pins[i + 1]!;
    try {
      const res = await provider.drivingRoute(a, b, { policy: 'quickest' });
      const seg = res.path.length >= 2 ? res.path : [a, b];
      path.push(...(i === 0 ? seg : seg.slice(1)));
      distance += res.distanceMeters;
      duration += res.durationSeconds;
    } catch {
      path.push(...(i === 0 ? [a, b] : [b]));
      const d = haversineMeters(a, b);
      distance += d;
      duration += d / SCENIC_SPEED_MPS;
    }
  }

  const finalPath = path.length >= 2 ? path : forward ? [road.entry, road.exit] : [road.exit, road.entry];
  return {
    fromId: road.id,
    toId: road.id,
    distanceMeters: distance,
    durationSeconds: duration,
    path: finalPath,
    kind: 'road',
    name: road.name,
  };
}

/** Straight-line metrics used when the routing service can't be reached. */
function fallbackMetrics(order: RouteStop[], entities: CatalogEntity[]): RouteMetrics {
  const points = routePoints(order, entities);
  const legs: RouteLeg[] = [];
  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const distance = haversineMeters(from.depart, to.arrive);
    legs.push({
      fromId: from.id,
      toId: to.id,
      distanceMeters: distance,
      durationSeconds: distance / ASSUMED_SPEED_MPS,
      path: [from.depart, to.arrive],
      kind: 'connector',
    });
    totalDistance += distance;
  }

  return {
    totalDistanceMeters: totalDistance,
    totalDurationSeconds: totalDistance / ASSUMED_SPEED_MPS,
    legs,
  };
}
