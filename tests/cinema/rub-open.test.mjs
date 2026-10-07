// r70 — "Xoa đầu rùa" là easter egg: chỉ mở khi XOA THẬT trên đầu rùa lúc đang xem bia (người dùng: "phần xoa đầu rùa hơi
// dễ kích hoạt. tôi muốn nó là easter egg để user khám phá" → "Xoa thật mới mở"). Kiểm qua đường nhập liệu thật của view
// (__vm.cinemaRub.tryRub: hand:frame tổng hợp / pointer tổng hợp theo giờ thật; chuột Playwright thật; clip hand2 qua lớp
// cử chỉ thật __vmHand.ingestLive):
//   A. để yên / rê chậm / lướt qua đầu rùa 10 s (tay xoè), rê chuột xoa mà không nhấn, nhấn giữ yên → không mở, không ánh
//   B. 1 nhịp → ánh mờ, 2 nhịp → ánh sáng hơn, không mở; ngưng → ánh tắt về 0 trong ~1 s; không chữ, không bộ đếm
//   C. 3 nhịp qua lại / xoay tròn → loé (vệt quét + vòng nở) rồi vào chế độ xoa
//   D. chuột: nhấn giữ + xoa vài nhịp → mở; bấm gọn trên đầu rùa → KHÔNG mở (chỉ focus bia như bấm bia); nhấn trên đầu rùa
//      rồi kéo ngang một mạch → xoay camera như nhấn chỗ khác, không mở
//   E. đang bận: nhón (xoay cảnh), giữ chữ V, cầm bia nắm tay (body[data-stele-grab]), chờ hover sau khi kéo đổi bia → không mở
//   G. (r70b) xoa NGAY khi bia vừa focus (≤ 100 ms — camera đang lướt vào khung focus, đầu rùa trôi ~60–80 px, to thêm
//      ~10 %): tay tổng hợp bám / không bám đầu rùa, tay qua lớp cử chỉ thật không bám (xấu nhất), chuột nhấn ngay → 3 nhịp là mở
//   F. phát lại trọn clip hand2 (~90 s, người thật dùng cử chỉ) → 0 lần mở
// node tests/cinema/rub-open.test.mjs --port 5180   (≈ 5 phút)
import { readFileSync } from 'node:fs';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';
import { handRubAtFocus, installHand, mouseRubOpen, removeHand } from '../lib/rub-sim.mjs';

const { port, headed } = parseArgs();
const report = createReport('rub-open');
const { page, close, errors } = await launch({
  headed,
  width: 1440,
  height: 900,
  settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, tutorialAdaptive: false },
});
await openCinema(page, port, { hooks: ['cinemaRub', 'cinemaPresence', 'cinemaCam', 'cinemaGrabHover', 'settings', '__vmHand.ingestLive', '__vmHand.simulateHand'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const st = () => E(() => window.__vm.cinemaRub.state());
const acts = async () => (await st()).activations;
/** Chạy một lần thử (giờ thật) → tóm tắt vết. */
const tryRub = async (o) => {
  const r = await E((o) => window.__vm.cinemaRub.tryRub(o), o);
  const rows = r.rows;
  const motion = rows.filter((x) => x.ph !== 'aim' && x.ph !== 'after');
  const tEnd = motion.at(-1)?.t ?? 0;
  const after = rows.filter((x) => x.ph === 'after');
  const peak = Math.max(0, ...rows.map((x) => x.fx));
  // ánh về ~0 (< 0,02) sau lần cuối nó còn > 0,02
  const lastLit = rows.findLastIndex((x) => x.fx >= 0.02);
  const darkAt = lastLit >= 0 && lastLit < rows.length - 1 ? rows[lastLit + 1].t - tEnd : null;
  return {
    active: r.rub.active,
    source: r.rub.source,
    maxStrokes: Math.max(0, ...rows.map((x) => x.strokes)),
    peak: +peak.toFixed(3),
    endFx: rows.at(-1)?.fx ?? 0,
    darkAfterMs: darkAt,
    entering: rows.some((x) => x.entering),
    caps: [...new Set(rows.map((x) => x.cap).filter(Boolean))],
    whys: [...new Set(rows.map((x) => x.why))],
    shown: rows.filter((x) => x.ph === 'aim').at(-1)?.shown ?? null,
    head: r.head0,
    afterActive: after.some((x) => x.active),
    glide: r.glide,
    focusLeadMs: r.focusLeadMs,
  };
};
const leave = async () => {
  if ((await st()).active) await E(() => window.__vm.cinemaRub.exit('test'));
  await page.mouse.move(60, 450);
  await sleep(3000); // camera về khung, qua ARM_REST_MS
};
const hudExtras = () => E(() => ({ hold: !!document.querySelector('.cin-rub__hold'), capText: document.querySelector('.cin-rub')?.classList.contains('is-cap') ?? false }));
const R = {};
await page.mouse.move(60, 450);

// ---- A. để yên / rê / lướt → không mở
{
  const a0 = await acts();
  R.still = await tryRub({ motion: 'still', ms: 10000, afterMs: 200 });
  R.drift = await tryRub({ motion: 'drift', ms: 10000, afterMs: 200 });
  R.sweep = await tryRub({ motion: 'sweep', ms: 700, afterMs: 400 });
  R.mouseHold = await tryRub({ src: 'mouse', motion: 'still', ms: 2500, afterMs: 400 });
  // chuột thật: rê lên đầu rùa rồi xoa qua lại KHÔNG nhấn (hover) 3 s
  const h = await E(() => window.__vm.cinemaRub.head());
  await page.mouse.move(h.x, h.y, { steps: 4 });
  await sleep(800);
  const t0 = Date.now();
  let peak = 0;
  while (Date.now() - t0 < 3000) {
    const t = Date.now() - t0;
    await page.mouse.move(h.x + 0.5 * h.r * Math.sin((2 * Math.PI * 2.2 * t) / 1000), h.y);
    peak = Math.max(peak, (await st()).arm.fx);
    await sleep(8);
  }
  const s1 = await st();
  R.mouseHover = { active: s1.active, strokes: s1.arm.strokes, peak: Math.max(peak, s1.arm.fx) };
  R.A = { activations: (await acts()) - a0 };
  await leave();
}

// ---- B. 1–2 nhịp → chỉ ánh
{
  const a0 = await acts();
  R.one = await tryRub({ motion: 'rub', strokes: 1, afterMs: 1500 });
  await sleep(600);
  R.two = await tryRub({ motion: 'rub', strokes: 2, afterMs: 1500 });
  R.twoHud = await hudExtras();
  R.B = { activations: (await acts()) - a0 };
  await leave();
}

// ---- C. 3 nhịp → mở
{
  const a0 = await acts();
  R.three = await tryRub({ motion: 'rub', strokes: 3, afterMs: 900 });
  R.C1 = { activations: (await acts()) - a0 };
  await leave();
  const a1 = await acts();
  R.circle = await tryRub({ motion: 'circle', strokes: 3.5, freq: 1.6, ampK: 0.45, afterMs: 900 });
  R.C2 = { activations: (await acts()) - a1 };
  await leave();
}

// ---- D. chuột: nhấn giữ + xoa → mở; bấm gọn → không
{
  const a0 = await acts();
  R.mouseRub = { how: await mouseRubOpen(page, { tries: 1 }), source: (await st()).source };
  R.D1 = { activations: (await acts()) - a0 };
  await leave();
  const a1 = await acts();
  const h = await E(() => window.__vm.cinemaRub.head());
  await page.mouse.move(h.x, h.y, { steps: 4 });
  await sleep(900);
  const h2 = await E(() => window.__vm.cinemaRub.head());
  await page.mouse.click(h2.x, h2.y);
  await sleep(1000);
  await page.mouse.click(h2.x, h2.y);
  await sleep(1000);
  const s = await st();
  R.click = { active: s.active, activations: (await acts()) - a1, fx: s.arm.fx, presence: await E(() => window.__vm.cinemaPresence()) };
  // nhấn trên đầu rùa rồi kéo ngang một mạch 260 px → xoay camera
  const c0 = await E(() => window.__vm.cinemaCam());
  const h3 = await E(() => window.__vm.cinemaRub.head());
  await page.mouse.move(h3.x, h3.y);
  await page.mouse.down();
  await page.mouse.move(h3.x + 260, h3.y + 10, { steps: 20 });
  const mid = await st();
  await page.mouse.up();
  await sleep(200);
  const c1 = await E(() => window.__vm.cinemaCam());
  const d = Math.hypot(c1.pos[0] - c0.pos[0], c1.pos[1] - c0.pos[1], c1.pos[2] - c0.pos[2]);
  R.drag = { moved: +d.toFixed(3), userMoved: c1.userMoved, active: (await st()).active, armMouse: mid.arm.mouse, strokes: mid.arm.strokes, activations: (await acts()) - a1 };
  await page.mouse.move(60, 450);
  await sleep(4000);
  await leave();
}

// ---- E. đang bận → không mở (3,6 nhịp qua lại, đủ mở khi rảnh)
{
  const a0 = await acts();
  const rub = { motion: 'rub', strokes: 3.6, afterMs: 700 };
  R.busyPinch = await tryRub({ ...rub, pose: 'pinch' });
  // r72: chữ V không còn kéo bia — giữ V (tay không xoè) không bao giờ là xoa; thử tay tư thế V qua tryRub (pose khác 'open')
  R.busyV = await tryRub({ ...rub, pose: 'v' });
  await E(() => { document.body.dataset.steleGrab = 'fist'; });
  R.busyFist = await tryRub(rub);
  await E(() => { delete document.body.dataset.steleGrab; });
  await E(() => window.__vm.settings.set('grabHoverDelay', 3));
  const gh = await E(() => window.__vm.cinemaGrabHover({ arm: 'fist' }));
  R.busyHover = await tryRub({ ...rub, aimMs: 500, freq: 2.6 });
  R.busyHover.gh = { armed: gh.phase, after: (await E(() => window.__vm.cinemaGrabHover())).phase };
  await E(() => window.__vm.settings.set('grabHoverDelay', 2));
  R.E = { activations: (await acts()) - a0 };
  await leave();
  // đối chứng: cùng kiểu xoa, rảnh tay → mở
  const a1 = await acts();
  R.busyCtl = await tryRub({ ...rub, afterMs: 900 });
  R.E2 = { activations: (await acts()) - a1 };
  await leave();
}

// ---- G. xoa ngay khi bia vừa focus (camera đang lướt vào khung focus)
{
  const a0 = await acts();
  const atFocus = { motion: 'rub', strokes: 3.4, untilFocus: true, aimMs: 3000, afterMs: 900 };
  R.gFixed = await tryRub({ ...atFocus, track: false });
  await leave();
  R.gTrack = await tryRub({ ...atFocus, track: true });
  await leave();
  R.gMouse = await tryRub({ ...atFocus, src: 'mouse', track: false });
  await leave();
  await installHand(page);
  R.gReal = await handRubAtFocus(page);
  await E(() => { window.__A.pose = 'none'; });
  await leave();
  await removeHand(page);
  R.G = { activations: (await acts()) - a0 };
}

// ---- F. hand2 trọn clip qua lớp cử chỉ thật → 0 lần mở
{
  const ALL = JSON.parse(readFileSync(new URL('../../test-clips/hand2-landmarks.json', import.meta.url), 'utf8'));
  const a0 = await acts();
  R.hand2 = await E(async (frames) => {
    document.body.classList.add('gesture-on');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const H = window.__vmHand;
    const w0 = performance.now();
    const f0 = frames[0].t;
    let maxStrokes = 0;
    let maxFx = 0;
    let everActive = false;
    let tries = 0;
    let lastSrc = null;
    for (let i = 0; i < frames.length; i++) {
      const wait = w0 + (frames[i].t - f0) * 1000 - performance.now();
      if (wait > 0) await sleep(wait);
      H.ingestLive(frames[i], { t: performance.now(), fresh: i === 0, aspect: 1620 / 1080 }); // hand2.mp4 1620×1080
      const s = window.__vm.cinemaRub.state();
      maxStrokes = Math.max(maxStrokes, s.arm.strokes);
      maxFx = Math.max(maxFx, s.arm.fx);
      everActive ||= s.active;
      if (s.arm.src === 'hand' && lastSrc !== 'hand') tries++;
      lastSrc = s.arm.src;
    }
    document.body.classList.remove('gesture-on');
    return { frames: frames.length, secs: Math.round((performance.now() - w0) / 1000), maxStrokes, maxFx: +maxFx.toFixed(3), everActive, handOnHead: tries };
  }, ALL);
  R.F = { activations: (await acts()) - a0 };
}

// ---------------------------------------------------------------------------- kiểm
const nothing = (r) => !r.active && r.maxStrokes === 0 && r.peak < 0.02 && !r.entering;
report.section('A. để yên / rê / lướt → không mở');
report.check('tay xoè để yên trên đầu rùa 10 s (bia đang focus) → không mở, không ánh', nothing(R.still) && R.still.shown === true, R.still);
report.check('tay xoè rê chậm quanh đầu rùa 10 s → không mở, không ánh', nothing(R.drift), R.drift);
report.check('tay lướt ngang qua đầu rùa một lượt → không mở', nothing(R.sweep), R.sweep);
report.check('chuột nhấn giữ yên trên đầu rùa 2,5 s → không mở', nothing(R.mouseHold), R.mouseHold);
report.check('rê chuột xoa qua lại trên đầu rùa mà KHÔNG nhấn 3 s → không mở, không ánh', !R.mouseHover.active && R.mouseHover.strokes === 0 && R.mouseHover.peak < 0.02, R.mouseHover);
report.check('A: 0 lần mở', R.A.activations === 0, R.A);
report.section('B. 1–2 nhịp → chỉ ánh, không mở');
report.check('1 nhịp → ánh mờ (0,1–0,3), không mở', !R.one.active && R.one.maxStrokes === 1 && R.one.peak > 0.1 && R.one.peak < 0.3 && !R.one.entering, R.one);
report.check('2 nhịp → ánh sáng hơn (0,35–0,6), không mở', !R.two.active && R.two.maxStrokes === 2 && R.two.peak > 0.35 && R.two.peak < 0.6 && R.two.peak > R.one.peak && !R.two.entering, R.two);
report.check('ngưng xoa → ánh tắt về ~0 trong ≤ 1,2 s', R.one.darkAfterMs != null && R.one.darkAfterMs <= 1200 && R.two.darkAfterMs != null && R.two.darkAfterMs <= 1200 && R.one.endFx < 0.02 && R.two.endFx < 0.02, { one: R.one.darkAfterMs, two: R.two.darkAfterMs });
report.check('không chữ, không bộ đếm (không chú thích, không vòng giữ)', R.one.caps.length === 0 && R.two.caps.length === 0 && !R.twoHud.hold && !R.twoHud.capText, { caps: [...R.one.caps, ...R.two.caps], hud: R.twoHud });
report.check('B: 0 lần mở', R.B.activations === 0, R.B);
report.section('C. 3 nhịp → mở');
report.check('3 nhịp qua lại → loé nhịp cuối rồi vào chế độ xoa (nguồn tay)', R.three.active && R.three.entering && R.three.source === 'hand' && R.C1.activations === 1, { ...R.three, ...R.C1 });
report.check('xoay tròn ~3 vòng → vào chế độ xoa', R.circle.active && R.C2.activations === 1, { ...R.circle, ...R.C2 });
report.section('D. chuột');
report.check('nhấn giữ trên đầu rùa rồi xoa vài nhịp → vào chế độ xoa (nguồn chuột)', R.mouseRub.how === 'rub' && R.mouseRub.source === 'mouse' && R.D1.activations === 1, { ...R.mouseRub, ...R.D1 });
report.check('bấm gọn trên đầu rùa (2 lần) → KHÔNG mở, không ánh; bia vẫn focus như bấm bia', !R.click.active && R.click.activations === 0 && R.click.fx < 0.02 && R.click.presence.shown, R.click);
report.check('nhấn trên đầu rùa rồi kéo ngang một mạch → xoay camera như thường, không mở', R.drag.moved > 0.05 && !R.drag.active && !R.drag.armMouse && R.drag.activations === 0, R.drag);
report.section('E. đang bận → không mở');
report.check('nhón tay (xoay cảnh) xoa trên đầu rùa → không mở', !R.busyPinch.active && R.busyPinch.maxStrokes === 0, R.busyPinch);
report.check('giữ chữ V (r72: giữ trên bia = mở thông tin đầy đủ) xoa qua lại → không mở', !R.busyV.active && R.busyV.maxStrokes === 0, R.busyV);
report.check('đang cầm bia nắm tay (data-stele-grab="fist") → không mở', !R.busyFist.active && R.busyFist.maxStrokes === 0, R.busyFist);
report.check('đang chờ hover sau khi kéo đổi bia → không mở', !R.busyHover.active && R.busyHover.maxStrokes === 0 && R.busyHover.gh.armed != null, R.busyHover);
report.info('vì sao không thử (small = đầu rùa nhỏ / không focus, no-src = tay đang bận)', { pinch: R.busyPinch.whys, v: R.busyV.whys, fist: R.busyFist.whys, hover: R.busyHover.whys });
report.check('E: 0 lần mở; đối chứng rảnh tay cùng kiểu xoa → mở', R.E.activations === 0 && R.busyCtl.active && R.E2.activations === 1, { busy: R.E, ctl: R.E2 });
report.section('G. xoa ngay khi bia vừa focus (camera đang lướt)');
const glided = (g, px) => !!g && Math.hypot(g.dx, g.dy) >= px;
report.check('tay (tổng hợp) xoa tại chỗ — không bám đầu rùa đang trôi — bắt đầu ≤ 100 ms sau focus → 3 nhịp là mở', R.gFixed.active && R.gFixed.focusLeadMs != null && R.gFixed.focusLeadMs <= 100 && glided(R.gFixed.glide, 20), R.gFixed);
report.check('tay (tổng hợp) bám theo đầu rùa, bắt đầu ≤ 100 ms sau focus → mở', R.gTrack.active && R.gTrack.focusLeadMs <= 100 && glided(R.gTrack.glide, 20), R.gTrack);
report.check('lớp cử chỉ thật: đặt tay lên đầu rùa, xoa tại chỗ ngay khung focus (đầu rùa trôi ≥ 30 px trong lúc xoa) → mở', R.gReal.active && R.gReal.leadMs <= 100 && glided(R.gReal.glide, 30) && R.gReal.activations === 1, R.gReal);
report.check('chuột nhấn ngay khung focus rồi xoa → mở', R.gMouse.active && R.gMouse.focusLeadMs <= 100, R.gMouse);
report.check('G: đúng 4 lần mở', R.G.activations === 4, R.G);
report.section('F. phát lại hand2 (lớp cử chỉ thật)');
report.check('trọn clip hand2 (~90 s) → 0 lần mở, chưa từng vào chế độ xoa', R.F.activations === 0 && !R.hand2.everActive && R.hand2.frames > 2000, { ...R.hand2, ...R.F });
report.info('hand2', R.hand2);
await close();
process.exit(report.finish(errors));
