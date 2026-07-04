# Road-Trip Planner

A map-centric web app for planning summer self-driving loops through near provinces.

Add the places you want to visit — scenic **destinations** and scenic **routes** (roads)
— tag them, rate the ones you've been to (1–5), then let the tool chain a selection into
an optimized round-trip loop that starts and ends at home and honors constraints like
"must include at least one drifting".

## Features

- **Map-first UI** built on Baidu Maps, centered on home.
- **Two kinds of entities**: point **destinations** and entry→exit scenic **routes**,
  stored separately on disk.
- **Search-first adding**: type a name, pick from **all** Baidu results, and the name and
  coordinates are filled in for you — no manual coordinate entry.
- **Tags, visited/wishlist status, and 1–5 ratings** with geocoded map markers.
- **Trip planner**: pick candidate places and routes, add must-include tag constraints, and
  get a near-optimal home-anchored loop (nearest-neighbor + 2-opt) with real Baidu driving
  distances and durations per leg.
- **Filtering** by tag and status.
- **Filesystem persistence**: everything lives in JSON files on disk (owned by a small Node
  backend) — never in the browser — plus JSON **export/import**.

## Architecture

The app is a Vite/React frontend plus a small standalone **Node/Express backend** that owns
the on-disk data folder. The browser holds no source-of-truth state; it reads and writes
places, routes, and trips through the backend's `/api` endpoints. All Baidu Maps calls
(search, driving routes) run in the frontend.

```
Browser (React) ──fetch /api/*──▶ Node server ──reads/writes──▶ data/{places,routes,trips}/*.json
        └── Baidu Maps JS SDK (search + driving routes)
```

## Prerequisites

- **Node.js 20+** and npm.
- A **Baidu Maps JavaScript API key (AK)**. Register at
  [lbsyun.baidu.com](https://lbsyun.baidu.com/), create a *browser* (浏览器端)
  application, and copy its AK. Coordinates throughout the app use Baidu's **BD09** system.

## Setup

```bash
npm install
cp .env.example .env.local
# then edit .env.local and set VITE_BAIDU_AK=<your key>
```

Without an AK the app still runs — the catalog, planner logic, and data import/export
all work — but the map area shows a "Baidu map key required" notice instead of a live
map, and search is unavailable.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start **both** the Vite dev server and the data backend (via `concurrently`). Vite proxies `/api` to the backend. |
| `npm run dev:client` | Start only the Vite dev server. |
| `npm run server` | Start only the data backend (watch mode). |
| `npm start` | Start the data backend once (no watch) — used with a production build. |
| `npm run migrate:seed` | Seed `data/` with the starter 皖南/浙北 catalog (or pass an exported JSON path). |
| `npm run build` | Type-check and build the frontend for production into `dist/`. |
| `npm run preview` | Preview the production frontend build locally. |
| `npm test` | Run the unit + integration test suite (Vitest). |
| `npm run lint` | Lint with ESLint. |
| `npm run format` | Format with Prettier. |

`npm run dev` runs two processes; the backend listens on `http://localhost:5174` by
default (override with the `PORT` env var), and Vite forwards `/api` to it.

## Data workflow (filesystem source of truth)

Your places, routes, and trips are stored as JSON files on disk under `data/`, split by
kind:

```
data/
  places/<id>.json    a destination (point) — { name, tags, status, rating?, coord }
  routes/<id>.json    a scenic road — { name, tags, status, entry, exit, waypoints?, path }
  trips/<id>.json     a saved loop — { name, placeIds[], routeIds[], constraints, order? }
```

- **Routes store their geometry.** A route file keeps its entry/exit points, optional
  waypoints, and the computed driving `path`, so the scenic line is drawn from disk and not
  recomputed each session.
- **Seeding** — run `npm run migrate:seed` to populate `data/` with the starter catalog, or
  drop your own entity files into the folders, or import an exported JSON.
- **Export** — use **Export JSON** in the side panel to download the whole catalog
  (places + routes + trips) as one JSON file. Commit it for backup/versioning.
- **Import** — use **Import JSON** to load a previously exported file, choosing to
  **replace** all data or **merge** it in (incoming entries win on id clash). Invalid files
  are rejected without touching existing data.

The per-entity JSON files under `data/` are git-ignored by default (the folder skeleton is
kept via `.gitkeep`); commit an exported snapshot when you want to version your catalog.
The JSON format records its `coordSystem` (`BD09`) so data stays portable.

## Adding places and routes

Adding is search-first (no coordinates by hand):

1. Choose **目的地** (destination) or **风景道路** (route).
2. Search a name. The app lists **every** candidate Baidu returns — pick the right one.
3. The name auto-fills from your pick (you can edit it); coordinates come from the result.
4. For a route, search both the **entry** and **exit**; on save the app computes the driving
   path between them and stores it with the route.

## Project structure

```
data/                        Filesystem catalog (places / routes / trips)
server/
  index.ts                   Express API: /api/catalog, /api/{places,routes,trips}, import/export
  store.ts                   Per-entity JSON read/write with atomic writes
scripts/migrate-seed.ts      One-time seed → per-entity file migration
src/
  config/home.ts             Home location + Baidu AK access
  types/                     Shared domain types (Place, Route, Trip, ...)
  domain/                    Validation + route optimizer (pure logic, tested)
  map/                       MapProvider interface, BaiduMapProvider, coord conversions
  store/                     Zustand store, DataStore (REST client), planner orchestration
  hooks/                     useMap, useGeocoder
  components/                UI: form, list, filters, planner, map, data controls
```

## Notes & limitations

- The optimizer orders stops by great-circle distance (fast, no backend routing), then
  fetches **actual** Baidu driving distances/durations for the final loop — so mountain-road
  reality stays visible. If routing is unavailable it falls back to straight-line estimates
  and says so.
- The heuristic is near-optimal, not a guaranteed global optimum — fine for the handful
  of stops in a typical trip.
- v1 optimizes a single loop; multi-day scheduling (hotels, opening hours) is out of scope.
- The backend is a local single-user tool — no auth, no remote hosting.

## Development workflow

This project is developed spec-first with **OpenSpec**. The active change,
specifications, design, and task breakdown live under `openspec/changes/`.
