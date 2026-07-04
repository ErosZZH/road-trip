import express, { type Request, type Response } from 'express';
import type { CatalogData } from '../src/types';
import { parseCatalog, type ParseResult } from '../src/store/catalogSchema';
import {
  clearAll,
  deleteEntity,
  ensureDataDirs,
  mergeInto,
  readAll,
  writeAll,
  writeEntity,
  type Collection,
} from './store.js';

const PORT = Number(process.env.PORT ?? 5174);

/**
 * Validate a single entity by wrapping it in a minimal catalog and running the
 * shared parser. `collection` selects which array to place it in so the right
 * validator (parsePlace / parseRoute / parseTrip) runs. Returns the normalized
 * entity or an error message.
 */
function validateEntity(
  collection: Collection,
  body: unknown,
): { ok: true; entity: { id: string } } | { ok: false; error: string } {
  const wrapper: Record<string, unknown> = {
    version: 1,
    coordSystem: 'BD09',
    places: collection === 'places' ? [body] : [],
    routes: collection === 'routes' ? [body] : [],
    trips: collection === 'trips' ? [body] : [],
  };
  const result: ParseResult = parseCatalog(wrapper);
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? '数据无效。' };
  }
  const entity = result.data[collection][0];
  if (!entity) return { ok: false, error: '数据无效。' };
  return { ok: true, entity };
}

/** Build CRUD routes for a collection onto the given router. */
function mountCollection(app: express.Express, collection: Collection): void {
  const base = `/api/${collection}`;

  const upsert = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Record<string, unknown>;
    // For PUT, the id in the URL is authoritative.
    if (req.params.id) body.id = req.params.id;
    const validated = validateEntity(collection, body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    try {
      await writeEntity(collection, validated.entity);
      res.status(req.method === 'POST' ? 201 : 200).json(validated.entity);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  app.post(base, upsert);
  app.put(`${base}/:id`, upsert);
  app.delete(`${base}/:id`, async (req: Request, res: Response) => {
    try {
      await deleteEntity(collection, req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Load the entire catalog (startup fetch).
  app.get('/api/catalog', async (_req: Request, res: Response) => {
    try {
      res.json(await readAll());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Aggregate all files into one JSON document for download.
  app.get('/api/export', async (_req: Request, res: Response) => {
    try {
      res.json(await readAll());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Replace or merge the whole data folder from a JSON document.
  app.post('/api/import', async (req: Request, res: Response) => {
    const mode = req.query.mode === 'merge' ? 'merge' : 'replace';
    const result = parseCatalog(req.body);
    if (!result.ok || !result.data) {
      res.status(400).json({ error: result.error ?? '导入数据无效。' });
      return;
    }
    try {
      const data: CatalogData =
        mode === 'merge' ? await mergeInto(result.data) : await replaceWith(result.data);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  for (const collection of ['places', 'routes', 'trips'] as const) {
    mountCollection(app, collection);
  }

  return app;
}

/** Replace the entire on-disk catalog with the given data. */
async function replaceWith(data: CatalogData): Promise<CatalogData> {
  await clearAll();
  await writeAll(data);
  return readAll();
}

async function start(): Promise<void> {
  await ensureDataDirs();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[road-trip] data server listening on http://localhost:${PORT}`);
  });
}

// Only start when run directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  void start();
}
