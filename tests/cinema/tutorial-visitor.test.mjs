// Hướng dẫn cử chỉ — khi nào tự mở + ứng dụng bên dưới (r32 → r50): lần ĐẦU dùng app trên trình duyệt (điều khiển bằng tay
// đang bật) → mở ngay, đọc trước; tải lại → không mở lại; tắt "Hiện hướng dẫn khi mở app lần đầu" → không mở; "Xem hướng
// dẫn" mở ngay; tay rời > 8 s → tự đóng; trong lúc hướng dẫn ứng dụng đứng yên; âm thanh một tiếng mỗi sự kiện. (Khách
// mới lúng túng: tutorial-coach.) Tay giả lập bằng hand:frame (~30 khung/s như lớp cử chỉ).
// node tests/cinema/tutorial-visitor.test.mjs --port 5180   (≈ 1 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('tutorial-visitor');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: true, cinemaIdleAfter: 120, tutorialFirstLoad: true, tutorialAdaptive: false, sound: true, soundVolume: 0.6 } });
await openCinema(page, port, { hooks: ['cinemaTutorial', 'sound'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const st = () => E(() => window.__vm.cinemaTutorial.state());
const center = (sel) => E((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, sel);
const sndLog = () => E(() => window.__vm.sound.log.map((l) => `${l.name}:${l.played ? 'play' : l.skipped}`).join(' '));
const sndClear = () => E(() => window.__vm.sound.clear());
await E(() => {
  let id = 0;
  window.__H = {
    on() { document.body.classList.add('gesture-on'); document.body.dataset.input = 'hand'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'hand' } })); },
    off() { clearInterval(id); window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })); document.body.dataset.input = 'mouse'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'mouse' } })); },
    pos: { x: 720, y: 450, pose: 'open' },
    run() { clearInterval(id); id = setInterval(() => { const p = window.__H.pos; window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, x: p.x, y: p.y, rawX: p.x, rawY: p.y, pose: p.pose, hover: p.pose !== 'pinch' } })); }, 33); },
    stop() { clearInterval(id); },
  };
});
const handTo = async (x, y, n = 10, pose = 'open') => { const p0 = await E(() => ({ ...window.__H.pos })); for (let k = 1; k <= n; k++) { await E(([x, y, pose]) => { window.__H.pos = { x, y, pose }; }, [p0.x + ((x - p0.x) * k) / n, p0.y + ((y - p0.y) * k) / n, pose]); await sleep(34); } };
const pose = async (p, ms = 150) => { await E((p) => { window.__H.pos = { ...window.__H.pos, pose: p }; }, p); await sleep(ms); };
const handAway = () => E(() => { window.__H.stop(); window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })); });

// ---------- B. lần đầu dùng app (trình duyệt mới): mở một lần, tải lại không mở lại
report.section('lần đầu dùng app');
await page.mouse.move(5, 5);
const firstKey = () => E(() => { try { return localStorage.getItem('vm.tutorial.firstShown'); } catch { return 'ERR'; } });
const b0 = { ...(await st()), key: await firstKey() };
report.check('chưa bật điều khiển bằng tay → chưa mở (chờ), chưa ghi khoá', b0.active === false && b0.key === null, { active: b0.active, key: b0.key });
await E(() => { window.__H.on(); window.__H.pos = { x: 300, y: 300, pose: 'open' }; window.__H.run(); });
const b1ms = await E(() => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (window.__vm.cinemaTutorial.state().active) res(Math.round(performance.now() - t0)); else if (performance.now() - t0 > 3000) res(-1); else setTimeout(tick, 20); }; tick(); }));
const b1 = { ...(await st()), key: await firstKey() };
report.check('điều khiển bằng tay bật → mở ngay (why "first"), đang đọc bước 1 ("Đưa một bàn tay vào khung" — r66), ghi khoá', b1ms >= 0 && b1ms < 400 && b1.why === 'first' && b1.line === 'frame' && b1.readLeft > 0 && b1.key === '1', { ms: b1ms, why: b1.why, line: b1.line, readLeft: b1.readLeft, key: b1.key });
await page.keyboard.press('Escape'); await sleep(700);
await E(() => window.__H.stop());
// tải lại trang (cùng trình duyệt; URL khác để chắc là tải lại thật, không chỉ đổi #): không mở lại
const inst0 = await E(() => (window.__tutInst = Math.random()));
await openCinema(page, port, { query: '?reload=1', hooks: ['cinemaTutorial', 'sound'], settleMs: 1500 });
const reloaded = (await E(() => window.__tutInst ?? null)) !== inst0;
await E(() => {
  let id = 0;
  window.__H = {
    on() { document.body.classList.add('gesture-on'); document.body.dataset.input = 'hand'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'hand' } })); },
    off() { clearInterval(id); window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })); document.body.dataset.input = 'mouse'; window.dispatchEvent(new CustomEvent('input:mode', { detail: { mode: 'mouse' } })); },
    pos: { x: 720, y: 450, pose: 'open' },
    run() { clearInterval(id); id = setInterval(() => { const p = window.__H.pos; window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, x: p.x, y: p.y, rawX: p.x, rawY: p.y, pose: p.pose, hover: p.pose !== 'pinch' } })); }, 33); },
    stop() { clearInterval(id); },
  };
});
await E(() => { window.__H.on(); window.__H.pos = { x: 300, y: 300, pose: 'open' }; window.__H.run(); });
await sleep(1500);
const b2 = await st();
report.check('tải lại trang → không mở lại', reloaded && b2.active === false, { reloaded, active: b2.active, why: b2.why });
// xoá khoá + tắt "Hiện hướng dẫn khi mở app lần đầu" → không mở
await E(() => { window.__H.stop(); localStorage.removeItem('vm.tutorial.firstShown'); window.__vm.settings.set('tutorialFirstLoad', false); window.__H.run(); });
await sleep(1200);
const b3 = await st();
report.check('tắt "Hiện hướng dẫn khi mở app lần đầu" → không mở (dù chưa có khoá)', b3.active === false);
await E(() => window.__vm.settings.set('tutorialFirstLoad', true));
await sleep(600);
const b4 = await st();
report.check('bật lại, chưa có khoá → mở', b4.active === true && b4.why === 'first', { active: b4.active, why: b4.why });
await page.keyboard.press('Escape'); await sleep(700);
// "Xem hướng dẫn" trong Cài đặt vẫn mở ngay
await page.click('.cin-gear'); await sleep(400);
await page.getByRole('tab', { name: 'Cử chỉ' }).click(); await sleep(250);
await page.getByRole('button', { name: 'Xem hướng dẫn', exact: true }).click(); await sleep(700);
const b5 = await st();
report.check('"Xem hướng dẫn" (Cài đặt) → mở ngay', b5.active === true && b5.why === 'manual', { active: b5.active, why: b5.why });
await page.keyboard.press('Escape'); await sleep(700);

// ---------- D. tay rời đi giữa chừng > 8 s → tự đóng
report.section('rời đi');
await E(() => { window.__vm.cinemaTutorial.start('manual'); window.__H.pos = { x: 700, y: 400, pose: 'open' }; window.__H.run(); });
await sleep(900);
const d0 = await st();
await handAway();
await sleep(5000);
const d5 = await st();
await sleep(3800);
const d9 = await st();
report.check('tay rời: còn mở ở 5 s, tự đóng sau 8 s', d0.active && d5.active && !d9.active, { d0: d0.active, d5: d5.active, d9: d9.active });

// ---------- E. ứng dụng bên dưới đứng yên trong lúc hướng dẫn
report.section('ứng dụng đứng yên');
await E(() => window.__vm.cinemaTutorial.start('manual'));
await sleep(600);
const i0 = await E(() => window.__vm.cinemaIdle().index);
const p = await E(() => window.__vm.cinemaStelePoint());
await E(([x, y]) => { window.__H.pos = { x, y, pose: 'open' }; window.__H.run(); }, [p.x, p.y]);
await sleep(900);
const shown = await E(() => window.__vm.cinemaIdle().shown);
await page.keyboard.press('ArrowRight'); await sleep(300);
const i1 = await E(() => window.__vm.cinemaIdle().index);
const tl = await E(() => { const r = window.__vm.cinemaTimeline.tickRect(30); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await E(([x, y]) => { window.__H.pos = { x, y, pose: 'open' }; }, [tl.x, tl.y]); await sleep(400);
const tlOn = await E(() => { const t = document.querySelector('.cin-tl'); return t.dataset.pop === '1' || t.dataset.focus === '1'; });
await E(() => window.__vm.cinemaIdle({ idleMs: 1e7 })); await sleep(700);
const playing = await E(() => window.__vm.cinemaIdle().playing);
const body = await E(() => ({ modal: document.body.dataset.modal ?? null, tut: document.body.dataset.handTutorial ?? null }));
await page.keyboard.press('Escape'); await sleep(800);
const e1 = await st();
const bodyAfter = await E(() => ({ modal: document.body.dataset.modal ?? null, tut: document.body.dataset.handTutorial ?? null }));
await E(() => window.__H.stop());
report.check('bia không hover', shown === false);
report.check('phím → không đổi bia', i1 === i0);
report.check('dòng thời gian không mở thẻ', tlOn === false);
report.check('không tự trình chiếu', playing === false);
report.check('body[data-modal=tutorial] + [data-hand-tutorial=on] khi mở', body.modal === 'tutorial' && body.tut === 'on', body);
report.check('Esc đóng, gỡ cờ', !e1.active && bodyAfter.modal === null && bodyAfter.tut === null, bodyAfter);

// ---------- F. âm thanh
report.section('âm thanh');
await E(() => { window.__H.stop(); window.__H.off(); });
await sleep(1500);
await sndClear();
await E(() => document.querySelector('.cin-stage').focus());
for (let k = 0; k < 5; k++) { await page.keyboard.press('ArrowRight'); await sleep(40); }
await sleep(2800); // r51: lượt xếp hàng chạy khi lướt đầu xong (~1,6 s)
const keys = await sndLog();
report.check('5 phím dồn → lượt đầu + MỘT lượt xếp hàng (r51): 2 tiếng gõ đổi bia, tiếng mõ dồn bị giãn (tok:gap)', /^tok:play knock:play/.test(keys) && (keys.match(/knock:play/g) || []).length === 2 && /tok:gap/.test(keys), keys);
await sndClear();
await E(() => { window.__H.on(); window.__H.pos = { x: 200, y: 200, pose: 'open' }; window.__H.run(); });
await sleep(300);
await pose('pinch', 40); await pose('open', 40); await pose('pinch', 200); await pose('open', 300);
const pinches = await sndLog();
report.check('nhón dồn dập → một tiếng (lần sau bỏ vì quá sát)', /^tok:play tok:gap$/.test(pinches), pinches);
await sndClear();
await E(() => window.__vm.settings.set('sound', false));
await E(() => window.__vm.sound.play('tok'));
const off = await sndLog();
report.check('tắt âm thanh → không phát', off === 'tok:off', off);
await E(() => window.__vm.settings.set('sound', true));
await E(() => { window.__H.stop(); window.__H.off(); window.__vm.cinemaTutorial.stop('dev'); });

await close();
process.exit(report.finish(errors));
