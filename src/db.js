import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// always point to project root
const dbPath = path.join(process.cwd(), "serverDb.db")

// create folder if needed
const dir = path.dirname(dbPath)
if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true})

// connect to database
const db = new Database(dbPath);
console.log("✅ Database loaded:", dbPath)

// --- Create tables ---
db.exec(
  `
  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    url TEXT,
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
console.log("✅ Tables ready.");

// --- Recordings functions ---
/**
 * Adds a recording to the database
 *
 * @param {string} name - The name of the recording
 * @param {url} url - The stream URL
 * @param {string}  file_path - The path on the server
 * @param {string}  start_time - The time the recording was started
 * @param {string}  end_time - The time the recording ended
 * @param {number}  duration - The path on the server
 */
export function addRecording({
  name,
  url,
  file_path,
  start_time,
  end_time,
  duration,
}) {

  db.prepare(
    `
    INSERT INTO recordings (name, url, file_path, start_time, end_time, duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(name, url, file_path, start_time, end_time, duration);
}

export function deleteRecording(id) {
  db.prepare(`DELETE FROM recordings WHERE id = ?`).run(id);
}

export function deleteAllRecordings() {
  db.prepare("DELETE FROM recordings").run();
}

export function getAllRecordings() {
  return db.prepare(`SELECT * FROM recordings ORDER BY start_time DESC`).all();
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
}

export function deleteSchedule(name) {
  db.prepare(`DELETE FROM schedules WHERE name = ?`).run(name);
}

export function deleteAllSchedules() {
  db.prepare("DELETE FROM schedules").run();
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
}

export function deleteStream(id) {
  console.log("deleting stream", id);
  db.prepare(
    `
    DELETE FROM streams WHERE id = ?
  `
  ).run(id);
}

export default db;
