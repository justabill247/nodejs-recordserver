import { Router } from "express";
import { scheduleJob, listJobs, cancelJob } from "../scheduler.js";
import { getAllSchedules } from "../db.js";

const router = Router();

// POST /api/schedule → create a new scheduled recording
router.post("/", (req, res) => {
  const { url, name, cron, duration } = req.body;

  if (!url || !name || !cron || !duration) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    scheduleJob(name, cron, { url, duration, name });
    res.json({ message: `Scheduled '${name}'`, cron });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule → list all schedules from DB
router.get("/", (req, res) => {
  res.json({ jobs: getAllSchedules() });
});

// DELETE /api/schedule/:name → cancel and remove a job
router.delete("/:name", (req, res) => {
  const { name } = req.params;
  const success = cancelJob(name);
  if (success) res.json({ message: `Cancelled '${name}'` });
  else res.status(404).json({ error: "Job not found" });
});

export default router;
