import db from "./index.js";
import { createLogger } from "../services/logger.js";
const logger = createLogger("DbStreams");

export function getAllStreams() {
  return db.prepare("SELECT * FROM streams ORDER BY name ASC").all();
}

export function addStream({ name, url, logo_url }) {
  db.prepare(
    `
    INSERT OR REPLACE INTO streams (name, url, logo_url)
    VALUES (?, ?, ?)
  `,
  ).run(name, url, logo_url);
  logger.info(`Added stream ${name}`);
}

export function getStreamDetails(idOrName) {
  return db
    .prepare(
      `
    SELECT * FROM streams WHERE id = ? OR name = ?
  `,
    )
    .get(idOrName, idOrName);
}

export function getStream(idOrName) {
  return db
    .prepare(
      `
    SELECT * FROM streams WHERE id = ? OR name = ?
  `,
    )
    .get(idOrName, idOrName);
}

export async function updateStream({ id, name, url, logo_url }) {
  try {
    const stmt = db.prepare(`
      UPDATE streams SET 
        name = ?,
        url = ?,
        logo_url = ?
      WHERE id = ?
    `);
    stmt.run(name, url, logo_url, id);
    logger.info(`Updated stream ${id}`);
    return true;
  } catch (err) {
    logger.error(`Error updating stream ${id}: ${err.message}`, err);
    throw err;
  }
}

export function deleteStream(id) {
  logger.info(`Deleting stream: ${id}`);
  db.prepare(
    `
    DELETE FROM streams WHERE id = ?
  `,
  ).run(id);
  logger.info(`Deleted stream id ${id}`);
}

export function getStreamDetailsWithRecordings(idOrName) {
  const stream = db
    .prepare(
      `
    SELECT * FROM streams WHERE id = ? OR name = ?
  `,
    )
    .get(idOrName, idOrName);

  if (!stream) return null;

  const recordings = db
    .prepare(
      `
    SELECT
      id,
      name,
      file_path,
      start_time,
      end_time,
      duration
    FROM recordings
    WHERE stream_id = ?
    ORDER BY start_time DESC
    `,
    )
    .all(stream.id);

  return {
    ...stream,
    recordings,
  };
}
