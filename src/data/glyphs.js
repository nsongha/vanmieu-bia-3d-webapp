// r82b → r86 — nguồn dữ liệu CHỮ HÁN dò trên bản dập (Điện ảnh, kiểu chữ sáng "Hình chữ dò" — stage/glyphs.js: thân bia sáng theo
// mặt nạ chữ sau vệt quét, chữ bay là sprite hình chữ; tạm thời tới khi có chữ Hán thật).
//
// Mỗi bia: glyphs.json (hộp chữ chuẩn hoá theo ẢNH BẢN DẬP 82 bia — models-v2/rubbings/<bia>.webp, cạnh dài 1536 px: u = x / rộng,
// v = y / cao, gốc trên trái; r = 'b' thân bia — dải tiêu đề không có chữ dò), atlas.webp (ô chữ, kênh xám = độ phủ nét), ids.webp
// (cùng cỡ ảnh bản dập; id+1 = R + 256·G, B = độ phủ nét). Cùng hệ ảnh với bản dập → toạ độ bia bằng CHÍNH phép khớp từng khúc của
// bản dập đó (rubbings.generated.json). Bia có dữ liệu chữ dò = bia có bản dập v2 (cả 82 bia), không danh sách tay:
//   · nguồn mô hình v2 — `models-v2/glyphs/bia-<năm>/` (ngoài git, đi cùng mô hình — MODELS_BASE)
//   · nguồn v1 (dự phòng, không có models-v2) — `public/glyphs/<bia>/`, chỉ bia có bản dập v1 đi kèm app (1442); mô hình v1 lệch
//     khung toạ độ so với v2 → V1_MODEL_FROM_V2
// Nạp lỗi (thiếu tệp) → kiểu Nét khắc, không báo gì (stage/glyphs.js). Mọi đường dẫn đi qua glyphAssets().
import { DATA, MODELS_BASE } from './index.js';
import { rubbingOf } from './rubbings.js';
import V2 from './rubbings.generated.json';

const BASE = (import.meta.env?.BASE_URL || './').replace(/\/?$/, '/');
/**
 * r86: khung toạ độ mô hình v1 theo mô hình v2 (x₁ = ax + kx·x₂ ; y₁ = ay + ky·y₂) — đo từ hai phép khớp ảnh bản dập v1 cũ của 1442
 * (khớp tay r74 trên mô hình v1 · khớp lại theo tương quan nét trên mô hình v2): mô hình v1 nhỏ hơn 0,74 %, lệch ~7 / 8 ‰.
 */
const V1_MODEL_FROM_V2 = { 'bia-1442': { kx: 0.99256, ax: -0.00715, ky: 0.99256, ay: 0.00799 } };

/**
 * Dữ liệu chữ Hán dò của bia `id` theo nguồn mô hình đang chạy, hoặc null nếu bia không có.
 * @param {string|null|undefined} id
 * @returns {{ json:string, atlas:string, ids:string, space:'v1'|'v2', map:{u:number[],x:number[],v:number[],y:number[]} }|null}
 *   URL tương đối với trang (như URL mô hình); space = nguồn mô hình; map = ánh xạ từng khúc uv ảnh → toạ độ bia của mô hình đang chạy
 */
export function glyphAssets(id) {
  const sp = rubbingSpace(id);
  if (!sp) return null;
  const dir = sp.space === 'v2' ? `${MODELS_BASE}glyphs/${id}/` : `${BASE}glyphs/${id}/`;
  return { json: `${dir}glyphs.json`, atlas: `${dir}atlas.webp`, ids: `${dir}ids.webp`, ...sp };
}

/**
 * r87: hệ ảnh bản dập 82 bia của bia `id` → toạ độ bia của MÔ HÌNH đang chạy (dùng chung cho chữ dò + chữ Hán số hoá — cùng hệ ảnh):
 * { space: 'v1' | 'v2' (nguồn mô hình), map: ánh xạ từng khúc uv ảnh → toạ độ bia } | null (bia không có bản dập ở nguồn đang chạy).
 */
export function rubbingSpace(id) {
  const g = id ? V2.steles?.[id] : null;
  if (!g?.map) return null;
  const r = rubbingOf(id);
  if (!r) return null;
  if (r.src === 'v2') return { space: 'v2', map: g.map };
  const t = V1_MODEL_FROM_V2[id];
  return { space: 'v1', map: t ? { ...g.map, x: g.map.x.map((x) => t.ax + t.kx * x), y: g.map.y.map((y) => t.ay + t.ky * y) } : g.map };
}

/** Bia `id` có dữ liệu chữ Hán dò không (không nạp gì). */
export const hasGlyphs = (id) => !!glyphAssets(id);
