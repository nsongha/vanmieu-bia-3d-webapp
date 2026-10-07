// Bàn tay 3D của hướng dẫn (r68 → r69g): dáng ngón hợp giải phẫu (tutorial-hand3d.js solveFingers) — mọi khớp ngón chỉ GẬP về
// phía lòng bàn tay (không ưỡn ngược quá −10°), nắm tay thì đầu ngón (DIP) cong VÀO trong theo khớp giữa (PIP), cả khi:
//   · hình động tác (dữ liệu ghi 2D + độ sâu ước lượng) — mọi khung của mọi hình, mỗi 40 ms một mẫu;
//   · tay sống không có độ sâu (z = 0): các khung nắm tay thật của hand2 (86,6–88,2 s) và dáng nắm tổng hợp (vgen);
//   · tay sống có độ sâu MediaPipe NGƯỢC dấu ở đốt đầu ngón (nhiễu) — vẫn sửa được.
// node tests/cinema/hand3d.test.mjs --port 5180
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openCinema, parseArgs } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';
import { HAND } from '../gesture/vgen.mjs';

const { port, headed } = parseArgs();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const clip = JSON.parse(readFileSync(resolve(ROOT, 'test-clips/hand2-landmarks.json'), 'utf8'));
// tay sống: toạ độ camera đã lật gương, x × tỉ lệ khung (như tutorial.js nhận từ hand:skeleton), z = 0
const liveFist = clip.filter((f) => f.t >= 86.6 && f.t <= 88.2 && f.L.length).map((f) => f.L[0].map(([x, y]) => [(1 - x) * 1.5, y, 0]));
const vgenFist = [HAND.fist.map(([x, y]) => [-x, y, 0])];
const report = createReport('hand3d');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false } });
await openCinema(page, port, { hooks: ['cinemaTutorial'], settleMs: 1000 });
const R = await page.evaluate(async ([liveFist, vgenFist]) => {
  const H = await import('/src/views/cinema/tutorial-hand3d.js');
  const D = await import('/src/views/cinema/tutorial-demo.js');
  const stat = (list) => {
    let minFinger = Infinity, minThumb = Infinity, minDipFist = Infinity, n = 0;
    for (const pts of list) {
      const f = H.flexOfPose(pts);
      for (const a of f.fingers) for (const x of a) minFinger = Math.min(minFinger, x);
      minThumb = Math.min(minThumb, f.thumbIP);
      n++;
    }
    return { n, minFinger, minThumb };
  };
  const fistDip = (pts) => { const f = H.flexOfPose(pts); return { pip: f.fingers.map((a) => a[1]), dip: f.fingers.map((a) => a[2]) }; };
  // hình động tác: lấy mẫu dáng mọi 40 ms của từng hình
  const demoPoses = [];
  for (const kind of D.DEMO_KINDS) {
    const d = D.createDemo(kind);
    for (let t = 0; t < 5000; t += 40) { const st = d.sample(t); if (st) demoPoses.push(st.pts); }
  }
  // tay sống, độ sâu MediaPipe NGƯỢC dấu ở đốt đầu ngón (đầu ngón chĩa ra sau)
  const noisy = liveFist.slice(0, 20).map((f) => f.map((p, i) => [p[0], p[1], [8, 12, 16, 20].includes(i) ? -0.06 : [7, 11, 15, 19].includes(i) ? 0.03 : [6, 10, 14, 18].includes(i) ? 0.06 : 0]));
  return {
    demos: stat(demoPoses),
    live: stat(liveFist),
    vgen: stat(vgenFist),
    noisy: stat(noisy),
    demoFist: fistDip(D.createDemo('fist').sample(1500).pts),
    liveFistDip: fistDip(liveFist[20]),
    vgenFistDip: fistDip(vgenFist[0]),
    noisyDip: fistDip(noisy[10]),
  };
}, [liveFist, vgenFist]);
report.section('không ưỡn ngược (mọi khớp ≥ −10°)');
report.check(`hình động tác (${R.demos.n} dáng): ngón ≥ −10°, khớp ngón cái ≥ −10°`, R.demos.minFinger >= -10 && R.demos.minThumb >= -10, R.demos);
report.check(`tay sống không độ sâu — nắm tay thật của hand2 (${R.live.n} khung)`, R.live.minFinger >= -10 && R.live.minThumb >= -10, R.live);
report.check('tay sống không độ sâu — nắm tay tổng hợp (vgen)', R.vgen.minFinger >= -10 && R.vgen.minThumb >= -10, R.vgen);
report.check('tay sống có độ sâu nhiễu (đầu ngón chĩa ra sau)', R.noisy.minFinger >= -10 && R.noisy.minThumb >= -10, R.noisy);
report.section('nắm tay: đầu ngón cong vào trong theo khớp giữa');
const curled = (x) => x.pip.every((a) => a >= 60) && x.dip.every((a) => a >= 20);
report.check('hình động tác "fist": PIP ≥ 60°, DIP ≥ 20° ở cả bốn ngón', curled(R.demoFist), R.demoFist);
report.check('tay sống (hand2, không độ sâu): PIP ≥ 60°, DIP ≥ 20°', curled(R.liveFistDip), R.liveFistDip);
report.check('tay sống (độ sâu nhiễu ngược dấu): PIP ≥ 60°, DIP ≥ 20°', curled(R.noisyDip), R.noisyDip);
report.check('tay sống (vgen): PIP ≥ 60°, DIP ≥ 0° (dáng tổng hợp gập ít ở đầu ngón)', R.vgenFistDip.pip.every((a) => a >= 60) && R.vgenFistDip.dip.every((a) => a >= 0), R.vgenFistDip);
await close();
process.exit(report.finish(errors));
