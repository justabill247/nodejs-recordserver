import dotenv from "dotenv"
dotenv.config({ override: true })
import { runMigrations } from "./database/migrations.js";
import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import mime from "mime"

import { setupSwagger } from "./api/swagger.js"

import recordingsRouter from "./api/recordings.js";
import scheduleRouter from "./api/schedule.js";
import streamRouter from "./api/streams.js";

import { scheduleRecordings } from "./services/cronScheduler.js";

import {createLogger} from "./services/logger.js"
const logger = createLogger("Init")

// es modules fix
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Project Root Directory path
const ROOT_DIR = path.resolve(__dirname, "..")

// --- Directories for recordings and logos at project root ---
const RECORDINGS_DIR = path.join(ROOT_DIR, "recordings");
const LOGOS_DIR = path.join(ROOT_DIR, "logos")

// Create folders if missing
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

// init db
runMigrations()

app.use(express.json());

app.use(
  cors({
    origin: allowedOrigin || "*",
    credentials: true
  })
)

// --- Swagger ---
setupSwagger(app);

// --- API Routes ===
app.use("/api/recordings", recordingsRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/streams", streamRouter);



// --- Serve Recordings ---
app.use(
  "/audio",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    const filePath = path.join(RECORDINGS_DIR, req.path);
    if (fs.existsSync(filePath)) {
      const type = mime.getType(filePath) || "audio/mp4";
      res.type(type);
    }
    next();
  },
  express.static(RECORDINGS_DIR)
);

app.get("/debug/audio", (req, res) => {
  logger.info("Recordings directory:", RECORDINGS_DIR);
  res.json({
    exists: fs.existsSync(path.join(RECORDINGS_DIR, "rec.m4a")),
    path: path.join(RECORDINGS_DIR, "rec.m4a")
  });
});

// --- Serve Logos ---
app.use("/logos", express.static(LOGOS_DIR));

// --- Load and Reschedule Saved Jobs ---
scheduleRecordings();

// --- Root Endpoint ---
app.get("/", (req, res) => {
  res.send(`
    <h1>🎙️ Recording Server</h1>
  `);
});

// --- Start Server ---

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Serving recordings from: ${RECORDINGS_DIR}` );
  logger.info(`Serving logos from: ${LOGOS_DIR}`);
});