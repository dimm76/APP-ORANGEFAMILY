package com.orangefamily.photossync

import android.app.Application
import android.content.Context
import android.database.ContentObserver
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import com.orangefamily.photossync.sync.OrangePhotosSyncScheduler
import com.orangefamily.photossync.sync.UploadNetworkPolicyStore

class OrangePhotosSyncApplication : Application() {
    private val handler = Handler(Looper.getMainLooper())
    private val scheduler by lazy { OrangePhotosSyncScheduler(this) }
    private val policyStore by lazy { UploadNetworkPolicyStore(this) }
    private val connectivityManager by lazy {
        getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }
    private var observedAccountUserId: String? = null
    private var registered = false
    private var networkCallbackRegistered = false
    private val scheduleChange = Runnable {
        observedAccountUserId?.let(scheduler::scheduleMediaChangeSync)
    }
    private val observer = object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean) {
            handler.removeCallbacks(scheduleChange)
            handler.postDelayed(scheduleChange, MEDIA_CHANGE_DEBOUNCE_MS)
        }
    }
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)) return
            val accountUserId = observedAccountUserId ?: return
            scheduler.onUnmeteredNetworkAvailable(
                accountUserId = accountUserId,
                policy = policyStore.get(accountUserId),
            )
        }
    }

    override fun onCreate() {
        super.onCreate()
        connectivityManager.registerNetworkCallback(
            NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build(),
            networkCallback,
        )
        networkCallbackRegistered = true
    }

    override fun onTerminate() {
        if (networkCallbackRegistered) {
            runCatching { connectivityManager.unregisterNetworkCallback(networkCallback) }
        }
        super.onTerminate()
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
