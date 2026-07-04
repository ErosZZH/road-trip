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

import { useAppStore, selectFilteredPlaces } from './appStore';

function reset(): void {
  useAppStore.setState({
    places: [],
    trips: [],
    tripSelection: [],
    constraints: [],
    activeOrder: null,
    activeRoute: null,
    filterTags: [],
    filterStatus: 'all',
    selectedPlaceId: null,
    planError: null,
  });
}

describe('integration: catalog → plan → save → reopen', () => {
  beforeEach(reset);

  it('adds places and filters by tag and status', () => {
    const { addPlace } = useAppStore.getState();
    addPlace({
      kind: 'destination',
      name: '宏村',
      tags: ['水乡'],
      status: 'visited',
      rating: 5,
      coord: { lng: 117.98, lat: 29.91 },
    });
    addPlace({
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

  it('blocks a plan that fails a must-include constraint, then succeeds once satisfied', async () => {
    const s = useAppStore.getState();
    const a = s.addPlace({
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
    const b = useAppStore.getState().addPlace({
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

  it('saves a trip and reopens it, restoring selection and constraints', async () => {
    const s = useAppStore.getState();
    const a = s.addPlace({
      kind: 'destination',
      name: 'A',
      tags: ['x'],
      status: 'wishlist',
      coord: { lng: 120.1, lat: 31.1 },
    });
    const b = s.addPlace({
      kind: 'destination',
      name: 'B',
      tags: ['x'],
      status: 'wishlist',
      coord: { lng: 120.5, lat: 31.4 },
    });
    s.addToTrip(a.id);
    s.addToTrip(b.id);
    s.addConstraint('x', 1);
    await useAppStore.getState().planTrip();

    useAppStore.getState().saveTrip('Weekend loop');
    const saved = useAppStore.getState().trips;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.placeIds).toEqual([a.id, b.id]);

    // Simulate "reload" by clearing volatile selection, then reopen.
    useAppStore.getState().clearTripSelection();
    expect(useAppStore.getState().tripSelection).toEqual([]);

    useAppStore.getState().openTrip(saved[0]!.id);
    const st = useAppStore.getState();
    expect(st.tripSelection).toEqual([a.id, b.id]);
    expect(st.constraints.map((c) => c.tag)).toEqual(['x']);
    expect(st.activeRoute).not.toBeNull();
  });

  it('marks trips for review when a referenced place is deleted', () => {
    const s = useAppStore.getState();
    const a = s.addPlace({
      kind: 'destination',
      name: 'A',
      tags: [],
      status: 'wishlist',
      coord: { lng: 120.1, lat: 31.1 },
    });
    s.addToTrip(a.id);
    s.saveTrip('T');
    const { affectedTripIds } = useAppStore.getState().removePlace(a.id);
    expect(affectedTripIds).toHaveLength(1);
    expect(useAppStore.getState().trips[0]!.needsReview).toBe(true);
    expect(useAppStore.getState().trips[0]!.placeIds).not.toContain(a.id);
  });
});
