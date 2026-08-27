package com.orangefamily.photossync.cloud

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.Log
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

class RemoteThumbnailLoader {
    private companion object {
        const val TAG = "OrangePhotosThumb"
    }

    private val cache = object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 1024L / 16L).toInt()) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount / 1024
    }

    private fun cacheKey(url: String): String = url.substringBefore('?')

    suspend fun load(url: String): Bitmap? = withContext(Dispatchers.IO) {
        val key = cacheKey(url)
        cache.get(key)?.let {
            Log.d(TAG, "source=memory")
            return@withContext it
        }
        val connection = runCatching { URL(url).openConnection() as HttpURLConnection }.getOrNull()
            ?: return@withContext null
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.instanceFollowRedirects = true
            val startedAt = SystemClock.elapsedRealtime()
            val status = connection.responseCode
            val responseAt = SystemClock.elapsedRealtime()
            if (status !in 200..299) return@withContext null
            val bitmap = connection.inputStream.use { BitmapFactory.decodeStream(it) }
            val decodedAt = SystemClock.elapsedRealtime()
            Log.d(TAG, "source=network status=$status response_ms=${responseAt - startedAt} decode_ms=${decodedAt - responseAt} total_ms=${decodedAt - startedAt}")
            bitmap?.also { cache.put(key, it) }
        } catch (_: Exception) { null } finally { connection.disconnect() }
    }
}
