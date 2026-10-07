// Phần dùng chung của các kiểu dòng thời gian (timeline-concept.js — Thước khắc · timeline-line.js — Sợi chỉ, r43 đưa lại).
//
//   · createMagnifier — "một mốc nhô lên và đi theo con trỏ" (r25, người dùng: giống dock của mac nhưng chỉ giữ MỐC ĐANG
//     CHỌN ở độ phóng, mốc đã lướt qua tự thu lại): chỉ mốc tiêu điểm lên hết cỡ (k = 1), hai mốc kề ±1 nhích rất nhẹ
//     (k = NEIGH, ~1,15×), còn lại về 0. Lên nhanh (τ 35 ms), thu nhanh (τ 45 ms → ~135 ms ease-out) → không để lại vệt
//     mốc còn nhô phía sau con trỏ, không có sóng rộng. (r23 → r24: đồi Gauss σ ≈ 1,9 khoảng vạch, cùng τ 70 ms.)
//     Vòng rAF chỉ chạy khi còn đổi; chỉ ghi biến CSS --k (0..1) lên nút vạch — nét vẽ bên trong tự phóng bằng transform,
//     nút (vùng bấm / đích nam châm) không xê dịch. Giảm chuyển động: chỉ mốc tiêu điểm đổi, tức thì.
//   · createStickyIndex — r24, chế độ "dính" của tay (hand:sticky, lớp cử chỉ): vị trí ngang của tay trong vùng dính
//     (rel.x 0..1 theo khung chụp lúc vào, có thể < 0 / > 1 trong phần đệm) → chỉ số vạch, ĐỀU theo chỉ số (không theo
//     năm: cụm năm sát nhau như 1778 · 1779 vẫn mỗi vạch một ô) và CÓ TRỄ: chỉ đổi vạch khi tay qua khỏi ô hiện tại thêm
//     HYST ô → tay rung ±3 px không làm vạch nhấp nháy giữa hai vạch kề nhau. Hai đầu (1442 · 1779) nằm ngay mép vùng.

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!reduceMq?.matches;

export const MAG_SIGMA = 1.9; // (r23–r24; hình dạng không còn theo khoảng cách — giữ chữ ký aim())
const TAU_UP = 0.035; // giây — mốc lên
const TAU_DOWN = 0.045; // giây — mốc thu lại (~135 ms tới 5 %)
const NEIGH = 0.12; // độ nhô của hai mốc kề tiêu điểm (±1): rất nhẹ, chỉ để còn cảm giác dock
const SNAP_DOWN = 0.03;

/**
 * @returns {{ bind(ticks: HTMLElement[]): void, aim(xs: ArrayLike<number>|null, cx: number|null, hot: number, sigma: number): void,
 *   readonly k: number[], stop(): void }}
 */
export function createMagnifier() {
  let ticks = [];
  let kNow = new Float32Array(0);
  let kTgt = new Float32Array(0);
  let raf = 0;
  let last = 0;
  function step(t) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    const rm = reducedMotion();
    const aUp = rm ? 1 : 1 - Math.exp(-dt / TAU_UP);
    const aDown = rm ? 1 : 1 - Math.exp(-dt / TAU_DOWN);
    let busy = false;
    for (let i = 0; i < ticks.length; i++) {
      const d = kTgt[i] - kNow[i];
      if (d === 0) continue;
      // thu lại: dưới SNAP_DOWN (< ~1,04×, mắt không thấy) thì về hẳn đích — đuôi kết thúc trong ~140 ms, không kéo dài
      if (Math.abs(d) < (d < 0 ? SNAP_DOWN : 0.004)) kNow[i] = kTgt[i];
      else {
        kNow[i] += d * (d > 0 ? aUp : aDown);
        busy = true;
      }
      ticks[i].style.setProperty('--k', kNow[i] < 0.001 ? '0' : kNow[i].toFixed(3));
    }
    if (busy) raf = requestAnimationFrame(step);
  }
  return {
    bind(t) {
      ticks = t;
      kNow = new Float32Array(t.length);
      kTgt = new Float32Array(t.length);
    },
    /**
     * cx: có tiêu điểm hay không (null = tắt — mọi mốc thu về); hot: mốc tiêu điểm (lên hết cỡ); hai mốc kề nhích nhẹ.
     * (xs, sigma: giữ chữ ký r23 — hình dạng không còn theo khoảng cách tới con trỏ.)
     */
    aim(xs, cx, hot, sigma) {
      void xs;
      void sigma;
      kTgt.fill(0);
      if (cx != null && hot >= 0 && hot < ticks.length) {
        kTgt[hot] = 1;
        if (!reducedMotion()) {
          if (hot > 0) kTgt[hot - 1] = NEIGH;
          if (hot < ticks.length - 1) kTgt[hot + 1] = NEIGH;
        }
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    },
    get k() {
      return Array.from(kNow, (v) => +v.toFixed(3));
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

/** r24 — vị trí tay trong vùng dính → chỉ số vạch (đều theo chỉ số, có trễ). */
export function createStickyIndex(n, { margin = 0.03, hyst = 0.35 } = {}) {
  let idx = -1;
  return {
    reset(start = -1) {
      idx = start;
    },
    map(relX) {
      const f = (relX - margin) / (1 - 2 * margin);
      const t = Math.min(1, Math.max(0, Number.isFinite(f) ? f : 0.5)) * (n - 1);
      if (idx < 0 || Math.abs(t - idx) > 0.5 + hyst) idx = Math.round(t);
      return idx;
    },
    get idx() {
      return idx;
    },
  };
}

/**
 * r24 — co giãn 1,3× của phần tử ở chế độ dính: { s, dx } — phóng quanh đáy giữa; nếu một phía chạm mép (màn hình / cụm
 * điều khiển bên cạnh: limits { left, right } px client, do HUD đo) thì dời ngang sang phía còn chỗ (dx) trước, chỉ khi
 * hai phía đều chật mới giảm tỉ lệ. Hai đầu thước luôn trong khung.
 * @param {HTMLElement} node phần tử được phóng (transform-origin do CSS đặt: đáy giữa)
 */
export function stickyScale(node, want = 1.3, margin = 12, limits = null) {
  const r = node.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const cx = r.left + r.width / 2;
  const L = Math.max(margin, limits?.left ?? 0);
  const R = Math.min(vw - margin, limits?.right ?? vw);
  const s = Math.max(1, Math.min(want, (R - L) / Math.max(1, r.width)));
  const hw = (s * r.width) / 2;
  let dx = 0;
  if (cx + hw > R) dx = R - (cx + hw);
  if (cx + dx - hw < L) dx = L - (cx - hw);
  return { s, dx };
}

/**
 * r29: đang KÉO camera (không phải lượt kéo của chính dòng thời gian) → dòng thời gian không hiện thẻ / kính lúp / tiêu điểm
 * theo con trỏ đi ngang: chuột đang nhấn (buttons ≠ 0 — kéo bắt đầu từ chỗ khác), view báo đang nhấn / kéo trên sân khấu
 * (.cinema[data-drag="1"] — cả nhón–kéo của lớp cử chỉ: con trỏ tổng hợp của nó nhấn lên sân khấu), hay tay
 * đang ở giữa một thao tác view quản lý (body[data-hand-busy] — nét xoa).
 * @param {HTMLElement} el phần tử dòng thời gian
 * @param {PointerEvent|null} [e] sự kiện con trỏ đang xét (nếu có)
 */
export function dragPassing(el, e = null) {
  if (e && e.buttons) return true;
  if (el?.closest?.('.cinema')?.dataset.drag === '1') return true;
  return document.body?.dataset.handBusy !== undefined;
}
