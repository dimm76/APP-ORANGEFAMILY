package com.orangefamily.photossync.cloud

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class OrangePhotosCloudApi(apiBaseUrl: String, private val sessionToken: String) {
    private val baseUrl = apiBaseUrl.trim().let {
        require(it.startsWith("http://") || it.startsWith("https://"))
        if (it.endsWith('/')) it else "$it/"
    }

    suspend fun photos(page: Int = 1, perPage: Int = 100, albumId: String? = null): CloudPhotoPage = withContext(Dispatchers.IO) {
        val albumQuery = albumId?.takeIf { it.isNotBlank() }?.let { "&album_id=${encode(it)}" }.orEmpty()
        request("${baseUrl}api/orange-photos?page=$page&per_page=$perPage$albumQuery", "No se pudo cargar la biblioteca.") { json ->
            val values = json.optJSONArray("items") ?: throw CloudApiException(200, "La respuesta no contiene elementos.")
            val items = buildList { for (index in 0 until values.length()) values.optJSONObject(index)?.let(::parsePhoto)?.let(::add) }
            CloudPhotoPage(items, json.optInt("page", page), json.optInt("per_page", perPage), json.optInt("total", items.size), json.optBoolean("has_more", false))
        }
    }

    suspend fun timeline(albumId: String? = null): List<CloudTimelineYear> = withContext(Dispatchers.IO) {
        val query = albumId?.takeIf { it.isNotBlank() }?.let { "?album_id=${encode(it)}" }.orEmpty()
        request("${baseUrl}api/orange-photos/timeline$query", "No se pudo cargar el timeline.") { json ->
            val years = json.optJSONArray("items") ?: return@request emptyList()
            buildList {
                for (i in 0 until years.length()) {
                    val yearObject = years.optJSONObject(i) ?: continue
                    val year = yearObject.optInt("year", 0)
                    val months = yearObject.optJSONArray("months") ?: continue
                    val parsed = buildList {
                        for (j in 0 until months.length()) {
                            val monthObject = months.optJSONObject(j) ?: continue
                            val month = monthObject.optInt("month", 0)
                            if (month in 1..12) add(CloudTimelineMonth(year, month, maxOf(1, monthObject.optInt("count", 1)), monthObject.optionalString("cursor") ?: monthObject.optionalString("first_captured_at")))
                        }
                    }
                    if (year > 0 && parsed.isNotEmpty()) add(CloudTimelineYear(year, parsed))
                }
            }
        }
    }

    suspend fun aroundDate(date: String, albumId: String? = null, direction: String? = null, perPage: Int = 100): CloudPhotoWindow = withContext(Dispatchers.IO) {
        val query = buildString {
            append("date=${encode(date)}&per_page=$perPage")
            albumId?.takeIf { it.isNotBlank() }?.let { append("&album_id=${encode(it)}") }
            direction?.takeIf { it == "newer" || it == "older" }?.let { append("&direction=$it") }
        }
        request("${baseUrl}api/orange-photos/around-date?$query", "No se pudo cargar el periodo.") { json ->
            val values = json.optJSONArray("items")
            val items = buildList { if (values != null) for (i in 0 until values.length()) values.optJSONObject(i)?.let(::parsePhoto)?.let(::add) }
            CloudPhotoWindow(items, json.optInt("page", 1), json.optInt("per_page", perPage), json.optInt("total", items.size), json.optBoolean("has_more"), json.optBoolean("has_newer"), json.optBoolean("has_older"), json.optionalString("newer_cursor"), json.optionalString("older_cursor"))
        }
    }

    suspend fun albums(): List<CloudAlbum> = withContext(Dispatchers.IO) {
        request("${baseUrl}api/orange-photo-albums", "No se pudieron cargar los álbumes.") { json ->
            val values = json.optJSONArray("items") ?: return@request emptyList()
            buildList {
                for (i in 0 until values.length()) {
                    val item = values.optJSONObject(i) ?: continue
                    val id = item.optString("id").trim()
                    if (id.isNotBlank()) add(CloudAlbum(id, item.optString("title").trim().ifBlank { "Álbum" }, item.optInt("photo_count"), item.optionalString("cover_thumbnail_url")))
                }
            }
        }
    }

    private fun parsePhoto(item: JSONObject): CloudPhoto? {
        val id = item.optString("id").trim()
        val mediaType = item.optString("media_type").trim()
        if (id.isBlank() || mediaType !in setOf("image", "video")) return null
        return CloudPhoto(id, mediaType, item.optionalString("title"), item.optionalString("original_filename"), item.optionalString("captured_at"), item.optionalInt("width"), item.optionalInt("height"), item.optionalDouble("duration_seconds"), item.optionalString("thumbnail_url"), item.optionalString("preview_url"), item.optionalString("poster_url"), item.optionalString("video_preview_url"), item.optionalString("video_playback_url"), item.optionalString("original_url"))
    }

    private suspend fun <T> request(url: String, fallback: String, parse: (JSONObject) -> T): T {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"; connection.connectTimeout = 15_000; connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Cookie", "of_session=$sessionToken")
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(body) }.getOrElse { throw CloudApiException(status, "Respuesta no válida del servidor.") }
            if (status !in 200..299 || !json.optBoolean("ok", false)) throw CloudApiException(status, json.optString("message").takeIf { it.isNotBlank() } ?: fallback)
            return parse(json)
        } catch (error: CloudApiException) { throw error } catch (error: IOException) { throw CloudApiException(0, "No se pudo conectar con OrangeFamily.", error) } finally { connection.disconnect() }
    }

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun JSONObject.optionalString(name: String): String? = if (isNull(name)) null else optString(name).trim().takeIf { it.isNotBlank() }
    private fun JSONObject.optionalInt(name: String): Int? = if (isNull(name) || !has(name)) null else optInt(name)
    private fun JSONObject.optionalDouble(name: String): Double? = if (isNull(name) || !has(name)) null else optDouble(name)
    class CloudApiException(val status: Int, message: String, cause: Throwable? = null) : IOException(message, cause)
}
