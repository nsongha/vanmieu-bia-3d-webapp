// Các dòng "khoa thi / niên hiệu / …" của một tấm bia — MỘT nguồn duy nhất cho tấm trượt DOM
// (màn cảm ứng) và cho các kiểu hiện thông tin (ctx.facts). Giá trị là CHỮ THUẦN: nơi dùng tự
// gán bằng textContent hoặc tự escape. Không có thông số kỹ thuật file 3D.
import { DOT_LABEL } from '../../data/index.js';

/** r21: dòng thay cho phần lịch sử còn thiếu (72 / 82 bia v2 chưa có dữ liệu) — lặng lẽ, không bịa. */
export const PENDING = 'Chờ dữ liệu';

/** Bia có dữ liệu lịch sử (niên hiệu, vua, số đỗ, đợt dựng, mô tả…) — bia.json; bia v2 khác chỉ có năm / can chi / số thứ tự. */
export const hasHistory = (b) => !!b && b.hasData !== false && b.nienHieu != null;

/**
 * @param {object} b mục bia (xem src/data/index.js)
 * @returns {{label:string, value:string}[]} chỉ các dòng CÓ giá trị (không nhãn rỗng, không "undefined")
 */
export function factsOf(b) {
  if (!b) return [];
  const rows = [{ label: 'Khoa thi', value: `${b.year} · ${b.canChi}` }];
  if (!hasHistory(b)) {
    if (b.stt) rows.push({ label: 'Bia số', value: String(b.stt) });
    return rows;
  }
  const add = (label, v) => {
    if (v != null && String(v).trim() !== '') rows.push({ label, value: String(v) });
  };
  add('Niên hiệu', b.nienHieu);
  add('Triều vua', b.vua);
  add('Số người đỗ', b.soDo != null ? `${b.soDo} tiến sĩ` : null);
  add('Đỗ đầu', b.dauKhoa);
  add('Đợt dựng bia', DOT_LABEL[b.dot]);
  add('Dựng năm', b.dung);
  return rows;
}
