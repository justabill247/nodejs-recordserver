import express from "express";
import cron from "node-cron";
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

/**
 * Validate cron expression
 * @param {string} cronExpr - Cron expression to validate
 * @returns {boolean} - True if valid
 */
function isValidCronExpression(cronExpr) {
  try {
    return cron.validate(cronExpr);
  } catch {
    return false;
  }
}

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

  // Validate cron expression
  if (!isValidCronExpression(cron)) {
    return res.status(400).json({ error: "Invalid cron expression format" });
  }

  // Validate duration is a positive number
  if (typeof duration !== 'number' || duration <= 0) {
    return res.status(400).json({ error: "Duration must be a positive number" });
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
    });
    logger.info(`Saved schedule '${name}' to id ${scheduleId}`);

    // Schedule the recording with cronScheduler
    scheduleJob(name, cron, { 
      url: finalUrl, 
      id: finalStreamId, 
      duration, 
      name, 
      schedule_id: scheduleId
    }, false);

    logger.info(`Scheduled job '${name}' with cron: ${cron}`);
    res.status(201).json({ 
      success: true, 
      message: `Scheduled '${name}' for ${cron} (duration: ${duration}s)`,
      scheduleId 
    });
  } catch (err) {
    logger.error(`Error adding schedule: ${err.message}`, err);
    res.status(500).json({ error: "Failed to schedule job" });
  }
});

/**
 * @openapi
 * /api/schedule/all:
 *   delete:
 *     description: Delete all schedules
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteRecordings:
 *                 type: boolean
 *                 description: Also delete all associated recordings
 *     responses:
 *       200:
 *         description: Successfully deleted all schedules.
 */
router.delete("/all", (req, res) => {
  const { deleteRecordings = false } = req.body || {};
  try {
    cancelAllJobs();
    deleteAllSchedules(deleteRecordings);
    logger.info(`All schedules deleted${deleteRecordings ? ' and all recordings deleted' : ''}`);
    res.json({ success: true, message: `Deleted all schedules${deleteRecordings ? ' and all recordings' : ''}` });
  } catch (err) {
    logger.error(`Error deleting all schedules: ${err.message}`, err);
    res.status(500).json({ error: "Failed to delete all schedules" });
  }
});

/**
 * @openapi
 * /api/schedule/{id}:
 *   delete:
 *     description: Delete schedule by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of schedule to delete
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteRecordings:
 *                 type: boolean
 *                 description: Also delete all associated recordings
 *     responses:
 *       200:
 *         description: Successfully deleted schedule.
 *       404:
 *         description: Schedule not found.
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const { deleteRecordings = false } = req.body || {};

  try {
    const canceled = cancelJob(id, deleteRecordings);
    if (!canceled) {
      return res.status(404).json({ error: "Schedule not found or not active" });
    }
    logger.info(`Deleted schedule: ${id}${deleteRecordings ? ' and associated recordings' : ''}`);
    res.json({ success: true, message: `Deleted schedule '${id}'${deleteRecordings ? ' and associated recordings' : ''}` });
  } catch (err) {
    logger.error(`Error deleting schedule ${id}: ${err.message}`, err);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

export default router;
