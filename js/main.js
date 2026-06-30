/* ══════════════════════════════════════
   main.js
   Orchestrates the 4 patch modes. Depends on atom-utils.js,
   patcher.js, ffmpeg-engine.js, ui.js.
   ══════════════════════════════════════ */

function buildEncoderArgs() {
  const codec = document.getElementById('encCodec').value;
  const crf = document.getElementById('encCrf').value;
  const preset = document.getElementById('encPreset').value;
  const tune = document.getElementById('encTune').value;
  const profile = document.getElementById('encProfile').value;
  const ffmpegArgs = ['-c:v', codec, '-crf', crf, '-preset', preset];
  if (tune !== 'none') ffmpegArgs.push('-tune', tune);
  if (profile !== 'none') ffmpegArgs.push('-profile:v', profile);
  ffmpegArgs.push('-c:a', 'copy');
  return { ffmpegArgs, codec, crf, preset, tune, profile };
}

async function runProcess() {
  if (!selectedFile) return;
  const btn = document.getElementById('patchBtn'); btn.disabled = true;
  let t0 = Date.now(); const sb = selectedFile.size;
  const base = selectedFile.name.replace(/\.[^/.]+$/, '');

  if (curMode === 'patch') {
    setStatus('⚙️ Menyiapkan Engine Patching...', 'working');
    setProgress(10, 'Loading engine...', true);
    
    try {
      const ff = await loadFFmpeg();
      
      setProgress(20, 'Membaca file video...');
      ff.FS('writeFile', 'input.mp4', await ff._fetchFile(selectedFile));
      
      setStatus('⚙️ Optimasi Video & Anti-Delay...', 'working');
      setProgress(30, 'Mulai rendering video...');
      
      ff.setLogger(({ type, message }) => {
        console.log(`[FFmpeg ${type}] ${message}`);
      });

      ff.setProgress(({ ratio }) => {
        if (ratio >= 0 && ratio <= 1) {
          const pct = Math.round(ratio * 100);
          setProgress(30 + (pct * 0.40), `Encoding Video: ${pct}%`); 
        }
      });

      // KODE SEMPURNA + TURBO BROWSER (Ultrafast + 1080p limit)
      await ff.run(
        '-i', 'input.mp4', 
        '-vf', 'scale=-2:1080,format=yuv420p',   // 🔑 Rem resolusi 1080p biar gak jebol
        '-c:v', 'libx264',
        '-preset', 'ultrafast',                  // 🔑 SUPER NGEBUT
        '-crf', '20',                            // 🔑 Kualitas tetep tajam
        '-bf', '0',
        '-threads', String(ff._multiThread ? ffmpegThreadCount() : 1), 
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-metadata', 'copyright=By kythera',
        '-metadata', 'artist=By kythera',
        '-movflags', '+faststart', 
        'fs_out.mp4'
      );
      
      ff.setProgress(() => {}); 
      ff.setLogger(() => {});   

      setProgress(75, 'Menerapkan Shark HD Patch...');
      const out = ff.FS('readFile', 'fs_out.mp4');
      const patchAb = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
      
      try { ff.FS('unlink', 'input.mp4'); ff.FS('unlink', 'fs_out.mp4'); } catch (e) {}

      const patch = patchSharkSampleTableMethod(patchAb);
      
      setProgress(95, 'Menyiapkan unduhan...');
      downloadBlob(patch.output, base + '_patched.mp4');
      setProgress(100, 'Selesai!');
      
      const elapsed = (Date.now() - t0) / 1000;
      setStatus('✅ Selesai! File diunduh.', 'success');
      showResult(selectedFile.name, elapsed, sb, patch.output.byteLength);
      setTimeout(() => setProgress(0, '', false), 3000);
      
    } catch (err) { 
      setStatus('❌ Error: ' + err.message, 'error'); 
      setProgress(0, '', false); 
    }

  } else if (curMode === 'ky60') {
    setStatus('⏳ Kythera 60fps Methode: Memproses...', 'working');
    setProgress(0, 'Membaca file...', true);
    try {
      const ab = await selectedFile.arrayBuffer();
      setProgress(30, 'Menganalisis struktur...');
      setProgress(55, 'Menyematkan metadata...');
      const buf = applyMetadataStamp(ab.slice(0));
      setProgress(95, 'Downloading...');
      const outName = base + '_kythera60.mp4';
      downloadBlob(buf, outName);
      setProgress(100, 'Selesai!');
      const elapsed = (Date.now() - t0) / 1000;
      setStatus('✅ Kythera 60fps Methode Selesai! File diunduh.', 'success');
      showResult(selectedFile.name, elapsed, sb, buf.byteLength);
      setTimeout(() => setProgress(0, '', false), 3000);
    } catch (err) { setStatus('❌ Error: ' + err.message, 'error'); setProgress(0, '', false); }

  } else if (curMode === 'its') {
    const scale = document.querySelector('.its-item[data-scale].selected')?.dataset.scale || '2';
    setStatus(`⏳ Speed Booster x${scale}: Memproses video...`, 'working');
    setProgress(0, 'Loading engine...', true);
    try {
      const ff = await loadFFmpeg();
      setProgress(20, 'Writing input...');
      ff.FS('writeFile', 'input.mp4', await ff._fetchFile(selectedFile));
      setProgress(40, 'Memproses video...');
      await ff.run('-itsscale', scale, '-i', 'input.mp4', '-c', 'copy', 'its_out.mp4');
      setProgress(72, 'Finalisasi output...');
      const itsData = ff.FS('readFile', 'its_out.mp4');
      const ab = itsData.buffer.slice(itsData.byteOffset, itsData.byteOffset + itsData.byteLength);
      const patched = applyMetadataStamp(ab);
      setProgress(95, 'Downloading...');
      const outName = base + `_its${scale}_patched.mp4`;
      downloadBlob(patched, outName);
      try { ff.FS('unlink', 'input.mp4'); ff.FS('unlink', 'its_out.mp4'); } catch (e) {}
      setProgress(100, 'Selesai!');
      const elapsed = (Date.now() - t0) / 1000;
      setStatus(`✅ Speed Booster x${scale} Selesai! File diunduh.`, 'success');
      showResult(selectedFile.name, elapsed, sb, patched.byteLength);
      setTimeout(() => setProgress(0, '', false), 3000);
    } catch (err) { setStatus('❌ Error: ' + err.message, 'error'); setProgress(0, '', false); }

  } else if (curMode === 'encoder') {
    const args = buildEncoderArgs();
    const applyStamp = document.getElementById('encApplyStamp').checked;
    setStatus('⏳ Advanced Encoder: Memproses video...', 'working');
    setProgress(0, 'Loading engine...', true);
    try {
      const ff = await loadFFmpeg();
      args.ffmpegArgs.push('-threads', String(ff._multiThread ? ffmpegThreadCount() : 1));
      setProgress(15, 'Writing input...');
      ff.FS('writeFile', 'input.mp4', await ff._fetchFile(selectedFile));
      setProgress(35, 'Encoding (' + args.preset + ', CRF ' + args.crf + ')...');
      await ff.run('-i', 'input.mp4', ...args.ffmpegArgs, 'enc_out.mp4');
      setProgress(75, 'Finalisasi output...');
      const encData = ff.FS('readFile', 'enc_out.mp4');
      let ab = encData.buffer.slice(encData.byteOffset, encData.byteOffset + encData.byteLength);
      if (applyStamp) { setProgress(88, 'Menyematkan TikTok HD stamp...'); ab = applyMetadataStamp(ab); }
      setProgress(95, 'Downloading...');
      const outName = base + `_encoded_crf${args.crf}` + (applyStamp ? '_kythera' : '') + '.mp4';
      downloadBlob(ab, outName);
      try { ff.FS('unlink', 'input.mp4'); ff.FS('unlink', 'enc_out.mp4'); } catch (e) {}
      setProgress(100, 'Selesai!');
      const elapsed = (Date.now() - t0) / 1000;
      setStatus('✅ Advanced Encoder Selesai! File diunduh.', 'success');
      showResult(selectedFile.name, elapsed, sb, ab.byteLength);
      setTimeout(() => setProgress(0, '', false), 3000);
    } catch (err) { setStatus('❌ Error: ' + err.message, 'error'); setProgress(0, '', false); }
  }
  btn.disabled = false;
}

/* ══ TRIPLE-TAP: UNLOCK INTERP LAB ══ */
let secretTapCount = 0, secretTapTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  const vEl = document.getElementById('versionVal');
  if (vEl) {
    vEl.addEventListener('click', () => {
      secretTapCount++; clearTimeout(secretTapTimer);
      secretTapTimer = setTimeout(() => { secretTapCount = 0; }, 1000);
      if (secretTapCount >= 3) {
        secretTapCount = 0;
        const lab = document.getElementById('ilab');
        lab.classList.toggle('on');
        if (lab.classList.contains('on')) interpLog('inf', 'Interp Lab unlocked 🔓');
      }
    });
  }
});
let interpFileData = null;
document.getElementById('interpFile').addEventListener('change', e => {
  interpFileData = e.target.files[0] || null;
  if (interpFileData) { document.getElementById('interpFname').textContent = interpFileData.name; document.getElementById('interpBtn').disabled = false; interpLog('inf', 'File siap: ' + interpFileData.name); }
});
function interpLog(type, msg) {
  const el = document.getElementById('interpLog');
  if (el.textContent === '— ready —') el.innerHTML = '';
  const line = document.createElement('div'); line.className = type;
  line.textContent = (type === 'ok' ? '✓ ' : type === 'err' ? '✗ ' : '→ ') + msg;
  el.appendChild(line); el.scrollTop = el.scrollHeight;
}
document.querySelectorAll('[data-iscale]').forEach(item => {
  item.addEventListener('click', () => { document.querySelectorAll('[data-iscale]').forEach(i => i.classList.remove('selected')); item.classList.add('selected'); });
});
document.getElementById('interpBtn').addEventListener('click', async () => {
  if (!interpFileData) return;
  const btn = document.getElementById('interpBtn'); btn.disabled = true;
  document.getElementById('interpLog').innerHTML = '';
  const scale = document.querySelector('[data-iscale].selected')?.dataset.iscale || '2';
  interpLog('inf', 'Loading FFmpeg.wasm...');
  try {
    const ff = await loadFFmpeg(); interpLog('ok', 'FFmpeg ready');
    interpLog('inf', 'Writing input...'); ff.FS('writeFile', 'src.mp4', await ff._fetchFile(interpFileData));
    interpLog('inf', 'Step 1: Interpolate 60fps → ' + (60 * parseInt(scale)) + 'fps...');
    
    // KODE SEMPURNA DI INTERP LAB (Ultrafast + 1080p limit)
    await ff.run(
      '-i', 'src.mp4', 
      '-vf', 'scale=-2:1080,minterpolate=fps=' + (60 * parseInt(scale)) + ':mi_mode=mci:mc_mode=aobmc:vsbmc=1', 
      '-c:v', 'libx264', 
      '-preset', 'ultrafast',   
      '-crf', '20', 
      '-bf', '0',
      '-threads', String(ff._multiThread ? ffmpegThreadCount() : 1),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      '-metadata', 'copyright=By kythera',
      '-metadata', 'artist=By kythera',
      'interp.mp4'
    );
    
    interpLog('ok', 'Interpolation done');
    interpLog('inf', 'Step 2: Frame boost x' + scale + '...');
    await ff.run('-itsscale', scale, '-i', 'interp.mp4', '-c', 'copy', 'its.mp4');
    interpLog('ok', 'Frame boost applied');
    interpLog('inf', 'Step 3: Optimasi metadata...');
    const raw = ff.FS('readFile', 'its.mp4');
    const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const patched = applyMetadataStamp(ab);
    interpLog('ok', 'Metadata + struktur dioptimasi');
    const blob = new Blob([patched], { type: 'video/mp4' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = interpFileData.name.replace(/\.[^.]+$/, '') + '_interp_boost' + scale + '_kythera.mp4';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    try { ff.FS('unlink', 'src.mp4'); ff.FS('unlink', 'interp.mp4'); ff.FS('unlink', 'its.mp4'); } catch (e) {}
    interpLog('ok', 'Done! ' + a.download);
  } catch (e) { interpLog('err', e.message); }
  btn.disabled = false;
});

(function () {
  const el = document.getElementById('sVid'); let n = 0;
  const t = setInterval(() => { n += 42000; if (n >= 2500000) { el.textContent = '2.5M+'; clearInterval(t); return; } el.textContent = (n / 1000000).toFixed(1) + 'M+'; }, 30);
})();
