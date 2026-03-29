import cron from "node-cron";
import { recordStream } from "./recorder.js";
import {
  addSchedule,
  getAllSchedules,
  deleteSchedule,
} from "../database/dbSchedule.js";
import { createLogger } from "./logger.js";
const logger = createLogger("Scheduler");

const scheduledJobs = new Map(); // name -> job instance
const scheduledJobIds = new Map(); // schedule_id -> job name

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

// Helper to get all scheduled job names
export function getScheduledJobNames() {
  return Array.from(scheduledJobs.keys());
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
    logger.info(`Attempting to record ${name}`);
    recordStream(options)
      .then((file) => logger.info(`Successfully recorded ${name} to ${file}`))
      .catch((err) => logger.error(`Failed to record ${name}: ${err.message}`));
  });

  // Store the task with its name
  scheduledJobs.set(name, task);
  
  // Store the mapping from schedule_id to name for lookup
  if (options.schedule_id) {
    scheduledJobIds.set(String(options.schedule_id), name);
  }
  
  logger.info(`Scheduled job ${name} with cron ${cronExpr}`);
}

export function listJobs() {
  return Array.from(scheduledJobs.keys());
}

export function cancelJob(nameOrId) {
  let jobName = nameOrId;
  
  // Check if this is a schedule_id lookup
  const mappedName = scheduledJobIds.get(String(nameOrId));
  if (mappedName) {
    jobName = mappedName;
  }
  
  const job = scheduledJobs.get(jobName);
  if (job) {
    job.stop();
    scheduledJobs.delete(jobName);
    
    // Remove the ID mapping and delete by ID
    if (job.options && job.options.schedule_id) {
      const scheduleId = job.options.schedule_id;
      scheduledJobIds.delete(String(scheduleId));
      deleteSchedule(scheduleId);
    } else {
      // Fallback to name if no ID available
      deleteSchedule(jobName);
    }
    
    logger.info(`Cancelled job ${jobName}`);
    return true;
  }
  logger.warn(`Job not found: ${nameOrId}`);
  return false;
}

export function cancelAllJobs() {
  for (const [id, job] of scheduledJobs.entries()) {
    job.stop();
    scheduledJobs.delete(id);
  }
  logger.info("All scheduled jobs cancelled.");
}
