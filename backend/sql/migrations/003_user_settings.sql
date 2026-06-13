-- Idempotent migration: per-user settings (jellyfin URL, series playback sources)
-- Run via: npm run db:migrate

SET @user_settings_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_settings'
);

SET @user_settings_sql := IF(
  @user_settings_exists = 0,
  'CREATE TABLE user_settings (
    user_id BIGINT NOT NULL,
    setting_key VARCHAR(64) NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, setting_key),
    CONSTRAINT fk_user_settings_user_id
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT ''user_settings already exists'' AS message'
);
PREPARE user_settings_stmt FROM @user_settings_sql;
EXECUTE user_settings_stmt;
DEALLOCATE PREPARE user_settings_stmt;
