/* ══════════════════════════════════════
   ui.js — single-page version (no tab nav, no i18n)
   ══════════════════════════════════════ */

/* ── RIPPLE-LESS BUTTON PRESS (kept simple) ── */

/* ── MODE ── */
let curMode = 'patch';
const MODE_COLOR = { patch: '', its: 'purple', ky60: 'green', encoder: 'orange' };
const MODE_INFO = {
  patch:   { ico: '⚡', name: 'Smart Patch', desc: 'Otomatis deteksi & proses — recommended' },
  its:     { ico: '📐', name: 'Speed Booster', desc: 'Optimasi frame timing video' },
  ky60:    { ico: '🚀', name: 'Kythera 60fps', desc: 'Optimasi kualitas HD otomatis' },
  encoder: { ico: '🎛️', name: 'Advanced Encoder', desc: 'Custom H.264 encoding settings' }
};

function toggleModeList() {
  document.getElementById('modeList').classList.toggle('open');
  document.getElementById('modeSummary').classList.toggle('open');
}

function selMode(m) {
  curMode = m;
  ['rowPatch', 'rowIts', 'rowKy60', 'rowEncoder'].forEach(id => {
    document.getElementById(id).classList.remove('sel', 'purple', 'green', 'orange');
  });
  const rowId = { patch: 'rowPatch', its: 'rowIts', ky60: 'rowKy60', encoder: 'rowEncoder' }[m];
  const row = document.getElementById(rowId);
  row.classList.add('sel');
  if (MODE_COLOR[m]) row.classList.add(MODE_COLOR[m]);

  document.getElementById('itsPanel').classList.toggle('show', m === 'its');
  document.getElementById('encoderPanel').classList.toggle('show', m === 'encoder');

  const btn = document.getElementById('patchBtn');
  btn.classList.remove('purple', 'green', 'orange');
  if (MODE_COLOR[m]) btn.classList.add(MODE_COLOR[m]);
  btn.disabled = !selectedFile;

  /* update collapsed summary row + auto-close the list */
  const info = MODE_INFO[m];
  document.getElementById('curModeIco').textContent = info.ico;
  document.getElementById('curModeName').textContent = info.name;
  document.getElementById('curModeDesc').textContent = info.desc;
  document.getElementById('modeList').classList.remove('open');
  document.getElementById('modeSummary').classList.remove('open');
}
document.querySelectorAll('.its-item[data-scale]').forEach(item => {
  item.addEventListener('click', () => { document.querySelectorAll('.its-item[data-scale]').forEach(i => i.classList.remove('sel')); item.classList.add('sel'); });
});

/* ── FILE + DRAG DROP ──
   FIX: original accepted any dropped/selected file and only found out
   it wasn't a real MP4 once patching threw mid-way. Now we sniff the
   first 12 bytes up front and reject obviously-wrong files immediately. */
let selectedFile = null;
const dropZ = document.getElementById('dropZ');
const fileInput = document.getElementById('fileInput');
dropZ.addEventListener('click', () => fileInput.click());
dropZ.addEventListener('dragover', e => { e.preventDefault(); dropZ.classList.add('over'); });
dropZ.addEventListener('dragleave', () => dropZ.classList.remove('over'));
dropZ.addEventListener('drop', e => { e.preventDefault(); dropZ.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) setFile(f); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) setFile(e.target.files[0]); });

async function setFile(f) {
  const head = new Uint8Array(await f.slice(0, 12).arrayBuffer());
  if (!looksLikeMp4(head)) {
    setStatus('❌ Bukan file MP4 yang valid.', 'error');
    return;
  }
  selectedFile = f;
  const d = document.getElementById('fileDisp'); d.textContent = '📄 ' + f.name; d.classList.add('ok');
  document.getElementById('patchBtn').disabled = false;
  setStatus('File siap diproses.', '');
  const vid = document.getElementById('vidPrev'), ph = document.getElementById('prevPh');
  vid.src = URL.createObjectURL(f); vid.style.display = 'block'; ph.style.display = 'none';
  document.getElementById('resultCard').classList.remove('show');
}

/* ── STATUS / PROGRESS / RESULT ── */
function setStatus(msg, type) { const b = document.getElementById('statusBox'); b.textContent = msg; b.className = 'status' + (type ? ' ' + type : ''); }
let t0 = 0;
function setProgress(pct, label, show = true) {
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progLbl').textContent = label;
  document.getElementById('progWrap').classList.toggle('show', show);
  if (pct > 0 && pct < 100 && t0 > 0) {
    const el = (Date.now() - t0) / 1000, tot = el / pct * 100, rem = Math.max(0, tot - el);
    const m = Math.floor(rem / 60), s = Math.floor(rem % 60);
    document.getElementById('progEta').textContent = `ETA ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } else document.getElementById('progEta').textContent = '';
}
function showResult(fname, elapsed, sb, sa) {
  const fmt = n => (n / 1048576).toFixed(2) + ' MB';
  document.getElementById('rFile').textContent = fname.length > 20 ? fname.slice(0, 18) + '…' : fname;
  document.getElementById('rTime').textContent = elapsed < 60 ? elapsed.toFixed(1) + 's' : (elapsed / 60).toFixed(1) + 'm';
  document.getElementById('rBefore').textContent = fmt(sb);
  document.getElementById('rAfter').textContent = fmt(sa);
  document.getElementById('resultCard').classList.add('show');
}
function downloadBlob(data, filename) {
  const blob = new Blob([data], { type: 'video/mp4' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ── DONATE ── */
document.getElementById('donateBtn').addEventListener('click', () => {
  navigator.clipboard.writeText('+6282129942772').then(() => {
    const h = document.getElementById('donateHdl'); h.textContent = '✓ Tersalin!';
    setTimeout(() => h.textContent = '+6282129942772', 2000);
  });
});
