import { describe, it, expect } from 'vitest';
import {
  validatePlace,
  isValidRating,
  isValidCoord,
  normalizeRating,
  constraintSatisfied,
  unsatisfiedConstraints,
} from './validation';
import type { Place, TagConstraint } from '../types';

describe('isValidRating', () => {
  it('accepts integers 1..5', () => {
    for (const r of [1, 2, 3, 4, 5]) expect(isValidRating(r)).toBe(true);
  });
  it('rejects out-of-range and non-integers', () => {
    for (const r of [0, 6, -1, 3.5, '4', null, undefined]) expect(isValidRating(r)).toBe(false);
  });
});

describe('isValidCoord', () => {
  it('accepts a well-formed BD09 coord', () => {
    expect(isValidCoord({ lng: 120.7, lat: 31.3 })).toBe(true);
  });
  it('rejects malformed coords', () => {
    expect(isValidCoord(null)).toBe(false);
    expect(isValidCoord({ lng: 120 })).toBe(false);
    expect(isValidCoord({ lng: 999, lat: 31 })).toBe(false);
    expect(isValidCoord({ lng: NaN, lat: 31 })).toBe(false);
  });
});

describe('validatePlace', () => {
  const destination: Partial<Place> = {
    kind: 'destination',
    name: '宏村',
    status: 'wishlist',
    tags: ['water-town'],
    coord: { lng: 117.9, lat: 29.9 },
  };

  it('accepts a valid destination', () => {
    expect(validatePlace(destination).valid).toBe(true);
  });

  it('requires a name', () => {
    const res = validatePlace({ ...destination, name: '  ' });
    expect(res.valid).toBe(false);
    expect(res.errors.join()).toMatch(/名称/);
  });

  it('rejects a rating on a wishlist place', () => {
    const res = validatePlace({ ...destination, status: 'wishlist', rating: 4 });
    expect(res.valid).toBe(false);
    expect(res.errors.join()).toMatch(/去过/);
  });

  it('accepts a rating on a visited place', () => {
    const res = validatePlace({ ...destination, status: 'visited', rating: 5 });
    expect(res.valid).toBe(true);
  });

  it('rejects an out-of-range rating on a visited place', () => {
    const res = validatePlace({ ...destination, status: 'visited', rating: 9 as never });
    expect(res.valid).toBe(false);
  });

  it('requires a coord for a destination', () => {
    const res = validatePlace({ ...destination, coord: undefined });
    expect(res.valid).toBe(false);
  });

  it('requires both endpoints for a road', () => {
    const res = validatePlace({
      kind: 'road',
      name: '皖南川藏线',
      status: 'wishlist',
      tags: ['scenic-drive'],
      entry: { lng: 118.5, lat: 30.4 },
      // exit missing
    });
    expect(res.valid).toBe(false);
    expect(res.errors.join()).toMatch(/终点/);
  });

  it('accepts a valid road', () => {
    const res = validatePlace({
      kind: 'road',
      name: '皖南川藏线',
      status: 'visited',
      rating: 5,
      tags: ['scenic-drive'],
      entry: { lng: 118.5, lat: 30.4 },
      exit: { lng: 118.9, lat: 30.6 },
    });
    expect(res.valid).toBe(true);
  });
});

describe('normalizeRating', () => {
  it('drops rating when not visited', () => {
    expect(normalizeRating('wishlist', 4)).toBeUndefined();
  });
  it('keeps a valid rating when visited', () => {
    expect(normalizeRating('visited', 3)).toBe(3);
  });
  it('falls back on an invalid rating', () => {
    expect(normalizeRating('visited', 9, 2)).toBe(2);
  });
});

describe('tag constraints', () => {
  const places: Place[] = [
    {
      id: 'a',
      kind: 'destination',
      name: 'A',
      status: 'wishlist',
      tags: ['drifting'],
      coord: { lng: 1, lat: 1 },
    },
    {
      id: 'b',
      kind: 'destination',
      name: 'B',
      status: 'wishlist',
      tags: ['mountain'],
      coord: { lng: 2, lat: 2 },
    },
  ];

  it('satisfies a constraint when a matching tag is present', () => {
    const c: TagConstraint = { type: 'includesTag', tag: 'drifting', min: 1 };
    expect(constraintSatisfied(places, c)).toBe(true);
  });

  it('fails a constraint when no matching tag is present', () => {
    const c: TagConstraint = { type: 'includesTag', tag: 'scenic-drive', min: 1 };
    expect(constraintSatisfied(places, c)).toBe(false);
    expect(unsatisfiedConstraints(places, [c])).toHaveLength(1);
  });

  it('respects a min greater than 1', () => {
    const c: TagConstraint = { type: 'includesTag', tag: 'drifting', min: 2 };
    expect(constraintSatisfied(places, c)).toBe(false);
  });
});
