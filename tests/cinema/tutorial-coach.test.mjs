// r50 — tự mở hướng dẫn cho khách mới LÚNG TÚNG (core/hand/coach.js), qua ĐƯỜNG ĐI THẬT của lớp cử chỉ (điểm mốc → engine →
// handleResult → hand:frame / hand:coach → tutorial.js). Thời gian rút ngắn bằng tham số DEV: khách mới sau 2,5 s không ai
// dùng (coachNewMs), cửa sổ đánh giá 18 s (coachWindowMs, thật: 30 s), mở sớm 7 s (coachEarlyMs, thật: 15 s).
//   1. khách thành thạo: phát lại THEO GIỜ THẬT hai đoạn thạo tay của hand2 — nhón kéo xoay cảnh (15–25,8 s) rồi vẩy V
//      (55,5–64,5 s, 3 cú) → THÀNH THẠO (2 loại) trước hết cửa sổ, không mở
//   2. khách mới sau X (không reset) — bàn tay nắm, không bao giờ được nhận → phiên MỚI, mở SỚM ở ~7 s
//   3. lúng túng: tay nắm / quơ mãi (chưa được nhận) rồi nhón giữ yên quá lâu (chạm hỏng), không làm xong gì → mở ở ~18 s
//   4. dùng chuột trong phiên → không phải khách dùng tay: không mở
//   5. tắt "Tự mở hướng dẫn khi khách mới lúng túng" → không có phiên
// node tests/cinema/tutorial-coach.test.mjs --port 5180   (≈ 1,5 phút)
import { readFileSync } from 'node:fs';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('tutorial-coach');
const NEW_MS = 2500;
const WIN_MS = 18000;
const EARLY_MS = 7000;
const { page, close, errors } = await launch({
  headed,
  settings: { autoRotate: false, cinemaIdleAutoplay: false, tutorialFirstLoad: false, tutorialAdaptive: true, tutorialNewAfter: 1, sound: false },
});
await openCinema(page, port, {
  query: `?handCursor=shown&coachNewMs=${NEW_MS}&coachWindowMs=${WIN_MS}&coachEarlyMs=${EARLY_MS}`,
  hooks: ['cinemaTutorial', '__vmHand.simulateHand', '__vmHand.coach', '__vmHand.ingestLive'],
  settleMs: 2000,
});
const E = (fn, a) => page.evaluate(fn, a);
const coach = () => E(() => window.__vmHand.coach());
const tut = () => E(() => { const s = window.__vm.cinemaTutorial.state(); return { active: s.active, why: s.why }; });
await E(() => {
  document.body.classList.add('gesture-on');
  // nhật ký: hand:coach + lúc hướng dẫn mở
  window.__C = { ev: [], opened: [] };
  window.addEventListener('hand:coach', (e) => window.__C.ev.push({ t: Math.round(performance.now()), ...e.detail }));
  new MutationObserver(() => { if (document.body.dataset.handTutorial === 'on') { const l = window.__C.opened; if (!l.length || l.at(-1).closed) l.push({ t: Math.round(performance.now()), why: window.__vm.cinemaTutorial.state().why }); } else if (window.__C.opened.length) window.__C.opened.at(-1).closed = true; }).observe(document.body, { attributes: true, attributeFilter: ['data-hand-tutorial'] });
  // bàn tay tổng hợp qua engine thật, 30 khung/s: window.__A.pose ('none' = không có tay) / x / y (cổ tay, 0..1)
  const A = (window.__A = { pose: 'none', x: 0.5, y: 0.75, first: true, id: 0 });
  A.id = setInterval(() => { window.__vmHand.simulateHand([{ pose: A.pose, x: A.x + (A.wave || 0) * Math.sin(performance.now() / 1000 * 2 * Math.PI * 1.5), y: A.y, ms: 33 }], { live: true, fresh: A.first }); A.first = false; }, 33);
});
const hand = (p) => E((p) => Object.assign(window.__A, p), p);
/** Dời cổ tay tới khi con trỏ tay (hand:frame rawX/rawY) tới (tx, ty) px — trả sai số còn lại. */
const aim = (tx, ty) => E(([tx, ty]) => new Promise((res) => {
  let n = 0;
  const onF = (e) => {
    const d = e.detail;
    if (!d.engaged) return;
    const ex = tx - d.rawX;
    const ey = ty - d.rawY;
    if (Math.hypot(ex, ey) < 12 || ++n > 150) { window.removeEventListener('hand:frame', onF); res(Math.round(Math.hypot(ex, ey))); return; }
    window.__A.x += (ex / innerWidth) * 0.3;
    window.__A.y += (ey / innerHeight) * 0.3;
  };
  window.addEventListener('hand:frame', onF);
}), [tx, ty]);
const VW = await E(() => [innerWidth, innerHeight]);
const sessionStart = () => E(() => { const s = window.__vmHand.coach(); return performance.now() - s.ageMs; });
const R = {};

// ---------- 1. khách thành thạo (hand2: xoay cảnh rồi vẩy V)
const ALL = JSON.parse(readFileSync(new URL('../../test-clips/hand2-landmarks.json', import.meta.url), 'utf8'));
const SEG1 = ALL.filter((f) => f.t >= 15 && f.t <= 25.8);
const SEG2 = ALL.filter((f) => f.t >= 55.5 && f.t <= 64.5);
const F = [...SEG1, ...SEG2.map((f) => ({ ...f, t: +(f.t - 55.5 + 25.9).toFixed(3) }))];
await E(() => { window.__vmHand.coachReset(); window.__C.ev.length = 0; });
await sleep(NEW_MS + 400);
R.pro = await E(async (frames) => {
  clearInterval(window.__A.id); // tay tổng hợp nghỉ: chỉ clip
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const H = window.__vmHand;
  const w0 = performance.now(), f0 = frames[0].t;
  let proAt = null;
  for (let i = 0; i < frames.length; i++) {
    const wait = w0 + (frames[i].t - f0) * 1000 - performance.now();
    if (wait > 0) await sleep(wait);
    H.ingestLive(frames[i], { t: performance.now(), fresh: i === 0, aspect: 1620 / 1080 }); // hand2.mp4 1620×1080
    if (proAt === null && H.coach().decision === 'proficient') proAt = Math.round(performance.now() - w0);
  }
  return { proAt, snap: H.coach(), opened: window.__C.opened.length };
}, F);
await sleep(600);
R.proAfter = { snap: await coach(), tut: await tut(), line: await E(() => window.__vmHand.coachLine()) };

// ---------- 2. khách mới sau X (KHÔNG reset): nắm tay, không bao giờ được nhận → phiên mới, mở sớm
await E(() => { window.__A.pose = 'none'; window.__A.first = true; const A = window.__A; A.id = setInterval(() => { window.__vmHand.simulateHand([{ pose: A.pose, x: A.x + (A.wave || 0) * Math.sin(performance.now() / 1000 * 2 * Math.PI * 1.5), y: A.y, ms: 33 }], { live: true, fresh: A.first }); A.first = false; }, 33); });
await sleep(NEW_MS + 600);
const id0 = (await coach()).id;
await hand({ pose: 'fist', x: 0.5, y: 0.75 });
await sleep(300);
const t2 = await sessionStart();
const s2a = await coach();
await sleep(EARLY_MS - 1500);
R.earlyBefore = { snap: await coach(), tut: await tut() };
const early = await E(() => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (window.__vm.cinemaTutorial.state().active) res(Math.round(performance.now())); else if (performance.now() - t0 > 6000) res(-1); else setTimeout(tick, 20); }; tick(); }));
R.early = { newSession: s2a.id === id0 + 1, openAfter: early < 0 ? -1 : Math.round(early - t2), snap: await coach(), tut: await tut() };
await hand({ pose: 'none' });
await E(() => window.__vm.cinemaTutorial.stop('test'));
await sleep(900);

// ---------- 3. lúng túng: tay nắm rồi xoè mà quơ liên tục (chưa được nhận ~6 s: chưa xoè / chưa yên), rồi nhón giữ yên quá
// lâu trên cảnh (không xoay, không thành cú chạm) ở chỗ trống (không trên bia, mũi tên, dòng thời gian, nút) — không làm
// xong gì
await E(() => window.__vmHand.coachReset());
await sleep(NEW_MS + 400);
await hand({ pose: 'fist', x: 0.5, y: 0.75 });
await sleep(300);
const t3 = await sessionStart();
await sleep(2800);
await hand({ pose: 'open', x: 0.5, y: 0.75, wave: 0.14 }); // xoè mà quơ qua lại 1,5 Hz — không bao giờ yên
await sleep(2800);
await hand({ pose: 'open', x: 0.33, y: 0.62, wave: 0 }); // đứng yên (con trỏ ở khoảng trống bên trái bia) → được nhận
R.aimErr = await aim(VW[0] * 0.27, VW[1] * 0.36);
await sleep(300);
await hand({ pose: 'pinch' }); await sleep(1900); await hand({ pose: 'open' }); await sleep(500);
await hand({ pose: 'pinch' }); await sleep(1900); await hand({ pose: 'open' }); await sleep(250);
R.midStruggle = { snap: await coach(), tut: await tut() };
const opened3 = await E(() => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (window.__vm.cinemaTutorial.state().active) res(Math.round(performance.now())); else if (performance.now() - t0 > 8000) res(-1); else setTimeout(tick, 20); }; tick(); }));
R.struggle = { openAfter: opened3 < 0 ? -1 : Math.round(opened3 - t3), snap: await coach(), tut: await tut(), line: await E(() => window.__vmHand.coachLine()) };
await hand({ pose: 'none' });
await E(() => window.__vm.cinemaTutorial.stop('test'));
await sleep(900);

// ---------- 4. dùng chuột trong phiên → không mở
await E(() => window.__vmHand.coachReset());
await sleep(NEW_MS + 400);
await hand({ pose: 'fist', x: 0.5, y: 0.75 });
await sleep(1000);
await page.mouse.move(300, 300); await page.mouse.move(420, 360, { steps: 6 }); await sleep(200);
R.mouseSnap = await coach();
await sleep(WIN_MS);
R.mouse = { snap: await coach(), tut: await tut() };
await hand({ pose: 'none' });
await sleep(300);

// ---------- 5. tắt tự mở → không có phiên
await E(() => { window.__vm.settings?.set?.('tutorialAdaptive', false); });
const hasSettings = await E(() => !!window.__vm.settings);
await E(() => window.__vmHand.coachReset());
await sleep(NEW_MS + 400);
await hand({ pose: 'fist', x: 0.5, y: 0.75 });
await sleep(EARLY_MS + 1000);
R.off = { hasSettings, snap: await coach(), tut: await tut() };
await hand({ pose: 'none' });
await E(() => { clearInterval(window.__A.id); window.__vm.settings?.set?.('tutorialAdaptive', true); });
R.events = await E(() => window.__C.ev.map((e) => `${e.id}:${e.decision}${e.want ? '+want' : ''}`).join(' '));

// ---------------------------------------------------------------------------- kiểm
report.section('1. khách thành thạo (hand2: xoay cảnh, vẩy V)');
report.check('thao tác thạo tay được tính (xoay cảnh + xem bia / vẩy V) → THÀNH THẠO (≥ 2 loại) trước khi hết cửa sổ', R.pro.proAt !== null && R.pro.proAt < WIN_MS && (R.pro.snap.kinds.orbit ?? 0) >= 1 && Object.keys(R.pro.snap.kinds).length >= 2, { proAt: R.pro.proAt, kinds: R.pro.snap.kinds, done: R.pro.snap.done, reason: R.pro.snap.reason });
report.check('không mở hướng dẫn (cả sau khi hết cửa sổ)', R.pro.opened === 0 && !R.proAfter.tut.active && R.proAfter.snap.decision === 'proficient', { opened: R.pro.opened, after: R.proAfter.snap.decision });
report.check('bảng chẩn đoán: dòng "khách mới" ghi điểm + quyết định', /xoay cảnh/.test(R.proAfter.line) && /THÀNH THẠO — \d loại/.test(R.proAfter.line), R.proAfter.line);
report.section('2. khách mới sau X — không bao giờ được nhận');
report.check('bàn tay xuất hiện sau X không ai dùng → phiên MỚI (đánh giá lại)', R.early.newSession, { id0, id: s2a.id });
report.check('trước ngưỡng sớm: chưa mở', !R.earlyBefore.tut.active && R.earlyBefore.snap.decision === 'evaluating', R.earlyBefore.snap);
report.check(`thấy tay ~${EARLY_MS / 1000} s mà chưa lần nào được nhận → mở SỚM (why "coach")`, R.early.openAfter >= EARLY_MS - 200 && R.early.openAfter <= EARLY_MS + 900 && R.early.tut.why === 'coach' && R.early.snap.engageMs === null, { openAfter: R.early.openAfter, why: R.early.tut.why, reason: R.early.snap.reason });
report.section('3. lúng túng');
report.check('trong cửa sổ: chưa mở; có tín hiệu vấp (chưa nhận ≥ 5 s, chạm hỏng 2), chưa làm xong gì', !R.midStruggle.tut.active && R.midStruggle.snap.decision === 'evaluating' && R.midStruggle.snap.fails.unengagedMs >= 5000 && R.midStruggle.snap.fails.tapFail >= 2 && R.midStruggle.snap.done === 0, { aimErr: R.aimErr, ...R.midStruggle.snap });
report.check(`hết cửa sổ (~${WIN_MS / 1000} s): chưa làm xong gì → mở`, R.struggle.openAfter >= WIN_MS - 200 && R.struggle.openAfter <= WIN_MS + 900 && R.struggle.tut.why === 'coach', { openAfter: R.struggle.openAfter, why: R.struggle.tut.why, reason: R.struggle.snap.reason, score: R.struggle.snap.score });
report.check('bảng chẩn đoán: vấp (chưa nhận, chạm hỏng, lang thang) + quyết định + lý do', /chưa nhận \d+ s/.test(R.struggle.line) && /chạm hỏng 2/.test(R.struggle.line) && /(LÚNG TÚNG|ĐÃ XEM)/.test(R.struggle.line), R.struggle.line);
report.section('4. chuột');
report.check('chuột trong phiên → "không phải khách dùng tay", không mở (cả khi hết cửa sổ)', R.mouseSnap.decision === 'mouse' && R.mouse.snap.decision === 'mouse' && !R.mouse.tut.active, { at: R.mouseSnap.decision, end: R.mouse.snap.decision, tut: R.mouse.tut });
report.section('5. tắt');
report.check('tắt "Tự mở hướng dẫn khi khách mới lúng túng" → không có phiên, không mở', R.off.hasSettings && R.off.snap.id === 0 && !R.off.tut.active, R.off);
console.log('hand:coach', R.events);
console.log('chẩn đoán (1):', R.proAfter.line);
console.log('chẩn đoán (3):', R.struggle.line);
await close();
process.exit(report.finish(errors));
