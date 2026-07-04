/**
 * Shared domain types for the road-trip planner.
 *
 * Coordinates are stored in Baidu's BD09 system throughout the app
 * (see design.md decision #3). Conversion helpers to/from GCJ-02/WGS84
 * live in the map-provider layer.
 */

/** A coordinate in Baidu's BD09 system. */
export interface BD09 {
  lng: number;
  lat: number;
}

/** Whether the user has been to a place or route. */
export type PlaceStatus = 'visited' | 'wishlist';

/** A 1–5 rating (vote) for a visited place or route. */
export type Rating = 1 | 2 | 3 | 4 | 5;

/** Fields common to every catalog entity (place or route). */
interface EntityBase {
  id: string;
  name: string;
  tags: string[];
  status: PlaceStatus;
  /** Only meaningful when status === 'visited'. */
  rating?: Rating;
  notes?: string;
}

/**
 * A scenic destination — a single point on the map. Stored under
 * `data/places/` (design.md decision #2).
 */
export interface Place extends EntityBase {
  kind: 'destination';
  coord: BD09;
}

/**
 * A scenic driving road — a segment traversed from `entry` to `exit`, stored
 * under `data/routes/` together with its geometry (design.md decisions #2/#5).
 * The optimizer may traverse it in either direction (design.md decision #4).
 *
 * `waypoints` are optional intermediate points that pin the route to its real
 * path. `path` is the persisted driving-path geometry (ordered BD09 points,
 * entry → exit) so the route renders and plans from stored geometry without
 * recomputing it in the browser. Both are ordered entry → exit.
 */
export interface Route extends EntityBase {
  kind: 'road';
  entry: BD09;
  exit: BD09;
  waypoints?: BD09[];
  /** Persisted driving-path geometry (entry → exit). May be empty if unresolved. */
  path?: BD09[];
}

/** Any catalog entity: a point destination or a scenic route segment. */
export type CatalogEntity = Place | Route;

export type PlaceKind = CatalogEntity['kind'];

/**
 * A constraint a valid trip must satisfy. v1 supports "the selection must
 * include at least `min` entities carrying `tag`".
 */
export interface TagConstraint {
  type: 'includesTag';
  tag: string;
  min: number;
}

/** A single leg between two consecutive stops in a computed route. */
export interface RouteLeg {
  fromId: string;
  toId: string;
  /** Driving distance in meters (from the map provider). */
  distanceMeters: number;
  /** Estimated driving duration in seconds. */
  durationSeconds: number;
  /** Ordered path points (BD09) for drawing the leg on the map. */
  path: BD09[];
}

/** Aggregate metrics for a computed route. */
export interface RouteMetrics {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
}

/**
 * An ordered stop in a computed route. For route (road) entities, `enterAtEntry`
 * records the chosen traversal direction.
 */
export interface RouteStop {
  placeId: string;
  /** For route entities: true = entry→exit, false = exit→entry. Undefined for destinations. */
  enterAtEntry?: boolean;
}

/**
 * A saved trip: a candidate selection of places and routes plus constraints and
 * (optionally) a computed plan. Stored under `data/trips/`.
 */
export interface Trip {
  id: string;
  name: string;
  /** Ids of selected destination places. */
  placeIds: string[];
  /** Ids of selected scenic routes. */
  routeIds: string[];
  constraints: TagConstraint[];
  /** Optimized visiting order (excludes home, which anchors both ends). */
  order?: RouteStop[];
  metrics?: RouteMetrics;
  /** Set when a referenced place/route was deleted and the plan should be recomputed. */
  needsReview?: boolean;
}

/** Coordinate systems the app can reason about (for import/export labelling). */
export type CoordSystem = 'BD09' | 'GCJ02' | 'WGS84';

/** The serializable shape of all app data, used for export/import and seeding. */
export interface CatalogData {
  /** Schema version for forward-compatible import. */
  version: number;
  /** Coordinate system all coords in this document use. */
  coordSystem: CoordSystem;
  places: Place[];
  routes: Route[];
  trips: Trip[];
}
