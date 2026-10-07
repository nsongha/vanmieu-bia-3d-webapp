// Ma trận trạng thái hai mũi tên "Chỉ vàng" (r27 → r32b; r62: bỏ các dòng hand:nav H4 / H5c / H7 — Điện ảnh không còn "nhắm
// rồi vẩy"): mỗi đường vào / ra bằng sự kiện thật (chuột, phím) hoặc
// đúng hợp đồng của lớp cử chỉ (hand:frame / hand:sticky / input:mode, body.gesture-on) → sau mỗi dòng, hai
// mũi tên phải về trạng thái NGHỈ chính xác (không kẹt dính / gần / loé / mờ / khung / tiêu điểm…). Kèm: ba đích rê loại
// trừ nhau (bia · dòng thời gian · mũi tên), mũi tên đi vào khi dính (r29), kéo camera đi ngang dòng thời gian / mũi tên.
// node tests/cinema/arrows-matrix.test.mjs --port 5180 [--only M1,H2]
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, only, headed } = parseArgs();
const w = 1920, h = 1080;
const report = createReport('arrows-matrix');
const { page, close, errors } = await launch({ width: w, height: h, headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, cinemaArrows: 'gold', handTutorial: false } }); // hướng dẫn cử chỉ tự mở khi "khách mới" giơ tay — tắt ở đây (có kiểm thử riêng)
await openCinema(page, port, { hooks: ['cinemaTimeline'], settleMs: 3000 });
await page.evaluate(() => {
  const KNOWN = new Set(['class', 'type', 'data-dir', 'data-magnet', 'data-fired', 'data-dim', 'data-near', 'data-hand-sticky', 'data-hand-sticky-axis', 'aria-label', 'data-p', 'style', 'data-press', 'data-hand-sticky-box-pad', 'data-hand-sticky-box-radius', 'data-hand-sticky-reach', 'data-hand-sticky-pad']);
  window.__t = {
    b: (d) => document.querySelector(`.cin-nv--${d}`),
    state(d) {
      const b = this.b(d);
      const cs = getComputedStyle(b);
      const q = (s) => b.querySelector(s);
      const lab = getComputedStyle(q('.cin-nv__label'));
      const fr = getComputedStyle(q('.cin-nv__frame'));
      return {
        sticky: b.classList.contains('is-sticky'), near: b.dataset.near, fired: b.dataset.fired, dim: b.dataset.dim, p: b.style.getPropertyValue('--p') || '0',
        hand: b.style.getPropertyValue('--hand') || '0', focusVisible: b.matches(':focus-visible'), hover: b.matches(':hover'),
        extra: [...b.attributes].map((a) => a.name).filter((n) => !KNOWN.has(n) && !n.startsWith('data-hand-sticky')), styleAttr: b.getAttribute('style') || '',
        scale: cs.scale, translate: cs.translate, transform: cs.transform, opacity: cs.opacity,
        rotUp: getComputedStyle(q('.cin-nv__arm--up')).rotate, rotDn: getComputedStyle(q('.cin-nv__arm--dn')).rotate,
        labelOutline: lab.outlineStyle, labelBorder: lab.borderTopStyle, frameBorder: fr.borderTopStyle, frameBg: fr.backgroundImage,
        beforeBg: getComputedStyle(b, '::before').backgroundImage,
        gemScale: getComputedStyle(q('.cin-nv__gem')).scale,
        handnav: document.querySelector('.cin-nav').dataset.handnav,
      };
    },
    fails(d) {
      const s = this.state(d);
      const f = [];
      if (s.sticky) f.push('is-sticky');
      if (s.near !== '0') f.push(`near=${s.near}`);
      if (s.fired !== '0') f.push(`fired=${s.fired}`);
      if (s.dim !== '0') f.push(`dim=${s.dim}`);
      if (+s.p) f.push(`--p=${s.p}`);
      if (+s.hand) f.push(`--hand=${s.hand}`);
      if (s.focusVisible) f.push('focus-visible');
      if (s.extra.length) f.push(`attrs:${s.extra.join('+')}`);
      if (!(s.scale === 'none' || +s.scale === 1)) f.push(`scale=${s.scale}`);
      if (!/^0px\b/.test(s.translate)) f.push(`translate=${s.translate}`);
      if (s.transform !== 'none') f.push(`transform=${s.transform}`);
      if (!/^(0deg|none)$/.test(s.rotUp)) f.push(`rotUp=${s.rotUp}`);
      if (s.rotDn !== '180deg') f.push(`rotDn=${s.rotDn}`);
      if (s.labelOutline !== 'none') f.push(`labelOutline=${s.labelOutline}`);
      if (s.labelBorder !== 'none' || s.frameBorder !== 'none' || s.frameBg !== 'none') f.push('frame/border');
      if (s.beforeBg !== 'none') f.push('glow');
      if (!(s.gemScale === 'none' || +s.gemScale === 1)) f.push(`gemScale=${s.gemScale}`);
      if (s.handnav === '1') f.push('handnav');
      return f;
    },
    rest() { return { prev: this.fails('prev'), next: this.fails('next') }; },
    // hợp đồng lớp cử chỉ (không cần camera)
    gesture(on) { document.body.classList.toggle('gesture-on', on); },
    input(m) { document.body.dataset.input = m; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: m } })); },
    handAt(x, y, extra = {}) { window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, x, y, pose: 'open', engaged: true, ...extra } })); },
    handLost() { window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })); },
    rect(d) { const r = this.b(d).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; },
  };
});
const T = (fn, ...a) => page.evaluate(fn, ...a);
const rest = () => T(() => window.__t.rest());
const state = (d) => T((d) => window.__t.state(d), d);
const neutral = async () => { await page.mouse.move(960, 180, { steps: 2 }); };
const waitUnlock = async () => { for (let i = 0; i < 120; i++) { const l = await T(() => document.querySelector('.cinema').dataset.navlock); if (l !== '1') return; await sleep(50); } };
const settle = async (ms = 1100) => { await sleep(ms); await waitUnlock(); await sleep(150); };
const ok = (r) => !r.prev.length && !r.next.length;
const rows = [];
const want = (id) => !only || only.has(id);
async function row(id, desc, fn) {
  if (!want(id)) return;
  await neutral();
  await settle(300);
  // mỗi dòng độc lập: dòng trước kẹt gì thì ghi lại rồi dọn tay về nghỉ (không để lây sang dòng sau)
  const pre = await rest();
  if (!ok(pre)) {
    await T(() => {
      document.querySelector('.cin-stage').focus();
      for (const b of document.querySelectorAll('.cin-nv')) { b.style.removeProperty('--hand'); b.style.removeProperty('--p'); b.dataset.near = '0'; b.dataset.dim = '0'; b.dataset.fired = '0'; b.dataset.p = '0.00'; b.classList.remove('is-sticky'); }
      document.querySelector('.cin-nav').dataset.handnav = '0';
      document.querySelector('.cinema').dataset.handnav = '0';
    });
    await settle(900);
  }
  await T(() => document.querySelector('.cin-stage').focus());
  let extra = null;
  try { extra = await fn(); } catch (e) { extra = { error: String(e).slice(0, 200) }; }
  await settle();
  const r = await rest();
  const pass = ok(r) && extra?.ok !== false && !extra?.error;
  rows.push({ id, desc, pass, after: r, during: extra });
  report.check(`${id} ${desc}`, pass, { rest: ok(r) ? 'ok' : r, during: extra });
}
const next = async () => T(() => window.__t.rect('next'));

// ---------- chuột
await row('M1', 'chuột: nghỉ → rê → rời', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 5 }); await sleep(700); const s = await state('next'); await neutral(); return { hoverScale: s.scale, rotUp: s.rotUp, labelOutline: s.labelOutline }; });
await row('M2', 'chuột: bấm rồi rời đi', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); await page.mouse.down(); await page.mouse.up(); await sleep(250); await neutral(); });
await row('M3', 'chuột: bấm rồi ở yên (năm đổi dưới con trỏ) → rời', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); await page.mouse.down(); await page.mouse.up(); await sleep(1900); const s = await state('next'); await neutral(); return { stayScale: s.scale, stayOutline: s.labelOutline, stayFocusVisible: s.focusVisible }; });
await row('M4', 'chuột: rê trong lúc khoá đổi bia → rời', async () => { await page.keyboard.press('ArrowRight'); await sleep(120); const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); await sleep(300); const s = await state('next'); await neutral(); return { lockedOpacity: s.opacity, lockedScale: s.scale }; });
await row('M5', 'chuột: bấm dồn 3 lần (khoá bỏ 2) → rời', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); for (let k = 0; k < 3; k++) { await page.mouse.down(); await page.mouse.up(); await sleep(90); } await neutral(); });
// ---------- bàn phím
await row('K1', 'phím: Tab tới mũi tên → rời tiêu điểm', async () => {
  await T(() => document.querySelector('.cin-stage').focus());
  let s = null;
  for (let k = 0; k < 20; k++) { await page.keyboard.press('Tab'); const a = await T(() => document.activeElement?.classList.contains('cin-nv--next') || document.activeElement?.classList.contains('cin-nv--prev')); if (a) { await sleep(600); s = await T(() => { const d = document.activeElement.dataset.dir; return { dir: d, ...window.__t.state(d) }; }); break; } }
  await T(() => document.querySelector('.cin-stage').focus());
  return s ? { dir: s.dir, focusVisible: s.focusVisible, labelOutline: s.labelOutline, gemScale: s.gemScale, scale: s.scale } : { error: 'không Tab tới được' };
});
await row('K2', 'phím: ← / → khi tiêu điểm ở sân khấu', async () => { await T(() => document.querySelector('.cin-stage').focus()); await page.keyboard.press('ArrowRight'); await sleep(200); const s = await state('next'); await settle(); await page.keyboard.press('ArrowLeft'); return { firedNext: s.fired }; });
await row('K3', 'phím: bấm chuột mũi tên → rời chuột → → (tiêu điểm còn ở nút?)', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); await page.mouse.down(); await page.mouse.up(); await sleep(200); await neutral(); await settle(); await page.keyboard.press('ArrowRight'); await sleep(900); const s = await state('next'); return { focusVisible: s.focusVisible, labelOutline: s.labelOutline, scale: s.scale, rotUp: s.rotUp, active: await T(() => document.activeElement?.className || document.activeElement?.tagName) }; });
// ---------- tay
const handOn = async () => { await T(() => { window.__t.gesture(true); window.__t.input('hand'); }); };
// lớp cử chỉ phát hand:sticky MỖI khung khi còn ở trạng thái đó — giả lập đúng như vậy (view r27 canh chừng)
await T(() => {
  const orig = window.__vm.cinemaSticky;
  const live = {};
  window.__vm.cinemaSticky = (name, d = {}) => { clearInterval(live[name]); const r = orig(name, d); if (d.active !== false) live[name] = setInterval(() => orig(name, { ...d }), 50); return r; };
  window.__stopSticky = () => { for (const k in live) clearInterval(live[k]); };
});
const handOff = async () => { await T(() => { window.__t.handLost(); window.__t.input('mouse'); window.__t.gesture(false); }); };
await row('H1', 'tay: tiến lại (--hand, data-near) → rời xa', async () => {
  await handOn(); const r = await next();
  for (let k = 0; k <= 10; k++) { await T(([x, y]) => window.__t.handAt(x, y), [r.l - 300 + k * 30, r.cy]); await sleep(40); }
  await sleep(500); const s = await state('next');
  for (let k = 0; k <= 10; k++) { await T(([x, y]) => window.__t.handAt(x, y), [r.l - k * 40, r.cy]); await sleep(40); }
  await sleep(300); await handOff(); return { hand: s.hand, near: s.near, scale: s.scale };
});
await row('H2', 'tay: dính vào → ra', async () => { await handOn(); const r = await next(); await T(([x, y]) => window.__t.handAt(x, y), [r.l - 250, r.cy]); await T(() => window.__vm.cinemaSticky('nav-next', { rel: { x: 0.5, y: 0.5 } })); await sleep(700); const s = await state('next'); await T(() => window.__vm.cinemaSticky('nav-next', { active: false })); await sleep(200); await T(([x, y]) => window.__t.handAt(x, y), [r.l - 400, r.cy]); await sleep(200); await handOff(); return { stickyScale: s.scale, near: s.near }; });
await row('H2b', 'tay: dính → ra, tay còn đứng xa (không có khung đổi mức gần)', async () => { await handOn(); await T(() => window.__vm.cinemaSticky('nav-next', { rel: { x: 0.5, y: 0.5 } })); await sleep(500); await T(() => window.__vm.cinemaSticky('nav-next', { active: false })); await sleep(300); const s = await state('next'); await T(() => { window.__t.input('mouse'); window.__t.gesture(false); }); return { nearAfterExit: s.near }; });
await row('H3', 'tay: dính → nhón chọn (đổi bia) → ra', async () => { await handOn(); await T(() => window.__vm.cinemaSticky('nav-next', { rel: { x: 0.5, y: 0.5 } })); await sleep(500); const i0 = await T(() => window.__vm.cinemaIdle().index); await T(() => window.__vm.cinemaStickyPinch()); await sleep(200); const i1 = await T(() => window.__vm.cinemaIdle().index); await settle(); await T(() => window.__vm.cinemaSticky('nav-next', { active: false })); await handOff(); return { stepped: i1 - i0 }; });
await row('H5', 'tay: mất tay đột ngột khi đang tiến lại (không khung nào sau đó)', async () => { await handOn(); const r = await next(); for (let k = 0; k <= 8; k++) { await T(([x, y]) => window.__t.handAt(x, y), [r.l - 160 + k * 20, r.cy]); await sleep(40); } await sleep(300); await T(() => window.__t.handLost()); await sleep(900); const s = await state('next'); await T(() => { window.__t.input('mouse'); window.__t.gesture(false); }); return { handAfterLoss: s.hand, nearAfterLoss: s.near, scale: s.scale }; });
await row('H5b', 'tay: mất tay khi đang dính (lớp cử chỉ: rời vùng dính "mất tay")', async () => { await handOn(); const r = await next(); await T(([x, y]) => window.__t.handAt(x, y), [r.cx, r.cy]); await T(() => window.__vm.cinemaSticky('nav-next', { rel: { x: 0.5, y: 0.5 } })); await sleep(500); await T(() => { window.__t.handLost(); window.__vm.cinemaSticky('nav-next', { active: false, why: 'mất tay' }); }); await sleep(900); const s = await state('next'); await T(() => { window.__t.input('mouse'); window.__t.gesture(false); }); return { handAfterLoss: s.hand, near: s.near, sticky: s.sticky }; });
await row('H6', 'tay → chuột giữa chừng (tay vẫn trong khung, đang tiến lại)', async () => { await handOn(); const r = await next(); for (let k = 0; k <= 8; k++) { await T(([x, y]) => window.__t.handAt(x, y), [r.l - 120 + k * 15, r.cy]); await sleep(40); } await sleep(300); await T(() => window.__t.input('mouse')); await page.mouse.move(700, 500, { steps: 4 }); for (let k = 0; k < 6; k++) { await T(([x, y]) => window.__t.handAt(x, y), [r.l - 10, r.cy]); await sleep(60); } await sleep(700); const s = await state('next'); await handOff(); return { handInMouseMode: s.hand, scale: s.scale, rotUp: s.rotUp }; });
await row('H6b', 'tay → chuột giữa chừng khi đang dính', async () => { await handOn(); await T(() => window.__vm.cinemaSticky('nav-next', { rel: { x: 0.5, y: 0.5 } })); await sleep(500); await T(() => window.__t.input('mouse')); await page.mouse.move(700, 520, { steps: 4 }); await sleep(800); const s = await state('next'); await T(() => window.__vm.cinemaSticky('nav-next', { active: false })); await handOff(); return { stickyInMouseMode: s.sticky, scale: s.scale }; });
await row('H8', 'tay: tắt cử chỉ giữa lúc tiến lại (gesture-on bỏ)', async () => { await handOn(); const r = await next(); for (let k = 0; k <= 8; k++) { await T(([x, y]) => window.__t.handAt(x, y), [r.l - 160 + k * 20, r.cy]); await sleep(40); } await sleep(300); await T(() => { window.__t.gesture(false); window.__t.input('mouse'); }); await page.mouse.move(800, 400, { steps: 3 }); await sleep(900); const s = await state('next'); return { handAfterOff: s.hand, scale: s.scale }; });
// ---------- ba đích rê loại trừ nhau: bia · dòng thời gian · mũi tên
await T(() => { let id = 0; window.__handLoop = (x, y) => { clearInterval(id); id = setInterval(() => window.__t.handAt(x, y), 33); }; window.__handStop = () => clearInterval(id); });
const shown = () => T(() => window.__vm.cinemaIdle().shown);
const stelePt = () => T(() => window.__vm.cinemaStelePoint());
async function excl(id, desc, zone) {
  await row(id, desc, async () => {
    await handOn();
    const p = await stelePt();
    await T(([x, y]) => window.__handLoop(x, y), [p.x, p.y]);
    await sleep(1200);
    const onStele = await shown();
    await T((z) => window.__vm.cinemaSticky(z, { rel: { x: 0.5, y: 0.5 } }), zone); // tay vào vùng dính (con trỏ tay vẫn trên bia — tình huống xấu nhất)
    await sleep(500);
    const inZone = await shown();
    await T((z) => { window.__stopSticky(); window.__vm.cinemaSticky(z, { active: false }); }, zone);
    await sleep(40);
    const rightAfter = await shown();
    await sleep(700);
    const back = await shown();
    await T(() => window.__handStop());
    await handOff();
    return { onStele, inZone, rightAfterExit: rightAfter, backOnStele: back, ok: onStele && !inZone && back };
  });
}
await excl('S1', 'tay: rê bia → vào vùng dính dòng thời gian → ra về bia', 'timeline');
await excl('S2', 'tay: rê bia → vào vùng dính mũi tên tới → ra về bia', 'nav-next');
await row('S3', 'chuột: rê bia → lên dòng thời gian → lên mũi tên → về bia', async () => {
  const p = await stelePt();
  await page.mouse.move(p.x - 30, p.y, { steps: 3 }); await page.mouse.move(p.x, p.y, { steps: 3 }); await sleep(700);
  const onStele = await shown();
  const t = await T(() => { const r = window.__vm.cinemaTimeline.tickRect(30); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(t.x, t.y, { steps: 8 }); await sleep(500);
  const onTl = await shown();
  const n = await next();
  await page.mouse.move(n.cx, n.cy, { steps: 8 }); await sleep(500);
  const onArrow = await shown();
  await page.mouse.move(p.x, p.y, { steps: 8 }); await sleep(700);
  const back = await shown();
  await neutral();
  return { onStele, onTimeline: onTl, onArrow, backOnStele: back, ok: onStele && !onTl && !onArrow && back };
});
// ---------- r29: dính → cả mũi tên đi vào gần giữa (--nv-hand-x-*), ra → về mép; kéo camera đi ngang dòng thời gian / mũi tên
const gemX = (d) => T((d) => { const r = document.querySelector(`.cin-nv--${d} .cin-nv__gem`).getBoundingClientRect(); return r.left + r.width / 2; }, d);
for (const [id, dir] of [['H9', 'next'], ['H9b', 'prev']]) {
  await row(id, `tay: dính mũi tên ${dir === 'next' ? 'tới' : 'lùi'} → đi vào gần giữa → ra → về mép`, async () => {
    await handOn();
    const x0 = await gemX(dir);
    await T((d) => window.__vm.cinemaSticky(`nav-${d}`, { rel: { x: 0.5, y: 0.5 } }), dir);
    await sleep(900);
    const x1 = await gemX(dir);
    const st = await state(dir);
    await T((d) => { window.__stopSticky(); window.__vm.cinemaSticky(`nav-${d}`, { active: false }); }, dir);
    await sleep(1100);
    const x2 = await gemX(dir);
    await handOff();
    const fromEdge = (x) => (dir === 'next' ? w - x : x);
    const want = dir === 'next' ? 0.11 * w : 0.12 * w;
    return { restFromEdge: Math.round(fromEdge(x0)), stickyFromEdge: Math.round(fromEdge(x1)), want: Math.round(want), backFromEdge: Math.round(fromEdge(x2)), scale: st.scale, ok: Math.abs(fromEdge(x1) - want) < 8 && Math.abs(x2 - x0) < 1 };
  });
}
const tlOn = () => T(() => { const tl = document.querySelector('.cin-tl'); const m = window.__vm.cinemaTimeline.magnify; return tl.dataset.pop === '1' || tl.dataset.focus === '1' || (m?.hot ?? -1) >= 0; });
const tickPt = (i) => T((i) => { const r = window.__vm.cinemaTimeline.tickRect(i); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
for (const style of ['ruler']) {
  const sfx = '';
  await row('D1' + sfx, `chuột: kéo xoay camera đi ngang dòng thời gian (${style}) + mũi tên`, async () => {
    const t = await tickPt(40); const n = await next();
    await page.mouse.move(700, 420); await page.mouse.down();
    await page.mouse.move(t.x, t.y, { steps: 12 }); await sleep(250);
    const onTl = await tlOn();
    await page.mouse.move(n.cx, n.cy, { steps: 12 }); await sleep(350);
    const s = await state('next');
    await page.mouse.move(900, 380, { steps: 6 }); await page.mouse.up();
    await sleep(300);
    // đối chứng: rê KHÔNG nhấn lên dòng thời gian vẫn hiện thẻ
    await page.mouse.move(t.x, t.y, { steps: 6 }); await sleep(300);
    const plainHover = await tlOn();
    await neutral();
    return { timelineDuringDrag: onTl, arrowScaleDuringDrag: s.scale, arrowRotDuringDrag: s.rotUp, plainHoverStillWorks: plainHover, ok: !onTl && (s.scale === 'none' || +s.scale === 1) && plainHover };
  });
  await row('D2' + sfx, `tay: nhón–kéo camera đi ngang dòng thời gian (${style}) + gần mũi tên`, async () => {
    await handOn();
    const t = await tickPt(40); const n = await next();
    const cv = { x: 700, y: 420 };
    await T(([x, y]) => { const c = document.querySelector('.cin-stage canvas'); c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9001, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, [cv.x, cv.y]);
    const path = async (a, b, k = 12) => { for (let i = 1; i <= k; i++) { const x = a.x + ((b.x - a.x) * i) / k, y = a.y + ((b.y - a.y) * i) / k; await T(([x, y]) => { window.__t.handAt(x, y, { pose: 'pinch' }); const c = document.querySelector('.cin-stage canvas'); c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9001, pointerType: 'mouse', isPrimary: true, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, [x, y]); await sleep(33); } };
    await path(cv, t); await sleep(200);
    const onTl = await tlOn();
    await path(t, { x: n.l - 30, y: n.cy }); await sleep(300);
    const s = await state('next');
    // thả ngoài sân khấu (đích = body; trình duyệt không bao giờ phát pointerup với đích là window)
    await T(([x, y]) => { document.body.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9001, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y, bubbles: true })); }, [n.l - 30, n.cy]);
    // đối chứng: tay mở (không nhón) đi lên dòng thời gian vẫn hiện thẻ
    await T(([x, y]) => window.__t.handAt(x, y), [t.x, t.y]); await sleep(250);
    const plainHand = await tlOn();
    await T(() => window.__t.handAt(960, 300)); await sleep(200);
    await handOff();
    return { timelineDuringPinchDrag: onTl, arrowHandNearDuringDrag: s.hand, arrowScale: s.scale, plainHandStillWorks: plainHand, ok: !onTl && !(+s.hand) && plainHand };
  });
}
// ---------- khác
await row('O2', 'bảng cài đặt mở khi đang rê mũi tên', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); await sleep(500); await T(() => document.querySelector('.cin-gear').click()); await sleep(700); const s = await state('next'); await T(() => document.querySelector('.cin-gear').click()); await neutral(); return { coveredHover: s.hover, scale: s.scale }; });
await row('O3', 'trang bị ẩn (visibility) khi tay đang dính / đang tiến lại', async () => { await handOn(); const r = await next(); await T(([x, y]) => window.__t.handAt(x, y), [r.l - 20, r.cy]); await T(() => window.__vm.cinemaSticky('nav-next', { rel: { x: 0.5, y: 0.5 } })); await sleep(400); await T(() => { window.__stopSticky(); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(400); const s = await state('next'); await T(() => { delete document.visibilityState; delete document.hidden; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await T(() => window.__vm.cinemaSticky('nav-next', { active: false })); await handOff(); return { stickyWhileHidden: s.sticky, handWhileHidden: s.hand }; });
await row('O4', 'cửa sổ mất focus (blur) khi đang rê', async () => { const r = await next(); await page.mouse.move(r.cx, r.cy, { steps: 4 }); await sleep(400); await T(() => window.dispatchEvent(new Event('blur'))); await sleep(300); await neutral(); });


await close();
process.exit(report.finish(errors));
