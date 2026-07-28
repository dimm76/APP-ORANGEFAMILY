package com.orangefamily.photossync.device

import android.content.ContentResolver
import android.net.Uri
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DeviceMediaHashService(private val resolver: ContentResolver) {
    suspend fun sha256(contentUri: String): String = withContext(Dispatchers.IO) {
        val digest=MessageDigest.getInstance("SHA-256")
        resolver.openInputStream(Uri.parse(contentUri))?.use { input ->
            val buffer=ByteArray(64*1024)
            while(true){ val read=input.read(buffer); if(read<0)break; digest.update(buffer,0,read) }
        } ?: error("El archivo local ya no está disponible.")
        digest.digest().joinToString(""){ "%02x".format(it) }
    }
}
