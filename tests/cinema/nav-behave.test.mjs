// Hành vi đổi bia + tự trình chiếu bằng sự kiện thật (r26): khoá đổi bia khi đang lướt (r51: ‹ › bằng chuột, phím, vẩy tay
// lúc đang lướt XẾP HÀNG MỘT lượt — chạy khi lướt xong; dòng thời gian / Home / End / lùi của trình duyệt như r26), bỏ "vuốt nhanh = đổi bia", không hover khi tự chuyển, "Trình chiếu ngay" + phím Space, góc
// dưới phải không còn cụm nút cũ. node tests/cinema/nav-behave.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const w = 1440, h = 900;
const report = createReport('nav-behave');
const { page, close, errors } = await launch({ width: w, height: h, headed, settings: { autoRotate: false, cinemaIdleAutoplay: true, cinemaIdleAfter: 120, cinemaArrows: 'gold', handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaTimeline'], settleMs: 3500 });
const want = () => true;
const R = {};
const st = () => page.evaluate(() => { const s = window.__vm.cinemaIdle(); const h = document.querySelector('.cinema'); const nv = document.querySelector('.cin-nv--next'); return { i: s.index, id: s.id, playing: s.playing, mode: s.autoMode, shown: s.shown, presenting: s.presenting, phase: s.phase, lock: h.dataset.navlock, hot: h.dataset.hot, tx: window.__vm.cinemaTxProgress?.() ?? -1, op: +getComputedStyle(nv).opacity, hash: location.hash }; });
// mở khoá VỮNG: r51 — lượt ‹ › xếp hàng chạy ngay sau khi lướt xong (khoá lại trong vài ms) → chờ hết hẳn
const waitUnlock = async (max = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const s = await st(); if (s.lock !== '1' && s.tx < 0) { await sleep(300); const s2 = await st(); if (s2.lock !== '1' && s2.tx < 0) return Date.now() - t0; } await sleep(50); } return -1; };
const park = async () => { await page.mouse.move(700, 120); await sleep(300); };

// ---- T1: chuột bấm dồn mũi tên phải ×4 (120 ms) → +2 (lượt đầu + MỘT lượt xếp hàng, r51); mũi tên mờ lúc khoá; hết khoá bấm lại được
if (want('t1')) {
  await park();
  const s0 = await st();
  const nb = await page.evaluate(() => { const r = document.querySelector('.cin-nv--next').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const t0 = Date.now();
  const samples = [];
  for (let k = 0; k < 4; k++) { await page.mouse.click(nb.x, nb.y); samples.push({ t: Date.now() - t0, ...(await st()) }); await sleep(120); }
  await sleep(350);
  const mid = await st();
  const unlockMs = await waitUnlock();
  const s1 = await st();
  await sleep(400);
  const afterOp = (await st()).op;
  await page.mouse.click(nb.x, nb.y);
  await sleep(200);
  const s2 = await st();
  await waitUnlock();
  R.t1 = { start: s0.i, afterBurst: s1.i, stepsTaken: s1.i - s0.i, midLock: mid.lock, midOpacity: mid.op, restOpacityAfter: afterOp, lockReleasedAfterMs: (Date.now() - t0) && unlockMs, clickAfterUnlock: s2.i - s1.i, hash: s1.hash, samples: samples.map((s) => ({ t: s.t, i: s.i, lock: s.lock })) };
  await park();
}

// ---- T2: bàn phím → ×5 nhanh → +2 (một lượt xếp hàng, r51); Home giữa lúc khoá bị bỏ; End sau khi mở khoá chạy
if (want('t2')) {
  const s0 = await st();
  await page.locator('.cin-stage canvas').first().focus().catch(() => {});
  for (let k = 0; k < 5; k++) { await page.keyboard.press('ArrowRight'); await sleep(60); }
  await page.keyboard.press('Home');
  await sleep(100);
  const s1 = await st();
  await waitUnlock();
  const s2 = await st();
  await page.keyboard.press('ArrowLeft');
  await sleep(100);
  const s3 = await st();
  await waitUnlock();
  await page.keyboard.press('End');
  await sleep(100);
  const s4 = await st();
  await waitUnlock();
  R.t2 = { start: s0.i, duringLock: s1.i, afterBurst: s2.i, burstSteps: s2.i - s0.i, homeDropped: s2.i !== 0, arrowLeftAfterUnlock: s3.i - s2.i, endAfterUnlock: s4.i };
  await page.keyboard.press('Home');
  await waitUnlock();
}

// ---- T3: cú vẩy hai ngón (lớp cử chỉ, __vmHand.simulate — đi qua cổng đổi bia của lớp cử chỉ) ×2 liên tiếp
if (want('t3')) {
  const s0 = await st();
  const a1 = await page.evaluate(() => window.__vmHand?.simulate?.('SWIPE_LEFT') ?? 'no __vmHand');
  await sleep(800); // qua khoá nhịp tay về (583 ms) nhưng còn giữa lượt lướt 1,6 s → r52: lớp cử chỉ BỎ (không xếp hàng)
  const a2 = await page.evaluate(() => window.__vmHand?.simulate?.('SWIPE_LEFT') ?? 'no __vmHand');
  await sleep(150);
  const s1 = await st();
  await waitUnlock();
  await sleep(600); // lượt vẩy lớp cử chỉ giữ lại (nếu có) được phát khi chuyển cảnh xong
  const s2 = await st();
  // (r62: bỏ kiểm "hand:nav 'fired' lúc khoá → không loé" — Điện ảnh không còn nhắm rồi vẩy / hand:nav)
  await sleep(2200); // cổng riêng của lớp cử chỉ (1,7 s kể từ lượt nó vừa phát lại) hết hạn
  const s3a = await st();
  const a3 = await page.evaluate(() => window.__vmHand?.simulate?.('SWIPE_LEFT'));
  await sleep(300);
  const s4 = await st();
  await waitUnlock();
  // __vmHand.simulate không có khung "mất tay" theo sau → dọn cờ tay còn treo (không thì việc nền chờ tay mãi — whenCalm)
  await page.evaluate(() => { delete document.body.dataset.handActive; });
  const wrap = (d) => ((d + 82 + 41) % 82) - 41; // r52: vẩy trái = bia trước — có thể vòng qua bia đầu
  R.t3 = { start: s0.i, afterTwoSwipes: s1.i, afterReplayWindow: s2.i, totalSteps: wrap(s2.i - s0.i), actions1: a1, actions2: a2, thirdSwipe: a3, thirdSwipeSteps: wrap(s4.i - s3a.i) };
}

// ---- T4: dòng thời gian — bấm mốc khác giữa lúc khoá → bỏ; sau khi mở khoá → chạy
if (want('t4')) {
  await park();
  const s0 = await st();
  await page.keyboard.press('ArrowRight');
  await sleep(150);
  const tgt = (s0.i + 20) % 82;
  const pt = await page.evaluate((i) => { const r = window.__vm.cinemaTimeline.tickRect(i); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, tgt);
  await page.mouse.move(pt.x, pt.y, { steps: 4 });
  await page.mouse.down(); await page.mouse.up();
  await sleep(150);
  const s1 = await st();
  await waitUnlock();
  const s1b = await st();
  const pt2 = await page.evaluate((i) => { const r = window.__vm.cinemaTimeline.tickRect(i); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, tgt);
  await page.mouse.move(pt2.x + 1, pt2.y, { steps: 2 });
  await page.mouse.down(); await page.mouse.up();
  await sleep(200);
  const s2 = await st();
  await waitUnlock();
  R.t4 = { start: s0.i, target: tgt, afterClickDuringLock: s1.i, settled: s1b.i, afterClickUnlocked: s2.i, ok: s1b.i === (s0.i + 1) % 82 && s2.i === tgt };
  await park();
}

// ---- T6: tự trình chiếu với con trỏ nằm yên trên bia → không hover (shown chỉ khi presenting); rê thật → dừng + hover lại
if (want('t6')) {
  const p = await page.evaluate(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p.x - 20, p.y, { steps: 3 });
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await sleep(900);
  const hoverBefore = await st();
  R.t6dbg = await page.evaluate(() => ({ idle: window.__vm.cinemaIdle(), liveLod: window.__vm.cinemaLods().liveLod, modal: document.body.dataset.modal || null, settings: !document.querySelector('.cin-setwrap').hidden, body: { ...document.body.dataset }, host: { ...document.querySelector('.cinema').dataset } }));
  await page.evaluate(() => window.__vm.cinemaIdle({ idleMs: 1e7 })); // như đã rảnh lâu (con trỏ không đụng tới)
  const turnOn = 'cinemaIdle({idleMs})';
  const trace = [];
  const t0 = Date.now();
  let startedAt = -1;
  while (Date.now() - t0 < 24000) {
    const s = await st();
    if (s.playing && startedAt < 0) startedAt = Date.now() - t0;
    trace.push({ t: Date.now() - t0, i: s.i, playing: s.playing, phase: s.phase, shown: s.shown, presenting: s.presenting, hot: s.hot, tx: +s.tx.toFixed(2), lock: s.lock });
    await sleep(100);
  }
  const bad = trace.filter((x) => x.playing && x.shown && !x.presenting);
  const hotBad = trace.filter((x) => x.playing && x.hot === '1');
  const startGap = startedAt >= 0 ? trace.filter((x) => x.t >= startedAt && x.t < startedAt + 1500 && !x.shown).length : -1;
  const steps = new Set(trace.map((x) => x.i)).size - 1;
  R.t6dbg2 = await page.evaluate(() => ({ idle: window.__vm.cinemaIdle(), liveLod: window.__vm.cinemaLods().liveLod, body: { ...document.body.dataset }, host: { ...document.querySelector('.cinema').dataset } }));
  // rê thật (nhỏ) trên bia → dừng + hover
  const p2 = await page.evaluate(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p2.x + 6, p2.y + 4, { steps: 3 });
  await sleep(700);
  const afterMove = await st();
  R.t6 = { settingsCall: turnOn, hoverBeforeAutoplay: hoverBefore.shown, autoplayStartedAtMs: startedAt, steleSteps: steps, framesShownWithoutPresenting: bad.length, framesHotWhilePlaying: hotBad.length, hiddenFramesInFirst1500msAfterStart: startGap, afterRealMove: { playing: afterMove.playing, shown: afterMove.shown }, sample: trace.filter((_, k) => k % 10 === 0) };
  await park();
  await waitUnlock();
}

// ---- T7: bảng cài đặt → Thông tin → "Trình chiếu ngay"; rê chuột ngay sau (ra khỏi bảng) vẫn chạy; sau 2,5 s rê → dừng
if (want('t7')) {
  await park();
  await page.click('.cin-gear');
  await sleep(500);
  await page.getByRole('tab', { name: 'Thông tin' }).click();
  await sleep(300);
  const btn = page.getByRole('button', { name: 'Trình chiếu ngay' });
  const visible = await btn.isVisible();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await sleep(150);
  const s1 = await st();
  const settingsOpen = await page.evaluate(() => !document.querySelector('.cin-setwrap').hidden);
  await page.mouse.move(300, 300, { steps: 6 });
  await sleep(600);
  const s2 = await st();
  await sleep(2200);
  await page.mouse.move(310, 330, { steps: 3 });
  await sleep(300);
  const s3 = await st();
  // Space: ▶ tay còn chạy (phím tắt giữ nguyên)
  await page.evaluate(() => document.querySelector('.cin-stage').focus({ preventScroll: true })); // (sau khi đóng bảng, tiêu điểm ở nút bánh răng — Space sẽ bấm nút đó)
  await sleep(900);
  await page.keyboard.press(' ');
  await sleep(200);
  const s4 = await st();
  await page.keyboard.press(' ');
  await sleep(200);
  const s5 = await st();
  R.t7 = { buttonVisible: visible, afterClick: { playing: s1.playing, mode: s1.mode, settingsOpen }, afterMoveWithinGrace: { playing: s2.playing }, afterMoveAfterGrace: { playing: s3.playing }, spaceOn: { playing: s4.playing, mode: s4.mode }, spaceOff: { playing: s5.playing } };
}

// ---- T8: góc dưới phải trống, nhãn "Tự trình chiếu" không đè dòng thời gian
if (want('t8')) {
  R.t8 = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tl = q('.cin-prog').getBoundingClientRect();
    const note = q('.cin-autonote').getBoundingClientRect();
    return { cluster: !!q('.cin-ctrl, .cin-count, .cin-btn'), timeline: { l: Math.round(tl.left), r: Math.round(tl.right), t: Math.round(tl.top), b: Math.round(tl.bottom) }, note: { l: Math.round(note.left), r: Math.round(note.right), t: Math.round(note.top), b: Math.round(note.bottom) }, overlap: note.left < tl.right && note.top < tl.bottom && note.bottom > tl.top };
  });
}

// ---- T9: lùi của trình duyệt giữa lúc đang lướt → áp khi lượt lướt xong (địa chỉ và bia không lệch), có chuyển cảnh thật
if (want('t9')) {
  await park();
  await waitUnlock();
  const s0 = await st();
  const nb = await page.evaluate(() => { const r = document.querySelector('.cin-nv--next').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(nb.x, nb.y);
  await sleep(300);
  const s1 = await st();
  await page.evaluate(() => history.back());
  await sleep(200);
  const s2 = await st();
  let sawTx = false;
  const t0 = Date.now();
  let unlockedAt = -1;
  while (Date.now() - t0 < 6000) { const s = await st(); if (s.lock !== '1' && unlockedAt < 0 && s.i === s0.i) unlockedAt = Date.now() - t0; if (s.i === s0.i && s.tx >= 0) sawTx = true; await sleep(40); }
  await waitUnlock();
  const s3 = await st();
  R.t9 = { start: s0.i, startHash: s0.hash, afterClick: s1.i, afterBackDuringLock: { i: s2.i, hash: s2.hash }, final: { i: s3.i, hash: s3.hash }, backTransitionRan: sawTx, ok: s3.i === s0.i && s3.hash === s0.hash };
}

// ---- T5: kéo chuột nhanh (trước: > 60 px trong < 300 ms = đổi bia) → không đổi bia; tay (véo–kéo, id 9001) cũng vậy
if (want('t5')) {
  await park();
  await sleep(600);
  const s0 = await st();
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(520, 455, { steps: 3 });
  await page.mouse.move(360, 458, { steps: 2 });
  await page.mouse.up();
  await sleep(1200);
  const s1 = await st();
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(980, 452, { steps: 4 });
  await page.mouse.up();
  await sleep(1200);
  const s2 = await st();
  // tay: con trỏ tổng hợp của lớp cử chỉ (pointerId 9001) véo–kéo 300 px trong 150 ms, body.gesture-on
  const s3 = await page.evaluate(async () => {
    document.body.classList.add('gesture-on');
    const c = document.querySelector('.cin-stage canvas');
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 9001, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
    ev('pointerdown', 700, 450);
    for (let k = 1; k <= 5; k++) { await new Promise((r) => setTimeout(r, 30)); ev('pointermove', 700 - k * 60, 452); }
    ev('pointerup', 400, 452);
    await new Promise((r) => setTimeout(r, 1200));
    document.body.classList.remove('gesture-on');
    return window.__vm.cinemaIdle().index;
  });
  R.t5 = { start: s0.i, afterFastDragLeft: s1.i, afterFastDragRight: s2.i, afterHandFastDrag: s3, ok: s1.i === s0.i && s2.i === s0.i && s3 === s0.i };
  await park();
  await sleep(2500); // camera tự về khung
}


// ---------------------------------------------------------------------------- kiểm
const n = 82;
report.section('khoá đổi bia');
report.check('t1 chuột bấm dồn ×4 → +2 (lượt đầu + một lượt xếp hàng khi lướt xong, r51)', R.t1.stepsTaken === 2, R.t1);
report.check('t1 mũi tên mờ lúc khoá', R.t1.midLock === '1' && R.t1.midOpacity < 0.8, { lock: R.t1.midLock, op: R.t1.midOpacity });
report.check('t1 hết khoá bấm lại được', R.t1.clickAfterUnlock === 1);
report.check('t2 phím → ×5 nhanh → +2 (một lượt xếp hàng, r51)', R.t2.burstSteps === 2, R.t2);
report.check('t2 Home giữa lúc khoá bị bỏ', R.t2.homeDropped === true);
report.check('t2 ← sau khi mở khoá chạy', R.t2.arrowLeftAfterUnlock === -1);
report.check('t2 End sau khi mở khoá → bia cuối', R.t2.endAfterUnlock === n - 1);
// r52: cú vẩy hai ngón (SWIPE_LEFT = nửa trái vẩy trái = bia TRƯỚC) lúc đang lướt bị BỎ — không xếp hàng như chuột / phím;
// vẩy liên tục thật (qua engine) thì nhảy 5 — xem tests/gesture/vswipe-live.mjs
report.check('t3 vẩy hai ngón ×2 liên tiếp → −1 (lượt 2 lúc đang lướt bị bỏ — r52)', R.t3.totalSteps === -1, { total: R.t3.totalSteps, a2: R.t3.actions2 });
report.check('t3 vẩy sau khi mở khoá → −1', R.t3.thirdSwipeSteps === -1);
report.check('t4 dòng thời gian: bấm lúc khoá bỏ, sau khi mở chạy', R.t4.ok === true, R.t4);
report.check('t9 lùi của trình duyệt lúc khoá → áp khi xong (bia + địa chỉ đúng, có lướt)', R.t9.ok === true && R.t9.backTransitionRan === true, R.t9);
report.section('kéo nhanh không đổi bia');
report.check('t5 kéo nhanh chuột / tay → không đổi bia', R.t5.ok === true, R.t5);
report.section('tự trình chiếu');
report.check('t6 tự trình chiếu bắt đầu', R.t6.autoplayStartedAtMs >= 0 && R.t6.steleSteps >= 1, { started: R.t6.autoplayStartedAtMs, steps: R.t6.steleSteps });
report.check('t6 con trỏ nằm yên trên bia: không hover, không thông tin suốt lúc tự trình chiếu (r39)', R.t6.framesShownWithoutPresenting === 0 && R.t6.framesHotWhilePlaying === 0, { shown: R.t6.framesShownWithoutPresenting, hot: R.t6.framesHotWhilePlaying });
report.check('t6 rê thật → dừng tự trình chiếu', R.t6.afterRealMove.playing === false);
report.check('t7 "Trình chiếu ngay" → chạy, bảng đóng', R.t7.buttonVisible && R.t7.afterClick.playing === true && R.t7.afterClick.settingsOpen === false, R.t7.afterClick);
report.check('t7 rê ngay sau (trong 2,5 s) vẫn chạy', R.t7.afterMoveWithinGrace.playing === true);
report.check('t7 rê sau 2,5 s → dừng', R.t7.afterMoveAfterGrace.playing === false);
report.check('t7 Space bật / tắt tự chuyển', R.t7.spaceOn.playing === true && R.t7.spaceOff.playing === false, { on: R.t7.spaceOn, off: R.t7.spaceOff });
report.section('bố cục');
report.check('t8 không còn cụm nút góc dưới phải', R.t8.cluster === false);
report.check('t8 nhãn "Tự trình chiếu" không đè dòng thời gian', R.t8.overlap === false, R.t8);
await close();
process.exit(report.finish(errors));
