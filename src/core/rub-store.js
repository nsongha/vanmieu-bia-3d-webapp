// Lưu "độ bóng đã xoa" của đầu rùa (chế độ Điện ảnh → Xoa đầu rùa) theo từng bia, trong localStorage của
// trình duyệt: đầu rùa trên máy kiosk bóng dần lên qua nhiều ngày, như đầu rùa đá thật.
//
// Dạng lưu (gọn): { v: 1, s: { "bia-1661": { n: số lượt xoa, p: [[x, y, z, r, s], …] } } }
//   x, y, z, r: toạ độ / bán kính vết trong mô hình (4 chữ số lẻ), s: độ mạnh 0..1 (3 chữ số lẻ).
// Mọi truy cập localStorage đều bọc try/catch (chế độ riêng tư / bị chặn → chỉ không lưu được).

const KEY = 'vm.rub.v1';

/**
 * Tổng độ mạnh các vết (Σ strength·gauss) mà tại đó chỗ xoa đạt bóng TỐI ĐA (shader: smoothstep(0, SAT, Σ)).
 * Dùng chung cho shader (views/cinema/polish.js) và gợi ý "≈ N lượt xoa" ở bảng Cài đặt.
 */
export const RUB_POLISH_SAT = 0.7;
/**
 * Mỗi LƯỢT XOA đi qua một chỗ HAI lần (qua + lại); mỗi lần qua, mọi vết dọc đường nhận đúng settings.rubStrength
 * (rub.js chia theo quãng đường / bán kính vết). Vết cách nhau ~½ bán kính dọc đường xoa nên tổng Σ tại một điểm ≈
 * RUB_OVERLAP × độ mạnh của một vết — đo bằng mô phỏng (vm.cinemaRub.hand({ sample: 1 }), tay xoa qua lại tại chỗ).
 */
export const RUB_OVERLAP = 1.2; // đo (r9): bia-1661 1,4 · bia-1727 1,08 (xoa ±0,55 bán kính đầu, 2,5 Hz) → lấy giữa
/** Số lượt xoa (qua–lại) để một chỗ đạt bóng tối đa với độ mạnh `strength` mỗi lần qua. */
export const rubLapsToMax = (strength) =>
  Math.max(1, Math.ceil(RUB_POLISH_SAT / (2 * RUB_OVERLAP * Math.max(1e-4, strength))));
const EVENT = 'vm:rub-cleared';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : null;
    return d && d.v === 1 && d.s && typeof d.s === 'object' ? d : { v: 1, s: {} };
  } catch {
    return { v: 1, s: {} };
  }
}

function writeAll(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

const isSplat = (a) => Array.isArray(a) && a.length === 5 && a.every((v) => Number.isFinite(v));

/** Vết + số lượt xoa đã lưu của một bia ({ n: 0, p: [] } nếu chưa có). */
export function loadRub(id) {
  const e = readAll().s[id];
  return { n: Number.isFinite(e?.n) ? e.n : 0, p: Array.isArray(e?.p) ? e.p.filter(isSplat) : [] };
}

/** Ghi vết + số lượt xoa của một bia. */
export function saveRub(id, entry) {
  const d = readAll();
  if (!entry || (!entry.n && !entry.p?.length)) delete d.s[id];
  else d.s[id] = { n: entry.n | 0, p: entry.p ?? [] };
  return writeAll(d);
}

/** Xoá độ bóng đã xoa của MỌI bia; báo cho view đang mở (nếu có) để tẩy luôn trên màn hình. */
export function clearAllRub() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* không lưu được thì cũng không có gì để xoá */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Nghe sự kiện "đã xoá hết độ bóng"; trả về hàm huỷ. */
export function onRubCleared(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Tổng quan (bảng Cài đặt): số bia có độ bóng, tổng lượt xoa. */
export function rubSummary() {
  const s = readAll().s;
  const ids = Object.keys(s);
  return { steles: ids.length, rubs: ids.reduce((a, id) => a + (s[id]?.n | 0), 0) };
}
