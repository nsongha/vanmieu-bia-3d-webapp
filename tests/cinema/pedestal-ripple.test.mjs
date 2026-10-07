// r63 — MẶT BỤC GỢN NHẸ (người dùng: "bề mặt bục đang phẳng tuyệt đối. tôi muốn nhăn nhẹ mà không ảnh hưởng tới performance,
// render. cho các điều chỉnh vào settings."): bản đồ pháp tuyến lát kín dựng một lần (ripple.js) → lệch toạ độ đọc ảnh phản chiếu
// của gương lòng bục + nghiêng pháp tuyến vật liệu lòng bục; không thêm lượt vẽ.
//   A. mặc định: Độ nhăn 0,3 · Kích thước gợn 0,5 · Chuyển động nhẹ tắt; gương + vật liệu lòng bục của CẢ HAI bục đã nhận; bản đồ
//      có mipmap, lát kín
//   B. áp tức thì (không tải lại): độ nhăn / kích thước đổi → uniform đổi ngay; điểm ảnh lòng bục (WebGL, đọc sau một khung vẽ):
//      0 → 0,3 đổi rõ ở lòng bục; về 0 → TRÙNG KHÍT ảnh phẳng ban đầu (0 = như trước r63); hai lần đọc cùng trạng thái trùng nhau
//   C. vẽ theo yêu cầu còn nguyên: rảnh 3 s (kể cả khi bật Chuyển động nhẹ) → 0 khung vẽ, vân đứng yên; đang vẽ (lướt) → vân trôi
//   D. Cài đặt → Hiển thị → Mặt bục phản chiếu: mục "Mặt bục" (Độ nhăn · Kích thước gợn · Chuyển động nhẹ); kéo "Độ nhăn" về 0 →
//      hai mục phụ tắt (mờ)
// node tests/cinema/pedestal-ripple.test.mjs --port 5180   (≈ 40 s)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('pedestal-ripple');
const { page, close, errors } = await launch({ headed, width: 1440, height: 900, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false } });
await openCinema(page, port, { hooks: ['cinemaRipple', 'cinemaDishPixels', 'cinemaRenderStats', 'cinemaStep', 'cinemaTxProgress', 'settings'], settleMs: 3500 });
const E = (f, a) => page.evaluate(f, a);
const rip = () => E(() => window.__vm.cinemaRipple());
const set = (k, v) => E(([k, v]) => window.__vm.settings.set(k, v), [k, v]);
const idleTx = () => page.waitForFunction(() => window.__vm.cinemaTxProgress() < 0, null, { timeout: 8000, polling: 50 }).catch(() => {});

// ---- A
report.section('A. mặc định');
{
  const s = await E(() => { const s = window.__vm.settings.get(); return { k: s.pedestalRipple, size: s.pedestalRippleSize, drift: s.pedestalRippleDrift }; });
  const r = await rip();
  report.check('cài đặt mặc định: Độ nhăn 0,3 · Kích thước gợn 0,5 · Chuyển động nhẹ tắt', s.k === 0.3 && s.size === 0.5 && s.drift === false, s);
  report.check('gương + vật liệu lòng bục của cả hai bục đã nhận (độ nhăn 0,3, cùng bản đồ vân, cùng cỡ ô)', r.k === 0.3 && r.mirrors.every((m) => m.ripple && m.tex && m.px > 0) && r.dish.every((d) => d.k === 0.3 && d.tex && Math.abs(d.inv - 1 / r.sizeM) < 1e-3), r);
  report.check('bản đồ vân: 256², lát kín (repeat), có mipmap (xa / sượt không lấp lánh)', r.tex && r.tex.size === 256 && r.tex.repeat && r.tex.mipmaps, r.tex);
}

// ---- B
report.section('B. áp tức thì · 0 = phẳng như cũ');
{
  await set('pedestalRipple', 0.7);
  const r1 = await rip();
  await set('pedestalRippleSize', 1);
  const r2 = await rip();
  report.check('Độ nhăn 0,7 → gương (lệch 0,7 × 16 px) + vật liệu đổi ngay (không tải lại)', r1.k === 0.7 && r1.dish.every((d) => d.k === 0.7) && r1.mirrors.every((m) => Math.abs(m.px - 0.7 * 16) < 1e-3), { k: r1.k, px: r1.mirrors.map((m) => m.px) });
  report.check('Kích thước gợn 1 → ô vân 1 m (gương: số ô trên bán kính đĩa + vật liệu: 1 / cạnh ô)', Math.abs(r2.sizeM - 1) < 1e-3 && r2.dish.every((d) => Math.abs(d.inv - 1) < 1e-3) && r2.mirrors.every((m) => m.scale < r1.mirrors[0].scale), { sizeM: r2.sizeM, scale: r2.mirrors.map((m) => m.scale) });
  await set('pedestalRippleSize', 0.5);
  await set('pedestalRipple', 0);
  await sleep(300);
  const a = await E(() => window.__vm.cinemaDishPixels({ key: 'flat' }));
  const a2 = await E(() => window.__vm.cinemaDishPixels({ diff: 'flat' }));
  await set('pedestalRipple', 0.3);
  await sleep(200);
  const b = await E(() => window.__vm.cinemaDishPixels({ diff: 'flat' }));
  await set('pedestalRipple', 0);
  await sleep(200);
  const c = await E(() => window.__vm.cinemaDishPixels({ diff: 'flat' }));
  await set('pedestalRipple', 0.3);
  report.info('vùng lòng bục (điểm ảnh)', { x: a.x, y: a.y, w: a.w, h: a.h });
  report.check('hai lần đọc cùng trạng thái (0) trùng khít', a.w > 200 && a.h > 40 && a2.max === 0, a2);
  report.check('0 → 0,3: lòng bục đổi thấy được (≥ 1 % điểm ảnh lệch > 2)', b.over2 >= 0.01 * b.n, { max: b.max, over2: b.over2, over8: b.over8, n: b.n });
  report.check('0,3 → 0: TRÙNG KHÍT ảnh phẳng ban đầu (0 = như trước r63)', c.max === 0, c);
}

// ---- C
report.section('C. vẽ theo yêu cầu');
{
  await set('pedestalRippleDrift', true);
  await sleep(2500);
  const off0 = (await rip()).off;
  await E(() => window.__vm.cinemaRenderStats(true));
  await sleep(3000);
  const st = await E(() => window.__vm.cinemaRenderStats());
  const off1 = (await rip()).off;
  report.check('rảnh 3 s, Chuyển động nhẹ BẬT → 0 khung vẽ (không tự xin vẽ), vân đứng yên', st.rendered === 0 && off1[0] === off0[0] && off1[1] === off0[1], { rendered: st.rendered, why: st.why, off0, off1 });
  await E(() => window.__vm.cinemaStep(1));
  await sleep(400);
  await idleTx();
  const off2 = (await rip()).off;
  report.check('đang vẽ (lướt) → vân trôi (rất chậm)', off2[0] > off1[0] && off2[0] - off1[0] < 0.05, { off1, off2 });
  await set('pedestalRippleDrift', false);
  await sleep(1500); // (lướt vừa xong: lượt đo độ sáng ô tên ~0,35 s sau khi hạ — vẽ thêm 1–2 khung, không liên quan)
  await E(() => window.__vm.cinemaRenderStats(true));
  await sleep(2000);
  const st2 = await E(() => window.__vm.cinemaRenderStats());
  report.check('tắt Chuyển động nhẹ, rảnh → vẫn 0 khung vẽ', st2.rendered === 0, st2);
}

// ---- D
report.section('D. cài đặt');
{
  await page.mouse.move(1300, 60, { steps: 3 });
  await page.click('.cin-gear');
  await sleep(500);
  await page.getByRole('tab', { name: 'Hiển thị' }).click();
  await sleep(300);
  const ui = () => E(() => {
    const rows = [...document.querySelectorAll('.cin-setwrap .sp-row')];
    const val = (label) => rows.find((r) => r.querySelector('.sp-name')?.textContent.trim() === label)?.querySelector('.sp-val')?.textContent ?? null;
    // khối phụ thuộc (dependent): tắt = mờ + inert (kiểu chung của bảng cài đặt), không ẩn
    const off = (label) => { const r = rows.find((r) => r.querySelector('.sp-name')?.textContent.trim() === label); return !!r?.closest('.sp-dep')?.classList.contains('is-off'); };
    const tg = [...document.querySelectorAll('.cin-setwrap *')].find((e) => e.textContent.trim() === 'Chuyển động nhẹ' && e.children.length === 0);
    return { head: [...document.querySelectorAll('.cin-setwrap .sp-sub .sp-name')].some((e) => e.textContent.trim() === 'Mặt bục'), k: val('Độ nhăn'), size: val('Kích thước gợn'), sizeOff: off('Kích thước gợn'), drift: !!tg, driftOff: !!tg?.closest('.sp-dep')?.classList.contains('is-off') };
  });
  const u1 = await ui();
  await set('pedestalRipple', 0);
  await sleep(200);
  const u0 = await ui();
  await set('pedestalRipple', 0.3);
  await page.keyboard.press('Escape');
  report.check('Hiển thị → Mặt bục phản chiếu: mục "Mặt bục" — Độ nhăn 30%, Kích thước gợn ~11 cm, Chuyển động nhẹ', u1.head && u1.k === '30%' && u1.size === '~11 cm' && !u1.sizeOff && u1.drift && !u1.driftOff, u1);
  report.check('Độ nhăn 0 → "Phẳng", Kích thước gợn / Chuyển động nhẹ tắt (mờ)', u0.k === 'Phẳng' && u0.sizeOff && u0.driftOff, u0);
}

await close();
process.exit(report.finish(errors));
