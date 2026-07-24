package com.orangefamily.photossync.media

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

enum class MediaPermissionAccess {
    NOT_REQUESTED,
    FULL,
    PARTIAL,
    DENIED,
}

object MediaPermissions {
    private const val PREFERENCES_NAME = "orangefamily_media_permissions"
    private const val KEY_REQUESTED = "requested"

    fun requiredPermissions(): Array<String> = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
        )
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
        )
        else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
    }

    fun markRequested(context: Context) {
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_REQUESTED, true)
            .apply()
    }

    fun evaluate(activity: Activity): MediaPermissionAccess {
        return evaluate(activity as Context)
    }

    fun evaluate(context: Context): MediaPermissionAccess {
        val full = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
                granted(context, Manifest.permission.READ_MEDIA_IMAGES) &&
                    granted(context, Manifest.permission.READ_MEDIA_VIDEO)
            }
            else -> granted(context, Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        if (full) return MediaPermissionAccess.FULL

        val partial = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
            granted(context, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) ||
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            (granted(context, Manifest.permission.READ_MEDIA_IMAGES) ||
                granted(context, Manifest.permission.READ_MEDIA_VIDEO))
        if (partial) return MediaPermissionAccess.PARTIAL

        val requested = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_REQUESTED, false)
        return if (requested) MediaPermissionAccess.DENIED else MediaPermissionAccess.NOT_REQUESTED
    }

    private fun granted(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}
