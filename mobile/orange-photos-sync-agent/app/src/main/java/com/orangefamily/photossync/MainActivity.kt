package com.orangefamily.photossync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.lifecycleScope
import com.orangefamily.photossync.auth.AuthController
import com.orangefamily.photossync.auth.OrangeFamilyAuthApi
import com.orangefamily.photossync.auth.SecureSessionStore
import com.orangefamily.photossync.ui.LoginScreen
import com.orangefamily.photossync.ui.StatusScreen
import com.orangefamily.photossync.ui.theme.OrangeFamilyPhotosSyncTheme

class MainActivity : ComponentActivity() {
    private lateinit var authController: AuthController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        authController = AuthController(
            api = OrangeFamilyAuthApi(BuildConfig.API_BASE_URL),
            sessionStore = SecureSessionStore(applicationContext),
        )
        authController.restore(lifecycleScope)

        setContent {
            OrangeFamilyPhotosSyncTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { contentPadding ->
                    AuthContent(
                        state = authController.state,
                        onLogin = { email, password ->
                            authController.login(lifecycleScope, email, password)
                        },
                        onLogout = { authController.logout(lifecycleScope) },
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(contentPadding),
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthContent(
    state: AuthController.AuthState,
    onLogin: (String, String) -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        AuthController.AuthState.Loading -> LoadingScreen(modifier)
        AuthController.AuthState.LoggingIn -> LoginScreen(
            loading = true,
            error = null,
            onLogin = onLogin,
            modifier = modifier,
        )
        AuthController.AuthState.LoggingOut -> LoadingScreen(modifier)
        is AuthController.AuthState.LoggedOut -> LoginScreen(
            loading = false,
            error = state.error,
            onLogin = onLogin,
            modifier = modifier,
        )
        is AuthController.AuthState.Authenticated -> StatusScreen(
            user = state.user,
            loggingOut = false,
            onLogout = onLogout,
            modifier = modifier,
        )
    }
}

@Composable
private fun LoadingScreen(modifier: Modifier = Modifier) {
    val description = stringResource(R.string.loading_session)
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            modifier = Modifier.semantics { contentDescription = description },
        )
    }
}
