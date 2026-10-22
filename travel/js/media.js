// Location and a thumbnail from a video or photo, all on-device.
// Phones write GPS into MP4/MOV ('©xyz' or the QuickTime ISO6709 key) and JPEG EXIF.
// Social apps usually strip it on download, so callers must handle a null location.

import { parseIso6709 } from './parse.js';

const td = new TextDecoder('latin1');
const str = (dv, off, len) => td.decode(new Uint8Array(dv.buffer, dv.byteOffset + off, len));

async function readView(blob, start, len) {
  return new DataView(await blob.slice(start, start + len).arrayBuffer());
}

// Walk top-level boxes without loading the whole file.
async function findTopBox(blob, type) {
  let off = 0;
  while (off + 8 <= blob.size) {
    const h = await readView(blob, off, 16);
    let size = h.getUint32(0);
    const t = str(h, 4, 4);
    let header = 8;
    if (size === 1) { size = Number(h.getBigUint64(8)); header = 16; }
    else if (size === 0) size = blob.size - off;
    if (size < header) return null;
    if (t === type) return { start: off + header, end: off + size };
    off += size;
  }
  return null;
}

const CONTAINERS = new Set(['moov', 'udta', 'meta', 'trak', 'mdia', 'minf', 'ilst']);

function* boxes(dv, start, end) {
  let off = start;
  while (off + 8 <= end) {
    let size = dv.getUint32(off);
    const type = str(dv, off + 4, 4);
    let header = 8;
    if (size === 1) { size = Number(dv.getBigUint64(off + 8)); header = 16; }
    else if (size === 0) size = end - off;
    if (size < header || off + size > end) return;
    yield { type, start: off + header, end: off + size, raw: dv.getUint32(off + 4) };
    off += size;
  }
}

export function parseMoov(dv) {
  const res = { coords: null, date: null };
  const keys = [];
  const walk = (start, end, parent) => {
    for (const b of boxes(dv, start, end)) {
      if (b.type === '\u00a9xyz') {
        // 2-byte length, 2-byte language, then the ISO 6709 string.
        const len = dv.getUint16(b.start);
        res.coords = res.coords || parseIso6709(str(dv, b.start + 4, Math.min(len, b.end - b.start - 4)));
      } else if (b.type === 'mvhd') {
        const v = dv.getUint8(b.start);
        const secs = v === 1 ? Number(dv.getBigUint64(b.start + 4)) : dv.getUint32(b.start + 4);
        if (secs > 0) res.date = new Date((secs - 2082844800) * 1000).toISOString();
      } else if (b.type === 'keys') {
        const n = dv.getUint32(b.start + 4);
        let o = b.start + 8;
        for (let i = 0; i < n && o + 8 <= b.end; i++) {
          const ks = dv.getUint32(o);
          keys.push(str(dv, o + 8, ks - 8));
          o += ks;
        }
      } else if (parent === 'ilst') {
        const key = keys[b.raw - 1];
        if (key && /location\.ISO6709/i.test(key)) {
          for (const d of boxes(dv, b.start, b.end)) {
            if (d.type === 'data') res.coords = res.coords || parseIso6709(str(dv, d.start + 8, d.end - d.start - 8));
          }
        }
      } else if (CONTAINERS.has(b.type)) {
        let s = b.start;
        // ISO 'meta' is a FullBox (4 bytes version/flags); QuickTime's isn't.
        if (b.type === 'meta' && str(dv, s + 4, 4) !== 'hdlr') s += 4;
        walk(s, b.end, b.type);
      }
    }
  };
  walk(0, dv.byteLength, null);
  return res;
}

export async function videoMetadata(file) {
  try {
    const moov = await findTopBox(file, 'moov');
    if (!moov || moov.end - moov.start > 64 * 1024 * 1024) return { coords: null, date: null };
    return parseMoov(await readView(file, moov.start, moov.end - moov.start));
  } catch (e) {
    console.warn('video metadata', e);
    return { coords: null, date: null };
  }
}

export function parseExif(dv) {
  if (dv.getUint16(0) !== 0xffd8) return { coords: null, date: null };
  let off = 2;
  while (off + 4 < dv.byteLength) {
    const marker = dv.getUint16(off);
    const len = dv.getUint16(off + 2);
    if (marker === 0xffe1 && str(dv, off + 4, 4) === 'Exif') return parseTiff(dv, off + 10);
    if ((marker & 0xff00) !== 0xff00) break;
    off += 2 + len;
  }
  return { coords: null, date: null };
}

function parseTiff(dv, t) {
  const le = dv.getUint16(t) === 0x4949;
  const u16 = o => dv.getUint16(t + o, le);
  const u32 = o => dv.getUint32(t + o, le);
  const ifd = o => {
    const out = {};
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
    }
    return out;
  };
  const rationals = (tag) => {
    const base = u32(tag.at);
    return Array.from({ length: tag.count }, (_, i) => u32(base + i * 8) / (u32(base + i * 8 + 4) || 1));
  };
  const ascii = tag => tag.count <= 4 ? str(dv, t + tag.at, tag.count) : str(dv, t + u32(tag.at), tag.count);

  const res = { coords: null, date: null };
  const ifd0 = ifd(u32(4));
  if (ifd0[0x8769]) {
    const exif = ifd(u32(ifd0[0x8769].at));
    const d = exif[0x9003] && ascii(exif[0x9003]).replace(/\0/g, '');
    const m = d && d.match(/^(\d{4}):(\d\d):(\d\d) (\d\d:\d\d:\d\d)/);
    if (m) res.date = `${m[1]}-${m[2]}-${m[3]}T${m[4]}`;
  }
  if (ifd0[0x8825]) {
    const g = ifd(u32(ifd0[0x8825].at));
    if (g[2] && g[4]) {
      const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
      let lat = dms(rationals(g[2])), lng = dms(rationals(g[4]));
      if (g[1] && ascii(g[1])[0] === 'S') lat = -lat;
      if (g[3] && ascii(g[3])[0] === 'W') lng = -lng;
      if (lat || lng) res.coords = { lat, lng };
    }
  }
  return res;
}

export async function imageMetadata(file) {
  try {
    return parseExif(await readView(file, 0, Math.min(file.size, 256 * 1024)));
  } catch (e) {
    console.warn('image metadata', e);
    return { coords: null, date: null };
  }
}

function drawThumb(source, w, h) {
  const scale = Math.min(1, 320 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

export function videoThumbnail(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = val => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(val); };
    const timer = setTimeout(() => done(null), 8000);
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = () => {
      try { done(drawThumb(v, v.videoWidth, v.videoHeight)); } catch { done(null); }
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}

export async function imageThumbnail(file) {
  try {
    const bmp = await createImageBitmap(file);
    return drawThumb(bmp, bmp.width, bmp.height);
  } catch { return null; }
}

export async function analyseMedia(file) {
  const isVideo = /^video\//.test(file.type) || /\.(mp4|mov|m4v|3gp)$/i.test(file.name);
  const [meta, thumb] = isVideo
    ? await Promise.all([videoMetadata(file), videoThumbnail(file)])
    : await Promise.all([imageMetadata(file), imageThumbnail(file)]);
  return { ...meta, thumb, kind: isVideo ? 'video' : 'photo', fileName: file.name };
}
