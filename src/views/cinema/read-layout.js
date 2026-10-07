// r84 — ô tấm đọc toàn văn (px client) theo cỡ khung: một hàm thuần dùng chung cho lớp đọc (info/rich/reader.js — layoutRect) và
// sân khấu (stage/read.js — camera NHÍCH vào khung đọc lúc đang giữ, trước khi lớp đọc mở: đích phải trùng khung đọc thật để đoạn
// tiến vào đi tiếp đúng đường, đúng vận tốc).
// W, H: cỡ lớp phủ đọc (cả khung nhìn); left, top: góc trên trái của nó. hv: chiều cao "đọc" cũ (r77 — canh giữa mục lục / thẻ tiêu đề).
export function readerRect(W, H, left = 0, top = 0) {
  const w = Math.round(Math.min(1440, Math.max(620, W * 0.6), W - 2 * 150));
  const t = Math.round(Math.min(104, Math.max(56, H * 0.095)));
  const bottom = Math.round(Math.min(230, Math.max(120, H * 0.18)));
  // r77: tấm chạy tới mép dưới khung
  return { x: Math.round(left + (W - w) / 2), y: Math.round(top + t), w, h: Math.round(H - t), hv: Math.round(H - t - bottom) };
}
