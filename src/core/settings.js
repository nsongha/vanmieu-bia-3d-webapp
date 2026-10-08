// Cài đặt người dùng dùng chung cho cả 3 view: lưu localStorage, phát sự kiện khi đổi.
// Mọi giá trị số là HỆ SỐ nhân lên preset của view (1 = mặc định preset), để một bộ cài đặt dùng được cho cả 3 phong cách.

const KEY = 'vm.settings.v1';
/** Phiên bản lược đồ đã lưu (tăng khi một MẶC ĐỊNH đổi và bản lưu cũ cần chuyển — xem load()). */
const REV = 4; // r84: mặc định readerSlideShare 0,58 → 0,36 (r85: đám mây hạt sáng tự lùi tấm đọc — readerTiming) · r90: glyphLitDelay 0,035 → 0

// Giá trị mặc định = bộ cài đặt người dùng đã tinh chỉnh và chọn làm mặc định (24/09/2026).
/** r78: khoảng cách tấm đọc 3D ↔ mặt bia (đơn vị bia). Trên 0,04: tấm không chạm mặt đá / lòng chữ; dưới 0,26: không chạm đầu
 * rùa (đầu rùa chìa ra trước ~0,29 — tấm luôn ở giữa mặt đá và đầu rùa). */
export const READER_GAP_RANGE = Object.freeze({ min: 0.04, max: 0.26, step: 0.01 });
/** r80: thời gian camera tiến vào / lùi ra khung đọc toàn văn (giây) — Cài đặt › Thông tin. */
export const READER_ZOOM_RANGE = Object.freeze({ min: 0.6, max: 5, step: 0.1 });
/** r82: phần CUỐI đoạn camera tiến vào mà tấm đọc trượt lên trong đó (tới nơi đúng lúc camera dừng) — Cài đặt › Thông tin. */
export const READER_SLIDE_RANGE = Object.freeze({ min: 0.3, max: 1, step: 0.05 });
/** r82b: hiệu ứng chữ Hán — độ dài vệt quét bản dập (phần chiều cao mặt bia), độ lấp lánh, mật độ chữ bay. */
export const GLYPH_TRAIL_RANGE = Object.freeze({ min: 0.05, max: 0.6, step: 0.01 });
export const GLYPH_SPARKLE_RANGE = Object.freeze({ min: 0, max: 1, step: 0.05 });
export const GLYPH_DENSITY_RANGE = Object.freeze({ min: 0.1, max: 1, step: 0.05 });
/** r84: đường cong chuyển động (camera tiến / lùi, tấm đọc trượt) — 'sine' êm · 'cubic' (mặc định) · 'quint' gắt. */
export const EASE_OPTIONS = Object.freeze([
  { id: 'sine', label: 'Êm (sine)' },
  { id: 'cubic', label: 'Vừa (cubic)' },
  { id: 'quint', label: 'Gắt (quint)' },
]);
/** r84: dáng đuôi vệt bản dập — 'soft' nhạt dần suốt vệt · 'crisp' đậm tới gần đuôi rồi tắt nhanh. */
/**
 * r86: kiểu chữ sáng trên đá — 'stroke' Nét khắc (r85, mặc định: đèn xiên trên phù điêu thật + hạt sáng từ bản đồ nét) · 'traced'
 * Hình chữ dò (r82b / r84: thân bia sáng theo mặt nạ chữ dò sau vệt, chữ bay là sprite hình chữ — tạm thời tới khi có chữ Hán thật).
 * Dải tiêu đề luôn là đèn quét (không mặt nạ) ở cả hai kiểu; bia chưa có dữ liệu chữ dò → Nét khắc.
 */
export const GLYPH_LOOK_OPTIONS = Object.freeze([
  { id: 'stroke', label: 'Nét khắc' },
  { id: 'traced', label: 'Hình chữ dò' },
  // r87: chữ Hán dạng chữ đánh máy (văn bản đã chép + hiệu đính, căn từng chữ) — chỉ chữ đủ tin cậy; bia chưa có văn bản → Nét khắc
  { id: 'hantext', label: 'Chữ Hán (số hoá)' },
]);
/** r85: kiểu bay ra của hạt sáng — 'cloud' đám mây camera bay xuyên qua (mặc định) · 'whoosh' vụt qua camera (r84). */
export const FLY_MODE_OPTIONS = Object.freeze([
  { id: 'cloud', label: 'Đám mây' },
  { id: 'whoosh', label: 'Vụt qua' },
]);
/**
 * r85 → r89 — đám mây (kiểu 'cloud'): cửa sổ [pA, pB] (tiến độ thời gian đoạn tiến vào) kết thúc CLOUD_TAIL trước pEnd. Không vừa →
 * tấm đọc (chữ) tự lùi muộn hơn (readerTiming).
 */
// r88: đám mây chữ là một lớp NGAY TRƯỚC mặt bia (chữ nâng thẳng theo pháp tuyến mặt bia); chữ nâng lên trong CLOUD_LIFT_S (ease-out)
// sau lúc tách. r89: "Thời gian đám mây tồn tại" (glyphCloudLife) = từ lúc chữ rời mặt bia tới lúc tắt hẳn; pha đám mây [pA, pB] dài
// đúng ngần đó, bắt đầu từ CLOUD_START (chữ đầu tiên vừa nâng xong) — không vừa đoạn tiến vào thì tấm đọc tự lùi (trong giới hạn
// readerSlideShare.min); vẫn không vừa → kẹp + gợi ý trong bảng (clamped.cloud, lifeMax)
export const CLOUD_START = 0.16;
export const CLOUD_LIFT_S = Object.freeze([0.6, 0.9]);
export const CLOUD_TAIL = 0.02;
export const CLOUD_FLOAT_MIN = 0.12;
/** r85: kiểu hiện tiêu đề tấm đọc — 'settle' lắng từ trái · 'bloom' phóng sáng (mặc định) · 'fade' mờ dần (như giảm chuyển động). */
export const TITLE_FX_OPTIONS = Object.freeze([
  { id: 'settle', label: 'Lắng từ trái' },
  { id: 'bloom', label: 'Phóng sáng' },
  { id: 'fade', label: 'Mờ dần' },
]);
export const TRAIL_FADE_OPTIONS = Object.freeze([
  { id: 'soft', label: 'Mềm' },
  { id: 'crisp', label: 'Gọn' },
]);
/** r84: giữ V bắn ở 2,0 s (lớp cử chỉ — TUNING.vholdMs); nút đọc bắn ở cùng mốc này của lượt quét. */
export const READER_FIRE_S = 2.0;
/** r84: hiệu ứng chữ Hán — sprite hết trước lúc chữ tấm đọc hiện ngần này (tiến độ camera); thời gian bay ngắn nhất (phần đoạn tiến). */
export const GLYPH_TEXT_MARGIN = 0.035;
export const GLYPH_FLY_MIN_P = 0.05;
/**
 * r90: tiêu đề tấm đọc bắt đầu hiện khi tấm đã trượt ngần này (phần quãng trượt) — thường: gần tới nơi (0,55); có đám mây: ngay khi
 * nền tấm đã hiện đủ (= SLAB_FADE của reader.js) để tiêu đề chồng lên lúc đám mây còn tan (readerCloudOverlap).
 */
export const TITLE_U = 0.55;
export const TITLE_U_CLOUD = 0.35;
/** r90: có đám mây, tấm trượt dài nhất ngần này phần đoạn tiến vào (đám mây ngắn: tấm không bắt đầu ngay lúc bắn). */
export const CLOUD_SLIDE_MAX = 0.8;
/** r90: hiệu ứng tiêu đề kéo dài tối thiểu (s) trước khi thân bài trượt lên (reader.js: D + 0,08 — 'fade' D = 0,55). */
export const titleFxSpan = (s) => (topt(s, 'titleFxMode') === 'fade' ? 0.55 : tnum(s, 'titleFxTime')) + 0.08;
/**
 * r84 (người dùng: "cho tôi cả các setting cho transition zoom vào toàn văn bia") — nhóm "Chuyển cảnh toàn văn": mọi tham số chỉnh
 * được của lượt mở / đóng toàn văn (khoảng + bước; options = lựa chọn; bool = công tắc). Mặc định ở DEFAULTS. Thứ tự = thứ tự trong
 * bảng cài đặt. "Khôi phục mặc định" của nhóm đặt lại đúng các khoá này.
 */
export const TRANSITION_SPEC = Object.freeze({
  // Camera
  readerZoomIn: { min: 0.6, max: 5, step: 0.1 },
  readerZoomOut: { min: 0.6, max: 5, step: 0.1 },
  readerEaseIn: { options: EASE_OPTIONS.map((o) => o.id) },
  readerEaseOut: { options: EASE_OPTIONS.map((o) => o.id) },
  readerCreep: { min: 0, max: 0.2, step: 0.01 },
  readerDistance: { min: 0.7, max: 1.05, step: 0.01 },
  readerParallax: { min: 0, max: 1, step: 0.05 },
  // Vệt quét
  cinemaRubbingScan: { bool: true },
  scanDuration: { min: 1.5, max: 6, step: 0.1 },
  glyphTrail: { min: 0.05, max: 0.6, step: 0.01 },
  scanTrailFade: { options: TRAIL_FADE_OPTIONS.map((o) => o.id) },
  scanBarGlow: { min: 0, max: 2, step: 0.05 },
  scanBarWidth: { min: 0.3, max: 3, step: 0.05 },
  // Chữ Hán
  glyphFx: { bool: true },
  rakeAzimuth: { min: -90, max: 90, step: 5 },
  rakeElevation: { min: 4, max: 40, step: 1 },
  rakeGlow: { min: 0, max: 4, step: 0.05 },
  rakeAfterglow: { min: 0, max: 1, step: 0.05 },
  headSweepTime: { min: 0.6, max: 5, step: 0.1 },
  headSweepGlow: { min: 0, max: 4, step: 0.05 },
  headSweepBounce: { bool: true },
  sparkleDensity: { min: 0.1, max: 1, step: 0.05 },
  moteMin: { min: 0.001, max: 0.012, step: 0.0005 },
  moteMax: { min: 0.002, max: 0.02, step: 0.0005 },
  glyphFlyMode: { options: FLY_MODE_OPTIONS.map((o) => o.id) },
  glyphLook: { options: GLYPH_LOOK_OPTIONS.map((o) => o.id) },
  traceGlow: { min: 0.2, max: 2.5, step: 0.05 },
  traceWarmth: { min: 0, max: 1, step: 0.05 },
  traceHalo: { min: 0, max: 2, step: 0.05 },
  hanMinConf: { min: 0.3, max: 1, step: 0.05 },
  hanGlow: { min: 0.2, max: 2.5, step: 0.05 },
  hanWarmth: { min: 0, max: 1, step: 0.05 },
  glyphCloudDist: { min: 0.3, max: 3, step: 0.05 },
  glyphCloudLife: { min: 0.8, max: 3.5, step: 0.1 },
  readerCloudOverlap: { min: 0, max: 1, step: 0.05 },
  glyphLitDelay: { min: 0, max: 0.15, step: 0.005 },
  glyphLife: { min: 0, max: 1.5, step: 0.05 },
  glyphTwinkle: { min: 0, max: 2, step: 0.05 },
  glyphTwinkleSpeed: { min: 0.3, max: 3, step: 0.05 },
  glyphSparkle: { min: 0, max: 1, step: 0.05 },
  glyphGlow: { min: 0.3, max: 2, step: 0.05 },
  glyphWarmth: { min: 0, max: 1, step: 0.05 },
  glyphDensity: { min: 0.1, max: 1, step: 0.05 },
  glyphWaveStart: { min: 0, max: 0.6, step: 0.01 },
  glyphWaveEnd: { min: 0.05, max: 1, step: 0.01 },
  glyphWaveJitter: { min: 0, max: 0.2, step: 0.01 },
  glyphFlySpeed: { min: 0.4, max: 2.5, step: 0.05 },
  glyphFlyDist: { min: 0.3, max: 2, step: 0.05 },
  glyphFlyDepth: { min: 0, max: 2, step: 0.05 },
  glyphStreak: { min: 0, max: 2, step: 0.05 },
  glyphCamStreak: { min: 0, max: 2, step: 0.05 },
  glyphSpriteMax: { min: 0.02, max: 0.15, step: 0.005 },
  glyphLandStart: { min: 0.3, max: 0.97, step: 0.01 },
  glyphLandEnd: { min: 0.32, max: 0.99, step: 0.01 },
  // Tấm đọc
  readerSlideShare: { min: 0.15, max: 1, step: 0.01 },
  readerSlideDist: { min: 0, max: 0.9, step: 0.05 },
  readerSlideEase: { options: EASE_OPTIONS.map((o) => o.id) },
  readerTextLag1: { min: 0, max: 0.5, step: 0.01 },
  readerTextLag2: { min: 0, max: 0.6, step: 0.01 },
  readerTextRise: { min: 0, max: 80, step: 1 },
  readerUiInAt: { min: 0.5, max: 1, step: 0.01 },
  titleFxMode: { options: TITLE_FX_OPTIONS.map((o) => o.id) },
  titleFxTime: { min: 0.6, max: 3, step: 0.1 },
  titleFxSparkle: { min: 0, max: 2, step: 0.05 },
  titleFxGlow: { min: 0, max: 2, step: 0.05 },
  titleFxScale: { min: 0, max: 0.8, step: 0.05 },
  // Đóng
  readerHoldK: { min: 0.3, max: 1, step: 0.05 },
  readerOutText: { min: 0.05, max: 0.9, step: 0.05 },
  readerOutUi: { min: 0.05, max: 0.9, step: 0.05 },
});
export const TRANSITION_KEYS = Object.freeze(Object.keys(TRANSITION_SPEC));
export const DEFAULTS = Object.freeze({
  rev: REV,             // phiên bản lược đồ (không phải cài đặt người dùng)
  exposure: 1.18,          // 0.6..1.6  × renderer.toneMappingExposure của preset
  key: 1,               // 0..2      × cường độ đèn chính
  env: 0.9,               // 0..2      × môi trường (hemi + PMREM)
  shadow: 'soft',       // 'off' | 'soft' | 'sharp' — Trưng bày / Nghiên cứu (Điện ảnh: cinemaCastShadow + contactShadow)
  shadowOpacity: 0.55,     // 0..1.5    × floorShadow của preset — Trưng bày / Nghiên cứu
  reflection: 0.3,     // 0..1      cường độ sàn phản chiếu mờ (0 = tắt); Điện ảnh: gương lòng bục
  dishGlass: 0.8,         // 0..1      Điện ảnh: chất liệu lòng bục — 0 = đá (graphite mờ, như cũ) … 1 = kính đen (Fresnel)
  pedestalRipple: 0.15,     // r63: 0..1 Điện ảnh: "Độ nhăn" mặt lòng bục (ảnh phản chiếu gợn + chấm đèn vỡ nhẹ); 0 = phẳng tuyệt đối như cũ
  pedestalRippleSize: 1, // r63: 0..1 "Kích thước gợn": mịn → rộng (cạnh ô vân, xem RIPPLE_SIZE_RANGE_M)
  pedestalRippleDrift: true, // r63: "Chuyển động nhẹ" — vân trôi rất chậm, chỉ ở khung đang vẽ (không tự vẽ khi rảnh)
  showFps: false,       // đồng hồ FPS góc trên trái để gỡ lỗi độ mượt (bật trong Cài đặt → Hiển thị → Gỡ lỗi)
  maxFps: 60,           // r40: trần khung hình của cảnh 3D (core/renderer.js): 30 | 60 | 120 — xem MAX_FPS_OPTIONS
  autoRotate: true,     // tự xoay / đung đưa khi rảnh
  transition: 'glide',   // chuyển cảnh giữa hai bia: chỉ còn 'glide' (B) — khoá giữ lại cho lớp cử chỉ (bảng thời lượng hiệu ứng)
  glideDuration: 1,    // r35: 0,8..2,4 s — Điện ảnh: thời gian một lượt "Lướt" (các kiểu khác giữ thời lượng riêng); xem GLIDE_RANGE
  cinemaViewAngle: 20,   // −45..45 độ — Điện ảnh: góc camera mặc định quanh bia (dương = sang PHẢI người xem, thấy mặt hông phải → khung 3/4 có chiều sâu); 0 = chính diện
  cinemaHoverFront: true, // Điện ảnh: hover bia → camera vòng về chính diện (đèn sáng lên), rời → về lại góc mặc định
  cinemaHoverZoom: 0.04,  // 0..0.25 Điện ảnh: hover → camera tiến gần thêm ngần này (phần khoảng cách); 0 = không zoom. Tự kẹp cho vừa khung + kiểu thông tin
  cinemaBgDark: 0.5,     // 0..1  Điện ảnh: độ tối nền (nền, sương, hồ sáng sàn — không đụng đèn bia / bục); 0,5 = như trước, 1 = đen tuyệt đối
  cinemaContrast: 0.7,   // 0..1  Điện ảnh: ánh sáng kịch tính khi CHƯA hover (sáng góc trên trái, tối dần xuống); hover → sáng đều. 0 = luôn sáng đều
  // Đèn rọi của trạng thái chưa hover (Điện ảnh). Đứng yên trong không gian: bia lướt vào / ra vùng sáng.
  spotIntensity: 1,      // 0..2  × cường độ đèn rọi (0 = tắt đèn rọi)
  spotColor: '#ffd9b0',  // màu đèn rọi — mặc định ấm như đèn sợi đốt (cùng màu đèn chính của preset)
  spotAngle: 6,         // 6..35 độ — NỬA góc mở của chùm (từ trục ra mép), như SpotLight.angle của three
  spotSoftness: 0.7,       // 0..1  độ mềm mép chùm (SpotLight.penumbra): 0 = mép sắc, 1 = tan dần từ tâm ra mép
  spotAzimuth: -81,      // −90..90 độ — hướng chiếu nhìn từ trên: âm = từ bên TRÁI người xem, 0 = chính diện, dương = từ phải
  spotElevation: 64,     // 30..88 độ — độ cao của đèn so với mặt sàn (88 ≈ rọi thẳng từ trên xuống). Rev 2: −38/58 → −18/80,
                         // rọi sượt từ trên xuống mặt bia → chữ khắc / nét chạm có mép sáng–tối rõ hơn (xem stage.js IDLE.spot)
  // Đèn chính của Điện ảnh (cường độ vẫn là `key` dùng chung): đèn điểm có suy giảm theo khoảng cách.
  keyAzimuth: -48,       // −90..90 độ — hướng nhìn từ trên (âm = từ bên trái người xem), như preset cũ
  keyElevation: 62,      // 10..85 độ — độ cao của đèn
  keyFalloff: 1,       // 0..1 độ suy giảm: 0 = đèn ở rất xa (sáng đều như trước), 1 = sát bia (sáng mạnh ở trên, tối dần xuống rùa)
  keyColor: '#ffd9b0',   // màu đèn chính (mặc định = màu key của preset Điện ảnh)
  // Bóng của Điện ảnh — tách khỏi shadow / shadowOpacity (hai khoá đó chỉ còn cho Trưng bày / Nghiên cứu).
  cinemaCastShadow: 0.55,   // 0..1.5 bóng đổ của đèn rọi (xuống sàn, lên bục, lên chính bia); 0 = tắt hẳn, không vẽ shadow map
  contactShadow: 0.55,      // 0..1.5 bóng tiếp xúc: quầng tối dưới chân rùa trên mặt bục (0 = tắt)
  cinemaInfo: 'screens', // cách hiện thông tin bia ở chế độ Điện ảnh: xem CINEMA_INFO_OPTIONS
  cinemaInfoRich: true, // r71 → r72: thông tin mở rộng (bia có dữ liệu văn bia — r79: cả 82 bia) khi kiểu là Bình phong; false = bình phong gốc
  cinemaRubbingScan: true, // r77: quét bản dập trên mặt bia khi mở toàn văn (giữ V / nút đọc); tắt = vòng tiến độ trên huy hiệu V, đọc trên đá trơn
  readerArch: 0.55, // r77: độ cong vòm đỉnh bảng đọc toàn văn 0 (phẳng) … 1 (vòm cao); 0,55 ≈ tỉ lệ vòm của chính tấm bia ở khung đọc
  readerMode: '3d',  // r78: kiểu bảng đọc — '3d' (tấm nổi trước bia, thị sai thật, bóng lên đá) | 'flat' (tấm phẳng trên màn như r77)
  readerGap: 0.15,   // r78: khoảng cách tấm đọc 3D ↔ mặt bia (đơn vị bia — bia cao 1), READER_GAP_RANGE
  readerZoomIn: 2.8,  // r80: giây camera tiến vào khung đọc (mở toàn văn) — người dùng: gấp đôi 1,4 s của r74; READER_ZOOM_RANGE
  readerZoomOut: 1, // r80: giây camera lùi ra (đóng) — giữ đúng 1,0 s như trước; READER_ZOOM_RANGE
  // r82 → r84: tấm đọc trượt lên trong phần cuối đoạn tiến vào — r84 (người dùng: chữ Hán bay CÙNG lúc camera tiến) 58 → 36 %: chữ
  // tấm đọc hiện ở ~0,68 đoạn tiến (sau chữ bay cuối cùng); READER_SLIDE_RANGE
  readerSlideShare: 0.36,
  glyphFx: true,        // r82b: hiệu ứng chữ Hán (bia có dữ liệu chữ dò): chữ thức / sáng khi giữ V, bay ra khi mở, bay về khi đóng
  glyphTrail: 0.22,     // r82b → r83: độ dài vệt quét bản dập (phần chiều cao mặt bia, MỌI bia có bản dập) — chỉ trong vệt mới thấy bản dập; GLYPH_TRAIL_RANGE
  glyphSparkle: 0.6,    // r82b: độ lấp lánh của chữ đã sáng 0..1; GLYPH_SPARKLE_RANGE
  glyphDensity: 0.6,    // r82b: phần chữ bay ra / bay về (còn lại tắt tại chỗ); GLYPH_DENSITY_RANGE
  // r84 — nhóm "Chuyển cảnh toàn văn" (TRANSITION_SPEC: khoảng + bước). Mặc định = nhịp r82–r83, trừ phần người dùng xin đổi
  // (vệt quét chậm hơn, tách khỏi giữ V; camera nhích vào lúc giữ; chữ Hán bay cùng lúc camera tiến).
  readerEaseIn: 'cubic',   // đường cong camera tiến vào (sine | cubic | quint — vào–ra)
  readerEaseOut: 'cubic',  // … lùi ra
  readerCreep: 0.08,       // camera nhích vào khung đọc lúc đang giữ (phần quãng tiến vào, trong 2 s giữ, tăng tốc từ 0); 0 = tắt
  readerDistance: 0.87,    // khoảng cách camera khi đọc (× khoảng cách vừa khít mặt bia + lề — r77: 0,87); nhỏ = gần
  readerParallax: 1,       // biên độ camera lên / xuống theo vị trí cuộn (1 = đỉnh vòm → sát mai rùa); 0 = đứng yên ở đầu
  scanDuration: 3.2,       // s — vạch quét đi hết mặt bia (độc lập với 2 s giữ V: bắn ở 2 s, vạch đi tiếp lúc camera tiến)
  scanTrailFade: 'soft',   // dáng đuôi vệt bản dập
  scanBarGlow: 1,          // × độ sáng vạch quét
  scanBarWidth: 1,         // × bề rộng dải sáng sau vạch
  // r85 (người dùng chọn "không bao giờ hiện hình chữ dò"): ánh sáng chữ = đèn xiên trên phù điêu thật + hạt sáng lấy mẫu từ bản đồ
  // nét bản dập (mọi bia có bản dập; bia không có: hạt rải đều trên ô chữ)
  rakeAzimuth: -30,        // độ — hướng đèn xiên của vạch quét nhìn chính diện: 0 = từ trên xuống, âm = từ trên bên trái
  rakeElevation: 12,       // độ — đèn xiên hợp với mặt bia ngần này (nhỏ = sượt hơn, nét khắc rõ hơn)
  rakeGlow: 1,             // × độ sáng đèn xiên trên nét khắc
  rakeAfterglow: 0.5,      // ánh lưu của đèn xiên trong vệt (phần độ dài vệt); 0 = chỉ dải ở vạch
  headSweepTime: 1.8,      // s — đèn xiên đi hết dải tiêu đề một lượt
  headSweepGlow: 1,        // × độ sáng đèn quét dải tiêu đề (0 = tắt)
  headSweepBounce: true,   // quét qua lại (trái → phải → trái); tắt: chỉ trái → phải, lặp lại
  sparkleDensity: 0.5,     // mật độ hạt sáng trên nét khắc (× 3000 điểm mỗi bia)
  moteMin: 0.0025,         // cỡ hạt sáng nhỏ nhất (đơn vị bia — bia cao ≈ 1)
  moteMax: 0.006,          // … lớn nhất
  glyphLook: 'traced',     // r86: 'stroke' Nét khắc (r85) · 'traced' Hình chữ dò (r84 — mặt nạ chữ dò + sprite hình chữ) — GLYPH_LOOK_OPTIONS
  traceGlow: 1,            // r86 Hình chữ dò: × độ sáng chữ trên đá (lõi nét) + chữ bay
  traceWarmth: 0.5,        // … màu: 0 vàng nhạt · 0,5 vàng ấm (r82b) · 1 hổ phách
  traceHalo: 1,            // … × quầng sáng mềm quanh nét
  hanMinConf: 0.7,         // r87 Chữ Hán (số hoá): chỉ đặt chữ có độ tin cậy căn chỉnh ≥ ngưỡng (chỗ khác: Nét khắc)
  hanGlow: 1,              // … × độ sáng chữ trên đá + chữ bay
  hanWarmth: 0.4,          // … màu: 0 vàng nhạt · 0,5 vàng ấm · 1 hổ phách
  glyphFlyMode: 'cloud',   // r85: 'cloud' đám mây camera bay xuyên qua · 'whoosh' vụt qua (r84)
  glyphCloudDist: 1,     // r88: đám mây chữ nổi trước mặt bia tới ngần này × khoảng cách đầu rùa – mặt bia (mỗi bia một khác)
  glyphCloudLife: 1.8,     // r89: s — chữ rời mặt bia → tắt hẳn (đám mây tồn tại); dài hơn → chữ tấm đọc tự hiện muộn hơn
  readerCloudOverlap: 0.55, // r90: s — tiêu đề tấm đọc bắt đầu ngần này trước hạn tắt của đám mây (pEnd; ẩn) — đo: ~0,4 s trước khi chữ
                           // cuối thật sự tắt, lúc đó ~57 % đám mây đã tan (thưa dần CLOUD_THIN_S); thân bài luôn sau đám mây
  glyphLitDelay: 0,        // r90: chữ sáng khi MÉP DẪN của vạch qua tâm chữ + ngần này (đơn vị bia; ẩn — trước: 0,035 sau cả đuôi vệt)
  glyphLife: 0.3,          // s — chữ sáng lấp lánh ngần này rồi tách khỏi đá bay đi
  glyphTwinkle: 1,         // × độ le lói khi chữ "thức"
  glyphTwinkleSpeed: 1,    // × nhịp le lói
  glyphGlow: 1,            // × độ sáng chữ đã sáng (lõi + quầng)
  glyphWarmth: 0.5,        // màu chữ sáng: 0 vàng nhạt … 0,5 vàng ấm (r82b) … 1 hổ phách
  glyphWaveStart: 0,       // tách chữ sớm nhất (phần đoạn camera tiến) — 0 = đúng lúc bắn
  glyphWaveEnd: 0.55,      // tách chữ muộn nhất — tự kẹp để chữ bay hết trước khi chữ tấm đọc hiện
  glyphWaveJitter: 0.07,   // lệch ngẫu nhiên của sóng tách (phần sóng)
  glyphFlySpeed: 1,        // × tốc độ bay (thời gian bay 0,55–0,8 s ở 1)
  glyphFlyDist: 1,         // × độ toả / quãng bay qua camera
  glyphFlyDepth: 1,        // × độ sâu ngẫu nhiên của đích sau camera
  glyphStreak: 1,          // × độ dài vệt kéo theo vận tốc trên màn
  glyphCamStreak: 1,       // × phần vệt + tốc độ bay theo vận tốc camera tiến (bay XUYÊN qua chữ)
  glyphSpriteMax: 0.075,   // cỡ sprite tối đa = ngần này × chiều cao khung
  glyphLandStart: 0.84,    // bay về: chữ chạm đá từ … (phần đoạn camera lùi)
  glyphLandEnd: 0.99,      // … tới (luôn trước khi camera lùi xong)
  readerSlideDist: 0.45,   // quãng tấm đọc trượt = ngần này × chiều cao khung
  readerSlideEase: 'cubic', // đường cong tấm trượt (mở: ease-out · đóng: vào–ra)
  readerTextLag1: 0.1,     // chữ theo tấm trễ ngần này quãng trượt — thẻ tiêu đề + dải tên trang
  readerTextLag2: 0.2,     // … thân bài / Đề danh
  readerTextRise: 30,      // px chữ nhô thêm
  readerUiInAt: 0.86,      // mục lục / Đóng hiện dần từ ngần này đoạn tiến
  // r85 (người dùng: tiêu đề tấm đọc hiện "chưa ấn tượng"): hiệu ứng TỪNG CHỮ của dòng tiêu đề — mỗi chữ hiện ở cỡ ngẫu nhiên + loé
  // vàng, rồi sóng "đặt chữ" trái → phải từng dòng; xong mới tới dòng phụ / người soạn, rồi thân bài trượt lên
  titleFxMode: 'bloom',    // 'bloom' phóng sáng (mặc định — gọn hơn trên ảnh) · 'settle' lắng từ trái · 'fade' mờ dần — TITLE_FX_OPTIONS
  titleFxTime: 1.5,        // s — cả hiệu ứng tiêu đề (lắng từ trái / phóng sáng)
  titleFxSparkle: 1,       // × độ loé (lắng từ trái)
  titleFxGlow: 1,          // × quầng sáng (phóng sáng)
  titleFxScale: 0.6,       // cỡ chữ ngẫu nhiên lúc hiện: 1 ± ngần này (0,6 → 0,4 … 1,6)
  readerHoldK: 0.75,       // đóng: tấm sơn mài + HUD trở lại ở ngần này × thời gian lùi
  readerOutText: 0.3,      // đóng: chữ tắt hết trong ngần này đầu đoạn lùi
  readerOutUi: 0.25,       // đóng: mục lục / Đóng / Đầu trang tắt hết trong ngần này đầu đoạn lùi
  cinemaNames: true,    // hiện danh sách người đỗ trên thân bia (Điện ảnh) — thử nghiệm
  cinemaArrows: 'gold', // kiểu mũi tên chuyển bia hai bên (Điện ảnh): xem NAV_ARROW_OPTIONS
  cinemaTimeline: 'line', // kiểu dòng thời gian 82 bia (Điện ảnh): xem TIMELINE_OPTIONS
  cinemaIdleAutoplay: true, // Điện ảnh (kiosk): rảnh cinemaIdleAfter giây → tự trình chiếu (▶ + Lướt); chuột / chạm / phím / tay
                            // đã "nhận" → dừng ngay (lượt lướt đang chạy vẫn chạy nốt)
  cinemaIdleAfter: 30,      // 15 | 30 | 60 | 120 giây rảnh trước khi tự trình chiếu
  cinemaAutoDwell: 10,      // r62: giây dừng ở mỗi bia khi tự trình chiếu (rảnh) VÀ ▶ tay (Space / "Trình chiếu ngay") — xem AUTO_DWELL_OPTIONS
  cinemaRub: true,      // "Xoa đầu rùa" (Điện ảnh, trứng phục sinh): r70 — chỉ XOA THẬT trên đầu rùa (tay xoè / nhấn giữ chuột, 3 nhịp qua lại) mới mở; chỗ xoa bóng dần lên
  rubColor: '#656c73',  // màu đá ở chỗ bóng tối đa — xanh xám: độ sáng = albedo trung bình đầu rùa 10 bia (đo trên texture quét,
                        // tuyến tính 0,204 / 0,199 / 0,189) tối đi 25 %, sắc ngả lạnh của đá xanh (bản quét gần như xám trung tính)
  rubGloss: 0.75,       // 0..1 độ bóng tối đa: roughness ×(1 − 0,88·g) + F0 ×(1 + 4·g) ở chỗ bóng hết cỡ (0,75 = r8)
  rubStrength: 0.012,   // độ bóng thêm cho mỗi vết dọc đường, mỗi lần tay đi qua → 25 lượt qua–lại để bóng tối đa (rubLapsToMax)
  rubRadius: 0.4,       // "Cỡ brush": bán kính vết xoa, theo bán kính đầu rùa
  cinemaNamesStyle: 'auto', // màu chữ tên: 'auto' (theo độ sáng mặt đá đang vẽ, chuyển cùng đèn hover) | 'light' | 'ink'
  cinemaPedestal: true,  // bục tròn dưới mỗi bia (Điện ảnh), mặt vát khắc nổi "Khoa thi năm …"
  pedestalSize: 1.3,       // 0.95..1.4 × bán kính chuẩn (rùa to nhất cả bộ + đệm, mọi bục cùng cỡ); chiều cao bục KHÔNG đổi
  pedestalText: 0.55,     // 0.4..1  cỡ toàn cụm chữ khắc trên mặt vát (1 = số năm cao gần kín mặt vát; mặt sau vẫn = 70% mặt trước)
  pedestalRelief: 1.15,   // 0.2..1.5 × độ nổi chữ khắc (1 = độ nổi ban đầu, người dùng thấy hơi cao → nét nhỏ khó đọc)
  pedestalSharp: 0.2,   // 0..1  độ sắc mép chữ khắc: 0 = vai rộng mềm (gờ 6 mm) … 1 = mép sắc (gờ 0,5 mm); 0,25 ≈ độ mềm trước r7 (gờ 3,1 mm)
  pedestalProfile: 'round', // dáng mép chữ khắc: xem PEDESTAL_PROFILE_OPTIONS
  pedestalSep: 'dash',    // dấu ngăn giữa các cụm chữ khắc: xem PEDESTAL_SEP_OPTIONS
  pedestalTopGlow: 1,    // 0..2  đèn viền trên bục khi hover bia (0 = tắt)
  pedestalTopColor: '#ffe7c4',
  pedestalBottomGlow: 0.1, // 0..2  đèn hắt dưới chân bục (0 = tắt)
  pedestalBottomColor: '#ffe7c4',
  pedestalHighlight: 1,    // 0..2  vệt sáng trên mặt vát chữ (đèn ảo chỉ có trên đá bục) — làm rõ số năm khi chưa hover; 0 = tắt
  pedestalHighlightPos: 0, // −90..90 độ — tâm vệt quanh bục: 0 = giữa chữ mặt trước (số năm), âm = sang trái
  pedestalFloorShadow: 1,  // 0..1.5 bóng chân bục trên sàn (vành tối quanh chân bục); 0 = tắt
  sound: true,           // r32: âm thanh phản hồi (core/sound.js): mõ gỗ khi nhón / chọn, chuông khi xong bước hướng dẫn, gõ khẽ khi đổi bia
  soundVolume: 0.6,      // r32: 0..1 âm lượng
  gesture: true,
  gesturePreview: true,
  gestureDebug: true,
  bg: { gallery: 'paper', cinema: 'warm', lab: 'grid' },
});

/** Màu đèn bục (Điện ảnh), dùng chung cho đèn trên và đèn dưới. Ngoài các lựa chọn này, bảng Cài đặt có ô chọn màu tuỳ ý. */
export const PEDESTAL_COLOR_OPTIONS = Object.freeze([
  { id: '#ffffff', label: 'Trắng' },
  { id: '#ffe7c4', label: 'Trắng ấm' },
  { id: '#f2c46b', label: 'Vàng đồng' },
  { id: '#cfe3ff', label: 'Trắng lạnh' },
]);

/** Màu đá ở chỗ xoa bóng tối đa (Điện ảnh → Xoa đầu rùa). Ngoài các lựa chọn này có ô chọn màu tuỳ ý. */
export const RUB_COLOR_OPTIONS = Object.freeze([
  { id: '#656c73', label: 'Xanh xám' },
  { id: '#6d6c69', label: 'Xám đá' },
  { id: '#2b2f33', label: 'Đen bóng' },
]);

/**
 * Màu đèn rọi (Điện ảnh): màu mặc định của đèn (ấm, sợi đốt) + đúng các ô màu của đèn bục.
 * Mặc định phải là một ô có sẵn — nếu không, lần đầu mở bảng ô "Tuỳ chọn" sẽ được đánh dấu.
 */
export const SPOT_COLOR_OPTIONS = Object.freeze([
  { id: '#ffd9b0', label: 'Sợi đốt' },
  ...PEDESTAL_COLOR_OPTIONS,
]);

/**
 * Dấu ngăn giữa các cụm chữ khắc trên bục ("BIA TIẾN SĨ • 1661 • KHOA TÂN SỬU").
 * relief.js VẼ dấu thành hình (không dùng ký tự của font) nên không phụ thuộc font có glyph hay không.
 */
export const PEDESTAL_SEP_OPTIONS = Object.freeze([
  { id: 'dot', label: '•', title: 'Chấm tròn' },
  { id: 'diamond', label: '◆', title: 'Hình thoi' },
  { id: 'dash', label: '—', title: 'Gạch ngang' },
  { id: 'bar', label: '|', title: 'Gạch đứng' },
  { id: 'space', label: 'Trống', title: 'Khoảng trống' },
]);

/** Dáng mép (mặt cắt) của chữ khắc nổi trên bục — relief.worker.js dựng độ cao theo dáng này. */
export const PEDESTAL_PROFILE_OPTIONS = Object.freeze([
  { id: 'round', label: 'Tròn', title: 'Vai tròn (một phần tư hình tròn)' },
  { id: 'bevel', label: 'Vát', title: 'Vát thẳng' },
  { id: 'flat', label: 'Phẳng', title: 'Mặt phẳng, tường đứng hẹp — như chữ cắt' },
  { id: 'cove', label: 'Lõm', title: 'Dốc lõm: thoải ở chân, dốc dần lên mép trên' },
]);


/** r30g: chọn mốc dòng thời gian (các mục của một vùng dính) bằng tay. */
/** r63: "Kích thước gợn" 0 → 1 = cạnh một ô vân lát kín của mặt lòng bục (m, thang log; mỗi ô ~3 gợn): mịn → rộng. */
export const RIPPLE_SIZE_RANGE_M = Object.freeze([0.1, 1]);
/** r63: pedestalRippleSize (0..1) → cạnh ô vân (m). */
export function rippleSizeM(v) {
  const n = Number(v);
  const t = Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
  return RIPPLE_SIZE_RANGE_M[0] * Math.pow(RIPPLE_SIZE_RANGE_M[1] / RIPPLE_SIZE_RANGE_M[0], t);
}
/** r62: "Mỗi bia" — giây dừng ở mỗi bia khi tự trình chiếu / ▶ tay (settings.cinemaAutoDwell). */
export const AUTO_DWELL_OPTIONS = Object.freeze([5, 10, 15, 20]);

/** Màu chữ tên người đỗ trên thân bia (Điện ảnh). */
export const NAMES_STYLE_OPTIONS = Object.freeze([
  { id: 'auto', label: 'Tự động', desc: 'Theo độ sáng mặt đá lúc đang xem (cả khi đèn hover sáng lên): đá sáng → chữ mực, đá tối → chữ sáng. Chỉ đổi màu chữ — mặt đá giữ nguyên ánh sáng.' },
  { id: 'light', label: 'Chữ sáng', desc: 'Luôn chữ sáng, quầng tối sát nét.' },
  { id: 'ink', label: 'Chữ mực', desc: 'Luôn chữ mực nâu đậm, quầng sáng sát nét.' },
]);

/** Cách hiện thông tin bia trong chế độ Điện ảnh (hover bia bằng tay/chuột để hiện). */
/** Kiểu mũi tên chuyển bia hai bên của Điện ảnh (r20) — hud.js / cinema.css. */
export const NAV_ARROW_OPTIONS = Object.freeze([
  { id: 'gold', label: 'Chỉ vàng', desc: 'Một sợi chỉ sáng vàng mảnh, không khung; năm và can chi của bia kế bên đứng cạnh.' },
  { id: 'glass', label: 'Kính khắc', desc: 'Tấm kính mờ đứng, chevron khắc chìm, bóng mờ của bia kế bên hiện trong kính.' },
  { id: 'seal', label: 'Ấn triện', desc: 'Con dấu son trầm, năm của bia kế bên khắc 2 × 2 như ấn; bấm là một nhịp đóng dấu.' },
]);

/**
 * Kiểu dòng thời gian 82 bia của Điện ảnh — views/cinema/timeline*.js; triều đại: src/data/dynasties.js.
 * r24: Thước khắc (thanh chia đoạn triều đại, mốc năm thi trên, năm dựng dưới) + Sợi chỉ tối giản. B bỏ Dải lụa / Bia ký
 * (và tạm cả Sợi chỉ); r43 (người dùng: "giữ Sợi chỉ & thước khắc") đưa Sợi chỉ lại. Giá trị cũ ngoài danh sách tự về mặc
 * định (xem load()). Màn hẹp (≤ 760 px) luôn là Sợi chỉ thu gọn, bất kể kiểu đang chọn.
 */
export const TIMELINE_OPTIONS = Object.freeze([
  { id: 'ruler', label: 'Thước khắc', desc: 'Thanh đá sẫm chữ khắc tên triều, mốc năm thi là ghim vàng mảnh, năm dựng bia là hạt thoi phía dưới; năm thi nổi trong một ô viền vàng.' },
  { id: 'line', label: 'Sợi chỉ', desc: 'Tối giản: một sợi chỉ năm 1442 → 1779, mỗi bia một vạch; rê để xem thẻ.' },
]);

export const CINEMA_INFO_OPTIONS = Object.freeze([
  { id: 'screens', label: 'Bình phong', desc: 'Hai tấm bình phong gập hình chữ V mở ra từ hai mép bia, như đôi câu đối hai bên án thờ.' },
  { id: 'light', label: 'Chữ ánh sáng', desc: 'Chữ bằng ánh sáng trượt ra từ trong lòng bia, kèm đường chú giải chỉ vào từng bộ phận của bia.' },
  { id: 'spread', label: 'Trang triển lãm', desc: 'Tấm kính mờ 16:9 như trang catalogue phủ trước bia, ô cửa trong ở giữa để bia vẫn xoay, zoom được.' },
]);

/** r35: thời gian một lượt "Lướt" ở Điện ảnh (giây) — thanh trượt + kẹp khi đọc (glideSeconds). */
export const GLIDE_RANGE = Object.freeze({ min: 0.8, max: 2.4, step: 0.1 });
/** Thời gian lướt (giây) từ cài đặt, đã kẹp trong GLIDE_RANGE; giá trị hỏng → mặc định. */
export function glideSeconds(s) {
  const v = Number(s?.glideDuration);
  if (!Number.isFinite(v)) return DEFAULTS.glideDuration;
  return Math.min(GLIDE_RANGE.max, Math.max(GLIDE_RANGE.min, v));
}

/**
 * r40: "FPS tối đa" (Cài đặt → Hiển thị) — trần số lượt của vòng vẽ 3D mỗi giây (core/renderer.js), mọi view. Hạ trần để
 * nhường GPU cho nhận diện tay (MediaPipe chạy song song): 30 = tay nhạy + ổn định nhất; 120 chỉ có tác dụng ở màn 120 Hz.
 */
export const MAX_FPS_OPTIONS = Object.freeze([30, 60, 120]);
/** Trần FPS từ cài đặt; giá trị ngoài danh sách → mặc định. */
export function maxFps(s) {
  const v = Number(s?.maxFps);
  return MAX_FPS_OPTIONS.includes(v) ? v : DEFAULTS.maxFps;
}

/** Lựa chọn nền theo view: id → nhãn + màu nền chính (view tự ánh xạ sang CSS/scene). */
export const BG_OPTIONS = Object.freeze({
  gallery: [
    { id: 'paper', label: 'Giấy', color: '#f4efe6' },
    { id: 'ivory', label: 'Ngà', color: '#f8f4ec' },
    { id: 'stone', label: 'Đá', color: '#e6e3dc' },
    { id: 'mist', label: 'Sương', color: '#eef1f3' },
  ],
  cinema: [
    { id: 'black', label: 'Đen', color: '#07070a' },
    { id: 'graphite', label: 'Than chì', color: '#141418' },
    { id: 'warm', label: 'Ấm', color: '#1a1410' },
    { id: 'navy', label: 'Xanh đêm', color: '#0b0f1a' },
  ],
  lab: [
    { id: 'grid', label: 'Lưới', color: '#eef0ec' },
    { id: 'plain', label: 'Trơn', color: '#f3f4f1' },
    { id: 'mist', label: 'Sương', color: '#e9edf1' },
  ],
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    // B: chỉ còn chuyển cảnh "Lướt" → bỏ lựa chọn cũ trong bộ nhớ (về mặc định)
    delete saved.transition;
    // Dòng thời gian: chỉ còn Thước khắc + Sợi chỉ (r43) — kiểu khác đã lưu (Dải lụa / Bia ký của r24, Hai tầng / Chương
    // triều đại của r22) về mặc định; 'line' đã lưu được giữ
    if ('cinemaTimeline' in saved && !TIMELINE_OPTIONS.some((o) => o.id === saved.cinemaTimeline)) delete saved.cinemaTimeline;
    // r72: hai phương án r71 gộp làm một → công tắc (chuỗi cũ: 'off' = tắt, còn lại = bật)
    if (typeof saved.cinemaInfoRich === 'string') saved.cinemaInfoRich = saved.cinemaInfoRich !== 'off';
    else if ('cinemaInfoRich' in saved && typeof saved.cinemaInfoRich !== 'boolean') delete saved.cinemaInfoRich;
    if ('cinemaRubbingScan' in saved && typeof saved.cinemaRubbingScan !== 'boolean') delete saved.cinemaRubbingScan;
    if ('readerMode' in saved && saved.readerMode !== '3d' && saved.readerMode !== 'flat') delete saved.readerMode;
    if ('readerGap' in saved) {
      const v = Number(saved.readerGap);
      if (Number.isFinite(v)) saved.readerGap = Math.min(READER_GAP_RANGE.max, Math.max(READER_GAP_RANGE.min, v));
      else delete saved.readerGap;
    }
    for (const k of ['readerZoomIn', 'readerZoomOut']) {
      if (!(k in saved)) continue;
      const v = Number(saved[k]);
      if (Number.isFinite(v)) saved[k] = Math.min(READER_ZOOM_RANGE.max, Math.max(READER_ZOOM_RANGE.min, Math.round(v * 10) / 10));
      else delete saved[k];
    }
    if ('glyphFx' in saved && typeof saved.glyphFx !== 'boolean') delete saved.glyphFx;
    for (const [k, R] of [['glyphTrail', GLYPH_TRAIL_RANGE], ['glyphSparkle', GLYPH_SPARKLE_RANGE], ['glyphDensity', GLYPH_DENSITY_RANGE]]) {
      if (!(k in saved)) continue;
      const v = Number(saved[k]);
      if (Number.isFinite(v)) saved[k] = Math.min(R.max, Math.max(R.min, Math.round(v * 100) / 100));
      else delete saved[k];
    }
    if ('readerSlideShare' in saved) {
      const v = Number(saved.readerSlideShare);
      if (Number.isFinite(v)) saved.readerSlideShare = Math.min(READER_SLIDE_RANGE.max, Math.max(READER_SLIDE_RANGE.min, Math.round(v * 100) / 100));
      else delete saved.readerSlideShare;
    }
    // r84: nhóm "Chuyển cảnh toàn văn" — kẹp số theo khoảng / bước, lựa chọn lạ hoặc kiểu sai → mặc định
    for (const [k, R] of Object.entries(TRANSITION_SPEC)) {
      if (!(k in saved)) continue;
      const v = saved[k];
      if (R.bool) {
        if (typeof v !== 'boolean') delete saved[k];
      } else if (R.options) {
        if (!R.options.includes(v)) delete saved[k];
      } else {
        const n = Number(v);
        if (Number.isFinite(n)) saved[k] = Math.min(R.max, Math.max(R.min, Math.round(n / R.step) * R.step));
        else delete saved[k];
        if (k in saved) saved[k] = +saved[k].toFixed(4);
      }
    }
    // r85: công tắc "Hiệu ứng chữ tiêu đề" (bản đầu r85) → kiểu hiện tiêu đề; tắt = mờ dần
    if ('titleFx' in saved) {
      if (saved.titleFx === false && !('titleFxMode' in saved)) saved.titleFxMode = 'fade';
      delete saved.titleFx;
    }
    // r84: mặc định tấm trượt đổi 0,58 → 0,36 (chữ Hán bay cùng camera) — bản lưu còn đúng mặc định cũ → theo mặc định mới
    if (saved.readerSlideShare === 0.58 && (Number(saved.rev) || 1) < 3) delete saved.readerSlideShare;
    // r90: chữ sáng theo mép dẫn vạch — bản lưu còn đúng độ trễ cũ (0,035, cài đặt ẩn) → theo mặc định mới (0)
    if (saved.glyphLitDelay === 0.035 && (Number(saved.rev) || 1) < 4) delete saved.glyphLitDelay;
    if ('readerArch' in saved) {
      const v = Number(saved.readerArch);
      if (Number.isFinite(v)) saved.readerArch = Math.min(1, Math.max(0, v));
      else delete saved.readerArch;
    }
    // r39: tự trình chiếu không còn hiện thông tin → bỏ công tắc cũ
    delete saved.cinemaAutoInfo;
    // r61: vòng cầm (nắm tay kéo bia) cố định trên sàn — bỏ thanh "Độ cao vòng khi cầm" (r60)
    delete saved.fistRingHeight;
    // r62: bỏ kiểu "Chọn bên rồi vuốt" — hai ngón ở Điện ảnh luôn là "Kéo bia" (không còn lựa chọn) · bỏ "Nắm tay 3 giây để
    // mở hướng dẫn" (nút "Hướng dẫn" vẫn còn)
    delete saved.handNavStyle;
    delete saved.guideFist;
    // r70: xoa đầu rùa chỉ mở bằng động tác xoa thật — bỏ lựa chọn cách bắt đầu bằng tay (xoè giữ 3 s / nắm tay)
    delete saved.rubHandStart;
    if ('cinemaAutoDwell' in saved) {
      const v = Number(saved.cinemaAutoDwell);
      if (AUTO_DWELL_OPTIONS.includes(v)) saved.cinemaAutoDwell = v;
      else delete saved.cinemaAutoDwell; // giá trị lạ → mặc định 10 s
    }
    // Chuyển đổi: đèn bục từng dùng chung một độ sáng + một màu cho cả trên và dưới.
    if ('pedestalGlow' in saved) {
      saved.pedestalTopGlow ??= saved.pedestalGlow;
      saved.pedestalBottomGlow ??= saved.pedestalGlow;
      delete saved.pedestalGlow;
    }
    if ('pedestalColor' in saved) {
      saved.pedestalTopColor ??= saved.pedestalColor;
      saved.pedestalBottomColor ??= saved.pedestalColor;
      delete saved.pedestalColor;
    }
    // Đèn ngược sau bia đã bỏ (người dùng thấy không đẹp) → xoá khoá cũ khỏi bản lưu.
    delete saved.pedestalBacklight;
    delete saved.pedestalBacklightColor;
    // Điện ảnh tách bóng khỏi shadow / shadowOpacity. Trước đây ở Điện ảnh cả bóng sàn lẫn bóng tiếp
    // xúc đều ăn theo hai khoá đó (tắt = mất cả hai; bóng tiếp xúc = min(1, shadowOpacity)) → bản lưu
    // cũ giữ đúng độ đậm người dùng đã chọn. shadow / shadowOpacity vẫn nguyên cho Trưng bày / Nghiên cứu.
    if (!('cinemaCastShadow' in saved) && !('contactShadow' in saved) && ('shadow' in saved || 'shadowOpacity' in saved)) {
      const op = Number(saved.shadowOpacity);
      const k = saved.shadow === 'off' ? 0 : Number.isFinite(op) ? Math.min(1.5, Math.max(0, op)) : 1;
      saved.cinemaCastShadow = k;
      saved.contactShadow = Math.min(1, k);
    }
    // Rev 2: đèn rọi mặc định −38°/58° → −18°/80° (sượt từ trên xuống mặt bia) và cường độ gốc 40 → 75 cd
    // để mặt bia sáng gần như cũ ở góc sượt. Bản lưu còn đúng mặc định cũ → theo mặc định mới; hướng tự
    // chọn → giữ hướng, hạ spotIntensity đúng tỉ lệ 40/75 để đèn sáng y như người dùng đã thấy.
    // Cũng từ rev 2, đèn rọi KHÔNG còn nhân theo "Đèn chính" (settings.key) — nó có thanh cường độ riêng —
    // nên hệ số key cũ được gộp vào spotIntensity.
    if ((Number(saved.rev) || 1) < 2) {
      let k = Number(saved.spotIntensity ?? 1);
      if (!Number.isFinite(k)) k = 1;
      const keyMul = Number(saved.key);
      if (Number.isFinite(keyMul) && keyMul !== 1) k *= keyMul;
      if ('spotAzimuth' in saved || 'spotElevation' in saved) {
        if (saved.spotAzimuth === -38 && saved.spotElevation === 58) {
          saved.spotAzimuth = DEFAULTS.spotAzimuth;
          saved.spotElevation = DEFAULTS.spotElevation;
        } else {
          k *= 40 / 75;
        }
      }
      if (k !== Number(saved.spotIntensity ?? 1)) saved.spotIntensity = Math.round(Math.min(2, Math.max(0, k)) * 100) / 100;
    }
    saved.rev = REV;
    return { ...structuredClone(DEFAULTS), ...saved, bg: { ...DEFAULTS.bg, ...(saved.bg || {}) } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let state = load();
const listeners = new Set();

/** Bản sao chỉ đọc của cài đặt hiện tại. */
export function getSettings() {
  return state;
}

/**
 * Đặt một giá trị: setSetting('exposure', 1.2) hoặc setSetting('bg.cinema', 'warm').
 * Phát sự kiện cho mọi listener với (settings, path, value).
 */
export function setSetting(path, value) {
  const next = structuredClone(state);
  const parts = path.split('.');
  let o = next;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
  if (o[parts.at(-1)] === value) return;
  o[parts.at(-1)] = value;
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach((cb) => cb(state, path, value));
}

/** Đăng ký nghe thay đổi; trả về hàm huỷ. cb(settings, path, value) — gọi ngay 1 lần với path=null. */
export function onSettings(cb, { immediate = true } = {}) {
  listeners.add(cb);
  if (immediate) cb(state, null, undefined);
  return () => listeners.delete(cb);
}

export function resetSettings() {
  state = structuredClone(DEFAULTS);
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((cb) => cb(state, null, undefined));
}

/** r84: "Khôi phục mặc định" của nhóm "Chuyển cảnh toàn văn" — chỉ các khoá của nhóm. */
export function resetTransitionSettings() {
  for (const k of TRANSITION_KEYS) setSetting(k, DEFAULTS[k]);
}

const clampN = (v, R, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(R.max, Math.max(R.min, n)) : d;
};
/** r84: một giá trị số của nhóm chuyển cảnh (đã kẹp theo TRANSITION_SPEC; thiếu / lạ → mặc định). */
export function tnum(s, k) {
  return clampN(s?.[k], TRANSITION_SPEC[k], DEFAULTS[k]);
}
/** r84: một lựa chọn của nhóm chuyển cảnh (lạ → mặc định). */
export function topt(s, k) {
  const v = s?.[k];
  return TRANSITION_SPEC[k].options.includes(v) ? v : DEFAULTS[k];
}

/**
 * r84: nhịp chung của lượt mở toàn văn (một chỗ tính — lớp đọc, chữ Hán, bảng cài đặt cùng dùng), theo tiến độ THỜI GIAN của đoạn
 * camera tiến vào (0 = bắn, 1 = camera dừng):
 *   slideAt = lúc tấm bắt đầu trượt (1 − readerSlideShare) · textAt = lúc chữ tấm đọc bắt đầu hiện (nhóm đầu)
 *   pEnd = sprite chữ Hán phải hết trước mốc này (textAt − GLYPH_TEXT_MARGIN)
 *   waveStart / waveEnd = cửa sổ tách chữ (người dùng chọn) SAU khi kẹp: waveEnd ≤ pEnd − GLYPH_FLY_MIN_P (còn chỗ bay),
 *   waveStart ≤ waveEnd − 0,02; clamped = cài đặt bị kẹp (bảng cài đặt hiện gợi ý)
 *   landStart / landEnd = cửa sổ chạm đá lúc bay về (phần đoạn lùi), landEnd ≤ 0,99 (chạm trước khi camera lùi xong)
 */
export function readerTiming(s = state, opts = {}) {
  const dur = Number.isFinite(opts.dur) && opts.dur > 0 ? opts.dur : tnum(s, 'readerZoomIn');
  // r85: đám mây hạt sáng (hiệu ứng ánh sáng chữ bật, kiểu 'cloud', không giảm chuyển động) cần cửa sổ bay xuyên trước chữ tấm đọc
  const cloud = opts.cloud ?? (s?.glyphFx !== false && topt(s, 'glyphFlyMode') === 'cloud');
  const lag1 = tnum(s, 'readerTextLag1');
  const shareSet = tnum(s, 'readerSlideShare');
  const SPEC_S = TRANSITION_SPEC.readerSlideShare;
  let share = shareSet;
  const Tc = tnum(s, 'glyphCloudLife') / dur;
  let pushed = false;
  let titleU = TITLE_U;
  let ov = 0;
  let pEnd;
  let titleAt;
  if (cloud) {
    // r90 (người dùng: tiêu đề hiện CHỒNG lên lúc đám mây còn tan, không đợi chữ cuối): đám mây neo từ CLOUD_START, dài Tc, tắt hẳn ở
    // pEnd; tiêu đề bắt đầu ov TRƯỚC pEnd (readerCloudOverlap — không quá phần hiệu ứng tiêu đề trước thân bài trừ lề: thân bài luôn
    // trượt lên SAU khi đám mây hết). Tấm trượt định thời theo đó (tiêu đề ở TITLE_U_CLOUD quãng trượt, tấm tới nơi đúng lúc camera
    // dừng); quá giới hạn quãng trượt (readerSlideShare.min … CLOUD_SLIDE_MAX) → kẹp; đoạn tiến vào ngắn → đám mây ngắn lại (clamped.cloud)
    titleU = TITLE_U_CLOUD;
    ov = Math.max(0, Math.min(tnum(s, 'readerCloudOverlap'), titleFxSpan(s) - GLYPH_TEXT_MARGIN * dur)) / dur;
    const titleMax = 1 - SPEC_S.min * (1 - titleU);
    pEnd = Math.min(CLOUD_START + Tc + CLOUD_TAIL, titleMax + ov, 1 - GLYPH_TEXT_MARGIN);
    share = Math.min(CLOUD_SLIDE_MAX, Math.max(SPEC_S.min, (1 - (pEnd - ov)) / (1 - titleU)));
    pushed = Math.abs(share - shareSet) > 1e-6;
  }
  const slideAt = 1 - share;
  // textAt: lúc chữ tấm đọc bắt đầu hiện (nhóm đầu theo readerTextLag1; có hiệu ứng tiêu đề: tiêu đề ở titleU quãng trượt)
  const textAt = slideAt + lag1 * share;
  titleAt = slideAt + titleU * share;
  if (!cloud) pEnd = Math.max(0.05, textAt - GLYPH_TEXT_MARGIN);
  // cửa sổ đám mây: kết thúc CLOUD_TAIL trước pEnd, dài Tc (không sớm hơn CLOUD_START — không vừa: ngắn lại, clamped.cloud)
  const pB = pEnd - CLOUD_TAIL;
  const pA = Math.max(CLOUD_START, pB - Tc);
  // r88: chữ tách muộn nhất vẫn kịp nâng lên (CLOUD_LIFT_S) + lơ lửng một chút trước khi pha camera tiến qua mây kết thúc
  const endMax = cloud ? Math.max(0.02, pB - (CLOUD_LIFT_S[1] + 0.2) / dur) : Math.max(0.02, pEnd - GLYPH_FLY_MIN_P);
  const endWant = tnum(s, 'glyphWaveEnd');
  const waveEnd = Math.min(endWant, endMax);
  const startWant = tnum(s, 'glyphWaveStart');
  const waveStart = Math.max(0, Math.min(startWant, waveEnd - 0.02));
  const landEnd = Math.min(0.99, tnum(s, 'glyphLandEnd'));
  const landStart = Math.min(tnum(s, 'glyphLandStart'), landEnd - 0.02);
  return {
    dur,
    cloud,
    share,
    shareSet,
    pushed,
    slideAt,
    textAt,
    titleAt,
    titleU,
    // r90: tiêu đề chồng lên đám mây (s) — dương: tiêu đề bắt đầu trước khi chữ cuối của đám mây tắt
    overlap: cloud ? +((pEnd - titleAt) * dur).toFixed(3) : 0,
    bodyAt: titleAt + titleFxSpan(s) / dur,
    pEnd,
    pA: cloud ? pA : null,
    pB: cloud ? pB : null,
    waveStart,
    waveEnd,
    clamped: { waveEnd: endWant > endMax + 1e-9, waveStart: startWant > waveStart + 1e-9, land: tnum(s, 'glyphLandStart') > landStart + 1e-9, cloud: cloud && pB - CLOUD_START < Tc - 1e-6 },
    // r89: thời gian đám mây tồn tại đạt được (s) — từ CLOUD_START tới pB
    lifeMax: cloud ? +((pB - CLOUD_START) * dur).toFixed(2) : null,
    landStart,
    landEnd,
  };
}

/** r84: đường cong vào–ra / ra (u ∈ 0..1) theo tên — camera (vào–ra) · tấm trượt mở (ra). */
export const EASE_INOUT = Object.freeze({
  sine: (t) => (1 - Math.cos(Math.PI * t)) / 2,
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  quint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
});
export const EASE_OUT = Object.freeze({
  sine: (u) => Math.sin((Math.PI * u) / 2),
  cubic: (u) => 1 - Math.pow(1 - u, 3),
  quint: (u) => 1 - Math.pow(1 - u, 5),
});

/** Thiết bị yếu (mobile) → mặc định tắt phản chiếu để giữ khung hình. */
export function isLowPowerDevice() {
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
  return mobile || cores <= 4;
}

// DEV: hook để script kiểm thử dùng ĐÚNG instance store của app (Vite gắn ?t= vào module đã sửa,
// import() trần từ console sẽ tạo instance thứ hai).
if (import.meta.env.DEV) {
  // r84: + mặc định, khoá nhóm "Chuyển cảnh toàn văn", nhịp (readerTiming), khôi phục mặc định của nhóm
  (window.__vm ??= {}).settings = { get: getSettings, set: setSetting, on: onSettings, reset: resetSettings, defaults: DEFAULTS, transitionKeys: TRANSITION_KEYS, timing: (s, o) => readerTiming(s ?? state, o), resetTransition: resetTransitionSettings };
}
