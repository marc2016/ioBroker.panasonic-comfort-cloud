# Tasks

## 1. Isolate the hotfix

- [x] 1.1 Park the uncommitted work of `fix-app-version-platform-mismatch` with `git stash push -u -m "wip: fix-app-version-platform-mismatch" -- ':!openspec/changes/fix-double-password-encryption'`; verify `git status` shows only this change's directory and `git stash list` contains the entry

## 2. Fix

- [x] 2.1 Remove `password: this.encrypt(this.config?.password)` from the `updateConfig()` call in `onReady()` (`src/main.ts`); verify `grep -n "this.encrypt" src/main.ts` finds nothing
- [x] 2.2 Add a test to `test/lib/client_mock.test.js`: stored `appVersionFromAppStore` differs from the App Store mock → `updateConfig` is called once with exactly `{ appVersionFromAppStore: <new> }`; verify the test fails without the fix and passes with it
- [x] 2.3 Add a changelog entry under `### **WORK IN PROGRESS**` in `README.md` (fix #140, note to re-enter the password once if affected); verify README renders
- [x] 2.4 Run `npm run build`, `npm run lint`, `npm test`, `npm run test:integration`; all pass and `build/main.js` is updated

## 3. Release

- [x] 3.1 Commit on `main` (`fix: avoid double encryption of password (#140)`), including `build/`; verify `git show --stat HEAD`
- [x] 3.2 Check the latest `test-and-release.yml` run on `main` after pushing; fix or explain a red run before releasing
- [x] 3.3 Release 3.4.1 with `npm run release patch` (requires explicit approval, publishes to GitHub/npm); verify `npm view iobroker.panasonic-comfort-cloud version` shows 3.4.1

## 4. Restore the in-progress work

- [x] 4.1 `git stash pop`; resolve conflicts in `src/main.ts`, `build/main.js`, `README.md`, `test/lib/client_mock.test.js` by keeping the `fix-app-version-platform-mismatch` version and merging the changelog lines; verify `npm run build && npm test` pass
- [x] 4.2 After archiving this change, adjust `openspec/changes/fix-app-version-platform-mismatch/specs/config-persistence/spec.md` so the requirement "Encrypted settings are never re-written by the adapter" is no longer ADDED twice; verify `openspec validate fix-app-version-platform-mismatch --strict`
