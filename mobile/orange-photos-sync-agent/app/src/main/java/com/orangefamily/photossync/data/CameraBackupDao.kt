package com.orangefamily.photossync.data

import androidx.room.Dao
import androidx.room.ColumnInfo
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface CameraBackupDao {
    @Query("SELECT * FROM agent_configs WHERE account_user_id = :accountUserId LIMIT 1")
    suspend fun getConfig(accountUserId: String): AgentConfig?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: AgentConfig)

    @Query("SELECT * FROM media_baselines WHERE account_user_id = :accountUserId")
    suspend fun getBaselines(accountUserId: String): List<MediaBaseline>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveBaselines(baselines: List<MediaBaseline>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertPending(items: List<LocalMediaItem>): List<Long>

    @Query(
        """
        SELECT
            COALESCE(SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END), 0) AS image_count,
            COALESCE(SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END), 0) AS video_count
        FROM local_media_items
        WHERE account_user_id = :accountUserId AND local_status = 'pending'
        """,
    )
    suspend fun getPendingCounts(accountUserId: String): PendingCounts

    @Query(
        """
        SELECT * FROM local_media_items
        WHERE account_user_id = :accountUserId AND local_status = 'pending'
        ORDER BY detected_at DESC, id DESC
        LIMIT :limit
        """,
    )
    suspend fun getLatestPending(accountUserId: String, limit: Int = 10): List<LocalMediaItem>

    @Query("SELECT * FROM local_media_items WHERE account_user_id = :accountUserId AND local_status = 'failed' ORDER BY last_attempt_at DESC, id DESC LIMIT :limit")
    suspend fun getLatestFailed(accountUserId: String, limit: Int = 10): List<LocalMediaItem>

    @Query("SELECT * FROM local_media_items WHERE account_user_id = :accountUserId AND local_status IN ('pending', 'failed') ORDER BY detected_at ASC, id ASC LIMIT :limit")
    suspend fun getSyncBatch(accountUserId: String, limit: Int): List<LocalMediaItem>

    @Query("UPDATE local_media_items SET checksum_sha256 = :checksum WHERE id = :id AND account_user_id = :accountUserId")
    suspend fun updateChecksum(accountUserId: String, id: Long, checksum: String)

    @Query("UPDATE local_media_items SET local_status = :status, last_attempt_at = :lastAttemptAt, failure_code = :failureCode WHERE id = :id AND account_user_id = :accountUserId")
    suspend fun markAttempt(accountUserId: String, id: Long, status: String, lastAttemptAt: Long, failureCode: String?)

    @Query("UPDATE local_media_items SET local_status = 'uploaded', remote_photo_id = :remotePhotoId, checksum_sha256 = :checksum, last_attempt_at = :lastAttemptAt, failure_code = NULL WHERE id = :id AND account_user_id = :accountUserId")
    suspend fun markUploaded(accountUserId: String, id: Long, remotePhotoId: String, checksum: String, lastAttemptAt: Long)

    @Query("UPDATE local_media_items SET local_status = 'suppressed', remote_photo_id = NULL, checksum_sha256 = :checksum, last_attempt_at = :lastAttemptAt, failure_code = NULL WHERE id = :id AND account_user_id = :accountUserId")
    suspend fun markSuppressed(accountUserId: String, id: Long, checksum: String, lastAttemptAt: Long)

    @Query("UPDATE local_media_items SET local_status = 'restore_available', remote_photo_id = :remotePhotoId, checksum_sha256 = :checksum, last_attempt_at = :lastAttemptAt, failure_code = NULL WHERE id = :id AND account_user_id = :accountUserId")
    suspend fun markRestoreAvailable(accountUserId: String, id: Long, remotePhotoId: String, checksum: String, lastAttemptAt: Long)

    @Query("UPDATE local_media_items SET local_status = 'pending', failure_code = NULL WHERE account_user_id = :accountUserId AND local_status = 'uploading'")
    suspend fun recoverUploading(accountUserId: String)

    @Query("SELECT COALESCE(SUM(CASE WHEN local_status IN ('pending', 'uploading') THEN 1 ELSE 0 END), 0) AS pending, COALESCE(SUM(CASE WHEN local_status = 'failed' THEN 1 ELSE 0 END), 0) AS failed, COALESCE(SUM(CASE WHEN local_status = 'uploaded' THEN 1 ELSE 0 END), 0) AS uploaded, COALESCE(SUM(CASE WHEN local_status = 'suppressed' THEN 1 ELSE 0 END), 0) AS suppressed, COALESCE(SUM(CASE WHEN local_status = 'restore_available' THEN 1 ELSE 0 END), 0) AS restore_available FROM local_media_items WHERE account_user_id = :accountUserId")
    suspend fun getSyncCounts(accountUserId: String): SyncCounts

    @Query("UPDATE agent_configs SET sync_lock_token = :token, sync_lock_expires_at = :expiresAt WHERE account_user_id = :accountUserId AND enabled = 1 AND (sync_lock_token IS NULL OR sync_lock_expires_at IS NULL OR sync_lock_expires_at <= :now)")
    suspend fun tryAcquireSyncLock(accountUserId: String, token: String, now: Long, expiresAt: Long): Int

    @Query("UPDATE agent_configs SET sync_lock_token = NULL, sync_lock_expires_at = NULL WHERE account_user_id = :accountUserId AND sync_lock_token = :token")
    suspend fun releaseSyncLock(accountUserId: String, token: String)
}

data class SyncCounts(
    val pending: Int,
    val failed: Int,
    val uploaded: Int,
    val suppressed: Int,
    @ColumnInfo(name = "restore_available") val restoreAvailable: Int,
)
