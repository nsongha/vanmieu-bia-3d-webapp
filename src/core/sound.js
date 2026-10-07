// r32 — âm thanh phản hồi (WebAudio, tổng hợp — không có tệp âm thanh). Âm sắc hợp Văn Miếu: mềm, trầm, "cao cấp":
//  · tok   — tiếng mõ gỗ nhỏ, bị chặn (nhón / bấm chọn, kích hoạt mũi tên, chọn mốc dòng thời gian);
//  · chime — chuông nhỏ, êm (xong một bước hướng dẫn; chime({ final: true }) = hai nốt khi xong cả hướng dẫn);
//  · knock — gõ trầm rất khẽ + làn hơi (đổi bia);
//  · tick  — (r32b) "tạch" rất nhẹ, khô, như hạt bàn tính / nấc bánh cóc: mỗi lần tiêu điểm dòng thời gian đổi khi tay xoè
//    rê trong vùng dính (hud.js). Nhỏ hơn tok nhiều; lướt nhanh qua nhiều mốc thì nhỏ dần + thưa ra (bánh cóc êm, không
//    như súng máy).
// Không có tiếng khi rê (quá ồn). Mỗi tiếng có khoảng nghỉ tối thiểu → sự kiện dồn dập không chồng tiếng.
//
// Trình duyệt chỉ cho AudioContext chạy sau một thao tác THẬT của người dùng (click / phím) — cử chỉ tay (sự kiện tổng hợp)
// không tính. Mở khoá ở lần bấm / phím thật đầu tiên; chưa mở khoá thì mọi tiếng lặng lẽ bỏ qua (không xếp hàng). Máy
// kiosk: chạy Chrome với --autoplay-policy=no-user-gesture-required để có tiếng ngay từ đầu (README).
//
// Cài đặt: settings.sound (bật / tắt), settings.soundVolume (0..1).
import { getSettings, onSettings } from './settings.js';

/** Khoảng nghỉ tối thiểu giữa hai lần cùng một tiếng (ms). */
const MIN_GAP = { tok: 110, chime: 400, knock: 450, tick: 36 };
/** tick: lướt nhanh (khoảng cách giữa hai tiếng nhỏ) → nhỏ dần. */
const tickScale = (gapMs) => (gapMs < 60 ? 0.5 : gapMs < 90 ? 0.65 : gapMs < 140 ? 0.82 : 1);

let ctx = null;
let master = null;
let tone = null; // lọc thông thấp chung — tiếng "bị chặn", không chói
let enabled = true;
let volume = 0.6;
const lastAt = Object.create(null);
/** DEV: nhật ký tiếng đã phát / bỏ qua. */
const log = [];

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  master = ctx.createGain();
  tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  tone.Q.value = 0.4;
  const comp = ctx.createDynamicsCompressor(); // chặn đỉnh khi hai tiếng trùng nhau
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  tone.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);
  applyVolume();
  return ctx;
}

function applyVolume() {
  if (!master) return;
  const v = Math.max(0, Math.min(1, volume));
  master.gain.value = enabled ? 0.9 * v * v : 0; // đường cong theo tai nghe (bình phương)
}

/** Mở khoá bằng một thao tác THẬT (click / phím): tạo / đánh thức AudioContext. */
function unlock(e) {
  if (e && e.isTrusted === false) return;
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
  // Có cờ --autoplay-policy=no-user-gesture-required thì chạy ngay; không thì ngữ cảnh ở trạng thái "suspended" tới lần bấm đầu.
  queueMicrotask(() => {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  });
}

onSettings((s) => {
  enabled = s.sound !== false;
  const v = Number(s.soundVolume);
  volume = Number.isFinite(v) ? v : 0.6;
  applyVolume();
});

/** Một vỏ âm lượng: lên nhanh (atk s) rồi tắt dần theo hàm mũ trong dec s. */
function env(g, t0, peak, atk, dec) {
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
}
function partial(freq, t0, peak, atk, dec, { type = 'sine', from = 0, glide = 0.012 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  if (from > 0) {
    o.frequency.setValueAtTime(from, t0);
    o.frequency.exponentialRampToValueAtTime(freq, t0 + glide);
  } else o.frequency.setValueAtTime(freq, t0);
  env(g, t0, peak, atk, dec);
  o.connect(g);
  g.connect(tone);
  o.start(t0);
  o.stop(t0 + atk + dec + 0.05);
}
let noiseBuf = null;
function noise(t0, peak, atk, dec, { type = 'bandpass', freq = 2400, q = 1.2 } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.8), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, peak, atk, dec);
  src.connect(f);
  f.connect(g);
  g.connect(tone);
  src.start(t0);
  src.stop(t0 + atk + dec + 0.05);
}

const VOICES = {
  // Mõ gỗ nhỏ: thân gỗ rỗng — hai thành phần không điều hoà (~1 : 2,7), nảy cao độ rất nhẹ lúc gõ, tắt nhanh; một chút
  // tiếng "cộc" (nhiễu dải hẹp) ở đầu. Toàn bộ qua lọc thông thấp → tiếng bị chặn, ấm.
  tok(t, k) {
    const f = 760;
    partial(f, t, 0.42 * k, 0.002, 0.13, { from: f * 1.07 });
    partial(f * 2.71, t, 0.1 * k, 0.001, 0.05);
    noise(t, 0.08 * k, 0.001, 0.018, { freq: 1900, q: 2.2 });
  },
  // Chuông nhỏ êm: các thành phần của chuông (1 · 2,76 · 5,4), thành phần cao tắt nhanh hơn; final: thêm nốt thứ hai
  // cao hơn một quãng bốn đúng, trễ 0,16 s.
  chime(t, k, o) {
    const ring = (f, t0, kk) => {
      partial(f, t0, 0.22 * kk, 0.004, 1.6);
      partial(f * 2.76, t0, 0.06 * kk, 0.003, 0.7);
      partial(f * 5.4, t0, 0.02 * kk, 0.002, 0.35);
    };
    ring(1046.5, t, k);
    if (o?.final) ring(1396.9, t + 0.16, k * 0.85);
  },
  // Hạt bàn tính / nấc bánh cóc: một cú "tạch" khô rất ngắn — nhiễu dải hẹp cao + một thành phần gỗ nhỏ tắt tức thì.
  // 28/09: user thấy hơi nhỏ → to hơn ~5 dB (× 1,8), vẫn nhỏ hơn tok nhiều.
  tick(t, k) {
    noise(t, 0.126 * k, 0.0008, 0.011, { freq: 3300, q: 3.2 });
    partial(1480, t, 0.09 * k, 0.001, 0.022, { from: 1600, glide: 0.004 });
  },
  // Đổi bia: gõ trầm rất khẽ (trượt nhẹ xuống) + làn hơi mỏng lên chậm.
  knock(t, k) {
    partial(118, t, 0.2 * k, 0.006, 0.34, { from: 150, glide: 0.06 });
    noise(t, 0.035 * k, 0.16, 0.5, { type: 'lowpass', freq: 900, q: 0.5 });
  },
};

/**
 * Phát một tiếng. name: 'tok' | 'chime' | 'knock' | 'tick'. opts.gain: hệ số (1 = mặc định). Trả về true nếu thật sự phát.
 * Tắt âm thanh / chưa mở khoá / quá sát lần trước → bỏ qua lặng lẽ.
 */
export function playSound(name, opts = {}) {
  const voice = VOICES[name];
  if (!voice) return false;
  const now = performance.now();
  const why = !enabled || !(volume > 0) ? 'off' : now - (lastAt[name] ?? -1e9) < (MIN_GAP[name] ?? 100) ? 'gap' : null;
  if (why) {
    if (import.meta.env.DEV) log.push({ name, t: Math.round(now), skipped: why });
    return false;
  }
  const c = ensure();
  if (!c || c.state !== 'running') {
    if (import.meta.env.DEV) log.push({ name, t: Math.round(now), skipped: c ? c.state : 'no-audio' });
    return false;
  }
  const gap = now - (lastAt[name] ?? -1e9);
  lastAt[name] = now;
  let k = Math.max(0.05, Number(opts.gain ?? 1));
  if (name === 'tick') k *= tickScale(gap);
  try {
    voice(c.currentTime + 0.005, k, opts);
  } catch {
    return false;
  }
  if (import.meta.env.DEV) log.push({ name, t: Math.round(now), played: true, k: +k.toFixed(2), ...(opts.final ? { final: true } : {}) });
  return true;
}

/** Trạng thái ngữ cảnh âm thanh: 'running' | 'suspended' (chờ thao tác thật) | 'closed' | 'none'. */
export function soundState() {
  return ctx ? ctx.state : 'none';
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window.__vm ??= {}).sound = {
    play: playSound,
    get state() {
      return soundState();
    },
    log,
    clear: () => (log.length = 0),
    get enabled() {
      return enabled && volume > 0 && !!getSettings();
    },
  };
}
