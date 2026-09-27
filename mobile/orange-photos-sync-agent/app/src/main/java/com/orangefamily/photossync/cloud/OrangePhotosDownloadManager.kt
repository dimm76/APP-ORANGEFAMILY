package com.orangefamily.photossync.cloud

import com.orangefamily.photossync.data.LocalMediaItem
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class CloudDownloadStatus {
    IDLE,
    RUNNING,
    COMPLETED,
    CANCELLED,
    FAILED,
}

data class CloudDownloadState(
    val accountUserId: String? = null,
    val status: CloudDownloadStatus = CloudDownloadStatus.IDLE,
    val currentIndex: Int = 0,
    val totalItems: Int = 0,
    val displayName: String? = null,
    val bytesDownloaded: Long = 0L,
    val totalBytes: Long? = null,
    val completedItems: Int = 0,
    val completedMedia: List<LocalMediaItem> = emptyList(),
    val error: String? = null,
)

object OrangePhotosDownloadManager {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(CloudDownloadState())
    private var activeJob: Job? = null
    private var generation = 0L

    val state: StateFlow<CloudDownloadState> = mutableState.asStateFlow()

    fun start(
        accountUserId: String,
        photos: List<CloudPhoto>,
        downloader: CloudMediaDownloader,
    ) {
        if (photos.isEmpty() || mutableState.value.status == CloudDownloadStatus.RUNNING) return
        val runGeneration = ++generation
        mutableState.value = CloudDownloadState(
            accountUserId = accountUserId,
            status = CloudDownloadStatus.RUNNING,
            totalItems = photos.size,
        )
        activeJob = scope.launch {
            try {
                val completed = mutableListOf<LocalMediaItem>()
                photos.forEachIndexed { index, photo ->
                    ensureCurrent(runGeneration)
                    mutableState.value = mutableState.value.copy(
                        currentIndex = index + 1,
                        displayName = photo.originalFilename ?: photo.id,
                        bytesDownloaded = 0L,
                        totalBytes = null,
                    )
                    val item = downloader.download(photo) { downloaded, total ->
                        ensureCurrent(runGeneration)
                        mutableState.value = mutableState.value.copy(
                            currentIndex = index + 1,
                            displayName = photo.originalFilename ?: photo.id,
                            bytesDownloaded = downloaded,
                            totalBytes = total,
                            completedItems = completed.size,
                        )
                    }
                    completed += item
                    mutableState.value = mutableState.value.copy(
                        completedItems = completed.size,
                        completedMedia = completed.toList(),
                    )
                }
                if (generation == runGeneration) {
                    mutableState.value = mutableState.value.copy(status = CloudDownloadStatus.COMPLETED)
                }
            } catch (_: CancellationException) {
                if (generation == runGeneration) {
                    mutableState.value = mutableState.value.copy(status = CloudDownloadStatus.CANCELLED)
                }
            } catch (error: Throwable) {
                if (generation == runGeneration) {
                    mutableState.value = mutableState.value.copy(
                        status = CloudDownloadStatus.FAILED,
                        error = error.message ?: "No se pudo descargar el contenido.",
                    )
                }
            }
        }
    }

    fun cancel() {
        if (mutableState.value.status == CloudDownloadStatus.RUNNING) {
            activeJob?.cancel()
        }
    }

    fun reset() {
        generation += 1
        activeJob?.cancel()
        activeJob = null
        mutableState.value = CloudDownloadState()
    }

    private suspend fun ensureCurrent(runGeneration: Long) {
        mutex.withLock {
            if (generation != runGeneration) throw CancellationException("Descarga cancelada.")
        }
    }
}
