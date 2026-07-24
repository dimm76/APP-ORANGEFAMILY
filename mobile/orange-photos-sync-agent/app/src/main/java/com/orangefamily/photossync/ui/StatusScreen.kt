package com.orangefamily.photossync.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.orangefamily.photossync.R
import com.orangefamily.photossync.auth.AuthUser
import com.orangefamily.photossync.backup.CameraBackupController.CameraBackupState
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.media.MediaPermissionAccess
import java.text.DateFormat
import java.util.Date

@Composable
fun StatusScreen(
    user: AuthUser,
    loggingOut: Boolean,
    cameraBackupState: CameraBackupState,
    onRequestMediaPermission: () -> Unit,
    onOpenPermissionSettings: () -> Unit,
    onActivate: () -> Unit,
    onScan: () -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val family = user.families.firstOrNull()
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    text = stringResource(R.string.session_active),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(12.dp))
                user.name?.let {
                    Text(text = it, style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(4.dp))
                }
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(20.dp))
                if (family == null) {
                    Text(stringResource(R.string.no_family))
                } else {
                    StatusValue(stringResource(R.string.family_label), family.name)
                    Spacer(Modifier.height(8.dp))
                    StatusValue(stringResource(R.string.role_label), family.role)
                }
            }
        }

        CameraBackupCard(
            state = cameraBackupState,
            onRequestMediaPermission = onRequestMediaPermission,
            onOpenPermissionSettings = onOpenPermissionSettings,
            onActivate = onActivate,
            onScan = onScan,
        )

        Button(onClick = onLogout, enabled = !loggingOut) {
            Text(
                stringResource(if (loggingOut) R.string.logout_loading else R.string.logout_action),
            )
        }
    }
}

@Composable
private fun CameraBackupCard(
    state: CameraBackupState,
    onRequestMediaPermission: () -> Unit,
    onOpenPermissionSettings: () -> Unit,
    onActivate: () -> Unit,
    onScan: () -> Unit,
) {
    val config = state.config
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(
                text = stringResource(R.string.camera_backup_title),
                style = MaterialTheme.typography.titleLarge,
            )
            Spacer(Modifier.height(16.dp))
            StatusValue(
                stringResource(R.string.permission_status_label),
                permissionLabel(state.permission),
            )
            Spacer(Modifier.height(8.dp))
            StatusValue(
                stringResource(R.string.agent_status_label),
                when {
                    state.loading -> stringResource(R.string.agent_loading)
                    config?.enabled == true -> stringResource(R.string.agent_enabled)
                    else -> stringResource(R.string.agent_not_enabled)
                },
            )
            config?.let {
                Spacer(Modifier.height(8.dp))
                StatusValue(
                    stringResource(R.string.activated_at_label),
                    formatDate(it.activatedAt),
                )
            }
            Spacer(Modifier.height(8.dp))
            StatusValue(
                stringResource(R.string.last_scan_label),
                config?.lastScanAt?.let(::formatDate) ?: stringResource(R.string.never_scanned),
            )
            Spacer(Modifier.height(16.dp))
            StatusValue(stringResource(R.string.pending_images), state.counts.imageCount.toString())
            Spacer(Modifier.height(8.dp))
            StatusValue(stringResource(R.string.pending_videos), state.counts.videoCount.toString())
            Spacer(Modifier.height(8.dp))
            StatusValue(stringResource(R.string.pending_total), state.counts.total.toString())

            state.error?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }

            Spacer(Modifier.height(20.dp))
            when (state.permission) {
                MediaPermissionAccess.NOT_REQUESTED -> Button(
                    onClick = onRequestMediaPermission,
                    enabled = !state.busy,
                ) { Text(stringResource(R.string.grant_access)) }
                MediaPermissionAccess.PARTIAL,
                MediaPermissionAccess.DENIED,
                -> OutlinedButton(
                    onClick = onOpenPermissionSettings,
                    enabled = !state.busy,
                ) { Text(stringResource(R.string.review_permissions)) }
                MediaPermissionAccess.FULL -> if (config?.enabled == true) {
                    Button(onClick = onScan, enabled = !state.busy) {
                        Text(
                            stringResource(
                                if (state.busy) R.string.scanning_camera else R.string.scan_again,
                            ),
                        )
                    }
                } else {
                    Button(onClick = onActivate, enabled = !state.busy && !state.loading) {
                        Text(
                            stringResource(
                                if (state.busy) R.string.activating_agent else R.string.activate_agent,
                            ),
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                text = stringResource(R.string.latest_pending_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.height(8.dp))
            if (state.latestPending.isEmpty()) {
                Text(
                    text = stringResource(R.string.no_new_media),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                state.latestPending.forEachIndexed { index, item ->
                    if (index > 0) HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                    PendingItemRow(item)
                }
            }
        }
    }
}

@Composable
private fun PendingItemRow(item: LocalMediaItem) {
    Column {
        Text(item.displayName.ifBlank { stringResource(R.string.unnamed_media) })
        Text(
            text = listOf(
                if (item.mediaType == LocalMediaItem.TYPE_VIDEO) {
                    stringResource(R.string.media_video)
                } else stringResource(R.string.media_image),
                formatMediaDate(item),
                formatSize(item.sizeBytes),
                stringResource(R.string.pending_status),
            ).joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun permissionLabel(permission: MediaPermissionAccess): String = when (permission) {
    MediaPermissionAccess.NOT_REQUESTED -> stringResource(R.string.permission_not_requested)
    MediaPermissionAccess.FULL -> stringResource(R.string.permission_full)
    MediaPermissionAccess.PARTIAL -> stringResource(R.string.permission_partial)
    MediaPermissionAccess.DENIED -> stringResource(R.string.permission_denied)
}

@Composable
private fun StatusValue(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.labelLarge)
    }
}

private fun formatMediaDate(item: LocalMediaItem): String =
    formatDate(item.dateTaken ?: item.dateAdded * 1_000)

private fun formatDate(value: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(value))

private fun formatSize(bytes: Long): String = when {
    bytes >= 1024L * 1024L * 1024L -> "%.1f GB".format(bytes / (1024.0 * 1024.0 * 1024.0))
    bytes >= 1024L * 1024L -> "%.1f MB".format(bytes / (1024.0 * 1024.0))
    bytes >= 1024L -> "%.1f KB".format(bytes / 1024.0)
    else -> "$bytes B"
}
