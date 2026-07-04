## MODIFIED Requirements

### Requirement: Render places and routes on the map

The system SHALL render every catalog entity on the map: places (destinations) as point
markers, and routes (scenic roads) as polylines following each route's stored driving-path
geometry between its entry and exit points.

#### Scenario: Destination markers

- **WHEN** the catalog contains places
- **THEN** each place is shown as a marker at its coordinate, visually distinguishable by
  status (visited vs wishlist)

#### Scenario: Route polylines follow stored geometry

- **WHEN** the catalog contains routes
- **THEN** each route is shown as a polyline that follows its persisted driving-path
  geometry (threading its waypoints) from entry to exit, visually distinct from place
  markers

#### Scenario: Inspect an entity from the map

- **WHEN** the user selects a place marker or a route polyline on the map
- **THEN** the system shows that entity's details including name, tags, status, and rating,
  with actions to edit it or add it to the current trip selection

### Requirement: Filter map by tags and status

The system SHALL allow the user to filter which places and routes appear on the map by tag
and by visited/wishlist status.

#### Scenario: Filter by tag

- **WHEN** the user activates one or more tag filters
- **THEN** the map shows only places and routes carrying at least one of the selected tags
  and hides the rest

#### Scenario: Filter by status

- **WHEN** the user filters by "visited" or "wishlist"
- **THEN** the map shows only places and routes matching the selected status

## RENAMED Requirements

- FROM: `### Requirement: Render places on the map`
- TO: `### Requirement: Render places and routes on the map`
