// r71 → r78 — CUỘN vùng chữ của lớp đọc bằng MỘT bộ tích phân chuyển động (người dùng r78: chữ và camera phải đi cùng nhịp — kể
// cả lúc tăng / giảm tốc — thì thị sai mới "ăn"). Mọi đầu vào chỉ đổi ĐÍCH (target); vị trí làm mượt `s` là đầu ra DUY NHẤT:
//   · bánh xe / phím / nhón kéo / chuột kéo → đích dời theo, `s` bám bằng lò xo tắt dần tới hạn W_FOLLOW;
//   · thả tay khi kéo nhanh → ĐÍCH trôi theo đà (ma sát FRICTION), `s` vẫn bám bằng cùng lò xo;
//   · mục lục / "Đầu trang" / Home / End → `s` đi dài theo đường êm hai đầu (easeInOutCubic, 0,8–1,4 s theo quãng đường),
//     tới nơi đúng lúc; đầu vào khác giữa chừng → dừng nhảy, bám tiếp bằng lò xo từ vị trí + vận tốc hiện tại.
// Vị trí chữ (dịch nội dung) và cao độ camera (stage/read.js) đều là HÀM THUẦN của `s`, tính trong CÙNG một khung: sân khấu gọi
// step(dt) ngay trước khi đặt camera (readView.setSource) rồi đọc `s`; không có sân khấu lái thì tự chạy rAF. Nội dung dịch bằng
// transform (không cuộn gốc của trình duyệt — phần tử `overflow: hidden`, cuộn gốc luôn 0); `scrollTop / scrollHeight /
// clientHeight` của phần tử được thay bằng giá trị của bộ này (mã cũ + kiểm thử đọc / đặt như cuộn thường; đặt scrollTop = tức
// thì). Nghỉ thì làm tròn px (chữ sắc). Mỗi lần `s` đổi phát sự kiện 'scroll' trên phần tử.
// Tay (window 'hand:frame'): nhón rồi kéo = cầm trang (1 : GAIN). Không còn tự cuộn theo vị trí tay (r77).
import { clamp } from './common.js';

const GAIN = 1.5; // px trang / px tay khi nhón kéo
const FRICTION = 3.2; // /s — đà sau khi thả
const MAX_FLING = 2600; // px/s
const DRAG_SLOP = 6; // px chuột trước khi thành kéo (dưới ngưỡng: cú bấm thường)
const W_FOLLOW = 24; // rad/s — lò xo bám đích (~0,2 s tới 95 %)
const JUMP_T = [0.8, 1.4]; // s — thời lượng nhảy (ngắn → dài theo quãng đường, bão hoà ở JUMP_FAR px)
const JUMP_FAR = 4000;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const WHEEL_LINE = 40; // px / dòng (deltaMode 1)

const NATIVE = {
  top: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
  height: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'),
  client: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'),
};

/**
 * @param {HTMLElement} el  vùng xem chữ (overflow: hidden)
 * @param {{ content?: () => HTMLElement|null, contentH?: () => number, viewH?: () => number, offset?: (s:number) => number,
 *   region?: () => DOMRect, onScroll?: () => void }} [opts]
 *   content: phần tử nội dung để dịch · contentH / viewH: chiều cao nội dung / vùng đọc (mặc định: đo phần tử) · offset(s): độ
 *   dịch nội dung ứng với vị trí s (mặc định s — lớp đọc 3D trừ phần camera đã dời) · region: vùng nhận tay nhón kéo.
 */
export function createScroller(el, { content = () => el.firstElementChild, contentH, viewH, offset = (s) => s, region = () => el.getBoundingClientRect(), onScroll } = {}) {
  let on = false;
  let s = 0; // vị trí làm mượt (đầu ra)
  let v = 0; // px/s của s
  let target = 0;
  let jump = null; // đang nhảy: { from, to, t, T }
  let fling = 0; // px/s đà của ĐÍCH sau khi thả
  let last = -1; // s đã phát 'scroll'
  let lastOff = NaN;
  let driven = 0; // lần cuối sân khấu gọi step (ms)
  let raf = 0;
  let rafT = 0;
  const hand = { x: 0, y: 0, pinch: false, seen: false, t: 0 };
  let grab = null;
  let drag = null;

  const H = () => (viewH ? viewH() : NATIVE.client.get.call(el));
  const C = () => (contentH ? contentH() : NATIVE.height.get.call(el));
  const max = () => Math.max(0, C() - H());

  // phần tử "cuộn" theo bộ này (mã cũ / kiểm thử đặt scrollTop như thường)
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => s, set: (y) => api.set(y) });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => C() });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => H() });
  // cuộn gốc của trình duyệt (focus, chọn chữ…) luôn trả về 0 — chỉ transform dời nội dung
  el.addEventListener('scroll', (e) => {
    if (e.isTrusted && NATIVE.top.get.call(el) !== 0) NATIVE.top.set.call(el, 0);
  });

  function apply(force = false) {
    const c = content();
    if (!c) return;
    const o = offset(s);
    if (!force && Math.abs(o - lastOff) < 0.01) return;
    lastOff = o;
    c.style.transform = `translate3d(0, ${(-o).toFixed(2)}px, 0)`;
  }
  function emit() {
    if (Math.abs(s - last) < 0.01) return;
    last = s;
    el.dispatchEvent(new Event('scroll'));
    onScroll?.();
  }
  const moving = () => !!jump || !!grab || !!drag?.moved || Math.abs(target - s) > 0.05 || Math.abs(v) > 0.5 || Math.abs(fling) > 1;
  /** Dừng nhảy giữa chừng: đích = vị trí hiện tại (lò xo bám tiếp, giữ vận tốc). */
  function stopJump() {
    if (!jump) return;
    jump = null;
    target = s;
  }

  /** MỘT bước (dt giây): đà của đích → lò xo → dịch nội dung. Trả { s, max, k }. */
  function step(dt) {
    dt = Math.min(0.05, Math.max(0, dt || 0));
    const m = max();
    handStep();
    if (fling && !grab && !drag) {
      target += fling * dt;
      fling *= Math.exp(-FRICTION * dt);
      if (Math.abs(fling) < 4 || target <= 0 || target >= m) fling = 0;
    }
    target = clamp(target, 0, m);
    if (jump) {
      jump.t += dt;
      jump.to = clamp(jump.to, 0, m);
      const u = Math.min(1, jump.t / jump.T);
      const ns = jump.from + (jump.to - jump.from) * easeInOutCubic(u);
      v = dt > 0 ? (ns - s) / dt : 0;
      s = ns;
      target = jump.to;
      if (u >= 1) {
        s = target = Math.round(jump.to);
        v = 0;
        jump = null;
      }
    } else {
      const w = W_FOLLOW;
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        v += (w * w * (target - s) - 2 * w * v) * h;
        s += v * h;
      }
    }
    if (s < 0 || s > m) {
      s = clamp(s, 0, m);
      v = 0;
    }
    if (!jump && Math.abs(target - s) < 0.05 && Math.abs(v) < 0.5 && !fling && !grab && !drag?.moved) {
      // nghỉ: đúng px nguyên (chữ sắc)
      target = Math.round(target);
      s = target;
      v = 0;
    }
    apply();
    emit();
    return { s, max: m, k: m > 0 ? s / m : 0 };
  }

  // tự chạy khi sân khấu không lái (không có khung đọc 3D / phẳng — vd. giảm chuyển động không camera)
  function loop(t) {
    raf = 0;
    if (!on) return;
    const dt = rafT ? (t - rafT) / 1000 : 1 / 60;
    rafT = t;
    if (performance.now() - driven > 120) step(dt);
    if (moving() || (hand.seen && performance.now() - hand.t < 300)) raf = requestAnimationFrame(loop);
    else rafT = 0;
  }
  function wake() {
    if (on && !raf) raf = requestAnimationFrame(loop);
  }

  // ---- tay: nhón kéo
  function onHand(ev) {
    const d = ev.detail || {};
    hand.seen = !!d.detected;
    hand.t = performance.now();
    hand.pinch = !!d.detected && d.pose === 'pinch';
    if (d.detected) {
      hand.x = d.x;
      hand.y = d.y;
    }
    wake();
  }
  function handStep() {
    const fresh = hand.seen && performance.now() - hand.t < 250;
    const r = region();
    const inside = fresh && hand.x >= r.left && hand.x <= r.right && hand.y >= r.top - 40 && hand.y <= r.bottom + 40;
    if (fresh && hand.pinch && (grab || inside)) {
      const t = performance.now();
      if (!grab) {
        stopJump();
        grab = { y0: hand.y, p0: target, ly: hand.y, lt: t, v: 0 };
      }
      const dtg = Math.max(1, t - grab.lt) / 1000;
      if (hand.y !== grab.ly) {
        const vv = (-(hand.y - grab.ly) * GAIN) / dtg;
        grab.v = grab.v * 0.7 + vv * 0.3;
        grab.ly = hand.y;
        grab.lt = t;
      }
      target = grab.p0 - (hand.y - grab.y0) * GAIN;
      fling = 0;
    } else if (grab) {
      fling = performance.now() - grab.lt < 120 ? clamp(grab.v, -MAX_FLING, MAX_FLING) : 0;
      grab = null;
    }
  }

  // ---- chuột kéo trang (không bắt đầu trên nút / liên kết)
  function onDown(e) {
    if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest?.('button, a, [data-rt]')) return;
    drag = { id: e.pointerId, y0: e.clientY, p0: target, ly: e.clientY, lt: performance.now(), v: 0, moved: false };
    fling = 0;
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < DRAG_SLOP) return;
    if (!drag.moved) {
      drag.moved = true;
      if (jump) {
        // kéo giữa lúc đang nhảy: cầm trang ở đúng vị trí đang thấy
        stopJump();
        drag.p0 = s;
        drag.y0 = e.clientY;
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* không bắt được thì thôi */
      }
    }
    const t = performance.now();
    const vv = -(e.clientY - drag.ly) / Math.max(1, t - drag.lt) * 1000;
    drag.v = drag.v * 0.6 + vv * 0.4;
    drag.ly = e.clientY;
    drag.lt = t;
    target = drag.p0 - dy;
    wake();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved && performance.now() - drag.lt < 120) fling = clamp(drag.v, -MAX_FLING, MAX_FLING);
    drag = null;
    wake();
  }
  // ---- bánh xe (không để trình duyệt cuộn)
  function onWheel(e) {
    e.preventDefault();
    const k = e.deltaMode === 1 ? WHEEL_LINE : e.deltaMode === 2 ? H() : 1;
    api.by(e.deltaY * k);
  }

  const api = {
    attach() {
      if (on) return;
      on = true;
      window.addEventListener('hand:frame', onHand);
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('wheel', onWheel, { passive: false });
      apply(true);
      wake();
    },
    detach() {
      if (!on) return;
      on = false;
      window.removeEventListener('hand:frame', onHand);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      rafT = 0;
      grab = drag = null;
      fling = 0;
    },
    /** Dời đích (px) — bánh xe / phím. */
    by(dy) {
      stopJump();
      target = clamp(target + dy, 0, max());
      fling = 0;
      wake();
    },
    /** Nhảy tới (px) — mục lục / Đầu trang / Home / End: đi dài, êm. */
    to(y) {
      const to = clamp(y, 0, max());
      fling = 0;
      if (Math.abs(to - s) < 0.5) {
        jump = null;
        target = to;
      } else {
        const d = Math.abs(to - s);
        jump = { from: s, to, t: 0, T: JUMP_T[0] + (JUMP_T[1] - JUMP_T[0]) * Math.min(1, d / JUMP_FAR) };
        target = to;
      }
      wake();
    },
    /** Đặt TỨC THÌ (mở ở một phần, scrollTop = …). */
    set(y) {
      target = s = clamp(Number(y) || 0, 0, max());
      v = 0;
      fling = 0;
      jump = null;
      apply(true);
      emit();
    },
    /** Sân khấu gọi mỗi khung (trước khi đặt camera) — xem readView.setSource. */
    step(dt) {
      driven = performance.now();
      return step(dt);
    },
    /** Dịch lại nội dung (đổi hàm offset / đổi nội dung). */
    refresh() {
      apply(true);
    },
    get pos() {
      return s;
    },
    get target() {
      return target;
    },
    get moving() {
      return moving();
    },
    get dragging() {
      return !!grab || !!drag?.moved;
    },
    /** DEV: trạng thái. */
    state: () => ({ pos: Math.round(s), target: Math.round(target), max: Math.round(max()), vel: Math.round(v), fling: Math.round(fling), grab: !!grab, jump: !!jump, edge: '' }),
  };
  return api;
}
