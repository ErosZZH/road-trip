import { create } from 'zustand';
import type { CatalogData, Place, RouteMetrics, RouteStop, TagConstraint, Trip } from '../types';
import { DataStore } from './DataStore';
import { seedFromBundled } from './seed';
import { emptyCatalog } from './catalogSchema';
import { newId } from '../util/id';
import { runPlanTrip } from './planTrip';

const store = new DataStore();

/** Distributive Omit so the union's variant-specific keys (coord/entry/exit) survive. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** A place with all fields except the generated id. */
export type NewPlaceInput = DistributiveOmit<Place, 'id'>;

export interface AppState {
  // Data
  places: Place[];
  trips: Trip[];
  loaded: boolean;

  // UI state
  selectedPlaceId: string | null;
  /** Candidate place ids for the trip currently being planned. */
  tripSelection: string[];
  activeTripId: string | null;

  // Filters (map-visualization)
  filterTags: string[];
  filterStatus: 'all' | 'visited' | 'wishlist';
  setFilterTags: (tags: string[]) => void;
  setFilterStatus: (status: 'all' | 'visited' | 'wishlist') => void;

  // Lifecycle
  init: () => Promise<void>;

  // Place CRUD (each persists)
  addPlace: (input: NewPlaceInput) => Place;
  updatePlace: (id: string, patch: Partial<NewPlaceInput>) => void;
  removePlace: (id: string) => { affectedTripIds: string[] };

  // Selection
  selectPlace: (id: string | null) => void;

  // Import/export replace hook (used by Group 4 UI)
  replaceAll: (data: CatalogData) => Promise<void>;
  mergeIn: (data: CatalogData) => Promise<void>;

  // Trip selection (used by Group 7)
  addToTrip: (placeId: string) => void;
  removeFromTrip: (placeId: string) => void;
  clearTripSelection: () => void;

  // Trip planning (Group 7)
  constraints: TagConstraint[];
  activeOrder: RouteStop[] | null;
  activeRoute: RouteMetrics | null;
  planning: boolean;
  planError: string | null;
  addConstraint: (tag: string, min?: number) => void;
  removeConstraint: (tag: string) => void;
  planTrip: () => Promise<void>;
  saveTrip: (name: string) => void;
  openTrip: (tripId: string) => void;
  deleteTrip: (tripId: string) => void;
}

function snapshot(state: Pick<AppState, 'places' | 'trips'>): CatalogData {
  return { ...emptyCatalog(), places: state.places, trips: state.trips };
}

export const useAppStore = create<AppState>((set, get) => {
  /** Persist current places+trips (fire and forget; storage errors are swallowed by DataStore). */
  const persist = (): void => {
    void store.save(snapshot(get()));
  };

  return {
    places: [],
    trips: [],
    loaded: false,
    selectedPlaceId: null,
    tripSelection: [],
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
      const data = await store.loadInitial(seedFromBundled());
      set({ places: data.places, trips: data.trips, loaded: true });
    },

    addPlace(input) {
      const place = { ...input, id: newId('place') } as Place;
      set((s) => ({ places: [...s.places, place] }));
      persist();
      return place;
    },

    updatePlace(id, patch) {
      set((s) => ({
        places: s.places.map((p) => (p.id === id ? ({ ...p, ...patch } as Place) : p)),
      }));
      persist();
    },

    removePlace(id) {
      const affectedTripIds = get()
        .trips.filter((t) => t.placeIds.includes(id))
        .map((t) => t.id);
      set((s) => ({
        places: s.places.filter((p) => p.id !== id),
        trips: s.trips.map((t) =>
          t.placeIds.includes(id)
            ? { ...t, placeIds: t.placeIds.filter((pid) => pid !== id), needsReview: true }
            : t,
        ),
        selectedPlaceId: s.selectedPlaceId === id ? null : s.selectedPlaceId,
        tripSelection: s.tripSelection.filter((pid) => pid !== id),
      }));
      persist();
      return { affectedTripIds };
    },

    selectPlace(id) {
      set({ selectedPlaceId: id });
    },

    async replaceAll(data) {
      set({ places: data.places, trips: data.trips });
      await store.save(snapshot(get()));
    },

    async mergeIn(data) {
      const merged = store.merge(snapshot(get()), data);
      set({ places: merged.places, trips: merged.trips });
      await store.save(merged);
    },

    addToTrip(placeId) {
      set((s) =>
        s.tripSelection.includes(placeId)
          ? s
          : { tripSelection: [...s.tripSelection, placeId] },
      );
    },

    removeFromTrip(placeId) {
      set((s) => ({ tripSelection: s.tripSelection.filter((id) => id !== placeId) }));
    },

    clearTripSelection() {
      set({ tripSelection: [], activeOrder: null, activeRoute: null, planError: null });
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

    saveTrip(name) {
      const s = get();
      const trip: Trip = {
        id: newId('trip'),
        name: name.trim() || 'Untitled trip',
        placeIds: [...s.tripSelection],
        constraints: [...s.constraints],
        order: s.activeOrder ?? undefined,
        metrics: s.activeRoute ?? undefined,
      };
      set((state) => ({ trips: [...state.trips, trip], activeTripId: trip.id }));
      persist();
    },

    openTrip(tripId) {
      const trip = get().trips.find((t) => t.id === tripId);
      if (!trip) return;
      set({
        tripSelection: [...trip.placeIds],
        constraints: [...trip.constraints],
        activeOrder: trip.order ?? null,
        activeRoute: trip.metrics ?? null,
        activeTripId: trip.id,
        planError: null,
      });
    },

    deleteTrip(tripId) {
      set((s) => ({
        trips: s.trips.filter((t) => t.id !== tripId),
        activeTripId: s.activeTripId === tripId ? null : s.activeTripId,
      }));
      persist();
    },
  };
});

/** Collect all distinct tags across the catalog (for autocomplete). */
export function selectAllTags(state: AppState): string[] {
  const set = new Set<string>();
  for (const p of state.places) for (const t of p.tags) set.add(t);
  return [...set].sort();
}

/** Places passing the active tag + status filters (map-visualization). */
export function selectFilteredPlaces(state: AppState): Place[] {
  return state.places.filter((p) => {
    if (state.filterStatus !== 'all' && p.status !== state.filterStatus) return false;
    if (state.filterTags.length > 0 && !state.filterTags.some((t) => p.tags.includes(t))) {
      return false;
    }
    return true;
  });
}
