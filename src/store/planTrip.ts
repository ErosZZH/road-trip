import type { Place, RouteLeg, RouteMetrics, RouteStop } from '../types';
import { HOME } from '../config/home';
import { getMapProvider } from '../map';
import { optimizeRoute, stopEndpoints } from '../domain/optimizer';
import { unsatisfiedConstraints } from '../domain/validation';
import { haversineMeters } from '../map/coords';
import type { AppState } from './appStore';

type SetState = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
type GetState = () => AppState;

/**
 * Plan the current trip: enforce tag constraints, optimize the cyclic order,
 * then fetch real driving distances/durations per leg. Falls back to
 * straight-line estimates if the routing service is unavailable so the user
 * still sees a plan.
 */
export async function runPlanTrip(set: SetState, get: GetState): Promise<void> {
  const state = get();
  const selected = state.tripSelection
    .map((id) => state.places.find((p) => p.id === id))
    .filter((p): p is Place => Boolean(p));

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

  const { order } = optimizeRoute(HOME.coord, selected);

  // Trivial: no places selected.
  if (order.length === 0) {
    set({ planning: false, activeOrder: [], activeRoute: emptyMetrics() });
    return;
  }

  try {
    const metrics = await buildMetrics(order, selected);
    set({ planning: false, activeOrder: order, activeRoute: metrics });
  } catch {
    // Routing failed — provide straight-line fallback so the plan still renders.
    const metrics = fallbackMetrics(order, selected);
    set({
      planning: false,
      activeOrder: order,
      activeRoute: metrics,
      planError: '无法获取实时驾车距离，显示直线距离估算值。',
    });
  }
}

function emptyMetrics(): RouteMetrics {
  return { totalDistanceMeters: 0, totalDurationSeconds: 0, legs: [] };
}

/** Build a home → stops → home node list with resolved endpoints. */
function routePoints(order: RouteStop[], places: Place[]) {
  const byId = new Map(places.map((p) => [p.id, p] as const));
  const points = [{ id: '@home', arrive: HOME.coord, depart: HOME.coord }];
  for (const stop of order) {
    const place = byId.get(stop.placeId);
    if (!place) continue;
    const { arrive, depart } = stopEndpoints(stop, place);
    points.push({ id: stop.placeId, arrive, depart });
  }
  points.push({ id: '@home', arrive: HOME.coord, depart: HOME.coord });
  return points;
}

async function buildMetrics(order: RouteStop[], places: Place[]): Promise<RouteMetrics> {
  const provider = getMapProvider();
  const points = routePoints(order, places);
  const legs: RouteLeg[] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const result = await provider.drivingRoute(from.depart, to.arrive);
    legs.push({
      fromId: from.id,
      toId: to.id,
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      path: result.path.length >= 2 ? result.path : [from.depart, to.arrive],
    });
    totalDistance += result.distanceMeters;
    totalDuration += result.durationSeconds;
  }

  return { totalDistanceMeters: totalDistance, totalDurationSeconds: totalDuration, legs };
}

/** Straight-line metrics used when the routing service can't be reached. */
function fallbackMetrics(order: RouteStop[], places: Place[]): RouteMetrics {
  const points = routePoints(order, places);
  const legs: RouteLeg[] = [];
  let totalDistance = 0;
  const ASSUMED_SPEED_MPS = 60_000 / 3600; // ~60 km/h

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
    });
    totalDistance += distance;
  }

  return {
    totalDistanceMeters: totalDistance,
    totalDurationSeconds: totalDistance / ASSUMED_SPEED_MPS,
    legs,
  };
}
