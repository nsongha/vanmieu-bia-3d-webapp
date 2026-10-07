// Hover bia (r27z · r30): "Zoom khi hover" — mức đặt → mức thật (kẹp theo kiểu thông tin + cỡ khung), khi hover đủ bia
// vẫn trọn trong khung, camera không giật lúc vào / ra / rời giữa chừng; vùng rê bia không gồm bục (≈ 1/3 dưới dành cho
// dòng thời gian), rời xuống không nhấp nháy, camera trôi về không làm hover lại (chuột + tay).
// node tests/cinema/hover.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('hover');
const allErrors = [];

// ================= 1. zoom khi hover (1024 × 768 — khung hẹp để phần kẹp có tác dụng)
{
const w = 1024, h = 768;
const { page, close, errors } = await launch({ headed, width: w, height: h, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaTimeline', 'cinemaCamTrace'], settleMs: 3000 });
const out = { w, h, levels: {}, hover: {} };
for (const info of ['screens', 'light', 'spread']) {
  await page.evaluate((i) => window.__vm.settings.set('cinemaInfo', i), info);
  await sleep(700);
  out.levels[info] = {};
  for (const z of [0.02, 0.07, 0.1, 0.12, 0.2, 0.25]) {
    await page.evaluate((z) => window.__vm.settings.set('cinemaHoverZoom', z), z);
    await sleep(60);
    const r = await page.evaluate(() => window.__vm.cinemaSelect().hoverZoom);
    out.levels[info][z] = `${r.effective}${r.by ? ' (' + r.by + ')' : ''}`;
  }
}
// hover đủ ở 12 % và 25 % (kiểu bình phong): bia trong khung? camera trace: không giật (vào, ra, rời giữa chừng)
await page.evaluate(() => window.__vm.settings.set('cinemaInfo', 'screens'));
await sleep(800);
for (const z of [0.12, 0.25]) {
  await page.evaluate((z) => window.__vm.settings.set('cinemaHoverZoom', z), z);
  await page.mouse.move(w - 6, h / 2); await sleep(2800);
  const p = await page.evaluate(() => window.__vm.cinemaStelePoint());
  await page.evaluate(() => window.__vm.cinemaCamTrace(true));
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await sleep(1300); // vào đủ (0,8 s)
  await page.mouse.move(p.x + 3, p.y + 2); await sleep(120); // một khung vẽ mới cho số đo camera
  const full = await page.evaluate(() => window.__vm.cinemaSelect().hoverZoom);
  await page.mouse.move(w - 6, h / 2, { steps: 2 }); // rời
  await sleep(700); // đang ra giữa chừng (2,5 s)
  const pp = await page.evaluate(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(pp.x, pp.y, { steps: 2 }); // rê lại giữa chừng
  await sleep(500);
  await page.mouse.move(w - 6, h / 2, { steps: 2 }); // rời giữa lúc đang vào
  await sleep(3000);
  const tr = await page.evaluate(() => window.__vm.cinemaCamTrace(false));
  // giật = bước dịch chuyển camera một khung lớn bất thường so với các khung kề (gấp 3 trung vị lân cận, > 2 mm)
  const steps = [];
  for (let i = 1; i < tr.length; i++) { const a = tr[i - 1], b = tr[i]; const pa = a.pos ?? a.p ?? a.cam, pb = b.pos ?? b.p ?? b.cam; if (!pa || !pb) continue; const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); steps.push({ t: b.t, d, dt: b.t - a.t }); }
  let jumps = 0, maxV = 0, maxAcc = 0;
  for (let i = 2; i < steps.length; i++) { const v0 = steps[i - 1].d / Math.max(1, steps[i - 1].dt), v1 = steps[i].d / Math.max(1, steps[i].dt); maxV = Math.max(maxV, v1); const acc = Math.abs(v1 - v0); maxAcc = Math.max(maxAcc, acc); if (acc > 0.002 && acc > 3 * Math.max(v0, 1e-6)) jumps++; }
  out.hover[z] = { effective: full.effective, by: full.by, f: full.f, lift: full.liftNow, steleNow: full.steleNow, band: full.band, frames: tr.length, sample0: Object.keys(tr[0] || {}).join(','), maxSpeed_mPerMs: +maxV.toFixed(5), maxDeltaV: +maxAcc.toFixed(5), jumps };
}
report.section('zoom khi hover');
report.info('mức thật theo kiểu thông tin', out.levels);
const num = (s) => parseFloat(s);
for (const [info, lv] of Object.entries(out.levels)) {
  const zs = Object.keys(lv).map(Number).sort((a, b) => a - b);
  const eff = zs.map((z) => num(lv[z]));
  report.check(`${info}: mức thật ≤ mức đặt và không giảm khi tăng`, eff.every((e, i) => e <= zs[i] + 1e-4 && (i === 0 || e >= eff[i - 1] - 1e-4)), lv);
}
for (const z of ['0.12', '0.25']) {
  const v = out.hover[z];
  report.check(`hover đủ ở ${z}: bia trọn trong khung`, v.steleNow && v.steleNow.top < 1 && v.steleNow.bot > -1, v.steleNow);
  report.check(`hover ${z}: camera không giật (vào / ra / rời giữa chừng)`, v.jumps === 0 && v.frames > 30, { jumps: v.jumps, frames: v.frames });
}
allErrors.push(...errors);
await close();
}

// ================= 2. mép dưới vùng rê bia (1440 × 900)
{
const w = 1440, h = 900;
const { page, close, errors } = await launch({ headed, width: w, height: h, settings: { autoRotate: false, cinemaIdleAutoplay: false, cinemaHoverFront: true, cinemaHoverZoom: 0.08, handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaHitAt', 'cinemaLatch'], settleMs: 4000 });
const E = (fn, a) => page.evaluate(fn, a);
// quét dọc cột giữa bia + hai cột lệch (±25 % bề ngang bia) → điểm trúng thấp nhất (px)
const scan = () => E(() => {
  const p = window.__vm.cinemaStelePoint();
  const cols = [p.x, p.x - 60, p.x + 60];
  let low = -1;
  for (const x of cols) for (let y = Math.round(innerHeight * 0.3); y < innerHeight; y += 2) if (window.__vm.cinemaHitAt(x, y) && y > low) low = y;
  const L = window.__vm.cinemaLatch(true).rect;
  const head = window.__vm.cinemaRub.head();
  return { hitBottomPct: +((low / innerHeight) * 100).toFixed(1), latchBottomPct: L ? +(((1 - L.y0) / 2) * 100).toFixed(1) : null, headYPct: head ? +((head.y / innerHeight) * 100).toFixed(1) : null, headBottomPct: head ? +(((head.y + head.r) / innerHeight) * 100).toFixed(1) : null };
});
const B = { size: `${w}x${h}` };
await page.mouse.move(w / 2, 30);
await sleep(1500);
B.defaultFrame = await scan();
// khung hover (chuột trên thân bia)
const p = await E(() => window.__vm.cinemaStelePoint());
await page.mouse.move(p.x, p.y, { steps: 4 });
await sleep(1600);
B.hoverFrame = { ...(await scan()), f: (await E(() => window.__vm.cinemaSelect().hoverZoom)).f };
// rời xuống dần phía dòng thời gian (chuột), ghi bật / tắt hover mỗi khung
const seqM = await E(async ([x0, y0]) => {
  const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
  const cv = document.querySelector('.cin-stage canvas');
  const rows = [];
  for (let y = y0; y < innerHeight - 4; y += 6) { cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x0, clientY: y, bubbles: true })); await w8(34); rows.push([Math.round((y / innerHeight) * 100), window.__vm.cinemaIdle().shown ? 1 : 0]); }
  // đứng yên dưới cùng 3 s (camera trôi về) — không được hover lại
  const tail = [];
  for (let k = 0; k < 30; k++) { await w8(100); tail.push(window.__vm.cinemaIdle().shown ? 1 : 0); }
  return { rows, tail };
}, [p.x, p.y]);
const togg = (a) => a.filter((v, i) => i && v !== a[i - 1]).length;
const offAt = seqM.rows.find((r) => !r[1]);
B.mouseLeaveDown = { hoverOffAtPct: offAt ? offAt[0] : null, toggles: togg(seqM.rows.map((r) => r[1])), reHoverWhileCameraReturns: seqM.tail.some((v) => v) };
// tay: cùng đường đi (lớp cử chỉ: hand:frame, chế độ tay)
await page.mouse.move(w / 2, 30); await sleep(2800);
const seqH = await E(async ([x0, y0]) => {
  const w8 = (ms) => new Promise((r) => setTimeout(r, ms));
  document.body.classList.add('gesture-on'); document.body.dataset.input = 'hand'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'hand' } }));
  const hf = (x, y) => window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, x, y, pose: 'open', engaged: true } }));
  for (let k = 0; k < 45; k++) { hf(x0, y0); await w8(33); }
  const on0 = window.__vm.cinemaIdle().shown;
  const rows = [];
  for (let y = y0; y < innerHeight - 4; y += 6) { hf(x0, y); await w8(34); rows.push([Math.round((y / innerHeight) * 100), window.__vm.cinemaIdle().shown ? 1 : 0]); }
  const tail = [];
  for (let k = 0; k < 30; k++) { hf(x0, innerHeight - 6); await w8(100); tail.push(window.__vm.cinemaIdle().shown ? 1 : 0); }
  window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } }));
  return { on0, rows, tail };
}, [p.x, p.y]);
const offH = seqH.rows.find((r) => !r[1]);
B.handLeaveDown = { hoverOnAtStart: seqH.on0, hoverOffAtPct: offH ? offH[0] : null, toggles: togg(seqH.rows.map((r) => r[1])), reHoverWhileCameraReturns: seqH.tail.some((v) => v) };
report.section('vùng rê bia (không gồm bục)');
report.info('đo', B);
// tia chỉ trúng TẤM BIA + rùa (không bục): điểm trúng thấp nhất ≈ đáy rùa; vùng giữ hover dừng trên ~80 % (bục ở dưới nữa)
const steleOnly = (f) => f.hitBottomPct <= f.headBottomPct + 1.5 && (f.latchBottomPct ?? 0) <= 80;
report.check('khung mặc định: vùng rê dừng ở đáy rùa (không gồm bục)', steleOnly(B.defaultFrame), B.defaultFrame);
report.check('khung hover: cũng vậy', steleOnly(B.hoverFrame), B.hoverFrame);
report.check('chuột rời xuống: tắt hover một lần, không nhấp nháy; camera trôi về không hover lại', B.mouseLeaveDown.toggles === 1 && !B.mouseLeaveDown.reHoverWhileCameraReturns, B.mouseLeaveDown);
report.check('tay rời xuống: tương tự', B.handLeaveDown.hoverOnAtStart && B.handLeaveDown.toggles === 1 && !B.handLeaveDown.reHoverWhileCameraReturns, B.handLeaveDown);
allErrors.push(...errors);
await close();
}
process.exit(report.finish(allErrors));
