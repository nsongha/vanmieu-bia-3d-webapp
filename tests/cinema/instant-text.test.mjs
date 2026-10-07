// r55 — CHỮ KHẮC TRÊN BỤC Ở LẦN HIỆN TỨC THÌ (không lướt). Luật r19 của người dùng: chữ khắc trên bục luôn hiện TRƯỚC bia —
// nó cho khách biết đang ở năm nào lúc mô hình còn tải. Lượt lướt thường có ~1,6 s cho chữ dựng rồi mọc trước khi bia đáp;
// lần hiện tức thì (giảm chuyển động) thì không: trước r55 bia đích ngoài cửa sổ ±1 đáp xuống bục TRƠN ~0,6 s (dựng chữ
// ~0,35 s + đẩy GPU dải 1 MB ~0,23 s). r55: chờ chữ (làn gấp + dải GPU lớn, tối đa 0,7 s) rồi mới hiện — chữ và bia cùng khung.
// Giảm chuyển động (prefers-reduced-motion) · mỗi lần khay đổi bia: số khung từ khung bia mới hiện tới khung chữ khắc CỦA
// ĐÚNG bia đó có (phải ≤ 1):
//   a. phím → ×3 (±1 — chữ đã dựng + đẩy sẵn lúc yên) · b. bấm dòng thời gian tới bia xa (ngoài cửa sổ) ×3
//   c. Home / End · d. mở thẳng địa chỉ một bia (deep link): lúc màn mở đầu tắt, chữ đã có
// Kèm: thời gian từ lúc bấm tới lúc bia hiện (thông tin — cái giá của việc chờ chữ), khoảng cách lớn nhất giữa hai lượt vẽ.
// node tests/cinema/instant-text.test.mjs --port 5180   (≈ 1 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('instant-text');
const { page, close, errors } = await launch({ headed, width: 1440, height: 900, reducedMotion: true, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
const HOOKS = ['cinemaPedText', 'cinemaIdle', 'cinemaTxProgress'];
await openCinema(page, port, { hooks: HOOKS, settleMs: 4000 });
await page.mouse.move(700, 120);
const E = (f, a) => page.evaluate(f, a);
const installTrace = () =>
  E(() => {
    const T = (window.__T = { on: null, t0: 0, acts: [] });
    let last = performance.now();
    const rec = (ts) => {
      if (T.on) {
        const p = window.__vm.cinemaPedText();
        T.on.push({ t: Math.round(performance.now() - T.t0), gap: +(ts - last).toFixed(1), id: p.id, ok: p.ok ? 1 : 0, state: p.state, boot: document.querySelector('.cinema')?.dataset.boot === 'done' ? 1 : 0 });
      }
      last = ts;
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
    T.start = () => Object.assign(T, { on: [], t0: performance.now(), acts: [] });
    T.act = () => T.acts.push(Math.round(performance.now() - T.t0));
    T.stop = () => { const r = { tr: T.on, acts: T.acts }; T.on = null; return r; };
  });
await installTrace();
/** Mỗi lần khay đổi bia: số khung từ khung bia mới hiện tới khung chữ khắc của nó có (−1 = không có). */
const landings = (tr, acts = []) => {
  const out = [];
  for (let i = 1; i < tr.length; i++) {
    if (tr[i].id === tr[i - 1].id) continue;
    let k = -1;
    for (let j = i; j < tr.length && tr[j].id === tr[i].id; j++) if (tr[j].ok) { k = j - i; break; }
    const act = acts.filter((a) => a <= tr[i].t).at(-1);
    out.push({ id: tr[i].id, frames: k, afterActMs: act != null ? tr[i].t - act : null });
  }
  return out;
};
const gaps = (tr) => { const g = tr.slice(2).map((r) => r.gap); return { max: Math.max(0, ...g), over20: g.filter((x) => x > 20).length, frames: g.length }; };
const ok1 = (L, n) => L.length === n && L.every((l) => l.frames >= 0 && l.frames <= 1);
const act = () => E(() => window.__T.act());

// ---- a. phím →
report.section('a. giảm chuyển động · phím → ×3');
await E(() => window.__T.start());
await sleep(100);
for (let k = 0; k < 3; k++) {
  await act();
  await page.keyboard.press('ArrowRight');
  await sleep(1500);
}
{
  const { tr, acts } = await E(() => window.__T.stop());
  const L = landings(tr, acts);
  report.info('bia đáp', L);
  report.check('mỗi lần bia hiện: chữ khắc của đúng bia có ≤ 1 khung sau khung bia hiện', ok1(L, 3), L);
  report.info('lượt vẽ', gaps(tr));
}

// ---- b. dòng thời gian → bia xa
report.section('b. giảm chuyển động · bấm dòng thời gian tới bia xa ×3');
await E(() => window.__T.start());
await sleep(100);
for (const di of [23, 41, -17]) {
  const pt = await E((di) => {
    const i = (((window.__vm.cinemaIdle().index + di) % 82) + 82) % 82;
    const b = document.querySelector(`.cin-tl__tick[data-i="${i}"]`);
    const r = b?.getBoundingClientRect();
    return r ? { i, x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, di);
  if (!pt) continue;
  await page.mouse.move(pt.x, pt.y, { steps: 3 });
  await act();
  await page.mouse.click(pt.x, pt.y);
  await page.mouse.move(700, 120, { steps: 2 });
  await sleep(1800);
}
{
  const { tr, acts } = await E(() => window.__T.stop());
  const L = landings(tr, acts);
  report.info('bia đáp (afterActMs = từ lúc bấm tới lúc bia hiện)', L);
  report.check('bấm dòng thời gian (bia ngoài cửa sổ): chữ khắc có ≤ 1 khung sau khung bia hiện', ok1(L, 3), L);
  report.check('chờ chữ không quá 0,7 s + vài khung (bia vẫn hiện)', L.every((l) => l.afterActMs != null && l.afterActMs < 900), L.map((l) => l.afterActMs));
  report.info('lượt vẽ', gaps(tr));
}

// ---- c. Home / End
report.section('c. giảm chuyển động · Home / End');
await E(() => window.__T.start());
await sleep(100);
for (const k of ['Home', 'End', 'Home']) {
  await act();
  await page.keyboard.press(k);
  await sleep(1800);
}
{
  const { tr, acts } = await E(() => window.__T.stop());
  const L = landings(tr, acts);
  report.info('bia đáp', L);
  report.check('Home / End: chữ khắc có ≤ 1 khung sau khung bia hiện', ok1(L, 3), L);
}

// ---- d. deep link
report.section('d. giảm chuyển động · mở thẳng địa chỉ một bia');
await page.goto('about:blank');
await page.goto(`http://localhost:${port}/#/cinema/bia-1727`);
await page.waitForFunction(() => window.__vm?.cinemaPedText, null, { timeout: 150000 });
await installTrace();
await E(() => window.__T.start());
await page.waitForFunction(() => document.querySelector('.cinema')?.dataset.boot === 'done', null, { timeout: 150000 }).catch(() => {});
await sleep(400);
{
  const { tr } = await E(() => window.__T.stop());
  const at = tr.find((r) => r.boot);
  report.check('màn mở đầu tắt: chữ khắc của bia mở thẳng đã có', !!at && at.ok === 1 && at.id === 'bia-1727', at ?? tr.at(-1));
}

await close();
process.exit(report.finish(errors));
