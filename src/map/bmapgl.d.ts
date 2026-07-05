/**
 * Minimal ambient declarations for the Baidu Maps GL JavaScript API (BMapGL).
 * Only the members used by BaiduMapProvider are typed; the SDK is loaded at
 * runtime via a <script> tag, so this keeps its usage type-safe without
 * pulling in an untyped global everywhere.
 */
declare global {
  interface Window {
    BMapGL?: typeof BMapGL;
    /** JSONP callback hook invoked by the Baidu loader when the SDK is ready. */
    __onBMapGLReady?: () => void;
    /**
     * Driving-policy constants, exposed as globals once the BMapGL SDK loads.
     * Names/values verified live against this SDK build. `DESTANCE` is Baidu's
     * own (mis-spelled) constant for least-distance.
     */
    BMAP_DRIVING_POLICY_TIME_PRIORITY?: number;
    BMAP_DRIVING_POLICY_DESTANCE?: number;
  }

  namespace BMapGL {
    class Point {
      constructor(lng: number, lat: number);
      lng: number;
      lat: number;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Map {
      constructor(container: string | HTMLElement, opts?: { enableMapClick?: boolean });
      centerAndZoom(center: Point, zoom: number): void;
      setCenter(center: Point): void;
      setZoom(zoom: number): void;
      addOverlay(overlay: Overlay): void;
      removeOverlay(overlay: Overlay): void;
      clearOverlays(): void;
      enableScrollWheelZoom(enable?: boolean): void;
      setViewport(points: Point[]): void;
    }

    interface Overlay {
      addEventListener(event: string, handler: () => void): void;
    }

    class Marker implements Overlay {
      constructor(point: Point, opts?: { title?: string; icon?: Icon });
      addEventListener(event: string, handler: () => void): void;
      setTitle(title: string): void;
    }

    class Polyline implements Overlay {
      constructor(
        points: Point[],
        opts?: { strokeColor?: string; strokeWeight?: number; strokeOpacity?: number },
      );
      addEventListener(event: string, handler: () => void): void;
    }

    class Icon {
      constructor(url: string, size: Size, opts?: { anchor?: Size });
    }

    class Geocoder {
      getPoint(
        address: string,
        callback: (point: Point | null) => void,
        city?: string,
      ): void;
      getLocation(
        point: Point,
        callback: (result: { address: string } | null) => void,
      ): void;
    }

    /** POI local search — returns multiple candidate results for a keyword. */
    class LocalSearch {
      constructor(
        location: Map | Point | string,
        opts?: {
          onSearchComplete?: (results: LocalSearchResult) => void;
          pageCapacity?: number;
          renderOptions?: { map?: Map; autoViewport?: boolean };
        },
      );
      search(keyword: string): void;
      getStatus(): number;
    }

    interface LocalSearchResult {
      getCurrentNumPois(): number;
      getPoi(index: number): LocalSearchPoi;
    }

    interface LocalSearchPoi {
      title: string;
      point: Point;
      address?: string;
      city?: string;
    }

    const BMAP_STATUS_SUCCESS: number;

    class DrivingRoute {
      constructor(
        location: Map | Point | string,
        opts?: {
          renderOptions?: { map?: Map; autoViewport?: boolean };
          policy?: number;
          onSearchComplete?: (results: DrivingRouteResult) => void;
        },
      );
      search(start: Point, end: Point): void;
      getStatus(): number;
    }

    interface DrivingRouteResult {
      getNumPlans(): number;
      getPlan(index: number): RoutePlan;
    }

    interface RoutePlan {
      getDistance(format: boolean): number | string;
      getDuration(format: boolean): number | string;
      getNumRoutes(): number;
      getRoute(index: number): RouteObj;
    }

    interface RouteObj {
      getPath(): Point[];
    }
  }
}

export {};
