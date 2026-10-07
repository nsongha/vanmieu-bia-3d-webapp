// r82b → r85 — ÁNH SÁNG CHỮ trên mặt bia (Điện ảnh; MỌI bia — r85).
//
// r85 (người dùng chọn phương án C: "không bao giờ hiện hình chữ dò", trên đá cũng như lúc bay):
//   · Trên đá: KHÔNG mặt nạ chữ, không bản đồ id chữ. Vạch quét là một ĐÈN XIÊN đi xuống (polish.js — pháp tuyến shading của mô hình,
//     chỉ phần lệch so với mặt phẳng mặt bia sáng lên: vách nét khắc THẬT hướng về đèn) + ánh lưu mờ dần trong vệt; dải tiêu đề: đèn
//     xiên quét qua lại dọc dải (mắt không dừng ở hình cố định nào).
//   · HẠT SÁNG: điểm lấy mẫu trên BẢN ĐỒ NÉT của bản dập (r83 — mọi bia có bản dập): blue-noise theo trọng số độ đậm nét trong ô chữ +
//     dải tiêu đề, chỉ trên lớp mặt bia (khung mặt, ngoài đầu rùa); tất định (hạt giống theo id bia), lưu theo bia, ≤ 3000 điểm. Bia
//     không có bản dập (nguồn v1 trừ 1442): rải đều trên ô chữ. Hạt lấp lánh thưa sau đuôi vệt (dải tiêu đề: theo đèn quét).
//   · Mở ('reader:open'): một phần hạt ("Phần hạt bay") tách khỏi đá theo sóng trên → dưới; kiểu 'cloud' (mặc định) — trôi ra một
//     ĐÁM MÂY quanh đường camera rồi gần như đứng yên (trôi rất chậm, lấp lánh nhẹ); camera tự bay xuyên qua trong "Thời gian bay
//     xuyên mây" (cửa sổ [pA, pB] — settings.js readerTiming; vệt theo vận tốc camera, phần nhỏ theo chuyển động riêng của hạt; tắt
//     dần sát mặt phẳng gần). Kiểu 'whoosh' (r84 "Vụt qua"): hạt lao qua camera. Hạt không bay tắt tại chỗ. Mọi hạt hết trước khi chữ
//     tấm đọc hiện (pEnd).
//   · Đóng ('reader:close'): hạt từ đám mây (camera lùi xuyên lại qua nó) tụ về đúng chỗ trên đá, chạm đá trong cửa sổ chạm đá,
//     lấp lánh rồi tan.
//   · Giảm chuyển động: hạt chỉ lấp lánh rồi tắt tại chỗ.
// r86 — Cài đặt "Kiểu chữ sáng": 'stroke' Nét khắc (r85 ở trên, mặc định) · 'traced' Hình chữ dò (tạm thời, tới khi có chữ Hán thật):
//   · THÂN BIA như r82b / r84: chữ thức (le lói theo mặt nạ chữ dò — shader đá uTrace*), sáng vàng ấm sau đuôi vệt, tách theo sóng
//     cùng camera và bay là SPRITE HÌNH CHỮ (atlas; một phần = "Phần hạt bay", đúng mật độ × số chữ), chữ trên đá tắt đúng lúc sprite
//     của nó nhận chỗ / sáng lại đúng lúc sprite chạm đá khi bay về. Kiểu bay (Đám mây / Vụt qua) như hạt sáng.
//   · DẢI TIÊU ĐỀ luôn như Nét khắc (đèn quét + hạt sáng): điểm ảnh chữ dải tiêu đề bị xoá khỏi bản đồ id / độ phủ lúc nạp — không
//     bao giờ có mặt nạ / sprite hình chữ ở đó.
//   · Bia chưa có dữ liệu chữ dò (src/data/glyphs.js glyphAssets) hoặc nạp lỗi → Nét khắc, không báo gì.
// Vẽ: shader đá (uGlyph* / uRake* / uHead* · r86 uTrace*) + MỘT InstancedMesh quad hướng camera (hạt mềm / chữ dò, cộng màu, không ghi
// độ sâu). Vẽ theo yêu cầu: chỉ khi hiệu ứng đang chạy (đồng hồ đổi → polish.version / sprite → khung vẽ); xong thì tắt hẳn.

import { DEFAULTS, GLYPH_TEXT_MARGIN, CLOUD_LIFT_S, getSettings, onSettings, readerTiming, tnum, topt } from '../../../core/settings.js';
import { glyphAssets } from '../../../data/glyphs.js';
import { hanAssets } from '../../../data/hantext.js';

const AWAKE_IN_S = 0.45; // hiệu ứng thức dần trong ngần này
const OFF_S = 0.25; // huỷ giữ: tắt trong ngần này
const POINTS_MAX = 3000; // điểm hạt sáng tối đa mỗi bia (× "Mật độ hạt sáng")
const PLAIN_K = 0.6; // bia không có bản dập: số điểm rải đều = PLAIN_K × số điểm có bản dập
const FLY_S = [0.55, 0.25]; // vụt qua: thời gian bay ở tốc độ 1 (s) = cơ bản + ngẫu nhiên
const BACK_FLY = [0.42, 0.6]; // vụt qua — bay về: thời gian bay (phần đoạn lùi) ở tốc độ 1
const LIT_LEAD = 0.12; // bay ra: hạt sắp tách trong ngần này (tiến độ) mà vạch chưa tới → sáng trước khi tách
const CAM_SPEED_K = 0.5; // vụt qua: × glyphCamStreak — phần nhịp bay theo đường cong camera
const OWN_K = 0.25; // đám mây: phần vệt theo chuyển động riêng của hạt (phần còn lại theo vận tốc camera)
const LAND_FADE_S = 0.9; // sau khi chạm đá: lấp lánh rồi tan
const RM_FADE_S = 0.35; // giảm chuyển động: hạt tắt tại chỗ
const STREAK_MAX_K = 0.09; // vệt kéo dài tối đa = ngần này × chiều cao khung × glyphStreak
const MIN_PX = 1.6; // hạt nhỏ nhất trên màn (px CSS)
// r89 chữ Hán (atlas SDF, ô 48 texel — tools/pack-hantext.py): độ dày nét thêm trên đá (phần ½ px mỗi mẫu) / sprite (px khi chữ nhỏ)
const HAN_BOLD_PX = 0.15;
// r90 chữ Hán: hộp mực phủ hộp nét khắc — giãn mỗi trục, nhưng tỉ lệ hai trục lệch nhau không quá ngần này ("一" không thành ô vuông)
const HAN_ASPECT_MAX = 1.25;
// r90: đám mây thưa dần trong ngần này (s) cuối pha đám mây — chữ tắt rải rác, chữ cuối tắt ở pB
const CLOUD_THIN_S = 1.2;
const RAKE_GAIN = 1.1; // bức xạ đèn xiên = độ nghiêng (đã chuẩn hoá 0..1) × ngần này × "Độ sáng đèn xiên"
const HEAD_GAIN = 1.3;
/** Màu hạt / đèn xiên theo "Độ ấm" (0 vàng nhạt · 0,5 vàng ấm · 1 hổ phách) — tuyến tính. */
const GOLD_PALE = [1.0, 0.82, 0.48];
const GOLD_BASE = [1.0, 0.62, 0.24];
const GOLD_AMBER = [1.0, 0.45, 0.12];

/** Băm số nguyên → 0..1 (tất định). */
function hash01(n, salt = 0) {
  let x = (n * 374761393 + salt * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32). */
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (id) => [...String(id)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/**
 * r90: hộp nét khắc (chữ Hán căn chỉnh v2+) chồng nhau — dữ liệu dò có thể cho hai hộp lấn nhau (vd. 因 / 前 trên 1442): cắt cả hai ở
 * giữa phần chồng theo trục hai tâm cách xa hơn (chữ trên / dưới: theo dọc). Trả bản sao (cx, cy, w, h đã cắt), giữ thứ tự.
 */
function untangle(chars, IW, IH) {
  const B = chars.map((c) => ({ c, x0: c.cx - c.w / 2, x1: c.cx + c.w / 2, y0: c.cy - c.h / 2, y1: c.cy + c.h / 2 }));
  for (let i = 0; i < B.length; i++)
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i];
      const b = B[j];
      if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) continue;
      if (Math.abs(b.c.cy - a.c.cy) * IH >= Math.abs(b.c.cx - a.c.cx) * IW) {
        const [u, l] = a.c.cy <= b.c.cy ? [a, b] : [b, a];
        const m = (u.y1 + l.y0) / 2;
        u.y1 = Math.min(u.y1, m);
        l.y0 = Math.max(l.y0, m);
      } else {
        const [p, q] = a.c.cx <= b.c.cx ? [a, b] : [b, a];
        const m = (p.x1 + q.x0) / 2;
        p.x1 = Math.min(p.x1, m);
        q.x0 = Math.max(q.x0, m);
      }
    }
  return B.map(({ c, x0, x1, y0, y1 }) => (x0 === c.cx - c.w / 2 && x1 === c.cx + c.w / 2 && y0 === c.cy - c.h / 2 && y1 === c.cy + c.h / 2 ? c : { ...c, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }));
}

function pw(t, K, V) {
  const i = t < K[1] ? 0 : t < K[2] ? 1 : 2;
  return V[i] + ((t - K[i]) * (V[i + 1] - V[i])) / (K[i + 1] - K[i]);
}

const SPRITE_VERT = /* glsl */ `
attribute vec3 aStart; // điểm trên mặt đá (toạ độ bia)
attribute vec3 aCloud; // đám mây: chỗ dừng trong không khí (toạ độ bia)
attribute vec3 aSize; // x cỡ (đơn vị bia; chữ dò: cao hộp chữ) · y loại: 0 hạt thân bia · 1 hạt dải tiêu đề · 2 chữ dò (atlas) · z rộng / cao
attribute vec4 aUv; // r86 chữ dò: ô atlas u0 v0 u1 v1
attribute vec4 aT; // bay ra: lúc tách, thời gian trôi / bay · bay về: lúc rời, thời gian bay (tiến độ đoạn camera)
attribute vec4 aR; // vụt qua: hệ số toả, lệch x / y, độ sâu đích sau camera · đám mây: vận tốc trôi xyz (đơn vị bia / s), –
attribute vec2 aP; // số mũ gia tốc (vụt qua), pha lấp lánh
attribute float aFly; // 1 = bay · 0 = tắt tại chỗ
attribute vec2 aFd; // r88 đám mây: dải khoảng cách tới camera để tắt dần (gần → tắt, xa → hiện); y ≤ x: không dùng
uniform float uMode; // 0 trên đá · 1 vụt qua (ra) · 2 vụt qua (về) · 3 đám mây (ra) · 4 đám mây (về)
uniform float uS; // tiến độ đoạn camera (ra / về)
uniform float uTime; // s — lấp lánh
uniform float uLitY; // trên đá: điểm cao hơn thì sáng — r90: = mép dẫn của vạch quét (+ độ trễ ẩn, mặc định 0)
uniform float uTrailL; // r90: độ dài vệt sau vạch (đơn vị bia; 0 = không vệt) — lấp lánh dày hơn khi vệt đi qua
uniform float uAwake; // trên đá: độ hiện chung
uniform vec4 uHead; // dải tiêu đề: tâm x cửa sổ quét, nửa bề rộng, biên độ, –
uniform float uPEnd; // ra: mọi hạt hết trước mốc này
uniform float uLand0; // về: hạt không bay hiện lại từ … (tiến độ đoạn lùi)
uniform float uLand1; // … tới
uniform float uDin; // s ứng với 1 đơn vị tiến độ
uniform vec3 uCam; // camera (toạ độ bia)
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform vec3 uCamF;
uniform vec3 uCamV; // vận tốc camera (toạ độ bia / s) × hệ số cài đặt
uniform vec2 uView; // cỡ khung (px CSS)
uniform float uMaxPx;
uniform float uMinPx;
uniform float uStreakMax;
uniform float uStreakK;
uniform float uOwnK;
uniform float uStreakDt; // s — khoảng thời gian của vệt (đám mây ngắn hơn: bay xuyên, không "vụt")
uniform vec3 uTw; // × độ le lói, × nhịp, × loé
uniform float uSolo; // DEV (kiểm thử r87): ≥ 0 → chỉ vẽ hạt thứ này · −1 tắt
uniform float uDbg; // DEV (kiểm thử r87): 1 → tô kín quad
uniform float uDbgScale; // DEV (r88): phóng quad đều theo cả hai trục khi đo (sprite nhỏ — đo tỉ lệ / góc chính xác hơn)
varying vec2 vQ;
varying vec2 vUv;
varying float vA;
varying float vGlint;
varying float vKind;
vec3 targetOf() {
  vec3 rel = aStart - uCam;
  vec2 lat = vec2(dot(rel, uCamR), dot(rel, uCamU)) * aR.x + aR.yz;
  return uCam + uCamR * lat.x + uCamU * lat.y - uCamF * aR.w;
}
// vị trí hạt bay ở tiến độ s (mode ra / về)
vec3 posAt(float s) {
  if (uMode < 1.5) {
    float tau = clamp((s - aT.x) / max(aT.y, 1e-4), 0.0, 1.0);
    return mix(aStart, targetOf(), pow(tau, aP.x));
  }
  if (uMode < 2.5) {
    float tau = clamp((s - aT.z) / max(aT.w, 1e-4), 0.0, 1.0);
    return mix(targetOf(), aStart, 1.0 - pow(1.0 - tau, 3.0));
  }
  if (uMode < 3.5) {
    float tau = clamp((s - aT.x) / max(aT.y, 1e-4), 0.0, 1.0);
    float e = 1.0 - pow(1.0 - tau, 3.0);
    return mix(aStart, aCloud, e) + aR.xyz * (max(0.0, s - aT.x - aT.y) * uDin);
  }
  float tau = clamp((s - aT.z) / max(aT.w, 1e-4), 0.0, 1.0);
  float e = tau * tau * (3.0 - 2.0 * tau);
  return mix(aCloud, aStart, e);
}
void main() {
  // lấp lánh: thưa, theo pha riêng
  float rate = (1.1 + 2.3 * fract(aP.y * 7.31)) * uTw.y;
  float sw = 0.5 + 0.5 * sin(uTime * rate + aP.y * 6.2832);
  float pop = pow(sw, 10.0);
  float tw = clamp(0.16 + 0.84 * pop * uTw.x, 0.0, 1.0);
  float glint = pop * uTw.z;
  bool head = aSize.y > 0.5 && aSize.y < 1.5;
  // r86 chữ dò: trên đá là mặt nạ của shader đá (không sprite) — sprite chỉ hiện lúc bay, đúng nhịp chữ trên đá tắt / sáng lại
  bool glyph = aSize.y > 1.5;
  if (uSolo > -0.5 && abs(float(gl_InstanceID) - uSolo) > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vA = 0.0;
    vQ = vec2(0.0);
    vUv = vec2(0.0);
    vGlint = 0.0;
    vKind = 0.0;
    return;
  }
  float twk = glyph ? 1.0 : 0.55 + 0.45 * tw;
  // trên đá: thân bài · dải tiêu đề theo đèn quét. r90: hạt bật sáng ĐÚNG khung mép dẫn của vạch qua nó, loé một nhịp
  // rồi lấp lánh dày khi vệt đi qua, ra khỏi vệt thì về nhịp lấp lánh thường
  float dL = aStart.y - uLitY;
  float flash = dL > 0.0 ? exp(-dL / 0.015) : 0.0;
  float inTr = uTrailL > 0.0 ? 1.0 - smoothstep(0.6 * uTrailL, uTrailL, dL) : 0.0;
  float twT = max(tw, inTr * pow(0.5 + 0.5 * sin(uTime * rate * 2.6 + aP.y * 19.0), 6.0));
  float faceA = glyph ? 0.0 : head ? uHead.z * (0.25 + 0.75 * exp(-pow((aStart.x - uHead.x) / max(uHead.y, 1e-3), 2.0))) : step(0.0, dL);
  vec3 p1 = aStart;
  float a = 0.0;
  float own = 0.0; // 1 = hạt đang bay (vệt)
  float twF = head ? tw : max(twT, flash);
  if (uMode < 0.5) {
    a = uAwake * faceA * twF;
  } else if (uMode < 1.5 || (uMode > 2.5 && uMode < 3.5)) {
    // ra: trước lúc tách — lấp lánh trên đá; sau: bay (aFly) / tắt tại chỗ
    if (uS < aT.x || aFly < 0.5) {
      float gone = aFly < 0.5 ? 1.0 - smoothstep(aT.x, aT.x + 0.08, uS) : 1.0;
      a = uAwake * faceA * twF * gone;
    } else {
      p1 = posAt(uS);
      float tau = clamp((uS - aT.x) / max(aT.y, 1e-4), 0.0, 1.0);
      if (uMode < 1.5) a = smoothstep(aT.x, aT.x + 0.03, uS) * (1.0 - smoothstep(0.82, 1.0, tau)) * twk;
      else a = smoothstep(aT.x, aT.x + 0.03, uS) * (glyph ? 1.0 : 0.75 + 0.25 * tw); // r88: mây sáng rõ (lấp lánh nhẹ)
      a *= 1.0 - smoothstep(uPEnd - 0.05, uPEnd, uS); // luật cứng: hết trước chữ tấm đọc
      own = 1.0;
    }
  } else {
    // về: hạt bay rời đám mây / trước camera tụ về đúng chỗ trên đá; hạt không bay hiện lại trên đá trong cửa sổ chạm đá
    float arrive = aT.z + aT.w;
    if (aFly > 0.5 && uS < arrive) {
      p1 = posAt(uS);
      float tau = clamp((uS - aT.z) / max(aT.w, 1e-4), 0.0, 1.0);
      a = smoothstep(0.0, 0.12, tau) * step(aT.z, uS) * twk;
      // chữ dò: nhường chữ trên đá đúng lúc chạm (0,02 đoạn lùi)
      if (glyph) a *= 1.0 - smoothstep(arrive - 0.02, arrive, uS);
      own = 1.0;
    } else if (glyph) {
      a = 0.0;
    } else if (aFly > 0.5) {
      a = tw * uAwake;
    } else {
      a = smoothstep(uLand0, uLand1, uS) * tw * uAwake;
    }
  }
  // r88 đám mây: camera tiến gần → lấp lánh rồi tắt theo KHOẢNG CÁCH (lùi xa → hiện lại, cùng dải)
  float fpop = 0.0;
  if (uMode > 2.5 && aFd.y > aFd.x && own > 0.5) {
    float fd = smoothstep(aFd.x, aFd.y, distance(p1, uCam));
    fpop = 4.0 * fd * (1.0 - fd);
    a *= fd * (1.0 + 0.9 * fpop);
  }
  vec4 v1 = modelViewMatrix * vec4(p1, 1.0);
  float depth = -v1.z;
  a *= smoothstep(0.07, 0.24, depth); // tắt dần sát mặt phẳng gần
  if (a < 0.003) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vA = 0.0;
    vQ = vec2(0.0);
    vUv = vec2(0.0);
    vGlint = 0.0;
    vKind = 0.0;
    return;
  }
  // vệt: vị trí tương đối camera Δt trước — camera đã đi v·Δt (phần chính), hạt đã đi một phần nhỏ (đám mây) / theo đường bay (vụt qua)
  float dts = uStreakDt;
  vec3 p0 = p1 + uCamV * dts;
  if (own > 0.5) {
    vec3 pPrev = posAt(uS - dts / max(uDin, 1e-3));
    p0 += (uMode > 2.5 ? uOwnK : 1.0) * (pPrev - p1);
  }
  vec4 c1 = projectionMatrix * v1;
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);
  float pxK = projectionMatrix[1][1] * (uView.y * 0.5) / max(depth, 1e-3);
  vec2 hs;
  if (glyph) {
    // chữ dò: hộp chữ thật (rộng × cao), giới hạn cạnh lớn ≤ uMaxPx (giữ tỉ lệ)
    vec2 sz = vec2(aSize.x * aSize.z, aSize.x) * pxK;
    hs = sz * min(1.0, uMaxPx / max(max(sz.x, sz.y), 1e-3)) * 0.5;
  } else {
    hs = vec2(clamp(aSize.x * pxK, uMinPx, uMaxPx) * 0.5 * (1.0 + 1.2 * glint)); // quad rộng hơn khi loé (chỗ cho tia sáng chữ thập)
  }
  if (uDbg > 0.5) hs *= uDbgScale;
  vec2 d = (c1.xy / c1.w - c0.xy / max(c0.w, 1e-3)) * uView * 0.5;
  float len = length(d);
  vec2 dir = len > 0.5 ? d / len : vec2(0.0, 1.0);
  // r87: chữ (chữ dò / chữ Hán) KHÔNG bao giờ kéo vệt / méo / xoay — quad dựng đứng theo trục màn hình, đúng tỉ lệ ô atlas (lớn dần
  // theo phối cảnh); chỉ hạt mềm (Nét khắc) kéo vệt theo vận tốc trên màn
  float streak = glyph ? 0.0 : min(len * 0.6 * uStreakK, uStreakMax) * smoothstep(2.0, 8.0, len);
  vec2 q = position.xy; // −0,5…0,5
  vec2 off = vec2(q.x * 2.0 * hs.x, q.y * 2.0 * hs.y) + dir * dot(q, dir) * 2.0 * streak;
  gl_Position = c1 + vec4(off / (uView * 0.5) * c1.w, 0.0, 0.0);
  vQ = q * 2.0;
  vUv = mix(aUv.xy, aUv.zw, q + 0.5);
  vKind = glyph ? 2.0 : 0.0;
  vGlint = glyph ? 0.0 : max(glint * (1.0 - own), fpop * 0.8);
  // kéo vệt → trải sáng ra diện rộng hơn: giảm độ sáng theo tỉ lệ diện tích
  vA = a / (1.0 + streak / max(hs.y * 2.0, 1.0) * 0.6);
}
`;
const SPRITE_FRAG = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uGoldG; // r86: màu chữ dò bay
uniform sampler2D uAtlas; // r86: atlas chữ dò (kênh xám = độ phủ nét) · r87: atlas chữ Hán (font)
uniform float uDbg; // DEV (kiểm thử r87): 1 → tô kín quad (đo tỉ lệ / góc xoay trên màn)
uniform vec4 uSdf; // r89 chữ Hán (HAN_SDF): atlas SDF (rộng, cao, tầm texel, dày thêm px)
varying vec2 vQ;
varying vec2 vUv;
varying float vA;
varying float vGlint;
varying float vKind;
void main() {
  vec3 col;
  float a;
  if (vKind > 1.5) {
#ifdef HAN_SDF
    {
      // r89: cùng atlas SDF + cùng cách vẽ với chữ trên đá (polish.js): 4 mẫu ¼ px → độ phủ hình chữ nhị phân, tăng tương phản khi
      // chữ nhỏ (khe giữa nét giữ tối — không thành đốm vuông)
      vec2 dx = dFdx(vUv);
      vec2 dy = dFdy(vUv);
      float tpp = max(length(dx * uSdf.xy), length(dy * uSdf.xy));
      float kpx = 4.0 * uSdf.z / max(tpp, 1e-3);
      vec2 ox = dx * 0.25;
      vec2 oy = dy * 0.25;
      float c4 = clamp((textureGrad(uAtlas, vUv - ox - oy, ox, oy).r - 0.5) * kpx + 0.5 + uSdf.w, 0.0, 1.0)
        + clamp((textureGrad(uAtlas, vUv + ox - oy, ox, oy).r - 0.5) * kpx + 0.5 + uSdf.w, 0.0, 1.0)
        + clamp((textureGrad(uAtlas, vUv - ox + oy, ox, oy).r - 0.5) * kpx + 0.5 + uSdf.w, 0.0, 1.0)
        + clamp((textureGrad(uAtlas, vUv + ox + oy, ox, oy).r - 0.5) * kpx + 0.5 + uSdf.w, 0.0, 1.0);
      float big = smoothstep(9.0, 24.0, 48.0 / max(tpp, 1e-3)); // ô atlas 48 texel (pack-hantext.py CELL)
      a = smoothstep(mix(0.3, 0.0, big), mix(0.75, 1.0, big), c4 * 0.25) * vA;
    }
#else
    a = texture2D(uAtlas, vUv).r * vA;
#endif
    col = uGoldG;
  } else {
    float r2 = dot(vQ, vQ);
    float core = exp(-r2 * 9.0) + 0.35 * exp(-r2 * 2.2);
    float cross = (exp(-abs(vQ.x) * 30.0) * exp(-abs(vQ.y) * 2.6) + exp(-abs(vQ.y) * 30.0) * exp(-abs(vQ.x) * 2.6)) * vGlint * 0.6;
    a = (core + cross) * vA;
    col = uGold;
  }
  if (uDbg > 0.5 && vKind > 1.5 && vA > 0.003) {
    gl_FragColor = vec4(40.0, 40.0, 40.0, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * @param {object} S @param {object} K
 * @param {{ THREE: typeof import('three'), renderer: import('three').WebGLRenderer, camera: import('three').PerspectiveCamera,
 *   reduceMotion: boolean, slotEntry: Array<{id:string}|null>, cRect: () => DOMRect }} deps
 */
export function installGlyphs(S, K, { THREE, renderer, camera, reduceMotion, slotEntry, cRect }) {
  /** Dữ liệu theo bia: { id, N, pts, ready, promise, mesh, … }. */
  const sets = new Map();
  const liveId = () => slotEntry[S.cur]?.id ?? null;
  const cfg = () => {
    const s = getSettings();
    return {
      on: s.glyphFx ?? DEFAULTS.glyphFx,
      density: tnum(s, 'glyphDensity'),
      sparkle: tnum(s, 'glyphSparkle'),
      litDelay: tnum(s, 'glyphLitDelay'),
      life: tnum(s, 'glyphLife'),
      twinkle: tnum(s, 'glyphTwinkle'),
      twinkleSpeed: tnum(s, 'glyphTwinkleSpeed'),
      glow: tnum(s, 'glyphGlow'),
      warmth: tnum(s, 'glyphWarmth'),
      jitter: tnum(s, 'glyphWaveJitter'),
      flySpeed: tnum(s, 'glyphFlySpeed'),
      flyDist: tnum(s, 'glyphFlyDist'),
      flyDepth: tnum(s, 'glyphFlyDepth'),
      streak: tnum(s, 'glyphStreak'),
      camStreak: tnum(s, 'glyphCamStreak'),
      spriteMax: tnum(s, 'glyphSpriteMax'),
      mode: topt(s, 'glyphFlyMode'),
      rakeAz: tnum(s, 'rakeAzimuth'),
      rakeEl: tnum(s, 'rakeElevation'),
      rakeGlow: tnum(s, 'rakeGlow'),
      after: tnum(s, 'rakeAfterglow'),
      headT: tnum(s, 'headSweepTime'),
      headGlow: tnum(s, 'headSweepGlow'),
      headBounce: s.headSweepBounce !== false,
      sparkleDensity: tnum(s, 'sparkleDensity'),
      moteMin: tnum(s, 'moteMin'),
      moteMax: Math.max(tnum(s, 'moteMin'), tnum(s, 'moteMax')),
      look: topt(s, 'glyphLook'),
      cloudDist: tnum(s, 'glyphCloudDist'),
      cloudLife: tnum(s, 'glyphCloudLife'),
      traceGlow: tnum(s, 'traceGlow'),
      traceWarmth: tnum(s, 'traceWarmth'),
      traceHalo: tnum(s, 'traceHalo'),
      hanMinConf: tnum(s, 'hanMinConf'),
      hanGlow: tnum(s, 'hanGlow'),
      hanWarmth: tnum(s, 'hanWarmth'),
    };
  };
  /** Hiệu ứng chạy được trên bia này (r85: mọi bia — hạt lấy mẫu từ bản dập, không có thì rải đều). */
  const usable = (id = liveId()) => cfg().on !== false && !!id;
  /** scan.js nối: ảnh bản dập đã nạp của bia (Promise<{ data, map, stroke } | null>) và khung mặt (đo nếu không có bản dập). */
  let lookOf = () => Promise.resolve(null);
  let frameOf = () => null;

  // ---------------------------------------------------------------- lấy mẫu hạt sáng (một lần mỗi bia, tất định)
  /** Ảnh → điểm ảnh RGBA (thu ≤ maxW). */
  function pixelsOf(img, maxW = 640) {
    const w0 = img?.naturalWidth || img?.width || 0;
    const h0 = img?.naturalHeight || img?.height || 0;
    if (!w0 || !h0) return null;
    const k = Math.min(1, maxW / w0);
    const w = Math.max(1, Math.round(w0 * k));
    const h = Math.max(1, Math.round(h0 * k));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    return { w, h, d: g.getImageData(0, 0, w, h).data };
  }
  /**
   * Blue-noise theo trọng số: rút ứng viên theo phân bố năng lượng (hàm tích luỹ, hạt giống theo bia), nhận khi cách mọi điểm đã
   * nhận ≥ r (lưới băm); thiếu thì giảm r. cand(i) → { x, y, head } | null (toạ độ bia + jitter trong ô).
   */
  function blueNoise(weights, n, cellArea, rand, cand, target) {
    const cdf = new Float64Array(n);
    let sum = 0;
    let nz = 0;
    for (let i = 0; i < n; i++) {
      sum += weights[i];
      cdf[i] = sum;
      if (weights[i] > 0.05) nz++;
    }
    if (!(sum > 0)) return [];
    let r = 0.6 * Math.sqrt((nz * cellArea) / Math.max(1, target));
    const out = [];
    const grid = new Map();
    const key = (x, y, cs) => `${Math.floor(x / cs)},${Math.floor(y / cs)}`;
    for (let round = 0; round < 4 && out.length < target; round++) {
      const cs = r;
      grid.clear();
      for (const p of out) {
        const k = key(p.x, p.y, cs);
        (grid.get(k) ?? grid.set(k, []).get(k)).push(p);
      }
      const tries = target * 10;
      for (let t = 0; t < tries && out.length < target; t++) {
        const u = rand() * sum;
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (cdf[m] < u) lo = m + 1;
          else hi = m;
        }
        const p = cand(lo, rand);
        if (!p) continue;
        const gx = Math.floor(p.x / cs);
        const gy = Math.floor(p.y / cs);
        let ok = true;
        for (let dx = -1; dx <= 1 && ok; dx++)
          for (let dy = -1; dy <= 1 && ok; dy++) {
            const L = grid.get(`${gx + dx},${gy + dy}`);
            if (L) for (const q of L) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r) { ok = false; break; }
          }
        if (!ok) continue;
        out.push(p);
        const k = `${gx},${gy}`;
        (grid.get(k) ?? grid.set(k, []).get(k)).push(p);
      }
      r *= 0.75;
    }
    return out;
  }
  /** Lớp mặt: trong khung mặt (chữ nhật + vòm), ngoài vết đầu rùa nhìn chính diện. */
  function faceGate(F, head) {
    const cx = (F.left + F.right) / 2;
    const ax = (F.right - F.left) / 2;
    return (x, y) => {
      if (x < F.left || x > F.right || y < F.bottom || y > F.top) return false;
      if (y > F.spring) {
        const ex = (x - cx) / ax;
        const ey = (y - F.spring) / Math.max(1e-4, F.top - F.spring);
        if (ex * ex + ey * ey > 1) return false;
      }
      if (head?.center && head.radius > 0 && Math.hypot(x - head.center[0], y - head.center[1]) < head.radius * 1.15) return false;
      return true;
    };
  }
  /** Lấy mẫu điểm hạt sáng của bia `id` → { pts: [{x, y, head, e}], src, headBand, textField, energy }. */
  function samplePoints(id, look, F, head, density) {
    const target = Math.round(POINTS_MAX * density);
    const rand = rngOf(seedOf(id));
    const gate = faceGate(F, head);
    const d = look?.data;
    const strokeImg = look?.stroke ?? look?.map;
    const px = strokeImg ? pixelsOf(strokeImg) : null;
    const mk = look?.map && look.map !== strokeImg ? pixelsOf(look.map, px?.w ?? 640) : px;
    if (d?.map && px) {
      const m = d.map;
      const toX = (u) => pw(u, m.u, m.x);
      const toY = (v) => pw(-v, m.v.map((t) => -t), m.y);
      // vùng (uv ảnh): v2 — ô chữ [u1, u2] × [v(đáy dải tiêu đề), v(đáy viền trong)], dải tiêu đề [u1, u2] × [v(đỉnh dải), v(đáy dải)];
      // v1 (phép khớp tay — không có mốc): cả mặt nạ, không dải tiêu đề
      const v2 = d.src === 'v2';
      const tf = v2 ? { u0: m.u[1], u1: m.u[2], v0: m.v[1], v1: m.v[0] } : { u0: 0, u1: 1, v0: 0, v1: 1 };
      const hb = v2 ? { u0: m.u[1], u1: m.u[2], v0: m.v[2], v1: m.v[1] } : null;
      const { w, h } = px;
      const wts = new Float32Array(w * h);
      const isHead = new Uint8Array(w * h);
      for (let j = 0; j < h; j++) {
        const v = (j + 0.5) / h;
        const inT = v >= tf.v0 && v <= tf.v1;
        const inH = hb && v >= hb.v0 && v <= hb.v1;
        if (!inT && !inH) continue;
        const y = toY(v);
        for (let i = 0; i < w; i++) {
          const u = (i + 0.5) / w;
          const k = j * w + i;
          const head01 = inH && u >= hb.u0 && u <= hb.u1;
          if (!(head01 || (inT && u >= tf.u0 && u <= tf.u1))) continue;
          if ((mk ?? px).d[k * 4 + 3] < 128) continue;
          const x = toX(u);
          if (!gate(x, y)) continue;
          const e = smooth(0.54, 0.8, px.d[k * 4] / 255);
          if (e <= 0.02) continue;
          wts[k] = e;
          isHead[k] = head01 && !(inT && u >= tf.u0 && u <= tf.u1) ? 1 : 0;
        }
      }
      const du = 1 / w;
      const dv = 1 / h;
      const cellArea = Math.abs((toX(tf.u1) - toX(tf.u0)) / Math.max(1e-6, tf.u1 - tf.u0) * du) * Math.abs((toY(tf.v0) - toY(tf.v1)) / Math.max(1e-6, tf.v1 - tf.v0) * dv);
      const pts = blueNoise(wts, w * h, cellArea, rand, (k, r) => {
        const i = k % w;
        const j = (k / w) | 0;
        const u = (i + r()) / w;
        const v = (j + r()) / h;
        const x = toX(u);
        const y = toY(v);
        return gate(x, y) ? { x, y, head: isHead[k] === 1, e: wts[k] } : null;
      }, target);
      // năng lượng trung bình tại điểm / trên cả vùng (kiểm thử: điểm nằm trên nét thật)
      let eAll = 0;
      let nAll = 0;
      for (let k = 0; k < w * h; k++) {
        const j = (k / w) | 0;
        const v = (j + 0.5) / h;
        const i = k % w;
        const u = (i + 0.5) / w;
        if (v < tf.v0 || v > tf.v1 || u < tf.u0 || u > tf.u1 || (mk ?? px).d[k * 4 + 3] < 128) continue;
        eAll += smooth(0.54, 0.8, px.d[k * 4] / 255);
        nAll++;
      }
      const ePts = pts.reduce((t, p) => t + p.e, 0) / Math.max(1, pts.length);
      return {
        pts,
        src: 'stroke',
        headBand: hb ? { x0: toX(hb.u0), x1: toX(hb.u1), y0: toY(hb.v1), y1: toY(hb.v0) } : null,
        textField: { x0: toX(tf.u0), x1: toX(tf.u1), y0: toY(tf.v1), y1: toY(tf.v0) },
        energy: { points: +ePts.toFixed(4), field: +(eAll / Math.max(1, nAll)).toFixed(4) },
      };
    }
    // không có bản dập: rải đều (blue-noise) trên ô chữ (khung đo từ mô hình: mép phiến lùi vào, chân → chân vòm)
    const inset = (F.right - F.left) * 0.06;
    const tf = { x0: F.left + inset, x1: F.right - inset, y0: F.bottom + 0.02, y1: F.spring - 0.02 };
    const G = 96;
    const wts = new Float32Array(G * G);
    for (let j = 0; j < G; j++)
      for (let i = 0; i < G; i++) {
        const x = tf.x0 + ((i + 0.5) / G) * (tf.x1 - tf.x0);
        const y = tf.y1 - ((j + 0.5) / G) * (tf.y1 - tf.y0);
        wts[j * G + i] = gate(x, y) ? 1 : 0;
      }
    const cellArea = ((tf.x1 - tf.x0) / G) * ((tf.y1 - tf.y0) / G);
    const pts = blueNoise(wts, G * G, cellArea, rand, (k, r) => {
      const x = tf.x0 + (((k % G) + r()) / G) * (tf.x1 - tf.x0);
      const y = tf.y1 - ((((k / G) | 0) + r()) / G) * (tf.y1 - tf.y0);
      return gate(x, y) ? { x, y, head: false, e: 1 } : null;
    }, Math.round(target * PLAIN_K));
    return { pts, src: 'plain', headBand: null, textField: tf, energy: null };
  }

  // ---------------------------------------------------------------- r86 hình chữ dò: dữ liệu chữ (nạp lười, một lần mỗi bia)
  const traceCache = new Map(); // id → Promise<{ json, ids, cov, w, h, atlas, urls } | null>
  const traceLoads = []; // kiểm thử: URL đã nạp
  const absUrl = (u) => new URL(u, document.baseURI).href;
  /**
   * ids.webp → bản đồ id (RG) + độ phủ (R, mipmap); điểm ảnh của chữ trong `drop` (chữ dải tiêu đề) và mọi điểm ảnh trong `band`
   * (khung dải tiêu đề theo uv ảnh — từ phép khớp bản dập) bị xoá: dải tiêu đề không bao giờ có mặt nạ / quầng chữ dò.
   */
  async function loadIds(url, drop, band) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    // giải mã KHÔNG đổi không gian màu (id mã trong R + 256·G phải giữ đúng từng giá trị)
    const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const cv = document.createElement('canvas');
    cv.width = bmp.width;
    cv.height = bmp.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
    bmp.close?.();
    const n = cv.width * cv.height;
    const rg = new Uint8Array(n * 2);
    const cov = new Uint8Array(n);
    let dropped = 0;
    const W = cv.width;
    const H = cv.height;
    const [bi0, bi1, bj0, bj1] = band ? [band.u0 * W, band.u1 * W, band.v0 * H, band.v1 * H] : [1, 0, 1, 0];
    for (let i = 0; i < n; i++) {
      const id1 = px[i * 4] + 256 * px[i * 4 + 1];
      if (id1 > 0) {
        const x = (i % W) + 0.5;
        const y = Math.floor(i / W) + 0.5;
        if (drop.has(id1 - 1) || (x >= bi0 && x <= bi1 && y >= bj0 && y <= bj1)) {
          dropped++;
          continue; // dải tiêu đề: không mặt nạ, không quầng
        }
      }
      rg[i * 2] = px[i * 4];
      rg[i * 2 + 1] = px[i * 4 + 1];
      cov[i] = px[i * 4 + 2];
    }
    // hàng 0 của dữ liệu = mép TRÊN ảnh (shader lấy mẫu ở v ảnh — không lật)
    const ids = new THREE.DataTexture(rg, cv.width, cv.height, THREE.RGFormat, THREE.UnsignedByteType);
    ids.unpackAlignment = 1;
    ids.minFilter = ids.magFilter = THREE.NearestFilter;
    ids.generateMipmaps = false;
    ids.needsUpdate = true;
    const covT = new THREE.DataTexture(cov, cv.width, cv.height, THREE.RedFormat, THREE.UnsignedByteType);
    covT.unpackAlignment = 1;
    covT.minFilter = THREE.LinearMipmapLinearFilter;
    covT.magFilter = THREE.LinearFilter;
    covT.generateMipmaps = true;
    covT.needsUpdate = true;
    return { ids, cov: covT, w: cv.width, h: cv.height, dropped };
  }
  function loadAtlas(url) {
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        url,
        (t) => {
          t.colorSpace = THREE.NoColorSpace;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.generateMipmaps = true;
          t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() ?? 1);
          resolve(t);
        },
        undefined,
        () => resolve(null),
      );
    });
  }
  const TRACE_KEEP = 2; // giữ dữ liệu chữ dò (bản đồ id + atlas ~ 10–20 MB GPU mỗi bia) của ngần này bia gần nhất
  /** Bỏ dữ liệu chữ dò của các bia cũ (trừ `keep`) + bộ hình chữ dò dựng trên đó (về lại bia đó: nạp + dựng lại). */
  function evictTrace(keep) {
    const ids = [...traceCache.keys()];
    const drop = ids.filter((k) => k !== keep).slice(0, Math.max(0, ids.length - TRACE_KEEP));
    for (const k of drop) {
      const P = traceCache.get(k);
      traceCache.delete(k);
      const han = k.startsWith('han:');
      const sid = han ? k.slice(4) : k;
      const G = sets.get(sid);
      if (G?.look === (han ? 'hantext' : 'traced') && !(st.phase !== 'off' && st.id === sid)) {
        disposeSet(G);
        sets.delete(sid);
      }
      P.then((tr) => {
        if (!tr) return;
        tr.ids?.dispose();
        tr.cov?.dispose();
        tr.atlas.dispose();
      });
    }
  }
  /** Dữ liệu chữ dò của bia `id` (null: không có / lỗi — gọi lại sau lỗi thì thử lại). */
  function traceData(id) {
    const as = glyphAssets(id);
    if (!as) return Promise.resolve(null);
    let P = traceCache.get(id);
    if (P) {
      // dùng lại → mới nhất (thứ tự Map = thứ tự dùng)
      traceCache.delete(id);
      traceCache.set(id, P);
      return P;
    }
    P = (async () => {
      try {
        const urls = [as.json, as.ids, as.atlas].map(absUrl);
        traceLoads.push(...urls);
        const json = await fetch(urls[0]).then((r) => (r.ok ? r.json() : null));
        if (!json?.glyphs?.length) throw new Error('glyphs.json rỗng');
        const drop = new Set(json.glyphs.filter((g) => g.r === 'h').map((g) => g.id));
        // khung dải tiêu đề (uv ảnh) — mốc 2 / 3 của phép khớp từng khúc (viền trong ↔ đỉnh / đáy dải tiêu đề)
        const m = as.map;
        const band = m?.u?.length === 4 && m?.v?.length === 4 ? { u0: m.u[1], u1: m.u[2], v0: m.v[2], v1: m.v[1] } : null;
        const [ids, atlas] = await Promise.all([loadIds(urls[1], drop, band), loadAtlas(urls[2])]);
        if (!atlas) throw new Error('atlas');
        // kiểm thử: điểm ảnh còn mang id trong khung dải tiêu đề + hộp các chữ dải tiêu đề (phải = 0 — không bao giờ có mặt nạ)
        let headerLeft = 0;
        const rg = ids.ids.image.data;
        const boxes = json.glyphs.filter((g) => g.r === 'h').map((g) => [g.cx - g.w / 2, g.cx + g.w / 2, g.cy - g.h / 2, g.cy + g.h / 2]);
        if (band) boxes.push([band.u0, band.u1, band.v0, band.v1]);
        for (const [u0, u1, v0, v1] of boxes) {
          const i0 = Math.max(0, Math.ceil(u0 * ids.w - 0.5));
          const i1 = Math.min(ids.w - 1, Math.floor(u1 * ids.w - 0.5));
          const j0 = Math.max(0, Math.ceil(v0 * ids.h - 0.5));
          const j1 = Math.min(ids.h - 1, Math.floor(v1 * ids.h - 0.5));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (rg[(j * ids.w + i) * 2] || rg[(j * ids.w + i) * 2 + 1]) headerLeft++;
        }
        ids.headerLeft = headerLeft;
        ids.band = band;
        try {
          for (const t of [ids.ids, ids.cov, atlas]) renderer.initTexture(t); // lên GPU lúc rảnh
        } catch {
          /* ngữ cảnh mất — lần vẽ sau tự đẩy */
        }
        return { json, ...ids, atlas, as };
      } catch (e) {
        console.warn('[glyphs] không nạp được dữ liệu chữ dò — dùng Nét khắc', id, e);
        traceCache.delete(id);
        return null;
      }
    })();
    traceCache.set(id, P);
    evictTrace(id);
    return P;
  }
  /** r87: chữ Hán số hoá của bia `id` — chars.json + atlas font (null: không có / lỗi). */
  function hanData(id) {
    const as = hanAssets(id);
    if (!as) return Promise.resolve(null);
    const key = `han:${id}`;
    let P = traceCache.get(key);
    if (P) {
      traceCache.delete(key);
      traceCache.set(key, P);
      return P;
    }
    P = (async () => {
      try {
        const urls = [as.json, as.atlas].map(absUrl);
        traceLoads.push(...urls);
        const json = await fetch(urls[0]).then((r) => (r.ok ? r.json() : null));
        if (!json?.chars?.length) throw new Error('chars.json rỗng');
        const atlas = await loadAtlas(urls[1]);
        if (!atlas) throw new Error('atlas');
        try {
          renderer.initTexture(atlas);
        } catch {
          /* lần vẽ sau tự đẩy */
        }
        return { json, atlas, as };
      } catch (e) {
        console.warn('[glyphs] không nạp được chữ Hán số hoá — dùng Nét khắc', id, e);
        traceCache.delete(key);
        return null;
      }
    })();
    traceCache.set(key, P);
    evictTrace(key);
    return P;
  }
  /** Kiểu chữ sáng muốn dùng cho bia `id` (cài đặt; 'traced' / 'hantext' chỉ khi bia có dữ liệu tương ứng). */
  const lookWanted = (id) => {
    const l = cfg().look;
    if (l === 'traced' && glyphAssets(id)) return 'traced';
    if (l === 'hantext' && hanAssets(id)) return 'hantext';
    return 'stroke';
  };
  const keyOf = (id) => {
    const l = lookWanted(id);
    return `${cfg().sparkleDensity}|${l}${l === 'hantext' ? `|${cfg().hanMinConf}` : ''}`;
  };

  /**
   * Nạp lười (lấy mẫu) hạt sáng của bia `id` — đợi ảnh bản dập scan.js đã nạp (không tải thêm gì); r86 "Hình chữ dò": + dữ liệu chữ
   * dò (lỗi → Nét khắc). Promise<boolean>.
   */
  function prepare(id = liveId()) {
    if (!usable(id)) return Promise.resolve(false);
    const dens = cfg().sparkleDensity;
    const key = keyOf(id);
    let G = sets.get(id);
    if (G && G.key === key) return G.promise;
    // đang chạy hiệu ứng trên bộ cũ → dựng lại sau (step, lúc tắt)
    if (G && st.phase !== 'off' && st.id === id) return G.promise;
    if (G) disposeSet(G);
    G = { id, dens, key, ready: false, promise: null };
    sets.set(id, G);
    G.promise = (async () => {
      const want = lookWanted(id);
      const [look, tr] = await Promise.all([lookOf(id).catch(() => null), want === 'traced' ? traceData(id) : want === 'hantext' ? hanData(id) : null]);
      if (S.disposed || sets.get(id) !== G) return false;
      // khung + đầu rùa của bia đang hiện (lấy mẫu chỉ khi bia đó đang trên khay — K.bounds / S.live là của nó)
      if (liveId() !== id || !S.live) {
        sets.delete(id);
        return false;
      }
      const F = frameOf(id);
      if (!F) {
        sets.delete(id);
        return false;
      }
      const t0 = performance.now();
      const sm = samplePoints(id, look, F, S.live.head, dens);
      sm.pts.forEach((p, k) => (p.k = k)); // r86: khoá băm ổn định của hạt (cùng nhịp lấp lánh ở hai kiểu chữ sáng)
      const pl = look?.data?.plane;
      G.plane = pl ?? null;
      const zF = K.bounds?.zFront ?? 0;
      G.zAt = pl ? (x, y) => pl.z0 + pl.kx * x + pl.ky * y : () => zF;
      // r88: pháp tuyến mặt bia (toạ độ bia) + khoảng cách đầu rùa – mặt bia (điểm nhô nhất của đầu rùa tới mặt phẳng mặt bia)
      G.normal = new THREE.Vector3(pl ? -pl.kx : 0, pl ? -pl.ky : 0, 1).normalize();
      const hd = S.live.head;
      G.dHead = hd?.center ? Math.max(0.05, (hd.center[2] + hd.radius - G.zAt(hd.center[0], hd.center[1])) * G.normal.z) : 0.2;
      G.look = tr ? want : 'stroke';
      if (tr && want === 'traced') traceSet(G, tr, sm, faceGate(F, S.live.head));
      else if (tr) hanSet(G, tr, sm, faceGate(F, S.live.head), cfg().hanMinConf);
      G.sampleMs = Math.round(performance.now() - t0);
      build(G, sm);
      try {
        G.mesh.visible = true;
        const done = renderer.compileAsync ? renderer.compileAsync(G.mesh, camera) : (renderer.compile(G.mesh, camera), Promise.resolve());
        await done;
      } catch {
        /* biên dịch lúc vẽ đầu tiên */
      } finally {
        G.mesh.visible = false;
      }
      G.ready = true;
      return true;
    })();
    return G.promise;
  }

  /**
   * r86 hình chữ dò: hạt sáng chỉ còn ở dải tiêu đề (thân bia = chữ dò); chữ thân bia → toạ độ bia (ánh xạ từng khúc của hệ ảnh dữ
   * liệu), sprite cho chữ nằm trên lớp mặt (khung mặt, ngoài đầu rùa); bảng dữ liệu shader (theo id chữ: rộng 1024, mỗi khối 1024 chữ
   * 2 hàng — hàng 2k: cx, cy, pha, bay? · hàng 2k+1: lúc tách, lúc về, nhịp, –).
   */
  function traceSet(G, tr, sm, gate) {
    const m = tr.as.map;
    const toX = (u) => pw(u, m.u, m.x);
    const toY = (v) => pw(-v, m.v.map((t) => -t), m.y);
    const AW = tr.atlas.image?.width ?? 2048;
    const AH = tr.atlas.image?.height ?? 1024;
    const body = [];
    let maxId = 0;
    for (const g of tr.json.glyphs) {
      maxId = Math.max(maxId, g.id);
      if (g.r === 'h') continue;
      const x = toX(g.cx);
      const y = toY(g.cy);
      const w = Math.abs(toX(g.cx + g.w / 2) - toX(g.cx - g.w / 2));
      const h = Math.abs(toY(g.cy - g.h / 2) - toY(g.cy + g.h / 2));
      const [ax, ay, aw, ah] = g.a;
      // atlas nạp có lật dọc (flipY) → v = 1 − y/H
      // r87: tỉ lệ sprite = tỉ lệ ô atlas (không méo hình chữ)
      body.push({ gid: g.id, x, y, w, h, asp: aw / Math.max(1, ah), uv: [ax / AW, 1 - (ay + ah) / AH, (ax + aw) / AW, 1 - ay / AH], onFace: gate(x, y) });
    }
    const rowsK = Math.ceil((maxId + 1) / 1024);
    const dataArr = new Float32Array(1024 * 4 * rowsK * 4);
    const dataTex = new THREE.DataTexture(dataArr, 1024, 4 * rowsK, THREE.RGBAFormat, THREE.FloatType);
    dataTex.minFilter = dataTex.magFilter = THREE.NearestFilter;
    dataTex.generateMipmaps = false;
    const head = sm.pts.filter((p) => p.head);
    const inst = body.filter((g) => g.onFace).map((g) => ({ x: g.x, y: g.y, head: false, e: 1, glyph: g }));
    sm.pts = [...head, ...inst];
    G.trace = {
      tr,
      body,
      dataArr,
      dataTex,
      kx: new THREE.Vector4(...m.x),
      ku: new THREE.Vector4(...m.u),
      ky: new THREE.Vector4(...m.y),
      kv: new THREE.Vector4(...m.v),
      space: tr.as.space,
      glyphCount: inst.length,
      headerGlyphs: tr.json.glyphs.length - body.length,
      dropped: tr.dropped,
      headerLeft: tr.headerLeft,
    };
  }

  /**
   * r87 chữ Hán số hoá: chỉ chữ có độ tin cậy ≥ `thr` (không phải tiêu đề, ngoài dải tiêu đề, trên lớp mặt) được đặt — bản đồ id dựng từ
   * hộp ô chữ (½ độ phân giải ảnh bản dập), bảng dữ liệu 4 hàng / chữ (hàng 2: hộp chữ vuông trên ảnh, hàng 3: ô atlas font). Hạt sáng
   * (Nét khắc) giữ ở dải tiêu đề + chỗ chưa chắc (ngoài ô chữ đã đặt); chữ đã đặt bay là sprite chữ đánh máy.
   */
  function hanSet(G, hd, sm, gate, thr) {
    const m = hd.as.map;
    const toX = (u) => pw(u, m.u, m.x);
    const toY = (v) => pw(-v, m.v.map((t) => -t), m.y);
    const toU = (x) => pw(x, m.x, m.u);
    const toV = (y) => -pw(y, m.y, m.v.map((t) => -t));
    const dX = (u) => (toX(u + 1e-3) - toX(u - 1e-3)) / 2e-3;
    const dY = (v) => Math.abs(toY(v + 1e-3) - toY(v - 1e-3)) / 2e-3;
    const AW = hd.atlas.image?.width ?? hd.json.atlas?.[0] ?? 2048;
    const AH = hd.atlas.image?.height ?? hd.json.atlas?.[1] ?? 768;
    const [IW, IH] = hd.json.img;
    const band = m.u.length === 4 ? { v0: m.v[2], v1: m.v[1] } : null;
    const placed = [];
    const st0 = { eligible: 0, gated: 0, title: 0, inBand: 0, low: 0, recon: 0 };
    // r90: hộp mực trong atlas (sdf.ink 'tight' — căn chỉnh v2: vẽ phủ hộp nét khắc) · dữ liệu cũ: ô vuông cả khung chữ
    const tight = hd.json.sdf?.ink === 'tight';
    const PAD = tight ? (hd.json.sdf.pad ?? 3) : 0;
    const chars = tight ? untangle(hd.json.chars, IW, IH) : hd.json.chars;
    for (const c of chars) {
      // r90: chữ DỰNG LẠI (src 'recon' — quê quán / tiêu đề giáp suy từ phiên âm, không có trong nguồn văn bản) không bao giờ thành chữ:
      // chỗ đó là Nét khắc (hạt sáng + đèn xiên); không có ô atlas (a = null) cũng vậy
      if (c.src === 'recon' || !c.a) {
        st0.recon++;
        continue;
      }
      if (!(c.conf >= thr)) {
        st0.low++;
        continue;
      }
      if (c.section === 'title') {
        st0.title++;
        continue;
      }
      if (band && c.cy >= band.v0 && c.cy <= band.v1) {
        st0.inBand++;
        continue;
      }
      st0.eligible++;
      const x = toX(c.cx);
      const y = toY(c.cy);
      if (!gate(x, y)) {
        st0.gated++;
        continue;
      }
      const [ax, ay, aw, ah] = c.a;
      let hu, hv, side, asp, rect, uv, cell, ink;
      if (tight) {
        // r90: hộp mực phủ hộp nét khắc (đơn vị bia: kx, ky = đơn vị bia / texel mỗi trục), lệch tỉ lệ ≤ HAN_ASPECT_MAX; + lề PAD texel
        let kx = (c.w * dX(c.cx)) / Math.max(1, aw);
        let ky = (c.h * dY(c.cy)) / Math.max(1, ah);
        if (kx > ky * HAN_ASPECT_MAX) kx = ky * HAN_ASPECT_MAX;
        if (ky > kx * HAN_ASPECT_MAX) ky = kx * HAN_ASPECT_MAX;
        const wm = (aw + 2 * PAD) * kx;
        const hm = (ah + 2 * PAD) * ky;
        hu = wm / 2 / dX(c.cx);
        hv = hm / 2 / dY(c.cy);
        side = hm;
        asp = wm / hm;
        rect = [c.cx - hu, c.cy - hv, c.cx + hu, c.cy + hv];
        cell = rect; // bản đồ id = đúng hộp vẽ (cả lề khử răng cưa)
        ink = [aw * kx, ah * ky];
        uv = [(ax - PAD) / AW, 1 - (ay + ah + PAD) / AH, (ax + aw + PAD) / AW, 1 - (ay - PAD) / AH];
      } else {
        // chữ vuông (đơn vị bia) giữa ô — cạnh = cạnh ngắn của ô
        side = Math.min(c.w * dX(c.cx), c.h * dY(c.cy));
        hu = side / 2 / dX(c.cx);
        hv = side / 2 / dY(c.cy);
        asp = aw / Math.max(1, ah);
        rect = [c.cx - hu, c.cy - hv, c.cx + hu, c.cy + hv];
        cell = [c.cx - c.w / 2, c.cy - c.h / 2, c.cx + c.w / 2, c.cy + c.h / 2];
        uv = [ax / AW, 1 - (ay + ah) / AH, (ax + aw) / AW, 1 - ay / AH];
        ink = [side, side];
      }
      placed.push({ gid: placed.length, ch: c.ch, col: c.col, conf: c.conf, src: c.src ?? null, x, y, w: side * asp, h: side, asp, han: true, cell, rect, uv, a: c.a, ink, core: [c.cx - c.w / 2, c.cy - c.h / 2, c.cx + c.w / 2, c.cy + c.h / 2], src0: c, onFace: true });
    }
    // bản đồ id (RG = id+1) — ½ độ phân giải ảnh bản dập, hàng 0 = mép trên
    const W = Math.ceil(IW / 2);
    const H = Math.ceil(IH / 2);
    const rg = new Uint8Array(W * H * 2);
    // ô bản đồ thuộc một hộp khi TÂM ô nằm trong hộp (hộp sát nhau không lấn nhau vì làm tròn — ô bản đồ = 2 px ảnh bản dập)
    const fill = ([u0, v0, u1, v1], id1) => {
      for (let j = Math.max(0, Math.ceil(v0 * H - 0.5)); j <= Math.min(H - 1, Math.ceil(v1 * H - 0.5) - 1); j++)
        for (let i = Math.max(0, Math.ceil(u0 * W - 0.5)); i <= Math.min(W - 1, Math.ceil(u1 * W - 0.5) - 1); i++) {
          rg[(j * W + i) * 2] = id1 & 255;
          rg[(j * W + i) * 2 + 1] = id1 >> 8;
        }
    };
    // r90: (1) hộp vẽ (cả lề khử răng cưa) · (2) xoá hộp nét khắc của chữ KHÔNG đặt (dưới ngưỡng / dựng lại / dải tiêu đề …) — lề của
    // chữ bên không lấn sang chỗ chưa chắc · (3) hộp nét khắc của chữ đã đặt luôn là của chính nó (lề chữ bên không đè)
    for (const g of placed) fill(g.cell, g.gid + 1);
    if (tight) {
      const own = new Set(placed.map((g) => g.src0));
      for (const c of chars) if (!own.has(c)) fill([c.cx - c.w / 2, c.cy - c.h / 2, c.cx + c.w / 2, c.cy + c.h / 2], 0);
      for (const g of placed) fill(g.core, g.gid + 1);
    }
    const ids = new THREE.DataTexture(rg, W, H, THREE.RGFormat, THREE.UnsignedByteType);
    ids.unpackAlignment = 1;
    ids.minFilter = ids.magFilter = THREE.NearestFilter;
    ids.generateMipmaps = false;
    ids.needsUpdate = true;
    const idAt = (u, v) => {
      const i = Math.floor(u * W);
      const j = Math.floor(v * H);
      if (i < 0 || j < 0 || i >= W || j >= H) return 0;
      return rg[(j * W + i) * 2] + 256 * rg[(j * W + i) * 2 + 1];
    };
    // bảng dữ liệu: hàng 2 / 3 tĩnh (hộp chữ trên ảnh, ô atlas) — hàng 0 / 1 ghi ở arrange
    const rowsK = Math.max(1, Math.ceil(placed.length / 1024));
    const dataArr = new Float32Array(1024 * 4 * rowsK * 4);
    const row = (id, r) => ((Math.floor(id / 1024) * 4 + r) * 1024 + (id % 1024)) * 4;
    for (const g of placed) {
      dataArr.set(g.rect, row(g.gid, 2));
      dataArr.set(g.uv, row(g.gid, 3));
    }
    const dataTex = new THREE.DataTexture(dataArr, 1024, 4 * rowsK, THREE.RGBAFormat, THREE.FloatType);
    dataTex.minFilter = dataTex.magFilter = THREE.NearestFilter;
    dataTex.generateMipmaps = false;
    // hạt sáng: dải tiêu đề + chỗ chưa chắc (không nằm trong ô chữ đã đặt)
    let dropped = 0;
    const keep = sm.pts.filter((p) => {
      if (p.head) return true;
      const inChar = idAt(toU(p.x), toV(p.y)) > 0;
      if (inChar) dropped++;
      return !inChar;
    });
    sm.pts = [...keep, ...placed.map((g) => ({ x: g.x, y: g.y, head: false, e: 1, glyph: g }))];
    // kiểm thử: id còn trong khung dải tiêu đề (phải = 0)
    let headerLeft = 0;
    if (band) for (let j = Math.ceil(band.v0 * H); j < Math.floor(band.v1 * H); j++) for (let i = 0; i < W; i++) if (rg[(j * W + i) * 2] || rg[(j * W + i) * 2 + 1]) headerLeft++;
    G.trace = {
      tr: { ids, cov: hd.atlas, atlas: hd.atlas },
      body: placed,
      dataArr,
      dataTex,
      kx: new THREE.Vector4(...m.x),
      ku: new THREE.Vector4(...m.u),
      ky: new THREE.Vector4(...m.y),
      kv: new THREE.Vector4(...m.v),
      space: hd.as.space,
      mode: 1,
      // r89: atlas SDF (pack-hantext.py) → [rộng, cao atlas, tầm SDF texel, dày thêm px màn ở cỡ nhỏ]; dữ liệu cũ (độ phủ) → null
      sdf: hd.json.sdf?.spread > 0 ? [AW, AH, hd.json.sdf.spread, HAN_BOLD_PX] : null,
      glyphCount: placed.length,
      headerGlyphs: st0.title + st0.inBand,
      dropped: 0,
      headerLeft,
      han: { threshold: thr, total: hd.json.chars.length, placed: placed.length, ...st0, motesKept: keep.length, motesDropped: dropped, idAt, toU, toV, chars: hd.json.chars },
    };
  }

  /** Dựng InstancedMesh hạt sáng từ điểm đã lấy mẫu. */
  function build(G, sm) {
    const pts = sm.pts;
    const N = pts.length;
    let top = -Infinity;
    let bot = Infinity;
    for (const p of pts) {
      top = Math.max(top, p.y);
      bot = Math.min(bot, p.y);
    }
    Object.assign(G, { pts, N, top: N ? top : 1, bot: N ? bot : 0, src: sm.src, headBand: sm.headBand, textField: sm.textField, energy: sm.energy, headerCount: pts.filter((p) => p.head).length });
    const geo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    geo.index = plane.index;
    geo.setAttribute('position', plane.getAttribute('position'));
    const n1 = Math.max(1, N);
    G.attr = {
      aStart: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 3), 3),
      aCloud: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 3), 3),
      aSize: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 3), 3),
      aUv: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 4), 4),
      aT: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 4), 4),
      aR: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 4), 4),
      aP: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 2), 2),
      aFly: new THREE.InstancedBufferAttribute(new Float32Array(n1), 1),
      aFd: new THREE.InstancedBufferAttribute(new Float32Array(n1 * 2), 2), // r88: dải khoảng cách tắt dần (đám mây)
    };
    for (const [k, a] of Object.entries(G.attr)) geo.setAttribute(k, a);
    geo.instanceCount = N;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT,
      fragmentShader: SPRITE_FRAG,
      defines: G.trace?.sdf ? { HAN_SDF: '' } : {}, // r89: nhánh atlas SDF chỉ biên dịch cho chữ Hán (chữ dò / Nét khắc: shader như cũ)
      uniforms: {
        uMode: { value: 0 },
        uS: { value: 0 },
        uTime: { value: 0 },
        uLitY: { value: 9 },
        uTrailL: { value: 0 },
        uAwake: { value: 0 },
        uHead: { value: new THREE.Vector4(0, 0.1, 0, 0) },
        uPEnd: { value: 1 },
        uLand0: { value: 0.84 },
        uLand1: { value: 0.99 },
        uDin: { value: 2.8 },
        uCam: { value: new THREE.Vector3() },
        uCamR: { value: new THREE.Vector3(1, 0, 0) },
        uCamU: { value: new THREE.Vector3(0, 1, 0) },
        uCamF: { value: new THREE.Vector3(0, 0, -1) },
        uCamV: { value: new THREE.Vector3() },
        uView: { value: new THREE.Vector2(1, 1) },
        uMaxPx: { value: 60 },
        uMinPx: { value: MIN_PX },
        uStreakMax: { value: 160 },
        uStreakK: { value: 1 },
        uOwnK: { value: OWN_K },
        uStreakDt: { value: 0.04 },
        uTw: { value: new THREE.Vector3(1, 1, 0.6) },
        uGold: { value: new THREE.Color(1.2, 0.74, 0.3) },
        uGoldG: { value: new THREE.Color(1.2, 0.74, 0.3) },
        uSolo: { value: -1 },
        uDbg: { value: 0 },
        uDbgScale: { value: 1 },
        uAtlas: { value: G.trace?.tr.atlas ?? blankAtlas() },
        uSdf: { value: new THREE.Vector4(...(G.trace?.sdf ?? [0, 0, 0, 0])) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; // vị trí tính trong shader
    mesh.renderOrder = 5;
    mesh.name = 'cinema-light-motes';
    mesh.visible = false;
    Object.assign(G, { mesh, mat, geo, flyCount: 0, mode: null, cloud: null });
    // phần tĩnh: chỗ trên đá, cỡ, pha (r86 chữ dò: hộp chữ thật + ô atlas; bay từ mặt phẳng mặt bia + 4 mm như r84)
    const c = cfg();
    const A = G.attr;
    // r86: khoá băm theo hạt (thứ tự lấy mẫu) / chữ (id) — không theo chỗ trong mảng: hạt dải tiêu đề giống hệt nhau ở hai kiểu
    const H = (G.hk = Int32Array.from(pts, (p, i) => (p.glyph ? 100000 + p.glyph.gid : p.k ?? i)));
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const g = p.glyph;
      A.aStart.array.set([p.x, p.y, G.zAt(p.x, p.y) + (g ? 0.004 : 0.003)], i * 3);
      if (g) {
        A.aSize.array.set([g.h * (g.han ? 1 : 1.12), 2, g.asp], i * 3);
        A.aUv.array.set(g.uv, i * 4);
      } else A.aSize.array.set([c.moteMin + (c.moteMax - c.moteMin) * hash01(H[i], 21) ** 2, p.head ? 1 : 0, 1], i * 3);
      A.aP.array.set([1.7 + 1.1 * hash01(H[i], 12), hash01(H[i], 5)], i * 2);
    }
    G.sizeKey = `${c.moteMin}|${c.moteMax}`;
    for (const a of Object.values(A)) a.needsUpdate = true;
    arrange(G, defaultTiming(), null);
  }
  function disposeSet(G) {
    if (!G?.mesh) return;
    attachMesh(G, false);
    G.geo.dispose();
    G.mat.dispose();
    G.trace?.dataTex.dispose(); // (bản đồ id / atlas: giữ trong traceCache — đổi kiểu qua lại không nạp lại)
    if (G.trace?.mode === 1) G.trace.tr.ids.dispose(); // r87 chữ Hán: bản đồ id dựng theo bộ (ngưỡng tin cậy)
  }
  let _blankAtlas = null;
  function blankAtlas() {
    if (!_blankAtlas) {
      _blankAtlas = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
      _blankAtlas.needsUpdate = true;
    }
    return _blankAtlas;
  }

  /**
   * Nhịp từng hạt (tiến độ đoạn camera): bay / không (mật độ — tập con tất định), lúc tách (sóng trên → dưới trong [T.A, T.B] ± lệch),
   * thời gian trôi / bay; kiểu đám mây — chỗ dừng trong đám mây quanh đường camera (path) theo thứ tự tách (tách sớm → xa mặt đá, camera
   * gặp sớm); bay về — lúc rời, thời gian bay (chạm đá trong [landStart, landEnd], trên trước).
   */
  function arrange(G, T, path) {
    const c = cfg();
    G.cloudD = (G.dHead ?? 0.2) * c.cloudDist; // r88: độ sâu tối đa của đám mây chữ trước mặt bia
    const dens = clamp01(c.density);
    const { pts, N, top, bot } = G;
    const span = Math.max(1e-4, top - bot);
    const A = G.attr;
    const H = G.hk;
    // cỡ hạt đổi → ghi lại
    if (G.sizeKey !== `${c.moteMin}|${c.moteMax}`) {
      for (let i = 0; i < N; i++) if (!pts[i].glyph) A.aSize.array[i * 3] = c.moteMin + (c.moteMax - c.moteMin) * hash01(H[i], 21) ** 2;
      A.aSize.needsUpdate = true;
      G.sizeKey = `${c.moteMin}|${c.moteMax}`;
    }
    const jitAmp = T.jit * Math.max(0.1, T.B - T.A);
    const tOut = new Float32Array(N);
    let flyN = 0;
    // r86 chữ dò: đúng round(mật độ × số chữ) chữ bay — tập con tất định theo id chữ (r84), rải đều mặt bia
    const gOrder = pts.map((p, i) => i).filter((i) => pts[i].glyph).sort((a, b) => hash01(pts[a].glyph.gid, 7) - hash01(pts[b].glyph.gid, 7));
    const gFly = new Set(gOrder.slice(0, Math.round(gOrder.length * dens)));
    for (let i = 0; i < N; i++) {
      const rank = clamp01((top - pts[i].y) / span);
      tOut[i] = Math.min(T.pEnd - 0.02, Math.max(T.A, T.A + (T.B - T.A) * rank + (hash01(H[i], 1) - 0.5) * 2 * jitAmp));
      const fly = pts[i].glyph ? (gFly.has(i) ? 1 : 0) : hash01(H[i], 7) < dens ? 1 : 0;
      A.aFly.array[i] = fly;
      flyN += fly;
    }
    // đám mây: thứ tự tách → lúc camera gặp hạt (pc ∈ [pA, pB])
    const cloud = T.mode === 'cloud' && path;
    let zNear = Infinity;
    let zFar = -Infinity;
    const _P = new THREE.Vector3();
    const _Q = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const fly = A.aFly.array[i];
      const h2 = hash01(H[i], 2);
      const h3 = hash01(H[i], 3);
      const h4 = hash01(H[i], 4);
      const rank = clamp01((top - p.y) / span);
      const arrive = T.landStart + (T.landEnd - T.landStart) * clamp01(rank * 0.8 + h3 * 0.2);
      if (cloud && fly) {
        // r88 (người dùng: "chữ tách khỏi mặt bia, nổi ra phía trước một quãng ngắn thành đám mây lấp lánh ngay trước bia"): KHÔNG toả,
        // KHÔNG tụ — mỗi chữ / hạt giữ đúng x / y của nó trên mặt bia, nâng THẲNG theo pháp tuyến mặt bia tới độ sâu ngẫu nhiên trong
        // [0,15; 1] × khoảng cách đám mây (= "Khoảng cách đám mây chữ" × khoảng cách đầu rùa – mặt bia của bia này) → một trường chữ
        // nhiều lớp ngay trước chỗ khắc. Nâng ease-out trong CLOUD_LIFT_S sau lúc tách, rồi lơ lửng (lấp lánh + trôi rất nhẹ).
        const depth = G.cloudD * (0.15 + 0.85 * hash01(H[i], 17));
        A.aCloud.array.set([p.x + G.normal.x * depth, p.y + G.normal.y * depth, A.aStart.array[i * 3 + 2] + G.normal.z * depth], i * 3);
        zNear = Math.min(zNear, depth);
        zFar = Math.max(zFar, depth);
        const dLift = (CLOUD_LIFT_S[0] + (CLOUD_LIFT_S[1] - CLOUD_LIFT_S[0]) * hash01(H[i], 18)) / Math.max(0.3, T.din ?? 2.8);
        // trôi rất nhẹ (≤ ~4 mm / s) — chỉ sau khi nâng xong
        const dAng = hash01(H[i], 14) * Math.PI * 2;
        const dv = (0.0015 + 0.0025 * hash01(H[i], 15)) * c.flyDepth;
        A.aR.array.set([Math.cos(dAng) * dv, Math.sin(dAng) * dv, (hash01(H[i], 16) - 0.5) * dv, 0], i * 4);
        // camera tiến gần → chữ lấp lánh rồi tắt THEO KHOẢNG CÁCH tới camera (shader: smoothstep(dEnd, dStart, |camera − chữ|)) — r89:
        // tắt SÁT camera hơn (0,6 R → 0,3 R, R = khoảng cách đọc của lượt này): chữ nán lại, lướt qua rõ; lớp trước gặp camera trước nên
        // tắt trước (đi xuyên qua mây). Không muộn hơn hạn sống của chữ: "Thời gian đám mây tồn tại" kể từ lúc nó rời mặt bia (≤ pB —
        // chữ tấm đọc hiện sau đó) — camera chưa tới đủ gần lúc đó thì dải nâng lên bằng khoảng cách của chữ tới camera ở mốc đó
        _Q.fromArray(A.aCloud.array, i * 3);
        // r90: đám mây THƯA DẦN trong CLOUD_THIN_S cuối (mỗi chữ một hạn cuối ngẫu nhiên trong cửa sổ đó, chữ cuối tắt ở pB) — tiêu đề tấm
        // đọc chồng lên lúc đám mây đã tan phần lớn (readerCloudOverlap), không phải lúc cả đám vụt tắt cùng lúc
        const pCap = T.pB - (CLOUD_THIN_S / Math.max(0.3, T.din ?? 2.8)) * hash01(H[i], 19);
        const pLife = Math.min(pCap, Math.max(tOut[i] + dLift + 0.08, tOut[i] + c.cloudLife / Math.max(0.3, T.din ?? 2.8)));
        const dLife = path.at(pLife, _P).distanceTo(_Q);
        const dEnd = Math.max(0.3 * T.readR, dLife);
        // tắt vì camera tới gần: dải 0,6 R → 0,3 R; tắt vì hết hạn sống (camera không tới đủ gần): tắt nhanh ngay trước hạn (~0,07 đoạn)
        const dStart = dLife > 0.3 * T.readR ? Math.max(dEnd + 0.02, path.at(Math.max(0, pLife - 0.07), _P).distanceTo(_Q)) : 0.6 * T.readR;
        A.aFd.array.set([dEnd, dStart], i * 2);
        // bay về: hiện lại khi camera lùi đủ xa (cùng dải khoảng cách), hạ thẳng về đúng chỗ trên đá, chạm đá lúc arrive
        const qStart = Math.max(0.05, arrive - (0.45 + 0.2 * h4));
        A.aT.array.set([tOut[i], dLift, qStart, Math.max(0.1, arrive - qStart)], i * 4);
      } else {
        A.aFd.array.set([-1, -1], i * 2); // vụt qua: không tắt theo khoảng cách
        const dOut = Math.max(0.02, Math.min(T.fly0 + T.fly1 * h2, T.pEnd - tOut[i]));
        const dBack = Math.min(arrive, (BACK_FLY[0] + (BACK_FLY[1] - BACK_FLY[0]) * h4) / T.speed);
        A.aT.array.set([tOut[i], dOut, arrive - dBack, dBack], i * 4);
        const ang = hash01(H[i], 8) * Math.PI * 2;
        const rad = 0.015 + 0.07 * hash01(H[i], 9) ** 2;
        A.aR.array.set([1 + (0.15 + 1.25 * hash01(H[i], 10)) * c.flyDist, Math.cos(ang) * rad * c.flyDist, Math.sin(ang) * rad * c.flyDist, (0.05 + 0.3 * hash01(H[i], 11) * c.flyDepth) * c.flyDist], i * 4);
      }
    }
    for (const k of ['aCloud', 'aT', 'aR', 'aFly', 'aFd']) A[k].needsUpdate = true;
    // r86 chữ dò: bảng dữ liệu shader — chữ trên đá tắt đúng lúc sprite của nó tách / sáng lại đúng lúc sprite chạm đá (không chữ đôi)
    if (G.trace) {
      const D = G.trace.dataArr;
      const row = (id, r) => ((Math.floor(id / 1024) * 4 + r) * 1024 + (id % 1024)) * 4;
      const onFace = new Map();
      pts.forEach((p, i) => p.glyph && onFace.set(p.glyph.gid, i));
      for (const g of G.trace.body) {
        const r0 = row(g.gid, 0);
        const r1 = row(g.gid, 1);
        const i = onFace.get(g.gid);
        const rank = clamp01((top - g.y) / span);
        let to;
        let arr;
        let fly = 0;
        if (i != null) {
          fly = A.aFly.array[i];
          to = tOut[i];
          arr = fly ? A.aT.array[i * 4 + 2] + A.aT.array[i * 4 + 3] : T.landStart + (T.landEnd - T.landStart) * clamp01(rank * 0.8 + hash01(H[i], 3) * 0.2);
        } else {
          to = Math.min(T.pEnd - 0.02, Math.max(T.A, T.A + (T.B - T.A) * rank));
          arr = T.landStart + (T.landEnd - T.landStart) * rank;
        }
        D[r0] = g.x;
        D[r0 + 1] = g.y;
        D[r0 + 2] = hash01(g.gid, 5);
        D[r0 + 3] = fly;
        D[r1] = to;
        D[r1 + 1] = arr;
        D[r1 + 2] = hash01(g.gid, 6);
        D[r1 + 3] = 0;
      }
      G.trace.dataTex.needsUpdate = true;
      G.trace.spriteCount = gFly.size;
    }
    G.flyCount = flyN;
    G.density = dens;
    G.timing = T;
    G.mode = cloud ? 'cloud' : 'whoosh';
    if (cloud) G.cloud = { ...(G.cloud ?? {}), pA: T.pA, pB: T.pB, readR: +(T.readR ?? 0).toFixed(4), dHead: +G.dHead.toFixed(4), D: +G.cloudD.toFixed(4), depthMin: +zNear.toFixed(4), depthMax: +zFar.toFixed(4), normal: G.normal.toArray().map((v) => +v.toFixed(4)) };
  }
  /** Nhịp mặc định (lúc dựng, chưa mở) — theo cài đặt hiện tại. */
  function defaultTiming() {
    const set = getSettings();
    const Tm = readerTiming(set, { cloud: false });
    const c = cfg();
    const din = tnum(set, 'readerZoomIn');
    return { A: Tm.waveStart, B: Tm.waveEnd, jit: c.jitter, pEnd: Tm.pEnd, fly0: FLY_S[0] / c.flySpeed / din, fly1: FLY_S[1] / c.flySpeed / din, landStart: Tm.landStart, landEnd: Tm.landEnd, speed: c.flySpeed, mode: 'whoosh' };
  }

  // ---------------------------------------------------------------- trạng thái + nhịp
  /** phase: 'off' · 'hold' (đèn xiên + hạt theo vạch quét) · 'out' (bay ra) · 'rmout' · 'back' (bay về) · 'land' (chạm đá, tan dần). */
  const st = {
    phase: 'off',
    id: null,
    awake: 0,
    litY: 9,
    fade: 1,
    t: 0,
    hook: null,
    s: 0,
    t0: 0,
    pol: null,
    used: false,
    pEnd: 1,
    din: 2.8,
    wave: null,
    camPrev: null,
    camV: new THREE.Vector3(),
    headT: 0, // đồng hồ quét dải tiêu đề
    lit: 0, // r86 hình chữ dò: độ sáng chung của chữ đã sáng (huỷ giữ: tắt dần)
    trAwake: 0, // r86 hình chữ dò: độ thức (le lói) — tắt dần khi bay ra
  };
  /** Bia của trạng thái kiểm thử: bia đang chạy hiệu ứng, không thì bia đang hiện (st.id giữ bia của lượt trước sau khi tắt). */
  const curId = () => (st.phase !== 'off' && st.id ? st.id : liveId());
  const camP = (kind) => (S.camTw?.kind === kind ? S.camTw.t : 1);
  let scanInfo = () => null;

  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _m3 = new THREE.Matrix3();
  const _L = new THREE.Vector3();
  const _N = new THREE.Vector3();
  const _H = new THREE.Vector3();
  const _HB = new THREE.Vector4();
  const _HS = new THREE.Vector4();
  const _gold = new THREE.Color();
  const _goldS = new THREE.Color();
  const _goldT = new THREE.Color();
  const _goldG = new THREE.Color();
  function goldOf(w, out = _gold) {
    const [a, b, k] = w <= 0.5 ? [GOLD_PALE, GOLD_BASE, w / 0.5] : [GOLD_BASE, GOLD_AMBER, (w - 0.5) / 0.5];
    return out.setRGB(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
  }
  function attachMesh(G, on) {
    const lift = S.live?.lift;
    if (!G?.mesh) return;
    if (on && lift) {
      if (G.mesh.parent !== lift) lift.add(G.mesh);
      G.mesh.visible = true;
      K.glyphFx = G.mesh;
    } else {
      G.mesh.visible = false;
      G.mesh.removeFromParent();
      if (K.glyphFx === G.mesh) K.glyphFx = null;
    }
  }
  /** Camera (toạ độ bia) + khung → uniform hạt. */
  function syncSpriteCam(G, dt = 0) {
    const U = G.mat.uniforms;
    const lift = S.live?.lift;
    if (!lift) return;
    lift.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    _m.copy(lift.matrixWorld).invert();
    U.uCam.value.copy(camera.position).applyMatrix4(_m);
    const c = cfg();
    if (st.camPrev && dt > 1e-4 && dt < 0.1) {
      _v.copy(U.uCam.value).sub(st.camPrev).divideScalar(dt);
      st.camV.lerp(_v, 1 - Math.exp(-dt / 0.05));
    } else if (!st.camPrev) st.camV.set(0, 0, 0);
    (st.camPrev ??= new THREE.Vector3()).copy(U.uCam.value);
    U.uCamV.value.copy(st.camV).multiplyScalar(c.camStreak);
    U.uDin.value = st.din > 0 ? st.din : 2.8;
    U.uStreakK.value = c.streak;
    U.uGold.value.copy(goldOf(c.warmth, _goldS)).multiplyScalar(1.2 * c.glow);
    const hanG = G.trace?.mode === 1;
    U.uGoldG.value.copy(goldOf(hanG ? c.hanWarmth : c.traceWarmth, _goldG)).multiplyScalar(1.2 * (hanG ? c.hanGlow : c.traceGlow)); // r86 chữ dò / r87 chữ Hán bay
    U.uTw.value.set(c.twinkle, c.twinkleSpeed, c.sparkle);
    const e = camera.matrixWorld.elements;
    const toLocal = (out, x, y, z) => out.set(x, y, z).transformDirection(_m);
    toLocal(U.uCamR.value, e[0], e[1], e[2]);
    toLocal(U.uCamU.value, e[4], e[5], e[6]);
    toLocal(U.uCamF.value, -e[8], -e[9], -e[10]);
    const cr = cRect();
    U.uView.value.set(Math.max(1, cr.width), Math.max(1, cr.height));
    U.uMaxPx.value = c.spriteMax * cr.height;
    U.uStreakMax.value = STREAK_MAX_K * c.streak * cr.height;
    U.uTime.value = st.t;
  }
  /** Hướng (toạ độ bia) → không gian camera (pháp tuyến shading của three ở không gian camera). */
  function toView(out, x, y, z) {
    const lift = S.live.lift;
    lift.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    _m.multiplyMatrices(camera.matrixWorldInverse, lift.matrixWorld);
    _m3.setFromMatrix4(_m);
    return out.set(x, y, z).applyMatrix3(_m3).normalize();
  }
  /** Đèn quét dải tiêu đề: tâm cửa sổ (x) + hướng tới đèn (toạ độ bia) ở đồng hồ t. */
  function headSweep(G, c, t) {
    const B = G.headBand;
    if (!B) return null;
    const u = (t / Math.max(0.1, c.headT)) % (c.headBounce ? 2 : 1);
    const el = (c.rakeEl * Math.PI) / 180;
    let x;
    let lx;
    if (c.headBounce) {
      // trái → phải → trái, chậm dần ở hai đầu; đèn đến từ phía SAU cửa sổ (đổi êm khi quay đầu)
      const ph = (u / 2) * Math.PI * 2;
      x = B.x0 + (B.x1 - B.x0) * (0.5 - 0.5 * Math.cos(ph));
      lx = -Math.sin(ph);
    } else {
      x = B.x0 + (B.x1 - B.x0) * u;
      lx = -1;
    }
    return { x, halfW: Math.max(0.03, 0.12 * (B.x1 - B.x0)), L: [lx * Math.cos(el) * 0.9, Math.cos(el) * 0.42, Math.sin(el)] };
  }

  /** Đẩy trạng thái xuống shader đá + hạt. extra: { amp, headAmp, mode, s, awake } của khung. */
  function apply(G, extra = {}) {
    const pol = S.live?.polish ?? null;
    if (st.pol && st.pol !== pol) {
      st.pol.setGlyph({ on: false });
      st.pol.setTrace?.({ on: false });
    }
    st.pol = pol;
    if (!pol) return;
    if (st.phase === 'off' || !G?.ready) {
      pol.setGlyph({ on: false }); // (chế độ vệt do scan.js đặt)
      pol.setTrace?.({ on: false });
      return;
    }
    const c = cfg();
    const sc = scanInfo();
    // đèn xiên của vạch quét: hướng theo cài đặt (toạ độ bia), mặt phẳng mặt bia
    const az = (c.rakeAz * Math.PI) / 180;
    const el = (c.rakeEl * Math.PI) / 180;
    toView(_L, Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
    const pl = G.plane;
    toView(_N, pl ? -pl.kx : 0, pl ? -pl.ky : 0, 1);
    const hs = headSweep(G, c, st.headT);
    if (hs) {
      toView(_H, ...hs.L);
      _HB.set(G.headBand.x0, G.headBand.x1, G.headBand.y0, G.headBand.y1);
      _HS.set(hs.x, hs.halfW, HEAD_GAIN * c.headGlow, 0);
    } else _HB.set(0, 0, 0, 0);
    const trail = sc?.trailLen > 0 ? sc.trailLen : 0.17;
    pol.setGlyph({
      on: true,
      amp: extra.amp ?? 0,
      time: st.t,
      headAmp: hs ? extra.headAmp ?? 0 : 0,
      after: Math.max(0.005, trail * Math.max(0.05, c.after) * 0.5),
      afterK: c.after > 0 ? 0.6 : 0,
      glow: RAKE_GAIN * c.rakeGlow,
      rakeL: _L,
      rakeN: _N,
      headL: hs ? _H : undefined,
      headB: _HB,
      headS: hs ? _HS : undefined,
      col: goldOf(c.warmth),
      debug: import.meta.env.DEV ? (window.__vmGlyphDebug ?? 0) : 0, // DEV: 1 cửa sổ đèn xiên · 2 độ nghiêng · 3 pháp tuyến
    });
    // r86 hình chữ dò (thân bia): mặt nạ chữ trên đá — thức / sáng sau vệt / nhường sprite (r82b / r84)
    if (G.trace) {
      const Tg = G.timing;
      const Tr = G.trace;
      const han = Tr.mode === 1; // r87 chữ Hán số hoá: không le lói trước vạch, màu / độ sáng riêng
      pol.setTrace(
        {
          on: true,
          mode: han ? 1 : 0,
          awake: han ? 0 : st.trAwake,
          time: st.t,
          sparkle: c.sparkle,
          litY: st.litY,
          lit: st.lit,
          outS: extra.outS ?? 0,
          phase: extra.trPhase ?? 0,
          backS: extra.backS ?? 0,
          fade: extra.trFade ?? 1,
          halo: han ? 1 : c.traceHalo,
          waveTop: G.top,
          waveBot: G.bot,
          waveA: Tg?.A ?? 0,
          waveB: Tg?.B ?? 0.5,
          twinkle: c.twinkle,
          twinkleSpeed: c.twinkleSpeed,
          glow: han ? c.hanGlow : c.traceGlow,
          landStart: Tg?.landStart ?? 0.84,
          gold: goldOf(han ? c.hanWarmth : c.traceWarmth, _goldT),
          sdf: han && Tr.sdf ? Tr.sdf : null,
        },
        { ids: Tr.tr.ids, cov: Tr.tr.cov, data: Tr.dataTex, kx: Tr.kx, ku: Tr.ku, ky: Tr.ky, kv: Tr.kv },
      );
    } else pol.setTrace?.({ on: false });
    // hạt
    if (G.mesh?.visible) {
      const U = G.mat.uniforms;
      U.uMode.value = extra.mode ?? 0;
      U.uStreakDt.value = (extra.mode ?? 0) >= 3 ? 0.022 : 0.04;
      U.uS.value = extra.s ?? 0;
      U.uAwake.value = extra.awake ?? st.awake;
      U.uLitY.value = st.litY;
      U.uTrailL.value = st.trailL ?? 0;
      U.uHead.value.set(hs ? hs.x : 0, hs ? hs.halfW : 0.1, hs ? (extra.headAmp ?? 0) * Math.min(1.5, c.headGlow) : 0, 0);
      U.uPEnd.value = st.pEnd;
      const Tm = G.timing;
      U.uLand0.value = Tm?.landStart ?? 0.84;
      U.uLand1.value = Tm?.landEnd ?? 0.99;
      syncSpriteCam(G, extra.dt ?? 0);
    }
  }
  function setOff() {
    const G = sets.get(st.id);
    st.phase = 'off';
    st.awake = 0;
    st.fade = 1;
    st.hook = null;
    if (G) attachMesh(G, false);
    st.pol?.setGlyph({ on: false });
    st.pol?.setTrace?.({ on: false });
    st.lit = 0;
    st.trAwake = 0;
  }

  /**
   * Đường camera của đoạn tiến vào (toạ độ bia): C(p) = C0 + (C1 − C0)·curve(p) — C0 = camera lúc bắt đầu, C1 = khung đọc. backAt(z):
   * tiến độ đoạn LÙI lúc camera đi qua độ sâu z (đường ngược lại, đường cong lùi ra theo cài đặt — gần đúng: cùng dạng vào–ra).
   */
  function pathOf(C0, C1, curve) {
    const out = (p, v) => v.copy(C0).lerp(C1, curve(Math.min(1, Math.max(0, p))));
    const backAt = (z) => {
      const f = clamp01((z - C1.z) / Math.max(1e-4, C0.z - C1.z));
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        const e = m < 0.5 ? 4 * m * m * m : 1 - Math.pow(-2 * m + 2, 3) / 2;
        if (e < f) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    };
    // r87: tiến độ đoạn TIẾN VÀO lúc camera tới độ sâu z (nghịch đảo đường cong)
    const atZ = (z) => {
      const f = clamp01((C0.z - z) / Math.max(1e-4, C0.z - C1.z));
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if (curve(m) < f) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    };
    return { at: out, backAt, atZ, C0: C0.clone(), C1: C1.clone() };
  }

  /** Lớp đọc mở: bay ra (hoặc tắt tại chỗ — giảm chuyển động). */
  function onOpen(e) {
    const d = e.detail || {};
    const id = liveId();
    const G = sets.get(id);
    if (!G?.ready || !usable(id)) return;
    st.id = id;
    st.hook = d;
    st.t0 = performance.now();
    st.used = true;
    if (st.phase === 'off') {
      st.awake = 1;
      st.trAwake = 1;
      st.litY = G.top + 0.05;
    }
    st.forceLitT0 = st.t0;
    attachMesh(G, true);
    if (reduceMotion || !(d.dur > 0)) {
      st.phase = 'rmout';
      return;
    }
    const set = getSettings();
    const c = cfg();
    const din = d.dur;
    const Tm = readerTiming(set, { dur: din, cloud: c.mode === 'cloud' });
    const textAt = Number.isFinite(d.textAt) ? d.textAt : Tm.textAt;
    // r90: đám mây — chữ cuối tắt ở Tm.pEnd (tiêu đề tấm đọc được chồng lên readerCloudOverlap trước đó; thân bài luôn sau)
    const pEnd = c.mode === 'cloud' ? Tm.pEnd : Math.max(0.05, textAt - GLYPH_TEXT_MARGIN);
    const pB = c.mode === 'cloud' ? Math.min(Tm.pB, pEnd - 0.02) : null;
    const pA = c.mode === 'cloud' ? Math.max(0.05, Math.min(Tm.pA, pB - 0.05)) : null;
    const we = Math.max(0.02, Math.min(Tm.waveEnd, c.mode === 'cloud' ? pB - (CLOUD_LIFT_S[1] + 0.2) / din : pEnd - 0.05));
    const ws = Math.max(0, Math.min(Tm.waveStart, we - 0.02));
    const sc = scanInfo();
    // sóng tách theo vạch quét (đời hạt): vạch lúc bắn + tốc độ; không quét (mở thẳng) → như vạch vừa xuất phát ở đỉnh
    const speed = sc?.speed > 0 ? sc.speed : (G.top - G.bot + 0.3) / tnum(set, 'scanDuration');
    const barY = sc ? sc.barY : G.top + 0.05;
    const tail = (sc?.trailOn ? sc.trailLen : sc ? 0 : Number(set.glyphTrail ?? DEFAULTS.glyphTrail)) + c.litDelay;
    const natural = (y) => ((barY - (y - tail)) / speed + c.life) / din;
    const nTop = natural(G.top);
    const nBot = natural(G.bot);
    const A = Math.min(we, Math.max(ws, nTop));
    const B = Math.min(we, Math.max(A + 0.02, nBot));
    let path = null;
    if (c.mode === 'cloud' && S.live && S.camTw?.kind === 'read' && K.readGoal) {
      const lift = S.live.lift;
      lift.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      _m.copy(lift.matrixWorld).invert();
      const C0 = camera.position.clone().applyMatrix4(_m);
      const C1 = K.readGoal.pos.clone().applyMatrix4(_m);
      path = pathOf(C0, C1, S.camTw.curve);
    }
    // r88: khoảng cách đọc (camera ở khung đọc → mặt bia) — dải tắt dần của đám mây theo nó
    const readR = path ? Math.max(0.2, (path.C1.z - G.zAt(path.C1.x, path.C1.y)) * G.normal.z) : 0.6;
    const T = { A, B: Math.max(A, B), jit: c.jitter, pEnd, pA, pB, din, readR, fly0: FLY_S[0] / c.flySpeed / din, fly1: FLY_S[1] / c.flySpeed / din, landStart: Tm.landStart, landEnd: Tm.landEnd, speed: c.flySpeed, mode: path ? 'cloud' : 'whoosh' };
    arrange(G, T, path);
    if (path) G.cloud = { ...G.cloud, C0: path.C0.toArray().map((v) => +v.toFixed(4)), C1: path.C1.toArray().map((v) => +v.toFixed(4)), path };
    st.wave = { A: +A.toFixed(4), B: +T.B.toFixed(4), nTop: +nTop.toFixed(4), nBot: +nBot.toFixed(4), ws, we: +we.toFixed(4), mode: G.mode };
    st.pEnd = pEnd;
    st.din = din;
    st.phase = 'out';
    st.s = 0;
    st.camPrev = null;
  }
  /** Lớp đọc đóng: bay về (giảm chuyển động: không có gì). */
  function onClose(e) {
    const d = e.detail || {};
    const id = liveId();
    const G = sets.get(id);
    if (!G?.ready || !usable(id) || reduceMotion || !(d.dur > 0)) {
      if (st.phase !== 'off') setOff();
      return;
    }
    const set = getSettings();
    const c = cfg();
    const Tm = readerTiming(set);
    const T0 = G.timing ?? defaultTiming();
    let path = null;
    if (c.mode === 'cloud' && S.live) {
      // đường của lượt mở trước (đám mây đã ở đó) — không có thì dựng: từ camera hiện tại lùi thẳng ra trước mặt bia
      path = G.cloud?.path ?? null;
      if (!path) {
        const lift = S.live.lift;
        lift.updateWorldMatrix(true, false);
        camera.updateMatrixWorld();
        _m.copy(lift.matrixWorld).invert();
        const C1 = camera.position.clone().applyMatrix4(_m);
        const C0 = C1.clone().add(new THREE.Vector3(0, 0, 1.7));
        path = pathOf(C0, C1, (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2));
      }
    }
    const readR = T0.readR ?? (path ? Math.max(0.2, (path.C1.z - G.zAt(path.C1.x, path.C1.y)) * (G.normal?.z ?? 1)) : 0.6);
    const T = { ...T0, landStart: Tm.landStart, landEnd: Tm.landEnd, speed: c.flySpeed, mode: path ? 'cloud' : 'whoosh', pA: T0.pA ?? 0.3, pB: T0.pB ?? 0.7, readR, din: T0.din ?? d.dur };
    arrange(G, T, path);
    st.din = d.dur;
    st.camPrev = null;
    st.id = id;
    st.hook = d;
    st.phase = 'back';
    st.awake = 1;
    st.litY = G.bot - 1;
    st.fade = 1;
    st.s = 0;
    attachMesh(G, true);
  }
  window.addEventListener('reader:open', onOpen);
  window.addEventListener('reader:close', onClose);
  // r86: đổi "Kiểu chữ sáng" / mật độ hạt → dựng lại bộ của bia đang hiện ngay (xem thử chạy được liền); đang chạy hiệu ứng: step dựng
  // lại lúc tắt
  const offSettings = onSettings((_s, path) => {
    if (path !== 'glyphLook' && path !== 'sparkleDensity' && path !== 'glyphFx') return;
    const id = liveId();
    const G = sets.get(id);
    if (st.phase === 'off' && usable(id) && G && G.key !== keyOf(id)) prepare(id);
  });

  /** Mỗi khung (trước lượt vẽ, camera của khung này đã đặt). */
  function step(dt, now = performance.now()) {
    const id = liveId();
    if (st.phase !== 'off' && st.id && st.id !== id) setOff();
    const G = sets.get(id);
    const sc = scanInfo();
    if (!sc || sc.mode === 'off' || sc.mode === 'cancel') st.used = false;
    if (st.phase === 'off' || st.phase === 'hold') {
      const holding = !!sc && !st.used && G?.ready && usable(id) && ['hold', 'play', 'fire', 'held'].includes(sc.mode);
      if (holding) {
        if (st.phase === 'off') {
          st.headT = 0;
          st.t = 0; // r86: mỗi lượt giữ cùng nhịp lấp lánh (tất định — so ảnh hai kiểu chữ sáng)
          attachMesh(G, true);
        }
        st.phase = 'hold';
        st.id = id;
        st.awake = Math.min(1, st.awake + dt / (reduceMotion ? 0.1 : AWAKE_IN_S));
        st.trAwake = st.awake;
        st.lit = 1;
        // r90: chữ sáng ĐÚNG lúc mép dẫn của vạch qua tâm chữ (+ độ trễ ẩn, mặc định 0) — trước: sau cả đuôi vệt (trễ ~0,1–0,2 bia)
        st.litY = sc.barY + cfg().litDelay;
        st.trailL = sc.trailOn ? sc.trailLen : 0;
      } else if (st.phase === 'hold') {
        st.awake = Math.max(0, st.awake - dt / OFF_S);
        st.trAwake = st.awake;
        st.lit = Math.max(0, st.lit - dt / OFF_S);
        if (st.awake <= 0 && st.lit <= 0) setOff();
      }
    }
    if (st.phase === 'off') {
      // r86: đổi "Kiểu chữ sáng" / mật độ hạt lúc đang rảnh → dựng lại bộ của bia này (lúc giữ / bay: đợi xong)
      if (G?.ready && usable(id) && G.key !== keyOf(id)) prepare(id);
      apply(G);
      return;
    }
    st.t += dt;
    st.headT += dt;
    const extra = { dt, mode: 0, s: 0, trPhase: 0 };
    if (st.phase !== 'hold') st.lit = 1;
    if (st.phase === 'hold') {
      extra.amp = st.awake;
      extra.headAmp = st.awake;
      extra.awake = st.awake;
    } else if (st.phase === 'out' || st.phase === 'rmout') {
      if (st.phase === 'rmout') {
        const fk = clamp01((now - st.forceLitT0) / 300);
        if (G) st.litY = Math.min(st.litY, G.top + 0.05 - fk * (G.top - G.bot + 0.2));
        st.fade = Math.max(0, st.fade - dt / RM_FADE_S);
        st.trAwake = Math.max(0, st.trAwake - dt / 0.3);
        extra.amp = 0;
        extra.headAmp = 0;
        extra.awake = st.fade;
        extra.trFade = st.fade;
        if (st.fade <= 0) return setOff();
      } else {
        const p = camP('read');
        const curve = S.camTw?.kind === 'read' ? S.camTw.curve : null;
        if (G?.mode === 'cloud') st.s = Math.max(st.s, p);
        else {
          // vụt qua (r84): nhịp bay = tiến độ camera + phần theo đường cong camera
          const kc = CAM_SPEED_K * cfg().camStreak;
          const sp = curve && kc > 0 ? p + kc * Math.max(0, curve(p) - p) : p;
          st.s = Math.max(st.s, Math.min(1, sp));
        }
        // vạch đi tiếp sau khi bắn: hạt sáng theo vạch; hạt sắp tách (trong LIT_LEAD) mà vạch chưa tới → sáng trước khi tách
        const T = G?.timing;
        if (G && T) {
          const yBar = sc ? sc.barY + cfg().litDelay : G.top + 1; // r90: mép dẫn của vạch
          st.trailL = sc?.trailOn ? sc.trailLen : 0;
          const k = clamp01((st.s + LIT_LEAD - T.A) / Math.max(1e-3, T.B - T.A));
          const yWave = st.s + LIT_LEAD < T.A ? G.top + 1 : G.top - k * (G.top - G.bot) - 0.01;
          st.litY = Math.min(yBar, yWave);
        }
        // đèn xiên: vạch còn chạy thì còn, tắt dần trước khi chữ tấm đọc hiện; dải tiêu đề tắt sớm (camera tới gần)
        extra.amp = 1 - smooth(0.25 * st.pEnd, st.pEnd, p);
        extra.headAmp = 1 - smooth(0, 0.25, p);
        extra.awake = 1;
        extra.mode = G?.mode === 'cloud' ? 3 : 1;
        extra.s = st.s;
        // r86 hình chữ dò: chữ đã sáng tách theo sóng (tắt đúng nhịp sprite của nó), le lói tắt dần
        st.trAwake = Math.max(0, st.trAwake - dt / 0.3);
        extra.trPhase = 1;
        extra.outS = st.s;
        if (st.s >= st.pEnd || p >= st.pEnd) return setOff(); // mọi hạt đã tắt — trước khi chữ tấm đọc hiện
      }
    } else if (st.phase === 'back') {
      const p = camP('read-out');
      st.s = p;
      extra.mode = G?.mode === 'cloud' ? 4 : 2;
      extra.s = p;
      st.trAwake = 0;
      extra.trPhase = 2;
      extra.backS = p;
      extra.amp = 0;
      extra.headAmp = 0;
      extra.awake = 1;
      if (p >= 1) {
        st.phase = 'land';
        st.t0 = now;
      }
    } else if (st.phase === 'land') {
      st.fade = 1 - clamp01((now - st.t0) / (LAND_FADE_S * 1000));
      st.litY = (G?.bot ?? 0) - 1;
      extra.mode = 0;
      extra.amp = 0;
      extra.headAmp = 0;
      extra.awake = st.fade;
      extra.trPhase = 2;
      extra.backS = 1;
      extra.trFade = st.fade;
      if (st.fade <= 0) return setOff();
    }
    apply(G, extra);
  }

  return {
    glyphStep: step,
    /** scan.js nối nguồn trạng thái quét (vạch, vệt). */
    setScanSource(fn) {
      scanInfo = typeof fn === 'function' ? fn : () => null;
    },
    /** r85: scan.js nối ảnh bản dập đã nạp (lookFn(id) → Promise) + khung mặt (frameFn(id)). */
    setLookSource(lookFn, frameFn) {
      lookOf = typeof lookFn === 'function' ? lookFn : () => Promise.resolve(null);
      frameOf = typeof frameFn === 'function' ? frameFn : () => null;
    },
    api: {
      /** r85: lấy mẫu hạt sáng (bia đang hiện nếu không nói) — đợi ảnh bản dập scan.js đã nạp. */
      glyphPrepare: (id) => prepare(id),
      /** Hiệu ứng ánh sáng chữ chạy được trên bia này (cài đặt bật; r85: mọi bia). */
      glyphUsable: (id) => usable(id),
      /** Kiểm thử — trạng thái hiệu ứng. */
      get glyphState() {
        const G = sets.get(curId());
        return {
          phase: st.phase,
          id: curId(),
          ready: !!G?.ready,
          count: G?.N ?? 0,
          headerCount: G?.headerCount ?? 0,
          src: G?.src ?? null,
          energy: G?.energy ?? null,
          sampleMs: G?.sampleMs ?? null,
          headBand: G?.headBand ?? null,
          textField: G?.textField ?? null,
          instances: G?.mesh?.visible ? G.geo.instanceCount : 0,
          flyCount: G?.flyCount ?? 0,
          density: G?.density ?? null,
          mode: G?.mode ?? null,
          meshVisible: !!G?.mesh?.visible,
          awake: +st.awake.toFixed(3),
          litY: +st.litY.toFixed(4),
          s: +st.s.toFixed(4),
          pEnd: +st.pEnd.toFixed(4),
          wave: st.wave,
          cloud: G?.cloud ? (({ path, ...c }) => c)(G.cloud) : null,
          camV: +st.camV.length().toFixed(4),
          fade: +st.fade.toFixed(3),
          headT: +st.headT.toFixed(3),
          // r86: kiểu chữ sáng của bộ đang dùng ('traced' chỉ khi bia có dữ liệu chữ dò) + số liệu chữ dò
          look: G?.look ?? null,
          lookWanted: cfg().look,
          atlas: G?.look === 'traced',
          glyphCount: G?.trace?.glyphCount ?? 0,
          spriteCount: G?.trace?.spriteCount ?? 0,
          headerGlyphs: G?.trace?.headerGlyphs ?? 0,
          headerPixelsDropped: G?.trace?.dropped ?? 0,
          headerIdsLeft: G?.trace?.headerLeft ?? null,
          traceSpace: G?.trace?.space ?? null,
          han: G?.trace?.han ? (({ idAt, toU, toV, chars, ...h }) => h)(G.trace.han) : null,
          trace: S.live?.polish?.traceState ?? null,
          uniforms: G?.mat ? { mode: G.mat.uniforms.uMode.value, maxPx: +G.mat.uniforms.uMaxPx.value.toFixed(2), streakMax: +G.mat.uniforms.uStreakMax.value.toFixed(2), streakK: G.mat.uniforms.uStreakK.value, camV: +G.mat.uniforms.uCamV.value.length().toFixed(4) } : null,
          shader: S.live?.polish?.glyphState ?? null,
          loads: [...traceLoads],
        };
      },
      /**
       * r87 kiểm thử — chữ Hán số hoá: ô chữ dưới ngưỡng tin cậy có mang id trên bản đồ không (phải 0), chữ đã đặt có đúng id ở tâm ô.
       */
      glyphHanCheck(sample = 0) {
        const G = sets.get(curId());
        const H = G?.trace?.han;
        if (!H) return null;
        let lowN = 0;
        let lowWithId = 0;
        const lowHits = [];
        for (const c of H.chars) {
          if (c.conf >= H.threshold) continue;
          lowN++;
          if (H.idAt(c.cx, c.cy)) {
            lowWithId++;
            if (lowHits.length < 5) lowHits.push({ ch: c.ch, conf: c.conf, cx: c.cx, cy: c.cy, by: G.trace.body[H.idAt(c.cx, c.cy) - 1]?.ch });
          }
        }
        let placedOk = 0;
        for (const g of G.trace.body) if (H.idAt((g.cell[0] + g.cell[2]) / 2, (g.cell[1] + g.cell[3]) / 2) === g.gid + 1) placedOk++;
        const cols = {};
        for (const g of G.trace.body) cols[g.col] = (cols[g.col] ?? '') + g.ch;
        // r89: mẫu chữ đã đặt (đều theo thứ tự) — toạ độ mặt bia (tâm, cạnh hộp chữ vuông) + ô atlas (px) để đo hình chữ trên màn
        const cells = sample > 0 ? G.trace.body.filter((_, i) => i % Math.max(1, Math.floor(G.trace.body.length / sample)) === 0).slice(0, sample).map((g) => ({ gid: g.gid, ch: g.ch, x: g.x, y: g.y, iw: g.ink[0], ih: g.ink[1], a: g.a, src: g.src })) : undefined;
        // r90: chữ dựng lại (src 'recon') không bao giờ được đặt / có id trên bản đồ
        let reconN = 0;
        let reconWithId = 0;
        for (const c of H.chars) {
          if (c.src !== 'recon') continue;
          reconN++;
          if (H.idAt(c.cx, c.cy)) reconWithId++;
        }
        const reconPlaced = G.trace.body.filter((g) => g.src === 'recon').length;
        return { lowN, lowWithId, lowHits, placed: G.trace.body.length, placedOk, cols, cells, reconN, reconWithId, reconPlaced };
      },
      /**
       * r87 DEV kiểm thử — vẽ RIÊNG sprite n (quad tô kín trắng) lên nền đen, đọc điểm ảnh quanh nó: S = tổng độ phủ (điểm ảnh mép
       * khử răng cưa tính theo phần phủ), rộng / cao = tổng độ phủ lớn nhất theo cột / hàng (chính xác dưới 1 px), fill = S / (rộng ·
       * cao) — quad dựng đứng ≈ 1, xoay → < 1 (kể cả quad vuông). Khung kế tiếp vẽ lại bình thường.
       */
      glyphQuadPx(n, scale = 1) {
        const G = sets.get(curId());
        if (!G?.mesh?.visible) return null;
        const pr = this.glyphSpriteProbe(n);
        if (!pr) return null;
        const U = G.mat.uniforms;
        U.uSolo.value = n;
        U.uDbg.value = 1;
        U.uDbgScale.value = scale;
        const cc = renderer.getClearColor(new THREE.Color());
        const ca = renderer.getClearAlpha();
        renderer.setClearColor(0x000000, 1);
        renderer.setRenderTarget(null);
        renderer.render(G.mesh, camera);
        const gl = renderer.getContext();
        const cr = cRect();
        const k = gl.drawingBufferWidth / Math.max(1, cr.width);
        const R = Math.round((Math.max(24, pr.sizePx * 2 * scale) + 16) * k);
        const cx = Math.round((pr.x - cr.left) * k);
        const cy = Math.round(gl.drawingBufferHeight - (pr.y - cr.top) * k);
        const x0 = Math.max(0, cx - R);
        const y0 = Math.max(0, cy - R);
        const w = Math.min(gl.drawingBufferWidth, cx + R) - x0;
        const h = Math.min(gl.drawingBufferHeight, cy + R) - y0;
        const px = new Uint8Array(Math.max(1, w * h * 4));
        if (w > 0 && h > 0) gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        renderer.setClearColor(cc, ca);
        U.uSolo.value = -1;
        U.uDbg.value = 0;
        U.uDbgScale.value = 1;
        const colMax = new Float32Array(w);
        const rowMax = new Float32Array(h);
        let S = 0;
        let edge = false;
        for (let j = 0; j < h; j++)
          for (let i = 0; i < w; i++) {
            const o = (j * w + i) * 4;
            const v = Math.min(px[o], px[o + 1], px[o + 2]) / 255;
            if (v < 0.02) continue;
            S += v;
            if (v > colMax[i]) colMax[i] = v;
            if (v > rowMax[j]) rowMax[j] = v;
            if (i === 0 || j === 0 || i === w - 1 || j === h - 1) edge = true;
          }
        const W = colMax.reduce((t, v) => t + v, 0);
        const H = rowMax.reduce((t, v) => t + v, 0);
        if (!(S > 0)) return { S: 0, probe: pr };
        return { S: +(S / (k * k)).toFixed(1), w: +(W / k).toFixed(2), h: +(H / k).toFixed(2), aspect: +(W / H).toFixed(4), fill: +(S / (W * H)).toFixed(4), edge, scale, probe: pr };
      },
      /** r87 DEV kiểm thử — chỉ vẽ hạt n (−1: tất cả), dbg: tô kín quad chữ. */
      glyphSolo(n, dbg = false) {
        const G = sets.get(curId());
        if (!G?.mat) return false;
        G.mat.uniforms.uSolo.value = n;
        G.mat.uniforms.uDbg.value = dbg ? 1 : 0;
        return true;
      },
      /** Kiểm thử — điểm hạt i: toạ độ bia, dải tiêu đề?, bay?, nhịp. */
      glyphAt(i) {
        const G = sets.get(liveId());
        const p = G?.pts?.[i];
        if (!p) return null;
        const A = G.attr;
        const cl = A.aCloud.array.slice(i * 3, i * 3 + 3);
        const nrm = G.normal ?? { x: 0, y: 0, z: 1 };
        const depth = (cl[0] - p.x) * nrm.x + (cl[1] - p.y) * nrm.y + (cl[2] - A.aStart.array[i * 3 + 2]) * nrm.z;
        return { depth: +depth.toFixed(5), fd: [...A.aFd.array.slice(i * 2, i * 2 + 2)].map((v) => +v.toFixed(4)), x: p.x, y: p.y, z: A.aStart.array[i * 3 + 2], head: p.head, e: p.e, glyph: p.glyph ? { gid: p.glyph.gid, w: p.glyph.w, h: p.glyph.h } : null, fly: A.aFly.array[i] > 0.5, tOut: A.aT.array[i * 4], arrive: A.aT.array[i * 4 + 2] + A.aT.array[i * 4 + 3], cloud: [...A.aCloud.array.slice(i * 3, i * 3 + 3)] };
      },
      /** Kiểm thử — vị trí trên màn (px client) của hạt bay thứ n (đúng công thức shader, CPU) + độ hiện gần đúng. */
      glyphSpriteProbe(n) {
        const G = sets.get(curId());
        if (!G?.mesh?.visible || n >= G.N) return null;
        const U = G.mat.uniforms;
        const A = G.attr;
        const mode = U.uMode.value;
        const S0 = new THREE.Vector3().fromArray(A.aStart.array, n * 3);
        const Cl = new THREE.Vector3().fromArray(A.aCloud.array, n * 3);
        const [tx, td, tb, tbd] = A.aT.array.slice(n * 4, n * 4 + 4);
        const [kr, ox, oy, depth] = A.aR.array.slice(n * 4, n * 4 + 4);
        const pwr = A.aP.array[n * 2];
        const s = U.uS.value;
        const target = () => {
          const rel = S0.clone().sub(U.uCam.value);
          const lx = rel.dot(U.uCamR.value) * kr + ox;
          const ly = rel.dot(U.uCamU.value) * kr + oy;
          return U.uCam.value.clone().addScaledVector(U.uCamR.value, lx).addScaledVector(U.uCamU.value, ly).addScaledVector(U.uCamF.value, -depth);
        };
        let P = S0.clone();
        let tau = 0;
        const fly = A.aFly.array[n] > 0.5;
        if (mode === 1 && fly && s >= tx) {
          tau = clamp01((s - tx) / td);
          P = S0.clone().lerp(target(), tau ** pwr);
        } else if (mode === 2 && fly) {
          tau = clamp01((s - tb) / tbd);
          P = target().lerp(S0, 1 - (1 - tau) ** 3);
        } else if (mode === 3 && fly && s >= tx) {
          tau = clamp01((s - tx) / td);
          const e = 1 - (1 - tau) ** 3;
          P = S0.clone().lerp(Cl, e).add(new THREE.Vector3(kr, ox, oy).multiplyScalar(Math.max(0, s - tx - td) * U.uDin.value));
        } else if (mode === 4 && fly) {
          tau = clamp01((s - tb) / tbd);
          P = Cl.clone().lerp(S0, tau * tau * (3 - 2 * tau));
        }
        const lift = S.live.lift;
        const dpt = -_v2.copy(P).applyMatrix4(lift.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
        _v.copy(P).applyMatrix4(lift.matrixWorld).project(camera);
        const cr = cRect();
        const a = mode === 2 || mode === 4 ? (fly ? smooth(0, 0.12, tau) * (s >= tb ? 1 : 0) * (s < tb + tbd ? 1 : 0) : 0) : mode === 1 || mode === 3 ? (fly && s >= tx ? smooth(tx, tx + 0.03, s) * (1 - smooth(st.pEnd - 0.05, st.pEnd, s)) : 0) : 0;
        const [fd0, fd1] = A.aFd.array.slice(n * 2, n * 2 + 2);
        const fdK = mode >= 3 && fly && fd1 > fd0 ? smooth(fd0, fd1, P.distanceTo(U.uCam.value)) : 1;
        return { x: cr.left + ((_v.x + 1) / 2) * cr.width, y: cr.top + ((1 - _v.y) / 2) * cr.height, tau, a: a * fdK, fd: fdK, pos: P.toArray().map((v) => +v.toFixed(5)), mode: mode === 1 || mode === 3 ? 'out' : 'back', fly, land: { x: S0.x, y: S0.y, z: S0.z }, glyph: A.aSize.array[n * 3 + 1] > 1.5, asp: A.aSize.array[n * 3 + 2], depth: dpt, sizePx: Math.min(U.uMaxPx.value, (A.aSize.array[n * 3] * camera.projectionMatrix.elements[5] * cr.height) / 2 / Math.max(1e-3, dpt)) };
      },
      /** Kiểm thử — nhịp từng hạt BAY (tiến độ camera): [lúc tách, thời gian trôi / bay, lúc rời (về), thời gian bay về]. */
      glyphTimes() {
        const G = sets.get(curId());
        if (!G?.attr) return null;
        const a = G.attr.aT.array;
        const out = [];
        for (let n = 0; n < G.N; n++) if (G.attr.aFly.array[n] > 0.5) out.push([+a[n * 4].toFixed(4), +a[n * 4 + 1].toFixed(4), +a[n * 4 + 2].toFixed(4), +a[n * 4 + 3].toFixed(4)]);
        const T = G.timing ? { ...G.timing } : null;
        return { timing: T, mode: G.mode, sprites: out };
      },
    },
    dispose() {
      window.removeEventListener('reader:open', onOpen);
      window.removeEventListener('reader:close', onClose);
      offSettings();
      for (const G of sets.values()) if (G.ready) disposeSet(G);
      sets.clear();
      for (const P of traceCache.values())
        P.then((tr) => {
          if (!tr) return;
          tr.ids.dispose();
          tr.cov.dispose();
          tr.atlas.dispose();
        });
      traceCache.clear();
    },
  };
}
