// r47 — "ô chữ nhật đen loé vài khung khi nhón": canvas WebGL bị XOÁ (đổi DPR lúc bắt đầu kéo / ~220 ms sau khi thả — setSize
// xoá bộ đệm vẽ) mà khung rAF kế tiếp bị trần FPS bỏ qua → trình chiếu canvas trống. Quay màn hình (CDP screencast, mọi khung
// đã ghép) quanh các cú nhón–chạm / nhón–kéo của con trỏ tổng hợp id 9001 (đường của lớp cử chỉ) và vài lần đổi cỡ khung
// (ResizeObserver — kiểm lỏng) ở DPR 2, trần 30 trên màn 60 Hz (khung rAF bị bỏ xen kẽ — như trần 60 trên màn 120 Hz của máy thật):
// không khung nào có vùng tối bất thường so với các khung quanh nó.
// node tests/cinema/pinch-flash.test.mjs --port 5180   (≈ 1 phút)
import sharp from 'sharp';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('pinch-flash');
const { page, ctx, close, errors } = await launch({ headed, width: 1280, height: 800, dpr: 2, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, maxFps: 30 } });
await openCinema(page, port, { hooks: ['cinemaTick'], settleMs: 5000 });
await page.mouse.move(30, 780);
await sleep(800);
const cdp = await ctx.newCDPSession(page);
let frames = [];
cdp.on('Page.screencastFrame', (f) => {
  frames.push(f.data);
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const record = async (fn) => {
  frames = [];
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 640, maxHeight: 400, everyNthFrame: 1 });
  await sleep(500);
  await fn();
  await sleep(500);
  await cdp.send('Page.stopScreencast');
  await sleep(200);
  return frames.slice();
};
/**
 * Khung tối bất thường: một trong 48 ô (8 × 6) tối hơn trung bình của 3 khung trước + 3 khung sau > 25 mức xám. Khung có
 * cỡ khác cả hai khung kề (khung quá độ lúc đổi cỡ, screencast cắt dở) không xét — hình dời chỗ, không phải canvas trống.
 */
async function darkFrames(list) {
  const cells = [];
  const sizes = [];
  for (const f of list) {
    const img = sharp(Buffer.from(f, 'base64'));
    const md = await img.metadata();
    sizes.push(`${md.width}x${md.height}`);
    const { data, info } = await img.resize(320, 200, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const c = new Float64Array(48);
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) c[Math.min(5, Math.floor((y / info.height) * 6)) * 8 + Math.min(7, Math.floor((x / info.width) * 8))] += data[y * info.width + x];
    cells.push([...c].map((v) => v / ((info.width / 8) * (info.height / 6))));
  }
  const out = [];
  for (let i = 3; i < cells.length - 3; i++) {
    if (sizes[i] !== sizes[i - 1] && sizes[i] !== sizes[i + 1]) continue;
    const nb = [...cells.slice(i - 3, i), ...cells.slice(i + 1, i + 4)];
    for (let k = 0; k < 48; k++) {
      const d = nb.reduce((a, c) => a + c[k], 0) / nb.length - cells[i][k];
      if (d > 25) {
        out.push({ frame: i, cell: k, d: Math.round(d) });
        break;
      }
    }
  }
  return out;
}
const synth = (type, x, y, buttons) =>
  page.evaluate(([type, x, y, buttons]) => {
    const c = document.querySelector('.cin-stage canvas');
    c.dispatchEvent(new PointerEvent(type, { pointerId: 9001, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, button: type === 'pointermove' ? -1 : 0, buttons, bubbles: true, cancelable: true, composed: true }));
    if (type === 'pointerup') window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9001, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true }));
  }, [type, x, y, buttons]);
const dprNow = () => page.evaluate(() => [...window.__vm.renderers].pop().renderer.getPixelRatio());

report.section('nhón–chạm');
let dprDuring = null;
const tapFrames = await record(async () => {
  for (let r = 0; r < 4; r++) {
    await synth('pointerdown', 440, 370, 1);
    await sleep(80);
    dprDuring = await dprNow();
    await sleep(80);
    await synth('pointerup', 440, 370, 0);
    await sleep(1100);
  }
});
const tapDark = await darkFrames(tapFrames);
report.info('DPR lúc đang nhấn / nghỉ', { during: dprDuring, idle: await dprNow() });
report.check(`4 cú chạm: không khung đen (${tapFrames.length} khung)`, tapDark.length === 0 && tapFrames.length > 60, tapDark);

report.section('nhón–kéo (xoay camera)');
const dragFrames = await record(async () => {
  for (let r = 0; r < 3; r++) {
    await synth('pointerdown', 440, 370, 1);
    for (let k = 0; k < 12; k++) {
      await synth('pointermove', 440 + k * 12, 370, 1);
      await sleep(33);
    }
    await synth('pointerup', 584, 370, 0);
    await sleep(1100);
  }
});
const dragDark = await darkFrames(dragFrames);
report.check(`3 cú kéo: không khung đen (${dragFrames.length} khung)`, dragDark.length === 0 && dragFrames.length > 60, dragDark);

report.section('đổi cỡ khung (ResizeObserver)');
const rsFrames = await record(async () => {
  for (let k = 0; k < 6; k++) {
    await page.setViewportSize({ width: k % 2 ? 1280 : 1180, height: 800 });
    await sleep(400);
  }
});
const rsDark = await darkFrames(rsFrames);
// (chỉ thông tin: khung quá độ lúc đổi cỡ — screencast cắt dở, bố cục dời — làm phép dò ô tối nhiễu; canvas xoá trắng thật
// cho độ tụt ~75 như ở trên, khung quá độ ~25–35)
report.info(`6 lần đổi cỡ (${rsFrames.length} khung): ô tối > 50`, rsDark.filter((d) => d.d > 50));
report.check('6 lần đổi cỡ: không khung canvas đen hẳn (ô tụt > 50)', rsDark.every((d) => d.d <= 50), rsDark);

await close();
process.exit(report.finish(errors));
