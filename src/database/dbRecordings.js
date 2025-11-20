import db from "./index.js";
import { createLogger } from "../services/logger.js";
const logger = createLogger("DbRecordings")

export function addRecording({
  name,
  source_url,
  stream_id,
  file_path,
  start_time,
  end_time,
  duration,
  schedule_id
}) {

  db.prepare(
    `
    INSERT INTO recordings (name, source_url, stream_id, file_path, start_time, end_time, duration, schedule_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(name, source_url, stream_id, file_path, start_time, end_time, duration, schedule_id);
  logger.info(`Added recording ${name}`)
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

export function deleteRecording(id) {
  db.prepare(`DELETE FROM recordings WHERE id = ?`).run(id);
  logger.info(`Deleted recording ${id}`)
}

export function deleteAllRecordings() {
  db.prepare("DELETE FROM recordings").run();
  logger.warn('Deleted all recordings!')
}


