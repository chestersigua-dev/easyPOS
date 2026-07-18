package com.example.easypos

import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.easypos.theme.EasyPOSTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      EasyPOSTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
          EasyPOSApp()
        }
      }
    }
  }
}

@Composable
fun EasyPOSApp() {
  val context = LocalContext.current
  val sharedPreferences = remember {
    context.getSharedPreferences("EasyPOSPrefs", Context.MODE_PRIVATE)
  }

  var serverUrl by remember {
    mutableStateOf(sharedPreferences.getString("apiServerUrl", "https://easypos-api.onrender.com") ?: "https://easypos-api.onrender.com")
  }

  var isConfigured by remember {
    mutableStateOf(true)
  }

  if (!isConfigured) {
    SetupScreen(
      initialUrl = serverUrl,
      onSave = { url ->
        sharedPreferences.edit().putString("apiServerUrl", url).apply()
        serverUrl = url
        isConfigured = true
      }
    )
  } else {
    WebViewScreen(
      serverUrl = serverUrl,
      onBackToSettings = {
        sharedPreferences.edit().remove("apiServerUrl").apply()
        isConfigured = false
      }
    )
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SetupScreen(initialUrl: String, onSave: (String) -> Unit) {
  var urlInput by remember { mutableStateOf(if (initialUrl.isEmpty()) "http://192.168.100.132:8085" else initialUrl) }
  var showError by remember { mutableStateOf(false) }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color(0xFF0F172A)) // Sleek slate dark background
      .padding(24.dp),
    contentAlignment = Alignment.Center
  ) {
    Card(
      modifier = Modifier
        .widthIn(max = 500.dp)
        .fillMaxWidth()
        .clip(RoundedCornerShape(16.dp)),
      colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
    ) {
      Column(
        modifier = Modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Text(
          text = "💻",
          fontSize = 48.sp,
          modifier = Modifier.padding(bottom = 8.dp)
        )
        Text(
          text = "EasyPOS Tablet Hub",
          fontSize = 24.sp,
          fontWeight = FontWeight.Bold,
          color = Color.White
        )
        Text(
          text = "Configure Point of Sale Connection",
          fontSize = 12.sp,
          color = Color(0xFF94A3B8),
          modifier = Modifier.padding(bottom = 24.dp)
        )

        OutlinedTextField(
          value = urlInput,
          onValueChange = {
            urlInput = it
            showError = false
          },
          label = { Text("Backend Server URL", color = Color(0xFF94A3B8)) },
          placeholder = { Text("http://192.168.100.132:8085") },
          singleLine = true,
          isError = showError,
          colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedBorderColor = Color(0xFF0EA5E9),
            unfocusedBorderColor = Color(0xFF475569),
            errorBorderColor = Color(0xFFEF4444)
          ),
          keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Uri,
            imeAction = ImeAction.Done
          ),
          keyboardActions = KeyboardActions(
            onDone = {
              val trimmed = urlInput.trim()
              if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                onSave(trimmed)
              } else {
                showError = true
              }
            }
          ),
          modifier = Modifier.fillMaxWidth()
        )

        if (showError) {
          Text(
            text = "URL must start with http:// or https://",
            color = Color(0xFFEF4444),
            fontSize = 11.sp,
            modifier = Modifier
              .align(Alignment.Start)
              .padding(top = 4.dp, bottom = 12.dp)
          )
        } else {
          Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
          onClick = {
            val trimmed = urlInput.trim()
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
              onSave(trimmed)
            } else {
              showError = true
            }
          },
          colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9)),
          shape = RoundedCornerShape(8.dp),
          modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
        ) {
          Text(
            text = "Connect & Open POS",
            fontWeight = FontWeight.Bold,
            color = Color.White
          )
        }
      }
    }
  }
}

@Composable
fun WebViewScreen(serverUrl: String, onBackToSettings: () -> Unit) {
  var showDialog by remember { mutableStateOf(false) }
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }

  // Custom back button handler
  BackHandler {
    if (webViewInstance?.canGoBack() == true) {
      webViewInstance?.goBack()
    } else {
      showDialog = true
    }
  }

  Box(modifier = Modifier.fillMaxSize()) {
    AndroidView(
      factory = { context ->
        WebView(context).apply {
          layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
          )
          settings.javaScriptEnabled = true
          settings.domStorageEnabled = true
          settings.allowFileAccess = true
          settings.allowContentAccess = true
          settings.databaseEnabled = true
          settings.useWideViewPort = true
          settings.loadWithOverviewMode = true

          webChromeClient = WebChromeClient()
          webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
              super.onPageStarted(view, url, favicon)
              // Inject localStorage items early
              view?.evaluateJavascript("localStorage.setItem('apiServerUrl', '$serverUrl');", null)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
              super.onPageFinished(view, url)
              // Inject localStorage items again to be safe
              view?.evaluateJavascript("localStorage.setItem('apiServerUrl', '$serverUrl');", null)
            }
          }
          webViewInstance = this
          loadUrl("file:///android_asset/www/index.html")
        }
      },
      modifier = Modifier.fillMaxSize()
    )

    // Floating Settings Button
    IconButton(
      onClick = { showDialog = true },
      modifier = Modifier
        .align(Alignment.TopEnd)
        .padding(16.dp)
        .background(Color.Black.copy(alpha = 0.4f), RoundedCornerShape(50))
    ) {
      Text(
        text = "⚙",
        color = Color.White,
        fontSize = 20.sp
      )
    }

    if (showDialog) {
      AlertDialog(
        onDismissRequest = { showDialog = false },
        title = { Text("Connection Settings") },
        text = { Text("Do you want to disconnect from '$serverUrl' and change the backend server configuration?") },
        confirmButton = {
          Button(
            onClick = {
              showDialog = false
              onBackToSettings()
            },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
          ) {
            Text("Disconnect")
          }
        },
        dismissButton = {
          TextButton(onClick = { showDialog = false }) {
            Text("Cancel")
          }
        }
      )
    }
  }
}
