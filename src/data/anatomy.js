// Chú giải các bộ phận của một tấm bia tiến sĩ — dùng chung cho mọi bia (không phụ thuộc từng khoa thi).
// Toạ độ neo (u, v) chuẩn hoá theo hộp bao của PHIẾN BIA trên mặt phẳng bia:
//   u: -1 = mép trái, 0 = giữa, +1 = mép phải;  v: 0 = chân đế (mặt sàn), 1 = đỉnh vòm.
// Nội dung mang tính khái quát, CẦN đối chiếu tư liệu Văn Miếu trước khi công bố.
export const STELE_ANATOMY = Object.freeze([
  {
    id: 'tran',
    label: 'Trán bia',
    text: 'Phần vòm trên cùng, thường chạm mặt trời giữa mây, rồng hoặc hoa lá.',
    anchor: { u: 0, v: 0.93 },
  },
  {
    id: 'diem',
    label: 'Diềm bia',
    text: 'Dải viền quanh mặt bia, trang trí hoa dây, sóng nước.',
    anchor: { u: -0.86, v: 0.6 },
  },
  {
    id: 'than',
    label: 'Thân bia',
    text: 'Khắc bài ký về khoa thi và danh sách tiến sĩ, ghi rõ tên, quê quán.',
    anchor: { u: -0.3, v: 0.55 },
  },
  {
    id: 'rua',
    label: 'Rùa đội bia',
    text: 'Rùa, một trong tứ linh, tượng trưng cho sự trường tồn của danh hiền tài.',
    anchor: { u: -0.35, v: 0.1 },
  },
]);
