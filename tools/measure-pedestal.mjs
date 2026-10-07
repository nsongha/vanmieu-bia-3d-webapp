#!/usr/bin/env node
// Đo DẤU CHÂN của từng bia để dựng một cỡ bục CHUNG cho mọi bia (chế độ Điện ảnh).
//
// Đọc public/models/<id>.glb (đầu ra của tools/prepare-models.mjs: đứng trên y = 0, tâm x/z = 0,
// cao 1 đơn vị), duyệt mọi đỉnh trong toạ độ thế giới của cảnh glTF — đúng như stage.js đo bản gốc
// lúc chạy — và ghi src/data/pedestal.generated.json:
//
//   swept : bán kính QUÉT quanh trục đứng qua gốc toạ độ (trục lắc của bia, cũng là tâm bục),
//           tính trên MỌI cao độ — kể cả đầu, chân, đuôi rùa.
//   base  : như trên nhưng chỉ phần CHÂN (3% chiều cao dưới cùng) — phải nằm gọn trong mép vành bục.
//
// "Bền" (robust): mỗi giá trị là phân vị cao ROBUST_Q theo từng múi góc (SECTORS múi quanh trục),
// rồi lấy múi lớn nhất. Một đỉnh nhiễu lạc ra ngoài (mảnh vụn khi quét) không kéo được bán kính,
// nhưng đầu/chân rùa — hàng trăm đỉnh trong vài múi — vẫn được tính đủ. Kèm cả giá trị cực đại
// thô (…Max) để đối chiếu.
//
// Chạy:  node tools/measure-pedestal.mjs            (mọi .glb trong public/models)
// Thêm bia mới → chạy lại script này sau prepare-models. Bia chưa có trong tệp vẫn chạy được:
// stage.js tự đo lúc nạp và lấy max(số đã biết, số đo được).

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'pedestal.generated.json');

const SECTORS = 180; // múi 2°
const ROBUST_Q = 0.995; // phân vị trong mỗi múi
const MIN_IN_SECTOR = 24; // múi ít đỉnh hơn thế thì bỏ qua (chỉ có thể là nhiễu lạc)
const FOOT_FRAC = 0.03; // "chân" = 3% chiều cao dưới cùng (khớp stage.js)

const r4 = (v) => Math.round(v * 1e4) / 1e4;

function applyMat4(m, x, y, z, out) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}

/** Mọi đỉnh (toạ độ thế giới) của mọi mesh trong cảnh mặc định. */
function collectPoints(doc) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const pts = [];
  const p = [0, 0, 0];
  const w = [0, 0, 0];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const n = pos.getCount();
      for (let i = 0; i < n; i++) {
        pos.getElement(i, p); // getElement tự giải chuẩn hoá (KHR_mesh_quantization)
        applyMat4(m, p[0], p[1], p[2], w);
        pts.push(w[0], w[1], w[2]);
      }
    }
  });
  return Float64Array.from(pts);
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

/** Bán kính bền theo múi góc + cực đại thô, cho các điểm thoả `keep(y)`. */
function sectorRadius(pts, keep) {
  const bins = Array.from({ length: SECTORS }, () => []);
  let max = 0;
  let count = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i];
    const y = pts[i + 1];
    const z = pts[i + 2];
    if (!keep(y)) continue;
    const r = Math.hypot(x, z);
    if (r > max) max = r;
    const a = Math.atan2(z, x);
    const k = Math.min(SECTORS - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * SECTORS));
    bins[k].push(r);
    count++;
  }
  let robust = 0;
  let at = -1;
  for (let k = 0; k < SECTORS; k++) {
    const b = bins[k];
    if (b.length < MIN_IN_SECTOR) continue;
    b.sort((u, v) => u - v);
    const q = quantile(b, ROBUST_Q);
    if (q > robust) {
      robust = q;
      at = k;
    }
  }
  // Múi thắng: phương vị (độ, 0 = +z mặt trước, dương về +x) — để biết đó là đầu, chân hay đuôi rùa.
  const mid = ((at + 0.5) / SECTORS) * 2 * Math.PI - Math.PI; // atan2(z, x)
  const azimuth = at < 0 ? null : Math.round((Math.atan2(Math.cos(mid), Math.sin(mid)) * 180) / Math.PI);
  return { robust: robust || max, max, count, azimuth };
}

async function main() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  await MeshoptDecoder.ready;

  const files = (await fsp.readdir(MODELS_DIR)).filter((f) => f.endsWith('.glb')).sort();
  if (!files.length) throw new Error(`Không có .glb nào trong ${MODELS_DIR}`);

  const steles = {};
  for (const f of files) {
    const id = path.basename(f, '.glb');
    const doc = await io.read(path.join(MODELS_DIR, f));
    const pts = collectPoints(doc);
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 1; i < pts.length; i += 3) {
      if (pts[i] < yMin) yMin = pts[i];
      if (pts[i] > yMax) yMax = pts[i];
    }
    const footY = yMin + FOOT_FRAC * (yMax - yMin);
    const all = sectorRadius(pts, () => true);
    const foot = sectorRadius(pts, (y) => y < footY);
    steles[id] = {
      swept: r4(all.robust),
      sweptMax: r4(all.max),
      sweptAzimuth: all.azimuth,
      base: r4(foot.robust),
      baseMax: r4(foot.max),
      vertices: pts.length / 3,
    };
    console.log(
      `${id.padEnd(9)} swept ${all.robust.toFixed(4)} (max ${all.max.toFixed(4)}, az ${all.azimuth}°)` +
        `  base ${foot.robust.toFixed(4)} (max ${foot.max.toFixed(4)})  ${pts.length / 3} đỉnh`,
    );
  }

  const ids = Object.keys(steles);
  const maxOf = (k) => ids.reduce((a, id) => Math.max(a, steles[id][k]), 0);
  const argMax = (k) => ids.reduce((a, id) => (steles[id][k] > (steles[a]?.[k] ?? -1) ? id : a), ids[0]);
  const out = {
    $comment:
      'Sinh bởi tools/measure-pedestal.mjs — KHÔNG sửa tay. Bán kính dấu chân (đơn vị thế giới, bia cao 1) quanh trục lắc; ' +
      `phân vị ${ROBUST_Q} theo ${SECTORS} múi góc. stage.js lấy max để dựng MỘT cỡ bục chung.`,
    method: { sectors: SECTORS, quantile: ROBUST_Q, minInSector: MIN_IN_SECTOR, footFrac: FOOT_FRAC },
    max: { swept: maxOf('swept'), sweptBy: argMax('swept'), base: maxOf('base'), baseBy: argMax('base') },
    steles,
  };
  await fsp.writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nmax swept ${out.max.swept} (${out.max.sweptBy}) · max base ${out.max.base} (${out.max.baseBy})`);
  console.log(`→ ${path.relative(ROOT, OUT_FILE)}`);
}

// Chỉ chạy khi gọi trực tiếp (tools/v2/build.mjs import các hàm đo bên dưới để đo LOD0 v2 mà không ghi src/data).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { collectPoints, sectorRadius, FOOT_FRAC, SECTORS, ROBUST_Q, MIN_IN_SECTOR };
