import cron from "node-cron";
import { recordStream } from "./recorder.js";
import { addSchedule, getAllSchedules, deleteSchedule } from "../database/db.js";
import { createLogger } from "./logger.js";
const logger = createLogger("Scheduler")

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
      },
      false
    ); // don't re-save to DB on reload
  }
  logger.info(`Loaded ${schedules.length} saved jobs from DB`);
}

export function scheduleJob(name, cronExpr, options, saveToDb = true) {
  if (scheduledJobs.has(name)) {
    scheduledJobs.get(name).stop();
    scheduledJobs.delete(name);
  }

  const task = cron.schedule(cronExpr, () => {
    recordStream(options);
  });

  scheduledJobs.set(name, task);
  logger.info(`Scheduled job ${name} with cron ${cronExpr}`);

  if (saveToDb) {
    addSchedule({
      name,
      source_url: options.url,
      stream_id: options.id,
      cron: cronExpr,
      duration: options.duration,
    });
  }
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