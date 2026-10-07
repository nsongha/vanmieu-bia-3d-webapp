// r80 — ĐOẠN CAMERA VÀO / RA KHUNG ĐỌC TOÀN VĂN qua nhiều chu kỳ + thời gian là cài đặt.
//   A. Lỗi người dùng báo: "đóng lần đầu lùi êm, các lần sau giật về nhanh". Nguyên nhân: renderer.js đổi DPR thích ứng ~220 ms
//      sau MỌI lần nhả chuột / nhón (kể cả bấm nút Đóng) → stage.onResize cùng cỡ → snapHome() huỷ đoạn lùi, đặt camera thẳng
//      vào khung đích trong một khung. 3 bia × 5 chu kỳ mở → đóng, xoay vòng cách mở / đóng (nút "Đọc toàn văn" / "Xem ĐỀ DANH" /
//      giữ V; nút Đóng bấm chuột / Esc / nắm tay): mỗi lần đóng — thời gian lùi và tốc độ lùi lớn nhất (|Δ khoảng cách| / Δt)
//      trong vài % của lần đóng đầu; lần mở cũng vậy; không khung nào nhảy cóc.
//   B. Cài đặt (Thông tin): "Thời gian camera tiến vào (mở toàn văn)" mặc định 2,8 s · "Thời gian camera lùi ra (đóng)" mặc định
//      1,0 s: đo thật ở 2,8 s (mở) và 2,0 s (đóng, giá trị không mặc định); các nhịp theo tỉ lệ (r82) — tấm bắt đầu trượt lên ở
//      1 − 0,36 = 64 % đoạn vào ("Tấm trượt lên trong" — r84 mặc định 36 %, trước 58 %), tới chỗ nghỉ đúng khung camera dừng, mục lục hiện sau đó;
//      đóng: tấm trượt xuống suốt đoạn lùi theo cùng đường cong camera (bậc ba vào–ra), mờ hết đúng lúc camera dừng, chữ tắt ở ~30 %,
//      mục lục / Đóng tắt sớm; móc 'reader:open / opened / close / closed' + progress(). r83: bản dập không ở lại lúc đọc (mọi bia
//      có bản dập: chỉ vệt lúc quét nhanh — tắt hiệu ứng chữ Hán cũng vậy) → đoạn lùi không còn gì để tắt dần.
// r82 (người dùng): mở — tấm đen TRƯỢT LÊN êm từ dưới vào chỗ nghỉ (ease-out bậc ba) trong phần cuối đoạn camera tiến, chữ theo
// trễ nhẹ + nhô thêm, hiện dần; đóng — trượt xuống (bậc ba vào–ra) cùng cửa sổ thời gian với camera lùi, chữ + phần bên tắt sớm.
//   A. (Nổi 3D, mặc định) mỗi chu kỳ: độ dời tấm (dọc trục đứng của bia) giảm đơn điệu lúc mở, đúng vị trí nghỉ (ma trận nghỉ) ở
//      khung camera dừng, chữ hiện đủ; lúc đóng tăng đơn điệu, tiến độ trượt = đường cong camera (giữa đoạn ≈ 0,5); 5 chu kỳ liền
//      cùng đường trượt (lấy mẫu theo thời gian thật) như chu kỳ đầu.
//   C. như A ở kiểu Phẳng (5 chu kỳ, bia 1442): thêm mép trên tấm TRÊN MÀN đi lên / xuống đơn điệu, tới đúng ô nghỉ, hết transform.
//   D. giảm chuyển động (Phẳng + Nổi 3D): chỉ mờ chéo ngắn — không khung nào có độ dời / transform / chữ nhô, độ hiện qua giá trị
//      trung gian rồi đủ (mở) / hết (đóng) trong ≤ 0,6 s.
// node tests/cinema/reader-zoom.test.mjs --port 5180   (≈ 6 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('reader-zoom');
const W = 1440;
const H = 900;
// r85: bộ này đo nhịp trượt tấm / nhóm chữ của r82 — tắt hiệu ứng tiêu đề (kiểm ở transition.test.mjs), kiểu bay "Vụt qua" (kiểu
// "Đám mây" tự lùi tấm trượt muộn hơn — readerTiming)
const { page, close, errors } = await launch({
  headed,
  width: W,
  height: H,
  settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, titleFxMode: 'fade', glyphFlyMode: 'whoosh' },
});
await openCinema(page, port, { id: 'bia-1442', hooks: ['cinemaStelePoint', 'cinemaPresence', 'cinemaRich', 'cinemaIdle', 'cinemaInfo', 'cinemaRead', 'cinemaCam', 'cinemaScan', 'cinemaTxProgress'], settleMs: 4000 });
const E = (fn, a) => page.evaluate(fn, a);
const setS = (k, v) => E(([k, v]) => window.__vm.settings.set(k, v), [k, v]);

// vết mỗi khung: khoảng cách camera ↔ tâm nhìn, loại đoạn camera, độ hiện tấm, bản dập; r82: nhịp trượt (m), độ dời, cao độ đối
// tượng CSS3D (o3: hiện tại / nghỉ), mép trên tấm trên màn, transform tấm (Phẳng), chữ (fx), độ hiện mục lục, móc (hook)
const traceInit = () => E(() => {
  const T = (window.__T = { on: false, rows: [], hooks: [] });
  for (const k of ['open', 'opened', 'close', 'closed'])
    window.addEventListener(`reader:${k}`, (e) => {
      T.hooks.push({ k, t: performance.now() - (T.t0 ?? 0), p: e.detail.progress(), dur: e.detail.dur, phase: e.detail.phase });
      if (k === 'open' || k === 'close') T.hook = e.detail;
    });
  const rec = (t) => {
    if (T.on) {
      const c = window.__vm.cinemaCam();
      const st = window.__vm.cinemaRich.dev()?.reader?.state();
      const op = st ? (st.slab.opacity === '' ? (st.open ? 1 : 0) : +st.slab.opacity) : 0;
      const root = document.querySelector('.ri-ov.rd');
      const pe = document.querySelector('.rd .rd-panel');
      const toc = document.querySelector('.rd-toc');
      T.rows.push({
        t: t - T.t0, dist: c.dist, tw: c.camTw, op, rub: window.__vm.cinemaScan().reveal ?? 0,
        m: st?.motion ?? null, slide: st?.slide ?? 0, o3: st?.obj3 ? { y: st.obj3.y, base: st.obj3.base } : null, mode: st?.mode,
        // mép trên trên màn chỉ đo ở kiểu Phẳng (ép bố cục mỗi khung — kiểu 3D kiểm bằng cao độ đối tượng CSS3D)
        top: pe && root && !root.hidden && st?.mode === 'flat' ? pe.getBoundingClientRect().top : null, tr: st?.slab.transform ?? '', hidden: !!root?.hidden,
        fx: st?.textFx ?? null, text: !!st?.text, toc: toc ? +getComputedStyle(toc).opacity : 0, hp: T.hook ? T.hook.progress() : null,
      });
    }
    requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
});
await traceInit();
const traceOn = () => E(() => { window.__T.rows = []; window.__T.hooks = []; window.__T.hook = null; window.__T.t0 = performance.now(); window.__T.on = true; });
const traceOff = () => E(() => { window.__T.on = false; return window.__T.rows; });
const hooksOf = () => E(() => window.__T.hooks);
const goto = (id) => E(async (id) => {
  if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 100));
    if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0 && window.__vm.cinemaRich.dev()?.info?.()?.id === id) break;
  }
}, id);
const fist = (ms) => E(async (ms) => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'fist', fist: true, fistProgress: 1, x: 720, y: 450 } }));
    await new Promise((r) => requestAnimationFrame(r));
  }
  window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } }));
}, ms);
// r84: giữ V như thật — bắt đầu, 2 s (vạch quét + camera nhích vào), bắn — mọi cách mở cùng có đoạn nhích (cùng đường tiến vào)
const vhold = () => E(async () => {
  const ev = (phase, progress) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  ev('start', 0);
  const t0 = performance.now();
  while (performance.now() - t0 < 2000) {
    await new Promise((r) => requestAnimationFrame(r));
    ev('progress', Math.min(1, (performance.now() - t0) / 2000));
  }
  ev('fire', 1);
});
const clickEl = async (sel) => {
  const b = await E((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  if (!b) return false;
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.click(b.x, b.y);
  return true;
};
/** Một đoạn camera trong vết: thời gian (ms) từ khung đầu tới khung cuối mang `kind`, tốc độ lớn nhất (đơn vị / ms). */
function seg(rows, kind) {
  const idx = rows.map((r, i) => (r.tw === kind ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const a = idx[0];
  const b = Math.min(rows.length - 1, idx.at(-1) + 1); // khung ngay sau (đã tới đích)
  // tốc độ trên cửa sổ 3 khung (bớt nhiễu nhịp khung của vết đo — vòng vẽ và vòng đo là hai rAF khác nhau)
  let vmax = 0;
  for (let i = a + 1; i < b; i++) {
    const dt = Math.max(1, rows[i + 1].t - rows[i - 1].t);
    vmax = Math.max(vmax, Math.abs(rows[i + 1].dist - rows[i - 1].dist) / dt);
  }
  // nhảy cóc: một khung dời quá 12 % quãng đường cả đoạn
  let jump = 0;
  const span = Math.abs(rows[b].dist - rows[a].dist) || 1;
  for (let i = a + 1; i <= b; i++) jump = Math.max(jump, Math.abs(rows[i].dist - rows[i - 1].dist) / span);
  const ms = Math.round(rows[idx.at(-1)].t - rows[a].t + (rows[a + 1] ? rows[a + 1].t - rows[a].t : 16));
  // hình dạng: tiến độ quãng đường theo thời gian (0..1) so với easeInOutCubic — cùng một đường cong êm ở mọi lần
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let shape = 0;
  const T = rows[b].t - rows[a].t || 1;
  for (let i = a; i <= b; i++) {
    const u = (rows[i].dist - rows[a].dist) / (rows[b].dist - rows[a].dist || 1);
    shape = Math.max(shape, Math.abs(u - ease(Math.min(1, (rows[i].t - rows[a].t) / T))));
  }
  return { ms, vmax, jump: +jump.toFixed(3), shape: +shape.toFixed(3), t0: rows[a].t, from: rows[a].dist, to: rows[b].dist };
}

const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Nội suy giá trị f(row) ở thời điểm tn (0..1 theo thời gian thật của đoạn [ta, ta + T]). */
function at(rows, ta, T, tn, f) {
  const x = ta + tn * T;
  for (let i = 1; i < rows.length; i++)
    if (rows[i].t >= x) {
      const a = rows[i - 1];
      const b = rows[i];
      const k = b.t > a.t ? (x - a.t) / (b.t - a.t) : 1;
      return f(a) + (f(b) - f(a)) * k;
    }
  return f(rows.at(-1));
}
/**
 * r82: nhịp trượt của một đoạn camera trong vết ('read' mở · 'read-out' đóng): khung trong đoạn, khung ngay sau (đã dừng), độ đơn
 * điệu (back: bước ngược chiều lớn nhất, px), độ dời / quãng (k = off/dist) theo đồng hồ của đoạn camera (m.t) và theo tiến độ
 * QUÃNG camera đo được (khoảng cách camera ↔ tâm nhìn), mép trên trên màn (Phẳng).
 */
function motionSeg(rows, kind) {
  const idx = rows.map((r, i) => (r.tw === kind ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const a = idx[0];
  const b = idx.at(-1);
  const inSeg = rows.slice(a, b + 1).filter((r) => r.m && r.m.phase === (kind === 'read' ? 'in' : 'out'));
  const after = rows[b + 1] ?? null;
  // gốc thời gian của đoạn: khung đầu trừ phần tiến độ đã chạy (đoạn bắt đầu giữa hai khung đo); T = thời gian đặt của đoạn
  const T = (inSeg[0]?.m.dur ?? 0) * 1000 || (after ?? rows[b]).t - rows[a].t;
  const ta = inSeg[0] ? inSeg[0].t - inSeg[0].m.t * T : rows[a].t;
  const dir = kind === 'read' ? -1 : 1; // mở: độ dời giảm · đóng: tăng
  let back = 0;
  let backTop = 0;
  for (let i = 1; i < inSeg.length; i++) {
    back = Math.max(back, -dir * (inSeg[i].m.off - inSeg[i - 1].m.off));
    if (inSeg[i].top != null && inSeg[i - 1].top != null && inSeg[i].mode === 'flat') backTop = Math.max(backTop, -dir * (inSeg[i].top - inSeg[i - 1].top));
  }
  const dist = inSeg[0]?.m.dist ?? 0;
  const k = (r) => (r.m && dist ? r.m.off / dist : 0);
  const start = kind === 'read' ? inSeg.find((r) => r.m.off < r.m.dist - 0.5) : null;
  // đóng: lệch giữa tiến độ trượt và đường cong bậc ba vào–ra theo đồng hồ của đoạn camera (m.t — thời gian camera đã đi, đồng
  // hồ kẹp bước ≤ 0,1 s nên không lệch vì một khung chậm) / tiến độ QUÃNG camera đo được ở mọi khung (độc lập với lớp đọc)
  let dCurve = 0;
  let dCam = 0;
  const from = rows[a].dist;
  const to = (after ?? rows[b]).dist;
  if (kind === 'read-out')
    for (const r of inSeg) {
      dCurve = Math.max(dCurve, Math.abs(k(r) - easeIO(r.m.t)));
      dCam = Math.max(dCam, Math.abs(k(r) - (r.dist - from) / (to - from || 1)));
    }
  const atT = (t) => {
    for (let i = 1; i < inSeg.length; i++)
      if (inSeg[i].m.t >= t) {
        const x0 = inSeg[i - 1].m.t;
        const x1 = inSeg[i].m.t;
        return k(inSeg[i - 1]) + (k(inSeg[i]) - k(inSeg[i - 1])) * (x1 > x0 ? (t - x0) / (x1 - x0) : 1);
      }
    return k(inSeg.at(-1));
  };
  // đường trượt theo TIẾN ĐỘ QUÃNG CAMERA (0..1) — so giữa các chu kỳ: không phụ thuộc khung chậm của máy (đồng hồ camera kẹp
  // bước ≤ 0,1 s), chỉ đổi nếu tấm và camera thôi đi cùng nhau (đoạn bị cắt / lái lại / quãng trượt khác)
  const uc = (r) => (r.dist - from) / (to - from || 1);
  const byU = (u) => {
    for (let i = 1; i < inSeg.length; i++) {
      const x0 = uc(inSeg[i - 1]);
      const x1 = uc(inSeg[i]);
      if (x1 >= u) return k(inSeg[i - 1]) + (k(inSeg[i]) - k(inSeg[i - 1])) * (x1 > x0 ? (u - x0) / (x1 - x0) : 1);
    }
    return k(inSeg.at(-1));
  };
  const samples = (kind === 'read' ? [0.4, 0.55, 0.7, 0.85, 0.95] : [0.25, 0.5, 0.75]).map((u) => +byU(u).toFixed(4));
  return {
    frames: inSeg.length, ms: Math.round(T), dist, back: +back.toFixed(3), backTop: +backTop.toFixed(3), startT: start ? +start.m.t.toFixed(3) : null,
    mid: kind === 'read-out' ? +atT(0.5).toFixed(4) : null, dCurve: +dCurve.toFixed(3), dCam: +dCam.toFixed(3), samples,
    last: rows[b], after, ta, T, inSeg,
  };
}
/** Khung ngay sau đoạn mở: tấm đúng chỗ nghỉ (Phẳng: không transform, mép trên = ô nghỉ; 3D: đúng cao độ nghỉ), chữ hiện đủ. */
const atRest = (r, restTop) => !!r && !r.m && r.slide === 0 && r.op === 1 && r.text && r.fx?.every((f) => f.y === 0 && f.o === 1) && (r.mode === '3d' ? r.o3 && r.o3.y === r.o3.base : r.tr === '' && Math.abs(r.top - restTop) < 0.5);

// ---- A. 3 bia × 5 chu kỳ (Nổi 3D, mặc định) · C. 5 chu kỳ kiểu Phẳng
const CYCLES = [
  { open: 'read', close: 'btn' },
  { open: 'names', close: 'esc' },
  { open: 'vhold', close: 'fist' },
  { open: 'read', close: 'btn' },
  { open: 'vhold', close: 'esc' },
];
const R = { cycles: [], flat: [] };
async function runCycles(ids, out) {
  for (const id of ids) {
    await goto(id);
    await sleep(1200);
    for (const [k, c] of CYCLES.entries()) {
      const p = await E(() => window.__vm.cinemaStelePoint());
      await page.mouse.move(p.x, p.y, { steps: 4 });
      await sleep(1600);
      await traceOn();
      if (c.open === 'read') await clickEl('.lq-btn--read');
      else if (c.open === 'names') await clickEl('.lq-btn--names');
      else await vhold();
      await sleep(4400); // r84: (giữ V: đã chờ 2 s trong vhold() · nút: lượt quét 2 s — chờ thêm) + 2,8 s tiến vào + dư
      if (c.open !== 'vhold') await sleep(2000);
      const inRows = await traceOff();
      const rest = await E(() => ({ top: document.querySelector('.rd .rd-panel').getBoundingClientRect().top, rect: window.__vm.cinemaRich.dev().reader.state().rect?.y }));
      await page.mouse.move(p.x, p.y);
      await sleep(300);
      await traceOn();
      if (c.close === 'btn') await clickEl('.ri-ov.rd .ri-ov__close');
      else if (c.close === 'esc') await page.keyboard.press('Escape');
      else await fist(600);
      await sleep(2200);
      const outRows = await traceOff();
      out.push({ id, k, how: `${c.open}/${c.close}`, open: seg(inRows, 'read'), close: seg(outRows, 'read-out'), mIn: motionSeg(inRows, 'read'), mOut: motionSeg(outRows, 'read-out'), rest });
    }
  }
}
await runCycles(['bia-1442', 'bia-1670', 'bia-1565'], R.cycles);

// ---- B. thời gian là cài đặt: mặc định (2,8 s vào) · đóng 2,0 s
R.defaults = await E(() => { const s = window.__vm.settings.get?.() ?? {}; return { zin: s.readerZoomIn, zout: s.readerZoomOut, share: s.readerSlideShare }; });
await goto('bia-1442');
await sleep(1000);
await setS('readerZoomOut', 2.0);
// r83: tắt hiệu ứng chữ Hán (giữ nguyên nhịp đo như r82b — không sprite bay lúc tiến vào); bản dập vẫn chỉ là vệt lúc quét nhanh
// (r74 "ở lại suốt lúc đọc, tắt dần khi đóng" bỏ — kiểm: hiện lúc quét, hết trước khi đóng)
await setS('glyphFx', false);
{
  const p = await E(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(1600);
  await traceOn();
  await clickEl('.lq-btn--read'); // r84: lượt quét 2 s (vạch + camera nhích) rồi tiến vào
  await sleep(6400);
  R.bIn = await traceOff();
  R.bInHooks = await hooksOf();
  await traceOn();
  await page.keyboard.press('Escape');
  await sleep(3200);
  R.bOut = await traceOff();
  R.bOutHooks = await hooksOf();
}
await setS('readerZoomOut', 1.0);
await setS('glyphFx', true);

// ---- C. kiểu Phẳng: 5 chu kỳ
await setS('readerMode', 'flat');
await runCycles(['bia-1442'], R.flat);
await setS('readerMode', '3d');
await close();

// ---- D. giảm chuyển động (trình duyệt riêng — prefers-reduced-motion: reduce), Phẳng + Nổi 3D: một lần mở → đóng mỗi kiểu
{
  const rmB = await launch({
    headed,
    width: W,
    height: H,
    reducedMotion: true,
    settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, titleFxMode: 'fade', glyphFlyMode: 'whoosh' },
  });
  await openCinema(rmB.page, port, { id: 'bia-1442', hooks: ['cinemaStelePoint', 'cinemaRich', 'cinemaCam', 'cinemaScan', 'cinemaRead'], settleMs: 3000 });
  const E2 = (fn, a) => rmB.page.evaluate(fn, a);
  R.rm = {};
  for (const mode of ['flat', '3d']) {
    await E2(([k, v]) => window.__vm.settings.set(k, v), ['readerMode', mode]);
    const p = await E2(() => window.__vm.cinemaStelePoint());
    await rmB.page.mouse.move(p.x, p.y, { steps: 4 });
    await sleep(1200);
    await E2(() => {
      const T = (window.__T2 = { on: true, rows: [], t0: performance.now() });
      const rec = (t) => {
        if (!T.on) return;
        const st = window.__vm.cinemaRich.dev()?.reader?.state();
        const root = document.querySelector('.ri-ov.rd');
        const sl = document.querySelector('.rd .rd-slab');
        T.rows.push({ t: t - T.t0, open: !!st?.open, m: st?.motion ?? null, slide: st?.slide ?? 0, o3: st?.obj3 ? { y: st.obj3.y, base: st.obj3.base } : null, tr: st?.slab.transform ?? '', fx: st?.textFx ?? null, op: sl && root && !root.hidden ? +getComputedStyle(sl).opacity : 0, hidden: !!root?.hidden });
        requestAnimationFrame(rec);
      };
      requestAnimationFrame(rec);
    });
    await E2(() => window.__vm.cinemaRich.dev().read());
    await sleep(1800);
    const inRows = await E2(() => { const r = window.__T2.rows; window.__T2.rows = []; window.__T2.t0 = performance.now(); return r; });
    await rmB.page.keyboard.press('Escape');
    await sleep(1200);
    const outRows = await E2(() => { window.__T2.on = false; return window.__T2.rows; });
    R.rm[mode] = { inRows, outRows };
    await sleep(600);
  }
  errors.push(...rmB.errors);
  await rmB.close();
}

// ---------------------------------------------------------------------------- kiểm
/** r82: kiểm nhịp trượt của một loạt chu kỳ (mỗi chu kỳ: đơn điệu, đúng chỗ nghỉ, đường cong đóng; cùng đường trượt như chu kỳ đầu). */
function slideChecks(cycles, label) {
  const bad = [];
  const rows = [];
  for (const c of cycles) {
    const name = `${c.id} #${c.k + 1} ${c.how}`;
    const mi = c.mIn;
    const mo = c.mOut;
    if (!mi || !mo) {
      bad.push(`${name}: thiếu đoạn trượt (mở ${!!mi} · đóng ${!!mo})`);
      continue;
    }
    rows.push(`${name}: mở ${mi.frames} khung, bắt đầu trượt ở ${mi.startT}, mẫu ${mi.samples.join(' / ')} · đóng ${mo.frames} khung, giữa đoạn ${mo.mid}, lệch đường cong ${mo.dCurve} · camera ${mo.dCam}`);
    if (mi.back > 0.01) bad.push(`${name}: mở — tấm đi xuống ${mi.back} px ở một khung`);
    if (mi.backTop > 0.05) bad.push(`${name}: mở — mép trên trên màn đi xuống ${mi.backTop} px`);
    if (!atRest(mi.after, c.rest.top)) bad.push(`${name}: khung camera dừng — tấm không đúng chỗ nghỉ / chữ chưa đủ: ${JSON.stringify({ m: mi.after?.m, slide: mi.after?.slide, op: mi.after?.op, fx: mi.after?.fx, o3: mi.after?.o3, tr: mi.after?.tr, top: mi.after?.top, rest: c.rest.top })}`);
    if (!(mi.last?.m && mi.last.m.off < 1)) bad.push(`${name}: khung cuối của đoạn vào còn cách chỗ nghỉ ${mi.last?.m?.off} px`);
    if (mi.startT == null || Math.abs(mi.startT - 0.64) > 0.03) bad.push(`${name}: bắt đầu trượt ở ${mi.startT} (≈ 0,64)`);
    if (mo.back > 0.01) bad.push(`${name}: đóng — tấm đi lên ${mo.back} px ở một khung`);
    if (mo.backTop > 0.05) bad.push(`${name}: đóng — mép trên trên màn đi lên ${mo.backTop} px`);
    if (mo.mid == null || Math.abs(mo.mid - 0.5) > 0.05) bad.push(`${name}: đóng — giữa đoạn (thời gian) trượt ${mo.mid} (bậc ba vào–ra: 0,5)`);
    if (mo.dCurve > 0.06) bad.push(`${name}: đóng — lệch đường cong bậc ba vào–ra ${mo.dCurve}`);
    if (mo.dCam > 0.08) bad.push(`${name}: đóng — tiến độ trượt lệch tiến độ quãng camera ${mo.dCam}`);
    if (!(mo.last?.op <= 0.02)) bad.push(`${name}: đóng — khung cuối của đoạn lùi tấm còn hiện ${mo.last?.op}`);
    const late = mo.inSeg.filter((r) => (r.t - mo.ta) / mo.T > 0.33);
    if (!late.length || late.some((r) => r.fx?.some((f) => f.o > 0.001))) bad.push(`${name}: đóng — chữ chưa tắt hết sau 33 % đoạn lùi`);
  }
  const first = cycles[0];
  for (const c of cycles.slice(1)) {
    if (!c.mIn || !c.mOut || !first?.mIn || !first?.mOut) continue;
    const dIn = Math.max(...c.mIn.samples.map((v, i) => Math.abs(v - first.mIn.samples[i])));
    const dOut = Math.max(...c.mOut.samples.map((v, i) => Math.abs(v - first.mOut.samples[i])));
    if (dIn > 0.03 || dOut > 0.03) bad.push(`${c.id} #${c.k + 1}: đường trượt (theo tiến độ quãng camera) khác chu kỳ đầu (mở ${dIn.toFixed(3)} · đóng ${dOut.toFixed(3)})`);
  }
  report.check(`${label}: mở — tấm TRƯỢT LÊN đơn điệu từ ~42 % đoạn vào, khung cuối < 1 px, đúng chỗ nghỉ ngay khung camera dừng (không biến hình còn lại), chữ hiện đủ; đóng — TRƯỢT XUỐNG đơn điệu, tiến độ = bậc ba vào–ra theo đồng hồ đoạn camera (giữa đoạn 0,5 ± 0,05, lệch ≤ 0,06) và = tiến độ quãng camera (≤ 0,08), mờ hết đúng lúc camera dừng, chữ tắt trước 33 %; mọi chu kỳ cùng đường trượt theo tiến độ quãng camera (≤ 0,03)`, bad.length === 0, { bad, rows });
}
report.section('A. mở → đóng lặp lại (3 bia × 5 chu kỳ, nhiều cách mở / đóng)');
{
  const bad = [];
  const rows = [];
  for (const id of ['bia-1442', 'bia-1670', 'bia-1565']) {
    const cs = R.cycles.filter((c) => c.id === id);
    const first = cs[0];
    for (const c of cs) {
      rows.push(`${id} #${c.k + 1} ${c.how}: vào ${c.open?.ms ?? '—'} ms · lùi ${c.close?.ms ?? '—'} ms, tốc độ max ${c.close ? (c.close.vmax * 1000).toFixed(2) : '—'}/s, bước max ${c.close?.jump ?? '—'}, lệch đường cong ${c.close?.shape ?? '—'}`);
      if (!c.close || !first.close) {
        bad.push(`${id} #${c.k + 1}: không có đoạn lùi`);
        continue;
      }
      if (Math.abs(c.close.ms - first.close.ms) > 0.06 * first.close.ms) bad.push(`${id} #${c.k + 1}: lùi ${c.close.ms} ms ≠ lần đầu ${first.close.ms} ms`);
      if (Math.abs(c.close.vmax - first.close.vmax) > 0.12 * first.close.vmax) bad.push(`${id} #${c.k + 1}: tốc độ lùi max ${(c.close.vmax * 1000).toFixed(2)} ≠ lần đầu ${(first.close.vmax * 1000).toFixed(2)}`);
      if (c.close.jump > 0.12) bad.push(`${id} #${c.k + 1}: một khung dời ${Math.round(c.close.jump * 100)} % quãng (giật)`);
      if (c.close.shape > 0.06) bad.push(`${id} #${c.k + 1}: đường lùi lệch đường cong êm ${c.close.shape}`);
      if (!c.open || Math.abs(c.open.ms - first.open.ms) > 0.06 * first.open.ms) bad.push(`${id} #${c.k + 1}: vào ${c.open?.ms} ms ≠ lần đầu ${first.open?.ms} ms`);
    }
  }
  report.check('mọi lần đóng như lần đầu: thời gian lùi và tốc độ lùi lớn nhất trong vài % (≤ 6 % · ≤ 12 %), cùng đường cong êm (lệch ≤ 0,06), không khung nào nhảy cóc; lần mở cũng vậy', bad.length === 0, { bad, rows });
  const outs = R.cycles.map((c) => c.close?.ms).filter(Number.isFinite);
  report.check('thời gian lùi = cài đặt mặc định 1,0 s (±8 %) ở mọi lần', outs.length === R.cycles.length && outs.every((ms) => Math.abs(ms - 1000) <= 80), outs);
  const ins = R.cycles.map((c) => c.open?.ms).filter(Number.isFinite);
  report.check('thời gian tiến vào = cài đặt mặc định 2,8 s (±5 %) ở mọi lần', ins.length === R.cycles.length && ins.every((ms) => Math.abs(ms - 2800) <= 140), ins);
  slideChecks(R.cycles, 'r82 Nổi 3D (độ dời dọc trục đứng của bia, 3 bia × 5 chu kỳ)');
}
report.section('B. thời gian camera là cài đặt · các nhịp theo tỉ lệ');
report.check('mặc định: tiến vào 2,8 s · lùi ra 1,0 s · tấm trượt trong 36 % cuối đoạn vào (r84 — chữ Hán bay cùng camera, chữ tấm đọc sau đó)', R.defaults.zin === 2.8 && R.defaults.zout === 1 && R.defaults.share === 0.36, R.defaults);
{
  const a = seg(R.bIn, 'read');
  const mi = motionSeg(R.bIn, 'read');
  const T = a?.ms ?? 0;
  // mục lục: chưa hiện khi tấm còn đang trượt rõ (camera < 80 %), hiện đủ ≤ 0,8 s sau khi camera dừng
  const tocEarly = Math.max(0, ...R.bIn.filter((r) => r.m && r.m.t < 0.8).map((r) => r.toc));
  const tEnd = mi?.after?.t ?? Infinity;
  const tocFull = R.bIn.find((r) => r.t >= tEnd - 400 && r.toc >= 0.99);
  report.check(`mở (2,8 s): đoạn vào ${T} ms; tấm bắt đầu trượt ở ${mi?.startT} (1 − 0,36 = 0,64), tới chỗ nghỉ đúng khung camera dừng, chữ hiện đủ; mục lục hiện sau khi tấm tới nơi (lúc camera < 80 %: ${tocEarly.toFixed(2)}; đủ sau dừng ${tocFull ? Math.round(tocFull.t - tEnd) : '—'} ms)`, Math.abs(T - 2800) <= 140 && mi && Math.abs(mi.startT - 0.64) <= 0.03 && atRest(mi.after, R.bIn.at(-1).top) && tocEarly < 0.05 && tocFull && tocFull.t - tEnd <= 800, { T, startT: mi?.startT, after: mi?.after && { m: mi.after.m, slide: mi.after.slide, fx: mi.after.fx }, tocEarly, tocFullMs: tocFull ? Math.round(tocFull.t - tEnd) : null });
  const h = R.bInHooks;
  const hp = R.bIn.filter((r) => r.hp != null && r.m).map((r) => [r.hp, r.m.t]);
  const hDev = Math.max(0, ...hp.map(([x, y]) => Math.abs(x - y)));
  const hOk = h.length === 2 && h[0].k === 'open' && h[0].p === 0 && Math.abs(h[0].dur - 2.8) < 1e-6 && h[1].k === 'opened' && h[1].p === 1 && hp.length > 20 && hDev <= 0.02;
  report.check('móc mở: "reader:open" lúc camera bắt đầu tiến (progress 0, dur 2,8 s) → progress() bám tiến độ đoạn camera mỗi khung → "reader:opened" lúc dừng (progress 1)', hOk, { hooks: h, frames: hp.length, dev: +hDev.toFixed(4) });
}
{
  const b = seg(R.bOut, 'read-out');
  const mo = motionSeg(R.bOut, 'read-out');
  const T = b?.ms ?? 0;
  const rubIn = Math.max(0, ...R.bIn.map((r) => r.rub));
  const rubOut = Math.max(0, ...R.bOut.map((r) => r.rub));
  const textGone = mo?.inSeg.find((r) => r.fx?.every((f) => f.o === 0));
  const textAt = textGone ? (textGone.t - mo.ta) / mo.T : null;
  const tocGone = mo?.inSeg.find((r) => r.toc <= 0.02);
  const tocAt = tocGone ? (tocGone.t - mo.ta) / mo.T : null;
  report.check(`đóng (cài đặt 2,0 s): đoạn lùi ${T} ms; tấm trượt xuống theo bậc ba vào–ra suốt đoạn (giữa ${mo?.mid}, lệch ${mo?.dCurve}), mờ hết đúng lúc camera dừng (${mo?.last?.op}); chữ tắt ở ~30 % (${textAt?.toFixed(2)}), mục lục ở ~25 % (${tocAt?.toFixed(2)}); bản dập (r83 — chỉ vệt lúc quét): hiện lúc quét nhanh (${rubIn.toFixed(2)}), không ở lại — 0 suốt đoạn lùi (lớn nhất ${rubOut})`, Math.abs(T - 2000) <= 120 && mo && Math.abs(mo.mid - 0.5) <= 0.05 && mo.dCurve <= 0.06 && mo.back <= 0.01 && mo.last.op <= 0.02 && textAt != null && Math.abs(textAt - 0.3) <= 0.05 && tocAt != null && tocAt <= 0.35 && rubIn > 0.9 && rubOut <= 0.001, { T, mid: mo?.mid, dCurve: mo?.dCurve, lastOp: mo?.last?.op, textAt, tocAt, rubIn, rubOut, jump: b?.jump });
  const h = R.bOutHooks;
  const hp = R.bOut.filter((r) => r.hp != null && r.m).map((r) => [r.hp, r.m.t]);
  const hDev = Math.max(0, ...hp.map(([x, y]) => Math.abs(x - y)));
  report.check('móc đóng: "reader:close" (progress 0, dur 2,0 s, why) → progress() bám đoạn lùi → "reader:closed" (progress 1)', h.length === 2 && h[0].k === 'close' && h[0].p === 0 && Math.abs(h[0].dur - 2) < 1e-6 && h[1].k === 'closed' && h[1].p === 1 && hp.length > 20 && hDev <= 0.02, { hooks: h, frames: hp.length, dev: +hDev.toFixed(4) });
}
report.section('C. kiểu Phẳng (5 chu kỳ, bia 1442)');
report.check('cả 5 chu kỳ ở kiểu Phẳng', R.flat.length === 5 && R.flat.every((c) => c.mIn?.inSeg[0]?.mode === 'flat'), R.flat.map((c) => c.mIn?.inSeg[0]?.mode));
slideChecks(R.flat, 'r82 Phẳng (dịch trên màn + mép trên tấm trên màn đơn điệu)');
{
  const outs = R.flat.map((c) => c.close?.ms);
  report.check('Phẳng: thời gian lùi 1,0 s (±8 %) ở mọi lần, không khung nào nhảy cóc', outs.every((ms) => Math.abs(ms - 1000) <= 80) && R.flat.every((c) => c.close?.jump <= 0.12), { outs, jumps: R.flat.map((c) => c.close?.jump) });
}
report.section('D. giảm chuyển động: chỉ mờ chéo ngắn');
for (const mode of ['flat', '3d']) {
  const { inRows, outRows } = R.rm[mode] ?? { inRows: [], outRows: [] };
  const all = [...inRows, ...outRows];
  const moved = all.filter((r) => r.slide !== 0 || (r.m && r.m.off !== 0) || r.tr !== '' || (r.o3 && r.o3.y !== r.o3.base) || r.fx?.some((f) => f.y !== 0));
  const i0 = inRows.find((r) => r.open);
  const mid = inRows.filter((r) => r.op > 0.05 && r.op < 0.95);
  const full = inRows.find((r) => r.op >= 0.999);
  const midO = outRows.filter((r) => r.op > 0.05 && r.op < 0.95);
  const gone = outRows.find((r) => r.op <= 0.001 || r.hidden);
  const inMs = i0 && full ? Math.round(full.t - i0.t) : null;
  const outMs = gone ? Math.round(gone.t) : null;
  report.check(`${mode === '3d' ? 'Nổi 3D' : 'Phẳng'}: không khung nào trượt (độ dời 0, không transform, đúng cao độ nghỉ, chữ không nhô); độ hiện qua giá trị trung gian rồi đủ sau ${inMs} ms (mở), hết sau ${outMs} ms (đóng) — ≤ 600 ms`, all.length > 20 && moved.length === 0 && mid.length >= 1 && inMs != null && inMs <= 600 && midO.length >= 1 && outMs != null && outMs <= 600, { frames: all.length, moved: moved.slice(0, 3), mid: mid.length, inMs, midOut: midO.length, outMs });
}
process.exit(report.finish(errors));
