import { Router } from "express";
import { getAllRecordings, getAllRecordingsWithStreamInfo, deleteAllRecordings } from "../database/dbRecordings.js";
import fs from "fs"
import path from "path"
import {createLogger} from "../services/logger.js";
const logger = createLogger("API-Recordings")

const router = Router();

/**
 * @openapi
 * /api/recordings:
 *   get:
 *     summary: Get all streams
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
 * /api/recordings/all:
 *   delete:
 *     description: Delete all schedules
 *     responses:
 *       200:
 *         description: Successfully deleted all recordings.
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
    console.error("Error deleting all recorings:", err)
    res.status(500).json({error:"Failed to delete recordings."})
  }
})

export default router;
