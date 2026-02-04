# word2anki - Android App Development Prompt

## Project Overview

Build a native Android app called **word2anki** that helps users create Anki flashcards from AI-generated vocabulary definitions. The app integrates directly with AnkiDroid via its ContentProvider API and uses Google's Gemini API for generating definitions.

**Key value proposition:** User pastes a word or sentence → AI generates definition/breakdown → User taps to add as Anki flashcard.

## Technical Stack

- **Language:** Kotlin
- **UI:** Jetpack Compose with Material 3
- **Architecture:** MVVM with ViewModels
- **AI:** Google Gemini API (`com.google.ai.client.generativeai`)
- **Anki Integration:** AnkiDroid ContentProvider API + Instant-Add API
- **State:** Kotlin StateFlow / Compose State
- **Persistence:** DataStore Preferences (for settings/API keys)
- **Build:** Gradle with Kotlin DSL, version catalog

## Project Structure

```
word2anki/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── kotlin/com/word2anki/
│       │   ├── MainActivity.kt
│       │   ├── Word2AnkiApp.kt              # Application class
│       │   │
│       │   ├── ui/
│       │   │   ├── theme/
│       │   │   │   ├── Theme.kt
│       │   │   │   ├── Color.kt
│       │   │   │   └── Type.kt
│       │   │   ├── screens/
│       │   │   │   ├── ChatScreen.kt        # Main chat interface
│       │   │   │   └── SettingsScreen.kt    # API key, default deck
│       │   │   └── components/
│       │   │       ├── MessageBubble.kt     # Chat message display
│       │   │       ├── MessageInput.kt      # Text input field
│       │   │       ├── DeckSelector.kt      # Dropdown for deck selection
│       │   │       ├── CardPreview.kt       # Preview before adding to Anki
│       │   │       └── StreamingText.kt     # Animated streaming response
│       │   │
│       │   ├── data/
│       │   │   ├── AnkiRepository.kt        # ContentProvider wrapper
│       │   │   ├── SettingsRepository.kt    # DataStore operations
│       │   │   ├── FlashCardsContract.kt    # AnkiDroid URI constants
│       │   │   └── models/
│       │   │       ├── Message.kt
│       │   │       ├── CardPreview.kt
│       │   │       ├── Deck.kt
│       │   │       └── Settings.kt
│       │   │
│       │   ├── ai/
│       │   │   ├── GeminiService.kt         # Gemini API client
│       │   │   ├── PromptTemplates.kt       # System prompts
│       │   │   └── CardExtractor.kt         # Extract card data from response
│       │   │
│       │   └── viewmodel/
│       │       ├── ChatViewModel.kt
│       │       └── SettingsViewModel.kt
│       │
│       └── res/
│           ├── values/strings.xml
│           └── ...
│
├── gradle/libs.versions.toml
├── build.gradle.kts
└── settings.gradle.kts
```

## AndroidManifest.xml Requirements

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="com.ichi2.anki.permission.READ_WRITE_DATABASE"/>

    <!-- Required for Android 11+ to query AnkiDroid -->
    <queries>
        <package android:name="com.ichi2.anki"/>
        <package android:name="com.ichi2.anki.debug"/>
    </queries>

    <application
        android:name=".Word2AnkiApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.Word2Anki">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
            <!-- Allow sharing text to app -->
            <intent-filter>
                <action android:name="android.intent.action.SEND"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <data android:mimeType="text/plain"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
```

## Key Dependencies (libs.versions.toml)

```toml
[versions]
agp = "8.2.2"
kotlin = "1.9.22"
compose-bom = "2024.02.00"
compose-compiler = "1.5.8"
core-ktx = "1.12.0"
lifecycle = "2.7.0"
activity-compose = "1.8.2"
navigation = "2.7.7"
datastore = "1.0.0"
gemini = "0.9.0"

[libraries]
core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "core-ktx" }
lifecycle-runtime = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycle" }
lifecycle-viewmodel = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activity-compose" }

compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
compose-icons = { group = "androidx.compose.material", name = "material-icons-extended" }

navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }
datastore = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }

gemini = { group = "com.google.ai.client.generativeai", name = "generativeai", version.ref = "gemini" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
```

## AnkiDroid API Integration

### FlashCardsContract.kt - URI Constants

```kotlin
object FlashCardsContract {
    const val AUTHORITY = "com.ichi2.anki.flashcards"

    object Note {
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/notes")
        const val _ID = "_id"
        const val MID = "mid"           // Model ID
        const val FLDS = "flds"         // Fields (separated by \u001f)
        const val TAGS = "tags"
        const val SFLD = "sfld"         // Sort field
    }

    object Deck {
        val CONTENT_ALL_URI: Uri = Uri.parse("content://$AUTHORITY/decks")
        const val DECK_NAME = "deck_name"
        const val DECK_ID = "deck_id"
        const val DECK_COUNTS = "deck_counts"
    }

    object Model {
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/models")
        const val _ID = "_id"
        const val NAME = "name"
        const val FIELD_NAMES = "field_names"
        const val NUM_CARDS = "num_cards"
    }
}
```

### AnkiRepository.kt - Key Operations

```kotlin
class AnkiRepository(private val context: Context) {
    private val contentResolver = context.contentResolver

    fun isAnkiDroidInstalled(): Boolean {
        return context.packageManager.resolveContentProvider(
            FlashCardsContract.AUTHORITY, 0
        ) != null
    }

    suspend fun getDecks(): List<Deck> = withContext(Dispatchers.IO) {
        val cursor = contentResolver.query(
            FlashCardsContract.Deck.CONTENT_ALL_URI,
            null, null, null, null
        ) ?: return@withContext emptyList()

        cursor.use {
            val decks = mutableListOf<Deck>()
            while (it.moveToNext()) {
                decks.add(Deck(
                    id = it.getLong(it.getColumnIndexOrThrow(FlashCardsContract.Deck.DECK_ID)),
                    name = it.getString(it.getColumnIndexOrThrow(FlashCardsContract.Deck.DECK_NAME))
                ))
            }
            decks
        }
    }

    suspend fun noteExists(word: String, deckName: String): Boolean = withContext(Dispatchers.IO) {
        val cursor = contentResolver.query(
            FlashCardsContract.Note.CONTENT_URI,
            arrayOf(FlashCardsContract.Note._ID),
            "deck:\"$deckName\" front:*$word*",  // Anki browser search syntax
            null, null
        )
        val exists = (cursor?.count ?: 0) > 0
        cursor?.close()
        exists
    }

    suspend fun addNote(
        modelId: Long,
        deckId: Long,
        fields: List<String>
    ): Long? = withContext(Dispatchers.IO) {
        val api = AddContentApi(context)
        api.addNote(modelId, deckId, fields.toTypedArray(), null)
    }
}
```

## AI System Prompts

The app should support multiple prompt types based on input:

### Word Definition Prompt (input < 30 chars, no spaces)
```
You are a language tutor. Define the word directly and concisely.

Format:
**[word]** ([transliteration]) - [English meaning]

*[part of speech]*

**Examples:**
1. [Example sentence] — [English translation]
2. [Example sentence] — [English translation]

**Notes:** [Brief usage notes, grammar, or cultural context if relevant]

Be direct. No preamble. Start with the word itself.
```

### Sentence Analysis Prompt (multi-word input)
```
You are a language tutor. Analyze the sentence directly.

Format:
**Translation:** [English translation]

**Breakdown:**
- **[word1]** ([transliteration]) — [meaning]
- **[word2]** ([transliteration]) — [meaning]
[continue for key words]

**Grammar:** [Brief explanation of sentence structure if notable]

Be direct. No preamble. Start with the translation.
```

### Focused Words Prompt (sentence with highlighted words)
```
You are a language tutor. The user has provided a sentence and highlighted specific words they want to learn.

Format your response as:

**Sentence Translation:** [English translation]

Then for EACH highlighted word:

---
**[word]** ([transliteration]) — [meaning]

*[part of speech]*

In this sentence: [explanation of how the word is used in this specific context]

**Example:** [one additional example sentence] — [translation]

---

Be direct. No preamble. Focus on the highlighted words in the context of the given sentence.
```

### Card Extraction Prompt
```
Extract flashcard data from the conversation. Return ONLY valid JSON:
{
  "word": "the word being learned",
  "definition": "concise English definition",
  "exampleSentence": "one good example sentence",
  "sentenceTranslation": "English translation of the example"
}

Pick the best single example sentence. Keep definition under 10 words if possible.
```

## Core Features

### 1. Chat Interface
- Simple chat UI with user messages and AI responses
- Streaming text display (character by character as response comes in)
- Each AI response can generate a CardPreview
- Long-press on words in input for highlighting (wrap in **)

### 2. Card Preview & Addition
- After AI responds, show card preview if extractable
- Display: word, definition, example sentence
- "Add to Anki" button
- Show badge if card already exists in selected deck
- Confirmation feedback when added

### 3. Deck Selection
- Dropdown in header to select target deck
- Fetched from AnkiDroid via ContentProvider
- Persisted as default in settings

### 4. Settings Screen
- Gemini API key (stored securely in DataStore)
- Default deck selection
- Clear chat history

### 5. Share Intent Support
- Accept text shared from other apps
- Pre-populate input field with shared text
- Useful for quick lookups from reading apps

## Data Models

```kotlin
data class Message(
    val id: String = UUID.randomUUID().toString(),
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val cardPreview: CardPreview? = null
)

enum class MessageRole { USER, ASSISTANT }

data class CardPreview(
    val word: String,
    val definition: String,
    val exampleSentence: String,
    val sentenceTranslation: String,
    val alreadyExists: Boolean = false
)

data class Deck(
    val id: Long,
    val name: String
)

data class Settings(
    val geminiApiKey: String = "",
    val defaultDeck: String = "",
    val defaultDeckId: Long = 0
)
```

## UX Patterns

| Action | Implementation |
|--------|----------------|
| Define word | Type/paste and send |
| Analyze sentence | Type/paste longer text and send |
| Highlight specific words | Long-press to select, tap highlight button to wrap in ** |
| Add card | Tap "Add to Anki" on CardPreview |
| Quick lookup | Share text from another app |

## Permissions Flow

1. On first launch, check if AnkiDroid is installed
2. If not, show message with link to Play Store
3. Request `READ_WRITE_DATABASE` permission via runtime prompt
4. Handle permission denial gracefully

## Build Configuration

```kotlin
// app/build.gradle.kts
android {
    namespace = "com.word2anki"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.word2anki"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
}
```

## Development Phases

### Phase 1: Basic Chat + Gemini
- [ ] Project setup with Compose
- [ ] Settings screen with API key storage
- [ ] Basic chat UI (send/receive messages)
- [ ] Gemini API integration with streaming
- [ ] Prompt type detection (word vs sentence)

### Phase 2: AnkiDroid Integration
- [ ] FlashCardsContract constants
- [ ] AnkiRepository - list decks
- [ ] AnkiRepository - check note exists
- [ ] Deck selector in header
- [ ] Permission handling

### Phase 3: Card Creation
- [ ] Card extraction from AI response
- [ ] CardPreview component
- [ ] Add note to AnkiDroid
- [ ] Duplicate detection badge

### Phase 4: Polish
- [ ] Word highlighting (long-press selection)
- [ ] Share intent handling
- [ ] Error handling and retry
- [ ] Loading states
- [ ] Empty states

## Notes

- Use Material 3 dynamic color theming
- Support dark mode
- Keep UI simple and focused
- Prioritize speed of interaction (paste → define → add card)
- The app is language-agnostic; prompts work for any language
