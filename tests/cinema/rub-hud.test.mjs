// Chế độ xoa đầu rùa (r34): hai mũi tên + dòng thời gian (cả nhãn / thẻ) mờ ra ~250 ms và không nhận chuột / tay; giữ ẩn
// suốt lúc camera bay về sau khi thoát; hiện lại ~400 ms; vào lại giữa chừng không nháy. Nút × + chú thích xoa vẫn dùng
// được, HUD khác không đổi. Chuột (r70: nhấn giữ trên đầu rùa rồi xoa vài nhịp → vào / Esc) và tay (lớp cử chỉ thật —
// r70: xoè tay xoa qua lại trên đầu rùa → vào; tay rời khung → tự thoát sau 9 s). node tests/cinema/rub-hud.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';
import { handRubOpen, installHand, mouseRubOpen } from '../lib/rub-sim.mjs';

const { port, headed } = parseArgs();
const report = createReport('rub-hud');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaRub', '__vmHand.simulateHand'], settleMs: 2500 });
const E = (fn, a) => page.evaluate(fn, a);
// bộ ghi mỗi khung: cờ, độ mờ, visibility
await E(() => {
  const host = document.querySelector('.cinema');
  const S = (window.__S = { on: false, rows: [], t0: 0 });
  const nav = host.querySelector('.cin-nav');
  const bot = host.querySelector('.cin-bottom');
  const tick = () => {
    if (S.on) {
      const a = getComputedStyle(nav);
      const b = getComputedStyle(bot);
      S.rows.push({ t: Math.round(performance.now() - S.t0), hud: host.dataset.rubhud ?? '', active: window.__vm.cinemaRub.state().active, zones: document.body.hasAttribute('data-hand-zones-off'),
        nOp: +(+a.opacity).toFixed(3), nVis: a.visibility, bOp: +(+b.opacity).toFixed(3), bVis: b.visibility });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  S.start = () => { S.rows = []; S.t0 = performance.now(); S.on = true; };
  S.stop = () => { S.on = false; return S.rows; };
});
const center = (sel) => E((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const hits = () => E(() => {
  const at = (x, y) => document.elementFromPoint(x, y);
  const inHud = (e) => !!e?.closest?.('.cin-nav, .cin-bottom');
  const c = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const ticks = [...document.querySelectorAll('.cin-tl__tick')];
  const pts = [c(document.querySelector('.cin-nv--prev')), c(document.querySelector('.cin-nv--next')), c(ticks[Math.floor(ticks.length / 2)]), c(ticks[3])];
  return pts.map(([x, y]) => inHud(at(x, y)));
});
const others = () => E(() => {
  const o = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return `${(+c.opacity).toFixed(2)}/${c.visibility}`; };
  const close = document.querySelector('.cin-rub__close');
  return { top: o('.cin-top'), hud: o('.cin-hud'), fab: o('.cin-fab'), rubClose: o('.cin-rub__close'), rubCap: document.querySelector('.cin-rub')?.classList.contains('is-cap'), closeHit: close ? (() => { const r = close.getBoundingClientRect(); return r.width > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === close; })() : null };
});
const settle = async (ms = 400) => { await sleep(ms); };
/** Vào bằng CHUỘT như người dùng (r70): rê lên đầu rùa (bia focus), nhấn giữ rồi xoa qua lại vài nhịp, thả. */
async function mouseEnter() {
  if ((await mouseRubOpen(page)) === 'rub') return 'rub';
  await E(() => window.__vm.cinemaRub.enter('mouse'));
  return 'dev-enter';
}
const R = {};
const summarize = (rows, tEvent) => {
  const after = rows.filter((r) => r.t >= tEvent);
  return after;
};

// ================= M: chuột vào / ra
{
  const before = { hits: await hits(), others: await others(), hud: await E(() => document.querySelector('.cinema').dataset.rubhud ?? null) };
  await E(() => window.__S.start());
  const how = await mouseEnter();
  const tEnter = await E(() => Math.round(performance.now() - window.__S.t0));
  await sleep(700);
  const inRub = { hits: await hits(), others: await others() };
  // chuột rê ngang dòng thời gian + mũi tên trong chế độ xoa
  const tk = await center('.cin-tl__track');
  await page.mouse.move(tk.x - 100, tk.y, { steps: 4 }); await page.mouse.move(tk.x + 80, tk.y, { steps: 6 }); await sleep(250);
  const tlDuring = await E(() => { const t = document.querySelector('.cin-tl'); return { focus: t.dataset.focus ?? null, pop: t.dataset.pop ?? null }; });
  const nv = await center('.cin-nv--next');
  await page.mouse.move(nv.x, nv.y, { steps: 4 }); await sleep(250);
  const navDuring = await E(() => { const b = document.querySelector('.cin-nv--next'); return { hover: b.matches(':hover'), near: b.dataset.near, sticky: b.classList.contains('is-sticky') }; });
  const stillActive = await E(() => window.__vm.cinemaRub.state().active);
  const tExit = await E(() => Math.round(performance.now() - window.__S.t0));
  await page.keyboard.press('Escape');
  await sleep(3200);
  const rows = await E(() => window.__S.stop());
  const enterRows = rows.filter((r) => r.t >= tEnter && r.t < tEnter + 700);
  const firstHid = rows.find((r) => r.hud === '1');
  const at = (ms) => rows.find((r) => r.t >= ms) ?? rows[rows.length - 1];
  const exitRows = rows.filter((r) => r.t >= tExit);
  const zonesOffAt = exitRows.find((r) => !r.zones);
  const fadeRows = zonesOffAt ? exitRows.filter((r) => r.t >= zonesOffAt.t) : [];
  const fullAt = fadeRows.find((r) => r.nOp >= 0.99 && r.bOp >= 0.99);
  const leavingRows = exitRows.filter((r) => r.zones && !r.active);
  const mono = (arr, k) => arr.every((r, i) => i === 0 || r[k] >= arr[i - 1][k] - 1e-3);
  R.M = {
    how, before, inRub, tlDuring, navDuring, stillActiveAfterHover: stillActive,
    enter: { flagDelayMs: firstHid ? firstHid.t - tEnter : null, opAt120: at(firstHid.t + 120), opAt300: at(firstHid.t + 300), hiddenBy: rows.find((r) => r.t > firstHid.t && r.nVis === 'hidden' && r.bVis === 'hidden')?.t - firstHid.t },
    exit: { leavingMs: zonesOffAt ? zonesOffAt.t - tExit : null, maxOpWhileLeaving: Math.max(0, ...leavingRows.map((r) => Math.max(r.nOp, r.bOp))), leavingFrames: leavingRows.length,
      backAttr: zonesOffAt?.hud, visibleImmediately: fadeRows[1]?.nVis, opAt200: fadeRows.find((r) => r.t >= zonesOffAt.t + 200), fullMs: fullAt ? fullAt.t - zonesOffAt.t : null, monotonic: mono(fadeRows, 'nOp') && mono(fadeRows, 'bOp'),
      attrAfter: rows[rows.length - 1].hud, final: rows[rows.length - 1] },
    after: { hits: await hits(), others: await others(), arrows: await E(() => ['prev', 'next'].map((d) => { const b = document.querySelector(`.cin-nv--${d}`); return { near: b.dataset.near, sticky: b.classList.contains('is-sticky'), hand: b.style.getPropertyValue('--hand') || '' }; })) },
  };
  // chuột lại dùng được dòng thời gian sau khi hiện lại
  await page.mouse.move(tk.x - 60, tk.y, { steps: 4 }); await page.mouse.move(tk.x + 10, tk.y, { steps: 4 }); await sleep(300);
  R.M.after.tlHoverWorks = await E(() => { const t = document.querySelector('.cin-tl'); return t.dataset.focus === '1' || t.dataset.pop === '1'; });
  await page.mouse.move(700, 150); await sleep(1500);
}

// ================= Q: vào lại khi camera đang bay về (leaving) + vào lại giữa lúc đang hiện lại
{
  await E(() => window.__vm.cinemaRub.unlock());
  await E(() => window.__vm.cinemaRub.enter('mouse')); await sleep(900);
  await E(() => window.__S.start());
  await page.keyboard.press('Escape'); await sleep(300);
  const midLeaving = await E(() => ({ active: window.__vm.cinemaRub.state().active, zones: document.body.hasAttribute('data-hand-zones-off') }));
  const reenter = await E(() => window.__vm.cinemaRub.enter('mouse'));
  await sleep(1200);
  const rows1 = await E(() => window.__S.stop());
  R.Q1 = { midLeaving, reenter, maxNavOp: Math.max(...rows1.map((r) => r.nOp)), maxBotOp: Math.max(...rows1.map((r) => r.bOp)), everBack: rows1.some((r) => r.hud !== '1'), hudValues: [...new Set(rows1.map((r) => r.hud))], activeEnd: rows1[rows1.length - 1].active };
  // ra, chờ tới lúc đang hiện lại được ~150 ms, vào lại
  await E(() => window.__S.start());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.cinema').dataset.rubhud === 'back', null, { timeout: 6000 });
  await sleep(150);
  const midOp = await E(() => +getComputedStyle(document.querySelector('.cin-nav')).opacity);
  const tRe = await E(() => Math.round(performance.now() - window.__S.t0));
  await E(() => window.__vm.cinemaRub.enter('mouse'));
  await sleep(700);
  const rows2 = await E(() => window.__S.stop());
  const after = rows2.filter((r) => r.t >= tRe);
  R.Q2 = { midOp: +midOp.toFixed(2), afterReenter: after.slice(0, 1).concat(after.filter((_, i) => i % 4 === 0)).map((r) => `${r.t - tRe}:${r.hud}:${r.nOp}`).slice(0, 10), noRise: after.every((r, i) => i === 0 || r.nOp <= after[i - 1].nOp + 1e-3), end: after[after.length - 1] };
  await page.keyboard.press('Escape'); await sleep(3000);
}

// ================= H: tay (đường đi thật của lớp cử chỉ): xoè tay xoa qua lại trên đầu rùa → vào; rê tay qua dòng thời gian / mép; tay rời khung → tự thoát (rảnh 9 s)
{
  await installHand(page, { pose: 'open' });
  // bám đầu rùa (bia focus), rồi xoa qua lại vài nhịp
  await E(() => window.__S.start());
  const t0 = Date.now();
  const entered = (await handRubOpen(page)) === 'rub';
  const tEnter = await E(() => Math.round(performance.now() - window.__S.t0));
  await sleep(800);
  const inRub = { entered, secs: +((Date.now() - t0) / 1000).toFixed(1), hits: await hits(), others: await others(), body: await E(() => ({ zones: document.body.hasAttribute('data-hand-zones-off'), input: document.querySelector('.cinema').dataset.input })) };
  // tay rê xuống dòng thời gian, rồi sang mép phải (mũi tên tới)
  const tk = await center('.cin-tl__track');
  await E((t) => { window.__A.tgt = t; }, tk); await sleep(1500);
  const tl = await E(() => { const t = document.querySelector('.cin-tl'); return { focus: t.dataset.focus ?? null, pop: t.dataset.pop ?? null, sticky: t.classList.contains('is-sticky'), handSticky: document.body.dataset.handSticky ?? null, palm: window.__A.cur }; });
  await E(() => { window.__A.tgt = { x: innerWidth - 60, y: innerHeight * 0.45 }; }); await sleep(1500);
  const nav = await E(() => { const b = document.querySelector('.cin-nv--next'); return { near: b.dataset.near, sticky: b.classList.contains('is-sticky'), hand: b.style.getPropertyValue('--hand') || '', handSticky: document.body.dataset.handSticky ?? null, palm: window.__A.cur, stillActive: window.__vm.cinemaRub.state().active }; });
  // tay rời khung → thoát sau IDLE_MS_HAND
  await E(() => { window.__A.tgt = null; window.__A.pose = 'none'; }); // khung vẫn chạy, không còn bàn tay
  const tAway = await E(() => Math.round(performance.now() - window.__S.t0));
  await page.waitForFunction(() => !window.__vm.cinemaRub.state().active, null, { timeout: 15000 }).catch(() => {});
  const tExit = await E(() => Math.round(performance.now() - window.__S.t0));
  await sleep(3000);
  const rows = await E(() => window.__S.stop());
  const firstHid = rows.find((r) => r.hud === '1');
  const exitRows = rows.filter((r) => r.t >= tExit - 50);
  const zonesOffAt = exitRows.find((r) => !r.zones);
  const fadeRows = zonesOffAt ? exitRows.filter((r) => r.t >= zonesOffAt.t) : [];
  const fullAt = fadeRows.find((r) => r.nOp >= 0.99 && r.bOp >= 0.99);
  R.H = { inRub, flagDelayMs: firstHid ? firstHid.t - tEnter : null, opAt300: rows.find((r) => r.t >= (firstHid?.t ?? 0) + 300), tl, nav,
    exit: { idleExitAfterMs: tExit - tAway, why: await E(() => window.__vm.cinemaRub.state().exits?.slice?.(-1)?.[0] ?? null), leavingMs: zonesOffAt ? zonesOffAt.t - tExit : null,
      maxOpWhileLeaving: Math.max(0, ...exitRows.filter((r) => r.zones).map((r) => Math.max(r.nOp, r.bOp))), fullMs: fullAt ? fullAt.t - zonesOffAt.t : null, final: rows[rows.length - 1] } };
  await E(() => { clearInterval(window.__A.id); document.body.classList.remove('gesture-on'); });
}

// ---------------------------------------------------------------------------- kiểm
const M = R.M;
report.section('chuột');
report.check('vào như người dùng: nhấn giữ trên đầu rùa rồi xoa vài nhịp', M.how === 'rub', { how: M.how });
report.check('ngoài chế độ: mũi tên + mốc dòng thời gian nhận con trỏ', M.before.hits.every(Boolean), M.before.hits);
report.check('vào: mờ ra ~250 ms (giữa chừng 0,1–0,5, ẩn hẳn ≤ 320 ms)', M.enter.opAt120.nOp > 0.05 && M.enter.opAt120.nOp < 0.6 && M.enter.hiddenBy <= 320, { at120: M.enter.opAt120.nOp, hiddenBy: M.enter.hiddenBy });
report.check('trong chế độ: không phần tử nào dưới con trỏ ở mũi tên / mốc', M.inRub.hits.every((v) => !v), M.inRub.hits);
report.check('trong chế độ: rê dòng thời gian không mở thẻ, mũi tên không rê / gần / dính', M.tlDuring.pop == null && M.tlDuring.focus !== '1' && !M.navDuring.hover && M.navDuring.near === '0' && !M.navDuring.sticky);
report.check('trong chế độ: nút × + chú thích dùng được; hàng trên / nút i không đổi', M.inRub.others.closeHit && M.inRub.others.rubCap && M.inRub.others.top === M.before.others.top && M.inRub.others.fab === M.before.others.fab, M.inRub.others);
report.check('thoát: camera bay về ~2 s, suốt lúc đó vẫn ẩn (độ mờ 0)', M.exit.leavingMs > 1500 && M.exit.maxOpWhileLeaving === 0, { leaving: M.exit.leavingMs, max: M.exit.maxOpWhileLeaving });
report.check('rồi hiện lại ~400 ms, chỉ tăng, gỡ cờ', M.exit.backAttr === 'back' && M.exit.fullMs <= 480 && M.exit.monotonic && M.exit.attrAfter === '' && M.exit.final.nOp === 1 && M.exit.final.bOp === 1, { full: M.exit.fullMs, mono: M.exit.monotonic, attr: M.exit.attrAfter });
report.check('sau đó: mũi tên về nghỉ, dòng thời gian rê được lại', M.after.hits.every(Boolean) && M.after.arrows.every((a) => a.near === '0' && !a.sticky) && M.after.tlHoverWorks);
report.section('vào lại giữa chừng');
report.check('vào lại lúc camera đang bay về → không lộ ra (độ mờ luôn 0)', R.Q1.reenter && R.Q1.maxNavOp === 0 && R.Q1.maxBotOp === 0 && !R.Q1.everBack, R.Q1);
report.check('vào lại lúc đang hiện lại → mờ ra từ độ đang có, không tăng lại, kết thúc ẩn', R.Q2.noRise && R.Q2.end.nOp === 0 && R.Q2.end.nVis === 'hidden', { mid: R.Q2.midOp, end: R.Q2.end.nOp });
report.section('tay (lớp cử chỉ thật)');
report.check('xoè tay xoa qua lại trên đầu rùa → vào; ẩn mũi tên + dòng thời gian', R.H.inRub.entered && R.H.inRub.hits.every((v) => !v) && R.H.opAt300?.nOp === 0 && R.H.inRub.body.zones, R.H.inRub);
report.check('tay rê qua dòng thời gian / mép phải: không thẻ, không dính, không gần', R.H.tl.focus !== '1' && R.H.tl.pop == null && !R.H.tl.sticky && R.H.nav.near === '0' && !R.H.nav.sticky && R.H.nav.stillActive, { tl: R.H.tl, nav: R.H.nav });
report.check('tay rời khung → tự thoát (rảnh ~9 s), ẩn suốt lúc bay về, rồi hiện lại', R.H.exit.why === 'idle' && R.H.exit.idleExitAfterMs < 11000 && R.H.exit.maxOpWhileLeaving === 0 && R.H.exit.fullMs <= 480 && R.H.exit.final.nOp === 1, R.H.exit);
await close();
process.exit(report.finish(errors));
