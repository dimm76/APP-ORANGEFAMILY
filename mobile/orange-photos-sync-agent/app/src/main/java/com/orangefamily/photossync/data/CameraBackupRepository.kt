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
        syncCounts = dao.getSyncCounts(accountUserId),
    )

    suspend fun config(accountUserId: String) = dao.getConfig(accountUserId)
    suspend fun baselines(accountUserId: String) = dao.getBaselines(accountUserId)
    suspend fun recoverUploading(accountUserId: String) = dao.recoverUploading(accountUserId)
    suspend fun syncBatch(accountUserId: String, limit: Int) = dao.getSyncBatch(accountUserId, limit)
    suspend fun latestFailed(accountUserId: String, limit: Int = 10) = dao.getLatestFailed(accountUserId, limit)
    suspend fun updateChecksum(accountUserId: String, id: Long, checksum: String) = dao.updateChecksum(accountUserId, id, checksum)
    suspend fun markAttempt(accountUserId: String, id: Long, status: String, at: Long, code: String?) = dao.markAttempt(accountUserId, id, status, at, code)
    suspend fun markUploaded(accountUserId: String, id: Long, remoteId: String, checksum: String, at: Long) = dao.markUploaded(accountUserId, id, remoteId, checksum, at)
    suspend fun markSuppressed(accountUserId: String, id: Long, checksum: String, at: Long) = dao.markSuppressed(accountUserId, id, checksum, at)
    suspend fun markRestoreAvailable(accountUserId: String, id: Long, remoteId: String, checksum: String, at: Long) = dao.markRestoreAvailable(accountUserId, id, remoteId, checksum, at)
    suspend fun tryAcquireSyncLock(accountUserId: String, token: String, now: Long, expiresAt: Long) = dao.tryAcquireSyncLock(accountUserId, token, now, expiresAt) == 1
    suspend fun releaseSyncLock(accountUserId: String, token: String) = dao.releaseSyncLock(accountUserId, token)
}

data class LocalInventorySnapshot(
    val config: AgentConfig?,
    val baselines: List<MediaBaseline>,
    val counts: PendingCounts,
    val latestPending: List<LocalMediaItem>,
    val syncCounts: SyncCounts,
)
