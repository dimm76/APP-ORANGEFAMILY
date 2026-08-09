package com.orangefamily.photossync.ui.cloud

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.window.Dialog
import com.orangefamily.photossync.R
import com.orangefamily.photossync.cloud.*
import com.orangefamily.photossync.ui.theme.OrangeBorder
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
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
private enum class CloudView { LIBRARY, ALBUMS, ALBUM_DETAIL }
private enum class CloudPagingMode { NORMAL, WINDOW }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloudPhotosScreen(api: OrangePhotosCloudApi, thumbnailLoader: RemoteThumbnailLoader, librarySelector: @Composable () -> Unit, modifier: Modifier) {
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val listState = rememberLazyListState()
    var items by remember { mutableStateOf(emptyList<CloudPhoto>()) }
    var albums by remember { mutableStateOf(emptyList<CloudAlbum>()) }
    var cloudView by remember { mutableStateOf(CloudView.LIBRARY) }
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
    var pagingMode by remember { mutableStateOf(CloudPagingMode.NORMAL) }
    var timelineThumbVisible by remember { mutableStateOf(false) }

    fun activeAlbumId(): String? = if (cloudView == CloudView.ALBUM_DETAIL) selectedAlbum?.id else null
    suspend fun reload() {
        if (cloudView == CloudView.ALBUMS) { loading = false; return }
        loading = true; error = null
        runCatching { api.photos(albumId = activeAlbumId()) to api.timeline(activeAlbumId()) }
            .onSuccess { (photos, periods) -> items = photos.items; page = photos.page; hasMore = photos.hasMore; hasOlder = false; olderCursor = null; pagingMode = CloudPagingMode.NORMAL; timeline = periods }
            .onFailure { error = it.message ?: "No se pudo cargar la biblioteca." }
        loading = false
    }
    LaunchedEffect(Unit) { albums = runCatching { api.albums() }.getOrDefault(emptyList()) }
    LaunchedEffect(api, cloudView, selectedAlbum?.id) { reload() }
    LaunchedEffect(listState.isScrollInProgress) { if (listState.isScrollInProgress) timelineThumbVisible = true else { delay(1500); timelineThumbVisible = false } }

    val groups = groupCloudPhotos(items)
    LaunchedEffect(listState.firstVisibleItemIndex, groups) { activePeriod = groups.getOrNull(listState.firstVisibleItemIndex)?.key }
    suspend fun jumpToPeriod(period: CloudTimelineMonth) {
        if (period.cursor == null || timelineJumping) return
        timelineJumping = true
        try { val result = api.aroundDate(period.cursor, activeAlbumId()); items = result.items; page = 1; hasMore = false; pagingMode = CloudPagingMode.WINDOW; hasOlder = result.hasOlder; olderCursor = result.olderCursor; activePeriod = period.key; listState.scrollToItem(0) } finally { timelineJumping = false }
    }

    ModalNavigationDrawer(drawerState = drawerState, drawerContent = {
        ModalDrawerSheet {
            Spacer(Modifier.height(20.dp))
            NavigationDrawerItem({ Text(stringResource(R.string.cloud_all_photos)) }, cloudView == CloudView.LIBRARY, { selectedAlbum = null; cloudView = CloudView.LIBRARY; scope.launch { drawerState.close() } })
            NavigationDrawerItem({ Text(stringResource(R.string.cloud_albums)) }, cloudView == CloudView.ALBUMS, { selectedAlbum = null; cloudView = CloudView.ALBUMS; scope.launch { drawerState.close() } })
            HorizontalDivider()
        }
    }) {
        Scaffold(modifier = modifier, containerColor = OrangeBorder, topBar = { TopAppBar(title = { librarySelector() }, navigationIcon = { IconButton({ scope.launch { drawerState.open() } }) { Text("☰", style = MaterialTheme.typography.titleLarge) } }) }) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                if (cloudView == CloudView.ALBUMS) {
                    CloudAlbumsView(albums, thumbnailLoader) { selectedAlbum = it; cloudView = CloudView.ALBUM_DETAIL }
                } else {
                if (selectedAlbum != null) Text(selectedAlbum!!.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(12.dp))
                if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center))
                else if (error != null) Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) { Text(error!!); OutlinedButton({ scope.launch { reload() } }) { Text(stringResource(R.string.cloud_retry)) } }
                else BoxWithConstraints(Modifier.fillMaxSize().padding(top = if (selectedAlbum == null) 0.dp else 52.dp)) {
                    val rows = buildJustifiedRows(items, maxWidth.value - 28f)
                    LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(end = 28.dp), contentPadding = PaddingValues(2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        rows.forEach { row -> item { Row(Modifier.fillMaxWidth().height(row.height.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) { row.photos.forEach { photo -> Box(Modifier.width((cloudAspectRatio(photo) * row.height).dp).fillMaxHeight().clickable { viewerPhoto = photo }) { RemoteBitmap(photo.gridUrl, thumbnailLoader, ContentScale.Crop, Modifier.fillMaxSize()); if (photo.mediaType == "video") Text(stringResource(R.string.cloud_video), color = Color.White, modifier = Modifier.align(Alignment.BottomStart).background(Color.Black.copy(alpha = .6f))) } } } } }
                        if (pagingMode == CloudPagingMode.NORMAL && hasMore) item { Button({ if (!loading) scope.launch { val result = api.photos(page + 1, albumId = activeAlbumId()); items = (items + result.items).distinctBy { it.id }; page = result.page; hasMore = result.hasMore } }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.cloud_load_more)) } }
                        if (pagingMode == CloudPagingMode.WINDOW && hasOlder && olderCursor != null) item { LaunchedEffect(olderCursor) { val cursor = olderCursor ?: return@LaunchedEffect; val result = api.aroundDate(cursor, activeAlbumId(), "older"); items = (items + result.items).distinctBy { it.id }; hasOlder = result.hasOlder; olderCursor = result.olderCursor } }
                    }
                    if (timeline.isNotEmpty()) Box(Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(68.dp)) { CloudTimeline(timeline, activePeriod, timelineThumbVisible) { scope.launch { jumpToPeriod(it) } } }
                }
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

private fun weightedTimeline(years: List<CloudTimelineYear>): List<WeightedTimelinePeriod> { val periods = years.flatMap { it.months }; val total = periods.sumOf { maxOf(1, it.count) }.toFloat(); var accumulated = 0f; return periods.map { item -> val start = accumulated / total; accumulated += maxOf(1, item.count); val end = accumulated / total; WeightedTimelinePeriod(item, start, end, (start + end) / 2f) } }
private fun fittedYearPositions(periods: List<WeightedTimelinePeriod>): List<Pair<Int, Float>> {
    val weighted = periods.groupBy { it.item.year }.map { (year, entries) -> year to ((entries.first().start + entries.last().end) / 2f) }
    if (weighted.size <= 1) return weighted
    val minimumGap = .90f / (weighted.size - 1)
    if (!weighted.zipWithNext().any { it.second.second - it.first.second < minimumGap * .72f }) return weighted
    return weighted.mapIndexed { index, item -> item.first to (.05f + .90f * index / (weighted.size - 1)) }
}
private fun timelineMonthLabel(item: CloudTimelineMonth): String {
    val date = java.time.LocalDate.of(item.year, item.month, 1)
    return date.format(DateTimeFormatter.ofPattern("MMM yyyy", Locale("es", "ES")))
        .replace(".", "").replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}

@Composable
private fun CloudTimeline(years: List<CloudTimelineYear>, activePeriod: String?, thumbVisible: Boolean, onSelected: (CloudTimelineMonth) -> Unit) {
    val periods = remember(years) { weightedTimeline(years) }
    if (periods.isEmpty()) return
    val yearPositions = remember(periods) { fittedYearPositions(periods) }
    val active = periods.firstOrNull { it.item.key == activePeriod }
    var dragging by remember { mutableStateOf(false) }
    var scrubProgress by remember { mutableStateOf(active?.center ?: periods.first().center) }
    var previewPeriod by remember { mutableStateOf(active ?: periods.first()) }
    LaunchedEffect(activePeriod, periods, dragging) {
        if (!dragging) periods.firstOrNull { it.item.key == activePeriod }?.let { scrubProgress = it.center; previewPeriod = it }
    }
    LaunchedEffect(dragging, previewPeriod.item.key) {
        if (dragging) { delay(140); onSelected(previewPeriod.item) }
    }
    BoxWithConstraints(Modifier.fillMaxHeight().width(68.dp)) {
        val trackHeight = maxHeight - 20.dp
        fun update(y: Float) {
            val progress = (y / constraints.maxHeight.toFloat()).coerceIn(0f, 1f)
            periods.minByOrNull { abs(it.center - progress) }?.let { scrubProgress = progress; previewPeriod = it }
        }
        Box(Modifier.fillMaxSize().pointerInput(periods) { detectTapGestures { update(it.y); onSelected(previewPeriod.item) } }.pointerInput(periods) {
            detectVerticalDragGestures(onDragStart = { dragging = true; update(it.y) }, onVerticalDrag = { change, _ -> change.consume(); update(change.position.y) }, onDragEnd = { onSelected(previewPeriod.item); dragging = false }, onDragCancel = { dragging = false })
        }) {
            if (dragging) {
            Box(Modifier.align(Alignment.CenterEnd).padding(end = 14.dp).width(1.dp).fillMaxHeight().padding(vertical = 10.dp).background(MaterialTheme.colorScheme.outlineVariant))
            periods.forEach { period -> val activeDot = period.item.key == activePeriod; Box(Modifier.align(Alignment.TopEnd).padding(end = if (activeDot) 11.dp else 12.dp).offset(y = trackHeight * period.center + 10.dp - if (activeDot) 3.dp else 2.dp).size(if (activeDot) 6.dp else 4.dp).background(if (activeDot) MaterialTheme.colorScheme.primary else Color(0x7A475569), CircleShape)) }
            yearPositions.forEach { (year, progress) ->
                val activeYear = activePeriod?.startsWith("$year-") == true
                Text(year.toString(), fontSize = 10.sp, lineHeight = 11.sp, style = MaterialTheme.typography.labelMedium, fontWeight = if (activeYear) FontWeight.Bold else FontWeight.SemiBold, color = if (activeYear) MaterialTheme.colorScheme.primary else Color(0xFF334155), modifier = Modifier.align(Alignment.TopEnd).padding(end = 30.dp).offset(y = trackHeight * progress + 10.dp - 7.dp).background(Color.White.copy(alpha = .96f), RoundedCornerShape(9.dp)).border(1.dp, Color(0xFFDCE3F5), RoundedCornerShape(9.dp)).padding(horizontal = 4.dp, vertical = 1.dp))
            }
            }
            if (thumbVisible || dragging) Box(Modifier.align(Alignment.TopEnd).offset(y = trackHeight * scrubProgress + 10.dp - 32.dp).size(width = 44.dp, height = 64.dp).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(topStart = 22.dp, bottomStart = 22.dp, topEnd = 0.dp, bottomEnd = 0.dp)).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(topStart = 22.dp, bottomStart = 22.dp, topEnd = 0.dp, bottomEnd = 0.dp)), contentAlignment = Alignment.CenterStart) { Column(Modifier.padding(start = 13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { repeat(3) { Box(Modifier.width(12.dp).height(2.dp).background(Color(0xFF64748B))) } } }
            if (dragging) Text(timelineMonthLabel(previewPeriod.item), style = MaterialTheme.typography.titleSmall, modifier = Modifier.align(Alignment.TopEnd).offset(x = (-52).dp, y = trackHeight * scrubProgress + 10.dp - 22.dp).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(22.dp)).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(22.dp)).padding(horizontal = 13.dp, vertical = 10.dp))
        }
    }
}

@Composable private fun CloudAlbumsView(albums: List<CloudAlbum>, thumbnailLoader: RemoteThumbnailLoader, onOpen: (CloudAlbum) -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Text(stringResource(R.string.cloud_albums), style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(16.dp))
        if (albums.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(stringResource(R.string.cloud_no_albums)) }
        else LazyVerticalGrid(GridCells.Fixed(2), Modifier.fillMaxSize(), contentPadding = PaddingValues(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { items(albums, key = { it.id }) { album ->
            Column(Modifier.clickable { onOpen(album) }) {
                Box(Modifier.fillMaxWidth().aspectRatio(1.35f).background(Color.LightGray)) { RemoteBitmap(album.coverThumbnailUrl, thumbnailLoader, ContentScale.Crop, Modifier.fillMaxSize()) }
                Text(album.title, style = MaterialTheme.typography.titleMedium)
                Text(stringResource(R.string.cloud_album_items, album.photoCount), style = MaterialTheme.typography.labelSmall)
                album.sharedByDisplayName?.let { Text("Compartido por $it", style = MaterialTheme.typography.labelSmall) }
                album.dateStart?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
            }
        } }
    }
}
@Composable private fun RemoteBitmap(url: String?, loader: RemoteThumbnailLoader, contentScale: ContentScale, modifier: Modifier = Modifier) { var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }; LaunchedEffect(url) { bitmap = url?.let { loader.load(it) } }; if (bitmap == null) Box(modifier.background(Color.LightGray)) else Image(bitmap!!.asImageBitmap(), null, modifier, contentScale = contentScale) }
