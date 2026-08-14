package com.orangefamily.photossync.cloud

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant

class CloudMediaDownloader(context: Context, private val repository: CameraBackupRepository, private val api: OrangePhotosCloudApi, private val accountUserId: String) {
    private val resolver = context.applicationContext.contentResolver

    suspend fun download(photo: CloudPhoto): LocalMediaItem = withContext(Dispatchers.IO) {
        check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { "Descargar a la biblioteca del dispositivo requiere Android 10 o superior." }
        val video = photo.mediaType == LocalMediaItem.TYPE_VIDEO
        val collection = if (video) MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) else MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val relativePath = if (video) "${Environment.DIRECTORY_MOVIES}/OrangeFamily/" else "${Environment.DIRECTORY_PICTURES}/OrangeFamily/"
        val displayName = (photo.originalFilename?.trim()?.takeIf { it.isNotBlank() } ?: "orangefamily-${photo.id}.${if (video) "mp4" else "jpg"}").replace("/", "_").replace("\\", "_").replace("\r", "_").replace("\n", "_")
        val mimeType = photo.mimeType?.takeIf { it.isNotBlank() } ?: if (video) "video/mp4" else "image/jpeg"
        val now = System.currentTimeMillis()
        val values = ContentValues().apply { put(MediaStore.MediaColumns.DISPLAY_NAME, displayName); put(MediaStore.MediaColumns.MIME_TYPE, mimeType); put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath); put(MediaStore.MediaColumns.IS_PENDING, 1); photo.capturedAt?.let { runCatching { put(MediaStore.MediaColumns.DATE_TAKEN, Instant.parse(it).toEpochMilli()) } } }
        val uri = resolver.insert(collection, values) ?: error("No se pudo crear el elemento en la biblioteca del dispositivo.")
        try {
            resolver.openOutputStream(uri, "w")?.use { api.downloadOriginalTo(photo.id, it) } ?: error("No se pudo abrir el destino de descarga.")
            resolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
            var size = 0L; var dateAdded = now / 1000; var dateModified = now / 1000
            resolver.query(uri, arrayOf(MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_ADDED, MediaStore.MediaColumns.DATE_MODIFIED), null, null, null)?.use { if (it.moveToFirst()) { size = it.getLong(0); dateAdded = it.getLong(1); dateModified = it.getLong(2) } }
            val dateTaken = photo.capturedAt?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
            val item = LocalMediaItem(accountUserId = accountUserId, mediaStoreId = ContentUris.parseId(uri), mediaCollection = MediaStore.VOLUME_EXTERNAL_PRIMARY, mediaType = photo.mediaType, contentUri = uri.toString(), displayName = displayName, mimeType = mimeType, sizeBytes = size, dateAdded = dateAdded, dateTaken = dateTaken, relativePath = relativePath, width = photo.width, height = photo.height, durationMs = photo.durationSeconds?.times(1000)?.toLong(), detectedAt = now, localStatus = LocalMediaItem.STATUS_DISCOVERED, dateModified = dateModified, cloudStatus = LocalMediaItem.CLOUD_BACKED_UP, remotePhotoId = photo.id, remoteVerifiedAt = now)
            repository.upsertDeviceMedia(listOf(item)); item
        } catch (error: Throwable) { resolver.delete(uri, null, null); throw error }
    }
}
