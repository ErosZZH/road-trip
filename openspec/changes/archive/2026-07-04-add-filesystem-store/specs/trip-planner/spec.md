## MODIFIED Requirements

### Requirement: Select candidate places and routes for a trip

The system SHALL allow the user to build a trip by selecting a set of candidate places and
routes from the catalog to be included in the loop.

#### Scenario: Add a place or route to the current trip

- **WHEN** the user adds a place or route to the current trip selection from the map or a
  list
- **THEN** the system includes that entity in the trip's candidate set and reflects the
  selection in the UI

#### Scenario: Remove a place or route from the current trip

- **WHEN** the user removes a place or route from the current trip selection
- **THEN** the system excludes that entity from the candidate set and updates any computed
  route

### Requirement: Optimize a home-anchored cyclic route

The system SHALL compute a near-optimal cyclic loop that starts and ends at home and visits
every selected place and route exactly once, minimizing total travel distance or time.
Routes SHALL be traversed from their entry point to their exit point (or the reverse if
that yields a shorter loop).

#### Scenario: Compute an optimized loop

- **WHEN** the user requests a plan for a selection of two or more entities
- **THEN** the system produces an ordered loop beginning and ending at home that visits each
  selected place and route once in an order that minimizes total travel cost

#### Scenario: Routes traversed entry-to-exit

- **WHEN** the selection includes a route
- **THEN** the optimized loop enters the route at its entry point and leaves at its exit
  point (or the reverse if that yields a shorter loop), following the route's stored
  geometry rather than treating it as a single point

#### Scenario: Empty or single-entity selection

- **WHEN** the user requests a plan with no entities or a single entity selected
- **THEN** the system returns a trivial loop (home, optionally the single entity, and back)
  and does not error

### Requirement: Save and reopen trips

The system SHALL allow the user to save a planned trip with a name to the trips folder and
reopen it later with its selection, constraints, and computed loop.

#### Scenario: Save a trip

- **WHEN** the user saves the current trip with a name
- **THEN** the system persists a trip file recording the selected place and route ids, tag
  constraints, and computed loop order so it can be retrieved later

#### Scenario: Reopen a saved trip

- **WHEN** the user opens a previously saved trip
- **THEN** the system restores its selection and constraints and re-displays the loop on the
  map

## RENAMED Requirements

- FROM: `### Requirement: Select candidate places for a trip`
- TO: `### Requirement: Select candidate places and routes for a trip`
