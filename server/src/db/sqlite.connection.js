import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS devices (
  token TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  alert_mode TEXT NOT NULL CHECK (alert_mode IN ('normal', 'critical')),
  sound_name TEXT NOT NULL,
  critical_volume REAL CHECK (
    (alert_mode = 'normal' AND critical_volume IS NULL) OR
    (alert_mode = 'critical' AND critical_volume >= 0 AND critical_volume <= 1)
  ),
  keyword_filter_mode TEXT NOT NULL DEFAULT 'none' CHECK (keyword_filter_mode IN ('none', 'block', 'allow')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_regions (
  token TEXT NOT NULL REFERENCES devices(token) ON DELETE CASCADE,
  region_code TEXT NOT NULL,
  PRIMARY KEY (token, region_code)
);

CREATE INDEX IF NOT EXISTS idx_device_regions_region_code
  ON device_regions(region_code);

CREATE TABLE IF NOT EXISTS device_keywords (
  token TEXT NOT NULL REFERENCES devices(token) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  PRIMARY KEY (token, normalized_keyword)
);
`;

export function openSqliteDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    const parentDirectory = path.dirname(databasePath);
    fs.mkdirSync(parentDirectory, { recursive: true });
  }

  const database = new DatabaseSync(databasePath);

  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  if (databasePath !== ':memory:') {
    database.exec('PRAGMA journal_mode = WAL;');
    database.exec('PRAGMA synchronous = NORMAL;');
  }
  database.exec(SCHEMA_SQL);

  return database;
}
