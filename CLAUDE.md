# word2anki - Development Guide

## Development Process

**Document as you go.** Updating documentation is part of completing any change — not a separate cleanup step. When you make a code change, update the relevant docs (this file, `PROGRESS.md`, `FUTURE_FEATURES.md`) in the same commit. We should never have to come back and clean up docs afterwards.

## Project Overview

word2anki is a native Android app that helps users create Anki flashcards from AI-generated vocabulary definitions. It integrates with AnkiDroid via its ContentProvider API and uses Google's Gemini API for generating definitions.

**Key Value Proposition:** User pastes a word or sentence → AI generates definition/breakdown → User taps to add as Anki flashcard.

## Tech Stack

- **Language:** Kotlin
- **UI:** Jetpack Compose with Material 3
- **Architecture:** MVVM with ViewModels
- **AI:** Google Gemini API (`com.google.ai.client.generativeai`)
- **Anki Integration:** AnkiDroid ContentProvider API
- **State:** Kotlin StateFlow / Compose State
- **Persistence:** DataStore Preferences (for settings/API keys)
- **Build:** Gradle with Kotlin DSL, version catalog

## Project Structure

```
word2anki/
├── app/
│   ├── build.gradle.kts              # App-level build config
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── kotlin/com/word2anki/
│       │   │   ├── MainActivity.kt       # Entry point, navigation
│       │   │   ├── Word2AnkiApp.kt       # Application class
│       │   │   ├── ui/
│       │   │   │   ├── theme/            # Material 3 theming
│       │   │   │   ├── screens/          # ChatScreen, SettingsScreen
│       │   │   │   └── components/       # Reusable UI components
│       │   │   ├── data/
│       │   │   │   ├── AnkiRepository.kt     # AnkiDroid ContentProvider wrapper
│       │   │   │   ├── SettingsRepository.kt # DataStore operations
│       │   │   │   ├── FlashCardsContract.kt # AnkiDroid URI constants
│       │   │   │   └── models/               # Data classes
│       │   │   ├── ai/
│       │   │   │   ├── GeminiService.kt      # Gemini API client
│       │   │   │   ├── PromptTemplates.kt    # System prompts
│       │   │   │   └── CardExtractor.kt      # Extract card data from responses
│       │   │   └── viewmodel/
│       │   │       ├── ChatViewModel.kt
│       │   │       └── SettingsViewModel.kt
│       │   └── res/                  # Android resources
│       └── test/                     # Unit tests
├── gradle/
│   └── libs.versions.toml            # Version catalog
├── build.gradle.kts                  # Root build config
└── settings.gradle.kts
```

## Key Components

### AnkiDroid Integration

The app communicates with AnkiDroid via ContentProvider. Key files:

- `FlashCardsContract.kt`: URI constants for AnkiDroid API
- `AnkiRepository.kt`: CRUD operations for decks and notes

Required permission: `com.ichi2.anki.permission.READ_WRITE_DATABASE`

### AI Integration

- `GeminiService.kt`: Handles streaming responses from Gemini API with multi-turn conversation context
- `PromptTemplates.kt`: Contains prompts for different input types:
  - Single word → Word definition
  - Multi-word → Sentence analysis
  - **highlighted** words → Focused word analysis
- `CardExtractor.kt`: Parses AI responses to extract flashcard data (split into focused helpers: `extractWord`, `extractDefinition`, `extractExample`)

### State Management

- ViewModels expose `StateFlow` for UI state
- One-shot events (snackbars, save confirmations) use `Channel<String>` — NOT StateFlow, which replays on recomposition
- All state mutations use `_uiState.update { it.copy(...) }` for atomic read-modify-write (prevents race conditions during concurrent coroutine updates)
- Settings persisted in DataStore Preferences
- Chat messages are in-memory only (no persistence)

## Local Development Setup

### Prerequisites

1. **Android Studio** (Arctic Fox or later recommended)
   - Download from: https://developer.android.com/studio

2. **JDK 17** (included with Android Studio, or install separately)

3. **Android SDK** (API 34)
   - Open Android Studio → Settings → SDK Manager
   - Install "Android 14 (API 34)"

4. **An Android device or emulator**
   - Physical device with USB debugging enabled, OR
   - Android Emulator (API 26+)

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd word2anki

# 2. Open in Android Studio
#    File → Open → Select the word2anki folder

# 3. Wait for Gradle sync to complete

# 4. Run the app
#    Click the green "Run" button, or:
./gradlew installDebug

# 5. On first run, configure your Gemini API key in Settings
```

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key
5. In the word2anki app, go to Settings and paste the key

### Setting Up AnkiDroid for Testing

1. Install AnkiDroid from [Play Store](https://play.google.com/store/apps/details?id=com.ichi2.anki) or [F-Droid](https://f-droid.org/packages/com.ichi2.anki/)
2. Open AnkiDroid and create a deck:
   - Tap the "+" button
   - Select "Create deck"
   - Name it (e.g., "Test Vocabulary")
3. When you first run word2anki, it will request permission to access AnkiDroid - grant it

### Development Commands

```bash
# Build debug APK
./gradlew assembleDebug

# Build and install on connected device
./gradlew installDebug

# Run all unit tests
./gradlew test

# Run tests with detailed output
./gradlew test --info

# Generate test report
./gradlew test
# Report at: app/build/reports/tests/testDebugUnitTest/index.html

# Lint check
./gradlew lint

# Clean build
./gradlew clean

# Build release APK (unsigned)
./gradlew assembleRelease

# List connected devices
adb devices

# View app logs
adb logcat | grep -i word2anki

# Uninstall the app
adb uninstall com.word2anki
```

### Testing Without AnkiDroid

The app can run without AnkiDroid installed:
- AI definitions will work normally
- A warning banner will show "AnkiDroid not installed"
- The "Add to Anki" button will be disabled

This is useful for testing the AI/UI portions without the full AnkiDroid setup.

### Testing with Android Emulator

#### GUI Method (Android Studio)
1. In Android Studio: Tools → Device Manager
2. Click "Create Device"
3. Select a device (e.g., Pixel 6)
4. Select a system image (API 34 recommended)
5. Click "Finish"
6. Start the emulator and run the app

#### Headless Emulator (SSH/CLI)

For testing without a display (e.g., over SSH):

```bash
# Set up environment
export ANDROID_HOME=~/Android/Sdk

# Create AVD (one-time setup)
echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
  -n Pixel_7a -k "system-images;android-34;google_apis;x86_64" -d pixel_7

# Start emulator headless (requires KVM)
$ANDROID_HOME/emulator/emulator -avd Pixel_7a \
  -no-window -no-audio -gpu swiftshader_indirect &

# Wait for boot
$ANDROID_HOME/platform-tools/adb wait-for-device
$ANDROID_HOME/platform-tools/adb shell getprop sys.boot_completed  # should return "1"

# Install and launch app
$ANDROID_HOME/platform-tools/adb install app/build/outputs/apk/debug/app-debug.apk
$ANDROID_HOME/platform-tools/adb shell am start -n com.word2anki/.MainActivity
```

**UI Interaction via ADB:**
```bash
# Inspect UI elements (preferred over screenshots for automation)
adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml

# Tap coordinates (get from uiautomator bounds)
adb shell input tap <x> <y>

# Type text (use %s for spaces)
adb shell input text "hello%sworld"

# Navigate back
adb shell input keyevent KEYCODE_BACK

# Take screenshot
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png

# View logs
adb logcat -d -t 50 *:E | grep -i word2anki
```

**Important notes for headless emulator interaction:**
- Jetpack Compose elements often don't appear in `uiautomator dump`. Use TAB/ENTER keyboard navigation as a fallback.
- AnkiDroid onboarding requires: toggle "All files access" switch → system settings page → toggle → back
- The emulator needs KVM for acceptable performance

**AnkiDroid Setup on Emulator:**
1. Download AnkiDroid APK from [GitHub Releases](https://github.com/ankidroid/Anki-Android/releases)
2. Install: `adb install AnkiDroid-*.apk`
3. Launch and complete onboarding (grant "All files access" permission)
4. Create at least one deck via the FAB (+) button → "Create deck"

### Debugging Tips

**View Logs:**
```bash
# All logs from the app
adb logcat *:S word2anki:V

# Filter for errors only
adb logcat *:E | grep -i word2anki
```

**Network Debugging:**
- Check if API key is valid in Settings
- Gemini API requires internet connection
- Check Android Studio's "Logcat" for network errors

**AnkiDroid Integration Issues:**
- Ensure AnkiDroid is installed and has at least one deck
- Check that permission was granted
- Verify with: Settings → Apps → word2anki → Permissions

## Configuration

### API Key Setup

Users must provide their own Gemini API key:
1. Get key from [Google AI Studio](https://aistudio.google.com/)
2. Open app → Settings → Enter API key
3. Key is stored securely in DataStore

### AnkiDroid Setup

1. Install AnkiDroid from Play Store
2. Create at least one deck
3. Grant permission when prompted by word2anki

## Testing

### Unit Tests (95 tests, 7 test classes)

Located in `app/src/test/kotlin/com/word2anki/`

- `ai/PromptTemplatesTest.kt` (23 tests): Prompt type detection, template content
- `ai/CardExtractorTest.kt` (24 tests): JSON extraction, heuristic fallback, helper functions
- `viewmodel/ChatViewModelTest.kt` (12 tests): Error formatting, message handling
- `viewmodel/SettingsViewModelTest.kt` (8 tests): API key validation
- `data/ModelsTest.kt` (9 tests): CardPreview, Deck, Settings, MessageRole
- `data/models/MessageTest.kt` (9 tests): Message ID, timestamp, isError, isStreaming, cardPreview
- `ui/MarkdownTextTest.kt` (10 tests): Markdown parsing and rendering

### Manual Testing Checklist

- [ ] App launches without API key (shows setup prompt)
- [ ] API key can be entered and saved
- [ ] Single word generates definition
- [ ] Sentence generates breakdown
- [ ] Highlighted words (**word**) are recognized
- [ ] Card preview appears after AI response
- [ ] Card can be added to AnkiDroid
- [ ] Duplicate detection works
- [ ] Share intent receives text from other apps
- [ ] Dark mode works correctly

## Architecture Decisions

1. **MVVM Pattern**: Clean separation of UI and business logic
2. **StateFlow over LiveData**: Better Kotlin integration, null safety
3. **Channel for one-shot events**: Snackbar messages use `Channel<String>` to avoid replay on recomposition
4. **Atomic state updates**: Always use `_uiState.update {}` (never `.value = .value.copy()`) to prevent race conditions
5. **Layer boundaries**: UI layer never imports AI or data layer directly — all communication through ViewModels
6. **No Dependency Injection**: App is small enough; manual DI is sufficient
7. **ContentProvider for Anki**: Official AnkiDroid API, most stable integration
8. **DataStore over SharedPreferences**: Modern, type-safe, coroutine-friendly
9. **Custom note model**: App creates/reuses a "word2anki" 4-field model (English, Bangla, ExampleSentence, SentenceTranslation) with fallback to Basic model

## Known Limitations

- No offline mode (requires internet for Gemini API)
- No chat history persistence (messages cleared on app close)
- No image support in cards

## Future Improvements

See `FUTURE_FEATURES.md` for detailed specs. Key items:

- [ ] Chat history persistence (Room database)
- [ ] On-device AI models (Gemma 3n)
- [ ] Audio pronunciation
- [ ] Word highlighting via long-press
- [ ] `ACTION_PROCESS_TEXT` for text selection toolbar
- [ ] Target language configuration
