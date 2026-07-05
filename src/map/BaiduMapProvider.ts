import type { BD09 } from '../types';
import {
  MapProviderError,
  type DrivingRouteOptions,
  type DrivingRouteResult,
  type GeocodeCandidate,
  type MapHandle,
  type MapProvider,
  type MarkerOptions,
  type OverlayHandle,
  type PolylineOptions,
} from './MapProvider';

const SDK_READY_CALLBACK = '__onBMapGLReady';
const HOME_ZOOM = 9;

/**
 * Anchor point for POI searches, biasing results toward the app's operating
 * area (south Anhui / north Zhejiang, around Suzhou home). BD09 coordinates.
 */
const HOME_BIAS: BD09 = { lng: 120.7345, lat: 31.3178 };

function toPoint(coord: BD09): BMapGL.Point {
  return new window.BMapGL!.Point(coord.lng, coord.lat);
}

function fromPoint(point: BMapGL.Point): BD09 {
  return { lng: point.lng, lat: point.lat };
}

/** Colors by marker role so status is visually distinguishable on the map. */
const MARKER_COLORS: Record<NonNullable<MarkerOptions['variant']>, string> = {
  home: '#2563eb',
  visited: '#16a34a',
  wishlist: '#f59e0b',
};

/** Build a small colored pin icon as an inline SVG data URL. */
function markerIcon(variant: NonNullable<MarkerOptions['variant']>): BMapGL.Icon {
  const color = MARKER_COLORS[variant];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">` +
    `<path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0z" fill="${color}"/>` +
    `<circle cx="12" cy="12" r="5" fill="#fff"/></svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  const size = new window.BMapGL!.Size(24, 32);
  return new window.BMapGL!.Icon(url, size, { anchor: new window.BMapGL!.Size(12, 32) });
}

/**
 * Baidu Maps GL implementation of MapProvider.
 * Coordinates are BD09 throughout (Baidu-native), matching stored data.
 */
export class BaiduMapProvider implements MapProvider {
  private readonly ak: string;
  private sdkPromise: Promise<void> | null = null;
  /**
   * Serial queue for driving-route searches. BMapGL's DrivingRoute is not
   * concurrency-safe (overlapping searches return empty), so every request is
   * chained to run one-at-a-time.
   */
  private routeChain: Promise<void> = Promise.resolve();

  constructor(ak: string) {
    this.ak = ak.trim();
  }

  loadSdk(): Promise<void> {
    if (!this.ak) {
      return Promise.reject(
        new MapProviderError(
          '尚未配置百度地图密钥（AK）。请在 .env.local 中设置 VITE_BAIDU_AK。',
        ),
      );
    }
    if (window.BMapGL) return Promise.resolve();
    if (this.sdkPromise) return this.sdkPromise;

    this.sdkPromise = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new MapProviderError('加载百度地图 SDK 超时。'));
      }, 15000);

      window[SDK_READY_CALLBACK] = () => {
        window.clearTimeout(timeout);
        if (window.BMapGL) {
          resolve();
        } else {
          reject(new MapProviderError('百度地图 SDK 已加载，但 BMapGL 不可用。'));
        }
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src =
        `https://api.map.baidu.com/api?type=webgl&v=1.0&ak=${encodeURIComponent(this.ak)}` +
        `&callback=${SDK_READY_CALLBACK}`;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new MapProviderError('加载百度地图 SDK 脚本失败。'));
      };
      document.head.appendChild(script);
    });

    return this.sdkPromise;
  }

  async renderMap(container: HTMLElement, home: BD09): Promise<MapHandle> {
    await this.loadSdk();
    const map = new window.BMapGL!.Map(container, { enableMapClick: false });
    map.centerAndZoom(toPoint(home), HOME_ZOOM);
    map.enableScrollWheelZoom(true);
    return new BaiduMapHandle(map);
  }

  addMarker(map: MapHandle, options: MarkerOptions): OverlayHandle {
    const native = map.native as BMapGL.Map;
    const icon = markerIcon(options.variant ?? 'wishlist');
    const marker = new window.BMapGL!.Marker(toPoint(options.coord), {
      title: options.title,
      icon,
    });
    if (options.onClick) marker.addEventListener('click', options.onClick);
    native.addOverlay(marker);
    return {
      remove: () => native.removeOverlay(marker),
    };
  }

  addPolyline(map: MapHandle, options: PolylineOptions): OverlayHandle {
    const native = map.native as BMapGL.Map;
    const line = new window.BMapGL!.Polyline(options.path.map(toPoint), {
      strokeColor: options.color ?? '#2563eb',
      strokeWeight: options.weight ?? 5,
      strokeOpacity: 0.85,
    });
    if (options.onClick) line.addEventListener('click', options.onClick);
    native.addOverlay(line);
    return {
      remove: () => native.removeOverlay(line),
    };
  }

  async geocode(query: string): Promise<GeocodeCandidate[]> {
    await this.loadSdk();
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Use LocalSearch (POI search) so a keyword returns *all* candidate places,
    // not just a single best point (spec: "search returns multiple candidates").
    // The search is biased toward the app's operating area by anchoring it at
    // HOME; each POI supplies a title (used to auto-fill the name) and address.
    return new Promise<GeocodeCandidate[]>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new MapProviderError('地址解析超时。')),
        15000,
      );
      const search = new window.BMapGL!.LocalSearch(toPoint(HOME_BIAS), {
        pageCapacity: 20,
        onSearchComplete: (results) => {
          window.clearTimeout(timeout);
          const candidates: GeocodeCandidate[] = [];
          const n = results && results.getCurrentNumPois ? results.getCurrentNumPois() : 0;
          for (let i = 0; i < n; i += 1) {
            const poi = results.getPoi(i);
            if (!poi || !poi.point) continue;
            candidates.push({
              label: poi.title,
              coord: fromPoint(poi.point),
              context: poi.address || poi.city,
            });
          }
          resolve(candidates);
        },
      });
      search.search(trimmed);
    });
  }

  /**
   * Compute a driving route between two points.
   *
   * BMapGL's `DrivingRoute` shares internal SDK state and returns EMPTY results
   * when multiple searches overlap (measured: ~50% empty at 6-way concurrency,
   * 0% when serial). So every call is chained onto a single serial queue and
   * retried once on an empty/failed result. Callers may still "fire many at
   * once"; they just execute one-at-a-time under the hood.
   */
  drivingRoute(from: BD09, to: BD09, options?: DrivingRouteOptions): Promise<DrivingRouteResult> {
    const run = this.routeChain.then(
      () => this.drivingRouteWithRetry(from, to, options),
      () => this.drivingRouteWithRetry(from, to, options),
    );
    // Keep the chain alive regardless of this call's outcome, but don't leak
    // rejections onto the shared chain.
    this.routeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** One driving-route attempt, then a single retry if it comes back empty. */
  private async drivingRouteWithRetry(
    from: BD09,
    to: BD09,
    options?: DrivingRouteOptions,
  ): Promise<DrivingRouteResult> {
    try {
      const first = await this.drivingRouteOnce(from, to, options);
      if (first.path.length >= 2) return first;
      // Empty path (SDK hiccup) → one retry.
      return await this.drivingRouteOnce(from, to, options);
    } catch {
      return this.drivingRouteOnce(from, to, options);
    }
  }

  private async drivingRouteOnce(
    from: BD09,
    to: BD09,
    options?: DrivingRouteOptions,
  ): Promise<DrivingRouteResult> {
    await this.loadSdk();
    return new Promise<DrivingRouteResult>((resolve, reject) => {
      // Map our policy to Baidu's global constant. The named globals are
      // preferred, with the verified numeric values as a fallback (TIME_PRIORITY
      // = 13, DESTANCE/least-distance = 2). Guarded so a truly missing constant
      // safely falls through to the SDK default.
      let policy: number | undefined;
      if (options?.policy === 'quickest') {
        policy = window.BMAP_DRIVING_POLICY_TIME_PRIORITY ?? 13;
      } else if (options?.policy === 'shortest') {
        policy = window.BMAP_DRIVING_POLICY_DESTANCE ?? 2;
      }

      const route = new window.BMapGL!.DrivingRoute(toPoint(from), {
        ...(policy !== undefined ? { policy } : {}),
        onSearchComplete: (results) => {
          // BMAP_STATUS_SUCCESS is 0 and lives on the global window (not on the
          // BMapGL object), so rely on the presence of a result plan instead of
          // the constant. No plans → treat as "no route found".
          if (!results || !results.getNumPlans || results.getNumPlans() < 1) {
            reject(new MapProviderError('未找到驾车路线。'));
            return;
          }
          const plan = results.getPlan(0);
          const distance = Number(plan.getDistance(false));
          const duration = Number(plan.getDuration(false));
          const path: BD09[] = [];
          for (let i = 0; i < plan.getNumRoutes(); i += 1) {
            for (const point of plan.getRoute(i).getPath()) {
              path.push(fromPoint(point));
            }
          }
          resolve({ distanceMeters: distance, durationSeconds: duration, path });
        },
      });
      route.search(toPoint(from), toPoint(to));
      window.setTimeout(() => reject(new MapProviderError('驾车路线请求超时。')), 20000);
    });
  }
}

class BaiduMapHandle implements MapHandle {
  constructor(readonly native: BMapGL.Map) {}

  setCenter(coord: BD09, zoom?: number): void {
    this.native.setCenter(toPoint(coord));
    if (zoom !== undefined) this.native.setZoom(zoom);
  }

  fitBounds(coords: BD09[]): void {
    if (coords.length === 0) return;
    this.native.setViewport(coords.map(toPoint));
  }

  clearOverlays(): void {
    this.native.clearOverlays();
  }
}
