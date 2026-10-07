// Hằng số + hàm thuần của sân khấu Điện ảnh (C: tách nguyên văn từ phần đầu stage.js).
import * as THREE from 'three';
import { BG_OPTIONS, DEFAULTS } from '../../../core/settings.js';
import { DATA } from '../../../data/index.js';


/** Màu nền theo lựa chọn trong cài đặt (settings.bg.cinema). */
export function cinemaBg(id) {
  const list = BG_OPTIONS.cinema;
  return (list.find((o) => o.id === id) ?? list[0]).color;
}

/* --- ACES: nghịch đảo để suy màu sương ---------------------------------
   Màu nền (clear color) KHÔNG đi qua tone mapping, còn màu sương thì CÓ.
   Muốn chân trời liền mạch thì phải giải ngược: tìm màu sương nào sau
   ACES + exposure hiện hành sẽ ra đúng màu nền. Exposure đổi theo cài đặt
   người dùng nên phải tính lại mỗi lần cài đặt thay đổi. */
export function rrtOdtFit(v) {
  return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
}
export function invRrtOdtFit(y) {
  if (!(y > 0)) return 0;
  let lo = 0;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (rrtOdtFit(m) < y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
export const _fogCol = new THREE.Color();
export function fogColorFor(bgHex, exposure) {
  const c = new THREE.Color(bgHex); // Color quản lý màu → r/g/b đã ở không gian tuyến tính
  const k = Math.max(0.05, exposure) / 0.6; // three nhân exposure/0.6 trước khi vào ACES
  return _fogCol.setRGB(
    invRrtOdtFit(c.r) / k,
    invRrtOdtFit(c.g) / k,
    invRrtOdtFit(c.b) / k,
    THREE.LinearSRGBColorSpace,
  );
}

// Lắc con lắc quanh tư thế chính diện: mặt khắc chữ luôn nhìn thấy được,
// highlight của key quét qua nét chạm khi khối đảo qua đảo lại.
// ±20°: đủ để highlight key quét qua nét chạm, mà chữ số + nút trên mặt phẳng vẫn đọc được.
export const SWAY_A = THREE.MathUtils.degToRad(20);
export const SWAY_PERIOD = 26; // giây cho một chu kỳ đầy đủ
export const SWAY_RAMP = 1.2; // giây vào/ra — pha tăng tốc dần nên không giật
export const IDLE_SPIN = 4; // giây không tương tác → lắc trở lại
export const IDLE_CAM = 8; // giây không tương tác → camera về khung mặc định
// Góc lắc còn dư lúc đổi bia được tắt dần theo hằng số này (1/giây) — xem present().
export const SWAY_SETTLE = 4.5;
// r13 — hover (camera vòng về chính diện) / xoa đầu rùa GIỮ lắc lại: góc lắc đang có + VẬN TỐC đang có chuyển sang một
// lò xo tắt dần tới hạn (ω = SWAY_HOLD_W /s) về 0 — liền mạch, không vọt lố, luôn ~1,2 s bất kể đang ở pha nào (trước
// đây biên độ nhân (1 − f) của vòng hover 0,8 s → ở biên ±20° bia quật về nhanh gấp ~20 lần nhịp lắc: "giật về vị trí",
// chỉ "thỉnh thoảng" vì tuỳ pha). Rời hover: đợi vòng camera về gần xong (f < SWAY_RESUME_F) rồi lắc lại từ pha 0, tốc
// độ tăng dần SWAY_RAMP.
export const SWAY_HOLD_W = 4;
export const SWAY_HOLD_IN = 0.3;
export const SWAY_RESUME_F = 0.1;

// ---- Xoa đầu rùa (r8) --------------------------------------------------------------------------------
// Khung cận đầu rùa: 3/4 (cùng phía với góc nhìn mặc định), hơi từ trên xuống; vùng đầu chiếm RUB_FILL chiều
// cao khung. r10: vào RUB_IN / ra RUB_OUT đều theo easeLeave (khởi động mượt, 80 % quãng đường ở nửa thời gian,
// đuôi dài) — tâm xoay + khoảng cách + hai góc nội suy trong không gian quỹ đạo, cộng số hạng khớp vận tốc lúc bắt
// đầu (camera đang trôi / còn quán tính thì không khựng). Tới khung cận rồi, camera HOÀN TOÀN tự do: xoay / zoom
// đúng tốc độ thường, không bao giờ tự quay về khung cận.
export const RUB_AZ = 34; // độ
export const RUB_EL = 30; // độ
export const RUB_FILL = 0.34;
export const RUB_FILL_W = 0.5; // … và không quá ngần này bề ngang (khung dọc / hẹp)
export const RUB_IN = 2.0; // s
export const RUB_OUT = 2.0; // s
export const RUB_SWAY = 0.8; // s — lắc êm dần về 0 khi vào chế độ
/** Việc nền nặng (nạp trước / nung sẵn bia khác) chờ sân khấu yên ngần này (ms) — stage.whenCalm(). */
export const CALM_MS = 300;
/** r23: bàn tay đang điều khiển (body[data-hand-active]) → việc nền chờ thêm, nhưng không quá ngần này (ms) mỗi lượt giữ. */
export const HAND_CALM_MAX_MS = 1500;
/** Đầu rùa của từng bia (tools/measure-heads.mjs): { center:[x,y,z], radius } toạ độ mô hình, hoặc null. */
export const headOf = (id) => {
  // r21: số đo theo nguồn đang dùng (v2: đo trên LOD0 v2 · v1: src/data) + phần sửa tay (heads.overrides.json)
  const h = id ? DATA.heads?.steles?.[id] : null;
  return h?.center && h.radius > 0 ? { center: h.center, radius: h.radius, neck: h.neck ?? null } : null;
};

// Khung mặc định NHÌN THẲNG: bố cục cân đối trên mặt phẳng chỉ đúng khi camera chính diện.
export const AZIMUTH = 0;
export const ELEVATION = THREE.MathUtils.degToRad(7);
export const PADDING = 1.25; // khoảng cách khởi điểm, tinh chỉnh tiếp bằng vòng lặp bên dưới
// "Vùng an toàn" theo NDC: chừa hàng điều khiển trên + dải thanh thời gian / nút dưới,
// nhờ vậy chân bục không bao giờ bị mép dưới màn hình cắt.
export const SAFE_TOP = 0.05;
export const SAFE_TOP_TALL = 0.1; // màn dọc: mức sàn khi chưa đo được hàng trên
export const TOP_BAR_CLEAR = 12; // px — khe hở giữa đỉnh bia và đáy hàng trên (màn dọc)
export const SAFE_SIDE = 0.05;
export const SAFE_BOTTOM_WIDE = 0.15; // màn ngang: thanh thời gian + nút
export const SAFE_BOTTOM_TALL = 0.2; // màn dọc: thanh 10 đoạn + nút xếp chồng
export const STACK_W = 760; // khớp với điểm ngắt trong cinema.css
export const RING = 16; // số điểm mỗi vành khi lấy bóng của trụ quét

/* --- Mặt phẳng nội dung ---------------------------------------------------
   Một mặt phẳng tưởng tượng trùng với mặt trước tấm bia (con của khay, nên đung đưa và
   chuyển cảnh cùng đá). Các kiểu hiện thông tin (info/*.js) và tên người đỗ gắn nội dung
   lên chính mặt phẳng này. */
export const SLAB_LO = 0.45; // dải đo thân bia (tỉ lệ chiều cao): tránh đầu rùa chìa ra phía trước
export const SLAB_HI = 0.8;
export const LINE_Y = 0.75; // độ cao tham chiếu trên mặt bia (đo độ sâu mặt phẳng, góc nhìn)
export const PLANE_EPS = 0.004; // nhích mặt phẳng ra trước mặt đá một chút
// Hồ sơ bề ngang theo chiều cao (để tìm vai vòm / chân phiến): số lát cắt ngang.
export const PROFILE_BINS = 48;
// Con trỏ đứng yên nhưng bia đung đưa / camera trôi → bắn tia lại sau ngần này (ms).
export const RAY_REFRESH_MS = 120;
// "Đang chọn" (thông tin hiện): đèn bục (pedestal.js, dải trên + dải dưới). Không đèn nào chiếu thêm
// lên bia/rùa (đèn hắt chân rùa + rim × 2,5 cũ làm đỉnh mai rùa loá; đèn ngược đã bỏ theo ý khách).
// Ô chữ khắc sáng hơn ngần này (độ chói tương đối, đo trên khung đã tone map) → tên dùng mực đậm.
export const LUMA_INK = 0.2;
// Nhịp bật/tắt MỌI ánh sáng theo hover (r7) — MỘT hằng dùng chung: dải trên / dưới của bục + quầng,
// vũng sàn, ánh hắt, vành AO chân bục (tắt theo đèn dưới), và chuyển sáng kịch tính ↔ sáng đều (key,
// fill, hemi, môi trường, đèn rọi, bóng sàn). Vào 500 ms, ra 400 ms, easeInOutCubic; đảo chiều giữa
// chừng thì đi tiếp từ giá trị hiện tại (mức tuyến tính u, không nhảy về 0/1). Giảm chuyển động: 200 ms.
export const HOVER_FADE = Object.freeze({ in: 0.5, out: 0.4, reduced: 0.2 });
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/**
 * Đường cong "rời hover": ease-out đuôi dài có khởi động mượt. Vận tốc v(s) = (1 − s)^(k−1) × smoothstep(0,
 * 0,1, s), tích phân chuẩn hoá (bảng 257 mẫu). k = 2,506 để p(0,5) = 0,80 (ease-out thuần 1 − (1 − t)^2,32
 * cũng cho 0,80 nhưng bắt đầu ở vận tốc đỉnh). p(0,25) = 0,448 · p(0,5) = 0,800 · p(0,75) = 0,965 · p(0,9) = 0,996.
 */
export const easeLeave = (() => {
  const N = 256;
  const K = 2.5059;
  const A = 0.1;
  const lut = new Float32Array(N + 1);
  let acc = 0;
  let prev = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = Math.min(1, t / A);
    const v = (1 - t) ** (K - 1) * x * x * (3 - 2 * x);
    if (i > 0) acc += ((v + prev) / 2) / N;
    lut[i] = acc;
    prev = v;
  }
  for (let i = 0; i <= N; i++) lut[i] /= acc;
  return (t) => {
    const f = Math.min(1, Math.max(0, t)) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return lut[i] + (lut[i + 1] - lut[i]) * (f - i);
  };
})();
// ---- Hai trạng thái ánh sáng (settings.cinemaContrast 0..1):
//  · HOVER (thông tin đang hiện): sáng đều như preset 'cinematic' — không đổi gì.
//  · CHƯA HOVER: sáng kiểu tranh sơn dầu — đèn rọi (spot) chiếu mảng trên-trái của phiến bia, tắt dần
//    xuống dưới; key / fill / hemi / môi trường dịu bớt → rùa + chân bia tối hơn hẳn, tương phản cao.
//    Đèn rọi chỉnh được trong Cài đặt (settings.spot*: cường độ, màu, nửa góc chùm, độ mềm mép, hướng,
//    độ cao) và đứng YÊN trong không gian — bia lướt vào / ra vùng sáng khi chuyển cảnh.
//  Đèn rọi là nguồn đổ bóng DUY NHẤT của view này (key preset bị khoá không đổ bóng): bóng trên bia,
//  trên bục và trên sàn đều từ hướng đèn rọi, đậm nhạt theo đúng phần sáng đèn rọi góp vào (tắt khi
//  hover). Chuyển trạng thái chỉ đổi CƯỜNG ĐỘ → không vẽ lại shadow map; số đèn + số đèn đổ bóng cố
//  định từ lúc mount → không biên dịch lại shader.
//  Mức kịch tính e = cinemaContrast × (1 − hover); mọi hệ số dưới đây là ở e = 1.
// Đo ở 1440×900 (bia 1463, cinemaContrast 0,7): góc trên-trái phiến 0,27 (hover 0,22), đáy phiến
// 0,16–0,21, rùa 0,14 (hover 0,27); không điểm ảnh nào cháy.
export const IDLE_DEFAULTS = Object.freeze({
  key: 0.1, // key còn 10 %
  fill: 0.05,
  hemi: 0.15,
  env: 0.15,
  // Cường độ đèn rọi (candela) ở spotIntensity = 1. Rev 2: 40 → 75 khi hướng mặc định đổi −38°/58° →
  // −18°/80° (sượt từ trên xuống): góc tới mặt bia tại tâm ngắm cos 0,42 → 0,17, nên cần gần gấp đôi để
  // góc trên-trái vẫn sáng gần như cũ (đo: −12 % ở 1463, −6 % ở 1442) mà vi tương phản chữ khắc +22 % / +15 %.
  spot: 75,
});
// Đèn rọi trạng thái chưa hover: nhắm vào góc trên-trái phiến bia (tư thế đứng), cách tâm ngắm `dist`.
// az / el / angle (NỬA góc chùm, độ) / penumbra lấy từ cài đặt (spotAzimuth / spotElevation / spotAngle /
// spotSoftness — mặc định = đúng các số dưới đây); dist / decay / điểm ngắm là hằng.
// blur = nửa bề rộng vùng nhoè VSM ở tâm ngắm (giữ ≈ không đổi trong không gian khi đổi góc chùm);
// normalBias chống vệt tự đổ bóng. (Hạ cả hai xuống 2 mm / 1,2 mm không đổi gì trên mặt chữ: lưới quét
// không có rãnh chữ đủ sâu để đổ bóng — độ nổi chữ đến từ pháp tuyến + góc sượt, không từ bóng.)
export const IDLE_SPOT_DEFAULTS = Object.freeze({ az: DEFAULTS.spotAzimuth, el: DEFAULTS.spotElevation, dist: 2.3, angle: DEFAULTS.spotAngle, penumbra: DEFAULTS.spotSoftness, decay: 2, aimX: -0.22, aimY: 0.95, aimZ: 0.06, blur: 0.01, normalBias: 0.01 });
// Bóng đổ của đèn rọi (settings.cinemaCastShadow 0..1,5):
//  · trên bia / bục: shadow.intensity = min(1, cast) — bóng chỉ bớt đi phần sáng CỦA ĐÈN RỌI, nên tự
//    mờ theo đèn khi hover;
//  · trên sàn (đĩa hứng bóng, ShadowMaterial): độ đậm = SPOT_SHADOW_K × cast × spotIntensity × e,
//    nhân thêm độ suy giảm của nón đèn tại điểm sàn → ngoài chùm sáng không có bóng (không lộ mép
//    vuông của shadow camera).
//  cast = 0: không vẽ shadow map lần nào, đĩa hứng bóng ẩn.
export const SPOT_SHADOW_K = 1;
// Nhoè VSM: giữ bề rộng vùng nhoè ≈ không đổi TRONG KHÔNG GIAN khi đổi góc chùm (shadow camera của
// spot có fov = 2 × góc chùm → texel to ra khi chùm rộng) — IDLE_SPOT.blur.
export const SPOT_SHADOW_MAP = 1024; // một shadow map duy nhất như trước (key 1024²)
// ---- Đèn chính (key) của Điện ảnh: ĐÈN ĐIỂM suy giảm vật lý (decay 2) thay cho DirectionalLight của
// preset (không suy giảm → mặt bia sáng "phẳng"). settings.keyAzimuth / keyElevation đặt hướng như trước;
// settings.keyFalloff (0..1) đặt KHOẢNG CÁCH tới tâm ngắm: d = KEY_NEAR / falloff (trần KEY_FAR) → độ
// chênh sáng trên bia ≈ tỉ lệ với falloff. Cường độ bù d² để độ sáng TẠI TÂM NGẮM không đổi khi kéo
// thanh trượt — chỉ độ dốc sáng đổi. Không đổ bóng (đèn rọi vẫn là nguồn đổ bóng duy nhất).
export const KEY_NEAR = 1.2; // khoảng cách ở falloff = 1: đỉnh bia sáng gấp ~3 lần mõm rùa
export const KEY_FAR = 60; // falloff → 0: chênh < 4 % trên cả bia ≈ đèn định hướng cũ
export const KEY_AIM_Y = 0.55; // tâm ngắm: giữa thân bia (cộng độ nâng của bục)
// Bản đang dùng (DEV: __vm.cinemaPedestal.tune({ idle: {...}, idleSpot: {...}, spill: số }) đổi tức thì).
export const IDLE = { ...IDLE_DEFAULTS };
export const IDLE_SPOT = { ...IDLE_SPOT_DEFAULTS };
// Ánh hắt từ vòng sáng trên của bục lên mô hình (khi đèn bục bật): MỘT đèn điểm, không bóng, đặt
// NGAY DƯỚI mặt lòng bục ở phía vòng sáng hướng về camera → chỉ chạm mặt quay xuống / sườn (bụng
// mai, dưới đầu rùa, sườn dưới, mép dưới phiến bia), không bao giờ chạm mặt ngửa lên (đỉnh mai).
export const SPILL_DEFAULTS = Object.freeze({ i: 0.12, below: 0.025, ring: 0.9, dist: 1.1, decay: 2 });
export const SPILL = { ...SPILL_DEFAULTS };
// Thanh cỡ bục / cỡ chữ: dựng lại hình bục ngay (rẻ), còn chữ nổi + bóng + khung camera thì đợi
// người dùng dừng tay ngần này (ms) rồi làm MỘT lần.
export const PED_SETTLE_MS = 260;
export const clampNum = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
/** Đèn bục từ cài đặt (glow 0 = tắt dải đó). */
export const pedLightsOf = (s) => ({
  topGlow: clampNum(s.pedestalTopGlow, 0, 2, DEFAULTS.pedestalTopGlow),
  topColor: s.pedestalTopColor || '#ffffff',
  bottomGlow: clampNum(s.pedestalBottomGlow, 0, 2, DEFAULTS.pedestalBottomGlow),
  bottomColor: s.pedestalBottomColor || '#ffffff',
});

/* --- Bố cục & mờ theo góc ------------------------------------------------- */
export const STELE_X = 0.5; // tâm bia đúng giữa khung
// Góc nhìn mặc định (settings.cinemaViewAngle, r7): camera về khung ở phương vị này quanh trục bia
// (dương = sang PHẢI người xem, thấy mặt hông phải của bia). Khung được tính ở chính diện rồi XOAY cả
// cụm (camera + tâm nhìn) quanh trục bia — vành quét của bia và bục đều tròn nên bố cục giữ nguyên.
// Hai khay chuyển cảnh nằm trong nhóm `viewYaw` quay theo góc này → các hiệu ứng (lướt, trượt…) vẫn đi
// ngang khung hình như cũ; bia trong khay được xoay ngược lại nên vẫn đứng đúng hướng thật.
export const VIEW_TWEEN = 0.6; // s — đổi góc mặc định trong cài đặt: camera trôi về khung mới
// Hover → camera vòng về CHÍNH DIỆN + tiến gần một chút (settings.cinemaHoverFront / cinemaHoverZoom),
// rời → về lại góc 3/4 + khoảng cách mặc định. Cả cụm bục + bia đứng yên, chỉ camera di chuyển.
//  · VÀO 0,8 s easeInOutCubic (vòng + zoom một cử chỉ): 30° trong 0,5 s (nhịp đèn) thấy gấp; 0,8 s bắt đầu
//    cùng lúc với đèn, xong sau đèn một chút — êm.
//  · RA 2,5 s đuôi dài (easeLeave): 80 % quãng đường xong ở nửa thời gian, 20 % cuối chiếm nửa sau;
//    khởi động mượt (vận tốc tăng dần trong ~10 % đầu) thay vì giật ở vận tốc đỉnh như ease-out thuần.
//  · Đảo chiều giữa chừng: đoạn mới đi từ ĐÚNG vị trí + vận tốc đang có (thêm số hạng khớp vận tốc).
export const HOVER_ORBIT = 0.8;
export const HOVER_RETURN = 2.5;
// Vùng "giữ hover" (chống vòng lặp hover ↔ camera xoay làm bia trượt khỏi con trỏ): hợp hình chiếu của
// vành quét bia + bục ở CẢ khung 3/4 lẫn khung chính diện, nới thêm ngần này (NDC) mỗi phía.
export const LATCH_PAD_X = 0.1;
export const LATCH_PAD_Y = 0.08;
// r30: mép DƯỚI của vùng giữ hover chỉ nới ngần này dưới đáy rùa — bục / sàn không còn thuộc "bia" (1/3 dưới màn hình dành
// cho dòng thời gian: vùng dính của tay)
export const LATCH_PAD_BOT = 0.02;
// Độ tối nền (settings.cinemaBgDark 0..1, r7): hệ số nhân màu nền, sương, hồ sáng sàn. 0,5 = như cũ,
// 1 = đen tuyệt đối quanh sân khấu, 0 = sáng gấp 1,8.
export const bgDarkK = (d) => (d <= 0.5 ? 1 + (0.5 - d) * 1.6 : (1 - d) / 0.5);
// Kính đen (settings.dishGlass 0..1): độ phản chiếu của gương lòng bục theo Fresnel (Schlick, F0 0,04)
// của góc nhìn xuống lòng bục, CHUẨN HOÁ về góc nhìn ở khung mặc định (settings.reflection giữ nguyên
// nghĩa ở khung mặc định): nhìn sượt mạnh hơn, nhìn từ cao yếu đi. dishGlass = 0 → không Fresnel (như r6).
export const schlick = (cosT) => 0.04 + 0.96 * Math.pow(1 - THREE.MathUtils.clamp(cosT, 0, 1), 5);
// Nhiễu ổn định (IGN theo toạ độ điểm ảnh) ≈ 1/255, CỘNG vào màu cuối (sau tone mapping + sRGB) của các
// lớp sàn có dải chuyển tối mượt → xoá vệt bậc (banding) 8 bit. Chỉ dương: lượt trộn cộng / nhân trước
// làm tròn SAU khi cộng nên nhiễu dương [0, 1/255) là đủ; không chạy theo thời gian.
export const DITHER_GLSL = /* glsl */ `
  float cinDither() {
    return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) / 255.0;
  }
`;
// Mờ theo GÓC THẬT giữa pháp tuyến mặt phẳng (sau khi đung đưa) và hướng tới camera —
// một luật phủ cả xoay ngang, nhìn từ trên cao xuống lẫn nhìn từ phía sau.
// Góc giữa pháp tuyến mặt phẳng bia (sau khi đung đưa) và hướng tới camera.
// Đung đưa tối đa ±20° + cao độ mặc định 7° ≈ 21° → vẫn đục hoàn toàn khi rảnh.
// Nhìn từ trên (cao độ ~48°) hay chéo 40° → gần như ẩn (người dùng không muốn thấy chữ méo).
export const ANG_FULL = 24; // độ — trong khoảng này còn nguyên độ đục
export const ANG_ZERO = 42; // độ — quá mức này thì ẩn hẳn
export const POOL_R = 1.6; // bán kính hồ sáng (đơn vị)
export const FLOOR_R = 3; // bán kính đĩa sàn (hồ sáng + đĩa hứng bóng)
export const FLOOR_FADE = 0.72; // alpha hồ sáng về 0 ở 72% bán kính
// Mặt bục phản chiếu (settings.reflection 0..1 = ĐỘ ĐẬM của ảnh phản chiếu, 0 = không có lượt gương):
// lòng bục dưới chân rùa là gương phẳng NÉT — MỘT đĩa cho mỗi bục (core/reflective-floor.js,
// sharp + blend 'add': cộng ảnh phản chiếu lên mặt đá nên bóng đổ + bóng tiếp xúc của rùa vẫn còn
// nguyên). Render target chỉ phủ khung đĩa trên màn hình, cỡ = khung × DPR (trần DISH_RT_MAX).
// Sàn KHÔNG còn phản chiếu.
export const DISH_EPS = 0.0006; // đĩa gương nhô trên mặt lòng bục chừng này (dưới decal bóng tiếp xúc)
export const DISH_RT_MAX = 1024;
// r15: RT gương ở nửa độ phân giải mỗi chiều (1/4 số điểm ảnh) ở khung thường: ảnh phản chiếu cộng mờ lên đá lòng
// bục — không phân biệt được bằng mắt (khung mặc định / hover), lượt gương rẻ hẳn về fill-rate. Camera CẬN (chế độ xoa,
// tự zoom sát < DISH_FULL_NEAR × khoảng cách khung mặc định) thì ảnh phản chiếu to trên màn hình, nửa độ phân giải
// thấy mềm hơn → về đủ độ phân giải (trễ DISH_FULL_FAR để không bật tắt liên tục quanh ngưỡng).
export const DISH_RT_SCALE = 0.5;
export const DISH_FULL_NEAR = 0.65;
export const DISH_FULL_FAR = 0.75;
// r16 quét hiện: bia đầy đủ thay proxy từ dưới lên — một vạch ngang chạy từ chân lên đỉnh (easeInOutCubic).
export const REVEAL_S = 1.2;
export const REVEAL_PAD = 0.02; // vạch bắt đầu dưới chân / kết thúc trên đỉnh ngần này (đơn vị mô hình)
export const REVEAL_LINE = 0.006; // bề dày vệt sáng sát vạch (tắt dần theo e-mũ)
export const REVEAL_GLOW = 0.45; // độ sáng vệt
export const REVEAL_EDGE = 0.15; // r19: vệt sáng hiện / tắt dần trong ngần này (phần của lượt quét) ở hai đầu — không loé
// r19 — vẻ "đang chờ" của proxy (proxy.js setWait): hiện dần, viền thở, phần "đầy" theo tiến độ tải / dải sáng trôi.
export const PROXY_WAIT_IN = 0.8; // giây — vẻ chờ hiện dần (cubic vào-ra) từ lúc proxy lên khay
export const PROXY_BREATH_S = 2.4; // chu kỳ thở của viền (≈ 0,42 Hz — dưới 0,5 Hz, không nháy)
export const PROXY_BAND_S = 4.8; // biến thể 'outline': một lượt dải sáng trôi từ chân lên đỉnh
export const PROXY_FILL_TAU = 0.6; // phần "đầy" bám tiến độ tải (hàm mũ, giây)
export const PROXY_DRIFT_S = 8; // không biết tổng byte: phần "đầy" trôi lên chậm tới 85 % theo hằng số thời gian này
export const PROXY_FILL_SOFT = 0.05; // bề mềm mép phần "đầy" (đơn vị mô hình)
// Bóng tiếp xúc rùa ↔ mặt đỡ (contact.js, nướng một lần mỗi bia): độ đậm = settings.contactShadow (0..1,5).

export const LIGHT_TARGET = new THREE.Vector3(0, 0.5, 0);
export const LIGHT_DIST = 4;
export const RIM_OFFSET = 150; // độ — rim luôn chếch sau lưng vật thể so với camera
export const RIM_EL = 28;


/**
 * Decal "hồ sáng": vệt sáng toả tròn vẽ CỘNG lên sàn. Sắc độ đi theo đèn key ấm — xám trung tính hơi
 * ấm, KHÔNG ngả tím: vũng sáng của chính ngọn đèn hắt xuống. Đỉnh #3a3734 trước tone mapping; alpha tan
 * về 0 ở FLOOR_FADE × bán kính nên không thấy mép đĩa.
 * r7: tính GIẢI TÍCH trong shader (các mốc y hệt bản canvas cũ) thay cho texture canvas 8 bit — texture
 * 8 bit + đầu ra 8 bit của một dải tối rất dài gây vòng bậc thấy rõ (đo: bước 1/255 mỗi 12–20 px, lệch
 * pha giữa các kênh → vòng ửng hồng / tím). Thêm nhiễu ổn định ≈ 1/255 ở đầu ra (DITHER_GLSL).
 * uK = hệ số độ tối nền (settings.cinemaBgDark).
 */
export function makePoolMaterial() {
  const P = POOL_R / FLOOR_R;
  // [u, r, g, b, a] — r, g, b theo sRGB 0..255 như mốc canvas cũ
  const STOPS = [
    [0, 58, 55, 52, 1],
    [P * 0.3, 49, 46, 43, 1],
    [P * 0.62, 32, 30, 28, 0.95],
    [P, 17, 16, 15, 0.7],
    [FLOOR_FADE * 0.72, 9, 8, 8, 0.34],
    [FLOOR_FADE * 0.88, 4, 4, 4, 0.12],
    [FLOOR_FADE, 0, 0, 0, 0],
  ];
  const f = (v) => v.toFixed(5);
  let body = '';
  for (let i = STOPS.length - 1; i > 0; i--) {
    const [u0, r0, g0, b0, a0] = STOPS[i - 1];
    const [u1, r1, g1, b1, a1] = STOPS[i];
    body += `  if (u >= ${f(u0)}) return mix(vec4(${f(r0 / 255)}, ${f(g0 / 255)}, ${f(b0 / 255)}, ${f(a0)}), vec4(${f(r1 / 255)}, ${f(g1 / 255)}, ${f(b1 / 255)}, ${f(a1)}), clamp((u - ${f(u0)}) / ${f(u1 - u0)}, 0.0, 1.0));\n`;
  }
  return new THREE.ShaderMaterial({
    uniforms: { uK: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      uniform float uK;
      varying vec2 vUv;
      ${DITHER_GLSL}
      vec4 poolStop(float u) {
        if (u >= ${f(FLOOR_FADE)}) return vec4(0.0);
${body}        return vec4(0.0);
      }
      void main() {
        vec4 c = poolStop(length(vUv - 0.5) * 2.0);
        vec3 lin = pow(c.rgb, vec3(2.2)); // sRGB → tuyến tính (khớp đủ ở vùng tối)
        gl_FragColor = vec4(lin * c.a * uK, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb += cinDither() * smoothstep(0.0, 0.02, c.a); // chỉ nơi có hồ sáng: không nâng nền
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    toneMapped: true,
  });
}

const _upBox = new THREE.Box2();
const _upPos = new THREE.Vector2();
/**
 * r41 — đẩy các HÀNG [y, y + h) của texture nguồn (dữ liệu CPU RGBA8, hoặc ImageBitmap / ảnh DOM) vào texture đích đã cấp
 * bộ nhớ (renderer.initTexture → texStorage2D). Thay renderer.copyTextureToTexture: mỗi lần gọi three ĐỌC LẠI 5 trạng thái
 * UNPACK_* bằng gl.getParameter để khôi phục — lời gọi đồng bộ sang tiến trình GPU của Chrome, phải chờ hàng lệnh GPU chạy
 * hết: 1–10 ms mỗi dải, rơi đúng lúc lướt / lúc tay đang điều khiển (MediaPipe cũng dùng GPU). Ở đây chỉ GHI trạng thái
 * (pixelStorei không đồng bộ) rồi trả UNPACK_ROW_LENGTH / SKIP_ROWS về 0 — đúng giá trị three để lại ở mọi chỗ khác (nó chỉ
 * đổi tạm trong copyTextureToTexture / updateRanges rồi trả lại giá trị đọc được). Dữ liệu CPU: các hàng liền nhau →
 * subarray, khỏi cần ROW_LENGTH / SKIP. Dải cuối (last) dựng mipmap như copyTextureToTexture. Định dạng khác RGBA8 / lật Y →
 * đường cũ của three.
 */
export function uploadRows(renderer, src, dst, y, h, last = false) {
  const img = src.image;
  const data = img?.data;
  const cpu = data instanceof Uint8Array || data instanceof Uint8ClampedArray;
  const fits = dst.format === THREE.RGBAFormat && dst.type === THREE.UnsignedByteType && !dst.flipY && !src.isCompressedTexture && (cpu ? src.format === THREE.RGBAFormat && src.type === THREE.UnsignedByteType : !data);
  const tex = fits ? renderer.properties.get(dst).__webglTexture : null;
  if (!tex) {
    _upBox.min.set(0, y);
    _upBox.max.set(img.width, y + h);
    renderer.copyTextureToTexture(src, dst, _upBox, _upPos.set(0, y));
    return;
  }
  const gl = renderer.getContext();
  const W = img.width;
  renderer.state.bindTexture(gl.TEXTURE_2D, tex, gl.TEXTURE0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, dst.premultiplyAlpha);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, dst.unpackAlignment);
  if (cpu) {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, W, h, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(y * W * 4, (y + h) * W * 4));
  } else {
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, W);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, W, h, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }
  if (last && dst.generateMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  renderer.state.unbindTexture();
}
