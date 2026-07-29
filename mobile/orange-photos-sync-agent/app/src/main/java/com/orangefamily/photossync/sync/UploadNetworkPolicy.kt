package com.orangefamily.photossync.sync

import android.content.Context

enum class UploadNetworkPolicy{WIFI_ONLY,MOBILE_UP_TO_800_MB,ANY_NETWORK}

class UploadNetworkPolicyStore(context:Context){private val preferences=context.applicationContext.getSharedPreferences("orange_photos_upload_preferences",Context.MODE_PRIVATE);fun get(accountUserId:String)=runCatching{UploadNetworkPolicy.valueOf(preferences.getString("network_policy_$accountUserId",null).orEmpty())}.getOrDefault(UploadNetworkPolicy.WIFI_ONLY);fun set(accountUserId:String,policy:UploadNetworkPolicy){preferences.edit().putString("network_policy_$accountUserId",policy.name).apply()}}

object UploadNetworkRules{
    const val MOBILE_SIZE_LIMIT_BYTES=800L*1024L*1024L
    const val NON_RESUMABLE_RETRY_LIMIT_BYTES=MOBILE_SIZE_LIMIT_BYTES
    fun canUpload(policy:UploadNetworkPolicy,isUnmetered:Boolean,sizeBytes:Long)=when(policy){UploadNetworkPolicy.WIFI_ONLY->isUnmetered;UploadNetworkPolicy.MOBILE_UP_TO_800_MB->isUnmetered||sizeBytes<=MOBILE_SIZE_LIMIT_BYTES;UploadNetworkPolicy.ANY_NETWORK->true}
    fun interruptedFailureCode(uploadMode:String?,sizeBytes:Long,bytesSent:Long)=if(uploadMode=="direct_backend"&&sizeBytes>NON_RESUMABLE_RETRY_LIMIT_BYTES&&bytesSent>0)"LARGE_UPLOAD_INTERRUPTED" else "NETWORK_ERROR"
    fun reconciledRemoteId(decision:String,photoId:String?)=photoId?.takeIf{decision=="already_owned"&&it.isNotBlank()}
}
