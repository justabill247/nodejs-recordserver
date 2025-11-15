import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createLogger } from "../services/logger.js";
const logger = createLogger("Database")

// always point to project root
const dbPath = path.join(process.cwd(), "serverDb.db")

// create folder if needed
const dir = path.dirname(dbPath)
if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true})

// connect to database
const db = new Database(dbPath);
logger.info(`Database loaded: ${dbPath}`)

// --- Create tables ---
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
`);
db.pragma("foreign_keys = ON");

// --- Recordings functions ---
/**
 * Adds a recording to the database
 *
 * @param {string} name - The name of the recording
 * @param {url} source_url - The stream URL that was recorded
 * @param {integer} stream_id The id of the stream that was recorded
 * @param {string}  file_path - The path on the server
 * @param {string}  start_time - The time the recording was started
 * @param {string}  end_time - The time the recording ended
 * @param {number}  duration - The path on the server
 */
export function addRecording({
  name,
  source_url,
  stream_id,
  file_path,
  start_time,
  end_time,
  duration,
}) {

  db.prepare(
    `
    INSERT INTO recordings (name, source_url, stream_id, file_path, start_time, end_time, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(name, source_url, stream_id, file_path, start_time, end_time, duration);
  logger.info(`Added recording ${name}`)
}

export function deleteRecording(id) {
  db.prepare(`DELETE FROM recordings WHERE id = ?`).run(id);
  logger.info(`Deleted recording ${id}`)
}

export function deleteAllRecordings() {
  db.prepare("DELETE FROM recordings").run();
  logger.warn('Deleted all recordings!')
}

export function getAllRecordings() {
  return db.prepare(`SELECT * FROM recordings ORDER BY start_time DESC`).all();
}

export function getAllRecordingsWithStreamInfo() {
  return db.prepare(
    `
    SELECT
      r.id,
      r.name,
      r.file_path,
      r.start_time,
      r.stream_id,
      r.duration,
      s.name AS stream_name,
      s.logo_url AS logo_url,
      s.url AS url
    FROM recordings r
    LEFT JOIN streams s ON r.stream_id = s.id
    ORDER BY r.start_time DESC
    `).all();
}

// --- Schedules functions ---
export function addSchedule({
  name,
  stream_id = null,
  source_url,
  cron,
  duration,
}) {
  db.prepare(
    `
    INSERT OR REPLACE INTO schedules (name, stream_id, source_url, cron, duration)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(name, stream_id, source_url, cron, duration);
  logger.info(`Added schedule ${name}`)
}

export function deleteSchedule(name) {
  db.prepare(`DELETE FROM schedules WHERE name = ?`).run(name);
  logger.info(`Deleted schedule ${name}`)
}

export function deleteAllSchedules() {
  db.prepare("DELETE FROM schedules").run();
  logger.warn("Deleted all schedules")
}

export function getAllSchedules() {
  return db.prepare(`SELECT * FROM schedules`).all();
}

export function getAllSchedulesWithStreamInfo() {
  return db
    .prepare(
      `
    SELECT s.*, st.id AS stream_id, st.name AS stream_name, st.url AS stream_url
    FROM schedules s
    LEFT JOIN streams st ON s.stream_id = st.id
    ORDER BY s.name ASC
  `
    )
    .all()
    .map((row) => ({
      name: row.name,
      cron: row.cron,
      duration: row.duration,
      source_url: row.source_url,
      stream: row.stream_id
        ? {
            id: row.stream_id,
            name: row.stream_name,
            url: row.stream_url,
          }
        : null,
    }));
}

// --- Stream helpers ---
export function getAllStreams() {
  return db.prepare("SELECT * FROM streams ORDER BY name ASC").all();
}

export function getStream(idOrName) {
  return db
    .prepare(
      `
    SELECT * FROM streams WHERE id = ? OR name = ?
  `
    )
    .get(idOrName, idOrName);
}

export function addStream({ name, url, logo_url }) {
  db.prepare(
    `
    INSERT OR REPLACE INTO streams (name, url, logo_url)
    VALUES (?, ?, ?)
  `
  ).run(name, url, logo_url);
  logger.info(`Added stream ${name}`)
}

export function deleteStream(id) {
  console.log("deleting stream", id);
  db.prepare(
    `
    DELETE FROM streams WHERE id = ?
  `
  ).run(id);
  logger.info(`Deleted stream id ${id}`)
}

export default db;
