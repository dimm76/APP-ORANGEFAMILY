package com.orangefamily.photossync.cloud

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONArray
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
        val accessQuery = ownedQuery(albumId)
        request("${baseUrl}api/orange-photos?page=$page&per_page=$perPage$albumQuery$accessQuery", "No se pudo cargar la biblioteca.") { json ->
            val values = json.optJSONArray("items") ?: throw CloudApiException(200, "La respuesta no contiene elementos.")
            val items = buildList { for (index in 0 until values.length()) values.optJSONObject(index)?.let(::parsePhoto)?.let(::add) }
            CloudPhotoPage(items, json.optInt("page", page), json.optInt("per_page", perPage), json.optInt("total", items.size), json.optBoolean("has_more", false))
        }
    }

    suspend fun timeline(albumId: String? = null): List<CloudTimelineYear> = withContext(Dispatchers.IO) {
        val query = if (albumId == null) "?access_sources=owned" else "?album_id=${encode(albumId)}"
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
            if (albumId == null) append("&access_sources=owned") else append("&album_id=${encode(albumId)}")
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
                    if (id.isNotBlank()) add(CloudAlbum(id, item.optString("title").trim().ifBlank { "Álbum" }, item.optInt("photo_count"), item.optionalString("cover_thumbnail_url"), item.optionalString("date_mode"), item.optionalString("date_start"), item.optionalString("date_end"), item.optBoolean("is_owner"), item.optionalString("shared_by_display_name"), item.optBoolean("can_contribute")))
                }
            }
        }
    }

    private fun parsePhoto(item: JSONObject): CloudPhoto? {
        val id = item.optString("id").trim()
        val mediaType = item.optString("media_type").trim()
        if (id.isBlank() || mediaType !in setOf("image", "video")) return null
        return CloudPhoto(id=id,mediaType=mediaType,title=item.optionalString("title"),originalFilename=item.optionalString("original_filename"),capturedAt=item.optionalString("captured_at"),width=item.optionalInt("width"),height=item.optionalInt("height"),durationSeconds=item.optionalDouble("duration_seconds"),thumbnailUrl=item.optionalString("thumbnail_url"),previewUrl=item.optionalString("preview_url"),posterUrl=item.optionalString("poster_url"),videoPreviewUrl=item.optionalString("video_preview_url"),videoPlaybackUrl=item.optionalString("video_playback_url"),originalUrl=item.optionalString("original_url"),ownerUserId=item.optionalString("owner_user_id"),isOwner=item.optBoolean("is_owner",false),visibility=item.optionalString("visibility")?:"private",isSharedEffectively=item.optBoolean("is_shared_effectively",false),sharedByDisplayName=item.optionalString("shared_by_display_name"),isFavorite=item.optBoolean("is_favorite",false))
    }

    suspend fun members(): List<CloudMember> = withContext(Dispatchers.IO) { request<List<CloudMember>>("${baseUrl}api/orange-photo-members", "No se pudieron cargar los miembros.") { json -> buildList { val values=json.optJSONArray("items")?:return@request emptyList<CloudMember>(); for(i in 0 until values.length()){val item=values.optJSONObject(i)?:continue;val id=item.optString("id").trim();if(id.isNotBlank())add(CloudMember(id,item.optString("display_name"),item.optionalString("role")))}} } }
    suspend fun addPhotoToAlbum(albumId:String,photoId:String)=withContext(Dispatchers.IO){request("${baseUrl}api/orange-photo-albums/${encode(albumId)}/photos","No se pudo añadir la foto.","POST",JSONObject().put("photo_id",photoId)) {}}
    suspend fun sharePhoto(photoId:String,visibility:String,userIds:List<String>)=withContext(Dispatchers.IO){require(visibility in setOf("private","family","selected"));request("${baseUrl}api/orange-photos/${encode(photoId)}/share","No se pudo compartir la foto.","POST",JSONObject().put("visibility",visibility).put("user_ids",JSONArray(userIds))) {}}
    suspend fun setFavorite(photoId:String,value:Boolean)=patchPhoto(photoId,JSONObject().put("is_favorite",value))
    suspend fun setCapturedAt(photoId:String,isoValue:String)=patchPhoto(photoId,JSONObject().put("captured_at",isoValue))
    suspend fun setLocationName(photoId:String,value:String)=patchPhoto(photoId,JSONObject().put("location_name",value))
    suspend fun trashPhoto(photoId:String)=withContext(Dispatchers.IO){request("${baseUrl}api/orange-photos/${encode(photoId)}/trash","No se pudo mover la foto a la papelera.","POST") {}}
    private suspend fun patchPhoto(photoId:String,body:JSONObject)=withContext(Dispatchers.IO){request("${baseUrl}api/orange-photos/${encode(photoId)}","No se pudo actualizar la foto.","PATCH",body) {}}
    private suspend fun <T> request(url: String, fallback: String, method:String="GET", body:JSONObject?=null, parse: (JSONObject) -> T): T {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method; connection.connectTimeout = 15_000; connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Cookie", "of_session=$sessionToken")
            if(body!=null){connection.doOutput=true;connection.setRequestProperty("Content-Type","application/json");connection.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(body) }.getOrElse { throw CloudApiException(status, "Respuesta no válida del servidor.") }
            if (status !in 200..299 || !json.optBoolean("ok", false)) throw CloudApiException(status, json.optString("message").takeIf { it.isNotBlank() } ?: fallback)
            return parse(json)
        } catch (error: CloudApiException) { throw error } catch (error: IOException) { throw CloudApiException(0, "No se pudo conectar con OrangeFamily.", error) } finally { connection.disconnect() }
    }
    private suspend fun <T> request(url:String,fallback:String,parse:(JSONObject)->T):T=request(url,fallback,"GET",null,parse)

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun ownedQuery(albumId: String?): String = if (albumId == null) "&access_sources=owned" else ""
    private fun JSONObject.optionalString(name: String): String? = if (isNull(name)) null else optString(name).trim().takeIf { it.isNotBlank() }
    private fun JSONObject.optionalInt(name: String): Int? = if (isNull(name) || !has(name)) null else optInt(name)
    private fun JSONObject.optionalDouble(name: String): Double? = if (isNull(name) || !has(name)) null else optDouble(name)
    class CloudApiException(val status: Int, message: String, cause: Throwable? = null) : IOException(message, cause)
}
