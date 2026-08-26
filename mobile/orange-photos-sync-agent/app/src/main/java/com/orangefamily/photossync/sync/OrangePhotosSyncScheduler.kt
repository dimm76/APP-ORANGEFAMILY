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
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

class OrangePhotosSyncScheduler(context: Context) {
    private val workManager = WorkManager.getInstance(context.applicationContext)
    private val policyStore = UploadNetworkPolicyStore(context.applicationContext)
    private val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun scheduleImmediateSync(accountUserId: String) {
        val request = OneTimeWorkRequestBuilder<OrangePhotosSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniqueWork(immediateName(accountUserId), ExistingWorkPolicy.KEEP, request)
    }

    fun scheduleManualSync(accountUserId: String) {
        if (accountUserId.isBlank()) return
        val request = oneTimeRequest(
            networkType = NetworkType.CONNECTED,
            manualTrigger = true,
        )

        workManager.enqueueUniqueWork(
            manualName(accountUserId),
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request,
        )
    }

    fun scheduleAutomaticImmediateSync(accountUserId: String) {
        if (policyStore.get(accountUserId) == UploadNetworkPolicy.MANUAL_ONLY) return
        scheduleImmediateSync(accountUserId)
    }

    fun scheduleUnmeteredSync(accountUserId: String) {
        if (policyStore.get(accountUserId) == UploadNetworkPolicy.MANUAL_ONLY) return
        val request = oneTimeRequest(NetworkType.UNMETERED)
        workManager.enqueueUniqueWork(unmeteredName(accountUserId), ExistingWorkPolicy.REPLACE, request)
    }

    fun scheduleMediaChangeSync(accountUserId: String) {
        if (policyStore.get(accountUserId) == UploadNetworkPolicy.MANUAL_ONLY) return
        val request = oneTimeRequest(NetworkType.CONNECTED, 2)
        workManager.enqueueUniqueWork(mediaChangeName(accountUserId), ExistingWorkPolicy.REPLACE, request)
    }

    fun schedulePeriodicSync(accountUserId: String) {
        if (policyStore.get(accountUserId) == UploadNetworkPolicy.MANUAL_ONLY) {
            workManager.cancelUniqueWork(periodicName(accountUserId))
            return
        }
        val request = PeriodicWorkRequestBuilder<OrangePhotosSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniquePeriodicWork(periodicName(accountUserId), ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun onUnmeteredNetworkAvailable(accountUserId: String, policy: UploadNetworkPolicy) {
        when (policy) {
            UploadNetworkPolicy.MANUAL_ONLY,
            UploadNetworkPolicy.ANY_NETWORK,
            -> Unit
            UploadNetworkPolicy.WIFI_ONLY,
            UploadNetworkPolicy.MOBILE_UP_TO_800_MB,
            -> scheduleUnmeteredSync(accountUserId)
        }
    }

    fun rescheduleForPolicy(accountUserId: String, policy: UploadNetworkPolicy) {
        workManager.cancelUniqueWork(immediateName(accountUserId))
        workManager.cancelUniqueWork(unmeteredName(accountUserId))
        workManager.cancelUniqueWork(mediaChangeName(accountUserId))

        when (policy) {
            UploadNetworkPolicy.MANUAL_ONLY -> {
                workManager.cancelUniqueWork(periodicName(accountUserId))
            }
            UploadNetworkPolicy.WIFI_ONLY -> {
                schedulePeriodicSync(accountUserId)
                scheduleUnmeteredSync(accountUserId)
            }
            UploadNetworkPolicy.MOBILE_UP_TO_800_MB,
            UploadNetworkPolicy.ANY_NETWORK,
            -> {
                schedulePeriodicSync(accountUserId)
                scheduleReplacingImmediateSync(accountUserId)
            }
        }
    }

    private fun scheduleReplacingImmediateSync(accountUserId: String) {
        val request = oneTimeRequest(NetworkType.CONNECTED)
        workManager.enqueueUniqueWork(
            immediateName(accountUserId),
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    private fun oneTimeRequest(
        networkType: NetworkType,
        delaySeconds: Long = 0,
        manualTrigger: Boolean = false,
    ) =
        OneTimeWorkRequestBuilder<OrangePhotosSyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(networkType)
                    .build(),
            )
            .setInputData(workDataOf(OrangePhotosSyncWorker.INPUT_MANUAL_TRIGGER to manualTrigger))
            .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()

    private fun immediateName(userId: String) = "orange_photos_sync_$userId"
    private fun manualName(userId: String) = "orange_photos_sync_manual_$userId"
    private fun unmeteredName(userId: String) = "orange_photos_sync_unmetered_$userId"
    private fun mediaChangeName(userId: String) = "orange_photos_media_change_$userId"
    // Conserva el nombre histórico para que una actualización no deje dos trabajos periódicos activos.
    private fun periodicName(userId: String) = "orange-photos-sync-periodic-$userId"

}
