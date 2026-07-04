## MODIFIED Requirements

### Requirement: Add a destination place by searching a name

The system SHALL allow the user to add a scenic destination as a point place by searching
a name, presenting all candidate locations Baidu returns, and requiring the user to select
one. The system SHALL derive the place's name and coordinate from the selected candidate;
the user SHALL NOT be required to enter coordinates manually and SHALL NOT be required to
type the name separately.

#### Scenario: Search returns multiple candidates

- **WHEN** the user searches a destination name such as "宏村" and Baidu returns more than
  one candidate location
- **THEN** the system lists all returned candidates (each with its name and address context)
  and requires the user to select one before the place is saved

#### Scenario: Create place from the selected candidate

- **WHEN** the user selects one candidate from the search results
- **THEN** the system creates a place record with a unique id, kind "destination", the
  candidate's coordinate, the candidate's name auto-filled as the place name, and the
  default status "wishlist"

#### Scenario: Search returns a single candidate

- **WHEN** the user searches a name and Baidu returns exactly one candidate
- **THEN** the system still presents that candidate for confirmation and, on selection,
  creates the place using the candidate's name and coordinate

#### Scenario: Search returns no results

- **WHEN** a search returns no candidates for the entered text
- **THEN** the system reports that no location was found and allows the user to refine the
  search or cancel without saving, without offering raw coordinate entry as the primary path

### Requirement: Add a scenic route by searching its endpoints

The system SHALL allow the user to add a scenic driving road as a distinct **route** entity
defined by an entry point and an exit point, each chosen by searching a name and selecting
one of the listed candidates. The system SHALL compute and store the route's driving-path
geometry between the endpoints so the route persists with its real path.

#### Scenario: Add a route with entry and exit endpoints

- **WHEN** the user searches and selects an entry location and an exit location for a new
  route
- **THEN** the system stores a route record holding the ordered entry and exit coordinates,
  a name derived from the selected endpoints, its computed driving-path geometry, and the
  default status "wishlist"

#### Scenario: Endpoint candidates are listed for selection

- **WHEN** searching an entry or exit name returns more than one candidate
- **THEN** the system lists all candidates and requires the user to select one for that
  endpoint before the route can be saved

#### Scenario: Route missing an endpoint

- **WHEN** the user attempts to save a route without both an entry and an exit selected
- **THEN** the system rejects the submission and prompts the user to provide the missing
  endpoint

### Requirement: Edit and remove places and routes

The system SHALL allow the user to edit the fields of an existing place or route and to
delete either from the catalog.

#### Scenario: Edit a place or route

- **WHEN** the user changes a place's or route's name, tags, status, rating, or location
  and saves
- **THEN** the system updates the stored file and reflects the change on the map and in
  lists

#### Scenario: Re-searching a location updates its geometry

- **WHEN** the user changes a place's coordinate or a route's endpoint by searching and
  selecting a new candidate
- **THEN** the system updates the stored coordinate, and for a route recomputes and stores
  the driving-path geometry

#### Scenario: Delete an entity referenced by a trip

- **WHEN** the user deletes a place or route that is included in one or more saved trips
- **THEN** the system warns that it is used by those trips and, on confirmation, removes it
  and marks the affected trips as needing review

## ADDED Requirements

### Requirement: Places and routes are distinct entities

The system SHALL model destinations and scenic roads as two distinct entity types — a
**place** is a single point destination, and a **route** is a scenic road traversed from an
entry point to an exit point — each stored in its own collection.

#### Scenario: Place is a point

- **WHEN** a destination is created
- **THEN** it is stored as a place with a single coordinate and no endpoint geometry

#### Scenario: Route is a segment with geometry

- **WHEN** a scenic road is created
- **THEN** it is stored as a route with ordered entry and exit points plus its driving-path
  geometry, distinct from the places collection

## RENAMED Requirements

- FROM: `### Requirement: Add a destination place`
- TO: `### Requirement: Add a destination place by searching a name`

- FROM: `### Requirement: Add a scenic driving road`
- TO: `### Requirement: Add a scenic route by searching its endpoints`

- FROM: `### Requirement: Edit and remove places`
- TO: `### Requirement: Edit and remove places and routes`
