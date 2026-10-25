# Spec Delta

## Purpose

Defines which app version and platform the adapter presents to the Panasonic Comfort Cloud API, so the API's exact-version check accepts the login even when the iOS and Android apps are released at different times.

## ADDED Requirements

### Requirement: Version and platform are sent as a consistent pair
The adapter SHALL always send an app version together with the platform identifier of the store that version belongs to: iOS App Store versions with the iOS platform identifier, Google Play versions with the Android platform identifier. The adapter MUST NOT combine a version of one platform with the identifier of the other.

#### Scenario: iOS version is sent as iOS
- **WHEN** the adapter logs in with the version read from the iOS App Store (e.g. 5.1.1)
- **THEN** the request carries that version and the iOS platform identifier (`X-APP-TYPE: 0`)

#### Scenario: Android version is sent as Android
- **WHEN** the adapter logs in with the version read from Google Play (e.g. 5.1.0)
- **THEN** the request carries that version and the Android platform identifier (`X-APP-TYPE: 1`)

### Requirement: Automatic version resolution from both stores
When automatic version detection is enabled, the adapter SHALL look up the current app version in Google Play and in the iOS App Store on every start, and SHALL build an ordered list of login candidates: Android/Play version first, iOS/App Store version second, the client library's built-in default last. A store whose lookup fails or returns no version SHALL be left out of the list without aborting the start.

#### Scenario: Both stores answer
- **WHEN** Google Play reports 5.1.0 and the App Store reports 5.1.1
- **THEN** the candidates are (5.1.0, Android), (5.1.1, iOS), (library default, Android) in this order

#### Scenario: Google Play lookup fails
- **WHEN** the Google Play lookup fails or its version cannot be parsed
- **THEN** a warning is logged and the candidates start with (App Store version, iOS)

#### Scenario: Both lookups fail
- **WHEN** neither store returns a version
- **THEN** the adapter logs a warning and tries only the library default

### Requirement: Fallback when the API rejects the app version
When a login is rejected with error code 4106, the adapter SHALL retry the login with the next candidate, at most once per remaining candidate, and SHALL stop at the first candidate that is accepted. The accepted pair SHALL be logged at info level and used for all further requests of this adapter run. Errors other than 4106 MUST NOT trigger the fallback.

#### Scenario: Android version outdated, iOS accepted
- **WHEN** the login with (5.1.0, Android) returns 4106 and the login with (5.1.1, iOS) succeeds
- **THEN** the adapter is connected, `info.connection` is true, and the log names 5.1.1 / iOS as the used pair

#### Scenario: All candidates rejected
- **WHEN** every candidate is rejected with 4106
- **THEN** the adapter logs one error listing every version/platform pair it tried, `info.connection` stays false, and no further login attempts are made until the adapter is restarted

#### Scenario: Version rejected while running
- **WHEN** the adapter was connected and a later request is rejected with 4106 (a new app version was published during runtime)
- **THEN** the adapter sets `info.connection` to false and restarts itself once so the version resolution runs again; a 4106 during the start-up login MUST NOT cause a restart (no restart loop)

#### Scenario: Wrong credentials
- **WHEN** the login fails because of invalid username or password
- **THEN** no further candidates are tried and the credential error is logged

### Requirement: Manual version override
When automatic version detection is disabled and a manual app version is configured, the adapter SHALL use exactly that version with the configured platform (Android by default) and SHALL NOT query the stores or fall back to other candidates.

#### Scenario: Manual iOS version
- **WHEN** automatic detection is off, the manual version is 5.1.1 and the platform setting is iOS
- **THEN** the login is sent with (5.1.1, iOS) only, and no store lookup is performed

#### Scenario: Manual version without platform setting
- **WHEN** an existing installation has a manual version but no platform setting yet
- **THEN** the platform defaults to Android, matching the previous behavior

### Requirement: Diagnosable version errors
Whenever a login fails with error code 4106, the error log SHALL contain the version and platform that were sent, so users can tell a platform mismatch from an outdated adapter.

#### Scenario: Error message content
- **WHEN** a login is rejected with 4106
- **THEN** the log entry includes the rejected version, the platform name and the error code
