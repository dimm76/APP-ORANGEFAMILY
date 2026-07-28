package com.orangefamily.photossync.device

import com.orangefamily.photossync.data.LocalMediaItem

object DeviceMediaRules {
    const val MAX_CHECK_BATCH = 200
    fun stableId(item: LocalMediaItem) = "${item.mediaCollection}:${item.mediaType}:${item.mediaStoreId}"
    const val REMOTE_STATUS_TTL_MS = 24L * 60L * 60L * 1000L
    fun isPending(item: LocalMediaItem) = item.cloudStatus in setOf(LocalMediaItem.CLOUD_NOT_FOUND, LocalMediaItem.CLOUD_POSSIBLE_MATCH, LocalMediaItem.CLOUD_REMOTE_MISSING, LocalMediaItem.CLOUD_ERROR) || item.localStatus == LocalMediaItem.STATUS_FAILED
    fun isVerificationPending(item: LocalMediaItem) = item.cloudStatus == LocalMediaItem.CLOUD_UNKNOWN || item.cloudStatus == LocalMediaItem.CLOUD_CHECKING
    fun safeToDelete(item: LocalMediaItem) = item.hasConfirmedRemoteCopy()
    fun uploadablePending(items: List<LocalMediaItem>) = items.filter(::isPending)
    fun safeItems(items: List<LocalMediaItem>) = items.filter(::safeToDelete)
    fun needsVerification(item: LocalMediaItem, now: Long, force: Boolean = false) = force || item.remoteVerifiedAt == null || now - item.remoteVerifiedAt >= REMOTE_STATUS_TTL_MS || item.cloudStatus in setOf(LocalMediaItem.CLOUD_UNKNOWN, LocalMediaItem.CLOUD_ERROR)
    fun metadataChanged(existing: LocalMediaItem, scanned: LocalMediaItem) = existing.sizeBytes != scanned.sizeBytes || existing.dateModified != scanned.dateModified
    fun filterFolders(items:List<DeviceMediaFolder>,query:String):List<DeviceMediaFolder>{val normalized=query.trim();return if(normalized.isEmpty())items else items.filter{it.name.contains(normalized,true)}}
    fun range(items: List<LocalMediaItem>, anchor: Int, target: Int) = items.subList(minOf(anchor,target),maxOf(anchor,target)+1).map(::stableId).toSet()
    fun <T> batches(items: List<T>) = items.chunked(MAX_CHECK_BATCH)
}
