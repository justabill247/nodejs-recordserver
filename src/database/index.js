import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createLogger } from "../services/logger.js";

dotenv.config();

const logger = createLogger("Database");

// Use environment variable or default to project root
const dbPath = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), "serverDb.db");

// Create folder if needed
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Connect to database
const db = new Database(dbPath);
logger.info(`Database initialized: ${dbPath}`);

export default db;
