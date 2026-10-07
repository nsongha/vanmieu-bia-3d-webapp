// Tên người đỗ trên THÂN BIA (settings.cinemaNames) — một "rig" cho mỗi khay chuyển cảnh.
//
// r72 — KHẮC CHÌM trên mặt đá (người dùng: "redesign phần đề danh trên thân bia khi chưa focus" — không thích cột chữ trắng
// nổi lơ lửng + nhãn "TIẾN SĨ" lặp lại, chạy như băng chữ). Nay:
//   · chữ NẰM trên mặt đá (sát mặt, không còn khe nổi), màu như nét khắc đã tô (mực đậm trên đá sáng · ngà trên đá tối, trộn
//     liên tục theo độ sáng đá — setStyle) + bóng khắc: mép phía đèn tối, mép kia bắt sáng (text-shadow theo hướng đèn key
//     chiếu lên mặt bia, tính mỗi khung trong update — nhìn như chữ lõm vào đá, không phải dán lên);
//   · bố cục theo văn bia: DẢI TIÊU ĐỀ trên cùng (tên giáp — "ĐỆ NHẤT GIÁP · TIẾN SĨ CẬP ĐỆ", giữa hai chỉ khắc), dưới là
//     tên xếp CỘT lặng, chữ có chân (Playfair); tam khôi mỗi người một danh hiệu nhỏ phía trên tên, chữ lớn hơn;
//   · r80 (người dùng): người ĐỖ ĐẦU (Trạng nguyên — không có tam khôi thì tên đầu của giáp cao nhất) chữ LỚN, ĐỨNG YÊN ở đầu ô
//     chữ (không hover, không đổi trang); những người còn lại CUỘN DỌC liên tục, chậm, lặp vòng liền mạch (hai bản danh sách nối
//     nhau) trong ô dưới tên đầu, cùng kiểu chữ khắc, dải tên giáp xen giữa. Cuộn = hoạt ảnh CSS transform trên compositor (không
//     vẽ lại WebGL, không JS mỗi khung); danh sách vừa ô thì đứng yên. Giảm chuyển động: danh sách tĩnh (tên đầu + các tên vừa ô).
//     Tên KHÔNG còn tắt lúc focus; vẫn mờ lúc quét bản dập và lúc đọc toàn văn (stage).
//   · r81: cả lớp tên nằm gọn trong Ô CHỮ của chính tấm bia (đo trên mô hình — tools/measure-face-fields.mjs + sửa tay, xem
//     nameField): trên = đường khắc dưới dải tiêu đề, trái / phải = hai đường dọc khung trong, dưới = đáy khung trong (không thấp
//     hơn đỉnh đầu rùa). Khối đầu ô (danh hiệu + tên đỗ đầu, thu nhỏ cho vừa bề ngang) ở trên cùng; phần cuộn là phần còn lại của
//     ô, hai dải mờ trên / dưới nằm TRONG ô.
//   · r90 (người dùng — r89: nhãn giáp dọc hai lề / chỉ khắc ranh giới trông rối, ảnh chụp lẫn hai giáp): KHÔNG nhãn dọc, KHÔNG chỉ
//     khắc, KHÔNG nhãn trong cột. Một Ô TÊN GIÁP cố định ở đầu vùng cuộn (dưới khung khắc của người đỗ đầu) — chỉ tên giáp ngắn
//     ("ĐỆ NHẤT GIÁP" / "ĐỆ NHỊ GIÁP" / "ĐỆ TAM GIÁP"), chữ hoa nhỏ giãn. MỖI LÚC MỘT GIÁP: tên của giáp vào từ đáy vùng cuộn, cuộn lên
//     chậm (ROLL_PX_S) tới khi tên cuối đã ra hết qua dải mờ trên; vùng trống → ô tên giáp mờ chéo (~0,3 s) sang giáp kế, danh sách giáp
//     đó vào từ đáy; hết giáp cuối thì về giáp đầu. Giáp ngắn (vừa vùng cuộn): trồi lên rồi dừng (giữa vùng), đứng ~1,5 s mỗi tên
//     (4–10 s), rồi trôi lên ra hết mới đổi. Bia một giáp: như vậy với một giáp — ô tên giáp không đổi, danh sách lặp với một quãng
//     trống ngắn. Người đỗ đầu (khung khắc) không thuộc vùng cuộn: giáp của người đó bắt đầu từ người kế; giáp chỉ có người đó thì
//     bỏ qua. Toàn bộ lịch tính trước thành keyframes CSS (một chu kỳ chung — mỗi danh sách giáp một hoạt ảnh dời, mỗi tên giáp một
//     hoạt ảnh độ đục), không JS mỗi khung, không vẽ lại 3D. Giảm chuyển động: danh sách đứng yên, đổi giáp mỗi ~8 s bằng mờ chéo.
//     Khối đỗ đầu (danh hiệu + tên) trong KHUNG KHẮC hai nét (r89). Danh hiệu bậc (Bảng nhãn, Thám hoa, Hoàng giáp…) nhỏ trên tên
//     trong cột; tên dài hơn cột thì thu nhỏ cho vừa.
// Mỗi rig bám mặt phẳng của khay mình → tên đi cùng tấm bia qua mọi hiệu ứng chuyển cảnh, mờ theo độ đục của khay × góc nhìn.
// DOM chỉ dựng lại khi đổi bia / đổi cỡ khung; mỗi khung chỉ ghi ma trận (renderer CSS3D tự bỏ qua khi không đổi), độ mờ và
// hướng bóng khắc khi đổi đáng kể. Trang đổi bằng hẹn giờ + CSS (compositor), chỉ chạy khi rig đang hiện.
import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { getLaureates } from '../../data/laureates.js';
import { ensureFont, FONT } from '../../core/fonts.js';

const INCISE_GAP = 0.0015; // chữ nằm SÁT mặt đá (đơn vị mặt phẳng, bia cao 1) — chỉ đủ để không z-fight trong CSS3D
const INSET = 0.12; // lề ngang so với bề ngang phiến bia (mỗi bên)
const ARCH_CLEAR = 0.08; // chừa dưới vai vòm
const BASE_CLEAR = 0.03; // chừa trên lưng rùa
const ROLL_PX_S = 15; // r80: tốc độ cuộn (px thiết kế / s) — chậm, đọc kịp
// r90 → r91: lịch theo giáp (s). Mỗi giáp hai pha: VÀO — các dòng đang thấy được (dòng = cụm danh hiệu + tên) trồi lên chỗ nghỉ lệch
// nhịp IN_STAGGER_S, mỗi dòng IN_ROW_S (quãng IN_ROW_D × cao dòng, hiện dần, chậm dần); đứng IN_HOLD_S (giáp ngắn — vừa vùng: 1,5 s
// mỗi tên, 4–10 s) — rồi CUỘN đều ROLL_PX_S tới khi dòng cuối ra hết qua mép trên (dòng vào từ đáy lúc cuộn không có hoạt ảnh vào).
// Vùng trống → mờ chéo tên giáp ROLL_XF_S → giáp kế VÀO ngay (quãng trống = đúng lúc đổi tên giáp). Giảm chuyển động: đứng yên, mỗi
// giáp RM_SLOT_S. Dòng đầu nghỉ ở dưới hẳn dải mờ trên (ROLL_TOP_FADE) — đọc rõ trước khi cuộn vào dải mờ.
const ROLL_XF_S = 0.3;
const IN_ROW_S = 0.7;
const IN_STAGGER_S = 0.1;
const IN_ROW_D = 0.7;
const IN_HOLD_S = 1.2;
const IN_EASE = 'cubic-bezier(.2,.7,.3,1)';
const HOLD_PER_NAME_S = 1.5;
const HOLD_MIN_S = 4;
const HOLD_MAX_S = 10;
const RM_SLOT_S = 8;
const ROLL_TOP_FADE = 0.09; // = mask .cin-nm__roll (info.css)
const PADY = 12; // trước lượt: danh sách nằm hẳn dưới đáy vùng cuộn ngần này (px thiết kế)
const IN_S = 1.6; // thời gian khắc hiện (các tên lệch nhịp trong khoảng này)
const OUT_S = 0.9;
// danh hiệu tam khôi (kể cả "Đệ nhị danh" / "Đệ tam danh" của bia chép theo thứ bậc) — hiện nhỏ trên tên
const TAM_KHOI = /^(Trạng nguyên|Bảng nhãn|Thám hoa|Thám hoa lang|Đình nguyên|Hội nguyên|Đệ (nhất|nhị|tam) danh)$/iu;
// r88: danh hiệu BẬC hiện trên tên trong danh sách cuộn (tam khôi + Hoàng giáp — không phải "Tiến sĩ" / "Đồng Tiến sĩ" chung của giáp)
const RANK = /^(Trạng nguyên|Bảng nhãn|Thám hoa|Thám hoa lang|Đình nguyên|Hội nguyên|Hoàng giáp|Đệ (nhất|nhị|tam) danh)$/iu;
let rigSeq = 0;
// r72: chữ khắc dùng gần trọn ô chữ của phiến (lề trên / dưới hẹp hơn ô đo độ sáng — nameField)
const CARVE_TOP = 0.035;
const CARVE_BASE = 0.012;

// r81: lề trong ô chữ mặt bia (phần của bề ngang / chiều cao ô)
const FIELD_PAD_X = 0.05;
const FIELD_PAD_TOP = 0.02;
const FIELD_PAD_BOTTOM = 0.025;

/**
 * Ô tên trong phiến bia (plane-local = toạ độ mô hình x, y). r81: có ô chữ đo trên mô hình (m.field — src/data/index.js
 * faceFieldOf: dưới dải tiêu đề, trong khung trong, trên đỉnh đầu rùa) → ô đó trừ lề; không có → ước lượng cũ: lề ngang INSET mỗi
 * bên, từ ngay trên lưng rùa tới dưới vai vòm. Dùng chung cho rig và cho phép đo độ sáng mặt đá của sân khấu.
 */
export function nameField(m) {
  if (m.field) {
    const f = m.field;
    const dx = (f.x1 - f.x0) * FIELD_PAD_X;
    const dy = f.y1 - f.y0;
    return { x0: f.x0 + dx, x1: f.x1 - dx, y0: f.y0 + dy * FIELD_PAD_BOTTOM, y1: f.y1 - dy * FIELD_PAD_TOP, measured: true };
  }
  const sw = m.slabRight - m.slabLeft;
  return {
    x0: m.slabLeft + sw * INSET,
    x1: m.slabRight - sw * INSET,
    y0: m.bandBottom + BASE_CLEAR,
    y1: m.bandTop - ARCH_CLEAR,
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * @param {{css3d:{scene:THREE.Scene, ensure():void}, planeEps:number}} opts
 *   planeEps: gốc mặt phẳng nằm trước mặt đá ngần này (plane-local z của mặt đá = −planeEps)
 */
export function createNamesRig({ css3d, planeEps }) {
  const rigId = ++rigSeq;
  const rig = new THREE.Group();
  rig.matrixAutoUpdate = false;
  rig.visible = false;
  rig.userData.cinemaOwned = true; // lớp dọn dẹp của các kiểu hiện thông tin không được gỡ rig này

  const anchor = document.createElement('div');
  anchor.style.width = '0px';
  anchor.style.height = '0px';
  anchor.style.pointerEvents = 'none';
  anchor.setAttribute('aria-hidden', 'true');
  const box = document.createElement('div');
  box.className = 'cin-nm';
  anchor.appendChild(box);
  const obj = new CSS3DObject(anchor);
  obj.element.style.pointerEvents = 'none';
  rig.add(obj);

  let built = false;
  let attached = false;
  let tone = 'light'; // 'light' = nét khắc sáng (đá tối) · 'ink' = nét khắc mực (đá sáng)
  let styleInk = -1;
  let lastOp = -1;
  let lastLx = 99;
  let lastLy = 99;
  let x0 = 0;
  let y1 = 0;
  const _inv = new THREE.Matrix4();
  const _l = new THREE.Vector3();

  // ---- r80: cuộn dọc (hoạt ảnh CSS) — chạy khi rig hiện, dừng khi ẩn
  let running = false;
  let rollOn = false; // danh sách dài hơn ô → cuộn
  let needMeasure = false; // đo khi phần tử đã gắn + hiện (CSS3D chỉ gắn phần tử ở lượt vẽ; ẩn = display none → cao 0)
  let sNow = 0; // đơn vị mặt phẳng / px CSS của lần dựng gần nhất
  let plan = null; // r90 DEV: lịch cuộn theo giáp (roll getter)
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setRunning(on) {
    if (on === running) return;
    running = on;
    box.classList.toggle('is-run', on && rollOn);
  }
  /**
   * r81: khối đầu ô (dòng danh hiệu / tên giáp + tên đỗ đầu, mỗi thứ một dòng) dài hơn bề ngang ô thì thu nhỏ chữ cho vừa hẳn —
   * ô hẹp vẫn nằm gọn trong khung. So với bề ngang Ô (phần tử dòng có thể rộng hơn ô: flex căn giữa, không xuống dòng).
   */
  function fitHead() {
    const avail = box.clientWidth - 36; // r89: trừ đệm + khung khắc hai nét của khối đầu
    for (const el of box.querySelectorAll('.cin-nm__hn, .cin-nm__ht, .cin-nm__hb')) {
      el.style.fontSize = '';
      for (let k = 0; k < 3; k++) {
        const need = el.scrollWidth;
        if (!(need > avail + 0.5)) break;
        const fs = parseFloat(getComputedStyle(el).fontSize) || 24;
        el.style.fontSize = `${Math.max(6, (fs * avail) / need - 0.4).toFixed(2)}px`;
      }
    }
  }
  /** r90: đo vùng cuộn + chiều cao từng danh sách giáp → lịch cuộn (keyframes). */
  function measureRoll() {
    if (!box.isConnected || !(box.clientWidth > 0)) {
      needMeasure = true; // chưa bố cục được (chưa gắn / đang ẩn) → đo lại ở khung hiện kế tiếp
      return;
    }
    // khối đầu ô trước — cỡ chữ của nó quyết định chiều cao còn lại cho phần cuộn
    fitHead();
    const roll = box.querySelector('.cin-nm__roll');
    const grps = [...box.querySelectorAll('.cin-nm__grp')];
    if (!roll || !grps.length) {
      needMeasure = false;
      rollOn = false;
      plan = null;
      box.classList.remove('is-roll', 'is-run');
      return;
    }
    fitNames();
    fitHeader();
    const H = roll.clientHeight;
    const Ls = grps.map((g) => g.offsetHeight);
    if (!(H > 0) || !Ls.every((L) => L > 0)) {
      needMeasure = true;
      return;
    }
    needMeasure = false;
    rollOn = true;
    const wasRoll = box.classList.contains('is-roll');
    plan = schedule(grps, Ls, H);
    // keyframes mới → khởi động lại mọi hoạt ảnh CÙNG LÚC (cùng lượt tính kiểu — chung một mốc bắt đầu)
    if (wasRoll) {
      box.classList.remove('is-roll');
      void box.offsetWidth;
    }
    box.classList.toggle('is-roll', rollOn);
    box.classList.toggle('is-run', running && rollOn);
  }
  /**
   * r91: lịch một chu kỳ (s) — giáp k: VÀO từ s_k (danh sách đặt ở chỗ nghỉ y0, các dòng đang thấy trồi lên lệch nhịp), đứng, CUỘN tới
   * e_k (dòng cuối vừa ra khỏi mép trên); mờ chéo tên giáp [e_k, e_k + ROLL_XF_S]; giáp k + 1 VÀO ở s_{k+1} = e_k + ROLL_XF_S. Viết
   * keyframes: mỗi danh sách giáp một hoạt ảnh dời (ẩn dưới đáy trước lượt), mỗi dòng VÀO một hoạt ảnh (độ đục + dời ngắn), mỗi tên
   * giáp một hoạt ảnh độ đục. Giảm chuyển động: danh sách đứng yên ở y0, mỗi giáp RM_SLOT_S, mờ chéo cả danh sách lẫn tên giáp.
   */
  function schedule(grps, Ls, H) {
    const kf = box.querySelector('.cin-nm__kf');
    const labs = [...box.querySelectorAll('.cin-nm__ghl')];
    const m = grps.length;
    const y0 = Math.ceil(H * ROLL_TOP_FADE) + 2; // dòng đầu nghỉ dưới hẳn dải mờ trên
    const groups = [];
    let t = 0;
    for (const [k, g] of grps.entries()) {
      const rows = [...g.querySelectorAll(':scope > .cin-nm__it')];
      const L = Ls[k];
      // dòng VÀO: mọi dòng có phần nằm trong vùng khi danh sách ở chỗ nghỉ
      const inRows = rows.filter((li) => y0 + li.offsetTop < H);
      const n = rows.length;
      const fits = y0 + L <= H;
      if (reduce) {
        groups.push({ k, s: t, e: t + RM_SLOT_S - ROLL_XF_S, L, fits, n, nIn: 0, y0 });
        t += RM_SLOT_S;
        continue;
      }
      const st = inRows.length > 1 ? Math.min(IN_STAGGER_S, 0.7 / (inRows.length - 1)) : 0;
      const inDur = IN_ROW_S + st * Math.max(0, inRows.length - 1);
      const hold = fits ? Math.min(HOLD_MAX_S, Math.max(HOLD_MIN_S, HOLD_PER_NAME_S * n)) : IN_HOLD_S;
      const s0 = t;
      const c0 = s0 + inDur + hold; // bắt đầu cuộn
      const e0 = c0 + (y0 + L) / ROLL_PX_S; // dòng cuối vừa ra khỏi mép trên
      groups.push({ k, s: s0, inEnd: s0 + inDur, c: c0, e: e0, L, fits, n, nIn: inRows.length, st, y0, rows, inRows });
      t = e0 + ROLL_XF_S;
    }
    const T = t;
    const pc = (x) => `${((Math.min(T, Math.max(0, x)) / T) * 100).toFixed(4)}%`;
    const tf = (y) => `transform:translate3d(0,${y.toFixed(1)}px,0)`;
    const E = 1e-3;
    let css = '';
    grps.forEach((g, k) => {
      const G = groups[k];
      const name = `cin-nm-g-${rigId}-${k}`;
      for (const li of g.querySelectorAll(':scope > .cin-nm__it')) li.style.animationName = '';
      if (reduce) {
        g.style.transform = `translate3d(0,${G.y0}px,0)`;
        if (m === 1) {
          g.style.animationName = 'none';
          return;
        }
        css += `@keyframes ${name}{${opacityFrames(G.s, G.e, T, k === 0)}}`;
        g.style.animationName = name;
        return;
      }
      g.style.transform = '';
      // danh sách: ẩn dưới đáy → (s_k) chỗ nghỉ → đứng → cuộn đều → (e_k) ra hết qua mép trên, ở đó tới hết chu kỳ
      let body = G.s > 0 ? `0%{${tf(H + PADY)}}${pc(G.s - E)}{${tf(H + PADY)}}` : '';
      body += `${pc(G.s)}{${tf(G.y0)}}${pc(G.c)}{${tf(G.y0)}}${pc(G.e)}{${tf(-G.L)}}`;
      if (G.e < T) body += `100%{${tf(-G.L)}}`;
      css += `@keyframes ${name}{${body}}`;
      g.style.animationName = name;
      // dòng VÀO: lệch nhịp, quãng ngắn, hiện dần, chậm dần (ngoài lượt: ẩn sẵn — danh sách đang ở ngoài vùng)
      G.inRows.forEach((li, i) => {
        const a = G.s + i * G.st;
        const d = Math.round(IN_ROW_D * li.offsetHeight);
        const rn = `cin-nm-r-${rigId}-${k}-${i}`;
        const hid = `opacity:0;transform:translate3d(0,${d}px,0)`;
        const vis = 'opacity:1;transform:none';
        let b = `0%{${hid}}`;
        b += `${pc(a)}{${hid};animation-timing-function:${IN_EASE}}${pc(a + IN_ROW_S)}{${vis}}100%{${vis}}`;
        css += `@keyframes ${rn}{${b}}`;
        li.style.animationName = rn;
      });
    });
    labs.forEach((el, k) => {
      const G = groups[k];
      if (m === 1 || !G) {
        el.style.animationName = 'none';
        el.style.opacity = '';
        return;
      }
      const name = `cin-nm-h-${rigId}-${k}`;
      // tên giáp k: hiện từ s_k tới e_k, mờ chéo với tên giáp kế đúng lúc vùng cuộn trống
      css += `@keyframes ${name}{${opacityFrames(G.s, G.e, T, k === 0)}}`;
      el.style.opacity = '';
      el.style.animationName = name;
    });
    if (kf) kf.textContent = css;
    box.style.setProperty('--cyc', `${T.toFixed(3)}s`);
    const r3 = (v) => (v == null ? v : +v.toFixed(3));
    const switches = m > 1 ? groups.map((G) => [r3(G.e), r3(G.e + ROLL_XF_S)]) : [];
    return { T: r3(T), H, y0, m, groups: groups.map((G) => ({ k: G.k, s: r3(G.s), inEnd: r3(G.inEnd), c: r3(G.c), e: r3(G.e), L: G.L, fits: G.fits, n: G.n, nIn: G.nIn })), switches, reduce };
    /** độ đục 1 trên [a, b], mờ vào ROLL_XF_S trước a (giáp đầu: cuối chu kỳ), mờ ra ROLL_XF_S sau b. */
    function opacityFrames(a, b, T, first) {
      const P = (x) => `${((Math.min(T, Math.max(0, x)) / T) * 100).toFixed(4)}%`;
      if (first) return `0%{opacity:1}${P(b)}{opacity:1}${P(b + ROLL_XF_S)}{opacity:0}${P(T - ROLL_XF_S)}{opacity:0}100%{opacity:1}`;
      return `0%{opacity:0}${P(a - ROLL_XF_S)}{opacity:0}${P(a)}{opacity:1}${P(b)}{opacity:1}${P(b + ROLL_XF_S)}{opacity:0}100%{opacity:0}`;
    }
  }
  /**
   * r91: ô tên giáp — chỉ khắc ngắn hai bên (bằng nhau, giữa chiều cao chữ hoa), cùng một độ dài cho mọi tên giáp (không nhảy khi đổi);
   * cả ô vừa bề ngang ô chữ (chỉ ngắn lại trước, chữ nhỏ lại sau cùng).
   */
  function fitHeader() {
    const labs = [...box.querySelectorAll('.cin-nm__ghl')];
    if (!labs.length) return;
    const st = box.style;
    st.removeProperty('--gh-fs');
    const avail = box.clientWidth - 8;
    const fs0 = parseFloat(getComputedStyle(labs[0]).fontSize) || 12;
    let fs = fs0;
    let rule = 0;
    for (let it = 0; it < 4; it++) {
      const gap = 0.55 * fs;
      const tw = Math.max(...labs.map((el) => el.querySelector('.cin-nm__ght')?.offsetWidth ?? 0));
      rule = Math.min(2.6 * fs, (avail - tw - 2 * gap) / 2);
      if (rule >= 0.9 * fs) break;
      fs = Math.max(8, fs * 0.92);
      st.setProperty('--gh-fs', `${fs.toFixed(2)}px`);
    }
    st.setProperty('--ghr', `${Math.max(4, rule).toFixed(1)}px`);
    // chỉ giữa chiều cao CHỮ HOA (không phải giữa hộp dòng): đo chữ bằng canvas
    try {
      const cs = getComputedStyle(labs[0]);
      const c = (fitHeader.cv ??= document.createElement('canvas')).getContext('2d');
      c.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      const mE = c.measureText('E');
      const a = mE.fontBoundingBoxAscent;
      const d = mE.fontBoundingBoxDescent;
      const lh = parseFloat(cs.lineHeight) || fs * 1.2;
      const base = (lh - (a + d)) / 2 + a; // đường chân chữ, từ đỉnh hộp dòng
      const dy = base - mE.actualBoundingBoxAscent / 2 - lh / 2;
      if (Number.isFinite(dy)) st.setProperty('--ghdy', `${dy.toFixed(2)}px`);
    } catch {
      /* không đo được: giữa hộp dòng */
    }
  }
  /** r89: tên dài hơn cột thì thu nhỏ chữ cho vừa (như khối đầu). */
  function fitNames() {
    // đo theo DÒNG (li — overflow hidden, ellipsis): dòng tràn thì thu nhỏ chữ trong dòng đó theo tỉ lệ
    for (const li of box.querySelectorAll('.cin-nm__grp .cin-nm__it')) {
      const parts = [...li.querySelectorAll('.cin-nm__rn, .cin-nm__rt')];
      for (const el of parts) el.style.fontSize = '';
      const avail = li.clientWidth - 2;
      const need = li.scrollWidth;
      if (!(avail > 0) || !(need > avail + 0.5)) continue;
      const tam = li.classList.contains('cin-nm__it--tam');
      for (const el of parts) {
        // dòng tam khôi: danh hiệu + tên là hai khối xếp dọc — thu từng khối theo phần tràn của chính nó; dòng thường: theo dòng
        const k = tam ? (el.clientWidth - 1) / Math.max(el.clientWidth - 1, el.scrollWidth) : avail / need;
        if (k < 1) {
          const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
          el.style.fontSize = `${Math.max(6, fs * k - 0.3).toFixed(2)}px`;
        }
      }
    }
  }

  function html(data) {
    // bia chưa có dữ liệu → một dòng "Chờ dữ liệu" lặng lẽ giữa ô (không tên mẫu, không nhãn rỗng)
    if (data.pending) return '<p class="cin-nm__flag cin-nm__flag--pending">Chờ dữ liệu</p>';
    const all = [data.top, ...data.rest].filter(Boolean);
    const top = all[0];
    if (!top) return '';
    // đỗ đầu: danh hiệu tam khôi (Trạng nguyên…) nếu có, không thì dải tên giáp của người đó ("Đệ tam giáp · Đồng Tiến sĩ…")
    const tam = TAM_KHOI.test(top.title ?? '');
    const [bt, bl] = String(top.band ?? (tam ? '' : top.title ?? '')).split(' · ');
    const head =
      '<header class="cin-nm__head">' +
      // (không tam khôi: chỉ tên giáp — "Đệ tam giáp" — một dòng; danh hiệu của giáp có ở dải đầu danh sách cuộn)
      (tam ? `<span class="cin-nm__ht">${esc(top.title)}</span>` : bt ? `<span class="cin-nm__hb">${esc(bt)}</span>` : '') +
      `<span class="cin-nm__hn">${esc(top.name)}</span></header>`;
    // phần còn lại: nhóm theo giáp (r90: mỗi lúc một giáp — ô tên giáp cố định đầu vùng cuộn; giáp chỉ có người đỗ đầu thì bỏ qua)
    const rest = all.slice(1);
    const groups = [];
    for (const p of rest) {
      const b = p.band ?? '';
      if (!groups.length || groups[groups.length - 1].band !== b) groups.push({ band: b, people: [] });
      groups[groups.length - 1].people.push(p);
    }
    let lists = '';
    let labs = '';
    let j = 0;
    groups.forEach((g, k) => {
      lists += `<ol class="cin-nm__grp" data-g="${k}">`;
      for (const p of g.people) {
        lists += RANK.test(p.title ?? '')
          ? `<li class="cin-nm__it cin-nm__it--tam" data-b="${k}" style="--j:${j}"><span class="cin-nm__rt">${esc(p.title)}</span><span class="cin-nm__rn">${esc(p.name)}</span></li>`
          : `<li class="cin-nm__it" data-b="${k}" style="--j:${j}"><span class="cin-nm__rn">${esc(p.name)}</span></li>`;
        j++;
      }
      lists += '</ol>';
      const short = String(g.band ?? '').split(' · ')[0].trim();
      labs += `<span class="cin-nm__ghl" data-g="${k}"${k ? ' aria-hidden="true"' : ''}><span class="cin-nm__ght">${esc(short)}</span></span>`;
    });
    // r90b (người dùng: bia một giáp mà tên giáp lặp đúng nhãn của khung khắc — thừa): một giáp + tên giáp trùng nhãn khung (không kể
    // hoa / dấu / khoảng trắng) → không ô tên giáp, danh sách cuộn ngay dưới khung khắc (cùng vòng lặp)
    const key = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/\s+/g, '').toLowerCase();
    const frameLabel = tam ? top.title : bt;
    const noGh = groups.length === 1 && !!frameLabel && key(String(groups[0].band ?? '').split(' · ')[0]) === key(frameLabel);
    const roll = groups.length
      ? `<div class="cin-nm__rollw${groups.length === 1 ? ' is-single' : ''}${noGh ? ' no-gh' : ''}">${noGh ? '' : `<div class="cin-nm__gh">${labs}</div>`}<div class="cin-nm__roll"><div class="cin-nm__seq">${lists}</div></div><style class="cin-nm__kf"></style></div>`
      : '';
    return head + roll + (data.sample ? '<p class="cin-nm__flag">Tên mẫu · Chờ dữ liệu</p>' : '');
  }

  return {
    /**
     * Dựng nội dung cho một bia (gọi khi bia vào khay, khi đổi cỡ khung, khi bật cài đặt).
     * @param {object} entry mục bia
     * @param {{slabLeft:number, slabRight:number, bandTop:number, bandBottom:number}} m SteleMetrics
     * @param {number} s đơn vị mặt phẳng / px CSS ở khung mặc định
     */
    build(entry, m, s) {
      if (!entry || !m || !(s > 0)) return;
      ensureFont(FONT.playfair);
      ensureFont(FONT.beVietnam);
      if (!attached) {
        css3d.ensure();
        css3d.scene.add(rig);
        attached = true;
      }
      const F = nameField(m);
      x0 = F.x0;
      y1 = F.measured ? F.y1 : m.bandTop - CARVE_TOP;
      const W = Math.max(60, (F.x1 - F.x0) / s);
      const H = Math.max(60, (y1 - (F.measured ? F.y0 : m.bandBottom + CARVE_BASE)) / s);
      sNow = s;
      // Cỡ chữ theo bề ngang ô, có SÀN: mọi dòng ≥ 11 px CSS (≈ 1 px màn hình ở khung mặc định).
      const k = W / 220;
      const f = {
        bt: clamp(11 * k, 11, 12.5), // dải tiêu đề: tên giáp (chữ hoa giãn)
        bl: clamp(13 * k, 12, 15), // … danh hiệu của giáp (nghiêng)
        rn: clamp(16 * k, 14, 19), // tên
        tn: clamp(21.5 * k, 17, 26), // tên tam khôi
        rt: clamp(12.5 * k, 11.5, 14), // danh hiệu tam khôi (nghiêng)
        fl: 11,
      };
      // r80: tên đỗ đầu — chữ lớn đứng yên đầu ô
      // (ô thấp — vd. 1478: mặt chữ ngắn so với bề ngang — thì nhỏ lại để phần cuộn còn chỗ)
      f.hn = clamp(Math.min(30 * k, H * 0.17), 19, 36);
      // r91: tên giáp (ô cố định) lớn hơn r90 (11 → ~13 px thiết kế): cỡ ≈ 0,88 × tên (chữ hoa ≈ 0,6 × cỡ tên — tên tam khôi lớn hơn:
      // ≈ 0,65 ×), cách khung khắc ~0,8 dòng tên
      f.gh = clamp(f.rn * 0.88, 12.5, 15);
      f.ghgap = Math.round(f.rn * 0.95);
      const row = Math.round(f.rn * 1.75);
      const tamRow = Math.round(f.rt * 1.3 + f.tn * 1.22 + 11);
      const data = getLaureates(entry);
      const st = box.style;
      st.width = `${W.toFixed(1)}px`;
      st.height = `${H.toFixed(1)}px`;
      for (const [kk, v] of Object.entries(f)) st.setProperty(`--${kk}`, `${v.toFixed(2)}px`);
      st.setProperty('--row', `${row}px`);
      st.setProperty('--tamrow', `${tamRow}px`);
      st.setProperty('--in', `${IN_S}s`);
      st.setProperty('--out', `${OUT_S}s`);
      box.classList.toggle('is-ink', tone === 'ink');
      box.classList.toggle('is-rm', reduce);
      if (styleInk >= 0) st.setProperty('--nm-ink', String(styleInk));
      box.innerHTML = html(data);
      box.classList.toggle('is-sample', !!data.sample);
      obj.scale.setScalar(s);
      obj.position.set(x0, y1, INCISE_GAP - planeEps);
      anchor.setAttribute('aria-hidden', data.sample ? 'true' : 'false');
      // cuộn: đo ngay (phần tử đã trong DOM) + đo lại khi phông về (cao dòng đổi)
      needMeasure = true;
      measureRoll();
      document.fonts?.ready?.then(() => {
        if (!built) return;
        needMeasure = true;
        measureRoll();
      });
      if (running) {
        running = false;
        setRunning(true);
      }
      lastOp = -1;
      lastLx = lastLy = 99;
      built = true;
    },

    /**
     * Bảng màu theo độ sáng mặt đá của bia (đo một lần mỗi bia ở sân khấu):
     * 'ink' = nét khắc mực (đá sáng) · 'light' = nét khắc sáng (đá tối).
     */
    setTone(t) {
      tone = t === 'ink' ? 'ink' : 'light';
      box.classList.toggle('is-ink', tone === 'ink');
    },
    get tone() {
      return tone;
    },
    /** Kiểu chữ liên tục theo độ sáng mặt đá ĐANG vẽ: ink 0 = nét sáng … 1 = nét mực. */
    setStyle(ink) {
      const qi = Math.round(clamp(ink, 0, 1) * 50) / 50;
      if (qi === styleInk) return;
      styleInk = qi;
      tone = qi >= 0.5 ? 'ink' : 'light';
      box.style.setProperty('--nm-ink', String(qi));
    },
    get style() {
      return { ink: styleInk };
    },

    /** Gỡ nội dung (tắt cài đặt). */
    clear() {
      built = false;
      rig.visible = false;
      setRunning(false);
      rollOn = false;
      box.innerHTML = '';
    },
    get built() {
      return built;
    },
    /**
     * DEV (r81): bố cục lớp tên trong toạ độ mặt phẳng (= toạ độ mô hình x, y): ô (box), khối tên đỗ đầu (head), vùng cuộn
     * (roll) — đo từ DOM (px thiết kế × đơn vị / px).
     */
    layout() {
      if (!built || !sNow) return null;
      const s = sNow;
      const W = box.clientWidth;
      const H = box.clientHeight;
      const part = (el) => el && { x0, x1: x0 + W * s, y1: y1 - el.offsetTop * s, y0: y1 - (el.offsetTop + el.offsetHeight) * s, px: { top: el.offsetTop, h: el.offsetHeight } };
      return { box: { x0, x1: x0 + W * s, y1, y0: y1 - H * s }, head: part(box.querySelector('.cin-nm__head')), roll: part(box.querySelector('.cin-nm__rollw') ?? box.querySelector('.cin-nm__roll')), s, W, H };
    },
    /** DEV (r80): trạng thái cuộn — có cuộn không, đang chạy, quãng một vòng (px thiết kế), thời gian một vòng. */
    get roll() {
      return { on: rollOn, running: running && rollOn, reduce, plan };
    },

    /**
     * Mỗi khung (sau lượt vẽ WebGL — ma trận đã mới).
     * @param {THREE.Matrix4} planeWorld matrixWorld mặt phẳng của khay
     * @param {number} opacity 0..1 (độ đục khay × góc nhìn × mờ khi focus)
     * @param {THREE.Vector3} keyDir hướng TỚI đèn key (thế giới, đã chuẩn hoá)
     */
    update(planeWorld, opacity, keyDir) {
      const vis = built && opacity > 0.01;
      rig.visible = vis;
      if (vis && needMeasure && box.isConnected) measureRoll();
      setRunning(vis);
      if (!vis) return;
      rig.matrix.copy(planeWorld);
      rig.matrixWorldNeedsUpdate = true;
      // Bóng khắc: hướng đèn key trong hệ toạ độ mặt phẳng (x phải, y lên). Nét lõm: mép PHÍA đèn tối (thành rãnh che), mép
      // kia bắt sáng. Chỉ cần hướng (đơn vị); lượng tử 0,1 để không ghi style mỗi khung.
      _l.copy(keyDir).transformDirection(_inv.copy(planeWorld).invert());
      const len = Math.hypot(_l.x, _l.y) || 1;
      const lx = Math.round((_l.x / len) * 10) / 10;
      const ly = Math.round((-_l.y / len) * 10) / 10; // CSS: y xuống
      if (lx !== lastLx || ly !== lastLy) {
        lastLx = lx;
        lastLy = ly;
        box.style.setProperty('--lx', String(lx));
        box.style.setProperty('--ly', String(ly));
      }
      const q = Math.round(opacity * 50) / 50;
      if (q !== lastOp) {
        lastOp = q;
        anchor.style.opacity = String(q);
      }
    },

    dispose() {
      setRunning(false);
      rig.remove(obj);
      css3d.scene.remove(rig);
      attached = false;
      built = false;
    },
  };
}
