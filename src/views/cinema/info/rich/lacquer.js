// r71 → r72 — thông tin mở rộng trong cảnh: hai tấm "BÌNH PHONG SƠN MÀI" bản lề ở hai mép phiến bia như bình phong gốc
// (screens.js — cùng cơ học: gập sau 90° → mở chữ V 14°, bám mặt phẳng bia, đi / mờ cùng khay khi chuyển cảnh), cao hơn để chứa
// thông tin mở rộng, chữ theo nhịp dọc chung cho hai tấm. r72 (người dùng: "thích full size thông tin của triển lãm điện ảnh và
// thích design bên ngoài của Bình phong sơn mài. kết hợp nhé"): tấm trong cảnh là sơn mài; mọi phần XEM TOÀN MÀN HÌNH là
// MỘT lớp đọc (reader.js — bài ký → lạc khoản → đề danh, mục lục trái):
//   Tấm trái : "hoành" = TÊN VUA (lớn) + triều · niên hiệu (nhỏ); thân = số sĩ tử dự thi · số tiến sĩ đỗ, tam khôi (danh hiệu +
//              tên), số người hai giáp sau; chân = "Xem ĐỀ DANH" → lớp đọc mở thẳng ở phần Đề danh.
//              Lúc focus, tên đang chạy trên mặt bia tắt dần (stage — info.richFor) — danh sách chuyển về tấm này.
//   Tấm phải : "hoành" = tên bia · người soạn; thân = lời giới thiệu; chân = "Đọc toàn văn" → lớp đọc từ đầu.
// Tay: hai nút là VÙNG DÍNH (data-hand-sticky="info-…", lớp cử chỉ lo vào / ra / nhón = bấm) — chạy cả khi vòng con trỏ ẩn;
// view không coi vùng dính "info-…" là rời bia (index.js). Chuột: bấm, lăn trên danh sách.
// r75 (thông tin thêm — extras.js): tấm trái thêm MỘT dòng tỉ lệ đỗ dưới 450 | 33; tấm phải: "Soạn văn <tên>" rê chuột / tay tới
// → thẻ tiểu sử người soạn; dưới lời giới thiệu MỘT dải chuyện xoay vòng (ghi chú ↔ chuyện người đỗ, mờ chéo mỗi ~9 s, dừng khi
// rê vào) — chỉ mục vừa ~2 dòng; lời giới thiệu vẫn là nội dung chính. Hai tấm cao thêm 52 px thiết kế (hoành / chân gọn lại
// 8 / 6 px) để dải chuyện không chen lời giới thiệu (tấm không đủ chỗ ở cỡ cũ — xem báo cáo r75).
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ensureFont, FONT } from '../../../../core/fonts.js';
import { getSettings } from '../../../../core/settings.js';
import { advance, aim, canChiShown, clamp, countOf, easeIn, easeOut, fmtNum, h, introInto, known, linear, rankOf, smooth, snap, TIER_NAME, topGroupOf, tween, unnamed } from './common.js';
import { createReader } from './reader.js';
import { bioInto, stripItems } from './extras.js';
import '../screens.css'; // khung / kính / thanh ngang dùng lại của bình phong gốc (.bp-glass, .bp-frame)
import './lacquer.css';

// ---- Hình học (plane-local, bia cao 1) — như screens.js, tấm cao hơn
const GAP = 0.03;
const RAISE = 0.035; // mép trên tấm cao hơn vai vòm chút (tấm cao, đáy không chạm lòng bục)
const PX = 0.62 / 340; // đơn vị mặt phẳng / px thiết kế — CÙNG tỉ lệ với bình phong gốc (chữ cùng cỡ)
const OPEN_DEG = 14;
const OPEN = (OPEN_DEG * Math.PI) / 180;
const FOLD = Math.PI / 2;
const Z_L = 0.003;
const Z_R = 0.0034;

// ---- Khuôn thiết kế (px CSS; khung 1440×900 mặc định ≈ px màn hình)
const W_PX = 334;
const H_PX = 520; // r75: 468 → 520 (dải chuyện dưới lời giới thiệu)
const HEAD_PX = 104; // r75: 112 → 104
const FOOT_PX = 64; // r75: 70 → 64
// r75 dải chuyện
const STRIP_S = 9; // s mỗi mục
let stripS = STRIP_S; // DEV: api.dev.stripPeriod
const STRIP_FADE_MS = 450;
const STRIP_LINES = 2;
const HAND_PAD_PX = 20; // px quanh "Soạn văn …" / dải chuyện: tay trong vùng này = rê vào
const PAD_PX = 26;
const SPAN_K = 1.03;
// r73 (người dùng: "độ rộng 2 bên vẫn còn đẩy 2 tấm info dịch sang cho cân đối nhé"): hai tấm dùng hết khoảng trống hai bên —
// bắt đầu từ ngoài thân RÙA (không chỉ mép phiến: rùa rộng hơn phiến, tấm từng chồm lên rùa), phần dư chia ĐỀU hai phía tấm
// (khe tấm ↔ bia = khe tấm ↔ vùng mũi tên / năm hai bên), không bao giờ lấn vùng mũi tên (ctx.safeArea + SIDE_PAD_PX) —
// tính theo khung FOCUS (camera tiến gần settings.cinemaHoverZoom), và báo extent cho sân khấu kẹp zoom đúng như vậy.
const SIDE_PAD_PX = 24; // px: chừa thêm ngoài vùng mũi tên / năm
const BODY_CLEAR = 0.025; // đơn vị mặt phẳng: khe tối thiểu mép trong tấm ↔ thân rùa
const MAX_SHIFT = 0.24; // đẩy ra tối đa (khung rất rộng: tấm không trôi quá xa bia)
// r74 (người dùng: "khi zoom in thì ẩn cả 2 bảng info đi, giống như khi xoay ngang để text không bị cắt"): ở khung camera HIỆN
// TẠI, hình chiếu tấm (mở hẳn) mà ra khỏi khung nhìn (trên / dưới) hoặc lấn dải mũi tên / năm hai bên → hai tấm mờ đi như lúc
// xoay ngang, bấm / rê không trúng; về lại khung vừa → hiện lại.
// r76 (người dùng: ẩn lúc zoom "cắt quá gắt", muốn êm như lúc xoay ngang): như độ hiện theo góc (một hàm liên tục của trạng thái
// camera — góc 24° → 42°), độ hiện theo zoom là hàm liên tục của khoảng cách mép tấm (mở hẳn) tới giới hạn: hiện đủ tới khi mép
// còn cách giới hạn `ramp` px, mờ dần (smoothstep) và bằng ĐÚNG 0 lúc chạm giới hạn — và 0 suốt khi đã lấn. Không trễ, không bật
// / tắt. `ramp` = khe hở ĐO ĐƯỢC ở khung do ứng dụng lái (focus / nghỉ — ctx.cameraUserMoved false; người xem tự zoom thì giữ
// số đo cuối) trừ ZOOM_RAMP_MARGIN, trong ZOOM_RAMP_MIN…MAX: ở khung focus mặc định tấm luôn hiện đủ, dốc dài nhất có thể trước
// giới hạn (bố cục r73 đặt tấm sát vùng mũi tên: ~15 px ở 1280, ~25 ở 1440, ~85 ở 1920, 110 ở 2560). Nhân với độ hiện theo góc.
// Lăn chuột không còn nhảy camera trong một khung (stage/camera.js — lò xo WHEEL_W) nên dốc mờ không bao giờ bị nhảy qua.
const ZOOM_RAMP_MIN = 12; // px
const ZOOM_RAMP_MAX = 110; // px
const ZOOM_RAMP_MARGIN = 3; // px: khung focus mặc định còn cách đầu dốc ngần này
const ZOOM_EDGE_PX = 6; // mép trên / dưới khung nhìn chừa ngần này
const FIT_PAD_PX = ZOOM_RAMP_MIN + ZOOM_RAMP_MARGIN + 3; // r79: khe tối thiểu mép ngoài tấm ↔ giới hạn ở khung focus (xem measureGeom)

// ---- Nhịp (giây)
const OPEN_S = 0.72;
const R_DELAY_S = 0.08;
const TEXT_AT = 0.6;
const TEXT_OUT_S = 0.12;
const CLOSE_S = 0.38;
const RM_IN_S = 0.24;
const RM_OUT_S = 0.18;

const ARROW = '<svg viewBox="0 0 22 16" aria-hidden="true"><path d="M1 8h19M14 2.5L19.8 8 14 13.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** @param {any} ctx InfoCtx (+ pinInfo) */
export function createRichLayout(ctx) {
  const { THREE } = ctx;
  const rm = !!ctx.reduceMotion;
  ensureFont(FONT.playfair);
  ensureFont(FONT.bodoni);
  ensureFont(FONT.beVietnam);
  ensureFont(FONT.lora);

  ctx.css3d.ensure();
  const rig = new THREE.Group();
  rig.matrixAutoUpdate = false;
  rig.visible = false;
  ctx.css3d.scene.add(rig);

  function makeLeaf(side) {
    const anchor = h('div', 'bp-anchor');
    const leaf = h('article', `lq-leaf lq-leaf--${side < 0 ? 'l' : 'r'}${rm ? ' lq-rm' : ''}`);
    leaf.style.setProperty('--lq-w', `${W_PX}px`);
    leaf.style.setProperty('--lq-h', `${H_PX}px`);
    leaf.style.setProperty('--lq-head', `${HEAD_PX}px`);
    leaf.style.setProperty('--lq-foot', `${FOOT_PX}px`);
    leaf.style.setProperty('--lq-pad', `${PAD_PX}px`);
    // dùng lại biến của khung bình phong gốc
    leaf.style.setProperty('--bp-head', `${HEAD_PX}px`);
    leaf.setAttribute('aria-hidden', 'true');
    leaf.setAttribute('aria-label', side < 0 ? 'Khoa thi và người đỗ' : 'Về tấm bia');
    const glass = h('div', 'bp-glass');
    glass.append(h('div', 'bp-glass__head'), h('div', 'bp-glass__body'));
    const frame = h('div', 'bp-frame lq-frame');
    const head = h('div', 'lq-head');
    const body = h('div', 'lq-body');
    const foot = h('div', 'lq-foot');
    leaf.append(glass, frame, head, body, foot);
    anchor.append(leaf);
    const obj = new CSS3DObject(anchor);
    anchor.style.pointerEvents = 'none';
    rig.add(obj);
    return { side, z: side < 0 ? Z_L : Z_R, anchor, leaf, head, body, foot, obj, open: tween(0), fade: tween(0), text: false, alpha: 0, written: -1 };
  }
  const L = makeLeaf(-1);
  const R = makeLeaf(1);
  const leaves = [L, R];

  // ---------------------------------------------------------------- nội dung
  let info = null;
  let filled = null;
  /** @type {HTMLButtonElement|null} */ let namesBtn = null;
  /** @type {HTMLButtonElement|null} */ let readBtn = null;
  let interactive = false;
  const reader = createReader(ctx);

  // ---------------------------------------------------------------- r75: thẻ người soạn · dải chuyện (tấm phải)
  const acard = h('div', 'lq-card');
  acard.setAttribute('aria-hidden', 'true');
  R.leaf.append(acard);
  /** @type {HTMLElement|null} */ let author = null;
  /** @type {HTMLElement|null} */ let ccEl = null; // r79: can chi theo tiêu đề bia có chú thích (vd. 1514 "Quý Mùi")
  // r79: MỘT thẻ dùng chung cho hai đích — người soạn (tiểu sử) · can chi (ghi chú nguyên văn); chuột / tay
  const cardBy = { author: { mouse: false, hand: false }, cc: { mouse: false, hand: false } };
  let cardKind = null;
  const cardOk = (k) => (k === 'author' ? !!info?.authorBio && !!author : !!info?.canChiNote && !!ccEl);
  function setCard(kind, on, by) {
    cardBy[kind][by] = !!on;
    const want = ['cc', 'author'].find((k) => (cardBy[k].mouse || cardBy[k].hand) && cardOk(k)) ?? null;
    const show = interactive ? want : null;
    if (show && show !== cardKind) {
      if (show === 'author') bioInto(acard, info.authorBio, { rank: 'Soạn bài ký văn bia', cls: 'lq-card' });
      else noteInto(acard, canChiShown(info), info.canChiNote);
    }
    cardKind = show;
    acard.classList.toggle('is-on', !!show);
    author?.classList.toggle('is-hot', show === 'author');
    ccEl?.classList.toggle('is-hot', show === 'cc');
  }
  const setAuthor = (on, by) => setCard('author', on, by);
  /** Thẻ ghi chú (can chi): chữ đích · nguyên văn ghi chú (r80: không nhãn chữ hoa nhỏ — ghi chú là một câu liền). */
  function noteInto(el, term, text) {
    el.replaceChildren();
    const top = h('div', 'lq-card__top');
    top.append(h('span', 'lq-card__n', term));
    el.append(top, h('p', 'lq-card__bio', text ?? ''));
  }
  // đo "vừa ~2 dòng": một phần tử ẩn cùng bề ngang / kiểu chữ với dòng chữ của dải
  const measure = h('p', 'lq-strip__t lq-strip__m');
  measure.setAttribute('aria-hidden', 'true');
  const strip = (() => {
    const el = h('div', 'lq-strip');
    const lab = h('p', 'lq-strip__l');
    const txt = h('p', 'lq-strip__t');
    el.append(lab, txt);
    let items = [];
    let all = [];
    let cur = -1;
    let clock = 0;
    let swapT = 0;
    let measured = false;
    const hov = { mouse: false, hand: false };
    el.addEventListener('pointerenter', () => (hov.mouse = true));
    el.addEventListener('pointerleave', () => (hov.mouse = false));
    function show(i) {
      cur = i;
      const it = items[i];
      lab.textContent = it?.label ?? '';
      lab.hidden = !it?.label; // r80: ghi chú không có nhãn tiêu đề → một câu liền, không dòng nhãn
      txt.textContent = it?.text ?? '';
      el.dataset.kind = it?.kind ?? '';
      el.classList.toggle('is-plain', !it?.label);
    }
    // không nhãn: câu liền dùng cả chỗ của dòng nhãn → thêm một dòng chữ
    const linesOf = (it) => (it.label ? STRIP_LINES : STRIP_LINES + 1);
    function fits(it) {
      measure.textContent = it.text;
      const lh = parseFloat(getComputedStyle(measure).lineHeight) || 16;
      return measure.offsetHeight <= lh * linesOf(it) + 1;
    }
    return {
      el,
      fill(inf) {
        all = stripItems(inf);
        items = [];
        measured = false;
        cur = -1;
        clock = 0;
        clearTimeout(swapT);
        el.classList.remove('is-swap');
        el.hidden = true;
      },
      /** Đo (chữ đã có font) — chỉ giữ mục vừa ~2 dòng; lời giới thiệu chạm dải → bỏ dải. */
      settle() {
        if (measured || !all.length) return;
        if (!measure.offsetWidth) return; // tấm chưa dựng xong
        measured = true;
        items = all.filter(fits);
        const intro = R.body.querySelector('.lq-intro');
        el.hidden = !items.length;
        if (items.length) {
          show(0);
          const top = el.offsetTop;
          if (intro && intro.offsetTop + intro.offsetHeight + 6 > top) {
            items = [];
            el.hidden = true;
          }
        }
      },
      step(dt, handPt) {
        if (!measured || items.length < 2 || el.hidden) return;
        if (handPt) {
          const r = el.getBoundingClientRect();
          hov.hand = handPt.x >= r.left - HAND_PAD_PX && handPt.x <= r.right + HAND_PAD_PX && handPt.y >= r.top - HAND_PAD_PX && handPt.y <= r.bottom + HAND_PAD_PX;
        } else hov.hand = false;
        const paused = hov.mouse || hov.hand;
        el.classList.toggle('is-paused', paused);
        if (paused || el.classList.contains('is-swap')) return;
        clock += dt;
        if (clock < stripS) return;
        clock = 0;
        el.classList.add('is-swap');
        swapT = setTimeout(() => {
          show((cur + 1) % items.length);
          el.classList.remove('is-swap');
        }, rm ? 0 : STRIP_FADE_MS);
      },
      state: () => ({ items: items.map((x) => x.label), kinds: items.map((x) => x.kind), all: all.length, cur, label: lab.textContent, text: txt.textContent, hidden: el.hidden, paused: el.classList.contains('is-paused'), clock: +clock.toFixed(2) }),
      dispose: () => clearTimeout(swapT),
    };
  })();
  // tay: vị trí gần nhất (hand:frame) — rê tới "Soạn văn …" / dải chuyện
  let handPt = null;
  const onHandLq = (e) => {
    const d = e.detail || {};
    handPt = d.detected && d.pose !== 'pinch' && d.pose !== 'fist' && !d.fist ? { x: d.x, y: d.y } : null;
    const nearEl = (el, pad) => {
      if (!el || !handPt || !interactive) return false;
      const r = el.getBoundingClientRect();
      return handPt.x >= r.left - pad && handPt.x <= r.right + pad && handPt.y >= r.top - pad && handPt.y <= r.bottom + pad;
    };
    for (const k of ['author', 'cc']) {
      if (!cardOk(k)) continue;
      // tay đã ở trên thẻ đang mở của đích này → giữ
      const near = nearEl(k === 'author' ? author : ccEl, HAND_PAD_PX) || (cardKind === k && nearEl(acard, 0));
      if (near !== cardBy[k].hand) setCard(k, near, 'hand');
    }
  };
  window.addEventListener('hand:frame', onHandLq);

  function fill() {
    filled = info;
    if (!info) {
      for (const lf of leaves) {
        lf.head.replaceChildren();
        lf.body.replaceChildren();
        lf.foot.replaceChildren();
      }
      return;
    }
    let i = 0;
    const t = (el) => {
      el.classList.add('lq-t');
      el.style.setProperty('--i', String(i++));
      return el;
    };

    // ---- Tấm trái: vua · triều · niên hiệu (r79: phần nào dữ liệu không có thì bỏ — vd. 1589 không có tên vua)
    const heads = [];
    const kingName = known(info.king?.name);
    if (kingName) {
      const king = t(h('p', 'lq-king'));
      // tên dài kèm tên thật trong ngoặc ("Mạc Thái Tổ (Mạc Đăng Dung)") → phần ngoặc xuống dòng, chữ nhỏ
      const km = kingName.match(/^(.+?)\s*\(([^)]+)\)\s*$/u);
      if (km) king.append(h('span', null, km[1]), h('span', 'lq-king__alt', km[2]));
      else king.textContent = kingName;
      heads.push(king);
    }
    const reignParts = [known(info.dynasty), info.era ? `niên hiệu ${info.era}` : null].filter(Boolean);
    if (reignParts.length) {
      const reign = t(h('p', 'lq-reign'));
      reignParts.forEach((x, k) => {
        if (k) reign.append(h('i', 'lq-dot', '·'));
        reign.append(h('span', null, x));
      });
      heads.push(reign);
    }
    L.head.replaceChildren(...heads);

    const sum = h('div', 'lq-sum');
    const figs = t(h('div', 'lq-figs'));
    // r79: số dự thi: số chính xác · chữ nguồn khi mơ hồ ("hơn 750", "vài nghìn") · "Không ghi" → chỉ còn số đỗ
    const fig = (c, cap) => {
      const f = h('div', 'lq-fig');
      const v = h('b', 'lq-fig__v');
      if (c.words) {
        v.classList.add('is-words');
        v.textContent = c.words;
      } else {
        if (c.q) v.append(h('small', 'lq-fig__q', c.q));
        v.append(fmtNum(c.n));
      }
      f.append(v, h('span', 'lq-fig__c', cap));
      return f;
    };
    const cand = countOf(info.candidates, info.candidatesRaw);
    const passed = info.passed ?? (info.laureates?.length || null);
    if (cand) figs.append(fig(cand, 'sĩ tử dự thi'));
    if (passed != null) figs.append(fig({ n: passed }, 'tiến sĩ đỗ'));
    // r75: tỉ lệ đỗ — một dòng nhỏ dưới hai con số (không có khi hai số không chính xác)
    const rate = info.passRate?.phrase ? t(h('p', 'lq-rate', info.passRate.phrase)) : null;
    // r79: tam khôi (Đệ nhất giáp có Trạng nguyên / Bảng nhãn / Thám hoa) — không có thì tên đầu của giáp cao nhất có người
    const tg = topGroupOf(info);
    const lab = t(h('p', 'lq-lab', tg ? (tg.tam ? 'Tam khôi · Đệ nhất giáp' : `${TIER_NAME[tg.tier]} · ${tg.label}`) : ''));
    const top = h('ol', 'lq-top');
    for (const p of (tg?.list ?? []).slice(0, 3)) {
      const li = t(h('li', 'lq-top__i'));
      const rk = tg.tam ? rankOf(p) : '';
      if (rk) li.append(h('span', 'lq-rank', rk));
      li.append(h('span', 'lq-nm', p.name));
      top.append(li);
    }
    const more = t(h('p', 'lq-more'));
    (tg?.rest ?? []).forEach((g, k) => {
      if (k) more.append(h('i', 'lq-dot', '·'));
      more.append(h('span', null, `${TIER_NAME[g.tier]} `), h('b', null, String(g.list.length)));
    });
    sum.append(figs);
    if (rate) sum.append(rate);
    if (tg) sum.append(lab, top);
    if (tg?.rest.length) sum.append(more);

    L.body.replaceChildren(sum);

    // r72: "Xem ĐỀ DANH" (người dùng) → lớp đọc toàn văn, mở thẳng ở phần cuối — Đề danh
    namesBtn = t(h('button', 'lq-btn lq-btn--names'));
    namesBtn.type = 'button';
    namesBtn.innerHTML = `<span class="lq-btn__t">Xem ĐỀ DANH</span><span class="lq-btn__i lq-btn__i--arrow">${ARROW}</span>`;
    namesBtn.addEventListener('click', () => openReader('roll'));
    L.foot.replaceChildren(namesBtn);

    // ---- Tấm phải: tên bia · lời giới thiệu · đọc toàn văn
    const title = t(h('h3', 'lq-title'));
    // r79: can chi như tiêu đề bia (1514: "Quý Mùi"); có ghi chú can chi → gạch chấm, rê chuột / tay → thẻ ghi chú
    const cc = canChiShown(info);
    const l2 = h('span', 'lq-nw', 'khoa ');
    ccEl = null;
    if (cc) {
      if (info.canChiNote) {
        ccEl = h('span', 'lq-cc', cc);
        ccEl.addEventListener('pointerenter', () => setCard('cc', true, 'mouse'));
        ccEl.addEventListener('pointerleave', () => setCard('cc', false, 'mouse'));
        l2.append(ccEl);
      } else l2.append(cc);
      l2.append(' · ');
    }
    l2.append(String(info.year ?? ''));
    title.append(h('span', 'lq-nw', 'Bia Tiến sĩ'), document.createElement('br'), l2);
    author = null;
    // r79: người soạn không ghi tên (1646) → không có dòng "Soạn văn"
    const authorName = unnamed(info.contributors?.author) ? null : known(info.contributors.author);
    if (authorName) {
      const by = h('span', 'lq-by');
      by.append('Soạn văn ');
      author = h('span', `lq-author${info.authorBio ? ' is-bio' : ''}`, authorName);
      by.append(author);
      title.append(by);
      if (info.authorBio) {
        author.addEventListener('pointerenter', () => setAuthor(true, 'mouse'));
        author.addEventListener('pointerleave', () => setAuthor(false, 'mouse'));
      }
    }
    cardKind = null;
    for (const k of ['author', 'cc']) {
      setCard(k, false, 'mouse');
      setCard(k, false, 'hand');
    }
    R.head.replaceChildren(title);
    const intro = t(h('p', 'lq-intro'));
    introInto(intro, (info.intro?.text ?? []).join(' '));
    R.body.replaceChildren(intro, t(strip.el), measure);
    strip.fill(info);
    readBtn = t(h('button', 'lq-btn lq-btn--read'));
    readBtn.type = 'button';
    // r79: nội dung nguồn là bài mô tả bia (1565 — content.kind 'description') → không gọi là toàn văn
    const readLabel = info.content?.kind === 'description' ? 'Đọc mô tả bia' : 'Đọc toàn văn';
    readBtn.innerHTML = `<span class="lq-btn__t">${readLabel}</span><span class="lq-btn__i lq-btn__i--arrow">${ARROW}</span>`;
    readBtn.addEventListener('click', () => openReader('top'));
    // r72: bỏ chú thích "Lời giới thiệu do AI soạn…" trên giao diện (cờ "$verify" vẫn giữ trong dữ liệu)
    R.foot.replaceChildren(readBtn);
    reader.setInfo(info);
    setInteractive(interactive, true);
  }

  /**
   * Lớp đọc: 'top' (bài ký) | 'roll' (đề danh). r74: bấm nút (chuột / nhón) → một lượt QUÉT BẢN DẬP trên mặt bia rồi mới zoom vào
   * đọc; giữ hai ngón (openFull — đã quét trong 2 s giữ) → mở ngay. r84: lượt quét của nút = lượt giữ V (vạch theo thời gian, camera
   * nhích vào — ctx.scan.preroll), zoom ở cùng mốc 2 s, vạch đi tiếp lúc camera tiến. opts (r84 xem thử): { zoomIn } cho lần mở này.
   */
  let scanPending = false;
  function openReader(at = 'top', { scanned = false, ...opts } = {}) {
    if (!info) return false;
    reader.setInfo(info);
    if (!scanned && ctx.scan?.enabled) {
      if (scanPending) return true;
      scanPending = true;
      const run = ctx.scan.preroll ? ctx.scan.preroll() : ctx.scan.play(500).then(() => true);
      run.then((ok) => {
        scanPending = false;
        if (ok !== false && !reader.isOpen) reader.open({ at, ...opts });
      });
      return true;
    }
    reader.open({ at, ...opts });
    return true;
  }

  /** Nút bấm được (chuột: pointer-events; tay: vùng dính) chỉ khi chữ đã hiện — tấm đang gập không giành tay / chuột. */
  function setInteractive(on, force = false) {
    if (on === interactive && !force) return;
    interactive = on;
    for (const [b, name] of [
      [namesBtn, 'info-names'],
      [readBtn, 'info-read'],
    ]) {
      if (!b) continue;
      if (on) {
        b.setAttribute('data-hand-sticky', name);
        b.setAttribute('data-hand-sticky-pad', '22 16');
        // r88 (người dùng: "rê tay lên nút thì hiện thêm một khối xám phía trên"): KHÔNG khối biến hình của con trỏ tay quanh nút —
        // tay rê trông y như chuột rê (nút tự sáng theo body[data-hand-sticky]); nút nằm trên tấm CSS3D nên hình chữ nhật màn hình
        // của nó còn lệch khỏi nét vẽ thật
        b.setAttribute('data-hand-sticky-box', 'none');
        b.setAttribute('data-magnet', '');
        b.tabIndex = 0;
      } else {
        b.removeAttribute('data-hand-sticky');
        b.removeAttribute('data-hand-sticky-pad');
        b.removeAttribute('data-hand-sticky-box');
        b.removeAttribute('data-magnet');
        b.tabIndex = -1;
      }
    }
    L.leaf.classList.toggle('is-live', on);
    R.leaf.classList.toggle('is-live', on);
    if (!on) for (const k of ['author', 'cc']) setCard(k, false, 'hand'), setCard(k, false, 'mouse');
  }

  // ---------------------------------------------------------------- vòng đời (như screens.js)
  let visible = false;
  let clock = 0;
  let plane = null;
  let queued = null;
  let pending = null;
  const _size = new THREE.Vector2();
  const _p = new THREE.Vector3();
  const quad = Array.from({ length: 4 }, () => ({ x: 0, y: 0, behind: false }));
  const G = { sigma: 0, yBase: 0, xL: 0, xR: 0, slabL: 0, slabR: 0 };
  const Gx = { ...G };
  // r74 → r76: mờ khi zoom làm tấm tới gần / lấn giới hạn (xem ZOOM_*)
  let zoomF = 1;
  let overflowNow = -Infinity;
  let rampNow = ZOOM_RAMP_MIN;
  let baseOver = null; // lấn (px) ở khung do ứng dụng lái — đo lần gần nhất
  /** Lấn lớn nhất (px, > 0 = lấn) của hai tấm MỞ HẲN ở khung camera hiện tại so với vùng được phép. */
  function overflowPx() {
    if (!plane || !G.sigma) return -Infinity;
    const m = plane.matrixWorld;
    const safe = ctx.safeArea();
    const side = Math.max(safe.left, safe.right);
    const W = document.documentElement.clientWidth || innerWidth;
    const H = document.documentElement.clientHeight || innerHeight;
    const Wp = W_PX * G.sigma;
    const Hs = H_PX * G.sigma;
    let over = -Infinity;
    for (const lf of leaves) {
      const th = angleOf(lf, 1);
      const dx = lf.side * Wp * Math.cos(th);
      const dz = -lf.side * Wp * Math.sin(th);
      const hx = lf.side < 0 ? G.xL : G.xR;
      for (let i = 0; i < 4; i++) {
        const outer = i === 1 || i === 2;
        _p.set(outer ? hx + dx : hx, G.yBase + (i < 2 ? Hs : 0), lf.z + (outer ? dz : 0)).applyMatrix4(m);
        const q = ctx.worldToScreen(_p, quad[i]);
        if (q.behind) return Infinity;
        over = Math.max(over, side - q.x, q.x - (W - side), ZOOM_EDGE_PX - q.y, q.y - (H - ZOOM_EDGE_PX));
      }
    }
    return over;
  }

  function measureGeom(pl = null, g = G) {
    const M = ctx.metrics(pl);
    if (!M) return false;
    const s = ctx.worldPerPx(pl);
    ctx.renderer.getSize(_size);
    let sigma = PX;
    const halfW = _size.x * 0.5 * s;
    const safe = ctx.safeArea();
    const side = (Math.max(safe.left, safe.right) + SIDE_PAD_PX) * s;
    // nửa bề ngang dùng được ở khung focus (camera tiến gần zf → mọi thứ phóng 1/(1 − zf) quanh tâm)
    const zf = clamp(Number(getSettings().cinemaHoverZoom) || 0, 0, 0.25);
    const avail = Math.max(0.1, halfW - side) * (1 - zf);
    const body = Math.max(0, M.bodyHalf ?? 0) + BODY_CLEAR;
    const innerL = Math.max(-M.slabLeft + GAP, body);
    const innerR = Math.max(M.slabRight + GAP, body);
    const inner = Math.max(innerL, innerR);
    const room = avail - inner;
    const need = W_PX * sigma * SPAN_K;
    // r79: bia rùa rộng (vd. 1616, 1727 ở 1440×900) — tấm từng vừa khít giới hạn (±2 px) nên dốc mờ theo zoom (r76, ≥ 12 px)
    // làm tấm mờ / tắt hẳn ngay ở khung focus. Mép ngoài tấm luôn cách giới hạn ≥ FIT_PAD_PX: đủ chỗ thì như cũ (chia đều), hơi
    // thiếu thì bớt khe phía trong, thiếu hẳn thì thu nhỏ tấm.
    const pad = FIT_PAD_PX * s * (1 - zf);
    let shift = 0;
    if (room - need >= 2 * pad) shift = Math.min(MAX_SHIFT, (room - need) / 2); // dư → chia đều hai phía tấm
    else if (room - need >= pad) shift = room - need - pad;
    else sigma *= clamp((room - pad) / need, 0.5, 1);
    g.sigma = sigma;
    g.yBase = 0;
    g.slabL = M.slabLeft;
    g.slabR = M.slabRight;
    g.xL = -(innerL + shift);
    g.xR = innerR + shift;
    // extent cho sân khấu (kẹp zoom: (extent + 28 px) / (1 − z) ≤ nửa khung) sao cho mép ngoài tấm ở khung focus không vượt
    // quá (nửa khung − vùng mũi tên − SIDE_PAD_PX)
    const outer = Math.max(g.xR, -g.xL) + W_PX * sigma * SPAN_K;
    g.guard = (outer * halfW) / Math.max(0.1, halfW - side) - 28 * s;
    return true;
  }
  const angleOf = (lf, o) => lf.side * (FOLD - o * (FOLD + OPEN));
  function setText(lf, on) {
    if (lf.text === on) return;
    lf.text = on;
    lf.leaf.classList.toggle('is-text', on);
  }
  const atRest = () => !visible && L.open.v === 0 && R.open.v === 0 && L.fade.v === 0 && R.fade.v === 0;

  const api = {
    extent() {
      if (!measureGeom(null, Gx)) return null;
      return Gx.guard;
    },
    show(e, inf) {
      const next = ctx.plane();
      if (plane && next && plane !== next && !atRest()) {
        queued = { e, inf };
        return;
      }
      queued = null;
      plane = next;
      if (inf) info = inf;
      if (info !== filled) fill();
      pending = null;
      visible = true;
      for (const lf of leaves) lf.leaf.setAttribute('aria-hidden', 'false');
      if (rm) {
        for (const lf of leaves) {
          snap(lf.open, 1);
          aim(lf.fade, 1, clock, RM_IN_S, linear);
          setText(lf, true);
        }
        return;
      }
      const fresh = L.open.v < 0.02 && R.open.v < 0.02;
      aim(L.open, 1, clock, OPEN_S, easeOut);
      aim(R.open, 1, clock, OPEN_S, easeOut, fresh ? R_DELAY_S : 0);
    },
    hide() {
      queued = null;
      if (reader.isOpen) return; // đang đọc toàn văn: thông tin được ghim — không gập dưới lớp đọc
      if (!visible) return;
      visible = false;
      setInteractive(false);
      for (const lf of leaves) {
        lf.leaf.setAttribute('aria-hidden', 'true');
        setText(lf, false);
      }
      if (rm) {
        for (const lf of leaves) aim(lf.fade, 0, clock, RM_OUT_S, linear);
        return;
      }
      for (const lf of leaves) aim(lf.open, 0, clock, CLOSE_S, easeIn, TEXT_OUT_S);
    },
    setEntry(e, inf) {
      if (!e) return;
      const next = inf ?? null;
      if (atRest()) {
        pending = null;
        info = next;
        if (info !== filled) fill();
      } else pending = { info: next };
    },
    isVisible: () => visible || !!queued,
    overlayOpen: () => reader.isOpen,
    /** r72: mở lớp đọc toàn màn hình (giữ hai ngón trên bia — hand:vhold) — false nếu chưa có dữ liệu. */
    openFull: (at = 'top', opts = {}) => openReader(at, { scanned: true, ...opts }),
    /** r84: đóng lớp đọc (xem thử chuyển cảnh) — false nếu không mở. */
    closeFull: (why = 'preview') => (reader.isOpen ? (reader.close(why), true) : false),
    update(dt) {
      reader.tick(); // r77: tấm đọc đi cùng mặt đá lúc camera tiến / lùi (camera của khung này đã đặt)
      if (queued && plane && ctx.opacity && ctx.opacity(plane) <= 0) {
        for (const lf of leaves) {
          snap(lf.open, 0);
          snap(lf.fade, 0);
          setText(lf, false);
        }
        rig.visible = false;
      }
      if (!rig.visible && atRest()) {
        if (pending) {
          info = pending.info;
          pending = null;
          if (info !== filled) fill();
        }
        plane = null;
        if (queued) {
          const q = queued;
          queued = null;
          api.show(q.e, q.inf);
        }
        if (!visible) return;
      }
      clock += Math.min(0.1, Math.max(0, dt || 0));
      for (const lf of leaves) {
        advance(lf.open, clock);
        advance(lf.fade, clock);
      }
      if (rm && !visible && L.fade.v === 0 && R.fade.v === 0) for (const lf of leaves) snap(lf.open, 0);
      if (visible && !plane) plane = ctx.plane();
      if (!plane || !measureGeom(plane)) {
        rig.visible = false;
        return;
      }
      if (visible && !rm) for (const lf of leaves) if (lf.open.v >= TEXT_AT) setText(lf, true);
      // r76: độ hiện theo zoom — hàm liên tục của khoảng cách mép tấm tới giới hạn (0 đúng ở giới hạn và khi đã lấn)
      overflowNow = visible ? overflowPx() : -Infinity;
      if (Number.isFinite(overflowNow) && !ctx.cameraUserMoved?.()) baseOver = overflowNow;
      rampNow = clamp((baseOver != null ? -baseOver : SIDE_PAD_PX) - ZOOM_RAMP_MARGIN, ZOOM_RAMP_MIN, ZOOM_RAMP_MAX);
      zoomF = overflowNow >= 0 ? 0 : 1 - smooth(-rampNow, 0, overflowNow);
      const af = ctx.angleFade(plane) * (ctx.opacity ? ctx.opacity(plane) : 1) * zoomF;
      let any = false;
      for (const lf of leaves) {
        const o = lf.open.v;
        const a = (rm ? lf.fade.v : smooth(0.06, 0.5, o)) * af;
        lf.alpha = a;
        lf.obj.position.set(lf.side < 0 ? G.xL : G.xR, G.yBase, lf.z);
        lf.obj.rotation.set(0, angleOf(lf, rm ? 1 : o), 0);
        lf.obj.scale.setScalar(G.sigma);
        const q = Math.round(a * 100) / 100;
        if (q !== lf.written) {
          lf.written = q;
          lf.anchor.style.opacity = String(q);
        }
        if (q > 0) any = true;
      }
      // bấm được khi đã mở hẳn, nhìn gần chính diện
      setInteractive(visible && L.text && L.alpha > 0.6);
      // r75: dải chuyện — đo khi chữ đã hiện, xoay vòng khi tấm hiện hẳn (dừng khi rê chuột / tay vào)
      if (visible && R.text) {
        strip.settle();
        if (R.alpha > 0.6) strip.step(Math.min(0.1, Math.max(0, dt || 0)), handPt);
      }
      rig.visible = any;
      if (any) {
        rig.matrix.copy(plane.matrixWorld);
        rig.matrixWorldNeedsUpdate = true;
      }
      if (!any && atRest()) plane = null;
    },
    hitTest(x, y) {
      if (reader.isOpen) return true;
      if (!visible || !plane || !G.sigma) return false;
      const m = plane.matrixWorld;
      const W = W_PX * G.sigma;
      const Hs = H_PX * G.sigma;
      for (const lf of leaves) {
        if (lf.alpha < 0.05) continue;
        const th = angleOf(lf, rm ? 1 : lf.open.v);
        const dx = lf.side * W * Math.cos(th);
        const dz = -lf.side * W * Math.sin(th);
        const hx = lf.side < 0 ? G.xL : G.xR;
        const inner = lf.side < 0 ? G.slabL : G.slabR;
        let behind = false;
        for (let i = 0; i < 4; i++) {
          const outer = i === 1 || i === 2;
          _p.set(outer ? hx + dx : inner, G.yBase + (i < 2 ? Hs : 0), lf.z + (outer ? dz : 0)).applyMatrix4(m);
          ctx.worldToScreen(_p, quad[i]);
          if (quad[i].behind) behind = true;
        }
        if (behind) continue;
        let sign = 0;
        let inside = true;
        for (let i = 0; i < 4 && inside; i++) {
          const a = quad[i];
          const b = quad[(i + 1) % 4];
          const c = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x));
          if (c === 0) continue;
          if (sign === 0) sign = c;
          else if (c !== sign) inside = false;
        }
        if (inside) return true;
      }
      return false;
    },
    dispose() {
      window.removeEventListener('hand:frame', onHandLq);
      strip.dispose();
      reader.dispose();
      for (const lf of leaves) rig.remove(lf.obj);
      ctx.css3d.scene.remove(rig);
    },
  };
  if (import.meta.env.DEV) {
    api.debugState = () => ({
      visible,
      interactive,
      reader: reader.state(),
      leaves: leaves.map((lf) => ({ side: lf.side < 0 ? 'L' : 'R', open: +lf.open.v.toFixed(3), alpha: +lf.alpha.toFixed(3) })),
      zoom: { f: +zoomF.toFixed(4), over: Number.isFinite(overflowNow) ? +overflowNow.toFixed(1) : null, ramp: +rampNow.toFixed(1), base: baseOver == null ? null : +baseOver.toFixed(1) },
      strip: strip.state(),
      author: { on: acard.classList.contains('is-on') && cardKind === 'author', text: acard.textContent },
      cc: { on: acard.classList.contains('is-on') && cardKind === 'cc', text: acard.textContent, el: !!ccEl },
      rate: L.leaf.querySelector('.lq-rate')?.textContent ?? null,
    });
    api.dev = {
      names: () => namesBtn?.click(),
      read: () => readBtn?.click(),
      close: () => reader.close('dev'),
      /** r75: chu kỳ dải chuyện (s) — kiểm thử không phải chờ 9 s; không đối số = trả về mặc định. */
      stripPeriod: (sec) => (stripS = Number.isFinite(sec) ? sec : STRIP_S),
      info: () => info,
      stripEl: () => strip.el,
      namesBtn: () => namesBtn,
      readBtn: () => readBtn,
      reader,
    };
  }
  return api;
}
