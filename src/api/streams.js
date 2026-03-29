import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv"
import { getAllStreams, addStream, deleteStream } from "../database/dbStreams.js";
import {createLogger} from "../services/logger.js";
const logger = createLogger("API-Streams")

dotenv.config()

const router = express.Router();

// Use environment variable or default to project root/logos
const LOGOS_DIR = process.env.LOGOS_DIR || path.join(process.cwd(), 'logos')

if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true })
}

// --- Multer setup with file type validation ---
const allowedLogoTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, LOGOS_DIR),
  filename: (_, file, cb) => {
    // Sanitize filename: remove special characters, keep only alphanumeric and extension
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(sanitized)}`;
    cb(null, unique);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (_, file, cb) => {
    // Validate file type
    if (allowedLogoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedLogoTypes.join(', ')}`), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// --- API Routes ---

/**
 * Create a new stream
 * Supports: multipart/form-data with optional logo file
 */
router.post("/", upload.single("logo"), (req, res) => {
  try {
    // Handle multer errors
    if (!req.file && req.fileSize === 0) {
      return res.status(400).json({ error: "File upload failed." });
    }

    const { name, url } = req.body;
    const logo_url = req.file ? `/logos/${req.file.filename}` : null;

    if (!name || !url) {
      return res.status(400).json({ error: "Both 'name' and 'url' are required." });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlErr) {
      return res.status(400).json({ error: "Invalid URL format." });
    }

    logger.info(`Attempting to add stream: ${name}`);
    addStream({ name, url, logo_url });
    res.status(201).json({ success: true, message: `Stream '${name}' added successfully.` });
  } catch (err) {
    // Handle multer validation errors
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('File too large')) {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    logger.error(`Error adding stream: ${err.message}`, err);
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
    logger.error(`Error getting all streams ${err}`)
    res.status(500).json({ error: "Failed to load streams." });
  }
});

/**
 * Delete a stream by ID
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting stream: ${id}`);
    deleteStream(id);
    res.status(204).send(); // No content for successful deletion
  } catch (err) {
    logger.error(`Error deleting stream id ${id}: ${err.message}`, err);
    res.status(500).json({ error: "Failed to delete stream." });
  }
});

export default router;
