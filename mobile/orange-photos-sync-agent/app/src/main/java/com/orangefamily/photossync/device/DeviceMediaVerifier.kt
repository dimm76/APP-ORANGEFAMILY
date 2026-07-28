package com.orangefamily.photossync.device

import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.sync.OrangePhotosSyncApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DeviceMediaVerifier(
    private val repository:CameraBackupRepository,
    private val hashService:DeviceMediaHashService,
    private val apiProvider:suspend()->OrangePhotosSyncApi?,
) {
    suspend fun importBucket(scannedItems:List<LocalMediaItem>) {
        val merged=scannedItems.map { scanned ->
            val existing=repository.findMediaItem(scanned.accountUserId,scanned.mediaCollection,scanned.mediaType,scanned.mediaStoreId)
            if(existing==null)scanned.copy(cloudStatus=LocalMediaItem.CLOUD_UNKNOWN)
            else {
                val unchanged=!DeviceMediaRules.metadataChanged(existing,scanned)
                scanned.copy(id=existing.id,localStatus=existing.localStatus,checksumSha256=existing.checksumSha256.takeIf{unchanged},hashAlgorithm=existing.hashAlgorithm.takeIf{unchanged},hashComputedAt=existing.hashComputedAt.takeIf{unchanged},cloudStatus=existing.cloudStatus.takeIf{unchanged}?:LocalMediaItem.CLOUD_UNKNOWN,remotePhotoId=existing.remotePhotoId.takeIf{unchanged},remoteVerifiedAt=existing.remoteVerifiedAt.takeIf{unchanged},lastAttemptAt=existing.lastAttemptAt,failureCode=existing.failureCode)
            }
        }
        repository.upsertDeviceMedia(merged)
    }

    suspend fun verifyBucket(accountUserId:String,bucketId:String,force:Boolean=false) {
        if(force)repository.invalidateBucketVerification(accountUserId,bucketId)
        val now=System.currentTimeMillis()
        val candidates=repository.bucketItems(accountUserId,bucketId).filter{DeviceMediaRules.needsVerification(it,now,force)}
        val hashed=mutableListOf<Pair<LocalMediaItem,String>>()
        for(item in candidates){
            repository.markChecking(item)
            try { val hash=item.checksumSha256?:hashService.sha256(item.contentUri).also{repository.updateDeviceHash(item,it,now)}; hashed+=item to hash }
            catch(_:Exception){ repository.updateCloudStatus(item,LocalMediaItem.CLOUD_ERROR,null,now) }
        }
        val api=apiProvider() ?: run { hashed.forEach{repository.updateCloudStatus(it.first,LocalMediaItem.CLOUD_ERROR,null,now)}; return }
        hashed.chunked(DeviceMediaRules.MAX_CHECK_BATCH).forEach { batch ->
            try {
                val results=withContext(Dispatchers.IO){api.checkStorageStatus(batch.map{(item,hash)->OrangePhotosSyncApi.StorageStatusRequestItem(DeviceMediaRules.stableId(item),hash,item.sizeBytes,item.displayName)})}
                val byId=results.associateBy{it.clientId}
                batch.forEach { (item,_) -> val result=byId[DeviceMediaRules.stableId(item)]; repository.updateCloudStatus(item,mapStatus(result?.status),result?.remotePhotoId,now) }
            } catch(_:Exception){ batch.forEach{repository.updateCloudStatus(it.first,LocalMediaItem.CLOUD_ERROR,null,now)} }
        }
    }

    private fun mapStatus(value:String?)=when(value){
        "backed_up"->LocalMediaItem.CLOUD_BACKED_UP
        "possible_match"->LocalMediaItem.CLOUD_POSSIBLE_MATCH
        "not_found"->LocalMediaItem.CLOUD_NOT_FOUND
        "remote_missing"->LocalMediaItem.CLOUD_REMOTE_MISSING
        else->LocalMediaItem.CLOUD_ERROR
    }
}
