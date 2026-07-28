package com.orangefamily.photossync.device

import android.content.ContentResolver
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.util.LruCache
import android.util.Size
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DeviceMediaThumbnailLoader(private val resolver: ContentResolver) {
    private val cache=object:LruCache<String,Bitmap>((Runtime.getRuntime().maxMemory()/1024L/16L).toInt()){
        override fun sizeOf(key:String,value:Bitmap)=value.byteCount/1024
    }
    suspend fun load(contentUri:String,width:Int=320,height:Int=320):Bitmap?=withContext(Dispatchers.IO){
        cache.get(contentUri)?.let{return@withContext it}
        val bitmap=if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q)runCatching{resolver.loadThumbnail(Uri.parse(contentUri),Size(width,height),null)}.getOrNull() else null
        bitmap?.also{cache.put(contentUri,it)}
    }
}
