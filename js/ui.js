/* ══════════════════════════════════════
   ui.js
   ══════════════════════════════════════ */

/* ── NAV ── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.t; if (!t) return;
    document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
    document.getElementById(t).classList.add('on'); btn.classList.add('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ── RIPPLE ── */
function addRipple(el) {
  el.addEventListener('click', e => {
    const r = el.getBoundingClientRect(), sz = Math.max(r.width, r.height), sp = document.createElement('span');
    sp.className = 'ripple';
    sp.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - r.left - sz / 2}px;top:${e.clientY - r.top - sz / 2}px`;
    el.appendChild(sp);
    sp.addEventListener('animationend', () => sp.remove());
  });
}
document.querySelectorAll('.btn').forEach(addRipple);

/* ── MODE ── */
let curMode = 'patch';
function selMode(m) {
  curMode = m;
  document.querySelectorAll('input[name="modeRadio"]').forEach(r => r.checked = (r.value === m));
  ['icoP', 'icoI', 'icoK', 'icoE'].forEach(id => document.getElementById(id).className = 'mode-ico');
  if (m === 'patch') document.getElementById('icoP').classList.add('active-c');
  if (m === 'its') document.getElementById('icoI').classList.add('active-p');
  if (m === 'ky60') document.getElementById('icoK').classList.add('active-g');
  if (m === 'encoder') document.getElementById('icoE').classList.add('active-o');
  document.getElementById('itsPanel').style.display = m === 'its' ? 'block' : 'none';
  document.getElementById('encoderPanel').style.display = m === 'encoder' ? 'block' : 'none';
  const btn = document.getElementById('patchBtn');
  btn.className = 'btn ' + (m === 'its' ? 'btn-p' : m === 'ky60' ? 'btn-g' : m === 'encoder' ? 'btn-o' : 'btn-c');
  btn.disabled = !selectedFile;
}
document.querySelectorAll('.its-item[data-scale]').forEach(item => {
  item.addEventListener('click', () => { document.querySelectorAll('.its-item[data-scale]').forEach(i => i.classList.remove('selected')); item.classList.add('selected'); });
});

/* ── FILE + DRAG DROP ──
   FIX: original accepted any dropped/selected file and only found out
   it wasn't a real MP4 once patching threw mid-way. Now we sniff the
   first 12 bytes up front and reject obviously-wrong files immediately,
   with a clear i18n-friendly message instead of a binary-parser error. */
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
    setStatus(currentLang === 'en' ? '❌ Not a valid MP4 file.' : '❌ Bukan file MP4 yang valid.', 'error');
    return;
  }
  selectedFile = f;
  const d = document.getElementById('fileDisp'); d.textContent = '📄 ' + f.name; d.classList.add('ok');
  document.getElementById('patchBtn').disabled = false;
  setStatus(currentLang === 'en' ? 'File ready to process.' : 'File siap diproses.', '');
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

document.addEventListener('DOMContentLoaded', () => { setLang(currentLang); });
