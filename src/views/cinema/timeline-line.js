// Kiểu "Sợi chỉ" của dòng thời gian (r21 → r23): MỘT sợi chỉ năm 1442 → 1779, mỗi bia một vạch theo năm khoa thi, nhãn
// nửa thế kỷ, dấu vàng ở bia đang xem (+ vạch chạy của tự chuyển). Rê / kéo / con trỏ tay → kính lúp kiểu dock + thẻ: ảnh
// bia, năm khoa thi LỚN + "khoa thi năm {can chi}", vạch mảnh, "năm dựng bia {năm}" (chưa biết: "· chờ dữ liệu", mờ);
// thẻ kẹp trong khung nhìn + vùng an toàn, mũi nhỏ chỉ đúng vạch. Bấm / thả / nhón → tới bia đó. Là kiểu tối giản (cũng là
// bản thu gọn của mọi kiểu trên điện thoại). r24: chế độ dính của tay (sticky) — thước phóng 1,3×, tay trái / phải chọn
// vạch (ô đều, có trễ; r30g: lớp tay chọn mốc — d.focus), nhón = chọn. B bỏ kiểu này; r43 (người dùng: "giữ Sợi chỉ & thước
// khắc") đưa lại nguyên bản HEAD v0.5.12 + dòng gợi ý chọn bằng tay trong thẻ lúc dính (như ô năm thi của Thước khắc).
import { thumbUrl } from '../../core/loader.js';
import { HAND_POINTER_IDS } from './input-mode.js';
import { esc, createMagnifier, createStickyIndex, stickyScale, MAG_SIGMA, dragPassing } from './timeline-shared.js';

const POP_MARGIN = 10; // px — thẻ cách mép khung nhìn / vùng an toàn tối thiểu

/**
 * @param {HTMLElement} el phần tử gốc .cin-tl (bộ bọc giữ nguyên qua các lần đổi kiểu)
 * @param {{ bia: object[], onPick: (i: number) => void }} cfg
 */
export function createLineTimeline(el, { bia, onPick, stickyLimits }) {
  const n = bia.length;
  const y0 = Math.min(...bia.map((b) => b.year));
  const y1 = Math.max(...bia.map((b) => b.year));
  const span = Math.max(1, y1 - y0);
  const xOf = (year) => (year - y0) / span;
  const pct = (f) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;
  const labels = [];
  for (let y = Math.ceil(y0 / 50) * 50; y <= y1; y += 50) labels.push(y);
  const hasDung = (b) => Number.isFinite(b.dung);

  el.dataset.style = 'line';
  el.dataset.pop = '0';
  el.innerHTML = `
    <div class="cin-tl__track" role="slider" tabindex="0" aria-label="Dòng thời gian khoa thi ${y0}–${y1}" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="1">
      <span class="cin-tl__line" aria-hidden="true"></span>
      ${labels.map((y) => `<span class="cin-tl__lab${y % 100 ? ' is-minor' : ''}" style="left:${pct(xOf(y))}" aria-hidden="true">${y}</span>`).join('')}
      ${bia
        .map(
          (b, i) =>
            `<button class="cin-tl__tick" type="button" tabindex="-1" data-i="${i}" data-magnet style="left:${pct(xOf(b.year))}" aria-label="Bia ${i + 1} trên ${n} — khoa ${esc(b.canChi)} ${b.year}${hasDung(b) ? `, dựng ${b.dung}` : ''}"><i></i></button>`,
        )
        .join('')}
      <span class="cin-tl__cur" aria-hidden="true"><i class="cin-tl__run"></i></span>
      <div class="cin-tl__pop" aria-hidden="true">
        <span class="cin-tl__img"><img alt="" decoding="async"></span>
        <span class="cin-tl__meta"><b class="cin-tl__year"></b><span class="cin-tl__cc"></span><span class="cin-tl__rule"></span><span class="cin-tl__dung"></span><span class="cin-tl__yhint">chạm ngón cái vào ngón trỏ để chọn</span></span>
      </div>
      <span class="cin-tl__safe" aria-hidden="true"></span>
    </div>`;

  const track = el.querySelector('.cin-tl__track');
  const ticks = [...el.querySelectorAll('.cin-tl__tick')];
  const cur = el.querySelector('.cin-tl__cur');
  const run = el.querySelector('.cin-tl__run');
  const pop = el.querySelector('.cin-tl__pop');
  const img = pop.querySelector('img');
  const popYear = pop.querySelector('.cin-tl__year');
  const popCc = pop.querySelector('.cin-tl__cc');
  const popDung = pop.querySelector('.cin-tl__dung');
  const safe = el.querySelector('.cin-tl__safe');
  const onImgErr = () => pop.classList.add('is-noimg');
  const onImgOk = () => pop.classList.remove('is-noimg');
  img.addEventListener('error', onImgErr);
  img.addEventListener('load', onImgOk);

  const mag = createMagnifier();
  mag.bind(ticks);
  const stickyIdx = createStickyIndex(n);
  let current = 0;
  let progress = -1;
  let hot = -1;
  let dragging = null;
  let byHand = false;
  let mouseMuted = false;
  let sticky = false;
  let magX = null;

  const tickXs = () => {
    const r = track.getBoundingClientRect();
    return bia.map((b) => r.left + xOf(b.year) * r.width);
  };
  function setMag(x) {
    magX = x;
    const r = track.getBoundingClientRect();
    mag.aim(x == null ? null : tickXs(), x, hot, Math.max(4, (MAG_SIGMA * r.width) / n));
  }
  /** Vạch gần nhất theo toạ độ x (px client). */
  function nearest(clientX) {
    const r = track.getBoundingClientRect();
    const f = (clientX - r.left) / Math.max(1, r.width);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xOf(bia[i].year) - f);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
  function safeInsets() {
    try {
      const cs = getComputedStyle(safe);
      return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
    } catch {
      return { l: 0, r: 0 };
    }
  }
  /** Đặt thẻ trên vạch i, kẹp (px) trong khung nhìn trừ vùng an toàn; --caret = chỗ mũi nhỏ chỉ đúng vạch. */
  function placePop(i) {
    const tr = track.getBoundingClientRect();
    const sc = tr.width / Math.max(1, track.offsetWidth); // chế độ dính: thước đang phóng (transform) → đổi về px chưa phóng
    const w = pop.offsetWidth * sc;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const si = safeInsets();
    const cx = tr.left + xOf(bia[i].year) * tr.width;
    const lo = si.l + POP_MARGIN;
    const hi = Math.max(lo, vw - si.r - POP_MARGIN - w);
    const x = Math.min(Math.max(cx - w / 2, lo), hi);
    pop.style.left = `${((x - tr.left) / sc).toFixed(1)}px`;
    pop.style.setProperty('--caret', `${Math.min(pop.offsetWidth - 12, Math.max(12, (cx - x) / sc)).toFixed(1)}px`);
  }
  function showPop(i) {
    if (i === hot) return;
    if (hot >= 0) ticks[hot]?.classList.remove('is-hot');
    const was = el.dataset.pop === '1';
    hot = i;
    if (i < 0) {
      el.dataset.pop = '0';
      return;
    }
    const b = bia[i];
    ticks[i].classList.add('is-hot');
    popYear.textContent = String(b.year);
    popCc.innerHTML = `khoa thi năm <b>${esc(b.canChi ?? '')}</b>`;
    const known = hasDung(b);
    popDung.innerHTML = known ? `năm dựng bia <b>${b.dung}</b>` : 'năm dựng bia · chờ dữ liệu';
    popDung.classList.toggle('is-pending', !known);
    const src = thumbUrl(b, true);
    if (img.getAttribute('src') !== src) img.src = src;
    if (!was) pop.classList.add('is-jump');
    placePop(i);
    if (!was) {
      void pop.offsetWidth;
      pop.classList.remove('is-jump');
    }
    el.dataset.pop = '1';
  }
  function focus(i, cx) {
    showPop(i);
    setMag(i < 0 ? null : cx);
  }

  const onMove = (e) => {
    if (sticky) return;
    if (!dragging && dragPassing(el, e)) return; // r29: kéo camera đi ngang qua → không hiện thẻ / tiêu điểm
    if (e.pointerType === 'touch' && !dragging) return;
    if (mouseMuted && !HAND_POINTER_IDS.has(e.pointerId)) return;
    focus(nearest(e.clientX), e.clientX);
  };
  const onLeave = () => {
    if (!dragging && !sticky) focus(-1);
  };
  const onDown = (e) => {
    if (e.button > 0 || sticky) return;
    dragging = { id: e.pointerId };
    try {
      track.setPointerCapture(e.pointerId);
    } catch {}
    focus(nearest(e.clientX), e.clientX);
    e.preventDefault();
  };
  const onUp = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    dragging = null;
    const i = nearest(e.clientX);
    const touch = e.pointerType === 'touch';
    focus(touch ? -1 : i, e.clientX);
    if (i !== current) onPick(i);
  };
  const onCancel = () => {
    dragging = null;
    focus(-1);
  };
  // Con trỏ tay: lớp cử chỉ phát click lên đúng vạch nam châm (hay vạch [data-hand-focus] ở chế độ dính) → bấm vạch
  const onClick = (e) => {
    const t = e.target.closest?.('.cin-tl__tick');
    if (!t || dragging) return;
    const i = Number(t.dataset.i);
    if (Number.isFinite(i) && i !== current) onPick(i);
  };
  track.addEventListener('pointermove', onMove);
  track.addEventListener('pointerleave', onLeave);
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('pointerup', onUp);
  track.addEventListener('pointercancel', onCancel);
  track.addEventListener('click', onClick);

  function applyCurrent() {
    const b = bia[current];
    if (!b) return;
    for (const t of ticks) if (t.hasAttribute('aria-current')) t.removeAttribute('aria-current');
    ticks[current]?.setAttribute('aria-current', 'true');
    cur.style.left = `${(xOf(b.year) * 100).toFixed(3)}%`;
    track.setAttribute('aria-valuenow', String(current + 1));
    track.setAttribute('aria-valuetext', `Bia ${b.year} · khoa ${b.canChi ?? ''}${hasDung(b) ? ` · dựng ${b.dung}` : ''}`);
  }
  const applyProgress = () => {
    run.style.transform = `scaleX(${progress < 0 ? 0 : progress > 1 ? 1 : progress})`;
  };
  applyCurrent();
  applyProgress();

  function setHandFocus(i) {
    for (const t of ticks) if (t.hasAttribute('data-hand-focus')) t.removeAttribute('data-hand-focus');
    if (i >= 0) ticks[i].setAttribute('data-hand-focus', '');
  }

  return {
    setCurrent(i) {
      current = i;
      applyCurrent();
    },
    setProgress(p) {
      progress = p;
      applyProgress();
    },
    setMouseMuted(on) {
      mouseMuted = !!on;
      if (mouseMuted && !byHand && !dragging && !sticky) focus(-1);
    },
    handAt(x, y) {
      if (dragging || sticky) return;
      if (dragPassing(el)) x = null; // r29: đang nhón–kéo camera → con trỏ tay đi ngang không mở thẻ (đang mở thì tắt)
      const r = track.getBoundingClientRect();
      const inside = x != null && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 36 && y <= r.bottom + 36;
      if (inside) {
        byHand = true;
        // vạch nam châm tay đang hút (data-hi-captured) = vạch sẽ được nhón → thẻ + kính lúp theo đúng vạch đó
        const cap = track.querySelector('.cin-tl__tick[data-hi-captured]');
        const i = cap ? Number(cap.dataset.i) : nearest(x);
        focus(i, cap ? r.left + xOf(bia[i].year) * r.width : x);
      } else if (byHand) {
        byHand = false;
        focus(-1);
      }
    },
    /** r24: chế độ dính của tay (hand:sticky name 'timeline'). */
    sticky(d) {
      if (d.active) {
        if (!sticky) {
          sticky = true;
          const st = stickyScale(el, 1.3, 12, stickyLimits?.());
          el.style.setProperty('--sticky', st.s.toFixed(3));
          el.style.setProperty('--sticky-dx', `${st.dx.toFixed(1)}px`);
          el.classList.add('is-sticky');
          stickyIdx.reset(-1);
        }
        // r30g: lớp tay chọn mốc (d.focus — nấc / tinh chỉnh / mốc trước lúc khép ngón); không có thì theo vị trí như cũ
        const i = Number.isInteger(d.focus) && d.focus >= 0 && d.focus < bia.length ? d.focus : stickyIdx.map(d.rel?.x ?? 0.5);
        setHandFocus(i);
        const r = track.getBoundingClientRect();
        focus(i, r.left + xOf(bia[i].year) * r.width);
      } else if (sticky) {
        sticky = false;
        el.classList.remove('is-sticky');
        setHandFocus(-1);
        focus(-1);
      }
    },
    tickRect(i) {
      return ticks[i]?.getBoundingClientRect() ?? null;
    },
    get magnify() {
      return { x: magX, k: mag.k, hot };
    },
    destroy() {
      mag.stop();
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerleave', onLeave);
      track.removeEventListener('pointerdown', onDown);
      track.removeEventListener('pointerup', onUp);
      track.removeEventListener('pointercancel', onCancel);
      track.removeEventListener('click', onClick);
      img.removeEventListener('error', onImgErr);
      img.removeEventListener('load', onImgOk);
      el.classList.remove('is-sticky');
      delete el.dataset.pop;
    },
  };
}
