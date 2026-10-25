# AGENTS.md

Guidance for AI agents (and humans) working on `ioBroker.panasonic-comfort-cloud`.

Based on the [ioBroker AI developer guide](https://github.com/Jey-Cee/iobroker-ai-developer-guide). When in doubt, the official docs win over model knowledge — ioBroker conventions change and AI models often know outdated patterns:

- [Adapter reference](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md)
- [Object schema](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectsschema.md)
- [State roles](https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md)
- [Repository requirements](https://github.com/ioBroker/ioBroker.repositories/blob/master/README.md)

## Project layout

- `src/main.ts` — adapter logic (TypeScript), compiled to `build/` (`npm run build`)
- `src/lib/state-definitions.ts` — state definitions, `src/lib/adapter-config.d.ts` — typed `native` config
- `admin/jsonConfig.json` — admin UI (JSONConfig), translations in `admin/i18n/`
- `io-package.json` — adapter metadata, `native` defaults, `protectedNative` / `encryptedNative`
- The Panasonic API is accessed via the npm package [`panasonic-comfort-cloud-client`](https://github.com/marc2016/panasonic-comfort-cloud-client) (also maintained by marc2016). API/auth changes usually belong there, not in this adapter.

## Commands

- `npm run build` — compile TypeScript
- `npm run check` — type check
- `npm run lint` — ESLint (`@iobroker/eslint-config`)
- `npm test` — package + unit tests; `npm run test:integration` — integration tests
- `npm run translate` — generate admin translations
- `npm run release` — release via `@alcalzone/release-script` (branch `main`)

Run build, lint and tests before proposing a change as done.

## ioBroker rules

| Topic | Do | Don't |
| --- | --- | --- |
| Admin UI | JSONConfig with i18n keys | `index_m.html`, hard-coded language strings |
| Roles | Correct [state roles](https://github.com/ioBroker/ioBroker/blob/master/doc/STATE_ROLES.md) | `role: "state"` everywhere |
| Object tree | `device` → `channel` → `state`, create every intermediate object explicitly | States below states |
| Object IDs | Only `A-Za-z0-9-_`, sanitize names from the API | Spaces / special characters |
| Objects | `setObjectNotExists` / `extendObject` | `setObject` overwriting existing objects |
| ack flag | `ack=true` for values from the device, `ack=false` = command | Ignoring `ack` in `onStateChange` |
| Timers | `this.setTimeout` / `this.setInterval`, cleared in `onUnload` | Node.js `setTimeout` / `setInterval` |
| Exit | `this.terminate()` | `process.exit()` |
| Connection | Keep `info.connection` in sync with the login/device state | |
| Language | README, logs, comments, changelog in English | German texts in code/README |
| Polling | Simple adapter timers with the configured interval | Scheduling libraries / fixed times (all users hit the API simultaneously) |

`onUnload` must clean up all timers and connections (compact mode: start → run → stop → restart must work).

### Passwords and encrypted config

- `password` is listed in both `protectedNative` and `encryptedNative` in `io-package.json`. js-controller decrypts it before the adapter starts, so `this.config.password` is plain text.
- **`this.updateConfig()` encrypts `encryptedNative` fields itself.** Never pass `this.encrypt(...)` values into `updateConfig()` and do not re-pass unchanged secrets — only pass the fields that actually change. Double encryption silently breaks the login (see #140 / #141).
- `updateConfig()` restarts the adapter; code after it should `return`.
- Never log passwords or tokens.

## App version handling

The Comfort Cloud API rejects outdated app versions (`401`, code `4106`, "New version app has been published"). On start the adapter reads the current iOS app version from the App Store (`getCurrentAppVersion()`), stores it as `appVersionFromAppStore` via `updateConfig()` and restarts. Fallbacks: the manually configured `appVersion`, then the client library's `DEFAULT_APP_VERSION`. When users report 4106, first check that the version actually sent (`X-APP-VERSION`) matches the App Store, then check the client library for other changed headers.

## Workflow

- Keep bug fixes small and separate from maintenance (dependency updates, repository-checker findings, workflow changes) so hotfixes can be released quickly.
- Commit messages: short, one line, Conventional Commits style (e.g. `fix: avoid double encryption of password`). No `Co-Authored-By` or other AI attribution lines in commits or PRs.
- Add a changelog entry under `### **WORK IN PROGRESS**` in `README.md`, referencing issues as `(#123)`.
- Do not edit `io-package.json` `news` or versions by hand — the release script does that.
- Before a release: CI (`test-and-release.yml`) must be green and the [adapter checker](https://www.iobroker.dev/adapter-check) should pass. Open findings are tracked in the "ioBroker Check and Service Bot" issue; errors there may block stable updates.
- Do not generate `io-package.json`, project structure or workflows from scratch — follow the [adapter creator](https://github.com/ioBroker/create-adapter) templates and the repository checker.
- Do not commit `.DS_Store`, `.dev-server/` or other local files.
