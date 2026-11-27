# Contributing to the React Native app

Repo-wide rules: [../CONTRIBUTING.md](../CONTRIBUTING.md). Setup: [SETUP_GUIDE.md](./SETUP_GUIDE.md). Tests: [TESTING.md](./TESTING.md).

## Before you push

From `react-native/`:

```bash
pnpm lint
pnpm type-check
pnpm test
```

`pnpm test` is a Node unit test. It does not need a simulator, Supabase, or the backend.

## Shipping JS without a new binary

Use Expo Update for JS/asset-only fixes. After the one-time link in [SETUP_GUIDE.md](./SETUP_GUIDE.md#over-the-air-updates-eas-update):

```bash
pnpm update:preview --message "short description"
# or (production — required path for agents and humans)
pnpm update:production --message "short description"
```

`pnpm update:production` runs [`scripts/publish-production-ota.sh`](./scripts/publish-production-ota.sh). It **pins** the publish to the iOS/Android hashes in [`ota-target-runtimes.json`](./ota-target-runtimes.json) (what installed Release phones already have). Do **not** call bare `eas update --channel production` from a Cloud Agent / CI box — that machine’s fingerprint is usually different, so Expo accepts the update and phones silently ignore it.

**Whenever you install a Release binary** (local `install-ios-release.sh` / `pnpm ios:release-device`, or an EAS device build you put on a phone), update [`ota-target-runtimes.json`](./ota-target-runtimes.json) to that binary’s fingerprints and **commit it**. The install script updates the iOS hash for you; confirm the file changed and include it in the same PR or follow-up commit. Do not leave the JSON pointing at an old install — later OTAs will publish “successfully” and phones will ignore them.

Then either publish with those pinned hashes (`pnpm update:production --message "…"`) or, only from the same tree that built the binary, `pnpm update:production --message "…" --current-fingerprint`.

If you change native deps, plugins, permissions, or the Expo SDK, bump/build a new binary instead — `runtimeVersion.policy: fingerprint` will not match the old install.

## Where to change code

- **Screens and URLs** → `src/app/`. A new file there is a new route. Do not put clients or helpers in this folder.
- **Supabase session** → `src/auth/`. Screens call `useAuth()`.
- **Supabase client or FastAPI** → `src/lib/`.
- **Widgets that are not screens** → `src/components/`.

Do not import `frontend/packages/ui` or `frontend/packages/auth`. Those packages use the DOM and Vite env vars. Share the Supabase project and the FastAPI contract, not the components.

Do not add an `ios/` or `android/` directory by hand. Expo generates them. The repository-root `android/` app is the Kotlin client and is a different project.

## Branches & PRs

Follow monorepo [../CONTRIBUTING.md](../CONTRIBUTING.md) (`feature/*`, `bugs/*`, `chore/*`). Do not push to `main` / `stage` unless you own releases.
