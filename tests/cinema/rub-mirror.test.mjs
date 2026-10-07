// Chế độ xoa đầu rùa (r38): vòng brush (+ lung linh / vệt loé mở khoá) vẽ trong shader đá KHÔNG soi xuống gương lòng
// bục; gương vẫn soi bia bình thường. So vùng phản chiếu dưới đầu rùa khi vòng brush hiện / ẩn (chuột trên mũi rùa / ra
// nền trống), camera ép vẽ lại gương ở cùng tư thế. Bia 1715, phản chiếu 100 %.
// node tests/cinema/rub-mirror.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('rub-mirror');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, reflection: 1 } });
await openCinema(page, port, { id: 'bia-1715', hooks: ['cinemaRub', 'cinemaRubState', 'cinemaOrbit'], settleMs: 2500 });
const E = (fn, a) => page.evaluate(fn, a);
await E(() => { window.__vm.cinemaRub.unlock(); window.__vm.cinemaRub.enter('mouse'); });
await sleep(2800);
const h = await E(() => window.__vm.cinemaRub.head());
const shot = async (name) => { await E(() => window.__vm.cinemaOrbit(0.4, 0)); await sleep(120); await E(() => window.__vm.cinemaOrbit(-0.4, 0)); await sleep(350); const b = await page.screenshot(); return 'data:image/png;base64,' + b.toString('base64'); };
// chuột trên mũi rùa → vòng brush hiện
await page.mouse.move(h.x - h.r * 0.5, h.y, { steps: 4 });
await sleep(600);
const brushOn = await E(() => window.__vm.cinemaRubState?.()?.brush ?? null);
const A = await shot();
// chuột ra nền trống → vòng brush ẩn
await page.mouse.move(40, 450, { steps: 4 });
await sleep(900);
const brushOff = await E(() => window.__vm.cinemaRubState?.()?.brush ?? null);
const B = await shot();
// vùng phản chiếu: dưới đầu rùa (lượt chính của vòng brush nằm ở trên, ngoài vùng này) — so điểm ảnh trong trang (canvas 2D)
const x0 = Math.max(0, Math.round(h.x - h.r * 4)), x1 = Math.min(1440, Math.round(h.x + h.r * 4));
const y0 = Math.round(h.y + h.r * 0.6), y1 = Math.min(900, Math.round(h.y + h.r * 7));
const cmp = await E(async ([a, b, x0, y0, x1, y1]) => {
  const load = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(x0, y0, x1 - x0, y1 - y0).data; };
  const A = px(ia), B = px(ib);
  let diff = 0, maxd = 0, lum = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    if (d > 30) diff++;
    if (d > maxd) maxd = d;
    lum += B[i] + B[i + 1] + B[i + 2];
  }
  return { diff, maxd, n: A.length / 4, lum: lum / (A.length / 4) / 3 };
}, [A, B, x0, y0, x1, y1]);
const diff = cmp.diff, maxd = cmp.maxd, n = cmp.n, lum = cmp.lum * n * 3;

report.check('vòng brush hiện trên mũi rùa (lượt chính)', (brushOn?.r ?? 0) > 0 && (brushOff?.r ?? 1) === 0, { on: brushOn?.r, off: brushOff?.r });
report.check('vùng phản chiếu: có / không vòng brush như nhau (≤ 20 điểm ảnh khác)', cmp.diff <= 20, { changedPx: cmp.diff, maxDiff: cmp.maxd, region: [x0, y0, x1, y1] });
report.check('gương vẫn soi bia (vùng phản chiếu sáng hơn nền tối)', cmp.lum > 40, { meanLum: +cmp.lum.toFixed(1) });
await close();
process.exit(report.finish(errors));
