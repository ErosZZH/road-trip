import { create } from 'zustand';
import type {
  CatalogData,
  CatalogEntity,
  Place,
  Route,
  RouteMetrics,
  RouteStop,
  TagConstraint,
  Trip,
} from '../types';
import { DataStore } from './DataStore';
import { newId } from '../util/id';
import { runPlanTrip } from './planTrip';

const store = new DataStore();

/** A place with all fields except the generated id. */
export type NewPlaceInput = Omit<Place, 'id'>;
/** A route with all fields except the generated id. */
export type NewRouteInput = Omit<Route, 'id'>;

export interface AppState {
  // Data
  places: Place[];
  routes: Route[];
  trips: Trip[];
  loaded: boolean;
  loadError: string | null;

  // UI state
  selectedPlaceId: string | null;
  /** Candidate destination-place ids for the trip currently being planned. */
  tripSelection: string[];
  /** Candidate route ids for the trip currently being planned. */
  tripRouteSelection: string[];
  activeTripId: string | null;

  // Filters (map-visualization)
  filterTags: string[];
  filterStatus: 'all' | 'visited' | 'wishlist';
  setFilterTags: (tags: string[]) => void;
  setFilterStatus: (status: 'all' | 'visited' | 'wishlist') => void;

  // Lifecycle
  init: () => Promise<void>;

  // Place CRUD (each persists to the backend)
  addPlace: (input: NewPlaceInput) => Promise<Place>;
  updatePlace: (id: string, patch: Partial<NewPlaceInput>) => Promise<void>;
  removePlace: (id: string) => Promise<{ affectedTripIds: string[] }>;

  // Route CRUD (each persists to the backend)
  addRoute: (input: NewRouteInput) => Promise<Route>;
  updateRoute: (id: string, patch: Partial<NewRouteInput>) => Promise<void>;
  removeRoute: (id: string) => Promise<{ affectedTripIds: string[] }>;

  // Selection
  selectPlace: (id: string | null) => void;

  // Import/export replace hook
  replaceAll: (data: CatalogData) => Promise<void>;
  mergeIn: (data: CatalogData) => Promise<void>;

  // Trip selection
  addToTrip: (id: string) => void;
  removeFromTrip: (id: string) => void;
  clearTripSelection: () => void;

  // Trip planning
  constraints: TagConstraint[];
  activeOrder: RouteStop[] | null;
  activeRoute: RouteMetrics | null;
  planning: boolean;
  planError: string | null;
  addConstraint: (tag: string, min?: number) => void;
  removeConstraint: (tag: string) => void;
  planTrip: () => Promise<void>;
  saveTrip: (name: string) => Promise<void>;
  openTrip: (tripId: string) => void;
  deleteTrip: (tripId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => {
  return {
    places: [],
    routes: [],
    trips: [],
    loaded: false,
    loadError: null,
    selectedPlaceId: null,
    tripSelection: [],
    tripRouteSelection: [],
    activeTripId: null,
    filterTags: [],
    filterStatus: 'all',

    setFilterTags(tags) {
      set({ filterTags: tags });
    },

    setFilterStatus(status) {
      set({ filterStatus: status });
    },

    async init() {
      try {
        const data = await store.load();
        set({
          places: data.places,
          routes: data.routes,
          trips: data.trips,
          loaded: true,
          loadError: null,
        });
      } catch (err) {
        // Still mark loaded so the UI renders; surface the error.
        set({
          loaded: true,
          loadError: err instanceof Error ? err.message : '无法从数据服务加载。',
        });
      }
    },

    async addPlace(input) {
      const place = { ...input, id: newId('place') } as Place;
      const saved = await store.savePlace(place);
      set((s) => ({ places: [...s.places, saved] }));
      return saved;
    },

    async updatePlace(id, patch) {
      const current = get().places.find((p) => p.id === id);
      if (!current) return;
      const next = { ...current, ...patch } as Place;
      const saved = await store.savePlace(next);
      set((s) => ({ places: s.places.map((p) => (p.id === id ? saved : p)) }));
    },

    async removePlace(id) {
      await store.deletePlace(id);
      const affectedTripIds = get()
        .trips.filter((t) => t.placeIds.includes(id))
        .map((t) => t.id);
      // Mark affected trips for review and persist each change.
      const updatedTrips = get().trips.map((t) =>
        t.placeIds.includes(id)
          ? { ...t, placeIds: t.placeIds.filter((pid) => pid !== id), needsReview: true }
          : t,
      );
      await Promise.all(
        updatedTrips.filter((t) => affectedTripIds.includes(t.id)).map((t) => store.saveTrip(t)),
      );
      set((s) => ({
        places: s.places.filter((p) => p.id !== id),
        trips: updatedTrips,
        selectedPlaceId: s.selectedPlaceId === id ? null : s.selectedPlaceId,
        tripSelection: s.tripSelection.filter((pid) => pid !== id),
      }));
      return { affectedTripIds };
    },

    async addRoute(input) {
      const route = { ...input, id: newId('route') } as Route;
      const saved = await store.saveRoute(route);
      set((s) => ({ routes: [...s.routes, saved] }));
      return saved;
    },

    async updateRoute(id, patch) {
      const current = get().routes.find((r) => r.id === id);
      if (!current) return;
      const next = { ...current, ...patch } as Route;
      const saved = await store.saveRoute(next);
      set((s) => ({ routes: s.routes.map((r) => (r.id === id ? saved : r)) }));
    },

    async removeRoute(id) {
      await store.deleteRoute(id);
      const affectedTripIds = get()
        .trips.filter((t) => t.routeIds.includes(id))
        .map((t) => t.id);
      const updatedTrips = get().trips.map((t) =>
        t.routeIds.includes(id)
          ? { ...t, routeIds: t.routeIds.filter((rid) => rid !== id), needsReview: true }
          : t,
      );
      await Promise.all(
        updatedTrips.filter((t) => affectedTripIds.includes(t.id)).map((t) => store.saveTrip(t)),
      );
      set((s) => ({
        routes: s.routes.filter((r) => r.id !== id),
        trips: updatedTrips,
        selectedPlaceId: s.selectedPlaceId === id ? null : s.selectedPlaceId,
        tripRouteSelection: s.tripRouteSelection.filter((rid) => rid !== id),
      }));
      return { affectedTripIds };
    },

    selectPlace(id) {
      set({ selectedPlaceId: id });
    },

    async replaceAll(data) {
      const persisted = await store.import(data, 'replace');
      set({ places: persisted.places, routes: persisted.routes, trips: persisted.trips });
    },

    async mergeIn(data) {
      const persisted = await store.import(data, 'merge');
      set({ places: persisted.places, routes: persisted.routes, trips: persisted.trips });
    },

    addToTrip(id) {
      const isRoute = get().routes.some((r) => r.id === id);
      set((s) => {
        if (isRoute) {
          return s.tripRouteSelection.includes(id)
            ? s
            : { tripRouteSelection: [...s.tripRouteSelection, id] };
        }
        return s.tripSelection.includes(id) ? s : { tripSelection: [...s.tripSelection, id] };
      });
    },

    removeFromTrip(id) {
      set((s) => ({
        tripSelection: s.tripSelection.filter((pid) => pid !== id),
        tripRouteSelection: s.tripRouteSelection.filter((rid) => rid !== id),
      }));
    },

    clearTripSelection() {
      set({
        tripSelection: [],
        tripRouteSelection: [],
        activeOrder: null,
        activeRoute: null,
        planError: null,
      });
    },

    // ---- Trip planning (implemented in planTrip.ts, wired below) ----
    constraints: [],
    activeOrder: null,
    activeRoute: null,
    planning: false,
    planError: null,

    addConstraint(tag, min = 1) {
      set((s) =>
        s.constraints.some((c) => c.tag === tag)
          ? s
          : { constraints: [...s.constraints, { type: 'includesTag', tag, min }] },
      );
    },

    removeConstraint(tag) {
      set((s) => ({ constraints: s.constraints.filter((c) => c.tag !== tag) }));
    },

    async planTrip() {
      await runPlanTrip(set, get);
    },

    async saveTrip(name) {
      const s = get();
      const trip: Trip = {
        id: s.activeTripId ?? newId('trip'),
        name: name.trim() || 'Untitled trip',
        placeIds: [...s.tripSelection],
        routeIds: [...s.tripRouteSelection],
        constraints: [...s.constraints],
        order: s.activeOrder ?? undefined,
        metrics: s.activeRoute ?? undefined,
      };
      const saved = await store.saveTrip(trip);
      set((state) => ({
        trips: [...state.trips.filter((t) => t.id !== saved.id), saved],
        activeTripId: saved.id,
      }));
    },

    openTrip(tripId) {
      const trip = get().trips.find((t) => t.id === tripId);
      if (!trip) return;
      set({
        tripSelection: [...trip.placeIds],
        tripRouteSelection: [...trip.routeIds],
        constraints: [...trip.constraints],
        activeOrder: trip.order ?? null,
        activeRoute: trip.metrics ?? null,
        activeTripId: trip.id,
        planError: null,
      });
    },

    async deleteTrip(tripId) {
      await store.deleteTrip(tripId);
      set((s) => ({
        trips: s.trips.filter((t) => t.id !== tripId),
        activeTripId: s.activeTripId === tripId ? null : s.activeTripId,
      }));
    },
  };
});

/** Every place and route as a single entity list (for planning/selection). */
export function selectAllEntities(state: AppState): CatalogEntity[] {
  return [...state.places, ...state.routes];
}

/** Collect all distinct tags across places and routes (for autocomplete). */
export function selectAllTags(state: AppState): string[] {
  const set = new Set<string>();
  for (const p of state.places) for (const t of p.tags) set.add(t);
  for (const r of state.routes) for (const t of r.tags) set.add(t);
  return [...set].sort();
}

function passesFilter(entity: CatalogEntity, state: AppState): boolean {
  if (state.filterStatus !== 'all' && entity.status !== state.filterStatus) return false;
  if (state.filterTags.length > 0 && !state.filterTags.some((t) => entity.tags.includes(t))) {
    return false;
  }
  return true;
}

/** Destination places passing the active tag + status filters (map markers + list). */
export function selectFilteredPlaces(state: AppState): Place[] {
  return state.places.filter((p) => passesFilter(p, state));
}

/** Routes passing the active tag + status filters (map polylines + list). */
export function selectFilteredRoutes(state: AppState): Route[] {
  return state.routes.filter((r) => passesFilter(r, state));
}

/** Places and routes passing the active filters, combined (catalog list). */
export function selectFilteredEntities(state: AppState): CatalogEntity[] {
  return [...selectFilteredPlaces(state), ...selectFilteredRoutes(state)];
}
