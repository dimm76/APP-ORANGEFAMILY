package com.orangefamily.photossync.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val OrangeFamilyColorScheme = lightColorScheme(
    primary = OrangePrimary,
    onPrimary = OrangeSurface,
    primaryContainer = OrangePrimaryContainer,
    onPrimaryContainer = OrangeOnPrimaryContainer,
    background = OrangeBackground,
    onBackground = OrangeText,
    surface = OrangeSurface,
    onSurface = OrangeText,
    onSurfaceVariant = OrangeTextMuted,
    outline = OrangeBorder,
    error = OrangeError,
)

@Composable
fun OrangeFamilyPhotosSyncTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = OrangeFamilyColorScheme,
        typography = Typography,
        content = content,
    )
}
