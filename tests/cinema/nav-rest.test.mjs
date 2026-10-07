// r73 — KHÔNG "NỬA FOCUS" LÚC ĐỔI BIA (thay vswipe-rest.test.mjs: r48 kiểm bằng cú vẩy hai ngón — r72 bỏ đổi bia bằng chữ V ở
// Điện ảnh; ý gốc của người dùng r48: "khi dùng 2 ngón lướt, luôn ở trạng thái rest để lướt cho nhanh"). Đổi bia nay bằng mũi
// tên / phím / dòng thời gian / nắm tay kéo (nắm tay: fist-grab.test.mjs B–D, K). Qua lớp cử chỉ THẬT (__vmHand.simulateHand
// live, tests/lib/rub-sim.mjs installHand); ghi mỗi khung: orbitF (0 rest … 1 chính diện + zoom), sel (đèn + thông tin), tiến
// độ lướt.
//   a. ĐANG NGHỈ (tay ngoài bia) → phím → ; trong lúc lướt tay đi vào vùng bia (bia mới trượt tới dưới tay): suốt lượt lướt
//      không vòng camera hover (orbitF không tăng), không đèn / thông tin; lướt xong, tay nằm yên trên bia → focus đầy đủ
//   b. tay đang focus trên bia + phím → : camera giữ chính diện liền mạch suốt lượt lướt, focus lại sau lướt
//   c. chuột đang focus + phím → : như b (như trước r48)
// node tests/cinema/nav-rest.test.mjs --port 5180   (≈ 1,5 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';
import { installHand, removeHand } from '../lib/rub-sim.mjs';

const { port, headed } = parseArgs();
const report = createReport('nav-rest');
// lướt dài (2,4 s) — đoạn cuối lượt lướt đủ dài để thấy vòng camera nếu nó bắt đầu
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, glideDuration: 2.4 } });
await openCinema(page, port, { hooks: ['cinemaCam', 'cinemaInfo', 'cinemaStelePoint', 'cinemaTxProgress', 'cinemaPresence', '__vmHand.simulateHand'], settleMs: 2500 });
const E = (f, a) => page.evaluate(f, a);
await E(() => {
  const T = (window.__T = { trace: null, t0: 0 });
  const rec = () => {
    if (T.trace) {
      const c = window.__vm.cinemaCam();
      T.trace.push({ t: Math.round(performance.now() - T.t0), f: c.orbitF, sel: c.sel ? 1 : 0, tx: +window.__vm.cinemaTxProgress().toFixed(3), info: window.__vm.cinemaInfo.state().shown ? 1 : 0 });
    }
    requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
  T.start = () => Object.assign(T, { t0: performance.now(), trace: [] });
  T.stop = () => {
    const t = T.trace;
    T.trace = null;
    return t;
  };
});
const cam = () => E(() => { const c = window.__vm.cinemaCam(); return { f: c.orbitF, sel: c.sel }; });
const R = {};

// ---- a. nghỉ → phím → , tay đi vào vùng bia trong lúc lướt
report.section('a. đang nghỉ → phím →, tay vào vùng bia lúc lướt');
await page.mouse.move(20, 880);
await installHand(page, { pose: 'open', hx: 0.15, hy: 0.62 }); // tay xoè ở nền trống bên trái (không trên bia)
await sleep(2600);
R.preA = await cam();
const sp = await E(() => window.__vm.cinemaStelePoint()); // tâm bia ở khung nghỉ — bia mới đáp đúng chỗ này
await E(() => window.__T.start());
await page.keyboard.press('ArrowRight');
await sleep(300);
await E((p) => { window.__A.tgt = p; }, sp); // tay trượt về tâm bia trong lúc bia mới đang tới
await sleep(2400 + 2600);
const trA = await E(() => window.__T.stop());
const txA = trA.filter((x) => x.tx >= 0);
const riseA = txA.length ? Math.max(...txA.map((x) => x.f)) - txA[0].f : 1;
const selA = txA.some((x) => x.sel || x.info);
const endA = trA.at(-1);
report.check('trước: đang nghỉ (không đèn, camera ở khung nghỉ)', !R.preA.sel && R.preA.f < 0.01, R.preA);
report.check('suốt lượt lướt: không vòng camera hover (orbitF không tăng > 0,01), không đèn / thông tin', txA.length > 30 && riseA <= 0.01 && !selA, { riseA: +riseA.toFixed(3), selA, frames: txA.length });
report.check('lướt xong, tay nằm yên trên bia → focus đầy đủ (đèn + thông tin + chính diện)', endA.sel === 1 && endA.info === 1 && endA.f > 0.95, endA);

// ---- b. tay đang focus + phím →
report.section('b. tay đang focus trên bia + phím →');
R.preB = await cam();
await E(() => window.__T.start());
await page.keyboard.press('ArrowRight');
await sleep(2400 + 2400);
const trB = await E(() => window.__T.stop());
const txB = trB.filter((x) => x.tx >= 0);
const fMinB = Math.min(...txB.map((x) => x.f));
const endB = trB.at(-1);
report.check('tay đang focus → phím →: camera giữ chính diện suốt lượt lướt, focus lại sau lướt', R.preB.sel && R.preB.f > 0.95 && txB.length > 30 && fMinB > 0.9 && endB.sel === 1 && endB.f > 0.95, { pre: R.preB, fMinB, end: endB });
await removeHand(page);

// ---- c. chuột đang focus + phím →
report.section('c. chuột focus + phím →');
await sleep(2500);
const sp2 = await E(() => window.__vm.cinemaStelePoint());
await page.mouse.move(sp2.x - 30, sp2.y, { steps: 8 });
await page.mouse.move(sp2.x, sp2.y, { steps: 4 });
await sleep(2200);
const preC = await cam();
await E(() => window.__T.start());
await page.keyboard.press('ArrowRight');
await sleep(2400 + 2200);
const trC = await E(() => window.__T.stop());
const txC = trC.filter((x) => x.tx >= 0);
const fMinC = Math.min(...txC.map((x) => x.f));
const endC = trC.at(-1);
report.check('chuột đang focus → phím →: camera giữ chính diện suốt lượt lướt, focus lại sau lướt', preC.sel && preC.f > 0.95 && txC.length > 30 && fMinC > 0.9 && endC.sel === 1 && endC.f > 0.95, { preC, fMinC, end: endC });

await close();
process.exit(report.finish(errors));
