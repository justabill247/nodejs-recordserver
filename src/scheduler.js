import cron from "node-cron";
import { recordStream } from "./recorder.js";
import { addSchedule, getAllSchedules, deleteSchedule } from "./db.js";

const scheduledJobs = new Map();

// Called once on startup
export function scheduleRecordings() {
  const schedules = getAllSchedules();
  for (const s of schedules) {
    scheduleJob(s.name, s.cron, {
      url: s.source_url,
      duration: s.duration,
      name: s.name,
    }, false); // don't re-save to DB on reload
  }
  console.log(`🔁 Loaded ${schedules.length} saved jobs from DB`);
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
  console.log(`⏰ Scheduled job '${name}' with cron '${cronExpr}'`);

  if (saveToDb) {
    addSchedule({
      name,
      source_url: options.url,
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
    console.log(`🛑 Cancelled job '${name}'`);
    return true;
  }
  return false;
}
