package com.orangefamily.photossync.data

import androidx.room.withTransaction

class CameraBackupRepository(
    private val database: OrangePhotosLocalDatabase,
) {
    private val dao = database.cameraBackupDao()

    suspend fun activate(accountUserId: String, baseline: BaselineSnapshot, now: Long) {
        database.withTransaction {
            val image = baseline.maximum(LocalMediaItem.TYPE_IMAGE)
            val video = baseline.maximum(LocalMediaItem.TYPE_VIDEO)
            dao.saveConfig(
                AgentConfig(
                    accountUserId = accountUserId,
                    activatedAt = now,
                    baselineImageDateAdded = image.dateAdded,
                    baselineImageId = image.mediaStoreId,
                    baselineVideoDateAdded = video.dateAdded,
                    baselineVideoId = video.mediaStoreId,
                    lastScanAt = null,
                    enabled = true,
                ),
            )
            dao.saveBaselines(baseline.baselines)
        }
    }

    suspend fun recordScan(accountUserId: String, result: MediaScanResult, scannedAt: Long) {
        database.withTransaction {
            val config = dao.getConfig(accountUserId)
                ?: error("El agente no está activado para esta cuenta.")
            check(config.enabled)
            val image = result.baseline.maximum(LocalMediaItem.TYPE_IMAGE)
            val video = result.baseline.maximum(LocalMediaItem.TYPE_VIDEO)
            dao.insertPending(result.items)
            dao.saveBaselines(result.baseline.baselines)
            dao.saveConfig(
                config.copy(
                    baselineImageDateAdded = image.dateAdded,
                    baselineImageId = image.mediaStoreId,
                    baselineVideoDateAdded = video.dateAdded,
                    baselineVideoId = video.mediaStoreId,
                    lastScanAt = scannedAt,
                ),
            )
        }
    }

    suspend fun snapshot(accountUserId: String): LocalInventorySnapshot = LocalInventorySnapshot(
        config = dao.getConfig(accountUserId),
        baselines = dao.getBaselines(accountUserId),
        counts = dao.getPendingCounts(accountUserId),
        latestPending = dao.getLatestPending(accountUserId),
    )
}

data class LocalInventorySnapshot(
    val config: AgentConfig?,
    val baselines: List<MediaBaseline>,
    val counts: PendingCounts,
    val latestPending: List<LocalMediaItem>,
)
