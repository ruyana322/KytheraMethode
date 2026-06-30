/* ══════════════════════════════════════
   ffmpeg-engine.js

   NOTE on versioning: @ffmpeg/ffmpeg@0.11.x and @ffmpeg/core only ever
   published a 0.11.0 core build before jumping straight to the 0.12
   line (which is a different API, ESM-based, not a drop-in swap).
   So `ffmpeg.min.js@0.11.6` + `core@0.11.0` is the correct pairing —
   this was flagged earlier as a version mismatch, that was wrong,
   double check confirmed there's no core@0.11.6 to pair it with.
   Leaving this comment so nobody "fixes" it into a 0.11.6 404 later.
   ══════════════════════════════════════ */
let ffmpegLoaded = false, ffmpegInst = null;

async function loadFFmpeg() {
  if (ffmpegLoaded) return ffmpegInst;
  setStatus('⏳ Loading FFmpeg.wasm (sekali saja)...', 'working');
  setProgress(5, 'Loading FFmpeg...');
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ff = createFFmpeg({ log: false, corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js' });
  await ff.load();
  ff._fetchFile = fetchFile;
  ffmpegLoaded = true; ffmpegInst = ff;
  return ff;
}
