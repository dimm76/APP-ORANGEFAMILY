package com.orangefamily.photossync.media

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import com.orangefamily.photossync.data.BaselineSnapshot
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.data.MediaBaseline
import com.orangefamily.photossync.data.MediaScanResult
import com.orangefamily.photossync.data.MediaWatermark

class CameraMediaScanner(context: Context) {
    private val contentResolver = context.contentResolver
    private val applicationContext = context.applicationContext

    fun establishBaseline(accountUserId: String): BaselineSnapshot {
        val baselines = buildList {
            for (collection in externalCollections()) {
                add(queryMaximum(accountUserId, collection, LocalMediaItem.TYPE_IMAGE))
                add(queryMaximum(accountUserId, collection, LocalMediaItem.TYPE_VIDEO))
            }
        }
        return BaselineSnapshot(baselines)
    }

    fun scan(accountUserId: String, storedBaselines: List<MediaBaseline>): MediaScanResult {
        val baselineMap = storedBaselines.associateByTo(linkedMapOf()) {
            BaselineKey(it.mediaCollection, it.mediaType)
        }
        val detectedAt = System.currentTimeMillis()
        val items = mutableListOf<LocalMediaItem>()

        for (collection in externalCollections()) {
            for (mediaType in listOf(LocalMediaItem.TYPE_IMAGE, LocalMediaItem.TYPE_VIDEO)) {
                val key = BaselineKey(collection, mediaType)
                val previous = baselineMap[key]
                if (previous == null) {
                    baselineMap[key] = queryMaximum(accountUserId, collection, mediaType)
                    continue
                }
                val scanned = queryNewItems(accountUserId, collection, mediaType, previous, detectedAt)
                items += scanned.items
                baselineMap[key] = previous.copy(
                    dateAdded = scanned.maximum.dateAdded,
                    mediaStoreId = scanned.maximum.mediaStoreId,
                )
            }
        }

        return MediaScanResult(
            items = items,
            baseline = BaselineSnapshot(baselineMap.values.toList()),
        )
    }

    private fun queryMaximum(
        accountUserId: String,
        collection: String,
        mediaType: String,
    ): MediaBaseline {
        val uri = collectionUri(collection, mediaType)
        val projection = arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DATE_ADDED)
        val args = cameraQueryArgs(
            sortOrder = "${MediaStore.MediaColumns.DATE_ADDED} DESC, ${MediaStore.MediaColumns._ID} DESC",
            limit = 1,
        )
        val maximum = contentResolver.query(uri, projection, args, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                MediaWatermark(
                    dateAdded = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)),
                    mediaStoreId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)),
                )
            } else null
        } ?: MediaWatermark(0, 0)

        return MediaBaseline(
            accountUserId = accountUserId,
            mediaCollection = collection,
            mediaType = mediaType,
            dateAdded = maximum.dateAdded,
            mediaStoreId = maximum.mediaStoreId,
        )
    }

    private fun queryNewItems(
        accountUserId: String,
        collection: String,
        mediaType: String,
        baseline: MediaBaseline,
        detectedAt: Long,
    ): ScannedCollection {
        val uri = collectionUri(collection, mediaType)
        val projection = buildList {
            add(MediaStore.MediaColumns._ID)
            add(MediaStore.MediaColumns.DISPLAY_NAME)
            add(MediaStore.MediaColumns.MIME_TYPE)
            add(MediaStore.MediaColumns.SIZE)
            add(MediaStore.MediaColumns.DATE_ADDED)
            add(MediaStore.Images.ImageColumns.DATE_TAKEN)
            add(MediaStore.MediaColumns.WIDTH)
            add(MediaStore.MediaColumns.HEIGHT)
            add(MediaStore.Images.ImageColumns.BUCKET_DISPLAY_NAME)
            if (mediaType == LocalMediaItem.TYPE_VIDEO) add(MediaStore.Video.VideoColumns.DURATION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(MediaStore.MediaColumns.RELATIVE_PATH)
        }.toTypedArray()
        val baselineSelection =
            "(${MediaStore.MediaColumns.DATE_ADDED} > ? OR " +
                "(${MediaStore.MediaColumns.DATE_ADDED} = ? AND ${MediaStore.MediaColumns._ID} > ?))"
        val args = cameraQueryArgs(
            extraSelection = baselineSelection,
            extraSelectionArgs = arrayOf(
                baseline.dateAdded.toString(),
                baseline.dateAdded.toString(),
                baseline.mediaStoreId.toString(),
            ),
            sortOrder = "${MediaStore.MediaColumns.DATE_ADDED} ASC, ${MediaStore.MediaColumns._ID} ASC",
        )

        val items = mutableListOf<LocalMediaItem>()
        var maximum = MediaWatermark(baseline.dateAdded, baseline.mediaStoreId)
        contentResolver.query(uri, projection, args, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val mediaStoreId = cursor.long(MediaStore.MediaColumns._ID)
                val dateAdded = cursor.long(MediaStore.MediaColumns.DATE_ADDED)
                val watermark = MediaWatermark(dateAdded, mediaStoreId)
                if (compareWatermarks(watermark, maximum) > 0) maximum = watermark
                items += LocalMediaItem(
                    accountUserId = accountUserId,
                    mediaStoreId = mediaStoreId,
                    mediaCollection = collection,
                    mediaType = mediaType,
                    contentUri = ContentUris.withAppendedId(uri, mediaStoreId).toString(),
                    displayName = cursor.string(MediaStore.MediaColumns.DISPLAY_NAME).orEmpty(),
                    mimeType = cursor.string(MediaStore.MediaColumns.MIME_TYPE),
                    sizeBytes = cursor.long(MediaStore.MediaColumns.SIZE),
                    dateAdded = dateAdded,
                    dateTaken = cursor.nullableLong(MediaStore.Images.ImageColumns.DATE_TAKEN),
                    relativePath = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        cursor.string(MediaStore.MediaColumns.RELATIVE_PATH)
                    } else null,
                    width = cursor.nullableInt(MediaStore.MediaColumns.WIDTH),
                    height = cursor.nullableInt(MediaStore.MediaColumns.HEIGHT),
                    durationMs = if (mediaType == LocalMediaItem.TYPE_VIDEO) {
                        cursor.nullableLong(MediaStore.Video.VideoColumns.DURATION)
                    } else null,
                    detectedAt = detectedAt,
                )
            }
        }
        return ScannedCollection(items, maximum)
    }

    private fun cameraQueryArgs(
        extraSelection: String? = null,
        extraSelectionArgs: Array<String> = emptyArray(),
        sortOrder: String,
        limit: Int? = null,
    ): Bundle {
        val (cameraSelection, cameraArgs) = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val column = MediaStore.MediaColumns.RELATIVE_PATH
            "(LOWER($column) = ? OR LOWER($column) = ?)" to
                arrayOf("dcim/camera/", "dcim/camera")
        } else {
            "LOWER(${MediaStore.Images.ImageColumns.BUCKET_DISPLAY_NAME}) = ?" to arrayOf("camera")
        }
        return Bundle().apply {
            putString(
                ContentResolver.QUERY_ARG_SQL_SELECTION,
                if (extraSelection == null) cameraSelection else "($cameraSelection) AND ($extraSelection)",
            )
            putStringArray(
                ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
                cameraArgs + extraSelectionArgs,
            )
            putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, sortOrder)
            limit?.let { putInt(ContentResolver.QUERY_ARG_LIMIT, it) }
        }
    }

    private fun externalCollections(): Set<String> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.getExternalVolumeNames(applicationContext)
    } else {
        setOf(LEGACY_EXTERNAL_COLLECTION)
    }

    private fun collectionUri(collection: String, mediaType: String): Uri = when (mediaType) {
        LocalMediaItem.TYPE_IMAGE -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(collection)
        } else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        LocalMediaItem.TYPE_VIDEO -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Video.Media.getContentUri(collection)
        } else MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        else -> error("Tipo multimedia local no válido.")
    }

    private fun Cursor.long(column: String): Long = getLong(getColumnIndexOrThrow(column))
    private fun Cursor.string(column: String): String? =
        getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getString)
    private fun Cursor.nullableLong(column: String): Long? =
        getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getLong)
    private fun Cursor.nullableInt(column: String): Int? =
        getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getInt)

    private fun compareWatermarks(left: MediaWatermark, right: MediaWatermark): Int =
        compareValuesBy(left, right, MediaWatermark::dateAdded, MediaWatermark::mediaStoreId)

    private data class BaselineKey(val collection: String, val mediaType: String)
    private data class ScannedCollection(
        val items: List<LocalMediaItem>,
        val maximum: MediaWatermark,
    )

    private companion object {
        const val LEGACY_EXTERNAL_COLLECTION = "external"
    }
}
