package com.orangefamily.photossync.sync

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

data class UploadProgressState(val running:Boolean=false,val itemId:Long?=null,val displayName:String?=null,val bytesSent:Long=0,val totalBytes:Long=0,val totalThisRun:Int=0,val completedThisRun:Int=0,val failedThisRun:Int=0,val pendingThisRun:Int=0,val deferredByNetwork:Int=0){fun withCompleted(completed:Int,failed:Int)=copy(completedThisRun=completed,failedThisRun=failed,pendingThisRun=(totalThisRun-completed-failed).coerceAtLeast(0))}

object OrangePhotosUploadProgress{
    private val mutableState=MutableStateFlow(UploadProgressState())
    val state:StateFlow<UploadProgressState> = mutableState.asStateFlow()
    fun update(value:UploadProgressState){mutableState.value=value}
    fun reset(){mutableState.value=UploadProgressState()}
}

fun uploadPercent(bytesSent:Long,totalBytes:Long)=if(totalBytes>0)((bytesSent.coerceIn(0,totalBytes)*100)/totalBytes).toInt() else 0

fun formatUploadBytes(value:Long):String{val safe=value.coerceAtLeast(0);return when{safe>=1024L*1024L*1024L->String.format(Locale.US,"%.1f GB",safe/(1024.0*1024.0*1024.0));safe>=1024L*1024L->String.format(Locale.US,"%.1f MB",safe/(1024.0*1024.0));safe>=1024L->String.format(Locale.US,"%.1f KB",safe/1024.0);else->"$safe B"}}
