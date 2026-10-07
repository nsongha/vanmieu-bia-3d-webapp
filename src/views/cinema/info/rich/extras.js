// r75 — THÔNG TIN THÊM của một bia (dữ liệu src/data/stele-info/<bia>.json — tools/extract-stele-info.mjs): ghi chú neo vào
// đoạn văn, giải nghĩa chức danh, những người làm bia (+ tên trùng ở bia khác), tỉ lệ đỗ, năm dựng bia, chuyện người đỗ, tiểu
// sử người soạn. Chỉ chữ (không huy hiệu / biểu tượng), mọi câu chữ lấy nguyên từ dữ liệu; câu nối do ở đây ghép thì KHÔNG khẳng
// định điều dữ liệu không nói (vd. tên trùng ở bia khác chỉ là "tên còn được ghi ở", không nói là cùng một người).
import { h, known } from './common.js';

/** Ghi chú dạng đối tượng (bỏ dạng chuỗi cũ). */
export const notesOf = (info) => (Array.isArray(info?.notes) ? info.notes.filter((n) => n && typeof n === 'object' && n.text) : []);

const lower = (s) => String(s ?? '').toLocaleLowerCase('vi');

/**
 * [nhãn TIÊU ĐỀ | null, phần còn lại] của một ghi chú. r80 (người dùng: "chỉ tách hai kiểu chữ khi phần đầu thật sự là tiêu
 * đề") — chỉ nhãn labelKind 'title' (tiêu đề / câu tóm tắt đứng riêng được, tools/extract-stele-info.mjs LABEL_TITLE) mới tách
 * thành nhãn chữ hoa nhỏ + thân (bỏ nhãn lặp ở đầu chữ "Nhãn: …"). Nhãn là vế dẫn chưa trọn câu ('inline': "… gồm", "… là")
 * và ghi chú không nhãn → [null, NGUYÊN VĂN] — một câu liền, một kiểu chữ (bỏ hẳn cách lấy năm chữ đầu làm nhãn).
 */
export function noteParts(n) {
  const t = String(n.text ?? '').trim();
  if (n.label && n.labelKind === 'title') {
    const L = String(n.label).trim();
    if (lower(t).startsWith(lower(L))) return [L, t.slice(L.length).replace(/^\s*[:—–-]\s*/, '')];
    return [L, t];
  }
  return [null, t];
}

/**
 * Dựng một đoạn văn có neo: `ns` = ghi chú neo vào đoạn này. Mỗi ghi chú một mốc không bề rộng (span.rd-mk) ở đầu cụm `match`
 * (không tìm thấy → đầu đoạn) — ghi chú bên lề canh theo dòng của mốc. Ghi chú giải nghĩa (kind 'gloss'): từng thuật ngữ trong
 * đoạn (tìm từ vị trí cụm `match` trước) thành span.rd-term (gạch chấm), mang { term, def, note }.
 * Trả { frag, marks: [{ note, el }] }.
 */
export function annotate(text, ns) {
  const s = String(text ?? '');
  const marks = [];
  const terms = [];
  for (const n of ns) {
    const at = n.anchor?.match ? s.indexOf(n.anchor.match) : -1;
    marks.push({ note: n, pos: Math.max(0, at), el: null });
    if (n.kind !== 'gloss') continue;
    for (const t of n.terms ?? []) {
      if (!t?.term) continue;
      let p = at >= 0 ? s.indexOf(t.term, at) : -1;
      if (p < 0) p = s.indexOf(t.term);
      if (p < 0) continue;
      const e = p + t.term.length;
      if (terms.some((x) => p < x.e && e > x.s)) continue;
      terms.push({ s: p, e, term: t.term, def: t.def, note: n });
    }
  }
  const evs = [...marks.map((m) => ({ at: m.pos, m })), ...terms.map((t) => ({ at: t.s, t }))].sort((a, b) => a.at - b.at || (a.m ? -1 : 1));
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const ev of evs) {
    if (ev.at > pos) {
      frag.append(s.slice(pos, ev.at));
      pos = ev.at;
    }
    if (ev.m) {
      const mk = h('span', 'rd-mk');
      mk.setAttribute('aria-hidden', 'true');
      ev.m.el = mk;
      frag.append(mk);
    } else if (ev.t.s >= pos) {
      const el = h('span', 'rd-term rd-hot', s.slice(ev.t.s, ev.t.e));
      el.tabIndex = -1;
      el._term = ev.t;
      frag.append(el);
      pos = ev.t.e;
    }
  }
  if (pos < s.length) frag.append(s.slice(pos));
  return { frag, marks };
}

/** "dựng bia năm 1484, 42 năm sau khoa thi, cùng đợt với 6 bia khác" (phần nào không có dữ liệu thì bỏ). */
export function erectionPhrase(info) {
  const e = info?.erection;
  const year = e?.year ?? info?.erected;
  if (!year) return '';
  const parts = [`dựng bia năm ${year}`];
  if (Number.isFinite(e?.gap) && e.gap > 0) parts.push(`${e.gap} năm sau khoa thi`);
  const others = (e?.batch?.count ?? 0) - 1;
  if (others > 0) parts.push(`cùng đợt với ${others} bia khác`);
  return parts.join(', ');
}

/** Nút / chữ năm của một bia khác: có trong ứng dụng → nút đi tới bia đó; không → chữ thường. */
export function yearLink(o, { hasStele, go, label } = {}) {
  const text = label ?? String(o.year ?? '');
  if (o.id && hasStele?.(o.id) && go) {
    const b = h('button', 'rd-yr', text);
    b.type = 'button';
    b.dataset.id = o.id;
    b.setAttribute('data-rt', '');
    b.setAttribute('data-magnet', '');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      go(o.id);
    });
    return b;
  }
  return h('span', 'rd-yr rd-yr--plain', text);
}

/**
 * Khối "Những người làm nên tấm bia" (cuối Lạc khoản): vai — tên; tên có trùng ở bia khác (crossRefs, cùng vai) thêm một
 * dòng "Tên X còn được ghi ở n bia khác: 1448 · 1463 …" — chỉ nói tên được ghi, KHÔNG nói là cùng một người.
 */
export function creditsBlock(info, nav) {
  // r79: tên "Không ghi" / phần "(Không ghi rõ tên)" không bao giờ hiện (1646: người soạn không ghi tên → còn chức danh)
  const credits = (info?.credits ?? []).map((c) => ({ ...c, name: known(c?.name) })).filter((c) => c.role && c.name);
  if (!credits.length) return null;
  const refs = info.crossRefs ?? [];
  const sec = h('div', 'rd-credits');
  sec.append(h('h4', 'rd-credits__h', 'Những người làm nên tấm bia'));
  const list = h('dl', 'rd-credits__l');
  for (const c of credits) {
    const row = h('div', 'rd-cr');
    const dd = h('dd', 'rd-cr__v');
    dd.append(h('span', 'rd-cr__n', c.name));
    const x = refs.find((r) => r.role === c.role && known(r.name) === c.name);
    if (x?.others?.length) {
      const p = h('p', 'rd-cr__x');
      p.append(`Tên ${c.name} còn được ghi ở ${x.others.length} bia khác: `);
      x.others.forEach((o, i) => {
        if (i) p.append(h('span', 'rd-cr__sep', ' · '));
        p.append(yearLink(o, nav));
      });
      dd.append(p);
    }
    row.append(h('dt', 'rd-cr__r', c.role), dd);
    list.append(row);
  }
  sec.append(list);
  return sec;
}

/** Thẻ tiểu sử (cùng kiểu thẻ Đề danh): tên + năm, (dòng hạng), mô tả, chức vụ, quê. `cls` = tiền tố lớp ('dd-card' | 'lq-card'). */
export function bioInto(el, bio, { rank = '', home = '', cls = 'dd-card' } = {}) {
  el.replaceChildren();
  const top = h('div', `${cls}__top`);
  top.append(h('span', `${cls}__n`, known(bio.name) ?? ''));
  const dates = known(bio.dates);
  if (dates) top.append(h('span', `${cls}__d`, dates.replace('-', '–')));
  el.append(top);
  if (rank) el.append(h('p', `${cls}__rank`, rank));
  if (known(home)) el.append(h('p', `${cls}__home`, home));
  if (known(bio.description)) el.append(h('p', `${cls}__bio`, bio.description));
  const roles = (bio.roles ?? []).map(known).filter(Boolean);
  if (roles.length) el.append(h('p', `${cls}__roles`, roles.slice(0, 4).join(' · ')));
  // (r79: quê "Không rõ" → bỏ)
  if (known(bio.hometown)) el.append(h('p', `${cls}__now`, bio.hometown));
  return el;
}

/**
 * Các mục cho dải chuyện ở tấm phải (lacquer): xen kẽ ghi chú (kind 'note') và chuyện người đỗ / người soạn — [{ kind, label,
 * text }]. Lọc "vừa ~2 dòng" do nơi hiển thị đo (fits).
 */
export function stripItems(info) {
  const notes = notesOf(info)
    .filter((n) => n.kind === 'note')
    .map((n) => {
      const [label, text] = noteParts(n);
      return { kind: 'note', label: label ?? '', text };
    });
  const stories = (info?.stories ?? [])
    .filter((s) => s?.name && s.description)
    .map((s) => ({ kind: 'story', label: known(s.dates) ? `${s.name} · ${known(s.dates).replace('-', '–')}` : s.name, text: s.description }));
  const out = [];
  for (let i = 0; i < Math.max(notes.length, stories.length); i++) {
    if (i < notes.length) out.push(notes[i]);
    if (i < stories.length) out.push(stories[i]);
  }
  return out;
}
