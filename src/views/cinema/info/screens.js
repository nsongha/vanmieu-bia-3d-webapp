// Kiểu "Bình phong" — hai tấm bình phong sơn mài bản lề ở hai mép phiến bia, như đôi câu đối
// hai bên án thờ. Ẩn: gập ra sau 90° (đứng cạnh, sau mặt bia). Hiện: mở ra thành hình chữ V
// nông hướng về người xem (mép ngoài chìa ra trước OPEN_DEG), như bộ tranh ba tấm.
//
//   Tấm trái : "hoành" trên cùng là số năm khoa thi (chữ số Bodoni lớn),
//              dưới là các dòng nhãn bảo tàng (ctx.facts), căn về mép gần bia.
//   Tấm phải : tên bia, bài mô tả (chữ hoa thả), hai con số chính: số tiến sĩ · người đỗ đầu.
//
// Cả hai tấm là CSS3DObject trên lớp CSS3D dùng chung, bám MẶT PHẲNG BIA (xem light.js): nhóm
// "rig" chép matrixWorld của mặt phẳng mỗi khung; mỗi tấm đặt ở bản lề (plane-local) và quay
// quanh trục Y cục bộ của chính nó.
import { PENDING } from '../facts.js';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ensureFont, FONT } from '../../../core/fonts.js';
import './screens.css';

// ---- Hình học (plane-local, bia cao 1) --------------------------------------------------
const GAP = 0.03; // khe bản lề ↔ mép phiến bia
const TOP_DROP = 0.018; // mép trên tấm = vai vòm (bandTop) hạ xuống chút
const LEAF_H = 0.62; // chiều cao tấm
const OPEN_DEG = 14; // góc mở chữ V (mép ngoài chìa về phía người xem)
const OPEN = (OPEN_DEG * Math.PI) / 180;
const FOLD = Math.PI / 2; // gập hẳn ra sau, đứng cạnh
const Z_L = 0.003; // mỗi tấm một z riêng: phần tử CSS3D phẳng xếp chồng theo thứ tự DOM
const Z_R = 0.0034;

// ---- Khuôn thiết kế (px CSS). Tấm luôn cao LEAF_H đơn vị mặt phẳng; ở khung mặc định
// 1440×900 thì 1 px thiết kế ≈ 1 px màn hình, cỡ khác thì cả tấm co giãn như một vật trong cảnh.
const W_PX = 296;
const H_PX = 340;
const HEAD_PX = 80; // dải "hoành" trên cùng (kính trong)
const FOOT_PX = 88; // dải chân (thanh ngang dưới), bằng nhau ở hai tấm
const PAD_PX = 24; // trục chữ cách mép gần bia
const MARGIN_PX = 28; // lề tối thiểu giữa mép ngoài tấm và mép khung (khung hẹp → thu nhỏ tấm)
const SPAN_K = 1.03; // bề ngang chiếu / bề ngang thật ở góc mở (cos 14° × phóng to phối cảnh)

// ---- Nhịp (giây) -----------------------------------------------------------------------------
const OPEN_S = 0.7; // bản lề mở, ease-out cubic
const R_DELAY_S = 0.08; // tấm phải trễ hơn tấm trái
const TEXT_AT = 0.6; // chữ bắt đầu vào khi tấm đã mở 60%
const TEXT_OUT_S = 0.12; // ẩn: chữ mờ cùng lúc trước…
const CLOSE_S = 0.38; // …rồi tấm gập lại, ease-in cubic
const RM_IN_S = 0.24; // giảm chuyển động: chỉ mờ dần
const RM_OUT_S = 0.18;

// Người đỗ đầu: tách học vị ra khỏi tên để tên đứng làm "con số" lớn.
const RANKS = ['Trạng nguyên', 'Bảng nhãn', 'Thám hoa', 'Hoàng giáp', 'Đình nguyên', 'Hội nguyên'];
// Hai dòng đã thành con số lớn ở tấm phải → không nhắc lại ở tấm trái.
const SKIP_ROWS = new Set(['Số người đỗ', 'Đỗ đầu']);
// Hai dòng về việc DỰNG BIA đứng riêng ở dải chân tấm trái (luôn ở cuối).
const FOOT_ROWS = new Set(['Đợt dựng bia', 'Dựng năm']);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;
const linear = (t) => t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Tween một số thực, hướng lại được giữa chừng (đi tiếp từ giá trị hiện tại, không giật). */
const tween = (v = 0) => ({ v, from: v, to: v, t0: 0, dur: 1, ease: linear });
function aim(tw, to, now, full, ease, delay = 0) {
  if (tw.to === to) return;
  tw.from = tw.v;
  tw.to = to;
  tw.t0 = now + delay;
  tw.dur = Math.max(1e-3, full * Math.abs(to - tw.v));
  tw.ease = ease;
}
function snap(tw, v) {
  tw.v = tw.from = tw.to = v;
}
function advance(tw, now) {
  if (tw.v === tw.to) return;
  const t = (now - tw.t0) / tw.dur;
  if (t <= 0) return;
  tw.v = t >= 1 ? tw.to : tw.from + (tw.to - tw.from) * tw.ease(t);
}

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** @param {import('./contract.js').InfoCtx} ctx */
export function createInfoLayout(ctx) {
  const { THREE } = ctx;
  const rm = !!ctx.reduceMotion;
  ensureFont(FONT.playfair);
  ensureFont(FONT.bodoni);
  ensureFont(FONT.beVietnam);

  if (!ctx.css3d) {
    // Không có lớp CSS3D (không xảy ra trong chế độ Điện ảnh) → kiểu rỗng, an toàn.
    return {
      show() {},
      hide() {},
      setEntry() {},
      isVisible: () => false,
      update() {},
      hitTest: () => false,
      dispose() {},
    };
  }
  ctx.css3d.ensure();

  const rig = new THREE.Group();
  rig.matrixAutoUpdate = false;
  rig.visible = false;
  ctx.css3d.scene.add(rig);

  function makeLeaf(side) {
    // Neo 0×0 = đúng điểm bản lề trên (CSS3DRenderer dịch -50%/-50% một phần tử 0×0 = không dịch).
    const anchor = h('div', 'bp-anchor');
    const leaf = h('article', `bp-leaf bp-leaf--${side < 0 ? 'l' : 'r'}${rm ? ' bp-rm' : ''}`);
    leaf.style.setProperty('--bp-w', `${W_PX}px`);
    leaf.style.setProperty('--bp-h', `${H_PX}px`);
    leaf.style.setProperty('--bp-head', `${HEAD_PX}px`);
    leaf.style.setProperty('--bp-foot', `${FOOT_PX}px`);
    leaf.style.setProperty('--bp-pad', `${PAD_PX}px`);
    leaf.setAttribute('aria-hidden', 'true');
    leaf.setAttribute('aria-label', side < 0 ? 'Khoa thi' : 'Về tấm bia');
    const glass = h('div', 'bp-glass');
    glass.append(h('div', 'bp-glass__head'), h('div', 'bp-glass__body'));
    const head = h('div', 'bp-head');
    const body = h('div', 'bp-body');
    leaf.append(glass, h('div', 'bp-frame'), head, body);
    anchor.append(leaf);
    const obj = new CSS3DObject(anchor);
    anchor.style.pointerEvents = 'none'; // CSS3DObject bật 'auto' → sẽ nuốt thao tác kéo canvas
    rig.add(obj);
    return {
      side,
      z: side < 0 ? Z_L : Z_R,
      anchor,
      leaf,
      head,
      body,
      obj,
      open: tween(0), // 0 = gập sau, 1 = mở (đã qua easing)
      fade: tween(0), // chỉ dùng khi giảm chuyển động
      text: false,
      alpha: 0, // độ đục vừa áp (đã nhân angleFade)
      written: -1,
    };
  }
  const L = makeLeaf(-1);
  const R = makeLeaf(1);
  const leaves = [L, R];

  let visible = false;
  let clock = 0;
  /**
   * Mặt phẳng của bia lúc show(): đổi bia (chuyển cảnh) thì tấm đang gập lại vẫn đi theo tấm bia CŨ — cả
   * vị trí, số đo (bản lề, cỡ tấm), độ hiện theo góc lẫn độ mờ của khay cũ — gập đúng như khi rời chuột.
   */
  let plane = null;
  /** show() cho bia MỚI đến lúc tấm còn đang gập trên bia cũ → chờ gập xong rồi mới mở trên bia mới. */
  let queued = null;
  let filled = null;
  let pending = null;
  /** @type {HTMLElement|null} */
  let descEl = null;
  let measured = true;
  let renderedVisible = false; // lớp CSS3D đã vẽ tấm ít nhất một khung (đo DOM được)

  const _size = new THREE.Vector2();
  const _p = new THREE.Vector3();
  const quad = Array.from({ length: 4 }, () => ({ x: 0, y: 0, behind: false }));
  const G = { sigma: 0, s: 0, yBase: 0, xL: 0, xR: 0, slabL: 0, slabR: 0, vh: 1 };
  const G0 = G;
  const Gx = { ...G }; // extent(): đo cho bia hiện tại, không đè số đo của tấm đang gập trên bia cũ

  // Font web tải xong có thể đổi chỗ xuống dòng → đo lại (một lần mỗi đợt tải).
  const onFonts = () => {
    measured = false;
  };
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  // ---------------------------------------------------------------- nội dung
  function fill(entry) {
    filled = entry;
    measured = false;
    const e = entry || {};

    // Tấm trái — số năm khoa thi làm "hoành"; trình đọc màn hình có dòng chữ đầy đủ.
    const year = h('p', 'bp-year bp-t');
    year.style.setProperty('--i', '0');
    if (e.year) year.append(h('span', 'bp-sr', 'Khoa thi năm '), h('span', null, String(e.year)));
    L.head.replaceChildren(year);
    const rows = ctx.facts(entry).filter((r) => !SKIP_ROWS.has(r.label));
    const foot = rows.filter((r) => FOOT_ROWS.has(r.label));
    const main = rows.filter((r) => !FOOT_ROWS.has(r.label));
    let i = 1; // 0 = số năm
    const list = (items, cls) => {
      const dl = h('dl', cls);
      for (const r of items) {
        const row = h('div', 'bp-row bp-t');
        row.style.setProperty('--i', String(i++));
        row.append(h('dt', null, r.label), h('dd', null, r.value));
        dl.append(row);
      }
      return dl;
    };
    const lFoot = h('div', 'bp-foot');
    lFoot.append(list(foot, 'bp-rows'));
    L.body.replaceChildren(list(main, 'bp-rows bp-rows--main'), lFoot);

    // Tấm phải — tên bia, mô tả, hai con số chính.
    const title = h('h3', 'bp-title bp-t');
    title.style.setProperty('--i', '0');
    // Ngắt dòng theo nghĩa: "Bia Tiến sĩ" / "khoa Nhâm Tuất (1442)" (cả câu không vừa một dòng).
    // Luôn ngắt đúng giữa hai vế, không bao giờ tách "Tiến sĩ" (tên khoa dài hơn sẽ đẩy chữ "sĩ" xuống dòng).
    if (e.canChi && e.year) title.append(h('span', 'bp-nw', 'Bia Tiến sĩ'), document.createElement('br'), h('span', 'bp-nw', `khoa ${e.canChi} (${e.year})`));
    else title.textContent = e.title ?? '';
    R.head.replaceChildren(title);

    // r21: bia chưa có dữ liệu lịch sử → một dòng "Chờ dữ liệu" lặng lẽ thay cho mô tả (không chữ hoa thả)
    descEl = e.mota ? h('p', 'bp-desc bp-t', String(e.mota)) : h('p', 'bp-desc bp-t is-pending', PENDING);
    descEl.style.setProperty('--i', '1');

    const figs = h('div', 'bp-figs');
    const f1 = h('div', 'bp-fig bp-fig--num bp-t');
    f1.style.setProperty('--i', '2');
    f1.append(h('b', 'bp-fig__v', String(e.soDo ?? '—')), h('span', 'bp-fig__c', 'tiến sĩ đỗ'));
    if (e.soDo != null) figs.append(f1); // chưa có số liệu → không hiện "— tiến sĩ đỗ"
    if (e.dauKhoa) {
      const s = String(e.dauKhoa);
      const rank = RANKS.find((r) => s.startsWith(`${r} `)) ?? '';
      const f2 = h('div', 'bp-fig bp-fig--name bp-t');
      f2.style.setProperty('--i', '3');
      if (rank) f2.append(h('i', 'bp-fig__r', rank));
      f2.append(h('b', 'bp-fig__v', rank ? s.slice(rank.length + 1) : s), h('span', 'bp-fig__c', 'Đỗ đầu'));
      figs.append(f2);
    }
    const rFoot = h('div', 'bp-foot');
    rFoot.append(figs);
    R.body.replaceChildren(descEl, rFoot);
  }

  // ---------------------------------------------------------------- hình học mỗi khung
  /** Cập nhật G theo số đo của bia mang mặt phẳng pl (null = bia hiện tại). false = chưa có bia. */
  function measureGeom(pl = null, G = G0) {
    const M = ctx.metrics(pl);
    if (!M) return false;
    const s = ctx.worldPerPx(pl);
    ctx.renderer.getSize(_size);
    let sigma = LEAF_H / H_PX;
    // Khung hẹp: thu nhỏ đều cả tấm cho mép ngoài còn cách mép khung ≥ MARGIN_PX.
    const halfW = _size.x * 0.5 * s;
    const edge = Math.max(M.slabRight, -M.slabLeft) + GAP;
    const room = halfW - MARGIN_PX * s - edge;
    const need = W_PX * sigma * SPAN_K;
    if (need > room) sigma *= clamp(room / need, 0.5, 1);
    G.sigma = sigma;
    G.s = s;
    G.vh = Math.max(1, _size.y);
    G.yBase = 0;
    G.slabL = M.slabLeft;
    G.slabR = M.slabRight;
    G.xL = M.slabLeft - GAP;
    G.xR = M.slabRight + GAP;
    return true;
  }

  /**
   * Góc quay Y của tấm theo độ mở o (0 gập sau → 1 mở chữ V). Tấm phải: +90° (mép ngoài ra
   * SAU mặt bia) → −OPEN (mép ngoài chìa ra TRƯỚC, về phía người xem). Tấm trái đối xứng gương.
   */
  const angleOf = (leaf, o) => leaf.side * (FOLD - o * (FOLD + OPEN));

  function setText(leaf, on) {
    if (leaf.text === on) return;
    leaf.text = on;
    leaf.leaf.classList.toggle('is-text', on);
  }

  const atRest = () =>
    !visible && L.open.v === 0 && R.open.v === 0 && L.fade.v === 0 && R.fade.v === 0;

  const api = {
    /**
     * Nửa bề ngang chiếm chỗ (đơn vị mặt phẳng bia, từ trục bia) khi hai tấm mở hết — stage dùng để kẹp
     * zoom khi hover cho tấm không tràn khỏi khung.
     */
    extent() {
      if (!measureGeom(null, Gx)) return null;
      return Math.max(Gx.xR, -Gx.xL) + W_PX * Gx.sigma * SPAN_K;
    },
    show(entry) {
      const next = ctx.plane();
      // Tấm còn đang gập trên một tấm bia KHÁC (vừa chuyển cảnh) → gập nốt trên bia cũ, xong mới mở ở đây.
      if (plane && next && plane !== next && !atRest()) {
        queued = { entry };
        return;
      }
      queued = null;
      plane = next;
      if (entry && entry !== filled) fill(entry);
      else if (pending && pending !== filled) fill(pending);
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
      if (!visible) return;
      visible = false;
      for (const lf of leaves) {
        lf.leaf.setAttribute('aria-hidden', 'true');
        setText(lf, false); // CSS: chữ mờ cùng lúc trong TEXT_OUT_S
      }
      if (rm) {
        for (const lf of leaves) aim(lf.fade, 0, clock, RM_OUT_S, linear);
        return;
      }
      for (const lf of leaves) aim(lf.open, 0, clock, CLOSE_S, easeIn, TEXT_OUT_S);
    },

    setEntry(entry) {
      if (!entry) return;
      if (atRest()) {
        pending = null;
        if (entry !== filled) fill(entry);
      } else pending = entry; // đang gập dở: giữ chữ cũ tới khi gập xong
    },

    isVisible: () => visible || !!queued,

    update(dt) {
      // Đang chờ mở trên bia mới mà tấm bia cũ đã rời cảnh hẳn (chuyển cảnh xong / giảm chuyển động): tấm
      // đang gập theo nó đã vô hình → coi như gập xong, không bắt người xem chờ phần gập không ai thấy.
      if (queued && plane && ctx.opacity && ctx.opacity(plane) <= 0) {
        for (const lf of leaves) {
          snap(lf.open, 0);
          snap(lf.fade, 0);
          setText(lf, false);
        }
        rig.visible = false;
      }
      // Rẻ khi đang ẩn: không tween, không chạm DOM.
      if (!rig.visible && atRest()) {
        if (pending) {
          if (pending !== filled) fill(pending);
          pending = null;
        }
        plane = null;
        if (queued) {
          const q = queued;
          queued = null;
          api.show(q.entry); // tấm đã gập xong trên bia cũ → mở trên bia hiện tại
        }
        if (!visible) return;
      }
      clock += Math.min(0.1, Math.max(0, dt || 0));
      for (const lf of leaves) {
        advance(lf.open, clock);
        advance(lf.fade, clock);
      }
      if (rm && !visible && L.fade.v === 0 && R.fade.v === 0) {
        for (const lf of leaves) snap(lf.open, 0);
      }

      if (visible && !plane) plane = ctx.plane();

      if (!plane || !measureGeom(plane)) {
        rig.visible = false;
        renderedVisible = false;
        return;
      }

      // Chữ vào khi tấm đã mở quá 60%.
      if (visible && !rm) for (const lf of leaves) if (lf.open.v >= TEXT_AT) setText(lf, true);

      // Độ hiện theo góc + độ mờ của CHÍNH khay mang tấm (chuyển cảnh 'fade' làm mờ cả khay cũ).
      const af = ctx.angleFade(plane) * (ctx.opacity ? ctx.opacity(plane) : 1);
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
          lf.anchor.style.opacity = String(q); // opacity trên chính phần tử CSS3DObject là an toàn
        }
        if (q > 0) any = true;
      }

      rig.visible = any;
      if (any) {
        // Trong update() ma trận thế giới của mọi mặt phẳng đã mới cho khung này.
        rig.matrix.copy(plane.matrixWorld);
        rig.matrixWorldNeedsUpdate = true;
      }
      // Đo tràn đoạn mô tả MỘT lần mỗi nội dung, sau khi lớp CSS3D đã vẽ tấm (display ≠ none).
      if (!measured && renderedVisible && descEl) {
        measured = true;
        descEl.classList.toggle('is-clamped', descEl.scrollHeight > descEl.clientHeight + 1);
      }
      renderedVisible = any;

      if (!any && atRest()) plane = null;
    },

    hitTest(x, y) {
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
        // Mép trong kéo tới tận mép phiến bia: rê từ bia sang tấm không rơi vào khe bản lề.
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
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      // 'removed' chỉ bắn cho đúng đối tượng bị gỡ → gỡ từng tấm trước, rồi mới gỡ rig.
      for (const lf of leaves) rig.remove(lf.obj);
      ctx.css3d.scene.remove(rig);
    },
  };

  if (import.meta.env.DEV) {
    /** DEV: vị trí thế giới (bản lề + mép ngoài, mép trên) + góc gập + độ đục từng tấm — ghi vết chuyển cảnh. */
    api.debugState = () => {
      if (!rig.visible) return { visible, queued: !!queued, leaves: null };
      rig.updateMatrixWorld(true);
      const out = [];
      for (const lf of leaves) {
        const W = W_PX; // px thiết kế: obj.scale = sigma → mép ngoài ở ±W trong toạ độ của tấm
        const k = rig.parent?.scale.x || 1; // lớp CSS3D vẽ trong thế giới phóng k lần (css3d.js) → đổi về đơn vị thế giới
        const hinge = new THREE.Vector3().setFromMatrixPosition(lf.obj.matrixWorld).divideScalar(k);
        const outer = new THREE.Vector3(lf.side * W, 0, 0).applyMatrix4(lf.obj.matrixWorld).divideScalar(k);
        out.push({
          side: lf.side < 0 ? 'L' : 'R',
          open: +lf.open.v.toFixed(4),
          deg: +THREE.MathUtils.radToDeg(angleOf(lf, rm ? 1 : lf.open.v)).toFixed(2),
          alpha: +lf.alpha.toFixed(3),
          hinge: hinge.toArray().map((v) => +v.toFixed(4)),
          outer: outer.toArray().map((v) => +v.toFixed(4)),
        });
      }
      return { visible, queued: !!queued, sameAsLive: plane === ctx.plane(), leaves: out };
    };
  }
  return api;
}
