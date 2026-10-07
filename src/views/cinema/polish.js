// Độ BÓNG do xoa đầu rùa (chế độ Điện ảnh, "Xoa đầu rùa").
//
// Mỗi lần xoa để lại một "vết" (splat) 3D trong TOẠ ĐỘ CỤC BỘ CỦA MÔ HÌNH: tâm + bán kính + độ mạnh.
// Không vẽ lên UV: bản đồ UV của mô hình quét bị xé thành hàng trăm mảnh, vẽ theo UV sẽ lộ đường nối.
//
// Shader (MỘT chương trình cho mọi bia, mọi số vết — chỉ đổi uniform, không bao giờ biên dịch lại):
//   polish = smoothstep(0, RUB_POLISH_SAT, Σ strengthᵢ · gauss(|p − cᵢ| / rᵢ)) · (mặt nạ vùng xoa)
//   · albedo → MÀU ĐÁ XANH BÓNG (settings.rubColor): nhân tỉ lệ rubColor / albedo trung bình của đầu rùa (đo từ
//     texture quét, measureHeadAlbedo) → trung bình vùng bóng đúng màu đã chọn mà vẫn giữ vân đá của bản quét
//     (r9: bản r8 nhân màu ấm "dầu da tay" → người dùng thấy vàng như kim loại; rùa là đá xanh)
//   · roughness → ×(1 − 0,88·rubGloss) (độ bóng tối đa) — vệt sáng của đèn / môi trường gọn lại, trượt khi xoay
//   · F0 phản xạ ×(1 + 4·rubGloss) (bề mặt nhẵn, hơi láng)
//   · pháp tuyến MƯỢT ở chỗ bóng: lưới quét đã giản lược mang pháp tuyến PHẲNG theo từng tam giác (≈ 3 đỉnh /
//     tam giác) — đá nhám (roughness 0,92) che được, nhưng hạ roughness là vệt sáng lộ từng mặt tam giác như
//     kim loại. ensurePolishNormals() tính một thuộc tính pháp tuyến trung bình (các đỉnh trùng chỗ gộp lại) CHỈ
//     trong vùng đầu rùa; shader trộn về nó theo độ bóng → chỗ xoa mòn nhẵn thật sự.
// Mặt nạ vùng xoa (r10): ĐẦU + CỔ, dò bởi tools/measure-heads.mjs — hình cầu đầu (REGION_HEAD_K × bán kính đầu)
// hợp với "viên thuốc" cổ (bán kính REGION_NECK_K × r, từ tâm đầu dọc trục cổ tới chỗ cổ gặp mai), cắt bỏ phần dưới
// mặt dưới cằm → chân trước / mai không lọt vào (r9 dùng cầu 1,4× nên lấn sang chân trước bia 1727). Ngoài vùng = 0,
// xoa ở đâu khác cũng không bóng lên. Cùng một hàm khoảng cách ở shader (GLSL) và JS (regionDist) cho phép thử tia.
// Vòng BRUSH (r10): trong chế độ xoa, một vòng mảnh vẽ ngay trên mặt đá quanh điểm con trỏ chạm, bán kính = đúng
// bán kính vết xoa (settings.rubRadius) — mờ khi để yên, sáng hơn khi đang xoa.
// Hiệu ứng mở khoá (trứng phục sinh, r9): ánh "lung linh" rất mờ + một vệt loé quét ngang đầu rùa — cộng vào
// bức xạ tự phát trong vùng xoa, cũng chỉ bằng uniform.
// Tổng vết tính ở VERTEX shader (nội suy xuống fragment): lưới quét dày ở đầu rùa (khoảng cách đỉnh ≪ bán kính
// vết) nên mịn như tính từng điểm ảnh, mà rẻ hơn hàng chục lần — đo GPU khung cận với 64 vết: tính theo fragment
// +17 %, theo vertex không đo được khác biệt. Đỉnh ngoài vùng đầu bỏ qua cả vòng lặp.
//
// Vết lưu gọn trong MỘT mảng vec4 (64 phần tử): xyz = tâm, w = floor(bán kính × R_Q) + độ mạnh × 0,999
// (bán kính lượng tử 1/20000 đơn vị mô hình, độ mạnh ở phần lẻ — float32 còn dư ~2e-4 cho phần lẻ).

import { RUB_POLISH_SAT } from '../../core/rub-store.js';

export const POLISH_MAX = 64;
const R_Q = 20000; // lượng tử bán kính: w = floor(r·R_Q) + s·S_K
const S_K = 0.999;
/** Vết mới cách vết cũ < ngần này × bán kính → cộng vào vết cũ (không mở vết mới). */
export const MERGE_K = 0.5;
/** Vùng xoa: cầu đầu bán kính REGION_HEAD_K × r + cổ (viên thuốc bán kính REGION_NECK_K × r), cắt dưới cằm. */
export const REGION_HEAD_K = 1.1;
export const REGION_NECK_K = 0.55; // = NECK_R ở tools/measure-heads.mjs
/** Mép mềm của mặt nạ (theo r): bóng giữ nguyên tới −REGION_SOFT, tắt hẳn ở +REGION_SOFT/2 ngoài mép vùng. */
const REGION_SOFT = 0.12;
/** Mặt phẳng cắt dưới cằm: hạ thấp hơn y mặt dưới cằm ngần này × r (mép mềm cùng bề rộng). */
const CHIN_DROP = 0.08;

/**
 * Khoảng cách CÓ DẤU (đơn vị mô hình) từ điểm tới vùng xoa đầu + cổ: âm = bên trong. `head` = { center, radius,
 * neck: { axis, length, under } }. Cắt dưới cằm trả về +∞. Dùng cho phép thử tia (stage.rubHit) — cùng công thức
 * với shader.
 */
export function regionDist(head, x, y, z) {
  const [cx, cy, cz] = head.center;
  const r = head.radius;
  const dHead = Math.hypot(x - cx, y - cy, z - cz) - REGION_HEAD_K * r;
  let dNeck = Infinity;
  const nk = head.neck;
  if (nk?.axis && nk.length > 0) {
    const [ax, ay, az] = nk.axis;
    const t = Math.min(nk.length, Math.max(0, (x - cx) * ax + (y - cy) * ay + (z - cz) * az));
    dNeck = Math.hypot(x - (cx + ax * t), y - (cy + ay * t), z - (cz + az * t)) - REGION_NECK_K * r;
  }
  if (Number.isFinite(nk?.under) && y < nk.under - CHIN_DROP * r) return Infinity;
  return Math.min(dHead, dNeck);
}
/** Hình cầu bao vùng xoa (tâm + bán kính, toạ độ mô hình) — lọc nhanh / làm mượt pháp tuyến. */
export function regionBounds(head) {
  const [cx, cy, cz] = head.center;
  const r = head.radius;
  const nk = head.neck;
  if (!nk?.axis || !(nk.length > 0)) return { center: [cx, cy, cz], radius: REGION_HEAD_K * r };
  const h = nk.length / 2;
  const c = [cx + nk.axis[0] * h, cy + nk.axis[1] * h, cz + nk.axis[2] * h];
  return { center: c, radius: h + Math.max(REGION_HEAD_K, REGION_NECK_K) * r };
}
/** Độ bóng (settings.rubGloss 0..1) → hệ số nhân roughness / F0 ở chỗ bóng hết cỡ. 0,75 = đúng mức r8 (×0,34). */
export const glossRoughK = (g) => 1 - 0.88 * Math.min(1, Math.max(0, g));
export const glossSpecK = (g) => 4 * Math.min(1, Math.max(0, g));

const CACHE_KEY = 'cinema-stele-polish-v16'; // r90: chữ sáng theo mép dẫn vạch · r89: chữ Hán atlas SDF (uTraceSdf) · r87: + chữ Hán số hoá (uTrace3.w) · r86: + kiểu chữ sáng "Hình chữ dò" (uTrace*) · r85: ánh sáng chữ = ánh sáng xiên trên phù điêu thật (bỏ bản đồ id chữ) · r84: + uScanTune / uScanHead / uScanPlane
// (trước: r74 + lớp quét bản dập (uScan*) · r78 + bóng tấm đọc 3D (uPanelSh*) · r82b + chữ Hán (uGlyph*))

const GLSL_VERT = /* glsl */ `
attribute vec3 aPolishN; // pháp tuyến mượt (vùng đầu rùa), 0 nếu lưới chưa có — xem ensurePolishNormals()
varying vec3 vPolishN;
uniform vec4 uPolish[${POLISH_MAX}];
uniform int uPolishN;
uniform vec4 uPolishHead; // xyz tâm đầu rùa, w bán kính ĐẦU (toạ độ mô hình); w = 0 → bia không có đầu rùa
uniform vec4 uPolishNeck; // xyz điểm cuối cổ (chỗ gặp mai), w y mặt dưới cằm
uniform vec4 uRubFx; // x lung linh 0..1, y vị trí vệt loé (−1…1 ngang vùng; ngoài −1,5…1,5 = tắt), z thời gian (s), w DEV tô vùng
uniform mat4 uPolishFromMesh;
varying float vPolish;
varying vec2 vRubFx; // x mặt nạ vùng xoa, y toạ độ dọc hướng quét của vệt loé (−1…1)
varying vec3 vPolishPos; // toạ độ mô hình (vòng brush vẽ theo từng điểm ảnh)
float regionDist(vec3 p) {
  float r = uPolishHead.w;
  float dHead = distance(p, uPolishHead.xyz) - ${REGION_HEAD_K.toFixed(3)} * r;
  vec3 ab = uPolishNeck.xyz - uPolishHead.xyz;
  float t = clamp(dot(p - uPolishHead.xyz, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  float dNeck = distance(p, uPolishHead.xyz + ab * t) - ${REGION_NECK_K.toFixed(3)} * r;
  return min(dHead, dNeck);
}
float polishAt(vec3 p) {
  vRubFx = vec2(0.0);
  float r = uPolishHead.w;
  if (r <= 0.0) return 0.0;
  float d = regionDist(p);
  if (d > ${(REGION_SOFT / 2).toFixed(3)} * r) return 0.0;
  float mask = (1.0 - smoothstep(-${REGION_SOFT.toFixed(3)} * r, ${(REGION_SOFT / 2).toFixed(3)} * r, d))
    * smoothstep(uPolishNeck.w - ${(2 * CHIN_DROP).toFixed(3)} * r, uPolishNeck.w - ${CHIN_DROP.toFixed(3)} * r * 0.5, p.y);
  vRubFx = vec2(mask, dot(p - uPolishHead.xyz, normalize(vec3(0.8, 0.45, 0.4))) / max(1.3 * r, 1e-4));
  if (uPolishN <= 0) return 0.0;
  float s = 0.0;
  for (int i = 0; i < ${POLISH_MAX}; i++) {
    if (i >= uPolishN) break;
    vec4 q = uPolish[i];
    float rq = floor(q.w);
    float r = rq * ${(1 / R_Q).toExponential(6)};
    float st = (q.w - rq) * ${(1 / S_K).toFixed(6)};
    vec3 d = p - q.xyz;
    float t = dot(d, d) / max(r * r, 1e-8);
    if (t < 6.0) s += st * exp(-2.0 * t);
  }
  return s * mask;
}
`;
// Đáp ứng thị giác: đá bóng lên nhanh ở những lượt xoa đầu rồi chậm dần (bão hoà ở RUB_POLISH_SAT tổng độ mạnh).
const GLSL_FRAG = /* glsl */ `
varying float vPolish;
varying vec3 vPolishN;
varying vec2 vRubFx;
varying vec3 vPolishPos;
uniform vec4 uRubBrush; // xyz tâm vòng brush (toạ độ mô hình), w bán kính (0 = ẩn)
uniform float uRubBrushK; // độ đậm vòng brush 0..1 (ngoài vùng xoa ~0,3 · để yên ~0,6 · đang xoa 1)
uniform vec3 uRubBrushCol; // màu vòng (tuyến tính) — vàng nhấn của Điện ảnh (--gold)
uniform vec3 uRubTint; // albedo ×(tint) ở chỗ bóng hết cỡ = rubColor / albedo trung bình đầu rùa (tuyến tính)
uniform vec2 uRubGloss; // x hệ số roughness, y tăng F0 — ở chỗ bóng hết cỡ
uniform vec4 uRubFx;
// r16 quét hiện (bia đầy đủ thay proxy) — chỉ có trong biến thể VM_REVEAL (discard làm GPU kiểu tile mất tối ưu loại
// điểm ảnh khuất cho CẢ lượt vẽ, nên biến thể thường không mang nó): x = cao độ vạch quét (toạ độ mô hình), z = bề dày
// vệt sáng, w = độ sáng vệt. Phía TRÊN vạch bị bỏ (proxy đứng đó), sát dưới vạch có một vệt sáng mảnh tắt dần xuống.
uniform vec4 uReveal;
uniform vec3 uRevealCol;
// r74 quét bản dập (giữ hai ngón trên mặt bia): vạch sáng chạy từ đỉnh vòm xuống chân mặt bia, chỗ vạch đã qua hiện bản
// dập chiếu phẳng lên mặt đá (toạ độ mô hình → ảnh, r83: uScanK* từng khúc). x = cao độ vạch, y = độ hiện bản dập 0..1, z = độ sáng vạch
// 0..1, w = 0 tắt · 1 vạch + bản dập · 2 chỉ vạch (bia chưa có bản dập). Nhánh theo uniform — tắt thì gần như không tốn gì.
uniform vec4 uScan;
// r83: toạ độ bia → ảnh bản dập TỪNG KHÚC mỗi trục (4 mốc — giấy dập co giãn không đều; xem tools/fit-rubbings.mjs): x (tăng dần)
// ↔ u, y (tăng dần) ↔ v (gốc trên trái của ảnh); ngoài hai đầu kéo dài khúc kề
uniform vec4 uScanKx;
uniform vec4 uScanKu;
uniform vec4 uScanKy;
uniform vec4 uScanKv;
float scanPw(float t, vec4 K, vec4 V) {
  if (t < K.y) return V.x + (t - K.x) * (V.y - V.x) / (K.y - K.x);
  if (t < K.z) return V.y + (t - K.y) * (V.z - V.y) / (K.z - K.y);
  return V.z + (t - K.z) * (V.w - V.z) / (K.w - K.z);
}
uniform vec4 uScanBox; // khung mặt bia: trái, phải, chân, chân vòm (toạ độ mô hình)
uniform vec4 uScanBox2; // x đỉnh vòm, y z mặt trước, z độ lùi tối đa (lòng chữ / khung nổi), w 1 = có ảnh nét riêng
uniform sampler2D uScanMap; // bản dập: rgb (nền mực tối · nét giấy sáng), a = mặt nạ bia
uniform sampler2D uScanStroke; // nét chữ (r = 1 ở nét) — không có thì tách nét theo độ sáng bản dập
uniform vec3 uScanGold; // màu nét (tuyến tính)
uniform vec3 uScanBarCol; // màu vạch sáng (tuyến tính)
// r84: x = × độ sáng vạch, y = × bề rộng dải sáng sau vạch, z = 1 đuôi vệt gọn (đậm tới ~78 % rồi tắt nhanh) · 0 mềm, w –
uniform vec4 uScanTune;
// r84 (người dùng: bản dập in lên đầu rùa nhô trước chân mặt bia): khối cầu đầu rùa (tâm, bán kính × 1,1 — toạ độ bia; w 0 = không có)
// — không điểm nào trong đó nhận bản dập / vệt / chữ Hán (cùng cửa sổ độ sâu quanh mặt phẳng trước + pháp tuyến hướng ra trước)
uniform vec4 uScanHead;
// r84: mặt phẳng mặt bia (toạ độ bia): z = x + y·X + z·Y; w = dải nhô trước mặt phẳng (dải lùi sau: uScanBox2.z)
uniform vec4 uScanPlane;
// r78 bóng của TẤM ĐỌC 3D (đứng song song trước mặt bia một khoảng gap) đổ lên mặt đá theo hướng đèn chính: điểm mặt đá p có bóng khi tia
// p → đèn cắt hình tấm (chữ nhật đỉnh vòm) ở mặt phẳng tấm, tức p.xy + (sx, sy) nằm trong hình đó. uPanelSh = (tâm x, nửa bề
// ngang, đỉnh vòm y, đáy y) · uPanelSh2 = (độ cao vòm, sx, sy, độ mềm mép) · uPanelSh3 = (độ đậm 0..1 — 0 tắt, z mặt trước, tầm lan quầng AO, –)
uniform vec4 uPanelSh;
uniform vec4 uPanelSh2;
uniform vec4 uPanelSh3;
// r85 ÁNH SÁNG CHỮ (stage/glyphs.js — người dùng chọn "không bao giờ hiện hình chữ dò"): không bản đồ id chữ, không mặt nạ chữ —
// ánh sáng XIÊN chiếu lên PHÙ ĐIÊU THẬT của mô hình (pháp tuyến shading, gồm normal map): chỉ phần lệch so với mặt phẳng mặt bia
// (dot(N, L) − dot(N0, L) > 0 — vách nét khắc hướng về đèn) sáng lên, mặt đá phẳng không đổi.
//   · vạch quét = đèn xiên đi xuống (dải mảnh ở vạch + ánh lưu mờ dần trong vệt phía trên)
//   · dải tiêu đề = đèn xiên quét qua lại dọc dải (cửa sổ mềm, hướng đèn đổi theo chiều quét) — mắt không dừng ở hình cố định nào
// uGlyph = (bật 0/1, biên độ đèn xiên vạch 0..1, thời gian s, biên độ quét dải tiêu đề 0..1) · uGlyph2 = (độ dài ánh lưu (đơn vị bia),
// độ mạnh ánh lưu 0..1, × độ sáng đèn xiên, –) · uGlyph3 = (–, –, độ dài vệt bản dập (đơn vị bia), 1 = bản dập chỉ trong vệt)
// uRakeL / uHeadL = hướng TỚI đèn xiên (không gian camera) · uRakeN = pháp tuyến mặt phẳng mặt bia (không gian camera) ·
// uHeadB = dải tiêu đề (x0, x1, y0, y1 — toạ độ bia; x1 ≤ x0: không có) · uHeadS = (tâm x cửa sổ quét, nửa bề rộng, × độ sáng, –)
uniform vec4 uGlyph;
uniform vec4 uGlyph2;
uniform vec4 uGlyph3;
uniform vec3 uRakeL;
uniform vec3 uRakeN;
uniform vec3 uHeadL;
uniform vec4 uHeadB;
uniform vec4 uHeadS;
uniform vec3 uRakeCol;
// r86 HÌNH CHỮ DÒ (kiểu chữ sáng "Hình chữ dò" — stage/glyphs.js; khôi phục r82b / r84): bản đồ id chữ (hệ ảnh của dữ liệu chữ dò —
// ánh xạ từng khúc uTraceK*) — chữ THÂN BIA thức (le lói mờ, chậm, thưa), sáng sau vệt (vàng ấm + quầng mềm từ mipmap độ phủ, lấp
// lánh theo pha riêng), nhường chỗ cho sprite bay của nó (không chữ đôi). Dải tiêu đề không bao giờ có mặt nạ (điểm ảnh chữ dải tiêu
// đề bị xoá khỏi bản đồ lúc nạp — glyphs.js; dải đó vẫn là đèn quét r85).
// uTrace = (bật 0/1, độ thức 0..1, thời gian s, độ lấp lánh 0..1) · uTrace2 = (đường sáng y — chữ có tâm cao hơn thì sáng, độ sáng
// chung 0..1, tiến độ bay ra 0..1, pha 0 giữ · 1 bay ra · 2 bay về) · uTrace3 = (tiến độ camera lúc bay về 0..1, độ hiện chung 0..1,
// × quầng, kiểu: 0 hình chữ dò · 1 chữ Hán số hoá — r87) · uTrace4 = (đỉnh / đáy sóng tách chữ y, lúc tách ở đỉnh / đáy — tiến độ camera) · uTrace5 = (× le lói khi thức, × nhịp
// le lói, × độ sáng chữ đã sáng, lúc chữ bắt đầu chạm đá khi bay về)
uniform vec4 uTrace;
uniform vec4 uTrace2;
uniform vec4 uTrace3;
uniform vec4 uTrace4;
uniform vec4 uTrace5;
uniform vec4 uTraceKx; // ánh xạ từng khúc toạ độ bia → uv ảnh dữ liệu chữ (gốc trên trái): u = pw(x; Kx → Ku), v = pw(y; Ky → Kv)
uniform vec4 uTraceKu;
uniform vec4 uTraceKy;
uniform vec4 uTraceKv;
uniform sampler2D uTraceIds; // RG = id+1 (gần nhất)
uniform sampler2D uTraceCov; // R = độ phủ nét (mipmap — quầng) · r87 chữ Hán số hoá: atlas chữ dựng bằng font (xám = độ phủ)
// RGBA float, mỗi khối 1024 chữ 4 hàng: 4k (cx, cy, pha, bay?) · 4k+1 (lúc tách, lúc về, nhịp, –) · r87 chữ Hán số hoá: 4k+2 hộp chữ
// trên ảnh (u0 v0 u1 v1, v gốc trên) · 4k+3 ô atlas (uv đã lật)
uniform sampler2D uTraceData;
uniform vec3 uTraceGold;
uniform vec4 uTraceSdf; // r89 chữ Hán: atlas SDF — (rộng, cao atlas px, tầm SDF texel, độ dày thêm px màn) · z = 0: atlas độ phủ cũ
`;

// r74 quét bản dập — phần 1 (ngay sau map_fragment): mặt nạ khung (chữ nhật + vòm elip) × cửa sổ z (chỉ lớp mặt trước,
// không rùa / hông phiến) × pháp tuyến hình học hướng ra trước; chỗ vạch đã qua: nền mực làm tối đá (nhẹ), nét để nguyên.
// Đạo hàm màn hình (dFdx / fwidth) tính NGOÀI mọi nhánh không đồng nhất.
const GLSL_SCAN_DIFFUSE = /* glsl */ `
  float scanM = 0.0;
  float scanK = 0.0;
  float scanStroke = 0.0;
  float scanPx = 1.0;
  float faceM = 0.0; // r85: lớp mặt bia (đèn xiên chỉ chiếu ở đây — phần 2)
  float traceE = 0.0; // r86: bức xạ hình chữ dò (× uTraceGold — cộng ở phần 2)
  if (uScan.w > 0.5 || uGlyph.x > 0.5 || uTrace.x > 0.5) {
    vec3 sp = vPolishPos;
    vec3 gn = cross(dFdx(sp), dFdy(sp));
    float gl = length(gn);
    float gnz = gl > 1e-12 ? abs(gn.z) / gl : 0.0;
    scanPx = max(fwidth(sp.y), 1e-6);
    float cx = 0.5 * (uScanBox.x + uScanBox.y);
    float ax = max(0.5 * (uScanBox.y - uScanBox.x), 1e-4);
    float edge = 0.004; // mép mềm ~4 mm (bia cao 1)
    float m = smoothstep(uScanBox.x, uScanBox.x + edge, sp.x) * (1.0 - smoothstep(uScanBox.y - edge, uScanBox.y, sp.x))
      * smoothstep(uScanBox.z, uScanBox.z + edge, sp.y);
    if (sp.y > uScanBox.w) {
      vec2 e = vec2((sp.x - cx) / ax, (sp.y - uScanBox.w) / max(uScanBox2.x - uScanBox.w, 1e-4));
      m *= 1.0 - smoothstep(0.985, 1.0, dot(e, e));
    }
    // r84: cửa sổ độ sâu quanh mặt phẳng trước (mặt đá thật lệch −0,03 … +0,01 — lòng chữ, độ nghiêng), mép mềm: sau mặt phẳng tới
    // uScanBox2.z, trước tới +0,012 rồi tắt hết ở +0,024 (đầu rùa / mai nhô ra trước ≥ +0,15 không bao giờ lọt) · khối cầu đầu rùa
    // r84: khoảng cách tới MẶT PHẲNG MẶT BIA đo từ mô hình (không phải mặt phẳng z hằng — mặt bia nghiêng); mép mềm 4 mm
    float dzp = sp.z - (uScanPlane.x + uScanPlane.y * sp.x + uScanPlane.z * sp.y);
    m *= smoothstep(-uScanBox2.z - 0.004, -uScanBox2.z, dzp) * (1.0 - smoothstep(uScanPlane.w, uScanPlane.w + 0.004, dzp));
    if (uScanHead.w > 0.0) m *= smoothstep(uScanHead.w, uScanHead.w * 1.08, distance(sp, uScanHead.xyz));
    m *= smoothstep(0.25, 0.5, gnz);
    scanM = uScan.w > 0.5 ? m : 0.0;
    // (ảnh nạp có lật dọc — flipY: uv.y = 1 − v ảnh)
    vec2 suv = vec2(scanPw(sp.x, uScanKx, uScanKu), 1.0 - scanPw(sp.y, uScanKy, uScanKv));
    // r87: uv ảnh dữ liệu chữ + đạo hàm màn hình (ngoài mọi nhánh không đồng nhất — lấy mẫu atlas chữ Hán bằng textureGrad, sắc nét)
    vec2 tguv = vec2(scanPw(sp.x, uTraceKx, uTraceKu), scanPw(sp.y, uTraceKy, uTraceKv));
    vec2 tgdx = dFdx(tguv);
    vec2 tgdy = dFdy(tguv);
    if (m > 0.0 && uScan.w > 0.5 && uScan.w < 1.5) {
      vec4 tx = texture2D(uScanMap, suv);
      float dev = smoothstep(0.0, 0.045, sp.y - uScan.x); // hiện dần ngay sau vạch
      // r82b: chế độ vệt — bản dập chỉ trong một vệt sau vạch, nhạt dần dọc vệt; qua vệt: đá gốc
      float tl = max(uGlyph3.z, 1e-3);
      float trail = uGlyph3.w > 0.5 ? 1.0 - smoothstep(uScanTune.z > 0.5 ? 0.78 * tl : 0.0, tl, sp.y - uScan.x) : 1.0;
      scanK = m * tx.a * dev * trail * uScan.y;
      // ảnh nét của công cụ làm sạch: nền mực ~0,45–0,55, nét sáng hơn → chỉ phần trên ngưỡng mới là nét (nền, thớ giấy,
      // vết gấp ở lại tối)
      if (uScanBox2.w > 0.5) scanStroke = smoothstep(0.54, 0.8, texture2D(uScanStroke, suv).r);
      else {
        // chưa có ảnh nét riêng: nét = chỗ SÁNG HƠN nền quanh nó (lọc thông cao: trừ mức mipmap mờ ~8 px) — dùng được cả với
        // ảnh chụp bản dập chưa làm sạch (nền giấy / mực không đều)
        float lum = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
        float lumB = dot(texture2D(uScanMap, suv, 3.5).rgb, vec3(0.299, 0.587, 0.114));
        scanStroke = smoothstep(0.045, 0.13, lum - lumB);
      }
      // nền mực: đá tối đi nhẹ (nét giữ màu đá — ánh vàng ở phần 2)
      diffuseColor.rgb *= 1.0 - 0.36 * scanK * (1.0 - scanStroke);
    }
    faceM = m;
    // r86 hình chữ dò (r82b / r84) — chỉ lớp mặt (m: khung mặt, cửa sổ quanh mặt phẳng mặt bia, ngoài đầu rùa)
    if (m > 0.0 && uTrace.x > 0.5) {
      vec2 guv = tguv; // hàng 0 = mép TRÊN ảnh (không lật)
      vec2 rg = texture2D(uTraceIds, guv).rg;
      float gid = floor(rg.r * 255.0 + 0.5) + 256.0 * floor(rg.g * 255.0 + 0.5) - 1.0;
      float cov = texture2D(uTraceCov, guv).r;
      float halo = texture2D(uTraceCov, guv, 3.0).r; // mipmap mờ ~8 texel: quầng mềm quanh nét
      float gt = uTrace.z;
      // sóng tách chữ (bay ra) / về chữ (bay về) theo cao độ điểm ảnh — cho quầng (ngoài nét không có id)
      float rank = clamp((uTrace4.x - sp.y) / max(uTrace4.x - uTrace4.y, 1e-4), 0.0, 1.0);
      float hk = 1.0;
      float dAt = uTrace4.z + rank * (uTrace4.w - uTrace4.z);
      if (uTrace2.w > 0.5 && uTrace2.w < 1.5) hk = 1.0 - smoothstep(dAt, dAt + 0.08, uTrace2.z);
      else if (uTrace2.w > 1.5) hk = smoothstep(uTrace5.w, 1.0, uTrace3.x);
      float litF = uTrace2.y * smoothstep(0.0, 0.01, sp.y - uTrace2.x);
      float core = 0.0;
      if (gid > -0.5) {
        ivec2 ti = ivec2(int(mod(gid, 1024.0)), 4 * int(floor(gid / 1024.0)));
        vec4 g0 = texelFetch(uTraceData, ti, 0);
        vec4 g1 = texelFetch(uTraceData, ti + ivec2(0, 1), 0);
        float ph = g0.z;
        // thức: lấp lánh mờ, CHẬM (chu kỳ ~1,4–3 s), THƯA (đỉnh hẹp — phần lớn thời gian chỉ le lói)
        float tw = 0.5 + 0.5 * sin(gt * (2.1 + 2.4 * g1.z) * uTrace5.y + ph * 6.2832);
        float awake = uTrace.y * (0.06 + 0.5 * pow(tw, 12.0)) * uTrace5.x;
        // sáng: vàng ấm + lấp lánh theo pha riêng (dao động nhẹ + loé thưa). r90: bật ĐÚNG khung mép dẫn của vạch qua tâm chữ,
        // loé một nhịp, lấp lánh dày khi vệt đi qua (uGlyph3: độ dài vệt, bật), ra khỏi vệt về nhịp thường
        float dL = g0.y - uTrace2.x;
        float lit = uTrace2.y * step(0.0, dL); // cả chữ bật cùng lúc (một giá trị mỗi chữ — không răng cưa)
        float flash = dL > 0.0 ? exp(-dL / 0.015) : 0.0;
        float inTr = uGlyph3.w > 0.5 ? 1.0 - smoothstep(0.6 * uGlyph3.z, uGlyph3.z, dL) : 0.0;
        float spk = 0.5 + 0.5 * sin(gt * (2.6 + 3.0 * g1.z) * (1.0 + 1.6 * inTr) + ph * 37.0);
        float glint = pow(max(0.0, sin(gt * (0.8 + 0.9 * ph) * (1.0 + 2.0 * inTr) + ph * 13.0)), 28.0);
        float litE = lit * (0.7 + uTrace.w * (0.35 * spk + 1.1 * glint) * (1.0 + 0.8 * inTr) + 0.9 * flash);
        // nhường sprite: bay ra — chữ bay tắt trong 0,03 (cùng nhịp sprite hiện), chữ không bay tắt tại chỗ chậm hơn; bay về — chữ
        // sáng lại đúng lúc sprite của nó chạm đá
        float k = 1.0;
        if (uTrace2.w > 0.5 && uTrace2.w < 1.5) k = 1.0 - smoothstep(g1.x, g1.x + (g0.w > 0.5 ? 0.03 : 0.2), uTrace2.z);
        else if (uTrace2.w > 1.5) k = smoothstep(g1.y - (g0.w > 0.5 ? 0.02 : 0.25), g1.y, uTrace3.x);
        if (uTrace3.w > 0.5) {
          // r87 chữ Hán số hoá: chữ đánh máy (atlas font) đặt vuông vức trong hộp chữ trên ảnh — sắc nét (textureGrad theo đạo hàm của
          // uv ảnh), sáng ấm sau vệt, lấp lánh nhẹ; không le lói khi thức (không đoán chữ trước khi vạch tới)
          vec4 gr = texelFetch(uTraceData, ti + ivec2(0, 2), 0);
          vec4 ar = texelFetch(uTraceData, ti + ivec2(0, 3), 0);
          vec2 ext = max(gr.zw - gr.xy, vec2(1e-6));
          vec2 lc = (guv - gr.xy) / ext;
          float inside = step(0.0, lc.x) * step(lc.x, 1.0) * step(0.0, lc.y) * step(lc.y, 1.0);
          vec2 asz = ar.zw - ar.xy;
          vec2 auv = ar.xy + vec2(lc.x, 1.0 - lc.y) * asz;
          vec2 adx = tgdx / ext * vec2(asz.x, -asz.y);
          vec2 ady = tgdy / ext * vec2(asz.x, -asz.y);
          float cv, hl;
          if (uTraceSdf.z > 0.0) {
            // r89: atlas SDF. Chữ chỉ ~6–10 px ở khung nghỉ — độ phủ nét mảnh mip xuống thành ô xám vuông. Ở đây: 4 mẫu SDF (lưới
            // 2×2, ¼ px) → độ phủ của hình chữ NHỊ PHÂN trong điểm ảnh, rồi tăng tương phản khi chữ nhỏ (điểm ảnh phủ ít → tối): nét
            // rõ, khe giữa nét giữ tối thay vì xám đều. Quầng = theo khoảng cách ra ngoài nét (đúng HÌNH CHỮ), chỉ khi chữ đủ lớn,
            // tắt dần trước mép hộp chữ — không bao giờ là hình ô vuông.
            float tpp = max(length(adx * uTraceSdf.xy), length(ady * uTraceSdf.xy)); // texel atlas / px màn
            float cellPx = asz.y * uTraceSdf.y / max(tpp, 1e-3);
            float kpx = 4.0 * uTraceSdf.z / max(tpp, 1e-3); // (sd − 0,5) → khoảng cách theo ½ px
            vec2 ox = adx * 0.25;
            vec2 oy = ady * 0.25;
            float c4 = 0.0;
            c4 += clamp((textureGrad(uTraceCov, auv - ox - oy, ox, oy).r - 0.5) * kpx + 0.5 + uTraceSdf.w, 0.0, 1.0);
            c4 += clamp((textureGrad(uTraceCov, auv + ox - oy, ox, oy).r - 0.5) * kpx + 0.5 + uTraceSdf.w, 0.0, 1.0);
            c4 += clamp((textureGrad(uTraceCov, auv - ox + oy, ox, oy).r - 0.5) * kpx + 0.5 + uTraceSdf.w, 0.0, 1.0);
            c4 += clamp((textureGrad(uTraceCov, auv + ox + oy, ox, oy).r - 0.5) * kpx + 0.5 + uTraceSdf.w, 0.0, 1.0);
            float big = smoothstep(9.0, 24.0, cellPx);
            cv = inside * smoothstep(mix(0.3, 0.0, big), mix(0.75, 1.0, big), c4 * 0.25);
            vec2 win = smoothstep(0.0, 0.07, lc) * smoothstep(1.0, 0.93, lc);
            float sdH = textureGrad(uTraceCov, auv, adx * 1.2, ady * 1.2).r;
            hl = inside * win.x * win.y * pow(smoothstep(0.12, 0.5, sdH), 2.0) * (1.0 - cv) * big;
          } else {
            cv = inside * textureGrad(uTraceCov, auv, adx * 0.6, ady * 0.6).r;
            hl = inside * textureGrad(uTraceCov, auv, adx * 5.0, ady * 5.0).r;
          }
          float litH = lit;
          float spkH = 0.5 + 0.5 * sin(gt * (1.3 + 1.5 * g1.z) * (1.0 + 1.6 * inTr) + ph * 37.0);
          core = (cv * (uTraceSdf.z > 0.0 ? 1.8 : 1.3) + hl * (uTraceSdf.z > 0.0 ? 0.45 : 0.22) * uTrace3.z) * litH * (0.85 + 0.3 * uTrace5.x * spkH * (1.0 + inTr) + 0.6 * flash) * k;
        } else core = cov * max(awake, litE) * k;
      }
      traceE = m * uTrace3.y * uTrace5.z * (uTrace3.w > 0.5 ? core : core * 1.05 + halo * litF * hk * 0.55 * uTrace3.z);
      // dải tiêu đề: không bao giờ có ánh chữ dò (kể cả quầng của chữ thân bia sát mép — dải tiêu đề là đèn quét r85)
      if (uHeadB.y > uHeadB.x) traceE *= 1.0 - step(uHeadB.z, sp.y) * step(sp.y, uHeadB.w);
    }
  }
`;
// r78 bóng tấm đọc 3D trên mặt đá (chỉ lớp mặt trước — cửa sổ z + pháp tuyến hướng ra trước), mép mềm theo khoảng cách tấm.
const GLSL_PANEL_SHADOW = /* glsl */ `
  if (uPanelSh3.x > 0.0) {
    vec3 pp = vPolishPos;
    vec3 pgn = cross(dFdx(pp), dFdy(pp));
    float pgl = length(pgn);
    float pnz = pgl > 1e-12 ? abs(pgn.z) / pgl : 0.0;
    float faceP = step(uPanelSh3.y - 0.08, pp.z) * step(pp.z, uPanelSh3.y + 0.04) * smoothstep(0.2, 0.5, pnz);
    // SDF hình tấm (chữ nhật đỉnh vòm elip) tại q: bóng đèn chính = SDF tại p dời theo hướng đèn; che khuất môi trường
    // (AO) = SDF tại p, lan ra ~ uPanelSh3.z (tỉ lệ khoảng cách tấm – đá) — phối cảnh co mép bóng vào sau tấm, riêng
    // quầng AO + viền bóng phía khuất đèn lộ ra quanh mép tấm
    vec2 hp = pp.xy + uPanelSh2.yz;
    float u = clamp((hp.x - uPanelSh.x) / max(uPanelSh.y, 1e-4), -1.0, 1.0);
    float archY = uPanelSh.z - uPanelSh2.x + uPanelSh2.x * sqrt(max(0.0, 1.0 - u * u));
    float sd = max(abs(hp.x - uPanelSh.x) - uPanelSh.y, max(hp.y - archY, uPanelSh.w - hp.y));
    float sh = 1.0 - smoothstep(-uPanelSh2.w, uPanelSh2.w, sd);
    float ua = clamp((pp.x - uPanelSh.x) / max(uPanelSh.y, 1e-4), -1.0, 1.0);
    float archA = uPanelSh.z - uPanelSh2.x + uPanelSh2.x * sqrt(max(0.0, 1.0 - ua * ua));
    float sdA = max(abs(pp.x - uPanelSh.x) - uPanelSh.y, max(pp.y - archA, uPanelSh.w - pp.y));
    float ao = 1.0 - smoothstep(-0.25 * uPanelSh3.z, uPanelSh3.z, sdA);
    diffuseColor.rgb *= 1.0 - 0.45 * uPanelSh3.x * max(sh, 0.7 * ao) * faceP;
  }
`;
// r74 quét bản dập — phần 2 (bức xạ tự phát): nét chữ ánh vàng ấm mờ + vạch sáng (dải mềm phía đã qua + mép dẫn mảnh sắc).
const GLSL_SCAN_EMISSIVE = /* glsl */ `
  // r85: đèn xiên trên phù điêu thật — vạch quét (+ ánh lưu trong vệt) · quét dải tiêu đề
  if (uGlyph.x > 0.5 && faceM > 0.0) {
    vec3 rN = normalize(normal);
    vec3 rp = vPolishPos;
    float rd = rp.y - uScan.x; // > 0: vạch đã qua (phía trên vạch)
    float rLead = exp(-pow(rd / (rd > 0.0 ? 0.035 : 0.012), 2.0));
    float rAfter = rd > 0.0 ? exp(-rd / max(uGlyph2.x, 1e-3)) * uGlyph2.y : 0.0;
    float rW = max(rLead, rAfter) * uGlyph.y;
    // độ nghiêng của pháp tuyến về phía đèn so với mặt phẳng mặt bia (≈ sin góc nghiêng — chuẩn hoá theo đèn sượt), đường cong tương
    // phản: nghiêng nhỏ (thớ đá) gần như không, vách nét khắc (≥ ~8°) sáng hẳn
    float rDen = sqrt(max(1e-4, 1.0 - pow(dot(uRakeN, uRakeL), 2.0)));
    float rRel = pow(clamp((dot(rN, uRakeL) - dot(uRakeN, uRakeL)) / rDen / 0.12, 0.0, 1.0), 1.4);
    float rakeE = rRel * rW;
    if (uHeadB.y > uHeadB.x && uGlyph.w > 0.0) {
      float hb = smoothstep(uHeadB.x, uHeadB.x + 0.01, rp.x) * (1.0 - smoothstep(uHeadB.y - 0.01, uHeadB.y, rp.x))
        * smoothstep(uHeadB.z, uHeadB.z + 0.008, rp.y) * (1.0 - smoothstep(uHeadB.w - 0.008, uHeadB.w, rp.y));
      float hw = exp(-pow((rp.x - uHeadS.x) / max(uHeadS.y, 1e-3), 2.0));
      float hDen = sqrt(max(1e-4, 1.0 - pow(dot(uRakeN, uHeadL), 2.0)));
      float hRel = pow(clamp((dot(rN, uHeadL) - dot(uRakeN, uHeadL)) / hDen / 0.12, 0.0, 1.0), 1.4);
      // phù điêu + một quầng rất nhẹ theo cửa sổ (dải tiêu đề phẳng / mòn vẫn thấy ánh quét đi qua)
      rakeE += hb * hw * uGlyph.w * uHeadS.z * (hRel + 0.02);
    }
    totalEmissiveRadiance += uRakeCol * (rakeE * uGlyph2.z * faceM);
    if (uGlyph2.w > 0.5) totalEmissiveRadiance += uGlyph2.w < 1.5 ? vec3(rW * faceM) : uGlyph2.w < 2.5 ? vec3(rRel) : (rN * 0.5 + 0.5); // DEV: 1 cửa sổ · 2 độ nghiêng · 3 pháp tuyến
  }
  if (traceE > 0.0) totalEmissiveRadiance += uTraceGold * traceE; // r86 hình chữ dò
  if (scanM > 0.0) {
    totalEmissiveRadiance += uScanGold * (scanStroke * scanK * 0.42);
    float sd = vPolishPos.y - uScan.x;
    float band = exp(-pow(max(sd, 0.0) / (0.035 * uScanTune.y), 2.0)) * step(-scanPx * 1.5, sd);
    float lead = 1.0 - smoothstep(scanPx * 0.6, scanPx * 1.8, abs(sd));
    totalEmissiveRadiance += uScanBarCol * (uScan.z * uScanTune.x * scanM * (0.14 * band + 0.42 * lead));
  }
`;

/**
 * Gắn shader độ bóng vào MỘT vật liệu (MeshStandardMaterial của mô hình quét). `U` = bộ uniform dùng chung
 * cho cả mô hình (mọi vật liệu của một bản sao bia trỏ cùng một đối tượng → đổi một lần là đủ).
 * `fromMesh` = uniform riêng của vật liệu này: ma trận lưới cục bộ → toạ độ mô hình.
 */
function hookMaterial(m, U, fromMesh) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPolish = U.uPolish;
    sh.uniforms.uPolishN = U.uPolishN;
    sh.uniforms.uPolishHead = U.uPolishHead;
    sh.uniforms.uPolishNeck = U.uPolishNeck;
    sh.uniforms.uRubBrush = U.uRubBrush;
    sh.uniforms.uRubBrushK = U.uRubBrushK;
    sh.uniforms.uRubBrushCol = U.uRubBrushCol;
    sh.uniforms.uRubTint = U.uRubTint;
    sh.uniforms.uRubGloss = U.uRubGloss;
    sh.uniforms.uRubFx = U.uRubFx;
    sh.uniforms.uReveal = U.uReveal;
    sh.uniforms.uRevealCol = U.uRevealCol;
    sh.uniforms.uScan = U.uScan;
    for (const k of ['uScanKx', 'uScanKu', 'uScanKy', 'uScanKv']) sh.uniforms[k] = U[k];
    sh.uniforms.uScanBox = U.uScanBox;
    sh.uniforms.uScanBox2 = U.uScanBox2;
    sh.uniforms.uScanMap = U.uScanMap;
    sh.uniforms.uScanStroke = U.uScanStroke;
    sh.uniforms.uScanGold = U.uScanGold;
    sh.uniforms.uScanBarCol = U.uScanBarCol;
    sh.uniforms.uScanTune = U.uScanTune;
    sh.uniforms.uScanHead = U.uScanHead;
    sh.uniforms.uScanPlane = U.uScanPlane;
    sh.uniforms.uPanelSh = U.uPanelSh;
    sh.uniforms.uPanelSh2 = U.uPanelSh2;
    sh.uniforms.uPanelSh3 = U.uPanelSh3;
    for (const k of ['uGlyph', 'uGlyph2', 'uGlyph3', 'uRakeL', 'uRakeN', 'uHeadL', 'uHeadB', 'uHeadS', 'uRakeCol']) sh.uniforms[k] = U[k];
    for (const k of ['uTrace', 'uTrace2', 'uTrace3', 'uTrace4', 'uTrace5', 'uTraceKx', 'uTraceKu', 'uTraceKy', 'uTraceKv', 'uTraceIds', 'uTraceCov', 'uTraceData', 'uTraceGold', 'uTraceSdf']) sh.uniforms[k] = U[k];
    sh.uniforms.uPolishFromMesh = fromMesh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_VERT}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPolishPos = (uPolishFromMesh * vec4(transformed, 1.0)).xyz;\n  vPolish = polishAt(vPolishPos);')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n  vPolishN = normalMatrix * aPolishN;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_FRAG}`)
      // một lần mỗi fragment, trước mọi phần cần tới
      .replace('#include <map_fragment>', `#ifdef VM_REVEAL\n  if (uReveal.y > 0.5 && vPolishPos.y > uReveal.x) discard;\n#endif\nfloat polishK = smoothstep(0.0, ${RUB_POLISH_SAT.toFixed(2)}, vPolish);\n#include <map_fragment>\n  diffuseColor.rgb *= mix(vec3(1.0), uRubTint, polishK);\n${GLSL_SCAN_DIFFUSE}\n${GLSL_PANEL_SHADOW}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n  roughnessFactor *= mix(1.0, uRubGloss.x, polishK);`)
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  if (polishK > 0.0 && dot(vPolishN, vPolishN) > 1e-6) {
    vec3 polishN = normalize(vPolishN);
    #ifdef DOUBLE_SIDED
      polishN *= faceDirection;
    #endif
    normal = normalize(mix(normal, polishN, polishK));
  }`,
      )
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n  material.specularColor *= 1.0 + uRubGloss.y * polishK;`)
      // mở khoá: lung linh rất mờ (sóng chậm chạy ngang vùng) + vệt loé quét một lượt
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  if (vRubFx.x > 0.0 && (uRubFx.x > 0.0 || abs(uRubFx.y) < 1.5)) {
    float shim = uRubFx.x * (0.5 + 0.5 * sin(vRubFx.y * 7.0 - uRubFx.z * 2.4)) * 0.045;
    float gl = exp(-pow((vRubFx.y - uRubFx.y) / 0.13, 2.0)) * 0.13;
    totalEmissiveRadiance += vec3(0.96, 0.98, 1.0) * (shim + gl) * vRubFx.x;
  }
  if (uRubFx.w > 0.0) totalEmissiveRadiance += vec3(1.0, 0.55, 0.1) * vRubFx.x * uRubFx.w; // DEV: tô vùng xoa
  ${GLSL_SCAN_EMISSIVE}
  #ifdef VM_REVEAL
    if (uReveal.y > 0.5) totalEmissiveRadiance += uRevealCol * (uReveal.w * exp(-(uReveal.x - vPolishPos.y) / max(uReveal.z, 1e-4)));
  #endif`,
      )
      // vòng brush (r11): đường tròn mảnh màu vàng trên mặt đá, bán kính = bán kính vết xoa. THAY màu điểm ảnh (không
      // cộng thêm sáng) + một viền tối mảnh hai bên → đọc được cả trên đá sẫm lẫn trên vệt loá của chỗ đã bóng.
      // Bề rộng theo đạo hàm màn hình → nét ~1,5 px ở mọi khoảng cách; đậm + dày hơn chút khi đang xoa.
      .replace(
        '#include <opaque_fragment>',
        `if (uRubBrush.w > 0.0) {
    float bd = abs(distance(vPolishPos, uRubBrush.xyz) - uRubBrush.w);
    float px = max(fwidth(bd), 1e-7);
    float bw = max(px * 1.5, uRubBrush.w * 0.012) * (1.0 + 0.5 * uRubBrushK);
    float line = 1.0 - smoothstep(bw * 0.55, bw, bd);
    float halo = 1.0 - smoothstep(bw, bw + px * 2.5, bd);
    float a = clamp(uRubBrushK, 0.0, 1.0);
    outgoingLight *= 1.0 - 0.55 * a * halo;
    outgoingLight = mix(outgoingLight, uRubBrushCol * mix(0.8, 1.3, a), line * a);
  }
  #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => CACHE_KEY;
  m.needsUpdate = true;
}

/**
 * Thuộc tính `aPolishN` (Int8 chuẩn hoá) cho mọi lưới của bản gốc `root`: trong vùng xoa (× REGION_OUT)
 * là pháp tuyến TRUNG BÌNH của các đỉnh trùng vị trí (lưới quét tách đỉnh theo tam giác → pháp tuyến phẳng); ngoài
 * vùng đó chép nguyên pháp tuyến gốc. Tính một lần cho mỗi geometry (dùng chung giữa các bản sao / view khác —
 * view khác không đọc thuộc tính này). Trả về số đỉnh đã làm mượt.
 * @param {typeof import('three')} THREE
 */
export function ensurePolishNormals(THREE, root, head) {
  if (!root || !head?.center) return 0;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const relInv = new THREE.Matrix4();
  const c = new THREE.Vector3();
  let smoothed = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (g.getAttribute('aPolishN')) return;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    if (!pos || !nor) return;
    // Làm việc hoàn toàn trong toạ độ CỤC BỘ của lưới (không biến đổi từng đỉnh): tâm + bán kính đầu rùa đưa về
    // cục bộ, các đỉnh trùng vị trí gộp bằng khoá số nguyên (lượng tử 1e-4 đơn vị mô hình).
    rel.multiplyMatrices(inv, o.matrixWorld);
    relInv.copy(rel).invert();
    const B = regionBounds(head);
    c.set(B.center[0], B.center[1], B.center[2]).applyMatrix4(relInv);
    const toLocal = relInv.getMaxScaleOnAxis();
    const R = B.radius * 1.05 * toLocal;
    const R2 = R * R;
    const Q = 1e4 / toLocal;
    const span = Math.ceil(2 * R * Q) + 2;
    const x0 = c.x - R;
    const y0 = c.y - R;
    const z0 = c.z - R;
    const count = pos.count;
    const out = new Int8Array(count * 3);
    const slot = new Int32Array(count).fill(-1);
    const keys = new Map();
    const acc = [];
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const nx = nor.getX(i);
      const ny = nor.getY(i);
      const nz = nor.getZ(i);
      const dx = x - c.x;
      const dy = y - c.y;
      const dz = z - c.z;
      if (dx * dx + dy * dy + dz * dz > R2) {
        out[i * 3] = Math.round(nx * 127);
        out[i * 3 + 1] = Math.round(ny * 127);
        out[i * 3 + 2] = Math.round(nz * 127);
        continue;
      }
      const key = Math.round((x - x0) * Q) + span * (Math.round((y - y0) * Q) + span * Math.round((z - z0) * Q));
      let k = keys.get(key);
      if (k === undefined) {
        k = acc.length;
        keys.set(key, k);
        acc.push(0, 0, 0);
      }
      acc[k] += nx;
      acc[k + 1] += ny;
      acc[k + 2] += nz;
      slot[i] = k;
    }
    for (let i = 0; i < count; i++) {
      const k = slot[i];
      if (k < 0) continue;
      let nx = acc[k];
      let ny = acc[k + 1];
      let nz = acc[k + 2];
      let l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) {
        nx = nor.getX(i);
        ny = nor.getY(i);
        nz = nor.getZ(i);
        l = Math.hypot(nx, ny, nz) || 1;
      }
      out[i * 3] = Math.round((nx / l) * 127);
      out[i * 3 + 1] = Math.round((ny / l) * 127);
      out[i * 3 + 2] = Math.round((nz / l) * 127);
      smoothed++;
    }
    g.setAttribute('aPolishN', new THREE.BufferAttribute(out, 3, true));
  });
  return smoothed;
}

/**
 * Albedo trung bình (TUYẾN TÍNH, [r, g, b]) của vùng đầu rùa trên texture quét: lấy mẫu texture màu (thu nhỏ còn
 * ≤ 512 px) tại UV của các đỉnh trong hình cầu đầu rùa. Một lần mỗi bia (nhớ trên root.userData). Không đọc được
 * texture (không có map / ảnh chưa giải mã) → null (shader dùng tỉ lệ trung tính).
 * @param {typeof import('three')} THREE
 */
export function measureHeadAlbedo(THREE, root, head) {
  if (!root || !head?.center) return null;
  if (root.userData.headAlbedo !== undefined) return root.userData.headAlbedo;
  let res = null;
  try {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const rel = new THREE.Matrix4();
    const relInv = new THREE.Matrix4();
    const c = new THREE.Vector3();
    const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    root.traverse((o) => {
      const img = o.isMesh && o.material?.map?.image;
      const uv = o.isMesh && o.geometry?.getAttribute('uv');
      if (!img || !uv) return;
      const W0 = img.width || img.videoWidth || 0;
      const H0 = img.height || img.videoHeight || 0;
      if (!W0 || !H0) return;
      const s = Math.min(1, 512 / Math.max(W0, H0));
      const W = Math.max(1, Math.round(W0 * s));
      const H = Math.max(1, Math.round(H0 * s));
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H).data;
      const flip = !!o.material.map.flipY; // glTF: flipY = false (v = 0 ở mép TRÊN ảnh)
      const pos = o.geometry.getAttribute('position');
      rel.multiplyMatrices(inv, o.matrixWorld);
      relInv.copy(rel).invert();
      c.set(head.center[0], head.center[1], head.center[2]).applyMatrix4(relInv);
      const R = head.radius * relInv.getMaxScaleOnAxis();
      const R2 = R * R;
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - c.x;
        const dy = pos.getY(i) - c.y;
        const dz = pos.getZ(i) - c.z;
        if (dx * dx + dy * dy + dz * dz > R2) continue;
        let u = uv.getX(i) % 1;
        let v = uv.getY(i) % 1;
        if (u < 0) u += 1;
        if (v < 0) v += 1;
        const x = Math.min(W - 1, Math.floor(u * W));
        const y = Math.min(H - 1, Math.floor((flip ? 1 - v : v) * H));
        const k = (y * W + x) * 4;
        sr += toLin(px[k] / 255);
        sg += toLin(px[k + 1] / 255);
        sb += toLin(px[k + 2] / 255);
        n++;
      }
    });
    if (n > 0) res = [sr / n, sg / n, sb / n];
  } catch {
    res = null;
  }
  root.userData.headAlbedo = res;
  return res;
}

/** Ảnh 1×1 trong suốt cho hai sampler quét bản dập khi chưa có ảnh (một chương trình cho mọi bia). */
let _scanBlank = null;
function scanBlank(THREE) {
  if (!_scanBlank) {
    _scanBlank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    _scanBlank.needsUpdate = true;
  }
  return _scanBlank;
}

/** r82b / r86: dữ liệu chữ rỗng (1×2 float) cho sampler uTraceData khi không vẽ hình chữ dò (một chương trình cho mọi bia). */
let _traceBlank = null;
function traceBlank(THREE) {
  if (!_traceBlank) {
    _traceBlank = new THREE.DataTexture(new Float32Array(8), 1, 2, THREE.RGBAFormat, THREE.FloatType);
    _traceBlank.needsUpdate = true;
  }
  return _traceBlank;
}

/**
 * Bộ độ bóng cho MỘT bản sao bia trong cảnh.
 * @param {typeof import('three')} THREE
 */
export function createPolish(THREE) {
  const U = {
    uPolish: { value: Array.from({ length: POLISH_MAX }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uPolishN: { value: 0 },
    uPolishHead: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPolishNeck: { value: new THREE.Vector4(0, 0, 0, -9) },
    uRubBrush: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRubBrushK: { value: 0 },
    uRubBrushCol: { value: new THREE.Color(0xd9b36c) }, // ghi đè bằng --gold của Điện ảnh (setBrushColor)
    uRubTint: { value: new THREE.Vector3(1, 1, 1) },
    uRubGloss: { value: new THREE.Vector2(glossRoughK(0.75), glossSpecK(0.75)) },
    uRubFx: { value: new THREE.Vector4(0, -9, 0, 0) },
    uReveal: { value: new THREE.Vector4(0, 0, 0.006, 0.5) },
    uRevealCol: { value: new THREE.Color(0xd9b36c) }, // --gold của Điện ảnh (tuyến tính)
    // r74 quét bản dập (xem GLSL_SCAN_*) — ảnh / khung do stage/scan.js đặt; tắt: uScan.w = 0
    uScan: { value: new THREE.Vector4(2, 0, 0, 0) },
    uScanKx: { value: new THREE.Vector4(-1, -0.5, 0.5, 1) },
    uScanKu: { value: new THREE.Vector4(0, 0.25, 0.75, 1) },
    uScanKy: { value: new THREE.Vector4(0, 0.3, 0.7, 1) },
    uScanKv: { value: new THREE.Vector4(1, 0.7, 0.3, 0) },
    uScanBox: { value: new THREE.Vector4(-0.3, 0.3, 0.2, 0.9) },
    uScanBox2: { value: new THREE.Vector4(1, 0, 0.06, 0) },
    uScanMap: { value: scanBlank(THREE) },
    uScanStroke: { value: scanBlank(THREE) },
    uScanGold: { value: new THREE.Color(0xe0b870) },
    uScanBarCol: { value: new THREE.Color(0xfff1d6) },
    uScanTune: { value: new THREE.Vector4(1, 1, 0, 0) },
    uScanHead: { value: new THREE.Vector4(0, 0, 0, 0) },
    uScanPlane: { value: new THREE.Vector4(0, 0, 0, 0.012) },
    // r78 bóng tấm đọc 3D (xem GLSL_PANEL_SHADOW) — stage/read.js đặt; tắt: uPanelSh3.x = 0
    uPanelSh: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPanelSh2: { value: new THREE.Vector4(0, 0, 0, 0.01) },
    uPanelSh3: { value: new THREE.Vector4(0, 0, 0, 0) },
    // r85 ánh sáng chữ (xem GLSL_FRAG) — stage/glyphs.js đặt; tắt: uGlyph.x = 0
    uGlyph: { value: new THREE.Vector4(0, 0, 0, 0) },
    uGlyph2: { value: new THREE.Vector4(0.1, 0.5, 1, 0) },
    uGlyph3: { value: new THREE.Vector4(0, 1, 0.2, 0) },
    uRakeL: { value: new THREE.Vector3(0, 0.3, 0.95) },
    uRakeN: { value: new THREE.Vector3(0, 0, 1) },
    uHeadL: { value: new THREE.Vector3(0.3, 0, 0.95) },
    uHeadB: { value: new THREE.Vector4(0, 0, 0, 0) },
    uHeadS: { value: new THREE.Vector4(0, 0.1, 1, 0) },
    uRakeCol: { value: new THREE.Color(1.0, 0.72, 0.38) },
    // r86 hình chữ dò (xem GLSL_FRAG) — stage/glyphs.js đặt; tắt: uTrace.x = 0
    uTrace: { value: new THREE.Vector4(0, 0, 0, 0.6) },
    uTrace2: { value: new THREE.Vector4(9, 0, 0, 0) },
    uTrace3: { value: new THREE.Vector4(0, 1, 1, 0) },
    uTrace4: { value: new THREE.Vector4(1, 0, 0, 0.5) },
    uTrace5: { value: new THREE.Vector4(1, 1, 1, 0.84) },
    uTraceKx: { value: new THREE.Vector4(0, 0.25, 0.75, 1) },
    uTraceKu: { value: new THREE.Vector4(0, 0.25, 0.75, 1) },
    uTraceKy: { value: new THREE.Vector4(0, 0.25, 0.75, 1) },
    uTraceKv: { value: new THREE.Vector4(1, 0.75, 0.25, 0) },
    uTraceIds: { value: scanBlank(THREE) },
    uTraceCov: { value: scanBlank(THREE) },
    uTraceData: { value: traceBlank(THREE) },
    uTraceGold: { value: new THREE.Color(1.0, 0.62, 0.24) }, // vàng ấm (tuyến tính)
    uTraceSdf: { value: new THREE.Vector4(0, 0, 0, 0) }, // r89 chữ Hán: atlas SDF (rộng, cao, tầm texel, dày thêm px) — z = 0: không
  };
  /** Albedo trung bình (tuyến tính) của đầu rùa trên bản quét — mẫu số của uRubTint. */
  const avg = new THREE.Vector3(0.1, 0.1, 0.1);
  /** Vết: { x, y, z, r, s } (toạ độ mô hình). */
  let splats = [];
  /** Vật liệu đã gắn shader (đổi biến thể VM_REVEAL). */
  const hooked = [];
  let dirty = false;
  // Số lần uniform THỰC SỰ đổi — view vẽ theo yêu cầu (stage.js) so với lần vẽ trước để biết có cần vẽ lại.
  let version = 0;
  const _inv = new THREE.Matrix4();

  function upload() {
    const n = Math.min(POLISH_MAX, splats.length);
    for (let i = 0; i < n; i++) {
      const p = splats[i];
      const rq = Math.max(1, Math.round(p.r * R_Q));
      U.uPolish.value[i].set(p.x, p.y, p.z, rq + Math.min(1, Math.max(0, p.s)) * S_K);
    }
    U.uPolishN.value = n;
    dirty = false;
    version++;
  }

  return {
    uniforms: U,
    /**
     * Gắn vào mọi lưới của bản sao `inst` (vật liệu đã clone riêng cho bản sao). `head` = { center:[x,y,z],
     * radius } — không có đầu rùa thì vẫn gắn (một chương trình cho mọi bia) nhưng không bao giờ bóng.
     */
    attach(inst, head) {
      inst.updateMatrixWorld(true);
      _inv.copy(inst.matrixWorld).invert();
      inst.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const fromMesh = { value: new THREE.Matrix4().multiplyMatrices(_inv, o.matrixWorld) };
        for (const m of mats) {
          if (!m.isMeshStandardMaterial) continue;
          hookMaterial(m, U, fromMesh);
          hooked.push(m);
        }
      });
      this.setHead(head);
      const a = inst.userData.headAlbedo;
      if (a) avg.set(a[0], a[1], a[2]);
    },
    /** Vùng xoa (đầu + cổ) → uniform. Gọi lại được (DEV: vm.cinemaHeadTune). */
    setHead(head) {
      version++;
      if (head?.center) {
        const [cx, cy, cz] = head.center;
        U.uPolishHead.value.set(cx, cy, cz, head.radius);
        const nk = head.neck;
        if (nk?.axis && nk.length > 0) U.uPolishNeck.value.set(cx + nk.axis[0] * nk.length, cy + nk.axis[1] * nk.length, cz + nk.axis[2] * nk.length, Number.isFinite(nk.under) ? nk.under : -9);
        else U.uPolishNeck.value.set(cx, cy, cz, Number.isFinite(nk?.under) ? nk.under : -9); // không có cổ: chỉ cầu đầu
      } else U.uPolishHead.value.set(0, 0, 0, 0);
    },
    /**
     * Màu / độ bóng ở chỗ bóng hết cỡ (settings.rubColor / rubGloss) — chỉ đổi uniform.
     * @param {import('three').Color} colorLinear màu đá bóng (tuyến tính)
     */
    setLook(colorLinear, gloss) {
      const k = (c, a) => Math.min(2, Math.max(0.2, c / Math.max(1e-3, a)));
      U.uRubTint.value.set(k(colorLinear.r, avg.x), k(colorLinear.g, avg.y), k(colorLinear.b, avg.z));
      U.uRubGloss.value.set(glossRoughK(gloss), glossSpecK(gloss));
      version++;
    },
    /**
     * r38: tắt TẠM các nét trợ giúp vẽ trong shader đá — vòng brush, lung linh + vệt loé mở khoá, tô vùng DEV — cho một
     * lượt vẽ phụ (lượt gương lòng bục: không soi các nét đó xuống gương). Không đổi `version` (không xin vẽ lại). Trả hàm
     * khôi phục, hoặc null khi không có nét nào đang hiện.
     */
    hideHelpers() {
      const B = U.uRubBrush.value;
      const F = U.uRubFx.value;
      if (B.w === 0 && F.x === 0 && Math.abs(F.y) >= 1.5 && F.w === 0) return null;
      const bw = B.w;
      const fx = F.x;
      const fy = F.y;
      const fw = F.w;
      B.w = 0;
      F.x = 0;
      F.y = -9;
      F.w = 0;
      return () => {
        B.w = bw;
        F.x = fx;
        F.y = fy;
        F.w = fw;
      };
    },
    /** Hiệu ứng mở khoá: lung linh 0..1, vị trí vệt loé (−1…1; ngoài ±1,5 = tắt), thời gian (s). */
    setFx(shimmer, glintPos, time) {
      const f = U.uRubFx.value;
      if (f.x === shimmer && f.y === glintPos && f.z === time) return;
      f.x = shimmer;
      f.y = glintPos;
      f.z = time;
      version++;
    },
    /** DEV: tô màu vùng xoa (0 = tắt) — soát vùng đầu + cổ không lấn chân / mai. */
    setRegionTint(k) {
      if (U.uRubFx.value.w === k) return;
      U.uRubFx.value.w = k;
      version++;
    },
    /** Vòng brush: tâm (toạ độ mô hình) + bán kính; p = null → ẩn. k = độ sáng. */
    /** Màu vòng brush (THREE.Color tuyến tính / chuỗi CSS). */
    setBrushColor(c) {
      const col = U.uRubBrushCol.value;
      const { r, g, b } = col;
      col.set(c);
      if (col.r !== r || col.g !== g || col.b !== b) version++;
    },
    setBrush(p, radius, k) {
      const B = U.uRubBrush.value;
      if (!p) {
        if (B.w !== 0) {
          B.w = 0;
          version++;
        }
        return;
      }
      // Dung sai: độ sáng vòng tiến TIỆM CẬN đích (rub.js) — lệch < 1e-3 không thấy được, không đáng một lượt vẽ.
      const e = 1e-6;
      if (Math.abs(B.x - p.x) < e && Math.abs(B.y - p.y) < e && Math.abs(B.z - p.z) < e && Math.abs(B.w - radius) < e && Math.abs(U.uRubBrushK.value - k) < 1e-3) return;
      B.set(p.x, p.y, p.z, radius);
      U.uRubBrushK.value = k;
      version++;
    },
    /**
     * Quét hiện (r16): y = cao độ vạch (toạ độ mô hình), on = bật (đổi sang biến thể VM_REVEAL — đã biên dịch sẵn lúc
     * nung, xem setRevealVariant). Phía trên vạch không vẽ, sát dưới có vệt sáng. width / glow tuỳ chọn.
     */
    setReveal(y, on, width, glow) {
      const R = U.uReveal.value;
      const w = width ?? R.z;
      const g = glow ?? R.w;
      const o = on ? 1 : 0;
      if (R.x === y && R.y === o && R.z === w && R.w === g) return;
      if (R.y !== o) this.setRevealVariant(!!on);
      R.set(y, o, w, g);
      version++;
    },
    /**
     * r74 quét bản dập: `look` = { map, stroke, kx, ku, ky, kv: Vector4 (r83: ánh xạ từng khúc), box: Vector4, box2: Vector4 } (null = chỉ vạch sáng / giữ
     * nguyên), `bar` cao độ vạch (toạ độ mô hình), `reveal` độ hiện bản dập 0..1, `glow` độ sáng vạch 0..1, `mode` 0 tắt ·
     * 1 vạch + bản dập · 2 chỉ vạch. Chỉ đổi uniform — không biên dịch lại.
     */
    setScan(mode, bar, reveal, glow, look) {
      const Sv = U.uScan.value;
      let ch = false;
      if (look) {
        if (U.uScanMap.value !== (look.map ?? scanBlank(THREE))) {
          U.uScanMap.value = look.map ?? scanBlank(THREE);
          ch = true;
        }
        const st = look.stroke ?? scanBlank(THREE);
        if (U.uScanStroke.value !== st) {
          U.uScanStroke.value = st;
          ch = true;
        }
        for (const [k, v] of [['uScanKx', look.kx], ['uScanKu', look.ku], ['uScanKy', look.ky], ['uScanKv', look.kv]]) if (v && !U[k].value.equals(v)) (U[k].value.copy(v), (ch = true));
        if (look.box && !U.uScanBox.value.equals(look.box)) (U.uScanBox.value.copy(look.box), (ch = true));
        if (look.box2 && !U.uScanBox2.value.equals(look.box2)) (U.uScanBox2.value.copy(look.box2), (ch = true));
      }
      if (Sv.x !== bar || Sv.y !== reveal || Sv.z !== glow || Sv.w !== mode) {
        Sv.set(bar, reveal, glow, mode);
        ch = true;
      }
      if (ch) version++;
    },
    /** r84: độ sáng / bề rộng vạch quét, dáng đuôi vệt (1 gọn · 0 mềm). */
    setScanTune(glow, width, crisp) {
      const v = U.uScanTune.value;
      if (v.x === glow && v.y === width && v.z === crisp) return;
      v.set(glow, width, crisp, 0);
      version++;
    },
    /** r84: mặt phẳng mặt bia z = z0 + kx·x + ky·y + dải nhô trước nó (front) — lớp duy nhất nhận bản dập / vệt / chữ Hán. */
    setScanPlane(z0, kx, ky, front) {
      const v = U.uScanPlane.value;
      if (v.x === z0 && v.y === kx && v.z === ky && v.w === front) return;
      v.set(z0, kx, ky, front);
      version++;
    },
    /** r84: khối cầu đầu rùa (toạ độ bia) — loại khỏi bản dập / vệt / chữ Hán. r ≤ 0: không có. */
    setScanHead(x, y, z, r) {
      const v = U.uScanHead.value;
      if (v.x === x && v.y === y && v.z === z && v.w === r) return;
      v.set(x, y, z, r);
      version++;
    },
    /**
     * r85: ánh sáng chữ. `o` = { on, amp (đèn xiên vạch 0..1), time, headAmp, after (độ dài ánh lưu), afterK, glow, trail, trailOn,
     * rakeL / rakeN / headL (THREE.Vector3 — không gian camera), headB / headS (THREE.Vector4), col (THREE.Color) } (thiếu = giữ
     * nguyên). Chỉ đổi uniform — không biên dịch lại.
     */
    setGlyph(o) {
      let ch = false;
      const set = (vec, comp, v) => {
        if (v == null || !Number.isFinite(v) || vec[comp] === v) return;
        vec[comp] = v;
        ch = true;
      };
      const cp = (u, v, eps = 1e-5) => {
        if (!v) return;
        const cur = U[u].value;
        if (cur.isColor ? cur.equals(v) : cur.distanceToSquared?.(v) <= eps * eps) return;
        cur.copy(v);
        ch = true;
      };
      const [A, B, C] = [U.uGlyph.value, U.uGlyph2.value, U.uGlyph3.value];
      if (o) {
        set(A, 'x', o.on == null ? null : o.on ? 1 : 0);
        set(A, 'y', o.amp);
        set(A, 'z', o.time);
        set(A, 'w', o.headAmp);
        set(B, 'x', o.after);
        set(B, 'y', o.afterK);
        set(B, 'z', o.glow);
        set(B, 'w', o.debug);
        set(C, 'z', o.trail);
        set(C, 'w', o.trailOn == null ? null : o.trailOn ? 1 : 0);
        cp('uRakeL', o.rakeL);
        cp('uRakeN', o.rakeN);
        cp('uHeadL', o.headL);
        cp('uHeadB', o.headB);
        cp('uHeadS', o.headS);
        cp('uRakeCol', o.col);
      }
      if (ch) version++;
      return ch;
    },
    /** r82b: chữ Hán đang bật trên bản sao này (kiểm thử / sân khấu). */
    get glyphState() {
      const [A, B, C] = [U.uGlyph.value, U.uGlyph2.value, U.uGlyph3.value];
      const H = U.uHeadS.value;
      const HB = U.uHeadB.value;
      return { on: A.x, amp: +A.y.toFixed(4), time: A.z, headAmp: +A.w.toFixed(4), after: B.x, afterK: B.y, glow: B.z, trail: C.z, trailOn: C.w, headX: +H.x.toFixed(4), headW: H.y, headGlow: H.z, headB: [HB.x, HB.y, HB.z, HB.w].map((v) => +v.toFixed(4)) };
    },
    /**
     * r86: hình chữ dò (r87: mode 0 hình chữ dò · 1 chữ Hán số hoá). `o` = { on, mode, awake, time, sparkle, litY, lit, outS, phase, backS, fade, halo, waveTop, waveBot, waveA, waveB,
     * twinkle, twinkleSpeed, glow, landStart, gold (THREE.Color) } (thiếu = giữ nguyên); `tex` = { ids, cov, data, kx, ku, ky, kv }
     * (null = giữ nguyên). Chỉ đổi uniform — không biên dịch lại.
     */
    setTrace(o, tex) {
      let ch = false;
      if (tex) {
        for (const [k, t] of [['uTraceIds', tex.ids], ['uTraceCov', tex.cov], ['uTraceData', tex.data]]) {
          const v = t ?? (k === 'uTraceData' ? traceBlank(THREE) : scanBlank(THREE));
          if (U[k].value !== v) {
            U[k].value = v;
            ch = true;
          }
        }
        for (const [k, v] of [['uTraceKx', tex.kx], ['uTraceKu', tex.ku], ['uTraceKy', tex.ky], ['uTraceKv', tex.kv]]) {
          if (v && !U[k].value.equals(v)) {
            U[k].value.copy(v);
            ch = true;
          }
        }
      }
      const set = (vec, comp, v) => {
        if (v == null || !Number.isFinite(v) || vec[comp] === v) return;
        vec[comp] = v;
        ch = true;
      };
      if (o) {
        const [A, B, C, D, E] = [U.uTrace.value, U.uTrace2.value, U.uTrace3.value, U.uTrace4.value, U.uTrace5.value];
        set(A, 'x', o.on == null ? null : o.on ? 1 : 0);
        set(A, 'y', o.awake);
        set(A, 'z', o.time);
        set(A, 'w', o.sparkle);
        set(B, 'x', o.litY);
        set(B, 'y', o.lit);
        set(B, 'z', o.outS);
        set(B, 'w', o.phase);
        set(C, 'x', o.backS);
        set(C, 'y', o.fade);
        set(C, 'z', o.halo);
        set(C, 'w', o.mode);
        set(D, 'x', o.waveTop);
        set(D, 'y', o.waveBot);
        set(D, 'z', o.waveA);
        set(D, 'w', o.waveB);
        set(E, 'x', o.twinkle);
        set(E, 'y', o.twinkleSpeed);
        set(E, 'z', o.glow);
        set(E, 'w', o.landStart);
        if (o.gold && !U.uTraceGold.value.equals(o.gold)) {
          U.uTraceGold.value.copy(o.gold);
          ch = true;
        }
        if (o.sdf !== undefined) {
          // r89 chữ Hán: [rộng, cao atlas, tầm SDF texel, dày thêm px] — null: atlas độ phủ (chữ dò / dữ liệu cũ)
          const F = U.uTraceSdf.value;
          const [w, h, sp, b] = o.sdf ?? [0, 0, 0, 0];
          if (F.x !== w || F.y !== h || F.z !== sp || F.w !== b) {
            F.set(w, h, sp, b);
            ch = true;
          }
        }
      }
      if (ch) version++;
      return ch;
    },
    /** r86: hình chữ dò đang bật trên bản sao này (kiểm thử / sân khấu). */
    get traceState() {
      const [A, B, C, D, E] = [U.uTrace.value, U.uTrace2.value, U.uTrace3.value, U.uTrace4.value, U.uTrace5.value];
      return { on: A.x, mode: C.w, awake: +A.y.toFixed(4), time: A.z, sparkle: A.w, litY: +B.x.toFixed(4), lit: B.y, outS: +B.z.toFixed(4), phase: B.w, backS: +C.x.toFixed(4), fade: +C.y.toFixed(4), halo: C.z, waveTop: D.x, waveBot: D.y, waveA: D.z, waveB: D.w, twinkle: E.x, twinkleSpeed: E.y, glow: E.z, landStart: E.w, hasIds: U.uTraceIds.value !== scanBlank(THREE), sdf: U.uTraceSdf.value.z > 0 ? U.uTraceSdf.value.toArray() : null };
    },
    /**
     * r78: bóng tấm đọc 3D trên mặt đá. o = { cx, hw, top, bottom, rise, sx, sy, soft, k, zF? } (toạ độ mô hình) | null = tắt.
     * Chỉ đổi uniform.
     */
    setPanelShadow(o) {
      const A = U.uPanelSh.value;
      const B = U.uPanelSh2.value;
      const C = U.uPanelSh3.value;
      if (!o || !(o.k > 0)) {
        if (C.x !== 0) {
          C.x = 0;
          version++;
        }
        return;
      }
      const zF = Number.isFinite(o.zF) ? o.zF : C.y;
      const ao = Number.isFinite(o.ao) ? o.ao : 0;
      const e = 1e-6;
      if (Math.abs(A.x - o.cx) < e && Math.abs(A.y - o.hw) < e && Math.abs(A.z - o.top) < e && Math.abs(A.w - o.bottom) < e && Math.abs(B.x - o.rise) < e && Math.abs(B.y - o.sx) < e && Math.abs(B.z - o.sy) < e && Math.abs(B.w - o.soft) < e && Math.abs(C.x - o.k) < 1e-3 && Math.abs(C.y - zF) < e && Math.abs(C.z - ao) < e) return;
      A.set(o.cx, o.hw, o.top, o.bottom);
      B.set(o.rise, o.sx, o.sy, o.soft);
      C.set(o.k, zF, ao, 0);
      version++;
    },
    /** Bật / tắt biến thể VM_REVEAL trên mọi vật liệu đã gắn (nung sẵn: bật → compile → tắt → compile). */
    setRevealVariant(on) {
      for (const m of hooked) {
        const has = 'VM_REVEAL' in (m.defines ?? {});
        if (has === on) continue;
        m.defines = { ...(m.defines ?? {}) };
        if (on) m.defines.VM_REVEAL = '';
        else delete m.defines.VM_REVEAL;
        m.needsUpdate = true;
      }
    },
    /** Đếm số lần uniform đổi (xem `version` ở trên). */
    get version() {
      return version;
    },
    /** Nạp vết đã lưu ([x, y, z, r, s]…). */
    load(list) {
      splats = (list || []).slice(0, POLISH_MAX).map(([x, y, z, r, s]) => ({ x, y, z, r, s }));
      upload();
    },
    /** Danh sách gọn để lưu. */
    serialize() {
      const q = (v) => Math.round(v * 1e4) / 1e4;
      return splats.map((p) => [q(p.x), q(p.y), q(p.z), q(p.r), Math.round(p.s * 1000) / 1000]);
    },
    clear() {
      splats = [];
      upload();
    },
    /**
     * Xoa tại điểm (toạ độ mô hình): cộng `amount` vào vết gần nhất nếu cách < MERGE_K × bán kính, không thì
     * mở vết mới (hết chỗ → thay vết yếu nhất). Trả về { index, before, after } (để UI loé sáng khi qua mốc).
     */
    deposit(x, y, z, r, amount) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < splats.length; i++) {
        const p = splats[i];
        const d = Math.hypot(p.x - x, p.y - y, p.z - z);
        if (d < MERGE_K * p.r && d < bestD) {
          best = i;
          bestD = d;
        }
      }
      let before = 0;
      if (best < 0) {
        const s = { x, y, z, r, s: 0 };
        if (splats.length < POLISH_MAX) {
          splats.push(s);
          best = splats.length - 1;
        } else {
          let weak = 0;
          for (let i = 1; i < splats.length; i++) if (splats[i].s < splats[weak].s) weak = i;
          splats[weak] = s;
          best = weak;
        }
      } else before = splats[best].s;
      const p = splats[best];
      p.s = Math.min(1, p.s + amount);
      dirty = true;
      return { index: best, before, after: p.s };
    },
    /** Đẩy uniform lên (gọi mỗi khung khi có thay đổi — rẻ: ≤ 64 vec4). */
    flush() {
      if (dirty) upload();
    },
    get count() {
      return splats.length;
    },
    /** Tổng độ mạnh (0..64) + mạnh nhất — cho DEV / kiểm thử. */
    stats() {
      let sum = 0;
      let max = 0;
      for (const p of splats) {
        sum += p.s;
        if (p.s > max) max = p.s;
      }
      return { count: splats.length, sum: +sum.toFixed(3), max: +max.toFixed(3) };
    },
    /** Độ bóng ước tính tại điểm (toạ độ mô hình) — cùng công thức với shader, không có mặt nạ vùng đầu. */
    at(x, y, z) {
      let s = 0;
      for (const p of splats) {
        const t = ((p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2) / (p.r * p.r);
        if (t < 6) s += p.s * Math.exp(-2 * t);
      }
      const k = Math.min(1, Math.max(0, s / RUB_POLISH_SAT));
      return k * k * (3 - 2 * k);
    },
  };
}
