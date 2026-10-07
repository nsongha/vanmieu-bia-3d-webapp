// r75 — GHI CHÚ BÊN LỀ của lớp đọc: cột bên phải NGOÀI tấm đọc (đối xứng mục lục bên trái), mỗi ghi chú canh theo dòng neo của
// nó trong văn bản (mốc span.rd-mk ở đầu cụm `match`, hoặc tên trong Đề danh) và trôi cùng lúc cuộn. Bắt đầu dưới nút Đóng;
// chồng nhau thì xếp xuống, cách tối thiểu GAP; neo ra khỏi tấm (hoặc bị đẩy quá mép dưới tấm) → mờ đi. Thu gọn: nhãn chữ hoa nhỏ
// + tối đa 2 dòng; rê chuột / tay tới → mở hết chữ trong thẻ (cùng kiểu thẻ Đề danh), đè lên ghi chú bên dưới.
import { h } from './common.js';
import { noteParts } from './extras.js';

const TOP_CLEAR = 66; // px dưới mép trên tấm: chừa nút Đóng (48 px) + khe
const GAP = 14; // px giữa hai ghi chú
const EDGE = 10; // px: neo phải cách mép trên / dưới tấm ngần này mới tính là còn trong tấm
const HAND_PAD = 26; // px quanh thẻ: tay trong vùng này thì mở thẻ

/**
 * @param {{ sheet: HTMLElement, scroll: HTMLElement, topClear?: (pr:DOMRect) => number,
 *   view?: (pr:DOMRect) => {top:number, bottom:number} }} o
 *   topClear: px (trong vùng chữ) ghi chú đầu phải nằm dưới · view: phần THẤY được của vùng chữ (mặc định cả vùng; r78 kiểu 3D:
 *   giao với màn — tấm cao hơn khung)
 */
export function createSidenotes({ sheet, scroll, topClear, view }) {
  const col = h('div', 'rd-side');
  col.setAttribute('aria-label', 'Ghi chú');
  sheet.append(col);
  /** @type {{ note:any, anchor:HTMLElement, el:HTMLElement, h:number, y:number, ay:number, on:boolean }[]} */
  let items = [];
  let handOpen = null;
  let mouseOpen = null;

  function setOpen(it, by) {
    if (by === 'mouse') mouseOpen = it;
    else handOpen = it;
    const want = new Set([mouseOpen, handOpen].filter(Boolean));
    for (const x of items) x.el.classList.toggle('is-open', want.has(x));
  }

  return {
    el: col,
    /** Dựng lại: list = [{ note, anchor }] (anchor = phần tử neo trong nội dung cuộn). */
    set(list) {
      col.replaceChildren();
      mouseOpen = handOpen = null;
      items = list.map(({ note, anchor }) => {
        // r80: nhãn chữ hoa nhỏ CHỈ khi nhãn là tiêu đề; còn lại một câu liền (thu gọn 3 dòng + "…", rê → hết chữ)
        const [label, rest] = noteParts(note);
        const el = h('aside', `rd-sn rd-sn--${note.kind === 'gloss' ? 'gloss' : 'note'}${label ? '' : ' rd-sn--plain'}`);
        if (label) el.append(h('p', 'rd-sn__l', label));
        el.append(h('p', 'rd-sn__t', rest));
        const it = { note, anchor, el, h: 0, y: 0, ay: 0, on: false };
        el.addEventListener('pointerenter', (e) => {
          if (e.pointerType === 'mouse' || e.pointerType === 'pen') setOpen(it, 'mouse');
        });
        el.addEventListener('pointerleave', (e) => {
          if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && mouseOpen === it) setOpen(null, 'mouse');
        });
        col.append(el);
        return it;
      });
    },
    /** Canh lại theo vị trí neo hiện tại (gọi khi cuộn / đổi cỡ / mở). */
    layout() {
      if (!items.length) return;
      const pr = scroll.getBoundingClientRect();
      if (!(pr.height > 0)) return;
      for (const it of items) {
        if (!it.el.classList.contains('is-open')) it.h = it.el.offsetHeight;
        const ar = it.anchor.getBoundingClientRect();
        it.ay = ar.top - pr.top;
      }
      const order = [...items].sort((a, b) => a.ay - b.ay);
      const vw = view ? view(pr) : { top: 0, bottom: pr.height };
      let cursor = Math.max(vw.top, topClear ? topClear(pr) : TOP_CLEAR);
      for (const it of order) {
        const inside = it.anchor.isConnected && it.ay >= vw.top + EDGE && it.ay <= vw.bottom - EDGE;
        const y = Math.max(it.ay - 3, cursor);
        it.y = y;
        it.on = inside && y + it.h <= vw.bottom;
        if (it.on) cursor = y + it.h + GAP;
        it.el.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`;
        it.el.classList.toggle('is-in', it.on);
      }
    },
    /** Tay (hand:frame): gần thẻ nào đang hiện → mở thẻ đó. Trả true nếu tay đang ở trên một ghi chú. */
    hand(d) {
      if (!d || !d.detected || d.pose === 'pinch' || d.pose === 'fist' || d.fist) {
        if (handOpen) setOpen(null, 'hand');
        return false;
      }
      let hit = null;
      for (const it of items) {
        if (!it.on) continue;
        const r = it.el.getBoundingClientRect();
        if (d.x >= r.left - HAND_PAD && d.x <= r.right + HAND_PAD && d.y >= r.top - HAND_PAD && d.y <= r.bottom + HAND_PAD) {
          hit = it;
          if (it === handOpen) break; // giữ thẻ đang mở khi hai vùng chồng nhau
        }
      }
      if (hit !== handOpen) setOpen(hit, 'hand');
      return !!hit;
    },
    close() {
      mouseOpen = handOpen = null;
      for (const it of items) it.el.classList.remove('is-open');
    },
    state() {
      const pr = scroll.getBoundingClientRect();
      return items.map((it) => {
        const r = it.el.getBoundingClientRect();
        return { label: it.el.querySelector('.rd-sn__l')?.textContent ?? '', key: String(it.note.text ?? '').slice(0, 40), labelKind: it.note.labelKind ?? null, kind: it.note.kind, on: it.on, open: it.el.classList.contains('is-open'), ay: +it.ay.toFixed(1), y: +it.y.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), left: +r.left.toFixed(1), right: +r.right.toFixed(1), panel: { left: pr.left, right: pr.right, top: pr.top, bottom: pr.bottom } };
      });
    },
  };
}
