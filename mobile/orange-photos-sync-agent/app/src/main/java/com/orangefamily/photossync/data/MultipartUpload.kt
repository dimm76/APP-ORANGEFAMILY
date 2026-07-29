package com.orangefamily.photossync.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "multipart_upload_sessions",
    primaryKeys = ["local_media_item_id"],
    indices = [Index(value = ["server_upload_id"], unique = true), Index(value = ["account_user_id"])],
)
data class MultipartUploadSession(
    @ColumnInfo(name = "local_media_item_id") val localMediaItemId: Long,
    @ColumnInfo(name = "account_user_id") val accountUserId: String,
    @ColumnInfo(name = "server_upload_id") val serverUploadId: String,
    @ColumnInfo(name = "client_upload_key") val clientUploadKey: String,
    @ColumnInfo(name = "part_size") val partSize: Long,
    @ColumnInfo(name = "parts_total") val partsTotal: Int,
    @ColumnInfo(name = "expires_at") val expiresAt: String?,
    val status: String,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "multipart_upload_parts",
    primaryKeys = ["local_media_item_id", "part_number"],
    indices = [Index(value = ["local_media_item_id"])],
)
data class MultipartUploadPart(
    @ColumnInfo(name = "local_media_item_id") val localMediaItemId: Long,
    @ColumnInfo(name = "part_number") val partNumber: Int,
    val etag: String,
    @ColumnInfo(name = "size_bytes") val sizeBytes: Long,
)
