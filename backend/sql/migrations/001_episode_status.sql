-- Idempotent migration: episode watch status (partial / watched)
-- Prefer: npm run db:migrate  (uses backend/.env automatically)
--
-- Manual:
--   mysql -h HOST -u USER -p DATABASE < backend/sql/migrations/001_episode_status.sql

USE arrowverse;

SET @has_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'watched_episodes'
    AND COLUMN_NAME = 'status'
);

SET @sql := IF(
  @has_status = 0,
  'ALTER TABLE watched_episodes ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT ''watched'' AFTER source',
  'SELECT ''watched_episodes.status already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
