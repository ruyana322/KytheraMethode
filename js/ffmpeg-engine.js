/* ══════════════════════════════════════
   ffmpeg-engine.js

   NOTE on versioning: @ffmpeg/ffmpeg@0.11.x pairs with @ffmpeg/core@0.11.0
   (single-thread) or @ffmpeg/core-mt@0.11.0 (multi-thread). The -mt build
   needs window.crossOriginIsolated === true (SharedArrayBuffer available)
   to actually spin up worker threads — that's what coi-serviceworker.js
   is for. Without it, -mt silently falls back to acting single-threaded.
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
  const isolated = window.crossOriginIsolated === true;
  const corePath = isolated
    ? 'https://unpkg.com/@ffmpeg/core-mt@0.11.0/dist/ffmpeg-core.js'
    : 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js';
  const ff = createFFmpeg({ log: false, corePath });
  await ff.load();
  ff._fetchFile = fetchFile;
  ff._multiThread = isolated;
  ffmpegLoaded = true; ffmpegInst = ff;
  return ff;
}
