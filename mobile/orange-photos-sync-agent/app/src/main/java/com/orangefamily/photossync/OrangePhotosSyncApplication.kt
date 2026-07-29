package com.orangefamily.photossync

import android.app.Application
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import com.orangefamily.photossync.sync.OrangePhotosSyncScheduler

class OrangePhotosSyncApplication : Application() {
    private val handler = Handler(Looper.getMainLooper())
    private val scheduler by lazy { OrangePhotosSyncScheduler(this) }
    private var observedAccountUserId: String? = null
    private var registered = false
    private val scheduleChange = Runnable {
        observedAccountUserId?.let(scheduler::scheduleMediaChangeSync)
    }
    private val observer = object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean) {
            handler.removeCallbacks(scheduleChange)
            handler.postDelayed(scheduleChange, MEDIA_CHANGE_DEBOUNCE_MS)
        }
    }

    fun configureMediaObservation(accountUserId: String?) {
        if (observedAccountUserId == accountUserId && registered == (accountUserId != null)) return
        handler.removeCallbacks(scheduleChange)
        if (registered) contentResolver.unregisterContentObserver(observer)
        observedAccountUserId = accountUserId
        registered = accountUserId != null
        if (registered) {
            contentResolver.registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, observer)
            contentResolver.registerContentObserver(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true, observer)
        }
    }

    private companion object {
        const val MEDIA_CHANGE_DEBOUNCE_MS = 1_500L
    }
}
