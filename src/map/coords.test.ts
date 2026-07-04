import { describe, it, expect } from 'vitest';
import {
  wgs84ToBd09,
  bd09ToWgs84,
  gcj02ToBd09,
  bd09ToGcj02,
  haversineMeters,
} from './coords';

describe('coordinate conversions', () => {
  it('round-trips WGS84 → BD09 → WGS84 within tolerance', () => {
    const gps = { lng: 116.404, lat: 39.915 }; // Beijing
    const back = bd09ToWgs84(wgs84ToBd09(gps));
    expect(back.lng).toBeCloseTo(gps.lng, 4);
    expect(back.lat).toBeCloseTo(gps.lat, 4);
  });

  it('round-trips GCJ02 → BD09 → GCJ02 within tolerance', () => {
    const gcj = { lng: 120.62, lat: 31.32 }; // Suzhou-ish
    const back = bd09ToGcj02(gcj02ToBd09(gcj));
    expect(back.lng).toBeCloseTo(gcj.lng, 5);
    expect(back.lat).toBeCloseTo(gcj.lat, 5);
  });

  it('applies a nonzero BD09 offset (systems actually differ)', () => {
    const gcj = { lng: 120.62, lat: 31.32 };
    const bd = gcj02ToBd09(gcj);
    expect(Math.abs(bd.lng - gcj.lng)).toBeGreaterThan(0.001);
  });
});

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lng: 120, lat: 31 }, { lng: 120, lat: 31 })).toBe(0);
  });

  it('approximates ~111km per degree of latitude', () => {
    const d = haversineMeters({ lng: 120, lat: 31 }, { lng: 120, lat: 32 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('is symmetric', () => {
    const a = { lng: 118.9, lat: 29.9 };
    const b = { lng: 120.7, lat: 31.3 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});
