#!/usr/bin/env node
// Tìm ĐẦU RÙA của từng bia (tâm + bán kính, toạ độ cục bộ của mô hình) cho tính năng "Xoa đầu rùa"
// của chế độ Điện ảnh. Ghi src/data/heads.generated.json.
//
// Mô hình (đầu ra của tools/prepare-models.mjs): đứng trên y = 0, tâm x/z = 0, cao 1, mặt chữ quay +Z.
// Đầu rùa là khối nhô ra TRƯỚC NHẤT (+Z) ở dải thấp, nằm giữa bề ngang; chân trước ở hai bên thấp hơn.
//
//   1. Bản đồ "mặt trước": lưới (x, y) phủ dải thấp, mỗi ô giữ z lớn nhất (bề mặt nhìn từ phía trước).
//   2. Mũi rùa = ô có z lớn nhất trong CỘT GIỮA (|x| ≤ CENTER_X), bỏ FLOOR_ROWS hàng sát sàn — chân trước nằm ngoài
//      cột này, còn mép chân / yếm bẹp trên sàn (nhô ngang mũi ở vài bia) nằm dưới các hàng đó.
//   3. Mốc thân: z điển hình của mặt trước thân / mai ở hai bên cột giữa (trung vị ô |x| 0,12–0,26).
//   4. Vùng đầu = các ô LIỀN với ô mũi có z trong HEAD_DEPTH tính từ mũi (và vượt mốc thân ≥ HEAD_REL
//      phần độ nhô). Chân trước / mai nối với đầu chỉ qua các ô lùi sâu hơn (cổ) → không lọt vào.
//   5. Điểm đầu = đỉnh thuộc các ô vùng đầu và nhô quá ngưỡng đó; tâm = trung bình, bán kính = phân vị
//      RADIUS_Q khoảng cách tới tâm × RADIUS_PAD (vùng "xoa được" bọc trọn mặt trên + mõm đầu rùa).
//
//   6. Cổ (r10): trục = tâm đầu → tâm thân rùa (dải thấp), không dốc lên quá NECK_RISE (cổ không chui lên mai); độ
//      dài tới chỗ cổ gặp mai TRỪ bán kính cổ (NECK_R × r), kẹp [NECK_MIN, NECK_MAX] × r; y mặt dưới cằm (phân vị 3 %
//      điểm đầu) — vùng xoa = đầu + cổ, cắt bỏ phần dưới cằm (chân trước không lọt vào).
//
// Bia nào dò sai: thêm vào OVERRIDES bên dưới (toạ độ cục bộ, đo bằng vm.cinemaHead() trong DEV),
// chạy lại script. Tệp sinh ra ghi rõ nguồn ('auto' | 'override') của từng bia.
//
// Chạy:  node tools/measure-heads.mjs            (mọi .glb trong public/models)
//        node tools/measure-heads.mjs --map      (in thêm bản đồ mặt trước dạng chữ để soát)

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(ROOT, 'public', 'models');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'heads.generated.json');

/** Dải thấp chứa rùa (phần chiều cao mô hình) và nửa bề ngang lưới. */
const BAND_Y = 0.42;
const HALF_X = 0.36;
const CELL = 0.012; // cạnh ô lưới (đơn vị mô hình, bia cao 1)
const CENTER_X = 0.12; // cột giữa để tìm mũi rùa
const HEAD_REL = 0.35; // phần độ nhô (mũi − thân) một ô phải vượt để thuộc vùng đầu
const SIDE_DY = 5; // ô — nửa dải cao (quanh mũi) lấy mốc thân
const HEAD_HALF_X = 0.1; // nửa bề ngang tối đa của đầu quanh mũi (chân trước nằm ngoài)
/** Bỏ ngần này hàng ô sát sàn khi tìm mũi / loang vùng đầu (r10): chân trước + yếm rùa nằm bẹp trên sàn nhô ra ngang
 *  mũi ở vài bia (1727: mũi dò nhầm vào mép chân trái ở y 0,018 → cầu đầu lệch + to, lấn chân). */
const FLOOR_ROWS = 3;
const HEAD_DEPTH = 0.11; // độ sâu (theo z, từ mũi vào) của phần đầu "xoa được": đỉnh đầu + mõm
const RADIUS_Q = 0.9;
const RADIUS_PAD = 1.15;
const MIN_POINTS = 40;
/** Độ dài cổ (từ tâm đầu dọc trục cổ), theo bán kính đầu. */
const NECK_MIN = 0.3;
const NECK_MAX = 1.1;
/** Bán kính cổ theo bán kính đầu — PHẢI khớp REGION_NECK_K ở src/views/cinema/polish.js. */
const NECK_R = 0.55;
/** Độ dốc lên tối đa của trục cổ (thành phần y của vectơ đơn vị). */
const NECK_RISE = 0.05;

/**
 * Sửa tay cho bia dò sai: { center: [x, y, z], radius, neck?: { axis:[x,y,z], length, under } }. Để trống khi mọi bia
 * đều đúng (soát bằng bảng ảnh vùng xoa .captures/r10-sheet-region.jpg).
 * @type {Record<string, {center:[number,number,number], radius:number, neck?:object, note?:string}>}
 */
const OVERRIDES = {};

const r4 = (v) => Math.round(v * 1e4) / 1e4;

function applyMat4(m, x, y, z, out) {
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

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
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);
        applyMat4(m, p[0], p[1], p[2], w);
        pts.push(w[0], w[1], w[2]);
      }
    }
  });
  return Float64Array.from(pts);
}

function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((u, v) => u - v);
  return s[Math.floor(s.length / 2)];
}

/**
 * Trục cổ + độ dài cổ. Trục = hướng từ tâm đầu tới TÂM THÂN rùa (trọng tâm các đỉnh ở dải thấp, lùi sau đầu, giữa
 * bề ngang). Cổ gặp mai ở độ sâu z của mặt trước thân / mai NGAY HAI BÊN cổ (trung vị bản đồ mặt trước ở dải
 * |x − x_đầu| ∈ [1,2 r; 2,4 r], cùng tầm cao đầu) → độ dài cổ tính dọc trục, kẹp [NECK_MIN, NECK_MAX] × r.
 */
function measureNeck(pts, c, r, zmax, NX, NY, cx) {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i];
    const y = pts[i + 1];
    const z = pts[i + 2];
    if (y < 0.02 || y > BAND_Y || Math.abs(x) > 0.3 || z > c[2] - 1.5 * r) continue;
    sx += x;
    sy += y;
    sz += z;
    n++;
  }
  if (!n) return null;
  const body = [sx / n, sy / n, sz / n];
  let dx = body[0] - c[0];
  let dy = body[1] - c[1];
  let dz = body[2] - c[2];
  let l = Math.hypot(dx, dy, dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  // cổ không bao giờ chui ngược lên mai: độ dốc lên kẹp NECK_RISE (đầu ngẩng cao thì cổ đi xuống — giữ nguyên)
  if (dy > NECK_RISE) {
    dy = NECK_RISE;
    l = Math.hypot(dx, dy, dz);
    dx /= l;
    dy /= l;
    dz /= l;
  }
  const side = [];
  for (let gy = 0; gy < NY; gy++) {
    const y = (gy + 0.5) * CELL;
    if (y < c[1] - 0.5 * r || y > c[1] + 1.0 * r) continue;
    for (let gx = 0; gx < NX; gx++) {
      const ax = Math.abs(cx(gx) - c[0]);
      const z = zmax[gy * NX + gx];
      if (ax >= 1.2 * r && ax <= 2.4 * r && z > -Infinity) side.push(z);
    }
  }
  side.sort((a, b) => a - b);
  const shellZ = side.length ? side[Math.floor(side.length / 2)] : c[2] - r;
  // tới chỗ cổ gặp mai, TRỪ bán kính cổ (đầu tròn của viên thuốc không lấn lên mép mai)
  const len = Math.min(NECK_MAX * r, Math.max(NECK_MIN * r, (c[2] - shellZ) / Math.max(0.2, -dz) - NECK_R * r));
  return { axis: [r4(dx), r4(dy), r4(dz)], length: r4(len), shellZ: r4(shellZ), body: body.map(r4) };
}

function detectHead(pts, printMap = false) {
  const NX = Math.round((2 * HALF_X) / CELL);
  const NY = Math.round(BAND_Y / CELL);
  const zmax = new Float64Array(NX * NY).fill(-Infinity);
  const cellOf = (x, y) => {
    if (y < 0 || y >= BAND_Y || x < -HALF_X || x >= HALF_X) return -1;
    return Math.floor(y / CELL) * NX + Math.floor((x + HALF_X) / CELL);
  };
  for (let i = 0; i < pts.length; i += 3) {
    const c = cellOf(pts[i], pts[i + 1]);
    if (c >= 0 && pts[i + 2] > zmax[c]) zmax[c] = pts[i + 2];
  }
  const cx = (gx) => -HALF_X + (gx + 0.5) * CELL;
  // 2. mũi: ô cao nhất trong cột giữa, bỏ hàng sát sàn (bóng / mép vụn)
  let tip = -1;
  for (let gy = FLOOR_ROWS; gy < NY; gy++) {
    for (let gx = 0; gx < NX; gx++) {
      if (Math.abs(cx(gx)) > CENTER_X) continue;
      const c = gy * NX + gx;
      if (zmax[c] > -Infinity && (tip < 0 || zmax[c] > zmax[tip])) tip = c;
    }
  }
  if (tip < 0) return null;
  const tipZ = zmax[tip];
  // 3. mốc thân: trung vị mặt trước ở hai dải bên cột giữa, CÙNG tầm cao với mũi (± SIDE_DY) — mặt trước
  //    thân / mai rùa ngay hai bên cổ, không lẫn mặt phiến bia phía trên
  const tipGy = Math.floor(tip / NX);
  const side = [];
  for (let gy = Math.max(0, tipGy - SIDE_DY); gy <= Math.min(NY - 1, tipGy + SIDE_DY); gy++) {
    for (let gx = 0; gx < NX; gx++) {
      const ax = Math.abs(cx(gx));
      const z = zmax[gy * NX + gx];
      if (ax >= 0.12 && ax <= 0.26 && z > -Infinity) side.push(z);
    }
  }
  const bodyZ = median(side);
  // Ngưỡng: phần TRƯỚC của đầu (sâu HEAD_DEPTH tính từ mũi) — không bao giờ thấp hơn mốc thân + HEAD_REL
  // độ nhô, để đầu thấp / ngắn (mõm sát thân) không lan ra cả mặt trước thân rùa.
  const thr = Math.max(tipZ - HEAD_DEPTH, bodyZ + HEAD_REL * (tipZ - bodyZ));
  // 4. vùng đầu: loang 4 hướng từ ô mũi qua các ô vượt ngưỡng
  const inHead = new Uint8Array(NX * NY);
  const stack = [tip];
  inHead[tip] = 1;
  while (stack.length) {
    const c = stack.pop();
    const gx = c % NX;
    const gy = (c - gx) / NX;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = gx + dx;
      const y = gy + dy;
      // bỏ hàng sát sàn (chân trước chạm đất cùng tầm z với mõm ở vài bia) và ô xa mũi quá HEAD_HALF_X
      if (x < 0 || y < FLOOR_ROWS || x >= NX || y >= NY || Math.abs(cx(x) - cx(tip % NX)) > HEAD_HALF_X) continue;
      const n = y * NX + x;
      if (!inHead[n] && zmax[n] > thr) {
        inHead[n] = 1;
        stack.push(n);
      }
    }
  }
  // 5. điểm đầu → tâm + bán kính
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  const sel = [];
  for (let i = 0; i < pts.length; i += 3) {
    const c = cellOf(pts[i], pts[i + 1]);
    if (c < 0 || !inHead[c] || pts[i + 2] <= thr) continue;
    sx += pts[i];
    sy += pts[i + 1];
    sz += pts[i + 2];
    n++;
    sel.push(i);
  }
  if (n < MIN_POINTS) return null;
  const center = [sx / n, sy / n, sz / n];
  const d = sel.map((i) => Math.hypot(pts[i] - center[0], pts[i + 1] - center[1], pts[i + 2] - center[2])).sort((a, b) => a - b);
  const radius = d[Math.floor(RADIUS_Q * (d.length - 1))] * RADIUS_PAD;
  let cells = 0;
  for (const v of inHead) cells += v;

  if (printMap) {
    const lines = [];
    for (let gy = NY - 1; gy >= 0; gy -= 2) {
      let s = `${(gy * CELL).toFixed(2)} `;
      for (let gx = 0; gx < NX; gx += 1) {
        const c = gy * NX + gx;
        const z = zmax[c];
        s += c === tip ? '@' : inHead[c] ? '#' : z === -Infinity ? ' ' : z > bodyZ ? '+' : z > bodyZ - 0.1 ? '.' : ' ';
      }
      lines.push(s);
    }
    console.log(lines.join('\n'));
  }
  // --- CỔ (r10): trục từ tâm đầu về tâm thân rùa ở dải thấp + điểm cổ gặp mai; mặt cắt dưới cằm
  const neck = measureNeck(pts, center, radius, zmax, NX, NY, cx);
  const ys = sel.map((i) => pts[i + 1]).sort((a, b) => a - b);
  const under = ys[Math.floor(0.03 * (ys.length - 1))];
  return {
    center: center.map(r4),
    radius: r4(radius),
    neck: neck && { ...neck, under: r4(under) },
    tip: [r4(cx(tip % NX)), r4((Math.floor(tip / NX) + 0.5) * CELL), r4(tipZ)],
    bodyZ: r4(bodyZ),
    protrusion: r4(tipZ - bodyZ),
    points: n,
    cells,
  };
}

async function main() {
  const printMap = process.argv.includes('--map');
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
    if (printMap) console.log(`\n=== ${id}`);
    const auto = detectHead(pts, printMap);
    const ov = OVERRIDES[id];
    const use = ov
      ? { center: ov.center.map(r4), radius: r4(ov.radius), neck: ov.neck ?? auto?.neck ?? null }
      : auto
        ? { center: auto.center, radius: auto.radius, neck: auto.neck }
        : null;
    steles[id] = use
      ? { ...use, source: ov ? 'override' : 'auto', ...(ov?.note ? { note: ov.note } : {}), auto }
      : { center: null, radius: 0, source: 'none', auto };
    console.log(
      `${id.padEnd(9)} ${steles[id].source.padEnd(8)} tâm ${use ? use.center.map((v) => v.toFixed(3)).join(', ') : '—'}` +
        `  r ${use ? use.radius.toFixed(3) : '—'}` +
        (use?.neck ? `  cổ ${use.neck.axis.map((v) => v.toFixed(2)).join(',')} dài ${use.neck.length.toFixed(3)} (${(use.neck.length / use.radius).toFixed(2)} r) · cằm y ${use.neck.under.toFixed(3)}` : '') +
        (auto ? `  (mũi z ${auto.tip[2].toFixed(3)} · ${auto.points} đỉnh)` : '  (không dò được)'),
    );
  }
  const out = {
    $comment:
      'Sinh bởi tools/measure-heads.mjs — KHÔNG sửa tay (sửa OVERRIDES trong script rồi chạy lại). Đầu rùa của từng bia: ' +
      'tâm + bán kính trong toạ độ cục bộ của mô hình (bia cao 1, đứng trên y = 0, mặt chữ +Z), cổ: trục (đơn vị, từ tâm đầu ' +
      'về thân), độ dài, y mặt dưới cằm (under). Vùng xoa = đầu + cổ, cắt bỏ dưới cằm. Dùng cho "Xoa đầu rùa" (Điện ảnh).',
    method: { bandY: BAND_Y, cell: CELL, centerX: CENTER_X, headRel: HEAD_REL, radiusQ: RADIUS_Q, radiusPad: RADIUS_PAD, floorRows: FLOOR_ROWS, neckMin: NECK_MIN, neckMax: NECK_MAX, neckR: NECK_R, neckRise: NECK_RISE },
    steles,
  };
  await fsp.writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`→ ${path.relative(ROOT, OUT_FILE)}`);
}

// Chỉ chạy khi gọi trực tiếp (tools/v2/build.mjs import các hàm đo bên dưới để đo LOD0 v2 mà không ghi src/data).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { collectPoints, detectHead, OVERRIDES as HEAD_OVERRIDES };
