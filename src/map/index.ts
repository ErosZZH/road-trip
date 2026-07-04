import { BAIDU_AK } from '../config/home';
import { BaiduMapProvider } from './BaiduMapProvider';
import type { MapProvider } from './MapProvider';

let instance: MapProvider | null = null;

/** Get the shared map provider (Baidu in v1). */
export function getMapProvider(): MapProvider {
  if (!instance) {
    instance = new BaiduMapProvider(BAIDU_AK);
  }
  return instance;
}

export type { MapProvider } from './MapProvider';
