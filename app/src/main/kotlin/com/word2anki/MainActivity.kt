package com.word2anki

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.word2anki.data.FlashCardsContract
import com.word2anki.ui.screens.ChatScreen
import com.word2anki.ui.screens.SettingsScreen
import com.word2anki.ui.theme.Word2AnkiTheme

class MainActivity : ComponentActivity() {

    private var sharedText by mutableStateOf<String?>(null)

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Permission result will be handled by the ViewModel
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Handle shared text intent
        handleIntent(intent)

        // Request AnkiDroid permission if needed
        requestAnkiPermissionIfNeeded()

        setContent {
            Word2AnkiTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Word2AnkiNavigation(sharedText = sharedText)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_SEND -> {
                if (intent.type == "text/plain") {
                    sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                }
            }
        }
    }

    private fun requestAnkiPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val permission = FlashCardsContract.READ_WRITE_PERMISSION
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                permissionLauncher.launch(permission)
            }
        }
    }
}

@Composable
fun Word2AnkiNavigation(sharedText: String?) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = "chat"
    ) {
        composable("chat") {
            ChatScreen(
                onNavigateToSettings = {
                    navController.navigate("settings")
                },
                sharedText = sharedText
            )
        }

        composable("settings") {
            SettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
