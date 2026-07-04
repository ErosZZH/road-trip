## Context

This is a greenfield, browser-only web app (TypeScript + React) for planning summer road trips through south Anhui (皖南) and north Zhejiang (浙北), anchored at home `苏州市工业园区荣域花园`. The proposal established four capabilities: `place-catalog`, `map-visualization`, `trip-planner`, and `data-store`.

Key constraints established with the user:
- **No backend.** Data lives in the browser and in a repo-committed JSON file (version-controlled, portable source of truth).
- **Baidu Maps**, with the user supplying their own developer key (AK). Baidu's JS API uses the **BD09** coordinate system; its services expose **Geocoder** (address → coordinate) and **DrivingRoute** (driving directions + distance/duration).
- **Roads are first-class in v1**: a place is either a point *destination* or a two-endpoint *road* segment traversed entry → exit.
- **Auto-optimized cyclic route** (TSP-style) starting and ending at home, honoring must-include tag constraints.

## Goals / Non-Goals

**Goals:**
- A map-first SPA that loads centered on home and renders the full catalog (destination markers + road polylines).
- Frictionless, repeatable place entry: type a name → geocode → confirm → marker on map, with tags, visited/wishlist status, and 1–5 rating.
- A trip planner that takes a candidate selection plus tag constraints and returns a near-optimal home-anchored loop with total/leg distance and duration.
- Local persistence + JSON export/import + seed-from-bundled-file, so the catalog can be committed to git.
- A **map-provider abstraction** thin enough that Baidu specifics (SDK loading, geocoding, routing, coordinate system) sit behind one interface.

**Non-Goals:**
- Multi-user accounts, cloud sync, or any server component.
- Multi-day itinerary scheduling (hotels, opening hours, per-day splits). v1 optimizes a single loop, not a calendar.
- Turn-by-turn in-app navigation; the app plans and visualizes, it does not navigate.
- Guaranteed globally-optimal TSP; a near-optimal heuristic is acceptable for the expected place counts.
- Cross-provider coordinate migration tooling beyond documenting the BD09 assumption.

## Decisions

### 1. Stack: Vite + React + TypeScript, client-only
Vite for fast dev/build, React for the UI, strict TypeScript for the data model. No SSR/backend. **Alternatives:** Next.js (rejected — SSR/server features are unused weight for a client-only map app); CRA (rejected — unmaintained).

### 2. Map provider behind a `MapProvider` interface
Define a narrow interface — `loadSdk()`, `renderMap(home)`, `addMarker`, `addPolyline`, `geocode(query) → Candidate[]`, `drivingRoute(from, to) → {distance, duration, path}` — implemented by a `BaiduMapProvider`. UI and planner depend only on the interface. **Why:** isolates the one hard external dependency, keeps Baidu's `BMapGL` globals and BD09 quirks out of business logic, and preserves the option to swap providers later without a rewrite. **Alternative:** call `BMapGL` directly throughout (rejected — spreads a global, untyped SDK across the codebase and couples everything to Baidu).

### 3. Coordinate system: standardize on BD09 internally
All stored coordinates are BD09 (Baidu's native system), matching geocoder output and avoiding per-render conversion. Import/export documents this assumption; conversion helpers (BD09 ↔ GCJ-02 ↔ WGS84) live in the provider layer for any future non-Baidu import. **Why:** the map and geocoder are Baidu; storing anything else means converting on every draw. **Trade-off:** data is Baidu-flavored; noted in export format.

### 4. Route optimization: haversine cost matrix + heuristic TSP, real driving polyline for display
Because there is no backend and Baidu's batch **Route Matrix** is a server-side Web Service API (AK + CORS constraints), the optimizer builds its cost matrix from **great-circle (haversine) distances** between stops, then solves the loop with a **nearest-neighbor + 2-opt** heuristic anchored at home. Road places are modeled as a directed edge (entry→exit); the solver may traverse a road in whichever direction yields the shorter loop. Once the order is fixed, the app calls Baidu **DrivingRoute** per leg to draw the true driving path and report actual driving distance/duration. **Why:** keeps the app backend-free and within API quota (one DrivingRoute call per final leg, not per candidate pair), while haversine is a good enough proxy for *ordering* nearby places. **Alternatives:** (a) driving-distance matrix via pairwise DrivingRoute — O(n²) calls, quota-heavy, rejected for v1 but a clean later enhancement; (b) exact TSP solver — unnecessary for the expected handful of stops.

### 5. Tag constraints as post-selection validators, not solver inputs
Must-include constraints (e.g. "≥1 place tagged `drifting`") are evaluated against the *selection* before/after optim:  the solver optimizes geometry; a separate validator checks the selection satisfies every constraint and blocks presenting an invalid plan. **Why:** cleanly separates "is this route good?" (geometry) from "is this trip acceptable?" (business rules), and gives clear user feedback ("add a drifting place") rather than a silently-infeasible solve. **Alternative:** encode constraints into the optimizer (rejected — over-engineered for simple "at least one of tag X" rules).

### 6. State & persistence: lightweight store + repository layer
A small global store (Zustand or React context + reducer) holds catalog and trips; a `DataStore` module owns persistence with an **IndexedDB primary / localStorage fallback**, plus JSON `export()`/`import()` and a `seedFromBundled()` path. Load order on startup: browser storage → else bundled JSON seed → else empty (home only). **Why:** IndexedDB comfortably holds a growing catalog and is async-friendly; the repo JSON file is the committable source of truth. **Alternative:** Redux (rejected — heavier than needed); pure localStorage (kept only as fallback due to size/serialization limits).

### 7. Data model (shared TypeScript types)
```
Place =
  | { id, kind: 'destination', name, coord: BD09, tags[], status, rating?, notes? }
  | { id, kind: 'road', name, entry: BD09, exit: BD09, tags[], status, rating?, notes? }
status = 'visited' | 'wishlist'   rating ∈ 1..5, only when status='visited'
Trip = { id, name, placeIds[], constraints: TagConstraint[], order?, metrics? }
TagConstraint = { type: 'includesTag', tag, min }   // v1: min defaults to 1
```
A discriminated union on `kind` keeps destination/road handling type-safe end to end.

## Risks / Trade-offs

- **Haversine ≠ driving distance** → For twisty mountain roads in 皖南/浙北, straight-line ordering can occasionally misrank stops. Mitigation: display *actual* DrivingRoute distance/duration for the final order so the user sees the truth and can manually swap; document driving-matrix optimization as a fast-follow.
- **Baidu AK setup friction / quota** → Missing or over-quota AK breaks the map. Mitigation: explicit "AK required" UX (per spec), lazy SDK load, and minimizing DrivingRoute calls (final legs only).
- **BD09 lock-in** → Exported data is Baidu-coordinate-specific. Mitigation: label the coordinate system in the export schema and keep conversion helpers in the provider layer.
- **SDK is a global, untyped script** → `BMapGL` loads via `<script>` and isn't natively typed. Mitigation: confine it to `BaiduMapProvider` behind typed wrappers; add minimal ambient type declarations.
- **Heuristic TSP suboptimality** → Nearest-neighbor + 2-opt is near-optimal, not optimal. Acceptable given small n; note the limitation in the planner UI rather than implying a guaranteed best loop.
- **IndexedDB availability** (private mode / old browsers) → Mitigation: localStorage fallback and clear messaging if neither persists.

## Migration Plan

Greenfield — no data migration. Rollout: scaffold app → land the four capabilities behind the provider interface → commit a seed `places.json`. Rollback is trivial (revert the branch); user data is exportable to JSON before any risky change, and import restores it.

## Open Questions

- Should the optimizer minimize **distance** or **estimated time** by default (they can diverge on mountain roads)? Proposed default: distance for the heuristic, display both from DrivingRoute. Confirm during implementation.
- Preferred lightweight store: **Zustand** vs. React context+reducer — decide at scaffold time based on how much cross-view sharing the trip planner needs.
- Should road direction (entry↔exit) ever be user-locked, or always solver-chosen? v1 assumes solver-chosen; revisit if a road is one-way scenic.
