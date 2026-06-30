/* ══════════════════════════════════════
   patcher.js
   The actual byte-level MP4 manipulation. Depends on atom-utils.js.

   FIX (refactor v6.1): "Z-Payload + MTLib + encoder string" used to be
   copy-pasted inline in 3 places (ky60 mode, interp lab, and a 4th
   half-version inside applyKytheraPatch). It's now one function:
   applyMetadataStamp(). Call it once per buffer, get a new buffer back.
   ══════════════════════════════════════ */

/* ── Z-Payload: zero/0x5A-fill a small window right after mdat starts ── */
function patchZPayload(data) {
  const mdatIdx = findRawAtomOffset(data, 'mdat');
  if (mdatIdx === -1) throw new Error('Struktur video tidak valid. Pastikan file MP4 tidak corrupt.');
  const zt = mdatIdx + 10;
  for (let i = 0; i < 128; i++) { if (zt + i < data.length) data[zt + i] = 0x5A; }
  return true;
}

/* ── Rewrite an existing "Lavf..." encoder string to a target version ── */
function patchEncoderStr(data) {
  const enc = new TextEncoder(), lavf = enc.encode('Lavf'), target = enc.encode('Lavf59.16.100');
  for (let i = 0; i <= data.length - 16; i++) {
    if (data[i] === lavf[0] && data[i + 1] === lavf[1] && data[i + 2] === lavf[2] && data[i + 3] === lavf[3]) {
      if (data[i + 4] >= 0x30 && data[i + 4] <= 0x39) {
        let end = i + 4; while (end < data.length && data[end] >= 0x20 && data[end] < 0x7F) end++;
        const ol = end - i;
        for (let j = 0; j < ol; j++) data[i + j] = j < target.length ? target[j] : 0x00;
        return true;
      }
    }
  }
  return false;
}

/* ── Inject a custom "MTLib" freeform metadata atom under moov/udta ── */
function injectMTLib(origBuffer) {
  const enc = new TextEncoder(), origData = new Uint8Array(origBuffer), origView = new DataView(origBuffer);
  const domain = enc.encode('com.apple.quicktime'), keyBytes = enc.encode('MTLib'), valBytes = enc.encode('PyPVGCodec');
  const meanBox = new Uint8Array(4 + 4 + 4 + domain.length);
  new DataView(meanBox.buffer).setUint32(0, meanBox.length, false);
  meanBox.set(enc.encode('mean'), 4); meanBox.set(domain, 12);
  const nameBox = new Uint8Array(4 + 4 + 4 + keyBytes.length);
  new DataView(nameBox.buffer).setUint32(0, nameBox.length, false);
  nameBox.set(enc.encode('name'), 4); nameBox.set(keyBytes, 12);
  const dataBox = new Uint8Array(4 + 4 + 4 + valBytes.length);
  const dataView = new DataView(dataBox.buffer);
  dataView.setUint32(0, dataBox.length, false); dataBox.set(enc.encode('data'), 4);
  dataView.setUint32(8, 1, false); dataBox.set(valBytes, 12);
  const freeformSize = 4 + 4 + meanBox.length + nameBox.length + dataBox.length;
  const freeform = new Uint8Array(freeformSize); const ffView = new DataView(freeform.buffer);
  ffView.setUint32(0, freeformSize, false); freeform.set(enc.encode('----'), 4);
  let pos = 8; freeform.set(meanBox, pos); pos += meanBox.length; freeform.set(nameBox, pos); pos += nameBox.length; freeform.set(dataBox, pos);

  let moovPos = -1, moovSz = 0; pos = 0;
  while (pos + 8 <= origData.length) {
    const sz = origView.getUint32(pos, false);
    const t = String.fromCharCode(origData[pos + 4], origData[pos + 5], origData[pos + 6], origData[pos + 7]);
    if (t === 'moov') { moovPos = pos; moovSz = sz; break; }
    if (sz < 8) break;
    pos += sz;
  }
  if (moovPos === -1) return { buffer: origBuffer, injected: false };

  let udtaPos = -1, udtaSz = 0; pos = moovPos + 8; const moovEnd = moovPos + moovSz;
  while (pos + 8 <= moovEnd) {
    const sz = origView.getUint32(pos, false);
    const t = String.fromCharCode(origData[pos + 4], origData[pos + 5], origData[pos + 6], origData[pos + 7]);
    if (t === 'udta') { udtaPos = pos; udtaSz = sz; break; }
    if (sz < 8) break;
    pos += sz;
  }

  let newBuf;
  if (udtaPos !== -1) {
    const insertAt = udtaPos + udtaSz; newBuf = new ArrayBuffer(origData.length + freeform.length);
    const nd = new Uint8Array(newBuf); const nv = new DataView(newBuf);
    nd.set(origData.subarray(0, insertAt)); nd.set(freeform, insertAt); nd.set(origData.subarray(insertAt), insertAt + freeform.length);
    nv.setUint32(moovPos, moovSz + freeform.length, false); nv.setUint32(udtaPos, udtaSz + freeform.length, false);
  } else {
    const udtaNew = new Uint8Array(8 + freeform.length);
    new DataView(udtaNew.buffer).setUint32(0, udtaNew.length, false);
    udtaNew.set(enc.encode('udta'), 4); udtaNew.set(freeform, 8);
    const insertAt = moovEnd; newBuf = new ArrayBuffer(origData.length + udtaNew.length);
    const nd = new Uint8Array(newBuf); const nv = new DataView(newBuf);
    nd.set(origData.subarray(0, insertAt)); nd.set(udtaNew, insertAt); nd.set(origData.subarray(insertAt), insertAt + udtaNew.length);
    nv.setUint32(moovPos, moovSz + udtaNew.length, false);
  }
  return { buffer: newBuf, injected: true };
}

/**
 * Z-Payload + MTLib + encoder-string stamp, as one step.
 * Previously inlined 3x (ky60 mode, interp lab, applyKytheraPatch).
 * Returns the new ArrayBuffer.
 */
function applyMetadataStamp(arrayBuffer) {
  let buf = arrayBuffer;
  const firstPass = new Uint8Array(buf);
  patchZPayload(firstPass);
  const mt = injectMTLib(buf);
  if (mt.injected) buf = mt.buffer;
  patchEncoderStr(new Uint8Array(buf));
  return buf;
}

function applyKytheraPatch(arrayBuffer, originalName) {
  const buf = applyMetadataStamp(arrayBuffer);
  downloadBlob(buf, originalName.replace(/\.[^/.]+$/, '') + '_patched.mp4');
  return buf.byteLength;
}

/* MODE 2 — SHARK SAMPLE TABLE */
const SHARK = {
  FAKE_SAMPLE_COUNT: 8573, FAKE_SAMPLE_SIZE: 8, FAKE_SAMPLE_BYTES: new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00]),
  VIDEO_TIMESCALE: 90000, VIDEO_DURATION: 2269500, VIDEO_EDIT_MEDIA_TIME: 3000, VIDEO_SAMPLE_DELTA: 1500
};
function buildMdhd(box) {
  const payload = boxPayload(box); const view = new DataView(payload.buffer);
  if (payload[0] !== 0) throw new Error(`Versi mdhd tidak didukung: ${payload[0]}.`);
  view.setUint32(12, SHARK.VIDEO_TIMESCALE, false); view.setUint32(16, SHARK.VIDEO_DURATION, false);
  return makeBox('mdhd', payload);
}
function buildElst(box) {
  const payload = boxPayload(box); const view = new DataView(payload.buffer);
  const ver = payload[0], ec = view.getUint32(4, false);
  if (ver !== 0 || ec < 1) throw new Error('elst butuh version 0 dengan minimal 1 entry.');
  view.setUint32(12, SHARK.VIDEO_EDIT_MEDIA_TIME, false);
  return makeBox('elst', payload);
}
function buildStts(realSampleCount) {
  const payload = new Uint8Array(4 + 4 + 8 + 8); const view = new DataView(payload.buffer);
  view.setUint32(4, 2, false); view.setUint32(8, realSampleCount, false); view.setUint32(12, SHARK.VIDEO_SAMPLE_DELTA, false);
  view.setUint32(16, SHARK.FAKE_SAMPLE_COUNT, false); view.setUint32(20, SHARK.VIDEO_SAMPLE_DELTA, false);
  return makeBox('stts', payload);
}
function buildStsz(originalSizes) {
  const total = originalSizes.length + SHARK.FAKE_SAMPLE_COUNT;
  const payload = new Uint8Array(4 + 4 + 4 + total * 4); const view = new DataView(payload.buffer);
  view.setUint32(8, total, false); let offset = 12;
  originalSizes.forEach(s => { view.setUint32(offset, s, false); offset += 4; });
  for (let i = 0; i < SHARK.FAKE_SAMPLE_COUNT; i++) { view.setUint32(offset, SHARK.FAKE_SAMPLE_SIZE, false); offset += 4; }
  return makeBox('stsz', payload);
}
function buildStsc(originalRows, originalChunkCount) {
  const rows = originalRows.map(r => [...r]); const last = rows[rows.length - 1];
  if (!last || last[1] !== 1) rows.push([originalChunkCount + 1, 1, 1]);
  const payload = new Uint8Array(4 + 4 + rows.length * 12); const view = new DataView(payload.buffer);
  view.setUint32(4, rows.length, false); let offset = 8;
  rows.forEach(([fc, spc, sdi]) => { view.setUint32(offset, fc, false); view.setUint32(offset + 4, spc, false); view.setUint32(offset + 8, sdi, false); offset += 12; });
  return makeBox('stsc', payload);
}
function buildStco(originalOffsets, delta, fakeOffset = null) {
  const count = originalOffsets.length + (fakeOffset === null ? 0 : SHARK.FAKE_SAMPLE_COUNT);
  const payload = new Uint8Array(4 + 4 + count * 4); const view = new DataView(payload.buffer);
  view.setUint32(4, count, false); let tableOffset = 8;
  originalOffsets.forEach(off => { const shifted = off + delta; assertUint32(shifted, 'stco.chunk_offset'); view.setUint32(tableOffset, shifted, false); tableOffset += 4; });
  if (fakeOffset !== null) { assertUint32(fakeOffset, 'stco.fake_sample_offset'); for (let i = 0; i < SHARK.FAKE_SAMPLE_COUNT; i++) { view.setUint32(tableOffset, fakeOffset, false); tableOffset += 4; } }
  return makeBox('stco', payload);
}
function rebuildBox(box, replacements) {
  if (replacements.has(box)) return replacements.get(box);
  if (!box.children.length) return boxBytes(box);
  const parts = [box.data.slice(box.prefixStart, box.prefixEnd)];
  box.children.forEach(child => parts.push(rebuildBox(child, replacements)));
  return makeBox(box.type, concatBytes(parts));
}
function collectTrackStcoBoxes(moov) {
  const stcoBoxes = [];
  moov.children.filter(c => c.type === 'trak').forEach(trak => {
    const stbl = findDescendant(trak, ['mdia', 'minf', 'stbl']); if (!stbl) return;
    const co64 = findChild(stbl, 'co64'); if (co64) throw new Error('Metode ini tidak mendukung MP4 dengan co64.');
    const stco = findChild(stbl, 'stco'); if (stco) stcoBoxes.push(stco);
  });
  return stcoBoxes;
}
function buildStcoReplacements(stcoBoxes, videoStco, delta, fakeOffset) {
  const replacements = new Map();
  stcoBoxes.forEach(stco => { replacements.set(stco, buildStco(parseStco(stco), delta, stco === videoStco ? fakeOffset : null)); });
  return replacements;
}
function patchSharkSampleTableMethod(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer); const view = new DataView(arrayBuffer);
  const topLevel = parseBoxes(data, view);
  const ftyp = findTopLevel(topLevel, 'ftyp'), moov = findTopLevel(topLevel, 'moov'), mdat = findTopLevel(topLevel, 'mdat');
  if (!ftyp) throw new Error('"ftyp" box tidak ditemukan.');
  if (!moov) throw new Error('"moov" box tidak ditemukan.');
  if (!mdat) throw new Error('"mdat" box tidak ditemukan.');
  const videoTrak = moov.children.find(c => c.type === 'trak' && handlerTypeForTrak(c) === 'vide');
  if (!videoTrak) throw new Error('Track video tidak ditemukan.');
  const stbl = findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
  const mdhd = findDescendant(videoTrak, ['mdia', 'mdhd']);
  const elst = findDescendant(videoTrak, ['edts', 'elst']);
  const stts = stbl && findChild(stbl, 'stts'), stsc = stbl && findChild(stbl, 'stsc'), stsz = stbl && findChild(stbl, 'stsz'), stco = stbl && findChild(stbl, 'stco');
  if (!stbl || !mdhd || !elst || !stts || !stsc || !stsz || !stco) throw new Error('MP4 kurang tabel: mdhd, elst, stts, stsc, stsz, stco wajib ada.');
  const originalSizes = parseStsz(stsz), originalStscRows = parseStsc(stsc), originalChunkOffsets = parseStco(stco);
  const stcoBoxes = collectTrackStcoBoxes(moov);
  const preservedTopLevel = topLevel.filter(b => !['ftyp', 'moov', 'mdat'].includes(b.type)).map(boxBytes);
  const fixedReplacements = new Map([[mdhd, buildMdhd(mdhd)], [elst, buildElst(elst)], [stts, buildStts(originalSizes.length)], [stsc, buildStsc(originalStscRows, originalChunkOffsets.length)], [stsz, buildStsz(originalSizes)]]);
  const placeholderRep = new Map(fixedReplacements);
  buildStcoReplacements(stcoBoxes, stco, 0, 0).forEach((v, k) => placeholderRep.set(k, v));
  const moovPlaceholder = rebuildBox(moov, placeholderRep);
  const preservedBytes = concatBytes(preservedTopLevel);
  const oldMdatPayload = data.slice(mdat.contentStart, mdat.end);
  let newMdatPayloadStart = ftyp.size + moovPlaceholder.length + preservedBytes.length + 8;
  let delta = newMdatPayloadStart - mdat.contentStart, fakeOffset = newMdatPayloadStart + oldMdatPayload.length;
  let finalRep = new Map(fixedReplacements);
  buildStcoReplacements(stcoBoxes, stco, delta, fakeOffset).forEach((v, k) => finalRep.set(k, v));
  let moovNew = rebuildBox(moov, finalRep);
  const recalculated = ftyp.size + moovNew.length + preservedBytes.length + 8;
  delta = recalculated - mdat.contentStart; fakeOffset = recalculated + oldMdatPayload.length;
  finalRep = new Map(fixedReplacements);
  buildStcoReplacements(stcoBoxes, stco, delta, fakeOffset).forEach((v, k) => finalRep.set(k, v));
  moovNew = rebuildBox(moov, finalRep);
  const mdatNew = makeBox('mdat', concatBytes([oldMdatPayload, SHARK.FAKE_SAMPLE_BYTES]));
  const output = concatBytes([boxBytes(ftyp), moovNew, preservedBytes, mdatNew]);
  return { output, realSamples: originalSizes.length, fakeSamples: SHARK.FAKE_SAMPLE_COUNT, fakeOffset, stcoDelta: delta };
}
