package com.orangefamily.photossync.backup

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.orangefamily.photossync.data.AgentConfig
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.data.PendingCounts
import com.orangefamily.photossync.media.CameraMediaScanner
import com.orangefamily.photossync.media.MediaPermissionAccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CameraBackupController(
    private val repository: CameraBackupRepository,
    private val scanner: CameraMediaScanner,
) {
    var state by mutableStateOf(CameraBackupState())
        private set

    private var accountUserId: String? = null

    fun load(scope: CoroutineScope, userId: String, permission: MediaPermissionAccess) {
        accountUserId = userId
        state = CameraBackupState(
            accountUserId = userId,
            permission = permission,
            loading = true,
        )
        scope.launch {
            val snapshot = withContext(Dispatchers.IO) { repository.snapshot(userId) }
            if (accountUserId != userId) return@launch
            state = state.copy(
                config = snapshot.config,
                counts = snapshot.counts,
                latestPending = snapshot.latestPending,
                loading = false,
            )
        }
    }

    fun updatePermission(permission: MediaPermissionAccess) {
        state = state.copy(permission = permission)
    }

    fun activate(scope: CoroutineScope) {
        val userId = accountUserId ?: return
        if (state.permission != MediaPermissionAccess.FULL || state.busy) return
        state = state.copy(busy = true, error = null)
        scope.launch {
            val outcome = withContext(Dispatchers.IO) {
                runCatching {
                    val baseline = scanner.establishBaseline(userId)
                    repository.activate(userId, baseline, System.currentTimeMillis())
                }
            }
            if (accountUserId != userId) return@launch
            if (outcome.isFailure) {
                state = state.copy(busy = false, error = SCAN_ERROR)
            } else {
                refresh(userId)
            }
        }
    }

    fun scan(scope: CoroutineScope) {
        val userId = accountUserId ?: return
        val config = state.config ?: return
        if (!config.enabled || state.permission != MediaPermissionAccess.FULL || state.busy) return
        state = state.copy(busy = true, error = null)
        scope.launch {
            val outcome = withContext(Dispatchers.IO) {
                runCatching {
                    val snapshot = repository.snapshot(userId)
                    val result = scanner.scan(userId, snapshot.baselines)
                    repository.recordScan(userId, result, System.currentTimeMillis())
                }
            }
            if (accountUserId != userId) return@launch
            if (outcome.isFailure) {
                state = state.copy(busy = false, error = SCAN_ERROR)
            } else {
                refresh(userId)
            }
        }
    }

    private suspend fun refresh(userId: String) {
        val snapshot = withContext(Dispatchers.IO) { repository.snapshot(userId) }
        if (accountUserId != userId) return
        state = state.copy(
            config = snapshot.config,
            counts = snapshot.counts,
            latestPending = snapshot.latestPending,
            loading = false,
            busy = false,
            error = null,
        )
    }

    data class CameraBackupState(
        val accountUserId: String? = null,
        val permission: MediaPermissionAccess = MediaPermissionAccess.NOT_REQUESTED,
        val config: AgentConfig? = null,
        val counts: PendingCounts = PendingCounts(0, 0),
        val latestPending: List<LocalMediaItem> = emptyList(),
        val loading: Boolean = false,
        val busy: Boolean = false,
        val error: String? = null,
    )

    private companion object {
        const val SCAN_ERROR = "No se pudo analizar la carpeta Cámara. Revisa el acceso e inténtalo de nuevo."
    }
}
