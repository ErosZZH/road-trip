# Road-Trip Planner

A map-centric web app for planning summer self-driving loops through near provinces.

Add the places you want to visit — scenic **destinations** and scenic **driving
roads** — tag them, rate the ones you've been to (1–5), then let the tool chain a
selection into an optimized round-trip loop that starts and ends at home and honors
constraints like "must include at least one drifting".

## Features

- **Map-first UI** built on Baidu Maps, centered on home.
- **Two kinds of places**: point destinations and entry→exit scenic road segments.
- **Tags, visited/wishlist status, and 1–5 ratings** with geocoded map markers.
- **Trip planner**: pick candidates, add must-include tag constraints, and get a
  near-optimal home-anchored loop (nearest-neighbor + 2-opt) with real Baidu driving
  distances and durations per leg.
- **Filtering** by tag and status.
- **Local persistence** (IndexedDB with a localStorage fallback) plus JSON
  **export/import** and a version-controlled seed catalog.

## Prerequisites

- **Node.js 20+** and npm.
- A **Baidu Maps JavaScript API key (AK)**. Register at
  [lbsyun.baidu.com](https://lbsyun.baidu.com/), create a *browser**
  application, and copy its AK. Coordinates throughout the app use Baidu's **BD09**
  system.

## Setup

```bash
npm install
cp .env.example .env.local
# then edit .env.local and set VITE_BAIDU_AK=<your key>
```

Without an AK the app still runs — the catalog, planner logic, and data import/export
all work — but the map area shows a "Baidu map key required" notice instead of a live
map, and geocoding is unavailable.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check and build for production into `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm test` | Run the unit + integration test suite (Vitest). |
| `npm run lint` | Lint with ESLint. |
| `npm run format` | Format with Prettier. |

## Data workflow (version-controlled catalog)

Your places and trips live in the browser, but the catalog can also be kept in git:

- **Seed file** — `data/places.seed.json` is loaded on first run when browser storage
  is empty. Edit it to change the starter catalog; it's validated at load time.
- **Export** — use **Export JSON** in the side panel to download your current catalog
  (places + trips) as a JSON file. Commit it to the repo for backup/versioning.
- **Import** — use **Import JSON** to load a previously exported file, choosing to
  **replace** all data or **merge** it in (incoming entries win on id clash). Invalid
  files are rejected without touching existing data.

The JSON format records its `coordSystem` (`BD09`) so data stays portable.

## Project structure

```
data/places.seed.json      Version-controlled seed catalog
src/
  config/home.ts           Home location + Baidu AK access
  types/                   Shared domain types (Place, Trip, ...)
  domain/                  Validation + route optimizer (pure logic, tested)
  map/                     MapProvider interface, BaiduMapProvider, coord conversions
  store/                   Zustand store, DataStore persistence, planner orchestration
  hooks/                   useMap, useGeocoder
  components/              UI: form, list, filters, planner, map, data controls
```

## Notes & limitations

- The optimizer orders stops by great-circle distance (fast, no backend), then fetches
  **actual** Baidu driving distances/durations for the final loop — so mountain-road
  reality stays visible. If routing is unavailable it falls back to straight-line
  estimates and says so.
- The heuristic is near-optimal, not a guaranteed global optimum — fine for the handful
  of stops in a typical trip.
- v1 optimizes a single loop; multi-day scheduling (hotels, opening hours) is out of
  scope.

## Development workflow

This project is developed spec-first with **OpenSpec**. The active change,
specifications, design, and task breakdown live under
`openspec/changes/add-roadtrip-planner/`.
