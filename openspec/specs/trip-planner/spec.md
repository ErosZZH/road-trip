# trip-planner Specification

## Purpose

Selecting candidate places and computing an optimized home-anchored cyclic route with must-include tag constraints and distance/duration metrics; saving and reopening trips.

## Requirements

### Requirement: Select candidate places for a trip

The system SHALL allow the user to build a trip by selecting a set of candidate places from the catalog to be included in the route.

#### Scenario: Add a place to the current trip

- **WHEN** the user adds a place to the current trip selection from the map or a list
- **THEN** the system includes that place in the trip's candidate set and reflects the selection in the UI

#### Scenario: Remove a place from the current trip

- **WHEN** the user removes a place from the current trip selection
- **THEN** the system excludes that place from the candidate set and updates any computed route

### Requirement: Optimize a home-anchored cyclic route

The system SHALL compute a near-optimal cyclic route that starts and ends at home and visits every selected place exactly once, minimizing total travel distance or time. Road places SHALL be traversed from their entry point to their exit point.

#### Scenario: Compute an optimized loop

- **WHEN** the user requests a plan for a selection of two or more places
- **THEN** the system produces an ordered route beginning and ending at home that visits each selected place once in an order that minimizes total travel cost

#### Scenario: Roads traversed entry-to-exit

- **WHEN** the selection includes a road place
- **THEN** the optimized route enters the road at its entry point and leaves at its exit point (or the reverse if that yields a shorter loop), rather than treating it as a single point

#### Scenario: Empty or single-place selection

- **WHEN** the user requests a plan with no places or a single place selected
- **THEN** the system returns a trivial route (home, optionally the single place, and back) and does not error

### Requirement: Enforce must-include tag constraints

The system SHALL allow the user to specify tag constraints that a valid plan must satisfy — for example, "the trip must include at least one place tagged `drifting`" — and SHALL report when a selection cannot satisfy them.

#### Scenario: Constraint satisfied

- **WHEN** the user requires at least one place with a given tag and the selection contains such a place
- **THEN** the system computes the route and indicates that the constraint is satisfied

#### Scenario: Constraint not satisfiable

- **WHEN** the user requires at least one place with a given tag but no selected place carries that tag
- **THEN** the system does not present the plan as valid and prompts the user to add a place with the required tag or relax the constraint

### Requirement: Show route metrics

The system SHALL display total distance and estimated duration for a computed route, plus per-leg distance between consecutive stops.

#### Scenario: Display totals and legs

- **WHEN** an optimized route is computed
- **THEN** the system shows the total distance and estimated total driving time, and the distance for each leg between consecutive stops

### Requirement: Save and reopen trips

The system SHALL allow the user to save a planned trip with a name and reopen it later with its selection, constraints, and computed route.

#### Scenario: Save a trip

- **WHEN** the user saves the current trip with a name
- **THEN** the system persists the trip's selected places, tag constraints, and computed order so it can be retrieved later

#### Scenario: Reopen a saved trip

- **WHEN** the user opens a previously saved trip
- **THEN** the system restores its selection and constraints and re-displays the route on the map
