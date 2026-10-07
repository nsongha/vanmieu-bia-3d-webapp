// r71 — ĐÍCH BẤM BẰNG TAY cho lớp phủ (đọc toàn văn, bảng vàng): chạy được cả khi vòng con trỏ tay ẩn (mặc định kiosk —
// nam châm / vùng dính của lớp cử chỉ không chạy trong bảng body[data-modal]). Đọc window 'hand:frame':
//   · phần tử [data-rt] gần điểm tay nhất (khoảng cách tới MÉP, ≤ radius) → data-near (CSS: sáng lên, nở nhẹ);
//   · nhón nhanh (≤ TAP_MS, dời ≤ TAP_PX) bắt đầu khi đang gần một đích → bấm đích đó.
// Chống bấm đôi: lớp cử chỉ (khi con trỏ hiện) cũng bấm nút dưới con trỏ — mọi cú bấm vào cùng một đích trong DEDUPE_MS
// chỉ tính một lần (nghe pha bắt trên root).
const TAP_MS = 450;
const TAP_PX = 40;
const DEDUPE_MS = 450;

const rectDist = (r, x, y) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

/** @param {HTMLElement} root  @param {{radius?:number}} [opts] */
export function createHandTargets(root, { radius = 110 } = {}) {
  const roots = [root]; // r78: + tấm đọc 3D (lớp CSS3D)
  let on = false;
  let near = null;
  let pinch = null;

  const setNear = (el) => {
    if (el === near) return;
    near?.removeAttribute('data-near');
    near = el;
    near?.setAttribute('data-near', '');
  };

  function nearest(x, y) {
    let best = null;
    let bd = radius;
    // r75: đích nằm trong vùng cuộn (liên kết năm trong văn bản / thẻ) chỉ tính khi đang thấy trong vùng đó; thẻ đang ẩn thì bỏ
    for (const el of roots.flatMap((rt) => [...rt.querySelectorAll('[data-rt]')])) {
      if (el.disabled || el.closest('[hidden],[inert]')) continue;
      if (el.closest('.dd-card:not(.is-on)')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const sc = el.closest('.ri-ov__scroll');
      if (sc) {
        const box = sc.getBoundingClientRect();
        if (r.bottom < Math.max(0, box.top) || r.top > Math.min(innerHeight, box.bottom)) continue;
      }
      const d = rectDist(r, x, y);
      if (d <= bd) {
        bd = d;
        best = el;
      }
    }
    return best;
  }

  function onHand(ev) {
    const d = ev.detail || {};
    const now = performance.now();
    if (!d.detected) {
      setNear(null);
      pinch = null;
      return;
    }
    const isPinch = d.pose === 'pinch';
    if (!isPinch) {
      if (pinch) {
        const dt = now - pinch.t0;
        const moved = Math.hypot(d.x - pinch.x0, d.y - pinch.y0);
        if (import.meta.env.DEV) (window.__vm ??= {}).richTapLog = { dt: Math.round(dt), moved: Math.round(moved), el: pinch.el?.className ?? null };
        if (pinch.el && dt <= TAP_MS && moved <= TAP_PX) pinch.el.click();
        pinch = null;
      }
      setNear(nearest(d.x, d.y));
    } else if (!pinch) pinch = { t0: now, x0: d.x, y0: d.y, el: near };
  }

  // chống bấm đôi (cú nhón của lớp cử chỉ + của đây, hoặc bấm chuột đôi)
  function addRoot(el) {
    if (!el || roots.includes(el)) return;
    roots.push(el);
    el.addEventListener('click', onClickCapture, true);
  }
  function onClickCapture(e) {
    const t = e.target?.closest?.('[data-rt]');
    if (!t) return;
    const now = performance.now();
    if (now - (t._rtAt || 0) < DEDUPE_MS) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    t._rtAt = now;
  }
  root.addEventListener('click', onClickCapture, true);

  return {
    addRoot,
    attach() {
      if (on) return;
      on = true;
      window.addEventListener('hand:frame', onHand);
    },
    detach() {
      if (!on) return;
      on = false;
      window.removeEventListener('hand:frame', onHand);
      setNear(null);
      pinch = null;
    },
    dispose() {
      this.detach();
      root.removeEventListener('click', onClickCapture, true);
    },
  };
}
