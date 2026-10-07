// r81 — TÊN KHẮC NẰM GỌN TRONG Ô CHỮ CỦA MẶT BIA, cả 82 bia: ô chữ (src/data/face-fields.generated.json + sửa tay ở
// face-fields.overrides.json — toạ độ mô hình: trên = đường khắc ngay dưới dải tiêu đề, trái / phải = hai đường dọc khung trong,
// dưới = đáy khung trong / trên đỉnh đầu rùa) lái bố cục lớp tên lúc nghỉ (src/views/cinema/names.js). Với từng bia, mỗi cỡ khung:
//   · ô app đang dùng (vm.cinemaNamesLayout().field) đúng là ô của chính bia đó (tệp sinh ghép phần sửa tay);
//   · ở nhiều pha cuộn (hoạt ảnh cuộn dừng ở 0 · 1/6 · … · 5/6 vòng): hộp bao MỌI dòng chữ đang vẽ — nhãn + tên đỗ đầu, tên /
//     danh hiệu / dải giáp trong vùng cuộn (cắt theo khung cắt của vùng cuộn), dòng cờ — nằm trọn trong ô, dưới đường dải tiêu
//     đề. Đo trên CHÍNH các phần tử đang vẽ trong toạ độ của mặt bia: bỏ tạm transform CSS3D của tổ tiên (đồng bộ, không khung
//     vẽ nào xen giữa) → hộp chữ theo px thiết kế của ô → toạ độ mô hình (x0 + px·s, y1 − py·s);
//   · đối chiếu trên MÀN: hộp bao thật (có transform CSS3D) của chữ đầu ô + khung vùng cuộn nằm trong hình chiếu của ô;
//   · vùng cuộn (cả hai dải mờ trên / dưới — mask của chính nó) nằm trong ô; chữ không bị cắt ngang (tên dài hơn ô).
//   · r90: ô tên giáp cố định (đầu vùng cuộn) là chữ đầu ô — cũng phải nằm trong ô.
// In chiều cao ô (px màn, hình chiếu lúc nghỉ) nhỏ nhất / trung vị / lớn nhất mỗi cỡ khung.
// node tests/cinema/face-field.test.mjs --port 5180 [--sizes 1440x900,1920x1080] [--only bia-1598,bia-1602] [--json out.json]
//   (≈ 4 phút mỗi cỡ khung)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const { port, headed } = parseArgs();
const SIZES = (arg('--sizes') ?? '1440x900,1920x1080').split(',').map((s) => s.split('x').map(Number));
const ONLY = arg('--only')?.split(',') ?? null;
const JSON_OUT = arg('--json');
const PHASES = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];
const GEN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/face-fields.generated.json'), 'utf8'));
const OVR = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/face-fields.overrides.json'), 'utf8'));
const IDS = Object.keys(GEN.steles)
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
  .filter((id) => !ONLY || ONLY.includes(id));
/** Ô kỳ vọng = số dò ghép phần sửa tay (như src/data/index.js faceFieldOf). */
const expectField = (id) => {
  const o = OVR.source === GEN.source ? OVR.steles?.[id] : null;
  const f = { ...GEN.steles[id], ...(o ?? {}) };
  f.band = o?.band ?? o?.y1 ?? f.band ?? f.y1;
  return f;
};

const report = createReport('face-field');
const { page, close, errors } = await launch({
  headed,
  width: SIZES[0][0],
  height: SIZES[0][1],
  settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, cinemaNames: true },
});
await openCinema(page, port, { id: IDS[0], hooks: ['cinemaNamesLayout', 'cinemaIdle', 'cinemaInfo', 'cinemaTxProgress', 'cinemaLods'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const source = await E(() => (window.__vm.cinemaLods().v2 ? 'v2' : 'v1'));
report.check(`nguồn mô hình đang chạy = nguồn đã đo (${GEN.source})`, source === GEN.source, source);

/**
 * Trong trang: các hộp chữ của lớp tên đang hiện ở pha cuộn `phase` (0..1 vòng), theo px thiết kế của ô (gốc trên-trái của ô) —
 * đo trên chính phần tử đang vẽ, transform CSS3D của tổ tiên bỏ tạm trong lúc đo (đồng bộ). Kèm hộp bao thật trên màn.
 */
const probe = (phase) =>
  E((phase) => {
    const vis = (b) => {
      let a = 1;
      for (let e = b; e && !e.classList?.contains('cin-css3d'); e = e.parentElement) {
        const cs = getComputedStyle(e);
        a *= +cs.opacity;
        if (cs.display === 'none' || cs.visibility === 'hidden') a = 0;
      }
      return a;
    };
    const box = [...document.querySelectorAll('.cin-nm')].map((b) => ({ b, a: vis(b) })).sort((x, y) => y.a - x.a)[0];
    if (!box || box.a < 0.3) return { err: 'không thấy ô tên đang hiện' };
    const B = box.b;
    const roll = B.querySelector('.cin-nm__roll');
    const track = B.querySelector('.cin-nm__track');
    const anim = track?.getAnimations?.()[0] ?? null;
    let dur = 0;
    if (anim) {
      dur = anim.effect.getComputedTiming().duration;
      // r89: mọi hoạt ảnh của ô (cột cuộn + nhãn giáp dọc hai lề) cùng một pha
      for (const a of B.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = phase * a.effect.getComputedTiming().duration;
      }
    }
    // các dòng chữ: mỗi nút chữ (Range — đúng bề rộng chữ, kể cả phần tràn) + hai chỉ khắc của dải giáp (::before / ::after = hộp li)
    const textNodes = [];
    const walk = document.createTreeWalker(B, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent.trim()) textNodes.push(n);
    const kind = (n) => (n.parentElement.closest('.cin-nm__roll') ? 'roll' : 'head');
    const rects = () => {
      const out = [];
      const rg = document.createRange();
      for (const n of textNodes) {
        rg.selectNodeContents(n);
        const r = rg.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ t: n.textContent.trim().slice(0, 40), k: kind(n), cls: n.parentElement.className, l: r.left, r: r.right, t0: r.top, b: r.bottom });
      }
      return out;
    };
    // 1) hộp thật trên màn (có transform CSS3D)
    const scr = rects();
    const rr = roll?.getBoundingClientRect();
    const scrRoll = rr ? { l: rr.left, r: rr.right, t0: rr.top, b: rr.bottom } : null;
    // 2) toạ độ ô (px thiết kế): bỏ transform / perspective của tổ tiên tới hết lớp CSS3D, đo, trả lại ngay (không khung vẽ xen giữa)
    const saved = [];
    for (let e = B.parentElement; e && e !== document.body; e = e.parentElement) {
      saved.push([e, e.style.transform, e.style.perspective]);
      e.style.transform = 'none';
      e.style.perspective = 'none';
    }
    const b0 = B.getBoundingClientRect();
    const loc = rects().map((q) => ({ ...q, l: q.l - b0.left, r: q.r - b0.left, t0: q.t0 - b0.top, b: q.b - b0.top }));
    const lr = roll?.getBoundingClientRect();
    const locRoll = lr ? { l: lr.left - b0.left, r: lr.right - b0.left, t0: lr.top - b0.top, b: lr.bottom - b0.top } : null;
    const lw = B.querySelector('.cin-nm__rollw')?.getBoundingClientRect();
    const locRollW = lw ? { l: lw.left - b0.left, r: lw.right - b0.left, t0: lw.top - b0.top, b: lw.bottom - b0.top } : null;
    const bw = B.clientWidth;
    for (const [e, t, p] of saved) {
      e.style.transform = t;
      e.style.perspective = p;
    }
    // chữ trong vùng cuộn bị cắt ngang (tên dài hơn ô)
    const clipped = [...B.querySelectorAll('.cin-nm__it')].filter((li) => li.scrollWidth > li.clientWidth + 1).map((li) => li.textContent.trim());
    const mask = roll ? getComputedStyle(roll).maskImage || getComputedStyle(roll).webkitMaskImage : null;
    return { loc, locRoll, locRollW, scr, scrRoll, bw, dur, phase: anim ? anim.currentTime / dur : null, rollOn: B.classList.contains('is-roll'), clipped, mask };
  }, phase);

const fails = {};
const add = (key, errs) => {
  if (errs?.length) (fails[key] ??= []).push(...errs);
};
const heights = {}; // cỡ → id → chiều cao ô (px màn)
const TOL_U = 2e-4; // dung sai toạ độ mô hình (≈ 0,3 px màn ở 1440 × 900)
const TOL_PX = 1.5; // dung sai trên màn (làm tròn hộp bao)
for (const [W, H] of SIZES) {
  await page.setViewportSize({ width: W, height: H });
  await sleep(900);
  const size = `${W}x${H}`;
  heights[size] = {};
  for (const id of IDS) {
    const key = `${size} ${id}`;
    await page.mouse.move(6, H - 6); // chuột ngoài bia: lúc nghỉ, không hover
    const ok = await E(async (id) => {
      if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
      const t0 = performance.now();
      while (performance.now() - t0 < 25000) {
        await new Promise((r) => setTimeout(r, 120));
        const L = window.__vm.cinemaNamesLayout();
        if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0 && window.__vm.cinemaLods().liveLod === 0 && L?.id === id && L.lay) return true;
      }
      return false;
    }, id);
    if (!ok) {
      add(key, ['không tới được bia / lớp tên chưa dựng (25 s)']);
      continue;
    }
    await E(() => document.fonts.ready);
    await sleep(700);
    const L = await E(() => window.__vm.cinemaNamesLayout());
    const exp = expectField(id);
    const F = L.field;
    if (!F) {
      add(key, ['app không có ô chữ đo cho bia này (faceFieldOf → null)']);
      continue;
    }
    const bad = ['x0', 'x1', 'y0', 'y1'].filter((k) => Math.abs(F[k] - exp[k]) > 1e-6);
    if (bad.length) add(key, [`ô app ≠ ô dữ liệu (${bad.map((k) => `${k} ${F[k]} ≠ ${exp[k]}`).join(', ')})`]);
    const band = Math.min(exp.band ?? exp.y1, exp.y1);
    heights[size][id] = +(L.screen.field.b - L.screen.field.t).toFixed(1);
    const { s, box } = L.lay;
    // px thiết kế của ô → toạ độ mô hình
    const toM = (q) => ({ x0: box.x0 + q.l * s, x1: box.x0 + q.r * s, y1: box.y1 - q.t0 * s, y0: box.y1 - q.b * s });
    const outside = (m) => {
      const o = [];
      if (m.x0 < F.x0 - TOL_U) o.push(`trái ${((F.x0 - m.x0) / s).toFixed(1)} px`);
      if (m.x1 > F.x1 + TOL_U) o.push(`phải ${((m.x1 - F.x1) / s).toFixed(1)} px`);
      if (m.y1 > band + TOL_U) o.push(`lên dải tiêu đề ${((m.y1 - band) / s).toFixed(1)} px`);
      if (m.y0 < F.y0 - TOL_U) o.push(`dưới đáy ô ${((F.y0 - m.y0) / s).toFixed(1)} px`);
      return o;
    };
    const SF = L.screen.field;
    const errs = [];
    let nText = 0;
    const phases = [];
    for (const ph of PHASES) {
      const P = await probe(ph);
      if (P.err) {
        errs.push(P.err);
        break;
      }
      phases.push(P.phase);
      if (P.clipped.length && ph === 0) errs.push(`chữ cuộn bị cắt ngang: ${P.clipped.slice(0, 3).join(' · ')}`);
      if (P.locRoll) {
        const o = outside(toM(P.locRoll));
        if (o.length && ph === 0) errs.push(`vùng cuộn (cả dải mờ) ra ngoài ô: ${o.join(', ')}`);
        if (ph === 0 && !/gradient/.test(P.mask ?? '')) errs.push('vùng cuộn không có dải mờ (mask)');
      }
      for (const q of P.loc) {
        let r = q;
        if (q.k === 'roll') {
          // cắt theo khung cắt của vùng cuộn (overflow hidden) — phần ngoài khung không vẽ
          const c = P.locRoll;
          r = { ...q, l: Math.max(q.l, c.l), r: Math.min(q.r, c.r), t0: Math.max(q.t0, c.t0), b: Math.min(q.b, c.b) };
          if (r.r - r.l < 0.5 || r.b - r.t0 < 0.5) continue; // ngoài khung cắt
          if (q.l < c.l - 0.5 || q.r > c.r + 0.5) errs.push(`"${q.t}" bị khung cuộn cắt ngang (pha ${ph.toFixed(2)})`);
        }
        nText++;
        const o = outside(toM(r));
        if (o.length) errs.push(`"${q.t}" (${q.cls.replace(/cin-nm__/g, '')}, pha ${ph.toFixed(2)}): ${o.join(', ')}`);
      }
      // đối chiếu trên màn: chữ đầu ô + khung vùng cuộn trong hình chiếu của ô
      if (ph === 0) {
        const inS = (q) => q.l >= SF.l - TOL_PX && q.r <= SF.r + TOL_PX && q.t0 >= SF.t - TOL_PX && q.b <= SF.b + TOL_PX;
        for (const q of P.scr.filter((q) => q.k === 'head')) if (!inS(q)) errs.push(`màn: "${q.t}" ngoài hình chiếu ô (${JSON.stringify({ l: q.l | 0, r: q.r | 0, t: q.t0 | 0, b: q.b | 0 })} vs ${JSON.stringify({ l: SF.l | 0, r: SF.r | 0, t: SF.t | 0, b: SF.b | 0 })})`);
        if (P.scrRoll && !inS(P.scrRoll)) errs.push('màn: vùng cuộn ngoài hình chiếu ô');
      }
      if (!P.rollOn) break; // không cuộn → một pha là đủ
    }
    if (!nText) errs.push('không đo được dòng chữ nào');
    add(key, [...new Set(errs)].slice(0, 8));
    process.stdout.write(`${key} ${fails[key] ? '✗' : '✓'} ô ${heights[size][id]} px · ${phases.length} pha${fails[key] ? ` · ${fails[key][0]}` : ''}\n`);
  }
}
await close();

report.section(`Ô chữ mặt bia × ${IDS.length} bia × ${SIZES.map((s) => s.join('×')).join(' · ')}`);
for (const [W, H] of SIZES) {
  const size = `${W}x${H}`;
  const list = IDS.filter((id) => fails[`${size} ${id}`]).map((id) => `${id}: ${fails[`${size} ${id}`].join(' | ')}`);
  report.check(`${size}: mọi chữ trong ô, dưới dải tiêu đề, mọi pha cuộn (${IDS.length - list.length}/${IDS.length} bia)`, list.length === 0, list.slice(0, 12));
  const hs = Object.entries(heights[size]).sort((a, b) => a[1] - b[1]);
  if (hs.length) {
    const med = hs[hs.length >> 1][1];
    report.info(`${size}: chiều cao ô (px màn) nhỏ nhất / trung vị / lớn nhất`, `${hs[0][1]} (${hs[0][0]}) / ${med} / ${hs[hs.length - 1][1]} (${hs[hs.length - 1][0]}) · thấp nhất: ${hs.slice(0, 5).map(([i, h]) => `${i.slice(4)} ${h}`).join(', ')}`);
  }
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ fails, heights }, null, 1));
process.exit(report.finish(errors));
