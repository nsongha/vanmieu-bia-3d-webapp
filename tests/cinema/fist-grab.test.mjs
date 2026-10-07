// r58 → r65 — NẮM TAY KÉO BIA (settings.fistGrab, độc lập với kéo bia hai ngón), lái bằng sự kiện TỔNG HỢP: 'hand:frame'
// (tay xoè rê lên bia → focus) + 'hand:vdrag' kind 'fist' (hợp đồng với lớp cử chỉ: start = xoè → nắm đã xác nhận, kèm vòng con
// trỏ cursorX / cursorY / cursorR / cursorShown — r59g; end = mở tay).
//   A. nắm tay khi KHÔNG focus → không cầm
//   B. đang focus → nắm tay: cầm — focus tắt dần (thông tin + đèn trên), dáng cầm (đèn dưới, khay 0,975 — r64: dừng hẳn ≤ 0,4 s); camera đứng yên đúng
//      chỗ đang nhìn; body[data-stele-focus="1"] suốt lúc cầm. VÒNG CẦM 3D — r65: KHÔNG biến hình từ con trỏ: từ khung đầu đã
//      nằm ngang trên sàn ở tâm khay, không bao giờ cao hơn sàn, hiện ra mờ → rõ + nở nhẹ 0,92 → 1 (≤ 0,35 s); r62:
//      body[data-stele-grab="fist"] từ lúc cầm tới lúc nhận / thả
//   C. kéo qua ngưỡng → nhận (+1); camera đi từ chỗ đang nhìn về khung bia mới, không nhảy; r59: vòng theo khay (kéo + rời đi),
//      cặp chevron phía kéo sáng / phía kia mờ; r60: hai nút ‹ › KHÔNG ẩn — bia bắt đầu đi → body[data-hand-fistnav="hold"] (vùng
//      dính của hai nút nhường, không sáng theo tay), vẫn giữ sau khi nhận, thôi khi tay về bia
//   r60 → r61: chevron NẰM TRONG MẶT PHẲNG VÒNG, vòng cố định trên SÀN (r61 bỏ cài đặt độ cao)
//   D. cầm lại phải focus lại · cầm rồi thả không kéo → hai nút KHÔNG ẩn · focus → cầm → mở tay sớm → lò xo về, vòng mờ tắt,
//      camera trôi về khung êm
//   E. (r70) nắm tay trên đầu rùa → cầm như thường (xoa không còn nhận nắm tay), không vào xoa · F. tắt "Nắm tay kéo bia" → không cầm
//   G. thôi giữ hai nút (dự phòng): tay rời khung ~3 s · chuột · phím
//   K. (r62) CHỜ HOVER SAU KHI KÉO: nhận xong, tay về trên bia mới → hover (thông tin, đèn, camera chính diện) chờ
//      settings.grabHoverDelay (mặc định 2 s); trong lúc chờ body[data-stele-focus="1"] ("sẵn sàng cầm") — nắm tay cầm được
//      ngay, kéo liên tục; đủ giờ → focus thường; rời bia → thôi chờ; cài đặt 0,5 s / 0 (không chờ)
//   (r72: bỏ H — kéo bia hai ngón đã bỏ; giữ hai ngón trên bia 2 s nay mở thông tin đầy đủ — xem rich-info)
//   J. LỚP CỬ CHỈ THẬT (__vmHand.simulateHand): đang giữ → tay xoè đi qua mũi tên không bị hút; tay về bia → lại hút như thường
//   L. (r67) body[data-hand-over="stele"]: con trỏ tay trên bia / trên bục → có; nền trống → gỡ sau trễ ngắn; mất tay → gỡ ngay
//   I. giảm chuyển động: vòng chỉ mờ → rõ (không nở)
// FIST_SHOTS=<thư mục> → ảnh: vòng đang hiện ra, vòng lúc cầm, giữa lúc kéo (chevron phía kéo sáng).
// node tests/cinema/fist-grab.test.mjs --port 5180   (≈ 3 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('fist-grab');
const shots = process.env.FIST_SHOTS;
const SETTINGS = { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false };
const HOOKS = ['cinemaVdrag', 'cinemaCam', 'cinemaIdle', 'cinemaTxProgress', 'cinemaGrabProbe', 'cinemaStelePoint', 'cinemaGrabHover', 'cinemaRub', 'settings'];
const allErrors = [];
const step = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** Tay tổng hợp trong trang: hand:frame mỗi 33 ms ở (hx, hy) px; nắm tay: hand:vdrag kind 'fist' (+ vòng con trỏ lúc start). */
const install = (E) =>
  E(() => {
    document.body.classList.add('gesture-on');
    const H = (window.__H = { hx: 80, hy: 160, pose: 'open', on: true, trace: null, t0: 0, fx0: 0 });
    H.id = setInterval(() => {
      if (!H.on) return;
      window.dispatchEvent(new CustomEvent('hand:frame', { detail: { x: H.hx, y: H.hy, detected: true, engaged: true, hover: H.pose === 'open', pose: H.pose, fistGrab: true } }));
      if (H.pose === 'fist' && H.fistOn) {
        const x = H.hx / innerWidth;
        window.dispatchEvent(new CustomEvent('hand:vdrag', { detail: { kind: 'fist', phase: 'move', x, dx: x - H.fx0, vx: H.vx ?? 0, t: performance.now() } }));
      }
    }, 33);
    H.fist = (on, cursor = true) => {
      const x = H.hx / innerWidth;
      if (on) {
        H.pose = 'fist';
        H.fistOn = true;
        H.fx0 = x;
        const c = cursor ? { cursorX: H.hx, cursorY: H.hy, cursorR: 18, cursorShown: true } : {};
        window.dispatchEvent(new CustomEvent('hand:vdrag', { detail: { kind: 'fist', phase: 'start', x, dx: 0, vx: 0, t: performance.now(), ...c } }));
      } else {
        H.fistOn = false;
        window.dispatchEvent(new CustomEvent('hand:vdrag', { detail: { kind: 'fist', phase: 'end', x, dx: x - H.fx0, vx: 0, t: performance.now() } }));
        H.pose = 'open';
      }
    };
    H.leave = () => {
      H.on = false;
      window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } }));
    };
    H.move = (dxPx, ms) =>
      new Promise((res) => {
        const n = Math.max(1, Math.round(ms / 33));
        let i = 0;
        H.vx = dxPx / innerWidth / (ms / 1000);
        const id = setInterval(() => {
          H.hx += dxPx / n;
          if (++i >= n) {
            clearInterval(id);
            H.vx = 0;
            res();
          }
        }, 33);
      });
    const host = document.querySelector('.cinema');
    const nav = document.querySelector('.cin-nav');
    const rec = () => {
      if (H.trace) {
        const c = window.__vm.cinemaCam();
        const g = window.__vm.cinemaGrabProbe();
        const v = window.__vm.cinemaVdrag.debug;
        const gh = window.__vm.cinemaGrabHover();
        H.trace.push({
          t: Math.round(performance.now() - H.t0), shown: window.__vm.cinemaIdle().shown ? 1 : 0, sel: c.sel ? 1 : 0, f: c.orbitF, pos: c.pos, off: c.off, tw: c.camTw,
          sc: g.scales, ht: g.heldTray, heldX: g.heldX, ring: g.rings.map((x) => ({ a: x.alpha, k: x.inK, s: x.scale, y: x.y, ny: x.ny, px: x.pos[0], pz: x.pos[2], l: x.left, r: x.right, wx: x.wx })), rpx: g.ringPx,
          gb: v.grab.bottom, gt: v.grab.top, grabbed: v.grabbed ? 1 : 0, kind: v.kind, mode: v.scrub?.mode ?? null, idx: window.__vm.cinemaIdle().index,
          flag: document.body.dataset.steleFocus === '1' ? 1 : 0, hid: document.body.dataset.handFistnav === 'hold' ? 1 : 0, navOp: +getComputedStyle(nav).opacity, navAttr: host.dataset.fistNav ?? null,
          sg: document.body.dataset.steleGrab ?? null, gh: gh.phase, gr: gh.grabReady ? 1 : 0, hx: Math.round(H.hx),
        });
      }
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
    H.start = () => Object.assign(H, { trace: [], t0: performance.now() });
    H.stop = () => { const t = H.trace; H.trace = null; return t; };
    H.now = () => Math.round(performance.now() - H.t0);
  });

const { page, close, errors } = await launch({ headed, width: 1440, height: 900, settings: SETTINGS });
await openCinema(page, port, { hooks: HOOKS, settleMs: 3000 });
const E = (f, a) => page.evaluate(f, a);
await install(E);
const dbg = () => E(() => window.__vm.cinemaVdrag.debug);
const lastLog = () => E(() => window.__vm.cinemaVdrag.log.at(-1));
const idx = () => E(() => window.__vm.cinemaIdle().index);
/** r60: đang giữ hai nút ‹ › (không hút tay) — body[data-hand-fistnav="hold"] */
const navHidden = () => E(() => document.body.dataset.handFistnav === 'hold');
const onStele = async () => {
  await E(() => (window.__H.on = true));
  const sp = await E(() => window.__vm.cinemaStelePoint());
  await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y, pose: 'open' }), sp);
  await page.waitForFunction(() => { const c = window.__vm.cinemaCam(); return c.sel && c.orbitF > 0.97; }, null, { timeout: 8000, polling: 50 }).catch(() => {});
  await sleep(250);
};
const offStele = async () => {
  await E(() => Object.assign(window.__H, { on: true, hx: 80, hy: 160, pose: 'open' }));
  await page.waitForFunction(() => !window.__vm.cinemaCam().sel && window.__vm.cinemaCam().orbitF < 0.01 && !window.__vm.cinemaCam().camTw, null, { timeout: 8000, polling: 50 }).catch(() => {});
  await sleep(200);
};
const settled = () => page.waitForFunction(() => { const g = window.__vm.cinemaGrabProbe(); return window.__vm.cinemaTxProgress() < 0 && g.rings.every((r) => !r.visible) && g.scales.every((v) => v === 1); }, null, { timeout: 8000, polling: 50 }).catch(() => {});

// ---- A
report.section('A. nắm tay khi không focus');
{
  await offStele();
  await E(() => window.__H.fist(true));
  await sleep(400);
  const d = await dbg();
  const l = await lastLog();
  await E(() => window.__H.fist(false));
  report.check('không focus → nắm tay không cầm (bỏ qua: no-focus), không vòng', !d.grabbed && d.grab.u === 0 && l?.ev === 'fist-ignored' && l.why === 'no-focus' && d.grab.rings.every((r) => !r.visible), { grabbed: d.grabbed, log: l });
}

// ---- B + C
report.section('B. đang focus → cầm, vòng cầm hiện tại chỗ · C. kéo qua ngưỡng → nhận, hai nút ‹ › giữ');
{
  await onStele();
  const i0 = await idx();
  await E(() => window.__H.start());
  await sleep(100);
  // con trỏ CAO trên thân bia (đúng tình huống người dùng r65) — vòng vẫn phải hiện ở sàn
  await E(() => (window.__H.hy -= 120));
  await sleep(120);
  const tF = await E(() => { window.__H.fist(true); return window.__H.now(); });
  if (shots) {
    await sleep(90);
    await page.screenshot({ path: `${shots}/fist-ring-in.png` });
  }
  await sleep(900);
  if (shots) await page.screenshot({ path: `${shots}/fist-ring-grab.png` });
  const hold = await E(() => window.__H.trace.slice());
  const g0 = hold.findIndex((r) => r.grabbed);
  const pre = hold[Math.max(0, g0 - 1)];
  const G = hold.slice(g0);
  const camMove = Math.max(...G.map((r) => step(pre.pos, r.pos)));
  const endHold = G.at(-1);
  const ht = endHold.ht;
  const vis = G.filter((r) => r.ring[ht].a > 0.003);
  const inDone = vis.find((r) => r.ring[ht].a >= 0.99 && r.ring[ht].s === 1);
  report.check('đang focus → nắm tay: cầm ngay (khung vẽ kế tiếp, ≤ 40 ms)', g0 >= 0 && hold[g0].t - tF <= 40, { afterMs: g0 >= 0 ? hold[g0].t - tF : null });
  report.check('cầm → focus tắt dần (thông tin ẩn, đèn trên tắt); đèn dưới sáng, khay 0,975', endHold.shown === 0 && endHold.sel === 0 && endHold.gt < 0.02 && endHold.gb > 0.3 && Math.abs(endHold.sc[ht] - 0.975) < 0.003, endHold);
  // r64: lò xo cỡ khay chốt hướng theo lần đổi đích → DỪNG hẳn ở đúng 0,975 nhanh (trước: nảy quá rồi bò về ~1,2 s — bóng đổ +
  // gương vẽ lại suốt lúc cầm)
  const scSettle = G.findIndex((r, i) => G.slice(i).every((x) => x.sc[ht] === 0.975));
  report.check('r64: khay dừng cỡ ĐÚNG 0,975 trong ≤ 0,4 s sau khi cầm (không bò mãi)', scSettle >= 0 && G[scSettle].t - G[0].t <= 400, { settleMs: scSettle >= 0 ? G[scSettle].t - G[0].t : null });
  // r65 (người dùng: "chưa bỏ transition từ cursor sang vòng 3D … vẫn thấy 1 vòng tròn lao nhanh xuống sàn"): không biến hình
  report.check('r65: vòng KHÔNG đi từ con trỏ — từ khung đầu tiên đã nằm ngang trên sàn ở tâm khay (y < 1 cm, không lúc nào cao hơn), cỡ gần đủ (≥ 0,9) và rộng quanh bục (bán kính màn hình > 150 px)', vis.length > 5 && vis.every((r) => r.ring[ht].y >= 0 && r.ring[ht].y < 0.01 && r.ring[ht].ny >= 0.999 && Math.abs(r.ring[ht].px) < 1e-4 && Math.abs(r.ring[ht].pz) < 1e-4 && r.ring[ht].s >= 0.9) && vis[0].rpx.r > 150, { first: vis[0]?.ring[ht], firstPx: vis[0]?.rpx });
  const sSeq = vis.map((r) => r.ring[ht].s);
  report.check('r65: hiện ra mờ → rõ + nở nhẹ (0,92 → 1, không giảm) xong trong ≤ 0,35 s sau khi cầm', !!inDone && inDone.t - tF <= 350 && vis[0].ring[ht].a < 0.6 && vis[0].ring[ht].s < 0.99 && sSeq.every((v, i) => i === 0 || v >= sSeq[i - 1] - 1e-4), { inMs: inDone ? inDone.t - tF : null, first: vis[0]?.ring[ht] });
  report.check('r62: body[data-stele-grab="fist"] từ lúc cầm (cùng khung), suốt lúc cầm', hold[g0].sg === 'fist' && G.every((r) => r.sg === 'fist') && hold.slice(0, g0).every((r) => r.sg === null), null);
  report.check('r62: không còn mũi tên sàn (probe không có arrows)', !('arrows' in (await E(() => window.__vm.cinemaGrabProbe()))), null);
  report.check('cầm → camera đứng yên đúng chỗ đang nhìn (lệch < 1 mm)', camMove < 1e-3 && G.every((r) => !r.tw), { camMove: +camMove.toFixed(5) });
  report.check('body[data-stele-focus="1"] liền mạch từ lúc focus qua lúc cầm', hold.slice(0, g0 + 1).every((r) => r.flag) && G.every((r) => r.flag), null);
  report.check('cầm mà chưa kéo: chưa giữ hai nút ‹ ›', G.every((r) => !r.hid), null);
  const flat = endHold.ring[ht];
  const st1 = await E(() => { const g = window.__vm.cinemaGrabProbe(); return g.rings[g.heldTray]; });
  report.check('vòng nằm ngang (pháp tuyến thẳng đứng) — chevron vẽ TRONG mặt phẳng vòng, ở ±72°', st1.ny >= 0.999 && st1.chevDeg === 72, { ny: st1.ny, chevDeg: st1.chevDeg });
  report.check('vòng nằm trên SÀN (r61: cố định — không còn cài đặt độ cao)', st1.y >= 0 && st1.y < 0.01 && flat.a >= 0.99 && endHold.rpx.r > 200, { y: st1.y, a: flat.a, r: endHold.rpx.r });
  // kéo trái: 0,05 W (ảnh giữa lúc kéo), rồi qua ngưỡng
  const tMove = await E(() => window.__H.now());
  await E(() => window.__H.move(-0.05 * innerWidth, 250));
  await sleep(300);
  const midDrag = await E(() => { const g = window.__vm.cinemaGrabProbe(); return { ring: g.rings[g.heldTray], heldX: g.heldX, hold: document.body.dataset.handFistnav, op: +getComputedStyle(document.querySelector('.cin-nav')).opacity, near: [...document.querySelectorAll('.cin-nv')].map((b) => b.dataset.near) }; });
  if (shots) await page.screenshot({ path: `${shots}/fist-ring-mid-drag.png` });
  await E(() => window.__H.move(-0.09 * innerWidth, 200));
  await page.waitForFunction(() => window.__vm.cinemaTxProgress() < 0 && !window.__vm.cinemaVdrag.debug.scrub, null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  const d1 = await dbg();
  const hidAfterCommit = await navHidden();
  await E(() => window.__H.fist(false));
  await sleep(500);
  const hidAfterOpen = await navHidden();
  const tr = await E(() => window.__H.trace.slice());
  const i1 = await idx();
  const C = tr.slice(g0);
  const steps = C.slice(1).map((r, i) => step(C[i].pos, r.pos));
  const cm = C.filter((r) => r.mode === 'commit');
  const drag = C.filter((r) => r.mode === 'drag');
  const hidAt = C.find((r) => r.hid)?.t;
  report.check('kéo trái qua ngưỡng → nhận: bia sau (+1)', i1 === (i0 + 1) % 82 && cm.length > 0, { i0, i1 });
  report.check('camera: từ chỗ đang nhìn về khung bia mới — không nhảy (bước mỗi khung ≤ 25 mm)', Math.max(...steps) <= 0.025, { maxStep: +Math.max(...steps).toFixed(4) });
  report.check('vòng cầm đi theo khay lúc kéo (vị trí nhóm vòng = khay đang cầm)', drag.length > 5 && drag.every((r) => Math.abs(r.ring[r.ht].wx - r.heldX) < 1e-3) && Math.max(...drag.map((r) => Math.abs(r.heldX))) > 0.02, { n: drag.length });
  report.check('kéo trái: cặp chevron trái sáng hẳn (≥ 0,95), phải mờ (~0,3)', midDrag.ring.left >= 0.95 && Math.abs(midDrag.ring.right - 0.3) <= 0.05, midDrag.ring);
  report.check('đã nhận: vòng ở lại khay cũ rời đi (hiện), bia mới không có vòng; lướt xong → tắt', cm.every((r) => r.ring[r.ht].a >= 0.99 && r.ring[1 - r.ht].a === 0) && tr.at(-1).ring.every((x) => x.a === 0), null);
  report.check('r62: nhận → gỡ body[data-stele-grab] (lượt cầm hết hiệu lực) ngay khung nhận', cm.length > 0 && cm.every((r) => r.sg === null), { sg: cm.slice(0, 3).map((r) => r.sg) });
  report.check('bia bắt đầu đi → giữ hai nút ‹ › (body[data-hand-fistnav="hold"]) nhưng vẫn HIỆN (không ẩn, không mờ)', hidAt != null && hidAt - tMove < 250 && midDrag.hold === 'hold' && midDrag.op === 1 && C.every((r) => r.navOp === 1 && r.navAttr === null), { holdAfterMs: hidAt != null ? hidAt - tMove : null, op: midDrag.op });
  report.check('đang giữ: mũi tên không sáng dần theo tay (near 0)', midDrag.near.every((v) => v === '0'), midDrag.near);
  report.check('nhận xong, còn nắm / đã mở tay nhưng tay chưa về bia: vẫn giữ', hidAfterCommit && hidAfterOpen && !d1.grabbed, { hidAfterCommit, hidAfterOpen });
  // tay về bia mới → hiện lại
  const sp = await E(() => window.__vm.cinemaStelePoint());
  await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y }), sp);
  await sleep(300);
  const back = await navHidden();
  await E(() => window.__H.stop());
  report.check('tay quay về bia → thôi giữ hai nút ‹ ›', !back, { hold: back });
}

// ---- D
report.section('D. cầm lại phải focus lại · cầm không kéo · mở tay sớm → lò xo về');
{
  await offStele();
  // r62: C vừa đưa tay về bia mới lúc đang chờ hover ("sẵn sàng cầm") — rời bia còn sẵn sàng 250 ms + ân hạn focus 600 ms
  await sleep(1000);
  await E(() => window.__H.fist(true));
  await sleep(300);
  const d = await dbg();
  await E(() => window.__H.fist(false));
  report.check('bia mới chưa focus → nắm tay không cầm', !d.grabbed, { grabbed: d.grabbed });
  // cầm rồi thả, không kéo → hai nút không ẩn
  await onStele();
  await E(() => window.__H.start());
  await E(() => window.__H.fist(true));
  await sleep(700);
  await E(() => window.__H.fist(false));
  await sleep(300);
  const trN = await E(() => window.__H.stop());
  report.check('cầm rồi mở tay, không kéo → không giữ hai nút ‹ ›', trN.every((r) => !r.hid), null);
  await settled();
  await onStele();
  const i0 = await idx();
  await E(() => window.__H.start());
  await E(() => window.__H.fist(true));
  await sleep(500);
  await E(() => window.__H.move(-0.045 * innerWidth, 300));
  await sleep(200);
  const mid = await dbg();
  // mở tay TRƯỚC rồi mới đưa tay ra ngoài (không để một nhịp 'move' xa kéo bia qua ngưỡng)
  const tOpen = await E(() => { window.__H.fist(false); Object.assign(window.__H, { hx: 80, hy: 160 }); return window.__H.now(); });
  await page.waitForFunction(() => { const c = window.__vm.cinemaCam(); return !c.camTw && c.off < 1e-3 && window.__vm.cinemaTxProgress() < 0; }, null, { timeout: 9000, polling: 50 }).catch(() => {});
  await sleep(300);
  const tr = await E(() => window.__H.stop());
  const after = tr.filter((r) => r.t >= tOpen);
  const steps = after.slice(1).map((r, i) => step(after[i].pos, r.pos));
  const last = tr.at(-1);
  const ringOff = after.find((r) => r.ring.every((x) => x.a === 0));
  report.check('đang kéo dưới ngưỡng (bia đang tua)', mid.grabbed && mid.scrub?.mode === 'drag', { scrub: mid.scrub });
  report.check('mở tay sớm → lò xo về, chỉ số giữ; khay đủ cỡ', (await idx()) === i0 && last.sc.every((v) => v === 1) && !last.mode, last);
  report.check('mở tay → vòng cầm mờ tắt (≤ 0,4 s)', !!ringOff && ringOff.t - tOpen <= 400, { offMs: ringOff ? ringOff.t - tOpen : null });
  report.check('camera trôi về khung êm ("return", bước mỗi khung ≤ 25 mm), tới khung nghỉ', after.some((r) => r.tw === 'return') && Math.max(...steps) <= 0.025 && last.off < 1e-3, { maxStep: +Math.max(...steps).toFixed(4) });
}

// ---- E + F
report.section('E. nắm tay trên đầu rùa (r70) · F. tắt "Nắm tay kéo bia"');
{
  await onStele();
  // r70: xoa đầu rùa chỉ mở bằng xoa thật — không còn nhận nắm tay (body[data-hand-fist="claim"]) → nắm tay ngay trên đầu rùa vẫn cầm bia
  const hd = await E(() => window.__vm.cinemaRub.head());
  if (hd) { await E((h) => Object.assign(window.__H, { hx: h.x, hy: h.y }), hd); await sleep(400); }
  const a0 = await E(() => window.__vm.cinemaRub.state().activations);
  await E(() => window.__H.fist(true));
  await sleep(300);
  const d = await dbg();
  const rs = await E(() => { const s = window.__vm.cinemaRub.state(); return { active: s.active, activations: s.activations, claim: document.body.dataset.handFist ?? null }; });
  await E(() => window.__H.fist(false));
  await settled();
  report.check('nắm tay trên đầu rùa (đang focus) → cầm bia như thường; không vào xoa, không "claim"', !!hd && d.grabbed && !rs.active && rs.activations === a0 && rs.claim === null, { head: hd && Math.round(hd.r), grabbed: d.grabbed, rub: rs });
  await E(() => window.__vm.settings.set('fistGrab', false));
  await onStele();
  await E(() => window.__H.fist(true));
  await sleep(300);
  const d2 = await dbg();
  const l2 = await lastLog();
  await E(() => window.__H.fist(false));
  await E(() => window.__vm.settings.set('fistGrab', true));
  report.check('tắt "Nắm tay kéo bia" → không cầm', !d2.grabbed && l2?.why === 'off', { log: l2 });
}

// ---- G. dự phòng hiện lại hai nút
report.section('G. thôi giữ hai nút ‹ › (dự phòng)');
{
  /** cầm + kéo dưới ngưỡng rồi thả ngoài bia → hai nút đang ẩn */
  const hideNav = async () => {
    await settled();
    await onStele();
    await E(() => window.__H.fist(true));
    await sleep(350);
    await E(() => window.__H.move(-0.04 * innerWidth, 250));
    await sleep(150);
    await E(() => { window.__H.fist(false); Object.assign(window.__H, { hx: 80, hy: 160 }); });
    await sleep(200);
    return navHidden();
  };
  let h = await hideNav();
  const tGone = Date.now();
  await E(() => window.__H.leave());
  await page.waitForFunction(() => document.body.dataset.handFistnav !== 'hold', null, { timeout: 6000, polling: 50 }).catch(() => {});
  const goneMs = Date.now() - tGone;
  report.check('tay rời khung → thôi giữ sau ~3 s (2,8–3,8 s)', h && goneMs >= 2800 && goneMs <= 3800, { hold: h, goneMs });
  await E(() => (window.__H.on = true));
  h = await hideNav();
  await page.mouse.move(700, 120);
  await page.mouse.move(720, 130, { steps: 3 });
  await sleep(100);
  const m = await navHidden();
  report.check('chuột thật di chuyển → thôi giữ ngay', h && !m, { before: h, after: m });
  h = await hideNav();
  await page.keyboard.press('Shift');
  await sleep(100);
  const k = await navHidden();
  report.check('phím → thôi giữ ngay', h && !k, { before: h, after: k });
  h = await hideNav();
  // chuột thật vừa đi ở trên → nguồn con trỏ là chuột; tay giành lại quyền như lớp cử chỉ làm khi tay "nhận" (body[data-input])
  await E(() => (document.body.dataset.input = 'hand'));
  await settled(); // lò xo của cú kéo dưới ngưỡng về xong (lúc đang lướt / tua, tia của tay không bắn vào bia)
  const sp = await E(() => window.__vm.cinemaStelePoint());
  await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y }), sp);
  await page.waitForFunction(() => document.body.dataset.handFistnav !== 'hold', null, { timeout: 1500, polling: 30 }).catch(() => {});
  report.check('… tay về bia → thôi giữ', !(await navHidden()), await E(() => ({ gh: window.__vm.cinemaGrabHover(), v: window.__vm.cinemaVdrag.debug.held })));
}

// ---- K. (r62) chờ hover sau khi kéo đổi bia
report.section('K. chờ hover sau khi kéo đổi bia (r62)');
{
  /** focus → nắm tay → kéo trái qua ngưỡng → nhận → mở tay ở bên → chờ lướt xong. Trả chỉ số bia trước lúc kéo. */
  const dragNext = async ({ focus = true } = {}) => {
    await settled();
    if (focus) await onStele();
    const i0 = await idx();
    await E(() => window.__H.fist(true));
    await sleep(250);
    await E(() => window.__H.move(-0.14 * innerWidth, 350));
    await page.waitForFunction(() => window.__vm.cinemaTxProgress() < 0 && !window.__vm.cinemaVdrag.debug.scrub, null, { timeout: 8000, polling: 50 }).catch(() => {});
    await E(() => window.__H.fist(false));
    await sleep(200);
    return i0;
  };
  /** đưa tay về điểm trên bia mới; ghi vết tới khi focus (hoặc hết ms). */
  const backToStele = async (ms = 3200) => {
    const sp = await E(() => window.__vm.cinemaStelePoint());
    await E(() => window.__H.start());
    await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y }), sp);
    await page.waitForFunction(() => window.__vm.cinemaIdle().shown, null, { timeout: ms, polling: 30 }).catch(() => {});
    await sleep(120);
    const tr = await E(() => window.__H.stop());
    const on = tr.find((r) => r.gh === 'on');
    const sh = tr.find((r) => r.shown);
    return { tr, onT: on?.t ?? null, shownT: sh?.t ?? null, waitMs: on && sh ? sh.t - on.t : null, firstT: tr[0]?.t ?? 0 };
  };
  // K1. mặc định 2 s
  const i0 = await dragNext();
  const armed = await E(() => window.__vm.cinemaGrabHover());
  const k1 = await backToStele();
  const win = k1.tr.filter((r) => r.gh === 'on');
  report.check('nhận xong (tay chưa về bia) → đang chờ hover (phase pending), đã sang bia sau', armed.phase === 'pending' && (await idx()) === (i0 + 1) % 82, armed);
  report.check('tay về trên bia mới → hover chờ ~2 s (1,9–2,5 s) rồi mới focus', k1.waitMs != null && k1.waitMs >= 1900 && k1.waitMs <= 2500, { waitMs: k1.waitMs });
  report.check('trong lúc chờ: không thông tin / đèn / camera chính diện; "sẵn sàng cầm" (body[data-stele-focus="1"])', win.length > 20 && win.every((r) => !r.shown && !r.sel && r.f <= 0.01 && r.flag === 1 && r.gr === 1), { n: win.length, bad: win.filter((r) => r.shown || r.sel || r.f > 0.01 || !r.flag || !r.gr).slice(0, 2) });
  report.check('đủ giờ → focus thường (hết chờ)', k1.shownT != null && (await E(() => window.__vm.cinemaGrabHover().phase)) === null, null);
  // K2. kéo liên tục: về bia mới, nắm tay NGAY trong lúc chờ (chưa focus) → cầm được, kéo tiếp
  const i1 = await dragNext({ focus: false });
  const sp = await E(() => window.__vm.cinemaStelePoint());
  await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y }), sp);
  await page.waitForFunction(() => window.__vm.cinemaGrabHover().phase === 'on', null, { timeout: 3000, polling: 30 }).catch(() => {});
  await sleep(350);
  const pre = await E(() => ({ shown: window.__vm.cinemaIdle().shown, flag: document.body.dataset.steleFocus ?? null, gh: window.__vm.cinemaGrabHover() }));
  await E(() => window.__H.fist(true));
  await sleep(150);
  const g2 = await dbg();
  const l2 = await lastLog();
  await E(() => window.__H.move(-0.14 * innerWidth, 350));
  await page.waitForFunction(() => window.__vm.cinemaTxProgress() < 0 && !window.__vm.cinemaVdrag.debug.scrub, null, { timeout: 8000, polling: 50 }).catch(() => {});
  await E(() => window.__H.fist(false));
  await sleep(200);
  report.check('trong lúc chờ (chưa focus): nắm tay trên bia mới → CẦM được ngay', !pre.shown && pre.flag === '1' && pre.gh.grabReady && g2.grabbed && l2?.ev === 'grab', { pre, grabbed: g2.grabbed, log: l2 });
  report.check('… kéo tiếp qua ngưỡng → nhận lần nữa (kéo liên tục, không chờ focus)', (await idx()) === (i1 + 2) % 82, { i1, now: await idx() });
  await backToStele();
  // K3. rời bia trong lúc chờ → thôi chờ; quay lại → hover như thường (không chờ)
  await dragNext();
  const sp3 = await E(() => window.__vm.cinemaStelePoint());
  await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y }), sp3);
  await page.waitForFunction(() => window.__vm.cinemaGrabHover().phase === 'on', null, { timeout: 3000, polling: 30 }).catch(() => {});
  await sleep(400);
  await E(() => Object.assign(window.__H, { hx: 80, hy: 160 }));
  await sleep(450);
  const left = await E(() => window.__vm.cinemaGrabHover());
  const k3 = await backToStele(1500);
  report.check('rời bia trong lúc chờ → thôi chờ (why: left); quay lại → hover như thường (< 0,5 s)', left.phase === null && left.why === 'left' && k3.shownT != null && k3.shownT - k3.firstT < 500, { left, shownAfter: k3.shownT != null ? k3.shownT - k3.firstT : null });
  // K4. cài đặt 0,5 s · 0 (không chờ)
  await E(() => window.__vm.settings.set('grabHoverDelay', 0.5));
  await dragNext();
  const k4 = await backToStele();
  await E(() => window.__vm.settings.set('grabHoverDelay', 0));
  await dragNext();
  const armed0 = await E(() => window.__vm.cinemaGrabHover());
  const k5 = await backToStele(1500);
  await E(() => window.__vm.settings.set('grabHoverDelay', 2));
  report.check('"Chờ hover sau khi kéo" 0,5 s → focus sau ~0,5 s (0,45–0,95 s)', k4.waitMs != null && k4.waitMs >= 450 && k4.waitMs <= 950, { waitMs: k4.waitMs });
  report.check('"Chờ hover sau khi kéo" 0 → không chờ (không pha chờ; hover như thường < 0,5 s)', armed0.phase === null && k5.shownT != null && k5.shownT - k5.firstT < 500 && k5.tr.every((r) => r.gh === null), { armed0, shownAfter: k5.shownT != null ? k5.shownT - k5.firstT : null });
}

// ---- L. (r67) body[data-hand-over="stele"] — con trỏ tay trên bia / bục (lớp cử chỉ tô vàng, viền dày)
report.section('L. con trỏ tay trên bia + bục (r67)');
{
  await settled();
  await E(() => { window.__H.on = true; document.body.dataset.input = 'hand'; });
  const at = async (p, ms = 350) => {
    await E((p) => Object.assign(window.__H, { hx: p.x, hy: p.y, pose: 'open' }), p);
    await sleep(ms);
    return E(() => document.body.dataset.handOver ?? null);
  };
  const sp = await E(() => window.__vm.cinemaStelePoint());
  const pp = await E(() => window.__vm.cinemaPedestalPoint());
  const onStele = await at(sp);
  const onPed = await at(pp);
  const pedNotStele = await E(() => !document.body.hasAttribute('data-hand-stele')); // tia không trúng tấm bia — cờ là nhờ bục
  // rời ra nền trống: còn giữ một nhịp ngắn (trễ ~100 ms) rồi gỡ
  await E(() => Object.assign(window.__H, { hx: 80, hy: 160 }));
  const tOff = Date.now();
  await page.waitForFunction(() => !document.body.dataset.handOver, null, { timeout: 1500, polling: 10 }).catch(() => {});
  const offMs = Date.now() - tOff;
  const empty = await at({ x: 80, y: 160 }, 300);
  // lại lên bia rồi mất tay → gỡ ngay
  await at(sp);
  await E(() => window.__H.leave());
  await sleep(120);
  const gone = await E(() => document.body.dataset.handOver ?? null);
  await E(() => (window.__H.on = true));
  report.check('con trỏ tay trên tấm bia → body[data-hand-over="stele"]', onStele === 'stele', { onStele, sp });
  report.check('con trỏ tay trên thân bục (ngoài tấm bia) → "stele"', onPed === 'stele' && pedNotStele, { onPed, pp, pedNotStele });
  report.check('ra nền trống → gỡ sau một nhịp trễ ngắn (80–400 ms), ở nền trống không có cờ', empty === null && offMs >= 60 && offMs <= 400, { empty, offMs });
  report.check('mất tay → gỡ ngay', gone === null, { gone });
}
await E(() => clearInterval(window.__H.id));
allErrors.push(...errors);
await close();

// ---- I. giảm chuyển động
report.section('I. giảm chuyển động');
{
  const { page: p2, close: c2, errors: e2 } = await launch({ headed, width: 1440, height: 900, reducedMotion: true, settings: SETTINGS });
  await openCinema(p2, port, { hooks: HOOKS, settleMs: 3000 });
  const E2 = (f, a) => p2.evaluate(f, a);
  await install(E2);
  const sp = await E2(() => window.__vm.cinemaStelePoint());
  await E2((p) => Object.assign(window.__H, { hx: p.x, hy: p.y, pose: 'open' }), sp);
  await p2.waitForFunction(() => window.__vm.cinemaCam().sel, null, { timeout: 8000, polling: 50 }).catch(() => {});
  await sleep(300);
  await E2(() => window.__H.start());
  await E2(() => window.__H.fist(true));
  await sleep(600);
  const tr = await E2(() => window.__H.stop());
  await E2(() => window.__H.fist(false));
  const G = tr.filter((r) => r.grabbed);
  const ht = G[0]?.ht ?? 0;
  report.check('giảm chuyển động: vòng chỉ mờ → rõ (không nở — cỡ 1 suốt), nằm sàn', G.length > 5 && G.every((r) => r.ring[ht].s === 1 && r.ring[ht].y < 0.01) && G[0].ring[ht].a < 0.5 && G.at(-1).ring[ht].a >= 0.99, { first: G[0]?.ring[ht], last: G.at(-1)?.ring[ht] });
  allErrors.push(...e2);
  await c2();
}

// ---- J. lớp cử chỉ THẬT: đang giữ → mũi tên không hút tay; tay về bia → hút lại
report.section('J. lớp cử chỉ thật: hút / không hút mũi tên');
{
  const { page: p3, close: c3, errors: e3 } = await launch({ headed, width: 1440, height: 900, settings: SETTINGS });
  await openCinema(p3, port, { query: '?handCursor=shown', hooks: [...HOOKS, '__vmHand.simulateHand'], settleMs: 3000 });
  const E3 = (f, a) => p3.evaluate(f, a);
  await E3(() => {
    document.body.classList.add('gesture-on');
    const A = (window.__A = { hx: 0.4, hy: 0.55, pose: 'open', tgt: null, cur: null, first: true, engaged: false });
    window.addEventListener('hand:frame', (e) => {
      const d = e.detail;
      if (d.detected) A.cur = { x: d.rawX ?? d.x, y: d.rawY ?? d.y };
      A.engaged = d.engaged === true;
    });
    A.id = setInterval(() => {
      if (A.tgt && A.cur) {
        A.hx = Math.min(0.97, Math.max(0.03, A.hx + ((A.tgt.x - A.cur.x) / innerWidth) * 0.3));
        A.hy = Math.min(0.97, Math.max(0.03, A.hy + ((A.tgt.y - A.cur.y) / innerHeight) * 0.3));
      }
      window.__vmHand.simulateHand([{ pose: A.pose, x: A.hx, y: A.hy, ms: 33 }], { live: true, fresh: A.first });
      A.first = false;
    }, 33);
    // nhật ký dính (body[data-hand-sticky])
    A.stuck = [];
    new MutationObserver(() => A.stuck.push(document.body.dataset.handSticky ?? '')).observe(document.body, { attributes: true, attributeFilter: ['data-hand-sticky'] });
  });
  await p3.waitForFunction(() => window.__A.engaged, null, { timeout: 8000 }).catch(() => {});
  const sp = await E3(() => window.__vm.cinemaStelePoint());
  await E3((t) => (window.__A.tgt = t), { x: sp.x, y: sp.y });
  await p3.waitForFunction(() => window.__vm.cinemaCam().sel, null, { timeout: 9000, polling: 50 }).catch(() => {});
  await sleep(500);
  // cú nắm tay kéo (sự kiện view — lớp cử chỉ không dựng được nắm tay từ tay tổng hợp này): cầm → kéo 0,04 W → thả
  await E3(() => new Promise((res) => {
    const x0 = 0.5;
    const emit = (phase, x) => window.dispatchEvent(new CustomEvent('hand:vdrag', { detail: { kind: 'fist', phase, x, dx: x - x0, vx: 0, t: performance.now() } }));
    emit('start', x0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      emit('move', x0 - Math.min(0.04, i * 0.005));
      if (i > 14) {
        clearInterval(id);
        emit('end', x0 - 0.04);
        res();
      }
    }, 33);
  }));
  const hold1 = await E3(() => document.body.dataset.handFistnav);
  // tay xoè đi sang mũi tên phải (vùng dính nav-next), ở đó 1,5 s
  await E3(() => { window.__A.stuck = []; window.__A.tgt = { x: innerWidth * 0.95, y: innerHeight * 0.45 }; });
  await sleep(2200);
  const r1 = await E3(() => ({ stuck: window.__A.stuck.slice(), hold: document.body.dataset.handFistnav, near: document.querySelector('.cin-nv--next').dataset.near, cur: window.__A.cur }));
  // về bia → thôi giữ; lại sang mũi tên → hút
  await E3((t) => (window.__A.tgt = t), { x: sp.x, y: sp.y });
  await p3.waitForFunction(() => document.body.dataset.handFistnav !== 'hold', null, { timeout: 6000, polling: 50 }).catch(() => {});
  const hold2 = await E3(() => document.body.dataset.handFistnav ?? null);
  await sleep(300);
  await E3(() => { window.__A.stuck = []; window.__A.tgt = { x: innerWidth * 0.95, y: innerHeight * 0.45 }; });
  await p3.waitForFunction(() => document.body.dataset.handSticky === 'nav-next', null, { timeout: 5000, polling: 50 }).catch(() => {});
  const r2 = await E3(() => ({ stuck: window.__A.stuck.slice(), sticky: document.body.dataset.handSticky ?? null }));
  report.check('sau cú nắm kéo: giữ hai nút (hold)', hold1 === 'hold', { hold1 });
  report.check('đang giữ: tay xoè đi tới mũi tên phải (con trỏ trong vùng mũi tên) và ở đó 1,5 s — KHÔNG bị hút (không dính nav-next), mũi tên không sáng theo tay', r1.cur && r1.cur.x > 1440 * 0.85 && !r1.stuck.includes('nav-next') && r1.hold === 'hold' && r1.near === '0', r1);
  report.check('tay về bia → thôi giữ; lại tới mũi tên → hút như thường (dính nav-next)', hold2 === null && r2.sticky === 'nav-next', { hold2, r2 });
  await E3(() => clearInterval(window.__A.id));
  allErrors.push(...e3);
  await c3();
}

process.exit(report.finish(allErrors));
