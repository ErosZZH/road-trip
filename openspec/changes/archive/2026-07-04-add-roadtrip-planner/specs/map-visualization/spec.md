## ADDED Requirements

### Requirement: Map-centric primary view centered on home

The system SHALL present a Baidu map as the primary view, initially centered on the user's home location "苏州市工业园区荣域花园" with a persistent home marker.

#### Scenario: Initial load centers on home

- **WHEN** the app loads for the first time
- **THEN** the map is displayed as the main view, centered on the home coordinate with a distinct home marker

#### Scenario: Baidu API key missing

- **WHEN** no Baidu Maps API key (AK) is configured
- **THEN** the system shows a clear message explaining that a Baidu AK is required and how to provide it, instead of a broken map

### Requirement: Render places on the map

The system SHALL render every catalog place on the map: destinations as point markers and roads as polylines between their entry and exit points.

#### Scenario: Destination markers

- **WHEN** the catalog contains destination places
- **THEN** each destination is shown as a marker at its coordinate, visually distinguishable by status (visited vs wishlist)

#### Scenario: Road segments

- **WHEN** the catalog contains road places
- **THEN** each road is shown as a polyline connecting its entry and exit points, visually distinct from destination markers

#### Scenario: Inspect a place from the map

- **WHEN** the user selects a marker or polyline on the map
- **THEN** the system shows the place's details including name, tags, status, and rating, with actions to edit or add it to the current trip selection

### Requirement: Filter map by tags and status

The system SHALL allow the user to filter which places appear on the map by tag and by visited/wishlist status.

#### Scenario: Filter by tag

- **WHEN** the user activates one or more tag filters
- **THEN** the map shows only places carrying at least one of the selected tags and hides the rest

#### Scenario: Filter by status

- **WHEN** the user filters by "visited" or "wishlist"
- **THEN** the map shows only places matching the selected status

### Requirement: Render an optimized trip route

The system SHALL draw the computed trip route on the map as an ordered path starting and ending at home, passing through the selected places in optimized order.

#### Scenario: Display a planned loop

- **WHEN** the trip planner produces an optimized cyclic route
- **THEN** the map draws the route as a connected path from home through each selected place and back to home, in the optimized order

#### Scenario: Highlight route legs

- **WHEN** a trip route is displayed
- **THEN** the user can see the ordered sequence of stops and identify each leg between consecutive stops
