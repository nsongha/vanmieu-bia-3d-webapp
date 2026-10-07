// Nhận biết cử chỉ XOA (r8, "Xoa đầu rùa" của Điện ảnh) — thuần tuý, không phụ thuộc DOM / three.
//
// Mỗi khung view đưa vào một mẫu: thời điểm, vị trí (px màn hình: tâm lòng bàn tay hoặc chuột) và `ok` = mẫu này
// ĐỦ ĐIỀU KIỆN (bàn tay xoè đủ 5 ngón / chuột đang nhấn, VÀ điểm đó chạm đầu rùa). Là "đang xoa" khi trong cửa sổ
// WINDOW_MS vừa rồi:
//   · mọi mẫu đều đủ điều kiện (một khung hụt ≤ GRACE_MS thì bỏ qua, không tính là hụt);
//   · có ≥ MIN_REVERSALS lần ĐỔI CHIỀU trên cùng một trục (x hoặc y) — đổi chiều có trễ: phải lùi khỏi điểm xa
//     nhất ≥ biên độ tối thiểu mới tính, nên run tay / nhiễu điểm mốc không thành đổi chiều;
//   · quãng đường đi ≥ MIN_PATH;
//   · gọn trong một vùng nhỏ: cạnh lớn của hộp bao ≤ MAX_SPAN.
// Các ngưỡng px tính theo `scale` = bán kính đầu rùa trên màn hình (px) — xoa trên đầu rùa to hay nhỏ đều như nhau.
// Chỉ lướt qua một lượt (≤ 1 lần đổi chiều), để yên, hay xoa ngoài đầu rùa → không bao giờ là "đang xoa".

export interface RubConfig {
  windowMs: number;
  minReversals: number;
  /** Biên độ tối thiểu một nhịp (px) = max(ampMinPx, ampK · scale). */
  ampMinPx: number;
  ampK: number;
  /** Quãng đường tối thiểu trong cửa sổ (px) = max(pathMinPx, pathK · scale). */
  pathMinPx: number;
  pathK: number;
  /** Cạnh lớn nhất của vùng xoa (px) = max(spanMinPx, spanK · scale). */
  spanMinPx: number;
  spanK: number;
  /** Mẫu hụt điều kiện ngắn hơn ngần này không làm mất lịch sử (một khung điểm mốc xấu). */
  graceMs: number;
  /** Đã "đang xoa" thì giữ thêm ngần này sau khi điều kiện hình học hụt (nối liền các nhịp). */
  holdMs: number;
}

export const DEFAULT_RUB_CONFIG: RubConfig = {
  windowMs: 600,
  minReversals: 2,
  ampMinPx: 8,
  ampK: 0.1,
  pathMinPx: 50,
  pathK: 0.9,
  spanMinPx: 120,
  spanK: 3.0,
  graceMs: 100,
  holdMs: 150,
};

export interface RubReading {
  rubbing: boolean;
  /** Số lần đổi chiều trong cửa sổ (trục nhiều hơn). */
  reversals: number;
  /** Số lần đổi chiều trên trục CHÍNH (trục đổi chiều nhiều hơn) từ lúc bắt đầu chuỗi đủ điều kiện hiện tại —
   *  hai lần = một nhịp qua–lại ("lượt xoa"). Trục phụ (tay lượn nhẹ theo chiều kia) không cộng thêm. */
  totalReversals: number;
  /** Mã chuỗi: đổi mỗi lần lịch sử bị xoá (tay hụt điều kiện quá graceMs) — đếm lượt xoa theo chuỗi. */
  chain: number;
  path: number;
  span: number;
  reason: 'ok' | 'hold' | 'ineligible' | 'reversals' | 'path' | 'span';
}

interface Axis {
  ref: number;
  ext: number;
  dir: -1 | 0 | 1;
  times: number[];
}

const newAxis = (v: number): Axis => ({ ref: v, ext: v, dir: 0, times: [] });

/** Một bước của bộ đếm đổi chiều có trễ trên một trục; true = vừa đổi chiều. */
function stepAxis(a: Axis, v: number, amp: number): boolean {
  if (a.dir === 0) {
    if (v - a.ref > amp) {
      a.dir = 1;
      a.ext = v;
    } else if (a.ref - v > amp) {
      a.dir = -1;
      a.ext = v;
    }
    return false;
  }
  if (a.dir === 1) {
    if (v > a.ext) a.ext = v;
    else if (a.ext - v > amp) {
      a.dir = -1;
      a.ext = v;
      return true;
    }
    return false;
  }
  if (v < a.ext) a.ext = v;
  else if (v - a.ext > amp) {
    a.dir = 1;
    a.ext = v;
    return true;
  }
  return false;
}

export function createRubDetector(config: Partial<RubConfig> = {}) {
  const C: RubConfig = { ...DEFAULT_RUB_CONFIG, ...config };
  let samples: { t: number; x: number; y: number }[] = [];
  let ax: Axis | null = null;
  let ay: Axis | null = null;
  let lastOk = -Infinity;
  let rubUntil = -Infinity;
  let totalX = 0;
  let totalY = 0;
  let chain = 0;

  function reset() {
    if (samples.length || totalX || totalY) chain++;
    samples = [];
    ax = null;
    ay = null;
    rubUntil = -Infinity;
    totalX = 0;
    totalY = 0;
  }

  const total = () => Math.max(totalX, totalY);
  const off = (reason: RubReading['reason']): RubReading => ({ rubbing: false, reversals: 0, totalReversals: total(), chain, path: 0, span: 0, reason });

  return {
    config: C,
    reset,
    /**
     * @param t   ms
     * @param x,y px màn hình
     * @param ok  mẫu đủ điều kiện (tay xoè / chuột nhấn + chạm đầu rùa)
     * @param scale bán kính đầu rùa trên màn hình (px)
     */
    push(t: number, x: number, y: number, ok: boolean, scale: number): RubReading {
      if (!ok || !Number.isFinite(x) || !Number.isFinite(y)) {
        if (t - lastOk > C.graceMs) reset();
        return off('ineligible');
      }
      lastOk = t;
      const amp = Math.max(C.ampMinPx, C.ampK * scale);
      if (!ax || !ay) {
        ax = newAxis(x);
        ay = newAxis(y);
      }
      if (stepAxis(ax, x, amp)) {
        ax.times.push(t);
        totalX++;
      }
      if (stepAxis(ay, y, amp)) {
        ay.times.push(t);
        totalY++;
      }
      samples.push({ t, x, y });
      const from = t - C.windowMs;
      while (samples.length && samples[0].t < from) samples.shift();
      ax.times = ax.times.filter((s) => s >= from);
      ay.times = ay.times.filter((s) => s >= from);
      let path = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (i) path += Math.hypot(s.x - samples[i - 1].x, s.y - samples[i - 1].y);
        if (s.x < x0) x0 = s.x;
        if (s.x > x1) x1 = s.x;
        if (s.y < y0) y0 = s.y;
        if (s.y > y1) y1 = s.y;
      }
      const span = Math.max(x1 - x0, y1 - y0);
      const reversals = Math.max(ax.times.length, ay.times.length);
      let reason: RubReading['reason'] = 'ok';
      if (reversals < C.minReversals) reason = 'reversals';
      else if (path < Math.max(C.pathMinPx, C.pathK * scale)) reason = 'path';
      else if (span > Math.max(C.spanMinPx, C.spanK * scale)) reason = 'span';
      if (reason === 'ok') rubUntil = t + C.holdMs;
      else if (t <= rubUntil) reason = 'hold';
      // Trục chính = trục có tầm đi rộng hơn trong cửa sổ (không phải trục đổi chiều nhiều hơn: tay xoa ngang hay
      // lượn nhẹ lên xuống với tần số gấp đôi).
      const main = x1 - x0 >= y1 - y0 ? totalX : totalY;
      return { rubbing: reason === 'ok' || reason === 'hold', reversals, totalReversals: main, chain, path, span, reason };
    },
  };
}
