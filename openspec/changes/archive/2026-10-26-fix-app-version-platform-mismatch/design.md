# Design

## Context

Verified against the live accsmart API on 2026-10-25 (`POST /auth/v2/login` with an invalid token; `4100` = version accepted, token rejected; `4106` = version rejected):

```
                      X-APP-TYPE = 1 (Android)    X-APP-TYPE = 0 (iOS)
X-APP-VERSION 5.1.0   4100 accepted               4106
X-APP-VERSION 5.1.1   4106                        4100 accepted
5.0.9 / 5.1.2 / 6.0.0 (Android)                   4106
```

The server compares numerically for equality with the *current* version of the declared platform (`05.1.0`, `5.1.0.1` accepted; `5.1`, higher and lower versions rejected). `X-APP-TYPE: 2` is blocked by CloudFront.

Current code:
- `panasonic-comfort-cloud-client` (separate repo, same maintainer) hard-codes `'X-APP-TYPE': '1'` in `domain/apiHelper.js`; `ComfortCloudClient` only takes `appVersion`. The OAuth part identifies as `Auth0.Android` / `okhttp`.
- `src/main.ts` `onReady()` reads only the iOS App Store (`itunes.apple.com/lookup?id=1348640525`), calls `updateConfig({ appVersionFromAppStore, password: this.encrypt(password) })` and returns; js-controller restarts the instance. `updateConfig()` itself re-encrypts `encryptedNative` fields → double encryption (#140).
- `handleClientError()` re-logs in on `TokenExpiredError` with the same client instance; any other `ServiceError` (incl. a runtime 4106) is only logged.

## Goals / Non-Goals

**Goals:**
- Login works whenever *either* store's current version is accepted.
- Password is never corrupted by the adapter.
- A runtime app release recovers without user action.

**Non-Goals:**
- Changing the OAuth flow (Auth0 client identity) – not needed per the probe; the accsmart check is independent of it.
- Persisting the working pair across restarts – store versions are re-read on every start anyway.
- Repairing passwords already corrupted by #140 – users re-enter once (documented in changelog).

## Decisions

### 1. Client library gets an `appType` parameter (A)
Specified and planned in the library repo as change `add-app-type-header` (release 2.3.0): exported `AppType { IOS = '0', ANDROID = '1' }`, `new ComfortCloudClient(appVersion?, appType = ANDROID)`, read-only `appVersion` / `appType`, `AppVersionRejectedError extends ServiceError` for code 4106, `DEFAULT_APP_VERSION` 5.1.0. Existing callers are unaffected.
*Alternative:* patch the header in the adapter via an axios interceptor on the private `axiosInstance` – rejected, relies on internals and breaks silently on library updates.

### 2. Fallback lives in the adapter, by creating a new client per candidate (C)
The adapter builds the candidate list (spec: *Automatic version resolution*) and loops: `new ComfortCloudClient(version, type)` → `login()`; on `ServiceError` with `code === 4106` continue, on anything else rethrow. The first successful client is kept as `this.comfortCloudClient`.
*Alternative:* retry inside the library after OAuth, only repeating `/auth/v2/login` – fewer Auth0 logins, but puts adapter-specific policy into the shared library. Rejected for now; at most 2 extra OAuth logins only in the failure case is acceptable. Can be moved into the library later without spec changes.

### 3. Google Play lookup with plain HTTP + regex, fail-soft (B)
Fetch `https://play.google.com/store/apps/details?id=com.panasonic.ACCsmart&hl=en&gl=US` with axios (already a dependency, 10 s timeout) and extract the version with a regex on the embedded data (`[[["x.y.z"]]`). Validate with `/^\d+\.\d+\.\d+$/`. Any error → `undefined` + warning.
*Alternative:* `google-play-scraper` npm package – rejected: large dependency tree for one value, and it scrapes the same page.
The Android/Play candidate goes first because it matches the Android OAuth identity and the library default.

### 4. Config write-back only for changed, non-secret fields (D)
Replace the write in `onReady()` with: compute `{ appVersionFromAppStore?, appVersionFromPlayStore? }` containing only changed values; call `updateConfig(changes)` only if non-empty, then `return` (restart). Skip lookups and write entirely when `useAppVersionFromAppStore` is false. Never pass `password`/`username`.
*Alternative:* store detected versions in `info.*` states to avoid the restart – nicer, but changes where users see the values; kept out of this hotfix.

### 5. Settings
- Keep the key `useAppVersionFromAppStore` (no migration); relabel to "Detect app version automatically (App Store / Google Play)".
- New `appVersionFromPlayStore` (read-only text) and `appType` (select: `android` default / `ios`, only visible when automatic detection is off) in `io-package.json` `native`, `adapter-config.d.ts`, `jsonConfig.json`, i18n.

### 6. Runtime 4106 → single self-restart
In `handleClientError()` (and the device error path), a `ServiceError` with code 4106 after a successful start-up login calls `this.restart()`. A flag set after the first successful login prevents restarts from the start-up path.

### 7. Logging
Every 4106 is logged with version + platform name; success logs `Login successful (app version 5.1.1, iOS).`; total failure logs all tried pairs in one error line.

## Risks / Trade-offs

- [Google Play page structure changes] → fail-soft; App Store candidate still works; warning in log.
- [Play blocks requests / geo differences] → `hl=en&gl=US` fixed; failure only drops one candidate.
- [iOS header with Android OAuth identity rejected on some endpoints] → verify all used endpoints (groups, device status, control, history) with a real account before release (task 1.4); Android candidate is tried first anyway.
- [Extra Auth0 logins could hit rate limits] → max 3 candidates, only on 4106, no loop.
- [Restart loop on runtime 4106] → restart only after a successful login in the same run (decision 6).
- [Library release needed first] → adapter work can be developed against a local `npm link`; adapter release waits for the library release.

## Migration Plan

1. Release `panasonic-comfort-cloud-client` 2.3.0 with `appType`.
2. Bump dependency in the adapter, release 3.4.1 (patch; new settings have defaults matching old behavior).
3. Changelog tells users affected by #140 to re-enter their password once.
Rollback: users can pin a manual version + platform in the settings; previous adapter version remains installable.

## Open Questions

- Exact regex for the Play version needs to be confirmed against the live page (task 2.1); it does not affect the approach – if parsing is impossible, the Play candidate is simply never present.
