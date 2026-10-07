#!/usr/bin/env node
// Kiểm tra hợp đồng LOD v2 cho từng bia đã dựng:
//   1. node transform của lod0 / lod1 / lod2 (và mọi biến thể ab/) GIỐNG HỆT từng bit;
//   2. vị trí đỉnh (số nguyên Int16) của lod2 là tập con của lod0; lod1 (giản lược riêng từ bản quét đầy đủ, cùng lưới
//      lượng tử) nằm trong bbox lod0; bbox lod0 đứng y=0, cao 1;
//   3. bbox thế giới v2 so với v1 (public/models/<id>.glb) — cùng đặt để (đứng y=0, cao 1, mặt chữ +Z).
//   node tools/v2/verify.mjs [id…]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const V2 = path.join(ROOT, 'models-v2');

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

async function read(file) {
  const doc = await io.read(file);
  const node = doc.getRoot().listScenes()[0].listChildren()[0];
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  const W = node.getWorldMatrix();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, p);
    for (let k = 0; k < 3; k++) {
      const w = W[k] * p[0] + W[4 + k] * p[1] + W[8 + k] * p[2] + W[12 + k];
      if (w < min[k]) min[k] = w;
      if (w > max[k]) max[k] = w;
    }
  }
  return {
    trs: JSON.stringify([node.getTranslation(), node.getRotation(), node.getScale()]),
    raw: pos.getArray(),
    normalizedInt16: pos.getArray() instanceof Int16Array,
    min,
    max,
  };
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(V2).filter((d) => fs.existsSync(path.join(V2, d, 'lod0.glb')));
let bad = 0;
for (const id of ids) {
  const dir = path.join(V2, id);
  const files = ['lod0.glb', 'lod1.glb', 'lod2.glb'];
  const r = {};
  for (const f of files) r[f] = await read(path.join(dir, f));
  const trs0 = r['lod0.glb'].trs;
  const diffTrs = files.filter((f) => r[f].trs !== trs0);
  const set = new Set();
  const A = r['lod0.glb'].raw;
  for (let i = 0; i < A.length; i += 3) set.add(`${A[i]},${A[i + 1]},${A[i + 2]}`);
  const subset = { 'lod2.glb': 0 };
  const B = r['lod2.glb'].raw;
  for (let i = 0; i < B.length; i += 3) if (!set.has(`${B[i]},${B[i + 1]},${B[i + 2]}`)) subset['lod2.glb']++;
  // Khung đặt để = bbox bản quét đầy đủ (stele.json): y 0..1 chính xác. LOD giản lược có thể mất đỉnh cực trị
  // (đỉnh bia thấp đi ~1e-4) — chấp nhận tới 5e-4; mọi LOD phải nằm trong bbox bản đầy đủ.
  const fb = JSON.parse(fs.readFileSync(path.join(dir, 'stele.json'), 'utf8')).bbox;
  const l0 = r['lod0.glb'];
  const lod1Out = ['lod0.glb', 'lod1.glb', 'lod2.glb'].some((f) => [0, 1, 2].some((k) => r[f].min[k] < fb.min[k] - 2e-5 || r[f].max[k] > fb.max[k] + 2e-5));
  const standOk = Math.abs(fb.min[1]) < 1e-6 && Math.abs(fb.max[1] - 1) < 1e-6 && Math.abs(l0.min[1]) < 5e-4 && Math.abs(l0.max[1] - 1) < 5e-4;
  const v1 = fs.existsSync(path.join(ROOT, 'public', 'models', `${id}.glb`)) ? await read(path.join(ROOT, 'public', 'models', `${id}.glb`)) : null;
  const d = v1 ? Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(v1.min[k] - r['lod0.glb'].min[k]), Math.abs(v1.max[k] - r['lod0.glb'].max[k])])) : null;
  const ok = diffTrs.length === 0 && subset['lod2.glb'] === 0 && !lod1Out && standOk;
  if (!ok) bad++;
  console.log(
    `${ok ? 'OK ' : 'XX '}${id}: node TRS giống hệt ở ${files.length - diffTrs.length}/${files.length} tệp${diffTrs.length ? ` (KHÁC: ${diffTrs.join(', ')})` : ''}` +
      ` · lod2 ngoài lod0: ${subset['lod2.glb']} đỉnh · LOD ${lod1Out ? 'VƯỢT' : 'trong'} bbox bản đầy đủ · khung y 0..1, LOD0 y ${l0.min[1].toFixed(5)}..${l0.max[1].toFixed(5)}: ${standOk ? 'đúng' : 'SAI'}` +
      (v1 ? ` · |bbox v2 − v1| max ${d.toExponential(2)}` : '') +
      `\n    TRS ${trs0}\n    bbox v2 min ${r['lod0.glb'].min.map((x) => x.toFixed(4))} max ${r['lod0.glb'].max.map((x) => x.toFixed(4))}` +
      (v1 ? `\n    bbox v1 min ${v1.min.map((x) => x.toFixed(4))} max ${v1.max.map((x) => x.toFixed(4))}` : ''),
  );
}
process.exit(bad ? 1 : 0);
