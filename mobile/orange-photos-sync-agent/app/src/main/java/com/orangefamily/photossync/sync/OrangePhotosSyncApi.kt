package com.orangefamily.photossync.sync

import android.content.ContentResolver
import android.net.Uri
import android.util.Log
import com.orangefamily.photossync.auth.OrangeFamilyAuthApi
import com.orangefamily.photossync.data.LocalMediaItem
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class OrangePhotosSyncApi(apiBaseUrl: String, private val sessionToken: String, private val installationId: String) {
    private val authApi = OrangeFamilyAuthApi(apiBaseUrl)
    private val baseUrl = authApi.baseUrl

    fun currentUser() = authApi.currentUser(sessionToken)

    fun trashPhoto(photoId: String) {
        require(photoId.isNotBlank())
        requestJson(
            path = "api/orange-photos/${Uri.encode(photoId)}/trash",
            method = "POST",
            contentType = "application/json; charset=utf-8",
            fixedBody = "{}".toByteArray(Charsets.UTF_8),
        )
    }

    fun checkUpload(item: LocalMediaItem, checksum: String, forceDuplicate: Boolean = false): UploadCheck {
        val body = JSONObject()
            .put("original_filename", item.displayName)
            .put("size_bytes", item.sizeBytes)
            .put("mime_type", item.mimeType)
            .put("checksum_sha256", checksum)
            .put("force_duplicate", forceDuplicate)
        if (!Regex("^[0-9a-f]{64}$").matches(checksum)) {
            throw SyncApiException(0, "INVALID_LOCAL_CHECKSUM", "El checksum local no es válido.", transient = false)
        }
        Log.d(
            TAG,
            "Preflight request item=${item.id} sizeBytes=${item.sizeBytes} " +
                "mime=${item.mimeType} checksumPresent=${body.has("checksum_sha256")} " +
                "checksumLength=${checksum.length}",
        )
        val bodyBytes = body.toString().toByteArray(Charsets.UTF_8)
        val json = try {
            requestJson(
                path = "api/orange-photos/uploads/check",
                method = "POST",
                contentType = "application/json; charset=utf-8",
                fixedBody = bodyBytes,
            )
        } catch (error: SyncApiException) {
            Log.e(TAG, "Preflight failed status=${error.status} code=${error.code} message=${error.message}")
            throw error
        }
        val decision = json.optString("decision")
        if (decision.isBlank()) {
            val error = SyncApiException(200, "INVALID_SERVER_RESPONSE", "La respuesta del servidor no contiene una decisión.")
            Log.e(TAG, "Preflight failed status=${error.status} code=${error.code} message=${error.message}")
            throw error
        }
        return UploadCheck(
            decision = decision,
            photoId = json.optString("photo_id").takeIf(String::isNotBlank),
            uploadMode = json.optString("upload_mode").takeIf(String::isNotBlank),
        )
    }

    fun checkStorageStatus(items: List<StorageStatusRequestItem>): List<StorageStatusResult> {
        require(items.isNotEmpty() && items.size <= 200)
        val requestItems=JSONArray()
        items.forEach { item -> requestItems.put(JSONObject().put("client_id",item.clientId).put("hash",item.hash).put("hash_algorithm","sha256").put("size_bytes",item.sizeBytes).apply { item.displayName?.let { put("display_name",it) } }) }
        val response=requestJson("api/orange-photos/check-storage-status","POST","application/json; charset=utf-8",fixedBody=JSONObject().put("items",requestItems).toString().toByteArray(Charsets.UTF_8))
        val values=response.getJSONArray("items")
        return buildList { for(index in 0 until values.length()){ val value=values.getJSONObject(index); add(StorageStatusResult(value.getString("client_id"),value.getString("status"),value.optString("remote_photo_id").takeIf(String::isNotBlank))) } }
    }

    fun uploadSimple(item: LocalMediaItem, checksum: String, contentResolver: ContentResolver, forceDuplicate: Boolean = false, onProgress:(Long,Long)->Unit={_,_->}): String {
        val boundary = "OrangeFamily-${UUID.randomUUID()}"
        val json = requestJson("api/orange-photos", "POST", "multipart/form-data; boundary=$boundary") { output ->
            fun text(value: String) = output.write(value.toByteArray(Charsets.UTF_8))
            text("--$boundary\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n")
            text(JSONObject().put("visibility", "private").toString())
            text("\r\n--$boundary\r\nContent-Disposition: form-data; name=\"force_duplicate\"\r\n\r\n$forceDuplicate")
            text("\r\n--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"${safeFilename(item.displayName)}\"\r\nContent-Type: ${item.mimeType}\r\n\r\n")
            contentResolver.openInputStream(Uri.parse(item.contentUri))?.use { input -> copyWithProgress(input,output,item.sizeBytes,onProgress) }
                ?: throw LocalFileUnavailableException()
            text("\r\n--$boundary--\r\n")
        }
        return remoteId(json)
    }

    fun uploadDirect(item: LocalMediaItem, checksum: String, contentResolver: ContentResolver, forceDuplicate: Boolean = false, onProgress:(Long,Long)->Unit={_,_->}): String {
        val metadata = JSONObject().put("visibility", "private").toString()
        val json = requestJson("api/orange-photos/uploads/direct", "POST", "application/octet-stream", mapOf(
            "x-orange-filename" to Uri.encode(item.displayName),
            "x-orange-mime-type" to item.mimeType.orEmpty(),
            "x-orange-file-size" to item.sizeBytes.toString(),
            "x-orange-metadata" to Uri.encode(metadata),
            "x-orange-force-duplicate" to forceDuplicate.toString(),
        )) { output ->
            contentResolver.openInputStream(Uri.parse(item.contentUri))?.use { input -> copyWithProgress(input,output,item.sizeBytes,onProgress) }
                ?: throw LocalFileUnavailableException()
        }
        return remoteId(json)
    }

    fun initiateMultipart(item: LocalMediaItem, clientUploadKey: String, forceDuplicate: Boolean): MultipartSession {
        val body = JSONObject()
            .put("original_filename", item.displayName)
            .put("size_bytes", item.sizeBytes)
            .put("mime_type", item.mimeType)
            .put("metadata", JSONObject().put("visibility", "private"))
            .put("client_upload_key", clientUploadKey)
            .put("force_possible_duplicate", true)
            .put("force_duplicate", forceDuplicate)
        val upload = requestJson(
            "api/orange-photos/uploads/multipart",
            "POST",
            "application/json; charset=utf-8",
            fixedBody = body.toString().toByteArray(Charsets.UTF_8),
        ).getJSONObject("upload")
        return multipartSession(upload)
    }

    fun multipartStatus(uploadId: String): MultipartStatus {
        val upload = requestJson("api/orange-photos/uploads/$uploadId", "GET", "").getJSONObject("upload")
        val completed = upload.optJSONArray("completed_parts") ?: JSONArray()
        return MultipartStatus(
            session = multipartSession(upload),
            completedParts = buildList {
                for (index in 0 until completed.length()) {
                    val part = completed.getJSONObject(index)
                    add(CompletedPart(part.getInt("part_number"), part.getString("etag"), part.optLong("size_bytes", 0)))
                }
            },
        )
    }

    fun signMultipartParts(uploadId: String, partNumbers: List<Int>): List<SignedPart> {
        val numbers = JSONArray().apply { partNumbers.forEach(::put) }
        val body = JSONObject().put("part_numbers", numbers).toString().toByteArray(Charsets.UTF_8)
        val parts = requestJson("api/orange-photos/uploads/$uploadId/parts", "POST", "application/json; charset=utf-8", fixedBody = body).getJSONArray("parts")
        return buildList {
            for (index in 0 until parts.length()) {
                val part = parts.getJSONObject(index)
                add(SignedPart(part.getInt("part_number"), part.getString("url")))
            }
        }
    }

    fun uploadMultipartPart(
        signedPart: SignedPart,
        item: LocalMediaItem,
        offset: Long,
        length: Long,
        contentResolver: ContentResolver,
        onProgress: (Long) -> Unit,
    ): String {
        val connection = URL(signedPart.url).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "PUT"
            connection.connectTimeout = 15_000
            connection.readTimeout = 120_000
            connection.doOutput = true
            connection.setFixedLengthStreamingMode(length)
            contentResolver.openInputStream(Uri.parse(item.contentUri))?.use { input ->
                skipFully(input, offset)
                connection.outputStream.use { output -> copyPart(input, output, length, onProgress) }
            } ?: throw LocalFileUnavailableException()
            val status = connection.responseCode
            if (status !in 200..299) throw SyncApiException(status, "STORAGE_UPLOAD_FAILED", "No se pudo transferir una parte.")
            connection.getHeaderField("ETag")?.takeIf(String::isNotBlank)
                ?: throw SyncApiException(status, "STORAGE_UPLOAD_FAILED", "El almacenamiento no devolvió el ETag.")
        } catch (error: SyncApiException) {
            throw error
        } catch (error: LocalFileUnavailableException) {
            throw error
        } catch (error: IOException) {
            throw TransientSyncException(error)
        } finally {
            connection.disconnect()
        }
    }

    fun completeMultipart(uploadId: String, parts: List<CompletedPart>): String {
        val values = JSONArray().apply {
            parts.sortedBy { it.partNumber }.forEach { part ->
                put(JSONObject().put("part_number", part.partNumber).put("etag", part.etag).put("size_bytes", part.sizeBytes))
            }
        }
        val body = JSONObject().put("parts", values).toString().toByteArray(Charsets.UTF_8)
        return remoteId(requestJson("api/orange-photos/uploads/$uploadId/complete", "POST", "application/json; charset=utf-8", fixedBody = body))
    }

    private fun requestJson(
        path: String,
        method: String,
        contentType: String,
        headers: Map<String, String> = emptyMap(),
        fixedBody: ByteArray? = null,
        write: ((java.io.OutputStream) -> Unit)? = null,
    ): JSONObject {
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 120_000
            connection.doOutput = fixedBody != null || write != null
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cookie", "of_session=$sessionToken")
            if (contentType.isNotBlank()) connection.setRequestProperty("Content-Type", contentType)
            syncHeaders(installationId).forEach(connection::setRequestProperty)
            headers.forEach(connection::setRequestProperty)
            if (connection.doOutput) {
                if (fixedBody != null) connection.setFixedLengthStreamingMode(fixedBody.size)
                else connection.setChunkedStreamingMode(BUFFER_SIZE)
                connection.outputStream.use { output ->
                    if (fixedBody != null) output.write(fixedBody) else requireNotNull(write)(output)
                }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(response) }.getOrElse { JSONObject() }
            if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status !in 200..299 || !json.optBoolean("ok", false)) {
                val code = json.optString("code").ifBlank { "HTTP_$status" }
                val message = json.optString("message").ifBlank { "Error HTTP $status" }
                throw SyncApiException(status, code, message)
            }
            json
        } catch (error: SyncApiException) {
            throw error
        } catch (error: LocalFileUnavailableException) {
            throw error
        } catch (error: IOException) {
            throw TransientSyncException(error)
        } finally {
            connection.disconnect()
        }
    }

    private fun remoteId(json: JSONObject): String = json.optJSONObject("item")?.optString("id")?.takeIf(String::isNotBlank)
        ?: throw SyncApiException(500, "INVALID_UPLOAD_RESPONSE", "La API no confirmó el identificador remoto.")

    private fun safeFilename(value: String) = value.replace(Regex("[\\r\\n\\\"]"), "_")

    private fun copyWithProgress(input:InputStream,output:OutputStream,totalBytes:Long,onProgress:(Long,Long)->Unit){val buffer=ByteArray(BUFFER_SIZE);var sent=0L;var lastPercent=-1;while(true){val read=input.read(buffer);if(read<0)break;output.write(buffer,0,read);sent+=read;val percent=uploadPercent(sent,totalBytes);if(percent!=lastPercent){lastPercent=percent;onProgress(sent,totalBytes)}}}

    private fun copyPart(input: InputStream, output: OutputStream, length: Long, onProgress: (Long) -> Unit) {
        val buffer = ByteArray(BUFFER_SIZE)
        var remaining = length
        var sent = 0L
        while (remaining > 0) {
            val read = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
            if (read < 0) throw LocalFileUnavailableException()
            output.write(buffer, 0, read)
            remaining -= read
            sent += read
            onProgress(sent)
        }
    }

    private fun skipFully(input: InputStream, offset: Long) {
        var remaining = offset
        while (remaining > 0) {
            val skipped = input.skip(remaining)
            if (skipped > 0) remaining -= skipped
            else if (input.read() < 0) throw LocalFileUnavailableException() else remaining--
        }
    }

    private fun multipartSession(value: JSONObject) = MultipartSession(
        id = value.getString("id"),
        partSize = value.getLong("part_size"),
        partsTotal = value.getInt("parts_total"),
        expiresAt = value.optString("expires_at").takeIf(String::isNotBlank),
        status = value.optString("status"),
    )

    data class UploadCheck(val decision: String, val photoId: String?, val uploadMode: String?)
    data class StorageStatusRequestItem(val clientId: String, val hash: String, val sizeBytes: Long, val displayName: String?)
    data class StorageStatusResult(val clientId: String, val status: String, val remotePhotoId: String?)
    data class MultipartSession(val id: String, val partSize: Long, val partsTotal: Int, val expiresAt: String?, val status: String)
    data class MultipartStatus(val session: MultipartSession, val completedParts: List<CompletedPart>)
    data class SignedPart(val partNumber: Int, val url: String)
    data class CompletedPart(val partNumber: Int, val etag: String, val sizeBytes: Long)
    class LocalFileUnavailableException : IOException()
    class TransientSyncException(cause: Throwable) : IOException(cause)
    class SyncApiException(
        val status: Int,
        val code: String,
        message: String,
        val transient: Boolean = status == 429 || status >= 500,
    ) : IOException(message)

    companion object {
        const val BUFFER_SIZE = 64 * 1024
        const val TAG = "OrangePhotosSync"
        fun syncHeaders(installationId: String) = mapOf("x-orange-client" to "android_sync", "x-orange-installation-id" to installationId)
    }
}
