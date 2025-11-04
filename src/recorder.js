import ffmpeg from "fluent-ffmpeg"
import fs from "fs"
import path from "path"


export function recordStream({url, duration, name}) {
    const timestamp = new Date();
      const safeTime = timestamp.toISOString().replace(/[:.]/g, "-");
  const outputDir = path.resolve("recordings");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const filePath = path.join(outputDir, `${name}_${safeTime}.mp3`);

  console.log(`🎙️  Recording started: ${url}`);

  const startTime = new Date();

  ffmpeg(url)
    .duration(duration)
    .audioCodec("libmp3lame")
    .format("mp3")
    .on("end", () => {
      const endTime = new Date();
      console.log(`✅ Recording saved: ${filePath}`);

      addRecording({
        name,
        source_url: url,
        file_path: filePath,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration
      });
    })
    .on("error", (err) => console.error("❌ Recording failed:", err.message))
    .save(filePath);
}