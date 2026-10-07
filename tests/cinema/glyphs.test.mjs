// r82b → r85 — ÁNH SÁNG CHỮ trên mặt bia (stage/glyphs.js + polish.js). r85 (người dùng chọn phương án C: "không bao giờ hiện hình chữ
// dò"): vạch quét là đèn xiên trên phù điêu THẬT của mô hình (+ ánh lưu trong vệt), dải tiêu đề có đèn xiên quét qua lại, hạt sáng lấy
// mẫu từ bản đồ nét của bản dập (mọi bia có bản dập), mở toàn văn → đám mây hạt sáng camera bay xuyên qua, đóng → hạt tụ về đá.
//   A. 5 bia nguồn v2 (1442 · 1554 · 1670 · 1754 · 1779): focus → không tải gì từ glyphs/ (không atlas / bản đồ id chữ), hạt sáng lấy
//      mẫu từ bản đồ nét (src 'stroke', 1–3000 điểm, có điểm trên dải tiêu đề, độ đậm nét trung bình TẠI điểm ≥ 3 × trung bình ô chữ —
//      điểm nằm trên nét khắc thật), tất định (lấy mẫu lại cùng kết quả); shader đá không còn uniform bản đồ chữ; giữ → bắn → đám mây
//      → hết trước chữ tấm đọc, không lỗi
//   B. đèn xiên: camera đứng yên, quét bản dập TẮT (chỉ đèn xiên + ít hạt), vạch ở ~45 % — dải ngay trên vạch sáng lên (Δ độ sáng
//      trung bình > 0), xa dưới vạch không đổi; "Độ sáng đèn xiên" 0 → dải đó không đổi (Δ trung bình ≈ 0): thay đổi là của đèn xiên
//   C. dải tiêu đề: đèn quét đi qua lại (tâm cửa sổ chạy hết bề ngang dải, đổi chiều); hai thời điểm → vùng sáng ở hai chỗ khác nhau
//      (không hình tĩnh nào); tắt quét qua lại → chỉ một chiều
//   D. đám mây: thời gian camera đi xuyên đám mây ≈ "Thời gian bay xuyên mây" (1,0 s · 1,8 s ± 20 %); không hạt nào lúc chữ tấm đọc
//      hiện; bay về: hạt tụ về đúng chỗ trên đá (≤ 1,5 px lúc chạm), xong tắt hẳn
//   E. "Vụt qua" (kiểu r84) vẫn chạy: hạt bay qua camera, hết trước chữ tấm đọc
//   F. tắt hiệu ứng: không đèn xiên / hạt (uGlyph.x = 0), vạch + vệt bản dập vẫn chạy
//   G. bia không có bản dập (1554 với catalog v2 bị chặn → nguồn v1, như bia v1 cũ): hạt rải đều trên ô chữ (src 'plain'), đèn xiên chạy, không tải gì
//   H. giảm chuyển động: không hạt bay (chỉ lấp lánh rồi tắt tại chỗ)
//   T. (r86) kiểu chữ sáng "Hình chữ dò" (dữ liệu chữ dò 82 bia — models-v2/glyphs, hệ ảnh bản dập 82 bia): 1442 — nạp đúng 3 tệp;
//      sprite hình chữ = round(mật độ × số chữ); dải tiêu đề không bao giờ có mặt nạ (bản đồ id trong khung dải tiêu đề trống, không
//      sprite ở đó, ảnh dải tiêu đề như Nét khắc ở cùng khung); mặt nạ sáng sau vệt (thân bia trên đường sáng đổi rõ, dưới vạch không);
//      bay ra Đám mây / Vụt qua hết trước chữ tấm đọc, bay về chạm đúng chỗ · mẫu 1554 / 1754 / 1779 · nạp lỗi (1670, 404) → Nét khắc
//   K. (r87) "Chữ Hán (số hoá)" trên 1442: chỉ chữ ≥ ngưỡng tin cậy được đặt (đếm độc lập từ chars.json, đổi ngưỡng 0,9), ô dưới ngưỡng
//      không có chữ (bản đồ id), dải tiêu đề không đổi, chữ sáng sau vệt (không le lói trước vạch), bia không có văn bản → Nét khắc;
//      chữ bay (Chữ Hán · Hình chữ dò, Đám mây · Vụt qua, ra + về) dựng đứng, đúng tỉ lệ ô atlas ± 3 % — đo bằng điểm ảnh (vẽ riêng
//      từng sprite lên nền đen, quad tô kín: rộng / cao theo độ phủ dưới 1 px + độ lấp đầy — xoay thì < 1); độ sâu đám mây trải dọc trục camera, toả ngang như cũ
//   V. (r86) nguồn v1 (không models-v2) — 1442: chữ dò từ public/glyphs/bia-1442/ (khung mô hình v1), mặt nạ + chữ dò bay; bia v1
//      khác (1554, mục G): Hình chữ dò → Nét khắc, không tải gì
//   P. hiệu năng: phần THÊM của hiệu ứng (bật − tắt, cùng lượt giữ / bay) theo p95 giá khung (đồng hồ tường, chặn tới khi GPU
//      vẽ xong) ở 1920×1080 (≤ 1 ms) và 3840×2160 (≤ 2 ms)
// node tests/cinema/glyphs.test.mjs --port 5180   (≈ 6 phút)
import fs from 'node:fs';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('glyphs');
const W = 1440;
const H = 900;
const SEED = { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, readerCreep: 0, cinemaNames: false };
const HOOKS = ['cinemaStelePoint', 'cinemaRich', 'cinemaRead', 'cinemaCam', 'cinemaGlyphs', 'cinemaScan', 'cinemaLoop', 'cinemaTick', 'cinemaInfo', 'cinemaIdle', 'cinemaTxProgress', 'cinemaLods', 'cinemaReveal', 'cinemaGpuTime', 'cinemaFrameCost'];
const GEN = JSON.parse(fs.readFileSync(new URL('../../src/data/rubbings.generated.json', import.meta.url), 'utf8')).steles;
const { ctx, page, close, errors } = await launch({ headed, width: W, height: H, settings: SEED });
const glyphReqs = [];
ctx.on('request', (r) => {
  if (r.url().includes('/glyphs/')) glyphReqs.push(r.url());
});
await openCinema(page, port, { id: 'bia-1442', hooks: HOOKS, settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const setS = (k, v) => E(([k, v]) => window.__vm.settings.set(k, v), [k, v]);
const G = (cmd, a) => E(([c, a]) => window.__vm.cinemaGlyphs(c, a), [cmd, a]);
const R = {};

const goto = (id) => E(async (id) => {
  if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 100));
    if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0) break;
  }
}, id);
const focus = async (ms = 2200) => {
  const p = await E(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(ms);
};
const lod0 = () => E(async () => {
  const t0 = performance.now();
  while (performance.now() - t0 < 15000) {
    const l = window.__vm.cinemaLods(), rv = window.__vm.cinemaReveal();
    if (l.liveLod === 0 && !rv.proxy && !rv.revealing) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
});
const ready = () => E(async () => {
  const t0 = performance.now();
  while (performance.now() - t0 < 8000) {
    if (window.__vm.cinemaGlyphs().ready) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
});
const vh = (phase, progress = 0) => E(([phase, progress]) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })), [phase, progress]);
const pump = (n, dt = 1 / 60) => E(async ([n, dt]) => {
  for (let i = 0; i < n; i++) {
    window.__vm.cinemaTick(dt);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, [n, dt]);
/** Một lượt mở bằng giữ V (2 s rồi bắn) — vết mỗi khung (đồng hồ của chính đoạn camera): camera z (toạ độ bia), chữ tấm đọc, hạt. */
const runOpen = (ms = 7000, lift = false) => E(async ([ms, lift]) => {
  const rows = [];
  // r88: mẫu hình học lúc NÂNG (chữ / hạt bay: vị trí so với chỗ trên đá — chỉ dọc pháp tuyến) ở các hạt bay đầu tiên
  const liftRows = [];
  let pick = null;
  let info = null;
  const on = (e) => (info = { textAt: e.detail.textAt, dur: e.detail.dur });
  window.addEventListener('reader:open', on);
  const ev = (phase, progress) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  ev('start', 0);
  const t0 = performance.now();
  let fired = false;
  while (performance.now() - t0 < ms) {
    await new Promise((r) => requestAnimationFrame(r));
    const t = performance.now() - t0;
    if (!fired && t >= 2000) {
      fired = true;
      ev('fire', 1);
    }
    const g = window.__vm.cinemaGlyphs();
    const rd = window.__vm.cinemaRead();
    const st = window.__vm.cinemaRich.dev()?.reader?.state();
    rows.push({ t, ph: g.phase, vis: g.meshVisible, mode: g.mode, s: g.s, tw: rd?.tw, twT: rd?.twT, twDur: rd?.twDur, z: rd?.camLocal?.z, open: !!st?.open, text: (st?.textFx?.[0]?.o ?? 1) > 0.001 && !!st?.open && (st?.titleFx?.state !== 'armed'),
      // r90: thân bài đã hiện (tiêu đề được chồng lên đám mây đang tan — thân bài thì không)
      body: !!st?.open && (st?.titleFx ? st.titleFx.bodyStart != null : (st?.textFx?.[1]?.o ?? 1) > 0.001), uMode: g.uniforms?.mode });
    if (lift && g.phase === 'out' && g.uniforms?.mode === 3) {
      if (!pick) {
        pick = [];
        for (let i = 0; i < g.count && pick.length < 16; i += 7) {
          const at = window.__vm.cinemaGlyphs('at', i);
          if (at?.fly) pick.push({ i, x: at.x, y: at.y, z: at.z });
        }
      }
      for (const q of pick) {
        const pr = window.__vm.cinemaGlyphs('sprite', q.i);
        if (pr && pr.tau > 0 && pr.tau < 1) liftRows.push({ i: q.i, tau: pr.tau, d: [pr.pos[0] - q.x, pr.pos[1] - q.y, pr.pos[2] - q.z] });
      }
    }
  }
  window.removeEventListener('reader:open', on);
  let depths = null;
  if (lift) {
    const g = window.__vm.cinemaGlyphs();
    depths = [];
    for (let i = 0; i < g.count; i++) {
      const at = window.__vm.cinemaGlyphs('at', i);
      if (at?.fly) depths.push(at.depth);
    }
  }
  return { rows, info, cloud: window.__vm.cinemaGlyphs().cloud, times: window.__vm.cinemaGlyphs('times'), liftRows, depths };
}, [ms, lift]);
const closeReader = async () => {
  await page.keyboard.press('Escape');
  await sleep(2600);
};
/** Ảnh chụp → độ sáng tuyến tính, đo trung vị Δ trên một hộp px. */
async function shot() {
  const png = (await page.screenshot()).toString('base64');
  return E(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    (window.__shots ??= []).push({ w: img.width, L: (x, y) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); } });
    return window.__shots.length - 1;
  }, png);
}
/** Trung vị Δ (b − a) trên hộp toạ độ bia [x0, x1] × [y0, y1] (chiếu qua camera hiện tại). */
const bandDelta = (a, b, x0, x1, y0, y1) => E(([a, b, x0, x1, y0, y1]) => {
  const P = (x, y) => window.__vm.cinemaGlyphs('project', [x, y]);
  const p00 = P(x0, y1);
  const p11 = P(x1, y0);
  const A = window.__shots[a];
  const B = window.__shots[b];
  const ds = [];
  for (let y = p00.y + 2; y < p11.y - 2; y += 2) for (let x = p00.x + 2; x < p11.x - 2; x += 2) ds.push(B.L(x, y) - A.L(x, y));
  ds.sort((u, v) => u - v);
  return { n: ds.length, med: ds.length ? +ds[ds.length >> 1].toFixed(5) : null, p90: ds.length ? +ds[Math.floor(ds.length * 0.9)].toFixed(5) : null, mean: ds.length ? +(ds.reduce((t, d) => t + d, 0) / ds.length).toFixed(5) : null };
}, [a, b, x0, x1, y0, y1]);

// ---------------------------------------------------------------- A. 5 bia v2
const IDS = ['bia-1442', 'bia-1554', 'bia-1670', 'bia-1754', 'bia-1779'];
R.A = {};
for (const id of IDS) {
  await goto(id);
  await focus(2200);
  const ok = await ready();
  const st = await G();
  const again = await E(async () => {
    // lấy mẫu lại (tất định): điểm 0, 37, cuối
    const a = [0, 37].map((i) => window.__vm.cinemaGlyphs('at', i));
    return a.map((p) => p && [p.x, p.y]);
  });
  const shaderKeys = await E(() => Object.keys(window.__vm.cinemaGlyphs().shader ?? {}));
  const run = await runOpen(6500);
  await closeReader();
  const textRows = run.rows.filter((r) => r.body); // r90: thân bài (tiêu đề được chồng lên đám mây đang tan)
  R.A[id] = { ok, count: st.count, headerCount: st.headerCount, src: st.src, energy: st.energy, ms: st.sampleMs, again, shaderKeys, modes: [...new Set(run.rows.map((r) => r.uMode))], phases: [...new Set(run.rows.map((r) => r.ph))], spritesAtText: textRows.filter((r) => r.vis).length, textRows: textRows.length, cloud: !!run.cloud };
}
// tất định: lấy mẫu lần hai trên 1442 (đổi bia rồi về)
await goto('bia-1442');
await focus(2200);
await ready();
R.Adet = await E(() => [0, 37].map((i) => { const p = window.__vm.cinemaGlyphs('at', i); return p && [p.x, p.y]; }));
R.Areq = glyphReqs.length;

// ---------------------------------------------------------------- B. đèn xiên (camera đứng yên, quét bản dập tắt)
await setS('cinemaRubbingScan', false);
await setS('sparkleDensity', 0.1);
await setS('headSweepGlow', 0);
R.B = {};
for (const glow of [1, 0]) {
  await setS('rakeGlow', glow);
  await focus(2500);
  await lod0();
  await E(() => window.__vm.cinemaLoop(false));
  await pump(20);
  const s0 = await shot();
  await E(() => window.__vm.cinemaScan('start'));
  await pump(Math.round(0.45 * 3.2 * 60));
  const sc = await E(() => window.__vm.cinemaScan());
  const s1 = await shot();
  const F = GEN['bia-1442'].frame;
  const x0 = F.left + 0.05 * (F.right - F.left);
  const x1 = F.right - 0.05 * (F.right - F.left);
  R.B[glow] = { bar: sc.barY, near: await bandDelta(s0, s1, x0, x1, sc.barY + 0.005, sc.barY + 0.04), far: await bandDelta(s0, s1, x0, x1, F.bottom + 0.03, Math.min(sc.barY - 0.15, F.bottom + 0.2)), on: (await G()).shader?.on };
  await E(() => window.__vm.cinemaScan('off'));
  await pump(4);
  await E(() => window.__vm.cinemaLoop(true));
  await sleep(300);
}
await setS('rakeGlow', 1);
await setS('headSweepGlow', 1);

// ---------------------------------------------------------------- C. đèn quét dải tiêu đề
await focus(1500);
await E(() => window.__vm.cinemaLoop(false));
await E(() => window.__vm.cinemaScan('start'));
R.C = await E(async () => {
  const xs = [];
  for (let i = 0; i < 260; i++) {
    window.__vm.cinemaTick(1 / 60);
    const sh = window.__vm.cinemaGlyphs().shader;
    xs.push(sh.headX);
    await new Promise((r) => requestAnimationFrame(r));
  }
  const sh = window.__vm.cinemaGlyphs().shader;
  return { xs, band: sh.headB, amp: sh.headAmp };
});
// hai thời điểm → vùng sáng khác chỗ (ảnh): Δ giữa hai ảnh trên dải tiêu đề, theo cột trái / phải
const hb = R.C.band;
const cs1 = await shot();
await pump(Math.round(0.45 * 1.8 * 60));
const cs2 = await shot();
R.Cmove = { left: await bandDelta(cs1, cs2, hb[0], hb[0] + 0.3 * (hb[1] - hb[0]), hb[2], hb[3]), right: await bandDelta(cs1, cs2, hb[1] - 0.3 * (hb[1] - hb[0]), hb[1], hb[2], hb[3]) };
await E(() => window.__vm.cinemaScan('off'));
await pump(4);
await setS('headSweepBounce', false);
await E(() => window.__vm.cinemaScan('start'));
R.Cone = await E(async () => {
  const xs = [];
  for (let i = 0; i < 260; i++) {
    window.__vm.cinemaTick(1 / 60);
    xs.push(window.__vm.cinemaGlyphs().shader.headX);
    await new Promise((r) => requestAnimationFrame(r));
  }
  return xs;
});
await E(() => window.__vm.cinemaScan('off'));
await pump(4);
await E(() => window.__vm.cinemaLoop(true));
await setS('headSweepBounce', true);
await setS('cinemaRubbingScan', true);
await setS('sparkleDensity', 0.5);

// ---------------------------------------------------------------- D. đám mây (r88): nâng thẳng theo pháp tuyến · độ sâu · không hạt lúc có chữ · bay về
R.D = {};
for (const ct of [1.0, 1.6]) {
  await setS('glyphCloudDist', ct);
  await focus(1800);
  R.D[ct] = await runOpen(7000, true);
  if (ct === 1.0) {
    // bay về: mẫu hạt mỗi khung (đúng công thức shader) — chạm đá đúng chỗ
    R.Dback = await E(async () => {
      const rows = [];
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const t0 = performance.now();
      while (performance.now() - t0 < 2400) {
        await new Promise((r) => requestAnimationFrame(r));
        const g = window.__vm.cinemaGlyphs();
        const row = { ph: g.phase, sp: [] };
        if (g.phase === 'back')
          for (const n of [0, 3, 7, 101, 257, 513, 777, 1001]) {
            const s = window.__vm.cinemaGlyphs('sprite', n);
            if (s) s.landPx = window.__vm.cinemaGlyphs('project', [s.land.x, s.land.y, s.land.z]);
            row.sp.push(s);
          }
        rows.push(row);
      }
      return { rows, after: window.__vm.cinemaGlyphs() };
    });
    await sleep(800);
  } else await closeReader();
}
await setS('glyphCloudDist', 1.0);

// ---------------------------------------------------------------- E. vụt qua (r84)
await setS('glyphFlyMode', 'whoosh');
await focus(1800);
R.E = await runOpen(6500);
await closeReader();
await setS('glyphFlyMode', 'cloud');

// ---------------------------------------------------------------- F. tắt hiệu ứng
await setS('glyphFx', false);
await focus(1800);
R.F = await E(async () => {
  const ev = (phase, progress) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  ev('start', 0);
  let on = 0;
  let vis = false;
  let trail = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 1500) {
    await new Promise((r) => requestAnimationFrame(r));
    const g = window.__vm.cinemaGlyphs();
    on = Math.max(on, g.shader?.on ?? 0);
    vis = vis || g.meshVisible;
    trail = trail || window.__vm.cinemaScan().trail;
  }
  const w = window.__vm.cinemaScan().u?.[3];
  ev('cancel', 0.7);
  return { on, vis, trail, w };
});
await sleep(800);
await setS('glyphFx', true);
R.Freq = glyphReqs.length;

// ---------------------------------------------------------------- T. r86 kiểu chữ sáng "Hình chữ dò" (1442 — dữ liệu chữ dò v1)
await goto('bia-1442');
await setS('glyphLook', 'traced');
await focus(2200);
R.T = {};
R.T.state = await E(async () => {
  const t0 = performance.now();
  while (performance.now() - t0 < 10000) {
    const g = window.__vm.cinemaGlyphs();
    if (g.ready && g.look === 'traced') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const g = window.__vm.cinemaGlyphs();
  // sprite hình chữ: đếm từ thuộc tính từng hạt (không tin số tổng)
  let glyphInst = 0;
  let glyphFly = 0;
  let inHeader = 0;
  const hb = g.headBand;
  for (let i = 0; i < g.count; i++) {
    const p = window.__vm.cinemaGlyphs('at', i);
    if (!p?.glyph) continue;
    glyphInst++;
    if (p.fly) glyphFly++;
    if (hb && p.y >= hb.y0 - 0.002) inHeader++;
  }
  return { look: g.look, ready: g.ready, space: g.traceSpace, count: g.count, headerCount: g.headerCount, glyphCount: g.glyphCount, spriteCount: g.spriteCount, density: g.density, headerGlyphs: g.headerGlyphs, dropped: g.headerPixelsDropped, headerIdsLeft: g.headerIdsLeft, loads: g.loads, glyphInst, glyphFly, inHeader, headBand: hb };
});
R.T.reqs = glyphReqs.length;
// mặt nạ sáng sau vệt + dải tiêu đề KHÔNG có mặt nạ: hai lượt giữ tất định (cùng số khung, cùng nhịp lấp lánh) ở hai kiểu chữ sáng,
// camera đứng yên, quét bản dập tắt (chỉ vạch + đèn xiên) — so ảnh: thân bia trên đường sáng khác hẳn, dải tiêu đề giống hệt
await setS('cinemaRubbingScan', false);
await focus(1500);
await lod0();
const holdShot = async (look) => {
  await setS('glyphLook', look);
  await E(async (look) => {
    const t0 = performance.now();
    while (performance.now() - t0 < 10000) {
      const g = window.__vm.cinemaGlyphs();
      if (g.ready && g.look === look) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }, look);
  await E(() => window.__vm.cinemaLoop(false));
  await pump(20);
  const s0 = await shot();
  await E(() => window.__vm.cinemaScan('start'));
  await pump(Math.round(0.62 * 3.2 * 60));
  const st = await E(() => { const g = window.__vm.cinemaGlyphs(); return { tr: g.trace, sh: g.shader, sc: window.__vm.cinemaScan(), headBand: g.headBand, textField: g.textField }; });
  const s1 = await shot();
  await E(() => window.__vm.cinemaScan('off'));
  await pump(30);
  await E(() => window.__vm.cinemaLoop(true));
  await sleep(300);
  return { s0, s1, st };
};
const hT = await holdShot('traced');
const hS = await holdShot('stroke');
const hH = await holdShot('hantext'); // r87: chữ Hán số hoá — cùng lượt giữ tất định
{
  const F = GEN['bia-1442'].frame;
  const st = hT.st;
  const tf = st.textField;
  const hb = st.headBand;
  const x0 = tf.x0 + 0.02;
  const x1 = tf.x1 - 0.02;
  const litY = st.tr?.litY ?? 9;
  const yTop = hb ? hb.y0 - 0.01 : tf.y1;
  R.T.hold = {
    tr: st.tr,
    bar: st.sc.barY,
    litY,
    // thân bia trên đường sáng (chữ đã sáng) · dưới vạch (chưa tới — chỉ le lói) — Δ so với lúc chưa giữ, p90 (nét chữ thưa)
    litT: await bandDelta(hT.s0, hT.s1, x0, x1, litY + 0.01, yTop),
    litS: await bandDelta(hS.s0, hS.s1, x0, x1, litY + 0.01, yTop),
    belowT: await bandDelta(hT.s0, hT.s1, x0, x1, F.bottom + 0.03, st.sc.barY - 0.06),
    // dải tiêu đề: ảnh lúc giữ của hai kiểu (cùng khung) — giống hệt. Lề dưới 12 ‰: hạt thân bia của Nét khắc ngay dưới mép dải (cỡ
    // + quầng loé ≤ ~10 ‰) — Hình chữ dò không có hạt thân bia
    head: hb ? await bandDelta(hS.s1, hT.s1, hb.x0 + 0.005, hb.x1 - 0.005, hb.y0 + 0.012, hb.y1 - 0.004) : null,
    headAbs: hb ? await E(([a, b, x0, x1, y0, y1]) => {
      const P = (x, y) => window.__vm.cinemaGlyphs('project', [x, y]);
      const p00 = P(x0, y1);
      const p11 = P(x1, y0);
      // Δ có dấu (Hình chữ dò − Nét khắc) từng điểm ảnh. Hạt phim (lớp DOM, động) cho nhiễu ± ≤ ~0,02 rải rác, trung bình 0; mặt nạ / quầng
      // chữ dò rò vào dải sẽ là cả nét chữ SÁNG HƠN (Δ ≥ ~0,05, như thân bia ở trên)
      const ds = [];
      for (let y = p00.y + 1; y < p11.y - 1; y += 1) for (let x = p00.x + 1; x < p11.x - 1; x += 1) ds.push(window.__shots[b].L(x, y) - window.__shots[a].L(x, y));
      const mean = ds.reduce((t, d) => t + d, 0) / Math.max(1, ds.length);
      return { n: ds.length, mean: +mean.toFixed(5), max: +Math.max(...ds).toFixed(5), bright: ds.filter((d) => d > 0.03).length };
    }, [hS.s1, hT.s1, hb.x0 + 0.005, hb.x1 - 0.005, hb.y0 + 0.012, hb.y1 - 0.004]) : null,
  };
  // r87 chữ Hán số hoá: thân bia trên đường sáng có chữ sáng; dải tiêu đề như Nét khắc (cùng khung)
  const hlit = hH.st.tr?.litY ?? 9;
  R.K = { hold: { tr: hH.st.tr, litH: await bandDelta(hH.s0, hH.s1, x0, x1, hlit + 0.01, yTop), litS: await bandDelta(hS.s0, hS.s1, x0, x1, hlit + 0.01, yTop), belowH: await bandDelta(hH.s0, hH.s1, x0, x1, F.bottom + 0.03, hH.st.sc.barY - 0.06), head: hb ? await bandDelta(hS.s1, hH.s1, hb.x0 + 0.005, hb.x1 - 0.005, hb.y0 + 0.012, hb.y1 - 0.004) : null } };
}
await setS('cinemaRubbingScan', true);
await setS('glyphLook', 'traced');
await focus(1500);
await ready();
// bay ra (đám mây): sprite hình chữ, chữ trên đá nhường sprite, hết trước chữ tấm đọc · bay về: chữ tụ về đúng chỗ
R.T.open = await runOpen(7000);
R.T.trOut = await E(() => window.__vm.cinemaGlyphs().trace);
R.T.back = await E(async () => {
  const g0 = window.__vm.cinemaGlyphs();
  const idx = [];
  for (let i = 0; i < g0.count && idx.length < 8; i += 37) {
    const p = window.__vm.cinemaGlyphs('at', i);
    if (p?.glyph && p.fly) idx.push(i);
  }
  const rows = [];
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const t0 = performance.now();
  let trPh = new Set();
  while (performance.now() - t0 < 2400) {
    await new Promise((r) => requestAnimationFrame(r));
    const g = window.__vm.cinemaGlyphs();
    trPh.add(g.trace?.phase);
    const row = { ph: g.phase, sp: [] };
    if (g.phase === 'back')
      for (const n of idx) {
        const s = window.__vm.cinemaGlyphs('sprite', n);
        if (s) s.landPx = window.__vm.cinemaGlyphs('project', [s.land.x, s.land.y, s.land.z]);
        row.sp.push(s);
      }
    rows.push(row);
  }
  return { idx, rows, after: window.__vm.cinemaGlyphs().phase, trPh: [...trPh] };
});
await sleep(800);
// vụt qua + hình chữ dò
await setS('glyphFlyMode', 'whoosh');
await focus(1500);
R.T.whoosh = await runOpen(6500);
await closeReader();
await setS('glyphFlyMode', 'cloud');
// mẫu bia nguồn v2 khác: chữ dò nạp từ models-v2/glyphs, giữ → mặt nạ bật, bắn → chữ dò bay (đám mây), hết trước chữ tấm đọc
R.T.sample = {};
for (const id of ['bia-1554', 'bia-1754', 'bia-1779']) {
  await goto(id);
  await focus(2200);
  const st = await E(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 10000) {
      const g = window.__vm.cinemaGlyphs();
      if (g.ready && g.look === 'traced') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const g = window.__vm.cinemaGlyphs();
    return { look: g.look, space: g.traceSpace, glyphCount: g.glyphCount, spriteCount: g.spriteCount, density: g.density, headerIdsLeft: g.headerIdsLeft, loads: g.loads.filter((u) => u.includes('/glyphs/')) };
  });
  const run = await runOpen(6500);
  await closeReader();
  R.T.sample[id] = { ...st, modes: [...new Set(run.rows.map((r) => r.uMode))], phases: [...new Set(run.rows.map((r) => r.ph))], textRows: run.rows.filter((r) => r.text).length, spritesAtText: run.rows.filter((r) => r.body && r.vis).length };
}
// nạp lỗi (dữ liệu chữ dò của 1670 bị chặn — 404) → Nét khắc, không báo gì
{
  const err0 = errors.length;
  await ctx.route('**/models-v2/glyphs/bia-1670/**', (r) => r.fulfill({ status: 404, body: '' }));
  await goto('bia-1670');
  await focus(2200);
  await E(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) {
      const g = window.__vm.cinemaGlyphs();
      if (g.ready) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  const st = await G();
  const run = await runOpen(6000);
  await closeReader();
  R.T.fallback = { look: st.look, lookWanted: st.lookWanted, src: st.src, count: st.count, errs: errors.slice(err0), phases: [...new Set(run.rows.map((r) => r.ph))], spritesAtText: run.rows.filter((r) => r.body && r.vis).length };
  R.T.fallback.trace = (await G()).trace?.on ?? null;
  await ctx.unroute('**/models-v2/glyphs/bia-1670/**');
}
await goto('bia-1442');
await setS('glyphLook', 'stroke');
await focus(1500);

// ---------------------------------------------------------------- K. r87 "Chữ Hán (số hoá)" + chữ bay dựng đứng, không méo
{
  const CH = JSON.parse(fs.readFileSync(new URL('../../public/hantext/bia-1442/chars.json', import.meta.url), 'utf8'));
  const mp = GEN['bia-1442'].map;
  const inBand = (c) => c.cy >= mp.v[2] && c.cy <= mp.v[1];
  const want = (thr) => CH.chars.filter((c) => c.conf >= thr && c.section !== 'title' && !inBand(c) && c.src !== 'recon').length; // r90: chữ dựng lại không bao giờ đặt
  R.K.want = { 0.7: want(0.7), 0.9: want(0.9), total: CH.chars.length, doc: /Hán Nôm/.test(CH.$doc) && /đối chiếu/i.test(CH.$doc) };
  const waitLook = (look) => E(async (look) => {
    const t0 = performance.now();
    while (performance.now() - t0 < 10000) {
      const g = window.__vm.cinemaGlyphs();
      if (g.ready && g.look === look) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }, look);
  await goto('bia-1442');
  await setS('glyphLook', 'hantext');
  await focus(2000);
  await waitLook('hantext');
  const st = await G();
  R.K.state = { look: st.look, han: st.han, glyphCount: st.glyphCount, spriteCount: st.spriteCount, density: st.density, headerIdsLeft: st.headerIdsLeft, headerCount: st.headerCount, loads: st.loads.filter((u) => u.includes('/hantext/')), check: await G('han') };
  R.K.state.check.cols = R.K.state.check.cols?.[23] ?? null;
  await setS('hanMinConf', 0.9);
  await E(async () => { const t0 = performance.now(); while (performance.now() - t0 < 10000) { const g = window.__vm.cinemaGlyphs(); if (g.ready && g.han?.threshold === 0.9) return; await new Promise((r) => setTimeout(r, 100)); } });
  R.K.state9 = { han: (await G()).han, check: await G('han') };
  delete R.K.state9.check.cols;
  await setS('hanMinConf', 0.7);
  await waitLook('hantext');
  // bia không có văn bản căn chỉnh → Nét khắc
  await goto('bia-1670');
  await focus(2000);
  await ready();
  const o = await G();
  R.K.other = { look: o.look, lookWanted: o.lookWanted, han: o.han, loads: o.loads.filter((u) => u.includes('/hantext/bia-1670')) };
  await goto('bia-1442');
  await focus(1800);
  await waitLook('hantext');

  // chữ bay: tỉ lệ / góc trên màn đo bằng điểm ảnh (vẽ riêng từng sprite, quad tô kín) ở vài khung lúc bay ra + bay về
  const quadSample = async (label) => {
    await E(() => window.__vm.cinemaLoop(false));
    const ns = await E(() => {
      const g = window.__vm.cinemaGlyphs();
      const out = [];
      for (let i = 0; i < g.count && out.length < 6; i++) {
        const at = window.__vm.cinemaGlyphs('at', i);
        if (!at?.glyph || !at.fly) continue;
        const pr = window.__vm.cinemaGlyphs('sprite', i);
        if (!pr || pr.a < 0.3 || pr.depth < 0.12 || pr.sizePx < 5 || pr.x < 120 || pr.y < 120 || pr.x > innerWidth - 120 || pr.y > innerHeight - 120) continue;
        out.push([i, Math.min(8, Math.max(1, 40 / pr.sizePx))]);
      }
      return out;
    });
    const rows = [];
    for (const n of ns) rows.push(await E((n) => window.__vm.cinemaGlyphs('quad', n), n)); // [chỉ số, hệ số phóng đều khi đo]
    await E(() => window.__vm.cinemaLoop(true));
    return { label, rows: rows.filter(Boolean).map((r) => ({ S: r.S, w: r.w, h: r.h, aspect: r.aspect, fill: r.fill, edge: r.edge, asp: +r.probe.asp.toFixed(4), size: +r.probe.sizePx.toFixed(1) })) };
  };
  R.K.quads = [];
  for (const [look, mode] of [['hantext', 'cloud'], ['traced', 'cloud'], ['traced', 'whoosh']]) {
    await setS('glyphLook', look);
    await setS('glyphFlyMode', mode);
    await focus(1200);
    await waitLook(look);
    await vh('start', 0);
    await sleep(2000);
    await vh('fire', 1);
    for (const ms of mode === 'cloud' ? [900, 450, 450] : [700, 300]) {
      await sleep(ms);
      R.K.quads.push(await quadSample(`${look}/${mode} ra`));
    }
    await sleep(mode === 'cloud' ? 2200 : 2600);
    // bay về
    await page.keyboard.press('Escape');
    await sleep(mode === 'cloud' ? 450 : 450);
    R.K.quads.push(await quadSample(`${look}/${mode} về`));
    await sleep(2400);
  }
  await setS('glyphFlyMode', 'cloud');
  await setS('glyphLook', 'stroke');
  await focus(1500);
}

// ---------------------------------------------------------------- K2. r89 chữ Hán TRÊN ĐÁ ở khung nghỉ: sáng theo HÌNH CHỮ, không thành ô
// Trình duyệt riêng DPR 1,5 (trần DPR của app — như màn retina), 1442 lúc giữ (khung nghỉ): mỗi chữ mẫu đang sáng — Δ độ chói (sáng − trước
// giữ) trong hộp chữ, điểm sáng = Δ ≥ 0,4 × Δ lớn nhất của ô; hình chữ tham chiếu = ô atlas (≥ 0,5 = trong nét) lấy mẫu về đúng lưới điểm
// ảnh của ô (điểm ảnh có ≥ 30 % texel trong nét). Đo: độ lấp ô (điểm sáng / điểm ảnh ô) và IoU điểm sáng ↔ hình chữ.
{
  const B = await launch({ headed, width: W, height: H, dpr: 1.5, settings: { ...SEED, cinemaRubbingScan: false, glyphFx: true, glyphLook: 'hantext' } });
  await openCinema(B.page, port, { id: 'bia-1442', hooks: HOOKS, settleMs: 3000 });
  const EB = (fn, a) => B.page.evaluate(fn, a);
  const sp = await EB(() => window.__vm.cinemaStelePoint());
  await B.page.mouse.move(sp.x, sp.y, { steps: 4 });
  await sleep(2500);
  await EB(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      const l = window.__vm.cinemaLods(), rv = window.__vm.cinemaReveal(), g = window.__vm.cinemaGlyphs();
      if (l.liveLod === 0 && !rv.proxy && !rv.revealing && g.ready && g.look === 'hantext') return;
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  const pumpB = (n) => EB(async (n) => { for (let i = 0; i < n; i++) { window.__vm.cinemaTick(1 / 60); await new Promise((r) => requestAnimationFrame(r)); } }, n);
  await EB(() => window.__vm.cinemaLoop(false));
  await pumpB(20);
  const b0 = (await B.page.screenshot()).toString('base64');
  await EB(() => window.__vm.cinemaScan('start'));
  await pumpB(Math.round(0.62 * 3.2 * 60));
  const b1 = (await B.page.screenshot()).toString('base64');
  R.K2 = await EB(async ([b0, b1]) => {
    const DPR = devicePixelRatio;
    const dec = async (blob) => { const img = await createImageBitmap(blob); const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0); return { w: img.width, d: g.getImageData(0, 0, img.width, img.height).data }; };
    const png = async (b64) => dec(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const [A, Bm] = [await png(b0), await png(b1)];
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (I, x, y) => { const i = (y * I.w + x) * 4; return 0.2126 * lin(I.d[i]) + 0.7152 * lin(I.d[i + 1]) + 0.0722 * lin(I.d[i + 2]); };
    const P = (x, y) => window.__vm.cinemaGlyphs('project', [x, y]);
    const H = window.__vm.cinemaGlyphs('han', 400);
    const at = await dec(await (await fetch('/hantext/bia-1442/atlas.webp')).blob());
    const rows = [];
    for (const c of H.cells) {
      // r90: hộp MỰC vẽ trên đá (= hộp nét khắc, căn chỉnh v2+) ↔ ô atlas sát mực `a`
      const q0 = P(c.x - c.iw / 2, c.y + c.ih / 2);
      const q1 = P(c.x + c.iw / 2, c.y - c.ih / 2);
      const [x0, y0, x1, y1] = [q0.x, q0.y, q1.x, q1.y].map((v) => Math.round(v * DPR));
      const nx = x1 - x0;
      const ny = y1 - y0;
      if (nx < 3 || ny < 3) continue;
      const del = [];
      let mx = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = L(Bm, x, y) - L(A, x, y); del.push(v); mx = Math.max(mx, v); }
      if (mx < 0.04) continue; // chưa sáng (dưới vạch)
      const [ax, ay, aw, ah] = c.a;
      let inter = 0, uni = 0, lit = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        let k = 0, n = 0;
        for (let v = Math.floor(ay + (j * ah) / ny); v < Math.ceil(ay + ((j + 1) * ah) / ny); v++) for (let u = Math.floor(ax + (i * aw) / nx); u < Math.ceil(ax + ((i + 1) * aw) / nx); u++) { n++; if (at.d[(v * at.w + u) * 4] >= 128) k++; }
        const ref = k / Math.max(1, n) >= 0.3;
        const l = del[j * nx + i] >= 0.4 * mx;
        lit += l; inter += l && ref; uni += l || ref;
      }
      rows.push({ px: nx, frac: lit / (nx * ny), iou: inter / Math.max(1, uni) });
    }
    const med = (a) => { const s = [...a].sort((u, v) => u - v); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
    return { dpr: DPR, n: rows.length, cellPx: med(rows.map((r) => r.px)), frac: med(rows.map((r) => r.frac)), iou: med(rows.map((r) => r.iou)), fracOk: +(rows.filter((r) => r.frac <= 0.6).length / Math.max(1, rows.length)).toFixed(3), iouOk: +(rows.filter((r) => r.iou >= 0.5).length / Math.max(1, rows.length)).toFixed(3), sdf: window.__vm.cinemaGlyphs().trace?.sdf ?? null };
  }, [b0, b1]);
  R.K2.errors = B.errors.length;
  await B.close();
}

// ---------------------------------------------------------------- S. r90 vạch quét ↔ chữ sáng ĐỒNG BỘ (mép dẫn của vạch làm lộ chữ)
// Trình duyệt riêng DPR 2, không vạch / bản dập / đèn xiên (cinemaRubbingScan, rakeGlow, headSweepGlow tắt — chỉ còn ánh của chữ): 1442
// (Nét khắc · Hình chữ dò · Chữ Hán) + 1670 + 1754 (Nét khắc · Hình chữ dò). Mỗi kiểu 14 chữ / hạt trải đều theo cao độ; vm.cinemaLitTrace
// vẽ từng khung (1/60 s) rồi đọc điểm ảnh tại tâm chữ ((2r+1)², r = 1 hạt / 2 chữ): khung bắt đầu sáng (độ chói tăng ≥ max(6, 30 %
// biên độ) so với trước khi vạch tới) = khung mép dẫn vạch (uScan.x) qua tâm chữ, ±1 khung.
{
  const B = await launch({ headed, width: W, height: H, dpr: 2, settings: { ...SEED, cinemaRubbingScan: false, glyphFx: true, rakeGlow: 0, headSweepGlow: 0, sparkleDensity: 0.5 } });
  await openCinema(B.page, port, { id: 'bia-1442', hooks: [...HOOKS, 'cinemaLitTrace'], settleMs: 3000 });
  const EB = (fn, a) => B.page.evaluate(fn, a);
  const pumpB = (n) => EB(async (n) => { for (let i = 0; i < n; i++) { window.__vm.cinemaTick(1 / 60); await new Promise((r) => requestAnimationFrame(r)); } }, n);
  R.S = {};
  for (const id of ['bia-1442', 'bia-1670', 'bia-1754']) {
    await EB(async (id) => {
      if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
      const t0 = performance.now();
      while (performance.now() - t0 < 12000) {
        await new Promise((r) => setTimeout(r, 100));
        if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0) break;
      }
    }, id);
    const sp = await EB(() => window.__vm.cinemaStelePoint());
    await B.page.mouse.move(sp.x, sp.y, { steps: 4 });
    await sleep(2500);
    await EB(async () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 15000) {
        const l = window.__vm.cinemaLods(), rv = window.__vm.cinemaReveal();
        if (l.liveLod === 0 && !rv.proxy && !rv.revealing) return;
        await new Promise((r) => setTimeout(r, 150));
      }
    });
    for (const look of id === 'bia-1442' ? ['stroke', 'traced', 'hantext'] : ['stroke', 'traced']) {
      await EB((l) => window.__vm.settings.set('glyphLook', l), look);
      const okLook = await EB(async (look) => {
        const t0 = performance.now();
        while (performance.now() - t0 < 10000) {
          const g = window.__vm.cinemaGlyphs();
          if (g.ready && g.look === look) return true;
          await new Promise((r) => setTimeout(r, 100));
        }
        return false;
      }, look);
      await EB(() => window.__vm.cinemaLoop(false));
      await pumpB(20);
      const pts = await EB((look) => {
        const n = window.__vm.cinemaGlyphs().count ?? 0;
        const all = [];
        const motes = [];
        for (let i = 0; i < n; i++) {
          const q = window.__vm.cinemaGlyphs('at', i);
          if (!q || q.head) continue;
          if (!q.glyph) motes.push([q.x, q.y]);
          if ((look === 'stroke') === !!q.glyph) continue;
          all.push([q.x, q.y]);
        }
        // chữ mẫu: không có hạt sáng (chỗ chưa chắc — sáng theo vạch sớm hơn) trong 0,014 đơn vị bia quanh tâm — điểm ảnh đo chỉ là chữ
        if (look !== 'stroke') all.splice(0, all.length, ...all.filter(([x, y]) => motes.every(([mx, my]) => Math.hypot(mx - x, my - y) > 0.014)));
        all.sort((a, b) => b[1] - a[1]);
        return all.length ? Array.from({ length: 14 }, (_, j) => all[Math.floor(((j + 0.5) / 14) * all.length)]) : [];
      }, look);
      await EB(() => window.__vm.cinemaScan('start'));
      const rows = await EB(([pts, r]) => window.__vm.cinemaLitTrace({ pts, frames: 240, r }), [pts, look === 'stroke' ? 1 : 2]);
      await EB(() => window.__vm.cinemaScan('off'));
      await pumpB(30);
      await EB(() => window.__vm.cinemaLoop(true));
      await sleep(300);
      const d = pts.map(([, y], j) => {
        const L = rows.map((r) => r.lum[j]);
        const cross = rows.findIndex((r) => r.bar <= y);
        const base = Math.max(...L.slice(0, Math.max(1, cross - 2)));
        const on = L.findIndex((l, f) => f >= 1 && l - base >= Math.max(6, 0.3 * (Math.max(...L) - base)));
        return on >= 0 && cross >= 0 ? on - cross : null;
      });
      R.S[`${id} ${look}`] = { okLook, n: pts.length, d, litVsBar: Math.max(...rows.map((r) => Math.abs(r.litT - r.bar))) };
    }
  }
  R.S.errors = B.errors.length;
  await B.close();
}

// ---------------------------------------------------------------- P. hiệu năng — phần THÊM của hiệu ứng (bật − tắt, cùng trạng thái)
// r85: giá khung theo đồng hồ tường, mỗi khung chặn tới khi GPU vẽ xong (cinemaFrameCost: tick + đọc 1 điểm ảnh). Đồng hồ GPU
// (EXT_disjoint_timer_query) của Chromium không đầu trên macOS cộng cả phần chờ hàng đợi — tăng dần 20 → 45 ms rồi tụt, cả lúc
// tắt hiệu ứng — không so được. r86: tắt / Nét khắc / Hình chữ dò đo xen kẽ (giữ 5 vòng, bay 3 vòng); phần thêm = trung vị các hiệu p95 (bật − tắt) từng vòng.
R.P = {};
const gpu = (o) => E((o) => window.__vm.cinemaFrameCost(o), o);
const best = (a, b) => (!a ? b : !b ? a : a.p95 <= b.p95 ? a : b);
for (const [w, h] of [[1920, 1080], [3840, 2160]]) {
  await page.setViewportSize({ width: w, height: h });
  await sleep(1500);
  await focus(2500);
  await lod0();
  const row = {};
  // r86: tắt · Nét khắc · Hình chữ dò — đo XEN KẼ (máy bận làm giá khung trôi theo thời gian — so cùng lúc), mỗi cấu hình lấy p95
  // nhỏ nhất: giữ 5 vòng (rẻ), bay 3 vòng
  const useCfg = async (cfgName) => {
    await setS('glyphFx', cfgName !== 'off');
    await setS('glyphLook', cfgName === 'traced' ? 'traced' : 'stroke');
    await sleep(300);
    if (cfgName !== 'off') await E(async (want) => { const t0 = performance.now(); while (performance.now() - t0 < 10000) { const g = window.__vm.cinemaGlyphs(); if (g.ready && g.look === want) return; await new Promise((r) => setTimeout(r, 100)); } }, cfgName === 'traced' ? 'traced' : 'stroke');
    return (row[cfgName] ??= { hold: null, fly: null, holdP95: [], flyP95: [] });
  };
  for (let round = 0; round < 5; round++) {
    for (const cfgName of ['off', 'on', 'traced']) {
      const cur = await useCfg(cfgName);
      // giữ: vạch + đèn xiên + hạt / mặt nạ chữ trên đá
      await E(() => window.__vm.cinemaScan('start'));
      const h1 = await gpu({ frames: 120, warm: 20 });
      h1.fx = await E(() => { const g = window.__vm.cinemaGlyphs(); return { on: g.shader?.on, vis: g.meshVisible, tr: g.trace?.on, look: g.look }; });
      cur.hold = best(cur.hold, h1);
      cur.holdP95.push(h1.p95);
      await E(() => window.__vm.cinemaScan('off'));
      await sleep(200);
    }
  }
  for (let round = 0; round < 3; round++) {
    for (const cfgName of ['off', 'on', 'traced']) {
      const cur = await useCfg(cfgName);
      // bay: bắn rồi đo suốt đoạn tiến vào
      await focus(900);
      await vh('start', 0);
      await sleep(2000);
      await vh('fire', 1);
      await sleep(100);
      const f1 = await gpu({ frames: 110, warm: 5 });
      f1.fx = await E(() => { const g = window.__vm.cinemaGlyphs(); return { mode: g.uniforms?.mode, phase: g.phase, tr: g.trace?.on, look: g.look }; });
      cur.fly = best(cur.fly, f1);
      cur.flyP95.push(f1.p95);
      await closeReader();
    }
  }
  R.P[`${w}x${h}`] = row;
}
await setS('glyphFx', true);
await setS('glyphLook', 'stroke');
await page.setViewportSize({ width: W, height: H });
await sleep(800);
await close();

// ---------------------------------------------------------------- G. bia không có bản dập (nguồn v1)
{
  const B = await launch({ headed, width: W, height: H, settings: { ...SEED, glyphLook: 'traced' } }); // r86: Hình chữ dò → bia không có dữ liệu → Nét khắc
  const reqs = [];
  await B.ctx.route('**/models-v2/catalog.json', (r) => r.fulfill({ status: 404, body: '' }));
  B.ctx.on('request', (r) => {
    if (/\/(glyphs|rubbings)\//.test(r.url())) reqs.push(r.url());
  });
  await openCinema(B.page, port, { id: 'bia-1554', hooks: HOOKS, settleMs: 3000 });
  const E2 = (fn, a) => B.page.evaluate(fn, a);
  const p = await E2(() => window.__vm.cinemaStelePoint());
  await B.page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(2500);
  await E2(async () => { for (let i = 0; i < 60 && !window.__vm.cinemaGlyphs().ready; i++) await new Promise((r) => setTimeout(r, 100)); });
  const st = await E2(() => window.__vm.cinemaGlyphs());
  await E2(() => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase: 'start', progress: 0, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })));
  await sleep(1200);
  const hold = await E2(() => ({ g: window.__vm.cinemaGlyphs(), s: window.__vm.cinemaScan() }));
  await E2(() => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase: 'cancel', progress: 0.6, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })));
  await sleep(600);
  R.G = { look: st.look, lookWanted: st.lookWanted, src: st.src, count: st.count, on: hold.g.shader?.on, amp: hold.g.shader?.amp, vis: hold.g.meshVisible, w: hold.s.u?.[3], reqs, errors: B.errors };
  await B.close();
}

// ---------------------------------------------------------------- V. r86 nguồn v1 (không models-v2): 1442 Hình chữ dò từ public/glyphs
{
  const B = await launch({ headed, width: W, height: H, settings: { ...SEED, glyphLook: 'traced' } });
  const reqs = [];
  await B.ctx.route('**/models-v2/catalog.json', (r) => r.fulfill({ status: 404, body: '' }));
  B.ctx.on('request', (r) => {
    if (r.url().includes('/glyphs/')) reqs.push(r.url());
  });
  await openCinema(B.page, port, { id: 'bia-1442', hooks: HOOKS, settleMs: 3000 });
  const E2 = (fn, a) => B.page.evaluate(fn, a);
  const p = await E2(() => window.__vm.cinemaStelePoint());
  await B.page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(2500);
  const st = await E2(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 10000) {
      const g = window.__vm.cinemaGlyphs();
      if (g.ready && g.look === 'traced') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const g = window.__vm.cinemaGlyphs();
    return { look: g.look, space: g.traceSpace, glyphCount: g.glyphCount, spriteCount: g.spriteCount, density: g.density, src: g.src, loads: g.loads };
  });
  await E2(() => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase: 'start', progress: 0, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })));
  let tr = 0;
  let out = false;
  let vis = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 5500) {
    const g = await E2(() => window.__vm.cinemaGlyphs());
    tr = Math.max(tr, g.trace?.on ?? 0);
    out = out || g.phase === 'out';
    vis = vis || (g.phase === 'out' && g.meshVisible);
    if (Date.now() - t0 > 2000 && Date.now() - t0 < 2300) await E2(() => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase: 'fire', progress: 1, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })));
    await sleep(120);
  }
  R.V = { ...st, tr, out, vis, reqs, errors: B.errors };
  await B.close();
}

// ---------------------------------------------------------------- H. giảm chuyển động
{
  const B = await launch({ headed, width: W, height: H, reducedMotion: true, settings: SEED });
  await openCinema(B.page, port, { id: 'bia-1442', hooks: HOOKS, settleMs: 3000 });
  const E2 = (fn, a) => B.page.evaluate(fn, a);
  const p = await E2(() => window.__vm.cinemaStelePoint());
  await B.page.mouse.move(p.x, p.y, { steps: 4 });
  await sleep(2500);
  await E2(async () => { for (let i = 0; i < 60 && !window.__vm.cinemaGlyphs().ready; i++) await new Promise((r) => setTimeout(r, 100)); });
  await E2(() => {
    const T = (window.__H = { on: true, modes: new Set(), phases: [] });
    const rec = () => {
      if (!T.on) return;
      const g = window.__vm.cinemaGlyphs();
      if (g.meshVisible) T.modes.add(g.uniforms?.mode);
      if (T.phases.at(-1) !== g.phase) T.phases.push(g.phase);
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  const ev = (phase, progress) => E2(([phase, progress]) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })), [phase, progress]);
  await ev('start', 0);
  await sleep(1500);
  await ev('fire', 1);
  await sleep(1500);
  await B.page.keyboard.press('Escape');
  await sleep(1200);
  R.H = await E2(() => { window.__H.on = false; return { modes: [...window.__H.modes], phases: window.__H.phases }; });
  errors.push(...B.errors);
  await B.close();
}

// ---------------------------------------------------------------------------- kiểm
const f3 = (v) => (v == null ? '—' : Number(v).toFixed(3));
report.section('A. 5 bia nguồn v2: hạt sáng từ bản đồ nét, không hình chữ dò');
for (const id of IDS) {
  const a = R.A[id];
  report.check(`${id}: ${a.count} hạt (dải tiêu đề ${a.headerCount}) lấy mẫu từ bản đồ nét trong ${a.ms} ms — độ đậm nét tại điểm ${f3(a.energy?.points)} ≥ 3 × ô chữ ${f3(a.energy?.field)}; giữ → bắn → đám mây (${a.phases.join(' → ')}); không hạt nào lúc có thân bài tấm đọc (${a.textRows} khung)`, a.ok && a.src === 'stroke' && a.count > 200 && a.count <= 3000 && a.headerCount > 10 && a.energy && a.energy.points >= 3 * a.energy.field && a.phases.includes('hold') && a.phases.includes('out') && a.cloud && a.textRows > 10 && a.spritesAtText === 0, a);
}
report.check('không tải gì từ glyphs/ (không atlas / bản đồ id chữ); shader đá không còn uniform hình chữ (chỉ đèn xiên + quét dải tiêu đề)', R.Areq === 0 && R.Freq === 0 && !R.A['bia-1442'].shaderKeys.some((k) => /lit|awake|sparkle|waveTop/.test(k)) && R.A['bia-1442'].shaderKeys.includes('headX'), { req: R.Areq, keys: R.A['bia-1442'].shaderKeys });
report.check('lấy mẫu tất định (cùng điểm khi lấy mẫu lại)', JSON.stringify(R.Adet) === JSON.stringify(R.A['bia-1442'].again), { a: R.A['bia-1442'].again, b: R.Adet });

report.section('B. đèn xiên trên phù điêu thật');
{
  const [b1, b0] = [R.B[1], R.B[0]];
  // (r86: Δ TRUNG BÌNH — nét khắc thưa nên trung vị sát 0 ở vài khung; hạt phim cho nhiễu ± trung bình 0)
  report.check(`vạch ở ${f3(b1.bar)}: dải ngay trên vạch sáng lên (Δ trung bình ${b1.near.mean} > 0,005; trung vị ${b1.near.med}), xa dưới vạch không đổi (|Δ trung bình| ${b1.far.mean} ≤ 0,001)`, b1.on === 1 && b1.near.n > 200 && b1.near.mean > 0.005 && Math.abs(b1.far.mean) <= 0.001, b1);
  // r90: hạt sáng bật đúng mép dẫn vạch → dải ngay trên vạch có cả ánh hạt (mật độ 0,1): đèn xiên 0 → chỉ còn phần đó
  report.check(`"Độ sáng đèn xiên" 0 → dải đó gần như không đổi (Δ trung bình ${b0.near.mean} ≤ 25 % lúc có đèn xiên ${b1.near.mean} — chỉ còn ánh hạt sáng bật theo vạch): thay đổi là của đèn xiên trên nét khắc`, b0.near.mean <= 0.25 * b1.near.mean, b0);
}

report.section('C. đèn quét dải tiêu đề');
{
  const xs = R.C.xs;
  const [x0, x1] = R.C.band;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  let turns = 0;
  for (let i = 2; i < xs.length; i++) if (Math.sign(xs[i] - xs[i - 1]) !== Math.sign(xs[i - 1] - xs[i - 2]) && Math.abs(xs[i] - xs[i - 1]) > 1e-5) turns++;
  report.check(`tâm cửa sổ quét chạy hết dải (${f3(min)} → ${f3(max)} trong ${f3(x0)} … ${f3(x1)}), đổi chiều ${turns} lần trong 4,3 s (qua lại)`, min <= x0 + 0.05 * (x1 - x0) && max >= x1 - 0.05 * (x1 - x0) && turns >= 2, { min, max, turns });
  report.check(`vùng sáng di chuyển (không hình tĩnh): Δ giữa hai thời điểm — bên trái ${R.Cmove.left.p90} · bên phải ${R.Cmove.right.p90} (p90, có đổi ở cả hai phía)`, Math.abs(R.Cmove.left.p90) > 0.002 || Math.abs(R.Cmove.right.p90) > 0.002, R.Cmove);
  const one = R.Cone;
  let back = 0;
  for (let i = 1; i < one.length; i++) if (one[i] < one[i - 1] - 0.05) back++; // nhảy về đầu (lặp)
  let rev = 0;
  for (let i = 1; i < one.length; i++) if (one[i] < one[i - 1] - 1e-5 && one[i] > one[i - 1] - 0.05) rev++;
  report.check(`tắt "quét qua lại": chỉ trái → phải (lặp lại ${back} lần, không đi lùi: ${rev} khung)`, rev === 0 && back >= 1, { back, rev });
}

report.section('D. đám mây chữ ngay trước mặt bia (r88)');
for (const ct of [1.0, 1.6]) {
  const d = R.D[ct];
  const c = d.cloud ?? {};
  const n = c.normal ?? [0, 0, 1];
  // nâng: độ lệch NGANG (vuông góc pháp tuyến) của chữ / hạt so với chỗ của nó trên đá — phải ≈ 0 (chỉ nâng dọc pháp tuyến)
  const lat = d.liftRows.map((r) => {
    const dot = r.d[0] * n[0] + r.d[1] * n[1] + r.d[2] * n[2];
    return Math.hypot(r.d[0] - dot * n[0], r.d[1] - dot * n[1], r.d[2] - dot * n[2]);
  });
  const maxLat = lat.length ? Math.max(...lat) : null;
  const dep = d.depths ?? [];
  const dMin = dep.length ? Math.min(...dep) : null;
  const dMax = dep.length ? Math.max(...dep) : null;
  const textRows = d.rows.filter((r) => r.body); // r90: thân bài (tiêu đề được chồng lên đám mây đang tan)
  report.check(`"Khoảng cách đám mây chữ" ×${ct}: khoảng cách đầu rùa – mặt bia ${f3(c.dHead)} → độ sâu tối đa ${f3(c.D)}; ${dep.length} chữ / hạt bay ở độ sâu ${f3(dMin)} … ${f3(dMax)} ⊂ [0,15; 1] × ${f3(c.D)}; lúc nâng lệch ngang ≤ ${maxLat == null ? '—' : (maxLat * 1000).toFixed(2)} ‰ (${lat.length} mẫu — chỉ dọc pháp tuyến); không hạt nào lúc có thân bài tấm đọc (${textRows.length} khung)`, Math.abs(c.D - c.dHead * ct) < 1e-3 && dep.length > 100 && dMin >= 0.15 * c.D - 1e-3 && dMax <= c.D + 1e-3 && dMax - dMin > 0.5 * c.D && lat.length > 50 && maxLat <= 0.0005 && textRows.length > 5 && textRows.every((r) => !r.vis), { c, dMin, dMax, maxLat, n: lat.length });
}
{
  const rows = R.Dback.rows.filter((r) => r.ph === 'back');
  const land = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => {
    const at = rows.find((r) => r.sp[j] && r.sp[j].fly && r.sp[j].tau >= 1);
    if (!at) return { j, ok: rows.every((r) => !r.sp[j] || !r.sp[j].fly), skip: true };
    const s = at.sp[j];
    const e = Math.hypot(s.x - s.landPx.x, s.y - s.landPx.y);
    return { j, ok: e <= 1.5, err: +e.toFixed(2) };
  });
  report.check(`bay về: hạt tụ về đúng chỗ trên đá (lệch ${land.map((l) => l.err ?? '—').join(' / ')} px ≤ 1,5), rồi tắt hẳn (${R.Dback.after.phase})`, land.every((l) => l.ok) && land.filter((l) => !l.skip).length >= 3 && rows.length > 10 && ['off', 'land'].includes(R.Dback.after.phase), land);
}

report.section('E. "Vụt qua" (r84)');
{
  const textRows = R.E.rows.filter((r) => r.text);
  const modes = [...new Set(R.E.rows.map((r) => r.uMode))];
  report.check(`hạt bay qua camera (chế độ ${modes.join('/')}), hết trước chữ tấm đọc (${textRows.length} khung có chữ, không hạt)`, modes.includes(1) && textRows.length > 5 && textRows.every((r) => !r.vis), { modes });
}

report.section('F. tắt hiệu ứng ánh sáng chữ');
report.check('không đèn xiên / hạt (uGlyph.x = 0, không hạt), vạch + vệt bản dập vẫn chạy (uScan.w = 1, chế độ vệt)', R.F.on === 0 && !R.F.vis && R.F.trail && R.F.w === 1, R.F);

report.section('G. bia không có bản dập (nguồn v1 — 1554)');
report.check(`hạt rải đều trên ô chữ (${R.G.count} hạt, src ${R.G.src}), đèn xiên + hạt chạy lúc giữ, chỉ vạch (uScan.w = 2), không tải gì từ glyphs/ · rubbings/, không lỗi`, R.G.src === 'plain' && R.G.count > 100 && R.G.on === 1 && R.G.vis && R.G.w === 2 && R.G.reqs.length === 0 && R.G.errors.length === 0, R.G);

report.section('V. nguồn v1 (không models-v2) — r86 Hình chữ dò');
{
  const v = R.V;
  report.check(`1442: chữ dò từ public/glyphs/bia-1442/ (${v.loads.length} tệp, nguồn ${v.space}), ${v.glyphCount} chữ — ${v.spriteCount} chữ bay = round(${v.density} × ${v.glyphCount}); giữ → mặt nạ bật (${v.tr}), bắn → chữ dò bay (${v.vis}); không lỗi`, v.look === 'traced' && v.space === 'v1' && v.loads.length === 3 && v.loads.every((u) => /\/glyphs\/bia-1442\//.test(u) && !u.includes('models-v2')) && v.glyphCount > 500 && v.spriteCount === Math.round(v.density * v.glyphCount) && v.tr === 1 && v.out && v.vis && v.errors.length === 0, v);
  report.check(`bia v1 không có dữ liệu chữ dò (1554, mục G): Hình chữ dò → Nét khắc (${R.G.look}), không tải gì từ glyphs/`, R.G.look === 'stroke' && R.G.lookWanted === 'traced' && R.G.reqs.length === 0, { look: R.G.look, reqs: R.G.reqs });
}

report.section('H. giảm chuyển động');
report.check(`không hạt bay (chế độ hạt ${R.H.modes.join('/')} — chỉ 0: trên đá), lấp lánh rồi tắt tại chỗ (${R.H.phases.join(' → ')})`, R.H.modes.every((m) => m === 0) && R.H.phases.includes('rmout') && R.H.phases.at(-1) === 'off', R.H);

report.section('T. kiểu chữ sáng "Hình chữ dò" (r86 — dữ liệu chữ dò 82 bia, models-v2/glyphs)');
{
  const t = R.T.state;
  report.check(`1442: chọn Hình chữ dò → bộ hình chữ dò (${t.look}, nguồn ${t.space}), nạp đúng 3 tệp chữ dò từ models-v2/glyphs/bia-1442/ (${t.loads.length} URL, ${R.T.reqs} yêu cầu glyphs/)`, t.ready && t.look === 'traced' && t.space === 'v2' && t.loads.length === 3 && t.loads.every((u) => u.includes('/models-v2/glyphs/bia-1442/')) && R.T.reqs >= 3, t);
  report.check(`sprite hình chữ = mật độ × số chữ: ${t.glyphFly} chữ bay = round(${t.density} × ${t.glyphInst}) = ${Math.round(t.density * t.glyphInst)} (đếm từ thuộc tính từng hạt; báo ${t.spriteCount})`, t.glyphInst === t.glyphCount && t.glyphInst > 500 && t.glyphFly === Math.round(t.density * t.glyphInst) && t.spriteCount === t.glyphFly, t);
  report.check(`dải tiêu đề không bao giờ có mặt nạ: bản đồ id trong khung dải tiêu đề sau khi nạp — còn ${t.headerIdsLeft} điểm ảnh (xoá ${t.dropped}; ${t.headerGlyphs} chữ dải tiêu đề trong dữ liệu), không sprite hình chữ nào ở dải tiêu đề (${t.inHeader}); dải tiêu đề vẫn có hạt sáng (${t.headerCount})`, t.headerIdsLeft === 0 && t.inHeader === 0 && t.headerCount > 10, t);
  const h = R.T.hold;
  report.check(`mặt nạ chữ sáng sau vệt: vạch ${f3(h.bar)}, đường sáng ${f3(h.litY)} — thân bia trên đường sáng Δ p90 ${h.litT.p90} (Hình chữ dò) ≫ ${h.litS.p90} (Nét khắc) và ≫ dưới vạch ${h.belowT.p90}`, h.tr?.on === 1 && h.tr?.lit === 1 && h.litT.n > 200 && h.litT.p90 > 0.01 && h.litT.p90 > 3 * Math.max(h.litS.p90, 0.001) && h.litT.p90 > 3 * Math.max(h.belowT.p90, 0.001), h);
  report.check(`dải tiêu đề như nhau ở hai kiểu (cùng đèn quét + hạt, không mặt nạ): Δ trung bình ${h.headAbs?.mean} (|·| ≤ 0,001), ${h.headAbs?.bright} / ${h.headAbs?.n} điểm ảnh sáng hơn > 0,03 (≤ 0,2 %; lớn nhất ${h.headAbs?.max}) — thân bia trên đường sáng: Δ p90 ${h.litT.p90}`, !!h.headAbs && h.headAbs.n > 500 && Math.abs(h.headAbs.mean) <= 0.001 && h.headAbs.bright <= 0.002 * h.headAbs.n, { head: h.head, abs: h.headAbs });
  const o = R.T.open;
  const textRows = o.rows.filter((r) => r.body); // r90: thân bài (tiêu đề được chồng lên đám mây đang tan)
  const modes = [...new Set(o.rows.map((r) => r.uMode))];
  report.check(`bay ra (Đám mây): sprite hình chữ (chế độ ${modes.join('/')}), hết trước thân bài tấm đọc (${textRows.length} khung có thân bài, không sprite)`, modes.includes(3) && o.rows.some((r) => r.vis) && textRows.length > 5 && textRows.every((r) => !r.vis), { modes, textAt: o.info?.textAt });
  const rows = R.T.back.rows.filter((r) => r.ph === 'back');
  const land = R.T.back.idx.map((n, j) => {
    const at = rows.find((r) => r.sp[j] && r.sp[j].tau >= 1);
    if (!at) return { n, skip: true, ok: true };
    const s = at.sp[j];
    const e = Math.hypot(s.x - s.landPx.x, s.y - s.landPx.y);
    return { n, ok: e <= 1.5, err: +e.toFixed(2) };
  });
  report.check(`bay về: chữ tụ về đúng chỗ trên đá (lệch ${land.map((l) => l.err ?? '—').join(' / ')} px ≤ 1,5), mặt nạ chuyển pha bay về (${R.T.back.trPh.join('/')}), rồi tắt (${R.T.back.after})`, land.every((l) => l.ok) && land.filter((l) => !l.skip).length >= 3 && R.T.back.trPh.includes(2) && ['off', 'land'].includes(R.T.back.after), land);
  const w = R.T.whoosh;
  const wText = w.rows.filter((r) => r.text);
  const wModes = [...new Set(w.rows.map((r) => r.uMode))];
  report.check(`Vụt qua + Hình chữ dò: chữ bay qua camera (chế độ ${wModes.join('/')}), hết trước chữ tấm đọc (${wText.length} khung)`, wModes.includes(1) && wText.length > 5 && wText.every((r) => !r.vis), { wModes });
  for (const [id, a] of Object.entries(R.T.sample)) {
    const own = a.loads.filter((u) => u.includes(`/glyphs/${id}/`));
    report.check(`${id} (v2): ${a.glyphCount} chữ dò từ models-v2/glyphs (${own.length} tệp), ${a.spriteCount} chữ bay = round(${a.density} × ${a.glyphCount}); dải tiêu đề không mặt nạ (${a.headerIdsLeft}); giữ → bắn → chữ dò bay đám mây (${a.phases.join(' → ')}), hết trước chữ tấm đọc (${a.textRows} khung)`, a.look === 'traced' && a.space === 'v2' && own.length === 3 && own.every((u) => u.includes(`/models-v2/glyphs/${id}/`)) && a.glyphCount > 200 && a.spriteCount === Math.round(a.density * a.glyphCount) && a.headerIdsLeft === 0 && a.modes.includes(3) && a.textRows > 5 && a.spritesAtText === 0, a);
  }
  const fb = R.T.fallback;
  report.check(`nạp dữ liệu chữ dò lỗi (1670, 404): chọn Hình chữ dò → Nét khắc (${fb.look}, ${fb.count} hạt từ bản đồ nét), mặt nạ tắt, giữ → bắn chạy (${fb.phases.join(' → ')}), không lỗi trang`, fb.look === 'stroke' && fb.lookWanted === 'traced' && fb.src === 'stroke' && fb.count > 100 && fb.trace !== 1 && fb.phases.includes('out') && fb.spritesAtText === 0 && fb.errs.length === 0, fb);
}

report.section('K. "Chữ Hán (số hoá)" (r87 — 1442) · chữ bay dựng đứng, không méo');
const CHR = JSON.parse(fs.readFileSync(new URL('../../public/hantext/bia-1442/chars.json', import.meta.url), 'utf8'));
{
  const k = R.K;
  const h = k.state.han ?? {};
  report.check(`văn bản đi kèm (public/hantext, $doc ghi nguồn + "cần đối chiếu": ${k.want.doc}); ngưỡng ${h.threshold}: ${h.eligible} chữ đủ tin cậy (đếm độc lập từ chars.json: ${k.want[0.7]}) = ${h.placed} đặt trên đá + ${h.gated} ngoài lớp mặt; ${h.low} chữ dưới ngưỡng không đặt`, k.want.doc && k.state.look === 'hantext' && new Set(k.state.loads).size === 2 && k.state.loads.every((u) => u.includes('/hantext/bia-1442/')) && h.threshold === 0.7 && h.eligible === k.want[0.7] && h.placed + h.gated === h.eligible && h.placed === k.state.glyphCount && h.placed > 400 && h.total === k.want.total, k.state);
  const c = k.state.check;
  {
    const rc = CHR.chars.filter((x) => x.src === 'recon');
    report.check(`r90: chữ DỰNG LẠI (src recon — quê quán / tiêu đề giáp suy từ phiên âm) không bao giờ thành chữ: ${rc.length} chữ trong dữ liệu, không ô atlas (${rc.filter((x) => x.a).length} có a), đã đặt ${c.reconPlaced}, có id trên bản đồ ${c.reconWithId} (chỗ đó là Nét khắc)`, rc.length > 0 && c.reconN === rc.length && rc.every((x) => !x.a) && c.reconPlaced === 0 && c.reconWithId === 0, { reconN: c.reconN, placed: c.reconPlaced, withId: c.reconWithId });
  }
  report.check(`ô chữ dưới ngưỡng không có chữ: ${c.lowWithId} / ${c.lowN} ô có id trên bản đồ (phải 0); ${c.placedOk} / ${c.placed} chữ đã đặt đúng ô; hạt sáng (Nét khắc) ở chỗ chưa chắc: ${h.motesKept} hạt (bỏ ${h.motesDropped} hạt trong ô chữ đã đặt)`, c.lowWithId === 0 && c.lowN > 100 && c.placedOk === c.placed && h.motesKept > 200 && h.motesDropped > 0, c);
  const h9 = k.state9.han ?? {};
  report.check(`đổi ngưỡng 0,9 → ${h9.eligible} chữ đủ tin cậy (đếm độc lập ${k.want[0.9]}), ô dưới ngưỡng có id: ${k.state9.check?.lowWithId}`, h9.threshold === 0.9 && h9.eligible === k.want[0.9] && h9.placed < h.placed && k.state9.check?.lowWithId === 0, k.state9);
  report.check(`dải tiêu đề không đổi: không id trong khung dải (${k.state.headerIdsLeft}), hạt dải tiêu đề còn (${k.state.headerCount}); ảnh dải tiêu đề lúc giữ như Nét khắc (Δ TB ${k.hold.head?.mean}, p90 ${k.hold.head?.p90})`, k.state.headerIdsLeft === 0 && k.state.headerCount > 10 && !!k.hold.head && Math.abs(k.hold.head.mean) <= 0.001, k.hold.head);
  report.check(`chữ Hán sáng sau vệt: thân bia trên đường sáng Δ TB ${k.hold.litH.mean} (Nét khắc ${k.hold.litS.mean}), dưới vạch ${k.hold.belowH.mean} — không le lói trước vạch (thức = ${k.hold.tr?.awake})`, k.hold.tr?.on === 1 && k.hold.tr?.mode === 1 && k.hold.tr?.awake === 0 && k.hold.litH.mean > 2 * Math.max(0.002, k.hold.litS.mean) && Math.abs(k.hold.belowH.mean) <= 0.002, k.hold);
  report.check(`bia chưa có văn bản căn chỉnh (1670): chọn Chữ Hán → Nét khắc (${k.other.look}), không tải gì từ hantext/`, k.other.look === 'stroke' && k.other.lookWanted === 'hantext' && !k.other.han && k.other.loads.length === 0, k.other);
  const all = k.quads.flatMap((q) => q.rows.map((r) => ({ ...r, label: q.label })));
  const bad = all.filter((r) => !(r.S > 100 && !r.edge && Math.abs(r.aspect / r.asp - 1) <= 0.03 && r.fill >= 0.97));
  const labels = [...new Set(all.map((r) => r.label))];
  {
    const q = R.K2;
    const meta = JSON.parse(fs.readFileSync(new URL('../../public/hantext/bia-1442/chars.json', import.meta.url), 'utf8')).sdf ?? {};
    report.check(`r89 atlas chữ Hán là SDF dựng từ font đậm (${(meta.font ?? []).join(', ')}; ô ${meta.cell} texel, tầm ±${meta.spread}, mực ~${meta.fill} ô) — shader nhận (${JSON.stringify(q.sdf)})`, meta.spread > 0 && meta.cell > 0 && Array.isArray(q.sdf) && q.sdf[2] === meta.spread);
    report.check(`r89 chữ Hán TRÊN ĐÁ sáng theo hình chữ (khung nghỉ, DPR ${q.dpr}, ${q.n} chữ đang sáng, ô ~${q.cellPx} px): độ lấp ô trung vị ${q.frac} (≤ 0,6 ở ${(q.fracOk * 100).toFixed(0)} % ô, cần ≥ 75 % — r90: mực phủ kín hộp nét khắc, chữ nhiều nét ở ~6 px lấp > 0,6), IoU với hình chữ trung vị ${q.iou} (≥ 0,5; ${(q.iouOk * 100).toFixed(0)} % ô)`, q.n >= 50 && q.frac <= 0.6 && q.fracOk >= 0.75 && q.iou >= 0.5 && q.errors === 0, q);
  }
  report.check(`chữ bay dựng đứng, đúng tỉ lệ ô atlas: ${all.length} sprite ở ${k.quads.length} khung (${labels.join(' · ')}) — tỉ lệ trên màn lệch ≤ 3 % (lớn nhất ${(Math.max(0, ...all.map((r) => Math.abs(r.aspect / r.asp - 1))) * 100).toFixed(1)} %), độ lấp đầy ≥ 97 % (không xoay; nhỏ nhất ${Math.min(1, ...all.map((r) => r.fill))})`, all.length >= 12 && labels.length >= 5 && bad.length === 0, bad.length ? bad.slice(0, 6) : all.slice(0, 4));
}

report.section('S. vạch quét ↔ chữ sáng đồng bộ (r90 — mép dẫn của vạch làm lộ chữ)');
for (const [k, v] of Object.entries(R.S).filter(([k]) => k !== 'errors')) {
  const ok = v.d.filter((x) => x !== null);
  const bad = ok.filter((x) => Math.abs(x) > 1);
  report.check(`${k}: chữ / hạt bắt đầu sáng đúng khung mép dẫn vạch qua tâm (±1 khung) — ${ok.length - bad.length} / ${v.n} (lệch khung: ${[...new Set(v.d)].join(' ')})`, v.okLook && ok.length === v.n && bad.length === 0 && R.S.errors === 0, v);
}
report.section('P. hiệu năng — phần thêm của hiệu ứng (giá khung p95, ms, đồng hồ tường chặn GPU)');
for (const [k, v] of Object.entries(R.P)) {
  report.info(k, v);
  // (máy chạy thử bận: nhiễu p95 ± ~1 ms ở 4K — giới hạn 4K 2 ms)
  const lim = k.startsWith('3840') ? 2 : 1;
  for (const [name, label, want] of [['on', 'Nét khắc', (x) => x.fx?.on === 1 && x.fx?.vis && x.fx?.tr !== 1], ['traced', 'Hình chữ dò', (x) => x.fx?.on === 1 && x.fx?.tr === 1]]) {
    const on = v[name];
    const ok = on?.hold && v.off.hold && on.fly && v.off.fly && want(on.hold) && v.off.hold.fx?.on !== 1;
    if (!ok) {
      report.check(`${k} ${label}: đo được (bật: hiệu ứng đang chạy lúc đo; tắt: không)`, false, v);
      continue;
    }
    // phần thêm = TRUNG VỊ các hiệu p95 từng vòng (bật − tắt đo liền nhau — triệt trôi chậm của máy bận)
    const med = (a) => [...a].sort((x, y) => x - y)[(a.length - 1) >> 1];
    const pair = (a, b) => +med(a.map((x, i) => x - b[i])).toFixed(3);
    const dh = pair(on.holdP95, v.off.holdP95);
    const df = pair(on.flyP95, v.off.flyP95);
    report.check(`${k} ${label}: hiệu ứng thêm (trung vị hiệu p95 từng vòng) — lúc giữ ${dh} ms (p95 tốt nhất ${v.off.hold.p95} → ${on.hold.p95}) · lúc bay ${df} ms (${v.off.fly.p95} → ${on.fly.p95}); ≤ ${lim} ms`, dh <= lim && df <= lim, { dh, df, hold: [v.off.holdP95, on.holdP95], fly: [v.off.flyP95, on.flyP95] });
  }
}

process.exit(report.finish(errors));
