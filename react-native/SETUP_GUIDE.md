# React Native setup

Repo-wide order: [../SETUP_GUIDE.md](../SETUP_GUIDE.md). This app calls the same Supabase project and FastAPI server as the web app and the Kotlin app. Start those first.

Lint, type-check, and the host-rewrite unit test need only Node.js and pnpm. A simulator is for running the UI.

## Prerequisites

| Tool | When you need it | How |
| --- | --- | --- |
| Node.js ≥ 22.13 | Always | `brew install node` if `node -v` is older |
| pnpm 11.17 | Always | Same pin as `frontend/`. This package's `packageManager` field asks for 11.17.0 |
| Xcode 26.4 or newer | iOS simulator | Mac App Store, not Homebrew. Then Xcode → Settings → Locations → Command Line Tools, and Settings → Components → iOS simulator |
| JDK 17 | Android emulator or a native Android build | `brew install --cask zulu@17` if `java -version` is not already 17. Set `JAVA_HOME` to that JDK |
| Android Studio | Android emulator | `brew install --cask android-studio` |

Watchman is not required on Expo SDK 56 or newer. CocoaPods is not required. Expo compiles iOS with the Xcode project it generates.

### Android SDK

Android Studio's default SDK location is `$HOME/Library/Android/sdk`. The Kotlin app's guide installs a command-line SDK at `$HOME/android-sdk`. Use one SDK, and point `ANDROID_HOME` at it. That SDK needs:

- Android SDK Platform 37 (Expo SDK 58 `compileSdkVersion`)
- Android SDK Build-Tools
- Android Emulator, plus one virtual device
- Android SDK Platform-Tools (`adb`)

Add this to `~/.zshrc`, using the path of the SDK you actually have:

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$JAVA_HOME/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

If your JDK or SDK lives somewhere else, change those two paths. `adb` should run in a new terminal.

Expo web (`pnpm web`) does not need Xcode or Android Studio.

## App configuration

```bash
cd react-native
pnpm install
cp .env.example .env
```

Set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `supabase/.env`. Keep the service-role key out of this file.

The mics on **Lifts** (next to Add a set) and **Diet** (between Add food and View Catalog) need the `add_set_from_voice` / `add_intake_from_voice` Edge Functions and `OPENAI_API_KEY` in `supabase/.env` (see [../supabase/SETUP_GUIDE.md](../supabase/SETUP_GUIDE.md)). Microphone permission is configured via the `expo-audio` plugin in `app.json`. After adding that native module, use a development build (`pnpm ios` / `pnpm android`), not Expo Go alone if the module is missing there.

| Where the app runs | Host in `.env` |
| --- | --- |
| iOS simulator, Expo web | `127.0.0.1` (the example file) |
| Android emulator | `127.0.0.1` is fine. The app rewrites it to `10.0.2.2` on Android only |
| Physical phone on the same network | This computer's LAN address, in both URL variables |

Local Supabase and FastAPI are `http://`. The app config allows cleartext traffic on Android and local networking on iOS so a development build can reach them. Expo Go uses its own network settings.

## Commands

From `react-native/`:

```bash
pnpm start
pnpm ios
pnpm android
pnpm web
```

`pnpm start` opens Metro. From that terminal, press `i` for the iOS simulator, `a` for the Android emulator, or `w` for the browser. Expo web listens on port **8081**. Vite stays on `5173`. FastAPI stays on `8080`.

## Over-the-air updates (EAS Update)

JS and asset changes can ship to an already-installed iOS/Android binary without a store reinstall. Native module, permission, or Expo SDK changes still need a new binary.

Repo config is already in place (`expo-updates`, `eas.json` `preview` / `production` channels, `runtimeVersion.policy: fingerprint`). You still need an Expo project link before the first publish — `updates.url` and `extra.eas.projectId` are written by `eas update:configure`.

### One-time external setup (you)

1. Create or sign in to an [Expo account](https://expo.dev/signup).
2. From `react-native/`, authenticate EAS CLI:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init --non-interactive
   pnpm update:configure
   ```

   That writes `extra.eas.projectId` and `updates.url` into `app.json`. Commit those two fields.
3. Build a binary that includes that config (simulator preview is enough to try OTA):

   ```bash
   npx eas-cli@latest build --platform ios --profile preview
   ```

   Device / App Store builds need an Apple Developer Program membership and interactive credential prompts the first time.
4. Publish a JS update:

   ```bash
   pnpm update:preview -- --message "describe the change"
   ```

   Force-quit and reopen the preview build up to twice to download and apply it.

### So a Cloud Agent can finish linking / publishing

There is no Expo MCP connector in this environment. Add an Expo access token as a Cursor Cloud Agent **environment secret** named `EXPO_TOKEN` ([create a token](https://expo.dev/accounts/[account]/settings/access-tokens)). With that secret present, an agent can run `eas init`, `eas update:configure`, `eas update`, and non-interactive builds without `eas login`. Do not paste the token into chat.

## Verify: login → Hello

With Supabase and the backend already running:

1. Start this app and open one target (`i`, `a`, or `w`).
2. Sign in with a seeded user:

   | Email | Password |
   | --- | --- |
   | `seed_user@gmail.com` | `password123` |
   | `test@example.com` | `password123` |

3. On the home screen, press **Hello**.
4. You should see JSON like:

   ```json
   {
     "message": "hello",
     "authenticated": true,
     "user": { "id": "...", "email": "seed_user@gmail.com" }
   }
   ```

If Hello fails with a network error on the Android emulator, confirm the backend is on port `8080` and `DEPLOYMENT_ENV=LOCAL` in `backend/.env`. A physical phone cannot use `127.0.0.1`.
