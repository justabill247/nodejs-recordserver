import Database from "better-sqlite3";
const db = new Database("serverDb.db");
for (let i = 1; i <= 2; i++) {
  db.prepare(\
    INSERT INTO recordings (name, source_url, file_path, start_time, end_time, duration, schedule_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  \).run(
    \Recording \\,
    "https://test.com",
    \ecordings/test_keep_\.m4a\,
    \2026-03-31T0\:00:00Z\,
    \2026-03-31T0\:01:00Z\,
    60,
    
  );
}
console.log("Added 2 recordings");
db.close();
