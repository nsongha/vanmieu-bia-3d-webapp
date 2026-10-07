// r70 — "Xoa đầu rùa" là tính năng ẩn: chỉ mở khi XOA THẬT vài nhịp trên đầu rùa (tay xoè / nhấn giữ chuột) lúc đang xem
// bia. Trình trợ giúp dùng chung cho các bài kiểm tra chế độ xoa (rub-hud, rub-camera, rub-open): mở như người dùng, qua
// đường nhập liệu thật — chuột Playwright thật; tay qua lớp cử chỉ thật (__vmHand.simulateHand, cần hook đó khi openCinema).
import { sleep } from './browser.mjs';

/**
 * Cài "tay" trong trang (window.__A, cùng dạng các bài kiểm tra cũ): mỗi 33 ms phát một khung simulateHand ở (hx, hy)
 * (0..1). tgt { x, y } px → lái dần lòng bàn tay tới đó (bám theo điểm lòng bàn tay thật 'hand:frame' báo lại); pose 'none'
 * = không có bàn tay. osc { ampPx, freq, circle } → xoa: lệch quanh chỗ đang đứng theo sin (biên độ tính theo px màn hình, tự
 * hiệu chỉnh theo tỉ lệ px / đơn vị tay đo được), lái chậm lại để không triệt tiêu nhịp xoa.
 */
export async function installHand(page, { pose = 'none', hx = 0.5, hy = 0.62 } = {}) {
  await page.evaluate(({ pose, hx, hy }) => {
    if (window.__A) return;
    document.body.classList.add('gesture-on');
    const A = (window.__A = { hx, hy, pose, tgt: null, cur: null, id: 0, first: true, run: true, last: null, osc: null, gx: 0, gy: 0, sent: null });
    window.addEventListener('hand:frame', (e) => {
      const d = e.detail;
      A.last = d;
      if (d.detected) A.cur = { x: d.palmX ?? d.x, y: d.palmY ?? d.y };
    });
    A.id = setInterval(() => {
      if (!A.run) return;
      const o = A.osc;
      if (A.tgt && A.cur && A.pose !== 'none') {
        // đang xoa: tâm lái rất chậm (cur dao động quanh tâm — lái nhanh sẽ kéo ngược nhịp xoa)
        const g = o ? 0.02 : 0.25;
        A.hx = Math.min(0.97, Math.max(0.03, A.hx + ((A.tgt.x - A.cur.x) / innerWidth) * g));
        A.hy = Math.min(0.97, Math.max(0.03, A.hy + ((A.tgt.y - A.cur.y) / innerHeight) * g));
      }
      let x = A.hx;
      let y = A.hy;
      if (o) {
        const t = (performance.now() - o.t0) / 1000;
        const w = 2 * Math.PI * o.freq * t;
        // px → đơn vị tay: ~1/innerWidth, nhân hệ số hiệu chỉnh o.kx (đo trong lúc xoa)
        const ax = (o.ampPx / innerWidth) * o.kx;
        const ay = (o.ampPx / innerHeight) * o.ky;
        x += ax * (o.circle ? Math.cos(w) : Math.sin(w));
        y += o.circle ? ay * Math.sin(w) : 0;
      }
      A.sent = { x, y };
      // fistLabel: tư thế 'fist' được gắn nhãn "Closed_Fist" như MediaPipe thật (r72: nắm tay để đóng lớp đọc)
      window.__vmHand.simulateHand([{ pose: A.pose, x, y, ms: 33 }], { live: true, fresh: A.first, fistLabel: true });
      A.first = false;
    }, 33);
  }, { pose, hx, hy });
}

export const removeHand = (page) => page.evaluate(() => {
  if (!window.__A) return;
  clearInterval(window.__A.id);
  document.body.classList.remove('gesture-on');
  delete window.__A;
});

/** Bám đầu rùa (lái tay / rê chuột) tới khi rub.js sẵn sàng nhận xoa (arm.why rỗng với tay / 'no-src' với chuột chưa nhấn). */
async function aimHead(page, src, timeoutMs) {
  const E = (fn, a) => page.evaluate(fn, a);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const h = await E(() => window.__vm.cinemaRub.head());
    if (h) {
      if (src === 'hand') await E((h) => { window.__A.tgt = { x: h.x, y: h.y }; }, h);
      else await page.mouse.move(h.x, h.y, { steps: 3 });
    }
    await sleep(120);
    const st = await E(() => window.__vm.cinemaRub.state());
    if (src === 'hand' && st.arm.src === 'hand' && st.arm.why === '') return true;
    if (src === 'mouse' && st.arm.why === 'no-src') return true;
  }
  return false;
}

/**
 * Tay xoè xoa qua lại trên đầu rùa (lớp cử chỉ thật) tới khi vào chế độ xoa. installHand trước. Trả 'rub' | 'failed'.
 * strokes: số nhịp xoa (một nhịp = qua + lại) mỗi lượt thử; ampK: biên độ × bán kính đầu rùa.
 */
export async function handRubOpen(page, { strokes = 3.6, freq = 2, ampK = 0.55, tries = 3, aimMs = 9000, circle = false } = {}) {
  const E = (fn, a) => page.evaluate(fn, a);
  await E(() => { window.__A.pose = 'open'; });
  for (let k = 0; k < tries; k++) {
    if (!(await aimHead(page, 'hand', aimMs))) continue;
    const r = (await E(() => window.__vm.cinemaRub.head()))?.r ?? 60;
    await E(({ ampPx, freq, circle }) => { window.__A.osc = { ampPx, freq, circle, t0: performance.now(), kx: 1, ky: 1 }; }, { ampPx: ampK * r, freq, circle });
    const tEnd = Date.now() + (strokes / freq) * 1000;
    const xs = [];
    while (Date.now() < tEnd) {
      await sleep(60);
      const c = await E(() => window.__A.cur);
      if (c) xs.push(c.x);
      // hiệu chỉnh biên độ một lần sau ~nửa giây (lớp cử chỉ có thể co / giãn toạ độ tay)
      if (xs.length === 9) {
        const span = (Math.max(...xs) - Math.min(...xs)) / 2;
        if (span > 2) await E((f) => { const o = window.__A.osc; if (o) { o.kx = Math.min(4, Math.max(0.5, f)); o.ky = o.kx; } }, (ampK * r) / span);
      }
    }
    await E(() => { window.__A.osc = null; });
    const t1 = Date.now();
    while (Date.now() - t1 < 900) {
      if (await E(() => window.__vm.cinemaRub.state().active)) return 'rub';
      await sleep(60);
    }
  }
  return 'failed';
}

/**
 * Chuột thật: rê lên đầu rùa (chờ bia focus), NHẤN GIỮ rồi xoa qua lại ~strokes nhịp, thả → vào chế độ xoa. 'rub' | 'failed'.
 */
export async function mouseRubOpen(page, { strokes = 3.4, freq = 2.2, ampK = 0.5, tries = 3, aimMs = 6000 } = {}) {
  const E = (fn, a) => page.evaluate(fn, a);
  for (let k = 0; k < tries; k++) {
    if (!(await aimHead(page, 'mouse', aimMs))) continue;
    const h = await E(() => window.__vm.cinemaRub.head());
    if (!h) continue;
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    const dur = (strokes / freq) * 1000;
    const t0 = Date.now();
    for (;;) {
      const t = Date.now() - t0;
      if (t > dur) break;
      await page.mouse.move(h.x + ampK * h.r * Math.sin((2 * Math.PI * freq * t) / 1000), h.y);
      await sleep(12);
    }
    await page.mouse.up();
    const t1 = Date.now();
    while (Date.now() - t1 < 900) {
      if (await E(() => window.__vm.cinemaRub.state().active)) return 'rub';
      await sleep(60);
    }
  }
  return 'failed';
}

/**
 * r70b — khách đặt tay xoè lên đầu rùa rồi XOA NGAY lúc bia vừa focus (camera đang lướt vào khung focus: đầu rùa trôi
 * ~60–80 px, to thêm ~10 % trong ~0,65 s) qua lớp cử chỉ thật. installHand trước. Hiệu chỉnh tỉ lệ toạ độ tay → px trên
 * nền trống, đặt tay thẳng lên đầu rùa (khung nghỉ), chờ khung đầu tiên bia focus rồi xoa quanh CHỖ ĐÓ (tay không bám theo
 * đầu rùa đang trôi — trường hợp xấu nhất). Trả { active, leadMs (focus → bắt đầu xoa), glide, strokes, activations }.
 */
export async function handRubAtFocus(page, { strokes = 3.4, freq = 2, ampK = 0.55 } = {}) {
  const E = (fn, a) => page.evaluate(fn, a);
  // hiệu chỉnh trên nền trống bên trái bia (toạ độ tay là cổ tay: tay quá cao thì ngón ra khỏi khung, không nhận) → px / đơn vị tay
  const at = async (hx, hy) => {
    await E(({ hx, hy }) => Object.assign(window.__A, { pose: 'open', tgt: null, osc: null, hx, hy }), { hx, hy });
    await sleep(500);
    return E(() => window.__A.cur && { ...window.__A.cur });
  };
  const X0 = 0.3;
  const Y0 = 0.8;
  const p0 = await at(X0, Y0);
  const px = await at(X0 + 0.08, Y0);
  const py = await at(X0, Y0 + 0.1);
  if (!p0 || !px || !py) return { active: false, error: 'calibration', p0, px, py };
  const gx = (px.x - p0.x) / 0.08;
  const gy = (py.y - p0.y) / 0.1;
  await E(() => { window.__A.pose = 'none'; });
  await page.waitForFunction(() => !window.__vm.cinemaPresence().shown, null, { timeout: 5000 }).catch(() => {});
  await sleep(2500); // camera về khung nghỉ
  const h = await E(() => window.__vm.cinemaRub.head());
  const hx = X0 + (h.x - p0.x) / gx;
  const hy = Y0 + (h.y - p0.y) / gy;
  const a0 = await E(() => window.__vm.cinemaRub.state().activations);
  const r = await E(async ({ hx, hy, strokes, freq, ampK, kx, ky }) => {
    const A = window.__A;
    const fr = () => new Promise((res) => requestAnimationFrame(res));
    Object.assign(A, { hx, hy, tgt: null, osc: null, pose: 'open' });
    const t0 = performance.now();
    while (!window.__vm.cinemaPresence().shown && performance.now() - t0 < 5000) await fr();
    const tf = performance.now();
    const h0 = window.__vm.cinemaRub.head();
    A.osc = { ampPx: ampK * h0.r, freq, circle: false, t0: performance.now(), kx, ky };
    const tOsc = performance.now();
    const dur = (strokes / freq) * 1000;
    let h1 = h0;
    let maxS = 0;
    let active = false;
    while (performance.now() - tOsc < dur + 900) {
      if (performance.now() - tOsc > dur) A.osc = null;
      await fr();
      const s = window.__vm.cinemaRub.state();
      maxS = Math.max(maxS, s.arm.strokes);
      if (performance.now() - tOsc <= dur) h1 = window.__vm.cinemaRub.head() ?? h1;
      if (s.active) { active = true; break; }
    }
    A.osc = null;
    return { active, leadMs: Math.round(tOsc - tf), focusAfterMs: Math.round(tf - t0), strokes: maxS, glide: { dx: Math.round(h1.x - h0.x), dy: Math.round(h1.y - h0.y), rK: +(h1.r / h0.r).toFixed(3) } };
  }, { hx, hy, strokes, freq, ampK, kx: (await E(() => innerWidth)) / gx, ky: (await E(() => innerHeight)) / gy }); // o.kx: px → đơn vị tay
  r.activations = (await E(() => window.__vm.cinemaRub.state().activations)) - a0;
  return r;
}
