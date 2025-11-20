import cron from "node-cron";
import { recordStream } from "./recorder.js";
import {
  addSchedule,
  getAllSchedules,
  deleteSchedule,
} from "../database/dbSchedule.js";
import { createLogger } from "./logger.js";
const logger = createLogger("Scheduler");

const scheduledJobs = new Map();

// Called once on startup
export function scheduleRecordings() {
  const schedules = getAllSchedules();
  for (const s of schedules) {
    scheduleJob(
      s.name,
      s.cron,
      {
        url: s.source_url,
        duration: s.duration,
        name: s.name,
        schedule_id: s.id,
      },
      false
    ); // don't re-save to DB on reload
  }
  logger.info(`Loaded ${schedules.length} saved jobs from DB`);
}


/**
 * Create a scheduled cron job.
 *
 * @param {string} name - Unique name of the schedule
 * @param {string} cronExpr - Cron schedule expression
 * @param {object} options - Recording options (url, id, duration, name, schedule_id)
 * @param {boolean} saveToDb - Whether to insert this schedule into the DB
 */
export function scheduleJob(name, cronExpr, options, saveToDb = true) {
  // if job exists, stop it, delete it, will be overwritten
  if (scheduledJobs.has(name)) {
    scheduledJobs.get(name).stop();
    scheduledJobs.delete(name);
  }
  logger.info(`options ${options.schedule_id}`)

  if (saveToDb) {
    //add schedule, get its id
    const scheduleId = addSchedule({
      name,
      source_url: options.url,
      stream_id: options.id,
      cron: cronExpr,
      duration: options.duration,
    });
    // add schedule id to options
    logger.info(`Added ${name} to db with id ${scheduleId}`)
    options.schedule_id = scheduleId;
  }

  const task = cron.schedule(cronExpr, () => {
    logger.info(`Attepmting to record ${name}`);
    recordStream(options)
      .then((file) => logger.info(`Succesfully recorded ${name} to ${file}`))
      .catch((err) => logger.error(`Failed to record ${name}, ${err}`));
  });

  scheduledJobs.set(name, task);
  logger.info(`Scheduled job ${name} with cron ${cronExpr}`);
}

export function listJobs() {
  return Array.from(scheduledJobs.keys());
}

export function cancelJob(name) {
  const job = scheduledJobs.get(name);
  if (job) {
    job.stop();
    scheduledJobs.delete(name);
    deleteSchedule(name);
    logger.info(`Cancelled job ${name}`);
    return true;
  }
  return false;
}

export function cancelAllJobs() {
  for (const [id, job] of scheduledJobs.entries()) {
    job.stop();
    scheduledJobs.delete(id);
  }
  logger.info("All scheduled jobs cancelled.");
}
