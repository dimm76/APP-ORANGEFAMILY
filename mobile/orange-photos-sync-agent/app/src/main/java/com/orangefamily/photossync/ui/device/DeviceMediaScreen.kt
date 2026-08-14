package com.orangefamily.photossync.ui.device

import android.os.Build
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.orangefamily.photossync.R
import com.orangefamily.photossync.data.CameraBackupRepository
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.data.UploadHeaderCounts
import com.orangefamily.photossync.device.*
import com.orangefamily.photossync.media.MediaPermissionAccess
import com.orangefamily.photossync.ui.SelectionActionItem
import com.orangefamily.photossync.ui.SelectionActionTray
import com.orangefamily.photossync.ui.theme.OrangePrimary
import com.orangefamily.photossync.sync.OrangePhotosUploadProgress
import com.orangefamily.photossync.sync.UploadProgressState
import com.orangefamily.photossync.sync.formatUploadBytes
import com.orangefamily.photossync.sync.uploadPercent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

private const val PAGE_SIZE=200
private enum class MediaFilter{ALL,PENDING,FAILED,UPLOADING}
private enum class DeviceMediaView{GRID,LIST}

val OrangeCloudShapeIcon:ImageVector by lazy{ImageVector.Builder("OrangeCloudShape",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(320f,367.79f);horizontalLineTo(396f);curveTo(451f,367.79f,496f,338.58f,496f,284.19f);curveTo(496f,229.8f,443f,202.72f,400f,200.59f);curveTo(391.11f,115.53f,329f,63.79f,256f,63.79f);curveTo(187f,63.79f,142.56f,109.58f,128f,154.99f);curveTo(68f,160.69f,16f,198.87f,16f,261.39f);curveTo(16f,323.91f,70f,367.79f,136f,367.79f);horizontalLineTo(192f)}}.build()}
val OrangeFilledCloudIcon:ImageVector by lazy{ImageVector.Builder("OrangeFilledCloud",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(OrangePrimary)){moveTo(19.35f,10.04f);curveTo(18.67f,6.59f,15.64f,4f,12f,4f);curveTo(9.11f,4f,6.6f,5.64f,5.35f,8.04f);curveTo(2.34f,8.36f,0f,10.9f,0f,14f);curveTo(0f,17.31f,2.69f,20f,6f,20f);horizontalLineTo(19f);curveTo(21.76f,20f,24f,17.76f,24f,15f);curveTo(24f,12.36f,21.95f,10.22f,19.35f,10.04f);close()}}.build()}
val OrangeUploadArrowIcon:ImageVector by lazy{ImageVector.Builder("OrangeUploadArrow",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(Color.White)){moveTo(12f,8f);lineTo(7f,13f);horizontalLineTo(10f);verticalLineTo(19f);horizontalLineTo(14f);verticalLineTo(13f);horizontalLineTo(17f);close()}}.build()}
val OrangeCloudUploadIcon:ImageVector by lazy{ImageVector.Builder("OrangeCloudUpload",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(320f,367.79f);horizontalLineTo(396f);curveTo(451f,367.79f,496f,338.58f,496f,284.19f);curveTo(496f,229.8f,443f,202.72f,400f,200.59f);curveTo(391.11f,115.53f,329f,63.79f,256f,63.79f);curveTo(187f,63.79f,142.56f,109.58f,128f,154.99f);curveTo(68f,160.69f,16f,198.87f,16f,261.39f);curveTo(16f,323.91f,70f,367.79f,136f,367.79f);horizontalLineTo(192f)};path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(320f,255.79f);lineTo(256f,191.79f);lineTo(192f,255.79f);moveTo(256f,448.21f);verticalLineTo(207.79f)}}.build()}

val OrangeDeleteIcon:ImageVector by lazy{ImageVector.Builder("OrangeDelete",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(112f,112f);lineTo(132f,432f);curveTo(132.95f,450.49f,146.4f,464f,164f,464f);horizontalLineTo(348f);curveTo(365.67f,464f,378.87f,450.49f,380f,432f);lineTo(400f,112f);moveTo(80f,112f);horizontalLineTo(432f);moveTo(192f,112f);verticalLineTo(72f);curveTo(192f,58.75f,202.75f,48f,216f,48f);horizontalLineTo(296f);curveTo(309.25f,48f,320f,58.75f,320f,72f);verticalLineTo(112f);moveTo(256f,176f);verticalLineTo(400f);moveTo(184f,176f);lineTo(192f,400f);moveTo(328f,176f);lineTo(320f,400f)}}.build()}

val OrangeRestoreIcon:ImageVector by lazy{ImageVector.Builder("OrangeRestore",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(240f,424f);verticalLineTo(328f);curveTo(356.4f,328f,399.39f,361.76f,448f,424f);curveTo(448f,304.77f,408.43f,184f,240f,184f);verticalLineTo(88f);lineTo(64f,256f);close()}}.build()}

val OrangeVerifyIcon:ImageVector by lazy{ImageVector.Builder("OrangeVerify",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(OrangePrimary),strokeLineWidth=2.5f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(5f,12.5f);lineTo(10f,17.5f);lineTo(19f,7f)}}.build()}
val OrangeListIcon:ImageVector by lazy{ImageVector.Builder("OrangeList",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=2f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round){moveTo(5f,6f);horizontalLineTo(19f);moveTo(5f,12f);horizontalLineTo(19f);moveTo(5f,18f);horizontalLineTo(19f)}}.build()}
val OrangeGridIcon:ImageVector by lazy{ImageVector.Builder("OrangeGrid",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=2f,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(4f,4f);horizontalLineTo(10f);verticalLineTo(10f);horizontalLineTo(4f);close();moveTo(14f,4f);horizontalLineTo(20f);verticalLineTo(10f);horizontalLineTo(14f);close();moveTo(4f,14f);horizontalLineTo(10f);verticalLineTo(20f);horizontalLineTo(4f);close();moveTo(14f,14f);horizontalLineTo(20f);verticalLineTo(20f);horizontalLineTo(14f);close()}}.build()}
val OrangeMoreIcon:ImageVector by lazy{ImageVector.Builder("OrangeMore",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=3f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round){moveTo(12f,5f);lineTo(12f,5.1f);moveTo(12f,12f);lineTo(12f,12.1f);moveTo(12f,19f);lineTo(12f,19.1f)}}.build()}
val OrangeShareIcon:ImageVector by lazy{ImageVector.Builder("OrangeShare",24.dp,24.dp,24f,24f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=2f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(8.6f,10.8f);lineTo(15.4f,7.2f);moveTo(8.6f,13.2f);lineTo(15.4f,16.8f)};path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=2f){moveTo(8.5f,12f);curveTo(8.5f,13.38f,7.38f,14.5f,6f,14.5f);curveTo(4.62f,14.5f,3.5f,13.38f,3.5f,12f);curveTo(3.5f,10.62f,4.62f,9.5f,6f,9.5f);curveTo(7.38f,9.5f,8.5f,10.62f,8.5f,12f);close();moveTo(20.5f,6f);curveTo(20.5f,7.38f,19.38f,8.5f,18f,8.5f);curveTo(16.62f,8.5f,15.5f,7.38f,15.5f,6f);curveTo(15.5f,4.62f,16.62f,3.5f,18f,3.5f);curveTo(19.38f,3.5f,20.5f,4.62f,20.5f,6f);close();moveTo(20.5f,18f);curveTo(20.5f,19.38f,19.38f,20.5f,18f,20.5f);curveTo(16.62f,20.5f,15.5f,19.38f,15.5f,18f);curveTo(15.5f,16.62f,16.62f,15.5f,18f,15.5f);curveTo(19.38f,15.5f,20.5f,16.62f,20.5f,18f);close()}}.build()}

@OptIn(ExperimentalMaterial3Api::class,ExperimentalFoundationApi::class)
@Composable fun DeviceMediaScreen(
    accountUserId:String,permission:MediaPermissionAccess,scanner:DeviceMediaStoreScanner,
    repository:CameraBackupRepository,verifier:DeviceMediaVerifier,thumbnailLoader:DeviceMediaThumbnailLoader,
    onSettings:()->Unit,onTrash:()->Unit,onOpen:(LocalMediaItem)->Unit,
    onUpload:(List<LocalMediaItem>,Boolean)->Unit,onSyncNow:()->Unit,onDelete:(List<LocalMediaItem>)->Unit,onDeleteTotal:(List<LocalMediaItem>)->Unit,
    refreshVersion:Int,
    librarySelector: @Composable () -> Unit,
    modifier:Modifier=Modifier,
){
    val scope=rememberCoroutineScope();val drawerState=rememberDrawerState(DrawerValue.Closed);val gridState=rememberLazyGridState();val listState=rememberLazyListState()
    var folders by remember(accountUserId){mutableStateOf(emptyList<DeviceMediaFolder>())};var folder by remember{mutableStateOf<DeviceMediaFolder?>(null)};var query by rememberSaveable{mutableStateOf("")};var media by remember{mutableStateOf(emptyList<LocalMediaItem>())};var visibleIds by remember{mutableStateOf(emptySet<String>())};var visibleOrder by remember{mutableStateOf(emptyList<String>())};var selected by remember{mutableStateOf(emptySet<String>())};var anchorId by remember{mutableStateOf<String?>(null)};var loadedCount by remember{mutableIntStateOf(0)};var hasMore by remember{mutableStateOf(false)};var loadingMore by remember{mutableStateOf(false)};var verifying by remember{mutableStateOf(false)};var uploadConfirmation by remember{mutableStateOf<List<LocalMediaItem>?>(null)};var deleteConfirmation by remember{mutableStateOf<List<LocalMediaItem>?>(null)};var totalDeleteConfirmation by remember{mutableStateOf<List<LocalMediaItem>?>(null)};var mediaFilter by rememberSaveable{mutableStateOf(MediaFilter.ALL)};var mediaSort by rememberSaveable{mutableStateOf(DeviceMediaSort.DATE_DESC)};var mediaView by rememberSaveable{mutableStateOf(DeviceMediaView.GRID)};var sortMenuExpanded by remember{mutableStateOf(false)};var showUploadProgress by remember{mutableStateOf(false)}
    val uploadProgress by OrangePhotosUploadProgress.state.collectAsState()
    val uploadCounts by repository.observeUploadHeaderCounts(accountUserId).collectAsState(initial=UploadHeaderCounts(0,0,0))
    fun loadFolders(){scope.launch{folders=withContext(Dispatchers.IO){scanner.scanFolders(accountUserId)}}}
    fun loadFirstPage(current:DeviceMediaFolder){scope.launch{loadedCount=0;media=emptyList();visibleIds=emptySet();visibleOrder=emptyList();selected=emptySet();anchorId=null;hasMore=false;loadingMore=true;try{val page=scanner.scanBucket(accountUserId,current.stableId,PAGE_SIZE,0,mediaSort);val importedPage=verifier.importBucket(page);visibleOrder=page.map(DeviceMediaRules::stableId);visibleIds=visibleOrder.toSet();loadedCount=page.size;hasMore=page.size==PAGE_SIZE;loadingMore=false;launch{verifier.verifyItems(importedPage)}}finally{loadingMore=false}}}
    fun loadNextPage(current:DeviceMediaFolder){if(!hasMore||loadingMore)return;scope.launch{loadingMore=true;try{val page=scanner.scanBucket(accountUserId,current.stableId,PAGE_SIZE,loadedCount,mediaSort);val pageIds=page.map(DeviceMediaRules::stableId);val importedPage=verifier.importBucket(page);visibleOrder+=pageIds;visibleIds+=pageIds;loadedCount+=page.size;hasMore=page.size==PAGE_SIZE;loadingMore=false;launch{verifier.verifyItems(importedPage)}}finally{loadingMore=false}}}
    LaunchedEffect(accountUserId,refreshVersion){loadFolders()}
    LaunchedEffect(uploadCounts){if(folder==null)loadFolders()}
    LaunchedEffect(folder?.stableId,refreshVersion,mediaSort){val current=folder?:return@LaunchedEffect;launch{repository.observeBucketItems(accountUserId,current.stableId).collectLatest{values->val order=visibleOrder.withIndex().associate{it.value to it.index};media=values.filter{val id=DeviceMediaRules.stableId(it);id in visibleIds||it.localStatus in setOf(LocalMediaItem.STATUS_PENDING,LocalMediaItem.STATUS_UPLOADING,LocalMediaItem.STATUS_FAILED)}.sortedBy{order[DeviceMediaRules.stableId(it)]?:Int.MAX_VALUE};selected=selected.intersect(media.map(DeviceMediaRules::stableId).toSet())}};loadFirstPage(current)}
    val filteredFolders=remember(folders,query){DeviceMediaRules.filterFolders(folders,query)}
    val displayedMedia=remember(media,mediaFilter){when(mediaFilter){MediaFilter.ALL->media;MediaFilter.PENDING->media.filter(DeviceMediaRules::isQueued);MediaFilter.FAILED->media.filter(DeviceMediaRules::isFailed);MediaFilter.UPLOADING->media.filter(DeviceMediaRules::isUploading)}}
    val selectedItems=remember(media,selected){media.filter{item->DeviceMediaRules.stableId(item) in selected}}
    val selectionHasCloudCopy=remember(selectedItems){selectedItems.any{it.cloudStatus==LocalMediaItem.CLOUD_BACKED_UP}}
    LaunchedEffect(gridState,folder?.stableId,mediaView){snapshotFlow{Triple(gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index?:0,displayedMedia.size,hasMore)}.map{(last,size,more)->mediaView==DeviceMediaView.GRID&&more&&last>=size-20}.distinctUntilChanged().collect{nearEnd->val current=folder;if(nearEnd&&current!=null)loadNextPage(current)}}
    LaunchedEffect(listState,folder?.stableId,mediaView){snapshotFlow{Triple(listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index?:0,displayedMedia.size,hasMore)}.map{(last,size,more)->mediaView==DeviceMediaView.LIST&&more&&last>=size-20}.distinctUntilChanged().collect{nearEnd->val current=folder;if(nearEnd&&current!=null)loadNextPage(current)}}
    fun toggleSelection(item:LocalMediaItem){val id=DeviceMediaRules.stableId(item);selected=if(id in selected)selected-id else selected+id;anchorId=id}
    fun extendSelection(item:LocalMediaItem,index:Int){val id=DeviceMediaRules.stableId(item);selected=selected+id;anchorId=id}
    fun onMediaClick(item:LocalMediaItem){if(selected.isEmpty())onOpen(item)else toggleSelection(item)}
    val uploadStatusAction:@Composable RowScope.()->Unit={UploadStatusAction(uploadCounts.pending>0||uploadCounts.uploading>0||uploadProgress.running,uploadCounts.uploading>0||uploadProgress.running){showUploadProgress=true}}
    val selectionActions=buildList {
        add(SelectionActionItem("upload",stringResource(R.string.selection_upload_cloud),onClick={uploadConfirmation=selectedItems}){Icon(OrangeCloudUploadIcon,null,Modifier.size(26.dp))})
        add(SelectionActionItem("delete-device",stringResource(R.string.selection_delete_device),onClick={deleteConfirmation=selectedItems}){Icon(OrangeDeleteIcon,null,Modifier.size(26.dp))})
        if(selectionHasCloudCopy)add(SelectionActionItem("delete-total",stringResource(R.string.selection_delete_total),enabled=true,onClick={totalDeleteConfirmation=selectedItems}){Box(Modifier.size(30.dp)){Icon(OrangeDeleteIcon,null,Modifier.size(24.dp).align(Alignment.BottomStart));Icon(OrangeFilledCloudIcon,null,Modifier.size(14.dp).align(Alignment.TopEnd),tint=Color.Unspecified)}})
        add(SelectionActionItem("share",stringResource(R.string.selection_share),enabled=false,onClick={}){Icon(OrangeShareIcon,null,Modifier.size(26.dp))})
    }

    ModalNavigationDrawer(drawerState=drawerState,gesturesEnabled=folder==null,drawerContent={ModalDrawerSheet{Spacer(Modifier.height(20.dp));NavigationDrawerItem(label={Text(stringResource(R.string.settings_title))},selected=false,onClick={scope.launch{drawerState.close()};onSettings()},icon={Text("⚙")});NavigationDrawerItem(label={Text(stringResource(R.string.trash_title))},selected=false,onClick={scope.launch{drawerState.close()};onTrash()},icon={Icon(OrangeDeleteIcon,null,Modifier.size(24.dp))})}}){
        Scaffold(modifier=modifier,topBar={if(selected.isNotEmpty())SelectionTopBar(count=selected.size,onClose={selected=emptySet();anchorId=null})else if(folder==null)FolderListTopBar(query,{query=it},{scope.launch{drawerState.open()}},librarySelector,uploadStatusAction)else FolderTopBar(folder!!.name,{folder=null;loadFolders()},{val current=folder?:return@FolderTopBar;scope.launch{verifying=true;try{verifier.verifyBucket(accountUserId,current.stableId,true)}finally{verifying=false}}},verifying,mediaView,{mediaView=if(mediaView==DeviceMediaView.GRID)DeviceMediaView.LIST else DeviceMediaView.GRID},sortMenuExpanded,{sortMenuExpanded=it},{mediaSort=it},uploadStatusAction)},bottomBar={if(selectedItems.isNotEmpty())SelectionActionTray(actions=selectionActions,reopenKey=selected)}){padding->
            Column(Modifier.padding(padding).fillMaxSize()){
                if(permission==MediaPermissionAccess.PARTIAL)Text("Acceso parcial: solo se muestran los elementos autorizados.",Modifier.padding(12.dp))
                if(folder==null)LazyColumn{items(filteredFolders,key={it.stableId}){value->Card(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=5.dp).combinedClickable(onClick={folder=value})){Column(Modifier.padding(16.dp)){Text(value.name,style=MaterialTheme.typography.titleMedium);Text("${value.itemCount} elementos${if(value.containsVideo)" · incluye vídeo" else ""}")}}}}
                else{Row(Modifier.fillMaxWidth().padding(horizontal=8.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(selected=mediaFilter==MediaFilter.ALL,onClick={mediaFilter=MediaFilter.ALL},label={Text(stringResource(R.string.all_filter))});FilterChip(selected=mediaFilter==MediaFilter.PENDING,onClick={mediaFilter=MediaFilter.PENDING},label={Text(stringResource(R.string.pending_filter))});if(media.any(DeviceMediaRules::isFailed))FilterChip(selected=mediaFilter==MediaFilter.FAILED,onClick={mediaFilter=MediaFilter.FAILED},label={Text(stringResource(R.string.failed_filter))});if(media.any(DeviceMediaRules::isUploading))FilterChip(selected=mediaFilter==MediaFilter.UPLOADING,onClick={mediaFilter=MediaFilter.UPLOADING},label={Text(stringResource(R.string.uploading_filter))})};if(mediaView==DeviceMediaView.GRID)LazyVerticalGrid(GridCells.Adaptive(112.dp),state=gridState,modifier=Modifier.fillMaxSize(),contentPadding=PaddingValues(4.dp),horizontalArrangement=Arrangement.spacedBy(4.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){itemsIndexed(displayedMedia,key={_,item->DeviceMediaRules.stableId(item)}){index,item->val id=DeviceMediaRules.stableId(item);DeviceMediaCard(item,id in selected,selected.isNotEmpty(),thumbnailLoader,Modifier.combinedClickable(onClick={onMediaClick(item)},onLongClick={extendSelection(item,index)}))}}else LazyColumn(state=listState,modifier=Modifier.fillMaxSize()){itemsIndexed(displayedMedia,key={_,item->DeviceMediaRules.stableId(item)}){index,item->val id=DeviceMediaRules.stableId(item);DeviceMediaRow(item,id in selected,selected.isNotEmpty(),thumbnailLoader,Modifier.combinedClickable(onClick={onMediaClick(item)},onLongClick={extendSelection(item,index)}));HorizontalDivider()}}}
            }
        }
    }
    UploadDialog(uploadConfirmation,{uploadConfirmation=null},{values,force->onUpload(values,force);selected=emptySet();uploadConfirmation=null},{val current=folder?:return@UploadDialog;scope.launch{verifying=true;try{verifier.verifyBucket(accountUserId,current.stableId,true)}finally{verifying=false}}})
    DeleteDialog(deleteConfirmation,{deleteConfirmation=null},{values->onDelete(values);selected=emptySet();deleteConfirmation=null})
    TotalDeleteDialog(totalDeleteConfirmation,{totalDeleteConfirmation=null},onDeleteTotal)
    if(showUploadProgress)UploadProgressDialog(uploadProgress,uploadCounts,folder!=null,{showUploadProgress=false},{showUploadProgress=false;onSyncNow()},{showUploadProgress=false;mediaFilter=MediaFilter.FAILED})
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FolderListTopBar(
    query: String,
    onQuery: (String) -> Unit,
    onMenu: () -> Unit,
    librarySelector: @Composable () -> Unit,
    actions: @Composable RowScope.() -> Unit,
) {
    TopAppBar(
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                librarySelector()
                OutlinedTextField(
                    value = query,
                    onValueChange = onQuery,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(stringResource(R.string.search_folders)) },
                    singleLine = true,
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { onQuery("") }, modifier = Modifier.semantics { contentDescription = "Borrar búsqueda" }) {
                                Text("×")
                            }
                        }
                    },
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onMenu, modifier = Modifier.semantics { contentDescription = "Abrir menú" }) {
                Text("☰", style = MaterialTheme.typography.titleLarge)
            }
        },
        actions = actions,
    )
}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun FolderTopBar(name:String,onBack:()->Unit,onVerify:()->Unit,verifying:Boolean,mediaView:DeviceMediaView,onToggleView:()->Unit,sortMenuExpanded:Boolean,onSortMenuExpandedChange:(Boolean)->Unit,onSortSelected:(DeviceMediaSort)->Unit,actions:@Composable RowScope.()->Unit){val verifyDescription=stringResource(R.string.verify_copies);val viewDescription=stringResource(if(mediaView==DeviceMediaView.GRID)R.string.show_list_view else R.string.show_grid_view);val sortDescription=stringResource(R.string.sort_options);TopAppBar(title={Text(name)},navigationIcon={IconButton(onClick=onBack,modifier=Modifier.semantics{contentDescription="Volver"}){Text("←",style=MaterialTheme.typography.titleLarge)}},actions={if(verifying)CircularProgressIndicator(Modifier.padding(horizontal=12.dp).size(22.dp),strokeWidth=2.dp,color=OrangePrimary)else IconButton(onClick=onVerify,modifier=Modifier.semantics{contentDescription=verifyDescription}){Icon(OrangeVerifyIcon,null,tint=Color.Unspecified)};actions();IconButton(onClick=onToggleView,modifier=Modifier.semantics{contentDescription=viewDescription}){Icon(if(mediaView==DeviceMediaView.GRID)OrangeListIcon else OrangeGridIcon,null)};Box{IconButton(onClick={onSortMenuExpandedChange(true)},modifier=Modifier.semantics{contentDescription=sortDescription}){Icon(OrangeMoreIcon,null)};DropdownMenu(expanded=sortMenuExpanded,onDismissRequest={onSortMenuExpandedChange(false)}){DropdownMenuItem(text={Text(stringResource(R.string.sort_date_desc))},onClick={onSortSelected(DeviceMediaSort.DATE_DESC);onSortMenuExpandedChange(false)});DropdownMenuItem(text={Text(stringResource(R.string.sort_date_asc))},onClick={onSortSelected(DeviceMediaSort.DATE_ASC);onSortMenuExpandedChange(false)});DropdownMenuItem(text={Text(stringResource(R.string.sort_size_desc))},onClick={onSortSelected(DeviceMediaSort.SIZE_DESC);onSortMenuExpandedChange(false)});DropdownMenuItem(text={Text(stringResource(R.string.sort_size_asc))},onClick={onSortSelected(DeviceMediaSort.SIZE_ASC);onSortMenuExpandedChange(false)});DropdownMenuItem(text={Text(stringResource(R.string.sort_name_asc))},onClick={onSortSelected(DeviceMediaSort.NAME_ASC);onSortMenuExpandedChange(false)});DropdownMenuItem(text={Text(stringResource(R.string.sort_name_desc))},onClick={onSortSelected(DeviceMediaSort.NAME_DESC);onSortMenuExpandedChange(false)})}}})}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun SelectionTopBar(count:Int,onClose:()->Unit){TopAppBar(title={Text(text=count.toString(),style=MaterialTheme.typography.titleMedium)},navigationIcon={IconButton(onClick=onClose,modifier=Modifier.semantics{contentDescription="Cerrar selección"}){Text("×",style=MaterialTheme.typography.titleLarge)}})}

@Composable private fun UploadStatusAction(visible:Boolean,active:Boolean,onClick:()->Unit){if(visible)IconButton(onClick=onClick){Box(Modifier.size(28.dp),contentAlignment=Alignment.Center){Icon(OrangeCloudUploadIcon,stringResource(R.string.upload_progress_title),Modifier.size(24.dp),tint=OrangePrimary);if(active)CircularProgressIndicator(Modifier.fillMaxSize(),strokeWidth=2.dp,color=OrangePrimary)}}}

@Composable private fun BackedUpCloudIcon(modifier:Modifier=Modifier,contentDescription:String?="Subido a OrangeFamily"){Box(modifier,contentAlignment=Alignment.Center){Icon(OrangeFilledCloudIcon,contentDescription,Modifier.fillMaxSize(),tint=Color.Unspecified);Icon(OrangeUploadArrowIcon,null,Modifier.fillMaxSize(),tint=Color.White)}}

@Composable private fun UploadProgressDialog(state:UploadProgressState,counts:UploadHeaderCounts,insideFolder:Boolean,onDismiss:()->Unit,onSyncNow:()->Unit,onViewFailed:()->Unit){val pending=counts.pending;val title=when{state.running->R.string.upload_progress_title;pending>0->R.string.upload_pending_title;else->R.string.upload_finished_title};AlertDialog(onDismissRequest=onDismiss,title={Text(stringResource(title))},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){if(state.running){state.displayName?.let{Text(it,maxLines=2,overflow=TextOverflow.Ellipsis)};val fraction=if(state.totalBytes>0)state.bytesSent.toFloat()/state.totalBytes else 0f;LinearProgressIndicator(progress={fraction.coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth());Text("${uploadPercent(state.bytesSent,state.totalBytes)} %");Text("${formatUploadBytes(state.bytesSent)} de ${formatUploadBytes(state.totalBytes)}")};Text(stringResource(R.string.upload_total_count,state.totalThisRun));Text(stringResource(R.string.upload_completed_count,state.completedThisRun));Text(stringResource(R.string.upload_failed_count,state.failedThisRun));Text(stringResource(R.string.upload_pending_count,state.pendingThisRun));if(state.deferredByNetwork>0)Text(stringResource(R.string.upload_waiting_wifi_count,state.deferredByNetwork));if(counts.failed>0)Text(stringResource(R.string.upload_needs_attention,counts.failed))}},confirmButton={Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(8.dp)){if(!state.running&&pending>0)Button(onClick=onSyncNow,Modifier.fillMaxWidth()){Text(stringResource(R.string.upload_sync_now))};if(insideFolder&&counts.failed>0)OutlinedButton(onClick=onViewFailed,Modifier.fillMaxWidth()){Text(stringResource(R.string.upload_view_failed))};TextButton(onClick=onDismiss,Modifier.align(Alignment.End)){Text(stringResource(R.string.close_action))}}},dismissButton={})}

@Composable private fun DeviceMediaCard(item:LocalMediaItem,selected:Boolean,selectionMode:Boolean,loader:DeviceMediaThumbnailLoader,modifier:Modifier){val shape=RoundedCornerShape(12.dp);Box(modifier.aspectRatio(1f).background(if(selected)MaterialTheme.colorScheme.primaryContainer else Color.Transparent,shape).padding(if(selected)5.dp else 0.dp).clip(shape)){DeviceMediaThumbnail(item,loader,Modifier.fillMaxSize());if(selectionMode)Box(Modifier.align(Alignment.TopStart).padding(6.dp).size(24.dp).background(if(selected)OrangePrimary else Color.Transparent,CircleShape).border(2.dp,if(selected)OrangePrimary else Color.White,CircleShape),contentAlignment=Alignment.Center){if(selected)Text("✓",color=Color.White)};Row(Modifier.align(Alignment.TopEnd).padding(6.dp).background(Color.Black.copy(alpha=.55f),RoundedCornerShape(4.dp)).padding(3.dp)){if(item.mediaType==LocalMediaItem.TYPE_VIDEO)Text("VÍDEO",color=Color.White);CloudStatusBadge(item.cloudStatus)};Text(item.displayName,maxLines=1,overflow=TextOverflow.Ellipsis,color=Color.White,modifier=Modifier.align(Alignment.BottomStart).fillMaxWidth().background(Color.Black.copy(alpha=.6f)).padding(5.dp))}}
@Composable private fun DeviceMediaRow(item:LocalMediaItem,selected:Boolean,selectionMode:Boolean,loader:DeviceMediaThumbnailLoader,modifier:Modifier=Modifier){Row(modifier.fillMaxWidth().heightIn(min=76.dp).background(if(selected)MaterialTheme.colorScheme.primaryContainer else Color.Transparent).padding(horizontal=12.dp,vertical=6.dp),verticalAlignment=Alignment.CenterVertically){DeviceMediaThumbnail(item,loader,Modifier.size(64.dp).clip(RoundedCornerShape(8.dp)));Spacer(Modifier.width(12.dp));Column(Modifier.weight(1f)){Text(item.displayName,maxLines=2,overflow=TextOverflow.Ellipsis);Text(formatFileSize(item.sizeBytes),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)};Box(Modifier.size(32.dp),contentAlignment=Alignment.Center){if(selectionMode)SelectionIndicator(selected,MaterialTheme.colorScheme.outline)};Box(Modifier.size(28.dp),contentAlignment=Alignment.Center){CloudStatusBadge(item.cloudStatus)}}}
@Composable private fun SelectionIndicator(selected:Boolean,outline:Color){Box(Modifier.size(24.dp).background(if(selected)OrangePrimary else Color.Transparent,CircleShape).border(2.dp,if(selected)OrangePrimary else outline,CircleShape),contentAlignment=Alignment.Center){if(selected)Text("✓",color=Color.White)}}
@Composable private fun DeviceMediaThumbnail(item:LocalMediaItem,loader:DeviceMediaThumbnailLoader,modifier:Modifier){var bitmap by remember(item.contentUri){mutableStateOf<android.graphics.Bitmap?>(null)};LaunchedEffect(item.contentUri){bitmap=loader.load(item.contentUri)};if(bitmap!=null)androidx.compose.foundation.Image(bitmap!!.asImageBitmap(),item.displayName,modifier,contentScale=ContentScale.Crop)else Box(modifier,contentAlignment=Alignment.Center){Text(if(item.mediaType==LocalMediaItem.TYPE_VIDEO)"Vídeo" else "Imagen")}}
@Composable private fun CloudStatusBadge(status:String){when(status){LocalMediaItem.CLOUD_BACKED_UP->BackedUpCloudIcon(Modifier.size(20.dp));LocalMediaItem.CLOUD_POSSIBLE_MATCH->Icon(OrangeCloudShapeIcon,"Posible copia en OrangeFamily",Modifier.size(18.dp),tint=Color.White);LocalMediaItem.CLOUD_CHECKING->Text("…",color=Color.White);LocalMediaItem.CLOUD_REMOTE_MISSING,LocalMediaItem.CLOUD_ERROR->Text("!",color=MaterialTheme.colorScheme.error)}}
private fun formatFileSize(sizeBytes:Long):String=when{sizeBytes<1024->"$sizeBytes B";sizeBytes<1024L*1024->String.format(Locale.getDefault(),"%.1f KB",sizeBytes/1024.0);sizeBytes<1024L*1024*1024->String.format(Locale.getDefault(),"%.1f MB",sizeBytes/(1024.0*1024.0));else->String.format(Locale.getDefault(),"%.2f GB",sizeBytes/(1024.0*1024.0*1024.0))}

@Composable private fun UploadDialog(values:List<LocalMediaItem>?,onDismiss:()->Unit,onUpload:(List<LocalMediaItem>,Boolean)->Unit,onVerify:()->Unit){values?:return;val failed=values.filter(DeviceMediaRules::isFailed);val backed=DeviceMediaRules.safeItems(values);val unresolved=values.filter(DeviceMediaRules::isVerificationPending);when{failed.isNotEmpty()->{val large=failed.count{it.mediaType==LocalMediaItem.TYPE_VIDEO&&it.sizeBytes>500L*1024L*1024L};AlertDialog(onDismissRequest=onDismiss,title={Text(stringResource(R.string.retry_failed_uploads))},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text(stringResource(R.string.retry_failed_message,failed.size));if(large>0)Text(stringResource(R.string.retry_unsupported_large_videos,large),color=MaterialTheme.colorScheme.error)}},confirmButton={Button(onClick={onUpload(failed,false)}){Text(stringResource(R.string.retry_failed_uploads))}},dismissButton={OutlinedButton(onClick=onDismiss){Text(stringResource(R.string.cancel))}})};unresolved.isNotEmpty()->AlertDialog(onDismissRequest=onDismiss,title={Text("Verificación pendiente")},text={Text("Todavía se están verificando ${unresolved.size} elementos.")},confirmButton={TextButton(onClick={onDismiss();onVerify()}){Text(stringResource(R.string.verify_action))}},dismissButton={TextButton(onClick=onDismiss){Text(stringResource(R.string.cancel))}});backed.isNotEmpty()->AlertDialog(onDismissRequest=onDismiss,title={Text(stringResource(R.string.duplicate_upload_title))},text={Text(stringResource(if(backed.size==1)R.string.duplicate_upload_message_single else R.string.duplicate_upload_message_multiple))},confirmButton={Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(8.dp)){Button(onClick={onUpload(values,true)},modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(stringResource(R.string.upload_again))};OutlinedButton(onClick=onDismiss,modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(stringResource(R.string.cancel))}}},dismissButton={});else->AlertDialog(onDismissRequest=onDismiss,title={Text("Confirmar subida")},text={Text("Subir ${values.size} elementos a OrangeFamily.")},confirmButton={TextButton(onClick={onUpload(values,false)}){Text(stringResource(R.string.upload_action))}},dismissButton={TextButton(onClick=onDismiss){Text(stringResource(R.string.cancel))}})}}
@Composable private fun DeleteDialog(values:List<LocalMediaItem>?,onDismiss:()->Unit,onDelete:(List<LocalMediaItem>)->Unit){values?:return;val safe=DeviceMediaRules.safeItems(values);val unsafe=values.filterNot(DeviceMediaRules::safeToDelete);val legacy=Build.VERSION.SDK_INT<Build.VERSION_CODES.R;val count=values.size;AlertDialog(onDismissRequest=onDismiss,title={Text(stringResource(if(legacy)R.string.delete_forever else R.string.trash_title))},text={Text(if(legacy)"Se eliminarán definitivamente $count elementos del dispositivo." else if(count==1)"Se moverá 1 elemento a la papelera del dispositivo. La copia de OrangeFamily no se modificará." else "Se moverán $count elementos a la papelera del dispositivo. Las copias de OrangeFamily no se modificarán.")},confirmButton={Column{if(!legacy&&safe.isNotEmpty()&&unsafe.isNotEmpty())TextButton(onClick={onDelete(safe)}){Text("Mover solo respaldados")};TextButton(onClick={onDelete(values)}){Text(stringResource(R.string.delete_action))}}},dismissButton={TextButton(onClick=onDismiss){Text("Cancelar")}})}
@Composable private fun TotalDeleteDialog(values:List<LocalMediaItem>?,onDismiss:()->Unit,onDelete:(List<LocalMediaItem>)->Unit){values?:return;val cloudCount=values.count{it.cloudStatus==LocalMediaItem.CLOUD_BACKED_UP};val legacy=Build.VERSION.SDK_INT<Build.VERSION_CODES.R;AlertDialog(onDismissRequest=onDismiss,title={Text("Borrado total")},text={Text(if(legacy)"Se eliminarán definitivamente ${values.size} elementos del dispositivo y se moverán $cloudCount copias de OrangeFamily a su papelera." else "Se moverán ${values.size} elementos a la papelera del dispositivo y $cloudCount copias de OrangeFamily a su papelera.")},confirmButton={TextButton(onClick={onDismiss();onDelete(values)}){Text("Borrar de ambos")}},dismissButton={TextButton(onClick=onDismiss){Text("Cancelar")}})}
