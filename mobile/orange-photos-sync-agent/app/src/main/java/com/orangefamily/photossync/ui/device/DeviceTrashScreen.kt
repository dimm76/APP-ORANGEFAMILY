package com.orangefamily.photossync.ui.device

import android.os.Build
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.orangefamily.photossync.R
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.device.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class,ExperimentalFoundationApi::class)
@Composable fun DeviceTrashScreen(scanner:DeviceMediaStoreScanner,accountUserId:String,thumbnailLoader:DeviceMediaThumbnailLoader,onBack:()->Unit,onRestore:(List<LocalMediaItem>)->Unit,onDeleteForever:(List<LocalMediaItem>)->Unit,refreshVersion:Int,modifier:Modifier=Modifier){
    val scope=rememberCoroutineScope();var items by remember{mutableStateOf(emptyList<DeviceTrashItem>())};var loading by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)};var selected by remember{mutableStateOf(emptySet<String>())};var confirmDelete by remember{mutableStateOf<List<LocalMediaItem>?>(null)}
    fun reload(){scope.launch{loading=true;error=null;runCatching{scanner.scanTrash(accountUserId)}.onSuccess{values->items=values;selected=selected.intersect(values.map{DeviceMediaRules.stableId(it.media)}.toSet())}.onFailure{error=it.message};loading=false}}
    LaunchedEffect(accountUserId,refreshVersion){reload()}
    Scaffold(modifier=modifier,topBar={TopAppBar(title={Text(if(selected.isEmpty())stringResource(R.string.trash_title)else pluralStringResource(R.plurals.selected_media_count,selected.size,selected.size))},navigationIcon={IconButton(onClick={if(selected.isEmpty())onBack()else selected=emptySet()},modifier=Modifier.semantics{contentDescription=if(selected.isEmpty())"Volver" else "Cerrar selección"}){Text(if(selected.isEmpty())"←" else "×",style=MaterialTheme.typography.titleLarge)}},actions={if(selected.isNotEmpty()){IconButton(onClick={onRestore(items.map{it.media}.filter{DeviceMediaRules.stableId(it) in selected});selected=emptySet()}){Icon(OrangeRestoreIcon,stringResource(R.string.restore_action),Modifier.size(24.dp))};IconButton(onClick={confirmDelete=items.map{it.media}.filter{DeviceMediaRules.stableId(it) in selected}}){Icon(OrangeDeleteIcon,stringResource(R.string.delete_forever),Modifier.size(24.dp))}}})}){padding->
        Box(Modifier.padding(padding).fillMaxSize(),contentAlignment=Alignment.Center){when{Build.VERSION.SDK_INT<Build.VERSION_CODES.R->Text(stringResource(R.string.trash_unsupported),Modifier.padding(24.dp));loading->CircularProgressIndicator();error!=null->Column(horizontalAlignment=Alignment.CenterHorizontally){Text(error.orEmpty());Button(onClick=::reload){Text(stringResource(R.string.retry_action))}};items.isEmpty()->Text(stringResource(R.string.trash_empty));else->LazyVerticalGrid(GridCells.Adaptive(112.dp),contentPadding=PaddingValues(4.dp),horizontalArrangement=Arrangement.spacedBy(4.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){items(items,key={DeviceMediaRules.stableId(it.media)}){trash->val id=DeviceMediaRules.stableId(trash.media);TrashCard(trash.media,id in selected,selected.isNotEmpty(),thumbnailLoader,Modifier.combinedClickable(onClick={if(selected.isNotEmpty())selected=if(id in selected)selected-id else selected+id},onLongClick={selected+=id}))}}}}
    }
    confirmDelete?.let{values->AlertDialog(onDismissRequest={confirmDelete=null},title={Text(stringResource(R.string.delete_forever))},text={Text(stringResource(if(values.size==1)R.string.delete_forever_single else R.string.delete_forever_plural))},confirmButton={TextButton(onClick={onDeleteForever(values);selected=emptySet();confirmDelete=null}){Text(stringResource(R.string.delete_forever))}},dismissButton={TextButton(onClick={confirmDelete=null}){Text("Cancelar")}})}
}

@Composable private fun TrashCard(item:LocalMediaItem,selected:Boolean,selectionMode:Boolean,loader:DeviceMediaThumbnailLoader,modifier:Modifier){val shape=RoundedCornerShape(12.dp);Box(modifier.aspectRatio(1f).background(if(selected)MaterialTheme.colorScheme.primaryContainer else Color.Transparent,shape).padding(if(selected)5.dp else 0.dp).clip(shape)){var bitmap by remember(item.contentUri){mutableStateOf<android.graphics.Bitmap?>(null)};LaunchedEffect(item.contentUri){bitmap=loader.load(item.contentUri)};if(bitmap!=null)androidx.compose.foundation.Image(bitmap!!.asImageBitmap(),item.displayName,Modifier.fillMaxSize(),contentScale=ContentScale.Crop)else Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Text(if(item.mediaType==LocalMediaItem.TYPE_VIDEO)"Vídeo" else "Imagen")};if(selectionMode)Box(Modifier.align(Alignment.TopStart).padding(6.dp).size(24.dp).background(if(selected)Color.White else Color.Transparent,CircleShape).border(2.dp,if(selected)MaterialTheme.colorScheme.primary else Color.White,CircleShape),contentAlignment=Alignment.Center){if(selected)Text("✓",color=MaterialTheme.colorScheme.primary)}}}
