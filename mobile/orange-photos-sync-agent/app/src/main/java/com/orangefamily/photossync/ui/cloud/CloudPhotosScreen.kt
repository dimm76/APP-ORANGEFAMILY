package com.orangefamily.photossync.ui.cloud

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import com.orangefamily.photossync.R
import com.orangefamily.photossync.cloud.*
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.device.DeviceMediaStoreScanner
import com.orangefamily.photossync.ui.theme.OrangePrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.orangefamily.photossync.ui.theme.OrangeBorder
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.yield
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.distinctUntilChanged
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

@OptIn(ExperimentalMaterial3Api::class,ExperimentalFoundationApi::class)
@Composable
fun CloudPhotosScreen(api: OrangePhotosCloudApi, thumbnailLoader: RemoteThumbnailLoader, accountUserId:String, repository:CameraBackupRepository, deviceScanner:DeviceMediaStoreScanner, mediaRefreshVersion:Int, librarySelector: @Composable () -> Unit, onOpen: (CloudPhoto) -> Unit, modifier: Modifier) {
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
    var page by remember { mutableStateOf(1) }
    var hasMore by remember { mutableStateOf(false) }
    var hasNewer by remember { mutableStateOf(false) }
    var newerCursor by remember { mutableStateOf<String?>(null) }
    var hasOlder by remember { mutableStateOf(false) }
    var olderCursor by remember { mutableStateOf<String?>(null) }
    var activePeriod by remember { mutableStateOf<String?>(null) }
    var timelineRequestGeneration by remember { mutableIntStateOf(0) }
    var loadingWindowNewer by remember { mutableStateOf(false) }
    var pagingMode by remember { mutableStateOf(CloudPagingMode.NORMAL) }
    var timelineThumbVisible by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(emptySet<String>()) }
    var selectedDays by remember { mutableStateOf(emptySet<String>()) }
    var selectionAnchor by remember { mutableStateOf<String?>(null) }
    var localByRemoteId by remember { mutableStateOf<Map<String,LocalMediaItem>>(emptyMap()) }

    fun clearSelection(){selected=emptySet();selectedDays=emptySet();selectionAnchor=null}
    fun toggleSelection(photo:CloudPhoto){val next=selected.toMutableSet();if(!next.add(photo.id))next.remove(photo.id);selected=next;selectionAnchor=photo.id}
    fun extendSelection(photo:CloudPhoto){val anchor=selectionAnchor;if(anchor==null||selected.isEmpty()){selected=selected+photo.id;selectionAnchor=photo.id;return};val start=items.indexOfFirst{it.id==anchor};val end=items.indexOfFirst{it.id==photo.id};if(start<0||end<0){selected=selected+photo.id;selectionAnchor=photo.id;return};selected=selected+items.subList(minOf(start,end),maxOf(start,end)+1).map{it.id};selectionAnchor=photo.id}
    fun handlePhotoClick(photo:CloudPhoto){if(selected.isEmpty())onOpen(photo)else toggleSelection(photo)}
    fun toggleDay(day:CloudPhotoDay){val ids=day.photos.map{it.id}.toSet();val all=ids.isNotEmpty()&&ids.all{it in selected};selected=selected.toMutableSet().apply{if(all)removeAll(ids)else addAll(ids)};selectedDays=selectedDays.toMutableSet().apply{if(all)remove(day.key)else add(day.key)};if(!all)selectionAnchor=day.photos.lastOrNull()?.id}

    fun activeAlbumId(): String? = if (cloudView == CloudView.ALBUM_DETAIL) selectedAlbum?.id else null
    suspend fun reload() {
        if (cloudView == CloudView.ALBUMS) { loading = false; return }
        loading = true; error = null
        runCatching { api.photos(albumId = activeAlbumId()) to api.timeline(activeAlbumId()) }
            .onSuccess { (photos, periods) -> items = photos.items; page = photos.page; hasMore = photos.hasMore; hasNewer = false; newerCursor = null; hasOlder = false; olderCursor = null; pagingMode = CloudPagingMode.NORMAL; timeline = periods }
            .onFailure { error = it.message ?: "No se pudo cargar la biblioteca." }
        loading = false
    }
    LaunchedEffect(Unit) { albums = runCatching { api.albums() }.getOrDefault(emptyList()) }
    LaunchedEffect(api, cloudView, selectedAlbum?.id) { reload() }
    LaunchedEffect(cloudView, selectedAlbum?.id){clearSelection()}
    LaunchedEffect(items,mediaRefreshVersion){val ids=items.map{it.id}.distinct();localByRemoteId=if(ids.isEmpty())emptyMap()else withContext(Dispatchers.IO){repository.remoteLinkedItems(accountUserId,ids)}.mapNotNull{item->item.remotePhotoId?.trim()?.takeIf{it.isNotBlank()}?.let{it to item}}.filter{deviceScanner.exists(it.second)}.toMap()}
    LaunchedEffect(listState.isScrollInProgress) { if (listState.isScrollInProgress) timelineThumbVisible = true else { delay(1500); timelineThumbVisible = false } }

    val groups = groupCloudPhotos(items)
    LaunchedEffect(listState.firstVisibleItemIndex, groups) { activePeriod = groups.getOrNull(listState.firstVisibleItemIndex)?.key }
    suspend fun jumpToPeriod(period: CloudTimelineMonth) {
        val cursor = period.cursor ?: return
        val generation = timelineRequestGeneration + 1
        timelineRequestGeneration = generation
        val result = api.aroundDate(cursor, activeAlbumId())
        if (generation != timelineRequestGeneration) return
        items = result.items; page = 1; pagingMode = CloudPagingMode.WINDOW; hasMore = false; hasNewer = result.hasNewer; newerCursor = result.newerCursor; hasOlder = result.hasOlder; olderCursor = result.olderCursor; activePeriod = period.key; listState.scrollToItem(0)
    }

    suspend fun loadWindowNewer() {
        if (pagingMode != CloudPagingMode.WINDOW || !hasNewer || loadingWindowNewer) return
        val cursor = newerCursor ?: return
        loadingWindowNewer = true
        val anchorIndex = listState.firstVisibleItemIndex
        val anchorKey = groups.getOrNull(anchorIndex)?.key
        val anchorOffset = listState.firstVisibleItemScrollOffset
        try { val result = api.aroundDate(cursor, activeAlbumId(), "newer"); if (result.items.isEmpty()) { hasNewer = false; return }; val merged = (result.items + items).distinctBy { it.id }; val mergedGroups = groupCloudPhotos(merged); items = merged; hasNewer = result.hasNewer; newerCursor = result.newerCursor; yield(); if (anchorKey != null) mergedGroups.indexOfFirst { it.key == anchorKey }.takeIf { it >= 0 }?.let { listState.scrollToItem(it, anchorOffset) } } finally { loadingWindowNewer = false }
    }

    suspend fun loadWindowOlder() {
        if (pagingMode != CloudPagingMode.WINDOW || !hasOlder) return
        val cursor = olderCursor ?: return
        val result = api.aroundDate(cursor, activeAlbumId(), "older")
        items = (items + result.items).distinctBy { it.id }
        hasOlder = result.hasOlder
        olderCursor = result.olderCursor
    }
    LaunchedEffect(listState, pagingMode, hasNewer, newerCursor) { snapshotFlow { Triple(listState.firstVisibleItemIndex, listState.firstVisibleItemScrollOffset, listState.isScrollInProgress) }.distinctUntilChanged().collect { (index, offset, scrolling) -> if (scrolling && pagingMode == CloudPagingMode.WINDOW && hasNewer && index == 0 && offset < 300) loadWindowNewer() } }

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
                    val availableWidth = maxWidth.value
                    val groups = groupCloudPhotos(items)
                    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 2.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        groups.forEachIndexed { periodIndex, period ->
                            item(key = "period:${period.key}") {
                                Column(Modifier.fillMaxWidth()) {
                                    Text(period.label, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = if (periodIndex == 0) 10.dp else 20.dp, bottom = 6.dp))
                                    period.days.forEach { day ->
                                        Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=7.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){val ids=day.photos.map{it.id};val all=ids.isNotEmpty()&&ids.all{it in selected};Box(Modifier.size(24.dp).background(if(all)OrangePrimary else Color.Transparent,CircleShape).border(2.dp,if(all)OrangePrimary else MaterialTheme.colorScheme.outline,CircleShape).clickable{toggleDay(day)},contentAlignment=Alignment.Center){if(ids.any{it in selected})Text("✓",color=if(all)Color.White else OrangePrimary,fontWeight=FontWeight.Bold)};Text(day.label,style=MaterialTheme.typography.titleSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}
                                        buildJustifiedRows(day.photos, availableWidth).forEach { row ->
                                            Row(Modifier.fillMaxWidth().height(row.height.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                                row.photos.forEach { photo ->
                                                    val photoSelected=photo.id in selected
                                                    Box(Modifier.width((cloudAspectRatio(photo) * row.height).dp).fillMaxHeight().background(if(photoSelected)OrangePrimary.copy(alpha=.18f) else Color.Transparent).padding(if(photoSelected)5.dp else 0.dp).clip(if(photoSelected)RoundedCornerShape(10.dp) else RoundedCornerShape(0.dp)).combinedClickable(onClick={handlePhotoClick(photo)},onLongClick={extendSelection(photo)})) {
                                                        RemoteBitmap(photo.gridUrl, thumbnailLoader, ContentScale.Crop, Modifier.fillMaxSize())
                                                        if (photo.mediaType == "video") Text(stringResource(R.string.cloud_video), color = Color.White, modifier = Modifier.align(Alignment.BottomStart).background(Color.Black.copy(alpha = .6f)).padding(4.dp))
                                                        if(selected.isNotEmpty()||photoSelected)Box(Modifier.align(Alignment.TopStart).padding(6.dp).size(24.dp).background(if(photoSelected)OrangePrimary else Color.Transparent,CircleShape).border(2.dp,if(photoSelected)OrangePrimary else Color.White,CircleShape),contentAlignment=Alignment.Center){if(photoSelected)Text("✓",color=Color.White,fontWeight=FontWeight.Bold)}
                                                        if(photo.isSharedEffectively)CloudSharedBadge(photo.isOwner,Modifier.align(Alignment.TopEnd).padding(6.dp))
                                                        if(localByRemoteId.containsKey(photo.id))CloudLocalCopyBadge(Modifier.align(Alignment.BottomEnd).padding(6.dp))
                                                    }
                                                }
                                            }
                                            Spacer(Modifier.height(2.dp))
                                        }
                                    }
                                }
                            }
                        }
                        if (pagingMode == CloudPagingMode.NORMAL && hasMore) item { Button({ if (!loading) scope.launch { val result = api.photos(page + 1, albumId = activeAlbumId()); items = (items + result.items).distinctBy { it.id }; page = result.page; hasMore = result.hasMore } }, Modifier.fillMaxWidth()) { Text(stringResource(R.string.cloud_load_more)) } }
                        if (pagingMode == CloudPagingMode.WINDOW && hasOlder && olderCursor != null) item(key = "window-load-older") { LaunchedEffect(olderCursor) { loadWindowOlder() } }
                    }
                    if (timeline.isNotEmpty()) Box(Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(68.dp)) { CloudTimeline(timeline, activePeriod, timelineThumbVisible) { scope.launch { jumpToPeriod(it) } } }
                }
                }
            }
        }
    }
}

private fun cloudAspectRatio(photo: CloudPhoto): Float = if ((photo.width ?: 0) > 0 && (photo.height ?: 0) > 0) ((photo.width!!.toFloat() / photo.height!!).coerceIn(.125f, 8f)) else if (photo.mediaType == "video") 16f / 9f else 1f
private fun buildJustifiedRows(photos: List<CloudPhoto>, availableWidth: Float): List<CloudJustifiedRow> {
    val target = 170f; val minimum = 140f; val gap = 2f; val result = mutableListOf<CloudJustifiedRow>(); var current = mutableListOf<CloudPhoto>()
    fun height(row: List<CloudPhoto>) = (availableWidth - gap * maxOf(0, row.size - 1)) / maxOf(row.sumOf { cloudAspectRatio(it).toDouble() }.toFloat(), .01f)
    fun push(row: List<CloudPhoto>) { if (row.isNotEmpty()) result += CloudJustifiedRow(row.toList(), height(row)) }
    photos.forEach { photo -> if (current.isEmpty()) { if (height(listOf(photo)) <= target) push(listOf(photo)) else current += photo } else { val candidate = current + photo; val h = height(candidate); if (h < minimum) { push(current); current = mutableListOf(photo); if (height(current) <= target) { push(current); current = mutableListOf() } } else { current += photo; if (current.size >= 3 || h <= target) { push(current); current = mutableListOf() } } } }; push(current); return result
}

private fun groupCloudPhotos(items: List<CloudPhoto>): List<CloudPhotoPeriod> {
    data class ParsedPhoto(val photo: CloudPhoto, val date: java.time.LocalDate?)
    val parsed = items.map { photo -> ParsedPhoto(photo, photo.capturedAt?.let { value -> runCatching { Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate() }.getOrNull() }) }
    val monthGroups = parsed.groupBy { item -> item.date?.let { "%04d-%02d".format(it.year, it.monthValue) } ?: "unknown" }
    return monthGroups.entries.sortedWith { first, second -> when { first.key == "unknown" -> 1; second.key == "unknown" -> -1; else -> second.key.compareTo(first.key) } }.map { (periodKey, periodItems) ->
        val periodDate = periodItems.firstNotNullOfOrNull { it.date }
        val dayGroups = periodItems.groupBy { it.date?.toString() ?: "unknown" }.entries.sortedWith { first, second -> when { first.key == "unknown" -> 1; second.key == "unknown" -> -1; else -> second.key.compareTo(first.key) } }
        CloudPhotoPeriod(periodKey, periodDate?.format(monthFormatter)?.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() } ?: "Sin fecha", dayGroups.map { (dayKey, dayItems) ->
            val date = dayItems.firstNotNullOfOrNull { it.date }
            CloudPhotoDay(dayKey, date?.format(dayFormatter)?.replace(".", "")?.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() } ?: "Fecha desconocida", dayItems.map { it.photo })
        })
    }
}
private val spanishLocale = Locale.forLanguageTag("es-ES")
private val monthFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", spanishLocale)
private val dayFormatter = DateTimeFormatter.ofPattern("EEE d MMM", spanishLocale)

private fun weightedTimeline(years: List<CloudTimelineYear>): List<WeightedTimelinePeriod> { val periods = years.flatMap { it.months }; val total = periods.sumOf { maxOf(1, it.count) }.toFloat(); var accumulated = 0f; return periods.map { item -> val start = accumulated / total; accumulated += maxOf(1, item.count); val end = accumulated / total; WeightedTimelinePeriod(item, start, end, (start + end) / 2f) } }
private data class WeightedTimelineYear(val year: Int, val start: Float, val end: Float, val center: Float, val count: Int)
private fun weightedTimelineYears(periods: List<WeightedTimelinePeriod>): List<WeightedTimelineYear> {
    val result = mutableListOf<WeightedTimelineYear>()
    periods.forEach { period ->
        val index = result.indexOfFirst { it.year == period.item.year }
        val weight = maxOf(1, period.item.count)
        if (index >= 0) { val existing = result[index]; val start = minOf(existing.start, period.start); val end = maxOf(existing.end, period.end); result[index] = existing.copy(start = start, end = end, center = (start + end) / 2f, count = existing.count + weight) }
        else result += WeightedTimelineYear(period.item.year, period.start, period.end, (period.start + period.end) / 2f, weight)
    }
    return result
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
    val timelineYears = remember(periods) { weightedTimelineYears(periods) }
    val active = periods.firstOrNull { it.item.key == activePeriod }
    var dragging by remember { mutableStateOf(false) }
    var scrubRequestVersion by remember { mutableIntStateOf(0) }
    var scrubProgress by remember { mutableStateOf(active?.center ?: periods.first().center) }
    var previewPeriod by remember { mutableStateOf(active ?: periods.first()) }
    LaunchedEffect(activePeriod, periods, dragging) {
        if (!dragging) periods.firstOrNull { it.item.key == activePeriod }?.let { scrubProgress = it.center; previewPeriod = it }
    }
    LaunchedEffect(scrubRequestVersion) {
        if (scrubRequestVersion <= 0) return@LaunchedEffect
        delay(140)
        if (dragging) onSelected(previewPeriod.item)
    }
    BoxWithConstraints(Modifier.fillMaxHeight().width(68.dp)) {
        val trackHeight = maxHeight - 20.dp
        fun update(y: Float) {
            val progress = (y / constraints.maxHeight.toFloat()).coerceIn(0f, 1f)
            periods.minByOrNull { abs(it.center - progress) }?.let { scrubProgress = progress; previewPeriod = it }
        }
        Box(Modifier.fillMaxSize().pointerInput(periods) { detectTapGestures { update(it.y); onSelected(previewPeriod.item) } }.pointerInput(periods) {
            detectVerticalDragGestures(onDragStart = { dragging = true; update(it.y); onSelected(previewPeriod.item) }, onVerticalDrag = { change, _ -> change.consume(); update(change.position.y); scrubRequestVersion += 1 }, onDragEnd = { val selected = previewPeriod.item; onSelected(selected); dragging = false }, onDragCancel = { dragging = false })
        }) {
            if (dragging) {
            Box(Modifier.align(Alignment.CenterEnd).padding(end = 14.dp).width(1.dp).fillMaxHeight().padding(vertical = 10.dp).background(MaterialTheme.colorScheme.outlineVariant))
            periods.forEach { period -> val activeDot = period.item.key == activePeriod; Box(Modifier.align(Alignment.TopEnd).padding(end = if (activeDot) 11.dp else 12.dp).offset(y = trackHeight * period.center + 10.dp - if (activeDot) 3.dp else 2.dp).size(if (activeDot) 6.dp else 4.dp).background(if (activeDot) MaterialTheme.colorScheme.primary else Color(0x7A475569), CircleShape)) }
            timelineYears.forEach { yearItem ->
                val activeYear = activePeriod?.startsWith("${yearItem.year}-") == true
                Text(yearItem.year.toString(), fontSize = 11.sp, lineHeight = 12.sp, style = MaterialTheme.typography.labelMedium, fontWeight = if (activeYear) FontWeight.Bold else FontWeight.SemiBold, color = if (activeYear) MaterialTheme.colorScheme.primary else Color(0xFF334155), modifier = Modifier.align(Alignment.TopEnd).padding(end = 30.dp).offset(y = trackHeight * yearItem.center + 10.dp - 7.dp).background(Color.White.copy(alpha = .96f), RoundedCornerShape(9.dp)).border(1.dp, Color(0xFFDCE3F5), RoundedCornerShape(9.dp)).padding(horizontal = 4.dp, vertical = 1.dp))
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
