package com.orangefamily.photossync.ui.cloud

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.orangefamily.photossync.R
import com.orangefamily.photossync.cloud.*
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

private data class CloudPhotoDay(val key: String, val label: String, val photos: List<CloudPhoto>)
private data class CloudPhotoPeriod(val key: String, val label: String, val days: List<CloudPhotoDay>)
private data class CloudJustifiedRow(val photos: List<CloudPhoto>, val height: Float)
private data class WeightedTimelinePeriod(val item: CloudTimelineMonth, val start: Float, val end: Float, val center: Float)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloudPhotosScreen(api: OrangePhotosCloudApi, thumbnailLoader: RemoteThumbnailLoader, librarySelector: @Composable () -> Unit, modifier: Modifier) {
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val listState = rememberLazyListState()
    var items by remember { mutableStateOf(emptyList<CloudPhoto>()) }
    var albums by remember { mutableStateOf(emptyList<CloudAlbum>()) }
    var selectedAlbum by remember { mutableStateOf<CloudAlbum?>(null) }
    var timeline by remember { mutableStateOf(emptyList<CloudTimelineYear>()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var viewerPhoto by remember { mutableStateOf<CloudPhoto?>(null) }
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var hasOlder by remember { mutableStateOf(false) }
    var olderCursor by remember { mutableStateOf<String?>(null) }
    var activePeriod by remember { mutableStateOf<String?>(null) }
    var timelineJumping by remember { mutableStateOf(false) }

    suspend fun reload() {
        loading = true; error = null
        runCatching { api.photos(albumId = selectedAlbum?.id) to api.timeline(selectedAlbum?.id) }
            .onSuccess { (photos, periods) -> items = photos.items; page = photos.page; hasMore = photos.hasMore; timeline = periods }
            .onFailure { error = it.message ?: "No se pudo cargar la biblioteca." }
        loading = false
    }
    LaunchedEffect(Unit) { albums = runCatching { api.albums() }.getOrDefault(emptyList()) }
    LaunchedEffect(api, selectedAlbum?.id) { reload() }

    val groups = groupCloudPhotos(items)
    LaunchedEffect(listState.firstVisibleItemIndex, groups) { activePeriod = groups.getOrNull(listState.firstVisibleItemIndex)?.key }
    suspend fun jumpToPeriod(period: CloudTimelineMonth) {
        if (period.cursor == null || timelineJumping) return
        timelineJumping = true
        try { val result = api.aroundDate(period.cursor, selectedAlbum?.id); items = result.items; hasOlder = result.hasOlder; olderCursor = result.olderCursor; activePeriod = period.key; listState.scrollToItem(0) } finally { timelineJumping = false }
    }

    ModalNavigationDrawer(drawerState = drawerState, drawerContent = {
        ModalDrawerSheet {
            Spacer(Modifier.height(20.dp))
            NavigationDrawerItem({ Text(stringResource(R.string.cloud_all_photos)) }, selectedAlbum == null, { selectedAlbum = null; scope.launch { drawerState.close() } })
            HorizontalDivider()
            Text(stringResource(R.string.cloud_albums), style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(16.dp))
            albums.forEach { album -> NavigationDrawerItem({ Column { Text(album.title); Text(stringResource(R.string.cloud_album_items, album.photoCount), style = MaterialTheme.typography.labelSmall) } }, selectedAlbum?.id == album.id, { selectedAlbum = album; scope.launch { drawerState.close() } }) }
        }
    }) {
        Scaffold(modifier = modifier, topBar = { TopAppBar(title = { librarySelector() }, navigationIcon = { IconButton({ scope.launch { drawerState.open() } }) { Text("☰", style = MaterialTheme.typography.titleLarge) } }) }) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                if (selectedAlbum != null) Text(selectedAlbum!!.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(12.dp))
                if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center))
                else if (error != null) Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) { Text(error!!); OutlinedButton({ scope.launch { reload() } }) { Text(stringResource(R.string.cloud_retry)) } }
                else BoxWithConstraints(Modifier.fillMaxSize().padding(top = if (selectedAlbum == null) 0.dp else 52.dp)) {
                    val rows = buildJustifiedRows(items, maxWidth.value - 28f)
                    LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(end = 28.dp), contentPadding = PaddingValues(2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        rows.forEach { row -> item { Row(Modifier.fillMaxWidth().height(row.height.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) { row.photos.forEach { photo -> Box(Modifier.width((cloudAspectRatio(photo) * row.height).dp).fillMaxHeight().clickable { viewerPhoto = photo }) { RemoteBitmap(photo.gridUrl, thumbnailLoader, ContentScale.Crop, Modifier.fillMaxSize()); if (photo.mediaType == "video") Text(stringResource(R.string.cloud_video), color = Color.White, modifier = Modifier.align(Alignment.BottomStart).background(Color.Black.copy(alpha = .6f))) } } } } }
                        if (hasMore) item { Button({ if (!loading) scope.launch { val result = api.photos(page + 1, albumId = selectedAlbum?.id); items = (items + result.items).distinctBy { it.id }; page = result.page; hasMore = result.hasMore } }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.cloud_load_more)) } }
                        if (hasOlder && olderCursor != null) item { LaunchedEffect(olderCursor) { val result = api.aroundDate(olderCursor!!, selectedAlbum?.id, "older"); items = (items + result.items).distinctBy { it.id }; hasOlder = result.hasOlder; olderCursor = result.olderCursor } }
                    }
                    if (timeline.isNotEmpty()) CloudTimeline(timeline, activePeriod) { scope.launch { jumpToPeriod(it) } }
                }
            }
        }
    }
    viewerPhoto?.let { photo -> Dialog({ viewerPhoto = null }) { Column(Modifier.fillMaxSize().background(Color.Black), horizontalAlignment = Alignment.CenterHorizontally) { RemoteBitmap(photo.viewerUrl ?: photo.gridUrl, thumbnailLoader, ContentScale.Fit, Modifier.weight(1f).fillMaxWidth()); if (photo.mediaType == "video") Text(stringResource(R.string.cloud_video_playback_pending), color = Color.White); Button({ viewerPhoto = null }) { Text(stringResource(R.string.cloud_close)) } } } }
}

private fun cloudAspectRatio(photo: CloudPhoto): Float = if ((photo.width ?: 0) > 0 && (photo.height ?: 0) > 0) ((photo.width!!.toFloat() / photo.height!!).coerceIn(.125f, 8f)) else if (photo.mediaType == "video") 16f / 9f else 1f
private fun buildJustifiedRows(photos: List<CloudPhoto>, availableWidth: Float): List<CloudJustifiedRow> {
    val target = 170f; val minimum = 140f; val gap = 2f; val result = mutableListOf<CloudJustifiedRow>(); var current = mutableListOf<CloudPhoto>()
    fun height(row: List<CloudPhoto>) = (availableWidth - gap * maxOf(0, row.size - 1)) / maxOf(row.sumOf { cloudAspectRatio(it).toDouble() }.toFloat(), .01f)
    fun push(row: List<CloudPhoto>) { if (row.isNotEmpty()) result += CloudJustifiedRow(row.toList(), height(row)) }
    photos.forEach { photo -> if (current.isEmpty()) { if (height(listOf(photo)) <= target) push(listOf(photo)) else current += photo } else { val candidate = current + photo; val h = height(candidate); if (h < minimum) { push(current); current = mutableListOf(photo); if (height(current) <= target) { push(current); current = mutableListOf() } } else { current += photo; if (current.size >= 3 || h <= target) { push(current); current = mutableListOf() } } } }; push(current); return result
}

private fun groupCloudPhotos(items: List<CloudPhoto>): List<CloudPhotoPeriod> = items.groupBy { photo -> photo.capturedAt?.let { runCatching { Instant.parse(it).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull() } }.entries.map { (date, photos) -> CloudPhotoPeriod(date?.toString()?.substring(0, 7) ?: "unknown", date?.format(monthFormatter) ?: "Sin fecha", listOf(CloudPhotoDay(date?.toString() ?: "unknown", date?.format(dayFormatter) ?: "Sin fecha", photos))) }
private val monthFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale("es", "ES"))
private val dayFormatter = DateTimeFormatter.ofPattern("EEE d MMM", Locale("es", "ES"))

@Composable private fun CloudTimeline(years: List<CloudTimelineYear>, activePeriod: String?, onSelected: (CloudTimelineMonth) -> Unit) { val periods = years.flatMap { it.months }; Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterEnd) { Column(Modifier.fillMaxHeight().width(28.dp).pointerInput(periods) { detectTapGestures { offset -> onSelected(periods[(offset.y / size.height * periods.size).toInt().coerceIn(periods.indices)]) } }.pointerInput(periods) { detectVerticalDragGestures { change, _ -> change.consume(); onSelected(periods[(change.position.y / size.height * periods.size).toInt().coerceIn(periods.indices)]) } }, horizontalAlignment = Alignment.CenterHorizontally) { periods.forEach { month -> Box(Modifier.size(if (month.key == activePeriod) 10.dp else 6.dp).background(if (month.key == activePeriod) MaterialTheme.colorScheme.primary else Color.Gray, MaterialTheme.shapes.small)) } } } }
@Composable private fun RemoteBitmap(url: String?, loader: RemoteThumbnailLoader, contentScale: ContentScale, modifier: Modifier = Modifier) { var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }; LaunchedEffect(url) { bitmap = url?.let { loader.load(it) } }; if (bitmap == null) Box(modifier.background(Color.LightGray)) else Image(bitmap!!.asImageBitmap(), null, modifier, contentScale = contentScale) }
