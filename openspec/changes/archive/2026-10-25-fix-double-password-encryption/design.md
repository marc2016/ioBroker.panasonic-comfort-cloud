# Design

## Context

- Committed code (`HEAD`, 3.4.0) still contains `password: this.encrypt(this.config?.password)` in `onReady()`.
- The working tree contains the uncommitted, partially verified change `fix-app-version-platform-mismatch` (11/16 tasks), which rewrites the same code path. That work must not be lost or released with this hotfix.
- `build/` is tracked in git (GitHub installs use it), so the compiled output must be committed too.
- Releases use `npm run release` (`@alcalzone/release-script`, branch `main`); the bot reported the last `test-and-release.yml` run on `main` as failed (E3031) – a green CI is needed for the release.

## Goals / Non-Goals

**Goals:** ship the one-line fix as 3.4.1 quickly, without the unfinished work.

**Non-Goals:**
- Platform/version fallback (#141) – stays in `fix-app-version-platform-mismatch`.
- Repairing already corrupted passwords – impossible without the plain text; users re-enter it once.

## Decisions

1. **Park the in-progress work with `git stash push -u`**, excluding this change's directory, implement the hotfix on a clean `HEAD`, then `git stash pop`. Alternative: a separate worktree – cleaner isolation, but the project rule is "no extra branches"; a stash keeps everything on `main`.
2. **Minimal code change**: drop the `password` property only; keep the `return` (js-controller restarts the instance after the config write).
3. **Test**: extend `test/lib/client_mock.test.js` with a case where the stored App Store version differs and assert `updateConfig` is called with exactly `{ appVersionFromAppStore }`.
4. **After `stash pop`**: conflicts in `src/main.ts`, `build/main.js`, `README.md` and the test are expected; resolve by keeping the version from `fix-app-version-platform-mismatch` (it already contains the fix) and keep both changelog lines merged into the next WORK IN PROGRESS block.

## Risks / Trade-offs

- [Stash conflicts] → resolve file by file as described in decision 4; run the full test suite afterwards.
- [CI red for unrelated reasons] → investigate the failing run before releasing; the bot states priority bugfixes are not blocked as long as tests pass.
- [Duplicate requirement in the other change's delta] → after archiving this change, edit `fix-app-version-platform-mismatch/specs/config-persistence/spec.md` so it no longer ADDs the same requirement.

## Migration Plan

Release 3.4.1; changelog asks affected users to re-enter the password once. Rollback: reinstall 3.4.0 (same behavior as before).
