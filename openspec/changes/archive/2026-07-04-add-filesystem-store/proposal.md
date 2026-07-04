## Why

Today the entire catalog lives in the browser (IndexedDB with a localStorage
fallback). That makes the data invisible to the filesystem, hard to version, and
trapped in one browser profile. We want the catalog — especially heavy scenic-route
geometry — to live in real files on disk that can be inspected, edited, and committed,
and we never want the browser to be the source of truth again.

At the same time, adding a place is more manual than it should be: the user types a
name, geocodes to a single point, and can even hand-enter raw coordinates. The user
should just search by name, see every candidate Baidu returns, pick one, and have the
name and geometry filled in automatically.

## What Changes

- **BREAKING** Persistence moves out of the browser entirely. IndexedDB and the
  localStorage fallback are removed. A small standalone Node/Express backend owns a
  dedicated `data/` folder on the local filesystem and is the single source of truth.
- **BREAKING** Data is split across three subfolders, one JSON file per entity:
  - `data/places/` — destinations (points)
  - `data/routes/` — scenic driving roads, stored **together with their geometry**
    (entry/exit endpoints, waypoints, and the driving path)
  - `data/trips/` — home-anchored loops referencing selected places and routes
- **BREAKING** Terminology/model split: a "place" now means a **destination** only, and
  a scenic road becomes a first-class **route** (formerly the `road` variant of `Place`).
  The frontend reads and writes both through the backend REST API instead of a local
  `DataStore`.
- Adding a place/route becomes search-first: the user searches a name, the app lists
  **all** Baidu candidates and requires selecting one; the chosen result supplies the
  **name** (auto-filled) and the **geometry**. Manual coordinate entry is removed as the
  primary path.
- Scenic-route geometry (waypoints + driving path between endpoints) is computed in the
  browser via Baidu, then persisted to `data/routes/` so it is never recomputed from
  scratch and never held only in the browser.
- Export/import continues to work, now as a whole-`data/`-folder snapshot rather than a
  browser-storage dump.

## Capabilities

### New Capabilities
<!-- None. This change re-homes existing capabilities rather than introducing new user-facing ones. -->

### Modified Capabilities

- `data-store`: Replace browser persistence (IndexedDB/localStorage) with a
  filesystem-backed store owned by a Node backend; define the `data/{places,routes,trips}`
  layout, the REST persistence contract, and route geometry stored on disk. Export/import
  reframed around the on-disk folder.
- `place-catalog`: Split destinations ("places") from scenic roads ("routes") as distinct
  stored entities; require search-by-name to list **all** candidates and have the user pick
  one; auto-fill the name from the chosen result; persist route geometry with the route.
  Remove manual-coordinate entry as the primary add path.
- `map-visualization`: Render routes (with their persisted geometry) as the source for
  road polylines; adjust wording from the destination/road `Place` union to the
  place-vs-route split.
- `trip-planner`: A trip references places and routes (not a single `Place` set); saved
  trips and their computed loop geometry persist to `data/trips/` via the backend.

## Impact

- **New dependency & process**: a Node/Express (or equivalent) backend plus a way to run
  it alongside Vite in dev (`concurrently`) with an `/api` proxy. New `data/` folder as
  the on-disk store (git-ignored by default; snapshot-committable).
- **Removed**: `src/store/DataStore.ts` IndexedDB/localStorage backends, manual coordinate
  entry in `LocationField`, and the `road` variant of the `Place` union in favor of a
  distinct `Route` type.
- **Rewritten/added**: an API client the store calls via `fetch`; `appStore` persistence
  wiring; `useGeocoder`/`BaiduMapProvider` switched from single-result `Geocoder` to
  multi-result `LocalSearch`; `PlaceForm`/`LocationField` search-and-pick flow with
  auto-filled name.
- **Affected specs**: `data-store`, `place-catalog`, `map-visualization`, `trip-planner`.
- **Docs**: README data-workflow, prerequisites, and project-structure sections.
