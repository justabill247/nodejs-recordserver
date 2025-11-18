import db from "./index.js";
import { createLogger } from "../services/logger.js";
const logger = createLogger(`Database`)

export function runMigrations() {
  db.exec(
    `
CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    logo_path TEXT,
    source_url TEXT,
    stream_id INTEGER,
    file_path TEXT,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER
) ;

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  stream_id INTEGER,
  source_url TEXT,
  cron TEXT,
  duration INTEGER,
  FOREIGN KEY(stream_id) REFERENCES streams(id)
);

CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  url TEXT,
  logo_url TEXT
);
        `
  );

  db.pragma("foreign_keys = ON");
  logger.info("Tables have been migrated")

}
