package com.orangefamily.photossync.cloud

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.Log
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

class RemoteThumbnailLoader {
    private companion object {
        const val TAG = "OrangePhotosThumb"
        const val MAX_CONCURRENT_NETWORK_LOADS = 4
    }

    private val networkSemaphore = Semaphore(MAX_CONCURRENT_NETWORK_LOADS)

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
        val queuedAt = SystemClock.elapsedRealtime()
        return@withContext networkSemaphore.withPermit {
            cache.get(key)?.let {
                Log.d(TAG, "source=memory-after-wait queue_ms=${SystemClock.elapsedRealtime() - queuedAt}")
                return@withPermit it
            }
            val connection = runCatching { URL(url).openConnection() as HttpURLConnection }.getOrNull()
                ?: return@withPermit null
            try {
                connection.requestMethod = "GET"
                connection.connectTimeout = 15_000
                connection.readTimeout = 30_000
                connection.instanceFollowRedirects = true
                val startedAt = SystemClock.elapsedRealtime()
                val status = connection.responseCode
                val responseAt = SystemClock.elapsedRealtime()
                if (status !in 200..299) return@withPermit null
                val bodyStartedAt = SystemClock.elapsedRealtime()
                val bytes = connection.inputStream.use { it.readBytes() }
                val bodyReadAt = SystemClock.elapsedRealtime()
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                val decodedAt = SystemClock.elapsedRealtime()
                Log.d(TAG, "source=network status=$status queue_ms=${startedAt - queuedAt} response_ms=${responseAt - startedAt} body_ms=${bodyReadAt - bodyStartedAt} decode_ms=${decodedAt - bodyReadAt} body_bytes=${bytes.size} total_ms=${decodedAt - startedAt}")
                bitmap?.also { cache.put(key, it) }
            } catch (_: Exception) { null } finally { connection.disconnect() }
        }
    }
}
