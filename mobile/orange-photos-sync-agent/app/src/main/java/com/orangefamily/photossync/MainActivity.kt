package com.orangefamily.photossync

import android.content.Intent
import android.app.Activity
import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.IntentSenderRequest
import androidx.core.content.ContextCompat
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Scaffold
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
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
import com.orangefamily.photossync.ui.AppReleaseState
import com.orangefamily.photossync.ui.theme.OrangeFamilyPhotosSyncTheme
import com.orangefamily.photossync.sync.OrangePhotosSyncScheduler
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.device.DeviceMediaStoreScanner
import com.orangefamily.photossync.device.DeviceMediaVerifier
import com.orangefamily.photossync.device.DeviceMediaHashService
import com.orangefamily.photossync.device.DeviceMediaThumbnailLoader
import com.orangefamily.photossync.device.InstallationIdStore
import com.orangefamily.photossync.sync.OrangePhotosSyncApi
import com.orangefamily.photossync.sync.UploadNetworkPolicy
import com.orangefamily.photossync.ui.device.DeviceMediaScreen
import com.orangefamily.photossync.ui.device.DeviceTrashScreen
import com.orangefamily.photossync.cloud.OrangePhotosCloudApi
import com.orangefamily.photossync.cloud.CloudPhoto
import com.orangefamily.photossync.cloud.RemoteThumbnailLoader
import com.orangefamily.photossync.ui.cloud.CloudPhotosScreen
import com.orangefamily.photossync.ui.theme.OrangePrimary
import com.orangefamily.photossync.ui.theme.OrangeText
import android.content.ActivityNotFoundException
import android.widget.Toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal enum class AgentScreen { FOLDERS, SETTINGS, TRASH }
internal enum class LibrarySource { CLOUD, DEVICE }
internal fun initialAuthenticatedScreen() = AgentScreen.FOLDERS
private enum class MediaOperation { TRASH, RESTORE, DELETE, TOTAL_TRASH, CLOUD_TOTAL_TRASH }

class MainActivity : ComponentActivity() {
    private lateinit var authController: AuthController
    private lateinit var cameraBackupController: CameraBackupController
    private lateinit var repository: CameraBackupRepository
    private lateinit var scheduler: OrangePhotosSyncScheduler
    private lateinit var deviceScanner: DeviceMediaStoreScanner
    private lateinit var deviceVerifier: DeviceMediaVerifier
    private lateinit var thumbnailLoader: DeviceMediaThumbnailLoader
    private lateinit var sessionStore: SecureSessionStore
    private var pendingDeleteItems: List<LocalMediaItem> = emptyList()
    private var pendingMediaOperation: MediaOperation? = null
    private var pendingMediaCompletion: ((Boolean, String?) -> Unit)? = null
    private var pendingRemotePhotoIds: List<String> = emptyList()
    private var mediaRefreshVersion by mutableStateOf(0)
    private var mediaPermissionAccess by mutableStateOf(MediaPermissionAccess.NOT_REQUESTED)
    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        refreshMediaPermission()
    }
    private val notificationPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val deleteMediaLauncher=registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()){result->
        val requested=pendingDeleteItems;val operation=pendingMediaOperation;val completion=pendingMediaCompletion;val remotePhotoIds=pendingRemotePhotoIds;pendingDeleteItems=emptyList();pendingMediaOperation=null;pendingMediaCompletion=null;pendingRemotePhotoIds=emptyList()
        if(result.resultCode!=Activity.RESULT_OK){completion?.invoke(false,null);return@registerForActivityResult}
        if(result.resultCode==Activity.RESULT_OK){
            if(operation==MediaOperation.CLOUD_TOTAL_TRASH){lifecycleScope.launch(Dispatchers.IO){try{trashRemotePhotoIds(remotePhotoIds);withContext(Dispatchers.Main){mediaRefreshVersion+=1;completion?.invoke(true,null)}}catch(error:Exception){withContext(Dispatchers.Main){mediaRefreshVersion+=1;val message="Las copias del dispositivo se movieron a la papelera, pero no se pudo mover todo el contenido de OrangeFamily a su papelera.";Toast.makeText(this@MainActivity,message,Toast.LENGTH_LONG).show();completion?.invoke(false,message)}}};return@registerForActivityResult}
            if(operation==MediaOperation.DELETE)reconcileDeletedMedia(requested)
            if(operation==MediaOperation.TOTAL_TRASH)lifecycleScope.launch(Dispatchers.IO){runCatching{trashRemoteCopies(requested)}.onFailure{withContext(Dispatchers.Main){Toast.makeText(this@MainActivity,"Se eliminó del dispositivo, pero no se pudo mover la copia de OrangeFamily a la papelera.",Toast.LENGTH_LONG).show()}}}
            mediaRefreshVersion+=1
            completion?.invoke(true,null)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        sessionStore=SecureSessionStore(applicationContext)
        authController = AuthController(
            api = OrangeFamilyAuthApi(BuildConfig.API_BASE_URL),
            sessionStore = sessionStore,
        )
        val database = OrangePhotosLocalDatabase.getInstance(applicationContext)
        repository = CameraBackupRepository(database)
        scheduler = OrangePhotosSyncScheduler(applicationContext)
        deviceScanner = DeviceMediaStoreScanner(applicationContext)
        thumbnailLoader=DeviceMediaThumbnailLoader(contentResolver)
        deviceVerifier=DeviceMediaVerifier(repository,DeviceMediaHashService(contentResolver)){
            sessionStore.load(BuildConfig.API_BASE_URL)?.let{OrangePhotosSyncApi(BuildConfig.API_BASE_URL,it,InstallationIdStore(applicationContext).getOrCreate())}
        }
        cameraBackupController = CameraBackupController(
            repository = repository,
            scanner = CameraMediaScanner(applicationContext),
            scheduler = scheduler,
        )
        mediaPermissionAccess = MediaPermissions.evaluate(this)
        authController.restore(lifecycleScope)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            OrangeFamilyPhotosSyncTheme {
                AuthContent(
                        state = authController.state,
                        sessionStore = sessionStore,
                        cameraBackupController = cameraBackupController,
                        mediaPermissionAccess = mediaPermissionAccess,
                        onLogin = { email, password ->
                            authController.login(lifecycleScope, email, password)
                        },
                        onLogout = {
                            (application as OrangePhotosSyncApplication).configureMediaObservation(null)
                            authController.logout(lifecycleScope)
                        },
                        onOpenAppUpdate = ::openAppUpdate,
                        onMediaObservationChanged = ::updateMediaObservation,
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
                        deviceScanner = deviceScanner,
                        repository = repository,
                        deviceVerifier = deviceVerifier,
                        thumbnailLoader = thumbnailLoader,
                        onOpenMedia = ::openMedia,
                        onOpenCloudMedia = ::openCloudMedia,
                        onUploadMedia = ::enqueueMedia,
                        onSyncNow = scheduler::scheduleManualSync,
                        onNetworkPolicyChanged = scheduler::rescheduleForPolicy,
                        onDeleteMedia = ::deleteMedia,
                        onDeleteTotalMedia = ::deleteTotalMedia,
                        onRestoreMedia = ::restoreMedia,
                        onDeleteForever = ::deleteForever,
                        onDeleteCloudLocalCopies = ::deleteCloudLocalCopies,
                        onDeleteCloudAndLocal = ::deleteCloudAndLocal,
                        mediaRefreshVersion = mediaRefreshVersion,
                        modifier = Modifier
                            .fillMaxSize(),
                    )
            }
        }
    }

    private fun openExternalMedia(uri: Uri, mimeType: String?) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mimeType)
            if (uri.scheme == "content") intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "No hay una aplicación compatible.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openMedia(item: LocalMediaItem) { openExternalMedia(Uri.parse(item.contentUri), item.mimeType) }

    private fun openCloudMedia(photo: CloudPhoto) {
        val url = photo.viewerUrl
        if (url.isNullOrBlank()) {
            Toast.makeText(this, "No hay una versión disponible para visualizar.", Toast.LENGTH_SHORT).show()
            return
        }
        openExternalMedia(Uri.parse(url!!), photo.viewerMimeType)
    }

    private fun enqueueMedia(items: List<LocalMediaItem>, forceDuplicate: Boolean) {
        if (items.isEmpty()) return
        lifecycleScope.launch(Dispatchers.IO) {
            repository.enqueueDeviceMedia(items, forceDuplicate)
            scheduler.scheduleManualSync(
                items.first().accountUserId,
            )
        }
    }

    private fun openAppUpdate(downloadUrl: String) {
        val uri = Uri.parse(downloadUrl)

        if (!uri.scheme.equals("https", ignoreCase = true)) {
            Toast.makeText(
                this,
                getString(R.string.app_update_open_failed),
                Toast.LENGTH_SHORT,
            ).show()
            return
        }

        try {
            startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    uri,
                ),
            )
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(
                this,
                getString(R.string.app_update_open_failed),
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    private fun requestMediaTrash(items:List<LocalMediaItem>,operation:MediaOperation,completion:((Boolean,String?)->Unit)?=null,remotePhotoIds:List<String> = emptyList()){if(items.isEmpty()){completion?.invoke(true,null);return};pendingDeleteItems=items;pendingMediaOperation=operation;pendingMediaCompletion=completion;pendingRemotePhotoIds=remotePhotoIds;deleteMediaLauncher.launch(IntentSenderRequest.Builder(MediaStore.createTrashRequest(contentResolver,items.map{Uri.parse(it.contentUri)},true).intentSender).build())}
    private suspend fun trashRemotePhotoIds(remotePhotoIds:List<String>){val ids=remotePhotoIds.map{it.trim()}.filter{it.isNotBlank()}.distinct();if(ids.isEmpty())error("No se pudo identificar el contenido de OrangeFamily.");val token=sessionStore.load(BuildConfig.API_BASE_URL)?:error("La sesión de OrangeFamily no está disponible.");val api=OrangePhotosSyncApi(BuildConfig.API_BASE_URL,token,InstallationIdStore(applicationContext).getOrCreate());ids.forEach{api.trashPhoto(it)}}
    private fun deleteCloudAndLocal(
        remotePhotoIds: List<String>,
        localItems: List<LocalMediaItem>,
        completion: (Boolean, String?) -> Unit,
    ) {
        val ids =
            remotePhotoIds
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()

        if (ids.isEmpty()) {
            completion(false, "No se pudo identificar el contenido de OrangeFamily.")
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R && localItems.isNotEmpty()) {
            completion(
                false,
                "La eliminación segura de copias locales requiere Android 11 o superior.",
            )
            return
        }

        if (localItems.isNotEmpty()) {
            requestMediaTrash(
                localItems,
                MediaOperation.CLOUD_TOTAL_TRASH,
                completion,
                ids,
            )
            return
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                trashRemotePhotoIds(ids)
                withContext(Dispatchers.Main) {
                    mediaRefreshVersion += 1
                    completion(true, null)
                }
            } catch (error: Exception) {
                withContext(Dispatchers.Main) {
                    completion(
                        false,
                        error.message
                            ?: "No se pudo mover el contenido de OrangeFamily a la papelera.",
                    )
                }
            }
        }
    }

    private fun deleteCloudLocalCopies(
        items: List<LocalMediaItem>,
        completion: (Boolean, String?) -> Unit,
    ) {
        if (items.isEmpty()) {
            completion(true, null)
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            completion(false, "La papelera del dispositivo requiere Android 11 o superior.")
            return
        }

        requestMediaTrash(items, MediaOperation.TRASH, completion)
    }

    private suspend fun trashRemoteCopies(items:List<LocalMediaItem>){val cloudItems=items.filter{it.cloudStatus==LocalMediaItem.CLOUD_BACKED_UP};if(cloudItems.isEmpty())error("La selección no contiene copias de OrangeFamily.");if(cloudItems.any{it.remotePhotoId.isNullOrBlank()})error("No se pudo identificar una de las copias de OrangeFamily.");val remotePhotoIds=cloudItems.mapNotNull{it.remotePhotoId?.trim()}.filter{it.isNotBlank()}.distinct();trashRemotePhotoIds(remotePhotoIds)}

    private fun deleteTotalMedia(items: List<LocalMediaItem>) {
        if (items.isEmpty()) return

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            Toast.makeText(
                this,
                "La eliminación segura del dispositivo requiere Android 11 o superior.",
                Toast.LENGTH_LONG,
            ).show()
            return
        }

        val cloudItems =
            items.filter {
                it.cloudStatus == LocalMediaItem.CLOUD_BACKED_UP
            }

        if (cloudItems.isEmpty()) return

        if (cloudItems.any { it.remotePhotoId.isNullOrBlank() }) {
            Toast.makeText(
                this,
                "No se pudo identificar la copia de OrangeFamily.",
                Toast.LENGTH_SHORT,
            ).show()
            return
        }

        requestMediaTrash(items, MediaOperation.TOTAL_TRASH)
    }

    private fun deleteMedia(items: List<LocalMediaItem>) {
        if (items.isEmpty()) return

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            Toast.makeText(
                this,
                "La papelera del dispositivo requiere Android 11 o superior.",
                Toast.LENGTH_LONG,
            ).show()
            return
        }

        requestMediaTrash(items, MediaOperation.TRASH)
    }

    private fun restoreMedia(items:List<LocalMediaItem>){if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R||items.isEmpty())return;pendingDeleteItems=items;pendingMediaOperation=MediaOperation.RESTORE;deleteMediaLauncher.launch(IntentSenderRequest.Builder(MediaStore.createTrashRequest(contentResolver,items.map{Uri.parse(it.contentUri)},false).intentSender).build())}
    private fun deleteForever(items:List<LocalMediaItem>){if(items.isEmpty())return;pendingDeleteItems=items;pendingMediaOperation=MediaOperation.DELETE;deleteMediaLauncher.launch(IntentSenderRequest.Builder(MediaStore.createDeleteRequest(contentResolver,items.map{Uri.parse(it.contentUri)}).intentSender).build())}

    private fun reconcileDeletedMedia(items:List<LocalMediaItem>){lifecycleScope.launch(Dispatchers.IO){items.forEach{item->val exists=runCatching{contentResolver.openFileDescriptor(Uri.parse(item.contentUri),"r")?.use{true}?:false}.getOrDefault(false);if(!exists)repository.removeLocalItem(item)}}}

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

    private fun updateMediaObservation(enabled: Boolean) {
        val userId = (authController.state as? AuthController.AuthState.Authenticated)?.user?.id
        (application as OrangePhotosSyncApplication).configureMediaObservation(userId.takeIf { enabled })
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun AuthContent(
    state: AuthController.AuthState,
    sessionStore: SecureSessionStore,
    cameraBackupController: CameraBackupController,
    mediaPermissionAccess: MediaPermissionAccess,
    onLogin: (String, String) -> Unit,
    onLogout: () -> Unit,
    onOpenAppUpdate: (String) -> Unit,
    onMediaObservationChanged: (Boolean) -> Unit,
    onRequestMediaPermission: () -> Unit,
    onOpenPermissionSettings: () -> Unit,
    deviceScanner: DeviceMediaStoreScanner,
    repository: CameraBackupRepository,
    deviceVerifier: DeviceMediaVerifier,
    thumbnailLoader: DeviceMediaThumbnailLoader,
    onOpenMedia: (LocalMediaItem) -> Unit,
    onOpenCloudMedia: (CloudPhoto) -> Unit,
    onUploadMedia: (List<LocalMediaItem>, Boolean) -> Unit,
    onSyncNow: (String) -> Unit,
    onNetworkPolicyChanged:(String,UploadNetworkPolicy)->Unit,
    onDeleteMedia: (List<LocalMediaItem>) -> Unit,
    onDeleteTotalMedia: (List<LocalMediaItem>) -> Unit,
    onRestoreMedia: (List<LocalMediaItem>) -> Unit,
    onDeleteForever: (List<LocalMediaItem>) -> Unit,
    onDeleteCloudLocalCopies: (List<LocalMediaItem>, (Boolean, String?) -> Unit) -> Unit,
    onDeleteCloudAndLocal: (List<String>, List<LocalMediaItem>, (Boolean, String?) -> Unit) -> Unit,
    mediaRefreshVersion: Int,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    var screen by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(initialAuthenticatedScreen()) }
    val authenticatedUserId = (state as? AuthController.AuthState.Authenticated)?.user?.id
    LaunchedEffect(authenticatedUserId){if(authenticatedUserId!=null)screen=initialAuthenticatedScreen()}
    val observerEnabled = authenticatedUserId != null &&
        cameraBackupController.state.accountUserId == authenticatedUserId &&
        cameraBackupController.state.config?.enabled == true &&
        mediaPermissionAccess == MediaPermissionAccess.FULL
    LaunchedEffect(authenticatedUserId, observerEnabled) {
        onMediaObservationChanged(observerEnabled)
    }
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
            var librarySource by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(LibrarySource.DEVICE) }
            var cloudSessionToken by androidx.compose.runtime.remember(state.user.id) { mutableStateOf<String?>(null) }
            var appReleaseState by androidx.compose.runtime.remember(state.user.id) { mutableStateOf<AppReleaseState>(AppReleaseState.Loading) }
            var dismissedAppReleaseCode by androidx.compose.runtime.saveable.rememberSaveable(state.user.id) { mutableStateOf<Int?>(null) }
            suspend fun checkAppRelease(token: String): AppReleaseState =
                withContext(Dispatchers.IO) {
                    when (val result = runCatching {
                        OrangeFamilyAuthApi(BuildConfig.API_BASE_URL).latestAndroidRelease(token)
                    }.getOrNull()) {
                        is OrangeFamilyAuthApi.AppReleaseResult.Success -> AppReleaseState.Ready(result.release)
                        else -> AppReleaseState.Error
                    }
                }
            LaunchedEffect(state.user.id) {
                val token = withContext(Dispatchers.IO) { sessionStore.load(BuildConfig.API_BASE_URL) }
                cloudSessionToken = token
                appReleaseState = if (token == null) AppReleaseState.Error else checkAppRelease(token)
            }
            LaunchedEffect(screen, cloudSessionToken) {
                if (screen != AgentScreen.SETTINGS) return@LaunchedEffect
                val token = cloudSessionToken ?: return@LaunchedEffect
                appReleaseState = AppReleaseState.Loading
                appReleaseState = checkAppRelease(token)
            }
            val cloudApi = androidx.compose.runtime.remember(cloudSessionToken) {
                cloudSessionToken?.let { OrangePhotosCloudApi(BuildConfig.API_BASE_URL, it) }
            }
            val remoteThumbnailLoader = androidx.compose.runtime.remember { RemoteThumbnailLoader() }
            val availableAppRelease =
                (appReleaseState as? AppReleaseState.Ready)
                    ?.release
                    ?.takeIf { it.versionCode > BuildConfig.VERSION_CODE }
            if (availableAppRelease != null && dismissedAppReleaseCode != availableAppRelease.versionCode) {
                AlertDialog(
                    onDismissRequest = { dismissedAppReleaseCode = availableAppRelease.versionCode },
                    title = { Text(stringResource(R.string.app_update_available)) },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("${availableAppRelease.versionName} · ${availableAppRelease.versionCode}")
                            availableAppRelease.releaseNotes
                                ?.takeIf { it.isNotBlank() }
                                ?.let { Text(it) }
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = {
                            dismissedAppReleaseCode = availableAppRelease.versionCode
                            onOpenAppUpdate(availableAppRelease.downloadUrl)
                        }) { Text(stringResource(R.string.download_app_update)) }
                    },
                    dismissButton = {
                        TextButton(onClick = { dismissedAppReleaseCode = availableAppRelease.versionCode }) {
                            Text(stringResource(R.string.app_update_later))
                        }
                    },
                )
            }
            val librarySelector: @Composable () -> Unit = {
                LibrarySourceSelector(
                    selected = librarySource,
                    onSelect = { librarySource = it },
                )
            }
            if (screen == AgentScreen.FOLDERS) {
                if (librarySource == LibrarySource.DEVICE) {
                    DeviceMediaScreen(
                        accountUserId = state.user.id,
                        permission = mediaPermissionAccess,
                        scanner = deviceScanner,
                        repository = repository,
                        verifier = deviceVerifier,
                        thumbnailLoader = thumbnailLoader,
                        onSettings = { screen = AgentScreen.SETTINGS },
                        onTrash = { screen = AgentScreen.TRASH },
                        onOpen = onOpenMedia,
                        onUpload = onUploadMedia,
                        onSyncNow = { onSyncNow(state.user.id) },
                        onDelete = onDeleteMedia,
                        onDeleteTotal = onDeleteTotalMedia,
                        refreshVersion = mediaRefreshVersion,
                        librarySelector = librarySelector,
                        modifier = modifier,
                    )
                } else {
                    if (cloudApi == null) {
                        Box(modifier = modifier, contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    } else {
                        CloudPhotosScreen(api = cloudApi, thumbnailLoader = remoteThumbnailLoader, accountUserId = state.user.id, repository = repository, deviceScanner = deviceScanner, mediaRefreshVersion = mediaRefreshVersion, librarySelector = librarySelector, onOpen = onOpenCloudMedia, modifier = modifier, onDeleteLocalCopies = onDeleteCloudLocalCopies, onDeleteCloudAndLocal = onDeleteCloudAndLocal)
                    }
                }
            } else if(screen==AgentScreen.TRASH){
                DeviceTrashScreen(scanner=deviceScanner,accountUserId=state.user.id,thumbnailLoader=thumbnailLoader,onBack={screen=AgentScreen.FOLDERS},onRestore=onRestoreMedia,onDeleteForever=onDeleteForever,refreshVersion=mediaRefreshVersion,modifier=modifier)
            } else Scaffold(topBar={androidx.compose.material3.TopAppBar(title={androidx.compose.material3.Text(stringResource(R.string.settings_title))},navigationIcon={androidx.compose.material3.IconButton(onClick={screen=AgentScreen.FOLDERS}){androidx.compose.material3.Text("←")}})}) { settingsPadding -> StatusScreen(
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
                appReleaseState = appReleaseState,
                onDownloadAppUpdate = onOpenAppUpdate,
                onNetworkPolicyChanged={onNetworkPolicyChanged(state.user.id,it)},
                modifier = modifier.padding(settingsPadding),
            ) }
        }
    }
}

@Composable
private fun LibrarySourceSelector(
    selected: LibrarySource,
    onSelect: (LibrarySource) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        LibrarySourceButton(stringResource(R.string.cloud_library), selected == LibrarySource.CLOUD, OrangeText) { onSelect(LibrarySource.CLOUD) }
        LibrarySourceButton(stringResource(R.string.device_library), selected == LibrarySource.DEVICE, OrangePrimary) { onSelect(LibrarySource.DEVICE) }
    }
}

@Composable
private fun LibrarySourceButton(text: String, selected: Boolean, selectedContainerColor: Color, onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        modifier = Modifier.height(32.dp).defaultMinSize(minWidth = 0.dp, minHeight = 32.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.textButtonColors(
            containerColor = if (selected) selectedContainerColor else Color.Transparent,
            contentColor = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
        ),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
    ) { Text(text, style = MaterialTheme.typography.labelMedium, maxLines = 1) }
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
