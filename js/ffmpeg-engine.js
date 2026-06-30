/* ══════════════════════════════════════
   ffmpeg-engine.js

   NOTE on versioning: @ffmpeg/ffmpeg@0.11.x pairs with @ffmpeg/core@0.11.0.
   There is NO @ffmpeg/core-mt@0.11.0 — the "-mt" core package only exists
   for the newer 0.12.x ESM line, which is a different (incompatible) API.
   Don't "fix" this into core-mt later, it 404s.

   Multi-threading on 0.11.x doesn't need a separate core package: libx264
   inside @ffmpeg/core@0.11.0 already runs multi-threaded automatically as
   long as the page is crossOriginIsolated (SharedArrayBuffer available) —
   which is what coi-serviceworker.js provides. We just pass -threads N.
   ══════════════════════════════════════ */
let ffmpegLoaded = false, ffmpegInst = null;

/** How many encoder threads to ask ffmpeg for. Caps at 8 since x264
 *  gets diminishing/negative returns past that on most phones, and
 *  reserves 1 core for the UI thread so the page doesn't freeze. */
function ffmpegThreadCount() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(8, cores - 1));
}

async function loadFFmpeg() {
  if (ffmpegLoaded) return ffmpegInst;
  setStatus('⏳ Loading FFmpeg.wasm (sekali saja)...', 'working');
  setProgress(5, 'Loading FFmpeg...');
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ff = createFFmpeg({ log: false, corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js' });
  await ff.load();
  ff._fetchFile = fetchFile;
  ff._multiThread = window.crossOriginIsolated === true;
  ffmpegLoaded = true; ffmpegInst = ff;
  return ff;
}
