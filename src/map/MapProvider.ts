import type { BD09 } from '../types';

/** A geocoding candidate returned for a place-name/address query. */
export interface GeocodeCandidate {
  /** Human-readable label (formatted address or POI name). */
  label: string;
  coord: BD09;
  /** Optional administrative context (city/district) to disambiguate. */
  context?: string;
}

/** Result of a driving-route request between two points. */
export interface DrivingRouteResult {
  distanceMeters: number;
  durationSeconds: number;
  /** Ordered BD09 path points for drawing the route. */
  path: BD09[];
}

/** A handle to a rendered map, returned by renderMap. Marker/polyline ops act on it. */
export interface MapHandle {
  /** The underlying provider map object (opaque to callers). */
  readonly native: unknown;
  /** Center the viewport on a coordinate at an optional zoom level. */
  setCenter(coord: BD09, zoom?: number): void;
  /** Fit the viewport to contain all given coordinates. */
  fitBounds(coords: BD09[]): void;
  /** Remove all markers/polylines added via this handle. */
  clearOverlays(): void;
}

export interface MarkerOptions {
  coord: BD09;
  title?: string;
  /** Visual role, used to pick an icon/color. */
  variant?: 'home' | 'visited' | 'wishlist';
  onClick?: () => void;
}

export interface PolylineOptions {
  path: BD09[];
  color?: string;
  weight?: number;
  onClick?: () => void;
}

/** An overlay handle so a specific marker/polyline can be removed later. */
export interface OverlayHandle {
  remove(): void;
}

/**
 * Abstraction over a map provider. The app depends only on this interface;
 * BaiduMapProvider is the v1 implementation (design.md decision #2).
 */
export interface MapProvider {
  /** Lazily load the provider SDK. Rejects with a clear error if not configured. */
  loadSdk(): Promise<void>;
  /** Render a map into the given container element, centered on `home`. */
  renderMap(container: HTMLElement, home: BD09): Promise<MapHandle>;
  /** Add a marker to a rendered map. */
  addMarker(map: MapHandle, options: MarkerOptions): OverlayHandle;
  /** Add a polyline to a rendered map. */
  addPolyline(map: MapHandle, options: PolylineOptions): OverlayHandle;
  /** Geocode a free-text query to candidate coordinates. */
  geocode(query: string): Promise<GeocodeCandidate[]>;
  /** Compute a driving route between two points. */
  drivingRoute(from: BD09, to: BD09): Promise<DrivingRouteResult>;
}

/** Thrown when the provider cannot operate (e.g. missing API key). */
export class MapProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapProviderError';
  }
}
