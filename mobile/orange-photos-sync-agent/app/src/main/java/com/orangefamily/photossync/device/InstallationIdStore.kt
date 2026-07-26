package com.orangefamily.photossync.device

import android.content.Context
import java.util.UUID

class InstallationIdStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun getOrCreate(): String = stableInstallationId(preferences.getString(KEY_INSTALLATION_ID, null), { UUID.randomUUID().toString() }) {
        preferences.edit().putString(KEY_INSTALLATION_ID, it).apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "orange_photos_installation"
        const val KEY_INSTALLATION_ID = "installation_id"
    }
}

internal fun stableInstallationId(existing: String?, generate: () -> String, persist: (String) -> Unit): String {
    if (!existing.isNullOrBlank()) return existing
    return generate().also(persist)
}
