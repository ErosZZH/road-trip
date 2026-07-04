## Why

Planning a summer road trip through south Anhui (皖南) and north Zhejiang (浙北) means juggling dozens of candidate places — some already visited and worth rating, some still on the wishlist — scattered across a wide area. Doing this by hand on a generic map is slow and makes it hard to answer the real question: *which nearby places can I chain into one enjoyable driving loop that starts and ends at home and includes the experiences I care about (e.g. at least one drifting)?* This tool turns a personal, growing catalog of places into optimized round-trip plans.

## What Changes

- Add a **map-centric single-page web app** (TypeScript + React) whose primary view is a Baidu map centered on home (`苏州市工业园区荣域花园`).
- Let the user **add places continuously** through a form; the app **geocodes** the name/address and drops a marker on the map automatically.
- Support **two kinds of places**: scenic **destinations** (points) and scenic **driving roads** (polyline segments with an entry and exit point) — both first-class in v1.
- Track a **visited/wishlist** status per place, and let the user give visited places a **1–5 rating (vote)**.
- Let each place carry **type/tags** (e.g. `drifting`, `scenic-drive`, `mountain`, `water-town`) for categorization and filtering.
- Provide a **trip planner**: select candidate places, then **auto-optimize a cyclic route** (TSP-style) that begins and ends at home, keeps chosen places close together, and honors **must-include tag constraints** (e.g. "at least one drifting"). Show total distance, duration, and per-leg metrics.
- **Persist** all data in the browser and support **JSON export/import** so the catalog can be committed to the repo and version-controlled.

## Capabilities

### New Capabilities
- `place-catalog`: The data model and CRUD for places — destinations (points) and scenic roads (segments) — including geocoding, tags, visited/wishlist status, and 1–5 ratings.
- `map-visualization`: The Baidu-map-based primary view — home centering, place markers, road polylines, tag/status filtering, and rendering of an optimized trip route.
- `trip-planner`: Selecting candidate places and computing an optimized home-anchored cyclic route with must-include tag constraints and distance/duration metrics; saving and reopening trips.
- `data-store`: Browser persistence of the catalog and trips plus JSON export/import for backup and version control.

### Modified Capabilities
<!-- None — this is a greenfield project with no existing specs. -->

## Impact

- **New project scaffold**: Vite + React + TypeScript SPA; no backend.
- **External dependency**: Baidu Maps JavaScript API — the user supplies their own developer key (AK). A thin map-provider layer isolates Baidu specifics (BD09 coordinates, geocoding, routing/direction services).
- **Coordinate handling**: Standardize on Baidu BD09 internally; document conversion if data is imported from other systems.
- **Persistence**: `localStorage`/IndexedDB in the browser plus a repo-committed JSON data file as the portable source of truth.
- **New dependencies**: routing/optimization utilities for the cyclic-route solver; state management and a form/validation library for the place-entry UX.
