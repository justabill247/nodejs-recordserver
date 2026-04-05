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

// --- Logs folder at project root (support env var for containers) ---
const logDir = process.env.LOGS_DIR || path.join(projectRoot, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const loggerLevel = process.env.LOG_LEVEL || "info";

const processOnlyFilter = winston.format((info) => {
  return info.class === "ProcessLifecycle" ? info : false;
});

const consoleTransport = new winston.transports.Console({
  handleExceptions: true,
  handleRejections: true,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(
      (info) =>
        `${info.timestamp} [${info.class || "unknown"}] ${info.level}: ${info.message}${
          info.stack ? "\n" + info.stack : ""
        }`,
    ),
  ),
});

const fileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: "recordServer-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  handleExceptions: true,
  handleRejections: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
});

const processFileTransport = new winston.transports.File({
  dirname: logDir,
  filename: "process.log",
  handleExceptions: true,
  handleRejections: true,
  format: winston.format.combine(
    processOnlyFilter(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
});

// --- Base logger ---
const logger = winston.createLogger({
  level: loggerLevel,
  exitOnError: false,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
  ),
  transports: [consoleTransport, fileTransport, processFileTransport],
});

let processLoggingRegistered = false;

export function registerProcessEventLogging(className = "Process") {
  if (processLoggingRegistered) {
    return;
  }

  processLoggingRegistered = true;
  const processLogger = createLogger(className);

  processLogger.info(
    `Process started pid=${process.pid} ppid=${process.ppid} node=${process.version} argv=${process.argv.join(" ")}`,
  );

  process.on("warning", (warning) => {
    processLogger.warn(`Process warning: ${warning.name}: ${warning.message}`);
  });

  process.on("uncaughtExceptionMonitor", (error, origin) => {
    processLogger.error(`Uncaught exception (${origin}): ${error.message}`, error);
  });

  process.on("unhandledRejection", (reason) => {
    const rejectionError = reason instanceof Error ? reason : new Error(String(reason));
    processLogger.error(`Unhandled rejection: ${rejectionError.message}`, rejectionError);
  });

  process.on("beforeExit", (code) => {
    processLogger.warn(`Process beforeExit with code ${code}`);
  });

  process.on("exit", (code) => {
    processLogger.warn(`Process exit with code ${code}`);
  });

  process.once("SIGUSR2", () => {
    processLogger.warn("Received SIGUSR2. nodemon is restarting the process.");
    setTimeout(() => {
      process.kill(process.pid, "SIGUSR2");
    }, 100);
  });
}

// --- Helper to create class/module-specific loggers ---
export function createLogger(className) {
  return logger.child({ class: className });
}

export default logger;
