package com.orangefamily.photossync

import com.orangefamily.photossync.sync.OrangePhotosSyncApi
import com.orangefamily.photossync.sync.OrangePhotosSyncPolicy
import com.orangefamily.photossync.sync.UploadNetworkPolicy
import com.orangefamily.photossync.sync.UploadNetworkRules
import com.orangefamily.photossync.sync.UploadProgressState
import com.orangefamily.photossync.sync.MultipartUploadRules
import com.orangefamily.photossync.device.stableInstallationId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrangePhotosSyncPolicyTest {
    @Test fun `installation id is generated once and remains stable`() {
        var stored: String? = null
        val first = stableInstallationId(stored, { "generated-id" }) { stored = it }
        val second = stableInstallationId(stored, { "different-id" }) { stored = it }
        assertEquals("generated-id", first)
        assertEquals(first, second)
    }

    @Test fun `sync headers identify installation without identity fields`() {
        val headers = OrangePhotosSyncApi.syncHeaders("installation-1")
        assertEquals("android_sync", headers["x-orange-client"])
        assertEquals("installation-1", headers["x-orange-installation-id"])
        assertFalse(headers.keys.any { it.contains("family") || it.contains("owner") || it.contains("user") })
    }

    @Test fun `uploaded state requires a remote id`() {
        assertNull(OrangePhotosSyncPolicy.confirmedRemoteId(null))
        assertNull(OrangePhotosSyncPolicy.confirmedRemoteId(""))
        assertEquals("photo-1", OrangePhotosSyncPolicy.confirmedRemoteId("photo-1"))
    }

    @Test fun `transient errors retry and permanent errors do not`() {
        assertTrue(OrangePhotosSyncPolicy.isTransient(503, "HTTP_503"))
        assertTrue(OrangePhotosSyncPolicy.isTransient(400, "STORAGE_UPLOAD_FAILED"))
        assertFalse(OrangePhotosSyncPolicy.isTransient(400, "INVALID_METADATA"))
    }

    @Test fun `notifications are grouped and unchanged failures are suppressed`() {
        assertTrue(OrangePhotosSyncPolicy.notification(0, 3, -1).showError)
        assertFalse(OrangePhotosSyncPolicy.notification(0, 3, 3).showError)
        assertTrue(OrangePhotosSyncPolicy.notification(12, 0, 3).showSuccess)
        assertTrue(OrangePhotosSyncPolicy.notification(12, 0, 3).cancelError)
    }

    @Test fun `network policies defer and allow the documented sizes`(){val mb=1024L*1024L;assertFalse(UploadNetworkRules.canUpload(UploadNetworkPolicy.WIFI_ONLY,false,1));assertTrue(UploadNetworkRules.canUpload(UploadNetworkPolicy.WIFI_ONLY,true,1));assertTrue(UploadNetworkRules.canUpload(UploadNetworkPolicy.MOBILE_UP_TO_800_MB,false,799*mb));assertFalse(UploadNetworkRules.canUpload(UploadNetworkPolicy.MOBILE_UP_TO_800_MB,false,801*mb));assertTrue(UploadNetworkRules.canUpload(UploadNetworkPolicy.ANY_NETWORK,false,2L*1024*mb))}
    @Test fun `uncertain and duplicate uploads reconcile only with an owned photo`(){assertEquals("photo",UploadNetworkRules.reconciledRemoteId("already_owned","photo"));assertNull(UploadNetworkRules.reconciledRemoteId("upload_required","photo"));assertNull(UploadNetworkRules.reconciledRemoteId("already_owned",null))}
    @Test fun `large interrupted direct upload is protected from automatic retry`(){assertEquals("LARGE_UPLOAD_INTERRUPTED",UploadNetworkRules.interruptedFailureCode("direct_backend",801L*1024*1024,1));assertEquals("NETWORK_ERROR",UploadNetworkRules.interruptedFailureCode("direct_backend",799L*1024*1024,1))}
    @Test fun `run totals keep active and deferred items pending`(){val value=UploadProgressState(totalThisRun=8,deferredByNetwork=2).withCompleted(3,1);assertEquals(8,value.totalThisRun);assertEquals(3,value.completedThisRun);assertEquals(1,value.failedThisRun);assertEquals(4,value.pendingThisRun);assertEquals(2,value.deferredByNetwork)}
    @Test fun `multipart resumes only missing parts and counts the short final part`(){val mb=1024L*1024L;val size=60*mb;val part=25*mb;assertEquals(listOf(2),MultipartUploadRules.missingParts(3,setOf(1,3)));assertEquals(35*mb,MultipartUploadRules.confirmedBytes(size,part,setOf(1,3)));assertEquals(10*mb,MultipartUploadRules.partLength(size,part,3))}
}
