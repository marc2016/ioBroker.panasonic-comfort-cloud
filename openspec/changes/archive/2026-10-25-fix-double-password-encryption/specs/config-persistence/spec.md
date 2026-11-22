# Spec Delta

## Purpose

Defines how the adapter writes runtime-detected values back into its instance configuration without corrupting encrypted settings such as the password.

## ADDED Requirements

### Requirement: Encrypted settings are never re-written by the adapter
When the adapter stores detected values in its instance configuration, it SHALL write only the fields whose values changed and MUST NOT include encrypted or protected settings (username, password). The stored password SHALL remain decryptable to the value the user entered.

#### Scenario: App Store version changes
- **WHEN** the detected App Store version differs from the stored one and the adapter saves the new version
- **THEN** the configuration write contains only the app version, and after the resulting restart the decrypted password equals the password entered in the admin UI

#### Scenario: Several version changes in a row
- **WHEN** the App Store version changes on consecutive starts
- **THEN** the password is still correct after each restart and the login succeeds
