/**
 * One-time migration: convert the legacy bundled seed catalog (destinations +
 * `road` entries mixed in a single `places` array) into per-entity JSON files
 * under data/{places,routes,trips}. Safe to re-run — it writes by id.
 *
 * Usage:  npx tsx scripts/migrate-seed.ts [path/to/legacy.json]
 *
 * The legacy seed lived at data/places.seed.json before this change; pass an
 * exported catalog here to seed a fresh data folder, or omit to use the inline
 * default below.
 */
import { readFile } from 'node:fs/promises';
import { parseCatalog } from '../src/store/catalogSchema';
import { ensureDataDirs, writeAll, DATA_DIR } from '../server/store.js';

/** The pre-split皖南/浙北 starter catalog (formerly data/places.seed.json). */
const DEFAULT_SEED = {
  version: 1,
  coordSystem: 'BD09',
  places: [
    {
      id: 'seed-hongcun',
      kind: 'destination',
      name: '宏村',
      tags: ['水乡', '世界遗产', '摄影'],
      status: 'visited',
      rating: 5,
      notes: '皖南古村落，水墨画般的南湖与月沼。',
      coord: { lng: 117.98894, lat: 29.91103 },
    },
    {
      id: 'seed-xidi',
      kind: 'destination',
      name: '西递',
      tags: ['水乡', '世界遗产'],
      status: 'visited',
      rating: 4,
      coord: { lng: 117.98671, lat: 29.88012 },
    },
    {
      id: 'seed-huangshan',
      kind: 'destination',
      name: '黄山风景区',
      tags: ['山岳', '徒步', '日出'],
      status: 'wishlist',
      coord: { lng: 118.16786, lat: 30.13214 },
    },
    {
      id: 'seed-mukeng',
      kind: 'destination',
      name: '木坑竹海',
      tags: ['竹海', '摄影'],
      status: 'wishlist',
      coord: { lng: 118.03571, lat: 29.95012 },
    },
    {
      id: 'seed-qingliangfeng',
      kind: 'destination',
      name: '清凉峰漂流',
      tags: ['漂流', '避暑'],
      status: 'wishlist',
      coord: { lng: 118.88234, lat: 30.11876 },
    },
    {
      id: 'seed-daixi',
      kind: 'destination',
      name: '安吉大溪漂流',
      tags: ['漂流', '避暑'],
      status: 'visited',
      rating: 4,
      coord: { lng: 119.55012, lat: 30.71234 },
    },
    {
      id: 'seed-mogan',
      kind: 'destination',
      name: '莫干山',
      tags: ['山岳', '度假', '竹海'],
      status: 'wishlist',
      coord: { lng: 119.87345, lat: 30.60789 },
    },
    {
      id: 'seed-chuanzangxian',
      kind: 'road',
      name: '皖南川藏线',
      tags: ['风景道', '山岳'],
      status: 'wishlist',
      notes:
        '华东最美自驾路线之一，桃岭盘山公路，宁国东入口经青龙湾、方塘、板桥、六道湾、月亮湾至泾县西入口。',
      entry: { lng: 118.9602, lat: 30.6382 },
      exit: { lng: 118.4634, lat: 30.6662 },
      waypoints: [
        { lng: 118.8671, lat: 30.5775 },
        { lng: 118.7361, lat: 30.5808 },
        { lng: 118.6541, lat: 30.5325 },
        { lng: 118.5753, lat: 30.5334 },
        { lng: 118.5935, lat: 30.6771 },
      ],
    },
  ],
  trips: [],
};

async function main(): Promise<void> {
  const arg = process.argv[2];
  let raw: unknown = DEFAULT_SEED;
  if (arg) {
    raw = JSON.parse(await readFile(arg, 'utf8'));
  }

  const parsed = parseCatalog(raw);
  if (!parsed.ok || !parsed.data) {
    console.error(`Seed is invalid: ${parsed.error}`);
    process.exit(1);
    return;
  }

  await ensureDataDirs();
  await writeAll(parsed.data);
  const { places, routes, trips } = parsed.data;
  console.log(
    `Migrated ${places.length} places, ${routes.length} routes, ${trips.length} trips into ${DATA_DIR}`,
  );
}

void main();
