#!/usr/bin/env node
// Thumbnail v2 cho mọi bia đã dựng: render từ LOD0 bằng CHÍNH script v1 (tools/render-thumb.py — EEVEE, azimuth 30°,
// elevation 15°, 800×1000, nền trong suốt, đèn key/fill/rim như v1) → models-v2/thumbs/<id>.webp (800×1000) +
// <id>.sm.webp (240×300, cho UI: xem trước bia kế bên ở mũi tên, rê chuột trên dòng thời gian). Ghi
// models-v2/thumbs/index.json (build.mjs --manifest gộp vào manifest).
//
// Blender không đọc được KTX2 / meshopt → mỗi bia dựng một GLB trung gian tạm: giải meshopt + bỏ lượng tử, texture KTX2
// giải bằng `basisu -unpack` (BC7, đúng như GPU desktop thấy) → PNG. Tệp tạm xoá ngay sau khi render.
//
// Chạy:  node tools/v2/thumbs.mjs [id…] [--jobs=2] [--force]      (bỏ qua bia đã có thumbnail mới hơn lod0.glb)
// Chặn đĩa như build.mjs (V2_MIN_FREE_GB, mặc định 4 GB).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

import { run, BLENDER_BIN, BASISU_BIN } from './lib/proc.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'models-v2');
const THUMB_DIR = path.join(OUT_DIR, 'thumbs');
const WORK = process.env.V2_WORK_DIR || path.join(os.homedir(), '.cache', 'vanmieu-bia-3d', 'v2');
const RENDER_SCRIPT = path.join(__dirname, '..', 'render-thumb.py'); // v1 — cùng camera / đèn / cỡ ảnh
const MIN_FREE_GB = Number(process.env.V2_MIN_FREE_GB ?? 4);
const AZIMUTH = 30;
const ELEVATION = 15;
const SMALL = [240, 300];
const TEX_MAX = 2048; // texture cho Blender (thumbnail 800×1000 không cần 4096)

const freeGB = () => {
  const s = fs.statfsSync(ROOT);
  return (s.bavail * s.bsize) / 1e9;
};

let ioP;
const getIO = () =>
  (ioP ??= MeshoptDecoder.ready.then(() =>
    new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })));

/** KTX2 → PNG mức 0 (giải BC7 bằng basisu), thu nhỏ về ≤ TEX_MAX. */
async function ktx2ToPng(ktx2, dir, name) {
  const inFile = path.join(dir, `${name}.ktx2`);
  fs.writeFileSync(inFile, ktx2);
  await run(BASISU_BIN, ['-unpack', '-no_ktx', '-format_only', '6', '-output_path', dir, inFile]);
  const lvl0 = fs.readdirSync(dir).find((f) => f.startsWith(`${name}_unpacked_rgb_`) && f.includes('_level_0_'));
  if (!lvl0) throw new Error(`basisu không giải được ${name}.ktx2`);
  const meta = await sharp(path.join(dir, lvl0)).metadata();
  const size = Math.min(TEX_MAX, meta.width);
  const png = await sharp(path.join(dir, lvl0)).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 1 }).toBuffer();
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${name}_unpacked_`) || f === `${name}.ktx2`) fs.rmSync(path.join(dir, f));
  return png;
}

async function thumbOne(id, force) {
  const lod0 = path.join(OUT_DIR, id, 'lod0.glb');
  const big = path.join(THUMB_DIR, `${id}.webp`);
  const sm = path.join(THUMB_DIR, `${id}.sm.webp`);
  if (!force && fs.existsSync(big) && fs.existsSync(sm) && fs.statSync(big).mtimeMs > fs.statSync(lod0).mtimeMs) {
    return { id, skipped: true };
  }
  const t0 = Date.now();
  const tmp = path.join(WORK, id, 'thumb-tmp');
  await fsp.mkdir(tmp, { recursive: true });
  try {
    const io = await getIO();
    const doc = await io.read(lod0);
    const root = doc.getRoot();
    for (const tex of root.listTextures()) {
      const png = await ktx2ToPng(Buffer.from(tex.getImage()), tmp, tex.getName() || 'tex');
      tex.setImage(png).setMimeType('image/png');
    }
    await doc.transform(dequantize());
    for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) prim.setAttribute('TANGENT', null); // Blender tự tính
    for (const ext of root.listExtensionsUsed()) {
      if (['KHR_texture_basisu', 'EXT_meshopt_compression', 'KHR_mesh_quantization'].includes(ext.extensionName)) ext.dispose();
    }
    const glb = path.join(tmp, 'thumb-in.glb');
    await io.write(glb, doc);
    const png = path.join(tmp, 'thumb.png');
    const r = await run(BLENDER_BIN, ['-b', '--factory-startup', '-noaudio', '-P', RENDER_SCRIPT, '--', glb, png, String(AZIMUTH), String(ELEVATION)]);
    const line = r.stdout.split('\n').find((l) => l.includes('[render-thumb] wrote')) ?? '';
    await fsp.mkdir(THUMB_DIR, { recursive: true });
    await sharp(png).webp({ quality: 85, alphaQuality: 90 }).toFile(`${big}.part`);
    await sharp(png).resize(SMALL[0], SMALL[1], { kernel: 'lanczos3', fit: 'fill' }).webp({ quality: 82, alphaQuality: 90 }).toFile(`${sm}.part`);
    fs.renameSync(`${big}.part`, big);
    fs.renameSync(`${sm}.part`, sm);
    const m = await sharp(png).metadata();
    console.log(`[${id}] thumbnail ${m.width}×${m.height} ${(fs.statSync(big).size / 1024).toFixed(0)} KB + sm ${(fs.statSync(sm).size / 1024).toFixed(0)} KB · ${((Date.now() - t0) / 1000).toFixed(1)}s ${line.replace(/.*\(/, '(')}`);
    return { id, ms: Date.now() - t0 };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function writeIndex() {
  const index = {};
  for (const f of (await fsp.readdir(THUMB_DIR)).filter((x) => /^bia-\d{4}\.webp$/.test(x)).sort()) {
    const id = f.replace('.webp', '');
    const sm = `${id}.sm.webp`;
    const a = await sharp(path.join(THUMB_DIR, f)).metadata();
    const b = await sharp(path.join(THUMB_DIR, sm)).metadata();
    index[id] = {
      file: `thumbs/${f}`, w: a.width, h: a.height, bytes: fs.statSync(path.join(THUMB_DIR, f)).size,
      sm: { file: `thumbs/${sm}`, w: b.width, h: b.height, bytes: fs.statSync(path.join(THUMB_DIR, sm)).size },
    };
  }
  const total = Object.values(index).reduce((s, t) => s + t.bytes + t.sm.bytes, 0);
  await fsp.writeFile(path.join(THUMB_DIR, 'index.json'), `${JSON.stringify({
    $comment: `Sinh bởi tools/v2/thumbs.mjs — render LOD0 bằng tools/render-thumb.py (EEVEE, az ${AZIMUTH}°, el ${ELEVATION}°, nền trong suốt).`,
    camera: { azimuth: AZIMUTH, elevation: ELEVATION }, totalBytes: total, thumbs: index,
  }, null, 1)}\n`);
  return { count: Object.keys(index).length, total };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const jobs = Math.max(1, Math.min(3, Number(args.find((a) => a.startsWith('--jobs='))?.split('=')[1] ?? 2)));
  let ids = args.filter((a) => !a.startsWith('--'));
  if (!ids.length) ids = (await fsp.readdir(OUT_DIR)).filter((d) => /^bia-\d{4}$/.test(d) && fs.existsSync(path.join(OUT_DIR, d, 'lod0.glb'))).sort();
  const queue = [...ids];
  const failed = {};
  let stopped = false;
  const t0 = Date.now();
  const worker = async () => {
    while (queue.length && !stopped) {
      if (freeGB() < MIN_FREE_GB) {
        stopped = true;
        console.error(`!!! dừng: chỉ còn ${freeGB().toFixed(1)} GB trống (< ${MIN_FREE_GB} GB) — giải phóng đĩa rồi chạy lại`);
        return;
      }
      const id = queue.shift();
      try {
        await thumbOne(id, force);
      } catch (e) {
        failed[id] = String(e.message).split('\n')[0];
        console.error(`[${id}] LỖI: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const { count, total } = await writeIndex();
  console.log(`\n${count} thumbnail · tổng ${(total / 1e6).toFixed(2)} MB · ${((Date.now() - t0) / 60000).toFixed(1)} phút · lỗi ${Object.keys(failed).length}${stopped ? ' · DỪNG vì đĩa' : ''}`);
  if (Object.keys(failed).length || stopped) process.exit(stopped ? 3 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
