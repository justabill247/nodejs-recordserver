import Database from "better-sqlite3";

import path from "path";
import fs from "fs";
import { createLogger } from "../services/logger.js";
const logger = createLogger("Database")

// always point to project root
const dbPath = path.join(process.cwd(), "serverDb.db")

// create folder if needed
const dir = path.dirname(dbPath)
if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true})

// connect to database
const db = new Database(dbPath);
logger.info(`Database loaded: ${dbPath}`)

export default db;
