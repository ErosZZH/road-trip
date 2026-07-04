# data-store Specification

## Purpose

Browser persistence of the catalog and trips plus JSON export/import for backup and version control.

## Requirements

### Requirement: Persist catalog and trips in the browser

The system SHALL persist all places and saved trips in browser storage so that data survives page reloads without requiring a backend or login.

#### Scenario: Data survives reload

- **WHEN** the user adds places or saves trips and then reloads the app
- **THEN** the previously stored places and trips are loaded and displayed

#### Scenario: First run with empty storage

- **WHEN** the app runs for the first time with no stored data
- **THEN** the system starts with an empty catalog (only the home location) and does not error

### Requirement: Export data to JSON

The system SHALL allow the user to export the entire catalog and trips as a JSON file that can be saved and committed to version control.

#### Scenario: Export produces a JSON file

- **WHEN** the user triggers an export
- **THEN** the system generates a JSON document containing all places and trips and offers it for download

### Requirement: Import data from JSON

The system SHALL allow the user to import a JSON file previously exported by the app, replacing or merging the current data as chosen.

#### Scenario: Import replaces current data

- **WHEN** the user imports a valid JSON file and chooses to replace
- **THEN** the system loads the places and trips from the file as the new catalog and persists them

#### Scenario: Reject invalid import file

- **WHEN** the user imports a file that is not valid JSON or does not match the expected schema
- **THEN** the system rejects the import, reports the problem, and leaves the existing data unchanged

### Requirement: Repo-committed JSON as portable source of truth

The system SHALL support loading an initial catalog from a JSON data file bundled with the app, so the place list can be version-controlled in the repository.

#### Scenario: Seed from bundled data file

- **WHEN** the app is configured with a bundled JSON data file and browser storage is empty
- **THEN** the system loads the places and trips from the bundled file as the initial catalog
