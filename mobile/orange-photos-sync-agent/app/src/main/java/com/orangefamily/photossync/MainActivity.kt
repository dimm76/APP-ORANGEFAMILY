package com.orangefamily.photossync

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.lifecycleScope
import com.orangefamily.photossync.auth.AuthController
import com.orangefamily.photossync.auth.OrangeFamilyAuthApi
import com.orangefamily.photossync.auth.SecureSessionStore
import com.orangefamily.photossync.backup.CameraBackupController
import com.orangefamily.photossync.backup.CameraBackupController.CameraBackupState
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.OrangePhotosLocalDatabase
import com.orangefamily.photossync.media.CameraMediaScanner
import com.orangefamily.photossync.media.MediaPermissionAccess
import com.orangefamily.photossync.media.MediaPermissions
import com.orangefamily.photossync.ui.LoginScreen
import com.orangefamily.photossync.ui.StatusScreen
import com.orangefamily.photossync.ui.theme.OrangeFamilyPhotosSyncTheme
import com.orangefamily.photossync.sync.OrangePhotosSyncScheduler

class MainActivity : ComponentActivity() {
    private lateinit var authController: AuthController
    private lateinit var cameraBackupController: CameraBackupController
    private var mediaPermissionAccess by mutableStateOf(MediaPermissionAccess.NOT_REQUESTED)
    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        refreshMediaPermission()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        authController = AuthController(
            api = OrangeFamilyAuthApi(BuildConfig.API_BASE_URL),
            sessionStore = SecureSessionStore(applicationContext),
        )
        val database = OrangePhotosLocalDatabase.getInstance(applicationContext)
        cameraBackupController = CameraBackupController(
            repository = CameraBackupRepository(database),
            scanner = CameraMediaScanner(applicationContext),
            scheduler = OrangePhotosSyncScheduler(applicationContext),
        )
        mediaPermissionAccess = MediaPermissions.evaluate(this)
        authController.restore(lifecycleScope)

        setContent {
            OrangeFamilyPhotosSyncTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { contentPadding ->
                    AuthContent(
                        state = authController.state,
                        cameraBackupController = cameraBackupController,
                        mediaPermissionAccess = mediaPermissionAccess,
                        onLogin = { email, password ->
                            authController.login(lifecycleScope, email, password)
                        },
                        onLogout = { authController.logout(lifecycleScope) },
                        onRequestMediaPermission = {
                            MediaPermissions.markRequested(this)
                            mediaPermissionLauncher.launch(MediaPermissions.requiredPermissions())
                        },
                        onOpenPermissionSettings = {
                            startActivity(
                                Intent(
                                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                    Uri.parse("package:$packageName"),
                                ),
                            )
                        },
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(contentPadding),
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::cameraBackupController.isInitialized) refreshMediaPermission()
    }

    private fun refreshMediaPermission() {
        mediaPermissionAccess = MediaPermissions.evaluate(this)
        if (::cameraBackupController.isInitialized) {
            cameraBackupController.updatePermission(mediaPermissionAccess)
        }
    }
}

@Composable
private fun AuthContent(
    state: AuthController.AuthState,
    cameraBackupController: CameraBackupController,
    mediaPermissionAccess: MediaPermissionAccess,
    onLogin: (String, String) -> Unit,
    onLogout: () -> Unit,
    onRequestMediaPermission: () -> Unit,
    onOpenPermissionSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
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
        is AuthController.AuthState.Authenticated -> {
            LaunchedEffect(state.user.id) {
                cameraBackupController.load(
                    scope = scope,
                    userId = state.user.id,
                    permission = mediaPermissionAccess,
                )
            }
            StatusScreen(
                user = state.user,
                loggingOut = false,
                cameraBackupState = cameraBackupController.state.takeIf {
                    it.accountUserId == state.user.id
                } ?: CameraBackupState(
                    accountUserId = state.user.id,
                    permission = mediaPermissionAccess,
                    loading = true,
                ),
                onRequestMediaPermission = onRequestMediaPermission,
                onOpenPermissionSettings = onOpenPermissionSettings,
                onActivate = { cameraBackupController.activate(scope) },
                onScan = { cameraBackupController.syncNow(scope) },
                onLogout = onLogout,
                modifier = modifier,
            )
        }
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
