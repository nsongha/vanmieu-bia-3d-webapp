// r71 — lớp phủ toàn màn hình của thông tin mở rộng (đọc toàn văn · bảng vàng): màn tối phủ cảnh, một "tờ" nội dung cuộn
// được, nút Đóng rõ ràng. Là một bảng (body[data-modal="reader"]): lớp cử chỉ không đổi bia / không nắm kéo / không zoom
// sâu phía sau; tự trình chiếu không bật; view không nhận phím (Esc, mũi tên, Space… do đây lo). Thông tin bia được ghim
// (ctx.pinInfo) suốt lúc mở — đóng lại là về đúng trạng thái focus cũ, không nháy.
// Cuộn: bánh xe · chuột kéo · phím · tay (nhón kéo, bàn tay ở dải mép — scroll.js). Bấm bằng tay: đích [data-rt] (targets.js).
// r72 (người dùng: "nắm tay để close"): NẮM TAY giữ FIST_CLOSE_MS = đóng — vòng quanh nút Đóng đầy dần, tờ lùi nhẹ (tín hiệu
// đang đóng); mở tay trước khi đầy → huỷ. Esc · nút Đóng · bấm ra màn tối vẫn như cũ.
import { h } from './common.js';
import { createScroller } from './scroll.js';
import { createHandTargets } from './targets.js';

const CLOSE_MS = 380;
/** r72: nắm tay (đã xác nhận: hand:frame fist / fistProgress ≥ 1) giữ ngần này → đóng. */
const FIST_CLOSE_MS = 350;
const RING = '<svg class="ri-ov__ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" pathLength="100"/></svg>';
/** Kiosk: mở mà không ai thao tác (phím, chuột, bánh xe, tay trong khung) ngần này → tự đóng, tự trình chiếu chạy lại được. */
const IDLE_CLOSE_MS = 120000;

/**
 * @param {{ ctx:any, cls:string, label:string, build:(parts:{sheet:HTMLElement, scroll:HTMLElement, head:HTMLElement})=>void,
 *   edge?:number, closeMs?:number, readingHoldMs?:number, onOpen?:()=>void, onClose?:(why:string)=>void,
 *   onScroll?:(el:HTMLElement)=>void }} o
 *   closeMs: lớp phủ ẩn hẳn sau ngần này khi đóng (khớp hoạt ảnh tắt); readingHoldMs (r74): giữ host[data-reading] thêm ngần
 *   này sau khi đóng — HUD / tấm sơn mài trở lại khi camera đã lùi được một đoạn (r82b: số hoặc hàm → ms, tính lúc đóng).
 */
export function createOverlay({ ctx, cls, label, build, scrollOpts = {}, closeMs = CLOSE_MS, readingHoldMs = 0, onOpen, onClose, onScroll }) {
  const host = ctx.hudRoot?.closest?.('.cinema') ?? document.body;
  const root = h('div', `ri-ov ${cls}`);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', label);
  root.hidden = true;
  const veil = h('div', 'ri-ov__veil');
  const sheet = h('div', 'ri-ov__sheet');
  const head = h('header', 'ri-ov__head');
  const scroll = h('div', 'ri-ov__scroll');
  scroll.tabIndex = -1;
  const close = h('button', 'ri-ov__close');
  close.type = 'button';
  close.setAttribute('data-rt', '');
  close.setAttribute('data-magnet', '');
  close.setAttribute('aria-label', 'Đóng');
  const xIco = h('span', 'ri-ov__x', '');
  xIco.insertAdjacentHTML('beforeend', RING);
  close.append(xIco, h('span', 'ri-ov__closet', 'Đóng'), h('kbd', 'ri-ov__kbd', 'Esc'));
  const progress = h('div', 'ri-ov__progress');
  progress.append(h('i'));
  sheet.append(head, scroll, progress, close);
  root.append(veil, sheet);
  host.append(root);
  build({ sheet, scroll, head });

  let open = false;
  let hideT = 0;
  let readingT = 0;
  let idleT = 0;
  let lastAct = 0;
  const act = () => {
    lastAct = performance.now();
  };
  // r72: nắm tay giữ để đóng
  let fistAt = -1;
  let fistK = 0;
  const setFist = (k) => {
    if (Math.abs(k - fistK) < 0.02 && k !== 0 && k !== 1) return;
    fistK = k;
    root.style.setProperty('--fist', k.toFixed(3));
    root.classList.toggle('is-fisting', k > 0);
  };
  const onHandAct = (e) => {
    const d = e.detail || {};
    if (d.detected) act();
    if (!open) return;
    const fist = !!d.detected && (!!d.fist || (d.fistProgress ?? 0) >= 1);
    const now = performance.now();
    if (fist) {
      if (fistAt < 0) fistAt = now;
      const k = Math.min(1, (now - fistAt) / FIST_CLOSE_MS);
      setFist(k);
      if (k >= 1) {
        fistAt = -1;
        api.close('fist');
      }
    } else if (fistAt >= 0) {
      fistAt = -1;
      setFist(0);
    }
  };
  const ACT_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'];
  const bar = progress.firstChild;
  const syncProgress = () => {
    const m = scroll.scrollHeight - scroll.clientHeight;
    const k = m > 0 ? scroll.scrollTop / m : 1;
    bar.style.transform = `scaleY(${k.toFixed(4)})`;
    root.classList.toggle('is-scrolled', scroll.scrollTop > 8);
    root.classList.toggle('is-end', m <= 0 || scroll.scrollTop >= m - 8);
    onScroll?.(scroll);
  };
  scroll.addEventListener('scroll', syncProgress, { passive: true });
  // r77: ánh vàng ở mép dưới trong lúc chữ đang cuộn (mọi cách cuộn), tắt ~400 ms sau khi dừng — root[data-scrolling]
  let scrollT = 0;
  let quietUntil = 0;
  scroll.addEventListener(
    'scroll',
    () => {
      if (!open || performance.now() < quietUntil) return;
      root.dataset.scrolling = '1';
      clearTimeout(scrollT);
      scrollT = setTimeout(() => delete root.dataset.scrolling, 400);
    },
    { passive: true }
  );
  // dải tự cuộn bằng tay theo tầm với: tay ở ~3/5–3/4 dưới màn → cuộn xuống; ~1/7–3/10 trên → cuộn lên; giữa: đứng yên đọc
  // r78: bộ tích phân cuộn (scroll.js) — phát 'scroll' trên vùng chữ mỗi khi vị trí đổi (syncProgress nghe ở trên)
  const scroller = createScroller(scroll, scrollOpts);
  const targets = createHandTargets(root);

  function onKey(e) {
    if (!open || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    const page = scroll.clientHeight * 0.85;
    let handled = true;
    if (k === 'Escape') api.close('esc');
    else if (k === 'ArrowDown') scroller.by(64);
    else if (k === 'ArrowUp') scroller.by(-64);
    else if (k === 'PageDown' || (k === ' ' && !e.shiftKey)) scroller.by(page);
    else if (k === 'PageUp' || (k === ' ' && e.shiftKey)) scroller.by(-page);
    else if (k === 'Home') scroller.to(0);
    else if (k === 'End') scroller.to(scroll.scrollHeight);
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'i' || k === 'I') handled = true; // không đổi bia / ghim sau bảng
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  close.addEventListener('click', () => api.close('button'));
  // chạm / bấm lên màn tối (ngoài tờ) cũng đóng — chuột; tay dùng nút Đóng
  veil.addEventListener('click', () => api.close('veil'));

  const api = {
    root,
    sheet,
    head,
    scroll,
    scroller,
    /** r78: thêm gốc tìm đích bấm bằng tay (tấm đọc 3D nằm ở lớp CSS3D, ngoài lớp phủ). */
    addTargetRoot: (el) => targets.addRoot(el),
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      clearTimeout(hideT);
      clearTimeout(readingT);
      root.hidden = false;
      quietUntil = performance.now() + 300; // đặt vị trí cuộn lúc mở không tính là "đang cuộn"
      const b = document.body.dataset;
      if (!b.modal) b.modal = 'reader';
      host.dataset.reading = '1';
      ctx.pinInfo?.(true);
      scroll.scrollTop = 0;
      // khung kế tiếp mới gắn lớp "vào" — hoạt ảnh chạy từ trạng thái ẩn
      requestAnimationFrame(() => requestAnimationFrame(() => open && root.classList.add('is-open')));
      window.addEventListener('keydown', onKey, true);
      for (const t of ACT_EVENTS) window.addEventListener(t, act, { passive: true, capture: true });
      window.addEventListener('hand:frame', onHandAct);
      act();
      idleT = setInterval(() => {
        if (open && performance.now() - lastAct > IDLE_CLOSE_MS) api.close('idle');
      }, 5000);
      scroller.attach();
      targets.attach();
      syncProgress();
      try {
        scroll.focus({ preventScroll: true });
      } catch {
        /* không focus được thì thôi */
      }
      onOpen?.();
    },
    close(why = '') {
      if (!open) return;
      open = false;
      fistAt = -1;
      root.classList.remove('is-open');
      // tín hiệu nắm tay (nếu đang đầy) tắt dần cùng lớp phủ
      setTimeout(() => !open && setFist(0), ctx.reduceMotion ? 0 : typeof closeMs === 'function' ? 300 : closeMs);
      window.removeEventListener('keydown', onKey, true);
      for (const t of ACT_EVENTS) window.removeEventListener(t, act, { capture: true });
      window.removeEventListener('hand:frame', onHandAct);
      clearInterval(idleT);
      scroller.detach();
      targets.detach();
      const b = document.body.dataset;
      if (b.modal === 'reader') delete b.modal;
      clearTimeout(readingT);
      // r82b: readingHoldMs có thể là hàm (lớp đọc tính theo thời gian camera lùi lúc đóng)
      const holdMs = typeof readingHoldMs === 'function' ? readingHoldMs() : readingHoldMs;
      if (holdMs > 0 && !ctx.reduceMotion) {
        readingT = setTimeout(() => {
          if (!open) delete host.dataset.reading;
        }, holdMs);
      } else delete host.dataset.reading;
      ctx.pinInfo?.(false);
      clearTimeout(scrollT);
      delete root.dataset.scrolling;
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
      onClose?.(why);
      // r77: thời gian giữ lớp phủ có thể do onClose quyết (r82: tấm trượt xuống suốt đoạn camera lùi; giảm chuyển động: mờ chéo
      // ngắn — hàm tự trả thời gian đó)
      const ms = typeof closeMs === 'function' ? closeMs() : ctx.reduceMotion ? 0 : closeMs;
      hideT = setTimeout(() => {
        if (!open) root.hidden = true;
      }, ms);
    },
    dispose() {
      if (open) api.close('dispose');
      clearTimeout(hideT);
      clearTimeout(readingT);
      delete host.dataset.reading;
      targets.dispose();
      root.remove();
    },
  };
  return api;
}
