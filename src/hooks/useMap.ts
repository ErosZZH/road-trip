import { useEffect, useRef, useState } from 'react';
import { getMapProvider } from '../map';
import type { MapHandle, OverlayHandle } from '../map/MapProvider';
import { HOME } from '../config/home';
import type { BD09, Place, Route, RouteMetrics } from '../types';

interface UseMapResult {
  containerRef: React.RefObject<HTMLDivElement>;
  ready: boolean;
  error: string | null;
}

/** Cache key for a route's geometry — invalidates when any pinned point moves. */
function routeSignature(route: Route): string {
  const pts = [route.entry, ...(route.waypoints ?? []), route.exit];
  return `${route.id}:${pts.map((p) => `${p.lng},${p.lat}`).join('|')}`;
}

/**
 * Resolve a route's full driving geometry by chaining driving routes through
 * entry → waypoints → exit, so the line threads the real (scenic) road rather
 * than a single fastest-path between the endpoints. Used only as a fallback when
 * the route has no persisted `path`.
 */
async function resolveRoutePath(
  provider: ReturnType<typeof getMapProvider>,
  route: Route,
): Promise<BD09[]> {
  const pins = [route.entry, ...(route.waypoints ?? []), route.exit];
  const full: BD09[] = [];
  for (let i = 0; i < pins.length - 1; i += 1) {
    const res = await provider.drivingRoute(pins[i]!, pins[i + 1]!);
    const seg = res.path.length >= 2 ? res.path : [pins[i]!, pins[i + 1]!];
    // Avoid duplicating the shared point between consecutive legs.
    full.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return full.length >= 2 ? full : [route.entry, route.exit];
}

/**
 * Mounts a live map into a container and keeps its overlays in sync with the
 * given places, routes, and (optional) computed trip route. Handles the home
 * marker, destination markers, route polylines (drawn along stored geometry, or
 * fetched when absent), selection clicks, and route rendering.
 */
export function useMap(
  places: Place[],
  routes: Route[],
  onSelect: (id: string) => void,
  route: RouteMetrics | null,
  selectedId: string | null,
): UseMapResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const placeOverlaysRef = useRef<OverlayHandle[]>([]);
  // Guards one-time map creation against React StrictMode double-mount, which
  // would otherwise build two overlapping maps and strand overlays on the first.
  const initStartedRef = useRef(false);
  // Signatures with an in-flight drivingRoute request, to avoid duplicate calls.
  const pendingRoutes = useRef<Set<string>>(new Set());

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolved route geometry (real driving path) keyed by routeSignature, for
  // routes that arrive without a persisted `path`. In state (not a ref) so that
  // arriving geometry reliably triggers a redraw.
  const [routePaths, setRoutePaths] = useState<Record<string, BD09[]>>({});

  // One-time map creation with a persistent home marker.
  useEffect(() => {
    if (initStartedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    initStartedRef.current = true;

    getMapProvider()
      .renderMap(el, HOME.coord)
      .then((handle) => {
        mapRef.current = handle;
        getMapProvider().addMarker(handle, {
          coord: HOME.coord,
          title: HOME.name,
          variant: 'home',
        });
        setReady(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '地图加载失败。');
      });
  }, []);

  // Fetch the real driving geometry for each route that lacks a stored path and
  // that we don't have resolved yet.
  useEffect(() => {
    if (!ready) return;
    const provider = getMapProvider();

    for (const r of routes) {
      if (r.path && r.path.length >= 2) continue; // stored geometry — nothing to fetch
      const sig = routeSignature(r);
      if (routePaths[sig] || pendingRoutes.current.has(sig)) continue;

      pendingRoutes.current.add(sig);
      resolveRoutePath(provider, r)
        .then((path) => {
          setRoutePaths((prev) => ({ ...prev, [sig]: path }));
        })
        .catch(() => {
          // Fall back to the straight line and stop retrying this route.
          setRoutePaths((prev) => ({ ...prev, [sig]: [r.entry, r.exit] }));
        })
        .finally(() => {
          pendingRoutes.current.delete(sig);
        });
    }
  }, [routes, ready, routePaths]);

  // Draw place + route overlays whenever the filtered entities or resolved route
  // geometry change. Only these overlays are removed/redrawn here — the home
  // marker and the computed-route overlays are left untouched.
  useEffect(() => {
    const map = mapRef.current;
    const provider = getMapProvider();
    if (!map || !ready) return;

    for (const o of placeOverlaysRef.current) o.remove();
    placeOverlaysRef.current = [];

    for (const place of places) {
      placeOverlaysRef.current.push(
        provider.addMarker(map, {
          coord: place.coord,
          title: place.name,
          variant: place.status,
          onClick: () => onSelect(place.id),
        }),
      );
    }

    for (const r of routes) {
      // Prefer stored geometry; else the resolved driving path; else a straight
      // line placeholder until geometry arrives.
      const stored = r.path && r.path.length >= 2 ? r.path : undefined;
      const resolved = stored ?? routePaths[routeSignature(r)];
      const path = resolved && resolved.length >= 2 ? resolved : [r.entry, r.exit];
      placeOverlaysRef.current.push(
        provider.addPolyline(map, {
          path,
          color: '#7c3aed',
          weight: 6,
          onClick: () => onSelect(r.id),
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, routes, ready, routePaths]);

  // Draw the active trip route as a connected path (independent of place overlays).
  useEffect(() => {
    const map = mapRef.current;
    const provider = getMapProvider();
    if (!map || !ready || !route) return;

    const drawn: OverlayHandle[] = [];
    for (const leg of route.legs) {
      const path: BD09[] = leg.path.length >= 2 ? leg.path : [];
      if (path.length < 2) continue;
      // Scenic road bodies are drawn in the scenic purple (matching route
      // overlays); connectors between stops use the trip blue.
      const isRoad = leg.kind === 'road';
      drawn.push(
        provider.addPolyline(map, {
          path,
          color: isRoad ? '#7c3aed' : '#2563eb',
          weight: isRoad ? 6 : 5,
        }),
      );
    }
    // Fit the viewport to the whole route.
    const allPoints = route.legs.flatMap((l) => l.path);
    if (allPoints.length > 0) map.fitBounds([HOME.coord, ...allPoints]);

    return () => drawn.forEach((o) => o.remove());
  }, [route, ready]);

  // Fit the viewport to the selected entity so a route (which may be far from
  // home) becomes visible at a useful zoom instead of a tiny distant line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;

    const place = places.find((p) => p.id === selectedId);
    if (place) {
      map.setCenter(place.coord, 12);
      return;
    }
    const r = routes.find((x) => x.id === selectedId);
    if (!r) return;
    const stored = r.path && r.path.length >= 2 ? r.path : undefined;
    const resolved = stored ?? routePaths[routeSignature(r)];
    const pts =
      resolved && resolved.length >= 2
        ? resolved
        : [r.entry, ...(r.waypoints ?? []), r.exit];
    map.fitBounds(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready, routePaths]);

  return { containerRef, ready, error };
}
