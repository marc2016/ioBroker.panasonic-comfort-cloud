# Proposal

## Why

When `onReady()` detects a new App Store version it calls `updateConfig({ appVersionFromAppStore, password: this.encrypt(this.config?.password) })`. js-controller's `updateConfig()` already encrypts all `encryptedNative` fields (verified in `packages/adapter/src/lib/adapter/adapter.ts`: it decrypts the old config, merges, and re-encrypts), so the password is stored encrypted twice. After the automatic restart the decrypted value is still ciphertext and the OAuth login fails with 401 (#140). This happens on **every** App Store release, independent of the 4106 platform issue (#141), and is a one-line fix that should reach users before the larger change `fix-app-version-platform-mismatch` is ready.

## What Changes

- `onReady()` writes only `appVersionFromAppStore` via `updateConfig()`; the password is no longer passed.
- Patch release 3.4.1 with a changelog note: users whose password was already corrupted must enter it once again in the instance settings (the adapter cannot repair it).
- No other behavior changes (version source, platform header, fallback stay as in 3.4.0 – they are handled by `fix-app-version-platform-mismatch`).

## Capabilities

### New Capabilities
- `config-persistence`: how the adapter writes runtime-detected values back into its instance configuration without corrupting encrypted settings.

### Modified Capabilities
<!-- none: no main specs exist yet -->

## Impact

- `src/main.ts` (`onReady`), `build/main.js` (tracked build output), `test/lib/client_mock.test.js`, `README.md` changelog.
- Release 3.4.1 via `@alcalzone/release-script` (branch `main`).
- The in-progress change `fix-app-version-platform-mismatch` already contains this fix and a broader `config-persistence` delta; after this change is archived, its delta must be adjusted so the requirement is not ADDED twice.
