package com.word2anki

import android.app.Application
import android.util.Log
import com.word2anki.ai.GeminiService
import com.word2anki.data.AnkiRepository
import com.word2anki.data.SettingsRepository
import com.word2anki.server.LocalServer
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private const val TAG = "Word2AnkiApp"

/**
 * Application class for word2anki.
 */
class Word2AnkiApp : Application() {

    lateinit var ankiRepository: AnkiRepository
    lateinit var settingsRepository: SettingsRepository
    lateinit var localServer: LocalServer

    private var geminiService: GeminiService? = null

    override fun onCreate() {
        super.onCreate()

        ankiRepository = AnkiRepository(this)
        settingsRepository = SettingsRepository(this)

        localServer = LocalServer(
            context = this,
            ankiRepository = ankiRepository,
            settingsRepository = settingsRepository,
            geminiServiceProvider = ::getOrCreateGeminiService
        )

        try {
            localServer.start()
            Log.i(TAG, "Local server started on port ${LocalServer.PORT}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start local server", e)
        }
    }

    override fun onTerminate() {
        localServer.stop()
        Log.i(TAG, "Local server stopped")
        super.onTerminate()
    }

    private fun getOrCreateGeminiService(): GeminiService? {
        geminiService?.let { return it }

        val apiKey = try {
            runBlocking { settingsRepository.settingsFlow.first().geminiApiKey }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get API key", e)
            return null
        }

        if (apiKey.isBlank()) return null

        return GeminiService(apiKey).also { geminiService = it }
    }
}
