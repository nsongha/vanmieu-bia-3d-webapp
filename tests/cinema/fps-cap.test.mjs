// r40 — "FPS tối đa" (Cài đặt → Hiển thị: 30 / 60 / 120, mặc định 60) + giảm tải GPU khi tay đang điều khiển.
//   A. trần giữ đúng: vẽ liên tục (tắt vẽ theo yêu cầu) → số khung vẽ / giây ≈ trần; rAF của trình duyệt chạy KHÔNG giới
//      hạn (--disable-gpu-vsync --disable-frame-rate-limit) nên chỉ còn trần của app giới hạn; đồng hồ FPS hiện trần.
//   B. thời lượng lướt không đổi ở mọi trần (view:transition bật → tắt ≈ Thời gian lướt); tiến độ bám thời gian thật
//      (dt thật — trần thấp không làm lướt chậm đi), số khung lướt / giây ≤ trần.
//   C. tay đang điều khiển (body[data-hand-active]) + đang lướt: gương lòng bục vẽ cách khung; không tay: như cũ.
// node tests/cinema/fps-cap.test.mjs --port 5180   (≈ 1,5 phút)
import os from 'node:os';
import path from 'node:path';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('fps-cap');
const { page, close, errors } = await launch({
  headed,
  settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, showFps: true },
  extraArgs: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
await openCinema(page, port, { hooks: ['cinemaRenderStats', 'cinemaRenderOnDemand', 'cinemaTxProgress'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
await page.mouse.move(150, 450); // con trỏ ngoài bia (không hover)
await sleep(500);
const setCap = (v) => E((v) => window.__vm.settings.set('maxFps', v), v);
// đếm rAF của trình duyệt song song (chứng minh trình duyệt chạy nhanh hơn trần)
await E(() => {
  const R = (window.__raf = { n: 0 });
  const f = () => {
    R.n++;
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
const glideS = await E(() => window.__vm.settings.get().glideDuration);

// ---------------------------------------------------------------- A. trần giữ đúng
report.section('A. trần khung hình');
await E(() => window.__vm.cinemaRenderOnDemand(false));
const A = {};
for (const cap of [30, 60, 120]) {
  await setCap(cap);
  await sleep(700);
  await E(() => {
    window.__vm.cinemaRenderStats(true);
    window.__raf.n = 0;
    window.__raf.t0 = performance.now();
  });
  await sleep(3000);
  const r = await E(() => ({ st: window.__vm.cinemaRenderStats(), raf: (window.__raf.n * 1000) / (performance.now() - window.__raf.t0), meter: document.querySelector('.fps-meter')?.textContent ?? '' }));
  A[cap] = { gpuFps: r.st.gpuFps, rafFps: +r.raf.toFixed(1), meter: r.meter };
  report.info(`trần ${cap}`, A[cap]);
  // rAF chạy nhanh hơn trần → trần của app mới là thứ giới hạn; khung vẽ ≈ trần (±8 %), không vượt quá trần
  const limiter = Math.min(cap, r.raf);
  report.check(`trần ${cap}: khung vẽ ≈ ${cap}/s (rAF trình duyệt ${Math.round(r.raf)}/s)`, r.st.gpuFps <= cap * 1.04 && r.st.gpuFps >= limiter * 0.92, A[cap]);
  report.check(`trần ${cap}: đồng hồ FPS hiện trần`, r.meter.includes(`/ ${cap} fps`), r.meter);
}
report.check('rAF trình duyệt thật sự nhanh hơn 120/s (phép đo trần có nghĩa)', A[120].rafFps > 130, A[120].rafFps);
await E(() => window.__vm.cinemaRenderOnDemand(true));

// ---------------------------------------------------------------- B. thời lượng lướt ở mọi trần
report.section('B. lướt ở mọi trần');
await E(() => {
  const L = (window.__L = { on: false, rows: [], ev: [] });
  window.addEventListener('view:transition', (e) => L.on && L.ev.push({ t: performance.now(), ...(e.detail || {}) }));
  let lastP = -2;
  const f = () => {
    if (L.on) {
      const p = window.__vm.cinemaTxProgress();
      if (p !== lastP) L.rows.push({ t: performance.now(), p });
      lastP = p;
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
const B = {};
for (const cap of [30, 60, 120]) {
  await setCap(cap);
  await sleep(600);
  await E(() => Object.assign(window.__L, { on: true, rows: [], ev: [] }));
  await page.keyboard.press('ArrowRight');
  await sleep(glideS * 1000 + 900);
  const L = await E(() => {
    window.__L.on = false;
    return { rows: window.__L.rows, ev: window.__L.ev };
  });
  const start = L.ev.find((e) => e.active);
  const end = L.ev.find((e) => e.active === false && start && e.t >= start.t);
  const ms = start && end ? end.t - start.t : null;
  const tx = L.rows.filter((r) => r.p >= 0);
  const mono = tx.slice(1).every((r, i) => r.p >= tx[i].p);
  // tiến độ theo thời gian thật: p ≈ (t − t₀) / thời lượng (t₀ = khung đầu). Lệch lớn nhất (ms quy đổi) — trần thấp mà
  // chuyển động dùng số khung thay vì dt thật thì lệch này lớn dần theo thời gian.
  const t0 = tx.length ? tx[0].t - tx[0].p * glideS * 1000 : 0;
  const lag = tx.reduce((m, r) => Math.max(m, Math.abs(r.p * glideS * 1000 - (r.t - t0))), 0);
  const gaps = tx.slice(1).map((r, i) => r.t - tx[i].t);
  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  const perSec = tx.length && ms ? (tx.length * 1000) / ms : 0;
  B[cap] = { ms: ms && Math.round(ms), frames: tx.length, perSec: +perSec.toFixed(1), lagMs: Math.round(lag), maxGapMs: Math.round(maxGap), atGap: gaps.indexOf(maxGap) };
  report.info(`trần ${cap}`, B[cap]);
  report.check(`trần ${cap}: lướt dài ≈ ${glideS} s`, ms != null && Math.abs(ms - glideS * 1000) <= 1000 / cap + 90, B[cap]);
  report.check(`trần ${cap}: tiến độ bám thời gian thật (lệch ≤ 2 khung + 40 ms)`, mono && lag <= 2000 / cap + 40, B[cap]);
  report.check(`trần ${cap}: số khung lướt / giây ≤ trần`, perSec <= cap * 1.06, B[cap]);
  await sleep(700);
}
// hình giữa lượt lướt ở trần 30 — để soát bằng mắt (thư mục tạm của máy)
await setCap(30);
await sleep(500);
await page.keyboard.press('ArrowRight');
await sleep(glideS * 500);
const shot = path.join(os.tmpdir(), 'vm-fps-cap-30-glide.png');
await page.screenshot({ path: shot });
report.info('ảnh giữa lượt lướt ở trần 30', shot);
await sleep(glideS * 500 + 800);

// ---------------------------------------------------------------- C. tay đang điều khiển
report.section('C. tay đang điều khiển');
await setCap(60);
await sleep(500);
// đếm lượt gương (render vào render target khác màn hình, trừ khi ghép ảnh) + khung chính trong lúc lướt
await E(() => {
  const r = [...window.__vm.renderers].pop().renderer;
  const P = (window.__P = { main: 0, mirror: 0, on: false, cam: null });
  const orig = r.render.bind(r);
  r.render = (scene, cam) => {
    if (r.getRenderTarget() === null && cam.isPerspectiveCamera) {
      P.cam = cam; // camera chính (lượt ra màn hình)
      if (P.on) P.main++;
    } else if (P.on && cam.isPerspectiveCamera && cam !== P.cam) P.mirror++; // camera ảo của gương (ghép ảnh dùng camera chính)
    return orig(scene, cam);
  };
});
const glideCount = async (hand) => {
  await E((h) => {
    if (h) document.body.dataset.handActive = '1';
    else delete document.body.dataset.handActive;
    Object.assign(window.__P, { main: 0, mirror: 0, on: true });
  }, hand);
  await page.keyboard.press('ArrowRight');
  await sleep(glideS * 1000 + 100);
  const r = await E(() => {
    window.__P.on = false;
    return { main: window.__P.main, mirror: window.__P.mirror };
  });
  await sleep(900);
  return r;
};
const noHand = await glideCount(false);
const withHand = await glideCount(true);
const noHand2 = await glideCount(false);
await E(() => delete document.body.dataset.handActive);
const ratio = (x) => +(x.mirror / Math.max(1, x.main)).toFixed(2);
report.info('lượt gương / khung chính khi lướt', { khôngTay: ratio(noHand), tay: ratio(withHand), khôngTayLại: ratio(noHand2) });
report.check('lướt + tay: lượt gương mỗi khung còn ≈ một nửa', ratio(withHand) <= ratio(noHand) * 0.62 && ratio(noHand) > 0.5, { noHand, withHand });
report.check('thôi tay: gương lại vẽ mọi khung khi lướt', Math.abs(ratio(noHand2) - ratio(noHand)) <= ratio(noHand) * 0.2, { noHand, noHand2 });

await close();
process.exit(report.finish(errors));
