// r71 → r72 — LỚP ĐỌC TOÀN VĂN bia, toàn màn hình (thiết kế "Triển lãm điện ảnh" — người dùng r72: "thích full size thông tin
// của triển lãm điện ảnh … Đề danh chính là phần cuối của toàn văn bia. giữ design full của đề danh bản điện ảnh, tìm cách để
// quick access đến 2 phần này"). Một trang, ba phần theo đúng thứ tự trên bia:
//   thẻ tiêu đề  → BÀI KÝ (các đoạn, chữ hoa thả, hiện lên khi cuộn tới) → LẠC KHOẢN (người soạn / viết / khắc, ngày dựng)
//   → ĐỀ DANH: bảng vàng rộng hết khung (tam khôi chữ lớn, giáp hai / ba thành lưới), vừa một màn 1440×900.
// Truy cập nhanh: MỤC LỤC TRÁI luôn hiện (Bài ký · Lạc khoản · Đề danh — mục đang đọc sáng, chỉ tiến độ chạy qua các mốc) +
// "↑ Đầu trang" hiện khi đã cuộn. Bấm chuột / tay (nhón khi tay ở gần — targets.js, cả khi vòng con trỏ ẩn; nam châm khi
// hiện). "Đọc toàn văn" mở ở đầu; "Xem ĐỀ DANH" / giữ hai ngón trên bia mở thẳng ở Đề danh / đầu (open({at})).
// RÊ VÀO TÊN (Đề danh — chuột hoặc tay): tên sáng vàng, gạch mảnh chạy ra dưới tên, các tên khác lùi nhẹ; một thẻ nhỏ hiện dưới
// tên: danh hiệu đầy đủ + quê; người có tiểu sử (biographies của nguồn) thêm năm sinh–mất, một câu tiểu sử, chức vụ. Tay: tên
// gần điểm tay nhất (có trễ chuyển để không nhảy) được "hút", nở nhẹ.
// r74 (người dùng): đọc = CAMERA TIẾN SÁT MẶT BIA + một TẤM ĐỌC ĐEN TRONG MỜ nằm trên hình chiếu phiến bia (không còn màn tối phủ
// kín): tấm giữa khung, bề ngang theo Đề danh, camera giải khoảng cách để mặt bia chiếu ra rộng hơn tấm (mép bia còn thấy hai
// bên) — ctx.readView (stage/read.js). Cuộn → camera lên / xuống dọc phiến (đầu văn: đỉnh vòm · cuối: sát mai rùa, đầu rùa
// luôn dưới mép tấm), đá trượt sau tấm. Mục lục + chỉ tiến độ + "↑ Đầu trang" ở NGOÀI tấm bên trái, "Đóng" sát góc tấm. Tấm
// hiện trong ~40 % cuối đoạn tiến vào; chữ hiện TỨC THÌ (không mờ dần / trượt từng đoạn). Đóng: tấm tắt ~250 ms, camera lùi
// về khung trước (~1 s), HUD / tấm sơn mài trở lại.
// r75 (thông tin thêm — extras.js): GHI CHÚ BÊN LỀ bên phải ngoài tấm (sidenotes.js), thuật ngữ giải nghĩa gạch chấm trong đoạn
// (rê → thẻ nghĩa), "Những người làm nên tấm bia" cuối Lạc khoản (+ tên còn được ghi ở bia khác — năm bấm được: đóng lớp đọc,
// lướt tới bia đó), danh hiệu trên dòng hạng, tỉ lệ đỗ dưới tiêu đề Đề danh, năm dựng bia ở thẻ tiêu đề, thẻ tiểu sử người soạn,
// thẻ Đề danh có liên kết tới bia khác ("cần đối chiếu"). Một cơ chế "đích nóng" chung cho tên / thuật ngữ / người soạn: chuột
// rê, tay: đích gần nhất trong bán kính riêng từng loại.
// r77 (người dùng): tấm đọc ĐỈNH VÒM (như trán bia — Cài đặt "Độ cong vòm bảng đọc", phẳng … vòm cao), chạy tới mép dưới khung
// (không mép dưới — chữ mờ dần xuống đáy khung); nội dung lùi xuống dưới vòm (không chữ nào bị vòm cắt, cả ở độ cong lớn nhất).
// TẤM ĐI CÙNG MẶT ĐÁ lúc mở / đóng: tấm coi như nằm trên mặt phẳng trước của phiến — mỗi khung của đoạn camera tiến (lùi), dấu
// chân của tấm trên đá chiếu bằng camera thật (ctx.readView.footprint) → biến hình phối cảnh (matrix3d) cho cả tấm; tới nơi thì
// bỏ biến hình (chữ sắc nét). Độ hiện theo cùng tiến độ: vào 30 → 85 % đoạn tiến, ra trong 50 % đầu đoạn lùi. Cuộn: chỉ nhón
// kéo / chuột kéo / bánh xe / phím / mục lục — bỏ tự cuộn theo vị trí tay; ánh vàng mép dưới hiện trong lúc chữ đang cuộn.
// r78 (người dùng: thị sai thật, tấm đọc là vật thể 3D nổi trước bia): MỘT bộ tích phân cuộn (scroll.js) — sân khấu bước nó đúng
// một lần mỗi khung ngay trước khi đặt camera (ctx.readView.setSource) → độ dịch chữ và cao độ camera là hàm của cùng một vị trí.
// Kiểu "Nổi 3D" (Cài đặt "Kiểu bảng đọc", mặc định): tấm + cột ghi chú là MỘT đối tượng CSS3D (lớp CSS3D, chữ DOM sắc) đứng song
// song mặt bia, cách trước mặt đá "Khoảng cách chữ – bia"; cố định trong thế giới — camera xuống thì đỉnh vòm tấm trượt lên và ra
// khỏi khung, tấm và đá trượt khác nhịp (thị sai thật); chữ dịch trong tấm sao cho trên màn đi đúng bằng vị trí cuộn; bóng tấm đổ
// lên mặt đá (sân khấu). Mục lục / Đóng / "Đầu trang" vẫn ở màn (thẻ nền đen trong mờ). Kiểu "Phẳng" = r77 (tấm trên màn).
// Tấm: đen trong mờ, KHÔNG nhoè, KHÔNG viền vàng.
// r82 (người dùng — thay nhịp "tấm theo dấu chân trên đá + độ hiện 30 → 85 %" của r77 / r78): MỞ — trong lúc camera tiến vào,
// tấm đen TRƯỢT LÊN êm từ dưới vào chỗ nghỉ trong phần cuối đoạn camera (Cài đặt "Tấm đọc trượt lên trong", mặc định 58 % cuối),
// ease-out bậc ba dài, tới nơi đúng lúc camera dừng; chữ theo tấm, trễ nhẹ + nhô thêm một đoạn ngắn, hiện dần (thẻ tiêu đề trước,
// thân bài sau); mục lục / Đóng / ghi chú bên lề hiện sau khi tấm tới nơi. ĐÓNG — tấm trượt xuống (bậc ba vào–ra) cùng cửa sổ thời
// gian với camera lùi ra; chữ và các phần bên tắt sớm. Kiểu Nổi 3D: trượt trong chính mặt phẳng tấm (dời đối tượng CSS3D dọc trục
// đứng của bia — vẫn là vật thể 3D trước đá, bóng trượt theo); kiểu Phẳng: dịch trên màn. Đồng hồ chung = tiến độ thời gian của
// đoạn camera (readView.tween) → nhịp co giãn theo hai cài đặt thời gian camera. Đứng yên: không biến hình nào còn lại (Phẳng
// không transform; 3D đúng vị trí nghỉ). Giảm chuyển động: chỉ mờ chéo ngắn theo đoạn camera ngắn, không trượt.
// Móc cho hiệu ứng chữ Hán bay ra / vào bia (việc sau): sự kiện 'reader:open' · 'reader:opened' · 'reader:close' · 'reader:closed'
// (xem emitMotion) + reader.motion().
import { ensureFont, FONT } from '../../../../core/fonts.js';
import { DEFAULTS, EASE_INOUT, EASE_OUT, getSettings, onSettings, readerTiming, TITLE_U, tnum, topt } from '../../../../core/settings.js';
import { readerRect } from '../../read-layout.js';
import { h, nbsp, shortHome, tiersOf, fmtNum, canChiShown, countOf, countText, known, rankOf, steleTitle, unnamed } from './common.js';
import { createOverlay } from './overlay.js';
import { annotate, bioInto, creditsBlock, erectionPhrase, notesOf, noteParts, yearLink } from './extras.js';
import { createSidenotes } from './sidenotes.js';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import './reader.css';

const HAND_R = 96; // px: tay trong bán kính này quanh một tên thì hút tên đó
const HAND_R_TERM = 34; // px: thuật ngữ nằm giữa dòng chữ dày — bán kính nhỏ (đọc bằng tay không bật thẻ liên tục)
const HAND_R_AUTHOR = 48;
const LEAVE_MS = 220; // chuột rời tên có thẻ liên kết: chờ ngần này (đường sang thẻ để bấm liên kết)
const HAND_SWITCH = 26; // px: phải gần tên khác hơn ngần này mới chuyển
const CARD_DELAY = 110; // ms trước khi thẻ chi tiết hiện (rê lướt qua không nháy thẻ)
const TIER_NAME = ['', 'Đệ nhất giáp', 'Đệ nhị giáp', 'Đệ tam giáp'];
const ROLL_TOP = 28; // px: mở / nhảy tới Đề danh → đầu phần cách mép trên TẤM ĐỌC ngần này
const CLOSE_FADE_MS = 250;
// r82: nhịp tấm theo đoạn camera (t = tiến độ THỜI GIAN 0..1 của tween camera; camera đi theo easeInOutCubic(t))
// r84: các nhịp dưới là CÀI ĐẶT (nhóm "Chuyển cảnh toàn văn" — settings.js TRANSITION_SPEC; mặc định = giá trị r82):
//   readerSlideDist (quãng trượt × chiều cao khung — px màn; Nổi 3D: đổi ra đơn vị bia ở độ sâu tấm của khung cuối, mặc định 0,45),
//   readerSlideEase (mở: ease-out · đóng: vào–ra), readerTextLag1 / 2 (chữ theo tấm trễ ngần này quãng trượt — thẻ tiêu đề + dải
//   tên trang / thân bài, 0,10 / 0,20), readerTextRise (px chữ nhô thêm, 30), readerUiInAt (mục lục / Đóng hiện dần từ ngần này
//   đoạn tiến, 0,86), readerOutText / readerOutUi (đóng: chữ / mục lục… tắt hết trong ngần này đầu đoạn lùi, 0,30 / 0,25),
//   readerHoldK (tấm sơn mài + HUD trở lại ở ngần này × thời gian lùi, 0,75)
const SLAB_FADE = 0.35; // mở: nền tấm hiện dần trong ngần này đầu quãng trượt (không bật lên giữa cảnh) — = TITLE_U_CLOUD (settings.js)
const UI_IN_K = 0.18; // mục lục / Đóng hiện dần trong ngần này × thời gian tiến vào (0,3–0,6 s); ghi chú bên lề: khi tấm đã nghỉ
const OUT_FADE_A = 0.5; // đóng: nền tấm mờ dần từ ngần này đoạn lùi, hết đúng lúc camera dừng
const RM_FADE_MS = 200; // giảm chuyển động (không có đoạn camera để theo): mờ chéo CSS ngắn
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RUB_OFF_K = 0.6; // r80: bản dập tắt dần trong 0,6 × thời gian lùi (1,0 s → 600 ms như trước)
const ARCH_MAX = 0.62; // độ cong 1 → vòm cao 0,62 × nửa bề ngang tấm (0,55 mặc định ≈ tỉ lệ vòm của chính tấm bia)
const smoothT = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Tách tiêu đề "Văn bia đề danh Tiến sĩ khoa X niên hiệu Y năm thứ N (năm)" → [dòng chính, dòng phụ]. */
function splitTitle(t) {
  const s = nbsp(t);
  const i = s.indexOf(' niên hiệu ');
  return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ''];
}
const norm = (s) => String(s ?? '').normalize('NFC').toLocaleLowerCase('vi').trim();

/** @param {any} ctx InfoCtx (+ pinInfo) */
// r78: mặt chữ lớp đọc dùng — nạp sẵn (lần mở đầu đo chiều cao chữ để nhảy tới một phần; phông chưa về thì chữ dự phòng cao
// hơn → nhảy sai chỗ). Phần tử ẩn (display none) không kích hoạt tải phông nên phải gọi document.fonts.load.
const READER_FACES = [
  [FONT.cormorant, ["400 16px 'Cormorant Garamond'", "italic 400 16px 'Cormorant Garamond'"]],
  [FONT.beVietnam, ["400 16px 'Be Vietnam Pro'", "500 16px 'Be Vietnam Pro'", "italic 400 16px 'Be Vietnam Pro'"]],
];
export function createReader(ctx) {
  for (const [href, faces] of READER_FACES)
    ensureFont(href).then(() => {
      for (const f of faces) document.fonts?.load?.(f, 'Văn bia Đề danh').catch(() => {});
    });
  let info = null;
  let io = null;
  /** @type {{key:string, label:string, el:HTMLElement, btn:HTMLElement}[]} */
  let secs = [];
  /** r82: nhóm phần tử chữ hiện dần lúc mở / tắt lúc đóng (xem render) */
  /** @type {HTMLElement[][]} */
  let textGroups = [[], []];
  // r78: kiểu bảng đọc chốt lúc mở ('3d' | 'flat'), hình học tấm 3D (sân khấu), nội dung đang dịch
  let mode = 'flat';
  let geo3 = null;
  let pageEl = null;
  let padV = 0;
  // (scrollHeight / clientHeight của vùng chữ do bộ tích phân thay: cao nội dung THẬT gồm lề gộp của phần tử con / vùng đọc)
  const maxS = () => Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  const ov = createOverlay({
    ctx,
    cls: 'rd',
    label: 'Toàn văn bia',
    // r78: bộ tích phân cuộn — nội dung = trang; vùng đọc = ô tấm trên màn (cả kiểu 3D); độ dịch chữ trong tấm 3D trừ phần camera
    // đã dời tấm lên (chữ trên màn đi đúng bằng vị trí cuộn)
    scrollOpts: {
      content: () => pageEl,
      viewH: () => (rect ? rect.h - (arch.inset || 0) : 0),
      offset: (s) => (mode === '3d' && geo3 ? s - geo3.pxPerK * (s / Math.max(1, maxS())) : s),
      region: () => (rect ? { left: rect.x, right: rect.x + rect.w, top: rect.y, bottom: rect.y + rect.h } : scroll.getBoundingClientRect()),
    },
    closeMs: () => closeHold, // r82: giữ lớp phủ tới khi tấm trượt xuống + mờ hết (cuối đoạn camera lùi)
    // HUD / tấm sơn mài trở lại khi camera đã lùi được một đoạn (không bật lên lúc camera còn sát mặt bia) — r82b: ở 0,75 ×
    // thời gian camera lùi (1,0 s → 750 ms; trước: 550 ms cố định — tấm sơn mài hiện lại khi tấm đen còn đang mờ dần)
    readingHoldMs: ctx.readView ? () => Math.round(tnum(getSettings(), 'readerHoldK') * 1000 * tnum(getSettings(), 'readerZoomOut')) : 0,
    build: () => {},
    onOpen: () => reveal(),
    onClose: (why) => onClosed(why),
    onScroll: () => syncToc(),
  });
  const { sheet, scroll } = ov;
  const root = ov.root;
  const head = sheet.querySelector('.ri-ov__head');
  // r74: nền tấm đọc (đen trong mờ + nhoè nhẹ phía sau) — tách khỏi vùng cuộn để mặt nạ mờ mép chữ không làm mờ mép tấm
  const panel = h('div', 'rd-panel');
  // r77: "tấm" = nền + dải tên trang + vùng chữ — biến hình cùng nhau khi đi theo mặt đá
  const slab = h('div', 'rd-slab');
  slab.append(panel, head, scroll);
  sheet.prepend(slab);
  // mục lục trái + "đầu trang"
  const toc = h('nav', 'rd-toc');
  toc.setAttribute('aria-label', 'Các phần của văn bia');
  const topBtn = h('button', 'rd-top');
  topBtn.type = 'button';
  topBtn.setAttribute('data-rt', '');
  topBtn.setAttribute('data-magnet', '');
  topBtn.append(h('span', 'rd-top__a', '↑'), h('span', 'rd-top__t', 'Đầu trang'));
  topBtn.addEventListener('click', () => ov.scroller.to(0)); // cùng bộ tích phân: chữ + camera đi dài, êm về đỉnh vòm
  sheet.append(toc, topBtn);
  // thẻ chi tiết khi rê vào tên / thuật ngữ / người soạn (một thẻ dùng chung, nằm trong nội dung cuộn)
  const card = h('div', 'dd-card');
  card.setAttribute('aria-hidden', 'true');
  let cardHover = false;
  card.addEventListener('pointerenter', () => {
    cardHover = true;
    clearTimeout(leaveT);
  });
  card.addEventListener('pointerleave', (e) => {
    cardHover = false;
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && hotBy === 'mouse') setHot(null);
  });
  // r75: ghi chú bên lề (ngoài tấm, bên phải). r78: kiểu 3D — cột nằm trên cùng mặt phẳng tấm (đi theo neo dưới phối cảnh);
  // bắt đầu dưới nút Đóng (nút ở màn — tính theo vị trí thật của nó)
  const closeBtn = ov.root.querySelector('.ri-ov__close');
  // r78 kiểu 3D: mép trên vùng chữ trên màn ở vị trí cuộn HIỆN TẠI, tính thẳng từ hình học tấm (camera của khung này có thể
  // chưa vẽ ra DOM khi sự kiện cuộn chạy — getBoundingClientRect còn theo khung trước)
  const scrollTopScreen = () => {
    const m = maxS();
    return rect.y + scroll.offsetTop - geo3.pxPerK * (m > 0 ? scroll.scrollTop / m : 0);
  };
  const side = createSidenotes({
    sheet,
    scroll,
    topClear: () => (mode === '3d' && geo3 && rect ? Math.max(12, closeBtn.getBoundingClientRect().bottom + 18 - scrollTopScreen()) : 66),
    // phần thấy được của vùng chữ (toạ độ trong vùng chữ): kiểu 3D = giao với màn (tấm cao hơn khung, đỉnh ra khỏi khung khi cuộn)
    view: (pr) => {
      if (mode !== '3d' || !geo3 || !rect) return { top: 0, bottom: pr.height };
      const t = scrollTopScreen();
      return { top: Math.max(0, -t), bottom: Math.min(pr.height, innerHeight - t) };
    },
  });
  // r78: phần tử của đối tượng CSS3D (kiểu 3D): tấm + cột ghi chú; lớp 'rd' để dùng chung mọi quy tắc CSS của tấm
  const sheet3 = h('div', 'rd rd--3d');
  let obj3 = null;
  let rig3 = null;
  let base3Y = 0; // r82: cao độ nghỉ của đối tượng CSS3D (toạ độ cục bộ bia)
  let slideOff = 0; // r82: tấm đang thấp hơn chỗ nghỉ ngần này (px thiết kế — Phẳng: px màn)
  function ensure3d() {
    if (obj3 || !ctx.css3d || !ctx.THREE) return !!obj3;
    ctx.css3d.ensure();
    rig3 = new ctx.THREE.Group();
    rig3.matrixAutoUpdate = false;
    ctx.css3d.scene.add(rig3);
    obj3 = new CSS3DObject(sheet3);
    sheet3.style.pointerEvents = 'none';
    rig3.add(obj3);
    ov.addTargetRoot?.(sheet3); // đích bấm bằng tay (năm liên kết…) nằm trong tấm 3D
    show3(false);
    return true;
  }
  /** Hiện / ẩn đối tượng CSS3D (cả nhóm — lớp CSS3D rảnh khi không còn gì hiện). */
  function show3(on) {
    if (!obj3) return;
    obj3.visible = on;
    rig3.visible = on;
  }
  /** Chuyển tấm + cột ghi chú giữa lớp phủ màn hình (phẳng) và đối tượng CSS3D (3D). */
  function placeDom() {
    if (mode === '3d') {
      if (slab.parentElement !== sheet3) sheet3.append(slab);
      if (side.el.parentElement !== sheet3) sheet3.append(side.el);
    } else {
      if (slab.parentElement !== sheet) sheet.prepend(slab);
      if (side.el.parentElement !== sheet) sheet.append(side.el);
    }
    root.classList.toggle('is-3d', mode === '3d');
  }
  const MIRROR = ['is-open', 'is-text', 'is-settled', 'is-scrolled', 'is-out'];
  function mirror3() {
    for (const c of MIRROR) sheet3.classList.toggle(c, root.classList.contains(c));
  }
  /** Kiểu 3D: cỡ phần tử (px thiết kế = px màn ở khung cuối), vị trí đối tượng (toạ độ cục bộ bia). */
  // (chưa có hình học — lúc mở, trước khi vào khung đọc: cỡ theo ô tấm để đo đúng chiều cao nội dung trước khi nhảy tới một phần)
  function size3d() {
    if (!rect) return;
    const g = geo3;
    const wPx = g ? g.wPx : rect.w;
    const hPx = g ? g.hPx : rect.h;
    const sideW = sideWidth();
    const elW = Math.round(wPx + 22 + sideW);
    const st = sheet3.style;
    st.width = `${elW}px`;
    st.height = `${hPx}px`;
    st.setProperty('--rd-x', '0px');
    st.setProperty('--rd-y', '0px');
    st.setProperty('--rd-w', `${wPx}px`);
    st.setProperty('--rd-h', `${hPx}px`);
    st.setProperty('--rd-hv', `${rect.hv ?? rect.h}px`);
    st.setProperty('--rd-side-w', `${sideW}px`);
    if (!g || !obj3) return;
    base3Y = g.top - (g.hPx * g.sigma) / 2;
    obj3.position.set(g.left + (elW * g.sigma) / 2, base3Y - slideOff * g.sigma, g.z);
    obj3.scale.setScalar(g.sigma);
  }
  const sideWidth = () => (rect ? Math.round(Math.min(340, Math.max(170, innerWidth - (rect.x + rect.w) - 22 - 30))) : 240);
  /** @type {{note:any, anchor:HTMLElement}[]} */
  let anchors = [];
  // bia khác: có trong ứng dụng thì bấm được — đóng lớp đọc, lướt tới
  const nav = {
    hasStele: (id) => !!ctx.hasStele?.(id),
    go: (id) => {
      if (!ctx.gotoStele) return;
      ov.close('link');
      ctx.gotoStele(id);
    },
  };

  // ---------------------------------------------------------------- dựng trang
  function render() {
    head.replaceChildren();
    scroll.replaceChildren();
    pageEl = null;
    textGroups = [[head], []];
    secs = [];
    setHot(null);
    anchors = [];
    if (!info) {
      side.set([]);
      return;
    }
    const notes = notesOf(info);
    const at = (sec, i) => notes.filter((n) => n.anchor?.section === sec && n.anchor.para === i);
    // r79: tiêu đề chuẩn hoá (nhiều bia nguồn viết HOA toàn bộ); can chi như tiêu đề bia (1514 "Quý Mùi")
    const [t1, t2] = splitTitle(steleTitle(info));
    const cc = canChiShown(info);
    const desc = info.content?.kind === 'description'; // 1565: nội dung là bài mô tả bia, không phải bản dịch văn bia
    ov.root.setAttribute('aria-label', desc ? 'Mô tả bia' : 'Toàn văn bia');
    head.append(h('p', 'rd-run', `${cc ? `Khoa ${cc} · ` : ''}${info.year ?? ''}`));
    const page = h('article', 'rd-page');
    pageEl = page; // r78: nội dung do bộ tích phân cuộn dịch
    const cardEl = h('header', 'rd-card');
    // thẻ tiêu đề: "Soạn văn <người soạn>" (rê → tiểu sử) · dòng dựng bia (r75: "dựng bia năm 1484, 42 năm sau khoa thi, …")
    const by = h('p', 'rd-by');
    // r79: người soạn không ghi tên (1646) → không có dòng "Soạn văn"
    const author = unnamed(info.contributors?.author) ? null : known(info.contributors.author);
    if (author) {
      by.append('Soạn văn ');
      const a = h('span', `rd-author${info.authorBio ? ' rd-hot' : ''}`, author);
      if (info.authorBio) {
        a._bio = info.authorBio;
        a.tabIndex = -1;
      }
      by.append(a);
    }
    const er = erectionPhrase(info);
    if (!desc) cardEl.append(h('p', 'rd-over', 'Toàn văn bia'));
    cardEl.append(ccInto(h('h2', 'rd-title rd-title--main'), t1, cc), ccInto(h('p', 'rd-title rd-title--sub'), t2, cc));
    if (author) cardEl.append(by);
    if (er) cardEl.append(h('p', 'rd-erect', er.charAt(0).toLocaleUpperCase('vi') + er.slice(1)));
    cardEl.append(h('span', 'rd-cue', 'Cuộn để đọc'));
    page.append(cardEl);

    const text = h('div', 'rd-text');
    const body = h('section', 'rd-body');
    info.content.paragraphs.forEach((p, i) => {
      const el = h('p', `rd-p${i === 0 ? ' rd-p--first' : ''}`);
      const { frag, marks } = annotate(p, at('body', i));
      el.append(frag);
      for (const m of marks) anchors.push({ note: m.note, anchor: m.el });
      body.append(el);
    });
    text.append(body);
    let colo = null;
    const credits = creditsBlock(info, nav);
    if (info.content.colophon?.length || credits) {
      colo = h('section', 'rd-colo');
      colo.append(h('span', 'rd-orn', '❖'));
      (info.content.colophon ?? []).forEach((l, i) => {
        const el = h('p', 'rd-colo__l');
        const { frag, marks } = annotate(l, at('colo', i));
        el.append(frag);
        for (const m of marks) anchors.push({ note: m.note, anchor: m.el });
        colo.append(el);
      });
      if (credits) colo.append(credits);
    }
    page.append(text);
    const roll = buildRoll(notes);
    // ghi chú không neo được vào đâu → liệt kê ngay sau Bài ký (chữ nhỏ, trong dòng văn)
    const used = new Set(anchors.map((a) => a.note));
    const loose = notes.filter((n) => !used.has(n));
    if (loose.length) {
      const nb = h('section', 'rd-loose');
      nb.append(h('h4', 'rd-loose__h', 'Ghi chú'));
      for (const n of loose) {
        const [l, r] = noteParts(n);
        const it = h('p', 'rd-loose__i');
        if (l) it.append(h('span', 'rd-loose__l', l), ` ${r}`);
        else it.append(r); // r80: nhãn không phải tiêu đề / không nhãn → một câu liền nguyên văn
        nb.append(it);
      }
      text.append(nb);
    }
    if (colo) text.append(colo);
    if (roll) page.append(roll);
    const endEl = h('p', 'rd-end', '— Hết —');
    page.append(endEl, card);
    scroll.append(page);
    // r82: nhóm chữ hiện dần lúc mở (lệch nhịp): thẻ tiêu đề + dải tên trang trước, thân bài / lạc khoản / Đề danh sau
    textGroups = [[head, cardEl], [text, roll, endEl].filter(Boolean)];
    for (const el of page.querySelectorAll('.rd-hot')) bindHot(el);
    side.set(anchors);

    const add = (key, label, el) => el && secs.push({ key, label, el, btn: null });
    add('body', desc ? 'Mô tả bia' : 'Bài ký', body);
    add('colo', 'Lạc khoản', colo);
    add('roll', 'Đề danh', roll);
    buildToc();
  }

  /**
   * r79: chữ tiêu đề có can chi mang ghi chú (canChiNote — 1514) → cụm can chi thành đích nóng gạch chấm (như thuật ngữ): rê chuột
   * / tay → thẻ chung với nguyên văn ghi chú. Không có ghi chú → chữ thường.
   */
  function ccInto(el, text, cc) {
    const s = String(text ?? '');
    const at = cc && info.canChiNote ? s.indexOf(cc) : -1;
    if (at < 0) {
      el.textContent = s;
      return el;
    }
    const sp = h('span', 'rd-cc rd-term rd-hot', cc);
    sp.tabIndex = -1;
    sp._term = { term: cc, def: info.canChiNote, note: null };
    el.append(s.slice(0, at), sp, s.slice(at + cc.length));
    return el;
  }

  /** Đề danh — bảng vàng theo giáp; mỗi tên mang dữ liệu cho thẻ chi tiết. `notes` → ghi chú neo vào tên (section 'roll'). */
  function buildRoll(notes = []) {
    const tiers = tiersOf(info);
    if (!tiers.length) return null;
    const bios = new Map((info.biographies ?? []).map((b) => [norm(b.name), b]));
    const stories = new Map((info.stories ?? []).map((b) => [norm(b.name), b]));
    const rollSrc = info.content?.roll ?? [];
    const sec = h('section', 'dd');
    sec.setAttribute('aria-label', 'Đề danh');
    const hd = h('header', 'dd-head');
    // r79: dòng phụ ghép từ phần dữ liệu CÓ: số dự thi mơ hồ → chữ nguồn ("hơn 750"), "Không ghi" → bỏ vế đó
    const passed = info.passed ?? (info.laureates?.length || null);
    const cand = countOf(info.candidates, info.candidatesRaw);
    const subA = passed != null ? `${passed} vị đỗ${cand ? ` trong ${countText(cand)} sĩ tử dự thi` : ''}` : '';
    const subB = info.era ? `niên hiệu ${info.era}${info.eraYear != null ? ` năm thứ ${info.eraYear}` : ''}` : '';
    hd.append(h('p', 'dd-over', 'Bảng vàng · phần cuối văn bia'), h('h3', 'dd-title', 'Đề danh Tiến sĩ'));
    if (subA || subB) hd.append(h('p', 'dd-sub', [subA, subB].filter(Boolean).join(' · ')));
    // r75: tỉ lệ đỗ (chỉ khi hai con số chính xác — passRate null thì không có dòng này)
    if (info.passRate?.phrase) hd.append(h('p', 'dd-rate', info.passRate.phrase));
    sec.append(hd);
    let k = 0;
    tiers.forEach((g, gi) => {
      const tier = h('section', `dd-tier dd-tier--${g.tier}`);
      // r79: lời dẫn danh sách của văn bia (roll[].preface — vd. 1623 "Đã Điện thí nhưng chưa treo bảng vàng…") — dòng nhỏ
      const pre = known(rollSrc[gi]?.preface);
      if (pre) tier.append(h('p', `dd-preface${pre === pre.toLocaleUpperCase('vi') ? ' is-caps' : ''}`, pre));
      const th = h('h4', 'dd-tier__h');
      th.append(h('span', 'dd-tier__g', TIER_NAME[g.tier]), h('span', 'dd-tier__l', g.label), h('span', 'dd-tier__c', `${g.list.length} vị`));
      const grid = h('ol', 'dd-grid');
      // ghi chú neo vào giáp này: tên có dòng quê (nguyên văn đề danh của toàn văn) chứa cụm `match`
      const tierNotes = notes.filter((n) => n.anchor?.section === 'roll' && n.anchor.para === gi);
      const src = rollSrc[gi]?.names ?? [];
      g.list.forEach((p, j) => {
        const li = h('li', 'dd-p');
        li.style.setProperty('--k', String(k++));
        li.tabIndex = -1;
        // dòng hạng nhỏ trên tên: danh hiệu (Trạng nguyên…) + honors của dữ liệu (chữ thường, không biểu tượng)
        const rank = g.tier === 1 ? rankOf(p) : (Array.isArray(p.honors) ? p.honors : []).filter(Boolean).join(' · ');
        if (rank) li.append(h('span', 'dd-p__r', rank));
        li.append(h('span', 'dd-p__n', p.name), h('span', 'dd-p__f', shortHome(known(p.hometown))));
        const bio = bios.get(norm(p.name));
        li._dd = { p, bio, story: stories.get(norm(p.name)) };
        if (bio) li.classList.add('has-bio');
        const from = `${src[j]?.from ?? ''}|${p.hometown ?? ''}`.replace(/,/g, '');
        for (const n of tierNotes) if (n.anchor.match && from.includes(n.anchor.match.replace(/,/g, ''))) anchors.push({ note: n, anchor: li });
        bindHot(li);
        grid.append(li);
      });
      tier.append(th, grid);
      sec.append(tier);
    });
    return sec;
  }

  /** Chuột / chạm cho một đích nóng (tên Đề danh, thuật ngữ, người soạn). */
  function bindHot(el) {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') setHot(el, 'mouse');
    });
    el.addEventListener('pointerleave', (e) => {
      if ((e.pointerType !== 'mouse' && e.pointerType !== 'pen') || hot !== el || hotBy !== 'mouse') return;
      // thẻ có liên kết: chừa đường chuột sang thẻ
      clearTimeout(leaveT);
      if (card.classList.contains('has-links')) leaveT = setTimeout(() => !cardHover && hot === el && hotBy === 'mouse' && setHot(null), LEAVE_MS);
      else setHot(null);
    });
    el.addEventListener('click', () => setHot(hot === el && hotBy === 'tap' ? null : el, 'tap'));
  }

  // ---------------------------------------------------------------- rê vào tên
  /** @type {HTMLElement|null} */
  let hot = null;
  let hotBy = '';
  let cardT = 0;
  let leaveT = 0;
  function setHot(li, by = '') {
    if (li === hot && (!li || by === hotBy)) return;
    hot?.classList.remove('is-hot', 'by-hand');
    hot = li;
    hotBy = li ? by : '';
    const sec = scroll.querySelector('.dd');
    sec?.classList.toggle('has-hot', !!li && li.classList.contains('dd-p'));
    clearTimeout(cardT);
    clearTimeout(leaveT);
    if (!li) {
      card.classList.remove('is-on');
      return;
    }
    li.classList.add('is-hot');
    if (by === 'hand') li.classList.add('by-hand');
    const was = card.classList.contains('is-on');
    fillCard(li);
    if (was) placeCard(li);
    else
      cardT = setTimeout(() => {
        if (hot !== li) return;
        placeCard(li);
        card.classList.add('is-on');
      }, CARD_DELAY);
  }
  function fillCard(li) {
    card.classList.remove('has-bio', 'has-links', 'is-term', 'is-author');
    // thuật ngữ giải nghĩa: nhãn ghi chú · thuật ngữ · nghĩa (nguyên văn nguồn)
    if (li._term) {
      const t = li._term;
      card.replaceChildren();
      // r80: nhãn ghi chú lên dòng chữ hoa nhỏ của thẻ CHỈ khi là tiêu đề (labelKind 'title')
      if (t.note?.label && t.note.labelKind === 'title') card.append(h('p', 'dd-card__rank', t.note.label));
      const top = h('div', 'dd-card__top');
      top.append(h('span', 'dd-card__n', t.term));
      card.append(top, h('p', 'dd-card__bio', t.def ?? ''));
      card.classList.add('is-term');
      return;
    }
    // người soạn bài ký
    if (li._bio) {
      bioInto(card, li._bio, { rank: 'Soạn bài ký văn bia' });
      card.classList.add('has-bio', 'is-author');
      return;
    }
    const { p, bio, story } = li._dd;
    card.replaceChildren();
    const top = h('div', 'dd-card__top');
    top.append(h('span', 'dd-card__n', p.name));
    if (known(bio?.dates)) top.append(h('span', 'dd-card__d', bio.dates.replace('-', '–')));
    // "Đệ nhất giáp Tiến sĩ cập đệ (Trạng nguyên)" → "Đệ nhất giáp Tiến sĩ cập đệ · Trạng nguyên"
    const rank = String(p.rank ?? '').replace(/\s*\(([^)]+)\)\s*$/, ' · $1');
    card.append(top, h('p', 'dd-card__rank', rank));
    if (known(p.hometown)) card.append(h('p', 'dd-card__home', `Người ${p.hometown}`));
    card.classList.toggle('has-bio', !!bio);
    if (bio) {
      if (known(bio.description)) card.append(h('p', 'dd-card__bio', bio.description));
      const roles = (bio.roles ?? []).map(known).filter(Boolean);
      if (roles.length) card.append(h('p', 'dd-card__roles', roles.slice(0, 4).join(' · ')));
      if (known(bio.hometown)) card.append(h('p', 'dd-card__now', bio.hometown));
    }
    // r75: chuyện người đỗ nhắc tới bia khác → liên kết chữ "Xem bia khoa 1448" + "cần đối chiếu" nhỏ, mờ
    const links = (story?.links ?? []).filter((o) => o?.year);
    if (links.length) {
      const lp = h('p', 'dd-card__links');
      links.forEach((o, i) => {
        if (i) lp.append(h('span', 'dd-card__sep', ' · '));
        lp.append(yearLink(o, { ...nav, label: `Xem bia khoa ${o.year}` }));
        if (o.$verify) lp.append(h('span', 'dd-card__verify', o.$verify));
      });
      card.append(lp);
      card.classList.add('has-links');
    }
  }
  /** Đặt thẻ ngay dưới đích (hết chỗ trong tấm đọc → phía trên), kẹp trong bề ngang tấm; mũi thẻ chỉ đúng đích. */
  function placeCard(li) {
    const pg = card.parentElement;
    if (!pg) return;
    const pgr = pg.getBoundingClientRect();
    const r = li.getBoundingClientRect();
    const pr = scroll.getBoundingClientRect();
    const w = card.offsetWidth || 340;
    const hgt = card.offsetHeight || 120;
    const cx = r.left + r.width / 2;
    let x = cx - pgr.left - w / 2;
    x = Math.max(pr.left + 16 - pgr.left, Math.min(pr.right - 16 - w - pgr.left, x));
    // phía nào đủ chỗ trong tấm (dưới trước); không phía nào đủ → phía rộng hơn, kẹp trong tấm (dưới dải tên trang)
    // (r78 kiểu 3D: vùng chữ có thể trượt quá mép khung — kẹp theo khung nhìn)
    const top = Math.max(pr.top, 0) + 56;
    const bottom = Math.min(pr.bottom, innerHeight) - 12;
    const roomB = bottom - (r.bottom + 12);
    const roomA = r.top - 12 - top;
    const below = hgt <= roomB || (hgt > roomA && roomB >= roomA);
    let yc = below ? r.bottom + 12 : r.top - 12 - hgt; // toạ độ khung nhìn
    yc = Math.max(top, Math.min(bottom - hgt, yc));
    const y = yc - pgr.top;
    card.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    card.style.setProperty('--ax', `${Math.round(Math.max(18, Math.min(w - 18, cx - pgr.left - x)))}px`);
    card.classList.toggle('is-above', !below);
  }
  const inRect = (r, d, pad) => d.x >= r.left - pad && d.x <= r.right + pad && d.y >= r.top - pad && d.y <= r.bottom + pad;
  const hotR = (el) => (el._term ? HAND_R_TERM : el._bio ? HAND_R_AUTHOR : HAND_R);
  // tay: tên gần điểm tay nhất trong HAND_R (trễ chuyển HAND_SWITCH); tay ở xa / nhón kéo → bỏ
  function onHand(e) {
    if (!ov.isOpen) return;
    const d = e.detail || {};
    const overNote = side.hand(d);
    // tay đang ở trên thẻ (vd. sắp nhón liên kết "Xem bia khoa …") → giữ thẻ, cả lúc nhón
    const onCard = !!hot && card.classList.contains('is-on') && d.detected && inRect(card.getBoundingClientRect(), d, 18);
    if (onCard && hotBy === 'hand') return;
    if (!d.detected || d.pose === 'pinch' || d.pose === 'fist' || d.fist || ov.scroller.dragging || overNote) {
      if (hotBy === 'hand') setHot(null);
      return;
    }
    const sr = scroll.getBoundingClientRect();
    if (d.x < sr.left - HAND_R || d.x > sr.right + HAND_R || d.y < sr.top - HAND_R || d.y > sr.bottom + HAND_R) {
      if (hotBy === 'hand') setHot(null);
      return;
    }
    let best = null;
    let bd = Infinity;
    let curD = Infinity;
    for (const li of scroll.querySelectorAll('.dd-p, .rd-hot')) {
      const r = li.getBoundingClientRect();
      if (r.bottom < sr.top || r.top > sr.bottom || r.width < 1) continue; // ngoài tấm (đã cuộn qua)
      const dist = Math.hypot(Math.max(r.left - d.x, 0, d.x - r.right), Math.max(r.top - d.y, 0, d.y - r.bottom));
      if (li === hot) curD = dist;
      if (dist <= hotR(li) && dist < bd) {
        bd = dist;
        best = li;
      }
    }
    if (hot && hotBy === 'hand' && best !== hot && curD <= hotR(hot) && bd + HAND_SWITCH > curD) return; // giữ đích đang hút
    if (best) setHot(best, 'hand');
    else if (hotBy === 'hand') setHot(null);
  }
  window.addEventListener('hand:frame', onHand);

  // ---------------------------------------------------------------- mục lục
  function buildToc() {
    toc.replaceChildren();
    const thread = h('span', 'rd-toc__thread');
    thread.append(h('i', 'rd-toc__fill'));
    toc.append(thread);
    secs.forEach((s, i) => {
      const b = h('button', 'rd-toc__i');
      b.type = 'button';
      b.style.setProperty('--n', String(i));
      b.setAttribute('data-rt', '');
      b.setAttribute('data-magnet', '');
      b.append(h('span', 'rd-toc__dot'), h('span', 'rd-toc__t', s.label));
      b.addEventListener('click', () => jump(s.key, true));
      toc.append(b);
      s.btn = b;
    });
    toc.style.setProperty('--count', String(secs.length));
    root.style.setProperty('--count', String(secs.length)); // "↑ Đầu trang" canh theo cùng mục lục
    const end = h('span', 'rd-toc__end');
    end.style.setProperty('--n', String(secs.length));
    toc.append(end);
  }
  const startOf = (s) => Math.max(0, s.el.offsetTop - scroll.clientHeight * 0.12);
  const maxScroll = () => Math.max(1, scroll.scrollHeight - scroll.clientHeight);
  /** Tiến độ cuộn 0..1 (camera khung đọc lên / xuống theo nó). */
  const progressK = () => Math.min(1, Math.max(0, scroll.scrollTop / maxScroll()));
  function jump(key, smooth) {
    const s = secs.find((x) => x.key === key);
    if (!s) return;
    // Đề danh: đầu phần (dòng "Đề danh · khoa …") sát mép trên tấm đọc
    const y = key === 'roll' ? Math.max(0, s.el.offsetTop + (s.el.querySelector('.dd-head')?.offsetTop ?? 0) - ROLL_TOP) : startOf(s);
    if (smooth) ov.scroller.to(y); // nhảy mục lục: cùng bộ tích phân — chữ + camera đi dài, êm
    else scroll.scrollTop = y;
  }
  /** Mục đang đọc + chỉ tiến độ: tới mốc i khi phần i bắt đầu, giữa hai mốc theo phần trăm đã đọc của phần đó. */
  function syncToc() {
    if (!secs.length) return;
    const y = scroll.scrollTop + scroll.clientHeight * 0.4;
    const max = scroll.scrollHeight;
    let cur = -1;
    let frac = 0;
    for (let i = 0; i < secs.length; i++) {
      const a = secs[i].el.offsetTop;
      const b = i + 1 < secs.length ? secs[i + 1].el.offsetTop : max;
      if (y >= a) {
        cur = i;
        frac = Math.min(1, (y - a) / Math.max(1, b - a));
      }
    }
    const atEnd = scroll.scrollTop >= scroll.scrollHeight - scroll.clientHeight - 4;
    if (atEnd) {
      cur = secs.length - 1;
      frac = 1;
    }
    secs.forEach((s, i) => s.btn?.classList.toggle('is-cur', i === cur));
    toc.style.setProperty('--p', String(Math.max(0, cur + frac)));
    topBtn.classList.toggle('is-on', scroll.scrollTop > scroll.clientHeight * 0.5);
    if (hot && card.classList.contains('is-on')) placeCard(hot);
    side.layout();
  }

  /** r74: chữ hiện TỨC THÌ (luật chữ của tấm thông tin) — không còn từng đoạn mờ dần / trượt lên khi cuộn tới. */
  function reveal() {
    io?.disconnect();
    scroll.querySelectorAll('.rd-p, .rd-colo__l, .rd-card > *, .rd-orn, .dd').forEach((el) => el.classList.add('is-in'));
    requestAnimationFrame(syncToc);
  }

  // ---------------------------------------------------------------- tấm đọc trên mặt bia (r74)
  /**
   * Ô tấm đọc (px client) theo khung nhìn: bề ngang theo Đề danh (60 % khung, 620–1000 px), chừa trên cho dải tên trang /
   * nút Đóng, chừa dưới cho đầu rùa + mai (camera giải sao cho hộp đầu rùa luôn dưới mép này — stage/read.js).
   */
  function layoutRect() {
    const b = root.getBoundingClientRect();
    // r84: hàm thuần chung với sân khấu (camera nhích vào khung đọc trước khi lớp đọc mở — read-layout.js)
    return readerRect(b.width || innerWidth, b.height || innerHeight, b.left, b.top);
  }
  let rect = null;
  let arch = { rise: 0, inset: 0, k: 0 };
  /** Độ cao vòm (px) ở khoảng cách x (px) tính từ trục giữa tấm. */
  const riseAt = (x, w, rise) => {
    const u = Math.min(1, Math.abs(x) / (w / 2));
    return rise * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
  };
  let rootTop = 0;
  function applyRect(r) {
    rect = r;
    const b = root.getBoundingClientRect();
    rootTop = b.top;
    const st = root.style;
    st.setProperty('--rd-x', `${r.x - b.left}px`);
    st.setProperty('--rd-y', `${r.y - b.top}px`);
    st.setProperty('--rd-w', `${r.w}px`);
    st.setProperty('--rd-h', `${r.h}px`);
    st.setProperty('--rd-hv', `${r.hv ?? r.h}px`);
    st.setProperty('--rd-side-w', `${sideWidth()}px`);
    const cs = getComputedStyle(scroll);
    padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    applyArch();
  }
  /** r77: đỉnh vòm (Cài đặt readerArch) — clip-path của nền, chỉ viền, khoảng lùi của vùng chữ + dải tên trang. */
  function applyArch() {
    if (!rect) return;
    const k = Math.min(1, Math.max(0, Number(getSettings().readerArch ?? DEFAULTS.readerArch)));
    const w = rect.w;
    const hh = mode === '3d' && geo3 ? geo3.hPx : rect.h; // r78: tấm 3D cao hơn khung (đáy không bao giờ lọt khung)
    const rise = k * ARCH_MAX * (w / 2);
    // vùng chữ: bề rộng nội dung = tấm trừ đệm hai bên (Đề danh dùng hết bề này) → lùi xuống đúng độ cao vòm ở mép nội dung
    const pad = parseFloat(getComputedStyle(scroll).paddingLeft) || 56;
    const inset = rise > 0.5 ? Math.ceil(riseAt(w / 2 - pad, w, rise) + 6) : 0;
    // dải tên trang (giữa, hẹp): lùi đủ để hai góc của nó nằm trong vòm
    const runW = head.querySelector('.rd-run')?.offsetWidth || 240;
    const headIn = rise > 0.5 ? Math.ceil(riseAt(runW / 2 + 16, w, rise)) : 0;
    arch = { rise, inset, k, headIn };
    for (const st of [root.style, sheet3.style]) {
      st.setProperty('--rd-arch', `${rise.toFixed(1)}px`);
      st.setProperty('--rd-inset', `${inset}px`);
      st.setProperty('--rd-head-in', `${headIn}px`);
    }
    const d = rise > 0.5 ? `M0 ${hh} L0 ${rise.toFixed(2)} A ${w / 2} ${rise.toFixed(2)} 0 0 1 ${w} ${rise.toFixed(2)} L${w} ${hh} Z` : `M0 ${hh} L0 0 L${w} 0 L${w} ${hh} Z`;
    panel.style.clipPath = `path("${d}")`;
  }
  // cài đặt đổi lúc đang đọc → áp ngay (độ cong: cả bóng tấm trên đá)
  const offArch = onSettings((s) => {
    if (ov.isOpen && s.readerArch !== arch.kSet) {
      arch.kSet = s.readerArch;
      applyArch();
      if (mode === '3d') geo3 = ctx.readView?.layout(rect, { archRise: arch.rise }) ?? geo3;
      ov.scroller.refresh();
      side.layout();
    }
  });

  // ---------------------------------------------------------------- r82: tấm trượt lên (mở) / xuống (đóng)
  /**
   * Nhịp đang chạy: phase 'in' | 'out', dur (s — đoạn camera), a = tiến độ camera lúc tấm bắt đầu trượt (mở), dist = quãng trượt
   * (px), rm = giảm chuyển động (chỉ mờ chéo theo đoạn camera ngắn). t / off / op: giá trị của khung vừa áp (kiểm thử đọc).
   * @type {{phase:'in'|'out', dur:number, a:number, dist:number, rm:boolean, t:number, off:number, op:number}|null}
   */
  let mo = null;
  /** Độ dời của tấm: Phẳng — dịch trên màn; Nổi 3D — hạ đối tượng CSS3D dọc trục đứng của bia (cùng mặt phẳng tấm). */
  function setSlide(px) {
    slideOff = px > 0.005 ? px : 0;
    if (mode === '3d' && obj3 && geo3) {
      slab.style.transform = '';
      obj3.position.y = base3Y - slideOff * geo3.sigma;
      ctx.readView?.slide?.(slideOff * geo3.sigma); // bóng tấm trên đá trượt theo
    } else slab.style.transform = slideOff ? `translate3d(0, ${slideOff.toFixed(2)}px, 0)` : '';
  }
  /** Chữ (nhóm i): nhô thêm y px, độ hiện o — y 0 + o 1 thì gỡ hẳn style (đứng yên không còn biến hình). */
  const textFx = [
    { y: 0, o: 1 },
    { y: 0, o: 1 },
  ];
  function setText(i, y, o) {
    textFx[i].y = y;
    textFx[i].o = o;
    const ty = y > 0.01 ? `0 ${y.toFixed(2)}px` : '';
    const to = o < 0.999 ? o.toFixed(3) : '';
    for (const el of textGroups[i] ?? []) {
      el.style.translate = ty;
      el.style.opacity = to;
    }
  }
  function clearFx() {
    side.el.style.opacity = '';
    if (tfx) return; // r85: hiệu ứng tiêu đề đang giữ chữ / thân bài (tự gỡ khi xong)
    setText(0, 0, 1);
    setText(1, 0, 1);
  }
  /** Áp nhịp ở tiến độ camera t (0..1). */
  function applyMotion(t) {
    const m = mo;
    let off = 0;
    let op;
    if (m.phase === 'in') {
      if (m.rm) {
        op = smoothT(0, 1, t);
        setText(0, 0, op);
        setText(1, 0, op);
      } else {
        const u = clamp01((t - m.a) / Math.max(1e-6, 1 - m.a));
        off = (1 - m.easeOut(u)) * m.dist;
        op = smoothT(0, SLAB_FADE, u);
        if (tfx) {
          // r85: hiệu ứng tiêu đề thay nhịp nhóm chữ — bắt đầu khi tấm gần tới nơi
          if (u >= m.titleU) tfxStart(performance.now());
        } else
          m.lag.forEach((lag, i) => {
            const v = clamp01((u - lag) / Math.max(1e-6, 1 - lag));
            setText(i, (1 - easeOutCubic(v)) * m.rise, easeOutCubic(clamp01(v / 0.6)));
          });
      }
    } else {
      if (m.rm) op = 1 - smoothT(0, 1, t);
      else {
        off = m.easeIO(t) * m.dist;
        op = 1 - smoothT(OUT_FADE_A, 1, t);
      }
      const to = m.rm ? op : 1 - smoothT(0, m.outText, t);
      setText(0, 0, to);
      setText(1, 0, to);
      side.el.style.opacity = (m.rm ? op : 1 - smoothT(0, m.outUi, t)).toFixed(3);
    }
    m.t = t;
    m.off = off;
    m.op = op;
    slab.style.opacity = op.toFixed(3);
    if (mode === '3d') ctx.readView?.shadow?.(op);
    setSlide(off);
    // độ mạnh đường cắt: đủ suốt lúc trượt, nhả dần khi sắp nghỉ (mở) / vào dần lúc bắt đầu (đóng) — vài bia ở Đề danh (kiểu Phẳng,
    // camera cúi) đường đó còn trong khung lúc nghỉ: dáng nghỉ giữ nguyên, không bật mép lúc tới nơi
    const uIn = m.rm ? t : clamp01((t - m.a) / Math.max(1e-6, 1 - m.a));
    applyCut(m.phase === 'in' ? 1 - smoothT(0.8, 1, uIn) : smoothT(0, 0.2, t));
  }
  /**
   * r82b: lúc trượt, tấm không vẽ lên đầu rùa / mai (camera còn xa thì đáy tấm lọt khung): mặt nạ CSS trên cả tấm (toạ độ cục bộ
   * của tấm), mờ trong một dải ngắn ngay trên đường cắt = điểm cao nhất của hộp đầu rùa / chân mặt bia (readView.faceCut). Nổi
   * 3D: đường cắt trên MẶT PHẲNG TẤM (tia từ camera qua điểm đó); Phẳng: chiếu lên màn. Đứng yên: bỏ mặt nạ (luật camera giữ
   * đường đó dưới mép khung).
   */
  let cutY = null;
  function applyCut(w = 1) {
    const fc = w > 0.001 ? ctx.readView?.faceCut?.() : null;
    if (!fc) return clearCut();
    let y = mode === '3d' && geo3 ? (geo3.top - slideOff * geo3.sigma - fc.panelY) / geo3.sigma : fc.screenY - rootTop - slideOff;
    if (!Number.isFinite(y)) return clearCut();
    y += (1 - w) * 2 * (innerHeight + (geo3?.hPx ?? 0)); // nhả: đường cắt trôi xuống quá đáy tấm
    cutY = y;
    slab.style.setProperty('--rd-cut', `${y.toFixed(1)}px`);
    slab.classList.add('is-cut');
  }
  function clearCut() {
    cutY = null;
    slab.classList.remove('is-cut');
    slab.style.removeProperty('--rd-cut');
  }
  // ---------------------------------------------------------------- r85: hiệu ứng TỪNG CHỮ của tiêu đề
  // Ba kiểu (Cài đặt "Kiểu hiện tiêu đề"): 'settle' lắng từ trái (dưới) · 'bloom' phóng sáng — mỗi chữ hiện theo thứ tự ngẫu nhiên từ
  // cỡ ngẫu nhiên, quầng sáng mềm tắt dần khi chữ về cỡ 1, không sóng / không lệch chỗ · 'fade' mờ dần — tiêu đề mờ vào (không tách chữ).
  // Mọi kiểu: phần còn lại hiện sau tiêu đề, thân bài / bảng vàng trượt lên SAU khi tiêu đề xong.
  // Mở ở đầu: dòng tiêu đề lớn (.rd-title--main — có thể xuống 2 dòng) tách thành chữ (Intl.Segmenter — cụm tự vị: dấu tiếng Việt đi
  // cùng chữ), mỗi chữ hiện ở cỡ / lệch ngẫu nhiên, hơi nhoè, với một ánh loé vàng ngắn phía sau; rồi sóng "đặt chữ" chạy trái → phải
  // từng dòng (dòng 2 chồng nhịp dòng 1), về cỡ 1 / lệch 0 (ease-out, vượt rất nhẹ). Xong: dòng trên (TOÀN VĂN BIA), dòng vàng (niên
  // hiệu), người soạn… hiện nhanh, rồi thân bài trượt lên. Mở ở Đề danh: cùng hiệu ứng cho "Đề danh Tiến sĩ", rồi bảng vàng trượt lên.
  // Chỉ transform / opacity / filter (GPU); đứng yên: gỡ hết style (chữ sắc). Giảm chuyển động: không có (mờ chéo như cũ).
  const TFX_START_U = TITLE_U; // bắt đầu khi tấm đã trượt ngần này (gần tới nơi — không có khoảng chết; r90: có đám mây → TITLE_U_CLOUD)
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null;
  const graphemes = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : Array.from(s));
  const hashT = (n, salt) => {
    let x = (n * 374761393 + salt * 668265263) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  const easeOutBack = (u, k = 1.15) => 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2);
  /**
   * (r85) Giữ nguyên chỗ xuống dòng của tiêu đề trước khi tách chữ: chữ inline-block đo bề rộng khác chữ thường (mất kerning)
   * + text-wrap: balance tính lại → "…Tiến sĩ / khoa…" thành "…Tiến / sĩ khoa…". Đo dòng của từng từ ở bố cục gốc rồi chèn <br>
   * vào đúng chỗ ngắt (chỉ đụng nút chữ — phần tử con như chữ có chú giải giữ nguyên trình nghe sự kiện).
   */
  function freezeLines(el) {
    // Đo bằng offsetTop của span inline tạm (toạ độ BỐ CỤC — không bị transform / phối cảnh CSS3D của tấm làm lệch như rect màn
    // hình: lúc mở, tấm còn nhỏ + nghiêng theo camera → đỉnh từng từ trên cùng một dòng đã lệch nhau). Span inline không đổi chỗ ngắt.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const words = [];
    for (const tn of nodes) {
      const frag = document.createDocumentFragment();
      for (const part of tn.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) frag.append(part);
        else {
          const sp = document.createElement('span');
          sp.className = 'rd-tmp';
          sp.textContent = part;
          frag.append(sp);
          words.push(sp);
        }
      }
      tn.replaceWith(frag);
    }
    const tops = words.map((w) => w.offsetTop);
    const lineH = parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height || 1;
    words.forEach((w, k) => {
      if (k > 0 && tops[k] - tops[k - 1] > lineH * 0.5) {
        const prev = w.previousSibling;
        if (prev && prev.nodeType === 3) prev.nodeValue = prev.nodeValue.replace(/\s+$/, '');
        const br = document.createElement('br');
        br.className = 'rd-br';
        w.before(br);
      }
    });
    for (const w of words) w.replaceWith(w.textContent);
    el.normalize();
  }
  /** Tách chữ tại chỗ: mọi nút chữ con → span .rd-ch (aria-hidden) + loé .rd-gl; khoảng trắng giữ là chữ thường. */
  function splitChars(el) {
    if (el.querySelector('.rd-ch')) return [...el.querySelectorAll('.rd-ch')];
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    freezeLines(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const tn of nodes) {
      const frag = document.createDocumentFragment();
      // chữ inline-block tạo chỗ ngắt dòng giữa từng chữ → gói mỗi TỪ trong một span không ngắt (xuống dòng y như chữ thường)
      let word = null;
      for (const g of graphemes(tn.nodeValue)) {
        if (/^\s+$/.test(g)) {
          word = null;
          frag.append(g);
          continue;
        }
        if (!word) {
          word = document.createElement('span');
          word.className = 'rd-wd';
          frag.append(word);
        }
        const sp = document.createElement('span');
        sp.className = 'rd-ch';
        sp.setAttribute('aria-hidden', 'true');
        sp.textContent = g;
        const gl = document.createElement('i');
        gl.className = 'rd-gl';
        gl.setAttribute('aria-hidden', 'true');
        sp.append(gl);
        word.append(sp);
      }
      tn.replaceWith(frag);
    }
    return [...el.querySelectorAll('.rd-ch')];
  }
  /** @type {null|{state:'armed'|'run', at:string, titles:HTMLElement[], chars:Array, rest:HTMLElement[], body:HTMLElement[], t0:number, D:number, tEnd:number, restEnd:number, bodyEnd:number, sparkle:number, rise:number, bodyStart?:number}} */
  let tfx = null;
  let tfxLast = null; // kiểm thử: lượt gần nhất
  const tfxSet = (el, y, o) => {
    el.style.translate = y > 0.01 ? `0 ${y.toFixed(2)}px` : '';
    el.style.opacity = o < 0.999 ? o.toFixed(3) : '';
  };
  /** Chuẩn bị lượt (mở): chọn tiêu đề / phần còn lại / thân theo chỗ mở; ẩn hết tới khi bắt đầu. */
  function tfxArm(at) {
    tfxFinish();
    const set = getSettings();
    if (ctx.reduceMotion) return;
    const fxMode = topt(set, 'titleFxMode');
    let titles;
    let rest;
    let body;
    const card = scroll.querySelector('.rd-card');
    const roll = scroll.querySelector('.dd');
    const text = scroll.querySelector('.rd-text');
    const endEl = scroll.querySelector('.rd-end');
    if (at === 'roll' && roll) {
      const hd = roll.querySelector('.dd-head');
      titles = [...hd.querySelectorAll('.dd-title')];
      rest = [head, ...[...hd.children].filter((c) => !titles.includes(c))];
      body = [card, text, endEl, ...[...roll.children].filter((c) => c !== hd)].filter(Boolean);
    } else if (card) {
      titles = [...card.querySelectorAll('.rd-title--main')];
      rest = [head, ...[...card.children].filter((c) => !titles.includes(c))];
      body = [text, roll, endEl].filter(Boolean);
    } else return;
    if (!titles.length) return;
    const chars = [];
    if (fxMode !== 'fade')
      for (const t of titles) {
        t.classList.add('is-tfx');
        t.classList.toggle('is-bloom', fxMode === 'bloom');
        for (const c of splitChars(t)) chars.push({ el: c, gl: c.querySelector('.rd-gl'), title: t });
      }
    // dòng hiển thị (đo một lần — bố cục, không mỗi khung): nhóm theo offsetTop trong từng tiêu đề
    const lines = [];
    for (const t of titles) {
      const byTop = new Map();
      for (const c of chars.filter((x) => x.title === t)) {
        const k = Math.round(c.el.offsetTop / 4);
        if (!byTop.has(k)) byTop.set(k, []);
        byTop.get(k).push(c);
      }
      for (const k of [...byTop.keys()].sort((a, b) => a - b)) lines.push(byTop.get(k).sort((a, b) => a.el.offsetLeft - b.el.offsetLeft));
    }
    const sig = tnum(set, 'titleFxScale');
    let D = tnum(set, 'titleFxTime');
    if (fxMode === 'settle') {
      // nhịp (phần của D trước khi chuẩn hoá): hiện (ngẫu nhiên) → đặt chữ (theo thứ tự, trái → phải, dòng sau chồng nhịp)
      let n = 0;
      let maxEnd = 0;
      lines.forEach((L, li) => {
        L.forEach((c, j) => {
          const h1 = hashT(n, 1);
          const h2 = hashT(n, 2);
          const h3 = hashT(n, 3);
          const h4 = hashT(n, 4);
          c.line = li;
          c.si = 0.3 * h1 + 0.12 * li; // bắt đầu hiện
          c.sd = 0.22; // thời gian hiện
          c.ss = Math.max(0.42 + li * 0.16 + (0.34 * j) / Math.max(1, L.length - 1), c.si + c.sd * 0.9); // bắt đầu đặt chữ
          c.sdur = 0.26;
          c.r0 = 1 + sig * (2 * h2 - 1); // cỡ lúc hiện
          c.ox = (h3 - 0.5) * 14;
          c.oy = (h4 - 0.5) * 18;
          maxEnd = Math.max(maxEnd, c.ss + c.sdur);
          n++;
        });
      });
      const k = 1 / Math.max(1e-3, maxEnd); // chuẩn hoá: tiêu đề xong đúng D
      for (const c of chars) {
        c.si *= k * D;
        c.sd *= k * D;
        c.ss *= k * D;
        c.sdur *= k * D;
      }
    } else if (fxMode === 'bloom') {
      // thứ tự ngẫu nhiên (hoán vị tất định), mỗi chữ phóng từ cỡ ngẫu nhiên về 1 trong 45 % D, quầng sáng tắt dần theo
      const order = chars.map((c, i) => ({ c, k: hashT(i, 9) })).sort((a, b) => a.k - b.k);
      const dc = 0.45 * D;
      order.forEach(({ c }, j) => {
        const i = chars.indexOf(c);
        c.si = ((D - dc) * (j + hashT(i, 1) * 0.8)) / Math.max(1, order.length);
        c.sd = dc;
        c.ss = c.si; // (không có pha "đặt chữ" riêng)
        c.sdur = dc;
        c.r0 = 1 + sig * (2 * hashT(i, 2) - 1);
        c.ox = 0;
        c.oy = 0;
      });
    } else D = 0.55; // mờ dần: tiêu đề mờ vào nhanh, phần còn lại / thân bài theo sau
    for (const c of chars) {
      c.el.style.opacity = '0';
      c.el.style.willChange = 'transform, opacity, filter';
    }
    if (fxMode === 'fade') for (const t of titles) tfxSet(t, 0, 0);
    // nhóm chữ của nhịp r82 (khung đầu của đoạn mở đã đặt ẩn): trả lại — hiệu ứng tiêu đề tự ẩn / hiện từng phần
    setText(0, 0, 1);
    setText(1, 0, 1);
    for (const el of rest) tfxSet(el, 12, 0);
    for (const el of body) tfxSet(el, 0, 0);
    tfx = { state: 'armed', mode: fxMode, at, titles, chars, rest, body, lines: lines.length, t0: 0, D, tEnd: D, sparkle: tnum(set, 'titleFxSparkle'), glow: tnum(set, 'titleFxGlow'), rise: Math.max(24, tnum(set, 'readerTextRise') * 1.5), restDur: 0.32, bodyDur: 0.65, frames: 0, bodyStart: null, firstBodyMove: null };
  }
  function tfxStart(now) {
    if (!tfx || tfx.state !== 'armed') return;
    tfx.state = 'run';
    tfx.t0 = now;
  }
  /** Một khung của hiệu ứng tiêu đề (đồng hồ thật). */
  function tfxStep(now) {
    const f = tfx;
    if (!f || f.state !== 'run') return;
    const t = (now - f.t0) / 1000;
    f.frames++;
    if (f.mode === 'fade') {
      const a = clamp01(t / f.D);
      const e = 1 - Math.pow(1 - a, 3);
      for (const el of f.titles) tfxSet(el, 0, e);
    }
    if (f.mode === 'bloom')
      for (const c of f.chars) {
        const a = clamp01((t - c.si) / c.sd);
        if (a >= 1) {
          if (c.done) continue;
          c.done = true;
          for (const k of ['transform', 'filter', 'opacity']) c.el.style[k] = '';
          c.gl.style.opacity = '';
          c.gl.style.transform = '';
          continue;
        }
        const e = 1 - Math.pow(1 - a, 3);
        const sc = c.r0 + (1 - c.r0) * e;
        const o = clamp01(a / 0.35);
        c.el.style.opacity = a > 0 ? (o < 0.999 ? o.toFixed(3) : '') : '0';
        c.el.style.transform = `scale(${sc.toFixed(4)})`;
        const blur = (1 - e) * 2.2;
        c.el.style.filter = blur > 0.05 && a > 0 ? `blur(${blur.toFixed(2)}px)` : '';
        // quầng: sáng nhất khi chữ vừa hiện, tắt dần khi chữ về cỡ 1
        const g = a > 0 ? Math.min(1, f.glow * Math.sin(Math.PI * Math.min(1, a * 1.6)) * (1 - 0.5 * e)) : 0;
        c.gl.style.opacity = g > 0.005 ? g.toFixed(3) : '0';
        c.gl.style.transform = `translate(-50%, -50%) scale(${(0.7 + 0.8 * (1 - e)).toFixed(3)})`;
      }
    else for (const c of f.chars) {
      const a = clamp01((t - c.si) / c.sd); // hiện
      const b = clamp01((t - c.ss) / c.sdur); // đặt chữ
      if (b >= 1) {
        if (c.done) continue;
        c.done = true;
        c.el.style.transform = '';
        c.el.style.filter = '';
        c.el.style.opacity = '';
        c.gl.style.opacity = '';
        c.gl.style.transform = '';
        continue;
      }
      const ea = 1 - Math.pow(1 - a, 3);
      const sA = c.r0 + (1 - c.r0) * 0.3 * ea; // tiến dần về 1 khi hiện (giữ phần lớn độ ngẫu nhiên tới lúc đặt)
      const eb = b > 0 ? easeOutBack(b, 1.1) : 0;
      const sc = sA + (1 - sA) * eb;
      const off = 1 - (b > 0 ? eb : 0.5 * ea);
      const blur = (1 - ea) * 3.5 + (1 - Math.min(1, eb)) * 0.6 * (a >= 1 ? 1 : 0);
      c.el.style.opacity = ea < 0.999 ? ea.toFixed(3) : '';
      c.el.style.transform = `translate(${(c.ox * off).toFixed(2)}px, ${(c.oy * off).toFixed(2)}px) scale(${sc.toFixed(4)})`;
      c.el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
      // loé: đỉnh giữa lúc hiện, loé nhỏ lần hai lúc đặt chữ
      const g1 = a > 0 && a < 1 ? Math.sin(Math.PI * a) : 0;
      const g2 = b > 0 && b < 1 ? 0.45 * Math.sin(Math.PI * b) : 0;
      const g = Math.min(1, (g1 + g2) * f.sparkle);
      c.gl.style.opacity = g > 0.005 ? g.toFixed(3) : '0';
      c.gl.style.transform = `translate(-50%, -50%) scale(${(0.4 + 0.9 * Math.max(g1, g2)).toFixed(3)})`;
    }
    // phần còn lại: hiện nhanh ngay trước khi tiêu đề xong; thân bài: trượt lên sau khi tiêu đề xong
    const rA = clamp01((t - (f.tEnd - 0.12)) / f.restDur);
    const er = 1 - Math.pow(1 - rA, 3);
    for (const el of f.rest) tfxSet(el, 12 * (1 - er), er);
    const bA = clamp01((t - (f.tEnd + 0.08)) / f.bodyDur);
    if (bA > 0 && f.bodyStart == null) f.bodyStart = t;
    const eb2 = 1 - Math.pow(1 - bA, 3);
    for (const el of f.body) tfxSet(el, f.rise * (1 - eb2), clamp01(bA / 0.6));
    if (bA >= 1 && rA >= 1 && f.chars.every((c) => c.done)) tfxFinish();
  }
  /** Kết thúc (xong / bị cắt): gỡ mọi style của hiệu ứng (chữ sắc, không transform / nhoè còn lại). */
  function tfxFinish() {
    const f = tfx;
    if (!f) return;
    tfx = null;
    for (const c of f.chars) {
      for (const k of ['transform', 'filter', 'opacity', 'willChange']) c.el.style[k] = '';
      c.gl.style.opacity = '';
      c.gl.style.transform = '';
    }
    for (const t of f.titles) {
      t.classList.remove('is-tfx', 'is-bloom');
      if (f.mode === 'fade') tfxSet(t, 0, 1);
    }
    for (const el of [...f.rest, ...f.body]) tfxSet(el, 0, 1);
    tfxLast = { mode: f.mode, at: f.at, chars: f.chars.length, lines: f.lines, D: f.D, frames: f.frames, bodyStart: f.bodyStart, tEnd: f.tEnd, state: f.state };
  }

  function startMotion(phase, dur) {
    mo = null;
    if (phase === 'out') tfxFinish(); // r85: đóng giữa lúc hiệu ứng tiêu đề → về trạng thái cuối rồi mới tắt
    clearFx();
    root.classList.toggle('is-out', phase === 'out');
    if (!(dur > 0) || !ctx.readView?.tween) {
      // không có đoạn camera để theo (không sân khấu / không vào được khung đọc) → mờ chéo CSS ngắn
      slab.classList.remove('is-moving');
      setSlide(0);
      slab.style.opacity = phase === 'in' ? '' : '0';
      ctx.readView?.shadow?.(phase === 'in' ? 1 : 0);
      if (phase === 'in') {
        root.classList.add('is-settled');
        side.layout();
      } else {
        side.el.style.opacity = '0';
        setTimeout(() => {
          if (ov.isOpen) return;
          show3(false);
          side.el.style.opacity = '';
          root.classList.remove('is-out');
        }, ctx.reduceMotion ? RM_FADE_MS : 0);
      }
      return;
    }
    const set = getSettings();
    // r85: đám mây hạt sáng (hiệu ứng ánh sáng chữ, kiểu 'cloud') cần camera bay xuyên trước khi chữ hiện — tấm có thể tự lùi muộn hơn
    const Tm = phase === 'in' ? readerTiming(set, { dur, cloud: !ctx.reduceMotion && set.glyphFx !== false && topt(set, 'glyphFlyMode') === 'cloud' }) : null;
    const share = Tm ? Tm.share : tnum(set, 'readerSlideShare');
    const rm = !!ctx.reduceMotion;
    const H = root.getBoundingClientRect().height || innerHeight;
    const ez = topt(set, 'readerSlideEase');
    mo = {
      phase,
      dur,
      a: phase === 'in' ? 1 - share : 0,
      dist: rm ? 0 : Math.round(tnum(set, 'readerSlideDist') * H),
      rm,
      t: 0,
      off: 0,
      op: 0,
      // r84: nhịp tấm / chữ là cài đặt (chốt lúc bắt đầu đoạn — đổi giữa chừng áp từ lần mở / đóng sau)
      easeOut: EASE_OUT[ez],
      easeIO: EASE_INOUT[ez],
      lag: [tnum(set, 'readerTextLag1'), tnum(set, 'readerTextLag2')],
      // r90: tiêu đề bắt đầu ở ngần này quãng trượt (có đám mây: sớm hơn — chồng lên lúc đám mây còn tan, readerTiming)
      titleU: Tm?.titleU ?? TFX_START_U,
      rise: tnum(set, 'readerTextRise'),
      outText: tnum(set, 'readerOutText'),
      outUi: tnum(set, 'readerOutUi'),
    };
    slab.classList.add('is-moving');
    applyMotion(0);
  }
  /** Đoạn camera xong (hoặc bị thay — vd. lướt sang bia khác): tấm về đúng trạng thái cuối, không còn style nhịp nào. */
  function endMotion() {
    const m = mo;
    mo = null;
    if (!m) return;
    slab.classList.remove('is-moving');
    clearFx();
    clearCut();
    if (m.phase === 'in') {
      if (tfx?.state === 'armed') tfxStart(performance.now());
      setSlide(0);
      slab.style.opacity = '';
      ctx.readView?.shadow?.(1);
      root.classList.add('is-settled');
      side.layout();
    } else {
      slab.style.opacity = '0';
      ctx.readView?.shadow?.(0);
      show3(false);
      setSlide(0); // (đã ẩn) — lần mở sau bắt đầu từ chỗ nghỉ
      root.classList.remove('is-out');
    }
  }

  // ---------------------------------------------------------------- r82: MÓC cho hiệu ứng chữ Hán bay (việc sau)
  // Hiệu ứng "chữ Hán bay về phía camera khi mở, bay lại vào bia khi đóng" (chưa làm ở đây) đồng bộ với đoạn camera qua 4 sự kiện
  // trên window — detail: { phase: 'open' | 'close', dur (s, đoạn camera), mode ('3d' | 'flat'), at (mở) | why (đóng),
  //   progress(): 0..1 — tiến độ THỜI GIAN của đoạn camera (tuyến tính; 1 khi đã xong / đã bị thay bằng đoạn khác),
  //   ease(t): đường cong camera (easeInOutCubic) — camera đã đi ease(progress()) quãng; r82b: mở + textAt (tiến độ camera lúc
  //   chữ tấm đọc bắt đầu hiện), slideAt (lúc tấm bắt đầu trượt); đóng + textGoneAt (lúc chữ tắt hết) }
  //   (r82b: stage/glyphs.js — hiệu ứng chữ Hán — nghe các sự kiện này)
  //   'reader:open'   lúc mở, camera bắt đầu tiến vào (giữ V: đúng lúc 'hand:vhold' fire; nút bấm: sau ~0,5 s quét bản dập)
  //   'reader:opened' camera dừng ở khung đọc — tấm vừa tới chỗ nghỉ
  //   'reader:close'  lúc đóng, camera bắt đầu lùi ra (tấm bắt đầu trượt xuống)
  //   'reader:closed' camera lùi xong — tấm đã khuất
  // Đọc theo khung thay vì nghe: reader.motion() → { phase: 'open' | 'close' | '', t, dur }.
  const cam = { phase: '', t: 1, dur: 0, seq: 0, info: null };
  function emitMotion(type, detail) {
    try {
      window.dispatchEvent(new CustomEvent(`reader:${type}`, { detail }));
    } catch (e) {
      console.warn('[reader] móc', type, e);
    }
  }
  function camStart(phase, dur, extra) {
    if (cam.phase) camEnd();
    const seq = ++cam.seq;
    cam.phase = phase;
    cam.t = 0;
    cam.dur = dur;
    // r84: ease = đường cong thật của đoạn camera (cài đặt + phần khớp vận tốc lúc camera đang nhích vào)
    const curve = ctx.readView?.tween?.()?.curve ?? easeInOutCubic;
    cam.info = { phase, dur, mode, ...extra, progress: () => (cam.seq === seq && cam.phase ? cam.t : 1), ease: curve };
    emitMotion(phase, cam.info);
    if (!(dur > 0)) camEnd();
  }
  function camEnd() {
    if (!cam.phase) return;
    const info = cam.info;
    cam.t = 1;
    cam.phase = '';
    emitMotion(info.phase === 'open' ? 'opened' : 'closed', info);
  }

  /**
   * Mỗi khung (lacquer.update — ngay trước lượt vẽ, camera của khung này đã đặt): kiểu 3D — gắn tấm theo khay bia; nhịp trượt /
   * hiện theo tiến độ đoạn camera (hết đoạn → về trạng thái cuối đúng khung camera dừng).
   */
  function tick() {
    if (mode === '3d' && obj3 && (ov.isOpen || mo)) {
      const m = ctx.readView?.frame?.();
      if (m) {
        rig3.matrix.copy(m);
        rig3.matrixWorldNeedsUpdate = true;
      }
      mirror3();
    }
    if (tfx?.state === 'run') tfxStep(performance.now());
    if (!cam.phase && !mo) return;
    const tw = ctx.readView?.tween?.();
    if (cam.phase) {
      if (tw && tw.kind === (cam.phase === 'open' ? 'read' : 'read-out')) cam.t = tw.t;
      else camEnd();
    }
    if (!mo) return;
    if (!tw || tw.kind !== (mo.phase === 'in' ? 'read' : 'read-out')) {
      endMotion();
      return;
    }
    applyMotion(tw.t);
  }
  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!ov.isOpen) return;
      applyRect(layoutRect());
      const g = ctx.readView?.layout(rect, { archRise: arch.rise });
      if (mode === '3d' && g) {
        geo3 = g;
        size3d();
        applyArch();
      }
      ov.scroller.refresh();
      syncToc();
    }, 60);
  };
  let closeHold = CLOSE_FADE_MS;
  /** Thời gian tắt của mục lục / Đóng / Đầu trang / màn viền khi đóng (đặt cả lúc mở — lượt tính style đầu tiên sau khi bỏ is-open đã
   * có giá trị đúng). */
  const setOutDur = (dur) => root.style.setProperty('--rd-out-dur', `${(ctx.reduceMotion ? RM_FADE_MS / 1000 : Math.max(0.12, dur * tnum(getSettings(), 'readerOutUi'))).toFixed(3)}s`);
  function onClosed(why = '') {
    setHot(null);
    side.close();
    root.classList.remove('is-settled');
    window.removeEventListener('resize', onResize);
    ctx.readView?.setSource?.(null);
    // r80: thời gian lùi = cài đặt readerZoomOut (mọi nhịp đóng tính theo tỉ lệ của đoạn này)
    const zOut = tnum(getSettings(), 'readerZoomOut');
    const dur = ctx.readView?.exit({ dur: zOut }) || 0;
    setOutDur(dur); // mục lục / Đóng / Đầu trang / màn viền tắt sớm (CSS theo --rd-out-dur)
    startMotion('out', dur);
    // giữ lớp phủ tới cuối đoạn lùi (tấm trượt xuống + mờ hết đúng lúc camera dừng)
    closeHold = mo ? Math.round(dur * 1000) + 60 : ctx.reduceMotion ? RM_FADE_MS + 40 : CLOSE_FADE_MS;
    ctx.scan?.release(dur > 0 ? Math.round(dur * RUB_OFF_K * 1000) : undefined); // bản dập trên mặt bia tắt dần sau khi đóng
    camStart('close', mo ? dur : 0, { why, textGoneAt: mo ? mo.outText : 0 });
  }

  return {
    setInfo(next) {
      if (next === info) return;
      info = next;
      render();
    },
    /** at: 'top' (thẻ tiêu đề) | 'body' | 'colo' | 'roll' (Đề danh). */
    open({ at = 'top', ...opts } = {}) {
      if (!info || ov.isOpen) return;
      tfxFinish();
      // mở lại giữa lúc đang đóng: bỏ nhịp đóng dở (không để nó ẩn tấm của lần mở này)
      if (mo) {
        mo = null;
        slab.classList.remove('is-moving');
        clearFx();
        clearCut();
        setSlide(0);
      }
      camEnd();
      root.classList.remove('is-settled', 'is-out');
      slab.style.opacity = '0'; // tới khi đoạn camera bắt đầu (tránh một khung tấm đầy đủ)
      // r78: kiểu bảng đọc (chốt tới lần mở sau) — 3D cần lớp CSS3D + khung đọc của sân khấu
      const set = getSettings();
      mode = (set.readerMode ?? DEFAULTS.readerMode) === '3d' && ctx.readView?.panel3d && ensure3d() ? '3d' : 'flat';
      geo3 = null;
      placeDom();
      ov.open();
      root.classList.add('is-text');
      arch.kSet = set.readerArch;
      applyRect(layoutRect()); // sau khi lớp phủ hiện (đo được khung)
      if (mode === '3d') {
        // bề rộng tấm 3D trước khi nhảy (chiều cao nội dung đúng); lớp CSS3D chỉ gắn / hiện phần tử ở lượt vẽ → vẽ ngay một lượt
        // để đo được (tấm còn trong suốt — slab opacity 0)
        size3d();
        mirror3(); // lớp is-text… ảnh hưởng bố cục chữ
        show3(true);
        if (!sheet3.isConnected || sheet3.style.display === 'none') ctx.css3d.render?.();
      }
      if (at !== 'top') jump(at, false);
      else scroll.scrollTop = 0;
      reveal();
      syncToc();
      // camera tiến sát mặt bia, ở đúng cao độ của vị trí cuộn lúc mở (đầu: đỉnh vòm · Đề danh: phần dưới phiến)
      const gap = Number(set.readerGap ?? DEFAULTS.readerGap);
      // r80: thời gian tiến vào = cài đặt readerZoomIn (r82: tấm trượt lên trong phần cuối đoạn này, mục lục… theo tỉ lệ)
      const zIn = Number.isFinite(opts.zoomIn) ? opts.zoomIn : tnum(set, 'readerZoomIn');
      const dur = ctx.readView?.enter({ rect, k: progressK(), mode, gap, archRise: arch.rise, dur: zIn }) || 0;
      if (mode === '3d') {
        geo3 = ctx.readView.panel3d();
        if (geo3) {
          size3d();
          applyArch();
          mirror3();
          show3(true);
          tick();
        } else {
          mode = 'flat';
          placeDom();
        }
      }
      ov.scroller.refresh();
      // MỘT nguồn chuyển động: sân khấu bước bộ tích phân cuộn mỗi khung, ngay trước khi đặt camera
      ctx.readView?.setSource?.((dt) => ov.scroller.step(dt));
      // mục lục / Đóng / màn viền hiện dần khi tấm đã (gần như) tới nơi — trễ nhẹ sau tấm
      const rm = !!ctx.reduceMotion;
      const uiAt = rm ? 0 : dur * tnum(set, 'readerUiInAt');
      const uiDur = rm ? RM_FADE_MS / 1000 : Math.min(0.6, Math.max(0.3, dur * UI_IN_K));
      root.style.setProperty('--rd-in-delay', `${uiAt.toFixed(3)}s`);
      root.style.setProperty('--rd-in-dur', `${uiDur.toFixed(3)}s`);
      setOutDur(tnum(set, 'readerZoomOut'));
      startMotion('in', dur);
      // r85: hiệu ứng từng chữ của tiêu đề (đầu: tiêu đề lớn · Đề danh: "Đề danh Tiến sĩ") — chỉ khi có đoạn trượt (không giảm chuyển động)
      if (mo && !mo.rm && (at === 'top' || at === 'roll')) tfxArm(at);
      // textAt: tiến độ camera lúc chữ của tấm bắt đầu hiện (nhóm đầu) — hiệu ứng chữ Hán xong trước mốc này
      // r84: cùng công thức với readerTiming (settings.js) — chữ Hán / bảng cài đặt tính nhịp từ đó
      camStart('open', mo ? dur : 0, { at, textAt: mo ? (mo.rm ? 0 : mo.a + mo.lag[0] * (1 - mo.a)) : 0, slideAt: mo ? mo.a : 0 });
      window.addEventListener('resize', onResize);
      // phông về muộn (chiều cao chữ đổi): mở ở một phần mà người xem chưa cuộn → nhảy lại đúng chỗ
      const openY = scroll.scrollTop;
      document.fonts?.ready?.then(() => {
        if (!ov.isOpen) return;
        if (at !== 'top' && Math.abs(scroll.scrollTop - openY) < 1) jump(at, false);
        side.layout();
      });
    },
    /** Mỗi khung (lacquer.update, trước lượt vẽ) — r82: nhịp trượt / hiện của tấm theo đoạn camera. */
    tick,
    /** r82: tiến độ đoạn camera mở / đóng đang chạy — { phase: 'open' | 'close' | '', t: 0..1, dur } (móc cho hiệu ứng sau). */
    motion: () => ({ phase: cam.phase, t: cam.t, dur: cam.dur }),
    close: (why) => ov.close(why),
    jump: (key) => jump(key, true),
    get isOpen() {
      return ov.isOpen;
    },
    state: () => ({
      open: ov.isOpen,
      scroll: ov.scroller.state(),
      height: scroll.scrollHeight,
      view: scroll.clientHeight,
      k: +progressK().toFixed(4),
      rect,
      text: root.classList.contains('is-text'),
      settled: root.classList.contains('is-settled'),
      arch: { ...arch },
      mode,
      geo3: geo3 ? { ...geo3 } : null,
      offset: pageEl ? +(-parseFloat((pageEl.style.transform.match(/,\s*(-?[\d.]+)px/) || [0, 0])[1])).toFixed(2) : 0,
      // r82: nhịp trượt đang chạy (t = tiến độ camera, off = px tấm còn thấp hơn chỗ nghỉ, op = độ hiện nền tấm), độ dời hiện tại,
      // chữ (nhóm thẻ tiêu đề · thân bài: nhô thêm y px, độ hiện o), đoạn camera của móc, cao độ đối tượng CSS3D (nghỉ / hiện tại)
      motion: mo ? { phase: mo.phase, t: +mo.t.toFixed(4), dur: mo.dur, a: mo.a, off: +mo.off.toFixed(2), dist: mo.dist, op: +mo.op.toFixed(3), rm: mo.rm } : null,
      slide: +slideOff.toFixed(2),
      cut: cutY == null ? null : +cutY.toFixed(1),
      textFx: textFx.map((f) => ({ y: +f.y.toFixed(2), o: +f.o.toFixed(3) })),
      // r85: hiệu ứng tiêu đề — lượt đang chạy (state, chỗ mở, số chữ, số dòng, t giây) + lượt gần nhất
      titleFx: tfx ? { state: tfx.state, mode: tfx.mode, at: tfx.at, chars: tfx.chars.length, lines: tfx.lines, t: tfx.state === 'run' ? +((performance.now() - tfx.t0) / 1000).toFixed(3) : null, D: tfx.D, bodyStart: tfx.bodyStart } : null,
      titleFxLast: tfxLast,
      cam: { phase: cam.phase, t: +cam.t.toFixed(4), dur: cam.dur },
      obj3: obj3 && geo3 ? { y: obj3.position.y, base: base3Y, sigma: geo3.sigma } : null,
      slab: { transform: slab.style.transform, opacity: slab.style.opacity },
      cur: secs.find((s) => s.btn?.classList.contains('is-cur'))?.key ?? null,
      hot: hot ? { kind: hot._term ? 'term' : hot._bio ? 'author' : 'name', name: hot._term?.term ?? hot._bio?.name ?? hot._dd?.p.name, by: hotBy, card: card.classList.contains('is-on'), bio: card.classList.contains('has-bio'), links: card.classList.contains('has-links'), text: card.textContent } : null,
      notes: side.state(),
    }),
    /** r85 kiểm thử / chụp: đặt đồng hồ hiệu ứng tiêu đề đang chạy về giây t rồi áp ngay (vòng vẽ dừng thì đứng yên ở đó). */
    titleFxSeek(t) {
      if (tfx?.state !== 'run') return false;
      const now = performance.now();
      tfx.t0 = now - t * 1000;
      tfxStep(now);
      return true;
    },
    root: ov.root,
    scroll,
    dispose() {
      io?.disconnect();
      clearTimeout(cardT);
      clearTimeout(resizeT);
      offArch?.();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hand:frame', onHand);
      if (rig3) {
        rig3.removeFromParent();
        sheet3.remove();
      }
      ov.dispose();
    },
  };
}
