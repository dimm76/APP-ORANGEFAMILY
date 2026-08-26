package com.orangefamily.photossync.sync

import android.content.Context
import android.net.Uri
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.orangefamily.photossync.BuildConfig
import com.orangefamily.photossync.auth.OrangeFamilyAuthApi
import com.orangefamily.photossync.auth.SecureSessionStore
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.data.MultipartUploadPart
import com.orangefamily.photossync.data.MultipartUploadSession
import com.orangefamily.photossync.data.OrangePhotosLocalDatabase
import com.orangefamily.photossync.device.InstallationIdStore
import com.orangefamily.photossync.media.CameraMediaScanner
import com.orangefamily.photossync.media.MediaPermissionAccess
import com.orangefamily.photossync.media.MediaPermissions
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.UUID
import kotlinx.coroutines.delay

class OrangePhotosSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        Log.d(TAG, "Worker started")
        val manualTrigger =
            inputData.getBoolean(INPUT_MANUAL_TRIGGER, false)
        val manualItemIds = inputData.getLongArray(INPUT_MANUAL_ITEM_IDS)
            ?.asSequence()
            ?.filter { it > 0L }
            ?.distinct()
            ?.toList()
            .orEmpty()
        val targetedManualRun = manualTrigger && manualItemIds.isNotEmpty()
        val sessionStore = SecureSessionStore(applicationContext)
        val sessionToken = sessionStore.load(BuildConfig.API_BASE_URL) ?: return success()
        val installationId = InstallationIdStore(applicationContext).getOrCreate()
        val api = OrangePhotosSyncApi(BuildConfig.API_BASE_URL, sessionToken, installationId)
        val user = when (val current = runCatching { api.currentUser() }.getOrElse { error ->
            Log.e(TAG, "Worker exception=${error.javaClass.simpleName} message=${error.message}", error)
            return retry()
        }) {
            is OrangeFamilyAuthApi.CurrentUserResult.Success -> current.user
            OrangeFamilyAuthApi.CurrentUserResult.Unauthorized -> { sessionStore.clear(); return success() }
            is OrangeFamilyAuthApi.CurrentUserResult.Failure -> return retry()
        }
        if (MediaPermissions.evaluate(applicationContext) != MediaPermissionAccess.FULL) return success()

        val accountUserId = user.id
        Log.d(TAG, "accountUserId=$accountUserId")
        val repository = CameraBackupRepository(OrangePhotosLocalDatabase.getInstance(applicationContext))
        val config = repository.config(accountUserId) ?: return success()
        if (!config.enabled) return success()
        val lockToken = UUID.randomUUID().toString()
        ACTIVE_SYNC_LOCK_TOKENS.add(lockToken)
        var databaseLockAcquired = false

        try {
            val persistedLockToken = config.syncLockToken?.trim()?.takeIf { it.isNotBlank() }
            if (persistedLockToken != null && persistedLockToken !in ACTIVE_SYNC_LOCK_TOKENS) {
                repository.releaseSyncLock(accountUserId, persistedLockToken)
                Log.w(TAG, "Recovered orphaned sync lock accountUserId=$accountUserId")
            }

            val lockNow = System.currentTimeMillis()
            val recoveredLocks = repository.recoverAbandonedSyncLock(accountUserId, lockNow, lockNow + LOCK_TTL_MS)
            if (recoveredLocks > 0) {
                Log.w(TAG, "Recovered abandoned sync lock accountUserId=$accountUserId")
            }
            if (!repository.tryAcquireSyncLock(accountUserId, lockToken, lockNow, lockNow + LOCK_TTL_MS)) {
                if (manualTrigger) {
                    Log.d(
                        TAG,
                        "Manual worker retry because sync lock is active accountUserId=$accountUserId",
                    )
                    return retry()
                }

                Log.d(TAG, "Worker skipped because sync lock is active accountUserId=$accountUserId")
                return success()
            }
            databaseLockAcquired = true

            if (!targetedManualRun) {
                try {
                    Log.d(TAG, "Scan started accountUserId=$accountUserId")
                    val scan = CameraMediaScanner(applicationContext).scan(accountUserId, repository.baselines(accountUserId))
                    val imported = repository.recordScan(accountUserId, scan, System.currentTimeMillis())
                    Log.d(TAG, "Scan completed discovered=${scan.items.size} imported=$imported accountUserId=$accountUserId")
                } catch (error: SecurityException) {
                    Log.e(TAG, "Worker exception=${error.javaClass.simpleName} message=${error.message}", error)
                    return success()
                } catch (error: Exception) {
                    Log.e(TAG, "Worker exception=${error.javaClass.simpleName} message=${error.message}", error)
                    return retry()
                }
            } else {
                Log.d(TAG, "Targeted manual sync items=${manualItemIds.size} accountUserId=$accountUserId")
            }

            repository.recoverUploading(accountUserId)
            val targetedCandidates = if (targetedManualRun) {
                repository.syncCandidatesByIds(
                    accountUserId = accountUserId,
                    ids = manualItemIds,
                )
            } else {
                null
            }
            val connectivity=applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val isUnmetered=connectivity.getNetworkCapabilities(connectivity.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)==true
            val networkPolicy=UploadNetworkPolicyStore(applicationContext).get(accountUserId)
            var transientFailure = false
            var uploadedThisRun = 0
            var failedThisRun = 0
            val totalThisRun = targetedCandidates?.size ?: repository.countSyncCandidates(accountUserId)
            Log.d(TAG, "Sync run selected total=$totalThisRun accountUserId=$accountUserId")
            OrangePhotosUploadProgress.update(UploadProgressState(running=totalThisRun>0,totalThisRun=totalThisRun,pendingThisRun=totalThisRun))
            var afterDetectedAt: Long? = null
            var afterId: Long? = null
            var visitedThisRun = 0
            while (visitedThisRun < totalThisRun) {
            val remaining = totalThisRun - visitedThisRun
            val batch = if (targetedCandidates != null) {
                targetedCandidates.drop(visitedThisRun).take(minOf(BATCH_SIZE, remaining))
            } else {
                repository.syncBatchAfter(accountUserId,afterDetectedAt,afterId,minOf(BATCH_SIZE,remaining))
            }
            Log.d(TAG, "Batch selected size=${batch.size} visited=$visitedThisRun total=$totalThisRun accountUserId=$accountUserId")
            if (batch.isEmpty()) break
            for (item in batch) {
            visitedThisRun += 1
            afterDetectedAt = item.detectedAt
            afterId = item.id
            OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(pendingThisRun=(totalThisRun-visitedThisRun).coerceAtLeast(0)))
            if (item.failureCode in NON_RETRYABLE_CODES) continue
            if(!UploadNetworkRules.canUpload(networkPolicy,isUnmetered,item.sizeBytes)){OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(deferredByNetwork=OrangePhotosUploadProgress.state.value.deferredByNetwork+1));continue}
            OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(running=true,itemId=item.id,displayName=item.displayName,bytesSent=0,totalBytes=item.sizeBytes))
            Log.d(TAG, "Processing item=${item.id} name=${item.displayName}")
            val attemptedAt = System.currentTimeMillis()
            repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_UPLOADING, attemptedAt, null)
            var completed=false
            var checksumForAttempt:String?=null;var uploadMode:String?=null;var bytesSent=0L
            try {
                val checksum = item.checksumSha256 ?: hash(item).also {
                    repository.updateChecksum(accountUserId, item.id, it)
                }
                checksumForAttempt=checksum
                val forceDuplicate = item.failureCode == "FORCE_DUPLICATE"
                val check = api.checkUpload(item, checksum, forceDuplicate)
                uploadMode=check.uploadMode
                Log.d(
                    TAG,
                    "Preflight decision=${check.decision} mode=${check.uploadMode} " +
                        "item=${item.id} sizeBytes=${item.sizeBytes}",
                )
                when (check.decision) {
                    "already_owned" -> {
                        repository.clearMultipart(item.id)
                        repository.markUploaded(accountUserId, item.id, requireRemoteId(check.photoId), checksum, attemptedAt)
                    }
                    "restore_available" -> repository.markRestoreAvailable(accountUserId, item.id, requireRemoteId(check.photoId), checksum, attemptedAt)
                    "suppressed" -> repository.markSuppressed(accountUserId, item.id, checksum, attemptedAt)
                    "upload_required" -> {
                        val remoteId = when (check.uploadMode) {
                            "simple" -> api.uploadSimple(item,checksum,applicationContext.contentResolver,forceDuplicate){sent,total->bytesSent=sent;OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(bytesSent=sent,totalBytes=total))}
                            "direct_backend" -> api.uploadDirect(item,checksum,applicationContext.contentResolver,forceDuplicate){sent,total->bytesSent=sent;OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(bytesSent=sent,totalBytes=total))}
                            "multipart" -> uploadMultipart(item, repository, api, installationId, forceDuplicate, accountUserId, lockToken) { sent ->
                                bytesSent = sent
                                OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(bytesSent=sent,totalBytes=item.sizeBytes))
                            }
                            else -> throw ItemFailure("INVALID_UPLOAD_MODE")
                        }
                        repository.markUploaded(accountUserId, item.id, remoteId, checksum, attemptedAt)
                    }
                    else -> throw ItemFailure("INVALID_UPLOAD_DECISION")
                }
                completed=true
                uploadedThisRun+=1
                OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.withCompleted(uploadedThisRun,failedThisRun).copy(bytesSent=item.sizeBytes,totalBytes=item.sizeBytes,pendingThisRun=(totalThisRun-visitedThisRun).coerceAtLeast(0)))
            } catch (error: OrangePhotosSyncApi.LocalFileUnavailableException) {
                val failureCode = "LOCAL_FILE_UNAVAILABLE"
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, failureCode)
                Log.e(TAG, "Item failed id=${item.id} code=$failureCode exception=${error.javaClass.simpleName} message=${error.message}", error)
            } catch (error: OrangePhotosSyncApi.SyncApiException) {
                Log.e(TAG, "HTTP status=${error.status} code=${error.code} exception=${error.javaClass.simpleName} message=${error.message}", error)
                if (error.status == 401) { sessionStore.clear(); return success() }
                if(error.status==409&&error.code=="DUPLICATE_FILE"&&checksumForAttempt!=null){val reconciled=runCatching{api.checkUpload(item,checksumForAttempt!!,false)}.getOrNull()?.let{UploadNetworkRules.reconciledRemoteId(it.decision,it.photoId)};if(reconciled!=null){repository.markUploaded(accountUserId,item.id,reconciled,checksumForAttempt!!,attemptedAt);completed=true;uploadedThisRun+=1}else repository.markAttempt(accountUserId,item.id,LocalMediaItem.STATUS_FAILED,attemptedAt,"DUPLICATE_RECONCILIATION_REQUIRED")}else{val code=error.code.ifBlank{"HTTP_${error.status}"};repository.markAttempt(accountUserId,item.id,LocalMediaItem.STATUS_FAILED,attemptedAt,code);Log.e(TAG,"Item failed id=${item.id} code=$code",error);if(OrangePhotosSyncPolicy.isTransient(error.status,code))transientFailure=true}
            } catch (error: ItemFailure) {
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, error.code)
                Log.e(TAG, "Item failed id=${item.id} code=${error.code} exception=${error.javaClass.simpleName} message=${error.message}", error)
            } catch (error: IOException) {
                val reconciled=if(bytesSent>0&&checksumForAttempt!=null){delay(1500);runCatching{api.checkUpload(item,checksumForAttempt!!,false)}.getOrNull()?.let{UploadNetworkRules.reconciledRemoteId(it.decision,it.photoId)}}else null
                if(reconciled!=null){repository.markUploaded(accountUserId,item.id,reconciled,checksumForAttempt!!,attemptedAt);completed=true;uploadedThisRun+=1}else{val failureCode=UploadNetworkRules.interruptedFailureCode(uploadMode,item.sizeBytes,bytesSent);repository.markAttempt(accountUserId,item.id,LocalMediaItem.STATUS_FAILED,attemptedAt,failureCode);Log.e(TAG,"Item failed id=${item.id} code=$failureCode",error);if(failureCode=="NETWORK_ERROR")transientFailure=true}
            } catch (error: Exception) {
                val failureCode = "INTERNAL_ERROR"
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, failureCode)
                Log.e(TAG, "Item failed id=${item.id} code=$failureCode exception=${error.javaClass.simpleName} message=${error.message}", error)
                transientFailure = true
            } finally {
                if(!completed)failedThisRun+=1;OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.withCompleted(uploadedThisRun,failedThisRun).copy(pendingThisRun=(totalThisRun-visitedThisRun).coerceAtLeast(0)))
            }
            }
            }
            if(OrangePhotosUploadProgress.state.value.deferredByNetwork>0) {
                Log.d(TAG, "Deferred by network count=${OrangePhotosUploadProgress.state.value.deferredByNetwork}")
                OrangePhotosSyncScheduler(applicationContext).scheduleUnmeteredSync(accountUserId)
            }
            OrangePhotosSyncNotifier(applicationContext).notifyResult(uploadedThisRun, repository.syncCounts(accountUserId).failed)
            return if (transientFailure) retry() else success()
        } finally {
            if (databaseLockAcquired) {
                repository.releaseSyncLock(accountUserId, lockToken)
            }
            ACTIVE_SYNC_LOCK_TOKENS.remove(lockToken)
            OrangePhotosUploadProgress.update(OrangePhotosUploadProgress.state.value.copy(running=false,itemId=null,bytesSent=0,totalBytes=0))
        }
    }

    private fun hash(item: LocalMediaItem): String {
        val digest = MessageDigest.getInstance("SHA-256")
        applicationContext.contentResolver.openInputStream(Uri.parse(item.contentUri))?.use { input ->
            val buffer = ByteArray(OrangePhotosSyncApi.BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        } ?: throw OrangePhotosSyncApi.LocalFileUnavailableException()
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private suspend fun uploadMultipart(
        item: LocalMediaItem,
        repository: CameraBackupRepository,
        api: OrangePhotosSyncApi,
        installationId: String,
        forceDuplicate: Boolean,
        accountUserId: String,
        lockToken: String,
        onProgress: (Long) -> Unit,
    ): String {
        val clientUploadKey = "android:$installationId:${item.id}"
        var local = repository.multipartSession(item.id)
        var remote = if (local == null) null else try {
            api.multipartStatus(local.serverUploadId)
        } catch (error: OrangePhotosSyncApi.SyncApiException) {
            if (error.status == 404 || error.status == 410 || error.code in setOf("UPLOAD_NOT_FOUND", "UPLOAD_EXPIRED")) {
                repository.clearMultipart(item.id)
                local = null
                null
            } else throw error
        }
        if (local == null) {
            val initiated = api.initiateMultipart(item, clientUploadKey, forceDuplicate)
            local = MultipartUploadSession(item.id,item.accountUserId,initiated.id,clientUploadKey,initiated.partSize,initiated.partsTotal,initiated.expiresAt,initiated.status,System.currentTimeMillis())
            repository.saveMultipartSession(local)
            remote = api.multipartStatus(initiated.id)
        }
        val session = requireNotNull(local)
        val status = requireNotNull(remote)
        val completed = status.completedParts.associateBy { it.partNumber }.toMutableMap()
        status.completedParts.forEach { part ->
            repository.saveMultipartPart(MultipartUploadPart(item.id,part.partNumber,part.etag,part.sizeBytes.takeIf { it > 0 } ?: partLength(item,session,part.partNumber)))
        }
        var confirmed = MultipartUploadRules.confirmedBytes(item.sizeBytes, session.partSize, completed.keys)
        onProgress(confirmed)
        val missing = MultipartUploadRules.missingParts(session.partsTotal, completed.keys)
        for (batch in missing.chunked(10)) {
            for (signed in api.signMultipartParts(session.serverUploadId, batch)) {
                check(repository.refreshSyncLock(accountUserId, lockToken, System.currentTimeMillis() + LOCK_TTL_MS))
                val length = partLength(item, session, signed.partNumber)
                val offset = (signed.partNumber - 1L) * session.partSize
                val etag = api.uploadMultipartPart(signed,item,offset,length,applicationContext.contentResolver) { current -> onProgress(confirmed + current) }
                val part = OrangePhotosSyncApi.CompletedPart(signed.partNumber,etag,length)
                completed[signed.partNumber] = part
                repository.saveMultipartPart(MultipartUploadPart(item.id,part.partNumber,part.etag,part.sizeBytes))
                confirmed += length
                onProgress(confirmed)
            }
        }
        val remoteId = api.completeMultipart(session.serverUploadId, completed.values.toList())
        repository.clearMultipart(item.id)
        return remoteId
    }

    private fun partLength(item: LocalMediaItem, session: MultipartUploadSession, partNumber: Int): Long =
        MultipartUploadRules.partLength(item.sizeBytes, session.partSize, partNumber)

    private fun requireRemoteId(value: String?) = OrangePhotosSyncPolicy.confirmedRemoteId(value) ?: throw ItemFailure("INVALID_UPLOAD_RESPONSE")
    private fun success(): Result { Log.d(TAG, "Worker result=success"); return Result.success() }
    private fun retry(): Result { Log.d(TAG, "Worker result=retry"); return Result.retry() }
    private class ItemFailure(val code: String) : Exception()

    companion object {
        const val BATCH_SIZE = 20
        const val INPUT_MANUAL_TRIGGER = "manual_trigger"
        const val INPUT_MANUAL_ITEM_IDS = "manual_item_ids"
        const val LOCK_TTL_MS = 30 * 60 * 1000L
        const val TAG = "OrangePhotosSync"
        private val ACTIVE_SYNC_LOCK_TOKENS = ConcurrentHashMap.newKeySet<String>()
        val NON_RETRYABLE_CODES = setOf("LOCAL_FILE_UNAVAILABLE", "INVALID_METADATA", "UNSUPPORTED_FILE_TYPE", "FILE_TOO_LARGE", "UPLOAD_SUPPRESSED", "LARGE_UPLOAD_INTERRUPTED", "DUPLICATE_RECONCILIATION_REQUIRED")
    }
}
