package com.orangefamily.photossync.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [LocalMediaItem::class, AgentConfig::class, MediaBaseline::class],
    version = 1,
    exportSchema = false,
)
abstract class OrangePhotosLocalDatabase : RoomDatabase() {
    abstract fun cameraBackupDao(): CameraBackupDao

    companion object {
        @Volatile
        private var instance: OrangePhotosLocalDatabase? = null

        fun getInstance(context: Context): OrangePhotosLocalDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    OrangePhotosLocalDatabase::class.java,
                    "orange_photos_local.db",
                ).build().also { instance = it }
            }
    }
}
