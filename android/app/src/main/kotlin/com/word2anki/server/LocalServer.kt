package com.word2anki.server

import android.content.Context
import android.util.Log
import com.word2anki.ai.GeminiService
import com.word2anki.data.AnkiRepository
import com.word2anki.data.SettingsRepository
import fi.iki.elonen.NanoHTTPD
import java.io.InputStream

private const val TAG = "LocalServer"

class LocalServer(
    private val context: Context,
    private val ankiRepository: AnkiRepository,
    private val settingsRepository: SettingsRepository,
    private val geminiServiceProvider: () -> GeminiService?
) : NanoHTTPD("127.0.0.1", PORT) {

    private val chatHandler = ChatHandler(ankiRepository, geminiServiceProvider)
    private val ankiHandler = AnkiHandler(ankiRepository)
    private val settingsHandler = SettingsHandler(settingsRepository)

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        // Add CORS headers
        if (method == Method.OPTIONS) {
            return corsResponse(newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, ""))
        }

        Log.d(TAG, "${method.name} $uri")

        val response = try {
            when {
                // API routes
                uri == "/api/platform" -> servePlatformInfo()
                uri == "/api/health" -> serveHealth()
                uri.startsWith("/api/chat") -> chatHandler.handle(session, uri.removePrefix("/api/chat"))
                uri.startsWith("/api/anki") -> ankiHandler.handle(session, uri.removePrefix("/api/anki"))
                uri.startsWith("/api/settings") -> settingsHandler.handle(session, method)
                // Static assets (React frontend)
                !uri.startsWith("/api") -> serveAsset(uri)
                else -> jsonResponse(Response.Status.NOT_FOUND, """{"error":"not found"}""")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling $uri", e)
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"${e.message?.replace("\"", "'")}"}""")
        }

        return corsResponse(response)
    }

    private fun servePlatformInfo(): Response {
        val ankiAvailable = ankiRepository.isAnkiDroidInstalled()
        val hasPermission = ankiRepository.hasAnkiPermission()
        return jsonResponse(
            Response.Status.OK,
            """{"platform":"android","ankiAvailable":$ankiAvailable,"hasPermission":$hasPermission}"""
        )
    }

    private fun serveHealth(): Response {
        return jsonResponse(Response.Status.OK, """{"status":"ok"}""")
    }

    private fun serveAsset(uri: String): Response {
        val path = if (uri == "/" || uri.isEmpty()) "index.html" else uri.removePrefix("/")
        return try {
            val inputStream: InputStream = context.assets.open("www/$path")
            val mimeType = getMimeType(path)
            newChunkedResponse(Response.Status.OK, mimeType, inputStream)
        } catch (e: Exception) {
            // SPA fallback: serve index.html for unrecognized paths
            try {
                val inputStream: InputStream = context.assets.open("www/index.html")
                newChunkedResponse(Response.Status.OK, "text/html", inputStream)
            } catch (e2: Exception) {
                jsonResponse(Response.Status.NOT_FOUND, """{"error":"asset not found"}""")
            }
        }
    }

    companion object {
        const val PORT = 18765

        fun jsonResponse(status: Response.Status, json: String): Response {
            return newFixedLengthResponse(status, "application/json", json)
        }

        fun corsResponse(response: Response): Response {
            response.addHeader("Access-Control-Allow-Origin", "*")
            response.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            response.addHeader("Access-Control-Allow-Headers", "Content-Type")
            return response
        }

        fun getMimeType(path: String): String {
            return when {
                path.endsWith(".html") -> "text/html"
                path.endsWith(".js") -> "application/javascript"
                path.endsWith(".css") -> "text/css"
                path.endsWith(".json") -> "application/json"
                path.endsWith(".png") -> "image/png"
                path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
                path.endsWith(".svg") -> "image/svg+xml"
                path.endsWith(".ico") -> "image/x-icon"
                path.endsWith(".woff") -> "font/woff"
                path.endsWith(".woff2") -> "font/woff2"
                path.endsWith(".ttf") -> "font/ttf"
                else -> "application/octet-stream"
            }
        }

        fun parseBody(session: IHTTPSession): String {
            val bodyMap = mutableMapOf<String, String>()
            session.parseBody(bodyMap)
            return bodyMap["postData"] ?: ""
        }
    }
}
