package com.word2anki

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.word2anki.data.FlashCardsContract
import com.word2anki.server.LocalServer

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private val gson = Gson()
    private var pendingSharedText: String? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('ankiPermissionChanged', { detail: true }))",
                null
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false

            addJavascriptInterface(AndroidBridge(), "Android")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean = false

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    pendingSharedText?.let { text ->
                        dispatchSharedText(text)
                        pendingSharedText = null
                    }
                }
            }

            webChromeClient = WebChromeClient()
        }

        setContentView(webView)

        handleIntent(intent)
        requestAnkiPermissionIfNeeded()

        webView.loadUrl("http://localhost:${LocalServer.PORT}")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    @Deprecated("Use onBackPressedDispatcher")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    private fun handleIntent(intent: Intent?) {
        val text = when (intent?.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
            Intent.ACTION_PROCESS_TEXT ->
                intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            else -> null
        }

        if (!text.isNullOrBlank()) {
            if (::webView.isInitialized) {
                dispatchSharedText(text)
            } else {
                pendingSharedText = text
            }
        }
    }

    private fun dispatchSharedText(text: String) {
        val jsonText = gson.toJson(text)
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('sharedText', { detail: $jsonText }))",
            null
        )
    }

    private fun requestAnkiPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val permission = FlashCardsContract.READ_WRITE_PERMISSION
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                permissionLauncher.launch(permission)
            }
        }
    }

    inner class AndroidBridge {
        @android.webkit.JavascriptInterface
        fun requestAnkiPermission() {
            runOnUiThread {
                permissionLauncher.launch(FlashCardsContract.READ_WRITE_PERMISSION)
            }
        }

        @android.webkit.JavascriptInterface
        fun isAnkiInstalled(): Boolean {
            val app = application as Word2AnkiApp
            return app.ankiRepository.isAnkiDroidInstalled()
        }

        @android.webkit.JavascriptInterface
        fun hasAnkiPermission(): Boolean {
            val app = application as Word2AnkiApp
            return app.ankiRepository.hasAnkiPermission()
        }
    }
}
