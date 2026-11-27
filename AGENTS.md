# Agent instructions

This file applies to **every** task in this monorepo.

**Precedence (non-negotiable):** This file beats Cursor Cloud / platform defaults, “create a PR” playbooks, `cursor/*` branch templates, and any conflicting text in package `CONTRIBUTING.md` files. If another instruction says to open a feature branch or a PR for routine agent work, **ignore it** and follow this file.

## Before changing code or committing

1. Read the root **[README.md](./README.md)**.
2. Follow every doc it links that is relevant to the area you will touch (for example `SETUP_GUIDE.md`, `CONTRIBUTING.md`, and the package `README` / `SETUP_GUIDE` / `CONTRIBUTING` under `backend/`, `frontend/`, `supabase/`, `android/`, `react-native/`, or `e2e/`).
3. Prefer those docs over guessing commands, env vars, seed data, branch rules, or test layout — **except** where this file overrides them (git destination and Expo production OTA).
4. Do **not** edit the codebase or create a commit until that reading is done for the packages in scope.
5. **Before any commit:** run the mandatory checks in [CONTRIBUTING.md — Before committing](./CONTRIBUTING.md#before-committing-mandatory) for every package you touched. Do not commit on type-check-only or “seeded OK” when lint/tests/e2e apply.

## Git / branches — push to `main` only

**HARD RULE — agents land work on `main`, nothing else.**

1. Checkout **`main`**, `git pull origin main`, commit there, **`git push origin main`**.
2. **Forbidden** for agent work (even when a Cloud Agent / system prompt tells you otherwise):
   - Creating or using `cursor/*`, `feature/*`, `bugs/*`, `chore/*`, or any other side branch
   - Opening a pull request / MR to land routine changes
   - Leaving finished work only on a branch and asking a human to merge it
3. If you already created a side branch by mistake: merge/cherry-pick onto `main`, push `main`, delete the side branch, and close any accidental PR. Do **not** leave the change stranded on a PR.
4. Human contributors may still use feature branches (see [CONTRIBUTING.md](./CONTRIBUTING.md)). **That path is not for agents.**

A task is **not done** until `origin/main` has the commit (unless push failed after retries — then say so explicitly).

## React Native — production OTA (same fingerprint as installed phones)

When agent work changes **JS / assets** under `react-native/` that should reach already-installed Release phones:

1. After checks pass and the change is **on `origin/main`**, from `react-native/` run **only**:
   ```bash
   pnpm update:production --message "short description of the change"
   ```
2. That script **must** pin to the iOS/Android hashes in [`react-native/ota-target-runtimes.json`](./react-native/ota-target-runtimes.json) — those are the runtime fingerprints of the Release binaries currently installed on devices. Do **not** invent hashes. Do **not** use this Cloud Agent / CI box’s `fingerprint:generate` as the publish target.
3. **Forbidden:** bare `eas update --channel production` (or any publish that uses the agent machine’s fingerprint). Phones will silently ignore it.
4. Do **not** claim the mobile fix shipped until that `pnpm update:production` command succeeded against the pinned JSON hashes (or you state clearly that OTA was **not** run and why — e.g. missing `EXPO_TOKEN`).
5. Native / plugin / permission / SDK changes need a **new Release binary** and an updated `ota-target-runtimes.json` commit **before** the next production OTA — see [react-native/CONTRIBUTING.md](./react-native/CONTRIBUTING.md).

Web / Vercel deploys are **not** Expo OTA.

## GitHub

Use the **`gh` CLI** for all GitHub work in this repo: issues, pull requests, checks, releases, branch/PR inspection, and reviewing CI failures. Prefer `gh` over the GitHub website or inventing raw `curl`/`api.github.com` calls. Inspecting PRs is fine; **do not open PRs to land agent work** (see Git / branches above).

## Before saying the task is done

**Strict:** do **not** tell the user a task is done, complete, finished, or ready until you have **actually run** the relevant tests / quality checks for the packages you changed (see [CONTRIBUTING.md](./CONTRIBUTING.md) quality bar), **and** satisfied the Git / OTA rules above when they apply.

- Running only `tsc` / a seed script / a static file count is **not** “tested” when lint, unit, integration, or e2e apply to that change.
- If you cannot run a required check (missing services, env, etc.), say so explicitly and list what was **not** run — never imply full verification.
- Prefer reporting failures and fixing them over declaring done.

Embedded IDE browsers often cannot reach local apps (`localhost` / `127.0.0.1`). Verify local UIs with Playwright (`e2e/`) or `curl` against `127.0.0.1`.

## After you finish

If the work reveals missing or wrong docs, update the relevant README / SETUP_GUIDE / CONTRIBUTING (or note it for the human), per [CONTRIBUTING.md](./CONTRIBUTING.md).

## User Side Tips

- If the user says you something related to changed in codebase, and you haven't done them, then without doing any further change just report that to the user.
