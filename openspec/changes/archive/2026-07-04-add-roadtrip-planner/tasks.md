## 1. Project scaffold & tooling

- [x] 1.1 Scaffold a Vite + React + TypeScript SPA at the repo root (strict mode enabled)
- [x] 1.2 Add dependencies: state store (Zustand), and dev tooling (ESLint, Prettier, Vitest)
- [x] 1.3 Configure environment handling for the Baidu AK (e.g. `.env` with `VITE_BAIDU_AK`) and document it in README
- [x] 1.4 Set up base app shell: full-viewport layout with map area + side panel, and a global error boundary

## 2. Shared data model & types

- [x] 2.1 Define `Place` discriminated union (`destination` | `road`), `BD09` coord type, `status`, `rating`, `tags` in a shared `types` module
- [x] 2.2 Define `Trip` and `TagConstraint` (`includesTag` with `min`) types
- [x] 2.3 Add validation helpers: rating ∈ 1..5 only when `status='visited'`; road requires both entry and exit
- [x] 2.4 Write unit tests for the validation helpers

## 3. Map provider abstraction (Baidu)

- [x] 3.1 Define the `MapProvider` interface: `loadSdk`, `renderMap(home)`, `addMarker`, `addPolyline`, `geocode(query)→Candidate[]`, `drivingRoute(from,to)→{distance,duration,path}`
- [x] 3.2 Add ambient TypeScript declarations for the `BMapGL` global
- [x] 3.3 Implement `BaiduMapProvider.loadSdk()` with lazy `<script>` injection using the configured AK; surface a clear error when AK is missing
- [x] 3.4 Implement `renderMap` centered on home `苏州市工业园区荣域花园` with a persistent home marker
- [x] 3.5 Implement `geocode` (address→BD09 candidates) and `drivingRoute` (per-leg distance/duration/path) wrappers
- [x] 3.6 Add BD09 ↔ GCJ-02 ↔ WGS84 conversion helpers inside the provider layer (for future non-Baidu import)

## 4. Data store & persistence

- [x] 4.1 Implement `DataStore` with IndexedDB primary and localStorage fallback (async load/save of catalog + trips)
- [x] 4.2 Implement startup load order: browser storage → bundled seed JSON → empty (home only)
- [x] 4.3 Implement JSON `export()` producing a downloadable file containing all places and trips (with coordinate-system label)
- [x] 4.4 Implement JSON `import()` with schema validation; support replace vs merge; reject invalid files without mutating existing data
- [x] 4.5 Add a committed seed `data/places.json` and wire `seedFromBundled()`
- [x] 4.6 Write unit tests for export/import round-trip and invalid-file rejection

## 5. Place catalog (CRUD + geocoding UX)

- [x] 5.1 Build the "Add place" form supporting kind = destination (single location) or road (entry + exit)
- [x] 5.2 Wire geocoding: resolve name/address to candidates; when multiple, require selection; on failure allow retry / manual coord / cancel
- [x] 5.3 Add tag input with autocomplete/suggestions from existing catalog tags
- [x] 5.4 Add status toggle (visited/wishlist) and 1–5 rating control (rating enabled only when visited)
- [x] 5.5 Implement edit and delete; on deleting a place used by trips, warn and mark affected trips as needing review
- [x] 5.6 Persist all catalog mutations through `DataStore`

## 6. Map visualization

- [x] 6.1 Render destination places as status-distinct markers and road places as polylines (entry→exit)
- [x] 6.2 Implement place selection: clicking a marker/polyline shows details (name, tags, status, rating) with edit / add-to-trip actions
- [x] 6.3 Implement tag filter and status filter controls that show/hide places on the map
- [x] 6.4 Render a computed trip route as an ordered path home → stops → home, with visible leg sequence
- [x] 6.5 Show a clear "Baidu AK required" state instead of a broken map when no AK is configured

## 7. Trip planner (selection, optimization, constraints, metrics)

- [x] 7.1 Implement current-trip selection state: add/remove candidate places from map or list
- [x] 7.2 Build the haversine cost matrix over selected stops (roads modeled as directed entry→exit edges, either direction)
- [x] 7.3 Implement nearest-neighbor + 2-opt heuristic to produce a home-anchored cyclic order; handle empty/single-place selections trivially
- [x] 7.4 Implement tag-constraint validation (e.g. ≥1 `drifting`); block presenting an invalid plan and prompt to fix/relax
- [x] 7.5 After ordering, call Baidu `drivingRoute` per leg to compute real total/leg distance and duration; render metrics
- [x] 7.6 Implement save/reopen trip (selection, constraints, computed order) via `DataStore`
- [x] 7.7 Write unit tests for the optimizer (cost matrix, 2-opt improvement, road-direction choice) and the constraint validator

## 8. Integration, verification & docs

- [x] 8.1 End-to-end pass: add places → filter → select → plan a constrained loop → save → reload → reopen
- [x] 8.2 Verify each spec scenario across the four capabilities is exercised
- [x] 8.3 Run `openspec validate add-roadtrip-planner` and fix any issues
- [x] 8.4 Update README with setup (Baidu AK), run/build commands, and the JSON data-file workflow
