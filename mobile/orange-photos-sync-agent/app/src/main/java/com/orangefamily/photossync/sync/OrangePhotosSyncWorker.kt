package com.orangefamily.photossync.sync

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.orangefamily.photossync.BuildConfig
import com.orangefamily.photossync.auth.OrangeFamilyAuthApi
import com.orangefamily.photossync.auth.SecureSessionStore
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.data.OrangePhotosLocalDatabase
import com.orangefamily.photossync.media.CameraMediaScanner
import com.orangefamily.photossync.media.MediaPermissionAccess
import com.orangefamily.photossync.media.MediaPermissions
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID

class OrangePhotosSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        Log.d(TAG, "Worker started")
        val sessionStore = SecureSessionStore(applicationContext)
        val sessionToken = sessionStore.load(BuildConfig.API_BASE_URL) ?: return success()
        val api = OrangePhotosSyncApi(BuildConfig.API_BASE_URL, sessionToken)
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
        val lockNow = System.currentTimeMillis()
        if (!repository.tryAcquireSyncLock(accountUserId, lockToken, lockNow, lockNow + LOCK_TTL_MS)) {
            return success()
        }

        try {
            try {
                val scan = CameraMediaScanner(applicationContext).scan(accountUserId, repository.baselines(accountUserId))
                repository.recordScan(accountUserId, scan, System.currentTimeMillis())
            } catch (error: SecurityException) {
                Log.e(TAG, "Worker exception=${error.javaClass.simpleName} message=${error.message}", error)
                return success()
            } catch (error: Exception) {
                Log.e(TAG, "Worker exception=${error.javaClass.simpleName} message=${error.message}", error)
                return retry()
            }

            repository.recoverUploading(accountUserId)
            var transientFailure = false
            for (item in repository.syncBatch(accountUserId, BATCH_SIZE)) {
            if (item.failureCode in NON_RETRYABLE_CODES) continue
            Log.d(TAG, "Processing item=${item.id} name=${item.displayName}")
            val attemptedAt = System.currentTimeMillis()
            repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_UPLOADING, attemptedAt, null)
            try {
                val checksum = item.checksumSha256 ?: hash(item).also {
                    repository.updateChecksum(accountUserId, item.id, it)
                }
                val check = api.checkUpload(item, checksum)
                Log.d(TAG, "Preflight decision=${check.decision} mode=${check.uploadMode}")
                when (check.decision) {
                    "already_owned" -> repository.markUploaded(accountUserId, item.id, requireRemoteId(check.photoId), checksum, attemptedAt)
                    "restore_available" -> repository.markRestoreAvailable(accountUserId, item.id, requireRemoteId(check.photoId), checksum, attemptedAt)
                    "suppressed" -> repository.markSuppressed(accountUserId, item.id, checksum, attemptedAt)
                    "upload_required" -> {
                        val remoteId = when (check.uploadMode) {
                            "simple" -> api.uploadSimple(item, checksum, applicationContext.contentResolver)
                            "direct_backend" -> api.uploadDirect(item, checksum, applicationContext.contentResolver)
                            "multipart" -> throw ItemFailure("UNSUPPORTED_MULTIPART")
                            else -> throw ItemFailure("INVALID_UPLOAD_MODE")
                        }
                        repository.markUploaded(accountUserId, item.id, remoteId, checksum, attemptedAt)
                    }
                    else -> throw ItemFailure("INVALID_UPLOAD_DECISION")
                }
            } catch (error: OrangePhotosSyncApi.LocalFileUnavailableException) {
                val failureCode = "LOCAL_FILE_UNAVAILABLE"
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, failureCode)
                Log.e(TAG, "Item failed id=${item.id} code=$failureCode exception=${error.javaClass.simpleName} message=${error.message}", error)
            } catch (error: OrangePhotosSyncApi.SyncApiException) {
                Log.e(TAG, "HTTP status=${error.status} code=${error.code} exception=${error.javaClass.simpleName} message=${error.message}", error)
                if (error.status == 401) { sessionStore.clear(); return success() }
                val code = error.code.ifBlank { "HTTP_${error.status}" }
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, code)
                Log.e(TAG, "Item failed id=${item.id} code=$code", error)
                if (error.status == 429 || error.status >= 500 || code in TRANSIENT_CODES) transientFailure = true
            } catch (error: ItemFailure) {
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, error.code)
                Log.e(TAG, "Item failed id=${item.id} code=${error.code} exception=${error.javaClass.simpleName} message=${error.message}", error)
            } catch (error: IOException) {
                val failureCode = "NETWORK_ERROR"
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, failureCode)
                Log.e(TAG, "Item failed id=${item.id} code=$failureCode exception=${error.javaClass.simpleName} message=${error.message}", error)
                transientFailure = true
            } catch (error: Exception) {
                val failureCode = "INTERNAL_ERROR"
                repository.markAttempt(accountUserId, item.id, LocalMediaItem.STATUS_FAILED, attemptedAt, failureCode)
                Log.e(TAG, "Item failed id=${item.id} code=$failureCode exception=${error.javaClass.simpleName} message=${error.message}", error)
                transientFailure = true
            }
            }
            return if (transientFailure) retry() else success()
        } finally {
            repository.releaseSyncLock(accountUserId, lockToken)
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

    private fun requireRemoteId(value: String?) = value ?: throw ItemFailure("INVALID_UPLOAD_RESPONSE")
    private fun success(): Result { Log.d(TAG, "Worker result=success"); return Result.success() }
    private fun retry(): Result { Log.d(TAG, "Worker result=retry"); return Result.retry() }
    private class ItemFailure(val code: String) : Exception()

    companion object {
        const val BATCH_SIZE = 20
        const val LOCK_TTL_MS = 24 * 60 * 60 * 1000L
        const val TAG = "OrangePhotosSync"
        val NON_RETRYABLE_CODES = setOf("LOCAL_FILE_UNAVAILABLE", "INVALID_METADATA", "UNSUPPORTED_FILE_TYPE", "FILE_TOO_LARGE", "UNSUPPORTED_MULTIPART", "UPLOAD_SUPPRESSED")
        val TRANSIENT_CODES = setOf("STORAGE_UPLOAD_FAILED", "DATABASE_REGISTRATION_FAILED")
    }
}
