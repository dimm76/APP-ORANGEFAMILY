package com.orangefamily.photossync.cloud

data class CloudPhoto(
    val id: String,
    val mediaType: String,
    val title: String?,
    val originalFilename: String?,
    val capturedAt: String?,
    val width: Int?,
    val height: Int?,
    val durationSeconds: Double?,
    val thumbnailUrl: String?,
    val previewUrl: String?,
    val posterUrl: String?,
    val videoPreviewUrl: String?,
    val originalUrl: String?,
) {
    val displayName: String
        get() = title?.takeIf { it.isNotBlank() }
            ?: originalFilename?.takeIf { it.isNotBlank() }
            ?: "Sin título"

    val gridUrl: String?
        get() = if (mediaType == "video") thumbnailUrl ?: posterUrl else thumbnailUrl

    val viewerUrl: String?
        get() = if (mediaType == "image") previewUrl ?: thumbnailUrl else null
}

data class CloudPhotoPage(
    val items: List<CloudPhoto>,
    val page: Int,
    val perPage: Int,
    val total: Int,
    val hasMore: Boolean,
)

data class CloudTimelineMonth(val year: Int, val month: Int, val count: Int, val cursor: String?) {
    val key: String get() = "%04d-%02d".format(year, month)
}

data class CloudTimelineYear(val year: Int, val months: List<CloudTimelineMonth>)

data class CloudPhotoWindow(
    val items: List<CloudPhoto>, val page: Int, val perPage: Int, val total: Int,
    val hasMore: Boolean, val hasNewer: Boolean, val hasOlder: Boolean,
    val newerCursor: String?, val olderCursor: String?,
)

data class CloudAlbum(
    val id: String,
    val title: String,
    val photoCount: Int,
    val coverThumbnailUrl: String?,
    val dateMode: String?,
    val dateStart: String?,
    val dateEnd: String?,
    val isOwner: Boolean,
    val sharedByDisplayName: String?,
)
