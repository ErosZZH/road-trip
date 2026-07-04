import type { BD09 } from '../types';

/**
 * Coordinate-system conversions between WGS84 (GPS), GCJ-02 (China "Mars"),
 * and BD09 (Baidu). The app stores BD09 internally; these helpers exist so
 * data imported from other providers (Amap/GPS) can be normalized.
 *
 * Algorithms are the widely-used public implementations (eviltransform).
 */

const X_PI = (Math.PI * 3000.0) / 180.0;
const PI = Math.PI;
// Krasovsky 1940 ellipsoid parameters used by the GCJ-02 offset algorithm.
const A = 6378245.0;
const EE = 0.006693421622965943;

function outOfChina(lng: number, lat: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function transformLat(lng: number, lat: number): number {
  let ret =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret =
    300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/** WGS84 (GPS) → GCJ-02 (China encrypted). */
export function wgs84ToGcj02({ lng, lat }: BD09): BD09 {
  if (outOfChina(lng, lat)) return { lng, lat };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lng: lng + dLng, lat: lat + dLat };
}

/** GCJ-02 → WGS84 (approximate inverse). */
export function gcj02ToWgs84({ lng, lat }: BD09): BD09 {
  if (outOfChina(lng, lat)) return { lng, lat };
  const gcj = wgs84ToGcj02({ lng, lat });
  return { lng: lng * 2 - gcj.lng, lat: lat * 2 - gcj.lat };
}

/** GCJ-02 → BD09 (Baidu). */
export function gcj02ToBd09({ lng, lat }: BD09): BD09 {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 };
}

/** BD09 (Baidu) → GCJ-02. */
export function bd09ToGcj02({ lng, lat }: BD09): BD09 {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return { lng: z * Math.cos(theta), lat: z * Math.sin(theta) };
}

/** WGS84 (GPS) → BD09 (Baidu). */
export function wgs84ToBd09(coord: BD09): BD09 {
  return gcj02ToBd09(wgs84ToGcj02(coord));
}

/** BD09 (Baidu) → WGS84 (GPS). */
export function bd09ToWgs84(coord: BD09): BD09 {
  return gcj02ToWgs84(bd09ToGcj02(coord));
}

/** Great-circle distance in meters between two coordinates (haversine). */
export function haversineMeters(a: BD09, b: BD09): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number): number => (d * PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
