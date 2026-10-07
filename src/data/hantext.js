// r87 — nguồn dữ liệu CHỮ HÁN SỐ HOÁ (Điện ảnh, kiểu chữ sáng "Chữ Hán (số hoá)" — stage/glyphs.js): quét = "số hoá" nội dung bia —
// hiện chữ Hán dạng chữ đánh máy (văn bản đã chép + hiệu đính, căn từng chữ vào lưới cột / ô trên bản dập), KHÔNG chép hình bản dập.
// Chỉ đặt chữ có độ tin cậy căn chỉnh ≥ ngưỡng (Cài đặt "Độ tin cậy tối thiểu"); chỗ chưa chắc: Nét khắc (đèn xiên + hạt sáng).
//
// Mỗi bia: public/hantext/<bia>/{chars.json, atlas.webp} (tools/pack-hantext.py) — chars.json: hộp ô chữ chuẩn hoá theo ảnh bản dập
// 82 bia (cùng hệ với models-v2/rubbings + dữ liệu chữ dò) + ô atlas; atlas.webp: chữ dựng bằng font (xám = độ phủ). Văn bản: bản
// Viện Nghiên cứu Hán Nôm (qua bản chép trên mạng, đối chiếu chéo) — cần đối chiếu; không hiện nguồn cho khách ($doc).
// Font dựng atlas hiện là Songti TC (font hệ thống Apple — giấy phép phân phối hình chữ chưa rõ): thay bằng font OFL trước khi triển khai.
import { rubbingSpace } from './glyphs.js';

const BASE = (import.meta.env?.BASE_URL || './').replace(/\/?$/, '/');
/** Bia đã có văn bản chữ Hán căn chỉnh. */
const HAN_STELES = new Set(['bia-1442']);

/**
 * Dữ liệu chữ Hán số hoá của bia `id`, hoặc null.
 * @returns {{ json:string, atlas:string, space:'v1'|'v2', map:{u:number[],x:number[],v:number[],y:number[]} }|null}
 */
export function hanAssets(id) {
  if (!id || !HAN_STELES.has(id)) return null;
  const sp = rubbingSpace(id);
  if (!sp) return null;
  const dir = `${BASE}hantext/${id}/`;
  return { json: `${dir}chars.json`, atlas: `${dir}atlas.webp`, ...sp };
}

/** Bia `id` có chữ Hán số hoá không (không nạp gì). */
export const hasHanText = (id) => !!hanAssets(id);
