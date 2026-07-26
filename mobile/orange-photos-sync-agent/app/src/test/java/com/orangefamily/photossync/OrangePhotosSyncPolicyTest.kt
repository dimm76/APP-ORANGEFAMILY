package com.orangefamily.photossync

import com.orangefamily.photossync.sync.OrangePhotosSyncApi
import com.orangefamily.photossync.sync.OrangePhotosSyncPolicy
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
}
