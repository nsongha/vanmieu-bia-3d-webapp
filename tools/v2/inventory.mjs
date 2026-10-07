#!/usr/bin/env node
// Model pipeline v2 — bước 1: kiểm kê 82 thư mục quét nguồn (CHỈ ĐỌC, không sửa gì trong thư mục nguồn).
//
// Mỗi thư mục "STT-năm": liệt kê mọi tệp 3D (.glb/.gltf/.obj/.fbx/.blend), đọc nhanh phần JSON của GLB (không giải mã
// hình học) để lấy số tam giác / đỉnh / mesh / primitive, texture (mime, kích thước ảnh đọc từ header JPEG/PNG), có
// NORMAL / UV / normal map không, tỉ lệ đỉnh/tam giác (≈ 2,8 → pháp tuyến phẳng từng mặt), mesh trùng lặp (cùng số đỉnh).
// OBJ: đếm dòng v / f, đọc map_Kd trong .mtl. Rồi đề xuất tệp nguồn tốt nhất cho từng bia (ưu tiên NEW/new/HOAN THIEN,
// bỏ bản -test; chọn theo số tam giác × độ phân giải texture), ghi tools/v2/sources.json (+ inventory.full.json).
//
// Chạy:  node tools/v2/inventory.mjs            (≈ 1 phút; đọc header, OBJ lớn được đếm dòng)
//        node tools/v2/inventory.mjs --no-obj   (bỏ đếm OBJ — nhanh hơn)

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_DIR = '/Users/songha/Documents/Projects/2.3. Xây dựng nội dung số 3D Cấp độ 3 (82 bia)';
const OUT_SOURCES = path.join(__dirname, 'sources.json');
const OUT_FULL = path.join(__dirname, 'inventory.full.json');

// Lựa chọn đã làm ở v1 (tools/prepare-models.mjs MODELS) — giữ nguyên khi hợp lệ, để v1/v2 so sánh cùng nguồn.
const V1_CHOICE = {
  'bia-1661': '11-1661/11-1661.glb',
  'bia-1442': '81-1442/bia 2.1 (1442)/2.glb',
  'bia-1463': '33-1463/33.glb',
  'bia-1487': '17-1487/17.glb',
  'bia-1514': '35-1514/NEW/35.glb',
  'bia-1554': '5-1554/NEW/5.glb',
  'bia-1604': '10-1604/10-1604.glb',
  'bia-1680': '16-1680/new/16.glb',
  'bia-1727': '30-1727/30-1727.glb',
  'bia-1779': '52-1779/52.glb',
};

// Chọn tay (sau khi soát bằng mắt / số liệu) — ghi đè thuật toán chọn. id -> { path, note }.
const MANUAL = {
  'bia-1442': { path: '81-1442/bia 2.1 (1442)/2.glb', note: 'v1: bake low-poly 71k + normal map; "1442 final/01.glb" là khối thô 31k tam giác (cùng con rùa, chân có vuốt). Không có bản quét gốc (Biaso81.obj là rùa của 1448)' },
  'bia-1448': {
    path: '82-1448/bia 1.1/01.glb',
    note:
      'cùng kiểu với 1442 (bake low-poly 40k + normal map 4096); "1448 final/bia 1.1/01.glb" có màu 6000 PNG nhưng KHÔNG gắn normal map. ' +
      'Đã soát (phase 2, .captures/v2-ident-biaso81.jpg): Biaso81.obj (2,93 triệu tam giác, 9295×8935, nghiêng + còn nền đất) là bản quét ' +
      'CHỈ PHẦN RÙA + gốc phiến bia gãy — rùa khớp 1448 (chân mái chèo tròn, đầu thấp nằm ngang), KHÔNG khớp 1442 (chân có vuốt, đầu ngẩng). ' +
      'Không có phiến bia → không dùng làm nguồn đầy đủ; dùng low-poly bake sẵn',
    highRes: '82-1448/Biaso81.obj',
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Đọc kích thước ảnh từ header (JPEG SOFn / PNG IHDR / WebP) — không giải mã ảnh.
// ---------------------------------------------------------------------------------------------------------------------
export function imageSize(buf) {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: 'png' };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i++; continue; }
      const len = buf.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), fmt: 'jpeg' };
      }
      i += 2 + len;
    }
    return { w: null, h: null, fmt: 'jpeg' };
  }
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), fmt: 'webp' };
    if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, fmt: 'webp' };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff), fmt: 'webp' };
    }
  }
  return { w: null, h: null, fmt: 'unknown' };
}

function readRange(fd, pos, len) {
  const b = Buffer.alloc(len);
  const n = fs.readSync(fd, b, 0, len, pos);
  return b.subarray(0, n);
}

// ---------------------------------------------------------------------------------------------------------------------
// GLB / glTF: chỉ đọc JSON + header ảnh.
// ---------------------------------------------------------------------------------------------------------------------
function summarizeGltfJson(json, readImageHead) {
  const acc = json.accessors ?? [];
  const meshes = json.meshes ?? [];
  const materials = json.materials ?? [];
  const textures = json.textures ?? [];
  const images = json.images ?? [];
  let tris = 0;
  let verts = 0;
  let prims = 0;
  const meshInfo = [];
  let hasNormal = true;
  let hasUV = true;
  for (const m of meshes) {
    let mt = 0;
    let mv = 0;
    for (const p of m.primitives ?? []) {
      prims++;
      const pos = acc[p.attributes?.POSITION];
      const v = pos?.count ?? 0;
      const t = p.indices !== undefined ? acc[p.indices].count / 3 : v / 3;
      mt += t;
      mv += v;
      if (p.attributes?.NORMAL === undefined) hasNormal = false;
      if (p.attributes?.TEXCOORD_0 === undefined) hasUV = false;
    }
    tris += mt;
    verts += mv;
    meshInfo.push({ name: m.name ?? '', tris: Math.round(mt), verts: mv, material: m.primitives?.[0]?.material ?? null });
  }
  const imgs = images.map((im, i) => {
    const head = readImageHead(im, i);
    return { name: im.name ?? im.uri ?? `#${i}`, mime: im.mimeType ?? null, bytes: head.bytes, w: head.w, h: head.h };
  });
  const texImage = (ti) => (ti === undefined ? null : textures[ti.index]?.source ?? null);
  const mats = materials.map((m) => ({
    name: m.name ?? '',
    baseColor: texImage(m.pbrMetallicRoughness?.baseColorTexture),
    normal: texImage(m.normalTexture),
    mr: texImage(m.pbrMetallicRoughness?.metallicRoughnessTexture),
  }));
  // Mesh trùng lặp (như bia-1727): hai mesh cùng số đỉnh và tam giác.
  const dup = [];
  for (let a = 0; a < meshInfo.length; a++) {
    for (let b = a + 1; b < meshInfo.length; b++) {
      if (meshInfo[a].verts === meshInfo[b].verts && meshInfo[a].tris === meshInfo[b].tris && meshInfo[a].verts > 1000) {
        dup.push([meshInfo[a].name, meshInfo[b].name]);
      }
    }
  }
  return {
    generator: json.asset?.generator ?? null,
    extensionsUsed: json.extensionsUsed ?? [],
    meshes: meshes.length,
    primitives: prims,
    nodes: (json.nodes ?? []).length,
    tris: Math.round(tris),
    verts,
    vertsPerTri: tris ? +(verts / tris).toFixed(2) : null,
    hasNormal,
    hasUV,
    meshInfo,
    materials: mats,
    images: imgs,
    duplicateMeshes: dup,
  };
}

function inspectGlb(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const h = readRange(fd, 0, 20);
    if (h.length < 20 || h.toString('ascii', 0, 4) !== 'glTF') return { error: 'không phải GLB (magic sai)' };
    const total = h.readUInt32LE(8);
    const jsonLen = h.readUInt32LE(12);
    if (h.readUInt32LE(16) !== 0x4e4f534a) return { error: 'chunk đầu không phải JSON' };
    const json = JSON.parse(readRange(fd, 20, jsonLen).toString('utf8'));
    const binStart = 20 + jsonLen + 8;
    const size = fs.fstatSync(fd).size;
    const readImageHead = (im) => {
      if (im.bufferView === undefined) return { bytes: null, w: null, h: null };
      const bv = json.bufferViews[im.bufferView];
      const head = readRange(fd, binStart + (bv.byteOffset ?? 0), Math.min(bv.byteLength, 512 * 1024));
      const s = imageSize(head);
      return { bytes: bv.byteLength, w: s.w, h: s.h };
    };
    const r = summarizeGltfJson(json, readImageHead);
    if (total !== size) r.warn = `độ dài header ${total} ≠ kích thước tệp ${size} (tệp hỏng/cắt cụt?)`;
    return r;
  } finally {
    fs.closeSync(fd);
  }
}

function inspectGltf(file) {
  // .gltf có thể nhúng buffer base64 rất lớn — parse cả tệp (89 MB là chấp nhận được), không giải mã ảnh base64 hết.
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dir = path.dirname(file);
  const readImageHead = (im) => {
    if (im.uri?.startsWith('data:')) {
      const b64 = im.uri.slice(im.uri.indexOf(',') + 1);
      const head = Buffer.from(b64.slice(0, 700_000), 'base64');
      const s = imageSize(head);
      return { bytes: Math.round((b64.length * 3) / 4), w: s.w, h: s.h };
    }
    if (im.uri) {
      const p = path.join(dir, decodeURIComponent(im.uri));
      if (!fs.existsSync(p)) return { bytes: null, w: null, h: null, missing: true };
      const fd = fs.openSync(p, 'r');
      const s = imageSize(readRange(fd, 0, 512 * 1024));
      fs.closeSync(fd);
      return { bytes: fs.statSync(p).size, w: s.w, h: s.h };
    }
    if (im.bufferView !== undefined) {
      // bufferView trong buffer data-URI
      const bv = json.bufferViews[im.bufferView];
      const buf = json.buffers[bv.buffer];
      if (buf.uri?.startsWith('data:')) {
        const b64 = buf.uri.slice(buf.uri.indexOf(',') + 1);
        const off = bv.byteOffset ?? 0;
        const start = Math.floor(off / 3) * 4;
        const head = Buffer.from(b64.slice(start, start + 700_000), 'base64').subarray(off % 3);
        const s = imageSize(head);
        return { bytes: bv.byteLength, w: s.w, h: s.h };
      }
      if (buf.uri) {
        const p = path.join(dir, decodeURIComponent(buf.uri));
        if (!fs.existsSync(p)) return { bytes: bv.byteLength, w: null, h: null, missing: true };
        const fd = fs.openSync(p, 'r');
        const s = imageSize(readRange(fd, bv.byteOffset ?? 0, Math.min(bv.byteLength, 512 * 1024)));
        fs.closeSync(fd);
        return { bytes: bv.byteLength, w: s.w, h: s.h };
      }
    }
    return { bytes: null, w: null, h: null };
  };
  return summarizeGltfJson(json, readImageHead);
}

async function inspectObj(file) {
  let v = 0;
  let vt = 0;
  let vn = 0;
  let f = 0;
  let tris = 0;
  const mtllibs = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const c0 = line.charCodeAt(0);
    if (c0 === 118) {
      // v
      const c1 = line.charCodeAt(1);
      if (c1 === 32) v++;
      else if (c1 === 116) vt++;
      else if (c1 === 110) vn++;
    } else if (c0 === 102 && line.charCodeAt(1) === 32) {
      f++;
      const n = line.trim().split(/\s+/).length - 1;
      tris += Math.max(0, n - 2);
    } else if (line.startsWith('mtllib ')) mtllibs.push(line.slice(7).trim());
  }
  const dir = path.dirname(file);
  const textures = [];
  for (const lib of mtllibs) {
    const p = path.join(dir, lib);
    if (!fs.existsSync(p)) {
      textures.push({ mtl: lib, missing: true });
      continue;
    }
    for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*(map_Kd|map_Bump|bump|norm)\s+(.+)$/i);
      if (!m) continue;
      const tp = path.join(dir, m[2].trim().split(/\s+/).pop());
      let w = null;
      let h = null;
      let bytes = null;
      const exists = fs.existsSync(tp);
      if (exists) {
        const fd = fs.openSync(tp, 'r');
        ({ w, h } = imageSize(readRange(fd, 0, 512 * 1024)));
        fs.closeSync(fd);
        bytes = fs.statSync(tp).size;
      }
      textures.push({ slot: m[1], file: path.basename(tp), exists, w, h, bytes });
    }
  }
  return { v, vt, vn, faces: f, tris, vertsPerTri: tris ? +(v / tris).toFixed(2) : null, mtllibs, textures };
}

// ---------------------------------------------------------------------------------------------------------------------
// Đề xuất nguồn tốt nhất cho một thư mục.
// ---------------------------------------------------------------------------------------------------------------------
const PREFERRED_SUBDIR = /(^|\/)(new|hoan thien)(\/|$)/i;

function texPixels(info) {
  const bc = info.materials?.map((m) => m.baseColor).filter((x) => x !== null) ?? [];
  const ids = bc.length ? [...new Set(bc)] : info.images?.map((_, i) => i) ?? [];
  return ids.reduce((s, i) => s + (info.images[i]?.w ?? 0) * (info.images[i]?.h ?? 0), 0);
}

function scoreCandidate(c) {
  // Điểm: có texture (bắt buộc) → ưu tiên thư mục NEW/HOAN THIEN → tam giác (log) → pixel texture. Bỏ bản -test/-copy.
  const info = c.info;
  if (info.error) return -Infinity;
  let s = 0;
  if (!info.images?.length) s -= 1000;
  if (!info.hasUV) s -= 500;
  if (/test|copy/i.test(path.basename(c.rel))) s -= 200;
  if (PREFERRED_SUBDIR.test(c.rel)) s += 100;
  s += 10 * Math.log10(Math.max(1, info.tris));
  s += 5 * Math.log10(Math.max(1, texPixels(info)));
  return s;
}

function folderMeta(name) {
  const m = name.match(/^(\d+)\s*-\s*(\d{4})$/);
  if (!m) return null;
  return { stt: Number(m[1]), year: Number(m[2]) };
}

async function main() {
  const skipObj = process.argv.includes('--no-obj');
  const dirs = (await fsp.readdir(SOURCE_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const folders = [];
  const years = new Map();
  for (const name of dirs) {
    const meta = folderMeta(name);
    if (!meta) {
      console.warn(`! bỏ qua thư mục không đúng mẫu STT-năm: "${name}"`);
      continue;
    }
    years.set(meta.year, [...(years.get(meta.year) ?? []), name]);
    folders.push({ name, ...meta });
  }
  folders.sort((a, b) => a.stt - b.stt);

  const all = {};
  const sources = {};
  for (const fo of folders) {
    const abs = path.join(SOURCE_DIR, fo.name);
    const files = [];
    const walk = async (d, rel) => {
      for (const e of await fsp.readdir(d, { withFileTypes: true })) {
        if (e.name === '.DS_Store') continue;
        const p = path.join(d, e.name);
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (e.name === 'image') continue; // ảnh xoay 360° (imagerotator) — không phải mô hình
          await walk(p, r);
        } else files.push({ abs: p, rel: r, bytes: fs.statSync(p).size });
      }
    };
    await walk(abs, '');
    const id = `bia-${fo.year}`;
    const entry = { id, stt: fo.stt, year: fo.year, folder: fo.name, models: [], otherFiles: [], notes: [] };
    for (const f of files) {
      const ext = path.extname(f.rel).toLowerCase();
      const relFull = `${fo.name}/${f.rel}`;
      if (ext === '.glb') entry.models.push({ rel: relFull, kind: 'glb', bytes: f.bytes, info: inspectGlb(f.abs) });
      else if (ext === '.gltf') entry.models.push({ rel: relFull, kind: 'gltf', bytes: f.bytes, info: inspectGltf(f.abs) });
      else if (ext === '.obj') {
        entry.models.push({ rel: relFull, kind: 'obj', bytes: f.bytes, info: skipObj ? { skipped: true } : await inspectObj(f.abs) });
      } else if (ext === '.fbx' || ext === '.blend') {
        entry.models.push({ rel: relFull, kind: ext.slice(1), bytes: f.bytes, info: f.bytes === 0 ? { error: 'tệp rỗng (0 byte)' } : {} });
      } else if (ext !== '.blend1' && ext !== '.mtl') {
        let img = null;
        if (/\.(jpe?g|png)$/i.test(ext)) {
          const fd = fs.openSync(f.abs, 'r');
          img = imageSize(readRange(fd, 0, 512 * 1024));
          fs.closeSync(fd);
        }
        entry.otherFiles.push({ rel: f.rel, bytes: f.bytes, ...(img ? { w: img.w, h: img.h } : {}) });
      }
    }
    // --- đề xuất
    const glbs = entry.models.filter((m) => m.kind === 'glb' || m.kind === 'gltf');
    for (const m of entry.models) {
      if (m.info?.error) entry.notes.push(`HỎNG: ${m.rel} — ${m.info.error}`);
      if (m.info?.warn) entry.notes.push(`CẢNH BÁO: ${m.rel} — ${m.info.warn}`);
    }
    let chosen = null;
    let reason = '';
    if (MANUAL[id]) {
      chosen = glbs.find((m) => m.rel === MANUAL[id].path) ?? null;
      reason = `chọn tay: ${MANUAL[id].note}`;
    }
    if (!chosen && glbs.length) {
      const ranked = glbs.map((c) => ({ c, s: scoreCandidate(c) })).sort((a, b) => b.s - a.s);
      chosen = ranked[0].c;
      reason = ranked.length > 1 ? `điểm cao nhất trong ${ranked.length} GLB/glTF` : 'GLB duy nhất';
    }
    if (!glbs.length) entry.notes.push('KHÔNG có GLB/glTF — cần xuất từ .blend/.fbx/.obj');
    if (V1_CHOICE[id] && chosen && V1_CHOICE[id] !== chosen.rel) {
      entry.notes.push(`khác lựa chọn v1 (${V1_CHOICE[id]})`);
    }
    if (chosen) {
      const i = chosen.info;
      if (i.meshes > 1) entry.notes.push(`${i.meshes} mesh / ${i.primitives} primitive`);
      if (i.duplicateMeshes?.length) entry.notes.push(`mesh trùng lặp: ${i.duplicateMeshes.map((p) => p.join(' = ')).join('; ')}`);
      if (!i.images?.length) entry.notes.push('GLB không có texture');
      if (!i.hasNormal) entry.notes.push('thiếu NORMAL');
      if (i.vertsPerTri && i.vertsPerTri > 2.2) entry.notes.push(`pháp tuyến phẳng từng mặt (${i.vertsPerTri} đỉnh/tam giác)`);
      const normalMaps = i.materials?.filter((m) => m.normal !== null) ?? [];
      if (normalMaps.length) entry.notes.push('có normal map sẵn (bake low-poly)');
      if (i.tris < 150_000) entry.notes.push(`ít tam giác (${Math.round(i.tris / 1000)}k) — LOD0 không thể dày hơn nguồn`);
      // OBJ nguồn dày hơn GLB đã chọn?
      for (const o of entry.models.filter((m) => m.kind === 'obj' && m.info?.tris)) {
        if (o.info.tris > i.tris * 1.2) entry.notes.push(`OBJ dày hơn: ${o.rel} (${Math.round(o.info.tris / 1000)}k tam giác) — cân nhắc làm nguồn bake`);
      }
      // Các GLB khác (không phải test) có texture to hơn / nhiều tam giác hơn?
      for (const o of glbs) {
        if (o === chosen || o.info?.error) continue;
        if (/test/i.test(o.rel)) continue;
        if (o.info.tris > i.tris * 1.2 || texPixels(o.info) > texPixels(i) * 1.2) {
          entry.notes.push(`GLB khác có thể tốt hơn: ${o.rel} (${Math.round(o.info.tris / 1000)}k, tex ${texPixels(o.info) ? Math.round(Math.sqrt(texPixels(o.info))) : 0}px²)`);
        }
      }
    }
    // Tên tệp không khớp STT / năm của thư mục (dễ nhầm bia).
    for (const m of entry.models) {
      const b = path.basename(m.rel);
      const n = b.match(/^(?:fix )?(\d+)(?:-(\d{4}))?/);
      if (n && !/^(01|2|bake)\./.test(b) && (Number(n[1]) !== fo.stt || (n[2] && Number(n[2]) !== fo.year))) {
        entry.notes.push(`tên tệp lệch thư mục: ${m.rel}`);
      }
    }
    if (chosen && Math.max(0, ...(chosen.info.images ?? []).map((x) => x.w ?? 0)) < 4096) {
      entry.notes.push(`texture nguồn chỉ ${Math.max(0, ...chosen.info.images.map((x) => x.w ?? 0))}px — LOD0 không lên 4096 được`);
    }
    if (MANUAL[id]?.highRes) entry.notes.push(`bản quét thô ${MANUAL[id].highRes}: chỉ phần rùa (đã soát) — không dùng làm nguồn`);
    if ((years.get(fo.year) ?? []).length > 1) entry.notes.push(`TRÙNG NĂM với ${years.get(fo.year).filter((n) => n !== fo.name).join(', ')}`);
    entry.chosen = chosen ? chosen.rel : null;
    entry.reason = reason;
    all[id] = entry;

    const ci = chosen?.info;
    const bc = ci?.materials?.map((m) => m.baseColor).filter((x) => x !== null) ?? [];
    const bcIds = [...new Set(bc)];
    sources[id] = {
      stt: fo.stt,
      year: fo.year,
      folder: fo.name,
      path: chosen?.rel ?? null,
      bytes: chosen?.bytes ?? null,
      tris: ci?.tris ?? null,
      verts: ci?.verts ?? null,
      meshes: ci?.meshes ?? null,
      primitives: ci?.primitives ?? null,
      textures: ci?.images?.map((im, k) => ({ w: im.w, h: im.h, mime: im.mime, bytes: im.bytes, role: bcIds.includes(k) ? 'baseColor' : ci.materials.some((m) => m.normal === k) ? 'normal' : 'other' })) ?? [],
      alternatives: entry.models.filter((m) => m.rel !== chosen?.rel).map((m) => `${m.rel} (${(m.bytes / 1e6).toFixed(1)} MB${m.info?.tris ? `, ${Math.round(m.info.tris / 1000)}k tris` : ''})`),
      reason,
      notes: entry.notes,
      ...(MANUAL[id]?.highRes ? { highResCandidate: MANUAL[id].highRes } : {}),
      flag: entry.notes.some((n) => /HỎNG|KHÔNG có|TRÙNG|có thể tốt hơn|OBJ dày hơn|trùng lặp|không có texture|ít tam giác|lệch thư mục|chỉ \d+px|gốc tiềm năng/i.test(n)),
    };
    const t = sources[id];
    console.log(
      `${String(fo.stt).padStart(2)} ${id} ${String(t.path).padEnd(52)} ${String(Math.round((t.tris ?? 0) / 1000)).padStart(5)}k ` +
        `${t.textures.map((x) => `${x.w}x${x.h}`).join('+').padEnd(20)} ${t.flag ? '⚑ ' : ''}${t.notes.join(' | ')}`,
    );
  }
  const header = {
    $comment:
      'Sinh bởi tools/v2/inventory.mjs — nguồn đề xuất cho pipeline v2 (đường dẫn tương đối SOURCE_DIR). Sửa lựa chọn qua MANUAL trong script rồi chạy lại. flag = cần soát bằng mắt.',
    sourceDir: SOURCE_DIR,
    generated: new Date().toISOString(),
  };
  await fsp.writeFile(OUT_SOURCES, `${JSON.stringify({ ...header, steles: sources }, null, 2)}\n`);
  await fsp.writeFile(OUT_FULL, `${JSON.stringify({ ...header, folders: all }, null, 2)}\n`);
  console.log(`→ ${path.relative(process.cwd(), OUT_SOURCES)}, ${path.relative(process.cwd(), OUT_FULL)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
