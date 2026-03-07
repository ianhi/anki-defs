# WebView Setup & Native Bridges

## WebView Activity

Replace current `ChatScreen` + `SettingsScreen` Compose navigation with a single WebView that loads the React app from the local server.

```kotlin
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true  // for Zustand persistence
            settings.mediaPlayEnabled = false
            addJavascriptInterface(AndroidBridge(this@MainActivity), "Android")
            loadUrl("http://localhost:${LocalServer.PORT}")
        }
        setContentView(webView)

        // Handle share intent
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        val text = when (intent.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
            Intent.ACTION_PROCESS_TEXT -> intent.getStringExtra(Intent.EXTRA_PROCESS_TEXT)
            else -> null
        }
        if (text != null) {
            // Pass shared text to frontend via URL hash or JS bridge
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('sharedText', { detail: ${gson.toJson(text)} }))",
                null
            )
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
```

## JavaScript Bridge

```kotlin
class AndroidBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun getPlatform(): String = "android"

    @JavascriptInterface
    fun requestAnkiPermission() {
        activity.requestPermissions(
            arrayOf("com.ichi2.anki.permission.READ_WRITE_DATABASE"),
            PERMISSION_REQUEST_CODE
        )
    }

    @JavascriptInterface
    fun isAnkiInstalled(): Boolean = ankiRepository.isAnkiDroidInstalled()

    @JavascriptInterface
    fun hasAnkiPermission(): Boolean = ankiRepository.hasAnkiPermission()

    @JavascriptInterface
    fun shareText(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        activity.startActivity(Intent.createChooser(intent, "Share"))
    }
}
```

## Frontend Integration Points

### Shared Text Event Listener

```typescript
// In Chat.tsx or useChat hook
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setInput(e.detail);
    // optionally auto-send
  };
  window.addEventListener('sharedText', handler);
  return () => window.removeEventListener('sharedText', handler);
}, []);
```

### Platform Detection (alternative to /api/platform)

```typescript
// Can also detect via JS bridge
const isAndroid = typeof window.Android !== 'undefined';
```

## Intent Filters (AndroidManifest.xml)

Keep existing intent filters — they work with WebView just as well:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.PROCESS_TEXT" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

## What Gets Removed

These Compose files become unnecessary:

- `ui/screens/ChatScreen.kt` (555 lines)
- `ui/screens/SettingsScreen.kt` (403 lines)
- `ui/components/CardPreviewComponent.kt`
- `ui/components/MessageBubble.kt`
- `ui/components/MessageInput.kt`
- `ui/components/DeckSelector.kt`
- `ui/components/MarkdownText.kt`
- `ui/components/StreamingText.kt`
- `ui/theme/` (entire directory)
- `viewmodel/ChatViewModel.kt` (403 lines)
- `viewmodel/SettingsViewModel.kt` (111 lines)

**~2000 lines of Compose UI removed**, replaced by ~200 lines of WebView + bridge code.

The business logic stays (AnkiRepository, GeminiService, SettingsRepository, CardExtractor, PromptTemplates) — just exposed via HTTP instead of ViewModels.

## What Stays Native

- `MainActivity.kt` — WebView container + intent handling
- `Word2AnkiApp.kt` — Application class, server lifecycle
- `server/` package — all new HTTP handler code
- `data/` package — AnkiRepository, SettingsRepository
- `ai/` package — GeminiService, CardExtractor, PromptTemplates
- `QuickTranslateActivity.kt` — future native popup (see quick-translate.md)
