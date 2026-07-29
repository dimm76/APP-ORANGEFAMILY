package com.orangefamily.photossync.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [LocalMediaItem::class, AgentConfig::class, MediaBaseline::class, MultipartUploadSession::class, MultipartUploadPart::class],
    version = 5,
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
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5).build().also { instance = it }
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

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN date_modified INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN bucket_id TEXT")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN bucket_name TEXT")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN hash_algorithm TEXT")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN hash_computed_at INTEGER")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN cloud_status TEXT NOT NULL DEFAULT 'unknown'")
                db.execSQL("ALTER TABLE local_media_items ADD COLUMN remote_verified_at INTEGER")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_local_media_items_account_user_id_bucket_id ON local_media_items(account_user_id,bucket_id)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_local_media_items_account_user_id_cloud_status ON local_media_items(account_user_id,cloud_status)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_local_media_items_account_user_id_checksum_sha256 ON local_media_items(account_user_id,checksum_sha256)")
            }
        }

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS multipart_upload_sessions (local_media_item_id INTEGER NOT NULL, account_user_id TEXT NOT NULL, server_upload_id TEXT NOT NULL, client_upload_key TEXT NOT NULL, part_size INTEGER NOT NULL, parts_total INTEGER NOT NULL, expires_at TEXT, status TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(local_media_item_id))")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_multipart_upload_sessions_server_upload_id ON multipart_upload_sessions(server_upload_id)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_multipart_upload_sessions_account_user_id ON multipart_upload_sessions(account_user_id)")
                db.execSQL("CREATE TABLE IF NOT EXISTS multipart_upload_parts (local_media_item_id INTEGER NOT NULL, part_number INTEGER NOT NULL, etag TEXT NOT NULL, size_bytes INTEGER NOT NULL, PRIMARY KEY(local_media_item_id,part_number))")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_multipart_upload_parts_local_media_item_id ON multipart_upload_parts(local_media_item_id)")
            }
        }
    }
}
