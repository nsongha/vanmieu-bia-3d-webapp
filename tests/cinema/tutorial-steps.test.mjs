// Hướng dẫn cử chỉ (r32 → r66): mỗi bước là chuỗi VIỆC NHỎ theo trạng thái thật của bàn tay — dòng của việc chỉ hiện khi
// điều kiện của nó đã có (≤ 150 ms), đích hiện CÙNG lúc với dòng, tick (nhịp mừng) sau mỗi việc, dòng sửa khi làm sai, giữ
// dòng khi mất tay (≥ 1 s → "Đưa tay vào khung hình"). r66: bước 1 = khung tròn nét đứt + khung xương sống của tay (hand:skeleton)
// → tay trong khung ~2 s → "Mở rộng cả 5 ngón" → POP → vòng phải (cách tâm khung ~26 % bề ngang) — rời khung: khung xương thu
// thành con trỏ (--hand-skel-cursor) → POP, khung + khung xương ẩn → vòng trái. Chữ xếp chồng 3 dòng (r66b: dòng hiện tại ở
// trên, dòng đã xong đi XUỐNG dưới nó, dòng mới vào từ trên, nhoè → nét / thay tại chỗ / lùi việc: dòng hiện tại lui lên, dòng
// trước đi lên về chỗ; chấm bước + "Bỏ qua" không bị dòng mờ đè); bước 3 "Thả ra" chỉ sau ≥ 1,5 s kéo; bước 4 nắm tay kéo khối trái rồi phải
// (hand:vdrag kind 'fist' tổng hợp); hình động tác = khung xương thật, chỉ chạy lúc hướng dẫn mở. Kèm: chuột (cả bước 4),
// "Bỏ qua" lúc thả, vẫy để bỏ qua, tắt "Nắm tay kéo bia" → 3 bước, tiếng "tạch" dòng thời gian (r32b), chữ không "nhón".
// Tay giả lập bằng hand:frame + hand:skeleton (hợp đồng của lớp cử chỉ). node tests/cinema/tutorial-steps.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('tutorial-steps');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, sound: true } });
await openCinema(page, port, { hooks: ['cinemaTutorial', 'sound'], settleMs: 2000 });
const ts = () => page.evaluate(() => window.__vm.cinemaTutorial.state());
const E = (fn, a) => page.evaluate(fn, a);

// ---- bàn tay tổng hợp (30 khung/s): trạng thái đặt trong window.__H.pos; kèm khung xương (dáng xoè thật của
// src/data/tutorial-hands.json) đặt quanh con trỏ, như lớp cử chỉ gửi (lật gương, 0..1 theo khung camera 3:2)
async function installHand() {
  await E(async () => {
    const H = await (await fetch('/src/data/tutorial-hands.json')).json();
    let id = 0;
    window.__H = {
      pos: { x: 300, y: 300, pose: 'open', seen: false, engaged: false, block: null, open5: true, fp: 0, scale: 0.2 },
      frame() {
        const p = window.__H.pos;
        const eng = p.seen && p.engaged;
        window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: eng, engaged: eng, seen: p.seen, open5: p.seen && p.open5 && p.pose !== 'pinch', engage: p.seen ? { phase: eng ? 'engaged' : p.block ? 'idle' : 'engaging', progress: eng ? 1 : 0, block: eng ? null : p.block } : { phase: 'idle', progress: 0, block: 'none' }, x: p.x, y: p.y, rawX: p.x, rawY: p.y, pose: eng ? p.pose : 'open', fistProgress: p.fp } }));
        if (document.body.dataset.handSkeleton === 'on') {
          const f = H.seqs.fist[0];
          const A = 1.5;
          const cx = p.x / innerWidth;
          const cy = p.y / innerHeight;
          const pts = p.seen ? f.map(([x, y]) => [cx + (x * p.scale) / A, cy + y * p.scale]) : null;
          window.dispatchEvent(new CustomEvent('hand:skeleton', { detail: { pts, aspect: A, locked: true, t: performance.now() } }));
        }
      },
      run() { clearInterval(id); id = setInterval(() => window.__H.frame(), 33); },
      // dừng = tay rời khung (lớp cử chỉ gửi khung "không thấy tay")
      stop() { clearInterval(id); window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false, engaged: false, seen: false, engage: { phase: 'idle', progress: 0, block: 'none' } } })); },
    };
    window.__wait = (fn, ms = 3000) => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (fn()) res(Math.round(performance.now() - t0)); else if (performance.now() - t0 > ms) res(-1); else requestAnimationFrame(tick); }; tick(); });
    window.__vd = (d) => window.dispatchEvent(new CustomEvent('hand:vdrag', { detail: { kind: 'fist', t: performance.now(), ...d } }));
    // r66b: mép trái của chữ dòng hiện tại + số bước + ô hình động tác (không được xê dịch giữa các dòng)
    window.__geo = () => { const r = (el) => el && el.getBoundingClientRect(); const lt = r(document.querySelector('.cin-tut__ln[data-pos="0"] .cin-tut__lt')); const n = r(document.querySelector('.cin-tut__num')); const d = r(document.querySelector('.cin-tut__demoslot')); return { key: window.__vm.cinemaTutorial.state().line, textL: lt ? Math.round(lt.left) : null, numL: n && n.width ? Math.round(n.left) : null, demoL: Math.round(d.left), demoT: Math.round(d.top), demoH: Math.round(d.height) }; };
  });
}
await installHand();
const setH = (p) => E((p) => Object.assign(window.__H.pos, p), p);
/** Đặt trạng thái tay rồi đo ms tới khi dòng = line. */
const act = (p, line, ms = 3000) => E(async ([p, line, ms]) => { Object.assign(window.__H.pos, p); window.__H.frame(); return window.__wait(() => window.__vm.cinemaTutorial.state().line === line, ms); }, [p, line, ms]);
const waitLine = (line, ms = 3000) => E(([line, ms]) => window.__wait(() => window.__vm.cinemaTutorial.state().line === line, ms), [line, ms]);
const center = (sel) => E((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, sel);
const glide = async (x, y, n = 8, each) => { const p0 = await E(() => ({ ...window.__H.pos })); for (let k = 1; k <= n; k++) { await setH({ x: p0.x + ((x - p0.x) * k) / n, y: p0.y + ((y - p0.y) * k) / n }); await sleep(34); if (each) await each(k); } };
const stackOf = () => E(() => [...document.querySelectorAll('.cin-tut__ln')].map((e) => ({ key: e.dataset.key, pos: e.dataset.pos, done: e.dataset.done === '1', op: +getComputedStyle(e).opacity })));
const vd = (d) => E((d) => window.__vd(d), d);
const R = {};
const W = await E(() => innerWidth);
const geo = [];
const sampleGeo = async () => { await sleep(650); geo.push(await E(() => window.__geo())); };

// r68: bàn tay 3D chỉ có lúc hướng dẫn mở (chưa mở lần nào: chưa có bộ vẽ nào)
R.h3 = { before: (await ts()).hand3d };
// ================= bước 1 · tay giơ sẵn TRƯỚC khi mở → "Mở rộng cả 5 ngón" ~2 s sau khi mở (đọc + có mặt), không sớm hơn
await E(() => { Object.assign(window.__H.pos, { seen: true, engaged: true, block: null, open5: true, x: 720, y: 360 }); window.__H.run(); });
await sleep(300);
R.pre = await E(async () => {
  const T = window.__vm.cinemaTutorial;
  T.start('manual');
  const openAt = await window.__wait(() => T.state().line === 'open', 4000);
  return { openAt, lines: T.state().lines.map((x) => x[1]).join(' ') };
});
R.preBeat = await E(() => window.__wait(() => document.querySelector('.cin-tut').dataset.beat === '1', 3000));
await E(() => window.__vm.cinemaTutorial.stop('test')); await sleep(900);

// ================= r69g: bước 1 TỰ NHIÊN — bàn tay đúng chỗ (dưới con trỏ), đúng cỡ (theo xa gần); khung là đích
await E(() => { Object.assign(window.__H.pos, { seen: true, engaged: true, block: null, open5: true, x: 150, y: 200, scale: 0.2 }); });
await E(() => window.__vm.cinemaTutorial.start('manual'));
await sleep(700);
{
  const s = await ts();
  R.nat = { cx: s.skel.cx, cy: s.skel.cy, expX: Math.round(150 + s.fit.ox), expY: Math.round(200 + s.fit.oy), spanPx: Math.round(s.fit.span * s.fit.k), expSpan: Math.round(0.2 * 0.75 * (await E(() => innerHeight))), inside: s.fit.inside, size: s.fit.size, sub: s.sub, fitAttr: await E(() => document.querySelector('.cin-tut').dataset.fit ?? null) };
}
await sleep(2300); // có tay > 2 s nhưng lệch khung → vẫn chưa sang "Mở rộng cả 5 ngón"
R.natStay = { line: (await ts()).line, presenceMs: (await ts()).s1.presenceMs };
R.natFar = { line: await act({ x: 720, y: 330, scale: 0.08 }, 'tooFar', 1000) };
await sleep(500); // (điểm mốc qua bộ lọc One Euro — cỡ ổn định sau một nhịp)
Object.assign(R.natFar, { fit: await E(() => document.querySelector('.cin-tut').dataset.fit ?? null), spanPx: Math.round((await ts()).fit.span * (await ts()).fit.k) });
R.natNear = { line: await act({ scale: 0.32 }, 'tooNear', 1000), fit: await E(() => document.querySelector('.cin-tut').dataset.fit ?? null) };
R.natGood = { open: await act({ scale: 0.2 }, 'open', 2000), fit: await E(() => document.querySelector('.cin-tut').dataset.fit ?? null) };
await E(() => window.__vm.cinemaTutorial.stop('test')); await sleep(900);
await setH({ seen: false, engaged: false });

// ================= bước 1: khung + khung xương → có mặt 2 s → xoè 5 ngón → vòng phải (khung xương → con trỏ) → vòng trái
await setH({ seen: false, engaged: false, x: 720, y: 360 });
await E(() => window.__vm.cinemaTutorial.start('manual'));
await sleep(400);
const a0 = await ts();
await sampleGeo();
R.frame = { line: a0.line, text: a0.lineText, sub: a0.sub, rShown: a0.s1.rShown, lShown: a0.s1.lShown, num: await E(() => document.querySelector('.cin-tut__num').textContent), demo: a0.demo,
  frameOn: a0.s1.frame, frameOp: await E(() => +getComputedStyle(document.querySelector('.cin-tut__frame')).opacity), bodySkel: await E(() => document.body.dataset.handSkeleton ?? null), dots: await E(() => [...document.querySelectorAll('.cin-tut__dots > i')].filter((d) => !d.hidden).length), skel: a0.skel };
// tay xuất hiện (chưa nhận, đang đi) — khung xương hiện TRONG khung; dòng đứng yên (bước này chỉ cần có tay)
const tAppear = await E(() => { Object.assign(window.__H.pos, { seen: true, engaged: false, block: 'moving', x: 700, y: 380 }); window.__H.run(); return performance.now(); });
await sleep(500);
const fc = await center('.cin-tut__frame');
const s05 = await ts();
R.skelIn = { line: s05.line, drawn: s05.skel.drawn, vis: s05.skel.vis, canvas: await E(() => document.querySelector('.cin-tut__skel').dataset.on), d: Math.round(Math.hypot(s05.skel.cx - fc.x, s05.skel.cy - fc.y)), R: Math.round(fc.w / 2), fit: s05.fit };
// mất tay một thoáng (150 ms) không tính là rời; "Mở rộng cả 5 ngón" ~2 s sau lúc tay xuất hiện
await sleep(250); await setH({ seen: false }); await sleep(150); await setH({ seen: true });
R.openAt = await E(([t0]) => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'open', 3000).then(() => Math.round(performance.now() - t0)), [tAppear]);
R.openStack = await stackOf();
await sampleGeo();
R.openSub = (await ts()).sub;
R.openDemo = (await ts()).demo;
// lọt mép (lý do vị trí) → "Giữ yên bàn tay" + "Đưa tay vào giữa khung hình" THAY CHỖ (không thành dòng mới)
R.zone = await act({ block: 'zone' }, 'hold');
R.zoneSub = (await ts()).sub;
R.zoneStack = (await ts()).stack;
// tay chưa mở (closed) → vẫn "Mở rộng cả 5 ngón"; đã nhận mà chưa xoè đủ → không tick
R.closed = await act({ block: 'closed', open5: false }, 'open');
R.engNotOpen = await act({ engaged: true, block: null, open5: false }, 'open');
await sleep(900);
R.engNotOpenStay = { line: (await ts()).line, beat: (await ts()).beat, r: (await ts()).s1.rShown, sub: (await ts()).sub };
// xoè đủ → giữ 0,4 s → POP (tick + chuông, khung loé) → vòng PHẢI + dòng "Đưa tay vào vòng tròn bên phải"
await E(() => window.__vm.sound.clear());
await setH({ open5: true });
R.beatSeen = await E(() => window.__wait(() => document.querySelector('.cin-tut').dataset.beat === '1', 1200));
R.pop = await E(() => ({ frame: document.querySelector('.cin-tut__frame').dataset.pop ?? null, chime: window.__vm.sound.log.some((l) => l.name === 'chime') }));
R.rightAt = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().s1.rShown, 1500));
R.rightSync = await E(() => { const s = window.__vm.cinemaTutorial.state(); return { line: s.line, rShown: s.s1.rShown, lShown: s.s1.lShown, frame: s.s1.frame }; });
const rr = await center('[data-k="r"]');
R.rightPos = { dx: Math.round(rr.x - fc.x), expect: Math.round(0.26 * W), dy: Math.round(rr.y - fc.y) };
await sleep(700);
R.stack3 = await stackOf();
// r68: đang mở — bàn tay 3D (mô hình có xương da) đang vẽ; chi phí mỗi lần vẽ đo trong 1,5 s (đã qua lúc dựng shader)
// r69g: nhịp vẽ của bàn tay sống + hình động tác (1,5 s) — khoảng cách giữa các lần vẽ so với khung rAF
R.smooth = await E(async () => {
  const raf = [];
  let on = true;
  const tick = (t) => { raf.push(t); if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const t0 = performance.now();
  await new Promise((res) => setTimeout(res, 1500));
  on = false;
  const log = window.__vm.cinemaTutorial.state().hand3dLog.filter((e) => e[0] >= t0 + 50);
  const iv = (ts) => ts.slice(1).map((t, i) => t - ts[i]);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
  const frame = med(iv(raf));
  const out = { frame: +frame.toFixed(1) };
  for (const tag of ['live', 'demo']) {
    const ts = log.filter((e) => e[1] === tag).map((e) => e[0]);
    const ms = log.filter((e) => e[1] === tag).map((e) => e[2]).sort((a, b) => a - b);
    out[tag] = { perSec: +(ts.length / 1.45).toFixed(1), gaps: iv(ts).filter((x) => x > 1.5 * frame).length, max: +Math.max(0, ...iv(ts)).toFixed(1), msP95: ms[Math.floor(ms.length * 0.95)] ?? 0 };
  }
  return out;
});
R.h3.during = await E(async () => { const a = window.__vm.cinemaTutorial.state().hand3d; await new Promise((r) => setTimeout(r, 1500)); const b = window.__vm.cinemaTutorial.state().hand3d; return { ...b, winRenders: b.renders - a.renders, winAvgMs: +((b.totalMs - a.totalMs) / Math.max(1, b.renders - a.renders)).toFixed(3) }; });
await sampleGeo();
// r66b: khung tròn rộng hơn (~+50 %): clamp(300px, min(31vw, 50vh), 480px), nằm trên khối chữ
R.frameSize = await E(() => { const f = document.querySelector('.cin-tut__frame').getBoundingClientRect(); const t = document.querySelector('.cin-tut__text').getBoundingClientRect(); return { w: Math.round(f.width), want: Math.round(Math.min(480, Math.max(300, Math.min(innerWidth * 0.31, innerHeight * 0.5)))), bottom: Math.round(f.bottom), textTop: Math.round(t.top) }; });
// rời khung sang vòng phải: khung xương thu dần thành con trỏ (--hand-skel-cursor 0 → 1)
await glide(fc.x, fc.y, 4);
await sleep(300);
const morph = [];
await glide(rr.x - rr.w * 0.9, rr.y, 14, async () => { const s = await ts(); morph.push({ d: Math.round(Math.hypot(s.hand.x - fc.x, s.hand.y - fc.y)), m: s.skel.m, cur: s.skel.cursorVar, vis: s.skel.vis, css: await E(() => document.body.style.getPropertyValue('--hand-skel-cursor')) }); });
await sleep(500);
const mEnd = await ts();
R.morph = { first: morph[0], last: { m: mEnd.skel.m, cur: mEnd.skel.cursorVar, vis: mEnd.skel.vis }, mono: morph.every((x, i) => i === 0 || x.m <= morph[i - 1].m + 0.02), R: fc.w / 2, n: morph.length };
// hợp đồng CSS với lớp cử chỉ: con trỏ tay đang hiện mờ theo --hand-skel-cursor (chế độ ẩn thì không hiện ra)
R.cursorCss = await E(async () => {
  const c = document.querySelector('.hi-cursor');
  if (!c) return { none: true };
  const m0 = c.dataset.mode;
  const off0 = c.dataset.off;
  delete c.dataset.off; // (cài đặt mặc định "Con trỏ tay: Ẩn")
  c.dataset.mode = 'active';
  document.body.style.setProperty('--hand-skel-cursor', '0.3');
  const on = +getComputedStyle(c).opacity;
  c.dataset.mode = 'hidden';
  await new Promise((r) => setTimeout(r, 300));
  const hid = +getComputedStyle(c).opacity;
  if (m0 === undefined) delete c.dataset.mode; else c.dataset.mode = m0;
  if (off0 !== undefined) c.dataset.off = off0;
  return { on, hid };
});
// lướt nhanh qua vòng (≈ 70 ms bên trong) → không tính
await setH({ x: rr.x, y: rr.y }); await sleep(70);
await setH({ x: rr.x + rr.w * 1.2, y: rr.y }); await sleep(250);
R.passNoTick = await E(() => document.querySelector('[data-k="r"]').dataset.sel);
// dừng trong vòng → POP → khung + khung xương ẩn, vòng TRÁI + dòng "Đưa tay sang vòng bên trái"
await setH({ x: rr.x, y: rr.y });
R.rightTick = await E(() => window.__wait(() => document.querySelector('[data-k="r"]').dataset.sel === '1', 800));
R.afterPop = await E(() => ({ frame: document.querySelector('.cin-tut').dataset.frame ?? null, body: document.body.dataset.handSkeleton ?? null, css: document.body.style.getPropertyValue('--hand-skel-cursor') }));
R.leftAt = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().s1.lShown, 1500));
R.leftSync = await E(() => { const s = window.__vm.cinemaTutorial.state(); return { line: s.line, lShown: s.s1.lShown }; });
const ll = await center('[data-k="l"]');
R.leftPos = { dx: Math.round(ll.x - rr.x), expect: Math.round(-0.46 * W) };
// mất tay: giữ dòng < 1 s; ≥ 1 s → "Đưa tay vào khung hình" (thay tại chỗ); quay lại → dòng cũ, đích còn nguyên
await setH({ seen: false, engaged: false }); await sleep(600);
R.lost06 = (await ts()).line;
R.lostAt = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'lost', 1500));
R.lostStack = (await ts()).stack;
R.backLine = await act({ seen: true, engaged: true, x: rr.x + 40, y: rr.y }, 'left');
R.backKept = (await ts()).s1.lShown;
R.unengaged = await act({ engaged: false, block: 'zone' }, 'hold');
R.unengagedSub = (await ts()).sub;
R.reengaged = await act({ engaged: true, block: null }, 'left');
await glide(ll.x, ll.y, 8);
R.step2At = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().step === 2, 2000));
const s2 = await ts();
R.step2 = { line: s2.line, aShown: s2.s2.aShown, bShown: s2.s2.bShown, dots: await E(() => [...document.querySelectorAll('.cin-tut__dots > i')].map((d) => d.dataset.state).join(',')) };

// ================= bước 2: vòng thứ nhất → chạm → thả → tick → vòng thứ hai (+ chồng dòng lúc chuyển, hình động tác)
const ra = await center('[data-k="a"]');
await setH({ x: ra.x, y: ra.y + ra.w * 2.2 }); await sleep(900);
R.toRing = (await ts()).line;
await sampleGeo();
R.outside = await act({ pose: 'pinch' }, 'hOutside');
geo.push(await E(() => new Promise((res) => setTimeout(() => res(window.__geo()), 300))));
R.outsideStack = (await ts()).stack.at(-1);
await setH({ pose: 'open' });
R.outsideBack = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'toRing', 2500));
await sleep(700);
// đẩy dòng: đo GIỮA chuyển tiếp (~150 ms) rồi lúc đã đứng
const mid = await E(async () => {
  const P = window.__H.pos;
  const r = document.querySelector('[data-k="a"]').getBoundingClientRect();
  Object.assign(P, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  window.__H.frame();
  await window.__wait(() => window.__vm.cinemaTutorial.state().line === 'touch', 500);
  await new Promise((res) => setTimeout(res, 200));
  const q = (el) => { const cs = getComputedStyle(el); const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform); return { key: el.dataset.key, pos: el.dataset.pos, op: +(+cs.opacity).toFixed(2), blur: parseFloat((cs.filter.match(/blur\(([\d.]+)px\)/) || [0, 0])[1]), ty: Math.round(m.m42), sc: +m.a.toFixed(2) }; };
  return [...document.querySelectorAll('.cin-tut__ln')].map(q);
});
R.midPush = mid;
await sleep(700);
R.settled = await E(() => [...document.querySelectorAll('.cin-tut__ln')].map((el) => { const cs = getComputedStyle(el); const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform); const ml = new DOMMatrix(getComputedStyle(el.querySelector('.cin-tut__lt')).transform.replace('none', 'matrix(1,0,0,1,0,0)')); const tk = el.querySelector('.cin-tut__lnok').getBoundingClientRect(); const lt = el.querySelector('.cin-tut__lt').getBoundingClientRect(); return { key: el.dataset.key, pos: el.dataset.pos, op: +(+cs.opacity).toFixed(2), blur: cs.filter, ty: Math.round(m.m42), sc: +ml.a.toFixed(2), done: el.dataset.done === '1', tickR: Math.round(tk.right), tickCY: Math.round(tk.top + tk.height / 2), top: Math.round(lt.top), bottom: Math.round(lt.bottom), textR: Math.round(lt.right) }; }));
geo.push(await E(() => window.__geo()));
// r66b: bố cục đứng — số bước trên dòng hiện tại; dòng phụ ngay dưới; hai dòng mờ bên dưới; chấm bước dưới cả hai, "Bỏ qua" không đè
R.layout = await E(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
  const ln = (pos) => { const el = document.querySelector(`.cin-tut__ln[data-pos="${pos}"] .cin-tut__lt`); return el ? r(el) : null; };
  const sub = document.querySelector('.cin-tut__sub');
  const col = r(document.querySelector('.cin-tut__col'));
  // không có dòng của việc SẮP TỚI chờ sẵn: mọi phần tử dòng phía trên dòng hiện tại đều đã tắt
  const curTop = document.querySelector('.cin-tut__ln[data-pos="0"]').getBoundingClientRect().top;
  const above = [...document.querySelectorAll('.cin-tut__ln')].filter((el) => el.getBoundingClientRect().bottom <= curTop + 2).map((el) => ({ key: el.dataset.key, pos: el.dataset.pos, op: +(+getComputedStyle(el).opacity).toFixed(2) }));
  return { num: r(document.querySelector('.cin-tut__num')), cur: ln('0'), sub: r(sub), subText: sub.textContent, p1: ln('1'), p2: ln('2'), dots: r(document.querySelector('.cin-tut__dots')), skip: r(document.querySelector('.cin-tut__skip')), hint: r(document.querySelector('.cin-tut__wavehint')), col, demo: r(document.querySelector('.cin-tut__demoslot')), above };
});
// chữ dài xuống dòng trong cột (thu hẹp cột tạm thời): căn trái, không vượt mép cột, dòng phụ + mục bên dưới lùi theo
R.wrap = await E(async () => {
  const root = document.querySelector('.cin-tut');
  root.style.setProperty('--col-w', '260px');
  window.dispatchEvent(new Event('resize')); // (tutorial.js tính lại vị trí dọc khi đổi cỡ)
  await new Promise((r) => setTimeout(r, 900));
  const r = (el) => el.getBoundingClientRect();
  const ltEl = document.querySelector('.cin-tut__ln[data-pos="0"] .cin-tut__lt');
  const cur = r(ltEl);
  const lh = parseFloat(getComputedStyle(ltEl).lineHeight);
  const col = r(document.querySelector('.cin-tut__col'));
  const sub = r(document.querySelector('.cin-tut__sub'));
  const p1 = document.querySelector('.cin-tut__ln[data-pos="1"] .cin-tut__lt');
  const res = { text: ltEl.textContent, rows: Math.round(cur.height / lh), curL: Math.round(cur.left), curR: Math.round(cur.right), colL: Math.round(col.left), colR: Math.round(col.right), curBottom: Math.round(cur.bottom), subTop: Math.round(sub.top), subBottom: Math.round(sub.bottom), p1Top: p1 ? Math.round(r(p1).top) : null, ellipsis: getComputedStyle(ltEl).textOverflow };
  root.style.removeProperty('--col-w');
  window.dispatchEvent(new Event('resize'));
  await new Promise((r) => setTimeout(r, 700));
  return res;
});
// hình động tác "chạm ngón cái vào ngón trỏ": khung xương thật đang chạy trên canvas của dòng hiện tại
R.demo = await E(async () => {
  const T = window.__vm.cinemaTutorial;
  const f0 = T.state().demoRun.frames;
  await new Promise((r) => setTimeout(r, 500));
  const cv = document.querySelector('.cin-tut__demoslot .cin-tut__demo[data-on="1"]');
  let lit = 0;
  if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) lit++; }
  return { kind: T.state().demo, perSec: (T.state().demoRun.frames - f0) * 2, lit, w: cv?.clientWidth ?? 0 };
});
// lùi việc: rời vòng lúc sắp chạm → dòng "Chạm…" lui lên rồi tắt, "Đưa tay vào vòng tròn" đi lên về chỗ
await setH({ x: ra.x, y: ra.y + ra.w * 2.2 });
R.unpush = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'toRing', 800));
R.unpushStack = await stackOf();
R.touchAt = await act({ x: ra.x, y: ra.y }, 'touch');
R.releaseAt = await act({ pose: 'pinch' }, 'release');
await sleep(120);
await setH({ pose: 'open' });
R.aTick = await E(() => window.__wait(() => document.querySelector('[data-k="a"]').dataset.sel === '1', 600));
R.bAt = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().s2.bShown, 1500));
R.bSync = (await ts()).line;
const rb = await center('[data-k="b"]');
R.touchB = await act({ x: rb.x, y: rb.y }, 'touchB');
// chạm rồi kéo đi → "Giữ tay yên khi chạm", không chọn
await setH({ pose: 'pinch' }); await sleep(100);
await glide(rb.x + W * 0.2, rb.y, 6);
R.moved = (await ts()).line;
await setH({ pose: 'open' }); await sleep(1800);
// chạm giữ quá lâu → "Thả nhanh hơn"
await glide(rb.x, rb.y, 6); await sleep(100);
await setH({ pose: 'pinch' });
R.long = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'hLong', 2200));
await setH({ pose: 'open' }); await sleep(250);
R.longNoSel = await E(() => document.querySelector('[data-k="b"]').dataset.sel);
await sleep(1700);
await setH({ pose: 'pinch' }); await sleep(150); await setH({ pose: 'open' });
R.step3At = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().step === 3, 2000));

// ================= bước 3: khối — chạm giữ → kéo (≥ 1,5 s mới "Thả ra") → thả (hai lượt)
const cu = await center('.cin-tut__cubewrap');
await setH({ x: cu.x, y: cu.y + cu.w * 1.2 }); await sleep(150);
R.toCube = (await ts()).line;
R.cubeOutside = await act({ pose: 'pinch' }, 'hCube');
await setH({ pose: 'open' }); await sleep(1800);
R.grabAt = await act({ x: cu.x, y: cu.y }, 'grab');
R.grabSub = (await ts()).sub;
R.dragAt = await act({ pose: 'pinch' }, 'drag');
await glide(cu.x + 25, cu.y, 4); // ≈ 10° < 20°
R.small = await act({ pose: 'open' }, 'hSmall');
await sleep(1700);
await glide(cu.x, cu.y, 4);
const tDrag = await E(() => { window.__H.pos.pose = 'pinch'; window.__H.frame(); return performance.now(); });
await sleep(60);
await glide(cu.x + 150, cu.y, 6); // xoay đủ trong ~0,3 s
R.earlyLet = { line: (await ts()).line, rot: Math.round((await ts()).s3.dragRot), ms: (await ts()).s3.dragMs };
R.letAt = await E(([t0]) => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'let', 2500).then(() => Math.round(performance.now() - t0)), [tDrag]);
await setH({ pose: 'open' });
R.turn1 = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().s3.turns === 1, 800));
const c1 = await ts();
R.turn1Cube = { rx: Math.round(c1.s3.rx), ry: Math.round(c1.s3.ry) };
await sleep(600);
await glide(cu.x, cu.y, 4); await sleep(100);
R.grab2 = { line: (await ts()).line, sub: (await ts()).sub };
await setH({ pose: 'pinch' }); await sleep(100);
R.drag2 = { line: (await ts()).line, demo: (await ts()).demo };
await glide(cu.x + 150, cu.y, 8);
R.drag2Side = { line: (await ts()).line, rx: Math.round((await ts()).s3.rx), ry: Math.round((await ts()).s3.ry) };
R.small2 = await act({ pose: 'open' }, 'hSmall2');
await sleep(1700);
// lượt 2: kéo lên xuống đủ rồi thả SỚM (trước 1,5 s) — vẫn tính; "Thả ra" chưa kịp hiện
await glide(cu.x, cu.y, 4); await setH({ pose: 'pinch' }); await sleep(100);
await glide(cu.x, cu.y + 150, 8);
const c2 = await ts();
R.vert = { line: c2.line, rx: Math.round(c2.s3.rx), ry: Math.round(c2.s3.ry), ms: c2.s3.dragMs };
await setH({ pose: 'open' });
R.step4At = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().step === 4, 2000));

// ================= bước 4: nắm tay kéo khối sang trái, thả, nắm lại kéo sang phải, thả
await sleep(300);
const s4a = await ts();
await sampleGeo();
R.s4 = { line: s4a.line, demo: s4a.demo, fistTut: await E(() => document.body.dataset.handFistTut ?? null), num: await E(() => document.querySelector('.cin-tut__num').textContent), chev: await E(() => getComputedStyle(document.querySelector('.cin-tut__chev[data-d="l"]')).color !== getComputedStyle(document.querySelector('.cin-tut__chev[data-d="r"]')).color) };
const fw = await center('.cin-tut__fwrap');
await setH({ x: fw.x, y: fw.y + 60 }); await sleep(100);
// nắm mà lớp cử chỉ không cho cầm (chưa xoè trước) → "Xoè cả 5 ngón trước, rồi nắm lại"
R.hFist = await act({ pose: 'pinch', fp: 1 }, 'hFist', 1500);
await setH({ pose: 'open', fp: 0 }); await sleep(1800);
// r66b: dịch ngang nằm ở KHUNG CẢNH (.cin-tut__fwrap — nơi đặt perspective); khối chỉ quay
const fx = () => E(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.cin-tut__fwrap')).transform); return Math.round(m.m41); });
/** Vật đang ở giữa + đúng 3D lúc này: khối không mang độ mờ / không bị làm phẳng; dịch + mờ ở khung cảnh. */
const obj3d = () => E(() => {
  const f = document.querySelector('.cin-tut__fcube');
  const w = document.querySelector('.cin-tut__fwrap');
  const cf = getComputedStyle(f);
  const cw = getComputedStyle(w);
  const mf = new DOMMatrix(cf.transform === 'none' ? undefined : cf.transform);
  const mw = new DOMMatrix(cw.transform === 'none' ? undefined : cw.transform);
  return { shape: f.dataset.shape, sides: f.querySelectorAll('.cin-tut__face').length, caps: f.querySelectorAll('.cin-tut__pcap polygon').length, fOp: +cf.opacity, fTs: cf.transformStyle, fFilter: cf.filter, fTx: Math.round(mf.m41), wOp: +(+cw.opacity).toFixed(2), wTx: Math.round(mw.m41), wTs: cw.transformStyle, persp: cw.perspective };
});
await vd({ phase: 'start', x: 0.5 }); await sleep(80);
R.pullL = { line: (await ts()).line, grab: (await ts()).s4.grab, held: await E(() => document.querySelector('.cin-tut__fwrap').dataset.held) };
// sai chiều (sang phải): khối chỉ nhích một chút (dây chun), không trượt đi
for (let k = 1; k <= 6; k++) { await vd({ phase: 'move', x: 0.5 + 0.03 * k }); await sleep(30); }
R.wrongWay = { off: (await ts()).s4.off, snaps: (await ts()).s4.snaps, max: Math.round(0.06 * W) };
// sang trái một đoạn (chưa đủ) rồi thả → khối bật về, "Kéo xa hơn rồi mới thả", lùi về "Xoè tay rồi nắm lại…"
for (let k = 1; k <= 6; k++) { await vd({ phase: 'move', x: 0.5 - 0.012 * k }); await sleep(30); }
await sleep(60);
R.partial = { off: (await ts()).s4.off, cubeX: await fx() };
await vd({ phase: 'end', x: 0.428 });
R.far = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'hFar', 600));
await sleep(500);
R.farState = { base: (await ts()).base, off: (await ts()).s4.off, springs: (await ts()).s4.springs, cubeX: await fx() };
await sleep(1300);
// nắm lại, kéo đủ sang trái → khối trượt đi (tick), "Thả tay ra"; thả → tick → "Nắm lại, kéo sang phải"
await E(() => window.__vm.sound.clear());
await vd({ phase: 'start', x: 0.5 }); await sleep(60);
R.shape0 = await obj3d();
for (let k = 1; k <= 10; k++) { await vd({ phase: 'move', x: 0.5 - 0.015 * k }); await sleep(30); }
R.out3d = await obj3d(); // giữa lúc vật trượt đi
R.snapL = { line: await waitLine('openF', 800) >= 0 ? 'openF' : (await ts()).line, snaps: (await ts()).s4.snaps, tok: await E(() => window.__vm.sound.log.filter((l) => l.name === 'tok').length) };
await sleep(900);
await vd({ phase: 'end', x: 0.35 });
R.toR = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'grabF2', 1500));
R.shape1 = await obj3d();
R.rState = { phase: (await ts()).s4.phase, cubeX: await fx(), stack: (await stackOf()).filter((l) => ['0', '1', '2'].includes(l.pos)).map((l) => l.key).join(' ') };
await vd({ phase: 'start', x: 0.4 }); await sleep(60);
R.grabR = (await ts()).line;
for (let k = 1; k <= 10; k++) { await vd({ phase: 'move', x: 0.4 + 0.015 * k }); await sleep(30); }
R.snapR = await waitLine('openF2', 800);
await sleep(700);
R.shape2 = await obj3d();
R.shapes = (await ts()).s4.shapes;
await vd({ phase: 'end', x: 0.55 });
R.doneAt = await E(() => window.__wait(() => window.__vm.cinemaTutorial.state().line === 'done', 1500));
R.end = await E(() => ({ text: window.__vm.cinemaTutorial.state().lineText, fistTut: document.body.dataset.handFistTut ?? null, dots: [...document.querySelectorAll('.cin-tut__dots > i')].map((d) => d.dataset.state).join(',') }));
await sleep(2800);
R.closed = !(await ts()).active;
const lines = (await ts()).lines.map((x) => x[1]);
R.lines = lines.join(' ');
{
  // dòng việc chỉ hiện ngay sau dòng điều kiện của nó (dòng sửa / "Giữ yên" / "khung hình" có thể chen giữa việc đang chờ)
  const PRE = { open: ['frame', 'hold'], right: ['open', 'hold'], release: ['touch'], releaseB: ['touchB'], drag: ['grab'], drag2: ['grab2'], let: ['drag'], let2: ['drag2'], touch: ['toRing', 'hLong', 'hMoved', 'hOutside', 'release'], touchB: ['toRing2', 'hLong', 'hMoved', 'hOutside', 'releaseB'], grab: ['toCube', 'hCube', 'hSmall', 'drag'], pullL: ['grabF', 'hFist', 'hFar', 'hPinchF'], openF: ['pullL'], grabF2: ['openF'], openF2: ['grabF2'], done: ['openF2'] };
  const bad = [];
  lines.forEach((k, i) => { if (PRE[k] && !PRE[k].includes(lines[i - 1])) bad.push(`${lines[i - 1]}→${k}`); });
  const first = (k) => lines.indexOf(k);
  const order = ['frame', 'open', 'right', 'left', 'toRing', 'toRing2', 'toCube', 'grabF', 'pullL', 'openF', 'grabF2', 'openF2', 'done'];
  if (!order.every((k, i) => i === 0 || first(order[i - 1]) < first(k))) bad.push('thứ tự việc');
  R.order = bad;
}
await E(() => window.__H.stop());
R.h3.after = (await ts()).hand3d;
// hình động tác chỉ chạy lúc hướng dẫn mở
R.demoAfter = await E(async () => { const a = window.__vm.cinemaTutorial.state().demoRun; await new Promise((r) => setTimeout(r, 600)); const b = window.__vm.cinemaTutorial.state().demoRun; return { a: a.frames, b: b.frames, loop: b.loop }; });
// lớp cử chỉ tắt giữa chừng (hand:active false) → không giữ tay "đã nhận" cũ
await E(() => { window.__vm.cinemaTutorial.start('manual'); Object.assign(window.__H.pos, { seen: true, engaged: true, x: 500, y: 400, pose: 'open' }); window.__H.frame(); });
await sleep(100);
const ha0 = (await ts()).hand.engaged;
await E(() => window.dispatchEvent(new CustomEvent('hand:active', { detail: { active: false } })));
await sleep(50);
R.handOff = { before: ha0, after: (await ts()).hand.engaged };
// dừng giữa bước 4 → gỡ data-hand-fist-tut + data-hand-skeleton
await E(() => window.__vm.cinemaTutorial.stop('test')); await sleep(900);
R.stopClean = await E(() => ({ skel: document.body.dataset.handSkeleton ?? null, fist: document.body.dataset.handFistTut ?? null, css: document.body.style.getPropertyValue('--hand-skel-cursor') }));

// ================= chuột (không đòi giơ tay) — cả bước 4 (nhấn giữ khối, kéo sang bên)
await E(() => window.__vm.cinemaTutorial.start('manual')); await sleep(500);
await page.mouse.move(420, 360, { steps: 4 }); await sleep(2000);
const m0 = await ts();
const mr = await center('[data-k="r"]');
await page.mouse.move(mr.x, mr.y, { steps: 6 }); await sleep(900);
const ml = await center('[data-k="l"]');
const m1 = await ts();
await page.mouse.move(ml.x, ml.y, { steps: 8 }); await sleep(1300);
const m2 = await ts();
const ma = await center('[data-k="a"]');
await page.mouse.move(ma.x, ma.y, { steps: 4 }); await page.mouse.down(); await sleep(100);
const mDown = await E(() => document.querySelector('[data-k="a"]').dataset.press);
await page.mouse.up(); await sleep(900);
const mb = await center('[data-k="b"]');
await page.mouse.click(mb.x, mb.y); await sleep(1100);
const m3 = await ts();
const mc = await center('.cin-tut__cubewrap');
for (const [dx, dy] of [[150, 0], [0, 150]]) { await page.mouse.move(mc.x, mc.y); await page.mouse.down(); await page.mouse.move(mc.x + dx, mc.y + dy, { steps: 10 }); await page.mouse.up(); await sleep(700); }
const m4 = await ts();
await sleep(500);
const mf = await center('.cin-tut__fwrap');
for (const dx of [-0.16 * W, 0.16 * W]) { await page.mouse.move(mf.x, mf.y); await page.mouse.down(); await page.mouse.move(mf.x + dx, mf.y, { steps: 12 }); await sleep(150); await page.mouse.up(); await sleep(1300); }
const m5 = await ts();
R.mouse = { frameSkipped: m0.s1.rShown && m0.line === 'right', left: m1.s1.lShown, step2: m2.step === 2, press: mDown === '1', step3: m3.step === 3, step4: m4.step === 4, done: m5.line === 'done' || !m5.active };
await sleep(3000);

// ================= "Bỏ qua" bằng tay (chạm → lún, thả → đóng)
await E(() => { window.__vm.cinemaTutorial.start('manual'); Object.assign(window.__H.pos, { seen: true, engaged: true, x: 700, y: 400, pose: 'open' }); window.__H.run(); }); await sleep(500);
const sk = await center('.cin-tut__skip');
await glide(sk.x, sk.y, 10); await setH({ pose: 'pinch' }); await sleep(150);
const k1 = await ts(); const skPress = await E(() => document.querySelector('.cin-tut__skip').dataset.press);
await setH({ pose: 'open' }); await sleep(250);
const k2 = await ts();
R.skip = { stillOpen: k1.active, pressed: skPress === '1', closes: !k2.active };
await E(() => window.__H.stop());

// ================= chữ cho khách: không "nhón"
R.noNhon = await E(() => {
  const hits = [...document.querySelectorAll('.cin-tut, .cin-tl, .cin-nv, .cin-rub, [class*="cin-rub"]')].flatMap((e) => [e, ...e.querySelectorAll('*')]).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /nhón/i.test(n.textContent))).map((e) => `${e.className} :: ${e.textContent.slice(0, 100)}`);
  return hits;
});

// ================= tắt "Nắm tay kéo bia" → hướng dẫn 3 bước (không dạy nắm tay)
await E(() => window.__vm.settings.set('fistGrab', false));
await E(() => window.__vm.cinemaTutorial.start('manual')); await sleep(400);
R.three = { steps: (await ts()).steps, num: await E(() => document.querySelector('.cin-tut__num').textContent), dots: await E(() => [...document.querySelectorAll('.cin-tut__dots > i')].filter((d) => !d.hidden).length) };
await E(() => window.__vm.cinemaTutorial.stop('test')); await sleep(800);
await E(() => window.__vm.settings.set('fistGrab', true));

// ================= r32b: vẫy tay để bỏ qua
await E(() => window.__vm.cinemaTutorial.start('manual')); await sleep(600);
const wv = (d) => E((d) => window.dispatchEvent(new CustomEvent('hand:wave', { detail: d })), d);
const body0 = await E(() => document.body.dataset.handWave ?? null);
await wv({ progress: 0.3 }); await sleep(60); await wv({ progress: 0.6 }); await sleep(60);
const w1 = (await ts()).wave;
await sleep(1200);
const w2 = (await ts()).wave;
await wv({ progress: 0.8 }); await sleep(60); await wv({ done: true }); await sleep(300);
const s3w = await ts();
R.wave = { body: body0, at06: w1, afterStop: w2, closed: s3w.active === false, bodyAfter: await E(() => document.body.dataset.handWave ?? null) };
await sleep(800);

// ================= "tạch" dòng thời gian (hand:sticky timeline + focus)
await E(() => { document.body.classList.add('gesture-on'); document.body.dataset.input = 'hand'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'hand' } })); });
await E(() => window.__vm.sound.clear());
const stk = (d) => E((d) => window.dispatchEvent(new CustomEvent('hand:sticky', { detail: { name: 'timeline', active: true, rel: { x: 0.5, y: 0.5 }, pinch: false, focusFrozen: false, t: performance.now(), ...d } })), d);
const ticks = () => E(() => window.__vm.sound.log.filter((l) => l.name === 'tick'));
const out = {};
for (let f = 10; f <= 14; f++) { await stk({ focus: f }); await sleep(120); }
let t = await ticks(); out.slow = { played: t.filter((l) => l.played).length, want: 4 };
await E(() => window.__vm.sound.clear());
for (let f = 15; f <= 34; f++) { await stk({ focus: f }); await sleep(10); }
t = await ticks(); out.fast = { changes: 20, played: t.filter((l) => l.played).length, skippedGap: t.filter((l) => l.skipped === 'gap').length };
await E(() => window.__vm.sound.clear());
await sleep(300);
for (let f = 35; f <= 38; f++) { await stk({ focus: f, pinch: true }); await sleep(80); }
await stk({ focus: 39, focusFrozen: true }); await sleep(80);
await stk({ focus: 40 }); await sleep(100);
t = await ticks(); out.pinch = { played: t.filter((l) => l.played).length };
await sleep(400);
await stk({ focus: 41 }); await sleep(80);
t = await ticks(); out.afterPinchSettled = { played: t.filter((l) => l.played).length };
await E(() => window.__vm.sound.clear());
await E(() => { document.body.dataset.input = 'mouse'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'mouse' } })); });
for (let f = 42; f <= 45; f++) { await stk({ focus: f }); await sleep(100); }
t = await ticks(); out.mouse = { played: t.filter((l) => l.played).length };
await E(() => window.dispatchEvent(new CustomEvent('hand:sticky', { detail: { name: 'timeline', active: false } })));
R.tick = out;
const errs1 = [...errors];
await close();

// ================= giảm chuyển động: chồng dòng chỉ mờ chéo (không trượt, không nhoè), hình động tác đứng yên
{
  const b = await launch({ headed, reducedMotion: true, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, sound: false } });
  await openCinema(b.page, port, { hooks: ['cinemaTutorial'], settleMs: 1500 });
  const E2 = (fn, a) => b.page.evaluate(fn, a);
  R.rm = await E2(async () => {
    const T = window.__vm.cinemaTutorial;
    const fire = (p) => window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, seen: true, open5: true, engage: { phase: 'engaged', progress: 1, block: null }, x: 720, y: 360, rawX: 720, rawY: 360, pose: 'open', ...p } }));
    // (r69g: kèm khung xương — bước 1 cần biết tay ở giữa khung + cỡ vừa)
    const Hs = await (await fetch('/src/data/tutorial-hands.json')).json();
    const skel = () => { if (document.body.dataset.handSkeleton !== 'on') return; const pts = Hs.seqs.fist[0].map(([x, y]) => [720 / innerWidth + (x * 0.2) / 1.5, 360 / innerHeight + y * 0.2]); window.dispatchEvent(new CustomEvent('hand:skeleton', { detail: { pts, aspect: 1.5, locked: true, t: performance.now() } })); };
    const id = setInterval(() => { fire({}); skel(); }, 33);
    T.start('manual');
    const wait = (fn, ms) => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (fn()) res(true); else if (performance.now() - t0 > ms) res(false); else requestAnimationFrame(tick); }; tick(); });
    await wait(() => T.state().line === 'open', 4000);
    await new Promise((r) => setTimeout(r, 120));
    const q = (el) => { const cs = getComputedStyle(el); const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform); return { key: el.dataset.key, pos: el.dataset.pos, op: +(+cs.opacity).toFixed(2), blur: cs.filter, ty: Math.round(m.m42) }; };
    const midLines = [...document.querySelectorAll('.cin-tut__ln')].map(q);
    await new Promise((r) => setTimeout(r, 600));
    const f0 = T.state().demoRun.frames;
    await new Promise((r) => setTimeout(r, 500));
    const cv = document.querySelector('.cin-tut__demoslot .cin-tut__demo[data-on="1"]');
    let lit = 0;
    if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) lit++; }
    const res = { midLines, rm: T.state().demoRun.rm, demoFrames: T.state().demoRun.frames - f0, lit };
    clearInterval(id);
    T.stop('test');
    return res;
  });
  errs1.push(...b.errors);
  await b.close();
}

// ---------------------------------------------------------------------------- kiểm
const fast = (ms) => ms >= 0 && ms <= 150;
report.section('bước 1 · khung tròn + khung xương sống của tay');
report.check('mở: "Đưa một bàn tay vào khung" (+ "lòng bàn tay hướng về màn hình"), khung tròn nét đứt hiện, chưa có vòng, "Bước 1 / 4" (4 chấm), không hình động tác, body[data-hand-skeleton="on"]',
  R.frame.line === 'frame' && R.frame.text === 'Đưa một bàn tay vào khung' && R.frame.sub === 'lòng bàn tay hướng về màn hình' && R.frame.frameOn && R.frame.frameOp > 0.9 && !R.frame.rShown && !R.frame.lShown && /Bước 1 \/ 4/.test(R.frame.num) && R.frame.dots === 4 && R.frame.demo === '' && R.frame.bodySkel === 'on', R.frame);
report.check('thấy tay (chưa nhận) ở giữa khung, cỡ vừa → bàn tay vẽ trong khung (canvas bật), dòng không đổi', R.skelIn.line === 'frame' && R.skelIn.drawn > 5 && R.skelIn.vis > 0.5 && R.skelIn.canvas === '1' && R.skelIn.fit?.inside && R.skelIn.fit?.size === 'good', R.skelIn);
report.check('r69g: bàn tay TỰ NHIÊN — lệch khung thì vẽ đúng chỗ (tâm lòng bàn tay = con trỏ + độ lệch điểm neo → tâm lòng bàn tay, ±3 px; không kéo vào khung), cỡ = cỡ trong khung camera (cổ tay → gốc ngón giữa = 0,2 × 0,75 bề cao màn hình — hằng số); khung không sáng hẳn, dòng phụ "đưa bàn tay vào giữa vòng tròn"', Math.abs(R.nat.cx - R.nat.expX) <= 3 && Math.abs(R.nat.cy - R.nat.expY) <= 3 && Math.abs(R.nat.spanPx - R.nat.expSpan) <= 2 && !R.nat.inside && R.nat.size === 'good' && R.nat.fitAttr === 'good' && R.nat.sub === 'đưa bàn tay vào giữa vòng tròn', R.nat);
report.check('r69g: có tay > 2 s mà lệch khung → vẫn "Đưa một bàn tay vào khung"', R.natStay.line === 'frame' && R.natStay.presenceMs > 2000, R.natStay);
report.check('r69g: xa quá (cỡ 0,08) → "Lại gần hơn một chút" (bàn tay nhỏ lại đúng tỉ lệ); gần quá (0,32) → "Lùi ra xa một chút"', R.natFar.line >= 0 && R.natFar.fit === 'far' && Math.abs(R.natFar.spanPx - Math.round(0.08 * 0.75 * 900)) <= 2 && R.natNear.line >= 0 && R.natNear.fit === 'near', { far: R.natFar, near: R.natNear });
report.check('r69g: vào giữa khung, cỡ vừa → khung sáng hẳn (data-fit "in"), rồi "Mở rộng cả 5 ngón" (≥ 0,6 s ở yên đó)', R.natGood.open >= 450 && R.natGood.open <= 1200 && R.natGood.fit === 'in', R.natGood);
report.check('có tay ~2 s (mất tay 150 ms không tính) → "Mở rộng cả 5 ngón" (1,9–2,3 s); dòng cũ xuống dưới, có tick', R.openAt >= 1900 && R.openAt <= 2300 && R.openStack.some((l) => l.key === 'frame' && l.pos === '1' && l.done) && R.openStack.some((l) => l.key === 'open' && l.pos === '0'), { ms: R.openAt, stack: R.openStack });
report.check('"Mở rộng cả 5 ngón" (hình động tác "open"): tay đang đi → dòng việc giữ nguyên, lý do ở dòng phụ "Giữ yên thêm chút nữa"; đã nhận → "xoè rộng các ngón, cả ngón cái"', R.openSub === 'Giữ yên thêm chút nữa' && R.openDemo === 'open' && R.engNotOpenStay.sub === 'xoè rộng các ngón, cả ngón cái', { sub: R.openSub, subEngaged: R.engNotOpenStay.sub, demo: R.openDemo });
report.check('tay giơ sẵn trước khi mở → "Mở rộng cả 5 ngón" ~2 s sau khi mở (không sớm hơn), rồi tick sau ≥ 0,9 s đọc', R.pre.openAt >= 1950 && R.pre.openAt <= 2300 && R.pre.lines === 'frame open' && R.preBeat >= 850 && R.preBeat <= 1300, { ...R.pre, beatAfterOpen: R.preBeat });
report.check('lọt mép → "Giữ yên bàn tay" + "Đưa tay vào giữa khung hình" THAY CHỖ dòng (vẫn 2 dòng, việc vẫn "open")', fast(R.zone) && R.zoneSub === 'Đưa tay vào giữa khung hình' && R.zoneStack.length === 2 && R.zoneStack.at(-1).base === 'open' && R.zoneStack.at(-1).key === 'hold', { ms: R.zone, sub: R.zoneSub, stack: R.zoneStack });
report.check('tay chưa mở / đã nhận mà chưa xoè đủ → vẫn "Mở rộng cả 5 ngón", không tick, không vòng', fast(R.closed) && fast(R.engNotOpen) && R.engNotOpenStay.line === 'open' && !R.engNotOpenStay.beat && !R.engNotOpenStay.r, { closed: R.closed, eng: R.engNotOpen, ...R.engNotOpenStay });
report.check('xoè đủ → POP sau ~0,4 s (khung loé + chuông), rồi vòng PHẢI cùng dòng "Đưa tay vào vòng tròn bên phải"; khung còn', R.beatSeen >= 350 && R.beatSeen <= 600 && R.pop.frame === '1' && R.pop.chime && R.rightAt >= 300 && R.rightSync.line === 'right' && R.rightSync.rShown && !R.rightSync.lShown && R.rightSync.frame, { beat: R.beatSeen, pop: R.pop, at: R.rightAt, sync: R.rightSync });
report.check('vòng phải cách TÂM KHUNG ~26 % bề ngang, cùng độ cao', Math.abs(R.rightPos.dx - R.rightPos.expect) < 3 && Math.abs(R.rightPos.dy) < 3, R.rightPos);
report.check('3 dòng: "right" (0) · "open" (1, tick) · "frame" (2, tick) — mờ dần xuống dưới', R.stack3.filter((l) => ['0', '1', '2'].includes(l.pos)).map((l) => `${l.key}:${l.pos}`).join(' ') === 'frame:2 open:1 right:0' && R.stack3.find((l) => l.pos === '1').op < 0.6 && R.stack3.find((l) => l.pos === '2').op < R.stack3.find((l) => l.pos === '1').op, R.stack3);
report.check('rời khung: khung xương thu dần thành con trỏ — trong khung m≈1 / con trỏ ẩn; ra khỏi khung m→0, --hand-skel-cursor→1, giảm đều', R.morph.first.m > 0.9 && R.morph.first.cur < 0.1 && R.morph.last.m < 0.08 && R.morph.last.cur > 0.9 && R.morph.last.vis < 0.05 && R.morph.mono, R.morph);
report.check('CSS: con trỏ tay đang hiện mờ theo --hand-skel-cursor (0,3); chế độ ẩn vẫn ẩn', R.cursorCss.none || (Math.abs(R.cursorCss.on - 0.3) < 0.02 && R.cursorCss.hid === 0), R.cursorCss);
report.check('lướt nhanh qua vòng (~70 ms) → không tick', R.passNoTick === '0');
report.check('dừng trong vòng → POP: khung + khung xương ẩn (gỡ cờ, gỡ biến CSS), vòng TRÁI + dòng "Đưa tay sang vòng bên trái"', R.rightTick >= 150 && R.rightTick < 500 && R.afterPop.frame === null && R.afterPop.body === null && R.afterPop.css === '' && R.leftSync.line === 'left' && R.leftSync.lShown, { tick: R.rightTick, pop: R.afterPop, sync: R.leftSync });
report.check('vòng trái cách vòng phải ~46 % bề ngang về bên trái', Math.abs(R.leftPos.dx - R.leftPos.expect) < 3, R.leftPos);
report.section('mất tay / không được nhận');
report.check('mất tay 0,6 s → giữ nguyên dòng', R.lost06 === 'left', R.lost06);
report.check('mất tay ≥ 1 s → "Đưa tay vào khung hình" thay chỗ (việc vẫn "left")', R.lostAt >= 0 && R.lostStack.at(-1).base === 'left', { at: R.lostAt, top: R.lostStack.at(-1) });
report.check('tay quay lại → dòng cũ ≤ 150 ms, vòng vẫn đó', fast(R.backLine) && R.backKept, { ms: R.backLine, kept: R.backKept });
report.check('còn tay mà thôi được nhận → "Giữ yên bàn tay" (+ lý do); nhận lại → về việc cũ', fast(R.unengaged) && /giữa/.test(R.unengagedSub) && fast(R.reengaged), { un: R.unengaged, sub: R.unengagedSub, re: R.reengaged });
report.check('vào vòng trái → xong bước 1: sang bước 2, chỉ vòng thứ nhất hiện, dòng "Đưa tay vào vòng tròn"', R.step2At >= 0 && R.step2.line === 'toRing' && R.step2.aShown && !R.step2.bShown && R.step2.dots === 'done,now,,', R.step2);
report.section('chồng dòng + hình động tác');
{
  const n = R.midPush.find((l) => l.key === 'touch' && l.pos === '0');
  const o = R.midPush.find((l) => l.key === 'toRing' && l.pos === '1');
  report.check('giữa lúc đẩy (~200 ms): dòng mới đang vào từ TRÊN xuống, còn nhoè, chưa đậm hẳn; dòng cũ đang mờ đi + đi XUỐNG', n && n.op > 0.05 && n.op < 0.98 && n.blur > 0.2 && n.ty < 0 && o && o.op < 0.98 && o.op > 0.42 && o.ty > 0, R.midPush);
}
{
  const vis = R.settled.filter((l) => ['0', '1', '2'].includes(l.pos));
  const p0 = vis.find((l) => l.pos === '0');
  const p1 = vis.find((l) => l.pos === '1');
  const p2 = vis.find((l) => l.pos === '2');
  report.check('đã đứng: 3 dòng — hiện tại nét, rõ; dòng 1 mờ (~0,42, nhỏ 0,8, có tick); dòng 2 mờ hơn (~0,18); dòng thứ tư đã đi', vis.length === 3 && p0.op === 1 && p0.blur === 'none' && Math.abs(p1.op - 0.42) < 0.03 && p1.sc === 0.8 && p1.done && Math.abs(p2.op - 0.18) < 0.03 && p1.ty > 0 && p2.ty > p1.ty && R.settled.length <= 4, R.settled);
}
{
  const L = R.layout;
  const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const ok = L.cur && L.p1 && L.p2 && L.num.bottom <= L.cur.top + 2 && L.dots.bottom <= L.cur.top + 2 && L.dots.left >= L.num.right && L.cur.bottom <= L.sub.top + 4 && L.p1.top >= L.sub.bottom - 4 && L.p2.top >= L.p1.bottom - 2
    && Math.abs(L.num.left - L.cur.left) <= 1 && L.demo.right <= L.col.left
    && ![L.cur, L.p1, L.p2, L.dots, L.sub, L.demo].some((b) => hit(b, L.skip) || hit(b, L.hint));
  report.check('bố cục hai cột: ô hình động tác bên trái; cột chữ căn trái — "Bước n / 4" + chấm bước → dòng hiện tại → dòng phụ → hai dòng xong bên dưới (không chồng nhau); "Bỏ qua" + "Vẫy tay để bỏ qua" không bị đè', ok, L);
  report.check('không có dòng của việc sắp tới chờ sẵn: phía trên dòng hiện tại không còn dòng nào hiện', L.above.every((a) => a.op < 0.05), L.above);
  const stackH = L.p2 ? L.p2.bottom - L.cur.top : 0;
  report.check('ô hình động tác cao ≈ chồng 3 dòng (dòng hiện tại → hết dòng xong thứ hai, ±12 %), bắt đầu ngang dòng hiện tại', L.p2 && Math.abs(L.demo.bottom - L.demo.top - stackH) <= 0.12 * stackH && Math.abs(L.demo.top - L.cur.top) <= 0.25 * (L.cur.bottom - L.cur.top), { demoH: L.demo.bottom - L.demo.top, stackH, demoTop: L.demo.top, curTop: L.cur.top });
}
{
  const done = R.settled.filter((l) => (l.pos === '1' || l.pos === '2') && l.done);
  const xs = done.map((l) => l.tickR);
  report.check('dấu tick của các dòng đã xong ở LỀ PHẢI cột chữ, thẳng một cột (cùng x), ngang dòng đầu của mục, bên phải chữ', done.length === 2 && Math.max(...xs) - Math.min(...xs) <= 1 && Math.abs(xs[0] - R.layout.col.right) <= 14 && done.every((l) => l.tickR > l.textR && l.tickCY >= l.top && l.tickCY <= l.bottom), done);
}
{
  const g = geo.filter((x) => x.textL !== null);
  const xs = g.map((x) => x.textL);
  const ds = g.map((x) => `${x.demoL},${x.demoT},${x.demoH}`);
  report.check('mép trái của chữ CỐ ĐỊNH qua mọi lần đổi dòng (cả dòng sửa, bước 1 → 4), số bước thẳng mép đó; ô hình động tác không xê dịch', g.length >= 7 && Math.max(...xs) - Math.min(...xs) <= 1 && g.every((x) => x.numL === null || Math.abs(x.numL - x.textL) <= 1) && new Set(ds).size === 1, g);
}
report.check('khung tròn bước 1 rộng hơn: clamp(300 px, min(31vw, 50vh), 480 px) — ở 1440 × 900 ≈ 446 px; nằm trên khối chữ', Math.abs(R.frameSize.w - R.frameSize.want) <= 2 && R.frameSize.w >= 440 && R.frameSize.bottom <= R.frameSize.textTop, R.frameSize);
report.check('chữ dài xuống dòng trong cột (cột hẹp 260 px): ≥ 2 dòng, căn trái, không vượt mép cột, không "…"; dòng phụ + mục bên dưới lùi theo', R.wrap.rows >= 2 && Math.abs(R.wrap.curL - R.wrap.colL) <= 1 && R.wrap.curR <= R.wrap.colR && R.wrap.ellipsis !== 'ellipsis' && R.wrap.subTop >= R.wrap.curBottom - 2 && (R.wrap.p1Top === null || R.wrap.p1Top >= R.wrap.subBottom - 4), R.wrap);
report.check('hình động tác "Chạm ngón cái vào ngón trỏ" (tap) đang chạy THEO NHỊP MÀN HÌNH (r69g — trần "FPS tối đa" 60: 45–62 khung / s) trên canvas', R.demo.kind === 'tap' && R.demo.perSec >= 45 && R.demo.perSec <= 62 && R.demo.lit > 40, R.demo);
report.check('r69g: bàn tay sống + hình động tác vẽ đều theo nhịp màn hình — không khoảng nào > 1,5 × khung; ≤ 2 ms / lần vẽ', R.smooth.live.gaps === 0 && R.smooth.demo.gaps === 0 && R.smooth.live.perSec >= 45 && R.smooth.demo.perSec >= 45 && R.smooth.live.msP95 <= 2 && R.smooth.demo.msP95 <= 2, R.smooth);
report.check('lùi việc (rời vòng) → dòng "Chạm…" lui lên rồi tắt, "Đưa tay vào vòng tròn" đi lên về vị trí hiện tại (không thêm dòng)', R.unpush >= 0 && R.unpush <= 150 && R.unpushStack.some((l) => l.key === 'touch' && l.pos === 'back') && R.unpushStack.some((l) => l.key === 'toRing' && l.pos === '0' && !l.done), { ms: R.unpush, stack: R.unpushStack });
report.section('bước 2 · chạm → thả');
report.check('ngoài vòng: "Đưa tay vào vòng tròn"', R.toRing === 'toRing');
report.check('chạm NGOÀI vòng → "Đưa tay vào vòng trước" thay chỗ ≤ 150 ms, rồi về dòng việc', fast(R.outside) && R.outsideStack.base === 'toRing' && R.outsideBack >= 0, { hint: R.outside, top: R.outsideStack, back: R.outsideBack });
report.check('con trỏ trên vòng → "Chạm ngón cái vào ngón trỏ" ≤ 150 ms; đang chạm → "Thả ra" ≤ 150 ms', fast(R.touchAt) && fast(R.releaseAt), { touch: R.touchAt, release: R.releaseAt });
report.check('thả → tick, rồi vòng thứ hai hiện cùng dòng "Đưa tay sang vòng bên phải"', R.aTick >= 0 && R.bAt >= 0 && R.bSync === 'toRing2', { tick: R.aTick, b: R.bAt, line: R.bSync });
report.check('vòng thứ hai: "Chạm ngón cái vào ngón trỏ" ≤ 150 ms', fast(R.touchB), R.touchB);
report.check('chạm rồi kéo đi → "Giữ tay yên khi chạm", không chọn', R.moved === 'hMoved', R.moved);
report.check('chạm giữ quá lâu → "Thả nhanh hơn", thả ra không chọn', R.long >= 1300 && R.longNoSel === '0', { ms: R.long, sel: R.longNoSel });
report.check('chạm–thả nhanh trên vòng thứ hai → sang bước 3', R.step3At >= 0);
report.section('bước 3 · chạm giữ → kéo (≥ 1,5 s) → thả (hai lượt)');
report.check('ngoài khối: "Đưa tay vào khối vuông"; chạm ngoài khối → "Đưa tay vào khối trước"', R.toCube === 'toCube' && fast(R.cubeOutside), { toCube: R.toCube, hint: R.cubeOutside });
report.check('trên khối → "Chạm và giữ" (phụ: "ngón cái vào ngón trỏ · lần 1 / 2"); đang giữ → "Kéo sang ngang" ≤ 150 ms', fast(R.grabAt) && /ngón cái vào ngón trỏ · lần 1 \/ 2/.test(R.grabSub) && fast(R.dragAt), { grab: R.grabAt, sub: R.grabSub, drag: R.dragAt });
report.check('thả khi xoay chưa đủ → "Xoay thêm một chút"', fast(R.small), R.small);
report.check('xoay đủ ngay (~0,3 s) mà vẫn "Kéo sang ngang"; "Thả ra" chỉ hiện ở ~1,5 s kéo (1,45–1,7 s)', R.earlyLet.line === 'drag' && R.earlyLet.rot >= 20 && R.letAt >= 1450 && R.letAt <= 1700, { early: R.earlyLet, letAt: R.letAt });
report.check('thả → lượt 1 (chỉ xoay quanh trục đứng); lượt 2 trên khối: "Chạm và giữ" + "lần 2 / 2"', R.turn1 >= 0 && R.turn1Cube.rx === 0 && Math.abs(R.turn1Cube.ry) >= 20 && R.grab2.line === 'grab2' && /lần 2 \/ 2/.test(R.grab2.sub), { turn1: R.turn1, cube: R.turn1Cube, grab2: R.grab2 });
report.check('lượt 2: đang giữ → "Kéo lên xuống" (hình kéo dọc); kéo NGANG → khối không xoay; thả → "Xoay thêm một chút"', R.drag2.line === 'drag2' && R.drag2.demo === 'dragV' && R.drag2Side.line === 'drag2' && R.drag2Side.rx === 0 && R.drag2Side.ry === R.turn1Cube.ry && fast(R.small2), { ...R.drag2, side: R.drag2Side, hint: R.small2 });
report.check('lượt 2 kéo lên xuống đủ, thả SỚM (< 1,5 s, chưa có "Thả ra") → vẫn tính, sang bước 4', R.vert.line === 'drag2' && Math.abs(R.vert.rx) >= 20 && R.vert.ms < 1500 && R.step4At >= 0, { vert: R.vert, step4: R.step4At });
report.section('bước 4 · nắm tay kéo khối (trái → thả → phải → thả)');
report.check('vào bước 4: "Xoè tay rồi nắm lại để cầm khối", hình "fist", "Bước 4 / 4", body[data-hand-fist-tut="1"], mũi tên trái sáng', R.s4.line === 'grabF' && R.s4.demo === 'fist' && R.s4.fistTut === '1' && /Bước 4 \/ 4/.test(R.s4.num) && R.s4.chev, R.s4);
report.check('nắm mà không cầm được (chưa xoè trước) → "Xoè cả 5 ngón trước, rồi nắm lại" (~0,45 s)', R.hFist >= 350 && R.hFist <= 700, R.hFist);
report.check('nắm (hand:vdrag fist start) → "Kéo sang trái", khối được cầm', R.pullL.line === 'pullL' && R.pullL.grab?.src === 'hand' && R.pullL.held === '1', R.pullL);
report.check('kéo sai chiều → khối chỉ nhích (≤ 6 % bề ngang), không trượt đi', R.wrongWay.off > 0 && R.wrongWay.off <= R.wrongWay.max && R.wrongWay.snaps === 0, R.wrongWay);
report.check('kéo trái chưa đủ → khối theo tay; thả → bật về + "Kéo xa hơn rồi mới thả", việc lùi về "grabF"', R.partial.off < -40 && R.partial.cubeX < -40 && R.far >= 0 && R.farState.base === 'grabF' && R.farState.off === 0 && R.farState.springs === 1 && Math.abs(R.farState.cubeX) < 3, { partial: R.partial, far: R.far, after: R.farState });
report.check('kéo đủ (12 % bề ngang) → khối trượt đi (tiếng tick), "Thả tay ra"', R.snapL.line === 'openF' && R.snapL.snaps === 1 && R.snapL.tok >= 1, R.snapL);
report.check('r66b: giữa lúc trượt đi vật vẫn là khối 3D — khối không mang độ mờ, vẫn preserve-3d, không filter, chỉ quay (không dịch); dịch + mờ ở khung cảnh (có perspective)', R.out3d.fOp === 1 && R.out3d.fTs === 'preserve-3d' && R.out3d.fFilter === 'none' && R.out3d.fTx === 0 && R.out3d.wOp < 1 && R.out3d.wTx < -100 && R.out3d.wTs === 'flat' && R.out3d.persp !== 'none', R.out3d);
report.check('r66b: vật mới vào mỗi lần khác hẳn vật vừa đi — khối vuông (6 mặt) → lăng trụ tam giác (3 mặt bên + 2 đáy tam giác) → lăng trụ ngũ giác (5 + 2)', R.shape0.shape === 'cube' && R.shape0.sides === 6 && R.shape1.shape === 'tri' && R.shape1.sides === 3 && R.shape1.caps === 2 && R.shape2.shape === 'penta' && R.shape2.sides === 5 && R.shape2.caps === 2 && R.shapes.join(' ') === 'cube tri penta' && R.shapes.every((k, i) => i === 0 || k !== R.shapes[i - 1]), { shapes: R.shapes, s0: R.shape0, s1: R.shape1, s2: R.shape2 });
report.check('thả → tick → "Nắm lại, kéo sang phải"; khối mới đã về giữa; 3 dòng', R.toR >= 0 && R.rState.phase === 'R' && Math.abs(R.rState.cubeX) < 3 && R.rState.stack === 'pullL openF grabF2', { toR: R.toR, ...R.rState });
report.check('nắm lại (vẫn "Nắm lại, kéo sang phải") → kéo phải đủ → "Thả tay ra" → thả → "Hoàn tất! Mời bạn khám phá", 4 chấm xong, gỡ cờ, rồi đóng', R.grabR === 'grabF2' && R.snapR >= 0 && R.doneAt >= 0 && R.end.text === 'Hoàn tất! Mời bạn khám phá' && R.end.fistTut === null && R.end.dots === 'done,done,done,done' && R.closed, { grabR: R.grabR, snapR: R.snapR, done: R.doneAt, end: R.end, closed: R.closed });
report.check('lịch sử dòng: mỗi dòng việc chỉ ngay sau dòng điều kiện của nó; thứ tự các việc đúng', R.order.length === 0, { bad: R.order, lines: R.lines });
report.check('r68: bộ vẽ bàn tay 3D chỉ tồn tại lúc hướng dẫn mở — trước khi mở: chưa có; đang mở: có, đang vẽ mô hình có xương da; đóng: huỷ (không còn bộ vẽ nào)', R.h3.before.exists === false && R.h3.before.counts.live === 0 && R.h3.during.exists === true && R.h3.during.counts.live === 1 && R.h3.during.winRenders > 20 && /^gltf-/.test(R.h3.during.model) && R.h3.after.exists === false && R.h3.after.counts.live === 0 && R.h3.after.counts.created >= 1, R.h3);
report.check('r68: chi phí vẽ bàn tay 3D ≤ 2 ms / lần (trung bình trong 1,5 s, CPU: đặt tư thế + vẽ + chép sang canvas)', R.h3.during.winAvgMs > 0 && R.h3.during.winAvgMs <= 2, { avgMs: R.h3.during.winAvgMs, renders: R.h3.during.winRenders });
report.check('hình động tác chỉ chạy lúc hướng dẫn mở (đóng → không vẽ thêm, vòng lặp dừng)', R.demoAfter.a === R.demoAfter.b && !R.demoAfter.loop, R.demoAfter);
report.check('lớp cử chỉ tắt (hand:active false) → bỏ tay "đã nhận" cũ', R.handOff.before === true && R.handOff.after === false, R.handOff);
report.check('đóng giữa chừng → gỡ data-hand-skeleton / data-hand-fist-tut / --hand-skel-cursor', R.stopClean.skel === null && R.stopClean.fist === null && R.stopClean.css === '', R.stopClean);
report.section('chuột + Bỏ qua + chữ + cài đặt');
report.check('chuột: không đòi giơ tay — vòng phải hiện sau lúc đọc; hai vòng → bước 2; nhấn lún; bấm → bước 3; kéo hai lượt → bước 4; kéo khối trái rồi phải → xong', Object.values(R.mouse).every(Boolean), R.mouse);
report.check('Bỏ qua: đang chạm → còn mở, nút lún; thả → đóng', R.skip.stillOpen && R.skip.pressed && R.skip.closes, R.skip);
report.check('không còn chữ "nhón" cho khách', R.noNhon.length === 0, R.noNhon);
report.check('tắt "Nắm tay kéo bia" → 3 bước ("Bước 1 / 3", 3 chấm)', R.three.steps === 3 && /Bước 1 \/ 3/.test(R.three.num) && R.three.dots === 3, R.three);
report.section('giảm chuyển động');
{
  const n = R.rm.midLines.find((l) => l.pos === '0');
  const o = R.rm.midLines.find((l) => l.pos === '1');
  report.check('chồng dòng: chỉ mờ chéo — dòng mới đã ở đúng chỗ, không nhoè; dòng cũ đã xuống đúng chỗ', n && n.blur === 'none' && n.ty === 0 && o && o.blur === 'none' && o.ty > 20, R.rm.midLines);
}
report.check('hình động tác đứng yên (một dáng, không vẽ lại)', R.rm.rm && R.rm.demoFrames === 0 && R.rm.lit > 40, { rm: R.rm.rm, frames: R.rm.demoFrames, lit: R.rm.lit });
report.section('vẫy để bỏ qua (hand:wave tổng hợp)');
report.check('body[data-hand-wave] bật khi hướng dẫn mở', R.wave.body === 'on');
report.check('vòng "Bỏ qua" đầy theo tiến độ, thôi vẫy → rút về 0', R.wave.at06 === 0.6 && R.wave.afterStop === 0, R.wave);
report.check('xong → đóng, gỡ cờ', R.wave.closed && R.wave.bodyAfter === null);
report.section('"tạch" dòng thời gian (r32b)');
report.check('rê chậm: một tiếng mỗi mốc (trừ mốc đầu)', R.tick.slow.played === R.tick.slow.want, R.tick.slow);
report.check('lướt nhanh: thưa lại (bỏ theo nhịp)', R.tick.fast.played < R.tick.fast.changes && R.tick.fast.skippedGap > 0, R.tick.fast);
report.check('đang nhón / vừa thả nhón: không kêu', R.tick.pinch.played === 0);
report.check('nhón xong đã yên: kêu lại', R.tick.afterPinchSettled.played === 1);
report.check('chuột nắm quyền: không kêu', R.tick.mouse.played === 0);
process.exit(report.finish(errs1));
