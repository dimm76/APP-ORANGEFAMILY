package com.orangefamily.photossync

import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.device.DeviceMediaRules
import com.orangefamily.photossync.device.DeviceMediaFolder
import com.orangefamily.photossync.device.DeviceMediaStoreScanner
import com.orangefamily.photossync.sync.formatUploadBytes
import com.orangefamily.photossync.sync.uploadPercent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceMediaRulesTest {
    private fun item(id: Long, cloud: String=LocalMediaItem.CLOUD_UNKNOWN, status: String=LocalMediaItem.STATUS_PENDING) =
        LocalMediaItem(accountUserId="u",mediaStoreId=id,mediaCollection="external",mediaType=LocalMediaItem.TYPE_IMAGE,contentUri="content://$id",displayName="$id.jpg",mimeType="image/jpeg",sizeBytes=1,dateAdded=1,dateTaken=null,relativePath=null,width=null,height=null,durationMs=null,detectedAt=1,cloudStatus=cloud,localStatus=status)

    @Test fun stableIdentityIncludesCollectionTypeAndId() = assertEquals("external:image:7",DeviceMediaRules.stableId(item(7)))
    @Test fun ascendingAndDescendingRangesMatch() {
        val values=(1L..5L).map(::item)
        assertEquals(DeviceMediaRules.range(values,1,4),DeviceMediaRules.range(values,4,1))
        assertEquals(4,DeviceMediaRules.range(values,1,4).size)
    }
    @Test fun onlyBackedUpIsSafeToDelete() {
        assertTrue(DeviceMediaRules.safeToDelete(item(1,LocalMediaItem.CLOUD_BACKED_UP)))
        assertFalse(DeviceMediaRules.safeToDelete(item(2,LocalMediaItem.CLOUD_POSSIBLE_MATCH)))
    }
    @Test fun localStatusesAreClassifiedPrecisely(){assertTrue(DeviceMediaRules.isQueued(item(1,status=LocalMediaItem.STATUS_PENDING)));assertTrue(DeviceMediaRules.isUploading(item(2,status=LocalMediaItem.STATUS_UPLOADING)));assertTrue(DeviceMediaRules.isFailed(item(3,status=LocalMediaItem.STATUS_FAILED)));assertTrue(DeviceMediaRules.isBackedUp(item(4,status=LocalMediaItem.STATUS_UPLOADED)));assertFalse(DeviceMediaRules.isQueued(item(5,LocalMediaItem.CLOUD_NOT_FOUND,LocalMediaItem.STATUS_FAILED)))}
    @Test fun possibleMatchIsNotQueuedAndNotSafe() { val value=item(1,LocalMediaItem.CLOUD_POSSIBLE_MATCH,LocalMediaItem.STATUS_UPLOADED);assertFalse(DeviceMediaRules.isPending(value));assertFalse(DeviceMediaRules.safeToDelete(value)) }
    @Test fun onlyBackedUpIsSafe() {
        listOf(LocalMediaItem.CLOUD_UNKNOWN,LocalMediaItem.CLOUD_CHECKING,LocalMediaItem.CLOUD_POSSIBLE_MATCH,LocalMediaItem.CLOUD_NOT_FOUND,LocalMediaItem.CLOUD_REMOTE_MISSING,LocalMediaItem.CLOUD_ERROR).forEach{assertFalse(DeviceMediaRules.safeToDelete(item(1,it)))}
        assertTrue(DeviceMediaRules.safeToDelete(item(1,LocalMediaItem.CLOUD_BACKED_UP)))
    }
    @Test fun ttlIsTwentyFourHours() { val value=item(1).copy(remoteVerifiedAt=1,cloudStatus=LocalMediaItem.CLOUD_NOT_FOUND);assertFalse(DeviceMediaRules.needsVerification(value,DeviceMediaRules.REMOTE_STATUS_TTL_MS));assertTrue(DeviceMediaRules.needsVerification(value,DeviceMediaRules.REMOTE_STATUS_TTL_MS+1)) }
    @Test fun sizeOrModifiedDateInvalidatesHash() { val value=item(1).copy(dateModified=10);assertTrue(DeviceMediaRules.metadataChanged(value,value.copy(sizeBytes=2)));assertTrue(DeviceMediaRules.metadataChanged(value,value.copy(dateModified=11)));assertFalse(DeviceMediaRules.metadataChanged(value,value)) }
    @Test fun pendingAndSafeSelectionsAreSeparated() { val values=listOf(item(1,LocalMediaItem.CLOUD_BACKED_UP,LocalMediaItem.STATUS_UPLOADED),item(2,LocalMediaItem.CLOUD_NOT_FOUND));assertEquals(1,DeviceMediaRules.safeItems(values).size);assertEquals(1,DeviceMediaRules.uploadablePending(values).size) }
    @Test fun authenticatedStartIsFolders() = assertEquals(AgentScreen.FOLDERS,initialAuthenticatedScreen())
    @Test fun folderSearchIsTrimmedAndCaseInsensitive() { val folders=listOf(DeviceMediaFolder("1","Cámara",1,"",1,false),DeviceMediaFolder("2","Screenshots",1,"",1,false));assertEquals(listOf("Cámara"),DeviceMediaRules.filterFolders(folders,"  CÁM ").map{it.name}) }
    @Test fun normalQueriesExcludeTrashAndTrashQueryIncludesOnlyTrash() { assertTrue(DeviceMediaStoreScanner.normalMediaSelections(null,true).single().contains("is_trashed=0"));assertTrue(DeviceMediaStoreScanner.trashMediaSelection().contains("is_trashed=?")) }
    @Test fun restoringKeepsConfirmedRemoteStateWhenMetadataIsUnchanged() { val backed=item(1,LocalMediaItem.CLOUD_BACKED_UP).copy(checksumSha256="a".repeat(64),remotePhotoId="remote");assertFalse(DeviceMediaRules.metadataChanged(backed,backed));assertTrue(backed.hasConfirmedRemoteCopy());assertEquals("remote",backed.remotePhotoId) }
    @Test fun remoteChecksUseAtMostTwoHundredItems() {
        assertEquals(listOf(200,200,1),DeviceMediaRules.batches((1..401).toList()).map(List<Int>::size))
    }
    @Test fun uploadPercentageIsBounded(){assertEquals(0,uploadPercent(1,0));assertEquals(42,uploadPercent(42,100));assertEquals(100,uploadPercent(120,100))}
    @Test fun uploadBytesAreReadable(){assertEquals("0 B",formatUploadBytes(0));assertEquals("1.0 KB",formatUploadBytes(1024));assertEquals("1.0 MB",formatUploadBytes(1024L*1024L))}
    @Test fun dngMediaIsTemporarilyIgnored() {
        assertTrue(DeviceMediaRules.shouldIgnoreLocalMedia("IMG_0001.DNG", "image/x-adobe-dng"))
        assertTrue(DeviceMediaRules.shouldIgnoreLocalMedia("IMG_0001", "image/x-adobe-dng"))
        assertTrue(DeviceMediaRules.shouldIgnoreLocalMedia("raw-photo.dng", null))
        assertFalse(DeviceMediaRules.shouldIgnoreLocalMedia("IMG_0001.jpg", "image/jpeg"))
        assertFalse(DeviceMediaRules.shouldIgnoreLocalMedia("VID_0001.mp4", "video/mp4"))
    }
}
