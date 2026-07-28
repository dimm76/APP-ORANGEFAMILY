package com.orangefamily.photossync.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "local_media_items",
    indices = [
        Index(
            value = ["account_user_id", "media_collection", "media_type", "media_store_id"],
            unique = true,
        ),
        Index(value = ["account_user_id", "local_status", "detected_at"]),
        Index(value = ["account_user_id", "bucket_id"]),
        Index(value = ["account_user_id", "cloud_status"]),
        Index(value = ["account_user_id", "checksum_sha256"]),
    ],
)
data class LocalMediaItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    @ColumnInfo(name = "account_user_id")
    val accountUserId: String,
    @ColumnInfo(name = "media_store_id")
    val mediaStoreId: Long,
    @ColumnInfo(name = "media_collection")
    val mediaCollection: String,
    @ColumnInfo(name = "media_type")
    val mediaType: String,
    @ColumnInfo(name = "content_uri")
    val contentUri: String,
    @ColumnInfo(name = "display_name")
    val displayName: String,
    @ColumnInfo(name = "mime_type")
    val mimeType: String?,
    @ColumnInfo(name = "size_bytes")
    val sizeBytes: Long,
    @ColumnInfo(name = "date_added")
    val dateAdded: Long,
    @ColumnInfo(name = "date_taken")
    val dateTaken: Long?,
    @ColumnInfo(name = "relative_path")
    val relativePath: String?,
    val width: Int?,
    val height: Int?,
    @ColumnInfo(name = "duration_ms")
    val durationMs: Long?,
    @ColumnInfo(name = "detected_at")
    val detectedAt: Long,
    @ColumnInfo(name = "local_status")
    val localStatus: String = STATUS_PENDING,
    @ColumnInfo(name = "checksum_sha256")
    val checksumSha256: String? = null,
    @ColumnInfo(name = "remote_photo_id")
    val remotePhotoId: String? = null,
    @ColumnInfo(name = "last_attempt_at")
    val lastAttemptAt: Long? = null,
    @ColumnInfo(name = "failure_code")
    val failureCode: String? = null,
    @ColumnInfo(name = "date_modified")
    val dateModified: Long = 0,
    @ColumnInfo(name = "bucket_id")
    val bucketId: String? = null,
    @ColumnInfo(name = "bucket_name")
    val bucketName: String? = null,
    @ColumnInfo(name = "hash_algorithm")
    val hashAlgorithm: String? = null,
    @ColumnInfo(name = "hash_computed_at")
    val hashComputedAt: Long? = null,
    @ColumnInfo(name = "cloud_status")
    val cloudStatus: String = CLOUD_UNKNOWN,
    @ColumnInfo(name = "remote_verified_at")
    val remoteVerifiedAt: Long? = null,
) {
    companion object {
        const val TYPE_IMAGE = "image"
        const val TYPE_VIDEO = "video"
        const val STATUS_PENDING = "pending"
        const val STATUS_DISCOVERED = "discovered"
        const val STATUS_UPLOADING = "uploading"
        const val STATUS_UPLOADED = "uploaded"
        const val STATUS_FAILED = "failed"
        const val STATUS_SUPPRESSED = "suppressed"
        const val STATUS_RESTORE_AVAILABLE = "restore_available"
        const val CLOUD_UNKNOWN = "unknown"
        const val CLOUD_CHECKING = "checking"
        const val CLOUD_BACKED_UP = "backed_up"
        const val CLOUD_POSSIBLE_MATCH = "possible_match"
        const val CLOUD_NOT_FOUND = "not_found"
        const val CLOUD_REMOTE_MISSING = "remote_missing"
        const val CLOUD_ERROR = "error"
    }

    fun hasConfirmedRemoteCopy(): Boolean = cloudStatus == CLOUD_BACKED_UP
}
