package com.orangefamily.photossync.cloud

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

class RemoteThumbnailLoader {
    private val cache = object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 1024L / 16L).toInt()) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount / 1024
    }

    suspend fun load(url: String): Bitmap? = withContext(Dispatchers.IO) {
        cache.get(url)?.let { return@withContext it }
        val connection = runCatching { URL(url).openConnection() as HttpURLConnection }.getOrNull()
            ?: return@withContext null
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = true
            if (connection.responseCode !in 200..299) return@withContext null
            connection.inputStream.use { BitmapFactory.decodeStream(it) }?.also { cache.put(url, it) }
        } catch (_: Exception) { null } finally { connection.disconnect() }
    }
}
