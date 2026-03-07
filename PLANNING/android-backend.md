# Android Backend: Local HTTP Server

## Overview

Replace ViewModels + Compose UI with a local HTTP server that serves the React frontend and implements the API endpoints using existing Kotlin services.

## Technology: NanoHTTPd

- Single Java file (~3000 lines), no dependencies
- Battle-tested in Android apps (used by KDE Connect, Termux, etc.)
- Supports streaming responses (for SSE)
- Runs on a background thread, lifecycle-managed by Application class
- Dependency: `implementation("org.nanohttpd:nanohttpd:2.3.1")`

## Server Architecture

```kotlin
class LocalServer(
    private val context: Context,
    private val ankiRepository: AnkiRepository,
    private val settingsRepository: SettingsRepository,
    private val geminiServiceProvider: () -> GeminiService?
) : NanoHTTPD(PORT) {

    companion object {
        const val PORT = 8765  // or find available port
    }

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        return when {
            // Static assets (React frontend)
            !uri.startsWith("/api") -> serveAsset(uri)

            // API routes
            uri.startsWith("/api/chat") -> ChatHandler.handle(session, ...)
            uri.startsWith("/api/anki") -> AnkiHandler.handle(session, ...)
            uri.startsWith("/api/settings") -> SettingsHandler.handle(session, ...)
            uri == "/api/platform" -> servePlatformInfo()

            else -> newFixedLengthResponse(Status.NOT_FOUND, "application/json", """{"error":"not found"}""")
        }
    }
}
```

## Endpoint Mapping

### Chat Endpoints

| Endpoint                   | Web (Express)                            | Android (NanoHTTPd)                   |
| -------------------------- | ---------------------------------------- | ------------------------------------- |
| POST /api/chat/stream      | Claude/Gemini/OpenRouter streaming → SSE | GeminiService streaming → SSE         |
| POST /api/chat/define      | AI structured output                     | GeminiService with define prompt      |
| POST /api/chat/relemmatize | AI relemmatization                       | GeminiService with relemmatize prompt |

**SSE streaming in NanoHTTPd:**

```kotlin
// Return a chunked response with SSE content type
fun streamChat(session: IHTTPSession): Response {
    val pipedInput = PipedInputStream()
    val pipedOutput = PipedOutputStream(pipedInput)

    // Launch coroutine to write SSE events to pipedOutput
    scope.launch {
        geminiService.generateStreamingResponse(prompt, history) { chunk ->
            pipedOutput.write("data: ${json(SSEEvent("text", chunk))}\n\n".toByteArray())
            pipedOutput.flush()
        }
        // Send card previews, usage, done event...
        pipedOutput.close()
    }

    return newChunkedResponse(Status.OK, "text/event-stream", pipedInput)
}
```

### Anki Endpoints

| Endpoint                          | Implementation                                           |
| --------------------------------- | -------------------------------------------------------- |
| GET /api/anki/decks               | `ankiRepository.getDecks()` (already exists)             |
| GET /api/anki/models              | NEW: `ankiRepository.getModels()`                        |
| GET /api/anki/models/:name/fields | NEW: `ankiRepository.getModelFields(name)`               |
| POST /api/anki/search             | NEW: `ankiRepository.searchNotes(query)`                 |
| POST /api/anki/notes              | `ankiRepository.addNote(...)` (already exists)           |
| GET /api/anki/notes/:id           | NEW: `ankiRepository.getNote(id)`                        |
| DELETE /api/anki/notes/:id        | NEW: `ankiRepository.deleteNote(id)`                     |
| GET /api/anki/status              | `ankiRepository.isAnkiDroidInstalled()` (already exists) |

### Settings Endpoints

| Endpoint          | Implementation                                                  |
| ----------------- | --------------------------------------------------------------- |
| GET /api/settings | `settingsRepository.settingsFlow.first()` → JSON (mask API key) |
| PUT /api/settings | Parse JSON → `settingsRepository.update*()` methods             |

### Platform Endpoint

| Endpoint          | Implementation                                                 |
| ----------------- | -------------------------------------------------------------- |
| GET /api/platform | Return `{ platform: "android", ankiAvailable, hasPermission }` |

## New AnkiRepository Methods Needed

```kotlin
// These need to be added to AnkiRepository:
fun getModels(): List<NoteModel>               // Query model ContentProvider
fun getModelFields(modelName: String): List<String>  // Parse field_names from model
fun searchNotes(query: String): List<AnkiNote>  // Search notes by query
fun getNote(noteId: Long): AnkiNote?            // Get single note
fun deleteNote(noteId: Long): Boolean           // Delete note by ID
```

## Server Lifecycle

```kotlin
// Word2AnkiApp.kt (Application class)
class Word2AnkiApp : Application() {
    lateinit var localServer: LocalServer

    override fun onCreate() {
        super.onCreate()
        localServer = LocalServer(this, ankiRepository, settingsRepository, ::geminiService)
        localServer.start()
    }

    override fun onTerminate() {
        localServer.stop()
        super.onTerminate()
    }
}
```

## Estimated Size

- `LocalServer.kt`: ~100 lines (routing + asset serving)
- `ChatHandler.kt`: ~200 lines (streaming + extraction)
- `AnkiHandler.kt`: ~150 lines (CRUD endpoints)
- `SettingsHandler.kt`: ~80 lines (get/put)
- New AnkiRepository methods: ~150 lines
- **Total: ~680 lines new Kotlin code**

## Dependencies to Add

```kotlin
// app/build.gradle.kts
implementation("org.nanohttpd:nanohttpd:2.3.1")
implementation("com.google.code.gson:gson:2.11.0")  // JSON serialization (if not already)
```
