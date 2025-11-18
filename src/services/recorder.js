import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { addRecording } from "../database/dbRecordings.js";
import { spawn } from "child_process";

import { createLogger } from "./logger.js";
const logger = createLogger("Recorder");
const logProgress = true

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
    const recordingsDir = path.join(__dirname, "..", "..", "recordings");
    if (!fs.existsSync(recordingsDir))
      fs.mkdirSync(recordingsDir, { recursive: true });

    // Timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `recording_${timestamp}.m4a`
    const safeName = ""

    // new filename setup
    // if stream id, use stream name
    // if no stream id, use url host

    // if(streamObject.stream_id) {

    // } else {
    //   const streamURL = new URL(streamObject.url)
    //   safeName = safeURL.hostname.replaceAll(".","_")
    // }
   

    

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
    logger.info(`Recording started for ${streamObject.name} for ${streamObject.duration}s`);
    const startTime = new Date().toISOString();

    // watch for stderr data
    ffmpeg.stderr.on("data", (data) => {
      const line = data.toString();
      // lines that indicate recording in progress
      if (line.includes("size=") || line.includes("time=")) {
        // write a dot to stdout instead of data
        if(logProgress) process.stdout.write(".");
      }
    });
    
    // watchdog timer in case something goes wrong and ffmpeg hangs
    const timeout = setTimeout(() => {
      if (!ffmpeg.killed) {
        logger.error("FFmpeg didnt end after duartion — stopping FFmpeg cleanly...");
        ffmpeg.kill("SIGINT");
      }
    }, streamObject.duration * 1000);

    // when ffmpeg closes
    ffmpeg.on('close', (code, signal) => {

      // recording was not successful
      if (code !== 0) {
        logger.error(`FFmpeg error with code: ${code}, signal ${signal}`)
        return reject(new Error(`FFmpeg exited with code ${code}`));
      } 
      
      // recording was successful
      clearTimeout(timeout);  // clear the watchdog timer
      
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

      // return the name of the output file
      resolve(outputFile);
      logger.info(`Recording saved to ${outputFile}`);
    });
  });
}
