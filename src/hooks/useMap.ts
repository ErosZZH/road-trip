import { useEffect, useRef, useState } from 'react';
import { getMapProvider } from '../map';
import type { MapHandle, OverlayHandle } from '../map/MapProvider';
import { HOME } from '../config/home';
import type { BD09, Place, RoadPlace, RouteMetrics } from '../types';

interface UseMapResult {
  containerRef: React.RefObject<HTMLDivElement>;
  ready: boolean;
  error: string | null;
}

/** Cache key for a road's geometry — invalidates when any pinned point moves. */
function roadSignature(place: RoadPlace): string {
  const pts = [place.entry, ...(place.waypoints ?? []), place.exit];
  return `${place.id}:${pts.map((p) => `${p.lng},${p.lat}`).join('|')}`;
}

/**
 * Resolve a road's full driving geometry by chaining driving routes through
 * entry → waypoints → exit, so the line threads the real (scenic) road rather
 * than a single fastest-path between the endpoints.
 */
async function resolveRoadPath(
  provider: ReturnType<typeof getMapProvider>,
  place: RoadPlace,
): Promise<BD09[]> {
  const pins = [place.entry, ...(place.waypoints ?? []), place.exit];
  const full: BD09[] = [];
  for (let i = 0; i < pins.length - 1; i += 1) {
    const res = await provider.drivingRoute(pins[i]!, pins[i + 1]!);
    const seg = res.path.length >= 2 ? res.path : [pins[i]!, pins[i + 1]!];
    // Avoid duplicating the shared point between consecutive legs.
    full.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return full.length >= 2 ? full : [place.entry, place.exit];
}

/**
 * Mounts a live map into a container and keeps its overlays in sync with the
 * given places and (optional) computed route. Handles home marker, destination
 * markers, road polylines (drawn along the real driving route), selection
 * clicks, and route rendering.
 */
export function useMap(
  places: Place[],
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
  const pendingRoads = useRef<Set<string>>(new Set());

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolved road geometry (real driving path) keyed by roadSignature. In state
  // (not a ref) so that arriving geometry reliably triggers a redraw.
  const [roadPaths, setRoadPaths] = useState<Record<string, BD09[]>>({});

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

  // Fetch the real driving geometry for each road that we don't have yet.
  useEffect(() => {
    if (!ready) return;
    const provider = getMapProvider();

    for (const place of places) {
      if (place.kind !== 'road') continue;
      const sig = roadSignature(place);
      if (roadPaths[sig] || pendingRoads.current.has(sig)) continue;

      pendingRoads.current.add(sig);
      resolveRoadPath(provider, place)
        .then((path) => {
          setRoadPaths((prev) => ({ ...prev, [sig]: path }));
        })
        .catch(() => {
          // Fall back to the straight line and stop retrying this road.
          setRoadPaths((prev) => ({ ...prev, [sig]: [place.entry, place.exit] }));
        })
        .finally(() => {
          pendingRoads.current.delete(sig);
        });
    }
  }, [places, ready, roadPaths]);

  // Draw place overlays whenever the filtered places or resolved road geometry
  // change. Only place overlays are removed/redrawn here — the home marker and
  // the computed-route overlays are left untouched.
  useEffect(() => {
    const map = mapRef.current;
    const provider = getMapProvider();
    if (!map || !ready) return;

    for (const o of placeOverlaysRef.current) o.remove();
    placeOverlaysRef.current = [];

    for (const place of places) {
      if (place.kind === 'destination') {
        placeOverlaysRef.current.push(
          provider.addMarker(map, {
            coord: place.coord,
            title: place.name,
            variant: place.status,
            onClick: () => onSelect(place.id),
          }),
        );
        continue;
      }

      // Road: use the resolved driving path if available, else a straight-line
      // placeholder until the geometry arrives.
      const resolved = roadPaths[roadSignature(place)];
      const path = resolved && resolved.length >= 2 ? resolved : [place.entry, place.exit];
      placeOverlaysRef.current.push(
        provider.addPolyline(map, {
          path,
          color: '#7c3aed',
          weight: 6,
          onClick: () => onSelect(place.id),
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, ready, roadPaths]);

  // Draw the active route as a connected path (independent of place overlays).
  useEffect(() => {
    const map = mapRef.current;
    const provider = getMapProvider();
    if (!map || !ready || !route) return;

    const drawn: OverlayHandle[] = [];
    for (const leg of route.legs) {
      const path: BD09[] = leg.path.length >= 2 ? leg.path : [];
      if (path.length >= 2) {
        drawn.push(provider.addPolyline(map, { path, color: '#2563eb', weight: 5 }));
      }
    }
    // Fit the viewport to the whole route.
    const allPoints = route.legs.flatMap((l) => l.path);
    if (allPoints.length > 0) map.fitBounds([HOME.coord, ...allPoints]);

    return () => drawn.forEach((o) => o.remove());
  }, [route, ready]);

  // Fit the viewport to the selected place so a road (which may be far from
  // home) becomes visible at a useful zoom instead of a tiny distant line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const place = places.find((p) => p.id === selectedId);
    if (!place) return;

    if (place.kind === 'destination') {
      map.setCenter(place.coord, 12);
      return;
    }
    const resolved = roadPaths[roadSignature(place)];
    const pts =
      resolved && resolved.length >= 2
        ? resolved
        : [place.entry, ...(place.waypoints ?? []), place.exit];
    map.fitBounds(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready, roadPaths]);

  return { containerRef, ready, error };
}
