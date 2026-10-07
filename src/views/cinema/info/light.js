// Kiểu hiện thông tin "Chữ ánh sáng".
//
// Không khung, không nền — chữ làm bằng ánh sáng, như trong các triển lãm chiếu hình
// (projection mapping), nhưng tiết chế. Thông tin như trồi ra từ TRONG lòng đá:
//
//   · Bên PHẢI: các dòng khoa thi trượt ra từ sau mép phải phiến bia, so le 60 ms, kéo theo
//     một vệt sáng bùng lên rồi lắng thành quầng mờ; lời dẫn (mota) "lấy nét" sau cùng.
//   · Bên TRÁI: số năm khoa thi làm đầu cột; bốn chú giải bộ phận trượt ra từ sau
//     mép trái phiến bia, rồi mỗi chú giải kéo một đường dẫn 1px tới đúng điểm neo trên đá.
//     Rê vào chú giải → chữ sáng lên, vòng neo nới rộng và toả nhịp nhẹ. (Không có đèn riêng:
//     hiệu ứng ánh sáng "đang chọn" do view lo chung cho mọi kiểu.)
//
// "Trồi ra từ trong đá": chữ là DOM (CSS3D) nên đá không che được. Mỗi cột là một hộp có KÍCH
// THƯỚC TƯỜNG MINH mà mép phía đá trùng mép phiến bia; CHỈ trong lúc có dòng đang trượt, hộp mang
// một mặt nạ TĨNH (trong suốt tại mép đá, mềm 16px). Vào chỗ hết là gỡ hẳn mặt nạ.
//
// Hộp tường minh (không dùng neo 0×0 + tràn nội dung, không hộp co-giãn theo nội dung, không
// SVG 1×1 overflow:visible): mọi nét chữ/đường dẫn đều nằm TRONG hộp của phần tử CSS3D chứa nó,
// nên không phụ thuộc cách trình duyệt tính biên lớp 3D.
//
// Co giãn: CÙNG một hệ số cho hai cột (bố cục đối xứng). Không chữ nào nhỏ hơn 11px CSS (triển
// lãm công cộng). Không đủ chỗ trong vùng an toàn (đích nam châm, HUD) ở cỡ đọc được thì lùi dần
// qua các BẬC bố cục (LEVELS): đủ → gọn (bỏ mô tả chú giải + lời dẫn, nhãn trên giá trị) → chỉ
// cột phải (bỏ cột trái + đường dẫn) có lời dẫn → chỉ cột phải không lời dẫn → chỉ dòng tiêu đề
// → không hiện gì.
//
// Hiệu năng — mỗi khung chỉ ghi transform/opacity, không đọc DOM trong update():
//   · Vệt sáng = bản sao chữ làm mờ sẵn (text-shadow TĨNH), chỉ đổi opacity/translate.
//   · Đo bố cục khi đang ẩn (đổi bia / đổi cỡ / font nạp xong).
//   · Điểm neo trên mặt đá tính một lần mỗi bia, theo lát trong requestIdleCallback.
//   · Đường dẫn chỉ tính lại khi mặt phẳng/camera thực sự đổi, chỉ ghi khi dịch > 0,5 px.
//
// Bám mặt phẳng: nhóm "rig" không tự cập nhật ma trận; mỗi khung chép matrixWorld của MẶT
// PHẲNG ĐÃ BẮT LÚC show() (đổi bia thì phần đang mờ ra vẫn đi theo tấm bia cũ).
import { PENDING } from '../facts.js';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ensureFont, FONT } from '../../../core/fonts.js';
import './light.css';

// ---- Bố cục: px CSS ở khung mặc định 1440×900 (≈546 px cho một đơn vị chiều cao bia) --------
const REF_PPU = 546; // px / đơn vị ở khung tham chiếu → hệ số thiết kế k = 1
const GAP_FULL = 56; // khe mép phiến bia → mép cột, HAI BÊN NHƯ NHAU
const GAP_COMPACT = 40; // bố cục gọn: khe hẹp hơn
const COL_R = 352; // bề ngang tối đa cột phải (khớp CSS; cột ôm sát chữ)
const COL_L = 300; // bề ngang tối đa cột trái
const PAD = 20; // = --cil-pad: hộp vượt quá chữ chừng này cho quầng sáng (blur 16px)
const EDGE_MIN = 32; // px màn hình — lề tối thiểu tới mép khung khi không có vùng phải chừa
const SAFE_PAD = 12; // px màn hình — chừa thêm ngoài ctx.safeArea()
const PERSP = 1.02; // nội dung xa tâm khung phóng lớn hơn tỉ lệ worldPerPx chừng 1,5% (đo được)
// Không chữ nào dưới MIN_TEXT px CSS khi hiển thị. `min` = cỡ chữ nhỏ nhất (px thiết kế) của bậc
// đó, khớp CSS: bố cục đủ — nhãn chữ hoa 12px; gọn — nhãn 14px (giá trị 15, lời dẫn 14); chỉ
// tiêu đề — 24px. Bậc được chọn là bậc ĐẦU TIÊN vừa vùng an toàn ở hệ số ≥ MIN_TEXT / min.
const MIN_TEXT = 11;
const LEVELS = Object.freeze([
  { id: 'full', left: true, compact: false, narrow: false, desc: true, titleOnly: false, min: 12 },
  { id: 'compact', left: true, compact: true, narrow: false, desc: false, titleOnly: false, min: 14 },
  { id: 'right', left: false, compact: true, narrow: true, desc: true, titleOnly: false, min: 14 },
  { id: 'rows', left: false, compact: true, narrow: true, desc: false, titleOnly: false, min: 14 },
  { id: 'title', left: false, compact: true, narrow: true, desc: false, titleOnly: true, min: 24 },
]);
const NONE_LEVEL = Object.freeze({ id: 'none', left: false, compact: true, narrow: true, desc: false, titleOnly: true, min: 24, none: true });
const K_MAX = 1.35;
// Khối đầu cột, đo từ đỉnh chữ hoa tới chân chữ: bên phải "BIA TIẾN SĨ" + "Khoa …", bên trái
// là số năm (.cil-year) — cao đúng bằng nhau (43px, khớp CSS) để hai vạch kẻ cùng một hàng.
const LEAD_X0 = 10; // đường dẫn bắt đầu cách mép cột trái
const RING_R = 5.5;
const LEAD_EPS = 0.5; // px — đầu mút dịch ít hơn thế thì không ghi lại đường dẫn
const LEAD_BOX_PAD = 24; // hộp đường dẫn nhô quá điểm neo / chân bia chừng này (vòng + nhịp toả)
const Z_R = 0.003; // z cục bộ riêng cho từng khối CSS3D
const Z_L = 0.0036;
const Z_D = 0.0033;

// ---- Nhịp (ms) ------------------------------------------------------------------------------
const TRAVEL = 0.25; // quãng trượt, đơn vị mặt phẳng
const IN_MS = 620;
const STAGGER = 60;
const OUT_MS = 360;
const L_DELAY = 120; // cột trái vào sau cột phải một nhịp
const BLOOM_MS = 900;
const GLOW_REST = 0.26; // độ đục lúc nghỉ của bản sao phát sáng (khớp CSS)
const DESC_MS = 500;
const DESC_OUT_MS = 280;
const LEAD_MS = 500;
const LEAD_OUT_MS = 240;
const HOT_MS = 200;
const RM_IN_MS = 280; // giảm chuyển động: chỉ mờ dần
const RM_OUT_MS = 200;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const linear = (u) => u;
const easeOut3 = (u) => 1 - (1 - u) ** 3;
const easeIn3 = (u) => u * u * u;
const easeOut2 = (u) => 1 - (1 - u) * (1 - u);
const easeIn2 = (u) => u * u;
const easeInOut3 = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const smooth = (k) => k * k * (3 - 2 * k);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const q4 = (v) => Math.round(v * 4) / 4; // 0,25 px

/** Tween 0..1 có trễ, luôn nối tiếp từ vị trí hiện tại (đảo chiều giữa chừng không giật). */
function tween() {
  return { pos: 0, from: 0, to: 0, t: 0, dur: 1, ease: linear, done: true };
}
function tweenTo(tw, to, dur, delay, ease) {
  tw.from = tw.pos;
  tw.to = to;
  tw.t = -Math.max(0, delay);
  tw.dur = Math.max(1, dur);
  tw.ease = ease;
  tw.done = tw.pos === to && delay <= 0;
  if (tw.done) tw.t = tw.dur;
}
function stepTween(tw, ms) {
  if (tw.done) return;
  tw.t += ms;
  if (tw.t <= 0) return;
  const u = clamp01(tw.t / tw.dur);
  tw.pos = tw.from + (tw.to - tw.from) * tw.ease(u);
  if (u >= 1) {
    tw.pos = tw.to;
    tw.done = true;
  }
}
/** ms còn lại tới khi tween chạm đích (kể cả trễ). */
const remaining = (tw) => (tw.done ? 0 : tw.dur - tw.t);

const SVG_NS = 'http://www.w3.org/2000/svg';
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
function svgEl(tag, cls, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  if (cls) e.setAttribute('class', cls);
  parent?.appendChild(e);
  return e;
}
/** offsetTop/Left cộng dồn tới `root` (không tính transform — đúng thứ cần: vị trí lúc nằm yên). */
function offY(node, root) {
  let y = 0;
  while (node && node !== root) {
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return y;
}
function offX(node, root) {
  let x = 0;
  while (node && node !== root) {
    x += node.offsetLeft;
    node = node.offsetParent;
  }
  return x;
}

/**
 * Điểm trên mặt đá của từng điểm neo (plane-local), theo bia — sống qua các lần hiện/ẩn và cả
 * khi gắn lại kiểu này. Mỗi bia chỉ tính một lần.
 * @type {Map<string, import('three').Vector3[]>}
 */
const surfCache = new Map();
const modelKey = (m) => m?.name || m?.uuid || '';

const ric =
  typeof window.requestIdleCallback === 'function'
    ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
    : (cb) => window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 250);
const cancelRic =
  typeof window.cancelIdleCallback === 'function' ? (h) => window.cancelIdleCallback(h) : (h) => window.clearTimeout(h);

/** @param {import('./contract.js').InfoCtx} ctx */
export function createInfoLayout(ctx) {
  const { THREE } = ctx;
  const RM = !!ctx.reduceMotion;
  ctx.css3d.ensure();
  ensureFont(FONT.playfair); // tiêu đề: serif hiển thị CÓ subset tiếng Việt (Bodoni Moda thì không)
  let disposed = false;

  // ================= DOM (CSS3D) =================
  const rig = new THREE.Group();
  rig.matrixAutoUpdate = false;
  rig.visible = false;
  ctx.css3d.scene.add(rig);

  // Mỗi cột: phần tử CSS3D có bề ngang/cao TƯỜNG MINH (JS đặt sau khi đo), mép phía đá trùng mép
  // phiến bia. CSS3DRenderer đặt TÂM phần tử vào vị trí của object (translate −50%).
  function makeRoot(side, label) {
    const root = el('div', `cil cil--${side}`);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', label);
    root.setAttribute('aria-hidden', 'true');
    const clip = el('div', 'cil-clip', root);
    const stack = el('div', 'cil-stack', clip);
    const obj = new CSS3DObject(root);
    root.style.pointerEvents = 'none'; // CSS3DObject bật 'auto' → sẽ nuốt thao tác kéo canvas
    return { root, clip, stack, obj, w: -1, h: -1 };
  }
  const R = makeRoot('r', 'Thông tin khoa thi');
  const L = makeRoot('l', 'Chú giải các bộ phận bia');
  // Đường dẫn: phần tử CSS3D riêng, hộp tường minh phủ từ mép cột trái tới hết phiến bia.
  const D = { root: el('div', 'cil cil-leadbox'), obj: null, w: -1, h: -1 };
  D.root.setAttribute('aria-hidden', 'true');
  const leads = svgEl('svg', 'cil-leads', D.root);
  D.obj = new CSS3DObject(D.root);
  D.root.style.pointerEvents = 'none';
  rig.add(R.obj, D.obj, L.obj);

  /**
   * Một "dòng sáng": outer trong luồng bố cục (mang translate + opacity), bên trong là bản sao
   * phát sáng .cil-g (chữ trong suốt + text-shadow TĨNH; chỉ đổi opacity/translate) và chữ thật.
   * side +1 = cột phải (trượt sang phải), −1 = cột trái.
   */
  function makeLine(parent, side, cls, build) {
    const outer = el('div', `cil-ln ${cls}`, parent);
    const glow = el('div', 'cil-g', outer);
    glow.setAttribute('aria-hidden', 'true');
    const x = el('div', 'cil-x', outer);
    build(x);
    glow.append(...[...x.childNodes].map((n) => n.cloneNode(true)));
    return {
      outer,
      glow,
      x,
      side,
      tw: tween(),
      age: 0,
      prevX: NaN,
      settled: true,
      st: { x: NaN, op: NaN, gop: NaN, gx: NaN },
      box: null,
      quad: null,
    };
  }
  const resetLineState = (it) => {
    it.tw = tween();
    it.age = 0;
    it.prevX = NaN;
    it.settled = false; // vẽ lại một lần cho khớp trạng thái ẩn
    it.st.x = NaN;
    it.st.op = NaN;
    it.st.gop = NaN;
    it.st.gx = NaN;
  };

  // ---- Cột trái: số năm + vạch kẻ + bốn chú giải (dựng một lần; đổi bia chỉ đổi chữ số năm)
  const yearL = makeLine(L.stack, -1, 'cil-year-ln', (x) => el('div', 'cil-year', x));
  const ruleL = makeLine(L.stack, -1, 'cil-rule-ln', (x) => el('i', 'cil-rule', x));
  const cos = ctx.anatomy.map((a) => {
    const it = makeLine(L.stack, -1, 'cil-co-ln', (x) => {
      el('div', 'cil-co__k', x, a.label);
      el('div', 'cil-co__t', x, a.text);
    });
    it.outer.dataset.part = a.id;
    const g = svgEl('g', 'cil-lead', leads);
    // Nét viền tối rất mảnh bên dưới (không filter) để nét sáng đọc được trên mặt đá sáng màu.
    const caseP = svgEl('path', 'cil-case', g);
    const path = svgEl('path', 'cil-line', g);
    const pulse = svgEl('circle', 'cil-pulse', g);
    const ringC = svgEl('circle', 'cil-case cil-ringc', g);
    const ring = svgEl('circle', 'cil-ring', g);
    const pip = svgEl('circle', 'cil-pip', g);
    for (const c of [ring, ringC, pulse]) c.setAttribute('r', String(RING_R));
    pip.setAttribute('r', '1.8');
    for (const c of [ring, ringC, pip, pulse]) c.style.opacity = '0';
    for (const p of [path, caseP]) p.style.strokeDasharray = '0 99999';
    return Object.assign(it, {
      a,
      label: it.x.firstElementChild,
      labelY: 0,
      lead: {
        g,
        path,
        caseP,
        ring,
        ringC,
        pip,
        pulse,
        tw: tween(),
        st: { d: '', len: 0, off: NaN, rq: NaN, hk: NaN, ex: NaN, ey: NaN, y0: NaN },
      },
      end: { x: NaN, y: NaN }, // điểm neo chiếu lên mặt phẳng CSS (px của cột trái)
      endScreen: { x: 0, y: 0, behind: false },
      hk: 0,
      hot: false,
    });
  });
  const linesL = [yearL, ruleL, ...cos];

  // ---- Cột phải: dựng lại mỗi khi đổi bia (lúc đang ẩn)
  /** @type {ReturnType<typeof makeLine>[]} */
  let linesR = [];
  const desc = {
    wrap: null,
    sharp: null,
    blur: null,
    tw: tween(),
    st: { op: NaN, bop: NaN },
    box: null,
    quad: null,
    clamped: false,
    settled: true,
  };

  // ================= Trạng thái =================
  let visible = false;
  let active = false; // còn gì để vẽ / tween
  /** Mặt phẳng bắt lúc show(): đổi bia thì phần đang mờ ra vẫn đi theo tấm bia CŨ. */
  let plane = null;
  let Mcap = null; // SteleMetrics của tấm bia đó
  /** show() cho bia MỚI đến lúc chữ còn đang rút trên bia cũ (vừa chuyển cảnh) → chờ rút xong mới hiện. */
  let queued = null;
  let content = null;
  let pending = null;
  let measured = false;
  let remeasure = false;
  let animOn = false; // đang tách lớp (will-change) cho hoạt ảnh
  let maskR = false;
  let maskL = false;
  let afSent = -1;
  let quadsOk = false;
  let quadsStale = true;
  let geomDirty = true;
  let rayCount = -1;
  let hotIdx = -1;

  // Bậc bố cục hiện tại (LEVELS), khe hiện tại, kích thước cột đo được (px thiết kế).
  let level = LEVELS[0];
  let gap = GAP_FULL;
  let modeDirty = true;
  let modeWpp = NaN;
  const colSize = { wR: COL_R, hR: 420, wL: COL_L, hL: 380 };

  // Điểm neo trên mặt đá: tính theo lát trong requestIdleCallback, một bia một lần.
  let rayJob = null;
  const raySlices = import.meta.env.DEV ? [] : null; // DEV: thời lượng từng lát (ms)
  let planeKey = '';

  const G = { M: null, s: 0.001, k: 1, xR: 0, xL: 0, yT: 0, travelPx: 100 };
  const _size = new THREE.Vector2();
  const _q = new THREE.Vector3();
  const _cam = new THREE.Vector3(); // camera trong toạ độ plane-local (tính khi khung nhìn đổi)
  const _inv = new THREE.Matrix4();
  const _lastPlaneM = new THREE.Matrix4();
  const _lastCamM = new THREE.Matrix4();
  let lastS = NaN;

  // Vùng phải chừa (ctx.safeArea, px client): đọc lúc chọn bố cục (show / đổi cỡ / bật-tắt điều
  // khiển bằng tay qua lớp gesture-on của body) — không đọc mỗi khung.
  const NO_SAFE = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
  let safe = NO_SAFE;
  const readSafe = () => {
    let v = null;
    try {
      v = ctx.safeArea?.();
    } catch {
      v = null;
    }
    safe = v && [v.top, v.right, v.bottom, v.left].every(Number.isFinite) ? v : NO_SAFE;
  };
  const onResize = () => {
    modeDirty = true;
  };
  window.addEventListener('resize', onResize);
  const bodyObs = typeof MutationObserver === 'function' ? new MutationObserver(onResize) : null;
  bodyObs?.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function onFonts() {
    // Ẩn → đo ngay. Đang hiện → đo khi ẩn (không đọc DOM giữa hoạt ảnh; số cũ vẫn gần đúng).
    if (!active) chooseMode();
    else remeasure = true;
  }
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  // ================= Nội dung =================
  function fill(entry) {
    content = entry ?? null;
    R.stack.replaceChildren();
    linesR = [];
    const e = entry ?? {};

    linesR.push(makeLine(R.stack, 1, 'cil-over-ln', (x) => el('div', 'cil-over', x, 'Bia tiến sĩ')));
    linesR.push(
      makeLine(R.stack, 1, 'cil-title-ln', (x) => {
        const title = el('div', 'cil-title', x);
        el('em', '', title, 'Khoa');
        title.append(` ${e.canChi ?? ''}`);
        // Bố cục gọn bỏ năm khỏi tiêu đề (năm đã là đầu cột trái).
        const y = el('span', 'cil-title__y', title);
        el('span', 'cil-dot', y, '·');
        y.append(String(e.year ?? ''));
      }),
    );
    linesR.push(makeLine(R.stack, 1, 'cil-rule-ln', (x) => el('i', 'cil-rule', x)));

    const rows = [
      ['Niên hiệu', e.nienHieu],
      ['Triều vua', e.vua],
      ['Lấy đỗ', e.soDo != null ? `${e.soDo} tiến sĩ` : ''],
      ['Đỗ đầu', e.dauKhoa],
      ['Dựng bia', e.dung != null ? `${e.dung}${e.dot ? ` · đợt ${e.dot}` : ''}` : ''],
    ].filter((r) => r[1] != null && String(r[1]).trim() !== '');
    rows.forEach(([k, v], i) => {
      linesR.push(
        makeLine(R.stack, 1, `cil-row-ln${i === 0 ? ' is-first' : ''}`, (x) => {
          const row = el('div', 'cil-row', x);
          el('span', 'cil-k', row, k);
          el('span', 'cil-v', row, String(v));
        }),
      );
    });
    for (const it of linesR) it.settled = false;

    // Lời dẫn: bản mờ sẵn (filter tĩnh) + bản sắc; "lấy nét" = đổi opacity hai bản.
    // r21: bia chưa có dữ liệu lịch sử → lời dẫn là một dòng "Chờ dữ liệu" lặng lẽ
    const text = e.mota ? String(e.mota) : PENDING;
    desc.wrap = el('div', `cil-desc-w${e.mota ? '' : ' is-pending'}`, R.stack);
    desc.blur = el('p', 'cil-desc cil-desc--blur', desc.wrap, text);
    desc.blur.setAttribute('aria-hidden', 'true');
    desc.sharp = el('p', 'cil-desc', desc.wrap, text);
    desc.wrap.hidden = !text;
    desc.tw = tween();
    desc.st.op = NaN;
    desc.st.bop = NaN;
    desc.box = null;
    desc.clamped = false;
    desc.settled = false;

    // Cột trái dùng chung: đổi chữ số năm (cả bản sao phát sáng), trả về trạng thái ẩn.
    const yr = String(e.year ?? '');
    yearL.x.firstElementChild.textContent = yr;
    yearL.glow.firstElementChild.textContent = yr;
    yearL.outer.hidden = !yr;
    for (const it of linesL) resetLineState(it);
    for (const co of cos) {
      co.lead.tw = tween();
      co.lead.st.off = NaN;
      co.lead.st.rq = NaN;
    }
    quadsOk = false;
    chooseMode();
  }

  // ================= Đo — chỉ khi đang ẩn (đổi bia / đổi cỡ / font), không trong update() ====
  function withLaidOut(root, fn) {
    // Chưa từng được CSS3DRenderer gắn vào DOM → gắn tạm vào lớp CSS3D (vẫn trong .cinema để
    // CSS khớp); renderer tự chuyển nó vào phần tử camera ở lần vẽ đầu.
    if (!root.isConnected) {
      if (!ctx.css3d.element) return;
      root.style.display = 'none';
      ctx.css3d.element.appendChild(root);
    }
    const hiddenBefore = root.style.display === 'none';
    if (hiddenBefore) {
      root.style.visibility = 'hidden';
      root.style.display = '';
    }
    try {
      fn();
    } finally {
      if (hiddenBefore) {
        root.style.display = 'none';
        root.style.visibility = '';
      }
    }
  }
  function measure() {
    withLaidOut(R.root, () => {
      for (const it of linesR) {
        if (!it.outer.offsetParent) {
          it.box = null; // dòng bị ẩn ở bậc bố cục này
          continue;
        }
        const x = offX(it.outer, R.stack);
        const y = offY(it.outer, R.stack);
        it.box = { x0: x, y0: y, x1: x + it.outer.offsetWidth, y1: y + it.outer.offsetHeight };
      }
      if (desc.wrap && !desc.wrap.hidden && desc.wrap.offsetParent) {
        const x = offX(desc.wrap, R.stack);
        const y = offY(desc.wrap, R.stack);
        desc.box = { x0: x, y0: y, x1: x + desc.wrap.offsetWidth, y1: y + desc.wrap.offsetHeight };
        const clamped = desc.sharp.scrollHeight > desc.sharp.clientHeight + 1;
        if (clamped !== desc.clamped) {
          desc.clamped = clamped;
          desc.wrap.classList.toggle('is-clamped', clamped);
        }
      } else desc.box = null;
      colSize.wR = R.stack.offsetWidth || COL_R;
      colSize.hR = R.stack.offsetHeight || colSize.hR;
    });
    withLaidOut(L.root, () => {
      const wL = L.stack.offsetWidth || COL_L;
      colSize.wL = wL;
      colSize.hL = L.stack.offsetHeight || colSize.hL;
      for (const it of linesL) {
        const x = offX(it.outer, L.stack) - wL;
        const y = offY(it.outer, L.stack);
        it.box = { x0: x, y0: y, x1: x + it.outer.offsetWidth, y1: y + it.outer.offsetHeight };
      }
      for (const co of cos) co.labelY = offY(co.label, L.stack) + co.label.offsetHeight / 2;
    });
    measured = true;
    remeasure = false;
    geomDirty = true;
    quadsStale = true;
  }

  function setLevel(lv) {
    level = lv;
    gap = lv.compact ? GAP_COMPACT : GAP_FULL;
    for (const r of [R.root, L.root]) {
      r.classList.toggle('is-compact', lv.compact);
      r.style.setProperty('--cil-gap', `${gap}px`);
    }
    R.root.classList.toggle('is-narrow', lv.narrow);
    R.root.classList.toggle('is-nodesc', !lv.desc);
    R.root.classList.toggle('is-title-only', lv.titleOnly);
    // Không có cột trái → ẩn hẳn cột trái + đường dẫn (CSS3DRenderer ẩn phần tử của object ẩn).
    L.obj.visible = lv.left;
    D.obj.visible = lv.left;
  }

  /**
   * Hệ số lớn nhất để hai hộp cột (chữ + quầng) nằm trong vùng an toàn — CÙNG MỘT hệ số cho hai
   * bên. Ngang: khung mặc định đặt trục bia giữa khung hình nên mép phiến ở ±slab/wpp px quanh
   * tâm; chia PERSP để bù phối cảnh. Dọc: đỉnh cột ở vai vòm (dưới đỉnh bia), cột không xuống quá
   * chân bia — khung mặc định của sân khấu đã đặt trọn tấm bia giữa hàng trên và cụm HUD dưới.
   */
  function fitK(M, wpp, W) {
    if (!M || !(wpp > 0) || !(W > 0)) return Infinity;
    const ppu = 1 / wpp;
    const halfW = W / 2;
    const roomR = (halfW - Math.max(safe.right + SAFE_PAD, EDGE_MIN)) / PERSP - M.slabRight * ppu;
    let k = Math.min(roomR / (gap + colSize.wR + PAD), (M.bandTop * ppu) / (colSize.hR + PAD));
    if (level.left) {
      const roomL = (halfW - Math.max(safe.left + SAFE_PAD, EDGE_MIN)) / PERSP + M.slabLeft * ppu;
      k = Math.min(k, roomL / (gap + colSize.wL + PAD), (M.bandTop * ppu) / (colSize.hL + PAD));
    }
    return k;
  }

  /**
   * Chọn bố cục đủ / gọn cho khung hình + vùng an toàn hiện tại (có đọc DOM — chỉ gọi khi ẩn,
   * lúc show(), hoặc ngay sau khi đổi cỡ). Bố cục đủ nếu vừa chỗ ở cỡ chữ đọc được; không thì gọn.
   */
  function chooseMode() {
    readSafe();
    // Đang vẽ trên một tấm bia (có thể là tấm đang rời đi) → đo theo đúng tấm đó; đang ẩn → bia hiện tại.
    const pl = active ? plane : null;
    const M = ctx.metrics(pl);
    const wpp = ctx.worldPerPx(pl);
    ctx.renderer.getSize(_size);
    modeWpp = wpp;
    modeDirty = !M; // chưa có bia → chọn lại lúc show()
    for (const lv of LEVELS) {
      setLevel(lv);
      measure();
      if (fitK(M, wpp, _size.x) >= MIN_TEXT / lv.min - 1e-3) return;
    }
    // Ngay cả một dòng tiêu đề cũng không vừa ở 11px → không hiện gì (HUD dưới của view vẫn có tên bia).
    setLevel(NONE_LEVEL);
  }

  // ================= Hình học mỗi khung =================
  function geom() {
    // Số đo + tỉ lệ px ↔ đơn vị của CHÍNH tấm bia đang mang chữ (chuyển cảnh: tấm cũ giữ số đo của nó).
    if (plane) Mcap = ctx.metrics(plane) ?? Mcap;
    const M = Mcap ?? ctx.metrics();
    if (!M) return null;
    const wpp = ctx.worldPerPx(plane);
    ctx.renderer.getSize(_size);
    const ppu = 1 / wpp;
    // Hệ số theo khung hình, nhưng không nhỏ hơn mức chữ đọc được của bậc hiện tại; rồi co cho
    // vừa vùng an toàn (bậc đã được chọn sao cho vừa ở mức đọc được — chỉ lệch khi khung đổi < 1%).
    const kRead = MIN_TEXT / level.min;
    let k = clamp(ppu / REF_PPU, kRead, K_MAX);
    k = Math.min(k, fitK(M, wpp, _size.x));
    const s = wpp * k;
    G.M = M;
    G.k = k;
    G.s = s;
    G.xR = M.slabRight + gap * s;
    G.xL = M.slabLeft - gap * s;
    G.yT = M.bandTop;
    G.travelPx = TRAVEL / s;
    return G;
  }

  /** Đặt kích thước tường minh cho các hộp CSS3D (chỉ ghi khi đổi) và vị trí tâm của chúng. */
  function placeBoxes(g) {
    const s = g.s;
    const wR = r1(gap + colSize.wR + PAD);
    const hR = r1(colSize.hR + 2 * PAD);
    const wL = r1(PAD + colSize.wL + gap);
    const hL = r1(colSize.hL + 2 * PAD);
    if (wR !== R.w || hR !== R.h) {
      R.w = wR;
      R.h = hR;
      R.root.style.width = `${wR}px`;
      R.root.style.height = `${hR}px`;
    }
    if (wL !== L.w || hL !== L.h) {
      L.w = wL;
      L.h = hL;
      L.root.style.width = `${wL}px`;
      L.root.style.height = `${hL}px`;
    }
    const yTop = g.yT + PAD * s; // mép trên hộp (plane-local)
    R.obj.position.set(g.M.slabRight + (wR / 2) * s, yTop - (hR / 2) * s, Z_R);
    L.obj.position.set(g.M.slabLeft - (wL / 2) * s, yTop - (hL / 2) * s, Z_L);
    R.obj.scale.setScalar(s);
    L.obj.scale.setScalar(s);
    // Hộp đường dẫn, toạ độ px của cột trái: x từ mép cột (0) tới quá mép phải phiến bia;
    // y từ trên vai vòm tới dưới chân bia.
    const wD = r1((g.M.slabRight - g.xL) / s + LEAD_BOX_PAD);
    const y0 = -LEAD_BOX_PAD;
    const hD = r1(g.yT / s + LEAD_BOX_PAD - y0);
    if (wD !== D.w || hD !== D.h) {
      D.w = wD;
      D.h = hD;
      D.root.style.width = `${wD}px`;
      D.root.style.height = `${hD}px`;
      leads.setAttribute('width', String(wD));
      leads.setAttribute('height', String(hD));
      leads.setAttribute('viewBox', `0 ${y0} ${wD} ${hD}`);
    }
    D.obj.position.set(g.xL + (wD / 2) * s, g.yT - (y0 + hD / 2) * s, Z_D);
    D.obj.scale.setScalar(s);
  }

  /** Mặt phẳng / camera / tỉ lệ có đổi so với lần trước không (so theo epsilon). */
  function checkView(g) {
    const a = plane.matrixWorld.elements;
    const b = _lastPlaneM.elements;
    const c = ctx.camera.matrixWorld.elements;
    const d = _lastCamM.elements;
    let changed = g.s !== lastS;
    for (let i = 0; i < 16 && !changed; i++) {
      if (Math.abs(a[i] - b[i]) > 1e-7 || Math.abs(c[i] - d[i]) > 1e-7) changed = true;
    }
    if (changed) {
      _lastPlaneM.copy(plane.matrixWorld);
      _lastCamM.copy(ctx.camera.matrixWorld);
      lastS = g.s;
    }
    return changed;
  }

  // ================= Điểm neo trên mặt đá (cache theo bia, tính lúc rảnh) =================
  function anchorX(co, M) {
    return (M.slabLeft + M.slabRight) / 2 + co.a.anchor.u * ((M.slabRight - M.slabLeft) / 2);
  }
  function anchorY(co, M) {
    return co.a.anchor.v * M.height;
  }
  function modelOf(pl) {
    const slot = pl?.parent;
    if (!slot) return null;
    for (const c of slot.children) if (c !== pl) return c;
    return null;
  }
  /** Điểm trên đá (plane-local) của điểm neo i cho bia đang gắn với `plane`, hoặc null. */
  const surfOf = (i) => surfCache.get(planeKey)?.[i] ?? null;

  /**
   * Điểm trên đá mà người xem thấy "sau" điểm neo: tia từ một điểm nhìn CHÍNH DIỆN (cùng độ cao
   * và khoảng cách với camera hiện tại, bỏ góc lệch ngang) qua điểm neo trên mặt phẳng. Với
   * phiến bia thì gần như trùng mặt phẳng; với rùa (chìa ra trước) là điểm trên đầu/lưng rùa —
   * nhờ vậy lúc bia đung đưa, chấm neo vẫn bám đúng chỗ trên đá (xem leadEnd()).
   *
   * Bốn tia được thử CÙNG LÚC trên từng tam giác, công việc chia lát ≤ vài ms trong
   * requestIdleCallback (Raycaster của three: ≈12 ms/tia trên ~70k tam giác). Mọi phép tính ở
   * toạ độ plane-local nên bia đung đưa giữa các lát cũng không sao (mô hình và mặt phẳng cùng khay).
   */
  function makeRayJob(pl, model, M) {
    pl.updateWorldMatrix(true, false);
    model.updateWorldMatrix(true, true);
    const planeInv = new THREE.Matrix4().copy(pl.matrixWorld).invert();
    const cam = new THREE.Vector3().setFromMatrixPosition(ctx.camera.matrixWorld).applyMatrix4(planeInv);
    const eye = new THREE.Vector3(0, cam.y, Math.max(0.5, Math.hypot(cam.x, cam.z)));
    const rays = cos.map((co) => {
      const a = new THREE.Vector3(anchorX(co, M), anchorY(co, M), Z_L);
      return { a, o: eye.clone(), d: a.clone().sub(eye).normalize(), t: Infinity, lo: null };
    });
    const meshes = [];
    model.traverse((o) => {
      if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o);
    });
    return { key: modelKey(model), pl, model, M, planeInv, rays, meshes, mi: 0, tri: 0, cur: null, handle: 0 };
  }
  /** Giải nén đỉnh của một mesh (kể cả interleaved / lượng tử hoá) + tia về toạ độ của mesh. */
  function prepMesh(job, mesh) {
    const geo = mesh.geometry;
    const attr = geo.attributes.position;
    const n = attr.count;
    const V = new Float32Array(n * 3);
    const inter = !!attr.isInterleavedBufferAttribute;
    const src = inter ? attr.data.array : attr.array;
    const stride = inter ? attr.data.stride : attr.itemSize;
    const off = inter ? attr.offset : 0;
    let div = 1;
    let signed = false;
    if (attr.normalized) {
      if (src instanceof Int16Array) (div = 32767), (signed = true);
      else if (src instanceof Uint16Array) div = 65535;
      else if (src instanceof Int8Array) (div = 127), (signed = true);
      else if (src instanceof Uint8Array) div = 255;
    }
    for (let i = 0, j = off; i < n; i++, j += stride) {
      for (let c = 0; c < 3; c++) {
        let v = src[j + c] / div;
        if (signed && v < -1) v = -1;
        V[i * 3 + c] = v;
      }
    }
    // mesh-local = (plane⁻¹ · meshWorld)⁻¹ · plane-local. Hướng lấy từ hiệu hai điểm (không chuẩn
    // hoá) để tham số t giữ nguyên nghĩa "khoảng cách plane-local" trên mọi mesh.
    const relInv = new THREE.Matrix4().multiplyMatrices(job.planeInv, mesh.matrixWorld).invert();
    const _o = new THREE.Vector3();
    const _e = new THREE.Vector3();
    for (const r of job.rays) {
      _o.copy(r.o).applyMatrix4(relInv);
      _e.copy(r.o).add(r.d).applyMatrix4(relInv).sub(_o);
      r.lo = [_o.x, _o.y, _o.z, _e.x, _e.y, _e.z];
    }
    const I = geo.index ? geo.index.array : null;
    return { V, I, n: I ? Math.floor(geo.index.count / 3) : Math.floor(n / 3) };
  }
  /** Chạy tiếp công việc tối đa budgetMs. true = xong. */
  function stepRayJob(job, budgetMs) {
    const t0 = performance.now();
    const rays = job.rays;
    const nr = rays.length;
    while (job.mi < job.meshes.length) {
      if (!job.cur) {
        job.cur = prepMesh(job, job.meshes[job.mi]);
        return false; // giải nén đỉnh là một lát riêng — lát đầu luôn ngắn
      }
      const { V, I, n } = job.cur;
      let tri = job.tri;
      while (tri < n) {
        const end = Math.min(n, tri + 128);
        for (; tri < end; tri++) {
          const i0 = (I ? I[tri * 3] : tri * 3) * 3;
          const i1 = (I ? I[tri * 3 + 1] : tri * 3 + 1) * 3;
          const i2 = (I ? I[tri * 3 + 2] : tri * 3 + 2) * 3;
          const ax = V[i0];
          const ay = V[i0 + 1];
          const az = V[i0 + 2];
          const e1x = V[i1] - ax;
          const e1y = V[i1 + 1] - ay;
          const e1z = V[i1 + 2] - az;
          const e2x = V[i2] - ax;
          const e2y = V[i2 + 1] - ay;
          const e2z = V[i2 + 2] - az;
          for (let k = 0; k < nr; k++) {
            const r = rays[k];
            const L_ = r.lo;
            const dx = L_[3];
            const dy = L_[4];
            const dz = L_[5];
            // Möller–Trumbore, hai mặt (vật liệu bia là DoubleSide).
            const px = dy * e2z - dz * e2y;
            const py = dz * e2x - dx * e2z;
            const pz = dx * e2y - dy * e2x;
            const det = e1x * px + e1y * py + e1z * pz;
            if (det > -1e-12 && det < 1e-12) continue;
            const inv = 1 / det;
            const sx = L_[0] - ax;
            const sy = L_[1] - ay;
            const sz = L_[2] - az;
            const u = (sx * px + sy * py + sz * pz) * inv;
            if (u < 0 || u > 1) continue;
            const qx = sy * e1z - sz * e1y;
            const qy = sz * e1x - sx * e1z;
            const qz = sx * e1y - sy * e1x;
            const v = (dx * qx + dy * qy + dz * qz) * inv;
            if (v < 0 || u + v > 1) continue;
            const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
            if (t > 1e-6 && t < r.t) r.t = t;
          }
        }
        if (performance.now() - t0 > budgetMs) {
          job.tri = tri;
          return false;
        }
      }
      job.mi++;
      job.tri = 0;
      job.cur = null;
    }
    return true;
  }
  function finishRayJob(job) {
    const out = job.rays.map((r, i) => {
      const fallback = new THREE.Vector3(anchorX(cos[i], job.M), anchorY(cos[i], job.M), 0);
      if (!Number.isFinite(r.t)) return fallback;
      const p = r.o.clone().addScaledVector(r.d, r.t);
      // Chặn kết quả lạ (tia lọt khe…): chỉ nhận điểm trước mặt đá trong tầm hợp lý.
      return p.z > -0.08 && p.z < (job.M.sweepRadius ?? 0.6) + 0.1 ? p : fallback;
    });
    surfCache.set(job.key, out);
  }
  /** Lên lịch tính điểm neo (requestIdleCallback) cho bia đang hiển thị nếu chưa có trong cache. */
  function ensureRays() {
    const pl = ctx.plane();
    const model = modelOf(pl);
    if (!model) return;
    const key = modelKey(model);
    if (surfCache.has(key)) return;
    if (rayJob && rayJob.key === key && rayJob.model === model) return;
    const M = ctx.metrics();
    if (!M) return;
    if (rayJob) cancelRic(rayJob.handle);
    rayJob = makeRayJob(pl, model, M);
    rayJob.handle = ric(runRays);
  }
  function runRays(deadline) {
    const job = rayJob;
    if (!job || disposed) return;
    if (ctx.plane() !== job.pl || modelOf(job.pl) !== job.model) {
      rayJob = null; // đã đổi bia — lần kiểm tra kế tiếp sẽ lên lịch cho bia mới
      return;
    }
    // Chỉ dùng thời gian rảnh thật; hết hạn chờ thì làm một lát nhỏ (nhỏ hơn nữa khi đang hiện).
    const budget = deadline.didTimeout ? (active ? 1.5 : 3) : Math.min(4, deadline.timeRemaining() - 1);
    if (budget >= 0.75) {
      const t0 = performance.now();
      const done = stepRayJob(job, budget);
      raySlices?.push(+(performance.now() - t0).toFixed(2));
      if (done) {
        finishRayJob(job);
        rayJob = null;
        return;
      }
    }
    job.handle = ric(runRays);
  }

  /** Điểm neo chiếu lên mặt phẳng CSS dọc tia nhìn hiện tại → px của cột trái. */
  function leadEnd(co, i, g) {
    const S = surfOf(i);
    const Sx = S ? S.x : anchorX(co, g.M);
    const Sy = S ? S.y : anchorY(co, g.M);
    const Sz = S ? S.z : 0;
    let x = Sx;
    let y = Sy;
    const den = Sz - _cam.z;
    if (Math.abs(den) > 1e-6) {
      const t = (Z_L - _cam.z) / den;
      x = _cam.x + (Sx - _cam.x) * t;
      y = _cam.y + (Sy - _cam.y) * t;
    }
    co.end.x = (x - g.xL) / g.s;
    co.end.y = (g.yT - y) / g.s;
  }

  // ================= Vẽ (chỉ transform / opacity) =================
  function drawLine(it, g, ms) {
    const tw = it.tw;
    const p = tw.pos;
    const d = RM ? 0 : (1 - p) * g.travelPx; // px còn phải trượt (về phía đá)
    const x = q4(-it.side * d);
    // Vào: hiện dần trong nửa đầu quãng trượt. Ra: giữ nguyên độ sáng để thấy chữ bị đá "nuốt"
    // dần ở mép, chỉ tắt ở chặng cuối.
    const op = r2(RM ? p : smooth(clamp01(p / (tw.to === 1 ? 0.5 : 0.3))));
    const st = it.st;
    if (x !== st.x) {
      it.outer.style.transform = x ? `translate(${x}px,0)` : '';
      st.x = x;
    }
    if (op !== st.op) {
      it.outer.style.opacity = op >= 1 ? '' : String(op);
      st.op = op;
    }
    // Vệt sáng: bản sao phát sáng bùng lên rồi lắng về GLOW_REST; lúc trượt nó trễ lại phía sau
    // (ngược hướng trượt) như một vệt đuôi.
    let gop = GLOW_REST;
    let gx = 0;
    if (!RM) {
      const showing = tw.to === 1;
      if (showing) it.age += ms;
      const bloom = showing ? (it.age < 0 ? 1 : (1 - clamp01(it.age / BLOOM_MS)) ** 2) : 0.45 * (1 - p);
      gop = r2(GLOW_REST + (1 - GLOW_REST) * bloom);
      const dx = Number.isFinite(it.prevX) ? x - it.prevX : 0;
      const mag = Math.min(14, (Math.abs(dx) / Math.max(1, ms)) * 28);
      gx = Math.round(-Math.sign(dx) * mag * 2) / 2;
      it.settled = tw.done && (!showing || it.age >= BLOOM_MS) && gx === 0;
    } else it.settled = tw.done;
    it.prevX = x;
    if (gop !== st.gop) {
      it.glow.style.opacity = String(gop);
      st.gop = gop;
    }
    if (gx !== st.gx) {
      it.glow.style.transform = gx ? `translate(${gx}px,0)` : '';
      st.gx = gx;
    }
  }

  function drawDesc() {
    if (!desc.wrap) return;
    const q = desc.tw.pos;
    // "Lấy nét": bản mờ hiện trước rồi nhường chỗ cho bản sắc.
    const op = r2(RM ? q : smooth(q));
    const bop = RM ? 0 : r2(clamp01(q * 4) * (1 - q));
    if (op !== desc.st.op) {
      desc.sharp.style.opacity = String(op);
      desc.st.op = op;
    }
    if (bop !== desc.st.bop) {
      desc.blur.style.opacity = String(bop);
      desc.st.bop = bop;
    }
    desc.settled = desc.tw.done;
  }

  function drawLead(co, geomChanged) {
    const L_ = co.lead;
    const q = L_.tw.pos;
    const st = L_.st;
    if (q > 0 && (geomChanged || st.d === '')) {
      // Ngang từ nhãn tới khuỷu (ngay trước mép đá) rồi chéo tới điểm neo, dừng ở mép vòng.
      const y0 = r1(co.labelY);
      const ex = co.end.x;
      const ey = co.end.y;
      const moved =
        st.d === '' || Math.abs(ex - st.ex) > LEAD_EPS || Math.abs(ey - st.ey) > LEAD_EPS || y0 !== st.y0;
      if (moved) {
        const knee = Math.max(LEAD_X0 + 6, Math.min(gap - 12, ex - 10));
        const dx = ex - knee;
        const dy = ey - y0;
        const seg = Math.hypot(dx, dy) || 1;
        const cut = Math.min(RING_R, seg * 0.5);
        const tx = r1(ex - (dx / seg) * cut);
        const ty = r1(ey - (dy / seg) * cut);
        const d = `M${LEAD_X0} ${y0}H${r1(knee)}L${tx} ${ty}`;
        st.d = d;
        st.y0 = y0;
        st.ex = ex;
        st.ey = ey;
        st.len = knee - LEAD_X0 + Math.hypot(tx - knee, ty - y0);
        const dash = `${r1(st.len + 1)} ${r1(st.len + 2)}`;
        for (const p of [L_.path, L_.caseP]) {
          p.setAttribute('d', d);
          p.style.strokeDasharray = dash;
        }
        const cx = String(r1(ex));
        const cy = String(r1(ey));
        for (const c of [L_.ring, L_.ringC, L_.pip, L_.pulse]) {
          c.setAttribute('cx', cx);
          c.setAttribute('cy', cy);
        }
        st.off = NaN;
      }
    }
    const off = r1((st.len + 1) * (1 - q));
    if (off !== st.off) {
      L_.path.style.strokeDashoffset = String(off);
      L_.caseP.style.strokeDashoffset = String(off);
      st.off = off;
    }
    // Vòng + chấm nở ra khi nét vừa chạm điểm neo; rê vào thì vòng nới rộng (và toả nhịp — CSS).
    const rq = r2(RM ? q : clamp01((q - 0.82) / 0.18));
    const hk = r2(co.hk);
    if (rq !== st.rq || hk !== st.hk) {
      st.rq = rq;
      st.hk = hk;
      const hs = smooth(hk);
      const ringS = `scale(${r3((0.4 + 0.6 * easeOut3(rq)) * (1 + 0.32 * hs))})`;
      for (const c of [L_.ring, L_.ringC]) {
        c.style.opacity = String(rq);
        c.style.transform = ringS;
      }
      L_.pip.style.opacity = String(rq);
      L_.pip.style.transform = `scale(${r3(1 + 0.25 * hs)})`;
      L_.pulse.style.opacity = String(rq); // CSS chỉ cho nhịp chạy khi .is-hot
    }
  }

  // ---- Hộp → tứ giác màn hình (hitTest + rê chú giải)
  // Đệm dọc ≥ nửa khe giữa hai mục (24px ở cột trái) → rê dọc cột không rơi vào "khe chết".
  function quadOf(box, ox, oy, z, s, out, padX = 12, padY = 13) {
    const q = out ?? [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    const xs = [box.x0 - padX, box.x1 + padX, box.x1 + padX, box.x0 - padX];
    const ys = [box.y0 - padY, box.y0 - padY, box.y1 + padY, box.y1 + padY];
    for (let i = 0; i < 4; i++) {
      // CSS y hướng xuống ↔ plane-local y hướng lên.
      _q.set(ox + xs[i] * s, oy - ys[i] * s, z).applyMatrix4(plane.matrixWorld);
      ctx.worldToScreen(_q, q[i]);
    }
    return q;
  }
  function inQuad(q, x, y) {
    if (!q) return false;
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = q[i];
      const b = q[(i + 1) % 4];
      const c = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x));
      if (c === 0) continue;
      if (sign === 0) sign = c;
      else if (c !== sign) return false;
    }
    return sign !== 0; // tứ giác suy biến (chưa tính) → không trúng
  }

  function computeQuads(g) {
    for (const it of linesR) it.quad = it.box ? quadOf(it.box, g.xR, g.yT, Z_R, g.s, it.quad) : null;
    desc.quad = desc.box ? quadOf(desc.box, g.xR, g.yT, Z_R, g.s, desc.quad) : null;
    for (const it of linesL) it.quad = it.box ? quadOf(it.box, g.xL, g.yT, Z_L, g.s, it.quad) : null;
    for (const co of cos) {
      _q.set(g.xL + co.end.x * g.s, g.yT - co.end.y * g.s, Z_L).applyMatrix4(plane.matrixWorld);
      ctx.worldToScreen(_q, co.endScreen);
    }
    quadsOk = true;
  }

  // ---- Rê vào chú giải: chữ sáng lên, vòng neo nới rộng + toả nhịp
  function updateHot(ms, af) {
    const p = ctx.pointer();
    let hot = -1;
    if (visible && level.left && quadsOk && p.active && af > 0.2) {
      for (let i = 0; i < cos.length; i++) {
        const co = cos[i];
        if (co.tw.pos < 0.9) continue;
        if (inQuad(co.quad, p.x, p.y)) hot = i;
        else if (co.lead.tw.pos > 0.9 && !co.endScreen.behind) {
          const dx = p.x - co.endScreen.x;
          const dy = p.y - co.endScreen.y;
          if (dx * dx + dy * dy < 16 * 16) hot = i;
        }
      }
    }
    if (hot !== hotIdx) {
      hotIdx = hot;
      L.root.classList.toggle('has-hot', hot >= 0);
      D.root.classList.toggle('has-hot', hot >= 0);
      cos.forEach((co, i) => {
        const on = i === hot;
        if (on === co.hot) return;
        co.hot = on;
        co.outer.classList.toggle('is-hot', on);
        co.lead.g.classList.toggle('is-hot', on);
      });
    }
    const step = RM ? 1 : ms / HOT_MS;
    for (const co of cos) {
      const want = co.hot ? 1 : 0;
      if (co.hk !== want) co.hk = want > co.hk ? Math.min(1, co.hk + step) : Math.max(0, co.hk - step);
    }
  }

  // ---- Tách lớp / mặt nạ: bật khi bắt đầu hoạt ảnh, gỡ hẳn khi xong
  function setAnim(on) {
    if (on === animOn) return;
    animOn = on;
    R.root.classList.toggle('is-anim', on);
    L.root.classList.toggle('is-anim', on);
  }
  function setMask(side, on) {
    if (side === 'r') {
      if (on === maskR) return;
      maskR = on;
      R.clip.classList.toggle('is-masked', on);
    } else {
      if (on === maskL) return;
      maskL = on;
      L.clip.classList.toggle('is-masked', on);
    }
  }

  function deactivate() {
    active = false;
    rig.visible = false;
    for (const co of cos) co.hk = 0;
    plane = null;
    quadsOk = false;
    setAnim(false);
    setMask('r', false);
    setMask('l', false);
    R.root.setAttribute('aria-hidden', 'true');
    L.root.setAttribute('aria-hidden', 'true');
    if (pending) {
      const p = pending;
      pending = null;
      fill(p);
    } else if (remeasure || modeDirty) chooseMode();
    if (queued) {
      const q = queued;
      queued = null;
      api.show(q.entry); // chữ đã rút hết trên bia cũ → hiện trên bia hiện tại
    }
  }

  const colMoving = (lines) => lines.some((it) => !it.tw.done);
  function allAtRest() {
    if (!desc.tw.done || desc.tw.pos !== 0) return false;
    for (const it of linesR) if (!it.tw.done || it.tw.pos !== 0) return false;
    for (const it of linesL) if (!it.tw.done || it.tw.pos !== 0) return false;
    for (const co of cos) if (!co.lead.tw.done || co.lead.tw.pos !== 0 || co.hk > 0) return false;
    return true;
  }

  // ================= Vào / ra =================
  function goIn(it, delay) {
    const fresh = it.tw.pos < 0.02;
    if (RM) tweenTo(it.tw, 1, RM_IN_MS, 0, linear);
    else tweenTo(it.tw, 1, fresh ? IN_MS : Math.max(260, IN_MS * (1 - it.tw.pos)), fresh ? delay : 0, easeOut3);
    if (fresh) it.age = RM ? 0 : -delay;
    it.settled = false;
  }
  function goOut(it) {
    if (RM) tweenTo(it.tw, 0, RM_OUT_MS, 0, linear);
    else tweenTo(it.tw, 0, Math.max(120, OUT_MS * it.tw.pos), 0, easeIn3);
    it.settled = false;
  }

  const api = {
    /** Nửa bề ngang chiếm chỗ (đơn vị mặt phẳng bia, từ trục bia) của hai cột chữ — stage kẹp zoom khi hover. */
    extent() {
      const g = geom();
      if (!g) return null;
      const s = g.s;
      return Math.max(g.M.slabRight + (gap + colSize.wR + PAD) * s, -g.M.slabLeft + (PAD + colSize.wL + gap) * s);
    },
    show(entry) {
      if (entry && entry !== content) fill(entry);
      else if (pending) fill(pending);
      pending = null;
      if (!content) return;
      const pl = ctx.plane();
      if (!pl) return;
      // Chữ còn đang rút trên một tấm bia KHÁC (vừa chuyển cảnh) → rút nốt trên tấm cũ rồi mới hiện ở đây.
      if (active && plane && pl !== plane && !visible) {
        queued = { entry };
        return;
      }
      queued = null;
      if (pl !== plane) {
        plane = pl;
        Mcap = ctx.metrics();
      }
      planeKey = modelKey(modelOf(plane));
      ensureRays();
      // Bình thường đã đo + chọn bố cục sẵn lúc đổi bia (đang ẩn); chỉ làm lại nếu cỡ đã đổi.
      if (!measured || modeDirty || remeasure) chooseMode();
      else readSafe();
      if (level.none) return; // không đủ chỗ cho cả một dòng chữ đọc được
      visible = true;
      active = true;
      geomDirty = true;
      R.root.setAttribute('aria-hidden', 'false');
      L.root.setAttribute('aria-hidden', 'false');
      setAnim(true);
      if (!RM) {
        setMask('r', true);
        setMask('l', true);
      }

      linesR.forEach((it, i) => goIn(it, i * STAGGER));
      linesL.forEach((it, i) => goIn(it, L_DELAY + i * STAGGER));
      const last = linesR[linesR.length - 1];
      desc.settled = false;
      if (RM) tweenTo(desc.tw, 1, RM_IN_MS, 0, linear);
      else tweenTo(desc.tw, 1, DESC_MS * (1 - desc.tw.pos) || 1, Math.max(0, remaining(last.tw) - 120), easeOut2);
      for (const co of cos) {
        if (RM) tweenTo(co.lead.tw, 1, RM_IN_MS, 0, linear);
        else tweenTo(co.lead.tw, 1, LEAD_MS * (1 - co.lead.tw.pos) || 1, Math.max(0, remaining(co.tw) - 80), easeInOut3);
      }
    },

    hide() {
      queued = null;
      if (!visible) return;
      visible = false;
      setAnim(true);
      if (!RM) {
        setMask('r', true);
        setMask('l', true);
      }
      for (const it of linesR) goOut(it);
      for (const it of linesL) goOut(it);
      desc.settled = false;
      if (RM) tweenTo(desc.tw, 0, RM_OUT_MS, 0, linear);
      else tweenTo(desc.tw, 0, Math.max(100, DESC_OUT_MS * desc.tw.pos), 0, easeIn2);
      for (const co of cos) {
        if (RM) tweenTo(co.lead.tw, 0, RM_OUT_MS, 0, linear);
        else tweenTo(co.lead.tw, 0, Math.max(80, LEAD_OUT_MS * co.lead.tw.pos), 0, easeIn3);
      }
    },

    setEntry(entry) {
      if (!visible && !active) fill(entry);
      else pending = entry;
    },

    isVisible: () => visible || !!queued,

    update(dt) {
      // Đang chờ hiện trên bia mới mà tấm bia cũ đã rời cảnh hẳn: chữ đang rút theo nó đã vô hình → xong luôn.
      if (queued && active && plane && ctx.opacity && ctx.opacity(plane) <= 0) {
        const zero = (tw) => {
          tw.pos = tw.from = tw.to = 0;
          tw.t = tw.dur;
          tw.done = true;
        };
        for (const it of linesR) zero(it.tw);
        for (const it of linesL) zero(it.tw);
        zero(desc.tw);
        for (const co of cos) {
          zero(co.lead.tw);
          co.hk = 0;
        }
        deactivate(); // chạy luôn lượt hiện đang chờ
      }
      // Khung hình đổi (worldPerPx lệch > 1%) cũng coi như đổi cỡ. Đang vẽ trên tấm bia cũ (chuyển cảnh) thì
      // so với tỉ lệ của chính tấm đó — tỉ lệ của bia mới KHÔNG phải là đổi cỡ.
      const wpp = ctx.worldPerPx(active ? plane : null);
      if (Number.isFinite(modeWpp) && Math.abs(wpp - modeWpp) > modeWpp * 0.01) modeDirty = true;
      if (!active) {
        if (modeDirty && content && ctx.plane()) chooseMode(); // chỉ sau khi đổi cỡ — đang ẩn
        ensureRays(); // rẻ: vài phép so sánh; chỉ lên lịch khi vừa đổi bia
        return;
      }
      if (!plane) plane = ctx.plane();
      if (!plane) return;
      if (modeDirty) {
        chooseMode(); // đổi cỡ ngay lúc đang hiện: hiếm, chấp nhận một lần đo
        if (visible && level.none) api.hide();
      }
      const ms = Math.min(Math.max(dt, 0), 0.1) * 1000;

      for (const it of linesR) stepTween(it.tw, ms);
      for (const it of linesL) stepTween(it.tw, ms);
      stepTween(desc.tw, ms);
      for (const co of cos) stepTween(co.lead.tw, ms);

      const g = geom();
      if (!g) return;

      // Bám mặt phẳng: trong update() ma trận thế giới của mọi mặt phẳng đã mới cho khung này.
      rig.matrix.copy(plane.matrixWorld);
      rig.matrixWorldNeedsUpdate = true;
      rig.visible = true;
      placeBoxes(g);

      // Dòng chữ: chỉ đụng DOM khi dòng còn đang trượt / còn vệt sáng.
      for (const it of linesR) if (!it.settled) drawLine(it, g, ms);
      for (const it of linesL) if (!it.settled) drawLine(it, g, ms);
      if (!desc.settled) drawDesc();
      // Mặt nạ tĩnh chỉ tồn tại khi còn dòng đang trượt ở cột đó; vào chỗ hết → gỡ hẳn.
      if (maskR && !colMoving(linesR)) setMask('r', false);
      if (maskL && !colMoving(linesL)) setMask('l', false);

      // Hình học phụ thuộc khung nhìn: chỉ tính lại khi mặt phẳng / camera / cache điểm neo đổi.
      const key = modelKey(modelOf(plane));
      if (key !== planeKey) {
        planeKey = key;
        geomDirty = true;
      }
      const rc = surfCache.has(planeKey) ? 1 : 0;
      if (rc !== rayCount) {
        rayCount = rc;
        geomDirty = true;
      }
      const changed = checkView(g) || geomDirty;
      geomDirty = false;
      if (changed) {
        _inv.copy(plane.matrixWorld).invert();
        _cam.setFromMatrixPosition(ctx.camera.matrixWorld).applyMatrix4(_inv);
        for (let i = 0; i < cos.length; i++) leadEnd(cos[i], i, g);
        quadsStale = true;
      }
      if (measured) for (const co of cos) drawLead(co, changed);

      const p = ctx.pointer();
      if (visible && p.active && measured) {
        if (quadsStale || !quadsOk) {
          computeQuads(g);
          quadsStale = false;
        }
      } else quadsOk = false;
      // Độ hiện theo góc + độ mờ của CHÍNH khay mang chữ (chuyển cảnh 'fade' làm mờ cả khay cũ).
      const af = ctx.angleFade(plane) * (ctx.opacity ? ctx.opacity(plane) : 1);
      updateHot(ms, af);

      // Kiểu gắn mặt phẳng tự nhân độ mờ theo góc nhìn.
      const afq = Math.round(af * 50) / 50;
      if (afq !== afSent) {
        afSent = afq;
        for (const r of [R.root, L.root, D.root]) r.style.opacity = String(afq);
      }

      // Hết hoạt ảnh (vào chỗ + hết vệt sáng) → gộp lớp lại cho chữ sắc.
      if (animOn && visible && !maskR && !maskL) {
        const calm =
          linesR.every((it) => it.settled) &&
          linesL.every((it) => it.settled) &&
          desc.settled &&
          cos.every((co) => co.lead.tw.done);
        if (calm) setAnim(false);
      }

      if (!visible && allAtRest()) deactivate();
    },

    hitTest(x, y) {
      if (!visible || !plane || !quadsOk || ctx.angleFade(plane) < 0.05) return false;
      for (const it of linesR) if (it.quad && it.tw.pos > 0.3 && inQuad(it.quad, x, y)) return true;
      if (desc.quad && desc.tw.pos > 0.3 && inQuad(desc.quad, x, y)) return true;
      if (level.left) {
        for (const it of linesL) if (it.quad && it.tw.pos > 0.3 && inQuad(it.quad, x, y)) return true;
      }
      return false;
    },

    dispose() {
      disposed = true;
      if (rayJob) cancelRic(rayJob.handle);
      rayJob = null;
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      window.removeEventListener('resize', onResize);
      bodyObs?.disconnect();
      // 'removed' chỉ bắn cho đúng đối tượng bị gỡ → gỡ từng CSS3DObject trước rồi mới gỡ rig.
      rig.remove(R.obj);
      rig.remove(D.obj);
      rig.remove(L.obj);
      ctx.css3d.scene.remove(rig);
      R.root.remove();
      L.root.remove();
      D.root.remove();
    },
  };

  // DEV: đo thời gian update() theo trạng thái (ẩn / đang hoạt ảnh / đã hiện yên) + trạng thái.
  if (import.meta.env.DEV) {
    const buckets = {};
    const upd = api.update;
    api.update = (dt) => {
      const t0 = performance.now();
      upd(dt);
      const ms = performance.now() - t0;
      const key = !active ? 'hidden' : animOn ? 'anim' : 'shown';
      const b = (buckets[key] ??= []);
      b.push(ms);
      if (b.length > 4000) b.shift();
    };
    const vm = (window.__vm ??= {});
    const hook = (vm.cinemaLightPerf = {
      reset: () => {
        for (const k in buckets) buckets[k].length = 0;
      },
      stats: () =>
        Object.fromEntries(
          Object.entries(buckets).map(([k, a]) => {
            const s = [...a].sort((x, y) => x - y);
            const q = (f) => +(s[Math.min(s.length - 1, Math.floor(f * s.length))] ?? 0).toFixed(3);
            return [k, { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(3), p50: q(0.5), p95: q(0.95), max: q(1) }];
          }),
        ),
      state: () => ({
        k: r3(G.k),
        level: level.id,
        gap,
        safe,
        colSize: { ...colSize },
        animOn,
        maskR,
        maskL,
        planeKey,
        rays: surfCache.get(planeKey)?.map((v) => v.toArray().map(r3)),
      }),
      recomputeRays: () => {
        surfCache.delete(planeKey);
        raySlices.length = 0;
        return raySlices;
      },
      raySlices: () => [...raySlices],
      /** Chạy trọn một lần tính điểm neo, đồng bộ, từng khúc một — trả thời lượng các khúc (ms). */
      benchRays: () => {
        const pl = ctx.plane();
        const job = makeRayJob(pl, modelOf(pl), ctx.metrics());
        const t = [];
        for (let guard = 0; guard < 10000; guard++) {
          const t0 = performance.now();
          const done = stepRayJob(job, 0);
          t.push(performance.now() - t0);
          if (done) break;
        }
        const s2 = [...t].sort((a, b) => a - b);
        return { chunks: t.length, total: r2(t.reduce((a, b) => a + b, 0)), max: r2(s2[s2.length - 1]) };
      },
    });
    /** DEV: vị trí thế giới hai cột chữ + độ đục + tiến độ các dòng — ghi vết chuyển cảnh. */
    api.debugState = () => {
      if (!active || !rig.visible) return { visible, queued: !!queued, cols: null };
      rig.updateMatrixWorld(true);
      const k = rig.parent?.scale.x || 1; // lớp CSS3D vẽ trong thế giới phóng k lần (css3d.js) → đổi về đơn vị thế giới
      const pos = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).divideScalar(k).toArray().map((v) => +v.toFixed(4));
      const mean = (a) => +(a.reduce((s, it) => s + it.tw.pos, 0) / Math.max(1, a.length)).toFixed(4);
      return {
        visible,
        queued: !!queued,
        sameAsLive: plane === ctx.plane(),
        k: +G.k.toFixed(4),
        opacity: afSent,
        R: pos(R.obj),
        L: pos(L.obj),
        D: pos(D.obj),
        linesR: mean(linesR),
        linesL: mean(linesL),
        desc: +desc.tw.pos.toFixed(4),
      };
    };
    const disp = api.dispose;
    api.dispose = () => {
      disp();
      if (vm.cinemaLightPerf === hook) delete vm.cinemaLightPerf;
    };
  }
  return api;
}
