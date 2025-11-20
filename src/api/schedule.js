import express from "express";
import { scheduleJob, cancelJob, cancelAllJobs, listJobs } from "../services/cronScheduler.js";
import {
  addSchedule,
  deleteAllSchedules,
  deleteSchedule,
  getAllSchedulesWithStreamInfo,
  getScheduleDetails,
} from "../database/dbSchedule.js";
import {getStream } from "../database/dbStreams.js"
import { createLogger } from "../services/logger.js";
const logger = createLogger("API-Schedule")

const router = express.Router();

/**
 * @openapi
 * /api/schedule:
 *   get:
 *     summary: Get all schedules
 *     responses:
 *       200:
 *         description: A list of all scheduled recordings.
 */
router.get("/", (req, res) => {
  const schedules = getAllSchedulesWithStreamInfo();
  res.json({
    activeJobs: listJobs(),
    schedules
  });
});

router.get("/:id/details", (req, res) => {
  const scheduleId = req.params.id;
  const details = getScheduleDetails(scheduleId)
  if(!details) {
    return res.status(404).json({error: "Schedule not found"})
  }
  res.json(details)
})

// --- Add a schedule ---
router.post("/", (req, res) => {
  const { name, cron, duration, streamId, url } = req.body;

  if (!name || !cron || !duration) {
    return res.status(400).json({ error: "Missing required fields: name, cron, duration" });
  }

  // Determine final stream details
  let finalUrl = url;
  let finalStreamId = streamId || null;

  if (!finalUrl && finalStreamId) {
    const stream = getStream(finalStreamId);
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }
    finalUrl = stream.url;
  }

  if (!finalUrl) {
    return res.status(400).json({ error: "Must include a stream URL or streamId" });
  }
  
  // save schedule to db, then schedule it with cron
  try {
    
    // save schedule to db first
    const scheduleId = addSchedule({
      name,
      source_url: finalUrl,
      stream_id: finalStreamId,
      cron,
      duration
    })
    logger.info(`saved to id ${scheduleId}`)

    // Schedule the recording with cronScheduler, pass
    scheduleJob(name, cron, { url: finalUrl, id: finalStreamId, duration, name, schedule_id: scheduleId}, false);


    res.json({ success: true, message: `Scheduled '${name}' for ${cron} for ${duration}` });
  } catch (err) {
    logger.error(`Error adding schedule ${err}`)
    res.status(500).json({ error: "Failed to schedule job" });
  }
});

/**
 * @openapi
 * /api/schedule/{scheduleName}:
 *   delete:
 *     description: Delete schedule
 *     parameters:
 *       - in: path
 *         name: "scheduleName"
 *         schema:
 *             string: integer
 *             description: name of schedule to delete
 *     responses:
 *       200:
 *         description: Successfully deleted schedule.
 */
router.delete("/:name", (req, res) => {
  const { name } = req.params;

  try {
    cancelJob(name);
    deleteSchedule(name);
    res.json({ success: true, message: `Deleted schedule '${name}'` });
  } catch (err) {
    logger.error(`Error deleting schedule ${err}`)
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

/**
 * @openapi
 * /api/schedule/:
 *   delete:
 *     description: Delete all schedules
 *     responses:
 *       200:
 *         description: Successfully deleted all schedules.
 */
router.post("/deleteAll", (req, res) => {

    cancelAllJobs();
    deleteAllSchedules();
    res.json({ success: true, message: `Deleted all schedules` });

});

export default router;
