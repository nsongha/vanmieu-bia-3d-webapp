// r54 — GIỮ FOCUS SAU KHI XOAY (người dùng: "khi user đang hand drag để xem các góc khác nhau của bia, thả tay hoặc cursor
// trượt ra ngoài rất dễ bị mất focus (đèn tắt, camera reset)"). Tay qua đường đi THẬT của lớp cử chỉ (__vmHand.simulateHand
// live — nhón kéo phát pointerdown / move / up lên canvas như thật); chuột bằng chuột thật của trình duyệt.
//   H1. focus → nhón kéo xoay, con trỏ ra khỏi bia + vùng giữ giữa chừng → thả ngoài bia, nằm yên: focus giữ suốt lúc kéo và
//       ~3 s sau khi thả (camera đứng yên đúng góc vừa xoay — không tự về), rồi rời focus bằng đường về êm ('return')
//   H2. thả ngoài bia rồi quay lại bia trong lúc đếm → giữ tiếp (đếm về 0), vẫn focus sau đó
//   H3. thả rồi tay rời khung hình → rời focus sau ~2 s
//   H4. thả rồi giơ hai ngón (V) NGOÀI bia → rời focus NGAY (body[data-hand-nav] — lớp cử chỉ vẫn báo "đang giơ V"). r72 → r73:
//       V không đổi bia nữa (giữ V TRÊN bia 2 s = mở thông tin đầy đủ — V trên bia giữ focus, xem rich-info G); V ngoài bia
//       vẫn là "rời có chủ ý" như trước
//   H5. mất tay một thoáng giữa lúc kéo (trong cầu nối của lớp cử chỉ) → không rời focus
//   M1. chuột: focus → kéo xoay, thả ngoài bia → giữ ~3 s rồi về êm · M2. Esc lúc đang giữ → rời ngay
//   M3. chuột rê vào / ra KHÔNG xoay → rời ngay như cũ
//   Z. (r74 → r76 — người dùng: zoom in thì ẩn hai tấm như lúc xoay ngang, và mờ ÊM như xoay ngang) focus 1442 (tấm sơn mài),
//      1440×900 + 1920×1080: một nấc lăn chuột → độ hiện giảm qua nhiều khung (không rơi trong một khung); zoom chậm kiểu nhón–
//      đưa tay → giảm đơn điệu, bước ≤ 0,15 / khung, ĐÚNG 0 ở giới hạn và khi đã lấn; không khung nào tấm còn hiện mà ra ngoài
//      khung nhìn hay chồng lên nhãn năm; lúc ẩn nút trơ; lùi ra → hiện lại dần
// node tests/cinema/focus-hold.test.mjs --port 5180   (≈ 2 phút)
import { allowSyntheticPointerCapture, launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('focus-hold');
const SETTINGS = { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false };
const HOOKS = ['cinemaCam', 'cinemaPresence', 'cinemaStelePoint', 'cinemaTxProgress', 'cinemaIdle', '__vmHand.simulateHand'];
const allErrors = [];

/** Ghi vết mỗi khung (rAF): focus, giữ, camera. */
const installTrace = (E) =>
  E(() => {
    const T = (window.__T = { on: null, t0: 0 });
    const rec = () => {
      if (T.on) {
        const c = window.__vm.cinemaCam();
        const p = window.__vm.cinemaPresence();
        T.on.push({ t: Math.round(performance.now() - T.t0), sel: c.sel ? 1 : 0, cnt: p.counting ? 1 : 0, out: p.outMs, gone: p.goneMs, orb: p.orbited ? 1 : 0, f: c.orbitF, tw: c.camTw, off: c.off, pos: c.pos, um: c.userMoved ? 1 : 0, tx: +window.__vm.cinemaTxProgress().toFixed(3), nav: document.body.dataset.handNav ? 1 : 0 });
      }
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
    T.start = () => Object.assign(T, { on: [], t0: performance.now() });
    T.stop = () => { const r = T.on; T.on = null; return r; };
  });
const stepLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
/** Tổng quãng dịch chuyển camera (m). */
const travel = (tr) => tr.slice(1).reduce((s, r, i) => s + stepLen(tr[i].pos, r.pos), 0);
/**
 * Lúc giữ, camera là của người xem: chỉ còn đuôi quán tính của cú kéo (OrbitControls damping — đi TIẾP hướng cũ, tắt dần),
 * không tự về khung: khoảng cách tới khung đích không giảm, và ~0,5 s cuối gần như đứng yên.
 */
const stillHeld = (tr) => {
  const minOffDrop = Math.max(0, ...tr.slice(1).map((r, i) => tr[i].off - r.off));
  const tail = tr.filter((r) => r.t >= tr.at(-1).t - 500);
  const r = { travel: +travel(tr).toFixed(5), tailTravel: +travel(tail).toFixed(6), offDrop: +minOffDrop.toFixed(5), off: [tr[0]?.off, tr.at(-1)?.off] };
  return { ok: tr.length > 30 && minOffDrop < 1e-4 && r.tailTravel < 5e-4, r };
};
/** Đường về êm: bước lớn nhất / trung vị các bước khác 0 (giật = một bước gấp nhiều lần lân cận). */
const smooth = (tr) => {
  const st = tr.slice(1).map((r, i) => stepLen(tr[i].pos, r.pos) / Math.max(1, r.t - tr[i].t));
  let worst = 0;
  for (let i = 2; i < st.length - 2; i++) {
    const nb = Math.max(st[i - 1], st[i + 1], st[i - 2], st[i + 2], 1e-6);
    if (st[i] > 2e-5) worst = Math.max(worst, st[i] / nb);
  }
  return { maxSpeed: +Math.max(0, ...st).toFixed(6), worstRatio: +worst.toFixed(2) };
};

// ======================================================================================= TAY
{
  const { page, close, errors } = await launch({ headed, settings: SETTINGS });
  await openCinema(page, port, { query: '?handCursor=shown', hooks: HOOKS, settleMs: 2500 });
  await allowSyntheticPointerCapture(page);
  const E = (f, a) => page.evaluate(f, a);
  await installTrace(E);
  await E(() => {
    document.body.classList.add('gesture-on');
    const A = (window.__A = { hx: 0.4, hy: 0.55, pose: 'open', tgt: null, cur: null, first: true, engaged: false, plan: null });
    window.addEventListener('hand:frame', (e) => {
      const d = e.detail;
      if (d.detected) A.cur = { x: d.x, y: d.y };
      A.engaged = d.engaged === true;
    });
    A.id = setInterval(() => {
      if (A.plan && A.plan.length) {
        const st = A.plan.shift();
        A.pose = st.pose;
        if (st.dx) A.hx += st.dx;
        if (!A.plan.length) A.plan = null;
      } else if (A.tgt && A.pose === 'open' && A.cur) {
        A.hx = Math.min(0.97, Math.max(0.03, A.hx + ((A.tgt.x - A.cur.x) / innerWidth) * 0.3));
        A.hy = Math.min(0.97, Math.max(0.03, A.hy + ((A.tgt.y - A.cur.y) / innerHeight) * 0.3));
      }
      window.__vmHand.simulateHand([{ pose: A.pose, x: A.hx, y: A.hy, ms: 33 }], { live: true, fresh: A.first });
      A.first = false;
    }, 33);
  });
  await page.waitForFunction(() => window.__A.engaged, null, { timeout: 8000 }).catch(() => {});
  await page.mouse.move(20, 880);
  const planOf = (segs) => {
    const plan = [];
    for (const [pose, ms, dx = 0] of segs) {
      const n = Math.max(1, Math.round(ms / 33));
      for (let i = 0; i < n; i++) plan.push({ pose, dx: dx / n });
    }
    return plan;
  };
  /** Chạy kế hoạch tư thế (tay không bị lái), rồi chờ extraMs. */
  const run = async (segs, extraMs = 0) => {
    const plan = planOf(segs);
    await E((plan) => Object.assign(window.__A, { plan, tgt: null }), plan);
    await sleep(33 * plan.length + extraMs);
  };
  const aimStele = async () => {
    const sp = await E(() => window.__vm.cinemaStelePoint());
    await E((t) => (window.__A.tgt = t), { x: sp.x, y: sp.y });
    const ok = await page.waitForFunction(() => { const c = window.__vm.cinemaCam(); return c.sel && c.orbitF > 0.97; }, null, { timeout: 9000, polling: 100 }).then(() => true, () => false);
    if (!ok) report.info('aimStele: không vào được focus', await E(() => ({ A: { hx: window.__A.hx, hy: window.__A.hy, cur: window.__A.cur, engaged: window.__A.engaged }, cam: window.__vm.cinemaCam().sel, sticky: document.body.dataset.handSticky ?? null })));
    await sleep(400);
    await E(() => (window.__A.tgt = null));
    return sp;
  };
  /** Về rest sạch: tay rời khung + Esc, đợi camera về khung, rồi tay vào lại (khoá tay mới) ở chỗ trống. */
  const toRest = async () => {
    await E(() => Object.assign(window.__A, { tgt: null, plan: null, pose: 'none' }));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => { const c = window.__vm.cinemaCam(); return !c.sel && !c.camTw && c.off < 1e-3 && c.orbitF < 0.01; }, null, { timeout: 12000, polling: 100 }).catch(() => {});
    await E(() => Object.assign(window.__A, { pose: 'open', first: true, hx: 0.4, hy: 0.62, engaged: false }));
    await page.waitForFunction(() => window.__A.engaged, null, { timeout: 8000 }).catch(() => {});
    await sleep(300);
  };
  const DRAG = [['pinch', 250], ['pinch', 900, -0.24]]; // nhón trên bia, kéo sang trái (con trỏ ra khỏi bia + vùng giữ)
  const T = { start: () => E(() => window.__T.start()), stop: () => E(() => window.__T.stop()) };

  // ---- H1
  report.section('H1. tay: kéo xoay ra ngoài bia, thả, nằm yên');
  await aimStele();
  await T.start();
  await run(DRAG);
  const tRel = await E(() => Math.round(performance.now() - window.__T.t0));
  await run([['open', 4800]]);
  const tr1 = await T.stop();
  const drag1 = tr1.filter((r) => r.t < tRel);
  const hold1 = tr1.filter((r) => r.t >= tRel);
  const endAt1 = hold1.find((r) => !r.sel)?.t;
  const outStart1 = hold1.find((r) => r.cnt)?.t;
  // quán tính của OrbitControls (damping 0,06 / khung) tắt trong ~1 s sau khi thả — đó là đà tay của người xem, không phải
  // tự về khung; đo từ 1,2 s sau khi thả
  const before = hold1.filter((r) => r.sel && r.t > tRel + 1200);
  report.info('H1', { release: tRel, countFrom: outStart1, focusOffAt: endAt1, holdMs: endAt1 != null ? endAt1 - tRel : null, userMoved: drag1.at(-1)?.um, orbited: drag1.at(-1)?.orb });
  report.check('kéo xoay thật (camera người dùng cầm) và focus suốt lúc kéo', drag1.length > 20 && drag1.at(-1).um === 1 && drag1.every((r) => r.sel), { frames: drag1.length, offFrames: drag1.filter((r) => !r.sel).length });
  report.check('thả ngoài bia: bắt đầu đếm (con trỏ ở ngoài)', outStart1 != null && outStart1 - tRel < 400, { outStart1, tRel });
  report.check('focus giữ ~3 s sau khi thả, rồi rời (2,8–3,6 s)', endAt1 != null && endAt1 - tRel >= 2800 && endAt1 - tRel <= 3600, { holdMs: endAt1 - tRel });
  const sh1 = stillHeld(before);
  report.check('lúc giữ: camera ở đúng góc vừa xoay (chỉ đuôi đà tay, không tự về khung)', sh1.ok, sh1.r);
  const ret1 = hold1.filter((r) => r.t >= endAt1);
  const sm1 = smooth(ret1);
  report.check('rời focus → đường về êm (camTw "return"), không giật', ret1.some((r) => r.tw === 'return') && sm1.worstRatio < 4, sm1);
  await toRest();

  // ---- H5 (trước H2: trạng thái sạch) — mất tay một thoáng giữa lúc kéo
  report.section('H5. mất tay một thoáng giữa lúc kéo');
  await aimStele();
  await T.start();
  await run([['pinch', 250], ['pinch', 400, -0.1], ['none', 100], ['pinch', 400, -0.1], ['open', 600]]);
  const tr5 = await T.stop();
  report.check('mất tay ≤ 100 ms giữa lúc kéo (trong cầu nối) → focus không rời', tr5.length > 20 && tr5.every((r) => r.sel), { off: tr5.filter((r) => !r.sel).slice(0, 3) });
  await toRest();

  // ---- H2
  report.section('H2. thả ngoài bia rồi quay lại trong lúc đếm');
  const sp2 = await aimStele();
  await T.start();
  await run(DRAG);
  const tRel2 = await E(() => Math.round(performance.now() - window.__T.t0));
  await run([['open', 1500]]);
  await E((t) => (window.__A.tgt = t), await E(() => window.__vm.cinemaStelePoint()));
  await sleep(8500); // quá IDLE_CAM (8 s rảnh → camera tự về khung) tính từ lúc thả
  const tr2 = await T.stop();
  await E(() => (window.__A.tgt = null));
  const h2 = tr2.filter((r) => r.t >= tRel2);
  const maxOut2 = Math.max(...h2.map((r) => r.out));
  const last2 = h2.at(-1);
  report.check('quay lại bia trong 3 s → focus giữ suốt, đếm về 0', h2.every((r) => r.sel) && maxOut2 < 2900 && last2.out === 0 && last2.sel === 1, { maxOut2, last: last2, sp2 });
  const sh2 = stillHeld(h2.filter((r) => r.t > tRel2 + 1200));
  report.check('rê bia sau khi xoay, rảnh > 8 s: camera vẫn ở góc người xem (không tự về khung khi rảnh)', sh2.ok && h2.at(-1).t - tRel2 > 9000, sh2.r);
  await toRest();

  // ---- H3
  report.section('H3. thả rồi tay rời khung hình');
  await aimStele();
  await T.start();
  await run(DRAG);
  const tGone = await E(() => Math.round(performance.now() - window.__T.t0));
  await run([['none', 3600]]);
  const tr3 = await T.stop();
  const h3 = tr3.filter((r) => r.t >= tGone);
  const goneFrom = h3.find((r) => r.gone > 0)?.t;
  const end3 = h3.find((r) => !r.sel)?.t;
  report.info('H3', { handLeft: tGone, goneCountFrom: goneFrom, focusOffAt: end3, afterLeaveMs: end3 != null ? end3 - tGone : null });
  report.check('tay rời khung → rời focus sau ~2 s (1,9–2,6 s, trước ngưỡng 3 s của con trỏ ở ngoài)', end3 != null && end3 - tGone >= 1900 && end3 - tGone <= 2600, { afterLeaveMs: end3 - tGone });
  await toRest();

  // ---- H4
  report.section('H4. thả rồi giơ hai ngón (V) → rời ngay');
  await aimStele();
  const i4 = await E(() => window.__vm.cinemaIdle().index);
  await T.start();
  await run(DRAG);
  await run([['open', 900]]);
  const tV = await E(() => Math.round(performance.now() - window.__T.t0));
  await run([['v', 1200]], 200);
  const tr4 = await T.stop();
  const h4 = tr4.filter((r) => r.t >= tV);
  const navOn = h4.find((r) => r.nav)?.t;
  const off4 = h4.find((r) => !r.sel)?.t;
  const tx4 = h4.filter((r) => r.tx >= 0);
  const at60 = tx4.find((r) => r.tx >= 0.6) ?? tx4.at(-1);
  const heldBeforeV = tr4.filter((r) => r.t < tV).every((r) => r.sel);
  report.info('H4', { vAt: tV, navModeAt: navOn, focusOffAt: off4, txFrames: tx4.length, fAt60: at60?.f, fEnd: tx4.at(-1)?.f });
  report.check('trước V: focus còn giữ (thả ngoài bia < 3 s)', heldBeforeV, null);
  report.check('vào chế độ hai ngón → rời focus ngay (≤ 1 khung ~50 ms)', navOn != null && off4 != null && off4 - navOn <= 50, { navOn, off4 });
  report.check('giữ V ngoài bia: không đổi bia (r72: V không còn đổi bia), không đèn / thông tin', (await E(() => window.__vm.cinemaIdle().index)) === i4 && !h4.slice(-10).some((r) => r.sel), null);

  await E(() => clearInterval(window.__A.id));
  allErrors.push(...errors);
  await close();
}

// ======================================================================================= CHUỘT
{
  const { page, close, errors } = await launch({ headed, settings: SETTINGS });
  await openCinema(page, port, { hooks: HOOKS, settleMs: 2500 });
  const E = (f, a) => page.evaluate(f, a);
  await installTrace(E);
  const T = { start: () => E(() => window.__T.start()), stop: () => E(() => window.__T.stop()) };
  const hover = async () => {
    await page.mouse.move(40, 300);
    await sleep(200);
    const sp = await E(() => window.__vm.cinemaStelePoint());
    await page.mouse.move(sp.x, sp.y, { steps: 6 });
    await page.waitForFunction(() => { const c = window.__vm.cinemaCam(); return c.sel && c.orbitF > 0.97; }, null, { timeout: 8000, polling: 100 }).catch(() => {});
    await sleep(300);
    return E(() => window.__vm.cinemaStelePoint());
  };
  const toRest = async () => {
    await page.mouse.move(30, 250, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => { const c = window.__vm.cinemaCam(); return !c.sel && !c.camTw && c.off < 1e-3 && c.orbitF < 0.01; }, null, { timeout: 12000, polling: 100 }).catch(() => {});
    await sleep(300);
  };

  // ---- M3 trước: rê vào / ra không xoay → rời ngay như cũ
  report.section('M3. chuột rê vào / ra, không xoay');
  const sp3 = await hover();
  await T.start();
  const tOut3 = await E(() => Math.round(performance.now() - window.__T.t0));
  await page.mouse.move(60, sp3.y, { steps: 2 });
  await sleep(600);
  const tr3 = await T.stop();
  const off3 = tr3.find((r) => !r.sel)?.t;
  report.check('rời bia (không xoay) → rời focus ngay (< 120 ms), không đếm', off3 != null && off3 - tOut3 < 120 && !tr3.some((r) => r.cnt), { afterMs: off3 - tOut3 });
  await toRest();

  // ---- M1
  report.section('M1. chuột kéo xoay, thả ngoài bia');
  const sp = await hover();
  await T.start();
  await page.mouse.down();
  await page.mouse.move(sp.x - 420, sp.y + 40, { steps: 18 });
  await page.mouse.up();
  const tRel = await E(() => Math.round(performance.now() - window.__T.t0));
  await sleep(4600);
  const tr1 = await T.stop();
  const drag1 = tr1.filter((r) => r.t < tRel);
  const h1 = tr1.filter((r) => r.t >= tRel);
  const end1 = h1.find((r) => !r.sel)?.t;
  const stay = h1.filter((r) => r.sel && r.t > tRel + 1200); // sau đà quán tính (~1 s)
  report.info('M1', { release: tRel, focusOffAt: end1, holdMs: end1 - tRel, userMoved: drag1.at(-1)?.um });
  report.check('kéo xoay bằng chuột: focus suốt lúc kéo', drag1.length > 5 && drag1.every((r) => r.sel) && drag1.at(-1).um === 1, { frames: drag1.length });
  report.check('thả ngoài bia → giữ ~3 s (2,8–3,6 s) rồi rời', end1 != null && end1 - tRel >= 2800 && end1 - tRel <= 3600, { holdMs: end1 - tRel });
  const shM = stillHeld(stay);
  report.check('lúc giữ: camera ở đúng góc vừa xoay (chỉ đuôi đà tay, không tự về khung)', shM.ok, shM.r);
  const ret = h1.filter((r) => r.t >= end1);
  const sm = smooth(ret);
  report.check('rời focus → đường về êm ("return"), không giật', ret.some((r) => r.tw === 'return') && sm.worstRatio < 4, sm);
  await toRest();

  // ---- M2
  report.section('M2. chuột: Esc lúc đang giữ');
  const spb = await hover();
  await page.mouse.down();
  await page.mouse.move(spb.x - 420, spb.y + 40, { steps: 18 });
  await page.mouse.up();
  await sleep(1000);
  const pre2 = await E(() => window.__vm.cinemaPresence());
  await T.start();
  const tEsc = await E(() => Math.round(performance.now() - window.__T.t0));
  await page.keyboard.press('Escape');
  await sleep(400);
  const tr2 = await T.stop();
  const off2 = tr2.find((r) => !r.sel)?.t;
  report.check('đang giữ (đếm) → Esc → rời ngay (< 100 ms)', pre2.held && pre2.counting && off2 != null && off2 - tEsc < 100, { pre2, afterMs: off2 - tEsc });

  allErrors.push(...errors);
  await close();
}

// ======================================================================================= Z. zoom → tấm sơn mài mờ dần (r74 → r76)
for (const [W, H] of [[1440, 900], [1920, 1080]]) {
  const { page, close, errors } = await launch({ headed, width: W, height: H, settings: { ...SETTINGS, cinemaInfo: 'screens', cinemaInfoRich: true } });
  await openCinema(page, port, { id: 'bia-1442', hooks: ['cinemaStelePoint', 'cinemaPresence', 'cinemaRich', 'cinemaCam'], settleMs: 3000 });
  const E = (f, a) => page.evaluate(f, a);
  report.section(`Z. zoom vào lúc focus → hai tấm sơn mài mờ dần (${W}×${H})`);
  const sp = await E(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(sp.x, sp.y, { steps: 5 });
  await sleep(2800);
  // vết mỗi khung: độ hiện hai tấm + độ lấn (px) + hình chiếu (px) + nhãn năm hai bên
  await E(() => {
    const Z = (window.__Z = { on: true, rows: [] });
    const rect = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
    const rec = () => {
      if (!Z.on) return;
      const d = window.__vm.cinemaRich.state().dbg?.rich;
      const leaves = [...document.querySelectorAll('.lq-leaf')].map(rect);
      const labels = [...document.querySelectorAll('.cin-nv__label')].map(rect).filter((r) => r[2] - r[0] > 2);
      Z.rows.push({ a: d?.leaves?.map((l) => l.alpha) ?? [], z: d?.zoom ?? null, leaves, labels, live: document.querySelector('.lq-leaf--r')?.classList.contains('is-live') ?? false, dist: window.__vm.cinemaCam().dist, sel: window.__vm.cinemaPresence().shown });
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  await sleep(150);
  const take = () => E(() => { const r = window.__Z.rows; window.__Z.rows = []; return r; });
  const snap = () => E(() => { const r = window.__Z.rows.at(-1); return { a: r.a, z: r.z, dist: r.dist, sel: r.sel }; });
  const Z0 = await snap();
  await take();
  // (1) MỘT nấc lăn chuột (thật) — dốc mờ qua nhiều khung, không rơi trong một khung
  await page.mouse.wheel(0, -120);
  await sleep(700);
  const notch = await take();
  await page.mouse.wheel(0, 120);
  await sleep(900);
  await take();
  // (2) zoom chậm như nhón–đưa tay (wheel tổng hợp của lớp cử chỉ, 30 / s) tới quá giới hạn rồi lùi ra
  const pinch = (dy, n) => E(async ([dy, n]) => {
    const c = document.querySelector('.cin-stage canvas') || document.querySelector('canvas');
    for (let i = 0; i < n; i++) {
      c.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight / 2 }));
      await new Promise((r) => setTimeout(r, 33));
    }
  }, [dy, n]);
  await pinch(-8, 75);
  await sleep(400);
  const pin = await take();
  // lúc ẩn: nút trên tấm trơ
  const inert = await E(() => {
    const b = document.querySelector('.lq-btn--read');
    const live = b?.closest('.lq-leaf')?.classList.contains('is-live');
    return { live: !!live, sticky: b?.hasAttribute('data-hand-sticky') ?? false, tab: b?.tabIndex ?? null };
  });
  await pinch(8, 75);
  await sleep(900);
  const back = await take();
  const Zend = await snap();
  await E(() => (window.__Z.on = false));
  const inter = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const all = [...notch, ...pin, ...back];
  const bad = all.filter((r) => r.a.some((a) => a >= 0.3) && r.leaves.some((l) => l[0] < -1 || l[1] < -1 || l[2] > W + 1 || l[3] > H + 1 || r.labels.some((lb) => inter(l, lb))));
  const alpha = (r) => r.a[0] ?? 0;
  const steps = (rows) => rows.slice(1).map((r, i) => alpha(r) - alpha(rows[i]));
  // nấc lăn: số khung độ hiện đổi, bước lớn nhất
  const nSteps = steps(notch);
  const nChanging = nSteps.filter((d) => Math.abs(d) > 0.002).length;
  const nMax = Math.max(0, ...nSteps.map(Math.abs));
  const nDrop = alpha(notch[0]) - Math.min(...notch.map(alpha));
  // zoom chậm: giảm đơn điệu, bước ≤ 0,15 / khung; 0 đúng ở giới hạn và khi đã lấn
  const pSteps = steps(pin);
  const pRise = Math.max(0, ...pSteps);
  const pMaxDrop = -Math.min(0, ...pSteps);
  const beyond = pin.filter((r) => (r.z?.over ?? -1) >= 0);
  const beyondVisible = beyond.filter((r) => r.a.some((a) => a > 0)).length;
  const bSteps = steps(back);
  report.check('khung focus mặc định: hai tấm hiện hẳn (độ hiện theo zoom = 1)', Z0.sel && Z0.a.every((a) => a > 0.98) && Z0.z?.f === 1, Z0);
  report.check('MỘT nấc lăn chuột: độ hiện giảm dần qua nhiều khung (≥ 5 khung đổi, bước lớn nhất ≤ 0,35), không rơi trong một khung', nDrop > 0.05 && nChanging >= 5 && nMax <= 0.35, { drop: +nDrop.toFixed(3), changing: nChanging, maxStep: +nMax.toFixed(3), trace: notch.slice(0, 18).map((r) => [+alpha(r).toFixed(3), r.z?.over]) });
  report.check('zoom chậm (nhón–đưa tay): độ hiện giảm đơn điệu, bước ≤ 0,15 / khung, về tới 0', pRise <= 0.002 && pMaxDrop <= 0.15 && alpha(pin.at(-1)) === 0, { rise: +pRise.toFixed(4), maxDrop: +pMaxDrop.toFixed(3), end: alpha(pin.at(-1)), frames: pin.length, ramp: pin[0]?.z?.ramp });
  report.check('tại giới hạn và khi đã lấn: độ hiện ĐÚNG 0 (mọi khung)', beyond.length > 10 && beyondVisible === 0, { beyond: beyond.length, visible: beyondVisible });
  report.check('không khung nào tấm còn hiện (≥ 0,3) mà ra ngoài khung nhìn hoặc chồng lên nhãn năm', all.length > 150 && bad.length === 0, { frames: all.length, bad: bad.length, first: bad[0] ?? null });
  report.check('lúc ẩn: nút trên tấm trơ (không is-live, không vùng dính tay, không tab)', !inert.live && !inert.sticky && inert.tab === -1, inert);
  report.check('lùi ra: độ hiện tăng dần (đơn điệu, bước ≤ 0,15) về lại khung focus → hai tấm hiện lại', Math.min(0, ...bSteps) >= -0.002 && Math.max(0, ...bSteps) <= 0.15 && Zend.sel && Zend.a.every((a) => a > 0.95), { maxRise: +Math.max(0, ...bSteps).toFixed(3), end: Zend });
  allErrors.push(...errors);
  await close();
}

process.exit(report.finish(allErrors));
