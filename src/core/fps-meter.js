// Đồng hồ FPS góc trên bên trái (gỡ lỗi): số khung/giây trung bình + khung chậm nhất trong 1 giây gần nhất.
// r40: đếm lượt của VÒNG VẼ 3D (core/renderer.js báo qua markFrame — đã tính trần "FPS tối đa") và hiện kèm trần; không có
// cảnh 3D nào chạy thì đo bằng requestAnimationFrame riêng như trước. Khoảng cách giữa hai khung phản ánh cả việc JS lẫn
// GPU làm trễ khung (khung chậm nhất cao = "giật" dù FPS trung bình vẫn đẹp).
import { maxFps, onSettings } from './settings.js';
import './fps-meter.css';

const SAMPLE_MS = 500;   // cập nhật số hiển thị mỗi 0,5 giây
const WORST_MS = 1000;   // cửa sổ tìm khung chậm nhất

let el = null;
let raf = 0;
let last = 0;
let frames = 0;
let windowStart = 0;
/** @type {{t:number, dt:number}[]} */
let recent = [];
let cap = 60;
// r40: lượt của vòng vẽ 3D (markFrame) trong cửa sổ hiện tại
let loopFrames = 0;
let loopLast = 0;
let loopSeen = 0;
/** @type {{t:number, dt:number}[]} */
let loopRecent = [];

let note = null; // r64: ghi chú trần thích ứng (vd. "120→60 (lướt)") — core/renderer.js đặt
/** r64: ghi chú thay cho số trần (null = trần thường). */
export function setFpsNote(text) {
  note = text || null;
}

/** r40: core/renderer.js gọi mỗi lượt vòng vẽ THẬT SỰ chạy (sau trần FPS). now = mốc rAF. */
export function markFrame(now) {
  if (!raf) return;
  if (loopLast) {
    const dt = now - loopLast;
    loopFrames++;
    loopRecent.push({ t: now, dt });
    while (loopRecent.length && now - loopRecent[0].t > WORST_MS) loopRecent.shift();
  }
  loopLast = now;
  loopSeen = now;
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (last) {
    const dt = now - last;
    frames++;
    recent.push({ t: now, dt });
    while (recent.length && now - recent[0].t > WORST_MS) recent.shift();
  }
  last = now;
  if (!windowStart) windowStart = now;
  const span = now - windowStart;
  if (span >= SAMPLE_MS) {
    const screenFps = (frames * 1000) / span;
    const loopOn = now - loopSeen < WORST_MS;
    const fps = loopOn ? (loopFrames * 1000) / span : screenFps;
    const worst = (loopOn ? loopRecent : recent).reduce((m, r) => Math.max(m, r.dt), 0);
    // đích = trần, nhưng không quá tần số màn hình (trần 120 trên màn 60 Hz → 60)
    const target = loopOn ? Math.min(note ? 60 : cap, Math.round(screenFps / 10) * 10 || cap) : 60;
    el.textContent = loopOn ? `${fps.toFixed(0)} / ${note ?? cap} fps · max ${worst.toFixed(0)} ms` : `${fps.toFixed(0)} fps · max ${worst.toFixed(0)} ms`;
    el.dataset.level = fps >= target * 0.92 && worst < 2000 / target + 1 ? 'ok' : fps >= target * 0.66 ? 'warn' : 'bad';
    frames = 0;
    loopFrames = 0;
    windowStart = now;
  }
}

function start() {
  if (raf) return;
  if (!el) {
    el = document.createElement('div');
    el.className = 'fps-meter';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '— fps';
    document.body.appendChild(el);
  }
  el.hidden = false;
  last = 0; frames = 0; windowStart = 0; recent = [];
  loopLast = 0; loopFrames = 0; loopRecent = [];
  raf = requestAnimationFrame(tick);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (el) el.hidden = true;
}

// Tab ẩn: rAF đứng → khi quay lại, khoảng cách khung đầu tiên rất lớn; bỏ qua để số không nhảy vọt.
document.addEventListener('visibilitychange', () => { last = 0; recent = []; windowStart = 0; frames = 0; loopLast = 0; loopRecent = []; loopFrames = 0; });

/** Gắn đồng hồ FPS theo cài đặt `showFps`. Gọi một lần lúc khởi động app. */
export function initFpsMeter() {
  onSettings((s) => {
    cap = maxFps(s);
    if (s.showFps) start();
    else stop();
  });
}
