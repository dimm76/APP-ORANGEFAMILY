package com.orangefamily.photossync.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface CameraBackupDao {
    @Query("SELECT * FROM agent_configs WHERE account_user_id = :accountUserId LIMIT 1")
    suspend fun getConfig(accountUserId: String): AgentConfig?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfig(config: AgentConfig)

    @Query("SELECT * FROM media_baselines WHERE account_user_id = :accountUserId")
    suspend fun getBaselines(accountUserId: String): List<MediaBaseline>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveBaselines(baselines: List<MediaBaseline>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertPending(items: List<LocalMediaItem>): List<Long>

    @Query(
        """
        SELECT
            COALESCE(SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END), 0) AS image_count,
            COALESCE(SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END), 0) AS video_count
        FROM local_media_items
        WHERE account_user_id = :accountUserId AND local_status = 'pending'
        """,
    )
    suspend fun getPendingCounts(accountUserId: String): PendingCounts

    @Query(
        """
        SELECT * FROM local_media_items
        WHERE account_user_id = :accountUserId AND local_status = 'pending'
        ORDER BY detected_at DESC, id DESC
        LIMIT :limit
        """,
    )
    suspend fun getLatestPending(accountUserId: String, limit: Int = 10): List<LocalMediaItem>
}
