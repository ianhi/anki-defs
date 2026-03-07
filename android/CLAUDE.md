# Android App (word2anki)

Android backend for the vocabulary flashcard tool. Integrates with AnkiDroid via
ContentProvider API and uses Gemini for AI definitions.

See root [CLAUDE.md](../CLAUDE.md) for project-wide architecture and API contract.

## Tech Stack

- Kotlin, Jetpack Compose (Material 3), MVVM with ViewModels
- Google Gemini API (`com.google.ai.client.generativeai`)
- AnkiDroid ContentProvider API for flashcard CRUD
- Kotlin StateFlow for state, DataStore for persistence
- Gradle with Kotlin DSL, version catalog (`gradle/libs.versions.toml`)

## Key Files

- `app/src/main/kotlin/com/word2anki/MainActivity.kt` -- Entry point, navigation
- `app/src/main/kotlin/com/word2anki/ai/GeminiService.kt` -- Gemini streaming + multi-turn context
- `app/src/main/kotlin/com/word2anki/ai/PromptTemplates.kt` -- Prompt type detection + templates
- `app/src/main/kotlin/com/word2anki/ai/CardExtractor.kt` -- Parse AI responses into card data
- `app/src/main/kotlin/com/word2anki/data/AnkiRepository.kt` -- AnkiDroid ContentProvider wrapper
- `app/src/main/kotlin/com/word2anki/data/SettingsRepository.kt` -- DataStore operations
- `app/src/main/kotlin/com/word2anki/data/FlashCardsContract.kt` -- AnkiDroid URI constants
- `app/src/main/kotlin/com/word2anki/viewmodel/ChatViewModel.kt` -- Chat logic + state
- `app/src/main/kotlin/com/word2anki/viewmodel/SettingsViewModel.kt` -- Settings logic
- `app/src/main/kotlin/com/word2anki/ui/screens/` -- ChatScreen, SettingsScreen
- `app/build.gradle.kts` -- App build config, dependencies

## Architecture Patterns

- **MVVM**: UI layer never imports AI or data layer directly -- all through ViewModels
- **StateFlow**: Use `_uiState.update { it.copy(...) }` for atomic state (never `.value = .value.copy()`)
- **Channel for one-shot events**: Snackbars use `Channel<String>`, NOT StateFlow (avoids replay)
- **No DI framework**: App is small enough for manual dependency injection
- **ContentProvider for Anki**: Official AnkiDroid API, most stable integration
- **Custom note model**: "word2anki" 4-field model (English, Bangla, ExampleSentence, SentenceTranslation)

## Build & Test

```bash
cd android
export ANDROID_HOME=~/Android/Sdk
export JAVA_HOME=/usr

./gradlew assembleDebug      # Build debug APK
./gradlew installDebug       # Install on connected device/emulator
./gradlew test               # Run unit tests (95 tests, 7 test classes)
./gradlew lint               # Lint check
```

### Prerequisites

- Android SDK (API 34): `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-34"`
- JDK 17 (bundled with Android Studio, or system JDK)
- Device or emulator (API 26+)

### Headless Emulator (SSH/CLI)

```bash
echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
  -n Pixel_7a -k "system-images;android-34;google_apis;x86_64" -d pixel_7
$ANDROID_HOME/emulator/emulator -avd Pixel_7a -no-window -no-audio -gpu swiftshader_indirect &
adb wait-for-device && adb shell getprop sys.boot_completed  # should return "1"
```

Compose elements often don't appear in `uiautomator dump` -- use TAB/ENTER keyboard navigation as fallback.

### Debugging

```bash
adb logcat *:S word2anki:V     # App logs
adb logcat *:E | grep word2anki  # Errors only
```

## Unit Tests

Located in `app/src/test/kotlin/com/word2anki/`:

- `ai/PromptTemplatesTest.kt` (23 tests), `ai/CardExtractorTest.kt` (24 tests)
- `viewmodel/ChatViewModelTest.kt` (12), `viewmodel/SettingsViewModelTest.kt` (8)
- `data/ModelsTest.kt` (9), `data/models/MessageTest.kt` (9), `ui/MarkdownTextTest.kt` (10)

## Boundaries

- **You own**: `android/` (Kotlin Android app)
- **You implement**: The same API contract defined in `shared/types.ts`
- **You do NOT touch**: `client/`, `server/`, `shared/`
- If you need an API contract change, note it clearly in your output.

See root [`FUTURE_FEATURES.md`](../FUTURE_FEATURES.md) for planned features.
