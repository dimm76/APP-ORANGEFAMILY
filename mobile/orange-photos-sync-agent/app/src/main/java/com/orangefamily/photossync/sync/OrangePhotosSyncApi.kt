package com.orangefamily.photossync.sync

import android.content.ContentResolver
import android.net.Uri
import android.util.Log
import com.orangefamily.photossync.auth.OrangeFamilyAuthApi
import com.orangefamily.photossync.data.LocalMediaItem
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class OrangePhotosSyncApi(apiBaseUrl: String, private val sessionToken: String) {
    private val authApi = OrangeFamilyAuthApi(apiBaseUrl)
    private val baseUrl = authApi.baseUrl

    fun currentUser() = authApi.currentUser(sessionToken)

    fun checkUpload(item: LocalMediaItem, checksum: String): UploadCheck {
        val body = JSONObject()
            .put("original_filename", item.displayName)
            .put("size_bytes", item.sizeBytes)
            .put("mime_type", item.mimeType)
            .put("checksum_sha256", checksum)
        if (!Regex("^[0-9a-f]{64}$").matches(checksum)) {
            throw SyncApiException(0, "INVALID_LOCAL_CHECKSUM", "El checksum local no es válido.", transient = false)
        }
        Log.d(TAG, "Preflight request item=${item.id} checksumPresent=${body.has("checksum_sha256")} checksumLength=${checksum.length}")
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

    fun uploadSimple(item: LocalMediaItem, checksum: String, contentResolver: ContentResolver): String {
        val boundary = "OrangeFamily-${UUID.randomUUID()}"
        val json = requestJson("api/orange-photos", "POST", "multipart/form-data; boundary=$boundary") { output ->
            fun text(value: String) = output.write(value.toByteArray(Charsets.UTF_8))
            text("--$boundary\r\nContent-Disposition: form-data; name=\"metadata\"\r\n\r\n")
            text(JSONObject().put("visibility", "private").toString())
            text("\r\n--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"${safeFilename(item.displayName)}\"\r\nContent-Type: ${item.mimeType}\r\n\r\n")
            contentResolver.openInputStream(Uri.parse(item.contentUri))?.use { input -> input.copyTo(output, BUFFER_SIZE) }
                ?: throw LocalFileUnavailableException()
            text("\r\n--$boundary--\r\n")
        }
        return remoteId(json)
    }

    fun uploadDirect(item: LocalMediaItem, checksum: String, contentResolver: ContentResolver): String {
        val metadata = JSONObject().put("visibility", "private").toString()
        val json = requestJson("api/orange-photos/uploads/direct", "POST", "application/octet-stream", mapOf(
            "x-orange-filename" to Uri.encode(item.displayName),
            "x-orange-mime-type" to item.mimeType.orEmpty(),
            "x-orange-file-size" to item.sizeBytes.toString(),
            "x-orange-metadata" to Uri.encode(metadata),
        )) { output ->
            contentResolver.openInputStream(Uri.parse(item.contentUri))?.use { input -> input.copyTo(output, BUFFER_SIZE) }
                ?: throw LocalFileUnavailableException()
        }
        return remoteId(json)
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
            connection.doOutput = true
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cookie", "of_session=$sessionToken")
            connection.setRequestProperty("Content-Type", contentType)
            headers.forEach(connection::setRequestProperty)
            if (fixedBody != null) connection.setFixedLengthStreamingMode(fixedBody.size)
            else connection.setChunkedStreamingMode(BUFFER_SIZE)
            connection.outputStream.use { output ->
                if (fixedBody != null) output.write(fixedBody) else requireNotNull(write)(output)
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

    data class UploadCheck(val decision: String, val photoId: String?, val uploadMode: String?)
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
    }
}
