package com.orangefamily.photossync.ui.cloud

import androidx.compose.foundation.Image
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import com.orangefamily.photossync.R
import com.orangefamily.photossync.cloud.*
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.device.DeviceMediaStoreScanner
import com.orangefamily.photossync.ui.theme.OrangePrimary
import com.orangefamily.photossync.ui.SelectionActionItem
import com.orangefamily.photossync.ui.SelectionActionTray
import com.orangefamily.photossync.ui.device.OrangeDeleteIcon
import com.orangefamily.photossync.ui.device.OrangeFilledCloudIcon
import com.orangefamily.photossync.ui.device.OrangeCloudShapeIcon
import com.orangefamily.photossync.ui.device.OrangeShareIcon
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.orangefamily.photossync.ui.theme.OrangeBorder
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import java.time.Instant
import java.time.ZoneId
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

private data class CloudPhotoDay(val key: String, val label: String, val photos: List<CloudPhoto>)
private data class CloudPhotoPeriod(val key: String, val label: String, val days: List<CloudPhotoDay>)
private data class CloudJustifiedRow(val photos: List<CloudPhoto>, val height: Float)
private data class CloudWindowScrollProbe(val index: Int, val offset: Int, val dragged: Boolean, val scrollingBackward: Boolean)
private data class WeightedTimelinePeriod(val item: CloudTimelineMonth, val start: Float, val end: Float, val center: Float)
private enum class CloudView { LIBRARY, ALBUMS, ALBUM_DETAIL, TRASH, SHARED_WITH_ME }
private enum class CloudPagingMode { NORMAL, WINDOW }
private fun cloudPeriodKeyFromLazyItemKey(key: Any?): String? { val value=key as? String ?: return null; val payload=when { value.startsWith("period:")->value.removePrefix("period:");value.startsWith("day:")->value.removePrefix("day:");value.startsWith("row:")->value.removePrefix("row:");else->return null };val periodKey=payload.substringBefore(":");return periodKey.takeIf{it.length==7&&it.getOrNull(4)=='-'} }
private const val MAX_CLOUD_BULK_SELECTION=500
private fun cloudActionIcon(name: String, draw: PathBuilder.() -> Unit): ImageVector = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply { path(fill = SolidColor(Color.Transparent), stroke = SolidColor(Color.Black), strokeLineWidth = 2f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round) { draw() } }.build()
private val CloudAlbumActionIcon = cloudActionIcon("CloudAlbum") { moveTo(3f, 6f); horizontalLineTo(10f); lineTo(12f, 8f); horizontalLineTo(21f); verticalLineTo(19f); horizontalLineTo(3f); close() }
private val CloudDownloadActionIcon = cloudActionIcon("CloudDownload") { moveTo(12f, 3f); verticalLineTo(15f); moveTo(7f, 10f); lineTo(12f, 15f); lineTo(17f, 10f); moveTo(4f, 19f); horizontalLineTo(20f) }
private val CloudFavoriteActionIcon = cloudActionIcon("CloudFavorite") { moveTo(12f, 3f); lineTo(14.8f, 8.7f); lineTo(21f, 9.6f); lineTo(16.5f, 14f); lineTo(17.6f, 20.2f); lineTo(12f, 17.3f); lineTo(6.4f, 20.2f); lineTo(7.5f, 14f); lineTo(3f, 9.6f); lineTo(9.2f, 8.7f); close() }
private val CloudDateActionIcon = cloudActionIcon("CloudDate") { moveTo(4f, 6f); horizontalLineTo(20f); verticalLineTo(20f); horizontalLineTo(4f); close(); moveTo(7f, 3f); verticalLineTo(8f); moveTo(17f, 3f); verticalLineTo(8f); moveTo(7f, 12f); horizontalLineTo(17f) }
private val CloudLocationActionIcon = cloudActionIcon("CloudLocation") { moveTo(12f, 21f); curveTo(6f, 14f, 5f, 12f, 5f, 9f); curveTo(5f, 5f, 8f, 3f, 12f, 3f); curveTo(16f, 3f, 19f, 5f, 19f, 9f); curveTo(19f, 12f, 18f, 14f, 12f, 21f); close(); moveTo(12f, 11f); curveTo(10f, 11f, 9f, 10f, 9f, 8f); curveTo(9f, 6f, 10f, 5f, 12f, 5f); curveTo(14f, 5f, 15f, 6f, 15f, 8f); curveTo(15f, 10f, 14f, 11f, 12f, 11f) }
private val CloudDeviceActionIcon = cloudActionIcon("CloudDevice") { moveTo(8f, 2f); horizontalLineTo(16f); verticalLineTo(22f); horizontalLineTo(8f); close(); moveTo(10f, 19f); horizontalLineTo(14f) }
private val CloudRestoreActionIcon = cloudActionIcon("CloudRestore") { moveTo(9f, 7f); lineTo(4f, 12f); lineTo(9f, 17f); moveTo(5f, 12f); horizontalLineTo(14f); curveTo(18f, 12f, 20f, 14f, 20f, 18f) }
@Composable
private fun CloudTrashActionIcon() {
    Box(Modifier.size(30.dp)) {
        Icon(OrangeDeleteIcon, null, Modifier.size(24.dp).align(Alignment.BottomStart), tint = Color.Unspecified)
        Icon(OrangeCloudShapeIcon, null, Modifier.size(14.dp).align(Alignment.TopEnd), tint = Color.Unspecified)
    }
}
@Composable
private fun LocalTrashActionIcon() {
    Box(Modifier.size(30.dp)) {
        Icon(OrangeDeleteIcon, null, Modifier.size(24.dp).align(Alignment.BottomStart), tint = Color.Unspecified)
        Icon(CloudDeviceActionIcon, null, Modifier.size(14.dp).align(Alignment.TopEnd), tint = Color.Unspecified)
    }
}
@Composable
private fun BothTrashActionIcon() {
    Box(Modifier.size(32.dp)) {
        Icon(OrangeDeleteIcon, null, Modifier.size(24.dp).align(Alignment.BottomCenter), tint = Color.Unspecified)
        Icon(OrangeCloudShapeIcon, null, Modifier.size(12.dp).align(Alignment.TopStart), tint = Color.Unspecified)
        Icon(CloudDeviceActionIcon, null, Modifier.size(12.dp).align(Alignment.TopEnd), tint = Color.Unspecified)
    }
}

@OptIn(ExperimentalMaterial3Api::class,ExperimentalFoundationApi::class)
@Composable
fun CloudPhotosScreen(api: OrangePhotosCloudApi, thumbnailLoader: RemoteThumbnailLoader, accountUserId:String, repository:CameraBackupRepository, deviceScanner:DeviceMediaStoreScanner, mediaRefreshVersion:Int, librarySelector: @Composable () -> Unit, onOpen: (CloudPhoto) -> Unit, modifier: Modifier, onDeleteLocalCopies:(List<LocalMediaItem>,(Boolean,String?)->Unit)->Unit={_,completion->completion(false,null)}, onDeleteCloudAndLocal:(List<String>,List<LocalMediaItem>,(Boolean,String?)->Unit)->Unit={_,_,completion->completion(false,null)}) {
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val listState = rememberLazyListState()
    val listIsDragged by listState.interactionSource.collectIsDraggedAsState()
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
    var loadingMoreNormal by remember { mutableStateOf(false) }
    var pagingMode by remember { mutableStateOf(CloudPagingMode.NORMAL) }
    var timelineThumbVisible by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(emptySet<String>()) }
    var selectedDays by remember { mutableStateOf(emptySet<String>()) }
    var selectionAnchor by remember { mutableStateOf<String?>(null) }
    var localByRemoteId by remember { mutableStateOf<Map<String,List<LocalMediaItem>>>(emptyMap()) }
    var members by remember { mutableStateOf(emptyList<CloudMember>()) }
    var bulkBusy by remember { mutableStateOf(false) }
    var bulkMessage by remember { mutableStateOf<String?>(null) }
    var albumDialogOpen by remember { mutableStateOf(false) }
    var targetAlbumId by remember { mutableStateOf<String?>(null) }
    var albumSearchQuery by remember { mutableStateOf("") }
    var createAlbumDialogOpen by remember { mutableStateOf(false) }
    var newAlbumTitle by remember { mutableStateOf("") }
    var albumCreating by remember { mutableStateOf(false) }
    var purgeDialogOpen by remember { mutableStateOf(false) }
    var shareDialogOpen by remember { mutableStateOf(false) }
    var shareVisibility by remember { mutableStateOf("private") }
    var shareUserIds by remember { mutableStateOf(emptySet<String>()) }
    var locationDialogOpen by remember { mutableStateOf(false) }
    var locationValue by remember { mutableStateOf("") }
    var trashDialogOpen by remember { mutableStateOf(false) }
    var deleteLocalDialogOpen by remember { mutableStateOf(false) }
    var deleteBothDialogOpen by remember { mutableStateOf(false) }
    val context=LocalContext.current

    fun clearSelection(){selected=emptySet();selectedDays=emptySet();selectionAnchor=null}
    fun toggleSelection(photo:CloudPhoto){val next=selected.toMutableSet();if(!next.add(photo.id))next.remove(photo.id);selected=next;selectionAnchor=photo.id}
    fun extendSelection(photo:CloudPhoto){val anchor=selectionAnchor;if(anchor==null||selected.isEmpty()){selected=selected+photo.id;selectionAnchor=photo.id;return};val start=items.indexOfFirst{it.id==anchor};val end=items.indexOfFirst{it.id==photo.id};if(start<0||end<0){selected=selected+photo.id;selectionAnchor=photo.id;return};selected=selected+items.subList(minOf(start,end),maxOf(start,end)+1).map{it.id};selectionAnchor=photo.id}
    fun handlePhotoClick(photo:CloudPhoto){if(selected.isEmpty())onOpen(photo)else toggleSelection(photo)}
    fun toggleDay(day:CloudPhotoDay){val ids=day.photos.map{it.id}.toSet();val all=ids.isNotEmpty()&&ids.all{it in selected};selected=selected.toMutableSet().apply{if(all)removeAll(ids)else addAll(ids)};selectedDays=selectedDays.toMutableSet().apply{if(all)remove(day.key)else add(day.key)};if(!all)selectionAnchor=day.photos.lastOrNull()?.id}

    fun activeAlbumId(): String? = if (cloudView == CloudView.ALBUM_DETAIL) selectedAlbum?.id else null
    suspend fun reload() {
        val generation = timelineRequestGeneration + 1
        timelineRequestGeneration = generation
        timeline = emptyList()
        if (cloudView == CloudView.ALBUMS) { loading = false; return }
        loading = true; error = null
        if (cloudView == CloudView.TRASH) {
            runCatching { api.photos(trashed = true) }
                .onSuccess { photos -> items = photos.items; page = photos.page; hasMore = photos.hasMore; hasNewer = false; newerCursor = null; hasOlder = false; olderCursor = null; pagingMode = CloudPagingMode.NORMAL; timeline = emptyList() }
                .onFailure { error = it.message ?: "No se pudo cargar la papelera." }
            loading = false
            return
        }
        val albumId = activeAlbumId()
        val sharedWithMe = cloudView == CloudView.SHARED_WITH_ME
        runCatching { api.photos(albumId = albumId, sharedWithMe = sharedWithMe) }
            .onSuccess { photos ->
                items = photos.items; page = photos.page; hasMore = photos.hasMore; hasNewer = false; newerCursor = null; hasOlder = false; olderCursor = null; pagingMode = CloudPagingMode.NORMAL
                loading = false
                scope.launch {
                    runCatching { api.timeline(albumId, sharedWithMe) }
                        .onSuccess { periods -> if (generation == timelineRequestGeneration) timeline = periods }
                }
            }
            .onFailure { error = it.message ?: "No se pudo cargar la biblioteca." }
        if (loading) loading = false
    }
    LaunchedEffect(Unit) { albums = runCatching { api.albums() }.getOrDefault(emptyList()) }
    LaunchedEffect(Unit) { members = runCatching { api.members() }.getOrDefault(emptyList()) }
    LaunchedEffect(api, cloudView, selectedAlbum?.id) { reload() }
    LaunchedEffect(cloudView, selectedAlbum?.id){clearSelection()}
    LaunchedEffect(items,mediaRefreshVersion){val ids=items.map{it.id}.distinct();localByRemoteId=if(ids.isEmpty())emptyMap()else withContext(Dispatchers.IO){repository.remoteLinkedItems(accountUserId,ids)}.filter{deviceScanner.isActive(it)}.mapNotNull{item->item.remotePhotoId?.trim()?.takeIf{it.isNotBlank()}?.let{it to item}}.groupBy({it.first},{it.second})}
    LaunchedEffect(listState.isScrollInProgress) { if (listState.isScrollInProgress) timelineThumbVisible = true else { delay(1500); timelineThumbVisible = false } }

    val groups = remember(items) { groupCloudPhotos(items) }
    val selectedPhotos=items.filter{it.id in selected}
    val addableToLibrary=selectedPhotos.filter{!it.isOriginalOwner&&!it.isInLibrary}
    val selectedLocalItems=selectedPhotos.flatMap{localByRemoteId[it.id].orEmpty()}.distinctBy{"${it.mediaCollection}:${it.mediaType}:${it.mediaStoreId}"}
    val downloadCandidates=selectedPhotos.filter{localByRemoteId[it.id].isNullOrEmpty()}
    val downloader=remember(api,repository,accountUserId){CloudMediaDownloader(context.applicationContext,repository,api,accountUserId)}
    val allSelectedOwned=selectedPhotos.isNotEmpty()&&selectedPhotos.all{it.isOwner}
    val allFavorite=selectedPhotos.isNotEmpty()&&selectedPhotos.all{it.isFavorite}
    val bulkSelectionAllowed=selectedPhotos.isNotEmpty()&&selectedPhotos.size<=MAX_CLOUD_BULK_SELECTION
    fun runBulk(block:suspend()->Unit){if(bulkBusy)return;if(selectedPhotos.size>MAX_CLOUD_BULK_SELECTION){bulkMessage="Puedes realizar acciones sobre un máximo de 500 elementos a la vez.";return};scope.launch{bulkBusy=true;runCatching{block()}.onFailure{bulkMessage=it.message;reload()}.onSuccess{reload();clearSelection()};bulkBusy=false}}
    fun selectAllTrash(){if(cloudView!=CloudView.TRASH||bulkBusy)return;scope.launch{bulkBusy=true;try{var currentPage=api.photos(page=1,perPage=100,trashed=true);if(currentPage.total>MAX_CLOUD_BULK_SELECTION){bulkMessage="Puedes realizar acciones sobre un máximo de 500 elementos a la vez.";return@launch};val allItems=currentPage.items.toMutableList();while(currentPage.hasMore){currentPage=api.photos(page=currentPage.page+1,perPage=100,trashed=true);allItems+=currentPage.items};val loadedItems=allItems.distinctBy{it.id};if(loadedItems.size>MAX_CLOUD_BULK_SELECTION){bulkMessage="Puedes realizar acciones sobre un máximo de 500 elementos a la vez.";return@launch};items=loadedItems;page=currentPage.page;hasMore=false;hasNewer=false;newerCursor=null;hasOlder=false;olderCursor=null;pagingMode=CloudPagingMode.NORMAL;timeline=emptyList();selected=loadedItems.map{it.id}.toSet();selectedDays=emptySet();selectionAnchor=loadedItems.lastOrNull()?.id}catch(error:Exception){bulkMessage=error.message?:"No se pudo seleccionar toda la papelera."}finally{bulkBusy=false}}}
    val selectionActions=remember(selected,allSelectedOwned,allFavorite,bulkSelectionAllowed){listOf(SelectionActionItem("album","Álbum",enabled=bulkSelectionAllowed,onClick={albumSearchQuery="";targetAlbumId=null;albumDialogOpen=true},icon={Icon(CloudAlbumActionIcon,null)}),SelectionActionItem("share","Compartir",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={shareDialogOpen=true},icon={Icon(OrangeShareIcon,null)}),SelectionActionItem("favorite",if(allFavorite)"Quitar favorita" else "Favorita",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={runBulk{selectedPhotos.forEach{api.setFavorite(it.id,!allFavorite)}}},icon={Icon(CloudFavoriteActionIcon,null)}),SelectionActionItem("date","Fecha y hora",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={val initial=selectedPhotos.firstOrNull()?.capturedAt?.let{runCatching{Instant.parse(it).atZone(ZoneId.systemDefault())}.getOrNull()}?:ZonedDateTime.now();android.app.DatePickerDialog(context,{_,y,m,d->android.app.TimePickerDialog(context,{_,h,min->val iso=ZonedDateTime.of(LocalDateTime.of(y,m+1,d,h,min),ZoneId.systemDefault()).toInstant().toString();runBulk{selectedPhotos.forEach{api.setCapturedAt(it.id,iso)}}},initial.hour,initial.minute,true).show()},initial.year,initial.monthValue-1,initial.dayOfMonth).show()},icon={Icon(CloudDateActionIcon,null)}),SelectionActionItem("location","Ubicación",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={locationValue="";locationDialogOpen=true},icon={Icon(CloudLocationActionIcon,null)}),SelectionActionItem("trash","Papelera nube",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={trashDialogOpen=true},icon={CloudTrashActionIcon()}))}
    val addToLibraryAction=SelectionActionItem("add-library","Añadir a mi biblioteca",enabled=bulkSelectionAllowed&&addableToLibrary.isNotEmpty(),onClick={runBulk{addableToLibrary.forEach{api.addToLibrary(it.id)}}},icon={Icon(OrangeFilledCloudIcon,null,tint=Color.Unspecified)})
    val downloadAction=SelectionActionItem("download-device","Descargar",enabled=bulkSelectionAllowed&&android.os.Build.VERSION.SDK_INT>=android.os.Build.VERSION_CODES.Q&&downloadCandidates.isNotEmpty(),onClick={runBulk{val downloadedImageCount=downloadCandidates.count{it.mediaType=="image"};val downloadedVideoCount=downloadCandidates.count{it.mediaType=="video"};downloadCandidates.forEach{photo->val downloaded=downloader.download(photo);localByRemoteId=localByRemoteId+(photo.id to (localByRemoteId[photo.id].orEmpty()+downloaded).distinctBy{"${it.mediaCollection}:${it.mediaType}:${it.mediaStoreId}"})};val message=when{downloadedImageCount>0&&downloadedVideoCount==0->if(downloadedImageCount==1)"Imagen descargada en Imágenes/OrangeFamily." else "$downloadedImageCount imágenes descargadas en Imágenes/OrangeFamily.";downloadedVideoCount>0&&downloadedImageCount==0->if(downloadedVideoCount==1)"Vídeo descargado en Vídeos/OrangeFamily." else "$downloadedVideoCount vídeos descargados en Vídeos/OrangeFamily.";else->"${downloadedImageCount+downloadedVideoCount} elementos descargados en Imágenes/OrangeFamily y Vídeos/OrangeFamily."};Toast.makeText(context,message,Toast.LENGTH_LONG).show()}},icon={Icon(CloudDownloadActionIcon,null)})
    val deleteLocalAction=SelectionActionItem("delete-local","Eliminar local",enabled=bulkSelectionAllowed&&android.os.Build.VERSION.SDK_INT>=android.os.Build.VERSION_CODES.R&&selectedLocalItems.isNotEmpty(),onClick={deleteLocalDialogOpen=true},icon={LocalTrashActionIcon()})
    val deleteBothAction=SelectionActionItem("delete-both","Eliminar de ambos",enabled=bulkSelectionAllowed&&allSelectedOwned&&(android.os.Build.VERSION.SDK_INT>=android.os.Build.VERSION_CODES.R||selectedLocalItems.isEmpty()),onClick={deleteBothDialogOpen=true},icon={BothTrashActionIcon()})
    val restoreCloudAction=SelectionActionItem("restore-cloud","Restaurar",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={runBulk{selectedPhotos.forEach{api.restorePhoto(it.id)}}},icon={Icon(CloudRestoreActionIcon,null)})
    val purgeCloudAction=SelectionActionItem("purge-cloud","Eliminar definitivamente",enabled=bulkSelectionAllowed&&allSelectedOwned,onClick={purgeDialogOpen=true},icon={Icon(OrangeDeleteIcon,null)})
    LaunchedEffect(groups, selectedDays) {
        if (selectedDays.isEmpty()) {
            return@LaunchedEffect
        }

        val next = selected.toMutableSet()

        groups
            .flatMap { it.days }
            .filter { it.key in selectedDays }
            .flatMap { it.photos }
            .forEach { next += it.id }

        if (next != selected) {
            selected = next
        }
    }
    LaunchedEffect(listState) { snapshotFlow { listState.layoutInfo.visibleItemsInfo.firstOrNull()?.key }.distinctUntilChanged().collect { key -> cloudPeriodKeyFromLazyItemKey(key)?.let { activePeriod = it } } }
    suspend fun jumpToPeriod(period: CloudTimelineMonth) {
        val cursor = period.cursor ?: return
        val generation = timelineRequestGeneration + 1
        timelineRequestGeneration = generation
        try {
            val result = api.aroundDate(cursor, activeAlbumId(), sharedWithMe = cloudView == CloudView.SHARED_WITH_ME)
            if (generation != timelineRequestGeneration) return
            items = result.items; page = 1; pagingMode = CloudPagingMode.WINDOW; hasMore = false; hasNewer = result.hasNewer; newerCursor = result.newerCursor; hasOlder = result.hasOlder; olderCursor = result.olderCursor; activePeriod = period.key; listState.scrollToItem(0)
        } catch (error: Exception) {
            bulkMessage = error.message ?: "No se pudo cargar el periodo."
        }
    }

    suspend fun loadWindowNewer() {
        if (pagingMode != CloudPagingMode.WINDOW || !hasNewer || loadingWindowNewer) return
        val cursor = newerCursor ?: return
        loadingWindowNewer = true
        try { val result = api.aroundDate(cursor, activeAlbumId(), "newer", sharedWithMe = cloudView == CloudView.SHARED_WITH_ME); if (result.items.isEmpty()) { hasNewer = false; return }; items = (result.items + items).distinctBy { it.id }; hasNewer = result.hasNewer; newerCursor = result.newerCursor } catch (error: Exception) { bulkMessage = error.message ?: "No se pudo cargar el periodo." } finally { loadingWindowNewer = false }
    }

    suspend fun loadWindowOlder() {
        if (pagingMode != CloudPagingMode.WINDOW || !hasOlder) return
        val cursor = olderCursor ?: return
        try {
            val result = api.aroundDate(cursor, activeAlbumId(), "older", sharedWithMe = cloudView == CloudView.SHARED_WITH_ME)
            items = (items + result.items).distinctBy { it.id }
            hasOlder = result.hasOlder
            olderCursor = result.olderCursor
        } catch (error: Exception) {
            bulkMessage = error.message ?: "No se pudo cargar el periodo."
        }
    }
    suspend fun loadNextNormalPage(){if(pagingMode!=CloudPagingMode.NORMAL||!hasMore||loadingMoreNormal)return;loadingMoreNormal=true;try{val result=api.photos(page+1,albumId=activeAlbumId(),trashed=cloudView==CloudView.TRASH,sharedWithMe=cloudView==CloudView.SHARED_WITH_ME);items=(items+result.items).distinctBy{it.id};page=result.page;hasMore=result.hasMore}finally{loadingMoreNormal=false}}
    LaunchedEffect(listState, pagingMode, hasNewer, newerCursor) { var movedAwayFromWindowTop=false; snapshotFlow { CloudWindowScrollProbe(listState.firstVisibleItemIndex,listState.firstVisibleItemScrollOffset,listIsDragged,listState.lastScrolledBackward) }.distinctUntilChanged().collect { state -> if(state.index>0||state.offset>=300)movedAwayFromWindowTop=true;if(state.dragged&&movedAwayFromWindowTop&&state.scrollingBackward&&pagingMode==CloudPagingMode.WINDOW&&hasNewer&&state.index==0&&state.offset<300){movedAwayFromWindowTop=false;loadWindowNewer()} } }
    LaunchedEffect(listState,pagingMode,hasMore){snapshotFlow{val info=listState.layoutInfo;Pair(info.visibleItemsInfo.lastOrNull()?.index?:0,info.totalItemsCount)}.distinctUntilChanged().collect{(last,total)->if(pagingMode==CloudPagingMode.NORMAL&&hasMore&&last>=total-2)loadNextNormalPage()}}

if(albumDialogOpen){val selectableAlbums=albums.filter{(it.isOwner||it.canContribute)&&(cloudView!=CloudView.ALBUM_DETAIL||it.id!=selectedAlbum?.id)};val filteredAlbums=selectableAlbums.filter{albumSearchQuery.isBlank()||it.title.contains(albumSearchQuery.trim(),ignoreCase=true)};AlertDialog(onDismissRequest={if(!bulkBusy&&!albumCreating)albumDialogOpen=false},title={Text("Añadir a álbum")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){OutlinedTextField(value=albumSearchQuery,onValueChange={albumSearchQuery=it},modifier=Modifier.fillMaxWidth(),singleLine=true,label={Text("Buscar álbum")});TextButton(enabled=!bulkBusy&&!albumCreating,onClick={newAlbumTitle="";createAlbumDialogOpen=true}){Icon(CloudAlbumActionIcon,null,Modifier.size(20.dp));Spacer(Modifier.width(6.dp));Text("Crear álbum")};if(selectableAlbums.isEmpty())Text("No hay álbumes disponibles para añadir contenido.") else if(filteredAlbums.isEmpty())Text("No hay álbumes que coincidan con la búsqueda.") else LazyColumn(modifier=Modifier.fillMaxWidth().heightIn(max=360.dp)){items(items=filteredAlbums,key={it.id}){album->Row(modifier=Modifier.fillMaxWidth().clickable{targetAlbumId=album.id}.padding(vertical=4.dp),verticalAlignment=Alignment.CenterVertically){RadioButton(selected=targetAlbumId==album.id,onClick={targetAlbumId=album.id});Text(text=album.title,modifier=Modifier.weight(1f),maxLines=2,overflow=TextOverflow.Ellipsis)}}}}},confirmButton={TextButton(enabled=!bulkBusy&&!targetAlbumId.isNullOrBlank()&&selected.size<=MAX_CLOUD_BULK_SELECTION,onClick={runBulk{val id=targetAlbumId!!;val snapshot=selectedPhotos.toList();val albumTitle=albums.firstOrNull{it.id==id}?.title?:"álbum";var addedCount=0;snapshot.forEach{if(api.addPhotoToAlbum(id,it.id))addedCount+=1};albums=api.albums();albumDialogOpen=false;val requestedCount=snapshot.size;val message=when{addedCount==requestedCount->if(addedCount==1)"1 elemento añadido a «${albumTitle}»." else "${addedCount} elementos añadidos a «${albumTitle}».";addedCount==0->"Los elementos seleccionados ya estaban en «${albumTitle}».";else->{val skippedCount=requestedCount-addedCount;if(addedCount==1)"1 elemento añadido a «${albumTitle}»; ${skippedCount} ya estaba en el álbum." else "${addedCount} elementos añadidos a «${albumTitle}»; ${skippedCount} ya estaban en el álbum."}};Toast.makeText(context,message,Toast.LENGTH_LONG).show()}}){Text("Añadir")}},dismissButton={TextButton(onClick={if(!bulkBusy&&!albumCreating)albumDialogOpen=false}){Text("Cancelar")}})}
if(createAlbumDialogOpen)AlertDialog(onDismissRequest={if(!albumCreating)createAlbumDialogOpen=false},title={Text("Crear álbum")},text={OutlinedTextField(value=newAlbumTitle,onValueChange={newAlbumTitle=it.take(500)},modifier=Modifier.fillMaxWidth(),singleLine=true,label={Text("Nombre del álbum")})},confirmButton={TextButton(enabled=!albumCreating&&newAlbumTitle.trim().isNotEmpty(),onClick={albumCreating=true;scope.launch{runCatching{val createdAlbumId=api.createAlbum(newAlbumTitle.trim());val refreshedAlbums=api.albums();createdAlbumId to refreshedAlbums}.onSuccess{(createdAlbumId,refreshedAlbums)->albums=refreshedAlbums;targetAlbumId=createdAlbumId;albumSearchQuery="";newAlbumTitle="";createAlbumDialogOpen=false}.onFailure{error->bulkMessage=error.message?:"No se pudo crear el álbum."};albumCreating=false}}){Text("Crear")}},dismissButton={TextButton(enabled=!albumCreating,onClick={createAlbumDialogOpen=false}){Text("Cancelar")}})
    if(shareDialogOpen)AlertDialog(onDismissRequest={if(!bulkBusy)shareDialogOpen=false},title={Text("Compartir")},text={Column{listOf("private" to "Solo yo","family" to "Toda la familia","selected" to "Miembros concretos").forEach{(v,l)->Row(verticalAlignment=Alignment.CenterVertically){RadioButton(selected=shareVisibility==v,onClick={shareVisibility=v});Text(l)}};if(shareVisibility=="selected")members.filter{it.id!=accountUserId}.forEach{member->Row(verticalAlignment=Alignment.CenterVertically){Checkbox(checked=member.id in shareUserIds,onCheckedChange={shareUserIds=if(it)shareUserIds+member.id else shareUserIds-member.id});Text(member.displayName)}}}},confirmButton={TextButton(enabled=!bulkBusy&&(shareVisibility!="selected"||shareUserIds.isNotEmpty()),onClick={runBulk{selectedPhotos.forEach{api.sharePhoto(it.id,shareVisibility,shareUserIds.toList())};shareDialogOpen=false}}){Text("Compartir")}},dismissButton={TextButton(onClick={if(!bulkBusy)shareDialogOpen=false}){Text("Cancelar")}})
    if(locationDialogOpen)AlertDialog(onDismissRequest={if(!bulkBusy)locationDialogOpen=false},title={Text("Ubicación")},text={OutlinedTextField(value=locationValue,onValueChange={locationValue=it},label={Text("Ubicación")},singleLine=true)},confirmButton={TextButton(enabled=!bulkBusy&&locationValue.trim().isNotEmpty(),onClick={runBulk{val value=locationValue.trim();selectedPhotos.forEach{api.setLocationName(it.id,value)};locationDialogOpen=false}}){Text("Guardar")}},dismissButton={TextButton(onClick={if(!bulkBusy)locationDialogOpen=false}){Text("Cancelar")}})
    if(bulkMessage!=null)AlertDialog(onDismissRequest={bulkMessage=null},title={Text("Error")},text={Text(bulkMessage!!)},confirmButton={TextButton(onClick={bulkMessage=null}){Text("Aceptar")}})
if(purgeDialogOpen)AlertDialog(onDismissRequest={if(!bulkBusy)purgeDialogOpen=false},title={Text("Eliminar definitivamente")},text={Text(if(selectedPhotos.size==1)"Se eliminará definitivamente 1 elemento de OrangeFamily. Esta acción no se puede deshacer. La copia del dispositivo no se modificará." else "Se eliminarán definitivamente ${selectedPhotos.size} elementos de OrangeFamily. Esta acción no se puede deshacer. Las copias del dispositivo no se modificarán.")},confirmButton={TextButton(enabled=!bulkBusy,onClick={runBulk{selectedPhotos.forEach{api.purgePhoto(it.id)};purgeDialogOpen=false}}){Text("Eliminar definitivamente")}},dismissButton={TextButton(enabled=!bulkBusy,onClick={purgeDialogOpen=false}){Text("Cancelar")}})
    if(trashDialogOpen)AlertDialog(onDismissRequest={if(!bulkBusy)trashDialogOpen=false},title={Text("Papelera nube")},text={Text(if(selectedPhotos.size==1)"Se moverá 1 elemento de OrangeFamily a su papelera. La copia del dispositivo no se modificará." else "Se moverán ${selectedPhotos.size} elementos de OrangeFamily a su papelera. Las copias del dispositivo no se modificarán.")},confirmButton={TextButton(enabled=!bulkBusy,onClick={runBulk{selectedPhotos.forEach{api.trashPhoto(it.id)};trashDialogOpen=false}}){Text("Mover")}},dismissButton={TextButton(onClick={if(!bulkBusy)trashDialogOpen=false}){Text("Cancelar")}})
    if(deleteLocalDialogOpen)AlertDialog(onDismissRequest={if(!bulkBusy)deleteLocalDialogOpen=false},title={Text("Eliminar copia local")},text={Text(if(selectedLocalItems.size==1)"Se moverá 1 copia del dispositivo a su papelera. OrangeFamily no se modificará." else "Se moverán ${selectedLocalItems.size} copias del dispositivo a su papelera. OrangeFamily no se modificará.")},confirmButton={TextButton(enabled=!bulkBusy,onClick={bulkBusy=true;onDeleteLocalCopies(selectedLocalItems){success,message->bulkBusy=false;deleteLocalDialogOpen=false;if(success)clearSelection() else if(!message.isNullOrBlank())bulkMessage=message}}){Text("Eliminar local")}},dismissButton={TextButton(onClick={if(!bulkBusy)deleteLocalDialogOpen=false}){Text("Cancelar")}})
    if(deleteBothDialogOpen)AlertDialog(onDismissRequest={if(!bulkBusy)deleteBothDialogOpen=false},title={Text("Eliminar de ambos")},text={Text(if(android.os.Build.VERSION.SDK_INT>=android.os.Build.VERSION_CODES.R)if(selectedPhotos.size==1)"Se moverá 1 elemento de OrangeFamily a su papelera. Si existe una copia en el dispositivo, también se moverá a la papelera del dispositivo." else "Se moverán ${selectedPhotos.size} elementos de OrangeFamily a su papelera. Las copias existentes en el dispositivo también se moverán a la papelera del dispositivo." else if(selectedPhotos.size==1)"Se moverá 1 elemento de OrangeFamily a su papelera. No hay una copia local detectada en el dispositivo." else "Se moverán ${selectedPhotos.size} elementos de OrangeFamily a su papelera. No hay copias locales detectadas en el dispositivo.")},confirmButton={TextButton(enabled=!bulkBusy,onClick={bulkBusy=true;onDeleteCloudAndLocal(selectedPhotos.map{it.id}.distinct(),selectedLocalItems){success,message->bulkBusy=false;deleteBothDialogOpen=false;if(success)scope.launch{reload();clearSelection()} else if(!message.isNullOrBlank())bulkMessage=message}}){Text("Eliminar de ambos")}},dismissButton={TextButton(onClick={if(!bulkBusy)deleteBothDialogOpen=false}){Text("Cancelar")}})
    ModalNavigationDrawer(drawerState = drawerState, drawerContent = {
        ModalDrawerSheet {
            Spacer(Modifier.height(20.dp))
            NavigationDrawerItem({ Text(stringResource(R.string.cloud_all_photos)) }, cloudView == CloudView.LIBRARY, { selectedAlbum = null; cloudView = CloudView.LIBRARY; scope.launch { drawerState.close() } })
            NavigationDrawerItem({ Text("Compartidas conmigo") }, cloudView == CloudView.SHARED_WITH_ME, { selectedAlbum = null; cloudView = CloudView.SHARED_WITH_ME; scope.launch { drawerState.close() } })
            NavigationDrawerItem({ Text(stringResource(R.string.cloud_albums)) }, cloudView == CloudView.ALBUMS, { selectedAlbum = null; cloudView = CloudView.ALBUMS; scope.launch { drawerState.close() } })
            NavigationDrawerItem({ Text("Papelera nube") }, cloudView == CloudView.TRASH, { selectedAlbum = null; cloudView = CloudView.TRASH; scope.launch { drawerState.close() } })
            HorizontalDivider()
        }
    }) {
        Scaffold(
            modifier = modifier,
            containerColor = OrangeBorder,
            topBar = {
                if (selected.isNotEmpty()) {
                    TopAppBar(
                        title = {
                            Text(
                                "${selected.size} seleccionados",
                                style = MaterialTheme.typography.titleMedium,
                            )
                        },
                        navigationIcon = {
                            IconButton(
                                onClick = {
                                    clearSelection()
                                },
                            ) {
                                Text(
                                    "×",
                                    style = MaterialTheme.typography.titleLarge,
                                )
                            }
                        },
                    )
                } else {
                    TopAppBar(
                        title = {
                            librarySelector()
                        },
                        navigationIcon = {
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        drawerState.open()
                                    }
                                },
                            ) {
                                Text(
                                    "☰",
                                    style = MaterialTheme.typography.titleLarge,
                                )
                            }
                        },
                    )
                }
            },
            bottomBar = { if(selectedPhotos.isNotEmpty()){Column{if(selected.size>MAX_CLOUD_BULK_SELECTION)Text("Puedes realizar acciones sobre un máximo de 500 elementos a la vez.",modifier=Modifier.padding(8.dp));SelectionActionTray(actions=if(cloudView==CloudView.TRASH)listOf(restoreCloudAction,purgeCloudAction) else listOf(selectionActions.first(),addToLibraryAction,downloadAction,selectionActions[1],selectionActions[5],deleteLocalAction,deleteBothAction,selectionActions[2],selectionActions[3],selectionActions[4]),reopenKey=selected)}}},
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                if (cloudView == CloudView.ALBUMS) {
                    CloudAlbumsView(albums, thumbnailLoader) { selectedAlbum = it; cloudView = CloudView.ALBUM_DETAIL }
                } else {
                if (selectedAlbum != null) Text(selectedAlbum!!.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(12.dp))
           if (cloudView == CloudView.TRASH) Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically) { Text("Papelera nube",style=MaterialTheme.typography.titleLarge,modifier=Modifier.weight(1f));TextButton(enabled=!bulkBusy&&items.isNotEmpty()&&(hasMore||selected.size!=items.size),onClick={selectAllTrash()}){Text("Seleccionar todo")} }
                if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center))
                else if (error != null) Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) { Text(error!!); OutlinedButton({ scope.launch { reload() } }) { Text(stringResource(R.string.cloud_retry)) } }
                else if (cloudView == CloudView.TRASH && items.isEmpty()) Text("La papelera nube está vacía.", modifier = Modifier.align(Alignment.Center))
                else BoxWithConstraints(Modifier.fillMaxSize().padding(top = if (selectedAlbum != null || cloudView == CloudView.TRASH) 52.dp else 0.dp)) {
                    val availableWidth = maxWidth.value
                    val justifiedRowsByDay = remember(groups, availableWidth) { buildMap { groups.forEach { period -> period.days.forEach { day -> put("${period.key}:${day.key}", buildJustifiedRows(day.photos, availableWidth)) } } } }
                    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 2.dp)) {
                        groups.forEachIndexed { periodIndex, period ->
                            item(key = "period:${period.key}", contentType = "period-header") { Text(period.label, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = if (periodIndex == 0) 10.dp else 20.dp, bottom = 6.dp)) }
                            period.days.forEach { day ->
                                        item(key = "day:${period.key}:${day.key}", contentType = "day-header") {
                                        Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=7.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){val ids=day.photos.map{it.id};val all=ids.isNotEmpty()&&ids.all{it in selected};Box(Modifier.size(24.dp).background(if(all)OrangePrimary else Color.Transparent,CircleShape).border(2.dp,if(all)OrangePrimary else MaterialTheme.colorScheme.outline,CircleShape).clickable{toggleDay(day)},contentAlignment=Alignment.Center){if(ids.any{it in selected})Text("✓",color=if(all)Color.White else OrangePrimary,fontWeight=FontWeight.Bold)};Text(day.label,style=MaterialTheme.typography.titleSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}
                                        }
                                        justifiedRowsByDay["${period.key}:${day.key}"].orEmpty().forEach { row ->
                                            item(key = "row:${period.key}:${day.key}:${row.photos.joinToString(","){it.id}}", contentType = "photo-row") {
                                            Column(Modifier.fillMaxWidth()) {
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
                        if (pagingMode == CloudPagingMode.WINDOW && hasOlder && olderCursor != null) item(key = "window-load-older") { LaunchedEffect(olderCursor) { loadWindowOlder() } }
                    }
                if (cloudView != CloudView.TRASH && timeline.isNotEmpty()) Box(Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(68.dp)) { CloudTimeline(timeline, activePeriod, timelineThumbVisible) { scope.launch { jumpToPeriod(it) } } }
                }
                }
            }
        }
    }
}

@Composable
private fun CloudSharedBadge(
    owned: Boolean,
    modifier: Modifier = Modifier,
) {
    val badgeColor =
        if (owned) {
            OrangePrimary
        } else {
            Color(0xFF1D4ED8)
        }

    Box(
        modifier = modifier
            .size(23.dp)
            .background(
                Color.White.copy(alpha = 0.88f),
                CircleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .offset(x = (-4).dp, y = (-3).dp)
                .size(7.dp)
                .background(badgeColor, CircleShape),
        )

        Box(
            Modifier
                .offset(x = 4.dp, y = (-3).dp)
                .size(7.dp)
                .background(badgeColor, CircleShape),
        )

        Box(
            Modifier
                .offset(y = 5.dp)
                .width(15.dp)
                .height(6.dp)
                .background(
                    badgeColor,
                    RoundedCornerShape(
                        topStart = 6.dp,
                        topEnd = 6.dp,
                    ),
                ),
        )
    }
}

@Composable
private fun CloudLocalCopyBadge(
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .size(24.dp)
            .background(
                Color.Black.copy(alpha = 0.68f),
                RoundedCornerShape(6.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .width(10.dp)
                .height(15.dp)
                .border(
                    1.5.dp,
                    Color.White,
                    RoundedCornerShape(2.dp),
                ),
        )

        Text(
            text = "✓",
            color = Color.White,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(
                    end = 2.dp,
                    bottom = 1.dp,
                ),
        )
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
    return date.format(DateTimeFormatter.ofPattern("MMM yyyy", spanishLocale))
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
        val maxHeightPx = constraints.maxHeight.toFloat()
        fun update(y: Float) {
            val progress = (y / constraints.maxHeight.toFloat()).coerceIn(0f, 1f)
            periods.minByOrNull { abs(it.center - progress) }?.let { scrubProgress = progress; previewPeriod = it }
        }
        Box(Modifier.fillMaxSize()) {
            if (dragging) {
            Box(Modifier.align(Alignment.CenterEnd).padding(end = 14.dp).width(1.dp).fillMaxHeight().padding(vertical = 10.dp).background(MaterialTheme.colorScheme.outlineVariant))
            periods.forEach { period -> val activeDot = period.item.key == activePeriod; Box(Modifier.align(Alignment.TopEnd).padding(end = if (activeDot) 11.dp else 12.dp).offset(y = trackHeight * period.center + 10.dp - if (activeDot) 3.dp else 2.dp).size(if (activeDot) 6.dp else 4.dp).background(if (activeDot) MaterialTheme.colorScheme.primary else Color(0x7A475569), CircleShape)) }
            timelineYears.forEach { yearItem ->
                val activeYear = activePeriod?.startsWith("${yearItem.year}-") == true
                Text(yearItem.year.toString(), fontSize = 11.sp, lineHeight = 12.sp, style = MaterialTheme.typography.labelMedium, fontWeight = if (activeYear) FontWeight.Bold else FontWeight.SemiBold, color = if (activeYear) MaterialTheme.colorScheme.primary else Color(0xFF334155), modifier = Modifier.align(Alignment.TopEnd).padding(end = 30.dp).offset(y = trackHeight * yearItem.center + 10.dp - 7.dp).background(Color.White.copy(alpha = .96f), RoundedCornerShape(9.dp)).border(1.dp, Color(0xFFDCE3F5), RoundedCornerShape(9.dp)).padding(horizontal = 4.dp, vertical = 1.dp))
            }
            }
            if (thumbVisible || dragging) Box(Modifier.align(Alignment.TopEnd).offset(y = trackHeight * scrubProgress + 10.dp - 32.dp).size(width = 44.dp, height = 64.dp).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(topStart = 22.dp, bottomStart = 22.dp, topEnd = 0.dp, bottomEnd = 0.dp)).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(topStart = 22.dp, bottomStart = 22.dp, topEnd = 0.dp, bottomEnd = 0.dp)).pointerInput(periods) { detectVerticalDragGestures(onDragStart = { dragging = true }, onVerticalDrag = { change, dragAmount -> change.consume(); val nextProgress = (scrubProgress + dragAmount / maxHeightPx).coerceIn(0f, 1f); periods.minByOrNull { abs(it.center - nextProgress) }?.let { scrubProgress = nextProgress; previewPeriod = it }; scrubRequestVersion += 1 }, onDragEnd = { onSelected(previewPeriod.item); dragging = false }, onDragCancel = { dragging = false }) }, contentAlignment = Alignment.CenterStart) { Column(Modifier.padding(start = 13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { repeat(3) { Box(Modifier.width(12.dp).height(2.dp).background(Color(0xFF64748B))) } } }
            if (dragging) Text(timelineMonthLabel(previewPeriod.item), style = MaterialTheme.typography.titleSmall, modifier = Modifier.align(Alignment.TopEnd).offset(x = (-52).dp, y = trackHeight * scrubProgress + 10.dp - 22.dp).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(22.dp)).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(22.dp)).padding(horizontal = 13.dp, vertical = 10.dp))
        }
    }
}

@Composable private fun CloudAlbumsView(albums: List<CloudAlbum>, thumbnailLoader: RemoteThumbnailLoader, onOpen: (CloudAlbum) -> Unit) {
    var sortMode by remember { mutableStateOf("album_date_desc") }
    var selectedCategoryIds by remember { mutableStateOf(emptySet<String>()) }
    var sortMenuExpanded by remember { mutableStateOf(false) }
    val categories = remember(albums) { albums.flatMap { it.categories }.distinctBy { it.id }.sortedBy { it.name.lowercase(Locale.ROOT) } }
    fun compareAlbums(first: CloudAlbum, second: CloudAlbum): Int {
        val titleCompare = first.title.compareTo(second.title, ignoreCase = true)
        val idCompare = first.id.compareTo(second.id, ignoreCase = true)
        if (sortMode == "title_asc") return titleCompare.takeIf { it != 0 } ?: idCompare
        if (sortMode == "title_desc") return (-titleCompare).takeIf { it != 0 } ?: idCompare
        val firstDate = first.dateStart?.take(10)
        val secondDate = second.dateStart?.take(10)
        if (firstDate == null && secondDate == null) return titleCompare.takeIf { it != 0 } ?: idCompare
        if (firstDate == null) return 1
        if (secondDate == null) return -1
        val dateCompare = if (sortMode == "album_date_asc") firstDate.compareTo(secondDate) else secondDate.compareTo(firstDate)
        return dateCompare.takeIf { it != 0 } ?: titleCompare.takeIf { it != 0 } ?: idCompare
    }
    val visibleAlbums = remember(albums, selectedCategoryIds, sortMode) {
        albums.filter { album -> selectedCategoryIds.isEmpty() || album.categories.any { it.id in selectedCategoryIds } }.sortedWith(::compareAlbums)
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.cloud_albums), style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            Box {
                OutlinedButton(onClick = { sortMenuExpanded = true }) { Text(when (sortMode) { "album_date_asc" -> "Fecha · más antigua"; "title_asc" -> "Título · A–Z"; "title_desc" -> "Título · Z–A"; else -> "Fecha · más reciente" }) }
                DropdownMenu(expanded = sortMenuExpanded, onDismissRequest = { sortMenuExpanded = false }) {
                    listOf("album_date_desc" to "Fecha · más reciente", "album_date_asc" to "Fecha · más antigua", "title_asc" to "Título · A–Z", "title_desc" to "Título · Z–A").forEach { (value, label) -> DropdownMenuItem(text = { Text(label) }, onClick = { sortMode = value; sortMenuExpanded = false }) }
                }
            }
        }
        if (categories.isNotEmpty()) {
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(selected = selectedCategoryIds.isEmpty(), onClick = { selectedCategoryIds = emptySet() }, label = { Text("Todas") }) }
                items(categories, key = { it.id }) { category -> FilterChip(selected = category.id in selectedCategoryIds, onClick = { selectedCategoryIds = if (category.id in selectedCategoryIds) selectedCategoryIds - category.id else selectedCategoryIds + category.id }, label = { Text(category.name) }) }
            }
        }
        if (albums.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(stringResource(R.string.cloud_no_albums)) }
        else if (visibleAlbums.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No hay álbumes para estos filtros.") }
        else LazyVerticalGrid(GridCells.Fixed(2), Modifier.fillMaxSize(), contentPadding = PaddingValues(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { items(visibleAlbums, key = { it.id }) { album ->
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
