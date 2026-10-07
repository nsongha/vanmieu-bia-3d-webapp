// r71 — thông tin MỞ RỘNG của từng bia (vua, triều, niên hiệu, số dự thi / đỗ, người đỗ theo giáp, lời giới thiệu, toàn văn),
// trích từ dữ liệu văn bia đã chỉnh sửa bởi tools/extract-stele-info.mjs → src/data/stele-info/<bia-id>.json.
//
// NẠP LƯỜI theo bia: mỗi tệp là một chunk riêng (vài chục KB), chỉ tải khi bia đó được chọn — tệp nguồn 1,2 MB không bao
// giờ vào bản dựng. Bia chưa có tệp → null (giao diện giữ kiểu cũ).
// Trường không có trong nguồn mang "$verify" (tên vua suy từ niên hiệu; lời giới thiệu AI soạn) — cần đối chiếu.

/** @type {Record<string, () => Promise<object>>} */
const FILES = import.meta.glob('./stele-info/*.json', { import: 'default' });
const keyOf = (id) => `./stele-info/${id}.json`;

/** @type {Map<string, {p: Promise<object|null>, v: object|null, done: boolean}>} */
const cache = new Map();

/** Bia này có thông tin mở rộng không (biết ngay, không tải). */
export const hasSteleInfo = (id) => !!id && !!FILES[keyOf(id)];

/** Đã tải xong → dữ liệu; chưa / không có → null. */
export const peekSteleInfo = (id) => cache.get(id)?.v ?? null;

/** Tải (một lần mỗi bia) → Promise dữ liệu hoặc null. Không bao giờ reject. */
export function loadSteleInfo(id) {
  if (!hasSteleInfo(id)) return Promise.resolve(null);
  let c = cache.get(id);
  if (!c) {
    c = { p: null, v: null, done: false };
    c.p = FILES[keyOf(id)]()
      .then((v) => {
        c.v = v ?? null;
        c.done = true;
        return c.v;
      })
      .catch((err) => {
        console.warn(`[stele-info] không tải được ${id}`, err);
        c.done = true;
        return null;
      });
    cache.set(id, c);
  }
  return c.p;
}
