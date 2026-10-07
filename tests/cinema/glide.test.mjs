// Thời gian lướt (r35 · Cài đặt → Chuyển cảnh → "Thời gian lướt"): thời lượng thật của lượt lướt theo cài đặt (0,8 / 1,6 /
// 2,4 s), khoá đổi bia + cổng đổi bia của lớp cử chỉ (view:transition.ms) theo đúng thời lượng đó, đổi giữa chừng chỉ áp
// cho lượt sau, bia xa (proxy) ở 0,8 s vẫn lên rồi nâng LOD, giảm chuyển động → tức thời.
// node tests/cinema/glide.test.mjs --port 5180
import { launch, parseArgs, sleep } from '../lib/browser.mjs';
import { allowSyntheticPointerCapture } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('glide');
const allErrors = [];
const R = {};
async function open({ reduce = false } = {}) {
  const b = await launch({ headed, reducedMotion: reduce, settings: { autoRotate: false, cinemaIdleAutoplay: false, transition: 'glide', handTutorial: false } });
  b.errs = b.errors;
  await b.page.goto(`http://localhost:${port}/#/cinema/bia-1554`);
  await b.page.waitForFunction(() => { const x = document.querySelector('.cin-boot'); return x && (x.dataset.state === 'done' || x.dataset.state === 'gone') && window.__vm?.cinemaTxProgress && window.__vmHand?.simulate; }, null, { timeout: 150000 });
  await sleep(2500);
  // ghi mỗi khung: tiến độ chuyển cảnh + khoá; ghi sự kiện view:transition
  await b.page.evaluate(() => {
    const host = document.querySelector('.cinema');
    const L = (window.__L = { on: false, rows: [], ev: [], t0: 0 });
    window.addEventListener('view:transition', (e) => { if (L.on) L.ev.push({ t: Math.round(performance.now() - L.t0), ...(e.detail || {}) }); });
    const tick = () => {
      if (L.on) L.rows.push({ t: Math.round(performance.now() - L.t0), p: +window.__vm.cinemaTxProgress().toFixed(3), lock: host.dataset.navlock ?? '' });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    L.start = () => { L.rows = []; L.ev = []; L.t0 = performance.now(); L.on = true; };
    L.stop = () => { L.on = false; return { rows: L.rows, ev: L.ev }; };
  });
  return b;
}
const summarize = ({ rows, ev }) => {
  const txRows = rows.filter((r) => r.p >= 0);
  const first = txRows[0];
  const last = txRows[txRows.length - 1];
  const endRow = first ? rows.find((r) => r.t > last.t) : null;
  const lockOn = rows.find((r) => r.lock === '1');
  const lockOff = lockOn ? rows.find((r) => r.t > lockOn.t && r.lock !== '1') : null;
  const start = ev.find((e) => e.active);
  const end = ev.find((e) => e.active === false && start && e.t >= start.t);
  return { evMs: start ? Math.round(start.ms) : null, txMs: start && end ? end.t - start.t : null, framesSeen: txRows.length, lockMs: lockOn && lockOff ? lockOff.t - lockOn.t : null, unlockVsEnd: lockOff && end ? lockOff.t - end.t : null };
};

{
  const { page, close, errs } = await open();
  const E = (fn, a) => page.evaluate(fn, a);
  const setD = (d) => E((d) => window.__vm.settings.set('glideDuration', d), d);
  // ---- T: 0,8 / 1,6 / 2,4 s — bấm → (view:transition.ms, thời lượng thật, khoá đổi bia)
  {
    R.T = {};
    for (const d of [0.8, 1.6, 2.4]) {
      await setD(d);
      await E(() => window.__L.start());
      await page.keyboard.press('ArrowRight');
      await sleep(d * 1000 + 1200);
      R.T[d] = summarize(await E(() => window.__L.stop()));
      await sleep(600);
    }
  }
  // ---- G: cổng đổi bia của lớp cử chỉ (vẩy hai ngón qua __vmHand.simulate): r52 — vẩy lúc đang lướt bị BỎ ở cổng của lớp
  //      tay (không xếp hàng — chỉ chuột / phím xếp hàng một lượt; vẩy liên tục thật thì nhảy 5, xem tests/gesture/vswipe-live);
  //      vẩy sau khi lướt xong → đổi bia ngay. SWIPE_LEFT hai ngón = nửa trái vẩy trái = bia TRƯỚC (ArrowLeft)
  {
    R.G = {};
    // (nhật ký hành động của lớp cử chỉ chỉ giữ 5 dòng → đếm phím tổng hợp nó gửi thay vì đọc nhật ký)
    await E(() => { window.__K = []; window.addEventListener('keydown', (e) => { if (!e.isTrusted) window.__K.push(e.key); }, true); });
    const keys = () => E(() => window.__K.splice(0).join(','));
    for (const d of [0.8, 2.4]) {
      await setD(d);
      await sleep(900);
      await keys();
      // đếm lần đổi bia (hashchange) trong trang — lượt đầu + lượt xếp hàng xảy ra trước cả khi vòng chờ bên dưới bắt đầu
      await E(() => { window.__HC = 0; if (!window.__hcOn) { window.__hcOn = true; window.addEventListener('hashchange', () => window.__HC++); } });
      await E(() => window.__vmHand.simulate('SWIPE_LEFT'));
      const first = await keys();
      const t0 = Date.now();
      await sleep(d * 1000 - 350);
      await E(() => window.__vmHand.simulate('SWIPE_LEFT'));
      const early = await keys();
      const tEarly = Date.now() - t0;
      await sleep(Math.max(0, d * 1000 + 350 - (Date.now() - t0)));
      await E(() => window.__vmHand.simulate('SWIPE_LEFT'));
      const late = await keys();
      const tLate = Date.now() - t0;
      // chờ mọi lượt (kể cả lượt xếp hàng) xong hẳn
      for (let k = 0; k < 160; k++) {
        const s = await E(() => ({ lock: document.querySelector('.cinema').dataset.navlock, tx: window.__vm.cinemaTxProgress() }));
        if (s.lock !== '1' && s.tx < 0) { await sleep(400); const s2 = await E(() => ({ lock: document.querySelector('.cinema').dataset.navlock, tx: window.__vm.cinemaTxProgress() })); if (s2.lock !== '1' && s2.tx < 0) break; }
        await sleep(50);
      }
      R.G[d] = { first: first || 'dropped', early: `${tEarly}ms: ${early || 'dropped'}`, late: `${tLate}ms: ${late || 'dropped'}`, steps: await E(() => window.__HC) };
      await sleep(600);
    }
    // __vmHand.simulate không có khung "mất tay" theo sau → gỡ cờ tay còn treo (không thì việc nền — nâng LOD, quét hiện —
    // chờ tay mãi: whenCalm)
    await E(() => { delete document.body.dataset.handActive; });
  }
  // ---- L: đổi giữa chừng — lượt đang chạy giữ nhịp cũ, lượt sau theo nhịp mới
  {
    await setD(2.4);
    await sleep(300);
    await E(() => window.__L.start());
    await page.keyboard.press('ArrowRight');
    await sleep(500);
    await setD(0.8);
    await sleep(2600);
    const a = summarize(await E(() => window.__L.stop()));
    await sleep(500);
    await E(() => window.__L.start());
    await page.keyboard.press('ArrowRight');
    await sleep(2000);
    const b = summarize(await E(() => window.__L.stop()));
    R.L = { inFlight: a, next: b };
  }
  // ---- P: 0,8 s tới bia xa (chưa có trong cửa sổ LOD → proxy), rồi quét hiện bản thật
  {
    await setD(0.8);
    await sleep(500);
    const far = await E(() => { const t = [...document.querySelectorAll('.cin-tl__tick')]; const k = Math.floor(t.length * 0.85); return { i: t[k].dataset.i, n: t.length }; });
    await E(() => window.__L.start());
    const lod0 = await E(() => window.__vm.cinemaLods().liveLod);
    await E((i) => document.querySelector(`.cin-tl__tick[data-i="${i}"]`).click(), far.i);
    const seq = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) {
      seq.push(`${Date.now() - t0}:${await E(() => `${window.__vm.cinemaTxProgress().toFixed(2)}/L${window.__vm.cinemaLods().liveLod}`)}`);
      await sleep(150);
    }
    const s = summarize(await E(() => window.__L.stop()));
    R.P = { far, lodBefore: lod0, ...s, seq: seq.filter((_, i) => i < 10 || i % 6 === 0) };
  }
  allErrors.push(...errs);
  await close();
}
// ---- R: giảm chuyển động — bỏ qua Thời gian lướt (tức thời)
{
  const { page, close, errs } = await open({ reduce: true });
  const E = (fn, a) => page.evaluate(fn, a);
  await E(() => window.__vm.settings.set('glideDuration', 2.4));
  await E(() => window.__L.start());
  await page.keyboard.press('ArrowRight');
  await sleep(1500);
  R.R = { reduced: await E(() => matchMedia('(prefers-reduced-motion: reduce)').matches), ...summarize(await E(() => window.__L.stop())) };
  allErrors.push(...errs);
  await close();
}

// ---------------------------------------------------------------------------- kiểm
const near = (v, want, tol) => v != null && Math.abs(v - want) <= tol;
report.section('thời lượng thật');
for (const d of [0.8, 1.6, 2.4]) {
  const t = R.T[d];
  report.check(`${d} s: view:transition.ms = ${d * 1000}, lượt lướt ≈ ${d} s`, t.evMs === d * 1000 && near(t.txMs, d * 1000, 80), t);
  report.check(`${d} s: khoá đổi bia ≈ thời lượng, mở ngay khi xong`, near(t.lockMs, d * 1000, 80) && t.unlockVsEnd != null && t.unlockVsEnd <= 34, { lock: t.lockMs, vsEnd: t.unlockVsEnd });
}
report.section('cổng đổi bia của lớp cử chỉ');
for (const d of [0.8, 2.4]) {
  const g = R.G[d];
  report.check(`${d} s: vẩy lúc đang lướt → bỏ (không xếp hàng, r52); vẩy sau khi lướt xong → đổi bia — 3 cú = 2 lần đổi bia`, g.first === 'ArrowLeft' && /dropped$/.test(g.early) && /ArrowLeft$/.test(g.late) && g.steps === 2, g);
}
report.section('đổi giữa chừng');
report.check('đổi 2,4 → 0,8 giữa lượt: lượt đang chạy giữ 2,4 s', near(R.L.inFlight.txMs, 2400, 80), R.L.inFlight);
report.check('lượt sau chạy 0,8 s', near(R.L.next.txMs, 800, 80), R.L.next);
report.section('bia xa ở 0,8 s');
// (bia xa: tải + đẩy proxy làm vài khung dài — thời lượng theo đồng hồ thật dao động; thời lượng thiết kế = view:transition.ms)
report.check('proxy lướt vào (view:transition.ms = 800, xong < 2 s đồng hồ thật)', R.P.evMs === 800 && R.P.txMs != null && R.P.txMs < 2000 && /\/L2$/.test(R.P.seq[0]), { tx: R.P.txMs, first: R.P.seq[0] });
report.check('rồi nâng lên LOD0', /\/L0$/.test(R.P.seq.at(-1)), R.P.seq.at(-1));
report.section('giảm chuyển động');
report.check('tức thời (view:transition.ms ≈ 1), không có khung lướt', R.R.reduced && R.R.evMs <= 1 && R.R.framesSeen === 0, R.R);
process.exit(report.finish(allErrors));
