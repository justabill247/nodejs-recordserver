import { exec } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { addRecording } from "../database/db.js";
import { spawn } from "child_process";

import { createLogger } from "./logger.js";
import { error } from "console";
const logger = createLogger("Recorder");
const logProgress = false

// Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Record an audio-only M3U8 stream to an .m4a file using FFmpeg.
 * @param {string} url - The M3U8 stream URL.
 * @param {number} durationSec - Duration in seconds (default 300 = 5 min).
 * @returns {Promise<string>} - Resolves with the output file path.
 */
export function recordStream(streamObject) {
  return new Promise((resolve, reject) => {
    // Ensure recordings folder exists
    const recordingsDir = path.join(__dirname, "..", "recordings");
    if (!fs.existsSync(recordingsDir))
      fs.mkdirSync(recordingsDir, { recursive: true });

    // Timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `recording_${timestamp}.m4a`;
    const filesname = ``

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

    logger.info(`Recording started: ${filename}`);
    const startTime = new Date().toISOString();

    // --- spawn ffmpeg process ---
    const ffmpeg = spawn("ffmpeg", ffArgs);

    //only show progress dots when recording
    ffmpeg.stderr.on("data", (data) => {
      const line = data.toString();
      // ignore span
      if (line.includes("size=") || line.includes("time=")) {
        if(logProgress) process.stdout.write(".");
        
      }
    });
    
    // kill ffmpeg +1s after duration in case of shenannigans
    const timeout = setTimeout(() => {
      if (!ffmpeg.killed) {
        logger.info("Duration reached — stopping FFmpeg cleanly...");
        ffmpeg.kill("SIGINT");
      }
    }, streamObject.duration * 1000);

    // when ffmpeg exits normally or is killed
    ffmpeg.on('close', (code, signal) => {

      if (code !== 0) {
        logger.error(`FFmpeg error with code: ${code}, signal ${signal}`)
      }
      // exited cleanly, already dead
      clearTimeout(timeout);
      
      //save to db
      addRecording({
        name: streamObject.name, // name
        url: streamObject.url, // url
        stream_id: streamObject.id,
        file_path: outputFile, // file path
        start_time: startTime, // start time
        end_time: new Date().toISOString(), //end time
        duration: streamObject.duration, // duration
      });
      resolve(outputFile);
      logger.info(`Recording saved to ${outputFile}}`);
    });
  });
}
