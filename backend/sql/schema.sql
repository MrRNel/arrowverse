-- Arrowverse Tracker — MySQL / MariaDB schema
--
-- Run against your local MySQL server (adjust user/host as needed):
--
--   mysql -u root -p < backend/sql/schema.sql
--
-- Or, if the database/user already exist:
--
--   mysql -u arrowverse -p arrowverse < backend/sql/schema.sql
--
-- Optional: create app user (run as root)
--   CREATE USER IF NOT EXISTS 'arrowverse'@'localhost' IDENTIFIED BY 'arrowverse';
--   GRANT ALL PRIVILEGES ON arrowverse.* TO 'arrowverse'@'localhost';
--   FLUSH PRIVILEGES;

CREATE DATABASE IF NOT EXISTS arrowverse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE arrowverse;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_public_id (public_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS authorization_codes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code_hash VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  code_challenge VARCHAR(128) NOT NULL,
  code_challenge_method VARCHAR(16) NOT NULL DEFAULT 'S256',
  redirect_uri VARCHAR(512) NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_authorization_codes_code_hash (code_hash),
  KEY ix_authorization_codes_code_hash (code_hash),
  CONSTRAINT fk_authorization_codes_user_id
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  token_hash VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  client_type VARCHAR(16) NOT NULL,
  device_id VARCHAR(64) NULL,
  device_name VARCHAR(128) NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  last_used_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_token_hash (token_hash),
  KEY ix_refresh_tokens_token_hash (token_hash),
  CONSTRAINT fk_refresh_tokens_user_id
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS watched_episodes (
  user_id BIGINT NOT NULL,
  `row_number` INT NOT NULL,
  watched_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  source VARCHAR(16) NOT NULL DEFAULT 'manual',
  status VARCHAR(16) NOT NULL DEFAULT 'watched',
  PRIMARY KEY (user_id, `row_number`),
  CONSTRAINT fk_watched_episodes_user_id
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing databases: run once if the status column is missing
-- ALTER TABLE watched_episodes ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'watched' AFTER source;

CREATE TABLE IF NOT EXISTS user_gamification_meta (
  user_id BIGINT NOT NULL,
  best_streak INT NOT NULL DEFAULT 0,
  seen_achievement_ids JSON NOT NULL DEFAULT (JSON_ARRAY()),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_gamification_meta_user_id
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
