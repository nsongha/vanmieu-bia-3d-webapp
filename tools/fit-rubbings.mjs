#!/usr/bin/env node
// r83 — KHỚP BẢN DẬP cho cả 82 bia (Điện ảnh: quét bản dập trên mặt bia — stage/scan.js + polish.js).
//
// Bản dập (models-v2/rubbings/bia-<năm>.webp — làm sạch bằng tools/rubbing_clean.py; ngoài git, đi cùng mô hình) + mốc chuẩn hoá
// của nó (bia-<năm>.json: khung ngoài + profile vòm, viền trong, dải tiêu đề) được khớp lên mặt bia của MÔ HÌNH v2 bằng ánh xạ
// TỪNG KHÚC mỗi trục (giấy dập co giãn không đều): x — 4 mốc u (khung ngoài trái, viền trong trái / phải, khung ngoài phải);
// y — 4 mốc v (đáy viền trong, đáy dải tiêu đề, đỉnh dải tiêu đề, đỉnh vòm; chân khung ngoài kéo dài khúc dưới).
//   1. Xuất phát: mốc ĐO trên mô hình — mép phiến (bóng trực giao), face-fields x0 / x1 / band / frameBottom, đỉnh bóng phiến.
//   2. Tín hiệu: ảnh XIÊN chính diện của mô hình (vm.cinemaOrthoFront, đèn xiên — nét khắc rõ) lọc thông cao ↔ độ phủ nét bản dập
//      lọc thông cao, cùng cỡ điểm ảnh.
//   3. Ba ứng viên (hybridFit): 'chữ' — khoá chữ dải tiêu đề 2 chiều (dời + co giãn x, dời y) rồi bắt đường ngang (đáy viền trong,
//      đáy / đỉnh dải tiêu đề — profile 1 chiều, |đạo hàm| không phụ thuộc cực sáng / tối) rồi khoá chữ theo x; 'đường' — đường
//      ngang trước rồi chữ; 'khung' — đường ngang + đường dọc viền trong. Khúc viền ngoài giữ tỉ lệ khúc giữa, không vượt mép phiến.
//   4. Chọn ứng viên được nhiều phép ĐO độc lập đồng thuận nhất (measureFit: đường ngang, đường dọc viền trong, chữ tiêu đề);
//      HOÀN THIỆN: dời mốc theo phần còn lệch chắc (> 1 ‰) nếu đồng thuận không giảm và RMS giảm.
//   5. Phần dư (resid, đơn vị bia — bia cao ≈ 1): lớn nhất / RMS của các đo CHẮC (đỉnh tương quan đủ, không ở biên cửa sổ) của
//      đường ngang + chữ dải tiêu đề; đường dọc viền trong chỉ tham khảo. tests/cinema/all-steles.test.mjs kiểm resid.max ≤ 9 ‰.
// Sửa tay từng bia: src/data/rubbings.overrides.json (mode: một ứng viên, start: 'mép', noRefine, dx / dy, x / y — 4 mốc).
// Ngoài hai mốc đầu / cuối: kéo dài khúc kề (shader polish.js scanPw cũng vậy).
// r84: + MẶT PHẲNG MẶT BIA (plane: z0, kx, ky + dải lệch back / front của mặt đá thật — facePlane) — shader chỉ cho bản dập / vệt / chữ
// Hán trên lớp mặt (khoảng cách tới mặt phẳng, pháp tuyến hướng trước, trong khung mặt), không bao giờ lan sang đầu rùa / hông / bục.
// Ghi src/data/rubbings.generated.json (ảnh, ánh xạ từng khúc, affine gần đúng khúc giữa, khung mặt, mặt phẳng, phần dư) + ảnh xem lại:
// --sheet (bản dập 50 % chồng lên ảnh xiên + đường mốc, 12 bia / trang), --review / --bands (phóng to dải tiêu đề), --detail.
//
// Chạy (bước chụp cần máy chủ dev; bước khớp chạy trên ảnh đã chụp, ~10 phút cho 82 bia):
//   node tools/fit-rubbings.mjs --port 5180 --src <thư mục bia-*.json + .webp> --cache <thư mục> [--w 1000]   chụp
//   node tools/fit-rubbings.mjs --fit --src <…> --cache <…> [--sheet <thư mục>] [--no-write] [--only bia-1442,…] [--dump <tệp>]
//     [--from-generated: lấy ánh xạ đã ghi, chỉ đo lại / hoàn thiện / dựng ảnh] [--no-polish] [--landmarks-only]
//     [--ref <rubbings.generated.json cũ>: thêm ánh xạ cũ làm ứng viên]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/rubbings.generated.json');
const OVR = path.join(ROOT, 'src/data/rubbings.overrides.json');
const FF = path.join(ROOT, 'src/data/face-fields.generated.json');
const FFO = path.join(ROOT, 'src/data/face-fields.overrides.json');
const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const PORT = Number(arg('--port') ?? 5180);
const SRC = arg('--src');
const CACHE = arg('--cache');
const SHEET = arg('--sheet');
const ONLY = arg('--only')?.split(',') ?? null;
const FIT = argv.includes('--fit');
const WRITE = !argv.includes('--no-write');
const IMG_W = Number(arg('--w') ?? 1000);
const DETAIL = arg('--detail'); // ảnh xem lại từng bia: vùng phóng to mô hình | bản dập theo phép khớp
// --ref <tệp generated>: ánh xạ đã ghi trước đó làm thêm một ứng viên ('cũ' — đổi sang bộ mốc hiện tại) — khớp lại không bao giờ tệ
// hơn bản cũ theo tiêu chí đồng thuận
const REF = arg('--ref') && fs.existsSync(arg('--ref')) ? JSON.parse(fs.readFileSync(arg('--ref'), 'utf8')).steles ?? null : null;
if (!SRC || !CACHE) {
  console.error('cần --src <thư mục mốc bia-*.json> --cache <thư mục ảnh chụp>');
  process.exit(2);
}
fs.mkdirSync(CACHE, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.generated.json'), 'utf8'));
let ids = Object.keys(catalog)
  .filter((k) => !k.startsWith('$'))
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
if (ONLY) ids = ids.filter((id) => ONLY.includes(id));

// ───────────────────────── chụp (trình duyệt)
async function capture() {
  const { launch, openCinema, sleep } = await import('../tests/lib/browser.mjs');
  const { page, close } = await launch({ width: 1440, height: 900, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true } });
  await openCinema(page, PORT, { id: ids[0], hooks: ['cinemaOrthoFront', 'cinemaIdle', 'cinemaInfo', 'cinemaTxProgress', 'cinemaLods', 'cinemaReveal'], settleMs: 3000 });
  const E = (fn, a) => page.evaluate(fn, a);
  const source = await E(() => (window.__vm.cinemaLods().v2 ? 'v2' : 'v1'));
  if (source !== 'v2') throw new Error('cần nguồn mô hình v2');
  for (const id of ids) {
    await E(async (id) => {
      if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
      const t0 = performance.now();
      while (performance.now() - t0 < 30000) {
        await new Promise((r) => setTimeout(r, 150));
        const rv = window.__vm.cinemaReveal();
        if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0 && window.__vm.cinemaLods().liveLod === 0 && !rv.proxy && !rv.revealing) break;
      }
    }, id);
    await sleep(400);
    const shots = await E((W) => ({
      rake: window.__vm.cinemaOrthoFront({ w: W, pad: 0.04, light: 'rake', yFrom: 'min' }),
      depth: window.__vm.cinemaOrthoFront({ w: W, pad: 0.04, light: 'depth', yFrom: 'min' }),
      flat: window.__vm.cinemaOrthoFront({ w: W, pad: 0.04, light: 'flat', yFrom: 'min' }),
    }), IMG_W);
    fs.writeFileSync(path.join(CACHE, `${id}.rake.png`), Buffer.from(shots.rake.url.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(CACHE, `${id}.flat.png`), Buffer.from(shots.flat.url.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(CACHE, `${id}.depth.png`), Buffer.from(shots.depth.url.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(CACHE, `${id}.json`), JSON.stringify({ id, w: shots.rake.w, h: shots.rake.h, rect: shots.rake.rect, depth: shots.depth.depth, bounds: shots.rake.bounds, head: shots.rake.head }));
    process.stdout.write(`${id} ✓\n`);
  }
  await close();
}

// ───────────────────────── khớp (Node)
const median = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? v[v.length >> 1] : NaN;
};
/** Bình phương tối thiểu có trọng số: y ≈ a + b·x. */
function wls(pts) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) {
    sw += p.w;
    sx += p.w * p.x;
    sy += p.w * p.y;
    sxx += p.w * p.x * p.x;
    sxy += p.w * p.x * p.y;
  }
  const den = sw * sxx - sx * sx;
  const b = Math.abs(den) > 1e-12 ? (sw * sxy - sx * sy) / den : 0;
  const a = (sy - b * sx) / Math.max(sw, 1e-12);
  return { a, b };
}
/** Đặc trưng mô hình từ ảnh độ sâu: biên trái / phải mỗi hàng, đỉnh mỗi cột (toạ độ bia). */
async function modelOutline(id) {
  const meta = JSON.parse(fs.readFileSync(path.join(CACHE, `${id}.json`), 'utf8'));
  const { data, info } = await sharp(path.join(CACHE, `${id}.depth.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const { rect, bounds } = meta;
  const { zLo, zHi } = meta.depth;
  const zOf = (x, y) => {
    const i = (y * w + x) * 3;
    const r = data[i];
    const g = data[i + 1];
    if (r === 0 && g === 0) return NaN;
    return zLo + ((r + g / 255) / 255) * (zHi - zLo);
  };
  const X = (px) => rect.x0 + ((px + 0.5) / w) * (rect.x1 - rect.x0);
  const Y = (py) => rect.y1 - ((py + 0.5) / h) * (rect.y1 - rect.y0);
  const PX = (x) => ((x - rect.x0) / (rect.x1 - rect.x0)) * w - 0.5;
  const PY = (y) => ((rect.y1 - y) / (rect.y1 - rect.y0)) * h - 0.5;
  // mặt trước = điểm có z gần mặt phẳng trước (± 0,03) — bỏ rùa / đế nhô ra trước
  const zF = bounds.zFront;
  const front = (x, y) => {
    const z = zOf(x, y);
    return Number.isFinite(z) && z > zF - 0.08 && z < zF + 0.03;
  };
  // đỉnh mỗi cột (hàng trên cùng có hình) — viền đỉnh phiến
  const top = new Float64Array(w).fill(NaN);
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (Number.isFinite(zOf(x, y))) {
        top[x] = Y(y - 0.5); // mép trên của điểm ảnh
        break;
      }
  // biên trái / phải mỗi hàng (chỉ phần hình thuộc lớp mặt trước + hông phiến: bỏ hàng có rùa lấn ra)
  const L = new Float64Array(h).fill(NaN);
  const R = new Float64Array(h).fill(NaN);
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (Number.isFinite(zOf(x, y))) { l = x; break; }
    for (let x = w - 1; x >= 0; x--) if (Number.isFinite(zOf(x, y))) { r = x; break; }
    if (l >= 0) {
      L[y] = X(l - 0.5);
      R[y] = X(r + 0.5);
    }
  }
  return { meta, w, h, X, Y, PX, PY, top, L, R, front };
}

function faceFieldOf(id) {
  const g = JSON.parse(fs.readFileSync(FF, 'utf8'));
  const o = fs.existsSync(FFO) ? JSON.parse(fs.readFileSync(FFO, 'utf8')) : null;
  const a = g.steles?.[id] ?? null;
  const b = o && o.source === g.source ? o.steles?.[id] ?? null : null;
  if (!a && !b) return null;
  const f = { ...(a ?? {}), ...(b ?? {}), override: !!b };
  f.band = b?.band ?? b?.y1 ?? f.band ?? f.y1;
  return f;
}

/** Ảnh mờ hộp (bỏ qua điểm mask 0). */
function boxBlur(src, mask, w, h, r) {
  const out = new Float32Array(w * h);
  const tmp = new Float32Array(w * h);
  const tmc = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let s2 = 0, c = 0;
    for (let x = -r; x < w + r; x++) {
      const xa = x + r;
      if (xa < w && xa >= 0 && mask[y * w + xa]) { s2 += src[y * w + xa]; c++; }
      const xb = x - r - 1;
      if (xb >= 0 && xb < w && mask[y * w + xb]) { s2 -= src[y * w + xb]; c--; }
      if (x >= 0 && x < w) { tmp[y * w + x] = s2; tmc[y * w + x] = c; }
    }
  }
  for (let x = 0; x < w; x++) {
    let s2 = 0, c = 0;
    for (let y = -r; y < h + r; y++) {
      const ya = y + r;
      if (ya < h && ya >= 0) { s2 += tmp[ya * w + x]; c += tmc[ya * w + x]; }
      const yb = y - r - 1;
      if (yb >= 0 && yb < h) { s2 -= tmp[yb * w + x]; c -= tmc[yb * w + x]; }
      if (y >= 0 && y < h) out[y * w + x] = c > 0 ? s2 / c : 0;
    }
  }
  return out;
}

// ───────────────────────── tinh chỉnh: ĐỘ CAO mặt trước của mô hình ↔ bản dập
// Bản dập là "ảnh độ cao" của mặt đá: chỗ nổi được tô mực (tối), chỗ lõm giữ màu giấy (sáng). Ảnh độ sâu của mô hình lọc thông
// cao (mặt phẳng cục bộ − z: lõm sáng, nổi tối) cho cùng cực → NCC 2 chiều giữa hai ảnh (đã làm mờ cỡ dải khung) khoá các dải
// khung / dải tiêu đề / viền (chữ nhỏ không có trong hình học). Xuất phát từ vài phép khớp mốc, lấy NCC lớn nhất.
async function reliefMap(M) {
  const { data, info } = await sharp(path.join(CACHE, `${M.meta.id}.depth.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const { zLo, zHi } = M.meta.depth;
  const zF = M.meta.bounds.zFront;
  const z = new Float32Array(w * h);
  const ok = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 3], b = data[i * 3 + 1];
    if (!a && !b) continue;
    const v = zLo + ((a + b / 255) / 255) * (zHi - zLo);
    if (v > zF - 0.03 && v < zF + 0.012) { z[i] = v; ok[i] = 1; }
  }
  const r = Math.max(4, Math.round(w / 60));
  const zm = boxBlur(boxBlur(z, ok, w, h, r), ok, w, h, r);
  const rel = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) if (ok[i]) rel[i] = (zm[i] - z[i]) / 0.004;
  // + ẢNH MÀU (chiếu đều): khung / chữ khắc nông (bia cổ) gần như không có trong hình học nhưng lòng nét tối hơn đá quanh nó →
  // độ tối cục bộ (cùng cực với bản dập: lõm = sáng trên giấy)
  const flatF = path.join(CACHE, `${M.meta.id}.flat.png`);
  if (fs.existsSync(flatF)) {
    const { data: fd } = await sharp(flatF).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = (fd[i * 3] * 0.299 + fd[i * 3 + 1] * 0.587 + fd[i * 3 + 2] * 0.114) / 255;
    const lr = Math.max(3, Math.round(w / 120));
    const lm2 = boxBlur(boxBlur(lum, ok, w, h, lr), ok, w, h, lr);
    for (let i = 0; i < w * h; i++) if (ok[i]) rel[i] = 0.6 * rel[i] + (lm2[i] - lum[i]) / 0.04;
  }
  for (let i = 0; i < w * h; i++) rel[i] = Math.max(-1, Math.min(1, rel[i]));
  // vành 6 px quanh mép mặt trước: bỏ (mép phiến không có trên giấy)
  const okE = boxBlur(Float32Array.from(ok), new Uint8Array(w * h).fill(1), w, h, 6);
  for (let i = 0; i < w * h; i++) if (okE[i] < 0.999) ok[i] = 0;
  return { v: rel, ok, w, h };
}
async function rubGray(id, W) {
  const { data, info } = await sharp(path.join(SRC, `${id}.webp`)).resize(Math.round(W)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const v = new Float32Array(w * h);
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    v[i] = data[i * 4] / 255;
    a[i] = data[i * 4 + 3] > 250 ? 1 : 0;
  }
  return { v, a, w, h };
}
const blur2 = (img, r) => {
  const m = img.ok ?? img.a;
  return { ...img, v: boxBlur(boxBlur(img.v, m, img.w, img.h, r), m, img.w, img.h, r) };
};
/** Ánh xạ từng khúc tuyến tính theo 4 mốc (k tăng dần) — ngoài hai đầu: kéo dài khúc kề. */
function pw(t, K, V) {
  const i = t < K[1] ? 0 : t < K[2] ? 1 : 2;
  return V[i] + ((t - K[i]) * (V[i + 1] - V[i])) / (K[i + 1] - K[i]);
}
/**
 * Phép khớp TỪNG KHÚC mỗi trục (giấy dập co giãn không đều: dải viền ngoài trên giấy thường hẹp / rộng hơn trên đá so với ô
 * chữ — một phép affine không làm trùng cả mép phiến lẫn khung trong): trục x 4 mốc u (khung ngoài trái, viền trong trái / phải,
 * khung ngoài phải) ↔ x; trục y 4 mốc v (đáy viền trong, đáy / đỉnh dải tiêu đề, đỉnh vòm) ↔ y (tăng dần).
 */
function makeMap(m) {
  const vAsc = m.v; // v của các mốc theo y tăng dần (v giảm dần)
  return {
    ...m,
    toX: (u) => pw(u, m.u, m.x),
    toU: (x) => pw(x, m.x, m.u),
    toY: (v) => pw(-v, vAsc.map((t) => -t), m.y),
    toV: (y) => -pw(y, m.y, vAsc.map((t) => -t)),
  };
}
// ───────────────────────── KHOÁ TẠI CHỖ (dải tiêu đề, viền trong, đáy khung, khung ngoài): ảnh XIÊN của mô hình (nét khắc nổi rõ
// nhờ đèn xiên) lọc thông cao ↔ độ phủ nét bản dập lọc thông cao; |NCC| (chữ / dải khắc NỔI thì tô mực tối, khắc CHÌM thì trắng —
// cực đổi theo bia, có khi theo vùng → lấy trị tuyệt đối); dò dời + co giãn trong vùng nhỏ quanh mốc rồi sửa mốc tương ứng.
async function hpModel(M) {
  const R0 = await reliefMap(M);
  const { w, h } = R0;
  const { data } = await sharp(path.join(CACHE, `${M.meta.id}.rake.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 765;
  const r = Math.max(3, Math.round(w / 90));
  const mean = boxBlur(boxBlur(lum, R0.ok, w, h, r), R0.ok, w, h, r);
  const v = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) v[i] = R0.ok[i] ? lum[i] - mean[i] : 0;
  return { v, ok: R0.ok, w, h };
}
async function hpRub(id, W, pxR) {
  const R0 = await rubGray(id, W);
  const r = Math.max(3, Math.round(pxR));
  const mean = boxBlur(boxBlur(R0.v, R0.a, R0.w, R0.h, r), R0.a, R0.w, R0.h, r);
  const v = new Float32Array(R0.v.length);
  for (let i = 0; i < v.length; i++) v[i] = R0.a[i] ? R0.v[i] - mean[i] : 0;
  return { v, a: R0.a, w: R0.w, h: R0.h };
}
/** |NCC| trong hộp (toạ độ bia) với ánh xạ đã dời / co giãn quanh tâm hộp: x' = cx + (x − cx)/sx − dx … */
function lockScore(Mm, Rr, M, map, box, q, st) {
  const rx = M.meta.rect;
  const { w, h } = Mm;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  const pyA = Math.max(0, Math.floor(((rx.y1 - box.y1) / (rx.y1 - rx.y0)) * h)), pyB = Math.min(h, Math.ceil(((rx.y1 - box.y0) / (rx.y1 - rx.y0)) * h));
  const pxA = Math.max(0, Math.floor(((box.x0 - rx.x0) / (rx.x1 - rx.x0)) * w)), pxB = Math.min(w, Math.ceil(((box.x1 - rx.x0) / (rx.x1 - rx.x0)) * w));
  for (let py = pyA; py < pyB; py += st) {
    const y = rx.y1 - ((py + 0.5) / h) * (rx.y1 - rx.y0);
    const yq = cy + (y - cy - q.dy) / q.sy;
    const v = map.toV(yq);
    const ry = v * Rr.h - 0.5;
    const y0 = Math.floor(ry);
    if (y0 < 0 || y0 >= Rr.h - 1) continue;
    const fy = ry - y0;
    for (let px = pxA; px < pxB; px += st) {
      const i = py * w + px;
      if (!Mm.ok[i]) continue;
      const x = rx.x0 + ((px + 0.5) / w) * (rx.x1 - rx.x0);
      const u = map.toU(cx + (x - cx - q.dx) / q.sx);
      const rxp = u * Rr.w - 0.5;
      const x0 = Math.floor(rxp);
      if (x0 < 0 || x0 >= Rr.w - 1) continue;
      const k = y0 * Rr.w + x0;
      if (!Rr.a[k] || !Rr.a[k + 1 + Rr.w]) continue;
      const fx = rxp - x0;
      const b = (Rr.v[k] * (1 - fx) + Rr.v[k + 1] * fx) * (1 - fy) + (Rr.v[k + Rr.w] * (1 - fx) + Rr.v[k + Rr.w + 1] * fx) * fy;
      const a = Mm.v[i];
      n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
    }
  }
  if (n < 200) return 0;
  const va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? Math.abs((sab - (sa * sb) / n) / Math.sqrt(va * vb)) : 0;
}
function lockSearch(Ms, Rs, M, map, box, opt) {
  const { dxR = 0, dyR = 0, sxR = 0, syR = 0 } = opt;
  const grid = (R, st) => (R > 0 ? Array.from({ length: Math.round((2 * R) / st) + 1 }, (_, i) => -R + i * st) : [0]);
  let best = { s: -1, q: { dx: 0, dy: 0, sx: 1, sy: 1 } };
  // thô (ảnh mờ, bước 2 ‰ · 1 %), rồi tinh quanh đỉnh (bước 0,5 ‰ · 0,25 %)
  for (const dx of grid(dxR, 0.002))
    for (const dy of grid(dyR, 0.002))
      for (const ks of grid(sxR, 0.01))
        for (const ky of grid(syR, 0.01)) {
          const q = { dx, dy, sx: 1 + ks, sy: 1 + ky };
          const sc = lockScore(Ms[0], Rs[0], M, map, box, q, 3);
          if (sc > best.s) best = { s: sc, q };
        }
  const c = best.q;
  best = { s: lockScore(Ms[1], Rs[1], M, map, box, c, 2), q: c };
  for (const dx of dxR ? grid(0.002, 0.0005).map((t) => c.dx + t) : [0])
    for (const dy of dyR ? grid(0.002, 0.0005).map((t) => c.dy + t) : [0])
      for (const sx of sxR ? grid(0.01, 0.0025).map((t) => c.sx + t) : [1])
        for (const sy of syR ? grid(0.01, 0.0025).map((t) => c.sy + t) : [1]) {
          const q = { dx, dy, sx, sy };
          const sc = lockScore(Ms[1], Rs[1], M, map, box, q, 2);
          if (sc > best.s) best = { s: sc, q };
        }
  return best;
}
// ───────────────────────── KHỚP THEO ĐƯỜNG KHUNG: mỗi đường khung (viền trong trái / phải, đáy viền trong, đáy / đỉnh dải tiêu đề,
// khung ngoài trái / phải) — profile 1 chiều cắt ngang đường (trung bình dọc theo đường, ảnh xiên lọc thông cao ↔ độ phủ nét
// lọc thông cao), so |đạo hàm| của profile (không phụ thuộc cực: rãnh tối trên đá có thể là vạch trắng / đen trên giấy) → dời
// mốc tương ứng. Hai vòng: thô ±20 ‰, tinh ±5 ‰.
function lineProbe(Mm, Rr, M, map, axis, c, a0, a1, SH, STEP, W = 0.025) {
  const rx = M.meta.rect;
  const { w, h } = Mm;
  const PX = (x) => ((x - rx.x0) / (rx.x1 - rx.x0)) * w - 0.5;
  const PY = (y) => ((rx.y1 - y) / (rx.y1 - rx.y0)) * h - 0.5;
  const X = (px) => rx.x0 + ((px + 0.5) / w) * (rx.x1 - rx.x0);
  const Y = (py) => rx.y1 - ((py + 0.5) / h) * (rx.y1 - rx.y0);
  const rub = (x, y) => {
    const fx = map.toU(x) * Rr.w - 0.5, fy = map.toV(y) * Rr.h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 >= Rr.w - 1 || y0 >= Rr.h - 1) return NaN;
    const k = y0 * Rr.w + x0;
    if (!Rr.a[k] || !Rr.a[k + Rr.w + 1]) return NaN;
    const tx = fx - x0, ty = fy - y0;
    return (Rr.v[k] * (1 - tx) + Rr.v[k + 1] * tx) * (1 - ty) + (Rr.v[k + Rr.w] * (1 - tx) + Rr.v[k + Rr.w + 1] * tx) * ty;
  };
  const der = (p) => p.map((_, i) => (i > 0 && i < p.length - 1 && Number.isFinite(p[i - 1]) && Number.isFinite(p[i + 1]) ? Math.abs(p[i + 1] - p[i - 1]) : NaN));
  const ncc = (a, b) => {
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < a.length; i++) {
      if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) continue;
      n++; sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i];
    }
    if (n < 10) return -1;
    const va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
    return va > 0 && vb > 0 ? (sab - (sa * sb) / n) / Math.sqrt(va * vb) : -1;
  };
  // trục cắt ngang (q) và dọc theo đường (t), theo điểm ảnh mô hình
  const vert = axis === 'x';
  const qA = vert ? Math.max(1, Math.round(PX(c - W))) : Math.max(1, Math.round(PY(c + W)));
  const qB = vert ? Math.min(w - 2, Math.round(PX(c + W))) : Math.min(h - 2, Math.round(PY(c - W)));
  const tA = vert ? Math.max(0, Math.round(PY(a1))) : Math.max(0, Math.round(PX(a0)));
  const tB = vert ? Math.min(h - 1, Math.round(PY(a0))) : Math.min(w - 1, Math.round(PX(a1)));
  const pm = [];
  for (let q = qA; q <= qB; q++) {
    let t = 0, n = 0;
    for (let s = tA; s <= tB; s += 2) {
      const i = vert ? s * w + q : q * w + s;
      if (Mm.ok[i]) { t += Mm.v[i]; n++; }
    }
    pm.push(n > 8 ? t / n : NaN);
  }
  const gm = der(pm);
  const res = [];
  for (let d = -SH; d <= SH + 1e-9; d += STEP) {
    const pr = [];
    for (let q = qA; q <= qB; q++) {
      let t = 0, n = 0;
      for (let s = tA; s <= tB; s += 3) {
        const v = vert ? rub(X(q) - d, Y(s)) : rub(X(s), Y(q) - d);
        if (Number.isFinite(v)) { t += v; n++; }
      }
      pr.push(n > 5 ? t / n : NaN);
    }
    res.push({ d, s: ncc(gm, der(pr)) });
  }
  let best = res[0];
  for (const r of res) if (r.s > best.s) best = r;
  // đỉnh thứ hai (cách ≥ 3 ‰) — đo độ chắc
  let second = -1;
  for (const r of res) if (Math.abs(r.d - best.d) >= 0.003 && r.s > second) second = r.s;
  return { d: +best.d.toFixed(4), s: +best.s.toFixed(3), s2: +second.toFixed(3), edge: Math.abs(best.d) >= SH - 1e-9 };
}
/**
 * KHỚP LAI: (1) trục y theo các đường ngang dài — đáy viền trong, đáy / đỉnh dải tiêu đề (profile 1 chiều — lineProbe);
 * (2) trục x theo CHỮ dải tiêu đề (|NCC| ảnh xiên ↔ bản dập trong hộp dải, dời + co giãn quanh tâm) — chữ tiêu đề lớn, nét rõ
 * trên cả hai; đường dọc viền trong trên mô hình hay lẫn với mép lòng chữ lõm bên trong (face-fields x0 / x1) nên chỉ dùng đo;
 * (3) khúc viền ngoài giữ tỉ lệ theo khúc giữa.
 */
/** Tín hiệu khớp: ảnh xiên lọc thông cao (mô hình) ↔ bản dập lọc thông cao, cùng cỡ điểm ảnh (theo khúc giữa của m0). */
async function signalsOf(M, m0) {
  const M0 = await hpModel(M);
  const pxPerUnit = M0.w / (M.meta.rect.x1 - M.meta.rect.x0);
  const rw = ((m0.x[2] - m0.x[1]) / (m0.u[2] - m0.u[1])) * pxPerUnit;
  const R0 = await hpRub(M.meta.id, rw, Math.max(3, Math.round(M0.w / 90)));
  const Mm = blur2(M0, 1), Rr = blur2(R0, 1);
  return { Mm, Rr, Ms: [blur2(M0, 2), Mm], Rs: [blur2(R0, 2), Rr] };
}
const headBoxOf = (lm, map) => {
  const ib = lm.inner_border, hb = lm.header_band;
  const yT = map.toY(hb.top), yB = map.toY(hb.bottom);
  const pad = 0.05 * (yT - yB);
  return { x0: map.toX(ib.left) + 0.01, x1: map.toX(ib.right) - 0.01, y0: yB + pad, y1: yT - pad };
};
/**
 * ĐO sau khớp (không sửa) — phần dư căn chỉnh: dời còn lại của từng đường (đáy viền trong, đáy / đỉnh dải tiêu đề, viền trong
 * trái / phải; profile ±8 ‰, chỉ tính khi đỉnh tương quan ≥ 0,45 và không chạm biên) và của chữ dải tiêu đề (dời x ở hai đầu dải
 * = |dx| + |sx − 1|·nửa bề ngang, dời y). Đơn vị bia (bia cao ≈ 1).
 */
function measureFit(M, lm, map, S) {
  const { Mm, Rr, Ms, Rs } = S;
  const ib = lm.inner_border, hb = lm.header_band;
  const SH = 0.008, ST = 0.00025;
  const yIb = map.toY(ib.bottom), yHb = map.toY(hb.bottom), yHt = map.toY(hb.top);
  const xIl = map.toX(ib.left), xIr = map.toX(ib.right);
  const L = {
    'đáy viền trong': lineProbe(Mm, Rr, M, map, 'y', yIb, xIl + 0.03, xIr - 0.03, SH, ST),
    'đáy dải tiêu đề': lineProbe(Mm, Rr, M, map, 'y', yHb, xIl + 0.03, xIr - 0.03, SH, ST),
    'đỉnh dải tiêu đề': lineProbe(Mm, Rr, M, map, 'y', yHt, xIl + 0.03, xIr - 0.03, SH, ST),
    'viền trong trái': lineProbe(Mm, Rr, M, map, 'x', xIl, yIb + 0.03, yHb - 0.03, SH, ST),
    'viền trong phải': lineProbe(Mm, Rr, M, map, 'x', xIr, yIb + 0.03, yHb - 0.03, SH, ST),
  };
  const box = headBoxOf(lm, map);
  const h = lockSearch(Ms, Rs, M, map, box, { dxR: 0.006, sxR: 0.02, dyR: 0.006 });
  const half = (box.x1 - box.x0) / 2;
  const loc = Object.entries(L).map(([k, p]) => ({ k, axis: k.startsWith('viền trong ') ? 'x' : 'y', d: Math.abs(p.d), dSigned: p.d, s: p.s, weak: p.s < 0.45 || p.edge }));
  // đỉnh ở biên vùng dò thô (± 6 ‰ · ± 2 %) = không có đỉnh trong cửa sổ → yếu (như đỉnh tương quan thấp)
  const rim = Math.abs(h.q.dx) > 0.0065 || Math.abs(h.q.dy) > 0.0065 || Math.abs(h.q.sx - 1) > 0.0215;
  const weakH = h.s < 0.15 || rim;
  loc.push({ k: 'chữ tiêu đề x', axis: 'x', d: +(Math.abs(h.q.dx) + Math.abs(h.q.sx - 1) * half).toFixed(4), dSigned: h.q.dx, sx: h.q.sx, s: +h.s.toFixed(3), weak: weakH });
  loc.push({ k: 'chữ tiêu đề y', axis: 'y', d: +Math.abs(h.q.dy).toFixed(4), dSigned: h.q.dy, s: +h.s.toFixed(3), weak: weakH });
  return loc;
}
async function hybridFit(M, lm, m0, slab, mode = 'chữ', S0 = null) {
  const S = S0 ?? (await signalsOf(M, m0));
  const { Mm, Rr, Ms, Rs } = S;
  const ib = lm.inner_border, hb = lm.header_band;
  const m = { u: m0.u, v: m0.v, x: [...m0.x], y: [...m0.y] };
  const log = [];
  const OK = 0.45;
  const ok = (p) => p.s >= OK && !p.edge;
  const probesY = (map, SH, STEP) => {
    const yIb = map.toY(ib.bottom), yHb = map.toY(hb.bottom), yHt = map.toY(hb.top);
    const xIl = map.toX(ib.left), xIr = map.toX(ib.right);
    return {
      ib: lineProbe(Mm, Rr, M, map, 'y', yIb, xIl + 0.03, xIr - 0.03, SH, STEP),
      hb: lineProbe(Mm, Rr, M, map, 'y', yHb, xIl + 0.03, xIr - 0.03, SH, STEP),
      ht: lineProbe(Mm, Rr, M, map, 'y', yHt, xIl + 0.03, xIr - 0.03, SH, STEP),
    };
  };
  const yPass = (SH, STEP, SHb = SH) => {
    const map = makeMap(m);
    const yIb = map.toY(ib.bottom);
    const P = probesY(map, SH, STEP);
    if (SHb !== SH) P.ib = lineProbe(Mm, Rr, M, map, 'y', yIb, map.toX(ib.left) + 0.03, map.toX(ib.right) - 0.03, SHb, STEP);
    log.push({ k: `y±${SH * 1000}`, P });
    // mốc y: [đáy viền trong, đáy dải tiêu đề, đỉnh dải tiêu đề, đỉnh vòm — giữ theo bóng phiến]
    const y1 = m.y[1];
    if (ok(P.hb)) m.y[1] += P.hb.d;
    m.y[2] += ok(P.ht) ? P.ht.d : m.y[1] - y1;
    if (ok(P.ib)) m.y[0] += P.ib.d;
  };
  const headBox = (map) => headBoxOf(lm, map);
  // khúc viền ngoài: cùng tỉ lệ khúc giữa, không vượt mép phiến
  const outer = () => {
    const sx = (m.x[2] - m.x[1]) / (m.u[2] - m.u[1]);
    m.x[0] = Math.max(slab.L, m.x[1] - (m.u[1] - m.u[0]) * sx);
    m.x[3] = Math.min(slab.R, m.x[2] + (m.u[3] - m.u[2]) * sx);
  };
  // khoá CHỮ dải tiêu đề (2 chiều: dời x + co giãn x + dời y) — y áp cho cả bản dập ('all') hoặc không ('none')
  const xyPass = (dxR, sxR, dyR, applyY) => {
    const map = makeMap(m);
    const box = headBox(map);
    const r = lockSearch(Ms, Rs, M, map, box, { dxR, sxR, dyR });
    // đỉnh ở biên vùng dò hoặc tương quan quá yếu → không tin (giữ nguyên)
    const rim = Math.abs(r.q.dx) >= dxR - 0.0005 || (sxR > 0 && Math.abs(r.q.sx - 1) >= sxR - 0.0025) || (dyR > 0 && Math.abs(r.q.dy) >= dyR - 0.0005);
    if (rim || r.s < 0.15) {
      log.push({ k: 'chữ tiêu đề', P: { dx: r.q.dx, sx: r.q.sx, dy: r.q.dy, s: r.s, skip: true } });
      return r;
    }
    const cx = (box.x0 + box.x1) / 2;
    m.x[1] = cx + (m.x[1] - cx) * r.q.sx + r.q.dx;
    m.x[2] = cx + (m.x[2] - cx) * r.q.sx + r.q.dx;
    outer();
    if (applyY === 'all') m.y = m.y.map((t, i) => (i < 3 ? t + r.q.dy : t)); // (đỉnh vòm theo bóng phiến — không dời)
    log.push({ k: 'chữ tiêu đề', P: { dx: r.q.dx, sx: r.q.sx, dy: r.q.dy, s: r.s } });
    return r;
  };
  let r;
  if (mode === 'chữ') {
    // 1) chữ tiêu đề, thô (± 3 % ngang, ± 12 % co giãn, ± 2 % dọc) — đặt đúng "lòng chảo" trước khi bắt đường (khung đôi / dải
    //    tối sát dải tiêu đề làm profile đường bắt nhầm sang đường kề nếu xuất phát lệch)
    xyPass(0.03, 0.12, 0.02, 'all');
    // 2) đường ngang: dải tiêu đề ± 4 ‰ (đã gần), đáy viền trong ± 10 ‰ (giấy có thể co riêng thân bia)
    yPass(0.004, 0.00025, 0.01);
    // 3) chữ tiêu đề, tinh (chỉ x)
    r = xyPass(0.006, 0.02, 0, 'none');
    yPass(0.003, 0.00025);
  } else if (mode === 'đường') {
    // đường ngang trước (± 20 ‰), rồi chữ tiêu đề theo x
    yPass(0.02, 0.0005);
    xyPass(0.03, 0.08, 0, 'none');
    yPass(0.006, 0.00025);
    r = xyPass(0.006, 0.02, 0, 'none');
  } else {
    // 'khung': đường ngang + đường dọc viền trong (đo trên các hàng của dải tiêu đề — mép hộp dải rõ nhất)
    for (const [SH, ST] of [[0.02, 0.0005], [0.006, 0.00025]]) {
      yPass(SH, ST);
      const map = makeMap(m);
      const yT = map.toY(hb.top), yB = map.toY(hb.bottom);
      const pl = lineProbe(Mm, Rr, M, map, 'x', map.toX(ib.left), yB, yT, SH, ST);
      const pr = lineProbe(Mm, Rr, M, map, 'x', map.toX(ib.right), yB, yT, SH, ST);
      if (ok(pl)) m.x[1] += pl.d;
      if (ok(pr)) m.x[2] += pr.d;
      outer();
      log.push({ k: `x±${SH * 1000}`, P: { il: pl, ir: pr } });
    }
    r = { s: 0 };
  }
  return { m, log, S, headS: r.s };
}

/**
 * r84 (người dùng: bản dập phải nằm TRÊN MẶT BIA như một texture — không chiếu lan sang hình khác): MẶT PHẲNG MẶT BIA đo từ ảnh độ
 * sâu (toạ độ bia): z = z0 + kx·x + ky·y, khớp bình phương tối thiểu bền (loại |dư| > 3 × MAD, 3 vòng) trên các điểm trong khung mặt
 * (chữ nhật + vòm elip, lùi 1,5 % vào trong), lớp trước (zFront − 0,08 … + 0,04), ngoài khối cầu đầu rùa × 1,15. back / front = dải
 * lệch của mặt đá thật quanh mặt phẳng đó (phân vị 0,5 / 99,5 % + lề 4 mm; kẹp 0,008–0,05 / 0,004–0,02) — shader chỉ cho bản dập /
 * vệt / chữ trong dải này (mép mềm). head: đầu rùa có chồng lên mặt bia (nhìn chính diện) không.
 */
async function facePlane(M, frame) {
  const { data, info } = await sharp(path.join(CACHE, `${M.meta.id}.depth.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const { rect } = M.meta;
  const { zLo, zHi } = M.meta.depth;
  const zF = M.meta.bounds.zFront;
  const hd = M.meta.head;
  const ins = 0.015 * (frame.right - frame.left);
  const cx = (frame.left + frame.right) / 2, ax = (frame.right - frame.left) / 2 - ins;
  const inFace = (x, y) => {
    if (x < frame.left + ins || x > frame.right - ins || y < frame.bottom + ins || y > frame.top - ins) return false;
    if (y > frame.spring) {
      const ex = (x - cx) / ax, ey = (y - frame.spring) / Math.max(1e-4, frame.top - ins - frame.spring);
      if (ex * ex + ey * ey > 1) return false;
    }
    return true;
  };
  const pts = [];
  for (let py = 0; py < h; py += 2)
    for (let px = 0; px < w; px += 2) {
      const i = (py * w + px) * 3;
      if (!data[i] && !data[i + 1]) continue;
      const x = rect.x0 + ((px + 0.5) / w) * (rect.x1 - rect.x0);
      const y = rect.y1 - ((py + 0.5) / h) * (rect.y1 - rect.y0);
      if (!inFace(x, y)) continue;
      const z = zLo + ((data[i] + data[i + 1] / 255) / 255) * (zHi - zLo);
      if (z < zF - 0.08 || z > zF + 0.04) continue;
      if (hd?.c && hd.r > 0 && Math.hypot(x - hd.c[0], y - hd.c[1], z - hd.c[2]) < hd.r * 1.15) continue;
      pts.push([x, y, z]);
    }
  let use = pts;
  let P = { z0: zF, kx: 0, ky: 0 };
  for (let it = 0; it < 3 && use.length > 50; it++) {
    // bình phương tối thiểu 3 ẩn (z = z0 + kx·x + ky·y)
    let n = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    for (const [x, y, z] of use) { n++; sx += x; sy += y; sz += z; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; }
    const A = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]];
    const b = [sz, sxz, syz];
    const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det3(A);
    if (Math.abs(D) < 1e-12) break;
    const col = (k) => A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)));
    P = { z0: det3(col(0)) / D, kx: det3(col(1)) / D, ky: det3(col(2)) / D };
    const res = use.map(([x, y, z]) => z - (P.z0 + P.kx * x + P.ky * y));
    const med = median(res);
    const mad = median(res.map((r) => Math.abs(r - med))) || 1e-4;
    use = use.filter((_, i) => Math.abs(res[i] - med) <= 3 * 1.4826 * mad + 0.002);
  }
  const res = pts.map(([x, y, z]) => z - (P.z0 + P.kx * x + P.ky * y)).sort((a, b) => a - b);
  const q = (k) => res[Math.min(res.length - 1, Math.max(0, Math.floor(res.length * k)))] ?? 0;
  const back = Math.min(0.05, Math.max(0.008, -q(0.005) + 0.004));
  const front = Math.min(0.02, Math.max(0.004, q(0.995) + 0.004));
  // đầu rùa chồng lên mặt bia (nhìn chính diện): khối cầu đầu (× 1,15) cắt hình chữ nhật mặt
  const head = !!(hd?.c && hd.r > 0 && hd.c[1] + hd.r * 1.15 > frame.bottom && hd.c[0] + hd.r > frame.left && hd.c[0] - hd.r < frame.right);
  return { z0: +P.z0.toFixed(5), kx: +P.kx.toFixed(5), ky: +P.ky.toFixed(5), back: +back.toFixed(4), front: +front.toFixed(4), n: pts.length, p005: +q(0.005).toFixed(4), p995: +q(0.995).toFixed(4), head };
}

/** Khớp một bia → { map (từng khúc), fit (affine gần đúng), frame, resid, … }. */
async function fitOne(id, ovr) {
  const lmAll = JSON.parse(fs.readFileSync(path.join(SRC, `${id}.json`), 'utf8'));
  const lm = lmAll.landmarks_normalized;
  const img = [lmAll.output_size.width, lmAll.output_size.height];
  const M = await modelOutline(id);
  const ff = faceFieldOf(id);
  const B = M.meta.bounds;
  const flags = [...(lmAll.flags ?? [])];
  const of = lm.outer_frame, ib = lm.inner_border, hb = lm.header_band;
  const prof = of.arch_profile_y ?? [];
  const apexV = Math.min(...(prof.length ? prof : [of.arch_apex[1]]));
  // ── mép phiến ở giữa thân (bóng trực giao) → trục x ban đầu (khung ngoài ↔ mép phiến)
  const yA = ff ? ff.frameBottom + 0.35 * (ff.band - ff.frameBottom) : B.bandBottom + 0.3;
  const yB = ff ? ff.frameBottom + 0.75 * (ff.band - ff.frameBottom) : B.bandBottom + 0.5;
  const rowsL = [], rowsR = [];
  for (let py = Math.round(M.PY(yB)); py <= Math.round(M.PY(yA)); py++) {
    if (Number.isFinite(M.L[py])) rowsL.push(M.L[py]);
    if (Number.isFinite(M.R[py])) rowsR.push(M.R[py]);
  }
  const slabL = median(rowsL), slabR = median(rowsR);
  const bx = (slabR - slabL) / (of.right - of.left);
  const ax = slabL - bx * of.left;
  // trục y ban đầu: đáy dải tiêu đề ↔ face-fields band, đỉnh vòm ↔ đỉnh bóng phiến (giữa), đáy viền trong ↔ frameBottom
  const ys = [];
  const topMid = M.top[Math.round(M.PX(ax + bx * 0.5))];
  if (Number.isFinite(topMid)) ys.push({ x: apexV, y: topMid, w: 1 });
  if (ff && !ff.flags?.includes('no-band')) ys.push({ x: hb.bottom, y: ff.band, w: 1 });
  if (ff && !ff.flags?.includes('no-frame-bottom')) ys.push({ x: ib.bottom, y: ff.frameBottom, w: 0.5 });
  const fy = ys.length >= 2 ? wls(ys) : { a: B.yMax + bx * apexV, b: -bx };
  const toX0 = (u) => ax + bx * u;
  const toY0 = (v) => fy.a + fy.b * v;
  const U = [of.left, ib.left, ib.right, of.right];
  // y: đáy viền trong, đáy + ĐỈNH dải tiêu đề (hai đường khung của dải trùng nhau độc lập), đỉnh vòm (bóng phiến); chân khung ngoài
  // kéo dài theo khúc dưới. (Đỉnh dải là mốc riêng — co giãn qua đỉnh vòm thì sửa 1 ‰ ở đỉnh dải làm vòm lệch ~5 ‰.)
  const V = [ib.bottom, hb.bottom, hb.top, apexV]; // y tăng dần ↔ v giảm dần
  const init = { tag: 'mép', u: U, v: V, x: U.map(toX0), y: V.map(toY0) };
  // mốc ĐO trực tiếp (nội suy đúng qua các đo của mô hình): x — mép phiến / face-fields x0, x1 / mép phiến; y — đáy viền trong ↔
  // frameBottom, đáy dải tiêu đề ↔ band, đỉnh dải ↔ band + bề cao dải theo tỉ lệ khúc giữa, đỉnh vòm ↔ đỉnh bóng phiến
  let measured = null;
  if (ff && Number.isFinite(ff.x0) && Number.isFinite(ff.band) && Number.isFinite(ff.frameBottom) && Number.isFinite(topMid)) {
    const sMid = (ff.band - ff.frameBottom) / (hb.bottom - ib.bottom); // âm (v tăng → y giảm)
    measured = { tag: 'đo', u: U, v: V, x: [slabL, ff.x0, ff.x1, slabR], y: [ff.frameBottom, ff.band, ff.band + sMid * (hb.top - hb.bottom), topMid] };
  }
  // xuất phát: mốc đo (mặc định) — sửa tay start: 'mép' hoặc thiếu đo → mép phiến
  const start = ovr?.start === 'mép' || !measured ? init : measured;
  let m = start;
  let ncc = null;
  let S = null;
  // --from-generated: lấy ánh xạ đã ghi (không khớp lại) — chỉ dựng ảnh duyệt / tính lại phần dư
  const prev = argv.includes('--from-generated') && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).steles?.[id] : null;
  if (prev?.map) {
    m = { tag: 'đã ghi', u: prev.map.u, v: prev.map.v, x: prev.map.x, y: prev.map.y };
    ovr = null; // (đã gồm sửa tay)
    if (prev.resid?.by) ncc = { pick: prev.resid.by };
  } else if (!ovr?.noRefine && !argv.includes('--landmarks-only')) {
    // NHIỀU ỨNG VIÊN (chữ trước / đường trước / khung) → chọn bản được nhiều phép đo độc lập đồng thuận nhất (đường ngang, đường
    // dọc viền trong, chữ dải tiêu đề: |dư| ≤ 2,5 ‰ → 1 điểm, ≤ 4 ‰ → ½; chỉ đo có đỉnh tương quan chắc), hoà thì RMS nhỏ hơn
    S = await signalsOf(M, start);
    const modes = ovr?.mode ? [ovr.mode] : ['chữ', 'đường', 'khung'];
    const cands = [];
    for (const mode of modes) {
      const hf = await hybridFit(M, lm, start, { L: slabL, R: slabR }, mode, S);
      cands.push({ tag: mode, m: hf.m, log: hf.log });
    }
    const old = REF?.[id]?.map;
    if (old && !ovr?.mode) {
      // đổi sang bộ mốc hiện tại: giá trị của ánh xạ cũ tại các mốc mới (x: cùng u; y: tại v mới)
      const om = makeMap(old);
      cands.push({ tag: 'cũ', m: { u: start.u, v: start.v, x: start.u.map(om.toX), y: start.v.map(om.toY) }, log: [] });
    }
    for (const c of cands) {
      const loc = measureFit(M, lm, makeMap(c.m), S);
      const good = loc.filter((l) => !l.weak);
      c.agree = good.reduce((t, l) => t + (l.d <= 0.0025 ? 1 : l.d <= 0.004 ? 0.5 : 0), 0);
      c.rms = Math.sqrt(good.reduce((t, l) => t + l.d * l.d, 0) / Math.max(1, good.length));
      c.loc = loc;
    }
    cands.sort((a, b) => b.agree - a.agree || a.rms - b.rms);
    m = cands[0].m;
    ncc = { from: start.tag, pick: cands[0].tag, cands: cands.map((c) => ({ tag: c.tag, agree: c.agree, rms: +(c.rms * 1000).toFixed(2), map: c.m, loc: c.loc.map((l) => ({ k: l.k, d: l.dSigned, weak: l.weak })) })), hybrid: cands[0].log };
  }
  // ── HOÀN THIỆN (mặc định — tắt: --no-polish): đo lại; đường ngang / chữ tiêu đề còn lệch CHẮC (đỉnh tương quan đủ, không ở biên)
  //    > 1 ‰ → dời mốc tương ứng (đáy viền trong / đáy dải / đỉnh dải — đỉnh dải theo đáy dải nếu không đo chắc; chữ tiêu đề → dời +
  //    co giãn x); nhận nếu số phép đo đồng thuận không giảm và RMS giảm. Tối đa 2 vòng.
  if (!argv.includes('--no-polish') && !ovr?.noRefine && !argv.includes('--landmarks-only')) {
    S ??= await signalsOf(M, m);
    const scoreOf = (loc) => {
      const g = loc.filter((l) => !l.weak && !l.k.startsWith('viền trong '));
      return { agree: g.reduce((t, l) => t + (l.d <= 0.0025 ? 1 : l.d <= 0.004 ? 0.5 : 0), 0), rms: Math.sqrt(g.reduce((t, l) => t + l.d * l.d, 0) / Math.max(1, g.length)) };
    };
    let loc = measureFit(M, lm, makeMap(m), S);
    let sc = scoreOf(loc);
    const pol = [];
    for (let it = 0; it < 2; it++) {
      const L = Object.fromEntries(loc.map((l) => [l.k, l]));
      const use = (k) => L[k] && !L[k].weak && L[k].d > 0.001;
      const n = { u: m.u, v: m.v, x: [...m.x], y: [...m.y] };
      const map0 = makeMap(m);
      if (use('đáy viền trong')) n.y[0] += L['đáy viền trong'].dSigned;
      if (use('đáy dải tiêu đề')) n.y[1] += L['đáy dải tiêu đề'].dSigned;
      n.y[2] += use('đỉnh dải tiêu đề') ? L['đỉnh dải tiêu đề'].dSigned : n.y[1] - m.y[1];
      if (use('chữ tiêu đề x')) {
        const box = headBoxOf(lm, map0);
        const cx = (box.x0 + box.x1) / 2, q = L['chữ tiêu đề x'];
        n.x = n.x.map((t) => cx + (t - cx) * q.sx + q.dSigned);
      }
      if (n.x.every((t, i) => t === m.x[i]) && n.y.every((t, i) => t === m.y[i])) break;
      const loc2 = measureFit(M, lm, makeMap(n), S);
      const sc2 = scoreOf(loc2);
      pol.push({ it, agree: [sc.agree, sc2.agree], rms: [+(sc.rms * 1000).toFixed(2), +(sc2.rms * 1000).toFixed(2)] });
      if (sc2.agree >= sc.agree && sc2.rms < sc.rms - 1e-5) {
        m = n;
        loc = loc2;
        sc = sc2;
      } else break;
    }
    if (pol.length) ncc = { ...(ncc ?? {}), polish: pol };
  }
  // ── sửa tay: dời (đơn vị bia) cả trục / mốc riêng
  if (ovr?.dx) m = { ...m, x: m.x.map((t) => t + ovr.dx) };
  if (ovr?.dy) m = { ...m, y: m.y.map((t) => t + ovr.dy) };
  if (ovr?.x) m = { ...m, x: m.x.map((t, k) => t + (ovr.x[k] ?? 0)) };
  if (ovr?.y) m = { ...m, y: m.y.map((t, k) => t + (ovr.y[k] ?? 0)) };
  const map = makeMap(m);
  // ── phần dư căn chỉnh tại chỗ (ảnh xiên ↔ bản dập — measureFit)
  S ??= await signalsOf(M, m);
  const loc = measureFit(M, lm, map, S);
  // phần dư = đường ngang (đáy viền trong, đáy / đỉnh dải tiêu đề) + chữ dải tiêu đề (x hai đầu, y); đường DỌC viền trong chỉ ghi
  // tham khảo (cửa sổ profile lẫn dải hoa văn viền → đo không ổn định; trục x đã được chữ tiêu đề kiểm)
  const good = loc.filter((r) => !r.weak && !r.k.startsWith('viền trong '));
  const resid = {
    max: +Math.max(0, ...good.map((r) => r.d)).toFixed(4),
    rms: +Math.sqrt(good.reduce((t, r) => t + r.d * r.d, 0) / Math.max(1, good.length)).toFixed(4),
    n: good.length,
    ...(ncc?.pick ? { by: ncc.pick } : {}),
  };
  // đối chiếu (không dùng để khớp): mốc bản dập sau khớp − đo của face-fields
  const ffCheck = ff ? { x0: +(map.toX(ib.left) - ff.x0).toFixed(4), x1: +(map.toX(ib.right) - ff.x1).toFixed(4), band: +(map.toY(hb.bottom) - ff.band).toFixed(4), frameBottom: +(map.toY(ib.bottom) - ff.frameBottom).toFixed(4) } : null;
  const springV = Math.min(of.spring_y_left ?? of.spring_y, of.spring_y_right ?? of.spring_y, of.spring_y);
  const frame = { left: +map.toX(of.left).toFixed(4), right: +map.toX(of.right).toFixed(4), bottom: +map.toY(of.bottom).toFixed(4), spring: +map.toY(springV).toFixed(4), top: +map.toY(apexV).toFixed(4) };
  // affine gần đúng (khúc giữa) — cho mã còn dùng phép khớp tuyến tính
  const sx = (m.x[2] - m.x[1]) / (m.u[2] - m.u[1]);
  const syv = (m.y[2] - m.y[1]) / (m.v[2] - m.v[1]); // âm
  const fit = { u0: 0, v0: 0, x0: +(m.x[1] - sx * m.u[1]).toFixed(5), y0: +(m.y[1] - syv * m.v[1]).toFixed(5), sx: +sx.toFixed(5), sy: +(-syv).toFixed(5) };
  const r4 = (a) => a.map((t) => +t.toFixed(5));
  const plane = await facePlane(M, frame);
  return { id, img, map: { u: r4(m.u), x: r4(m.x), v: r4(m.v), y: r4(m.y) }, fit, frame, plane, resid, loc, ffCheck, ncc, flags, ff, M, lm, toX: map.toX, toY: map.toY, toU: map.toU, toV: map.toV, slab: { L: slabL, R: slabR } };
}

async function sheet(results) {
  fs.mkdirSync(SHEET, { recursive: true });
  const CW = 420;
  const cells = [];
  for (const r of results) {
    const { M, lm, toX, toY } = r;
    const W = M.w;
    const H = M.h;
    const k = CW / W;
    const CH = Math.round(H * k);
    const base = await sharp(path.join(CACHE, `${r.id}.rake.png`)).resize(CW, CH).removeAlpha().toBuffer();
    // bản dập: độ phủ nét (R) → màu cam, alpha theo nét × mặt nạ; lấy mẫu từng điểm ảnh qua phép khớp từng khúc
    const { data: rd, info: ri } = await sharp(path.join(SRC, `${r.id}.webp`)).resize(900).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ov = Buffer.alloc(CW * CH * 4);
    const rxm = M.meta.rect;
    // r84: như shader của app — chỉ lớp MẶT TRƯỚC (cửa sổ độ sâu quanh mặt phẳng trước) và ngoài khối cầu đầu rùa (đầu rùa nhô trước
    // chân mặt bia không nhận bản dập)
    const { data: dd, info: di } = await sharp(path.join(CACHE, `${r.id}.depth.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { zLo, zHi } = M.meta.depth;
    const zF = M.meta.bounds.zFront;
    const hd = M.meta.head;
    const onFace = (px, py) => {
      const qx = Math.min(di.width - 1, Math.floor((px / CW) * di.width));
      const qy = Math.min(di.height - 1, Math.floor((py / CH) * di.height));
      const i = (qy * di.width + qx) * 3;
      if (!dd[i] && !dd[i + 1]) return false;
      const z = zLo + ((dd[i] + dd[i + 1] / 255) / 255) * (zHi - zLo);
      if (z < zF - 0.055 || z > zF + 0.024) return false;
      if (hd?.c && hd.r > 0) {
        const x = rxm.x0 + ((px + 0.5) / CW) * (rxm.x1 - rxm.x0);
        const y = rxm.y1 - ((py + 0.5) / CH) * (rxm.y1 - rxm.y0);
        if (Math.hypot(x - hd.c[0], y - hd.c[1], z - hd.c[2]) < hd.r * 1.1) return false;
      }
      return true;
    };
    for (let py = 0; py < CH; py++) {
      const v = r.toV(rxm.y1 - ((py + 0.5) / CH) * (rxm.y1 - rxm.y0));
      if (v < 0 || v >= 1) continue;
      for (let px = 0; px < CW; px++) {
        const u = r.toU(rxm.x0 + ((px + 0.5) / CW) * (rxm.x1 - rxm.x0));
        if (u < 0 || u >= 1 || !onFace(px, py)) continue;
        const k = (Math.floor(v * ri.height) * ri.width + Math.floor(u * ri.width)) * 4;
        const st = Math.min(1, Math.max(0, (rd[k] / 255 - 0.52) / 0.25));
        const a = rd[k + 3] / 255;
        const o = (py * CW + px) * 4;
        ov[o] = 255;
        ov[o + 1] = Math.round(120 + 100 * st);
        ov[o + 2] = Math.round(40 + 60 * st);
        ov[o + 3] = Math.round(255 * a * (0.15 + 0.55 * st));
      }
    }
    const ovPng = await sharp(ov, { raw: { width: CW, height: CH, channels: 4 } }).png().toBuffer();
    // đường mốc: mô hình (xanh lơ) · bản dập sau khớp (đỏ)
    const X = (x) => ((x - M.meta.rect.x0) / (M.meta.rect.x1 - M.meta.rect.x0)) * CW;
    const Y = (y) => ((M.meta.rect.y1 - y) / (M.meta.rect.y1 - M.meta.rect.y0)) * CH;
    const hl = (y, c, d = '') => `<line x1="0" x2="${CW}" y1="${Y(y).toFixed(1)}" y2="${Y(y).toFixed(1)}" stroke="${c}" stroke-width="1.2" ${d ? `stroke-dasharray="${d}"` : ''}/>`;
    const vl = (x, c, d = '') => `<line y1="0" y2="${CH}" x1="${X(x).toFixed(1)}" x2="${X(x).toFixed(1)}" stroke="${c}" stroke-width="1.2" ${d ? `stroke-dasharray="${d}"` : ''}/>`;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">`;
    const ff = r.ff;
    if (ff) {
      svg += hl(ff.band, '#33e0ff') + hl(ff.frameBottom, '#33e0ff') + vl(ff.x0, '#33e0ff') + vl(ff.x1, '#33e0ff');
    }
    svg += vl(r.slab.L, '#33e0ff', '4 3') + vl(r.slab.R, '#33e0ff', '4 3');
    svg += hl(toY(lm.header_band.bottom), '#ff3355', '6 4') + hl(toY(lm.inner_border.bottom), '#ff3355', '6 4') + vl(toX(lm.inner_border.left), '#ff3355', '6 4') + vl(toX(lm.inner_border.right), '#ff3355', '6 4');
    // vòm: profile bản dập (đỏ) + đỉnh mô hình (xanh)
    const prof = lm.outer_frame.arch_profile_y ?? [];
    const of = lm.outer_frame;
    svg += `<polyline fill="none" stroke="#ff3355" stroke-width="1.2" points="${prof.map((v, i) => `${X(toX(of.left + ((of.right - of.left) * i) / (prof.length - 1))).toFixed(1)},${Y(toY(v)).toFixed(1)}`).join(' ')}"/>`;
    const tops = [];
    for (let px = 0; px < M.w; px += 3) if (Number.isFinite(M.top[px])) tops.push(`${(px * k).toFixed(1)},${Y(M.top[px]).toFixed(1)}`);
    svg += `<polyline fill="none" stroke="#33e0ff" stroke-width="1" stroke-dasharray="3 2" points="${tops.join(' ')}"/>`;
    const tag = `${r.id}  dư max ${(r.resid.max * 1000).toFixed(1)}‰  rms ${(r.resid.rms * 1000).toFixed(1)}‰  ${r.resid.by ?? ''}${r.ovr ? '  [sửa tay]' : ''}`;
    svg += `<rect x="0" y="${CH - 24}" width="${CW}" height="24" fill="rgba(0,0,0,.75)"/><text x="6" y="${CH - 7}" font-family="Helvetica, Arial" font-size="14" fill="#fff">${tag}</text></svg>`;
    const img = await sharp(base)
      .composite([
        { input: ovPng, left: 0, top: 0 },
        { input: Buffer.from(svg), left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
    cells.push({ id: r.id, img, CH });
  }
  const COLS = 4;
  const ROWS = 3;
  const per = COLS * ROWS;
  const CHm = Math.max(...cells.map((c) => c.CH));
  for (let p = 0; p * per < cells.length; p++) {
    const page = cells.slice(p * per, (p + 1) * per);
    const comp = page.map((c, i) => ({ input: c.img, left: (i % COLS) * CW, top: Math.floor(i / COLS) * CHm }));
    const name = `page-${String(p + 1).padStart(2, '0')}_${page[0].id.slice(4)}-${page.at(-1).id.slice(4)}.jpg`;
    await sharp({ create: { width: COLS * CW, height: ROWS * CHm, channels: 3, background: '#111' } }).composite(comp).jpeg({ quality: 82 }).toFile(path.join(SHEET, name));
    process.stdout.write(`sheet ${name}\n`);
  }
}

/**
 * Ảnh xem lại một bia (xem từng bia): 5 vùng phóng 3× — dải tiêu đề × viền trong trái / phải, khung ngoài trái, đáy viền trong
 * trái, đỉnh vòm; mỗi vùng ba ô cùng lưới px: ảnh xiên của mô hình | độ cao mặt trước (lõm sáng) | bản dập dựng lại qua phép khớp (lưới xanh mỗi 10 px, tâm
 * đậm = vị trí mốc của bản dập). Trùng = nét khắc / mép khung ở cùng ô lưới hai bên.
 */
async function detail(r) {
  fs.mkdirSync(DETAIL, { recursive: true });
  const { M, lm, toX, toY } = r;
  const { w, h, rect } = M.meta;
  const X = (x) => ((x - rect.x0) / (rect.x1 - rect.x0)) * w;
  const Y = (y) => ((rect.y1 - y) / (rect.y1 - rect.y0)) * h;
  const R = await sharp(path.join(SRC, `${r.id}.webp`)).resize(1600).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgb = Buffer.alloc(w * h * 3);
  for (let py = 0; py < h; py++) {
    const v = r.toV(rect.y1 - ((py + 0.5) / h) * (rect.y1 - rect.y0));
    for (let px = 0; px < w; px++) {
      const u = r.toU(rect.x0 + ((px + 0.5) / w) * (rect.x1 - rect.x0));
      let g = 0;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) {
        const k = (Math.floor(v * R.info.height) * R.info.width + Math.floor(u * R.info.width)) * 4;
        g = R.data[k] * (R.data[k + 3] / 255);
      }
      rgb.fill(g, (py * w + px) * 3, (py * w + px) * 3 + 3);
    }
  }
  const rub = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const rake = await sharp(path.join(CACHE, `${r.id}.rake.png`)).removeAlpha().png().toBuffer();
  // ô thứ ba: ĐỘ CAO mặt trước của mô hình (ảnh độ sâu, lọc thông cao — chỗ lõm sáng, chỗ nổi tối: "bản dập" của hình học)
  const { data: dd } = await sharp(path.join(CACHE, `${r.id}.depth.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { zLo, zHi } = M.meta.depth;
  const zF = M.meta.bounds.zFront;
  const z = new Float32Array(w * h);
  const okz = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = dd[i * 3], b = dd[i * 3 + 1];
    if (!a && !b) continue;
    const v = zLo + ((a + b / 255) / 255) * (zHi - zLo);
    if (v > zF - 0.03 && v < zF + 0.012) { z[i] = v; okz[i] = 1; }
  }
  const zr = Math.max(4, Math.round(w / 60));
  const zm = boxBlur(boxBlur(z, okz, w, h, zr), okz, w, h, zr);
  const relief = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) relief.fill(okz[i] ? Math.max(0, Math.min(255, Math.round(128 + ((zm[i] - z[i]) / 0.004) * 127))) : 0, i * 3, i * 3 + 3);
  const relPng = await sharp(relief, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const of = lm.outer_frame, ib = lm.inner_border, hb = lm.header_band;
  const S = 120, Z = 3;
  const regions = [
    [X(toX(ib.left)), Y(toY(hb.bottom))],
    [X(toX(ib.right)), Y(toY(hb.bottom))],
    [X(toX(of.left)), Y(toY(0.55))],
    [X(toX(ib.left)), Y(toY(ib.bottom))],
    [X(toX(0.5)), Y(toY(of.arch_apex[1])) + S * 0.2],
  ];
  const grid = `<svg xmlns="http://www.w3.org/2000/svg" width="${S * Z}" height="${S * Z}">${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 30}" y1="0" x2="${i * 30}" y2="${S * Z}" stroke="#0ff" stroke-opacity="${i === 6 ? 0.9 : 0.25}"/><line y1="${i * 30}" x1="0" y2="${i * 30}" x2="${S * Z}" stroke="#0ff" stroke-opacity="${i === 6 ? 0.9 : 0.25}"/>`).join('')}</svg>`;
  const tiles = [];
  for (const [cx, cy] of regions) {
    const left = Math.min(w - S, Math.max(0, Math.round(cx - S / 2)));
    const top = Math.min(h - S, Math.max(0, Math.round(cy - S / 2)));
    for (const im of [rake, relPng, rub]) tiles.push(await sharp(im).extract({ left, top, width: S, height: S }).resize(S * Z, S * Z, { kernel: 'nearest' }).composite([{ input: Buffer.from(grid) }]).png().toBuffer());
  }
  const TW = S * Z;
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW * 3 + 20}" height="28"><rect width="100%" height="28" fill="#000"/><text x="8" y="20" font-family="Helvetica" font-size="17" fill="#fff">${r.id} · dư ${r.loc.map((x) => `${x.k} ${(x.d * 1000).toFixed(1)}${x.weak ? '?' : ''}`).join(' · ')}</text></svg>`;
  await sharp({ create: { width: TW * 3 + 20, height: 28 + (TW + 10) * regions.length, channels: 3, background: '#300' } })
    .composite([{ input: Buffer.from(label), left: 0, top: 0 }, ...tiles.map((t, i) => ({ input: t, left: (i % 3) * (TW + 10), top: 28 + Math.floor(i / 3) * (TW + 10) }))])
    .jpeg({ quality: 82 })
    .toFile(path.join(DETAIL, `${r.id}.jpg`));
}

/**
 * Ảnh duyệt (một ô / bia, xếp trang): hai vùng phóng to — góc trên trái (đầu trái dải tiêu đề + viền trái + vài cột chữ) và góc
 * dưới phải (góc đáy viền trong + viền phải) — ảnh xiên của mô hình (xám) chồng nét bản dập sau khớp (đỏ, 55 %): khớp đúng thì
 * nét đỏ nằm đúng trên nét khắc, lệch thì thấy "bóng đôi".
 */
async function reviewCell(r, R900) {
  const { M, lm } = r;
  const { w, h, rect } = M.meta;
  const of = lm.outer_frame, ib = lm.inner_border, hb = lm.header_band;
  const S = Math.round(w * 0.3);
  const X = (x) => ((x - rect.x0) / (rect.x1 - rect.x0)) * w;
  const Y = (y) => ((rect.y1 - y) / (rect.y1 - rect.y0)) * h;
  const regions = [
    [X(r.toX(ib.left)) - S * 0.35, Y(r.toY(hb.top)) - S * 0.25],
    [X(r.toX(ib.right)) - S * 0.65, Y(r.toY(ib.bottom)) - S * 0.75],
  ];
  const { data: rk } = await sharp(path.join(CACHE, `${r.id}.rake.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tiles = [];
  for (const [l0, t0] of regions) {
    const left = Math.min(w - S, Math.max(0, Math.round(l0)));
    const top = Math.min(h - S, Math.max(0, Math.round(t0)));
    const buf = Buffer.alloc(S * S * 3);
    for (let yy = 0; yy < S; yy++) {
      const py = top + yy;
      const v = r.toV(rect.y1 - ((py + 0.5) / h) * (rect.y1 - rect.y0));
      for (let xx = 0; xx < S; xx++) {
        const px = left + xx;
        const u = r.toU(rect.x0 + ((px + 0.5) / w) * (rect.x1 - rect.x0));
        const i = (py * w + px) * 3;
        const g = (rk[i] + rk[i + 1] + rk[i + 2]) / 3;
        let st = 0;
        if (u >= 0 && u < 1 && v >= 0 && v < 1) {
          const k = (Math.floor(v * R900.info.height) * R900.info.width + Math.floor(u * R900.info.width)) * 4;
          st = Math.min(1, Math.max(0, (R900.data[k] / 255 - 0.55) / 0.25)) * (R900.data[k + 3] / 255);
        }
        const o = (yy * S + xx) * 3;
        const a = 0.55 * st;
        buf[o] = Math.round(g * (1 - a) + 255 * a);
        buf[o + 1] = Math.round(g * (1 - a) + 40 * a);
        buf[o + 2] = Math.round(g * (1 - a) + 40 * a);
      }
    }
    tiles.push(await sharp(buf, { raw: { width: S, height: S, channels: 3 } }).resize(300, 300).png().toBuffer());
  }
  const tag = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="22"><rect width="600" height="22" fill="#000"/><text x="6" y="16" font-family="Helvetica" font-size="14" fill="#fff">${r.id} · dư ${(r.resid.max * 1000).toFixed(1)}‰ · ${r.resid.by ?? ''}${r.ovr ? ' · sửa tay' : ''}</text></svg>`;
  return sharp({ create: { width: 600, height: 322, channels: 3, background: '#000' } })
    .composite([{ input: tiles[0], left: 0, top: 22 }, { input: tiles[1], left: 300, top: 22 }, { input: Buffer.from(tag), left: 0, top: 0 }])
    .png()
    .toBuffer();
}
/** Dải tiêu đề phóng to (cả bề ngang viền trong, cao gấp 1,8 dải) — mô hình xám + nét bản dập đỏ: kiểm "dải tiêu đề trùng". */
async function bandStrip(r, R900) {
  const { M, lm } = r;
  const { w, h, rect } = M.meta;
  const ib = lm.inner_border, hb = lm.header_band;
  const X = (x) => ((x - rect.x0) / (rect.x1 - rect.x0)) * w;
  const Y = (y) => ((rect.y1 - y) / (rect.y1 - rect.y0)) * h;
  const xA = Math.max(0, Math.round(X(r.toX(ib.left)) - 20));
  const xB = Math.min(w, Math.round(X(r.toX(ib.right)) + 20));
  const bh = Y(r.toY(hb.bottom)) - Y(r.toY(hb.top));
  const yA = Math.max(0, Math.round(Y(r.toY(hb.top)) - 0.4 * bh));
  const yB = Math.min(h, Math.round(Y(r.toY(hb.bottom)) + 0.4 * bh));
  const W = xB - xA, H = yB - yA;
  const { data: rk } = await sharp(path.join(CACHE, `${r.id}.rake.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.alloc(W * H * 3);
  for (let yy = 0; yy < H; yy++) {
    const py = yA + yy;
    const v = r.toV(rect.y1 - ((py + 0.5) / h) * (rect.y1 - rect.y0));
    for (let xx = 0; xx < W; xx++) {
      const px = xA + xx;
      const u = r.toU(rect.x0 + ((px + 0.5) / w) * (rect.x1 - rect.x0));
      const i = (py * w + px) * 3;
      const g = (rk[i] + rk[i + 1] + rk[i + 2]) / 3;
      let st = 0;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) {
        const k = (Math.floor(v * R900.info.height) * R900.info.width + Math.floor(u * R900.info.width)) * 4;
        st = Math.min(1, Math.max(0, (R900.data[k] / 255 - 0.55) / 0.25)) * (R900.data[k + 3] / 255);
      }
      const o = (yy * W + xx) * 3;
      const a = 0.5 * st;
      buf[o] = Math.round(g * (1 - a) + 255 * a);
      buf[o + 1] = Math.round(g * (1 - a) + 40 * a);
      buf[o + 2] = Math.round(g * (1 - a) + 40 * a);
    }
  }
  const TW = 900;
  const TH = Math.round((H * TW) / W);
  const img = await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize(TW, TH).png().toBuffer();
  const tag = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="20"><rect width="${TW}" height="20" fill="#000"/><text x="6" y="15" font-family="Helvetica" font-size="13" fill="#fff">${r.id} · dư ${(r.resid.max * 1000).toFixed(1)}‰${r.ovr ? ' · sửa tay' : ''}</text></svg>`;
  return { img: await sharp({ create: { width: TW, height: TH + 20, channels: 3, background: '#000' } }).composite([{ input: img, left: 0, top: 20 }, { input: Buffer.from(tag), left: 0, top: 0 }]).png().toBuffer(), h: TH + 20 };
}
async function bandPages(results) {
  const dir = arg('--bands');
  fs.mkdirSync(dir, { recursive: true });
  const strips = [];
  for (const r of results) {
    const R900 = await sharp(path.join(SRC, `${r.id}.webp`)).resize(1400).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    strips.push({ id: r.id, ...(await bandStrip(r, R900)) });
  }
  for (let p = 0, i = 0; i < strips.length; p++) {
    const page = [];
    let H = 0;
    while (i < strips.length && (page.length < 2 || H + strips[i].h < 1600)) {
      page.push({ ...strips[i], top: H, left: 0 });
      H += strips[i].h + 6;
      i++;
    }
    const name = `bands-${String(p + 1).padStart(2, '0')}_${page[0].id.slice(4)}-${page.at(-1).id.slice(4)}.jpg`;
    await sharp({ create: { width: 900, height: H, channels: 3, background: '#222' } }).composite(page.map((s2) => ({ input: s2.img, left: 0, top: s2.top }))).jpeg({ quality: 84 }).toFile(path.join(dir, name));
    process.stdout.write(`bands ${name}\n`);
  }
}
async function reviewPages(results) {
  const dir = arg('--review');
  fs.mkdirSync(dir, { recursive: true });
  const cells = [];
  for (const r of results) {
    const R900 = await sharp(path.join(SRC, `${r.id}.webp`)).resize(900).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    cells.push({ id: r.id, img: await reviewCell(r, R900) });
  }
  const COLS = 3, ROWS = 4, per = COLS * ROWS;
  for (let p = 0; p * per < cells.length; p++) {
    const page = cells.slice(p * per, (p + 1) * per);
    const name = `review-${String(p + 1).padStart(2, '0')}_${page[0].id.slice(4)}-${page.at(-1).id.slice(4)}.jpg`;
    await sharp({ create: { width: COLS * 610, height: ROWS * 332, channels: 3, background: '#222' } })
      .composite(page.map((c, i) => ({ input: c.img, left: (i % COLS) * 610, top: Math.floor(i / COLS) * 332 })))
      .jpeg({ quality: 84 })
      .toFile(path.join(dir, name));
    process.stdout.write(`review ${name}\n`);
  }
}

async function fitAll() {
  const ovrAll = fs.existsSync(OVR) ? JSON.parse(fs.readFileSync(OVR, 'utf8')).steles ?? {} : {};
  const results = [];
  for (const id of ids) {
    if (!fs.existsSync(path.join(CACHE, `${id}.json`)) || !fs.existsSync(path.join(SRC, `${id}.json`))) {
      console.warn(`${id}: thiếu ảnh chụp hoặc mốc — bỏ`);
      continue;
    }
    const r = await fitOne(id, ovrAll[id]);
    r.ovr = ovrAll[id] ?? null;
    results.push(r);
    if (DETAIL) await detail(r);
    const fmtH = (L) => (L.P.sx ? `chữ${L.P.skip ? '(bỏ)' : ''} dx${(L.P.dx * 1000).toFixed(1)} dy${((L.P.dy ?? 0) * 1000).toFixed(1)} ×${L.P.sx.toFixed(3)}|${L.P.s.toFixed(2)}` : Object.entries(L.P).map(([k, p]) => `${k}${(p.d * 1000).toFixed(1)}|${p.s.toFixed(2)}${p.edge ? '!' : ''}`).join(' '));
    const head = r.ncc?.cands ? `[${r.ncc.cands.map((c) => `${c.tag}:${c.agree}/${c.rms}`).join(' ')}] → ${r.ncc.pick} · ${r.ncc.hybrid.map(fmtH).join(' → ')}` : r.ncc?.pick ? `(đã ghi: ${r.ncc.pick})` : '';
    const pol = r.ncc?.polish ? ` {hoàn thiện ${r.ncc.polish.map((p) => `${p.agree.join('→')}/${p.rms.join('→')}`).join(' ')}}` : '';
    process.stdout.write(`${id} ${head}${pol} · dư max ${(r.resid.max * 1000).toFixed(1)}‰ rms ${(r.resid.rms * 1000).toFixed(1)}‰ [${r.loc.map((x) => `${x.k} ${(x.dSigned * 1000).toFixed(1)}${x.weak ? '?' : ''}`).join(', ')}] ff ${r.ffCheck ? Object.entries(r.ffCheck).map(([k, v]) => `${k}:${(v * 1000).toFixed(1)}`).join(' ') : '—'}${r.ovr ? ' · sửa tay' : ''}\n`);
  }
  if (SHEET) await sheet(results);
  if (arg('--review')) await reviewPages(results);
  if (arg('--bands')) await bandPages(results);
  if (arg('--dump')) fs.writeFileSync(arg('--dump'), JSON.stringify(Object.fromEntries(results.map((r) => [r.id, { map: r.map, fit: r.fit, slab: r.slab, plane: r.plane, resid: r.resid, loc: r.loc, ffCheck: r.ffCheck, ncc: r.ncc }])), null, 1));
  const maxs = results.map((r) => r.resid.max).sort((a, b) => a - b);
  const q = (k) => maxs[Math.min(maxs.length - 1, Math.floor(maxs.length * k))];
  process.stdout.write(`\nphần dư lớn nhất mỗi bia (‰ chiều cao bia): trung vị ${(q(0.5) * 1000).toFixed(1)} · p90 ${(q(0.9) * 1000).toFixed(1)} · lớn nhất ${(maxs.at(-1) * 1000).toFixed(1)}\n`);
  if (WRITE && !ONLY) {
    const out = {
      $generated: 'tools/fit-rubbings.mjs — khớp bản dập (models-v2/rubbings/bia-<năm>.webp) lên mặt bia mô hình v2; không sửa tay — sửa ở rubbings.overrides.json. img: cỡ ảnh; fit: u, v chuẩn hoá (gốc trên trái) → toạ độ bia x = x0 + (u − u0)·sx, y = y0 − (v − v0)·sy; frame: khung ngoài (toạ độ bia); resid: phần dư (đơn vị bia — bia cao 1) lớn nhất / RMS các mốc khung + dải tiêu đề + trung vị vòm.',
      source: 'v2',
      file: 'rubbings/{id}.webp',
      steles: Object.fromEntries(results.map((r) => [r.id, { img: r.img, map: r.map, fit: r.fit, frame: r.frame, plane: (({ z0, kx, ky, back, front, head }) => ({ z0, kx, ky, back, front, ...(head ? { head: true } : {}) }))(r.plane), resid: r.resid, ...(r.ovr ? { override: true } : {}), ...(r.flags?.length ? { flags: r.flags } : {}) }])),
    };
    fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
    process.stdout.write(`ghi ${path.relative(ROOT, OUT)}\n`);
  }
}

if (FIT) await fitAll();
else await capture();
