#!/usr/bin/env node
// r71 → r78 — trích thông tin mở rộng của văn bia từ tệp dữ liệu 82 văn bia (data/82-van-bia-tien-si.json — dữ liệu người
// dùng đã chỉnh sửa, CHỈ ĐỌC) ra các tệp JSON nhỏ:
//
//   src/data/stele-info/<bia-id>.json   — trang thông tin mở rộng, NẠP LƯỜI theo bia (vua, triều, niên hiệu, số dự thi / đỗ,
//                                          người đỗ theo giáp, lời giới thiệu, toàn văn đã tách đoạn / lạc khoản / đề danh)
//   src/data/laureates.generated.json   — tên người đỗ THẬT cho lớp "tên trên thân bia" (src/data/laureates.js)
//   src/data/catalog.generated.json     — r78: trường danh mục (nienHieu, vua, dot, dung, soDo, dauKhoa, soanVan, mota…) cho
//                                          src/data/index.js — thay các giá trị AI cũ của bia.json
//
// Không bịa: mọi trường lấy nguyên từ mục nguồn. Các chỗ suy ra / tổng hợp (không có sẵn 1-1 trong nguồn) đều đánh dấu rõ:
//   · king       — tên vua suy từ niên hiệu trong `title` qua bảng ERA_KING bên dưới → "$verify": "cần đối chiếu — <lý do>";
//                  niên hiệu không chắc → king: null (không đoán)
//   · dynasty    — r78: nhãn hiển thị chuẩn hóa theo src/data/dynasties.js (Lê sơ / Mạc / Lê trung hưng); dynastyRaw giữ
//                  nguyên văn nguồn. Nguồn mơ hồ ("Nhà Lê", "Hậu Lê", "Triều Lê", "Hoàng Lê", tên vua…) → suy giai đoạn từ
//                  năm thi theo mốc của dynasties.js → dynastyVerify "cần đối chiếu — …"
//   · canChi     — tách từ `title`; tiêu đề không có / lệch với can chi TÍNH TỪ NĂM (chu kỳ 60 năm, cùng quy tắc
//                  tools/v2/catalog.mjs) thì canChi = can chi tính từ năm (chỉ là dữ liệu), giữ bản tiêu đề ở canChiTitle và báo
//                  bất thường. r79 (người dùng): giao diện HIỆN canChiTitle (như tiêu đề bia) ở mọi chỗ; canChiNote = NGUYÊN VĂN
//                  ghi chú lịch sử (historical_notes) nhắc cả hai can chi — chú thích gạch chấm trên chữ can chi ở giao diện.
//                  catalog.generated.json mang canChiTitle cho danh mục (src/data/index.js)
//   · content.kind — r79: 'description' khi `content` của nguồn là bài MÔ TẢ BIA hiện đại (bảo tàng), không phải bản dịch văn
//                  bia — bảng CONTENT_KIND (đã đọc tay); giao diện gọi phần đó là "Mô tả bia", không gọi "Toàn văn bia"
//   · intro      — lời giới thiệu ngắn do AI soạn CHỈ từ dữ liệu của chính mục đó (tools/stele-intros.json)
//                  → "$verify": "AI soạn, cần đối chiếu"
//   · notes[].anchor   — vị trí đoạn/lạc khoản/đề danh khớp với ghi chú: bảng ANCHOR_OVERRIDE (đã đọc tay) hoặc heuristic
//                        (khớp nguyên văn đoạn trích trong ngoặc → khớp nguyên văn thuật ngữ → điểm từ khóa chặt); yếu thì
//                        KHÔNG gán anchor (UI liệt kê ghi chú đó ngay sau Bài ký)
//   · notes[].labelKind — r80: 'title' khi nhãn là tiêu đề / câu tóm tắt đứng riêng được (bảng LABEL_TITLE, đã phân loại tay
//                        37 nhãn) — giao diện tách nhãn chữ hoa nhỏ + thân; ngược lại 'inline' (vế dẫn "… gồm", "… là") — giao diện
//                        hiện cả ghi chú thành MỘT câu liền nguyên văn; ghi chú không nhãn cũng là một câu liền
//   · notes[].kind     — 'gloss' (ghi chú giải nghĩa thuật ngữ) chỉ khi nhãn/từng mục trong danh sách xuất hiện NGUYÊN
//                        VĂN trong nội dung bia; ngược lại là 'note'. terms[].def lấy nguyên văn từ chính historical_note
//   · credits          — rút thẳng từ `contributors`, bỏ "Không ghi"/rỗng/null; không suy diễn gì thêm
//   · crossRefs        — chỉ nêu SỰ TRÙNG TÊN giữa các mục trong chính tệp dữ liệu (cùng vai trò), KHÔNG khẳng định là
//                        cùng một người → luôn kèm "$note": "trùng tên trong dữ liệu"
//   · laureates[].title  — chữ trong (...) của `rank` khi là danh hiệu (Trạng nguyên, Hoàng giáp, Đình nguyên…), chỉ chuẩn
//                        hóa hoa-thường; (...) chỉ nhắc lại tên giáp ("Đồng Tiến sĩ xuất thân") thì không phải danh hiệu
//   · laureates[].tier   — từ "Đệ nhất/nhị/tam giáp" của `rank`; rank không ghi giáp nhưng danh hiệu trùng đúng một giáp ở
//                        các mục khác (vd "Đồng Tiến sĩ xuất thân" ↔ Đệ tam giáp) → suy giáp, kèm tierVerify "cần đối chiếu"
//   · laureates[].honors — chuỗi trong dấu [...] của `rank`, chỉ tách/chuẩn hóa hoa-thường, không thêm định nghĩa
//   · tiers[].label      — danh hiệu giáp lấy từ `rank` của chính mục (Chế khoa ≠ Tiến sĩ); không có thì dùng TIER_LABEL
//   · passRate         — chỉ tính khi cả candidates_count và passed_count/total_laureates đều là số nguyên chính xác
//                        (không phải "hơn", "trên", "gần", "Không ghi", số viết chữ…); ratio/oneIn/phrase suy từ 2 số đó
//   · erection         — year/raw lấy từ erection_year (year = số có 4 chữ số ĐẦU TIÊN trong chuỗi, raw = nguyên chuỗi
//                        nguồn); gap = year - year thi; batch = liệt kê các mục khác có CÙNG year suy ra như trên
//   · stories[] / authorBio — build từ chính `biographies` của mục này, description giữ NGUYÊN VĂN; links chỉ tạo khi
//                        năm 4 chữ số nhắc tới trong description KHÁC năm khoa thi này VÀ có mặt trong danh sách 82 mục
//                        (không tự suy luận năm không có bia) → mỗi link kèm "$verify": "cần đối chiếu"
//   · catalog (r78)    — nienHieu = niên hiệu + năm thứ trong tiêu đề; vua = king (cần đối chiếu); dung = năm dựng (erection);
//                        dot = đợt dựng theo khoảng năm của DOT_LABEL (src/data/index.js); soDo = số đỗ; dauKhoa = danh hiệu
//                        + tên người đỗ đầu tiên trong `laureates`; soanVan = contributors.author; mota = câu đầu của intro
//                        (AI soạn → $verify)
//
// Chạy:  node tools/extract-stele-info.mjs --all        (cả 82 mục + bảng kiểm tra; ghi lại mọi tệp sinh)
//        node tools/extract-stele-info.mjs 1442 1463    (chỉ các năm này; laureates / catalog được cập nhật tại chỗ)
//        thêm --quiet để bỏ bảng kiểm tra, --json <tệp> để ghi kết quả kiểm tra ra JSON
// Kết quả xác định (deterministic): chạy lại cho ra đúng từng byte (không ghi thời gian, khóa sắp theo năm).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DYNASTIES, periodsOf } from '../src/data/dynasties.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/82-van-bia-tien-si.json');
const INTROS = path.join(ROOT, 'tools/stele-intros.json');
const OUT_DIR = path.join(ROOT, 'src/data/stele-info');
const OUT_NAMES = path.join(ROOT, 'src/data/laureates.generated.json');
const OUT_CATALOG = path.join(ROOT, 'src/data/catalog.generated.json');

/**
 * Niên hiệu → vua. KHÔNG có trong nguồn (kiến thức chung) — mọi mục đều "cần đối chiếu". `why` = lý do một dòng.
 * name: null = không chắc / mâu thuẫn với dữ liệu → không gán vua (xem why).
 */
const WHY = (era) => `suy từ niên hiệu ${era} trong tiêu đề`;
const ERA_KING = {
  'Đại Bảo': { name: 'Lê Thái Tông', why: 'suy từ niên hiệu Đại Bảo trong tiêu đề; văn bia gọi "Thái Tông Văn hoàng đế"' },
  'Thái Hòa': { name: 'Lê Nhân Tông', why: WHY('Thái Hòa') },
  'Quang Thuận': { name: 'Lê Thánh Tông', why: WHY('Quang Thuận') },
  'Hồng Đức': { name: 'Lê Thánh Tông', why: WHY('Hồng Đức') },
  'Cảnh Thống': { name: 'Lê Hiến Tông', why: WHY('Cảnh Thống') },
  'Hồng Thuận': { name: 'Lê Tương Dực', why: WHY('Hồng Thuận') },
  'Quang Thiệu': { name: 'Lê Chiêu Tông', why: WHY('Quang Thiệu') },
  'Minh Đức': { name: 'Mạc Thái Tổ (Mạc Đăng Dung)', why: WHY('Minh Đức') },
  'Thuận Bình': { name: 'Lê Trung Tông', why: WHY('Thuận Bình') },
  'Chính Trị': { name: 'Lê Anh Tông', why: WHY('Chính Trị') },
  'Gia Thái': { name: 'Lê Thế Tông', why: WHY('Gia Thái') },
  'Quang Hưng': { name: 'Lê Thế Tông', why: WHY('Quang Hưng') },
  // Hưng Trị: theo hiểu biết chung là niên hiệu nhà Mạc (Mạc Mậu Hợp), nhưng văn bia nhắc "Thế Tông Nghị hoàng đế" và
  // historical_notes ghi "đời vua Lê Thế Tông" → mâu thuẫn, không gán vua.
  'Hưng Trị': { name: null, why: 'niên hiệu Hưng Trị trong tiêu đề — theo hiểu biết chung là niên hiệu nhà Mạc, nhưng văn bia nhắc "Thế Tông Nghị hoàng đế" và ghi chú của dữ liệu ghi "đời vua Lê Thế Tông": mâu thuẫn, để trống' },
  'Hoằng Định': { name: 'Lê Kính Tông', why: WHY('Hoằng Định') },
  'Vĩnh Tộ': { name: 'Lê Thần Tông', why: WHY('Vĩnh Tộ') },
  'Đức Long': { name: 'Lê Thần Tông', why: WHY('Đức Long') },
  'Dương Hòa': { name: 'Lê Thần Tông', why: WHY('Dương Hòa') },
  'Phúc Thái': { name: 'Lê Chân Tông', why: WHY('Phúc Thái') },
  'Khánh Đức': { name: 'Lê Thần Tông', why: `${WHY('Khánh Đức')} (lần trị vì thứ hai)` },
  'Thịnh Đức': { name: 'Lê Thần Tông', why: `${WHY('Thịnh Đức')} (lần trị vì thứ hai)` },
  'Vĩnh Thọ': { name: 'Lê Thần Tông', why: `${WHY('Vĩnh Thọ')} (lần trị vì thứ hai)` },
  'Cảnh Trị': { name: 'Lê Huyền Tông', why: WHY('Cảnh Trị') },
  'Dương Đức': { name: 'Lê Gia Tông', why: WHY('Dương Đức') },
  'Vĩnh Trị': { name: 'Lê Hy Tông', why: WHY('Vĩnh Trị') },
  'Chính Hòa': { name: 'Lê Hy Tông', why: WHY('Chính Hòa') },
  'Vĩnh Thịnh': { name: 'Lê Dụ Tông', why: WHY('Vĩnh Thịnh') },
  'Bảo Thái': { name: 'Lê Dụ Tông', why: WHY('Bảo Thái') },
  'Vĩnh Khánh': { name: 'Lê Duy Phường', why: `${WHY('Vĩnh Khánh')} (vua sau bị phế, sử gọi Hôn Đức công)` },
  'Long Đức': { name: 'Lê Thuần Tông', why: WHY('Long Đức') },
  'Vĩnh Hựu': { name: 'Lê Ý Tông', why: WHY('Vĩnh Hựu') },
  'Cảnh Hưng': { name: 'Lê Hiển Tông', why: WHY('Cảnh Hưng') },
};

/**
 * r73 — vị trí (đoạn thân bia / lạc khoản / đề danh) khớp với từng historical_note, đã ĐỌC LẠI toàn văn để xác nhận
 * bằng tay. Khóa theo năm, mảng cùng thứ tự với historical_notes của mục đó trong nguồn. Mỗi phần tử: anchor object,
 * hoặc null nếu đã xem xét nhưng không đủ tin cậy (cố tình bỏ qua). Năm/ghi chú KHÔNG có trong bảng này thì dùng
 * heuristic tự động (xem buildAnchor) — chưa được người kiểm chứng tay.
 */
const ANCHOR_OVERRIDE = {
  1442: [
    // note 0 "Câu nói nổi tiếng: …": câu trích xuất hiện nguyên văn ở đoạn 5 (index 4), ngay sau đoạn nói về việc dựng bia.
    { section: 'body', para: 4, match: 'Hiền tài là nguyên khí của quốc gia, nguyên khí thịnh thì thế nước mạnh mà hưng thịnh, nguyên khí suy thì thế nước yếu mà thấp hèn.' },
    // note 1 "Khoa thi Nhâm Tuất … khoa đầu tiên …": đoạn 3 (index 2) là chỗ duy nhất gọi khoa này là "khoa thi đầu tiên";
    // năm dựng bia 1484 cũng xuất hiện ở lạc khoản nhưng không nói "đầu tiên" nên chọn đoạn thân bia làm anchor chính.
    { section: 'body', para: 2, match: 'khoa thi đầu tiên đời thánh triều được ơn vinh long trọng' },
    // note 2 "Vua Lê Thánh Tông đã chuẩn tấu đổi danh hiệu …": khớp gần nguyên văn đoạn 4 (index 3), đúng câu xin đổi
    // Trạng nguyên/Bảng nhãn/Thám hoa lang → Tiến sĩ cập đệ, Phụ bảng → đồng Tiến sĩ xuất thân.
    { section: 'body', para: 3, match: 'danh hiệu Trạng nguyên, Bảng nhãn, Thám hoa lang đổi làm Tiến sĩ cập đệ, người đỗ Phụ bảng đổi gọi là đồng Tiến sĩ xuất thân để cho hợp với quy chế hiện nay' },
    // note 3 "Giải thích các chức danh trường thi …": cả 7 chức danh (Đề điệu…Đối độc) liệt kê liền nhau ở đoạn 3 (index 2).
    { section: 'body', para: 2, match: 'Đề điệu là Thượng thư Tả Bộc xạ Lê Văn Linh, Giám thí là Ngự sử đài Thị Ngự sử Triệu Thái, cùng các quan Tuần xước, Thu quyển, Di phong, Đằng lục, Đối độc' },
    // note 4 "Địa danh huyện Thanh Đàm …": "Thanh Đàm" không xuất hiện ở thân bia/lạc khoản, chỉ có trong đề danh (đệ tam
    // giáp, tên Nguyễn Đạt) — anchor trỏ vào mục roll (para = chỉ số nhóm giáp, 0-based: 2 = đệ tam giáp).
    { section: 'roll', para: 2, match: 'huyện Thanh Đàm phủ Thường Tín' },
  ],
};

const TIER = { 'Đệ nhất giáp': 1, 'Đệ nhị giáp': 2, 'Đệ tam giáp': 3 };
const TIER_LABEL = { 1: 'Tiến sĩ cập đệ', 2: 'Tiến sĩ xuất thân', 3: 'Đồng Tiến sĩ xuất thân' };
const TIER_NAME = { 1: 'Đệ nhất giáp', 2: 'Đệ nhị giáp', 3: 'Đệ tam giáp' };
/** Khoảng năm dựng của từng đợt — khớp DOT_LABEL trong src/data/index.js ("dựng 1484–1536", "dựng 1653", "dựng 1717–1780"). */
const DOT_RANGE = { 1: [1484, 1536], 2: [1653, 1653], 3: [1717, 1780] };
const INTRO_VERIFY = 'AI soạn, cần đối chiếu — chỉ từ content + historical_notes của mục này';
/**
 * r80 (người dùng: "chỉ tách hai kiểu chữ khi phần đầu thật sự là tiêu đề") — nhãn ghi chú là TIÊU ĐỀ / câu tóm tắt đứng riêng
 * được (đã phân loại tay cả 37 nhãn của 82 bia). Nhãn không có ở đây = vế dẫn chưa trọn câu ("… gồm", "… là", "… như") →
 * labelKind 'inline': giao diện hiện cả ghi chú thành MỘT câu liền (nguyên văn).
 */
const LABEL_TITLE = new Set([
  'Bạt mao liên nhự',
  'Câu nói nổi tiếng',
  'Giải thích các chức danh trường thi',
  "Khái niệm triết học 'Phương, viên'",
  'Lộc minh',
  'Lời răn dạy kẻ sĩ',
  'Mục đích dựng bia',
  'Nghi thức vinh quy có điểm mới',
  'Phép xét tuyển rất tinh, ơn đãi ngộ rất hậu',
  'Quan niệm về hiền tài',
  'Quan niệm về nhân tài',
  'Quan điểm về danh và thực',
  'Quan điểm về giáo dục',
  'Quy định thi cử thời Lê',
  'Quy định về việc dựng bia',
  'Triết lý trị quốc',
  'Triều đình ban ơn điển dồi dào',
  'Văn bia có sự đính chính về lịch sử khoa cử',
  'Văn bia nhấn mạnh tầm quan trọng của khoa Tiến sĩ',
  'Văn bia nhấn mạnh tầm quan trọng của khoa cử',
]);
/**
 * r79 — `content` của nguồn KHÔNG phải bản dịch văn bia (đã đọc tay): năm → { kind, why }. Giao diện đổi nhãn phần đó
 * ("Mô tả bia" thay "Bài ký") và bỏ dòng "Toàn văn bia".
 */
const CONTENT_KIND = {
  1565: { kind: 'description', why: 'content là bài mô tả bia hiện đại (kích thước, đợt dựng, trang trí) — không phải bản dịch văn bia' },
};

// Can chi tính từ năm — cùng quy tắc tools/v2/catalog.mjs (năm 4 = Giáp Tý).
const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const canChiOf = (y) => `${CAN[(((y - 4) % 10) + 10) % 10]} ${CHI[(((y - 4) % 12) + 12) % 12]}`;

const up = (s) => String(s ?? '').normalize('NFC').toLocaleUpperCase('vi');
const lo = (s) => String(s ?? '').normalize('NFC').toLocaleLowerCase('vi');
/** Viết hoa chữ đầu mỗi từ ("HỒNG ĐỨC" → "Hồng Đức"). */
const titleCase = (s) => lo(s).replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('vi'));
/** Viết hoa chữ đầu chuỗi, còn lại thường ("Thám Hoa" → "Thám hoa"). */
const sentenceCase = (s) => {
  const l = lo(s).trim();
  return l.charAt(0).toLocaleUpperCase('vi') + l.slice(1);
};
/** Số chữ cái + chữ số (bỏ khoảng trắng, dấu câu) — dùng kiểm tra không mất / lặp chữ khi tách toàn văn. */
const letters = (s) => (String(s ?? '').match(/[\p{L}\p{N}]/gu) || []).length;
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// ───────────────────────── tiêu đề: can chi · niên hiệu · năm ─────────────────────────

/** Tách tiêu đề (hoa / thường, có / không "niên hiệu", có / không năm trong ngoặc). Niên hiệu chuẩn hóa theo khóa ERA_KING. */
function parseTitle(t) {
  const s = String(t ?? '').normalize('NFC');
  let m = s.match(/niên hiệu\s+(\p{L}+\s+\p{L}+)\s+(?:năm\s+)?thứ\s+(\d+)/iu);
  if (!m) m = s.match(/(\p{L}+\s+\p{L}+)\s+(?:năm\s+)?thứ\s+(\d+)/iu); // "khoa Hoằng Định năm thứ 20"
  let era = null;
  let eraYear = null;
  if (m) {
    const key = Object.keys(ERA_KING).find((k) => up(k) === up(m[1]));
    era = key ?? titleCase(m[1]);
    eraYear = Number(m[2]);
  }
  // can chi: cặp CAN CHI đầu tiên trong tiêu đề (không phân biệt hoa thường)
  const re = new RegExp(`(?:^|\\s)(${CAN.join('|')})\\s+(${CHI.join('|')})(?=[\\s,.)]|$)`, 'iu');
  const cc = s.match(re);
  const canChi = cc ? `${CAN.find((c) => up(c) === up(cc[1]))} ${CHI.find((c) => up(c) === up(cc[2]))}` : null;
  const y = s.match(/\((\d{4})\)/);
  return { era, eraYear, canChi, titleYear: y ? Number(y[1]) : null };
}

// ───────────────────────── toàn văn: tiêu đề · đoạn ký · lạc khoản · đề danh ─────────────────────────

const TIER_HEAD_RE = /^Đệ\s+(nhất|nhị|tam)\s+giáp\b/iu;
const RANK_PREFIX_RE = /^(Đệ\s+(?:nhất|nhị|tam)\s+danh)\s+/iu;
/** Động từ lạc khoản: "vâng sắc soạn", "vâng sắc nhuận", "vâng mệnh viết chữ", "vâng khắc chữ", "vâng mệnh trông coi…". */
const COLO_VERB_RE = /\bvâng\s+(?:(?:sắc|mệnh|lệnh)\s+)*(?:soạn|nhuận|viết|khắc|trông coi|đề)/iu;
/** Câu ngày tháng của lạc khoản: "Bia dựng ngày …", "Triều Lê, niên hiệu Cảnh Hưng thứ 27 (1766)." */
const COLO_DATE_RE = /^(Bia dựng\b|(?:Triều|Hoàng)\s+Lê,\s+niên hiệu\b)/iu;

/** Câu lạc khoản kết thúc bằng việc làm mà thiếu chữ "vâng" ("… Nguyễn Đình Huy viết chữ triện."). */
const COLO_END_RE = /\s(?:viết chữ(?:\s+(?:triện|chân))?(?:\s*\([^)]{0,30}\))?|khắc chữ)\.?$/iu;
const isColoSentence = (s) => COLO_VERB_RE.test(s) || COLO_DATE_RE.test(s) || COLO_END_RE.test(s);

/** Từ VIẾT HOA (tên trên bia viết hoa). `min` = số chữ cái tối thiểu (từ đầu của tên ≥ 2, các từ sau ≥ 1: "NGUYỄN Ý"). */
const isCapsWord = (w, min = 2) => /\p{L}/u.test(w) && w === up(w) && w !== lo(w) && w.replace(/[^\p{L}]/gu, '').length >= min;

/** Vị trí bắt đầu các câu (sau . ! ? … rồi khoảng trắng rồi chữ hoa / ngoặc) — tách theo chỉ số để giữ nguyên văn. */
function sentenceStarts(s) {
  const out = [0];
  for (const m of s.matchAll(/(?<=[.!?…])\s+(?=[\p{Lu}[“"(])/gu)) out.push(m.index + m[0].length);
  return out;
}
const sentencesOf = (s) => {
  const st = sentenceStarts(s);
  return st.map((a, i) => s.slice(a, st[i + 1] ?? s.length).trim()).filter(Boolean);
};

/** Dòng lạc khoản: phần lớn (≥ 50 % số ký tự) là câu lạc khoản (động từ lạc khoản / ngày dựng bia). */
function isColophonLine(l) {
  const ss = sentencesOf(l);
  let hit = 0;
  let all = 0;
  for (const s of ss) {
    all += s.length;
    if (isColoSentence(s)) hit += s.length;
  }
  return all > 0 && hit / all >= 0.5;
}

/**
 * r78 — một dòng nguồn có thể chứa liền nhau: đoạn ký + lạc khoản + các giáp đề danh + lạc khoản sau (1577, 1667…).
 * Cắt (theo chỉ số, giữ nguyên văn) thành các đoạn con: trước mỗi tiêu đề giáp đứng sau dấu kết câu, và trước chuỗi câu
 * lạc khoản ở CUỐI đoạn con (có ít nhất 1 câu đứng trước). Dòng không có ranh giới nào → giữ nguyên.
 */
function segmentLine(l) {
  const cuts = [0];
  for (const m of l.matchAll(/(?<=[.!?…:])\s+(?=Đệ\s+(?:nhất|nhị|tam)\s+giáp\b[^.:]{0,90}:)/gu)) cuts.push(m.index + m[0].length);
  const pieces = cuts.map((a, i) => l.slice(a, cuts[i + 1] ?? l.length).trim()).filter(Boolean);
  const out = [];
  for (const p of pieces) {
    const st = sentenceStarts(p);
    let k = st.length;
    const sent = (j) => p.slice(st[j], st[j + 1] ?? p.length).trim();
    while (k > 1 && isColoSentence(sent(k - 1))) k--;
    // k = câu đầu của chuỗi lạc khoản cuối; chỉ cắt khi chuỗi đó không phải cả đoạn và câu đầu chuỗi không phải tên đề danh
    if (k < st.length && !isColoSentence(sent(k - 1)) && !rollItem(sent(k))) {
      out.push(p.slice(0, st[k]).trim(), p.slice(st[k]).trim());
    } else out.push(p);
  }
  return out;
}

/** Dòng tiêu đề văn bia ở đầu toàn văn ("VĂN BIA ĐỀ DANH TIẾN SĨ KHOA …", "Văn bia đề danh …"). */
function isTitleLine(l) {
  if (!l || l.length > 200) return false;
  if (!/^(văn bia|bia|bài ký)\b/iu.test(l) || !/\bkhoa\b/iu.test(l)) return false;
  return l === up(l) || /\(\d{4}\)\s*$/.test(l) || !/[.!?]/.test(l);
}

/** Dòng mở đầu danh sách (không phải tiêu đề giáp): "Đã Điện thí … ghi tên 7 người:", "DANH SÁCH TIẾN SĨ KHOA …:". */
function isRollPreface(l) {
  if (TIER_HEAD_RE.test(l) || l.length > 200) return false;
  return /\d+\s*người\s*:$/u.test(l) || (/:$/.test(l) && l === up(l));
}

/**
 * Một mục đề danh: "[Đệ nhất danh] TÊN HOA [người|:] quê …" → { name, from, prefix? } hoặc null nếu không phải dòng tên.
 * Tên viết hoa là chuẩn của nguồn; vài dòng viết thường ("Lê Doãn Thân người xã …") → nhận khi có " người " ngay sau tên.
 * `dropped` (không xuất ra) = phần chữ bị bỏ khi tách ("người", dấu ":"…) — chỉ để kiểm tra không mất chữ.
 */
function rollItem(s) {
  let rest = s.trim();
  let prefix;
  const pm = rest.match(RANK_PREFIX_RE);
  if (pm) {
    prefix = pm[1];
    rest = rest.slice(pm[0].length);
  }
  const nameWords = [];
  let end = 0; // vị trí ngay sau từ VIẾT HOA cuối cùng của tên
  for (const m of rest.matchAll(/\S+/g)) {
    const w = m[0];
    const bare = w.replace(/[:,]$/, '');
    if (!isCapsWord(bare, nameWords.length ? 1 : 2)) break;
    nameWords.push(bare);
    end = m.index + bare.length;
    if (bare !== w) break; // "TÊN:" / "TÊN," — dấu kết thúc tên
  }
  if (nameWords.length < 2) {
    const tm = rest.match(/^(\p{Lu}\p{Ll}*(?:\s+\p{Lu}\p{Ll}*){1,4})(?=\s+người\s)/u);
    if (!tm) return null;
    nameWords.splice(0, nameWords.length, ...tm[1].split(/\s+/));
    end = tm[1].length;
  }
  const tail = rest.slice(end);
  let from = tail.replace(/^\s*[:,]\s*/, '').trim();
  if (/^người\s/u.test(from)) from = from.slice('người '.length);
  from = from.replace(/\.$/, '').trim();
  const out = { name: nameWords.join(' '), from };
  if (prefix) out.prefix = prefix;
  Object.defineProperty(out, 'dropped', { value: letters(tail) - letters(from), enumerable: false });
  return out;
}

/** Một dòng có thể chứa nhiều tên nối nhau ("A người …, Sinh đồ. B người …") → tách tại ". " đứng trước một từ VIẾT HOA. */
function rollItems(line) {
  const parts = line.split(/(?<=\.)\s+(?=(?:Đệ\s+(?:nhất|nhị|tam)\s+danh\s+)?\p{Lu}{2,}[\s:,])/u);
  const items = parts.map(rollItem);
  return items.every(Boolean) ? items : null;
}

/** Tiêu đề giáp: "Đệ nhất giáp Tiến sĩ cập đệ, 3 người:" · "… đệ tam danh, 1 người: TÊN …" · "… Đệ nhị danh:" · "… 1 người:" */
function parseTierHead(l) {
  const i = l.indexOf(':');
  const head = (i >= 0 ? l.slice(0, i) : l).trim();
  const inline = i >= 0 ? l.slice(i + 1).trim() : '';
  const m = head.match(/^(.*?),?\s*(\d+)\s*người$/u);
  const heading = (m ? m[1] : head).trim();
  return { heading, count: m ? Number(m[2]) : null, inline, dropped: letters(l) - letters(heading) - letters(inline) };
}

/**
 * Tách toàn văn: tiêu đề · các đoạn ký · lạc khoản (người soạn / nhuận / viết / khắc, ngày dựng — kể cả các dòng ghi sau
 * danh sách) · danh sách đề danh theo giáp. Mỗi đoạn con (segmentLine) được xếp vào ĐÚNG MỘT phần; `trace` ghi lại các chỗ
 * đặc biệt để báo cáo, `trace.dropped` = số chữ bị bỏ có chủ đích ("người", ", 3 người:") để kiểm tra không mất chữ.
 * r78: phân loại TỪNG đoạn con (trước danh sách: đoạn lạc khoản ↔ đoạn ký), không còn "đã vào lạc khoản thì mọi dòng sau
 * đều là lạc khoản" (r71) — với 1442 kết quả như cũ.
 */
function splitContent(raw) {
  const lines = String(raw ?? '').normalize('NFC').split('\n').map((l) => l.trim()).filter(Boolean);
  let title = null;
  const paras = [];
  const colophon = [];
  const roll = [];
  const trace = { dupTitle: [], preface: [], postRoll: [], unparsed: [], split: 0, bodyAfterColo: [], dropped: 0 };
  let inRoll = false;
  let group = null;
  let preface = null;
  const newGroup = (g) => {
    if (preface) {
      g.preface = preface.text;
      if (g.count == null && preface.count != null && !roll.length) g.count = preface.count;
      preface = null;
    }
    roll.push(g);
    group = g;
    return g;
  };
  const segs = [];
  lines.forEach((l, i) => {
    if (i === 0 && isTitleLine(l)) {
      title = l;
      return;
    }
    if (title && up(l) === up(title) && !segs.length) {
      trace.dupTitle.push(l); // tiêu đề lặp lại (dữ liệu nguồn chép 2 lần)
      return;
    }
    const s = segmentLine(l);
    if (s.length > 1) trace.split++;
    segs.push(...s);
  });
  for (const l of segs) {
    if (TIER_HEAD_RE.test(l)) {
      inRoll = true;
      const { heading, count, inline, dropped } = parseTierHead(l);
      trace.dropped += dropped;
      const g = newGroup({ heading, count, names: [] });
      if (inline) {
        const items = rollItems(inline);
        if (items) {
          g.names.push(...items);
          trace.dropped += items.reduce((a, n) => a + n.dropped, 0);
        } else trace.unparsed.push(l);
      }
      continue;
    }
    if (isRollPreface(l)) {
      inRoll = true;
      const m = l.match(/(\d+)\s*người\s*:$/u);
      preface = { text: l, count: m ? Number(m[1]) : null };
      trace.preface.push(l);
      continue;
    }
    if (inRoll) {
      const items = rollItems(l);
      if (items) {
        (group ?? newGroup({ heading: null, count: null, names: [] })).names.push(...items);
        trace.dropped += items.reduce((a, n) => a + n.dropped, 0);
        continue;
      }
      // Tiêu đề phụ ngắn không có số người (vd "Đồng Tiến sĩ xuất thân" sau dòng "Đã Điện thí …")
      if (l.length <= 60 && !/[.!?]$/.test(l) && !isColophonLine(l)) {
        newGroup({ heading: l, count: null, names: [] });
        continue;
      }
      // Sau danh sách: lạc khoản (người viết / khắc chữ…) hoặc ghi chú khác (vd danh sách quan trường thi) → lạc khoản
      colophon.push(l);
      trace.postRoll.push({ line: l, colophonLike: isColophonLine(l) });
      continue;
    }
    if (isColophonLine(l)) {
      colophon.push(l);
      continue;
    }
    if (colophon.length) trace.bodyAfterColo.push(l);
    paras.push(l);
  }
  if (preface) trace.unparsed.push(preface.text); // dòng mở đầu danh sách mà không có tên nào theo sau
  return { content: { title, paragraphs: paras, colophon, roll }, trace };
}

// ───────────────────────── r73: các trường mở rộng thêm ─────────────────────────

/** "Nhãn: nội dung" → { label, text }. Không có ":" (hoặc phần trước ":" quá dài, khó là nhãn thật) → { label: undefined, text: nguyên văn }. */
function parseNoteLabel(raw) {
  const i = raw.indexOf(':');
  if (i < 0 || i > 60) return { label: undefined, text: raw };
  return { label: raw.slice(0, i).trim(), text: raw.slice(i + 1).trim() };
}

/** term có xuất hiện NGUYÊN VĂN ở đâu đó trong toàn văn đã tách (thân bia / lạc khoản / đề danh) không. */
function contentHasVerbatim(term, content) {
  if (!term) return false;
  if (content.paragraphs.some((p) => p.includes(term))) return true;
  if (content.colophon.some((p) => p.includes(term))) return true;
  for (const g of content.roll) {
    if (g.heading?.includes(term)) return true;
    if (g.names.some((n) => `${n.name} ${n.from}`.includes(term))) return true;
  }
  return false;
}

/**
 * Phân loại 1 historical_note thành { label, text, kind, terms? }.
 * 'gloss': hoặc (a) text là danh sách "Thuật ngữ (định nghĩa), Thuật ngữ (định nghĩa), …" mà MỌI thuật ngữ đều xuất hiện
 * nguyên văn trong nội dung bia, hoặc (b) label ngắn (≤ 6 từ) và tự nó xuất hiện nguyên văn trong nội dung bia.
 * def luôn lấy nguyên văn từ chính historical_note, không tự viết định nghĩa mới.
 */
function classifyNote(raw, content) {
  const { label, text } = parseNoteLabel(raw);
  const pairRe = /([^,()]+?)\s*\(([^)]+)\)/g;
  const pairs = [...text.matchAll(pairRe)].map((m) => ({ term: m[1].trim(), def: m[2].trim() }));
  if (pairs.length && pairs.every((p) => contentHasVerbatim(p.term, content))) {
    return { label, text, kind: 'gloss', terms: pairs };
  }
  if (label && label.split(/\s+/).length <= 6 && contentHasVerbatim(label, content)) {
    return { label, text, kind: 'gloss', terms: [{ term: label, def: text }] };
  }
  return { label, text, kind: 'note' };
}

/** Chuỗi trong '…'/"…"/«…»/“…” dài ≥ 8 ký tự (nếu có) — dùng làm ứng viên khớp nguyên văn cho anchor. */
function findQuoted(s) {
  const m = s.match(/['"«“]([^'"»”]{8,})['"»”]/);
  return m ? m[1].trim() : null;
}

/** Ngưỡng heuristic (r78, xem REPORT): số cặp âm tiết liền nhau (bigram) chung giữa ghi chú và MỘT câu của toàn văn, và cách
 *  biệt với câu đứng thứ hai. Dưới ngưỡng = khớp yếu → không neo. */
const BG_MIN_SCORE = 3;
const BG_MIN_MARGIN = 2;
/** Âm tiết thường (chữ / số), bỏ dấu câu. */
const syllables = (s) => (lo(s).match(/[\p{L}\p{N}]+/gu) || []);
const bigrams = (s) => {
  const w = syllables(s);
  const out = new Set();
  for (let i = 0; i + 1 < w.length; i++) out.add(`${w[i]} ${w[i + 1]}`);
  return out;
};

/**
 * Heuristic xác định anchor khi KHÔNG có trong ANCHOR_OVERRIDE (r78, theo thứ tự tin cậy):
 *   1. đoạn trích trong ngoặc của ghi chú có NGUYÊN VĂN trong một đoạn / lạc khoản (bỏ dấu câu cuối) → { …, match }
 *   2. ghi chú 'gloss': thuật ngữ đầu tiên có NGUYÊN VĂN trong đoạn / lạc khoản → { …, match: thuật ngữ }; chỉ có trong đề
 *      danh (quê người đỗ) → { section: 'roll', para: chỉ số nhóm giáp, match } (chỉ khi nhóm giáp khớp 1-1 với tiers)
 *   3. khớp theo CÂU: chấm mỗi câu của đoạn ký / lạc khoản bằng số cặp âm tiết liền nhau (bigram) chung với ghi chú; nhận
 *      câu cao nhất khi điểm ≥ BG_MIN_SCORE và hơn câu thứ hai ≥ BG_MIN_MARGIN → { …, match: nguyên văn câu đó }
 * (r73 chấm từ khóa theo cả ĐOẠN, không có match → mốc ghi chú rơi về đầu đoạn; nhiều bia chỉ có 1 đoạn ký dài vài nghìn chữ
 * nên neo theo đoạn gần như vô nghĩa — r78 bỏ.) Không đạt → null (UI liệt kê ghi chú đó ở cuối Bài ký).
 * Trả về { anchor, how, score?, margin? } để báo cáo.
 */
function buildAnchor(raw, label, text, content, cls, rollAligned) {
  const findIn = (needle) => {
    if (!needle) return null;
    for (let i = 0; i < content.paragraphs.length; i++) if (content.paragraphs[i].includes(needle)) return { section: 'body', para: i, match: needle };
    for (let i = 0; i < content.colophon.length; i++) if (content.colophon[i].includes(needle)) return { section: 'colo', para: i, match: needle };
    return null;
  };
  const quoted = findQuoted(raw);
  if (quoted) {
    const a = findIn(quoted) ?? findIn(quoted.replace(/[.,;:!?…]+$/u, '').trim());
    if (a) return { anchor: a, how: 'quote' };
  }
  if (cls.kind === 'gloss' && cls.terms?.length) {
    const term = cls.terms[0].term;
    const a = findIn(term);
    if (a) return { anchor: a, how: 'term' };
    if (rollAligned) {
      for (let g = 0; g < content.roll.length; g++) {
        if (content.roll[g].names.some((n) => n.from.includes(term))) return { anchor: { section: 'roll', para: g, match: term }, how: 'term-roll' };
      }
    }
  }
  const nb = bigrams(raw);
  if (!nb.size) return { anchor: null, how: 'none' };
  const scored = [];
  const scan = (arr, section) => arr.forEach((p, i) => {
    for (const sen of sentencesOf(p)) {
      const sb = bigrams(sen);
      let score = 0;
      for (const g of nb) if (sb.has(g)) score++;
      scored.push({ score, section, para: i, match: sen });
    }
  });
  scan(content.paragraphs, 'body');
  scan(content.colophon, 'colo');
  scored.sort((x, y) => y.score - x.score || (x.section === y.section ? x.para - y.para : x.section === 'body' ? -1 : 1));
  const best = scored[0];
  if (!best) return { anchor: null, how: 'none' };
  const margin = best.score - (scored[1]?.score ?? 0);
  const ok = best.score >= BG_MIN_SCORE && margin >= BG_MIN_MARGIN;
  return { anchor: ok ? { section: best.section, para: best.para, match: best.match } : null, how: ok ? 'sentence' : 'weak', score: best.score, margin, cand: best.match.slice(0, 140) };
}

function buildNotes(historicalNotes, content, year, rollAligned, stats) {
  const overrides = ANCHOR_OVERRIDE[year];
  return (historicalNotes ?? []).map((raw, i) => {
    const cls = classifyNote(raw, content);
    const { label, text, kind, terms } = cls;
    const out = { text: raw, kind };
    if (label !== undefined) {
      out.label = label;
      // r80: nhãn là tiêu đề / câu tóm tắt đứng riêng được ('title' → giao diện tách nhãn chữ hoa nhỏ + thân) hay chỉ là vế dẫn
      // chưa trọn câu ('inline' → một câu liền, đúng nguyên văn). Nhãn mới chưa có trong bảng → 'inline'.
      out.labelKind = LABEL_TITLE.has(label) ? 'title' : 'inline';
    }
    if (terms) out.terms = terms;
    const override = overrides ? overrides[i] : undefined;
    let anchor;
    if (override !== undefined) {
      anchor = override;
      stats.push({ how: 'override', anchored: !!anchor });
    } else {
      const r = buildAnchor(raw, label, text, content, cls, rollAligned);
      anchor = r.anchor;
      stats.push({ ...r, anchored: !!anchor, note: raw });
    }
    if (anchor) out.anchor = anchor;
    return out;
  });
}

/** contributors → credits[] theo thứ tự vai trò cố định, bỏ "Không ghi" / rỗng / null. */
const CREDIT_ROLE = { author: 'Soạn văn', editor: 'Nhuận sắc', calligrapher: 'Viết chữ', engraver: 'Khắc đá' };
const realName = (s) => (s && String(s).trim() && !/^không ghi$/iu.test(String(s).trim()) ? String(s).trim() : null);
function buildCredits(contributors) {
  if (!contributors) return [];
  const out = [];
  for (const key of ['author', 'editor', 'calligrapher', 'engraver']) {
    const name = realName(contributors[key]);
    if (name) out.push({ role: CREDIT_ROLE[key], name });
  }
  return out;
}

/** Với mỗi credit, tìm các mục KHÁC trong toàn bộ 82 mục có cùng tên ở cùng vai trò (cùng field contributors.<key>). */
function buildCrossRefs(credits, all, selfYear) {
  const roleToKey = Object.fromEntries(Object.entries(CREDIT_ROLE).map(([k, v]) => [v, k]));
  const out = [];
  for (const { role, name } of credits) {
    const key = roleToKey[role];
    const others = all
      .filter((x) => Number(x.year) !== selfYear && realName((x.contributors || {})[key]) === name)
      .map((x) => ({ id: `bia-${Number(x.year)}`, year: Number(x.year) }));
    if (others.length) out.push({ role, name, others, $note: 'trùng tên trong dữ liệu' });
  }
  return out;
}

/** Chuỗi trong dấu [...] của rank, tách theo dấu phẩy, chuẩn hóa hoa/thường (chỉ viết hoa chữ đầu). Không định nghĩa. */
function parseHonors(rank) {
  const m = (rank || '').match(/\[([^\]]+)\]/);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const lower = s.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

const VAGUE_COUNT_RE = /\b(hơn|trên|gần|ngót|khoảng|mấy|vài|không dưới|dưới|ước|xấp xỉ|độ)\b/i;
/** "1.400 người" → 1400 (chính xác). "hơn 750", "trên ba nghìn", "Không ghi", số viết chữ… → null (không chính xác). */
function parseExactCount(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s || /không ghi/i.test(s) || VAGUE_COUNT_RE.test(s)) return null;
  const m = s.match(/^([\d.]+)\s*(người)?$/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ''));
  return Number.isFinite(n) ? n : null;
}

function buildPassRate(candidatesRaw, passedRaw) {
  const candidates = parseExactCount(candidatesRaw);
  const passed = parseExactCount(passedRaw);
  if (candidates == null || passed == null || passed <= 0) return null;
  const ratio = passed / candidates;
  const oneIn = Math.round(candidates / passed);
  return { candidates, passed, ratio, oneIn, phrase: `cứ khoảng ${oneIn} người dự thi có 1 người đỗ` };
}

/** Số có 4 chữ số ĐẦU TIÊN trong chuỗi (xử lý chuỗi ghép "1502 (Cảnh Thống 5) và 1536 (Đại Chính 7)" → 1502). */
function parseYear4(raw) {
  if (raw == null) return null;
  const m = String(raw).match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

function buildErection(erectionRaw, examYear, all) {
  const year = parseYear4(erectionRaw);
  if (year == null) return null;
  const batchEntries = all.filter((x) => parseYear4(x.erection_year) === year).map((x) => ({ id: `bia-${Number(x.year)}`, year: Number(x.year) }));
  return { year, raw: String(erectionRaw), gap: examYear != null ? year - examYear : null, batch: { count: batchEntries.length, entries: batchEntries } };
}

/** Năm 4 chữ số nhắc trong description, KHÁC năm khoa thi này, VÀ có bia tương ứng trong dữ liệu → link (cần đối chiếu). */
function findYearLinks(description, examYear, yearSet) {
  const found = [...new Set((description.match(/\d{4}/g) || []).map(Number))];
  const links = found.filter((y) => y !== examYear && yearSet.has(y)).map((y) => ({ id: `bia-${y}`, year: y, $verify: 'cần đối chiếu' }));
  return links.length ? links : undefined;
}

function buildStories(biographies, examYear, laureateNames, yearSet) {
  return (biographies ?? []).map((b) => {
    const links = findYearLinks(b.description ?? '', examYear, yearSet);
    const story = { name: b.name, dates: b.dates ?? null, description: b.description ?? '', isLaureate: laureateNames.has(b.name) };
    if (links) story.links = links;
    return story;
  });
}

function buildAuthorBio(authorName, biographies, examYear, yearSet) {
  if (!realName(authorName)) return null;
  const b = (biographies ?? []).find((x) => x.name === authorName);
  if (!b) return null;
  const out = { name: b.name, dates: b.dates ?? null, description: b.description ?? '', hometown: b.hometown ?? '', roles: b.roles ?? [] };
  const links = findYearLinks(b.description ?? '', examYear, yearSet);
  if (links) out.links = links;
  return out;
}

// ───────────────────────── r78: người đỗ · triều đại · danh mục ─────────────────────────

function tierOf(rank) {
  const r = lo(rank);
  for (const [k, v] of Object.entries(TIER)) if (r.startsWith(lo(k))) return v;
  return null;
}

/** Danh hiệu của giáp trong rank: bỏ "Đệ X giáp", "(…)", "[…]", "đệ N danh" → "Tiến sĩ cập đệ" / "Chế khoa xuất thân"… */
function rankLabel(rank) {
  let s = String(rank ?? '').replace(/\[[^\]]*\]/g, ' ');
  const paren = (s.match(/\(([^)]+)\)/) || [])[1];
  s = s.replace(/\([^)]*\)/g, ' ').replace(/^\s*Đệ\s+(nhất|nhị|tam)\s+giáp\s*/iu, '').replace(/\s*đệ\s+(nhất|nhị|tam)\s+danh\s*$/iu, '').replace(/\s+/g, ' ').trim();
  if (!s && paren && /xuất thân|cập đệ/iu.test(paren)) s = paren.trim(); // "Đệ tam giáp (Đồng Tiến sĩ xuất thân)"
  return s || null;
}

/** Danh hiệu nhận làm `title` (chữ trong (...) của rank); chữ khác trong (...) ("Đỗ đầu", "Đỗ cuối bảng", tên giáp…) chỉ giữ ở rank. */
const RANK_TITLE_RE = /^(Trạng nguyên|Bảng nhãn|Thám hoa|Thám hoa lang|Hoàng giáp|Đình nguyên|Hội nguyên|Đệ (?:nhất|nhị|tam) danh)$/iu;
/** Chữ trong (...) của rank nếu là DANH HIỆU (RANK_TITLE_RE). Chuẩn hóa hoa-thường. */
function rankTitle(rank) {
  const p = (String(rank ?? '').match(/\(([^)]+)\)/) || [])[1];
  if (!p || !RANK_TITLE_RE.test(p.trim())) return null;
  return sentenceCase(p);
}

/** Danh hiệu nhãn ngắn trên thân bia khi người đỗ không có danh hiệu riêng: bỏ " xuất thân" của nhãn giáp. */
function shortTierTitle(label) {
  const s = String(label ?? '').replace(/\s+xuất thân$/iu, '').trim();
  return s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : null;
}

/** Danh hiệu giáp (lấy từ dữ liệu toàn bộ 82 mục) → giáp, chỉ khi duy nhất — để suy giáp cho rank không ghi "Đệ X giáp". */
function buildLabelTierMap(all) {
  const m = new Map();
  for (const e of all) {
    for (const l of e.laureates ?? []) {
      const t = tierOf(l.rank || '');
      const lab = rankLabel(l.rank);
      if (!t || !lab) continue;
      const k = lo(lab);
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(t);
    }
  }
  return m;
}

/** dynasty nguyên văn → { id, name, raw, verify? } theo DYNASTIES (src/data/dynasties.js). */
function normalizeDynasty(raw, year) {
  const r = lo(raw);
  const byId = Object.fromEntries(DYNASTIES.map((d) => [d.id, d]));
  const pick = (id, verify) => ({ id, name: byId[id].name, raw: raw ?? null, ...(verify ? { verify } : {}) });
  if (/lê\s+sơ/u.test(r)) return pick('le-so');
  if (/trung\s+hưng/u.test(r)) return pick('le-trung-hung');
  if (/(?<!\p{L})mạc(?!\p{L})/u.test(r)) return pick('mac');
  if (/(?<!\p{L})lê(?!\p{L})/u.test(r) && year != null) {
    const le = periodsOf(year).filter((id) => id.startsWith('le-'));
    if (le.length === 1) return pick(le[0], `cần đối chiếu — nguồn ghi "${raw}" (không rõ giai đoạn), suy ${byId[le[0]].name} từ năm thi ${year} theo mốc ${byId[le[0]].from}–${byId[le[0]].to} của src/data/dynasties.js`);
  }
  return { id: null, name: raw ?? null, raw: raw ?? null, verify: 'không quy được về giai đoạn nào trong src/data/dynasties.js' };
}

/** Đợt dựng theo DOT_RANGE (khớp DOT_LABEL); ngoài mọi khoảng → null. */
function dotOf(y) {
  if (y == null) return null;
  for (const [d, [a, b]] of Object.entries(DOT_RANGE)) if (y >= a && y <= b) return Number(d);
  return null;
}

/** Câu đầu của lời giới thiệu (mota cho danh mục). */
function firstSentence(text) {
  const s = Array.isArray(text) ? String(text[0] ?? '') : String(text ?? '');
  return (sentencesOf(s.trim())[0] ?? '').trim() || null;
}

// ───────────────────────── trích một mục ─────────────────────────

function extract(e, ctx) {
  const { all, yearSet, intros, labelTier } = ctx;
  const year = num(e.year);
  const issues = []; // bất thường của dữ liệu / khi tách — báo cáo, không sửa
  const t = e.title || '';
  const pt = parseTitle(t);
  const computedCanChi = year != null ? canChiOf(year) : null;
  let canChi = pt.canChi;
  let canChiTitle;
  if (!pt.canChi) {
    canChi = computedCanChi;
    issues.push(`tiêu đề không có can chi → dùng can chi tính từ năm (${computedCanChi})`);
  } else if (pt.canChi !== computedCanChi) {
    canChiTitle = pt.canChi;
    canChi = computedCanChi;
    issues.push(`can chi trong tiêu đề "${pt.canChi}" ≠ can chi của năm ${year} ("${computedCanChi}") → dùng can chi tính từ năm`);
  }
  // r79: ghi chú lịch sử nhắc CẢ HAI can chi (tiêu đề + tính từ năm) — nguyên văn, làm chú thích cho chữ can chi ở giao diện
  let canChiNote = null;
  if (canChiTitle) {
    canChiNote = (e.historical_notes ?? []).find((n) => typeof n === 'string' && lo(n).includes(lo(canChiTitle)) && lo(n).includes(lo(computedCanChi))) ?? null;
    if (!canChiNote) issues.push(`không có ghi chú lịch sử nào nhắc cả "${canChiTitle}" lẫn "${computedCanChi}" → không có chú thích can chi`);
  }
  if (pt.titleYear == null) issues.push('tiêu đề không ghi năm (dạng "(1565)")');
  else if (pt.titleYear !== year) issues.push(`năm trong tiêu đề ${pt.titleYear} ≠ year ${year}`);
  if (!pt.era) issues.push('không tách được niên hiệu từ tiêu đề');
  const k = pt.era ? ERA_KING[pt.era] : null;
  if (pt.era && !k) issues.push(`niên hiệu "${pt.era}" chưa có trong ERA_KING`);

  // người đỗ
  const laureates = (e.laureates || []).map((l) => {
    let tier = tierOf(l.rank || '');
    let tierVerify;
    if (!tier) {
      const lab = rankLabel(l.rank);
      const set = lab ? labelTier.get(lo(lab)) : null;
      if (set && set.size === 1) {
        tier = [...set][0];
        tierVerify = `cần đối chiếu — rank "${l.rank}" không ghi giáp; danh hiệu này chỉ gặp ở ${TIER_NAME[tier]} trong dữ liệu`;
      }
    }
    const out = { name: l.name, tier, title: rankTitle(l.rank), rank: l.rank, hometown: l.hometown || '', honors: parseHonors(l.rank) };
    if (tierVerify) out.tierVerify = tierVerify;
    return out;
  });
  const noTier = laureates.filter((l) => !l.tier);
  if (noTier.length) issues.push(`${noTier.length} người đỗ không xác định được giáp (rank: ${[...new Set(noTier.map((l) => l.rank))].join(' | ')})`);
  const inferred = laureates.filter((l) => l.tierVerify);
  if (inferred.length) issues.push(`${inferred.length} người đỗ suy giáp từ danh hiệu (rank "${inferred[0].rank}" không ghi giáp) — cần đối chiếu`);
  // nhãn giáp: danh hiệu phổ biến nhất trong rank của giáp đó; trùng TIER_LABEL (không phân biệt hoa thường) thì dùng TIER_LABEL
  const tierLabel = (n) => {
    const cnt = new Map();
    for (const l of laureates) {
      if (l.tier !== n) continue;
      const lab = rankLabel(l.rank);
      if (lab) cnt.set(lab, (cnt.get(lab) ?? 0) + 1);
    }
    const best = [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    if (!best || lo(best) === lo(TIER_LABEL[n])) return TIER_LABEL[n];
    return best.charAt(0).toLocaleUpperCase('vi') + best.slice(1);
  };
  const tiers = [1, 2, 3].map((n) => ({ tier: n, label: tierLabel(n), count: laureates.filter((l) => l.tier === n).length }));

  // toàn văn
  const { content, trace } = splitContent(e.content || '');
  if (CONTENT_KIND[year]) content.kind = CONTENT_KIND[year].kind;
  const nonEmptyTiers = tiers.filter((x) => x.count > 0);
  const rollTierOf = (g) => (g.heading ? tierOf(g.heading) : null);
  const rollAligned = content.roll.length === nonEmptyTiers.length && content.roll.every((g, i) => rollTierOf(g) == null || rollTierOf(g) === nonEmptyTiers[i].tier);

  const credits = buildCredits(e.contributors);
  const laureateNames = new Set(laureates.map((l) => l.name));
  const noteStats = [];
  const notes = buildNotes(e.historical_notes, content, year, rollAligned, noteStats);
  const introEntry = intros[String(year)] ?? null;
  const introText = introEntry ? (Array.isArray(introEntry.text) ? introEntry.text : [String(introEntry.text)]) : null;
  const dyn = normalizeDynasty(e.dynasty ?? null, year);
  const passedRaw = e.passed_count ?? e.total_laureates;
  const passed = parseExactCount(passedRaw) ?? parseExactCount(e.total_laureates);
  const candidates = parseExactCount(e.candidates_count);
  const erection = buildErection(e.erection_year, year, all);

  const info = {
    $source: `data/82-van-bia-tien-si.json · id ${e.id} (${e.source_url ?? ''})`,
    $generated: 'tools/extract-stele-info.mjs — không sửa tay; sửa nguồn hoặc tool rồi chạy lại',
    id: `bia-${year}`,
    year,
    canChi,
    ...(canChiTitle ? { canChiTitle } : {}),
    ...(canChiNote ? { canChiNote } : {}),
    title: t,
    dynasty: dyn.name,
    dynastyId: dyn.id,
    dynastyRaw: dyn.raw,
    ...(dyn.verify ? { dynastyVerify: dyn.verify } : {}),
    era: pt.era,
    eraYear: pt.eraYear,
    king: k?.name ? { name: k.name, $verify: `cần đối chiếu — ${k.why}` } : null,
    candidates,
    candidatesRaw: e.candidates_count ?? null,
    passed,
    passedRaw: passedRaw ?? null,
    erected: erection?.year ?? null,
    contributors: e.contributors ?? null,
    tiers,
    laureates,
    intro: introText ? { text: introText, $verify: INTRO_VERIFY } : null,
    notes,
    // r72: tiểu sử (nguồn) — lớp đề danh hiện thẻ ngắn khi rê vào tên có tiểu sử
    biographies: (e.biographies ?? []).map((b) => ({ name: b.name, dates: b.dates ?? null, description: b.description ?? '', hometown: b.hometown ?? '', roles: b.roles ?? [] })),
    content,
    // r73: các trường mở rộng — xem chú thích đầu tệp cho quy tắc nguồn/không bịa của từng trường
    credits,
    crossRefs: buildCrossRefs(credits, all, year),
    passRate: buildPassRate(e.candidates_count, passedRaw),
    erection,
    stories: buildStories(e.biographies, year, laureateNames, yearSet),
    authorBio: buildAuthorBio(e.contributors?.author, e.biographies, year, yearSet),
  };

  // danh mục (index.js)
  const first = laureates[0];
  const dot = dotOf(erection?.year ?? null);
  const mota = introText ? firstSentence(introText) : null;
  const catalog = {
    nienHieu: pt.era ? `${pt.era}${pt.eraYear != null ? ` ${pt.eraYear}` : ''}` : null,
    vua: k?.name ?? null,
    dot,
    dung: erection?.year ?? null,
    soDo: passed ?? (laureates.length || null),
    dauKhoa: first ? (first.title && !/danh$/u.test(first.title) ? `${first.title} ${first.name}` : first.name) : null,
    soanVan: /không ghi/iu.test(e.contributors?.author ?? '') ? null : realName(e.contributors?.author),
    ...(canChiTitle ? { canChiTitle } : {}),
    ...(mota ? { mota } : {}),
    dynasty: dyn.name,
    $verify: {
      ...(k?.name ? { vua: `cần đối chiếu — ${k.why}` } : {}),
      ...(mota ? { mota: 'AI soạn, cần đối chiếu — câu đầu của lời giới thiệu (tools/stele-intros.json)' } : {}),
      ...(dyn.verify ? { dynasty: dyn.verify } : {}),
    },
  };
  if (!Object.keys(catalog.$verify).length) delete catalog.$verify;
  if (erection && dot == null) issues.push(`năm dựng ${erection.year} (nguồn "${erection.raw}") không thuộc khoảng đợt nào của DOT_LABEL → dot null`);
  if (dyn.id && year != null && !periodsOf(year).includes(dyn.id)) issues.push(`triều "${dyn.raw}" (→ ${dyn.name}) không phủ năm thi ${year} theo dynasties.js`);
  if (!dyn.id) issues.push(`dynasty "${dyn.raw}" không quy được`);

  // ───── kiểm tra ─────
  const rollNames = content.roll.flatMap((g) => g.names);
  const nPassed = passed;
  const cmp = [];
  const L = Math.min(rollNames.length, laureates.length);
  const tonefold = (s) => up(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Đ/g, 'D');
  for (let i = 0; i < L; i++) {
    const a = up(rollNames[i].name);
    const b = up(laureates[i].name);
    if (a !== b) cmp.push({ i, roll: rollNames[i].name, data: laureates[i].name, kind: tonefold(a) === tonefold(b) ? 'dấu' : 'khác' });
  }
  const groupCountBad = content.roll.filter((g) => g.count != null && g.count !== g.names.length).map((g) => `${g.heading ?? '(không tiêu đề)'}: ghi ${g.count}, tách được ${g.names.length}`);
  // không mất / lặp chữ: chữ cái + chữ số của mọi phần + phần bỏ có chủ đích ("người", ", 3 người:") = của content
  const partsLetters = letters(content.title) + trace.dupTitle.reduce((a, s) => a + letters(s), 0) +
    content.paragraphs.reduce((a, s) => a + letters(s), 0) + content.colophon.reduce((a, s) => a + letters(s), 0) +
    content.roll.reduce((a, g) => a + letters(g.heading) + letters(g.preface) + g.names.reduce((b, n) => b + letters(n.name) + letters(n.from) + letters(n.prefix), 0), 0) +
    trace.dropped;
  const srcLetters = letters(e.content);
  const allParts = [...content.paragraphs, ...content.colophon];
  const dupParts = allParts.filter((p, i) => allParts.indexOf(p) !== i);
  const author = realName(e.contributors?.author);
  const colophonHasAuthor = !!author && author.split(/\s*,\s*/).every((a) => content.colophon.some((c) => c.includes(a)));

  if (trace.dupTitle.length) issues.push(`tiêu đề lặp ${trace.dupTitle.length} lần trong content (bỏ bản lặp)`);
  if (!content.title) issues.push('content không có dòng tiêu đề');
  if (!content.roll.length) issues.push('content không có danh sách đề danh');
  if (!content.colophon.length) issues.push('không tìm thấy lạc khoản');
  if (content.roll.length && rollNames.length !== laureates.length) issues.push(`đề danh ${rollNames.length} tên ≠ laureates ${laureates.length}`);
  if (nPassed != null && laureates.length !== nPassed) issues.push(`laureates ${laureates.length} ≠ passed_count ${nPassed}`);
  if (e.total_laureates != null && parseExactCount(e.passed_count) != null && Number(e.total_laureates) !== parseExactCount(e.passed_count)) issues.push(`passed_count "${e.passed_count}" ≠ total_laureates ${e.total_laureates}`);
  if (cmp.length) issues.push(`tên đề danh lệch laureates: ${cmp.map((c) => `#${c.i + 1} ${c.roll} ≠ ${c.data} (${c.kind})`).join('; ')}`);
  if (groupCountBad.length) issues.push(`số người ghi ở tiêu đề giáp ≠ số tên: ${groupCountBad.join('; ')}`);
  if (content.roll.length && !rollAligned) issues.push(`nhóm giáp trong toàn văn (${content.roll.map((g) => g.heading ?? '—').join(' / ')}) không khớp 1-1 với giáp của laureates (${nonEmptyTiers.map((x) => TIER_NAME[x.tier]).join(' / ')}) — toàn văn thiếu tiêu đề giáp; anchor đề danh bị tắt`);
  if (trace.unparsed.length) issues.push(`dòng không tách được: ${trace.unparsed.map((s) => `"${s.slice(0, 60)}…"`).join('; ')}`);
  if (trace.postRoll.some((p) => !p.colophonLike)) issues.push(`sau đề danh có dòng không phải lạc khoản → xếp vào lạc khoản: ${trace.postRoll.filter((p) => !p.colophonLike).map((p) => `"${p.line.slice(0, 50)}…"`).join('; ')}`);
  if (trace.preface.length) issues.push(`dòng mở đầu danh sách giữ ở roll[].preface: ${trace.preface.map((s) => `"${s.slice(0, 50)}…"`).join('; ')}`);
  if (dupParts.length) issues.push(`đoạn trùng lặp: ${dupParts.length}`);
  if (author && content.colophon.length && !colophonHasAuthor) issues.push(`lạc khoản không nhắc tên người soạn "${author}"`);
  const ratio = srcLetters ? partsLetters / srcLetters : 1;
  if (partsLetters !== srcLetters) issues.push(`chữ của các phần ${partsLetters} ≠ content ${srcLetters} (tỉ lệ ${ratio.toFixed(4)})`);
  if (trace.split) issues.push(`${trace.split} dòng nguồn chứa liền nhiều phần (đoạn ký / lạc khoản / giáp) → đã cắt theo câu`);
  if (trace.bodyAfterColo.length) issues.push(`đoạn ký đứng sau lạc khoản (giữ ở đoạn ký): ${trace.bodyAfterColo.map((s) => `"${s.slice(0, 50)}…"`).join('; ')}`);

  const check = {
    id: info.id,
    year,
    parse: 'ok',
    title: !!content.title,
    paras: content.paragraphs.length,
    colo: content.colophon.length,
    groups: content.roll.length,
    rollNames: rollNames.length,
    laureates: laureates.length,
    passed: nPassed,
    nameMismatch: cmp.length,
    chars: +ratio.toFixed(4),
    notes: notes.length,
    anchored: notes.filter((n) => n.anchor).length,
    king: k?.name ?? null,
    canChi,
    era: pt.era,
    intro: !!introText,
    dynasty: dyn.id,
    dot,
    issues,
    noteStats,
  };
  const hard = !content.roll.length || rollNames.length !== laureates.length || dupParts.length || partsLetters !== srcLetters || trace.unparsed.length || !content.colophon.length;
  check.parse = hard ? 'warn' : 'ok';
  return { info, catalog, check };
}

// ───────────────────────── chạy ─────────────────────────

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const QUIET = argv.includes('--quiet');
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const years = argv.filter((a, i) => /^\d{4}$/.test(a) && argv[i - 1] !== '--json').map(Number);
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const want = ALL ? all.map((x) => Number(x.year)) : years.length ? years : [1442];
const yearSet = new Set(all.map((x) => Number(x.year)));
const intros = fs.existsSync(INTROS) ? JSON.parse(fs.readFileSync(INTROS, 'utf8')) : {};
const ctx = { all, yearSet, intros, labelTier: buildLabelTierMap(all) };

fs.mkdirSync(OUT_DIR, { recursive: true });
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
const names = ALL ? {} : readJson(OUT_NAMES);
const cat = ALL ? {} : readJson(OUT_CATALOG);
const checks = [];
for (const y of want) {
  const e = all.find((x) => Number(x.year) === y);
  if (!e) {
    console.error(`không có mục năm ${y}`);
    process.exitCode = 1;
    continue;
  }
  const { info, catalog, check } = extract(e, ctx);
  fs.writeFileSync(path.join(OUT_DIR, `${info.id}.json`), JSON.stringify(info, null, 1) + '\n');
  // Tên trên thân bia: danh hiệu ngắn (danh hiệu riêng theo nguồn; không có thì rút từ nhãn giáp: "Tiến sĩ", "Đồng Tiến sĩ",
  // "Chế khoa"…) + dải tiêu đề của giáp (r72: tên khắc trên thân bia hiện lần lượt từng giáp dưới một dải tiêu đề)
  const labelOf = Object.fromEntries(info.tiers.map((x) => [x.tier, x.label]));
  names[info.id] = info.laureates.map((l) => ({
    title: l.title ?? shortTierTitle(labelOf[l.tier]) ?? 'Tiến sĩ',
    name: l.name,
    tier: l.tier,
    band: l.tier ? `${TIER_NAME[l.tier]} · ${labelOf[l.tier]}` : '',
  }));
  cat[info.id] = catalog;
  checks.push(check);
}

/** Ghi JSON với khóa bia sắp theo năm, khóa "$…" ở cuối — chạy lại cho ra đúng từng byte. */
function writeSorted(file, obj, meta) {
  const ids = Object.keys(obj).filter((k) => !k.startsWith('$')).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  const out = {};
  for (const id of ids) out[id] = obj[id];
  Object.assign(out, meta);
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
}
writeSorted(OUT_NAMES, names, { $generated: 'tools/extract-stele-info.mjs — tên người đỗ thật theo bia (lớp tên trên thân bia)' });
writeSorted(OUT_CATALOG, cat, {
  $generated: 'tools/extract-stele-info.mjs — trường danh mục cho src/data/index.js, rút từ data/82-van-bia-tien-si.json; không sửa tay',
  $verify: 'vua: suy từ niên hiệu (ERA_KING, cần đối chiếu) · mota: câu đầu lời giới thiệu AI soạn (cần đối chiếu) · dynasty: chuẩn hóa theo dynasties.js (mục mơ hồ suy từ năm, cần đối chiếu) · còn lại lấy thẳng từ dữ liệu',
});

// ───── kiểm tra chéo toàn bộ (chỉ khi --all) ─────
if (ALL) {
  // niên hiệu: năm đầu niên hiệu = year − eraYear + 1 phải như nhau giữa các mục cùng niên hiệu
  const byEra = new Map();
  for (const c of checks) {
    const e = all.find((x) => Number(x.year) === c.year);
    const { era, eraYear } = parseTitle(e.title);
    if (!era || eraYear == null) continue;
    if (!byEra.has(era)) byEra.set(era, []);
    byEra.get(era).push({ c, start: c.year - eraYear + 1, eraYear });
  }
  for (const [era, list] of byEra) {
    const freq = new Map();
    for (const x of list) freq.set(x.start, (freq.get(x.start) ?? 0) + 1);
    const major = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    if (freq.size > 1) for (const x of list) if (x.start !== major) x.c.issues.push(`niên hiệu ${era} năm thứ ${x.eraYear} ↔ ${x.c.year} lệch với các mục khác cùng niên hiệu (năm đầu ${x.start} ≠ ${major})`);
  }
  // vua theo ERA_KING ↔ "đời/thời vua Lê X Tông" nêu trong historical_notes (dữ liệu), chỉ xét câu nói về khoa thi
  // (bỏ câu nói về dựng / khắc bia — vua lúc dựng bia khác vua lúc thi). Chỉ báo, không sửa.
  for (const c of checks) {
    const e = all.find((x) => Number(x.year) === c.year);
    const said = new Set();
    for (const n of e.historical_notes ?? []) {
      for (const sen of sentencesOf(n)) {
        // chỉ câu nói về CHÍNH khoa này: có năm 4 chữ số thì mọi năm đều là năm thi; không có năm thì phải nói về khoa / kỳ thi.
        // Bỏ câu về dựng / khắc bia (vua lúc dựng bia khác vua lúc thi).
        if (/dựng|khắc|truy/iu.test(sen)) continue;
        const ys = (sen.match(/\d{4}/g) || []).map(Number);
        if (ys.length ? ys.some((y) => y !== c.year) : !/khoa|kỳ thi|thi Hội|thi Đình/iu.test(sen)) continue;
        for (const m of sen.matchAll(/(?:đời|thời)\s+vua\s+((?:Lê|Mạc)\s+\p{Lu}\p{Ll}+\s+(?:Tông|Tổ))/gu)) said.add(m[1]);
      }
    }
    c.notesKing = [...said];
    c.kingByNotes = !said.size ? 'không nhắc' : c.king && [...said].some((s) => c.king.startsWith(s)) ? 'khớp' : 'khác';
    if (c.kingByNotes === 'khác') c.issues.push(`vua theo ERA_KING "${c.king ?? '—'}" ≠ ghi chú dữ liệu về khoa thi nhắc ${[...said].map((s) => `"vua ${s}"`).join(', ')}`);
  }
}

if (!QUIET) {
  const pad = (s, n) => String(s ?? '—').padEnd(n);
  console.log(`${pad('bia', 9)} ${pad('parse', 5)} ${pad('đoạn', 4)} ${pad('lk', 3)} ${pad('giáp', 4)} ${pad('đề danh/đỗ/ds', 14)} ${pad('lệch', 4)} ${pad('ký tự', 6)} ${pad('neo', 5)} ${pad('vua', 28)} ${pad('intro', 5)} ${pad('triều', 14)} đợt`);
  for (const c of checks) {
    console.log(`${pad(c.id, 9)} ${pad(c.parse, 5)} ${pad(c.paras, 4)} ${pad(c.colo, 3)} ${pad(c.groups, 4)} ${pad(`${c.rollNames}/${c.passed}/${c.laureates}`, 14)} ${pad(c.nameMismatch, 4)} ${pad(c.chars, 6)} ${pad(`${c.anchored}/${c.notes}`, 5)} ${pad(c.king ?? `(null: ${c.era ?? '?'})`, 28)} ${pad(c.intro ? 'có' : '—', 5)} ${pad(c.dynasty, 14)} ${c.dot ?? '—'}`);
  }
  const sum = (f) => checks.reduce((a, c) => a + f(c), 0);
  console.log(`\n${checks.length} bia · parse ok ${checks.filter((c) => c.parse === 'ok').length} / warn ${checks.filter((c) => c.parse !== 'ok').length}` +
    ` · đề danh = laureates ${checks.filter((c) => c.groups && c.rollNames === c.laureates).length}` +
    ` · có lạc khoản ${checks.filter((c) => c.colo > 0).length} · neo ${sum((c) => c.anchored)}/${sum((c) => c.notes)} ghi chú` +
    ` · có vua ${checks.filter((c) => c.king).length} · có intro ${checks.filter((c) => c.intro).length}`);
  for (const c of checks) if (c.issues.length) console.log(`  ${c.id}: ${c.issues.join(' | ')}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(checks, null, 1) + '\n');
