package com.orangefamily.photossync

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import com.orangefamily.photossync.data.AgentConfig
import com.orangefamily.photossync.data.LocalMediaItem
import com.orangefamily.photossync.data.OrangePhotosLocalDatabase
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CameraBackupDaoInstrumentedTest {
    private lateinit var database:OrangePhotosLocalDatabase

    @Before fun setUp(){database=Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(),OrangePhotosLocalDatabase::class.java).build()}
    @After fun tearDown(){database.close()}

    @Test fun abandonedLocksAreRecoveredWithoutClearingAValidLock()=runBlocking{
        val dao=database.cameraBackupDao();val now=1_000_000L;val maximum=now+30*60*1000L
        suspend fun save(expiry:Long?)=dao.saveConfig(AgentConfig("user",0,0,0,0,0,null,true,"lock",expiry))
        save(now+24*60*60*1000L);assertEquals(1,dao.recoverAbandonedSyncLock("user",now,maximum));assertEquals(null,dao.getConfig("user")?.syncLockToken)
        save(now+10*60*1000L);assertEquals(0,dao.recoverAbandonedSyncLock("user",now,maximum));assertEquals("lock",dao.getConfig("user")?.syncLockToken)
        save(now-1);assertEquals(1,dao.recoverAbandonedSyncLock("user",now,maximum));assertEquals(null,dao.getConfig("user")?.syncLockToken)
    }

    @Test fun syncBatchKeepsPendingAndRetryableFailuresButExcludesPermanentFailures()=runBlocking{
        val dao=database.cameraBackupDao()
        dao.insertPending(listOf(item(1,LocalMediaItem.STATUS_FAILED,"UNSUPPORTED_MULTIPART"),item(2,LocalMediaItem.STATUS_FAILED,"NETWORK_ERROR"),item(3,LocalMediaItem.STATUS_PENDING,null),item(4,LocalMediaItem.STATUS_FAILED,"LARGE_UPLOAD_INTERRUPTED"),item(5,LocalMediaItem.STATUS_FAILED,"DUPLICATE_RECONCILIATION_REQUIRED")))
        assertEquals(listOf(2L,3L),dao.getSyncBatch("user",20).map{it.mediaStoreId})
        dao.enqueueDeviceMedia("user","external",LocalMediaItem.TYPE_VIDEO,1,false)
        val retried=dao.findMediaItem("user","external",LocalMediaItem.TYPE_VIDEO,1)
        assertEquals(LocalMediaItem.STATUS_PENDING,retried?.localStatus)
        assertEquals(null,retried?.failureCode)
        assertEquals(listOf(1L,2L,3L),dao.getSyncBatch("user",20).map{it.mediaStoreId})
    }

    @Test fun migrationFourToFivePreservesExistingDataAndCreatesMultipartTables(){
        val context=ApplicationProvider.getApplicationContext<android.content.Context>()
        val name="migration-4-5-${System.nanoTime()}.db"
        fun helper(version:Int,onUpgrade:(SupportSQLiteDatabase,Int,Int)->Unit={_,_,_->})=FrameworkSQLiteOpenHelperFactory().create(SupportSQLiteOpenHelper.Configuration.builder(context).name(name).callback(object:SupportSQLiteOpenHelper.Callback(version){override fun onCreate(db:SupportSQLiteDatabase){db.execSQL("CREATE TABLE sentinel(value TEXT NOT NULL)");db.execSQL("INSERT INTO sentinel(value) VALUES('preserved')")}override fun onUpgrade(db:SupportSQLiteDatabase,oldVersion:Int,newVersion:Int)=onUpgrade(db,oldVersion,newVersion)}).build())
        helper(4).apply{writableDatabase;close()}
        val upgraded=helper(5){db,old,new->OrangePhotosLocalDatabase.MIGRATION_4_5.migrate(db)}
        val db=upgraded.writableDatabase
        db.query("SELECT value FROM sentinel").use{assertEquals(true,it.moveToFirst());assertEquals("preserved",it.getString(0))}
        db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('multipart_upload_sessions','multipart_upload_parts')").use{assertEquals(2,it.count)}
        upgraded.close();context.deleteDatabase(name)
    }

    @Test fun cameraScanPromotesExistingDiscoveredItemToPending()=runBlocking{
        val dao=database.cameraBackupDao()
        val discovered=item(700,LocalMediaItem.STATUS_DISCOVERED,null)
        dao.upsertDeviceMedia(listOf(discovered))
        val insertResult=dao.insertPending(listOf(discovered.copy(localStatus=LocalMediaItem.STATUS_PENDING)))
        assertEquals(-1L,insertResult.single())
        val promoted=dao.promoteDiscoveredToPending(discovered.accountUserId,discovered.mediaCollection,discovered.mediaType,discovered.mediaStoreId,discovered.detectedAt+1)
        assertEquals(1,promoted)
        val stored=dao.findMediaItem(discovered.accountUserId,discovered.mediaCollection,discovered.mediaType,discovered.mediaStoreId)
        assertEquals(LocalMediaItem.STATUS_PENDING,stored?.localStatus)
    }

    private fun item(mediaStoreId:Long,status:String,failureCode:String?)=LocalMediaItem(accountUserId="user",mediaStoreId=mediaStoreId,mediaCollection="external",mediaType=LocalMediaItem.TYPE_VIDEO,contentUri="content://media/$mediaStoreId",displayName="$mediaStoreId.mp4",mimeType="video/mp4",sizeBytes=1,dateAdded=mediaStoreId,dateTaken=null,relativePath="DCIM/Camera/",width=null,height=null,durationMs=null,detectedAt=mediaStoreId,localStatus=status,failureCode=failureCode)
}
