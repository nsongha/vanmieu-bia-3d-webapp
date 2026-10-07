// r83 — NGUỒN BẢN DẬP theo nguồn mô hình (Điện ảnh: quét bản dập trên mặt bia — stage/scan.js).
//
//   · v2 (82 bia, mô hình ở models-v2/): ảnh `models-v2/rubbings/bia-<năm>.webp` (ngoài git, đi cùng mô hình — MODELS_BASE), MỘT tệp
//     cho cả hai khe của shader: alpha = mặt nạ vòm, độ sáng (R = G = B) = bản đồ nét. Phép khớp (từng khúc mỗi trục) + khung mặt:
//     src/data/rubbings.generated.json (tools/fit-rubbings.mjs, sửa tay ở rubbings.overrides.json).
//   · v1 (10 bia dự phòng ở public/models): chỉ bia 1442 — `public/rubbings/bia-1442*.webp` + src/data/rubbings.json (khớp affine
//     tay r74, hai tệp ảnh màu + nét). Bia v1 khác: không có bản dập.
// r84: + plane (v2) — mặt phẳng mặt bia đo từ mô hình (z = z0 + kx·x + ky·y, dải lệch back / front): bản dập / vệt / chữ Hán chỉ nằm
//     trên lớp mặt đó (shader polish.js); v1 / thiếu: null (shader dùng mặt phẳng trước zFront của mô hình).
// Mọi đường dẫn / dữ liệu bản dập đi qua rubbingOf().
import { DATA, MODELS_BASE } from './index.js';
import V1 from './rubbings.json';
import V2 from './rubbings.generated.json';

const BASE = (import.meta.env?.BASE_URL || './').replace(/\/?$/, '/');

/** Ánh xạ từng khúc 4 mốc (u, x tăng dần — xem tools/fit-rubbings.mjs) từ một phép affine x = x0 + (u − u0)·sx ; y = y0 − (v − v0)·sy. */
function mapFromFit(f) {
  const U = [0, 0.25, 0.75, 1];
  const Vd = [1, 0.75, 0.25, 0]; // v giảm dần ↔ y tăng dần
  return { u: U, x: U.map((u) => f.x0 + (u - f.u0) * f.sx), v: Vd, y: Vd.map((v) => f.y0 - (v - f.v0) * f.sy) };
}

/**
 * Bản dập của bia `id` theo nguồn mô hình đang chạy, hoặc null.
 * @returns {{ id:string, src:'v1'|'v2', tex:string, strokes:string|null, img:[number,number], map:{u:number[],x:number[],v:number[],y:number[]},
 *   frame:{left:number,right:number,bottom:number,spring:number,top:number}, plane:{z0,kx,ky,back,front}|null, resid?:object }|null}
 *   tex / strokes: URL (tương đối với trang — như URL mô hình); strokes null = cùng tệp với tex (alpha mặt nạ + R nét)
 */
export function rubbingOf(id) {
  if (!id) return null;
  if (DATA.source === 'v2') {
    const g = V2.steles?.[id];
    if (!g?.map || !g.frame) return null;
    return { id, src: 'v2', tex: MODELS_BASE + (V2.file ?? 'rubbings/{id}.webp').replace('{id}', id), strokes: null, img: g.img, map: g.map, frame: g.frame, plane: g.plane ?? null, resid: g.resid };
  }
  const d = V1[id];
  if (!d || typeof d !== 'object' || !d.fit) return null;
  return { id, src: 'v1', tex: BASE + d.tex, strokes: d.strokes ? BASE + d.strokes : null, img: d.img, map: mapFromFit(d.fit), frame: d.frame, plane: null };
}

/** Bia có bản dập trong nguồn đang chạy (không nạp gì). */
export const hasRubbing = (id) => !!rubbingOf(id);
