import { Router } from "express";
import { getAllRecordings, getAllRecordingsWithStreamInfo, deleteAllRecordings, deleteRecording, getRecordingsByStreamId } from "../database/dbRecordings.js";
import fs from "fs"
import path from "path"
import {createLogger} from "../services/logger.js";
import { recordStream } from "../services/recorder.js";
import { getStream } from "../database/dbStreams.js";
const logger = createLogger("API-Recordings")

const router = Router();

/**
 * @openapi
 * /api/recordings:
 *   get:
 *     summary: Get all recordings
 *     responses:
 *       200:
 *         description: A list of all recordings.
 */
router.get("/", (req, res) => {
    try {
    const recordings = getAllRecordingsWithStreamInfo();
    res.json( recordings );
  } catch (err) {
    logger.error("Error getting recordings:", err);
    res.status(500).json({ error: "Failed to get recordings" });
  }
});

/**
 * @openapi
 * /api/recordings/record-now:
 *   post:
 *     summary: Start a one-time recording
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - duration
 *             properties:
 *               streamId:
 *                 type: integer
 *                 description: Stream ID to record from
 *               url:
 *                 type: string
 *                 description: Custom stream URL (used if streamId not provided)
 *               duration:
 *                 type: integer
 *                 description: Recording duration in seconds
 *     responses:
 *       200:
 *         description: Recording started successfully
 *       400:
 *         description: Missing required parameters
 *       404:
 *         description: Stream not found
 */
router.post("/record-now", async (req, res) => {
  try {
    const { streamId, url, duration } = req.body;

    if (!duration || duration <= 0) {
      return res.status(400).json({ error: "Duration must be a positive number" });
    }

    // Get stream URL
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
      return res.status(400).json({ error: "Must provide either streamId or custom url" });
    }

    // Start the recording
    const streamName = finalStreamId 
      ? getStream(finalStreamId)?.name 
      : "Custom URL";
    
    const recordingPromise = recordStream({
      url: finalUrl,
      id: finalStreamId,
      stream_name: streamName,
      duration,
      name: `One-time Recording ${new Date().toLocaleString()}`,
      schedule_id: null // No schedule for one-time recordings
    });

    // Respond immediately (recording happens in background)
    res.json({
      success: true,
      message: `Recording started for ${duration} seconds`,
      streamUrl: finalUrl,
      duration
    });

    // Log when recording completes (non-blocking)
    recordingPromise
      .then((file) => logger.info(`One-time recording completed: ${file}`))
      .catch((err) => logger.error(`One-time recording failed: ${err.message}`));

  } catch (err) {
    logger.error("Error starting recording:", err);
    res.status(500).json({ error: "Failed to start recording" });
  }
});

/**
 * @openapi
 * /api/recordings/all:
 *   delete:
 *     description: Delete all schedules
 *     responses:
 *       200:
 *         description: Successfully deleted all schedules.
 */
router.delete("/all", async(req, res) => {
  try {
    const recordings = getAllRecordings();

    //Remove each file from disk if it exists
    for(const rec of recordings) {
      if(rec.file_path && fs.existsSync(rec.file_path)) {
        try {
          fs.unlinkSync(rec.file_path);
          logger.info(`Deleted file: ${rec.file_path}`);
        } catch (err){
          logger.warn(`Could not delete file ${rec.file_path}:`, err.message)
        }
      }
    }

    //delete all from database
    deleteAllRecordings();
    logger.info("All recordings removed from database and storage")

    res.json({success: true, message: "All recordings deleted successfully"});
  } catch (err) {
    logger.error("Error deleting all recordings:", err)
    res.status(500).json({error:"Failed to delete recordings."})
  }
})

/**
 * @openapi
 * /api/recordings/{id}:
 *   delete:
 *     summary: Delete a specific recording
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recording ID
 *     responses:
 *       200:
 *         description: Successfully deleted recording
 *       404:
 *         description: Recording not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get recording to find file path
    const recordings = getAllRecordings();
    const recording = recordings.find(r => r.id === parseInt(id));
    
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    // Delete file from disk if it exists
    if (recording.file_path && fs.existsSync(recording.file_path)) {
      try {
        fs.unlinkSync(recording.file_path);
        logger.info(`Deleted file: ${recording.file_path}`);
      } catch (err) {
        logger.warn(`Could not delete file ${recording.file_path}:`, err.message);
      }
    }

    // Delete from database
    deleteRecording(id);
    logger.info(`Deleted recording ${id}`);

    res.json({ success: true, message: "Recording deleted successfully" });
  } catch (err) {
    logger.error("Error deleting recording:", err);
    res.status(500).json({ error: "Failed to delete recording" });
  }
});

export default router;
