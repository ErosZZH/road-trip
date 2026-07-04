## ADDED Requirements

### Requirement: Add a destination place

The system SHALL allow the user to add a scenic destination as a point place by entering a name and an optional address/description, then geocoding it to coordinates and storing it in the catalog.

#### Scenario: Add a destination by name

- **WHEN** the user submits the add-place form with kind "destination" and a name such as "宏村"
- **THEN** the system geocodes the name to a coordinate, creates a place record with a unique id, kind "destination", the resolved coordinate, and the default status "wishlist"

#### Scenario: Geocoding returns multiple candidates

- **WHEN** geocoding a submitted place name returns more than one candidate location
- **THEN** the system presents the candidates and requires the user to select one before the place is saved

#### Scenario: Geocoding fails

- **WHEN** geocoding returns no result for the submitted name or address
- **THEN** the system reports that the location could not be found and allows the user to retry, enter coordinates manually, or cancel without saving

### Requirement: Add a scenic driving road

The system SHALL allow the user to add a scenic driving road as a segment place defined by an entry point and an exit point, so that a road with nice views can be planned as part of a trip.

#### Scenario: Add a road with entry and exit points

- **WHEN** the user submits the add-place form with kind "road" and provides both an entry location and an exit location
- **THEN** the system geocodes both endpoints, stores a place record with kind "road" holding the ordered entry and exit coordinates, and the default status "wishlist"

#### Scenario: Road missing an endpoint

- **WHEN** the user submits a road place without both an entry and an exit location
- **THEN** the system rejects the submission and prompts the user to provide the missing endpoint

### Requirement: Categorize places with tags

The system SHALL allow each place to carry zero or more type/tags (e.g. `drifting`, `scenic-drive`, `mountain`, `water-town`) so that places can be filtered and used in trip constraints.

#### Scenario: Assign tags when adding a place

- **WHEN** the user selects or types one or more tags while adding or editing a place
- **THEN** the system stores those tags on the place record and makes them available for filtering and trip constraints

#### Scenario: Reuse existing tags

- **WHEN** the user begins typing a tag that already exists in the catalog
- **THEN** the system suggests matching existing tags to keep tag names consistent

### Requirement: Track visited status and rating

The system SHALL let the user mark a place as visited or wishlist, and SHALL allow a visited place to carry an integer rating (vote) from 1 to 5.

#### Scenario: Rate a visited place

- **WHEN** the user marks a place as "visited" and selects a rating of 1, 2, 3, 4, or 5
- **THEN** the system stores the visited status and the rating on the place record

#### Scenario: Rating requires visited status

- **WHEN** the user attempts to set a rating on a place whose status is "wishlist"
- **THEN** the system does not store a rating until the place is marked visited

#### Scenario: Reject out-of-range rating

- **WHEN** a rating value outside the range 1–5 is supplied
- **THEN** the system rejects the value and keeps any previously stored valid rating

### Requirement: Edit and remove places

The system SHALL allow the user to edit any field of an existing place and to delete a place from the catalog.

#### Scenario: Edit a place

- **WHEN** the user changes a place's name, tags, status, rating, or location and saves
- **THEN** the system updates the stored record and reflects the change on the map and in lists

#### Scenario: Delete a place referenced by a trip

- **WHEN** the user deletes a place that is included in one or more saved trips
- **THEN** the system warns that the place is used by those trips and, on confirmation, removes it and marks the affected trips as needing review
