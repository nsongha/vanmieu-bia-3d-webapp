// Kiểu "Trang triển lãm" — một trang kính mờ 16:9 như trang catalogue triển lãm, neo theo MÀN
// HÌNH (HUD thật trong ctx.hudRoot): chữ luôn đọc được dù bia phía sau đang bị xoay / zoom.
//
//   · Lưới 12 cột: cột 1–3 nhãn "tombstone" (năm lớn, "Bia số …/82", các dòng khoa thi…),
//     cột 4–9 ô cửa TRONG (không phủ kính) có 4 dấu góc như khung ngắm máy ảnh + chú thích
//     bên dưới, cột 10–12 bài viết (tiêu đề, mô tả có chữ hoa thả, đồ hoạ "Ba đợt dựng bia").
//   · Kính chỉ phủ phần quanh ô cửa: lớp kính có clip-path path(evenodd) khoét lỗ ô cửa, lỗ này
//     mở ra từ tâm (hoạt ảnh "mống mắt") khi trang hiện.
//   · Lúc hiện xin view dời camera cho bia vừa khít ô cửa (ctx.requestFraming); lúc ẩn trả về.
//   · Nghiêng rất nhẹ theo con trỏ (CSS 3D, ≤ 2,5°, làm mượt) như thẻ Apple TV.
//   · Trang KHÔNG nhận chuột (pointer-events: none): kéo xoay / lăn zoom đi thẳng xuống canvas,
//     cả qua ô cửa lẫn qua phần kính. hitTest phủ cả trang để rê đọc chữ không làm tắt thông tin.
//   · Bỏ qua angleFade(): trang là HUD, đọc được ở mọi góc xoay — đó là lý do có kiểu này.
import { PENDING } from '../facts.js';
import './spread.css';
import { ensureFont, FONT } from '../../../core/fonts.js';

const TOTAL_BIA = 82;
/** Ba đợt dựng bia (năm dựng) — trục thời gian 1484 → 1780. */
const WAVES = [
  { dot: 1, from: 1484, to: 1536, label: '1484', align: 'l' },
  { dot: 2, from: 1653, to: 1653, label: '1653', align: 'c' },
  { dot: 3, from: 1717, to: 1780, label: '1717–80', align: 'r' },
];
const T_FROM = 1484;
const T_TO = 1780;

const REF_W = 1180; // bề ngang trang ứng với --u = 1 (≈ 82vw ở màn 1440)
const IRIS_MS = 480;
const OUT_MS = 300;
const TILT_MAX = 2.5; // độ
const TILT_LERP = 0.08; // mỗi khung 60 Hz
// Con trỏ đứng yên (xê dịch < TILT_SLOP px) quá TILT_REST_MS → trang từ từ nằm phẳng lại:
// chữ trong lớp nghiêng 3D bị lấy mẫu lại nên hơi mềm, lúc đứng đọc thì trang phải phẳng, sắc nét.
const TILT_SLOP = 12;
const TILT_REST_MS = 1100;
const PERSPECTIVE = 1400; // px
const MARK = 14; // px — cạnh dấu góc
const RADIUS = 14; // px — bo góc trang (khớp --sp-radius)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const r1 = (v) => Math.round(v * 10) / 10;
const pct = (y) => ((y - T_FROM) / (T_TO - T_FROM)) * 100;

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
}

/** Đánh dấu một phần tử là "dòng" hiện so le: cột c (0 trái · 1 giữa · 2 phải), dòng i. */
function line(e, c, i) {
  e.classList.add('cin-sp__ln');
  e.style.setProperty('--c', String(c));
  e.style.setProperty('--i', String(i));
  return e;
}

/** @param {import('./contract.js').InfoCtx} ctx */
export function createInfoLayout(ctx) {
  // Tiêu đề / chú thích có dấu tiếng Việt → Playfair Display (Bodoni Moda không có bộ chữ Việt).
  ensureFont(FONT.playfair);
  const rm = !!ctx.reduceMotion;

  // ---------------------------------------------------------------- DOM
  const page = el('section', 'cin-sp');
  page.setAttribute('aria-label', 'Thông tin tấm bia');
  page.setAttribute('aria-hidden', 'true');
  page.dataset.state = 'out';
  if (rm) page.dataset.rm = '1';

  const lift = el('div', 'cin-sp__lift', page);
  el('div', 'cin-sp__shadow', lift);
  const frost = el('div', 'cin-sp__frost', lift);
  el('div', 'cin-sp__edge', lift);

  // Cột trái — nhãn bảo tàng
  const colL = el('div', 'cin-sp__col cin-sp__col--l', lift);
  const yearEl = line(el('p', 'cin-sp__year', colL), 0, 0);
  const noEl = line(el('p', 'cin-sp__no', colL), 0, 1);
  el('div', 'cin-sp__fill', colL);
  line(el('div', 'cin-sp__rule', colL), 0, 2);
  const factsEl = el('dl', 'cin-sp__facts', colL);

  // Giữa — ô cửa (chỉ có dấu góc; phần trong suốt là lỗ khoét trên lớp kính) + chú thích
  const marksEl = el('div', 'cin-sp__marks', lift);
  marksEl.setAttribute('aria-hidden', 'true');
  const marks = ['tl', 'tr', 'bl', 'br'].map((c) => {
    const m = el('span', 'cin-sp__mark', marksEl);
    m.dataset.c = c;
    return m;
  });
  const capEl = line(el('p', 'cin-sp__cap', lift), 1, 0);
  const capText = el('span', '', capEl);

  // Cột phải — bài viết
  const colR = el('div', 'cin-sp__col cin-sp__col--r', lift);
  const titleEl = line(el('h2', 'cin-sp__title', colR), 2, 0);
  line(el('div', 'cin-sp__sep', colR), 2, 1);
  const bodyEl = line(el('div', 'cin-sp__body', colR), 2, 2);
  const descEl = el('p', 'cin-sp__desc', bodyEl);
  const wavesEl = line(el('div', 'cin-sp__waves', colR), 2, 3);
  const wavesK = el('p', 'cin-sp__k', wavesEl);
  wavesK.textContent = 'Ba đợt dựng bia';
  const tl = el('div', 'cin-sp__tl', wavesEl);
  tl.setAttribute('role', 'img');
  el('span', 'cin-sp__axis', tl);
  const waveEls = WAVES.map((w) => {
    let span = null;
    if (w.to > w.from) {
      span = el('span', 'cin-sp__span', tl);
      span.style.left = `${pct(w.from)}%`;
      span.style.width = `${pct(w.to) - pct(w.from)}%`;
    }
    const dot = el('span', 'cin-sp__dot', tl);
    dot.style.left = `${pct(w.from)}%`;
    const yr = el('span', 'cin-sp__yr', tl);
    yr.textContent = w.label;
    yr.dataset.a = w.align;
    yr.style.left = w.align === 'r' ? 'calc(100% + 3px)' : w.align === 'l' ? '-3px' : `${pct(w.from)}%`;
    return { w, span, dot, yr };
  });

  ctx.hudRoot.appendChild(page);

  // ---------------------------------------------------------------- trạng thái
  let entry = null;
  let visible = false;
  let alive = true;
  let hiddenAt = -1e9; // mốc bắt đầu ẩn gần nhất (ms)
  let irisT0 = -1; // mốc bắt đầu mở ô cửa; < 0 = không chạy
  let irisE = 1; // 0..1 độ mở hiện tại của ô cửa
  let rx = 0; // nghiêng hiện tại (độ)
  let ry = 0;
  let tiltW = ''; // transform đã ghi lần gần nhất
  let moveX = 0; // mốc đo "con trỏ còn đang di chuyển"
  let moveY = 0;
  let moveAt = -1e9;
  let lastVW = 0;
  let lastVH = 0;

  /** Hình học (px): trang so với hudRoot, các vùng so với trang. */
  const G = {
    ox: 0, // gốc hudRoot trong khung nhìn
    oy: 0,
    vw: 0,
    vh: 0,
    x: 0, // trang
    y: 0,
    w: 0,
    h: 0,
    win: { x: 0, y: 0, w: 0, h: 0 }, // ô cửa (so với trang)
  };

  // ---------------------------------------------------------------- nội dung
  function fill(e) {
    entry = e ?? null;
    if (!e) return;
    yearEl.textContent = String(e.year ?? '');
    const stt = document.createElement('b');
    stt.textContent = String(e.stt ?? '—');
    noEl.replaceChildren('Bia số ', stt, ` / ${TOTAL_BIA}`);

    factsEl.replaceChildren();
    ctx.facts(e).forEach((f, k) => {
      const row = line(el('div', 'cin-sp__row', factsEl), 0, 3 + k);
      el('dt', '', row).textContent = f.label;
      el('dd', '', row).textContent = f.value;
    });

    titleEl.textContent = String(e.title ?? '');
    // r21: bia chưa có dữ liệu lịch sử → một dòng "Chờ dữ liệu" lặng lẽ; chú thích không có "Dựng năm" rỗng
    descEl.textContent = e.mota ? String(e.mota) : PENDING;
    descEl.classList.toggle('is-pending', !e.mota);
    const dotSep = document.createElement('i');
    dotSep.textContent = '·';
    if (e.dung != null) capText.replaceChildren(`Bia Tiến sĩ khoa ${e.canChi ?? ''} (${e.year ?? ''})`, dotSep, `Dựng năm ${e.dung}`);
    else capText.replaceChildren(`Bia Tiến sĩ khoa ${e.canChi ?? ''} (${e.year ?? ''})`);

    for (const { w, span, dot, yr } of waveEls) {
      const on = w.dot === e.dot;
      for (const n of [span, dot, yr]) n?.toggleAttribute('data-on', on);
    }
    const cur = WAVES.find((w) => w.dot === e.dot);
    tl.setAttribute(
      'aria-label',
      `Ba đợt dựng bia: 1484–1536, 1653, 1717–1780.${cur ? ` Bia này thuộc đợt ${cur.dot}, dựng năm ${e.dung}.` : ''}`,
    );
    if (visible) measureClip();
  }

  /** Bài dài hơn chỗ trống → bật dải mờ ở đáy (đo DOM: chỉ khi đổi nội dung / đặt lại trang). */
  function measureClip() {
    bodyEl.dataset.clip = bodyEl.scrollHeight > bodyEl.clientHeight + 1 ? '1' : '0';
  }

  // ---------------------------------------------------------------- bố cục
  function place() {
    const hr = ctx.hudRoot.getBoundingClientRect();
    const VW = hr.width || window.innerWidth;
    const VH = hr.height || window.innerHeight;
    G.ox = hr.left;
    G.oy = hr.top;
    G.vw = VW;
    G.vh = VH;
    lastVW = window.innerWidth;
    lastVH = window.innerHeight;

    const wide = VW >= 900;
    let w;
    let h;
    if (wide) {
      // ≈ min(82vw, 1280) — màn vừa (900–1100) thì nới rộng hơn một chút để cột chữ không hẹp quá.
      w = Math.min(1280, Math.max(VW * 0.82, Math.min(VW - 64, 860)));
      h = (w * 9) / 16;
      const hMax = VH * 0.78;
      if (h > hMax) {
        h = hMax;
        w = (h * 16) / 9;
      }
    } else {
      // Màn hẹp: trang hẹp hơn, tỉ lệ 4:3 để cột chữ còn đủ cao.
      w = Math.min(VW - 32, 860);
      h = Math.min((w * 3) / 4, VH * 0.74);
    }
    w = Math.round(w);
    h = Math.round(h);
    const x = Math.round((VW - w) / 2);
    const y = Math.round(Math.max(8, (VH - h) / 2 - Math.min(VH * 0.03, 28))); // hơi trên tâm

    const u = clamp(w / REF_W, 0.64, 1.08);
    const P = Math.round(Math.max(20, 40 * u)); // lề trong
    const GT = Math.round(Math.max(12, 20 * u)); // rãnh cột
    const capH = Math.round(Math.max(28, 38 * u)); // dải chú thích dưới ô cửa
    const split = wide ? [3, 6, 3] : [3, 5, 4];
    const c = (w - 2 * P - 11 * GT) / 12;
    const span = (n) => n * c + (n - 1) * GT;
    // Mép các vùng làm tròn về điểm ảnh nguyên: dấu góc 1 px và mép lỗ kính luôn sắc.
    const wL = Math.round(span(split[0]));
    const wx = Math.round(P + split[0] * (c + GT));
    const win = { x: wx, y: P, w: Math.round(P + (split[0] + split[1]) * (c + GT) - GT) - wx, h: h - 2 * P - capH };
    const xR = win.x + win.w + GT;
    const wR = w - P - xR;

    Object.assign(G, { x, y, w, h, win });
    const s = page.style;
    s.left = `${x}px`;
    s.top = `${y}px`;
    s.width = `${w}px`;
    s.height = `${h}px`;
    s.setProperty('--u', u.toFixed(3));
    page.dataset.dense = wL < 230 ? '1' : '0';
    // Toạ độ nguyên: chữ không nằm lệch nửa điểm ảnh trong lớp ghép.
    const box = (n, bx, by, bw, bh) => {
      n.style.left = `${Math.round(bx)}px`;
      n.style.top = `${Math.round(by)}px`;
      n.style.width = `${Math.round(bw)}px`;
      n.style.height = `${Math.round(bh)}px`;
    };
    box(colL, P, P, wL, h - 2 * P);
    box(colR, xR, P, wR, h - 2 * P);
    box(capEl, win.x, win.y + win.h, win.w, capH);
    applyIris(irisE);
  }

  /** Ô cửa mở e (0..1) từ tâm: khoét lỗ trên lớp kính + dời 4 dấu góc theo mép lỗ. */
  function applyIris(e) {
    const { w, h, win } = G;
    if (!w || !h) return;
    const cx = win.x + win.w / 2;
    const cy = win.y + win.h / 2;
    const hw = (win.w / 2) * e;
    const hh = (win.h / 2) * e;
    const x0 = r1(cx - hw);
    const x1 = r1(cx + hw);
    const y0 = r1(cy - hh);
    const y1 = r1(cy + hh);
    const R = RADIUS;
    const outer = `M${R} 0H${w - R}A${R} ${R} 0 0 1 ${w} ${R}V${h - R}A${R} ${R} 0 0 1 ${w - R} ${h}H${R}A${R} ${R} 0 0 1 0 ${h - R}V${R}A${R} ${R} 0 0 1 ${R} 0Z`;
    const hole = e > 0.0005 ? `M${x0} ${y0}H${x1}V${y1}H${x0}Z` : '';
    frost.style.clipPath = `path(evenodd, "${outer}${hole}")`;
    const pos = [
      [x0, y0],
      [x1 - MARK, y0],
      [x0, y1 - MARK],
      [x1 - MARK, y1 - MARK],
    ];
    const op = e >= 1 ? '' : String(r1(clamp((e - 0.08) * 1.6, 0, 1)));
    marks.forEach((m, k) => {
      m.style.transform = `translate(${pos[k][0]}px,${pos[k][1]}px)`;
      m.style.opacity = op;
    });
  }

  /** Ô cửa theo px khung nhìn (client). */
  function windowRect() {
    const { ox, oy, x, y, win } = G;
    return { x: ox + x + win.x, y: oy + y + win.y, w: win.w, h: win.h };
  }

  function frame() {
    if (!ctx.requestFraming) return;
    const r = windowRect();
    // Chừa chút lề trong ô cửa để đỉnh bia / chân rùa không chạm dấu góc.
    const mx = r.w * 0.04;
    const my = r.h * 0.045;
    ctx.requestFraming({ fit: 'window', rect: { x: r.x + mx, y: r.y + my, w: r.w - 2 * mx, h: r.h - 2 * my } });
  }

  // ---------------------------------------------------------------- nghiêng theo con trỏ
  function tickTilt(dt) {
    if (rm || !visible) return; // đang ẩn: giữ nguyên tư thế cho lúc mờ đi
    let tx = 0;
    let ty = 0;
    const p = ctx.pointer();
    if (p?.active) {
      const now = performance.now();
      if (Math.abs(p.x - moveX) + Math.abs(p.y - moveY) > TILT_SLOP) {
        moveX = p.x;
        moveY = p.y;
        moveAt = now;
      }
      if (now - moveAt < TILT_REST_MS) {
        const nx = clamp((p.x - (G.ox + G.vw / 2)) / Math.max(1, G.vw / 2), -1, 1);
        const ny = clamp((p.y - (G.oy + G.vh / 2)) / Math.max(1, G.vh / 2), -1, 1);
        // Phía con trỏ lùi vào trong một chút, như ấn nhẹ lên tấm thẻ.
        ty = nx * TILT_MAX;
        tx = -ny * TILT_MAX;
      }
    }
    const k = 1 - Math.pow(1 - TILT_LERP, clamp(dt, 0, 0.1) * 60);
    rx += (tx - rx) * k;
    ry += (ty - ry) * k;
    if (Math.abs(rx) < 0.004 && Math.abs(ry) < 0.004 && tx === 0 && ty === 0) {
      rx = 0;
      ry = 0;
    }
    // Phẳng hẳn → bỏ transform: chữ về đúng lưới điểm ảnh.
    const s = rx === 0 && ry === 0 ? '' : `perspective(${PERSPECTIVE}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
    if (s !== tiltW) {
      tiltW = s;
      page.style.transform = s;
    }
  }

  function resetTilt() {
    rx = 0;
    ry = 0;
    tiltW = '';
    page.style.transform = '';
  }

  // ---------------------------------------------------------------- vòng đời
  function show(e) {
    if (e && e !== entry) fill(e);
    if (visible) return;
    visible = true;
    const now = performance.now();
    const fullyHidden = now - hiddenAt > OUT_MS + 40;
    page.setAttribute('aria-hidden', 'false');
    if (fullyHidden) {
      // Bắt đầu lại từ đầu: trang thấp 24 px, chữ thấp 6 px, ô cửa đóng.
      resetTilt();
      irisE = rm ? 1 : 0;
      irisT0 = rm ? -1 : now;
      page.dataset.state = 'pre';
      place();
      void page.offsetWidth; // chốt trạng thái đầu cho transition
    } else {
      // Hiện lại khi đang mờ đi dở: đi ngược từ chỗ đang đứng, ô cửa giữ nguyên độ mở.
      place();
    }
    page.dataset.state = 'in';
    measureClip();
    frame();
  }

  function hide() {
    if (!visible) return;
    visible = false;
    hiddenAt = performance.now();
    page.dataset.state = 'out';
    page.setAttribute('aria-hidden', 'true');
    ctx.requestFraming?.(null);
  }

  // Font hiển thị (Playfair nạp lười) xong → cao dòng đổi → đo lại chỗ cắt bài viết.
  const onFonts = () => {
    if (alive && visible) measureClip();
  };
  document.fonts?.ready?.then(onFonts);
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  return {
    show,
    hide,
    setEntry(e) {
      if (e && e !== entry) fill(e);
    },
    isVisible: () => visible,
    update(dt) {
      if (visible && (window.innerWidth !== lastVW || window.innerHeight !== lastVH)) {
        place();
        measureClip();
        frame();
      }
      if (irisT0 >= 0) {
        const t = clamp((performance.now() - irisT0) / IRIS_MS, 0, 1);
        irisE = easeOutCubic(t);
        applyIris(irisE);
        if (t >= 1) irisT0 = -1;
      }
      tickTilt(dt);
    },
    hitTest(x, y) {
      if (!visible || !G.w) return false;
      const x0 = G.ox + G.x;
      const y0 = G.oy + G.y;
      // Rộng thêm vài px: nghiêng 3D / nhô lên làm mép trang lệch nhẹ khỏi hộp phẳng.
      const m = 8;
      return x >= x0 - m && x <= x0 + G.w + m && y >= y0 - m && y <= y0 + G.h + m;
    },
    dispose() {
      alive = false;
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      if (visible) ctx.requestFraming?.(null);
      visible = false;
      page.remove();
    },
  };
}
