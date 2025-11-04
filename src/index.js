import dotenv from "dotenv"
dotenv.config()

import express from "express"
import path from "path"
import fs from "fs"

import { setupSwagger } from "./swagger.js"

import recordingsRouter from "./api/recordings.js";
import scheduleRouter from "./api/schedule.js";
import streamRouter from "./api/streams.js";

import { scheduleRecordings } from "./scheduler.js";

// --- setup express --- 
const app = express();
const PORT = process.env.PORT || 4000;
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "recordings";


app.use(express.json());

app.use("/api/recordings", recordingsRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/streams", streamRouter);

setupSwagger(app);

// --- Serve Recorded Files ---
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}
app.use("/audio", express.static(path.resolve(RECORDINGS_DIR)));

// --- Load and Reschedule Saved Jobs ---
scheduleRecordings();

// --- Root Endpoint ---
app.get("/", (req, res) => {
  res.send(`
    <h1>🎙️ Recording Server</h1>
  `);
});

// --- Start Server ---
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📘 API Explorer available at http://localhost:${port}/api-docs`);
  console.log(`📂 Serving recordings from: ${RECORDINGS_DIR}`);
});