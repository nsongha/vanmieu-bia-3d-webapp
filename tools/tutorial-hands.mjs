#!/usr/bin/env node
// r66 — hình minh hoạ động tác cho hướng dẫn cử chỉ (views/cinema/tutorial-demo.js): KHUNG XƯƠNG bàn tay THẬT, lấy từ
// điểm mốc MediaPipe đã ghi của clip thử (test-clips/hand2-landmarks.json — không đi theo app, chỉ các đoạn ngắn đã chuẩn
// hoá dưới đây). Hai đoạn chuyển động thật, mỗi đoạn = [dáng đầu (trung bình các khung giữ yên), các khung chuyển thật
// (30 khung/s), dáng cuối (trung bình)]:
//   pinch : bàn tay xoè → ngón cái chạm ngón trỏ (hand2 17,0–18,5 s)
//   fist  : bàn tay xoè → nắm lại (hand2 86,0–88,2 s)
// Chuẩn hoá: lật như gương (khách thấy tay mình như trong khung xem trước), nhân x với tỉ lệ khung camera (hai trục cùng
// đơn vị), tâm lòng bàn tay (cổ tay + 4 khớp gốc ngón) về 0 ở MỖI khung, cỡ + góc theo dáng đầu của đoạn: cổ tay → khớp
// gốc ngón giữa dài 1, dựng đứng (ngón giữa chỉ lên). Toạ độ 3 chữ số thập phân.
//   node tools/tutorial-hands.mjs [clip.json] [--aspect 1.5]  →  src/data/tutorial-hands.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ai = args.indexOf('--aspect');
const ASPECT = ai >= 0 ? Number(args[ai + 1]) : 1620 / 1080; // hand2: 1620 × 1080
const clipPath = resolve(ROOT, args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--aspect') ?? 'test-clips/hand2-landmarks.json');
const OUT = resolve(ROOT, 'src/data/tutorial-hands.json');

/** [bắt đầu, hết] (giây) của dáng đầu / đoạn chuyển / dáng cuối. */
const SETS = {
  pinch: { open: [17.0, 17.27], move: [17.33, 17.74], end: [17.8, 18.5] },
  fist: { open: [86.0, 86.27], move: [86.33, 86.54], end: [86.6, 88.2] },
};

const clip = JSON.parse(readFileSync(clipPath, 'utf8'));
const framesIn = ([a, b]) => clip.filter((f) => f.t >= a - 1e-6 && f.t <= b + 1e-6 && f.L?.[0]?.length >= 21).map((f) => f.L[0].map(([x, y]) => [(1 - x) * ASPECT, y]));
const PALM = [0, 5, 9, 13, 17];
const palm = (p) => PALM.reduce((c, i) => [c[0] + p[i][0] / 5, c[1] + p[i][1] / 5], [0, 0]);
const mean = (fs) => fs[0].map((_, i) => [fs.reduce((s, f) => s + f[i][0], 0) / fs.length, fs.reduce((s, f) => s + f[i][1], 0) / fs.length]);
const r3 = (v) => Math.round(v * 1000) / 1000;

const seqs = {};
for (const [name, set] of Object.entries(SETS)) {
  const open = framesIn(set.open);
  const move = framesIn(set.move);
  const end = framesIn(set.end);
  if (!open.length || !move.length || !end.length) throw new Error(`${name}: thiếu khung (${open.length}/${move.length}/${end.length})`);
  const ref = mean(open);
  const v = [ref[9][0] - ref[0][0], ref[9][1] - ref[0][1]];
  const s = Math.hypot(v[0], v[1]);
  const ang = Math.atan2(v[0], -v[1]); // góc của cổ tay → khớp giữa so với phương thẳng lên (chiều kim đồng hồ, y xuống)
  const cs = Math.cos(-ang);
  const sn = Math.sin(-ang);
  const norm = (p) => {
    const c = palm(p);
    return p.map(([x, y]) => {
      const dx = (x - c[0]) / s;
      const dy = (y - c[1]) / s;
      return [r3(dx * cs - dy * sn), r3(dx * sn + dy * cs)];
    });
  };
  seqs[name] = [mean(open.map(norm)).map(([x, y]) => [r3(x), r3(y)]), ...move.map(norm), mean(end.map(norm)).map(([x, y]) => [r3(x), r3(y)])];
  console.log(`${name}: ${open.length} khung đầu · ${move.length} khung chuyển · ${end.length} khung cuối → ${seqs[name].length} dáng`);
}

const out = {
  v: 1,
  src: 'test-clips/hand2-landmarks.json (tools/tutorial-hands.mjs)',
  fps: 30,
  unit: 'lật gương; tâm lòng bàn tay = 0; cổ tay → khớp gốc ngón giữa = 1, dựng đứng (y xuống)',
  seqs,
};
const txt = `${JSON.stringify(out).replace(/\],\[\[/g, '],\n[[')}\n`;
writeFileSync(OUT, txt);
console.log(`→ ${OUT} (${(txt.length / 1024).toFixed(1)} KB)`);
