#!/usr/bin/env node
// Pháp tuyến MƯỢT cho GLB đã tối ưu (bước cuối của tools/prepare-models.mjs; chạy riêng được trên public/models).
//
// Vì sao: bản quét nguồn (8/10 bia mẫu) mang pháp tuyến PHẲNG theo từng mặt — mỗi tam giác ba đỉnh riêng (≈ 2,8 đỉnh /
// tam giác), pháp tuyến = pháp tuyến mặt. weld() của gltf-transform chỉ gộp đỉnh giống hệt nhau nên không gộp được,
// simplify() chạy trên hình học tách ấy → GLB đầu ra vẫn phẳng. Dưới ánh sáng xiên, mặt đá thô thành "giấy vò" (khảm
// tam giác), chỗ đầu rùa đã xoa bóng lộ vệt tam giác (r13: bia-1514 mặt hông trái).
//
// Làm gì (hình học GIỮ NGUYÊN từng bit — vị trí, UV, tam giác, texture không đổi):
//   1. Giải nén meshopt; đọc thẳng số nguyên lượng tử hoá (KHR_mesh_quantization) — không lượng tử hoá lại.
//   2. Hàn theo VỊ TRÍ (bỏ qua đường cắt UV / màu), pháp tuyến mặt có trọng số diện tích; mỗi đỉnh cộng các mặt quanh
//      vị trí đó lệch ≤ CREASE_DEG so với mặt của chính nó (cạnh gãy thật — góc bia, gờ, thành rãnh sâu — giữ nguyên).
//   3. Lượng tử pháp tuyến như quantize() (10 bit trong Int16), rồi HÀN (vị trí, UV, pháp tuyến) giống hệt → bớt đỉnh.
//   4. Nén lại meshopt như prepare-models (reorder + EXT_meshopt_compression, kiểu 'medium') nhưng KHÔNG lượng tử lại.
//      Ảnh WebP không đụng tới.
// Đánh dấu vào extras của gốc tài liệu (vmSmoothNormals) → chạy lại sẽ bỏ qua (trừ --force).
//
// Chọn CREASE_DEG = 25° (r14): 20° còn vài vảy tam giác ở mép mặt hông bia-1514; 30° không mượt hơn mà gờ diềm / nét
// chữ khắc nông của bia-1554 nhoè thêm. Bỏ qua: bia-1442 (low-poly bake + normal map), bia-1463 (qua Blender decimate,
// pháp tuyến đã mượt).
//
// Chạy:  node tools/smooth-normals.mjs                 (mọi .glb trong public/models, trừ SKIP)
//        node tools/smooth-normals.mjs bia-1514 --crease=25 --force
//        node tools/smooth-normals.mjs --dry           (chỉ in số liệu, không ghi)

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');

export const CREASE_DEG = 25;
/** Bia không xử lý (đã có pháp tuyến mượt / normal map). */
export const SKIP = new Set(['bia-1442', 'bia-1463']);
const MARK = 'vmSmoothNormals';
const VERSION = 1;

/** Lượng tử một giá trị [-1, 1] thành Int16 chuẩn hoá 10 bit — y hệt quantizeAttribute() của gltf-transform. */
const QN_BITS = 10;
function quantNormal(v) {
  const quantBits = QN_BITS - 1;
  const storageBits = 15;
  const scale = 2 ** quantBits - 1;
  const lo = storageBits - quantBits;
  const hi = 2 * quantBits - storageBits;
  const c = Math.max(-1, Math.min(1, v));
  const q = Math.round(Math.abs(c) * scale);
  return ((q << lo) | (q >> hi)) * Math.sign(c);
}

/**
 * Pháp tuyến mượt + hàn đỉnh cho MỘT primitive (tại chỗ). Vị trí phải là số nguyên lượng tử (hoặc float) — khoá hàn
 * lấy thẳng từ mảng gốc nên không có sai số làm tròn.
 * @returns {{ vertsBefore:number, vertsAfter:number, tris:number, positions:number }}
 */
export function smoothPrimitive(prim, { creaseDeg = CREASE_DEG } = {}) {
  const pos = prim.getAttribute('POSITION');
  const nor = prim.getAttribute('NORMAL');
  const idxAcc = prim.getIndices();
  if (!pos || !nor || !idxAcc) throw new Error('primitive thiếu POSITION / NORMAL / indices');
  const n = pos.getCount();
  const P = pos.getArray();
  const pScale = pos.getNormalized() ? (P instanceof Int16Array ? 1 / 32767 : P instanceof Int8Array ? 1 / 127 : 1) : 1;
  const I = idxAcc.getArray();
  const tris = I.length / 3;
  // 1. hàn theo vị trí (khoá = bộ ba số nguyên / float gốc, chính xác tuyệt đối)
  const map = new Map();
  const wid = new Int32Array(n);
  let W = 0;
  for (let i = 0; i < n; i++) {
    const key = `${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`;
    let w = map.get(key);
    if (w === undefined) {
      w = W++;
      map.set(key, w);
    }
    wid[i] = w;
  }
  // 2. pháp tuyến mặt (trọng số diện tích) + danh sách mặt quanh mỗi vị trí (CSR) + mặt "của" mỗi đỉnh
  const fn = new Float64Array(tris * 3);
  const cnt = new Int32Array(W + 1);
  const ownFace = new Int32Array(n).fill(-1);
  for (let f = 0; f < tris; f++) {
    const a = I[f * 3];
    const b = I[f * 3 + 1];
    const c = I[f * 3 + 2];
    const ax = P[a * 3] * pScale, ay = P[a * 3 + 1] * pScale, az = P[a * 3 + 2] * pScale;
    const e1x = P[b * 3] * pScale - ax, e1y = P[b * 3 + 1] * pScale - ay, e1z = P[b * 3 + 2] * pScale - az;
    const e2x = P[c * 3] * pScale - ax, e2y = P[c * 3 + 1] * pScale - ay, e2z = P[c * 3 + 2] * pScale - az;
    fn[f * 3] = e1y * e2z - e1z * e2y;
    fn[f * 3 + 1] = e1z * e2x - e1x * e2z;
    fn[f * 3 + 2] = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      cnt[wid[v] + 1]++;
      if (ownFace[v] < 0) ownFace[v] = f;
    }
  }
  for (let w = 0; w < W; w++) cnt[w + 1] += cnt[w];
  const adj = new Int32Array(cnt[W]);
  const fill = cnt.slice(0, W);
  for (let f = 0; f < tris; f++) for (let k = 0; k < 3; k++) adj[fill[wid[I[f * 3 + k]]]++] = f;
  const cosT = Math.cos((creaseDeg * Math.PI) / 180);
  const len = (x, y, z) => Math.hypot(x, y, z) || 1;
  const N = nor.getArray();
  const nNew = new (N.constructor === Float32Array ? Float32Array : Int16Array)(n * 3);
  for (let v = 0; v < n; v++) {
    const f0 = ownFace[v];
    if (f0 < 0) {
      // đỉnh không thuộc tam giác nào: giữ nguyên
      nNew[v * 3] = N[v * 3];
      nNew[v * 3 + 1] = N[v * 3 + 1];
      nNew[v * 3 + 2] = N[v * 3 + 2];
      continue;
    }
    const l0 = len(fn[f0 * 3], fn[f0 * 3 + 1], fn[f0 * 3 + 2]);
    const rx = fn[f0 * 3] / l0, ry = fn[f0 * 3 + 1] / l0, rz = fn[f0 * 3 + 2] / l0;
    let sx = 0, sy = 0, sz = 0;
    const w = wid[v];
    for (let j = cnt[w]; j < cnt[w + 1]; j++) {
      const f = adj[j];
      const fx = fn[f * 3], fy = fn[f * 3 + 1], fz = fn[f * 3 + 2];
      if ((fx * rx + fy * ry + fz * rz) / len(fx, fy, fz) < cosT) continue; // cạnh gãy thật: không trộn qua
      sx += fx;
      sy += fy;
      sz += fz;
    }
    const l = len(sx, sy, sz);
    if (nNew instanceof Float32Array) {
      nNew[v * 3] = sx / l;
      nNew[v * 3 + 1] = sy / l;
      nNew[v * 3 + 2] = sz / l;
    } else {
      nNew[v * 3] = quantNormal(sx / l);
      nNew[v * 3 + 1] = quantNormal(sy / l);
      nNew[v * 3 + 2] = quantNormal(sz / l);
    }
  }
  nor.setArray(nNew).setNormalized(!(nNew instanceof Float32Array));
  // 3. hàn (mọi thuộc tính giống hệt nhau) → chỉ số mới
  const sems = prim.listSemantics();
  const arrs = sems.map((s) => prim.getAttribute(s).getArray());
  const sizes = sems.map((s) => prim.getAttribute(s).getElementSize());
  const keyMap = new Map();
  const remap = new Int32Array(n);
  const keep = [];
  for (let v = 0; v < n; v++) {
    let key = '';
    for (let a = 0; a < arrs.length; a++) {
      const A = arrs[a];
      const s = sizes[a];
      for (let k = 0; k < s; k++) key += `${A[v * s + k]},`;
      key += '|';
    }
    let u = keyMap.get(key);
    if (u === undefined) {
      u = keep.length;
      keyMap.set(key, u);
      keep.push(v);
    }
    remap[v] = u;
  }
  const m = keep.length;
  for (let a = 0; a < sems.length; a++) {
    const acc = prim.getAttribute(sems[a]);
    const A = arrs[a];
    const s = sizes[a];
    const B = new A.constructor(m * s);
    for (let u = 0; u < m; u++) for (let k = 0; k < s; k++) B[u * s + k] = A[keep[u] * s + k];
    acc.setArray(B);
  }
  const J = new Uint32Array(I.length);
  for (let k = 0; k < I.length; k++) J[k] = remap[I[k]];
  idxAcc.setArray(m <= 65535 ? new Uint16Array(J) : J);
  return { vertsBefore: n, vertsAfter: m, tris, positions: W };
}

let ioPromise = null;
async function getIO() {
  ioPromise ??= (async () => {
    await MeshoptDecoder.ready;
    await MeshoptEncoder.ready;
    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
  })();
  return ioPromise;
}

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);

/**
 * Xử lý một tệp GLB (đọc → pháp tuyến mượt + hàn → nén meshopt → ghi đè / ghi ra `out`).
 * @returns số liệu, hoặc { skipped } nếu đã xử lý / trong SKIP.
 */
export async function smoothGlbFile(file, { creaseDeg = CREASE_DEG, force = false, dry = false, out = file, log = console.log } = {}) {
  const id = path.basename(file, '.glb');
  if (SKIP.has(id) && !force) return { id, skipped: 'SKIP' };
  const io = await getIO();
  const bytesBefore = fs.statSync(file).size;
  const doc = await io.read(file);
  const root = doc.getRoot();
  const extras = root.getExtras() ?? {};
  if (extras[MARK] && !force) return { id, skipped: `đã có ${MARK}` };
  const texBefore = root.listTextures().map((t) => sha(t.getImage()));
  const stats = [];
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) stats.push(smoothPrimitive(prim, { creaseDeg }));
  }
  root.setExtras({ ...extras, [MARK]: { version: VERSION, creaseDeg } });
  // như meshopt({ level: 'medium' }) của prepare-models NHƯNG không gọi lại quantize(): vị trí / UV đã là số nguyên lượng
  // tử của lần tối ưu trước — lượng tử lại (khối bao mới) có thể lệch 1 bước → vết xoa đã lưu (toạ độ mô hình) lệch theo.
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const texAfter = root.listTextures().map((t) => sha(t.getImage()));
  const r = {
    id,
    creaseDeg,
    vertsBefore: stats.reduce((s, x) => s + x.vertsBefore, 0),
    vertsAfter: stats.reduce((s, x) => s + x.vertsAfter, 0),
    tris: stats.reduce((s, x) => s + x.tris, 0),
    bytesBefore,
    texturesIdentical: texBefore.join() === texAfter.join(),
  };
  if (!dry) {
    await io.write(out, doc);
    r.bytesAfter = fs.statSync(out).size;
  }
  log?.(
    `${id.padEnd(9)} gãy ${creaseDeg}° · đỉnh ${r.vertsBefore} → ${r.vertsAfter} (${(r.vertsBefore / r.vertsAfter).toFixed(2)}×)` +
      ` · tam giác ${r.tris} · ${(bytesBefore / 1e6).toFixed(2)} → ${r.bytesAfter ? (r.bytesAfter / 1e6).toFixed(2) : '—'} MB` +
      ` · texture ${r.texturesIdentical ? 'giữ nguyên' : 'KHÁC!'}`,
  );
  return r;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  const crease = Number(flag('crease')?.split('=')[1] ?? CREASE_DEG);
  const force = !!flag('force');
  const dry = !!flag('dry');
  const ids = args.filter((a) => !a.startsWith('--'));
  const files = ids.length
    ? ids.map((id) => path.join(MODELS_DIR, `${id.replace(/\.glb$/, '')}.glb`))
    : (await fsp.readdir(MODELS_DIR)).filter((f) => f.endsWith('.glb')).sort().map((f) => path.join(MODELS_DIR, f));
  for (const f of files) {
    const r = await smoothGlbFile(f, { creaseDeg: crease, force, dry });
    if (r.skipped) console.log(`${r.id.padEnd(9)} bỏ qua (${r.skipped})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
