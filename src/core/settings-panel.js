// Bảng cài đặt dùng chung cho cả 3 view — nối hai chiều với kho core/settings.js.
// Không biết gì về view: mọi màu sắc/chữ nghĩa đến từ biến CSS đặt trên host
// (xem settings-panel.css). Bấm được bằng chuột, phím và CỬ CHỈ TAY
// (lớp cử chỉ "click" qua elementFromPoint → mọi thứ bấm được đều là <button>
// có handler thật, không phụ thuộc hover hay kéo thả).
import './settings-panel.css';
import {
  BG_OPTIONS, CINEMA_INFO_OPTIONS, NAV_ARROW_OPTIONS, TIMELINE_OPTIONS, PEDESTAL_COLOR_OPTIONS, PEDESTAL_SEP_OPTIONS,
  SPOT_COLOR_OPTIONS, PEDESTAL_PROFILE_OPTIONS, NAMES_STYLE_OPTIONS, RUB_COLOR_OPTIONS,
  GLIDE_RANGE, glideSeconds, MAX_FPS_OPTIONS, maxFps, AUTO_DWELL_OPTIONS, rippleSizeM, READER_GAP_RANGE,
  DEFAULTS, getSettings, setSetting, onSettings, resetSettings,
  TRANSITION_SPEC, FLY_MODE_OPTIONS, TITLE_FX_OPTIONS, GLYPH_LOOK_OPTIONS, readerTiming, resetTransitionSettings, tnum, topt,
} from './settings.js';
import { clearAllRub, rubLapsToMax } from './rub-store.js';
import { hasHanText } from '../data/hantext.js';

let uid = 0;

/* ---------- dấu "bảng đang mở" cho lớp cử chỉ tay (r18b) ----------
   <body data-modal="settings"> khi có ít nhất một bảng cài đặt đang HIỆN trên màn hình. Mỗi view mở / đóng theo cách
   riêng (Điện ảnh tạo rồi huỷ, Trưng bày ẩn host, Nghiên cứu gấp / mở trong bảng công cụ hoặc là một tab của tấm
   trượt) nên bảng tự theo dõi chính nó: có kích thước, nằm trong khung nhìn, không visibility: hidden. Lớp cử chỉ
   đọc dấu này: không chế độ điều hướng hai ngón (V không đổi bia phía sau), không zoom sâu; con trỏ + nhón vẫn chạy.
   Chỉ gỡ khi giá trị vẫn là của mình ('settings') — một hộp thoại khác có thể đang giữ dấu. */
const openPanels = new Set();
function syncModalMark() {
  const b = document.body;
  if (!b) return;
  if (openPanels.size) {
    if (!b.dataset.modal) b.dataset.modal = 'settings';
  } else if (b.dataset.modal === 'settings') {
    delete b.dataset.modal;
  }
}
/** Góc của hai nút "3/4" = độ lớn góc nhìn mặc định (đã tinh chỉnh: 20°); mặc định là chính diện thì 30°. */
const VIEW_34 = Math.abs(DEFAULTS.cinemaViewAngle) || 30;

/** Tab cuối cùng người xem mở (một giá trị cho cả 3 view; tab không có ở view hiện tại → tab đầu). */
const TAB_KEY = 'vm.settings.tab';

/**
 * Các tab của bảng. `only` = chỉ hiện ở những view này.
 * @type {Array<{id:string, label:string, only?:string[]}>}
 */
const TABS = [
  { id: 'display', label: 'Hiển thị' },
  { id: 'light', label: 'Ánh sáng', only: ['cinema'] },
  { id: 'motion', label: 'Chuyển cảnh' },
  { id: 'pedestal', label: 'Bục', only: ['cinema'] },
  { id: 'info', label: 'Thông tin', only: ['cinema'] }
];

function readTab() {
  try { return localStorage.getItem(TAB_KEY); } catch { return null; }
}
function writeTab(tab) {
  try { localStorage.setItem(TAB_KEY, tab); } catch { /* chế độ riêng tư */ }
}

const SHADOW_OPTS = [
  { id: 'off', label: 'Tắt' },
  { id: 'soft', label: 'Mềm' },
  { id: 'sharp', label: 'Sắc' },
];

/** Trạng thái của lớp điều khiển tay → câu chữ tiếng Việt. */
const HAND_TEXT = {
  'loading-model': 'Đang tải mô hình nhận dạng tay…',
  'requesting-camera': 'Đang xin quyền dùng camera…',
  ready: 'Sẵn sàng — giơ bàn tay trước camera.',
  stopped: 'Đã tắt.',
  error: 'Không bật được điều khiển tay.',
};

const el = (tag, cls, props) => Object.assign(document.createElement(tag), cls ? { className: cls } : null, props);
const fmtMul = (v) => '×' + Number(v).toFixed(2);
const fmtPct = (v) => (Number(v) <= 0 ? 'Tắt' : Math.round(Number(v) * 100) + '%');
const fmtMulOff = (v) => (Number(v) <= 0 ? 'Tắt' : fmtMul(v));
const fmtPctOnly = (v) => Math.round(Number(v) * 100) + '%';
const fmtDeg = (v) => Math.round(Number(v)) + '°';
const fmtSec = (v) => Number(v).toFixed(1).replace('.', ',') + ' s';
/** Hướng đèn nhìn từ trên: âm = từ bên trái người xem, 0 = chính diện. */
const fmtSide = (v) => {
  const d = Math.round(Number(v));
  return d === 0 ? 'Chính diện' : `${Math.abs(d)}° ${d < 0 ? 'bên trái' : 'bên phải'}`;
};
/** Góc nhìn mặc định: 0 = chính diện, còn lại độ có dấu (dương = sang phải). */
const fmtView = (v) => {
  const d = Math.round(Number(v));
  return d === 0 ? 'Chính diện' : `${d > 0 ? '+' : '−'}${Math.abs(d)}°`;
};
/** Chất liệu lòng bục: 0 = Đá … 1 = Kính đen. */
const fmtGlass = (v) => {
  const t = Number(v);
  return t <= 0 ? 'Đá' : t >= 1 ? 'Kính đen' : `${Math.round(t * 100)}% kính`;
};
/** Vị trí vệt sáng quanh bục: 0 = giữa chữ mặt trước (số năm). */
const fmtAround = (v) => {
  const d = Math.round(Number(v));
  return d === 0 ? 'Giữa' : `${Math.abs(d)}° ${d < 0 ? 'sang trái' : 'sang phải'}`;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function svgIcon(paths, { width = 20, stroke = 1.6 } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(width));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(stroke));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(ns, d.startsWith('circle:') ? 'circle' : 'path');
    if (d.startsWith('circle:')) {
      const [cx, cy, r] = d.slice(7).split(',');
      p.setAttribute('cx', cx); p.setAttribute('cy', cy); p.setAttribute('r', r);
    } else {
      p.setAttribute('d', d);
    }
    svg.appendChild(p);
  }
  return svg;
}

const GEAR = [
  'circle:12,12,3',
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
];

/**
 * Nút bánh răng 44px để view thả vào header/HUD. Ăn theo cùng bộ biến CSS với bảng.
 * @param {{label?:string, onClick?:(ev:MouseEvent)=>void}} [opts]
 * @returns {HTMLButtonElement}
 */
export function createSettingsButton({ label = 'Cài đặt', onClick } = {}) {
  const btn = el('button', 'sp sp-fab', { type: 'button', title: label });
  btn.appendChild(svgIcon(GEAR));
  btn.appendChild(el('span', 'sp-sr', { textContent: label }));
  // Điều khiển bằng tay (r18c): nút ở mép trên màn hình — hút con trỏ tay (vùng bấm = nút + ~60 px quanh nó).
  btn.setAttribute('data-magnet', '');
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Bảng cài đặt (~320px, cuộn được, cao tối đa 80vh), chia TAB. Tự gắn vào `host`;
 * host chịu trách nhiệm định vị (absolute/fixed) và đặt biến --sp-*.
 *
 *   gallery / lab : Hiển thị · Chuyển cảnh · Cử chỉ
 *   cinema        : Hiển thị · Ánh sáng · Chuyển cảnh · Bục · Thông tin · Cử chỉ
 *
 * Điện ảnh tách ánh sáng ra tab riêng (Ánh sáng · Đèn rọi · Bóng đổ): tab Hiển thị của nó còn Nền,
 * Mặt bục phản chiếu, Gỡ lỗi. Trưng bày / Nghiên cứu giữ nguyên Ánh sáng + Bóng đổ trong Hiển thị.
 *
 * @param {{view:'gallery'|'cinema'|'lab', host:HTMLElement, onClose?:()=>void, actions?:{presentNow?:()=>void, hoverZoomCap?:()=>({cap:number, by:string|null}), startTutorial?:()=>void}}} opts
 *   actions (r26): hành động của view hiện nút trong bảng — presentNow: "Trình chiếu ngay" (Điện ảnh, mục Tự trình chiếu);
 *   hoverZoomCap (r27z): mức zoom khi hover tối đa dùng được + phần đang kẹp → gợi ý dưới thanh "Zoom khi hover";
 *   startTutorial (r32): "Xem hướng dẫn" (tab Cử chỉ) — mở hướng dẫn cử chỉ 3 bước ngay.
 * @returns {{el: HTMLElement, destroy():void}}
 */
export function createSettingsPanel({ view, host, onClose, actions = null }) {
  const id = `sp${++uid}`;
  const root = el('div', 'sp sp-panel', { tabIndex: -1 });
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Cài đặt hiển thị');

  /** @type {Array<(s:object)=>void>} */
  const syncs = [];
  /** Đang tự cập nhật giao diện → bỏ qua vòng phản hồi. */
  let syncing = false;

  /**
   * Gắn handler "bấm" chịu được cả cử chỉ tay: lớp cử chỉ phát click tổng hợp nên
   * phải tự chặn khi nút đang bị vô hiệu (disabled / nằm trong vùng inert).
   */
  const onTap = (btn, fn) => btn.addEventListener('click', (ev) => {
    if (btn.disabled || btn.closest('[inert]')) return;
    fn(ev);
  });

  /* ---------- đầu bảng ---------- */
  const head = el('div', 'sp-head');
  head.appendChild(el('h2', 'sp-title', { textContent: 'Cài đặt' }));
  if (onClose) {
    const x = el('button', 'sp-x', { type: 'button', title: 'Đóng' });
    x.setAttribute('data-magnet', '');
    x.setAttribute('aria-label', 'Đóng bảng cài đặt');
    x.appendChild(svgIcon(['M18 6 6 18', 'M6 6l12 12'], { width: 16 }));
    x.addEventListener('click', () => onClose());
    head.appendChild(x);
  }
  root.appendChild(head);

  /* ---------- dải tab + vùng nội dung ---------- */
  const tabs = TABS.filter((t) => !t.only || t.only.includes(view));
  root.dataset.tabs = String(tabs.length);   // 6 tab (Điện ảnh) → bảng rộng hơn chút để đủ chỗ trên desktop
  // .sp-tabbar giữ đường kẻ dưới; .sp-tabs cuộn ngang + mờ dần ở mép khi còn tab khuất.
  const bar = el('div', 'sp-tabbar');
  const strip = el('div', 'sp-tabs');
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', 'Nhóm cài đặt');
  bar.appendChild(strip);
  const body = el('div', 'sp-body');
  root.append(bar, body);

  /** @type {Record<string, {tab:HTMLButtonElement, pane:HTMLElement}>} */
  const byId = {};
  for (const t of tabs) {
    const tab = el('button', 'sp-tab', { type: 'button', id: `${id}-tab-${t.id}`, textContent: t.label });
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-magnet', ''); // r18c: tab / nút chọn đoạn của bảng — hút con trỏ tay    tab.setAttribute('aria-controls', `${id}-pane-${t.id}`);
    tab.dataset.tab = t.id;
    const pane = el('div', 'sp-pane', { id: `${id}-pane-${t.id}` });
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', tab.id);
    strip.appendChild(tab);
    body.appendChild(pane);
    byId[t.id] = { tab, pane };
    tab.addEventListener('click', () => select(t.id, { remember: true }));
  }

  let active = null;
  /** Mở một tab. remember = do người xem chọn → ghi nhớ (không ghi khi chỉ rơi về tab đầu). */
  function select(tabId, { remember = false, focus = false } = {}) {
    const next = byId[tabId] ? tabId : tabs[0].id;
    if (next !== active) {
      for (const t of tabs) {
        const on = t.id === next;
        const { tab, pane } = byId[t.id];
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        pane.hidden = !on;
      }
      active = next;
      body.scrollTop = 0;
      revealTab(byId[next].tab);
    }
    if (remember) writeTab(next);
    if (focus) byId[next].tab.focus();
  }

  /** Dải tab cuộn ngang được khi chật: kéo tab đang chọn vào tầm nhìn (chỉ cuộn dải, không cuộn trang). */
  function revealTab(tab) {
    const l = tab.offsetLeft;
    const r = l + tab.offsetWidth;
    if (l < strip.scrollLeft) strip.scrollLeft = Math.max(0, l - 24);
    else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth + 24;
    updateFades();
  }

  /** Mép nào còn tab khuất thì mờ dần ở mép đó — gợi ý "cuộn được" mà không cần thanh cuộn. */
  function updateFades() {
    const max = strip.scrollWidth - strip.clientWidth;
    const start = strip.scrollLeft > 2;
    const end = strip.scrollLeft < max - 2;
    strip.dataset.fade = start && end ? 'both' : start ? 'start' : end ? 'end' : 'none';
  }
  strip.addEventListener('scroll', updateFades, { passive: true });

  // Bảng có thể được tạo lúc host còn ẩn (offset = 0) → khi dải tab có kích thước thật
  // (lần mở đầu, xoay máy) thì kéo lại tab đang chọn vào tầm nhìn. Theo dõi cả từng tab:
  // font web nạp xong làm tab rộng/hẹp đi mà dải không đổi cỡ → mép mờ phải tính lại.
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { if (active) revealTab(byId[active].tab); })
    : null;
  if (ro) {
    ro.observe(strip);
    for (const t of tabs) ro.observe(byId[t.id].tab);
  }

  // Bảng có đang hiện không → dấu body[data-modal] (xem openPanels ở đầu tệp). Theo dõi cỡ (display: none của host /
  // mục gấp) lẫn việc vào / ra khung nhìn (tấm trượt đáy trên mobile), và mọi thay đổi thuộc tính hidden của tổ tiên.
  const checkOpen = () => {
    let open = false;
    if (root.isConnected) {
      const r = root.getBoundingClientRect();
      open = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth &&
        getComputedStyle(root).visibility !== 'hidden';
    }
    if (open) openPanels.add(id);
    else openPanels.delete(id);
    syncModalMark();
  };
  const visRo = typeof ResizeObserver === 'function' ? new ResizeObserver(checkOpen) : null;
  visRo?.observe(root);
  const visIo = typeof IntersectionObserver === 'function' ? new IntersectionObserver(checkOpen) : null;
  visIo?.observe(root);

  strip.addEventListener('keydown', (ev) => {
    const i = tabs.findIndex((t) => t.id === active);
    let j = -1;
    if (ev.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (ev.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = tabs.length - 1;
    if (j < 0) return;
    ev.preventDefault();
    select(tabs[j].id, { remember: true, focus: true });
  });

  /** Tạo một nhóm có tiêu đề trong `parent` (một pane hoặc một khối con). */
  function section(title, parent) {
    const s = el('section', 'sp-sec');
    if (title) s.appendChild(el('h3', 'sp-h', { textContent: title }));
    parent.appendChild(s);
    return s;
  }

  /** Dòng chữ phụ màu nhạt. */
  const hint = (parent, text) => parent.appendChild(el('p', 'sp-desc', { textContent: text }));

  /* ---------- nút phân đoạn ---------- */
  /**
   * @param {HTMLElement} parent
   * @param {string} groupLabel
   * @param {Array<{id:string,label:string,color?:string}>} options
   * @param {string} path đường dẫn trong kho cài đặt
   * @param {(s:object)=>string} read
   */
  function segmented(parent, groupLabel, options, path, read) {
    const group = el('div', 'sp-seg');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', groupLabel);
    const buttons = options.map((o) => {
      const b = el('button', 'sp-opt', { type: 'button' });
      b.setAttribute('role', 'radio');
      b.setAttribute('data-magnet', '');
      b.dataset.id = o.id;
      if (o.color) {
        const sw = el('span', 'sp-sw');
        sw.style.setProperty('--c', o.color);
        b.appendChild(sw);
      }
      b.appendChild(el('span', null, { textContent: o.label }));
      if (o.title) { b.title = o.title; b.setAttribute('aria-label', o.title); }   // nhãn là ký hiệu (•, ◆…) → đọc tên
      onTap(b, () => setSetting(path, o.id));
      group.appendChild(b);
      return b;
    });
    // Bàn phím: mũi tên di chuyển trong nhóm (roving tabindex), như radiogroup chuẩn.
    group.addEventListener('keydown', (ev) => {
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1
        : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      const next = buttons[(Math.max(0, i) + dir + buttons.length) % buttons.length];
      setSetting(path, next.dataset.id);
      next.focus();
    });
    parent.appendChild(group);
    syncs.push((s) => {
      const value = read(s);
      for (const b of buttons) {
        const on = b.dataset.id === value;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
      if (!buttons.some((b) => b.tabIndex === 0) && buttons[0]) buttons[0].tabIndex = 0;
    });
    return group;
  }

  /** Segmented + dòng mô tả của lựa chọn đang bật (Chuyển cảnh, Hiện thông tin, Khung xem trước). */
  function segmentedWithDesc(parent, groupLabel, options, path, read) {
    segmented(parent, groupLabel, options, path, read);
    const desc = el('p', 'sp-desc');
    parent.appendChild(desc);
    syncs.push((s) => {
      const opt = options.find((o) => o.id === read(s)) ?? options[0];
      desc.textContent = opt.desc ?? '';
    });
  }

  /* ---------- thanh trượt ---------- */
  /**
   * @param {HTMLElement} parent
   * @param {{label:string, path:string, min:number, max:number, step:number,
   *          format:(v:number)=>string, read:(s:object)=>number}} cfg
   */
  function slider(parent, cfg) {
    const row = el('div', 'sp-row');
    const headRow = el('div', 'sp-rowhead');
    const label = el('label', 'sp-name', { htmlFor: `${id}-${cfg.path}`, textContent: cfg.label });
    const val = el('span', 'sp-val');
    headRow.append(label, val);

    const ctl = el('div', 'sp-ctl');
    const input = el('input', 'sp-range', {
      type: 'range', id: `${id}-${cfg.path}`,
      min: String(cfg.min), max: String(cfg.max), step: String(cfg.step),
    });
    // Hai nút −/+ : thanh trượt chỉ kéo được, mà lớp cử chỉ tay chỉ "bấm" được.
    // Ẩn khỏi trình đọc màn hình vì input range đã điều khiển được bằng phím.
    const mk = (sign, text) => {
      const b = el('button', 'sp-step', { type: 'button', textContent: text, tabIndex: -1 });
      b.setAttribute('aria-hidden', 'true');
      onTap(b, () => {
        const v = clamp(Number(input.value) + sign * cfg.step, cfg.min, cfg.max);
        setSetting(cfg.path, Number(v.toFixed(4)));
      });
      return b;
    };
    ctl.append(mk(-1, '−'), input, mk(1, '+'));
    input.addEventListener('input', () => {
      if (syncing || input.disabled) return;
      setSetting(cfg.path, Number(input.value));
    });

    row.append(headRow, ctl);
    parent.appendChild(row);
    syncs.push((s) => {
      const v = clamp(Number(cfg.read(s)), cfg.min, cfg.max);
      if (input.value !== String(v)) input.value = String(v);
      const text = cfg.format(v);
      val.textContent = text;
      input.setAttribute('aria-valuetext', text);
    });
    return row;
  }

  /* ---------- công tắc ---------- */
  function toggle(parent, { label, path, read }) {
    const row = el('div', 'sp-toggle');
    const name = el('span', 'sp-name', { id: `${id}-${path}-l`, textContent: label });
    const btn = el('button', 'sp-switch', { type: 'button' });
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-labelledby', name.id);
    const track = el('span', 'sp-track');
    track.appendChild(el('span', 'sp-knob'));
    btn.appendChild(track);
    onTap(btn, () => setSetting(path, btn.getAttribute('aria-checked') !== 'true'));
    row.append(name, btn);
    parent.appendChild(row);
    syncs.push((s) => btn.setAttribute('aria-checked', read(s) ? 'true' : 'false'));
    return row;
  }

  /* ---------- ô màu (preset + tuỳ chọn) ---------- */
  /**
   * Hàng ô màu dạng radiogroup: mỗi preset một ô, cuối cùng là ô "Tuỳ chọn" mở
   * <input type="color">. Giá trị không có trong danh sách → đánh dấu ô tuỳ chọn và tô màu đó.
   * compact: chỉ có chấm màu (tên nằm trong aria-label/title), ô 40×40 — cho nhóm đèn.
   * @param {HTMLElement} parent
   * @param {string} groupLabel
   * @param {Array<{id:string,label:string}>} options id = mã hex
   * @param {string} path
   * @param {(s:object)=>string} read
   * @param {{compact?:boolean}} [opt]
   */
  function colorSwatches(parent, groupLabel, options, path, read, { compact = false } = {}) {
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    const group = el('div', compact ? 'sp-colors sp-colors--compact' : 'sp-colors');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', groupLabel);

    const mkSwatch = (label) => {
      const b = el('button', 'sp-color', { type: 'button', title: label });
      b.setAttribute('role', 'radio');
      b.setAttribute('data-magnet', '');
      const chip = el('span', 'sp-chip');
      b.append(chip, el('span', compact ? 'sp-sr' : 'sp-clabel', { textContent: label }));
      group.appendChild(b);
      return { b, chip };
    };

    const presets = options.map((o) => {
      const { b, chip } = mkSwatch(o.label);
      chip.style.setProperty('--c', o.id);
      b.dataset.id = norm(o.id);
      onTap(b, () => setSetting(path, o.id));
      return b;
    });

    // Ô tuỳ chọn: input màu thật nằm ẩn (không display:none — Safari mới mở được).
    const custom = mkSwatch('Tuỳ chọn');
    custom.chip.classList.add('sp-chip--any');
    const picker = el('input', 'sp-sr', { type: 'color', tabIndex: -1 });
    picker.setAttribute('aria-hidden', 'true');
    group.appendChild(picker);
    onTap(custom.b, () => {
      // Bảng chọn màu gốc chỉ mở khi có thao tác thật của người dùng (chuột/chạm/phím).
      try { if (typeof picker.showPicker === 'function') { picker.showPicker(); return; } } catch { /* rơi xuống click() */ }
      picker.click();
    });
    picker.addEventListener('input', () => { if (!picker.disabled) setSetting(path, picker.value); });

    const all = [...presets, custom.b];
    group.addEventListener('keydown', (ev) => {
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1
        : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      const i = all.indexOf(document.activeElement);
      const next = all[(Math.max(0, i) + dir + all.length) % all.length];
      if (next !== custom.b) next.click();   // ô tuỳ chọn: chỉ chuyển focus, Enter/Space mới mở bảng màu
      next.focus();
    });
    parent.appendChild(group);

    syncs.push((s) => {
      const value = norm(read(s));
      const hit = presets.find((b) => b.dataset.id === value);
      for (const b of all) {
        const on = hit ? b === hit : b === custom.b;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
      const isCustom = !hit && /^#[0-9a-f]{3,8}$/.test(value);
      custom.chip.classList.toggle('sp-chip--any', !isCustom);
      if (isCustom) custom.chip.style.setProperty('--c', value); else custom.chip.style.removeProperty('--c');
      custom.b.setAttribute('aria-label', isCustom ? `Tuỳ chọn, ${value}` : 'Tuỳ chọn màu khác');
      if (/^#[0-9a-f]{6}$/.test(value) && picker.value !== value) picker.value = value;
    });
    return group;
  }

  /* ---------- nhóm đèn (Bục, Đèn rọi): cường độ + màu, gọn và giống hệt nhau ---------- */
  /**
   * @param {HTMLElement} parent
   * @param {{label:string, glowPath:string, colorPath:string, colorLabel?:string,
   *          options?:Array<{id:string,label:string}>}} cfg
   */
  function lightGroup(parent, { label, glowPath, colorPath, colorLabel, options = PEDESTAL_COLOR_OPTIONS }) {
    const card = el('div', 'sp-light');
    parent.appendChild(card);
    slider(card, {
      label, path: glowPath, min: 0, max: 2, step: 0.05, format: fmtMulOff,
      read: (s) => s[glowPath] ?? 1,
    });
    colorSwatches(card, colorLabel ?? `Màu ${label.toLowerCase()}`, options, colorPath, (s) => s[colorPath], { compact: true });
    // Đèn đang tắt: ô màu nhạt đi (vẫn chọn trước được).
    syncs.push((s) => card.classList.toggle('is-dark', !(Number(s[glowPath]) > 0)));
    return card;
  }

  /**
   * Khối phụ thuộc một công tắc: khi tắt thì mờ đi và KHÔNG bấm được
   * (inert + disabled — lớp cử chỉ phát click tổng hợp, nên chặn cả hai tầng).
   */
  function dependent(parent, isOn) {
    const box = el('div', 'sp-dep');
    parent.appendChild(box);
    syncs.push((s) => {
      const on = !!isOn(s);
      box.inert = !on;
      box.classList.toggle('is-off', !on);
      box.setAttribute('aria-disabled', on ? 'false' : 'true');
      for (const c of box.querySelectorAll('button, input')) c.disabled = !on;
    });
    return box;
  }

  /**
   * Hàng nút chọn nhanh cho một giá trị SỐ (vd. góc nhìn): mỗi nút đặt đúng một giá trị; giá trị hiện tại
   * không trùng nút nào → không nút nào được chọn. Cùng kiểu dáng / bàn phím với segmented.
   * @param {HTMLElement} parent
   * @param {string} groupLabel
   * @param {Array<{v:number,label:string}>} options
   * @param {string} path
   * @param {(s:object)=>number} read
   */
  function numberChips(parent, groupLabel, options, path, read) {
    const group = el('div', 'sp-seg');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', groupLabel);
    const buttons = options.map((o) => {
      const b = el('button', 'sp-opt', { type: 'button' });
      b.setAttribute('role', 'radio');
      b.setAttribute('data-magnet', '');
      b.appendChild(el('span', null, { textContent: o.label }));
      onTap(b, () => setSetting(path, o.v));
      group.appendChild(b);
      return { b, v: o.v };
    });
    group.addEventListener('keydown', (ev) => {
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1
        : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      const i = buttons.findIndex((x) => x.b === document.activeElement);
      const next = buttons[(Math.max(0, i) + dir + buttons.length) % buttons.length];
      setSetting(path, next.v);
      next.b.focus();
    });
    parent.appendChild(group);
    syncs.push((s) => {
      const value = Number(read(s));
      for (const { b, v } of buttons) {
        const on = Math.abs(v - value) < 0.5;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
      if (!buttons.some(({ b }) => b.tabIndex === 0) && buttons[0]) buttons[0].b.tabIndex = 0;
    });
  }

  /** Nhãn hai đầu thanh trượt (vd. Đá ↔ Kính đen), thẳng hàng với rãnh trượt. */
  const ends = (parent, left, right) => {
    const row = el('div', 'sp-ends');
    row.setAttribute('aria-hidden', 'true');
    row.append(el('span', null, { textContent: left }), el('span', null, { textContent: right }));
    parent.appendChild(row);
  };

  /* ============================== Tab: Hiển thị ============================== */
  const pDisplay = byId.display.pane;
  const bgOptions = BG_OPTIONS[view] ?? BG_OPTIONS.gallery;
  const secBg = section('Nền', pDisplay);
  segmented(secBg, 'Nền', bgOptions, `bg.${view}`, (s) => s.bg?.[view]);
  if (view === 'cinema') {
    slider(secBg, { label: 'Độ tối nền', path: 'cinemaBgDark', min: 0, max: 1, step: 0.05, format: fmtPctOnly, read: (s) => s.cinemaBgDark ?? DEFAULTS.cinemaBgDark });
    hint(secBg, 'Tối nền, sương và vũng sáng sàn quanh sân khấu; không đổi ánh sáng trên bia và bục. 100% = đen tuyệt đối.');

    const secView = section('Góc nhìn mặc định', pDisplay);
    numberChips(secView, 'Góc nhìn mặc định', [{ v: 0, label: 'Chính diện' }, { v: -VIEW_34, label: '3/4 trái' }, { v: VIEW_34, label: '3/4 phải' }], 'cinemaViewAngle', (s) => s.cinemaViewAngle ?? DEFAULTS.cinemaViewAngle);
    slider(secView, { label: 'Góc camera', path: 'cinemaViewAngle', min: -45, max: 45, step: 1, format: fmtView, read: (s) => s.cinemaViewAngle ?? DEFAULTS.cinemaViewAngle });
    hint(secView, 'Camera về góc này khi mở bia, sau mỗi lần chuyển cảnh và khi đặt lại khung. 3/4 cho thấy mặt hông bia — có chiều sâu hơn.');
    toggle(secView, { label: 'Xoay chính diện khi hover', path: 'cinemaHoverFront', read: (s) => s.cinemaHoverFront !== false });
    const zoomBox = dependent(secView, (s) => s.cinemaHoverFront !== false);
    slider(zoomBox, { label: 'Zoom khi hover', path: 'cinemaHoverZoom', min: 0, max: 0.25, step: 0.01, format: fmtPct, read: (s) => s.cinemaHoverZoom ?? DEFAULTS.cinemaHoverZoom });
    // r27z: mức đặt vượt giới hạn thật (kiểu thông tin cần chỗ / tự đặt khung, hay khung hình quá thấp cho tấm bia) → nói rõ,
    // không lặng lẽ bỏ qua giá trị
    if (typeof actions?.hoverZoomCap === 'function') {
      const capHint = el('p', 'sp-desc');
      capHint.style.display = 'none';
      zoomBox.appendChild(capHint);
      syncs.push((s) => {
        const want = Number(s.cinemaHoverZoom ?? DEFAULTS.cinemaHoverZoom);
        let c = null;
        try {
          c = actions.hoverZoomCap();
        } catch {}
        const limited = !!c && Number.isFinite(c.cap) && want > c.cap + 0.004;
        capHint.style.display = limited ? '' : 'none';
        if (!limited) return;
        const n = Math.round(c.cap * 100);
        capHint.textContent =
          c.by === 'framing' ? 'Kiểu thông tin này tự đặt khung — không zoom khi hover.' : c.by === 'info' ? `Kiểu thông tin này giới hạn ở ${n} %.` : `Khung hình hiện tại giới hạn ở ${n} % (tấm bia phải nằm gọn trong khung).`;
      });
    }
    hint(secView, 'Rê lên bia: camera vòng về chính diện, tiến gần một chút và đèn sáng lên; rời bia thì từ từ về lại góc trên. Zoom tự giảm nếu thông tin hai bên không còn đủ chỗ.');

    // r20: kiểu mũi tên chuyển bia hai bên (chuột, cảm ứng, phím, tay — kể cả dạng lớn khi điều hướng hai ngón)
    const secArrows = section('Mũi tên hai bên', pDisplay);
    segmentedWithDesc(secArrows, 'Kiểu mũi tên', NAV_ARROW_OPTIONS, 'cinemaArrows', (s) => s.cinemaArrows ?? DEFAULTS.cinemaArrows);

    // r24 → r43: kiểu dòng thời gian 82 bia (Thước khắc · Sợi chỉ) — màn hẹp luôn thu về một sợi chỉ
    const secTimeline = section('Dòng thời gian', pDisplay);
    segmentedWithDesc(secTimeline, 'Kiểu dòng thời gian', TIMELINE_OPTIONS, 'cinemaTimeline', (s) => s.cinemaTimeline ?? DEFAULTS.cinemaTimeline);
  }

  // Điện ảnh: ánh sáng có tab riêng; Trưng bày / Nghiên cứu: vẫn nằm trong Hiển thị như cũ.
  const pLight = byId.light ? byId.light.pane : pDisplay;
  const secLight = section('Ánh sáng', pLight);
  slider(secLight, { label: 'Độ sáng', path: 'exposure', min: 0.6, max: 1.6, step: 0.02, format: fmtMul, read: (s) => s.exposure });
  // Điện ảnh: "Đèn chính" nằm trong khối riêng bên dưới (cùng khoá `key`, kèm màu / hướng / suy giảm).
  if (!byId.light) slider(secLight, { label: 'Đèn chính', path: 'key', min: 0, max: 2, step: 0.05, format: fmtMul, read: (s) => s.key });
  slider(secLight, { label: 'Môi trường', path: 'env', min: 0, max: 2, step: 0.05, format: fmtMul, read: (s) => s.env });
  if (view === 'cinema') {
    slider(secLight, { label: 'Tương phản khi chưa hover', path: 'cinemaContrast', min: 0, max: 1, step: 0.05, format: fmtPct, read: (s) => s.cinemaContrast ?? DEFAULTS.cinemaContrast });
    hint(secLight, 'Chưa hover: đèn rọi sáng từ góc trên trái, tối dần xuống. Hover bia: sáng đều lên. 0% = lúc nào cũng sáng đều (tắt đèn rọi).');
  }

  if (byId.light) {
    /* ---- Đèn chính (Điện ảnh): cường độ dùng chung `key` + màu, hướng, độ suy giảm ---- */
    const secKey = section('Đèn chính', pLight);
    lightGroup(secKey, { label: 'Cường độ', glowPath: 'key', colorPath: 'keyColor', colorLabel: 'Màu đèn chính', options: SPOT_COLOR_OPTIONS });
    const keyShape = dependent(secKey, (s) => Number(s.key ?? DEFAULTS.key) > 0);
    slider(keyShape, { label: 'Hướng chiếu', path: 'keyAzimuth', min: -90, max: 90, step: 1, format: fmtSide, read: (s) => s.keyAzimuth ?? DEFAULTS.keyAzimuth });
    slider(keyShape, { label: 'Độ cao đèn', path: 'keyElevation', min: 10, max: 85, step: 1, format: fmtDeg, read: (s) => s.keyElevation ?? DEFAULTS.keyElevation });
    slider(keyShape, { label: 'Độ suy giảm', path: 'keyFalloff', min: 0, max: 1, step: 0.05, format: fmtPct, read: (s) => s.keyFalloff ?? DEFAULTS.keyFalloff });
    hint(secKey, 'Suy giảm: đèn càng gần bia thì phía trên càng sáng, xuống tới rùa tối dần — bớt cảm giác "phẳng". Tắt = đèn ở rất xa, sáng đều. Giữa thân bia luôn sáng như nhau.');

    /* ---- Đèn rọi (Điện ảnh): chỉ sáng khi chưa hover → cần Tương phản > 0 ---- */
    const secSpot = section('Đèn rọi', pLight);
    const spotLive = (s) => Number(s.cinemaContrast ?? DEFAULTS.cinemaContrast) > 0;
    const spotBox = dependent(secSpot, spotLive);
    lightGroup(spotBox, { label: 'Cường độ', glowPath: 'spotIntensity', colorPath: 'spotColor', colorLabel: 'Màu đèn rọi', options: SPOT_COLOR_OPTIONS });
    // Hình chùm + hướng: vô nghĩa khi đèn tắt → mờ đi (vẫn đọc được giá trị).
    const spotShape = dependent(spotBox, (s) => spotLive(s) && Number(s.spotIntensity ?? DEFAULTS.spotIntensity) > 0);
    slider(spotShape, { label: 'Độ rộng chùm', path: 'spotAngle', min: 6, max: 35, step: 1, format: fmtDeg, read: (s) => s.spotAngle ?? DEFAULTS.spotAngle });
    slider(spotShape, { label: 'Độ mềm mép chùm', path: 'spotSoftness', min: 0, max: 1, step: 0.05, format: fmtPctOnly, read: (s) => s.spotSoftness ?? DEFAULTS.spotSoftness });
    slider(spotShape, { label: 'Hướng chiếu', path: 'spotAzimuth', min: -90, max: 90, step: 1, format: fmtSide, read: (s) => s.spotAzimuth ?? DEFAULTS.spotAzimuth });
    slider(spotShape, { label: 'Độ cao đèn', path: 'spotElevation', min: 30, max: 88, step: 1, format: fmtDeg, read: (s) => s.spotElevation ?? DEFAULTS.spotElevation });
    hint(secSpot, 'Đèn đứng yên, bia lướt vào và ra khỏi vùng sáng. Độ rộng chùm là nửa góc mở, tính từ tâm ra mép. Chỉ sáng khi chưa hover.');

    /* ---- Bóng đổ (Điện ảnh): tách khỏi Kiểu bóng / Độ đậm của hai chế độ kia ---- */
    const secCast = section('Bóng đổ', pLight);
    slider(secCast, { label: 'Bóng của đèn rọi', path: 'cinemaCastShadow', min: 0, max: 1.5, step: 0.05, format: fmtMulOff, read: (s) => s.cinemaCastShadow ?? DEFAULTS.cinemaCastShadow });
    hint(secCast, 'Đổ từ hướng đèn rọi xuống sàn, lên bục và lên chính bia; đậm nhất khi chưa hover, nhạt dần theo đèn. Tắt = không tính bóng (nhẹ máy hơn).');
    slider(secCast, { label: 'Bóng tiếp xúc', path: 'contactShadow', min: 0, max: 1.5, step: 0.05, format: fmtMulOff, read: (s) => s.contactShadow ?? DEFAULTS.contactShadow });
    hint(secCast, 'Quầng tối ngay dưới chân rùa trên mặt bục, lúc nào cũng có.');
    const floorAo = dependent(secCast, (s) => s.cinemaPedestal !== false);
    slider(floorAo, { label: 'Bóng chân bục', path: 'pedestalFloorShadow', min: 0, max: 1.5, step: 0.05, format: fmtMulOff, read: (s) => s.pedestalFloorShadow ?? DEFAULTS.pedestalFloorShadow });
    hint(floorAo, 'Vành tối trên sàn sát quanh chân bục (cần bật bục).');
  } else {
    const secShadow = section('Bóng đổ', pDisplay);
    segmented(secShadow, 'Kiểu bóng đổ', SHADOW_OPTS, 'shadow', (s) => s.shadow);
    slider(secShadow, { label: 'Độ đậm', path: 'shadowOpacity', min: 0, max: 1.5, step: 0.05, format: fmtMul, read: (s) => s.shadowOpacity });
  }

  // Điện ảnh: sàn không phản chiếu nữa, mặt trên của bục (chỗ rùa đứng) phản chiếu thay → cần bật bục.
  const secFloor = section(view === 'cinema' ? 'Mặt bục phản chiếu' : 'Sàn phản chiếu', pDisplay);
  const floorBox = view === 'cinema' ? dependent(secFloor, (s) => s.cinemaPedestal) : secFloor;
  slider(floorBox, { label: 'Độ phản chiếu', path: 'reflection', min: 0, max: 1, step: 0.05, format: fmtPct, read: (s) => s.reflection });
  if (view === 'cinema') {
    slider(floorBox, { label: 'Chất liệu mặt bục', path: 'dishGlass', min: 0, max: 1, step: 0.05, format: fmtGlass, read: (s) => s.dishGlass ?? DEFAULTS.dishGlass });
    ends(floorBox, 'Đá', 'Kính đen');
    // r63 (người dùng: "bề mặt bục đang phẳng tuyệt đối. tôi muốn nhăn nhẹ … cho các điều chỉnh vào settings"): mặt bục gợn nhẹ
    const ripWrap = el('div', 'sp-sub');
    ripWrap.appendChild(el('span', 'sp-name', { textContent: 'Mặt bục' }));
    floorBox.appendChild(ripWrap);
    const fmtRipple = (v) => (Number(v) <= 0 ? 'Phẳng' : fmtPctOnly(v));
    slider(floorBox, { label: 'Độ nhăn', path: 'pedestalRipple', min: 0, max: 1, step: 0.05, format: fmtRipple, read: (s) => s.pedestalRipple ?? DEFAULTS.pedestalRipple });
    const ripBox = dependent(floorBox, (s) => s.cinemaPedestal !== false && Number(s.pedestalRipple ?? DEFAULTS.pedestalRipple) > 0);
    slider(ripBox, { label: 'Kích thước gợn', path: 'pedestalRippleSize', min: 0, max: 1, step: 0.05, format: (v) => `~${Math.round((rippleSizeM(v) * 100) / 3)} cm`, read: (s) => s.pedestalRippleSize ?? DEFAULTS.pedestalRippleSize });
    ends(ripBox, 'Mịn', 'Rộng');
    toggle(ripBox, { label: 'Chuyển động nhẹ', path: 'pedestalRippleDrift', read: (s) => !!s.pedestalRippleDrift });
    hint(ripBox, 'Vân trôi rất chậm, chỉ khi cảnh đang chuyển động (lướt, xoay…) — đứng yên thì mặt bục cũng đứng yên.');
  }

  // r32: âm thanh phản hồi (core/sound.js) — Điện ảnh
  if (view === 'cinema') {
    const secSound = section('Âm thanh', pDisplay);
    toggle(secSound, { label: 'Âm thanh phản hồi', path: 'sound', read: (s) => s.sound !== false });
    const soundBox = dependent(secSound, (s) => s.sound !== false);
    slider(soundBox, { label: 'Âm lượng', path: 'soundVolume', min: 0, max: 1, step: 0.05, format: fmtPctOnly, read: (s) => s.soundVolume ?? DEFAULTS.soundVolume });
    hint(secSound, 'Tiếng mõ gỗ khi nhón / chọn, chuông nhỏ khi xong một bước hướng dẫn, gõ khẽ khi đổi bia. Trình duyệt chỉ cho phát tiếng sau lần bấm chuột / phím đầu tiên (máy kiosk: xem README).');
  }

  // r40: trần khung hình của cảnh 3D (core/renderer.js) — mọi view. Hạ xuống để nhường GPU cho nhận diện tay.
  const secFps = section('Khung hình', pDisplay);
  const fpsHead = el('div', 'sp-rowhead');
  fpsHead.appendChild(el('span', 'sp-name', { textContent: 'FPS tối đa' }));
  secFps.appendChild(fpsHead);
  numberChips(secFps, 'FPS tối đa', MAX_FPS_OPTIONS.map((v) => ({ v, label: String(v) })), 'maxFps', (s) => maxFps(s));
  hint(secFps, 'Số khung hình cảnh 3D vẽ tối đa mỗi giây. 60 là mặc định; 30 nhường máy cho nhận diện tay (tay nhạy và ổn định hơn), chuyển động vẫn đúng tốc độ; 120 chỉ có tác dụng trên màn hình 120 Hz.');

  toggle(section('Gỡ lỗi', pDisplay), { label: 'Hiện FPS góc trên trái', path: 'showFps', read: (s) => !!s.showFps });

  /* ============================== Tab: Chuyển cảnh ============================== */
  const pMotion = byId.motion.pane;
  toggle(section('Chuyển động', pMotion), { label: 'Tự xoay khi rảnh', path: 'autoRotate', read: (s) => s.autoRotate });
  // r35 (Điện ảnh): thời gian một lượt "Lướt" — áp cho lượt chuyển kế tiếp (lượt đang chạy giữ nhịp của nó). Chỉ Điện ảnh:
  // Trưng bày / Nghiên cứu giữ 1,6 s (lớp cử chỉ canh nhịp đổi bia ở hai view đó theo bảng thời lượng cố định).
  // B: chuyển cảnh chỉ còn "Lướt" → không còn ô chọn kiểu.
  if (view === 'cinema') {
    const secTx = section('Chuyển cảnh', pMotion);
    slider(secTx, { label: 'Thời gian lướt', path: 'glideDuration', ...GLIDE_RANGE, format: fmtSec, read: (s) => glideSeconds(s) });
    hint(secTx, 'Mặc định 1,6 s — nhỏ hơn là lướt nhanh hơn.');
  }

  /* ============================== Tab: Bục (Điện ảnh) ============================== */
  if (byId.pedestal) {
    const pPed = byId.pedestal.pane;
    toggle(section('Bục trưng bày', pPed), { label: 'Hiện bục dưới bia', path: 'cinemaPedestal', read: (s) => !!s.cinemaPedestal });

    const dep = dependent(pPed, (s) => s.cinemaPedestal);
    const secSize = section('Kích thước', dep);
    slider(secSize, { label: 'Cỡ bục', path: 'pedestalSize', min: 0.95, max: 1.4, step: 0.05, format: fmtMul, read: (s) => s.pedestalSize ?? DEFAULTS.pedestalSize });

    const secText = section('Chữ khắc', dep);
    slider(secText, { label: 'Cỡ chữ', path: 'pedestalText', min: 0.4, max: 1, step: 0.05, format: fmtPctOnly, read: (s) => s.pedestalText ?? DEFAULTS.pedestalText });
    slider(secText, { label: 'Độ nổi', path: 'pedestalRelief', min: 0.2, max: 1.5, step: 0.05, format: fmtMul, read: (s) => s.pedestalRelief ?? DEFAULTS.pedestalRelief });
    slider(secText, { label: 'Độ sắc', path: 'pedestalSharp', min: 0, max: 1, step: 0.05, format: fmtPctOnly, read: (s) => s.pedestalSharp ?? DEFAULTS.pedestalSharp });
    const profHead = el('div', 'sp-rowhead');
    profHead.appendChild(el('span', 'sp-name', { textContent: 'Profile mép' }));
    secText.appendChild(profHead);
    segmented(secText, 'Profile mép chữ', PEDESTAL_PROFILE_OPTIONS, 'pedestalProfile', (s) => s.pedestalProfile ?? DEFAULTS.pedestalProfile);
    const sepHead = el('div', 'sp-rowhead');
    sepHead.appendChild(el('span', 'sp-name', { textContent: 'Dấu ngăn cách' }));
    secText.appendChild(sepHead);
    segmented(secText, 'Dấu ngăn cách', PEDESTAL_SEP_OPTIONS, 'pedestalSep', (s) => s.pedestalSep ?? DEFAULTS.pedestalSep);

    const secHl = section('Vệt sáng mặt vát', dep);
    slider(secHl, { label: 'Độ sáng vệt', path: 'pedestalHighlight', min: 0, max: 2, step: 0.05, format: fmtMulOff, read: (s) => s.pedestalHighlight ?? DEFAULTS.pedestalHighlight });
    const hlPos = dependent(secHl, (s) => s.cinemaPedestal !== false && Number(s.pedestalHighlight ?? DEFAULTS.pedestalHighlight) > 0);
    slider(hlPos, { label: 'Vị trí vệt', path: 'pedestalHighlightPos', min: -90, max: 90, step: 1, format: fmtAround, read: (s) => s.pedestalHighlightPos ?? DEFAULTS.pedestalHighlightPos });
    hint(secHl, 'Làm rõ số năm khi chưa hover. Vệt đứng yên trên bục: Giữa = ngay số năm ở mặt trước, dù nhìn thẳng hay nhìn 3/4.');

    const secLamps = section('Đèn', dep);
    lightGroup(secLamps, { label: 'Đèn trên', glowPath: 'pedestalTopGlow', colorPath: 'pedestalTopColor' });
    lightGroup(secLamps, { label: 'Đèn dưới', glowPath: 'pedestalBottomGlow', colorPath: 'pedestalBottomColor' });
    hint(secLamps, 'Đèn bục sáng lên khi rê tay hoặc chuột lên bia.');
  }

  /* ============================== Tab: Thông tin (Điện ảnh) ============================== */
  if (byId.info) {
    const secInfo = section('Hiện thông tin', byId.info.pane);
    segmentedWithDesc(secInfo, 'Cách hiện thông tin', CINEMA_INFO_OPTIONS, 'cinemaInfo', (s) => s.cinemaInfo);
    hint(secInfo, 'Rê tay hoặc chuột lên tấm bia để hiện thông tin.');
    // r71 → r72: thông tin mở rộng từ văn bia (r79: cả 82 bia có dữ liệu) — một thiết kế; tắt = bình phong gốc
    const richBox = dependent(secInfo, (s) => (s.cinemaInfo ?? 'screens') === 'screens');
    toggle(richBox, { label: 'Thông tin mở rộng', path: 'cinemaInfoRich', read: (s) => s.cinemaInfoRich !== false });
    hint(richBox, 'Bia có văn bia: tên vua, người đỗ, lời giới thiệu, toàn văn và đề danh xem toàn màn hình. Tắt: bình phong gốc.');
    // r84 (người dùng: "cho tôi cả các setting cho transition zoom vào toàn văn bia"): hai nhóm cạnh nhau — "Bảng đọc" (bố cục) ·
    // "Chuyển cảnh toàn văn" (mọi nhịp mở / đóng, nút xem thử, khôi phục mặc định của riêng nhóm)
    const readDep = dependent(byId.info.pane, (s) => (s.cinemaInfo ?? 'screens') === 'screens' && s.cinemaInfoRich !== false);
    const secLayout = section('Bảng đọc', readDep);
    // r78: kiểu bảng đọc (tấm nổi 3D trước bia · phẳng) + khoảng cách chữ – bia (kiểu 3D) · r77: độ cong vòm
    const rmHead = el('div', 'sp-rowhead');
    rmHead.appendChild(el('span', 'sp-name', { textContent: 'Kiểu bảng đọc' }));
    secLayout.appendChild(rmHead);
    segmented(secLayout, 'Kiểu bảng đọc', [{ id: '3d', label: 'Nổi 3D' }, { id: 'flat', label: 'Phẳng' }], 'readerMode', (s) => s.readerMode ?? DEFAULTS.readerMode);
    const gapBox = dependent(secLayout, (s) => (s.readerMode ?? DEFAULTS.readerMode) === '3d');
    slider(gapBox, { label: 'Khoảng cách chữ – bia', path: 'readerGap', min: READER_GAP_RANGE.min, max: READER_GAP_RANGE.max, step: READER_GAP_RANGE.step, format: (v) => Number(v).toFixed(2), read: (s) => s.readerGap ?? DEFAULTS.readerGap });
    slider(secLayout, { label: 'Độ cong vòm bảng đọc', path: 'readerArch', min: 0, max: 1, step: 0.05, format: (v) => (Number(v) <= 0 ? 'Phẳng' : Math.round(Number(v) * 100) + '%'), read: (s) => s.readerArch ?? DEFAULTS.readerArch });

    const secTx = section('Chuyển cảnh toàn văn', readDep);
    secTx.classList.add('sp-sec--tx');
    // r87 (người dùng: "nhiều thanh trượt quá, không biết vừa đổi gì"): CHỈ các điều khiển chính. Mọi tham số khác của nhóm (đường cong,
    // camera nhích, khoảng cách đọc, vạch, sóng tách, cỡ sprite, tấm trượt, đèn xiên, cỡ hạt, chữ dò, tuỳ chọn hiệu ứng tiêu đề, ngưỡng
    // tin cậy chữ Hán…) vẫn là cài đặt đã kẹp trong settings.js (TRANSITION_SPEC — giá trị đã lưu giữ nguyên), chỉ không hiện ở đây;
    // "Khôi phục mặc định" đặt lại CẢ nhóm, kể cả phần ẩn.
    // "Hiệu ứng quét" = "Quét bản dập" + "Hiệu ứng ánh sáng chữ" gộp một công tắc (tắt: chỉ camera tiến vào, không vạch / chữ)
    {
      const fxOn = (s) => s.cinemaRubbingScan !== false && s.glyphFx !== false;
      const row = el('div', 'sp-toggle');
      const name = el('span', 'sp-name', { id: `${id}-scanfx-l`, textContent: 'Hiệu ứng quét' });
      const btn = el('button', 'sp-switch', { type: 'button' });
      btn.setAttribute('role', 'switch');
      btn.setAttribute('aria-labelledby', name.id);
      btn.dataset.path = 'scanFx';
      const track = el('span', 'sp-track');
      track.appendChild(el('span', 'sp-knob'));
      btn.appendChild(track);
      onTap(btn, () => {
        const on = btn.getAttribute('aria-checked') !== 'true';
        setSetting('cinemaRubbingScan', on);
        setSetting('glyphFx', on);
      });
      row.append(name, btn);
      secTx.appendChild(row);
      syncs.push((s) => btn.setAttribute('aria-checked', fxOn(s) ? 'true' : 'false'));
    }

    // nút xem thử: chạy cả lượt trên bia đang hiện (giữ 2 s → mở → đọc → đóng), bảng ẩn tạm rồi hiện lại (xem thử mở / đóng riêng:
    // chỉ còn móc cho kiểm thử — actions.previewTransition('open' | 'close'))
    if (typeof actions?.previewTransition === 'function') {
      const pv = el('div', 'sp-pv');
      const b = el('button', 'sp-btn sp-btn--main', { type: 'button', textContent: '▶ Xem thử chuyển cảnh' });
      b.dataset.preview = 'full';
      b.setAttribute('data-magnet', '');
      onTap(b, () => actions.previewTransition('full'));
      pv.appendChild(b);
      secTx.appendChild(pv);
    }
    const sub = (title) => secTx.appendChild(el('h4', 'sp-subh', { textContent: title }));
    const R = TRANSITION_SPEC;
    const rd = (k) => (s) => tnum(s, k);
    const numIn = (box, k, label, format) => slider(box, { label, path: k, ...R[k], format, read: rd(k) });
    const choice = (box, k, label, options) => {
      const hd = el('div', 'sp-rowhead');
      hd.appendChild(el('span', 'sp-name', { textContent: label }));
      box.appendChild(hd);
      return segmented(box, label, options, k, (s) => topt(s, k));
    };
    const fSec = (v) => `${Number(v).toFixed(1).replace('.', ',')} s`;
    const fPct = (v) => `${Math.round(Number(v) * 100)} %`;
    const fMulOff = (v) => (Number(v) <= 0 ? 'Tắt' : `×${Number(v).toFixed(2).replace('.', ',')}`);

    sub('Camera');
    numIn(secTx, 'readerZoomIn', 'Thời gian camera tiến vào', fSec);
    numIn(secTx, 'readerZoomOut', 'Thời gian camera lùi ra', fSec);

    sub('Vệt quét & chữ');
    const fxBox = dependent(secTx, (s) => s.cinemaRubbingScan !== false && s.glyphFx !== false);
    numIn(fxBox, 'scanDuration', 'Thời gian vệt quét', fSec);
    numIn(fxBox, 'glyphTrail', 'Độ dài vệt', fPct);
    const lookSeg = choice(fxBox, 'glyphLook', 'Kiểu chữ sáng', GLYPH_LOOK_OPTIONS);
    // "Chữ Hán (số hoá)" chỉ hiện ở bia có văn bản chữ Hán căn chỉnh (bia khác: kiểu đó tự về Nét khắc)
    syncs.push(() => {
      const opt = lookSeg?.querySelector('[data-id="hantext"]');
      if (opt) opt.hidden = !hasHanText(actions?.currentStele?.() ?? null);
    });
    numIn(fxBox, 'glyphTwinkle', 'Độ lấp lánh', fMulOff);
    choice(fxBox, 'glyphFlyMode', 'Kiểu bay', FLY_MODE_OPTIONS);
    numIn(fxBox, 'glyphDensity', 'Mật độ chữ bay', fPct);
    const cloudBox = dependent(fxBox, (s) => topt(s, 'glyphFlyMode') === 'cloud');
    syncs.push((s) => {
      cloudBox.hidden = topt(s, 'glyphFlyMode') !== 'cloud'; // chỉ hiện với Đám mây
    });
    // r88 → r89: đám mây chữ nổi ngay trước mặt bia — độ sâu tối đa = ngần này × khoảng cách đầu rùa – mặt bia; thời gian tồn tại =
    // chữ rời mặt bia → tắt hẳn (dài hơn → chữ tấm đọc tự hiện muộn hơn; không vừa đoạn tiến vào thì kẹp + gợi ý ngay dưới)
    numIn(cloudBox, 'glyphCloudDist', 'Độ sâu đám mây (xa / gần mặt bia)', (v) => `×${Number(v).toFixed(2).replace('.', ',')}`);
    numIn(cloudBox, 'glyphCloudLife', 'Thời gian đám mây tồn tại', fSec);
    const lifeWarn = el('p', 'sp-desc sp-warn', { hidden: true });
    cloudBox.appendChild(lifeWarn);
    syncs.push((s) => {
      const T = readerTiming(s);
      const want = tnum(s, 'glyphCloudLife');
      const on = !!T.cloud && T.clamped.cloud;
      lifeWarn.hidden = !on;
      if (on) lifeWarn.textContent = `Đã kẹp: đoạn camera tiến vào ${fSec(T.dur)} chỉ đủ cho đám mây ${fSec(T.lifeMax)} (đặt ${fSec(want)}) — tăng "Thời gian camera tiến vào" để đám mây ở lâu hơn.`;
    });

    sub('Tiêu đề');
    choice(secTx, 'titleFxMode', 'Kiểu hiện tiêu đề', TITLE_FX_OPTIONS);

    const resetBox = el('div', 'sp-confirm');
    const resetBtn = el('button', 'sp-btn', { type: 'button', textContent: 'Khôi phục mặc định' });
    resetBtn.dataset.resetGroup = 'transition';
    resetBtn.setAttribute('data-magnet', '');
    onTap(resetBtn, () => resetTransitionSettings());
    resetBox.appendChild(resetBtn);
    secTx.appendChild(resetBox);

    // r19 (kiosk): tự trình chiếu khi rảnh — bật / tắt, sau bao lâu, có hiện thông tin như đang hover hay chỉ lướt qua.
    const secAuto = section('Tự trình chiếu', byId.info.pane);
    toggle(secAuto, { label: 'Tự trình chiếu khi rảnh', path: 'cinemaIdleAutoplay', read: (s) => s.cinemaIdleAutoplay !== false });
    const autoBox = dependent(secAuto, (s) => s.cinemaIdleAutoplay !== false);
    const afterHead = el('div', 'sp-rowhead');
    afterHead.appendChild(el('span', 'sp-name', { textContent: 'Sau' }));
    autoBox.appendChild(afterHead);
    numberChips(autoBox, 'Tự trình chiếu sau', [15, 30, 60, 120].map((v) => ({ v, label: `${v} s` })), 'cinemaIdleAfter', (s) => s.cinemaIdleAfter ?? DEFAULTS.cinemaIdleAfter);
    // r62 (người dùng: "thêm setting về duration cho mỗi bia ở auto play"): thời gian dừng ở mỗi bia — cả tự trình chiếu khi rảnh
    // lẫn ▶ tay (Space / "Trình chiếu ngay") → nằm ngoài khối phụ thuộc công tắc "khi rảnh"
    const dwellHead = el('div', 'sp-rowhead');
    dwellHead.appendChild(el('span', 'sp-name', { textContent: 'Mỗi bia' }));
    secAuto.appendChild(dwellHead);
    numberChips(secAuto, 'Mỗi bia dừng', AUTO_DWELL_OPTIONS.map((v) => ({ v, label: `${v} s` })), 'cinemaAutoDwell', (s) => s.cinemaAutoDwell ?? DEFAULTS.cinemaAutoDwell);
    // r26: cụm nút ‹ › ▶ góc dưới phải đã bỏ — bắt đầu trình chiếu ngay từ đây (chạy cả khi tắt tự trình chiếu khi rảnh)
    if (typeof actions?.presentNow === 'function') {
      const nowBox = el('div', 'sp-confirm');
      const nowBtn = el('button', 'sp-btn', { type: 'button', textContent: 'Trình chiếu ngay' });
      nowBtn.setAttribute('data-magnet', '');
      onTap(nowBtn, () => actions.presentNow());
      nowBox.appendChild(nowBtn);
      secAuto.appendChild(nowBox);
    }
    hint(secAuto, 'Không ai thao tác một lúc thì tự lướt qua các bia, mỗi bia dừng theo "Mỗi bia" — khung nhìn và ánh sáng thường, không hiện thông tin. Di chuột, chạm, bấm phím hoặc giơ tay điều khiển là dừng ngay. Phím Space: tự chuyển bia liên tục, bấm lần nữa để dừng.');

    const secNames = section('Tên người đỗ', byId.info.pane);
    toggle(secNames, { label: 'Tên người đỗ trên thân bia', path: 'cinemaNames', read: (s) => !!s.cinemaNames });
    hint(secNames, 'Thử nghiệm · khi chưa có dữ liệu thật sẽ hiện tên mẫu.');
    const namesBox = dependent(secNames, (s) => !!s.cinemaNames);
    const nsHead = el('div', 'sp-rowhead');
    nsHead.appendChild(el('span', 'sp-name', { textContent: 'Màu chữ' }));
    namesBox.appendChild(nsHead);
    segmentedWithDesc(namesBox, 'Màu chữ tên người đỗ', NAMES_STYLE_OPTIONS, 'cinemaNamesStyle', (s) => s.cinemaNamesStyle ?? DEFAULTS.cinemaNamesStyle);

    // Xoa đầu rùa (r8, trứng phục sinh r9): bật / tắt, màu + độ bóng của đá xoa, độ mạnh + bán kính mỗi lần xoa
    // (kèm "≈ N lượt để bóng tối đa"), xoá độ bóng đã lưu (hai bước: bấm → hỏi lại → xoá). Tắt → cả khối mờ đi.
    const secRub = section('Xoa đầu rùa', byId.info.pane);
    toggle(secRub, { label: 'Xoa đầu rùa', path: 'cinemaRub', read: (s) => s.cinemaRub !== false });
    hint(secRub, 'Tính năng ẩn: đang xem bia, xoa qua lại trên đầu rùa (xoè tay, hoặc nhấn giữ chuột rồi xoa) vài nhịp để mở — không có gợi ý nào hiện sẵn. Chỗ xoa bóng dần lên và được giữ lại trên máy này.');
    const rubBox = dependent(secRub, (s) => s.cinemaRub !== false);
    const rubColHead = el('div', 'sp-rowhead');
    rubColHead.appendChild(el('span', 'sp-name', { textContent: 'Màu đá khi bóng' }));
    rubBox.appendChild(rubColHead);
    colorSwatches(rubBox, 'Màu đá khi bóng', RUB_COLOR_OPTIONS, 'rubColor', (s) => s.rubColor ?? DEFAULTS.rubColor);
    slider(rubBox, { label: 'Độ bóng tối đa', path: 'rubGloss', min: 0, max: 1, step: 0.05, format: fmtPctOnly, read: (s) => s.rubGloss ?? DEFAULTS.rubGloss });
    slider(rubBox, { label: 'Cường độ mỗi lần xoa', path: 'rubStrength', min: 0.002, max: 0.03, step: 0.001, format: (v) => Number(v).toFixed(3), read: (s) => s.rubStrength ?? DEFAULTS.rubStrength });
    slider(rubBox, { label: 'Cỡ brush', path: 'rubRadius', min: 0.15, max: 0.8, step: 0.05, format: fmtPctOnly, read: (s) => s.rubRadius ?? DEFAULTS.rubRadius });
    const rubLaps = el('p', 'sp-desc');
    rubBox.appendChild(rubLaps);
    syncs.push((s) => {
      const n = rubLapsToMax(Number(s.rubStrength ?? DEFAULTS.rubStrength));
      rubLaps.textContent = `≈ ${n} lượt xoa để bóng tối đa · cỡ brush = % bán kính đầu rùa`;
    });
    const rubClear = el('div', 'sp-confirm');
    const rubAsk = el('button', 'sp-btn', { type: 'button', textContent: 'Xoá độ bóng đã xoa' });
    const rubQ = el('div', 'sp-confirm__q');
    rubQ.hidden = true;
    rubQ.appendChild(el('p', 'sp-desc', { textContent: 'Xoá hết độ bóng và số lượt xoa trên mọi bia?' }));
    const rubRow = el('div', 'sp-confirm__row');
    const rubYes = el('button', 'sp-btn sp-btn--danger', { type: 'button', textContent: 'Xoá' });
    const rubNo = el('button', 'sp-btn', { type: 'button', textContent: 'Huỷ' });
    rubRow.append(rubYes, rubNo);
    rubQ.appendChild(rubRow);
    const rubDone = el('p', 'sp-desc sp-confirm__done', { textContent: 'Đã xoá độ bóng đã xoa.' });
    rubDone.hidden = true;
    rubClear.append(rubAsk, rubQ, rubDone);
    rubBox.appendChild(rubClear);
    const rubStep = (ask) => {
      rubAsk.hidden = ask;
      rubQ.hidden = !ask;
      if (ask) rubNo.focus();
    };
    onTap(rubAsk, () => {
      rubDone.hidden = true;
      rubStep(true);
    });
    onTap(rubNo, () => {
      rubStep(false);
      rubAsk.focus();
    });
    onTap(rubYes, () => {
      clearAllRub();
      rubStep(false);
      rubDone.hidden = false;
      rubAsk.focus();
    });
  }

  /* ---------- chân bảng: luôn hiện dù đang mở tab nào ---------- */
  const foot = el('div', 'sp-foot');
  
  const reset = el('button', 'sp-btn', { type: 'button', textContent: 'Đặt lại mặc định' });
  onTap(reset, () => resetSettings());
  
  const save = el('button', 'sp-btn sp-btn--main', { type: 'button', textContent: 'Lưu cài đặt' });
  onTap(save, () => {
    if (onClose) onClose();
  });
  
  foot.append(reset, save);
  root.appendChild(foot);

  /* ---------- nối kho ---------- */
  function syncAll(s) {
    syncing = true;
    try { for (const fn of syncs) fn(s); } finally { syncing = false; }
  }
  const off = onSettings(syncAll);

  function onKeyDown(ev) {
    if (ev.key !== 'Escape' || !onClose) return;
    ev.stopPropagation();
    onClose();
  }
  root.addEventListener('keydown', onKeyDown);

  host.appendChild(root);
  select(readTab());   // tab đã nhớ; không có ở view này → tab đầu (không ghi đè giá trị đã nhớ)

  return {
    el: root,
    destroy() {
      off();
      ro?.disconnect();
      visRo?.disconnect();
      visIo?.disconnect();
      openPanels.delete(id);
      syncModalMark();
      root.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
}
