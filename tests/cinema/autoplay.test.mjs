// Tự trình chiếu (r19 → r39): lướt → dừng ~10 s → lướt; KHÔNG thông tin, KHÔNG hiệu ứng hover — không đèn bục, không đổi
// đèn chính / đèn rọi, không vòng camera chính diện, không zoom; camera ở khung mặc định suốt lượt. Tự bật khi rảnh + Space;
// thao tác thật là dừng, rê lên bia thì hover như thường. Ghi vết mỗi khung bằng __vm.cinemaLightTrace (sel, đèn bục trên /
// dưới, mức đèn chính, góc + khoảng cách camera, vòng hover). r62 (người dùng: "thêm setting về duration cho mỗi bia ở auto
// play"): "Mỗi bia" (settings.cinemaAutoDwell 5 / 10 / 15 / 20 s, mặc định 10) — D: 5 s → nhịp ~5 s, vạch tiến độ trên dòng
// thời gian theo 5 s; đổi giữa chừng áp từ lượt dừng kế; giá trị lạ → 10. node tests/cinema/autoplay.test.mjs --port 5180  (≈ 1,5 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('autoplay');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: true, cinemaIdleAfter: 120, handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaLightTrace', 'cinemaIdle', 'cinemaCam'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const park = async () => { await page.mouse.move(150, 450, { steps: 4 }); await sleep(200); }; // nền trống bên trái bia

/** Chạy tự trình chiếu `ms` (start: 'idle' | 'space'), ghi vết ánh sáng + camera mỗi khung và trạng thái mỗi 150 ms. */
async function run(start, ms) {
  await park();
  await sleep(2500); // camera + đèn về nghỉ
  const base = await E(() => { window.__vm.cinemaLightTrace(true); return window.__vm.cinemaCam(); });
  if (start === 'idle') await E(() => window.__vm.cinemaIdle({ idleMs: 1e7 }));
  else {
    await E(() => document.querySelector('.cin-stage').focus({ preventScroll: true }));
    await page.keyboard.press(' ');
  }
  await sleep(100); // bật ở khung vẽ kế
  const st = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    st.push(await E(() => { const s = window.__vm.cinemaIdle(); const c = window.__vm.cinemaCam(); return { t: 0, playing: s.playing, mode: s.autoMode, shown: s.shown, i: s.index, off: c.off, camTw: c.camTw }; }));
    st.at(-1).t = Date.now() - t0;
    await sleep(150);
  }
  const trace = await E(() => window.__vm.cinemaLightTrace(false));
  const spread = (k) => { const v = trace.filter((f) => f.tw !== 'tx' && f.tx < 0).map(k); return v.length ? +(Math.max(...v) - Math.min(...v)).toFixed(4) : 0; };
  const steps = new Set(st.map((s) => s.i)).size - 1;
  // lượt lướt bắt đầu (tx 0 → > 0) — khoảng giữa hai lượt = thời gian dừng mỗi bia
  const starts = [];
  for (let k = 1; k < trace.length; k++) if (trace[k].tx >= 0 && trace[k - 1].tx < 0) starts.push(trace[k].t);
  const gaps = starts.slice(1).map((t, k) => t - starts[k]);
  return {
    base,
    frames: trace.length,
    selMax: Math.max(0, ...trace.map((f) => f.sel)),
    orbitMax: +Math.max(0, ...trace.map((f) => f.orbit)).toFixed(4),
    pedTopMax: +Math.max(0, ...trace.flatMap((f) => f.top)).toFixed(4),
    pedBottomMax: +Math.max(0, ...trace.flatMap((f) => f.bottom)).toFixed(4),
    lightMixSpread: spread((f) => f.mix),
    lightESpread: spread((f) => f.e),
    camAzSpread: spread((f) => f.camAz),
    // camera so với khung mặc định CỦA BIA ĐANG HIỆN (mỗi bia một khung) — ngoài lúc đang lướt
    camOffMax: +Math.max(0, ...st.filter((x) => !x.camTw).map((x) => x.off)).toFixed(4),
    shownEver: st.some((s) => s.shown),
    playingAll: st.every((s) => s.playing),
    mode: st[0]?.mode,
    steps,
    gaps,
  };
}
const quietChecks = (label, r) => {
  report.check(`${label}: không bật đèn bục / không "chọn" bia (sel 0, đèn bục trên + dưới 0)`, r.selMax === 0 && r.pedTopMax === 0 && r.pedBottomMax === 0, { sel: r.selMax, top: r.pedTopMax, bottom: r.pedBottomMax });
  report.check(`${label}: đèn chính / đèn rọi không đổi`, r.lightMixSpread === 0 && r.lightESpread === 0, { mix: r.lightMixSpread, e: r.lightESpread });
  report.check(`${label}: camera đứng ở khung mặc định (không vòng chính diện, không zoom)`, r.orbitMax === 0 && r.camAzSpread < 0.01 && r.camOffMax < 1e-3, { orbit: r.orbitMax, az: r.camAzSpread, off: r.camOffMax });
};

// ---------- A. rảnh → tự trình chiếu
report.section('tự trình chiếu khi rảnh');
const A = await run('idle', 23000);
report.info('A', { steps: A.steps, gaps: A.gaps, frames: A.frames });
report.check('chạy, đi qua ≥ 2 bia', A.playingAll && A.mode === 'idle' && A.steps >= 2, { steps: A.steps });
report.check('không hiện thông tin', !A.shownEver);
quietChecks('A', A);
report.check('nhịp: ~10 s giữa hai lượt lướt', A.gaps.length >= 1 && A.gaps.every((g) => g > 9000 && g < 11500), A.gaps);
// thao tác thật → dừng; rê lên bia → hover như thường (thông tin + đèn + camera)
const p = await E(() => window.__vm.cinemaStelePoint());
await page.mouse.move(p.x - 20, p.y, { steps: 3 });
await page.mouse.move(p.x, p.y, { steps: 3 });
await sleep(1500);
const afterMove = await E(() => ({ playing: window.__vm.cinemaIdle().playing, shown: window.__vm.cinemaIdle().shown, sel: window.__vm.cinemaSelect().target }));
report.check('rê chuột thật → dừng tự trình chiếu', afterMove.playing === false);
report.check('… và hover bia lại như thường (thông tin + chọn bia)', afterMove.shown === true && afterMove.sel === true, afterMove);

// ---------- B. Space: tự chuyển tay
report.section('Space');
const B = await run('space', 12500);
report.check('Space bật tự chuyển (▶ tay), đi qua ≥ 1 bia', B.playingAll && B.mode !== 'idle' && B.steps >= 1, { mode: B.mode, steps: B.steps });
report.check('không hiện thông tin', !B.shownEver);
quietChecks('B', B);
await page.keyboard.press(' ');
await sleep(300);
report.check('Space lần nữa → dừng', (await E(() => window.__vm.cinemaIdle().playing)) === false);

// ---------- C. cài đặt: không còn công tắc "Hiện thông tin khi trình chiếu"
await page.click('.cin-gear'); await sleep(400);
await page.getByRole('tab', { name: 'Thông tin' }).click(); await sleep(300);
const hasToggle = await E(() => [...document.querySelectorAll('.cin-setwrap .sp-name')].some((e) => /Hiện thông tin khi trình chiếu/.test(e.textContent)));
report.check('Cài đặt: không còn "Hiện thông tin khi trình chiếu"', hasToggle === false);
await page.keyboard.press('Escape');
await sleep(300);

// ---------- D. (r62) "Mỗi bia" — thời gian dừng mỗi bia
report.section('Mỗi bia (r62)');
await page.click('.cin-gear'); await sleep(400);
await page.getByRole('tab', { name: 'Thông tin' }).click(); await sleep(300);
const chips = await E(() => {
  const head = [...document.querySelectorAll('.cin-setwrap .sp-rowhead .sp-name')].find((e) => e.textContent.trim() === 'Mỗi bia');
  const grp = head?.parentElement?.nextElementSibling;
  return { head: !!head, opts: grp ? [...grp.querySelectorAll('.sp-opt')].map((b) => b.textContent.trim()) : [], on: grp?.querySelector('.sp-opt[aria-checked="true"]')?.textContent.trim() ?? null, afterSau: (() => { const names = [...document.querySelectorAll('.cin-setwrap .sp-name')].map((e) => e.textContent.trim()); return names.indexOf('Mỗi bia') === names.indexOf('Sau') + 1; })() };
});
report.check('Cài đặt → Thông tin → Tự trình chiếu: "Mỗi bia" 5 / 10 / 15 / 20 s, ngay dưới "Sau", mặc định 10 s', chips.head && chips.opts.join(',') === '5 s,10 s,15 s,20 s' && chips.on === '10 s' && chips.afterSau, chips);
// bấm chip 5 s (như người dùng)
await E(() => { const head = [...document.querySelectorAll('.cin-setwrap .sp-rowhead .sp-name')].find((e) => e.textContent.trim() === 'Mỗi bia'); [...head.parentElement.nextElementSibling.querySelectorAll('.sp-opt')].find((b) => b.textContent.trim() === '5 s').click(); });
await sleep(200);
const set5 = await E(() => window.__vm.settings.get().cinemaAutoDwell);
await page.keyboard.press('Escape');
await sleep(300);
// Space (▶ tay) với 5 s: nhịp ~5 s, vạch tiến độ theo 5 s
await park();
await sleep(2500);
await E(() => document.querySelector('.cin-stage').focus({ preventScroll: true }));
await page.keyboard.press(' ');
await sleep(150);
const prog = [];
const tP = Date.now();
while (Date.now() - tP < 4200) {
  prog.push(await E(() => { const s = window.__vm.cinemaIdle(); const run = document.querySelector('.cin-tl__run, .cin-tl2__run'); const m = /scaleX\(([-\d.e]+)\)/.exec(run?.style.transform ?? ''); return { autoMs: s.autoMs, dwellMs: s.dwellMs, progress: s.progress, bar: m ? +m[1] : null, i: s.index }; }));
  await sleep(120);
}
await page.keyboard.press(' ');
await sleep(300);
const D = await run('space', 16500);
await page.keyboard.press(' ');
await sleep(300);
report.info('D (5 s)', { gaps: D.gaps, steps: D.steps });
const ps = prog.filter((p) => p.autoMs > 200 && p.autoMs < 4800);
const mid = ps.find((p) => p.autoMs >= 2300 && p.autoMs <= 2800);
report.check('bấm chip 5 s → cinemaAutoDwell = 5', set5 === 5, { set5 });
report.check('▶ tay (Space) với 5 s: nhịp ~5 s giữa hai lượt lướt (4,5–6 s)', D.gaps.length >= 2 && D.gaps.every((g) => g > 4500 && g < 6000), D.gaps);
report.check('vạch tiến độ theo 5 s: tiến độ = đã đếm / 5000 (±0,03), ~0,5 ở 2,5 s; vạch trên dòng thời gian khớp', ps.length > 10 && ps.every((p) => p.dwellMs === 5000 && Math.abs(p.progress - p.autoMs / 5000) < 0.03 && (p.bar == null || Math.abs(p.bar - p.progress) < 0.06)) && !!mid && Math.abs(mid.progress - 0.5) < 0.07, { n: ps.length, mid, bad: ps.filter((p) => !(p.dwellMs === 5000 && Math.abs(p.progress - p.autoMs / 5000) < 0.03)).slice(0, 2) });
// đổi giữa chừng: áp từ lượt dừng KẾ (lượt đang dừng giữ thời gian đã chốt)
await park();
await sleep(1500);
await E(() => document.querySelector('.cin-stage').focus({ preventScroll: true }));
await page.keyboard.press(' ');
await sleep(1500);
await E(() => window.__vm.settings.set('cinemaAutoDwell', 15));
await sleep(200);
const ch0 = await E(() => window.__vm.cinemaIdle());
await page.waitForFunction((i) => window.__vm.cinemaIdle().index !== i, ch0.index, { timeout: 9000, polling: 100 }).catch(() => {});
await sleep(2200);
const ch1 = await E(() => window.__vm.cinemaIdle());
await page.keyboard.press(' ');
await sleep(300);
report.check('đổi 5 → 15 s giữa lượt: lượt đang dừng giữ 5 s, lượt kế theo 15 s', ch0.dwellMs === 5000 && ch0.dwellSetMs === 15000 && ch1.dwellMs === 15000, { ch0: { dwellMs: ch0.dwellMs, set: ch0.dwellSetMs }, ch1: { dwellMs: ch1.dwellMs } });
// giá trị lạ → mặc định 10 s
await E(() => window.__vm.settings.set('cinemaAutoDwell', 7));
const odd = await E(() => window.__vm.cinemaIdle().dwellSetMs);
await E(() => window.__vm.settings.set('cinemaAutoDwell', 10));
report.check('giá trị lạ (7) → dùng 10 s', odd === 10000, { odd });

await close();
process.exit(report.finish(errors));
