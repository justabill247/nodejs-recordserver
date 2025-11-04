import { Router } from "express";
import { getAllRecordings } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(getAllRecordings());
});

export default router;
