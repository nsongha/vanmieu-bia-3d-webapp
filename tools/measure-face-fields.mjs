#!/usr/bin/env node
// r81 — Ô CHỮ trên mặt từng tấm bia (toạ độ mô hình), cho lớp tên khắc trên thân bia (src/views/cinema/names.js):
//   trên  = đường khắc NGAY DƯỚI dải tiêu đề (hàng chữ Hán lớn dưới vòm) · dưới = đường đáy khung trong (trên lưng rùa / đế; không
//   bao giờ thấp hơn đỉnh đầu rùa — lớp chữ CSS3D luôn vẽ đè lên đầu rùa) · trái / phải = hai đường dọc của khung trong.
// Cách dò (mỗi bia, mô hình LOD0 của nguồn đang chạy — v2):
//   · ảnh CHÍNH DIỆN TRỰC GIAO của app (vm.cinemaOrthoFront): một ảnh màu đèn xiên ('rake') + một ảnh ĐỘ SÂU ('depth', z toạ độ bia);
//   · độ sâu → mặt phẳng mặt bia (khớp tuyến tính theo hàng ở hai bên), chân phiến (hai bên nhô ra trước = lưng rùa / đế) và đỉnh
//     đầu rùa (giữa nhô ra trước);
//   · hồ sơ theo HÀNG của đạo hàm dọc (chỉ lấy dấu nhất quán ở cả hai nửa trái / phải — đường khắc chạy suốt bề ngang, chữ thì
//     không) → đường dưới dải tiêu đề = đường mạnh THẤP NHẤT ở khoảng 10–36 % chiều cao phiến; đường đáy khung = đường mạnh CAO
//     NHẤT ở 62 % phiến → chân phiến;
//   · hồ sơ theo CỘT của đạo hàm ngang trong khoảng giữa ô → cặp đường dọc ĐỐI XỨNG quanh trục phiến có tổng độ mạnh lớn nhất.
// Ghi src/data/face-fields.generated.json (không sửa tay — sửa tay ở src/data/face-fields.overrides.json, ghi đè từng trường).
// Cờ: 'no-band' (không thấy đường dưới dải tiêu đề đủ rõ), 'head-cap' (đáy ô cắt lên trên đỉnh đầu rùa), 'weak-sides' (đường dọc
// mờ), 'no-frame-bottom' (không thấy đáy khung — lấy theo chân phiến), 'sides-check' (cặp đường dọc lệch xa hai đầu đường dưới
// dải tiêu đề), 'partial' (ảnh thiếu phần trên bia — mô hình chưa vẽ trọn; chạy lại).
//
// Chạy (cần máy chủ dev đang chạy):
//   node tools/measure-face-fields.mjs --port 5180                       dò cả 82 bia, ghi tệp sinh
//   node tools/measure-face-fields.mjs --port 5180 --only bia-1602,bia-1598 --no-write
//   node tools/measure-face-fields.mjs --port 5180 --sheet <thư mục>     + bảng ảnh xem lại (4×4 mỗi trang, PNG): đường dưới dải
//        tiêu đề (đỏ), ô chữ đang dùng (xanh lá — đã ghép phần sửa tay), đỉnh đầu rùa (cam), khối tên đỗ đầu (xanh lơ) và vùng cuộn
//        (vàng) THEO BỐ CỤC THẬT của app (vm.cinemaNamesLayout)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launch, openCinema, sleep } from '../tests/lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/face-fields.generated.json');
const OVR = path.join(ROOT, 'src/data/face-fields.overrides.json');
const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const PORT = Number(arg('--port') ?? 5180);
const ONLY = arg('--only')?.split(',') ?? null;
const SHEET = arg('--sheet');
const REVIEW = arg('--review'); // ảnh từng bia cỡ gốc + lưới toạ độ mô hình (đọc số để sửa tay)
const WRITE = !argv.includes('--no-write');
const IMG_W = 600;

// ───────────────────────── phân tích ảnh (thuần, Node)
const boxFilter = (a, n, k) => {
  // trung bình trượt cửa sổ k trên mảng 1 chiều
  const out = new Float64Array(n);
  const r = k >> 1;
  let s = 0;
  let c = 0;
  for (let i = -r; i < n + r; i++) {
    if (i + r < n) {
      s += a[Math.min(n - 1, i + r)];
      c++;
    }
    if (i - r - 1 >= 0) {
      s -= a[i - r - 1];
      c--;
    }
    if (i >= 0 && i < n) out[i] = s / Math.max(1, c);
  }
  return out;
};
const median = (arr) => {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : NaN;
};

/**
 * @param {{gray:Float64Array, w:number, h:number}} rake  ảnh xiên (độ sáng 0..255)
 * @param {{z:Float64Array, ok:Uint8Array}} depth  z toạ độ bia (NaN nền)
 * @param {{x0:number,x1:number,y0:number,y1:number}} rect  khung ảnh trong toạ độ bia
 */
export function analyze(rake, depth, rect, zFront) {
  const { gray: I, w, h } = rake;
  const { z, ok } = depth;
  const at = (x, y) => y * w + x;
  // biên trái / phải mỗi hàng + hàng trên cùng
  const L = new Int32Array(h).fill(w);
  const R = new Int32Array(h).fill(-1);
  let top = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (ok[at(x, y)]) { L[y] = x; break; }
    for (let x = w - 1; x >= 0; x--) if (ok[at(x, y)]) { R[y] = x; break; }
    if (top < 0 && R[y] > L[y]) top = y;
  }
  const H0 = h - top;
  // "trong" = cách biên hình ≥ 6 px (không lấy cạnh hình chiếu làm đường khắc)
  const inner = new Uint8Array(w * h);
  for (let y = 6; y < h - 6; y++) for (let x = L[y] + 6; x <= R[y] - 6; x++) if (ok[at(x, y - 6)] && ok[at(x, y + 6)]) inner[at(x, y)] = 1;
  // mặt phẳng mặt bia: z theo hàng (hai bên, 25–60 % chiều cao), khớp tuyến tính
  const side = (y, fa, fb) => {
    const wd = R[y] - L[y];
    const v = [];
    for (let x = Math.round(L[y] + fa * wd); x < Math.round(L[y] + fb * wd); x++) if (ok[at(x, y)]) v.push(z[at(x, y)]);
    return median(v);
  };
  let sy = 0, sz = 0, syy = 0, syz = 0, n = 0;
  for (let y = Math.round(top + 0.25 * H0); y < top + 0.6 * H0; y += 2) {
    const zl = side(y, 0.15, 0.3);
    const zr = side(y, 0.7, 0.85);
    for (const zz of [zl, zr]) {
      if (!Number.isFinite(zz)) continue;
      sy += y; sz += zz; syy += y * y; syz += y * zz; n++;
    }
  }
  const b = n > 2 ? (n * syz - sy * sz) / (n * syy - sy * sy) : 0;
  const a = n > 2 ? (sz - b * sy) / n : zFront;
  const zFace = (y) => a + b * y;
  // chân phiến: hai bên nhô ra trước mặt bia (lưng rùa / đế) ≥ 3,5 cm suốt 5 hàng
  let sb = h - 1;
  for (let y = Math.round(top + 0.5 * H0), run = 0; y < h; y++) {
    const d = Math.min(side(y, 0.12, 0.3) - zFace(y), side(y, 0.7, 0.88) - zFace(y));
    run = d > 0.035 ? run + 1 : 0;
    if (run >= 5) { sb = y - 4; break; }
  }
  // đỉnh đầu rùa: giữa nhô ra ≥ 5 cm suốt 4 hàng
  let hd = sb;
  for (let y = Math.round(top + 0.45 * H0), run = 0; y < sb; y++) {
    const d = side(y, 0.44, 0.56) - zFace(y);
    run = d > 0.05 ? run + 1 : 0;
    if (run >= 4) { hd = y - 3; break; }
  }
  const Hs = sb - top;
  // hồ sơ hàng: đạo hàm dọc (làm mượt ngang 5 px), trung bình CÓ DẤU ở hai cửa sổ trái / phải, cùng dấu mới tính
  const Sh = new Float64Array(h);
  for (let y = 3; y < h - 3; y++) {
    const wd = R[y] - L[y];
    if (wd < w * 0.3) continue;
    const parts = [];
    for (const [fa, fb] of [[0.12, 0.4], [0.6, 0.88]]) {
      let s = 0, c = 0;
      for (let x = Math.round(L[y] + fa * wd); x < Math.round(L[y] + fb * wd); x++) {
        if (!inner[at(x, y)]) continue;
        let d = 0;
        for (let k = -2; k <= 2; k++) d += I[at(Math.min(w - 1, Math.max(0, x + k)), y + 2)] - I[at(Math.min(w - 1, Math.max(0, x + k)), y - 2)];
        s += d / 5;
        c++;
      }
      parts.push(c > (fb - fa) * wd * 0.7 ? s / c : NaN);
    }
    if (parts.every(Number.isFinite) && Math.sign(parts[0]) === Math.sign(parts[1])) Sh[y] = (parts[0] + parts[1]) / 2;
  }
  const peaks = (S, lo, hi, frac) => {
    lo = Math.max(1, Math.round(lo));
    hi = Math.min(S.length - 2, Math.round(hi));
    let m = 0;
    for (let i = lo; i <= hi; i++) m = Math.max(m, Math.abs(S[i]));
    const out = [];
    for (let i = lo; i <= hi; i++) {
      const v = Math.abs(S[i]);
      if (v >= frac * m && v >= Math.abs(S[i - 1]) && v >= Math.abs(S[i + 1]) && v > 0) out.push(i);
    }
    return { list: out, max: m };
  };
  const flags = [];
  // nền nhiễu: trung vị |Sh| trong lòng ô (40–60 %)
  const noise = median(Array.from(Sh.slice(Math.round(top + 0.4 * Hs), Math.round(top + 0.6 * Hs)), Math.abs)) || 0.1;
  const pt = peaks(Sh, top + 0.1 * Hs, top + 0.36 * Hs, 0.45);
  let ft = pt.list.length ? Math.max(...pt.list) : null;
  if (ft == null || pt.max < noise * 4) {
    flags.push('no-band');
    ft ??= Math.round(top + 0.25 * Hs);
  }
  // hồ sơ cột trong khoảng giữa ô (đáy tạm = 85 % tới chân phiến — đường dọc rõ suốt phần giữa)
  const fbTmp = Math.round(ft + 0.85 * (sb - ft));
  const ya = Math.round(ft + 0.08 * (fbTmp - ft));
  const yb = Math.round(fbTmp - 0.08 * (fbTmp - ft));
  const Sv = new Float64Array(w);
  for (let x = 3; x < w - 3; x++) {
    let s = 0, c = 0;
    for (let y = ya; y < yb; y++) {
      if (!inner[at(x, y)]) continue;
      let d = 0;
      for (let k = -2; k <= 2; k++) d += I[at(x + 2, y + k)] - I[at(x - 2, y + k)];
      s += d / 5;
      c++;
    }
    Sv[x] = c > (yb - ya) * 0.75 ? s / c : 0;
  }
  const mid = Math.round((ya + yb) / 2);
  const cx = (L[mid] + R[mid]) / 2;
  const hw = (R[mid] - L[mid]) / 2;
  // cặp đường dọc đối xứng (lệch ≤ 2 % bề ngang): điểm = độ mạnh hai bên; viền trang trí thường có 2 đường (mép ngoài + mép
  // trong) → chọn cặp TRONG CÙNG trong các cặp đạt ≥ 50 % cặp mạnh nhất (ô chữ = phía trong khung)
  const tol = Math.round(0.02 * w);
  const pairs = [];
  for (let l = Math.round(cx - 0.97 * hw); l <= cx - 0.55 * hw; l++) {
    if (!(Math.abs(Sv[l]) >= Math.abs(Sv[l - 1]) && Math.abs(Sv[l]) >= Math.abs(Sv[l + 1]))) continue;
    const rc = Math.round(2 * cx - l);
    let bestR = -1, sR = -1;
    for (let r = rc - tol; r <= rc + tol; r++) if (Math.abs(Sv[r] ?? 0) > sR) { sR = Math.abs(Sv[r] ?? 0); bestR = r; }
    pairs.push({ l, r: bestR, s: Math.abs(Sv[l]) + sR });
  }
  const best = Math.max(0, ...pairs.map((p) => p.s));
  // ĐƯỜNG DƯỚI DẢI TIÊU ĐỀ chạy đúng bề ngang ô (từ đường dọc trái tới đường dọc phải của khung trong) → hai đầu của nó cho
  // biết khung ở đâu: đáp ứng dọc (cùng dấu với đường) theo cột ở hàng ft (±2), làm mượt 9 cột, đoạn liền quanh trục ≥ 35 % trung vị
  const lineSign = Math.sign(Sh[ft]) || 1;
  const resp = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let m = 0;
    for (let y = ft - 2; y <= ft + 2; y++) {
      if (!inner[at(x, y)]) continue;
      m = Math.max(m, lineSign * (I[at(x, y + 2)] - I[at(x, y - 2)]));
    }
    resp[x] = m;
  }
  const rs = boxFilter(resp, w, 9);
  const ref = median(Array.from(rs.slice(Math.round(cx - 0.5 * hw), Math.round(cx + 0.5 * hw)))) || 1;
  let le = Math.round(cx), re = Math.round(cx);
  for (let x = Math.round(cx), gapRun = 0; x > L[ft] + 3; x--) {
    gapRun = rs[x] < 0.35 * ref ? gapRun + 1 : 0;
    if (gapRun > 6) break;
    if (rs[x] >= 0.35 * ref) le = x;
  }
  for (let x = Math.round(cx), gapRun = 0; x < R[ft] - 3; x++) {
    gapRun = rs[x] < 0.35 * ref ? gapRun + 1 : 0;
    if (gapRun > 6) break;
    if (rs[x] >= 0.35 * ref) re = x;
  }
  // cặp đường dọc (≥ 25 % cặp mạnh nhất) GẦN hai đầu đường dưới dải tiêu đề nhất (≤ 4 % bề ngang); không có → lấy hai đầu đường
  // (hai đầu đường dưới dải tiêu đề chỉ để đối chiếu: lệch nhiều với cặp đường dọc → cờ 'sides-check' cho người xem lại)
  const pick = pairs.filter((p) => p.s >= 0.5 * best).sort((a, b) => b.l - a.l)[0] ?? { l: Math.round(cx - 0.85 * hw), r: Math.round(cx + 0.85 * hw) };
  if (re - le > 1.1 * hw && (Math.abs(pick.l - le) > 0.05 * w || Math.abs(pick.r - re) > 0.05 * w)) flags.push('sides-check');
  const bl = pick.l;
  const br = pick.r;
  const svNoise = median(Array.from(Sv.slice(Math.round(cx - 0.4 * hw), Math.round(cx + 0.4 * hw)), Math.abs)) || 0.1;
  if (best < svNoise * 6) flags.push('weak-sides');
  // đáy khung: viền dưới thường cao xấp xỉ viền hai bên (bw) → đường mạnh CAO NHẤT trong [sb − 1,8 bw, sb − 0,35 bw] (đường
  // khắc / dòng chữ trong lòng ô không lọt vào)
  const bw = Math.max(4, ((bl - L[mid]) + (R[mid] - br)) / 2);
  const pb = peaks(Sh, Math.max(top + 0.6 * Hs, sb - 1.8 * bw), sb - 0.35 * bw, 0.45);
  let fb = null;
  if (pb.list.length && pb.max >= noise * 3) fb = Math.min(...pb.list); // đường cao nhất của viền dưới = đáy ô
  if (fb == null) {
    flags.push('no-frame-bottom');
    fb = Math.round(sb - bw);
  }
  // đáy ô: đáy khung, không thấp hơn đỉnh đầu rùa (chữ CSS3D đè lên đầu rùa)
  const headGap = Math.round(0.012 * h);
  let fy0 = fb;
  if (hd - headGap < fb) {
    fy0 = hd - headGap;
    flags.push('head-cap');
  }
  const X = (px) => rect.x0 + (px / w) * (rect.x1 - rect.x0);
  const Y = (py) => rect.y1 - (py / h) * (rect.y1 - rect.y0);
  const r4 = (v) => +v.toFixed(4);
  return {
    x0: r4(X(bl)),
    x1: r4(X(br)),
    y0: r4(Y(fy0)),
    y1: r4(Y(ft)),
    band: r4(Y(ft)),
    frameBottom: r4(Y(fb)),
    headTop: r4(Y(hd)),
    slabBottom: r4(Y(sb)),
    flags,
    px: { ft, fb, hd, sb, bl, br, top, le, re },
  };
}

// ───────────────────────── chạy trên app
async function decode(url, kind) {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  if (kind === 'rake') {
    const gray = new Float64Array(n);
    for (let i = 0; i < n; i++) gray[i] = (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3;
    return { gray, w: info.width, h: info.height, buf };
  }
  return { raw: data, w: info.width, h: info.height };
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.generated.json'), 'utf8'));
let ids = Object.keys(catalog)
  .filter((k) => !k.startsWith('$'))
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
if (ONLY) ids = ids.filter((id) => ONLY.includes(id));

const { page, close } = await launch({ width: 1440, height: 900, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true } });
await openCinema(page, PORT, { id: ids[0], hooks: ['cinemaOrthoFront', 'cinemaIdle', 'cinemaInfo', 'cinemaTxProgress', 'cinemaLods', 'cinemaReveal', 'cinemaNamesLayout'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const source = await E(() => window.__vm.cinemaLods().v2 ? 'v2' : 'v1');
const results = {};
const cells = [];
for (const id of ids) {
  const has = await E((id) => window.__vm.cinemaInfo.ctx.hasStele(id), id);
  if (!has) continue;
  await E(async (id) => {
    if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
    const t0 = performance.now();
    // (chờ cả lượt QUÉT HIỆN xong — đang quét thì phần trên vạch chưa có đá thật: ảnh trực giao mất nửa trên bia)
    while (performance.now() - t0 < 30000) {
      await new Promise((r) => setTimeout(r, 150));
      const rv = window.__vm.cinemaReveal();
      if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0 && window.__vm.cinemaLods().liveLod === 0 && !rv.proxy && !rv.revealing) break;
    }
  }, id);
  await sleep(500);
  const shots = await E((W) => ({
    rake: window.__vm.cinemaOrthoFront({ w: W, pad: 0.04, light: 'rake', yFrom: 'min' }),
    depth: window.__vm.cinemaOrthoFront({ w: W, pad: 0.04, light: 'depth', yFrom: 'min' }),
  }), IMG_W);
  const rk = await decode(shots.rake.url, 'rake');
  const dp = await decode(shots.depth.url, 'depth');
  const { zLo, zHi } = shots.depth.depth;
  const n = dp.w * dp.h;
  const z = new Float64Array(n);
  const ok = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = dp.raw[i * 3];
    const g = dp.raw[i * 3 + 1];
    if (r === 0 && g === 0) continue;
    ok[i] = 1;
    z[i] = zLo + ((r + g / 255) / 255) * (zHi - zLo);
  }
  const res = analyze(rk, { z, ok }, shots.rake.rect, shots.rake.bounds.zFront);
  // ảnh thiếu phần trên (mô hình chưa vẽ trọn — vd. còn đang quét hiện) → số dò vô nghĩa: cờ 'partial' để người xem lại
  const R = shots.rake.rect;
  if (R.y1 - (res.px.top / rk.h) * (R.y1 - R.y0) < shots.rake.bounds.yMax - 0.03) res.flags.push('partial');
  results[id] = res;
  process.stdout.write(`${id} ${JSON.stringify({ x0: res.x0, x1: res.x1, y0: res.y0, y1: res.y1, flags: res.flags, ...(argv.includes("--px") ? { px: res.px } : {}) })}\n`);
  if (SHEET || REVIEW) {
    // bố cục THẬT của lớp tên (ô đang dùng — tệp sinh + sửa tay — và khối tên đầu / vùng cuộn)
    await sleep(600);
    const lay = await E(() => window.__vm.cinemaNamesLayout?.() ?? null);
    cells.push({ id, rect: shots.rake.rect, img: rk.buf, w: rk.w, h: rk.h, res, lay });
  }
}
await close();

if (WRITE) {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const steles = ONLY && prev?.source === source ? { ...prev.steles } : {};
  for (const [id, r] of Object.entries(results)) {
    const { px, ...rest } = r;
    steles[id] = rest;
  }
  const sorted = Object.fromEntries(Object.keys(steles).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))).map((k) => [k, steles[k]]));
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        $generated: 'tools/measure-face-fields.mjs — ô chữ mặt bia (toạ độ mô hình LOD0 của nguồn này); không sửa tay — sửa ở face-fields.overrides.json',
        source,
        steles: sorted,
      },
      null,
      1
    ) + '\n'
  );
  console.log(`→ ${path.relative(ROOT, OUT)} (${Object.keys(results).length} bia, nguồn ${source})`);
}

function overlaySvg(c, ovr, CW, ch, grid) {
  const X = (x) => ((x - c.rect.x0) / (c.rect.x1 - c.rect.x0)) * CW;
  const Y = (y) => ((c.rect.y1 - y) / (c.rect.y1 - c.rect.y0)) * ch;
  const f = { ...c.res, ...(ovr[c.id] ?? {}) };
  const L = c.lay;
  const line = (y, col, dash = '') => `<line x1="0" x2="${CW}" y1="${Y(y).toFixed(1)}" y2="${Y(y).toFixed(1)}" stroke="${col}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const rectS = (x0, x1, y0, y1, col, w = 2, fill = 'none') => `<rect x="${X(x0).toFixed(1)}" y="${Y(y1).toFixed(1)}" width="${(X(x1) - X(x0)).toFixed(1)}" height="${(Y(y0) - Y(y1)).toFixed(1)}" fill="${fill}" stroke="${col}" stroke-width="${w}"/>`;
  let svg = `<svg width="${CW}" height="${ch}" xmlns="http://www.w3.org/2000/svg">`;
  if (grid) {
    // lưới toạ độ mô hình: vạch 0,02, số mỗi 0,1
    for (let v = Math.ceil(c.rect.x0 / 0.02) * 0.02; v <= c.rect.x1; v += 0.02) {
      const major = Math.abs(v / 0.1 - Math.round(v / 0.1)) < 1e-6;
      svg += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="0" y2="${major ? 14 : 7}" stroke="#fff" stroke-width="1"/>`;
      if (major) svg += `<text x="${(X(v) + 2).toFixed(1)}" y="24" font-family="Helvetica" font-size="11" fill="#fff">${v.toFixed(1)}</text>`;
    }
    for (let v = Math.ceil(c.rect.y0 / 0.02) * 0.02; v <= c.rect.y1; v += 0.02) {
      const major = Math.abs(v / 0.1 - Math.round(v / 0.1)) < 1e-6;
      svg += `<line y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" x1="0" x2="${major ? 14 : 7}" stroke="#fff" stroke-width="1"/>`;
      svg += `<line y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" x1="${CW}" x2="${CW - (major ? 14 : 7)}" stroke="#fff" stroke-width="1"/>`;
      if (major) svg += `<text x="16" y="${(Y(v) + 4).toFixed(1)}" font-family="Helvetica" font-size="11" fill="#fff">${v.toFixed(1)}</text>`;
    }
  }
  // đường dải tiêu đề ĐANG DÙNG (đã ghép sửa tay: band, không có thì y1); số dò gốc lệch đáng kể → nét đứt mờ để so
  const band = ovr[c.id]?.band ?? ovr[c.id]?.y1 ?? c.res.band;
  if (Math.abs(band - c.res.band) > 0.002) svg += line(c.res.band, 'rgba(255,48,48,.45)', '4 6');
  svg += line(band, '#ff3030');
  svg += line(c.res.headTop, '#ff9a00', '6 4');
  svg += rectS(f.x0, f.x1, f.y0, f.y1, '#20ff40', grid ? 1.5 : 3);
  if (L?.head) svg += rectS(L.head.x0, L.head.x1, L.head.y0, L.head.y1, '#00e5ff', grid ? 1 : 2, 'rgba(0,229,255,.10)');
  if (L?.roll) svg += rectS(L.roll.x0, L.roll.x1, L.roll.y0, L.roll.y1, '#ffe600', grid ? 1 : 2, 'rgba(255,230,0,.08)');
  const tag = `${c.id.slice(4)}${ovr[c.id] ? ' · sửa tay' : ''}${c.res.flags.length ? ` · ${c.res.flags.join(' ')}` : ''}`;
  svg += `<rect x="0" y="${ch - 26}" width="${CW}" height="26" fill="rgba(0,0,0,.72)"/><text x="8" y="${ch - 8}" font-family="Helvetica, Arial" font-size="16" fill="#fff">${tag}</text></svg>`;
  return svg;
}
if (REVIEW) {
  fs.mkdirSync(REVIEW, { recursive: true });
  const ovr = fs.existsSync(OVR) ? JSON.parse(fs.readFileSync(OVR, 'utf8')).steles ?? {} : {};
  for (const c of cells) {
    const svg = overlaySvg(c, ovr, c.w, c.h, true);
    // (tăng tương phản ảnh nền — đường khắc mờ trên bia phong hoá dễ thấy hơn)
    await sharp(c.img).normalise({ lower: 2, upper: 98 }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(path.join(REVIEW, `${c.id}.png`));
  }
  console.log(`→ ${REVIEW} (${cells.length} ảnh)`);
}
if (SHEET) {
  fs.mkdirSync(SHEET, { recursive: true });
  const ovr = fs.existsSync(OVR) ? JSON.parse(fs.readFileSync(OVR, 'utf8')).steles ?? {} : {};
  const CW = 420; // bề ngang mỗi ô ảnh
  const COLS = 4;
  const ROWS = 4;
  const per = COLS * ROWS;
  for (let p = 0; p * per < cells.length; p++) {
    const page = cells.slice(p * per, (p + 1) * per);
    const scaled = await Promise.all(
      page.map(async (c) => {
        const k = CW / c.w;
        const ch = Math.round(c.h * k);
        const svg = overlaySvg(c, ovr, CW, ch, false);
        const img = await sharp(c.img).resize(CW, ch).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
        return { img, ch };
      })
    );
    const cellH = Math.max(...scaled.map((s) => s.ch));
    const gap = 8;
    const sheetW = COLS * CW + (COLS + 1) * gap;
    const sheetH = Math.ceil(page.length / COLS) * (cellH + gap) + gap;
    const comp = scaled.map((s, i) => ({ input: s.img, left: gap + (i % COLS) * (CW + gap), top: gap + Math.floor(i / COLS) * (cellH + gap) }));
    const file = path.join(SHEET, `face-fields-${String(p + 1).padStart(2, '0')}.png`);
    await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: '#1a1a1a' } }).composite(comp).png().toFile(file);
    console.log(`→ ${file}`);
  }
}
