import type { BD09 } from '../types';

/**
 * Home base for every trip: 苏州市工业园区荣域花园.
 * Coordinates are in Baidu's BD09 system (see design.md decision #3).
 * Approximate BD09 location of Suzhou Industrial Park; refine via geocoding if needed.
 */
export const HOME: { name: string; coord: BD09 } = {
  name: '苏州市工业园区荣域花园',
  coord: { lng: 120.7345, lat: 31.3178 },
};

/**
 * Baidu Maps JavaScript API key (AK), injected at build time from `.env.local`.
 * Empty string when unset — the UI shows an "AK required" notice in that case.
 */
export const BAIDU_AK: string = (import.meta.env.VITE_BAIDU_AK ?? '').trim();

export function hasBaiduAk(): boolean {
  return BAIDU_AK.length > 0;
}
