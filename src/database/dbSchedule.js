import db from "./index.js";
import { createLogger } from "../services/logger.js";
const logger = createLogger("DbSchedule")

export function addSchedule({
  name,
  stream_id = null,
  source_url,
  cron,
  one_shot = false,
  duration,
}) {
  const stmt = db.prepare(
    `
    INSERT OR REPLACE INTO schedules (name, stream_id, source_url, cron, one_shot, duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  );

  const result = stmt.run(name, stream_id, source_url, cron, one_shot ? 1 : 0, duration);
  logger.info(`Added schedule ${name} with id ${result.lastInsertRowid}`)
  return result.lastInsertRowid
}

export function deleteSchedule(id, deleteRecordings = false) {
  try {
    if (deleteRecordings) {
      // Delete all recordings associated with this schedule
      const recordingsResult = db.prepare(`DELETE FROM recordings WHERE schedule_id = ?`).run(id);
      if (recordingsResult.changes > 0) {
        logger.info(`Deleted ${recordingsResult.changes} recordings for schedule ${id}`);
      }
    } else {
      // Keep recordings but disconnect them from schedule (avoid FK constraint)
      const updateResult = db.prepare(`UPDATE recordings SET schedule_id = NULL WHERE schedule_id = ?`).run(id);
      if (updateResult.changes > 0) {
        logger.info(`Disconnected ${updateResult.changes} recordings from schedule ${id}`);
      }
    }
    
    // Now delete the schedule
    const scheduleResult = db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
    if (scheduleResult.changes > 0) {
      logger.info(`Deleted schedule ${id}`);
    } else {
      logger.warn(`Schedule ${id} not found for deletion`);
    }
  } catch (err) {
    logger.error(`Error deleting schedule ${id}: ${err.message}`, err);
    throw err;
  }
}

export function deleteAllSchedules(deleteRecordings = false) {
  try {
    if (deleteRecordings) {
      // Delete all recordings
      const recordingsResult = db.prepare("DELETE FROM recordings").run();
      if (recordingsResult.changes > 0) {
        logger.warn(`Deleted all ${recordingsResult.changes} recordings`);
      }
    } else {
      // Keep recordings but disconnect them from schedules (avoid FK constraint)
      const updateResult = db.prepare("UPDATE recordings SET schedule_id = NULL").run();
      if (updateResult.changes > 0) {
        logger.warn(`Disconnected all ${updateResult.changes} recordings from schedules`);
      }
    }
    
    // Now delete all schedules
    const schedulesResult = db.prepare("DELETE FROM schedules").run();
    if (schedulesResult.changes > 0) {
      logger.warn(`Deleted all ${schedulesResult.changes} schedules`);
    }
  } catch (err) {
    logger.error(`Error deleting all schedules: ${err.message}`, err);
    throw err;
  }
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
      oneShot: Boolean(row.one_shot),
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
      oneShot: Boolean(schedule.one_shot),
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