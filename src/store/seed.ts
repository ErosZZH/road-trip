import type { CatalogData } from '../types';
import { emptyCatalog, parseCatalog } from './catalogSchema';
import seedJson from '../../data/places.seed.json';

/**
 * The bundled seed catalog, version-controlled in `data/places.seed.json`.
 * Used to initialize the app when browser storage is empty.
 */
export function seedFromBundled(): CatalogData {
  const result = parseCatalog(seedJson);
  if (result.ok && result.data) return result.data;
  // A malformed committed seed should not crash the app.
  console.error('Bundled seed is invalid:', result.error);
  return emptyCatalog();
}
