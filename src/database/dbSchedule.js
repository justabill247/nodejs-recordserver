import db from "./index.js";
import { createLogger } from "../services/logger.js";
const logger = createLogger("DbSchedule")

export function addSchedule({
  name,
  stream_id = null,
  source_url,
  cron,
  duration,
}) {
  const stmt = db.prepare(
    `
    INSERT OR REPLACE INTO schedules (name, stream_id, source_url, cron, duration)
    VALUES (?, ?, ?, ?, ?)
  `
  );

  const result = stmt.run(name, stream_id, source_url, cron, duration);
  logger.info(`Added schedule ${name} with id ${result.lastInsertRowid}`)
  return result.lastInsertRowid
}

export function deleteSchedule(id, deleteRecordings = false) {
  if (deleteRecordings) {
    // Delete all recordings associated with this schedule
    db.prepare(`DELETE FROM recordings WHERE schedule_id = ?`).run(id);
    logger.info(`Deleted all recordings for schedule ${id}`);
  }
  db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
  logger.info(`Deleted schedule ${id}`)
}

export function deleteAllSchedules(deleteRecordings = false) {
  if (deleteRecordings) {
    db.prepare("DELETE FROM recordings").run();
    logger.warn("Deleted all recordings");
  }
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
    SELECT s.*, st.id AS stream_id, st.name AS stream_name, st.url AS stream_url, st.logo_url AS logo_url
    FROM schedules s
    LEFT JOIN streams st ON s.stream_id = st.id
    ORDER BY s.name ASC
  `
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      cron: row.cron,
      duration: row.duration,
      source_url: row.source_url,
      stream: row.stream_id
        ? {
            id: row.stream_id,
            name: row.stream_name,
            url: row.stream_url,
            logo_url: row.logo_url
          }
        : null,
    }));
}

export function getScheduleDetails(id) {
  // get schedule and its stream info
  const schedule = db.prepare(`
    SELECT s.*, st.id AS stream_id, st.name AS stream_name, 
                st.url AS stream_url, st.logo_url AS logo_url
    FROM schedules s
    LEFT JOIN streams st ON s.stream_id = st.id
    WHERE s.id = ?
    `).get(id)

  const recordings = db.prepare(`
    SELECT r.*
    FROM recordings r
    WHERE r.schedule_id = ?
    ORDER BY r.start_time DESC
    `).all(schedule.id)

    return {
      id: schedule.id,
      name: schedule.name,
      cron: schedule.cron,
      duration: schedule.duration,

      stream: schedule.stream_id ? {
        id: schedule.stream_id,
        name: schedule.stream_name, 
        url: schedule.stream_url, 
        logo_url: schedule.logo_url
      } : null,

      recordings
    }
}