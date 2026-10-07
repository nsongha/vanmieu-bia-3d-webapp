// Danh sách người đỗ theo từng bia (dùng cho lớp "tên trên thân bia" ở chế độ Điện ảnh).
//
// DỮ LIỆU THẬT: điền vào LAUREATES_REAL theo id bia, ví dụ:
//   'bia-1442': [
//     { title: 'Trạng nguyên', name: 'Nguyễn Trực' },
//     { title: 'Bảng nhãn', name: '…' },
//     { title: 'Tiến sĩ', name: '…' },
//   ]
// Phần tử đầu tiên là người đỗ đầu. Khi một bia có dữ liệu thật, danh sách mẫu bị bỏ qua.
//
// DỮ LIỆU MẪU: khi chưa có dữ liệu thật, getLaureates() sinh tên MẪU (không phải người thật)
// đúng số lượng `soDo`, cố định theo id bia, và đánh dấu `sample: true` để giao diện hiện nhãn
// "Tên mẫu". Người đỗ đầu lấy từ `dauKhoa` (r78: catalog.generated.json — rút từ dữ liệu văn bia). Từ r78 cả 82 bia đều có
// tên thật trong laureates.generated.json nên nhánh tên mẫu chỉ còn dùng khi thiếu tệp đó.

// r71: tên THẬT trích từ dữ liệu văn bia đã chỉnh sửa (tools/extract-stele-info.mjs → laureates.generated.json).
import GENERATED from './laureates.generated.json';

export const LAUREATES_REAL = Object.fromEntries(Object.entries(GENERATED).filter(([k, v]) => !k.startsWith('$') && Array.isArray(v)));

const TITLE_PREFIXES = ['Trạng nguyên', 'Bảng nhãn', 'Thám hoa', 'Hoàng giáp'];

/** Tách "Trạng nguyên Nguyễn Trực" → { title, name }. */
function splitTitle(s) {
  if (!s) return null;
  for (const t of TITLE_PREFIXES) {
    if (s.startsWith(t + ' ')) return { title: t, name: s.slice(t.length + 1).trim() };
  }
  return { title: 'Đỗ đầu', name: s.trim() };
}

// Bộ họ/tên để ghép tên MẪU (chỉ phục vụ thử giao diện).
const HO = ['Nguyễn', 'Lê', 'Trần', 'Phạm', 'Đỗ', 'Vũ', 'Hoàng', 'Bùi', 'Đặng', 'Ngô', 'Dương', 'Lương', 'Đào', 'Phan', 'Đinh', 'Trịnh', 'Hà', 'Lý'];
const DEM = ['Văn', 'Đình', 'Duy', 'Như', 'Công', 'Hữu', 'Đức', 'Quang', 'Thế', 'Trọng', 'Doãn', 'Khắc', 'Tất', 'Nhân'];
const TEN = ['Thực', 'Khuê', 'Tông', 'Hiến', 'Trứ', 'Lượng', 'Mẫn', 'Toại', 'Cẩn', 'Diễn', 'Tuấn', 'Thụy', 'Uyên', 'Bật', 'Chiêu', 'Dụng', 'Hạo', 'Kiên', 'Lâm', 'Phác', 'Quý', 'Tảo', 'Triệt', 'Vỹ'];

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

/**
 * @param {{id:string, soDo:number, dauKhoa:string|null}} entry
 * @returns {{ top: {title:string,name:string}|null, rest: {title:string,name:string}[], sample: boolean }}
 */
export function getLaureates(entry) {
  const real = LAUREATES_REAL[entry.id];
  if (real && real.length) return { top: real[0], rest: real.slice(1), sample: false };
  // r21: bia chưa có dữ liệu lịch sử (v2) — không có số người đỗ / người đỗ đầu để dựng cả tên mẫu → không hiện tên nào
  if (entry.hasData === false || entry.soDo == null) return { top: null, rest: [], sample: true, pending: true };

  const rnd = seeded(entry.id);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const used = new Set();
  const makeName = () => {
    for (let i = 0; i < 20; i++) {
      const n = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    return `${pick(HO)} ${pick(TEN)}`;
  };

  const top = splitTitle(entry.dauKhoa) ?? { title: 'Đỗ đầu', name: makeName() };
  used.add(top.name);
  const total = Math.max(1, entry.soDo | 0);
  const rest = [];
  // Cơ cấu mẫu: sau người đỗ đầu là Đệ nhất giáp (nếu đầu khoa là Trạng nguyên), rồi Hoàng giáp, rồi Tiến sĩ.
  if (top.title === 'Trạng nguyên') {
    if (total > 1) rest.push({ title: 'Bảng nhãn', name: makeName() });
    if (total > 2) rest.push({ title: 'Thám hoa', name: makeName() });
  }
  const remaining = total - 1 - rest.length;
  const hoangGiap = Math.round(remaining * 0.25);
  for (let i = 0; i < remaining; i++) rest.push({ title: i < hoangGiap ? 'Hoàng giáp' : 'Tiến sĩ', name: makeName() });
  return { top, rest, sample: true };
}
