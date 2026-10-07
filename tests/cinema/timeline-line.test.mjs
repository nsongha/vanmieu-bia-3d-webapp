// r43 — dòng thời gian "Sợi chỉ" (settings.cinemaTimeline = 'line') đưa lại cạnh "Thước khắc":
//   A. đổi kiểu qua cài đặt (bảng Cài đặt → Hiển thị → Dòng thời gian, và settings.set) · vùng dính của tay còn nguyên
//   B. chuột: rê → thẻ (năm, ảnh) trong khung nhìn · kính lúp chỉ giữ vạch tiêu điểm phóng · bấm → tới bia đó
//   C. vạch chạy của tự chuyển (setProgress) · chặn hover khi tay đang xoa (body[data-hand-busy])
//   D. tay dính (hand:sticky 'timeline'): phóng ~1,3×, tiêu điểm theo d.focus, thẻ + dòng gợi ý, nhón = chọn
//   E. ẩn khi xoa đầu rùa (không thẻ khi rê)
//   F. đổi Thước khắc ↔ Sợi chỉ nhiều lần lúc chạy: không còn DOM / thuộc tính / vòng rAF cũ, hover vẫn chạy
//   G. điện thoại (390 × 844): luôn Sợi chỉ thu gọn (kể cả khi chọn Thước khắc), nằm gọn trong khung; kiểu đã lưu ngoài danh
//      sách (Dải lụa) về mặc định; đổi cỡ khung desktop ↔ điện thoại đổi kiểu theo
// node tests/cinema/timeline-line.test.mjs --port 5180   (≈ 1,5 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('timeline-line');
const allErrors = [];

// ---------------------------------------------------------------- desktop, đã lưu 'line'
{
  const { page, ctx, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, cinemaTimeline: 'line' } });
  await ctx.addInitScript(() => {
    const raw = window.requestAnimationFrame.bind(window);
    window.__rafN = 0;
    window.requestAnimationFrame = (cb) => {
      window.__rafN++;
      return raw(cb);
    };
  });
  await openCinema(page, port, { hooks: ['cinemaTimeline', 'cinemaIdle', 'cinemaSticky', 'cinemaRub', 'settings'], settleMs: 3000 });
  const E = (fn, a) => page.evaluate(fn, a);
  await page.mouse.move(150, 450);
  const tl = () =>
    E(() => {
      const el = document.querySelector('.cin-tl');
      const pop = el.querySelector('.cin-tl__pop');
      return {
        kind: el.dataset.kind, // 'line' | 'concept' (kiểu đang dựng thật)
        style: el.dataset.style,
        hostTl: document.querySelector('.cinema').dataset.tl,
        pop: el.dataset.pop ?? null,
        popYear: pop?.querySelector('.cin-tl__year')?.textContent ?? null,
        popOp: pop ? +getComputedStyle(pop).opacity : null,
        tracks: el.querySelectorAll('.cin-tl__track').length,
        ticks: el.querySelectorAll('.cin-tl__tick').length,
        line: !!el.querySelector('.cin-tl__line'),
        bar: !!el.querySelector('.cin-tl__bar'),
        attrs: Object.keys(el.dataset).sort().join(','),
        sticky: el.classList.contains('is-sticky'),
      };
    });
  const tickPt = (i) => E((i) => { const r = window.__vm.cinemaTimeline.tickRect(i); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const yearOf = (i) => E((i) => document.querySelectorAll('.cin-tl__tick')[i].getAttribute('aria-label').match(/(\d{4})(?:, dựng|$)/)?.[1] ?? null, i);

  // ---- A
  report.section('A. đổi kiểu');
  const a0 = await tl();
  report.check('đã lưu "line" → dựng Sợi chỉ (không bị migrate về mặc định)', a0.kind === 'line' && a0.style === 'line' && a0.hostTl === 'line' && a0.line && !a0.bar, a0);
  report.check('82 vạch, một thước', a0.ticks === 82 && a0.tracks === 1, a0);
  const zone = await E(() => { const d = document.querySelector('.cin-tl').dataset; return { s: d.handSticky, reach: d.handStickyReachY, exit: d.handStickyExitReachY, items: d.handStickyItems }; });
  report.check('vùng dính của tay còn nguyên (15 % dưới, mục .cin-tl__tick)', zone.s === 'timeline' && zone.reach === '15vh' && zone.exit === '40vh' && zone.items === '.cin-tl__tick', zone);
  // bảng cài đặt: mục "Dòng thời gian" có 2 lựa chọn, đang chọn Sợi chỉ; bấm Thước khắc → đổi ngay; bấm lại Sợi chỉ
  await page.mouse.move(1300, 60, { steps: 5 });
  await sleep(300);
  await page.click('.cin-gear');
  await sleep(400);
  await page.getByRole('tab', { name: 'Hiển thị' }).click();
  await sleep(300);
  const sec = await E(() => {
    const h = [...document.querySelectorAll('.sp-h')].find((x) => x.textContent === 'Dòng thời gian');
    const opts = h ? [...h.parentElement.querySelectorAll('[role="radio"]')] : [];
    return { found: !!h, labels: opts.map((o) => o.textContent.trim().split('\n')[0].slice(0, 12)), checked: opts.find((o) => o.getAttribute('aria-checked') === 'true')?.textContent.trim().slice(0, 12) ?? null };
  });
  report.check('Cài đặt → Hiển thị → "Dòng thời gian": Thước khắc + Sợi chỉ, đang chọn Sợi chỉ', sec.found && sec.labels.length === 2 && /Thước khắc/.test(sec.labels.join()) && /Sợi chỉ/.test(sec.labels.join()) && /Sợi chỉ/.test(sec.checked ?? ''), sec);
  const clickOpt = (label) => E((label) => { const h = [...document.querySelectorAll('.sp-h')].find((x) => x.textContent === 'Dòng thời gian'); [...h.parentElement.querySelectorAll('[role="radio"]')].find((o) => o.textContent.includes(label)).click(); }, label);
  await clickOpt('Thước khắc');
  await sleep(300);
  const a1 = await tl();
  report.check('bấm "Thước khắc" → dựng Thước khắc ngay', a1.kind === 'concept' && a1.style === 'ruler' && a1.hostTl === 'concept' && a1.bar && !a1.line && a1.ticks === 82 && a1.tracks === 1, a1);
  await clickOpt('Sợi chỉ');
  await sleep(300);
  const a2 = await tl();
  report.check('bấm "Sợi chỉ" → về Sợi chỉ, lưu vào cài đặt', a2.kind === 'line' && (await E(() => window.__vm.settings.get().cinemaTimeline)) === 'line', a2);
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.mouse.move(150, 450);
  await sleep(600);

  // ---- B
  report.section('B. chuột');
  let p = await tickPt(30);
  await page.mouse.move(p.x, p.y - 4, { steps: 6 });
  await sleep(450);
  const b0 = await tl();
  const y30 = await yearOf(30);
  const popBox = await E(() => { const r = document.querySelector('.cin-tl__pop').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, vw: innerWidth }; });
  report.check('rê vạch 30 → thẻ hiện đúng năm', b0.pop === '1' && b0.popYear === y30 && b0.popOp > 0.9, { ...b0, y30 });
  report.check('thẻ nằm trong khung nhìn', popBox.l >= 0 && popBox.r <= popBox.vw && popBox.t >= 0, popBox);
  const ks = await E(() => [...document.querySelectorAll('.cin-tl__tick')].map((t) => +(t.style.getPropertyValue('--k') || 0)));
  const hot = ks.indexOf(Math.max(...ks));
  const far = ks.filter((k, i) => Math.abs(i - hot) >= 3 && k > 0.2).length;
  report.check('kính lúp: chỉ vạch tiêu điểm phóng hết cỡ, vạch cách ≥ 3 không phóng', ks[hot] > 0.85 && far === 0 && Math.abs(hot - 30) <= 1, { hot, kHot: ks[hot], far });
  // dời sang vạch 60 rồi rời: vạch 30 thu lại
  p = await tickPt(60);
  await page.mouse.move(p.x, p.y - 4, { steps: 10 });
  await sleep(500);
  const k30 = await E(() => +(document.querySelectorAll('.cin-tl__tick')[30].style.getPropertyValue('--k') || 0));
  report.check('đi qua rồi: vạch cũ thu lại', k30 < 0.05, { k30 });
  const idx0 = await E(() => window.__vm.cinemaIdle().index);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__vm.cinemaIdle().index !== undefined, null, { timeout: 3000 });
  await sleep(2200);
  const idx1 = await E(() => window.__vm.cinemaIdle().index);
  report.check('bấm vạch 60 → tới bia 60', idx1 === 60 && idx0 !== 60, { idx0, idx1 });
  await page.mouse.move(150, 450, { steps: 6 });
  await sleep(500);
  report.check('rời thước → thẻ tắt', (await tl()).pop === '0');

  // ---- C
  report.section('C. vạch chạy + chặn hover khi đang xoa');
  await E(() => window.__vm.cinemaTimeline.setProgress(0.5));
  const run = await E(() => getComputedStyle(document.querySelector('.cin-tl__run')).transform);
  await E(() => window.__vm.cinemaTimeline.setProgress(-1));
  report.check('setProgress(0,5) → vạch chạy scaleX(0,5)', /matrix\(0\.5,/.test(run), run);
  await E(() => (document.body.dataset.handBusy = 'rub'));
  p = await tickPt(20);
  await page.mouse.move(p.x, p.y - 4, { steps: 6 });
  await sleep(400);
  const c1 = await tl();
  await E(() => delete document.body.dataset.handBusy);
  report.check('body[data-hand-busy] → rê thước không mở thẻ (hover guard)', c1.pop !== '1', c1);
  await page.mouse.move(p.x + 2, p.y - 4, { steps: 2 });
  await sleep(400);
  report.check('hết busy → rê lại mở thẻ', (await tl()).pop === '1');
  await page.mouse.move(150, 450, { steps: 6 });
  await sleep(500);

  // ---- D
  report.section('D. tay dính');
  await E(() => {
    document.body.classList.add('gesture-on');
    document.body.dataset.input = 'hand';
    window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'hand' } }));
  });
  const idxD0 = await E(() => window.__vm.cinemaIdle().index);
  const target = idxD0 === 20 ? 22 : 20;
  await E((f) => window.__vm.cinemaSticky('timeline', { rel: { x: 0.3, y: 0.5 }, focus: f }), target);
  await sleep(450);
  const d0 = await E(() => {
    const el = document.querySelector('.cin-tl');
    const hf = el.querySelector('.cin-tl__tick[data-hand-focus]');
    const hint = el.querySelector('.cin-tl__yhint');
    return { sticky: el.classList.contains('is-sticky'), scale: +getComputedStyle(el).scale || null, focus: hf ? Number(hf.dataset.i) : null, pop: el.dataset.pop, year: el.querySelector('.cin-tl__year').textContent, hint: hint ? getComputedStyle(hint).display : null, hintText: hint?.textContent ?? '' };
  });
  const yT = await yearOf(target);
  report.check('dính → thước phóng ~1,3× (kẹp trong khung)', d0.sticky && d0.scale > 1.1 && d0.scale <= 1.3001, d0);
  report.check(`tiêu điểm theo d.focus (${target}) + thẻ đúng năm + dòng gợi ý chọn bằng tay`, d0.focus === target && d0.pop === '1' && d0.year === yT && d0.hint !== 'none' && /ngón trỏ/.test(d0.hintText), { ...d0, yT });
  await E((f) => window.__vm.cinemaSticky('timeline', { rel: { x: 0.6, y: 0.5 }, focus: f }), target + 5);
  await sleep(200);
  const d1 = await E(() => Number(document.querySelector('.cin-tl__tick[data-hand-focus]')?.dataset.i));
  report.check('đổi d.focus → tiêu điểm đi theo', d1 === target + 5, d1);
  await E(() => window.__vm.cinemaStickyPinch());
  await sleep(2200);
  const idxD1 = await E(() => window.__vm.cinemaIdle().index);
  report.check('nhón → tới bia đang là tiêu điểm', idxD1 === target + 5, { idxD1 });
  await E(() => window.__vm.cinemaSticky('timeline', { active: false }));
  await sleep(400);
  const d2 = await tl();
  report.check('rời vùng dính → hết phóng, hết tiêu điểm tay, thẻ tắt', !d2.sticky && d2.pop === '0' && (await E(() => !document.querySelector('.cin-tl__tick[data-hand-focus]'))), d2);
  await E(() => {
    document.body.classList.remove('gesture-on');
    document.body.dataset.input = 'mouse';
    window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'mouse' } }));
  });
  await sleep(300);

  // ---- E
  report.section('E. ẩn khi xoa đầu rùa');
  // bia vừa nhảy tới (xa) còn đang lên LOD0 — chế độ xoa chỉ mở khi đầu rùa sẵn: thử lại tới 15 s
  await E(() => window.__vm.cinemaRub.unlock());
  await page.waitForFunction(() => window.__vm.cinemaRub.enter('mouse'), null, { timeout: 15000, polling: 250 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.cinema').dataset.rubhud === '1', null, { timeout: 6000 }).catch(() => {});
  await sleep(600);
  const e0 = await E(() => ({ hud: document.querySelector('.cinema').dataset.rubhud ?? null, op: +getComputedStyle(document.querySelector('.cin-bottom')).opacity, pe: getComputedStyle(document.querySelector('.cin-tl__track')).pointerEvents }));
  p = await tickPt(40);
  await page.mouse.move(p.x, p.y - 4, { steps: 6 });
  await sleep(400);
  const e1 = await tl();
  report.check('đang xoa: dòng thời gian mờ hẳn, không nhận chuột, rê không mở thẻ', e0.hud === '1' && e0.op < 0.05 && e0.pe === 'none' && e1.pop !== '1', { ...e0, pop: e1.pop });
  await page.mouse.move(150, 450, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__vm.cinemaRub.state().active, null, { timeout: 8000 }).catch(() => {});
  await sleep(3500);

  // ---- F
  report.section('F. đổi kiểu lúc chạy');
  const rafRate = async () => {
    await E(() => (window.__rafN = 0));
    await sleep(1500);
    return E(() => window.__rafN / 1.5);
  };
  const r0 = await rafRate();
  for (let k = 0; k < 6; k++) {
    await E((s) => window.__vm.settings.set('cinemaTimeline', s), k % 2 ? 'line' : 'ruler');
    await sleep(120);
  }
  await sleep(600);
  const f0 = await tl();
  const r1 = await rafRate();
  report.check('6 lần đổi → về Sợi chỉ: một thước, 82 vạch, không còn phần của Thước khắc', f0.kind === 'line' && f0.tracks === 1 && f0.ticks === 82 && !f0.bar && f0.line, f0);
  report.check('không còn thuộc tính của kiểu cũ trên .cin-tl (focus / batch / dyn / dlab)', !/(^|,)(focus|batch|dyn|dlab)(,|$)/.test(f0.attrs), f0.attrs);
  report.check('không thêm vòng rAF (kính lúp cũ đã dừng)', r1 <= r0 * 1.15 + 3, { r0, r1 });
  p = await tickPt(50);
  await page.mouse.move(p.x, p.y - 4, { steps: 6 });
  await sleep(450);
  const f1 = await tl();
  report.check('hover vẫn chạy sau khi đổi', f1.pop === '1' && f1.popYear === (await yearOf(50)), f1);
  await page.mouse.move(150, 450, { steps: 4 });
  await E(() => window.__vm.settings.set('cinemaTimeline', 'ruler'));
  await sleep(300);
  const f2 = await tl();
  report.check('về Thước khắc: không còn thuộc tính của Sợi chỉ (pop)', f2.kind === 'concept' && !/(^|,)pop(,|$)/.test(f2.attrs) && f2.tracks === 1, f2);
  // desktop → điện thoại → desktop (đổi cỡ khung): kiểu dựng theo cỡ màn
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(500);
  const f3 = await tl();
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(500);
  const f4 = await tl();
  report.check('thu khung về 390 px → Sợi chỉ thu gọn; mở lại → Thước khắc', f3.kind === 'line' && f4.kind === 'concept' && f4.style === 'ruler', { phone: f3.kind, back: f4.kind });
  allErrors.push(...errors);
  await close();
}

// ---------------------------------------------------------------- điện thoại, đã lưu 'silk' (kiểu đã bỏ)
{
  const { page, close, errors } = await launch({ headed, width: 390, height: 844, dpr: 2, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, cinemaTimeline: 'silk' } });
  await openCinema(page, port, { hooks: ['cinemaTimeline', 'settings'], settleMs: 2500 });
  report.section('G. điện thoại + kiểu đã bỏ');
  const g = await page.evaluate(() => {
    const el = document.querySelector('.cin-tl');
    const r = el.getBoundingClientRect();
    const minor = [...el.querySelectorAll('.cin-tl__lab.is-minor')].map((x) => getComputedStyle(x).visibility);
    return { saved: window.__vm.settings.get().cinemaTimeline, kind: el.dataset.kind, l: r.left, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, minorHidden: minor.length > 0 && minor.every((v) => v === 'hidden'), ticks: el.querySelectorAll('.cin-tl__tick').length };
  });
  report.check('đã lưu "silk" (Dải lụa, đã bỏ) → về mặc định Thước khắc', g.saved === 'ruler', g.saved);
  report.check('điện thoại → Sợi chỉ thu gọn (bất kể kiểu chọn)', g.kind === 'line' && g.ticks === 82, g);
  report.check('nằm gọn trong khung nhìn, nhãn nửa thế kỷ phụ ẩn', g.l >= 0 && g.r <= g.vw + 0.5 && g.b <= g.vh && g.minorHidden, g);
  allErrors.push(...errors);
  await close();
}
process.exit(report.finish(allErrors));
