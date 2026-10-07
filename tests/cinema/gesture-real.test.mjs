// Qua đường đi THẬT của lớp cử chỉ (__vmHand.simulateHand live → nhận dạng → hand:frame / tap / hand:wave): (1) nhắm con
// trỏ tay bằng vòng phản hồi rồi chạm–thả ~170 ms — hướng dẫn bước 1 (r66: khung tròn + khung xương THẬT của tay qua
// hand:skeleton, con trỏ tay ẩn trong khung → ~2 s "Mở rộng cả 5 ngón" → xoè → vòng phải → rời khung: con trỏ hiện lại →
// dừng trong vòng → vòng trái), bước 2 (lún lúc chạm, chọn lúc thả; vòng thứ hai chỉ hiện sau vòng thứ nhất) và danh sách camera
// trong Cài đặt (con trỏ hiện: ?handCursor=shown); (2) "vẫy để bỏ qua" hướng dẫn qua bộ nhận vẫy thật: cử động chậm không
// tính, vẫy 2 Hz → bỏ qua, vẫy nửa chừng rồi thôi → vòng rút về. node tests/cinema/gesture-real.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('gesture-real');
const allErrors = [];

// ================= 1. chạm–thả thật: hướng dẫn + danh sách camera
{
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await openCinema(page, port, { query: '?handCursor=shown', hooks: ['cinemaTutorial', '__vmHand.simulateHand'], settleMs: 1500 });
const E = (fn, a) => page.evaluate(fn, a);
await E(() => {
  const A = (window.__A = { hx: 0.5, hy: 0.6, pose: 'open', tgt: null, cur: null, id: 0, first: true, taps: [] });
  window.addEventListener('hand:frame', (e) => { const d = e.detail; if (d.detected) A.cur = { x: d.rawX ?? d.x, y: d.rawY ?? d.y, dx: d.x, dy: d.y }; });
  A.id = setInterval(() => {
    if (A.tgt && A.cur && A.pose === 'open') {
      A.hx = Math.min(0.97, Math.max(0.03, A.hx + ((A.tgt.x - A.cur.x) / innerWidth) * 0.3));
      A.hy = Math.min(0.97, Math.max(0.03, A.hy + ((A.tgt.y - A.cur.y) / innerHeight) * 0.3));
    }
    const r = window.__vmHand.simulateHand([{ pose: A.pose, x: A.hx, y: A.hy, ms: 33 }], { live: true, fresh: A.first, fistLabel: true });
    A.first = false;
    for (const a of r.actions) if (/tap/.test(a.text)) A.taps.push(a.text);
  }, 33);
});
const aim = async (sel, dx = 0, dy = 0) => {
  const t = await E(([sel, dx, dy]) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy }; }, [sel, dx, dy]);
  await E((t) => { window.__A.tgt = t; }, t);
  for (let i = 0; i < 60; i++) {
    await sleep(50);
    const ok = await E(([t, sel]) => { const c = window.__A.cur; return !!c && Math.hypot(c.x - t.x, c.y - t.y) < 8; }, [t, sel]);
    if (ok) break;
  }
  await sleep(350); // yên một chút (nam châm bắt)
  return E((sel) => ({ captured: document.querySelector(sel).hasAttribute('data-hi-captured'), cur: window.__A.cur }), sel);
};
const pinch = async (ms = 170, onHold) => { await E(() => { window.__A.pose = 'pinch'; }); await sleep(ms); const h = onHold ? await onHold() : null; await E(() => { window.__A.pose = 'open'; }); await sleep(250); return h; };
const tut = () => E(() => { const d = window.__vm.cinemaTutorial.state(); return { step: d.step, phase: d.phase, line: d.line, done: d.stepDone, s1: d.s1, s2: d.s2, active: d.active }; });
const until = (fn, ms = 4000) => page.waitForFunction(fn, null, { timeout: ms, polling: 30 }).then(() => true, () => false);
const R = {};

// ---- 1. hướng dẫn qua đường đi thật
await E(() => window.__vm.cinemaTutorial.start('manual')); await sleep(600);
R.t0 = await tut();
// khung xương thật (lớp cử chỉ → hand:skeleton) vẽ trong khung; con trỏ tay (đang hiện: ?handCursor=shown) ẩn trong khung
await aim('.cin-tut__frame');
await sleep(300);
R.skel = await E(() => { const s = window.__vm.cinemaTutorial.state().skel; const c = document.querySelector('.hi-cursor'); return { ...s, body: document.body.dataset.handSkeleton ?? null, cursorOp: c ? +getComputedStyle(c).opacity : null }; });
R.skelPts = await E(() => new Promise((res) => { const on = (e) => { window.removeEventListener('hand:skeleton', on); res({ n: e.detail.pts?.length ?? 0, aspect: e.detail.aspect, locked: e.detail.locked, inRange: (e.detail.pts ?? []).every(([x, y]) => x >= -0.2 && x <= 1.2 && y >= -0.2 && y <= 1.2) }); }; window.addEventListener('hand:skeleton', on); }));
// tay đã được nhận từ trước → ~2 s "Mở rộng cả 5 ngón" → xoè sẵn → POP → vòng PHẢI (chưa có vòng trái)
R.rShown = await until(() => window.__vm.cinemaTutorial.state().s1.rShown, 7000);
R.t0b = await tut();
const aR = await aim('.cin-tut__ring[data-k="r"]');
R.lShown = await until(() => window.__vm.cinemaTutorial.state().s1.lShown);
R.t1 = { ...(await tut()), captured: aR.captured };
R.afterFrame = await E(() => { const c = document.querySelector('.hi-cursor'); return { body: document.body.dataset.handSkeleton ?? null, cursorOp: c ? +getComputedStyle(c).opacity : null, lines: window.__vm.cinemaTutorial.state().lines.map((x) => x[1]).join(' ') }; });
await aim('.cin-tut__ring[data-k="l"]');
await until(() => window.__vm.cinemaTutorial.state().step === 2);
R.t2 = await tut();
const aA = await aim('.cin-tut__ring[data-k="a"]');
const hold = await pinch(260, () => E(() => ({ press: document.querySelector('.cin-tut__ring[data-k="a"]').dataset.press, sel: document.querySelector('.cin-tut__ring[data-k="a"]').dataset.sel, tut: window.__vm.cinemaTutorial.state().s2, line: window.__vm.cinemaTutorial.state().line })));
R.t3 = { capturedA: aA.captured, whileHeld: hold, afterRelease: await tut() };
R.bShown = await until(() => window.__vm.cinemaTutorial.state().s2.bShown);
R.t3b = await tut();
await sleep(300);
await aim('.cin-tut__ring[data-k="b"]');
await pinch(170);
R.t4 = await tut();
R.tutTaps = await E(() => window.__A.taps.splice(0));
// ---- bước 3 (nhón giữ kéo khối, hai lượt) rồi bước 4 (r66: NẮM TAY kéo khối — lớp cử chỉ thật: xoè → nắm → kéo)
await until(() => window.__vm.cinemaTutorial.state().step === 3, 3000);
await sleep(300);
const moveHand = async (dx, dy, n = 12) => { for (let k = 0; k < n; k++) { await E(([dx, dy]) => { window.__A.hx += dx; window.__A.hy += dy; }, [dx / n, dy / n]); await sleep(40); } };
for (const [dx, dy] of [[0.07, 0], [0, 0.08]]) {
  await aim('.cin-tut__cubewrap');
  await E(() => { window.__A.tgt = null; window.__A.pose = 'pinch'; }); await sleep(250);
  await moveHand(dx, dy);
  await sleep(150);
  await E(() => { window.__A.pose = 'open'; }); await sleep(900);
}
R.step4 = await until(() => window.__vm.cinemaTutorial.state().step === 4, 3000);
await sleep(400);
const s4 = { fist: [], stageIdx0: await E(() => window.__vm.cinemaIdle().index) };
const fistPull = async (dx) => {
  await aim('.cin-tut__fwrap');
  await E(() => { window.__A.tgt = null; }); await sleep(400); // xoè đủ 5 ngón ngay trước khi nắm
  await E(() => { window.__A.pose = 'fist'; }); await sleep(450);
  const g = await E(() => ({ line: window.__vm.cinemaTutorial.state().line, grab: window.__vm.cinemaTutorial.state().s4.grab, handGrab: document.body.dataset.handGrab ?? null }));
  await moveHand(dx, 0, 14);
  await sleep(200);
  const moved = await E(() => ({ line: window.__vm.cinemaTutorial.state().line, s4: window.__vm.cinemaTutorial.state().s4 }));
  await E(() => { window.__A.pose = 'open'; }); await sleep(1100);
  s4.fist.push({ g, moved, after: await E(() => ({ line: window.__vm.cinemaTutorial.state().line, step: window.__vm.cinemaTutorial.state().step, handGrab: document.body.dataset.handGrab ?? null })) });
};
await fistPull(-0.13);
await fistPull(0.13);
s4.stageIdx1 = await E(() => window.__vm.cinemaIdle().index);
R.s4 = s4;
await sleep(2600);
R.s4closed = !(await tut()).active;
await E(() => { window.__A.hx = 0.5; window.__A.hy = 0.6; });
if ((await tut()).active) { await page.keyboard.press('Escape'); await sleep(700); }

// ---- 2. Cài đặt → Cử chỉ → Camera qua đường đi thật (con trỏ hiện: ?handCursor=shown)
await page.click('.cin-gear'); await sleep(400);
await page.getByRole('tab', { name: 'Cử chỉ' }).click(); await sleep(300);
// danh sách giả + enumerateDevices giả cùng danh sách (mở danh sách thả xuống dò lại thiết bị — r50)
await E(() => {
  const cameras = [{ id: 'a', label: 'FaceTime HD Camera (3A71:F4B5)', kind: 'tích hợp', rank: 1 }, { id: 'b', label: 'OBS Virtual Camera', kind: 'USB', rank: 3 }, { id: 'd', label: 'iPhone của Hà Camera', kind: 'iPhone', rank: 2 }];
  navigator.mediaDevices.enumerateDevices = async () => cameras.map((c) => ({ deviceId: c.id, kind: 'videoinput', label: c.label, groupId: '' }));
  window.dispatchEvent(new CustomEvent('hand:cameras', { detail: { labelled: true, autoLabel: 'FaceTime HD Camera (3A71:F4B5)', activeId: 'a', activeLabel: 'FaceTime HD Camera (3A71:F4B5)', width: 640, height: 480, cameras } }));
});
await sleep(200);
await E(() => document.querySelector('.sp-cam').scrollIntoView({ block: 'center' })); await sleep(200);
const aB = await aim('.sp-dd__btn');
await pinch(170);
const open1 = await E(() => !document.querySelector('.sp-dd__list').hidden);
const aO = await aim('.sp-dd__opt:nth-child(3)');
await pinch(170);
R.settings = { capturedTrigger: aB.captured, opened: open1, capturedOption: aO.captured,
  after: await E(() => ({ open: !document.querySelector('.sp-dd__list').hidden, btn: document.querySelector('.sp-dd__val').textContent, id: window.__vm.settings.get().gestureCameraId })) };
R.settingsTaps = await E(() => window.__A.taps.splice(0));
await E(() => { window.__vm.settings.set('gestureCameraId', ''); window.__vm.settings.set('gestureCameraLabel', ''); clearInterval(window.__A.id); });
report.section('chạm–thả thật');
report.check('bước 1: khung xương THẬT qua lớp cử chỉ (hand:skeleton 21 điểm, tay khoá) vẽ trong khung; con trỏ tay ẩn trong khung', R.skel.body === 'on' && R.skel.events > 10 && R.skel.drawn > 5 && R.skel.vis > 0.5 && R.skelPts.n === 21 && R.skelPts.locked && R.skelPts.inRange && R.skel.cursorOp !== null && R.skel.cursorOp < 0.1, { skel: R.skel, pts: R.skelPts });
report.check('bước 1 qua lớp cử chỉ: "Đưa một bàn tay vào khung" → "Mở rộng cả 5 ngón" → vòng phải (chưa có vòng trái), dòng "right"', R.t0.line === 'frame' && R.rShown && R.t0b.line === 'right' && !R.t0b.s1.lShown && /^frame open right/.test(R.afterFrame.lines), { t0: R.t0.line, t0b: R.t0b.line, lines: R.afterFrame.lines });
report.check('rời khung tới vòng phải → khung xương tắt, con trỏ tay hiện lại', R.afterFrame.body === null && R.afterFrame.cursorOp > 0.9, R.afterFrame);
report.check('bước 1: dừng trong vòng phải → vòng trái + dòng "left"; vào vòng trái → bước 2 (chỉ vòng thứ nhất)', R.lShown && R.t1.line === 'left' && R.t2.step === 2 && R.t2.line === 'toRing' && !R.t2.s2.bShown, { t1: R.t1.line, t2: R.t2.line });
report.check('nam châm bắt vòng', R.t1.captured && R.t3.capturedA, { r: R.t1.captured, a: R.t3.capturedA });
report.check('đang chạm: vòng lún, chưa chọn, dòng "Thả ra"', R.t3.whileHeld.press === '1' && R.t3.whileHeld.sel === '0' && !R.t3.whileHeld.tut.a && R.t3.whileHeld.line === 'release', R.t3.whileHeld);
report.check('thả: chọn vòng A, rồi vòng B hiện cùng dòng "toRing2"', R.t3.afterRelease.s2.a && R.bShown && R.t3b.line === 'toRing2', { b: R.bShown, line: R.t3b.line });
report.check('vòng B → xong bước 2', R.t4.done && R.t4.s2.b);
{
  const [L, Rr] = R.s4.fist;
  report.check('bước 3 (nhón kéo hai lượt) → bước 4 qua lớp cử chỉ', R.step4, R.step4);
  report.check('bước 4: xoè → NẮM tay thật → "Kéo sang trái", khối được cầm (hand:vdrag fist của lớp cử chỉ), con trỏ mờ (data-hand-grab)', L?.g.line === 'pullL' && L?.g.grab?.src === 'hand' && L?.g.handGrab === 'fist', L?.g);
  report.check('kéo trái đủ → "Thả tay ra"; mở tay → "Nắm lại, kéo sang phải"', L?.moved.line === 'openF' && L?.moved.s4.snaps === 1 && L?.after.line === 'grabF2' && L?.after.handGrab === null, { moved: L?.moved, after: L?.after });
  report.check('nắm lại, kéo phải đủ → "Thả tay ra"; mở tay → "Hoàn tất!", rồi đóng; bia bên dưới không đổi', Rr?.moved.line === 'openF2' && Rr?.moved.s4.snaps === 2 && Rr?.after.line === 'done' && R.s4closed && R.s4.stageIdx0 === R.s4.stageIdx1, { moved: Rr?.moved, after: Rr?.after, closed: R.s4closed, idx: [R.s4.stageIdx0, R.s4.stageIdx1] });
}
report.check('mỗi cú chạm–thả = một tap nam châm', R.tutTaps.length === 2 && R.tutTaps.every((t) => /nam châm/.test(t)), R.tutTaps);
report.check('Cài đặt: nam châm bắt nút + mục camera', R.settings.capturedTrigger && R.settings.capturedOption);
report.check('Cài đặt: chạm–thả mở danh sách, chọn "OBS", đóng', R.settings.opened && R.settings.after.id === 'b' && !R.settings.after.open, R.settings.after);
allErrors.push(...errors);
await close();
}

// ================= 2. vẫy để bỏ qua (bộ nhận vẫy thật)
{
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaTutorial', '__vmHand.simulateHand'], settleMs: 1500 });
const E = (fn, a) => page.evaluate(fn, a);
await E(() => {
  window.__W = { log: [], id: 0 };
  window.addEventListener('hand:wave', (e) => window.__W.log.push({ t: Math.round(performance.now()), p: e.detail?.progress, done: !!e.detail?.done, active: window.__vm.cinemaTutorial.state().active, ring: document.querySelector('.cin-tut__skip')?.style.getPropertyValue('--wave') }));
  // một khung / 33 ms qua đường đi thật; fn(tSec) → { x, y, pose }
  // tay giữ yên 0,7 s trước (engage — như khách đã giơ tay dùng), rồi mới cử động
  window.__W.run = (kind, fresh = true) => {
    clearInterval(window.__W.id);
    const t0 = performance.now() + (fresh ? 700 : 0);
    let first = fresh;
    window.__W.id = setInterval(() => {
      const s = Math.max(0, (performance.now() - t0) / 1000);
      let x = 0.5, y = 0.62;
      if (kind === 'wave') x = 0.5 + 0.1 * Math.sin(2 * Math.PI * 2 * s); // 2 Hz, biên độ 0,2 khung
      if (kind === 'slow') x = 0.5 + 0.12 * Math.sin(2 * Math.PI * 0.6 * s); // ra / vào vòng ~0,6 Hz
      window.__vmHand.simulateHand([{ pose: 'open', x, y, ms: 33 }], { live: true, fresh: first });
      first = false;
    }, 33);
  };
  window.__W.stop = () => clearInterval(window.__W.id);
});
const W = {};
// A. cử động chậm (như bước 1) 4 s: không bỏ qua
await E(() => window.__vm.cinemaTutorial.start('manual')); await sleep(500);
await E(() => { window.__W.log = []; window.__W.run('slow'); });
await sleep(4000);
await E(() => window.__W.stop());
W.slow = await E(() => ({ active: window.__vm.cinemaTutorial.state().active, maxProgress: Math.max(0, ...window.__W.log.map((l) => l.p ?? 0)), events: window.__W.log.length, done: window.__W.log.some((l) => l.done), bodyWave: document.body.dataset.handWave ?? null, tut: document.body.dataset.handTutorial ?? null }));
await sleep(1500);
// B. vẫy 2 Hz: vòng "Bỏ qua" đầy dần → xong → hướng dẫn đóng
await E(() => { window.__W.log = []; window.__W.t0 = performance.now() + 700; window.__W.run('wave'); });
await page.waitForFunction(() => !window.__vm.cinemaTutorial.state().active, null, { timeout: 8000 }).catch(() => {});
const tDone = await E(() => Math.round(performance.now() - window.__W.t0));
await sleep(300);
await E(() => window.__W.stop());
W.wave = await E(() => {
  const L = window.__W.log; const t0 = window.__W.t0;
  const prog = L.filter((l) => l.p != null);
  const pick = (ms) => { const l = prog.filter((q) => q.t - t0 <= ms).pop(); return l ? { p: l.p, ring: l.ring } : null; };
  const done = L.find((l) => l.done);
  return { closed: !window.__vm.cinemaTutorial.state().active, doneAtMs: done ? done.t - Math.round(t0) : null, at800: pick(800), at1500: pick(1500), at2000: pick(2000), monotonicUp: prog.every((l, i) => i === 0 || l.p >= prog[i - 1].p - 0.05), bodyWaveAfter: document.body.dataset.handWave ?? null, tutAfter: document.body.dataset.handTutorial ?? null };
});
W.wave.closeMs = tDone;
// C. vẫy nửa chừng rồi thôi: vòng rút dần, hướng dẫn vẫn mở
await E(() => window.__vm.cinemaTutorial.start('manual')); await sleep(500);
await E(() => { window.__W.log = []; window.__W.run('wave'); });
await sleep(1700);
await E(() => { window.__W.stop(); window.__W.run('still', false); });
const midRing = await E(() => document.querySelector('.cin-tut__skip').style.getPropertyValue('--wave'));
await sleep(1600);
await E(() => window.__W.stop());
W.partial = await E(() => ({ active: window.__vm.cinemaTutorial.state().active, maxProgress: Math.max(0, ...window.__W.log.map((l) => l.p ?? 0)), ringAfter: document.querySelector('.cin-tut__skip').style.getPropertyValue('--wave') }));
W.partial.ringAtStop = midRing;
report.section('vẫy để bỏ qua');
report.check('cử động chậm 4 s: không có tiến độ vẫy, hướng dẫn còn mở', W.slow.active && W.slow.maxProgress === 0, W.slow);
report.check('vẫy 2 Hz: vòng đầy dần → bỏ qua (≤ 2,5 s)', W.wave.closed && W.wave.doneAtMs != null && W.wave.doneAtMs <= 2500 && (W.wave.at800?.p ?? 0) > 0, { doneAt: W.wave.doneAtMs, at800: W.wave.at800 });
report.check('xong → gỡ cờ body', W.wave.bodyWaveAfter === null && W.wave.tutAfter === null);
report.check('vẫy nửa chừng rồi thôi: còn mở, vòng rút về 0', W.partial.active && W.partial.maxProgress > 0.2 && W.partial.ringAfter === '0.000', W.partial);
allErrors.push(...errors);
await close();
}
process.exit(report.finish(allErrors));
