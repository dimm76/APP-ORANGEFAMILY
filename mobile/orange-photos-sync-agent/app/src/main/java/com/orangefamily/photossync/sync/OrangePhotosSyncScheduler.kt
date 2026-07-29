package com.orangefamily.photossync.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class OrangePhotosSyncScheduler(context: Context) {
    private val workManager = WorkManager.getInstance(context.applicationContext)
    private val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun scheduleImmediateSync(accountUserId: String) {
        val request = OneTimeWorkRequestBuilder<OrangePhotosSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniqueWork(immediateName(accountUserId), ExistingWorkPolicy.KEEP, request)
    }

    fun scheduleUnmeteredSync(accountUserId: String) {
        val request = oneTimeRequest(NetworkType.UNMETERED)
        workManager.enqueueUniqueWork(unmeteredName(accountUserId), ExistingWorkPolicy.KEEP, request)
    }

    fun scheduleMediaChangeSync(accountUserId: String) {
        val request = oneTimeRequest(NetworkType.CONNECTED, 2)
        workManager.enqueueUniqueWork(mediaChangeName(accountUserId), ExistingWorkPolicy.REPLACE, request)
    }

    fun schedulePeriodicSync(accountUserId: String) {
        val request = PeriodicWorkRequestBuilder<OrangePhotosSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniquePeriodicWork(periodicName(accountUserId), ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun rescheduleForPolicy(accountUserId: String, policy: UploadNetworkPolicy) {
        when (policy) {
            UploadNetworkPolicy.WIFI_ONLY -> {
                workManager.cancelUniqueWork(immediateName(accountUserId))
                scheduleUnmeteredSync(accountUserId)
            }
            UploadNetworkPolicy.MOBILE_UP_TO_800_MB -> {
                scheduleImmediateSync(accountUserId)
                scheduleUnmeteredSync(accountUserId)
            }
            UploadNetworkPolicy.ANY_NETWORK -> {
                workManager.cancelUniqueWork(unmeteredName(accountUserId))
                scheduleImmediateSync(accountUserId)
            }
        }
    }

    private fun oneTimeRequest(networkType: NetworkType, delaySeconds: Long = 0) =
        OneTimeWorkRequestBuilder<OrangePhotosSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(networkType).build())
            .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()

    private fun immediateName(userId: String) = "orange_photos_sync_$userId"
    private fun unmeteredName(userId: String) = "orange_photos_sync_unmetered_$userId"
    private fun mediaChangeName(userId: String) = "orange_photos_media_change_$userId"
    // Conserva el nombre histórico para que una actualización no deje dos trabajos periódicos activos.
    private fun periodicName(userId: String) = "orange-photos-sync-periodic-$userId"
}
