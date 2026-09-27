package com.orangefamily.photossync.cloud

import com.orangefamily.photossync.data.LocalMediaItem
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

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
    private val stateLock = Any()
    private val mutableState = MutableStateFlow(CloudDownloadState())
    private var activeJob: Job? = null
    private var generation = 0L

    val state: StateFlow<CloudDownloadState> = mutableState.asStateFlow()

    fun start(
        accountUserId: String,
        photos: List<CloudPhoto>,
        downloader: CloudMediaDownloader,
    ) {
        if (photos.isEmpty()) return
        val job: Job
        val runGeneration: Long
        synchronized(stateLock) {
            if (mutableState.value.status == CloudDownloadStatus.RUNNING) return
            runGeneration = ++generation
            mutableState.value = CloudDownloadState(
                accountUserId = accountUserId,
                status = CloudDownloadStatus.RUNNING,
                totalItems = photos.size,
            )
            job = scope.launch(start = CoroutineStart.LAZY) {
            try {
                val completed = mutableListOf<LocalMediaItem>()
                photos.forEachIndexed { index, photo ->
                    updateCurrent(runGeneration) {
                        it.copy(
                        currentIndex = index + 1,
                        displayName = photo.originalFilename ?: photo.id,
                        bytesDownloaded = 0L,
                        totalBytes = null,
                        )
                    }
                    val item = downloader.download(photo) { downloaded, total ->
                        updateCurrent(runGeneration) {
                            it.copy(
                            currentIndex = index + 1,
                            displayName = photo.originalFilename ?: photo.id,
                            bytesDownloaded = downloaded,
                            totalBytes = total,
                            completedItems = completed.size,
                            )
                        }
                    }
                    completed += item
                    updateCurrent(runGeneration) {
                        it.copy(
                        completedItems = completed.size,
                        completedMedia = completed.toList(),
                        )
                    }
                }
                synchronized(stateLock) {
                    if (generation == runGeneration) {
                        mutableState.value = mutableState.value.copy(status = CloudDownloadStatus.COMPLETED)
                        activeJob = null
                    }
                }
            } catch (_: CancellationException) {
                synchronized(stateLock) {
                    if (generation == runGeneration) {
                        mutableState.value = mutableState.value.copy(status = CloudDownloadStatus.CANCELLED)
                        activeJob = null
                    }
                }
            } catch (error: Throwable) {
                synchronized(stateLock) {
                    if (generation == runGeneration) {
                        mutableState.value = mutableState.value.copy(
                            status = CloudDownloadStatus.FAILED,
                            error = error.message ?: "No se pudo descargar el contenido.",
                        )
                        activeJob = null
                    }
                }
            }
            }
            activeJob = job
        }
        job.start()
    }

    fun cancel() {
        val job = synchronized(stateLock) {
            if (mutableState.value.status == CloudDownloadStatus.RUNNING) activeJob else null
        }
        job?.cancel()
    }

    fun reset() {
        val job = synchronized(stateLock) {
            generation += 1
            val currentJob = activeJob
            activeJob = null
            mutableState.value = CloudDownloadState()
            currentJob
        }
        job?.cancel()
    }

    private fun updateCurrent(
        runGeneration: Long,
        transform: (CloudDownloadState) -> CloudDownloadState,
    ) {
        synchronized(stateLock) {
            if (generation != runGeneration) {
                throw CancellationException("Descarga cancelada.")
            }
            mutableState.value = transform(mutableState.value)
        }
    }
}
