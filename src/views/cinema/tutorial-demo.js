// r66 — HÌNH MINH HOẠ ĐỘNG TÁC của hướng dẫn cử chỉ (tutorial.js): khung xương bàn tay THẬT (điểm mốc MediaPipe đã ghi —
// src/data/tutorial-hands.json, tools/tutorial-hands.mjs) cùng kiểu vẽ với khung xem trước (core/hand/skeleton.js), chạy
// vòng lặp ngắn trên một canvas nhỏ cạnh dòng chỉ dẫn. Thay các hình bàn tay vẽ tay (SVG) của r33b–r50 (người dùng: "hình
// bàn tay đang có xấu quá … dùng chính video từ skeleton").
//
// Mỗi hình = một dòng thời gian gồm các đoạn { ms, seq, u: [từ, tới], x: [từ, tới], y, a (độ đậm), dot (chấm chạm) } — dáng
// tay lấy ở vị trí u (0..1) của một đoạn chuyển động thật ('pinch': xoè → chạm ngón cái vào ngón trỏ · 'fist': xoè → nắm),
// dịch cả bàn tay theo x / y (đơn vị: cổ tay → khớp gốc ngón giữa). Chỉ vẽ khi hướng dẫn gọi draw() (hướng dẫn mở, dòng đang
// hiện, ~20 khung / s); giảm chuyển động: một dáng đứng yên (still) vẽ một lần.
import HANDS from '../../data/tutorial-hands.json';
import { SKELETON_STYLE, drawHandSkeleton } from '../../core/hand/skeleton.js';

// r68: bàn tay 3D cần độ sâu — dữ liệu ghi chỉ có x, y; ước lượng z theo độ co ngắn của từng đốt so với dáng xoè đầu đoạn
// (đốt ngắn lại trên ảnh = đốt chĩa về phía người xem: gập ngón về phía lòng bàn tay, lòng bàn tay hướng về người xem).
const CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
function withDepth(fs) {
  const rest = CHAINS.map((c) => c.slice(1).map((b, i) => Math.hypot(fs[0][b][0] - fs[0][c[i]][0], fs[0][b][1] - fs[0][c[i]][1])));
  return fs.map((f) => {
    const out = f.map(([x, y]) => [x, y, 0]);
    CHAINS.forEach((c, ci) => {
      for (let i = 1; i < c.length; i++) {
        const a = out[c[i - 1]];
        const b = out[c[i]];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const L0 = rest[ci][i - 1];
        b[2] = a[2] + 0.95 * Math.sqrt(Math.max(0, L0 * L0 - L * L));
      }
    });
    return out;
  });
}
const SEQS = Object.fromEntries(Object.entries(HANDS.seqs).map(([k, fs]) => [k, withDepth(fs)]));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/** Dáng tay ở vị trí u (0..1) của đoạn chuyển động (các khung cách đều, nội suy tuyến tính giữa hai khung). */
function poseAt(seq, u) {
  const fs = SEQS[seq];
  const f = Math.max(0, Math.min(1, u)) * (fs.length - 1);
  const i = Math.min(fs.length - 2, Math.floor(f));
  const t = f - i;
  const a = fs[i];
  const b = fs[i + 1];
  return a.map((p, k) => [lerp(p[0], b[k][0], t), lerp(p[1], b[k][1], t), lerp(p[2], b[k][2], t)]);
}

// ---- dòng thời gian (đơn vị dịch: cổ tay → khớp gốc ngón giữa = 1)
const S = (ms, seq, u, extra = {}) => ({ ms, seq, u: Array.isArray(u) ? u : [u, u], ...extra });
const DEMOS = {
  // xoè đủ 5 ngón: tay khép hờ → xoè rộng, giữ, khép lại
  open: { still: 0.45, parts: [S(500, 'fist', [0.55, 0]), S(1100, 'fist', 0), S(600, 'fist', [0, 0.55]), S(400, 'fist', 0.55)] },
  // đưa tay tới đích (vòng nhỏ): bàn tay mở trôi sang phải / trái / lên chéo vào vòng
  moveR: { still: 0.55, ring: [0.75, 0], parts: [S(260, 'pinch', 0, { x: [-0.75, -0.75], a: [0, 1] }), S(1000, 'pinch', 0, { x: [-0.75, 0.75] }), S(520, 'pinch', 0, { x: [0.75, 0.75] }), S(260, 'pinch', 0, { x: [0.75, 0.75], a: [1, 0] })] },
  moveL: { still: 0.55, ring: [-0.75, 0], parts: [S(260, 'pinch', 0, { x: [0.75, 0.75], a: [0, 1] }), S(1000, 'pinch', 0, { x: [0.75, -0.75] }), S(520, 'pinch', 0, { x: [-0.75, -0.75] }), S(260, 'pinch', 0, { x: [-0.75, -0.75], a: [1, 0] })] },
  reach: { still: 0.55, ring: [0.45, -0.1], parts: [S(260, 'pinch', 0, { x: [-0.6, -0.6], y: [0.35, 0.35], a: [0, 1] }), S(950, 'pinch', 0, { x: [-0.6, 0.45], y: [0.35, -0.1] }), S(560, 'pinch', 0, { x: [0.45, 0.45], y: [-0.1, -0.1] }), S(260, 'pinch', 0, { x: [0.45, 0.45], y: [-0.1, -0.1], a: [1, 0] })] },
  // chạm–thả: xoè → chạm ngón cái vào ngón trỏ → thả ngay
  tap: { still: 0.4, parts: [S(520, 'pinch', 0), S(300, 'pinch', [0, 1]), S(220, 'pinch', 1, { dot: 1 }), S(300, 'pinch', [1, 0]), S(760, 'pinch', 0)] },
  // chạm và giữ
  hold: { still: 0.55, parts: [S(480, 'pinch', 0), S(300, 'pinch', [0, 1]), S(1300, 'pinch', 1, { dot: 1 }), S(300, 'pinch', [1, 0]), S(420, 'pinch', 0)] },
  // thả ra: đang chạm → mở
  release: { still: 0.72, parts: [S(800, 'pinch', 1, { dot: 1 }), S(340, 'pinch', [1, 0]), S(1000, 'pinch', 0)] },
  // kéo ngang / lên xuống: đang chạm, cả bàn tay đi qua lại
  dragH: { still: 0.3, parts: [S(520, 'pinch', 1, { dot: 1, x: [0, -0.55] }), S(1000, 'pinch', 1, { dot: 1, x: [-0.55, 0.55] }), S(520, 'pinch', 1, { dot: 1, x: [0.55, 0] })] },
  dragV: { still: 0.3, uh: 2.95, parts: [S(520, 'pinch', 1, { dot: 1, y: [0, -0.38] }), S(1000, 'pinch', 1, { dot: 1, y: [-0.38, 0.38] }), S(520, 'pinch', 1, { dot: 1, y: [0.38, 0] })] },
  // nắm tay: xoè → nắm, giữ, mở
  fist: { still: 0.5, parts: [S(700, 'fist', 0), S(360, 'fist', [0, 1]), S(1000, 'fist', 1), S(420, 'fist', [1, 0]), S(320, 'fist', 0)] },
  // nắm tay kéo sang trái (đang nắm) · xoè → nắm → kéo sang phải → mở
  fistL: { still: 0.45, parts: [S(260, 'fist', 1, { x: [0.65, 0.65], a: [0, 1] }), S(420, 'fist', 1, { x: [0.65, 0.65] }), S(1000, 'fist', 1, { x: [0.65, -0.65] }), S(420, 'fist', 1, { x: [-0.65, -0.65] }), S(260, 'fist', 1, { x: [-0.65, -0.65], a: [1, 0] })] },
  fistR: { still: 0.55, parts: [S(260, 'fist', 0, { x: [-0.65, -0.65], a: [0, 1] }), S(420, 'fist', 0, { x: [-0.65, -0.65] }), S(360, 'fist', [0, 1], { x: [-0.65, -0.65] }), S(1000, 'fist', 1, { x: [-0.65, 0.65] }), S(380, 'fist', [1, 0], { x: [0.65, 0.65] }), S(300, 'fist', 0, { x: [0.65, 0.65], a: [1, 0] })] },
  // thả tay ra: đang nắm → xoè
  unfist: { still: 0.72, parts: [S(800, 'fist', 1), S(420, 'fist', [1, 0]), S(1000, 'fist', 0)] },
};
for (const d of Object.values(DEMOS)) {
  d.total = d.parts.reduce((s, p) => s + p.ms, 0);
  // r66b: quãng dịch ngang lớn nhất (tâm bàn tay / đích) — ô hình cố định: thu quãng dịch cho vừa bề ngang ô
  d.maxX = Math.max(0, ...d.parts.flatMap((p) => (p.x ? p.x.map(Math.abs) : [0])), d.ring ? Math.abs(d.ring[0]) : 0);
}
export const DEMO_KINDS = Object.keys(DEMOS);

/** Trạng thái hình ở thời điểm t (ms, trong một vòng): dáng + dịch + độ đậm + chấm chạm. */
function stateAt(d, t) {
  let rest = ((t % d.total) + d.total) % d.total;
  for (const p of d.parts) {
    if (rest <= p.ms || p === d.parts.at(-1)) {
      const k = ease(Math.min(1, rest / p.ms));
      return {
        pts: poseAt(p.seq, lerp(p.u[0], p.u[1], k)),
        x: p.x ? lerp(p.x[0], p.x[1], k) : 0,
        y: p.y ? lerp(p.y[0], p.y[1], k) : 0,
        a: p.a ? lerp(p.a[0], p.a[1], k) : 1,
        dot: p.dot ? p.dot : p.seq === 'pinch' && Math.min(p.u[0], p.u[1]) < 1 && Math.max(p.u[0], p.u[1]) === 1 ? Math.max(0, (lerp(p.u[0], p.u[1], k) - 0.85) / 0.15) : 0,
      };
    }
    rest -= p.ms;
  }
  return null;
}

// Khung vẽ: bàn tay mở cao ~1,95 đơn vị (ngón giữa −1,21 … cổ tay +0,72 quanh tâm lòng bàn tay) trong UNITS_H đơn vị bề
// cao canvas (kéo lên xuống: chừa thêm chỗ — d.uh); tâm lòng bàn tay hạ xuống 0,245 đơn vị để cả bàn tay nằm giữa.
const UNITS_H = 2.25;

/**
 * Một hình minh hoạ trên canvas mới (CSS đặt cỡ — tutorial.css .cin-tut__demo).
 * @param {keyof typeof DEMOS} kind
 */
export function createDemo(kind, getHand = null) {
  const d = DEMOS[kind];
  if (!d) return null;
  const el = document.createElement('canvas');
  el.className = 'cin-tut__demo';
  el.dataset.demo = kind;
  el.setAttribute('aria-hidden', 'true');
  let ctx = null;
  let w = 0;
  let h = 0;
  let t0 = -1;
  let frames = 0;
  let fitAt = -1e9;
  function fit(now = performance.now()) {
    // (r69g) đọc cỡ ô (clientWidth → buộc tính lại bố cục nếu có gì vừa đổi) tối đa 2 lần / s, không phải mỗi khung
    if (ctx && now - fitAt < 500) return true;
    fitAt = now;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw !== w || ch !== h || el.width !== Math.round(cw * dpr)) {
      w = cw;
      h = ch;
      el.width = Math.round(cw * dpr);
      el.height = Math.round(ch * dpr);
      ctx = el.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return !!ctx;
  }
  function paint(st) {
    ctx.clearRect(0, 0, w, h);
    if (!st) return;
    // r68: bàn tay 3D có thêm cổ tay áo bên dưới (đầu ngón −1,35 … mép cổ tay áo +1,36 quanh tâm lòng bàn tay) → khung cao hơn,
    // tâm lòng bàn tay ở giữa ô
    const hand = getHand?.();
    const k = h / (hand ? (d.uh ?? UNITS_H) + 0.6 : d.uh ?? UNITS_H);
    const cy0 = h / 2 + (hand ? 0 : 0.245 * k);
    // bàn tay rộng ~1,8 đơn vị (nửa ~0,95): quãng dịch ngang thu lại cho cả bàn tay nằm trong ô
    const fx = d.maxX > 0 ? Math.max(0.25, Math.min(1, (w / (2 * k) - 0.95) / d.maxX)) : 1;
    const ox = w / 2 + st.x * fx * k;
    const oy = cy0 + st.y * k;
    if (d.ring) {
      // đích nhỏ (vòng mảnh) ở chỗ bàn tay sẽ tới
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(217,179,108,.9)';
      ctx.lineWidth = Math.max(1, k * 0.018);
      ctx.beginPath();
      ctx.arc(w / 2 + d.ring[0] * fx * k, cy0 + d.ring[1] * k, 0.62 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = st.a;
    const X = (v) => ox + v * k;
    const Y = (v) => oy + v * k;
    // r68: bàn tay hoạt hình 3D (tutorial-hand3d.js — tâm lòng bàn tay của dáng ở (ox, oy)); không có WebGL → khung xương
    if (hand) hand.draw(ctx, st.pts, ox, oy, k, st.a);
    // (r66b: hình to — cao bằng chồng 3 dòng — nét theo cỡ như khung xương sống trong khung tròn)
    else drawHandSkeleton(ctx, st.pts, { X, Y, lineWidth: Math.max(1.2, k * 0.032), dotR: Math.max(1.3, k * 0.042) });
    if (st.dot > 0.01) {
      // chỗ hai đầu ngón chạm nhau: một chấm sáng
      const p4 = st.pts[4];
      const p8 = st.pts[8];
      const cx = X((p4[0] + p8[0]) / 2);
      const cy = Y((p4[1] + p8[1]) / 2);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, k * 0.34);
      g.addColorStop(0, `rgba(255,236,200,${0.95 * st.dot * st.a})`);
      g.addColorStop(1, 'rgba(255,180,84,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, k * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    frames++;
  }
  return {
    el,
    kind,
    get frames() {
      return frames;
    },
    /** Một khung của vòng lặp (now = performance.now()). */
    draw(now) {
      if (!fit(now)) return;
      if (t0 < 0) t0 = now;
      paint(stateAt(d, now - t0));
    },
    /** Giảm chuyển động: một dáng đứng yên (d.still — tỉ lệ của vòng). */
    still() {
      if (!fit()) return;
      paint(stateAt(d, d.total * d.still));
    },
    /** DEV / kiểm thử: trạng thái ở thời điểm t (không vẽ). */
    sample: (t) => stateAt(d, t),
  };
}

export { SKELETON_STYLE };
