// Thoát chế độ xoa đầu rùa → camera về ĐÚNG khung (r35b): so camera trước khi vào (khung mặc định, chuột / tay ngoài bia)
// với sau khi về (off = khoảng cách tới khung đích, dPos / dTarget / dFov so với trước). Chuột: Esc, ×, rảnh, zoom ra (lăn
// thêm sau khi thoát), Esc + kéo trong lúc bay về. Tay (lớp cử chỉ thật): × với lòng bàn tay còn trên đầu rùa (không đóng
// băng đường về), × + nhón–kéo lúc bay về, rảnh. r70: vào như người dùng — chuột nhấn giữ + xoa, tay xoè xoa qua lại trên
// đầu rùa (tests/lib/rub-sim.mjs). Bia 1715. node tests/cinema/rub-camera.test.mjs --port 5180  (≈ 3 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';
import { handRubOpen, installHand, mouseRubOpen } from '../lib/rub-sim.mjs';

const { port, headed } = parseArgs();
const report = createReport('rub-camera');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await openCinema(page, port, { id: 'bia-1715', hooks: ['cinemaRub', 'cinemaCam', '__vmHand.simulateHand'], settleMs: 2500 });
const E = (fn, a) => page.evaluate(fn, a);
const cam = () => E(() => window.__vm.cinemaCam());
const top = () => E(() => { const s = window.__vm.cinemaSelect().hoverZoom.steleNow; return s; });
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cmp = (a, b) => ({ dPos: +d3(a.pos, b.pos).toFixed(4), dTarget: +d3(a.target, b.target).toFixed(4), dFov: +(a.fov - b.fov).toFixed(3) });
const R = {};
async function home0() {
  await page.mouse.move(60, 450); // ngoài bia
  await E(() => { window.__A && (window.__A.pose = 'none'); });
  await sleep(3500);
  return cam();
}
async function mouseEnter() {
  if ((await mouseRubOpen(page)) === 'rub') return 'rub';
  await E(() => window.__vm.cinemaRub.enter('mouse'));
  return 'dev';
}
async function trace(ms) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const c = await cam(); out.push(`${Date.now() - t0}:${c.camTw ?? '-'}${c.camTwT ?? ''} off=${c.off} um=${c.userMoved ? 1 : 0} fr=${c.frozen ? 1 : 0} sel=${c.sel ? 1 : 0} idle=${c.idleS}`); await sleep(250); }
  return out;
}
async function run(name, { enter, exit, stayOnHead = true }) {
  const H0 = await home0();
  const how = await enter();
  await sleep(2600); // tới khung cận
  const inRub = await cam();
  await exit();
  const tr = await trace(3200);
  const onHead = await cam();
  const stele = await top();
  if (!stayOnHead) { /* nothing */ }
  const H1 = await home0();
  R[name] = { why: await E(() => window.__vm.cinemaRub.state().exits?.slice?.(-1)?.[0] ?? null), how, inRubDist: inRub.dist, afterExit: { off: onHead.off, camTw: onHead.camTw, userMoved: onHead.userMoved, sel: onHead.sel, frozen: onHead.frozen, steleTop: stele?.top, steleBot: stele?.bot }, homeAfter: cmp(H1, H0), H1flags: { camTw: H1.camTw, userMoved: H1.userMoved, off: H1.off }, trace: tr.filter((_, i) => i % 2 === 0) };
}
await run('mouse-esc', { enter: mouseEnter, exit: () => page.keyboard.press('Escape') });
await run('mouse-x', { enter: mouseEnter, exit: async () => { const b = await E(() => { const r = document.querySelector('.cin-rub__close').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await page.mouse.click(b.x, b.y); } });
await run('mouse-idle', { enter: mouseEnter, exit: () => E(() => window.__vm.cinemaRub.exit('idle')) });
await run('mouse-zoomout', { enter: mouseEnter, exit: async () => {
  const h = await E(() => window.__vm.cinemaRub.head());
  await page.mouse.move(h.x, h.y);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await sleep(40); if (!(await E(() => window.__vm.cinemaRub.state().active))) break; }
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await sleep(60); } // người dùng lăn thêm vài nấc
} });
// chuột: thoát bằng Esc rồi KÉO xoay camera ngay trong lúc bay về
await run('mouse-esc-drag', { enter: mouseEnter, exit: async () => {
  await page.keyboard.press('Escape');
  await sleep(150);
  await page.mouse.move(900, 300); await page.mouse.down(); await page.mouse.move(700, 360, { steps: 12 }); await page.mouse.up();
} });

// ---- tay (đường đi thật của lớp cử chỉ): xoè tay xoa qua lại trên đầu rùa → vào (r70)
async function handEnter() {
  await installHand(page);
  await page.mouse.move(5, 895);
  await E(() => { window.__A.hx = 0.5; window.__A.hy = 0.62; });
  return (await handRubOpen(page)) === 'rub' ? 'rub' : 'failed';
}
const clickX = () => E(() => document.querySelector('.cin-rub__close').click());
await run('hand-x-palm-stays', { enter: handEnter, exit: async () => {
  await clickX(); // lòng bàn tay vẫn xoè trên đầu rùa (tiếp tục bám)
  const tr = [];
  for (let i = 0; i < 8; i++) { await E(() => { const h = window.__vm.cinemaRub.head(); if (h) window.__A.tgt = { x: h.x, y: h.y }; }); tr.push(await E(() => { const r = window.__vm.cinemaRub.state(); const c = window.__vm.cinemaCam(); return `${c.camTw ?? '-'}${c.camTwT ?? ''} fr=${c.frozen ? 1 : 0} arm=${r.arm.strokes}`; })); await sleep(250); }
  R.handPalmDuringLeaving = tr;
  await E(() => { window.__A.tgt = window.__vm.cinemaStelePoint(); }); // rồi lên thân bia
} });
await run('hand-x-pinchdrag', { enter: handEnter, exit: async () => {
  await clickX();
  await sleep(120);
  await E(() => { window.__A.tgt = null; window.__A.pose = 'pinch'; });
  for (let i = 0; i < 12; i++) { await E(() => { window.__A.hx -= 0.02; }); await sleep(60); }
  await E(() => { window.__A.pose = 'open'; window.__A.tgt = window.__vm.cinemaStelePoint(); });
} });
await run('hand-idle', { enter: handEnter, exit: async () => {
  await E(() => { window.__A.pose = 'none'; });
  await page.waitForFunction(() => !window.__vm.cinemaRub.state().active, null, { timeout: 15000 });
} });
await E(() => { if (window.__A) { clearInterval(window.__A.id); } });

// ---------------------------------------------------------------------------- kiểm
const WANT = ['mouse-esc', 'mouse-x', 'mouse-idle', 'mouse-zoomout', 'mouse-esc-drag', 'hand-x-palm-stays', 'hand-x-pinchdrag', 'hand-idle'];
const WHY = { 'mouse-esc': 'esc', 'mouse-x': 'close', 'mouse-idle': 'idle', 'mouse-zoomout': 'zoom-out', 'mouse-esc-drag': 'esc', 'hand-x-palm-stays': 'close', 'hand-x-pinchdrag': 'close', 'hand-idle': 'idle' };
for (const k of WANT) {
  const v = R[k];
  if (!v) { report.check(`${k}: đã chạy`, false); continue; }
  report.section(k);
  report.check(`vào như người dùng (xoa) · thoát đúng cách (${WHY[k]})`, v.how === 'rub' && v.why === WHY[k], { why: v.why, via: v.how });
  report.check('về tới khung đích (off 0), camera lại của người dùng', v.afterExit.off < 1e-3 && v.afterExit.camTw === null && v.afterExit.userMoved === false, v.afterExit);
  report.check('khung đó thấy trọn bia (đỉnh bia trong khung)', v.afterExit.steleTop < 1, v.afterExit.steleTop);
  report.check('rời bia → khung mặc định TRÙNG khung trước khi vào', v.homeAfter.dPos < 1e-3 && v.homeAfter.dTarget < 1e-3 && v.homeAfter.dFov === 0, v.homeAfter);
}
report.section('lòng bàn tay trên đầu rùa lúc bay về');
report.check('đường về không đóng băng, lòng bàn tay để yên không thành nhịp xoa để mở', (R.handPalmDuringLeaving ?? []).length > 0 && R.handPalmDuringLeaving.every((s) => / fr=0 arm=0$/.test(s)), R.handPalmDuringLeaving);
await close();
process.exit(report.finish(errors));
