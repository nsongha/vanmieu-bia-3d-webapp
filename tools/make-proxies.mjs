#!/usr/bin/env node
// Proxy siêu nhẹ cho mỗi bia (placeholder khi lướt nhanh hơn tốc độ tải public/models/<id>.glb;
// nền cho LOD2 sau này). Đọc GLB gốc (đã quantize + meshopt-nén sẵn, xem tools/prepare-models.mjs),
// tự tay dựng một mesh vài nghìn tam giác — CHỈ vị trí + pháp tuyến, không UV/texture/material —
// rồi tự tay lượng tử hoá + nén meshopt lại, giữ transform node y hệt bản gốc.
//
// Vì sao KHÔNG dùng weld()/simplify()-qua-quantize()/meshopt() sẵn của gltf-transform cho toàn bộ
// pipeline: POSITION nguồn đã là Int16 normalized (không gian node-local, KHÔNG phải [0,1] World-Box
// mà quantize() của gltf-transform giả định) — gọi quantize()/meshopt() sẽ tính lại bounding box và
// BÙ vào ma trận node (node transform đổi khác gốc) → toạ độ thế giới proxy lệch bia thật. Ta tự dựng
// tài liệu glTF từ đầu, TRS node copy y nguyên từ gốc, tự lượng tử hoá POSITION/NORMAL trong CÙNG
// không gian [-1,1] mà gốc dùng, rồi chỉ dùng reorder() + EXT_meshopt_compression(method: QUANTIZE)
// để nén (không đụng tới giá trị số, chỉ sắp xếp lại đỉnh + mã hoá meshopt không mất dữ liệu thêm).
// simplify()/reorder() của gltf-transform thì dùng bình thường — chúng không đụng node transform.
//
// Các bước, mỗi bia:
//   1. Đọc GLB gốc: 1 scene / 1 node / 1 mesh / 1 primitive, POSITION Int16 normalized, indices.
//   2. Bỏ UV + NORMAL gốc, WELD theo đúng giá trị Int16 (không sai số) — gộp hết đỉnh tách theo UV/
//      pháp tuyến thành một lưới liền mạch, để MeshoptSimplifier có chỗ mà giản lược (xem
//      tools/smooth-normals.mjs, cùng kỹ thuật hàn theo khoá nguyên).
//   3. MeshoptSimplifier.simplify() giản lược tới ~TARGET_TRIS tam giác (ngưỡng lỗi nới lỏng — proxy
//      chỉ cần giữ HÌNH BÓNG, không cần chi tiết mặt đá); compactMesh() dọn đỉnh không dùng.
//   4. Tính lại pháp tuyến MƯỢT TOÀN BỘ (trung bình theo diện tích, không ngưỡng gãy — proxy là khối
//      đất sét mờ, không cần giữ cạnh sắc).
//   5. Lượng tử hoá thủ công: POSITION → Int16 normalized (round(clamp(p,-1,1)*32767)), NORMAL →
//      Int8 normalized (round(clamp(n,-1,1)*127)), cùng công thức dequant/quant chuẩn glTF.
//   6. Kiểm sai lệch bbox thế giới so với gốc; nếu > 0.5% chiều cao thì thử LockBorder rồi tăng dần
//      số tam giác (trong khoảng 3000–8000) — xem LADDER bên dưới.
//   7. Dựng tài liệu glTF mới, ghi bằng reorder() + EXT_meshopt_compression + KHR_mesh_quantization.
//
// Chạy:  node tools/make-proxies.mjs                  (mọi public/models/*.glb, không đệ quy proxy/)
//        node tools/make-proxies.mjs bia-1727 bia-1661
//        node tools/make-proxies.mjs --force           (bỏ qua kiểm tra mtime, dựng lại hết)

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Accessor, Document, NodeIO, Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');
const PROXY_DIR = path.join(MODELS_DIR, 'proxy');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'proxies.generated.json');

/** Đích số tam giác proxy; khoảng chấp nhận (spec: 3000–8000, đích ~6000). */
export const TARGET_TRIS = 6000;
export const MIN_TRIS = 3000;
export const MAX_TRIS = 8000;
/** Sai lệch bbox thế giới tối đa cho phép ở mỗi mặt, tính theo đơn vị thế giới (mô hình cao 1 đơn vị). */
export const BBOX_TOL = 0.005;
/** Kích thước file mục tiêu (chỉ để báo cáo, không ép buộc dựng lại). */
const TARGET_BYTES = [20_000, 120_000];

// Thang leo thang khi bboxDelta vượt ngưỡng: thử khoá biên trước (giữ hình bao ngoài không co lại ở
// mép hở, vd đáy bệ), rồi mới tăng dần số tam giác trong khoảng cho phép. Dừng ở nấc đầu tiên đạt.
const LADDER = [
  { tri: TARGET_TRIS, lock: false },
  { tri: TARGET_TRIS, lock: true },
  { tri: 7000, lock: true },
  { tri: MAX_TRIS, lock: true },
];

// -----------------------------------------------------------------------------
// Lượng tử hoá / dequant chuẩn glTF cho số nguyên có dấu chuẩn hoá (KHR normalized integer).
// -----------------------------------------------------------------------------

/** Int16 normalized -> float [-1,1] (công thức glTF §Data Alignment, signed short). */
export function dequantInt16(c) {
  return Math.max(c / 32767, -1);
}
/** float [-1,1] -> Int16 normalized. */
export function quantInt16(f) {
  const c = Math.max(-1, Math.min(1, f));
  return Math.round(c * 32767);
}
/** float [-1,1] -> Int8 normalized. */
export function quantInt8(f) {
  const c = Math.max(-1, Math.min(1, f));
  return Math.round(c * 127);
}

// -----------------------------------------------------------------------------
// Toán tối thiểu cho TRS node (glTF: world = T * R * S * local; không dùng ma trận đầy đủ vì ta chỉ
// cần biến đổi 8 góc bbox, đủ chính xác và không kéo thêm phụ thuộc gl-matrix/three vào tool này).
// -----------------------------------------------------------------------------

/** p' = T + R*(S*p), quaternion r = [x,y,z,w] (công thức xoay vector chuẩn: t=2·(q.xyz × v), v'=v+q.w·t+(q.xyz × t)). */
export function applyTRS([tx, ty, tz], [qx, qy, qz, qw], [sx, sy, sz], [px, py, pz]) {
  const x = px * sx, y = py * sy, z = pz * sz;
  const cx1 = qy * z - qz * y, cy1 = qz * x - qx * z, cz1 = qx * y - qy * x;
  const tvx = 2 * cx1, tvy = 2 * cy1, tvz = 2 * cz1;
  const cx2 = qy * tvz - qz * tvy, cy2 = qz * tvx - qx * tvz, cz2 = qx * tvy - qy * tvx;
  return [x + qw * tvx + cx2 + tx, y + qw * tvy + cy2 + ty, z + qw * tvz + cz2 + tz];
}

/** Bbox local (khoá Int16 thô, mọi đỉnh) -> float [-1,1]. */
function localBBoxFromInt16(P, count) {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = dequantInt16(P[i * 3]), y = dequantInt16(P[i * 3 + 1]), z = dequantInt16(P[i * 3 + 2]);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** Bbox local -> bbox thế giới (biến đổi 8 góc, đúng cả khi có xoay). */
function worldBBoxFromLocal(trs, local) {
  const [minX, minY, minZ] = local.min;
  const [maxX, maxY, maxZ] = local.max;
  const corners = [
    [minX, minY, minZ], [maxX, minY, minZ], [minX, maxY, minZ], [minX, minY, maxZ],
    [maxX, maxY, minZ], [maxX, minY, maxZ], [minX, maxY, maxZ], [maxX, maxY, maxZ],
  ];
  let wMinX = Infinity, wMinY = Infinity, wMinZ = Infinity, wMaxX = -Infinity, wMaxY = -Infinity, wMaxZ = -Infinity;
  for (const c of corners) {
    const [x, y, z] = applyTRS(trs.t, trs.r, trs.s, c);
    if (x < wMinX) wMinX = x; if (x > wMaxX) wMaxX = x;
    if (y < wMinY) wMinY = y; if (y > wMaxY) wMaxY = y;
    if (z < wMinZ) wMinZ = z; if (z > wMaxZ) wMaxZ = z;
  }
  return { min: [wMinX, wMinY, wMinZ], max: [wMaxX, wMaxY, wMaxZ] };
}

/** Sai lệch lớn nhất trong 6 mặt bbox thế giới. */
function maxFaceDelta(a, b) {
  return Math.max(
    Math.abs(a.min[0] - b.min[0]), Math.abs(a.max[0] - b.max[0]),
    Math.abs(a.min[1] - b.min[1]), Math.abs(a.max[1] - b.max[1]),
    Math.abs(a.min[2] - b.min[2]), Math.abs(a.max[2] - b.max[2]),
  );
}

const round4 = (x) => Math.round(x * 10000) / 10000;

// -----------------------------------------------------------------------------
// Hàn theo vị trí (bỏ UV + NORMAL gốc) + pháp tuyến mượt toàn bộ trên lưới đã giản lược.
// -----------------------------------------------------------------------------

/** Hàn theo đúng khoá Int16 (không sai số) — bỏ UV/NORMAL, chỉ giữ vị trí duy nhất + chỉ số hợp lệ. */
function weldPositionOnly(P, srcCount, indices) {
  const map = new Map();
  const remap = new Int32Array(srcCount);
  const firstOcc = [];
  let w = 0;
  for (let i = 0; i < srcCount; i++) {
    const key = `${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`;
    let id = map.get(key);
    if (id === undefined) {
      id = w++;
      map.set(key, id);
      firstOcc.push(i);
    }
    remap[i] = id;
  }
  const positions = new Float32Array(w * 3);
  for (let u = 0; u < w; u++) {
    const i = firstOcc[u];
    positions[u * 3] = dequantInt16(P[i * 3]);
    positions[u * 3 + 1] = dequantInt16(P[i * 3 + 1]);
    positions[u * 3 + 2] = dequantInt16(P[i * 3 + 2]);
  }
  // remap chỉ số + bỏ tam giác suy biến (ba đỉnh trùng nhau sau khi hàn)
  const tmp = new Uint32Array(indices.length);
  let k = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]], b = remap[indices[t + 1]], c = remap[indices[t + 2]];
    if (a === b || b === c || a === c) continue;
    tmp[k++] = a; tmp[k++] = b; tmp[k++] = c;
  }
  return { positions, indices: tmp.slice(0, k), vertexCount: w };
}

/** Pháp tuyến mượt toàn bộ (trung bình theo diện tích, không ngưỡng gãy — proxy là khối mờ). */
function computeSmoothNormals(positions, indices, vertexCount) {
  const triCount = indices.length / 3;
  const acc = new Float64Array(vertexCount * 3);
  for (let f = 0; f < triCount; f++) {
    const a = indices[f * 3], b = indices[f * 3 + 1], c = indices[f * 3 + 2];
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
    const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    acc[a * 3] += nx; acc[a * 3 + 1] += ny; acc[a * 3 + 2] += nz;
    acc[b * 3] += nx; acc[b * 3 + 1] += ny; acc[b * 3 + 2] += nz;
    acc[c * 3] += nx; acc[c * 3 + 1] += ny; acc[c * 3 + 2] += nz;
  }
  const out = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    const x = acc[v * 3], y = acc[v * 3 + 1], z = acc[v * 3 + 2];
    const len = Math.hypot(x, y, z);
    if (len < 1e-20) { out[v * 3 + 1] = 1; continue; } // không nên xảy ra: đỉnh đã compact luôn thuộc ≥1 tam giác
    out[v * 3] = x / len; out[v * 3 + 1] = y / len; out[v * 3 + 2] = z / len;
  }
  return out;
}

/** Một nấc thử: simplify -> compact -> pháp tuyến mượt -> lượng tử hoá. */
function trySimplify(weldedPositions, weldedIndices, { tri, lock }) {
  const targetIndexCount = Math.min(tri * 3, weldedIndices.length);
  const flags = lock ? ['LockBorder'] : [];
  // target_error nới lỏng (gần như không giới hạn): proxy chỉ cần giữ hình bóng, không cần bám sát
  // bề mặt tới ngưỡng lỗi nhỏ — để target_index_count (số tam giác) là ràng buộc chính.
  const [outRaw] = MeshoptSimplifier.simplify(weldedIndices, weldedPositions, 3, targetIndexCount, 1, flags);
  const outIdx = outRaw.slice(); // compactMesh sửa tại chỗ — làm việc trên bản sao
  const [remap, uniqueCount] = MeshoptSimplifier.compactMesh(outIdx);
  const positions = new Float32Array(uniqueCount * 3);
  for (let v = 0; v < remap.length; v++) {
    const nv = remap[v];
    if (nv >= uniqueCount) continue; // đỉnh gốc không còn được tham chiếu
    positions[nv * 3] = weldedPositions[v * 3];
    positions[nv * 3 + 1] = weldedPositions[v * 3 + 1];
    positions[nv * 3 + 2] = weldedPositions[v * 3 + 2];
  }
  const normals = computeSmoothNormals(positions, outIdx, uniqueCount);
  const posInt16 = new Int16Array(uniqueCount * 3);
  const norInt8 = new Int8Array(uniqueCount * 3);
  for (let i = 0; i < uniqueCount * 3; i++) {
    posInt16[i] = quantInt16(positions[i]);
    norInt8[i] = quantInt8(normals[i]);
  }
  return { posInt16, norInt8, indices: outIdx, vertexCount: uniqueCount, triCount: outIdx.length / 3 };
}

// -----------------------------------------------------------------------------
// IO dùng chung (đọc gốc + ghi proxy đều cần decoder/encoder meshopt).
// -----------------------------------------------------------------------------

let ioPromise = null;
async function getIO() {
  ioPromise ??= (async () => {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
  })();
  return ioPromise;
}

/** Đọc + kiểm hình dạng bắt buộc của GLB gốc (1 scene/1 node/1 mesh/1 primitive TRIANGLES, POSITION Int16). */
async function readSourceGeom(srcPath, id, io) {
  const doc = await io.read(srcPath);
  const root = doc.getRoot();
  const scenes = root.listScenes();
  if (scenes.length !== 1) throw new Error(`[${id}] kỳ vọng đúng 1 scene, có ${scenes.length}`);
  const children = scenes[0].listChildren();
  if (children.length !== 1) throw new Error(`[${id}] kỳ vọng đúng 1 node gốc trong scene, có ${children.length}`);
  const node = children[0];
  if (node.listChildren().length !== 0) throw new Error(`[${id}] node gốc không được có node con`);
  const mesh = node.getMesh();
  if (!mesh) throw new Error(`[${id}] node gốc không có mesh`);
  const prims = mesh.listPrimitives();
  if (prims.length !== 1) throw new Error(`[${id}] kỳ vọng đúng 1 primitive, có ${prims.length}`);
  const prim = prims[0];
  if (prim.getMode() !== Primitive.Mode.TRIANGLES) throw new Error(`[${id}] primitive không phải TRIANGLES`);
  const pos = prim.getAttribute('POSITION');
  const idxAcc = prim.getIndices();
  if (!pos || !prim.getAttribute('NORMAL') || !idxAcc) throw new Error(`[${id}] thiếu POSITION/NORMAL/indices`);
  if (pos.getComponentType() !== Accessor.ComponentType.SHORT || !pos.getNormalized()) {
    throw new Error(`[${id}] POSITION nguồn không phải Int16 normalized`);
  }
  const trs = { t: [...node.getTranslation()], r: [...node.getRotation()], s: [...node.getScale()] };
  const P = pos.getArray();
  const indices = idxAcc.getArray();
  const indicesU32 = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  return { name: node.getName() || id, trs, P, vertexCount: pos.getCount(), indices: indicesU32 };
}

/** Dựng proxy cho một id: đọc gốc, giản lược theo LADDER, ghi public/models/proxy/<id>.glb. */
export async function buildProxy(id, srcPath, proxyPath, io, log = () => {}) {
  const src = await readSourceGeom(srcPath, id, io);
  const srcWorldBBox = worldBBoxFromLocal(src.trs, localBBoxFromInt16(src.P, src.vertexCount));
  const { positions: weldedPositions, indices: weldedIndices } = weldPositionOnly(src.P, src.vertexCount, src.indices);

  let chosen = null;
  for (const step of LADDER) {
    const r = trySimplify(weldedPositions, weldedIndices, { tri: step.tri, lock: step.lock });
    const world = worldBBoxFromLocal(src.trs, localBBoxFromInt16(r.posInt16, r.vertexCount));
    const maxDelta = maxFaceDelta(srcWorldBBox, world);
    chosen = { ...r, lockBorder: step.lock, triTarget: step.tri, maxDelta };
    if (maxDelta <= BBOX_TOL && r.triCount >= MIN_TRIS) break;
  }
  if (chosen.maxDelta > BBOX_TOL) {
    log(
      `  ! [${id}] bboxDelta ${chosen.maxDelta.toFixed(4)} > ${BBOX_TOL} sau cả thang leo (tri=${chosen.triTarget}` +
        `, lockBorder=${chosen.lockBorder}) — không đạt hợp đồng, vẫn ghi file`,
    );
  }

  // Dựng tài liệu glTF mới từ đầu — không đọc lại/tái dùng doc nguồn, để không kế thừa vật liệu/texture.
  const doc = new Document();
  const buffer = doc.createBuffer();

  const posAcc = doc.createAccessor('POSITION', buffer).setType('VEC3').setArray(chosen.posInt16).setNormalized(true);
  const norAcc = doc.createAccessor('NORMAL', buffer).setType('VEC3').setArray(chosen.norInt8).setNormalized(true);
  const idxArray = chosen.vertexCount <= 65535 ? Uint16Array.from(chosen.indices) : Uint32Array.from(chosen.indices);
  const idxAcc = doc.createAccessor('indices', buffer).setType('SCALAR').setArray(idxArray);

  const prim = doc
    .createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', posAcc)
    .setAttribute('NORMAL', norAcc)
    .setIndices(idxAcc);
  // Không gán material: đơn giản nhất, đúng hợp đồng ("không có") — runtime tự thay material của mình.

  const mesh = doc.createMesh(src.name).addPrimitive(prim);
  const node = doc.createNode(src.name).setMesh(mesh).setTranslation(src.trs.t).setRotation(src.trs.r).setScale(src.trs.s);
  const scene = doc.createScene().addChild(node);
  doc.getRoot().setDefaultScene(scene);

  await doc.transform(prune());
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  await fsp.mkdir(PROXY_DIR, { recursive: true });
  await io.write(proxyPath, doc);

  return chosen;
}

// -----------------------------------------------------------------------------
// Số liệu báo cáo / ghi JSON (đọc lại từ đĩa — đúng với cả nhánh vừa dựng lẫn nhánh bỏ qua vì idempotent).
// -----------------------------------------------------------------------------

/** Đọc số liệu hình học + bbox thế giới từ một proxy đã ghi (component types tối thiểu, không kiểm đầy đủ). */
async function readProxyGeom(proxyPath, io) {
  const doc = await io.read(proxyPath);
  const root = doc.getRoot();
  const node = root.listScenes()[0].listChildren()[0];
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  const trs = { t: [...node.getTranslation()], r: [...node.getRotation()], s: [...node.getScale()] };
  return {
    trs,
    vertexCount: pos.getCount(),
    triangles: prim.getIndices().getCount() / 3,
    P: pos.getArray(),
  };
}

/** Số liệu cho một id (đọc gốc + proxy đã có trên đĩa) — dùng cho cả bia vừa dựng lẫn bia bỏ qua (idempotent). */
export async function computeStats(id, srcPath, proxyPath, io) {
  const src = await readSourceGeom(srcPath, id, io);
  const srcWorldBBox = worldBBoxFromLocal(src.trs, localBBoxFromInt16(src.P, src.vertexCount));
  const proxy = await readProxyGeom(proxyPath, io);
  const proxyWorldBBox = worldBBoxFromLocal(proxy.trs, localBBoxFromInt16(proxy.P, proxy.vertexCount));
  return {
    file: `models/proxy/${id}.glb`,
    bytes: fs.statSync(proxyPath).size,
    triangles: proxy.triangles,
    vertices: proxy.vertexCount,
    sourceBytes: fs.statSync(srcPath).size,
    sourceTriangles: src.indices.length / 3,
    bboxDelta: round4(maxFaceDelta(srcWorldBBox, proxyWorldBBox)),
  };
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

async function mergeAndWriteJson(entries) {
  let existing = {};
  try {
    existing = JSON.parse(await fsp.readFile(DATA_FILE, 'utf8'));
  } catch {
    existing = {};
  }
  for (const [id, stats] of entries) existing[id] = stats;
  const sorted = {};
  for (const key of Object.keys(existing).sort()) sorted[key] = existing[key];
  await fsp.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fsp.writeFile(DATA_FILE, JSON.stringify(sorted, null, 2) + '\n');
  return sorted;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ids = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/\.glb$/, ''));

  const idList = ids.length
    ? ids
    : (await fsp.readdir(MODELS_DIR, { withFileTypes: true }))
        .filter((d) => d.isFile() && d.name.endsWith('.glb'))
        .map((d) => path.basename(d.name, '.glb'))
        .sort();

  const io = await getIO();
  const entries = [];
  const results = [];

  for (const id of idList) {
    const srcPath = path.join(MODELS_DIR, `${id}.glb`);
    if (!fs.existsSync(srcPath)) {
      console.error(`  ! ${id}: không tìm thấy ${srcPath}`);
      continue;
    }
    const proxyPath = path.join(PROXY_DIR, `${id}.glb`);
    const t0 = Date.now();

    const needsGen =
      force || !fs.existsSync(proxyPath) || fs.statSync(proxyPath).mtimeMs < fs.statSync(srcPath).mtimeMs;
    let chosen = null;
    if (needsGen) {
      chosen = await buildProxy(id, srcPath, proxyPath, io, (m) => console.log(m));
    }

    const stats = await computeStats(id, srcPath, proxyPath, io);
    const ms = Date.now() - t0;
    entries.push([id, stats]);
    results.push({ id, ...stats, ms, regenerated: needsGen, chosen });

    const ratio = (stats.sourceTriangles / stats.triangles).toFixed(1);
    const kb = (stats.bytes / 1024).toFixed(1);
    const tag = needsGen ? '' : ' (bỏ qua, đã mới hơn nguồn)';
    console.log(
      `${id.padEnd(9)} tam giác ${stats.sourceTriangles.toLocaleString()} → ${stats.triangles.toLocaleString()}` +
        ` (${ratio}×) · ${kb} KB · bboxDelta ${stats.bboxDelta.toFixed(4)} · ${ms}ms${tag}`,
    );
  }

  await mergeAndWriteJson(entries);

  const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
  const avgBytes = results.length ? totalBytes / results.length : 0;
  console.log(
    `\nTổng ${(totalBytes / 1024).toFixed(1)} KB · trung bình ${(avgBytes / 1024).toFixed(1)} KB / ${results.length} bia`,
  );
  const outOfBudget = results.filter((r) => r.bboxDelta > BBOX_TOL);
  if (outOfBudget.length) {
    console.log(`! bboxDelta vượt ${BBOX_TOL}: ${outOfBudget.map((r) => `${r.id} (${r.bboxDelta})`).join(', ')}`);
  }
  const outOfSize = results.filter((r) => r.bytes < TARGET_BYTES[0] || r.bytes > TARGET_BYTES[1]);
  if (outOfSize.length) {
    console.log(
      `! kích thước ngoài ${TARGET_BYTES[0] / 1000}–${TARGET_BYTES[1] / 1000} KB: ` +
        outOfSize.map((r) => `${r.id} (${(r.bytes / 1024).toFixed(1)} KB)`).join(', '),
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
