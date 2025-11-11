import express from "express";
import { scheduleJob, cancelJob, cancelAllJobs, listJobs } from "../cronScheduler.js";
import {
  addSchedule,
  deleteAllSchedules,
  deleteSchedule,
  getAllSchedulesWithStreamInfo,
  getStream
} from "../db.js";

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

/**
 * @openapi
 * /api/schedule:
 *   post:
 *     summary: Create a new scheduled recording
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               cron:
 *                 type: string
 *               duration:
 *                 type: integer
 *               streamId:
 *                 type: integer
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully created schedule.
 */
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

  try {
    // Schedule the recording job, save it to db
    scheduleJob(name, cron, { url: finalUrl, id: finalStreamId, duration, name }, true);


    res.json({ success: true, message: `Scheduled '${name}' for ${cron} for ${duration}` });
  } catch (err) {
    console.error("Error scheduling job:", err);
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
    console.error("Error deleting schedule:", err);
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
