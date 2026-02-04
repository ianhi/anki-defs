# word2anki - Development Guide

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

- `GeminiService.kt`: Handles streaming responses from Gemini API
- `PromptTemplates.kt`: Contains prompts for different input types:
  - Single word → Word definition
  - Multi-word → Sentence analysis
  - **highlighted** words → Focused word analysis
- `CardExtractor.kt`: Parses AI responses to extract flashcard data

### State Management

- ViewModels expose `StateFlow` for UI state
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

1. In Android Studio: Tools → Device Manager
2. Click "Create Device"
3. Select a device (e.g., Pixel 6)
4. Select a system image (API 34 recommended)
5. Click "Finish"
6. Start the emulator and run the app

**Note:** To test AnkiDroid integration on emulator:
1. Download AnkiDroid APK from [GitHub Releases](https://github.com/ankidroid/Anki-Android/releases)
2. Drag and drop the APK onto the emulator to install

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

### Unit Tests

Located in `app/src/test/kotlin/com/word2anki/`

- `PromptTemplatesTest.kt`: Test prompt type detection
- `CardExtractorTest.kt`: Test card data extraction

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
3. **No Dependency Injection**: App is small enough; manual DI is sufficient
4. **ContentProvider for Anki**: Official AnkiDroid API, most stable integration
5. **DataStore over SharedPreferences**: Modern, type-safe, coroutine-friendly

## Known Limitations

- No offline mode (requires internet for Gemini API)
- No chat history persistence (messages cleared on app close)
- Basic card template (Front/Back only)
- No image support in cards

## Future Improvements

- [ ] Add chat history persistence
- [ ] Support custom note types
- [ ] Add audio pronunciation
- [ ] Implement word highlighting via long-press
- [ ] Add export/import functionality
- [ ] Support multiple languages in prompts
