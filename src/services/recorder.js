import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { addRecording } from "../database/dbRecordings.js";
import { spawn } from "child_process";
import { wsManager } from "./wsManager.js";

import { createLogger } from "./logger.js";
const logger = createLogger("Recorder");
const logProgress = process.env.LOG_PROGRESS !== "false"

// Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`Recording started for ${streamObject.name} for ${streamObject.duration}s sid ${streamObject.schedule_id}`);
    const startTime = new Date().toISOString();

    // Notify WebSocket that recording started
    wsManager.startRecording(recordingId, streamObject.name, streamObject.duration, streamObject.stream_name || "Unknown");

    // Capture ffmpeg output for debugging
    let ffmpegOutput = "";

    // watch for stderr data
    ffmpeg.stderr.on("data", (data) => {
      const line = data.toString();
      ffmpegOutput += line;
      // lines that indicate recording in progress
      if (line.includes("size=") || line.includes("time=")) {
        if (logProgress) process.stdout.write(".");
      }
    });

    // watch for stdout data
    ffmpeg.stdout.on("data", (data) => {
      logger.debug(`FFmpeg stdout: ${data.toString()}`);
    });
    
    // watchdog timer in case something goes wrong and ffmpeg hangs
    const timeout = setTimeout(() => {
      if (!ffmpeg.killed) {
        logger.error("FFmpeg didn't end after duration — stopping FFmpeg cleanly...");
        ffmpeg.kill("SIGINT");
      }
    }, streamObject.duration * 1000 + 5000); // Add 5s buffer

    // when ffmpeg closes
    ffmpeg.on("close", (code, signal) => {
      // Clear timeout
      clearTimeout(timeout);

      // Notify WebSocket that recording stopped
      wsManager.stopRecording(recordingId);

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
      reject(err);
    });
  });
}
