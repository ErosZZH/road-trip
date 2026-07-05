import { describe, it, expect } from 'vitest';
import { optimizeRoute, tourCost, stopEndpoints } from './optimizer';
import type { BD09, CatalogEntity, Place, Route } from '../types';

const HOME: BD09 = { lng: 120.7345, lat: 31.3178 };

function dest(id: string, lng: number, lat: number, tags: string[] = []): Place {
  return { id, kind: 'destination', name: id, tags, status: 'wishlist', coord: { lng, lat } };
}

function road(id: string, entry: BD09, exit: BD09): Route {
  return { id, kind: 'road', name: id, tags: ['scenic-drive'], status: 'wishlist', entry, exit };
}

describe('optimizeRoute — trivial cases', () => {
  it('returns an empty order for no places', () => {
    const res = optimizeRoute(HOME, []);
    expect(res.order).toEqual([]);
    expect(res.estimatedMeters).toBe(0);
  });

  it('returns a single-stop there-and-back for one place', () => {
    const res = optimizeRoute(HOME, [dest('a', 120.8, 31.4)]);
    expect(res.order).toHaveLength(1);
    expect(res.order[0]!.placeId).toBe('a');
    expect(res.estimatedMeters).toBeGreaterThan(0);
  });
});

describe('optimizeRoute — ordering quality', () => {
  it('visits every selected place exactly once', () => {
    const places = [
      dest('a', 121.0, 31.5),
      dest('b', 120.5, 31.0),
      dest('c', 121.2, 31.8),
      dest('d', 120.2, 31.2),
    ];
    const res = optimizeRoute(HOME, places);
    const ids = res.order.map((s) => s.placeId).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('produces a tour no worse than the naive input order', () => {
    const places = [
      dest('a', 121.5, 31.9),
      dest('b', 120.1, 31.1),
      dest('c', 121.4, 31.85),
      dest('d', 120.2, 31.15),
      dest('e', 121.45, 31.88),
    ];
    // Naive cost = places in given order.
    const naiveNodes = places.map((p) => ({
      placeId: p.id,
      kind: 'destination' as const,
      arrive: p.coord,
      depart: p.coord,
    }));
    const naiveCost = tourCost(HOME, naiveNodes);
    const optimized = optimizeRoute(HOME, places);
    expect(optimized.estimatedMeters).toBeLessThanOrEqual(naiveCost + 1e-6);
  });
});

describe('optimizeRoute — road direction', () => {
  it('keeps the default orientation for a symmetric single-road loop', () => {
    // Home → road → home is symmetric: both orientations cost the same, so the
    // default entry→exit is retained.
    const r = road('road1', { lng: 122.0, lat: 32.0 }, { lng: 121.0, lat: 31.5 });
    const res = optimizeRoute(HOME, [r]);
    const stop = res.order.find((s) => s.placeId === 'road1');
    expect(stop).toBeDefined();
    expect(stop!.enterAtEntry).toBe(true);
  });

  it('chooses the orientation that does not worsen the tour', () => {
    // With a neighboring destination, the two road orientations differ. Verify
    // the optimizer's choice is no worse than the flipped orientation.
    const a = dest('a', 120.0, 31.0);
    const r = road('r', { lng: 120.1, lat: 31.05 }, { lng: 121.5, lat: 31.9 });
    const res = optimizeRoute(HOME, [a, r]);
    const stop = res.order.find((s) => s.placeId === 'r')!;

    // Reconstruct chosen vs flipped tours and compare their costs.
    const nodesFor = (enterAtEntry: boolean) =>
      res.order.map((s) => {
        if (s.placeId === 'a') {
          return { placeId: 'a', kind: 'destination' as const, arrive: a.coord, depart: a.coord };
        }
        return enterAtEntry
          ? { placeId: 'r', kind: 'road' as const, arrive: r.entry, depart: r.exit }
          : { placeId: 'r', kind: 'road' as const, arrive: r.exit, depart: r.entry };
      });
    const chosenCost = tourCost(HOME, nodesFor(stop.enterAtEntry !== false));
    const flippedCost = tourCost(HOME, nodesFor(stop.enterAtEntry === false));
    expect(chosenCost).toBeLessThanOrEqual(flippedCost + 1e-6);
  });

  it('stopEndpoints reflects the chosen orientation', () => {
    const r = road('r', { lng: 118.6, lat: 30.4 }, { lng: 118.9, lat: 30.6 });
    const entryFirst = stopEndpoints({ placeId: 'r', enterAtEntry: true }, r);
    expect(entryFirst.arrive).toEqual(r.entry);
    expect(entryFirst.depart).toEqual(r.exit);
    const exitFirst = stopEndpoints({ placeId: 'r', enterAtEntry: false }, r);
    expect(exitFirst.arrive).toEqual(r.exit);
    expect(exitFirst.depart).toEqual(r.entry);
  });
});

describe('optimizeRoute — mixed destinations and roads', () => {
  it('handles a selection of destinations and a road together', () => {
    const places: CatalogEntity[] = [
      dest('a', 121.0, 31.5),
      road('r', { lng: 120.3, lat: 31.2 }, { lng: 120.4, lat: 31.25 }),
      dest('b', 121.3, 31.9),
    ];
    const res = optimizeRoute(HOME, places);
    expect(res.order).toHaveLength(3);
    expect(new Set(res.order.map((s) => s.placeId))).toEqual(new Set(['a', 'r', 'b']));
  });
});

describe('optimizeRoute — injected cost function', () => {
  it('orders by the injected cost (drive time), overriding great-circle distance', () => {
    // Geographically, x sits between HOME and y. By straight-line distance the
    // natural order is HOME → x → y → HOME. But if x is (say) across a river with
    // a slow connection, a drive-*time* cost can prefer visiting y first.
    const x = dest('x', 120.8, 31.35);
    const y = dest('y', 121.4, 31.9);

    // Custom cost: make any leg touching x expensive except straight from y.
    const cost = (a: BD09, b: BD09): number => {
      const near = (p: BD09, q: BD09) => Math.abs(p.lng - q.lng) < 1e-6 && Math.abs(p.lat - q.lat) < 1e-6;
      // Cheap: HOME→y and y→x; expensive: HOME→x.
      if (near(a, HOME) && near(b, x.coord)) return 1000;
      return Math.abs(a.lng - b.lng) + Math.abs(a.lat - b.lat);
    };

    const byDistance = optimizeRoute(HOME, [x, y]).order.map((s) => s.placeId);
    const byCost = optimizeRoute(HOME, [x, y], cost).order.map((s) => s.placeId);

    // The injected cost pushes y ahead of x, unlike the distance-based ordering.
    expect(byCost.indexOf('y')).toBeLessThan(byCost.indexOf('x'));
    expect(byCost).not.toEqual(byDistance);
  });
});
