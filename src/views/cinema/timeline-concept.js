// r24 — dòng thời gian "một thanh, ba tầng" (ý tưởng của người dùng), ba cách vẽ cùng một cấu trúc:
//
//   · THANH ở giữa, bên trong chia các triều đại theo đoạn (src/data/dynasties.js — Lê trung hưng CHỒNG Mạc 1533–1592:
//     dải phụ riêng dưới đoạn Mạc, chú thích "Nam – Bắc triều"; không cắt gọn thành ba đoạn nối tiếp).
//   · TRÊN thanh: mốc năm tổ chức thi, mỗi bia một mốc. Rê chuột / tay dọc thước, hay lăn chuột trên thước (mỗi nấc lăn
//     = một mốc) → mốc tiêu điểm nhô lên và đi theo con trỏ; mốc đã lướt qua tự thu lại ngay (r25, timeline-shared.js).
//   · DƯỚI thanh: mốc năm dựng bia (chỉ bia có `dung` — hiện 10 bia).
//   · Tiêu điểm (rê / lăn / tay): TRÊN — số năm thi trong một ô (chính) + "khoa {can chi}" chữ nhỏ bên cạnh; DƯỚI — năm dựng
//     bia số nhỏ hơn, không ô (phụ) + "năm dựng bia" bên cạnh (chưa biết: "năm dựng bia · chờ dữ liệu", mờ); một sợi nối
//     xuyên thanh từ mốc thi xuống mốc dựng.
//   · Đã chọn (bia đang xem, không rê): chỉ các DẤU được làm rõ — mốc thi, mốc dựng, sợi nối; mọi chữ ẩn.
//   · Rê lên một mốc năm dựng → sáng cả đợt bia dựng năm đó (kèm sợi nối); rê lên một đoạn triều đại → sáng các khoa
//     trong giai đoạn + số khoa lặng lẽ.
// Cách vẽ: 'ruler' Thước khắc (data-style, CSS lo phần hình). B: Dải lụa · Bia ký đã bỏ.
// Bấm = chọn đúng mốc đang là tiêu điểm (lăn chuột rồi bấm tại chỗ vẫn chọn mốc đã lăn tới) → nhãn luôn khớp thứ sẽ chọn.
// Tay: mỗi mốc thi là một đích nam châm (data-magnet) — nhãn theo vạch nam châm đang hút (data-hi-captured); chế độ dính
// (hand:sticky 'timeline'): thước phóng 1,3×, tay trái / phải dời tiêu điểm (ô đều, có trễ), mốc tiêu điểm mang
// [data-hand-focus] để cú nhón chọn đúng nó; không hiện con trỏ tay (tiêu điểm chính là con trỏ).
import { DYNASTIES, OVERLAP, periodsOf } from '../../data/dynasties.js';
import { HAND_POINTER_IDS } from './input-mode.js';
import { esc, createMagnifier, createStickyIndex, stickyScale, MAG_SIGMA, dragPassing } from './timeline-shared.js';

// Hình học dọc (px CSS) — CSS dùng cùng các số này (cinema.css, khối r24).
const G = { h: 118, examTop: 26, barTop: 62, barH: 24, markY: 93, dlabTop: 100 };
const WHEEL_STEP = 40; // px lăn (bàn di, deltaMode 0) cộng dồn cho một mốc
const WHEEL_NOTCH = 50; // px — sự kiện lăn lớn cỡ này = một nấc bánh xe chuột = một mốc
const MARK_HIT = 11; // px — bán kính bắt rê lên mốc năm dựng
const LAB_GAP = 10; // px — nhãn cách mép thước tối thiểu

/**
 * @param {HTMLElement} el phần tử gốc .cin-tl
 * @param {{ bia: object[], onPick: (i: number) => void, stickyLimits?: () => ({left:number,right:number}) }} cfg
 */
export function createConceptTimeline(el, { bia, onPick, stickyLimits }) {
  const n = bia.length;
  const y0 = Math.min(...bia.map((b) => b.year));
  const yMax = Math.max(...bia.map((b) => b.year));
  const hasDung = (b) => Number.isFinite(b.dung);
  const y1 = Math.max(yMax, ...DYNASTIES.map((d) => d.to), ...bia.filter(hasDung).map((b) => b.dung));
  const span = Math.max(1, y1 - y0);
  const xOf = (year) => (year - y0) / span;
  const pct = (f) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;
  const dungYears = [...new Set(bia.filter(hasDung).map((b) => b.dung))].sort((a, b) => a - b);
  const batchOf = (y) => bia.map((b, i) => (b.dung === y ? i : -1)).filter((i) => i >= 0);

  // ---- đoạn triều đại (Lê trung hưng: đoạn chính từ 1592, phần chồng 1533–1592 là dải phụ riêng)
  const [leSo, mac, lth] = DYNASTIES;
  const count = (d) => bia.filter((x) => x.year >= d.from && x.year <= d.to).length;
  const sec = (d, cls, from, to) => {
    const a = xOf(Math.max(from, y0));
    const b = xOf(Math.min(to, y1));
    const cut = from < y0 ? ' is-cut' : '';
    return `<div class="cin-tl__sec ${cls}${cut}" data-dyn="${d.id}" style="left:${pct(a)};width:${pct(b - a)}" title="${esc(d.name)} · ${d.from}–${d.to}${d.note ? ` · ${esc(d.note)}` : ''}"><span class="cin-tl__secname">${esc(d.name)}</span><span class="cin-tl__seccount">${count(d)} khoa</span></div>`;
  };
  const oa = xOf(OVERLAP.from);
  const ob = xOf(OVERLAP.to);

  el.dataset.style = 'ruler';
  el.dataset.focus = '0';
  delete el.dataset.batch;
  delete el.dataset.dyn;
  el.innerHTML = `
    <div class="cin-tl__track" role="slider" tabindex="0" aria-label="Dòng thời gian: năm thi ${y0}–${yMax}, năm dựng bia bên dưới" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="1">
      <div class="cin-tl__bar" aria-hidden="true">
        ${sec(leSo, 'is-a', leSo.from, leSo.to)}
        ${sec(mac, 'is-b', mac.from, mac.to)}
        ${sec(lth, 'is-c', OVERLAP.to, lth.to)}
        <div class="cin-tl__lane" data-dyn="${lth.id}" style="left:${pct(oa)};width:${pct(ob - oa)}" title="${esc(OVERLAP.label)} · ${OVERLAP.from}–${OVERLAP.to}"></div>
      </div>
      <span class="cin-tl__nb" style="left:${pct(oa)};width:${pct(ob - oa)}" aria-hidden="true"><span>${esc(OVERLAP.label)}</span></span>
      <svg class="cin-tl__svg" viewBox="0 0 1000 ${G.h}" preserveAspectRatio="none" aria-hidden="true"><g class="cin-tl__links"></g></svg>
      ${dungYears.map((y) => `<span class="cin-tl__mark" data-year="${y}" data-is="${batchOf(y).join(' ')}" style="left:${pct(xOf(y))}" aria-hidden="true"><i></i></span>`).join('')}
      ${bia
        .map(
          (b, i) =>
            `<button class="cin-tl__tick" type="button" tabindex="-1" data-i="${i}" data-magnet data-p="${periodsOf(b.year).join(' ')}"${hasDung(b) ? ` data-dung="${b.dung}"` : ''} style="left:${pct(xOf(b.year))}" aria-label="Bia ${i + 1} trên ${n} — khoa ${esc(b.canChi)} ${b.year}${hasDung(b) ? `, dựng ${b.dung}` : ''}"><i></i><b></b></button>`,
        )
        .join('')}
      <i class="cin-tl__run" aria-hidden="true"></i>
      <div class="cin-tl__elab" aria-hidden="true"><b class="cin-tl__ybox"></b><span class="cin-tl__ykhoa"></span><span class="cin-tl__yhint">· chạm ngón cái vào ngón trỏ để chọn</span></div>
      <div class="cin-tl__dlab" aria-hidden="true"><b class="cin-tl__dyear"></b><span class="cin-tl__dtext"></span></div>
    </div>`;

  const track = el.querySelector('.cin-tl__track');
  const ticks = [...el.querySelectorAll('.cin-tl__tick')];
  const marks = [...el.querySelectorAll('.cin-tl__mark')];
  const secs = [...el.querySelectorAll('.cin-tl__sec, .cin-tl__lane')];
  const linksG = el.querySelector('.cin-tl__links');
  const run = el.querySelector('.cin-tl__run');
  const elab = el.querySelector('.cin-tl__elab');
  const ybox = el.querySelector('.cin-tl__ybox');
  const ykhoa = el.querySelector('.cin-tl__ykhoa');
  const dlab = el.querySelector('.cin-tl__dlab');
  const dyear = el.querySelector('.cin-tl__dyear');
  const dtext = el.querySelector('.cin-tl__dtext');
  const markOf = new Map(marks.map((m) => [Number(m.dataset.year), m]));
  const mag = createMagnifier();
  mag.bind(ticks);
  const stickyIdx = createStickyIndex(n);
  let current = 0;
  let progress = -1;
  let focusI = -1;
  let focusSrc = '';
  let batch = null; // năm dựng đang rê
  let dyn = ''; // đoạn triều đại đang rê
  let dragging = null;
  let byHand = false;
  let mouseMuted = false;
  let sticky = false;
  let justPicked = -1; // vừa chọn mốc này → trạng thái "đã chọn": chỉ dấu, ẩn chữ (tới khi tiêu điểm rời mốc)
  let magX = null;
  let wheelAcc = 0;

  // ---- hình học (px, theo thước chưa phóng — CSS transform ở chế độ dính không làm lệch đích bấm)
  const rect = () => track.getBoundingClientRect();
  const tickXs = () => {
    const r = rect();
    return bia.map((b) => r.left + xOf(b.year) * r.width);
  };
  function nearest(clientX) {
    const r = rect();
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
  /** Vùng dọc dưới con trỏ: 'exam' (nhãn + mốc thi) · 'bar' (đoạn triều đại) · 'dung' (mốc dựng + nhãn). */
  function zoneAt(clientY) {
    const r = rect();
    const y = ((clientY - r.top) / Math.max(1, r.height)) * G.h;
    return y < G.barTop ? 'exam' : y < G.barTop + G.barH ? 'bar' : 'dung';
  }
  function secAt(clientX, clientY) {
    // dải phụ Nam – Bắc triều (đáy thanh) trước, rồi đoạn chính theo x
    for (const c of secs) {
      const cr = c.getBoundingClientRect();
      if (clientX >= cr.left && clientX <= cr.right && clientY >= cr.top - 1 && clientY <= cr.bottom + 1 && c.classList.contains('cin-tl__lane')) return c.dataset.dyn;
    }
    for (const c of secs) {
      const cr = c.getBoundingClientRect();
      if (clientX >= cr.left && clientX <= cr.right && !c.classList.contains('cin-tl__lane')) return c.dataset.dyn;
    }
    return '';
  }
  function markAt(clientX) {
    const r = rect();
    let best = null;
    let bestD = MARK_HIT * (r.width / Math.max(1, track.offsetWidth));
    for (const y of dungYears) {
      const d = Math.abs(r.left + xOf(y) * r.width - clientX);
      if (d <= bestD) {
        bestD = d;
        best = y;
      }
    }
    return best;
  }

  // ---- sợi nối (SVG, x theo 0..1000, y theo px của hình học G)
  const X = (year) => (xOf(year) * 1000).toFixed(2);
  function linkPath(i) {
    const b = bia[i];
    if (!hasDung(b)) return '';
    const xa = X(b.year);
    const xb = X(b.dung);
    const yT = G.barTop;
    // một nét thẳng xuyên thanh từ chân mốc thi xuống mốc dựng
    return `M ${xa} ${yT} L ${xb} ${G.markY - 3}`;
  }
  function drawLinks() {
    const parts = [];
    const add = (i, cls) => {
      const d = linkPath(i);
      if (d) parts.push(`<path class="cin-tl__link ${cls}" d="${d}"/>`);
    };
    add(current, 'is-sel');
    if (batch != null) for (const i of batchOf(batch)) if (i !== current) add(i, 'is-batch');
    if (focusI >= 0 && focusI !== current && batch == null) add(focusI, 'is-focus');
    if (focusI === current && batch == null && labelsOn()) {
      // tiêu điểm trùng bia đang xem: sợi đã chọn sáng như tiêu điểm
      parts[0] = parts[0]?.replace('is-sel', 'is-sel is-focus');
    }
    linksG.innerHTML = parts.join('');
  }

  // ---- nhãn: ô năm thi + "khoa {can chi}" ở trên, năm dựng + "năm dựng bia" ở dưới — kẹp trong thước
  const labelsOn = () => focusI >= 0 && focusI !== justPicked;
  function placeLab(node, anchorX, keyEl, flip) {
    // anchorX: px trong thước (chưa phóng); keyEl: phần tử phải đứng ngay trên / dưới mốc (ô năm / số năm dựng)
    node.classList.toggle('is-flip', flip);
    const W = track.offsetWidth;
    const w = node.offsetWidth;
    const kw = keyEl.offsetWidth;
    let left = flip ? anchorX - (w - kw / 2) : anchorX - kw / 2;
    left = Math.min(Math.max(left, -LAB_GAP), W + LAB_GAP - w);
    node.style.left = `${left.toFixed(1)}px`;
    node.style.setProperty('--caret', `${(anchorX - left).toFixed(1)}px`);
  }
  function renderLabels() {
    const on = labelsOn();
    el.dataset.focus = on ? '1' : '0';
    const W = track.offsetWidth;
    if (on) {
      const b = bia[focusI];
      ybox.textContent = String(b.year);
      ykhoa.innerHTML = `khoa <em>${esc(b.canChi ?? '')}</em>`;
      const ax = xOf(b.year) * W;
      placeLab(elab, ax, ybox, ax > W * 0.8);
    }
    if (batch != null) {
      const k = batchOf(batch).length;
      dyear.textContent = String(batch);
      dtext.textContent = `năm dựng bia · ${k} khoa`;
      dlab.classList.remove('is-pending');
      const ax = xOf(batch) * W;
      placeLab(dlab, ax, dyear, ax > W * 0.8);
    } else if (on) {
      const b = bia[focusI];
      const known = hasDung(b);
      dyear.textContent = known ? String(b.dung) : '';
      dtext.textContent = known ? 'năm dựng bia' : 'năm dựng bia · chờ dữ liệu';
      dlab.classList.toggle('is-pending', !known);
      const ax = xOf(known ? b.dung : b.year) * W;
      placeLab(dlab, ax, known ? dyear : dtext, ax > W * 0.8);
    }
    el.dataset.dlab = batch != null || on ? '1' : '0';
  }

  // ---- trạng thái
  function paintTicks() {
    for (let i = 0; i < n; i++) {
      const t = ticks[i];
      t.classList.toggle('is-hot', i === focusI && labelsOn());
      t.classList.toggle('is-sel', i === current);
    }
    const sel = bia[current];
    for (const [y, m] of markOf) {
      m.classList.toggle('is-sel', hasDung(sel) && sel.dung === y);
      const fb = focusI >= 0 ? bia[focusI] : null;
      m.classList.toggle('is-hot', (batch != null && y === batch) || (labelsOn() && fb && fb.dung === y));
    }
    const inBatch = batch != null ? new Set(batchOf(batch)) : null;
    for (let i = 0; i < n; i++) ticks[i].classList.toggle('is-batch', !!inBatch?.has(i));
    if (batch != null) el.dataset.batch = String(batch);
    else delete el.dataset.batch;
    if (dyn) el.dataset.dyn = dyn;
    else delete el.dataset.dyn;
    for (const s of secs) s.classList.toggle('is-hot', !!dyn && s.dataset.dyn === dyn);
  }
  function update() {
    paintTicks();
    drawLinks();
    renderLabels();
    const r = rect();
    const cx = focusI >= 0 ? (focusSrc === 'mouse' && magX != null ? magX : r.left + xOf(bia[focusI].year) * r.width) : null;
    mag.aim(cx == null ? null : tickXs(), cx, focusI, Math.max(4, (MAG_SIGMA * r.width) / n));
  }
  function setFocus(i, src, x = null) {
    if (i !== focusI) {
      if (justPicked >= 0 && i !== justPicked) justPicked = -1;
    }
    focusI = i;
    focusSrc = i >= 0 ? src : '';
    magX = src === 'mouse' ? x : null;
    if (i >= 0) {
      batch = null;
      dyn = '';
    }
    update();
  }
  function setHover({ b = null, d = '' } = {}) {
    batch = b;
    dyn = d;
    focusI = -1;
    focusSrc = '';
    magX = null;
    update();
  }
  function clearAll() {
    batch = null;
    dyn = '';
    setFocus(-1, '');
  }
  function pick(i) {
    if (i < 0) return;
    justPicked = i;
    if (i !== current) onPick(i);
    update();
  }

  // ---- chuột
  function pointerAt(e) {
    const z = dragging ? 'exam' : zoneAt(e.clientY);
    if (z === 'exam') setFocus(nearest(e.clientX), 'mouse', e.clientX);
    else if (z === 'bar') setHover({ d: secAt(e.clientX, e.clientY) });
    else {
      const y = markAt(e.clientX);
      if (y != null) setHover({ b: y });
      else clearAll();
    }
  }
  const onMove = (e) => {
    if (sticky) return;
    if (!dragging && dragPassing(el, e)) return; // r29: kéo camera đi ngang qua → không hiện thẻ / tiêu điểm
    if (e.pointerType === 'touch' && !dragging) return;
    if (mouseMuted && !HAND_POINTER_IDS.has(e.pointerId)) return;
    // vừa lăn chuột: con trỏ đứng yên thì giữ tiêu điểm đã lăn tới (Chrome phát pointermove giả khi bố cục đổi)
    if (focusSrc === 'wheel' && e.clientX === lastPtr.x && e.clientY === lastPtr.y) return;
    lastPtr.x = e.clientX;
    lastPtr.y = e.clientY;
    pointerAt(e);
  };
  const lastPtr = { x: NaN, y: NaN };
  const onLeave = () => {
    if (!dragging && !sticky && !byHand) clearAll();
  };
  const onDown = (e) => {
    if (e.button > 0 || sticky) return;
    if (zoneAt(e.clientY) !== 'exam' && focusI < 0) return; // bấm trên thanh / mốc dựng: không chọn gì
    dragging = { id: e.pointerId, x: e.clientX, moved: false };
    try {
      track.setPointerCapture(e.pointerId);
    } catch {}
    if (focusSrc !== 'wheel') setFocus(nearest(e.clientX), 'mouse', e.clientX);
    e.preventDefault();
  };
  const onDrag = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    if (Math.abs(e.clientX - dragging.x) > 3) dragging.moved = true;
  };
  const onUp = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const d = dragging;
    dragging = null;
    // kéo: chọn mốc gần chỗ thả; bấm tại chỗ: chọn đúng tiêu điểm đang hiện (kể cả mốc vừa lăn tới)
    const i = d.moved || focusI < 0 ? nearest(e.clientX) : focusI;
    if (e.pointerType === 'touch') clearAll();
    pick(i);
  };
  const onCancel = () => {
    dragging = null;
    clearAll();
  };
  const onWheel = (e) => {
    if (sticky) return;
    if (mouseMuted && e.isTrusted === false) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dv = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    if (!dv) return;
    let steps = 0;
    if (unit > 1 || Math.abs(dv) >= WHEEL_NOTCH) {
      // một nấc bánh xe chuột (dòng / trang, hay ≥ WHEEL_NOTCH px) = đúng một mốc
      steps = Math.sign(dv);
      wheelAcc = 0;
    } else {
      // bàn di (nhiều sự kiện nhỏ): cộng dồn, mỗi WHEEL_STEP px một mốc; lần chạm đầu tiên phản hồi ngay
      wheelAcc += dv;
      while (Math.abs(wheelAcc) >= WHEEL_STEP) {
        steps += Math.sign(wheelAcc);
        wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP;
      }
      if (!steps && focusSrc !== 'wheel') {
        steps = Math.sign(dv);
        wheelAcc = 0;
      }
      if (!steps) return;
    }
    const from = focusI >= 0 ? focusI : current;
    const to = Math.min(n - 1, Math.max(0, from + steps));
    lastPtr.x = e.clientX;
    lastPtr.y = e.clientY;
    setFocus(to, 'wheel');
  };
  // Con trỏ tay: lớp cử chỉ phát click lên đúng mốc nam châm / mốc [data-hand-focus] (chế độ dính) → chọn mốc đó
  const onClick = (e) => {
    const t = e.target.closest?.('.cin-tl__tick');
    if (!t || dragging) return;
    if (e.isTrusted && e.detail > 0 && !sticky) return; // bấm chuột thật đã chọn ở pointerup
    const i = Number(t.dataset.i);
    if (Number.isFinite(i)) pick(i);
  };
  track.addEventListener('pointermove', onMove);
  track.addEventListener('pointermove', onDrag);
  track.addEventListener('pointerleave', onLeave);
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('pointerup', onUp);
  track.addEventListener('pointercancel', onCancel);
  track.addEventListener('wheel', onWheel, { passive: false });
  track.addEventListener('click', onClick);

  function applyCurrent() {
    const b = bia[current];
    if (!b) return;
    for (const t of ticks) if (t.hasAttribute('aria-current')) t.removeAttribute('aria-current');
    ticks[current]?.setAttribute('aria-current', 'true');
    run.style.left = pct(xOf(b.year));
    track.setAttribute('aria-valuenow', String(current + 1));
    track.setAttribute('aria-valuetext', `Bia ${b.year} · khoa ${b.canChi ?? ''}${hasDung(b) ? ` · dựng ${b.dung}` : ' · năm dựng chờ dữ liệu'}`);
    update();
  }
  const applyProgress = () => {
    run.style.transform = `translateX(-50%) scaleX(${progress < 0 ? 0 : progress > 1 ? 1 : progress})`;
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
      if (mouseMuted && !byHand && !dragging && !sticky) clearAll();
    },
    handAt(x, y) {
      if (dragging || sticky) return;
      if (dragPassing(el)) x = null; // r29: đang nhón–kéo camera → con trỏ tay đi ngang không mở thẻ (đang mở thì tắt)
      const r = rect();
      const inside = x != null && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 30 && y <= r.bottom + 24;
      if (inside) {
        byHand = true;
        const cap = track.querySelector('.cin-tl__tick[data-hi-captured]');
        if (cap) setFocus(Number(cap.dataset.i), 'hand');
        else if (zoneAt(y) === 'bar') setHover({ d: secAt(x, y) });
        else setFocus(nearest(x), 'hand');
      } else if (byHand) {
        byHand = false;
        clearAll();
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
          justPicked = -1;
        }
        // r30g: lớp tay chọn mốc (d.focus — nấc / tinh chỉnh / mốc trước lúc khép ngón); không có thì theo vị trí như cũ
        const i = Number.isInteger(d.focus) && d.focus >= 0 && d.focus < bia.length ? d.focus : stickyIdx.map(d.rel?.x ?? 0.5);
        setHandFocus(i);
        if (i !== focusI) setFocus(i, 'sticky');
      } else if (sticky) {
        sticky = false;
        el.classList.remove('is-sticky');
        setHandFocus(-1);
        clearAll();
      }
    },
    tickRect(i) {
      return ticks[i]?.getBoundingClientRect() ?? null;
    },
    markRect(year) {
      return markOf.get(year)?.getBoundingClientRect() ?? null;
    },
    secRect(id) {
      return el.querySelector(`.cin-tl__sec[data-dyn="${id}"]`)?.getBoundingClientRect() ?? null;
    },
    get magnify() {
      return { x: magX, k: mag.k, hot: focusI, src: focusSrc, batch, dyn, labels: labelsOn(), sticky };
    },
    destroy() {
      mag.stop();
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointermove', onDrag);
      track.removeEventListener('pointerleave', onLeave);
      track.removeEventListener('pointerdown', onDown);
      track.removeEventListener('pointerup', onUp);
      track.removeEventListener('pointercancel', onCancel);
      track.removeEventListener('wheel', onWheel);
      track.removeEventListener('click', onClick);
      el.classList.remove('is-sticky');
      delete el.dataset.focus;
      delete el.dataset.batch;
      delete el.dataset.dyn;
      delete el.dataset.dlab;
    },
  };
}
