#!/usr/bin/env node
// Recursively compress images in public/art/ — resize to max 1600px wide and
// re-encode as JPG. Replaces originals (PNG→JPG). Idempotent: skips files already
// processed (small enough JPGs are left alone).
//
// Run: node scripts/optimize-art.mjs

import { readdir, stat, unlink, rename } from 'node:fs/promises';
import { join, extname, dirname, basename } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../public/art', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const MAX_WIDTH = 1600;
const JPG_QUALITY = 82;
const SKIP_BELOW_BYTES = 400_000; // small JPGs left alone

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function process(file) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;

  const st = await stat(file);
  if (ext !== '.png' && st.size < SKIP_BELOW_BYTES) return { file, skipped: true };

  const tmp = file + '.opt.jpg';
  await sharp(file)
    .rotate() // honor EXIF orientation
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
    .toFile(tmp);

  const outName = basename(file, ext) + '.jpg';
  const out = join(dirname(file), outName);

  // If converting a non-JPG to JPG, delete the original first
  if (file !== out) {
    await unlink(file);
  } else {
    await unlink(file);
  }
  await rename(tmp, out);

  const newSt = await stat(out);
  return { from: file, to: out, before: st.size, after: newSt.size };
}

const files = await walk(ROOT);
let totalBefore = 0;
let totalAfter = 0;
for (const f of files) {
  try {
    const r = await process(f);
    if (!r) continue;
    if (r.skipped) {
      console.log(`skip   ${basename(f)} (${(r.file && (await stat(r.file)).size / 1024 | 0)} KB)`);
      continue;
    }
    totalBefore += r.before;
    totalAfter += r.after;
    console.log(
      `${(r.before / 1024 | 0).toString().padStart(6)} KB → ${(r.after / 1024 | 0).toString().padStart(5)} KB  ${basename(r.to)}`
    );
  } catch (e) {
    console.error('error', f, e.message);
  }
}
console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB`);
