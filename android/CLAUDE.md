# Android App (word2anki)

Android backend for the vocabulary flashcard tool. Integrates with AnkiDroid via
ContentProvider API and uses Gemini for AI definitions.

See root [CLAUDE.md](../CLAUDE.md) for project-wide architecture.

## Tech Stack

- Kotlin, Jetpack Compose (Material 3), MVVM with ViewModels
- Google Gemini API (`com.google.ai.client.generativeai`)
- AnkiDroid ContentProvider API for flashcard CRUD
- Kotlin StateFlow for state, DataStore for persistence
- Gradle with Kotlin DSL, version catalog (`gradle/libs.versions.toml`)

## Patterns

- **MVVM**: UI layer never imports AI or data layer directly -- all through ViewModels
- **StateFlow**: Use `_uiState.update { it.copy(...) }` for atomic state (never `.value = .value.copy()`)
- **Channel for one-shot events**: Snackbars use `Channel<String>`, NOT StateFlow (avoids replay)
- **No DI framework**: Manual dependency injection (app is small)
- **ContentProvider for Anki**: Official AnkiDroid API, most stable integration

## Build & Test

```bash
cd android
export ANDROID_HOME=~/Android/Sdk
export JAVA_HOME=/usr

./gradlew assembleDebug      # Build debug APK
./gradlew installDebug       # Install on connected device/emulator
./gradlew test               # Run unit tests
./gradlew lint               # Lint check
```

### Prerequisites

- Android SDK (API 34)
- JDK 17 (bundled with Android Studio, or system JDK)
- Device or emulator (API 26+)

### Headless Emulator (SSH/CLI)

```bash
echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
  -n Pixel_7a -k "system-images;android-34;google_apis;x86_64" -d pixel_7
$ANDROID_HOME/emulator/emulator -avd Pixel_7a -no-window -no-audio -gpu swiftshader_indirect &
adb wait-for-device && adb shell getprop sys.boot_completed
```

Compose elements often don't appear in `uiautomator dump` -- use TAB/ENTER keyboard nav as fallback.

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
