// r88 → r89 → r90 → r91 — TÊN KHẮC lúc nghỉ: MỖI LÚC MỘT GIÁP, mỗi giáp hai pha VÀO rồi CUỘN. Ô tên giáp cố định (tên giáp ngắn, chữ
// hoa giãn, chỉ khắc ngắn hai bên) cách khung khắc người đỗ đầu ~0,8 dòng tên; giáp mới: các dòng đang thấy được trồi lên chỗ nghỉ lệch
// nhịp (lấp kín vùng ngay), đứng, rồi cuộn lên ra hết; dòng vào từ đáy lúc cuộn không có hoạt ảnh vào; vùng trống → mờ chéo tên giáp
// (≤ 0,35 s) → giáp kế VÀO. Mỗi bia (1442, 1463, 1554, 1691 + 1623 — một giáp, tên giáp trùng nhãn khung → không ô tên giáp), đo trong
// TOẠ ĐỘ THIẾT KẾ của vùng cuộn (dời của danh sách + vị trí dòng — không lệch vì phép chiếu CSS3D), đặt currentTime mọi hoạt ảnh của ô tên:
//   · 12 pha ngẫu nhiên: tên đang thấy thuộc MỘT giáp = giáp của tên giáp đang hiện; không chỉ khắc / nhãn trong cột / nhãn dọc;
//   · ô tên giáp: cỡ chữ ≥ GH_MIN px thiết kế, hai chỉ khắc bằng nhau, cả ô (chữ + chỉ) trong bề ngang ô chữ; cách khung khắc 0,6–1 dòng
//     tên, như nhau mọi bia (±2 px theo cỡ tên);
//   · ngay sau pha VÀO: dòng đầu đục hẳn, ở dưới hẳn dải mờ trên; mọi dòng đang thấy được đều đã hiện (vùng lấp kín nếu giáp đủ dòng);
//     chỉ các dòng đó có hoạt ảnh vào (dòng vào lúc cuộn: không);
//   · mỗi lần đổi giáp: quãng trống (dòng cuối ra hết → dòng đầu giáp kế bắt đầu hiện) ≤ 0,35 s, vùng trống suốt lúc mờ chéo tên giáp;
//   · giáp ngắn (vừa vùng): VÀO → đứng 1,5 s mỗi tên (4–10 s) → cuộn ra; bia một giáp: lặp (hết → trống ngắn → VÀO lại);
//   · khung khắc quanh khối đỗ đầu; khối đầu đứng yên; mọi phần trong ô chữ (r81).
// Giảm chuyển động: danh sách đứng yên (không hoạt ảnh dời), giáp đầu; đổi giáp chỉ bằng độ đục. Chụp 3 pha của 1442 + 1623: --shots <thư mục>
// node tests/cinema/names-pin.test.mjs --port 5180   (≈ 2 phút)
import fs from 'node:fs';
import path from 'node:path';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const SHOTS = (() => {
  const i = process.argv.indexOf('--shots');
  return i > 0 ? process.argv[i + 1] : null;
})();
const report = createReport('names-pin');
const SEED = { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true };
const IDS = ['bia-1442', 'bia-1463', 'bia-1554', 'bia-1691', 'bia-1623'];
const SINGLE = 'bia-1623';
const GH_MIN = 12.5; // px thiết kế (r90: 11)
const { page, close, errors } = await launch({ headed, width: 1440, height: 900, settings: SEED });
await openCinema(page, port, { id: IDS[0], hooks: ['cinemaStelePoint', 'cinemaIdle', 'cinemaInfo', 'cinemaTxProgress', 'cinemaNamesLayout'], settleMs: 4000 });
const E = (fn, a) => page.evaluate(fn, a);
const goto = (id) => E(async (id) => {
  if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 100));
    if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0) break;
  }
}, id);
let seed = 91;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** Đặt thời điểm t (s, trong chu kỳ) cho mọi hoạt ảnh của ô tên đang hiện rồi đo (toạ độ thiết kế của vùng cuộn). */
const probe = (t) => E((t) => {
  const box = [...document.querySelectorAll('.cin-nm')].find((b) => b.getClientRects().length) ?? document.querySelector('.cin-nm');
  for (const a of box.getAnimations({ subtree: true })) {
    a.pause();
    a.currentTime = t * 1000;
  }
  const r = (el) => {
    const q = el?.getBoundingClientRect();
    return q ? { t: q.top, b: q.bottom, l: q.left, r: q.right } : null;
  };
  const ty = (el) => new DOMMatrix(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m42;
  const boxR = r(box);
  const rollEl = box.querySelector('.cin-nm__roll');
  const H = rollEl.clientHeight;
  const head = r(box.querySelector('.cin-nm__head'));
  const headEl = box.querySelector('.cin-nm__head');
  const frame = getComputedStyle(headEl, '::before').borderTopStyle;
  const ghEl = box.querySelector('.cin-nm__gh');
  // tên giáp: độ đục thật (hoạt ảnh) — đang hiện = cao nhất; mờ dở = 0,05 … 0,95
  const labs = [...box.querySelectorAll('.cin-nm__ghl')].map((el) => ({ g: Number(el.dataset.g), o: +getComputedStyle(el).opacity, text: el.textContent }));
  const cur = [...labs].sort((a, b) => b.o - a.o)[0] ?? null;
  const fading = labs.filter((l) => l.o > 0.05 && l.o < 0.95).length;
  // dòng (thiết kế, vùng cuộn: 0 … H): đỉnh = dời danh sách + vị trí dòng + dời riêng của dòng; độ đục = danh sách × dòng
  const rows = [...box.querySelectorAll('.cin-nm__grp')].flatMap((g) => {
    const gy = ty(g);
    const go = +getComputedStyle(g).opacity;
    return [...g.querySelectorAll(':scope > .cin-nm__it')].map((li, i) => {
      const top = gy + li.offsetTop + ty(li);
      return { g: Number(g.dataset.g), i, top: +top.toFixed(2), bot: +(top + li.offsetHeight).toFixed(2), h: li.offsetHeight, o: +(go * +getComputedStyle(li).opacity).toFixed(3), anim: li.getAnimations().length, text: li.textContent };
    });
  });
  const vis = rows.filter((x) => x.o > 0.02 && x.bot > 0.5 && x.top < H - 0.5);
  // ô tên giáp: cỡ chữ, hai chỉ khắc (::before / ::after), bề ngang cả ô (chỉ + khe + chữ), cách khung khắc (thiết kế)
  let gh = null;
  if (ghEl) {
    const l0 = ghEl.querySelector('.cin-nm__ghl');
    const csl = getComputedStyle(l0);
    const b4 = getComputedStyle(l0, '::before');
    const af = getComputedStyle(l0, '::after');
    const fs = parseFloat(csl.fontSize);
    const gap = parseFloat(csl.columnGap) || 0;
    const tw = Math.max(...[...ghEl.querySelectorAll('.cin-nm__ght')].map((e) => e.offsetWidth));
    const wl = parseFloat(b4.width);
    const wr = parseFloat(af.width);
    const rollw = box.querySelector('.cin-nm__rollw');
    gh = { fs, wl, wr, hl: parseFloat(b4.height), contentW: +(wl + wr + 2 * gap + tw).toFixed(1), W: box.clientWidth, gapFrame: rollw.offsetTop + ghEl.offsetTop - (headEl.offsetTop + headEl.offsetHeight), rn: parseFloat(box.style.getPropertyValue('--rn')), b4: b4.content, af: af.content, ghRect: r(ghEl) };
  }
  const inside = (a) => a && a.t >= boxR.t - 0.75 && a.b <= boxR.b + 0.75 && a.l >= boxR.l - 0.75 && a.r <= boxR.r + 0.75;
  return {
    t,
    H,
    vis: vis.map((x) => ({ g: x.g, i: x.i, top: x.top, o: x.o })),
    groups: [...new Set(vis.map((x) => x.g))],
    rows,
    cur: cur ? { g: cur.g, o: cur.o, text: cur.text } : null,
    fading,
    ghN: box.querySelectorAll('.cin-nm__gh').length,
    gh,
    rules: box.querySelectorAll('.cin-nm__gr, .cin-nm__band, .cin-nm__lab, .cin-nm__side').length + [...box.querySelectorAll('.cin-nm__roll *')].filter((e) => /(^|\s)cin-nm__(gr|band|lab|side)(\s|$)/.test(e.className)).length,
    labTexts: labs.map((l) => l.text),
    head,
    frame,
    ok: inside(head) && (!gh || inside(gh.ghRect)) && inside(r(rollEl)),
  };
}, t);

const R = {};
for (const id of IDS) {
  await goto(id);
  await page.mouse.move(720, 890, { steps: 3 });
  await sleep(2600);
  const plan = await E(() => window.__vm.cinemaNamesLayout()?.rollPlan?.plan ?? null);
  const rows = [];
  for (let k = 0; k < 12; k++) rows.push(await probe(rnd() * plan.T));
  // từng giáp: ngay sau VÀO · giữa pha đứng · ngay trước / sau lần đổi
  const per = [];
  for (const [k, G] of plan.groups.entries()) {
    const nx = plan.groups[k + 1]?.s ?? plan.T; // giáp kế VÀO (bia một giáp / giáp cuối: đầu chu kỳ sau)
    per.push({
      G,
      afterIn: await probe(G.inEnd + 0.05),
      beforeEnd: await probe(G.e - 0.15),
      atEnd: await probe(G.e + 0.01),
      midXf: await probe((G.e + nx) / 2),
      nextIn: await probe((nx + 0.06) % plan.T),
      gapS: +(nx - G.e).toFixed(3),
    });
  }
  R[id] = { plan, rows, per };
  if (SHOTS && (id === 'bia-1442' || id === SINGLE)) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const u of [rnd(), rnd(), rnd()]) {
      await probe(u * plan.T);
      const b = await E(() => { const q = [...document.querySelectorAll('.cin-nm')].find((b) => b.getClientRects().length).getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; });
      await sleep(200);
      await page.screenshot({ path: path.join(SHOTS, `names-${id}-${u.toFixed(2)}.png`), clip: { x: Math.max(0, b.l - 50), y: Math.max(0, b.t - 70), width: Math.min(1440, b.r - b.l + 100), height: Math.min(900, b.b - b.t + 100) } });
    }
  }
}
{
  const B = await launch({ headed, width: 1440, height: 900, settings: SEED, reducedMotion: true });
  await openCinema(B.page, port, { id: 'bia-1442', hooks: ['cinemaStelePoint', 'cinemaNamesLayout'], settleMs: 4000 });
  R.rm = await B.page.evaluate(() => {
    const box = document.querySelector('.cin-nm');
    const anims = box.getAnimations({ subtree: true });
    const props = [...new Set(anims.flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'computedOffset', 'easing', 'composite'].includes(x)))))];
    const g0 = box.querySelector('.cin-nm__grp[data-g="0"]');
    const lab = [...box.querySelectorAll('.cin-nm__ghl')].sort((a, b) => +getComputedStyle(b).opacity - +getComputedStyle(a).opacity)[0];
    return { anims: anims.length, props, plan: window.__vm.cinemaNamesLayout()?.rollPlan?.plan ?? null, g0: g0 ? +getComputedStyle(g0).opacity : null, lab: lab ? Number(lab.dataset.g) : null };
  });
  await B.close();
}

const same = (a, b) => a && b && Math.abs(a.t - b.t) < 0.5 && Math.abs(a.b - b.b) < 0.5 && Math.abs(a.l - b.l) < 0.5;
const fmt = (v) => (v == null ? '—' : Number(v).toFixed(2));
report.section('mỗi lúc một giáp · VÀO rồi CUỘN · ô tên giáp cố định có chỉ khắc · khung khắc khối đầu');
const gaps = {};
for (const id of IDS) {
  const { plan, rows, per } = R[id];
  const single = id === SINGLE;
  const all = [...rows, ...per.flatMap((p) => [p.afterIn, p.beforeEnd, p.atEnd, p.midXf, p.nextIn])];
  // tên đang thấy luôn thuộc một giáp, = giáp của tên giáp đang hiện (lúc không mờ chéo)
  const bad = rows.filter((r) => r.groups.length > 1 || (r.ghN > 0 && r.groups.length === 1 && (!r.cur || r.cur.g !== r.groups[0]) && r.fading === 0));
  report.check(`${id}${single ? ' (một giáp)' : ''}: 12 pha (chu kỳ ${plan.T} s, ${plan.m} giáp) — tên đang thấy luôn thuộc MỘT giáp = giáp của tên giáp đang hiện (${rows.reduce((t, r) => t + r.vis.length, 0)} dòng; lệch ${bad.length} pha)`, bad.length === 0 && rows.some((r) => r.vis.length > 0), bad.slice(0, 2).map((r) => ({ t: r.t, groups: r.groups, cur: r.cur })));
  report.check(`${id}: không chỉ khắc / nhãn trong cột / nhãn dọc (${Math.max(...rows.map((r) => r.rules))}); tên giáp ngắn: ${[...new Set(rows[0].labTexts)].join(' · ') || '— (không ô tên giáp)'}`, rows.every((r) => r.rules === 0) && rows[0].labTexts.every((t) => !t.includes('·') && /giáp/i.test(t)) && (single || rows[0].labTexts.length === plan.m), rows[0].labTexts);
  if (!single) {
    const g = rows[0].gh;
    gaps[id] = g ? +(g.gapFrame / (g.rn * 1.2)).toFixed(3) : null;
    report.check(`${id}: ô tên giáp — chữ ${fmt(g?.fs)} px thiết kế (≥ ${GH_MIN}; tên ${fmt(g?.rn)} px), chỉ khắc hai bên ${fmt(g?.wl)} / ${fmt(g?.wr)} px (bằng nhau, dày ${fmt(g?.hl)} px), cả ô ${fmt(g?.contentW)} ≤ ô chữ ${g?.W} px; cách khung khắc ${g?.gapFrame} px = ${gaps[id]} dòng tên (0,6–1)`, !!g && g.fs >= GH_MIN - 0.01 && g.wl > 4 && Math.abs(g.wl - g.wr) < 0.01 && g.hl <= 1.5 && g.b4 !== 'none' && g.af !== 'none' && g.contentW <= g.W - 2 && gaps[id] >= 0.6 && gaps[id] <= 1.0 && Math.abs(g.gapFrame - Math.round(g.rn * 0.95)) <= 2, g);
  }
  // pha VÀO / CUỘN từng giáp
  const inBad = [];
  const scrollBad = [];
  const gapBad = [];
  for (const p of per) {
    const { G, afterIn: A } = p;
    const mine = A.rows.filter((x) => x.g === G.k);
    const first = mine[0];
    const inSet = mine.filter((x) => x.anim > 0);
    const fillOk = mine.filter((x) => x.top < A.H - 0.5 && x.bot > 0.5).every((x) => x.o > 0.99); // mọi dòng đang thấy được đã hiện
    const reach = Math.max(...mine.map((x) => x.bot)) >= A.H - 1 || mine.at(-1).bot <= A.H; // giáp đủ dòng: lấp tới đáy vùng
    if (!(first && first.o > 0.99 && first.top >= A.H * 0.09 - 0.01 && fillOk && reach)) inBad.push({ k: G.k, first, H: A.H, fillOk, reach });
    // chỉ các dòng thấy được lúc nghỉ có hoạt ảnh vào; dòng vào lúc cuộn (dưới đáy lúc nghỉ): không
    const restTop = (x) => x.top; // (sau VÀO danh sách ở chỗ nghỉ)
    const wrongIn = mine.filter((x) => (x.anim > 0) !== (restTop(x) < A.H - 0.01));
    if (wrongIn.length || inSet.length !== G.nIn) scrollBad.push({ k: G.k, nIn: G.nIn, anim: inSet.length, wrong: wrongIn.slice(0, 2) });
    // quãng trống khi đổi: còn dòng ngay trước e, trống tại e (+0,01) và giữa lúc mờ chéo, dòng đầu giáp kế đã hiện lúc nx + 0,06
    const nk = (G.k + 1) % plan.m;
    const nxRow = p.nextIn.rows.find((x) => x.g === nk && x.i === 0);
    const okGap = p.gapS <= 0.35 && p.beforeEnd.vis.length > 0 && p.atEnd.vis.length === 0 && p.midXf.vis.length === 0 && nxRow && nxRow.o > 0.02 && nxRow.top < p.nextIn.H;
    if (!okGap) gapBad.push({ k: G.k, gapS: p.gapS, before: p.beforeEnd.vis.length, at: p.atEnd.vis.length, mid: p.midXf.vis.length, nx: nxRow });
  }
  report.check(`${id}: ngay sau pha VÀO dòng đầu đục hẳn, dưới hẳn dải mờ trên; mọi dòng thấy được đã hiện (vùng lấp kín) — ${per.map((p) => `giáp ${p.G.k}: ${p.G.nIn} dòng vào trong ${fmt(p.G.inEnd - p.G.s)} s, đứng ${fmt(p.G.c - p.G.inEnd)} s, cuộn ${fmt(p.G.e - p.G.c)} s`).join(' · ')}`, inBad.length === 0, inBad.slice(0, 2));
  report.check(`${id}: chỉ các dòng thấy được lúc nghỉ có hoạt ảnh vào (dòng vào từ đáy lúc cuộn: không)`, scrollBad.length === 0, scrollBad.slice(0, 2));
  report.check(`${id}: ${single ? 'lặp vòng' : `${plan.m} lần đổi giáp`} — quãng trống (dòng cuối ra hết → dòng đầu ${single ? 'lượt sau' : 'giáp kế'} hiện) ${[...new Set(per.map((p) => p.gapS))].join(' / ')} s ≤ 0,35; vùng trống suốt lúc ${single ? 'trống' : 'mờ chéo tên giáp'}`, gapBad.length === 0, gapBad.slice(0, 2));
  const shortG = plan.groups.filter((G) => G.fits);
  if (shortG.length) report.check(`${id}: giáp ngắn (${shortG.map((G) => `giáp ${G.k}: ${G.n} tên`).join(', ')}) — VÀO → đứng ${shortG.map((G) => fmt(G.c - G.inEnd)).join(' / ')} s (1,5 s mỗi tên, 4–10 s) → cuộn ra`, shortG.every((G) => Math.abs(G.c - G.inEnd - Math.min(10, Math.max(4, 1.5 * G.n))) < 0.01 && G.e > G.c), shortG);
  if (single) report.check(`${id}: một giáp, tên giáp trùng nhãn khung khắc → không ô tên giáp (${rows[0].ghN}); lặp vòng: chu kỳ ${plan.T} s = vào + đứng + cuộn + ${fmt(plan.T - plan.groups[0].e)} s trống, không lần đổi nào`, plan.m === 1 && plan.switches.length === 0 && rows.every((r) => r.ghN === 0) && plan.T - plan.groups[0].e <= 0.35, plan.groups);
  report.check(`${id}: khung khắc quanh khối đỗ đầu (${rows[0].frame}), khối đầu đứng yên, mọi phần trong ô chữ`, all.every((r) => r.frame === 'solid' && same(r.head, rows[0].head) && r.ok), all.filter((r) => !r.ok).slice(0, 2).map((r) => r.t));
}
{
  const v = Object.values(gaps).filter((x) => x != null);
  report.info('khoảng cách ô tên giáp ↔ khung khắc (dòng tên)', gaps);
  report.check(`khoảng cách ô tên giáp ↔ khung khắc như nhau mọi bia nhiều giáp: ${v.join(' / ')} dòng tên (chênh ≤ 0,1)`, v.length >= 4 && Math.max(...v) - Math.min(...v) <= 0.1, gaps);
}
report.check(`giảm chuyển động: danh sách đứng yên — hoạt ảnh chỉ đổi độ đục (${R.rm.props.join(', ') || 'không'}; ${R.rm.anims} hoạt ảnh), đổi giáp mỗi ${R.rm.plan ? (R.rm.plan.T / R.rm.plan.m).toFixed(1) : '—'} s; đang hiện giáp ${R.rm.lab} (danh sách đầu độ đục ${R.rm.g0})`, R.rm.props.every((p) => p === 'opacity') && R.rm.plan?.reduce && R.rm.lab === 0 && R.rm.g0 > 0.99, R.rm);
await close();
process.exit(report.finish(errors));
