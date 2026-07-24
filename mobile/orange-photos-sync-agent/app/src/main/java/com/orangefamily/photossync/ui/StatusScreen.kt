package com.orangefamily.photossync.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.orangefamily.photossync.R
import com.orangefamily.photossync.auth.AuthUser

@Composable
fun StatusScreen(
    user: AuthUser,
    loggingOut: Boolean,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val family = user.families.firstOrNull()
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
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
                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = onLogout,
                    enabled = !loggingOut,
                ) {
                    Text(
                        stringResource(
                            if (loggingOut) R.string.logout_loading else R.string.logout_action,
                        ),
                    )
                }
            }
        }
    }
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
