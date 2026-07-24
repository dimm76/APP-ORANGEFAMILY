package com.orangefamily.photossync.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "agent_configs")
data class AgentConfig(
    @PrimaryKey
    @ColumnInfo(name = "account_user_id")
    val accountUserId: String,
    @ColumnInfo(name = "activated_at")
    val activatedAt: Long,
    @ColumnInfo(name = "baseline_image_date_added")
    val baselineImageDateAdded: Long,
    @ColumnInfo(name = "baseline_image_id")
    val baselineImageId: Long,
    @ColumnInfo(name = "baseline_video_date_added")
    val baselineVideoDateAdded: Long,
    @ColumnInfo(name = "baseline_video_id")
    val baselineVideoId: Long,
    @ColumnInfo(name = "last_scan_at")
    val lastScanAt: Long?,
    val enabled: Boolean,
)

data class PendingCounts(
    @ColumnInfo(name = "image_count")
    val imageCount: Int,
    @ColumnInfo(name = "video_count")
    val videoCount: Int,
) {
    val total: Int get() = imageCount + videoCount
}

data class MediaWatermark(
    val dateAdded: Long,
    val mediaStoreId: Long,
)

@Entity(
    tableName = "media_baselines",
    primaryKeys = ["account_user_id", "media_collection", "media_type"],
    indices = [Index(value = ["account_user_id"])],
)
data class MediaBaseline(
    @ColumnInfo(name = "account_user_id")
    val accountUserId: String,
    @ColumnInfo(name = "media_collection")
    val mediaCollection: String,
    @ColumnInfo(name = "media_type")
    val mediaType: String,
    @ColumnInfo(name = "date_added")
    val dateAdded: Long,
    @ColumnInfo(name = "media_store_id")
    val mediaStoreId: Long,
)

data class BaselineSnapshot(
    val baselines: List<MediaBaseline>,
) {
    fun maximum(mediaType: String): MediaWatermark = baselines
        .asSequence()
        .filter { it.mediaType == mediaType }
        .map { MediaWatermark(it.dateAdded, it.mediaStoreId) }
        .maxWithOrNull(compareBy<MediaWatermark> { it.dateAdded }.thenBy { it.mediaStoreId })
        ?: MediaWatermark(0, 0)
}

data class MediaScanResult(
    val items: List<LocalMediaItem>,
    val baseline: BaselineSnapshot,
)
