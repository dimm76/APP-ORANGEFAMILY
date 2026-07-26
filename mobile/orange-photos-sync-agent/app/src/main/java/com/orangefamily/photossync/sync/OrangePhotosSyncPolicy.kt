package com.orangefamily.photossync.sync

data class SyncNotificationDecision(val showError: Boolean, val cancelError: Boolean, val showSuccess: Boolean)

object OrangePhotosSyncPolicy {
    fun notification(uploaded: Int, failed: Int, lastFailed: Int) = SyncNotificationDecision(
        showError = failed > 0 && failed != lastFailed,
        cancelError = failed == 0,
        showSuccess = failed == 0 && uploaded > 0,
    )

    fun isTransient(status: Int, code: String) = status == 429 || status >= 500 || code in setOf("STORAGE_UPLOAD_FAILED", "DATABASE_REGISTRATION_FAILED")
    fun confirmedRemoteId(value: String?) = value?.takeIf(String::isNotBlank)
}
