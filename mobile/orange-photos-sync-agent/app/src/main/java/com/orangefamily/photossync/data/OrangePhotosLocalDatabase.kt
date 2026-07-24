package com.orangefamily.photossync.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [LocalMediaItem::class, AgentConfig::class, MediaBaseline::class],
    version = 3,
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
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3).build().also { instance = it }
            }

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN checksum_sha256 TEXT")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN remote_photo_id TEXT")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN last_attempt_at INTEGER")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN failure_code TEXT")
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE agent_configs ADD COLUMN sync_lock_token TEXT")
                db.execSQL("ALTER TABLE agent_configs ADD COLUMN sync_lock_expires_at INTEGER")
            }
        }
    }
}
