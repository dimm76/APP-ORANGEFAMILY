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

    fun enqueueNow(accountUserId: String) {
        val request = OneTimeWorkRequestBuilder<OrangePhotosSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniqueWork(nowName(accountUserId), ExistingWorkPolicy.KEEP, request)
    }

    fun ensurePeriodic(accountUserId: String) {
        val request = PeriodicWorkRequestBuilder<OrangePhotosSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniquePeriodicWork(periodicName(accountUserId), ExistingPeriodicWorkPolicy.KEEP, request)
    }

    private fun nowName(userId: String) = "orange-photos-sync-now-$userId"
    private fun periodicName(userId: String) = "orange-photos-sync-periodic-$userId"
}
