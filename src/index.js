import dotenv from "dotenv"
dotenv.config({ override: true })
import { runMigrations } from "./database/migrations.js";
import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import mime from "mime"
import http from "http"

import { setupSwagger } from "./api/swagger.js"

import recordingsRouter from "./api/recordings.js";
import scheduleRouter from "./api/schedule.js";
import streamRouter from "./api/streams.js";

import { getScheduleStateSnapshot, scheduleRecordings } from "./services/cronScheduler.js";
import { wsManager } from "./services/wsManager.js";

import {createLogger, registerProcessEventLogging} from "./services/logger.js"
const logger = createLogger("Init")

// es modules fix
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Project Root Directory path
const ROOT_DIR = path.resolve(__dirname, "..")

// --- Directories for recordings, logos, and frontend (support env vars for containers) ---
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(ROOT_DIR, "recordings");
const LOGOS_DIR = process.env.LOGOS_DIR || path.join(ROOT_DIR, "logos");
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(ROOT_DIR, "public");

// Create folders if missing
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
if (!fs.existsSync(FRONTEND_DIR)) fs.mkdirSync(FRONTEND_DIR, { recursive: true });

// .env variables
const PORT = process.env.PORT || 4000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

registerProcessEventLogging("ProcessLifecycle");

// --- Init Database
runMigrations()

// --- Load and Reschedule Saved Jobs ---
scheduleRecordings();

// --- Init the express API app
const app = express()
app.use(express.json());

// --- Use CORS Middleware ---
app.use(
  cors({
    origin: allowedOrigin || "*",
    credentials: true
  })
)

// --- Serve Swagger API Explorer ---
setupSwagger(app);

// --- Serve API Routes ===
app.use("/api/recordings", recordingsRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/streams", streamRouter);

// --- Serve Recording files at /audio ---
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

// --- Serve Logo files at /logos---
app.use("/logos", express.static(LOGOS_DIR));

// --- Serve Frontend SPA (Vue) ---
app.use("/", express.static(FRONTEND_DIR));

// SPA Fallback: redirect all non-API, non-asset routes to index.html for Vue Router
app.use((req, res, next) => {
  // Skip API and static file routes
  if (req.path.startsWith("/api") || req.path.startsWith("/audio") || req.path.startsWith("/logos")) {
    return next();
  }
  
  // Check if file exists before falling back to index.html
  const filePath = path.join(FRONTEND_DIR, req.path);
  if (!fs.existsSync(filePath)) {
    const indexPath = path.join(FRONTEND_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// --- Start Server ---
const server = http.createServer(app);
wsManager.initialize(server, { getScheduleState: getScheduleStateSnapshot });

server.listen(PORT, () => {
  logger.info(`API Server running on http://localhost:${PORT}`);
  logger.info(`WebSocket server ready at ws://localhost:${PORT}/ws`);
  logger.info(`Serving frontend from: ${FRONTEND_DIR}`);
  logger.info(`Serving recordings from: ${RECORDINGS_DIR}` );
  logger.info(`Serving logos from: ${LOGOS_DIR}`);
});