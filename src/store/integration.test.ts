import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the map provider so planTrip runs without a live Baidu SDK. The mock
// returns straight-line-ish driving results so metrics are populated.
vi.mock('../map', () => ({
  getMapProvider: () => ({
    drivingRoute: async (from: { lng: number; lat: number }, to: { lng: number; lat: number }) => ({
      distanceMeters: Math.abs(from.lng - to.lng) * 100000 + Math.abs(from.lat - to.lat) * 100000,
      durationSeconds: 3600,
      path: [from, to],
    }),
  }),
}));

// In-memory stand-in for the data server. The DataStore client hits /api/*;
// this fetch mock keeps places/routes/trips in maps and mimics the REST
// contract (GET /api/catalog, PUT/DELETE /api/{collection}/:id, import).
type Entity = { id: string } & Record<string, unknown>;
const db = {
  places: new Map<string, Entity>(),
  routes: new Map<string, Entity>(),
  trips: new Map<string, Entity>(),
};

function resetDb(): void {
  db.places.clear();
  db.routes.clear();
  db.trips.clear();
}

const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
  const path = typeof url === 'string' ? url : url.toString();
  const method = init?.method ?? 'GET';
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  if (path === '/api/catalog' && method === 'GET') {
    return json({
      version: 1,
      coordSystem: 'BD09',
      places: [...db.places.values()],
      routes: [...db.routes.values()],
      trips: [...db.trips.values()],
    });
  }

  const m = /^\/api\/(places|routes|trips)(?:\/([^?]+))?/.exec(path);
  if (m) {
    const collection = m[1] as 'places' | 'routes' | 'trips';
    const id = m[2] ? decodeURIComponent(m[2]) : undefined;
    if (method === 'PUT' && id) {
      const entity = JSON.parse(init!.body as string) as Entity;
      db[collection].set(id, entity);
      return json(entity);
    }
    if (method === 'DELETE' && id) {
      db[collection].delete(id);
      return new Response(null, { status: 204 });
    }
  }

  return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
});

vi.stubGlobal('fetch', fetchMock);

import { useAppStore, selectFilteredPlaces, selectFilteredEntities } from './appStore';

function reset(): void {
  resetDb();
  useAppStore.setState({
    places: [],
    routes: [],
    trips: [],
    tripSelection: [],
    tripRouteSelection: [],
    constraints: [],
    activeOrder: null,
    activeRoute: null,
    filterTags: [],
    filterStatus: 'all',
    selectedPlaceId: null,
    activeTripId: null,
    planError: null,
  });
}

describe('integration: catalog → plan → save → reopen', () => {
  beforeEach(reset);

  it('adds places and filters by tag and status', async () => {
    const { addPlace } = useAppStore.getState();
    await addPlace({
      kind: 'destination',
      name: '宏村',
      tags: ['水乡'],
      status: 'visited',
      rating: 5,
      coord: { lng: 117.98, lat: 29.91 },
    });
    await addPlace({
      kind: 'destination',
      name: '大溪漂流',
      tags: ['漂流'],
      status: 'wishlist',
      coord: { lng: 119.55, lat: 30.71 },
    });

    useAppStore.getState().setFilterStatus('wishlist');
    expect(selectFilteredPlaces(useAppStore.getState())).toHaveLength(1);

    useAppStore.getState().setFilterStatus('all');
    useAppStore.getState().setFilterTags(['漂流']);
    expect(selectFilteredPlaces(useAppStore.getState()).map((p) => p.name)).toEqual(['大溪漂流']);
  });

  it('persists a place to the backend and reloads it via init', async () => {
    await useAppStore.getState().addPlace({
      kind: 'destination',
      name: '西递',
      tags: ['水乡'],
      status: 'wishlist',
      coord: { lng: 117.98, lat: 29.88 },
    });
    // Simulate a reload: clear in-memory state, then init() re-fetches from the "server".
    useAppStore.setState({ places: [], routes: [], trips: [] });
    await useAppStore.getState().init();
    expect(useAppStore.getState().places.map((p) => p.name)).toEqual(['西递']);
  });

  it('adds a route with geometry and includes it in the catalog list', async () => {
    const route = await useAppStore.getState().addRoute({
      kind: 'road',
      name: '皖南川藏线',
      tags: ['风景道'],
      status: 'wishlist',
      entry: { lng: 118.96, lat: 30.63 },
      exit: { lng: 118.46, lat: 30.66 },
      path: [
        { lng: 118.96, lat: 30.63 },
        { lng: 118.7, lat: 30.58 },
        { lng: 118.46, lat: 30.66 },
      ],
    });
    expect(db.routes.get(route.id)).toBeDefined();
    expect(useAppStore.getState().routes[0]!.path).toHaveLength(3);
    expect(selectFilteredEntities(useAppStore.getState()).map((e) => e.name)).toContain('皖南川藏线');
  });

  it('blocks a plan that fails a must-include constraint, then succeeds once satisfied', async () => {
    const s = useAppStore.getState();
    const a = await s.addPlace({
      kind: 'destination',
      name: '黄山',
      tags: ['山岳'],
      status: 'wishlist',
      coord: { lng: 118.16, lat: 30.13 },
    });
    s.addToTrip(a.id);
    s.addConstraint('漂流', 1);

    await useAppStore.getState().planTrip();
    expect(useAppStore.getState().planError).toMatch(/漂流/);
    expect(useAppStore.getState().activeRoute).toBeNull();

    // Add a drifting place to satisfy the constraint.
    const b = await useAppStore.getState().addPlace({
      kind: 'destination',
      name: '漂流',
      tags: ['漂流'],
      status: 'wishlist',
      coord: { lng: 119.55, lat: 30.71 },
    });
    useAppStore.getState().addToTrip(b.id);

    await useAppStore.getState().planTrip();
    const route = useAppStore.getState().activeRoute;
    expect(route).not.toBeNull();
    expect(route!.legs.length).toBeGreaterThan(0);
    expect(route!.totalDistanceMeters).toBeGreaterThan(0);
  });

  it('plans a loop spanning both a place and a route', async () => {
    const s = useAppStore.getState();
    const p = await s.addPlace({
      kind: 'destination',
      name: '莫干山',
      tags: ['山岳'],
      status: 'wishlist',
      coord: { lng: 119.87, lat: 30.6 },
    });
    const r = await useAppStore.getState().addRoute({
      kind: 'road',
      name: '风景道',
      tags: ['风景道'],
      status: 'wishlist',
      entry: { lng: 118.96, lat: 30.63 },
      exit: { lng: 118.46, lat: 30.66 },
    });
    useAppStore.getState().addToTrip(p.id);
    useAppStore.getState().addToTrip(r.id);
    expect(useAppStore.getState().tripSelection).toEqual([p.id]);
    expect(useAppStore.getState().tripRouteSelection).toEqual([r.id]);

    await useAppStore.getState().planTrip();
    const order = useAppStore.getState().activeOrder;
    expect(order).not.toBeNull();
    expect(order!.map((o) => o.placeId).sort()).toEqual([p.id, r.id].sort());
  });

  it('saves a trip and reopens it, restoring selection and constraints', async () => {
    const s = useAppStore.getState();
    const a = await s.addPlace({
      kind: 'destination',
      name: 'A',
      tags: ['x'],
      status: 'wishlist',
      coord: { lng: 120.1, lat: 31.1 },
    });
    const b = await useAppStore.getState().addPlace({
      kind: 'destination',
      name: 'B',
      tags: ['x'],
      status: 'wishlist',
      coord: { lng: 120.5, lat: 31.4 },
    });
    useAppStore.getState().addToTrip(a.id);
    useAppStore.getState().addToTrip(b.id);
    useAppStore.getState().addConstraint('x', 1);
    await useAppStore.getState().planTrip();

    await useAppStore.getState().saveTrip('Weekend loop');
    const saved = useAppStore.getState().trips;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.placeIds).toEqual([a.id, b.id]);
    expect(saved[0]!.routeIds).toEqual([]);
    // The trip was persisted to the backend.
    expect(db.trips.get(saved[0]!.id)).toBeDefined();

    // Simulate "reload" by clearing volatile selection, then reopen.
    useAppStore.getState().clearTripSelection();
    expect(useAppStore.getState().tripSelection).toEqual([]);

    useAppStore.getState().openTrip(saved[0]!.id);
    const st = useAppStore.getState();
    expect(st.tripSelection).toEqual([a.id, b.id]);
    expect(st.constraints.map((c) => c.tag)).toEqual(['x']);
    expect(st.activeRoute).not.toBeNull();
  });

  it('marks trips for review when a referenced place is deleted', async () => {
    const s = useAppStore.getState();
    const a = await s.addPlace({
      kind: 'destination',
      name: 'A',
      tags: [],
      status: 'wishlist',
      coord: { lng: 120.1, lat: 31.1 },
    });
    useAppStore.getState().addToTrip(a.id);
    await useAppStore.getState().saveTrip('T');
    const { affectedTripIds } = await useAppStore.getState().removePlace(a.id);
    expect(affectedTripIds).toHaveLength(1);
    expect(useAppStore.getState().trips[0]!.needsReview).toBe(true);
    expect(useAppStore.getState().trips[0]!.placeIds).not.toContain(a.id);
    // The delete and the trip update were both persisted.
    expect(db.places.get(a.id)).toBeUndefined();
    expect(db.trips.get(useAppStore.getState().trips[0]!.id)!.needsReview).toBe(true);
  });
});
