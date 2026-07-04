import type { BD09, Place, RoadPlace, RouteStop } from '../types';
import { haversineMeters } from '../map/coords';

/**
 * A node in the optimizer's graph. Destinations have a single point used for
 * both arrival and departure. Roads have distinct entry/exit points and a
 * chosen traversal direction, so entering at one endpoint means leaving at the
 * other (design.md decision #4).
 */
export interface PlanNode {
  placeId: string;
  kind: 'destination' | 'road';
  /** Point at which the route arrives, given the chosen orientation. */
  arrive: BD09;
  /** Point from which the route departs, given the chosen orientation. */
  depart: BD09;
}

function roadOrientations(road: RoadPlace): [PlanNode, PlanNode] {
  return [
    { placeId: road.id, kind: 'road', arrive: road.entry, depart: road.exit }, // entry→exit
    { placeId: road.id, kind: 'road', arrive: road.exit, depart: road.entry }, // exit→entry
  ];
}

function destinationNode(place: Place): PlanNode {
  if (place.kind !== 'destination') throw new Error('not a destination');
  return { placeId: place.id, kind: 'destination', arrive: place.coord, depart: place.coord };
}

/** Distance in meters travelled from one node's departure to the next node's arrival. */
export function legCost(from: PlanNode, to: PlanNode): number {
  return haversineMeters(from.depart, to.arrive);
}

/** Total cost of a home-anchored cyclic tour visiting nodes in order. */
export function tourCost(home: BD09, nodes: PlanNode[]): number {
  if (nodes.length === 0) return 0;
  const homeNode: PlanNode = { placeId: '@home', kind: 'destination', arrive: home, depart: home };
  let total = legCost(homeNode, nodes[0]!);
  for (let i = 0; i < nodes.length - 1; i += 1) {
    total += legCost(nodes[i]!, nodes[i + 1]!);
  }
  total += legCost(nodes[nodes.length - 1]!, homeNode);
  return total;
}

/**
 * For a road at a given position, pick the orientation (entry→exit vs
 * exit→entry) that minimizes the combined in+out cost relative to its
 * neighbors. Greedy but effective for the small tours we handle.
 */
function orientRoads(home: BD09, order: PlanNode[]): PlanNode[] {
  const homeNode: PlanNode = { placeId: '@home', kind: 'destination', arrive: home, depart: home };
  const result = [...order];
  for (let i = 0; i < result.length; i += 1) {
    const node = result[i]!;
    if (node.kind !== 'road') continue;
    const prev = i === 0 ? homeNode : result[i - 1]!;
    const next = i === result.length - 1 ? homeNode : result[i + 1]!;
    // Two orientations share the same placeId; reconstruct both from endpoints.
    const a = node;
    const b: PlanNode = {
      placeId: node.placeId,
      kind: 'road',
      arrive: node.depart,
      depart: node.arrive,
    };
    const costA = haversineMeters(prev.depart, a.arrive) + haversineMeters(a.depart, next.arrive);
    const costB = haversineMeters(prev.depart, b.arrive) + haversineMeters(b.depart, next.arrive);
    result[i] = costB < costA ? b : a;
  }
  return result;
}

/** Nearest-neighbor construction starting from home. */
function nearestNeighbor(home: BD09, nodes: PlanNode[]): PlanNode[] {
  const remaining = [...nodes];
  const order: PlanNode[] = [];
  let currentDepart = home;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const cost = haversineMeters(currentDepart, remaining[i]!.arrive);
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const [chosen] = remaining.splice(bestIdx, 1);
    order.push(chosen!);
    currentDepart = chosen!.depart;
  }
  return order;
}

/** 2-opt local search: reverse segments while it reduces total tour cost. */
function twoOpt(home: BD09, initial: PlanNode[]): PlanNode[] {
  let best = orientRoads(home, initial);
  let bestCost = tourCost(home, best);
  let improved = true;
  const n = best.length;

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i += 1) {
      for (let k = i + 1; k < n; k += 1) {
        const candidate = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const oriented = orientRoads(home, candidate);
        const cost = tourCost(home, oriented);
        if (cost + 1e-6 < bestCost) {
          best = oriented;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return best;
}

export interface OptimizeResult {
  order: RouteStop[];
  /** Straight-line total distance in meters (optimization objective). */
  estimatedMeters: number;
}

/**
 * Optimize a home-anchored cyclic route over the given places.
 * - 0 places → empty order.
 * - 1 place → trivial there-and-back.
 * - ≥2 places → nearest-neighbor + 2-opt, with per-road orientation.
 */
export function optimizeRoute(home: BD09, places: Place[]): OptimizeResult {
  if (places.length === 0) return { order: [], estimatedMeters: 0 };

  // Build initial nodes: destinations fixed; roads default to entry→exit.
  const nodes: PlanNode[] = places.map((p) =>
    p.kind === 'destination' ? destinationNode(p) : roadOrientations(p)[0],
  );

  if (places.length === 1) {
    const oriented = orientRoads(home, nodes);
    return { order: toStops(oriented, places), estimatedMeters: tourCost(home, oriented) };
  }

  const nn = nearestNeighbor(home, nodes);
  const optimized = twoOpt(home, nn);
  return { order: toStops(optimized, places), estimatedMeters: tourCost(home, optimized) };
}

function toStops(nodes: PlanNode[], places: Place[]): RouteStop[] {
  return nodes.map((n) => {
    if (n.kind !== 'road') return { placeId: n.placeId };
    const road = places.find((p) => p.id === n.placeId) as RoadPlace | undefined;
    const enterAtEntry = road ? sameCoord(n.arrive, road.entry) : true;
    return { placeId: n.placeId, enterAtEntry };
  });
}

function sameCoord(a: BD09, b: BD09): boolean {
  return Math.abs(a.lng - b.lng) < 1e-9 && Math.abs(a.lat - b.lat) < 1e-9;
}

/** Resolve the arrival/departure points for a stop given its place + orientation. */
export function stopEndpoints(stop: RouteStop, place: Place): { arrive: BD09; depart: BD09 } {
  if (place.kind === 'destination') return { arrive: place.coord, depart: place.coord };
  return stop.enterAtEntry === false
    ? { arrive: place.exit, depart: place.entry }
    : { arrive: place.entry, depart: place.exit };
}
