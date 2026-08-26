package com.orangefamily.photossync.data

import androidx.room.withTransaction

class CameraBackupRepository(
    private val database: OrangePhotosLocalDatabase,
) {
    private val dao = database.cameraBackupDao()

    suspend fun remoteLinkedItems(accountUserId:String,remotePhotoIds:List<String>)=dao.getRemoteLinkedItems(accountUserId,remotePhotoIds)

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

    suspend fun recordScan(accountUserId: String, result: MediaScanResult, scannedAt: Long): Int =
        database.withTransaction {
            val config = dao.getConfig(accountUserId)
                ?: error("El agente no está activado para esta cuenta.")
            check(config.enabled)
            val image = result.baseline.maximum(LocalMediaItem.TYPE_IMAGE)
            val video = result.baseline.maximum(LocalMediaItem.TYPE_VIDEO)
            val insertResults = dao.insertPending(result.items)
            var imported = 0
            result.items.forEachIndexed { index, item ->
                if (insertResults[index] != -1L) {
                    imported += 1
                } else {
                    imported += dao.promoteDiscoveredToPending(
                        accountUserId = item.accountUserId,
                        mediaCollection = item.mediaCollection,
                        mediaType = item.mediaType,
                        mediaStoreId = item.mediaStoreId,
                        detectedAt = item.detectedAt,
                    )
                }
            }
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
            imported
        }

    suspend fun snapshot(accountUserId: String): LocalInventorySnapshot = LocalInventorySnapshot(
        config = dao.getConfig(accountUserId),
        baselines = dao.getBaselines(accountUserId),
        counts = dao.getPendingCounts(accountUserId),
        latestPending = dao.getLatestPending(accountUserId),
        syncCounts = dao.getSyncCounts(accountUserId),
    )

    suspend fun config(accountUserId: String) = dao.getConfig(accountUserId)
    fun observeConfig(accountUserId: String) = dao.observeConfig(accountUserId)
    fun observePendingCounts(accountUserId: String) = dao.observePendingCounts(accountUserId)
    fun observeLatestPending(accountUserId: String) = dao.observeLatestPending(accountUserId)
    fun observeSyncCounts(accountUserId: String) = dao.observeSyncCounts(accountUserId)
    suspend fun baselines(accountUserId: String) = dao.getBaselines(accountUserId)
    suspend fun recoverUploading(accountUserId: String) = dao.recoverUploading(accountUserId)
    suspend fun syncBatch(accountUserId: String, limit: Int) = dao.getSyncBatch(accountUserId, limit)
    suspend fun syncCandidatesByIds(
        accountUserId: String,
        ids: List<Long>,
    ) = dao.getSyncCandidatesByIds(
        accountUserId = accountUserId,
        ids = ids,
    )
    suspend fun countSyncCandidates(accountUserId: String) =
        dao.countSyncCandidates(accountUserId)
    suspend fun syncBatchAfter(
        accountUserId: String,
        afterDetectedAt: Long?,
        afterId: Long?,
        limit: Int,
    ) = dao.getSyncBatchAfter(
        accountUserId = accountUserId,
        afterDetectedAt = afterDetectedAt,
        afterId = afterId,
        limit = limit,
    )
    suspend fun latestFailed(accountUserId: String, limit: Int = 10) = dao.getLatestFailed(accountUserId, limit)
    suspend fun syncCounts(accountUserId: String) = dao.getSyncCounts(accountUserId)
    fun observeUploadHeaderCounts(accountUserId: String) = dao.observeUploadHeaderCounts(accountUserId)
    suspend fun updateChecksum(accountUserId: String, id: Long, checksum: String) = dao.updateChecksum(accountUserId, id, checksum)
    suspend fun markAttempt(accountUserId: String, id: Long, status: String, at: Long, code: String?) = dao.markAttempt(accountUserId, id, status, at, code)
    suspend fun markUploaded(accountUserId: String, id: Long, remoteId: String, checksum: String, at: Long) = dao.markUploaded(accountUserId, id, remoteId, checksum, at)
    suspend fun markSuppressed(accountUserId: String, id: Long, checksum: String, at: Long) = dao.markSuppressed(accountUserId, id, checksum, at)
    suspend fun markRestoreAvailable(accountUserId: String, id: Long, remoteId: String, checksum: String, at: Long) = dao.markRestoreAvailable(accountUserId, id, remoteId, checksum, at)
    suspend fun tryAcquireSyncLock(accountUserId: String, token: String, now: Long, expiresAt: Long) = dao.tryAcquireSyncLock(accountUserId, token, now, expiresAt) == 1
    suspend fun recoverAbandonedSyncLock(accountUserId: String, now: Long, maximumAllowedExpiry: Long) = dao.recoverAbandonedSyncLock(accountUserId, now, maximumAllowedExpiry)
    suspend fun releaseSyncLock(accountUserId: String, token: String) = dao.releaseSyncLock(accountUserId, token)
    suspend fun refreshSyncLock(accountUserId: String, token: String, expiresAt: Long) = dao.refreshSyncLock(accountUserId, token, expiresAt) == 1
    suspend fun multipartSession(localMediaItemId: Long) = dao.getMultipartSession(localMediaItemId)
    suspend fun multipartParts(localMediaItemId: Long) = dao.getMultipartParts(localMediaItemId)
    suspend fun saveMultipartSession(session: MultipartUploadSession) = dao.saveMultipartSession(session)
    suspend fun saveMultipartPart(part: MultipartUploadPart) = dao.saveMultipartPart(part)
    suspend fun clearMultipart(localMediaItemId: Long) = database.withTransaction {
        dao.deleteMultipartParts(localMediaItemId)
        dao.deleteMultipartSession(localMediaItemId)
    }
    fun observeBucketItems(accountUserId: String, bucketId: String) = dao.observeBucketItems(accountUserId, bucketId)
    suspend fun bucketItems(accountUserId: String, bucketId: String) = dao.getBucketItems(accountUserId, bucketId)
    suspend fun findMediaItem(accountUserId: String, collection: String, mediaType: String, mediaStoreId: Long) = dao.findMediaItem(accountUserId, collection, mediaType, mediaStoreId)
    suspend fun upsertDeviceMedia(items: List<LocalMediaItem>) = dao.upsertDeviceMedia(items)
    suspend fun updateDeviceHash(item: LocalMediaItem, checksum: String, at: Long) = dao.saveDeviceHash(item.accountUserId, item.mediaCollection, item.mediaType, item.mediaStoreId, checksum, at)
    suspend fun markChecking(item: LocalMediaItem) = dao.markChecking(item.accountUserId, item.mediaCollection, item.mediaType, item.mediaStoreId)
    suspend fun invalidateBucketVerification(accountUserId: String, bucketId: String) = dao.invalidateBucketVerification(accountUserId, bucketId)
    suspend fun updateCloudStatus(item: LocalMediaItem, status: String, remoteId: String?, at: Long) = dao.updateCloudStatus(item.accountUserId, item.mediaCollection, item.mediaType, item.mediaStoreId, status, remoteId, at)
    suspend fun removeLocalItem(item: LocalMediaItem) = dao.removeLocalItem(item.accountUserId, item.mediaCollection, item.mediaType, item.mediaStoreId)
    suspend fun enqueueDeviceMedia(items: List<LocalMediaItem>, forceDuplicate: Boolean = false) = database.withTransaction {
        items.forEach { item ->
            val existing=dao.findMediaItem(item.accountUserId,item.mediaCollection,item.mediaType,item.mediaStoreId)
            if(existing==null) dao.upsertDeviceMedia(listOf(item.copy(localStatus=LocalMediaItem.STATUS_PENDING)))
            else dao.enqueueDeviceMedia(existing.accountUserId,existing.mediaCollection,existing.mediaType,existing.mediaStoreId,forceDuplicate)
        }
    }
}

data class LocalInventorySnapshot(
    val config: AgentConfig?,
    val baselines: List<MediaBaseline>,
    val counts: PendingCounts,
    val latestPending: List<LocalMediaItem>,
    val syncCounts: SyncCounts,
)
