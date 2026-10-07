// r84 — CHUYỂN CẢNH TOÀN VĂN là cài đặt (người dùng: "cho tôi cả các setting cho transition zoom vào toàn văn bia") + góp ý sau khi
// xem (vạch quét chậm hơn, tách khỏi 2 s giữ; camera nhích vào lúc đang giữ; chữ Hán bay CÙNG lúc camera tiến) + cổng độ sâu của
// bản dập (không in lên đầu rùa).
//   A. bảng cài đặt › Thông tin: nhóm "Chuyển cảnh toàn văn" (tiêu đề nhỏ Camera · Vệt quét · Ánh sáng chữ · Tấm đọc · Đóng, ba nút xem
//      thử, khôi phục mặc định) cạnh nhóm "Bảng đọc" (kiểu bảng, khoảng cách chữ – bia, độ cong vòm); ảnh chụp 1440×900 (--shots)
//   B. giữ V trên mặt bia (1442, mặc định): camera NHÍCH vào ngay từ lúc bắt đầu giữ — tăng tốc từ 0, tới ~readerCreep quãng tiến
//      vào lúc bắn (2 s); bắn → đoạn tiến vào đi tiếp từ đúng chỗ + vận tốc đó (liên tục C1: vận tốc hai bên mốc bắn khớp, không
//      khung nào nhảy)
//   C. vạch quét đi theo thời gian: "Thời gian vệt quét" 3,2 s (vạch ~31 % sau 1 s, ~62 % lúc bắn 2 s, tới chân mặt bia ở ~3,2 s —
//      đi tiếp lúc camera đã tiến); đặt 4,5 s → vạch ~22 % sau 1 s
//   D. chữ Hán bay cùng camera: mọi chữ tách SAU lúc bắn, chữ tách cuối trước lúc chữ tấm đọc hiện, bay hết trước pEnd; giữa đoạn tiến
//      vào có sprite đang bay; không khung nào vừa có chữ tấm đọc vừa có sprite
//   E. cài đặt có hiệu lực: đường cong camera (quint · sine — tiến độ bán kính camera đúng đường cong) · quãng trượt tấm · sóng tách
//      muộn nhất · cỡ sprite tối đa
//   F. luật an toàn tự kẹp: sóng tách muộn nhất đặt quá muộn → kẹp trước chữ tấm đọc (gợi ý hiện trong bảng), vẫn không sprite lúc có
//      chữ; cửa sổ chạm đá đặt ngược → kẹp, mọi chữ chạm đá trong cửa sổ đã kẹp (trước khi camera lùi xong)
//   G. "▶ Xem thử chuyển cảnh": bảng ẩn suốt lượt, chạy giữ (vạch + nhích) → mở → đọc → đóng trên bia đang hiện, bảng hiện lại đúng tab
//   H. "Khôi phục mặc định (nhóm này)": mọi khoá của nhóm về mặc định, cài đặt ngoài nhóm giữ nguyên
//   T. (r85) hiệu ứng từng chữ của tiêu đề tấm đọc: lúc chạy có span chữ (aria-hidden, tiêu đề giữ aria-label) mang transform; đứng
//      yên: không span nào còn transform / nhoè / độ mờ, hết lớp .is-tfx; thân bài chỉ bắt đầu trượt lên SAU khi tiêu đề xong; mở ở Đề
//      danh: hiệu ứng ở "Đề danh Tiến sĩ" rồi bảng vàng trượt lên; kiểu "Phóng sáng" (chỉ phóng cỡ, thứ tự ngẫu nhiên, không lệch chỗ)
//      và "Mờ dần" (không tách chữ) — thân bài vẫn sau tiêu đề; giảm chuyển động: chỉ mờ chéo (không span, không hiệu ứng)
//   I. cổng độ sâu: đang quét (vệt dài, camera đứng yên) — vùng đầu rùa (1442, 1664 — đầu rùa nhô trước chân mặt bia) không đổi
//      điểm ảnh (không bản dập / vệt / chữ), mặt bia ngay trên đó thì có
// node tests/cinema/transition.test.mjs --port 5180 [--shots <thư mục>]   (≈ 4 phút)
import fs from 'node:fs';
import path from 'node:path';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const argv = process.argv.slice(2);
const SHOTS = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const report = createReport('transition');
const W = 1440;
const H = 900;
const SEED = { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true };
const HOOKS = ['cinemaStelePoint', 'cinemaRich', 'cinemaRead', 'cinemaCam', 'cinemaGlyphs', 'cinemaScan', 'cinemaLoop', 'cinemaTick', 'cinemaInfo', 'cinemaIdle', 'cinemaTxProgress', 'cinemaHead', 'cinemaPreview', 'cinemaLods', 'cinemaReveal'];
const { page, close, errors } = await launch({ headed, width: W, height: H, settings: SEED });
await openCinema(page, port, { id: 'bia-1442', hooks: HOOKS, settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const setS = (k, v) => E(([k, v]) => window.__vm.settings.set(k, v), [k, v]);
const resetT = () => E(() => window.__vm.settings.resetTransition());
const R = {};

const goto = (id) => E(async (id) => {
  if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 100));
    if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0 && window.__vm.cinemaRich.dev()?.info?.()?.id === id) break;
  }
}, id);
const focus = async (ms = 2200) => {
  const p = await E(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(ms);
};
const closeReader = async () => {
  await page.keyboard.press('Escape');
  await E(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      await new Promise((r) => setTimeout(r, 100));
      if (!window.__vm.cinemaRich.state().overlay && !window.__vm.cinemaRead()?.tw) break;
    }
  });
  await sleep(1400);
};

/**
 * Một lượt mở (trong trang, theo khung): mode 'vhold' — giữ V tổng hợp, bắn đúng 2 s sau khi bắt đầu; 'button' — "Đọc toàn văn"
 * (cinemaRich.read). Ghi mỗi khung: t (ms từ lúc bắt đầu), bán kính camera, đoạn camera, vạch quét, chữ Hán, lớp đọc.
 */
const runOpen = (mode = 'vhold', ms = 7000) => E(async ([mode, ms]) => {
  const rows = [];
  let openInfo = null;
  const onOpen = (e) => (openInfo = { textAt: e.detail.textAt, slideAt: e.detail.slideAt, dur: e.detail.dur, t: performance.now() });
  window.addEventListener('reader:open', onOpen);
  const t0 = performance.now();
  const ev = (phase, progress) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  if (mode === 'vhold') ev('start', 0);
  else window.__vm.cinemaRich.read();
  let fired = mode !== 'vhold';
  let fireT = null;
  while (performance.now() - t0 < ms) {
    await new Promise((r) => requestAnimationFrame(r));
    const t = performance.now() - t0;
    if (!fired && t >= 2000) {
      fired = true;
      fireT = t;
      ev('fire', 1);
    } else if (!fired) ev('progress', Math.min(1, t / 2000));
    const c = window.__vm.cinemaCam();
    const s = window.__vm.cinemaScan();
    const g = window.__vm.cinemaGlyphs();
    const st = window.__vm.cinemaRich.dev()?.reader?.state();
    const rd = window.__vm.cinemaRead();
    rows.push({
      t, dist: c.dist, tw: c.camTw, twT: rd?.twT ?? null, twDur: rd?.twDur ?? null, scan: s.mode, p: s.p, gph: g.phase, inst: g.instances, vis: g.meshVisible, gs: g.s,
      // r85: chữ tấm đọc thấy được = hiệu ứng tiêu đề đang chạy (hoặc không có hiệu ứng: nhóm chữ đầu đã hiện)
      open: !!st?.open, fx0: st?.titleFx ? (st.titleFx.state === 'run' ? 1 : 0) : st?.textFx?.[0]?.o ?? 1,
      // r90: thân bài (sau tiêu đề) đã bắt đầu hiện — đám mây phải hết trước đó (tiêu đề được chồng lên đám mây đang tan)
      body: st?.titleFx ? (st.titleFx.bodyStart != null ? 1 : 0) : st?.textFx?.[1]?.o ?? 1, mot: st?.motion ? { t: st.motion.t, dist: st.motion.dist, phase: st.motion.phase } : null, creep: !!rd?.creep,
    });
  }
  window.removeEventListener('reader:open', onOpen);
  if (openInfo) openInfo.t -= t0;
  return { rows, fireT, openInfo, times: window.__vm.cinemaGlyphs('times'), glyph: window.__vm.cinemaGlyphs(), read: window.__vm.cinemaRead(), timing: window.__vm.settings.timing() };
}, [mode, ms]);

// ---------------------------------------------------------------- A. bảng cài đặt
const openPanel = async () => {
  if (!(await E(() => !!document.querySelector('.cin-setwrap:not([hidden]) .sp-panel')))) await E(() => document.querySelector('.cin-gear')?.click());
  await sleep(500);
  await E(() => document.querySelector('.sp-tab[data-tab="info"]')?.click());
  await sleep(300);
};
const closePanel = async () => {
  await E(() => document.querySelector('.sp-panel .sp-x')?.click());
  await sleep(400);
};
await openPanel();
R.A = await E(() => {
  const secs = [...document.querySelectorAll('.sp-pane:not([hidden]) .sp-sec')].map((s) => ({ h: s.querySelector('.sp-h')?.textContent, subs: [...s.querySelectorAll('.sp-subh')].map((x) => x.textContent), names: [...s.querySelectorAll('.sp-name')].map((x) => x.textContent), pv: [...s.querySelectorAll('[data-preview]')].map((b) => b.dataset.preview), reset: !!s.querySelector('[data-reset-group="transition"]') }));
  return secs;
});
// r87: nhóm gọn — chỉ các điều khiển chính, theo đúng thứ tự (danh sách thấy được trên bảng)
const txVisible = () => E(() => {
  const sec = document.querySelector('.sp-sec--tx');
  if (!sec) return null;
  const vis = (n) => !!n.offsetParent;
  const items = [...sec.querySelectorAll('.sp-subh, .sp-name, [data-preview], [data-reset-group]')].filter(vis);
  return {
    list: items.filter((n) => !n.classList.contains('sp-subh')).map((n) => n.textContent.trim()),
    subs: items.filter((n) => n.classList.contains('sp-subh')).map((n) => n.textContent),
    looks: [...sec.querySelectorAll('[aria-label="Kiểu chữ sáng"] .sp-opt')].filter(vis).map((b) => b.dataset.id),
    sliders: [...sec.querySelectorAll('input[type="range"]')].filter(vis).length,
    hints: [...sec.querySelectorAll('.sp-desc')].filter(vis).length,
  };
});
R.Avis = { cloud: await txVisible() };
await setS('glyphFlyMode', 'whoosh');
await sleep(200);
R.Avis.whoosh = await txVisible();
await setS('glyphFlyMode', 'cloud');
// r89: thời gian đám mây tồn tại vượt quá đoạn tiến vào → kẹp + gợi ý ngay dưới (không kẹp lặng lẽ)
await setS('glyphCloudLife', 3.5);
await sleep(200);
R.Avis.life = await E(() => {
  const w = [...document.querySelectorAll('.sp-sec--tx .sp-warn')].find((p) => p.offsetParent);
  return { warn: w?.textContent ?? null, t: window.__vm.settings.timing() };
});
await setS('glyphCloudLife', 1.8);
await sleep(200);
R.Avis.life.after = await E(() => [...document.querySelectorAll('.sp-sec--tx .sp-warn')].filter((p) => p.offsetParent).length);
// công tắc gộp "Hiệu ứng quét": tắt → cả quét bản dập lẫn ánh sáng chữ tắt; bật lại → cả hai bật
R.Avis.toggle = await E(async () => {
  const btn = document.querySelector('.sp-sec--tx .sp-switch[data-path="scanFx"]');
  const st = () => { const s = window.__vm.settings.get(); return [s.cinemaRubbingScan, s.glyphFx, btn?.getAttribute('aria-checked')]; };
  const a = st();
  btn?.click();
  await new Promise((r) => setTimeout(r, 150));
  const b = st();
  btn?.click();
  await new Promise((r) => setTimeout(r, 150));
  return { a, b, c: st() };
});
await closePanel();
// bia không có văn bản chữ Hán căn chỉnh: không có lựa chọn "Chữ Hán (số hoá)"
await goto('bia-1670');
await openPanel();
R.Avis.other = await txVisible();
await closePanel();
await goto('bia-1442');
await openPanel();
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await E(() => document.querySelector('.sp-sec--tx')?.scrollIntoView({ block: 'start' }));
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, 'settings-group-1440x900.png') });
}
await closePanel();

// ---------------------------------------------------------------- B · C · D. giữ V (mặc định) trên 1442
await focus(2500);
R.B = await runOpen('vhold', 7000);
await closeReader();
// C. thời gian vệt quét 4,5 s (giữ rồi huỷ — chỉ đo vạch)
await setS('scanDuration', 4.5);
await focus(1500);
R.C2 = await E(async () => {
  const ev = (phase) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress: 0, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  ev('start');
  const t0 = performance.now();
  while (performance.now() - t0 < 1000) await new Promise((r) => requestAnimationFrame(r));
  const s = window.__vm.cinemaScan();
  ev('cancel');
  return { t: performance.now() - t0, p: s.p, dur: s.dur };
});
await setS('scanDuration', 3.2);
await sleep(1500);

// ---------------------------------------------------------------- E. cài đặt có hiệu lực (quét tắt → nút đọc mở ngay)
await setS('cinemaRubbingScan', false);
await setS('readerCreep', 0);
R.E = {};
for (const ez of ['quint', 'sine']) {
  await setS('readerEaseIn', ez);
  await focus(1500);
  R.E[ez] = await runOpen('button', 4200);
  await closeReader();
}
await setS('readerEaseIn', 'cubic');
await setS('readerSlideDist', 0.3);
await setS('glyphWaveEnd', 0.3);
await setS('glyphWaveJitter', 0);
await setS('glyphSpriteMax', 0.04);
await focus(1500);
R.E2 = await E(async () => {
  window.__vm.cinemaRich.read();
  let dist = null;
  let maxPx = null;
  const t0 = performance.now();
  while (performance.now() - t0 < 4200) {
    await new Promise((r) => requestAnimationFrame(r));
    const st = window.__vm.cinemaRich.dev()?.reader?.state();
    if (st?.motion?.phase === 'in') dist ??= st.motion.dist;
    const g = window.__vm.cinemaGlyphs();
    if (g.meshVisible && g.uniforms) maxPx ??= g.uniforms.maxPx;
  }
  return { dist, maxPx, times: window.__vm.cinemaGlyphs('times'), timing: window.__vm.settings.timing() };
});
await closeReader();
await resetT();

// ---------------------------------------------------------------- F. luật an toàn tự kẹp
await setS('cinemaRubbingScan', false);
await setS('readerCreep', 0);
await setS('glyphWaveEnd', 0.95);
await setS('glyphLandStart', 0.97);
await setS('glyphLandEnd', 0.6);
await openPanel();
await closePanel();
await focus(1500);
R.F = await runOpen('button', 4500);
R.Fclose = await E(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  let times = null;
  const t0 = performance.now();
  while (performance.now() - t0 < 1500) {
    await new Promise((r) => requestAnimationFrame(r));
    if (window.__vm.cinemaGlyphs().phase === 'back') times ??= window.__vm.cinemaGlyphs('times');
  }
  return { times, timing: window.__vm.settings.timing() };
});
await sleep(1500);
await resetT();

// ---------------------------------------------------------------- G. xem thử
await focus(1500);
await openPanel();
R.Gbefore = await E(() => ({ tab: document.querySelector('.sp-tab[aria-selected="true"]')?.dataset.tab, open: !!document.querySelector('.cin-setwrap:not([hidden]) .sp-panel') }));
const runPreview = () => E(async () => {
  const rows = [];
  const btn = document.querySelector('[data-preview="full"]');
  btn.click();
  const t0 = performance.now();
  let seenStart = false;
  while (performance.now() - t0 < 16000) {
    await new Promise((r) => requestAnimationFrame(r));
    const pv = window.__vm.cinemaPreview();
    const wrap = document.querySelector('.cin-setwrap');
    const g = window.__vm.cinemaGlyphs();
    rows.push({ t: performance.now() - t0, ph: pv?.phase ?? null, hidden: wrap.classList.contains('is-preview-hidden'), vis: getComputedStyle(wrap).visibility, open: window.__vm.cinemaRich.state().overlay, scan: window.__vm.cinemaScan().mode, creep: !!window.__vm.cinemaRead()?.creep, look: g.look, tr: g.trace?.on ?? 0, rake: g.shader?.on ?? 0, sprites: g.meshVisible ? g.spriteCount : 0, uMode: g.uniforms?.mode });
    if (pv) seenStart = true;
    if (seenStart && !pv) break;
  }
  await new Promise((r) => setTimeout(r, 500));
  const wrap = document.querySelector('.cin-setwrap');
  return { rows, after: { hidden: wrap.classList.contains('is-preview-hidden'), vis: getComputedStyle(wrap).visibility, panel: !!wrap.querySelector('.sp-panel'), tab: document.querySelector('.sp-tab[aria-selected="true"]')?.dataset.tab, open: window.__vm.cinemaRich.state().overlay } };
});
R.G = await runPreview();
// r86: xem thử với kiểu chữ sáng "Hình chữ dò" (1442 có dữ liệu chữ dò) — đổi kiểu trong bảng rồi bấm xem thử ngay
await setS('glyphLook', 'traced');
await sleep(400);
R.G2 = await runPreview();
await setS('glyphLook', 'stroke');

// ---------------------------------------------------------------- H. khôi phục mặc định (nhóm)
for (const [k, v] of [['readerZoomIn', 4], ['glyphGlow', 1.7], ['readerSlideEase', 'quint'], ['scanTrailFade', 'crisp'], ['cinemaRubbingScan', false], ['readerArch', 0.2]]) await setS(k, v);
await E(() => document.querySelector('[data-reset-group="transition"]')?.click());
await sleep(300);
R.H = await E(() => {
  const s = window.__vm.settings.get();
  const D = window.__vm.settings.defaults;
  const bad = window.__vm.settings.transitionKeys.filter((k) => s[k] !== D[k]);
  return { bad, arch: s.readerArch };
});
await setS('readerArch', 0.55);
await closePanel();

// ---------------------------------------------------------------- T. hiệu ứng từng chữ của tiêu đề
const traceTitle = (sel, ms = 9000) => E(async ([sel, ms]) => {
  const rows = [];
  document.querySelector(sel).click();
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    await new Promise((r) => requestAnimationFrame(r));
    const st = window.__vm.cinemaRich.dev()?.reader?.state();
    const tf = st?.titleFx;
    const chs = [...document.querySelectorAll('.rd .is-tfx .rd-ch')];
    const text = document.querySelector('.rd .rd-text');
    const tier = document.querySelector('.rd .dd-tier');
    const rest = document.querySelector('.rd .rd-title--sub');
    rows.push({
      t: performance.now() - t0, state: tf?.state ?? null, at: tf?.at ?? null, tt: tf?.t ?? null, D: tf?.D ?? null,
      chs: chs.length, moving: chs.filter((c) => c.style.transform).length, blur: chs.filter((c) => c.style.filter).length,
      shifted: chs.filter((c) => /translate/.test(c.style.transform)).length, mode: tf?.mode ?? null, titleO: +(document.querySelector('.rd .rd-title--main')?.style.opacity || 1),
      textO: text ? +(text.style.opacity || 1) : null, textY: text ? text.style.translate : '', tierO: tier ? +(tier.style.opacity || 1) : null,
      restO: rest ? +(rest.style.opacity || 1) : null,
    });
  }
  const st = window.__vm.cinemaRich.dev().reader.state();
  const all = [...document.querySelectorAll('.rd .rd-ch')];
  const head = document.querySelector('.rd .rd-title--main');
  return {
    rows, last: st.titleFxLast,
    rest: { n: all.length, styled: all.filter((c) => c.style.transform || c.style.filter || c.style.opacity || c.style.willChange).length, tfx: document.querySelectorAll('.rd .is-tfx').length, aria: head?.getAttribute('aria-label') ?? null, hidden: all.every((c) => c.getAttribute('aria-hidden') === 'true'), ddCh: document.querySelectorAll('.rd .dd-title .rd-ch').length },
  };
}, [sel, ms]);
R.Tdef = await E(() => window.__vm.settings.get().titleFxMode);
await setS('titleFxMode', 'settle');
await focus(1800);
R.T = await traceTitle('.lq-btn--read');
await closeReader();
await focus(1800);
R.Troll = await traceTitle('.lq-btn--names');
await closeReader();
// r85 (thêm 3): kiểu "Phóng sáng" · "Mờ dần"
R.Tv = {};
for (const m of ['bloom', 'fade']) {
  await setS('titleFxMode', m);
  await focus(1800);
  R.Tv[m] = await traceTitle(m === 'bloom' ? '.lq-btn--names' : '.lq-btn--read');
  await closeReader();
}
await setS('titleFxMode', R.Tdef);
{
  const B = await launch({ headed, width: W, height: H, reducedMotion: true, settings: SEED });
  await openCinema(B.page, port, { id: 'bia-1442', hooks: HOOKS, settleMs: 3000 });
  const p = await B.page.evaluate(() => window.__vm.cinemaStelePoint());
  await B.page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(2500);
  R.Trm = await B.page.evaluate(async () => {
    document.querySelector('.lq-btn--read').click();
    let maxCh = 0;
    let tf = false;
    const ops = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 4500) {
      await new Promise((r) => requestAnimationFrame(r));
      const st = window.__vm.cinemaRich.dev()?.reader?.state();
      tf = tf || !!st?.titleFx;
      maxCh = Math.max(maxCh, [...document.querySelectorAll('.rd .rd-ch')].filter((c) => c.style.transform).length);
      const slab = document.querySelector('.rd .rd-slab');
      if (st?.open) ops.push(+(getComputedStyle(slab).opacity));
    }
    return { tf, maxCh, last: window.__vm.cinemaRich.dev().reader.state().titleFxLast, opMid: ops.some((o) => o > 0.05 && o < 0.95), opEnd: ops.at(-1) };
  });
  errors.push(...B.errors);
  await B.close();
}

// ---------------------------------------------------------------- I. cổng độ sâu (đầu rùa)
await setS('readerCreep', 0);
await setS('glyphTrail', 0.6);
await setS('cinemaNames', false); // tên trên mặt bia cuộn bằng hoạt ảnh CSS (chạy cả khi vòng vẽ dừng) — tắt để so điểm ảnh
R.I = {};
const lumBox = async (box) => {
  const png = await page.screenshot({ clip: { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 } });
  return E(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, img.width, img.height).data);
  }, png.toString('base64'));
};
const diffStats = (a, b) => {
  const d = [];
  for (let i = 0; i < a.length; i += 4) d.push(Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])));
  d.sort((x, y) => x - y);
  return { n: d.length, p99: d[Math.floor(d.length * 0.99)] ?? null, max: d.at(-1) ?? null, mean: +(d.reduce((s, v) => s + v, 0) / Math.max(1, d.length)).toFixed(2) };
};
for (const id of ['bia-1442', 'bia-1664']) {
  await goto(id);
  await focus(2600);
  // mô hình đã ở LOD cao nhất (đổi LOD giữa hai ảnh = cả rùa đổi điểm ảnh)
  await E(async () => { const t0 = performance.now(); while (performance.now() - t0 < 15000) { const l = window.__vm.cinemaLods(), rv = window.__vm.cinemaReveal(); if (l.liveLod === 0 && !rv.proxy && !rv.revealing) break; await new Promise((r) => setTimeout(r, 150)); } });
  await E(() => window.__vm.cinemaLoop(false));
  const pump = (n) => E(async (n) => { for (let i = 0; i < n; i++) { window.__vm.cinemaTick(1 / 60); await new Promise((r) => requestAnimationFrame(r)); } }, n);
  await pump(10);
  const boxes = await E(() => {
    const h = window.__vm.cinemaHead().head;
    const P = (x, y, z) => window.__vm.cinemaGlyphs('project', [x, y, z]);
    // lõi hình đầu: nửa DƯỚI tâm cầu đầu (đỉnh đầu thật thấp hơn đỉnh khối cầu — tránh lẫn mặt bia sau đầu / mép bóng)
    const r = h.radius;
    const pts = [[-0.35 * r, 0], [0.35 * r, 0], [-0.35 * r, -0.55 * r], [0.35 * r, -0.55 * r]].map(([dx, dy]) => P(h.center[0] + dx, h.center[1] + dy, h.center[2]));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const head = { x0: Math.round(Math.min(...xs)), x1: Math.round(Math.max(...xs)), y0: Math.round(Math.min(...ys)), y1: Math.round(Math.max(...ys)) };
    // ô trên mặt bia ngay trên đầu rùa (đối chứng: phải đổi)
    const top = P(h.center[0], h.center[1] + h.radius * 2.2, h.center[2] - 0.35);
    const face = { x0: head.x0, x1: head.x1, y0: Math.round(top.y - 40), y1: Math.round(top.y + 40) };
    return { head, face };
  });
  const ref = { head: await lumBox(boxes.head), face: await lumBox(boxes.face) };
  await E(() => window.__vm.cinemaScan('start'));
  await pump(Math.round(3.0 * 60)); // vạch ~94 % (vệt 0,6 phủ phần dưới mặt bia)
  const on = { head: await lumBox(boxes.head), face: await lumBox(boxes.face), scan: await E(() => window.__vm.cinemaScan()) };
  await E(() => window.__vm.cinemaScan('off'));
  await pump(4);
  await E(() => window.__vm.cinemaLoop(true));
  R.I[id] = { boxes, head: diffStats(ref.head, on.head), face: diffStats(ref.face, on.face), scan: { mode: on.scan.mode, p: on.scan.p, w: on.scan.u?.[3] } };
}
await resetT();
await setS('glyphTrail', 0.22);
await setS('cinemaNames', true);
await close();

// ---------------------------------------------------------------------------- kiểm
const fmt = (v, d = 3) => (v == null ? '—' : Number(v).toFixed(d));
report.section('A. bảng cài đặt › Thông tin');
{
  const tx = R.A.find((s) => s.h === 'Chuyển cảnh toàn văn');
  const lay = R.A.find((s) => s.h === 'Bảng đọc');
  const ix = (h) => R.A.findIndex((s) => s.h === h);
  const V = R.Avis;
  const WANT = ['Hiệu ứng quét', '▶ Xem thử chuyển cảnh', 'Thời gian camera tiến vào', 'Thời gian camera lùi ra', 'Thời gian vệt quét', 'Độ dài vệt', 'Kiểu chữ sáng', 'Độ lấp lánh', 'Kiểu bay', 'Mật độ chữ bay', 'Độ sâu đám mây (xa / gần mặt bia)', 'Thời gian đám mây tồn tại', 'Kiểu hiện tiêu đề', 'Khôi phục mặc định'];
  report.check(`(r87) nhóm "Chuyển cảnh toàn văn" chỉ các điều khiển chính, đúng thứ tự: ${V.cloud?.list.join(' · ')} — ${V.cloud?.sliders} thanh trượt, tiêu đề nhỏ ${V.cloud?.subs.join(' · ')}, ${V.cloud?.hints} dòng gợi ý`, JSON.stringify(V.cloud?.list) === JSON.stringify(WANT) && JSON.stringify(V.cloud?.subs) === JSON.stringify(['Camera', 'Vệt quét & chữ', 'Tiêu đề']) && V.cloud.sliders === 8 && V.cloud.hints === 0, V.cloud);
  {
    const L = V.life;
    report.check(`(r89) "Thời gian đám mây tồn tại" 3,5 s quá đoạn tiến vào → kẹp còn ${L?.t?.lifeMax} s + gợi ý "${(L?.warn ?? '').slice(0, 60)}…"; về 1,8 s: không gợi ý (${L?.after})`, !!L?.warn && /Đã kẹp/.test(L.warn) && L.t.clamped.cloud && L.after === 0, L);
  }
  report.check('"Độ sâu đám mây" + "Thời gian đám mây tồn tại" chỉ hiện với Đám mây (Vụt qua: ẩn)', !!V.whoosh && !V.whoosh.list.includes('Độ sâu đám mây (xa / gần mặt bia)') && !V.whoosh.list.includes('Thời gian đám mây tồn tại') && V.whoosh.list.length === WANT.length - 2, V.whoosh?.list);
  report.check(`"Kiểu chữ sáng": 1442 (có văn bản chữ Hán căn chỉnh) — ${V.cloud?.looks.join(' / ')}; 1670 (chưa có) — ${V.other?.looks.join(' / ')} (không có "Chữ Hán (số hoá)")`, JSON.stringify(V.cloud?.looks) === JSON.stringify(['stroke', 'traced', 'hantext']) && JSON.stringify(V.other?.looks) === JSON.stringify(['stroke', 'traced']), { a: V.cloud?.looks, b: V.other?.looks });
  report.check(`công tắc gộp "Hiệu ứng quét": tắt → quét bản dập + ánh sáng chữ cùng tắt (${JSON.stringify(V.toggle.b)}), bật → cùng bật (${JSON.stringify(V.toggle.c)})`, JSON.stringify(V.toggle.a) === JSON.stringify([true, true, 'true']) && JSON.stringify(V.toggle.b) === JSON.stringify([false, false, 'false']) && JSON.stringify(V.toggle.c) === JSON.stringify([true, true, 'true']), V.toggle);
  report.check('nhóm "Bảng đọc" riêng, ngay trước nhóm chuyển cảnh: kiểu bảng đọc, khoảng cách chữ – bia, độ cong vòm', !!lay && ix('Bảng đọc') === ix('Chuyển cảnh toàn văn') - 1 && ['Kiểu bảng đọc', 'Khoảng cách chữ – bia', 'Độ cong vòm bảng đọc'].every((n) => lay.names.includes(n)), lay?.names);
}

report.section('B. camera nhích vào lúc giữ V → đi tiếp liên tục khi bắn');
{
  const rows = R.B.rows;
  const fi = rows.findIndex((r) => r.t >= R.B.fireT);
  const d0 = rows[0].dist;
  const dF = rows[fi].dist;
  const dEnd = rows.at(-1).dist;
  const creepFrac = (d0 - dF) / (d0 - dEnd);
  // đồng hồ của CHÍNH đoạn camera (tiến độ tween × thời lượng — không lẫn nhịp rAF của trang): đoạn nhích · đoạn tiến vào
  const C = rows.filter((r) => r.tw === 'creep' && r.twT != null).map((r) => ({ s: r.twT * r.twDur, d: r.dist }));
  const Rd = rows.filter((r) => r.tw === 'read' && r.twT != null).map((r) => ({ s: r.twT * r.twDur, d: r.dist }));
  const vel = (a, i, j) => (a[j].d - a[i].d) / (a[j].s - a[i].s);
  const early = vel(C, 1, C.findIndex((x) => x.s >= 0.3));
  const late = vel(C, C.findIndex((x) => x.s >= C.at(-1).s - 0.3), C.length - 1);
  const vb = vel(C, C.length - 4, C.length - 1);
  const va = vel(Rd, 0, 3);
  // chỗ nối: khung đầu của đoạn tiến vào (tiến độ 0 — camera đúng chỗ đoạn nhích dừng) → khung kế: bước đầu tiên sau mốc bắn
  const i0 = Rd.findIndex((x) => x.s > 1e-4);
  const vj = vel(Rd, Math.max(0, i0 - 1), i0);
  // không khung nào nhảy: vận tốc từng khung (đồng hồ đoạn camera) ≤ 1,5 × trung bình ±3 khung, quanh mốc bắn
  let jump = 0;
  for (const A of [C.slice(-20), Rd.slice(0, 20)])
    for (let i = 4; i < A.length - 3; i++) if (Math.abs(vel(A, i - 1, i)) > 1.5 * Math.abs(vel(A, i - 3, i + 3)) + 0.01) jump++;
  R.Bn = { d0, dF, dEnd, creepFrac, early, late, vb, va, vj, jump, creepFrames: C.length, k: R.B.read?.creepK };
  report.check(`bắt đầu giữ → camera nhích vào (đoạn 'creep' từ khung đầu), tăng tốc từ 0 (0,3 s đầu ${fmt(early)} · 0,3 s cuối ${fmt(late)} bán kính/s)`, rows.slice(1, 10).every((r) => r.tw === 'creep') && Math.abs(early) < 0.35 * Math.abs(late) && late < 0, R.Bn);
  report.check(`lúc bắn đã đi ${fmt(creepFrac * 100, 1)} % quãng tiến vào (cài đặt 8 % ± 2,5)`, Math.abs(creepFrac - 0.08) <= 0.025, R.Bn);
  report.check(`bắn → đoạn tiến vào đi tiếp từ đúng chỗ + vận tốc (trước ${fmt(vb)} · chỗ nối ${fmt(vj)} · sau ${fmt(va)} bán kính/s — tỉ lệ 0,8–1,25; khung nhảy ${jump})`, rows[fi + 2]?.tw === 'read' && vb < 0 && va < 0 && va / vb >= 0.8 && va / vb <= 1.25 && vj / vb >= 0.8 && vj / vb <= 1.25 && jump === 0, R.Bn);
}

report.section('C. vạch quét theo thời gian ("Thời gian vệt quét")');
{
  const rows = R.B.rows;
  const at = (ms) => rows.find((r) => r.t >= ms);
  const p1 = at(1000).p;
  const pF = rows.find((r) => r.t >= R.B.fireT).p;
  const reach = rows.find((r) => r.p >= 1);
  R.Cn = { p1, pF, reachT: reach?.t, after: [...new Set(rows.filter((r) => r.t > R.B.fireT).map((r) => r.scan))] };
  report.check(`3,2 s: vạch ${fmt(p1)} sau 1 s (≈ 0,313) · ${fmt(pF)} lúc bắn (≈ 0,625) · tới chân mặt bia ở ${Math.round(reach?.t ?? -1)} ms (≈ 3200) — đi tiếp sau khi bắn rồi xong`, Math.abs(p1 - 1 / 3.2) <= 0.03 && Math.abs(pF - 2 / 3.2) <= 0.04 && reach && Math.abs(reach.t - 3200) <= 160 && R.Cn.after.includes('fire') && R.Cn.after.includes('held'), R.Cn);
  report.check(`4,5 s: vạch ${fmt(R.C2.p)} sau ${Math.round(R.C2.t)} ms (≈ 0,222)`, R.C2.dur === 4.5 && Math.abs(R.C2.p - R.C2.t / 1000 / 4.5) <= 0.03, R.C2);
}

report.section('D. chữ Hán bay cùng camera');
{
  const { times, openInfo, rows } = R.B;
  const sp = times?.sprites ?? [];
  const det = sp.map((s) => s[0]);
  const end = sp.map((s) => s[0] + s[1]);
  const textAt = openInfo?.textAt;
  const pEnd = times?.timing?.pEnd;
  const midFly = rows.filter((r) => r.tw === 'read' && r.twT > 0.15 && r.twT < 0.45 && r.vis && r.inst > 0).length;
  const textRows = rows.filter((r) => r.open && r.fx0 > 0.001);
  const bodyRows = rows.filter((r) => r.open && r.body > 0.001);
  const both = bodyRows.filter((r) => r.vis).length;
  // r90: tiêu đề chồng lên đám mây — từ khung đầu có tiêu đề tới khung cuối còn sprite (s), ≤ readerCloudOverlap (+ 2 khung)
  const lastVis = rows.filter((r) => r.vis).at(-1)?.t ?? null;
  const ovS = textRows.length && lastVis != null ? Math.max(0, (lastVis - textRows[0].t) / 1000) : 0;
  const ovWant = R.B.timing?.overlap ?? 0;
  R.Dn = { n: sp.length, minDet: Math.min(...det), maxDet: Math.max(...det), maxEnd: Math.max(...end), textAt, pEnd, wave: R.B.glyph?.wave, midFly, textRows: textRows.length, bodyRows: bodyRows.length, both, ovS: +ovS.toFixed(3), ovWant };
  report.check(`${sp.length} hạt bay: tách sớm nhất ${fmt(R.Dn.minDet)} ≥ 0 (sau lúc bắn), muộn nhất ${fmt(R.Dn.maxDet)} < chữ tấm đọc ${fmt(textAt)}; trôi / bay xong ${fmt(R.Dn.maxEnd)} ≤ pEnd ${fmt(pEnd)}`, sp.length === R.B.glyph.flyCount && sp.length > 100 && R.Dn.minDet >= 0 && R.Dn.maxDet < textAt && R.Dn.maxEnd <= pEnd + 1e-3, R.Dn);
  report.check(`sóng tách chồng lên đoạn tiến vào: sprite đang bay ở ${midFly} khung (camera 15–45 %); không khung nào vừa có THÂN BÀI vừa có sprite (${bodyRows.length} khung có thân bài)`, midFly > 10 && bodyRows.length > 10 && both === 0, R.Dn);
  report.check(`(r90) tiêu đề tấm đọc hiện CHỒNG lên lúc đám mây còn tan: ${R.Dn.ovS} s (đặt ${ovWant} s — không quá, ±2 khung), không đợi chữ cuối`, ovWant > 0.3 && R.Dn.ovS > 0.25 && R.Dn.ovS <= ovWant + 0.04, R.Dn);
}

report.section('E. cài đặt có hiệu lực');
{
  const curves = { quint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2), sine: (t) => (1 - Math.cos(Math.PI * t)) / 2 };
  for (const ez of ['quint', 'sine']) {
    const rows = R.E[ez].rows.filter((r) => r.tw === 'read' && r.twT != null);
    const d0 = rows[0]?.dist;
    const d1 = R.E[ez].rows.at(-1).dist;
    const errs = [0.25, 0.5, 0.75].map((q) => {
      const r = rows.find((x) => x.twT >= q);
      return r ? +Math.abs((d0 - r.dist) / (d0 - d1) - (curves[ez](r.twT) - curves[ez](rows[0].twT)) / (1 - curves[ez](rows[0].twT))).toFixed(4) : 1;
    });
    report.check(`đường cong tiến vào "${ez}": tiến độ bán kính camera đúng đường cong ở 25 / 50 / 75 % (lệch ${errs.join(' / ')} ≤ 0,03)`, rows.length > 20 && errs.every((e) => e <= 0.03), { errs, n: rows.length });
  }
  report.check(`quãng trượt 0,3 × cao khung = ${Math.round(0.3 * H)} px (${R.E2.dist})`, R.E2.dist === Math.round(0.3 * H), R.E2.dist);
  const det = (R.E2.times?.sprites ?? []).map((s) => s[0]);
  report.check(`tách chữ muộn nhất 0,30 (lệch 0): tách muộn nhất ${fmt(Math.max(...det))} ≤ 0,30`, det.length > 0 && Math.max(...det) <= 0.3 + 1e-3, { max: Math.max(...det), timing: R.E2.timing });
  report.check(`cỡ sprite tối đa 0,04 × ${H} = ${0.04 * H} px (${R.E2.maxPx})`, Math.abs((R.E2.maxPx ?? 0) - 0.04 * H) < 0.5, R.E2.maxPx);
}

report.section('F. luật an toàn tự kẹp');
{
  const T = R.F.timing;
  const sp = R.F.times?.sprites ?? [];
  const end = Math.max(...sp.map((s) => s[0] + s[1]));
  const textRows = R.F.rows.filter((r) => r.open && r.fx0 > 0.001);
  report.check(`sóng tách muộn nhất đặt 0,95 → kẹp còn ${fmt(T.waveEnd)} (< chữ tấm đọc ${fmt(T.textAt)} − lề − bay)` + " (r87: không còn gợi ý trên bảng — luật kẹp vẫn tự áp)", T.clamped.waveEnd && T.waveEnd <= T.pEnd - 0.05 + 1e-6, { T });
  const bodyRowsF = R.F.rows.filter((r) => r.open && r.body > 0.001);
  report.check(`vẫn không có sprite lúc THÂN BÀI tấm đọc hiện (${bodyRowsF.length} khung có thân bài, sprite cuối hết ở ${fmt(end)} ≤ pEnd ${fmt(T.pEnd)}; tiêu đề chồng ≤ ${T.overlap} s)`, sp.length > 0 && end <= T.pEnd + 1e-3 && textRows.length > 5 && bodyRowsF.length > 5 && bodyRowsF.every((r) => !r.vis), { end, pEnd: T.pEnd });
  const bt = R.Fclose.times?.sprites ?? [];
  const arr = bt.map((s) => s[2] + s[3]);
  const L = R.Fclose.timing;
  report.check(`cửa sổ chạm đá đặt ngược (0,97 → 0,60) → kẹp ${fmt(L.landStart)} → ${fmt(L.landEnd)}; mọi chữ chạm đá trong đó (${fmt(Math.min(...arr))} … ${fmt(Math.max(...arr))}), trước khi camera lùi xong` + " (r87: không còn gợi ý trên bảng)", L.clamped.land && bt.length > 0 && Math.min(...arr) >= L.landStart - 1e-3 && Math.max(...arr) <= L.landEnd + 1e-3 && L.landEnd <= 0.99, { L, min: Math.min(...arr), max: Math.max(...arr) });
}

report.section('G. "▶ Xem thử chuyển cảnh"');
{
  const rows = R.G.rows;
  const phases = [...new Set(rows.map((r) => r.ph).filter(Boolean))];
  const during = rows.filter((r) => r.ph);
  report.check(`chạy cả lượt trên bia đang hiện: ${phases.join(' → ')} (giữ có vạch quét + camera nhích, lớp đọc mở rồi đóng)`, JSON.stringify(phases) === JSON.stringify(['start', 'hold', 'open', 'read', 'close']) && rows.some((r) => r.ph === 'hold' && r.scan === 'hold' && r.creep) && rows.some((r) => r.open), { phases, ms: Math.round(rows.at(-1)?.t ?? 0) });
  const t1 = during[0]?.t ?? 0;
  report.check('bảng cài đặt ẩn suốt lượt (không bấm được — sau 0,25 s mờ đi), hiện lại sau đúng tab Thông tin; lớp đọc đã đóng', during.length > 60 && during.every((r) => r.hidden) && during.filter((r) => r.t - t1 > 250).every((r) => r.vis === 'hidden') && !R.G.after.hidden && R.G.after.vis === 'visible' && R.G.after.panel && R.G.after.tab === 'info' && R.Gbefore.tab === 'info' && !R.G.after.open, { before: R.Gbefore, after: R.G.after });
}

{
  const rows = R.G2.rows;
  const phases = [...new Set(rows.map((r) => r.ph).filter(Boolean))];
  const hold = rows.filter((r) => r.ph === 'hold');
  const open = rows.filter((r) => r.ph === 'open');
  report.check(`(r86) xem thử với "Hình chữ dò": ${phases.join(' → ')}; lúc giữ mặt nạ chữ dò bật (${hold.filter((r) => r.tr === 1).length} / ${hold.length} khung) cùng đèn xiên; lúc mở chữ dò bay (${Math.max(0, ...open.map((r) => r.sprites))} sprite hình chữ)`, JSON.stringify(phases) === JSON.stringify(['start', 'hold', 'open', 'read', 'close']) && hold.length > 20 && hold.filter((r) => r.tr === 1).length >= hold.length * 0.6 && hold.some((r) => r.rake === 1) && rows.some((r) => r.look === 'traced') && open.some((r) => r.sprites > 0), { phases, n: rows.length });
}

report.section('H. khôi phục mặc định (nhóm)');
report.check('mọi khoá của nhóm về mặc định; cài đặt ngoài nhóm (độ cong vòm 0,2) giữ nguyên', R.H.bad.length === 0 && R.H.arch === 0.2, R.H);

report.section('T. hiệu ứng từng chữ của tiêu đề tấm đọc');
{
  const T = R.T;
  const run = T.rows.filter((r) => r.state === 'run');
  const tEnd = run.length ? run[0].t + (T.last?.tEnd ?? 1.4) * 1000 : null;
  const firstBody = T.rows.find((r) => r.state === 'run' && r.textO > 0.001 && r.textO < 1);
  const bodyBefore = T.rows.filter((r) => r.state === 'run' && r.tt != null && r.tt < (T.last?.tEnd ?? 1.4) && r.textO > 0.001);
  report.check(`kiểu mặc định "Phóng sáng" (${R.Tdef})`, R.Tdef === 'bloom', R.Tdef);
  report.check(`"Lắng từ trái", mở ở đầu: ${T.last?.chars} chữ / ${T.last?.lines} dòng (span aria-hidden, tiêu đề giữ aria-label "${T.rest.aria}"); lúc chạy có chữ đang biến hình (tối đa ${Math.max(0, ...run.map((r) => r.moving))}) + nhoè`, T.last?.mode === 'settle' && T.last?.at === 'top' && T.last.chars >= 10 && run.some((r) => r.shifted > 3) && T.last.lines >= 1 && run.some((r) => r.moving > 5) && run.some((r) => r.blur > 0) && T.rest.hidden && /Văn bia/.test(T.rest.aria ?? ''), { last: T.last, rest: T.rest });
  report.check(`đứng yên: không chữ nào còn transform / nhoè / độ mờ (${T.rest.styled} / ${T.rest.n}), hết lớp .is-tfx (${T.rest.tfx})`, T.rest.styled === 0 && T.rest.tfx === 0 && T.rows.at(-1).state === null, T.rest);
  report.check(`thân bài chỉ trượt lên SAU khi tiêu đề xong (bắt đầu ở ${T.last?.bodyStart?.toFixed(2)} s ≥ ${T.last?.tEnd} s; ${bodyBefore.length} khung thân bài hiện trước)`, T.last?.bodyStart != null && T.last.bodyStart >= T.last.tEnd && bodyBefore.length === 0 && !!firstBody, { bodyStart: T.last?.bodyStart, tEnd: T.last?.tEnd, firstBody });
  const Rl = R.Troll;
  const tierBefore = Rl.rows.filter((r) => r.state === 'run' && r.tt != null && r.tt < (Rl.last?.tEnd ?? 1.4) && r.tierO > 0.001);
  report.check(`mở ở Đề danh: hiệu ứng ở "Đề danh Tiến sĩ" (${Rl.rest.ddCh} chữ), bảng vàng trượt lên sau (${tierBefore.length} khung hiện trước)`, Rl.last?.at === 'roll' && Rl.rest.ddCh >= 10 && tierBefore.length === 0 && Rl.last.bodyStart >= Rl.last.tEnd && Rl.rest.styled === 0, { last: Rl.last, rest: Rl.rest });
  {
    const b = R.Tv.bloom;
    const run = b.rows.filter((r) => r.state === 'run');
    report.check(`"Phóng sáng" (Đề danh): chữ hiện theo thứ tự ngẫu nhiên, chỉ phóng cỡ (không lệch chỗ: ${Math.max(0, ...run.map((r) => r.shifted))} chữ có translate), bảng vàng sau tiêu đề, đứng yên sắc nét`, b.last?.mode === 'bloom' && b.last.at === 'roll' && run.some((r) => r.moving > 3) && run.every((r) => r.shifted === 0) && b.last.bodyStart >= b.last.tEnd && b.rest.styled === 0 && b.rest.tfx === 0, { last: b.last, rest: b.rest });
    const f = R.Tv.fade;
    const runF = f.rows.filter((r) => r.state === 'run');
    report.check(`"Mờ dần": tiêu đề mờ vào (không tách chữ — ${Math.max(0, ...runF.map((r) => r.chs))} chữ đang hiệu ứng), thân bài sau tiêu đề`, f.last?.mode === 'fade' && runF.every((r) => r.chs === 0) && runF.some((r) => r.titleO > 0.05 && r.titleO < 0.95) && f.last.bodyStart >= f.last.tEnd && f.rest.styled === 0, { last: f.last });
  }
  report.check('giảm chuyển động: chỉ mờ chéo — không hiệu ứng tiêu đề, không chữ nào biến hình', !R.Trm.tf && R.Trm.maxCh === 0 && R.Trm.last == null && R.Trm.opEnd > 0.95, R.Trm);
}

report.section('I. cổng độ sâu: không bản dập / vệt / chữ trên đầu rùa');
for (const [id, r] of Object.entries(R.I)) {
  report.check(`${id}: đang quét (vạch ${fmt(r.scan.p, 2)}, vệt 0,6) — vùng đầu rùa không đổi (Δ sRGB p99 ${r.head.p99} ≤ 3, TB ${r.head.mean}); mặt bia ngay trên đổi (TB ${r.face.mean})`, r.scan.w === 1 && r.head.n > 100 && r.head.p99 <= 3 && r.face.mean > 2 * Math.max(0.5, r.head.mean), r);
}

if (argv.includes('--dump')) fs.writeFileSync(argv[argv.indexOf('--dump') + 1], JSON.stringify({ B: R.B.rows, fireT: R.B.fireT, G: R.G.rows }, null, 0));
process.exit(report.finish(errors));
