## Context

The road-trip planner is currently a pure browser SPA (Vite + React + Zustand). All
state persists through `src/store/DataStore.ts`, which writes to IndexedDB with a
localStorage fallback, seeded on first run from a bundled `data/places.seed.json`. The
domain model treats destinations and scenic roads as one `Place` union (`kind:
'destination' | 'road'`), and all Baidu calls (geocoding via `Geocoder`, driving routes
via `DrivingRoute`) already run in the browser through `BaiduMapProvider`.

The user wants the catalog — above all the heavy scenic-route geometry — to live in real
files on the local filesystem, never in the browser, without introducing SQLite. Data
must be organized into three folders: `places/` (destinations), `routes/` (scenic roads
with their geometry), and `trips/` (home-anchored loops of selected places + routes).
Adding an entity must be search-first: search a name, list **all** Baidu candidates, pick
one, and derive the name and geometry from the pick rather than hand-entering coordinates.

Constraints:

- A browser cannot write to disk, so persistence requires a backend process. Decided:
  a standalone Node server (not a Vite-only middleware) so it also works outside `vite`.
- No SQLite; flat JSON files only.
- All Baidu API calls stay in the frontend (existing browser AK, no server-side key).

## Goals / Non-Goals

**Goals:**

- Persist all places, routes, and trips as JSON files under a dedicated `data/` folder,
  owned by a Node/Express backend; the browser holds no source-of-truth state.
- Split the model into distinct `Place` (destination point) and `Route` (scenic road with
  entry/exit + waypoints + driving-path geometry) entities, one file per entity under
  `data/places/`, `data/routes/`, `data/trips/`.
- Make add/edit search-first: multi-candidate `LocalSearch`, user picks one, name +
  geometry auto-derived.
- Compute route/loop geometry in the browser, then persist it to disk so it is durable and
  not browser-bound.
- Keep whole-catalog JSON export/import working against the on-disk folder.

**Non-Goals:**

- No SQLite or any embedded database.
- No server-side Baidu calls or server-side AK; geocoding and routing stay in the browser.
- No auth, multi-user, or remote/hosted deployment — this is a local single-user tool.
- No change to the optimizer heuristic (nearest-neighbor + 2-opt) or trip-planning math.
- No multi-day scheduling (still out of scope, as in v1).

## Decisions

### Decision 1 — Standalone Node/Express backend owns `data/`

A small Express server (`server/`) exposes a REST API and reads/writes JSON files under
`data/`. In dev it runs alongside Vite via `concurrently`, with Vite proxying `/api` to
it; `npm run dev` starts both. Rationale: a standalone process (chosen over a Vite
middleware plugin) keeps persistence available in `preview`/production and decouples the
data layer from the dev server lifecycle.

- *Alternative considered*: Vite `configureServer` middleware — simpler to launch but the
  API only exists while Vite runs and disappears in a static build. Rejected.

### Decision 2 — Filesystem layout: one JSON file per entity, three folders

```
data/
  places/<placeId>.json    destination: { id, name, tags, status, rating?, notes?, coord }
  routes/<routeId>.json     scenic road: { id, name, tags, status, rating?, notes?,
                                           entry, exit, waypoints?, path }  # path = geometry
  trips/<tripId>.json       loop: { id, name, placeIds, routeIds, constraints,
                                    order?, metrics?, needsReview? }
```

Rationale: matches the user's requested `places`/`routes`/`trips` split; per-entity files
give clean git diffs and let route geometry live *with* its route. Files are named by id.
The backend never stores geometry twice — trips reference place/route ids only.

- *Alternative considered*: single `catalog.json` + a geometry dir. Rejected — the user
  explicitly asked for three entity folders.

### Decision 3 — REST persistence contract

The backend exposes CRUD per collection plus catalog-level export/import:

| Method & path                | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `GET /api/catalog`           | Load all places, routes, trips (startup fetch)     |
| `POST /api/places`           | Create a place (server assigns/accepts id)         |
| `PUT /api/places/:id`        | Update a place                                     |
| `DELETE /api/places/:id`     | Delete a place                                     |
| `POST/PUT/DELETE /api/routes[/:id]` | Same for routes (body includes geometry)    |
| `POST/PUT/DELETE /api/trips[/:id]`  | Same for trips                              |
| `POST /api/import`           | Replace or merge the whole folder from a JSON doc  |
| `GET /api/export`            | Aggregate all files into one JSON doc for download |

The server validates each payload with the shared schema before writing, writes
atomically (temp file + rename), and returns the persisted entity. Errors return non-2xx
with a message; the frontend surfaces it and leaves UI state consistent.

### Decision 4 — Frontend `DataStore` becomes an API client; browser storage removed

`src/store/DataStore.ts` is rewritten to call the REST API via `fetch` (no IndexedDB/
localStorage). `appStore` init does `GET /api/catalog`; each mutation (`addPlace`,
`updatePlace`, `removePlace`, route/trip equivalents, `replaceAll`, `mergeIn`) calls the
matching endpoint and updates in-memory Zustand state on success. The bundled-seed path
(`seed.ts`, `loadInitial`) is removed; seeding is done by dropping files into `data/` or
importing. Rationale: satisfies "never store in browser" with the smallest surface change
to the store's public shape.

### Decision 5 — `Route` becomes a first-class type; `Place` is destination-only

Replace the `Place = DestinationPlace | RoadPlace` union with two types: `Place`
(destination, `{ coord }`) and `Route` (`{ entry, exit, waypoints?, path }`). `path` (the
persisted driving-path geometry, BD09 points) is added so a route renders and plans from
stored geometry without recomputation. `Trip` gains `routeIds` alongside `placeIds`.
`CatalogData` becomes `{ version, coordSystem, places, routes, trips }`. The optimizer,
`planTrip`, map rendering, and filters are updated to iterate places ∪ routes.

- *Alternative considered*: keep the union, just re-home storage. Rejected — the user's
  folder split and terminology ("places" vs "routes") make them distinct entities, and a
  first-class `Route.path` is where persisted geometry naturally belongs.

### Decision 6 — Search-first add via `LocalSearch`, name + geometry auto-derived

`BaiduMapProvider.geocode` switches from single-result `Geocoder.getPoint` to
`LocalSearch`, returning all POIs as `GeocodeCandidate[]` (label = POI title, plus address
context). `useGeocoder` already returns a candidate list; `LocationField` keeps the
"list candidates → pick one" UI but **removes manual coordinate entry** as the primary
path. On selecting a candidate the form auto-fills the entity name from the candidate's
title (requirement #4). For a route, after both endpoints are chosen the browser calls
`drivingRoute(entry, exit)` to obtain `path`, which is persisted with the route
(requirement #1's "geometry to file"). Rationale: uses the existing browser AK, keeps all
Baidu calls client-side (per the user), and directly yields multiple candidates + names.

## Risks / Trade-offs

- **[Two processes to run in dev]** → `concurrently` + a documented `npm run dev` that
  launches Vite and the server together; Vite `server.proxy` forwards `/api`. README
  updated.
- **[Losing existing browser data on cutover]** → One-time export from the old build (or a
  manual convert of `places.seed.json`) into the new `data/` folder via `POST /api/import`;
  document in the migration plan. No automatic IndexedDB→disk migration is built.
- **[`LocalSearch` needs a region/bounds and can rank POIs differently than `Geocoder`]** →
  Bias searches around HOME / the app's operating area (south Anhui, north Zhejiang) and
  always let the user pick among all candidates rather than auto-selecting the first.
- **[Concurrent writes / partial file corruption]** → Atomic write (temp file + `rename`),
  and validate payloads server-side before writing; a rejected write leaves the prior file
  intact.
- **[`data/` committed accidentally with private trips]** → git-ignore `data/` by default;
  export produces a single JSON the user can choose to commit.
- **[Route geometry can go stale if endpoints change]** → On endpoint edit, recompute and
  overwrite `path` before persisting (covered by the place-catalog spec scenario).

## Migration Plan

1. Add `server/` (Express), `data/` folder + `.gitignore` entry, and `concurrently` +
   proxy wiring; add `npm run dev`/`start` scripts.
2. Introduce `Route` type and split `CatalogData`; update schema/validation, optimizer,
   `planTrip`, map rendering, filters.
3. Rewrite `DataStore` as the REST client; delete IndexedDB/localStorage + seed path.
4. Switch geocoding to `LocalSearch`; update `LocationField`/`PlaceForm` for auto-name and
   remove manual-coord primary entry; compute + persist route `path`.
5. One-time data migration: convert `data/places.seed.json` into per-entity files under
   `data/places` / `data/routes` (roads → routes), or import an exported JSON via
   `POST /api/import`.
6. Update tests (schema, integration) and README.
7. **Rollback**: the change is additive on disk; reverting the frontend to the previous
   commit restores browser storage. The `data/` folder can be kept or discarded.

## Open Questions

- Should `data/` be git-ignored by default (treat exports as the commit unit), or tracked
  so per-entity files are versioned directly? Leaning git-ignored with export-to-commit.
- Region biasing for `LocalSearch`: fixed to the app's operating area, or centered on the
  current map viewport? Leaning operating-area default with viewport as a later refinement.
