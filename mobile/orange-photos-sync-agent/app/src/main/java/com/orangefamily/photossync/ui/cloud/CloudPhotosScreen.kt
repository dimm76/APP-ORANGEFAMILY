package com.orangefamily.photossync.ui.cloud

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.launch
import com.orangefamily.photossync.R
import com.orangefamily.photossync.cloud.CloudPhoto
import com.orangefamily.photossync.cloud.OrangePhotosCloudApi
import com.orangefamily.photossync.cloud.RemoteThumbnailLoader

@Composable
fun CloudPhotosScreen(api: OrangePhotosCloudApi, thumbnailLoader: RemoteThumbnailLoader, modifier: Modifier) {
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf(emptyList<CloudPhoto>()) }
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var viewerPhoto by remember { mutableStateOf<CloudPhoto?>(null) }

    suspend fun loadPage(targetPage: Int, reset: Boolean) {
        if (reset) loading = true else loadingMore = true
        error = null
        runCatching { api.timeline(targetPage, PAGE_SIZE) }.onSuccess { result ->
            items = if (reset) result.items else (items + result.items).distinctBy { it.id }
            page = result.page
            hasMore = result.hasMore
        }.onFailure { error = it.message ?: "No se pudo cargar la biblioteca." }
        loading = false
        loadingMore = false
    }

    LaunchedEffect(api) { loadPage(1, true) }
    Column(modifier = modifier) {
        Text(stringResource(R.string.cloud_library), modifier = Modifier.padding(16.dp))
        error?.let {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(it)
                OutlinedButton(onClick = { scope.launch { loadPage(1, true) } }) { Text(stringResource(R.string.cloud_retry)) }
            }
        }
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            LazyVerticalGrid(GridCells.Fixed(3), contentPadding = PaddingValues(4.dp), modifier = Modifier.weight(1f)) {
                items(items, key = { it.id }) { photo ->
                    Box(Modifier.padding(2.dp).aspectRatio(1f).clickable { viewerPhoto = photo }) {
                        RemoteBitmap(photo.gridUrl, thumbnailLoader, ContentScale.Crop, Modifier.fillMaxSize())
                        if (photo.mediaType == "video") Text(stringResource(R.string.cloud_video), color = Color.White, modifier = Modifier.align(Alignment.BottomStart).background(Color.Black.copy(alpha = .6f)).padding(4.dp))
                    }
                }
            }
            if (hasMore) Button(onClick = { if (!loadingMore) scope.launch { loadPage(page + 1, false) } }, modifier = Modifier.fillMaxWidth().padding(8.dp)) { Text(stringResource(R.string.cloud_load_more)) }
        }
    }
    viewerPhoto?.let { photo ->
        Dialog(onDismissRequest = { viewerPhoto = null }) {
            Column(Modifier.fillMaxSize().background(Color.Black), horizontalAlignment = Alignment.CenterHorizontally) {
                RemoteBitmap(photo.viewerUrl ?: photo.gridUrl, thumbnailLoader, ContentScale.Fit, Modifier.weight(1f).fillMaxWidth())
                if (photo.mediaType == "video") Text(stringResource(R.string.cloud_video_playback_pending), color = Color.White)
                Button(onClick = { viewerPhoto = null }) { Text(stringResource(R.string.cloud_close)) }
            }
        }
    }
}

@Composable
private fun RemoteBitmap(url: String?, loader: RemoteThumbnailLoader, contentScale: ContentScale, modifier: Modifier = Modifier) {
    var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(url) { bitmap = url?.let { loader.load(it) } }
    if (bitmap == null) Box(modifier.background(Color.LightGray))
    else Image(bitmap!!.asImageBitmap(), contentDescription = null, modifier = modifier, contentScale = contentScale)
}

private const val PAGE_SIZE = 100
