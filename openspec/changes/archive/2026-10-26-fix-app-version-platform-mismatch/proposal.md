# Proposal

## Why

Since the iOS release of Comfort Cloud 5.1.1 (2026-10-22) every login fails with `401 code 4106 "New version app has been published"` (#141). The adapter reads the app version from the **iOS** App Store but sends `X-APP-TYPE: 1` (**Android**), and the accsmart API only accepts the exact current version of the declared platform (Android is still 5.1.0). This worked only as long as both platforms shared a version number. In addition, every App Store version change re-saves the password double-encrypted via `updateConfig()`, which breaks the login on its own (#140).

## What Changes

- **A – platform-consistent headers:** send `X-APP-TYPE: 0` (iOS) whenever the app version comes from the iOS App Store. Requires the client library to accept the app type instead of hard-coding `'1'`.
- **B – Android version source:** additionally resolve the current Android version from Google Play, so an Android-typed request (matching the Android OAuth client) can be sent with the right version.
- **C – fallback on 4106:** when the login is rejected with 4106, retry once with the other platform/version pair before giving up; log which pair succeeded.
- **D – no double encryption:** persist only `appVersionFromAppStore` via `updateConfig()`; never re-pass the password. Also skip the store lookup/restart when `useAppVersionFromAppStore` is disabled.
- Manually configured `appVersion` keeps working; a new optional `appType` setting (Android/iOS) lets users pin the platform for a manual version.
- Clear error log for 4106 that names the version and platform that were sent.

## Capabilities

### New Capabilities
- `app-version-resolution`: how the adapter determines the app version and platform it sends to the Comfort Cloud API (store lookups, manual override, fallback on 4106).
- `config-persistence`: how the adapter writes back runtime-detected values into its instance config without corrupting encrypted fields.

### Modified Capabilities
<!-- none: no specs exist yet -->

## Impact

- **Adapter:** `src/main.ts` (`onReady`, `getCurrentAppVersion`, login), `src/lib/adapter-config.d.ts`, `io-package.json` (`native` defaults), `admin/jsonConfig.json` + `admin/i18n/*` (new settings), `README.md` changelog.
- **Dependency:** `panasonic-comfort-cloud-client` must expose the app type (`X-APP-TYPE`) – change and release in that repo (same maintainer), then bump the dependency here.
- **External:** new HTTP request to Google Play (unofficial, may break; must fail soft). One extra login request only in the 4106 case.
- Users hit by #140 must re-enter their password once; the fix prevents recurrence but cannot repair already corrupted values.
