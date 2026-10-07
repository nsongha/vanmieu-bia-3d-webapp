#!/usr/bin/env node
// Model pipeline v2 — dựng LOD0 / LOD1 / LOD2 cho từng bia từ bản quét nguồn (tools/v2/sources.json) → models-v2/<id>/.
//
//   LOD0: giản lược tới 150k tam giác (nguồn ít hơn thì giữ nguyên; sai số giản lược > 3e-4 thì nâng 200k → 250k),
//         pháp tuyến đỉnh MƯỢT hoàn toàn + normal map 2048 tangent-space BAKE (Blender Cycles, selected-to-active) từ bản
//         quét ĐẦY ĐỦ mang pháp tuyến gãy 25° (logic tools/smooth-normals.mjs), tiếp tuyến MikkTSpace, base colour KTX2
//         UASTC+Zstd 4096 (không vượt nguồn), λ=1 tất định.
//   LOD1: 25% tam giác LOD0, pháp tuyến gãy 60° (25° như v1 để lại mảnh vát sáng ở rãnh sau giản lược), không normal
//         map, base colour KTX2 ETC1S 1024.
//   LOD2: đúng hợp đồng tools/make-proxies.mjs (gọi thẳng buildProxy() trên LOD0): ~6k tam giác, chỉ vị trí + pháp tuyến.
//   Mọi LOD: CÙNG đặt để (v1 bakePlacement: đứng y=0, cao 1, mặt chữ +Z) và CÙNG node transform (khung lượng tử
//   quantFrame() tính từ bản đầy đủ) — đổi LOD không xê dịch; vị trí đỉnh LOD1/LOD2 là tập con bit-exact của LOD0.
//   Nguồn đã là bản bake low-poly có normal map (1442, 1448): LOD0 = chính low-poly đó (pháp tuyến + normal map gốc,
//   chuyển KTX2 cùng thông số), LOD1/LOD2 dựng từ nó.
//
// Chạy (ưu tiên thấp, 2 bia song song, mỗi bia một tiến trình con; chạy lại = tiếp tục, bia đã xong được bỏ qua):
//   node tools/v2/build.mjs --all [--jobs=2]
//   node tools/v2/build.mjs bia-1514 bia-1554 [--force] [--force=bake,base] [--keep-work]
// Ghi đè tham số: --tris=150000 --nrm=2048 --crease=25 --base=u4096
//
// Bộ nhớ đệm: $V2_WORK_DIR hoặc ~/.cache/vanmieu-bia-3d/v2/<id>/ (mỗi bước ghi .meta.json băm tham số). Bia xong →
// dọn trung gian, chỉ giữ .meta.json + done.json (≤ vài chục KB). Log: <work>/logs/<id>.log, tổng kết logs/summary.json.
// Chặn đĩa: trước mỗi bia kiểm tra dung lượng trống; < V2_MIN_FREE_GB (mặc định 4) GB → dừng sạch (mã 3), chạy lại sau.
// KHÔNG ghi đè đầu ra v1 (public/models/*.glb, proxy/, src/data/*).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Document, NodeIO, Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, prune, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { bakePlacement, handleDuplicateGeometry, FRONT_OVERRIDE } from '../prepare-models.mjs';
import { buildProxy } from '../make-proxies.mjs';
import { collectPoints as collectPointsHead, detectHead } from '../measure-heads.mjs';
import { collectPoints as collectPointsPed, sectorRadius, FOOT_FRAC } from '../measure-pedestal.mjs';
import {
  weldPosUv, compact, simplifyTo, creaseNormals, quantFrame, quantizeVerts, tangentsAndWeld,
  attrGpuBytes, texGpuBytes, saveArrays, loadArrays,
} from './lib/geom.mjs';
import { run, encodeKtx2, BLENDER_BIN, BASISU_BIN } from './lib/proc.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SOURCES_FILE = path.join(__dirname, 'sources.json');
const OUT_DIR = path.join(ROOT, 'models-v2'); // NGOÀI public/: vite build không chép ~1,3 GB vào dist/
const WORK = process.env.V2_WORK_DIR || path.join(os.homedir(), '.cache', 'vanmieu-bia-3d', 'v2');
const BAKE_SCRIPT = path.join(__dirname, 'bake_normals.py');
const PREDECIMATE_SCRIPT = path.join(__dirname, '..', 'predecimate.py');
const MIN_FREE_GB = Number(process.env.V2_MIN_FREE_GB ?? 4);

// ---------------------------------------------------------------------------------------------------------------------
// Tham số toàn cục (chốt sau pilot phase 1 — xem báo cáo). `--all` không cờ = đúng bộ này.
// ---------------------------------------------------------------------------------------------------------------------
export const DEFAULTS = {
  tris: 150_000, // LOD0
  trisSteps: [200_000, 250_000], // nâng dần khi sai số giản lược > maxError
  maxError: 3e-4, // đơn vị mô hình (bia cao 1)
  nrm: 2048, // normal map LOD0
  crease: 25, // độ gãy pháp tuyến high-poly khi bake
  base: 'u4096', // u<size> = UASTC, e<size> = ETC1S; size bị kẹp ≤ nguồn (luỹ thừa 2)
  lod1Ratio: 0.25,
  lod1Crease: 60, // pháp tuyến đỉnh LOD1 (không normal map)
  lod1Base: 'e1024',
  uastcRdo: 1.0, // λ RDO UASTC cho base colour, -uastc_rdo_m (tất định)
  nrmRdo: 0, // normal map: không RDO
  bakeSamples: 8,
  bakeMargin: 16, // px ở 4096; tỉ lệ theo cỡ ảnh
  bakeThreads: 4,
  extrusionMin: 0.0015,
  extrusionBlender: 0.003, // LOD giản lược bằng Blender Decimate (đỉnh bị dời, không có sai số meshopt)
  seamFallback: 1.15, // meshopt dừng > 1,15× đích (đường cắt UV chặn) → Blender Decimate (như v1 bia-1463)
};
/**
 * Sửa tay mặt trước (bổ sung FRONT_OVERRIDE của v1 — cùng quy ước: -1 = mặt chữ ở −Z sau khi xoay phiến → lật 180°,
 * +1 = đã ở +Z, không lật). Soát bằng ảnh QA phase 2 (.captures/v2-front-suspects.jpg): nhìn từ +Z không thấy đầu rùa,
 * nhìn từ −Z thấy đầu rùa + mặt chữ. Heuristic sai: tương phản texture (1739 ratio 1,60; 1673 1,30) hoặc độ nhô đầu rùa.
 */
export const V2_FRONT_OVERRIDE = {
  'bia-1739': 1,
  'bia-1667': -1,
  'bia-1673': -1,
  'bia-1637': -1,
  'bia-1478': -1,
  'bia-1676': -1,
  'bia-1721': 1,
};
Object.assign(FRONT_OVERRIDE, V2_FRONT_OVERRIDE); // cùng đối tượng mà bakePlacement() của v1 đọc (không sửa tệp v1)
const PIPELINE_VERSION = 2;
const PREP_VERSION = 3;

// ---------------------------------------------------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------------------------------------------------
const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const kfmt = (n) => (n === Infinity ? 'full' : `${Math.round(n / 1000)}k`);
const mb = (b) => (b / 1e6).toFixed(2);
const freeGB = (p = ROOT) => {
  const s = fs.statfsSync(p);
  return (s.bavail * s.bsize) / 1e9;
};

let io;
async function getIO() {
  if (io) return io;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
  return io;
}

function parseArgs(argv) {
  const o = { ids: [], flags: {} };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      o.flags[k] = v === undefined ? true : v;
    } else o.ids.push(a);
  }
  return o;
}

/** Bộ nhớ đệm từng bước: chạy `fn` nếu thiếu đầu ra / băm tham số đổi / bị ép chạy lại. */
function makeStep(ctx) {
  return async function step(name, outFiles, params, fn) {
    const metaFile = `${outFiles[0]}.meta.json`;
    const h = hash(params);
    const forced = ctx.force === true || (Array.isArray(ctx.force) && ctx.force.some((f) => name.startsWith(f)));
    if (!forced && outFiles.every((f) => fs.existsSync(f)) && fs.existsSync(metaFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (meta.hash === h) {
        ctx.log(`  · ${name}: dùng lại (đệm)`);
        ctx.timings[name] = { cached: true, ms: meta.ms };
        return meta.result;
      }
    }
    const t0 = Date.now();
    ctx.log(`  ▶ ${name}`);
    const result = await fn();
    const ms = Date.now() - t0;
    fs.writeFileSync(metaFile, JSON.stringify({ hash: h, params, ms, result }, null, 1));
    ctx.timings[name] = { cached: false, ms };
    ctx.log(`  ✓ ${name} (${(ms / 1000).toFixed(1)}s)`);
    return result;
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bước 1: nguồn → đặt để v1 → lưới đầy đủ hàn theo (vị trí, UV)
// ---------------------------------------------------------------------------------------------------------------------

/** Giải hệ affine 3×4 từ 4 cặp điểm (x → y): y = A x + b. */
function solveAffine(src, dst) {
  const M = src.map((p) => [p[0], p[1], p[2], 1]);
  const rows = [];
  for (let k = 0; k < 3; k++) {
    const a = M.map((r, i) => [...r, dst[i][k]]);
    for (let c = 0; c < 4; c++) {
      let piv = c;
      for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
      [a[c], a[piv]] = [a[piv], a[c]];
      for (let r = 0; r < 4; r++) {
        if (r === c) continue;
        const f = a[r][c] / a[c][c];
        for (let j = c; j < 5; j++) a[r][j] -= f * a[c][j];
      }
    }
    rows.push(a.map((r, i) => r[4] / r[i]));
  }
  return rows; // 3 hàng × [a0 a1 a2 b]
}

async function stepPrep(ctx) {
  const { id, src, step, log } = ctx;
  const srcAbs = path.join(ctx.sourceDir, src.path);
  const st = fs.statSync(srcAbs);
  const outBin = path.join(ctx.work, 'full.bin');
  const outBase = path.join(ctx.work, 'base.src');
  const front = V2_FRONT_OVERRIDE[id] !== undefined ? { front: V2_FRONT_OVERRIDE[id] } : {};
  return step('prep', [outBin, outBase], { v: PREP_VERSION, src: src.path, size: st.size, mtime: st.mtimeMs, ...front }, async () => {
    const io = await getIO();
    const doc = await io.read(srcAbs);
    await doc.transform(dedup(), prune());
    await handleDuplicateGeometry(doc, id, log); // v1: bia-1727 có 2 mesh trùng hệt nhau
    const root = doc.getRoot();
    const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
    if (prims.length !== 1) throw new Error(`kỳ vọng 1 primitive sau dedup, có ${prims.length}`);
    const prim = prims[0];
    const mat = prim.getMaterial();
    const prebaked = !!mat?.getNormalTexture();
    await doc.transform(weld());
    // Điểm tương ứng để ghi lại ma trận đặt để (manifest / kiểm tra), lấy trước khi bake.
    const scene = root.listScenes()[0];
    let node = null;
    scene.traverse((n) => { if (n.getMesh()) node = n; });
    const posBefore = prim.getAttribute('POSITION');
    const n = posBefore.getCount();
    const W = node.getWorldMatrix();
    const pick = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
    const tmp = [0, 0, 0];
    const world = (p) => [0, 1, 2].map((k) => W[k] * p[0] + W[4 + k] * p[1] + W[8 + k] * p[2] + W[12 + k]);
    const before = pick.map((i) => world(posBefore.getElement(i, tmp).slice()));
    const lines = [];
    await bakePlacement(doc, id, (m) => {
      lines.push(m.trim());
      log(m);
    });
    const after = pick.map((i) => prim.getAttribute('POSITION').getElement(i, tmp).slice());
    const affine = solveAffine(before, after);
    const scale = Math.cbrt(Math.abs(
      affine[0][0] * (affine[1][1] * affine[2][2] - affine[1][2] * affine[2][1]) -
      affine[0][1] * (affine[1][0] * affine[2][2] - affine[1][2] * affine[2][0]) +
      affine[0][2] * (affine[1][0] * affine[2][1] - affine[1][1] * affine[2][0])));
    const frontSource = FRONT_OVERRIDE[id] !== undefined ? 'override'
      : lines.some((l) => /decisive, front/.test(l)) ? 'texture-contrast'
        : lines.some((l) => /head-protrusion|turtle protrusion/.test(l)) ? 'head-protrusion'
          : lines.some((l) => /skipping orientation/.test(l)) ? 'none (not slab-like)' : 'unknown';
    const contrast = lines.map((l) => /texture-contrast ratio=([\d.]+)/.exec(l)?.[1]).find(Boolean);

    const P = Float32Array.from(prim.getAttribute('POSITION').getArray());
    const UV = prim.getAttribute('TEXCOORD_0')?.getArray();
    if (!UV) throw new Error('nguồn thiếu TEXCOORD_0');
    const I = prim.getIndices() ? Uint32Array.from(prim.getIndices().getArray()) : Uint32Array.from({ length: P.length / 3 }, (_, i) => i);
    const tex = mat?.getBaseColorTexture();
    if (!tex) throw new Error('nguồn không có base colour texture');
    const img = Buffer.from(tex.getImage());
    fs.writeFileSync(outBase, img);
    const meta = await sharp(img).metadata();
    let arrays;
    let degenerate = 0;
    let normalMap = null;
    if (prebaked) {
      // Low-poly bake sẵn: GIỮ pháp tuyến gốc (normal map được bake theo chúng) — weld() đã gộp đỉnh giống hệt.
      arrays = { P, UV: Float32Array.from(UV), N: Float32Array.from(prim.getAttribute('NORMAL').getArray()), I };
      const nimg = Buffer.from(mat.getNormalTexture().getImage());
      fs.writeFileSync(path.join(ctx.work, 'nrm.src'), nimg);
      const nm = await sharp(nimg).metadata();
      normalMap = { mime: mat.getNormalTexture().getMimeType(), w: nm.width, h: nm.height, bytes: nimg.length };
    } else {
      const w = weldPosUv(P, Float32Array.from(UV), I);
      arrays = { P: w.P, UV: w.UV, I: w.I };
      degenerate = w.degenerate;
    }
    const result = {
      prebaked,
      sourceTris: I.length / 3,
      sourceVerts: n,
      tris: arrays.I.length / 3,
      verts: arrays.P.length / 3,
      degenerate,
      baseColor: { mime: tex.getMimeType(), w: meta.width, h: meta.height, bytes: img.length },
      ...(normalMap ? { normalMap } : {}),
      placement: {
        affine: affine.map((r) => r.map((x) => +x.toPrecision(9))),
        scale: +scale.toPrecision(9),
        frontOverride: FRONT_OVERRIDE[id] ?? null,
        frontSource,
        textureContrastRatio: contrast ? Number(contrast) : null,
        log: lines.filter((l) => /slab axis|front|texture-contrast|skipping/.test(l)),
      },
    };
    saveArrays(outBin, arrays, result);
    log(`  nguồn ${result.sourceTris} tam giác / ${n} đỉnh → ${result.verts} đỉnh${prebaked ? ' (bake sẵn, giữ pháp tuyến)' : `, bỏ ${degenerate} tam giác suy biến`}`);
    return result;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Bước 2: giản lược (meshopt; đường cắt UV chặn → Blender Decimate) → pháp tuyến → lượng tử
// ---------------------------------------------------------------------------------------------------------------------
async function writeFloatGlb(file, P, N, UV, I) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', doc.createAccessor().setBuffer(buf).setType('VEC3').setArray(P))
    .setIndices(doc.createAccessor().setBuffer(buf).setType('SCALAR').setArray(I));
  if (N) prim.setAttribute('NORMAL', doc.createAccessor().setBuffer(buf).setType('VEC3').setArray(N));
  if (UV) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setBuffer(buf).setType('VEC2').setArray(UV));
  doc.createScene().addChild(doc.createNode('m').setMesh(doc.createMesh('m').addPrimitive(prim)));
  await (await getIO()).write(file, doc);
}

/** Giản lược tới `tris`: meshopt (đỉnh là tập con bản đầy đủ); nếu đường cắt UV chặn → Blender Decimate (predecimate.py v1). */
async function decimate(ctx, full, tris) {
  const s = simplifyTo(full.P, full.I, tris);
  const got = s.I.length / 3;
  if (got <= tris * DEFAULTS.seamFallback) {
    const c = compact(full.P, full.UV, s.I);
    return { ...c, error: s.error, method: got === full.I.length / 3 ? 'none' : 'meshopt' };
  }
  ctx.log(`    meshopt dừng ở ${got} tam giác (đích ${tris}, đường cắt UV chặn) → Blender Decimate`);
  const inp = path.join(ctx.work, 'dec-in.glb');
  const out = path.join(ctx.work, `dec-${kfmt(tris)}.glb`);
  if (!fs.existsSync(inp)) await writeFloatGlb(inp, full.P, null, full.UV, full.I);
  const ratio = tris / (full.I.length / 3);
  await run(BLENDER_BIN, ['-b', '--factory-startup', '-noaudio', '-P', PREDECIMATE_SCRIPT, '--', inp, out, String(ratio)], {
    onLine: (l) => { if (/\[predecimate\]|Error/.test(l)) ctx.log(`    ${l.trim()}`); },
  });
  const doc = await (await getIO()).read(out);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = Float32Array.from(prim.getAttribute('POSITION').getArray());
  const UV = Float32Array.from(prim.getAttribute('TEXCOORD_0').getArray());
  const I = Uint32Array.from(prim.getIndices().getArray());
  fs.rmSync(out, { force: true });
  const w = weldPosUv(P, UV, I);
  return { P: w.P, UV: w.UV, I: w.I, error: NaN, method: 'blender-decimate' };
}

/** Thử đích tam giác cho LOD0 (chỉ đo sai số meshopt, không ghi): nâng dần khi > maxError. */
function chooseLod0Budget(ctx, full, base) {
  const srcTris = full.I.length / 3;
  const tried = [];
  for (const t of [base, ...DEFAULTS.trisSteps.filter((x) => x > base)]) {
    if (srcTris <= t) {
      tried.push({ tris: t, error: 0, kept: 'source' });
      return { tris: Infinity, tried, reason: `nguồn ${srcTris} ≤ ${t}: giữ nguyên` };
    }
    const s = simplifyTo(full.P, full.I, t);
    const got = s.I.length / 3;
    tried.push({ tris: t, got, error: +s.error.toExponential(3) });
    if (got > t * DEFAULTS.seamFallback) return { tris: t, tried, reason: 'meshopt bị đường cắt UV chặn → Blender Decimate, không đo được sai số' };
    if (s.error <= DEFAULTS.maxError) return { tris: t, tried, reason: t === base ? 'đạt' : `nâng lên ${t} (sai số)` };
  }
  const last = tried[tried.length - 1];
  return { tris: last.tris, tried, reason: `sai số vẫn > ${DEFAULTS.maxError} ở ${last.tris} — giữ mức cao nhất` };
}

async function stepGeo(ctx, full, frame, tris, vertexCrease, { keepNormals = false } = {}) {
  const key = `geo-t${kfmt(tris)}-c${keepNormals ? 'src' : vertexCrease}`;
  const out = path.join(ctx.work, `${key}.bin`);
  const res = await ctx.step(key, [out], { v: 5, prep: ctx.prepHash, tris: String(tris), vertexCrease, keepNormals, frame }, async () => {
    let geo;
    if (keepNormals) {
      // Low-poly bake sẵn: không giản lược, giữ pháp tuyến gốc.
      geo = { P: full.P, UV: full.UV, N: full.N, I: full.I, error: 0, method: 'none' };
    } else {
      const d = await decimate(ctx, full, tris);
      const nrm = creaseNormals(d.P, d.UV, d.I, vertexCrease);
      geo = { ...nrm, error: d.error, method: d.method };
    }
    const q = quantizeVerts(frame, geo.P, geo.N, geo.UV);
    const r = {
      tris: geo.I.length / 3, verts: geo.P.length / 3, error: Number.isNaN(geo.error) ? null : +geo.error.toExponential(3),
      method: geo.method, uvFloat: q.uvFloat, quant: 'p16-oct8-uv14',
    };
    saveArrays(out, { Pq: q.Pq, Pd: q.Pd, Nq: q.Nq, Nd: q.Nd, UVq: q.UVq, UVd: q.UVd, I: geo.I }, r);
    ctx.log(`    ${key}: ${r.tris} tam giác, ${r.verts} đỉnh, ${r.method}, sai số ${r.error ?? '—'}`);
    return r;
  });
  const a = loadArrays(out);
  return { ...a, meta: res, key };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bước 3: bake normal map (Blender, nền)
// ---------------------------------------------------------------------------------------------------------------------
async function stepHighPoly(ctx, full, crease) {
  const out = path.join(ctx.work, `hp-c${crease}.glb`);
  await ctx.step(`hp-c${crease}`, [out], { v: 1, prep: ctx.prepHash, crease }, async () => {
    const h = creaseNormals(full.P, null, full.I, crease);
    await writeFloatGlb(out, h.P, h.N, null, h.I);
    return { tris: h.I.length / 3, verts: h.P.length / 3 };
  });
  return out;
}

async function stepBake(ctx, full, geo, crease, size) {
  const hp = await stepHighPoly(ctx, full, crease);
  const lp = path.join(ctx.work, `lp-${geo.key}.glb`);
  const png = path.join(ctx.work, `nrm-${geo.key}-hc${crease}-${size}.png`);
  const extrusion = geo.meta.error === null ? DEFAULTS.extrusionBlender
    : +Math.max(DEFAULTS.extrusionMin, 3 * geo.meta.error).toPrecision(3);
  const maxRay = +(2 * extrusion).toPrecision(3);
  const margin = Math.max(4, Math.round((DEFAULTS.bakeMargin * size) / 4096));
  const params = { v: 2, prep: ctx.prepHash, geo: geo.meta, crease, size, extrusion, maxRay, samples: DEFAULTS.bakeSamples, margin };
  const r = await ctx.step(`bake-${geo.key}-hc${crease}-${size}`, [png], params, async () => {
    await writeFloatGlb(lp, geo.Pd, geo.Nd, geo.UVd, geo.I);
    const res = await run(BLENDER_BIN, ['-b', '--factory-startup', '-noaudio', '-P', BAKE_SCRIPT, '--',
      hp, lp, png, String(size), String(extrusion), String(maxRay), String(DEFAULTS.bakeSamples), String(margin), String(DEFAULTS.bakeThreads)],
    { onLine: (l) => { if (/\[bake\]|Error|error/.test(l)) ctx.log(`    ${l.trim()}`); } });
    fs.rmSync(lp, { force: true });
    const line = res.stdout.split('\n').find((l) => l.includes('[bake] done')) ?? '';
    return { extrusion, maxRay, margin, blenderMs: res.ms, line: line.trim() };
  });
  return { png, ...r };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bước 4: texture KTX2
// ---------------------------------------------------------------------------------------------------------------------
function parseTexSpec(spec, srcW) {
  const m = /^([ue])(\d+)$/.exec(spec);
  if (!m) throw new Error(`base spec sai: ${spec}`);
  const want = Number(m[2]);
  const pot = 2 ** Math.floor(Math.log2(srcW));
  return { codec: m[1] === 'u' ? 'uastc' : 'etc1s', size: Math.min(want, pot) };
}

async function stepBaseKtx(ctx, prep, spec) {
  const { codec, size } = parseTexSpec(spec, Math.min(prep.baseColor.w, prep.baseColor.h));
  const name = `base-${codec}-${size}`;
  const out = path.join(ctx.work, `${name}.ktx2`);
  const r = await ctx.step(name, [out], { v: 1, prep: ctx.prepHash, codec, size, rdo: DEFAULTS.uastcRdo }, async () => {
    const png = path.join(ctx.work, `${name}.png`);
    await sharp(path.join(ctx.work, 'base.src'), { limitInputPixels: false }).resize(size, size, { kernel: 'lanczos3', fit: 'fill' })
      .png({ compressionLevel: 1 }).toFile(png);
    let res;
    if (codec === 'uastc') {
      res = await encodeKtx2(png, out, 'color', { rdo: DEFAULTS.uastcRdo, threads: 4 });
    } else {
      res = await run(BASISU_BIN, ['-etc1s', '-q', '255', '-ktx2', '-mipmap', '-srgb', '-max_threads', '4', '-output_file', out, png]);
    }
    fs.rmSync(png, { force: true });
    return { codec, w: size, h: size, bytes: fs.statSync(out).size, ms: res.ms };
  });
  return { file: out, ...r };
}

async function stepNrmKtx(ctx, pngIn, size, name, { renorm = false, params = {} } = {}) {
  const out = path.join(ctx.work, `${name}.ktx2`);
  const r = await ctx.step(name, [out], { v: 2, ...params, size, rdo: DEFAULTS.nrmRdo, renorm }, async () => {
    const res = await encodeKtx2(pngIn, out, 'normal', { rdo: DEFAULTS.nrmRdo, threads: 4, renorm });
    return { codec: 'uastc', w: size, h: size, bytes: fs.statSync(out).size, ms: res.ms };
  });
  return { file: out, ...r };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bước 5: ghép GLB cuối
// ---------------------------------------------------------------------------------------------------------------------
async function writeLodGlb(file, frame, geo, { tangents = null, base = null, nrm = null, name }) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const Pq = tangents ? tangents.Pq : geo.Pq;
  const Nq = tangents ? tangents.Nq : geo.Nq;
  const UVq = tangents ? tangents.UVq : geo.UVq;
  const I = tangents ? tangents.I : geo.I;
  const nv = Pq.length / 3;
  const prim = doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', doc.createAccessor().setBuffer(buf).setType('VEC3').setArray(Pq).setNormalized(true))
    .setAttribute('NORMAL', doc.createAccessor().setBuffer(buf).setType('VEC3').setArray(Nq).setNormalized(true))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setBuffer(buf).setType('VEC2').setArray(UVq).setNormalized(!(UVq instanceof Float32Array)))
    .setIndices(doc.createAccessor().setBuffer(buf).setType('SCALAR').setArray(nv <= 65535 ? Uint16Array.from(I) : Uint32Array.from(I)));
  if (tangents) prim.setAttribute('TANGENT', doc.createAccessor().setBuffer(buf).setType('VEC4').setArray(tangents.Tq).setNormalized(true));
  const mat = doc.createMaterial(name).setMetallicFactor(0).setRoughnessFactor(0.92);
  const texInfo = [];
  if (base) {
    mat.setBaseColorTexture(doc.createTexture('baseColor').setImage(fs.readFileSync(base.file)).setMimeType('image/ktx2'));
    texInfo.push({ role: 'baseColor', codec: base.codec, w: base.w, h: base.h, bytes: base.bytes });
  }
  if (nrm) {
    mat.setNormalTexture(doc.createTexture('normal').setImage(fs.readFileSync(nrm.file)).setMimeType('image/ktx2'));
    texInfo.push({ role: 'normal', codec: nrm.codec, w: nrm.w, h: nrm.h, bytes: nrm.bytes });
  }
  prim.setMaterial(mat);
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim))
    .setTranslation(frame.t).setRotation(frame.r).setScale(frame.s);
  doc.getRoot().setDefaultScene(doc.createScene().addChild(node));
  if (base || nrm) doc.createExtension(KHRTextureBasisu).setRequired(true);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
  // FILTER: POSITION / TEXCOORD_0 / chỉ số giữ nguyên số nguyên của ta (filter NONE); NORMAL / TANGENT → octahedral
  // 8 bit (4 B/đỉnh) — quantizeVerts() đã làm tròn pháp tuyến đúng theo đường này trước khi bake.
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file.replace(/\.glb$/, '.part.glb'); // NodeIO chọn định dạng theo đuôi .glb
  await (await getIO()).write(tmp, doc);
  fs.renameSync(tmp, file); // ghi nguyên tử: không để lại GLB dở dang khi bị ngắt
  // GPU: vị trí Int16×3 (8 B), pháp tuyến oct→Int8×4 (4 B), UV Uint16×2 (4 B), tiếp tuyến Int8×4 (4 B), chỉ số 2/4 B.
  // Texture: 1 B/px + mip (UASTC → BC7/ASTC; ETC1S → BC7 trên desktop, ETC1/ETC2 0,5 B/px trên GPU di động/Apple).
  const gpuGeo = attrGpuBytes(nv, 2, 3) + attrGpuBytes(nv, 1, 4) + attrGpuBytes(nv, UVq.BYTES_PER_ELEMENT, 2) +
    (tangents ? attrGpuBytes(nv, 1, 4) : 0) + I.length * (nv <= 65535 ? 2 : 4);
  const gpuTex = texInfo.reduce((s, t) => s + texGpuBytes(t.w, t.h, 1), 0);
  return {
    file: path.relative(OUT_DIR, file),
    bytes: fs.statSync(file).size,
    tris: I.length / 3,
    verts: nv,
    textures: texInfo,
    gpuBytes: { geometry: gpuGeo, textures: gpuTex, total: gpuGeo + gpuTex },
  };
}

async function buildLod0(ctx, full, frame, cfg, outFile) {
  const t0 = Date.now();
  const base = await stepBaseKtx(ctx, ctx.prep, cfg.base);
  let geo;
  let nrm;
  let budget;
  let bake = null;
  if (ctx.prep.prebaked) {
    // LOD0 = chính low-poly bake sẵn; normal map gốc → 2048 (chuẩn hoá lại vectơ) → KTX2 như bản bake của ta.
    budget = { tris: Infinity, tried: [], reason: 'nguồn là low-poly bake sẵn (có normal map): giữ nguyên' };
    geo = await stepGeo(ctx, full, frame, Infinity, 0, { keepNormals: true });
    const size = Math.min(cfg.nrm, 2 ** Math.floor(Math.log2(ctx.prep.normalMap.w)));
    const png = path.join(ctx.work, `nrm-src-${size}.png`);
    if (!fs.existsSync(png)) {
      await sharp(path.join(ctx.work, 'nrm.src'), { limitInputPixels: false }).resize(size, size, { kernel: 'lanczos3', fit: 'fill' })
        .png({ compressionLevel: 1 }).toFile(png);
    }
    nrm = await stepNrmKtx(ctx, png, size, `nrm-src-${size}`, { renorm: true, params: { prep: ctx.prepHash } });
  } else {
    budget = await ctx.step('budget', [path.join(ctx.work, 'budget.json')], { v: 1, prep: ctx.prepHash, base: cfg.tris, steps: DEFAULTS.trisSteps, maxError: DEFAULTS.maxError }, async () => {
      const b = chooseLod0Budget(ctx, full, cfg.tris);
      fs.writeFileSync(path.join(ctx.work, 'budget.json'), JSON.stringify(b));
      return b;
    });
    ctx.log(`    ngân sách LOD0: ${budget.tris === Infinity ? 'giữ nguồn' : budget.tris} — ${budget.reason} · thử ${JSON.stringify(budget.tried)}`);
    geo = await stepGeo(ctx, full, frame, budget.tris, 180);
    const b = await stepBake(ctx, full, geo, cfg.crease, cfg.nrm);
    nrm = await stepNrmKtx(ctx, b.png, cfg.nrm, path.basename(b.png, '.png'), { params: { png: path.basename(b.png), bakeLine: b.line } });
    bake = { hpCrease: cfg.crease, size: cfg.nrm, extrusion: b.extrusion, maxRay: b.maxRay, margin: b.margin, samples: DEFAULTS.bakeSamples };
  }
  const tangents = tangentsAndWeld({ Pq: geo.Pq, Pd: geo.Pd, Nq: geo.Nq, Nd: geo.Nd, UVq: geo.UVq, UVd: geo.UVd }, geo.I);
  const r = await writeLodGlb(outFile, frame, geo, { tangents, base, nrm, name: ctx.id });
  r.simplify = { method: geo.meta.method, error: geo.meta.error, budget: budget.tris === Infinity ? 'source' : budget.tris, tried: budget.tried, reason: budget.reason };
  if (bake) r.bake = bake;
  r.buildMs = Date.now() - t0;
  ctx.log(`  → ${r.file}: ${mb(r.bytes)} MB, ${r.tris} tam giác, ${r.verts} đỉnh, GPU ~${mb(r.gpuBytes.total)} MB`);
  return r;
}

async function buildLod1(ctx, full, frame, lod0Tris, outFile) {
  const t0 = Date.now();
  const tris = Math.round(lod0Tris * DEFAULTS.lod1Ratio);
  const geo = await stepGeo(ctx, full, frame, tris, DEFAULTS.lod1Crease);
  const base = await stepBaseKtx(ctx, ctx.prep, DEFAULTS.lod1Base);
  const r = await writeLodGlb(outFile, frame, geo, { base, name: ctx.id });
  r.simplify = { method: geo.meta.method, error: geo.meta.error, target: tris };
  r.buildMs = Date.now() - t0;
  ctx.log(`  → ${r.file}: ${mb(r.bytes)} MB, ${r.tris} tam giác, GPU ~${mb(r.gpuBytes.total)} MB`);
  return r;
}

async function buildLod2(ctx, lod0File, outFile) {
  const t0 = Date.now();
  const io = await getIO();
  const chosen = await buildProxy(ctx.id, lod0File, outFile, io, ctx.log);
  const doc = await io.read(outFile);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const nv = prim.getAttribute('POSITION').getCount();
  const nt = prim.getIndices().getCount() / 3;
  const gpu = attrGpuBytes(nv, 2, 3) + attrGpuBytes(nv, 1, 3) + nt * 3 * (nv <= 65535 ? 2 : 4);
  return {
    file: path.relative(OUT_DIR, outFile),
    bytes: fs.statSync(outFile).size,
    tris: nt,
    verts: nv,
    textures: [],
    gpuBytes: { geometry: gpu, textures: 0, total: gpu },
    bboxDelta: +chosen.maxDelta.toFixed(4),
    buildMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bước 6: đo đầu rùa + dấu chân trên LOD0 (không ghi src/data)
// ---------------------------------------------------------------------------------------------------------------------
async function measure(file) {
  const io = await getIO();
  const doc = await io.read(file);
  const head = detectHead(collectPointsHead(doc));
  const pts = collectPointsPed(doc);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 1; i < pts.length; i += 3) {
    if (pts[i] < yMin) yMin = pts[i];
    if (pts[i] > yMax) yMax = pts[i];
  }
  const footY = yMin + FOOT_FRAC * (yMax - yMin);
  const all = sectorRadius(pts, () => true);
  const foot = sectorRadius(pts, (y) => y < footY);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return {
    head: head ? { center: head.center, radius: head.radius, neck: head.neck, auto: head } : null,
    pedestal: { swept: r4(all.robust), sweptMax: r4(all.max), sweptAzimuth: all.azimuth, base: r4(foot.robust), baseMax: r4(foot.max), vertices: pts.length / 3 },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Một bia
// ---------------------------------------------------------------------------------------------------------------------
function configOf(flags) {
  return {
    tris: Number(flags.tris ?? DEFAULTS.tris),
    nrm: Number(flags.nrm ?? DEFAULTS.nrm),
    crease: Number(flags.crease ?? DEFAULTS.crease),
    base: flags.base ?? DEFAULTS.base,
  };
}

function doneHash(id, src, st, cfg) {
  const front = V2_FRONT_OVERRIDE[id] !== undefined ? { front: V2_FRONT_OVERRIDE[id] } : {};
  return hash({ PIPELINE_VERSION, PREP_VERSION, src: src.path, size: st.size, mtime: st.mtimeMs, cfg, DEFAULTS, ...front });
}

/** Bia đã dựng xong với đúng tham số + đầu ra còn nguyên? */
function isDone(id, sources, flags) {
  const src = sources.steles[id];
  const f = path.join(WORK, id, 'done.json');
  if (!src?.path || !fs.existsSync(f)) return false;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const st = fs.statSync(path.join(sources.sourceDir, src.path));
  if (d.hash !== doneHash(id, src, st, configOf(flags))) return false;
  return Object.entries(d.outputs).every(([p, size]) => fs.existsSync(path.join(OUT_DIR, p)) && fs.statSync(path.join(OUT_DIR, p)).size === size);
}

/** Dọn trung gian của bia đã xong: chỉ giữ *.meta.json (băm tham số) + done.json. */
function pruneWork(work) {
  let freed = 0;
  for (const f of fs.readdirSync(work)) {
    if (f.endsWith('.meta.json') || f === 'done.json') continue;
    const p = path.join(work, f);
    freed += fs.statSync(p).size;
    fs.rmSync(p, { recursive: true, force: true });
  }
  return freed;
}

async function buildOne(id, flags) {
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const src = sources.steles[id];
  if (!src?.path) throw new Error(`không có trong ${path.relative(ROOT, SOURCES_FILE)}`);
  const work = path.join(WORK, id);
  await fsp.mkdir(path.join(WORK, 'logs'), { recursive: true });
  await fsp.mkdir(work, { recursive: true });
  fs.rmSync(path.join(work, 'failed.json'), { force: true });
  const logStream = fs.createWriteStream(path.join(WORK, 'logs', `${id}.log`), { flags: 'a' });
  const log = (m) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${id} ${m}`;
    logStream.write(`${line}\n`);
    console.log(line);
  };
  const force = flags.force === true ? true : typeof flags.force === 'string' ? flags.force.split(',') : false;
  const ctx = { id, src, work, log, force, timings: {}, sourceDir: sources.sourceDir };
  ctx.step = makeStep(ctx);
  const cfg = configOf(flags);
  const t0 = Date.now();
  await getIO(); // meshopt WASM sẵn sàng kể cả khi mọi bước đều lấy từ đệm
  try {
    log(`=== ${id} ← ${src.path} · ${JSON.stringify(cfg)} · trống ${freeGB().toFixed(1)} GB`);
    ctx.prep = await stepPrep(ctx);
    ctx.prepHash = hash({ v: PREP_VERSION, src: src.path, tris: ctx.prep.tris, verts: ctx.prep.verts });
    const full = loadArrays(path.join(work, 'full.bin'));
    const frame = quantFrame(full.P);
    const outDir = path.join(OUT_DIR, id);

    const lods = {};
    lods.lod0 = await buildLod0(ctx, full, frame, cfg, path.join(outDir, 'lod0.glb'));
    lods.lod1 = await buildLod1(ctx, full, frame, lods.lod0.tris, path.join(outDir, 'lod1.glb'));
    lods.lod2 = await buildLod2(ctx, path.join(outDir, 'lod0.glb'), path.join(outDir, 'lod2.glb'));

    log('  ▶ đo đầu rùa + dấu chân trên LOD0');
    const m = await measure(path.join(outDir, 'lod0.glb'));
    const bbox = {
      min: frame.bbox.min.map((x) => +x.toFixed(5)),
      max: frame.bbox.max.map((x) => +x.toFixed(5)),
      size: frame.bbox.max.map((x, k) => +(x - frame.bbox.min[k]).toFixed(5)),
    };
    const baseW = Math.min(ctx.prep.baseColor.w, ctx.prep.baseColor.h);
    const flagsOut = {
      prebaked: ctx.prep.prebaked,
      textureCapped: baseW < 4096 ? `nguồn ${ctx.prep.baseColor.w}×${ctx.prep.baseColor.h} → base ${lods.lod0.textures[0].w}` : false,
      budgetRaised: typeof lods.lod0.simplify.budget === 'number' && lods.lod0.simplify.budget > cfg.tris ? lods.lod0.simplify.budget : false,
      sourceBelowBudget: lods.lod0.simplify.budget === 'source' && !ctx.prep.prebaked,
      blenderDecimate: [lods.lod0, lods.lod1].some((l) => l.simplify.method === 'blender-decimate'),
      frontSource: ctx.prep.placement.frontSource,
      bboxOk: Math.abs(bbox.min[1]) < 1e-4 && Math.abs(bbox.size[1] - 1) < 1e-4,
    };
    const entry = {
      id,
      stt: src.stt,
      year: src.year,
      source: {
        folder: src.folder, file: src.path, bytes: src.bytes, tris: ctx.prep.sourceTris, verts: ctx.prep.sourceVerts,
        baseColor: ctx.prep.baseColor, ...(ctx.prep.normalMap ? { normalMap: ctx.prep.normalMap } : {}),
      },
      placement: ctx.prep.placement,
      node: { translation: frame.t, rotation: frame.r, scale: frame.s },
      bbox,
      config: cfg,
      flags: flagsOut,
      lods,
      measure: m,
      notes: src.notes,
      timings: { totalMs: Date.now() - t0, steps: ctx.timings },
      built: new Date().toISOString(),
    };
    await fsp.writeFile(path.join(outDir, 'stele.json'), `${JSON.stringify(entry, null, 1)}\n`);
    const st = fs.statSync(path.join(sources.sourceDir, src.path));
    const outputs = Object.fromEntries(['lod0.glb', 'lod1.glb', 'lod2.glb', 'stele.json'].map((f) => [`${id}/${f}`, fs.statSync(path.join(outDir, f)).size]));
    fs.writeFileSync(path.join(work, 'done.json'), JSON.stringify({ hash: doneHash(id, src, st, cfg), outputs, totalMs: entry.timings.totalMs, at: entry.built }));
    const freed = flags['keep-work'] ? 0 : pruneWork(work);
    log(`=== xong ${id} trong ${((Date.now() - t0) / 1000).toFixed(0)}s · dọn ${mb(freed)} MB trung gian · trống ${freeGB().toFixed(1)} GB`);
  } catch (e) {
    fs.writeFileSync(path.join(work, 'failed.json'), JSON.stringify({ error: String(e?.message ?? e).split('\n').slice(0, 6).join('\n'), at: new Date().toISOString() }));
    log(`!!! LỖI: ${e?.stack ?? e}`);
    throw e;
  } finally {
    logStream.end();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Manifest (gộp stele.json của mọi bia đã dựng)
// ---------------------------------------------------------------------------------------------------------------------
async function writeManifest() {
  const ids = (await fsp.readdir(OUT_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const steles = {};
  const heads = {};
  const pedestal = {};
  for (const id of ids) {
    const f = path.join(OUT_DIR, id, 'stele.json');
    if (!fs.existsSync(f)) continue;
    const e = JSON.parse(fs.readFileSync(f, 'utf8'));
    steles[id] = e;
    heads[id] = e.measure.head ? { center: e.measure.head.center, radius: e.measure.head.radius, neck: e.measure.head.neck, source: 'auto' } : null;
    pedestal[id] = e.measure.pedestal;
  }
  // Thumbnail (tools/v2/thumbs.mjs → thumbs/index.json) và catalog (tools/v2/catalog.mjs) — gộp nếu có.
  const thumbsFile = path.join(OUT_DIR, 'thumbs', 'index.json');
  const thumbs = fs.existsSync(thumbsFile) ? JSON.parse(fs.readFileSync(thumbsFile, 'utf8')) : null;
  if (thumbs) for (const [id, t] of Object.entries(thumbs.thumbs)) if (steles[id]) steles[id].thumb = t;
  const sum = (k) => Object.values(steles).reduce((s, e) => s + e.lods[k].bytes, 0);
  const gpu = (k) => Object.values(steles).reduce((s, e) => s + e.lods[k].gpuBytes.total, 0);
  const n = Object.keys(steles).length || 1;
  const manifest = {
    $comment: 'Sinh bởi tools/v2/build.mjs — KHÔNG sửa tay. Mỗi bia: lod0/lod1/lod2 (.glb, cùng node transform), số liệu, nguồn, đặt để, cờ.',
    version: 2,
    generated: new Date().toISOString(),
    lodContract: {
      lod0: `≤${DEFAULTS.tris / 1000}k tam giác (nâng ${DEFAULTS.trisSteps.join('/')} nếu sai số > ${DEFAULTS.maxError}), base colour KTX2 UASTC ≤4096 (≤ nguồn), normal map ${DEFAULTS.nrm} UASTC bake từ bản quét đầy đủ (gãy ${DEFAULTS.crease}°), TANGENT MikkTSpace`,
      lod1: `${DEFAULTS.lod1Ratio * 100}% tam giác LOD0, pháp tuyến gãy ${DEFAULTS.lod1Crease}°, base colour KTX2 ETC1S 1024, không normal map`,
      lod2: 'hợp đồng proxy (tools/make-proxies.mjs): ~6k tam giác, POSITION+NORMAL, không material',
      node: 'mọi LOD cùng node TRS; đỉnh LOD1/LOD2 là tập con của bản đầy đủ (trừ bia giản lược bằng Blender Decimate)',
      gpuBytes: 'ước lượng: texture 1 B/px + mip (UASTC→BC7/ASTC; ETC1S→BC7 desktop, 0,5 B/px ETC trên Apple/di động); đỉnh theo kiểu lượng tử, căn 4 B',
    },
    totals: {
      steles: Object.keys(steles).length,
      bytes: { lod0: sum('lod0'), lod1: sum('lod1'), lod2: sum('lod2') },
      gpuBytes: { lod0: gpu('lod0'), lod1: gpu('lod1'), lod2: gpu('lod2') },
      startupDownloadBytes_LOD1all_LOD2all_LOD0x5: Math.round(sum('lod1') + sum('lod2') + (5 * sum('lod0')) / n),
      vramBytes_LOD1all_LOD2all_LOD0x5: Math.round(gpu('lod1') + gpu('lod2') + (5 * gpu('lod0')) / n),
      ...(thumbs ? { thumbBytes: thumbs.totalBytes } : {}),
    },
    ...(thumbs ? { thumbs: { camera: thumbs.camera, big: '800×1000 webp', small: '240×300 webp', note: thumbs.$comment } } : {}),
    steles,
  };
  await fsp.writeFile(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const maxOf = (k) => r4(Math.max(0, ...Object.values(pedestal).map((p) => p[k])));
  await fsp.writeFile(path.join(OUT_DIR, 'heads.generated.json'), `${JSON.stringify({ $comment: 'Đo trên LOD0 v2 (tools/v2/build.mjs → tools/measure-heads.mjs detectHead).', steles: heads }, null, 1)}\n`);
  await fsp.writeFile(path.join(OUT_DIR, 'pedestal.generated.json'), `${JSON.stringify({ $comment: 'Đo trên LOD0 v2 (tools/v2/build.mjs → tools/measure-pedestal.mjs sectorRadius).', max: { swept: maxOf('swept'), base: maxOf('base') }, steles: pedestal }, null, 1)}\n`);
  console.log(`→ ${path.relative(ROOT, path.join(OUT_DIR, 'manifest.json'))} (${Object.keys(steles).length} bia)`);
}

// ---------------------------------------------------------------------------------------------------------------------
// CLI: nhiều bia → tiến trình con song song (nice), chặn đĩa, tổng kết; một bia → chạy tại chỗ
// ---------------------------------------------------------------------------------------------------------------------
async function main() {
  const { ids: argIds, flags } = parseArgs(process.argv.slice(2));
  await fsp.mkdir(OUT_DIR, { recursive: true });
  if (flags.manifest) return writeManifest();
  if (flags.worker) {
    if (freeGB() < MIN_FREE_GB) {
      console.error(`[${argIds[0]}] dừng: chỉ còn ${freeGB().toFixed(1)} GB trống (< ${MIN_FREE_GB} GB)`);
      process.exit(3);
    }
    await buildOne(argIds[0], flags);
    return;
  }
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const ids = flags.all ? Object.keys(sources.steles).sort((a, b) => sources.steles[a].stt - sources.steles[b].stt) : argIds;
  if (!ids.length) throw new Error('Cần id bia (vd bia-1554) hoặc --all');
  const jobs = Math.max(1, Math.min(3, Number(flags.jobs ?? 2)));
  const pass = process.argv.slice(2).filter((a) => a.startsWith('--') && !a.startsWith('--jobs') && a !== '--all');
  const t0 = Date.now();
  const summary = { started: new Date().toISOString(), ok: [], skipped: [], failed: {}, notRun: [], stoppedForDisk: false };
  const queue = ids.filter((id) => {
    if (flags.force || !isDone(id, sources, flags)) return true;
    summary.skipped.push(id);
    return false;
  });
  if (summary.skipped.length) console.log(`bỏ qua ${summary.skipped.length} bia đã xong: ${summary.skipped.join(' ')}`);
  await fsp.mkdir(path.join(WORK, 'logs'), { recursive: true });
  const worker = async () => {
    while (queue.length) {
      if (summary.stoppedForDisk) return;
      if (freeGB() < MIN_FREE_GB) {
        summary.stoppedForDisk = true;
        console.error(`!!! dừng: chỉ còn ${freeGB().toFixed(1)} GB trống (< ${MIN_FREE_GB} GB). Giải phóng đĩa rồi chạy lại lệnh cũ để tiếp tục.`);
        return;
      }
      const id = queue.shift();
      const code = await new Promise((resolve) => {
        const c = spawn('nice', ['-n', '10', process.execPath, '--max-old-space-size=8192', fileURLToPath(import.meta.url), id, '--worker', ...pass], { stdio: 'inherit' });
        c.on('close', resolve);
      });
      if (code === 0) summary.ok.push(id);
      else if (code === 3) {
        summary.stoppedForDisk = true;
        queue.unshift(id);
      } else {
        const f = path.join(WORK, id, 'failed.json');
        summary.failed[id] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).error : `mã thoát ${code}`;
      }
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  summary.notRun = queue;
  summary.totalMs = Date.now() - t0;
  summary.finished = new Date().toISOString();
  summary.freeGB = +freeGB().toFixed(2);
  fs.writeFileSync(path.join(WORK, 'logs', 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(`\n=== tổng kết: ${summary.ok.length} xong, ${summary.skipped.length} bỏ qua (đã xong), ${Object.keys(summary.failed).length} lỗi, ${summary.notRun.length} chưa chạy · ${(summary.totalMs / 60000).toFixed(1)} phút · trống ${summary.freeGB} GB`);
  for (const [id, e] of Object.entries(summary.failed)) console.log(`  ✗ ${id}: ${e.split('\n')[0]}`);
  await writeManifest();
  if (summary.stoppedForDisk) process.exit(3);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
