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
    val videoPlaybackUrl: String?,
    val originalUrl: String?,
    val ownerUserId: String? = null,
    val ownerDisplayName: String? = null,
    val ownerFirstName: String? = null,
    val isOriginalOwner: Boolean = false,
    val isOwner: Boolean = true,
    val isInLibrary: Boolean = false,
    val accessSource: String? = null,
    val visibility: String = "private",
    val isSharedEffectively: Boolean = false,
    val sharedByDisplayName: String? = null,
    val sharedByFirstName: String? = null,
    val isFavorite: Boolean = false,
    val mimeType: String? = null,
) {
    val displayName: String
        get() = title?.takeIf { it.isNotBlank() }
            ?: originalFilename?.takeIf { it.isNotBlank() }
            ?: "Sin título"

    val gridUrl: String?
        get() = if (mediaType == "video") thumbnailUrl ?: posterUrl else thumbnailUrl

    val viewerUrl: String?
        get() = when (mediaType) {
            "image" -> previewUrl ?: originalUrl ?: thumbnailUrl
            "video" -> videoPlaybackUrl ?: originalUrl
            else -> null
        }

    val viewerMimeType: String
        get() = if (mediaType == "video") "video/*" else "image/*"
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
    val canContribute: Boolean = false,
    val allowContributions: Boolean = false,
    val allowComments: Boolean = false,
    val categories: List<CloudAlbumCategory> = emptyList(),
)

data class CloudAlbumCategory(
    val id: String,
    val name: String,
    val sortOrder: Int,
)

data class CloudAlbumRecipient(
    val userId: String,
    val subjectType: String,
    val displayName: String,
    val role: String?,
    val email: String?,
    val selected: Boolean,
    val status: String,
    val invitationId: String?,
)

data class CloudAlbumRecipients(
    val allowContributions: Boolean,
    val allowComments: Boolean,
    val family: List<CloudAlbumRecipient>,
    val external: List<CloudAlbumRecipient>,
)

data class CloudMember(val id:String,val displayName:String,val role:String?)
