import dotenv from "dotenv"
dotenv.config()

import express from "express"
import path from "path"
import fs from "fs"

import recordingsRouter from "./api/recordings.js";
import scheduleRouter from "./api/schedule.js";
import { scheduleRecordings } from "./scheduler.js";

// --- setup express --- 
const app = express();
const PORT = process.env.PORT || 4000;
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "recordings";


app.use(express.json());

app.use("/api/recordings", recordingsRouter);
app.use("/api/schedule", scheduleRouter);

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
    <p>Available endpoints:</p>
    <ul>
      <li><code>GET /api/recordings</code> — list all recorded files</li>
      <li><code>GET /api/schedule</code> — list all scheduled jobs</li>
      <li><code>POST /api/schedule</code> — schedule a new recording</li>
      <li><code>DELETE /api/schedule/:name</code> — cancel a schedule</li>
      <li><code>/audio/&lt;filename&gt;</code> — access recorded files</li>
    </ul>
  `);
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📂 Serving recordings from: ${RECORDINGS_DIR}`);
});