package com.orangefamily.photossync.device

import android.content.ContentUris
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.content.ContentResolver
import android.provider.MediaStore
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.orangefamily.photossync.data.LocalMediaItem

data class DeviceMediaFolder(
    val stableId: String,
    val name: String,
    val itemCount: Int,
    val newestUri: String,
    val newestDate: Long,
    val containsVideo: Boolean,
)

data class DeviceTrashItem(val media:LocalMediaItem,val expiresAtSeconds:Long?)

enum class DeviceMediaSort {
    DATE_DESC,
    DATE_ASC,
    SIZE_DESC,
    SIZE_ASC,
    NAME_ASC,
    NAME_DESC,
}

class DeviceMediaStoreScanner(context: Context) {
    private val appContext = context.applicationContext
    private val resolver = appContext.contentResolver

    fun scan(accountUserId: String): List<LocalMediaItem> = buildList {
        val volumes = if (Build.VERSION.SDK_INT >= 29) MediaStore.getExternalVolumeNames(appContext) else setOf("external")
        for (volume in volumes) {
            addAll(query(accountUserId, volume, LocalMediaItem.TYPE_IMAGE))
            addAll(query(accountUserId, volume, LocalMediaItem.TYPE_VIDEO))
        }
    }

    suspend fun scanFolders(accountUserId:String):List<DeviceMediaFolder> = withContext(Dispatchers.IO){ folders(scan(accountUserId)) }

    suspend fun scanBucket(accountUserId:String,bucketId:String,limit:Int,offset:Int,sort:DeviceMediaSort=DeviceMediaSort.DATE_DESC):List<LocalMediaItem> = withContext(Dispatchers.IO){
        val parsed=parseBucketId(bucketId)
        val items=listOf(LocalMediaItem.TYPE_IMAGE,LocalMediaItem.TYPE_VIDEO).flatMap{query(accountUserId,parsed.volume,it,parsed.rawBucketId)}
        val comparator=when(sort){
            DeviceMediaSort.DATE_DESC->compareByDescending<LocalMediaItem>{it.dateTaken?:it.dateAdded*1000}.thenByDescending{it.mediaStoreId}
            DeviceMediaSort.DATE_ASC->compareBy<LocalMediaItem>{it.dateTaken?:it.dateAdded*1000}.thenBy{it.mediaStoreId}
            DeviceMediaSort.SIZE_DESC->compareByDescending<LocalMediaItem>{it.sizeBytes}.thenByDescending{it.mediaStoreId}
            DeviceMediaSort.SIZE_ASC->compareBy<LocalMediaItem>{it.sizeBytes}.thenBy{it.mediaStoreId}
            DeviceMediaSort.NAME_ASC->compareBy<LocalMediaItem>{it.displayName.lowercase()}.thenBy{it.mediaStoreId}
            DeviceMediaSort.NAME_DESC->compareByDescending<LocalMediaItem>{it.displayName.lowercase()}.thenByDescending{it.mediaStoreId}
        }
        items.sortedWith(comparator).drop(offset).take(limit)
    }

    suspend fun scanBucketIds(accountUserId:String,bucketId:String)=scanBucket(accountUserId,bucketId,Int.MAX_VALUE,0,DeviceMediaSort.DATE_DESC).map(DeviceMediaRules::stableId)
    suspend fun exists(item:LocalMediaItem)=withContext(Dispatchers.IO){runCatching{resolver.openFileDescriptor(Uri.parse(item.contentUri),"r")?.use{true}?:false}.getOrDefault(false)}
    suspend fun isActive(item:LocalMediaItem)=withContext(Dispatchers.IO){if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R)exists(item) else runCatching{resolver.query(Uri.parse(item.contentUri),arrayOf(MediaStore.MediaColumns.IS_TRASHED),null,null,null)?.use{it.moveToFirst()&&it.getInt(0)==0}?:false}.getOrDefault(false)}

    suspend fun scanTrash(accountUserId:String):List<DeviceTrashItem> = withContext(Dispatchers.IO){
        if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R)return@withContext emptyList()
        val volumes=MediaStore.getExternalVolumeNames(appContext)
        volumes.flatMap{volume->listOf(LocalMediaItem.TYPE_IMAGE,LocalMediaItem.TYPE_VIDEO).flatMap{queryTrash(accountUserId,volume,it)}}.sortedBy{it.expiresAtSeconds?:Long.MAX_VALUE}
    }

    private fun query(accountUserId: String, volume: String, type: String, rawBucketId:String?=null): List<LocalMediaItem> {
        val base = if (type == LocalMediaItem.TYPE_IMAGE) MediaStore.Images.Media.getContentUri(volume) else MediaStore.Video.Media.getContentUri(volume)
        val projection = buildList {
            add(MediaStore.MediaColumns._ID); add(MediaStore.MediaColumns.DISPLAY_NAME); add(MediaStore.MediaColumns.MIME_TYPE)
            add(MediaStore.MediaColumns.SIZE); add(MediaStore.MediaColumns.DATE_ADDED); add(MediaStore.MediaColumns.DATE_MODIFIED)
            add(MediaStore.MediaColumns.DATE_TAKEN); add(MediaStore.MediaColumns.WIDTH); add(MediaStore.MediaColumns.HEIGHT)
            add(MediaStore.Images.Media.BUCKET_ID); add(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
            if (Build.VERSION.SDK_INT >= 29) add(MediaStore.MediaColumns.RELATIVE_PATH)
            if (type == LocalMediaItem.TYPE_VIDEO) add(MediaStore.Video.Media.DURATION)
        }.toTypedArray()
        val selections=normalMediaSelections(rawBucketId,Build.VERSION.SDK_INT>=Build.VERSION_CODES.R)
        val selectionArgs=buildList{rawBucketId?.let{add(it)}}.toTypedArray()
        return resolver.query(base, projection, selections.takeIf{it.isNotEmpty()}?.joinToString(" AND "), selectionArgs.takeIf{it.isNotEmpty()}, "${MediaStore.MediaColumns.DATE_TAKEN} DESC, ${MediaStore.MediaColumns._ID} DESC")?.use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    fun long(name: String) = cursor.getLong(cursor.getColumnIndexOrThrow(name))
                    fun nullableLong(name: String) = cursor.getColumnIndex(name).takeIf { it >= 0 && !cursor.isNull(it) }?.let(cursor::getLong)
                    fun nullableString(name: String) = cursor.getColumnIndex(name).takeIf { it >= 0 && !cursor.isNull(it) }?.let(cursor::getString)
                    val id=long(MediaStore.MediaColumns._ID)
                    add(LocalMediaItem(
                        accountUserId=accountUserId, mediaStoreId=id, mediaCollection=volume, mediaType=type,
                        contentUri=ContentUris.withAppendedId(base,id).toString(), displayName=nullableString(MediaStore.MediaColumns.DISPLAY_NAME).orEmpty(),
                        mimeType=nullableString(MediaStore.MediaColumns.MIME_TYPE), sizeBytes=long(MediaStore.MediaColumns.SIZE),
                        dateAdded=long(MediaStore.MediaColumns.DATE_ADDED), dateModified=long(MediaStore.MediaColumns.DATE_MODIFIED),
                        dateTaken=nullableLong(MediaStore.MediaColumns.DATE_TAKEN), relativePath=nullableString(MediaStore.MediaColumns.RELATIVE_PATH),
                        width=nullableLong(MediaStore.MediaColumns.WIDTH)?.toInt(), height=nullableLong(MediaStore.MediaColumns.HEIGHT)?.toInt(),
                        durationMs=if(type==LocalMediaItem.TYPE_VIDEO) nullableLong(MediaStore.Video.Media.DURATION) else null,
                        detectedAt=System.currentTimeMillis(), bucketId="$volume:${nullableString(MediaStore.Images.Media.BUCKET_ID).orEmpty()}",
                        bucketName=nullableString(MediaStore.Images.Media.BUCKET_DISPLAY_NAME) ?: "Sin carpeta",
                        localStatus=LocalMediaItem.STATUS_DISCOVERED,
                    ))
                }
            }
        } ?: emptyList()
    }

    private fun queryTrash(accountUserId:String,volume:String,type:String):List<DeviceTrashItem>{
        if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R)return emptyList()
        val base=if(type==LocalMediaItem.TYPE_IMAGE)MediaStore.Images.Media.getContentUri(volume)else MediaStore.Video.Media.getContentUri(volume)
        val projection=arrayOf(MediaStore.MediaColumns._ID,MediaStore.MediaColumns.DISPLAY_NAME,MediaStore.MediaColumns.MIME_TYPE,MediaStore.MediaColumns.SIZE,MediaStore.MediaColumns.DATE_ADDED,MediaStore.MediaColumns.DATE_MODIFIED,MediaStore.MediaColumns.DATE_TAKEN,MediaStore.MediaColumns.WIDTH,MediaStore.MediaColumns.HEIGHT,MediaStore.Images.Media.BUCKET_ID,MediaStore.Images.Media.BUCKET_DISPLAY_NAME,MediaStore.MediaColumns.RELATIVE_PATH,MediaStore.MediaColumns.DATE_EXPIRES)
        val args=Bundle().apply{putInt(MediaStore.QUERY_ARG_MATCH_TRASHED,MediaStore.MATCH_INCLUDE);putString(ContentResolver.QUERY_ARG_SQL_SELECTION,trashMediaSelection());putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,arrayOf("1"));putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER,"${MediaStore.MediaColumns.DATE_EXPIRES} ASC")}
        return resolver.query(base,projection,args,null)?.use{cursor->buildList{while(cursor.moveToNext()){
            fun long(name:String):Long = cursor.getLong(cursor.getColumnIndexOrThrow(name))
            fun nullableLong(name:String):Long? = cursor.getColumnIndex(name).takeIf{it>=0&&!cursor.isNull(it)}?.let{cursor.getLong(it)}
            fun nullableString(name:String):String? = cursor.getColumnIndex(name).takeIf{it>=0&&!cursor.isNull(it)}?.let{cursor.getString(it)}
            val id=long(MediaStore.MediaColumns._ID);val media=LocalMediaItem(accountUserId=accountUserId,mediaStoreId=id,mediaCollection=volume,mediaType=type,contentUri=ContentUris.withAppendedId(base,id).toString(),displayName=nullableString(MediaStore.MediaColumns.DISPLAY_NAME).orEmpty(),mimeType=nullableString(MediaStore.MediaColumns.MIME_TYPE),sizeBytes=long(MediaStore.MediaColumns.SIZE),dateAdded=long(MediaStore.MediaColumns.DATE_ADDED),dateModified=long(MediaStore.MediaColumns.DATE_MODIFIED),dateTaken=nullableLong(MediaStore.MediaColumns.DATE_TAKEN),relativePath=nullableString(MediaStore.MediaColumns.RELATIVE_PATH),width=nullableLong(MediaStore.MediaColumns.WIDTH)?.toInt(),height=nullableLong(MediaStore.MediaColumns.HEIGHT)?.toInt(),durationMs=null,detectedAt=System.currentTimeMillis(),bucketId="$volume:${nullableString(MediaStore.Images.Media.BUCKET_ID).orEmpty()}",bucketName=nullableString(MediaStore.Images.Media.BUCKET_DISPLAY_NAME),localStatus=LocalMediaItem.STATUS_DISCOVERED)
            add(DeviceTrashItem(media,nullableLong(MediaStore.MediaColumns.DATE_EXPIRES)))
        }}}?:emptyList()
    }

    companion object {
        internal fun normalMediaSelections(rawBucketId:String?,supportsTrash:Boolean)=buildList{rawBucketId?.let{add("${MediaStore.Images.Media.BUCKET_ID}=?")};if(supportsTrash)add("${MediaStore.MediaColumns.IS_TRASHED}=0")}
        internal fun trashMediaSelection()="${MediaStore.MediaColumns.IS_TRASHED}=?"
        fun folders(items: List<LocalMediaItem>) = items.groupBy { it.bucketId.orEmpty() }.mapNotNull { (id, values) ->
            val newest=values.maxByOrNull { it.dateTaken ?: it.dateAdded*1000 } ?: return@mapNotNull null
            DeviceMediaFolder(id,newest.bucketName ?: "Sin carpeta",values.size,newest.contentUri,newest.dateTaken ?: newest.dateAdded*1000,values.any { it.mediaType==LocalMediaItem.TYPE_VIDEO })
        }.sortedByDescending(DeviceMediaFolder::newestDate)
    }

    private data class ParsedBucket(val volume:String,val rawBucketId:String)
    private fun parseBucketId(value:String):ParsedBucket { val separator=value.indexOf(':'); require(separator>0){"Bucket inválido"}; return ParsedBucket(value.substring(0,separator),value.substring(separator+1)) }
}
