package com.word2anki

import android.app.Application

/**
 * Application class for word2anki.
 */
class Word2AnkiApp : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: Word2AnkiApp
            private set
    }
}
