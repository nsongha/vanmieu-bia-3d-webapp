// r41 — đầu lượt lướt không còn việc nền chen vào (khựng 28–80 ms trước r41, đúng lúc cú vẩy hai ngón vừa phát và tay còn
// đang di): trong lúc lướt tới bia hàng xóm đã tải sẵn —
//   · không lời gọi GL đồng bộ gl.getParameter nào (trước: copyTextureToTexture của three hỏi 5 lần mỗi dải chữ khắc / texture);
//   · không đẩy dải texture nào (chữ khắc ±1 lên GPU, nung LOD0) và không tải LOD0 của bia vừa vào cửa sổ ±2 — các việc đó
//     chờ lúc yên (whenCalm) rồi mới chạy, và có chạy thật sau khi lướt xong;
//   · (thông tin) khoảng cách lớn nhất giữa hai lượt vòng vẽ trong 700 ms đầu — kiểm lỏng (< 50 ms), vì số đo phụ thuộc máy.
// node tests/cinema/glide-start.test.mjs --port 5180   (≈ 1 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('glide-start');
const { page, ctx, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await ctx.addInitScript(() => {
  const R = (window.__R = { on: false, gl: {}, fetches: [], loops: [] });
  const P = window.WebGL2RenderingContext?.prototype;
  for (const nm of ['getParameter', 'texSubImage2D', 'compressedTexSubImage2D', 'copyTexSubImage2D']) {
    const f = P?.[nm];
    if (typeof f !== 'function') continue;
    P[nm] = function (...a) {
      if (R.on) R.gl[nm] = (R.gl[nm] ?? 0) + 1;
      return f.apply(this, a);
    };
  }
  const rawFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    if (R.on && /lod0\.glb/.test(url)) R.fetches.push({ t: performance.now(), url: url.split('/').slice(-2).join('/') });
    return rawFetch(input, init);
  };
  const rawRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    rawRaf((ts) => {
      if (!R.on || cb.name !== 'loop') return cb(ts);
      const t = performance.now();
      try {
        return cb(ts);
      } finally {
        if (performance.now() - t > 0.03) R.loops.push(t);
      }
    });
});
await openCinema(page, port, { hooks: ['cinemaTxProgress', 'cinemaLods', 'cinemaIdle'], settleMs: 12000 });
await page.mouse.move(150, 450);
const E = (fn, a) => page.evaluate(fn, a);
const glideS = await E(() => window.__vm.settings.get().glideDuration);

const rows = [];
for (let g = 0; g < 3; g++) {
  const idx0 = await E(() => window.__vm.cinemaIdle().index);
  await E(() => Object.assign(window.__R, { on: true, gl: {}, fetches: [], loops: [] }));
  const tKey = await E(() => performance.now());
  await page.keyboard.press('ArrowRight');
  // trong lúc lướt
  await page.waitForFunction(() => window.__vm.cinemaTxProgress() < 0, null, { timeout: 8000, polling: 20 }).catch(() => {});
  const during = await E(() => ({ gl: { ...window.__R.gl }, fetches: window.__R.fetches.slice(), loops: window.__R.loops.slice(), end: performance.now() }));
  // sau khi yên: việc đã hoãn có chạy
  await E(() => Object.assign(window.__R, { gl: {}, fetches: [] }));
  await sleep(4500);
  const after = await E(() => ({ gl: { ...window.__R.gl }, fetches: window.__R.fetches.slice() }));
  await E(() => (window.__R.on = false));
  const L = during.loops.filter((t) => t >= tKey - 20 && t <= tKey + 700);
  let maxGap = 0;
  for (let i = 1; i < L.length; i++) maxGap = Math.max(maxGap, L[i] - L[i - 1]);
  const idx1 = await E(() => window.__vm.cinemaIdle().index);
  const r = { g, stepped: idx1 - idx0, txMs: Math.round(during.end - tKey), during: { ...during.gl, lod0Fetch: during.fetches.map((f) => `${f.url}@${Math.round(f.t - tKey)}`) }, after: { ...after.gl, lod0Fetch: after.fetches.map((f) => f.url) }, maxGapMs: +maxGap.toFixed(1) };
  rows.push(r);
  report.info(`lướt ${g + 1}`, r);
  await sleep(1500);
}
report.check('mỗi cú bấm đổi đúng một bia', rows.every((r) => r.stepped === 1), rows.map((r) => r.stepped));
report.check('lúc lướt: không gl.getParameter nào', rows.every((r) => !r.during.getParameter), rows.map((r) => r.during.getParameter ?? 0));
report.check('lúc lướt: không đẩy dải texture nào (chữ khắc / nung chờ lúc yên)', rows.every((r) => !r.during.texSubImage2D && !r.during.compressedTexSubImage2D), rows.map((r) => r.during));
report.check('lúc lướt: không tải LOD0 của bia vừa vào cửa sổ', rows.every((r) => r.during.lod0Fetch.length === 0), rows.map((r) => r.during.lod0Fetch));
report.check('sau khi yên: LOD0 của bia vừa vào cửa sổ được tải', rows.every((r) => r.after.lod0Fetch.length >= 1), rows.map((r) => r.after.lod0Fetch));
report.check('sau khi yên: chữ khắc ±1 lên GPU (đẩy dải)', rows.every((r) => (r.after.texSubImage2D ?? 0) > 0), rows.map((r) => r.after.texSubImage2D ?? 0));
report.check('sau khi yên: vẫn không gl.getParameter nào', rows.every((r) => !r.after.getParameter), rows.map((r) => r.after.getParameter ?? 0));
report.check(`khoảng giữa hai lượt vẽ đầu lượt lướt < 50 ms (thông tin — phụ thuộc máy)`, rows.every((r) => r.maxGapMs < 50), rows.map((r) => r.maxGapMs));
await close();
process.exit(report.finish(errors));
