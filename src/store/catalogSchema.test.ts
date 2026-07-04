import { describe, it, expect } from 'vitest';
import {
  parseCatalog,
  serializeCatalog,
  mergeCatalogs,
  emptyCatalog,
  CATALOG_VERSION,
} from './catalogSchema';
import type { CatalogData } from '../types';

const sample: CatalogData = {
  version: CATALOG_VERSION,
  coordSystem: 'BD09',
  places: [
    {
      id: 'p1',
      kind: 'destination',
      name: '宏村',
      tags: ['water-town'],
      status: 'visited',
      rating: 5,
      coord: { lng: 117.98, lat: 29.91 },
    },
  ],
  routes: [
    {
      id: 'r1',
      kind: 'road',
      name: '皖南川藏线',
      tags: ['scenic-drive'],
      status: 'wishlist',
      entry: { lng: 118.62, lat: 30.47 },
      exit: { lng: 118.95, lat: 30.29 },
      waypoints: [
        { lng: 118.7, lat: 30.4 },
        { lng: 118.8, lat: 30.35 },
      ],
      path: [
        { lng: 118.62, lat: 30.47 },
        { lng: 118.7, lat: 30.4 },
        { lng: 118.8, lat: 30.35 },
        { lng: 118.95, lat: 30.29 },
      ],
    },
  ],
  trips: [
    {
      id: 't1',
      name: 'Summer loop',
      placeIds: ['p1'],
      routeIds: ['r1'],
      constraints: [{ type: 'includesTag', tag: 'drifting', min: 1 }],
    },
  ],
};

describe('export/import round-trip', () => {
  it('serializes then parses back to an equivalent catalog', () => {
    const json = serializeCatalog(sample);
    const result = parseCatalog(JSON.parse(json));
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(sample);
  });

  it('produces human-readable (indented) JSON', () => {
    const json = serializeCatalog(sample);
    expect(json).toContain('\n');
    expect(json).toContain('  "places"');
    expect(json).toContain('  "routes"');
  });
});

describe('parseCatalog rejection', () => {
  it('rejects non-object input', () => {
    expect(parseCatalog(42).ok).toBe(false);
    expect(parseCatalog(null).ok).toBe(false);
  });

  it('rejects a missing coordSystem', () => {
    expect(parseCatalog({ version: 1, places: [], routes: [], trips: [] }).ok).toBe(false);
  });

  it('rejects a non-array routes field', () => {
    const bad = { version: 1, coordSystem: 'BD09', places: [], routes: {}, trips: [] };
    expect(parseCatalog(bad).ok).toBe(false);
  });

  it('rejects a place with a bad coordinate', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [{ id: 'x', kind: 'destination', name: 'X', tags: [], status: 'wishlist' }],
      routes: [],
      trips: [],
    };
    const res = parseCatalog(bad);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/第 0 项/);
  });

  it('rejects a rating on a wishlist place', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [
        {
          id: 'x',
          kind: 'destination',
          name: 'X',
          tags: [],
          status: 'wishlist',
          rating: 5,
          coord: { lng: 120, lat: 31 },
        },
      ],
      routes: [],
      trips: [],
    };
    expect(parseCatalog(bad).ok).toBe(false);
  });

  it('rejects a route missing an endpoint', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [],
      routes: [
        {
          id: 'r',
          kind: 'road',
          name: 'R',
          tags: [],
          status: 'wishlist',
          entry: { lng: 118, lat: 30 },
        },
      ],
      trips: [],
    };
    expect(parseCatalog(bad).ok).toBe(false);
  });

  it('rejects a route with an invalid waypoint', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [],
      routes: [
        {
          id: 'r',
          kind: 'road',
          name: 'R',
          tags: [],
          status: 'wishlist',
          entry: { lng: 118, lat: 30 },
          exit: { lng: 119, lat: 30 },
          waypoints: [{ lng: 118.5 }],
        },
      ],
      trips: [],
    };
    expect(parseCatalog(bad).ok).toBe(false);
  });

  it('rejects a route with invalid path geometry', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [],
      routes: [
        {
          id: 'r',
          kind: 'road',
          name: 'R',
          tags: [],
          status: 'wishlist',
          entry: { lng: 118, lat: 30 },
          exit: { lng: 119, lat: 30 },
          path: [{ lng: 118, lat: 30 }, { lat: 30.1 }],
        },
      ],
      trips: [],
    };
    expect(parseCatalog(bad).ok).toBe(false);
  });

  it('accepts a route with valid waypoints and path', () => {
    const good = {
      version: 1,
      coordSystem: 'BD09',
      places: [],
      routes: [
        {
          id: 'r',
          kind: 'road',
          name: 'R',
          tags: [],
          status: 'wishlist',
          entry: { lng: 118, lat: 30 },
          exit: { lng: 119, lat: 30 },
          waypoints: [{ lng: 118.5, lat: 30.1 }],
          path: [
            { lng: 118, lat: 30 },
            { lng: 118.5, lat: 30.1 },
            { lng: 119, lat: 30 },
          ],
        },
      ],
      trips: [],
    };
    const res = parseCatalog(good);
    expect(res.ok).toBe(true);
    expect(res.data!.routes[0]!.waypoints).toHaveLength(1);
    expect(res.data!.routes[0]!.path).toHaveLength(3);
  });
});

describe('legacy migration', () => {
  it('routes a legacy road mixed into the places array to the routes collection', () => {
    const legacy = {
      version: 1,
      coordSystem: 'BD09',
      places: [
        {
          id: 'p1',
          kind: 'destination',
          name: '宏村',
          tags: [],
          status: 'wishlist',
          coord: { lng: 117.98, lat: 29.91 },
        },
        {
          id: 'r1',
          kind: 'road',
          name: '皖南川藏线',
          tags: [],
          status: 'wishlist',
          entry: { lng: 118.62, lat: 30.47 },
          exit: { lng: 118.95, lat: 30.29 },
        },
      ],
      trips: [{ id: 't1', name: 'Old', placeIds: ['p1', 'r1'], constraints: [] }],
    };
    const res = parseCatalog(legacy);
    expect(res.ok).toBe(true);
    expect(res.data!.places).toHaveLength(1);
    expect(res.data!.routes).toHaveLength(1);
    expect(res.data!.routes[0]!.id).toBe('r1');
    // A legacy trip without routeIds gets an empty array.
    expect(res.data!.trips[0]!.routeIds).toEqual([]);
  });
});

describe('mergeCatalogs', () => {
  it('deduplicates places and routes by id with incoming winning', () => {
    const base = emptyCatalog();
    base.places = [
      {
        id: 'p1',
        kind: 'destination',
        name: 'Old',
        tags: [],
        status: 'wishlist',
        coord: { lng: 1, lat: 1 },
      },
    ];
    base.routes = [
      {
        id: 'r1',
        kind: 'road',
        name: 'OldRoad',
        tags: [],
        status: 'wishlist',
        entry: { lng: 1, lat: 1 },
        exit: { lng: 2, lat: 2 },
      },
    ];
    const incoming = emptyCatalog();
    incoming.places = [
      {
        id: 'p1',
        kind: 'destination',
        name: 'New',
        tags: [],
        status: 'wishlist',
        coord: { lng: 2, lat: 2 },
      },
      {
        id: 'p2',
        kind: 'destination',
        name: 'Extra',
        tags: [],
        status: 'wishlist',
        coord: { lng: 3, lat: 3 },
      },
    ];
    incoming.routes = [
      {
        id: 'r1',
        kind: 'road',
        name: 'NewRoad',
        tags: [],
        status: 'wishlist',
        entry: { lng: 3, lat: 3 },
        exit: { lng: 4, lat: 4 },
      },
    ];
    const merged = mergeCatalogs(base, incoming);
    expect(merged.places).toHaveLength(2);
    expect(merged.places.find((p) => p.id === 'p1')?.name).toBe('New');
    expect(merged.routes).toHaveLength(1);
    expect(merged.routes.find((r) => r.id === 'r1')?.name).toBe('NewRoad');
  });
});
