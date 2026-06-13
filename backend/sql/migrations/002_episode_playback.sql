-- Idempotent migration: playback source metadata on watched_episodes
-- Run via: npm run db:migrate

SET @play_item_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'watched_episodes'
    AND COLUMN_NAME = 'play_item_id'
);

SET @play_item_sql := IF(
  @play_item_exists = 0,
  'ALTER TABLE watched_episodes ADD COLUMN play_item_id VARCHAR(64) NULL AFTER source',
  'SELECT ''watched_episodes.play_item_id already exists'' AS message'
);
PREPARE play_item_stmt FROM @play_item_sql;
EXECUTE play_item_stmt;
DEALLOCATE PREPARE play_item_stmt;

-- Widen source column for jellyfin/netflix labels
ALTER TABLE watched_episodes
  MODIFY COLUMN source VARCHAR(32) NOT NULL DEFAULT 'manual';
