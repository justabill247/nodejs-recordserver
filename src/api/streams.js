import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv"
import { getAllStreams, addStream, deleteStream } from "../database/db.js";

dotenv.config()

const router = express.Router();

const LOGOS_DIR = process.env.LOGOS_DIR || path.join(process.cwd(), logos)

if(!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, {recursive: true})
}

// --- Multer setup ---
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, LOGOS_DIR),
  filename: (_, file, cb) => {
    //randomized unique file name
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({ storage });

// --- API Routes ---

/**
 * Create a new stream
 * Supports: multipart/form-data with optional logo file
 */
router.post("/", upload.single("logo"), (req, res) => {
  try {
    const { name, url } = req.body;
    const logo_url = req.file ? `/logos/${req.file.filename}` : null;

    if (!name || !url) {
      return res.status(400).json({ error: "Both 'name' and 'url' are required." });
    }

    addStream({ name, url, logo_url });
    console.log(`✅ Stream added: ${name} (${url})`);
    res.json({ success: true, message: `Stream '${name}' added successfully.` });
  } catch (err) {
    console.error("❌ Error adding stream:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * Get all streams
 */
router.get("/", (req, res) => {
  try {
    const streams = getAllStreams();
    res.json(streams);
  } catch (err) {
    console.error("❌ Error fetching streams:", err);
    res.status(500).json({ error: "Failed to load streams." });
  }
});

/**
 * Delete a stream by ID
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    deleteStream(id);
    console.log(`🗑️  Stream deleted: ${id}`);
    res.json({ success: true, message: `Stream '${id}' deleted.` });
  } catch (err) {
    console.error("❌ Error deleting stream:", err);
    res.status(500).json({ error: "Failed to delete stream." });
  }
});

export default router;
