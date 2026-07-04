import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogData, Place, Route, Trip } from '../src/types';
import { emptyCatalog, mergeCatalogs } from '../src/store/catalogSchema';

/**
 * Filesystem-backed persistence for the catalog. Each place, route, and trip is
 * one JSON file under data/{places,routes,trips}/<id>.json — the single source
 * of truth (design.md decisions #1/#2). No browser storage, no database.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(HERE, '..', 'data');

const COLLECTIONS = {
  places: path.join(DATA_DIR, 'places'),
  routes: path.join(DATA_DIR, 'routes'),
  trips: path.join(DATA_DIR, 'trips'),
} as const;

export type Collection = keyof typeof COLLECTIONS;

/** Ensure all three collection folders exist (idempotent). */
export async function ensureDataDirs(): Promise<void> {
  await Promise.all(Object.values(COLLECTIONS).map((dir) => fs.mkdir(dir, { recursive: true })));
}

/** Reject ids that could escape the collection folder via path traversal. */
function safeFileName(id: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error(`Invalid id: ${id}`);
  }
  return `${id}.json`;
}

function fileFor(collection: Collection, id: string): string {
  return path.join(COLLECTIONS[collection], safeFileName(id));
}

/** Atomic write: write to a temp file then rename over the target. */
async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

/** Read and JSON-parse every *.json file in a collection folder. */
async function readCollection<T>(collection: Collection): Promise<T[]> {
  const dir = COLLECTIONS[collection];
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const name of names) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue;
    try {
      const raw = await fs.readFile(path.join(dir, name), 'utf8');
      out.push(JSON.parse(raw) as T);
    } catch {
      // Skip unreadable/corrupt files rather than failing the whole load.
    }
  }
  return out;
}

/** Persist one entity to its collection file. */
export async function writeEntity(
  collection: Collection,
  entity: { id: string },
): Promise<void> {
  await writeJsonAtomic(fileFor(collection, entity.id), entity);
}

/** Delete one entity's file. Missing files are treated as already-deleted. */
export async function deleteEntity(collection: Collection, id: string): Promise<void> {
  try {
    await fs.unlink(fileFor(collection, id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/** Load the whole catalog by aggregating all three collections. */
export async function readAll(): Promise<CatalogData> {
  const [places, routes, trips] = await Promise.all([
    readCollection<Place>('places'),
    readCollection<Route>('routes'),
    readCollection<Trip>('trips'),
  ]);
  return { ...emptyCatalog(), places, routes, trips };
}

/** Remove every entity file from all three collections (used by import-replace). */
export async function clearAll(): Promise<void> {
  await Promise.all(
    (Object.keys(COLLECTIONS) as Collection[]).map(async (collection) => {
      const dir = COLLECTIONS[collection];
      let names: string[];
      try {
        names = await fs.readdir(dir);
      } catch {
        return;
      }
      await Promise.all(
        names
          .filter((n) => n.endsWith('.json') && !n.startsWith('.'))
          .map((n) => fs.unlink(path.join(dir, n)).catch(() => undefined)),
      );
    }),
  );
}

/** Write an entire catalog to disk (one file per entity). */
export async function writeAll(data: CatalogData): Promise<void> {
  await ensureDataDirs();
  await Promise.all([
    ...data.places.map((p) => writeEntity('places', p)),
    ...data.routes.map((r) => writeEntity('routes', r)),
    ...data.trips.map((t) => writeEntity('trips', t)),
  ]);
}

/** Merge incoming data into what's on disk (incoming wins on id clash) and persist. */
export async function mergeInto(incoming: CatalogData): Promise<CatalogData> {
  const current = await readAll();
  const merged = mergeCatalogs(current, incoming);
  await writeAll(merged);
  return merged;
}

export { DATA_DIR };
