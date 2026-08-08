package com.orangefamily.photossync.cloud

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class OrangePhotosCloudApi(
    apiBaseUrl: String,
    private val sessionToken: String,
) {
    private val baseUrl = apiBaseUrl.trim().let {
        require(it.startsWith("http://") || it.startsWith("https://"))
        if (it.endsWith('/')) it else "$it/"
    }

    suspend fun timeline(page: Int = 1, perPage: Int = 100): CloudPhotoPage = withContext(Dispatchers.IO) {
        val connection = URL("${baseUrl}api/orange-photos?page=$page&per_page=$perPage")
            .openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cookie", "of_session=$sessionToken")
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(body) }.getOrElse {
                throw CloudApiException(status, "Respuesta no válida del servidor.")
            }
            if (status !in 200..299 || !json.optBoolean("ok", false)) {
                val message = json.optString("message").takeIf { it.isNotBlank() }
                    ?: if (status == HttpURLConnection.HTTP_UNAUTHORIZED) "La sesión ha caducado."
                    else "No se pudo cargar la biblioteca."
                throw CloudApiException(status, message)
            }
            val values = json.optJSONArray("items")
                ?: throw CloudApiException(status, "La respuesta no contiene elementos.")
            val items = buildList {
                for (index in 0 until values.length()) {
                    val item = values.optJSONObject(index) ?: continue
                    val id = item.optString("id").trim()
                    val mediaType = item.optString("media_type").trim()
                    if (id.isBlank() || mediaType !in setOf("image", "video")) continue
                    add(CloudPhoto(id, mediaType, item.optionalString("title"), item.optionalString("original_filename"), item.optionalString("captured_at"), item.optionalInt("width"), item.optionalInt("height"), item.optionalDouble("duration_seconds"), item.optionalString("thumbnail_url"), item.optionalString("preview_url"), item.optionalString("poster_url"), item.optionalString("video_preview_url"), item.optionalString("original_url")))
                }
            }
            CloudPhotoPage(items, json.optInt("page", page), json.optInt("per_page", perPage), json.optInt("total", items.size), json.optBoolean("has_more", false))
        } catch (error: CloudApiException) { throw error } catch (error: IOException) {
            throw CloudApiException(0, "No se pudo conectar con OrangeFamily.", error)
        } finally { connection.disconnect() }
    }

    private fun JSONObject.optionalString(name: String): String? = if (isNull(name)) null else optString(name).trim().takeIf { it.isNotBlank() }
    private fun JSONObject.optionalInt(name: String): Int? = if (isNull(name) || !has(name)) null else optInt(name)
    private fun JSONObject.optionalDouble(name: String): Double? = if (isNull(name) || !has(name)) null else optDouble(name)

    class CloudApiException(val status: Int, message: String, cause: Throwable? = null) : IOException(message, cause)
}
