import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { addRecording } from "../database/dbRecordings.js";
import { spawn } from "child_process";
import { wsManager } from "./wsManager.js";

import { createLogger } from "./logger.js";
const logger = createLogger("Recorder");
const ffmpegLogger = createLogger("FFmpeg");
const ffmpegLogMode = (process.env.FFMPEG_LOG_MODE || "basic").toLowerCase();

// Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatRecordingContext({ recordingId, name, scheduleId, streamId, outputFile }) {
  return `[${recordingId}] name="${name}" schedule=${scheduleId ?? "none"} stream=${streamId ?? "none"} output="${outputFile}"`;
}

function flushFfmpegLines(bufferState, logLine) {
  let buffer = bufferState.buffer;
  let delimiterIndex = buffer.search(/[\r\n]/);

  while (delimiterIndex !== -1) {
    const rawLine = buffer.slice(0, delimiterIndex);
    const delimiter = buffer[delimiterIndex];
    const nextIndex = delimiterIndex + (delimiter === "\r" && buffer[delimiterIndex + 1] === "\n" ? 2 : 1);
    const line = rawLine.trim();

    if (line) {
      logLine(line);
    }

    buffer = buffer.slice(nextIndex);
    delimiterIndex = buffer.search(/[\r\n]/);
  }

  bufferState.buffer = buffer;
}

function classifyFfmpegLine(line) {
  if (/\b(error|failed|invalid|unable|could not)\b/i.test(line)) {
    return "error";
  }

  if (/\b(warn(ing)?)\b/i.test(line)) {
    return "warn";
  }

  return "info";
}

function isProgressLine(line) {
  return /(size=|time=|bitrate=|speed=)/i.test(line);
}

function isWarningOrErrorLine(line) {
  return classifyFfmpegLine(line) !== "info";
}

function isSuppressedFfmpegLine(line) {
  return [
    /Queue input is backward in time/i,
    /Non-monotonic DTS/i,
    /incorrect timestamps in the output file/i,
  ].some((pattern) => pattern.test(line));
}

function shouldLogFfmpegLine(line) {
  if (isSuppressedFfmpegLine(line)) {
    return false;
  }

  if (isProgressLine(line)) {
    return ffmpegLogMode !== "quiet";
  }

  if (isWarningOrErrorLine(line)) {
    return true;
  }

  return ffmpegLogMode === "verbose";
}

function getProgressLogIntervalMs(durationSeconds) {
  if (durationSeconds >= 3600) {
    return 10 * 60 * 1000;
  }

  if (durationSeconds > 600) {
    return 5 * 60 * 1000;
  }

  return null;
}

/**
 * Record an audio-only M3U8 stream to an .m4a file using FFmpeg.
 * @param {Object} streamObject - Recording configuration
 * @param {string} streamObject.url - The M3U8 stream URL.
 * @param {number} streamObject.duration - Duration in seconds.
 * @param {string} streamObject.name - Recording name.
 * @param {string} streamObject.id - Stream ID (optional).
 * @param {string} streamObject.schedule_id - Schedule ID (optional).
 * @returns {Promise<string>} - Resolves with the output file path.
 */
export function recordStream(streamObject) {
  return new Promise((resolve, reject) => {
    // Validate streamObject
    if (!streamObject || !streamObject.url || !streamObject.duration) {
      const err = new Error("Invalid streamObject: url and duration are required");
      logger.error(err.message);
      return reject(err);
    }

    // Ensure recordings folder exists
    const recordingsDir = path.join(__dirname, "..", "..", "recordings");
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    // Timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `recording_${timestamp}.m4a`;
    const outputFile = path.join(recordingsDir, filename);

    // FFmpeg command
    const ffArgs = [
      "-y",
      "-i",
      streamObject.url,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-t",
      String(streamObject.duration),
      outputFile,
    ];



    // --- spawn ffmpeg process ---
    const ffmpeg = spawn("ffmpeg", ffArgs);
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const recordingContext = formatRecordingContext({
      recordingId,
      name: streamObject.name,
      scheduleId: streamObject.schedule_id,
      streamId: streamObject.id,
      outputFile,
    });
    const ffmpegStartedAt = Date.now();
    logger.info(`Recording started for ${streamObject.name} for ${streamObject.duration}s sid ${streamObject.schedule_id}`);
    const startTime = new Date().toISOString();
    ffmpegLogger.info(
      `${recordingContext} Spawning ffmpeg with duration=${streamObject.duration}s url="${streamObject.url}" args=${JSON.stringify(ffArgs)}`,
    );

    // Notify WebSocket that recording started
    wsManager.startRecording(recordingId, streamObject.name, streamObject.duration, streamObject.stream_name || "Unknown");

    // Capture ffmpeg output for debugging
    let ffmpegOutput = "";
    let stderrBuffer = "";
    let stdoutBuffer = "";
    let lastProgressLogAt = 0;
    let lastProgressLine = "";
    const progressLogIntervalMs = getProgressLogIntervalMs(streamObject.duration);

    const logFfmpegLine = (line, source) => {
      if (isProgressLine(line)) {
        lastProgressLine = line;
        if (ffmpegLogMode === "quiet" || progressLogIntervalMs === null) {
          return;
        }

        const now = Date.now();
        if (now - lastProgressLogAt >= progressLogIntervalMs) {
          lastProgressLogAt = now;
          ffmpegLogger.info(`${recordingContext} progress: ${line}`);
        }
        return;
      }

      if (!shouldLogFfmpegLine(line)) {
        return;
      }

      const level = classifyFfmpegLine(line);
      ffmpegLogger.log(level, `${recordingContext} ${source}: ${line}`);
    };

    ffmpeg.on("spawn", () => {
      ffmpegLogger.info(`${recordingContext} FFmpeg process started with pid=${ffmpeg.pid}`);
    });

    // watch for stderr data
    ffmpeg.stderr.on("data", (data) => {
      const chunk = data.toString();
      ffmpegOutput += chunk;
      stderrBuffer += chunk;
      flushFfmpegLines({
        get buffer() {
          return stderrBuffer;
        },
        set buffer(value) {
          stderrBuffer = value;
        },
      }, (line) => logFfmpegLine(line, "stderr"));
    });

    // watch for stdout data
    ffmpeg.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      flushFfmpegLines({
        get buffer() {
          return stdoutBuffer;
        },
        set buffer(value) {
          stdoutBuffer = value;
        },
      }, (line) => logFfmpegLine(line, "stdout"));
    });
    
    // watchdog timer in case something goes wrong and ffmpeg hangs
    const timeout = setTimeout(() => {
      if (!ffmpeg.killed) {
        logger.error("FFmpeg didn't end after duration — stopping FFmpeg cleanly...");
        ffmpegLogger.error(`${recordingContext} FFmpeg exceeded duration watchdog and will be stopped with SIGINT`);
        ffmpeg.kill("SIGINT");
      }
    }, streamObject.duration * 1000 + 5000); // Add 5s buffer

    // when ffmpeg closes
    ffmpeg.on("close", (code, signal) => {
      // Clear timeout
      clearTimeout(timeout);

      if (stderrBuffer.trim()) {
        logFfmpegLine(stderrBuffer.trim(), "stderr");
      }

      if (stdoutBuffer.trim()) {
        logFfmpegLine(stdoutBuffer.trim(), "stdout");
      }

      // Notify WebSocket that recording stopped
      wsManager.stopRecording(recordingId);

      const elapsedSeconds = Math.round((Date.now() - ffmpegStartedAt) / 1000);
      ffmpegLogger.info(
        `${recordingContext} FFmpeg closed code=${code} signal=${signal ?? "none"} elapsed=${elapsedSeconds}s${
          lastProgressLine ? ` lastProgress="${lastProgressLine}"` : ""
        }`,
      );

      // Recording was not successful
      if (code !== 0) {
        logger.error(`FFmpeg exited with code: ${code}, signal: ${signal}`);
        logger.error(`FFmpeg output: ${ffmpegOutput}`);
        
        // Clean up failed recording file if it exists
        if (fs.existsSync(outputFile)) {
          try {
            fs.unlinkSync(outputFile);
            logger.warn(`Removed incomplete recording: ${outputFile}`);
          } catch (unlinkErr) {
            logger.error(`Failed to remove incomplete recording: ${unlinkErr.message}`);
          }
        }
        
        return reject(new Error(`FFmpeg exited with code ${code}`));
      } 
      
      // Recording was successful - save to database
      try {
        addRecording({
          name: streamObject.name,
          source_url: streamObject.url,
          stream_id: streamObject.id,
          file_path: outputFile,
          start_time: startTime,
          end_time: new Date().toISOString(),
          duration: streamObject.duration,
          schedule_id: streamObject.schedule_id,
        });

        logger.info(`Recording saved to ${outputFile}`);
        resolve(outputFile);
      } catch (dbErr) {
        logger.error(`Failed to save recording to database: ${dbErr.message}`);
        // Still resolve since the file was recorded successfully
        resolve(outputFile);
      }
    });

    // Handle ffmpeg process errors
    ffmpeg.on("error", (err) => {
      clearTimeout(timeout);
      logger.error(`Failed to start FFmpeg: ${err.message}`);
      ffmpegLogger.error(`${recordingContext} Failed to start FFmpeg: ${err.message}`, err);
      reject(err);
    });
  });
}
