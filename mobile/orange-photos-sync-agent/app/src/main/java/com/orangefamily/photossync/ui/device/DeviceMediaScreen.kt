package com.orangefamily.photossync.ui.device

import android.os.Build
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.orangefamily.photossync.device.*
import com.orangefamily.photossync.media.MediaPermissionAccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val PAGE_SIZE=200

val OrangeCloudUploadIcon:ImageVector by lazy{ImageVector.Builder("OrangeCloudUpload",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(320f,367.79f);horizontalLineTo(396f);curveTo(451f,367.79f,496f,338.58f,496f,284.19f);curveTo(496f,229.8f,443f,202.72f,400f,200.59f);curveTo(391.11f,115.53f,329f,63.79f,256f,63.79f);curveTo(187f,63.79f,142.56f,109.58f,128f,154.99f);curveTo(68f,160.69f,16f,198.87f,16f,261.39f);curveTo(16f,323.91f,70f,367.79f,136f,367.79f);horizontalLineTo(192f)};path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(320f,255.79f);lineTo(256f,191.79f);lineTo(192f,255.79f);moveTo(256f,448.21f);verticalLineTo(207.79f)}}.build()}

val OrangeDeleteIcon:ImageVector by lazy{ImageVector.Builder("OrangeDelete",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineCap=androidx.compose.ui.graphics.StrokeCap.Round,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(112f,112f);lineTo(132f,432f);curveTo(132.95f,450.49f,146.4f,464f,164f,464f);horizontalLineTo(348f);curveTo(365.67f,464f,378.87f,450.49f,380f,432f);lineTo(400f,112f);moveTo(80f,112f);horizontalLineTo(432f);moveTo(192f,112f);verticalLineTo(72f);curveTo(192f,58.75f,202.75f,48f,216f,48f);horizontalLineTo(296f);curveTo(309.25f,48f,320f,58.75f,320f,72f);verticalLineTo(112f);moveTo(256f,176f);verticalLineTo(400f);moveTo(184f,176f);lineTo(192f,400f);moveTo(328f,176f);lineTo(320f,400f)}}.build()}

val OrangeRestoreIcon:ImageVector by lazy{ImageVector.Builder("OrangeRestore",24.dp,24.dp,512f,512f).apply{path(fill=SolidColor(Color.Transparent),stroke=SolidColor(Color.Black),strokeLineWidth=32f,strokeLineJoin=androidx.compose.ui.graphics.StrokeJoin.Round){moveTo(240f,424f);verticalLineTo(328f);curveTo(356.4f,328f,399.39f,361.76f,448f,424f);curveTo(448f,304.77f,408.43f,184f,240f,184f);verticalLineTo(88f);lineTo(64f,256f);close()}}.build()}

@OptIn(ExperimentalMaterial3Api::class,ExperimentalFoundationApi::class)
@Composable fun DeviceMediaScreen(
    accountUserId:String,permission:MediaPermissionAccess,scanner:DeviceMediaStoreScanner,
    repository:CameraBackupRepository,verifier:DeviceMediaVerifier,thumbnailLoader:DeviceMediaThumbnailLoader,
    onSettings:()->Unit,onTrash:()->Unit,onOpen:(LocalMediaItem)->Unit,
    onUpload:(List<LocalMediaItem>,Boolean)->Unit,onDelete:(List<LocalMediaItem>)->Unit,
    refreshVersion:Int,
    modifier:Modifier=Modifier,
){
    val scope=rememberCoroutineScope();val drawerState=rememberDrawerState(DrawerValue.Closed);val gridState=rememberLazyGridState()
    var folders by remember(accountUserId){mutableStateOf(emptyList<DeviceMediaFolder>())};var folder by remember{mutableStateOf<DeviceMediaFolder?>(null)};var query by rememberSaveable{mutableStateOf("")};var media by remember{mutableStateOf(emptyList<LocalMediaItem>())};var visibleIds by remember{mutableStateOf(emptySet<String>())};var selected by remember{mutableStateOf(emptySet<String>())};var anchorId by remember{mutableStateOf<String?>(null)};var loadedCount by remember{mutableIntStateOf(0)};var hasMore by remember{mutableStateOf(false)};var loadingMore by remember{mutableStateOf(false)};var verifying by remember{mutableStateOf(false)};var uploadConfirmation by remember{mutableStateOf<List<LocalMediaItem>?>(null)};var deleteConfirmation by remember{mutableStateOf<List<LocalMediaItem>?>(null)}
    fun loadFolders(){scope.launch{folders=withContext(Dispatchers.IO){scanner.scanFolders(accountUserId)}}}
    LaunchedEffect(accountUserId,refreshVersion){loadFolders()}
    LaunchedEffect(folder?.stableId,refreshVersion){val current=folder?:return@LaunchedEffect;loadedCount=0;media=emptyList();visibleIds=emptySet();selected=emptySet();anchorId=null;launch{repository.observeBucketItems(accountUserId,current.stableId).collectLatest{values->media=values.filter{DeviceMediaRules.stableId(it) in visibleIds};selected=selected.intersect(media.map(DeviceMediaRules::stableId).toSet())}};val page=scanner.scanBucket(accountUserId,current.stableId,PAGE_SIZE,0);visibleIds=page.map(DeviceMediaRules::stableId).toSet();verifier.importBucket(page);loadedCount=page.size;hasMore=page.size==PAGE_SIZE;verifying=true;try{verifier.verifyBucket(accountUserId,current.stableId)}finally{verifying=false}}
    LaunchedEffect(gridState,folder?.stableId){snapshotFlow{gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index?:0}.map{it>=media.size-20}.distinctUntilChanged().collect{nearEnd->val current=folder;if(nearEnd&&current!=null&&hasMore&&!loadingMore){loadingMore=true;val page=scanner.scanBucket(accountUserId,current.stableId,PAGE_SIZE,loadedCount);visibleIds+=page.map(DeviceMediaRules::stableId);verifier.importBucket(page);loadedCount+=page.size;hasMore=page.size==PAGE_SIZE;verifier.verifyBucket(accountUserId,current.stableId);loadingMore=false}}}
    val filteredFolders=remember(folders,query){DeviceMediaRules.filterFolders(folders,query)}

    ModalNavigationDrawer(drawerState=drawerState,gesturesEnabled=folder==null,drawerContent={ModalDrawerSheet{Spacer(Modifier.height(20.dp));NavigationDrawerItem(label={Text(stringResource(R.string.settings_title))},selected=false,onClick={scope.launch{drawerState.close()};onSettings()},icon={Text("⚙")});NavigationDrawerItem(label={Text(stringResource(R.string.trash_title))},selected=false,onClick={scope.launch{drawerState.close()};onTrash()},icon={Text("⌫")})}}){
        Scaffold(modifier=modifier,topBar={if(selected.isNotEmpty())SelectionTopBar(selected.size,{selected=emptySet();anchorId=null},{uploadConfirmation=media.filter{DeviceMediaRules.stableId(it) in selected}},{deleteConfirmation=media.filter{DeviceMediaRules.stableId(it) in selected}})else if(folder==null)FolderListTopBar(query,{query=it},{scope.launch{drawerState.open()}})else FolderTopBar(folder!!.name,{folder=null;loadFolders()},{val current=folder?:return@FolderTopBar;scope.launch{verifying=true;try{verifier.verifyBucket(accountUserId,current.stableId,true)}finally{verifying=false}}},verifying)}){padding->
            Column(Modifier.padding(padding).fillMaxSize()){
                if(permission==MediaPermissionAccess.PARTIAL)Text("Acceso parcial: solo se muestran los elementos autorizados.",Modifier.padding(12.dp))
                if(folder==null)LazyColumn{items(filteredFolders,key={it.stableId}){value->Card(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=5.dp).combinedClickable(onClick={folder=value})){Column(Modifier.padding(16.dp)){Text(value.name,style=MaterialTheme.typography.titleMedium);Text("${value.itemCount} elementos${if(value.containsVideo)" · incluye vídeo" else ""}")}}}}
                else{Row(Modifier.fillMaxWidth().padding(horizontal=8.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(selected=false,onClick={selected=media.map(DeviceMediaRules::stableId).toSet()},label={Text(stringResource(R.string.all_filter))});FilterChip(selected=false,onClick={selected=media.filter(DeviceMediaRules::isPending).map(DeviceMediaRules::stableId).toSet()},label={Text(stringResource(R.string.pending_filter))})};LazyVerticalGrid(GridCells.Adaptive(112.dp),state=gridState,modifier=Modifier.fillMaxSize(),contentPadding=PaddingValues(4.dp),horizontalArrangement=Arrangement.spacedBy(4.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){itemsIndexed(media,key={_,item->DeviceMediaRules.stableId(item)}){index,item->val id=DeviceMediaRules.stableId(item);DeviceMediaCard(item,id in selected,selected.isNotEmpty(),thumbnailLoader,Modifier.combinedClickable(onClick={if(selected.isEmpty())onOpen(item)else{selected=if(id in selected)selected-id else selected+id;anchorId=id}},onLongClick={val anchorIndex=anchorId?.let{anchor->media.indexOfFirst{DeviceMediaRules.stableId(it)==anchor}.takeIf{it>=0}};selected=if(selected.isEmpty()){anchorId=id;setOf(id)}else if(anchorIndex==null){anchorId=id;selected+id}else{anchorId=id;selected+DeviceMediaRules.range(media,anchorIndex,index)}}))}}}
            }
        }
    }
    UploadDialog(uploadConfirmation,{uploadConfirmation=null},{values,force->onUpload(values,force);selected=emptySet();uploadConfirmation=null},{val current=folder?:return@UploadDialog;scope.launch{verifying=true;try{verifier.verifyBucket(accountUserId,current.stableId,true)}finally{verifying=false}}})
    DeleteDialog(deleteConfirmation,{deleteConfirmation=null},{values->onDelete(values);selected=emptySet();deleteConfirmation=null})
}

@OptIn(ExperimentalMaterial3Api::class) @Composable private fun FolderListTopBar(query:String,onQuery:(String)->Unit,onMenu:()->Unit){TopAppBar(title={OutlinedTextField(query,onQuery,Modifier.fillMaxWidth(),placeholder={Text(stringResource(R.string.search_folders))},singleLine=true,trailingIcon={if(query.isNotEmpty())IconButton(onClick={onQuery("")},modifier=Modifier.semantics{contentDescription="Borrar búsqueda"}){Text("×")}})},navigationIcon={IconButton(onClick=onMenu,modifier=Modifier.semantics{contentDescription="Abrir menú"}){Text("☰",style=MaterialTheme.typography.titleLarge)}})}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun FolderTopBar(name:String,onBack:()->Unit,onVerify:()->Unit,verifying:Boolean){TopAppBar(title={Text(name)},navigationIcon={IconButton(onClick=onBack,modifier=Modifier.semantics{contentDescription="Volver"}){Text("←",style=MaterialTheme.typography.titleLarge)}},actions={TextButton(onClick=onVerify,enabled=!verifying){Text(stringResource(if(verifying)R.string.verifying_status else R.string.verify_action))}})}
@OptIn(ExperimentalMaterial3Api::class) @Composable private fun SelectionTopBar(count:Int,onClose:()->Unit,onUpload:()->Unit,onDelete:()->Unit){TopAppBar(title={Text(pluralStringResource(R.plurals.selected_media_count,count,count))},navigationIcon={IconButton(onClick=onClose,modifier=Modifier.semantics{contentDescription="Cerrar selección"}){Text("×",style=MaterialTheme.typography.titleLarge)}},actions={IconButton(onClick=onUpload){Icon(OrangeCloudUploadIcon,stringResource(R.string.upload_action),Modifier.size(24.dp))};IconButton(onClick=onDelete){Icon(OrangeDeleteIcon,stringResource(R.string.delete_action),Modifier.size(24.dp))}})}

@Composable private fun DeviceMediaCard(item:LocalMediaItem,selected:Boolean,selectionMode:Boolean,loader:DeviceMediaThumbnailLoader,modifier:Modifier){val shape=RoundedCornerShape(12.dp);Box(modifier.aspectRatio(1f).background(if(selected)MaterialTheme.colorScheme.primaryContainer else Color.Transparent,shape).padding(if(selected)5.dp else 0.dp).clip(shape)){DeviceMediaThumbnail(item,loader,Modifier.fillMaxSize());if(selectionMode)Box(Modifier.align(Alignment.TopStart).padding(6.dp).size(24.dp).background(if(selected)Color.White else Color.Transparent,CircleShape).border(2.dp,if(selected)MaterialTheme.colorScheme.primary else Color.White,CircleShape),contentAlignment=Alignment.Center){if(selected)Text("✓",color=MaterialTheme.colorScheme.primary)};Row(Modifier.align(Alignment.TopEnd).padding(6.dp).background(Color.Black.copy(alpha=.55f),RoundedCornerShape(4.dp)).padding(3.dp)){if(item.mediaType==LocalMediaItem.TYPE_VIDEO)Text("VÍDEO",color=Color.White);CloudStatusBadge(item.cloudStatus)};Text(item.displayName,maxLines=1,overflow=TextOverflow.Ellipsis,color=Color.White,modifier=Modifier.align(Alignment.BottomStart).fillMaxWidth().background(Color.Black.copy(alpha=.6f)).padding(5.dp))}}
@Composable private fun DeviceMediaThumbnail(item:LocalMediaItem,loader:DeviceMediaThumbnailLoader,modifier:Modifier){var bitmap by remember(item.contentUri){mutableStateOf<android.graphics.Bitmap?>(null)};LaunchedEffect(item.contentUri){bitmap=loader.load(item.contentUri)};if(bitmap!=null)androidx.compose.foundation.Image(bitmap!!.asImageBitmap(),item.displayName,modifier,contentScale=ContentScale.Crop)else Box(modifier,contentAlignment=Alignment.Center){Text(if(item.mediaType==LocalMediaItem.TYPE_VIDEO)"Vídeo" else "Imagen")}}
@Composable private fun CloudStatusBadge(status:String){val label=when(status){LocalMediaItem.CLOUD_BACKED_UP->"☁";LocalMediaItem.CLOUD_POSSIBLE_MATCH->"☁?";LocalMediaItem.CLOUD_CHECKING->"…";LocalMediaItem.CLOUD_REMOTE_MISSING->"☁!";LocalMediaItem.CLOUD_ERROR->"!";else->null};label?.let{Text(it,color=Color.White)}}

@Composable private fun UploadDialog(values:List<LocalMediaItem>?,onDismiss:()->Unit,onUpload:(List<LocalMediaItem>,Boolean)->Unit,onVerify:()->Unit){values?:return;val backed=DeviceMediaRules.safeItems(values);val unresolved=values.filter(DeviceMediaRules::isVerificationPending);when{unresolved.isNotEmpty()->AlertDialog(onDismissRequest=onDismiss,title={Text("Verificación pendiente")},text={Text("Todavía se están verificando ${unresolved.size} elementos.")},confirmButton={TextButton(onClick={onDismiss();onVerify()}){Text(stringResource(R.string.verify_action))}},dismissButton={TextButton(onClick=onDismiss){Text(stringResource(R.string.cancel))}});backed.isNotEmpty()->AlertDialog(onDismissRequest=onDismiss,title={Text(stringResource(R.string.duplicate_upload_title))},text={Text(stringResource(if(backed.size==1)R.string.duplicate_upload_message_single else R.string.duplicate_upload_message_multiple))},confirmButton={Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(8.dp)){Button(onClick={onUpload(values,true)},modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(stringResource(R.string.upload_again))};OutlinedButton(onClick=onDismiss,modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(stringResource(R.string.cancel))}}},dismissButton={});else->AlertDialog(onDismissRequest=onDismiss,title={Text("Confirmar subida")},text={Text("Subir ${values.size} elementos a OrangeFamily.")},confirmButton={TextButton(onClick={onUpload(values,false)}){Text(stringResource(R.string.upload_action))}},dismissButton={TextButton(onClick=onDismiss){Text(stringResource(R.string.cancel))}})}}
@Composable private fun DeleteDialog(values:List<LocalMediaItem>?,onDismiss:()->Unit,onDelete:(List<LocalMediaItem>)->Unit){values?:return;val safe=DeviceMediaRules.safeItems(values);val unsafe=values.filterNot(DeviceMediaRules::safeToDelete);val legacy=Build.VERSION.SDK_INT<Build.VERSION_CODES.R;AlertDialog(onDismissRequest=onDismiss,title={Text(stringResource(if(legacy)R.string.delete_forever else R.string.trash_title))},text={Text(if(legacy)stringResource(R.string.legacy_delete_warning)else stringResource(R.string.trash_move_warning))},confirmButton={Column{if(!legacy&&safe.isNotEmpty()&&unsafe.isNotEmpty())TextButton(onClick={onDelete(safe)}){Text("Mover solo respaldados")};TextButton(onClick={onDelete(values)}){Text(stringResource(R.string.delete_action))}}},dismissButton={TextButton(onClick=onDismiss){Text("Cancelar")}})}
