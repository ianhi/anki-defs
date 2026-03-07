# Android App (word2anki)

Android backend for the vocabulary flashcard tool. Integrates with AnkiDroid via
ContentProvider API and uses Gemini for AI definitions. The UI is a WebView loading
the shared React frontend from a local NanoHTTPd server.

See root [CLAUDE.md](../CLAUDE.md) for project-wide architecture.

## Tech Stack

- Kotlin, WebView (loads React frontend from local HTTP server)
- NanoHTTPd local server implementing the same API contract as server/
- Google Gemini API (`com.google.ai.client.generativeai`)
- AnkiDroid ContentProvider API for flashcard CRUD
- Kotlin StateFlow for state, DataStore for persistence
- Gradle with Kotlin DSL, version catalog (`gradle/libs.versions.toml`)

## Patterns

- **WebView + NanoHTTPd**: MainActivity hosts a WebView pointing at `localhost:18765`. The NanoHTTPd server serves the React frontend from `assets/www/` and implements `/api/*` endpoints.
- **JS Bridge**: `AndroidBridge` class exposes `requestAnkiPermission()`, `isAnkiInstalled()`, `hasAnkiPermission()` to frontend JS via `window.Android`.
- **Share intents**: `ACTION_SEND` and `ACTION_PROCESS_TEXT` intents dispatch a `sharedText` CustomEvent to the WebView.
- **Asset bundling**: Gradle tasks `buildFrontend` and `copyFrontendAssets` build the React frontend and copy `client/dist/` into `assets/www/` before each build.
- **No DI framework**: Manual dependency injection (app is small)
- **ContentProvider for Anki**: Official AnkiDroid API, most stable integration

## Build & Test

```bash
cd android
export ANDROID_HOME=~/Android/Sdk
export JAVA_HOME=/usr

./gradlew assembleDebug      # Build debug APK (also builds React frontend)
./gradlew installDebug       # Install on connected device/emulator
./gradlew test               # Run unit tests
./gradlew lint               # Lint check
```

### Prerequisites

- Android SDK (API 34)
- JDK 17 (bundled with Android Studio, or system JDK)
- Node.js + npm (for building the React frontend)
- Device or emulator (API 26+)

### Debugging

```bash
adb logcat *:S word2anki:V     # App logs
adb logcat *:E | grep word2anki  # Errors only
```

## Boundaries

- **You own**: `android/` (Kotlin Android app)
- **You implement**: The same API contract defined in `shared/types.ts`
- **You do NOT touch**: `client/`, `server/`, `shared/`
- If you need an API contract change, note it clearly in your output.

See `DOCS/` for file map and implementation details.
See `PLANNING/` for upcoming work and design proposals.
