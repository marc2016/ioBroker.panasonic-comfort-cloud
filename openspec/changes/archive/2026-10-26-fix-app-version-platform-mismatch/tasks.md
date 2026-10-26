# Tasks

## 1. Client library (`panasonic-comfort-cloud-client`, separate repo)

- [x] 1.1 Complete the library change `add-app-type-header` (`AppType`, `appType` constructor parameter, `AppVersionRejectedError`, default 5.1.0, real-account check for both platforms) and verify `npm view panasonic-comfort-cloud-client version` shows 2.3.0

## 2. Version sources in the adapter

- [x] 2.1 Fetch the Google Play page for `com.panasonic.ACCsmart` once and confirm a regex that extracts the current version; record the regex/sample in a test fixture
- [x] 2.2 Extract version lookups into `src/lib/app-version.ts`: `getAppStoreVersion()` (existing iTunes lookup) and `getPlayStoreVersion()` (axios, 10 s timeout, `x.y.z` validation, returns `undefined` on any error); verify with unit tests on fixtures incl. malformed HTML and network error
- [x] 2.3 Add `buildCandidates(config, playVersion, appStoreVersion)` returning the ordered (version, type) list per spec (manual mode → single pair; automatic → Play/Android, App Store/iOS, library default/Android; missing versions omitted); verify with unit tests for all spec scenarios
- [x] 2.4 Ensure the new `*.test.ts` files run in `npm test` (adjust mocha spec if needed) and verify they appear in the test output

## 3. Config persistence fix (#140)

- [x] 3.1 Replace the `updateConfig` call in `onReady()` so it writes only changed `appVersionFromAppStore` / `appVersionFromPlayStore` values and never `password`/`username`; verify by restarting the dev-server instance twice with a changed stored version and confirming the login still succeeds
- [x] 3.2 Skip store lookups and config writes when `useAppVersionFromAppStore` is false; verify in the dev-server log that no lookup is logged in manual mode
- [x] 3.3 Add `appVersionFromPlayStore` (read-only) and `appType` (select android/ios, default android, hidden in automatic mode) to `io-package.json` `native`, `src/lib/adapter-config.d.ts`, `admin/jsonConfig.json`; relabel `useAppVersionFromAppStore`; run `npm run translate` and verify the admin UI shows the fields in the dev-server

## 4. Login with fallback

- [x] 4.1 Bump `panasonic-comfort-cloud-client` to the released version and verify `npm run check` passes
- [x] 4.2 Implement the candidate loop in `onReady()`: new client per candidate, continue only on `AppVersionRejectedError` (code 4106), keep the first successful client; log the used pair on success and all tried pairs on total failure; verify with a unit/integration test using a stubbed client (4106 → success, all 4106, credential error stops immediately)
- [x] 4.3 Log version + platform for every 4106 (start-up and runtime paths, `handleClientError` and `handleDeviceError`); verify log text in the tests from 4.2
- [x] 4.4 Track a "logged in once" flag and call `this.restart()` on a runtime 4106 only when it is set; verify with a test that a start-up 4106 does not restart and a runtime 4106 restarts once
- [x] 4.5 Bump `panasonic-comfort-cloud-client` to `^3.0.0` (fixes the undici peer conflict that breaks `npm ci` in CI, E3031), raise `engines.node` in `package.json` to `>=22.12.0`, regenerate `package-lock.json` and add a changelog line (new minimum Node.js 22.12); verify `npm run build && npm test` pass and `npx npm@10 ci --ignore-scripts` succeeds in a scratch copy of `package.json` + `package-lock.json`

## 5. Verification and release

- [x] 5.1 Run `npm run build`, `npm run lint`, `npm test`, `npm run test:integration`; all pass
- [x] 5.2 End-to-end in dev-server with a real account: automatic mode connects (`info.connection` true, log shows the used pair); manual mode with (5.1.0, android) and (5.1.1, ios) connects
- [x] 5.3 Add changelog entries under `### **WORK IN PROGRESS**` in `README.md` (platform mismatch fix #141, double encryption fix #140, note to re-enter the password once if affected); verify README renders
- [x] 5.4 Run the ioBroker adapter checker and confirm CI `test-and-release.yml` is green before the next release (3.5.0; 3.4.1 already shipped the #140 hotfix)
