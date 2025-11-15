// logger.js
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// --- Recreate __dirname for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..","..");

// --- Logs folder at project root ---
const logDir = path.join(projectRoot, "logs");
console.log(`logdir ${logDir}`)
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// --- Base logger ---
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true })
  ),
  transports: [
    // console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) =>
            `${info.timestamp} [${info.class || "unknown"}] ${info.level}: ${info.message}${
              info.stack ? "\n" + info.stack : ""
            }`
        )
      ),
    }),

    // rotating json log file transport
    new DailyRotateFile({
      dirname: logDir,
      filename: "recordServer-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    }),
  ],
});

// --- Helper to create class/module-specific loggers ---
export function createLogger(className) {
  return logger.child({ class: className });
}

export default logger;
