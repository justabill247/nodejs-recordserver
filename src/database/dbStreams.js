import db from "./index.js";
import { createLogger } from "../services/logger.js";
const logger = createLogger("DbRecordings")

export function getAllStreams() {
  return db.prepare("SELECT * FROM streams ORDER BY name ASC").all();
}

export function getStream(idOrName) {
  return db
    .prepare(
      `
    SELECT * FROM streams WHERE id = ? OR name = ?
  `
    )
    .get(idOrName, idOrName);
}

export function addStream({ name, url, logo_url }) {
  db.prepare(
    `
    INSERT OR REPLACE INTO streams (name, url, logo_url)
    VALUES (?, ?, ?)
  `
  ).run(name, url, logo_url);
  logger.info(`Added stream ${name}`)
}

export function deleteStream(id) {
  console.log("deleting stream", id);
  db.prepare(
    `
    DELETE FROM streams WHERE id = ?
  `
  ).run(id);
  logger.info(`Deleted stream id ${id}`)
}