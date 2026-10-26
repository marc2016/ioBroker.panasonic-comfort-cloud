# Spec Delta

## MODIFIED Requirements

### Requirement: Encrypted settings are never re-written by the adapter
When the adapter stores detected values in its instance configuration, it SHALL write only the fields whose values changed and MUST NOT include encrypted or protected settings (username, password). The stored password SHALL remain decryptable to the value the user entered.

#### Scenario: App Store version changes
- **WHEN** the detected App Store or Google Play version differs from the stored one and the adapter saves the new version
- **THEN** the configuration write contains only the changed app versions, and after the resulting restart the decrypted password equals the password entered in the admin UI

#### Scenario: Several version changes in a row
- **WHEN** the store versions change on consecutive starts
- **THEN** the password is still correct after each restart and the login succeeds

## ADDED Requirements

### Requirement: No configuration write without a change
The adapter SHALL NOT write its configuration (and thereby trigger a restart) when the detected values equal the stored values, or when automatic version detection is disabled.

#### Scenario: Unchanged version
- **WHEN** the detected versions equal the stored versions
- **THEN** the adapter continues to log in without writing the configuration

#### Scenario: Automatic detection disabled
- **WHEN** automatic version detection is disabled
- **THEN** the adapter neither queries the stores nor writes the configuration

### Requirement: Detected versions are visible to the user
The adapter SHALL store the last detected App Store version and the last detected Google Play version in read-only configuration fields so they are visible in the admin UI.

#### Scenario: Admin shows detected versions
- **WHEN** the user opens the instance settings after a start with automatic detection
- **THEN** both detected versions are shown read-only
