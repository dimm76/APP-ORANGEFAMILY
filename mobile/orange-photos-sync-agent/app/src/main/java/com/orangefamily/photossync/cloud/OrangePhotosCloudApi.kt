package com.orangefamily.photossync.cloud

import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class OrangePhotosCloudApi(apiBaseUrl: String, private val sessionToken: String) {
    private companion object {
        const val TAG = "OrangePhotosCloud"
    }

    private val baseUrl = apiBaseUrl.trim().let {
        require(it.startsWith("http://") || it.startsWith("https://"))
        if (it.endsWith('/')) it else "$it/"
    }

    private fun photoFiltersQuery(filters: CloudPhotoFilters, albumId: String?, trashed: Boolean, sharedWithMe: Boolean): String {
        require(filters.mediaType in setOf("all", "image", "video"))
        require(filters.accessSourcesMode in setOf("include", "exclude"))
        require(filters.ownerUserIdsMode in setOf("include", "exclude"))
        require(filters.accessSources.all { it in setOf("owned", "library", "direct", "album") })
        val parts = mutableListOf<String>()
        if (trashed) return "trashed=true&library_scope=owned"
        albumId?.takeIf { it.isNotBlank() }?.let { parts += "album_id=${encode(it)}" }
        if (sharedWithMe) parts += "library_scope=shared_with_me"
        if (filters.mediaType != "all") parts += "media_type=${encode(filters.mediaType)}"
        val queryAccessSources = if (albumId?.isNullOrBlank() == false && filters.accessSourcesMode == "include") filters.accessSources + "album" else filters.accessSources
        if (queryAccessSources.isNotEmpty()) {
            parts += "access_sources=${encode(queryAccessSources.sorted().joinToString(","))}"
            parts += "access_sources_mode=${encode(filters.accessSourcesMode)}"
        }
        if (filters.ownerUserIds.isNotEmpty()) {
            parts += "owner_user_ids=${encode(filters.ownerUserIds.sorted().joinToString(","))}"
            parts += "owner_user_ids_mode=${encode(filters.ownerUserIdsMode)}"
        }
        if (sharedWithMe && filters.excludeInLibrary) parts += "exclude_in_library=true"
        if (sharedWithMe && filters.includeHidden) parts += "include_hidden=true"
        return parts.joinToString("&")
    }

    suspend fun photos(page: Int = 1, perPage: Int = 100, albumId: String? = null, trashed: Boolean = false, sharedWithMe: Boolean = false, includeTotal: Boolean = true, filters: CloudPhotoFilters = CloudPhotoFilters()): CloudPhotoPage = withContext(Dispatchers.IO) {
        val filterQuery = photoFiltersQuery(filters, albumId, trashed, sharedWithMe)
        val totalQuery = if (includeTotal) "" else "&include_total=false"
        val query = if (filterQuery.isBlank()) "" else "&$filterQuery"
        request("${baseUrl}api/orange-photos?page=$page&per_page=$perPage$query$totalQuery&compact=true", "No se pudo cargar la biblioteca.") { json ->
            val values = json.optJSONArray("items") ?: throw CloudApiException(200, "La respuesta no contiene elementos.")
            val items = buildList { for (index in 0 until values.length()) values.optJSONObject(index)?.let(::parsePhoto)?.let(::add) }
            CloudPhotoPage(items, json.optInt("page", page), json.optInt("per_page", perPage), json.optInt("total", items.size), json.optBoolean("has_more", false))
        }
    }

    suspend fun timeline(albumId: String? = null, sharedWithMe: Boolean = false, filters: CloudPhotoFilters = CloudPhotoFilters()): List<CloudTimelineYear> = withContext(Dispatchers.IO) {
        val query = photoFiltersQuery(filters, albumId, false, sharedWithMe).takeIf { it.isNotBlank() }?.let { "?$it" }.orEmpty()
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

    suspend fun aroundDate(date: String, albumId: String? = null, direction: String? = null, perPage: Int = 100, sharedWithMe: Boolean = false, filters: CloudPhotoFilters = CloudPhotoFilters()): CloudPhotoWindow = withContext(Dispatchers.IO) {
        val query = buildString {
            append("date=${encode(date)}&per_page=$perPage")
            photoFiltersQuery(filters, albumId, false, sharedWithMe).takeIf { it.isNotBlank() }?.let { append("&$it") }
            direction?.takeIf { it == "newer" || it == "older" }?.let { append("&direction=$it") }
            append("&compact=true")
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
                    val categories = buildList {
                        val categoryValues = item.optJSONArray("categories")
                        if (categoryValues != null) {
                            for (index in 0 until categoryValues.length()) {
                                categoryValues.optJSONObject(index)
                                    ?.let(::parseAlbumCategory)
                                    ?.let(::add)
                            }
                        }
                    }
                    if (id.isNotBlank()) add(
                        CloudAlbum(
                            id = id,
                            title = item.optString("title").trim().ifBlank { "Álbum" },
                            photoCount = item.optInt("photo_count"),
                            coverThumbnailUrl = item.optionalString("cover_thumbnail_url"),
                            dateMode = item.optionalString("date_mode"),
                            dateStart = item.optionalString("date_start"),
                            dateEnd = item.optionalString("date_end"),
                            isOwner = item.optBoolean("is_owner"),
                            sharedByDisplayName = item.optionalString("shared_by_display_name"),
                            canContribute = item.optBoolean("can_contribute"),
                            allowContributions = item.optBoolean("allow_contributions"),
                            allowComments = item.optBoolean("allow_comments"),
                            categories = categories,
                        ),
                    )
                }
            }
        }
    }

    suspend fun albumCategories(): List<CloudAlbumCategory> = withContext(Dispatchers.IO) {
        request(
            "${baseUrl}api/orange-photo-album-categories",
            "No se pudieron cargar las categorías de álbum.",
        ) { json ->
            val values = json.optJSONArray("items")
                ?: return@request emptyList()

            buildList {
                for (index in 0 until values.length()) {
                    values.optJSONObject(index)
                        ?.let(::parseAlbumCategory)
                        ?.let(::add)
                }
            }
        }
    }

    private fun parseAlbumCategory(item: JSONObject): CloudAlbumCategory? {
        val id = item.optString("id").trim()
        val name = item.optString("name").trim()

        if (id.isBlank() || name.isBlank()) return null

        return CloudAlbumCategory(
            id = id,
            name = name,
            sortOrder = item.optInt("sort_order", 0),
        )
    }

    private fun parseAlbumRecipient(item: JSONObject): CloudAlbumRecipient? {
        val userId = item.optString("user_id").trim()
        val subjectType = item.optString("type").trim()
        if (userId.isBlank() || subjectType !in setOf("family", "external")) return null
        return CloudAlbumRecipient(
            userId = userId,
            subjectType = subjectType,
            displayName = item.optString("display_name").trim().ifBlank { item.optString("email").trim().ifBlank { "Usuario" } },
            role = item.optionalString("role"),
            email = item.optionalString("email"),
            selected = item.optBoolean("selected"),
            status = item.optString("status").trim().ifBlank { "available" },
            invitationId = item.optionalString("invitation_id"),
        )
    }

    suspend fun albumRecipients(albumId: String): CloudAlbumRecipients = withContext(Dispatchers.IO) {
        request("${baseUrl}api/orange-photo-albums/${encode(albumId)}/recipients", "No se pudieron cargar los destinatarios.") { json ->
            val album = json.optJSONObject("album")
            fun parseRecipients(name: String) = buildList {
                val values = json.optJSONArray(name) ?: return@buildList
                for (index in 0 until values.length()) values.optJSONObject(index)?.let(::parseAlbumRecipient)?.let(::add)
            }
            CloudAlbumRecipients(album?.optBoolean("allow_contributions") == true, album?.optBoolean("allow_comments") == true, parseRecipients("family"), parseRecipients("external"))
        }
    }

    suspend fun syncAlbumRecipients(albumId: String, recipients: List<CloudAlbumRecipient>, allowContributions: Boolean, allowComments: Boolean) = withContext(Dispatchers.IO) {
        val values = JSONArray()
        recipients.forEach { recipient -> values.put(JSONObject().put("user_id", recipient.userId).put("subject_type", recipient.subjectType).put("status", recipient.status).put("invitation_id", recipient.invitationId ?: JSONObject.NULL)) }
        request("${baseUrl}api/orange-photo-albums/${encode(albumId)}/recipients", "No se pudo guardar el acceso al álbum.", "PUT", JSONObject().put("recipients", values).put("allow_contributions", allowContributions).put("allow_comments", allowComments)) {}
    }

    private fun parsePhoto(item: JSONObject): CloudPhoto? {
        val id = item.optString("id").trim()
        val mediaType = item.optString("media_type").trim()
        if (id.isBlank() || mediaType !in setOf("image", "video")) return null
        return CloudPhoto(id=id,mediaType=mediaType,title=item.optionalString("title"),originalFilename=item.optionalString("original_filename"),capturedAt=item.optionalString("captured_at"),width=item.optionalInt("width"),height=item.optionalInt("height"),durationSeconds=item.optionalDouble("duration_seconds"),thumbnailUrl=item.optionalString("thumbnail_url"),previewUrl=item.optionalString("preview_url"),posterUrl=item.optionalString("poster_url"),videoPreviewUrl=item.optionalString("video_preview_url"),videoPlaybackUrl=item.optionalString("video_playback_url"),originalUrl=item.optionalString("original_url"),ownerUserId=item.optionalString("owner_user_id"),ownerDisplayName=item.optionalString("owner_display_name"),ownerFirstName=item.optionalString("owner_first_name"),isOriginalOwner=item.optBoolean("is_original_owner",false),isOwner=item.optBoolean("is_owner",false),isInLibrary=item.optBoolean("is_in_library",false),accessSource=item.optionalString("access_source"),visibility=item.optionalString("visibility")?:"private",isSharedEffectively=item.optBoolean("is_shared_effectively",false),sharedByDisplayName=item.optionalString("shared_by_display_name"),sharedByFirstName=item.optionalString("shared_by_first_name"),isFavorite=item.optBoolean("is_favorite",false),mimeType=item.optionalString("mime_type"))
    }

    suspend fun addToLibrary(photoId: String) = withContext(Dispatchers.IO) { request("${baseUrl}api/orange-photos/${encode(photoId)}/library", "No se pudo añadir la foto a mi biblioteca.", "POST") {} }

    private suspend fun patchAlbum(
        albumId: String,
        body: JSONObject,
    ) = withContext(Dispatchers.IO) {
        request(
            "${baseUrl}api/orange-photo-albums/${encode(albumId)}",
            "No se pudo actualizar el álbum.",
            "PATCH",
            body,
        ) {}
    }

    suspend fun renameAlbum(albumId: String, title: String) {
        val normalizedTitle = title.trim()
        require(normalizedTitle.isNotBlank()) { "El nombre del álbum es obligatorio." }
        patchAlbum(albumId, JSONObject().put("title", normalizedTitle))
    }

    suspend fun setAlbumCover(albumId: String, photoId: String) {
        patchAlbum(albumId, JSONObject().put("cover_photo_id", photoId))
    }

    suspend fun archiveAlbum(albumId: String) {
        patchAlbum(albumId, JSONObject().put("is_archived", true))
    }

    suspend fun updateAlbumDates(albumId: String, dateMode: String?, dateStart: String?, dateEnd: String?) {
        require(dateMode == null || dateMode in setOf("single", "range"))
        patchAlbum(albumId, JSONObject().put("date_mode", dateMode ?: JSONObject.NULL).put("date_start", dateStart ?: JSONObject.NULL).put("date_end", dateEnd ?: JSONObject.NULL))
    }

    suspend fun setAlbumCategories(albumId: String, categoryIds: Collection<String>) = withContext(Dispatchers.IO) {
        request("${baseUrl}api/orange-photo-albums/${encode(albumId)}/categories", "No se pudieron guardar las categorías del álbum.", "PUT", JSONObject().put("category_ids", JSONArray(categoryIds.toList()))) {}
    }

    suspend fun members(): List<CloudMember> = withContext(Dispatchers.IO) { request<List<CloudMember>>("${baseUrl}api/orange-photo-members", "No se pudieron cargar los miembros.") { json -> buildList { val values=json.optJSONArray("items")?:return@request emptyList<CloudMember>(); for(i in 0 until values.length()){val item=values.optJSONObject(i)?:continue;val id=item.optString("id").trim();if(id.isNotBlank())add(CloudMember(id,item.optString("display_name"),item.optionalString("role")))}} } }
    suspend fun addPhotoToAlbum(albumId: String, photoId: String): Boolean = withContext(Dispatchers.IO) {
        request(
            "${baseUrl}api/orange-photo-albums/${encode(albumId)}/photos",
            "No se pudo añadir la foto.",
            "POST",
            JSONObject().put("photo_id", photoId),
        ) { json ->
            json.optBoolean("added", false)
        }
    }
    suspend fun sharePhoto(photoId:String,visibility:String,userIds:List<String>)=withContext(Dispatchers.IO){require(visibility in setOf("private","family","selected"));request("${baseUrl}api/orange-photos/${encode(photoId)}/share","No se pudo compartir la foto.","POST",JSONObject().put("visibility",visibility).put("user_ids",JSONArray(userIds))) {}}
    suspend fun setFavorite(photoId:String,value:Boolean)=patchPhoto(photoId,JSONObject().put("is_favorite",value))
    suspend fun setCapturedAt(photoId:String,isoValue:String)=patchPhoto(photoId,JSONObject().put("captured_at",isoValue))
    suspend fun setLocationName(photoId:String,value:String)=patchPhoto(photoId,JSONObject().put("location_name",value))
    suspend fun trashPhoto(photoId:String)=withContext(Dispatchers.IO){request("${baseUrl}api/orange-photos/${encode(photoId)}/trash","No se pudo mover la foto a la papelera.","POST") {}}
    suspend fun restorePhoto(photoId: String) = withContext(Dispatchers.IO) { request("${baseUrl}api/orange-photos/${encode(photoId)}/restore", "No se pudo restaurar la foto.", "POST") {} }
    suspend fun purgePhoto(photoId: String) = withContext(Dispatchers.IO) { request("${baseUrl}api/orange-photos/${encode(photoId)}", "No se pudo eliminar definitivamente la foto.", "DELETE") {} }
    private suspend fun patchPhoto(photoId:String,body:JSONObject)=withContext(Dispatchers.IO){request("${baseUrl}api/orange-photos/${encode(photoId)}","No se pudo actualizar la foto.","PATCH",body) {}}
    private suspend fun <T> request(url: String, fallback: String, method:String="GET", body:JSONObject?=null, parse: (JSONObject) -> T): T {
        val startedAt = SystemClock.elapsedRealtime()
        val path = runCatching { URL(url).path }.getOrDefault("")
        val measure = method == "GET" && path in setOf("/api/orange-photos", "/api/orange-photos/timeline", "/api/orange-photos/around-date")
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method; connection.connectTimeout = 15_000; connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Cookie", "of_session=$sessionToken")
            if(body!=null){connection.doOutput=true;connection.setRequestProperty("Content-Type","application/json");connection.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
            val status = connection.responseCode
            val responseAt = SystemClock.elapsedRealtime()
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val bodyReadAt = SystemClock.elapsedRealtime()
            val bodyBytes = body.toByteArray(Charsets.UTF_8).size
            val json = runCatching { JSONObject(body) }.getOrElse { throw CloudApiException(status, "Respuesta no válida del servidor.") }
            val parsedAt = SystemClock.elapsedRealtime()
            if (measure) Log.d(TAG, "path=$path status=$status response_ms=${responseAt - startedAt} body_ms=${bodyReadAt - responseAt} parse_ms=${parsedAt - bodyReadAt} body_bytes=$bodyBytes total_ms=${parsedAt - startedAt}")
            if (status !in 200..299 || !json.optBoolean("ok", false)) throw CloudApiException(status, json.optString("message").takeIf { it.isNotBlank() } ?: fallback)
            return parse(json)
        } catch (error: CloudApiException) { throw error } catch (error: IOException) { throw CloudApiException(0, "No se pudo conectar con OrangeFamily.", error) } finally { connection.disconnect() }
    }

    suspend fun createAlbum(title: String): String = withContext(Dispatchers.IO) {
        val normalizedTitle = title.trim()
        if (normalizedTitle.isBlank()) {
            throw IllegalArgumentException("El nombre del álbum es obligatorio.")
        }
        request(
            "${baseUrl}api/orange-photo-albums",
            "No se pudo crear el álbum.",
            "POST",
            JSONObject().put("title", normalizedTitle).put("visibility", "private"),
        ) { json ->
            val item = json.optJSONObject("item")
                ?: throw CloudApiException(200, "La respuesta no contiene el álbum creado.")
            val id = item.optString("id").trim()
            if (id.isBlank()) throw CloudApiException(200, "La respuesta no contiene el álbum creado.")
            id
        }
    }
    private suspend fun <T> request(url:String,fallback:String,parse:(JSONObject)->T):T=request(url,fallback,"GET",null,parse)

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
    suspend fun downloadOriginalTo(photoId:String,output:OutputStream)=withContext(Dispatchers.IO){val connection=URL("${baseUrl}api/orange-photos/${encode(photoId)}/download").openConnection() as HttpURLConnection;try{connection.requestMethod="GET";connection.connectTimeout=15_000;connection.readTimeout=30_000;connection.setRequestProperty("Accept","application/octet-stream");connection.setRequestProperty("Cookie","of_session=$sessionToken");val status=connection.responseCode;if(status !in 200..299){val body=connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use{it.readText()}.orEmpty();val message=runCatching{JSONObject(body).optString("message").takeIf{it.isNotBlank()}}.getOrNull()?:"No se pudo descargar el original.";throw CloudApiException(status,message)};connection.inputStream.use{input->input.copyTo(output,8192)}}finally{connection.disconnect()}}
    private fun JSONObject.optionalString(name: String): String? = if (isNull(name)) null else optString(name).trim().takeIf { it.isNotBlank() }
    private fun JSONObject.optionalInt(name: String): Int? = if (isNull(name) || !has(name)) null else optInt(name)
    private fun JSONObject.optionalDouble(name: String): Double? = if (isNull(name) || !has(name)) null else optDouble(name)
    class CloudApiException(val status: Int, message: String, cause: Throwable? = null) : IOException(message, cause)
}
