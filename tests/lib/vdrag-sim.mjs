// r56 — tay tổng hợp cho "kéo bia" (hand:vdrag) + số đo độ mượt. Dùng chung cho tests/cinema/vdrag.test.mjs và đo trước /
// sau (chạy được trên bản chưa có r56: chỉ cần __vm.cinemaTxProgress).
//
// Tay: quỹ đạo x(t) (bề ngang màn hình 0..1) ghép từ các đoạn minimum-jerk; lấy mẫu 30 khung/s có lệch nhịp ±3 ms, nhiễu
// Gauss σ (như con trỏ tay đã lọc One Euro còn rung nhẹ), qua EMA nhẹ (bộ lọc con trỏ) — vx như lớp cử chỉ (EMA τ 40 ms trên
// đạo hàm). Phát 'hand:vdrag' start / move / end đúng hợp đồng.
//
// Đo mỗi khung vẽ (rAF): tiến độ lướt p → k = easeInOutCubic(p) (phần quãng bia đã đi), x thật của tay lúc đó.

/** Đoạn minimum-jerk: [{ to, ms }] từ x0. Trả hàm x(tMs). */
export function trajectory(x0, segs) {
  const pts = [];
  let t = 0;
  let x = x0;
  for (const s of segs) {
    pts.push({ t0: t, t1: t + s.ms, x0: x, x1: s.to ?? x });
    t += s.ms;
    x = s.to ?? x;
  }
  const mj = (u) => 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5;
  const f = (tm) => {
    for (const p of pts) if (tm <= p.t1) return p.x0 + (p.x1 - p.x0) * mj(Math.min(1, Math.max(0, (tm - p.t0) / Math.max(1, p.t1 - p.t0))));
    return x;
  };
  f.duration = t;
  f.segs = pts;
  return f;
}

/** Mã chạy TRONG trang: phát tay theo kế hoạch, ghi mỗi khung vẽ. Trả { frames, sent }. */
export const PAGE_RUN = async ({ segs, x0, noise = 0.0012, ema = 0.6, endVx = null, seed = 3, tailMs = 1600, probe = false }) => {
  let sd = seed;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd());
  const pts = [];
  let t = 0;
  let x = x0;
  for (const s of segs) {
    pts.push({ t0: t, t1: t + s.ms, x0: x, x1: s.to ?? x });
    t += s.ms;
    x = s.to ?? x;
  }
  const dur = t;
  const mj = (u) => 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5;
  const X = (tm) => {
    for (const p of pts) if (tm <= p.t1) return p.x0 + (p.x1 - p.x0) * mj(Math.min(1, Math.max(0, (tm - p.t0) / Math.max(1, p.t1 - p.t0))));
    return x;
  };
  const ease = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  const frames = [];
  const sent = [];
  const T0 = performance.now();
  let on = true;
  const rec = (ts) => {
    if (!on) return;
    // mốc khung vẽ (rAF) — không phải lúc hàm chạy: giật / gia tốc không bị nhiễu bởi lệch nhịp của chính trình ghi
    const tm = (Number.isFinite(ts) ? ts : performance.now()) - T0;
    const p = window.__vm.cinemaTxProgress();
    const f = { t: +tm.toFixed(1), x: +X(Math.min(tm, dur)).toFixed(5), p: +p.toFixed(5), k: p >= 0 ? +ease(p).toFixed(5) : null };
    if (probe && window.__vm.cinemaGrabProbe) Object.assign(f, window.__vm.cinemaGrabProbe());
    frames.push(f);
    requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
  const emit = (phase, xo, vx) => {
    const d = { phase, x: +xo.toFixed(4), dx: +(xo - x0).toFixed(4), vx: +vx.toFixed(3), t: performance.now() };
    sent.push({ t: +(performance.now() - T0).toFixed(1), ...d });
    window.dispatchEvent(new CustomEvent('hand:vdrag', { detail: d }));
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let xf = X(0);
  let vx = 0;
  let lastT = 0;
  let lastX = xf;
  emit('start', xf, 0);
  let k = 1;
  while (true) {
    const due = k * 33.33 + (rnd() - 0.5) * 6;
    const wait = due - (performance.now() - T0);
    if (wait > 0) await sleep(wait);
    const tm = performance.now() - T0;
    if (tm > dur) break;
    const obs = X(tm) + gauss() * noise;
    xf += (obs - xf) * ema; // ema 1 = không lọc (run tay thô ở mức sự kiện)
    const dt = tm - lastT;
    if (dt > 0) vx += ((xf - lastX) / (dt / 1000) - vx) * (1 - Math.exp(-dt / 40));
    lastT = tm;
    lastX = xf;
    emit('move', xf, vx);
    k++;
  }
  emit('end', xf, endVx ?? vx);
  await sleep(tailMs);
  on = false;
  return { frames, sent, dur };
};

/**
 * Số đo từ các khung vẽ trong đoạn [from, to] ms (đoạn KÉO — trước khi nhận). sOf(k): quãng màn hình (phần bề ngang) bia
 * đã đi ở phần quãng k (bảng của sân khấu; không có → tuyến tính với hệ số gain0).
 */
export function smoothness(frames, { from, to, W = 1440, sOf = null, gain0 = 1, handDir = -1, dead = 0 }) {
  const F = frames.filter((f) => f.t >= from && f.t <= to && f.k != null);
  const sx = (f) => (sOf ? sOf(f.k) : f.k * gain0); // phần bề ngang
  const pos = F.map((f) => sx(f) * W); // px
  const hand = F.map((f) => Math.max(0, (handDir * (f.x - frames[0].x) - dead)) * W);
  const steps = [];
  const stall = [];
  const vs = [];
  for (let i = 1; i < F.length; i++) {
    const dt = (F[i].t - F[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const d = pos[i] - pos[i - 1];
    const hv = Math.abs(hand[i] - hand[i - 1]) / dt; // px/s
    steps.push(Math.abs(d));
    vs.push({ t: F[i].t, v: d / dt, dt });
    if (hv > 0.05 * W) stall.push(Math.abs(d) < 0.05 ? 1 : 0);
  }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  // gia tốc / giật (px/s², px/s³) theo khung
  const acc = [];
  for (let i = 1; i < vs.length; i++) acc.push({ t: vs[i].t, a: (vs[i].v - vs[i - 1].v) / vs[i].dt, dt: vs[i].dt });
  const jerk = [];
  for (let i = 1; i < acc.length; i++) jerk.push((acc[i].a - acc[i - 1].a) / acc[i].dt);
  const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));
  // độ trễ: τ (ms) làm khớp nhất bia(t) ≈ gainFit · tay(t − τ); gainFit = hệ số khớp (quãng bia / quãng tay)
  let best = { tau: 0, err: Infinity, gain: 1 };
  for (let tau = 0; tau <= 200; tau += 4) {
    let num = 0;
    let den = 0;
    const pairs = [];
    for (let i = 0; i < F.length; i++) {
      const tt = F[i].t - tau;
      const j = F.findIndex((f) => f.t >= tt);
      if (j <= 0) continue;
      const a = F[j - 1];
      const b = F[j];
      const hx = hand[j - 1] + (hand[j] - hand[j - 1]) * ((tt - a.t) / Math.max(1e-6, b.t - a.t));
      pairs.push([pos[i], hx]);
      num += pos[i] * hx;
      den += hx * hx;
    }
    const g = den > 0 ? num / den : 1;
    const err = pairs.reduce((s, [p, h]) => s + (p - g * h) ** 2, 0) / Math.max(1, pairs.length);
    if (err < best.err) best = { tau, err, gain: g };
  }
  // bậc thang: bước mỗi khung lệch khỏi trung bình hai bước kề (khung có / không có mẫu tay mới xen kẽ) — % bước trung bình
  const mStep = steps.reduce((a, v) => a + v, 0) / Math.max(1, steps.length);
  let unev = 0;
  for (let i = 1; i < steps.length - 1; i++) unev += Math.abs(steps[i] - (steps[i - 1] + steps[i + 1]) / 2);
  const unevenPct = mStep > 0 ? +((100 * unev) / Math.max(1, steps.length - 2) / mStep).toFixed(1) : 0;
  return {
    frames: F.length,
    unevenPct,
    stepPx: { p10: +q(steps, 0.1).toFixed(2), p50: +q(steps, 0.5).toFixed(2), p90: +q(steps, 0.9).toFixed(2), max: +Math.max(0, ...steps).toFixed(2) },
    stallPct: +((100 * stall.reduce((s, v) => s + v, 0)) / Math.max(1, stall.length)).toFixed(1),
    jerkRms: Math.round(rms(jerk)),
    accRms: Math.round(rms(acc.map((a) => a.a))),
    lagMs: best.tau,
    gain: +best.gain.toFixed(3),
    fitErrPx: +Math.sqrt(best.err).toFixed(2),
  };
}
