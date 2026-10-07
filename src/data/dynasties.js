// Các triều đại trong khoảng năm của 82 bia (dòng thời gian Điện ảnh — kiểu "Hai tầng" và "Chương triều đại").
//
// ⚠ CẦN CHUYÊN GIA KIỂM ĐỊNH. Mốc năm dưới đây là mốc thông dụng, dùng để VẼ GIAI ĐOẠN, không phải để quy khoa thi
// nào cho triều nào:
//   · Lê sơ 1428–1527.
//   · Mạc 1527–1592 (đóng đô Thăng Long).
//   · Lê trung hưng 1533–1789 — CHỒNG với Mạc 1533–1592 (thời Nam – Bắc triều: Lê ở phía nam, Mạc ở Thăng Long).
// Dòng thời gian vẽ phần chồng đó đúng như nó là (một dải phụ gạch chéo "Nam – Bắc triều"), không cắt gọn thành ba
// đoạn nối tiếp. Tệp này KHÔNG tự quy khoa thi nào cho triều nào. r78: tools/extract-stele-info.mjs chuẩn hóa trường
// `dynasty` của dữ liệu văn bia về id / tên ở đây; chỉ khi nguồn ghi mơ hồ ("Nhà Lê", "Hậu Lê", "Triều Lê", "Hoàng Lê"…)
// mới dùng periodsOf(năm thi) để suy giai đoạn, và đánh dấu "cần đối chiếu" (dynastyVerify / $verify.dynasty).

/** @typedef {{ id: string, name: string, from: number, to: number, note?: string }} Dynasty */

/** @type {readonly Dynasty[]} theo thứ tự bắt đầu */
export const DYNASTIES = Object.freeze([
  Object.freeze({ id: 'le-so', name: 'Lê sơ', from: 1428, to: 1527 }),
  Object.freeze({ id: 'mac', name: 'Mạc', from: 1527, to: 1592, note: 'đóng đô Thăng Long' }),
  Object.freeze({ id: 'le-trung-hung', name: 'Lê trung hưng', from: 1533, to: 1789 }),
]);

/** Giai đoạn hai triều cùng tồn tại (Lê trung hưng ở phía nam, Mạc ở Thăng Long). */
export const OVERLAP = Object.freeze({ id: 'nam-bac', label: 'Nam – Bắc triều', from: 1533, to: 1592, a: 'mac', b: 'le-trung-hung' });

/** Các triều mà năm `y` nằm trong giai đoạn của nó (tính cả hai mốc; năm trong phần chồng / đúng mốc thuộc cả hai). */
export function periodsOf(y) {
  return DYNASTIES.filter((d) => y >= d.from && y <= d.to).map((d) => d.id);
}
