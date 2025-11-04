import Database from "better-sqlite3";

const db = new Database("recordings.db");

// --- Migration: Add stream_id to schedules if not present ---
const columns = db.prepare("PRAGMA table_info(schedules)").all();
const hasStreamId = columns.some(c => c.name === "stream_id");

if (!hasStreamId) {
  console.log("🔧 Migrating: adding 'stream_id' column to schedules table...");
  db.prepare("ALTER TABLE schedules ADD COLUMN stream_id INTEGER").run();

  // Try to backfill existing rows by matching source_url to streams
  const streams = db.prepare("SELECT id, url FROM streams").all();
  const findStreamId = (url) => {
    const match = streams.find(s => s.url === url);
    return match ? match.id : null;
  };

  const schedules = db.prepare("SELECT name, source_url FROM schedules").all();
  const updateStmt = db.prepare("UPDATE schedules SET stream_id = ? WHERE name = ?");

  for (const s of schedules) {
    const sid = findStreamId(s.source_url);
    if (sid) {
      updateStmt.run(sid, s.name);
    }
  }

  console.log("✅ Migration complete.");
}


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
  name TEXT PRIMARY KEY,
  stream_id INTEGER,
  source_url TEXT,
  cron TEXT,
  duration INTEGER,
  FOREIGN KEY(stream_id) REFERENCES streams(id)
)
`).run();

// --- Streams table ---
db.prepare(`
CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  url TEXT NOT NULL
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
export function addSchedule({ name, stream_id = null, source_url, cron, duration }) {
  db.prepare(`
    INSERT OR REPLACE INTO schedules (name, stream_id, source_url, cron, duration)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, stream_id, source_url, cron, duration);
}

export function deleteSchedule(name) {
  db.prepare(`DELETE FROM schedules WHERE name = ?`).run(name);
}


export function getAllSchedules() {
  return db.prepare(`SELECT * FROM schedules ORDER BY created_at DESC`).all();
}



export function getAllSchedulesWithStreamInfo() {
  return db.prepare(`
    SELECT s.*, st.id AS stream_id, st.name AS stream_name, st.url AS stream_url
    FROM schedules s
    LEFT JOIN streams st ON s.stream_id = st.id
    ORDER BY s.name ASC
  `).all().map(row => ({
    name: row.name,
    cron: row.cron,
    duration: row.duration,
    source_url: row.source_url,
    stream: row.stream_id ? {
      id: row.stream_id,
      name: row.stream_name,
      url: row.stream_url
    } : null
  }));
}




// --- Stream helpers ---
export function getAllStreams() {
  return db.prepare("SELECT * FROM streams ORDER BY name ASC").all();
}

export function getStream(idOrName) {
  return db.prepare(`
    SELECT * FROM streams WHERE id = ? OR name = ?
  `).get(idOrName, idOrName);
}


export function addStream({ name, url }) {
  db.prepare(`
    INSERT OR REPLACE INTO streams (name, url)
    VALUES (?, ?)
  `).run(name, url);
}

export function deleteStream(id) {
  console.log('deleting stream', id)
    db.prepare(`
    DELETE FROM streams WHERE id = ?
  `).run(id);
}

export default db;
