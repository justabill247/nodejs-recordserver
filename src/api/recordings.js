import { Router } from "express";
import { getAllRecordings, getAllRecordingsWithStreamInfo, deleteAllRecordings } from "../db.js";
import fs from "fs"
import path from "path"

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
    console.log('recordings',recordings)
    res.json( recordings );
  } catch (err) {
    console.error("Error getting recordings:", err);
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
          console.log(`Deleted file: ${rec.file_path}`);
        } catch (err){
          console.warn(`Could not delete file ${rec.file_path}:`, err.message)
        }
      }
    }

    //delete all from database
    deleteAllRecordings();
    console.log("All recordings removed from database and storage")

    res.json({success: true, message: "All recordings deleted successfully"});
  } catch (err) {
    console.error("Error deleting all recorings:", err)
    res.status(500).json({error:"Failed to delete recordings."})
  }
})

export default router;
