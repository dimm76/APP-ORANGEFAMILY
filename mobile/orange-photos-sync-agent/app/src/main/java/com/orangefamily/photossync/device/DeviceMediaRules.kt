package com.orangefamily.photossync.device

import com.orangefamily.photossync.data.LocalMediaItem

object DeviceMediaRules {
    fun shouldIgnoreLocalMedia(displayName: String?, mimeType: String?): Boolean {
        val normalizedName = displayName.orEmpty().trim().lowercase()
        val normalizedMime = mimeType.orEmpty().trim().lowercase()
        return normalizedName.endsWith(".dng") || normalizedMime.contains("dng")
    }

    fun shouldIgnoreLocalMedia(item: LocalMediaItem): Boolean =
        shouldIgnoreLocalMedia(item.displayName, item.mimeType)
    const val MAX_CHECK_BATCH = 200
    fun stableId(item: LocalMediaItem) = "${item.mediaCollection}:${item.mediaType}:${item.mediaStoreId}"
    const val REMOTE_STATUS_TTL_MS = 24L * 60L * 60L * 1000L
    fun isQueued(item: LocalMediaItem) = item.localStatus == LocalMediaItem.STATUS_PENDING
    fun isUploading(item: LocalMediaItem) = item.localStatus == LocalMediaItem.STATUS_UPLOADING
    fun isFailed(item: LocalMediaItem) = item.localStatus == LocalMediaItem.STATUS_FAILED
    fun isBackedUp(item: LocalMediaItem) = item.localStatus == LocalMediaItem.STATUS_UPLOADED || item.cloudStatus == LocalMediaItem.CLOUD_BACKED_UP
    fun isPending(item: LocalMediaItem) = isQueued(item)
    fun isVerificationPending(item: LocalMediaItem) = item.cloudStatus == LocalMediaItem.CLOUD_UNKNOWN || item.cloudStatus == LocalMediaItem.CLOUD_CHECKING
    fun safeToDelete(item: LocalMediaItem) = item.hasConfirmedRemoteCopy()
    fun uploadablePending(items: List<LocalMediaItem>) = items.filter(::isQueued)
    fun safeItems(items: List<LocalMediaItem>) = items.filter(::safeToDelete)
    fun needsVerification(item: LocalMediaItem, now: Long, force: Boolean = false) = force || item.remoteVerifiedAt == null || now - item.remoteVerifiedAt >= REMOTE_STATUS_TTL_MS || item.cloudStatus in setOf(LocalMediaItem.CLOUD_UNKNOWN, LocalMediaItem.CLOUD_ERROR)
    fun metadataChanged(existing: LocalMediaItem, scanned: LocalMediaItem) = existing.sizeBytes != scanned.sizeBytes || existing.dateModified != scanned.dateModified
    fun filterFolders(items:List<DeviceMediaFolder>,query:String):List<DeviceMediaFolder>{val normalized=query.trim();return if(normalized.isEmpty())items else items.filter{it.name.contains(normalized,true)}}
    fun range(items: List<LocalMediaItem>, anchor: Int, target: Int) = items.subList(minOf(anchor,target),maxOf(anchor,target)+1).map(::stableId).toSet()
    fun <T> batches(items: List<T>) = items.chunked(MAX_CHECK_BATCH)
}
