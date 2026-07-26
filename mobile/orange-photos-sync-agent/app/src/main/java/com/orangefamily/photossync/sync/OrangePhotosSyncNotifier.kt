package com.orangefamily.photossync.sync

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.orangefamily.photossync.MainActivity
import com.orangefamily.photossync.R

class OrangePhotosSyncNotifier(private val context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val manager = NotificationManagerCompat.from(context)

    fun notifyResult(uploaded: Int, failed: Int) {
        createChannel()
        if (!canNotify()) return
        val decision = OrangePhotosSyncPolicy.notification(uploaded, failed, preferences.getInt(KEY_LAST_FAILED, -1))
        if (failed > 0) {
            if (decision.showError) {
                manager.notify(STATUS_NOTIFICATION_ID, notification(context.resources.getQuantityString(R.plurals.sync_failed_notification, failed, failed)))
                preferences.edit().putInt(KEY_LAST_FAILED, failed).apply()
            }
            return
        }
        if (decision.cancelError) manager.cancel(STATUS_NOTIFICATION_ID)
        preferences.edit().putInt(KEY_LAST_FAILED, 0).apply()
        if (decision.showSuccess) manager.notify(STATUS_NOTIFICATION_ID, notification(context.resources.getQuantityString(R.plurals.sync_success_notification, uploaded, uploaded)))
    }

    private fun notification(message: String) = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(context.getString(R.string.notification_title))
        .setContentText(message)
        .setAutoCancel(true)
        .setContentIntent(PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        .build()

    private fun canNotify() = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL_ID, context.getString(R.string.sync_notification_channel), NotificationManager.IMPORTANCE_DEFAULT))
    }

    companion object {
        const val CHANNEL_ID = "orange_photos_sync_status"
        const val STATUS_NOTIFICATION_ID = 4101
        private const val PREFERENCES_NAME = "orange_photos_sync_notifications"
        private const val KEY_LAST_FAILED = "last_failed_count"
    }
}
