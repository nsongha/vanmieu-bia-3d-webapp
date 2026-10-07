// r88 — (1) ÁNH SÁNG LÚC ĐỌC = ánh sáng LÚC NGHỈ: đoạn camera tiến vào chuyển từ ánh sáng focus sang nghỉ theo đúng tiến độ + đường cong
// camera (mức pha = đường cong camera, đơn điệu), kết thúc đúng các giá trị lúc nghỉ; lùi ra chuyển về lại focus (đơn điệu) theo đoạn
// lùi. (2) TAY RÊ nút trên tấm sơn mài ("Đọc toàn văn", "Xem ĐỀ DANH") trông y như CHUỘT rê — không khối biến hình xám của con trỏ
// tay; rê tay qua tên người soạn / dải chuyện / mục lục trong tấm đọc cũng không hiện khối nào.
//   A. ánh sáng: lúc nghỉ (chuột ngoài bia) → số đo nghỉ; focus → giữ V → bắn: mỗi khung đoạn tiến vào mức pha e / độ tương phản =
//      đường cong camera (± 0,03), e không giảm, cuối đoạn = số đo nghỉ (± 1 %); Esc: đoạn lùi e không tăng, về 0 (focus)
//   B. tay rê "Đọc toàn văn" / "Xem ĐỀ DANH": vùng dính đúng, con trỏ không biến hình (không khối), ảnh vùng nút như khi chuột rê
//      (Δ trung bình ≤ 2 / 255, p99 ≤ 24); tay qua tên người soạn / dải chuyện: không khối; tấm đọc mở: tay gần mục lục → không khối
// node tests/cinema/reader-light.test.mjs --port 5180   (≈ 1,5 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('reader-light');
const W = 1440;
const H = 900;
const SEED = { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, cinemaNames: false, readerCreep: 0, gestureCursor: 'shown', titleFxMode: 'fade' };
const { page, close, errors } = await launch({ headed, width: W, height: H, settings: SEED });
await openCinema(page, port, { id: 'bia-1442', hooks: ['cinemaStelePoint', 'cinemaSelect', 'cinemaRead', 'cinemaRich', '__vmHand.simulateHand', '__vmHand.morphState'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const R = {};
const light = () => E(() => window.__vm.cinemaSelect().light);
const P = await E(() => window.__vm.cinemaStelePoint());

// ---------------------------------------------------------------- A. ánh sáng
await page.mouse.move(W / 2, H - 12, { steps: 4 });
await sleep(2500);
R.rest = await light();
await page.mouse.move(P.x, P.y, { steps: 4 });
await sleep(2500);
R.focus = await light();
R.open = await E(async () => {
  const ev = (phase, progress) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  const rows = [];
  ev('start', 0);
  const t0 = performance.now();
  let fired = false;
  while (performance.now() - t0 < 6200) {
    await new Promise((r) => requestAnimationFrame(r));
    if (!fired && performance.now() - t0 >= 2000) {
      fired = true;
      ev('fire', 1);
    }
    const r = window.__vm.cinemaRead();
    const l = window.__vm.cinemaSelect().light;
    if (r?.tw === 'read' || (fired && rows.length)) rows.push({ tw: r?.tw ?? null, t: r?.twT ?? null, e: l.e, spot: l.spot, key: l.key, fill: l.fill, hemi: l.hemi, contrast: l.contrast });
  }
  return rows;
});
R.reading = await light();
R.close = await E(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const rows = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 2600) {
    await new Promise((r) => requestAnimationFrame(r));
    const r = window.__vm.cinemaRead();
    const l = window.__vm.cinemaSelect().light;
    rows.push({ tw: r?.tw ?? null, t: r?.twT ?? null, e: l.e });
  }
  return rows;
});
await sleep(800);
R.after = await light();

// ---------------------------------------------------------------- B. tay rê nút sơn mài
await page.mouse.move(P.x, P.y, { steps: 4 });
await sleep(2500);
const clipOf = (sel) => E((sel) => {
  const q = document.querySelector(sel)?.getBoundingClientRect();
  return q && q.width > 0 ? { x: Math.round(q.left - 10), y: Math.round(q.top - 10), width: Math.round(q.width + 20), height: Math.round(q.height + 20), cx: q.left + q.width / 2, cy: q.top + q.height / 2 } : null;
}, sel);
const shotPx = async (clip) => {
  const png = await page.screenshot({ clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height } });
  return E(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, img.width, img.height).data);
  }, png.toString('base64'));
};
const diff = (a, b) => {
  const d = [];
  for (let i = 0; i < Math.min(a.length, b.length); i += 4) d.push(Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])));
  d.sort((u, v) => u - v);
  return { mean: +(d.reduce((t, v) => t + v, 0) / Math.max(1, d.length)).toFixed(2), p99: d[Math.floor(d.length * 0.99)] ?? 0 };
};
// chuột rê từng nút (ảnh mẫu)
const mouseShots = {};
for (const sel of ['.lq-btn--read', '.lq-btn--names']) {
  const c = await clipOf(sel);
  if (!c) continue;
  await page.mouse.move(c.cx, c.cy, { steps: 6 });
  await sleep(700);
  mouseShots[sel] = { clip: c, px: await shotPx(c) };
}
await page.mouse.move(P.x, P.y, { steps: 4 });
await sleep(600);
// tay: con trỏ tay đi từ bia sang từng nút (hội tụ theo vị trí con trỏ thật — cổ tay → con trỏ không tuyến tính)
await E(() => document.body.classList.add('gesture-on'));
await E(() => {
  window.__H = { x: 0.5, y: 0.9, first: true };
  window.__H.id = setInterval(() => {
    window.__vmHand.simulateHand([{ pose: 'open', x: window.__H.x, y: window.__H.y, ms: 33 }], { live: true, fresh: window.__H.first });
    window.__H.first = false;
  }, 33);
});
const cur = () => E(() => { const c = document.querySelector('.hi-cursor'); if (!c) return null; const q = c.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
let wx = P.x / W;
let wy = 0.9;
const goTo = async (tx, ty, n) => {
  for (let it = 0; it < n; it++) {
    await E(([x, y]) => { window.__H.x = x; window.__H.y = y; }, [wx, wy]);
    await sleep(420);
    const c = await cur();
    if (c) {
      wx += (0.35 * (tx - c.x)) / W;
      wy += (0.35 * (ty - c.y)) / H;
    }
  }
};
const morph = () => E(() => {
  const m = window.__vmHand.morphState?.();
  const el = document.querySelector('.hi-morph');
  return { kind: m?.kind ?? null, zone: m?.zone ?? null, el: el ? +getComputedStyle(el).opacity : 0, sticky: document.body.dataset.handSticky ?? null };
});
await goTo(P.x, P.y, 9);
await sleep(2200);
R.hand = {};
for (const sel of ['.lq-btn--read', '.lq-btn--names']) {
  const ms = mouseShots[sel];
  if (!ms) {
    R.hand[sel] = null;
    continue;
  }
  const from = await cur();
  for (let k = 1; k <= 5; k++) await goTo(from.x + ((ms.clip.cx - from.x) * k) / 5, from.y + ((ms.clip.cy - from.y) * k) / 5, 3);
  await goTo(ms.clip.cx, ms.clip.cy, 4);
  await sleep(900);
  const m = await morph();
  const px = await shotPx(ms.clip);
  R.hand[sel] = { morph: m, diff: diff(ms.px, px) };
  // về lại bia (hover giữ)
  const c = await cur();
  for (let k = 1; k <= 4; k++) await goTo(c.x + ((P.x - c.x) * k) / 4, c.y + ((P.y - c.y) * k) / 4, 3);
  await sleep(600);
}
// tay qua tên người soạn / dải chuyện (tấm sơn mài) — không khối
R.others = {};
for (const sel of ['.lq-author', '.lq-strip, .lq-story, .lq-intro']) {
  const c = await clipOf(sel);
  if (!c) continue;
  const from = await cur();
  for (let k = 1; k <= 4; k++) await goTo(from.x + ((c.cx - from.x) * k) / 4, from.y + ((c.cy - from.y) * k) / 4, 3);
  await sleep(700);
  R.others[sel] = await morph();
}
await E(() => clearInterval(window.__H.id));
await E(() => document.body.classList.remove('gesture-on'));
await sleep(500);

// ---------------------------------------------------------------- báo cáo
const f3 = (v) => (v == null ? '—' : Number(v).toFixed(3));
report.section('A. ánh sáng lúc đọc = ánh sáng lúc nghỉ');
{
  const C = R.rest.contrast;
  const rows = R.open.filter((r) => r.tw === 'read' && r.t != null);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  let mono = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i].e < rows[i - 1].e - 1e-4) mono++;
  const dev = rows.map((r) => Math.abs(r.e / C - ease(Math.min(1, r.t)) * (1 - R.focus.e / C) - R.focus.e / C));
  const maxDev = dev.length ? Math.max(...dev) : null;
  const end = R.reading;
  const near = (a, b) => Math.abs(a - b) <= 0.01 * Math.max(1, Math.abs(b));
  report.check(`lúc nghỉ e ${f3(R.rest.e)} (tương phản ${f3(C)}), focus e ${f3(R.focus.e)}; đoạn tiến vào ${rows.length} khung: e đơn điệu (${mono} khung giảm), mức pha = đường cong camera (lệch lớn nhất ${f3(maxDev)} ≤ 0,03)`, R.focus.e < 0.05 && rows.length > 40 && mono === 0 && maxDev <= 0.03, { mono, maxDev, first: rows[0], last: rows.at(-1) });
  report.check(`lúc đọc = đúng ánh sáng lúc nghỉ: e ${f3(end.e)} / ${f3(R.rest.e)} · đèn rọi ${f3(end.spot)} / ${f3(R.rest.spot)} · đèn chính ${f3(end.key)} / ${f3(R.rest.key)} · fill ${f3(end.fill)} / ${f3(R.rest.fill)} · hemi ${f3(end.hemi)} / ${f3(R.rest.hemi)}`, near(end.e, R.rest.e) && near(end.spot, R.rest.spot) && near(end.key, R.rest.key) && near(end.fill, R.rest.fill) && near(end.hemi, R.rest.hemi), { end, rest: R.rest });
  const out = R.close.filter((r) => r.tw === 'read-out');
  let up = 0;
  for (let i = 1; i < out.length; i++) if (out[i].e > out[i - 1].e + 1e-4) up++;
  report.check(`đóng: đoạn lùi ${out.length} khung, e không tăng (${up}); về lại focus (e ${f3(R.after.e)})`, out.length > 15 && up === 0 && R.after.e < 0.05 && out[0].e > 0.5 * C, { first: out[0], last: out.at(-1), after: R.after.e });
}
report.section('B. tay rê nút sơn mài như chuột rê');
for (const [sel, r] of Object.entries(R.hand)) {
  report.check(`${sel}: tay dính đúng nút (${r?.morph.sticky}), con trỏ không biến hình (${r?.morph.kind}, khối ${r?.morph.el}), ảnh vùng nút như chuột rê (Δ TB ${r?.diff.mean}, p99 ${r?.diff.p99})`, !!r && /^info-/.test(r.morph.sticky ?? '') && r.morph.kind === 'circle' && r.morph.el === 0 && r.diff.mean <= 2 && r.diff.p99 <= 24, r);
}
report.check(`tay qua tên người soạn / dải chuyện: không khối (${Object.entries(R.others).map(([k, m]) => `${k.split(',')[0]} ${m.kind}`).join(' · ')})`, Object.keys(R.others).length >= 1 && Object.values(R.others).every((m) => m.kind === 'circle' && m.el === 0), R.others);
await close();
process.exit(report.finish(errors));
