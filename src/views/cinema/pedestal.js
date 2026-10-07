// BỤC dưới mỗi tấm bia (settings.cinemaPedestal) — một bục cho mỗi khay chuyển cảnh.
//
// MỌI BIA CÙNG MỘT CỠ BỤC: bán kính chuẩn R0 = dấu chân rùa lớn nhất cả bộ + đệm (tools/
// measure-pedestal.mjs → src/data/pedestal.generated.json, stage.js tính). settings.pedestalSize
// nhân BÁN KÍNH: R = R0 × size. Chỉ bán kính đổi — mọi kích thước DỌC (cao bục, bề cao dải vát, độ
// lõm lòng bục) và mọi khoảng lùi NGANG (bề rộng hai dải sáng, phần lùi của mặt vát, bo góc) giữ
// nguyên đơn vị tuyệt đối tính theo R0: bục to hơn chỉ là "phình ra", không cao lên, chữ không đổi cỡ.
//
// Tỉ lệ lấy ĐÚNG từ mô hình Blender của khách (đo lưới gốc, chuẩn hoá theo bán kính ngoài R, ở đây = R0):
//   1. chân lõm      r = 0,956R, h 0 → 0,024R                                (đá tối)
//   2. DẢI SÁNG DƯỚI mặt dưới gờ, (0,956R, 0,024R) → (R, 0,028R) — ngửa xuống-ra ngoài, hắt lên sàn
//   3. thân đứng     r = R, h 0,028R → 0,075R
//   4. DẢI VÁT CHỮ   (R, 0,075R) → (0,816R, 0,201R) — dài ≈ 0,223R, dốc ≈ 34°; mesh RIÊNG:
//                    u = vòng quanh trục, v = dọc mặt vát, tangent tính sẵn → chữ nổi sáng đúng hướng
//   5. DẢI SÁNG TRÊN vát vào trong và xuống, (0,816R, 0,201R) → (0,755R, 0,175R) — nhìn lên, về phía rùa
//   6. lòng bục      phẳng ở h = 0,175R (r ≤ 0,755R) — bia + rùa ĐỨNG Ở ĐÂY (thấp hơn mép vành)
//   Tổng cao H = 0,201R (hệ quả của R). Góc lồi bo nhẹ ~0,004R (giả Subsurf), mặt vát giữ phẳng.
// Đèn (tắt khi nghỉ = bục đá tối; bật khi thông tin hiện): hai mặt dải sáng phát sáng (lớp cộng sáng
// phủ lên mặt đá), mỗi dải một quầng mềm; dải dưới hắt vũng sáng lên sàn (sàn satin soi lại được);
// tia mờ dâng từ dải trên (RAYS_ENABLED). Dải TRÊN (dải + quầng + tia) và dải DƯỚI (dải + quầng +
// vũng sàn) có độ sáng / màu riêng (settings.pedestalTop*, pedestalBottom*; 0 = tắt hẳn dải đó).
// Đá graphite satin: đổ bóng mềm xuống sàn, NHẬN bóng bia ở lòng bục, có trong ảnh phản chiếu.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { neverCastShadow } from './hotspot.js';
import { acquireRelief, releaseRelief } from './relief.js';
import { RIPPLE_NORMAL_K } from './ripple.js';

/** Bỏ tia hắt lên chỉ bằng một hằng số (khách có thể không giữ). */
export const RAYS_ENABLED = true;

// ---- Tỉ lệ bục (mọi kích thước theo bán kính CHUẨN R0) ------------------------------------------
// Điểm xuất phát là số đo mô hình Blender của khách (ước lượng của họ); các núm dưới đây đã chỉnh
// bằng mắt trong cảnh thật (xem báo cáo). DEV: __vm.cinemaPedestal.tune({ pad, hr, slope, dish, strip,
// size, text, perStele }) dựng lại tức thì, không ghi
// vào cài đặt.
export const PEDESTAL_DEFAULTS = Object.freeze({
  // Chỉnh bằng mắt từ số Blender (so ba phương án A/B/D ở 1440×900, 988×616 và xoay 25°):
  pad: 0.07, // hở từ mép quét xa nhất của bia tới mép bục, đơn vị thế giới (Blender ≈ 0,09).
  //           Với phần lớn bia, bán kính bị CHÂN rùa quyết định (chân phải nằm trong mép vành),
  //           pad nhỏ hơn chỉ gọn bục ở các bia chân hẹp.
  hr: 0.2, // tổng chiều cao / R (Blender 0,201) — giữ: thấp hơn thì dải vát ngắn, chữ mặt sau < 11 px ở 988×616
  slope: 36, // độ dốc mặt vát, độ (Blender ≈ 34) — dốc hơn chút: mặt vát lùi vào ít hơn → vành rộng
  //            hơn cho chân rùa → R nhỏ hơn ~2%, chữ gần như không đổi cỡ
  dish: 0.026, // độ lõm lòng bục dưới mép vành / R (Blender 0,026) — giữ: rùa "ngồi trong" bục
  strip: 1.2, // hệ số bề rộng hai dải sáng (Blender = 1: trên 0,061R, dưới 0,044R) — đậm hơn 20%
  //             để khi bật đèn đọc rõ là hai NÉT sáng ở cả khung 988×616
});
/** Cấu hình đang dùng (DEV có thể đổi qua tune). */
export const PEDESTAL = { ...PEDESTAL_DEFAULTS };
const BASE_H = 0.024; // chiều cao chân lõm / R
const LIP_RISE = 0.004; // mặt dưới gờ (dải sáng dưới) dốc lên ra ngoài / R
const SIDE_TOP = 0.075; // đỉnh thân đứng / R (Blender)
const TOP_STRIP_W = 0.061; // bề rộng dải sáng trên (theo phương bán kính) / R, × strip
const BOTTOM_STRIP_W = 0.044; // bề rộng dải sáng dưới / R, × strip
const BASE_CLEAR = 0.005; // chân bia (3% dưới cùng) phải nằm trong mép vành, chừa ngần này
const BEVEL = 0.004; // bo góc lồi (× R), giả Subsurf
const SEG = 128;
const RAY_H = 0.4;
const RAY_PEAK = 0.13;
const STONE = 0x2b2b2f;
// r16: chữ khắc "mọc lên" khi bia hạ xuống bục (textPlay): từ phẳng (màu nền graphite, không pháp tuyến) tới nổi hết.
// Mặt trước: lan từ số năm ở giữa ra hai bên trong TEXT_STAGGER giây; mỗi điểm mọc trong TEXT_GROW giây (ease-out
// cubic) → trọn một lượt ≈ 1 s. Mặt sau bắt đầu trễ TEXT_BACK_DELAY. Vệt sáng mảnh chạy theo đầu sóng (TEXT_SWEEP).
const TEXT_STAGGER = 0.45;
const TEXT_GROW = 0.5;
const TEXT_BACK_DELAY = 0.15;
const TEXT_BACK_STAGGER = 0.35;
const TEXT_TOTAL = Math.max(TEXT_STAGGER, TEXT_BACK_DELAY + TEXT_BACK_STAGGER) + TEXT_GROW;
const TEXT_SWEEP = [0.2, 0.15, 0.085]; // tuyến tính — vàng ấm, mờ; chỉ ở dải đang mọc (xem growSweep)
/**
 * Chất liệu lòng bục (settings.dishGlass 0..1, r7) — nội suy MỌI thông số giữa hai đầu, cùng MỘT chương
 * trình shader (chỉ uniform / thuộc tính → kéo thanh trượt không biên dịch lại):
 *   0 = ĐÁ (đúng lòng bục r6): graphite #2b2b2f, nhám 0,5, kim loại 0,15, trần phản xạ đèn 0,06, IBL đủ;
 *   1 = KÍNH ĐEN: gần đen tuyệt đối, rất bóng, không kim loại — chỉ thấy những gì nó PHẢN CHIẾU (bia +
 *       rùa qua gương phẳng của stage, mạnh dần ở góc sượt — Fresnel ở stage), vòng sáng phía xa khi
 *       hover, ánh đèn thành chấm nhỏ sắc (trần 0,35); IBL tắt → không loang xám.
 */
export const DISH_STONE = Object.freeze({ color: 0x2b2b2f, roughness: 0.5, metalness: 0.15, cap: 0.06, env: 1 });
export const DISH_GLASS = Object.freeze({ color: 0x050506, roughness: 0.12, metalness: 0, cap: 0.35, env: 0 });
// Giữ tên cũ cho DEV tune('reset') — mặc định là đầu ĐÁ (dishGlass mặc định 0).
export const DISH_COLOR = DISH_STONE.color;
export const DISH_MAT_DEFAULTS = Object.freeze({ roughness: DISH_STONE.roughness, metalness: DISH_STONE.metalness, envMapIntensity: 0.35 });
/** Trần phản xạ trực tiếp của đèn trên lòng bục (bức xạ tuyến tính, trước tone mapping) ở đầu ĐÁ. */
export const DISH_SPEC_CAP = DISH_STONE.cap;
/** Hệ số IBL (môi trường) trên lòng bục ở đầu ĐÁ. */
export const DISH_ENV = DISH_STONE.env;
// r22 — lòng bục KHÔNG còn soi "đèn":
//  · rim của preset (DirectionalLight camera + 150°, cao 28°, xanh lạnh, 2,4) chiếu sượt lòng bục như đã chiếu sượt đá bục
//    → cả lòng bục loé xám-xanh khi bục trượt qua hướng phản xạ của nó lúc Lướt (đo: lòng bục vào khung 0,07 → 0,36) và
//    thành một mảng "đèn phản chiếu" khi nhìn từ trên. Trừ HẾT phần của rim trên lòng bục (như đá thân / mặt vát).
//  · môi trường studio (core/lighting.js) có softbox TRẦN ngay trên đầu → nhìn từ cao, lòng bục soi thấy nó. Phản xạ môi
//    trường theo hướng NGỬA LÊN bị tắt dần (hướng phản xạ thế giới y từ DISH_ENV_UP.from → .to); phản xạ sượt giữ nguyên.
export const DISH_RIM_CUT = 1;
// Bù lại tông "satin" mà phản xạ rim từng cho lòng bục ở khung mặc định — nhưng KHÔNG phụ thuộc góc nhìn (bức xạ tuyến
// tính cộng đều, như một lớp men): lòng bục giữ tông cũ ở khung thường, không loé khi trượt, không thành mảng đèn từ trên.
// k ở đầu ĐÁ (dishGlass 0), giảm tuyến tính về 0 ở đầu kính; mặc định dishGlass 0,1 → 0,043 = khớp độ sáng lòng bục cũ
// ở khung mặc định (đo vành trước lòng bục, bia 1554: 0,175 → 0,178).
export const DISH_SHEEN = Object.freeze({ color: 0xcfe0ff, k: 0.048 });
export const DISH_ENV_UP = Object.freeze({ k: 1, from: 0.35, to: 0.8 });
const _dishA = new THREE.Color(DISH_STONE.color);
const _dishB = new THREE.Color(DISH_GLASS.color);
const STONE_DARK = 0x151518;

// ---- Vệt sáng mặt vát (settings.pedestalHighlight / pedestalHighlightPos) ----------------------
// MỘT "đèn ảo" chỉ có trong vật liệu đá của bục (mặt vát chữ + thân + vành), tính thẳng trong shader
// bằng chính hàm chiếu sáng của three (RE_Direct → khuếch tán + phản xạ GGX, ăn theo bản đồ pháp tuyến
// chữ nổi): rọi chếch từ trên xuống, TÂM ở phương vị cố định trên bục (r7: 0° = giữa chữ mặt trước, tức
// số năm, + độ lệch người dùng chọn) — không đi theo camera: khung 3/4 hay xoay camera thì số năm vẫn
// được rọi, như một ngọn đèn thật đặt trước bệ. Cửa sổ cos^k theo phương vị làm nó thành một VỆT.
// Không thêm đèn vào cảnh, vật liệu khác không tốn gì; mọi thông số là uniform.
const HL_EL = 62; // độ cao của đèn ảo (°) — rọi chếch từ trên xuống: nét chữ nổi có mép sáng / mép tối
const HL_SHARP = 10; // số mũ cửa sổ cos^k theo phương vị: nửa bề rộng ở nửa độ sáng ≈ 21°
const HL_GAIN = 2.2; // cường độ (lux tương đối) ở pedestalHighlight = 1
const HL_COLOR = 0xfff0e0; // trắng ấm nhẹ
// Đèn rim của preset (DirectionalLight camera + 150°, cao 28°, KHÔNG dịu đi khi chưa hover) chiếu sượt
// mặt phải của bục → vệt sáng lệch phải (đo: vệt mặt vát phải 0,199 → 0,014 khi tắt rim). Rim vẫn có
// ích cho viền bia / mai rùa, nên chỉ TRỪ phần của nó trên đá bục (cùng RE_Direct, màu âm = trừ đúng
// từng số hạng khuếch tán + phản xạ).
const RIM_CUT = 1;

// ---- Bóng chân bục trên sàn (settings.pedestalFloorShadow): vành AO giải tích quanh chân bục ------
const FLOOR_AO_W = 0.12; // bề rộng vùng tối dần ra ngoài tính từ mép gờ (đơn vị thế giới)
const FLOOR_AO_PEAK = 0.62; // độ đậm sát chân ở pedestalFloorShadow = 1

/** Profile (r, h) theo R từ cấu hình — xem đầu tệp để biết thứ tự các mặt. */
export function profileOf(cfg = PEDESTAL) {
  const w = Math.max(0.3, cfg.strip);
  const rise = Math.max(0.03, cfg.hr - SIDE_TOP);
  const run = rise / Math.tan((Math.max(15, Math.min(75, cfg.slope)) * Math.PI) / 180);
  const rimR = 1 - run;
  const dishR = rimR - TOP_STRIP_W * w;
  const dishH = cfg.hr - Math.max(0.004, cfg.dish);
  return {
    base0: [1 - BOTTOM_STRIP_W * w, 0],
    base1: [1 - BOTTOM_STRIP_W * w, BASE_H],
    lip: [1, BASE_H + LIP_RISE],
    sideTop: [1, SIDE_TOP],
    rim: [rimR, cfg.hr],
    dishEdge: [dishR, dishH],
  };
}

/**
 * Bán kính chuẩn R0 cho một dấu chân: quét xa nhất (kể cả rùa) + pad, và CHÂN bia nằm gọn trong
 * mép vành (lòng bục lõm nên vành che nhẹ mép dưới rùa — đúng ý "đứng trong lòng bục").
 * Gọi với dấu chân LỚN NHẤT cả bộ → một cỡ cho mọi bia.
 */
export function pedestalRadiusFor(foot, cfg = PEDESTAL) {
  const P = profileOf(cfg);
  return Math.max(foot.swept + cfg.pad, (foot.base + BASE_CLEAR) / P.rim[0]);
}

/**
 * Profile TUYỆT ĐỐI (đơn vị thế giới) cho bán kính chuẩn R0 và bán kính thật R = R0 × size:
 * cao độ h × R0 (không đổi theo size); bán kính lùi vào từ mép ngoài đúng (1 − r) × R0 (không đổi),
 * nên chỉ mép ngoài dời ra/vào theo R.
 */
export function shapeOf(R0, R, cfg = PEDESTAL) {
  const P = profileOf(cfg);
  const X = (p) => [R - (1 - p[0]) * R0, p[1] * R0];
  const out = {};
  for (const k of Object.keys(P)) out[k] = X(P[k]);
  return out;
}

const lathe = (pts) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    SEG,
    -Math.PI, // u = 0,5 ở phương vị 0 (mặt trước, +z) — chữ năm căn giữa đúng đó
    Math.PI * 2,
  );

const flatVert = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Quầng của vòng sáng TRÊN (r7): nằm NGAY TRÊN MẶT LÒNG BỤC và chỉ toả VÀO TRONG từ chân mặt vát
// sáng (uR = bán kính lòng bục) — ánh sáng hắt xuống kính đen quanh chân rùa. Ngoài uR (dưới chính
// mặt vát sáng) không vẽ gì. Nằm thấp hơn mép vành nên phía gần camera bị chính bục che (depthTest),
// không còn lơ lửng phủ lên mặt vát đen như quầng phẳng cũ (đặt ở giữa độ cao vành ↔ lòng bục và toả
// ra NGOÀI tới quá mép vành → nhìn từ trước thấy như một vòng sáng thứ hai xuyên qua mặt vát).
const topSpillFrag = /* glsl */ `
  uniform float uHalf;
  uniform float uR;
  uniform float uS;
  uniform float uGain;
  uniform vec3 uColor;
  varying vec2 vLocal;
  void main() {
    float d = length(vLocal) * uHalf;
    float x = uR - d;
    if (x < 0.0) discard;
    float a = exp(-(x * x) / (uS * uS)) * 0.3 * uGain;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, min(a, 1.0));
  }
`;

// Sàn quanh chân bục — MỘT lượt vẽ cho hai việc (alpha nhân trước: đích × (1 − a) + màu):
//   · vành AO (settings.pedestalFloorShadow): tối nhất ngay dưới mép gờ, tắt dần trong uAoW ra ngoài —
//     bóng tiếp xúc GIẢ (giải tích, không tính bóng); tắt dần theo đèn dưới (vùng đó đang được rọi);
//   · vũng sáng của đèn dưới (hover): đỉnh ngay dưới mép gờ, toả ra ngoài.
// Độ đậm AO > 1: 1 − (1 − a)^k như bóng tiếp xúc — dày lên mà alpha không vượt 1.
const floorFrag = /* glsl */ `
  uniform float uHalf;
  uniform float uR;
  uniform float uGain;
  uniform vec3 uColor;
  uniform float uAoR;
  uniform float uAoW;
  uniform float uAo;
  varying vec2 vLocal;
  void main() {
    float d = length(vLocal) * uHalf;
    float x = d - uR;
    float s = x < 0.0 ? 0.03 : 0.11;
    float g = exp(-(x * x) / (s * s)) * 0.5 * uGain;
    float t = clamp((d - uAoR) / uAoW, 0.0, 1.0);
    float o = ${FLOOR_AO_PEAK.toFixed(3)} * pow(1.0 - t, 2.2) * (1.0 - smoothstep(0.75, 1.0, t));
    float a = uAo <= 1.0 ? o * uAo : 1.0 - pow(max(1.0 - o, 0.0), uAo);
    if (g < 0.002 && a < 0.003) discard;
    // nhiễu ổn định ≈ 1/255 (IGN) nơi có vành / vũng sáng: dải tối mượt không thành vòng bậc 8 bit
    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) / 255.0;
    gl_FragColor = vec4(uColor * min(g, 1.0) + n, a);
  }
`;

const bandVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Dải sáng DƯỚI (viền gờ, trụ hở) và quầng của nó (trụ cao hơn, mờ dần theo chiều dọc).
const stripFrag = /* glsl */ `
  uniform float uGain;
  uniform vec3 uColor;
  void main() {
    float a = min(uGain, 1.0);
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;
const bloomBandFrag = /* glsl */ `
  uniform float uGain;
  uniform float uSigma;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float y = vUv.y - 0.5;
    float a = exp(-(y * y) / (uSigma * uSigma)) * 0.28 * uGain;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, min(a, 1.0));
  }
`;

const rayVert = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vN;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    vN = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
// Tia: alpha giảm theo chiều cao, vệt dọc trôi chậm, alpha theo hướng nhìn → không phủ lên con rùa.
const rayFrag = /* glsl */ `
  uniform float uTime;
  uniform float uGain;
  uniform float uPeak;
  uniform vec3 uColor;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noiseW(vec2 p, float P) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, P);
    float x1 = mod(i.x + 1.0, P);
    return mix(mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), u.x),
               mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), u.x), u.y);
  }
  void main() {
    float h = vUv.y;
    vec3 V = normalize(cameraPosition - vPos);
    float rim = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
    float fall = pow(1.0 - h, 1.7) * smoothstep(0.0, 0.05, h);
    float s = 0.6 * noiseW(vec2(vUv.x * 72.0, h * 1.6 - uTime * 0.045), 72.0)
            + 0.4 * noiseW(vec2(vUv.x * 150.0, h * 2.8 - uTime * 0.07), 150.0);
    float streak = mix(0.3, 1.0, smoothstep(0.3, 0.8, s));
    float a = uPeak * uGain * rim * fall * streak;
    if (a < 0.001) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function additive(uniforms, vertexShader, fragmentShader, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false, // trắng thật, không bị ACES làm xám
    fog: false,
    ...extra,
  });
}

/** Mã màu hex → vec3 sRGB (shader ghi thẳng ra bộ đệm sRGB, không qua quản lý màu). */
export function srgbVec(hex, out = new THREE.Vector3()) {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : Number(hex);
  const v = Number.isFinite(n) ? n : 0xffffff;
  return out.set(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

/** Mảnh lathe có bo góc: trả về danh sách điểm [r,h] cho một đường gấp khúc, bo các góc lồi. */
function withBevels(points, convex, b) {
  // points: [[r,h]...] (đơn vị thế giới); convex[i] = true → bo góc tại điểm i (không bo hai đầu
  // mút); b = bán kính bo (đơn vị thế giới).
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const c = points[i];
    if (i === 0 || i === points.length - 1 || !convex[i]) {
      out.push({ p: c, smooth: false });
      continue;
    }
    const a = points[i - 1];
    const n = points[i + 1];
    const da = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const dn = Math.hypot(n[0] - c[0], n[1] - c[1]);
    const pa = [c[0] + ((a[0] - c[0]) / da) * b, c[1] + ((a[1] - c[1]) / da) * b];
    const pn = [c[0] + ((n[0] - c[0]) / dn) * b, c[1] + ((n[1] - c[1]) / dn) * b];
    const pm = [c[0] + (pa[0] - c[0] + pn[0] - c[0]) * 0.3, c[1] + (pa[1] - c[1] + pn[1] - c[1]) * 0.3];
    out.push({ p: pa, smooth: true }, { p: pm, smooth: true }, { p: pn, smooth: true });
  }
  return out;
}

/** Dựng lathe cho từng đoạn thẳng (cạnh cứng) và từng góc bo (mịn). */
function buildProfile(pts) {
  const geos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.smooth && b.smooth) {
      // gom cả cung bo (3 điểm liền nhau) thành một lathe để pháp tuyến nội suy mịn
      const arc = [a.p];
      let j = i + 1;
      while (j < pts.length && pts[j].smooth) arc.push(pts[j++].p);
      geos.push(lathe(arc));
      i = j - 2;
      continue;
    }
    geos.push(lathe([a.p, b.p]));
  }
  return geos;
}

const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();

export function createPedestal() {
  const group = new THREE.Group();
  group.name = 'cinema-pedestal';

  // ---- Đá
  const stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.5, metalness: 0.15, envMapIntensity: 0.35 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: STONE_DARK, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.25 });
  const bandMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.5, metalness: 0.15, envMapIntensity: 0.35 });
  // Vệt sáng mặt vát + trừ rim: chung một bộ uniform cho đá thân và mặt vát của bục NÀY (updateView).
  const HU = {
    uHlColor: { value: new THREE.Vector3() }, // tuyến tính, đã nhân cường độ
    uHlDirW: { value: new THREE.Vector3(0, 1, 0) }, // hướng TỚI đèn ảo (thế giới)
    uHlCentre: { value: new THREE.Vector2(0, 1) }, // phương vị tâm vệt (xz trong toạ độ bục)
    uHlSharp: { value: HL_SHARP },
    uRimDirW: { value: new THREE.Vector3(0, 1, 0) },
    uRimColor: { value: new THREE.Vector3() }, // màu × cường độ rim × RIM_CUT (tuyến tính)
  };
  const hl = { strength: 1, pos: 0, color: new THREE.Color(HL_COLOR) };
  const withHighlight = (mat, key) => {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, HU);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHlObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvHlObj = transformed;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uHlColor;\nuniform vec3 uHlDirW;\nuniform vec2 uHlCentre;\nuniform float uHlSharp;\nuniform vec3 uRimDirW;\nuniform vec3 uRimColor;\nvarying vec3 vHlObj;',
        )
        .replace(
          '#include <lights_fragment_end>',
          [
            '{',
            '\tvec2 hlAz = normalize( vHlObj.xz + vec2( 1e-6 ) );',
            '\tfloat hlW = pow( max( dot( hlAz, uHlCentre ), 0.0 ), uHlSharp );',
            '\tIncidentLight hlLight;',
            '\thlLight.visible = true;',
            '\thlLight.direction = normalize( ( viewMatrix * vec4( uHlDirW, 0.0 ) ).xyz );',
            '\thlLight.color = uHlColor * hlW;',
            '\tRE_Direct( hlLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
            '\thlLight.direction = normalize( ( viewMatrix * vec4( uRimDirW, 0.0 ) ).xyz );',
            '\thlLight.color = - uRimColor;',
            '\tRE_Direct( hlLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
            '}',
            '#include <lights_fragment_end>',
          ].join('\n'),
        );
    };
    mat.customProgramCacheKey = () => key;
  };
  withHighlight(stone, 'cinema-ped-stone-hl-v1');
  withHighlight(bandMat, 'cinema-ped-band-hl-v1');
  // ---- Chữ khắc mọc lên (r16): uGrow.x = giây kể từ lúc bắt đầu (< 0 = ẩn hẳn: mặt vát phẳng; ≥ 1e2 = nổi hết),
  // uGrow.yz = nửa bề ngang cụm chữ mặt trước / mặt sau (đơn vị u của bản đồ), uGrow.w = độ sáng vệt sáng.
  // Chỉ đổi uniform — MỘT chương trình cho mọi trạng thái; ở trạng thái nổi hết cho kết quả y hệt trước r16.
  const GU = {
    uGrow: { value: new THREE.Vector4(1e3, 0.2, 0.12, 1) },
    uGrowBase: { value: new THREE.Color(STONE) }, // màu nền của bản đồ chữ (BASE ở relief.js = #2b2b2f), tuyến tính
    uGrowSweep: { value: new THREE.Vector3(...TEXT_SWEEP) },
  };
  const hlBand = bandMat.onBeforeCompile;
  bandMat.onBeforeCompile = (sh, rnd) => {
    hlBand(sh, rnd);
    Object.assign(sh.uniforms, GU);
    const grow = [
      'float growK = 1.0;',
      'float growSweep = 0.0;',
      '#ifdef USE_MAP',
      'if ( uGrow.x < 1e2 ) {',
      '\tif ( uGrow.x < 0.0 ) {',
      '\t\tgrowK = 0.0;',
      '\t} else {',
      '\t\tfloat u = fract( vMapUv.x );',
      '\t\tfloat a = abs( u - 0.5 );', // khoảng cách tới giữa mặt trước (số năm)
      '\t\tfloat b = min( u, 1.0 - u );', // … tới giữa mặt sau
      `\t\tfloat t0 = a < b ? ${TEXT_STAGGER.toFixed(3)} * min( 1.0, a / max( uGrow.y, 1e-3 ) )`,
      `\t\t                 : ${TEXT_BACK_DELAY.toFixed(3)} + ${TEXT_BACK_STAGGER.toFixed(3)} * min( 1.0, b / max( uGrow.z, 1e-3 ) );`,
      `\t\tfloat g = clamp( ( uGrow.x - t0 ) / ${TEXT_GROW.toFixed(3)}, 0.0, 1.0 );`,
      '\t\tgrowK = 1.0 - pow( 1.0 - g, 3.0 );',
      '\t\tgrowSweep = pow( 4.0 * g * ( 1.0 - g ), 4.0 );', // hẹp: chỉ quanh lúc đang nổi lên
      '\t}',
      '}',
      '#endif',
    ].join('\n');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uGrow;\nuniform vec3 uGrowBase;\nuniform vec3 uGrowSweep;')
      .replace(
        '#include <map_fragment>',
        [
          grow,
          '#include <map_fragment>',
          '#ifdef USE_MAP',
          // phần chữ (sáng hơn nền) — cho vệt sáng chỉ lướt trên mặt chữ, không trên nền
          '\tfloat growTxt = clamp( ( dot( diffuseColor.rgb - uGrowBase, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * 6.0, 0.0, 1.0 );',
          '\tdiffuseColor.rgb = mix( uGrowBase, diffuseColor.rgb, growK );',
          '#endif',
        ].join('\n'),
      )
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * growK;'))
      .replace(
        '#include <emissivemap_fragment>',
        ['#include <emissivemap_fragment>', '#ifdef USE_MAP', '\ttotalEmissiveRadiance += uGrowSweep * ( growSweep * growTxt * uGrow.w );', '#endif'].join('\n'),
      );
  };
  bandMat.customProgramCacheKey = () => 'cinema-ped-band-hl-grow-v1';
  /** Trạng thái chữ mọc: 'shown' | 'hidden' | 'armed' (chờ bản đồ chữ) | 'growing'. */
  let textState = 'shown';
  let textT = 0;
  // Lòng bục: KÍNH ĐEN (xem DISH_COLOR) — gương nét của stage cộng lên trên. Vật liệu RIÊNG: kẹp phản xạ
  // trực tiếp của đèn ở DISH_SPEC_CAP (chấm sáng nhỏ, không thành đĩa trắng khi camera rơi đúng hướng
  // phản xạ lúc lướt / trượt / nhìn từ cao) và tắt IBL (uEnvK) để không loang xám.
  // DEV: __vm.cinemaPedestal.tune({ dishCap, dishRough, dishMetal, dishEnv, dishColor }).
  const dishMat = new THREE.MeshStandardMaterial({ ...DISH_MAT_DEFAULTS, color: DISH_COLOR });
  const dishCap = { value: DISH_SPEC_CAP };
  const dishEnv = { value: DISH_ENV };
  const dishRim = { value: DISH_RIM_CUT };
  const dishEnvUp = { value: DISH_ENV_UP.k };
  const dishSheen = { value: new THREE.Color(DISH_SHEEN.color).multiplyScalar(DISH_SHEEN.k) };
  // r63: mặt lòng bục gợn nhẹ (ripple.js) — nghiêng pháp tuyến theo bản đồ vân lát kín (toạ độ vân: mét trong hệ bục × 1/cỡ ô
  // + độ trôi); độ nhăn 0 → nhánh bị bỏ qua, như trước r63
  const ripTex = { value: null };
  const ripK = { value: 0 };
  const ripInv = { value: 1 };
  const ripOff = { value: new THREE.Vector2() };
  dishMat.onBeforeCompile = (shader) => {
    shader.uniforms.tRipple = ripTex;
    shader.uniforms.uRippleK = ripK;
    shader.uniforms.uRippleInv = ripInv;
    shader.uniforms.uRippleOff = ripOff;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRipXZ;\nvarying vec3 vRipTx;\nvarying vec3 vRipTz;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          // lòng bục nằm ngang trong hệ bục: pháp tuyến +y, hai trục tiếp tuyến x / z (đổi sang hệ camera như pháp tuyến)
          '\tvRipXZ = position.xz;',
          '\tvRipTx = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );',
          '\tvRipTz = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );',
        ].join('\n'),
      );
    shader.uniforms.uSpecCap = dishCap;
    shader.uniforms.uEnvK = dishEnv;
    shader.uniforms.uRimCut = dishRim;
    shader.uniforms.uEnvUp = dishEnvUp;
    shader.uniforms.uSheen = dishSheen;
    shader.uniforms.uRimDirW = HU.uRimDirW; // cùng hướng / màu rim với đá bục NÀY (updateView ghi mỗi khung)
    shader.uniforms.uRimColor = HU.uRimColor;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uSpecCap;\nuniform float uEnvK;\nuniform float uRimCut;\nuniform float uEnvUp;\nuniform vec3 uRimDirW;\nuniform vec3 uRimColor;\nuniform vec3 uSheen;\nuniform sampler2D tRipple;\nuniform float uRippleK;\nuniform float uRippleInv;\nuniform vec2 uRippleOff;\nvarying vec2 vRipXZ;\nvarying vec3 vRipTx;\nvarying vec3 vRipTz;',
      )
      .replace(
        '#include <normal_fragment_maps>',
        [
          '#include <normal_fragment_maps>',
          // r63: gợn nhẹ — nghiêng pháp tuyến ngược chiều độ dốc của vân (≤ RIPPLE_NORMAL_K ở độ nhăn 1)
          '\tif ( uRippleK > 0.0 ) {',
          '\t\tvec2 rn = texture2D( tRipple, vRipXZ * uRippleInv + uRippleOff ).xy * 2.0 - 1.0;',
          `\t\tnormal = normalize( normal - ( vRipTx * rn.x + vRipTz * rn.y ) * ( uRippleK * ${RIPPLE_NORMAL_K.toFixed(3)} ) );`,
          '\t}',
        ].join('\n'),
      )
      .replace(
        '#include <lights_fragment_end>',
        [
          // r22: trừ phần của rim (màu âm qua đúng RE_Direct → trừ cả khuếch tán lẫn phản xạ của nó)
          '{',
          '\tIncidentLight rimCut;',
          '\trimCut.visible = true;',
          '\trimCut.direction = normalize( ( viewMatrix * vec4( uRimDirW, 0.0 ) ).xyz );',
          '\trimCut.color = - uRimColor * uRimCut;',
          '\tRE_Direct( rimCut, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
          '}',
          '#include <lights_fragment_end>',
        ].join('\n'),
      )
      .replace(
        '#include <aomap_fragment>',
        [
          '#include <aomap_fragment>',
          '\treflectedLight.directSpecular = min( max( reflectedLight.directSpecular, vec3( 0.0 ) ), vec3( uSpecCap ) );',
          '\treflectedLight.directDiffuse = max( reflectedLight.directDiffuse, vec3( 0.0 ) );',
          // Môi trường đến từ scene.environment → envMapIntensity của vật liệu bị three bỏ qua; tắt ở đây.
          // r22: + tắt phần phản xạ môi trường theo hướng ngửa lên (softbox trần) — hướng phản xạ trong hệ thế giới.
          '\tfloat dishUp = inverseTransformDirection( reflect( - geometryViewDir, geometryNormal ), viewMatrix ).y;',
          `\treflectedLight.indirectSpecular *= uEnvK * ( 1.0 - uEnvUp * smoothstep( ${DISH_ENV_UP.from.toFixed(3)}, ${DISH_ENV_UP.to.toFixed(3)}, dishUp ) );`,
          '\treflectedLight.indirectDiffuse *= uEnvK;',
          '\treflectedLight.directDiffuse += uSheen;',
        ].join('\n'),
      );
  };
  dishMat.customProgramCacheKey = () => 'cinema-dish-v4-ripple';
  const body = new THREE.Mesh(new THREE.BufferGeometry(), [stoneDark, stone, dishMat]);
  const band = new THREE.Mesh(new THREE.BufferGeometry(), bandMat);
  for (const m of [body, band]) {
    m.castShadow = true; // bóng mềm xuống sàn (engine chuyển cảnh bàn giao cờ này theo khay)
    m.receiveShadow = true; // lòng bục nhận bóng của bia
  }

  // ---- Đèn: lớp CỘNG SÁNG phủ lên hai mặt dải sáng (tắt = thấy mặt đá), quầng, vũng sàn, tia.
  // Hai nhóm độc lập: TRÊN (dải trên + quầng phẳng + tia) và DƯỚI (dải dưới + quầng trụ + vũng sàn).
  const colT = new THREE.Vector3(1, 1, 1);
  const colB = new THREE.Vector3(1, 1, 1);
  const gT = { value: 0 };
  const gB = { value: 0 };
  const emissive = (U) =>
    additive(U, bandVert, stripFrag, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const topStrip = new THREE.Mesh(new THREE.BufferGeometry(), emissive({ uGain: gT, uColor: { value: colT } }));
  const bottomStrip = new THREE.Mesh(new THREE.BufferGeometry(), emissive({ uGain: gB, uColor: { value: colB } }));

  const quad = new THREE.PlaneGeometry(2, 2);
  const TU = { uHalf: { value: 1 }, uR: { value: 0.5 }, uS: { value: 0.07 }, uGain: gT, uColor: { value: colT } };
  const topBloom = new THREE.Mesh(quad, additive(TU, flatVert, topSpillFrag));
  topBloom.rotation.x = -Math.PI / 2;
  // Sàn quanh chân bục: vành AO (luôn có) + vũng sáng đèn dưới (hover) — MỘT mesh, alpha nhân trước.
  const FU = {
    uHalf: { value: 1 },
    uR: { value: 0.6 },
    uGain: gB,
    uColor: { value: colB },
    uAoR: { value: 0.6 },
    uAoW: { value: FLOOR_AO_W },
    uAo: { value: 1 },
  };
  const floorGlow = new THREE.Mesh(
    quad,
    additive(FU, flatVert, floorFrag, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }),
  );
  floorGlow.name = 'cinema-pedestal-floor';
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.0012; // giữa hồ sáng (0,0008) và đĩa hứng bóng (0,0016)
  const cyl = new THREE.CylinderGeometry(1, 1, 1, SEG, 1, true);
  const BU = { uGain: gB, uSigma: { value: 0.2 }, uColor: { value: colB } };
  const bottomBloom = new THREE.Mesh(cyl, additive(BU, bandVert, bloomBandFrag));
  const rayGeo = new THREE.CylinderGeometry(1, 1, 1, SEG, 1, true);
  rayGeo.translate(0, 0.5, 0);
  const RU = { uTime: { value: 0 }, uGain: gT, uPeak: { value: RAY_PEAK }, uColor: { value: colT } };
  const rays = new THREE.Mesh(rayGeo, additive(RU, rayVert, rayFrag, { side: THREE.DoubleSide }));

  const topParts = RAYS_ENABLED ? [topStrip, topBloom, rays] : [topStrip, topBloom];
  const bottomParts = [bottomStrip, bottomBloom]; // floorGlow: hiện theo cả AO (xem syncFloor)
  const glowParts = [topStrip, bottomStrip, topBloom, floorGlow, bottomBloom, rays];
  for (const m of glowParts) {
    m.frustumCulled = false;
    m.receiveShadow = false;
    neverCastShadow(m); // engine chuyển cảnh bật castShadow cho CẢ khay lúc bàn giao bóng
    m.visible = false;
    // r22: lòng bục KHÔNG soi đèn nào của bục (trước đây soi DẢI SÁNG TRÊN — "Đèn trên" — thành một vòng sáng thứ hai
    // trong lòng bục, rõ nhất khi nhìn từ trên xuống; người dùng muốn bỏ). Quầng / tia / phần dưới gờ: như cũ.
    m.userData.noReflect = true;
  }
  // Sau hồ sáng (-2) và đĩa hứng bóng (-1) — thứ tự CỐ ĐỊNH (r19: trước đây cùng -1 với đĩa → thứ tự theo độ sâu gốc
  // vật thể, đổi theo góc camera / vị trí bục lúc Lướt).
  floorGlow.renderOrder = -0.5;
  topStrip.renderOrder = 2;
  bottomStrip.renderOrder = 2;
  topBloom.renderOrder = 3;
  bottomBloom.renderOrder = 3;
  rays.renderOrder = 4;
  group.add(body, band, topStrip, bottomStrip, floorGlow, bottomBloom, topBloom);
  if (RAYS_ENABLED) group.add(rays);

  let R0 = 0.6; // bán kính chuẩn (size = 1)
  let R = 0.6; // bán kính thật = R0 × size
  let S = shapeOf(R0, R);
  let relief = null;
  let reliefTex = null; // r19: cặp texture đang gắn (bản GPU view đẩy theo dải — mặc định chính texture của mục)
  let reliefCirc = 0; // bề vòng giữa dải vát mà bản đồ chữ đang gắn được raster cho
  let lit = false;
  let time = 0;
  let band0 = [0, 0]; // đầu dưới / trên của mặt vát phẳng (r, h) — v = 0 / v = 1 của bản đồ chữ
  let band1 = [0, 0];
  let aoBase = 1; // settings.pedestalFloorShadow
  /**
   * Vành AO chân bục mờ đi ĐÚNG NHỊP vũng sáng đèn dưới (gB = mức hover × pedestalBottomGlow): đèn dưới
   * sáng hết (≥ 1) thì vành biến mất; đèn dưới tắt (glow 0) thì vành vẫn nguyên dù đang hover.
   */
  function syncFloor() {
    const ao = aoBase * (1 - Math.min(1, gB.value));
    FU.uAo.value = ao;
    floorGlow.visible = ao > 0.001 || gB.value > 0.001;
  }

  const bandCirc = () => Math.PI * (S.sideTop[0] + S.rim[0]);

  /**
   * Bản đồ chữ raster cho một bề vòng khác (đang kéo thanh cỡ bục, chữ mới chưa dựng xong): co/giãn
   * u quanh u = 0,5 (mặt trước) để chữ giữ ĐÚNG bề ngang thật trên bục. Mặt sau (quanh u = 0) có thể
   * xê dịch nhẹ cho tới khi bản đồ đúng cỡ về.
   */
  function startText() {
    textState = 'growing';
    textT = 0;
    GU.uGrow.value.x = 0;
  }

  function fitReliefU() {
    if (!relief) return;
    const k = reliefCirc > 0 ? bandCirc() / reliefCirc : 1;
    for (const t of [reliefTex.color, reliefTex.normal]) {
      if (Math.abs(t.repeat.x - k) < 1e-5) continue;
      t.repeat.x = k;
      t.offset.x = 0.5 - 0.5 * k;
      t.updateMatrix(); // matrixAutoUpdate vẫn bật; gọi thẳng cho khung này
    }
  }

  function build() {
    S = shapeOf(R0, R);
    const bv = BEVEL * R0;
    const TOP_STRIP_MID = (S.rim[0] + S.dishEdge[0]) / 2;
    for (const m of [body, band, topStrip, bottomStrip]) m.geometry.dispose();
    // Chân lõm (tối) — không bo (góc lõm, khuất dưới gờ)
    const base = lathe([S.base0, S.base1]);
    // Dải sáng dưới → thân đứng (bo góc lồi ở mép gờ và ở vai trên)
    const lower = withBevels([S.base1, S.lip, S.sideTop], [false, true, false], bv);
    // mặt vát giữ PHẲNG: cắt bớt đầu mút đúng bằng phần bo ở hai góc lồi hai đầu của nó
    const dirC = [S.rim[0] - S.sideTop[0], S.rim[1] - S.sideTop[1]];
    const lenC = Math.hypot(dirC[0], dirC[1]);
    const c0 = [S.sideTop[0] + (dirC[0] / lenC) * bv, S.sideTop[1] + (dirC[1] / lenC) * bv];
    const c1 = [S.rim[0] - (dirC[0] / lenC) * bv, S.rim[1] - (dirC[1] / lenC) * bv];
    // bo góc vai (thân đứng → mặt vát) và góc vành (mặt vát → dải sáng trên)
    const shoulder = withBevels([[S.sideTop[0], S.sideTop[1] - 0.02 * R0], S.sideTop, c0], [false, true, false], bv).slice(1, -1);
    const rimArc = withBevels([c1, S.rim, S.dishEdge], [false, true, false], bv).slice(1, -1);
    // Nối: thân đứng kết thúc ở điểm đầu cung vai
    const lowerPts = lower.slice(0, -1).concat([{ p: shoulder[0].p, smooth: false }]);
    const stripBottomGeo = lathe([lower[0].p, lower[1].p]); // mặt dưới gờ (đến điểm đầu cung bo)
    const pieces = buildProfile(lowerPts);
    pieces.push(lathe(shoulder.map((o) => o.p)));
    pieces.push(lathe(rimArc.map((o) => o.p)));
    const stripTopA = rimArc[rimArc.length - 1].p;
    const stripTopB = S.dishEdge;
    pieces.push(lathe([stripTopA, stripTopB]));
    const dish = lathe([stripTopB, [0.0001, S.dishEdge[1]]]); // lòng bục
    const rest = mergeGeometries(pieces, false);
    body.geometry = mergeGeometries([base, rest, dish], true); // nhóm 0: chân tối · 1: đá · 2: lòng bục
    for (const g of [base, rest, dish, ...pieces]) g.dispose();

    band0 = c0;
    band1 = c1;
    const chamfer = lathe([c0, c1]);
    chamfer.computeTangents(); // không gian tiếp tuyến theo đúng u (vòng) / v (dọc mặt vát)
    band.geometry = chamfer;

    // Lớp phát sáng trùng khít hai mặt dải sáng
    bottomStrip.geometry = stripBottomGeo;
    topStrip.geometry = lathe([stripTopA, stripTopB]);

    // Quầng dải trên: nằm trên mặt lòng bục, toả vào trong từ chân mặt vát sáng (xem topSpillFrag)
    const tr = TOP_STRIP_MID;
    const half = S.dishEdge[0];
    topBloom.scale.set(half, half, 1);
    topBloom.position.y = S.dishEdge[1] + 0.0018; // trên gương (0,0006) + bóng tiếp xúc (0,0012) của lòng bục
    TU.uHalf.value = half;
    TU.uR.value = S.dishEdge[0];
    // Vũng sáng sàn: đỉnh ngay dưới mép gờ
    const fh = R + 0.45;
    floorGlow.scale.set(fh, fh, 1);
    FU.uHalf.value = fh;
    FU.uR.value = R - 0.01 * R0;
    // Vành AO: đậm nhất ngay dưới mép gờ, tắt hẳn sau FLOOR_AO_W (cùng quad với vũng sáng, fh > R + W)
    FU.uAoR.value = R;
    // Quầng dải dưới: trụ mờ quanh mép gờ (thấy được từ trên, như ánh hắt ra ngoài)
    bottomBloom.scale.set(R + 0.004, 0.09, R + 0.004);
    bottomBloom.position.y = S.lip[1];
    rays.scale.set(tr, RAY_H, tr);
    rays.position.y = S.dishEdge[1] + 0.002;
    fitReliefU();
  }
  build();

  return {
    group,
    /** Bán kính ngoài thật (= R0 × size). */
    get R() {
      return R;
    },
    /** Bán kính chuẩn (size = 1). */
    get R0() {
      return R0;
    },
    /** Tổng chiều cao bục (không đổi theo size). */
    get H() {
      return S.rim[1];
    },
    /** r64: các lưới đèn bục (dải / quầng trên + dưới, vũng sàn) — biên dịch sẵn lúc khởi động (stage precompileGrab). */
    get lightParts() {
      return [...topParts, ...bottomParts, floorGlow];
    },
    /** Cao độ lòng bục — chân bia đứng ở đây (không đổi theo size). */
    get lift() {
      return S.dishEdge[1];
    },
    /** Bán kính lòng bục. */
    get dishR() {
      return S.dishEdge[0];
    },
    /** Bán kính mép vành (đỉnh mặt vát) — chân rùa phải nằm trong. */
    get rimR() {
      return S.rim[0];
    },
    /** Hai đầu mặt vát (r, h) trong toạ độ bục: v = 0 (dưới) và v = 1 (trên). */
    get bandEnds() {
      return [band0, band1];
    },
    /** Kích thước dải vát (đơn vị thế giới) để raster chữ đúng tỉ lệ. */
    get bandDims() {
      return { circ: bandCirc(), slant: Math.hypot(S.sideTop[0] - S.rim[0], S.rim[1] - S.sideTop[1]) };
    },
    /**
     * r0 = bán kính chuẩn, size = settings.pedestalSize. force: dựng lại dù không đổi (cấu hình tỉ
     * lệ vừa đổi). Rẻ: vài lathe 128 múi + gộp (≈ 1 ms), không đụng bản đồ chữ.
     */
    setSize(r0, size = 1, force = false) {
      const r = r0 * size;
      if (!force && Math.abs(r0 - R0) < 1e-5 && Math.abs(r - R) < 1e-5) return false;
      R0 = r0;
      R = r;
      build();
      return true;
    },

    /**
     * Độ nổi chữ khắc (settings.pedestalRelief): hệ số nhân độ dốc bản đồ pháp tuyến đã nướng
     * (1 = như nướng; áp tức thì, không dựng lại chữ, không biên dịch lại shader).
     */
    setReliefDepth(k) {
      const v = Math.max(0, Number(k) || 0);
      bandMat.normalScale.set(v, v);
    },
    /**
     * Chất liệu lòng bục (settings.dishGlass): 0 = đá (r6) … 1 = kính đen. Chỉ đổi uniform / thuộc tính.
     * Màu nội suy trong không gian tuyến tính.
     */
    setDishGlass(g) {
      const t = Math.min(1, Math.max(0, Number(g) || 0));
      const L = (a, b) => a + (b - a) * t;
      dishMat.color.lerpColors(_dishA, _dishB, t);
      dishMat.roughness = L(DISH_STONE.roughness, DISH_GLASS.roughness);
      dishMat.metalness = L(DISH_STONE.metalness, DISH_GLASS.metalness);
      dishCap.value = L(DISH_STONE.cap, DISH_GLASS.cap);
      dishEnv.value = L(DISH_STONE.env, DISH_GLASS.env);
      dishSheen.value.set(DISH_SHEEN.color).multiplyScalar(DISH_SHEEN.k * (1 - t)); // kính đen: không có lớp men
    },
    /**
     * r63: mặt lòng bục gợn nhẹ — { texture, strength (0..1; 0 = phẳng như cũ), sizeM (cạnh ô vân, m), offset (Vector2 dùng
     * chung — người gọi đổi tại chỗ để trôi) }. Chỉ đổi uniform.
     */
    setRipple({ texture, strength, sizeM, offset } = {}) {
      if (texture !== undefined) ripTex.value = texture;
      if (Number.isFinite(strength)) ripK.value = Math.max(0, strength);
      if (Number.isFinite(sizeM) && sizeM > 0) ripInv.value = 1 / sizeM;
      if (offset) ripOff.value = offset;
    },
    /** r63 DEV / kiểm thử: trạng thái gợn đang áp (độ nhăn, 1 / cạnh ô vân, độ trôi). */
    get ripple() {
      return { k: ripK.value, inv: +ripInv.value.toFixed(4), off: [+ripOff.value.x.toFixed(5), +ripOff.value.y.toFixed(5)], tex: !!ripTex.value };
    },
    /** DEV: chỉnh vật liệu lòng bục { roughness, metalness, envMapIntensity, color }. */
    setDishMaterial(p = {}) {
      for (const k of ['roughness', 'metalness', 'envMapIntensity']) if (Number.isFinite(p[k])) dishMat[k] = p[k];
      if (Number.isFinite(p.cap)) dishCap.value = p.cap;
      if (Number.isFinite(p.env)) dishEnv.value = p.env;
      if (Number.isFinite(p.rimCut)) dishRim.value = p.rimCut;
      if (Number.isFinite(p.envUp)) dishEnvUp.value = p.envUp;
      if (Number.isFinite(p.sheen)) dishSheen.value.set(p.sheenColor ?? DISH_SHEEN.color).multiplyScalar(p.sheen);
      if (p.color != null) dishMat.color.set(p.color);
    },
    /** Bóng chân bục trên sàn (settings.pedestalFloorShadow 0..1,5; 0 = ẩn hẳn, không draw call). */
    setFloorShadow(k) {
      aoBase = Math.max(0, Number(k) || 0);
      syncFloor();
    },
    get floorShadowMesh() {
      return floorGlow;
    },
    /** DEV (r22): dải sáng trên — so sánh có / không soi trong lòng bục. */
    get topStripMesh() {
      return topStrip;
    },
    /**
     * Vệt sáng mặt vát (settings.pedestalHighlight 0..2, pedestalHighlightPos −90..90°): áp ở updateView.
     * @param {{strength?:number, pos?:number}} p
     */
    setHighlight(p = {}) {
      if (Number.isFinite(p.strength)) hl.strength = Math.max(0, p.strength);
      if (Number.isFinite(p.pos)) hl.pos = p.pos;
    },
    /**
     * Mỗi khung (sau khi bục đã yên vị): tâm vệt = mặt trước bục (phương vị 0 trong toạ độ bục) + độ
     * lệch → hướng đèn ảo đổi sang thế giới theo đúng tư thế bục; phần của rim trên đá bục được trừ đi
     * (đèn rim dời theo camera). Chỉ ghi uniform.
     * @param {THREE.Camera} _camera (không còn dùng — giữ chữ ký)
     * @param {THREE.DirectionalLight|null} rim
     */
    updateView(_camera, rim) {
      group.updateWorldMatrix(true, false);
      const phi = THREE.MathUtils.degToRad(hl.pos);
      HU.uHlCentre.value.set(Math.sin(phi), Math.cos(phi));
      const el = THREE.MathUtils.degToRad(HL_EL);
      _v3.set(Math.sin(phi) * Math.cos(el), Math.sin(el), Math.cos(phi) * Math.cos(el)).transformDirection(group.matrixWorld);
      HU.uHlDirW.value.copy(_v3);
      const k = hl.strength * HL_GAIN;
      HU.uHlColor.value.set(hl.color.r * k, hl.color.g * k, hl.color.b * k);
      if (rim && rim.intensity > 0 && RIM_CUT > 0) {
        rim.updateMatrixWorld();
        rim.target.updateMatrixWorld();
        _v3.setFromMatrixPosition(rim.matrixWorld).sub(_v3b.setFromMatrixPosition(rim.target.matrixWorld)).normalize();
        HU.uRimDirW.value.copy(_v3);
        const c = rim.intensity * RIM_CUT;
        HU.uRimColor.value.set(rim.color.r * c, rim.color.g * c, rim.color.b * c);
      } else {
        HU.uRimColor.value.set(0, 0, 0);
      }
    },
    /**
     * Có hoạt ảnh LIÊN TỤC (vệt tia dâng từ dải trên chạy theo uTime) → view vẽ theo yêu cầu phải vẽ mỗi khung
     * khi bục đang hiện. Tắt đèn trên = đứng yên.
     */
    get animating() {
      return textState === 'growing' || (RAYS_ENABLED && lit && rays.visible && gT.value > 0.001);
    },
    /** DEV: mức sáng hiện tại của hai dải (đã nhân độ sáng người dùng) — ghi vết nhịp bật/tắt. */
    get lightGain() {
      return { top: gT.value, bottom: gB.value };
    },
    /** DEV: vật liệu đá của bục (chẩn đoán / đo). */
    get materials() {
      return { stone, stoneDark, band: bandMat, dish: dishMat };
    },
    get dishMaterial() {
      return {
        roughness: dishMat.roughness,
        metalness: dishMat.metalness,
        envMapIntensity: dishMat.envMapIntensity,
        specCap: dishCap.value,
        envK: dishEnv.value,
        rimCut: dishRim.value,
        envUp: dishEnvUp.value,
        color: `#${dishMat.color.getHexString()}`,
      };
    },
    /**
     * Gắn bản đồ chữ nổi (relief.js) — null = dải trơn. tex (r19): cặp { color, normal } thật sự gắn lên vật liệu (bản
     * GPU đã đẩy xong theo dải của view); mặc định là texture của chính mục. Chữ đang 'armed' (chờ bản đồ) → mọc lên;
     * đang hiện sẵn → đổi bản đồ tại chỗ, không phát lại.
     */
    setRelief(item, tex = item) {
      if (item === relief && (tex ?? null) === reliefTex) return;
      if (relief) {
        // Bản đồ dùng chung (LRU) — trả phép co/giãn u về mặc định cho người dùng sau.
        for (const t of [reliefTex.color, reliefTex.normal]) {
          t.repeat.x = 1;
          t.offset.x = 0;
        }
      }
      if (item !== relief) {
        releaseRelief(relief);
        acquireRelief(item);
      }
      relief = item;
      reliefTex = item ? tex : null;
      reliefCirc = item?.circ ?? 0;
      if (item) {
        bandMat.map = tex.color;
        bandMat.normalMap = tex.normal;
        bandMat.color.set(0xffffff);
        fitReliefU();
        // nửa bề ngang hai cụm chữ (u) — nhịp lan của chữ mọc
        const L = item.canvas?.layout;
        if (L?.front) GU.uGrow.value.y = Math.max(0.02, 0.5 - L.front[0], L.front[1] - 0.5);
        if (L?.back) GU.uGrow.value.z = Math.max(0.02, L.back[1], -L.back[0]);
        if (textState === 'armed') startText();
      } else {
        bandMat.map = null;
        bandMat.normalMap = null;
        bandMat.color.set(STONE);
      }
      bandMat.needsUpdate = true;
    },
    get relief() {
      return relief;
    },

    /**
     * @param {number} k 0..1 mức bật (đã làm mượt)
     * @param {{topGlow:number, topColor:string, bottomGlow:number, bottomColor:string}} L
     *        settings.pedestalTop* / pedestalBottom* (glow 0 = tắt hẳn dải đó)
     */
    setLights(k, L, bottomAbs = 0) {
      const t = k * Math.max(0, L?.topGlow ?? 0);
      // r53: bottomAbs — mức đèn dưới tuyệt đối thêm vào (tay đang cầm bia — kéo bia): lấy mức lớn hơn
      const b = Math.max(k * Math.max(0, L?.bottomGlow ?? 0), bottomAbs);
      if (t > 0.001) srgbVec(L.topColor, colT);
      if (b > 0.001) srgbVec(L.bottomColor, colB);
      gT.value = t;
      gB.value = b;
      const onT = t > 0.001;
      const onB = b > 0.001;
      for (const m of topParts) m.visible = onT;
      for (const m of bottomParts) m.visible = onB;
      syncFloor();
      lit = onT || onB;
    },

    update(dt) {
      if (textState === 'growing') {
        textT += dt;
        if (textT >= TEXT_TOTAL) {
          textState = 'shown';
          GU.uGrow.value.x = 1e3;
        } else GU.uGrow.value.x = textT;
      }
      if (!lit) return;
      time += dt;
      RU.uTime.value = time;
    },

    /** Chữ khắc: ẩn hẳn (mặt vát phẳng) — bia đang lướt tới, chữ chờ lúc hạ xuống bục. */
    textHide() {
      textState = 'hidden';
      GU.uGrow.value.x = -1;
    },
    /**
     * Chữ khắc mọc lên (≈ TEXT_TOTAL giây). Chưa có bản đồ chữ → chờ, mọc ngay khi bản đồ tới. instant: hiện hết
     * luôn (giảm chuyển động). Đang hiện sẵn thì không làm gì (không phát lại khi hover).
     */
    textPlay({ instant = false } = {}) {
      if (textState === 'shown' || textState === 'growing') return;
      if (instant) return this.textShow();
      if (!relief) {
        textState = 'armed';
        GU.uGrow.value.x = -1;
        return;
      }
      startText();
    },
    /** DEV: ghim chữ khắc ở t giây kể từ lúc bắt đầu mọc (chụp theo mốc). */
    textPin(t) {
      textState = 'pinned';
      GU.uGrow.value.x = Math.max(0, t);
    },
    /** Chữ khắc hiện hết ngay. */
    textShow() {
      textState = 'shown';
      GU.uGrow.value.x = 1e3;
    },
    get textState() {
      return textState;
    },

    dispose() {
      group.parent?.remove(group);
      for (const m of [body, band, topStrip, bottomStrip]) m.geometry.dispose();
      stone.dispose();
      dishMat.dispose();
      stoneDark.dispose();
      bandMat.dispose();
      quad.dispose();
      cyl.dispose();
      rayGeo.dispose();
      for (const m of glowParts) m.material.dispose();
      if (relief) {
        for (const t of [reliefTex.color, reliefTex.normal]) {
          t.repeat.x = 1;
          t.offset.x = 0;
        }
      }
      releaseRelief(relief);
      relief = null;
      reliefTex = null;
    },
  };
}
