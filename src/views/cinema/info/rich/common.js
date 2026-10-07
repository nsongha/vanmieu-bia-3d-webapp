// r71 — tiện ích dùng chung của hai phương án thông tin mở rộng (lacquer.js · cinema.js) và lớp đọc / bảng vàng.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const linear = (t) => t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Tween một số thực, hướng lại được giữa chừng (đi tiếp từ giá trị hiện tại, không giật). */
export const tween = (v = 0) => ({ v, from: v, to: v, t0: 0, dur: 1, ease: linear });
export function aim(tw, to, now, full, ease, delay = 0) {
  if (tw.to === to) return;
  tw.from = tw.v;
  tw.to = to;
  tw.t0 = now + delay;
  tw.dur = Math.max(1e-3, full * Math.abs(to - tw.v));
  tw.ease = ease;
}
export function snap(tw, v) {
  tw.v = tw.from = tw.to = v;
}
export function advance(tw, now) {
  if (tw.v === tw.to) return;
  const t = (now - tw.t0) / tw.dur;
  if (t <= 0) return;
  tw.v = t >= 1 ? tw.to : tw.from + (tw.to - tw.from) * tw.ease(t);
}

/** Tạo phần tử: h('div', 'lớp', 'chữ') — chữ luôn là textContent (dữ liệu không bao giờ thành HTML). */
export function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** "huyện Thanh Oai, phủ Ứng Thiên" → "Thanh Oai · Ứng Thiên" (chỉ bỏ chữ chỉ cấp hành chính, không đổi địa danh). */
export const shortHome = (s) =>
  String(s ?? '')
    .split(',')
    .map((p) => p.trim().replace(/^(huyện|phủ|châu|xã|trấn)\s+/i, ''))
    .filter(Boolean)
    .join(' · ');

/** "LƯƠNG NHƯ HỘC" → "Lương Như Hộc" (tên trong danh sách đề danh của toàn văn viết hoa như trên bia). */
export const titleCase = (s) =>
  String(s ?? '')
    .toLocaleLowerCase('vi')
    .replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('vi'));

/** Người đỗ theo giáp: [{tier, label, list:[{name,title,hometown}]}]. */
export function tiersOf(info) {
  const out = [];
  for (const t of info?.tiers ?? []) {
    const list = (info.laureates ?? []).filter((l) => l.tier === t.tier);
    if (list.length) out.push({ tier: t.tier, label: t.label, list });
  }
  return out;
}

/** Ghép dòng đề danh của toàn văn với danh sách người đỗ (cùng thứ tự) để lấy tên viết thường chuẩn; lệch thì tự viết hoa đầu chữ. */
export function rollOf(info) {
  const people = info?.laureates ?? [];
  let k = 0;
  return (info?.content?.roll ?? []).map((g) => ({
    heading: g.heading,
    count: g.count,
    names: g.names.map((n) => {
      const p = people[k++];
      const same = p && p.name.toLocaleUpperCase('vi') === n.name.toLocaleUpperCase('vi');
      return { name: same ? p.name : titleCase(n.name), from: n.from };
    }),
  }));
}

/** Không ngắt dòng giữa các cụm phải đi liền ("Tiến sĩ", "Trạng nguyên", "Thám hoa", "Bảng nhãn"). */
export const nbsp = (s) => String(s ?? '').replace(/(Tiến|Trạng|Thám|Bảng|Đệ) (sĩ|nguyên|hoa|nhãn|nhất|nhị|tam)/g, '$1\u00a0$2');

const NUM = new Intl.NumberFormat('vi-VN');
export const fmtNum = (v) => (v == null ? '—' : NUM.format(v));

// ---------------------------------------------------------------- r79: dữ liệu của cả 82 bia (tools/extract-stele-info.mjs)
export const TIER_NAME = ['', 'Đệ nhất giáp', 'Đệ nhị giáp', 'Đệ tam giáp'];
const VAGUE = /^(không ghi|không rõ|không có|chưa rõ)(?=$|[\s,.;:)])/iu; // (\b của JS không hiểu chữ có dấu)
/**
 * Giá trị nguồn dùng được để HIỆN: bỏ phần "(Không ghi rõ tên)"…; "Không ghi" / "Không rõ" / rỗng → null (không bao giờ in các
 * chữ đó ra giao diện — chúng là dấu của dữ liệu, xem docs/kiem-duyet-du-lieu.md).
 */
export function known(v) {
  const s = String(v ?? '')
    .replace(/\s*\((?:không ghi|không rõ)[^)]*\)/giu, '')
    .trim();
  return s && !VAGUE.test(s) ? s : null;
}
/** Người soạn / người làm bia không ghi tên (vd. 1646 "Hàn lâm viện Đãi chế Tham tụng (Không ghi rõ tên)"). */
export const unnamed = (v) => v == null || /không ghi|không rõ/iu.test(String(v));
/** Can chi HIỆN: như tiêu đề bia (canChiTitle khi lệch với can chi tính từ năm — vd. 1514 "Quý Mùi"); can chi tính chỉ là dữ liệu. */
export const canChiShown = (info) => info?.canChiTitle ?? info?.canChi ?? '';
/**
 * Số sĩ tử dự thi: số chính xác → { n }; nguồn ghi mơ hồ → { q, n } ("hơn 750 người" → q "hơn", n 750) hoặc { words }
 * ("vài nghìn", "trên ba nghìn"); "Không ghi" → null.
 */
export function countOf(v, raw) {
  if (Number.isFinite(v)) return { n: v };
  const s0 = known(raw);
  if (!s0) return null;
  const s = s0.replace(/\s*người\s*$/iu, '').trim();
  const m = s.match(/^(.*?)\s*(\d[\d.,]*)$/u);
  if (m) {
    const n = Number(m[2].replace(/[.,]/g, ''));
    if (Number.isFinite(n)) return { q: m[1].trim(), n };
  }
  return { words: s };
}
export const countText = (c) => (!c ? '' : c.words ?? `${c.q ? `${c.q} ` : ''}${fmtNum(c.n)}`);
const TAM_KHOI = /trạng nguyên|bảng nhãn|thám hoa/iu;
/**
 * Giáp cao nhất CÓ người đỗ (nhiều bia không có Đệ nhất giáp) + có tam khôi không (Trạng nguyên / Bảng nhãn / Thám hoa trong
 * danh hiệu hay honors). rest = các giáp sau.
 */
export function topGroupOf(info) {
  const tiers = tiersOf(info);
  const g = tiers[0];
  if (!g) return null;
  const tam = g.tier === 1 && g.list.some((p) => TAM_KHOI.test(p.title ?? '') || (p.honors ?? []).some((x) => TAM_KHOI.test(x)));
  return { ...g, tam, rest: tiers.slice(1) };
}
/** Danh hiệu của một người đỗ (vd. "Đệ nhị danh · Bảng nhãn") — title + honors, không lặp. */
export const rankOf = (p) => [...new Set([p?.title, ...(Array.isArray(p?.honors) ? p.honors : [])].filter(Boolean))].join(' · ');
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Tiêu đề bia để hiện (nhiều bia nguồn viết HOA toàn bộ): chữ thường, viết hoa đầu câu, "Tiến sĩ", "Chế khoa", can chi (tiêu
 * đề) và niên hiệu đúng chính tả của dữ liệu. Không thêm / bớt chữ nào.
 */
export function steleTitle(info) {
  let s = String(info?.title ?? '').normalize('NFC').trim();
  if (!s) return '';
  s = s.toLocaleLowerCase('vi');
  s = s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
  s = s.replace(/tiến sĩ/gu, 'Tiến sĩ').replace(/chế khoa/gu, 'Chế khoa');
  for (const w of [info.canChiTitle, info.canChi, info.era]) if (w) s = s.replace(new RegExp(esc(w.toLocaleLowerCase('vi')), 'gu'), w);
  return s;
}

/** Ghép lời giới thiệu: cụm trong ngoặc kép “…” → <q> để in nghiêng / ánh vàng (vẫn là chữ thuần). */
export function introInto(el, text) {
  const s = String(text ?? '');
  const re = /“([^”]+)”/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) el.append(document.createTextNode(s.slice(last, m.index)));
    el.append(h('q', 'ri-q', m[1]));
    last = m.index + m[0].length;
  }
  if (last < s.length) el.append(document.createTextNode(s.slice(last)));
  return el;
}

/** Con trỏ tay: có hiện vòng con trỏ không (nam châm / chạm nút chỉ chạy khi hiện) — ?handCursor ghim, không thì cài đặt. */
export function handCursorShown(getSettings) {
  const q = new URLSearchParams(location.search).get('handCursor');
  if (q === 'shown' || q === 'hidden') return q === 'shown';
  return getSettings?.().gestureCursor === 'shown';
}
