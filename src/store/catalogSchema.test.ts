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
    },
  ],
  trips: [
    {
      id: 't1',
      name: 'Summer loop',
      placeIds: ['p1', 'r1'],
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
  });
});

describe('parseCatalog rejection', () => {
  it('rejects non-object input', () => {
    expect(parseCatalog(42).ok).toBe(false);
    expect(parseCatalog(null).ok).toBe(false);
  });

  it('rejects a missing coordSystem', () => {
    expect(parseCatalog({ version: 1, places: [], trips: [] }).ok).toBe(false);
  });

  it('rejects a place with a bad coordinate', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [{ id: 'x', kind: 'destination', name: 'X', tags: [], status: 'wishlist' }],
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
      trips: [],
    };
    expect(parseCatalog(bad).ok).toBe(false);
  });

  it('rejects a road missing an endpoint', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [
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

  it('rejects a road with an invalid waypoint', () => {
    const bad = {
      version: 1,
      coordSystem: 'BD09',
      places: [
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

  it('accepts a road with valid waypoints', () => {
    const good = {
      version: 1,
      coordSystem: 'BD09',
      places: [
        {
          id: 'r',
          kind: 'road',
          name: 'R',
          tags: [],
          status: 'wishlist',
          entry: { lng: 118, lat: 30 },
          exit: { lng: 119, lat: 30 },
          waypoints: [{ lng: 118.5, lat: 30.1 }],
        },
      ],
      trips: [],
    };
    const res = parseCatalog(good);
    expect(res.ok).toBe(true);
    expect((res.data!.places[0] as { waypoints?: unknown[] }).waypoints).toHaveLength(1);
  });
});

describe('mergeCatalogs', () => {
  it('deduplicates by id with incoming winning', () => {
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
    const merged = mergeCatalogs(base, incoming);
    expect(merged.places).toHaveLength(2);
    expect(merged.places.find((p) => p.id === 'p1')?.name).toBe('New');
  });
});

describe('bundled seed', () => {
  it('parses as a valid catalog', async () => {
    const seed = (await import('../../data/places.seed.json')).default;
    const res = parseCatalog(seed);
    expect(res.ok).toBe(true);
    expect(res.data!.places.length).toBeGreaterThan(0);
  });
});
