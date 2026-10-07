// r46 → r62 — nút "Hướng dẫn" (thay ba nút chế độ ở hàng trên), qua đường đi THẬT của lớp cử chỉ (__vmHand.simulateHand
// live, 30 khung/s). r62 (người dùng: "bỏ nắm tay để mở guide"): KHÔNG còn nắm tay giữ 3 giây để mở hướng dẫn (guide.js đã xoá,
// bỏ settings.guideFist).
//   A. nút: không còn ba nút chế độ, "← Chọn chế độ" còn; chuột / phím / nhón (nam châm) → hướng dẫn; nhãn không nhắc nắm tay
//   B. nắm tay giữ 3,6 s ở nền sân khấu → KHÔNG mở hướng dẫn; không còn vòng đếm (quanh lòng bàn tay / quanh biểu tượng nút)
//   D. settings.gestureFist bật: có gì để đóng (thông tin đang ghim) → nắm tay là Esc; không có gì → nắm tay không mở hướng dẫn
//   F. cài đặt: bỏ "Nắm tay 3 giây để mở hướng dẫn" + "Đổi bia bằng hai ngón" (Chọn bên rồi vuốt); khoá đã lưu (guideFist,
//      handNavStyle) bị bỏ khi nạp; có "Chờ hover sau khi kéo"
//   E. chỉ có cảm ứng (hover: none, pointer: coarse) → nút ẩn
// node tests/cinema/guide.test.mjs --port 5180   (≈ 1 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('guide');
// (guideFist / handNavStyle: khoá cũ đã lưu — load() phải bỏ, xem F)
const { page, ctx, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, rubHandStart: 'palm', gestureFist: false, guideFist: true, handNavStyle: 'aim' } });
await openCinema(page, port, { query: '?handCursor=shown', hooks: ['cinemaTutorial', 'cinemaRub', 'cinemaInfo', 'settings', '__vmHand.simulateHand'], settleMs: 2500 });
const E = (fn, a) => page.evaluate(fn, a);
const tutActive = () => E(() => window.__vm.cinemaTutorial.state().active);
const stopTut = async () => {
  await E(() => window.__vm.cinemaTutorial.stop('test'));
  await sleep(700);
};

// ---- A. nút
report.section('A. nút "Hướng dẫn"');
const a0 = await E(() => {
  const g = document.querySelector('.cin-tr .cin-guide');
  return { guide: !!g, label: g?.getAttribute('aria-label') ?? null, title: g?.title ?? null, magnet: g?.hasAttribute('data-magnet') ?? false, txt: g?.textContent.trim() ?? '', modes: document.querySelectorAll('.cin-mode, .cin-modes').length, back: !!document.querySelector('.cin-back'), gearAfter: g?.nextElementSibling?.classList.contains('cin-gear') ?? false, ring: !!g?.querySelector('.cin-hold-ring') };
});
report.check('hàng trên: nút "Hướng dẫn" (nam châm, nhãn) thay ba nút chế độ; "← Chọn chế độ" còn; bánh răng bên phải', a0.guide && /Hướng dẫn/.test(a0.label ?? '') && a0.magnet && /Hướng dẫn/i.test(a0.txt) && a0.modes === 0 && a0.back && a0.gearAfter, a0);
report.check('r62: nhãn nút không nhắc nắm tay ("Hướng dẫn cử chỉ tay"), không còn vòng đếm quanh biểu tượng', a0.title === 'Hướng dẫn cử chỉ tay' && !a0.ring, { title: a0.title, ring: a0.ring });
await page.mouse.move(1300, 60, { steps: 4 });
await sleep(300);
await page.click('.cin-guide');
await sleep(500);
report.check('chuột: bấm → hướng dẫn mở', await tutActive());
await stopTut();
await E(() => document.querySelector('.cin-guide').focus());
await page.keyboard.press('Enter');
await sleep(500);
report.check('phím: Enter trên nút → hướng dẫn mở', await tutActive());
await stopTut();

// ---- bàn tay tổng hợp (đường đi thật)
await E(() => {
  document.body.classList.add('gesture-on');
  const A = (window.__A = { hx: 0.3, hy: 0.62, pose: 'open', tgt: null, tgtPalm: false, cur: null, palm: null, engaged: false, id: 0, first: true, fistEsc: false, fistSeen: 0 });
  window.addEventListener('hand:frame', (e) => {
    const d = e.detail;
    if (!d.detected) return;
    A.cur = { x: d.rawX ?? d.x, y: d.rawY ?? d.y };
    A.palm = { x: d.palmX, y: d.palmY };
    A.engaged = d.engaged === true;
    if ((Number(d.fistProgress) || 0) >= 1) A.fistSeen++; // nắm tay đã xác nhận (lớp cử chỉ)
  });
  A.id = setInterval(() => {
    if (A.tgt && A.pose === 'open') {
      const c = A.tgtPalm ? A.palm : A.cur;
      if (c && Number.isFinite(c.x)) {
        A.hx = Math.min(0.97, Math.max(0.03, A.hx + ((A.tgt.x - c.x) / innerWidth) * 0.3));
        A.hy = Math.min(0.97, Math.max(0.03, A.hy + ((A.tgt.y - c.y) / innerHeight) * 0.3));
      }
    }
    window.__vmHand.simulateHand([{ pose: A.pose, x: A.hx, y: A.hy, ms: 33 }], { live: true, fresh: A.first, fist: A.fistEsc, fistLabel: true });
    A.first = false;
  }, 33);
});
await page.waitForFunction(() => window.__A.engaged, null, { timeout: 8000 }).catch(() => {});
await sleep(600);
const setPose = (p) => E((p) => (window.__A.pose = p), p);
const target = (sel) =>
  E((sel) => {
    if (sel === 'HEAD') {
      const h = window.__vm.cinemaRub.head();
      return h ? { x: h.x, y: h.y } : null;
    }
    const r = document.querySelector(sel).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
const aim = async (sel, palm = false) => {
  await page.waitForFunction(() => window.__A.engaged, null, { timeout: 6000 }).catch(() => {});
  let t = null;
  for (let i = 0; i < 90; i++) {
    t = await target(sel);
    await E(([t, palm]) => Object.assign(window.__A, { tgt: t, tgtPalm: palm }), [t, palm]);
    await sleep(50);
    const ok = await E(([t, palm]) => { const c = palm ? window.__A.palm : window.__A.cur; return !!c && !!t && Math.hypot(c.x - t.x, c.y - t.y) < 10; }, [t, palm]);
    if (ok) break;
  }
  await sleep(350);
  const at = await E(([palm]) => ({ cur: window.__A.cur, palm: window.__A.palm, hx: window.__A.hx, hy: window.__A.hy }), [palm]);
  await E(() => (window.__A.tgt = null));
  if (process.env.DBG) console.log('aim', sel, JSON.stringify(t), JSON.stringify(at));
  return t;
};
report.section('A. nút — nhón');
// đặt cổ tay gần chỗ con trỏ tới nút (ánh xạ tay → con trỏ cố định) rồi mới tinh chỉnh — đường nhắm không đi ngang vùng
// dính của mũi tên phải (con trỏ đứng lại trong vùng → vòng nhắm trôi ra mép)
await E(() => Object.assign(window.__A, { hx: 0.8, hy: 0.55 }));
await sleep(700);
await aim('.cin-guide');
const cap = await E(() => document.querySelector('.cin-guide').hasAttribute('data-hi-captured'));
if (process.env.DBG) console.log('cap', JSON.stringify(await E(() => ({ hud: document.querySelector('.cinema').dataset.hud, hit: document.elementFromPoint(1248, 49)?.className?.baseVal ?? document.elementFromPoint(1248, 49)?.className, zonesOff: document.body.dataset.handZonesOff ?? null, sticky: document.body.dataset.handSticky ?? null, captured: [...document.querySelectorAll('[data-hi-captured]')].map((e) => e.className).join('|') }))));
await setPose('pinch');
await sleep(170);
await setPose('open');
await sleep(600);
report.check('nhón chạm–thả trên nút (nam châm bắt) → hướng dẫn mở', cap && (await tutActive()), { captured: cap });
await stopTut();
// tay về nền sân khấu bên trái (không trên bia / đầu rùa / thước)
await E(() => Object.assign(window.__A, { hx: 0.18, hy: 0.5 }));
await sleep(800);

// ---- B. (r62) nắm tay giữ 3,6 s → không mở hướng dẫn
report.section('B. nắm tay giữ không mở hướng dẫn (r62)');
/** nắm tay `ms` rồi mở; trả { fistSeen (số khung nắm tay đã xác nhận), tut, ring (có vòng đếm nào hiện) }. */
const fistFor = async (ms) => {
  await E(() => (window.__A.fistSeen = 0));
  await setPose('fist');
  await sleep(ms);
  const r = await E(() => ({ fistSeen: window.__A.fistSeen, ring: document.querySelectorAll('.cin-guidehold, .cin-hold-ring').length, hookGone: !window.__vm.cinemaGuide }));
  await setPose('open');
  await sleep(500);
  return { ...r, tut: await tutActive() };
};
const b1 = await fistFor(3600);
report.check('nắm tay (đã xác nhận) giữ 3,6 s ở nền → không mở hướng dẫn, không có vòng đếm', b1.fistSeen > 60 && !b1.tut && b1.ring === 0 && b1.hookGone, b1);

// ---- D. settings.gestureFist (nắm tay = Esc)
report.section('D. nắm tay = Esc bật');
// (r58g) "Nắm tay kéo bia" bật + thông tin đang ghim (= bia focus) → xoè rồi nắm là CẦM bia, không Esc — mục này kiểm Esc nên tắt
// nắm tay kéo bia (tests/gesture/fistgrab.mjs F9 kiểm phần "đang cầm thì không Esc")
await E(() => { window.__vm.settings.set('gestureFist', true); window.__vm.settings.set('fistGrab', false); window.__A.fistEsc = true; });
await page.keyboard.press('i'); // ghim thông tin (bàn phím)
await sleep(700);
const pin0 = await E(() => window.__vm.cinemaInfo.state().pinned);
const d1 = await fistFor(1200);
const pin1 = await E(() => window.__vm.cinemaInfo.state().pinned);
report.check('có thông tin đang ghim → nắm tay là Esc (bỏ ghim), không mở hướng dẫn', pin0 && !pin1 && !d1.tut, { pin0, pin1, ...d1 });
await sleep(500);
const d2 = await fistFor(3600);
report.check('r62: không có gì để đóng → nắm tay giữ 3,6 s không mở hướng dẫn', d2.fistSeen > 60 && !d2.tut, d2);
await E(() => { window.__vm.settings.set('gestureFist', false); window.__vm.settings.set('fistGrab', true); window.__A.fistEsc = false; });

// ---- F. (r62) cài đặt
report.section('F. cài đặt (r62)');
const f0 = await E(() => { const s = window.__vm.settings.get(); return { guideFist: 'guideFist' in s, handNavStyle: 'handNavStyle' in s, delay: s.grabHoverDelay }; });
report.check('khoá đã lưu guideFist / handNavStyle bị bỏ khi nạp; grabHoverDelay mặc định 2', !f0.guideFist && !f0.handNavStyle && f0.delay === 2, f0);
await page.mouse.move(1300, 60, { steps: 3 });
await page.click('.cin-gear');
await sleep(500);
await page.getByRole('tab', { name: 'Cử chỉ' }).click();
await sleep(300);
const f1 = await E(() => {
  const txt = document.querySelector('.cin-setwrap').textContent;
  return { fist3: /Nắm tay 3 giây/.test(txt), navStyle: /Chọn bên rồi vuốt/.test(txt) || [...document.querySelectorAll('.cin-setwrap .sp-name')].some((e) => e.textContent.trim() === 'Đổi bia bằng hai ngón'), delay: [...document.querySelectorAll('.cin-setwrap .sp-name')].some((e) => /Chờ hover sau khi kéo/.test(e.textContent)), delayVal: [...document.querySelectorAll('.cin-setwrap .sp-row')].find((r) => /Chờ hover sau khi kéo/.test(r.textContent))?.querySelector('.sp-val')?.textContent ?? null };
});
await page.keyboard.press('Escape');
await sleep(300);
report.check('Cài đặt → Cử chỉ: không còn "Nắm tay 3 giây…" / "Đổi bia bằng hai ngón" (Chọn bên rồi vuốt); có "Chờ hover sau khi kéo" (2 s)', !f1.fist3 && !f1.navStyle && f1.delay && f1.delayVal === '2 s', f1);
await E(() => clearInterval(window.__A.id));

await close();

// ---- E. chỉ có cảm ứng (điện thoại / máy tính bảng): hướng dẫn là cử chỉ tay — không có ở đó → nút ẩn
{
  const m = await launch({ headed, width: 390, height: 844, dpr: 2, mobile: true, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
  await openCinema(m.page, port, { hooks: ['cinemaTimeline'], settleMs: 1500 });
  report.section('E. chỉ có cảm ứng');
  const e1 = await m.page.evaluate(() => ({ mq: matchMedia('(hover: none) and (pointer: coarse)').matches, disp: getComputedStyle(document.querySelector('.cin-guide')).display, back: getComputedStyle(document.querySelector('.cin-back')).display, modes: document.querySelectorAll('.cin-mode').length }));
  report.check('(hover: none) + (pointer: coarse) → nút ẩn, "← Chọn chế độ" còn', e1.mq && e1.disp === 'none' && e1.back !== 'none' && e1.modes === 0, e1);
  errors.push(...m.errors);
  await m.close();
}
process.exit(report.finish(errors));
