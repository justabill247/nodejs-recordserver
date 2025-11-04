import Database from "better-sqlite3";

const db = new Database("recordings.db");

// --- Existing recordings table ---
db.prepare(`
  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    source_url TEXT,
    file_path TEXT,
    start_time TEXT,
    end_time TEXT,
    duration INTEGER
  )
`).run();

// --- New schedules table ---
db.prepare(`
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    source_url TEXT,
    cron TEXT,
    duration INTEGER,
    created_at TEXT
  )
`).run();

// --- Recordings functions ---
export function addRecording({ name, source_url, file_path, start_time, end_time, duration }) {
  db.prepare(`
    INSERT INTO recordings (name, source_url, file_path, start_time, end_time, duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, source_url, file_path, start_time, end_time, duration);
}

export function getAllRecordings() {
  return db.prepare(`SELECT * FROM recordings ORDER BY start_time DESC`).all();
}

// --- Schedules functions ---
export function addSchedule({ name, source_url, cron, duration }) {
  db.prepare(`
    INSERT OR REPLACE INTO schedules (name, source_url, cron, duration, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, source_url, cron, duration, new Date().toISOString());
}

export function getAllSchedules() {
  return db.prepare(`SELECT * FROM schedules ORDER BY created_at DESC`).all();
}

export function deleteSchedule(name) {
  db.prepare(`DELETE FROM schedules WHERE name = ?`).run(name);
}

export default db;
