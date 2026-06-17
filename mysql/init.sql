CREATE TABLE IF NOT EXISTS choreographies (
  id               VARCHAR(64)  PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  steps            JSON         NOT NULL,
  created_at       BIGINT       NOT NULL,
  bpm              INT          NOT NULL DEFAULT 120,
  `loop`           TINYINT(1)   NOT NULL DEFAULT 0,
  youtube_url      VARCHAR(512),
  audio_url        VARCHAR(512),
  youtube_duration INT,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
