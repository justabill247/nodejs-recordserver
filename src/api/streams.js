import express from "express";
import { getAllStreams, addStream, deleteStream } from "../db.js";

const router = express.Router();

/**
 * @openapi
 * /api/streams:
 *   get:
 *     summary: Get all streams
 *     responses:
 *       200:
 *         description: A list of all streams with info.
 */
router.get("/", (req, res) => {
  const streams = getAllStreams();
  res.json(streams);
});

/**
 * @openapi
 * /api/streams:
 *   post:
 *     summary: Create a new stream
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully created stream.
 */
router.post("/", (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: "name and url are required" });
  }

  addStream({ name, url });
  res.json({ success: true, message: `Stream '${name}' saved.` });
});

/**
 * @openapi
 * /api/streams/{streamId}:
 *   delete:
 *     description: Delete stream
 *     parameters:
 *       - in: path
 *         name: "streamId"
 *         schema:
 *             type: integer
 *             description: id of stream to delete
 *     responses:
 *       200:
 *         description: Successfully deleted stream.
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  deleteStream(id);
  res.json({ success: true, message: `Stream '${id}' deleted.` });
});

export default router;
