import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoov, parseExif } from '../../public/travel/js/media.js';

const box = (type, ...kids) => {
  const body = Buffer.concat(kids);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(8 + body.length);
  h.write(type, 4, 'latin1');
  return Buffer.concat([h, body]);
};
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const dv = buf => new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

test('Android-style ©xyz in moov/udta', () => {
  const s = Buffer.from('+35.6586+139.7454/', 'latin1');
  const xyz = Buffer.concat([Buffer.from([0, s.length, 0x15, 0xc7]), s]);
  const moov = box('moov', box('udta', box('©xyz', xyz)));
  const r = parseMoov(dv(moov.subarray(8)));
  assert.deepEqual(r.coords, { lat: 35.6586, lng: 139.7454 });
});

test('iPhone-style QuickTime keys/ilst ISO6709', () => {
  const key = Buffer.from('com.apple.quicktime.location.ISO6709', 'latin1');
  const keys = box('keys', u32(0), u32(1), u32(8 + key.length), Buffer.from('mdta'), key);
  const data = box('data', u32(1), u32(0), Buffer.from('+48.8584+002.2945+035.000/', 'latin1'));
  const item = Buffer.concat([u32(8 + data.length), u32(1), data]);
  const ilst = box('ilst', item);
  const hdlr = box('hdlr', Buffer.alloc(24));
  const moov = box('moov', box('meta', hdlr, keys, ilst));
  const r = parseMoov(dv(moov.subarray(8)));
  assert.deepEqual(r.coords, { lat: 48.8584, lng: 2.2945 });
});

test('JPEG EXIF GPS', () => {
  // Little-endian TIFF: IFD0 with one GPS pointer, GPS IFD with 4 tags.
  const t = Buffer.alloc(200);
  t.write('II', 0); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4);
  t.writeUInt16LE(1, 8);
  t.writeUInt16LE(0x8825, 10); t.writeUInt16LE(4, 12); t.writeUInt32LE(1, 14); t.writeUInt32LE(26, 18);
  t.writeUInt32LE(0, 22);
  let o = 26;
  t.writeUInt16LE(4, o); o += 2;
  const rat = 80;
  const entry = (tag, type, count, val) => { t.writeUInt16LE(tag, o); t.writeUInt16LE(type, o + 2); t.writeUInt32LE(count, o + 4); val(o + 8); o += 12; };
  entry(1, 2, 2, at => t.write('S\0', at));
  entry(2, 5, 3, at => t.writeUInt32LE(rat, at));
  entry(3, 2, 2, at => t.write('W\0', at));
  entry(4, 5, 3, at => t.writeUInt32LE(rat + 24, at));
  const r = (at, n, d) => { t.writeUInt32LE(n, at); t.writeUInt32LE(d, at + 4); };
  r(rat, 33, 1); r(rat + 8, 51, 1); r(rat + 16, 3600, 100);   // 33°51'36" S
  r(rat + 24, 151, 1); r(rat + 32, 12, 1); r(rat + 40, 0, 1); // 151°12' W
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, 0]), Buffer.from('Exif\0\0', 'latin1'), t]);
  app1.writeUInt16BE(app1.length - 2, 2);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]);
  const res = parseExif(dv(jpg));
  assert.ok(Math.abs(res.coords.lat + 33.86) < 1e-6, res.coords.lat);
  assert.ok(Math.abs(res.coords.lng + 151.2) < 1e-6, res.coords.lng);
});
