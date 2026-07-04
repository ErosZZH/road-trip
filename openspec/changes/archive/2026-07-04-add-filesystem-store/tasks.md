# Implementation Tasks

## 1. Backend server & data folder

- [x] 1.1 Add `data/` folder with `places/`, `routes/`, `trips/` subfolders and a `.gitkeep` in each; add `data/` to `.gitignore` (keep the subfolder structure).
- [x] 1.2 Add `express` and `concurrently` (and `@types/express`) to `package.json` dependencies/devDependencies.
- [x] 1.3 Create `server/store.ts`: read/write/delete one JSON file per entity under `data/{places,routes,trips}`, with atomic writes (temp file + rename) and a `readAll()` that aggregates the whole catalog.
- [x] 1.4 Create `server/index.ts` (Express app): `GET /api/catalog`, CRUD for `/api/places[/:id]`, `/api/routes[/:id]`, `/api/trips[/:id]`, plus `GET /api/export` and `POST /api/import` (replace/merge). Validate each payload with the shared schema before writing; return the persisted entity or a non-2xx error with a message.
- [x] 1.5 Wire dev/prod scripts: `npm run dev` runs Vite + server via `concurrently`; add `server`/`start` scripts; add `server.proxy` for `/api` in `vite.config.ts`.

## 2. Domain model: split Place vs Route

- [x] 2.1 In `src/types/index.ts`, make `Place` destination-only (`{ ...base, coord }`), add a first-class `Route` type (`{ ...base, entry, exit, waypoints?, path: BD09[] }`), and add `routeIds` to `Trip`.
- [x] 2.2 Update `CatalogData` to `{ version, coordSystem, places, routes, trips }`.
- [x] 2.3 Update `src/store/catalogSchema.ts`: add `parseRoute` (validates endpoints + `path` geometry), split places/routes parsing, `emptyCatalog`, `serializeCatalog`, and `mergeCatalogs` to handle the routes collection. Migrate the old `kind: 'road'` shape → `Route`.
- [x] 2.4 Update `src/store/catalogSchema.test.ts` for the new place/route/trip shapes and route-geometry validation.

## 3. Frontend persistence via REST (remove browser storage)

- [x] 3.1 Rewrite `src/store/DataStore.ts` as an API client (`fetch` to `/api/*`); delete IndexedDB + localStorage backends and the `loadInitial`/bundled-seed path. Remove `src/store/seed.ts` usage.
- [x] 3.2 Update `src/store/appStore.ts`: `init()` does `GET /api/catalog`; add `routes` state; each mutation (place/route/trip create/update/delete, `replaceAll`, `mergeIn`) calls the matching endpoint and updates Zustand state on success. Add route CRUD actions and selectors (`selectAllTags`, `selectFilteredPlaces` → places ∪ routes).
- [x] 3.3 Delete `data/places.seed.json` and any remaining seed references; confirm no code imports browser storage.

## 4. Planner, map & filters updated for routes

- [x] 4.1 Update `src/domain/optimizer.ts` (and `optimizer.test.ts`) to accept places ∪ routes; routes traversed entry→exit (or reversed) using stored endpoints.
- [x] 4.2 Update `src/store/planTrip.ts` to build the selection from both `placeIds` and `routeIds`, and render route legs from each route's stored `path` where available.
- [x] 4.3 Update map rendering (`MapArea`/`useMap`) to draw places as markers and routes as polylines following stored `path`/waypoints; update filters to include routes.

## 5. Search-first add with auto-name + persisted geometry

- [x] 5.1 Switch `BaiduMapProvider.geocode` from single-result `Geocoder` to `LocalSearch`, returning all candidates as `GeocodeCandidate[]` (title + address context), region-biased to the operating area.
- [x] 5.2 Update `LocationField`: keep "list all candidates → pick one", remove manual-coordinate entry as the primary path, and surface the selected candidate's name to the parent.
- [x] 5.3 Update `PlaceForm`: auto-fill the entity name from the selected candidate (place or route endpoints); add a route branch that, once entry + exit are chosen, calls `drivingRoute` to compute `path` and persists it with the route.
- [x] 5.4 Ensure editing a place's coordinate or a route's endpoint re-searches and, for routes, recomputes and stores `path`.

## 6. Data migration, tests & docs

- [x] 6.1 One-time migration: convert the former `places.seed.json` (destinations + `road` entries) into per-entity files under `data/places` / `data/routes`, or provide an exported JSON to load via `POST /api/import`.
- [x] 6.2 Update `src/store/integration.test.ts` to exercise the REST-backed store (mock `fetch`/server) and the place/route split; ensure no test depends on IndexedDB/localStorage.
- [x] 6.3 Update `README.md`: prerequisites (Node backend + `npm run dev` runs two processes), the `data/{places,routes,trips}` workflow, search-first add flow, and project structure; remove browser-storage notes.
- [x] 6.4 Run `npm run lint`, `npm test`, and `npm run build`; verify add place, add route (geometry written to `data/routes/`), plan a loop, save/reopen a trip, and export/import all work end-to-end.
