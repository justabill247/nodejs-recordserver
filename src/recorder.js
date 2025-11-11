import { exec } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { addRecording } from "./db.js";

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
    const outputFile = path.join(recordingsDir, filename);

    // FFmpeg command
    const cmd = [
      `ffmpeg`,
      `-y`,
      `-reconnect 1`,
      `-reconnect_streamed 1`,
      `-reconnect_delay_max 2`,
      `-i "${streamObject.url}"`,
      `-vn`,
      `-c:a aac`,
      `-b:a 128k`,
      `-t ${streamObject.duration}`,
      `"${outputFile}"`,
    ].join(" ");

    console.log(`🎙️  Recording started: ${filename}`);
    const process = exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ FFmpeg error:", err);
        return reject(err);
      }
      console.log(`✅ Recording complete: ${outputFile}`);
      
      addRecording({
        name: streamObject.name, // name
        url: streamObject.url, // url
        file_path: outputFile, // file path
        start_time: timestamp, // start time
        end_time: "today", //end time
        duration: streamObject.duration // duration
      });
      resolve(outputFile);
    });

    // Optional: log FFmpeg output for progress
    process.stderr.on("data", (data) => {
      if (data.toString().includes("frame=")) process.stdout.write(".");
    });
  });
}
