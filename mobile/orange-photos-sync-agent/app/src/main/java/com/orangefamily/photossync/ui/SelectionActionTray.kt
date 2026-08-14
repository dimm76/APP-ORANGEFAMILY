package com.orangefamily.photossync.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class SelectionActionItem(
    val key: String,
    val label: String,
    val enabled: Boolean = true,
    val onClick: () -> Unit,
    val icon: @Composable () -> Unit,
)

@Composable
fun SelectionActionTray(
    actions: List<SelectionActionItem>,
    modifier: Modifier = Modifier,
    reopenKey: Any? = null,
) {
    var expanded by remember { mutableStateOf(true) }
    LaunchedEffect(reopenKey) {
        if (reopenKey != null) {
            expanded = true
        }
    }
    var accumulatedDrag by remember { mutableFloatStateOf(0f) }
    val dragThresholdPx = with(LocalDensity.current) { 32.dp.toPx() }

    fun finishDrag() {
        when {
            accumulatedDrag > dragThresholdPx -> expanded = false
            accumulatedDrag < -dragThresholdPx -> expanded = true
        }
        accumulatedDrag = 0f
    }

    Surface(
        modifier = modifier.fillMaxWidth().navigationBarsPadding().animateContentSize(),
        shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp),
        tonalElevation = 4.dp,
        shadowElevation = 8.dp,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(28.dp)
                    .pointerInput(expanded) {
                        detectVerticalDragGestures(
                            onDragStart = { accumulatedDrag = 0f },
                            onVerticalDrag = { change, dragAmount ->
                                change.consume()
                                accumulatedDrag += dragAmount
                            },
                            onDragEnd = { finishDrag() },
                            onDragCancel = { accumulatedDrag = 0f },
                        )
                    }
                    .clickable { expanded = !expanded },
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    modifier = Modifier.width(36.dp).height(4.dp),
                    shape = RoundedCornerShape(50),
                    color = MaterialTheme.colorScheme.outlineVariant,
                ) {}
            }
            if (expanded) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(start = 8.dp, end = 8.dp, bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(items = actions, key = { it.key }) { action ->
                        SelectionActionButton(action)
                    }
                }
            }
        }
    }
}

@Composable
private fun SelectionActionButton(action: SelectionActionItem) {
    Column(
        modifier = Modifier
            .width(84.dp)
            .alpha(if (action.enabled) 1f else 0.38f)
            .clickable(enabled = action.enabled, onClick = action.onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(modifier = Modifier.size(32.dp), contentAlignment = Alignment.Center) {
            action.icon()
        }
        Text(
            text = action.label,
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, lineHeight = 13.sp),
            color = LocalContentColor.current,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}
