## MODIFIED Requirements

### Requirement: Persist catalog and trips on the local filesystem

The system SHALL persist all places, routes, and trips as JSON files on the local
filesystem, owned by a backend process, so that data survives reloads, is visible and
editable on disk, and is never stored in the browser. The frontend SHALL read and write
this data exclusively through the backend's HTTP API and SHALL NOT use IndexedDB,
localStorage, or any other browser storage as a source of truth.

#### Scenario: Data survives reload

- **WHEN** the user adds places, routes, or trips and then reloads the app
- **THEN** the frontend re-fetches them from the backend and the previously stored
  entities are loaded and displayed

#### Scenario: Data is written to disk

- **WHEN** the user creates or edits a place, route, or trip
- **THEN** the backend writes the corresponding JSON file under the data folder before
  the operation is reported as successful

#### Scenario: First run with empty data folder

- **WHEN** the app runs for the first time and the data folder contains no entity files
- **THEN** the system starts with an empty catalog (only the home location) and does not
  error

#### Scenario: No browser storage is used

- **WHEN** the app persists or loads any place, route, or trip
- **THEN** no data is read from or written to IndexedDB or localStorage

### Requirement: Organize data into places, routes, and trips folders

The system SHALL store data in a dedicated data folder split into three subfolders —
`places/`, `routes/`, and `trips/` — with one JSON file per entity. Route files SHALL
contain the route's geometry (endpoints, waypoints, and driving path). Trip files SHALL
reference the places and routes they include.

#### Scenario: Entity written to its subfolder

- **WHEN** the backend persists a destination, a scenic route, or a trip
- **THEN** it writes one JSON file for that entity into `places/`, `routes/`, or `trips/`
  respectively, named by the entity id

#### Scenario: Route file carries its geometry

- **WHEN** a scenic route is persisted
- **THEN** its JSON file in `routes/` includes the route's entry and exit points, any
  waypoints, and the computed driving path geometry

#### Scenario: Trip references places and routes

- **WHEN** a trip is persisted
- **THEN** its JSON file in `trips/` records the ids of the included places and routes and
  the computed loop order, without duplicating place or route geometry

### Requirement: Export data to JSON

The system SHALL allow the user to export the entire on-disk catalog (all places, routes,
and trips) as a single JSON document that can be saved and committed to version control.

#### Scenario: Export produces a JSON file

- **WHEN** the user triggers an export
- **THEN** the system produces a single JSON document aggregating all places, routes, and
  trips from the data folder and offers it for download

### Requirement: Import data from JSON

The system SHALL allow the user to import a JSON document previously produced by export,
writing its places, routes, and trips to the data folder, replacing or merging the current
data as chosen.

#### Scenario: Import replaces current data

- **WHEN** the user imports a valid JSON document and chooses to replace
- **THEN** the backend writes the document's places, routes, and trips to the data folder
  as the new catalog and the frontend reloads them

#### Scenario: Reject invalid import file

- **WHEN** the user imports a file that is not valid JSON or does not match the expected
  schema
- **THEN** the system rejects the import, reports the problem, and leaves the existing
  on-disk data unchanged

## REMOVED Requirements

### Requirement: Repo-committed JSON as portable source of truth

**Reason**: The dedicated on-disk `data/` folder (with its `places/`, `routes/`, and
`trips/` files) is now itself the version-controllable source of truth, so a separate
bundled seed file loaded only when browser storage is empty is no longer needed.

**Migration**: Seed the catalog by placing entity JSON files directly in the `data/`
subfolders (or by importing an exported JSON document), rather than relying on a bundled
`places.seed.json` loaded into browser storage on first run.

## RENAMED Requirements

- FROM: `### Requirement: Persist catalog and trips in the browser`
- TO: `### Requirement: Persist catalog and trips on the local filesystem`
