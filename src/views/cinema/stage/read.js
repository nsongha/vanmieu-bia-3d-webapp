// r74 — KHUNG ĐỌC TOÀN VĂN: camera tiến sát mặt bia (chính diện), tấm đọc trong mờ nằm trên hình chiếu phiến bia.
//
// Lớp đọc (info/rich/reader.js) báo ô của tấm đọc (px khung nhìn) + tiến độ cuộn 0..1; ở đây giải khung camera theo ô đó:
//   · khoảng cách: bề ngang mặt bia chiếu ra = bề ngang tấm + lề hai bên (mép bia còn thấy hai bên tấm), bia giữa tấm;
//   · cao độ theo cuộn (người dùng r74: "cuộn thì camera lên xuống"): đầu văn → camera ở đỉnh phiến, thấy vòm trán
//     (đỉnh vòm ở ~6 % khung trên); cuối (Đề danh) → camera thấp, sát mai rùa — thấp nhất mà HỘP ĐẦU RÙA (cầu đầu × 1,15 +
//     lề) vẫn nằm trọn DƯỚI mép dưới tấm đọc (tấm là lớp DOM trên WebGL: đầu rùa chồng lên tấm trông như nằm SAU chữ — sai
//     không gian). Cúi nhẹ theo độ thấp (≤ READ_PITCH). Tính riêng từng bia (khung mặt + đầu rùa của bia đó).
//   · không đủ chỗ (khung rất thấp / bia đặc biệt) → mở góc ống kính (FOV) từng nấc, tối đa +READ_FOV_MAX, đổi êm.
// Cuộn (tay / bánh xe / nhảy mục lục) giật cục → camera theo một bộ bám TỚI HẠN (lò xo tắt dần tới hạn), không bao giờ
// cắt; nhảy mục lục / "Đầu trang" → bám chậm hơn (đi dài, êm). Vẽ theo yêu cầu: camera đổi thì khung đó vẽ (lý do 'camera').
// Mở: camera tween từ khung đang có tới khung đọc ở đúng tiến độ cuộn lúc mở. Đóng: tween về khung đích thường (focus / nghỉ).
// Giữ S.readOn suốt lúc đọc: goal() trả khung đọc, lắc đứng lại, OrbitControls tắt, minDistance nới (như chế độ xoa).
// r77 (người dùng): camera gần hơn ~13 % (READ_CLOSER); tấm đọc chạy tới mép dưới khung (đầu rùa phải ra NGOÀI khung — luật
// "hộp đầu rùa dưới mép dưới tấm" giữ nguyên, mép dưới tấm giờ là mép khung). (r77 → r81: tấm đi theo "dấu chân" chiếu trên đá
// lúc tiến / lùi — r82 bỏ, thay bằng tấm TRƯỢT lên / xuống, xem readSlide + reader.js.)
// r78 (người dùng: thị sai thật + tấm đọc là vật thể 3D nổi trước bia): MỘT nguồn chuyển động — bộ tích phân cuộn của lớp đọc
// (scroll.js) được sân khấu gọi ĐÚNG MỘT lần mỗi khung ngay trước khi đặt camera (setSource); cao độ camera là hàm thuần của vị
// trí cuộn đó (không còn bộ bám riêng của camera) → chữ và đá cùng nhịp, cùng gia tốc. Kiểu "Nổi 3D": tấm là đối tượng CSS3D đứng
// SONG SONG mặt bia, cách trước mặt đá `gap` (Cài đặt "Khoảng cách chữ – bia"), cố định trong thế giới (readPanel3D: toạ độ cục
// bộ bia, cỡ px thiết kế sao cho ở cuộn 0 tấm chiếu ra đúng ô r77, cao đủ để không bao giờ thấy đáy); không cúi (READ_PITCH 0 —
// nhìn thẳng góc, chữ sắc); bóng của tấm đổ lên mặt đá theo hướng đèn chính (polish.js GLSL_PANEL_SHADOW).
// r82 (người dùng): mở — tấm TRƯỢT LÊN từ dưới vào chỗ nghỉ trong phần cuối đoạn camera tiến; đóng — trượt xuống cùng đoạn lùi.
// Kiểu 3D: lớp đọc dời đối tượng CSS3D dọc trục đứng của bia (trong mặt phẳng tấm) và báo độ dời ở đây (readSlide) — bóng tấm
// trên đá dời theo. Tiến độ thời gian của đoạn camera (readTween) là đồng hồ chung của mọi nhịp tấm / chữ.

// r84 (người dùng: tự chỉnh cả lượt chuyển cảnh; xem thêm settings.js TRANSITION_SPEC): đường cong camera tiến / lùi (readerEaseIn /
// readerEaseOut — sine | cubic | quint vào–ra), khoảng cách khi đọc (readerDistance — r77: 0,87), biên độ lên / xuống theo cuộn
// (readerParallax) là cài đặt. CAMERA NHÍCH VÀO lúc đang giữ (readerCreep — người dùng: "lúc chữ đang le lói thì camera đã đi chậm"):
// bắt đầu giữ V trên mặt bia (hoặc lượt quét của nút đọc) → camera bắt đầu đi về KHUNG ĐỌC (giải trước bằng ô tấm đọc của
// read-layout.js — đúng ô lớp đọc sẽ dùng) theo s(τ) = c·(τ/2 s)² (tăng tốc từ 0, tới c quãng lúc bắn); bắn → đoạn tiến vào đi tiếp từ
// đúng chỗ + đúng vận tốc đó (đường cong E(t) + k·t(1 − t)², k khớp vận tốc — liên tục C1, không khựng); huỷ → nhích về khung thường.
import { EASE_INOUT, READER_FIRE_S, getSettings, tnum, topt } from '../../../core/settings.js';
import { readerRect } from '../read-layout.js';

// r80: thời gian tiến vào / lùi về là cài đặt (readerZoomIn / readerZoomOut — lớp đọc truyền `dur` vào enter / exit); đây là
// giá trị khi không truyền (= mặc định của cài đặt)
const READ_IN = 2.8; // s — tiến vào (r74: 1,4 — người dùng r80: gấp đôi)
const READ_OUT = 1.0; // s — lùi về
const READ_IN_RM = 0.35; // giảm chuyển động
const READ_OUT_RM = 0.3;
const READ_PITCH = 3; // độ — cúi nhẹ ở cuối (Đề danh); r77: đầu rùa phải ra ngoài khung → cúi ít (cúi nhiều đẩy đầu rùa vào khung)
const READ_FOV_MAX = 12; // độ — mở thêm tối đa khi không đủ chỗ
const TOP_AIM = 0.06; // đỉnh vòm ở ngần này × cao khung (tính từ mép trên) lúc cuộn 0
const HEAD_K = 1.15; // hình đầu rùa = cầu đầu × ngần này (hộp chiếu = hộp bao hình chiếu của mặt cầu đó)
// hướng lấy mẫu mặt cầu đầu rùa (26 hướng: 6 mặt · 12 cạnh · 8 góc của khối lập phương, chuẩn hoá) — hộp chiếu sát hình
// thật (hộp 3D bao cầu thì góc sau-trên của hộp chiếu cao hơn đầu rùa thật nhiều khi camera sát)
const SPHERE_DIRS = (() => {
  const out = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const l = Math.hypot(x, y, z);
        out.push([x / l, y / l, z / l]);
      }
  return out;
})();
const HEAD_GAP_PX = 14; // px: lề giữa hộp đầu rùa và mép dưới tấm đọc
const RM_AMP = 0.18; // giảm chuyển động: biên độ lên xuống còn ngần này
const GAP_MIN = 0.04; // r78: khoảng cách tấm 3D – mặt đá tối thiểu (tấm không bao giờ lùi ra sau mặt đá)
const SHADOW_TILT = 0.55; // r78: độ nghiêng tối đa của tia đèn khi đổ bóng tấm (tan góc với pháp tuyến mặt bia)
// bán bóng (penumbra) tăng theo khoảng cách tấm – đá (đèn chính là đèn mặt rộng): nhìn gần chính diện, lõi bóng nằm khuất sau
// tấm (phối cảnh co mép bóng vào trong) — chỉ viền bóng mềm lộ ra phía khuất đèn, đủ làm dấu hiệu chiều sâu
const SHADOW_SOFT = 0.45;
// quầng che khuất môi trường (AO) của tấm lan ra ~ SHADOW_AO × khoảng cách tấm – đá quanh hình chiếu thẳng của tấm
const SHADOW_AO = 1.25;
// (r77: camera gần hơn — mặt bia chiếu ra rộng hơn tấm + lề × 1/0,87 · r84: cài đặt readerDistance, mặc định 0,87)

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const CREEP_BACK_S = 0.7; // r84: huỷ giữ → camera về khung thường trong ngần này
const CREEP_CAP = 0.5; // … nhích tối đa ngần này quãng (giữ quá lâu mà chưa bắn)
/** r84: đường nhích của camera theo tiến độ p của tween 'creep' (dài 4 × giờ giữ): c·(τ/h)² tới h, rồi đi tiếp thẳng (cùng vận tốc). */
const creepCurve = (c) => (p) => {
  const u = p * 4; // τ / h
  return Math.min(CREEP_CAP, u <= 1 ? c * u * u : c * (2 * u - 1));
};

/**
 * @param {object} S @param {object} K
 * @param {{ THREE: typeof import('three'), camera: import('three').PerspectiveCamera, controls: any, beginCamTween: Function,
 *   applyDistLimits: Function, killInertia: Function, cRect: () => DOMRect, reduceMotion: boolean }} deps
 */
export function installRead(S, K, { THREE, camera, controls, beginCamTween, applyDistLimits, killInertia, cRect, reduceMotion, raycaster, keyLight }) {
  const readGoal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 1 };
  S.readOn = false;
  S.readGoalOk = false;
  const probe = new THREE.PerspectiveCamera(38, 1, 0.005, 50);
  const _p = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _n = new THREE.Vector2();
  const R = {
    rect: null, // ô tấm đọc (px client)
    k: 0, // tiến độ cuộn đích
    kf: 0, // tiến độ camera (r78: = k — một nguồn chuyển động, không bộ bám thứ hai)
    fov0: camera.fov,
    fov: camera.fov, // đích FOV lúc đọc
    sol: null, // { d, camX, y0, y1, fov, zF, ok, why }
    t0: 0,
    // r78 kiểu 3D
    mode: 'flat',
    gapWant: 0.15, // khoảng cách tấm – đá người dùng chọn
    gap: 0.15, // sau khi kẹp theo đầu rùa (fitGap)
    bottomMin: NaN,
    archRise: 0,
    shadowK: 0,
    slide: 0, // r82: tấm 3D đang hạ thấp ngần này (đơn vị bia, dọc trục đứng của bia) — trượt lên lúc mở / xuống lúc đóng
    panel: null,
    source: null,
  };

  /** Chiếu điểm cục bộ bia qua camera nháp (camera ở toạ độ cục bộ) → px trong khung canvas {x, y, z}. */
  function proj(x, y, z, W, H) {
    _p.set(x, y, z).project(probe);
    return { x: ((_p.x + 1) / 2) * W, y: ((1 - _p.y) / 2) * H, z: _p.z };
  }
  /** Đặt camera nháp: cao độ cy (tâm quang học trên mặt phẳng trước ở cao độ cy − d·tanθ), cách mặt d, cúi θ (rad). */
  function place(camX, cy, d, th, zF, fov, aspect) {
    probe.fov = fov;
    probe.aspect = aspect;
    probe.updateProjectionMatrix();
    probe.position.set(camX, cy, zF + d);
    probe.up.set(0, 1, 0);
    probe.lookAt(camX, cy - d * Math.tan(th), zF);
    probe.updateMatrixWorld(true);
  }
  // r78: kiểu 3D nhìn thẳng góc (cúi làm chữ trên tấm 3D méo hình thang, mất sắc)
  const pitchAt = (k) => (R.mode === '3d' ? 0 : THREE.MathUtils.degToRad(READ_PITCH) * k);
  /** Điểm mẫu trên mặt cầu đầu rùa (× HEAD_K), toạ độ cục bộ bia. */
  function headPoints(head) {
    if (!head?.center || !(head.radius > 0)) return [];
    const [hx, hy, hz] = head.center;
    const r = head.radius * HEAD_K;
    return SPHERE_DIRS.map(([x, y, z]) => [hx + x * r, hy + y * r, hz + z * r]);
  }

  /** Giải khung đọc cho ô R.rect (toạ độ cục bộ bia). */
  function solve() {
    R.sol = null;
    S.readGoalOk = false;
    if (!S.live || !R.rect) return;
    const cr = cRect();
    const W = Math.max(1, cr.width);
    const H = Math.max(1, cr.height);
    const rect = { x: R.rect.x - cr.left, y: R.rect.y - cr.top, w: R.rect.w, h: R.rect.h };
    const B = K.bounds;
    const F = K.scanFrame?.() ?? { left: B.slabL, right: B.slabR, bottom: B.bandBottom, top: B.yMax };
    const zF = B.zFront;
    const head = S.live.head;
    const margin = Math.max(24, Math.min(56, W * 0.028));
    const pb = rect.y + rect.h + HEAD_GAP_PX; // mép dưới tấm (+ lề) — hộp đầu rùa phải ở dưới mức này
    const corners = headPoints(head);
    const cx = (F.left + F.right) / 2;
    const Ws = F.right - F.left;
    let fov = R.fov0;
    let sol = null;
    for (let tries = 0; tries <= READ_FOV_MAX / 3; tries++, fov += 3) {
      const f = H / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
      const d = ((Ws * f) / (rect.w + 2 * margin)) * tnum(getSettings(), 'readerDistance');
      // bia giữa tấm (tấm lệch tâm khung → camera dời ngang ngược lại)
      const camX = cx - ((rect.x + rect.w / 2 - W / 2) * d) / f;
      // cuộn 0: đỉnh vòm ở TOP_AIM × H (không cúi)
      const y0 = F.top - ((H / 2 - TOP_AIM * H) * d) / f;
      // cuộn 1: thấp nhất mà hộp đầu rùa ở dưới mép tấm (hoặc ra ngoài khung / sau camera); không thấp hơn khung đặt chân
      // mặt bia đúng mép dưới tấm (bia không có đầu rùa phía trước)
      const th = pitchAt(1);
      const okAt = (cy) => {
        place(camX, cy, d, th, zF, fov, W / H);
        for (const [x, y, z] of corners) {
          const q = proj(x, y, z, W, H);
          if (q.z > 1) continue; // sau camera
          if (q.y < pb) return false;
        }
        return true;
      };
      let lo = F.bottom - 0.6;
      let hi = y0;
      let y1;
      if (!corners.length || okAt(lo)) y1 = lo;
      else if (!okAt(hi)) y1 = null;
      else {
        for (let i = 0; i < 28; i++) {
          const m = (lo + hi) / 2;
          if (okAt(m)) hi = m;
          else lo = m;
        }
        y1 = hi;
      }
      // sàn: chân mặt bia chiếu đúng mép dưới tấm (thấp hơn nữa chỉ còn mai / bục)
      const yFloor = F.bottom + ((rect.y + rect.h - H / 2) * d) / f;
      if (y1 != null) y1 = Math.max(y1, Math.min(yFloor, y0));
      // đủ chỗ: có quãng lên xuống (≥ 4 % bề ngang mặt bia) — không thì mở FOV thêm một nấc
      if (y1 != null && y0 - y1 >= Ws * 0.04) {
        sol = { d, camX, y0, y1, fov, zF, ok: true, why: fov > R.fov0 ? 'fov' : '' };
        break;
      }
      sol = { d, camX, y0, y1: y1 == null ? y0 : Math.min(y0, y1), fov, zF, ok: false, why: y1 == null ? 'head' : 'room' };
    }
    R.sol = sol;
    R.fov = sol.fov;
    S.readGoalOk = true;
  }

  /** Khung đích ở tiến độ camera kf → readGoal (toạ độ thế giới). */
  /** r84: biên độ lên / xuống theo cuộn (cài đặt readerParallax; giảm chuyển động: ≤ RM_AMP). */
  const ampOf = () => {
    const a = tnum(getSettings(), 'readerParallax');
    return reduceMotion ? Math.min(RM_AMP, a) : a;
  };
  function computeGoal() {
    const s = R.sol;
    if (!s || !S.live) return;
    const amp = ampOf();
    const k = Math.min(1, Math.max(0, R.kf)) * amp;
    const cy = s.y0 + (s.y1 - s.y0) * k;
    const th = pitchAt(k);
    const lift = S.live.lift;
    lift.updateWorldMatrix(true, false);
    readGoal.pos.set(s.camX, cy, s.zF + s.d).applyMatrix4(lift.matrixWorld);
    readGoal.target.set(s.camX, cy - s.d * Math.tan(th), s.zF).applyMatrix4(lift.matrixWorld);
    readGoal.dist = readGoal.pos.distanceTo(readGoal.target);
  }

  /**
   * r78: tấm 3D — toạ độ cục bộ bia của tấm (mép trái, đỉnh, mặt phẳng z), cỡ thế giới / px (sigma, ở độ sâu tấm của khung cuối),
   * chiều cao px để đáy không bao giờ lọt khung; pxPerK = số px tấm dời lên trên màn khi camera đi hết quãng cuộn (lớp đọc trừ
   * phần này khỏi độ dịch chữ → chữ trên màn đi đúng bằng vị trí cuộn, còn khung tấm / mặt đá trượt theo độ sâu của chúng).
   */
  function panelGeom() {
    const s = R.sol;
    if (!s || !R.rect) return null;
    const cr = cRect();
    const W = Math.max(1, cr.width);
    const H = Math.max(1, cr.height);
    const f = H / 2 / Math.tan(THREE.MathUtils.degToRad(s.fov) / 2);
    const gap = R.gap;
    const dP = Math.max(0.05, s.d - gap);
    const sigma = dP / f;
    const amp = ampOf();
    const yLow = s.y0 + (s.y1 - s.y0) * amp;
    const rx = R.rect.x - cr.left;
    const ry = R.rect.y - cr.top;
    const left = s.camX + (rx - W / 2) * sigma;
    const top = s.y0 + (H / 2 - ry) * sigma;
    let bottom = Math.min(s.y0, yLow) - (H / 2 + H * 0.08) * sigma;
    if (Number.isFinite(R.bottomMin)) bottom = Math.max(bottom, R.bottomMin);
    return {
      left,
      top,
      bottom,
      z: s.zF + gap,
      sigma,
      wPx: R.rect.w,
      hPx: Math.ceil((top - bottom) / sigma),
      pxPerK: ((s.y0 - yLow) * f) / dP,
      gap,
    };
  }

  /**
   * r78: khoảng cách tấm – đá hợp lệ cho bia này. Tấm ở mặt phẳng z = zF + gap; nếu dải ngang / cao của tấm phủ khối cầu đầu
   * rùa (× HEAD_K) thì mặt phẳng tấm phải nằm SAU mép sau của đầu rùa (lề 0,02) → gap ≤ hz − r − zF − 0,02; không bao giờ
   * dưới GAP_MIN (tấm không lùi ra sau mặt đá). Hiếm khi đầu rùa sát mặt quá: giữ GAP_MIN và cắt đáy tấm lên trên đầu rùa.
   */
  function fitGap(want) {
    R.bottomMin = NaN;
    R.gap = Math.max(GAP_MIN, want);
    const head = S.live?.head;
    if (!head?.center || !(head.radius > 0)) return;
    const [hx, hy, hz] = head.center;
    const r = head.radius * HEAD_K;
    for (let i = 0; i < 2; i++) {
      const g = panelGeom();
      if (!g) return;
      const x1 = g.left + g.wPx * g.sigma;
      const overlap = hx + r > g.left && hx - r < x1 && hy + r > g.bottom && hy - r < g.top;
      if (!overlap) return;
      const zF = R.sol.zF;
      const lim = hz - r - zF - 0.02;
      if (lim >= GAP_MIN) {
        if (R.gap <= lim) return;
        R.gap = lim;
      } else {
        R.gap = GAP_MIN;
        R.bottomMin = hy + r + 0.01;
        return;
      }
    }
  }

  /** r78: bóng tấm lên mặt đá (kiểu 3D) — hình tấm ở mặt phẳng z, chiếu theo hướng đèn chính xuống mặt trước phiến. */
  const _L = new THREE.Vector3();
  const _inv = new THREE.Matrix4();
  function shadowStep() {
    const pol = S.live?.polish;
    if (!pol?.setPanelShadow) return;
    const g = R.mode === '3d' && R.panel && (S.readOn || S.camTw?.kind === 'read-out') ? R.panel : null;
    const k = g ? R.shadowK : 0;
    if (!g || !(k > 0.001)) {
      pol.setPanelShadow(null);
      return;
    }
    // hướng tới đèn chính (toạ độ cục bộ bia), từ tâm tấm
    const lift = S.live.lift;
    lift.updateWorldMatrix(true, false);
    const kl = keyLight?.();
    const cx = g.left + (g.wPx * g.sigma) / 2;
    const cy = (g.top + g.bottom) / 2;
    if (kl) {
      _L.copy(kl).applyMatrix4(_inv.copy(lift.matrixWorld).invert()).sub(_c.set(cx, cy, g.z));
      if (_L.z < 0.05) _L.z = 0.05;
      _L.normalize();
    } else _L.set(-0.35, 0.55, 0.76).normalize();
    const w = g.wPx * g.sigma;
    const rise = (R.archRise || 0) * g.sigma;
    // điểm mặt đá p có bóng khi tia p → đèn chạm tấm: p + (gap / Lz)·L — dời theo (Lx, Ly)·gap/Lz
    // độ dời bóng = gap · (Lx, Ly) / Lz — đèn chính của Điện ảnh đặt cao (chiếu gần như từ trên xuống) → bóng dài quá, rơi hẳn
    // khỏi mặt bia; giới hạn độ nghiêng ≤ SHADOW_TILT (bóng vẫn theo HƯỚNG đèn, lệch vừa đủ để thấy tấm nổi)
    let tx = _L.x / _L.z;
    let ty = _L.y / _L.z;
    const tm = Math.hypot(tx, ty);
    if (tm > SHADOW_TILT) {
      tx *= SHADOW_TILT / tm;
      ty *= SHADOW_TILT / tm;
    }
    // r82: tấm đang trượt (mở / đóng) → bóng trượt cùng
    const dy = R.slide || 0;
    pol.setPanelShadow({ cx, hw: w / 2, top: g.top - dy, bottom: g.bottom - dy, rise, sx: tx * g.gap, sy: ty * g.gap, soft: Math.max(0.01, g.gap * SHADOW_SOFT), ao: g.gap * SHADOW_AO, k, zF: g.z - g.gap });
  }

  /** Mỗi khung (trước lái camera): nguồn cuộn (MỘT bước của bộ tích phân lớp đọc) → tiến độ camera; FOV; bóng tấm. */
  function readStep(dt) {
    // r84: nhích vào bị thay (đổi bia, đoạn camera khác) → thôi nhích
    if (creep.on && !S.readOn && (S.camTw?.kind !== 'creep' || S.tx || S.live !== creep.live)) creepCancel(S.camTw?.kind === 'creep');
    const want = S.readOn ? R.fov : R.fov0;
    if (Math.abs(camera.fov - want) > 1e-3) {
      camera.fov += (want - camera.fov) * (reduceMotion ? 1 : 1 - Math.exp(-dt / 0.35));
      if (Math.abs(camera.fov - want) < 1e-3) camera.fov = want;
      camera.updateProjectionMatrix();
    }
    if (!S.readOn) {
      shadowStep();
      return;
    }
    if (R.source) {
      const r = R.source(dt);
      if (r && Number.isFinite(r.k)) R.k = R.kf = Math.min(1, Math.max(0, r.k));
    }
    computeGoal();
    shadowStep();
  }

  // ---------------------------------------------------------------- r84: camera nhích vào lúc đang giữ
  const creep = { on: false, live: null, amount: 0, t0: 0 };
  function creepCancel(back = true) {
    if (!creep.on) return;
    creep.on = false;
    S.creepOn = false;
    if (S.readOn) return;
    S.readGoalOk = false;
    // về khung thường: tween ngắn từ chỗ đang đứng, khớp vận tốc đang có (không khựng)
    if (back && !S.tx) S.camTw = beginCamTween('creep-back', reduceMotion ? 0.15 : CREEP_BACK_S, easeInOutCubic, true);
  }

  const api = {
    /**
     * r84: bắt đầu nhích vào khung đọc (giữ V trên mặt bia bắt đầu / lượt quét của nút đọc). Khung đọc giải trước bằng ô tấm đọc của
     * read-layout.js ở cuộn 0 (mở ở đầu). Trả true nếu đang nhích. Không nhích: cài đặt 0, giảm chuyển động, đang lướt / xoa / đọc.
     */
    readCreepStart() {
      const set = getSettings();
      const amount = reduceMotion ? 0 : tnum(set, 'readerCreep');
      if (!(amount > 0) || !S.live || S.tx || S.readOn || S.rubOn || creep.on) return false;
      R.rect = readerRect(innerWidth, innerHeight, 0, 0);
      R.mode = (set.readerMode ?? '3d') === 'flat' ? 'flat' : '3d';
      R.k = R.kf = 0;
      R.fov0 = camera.fov;
      solve();
      if (!R.sol) {
        S.readGoalOk = false;
        return false;
      }
      computeGoal();
      creep.on = true;
      creep.live = S.live;
      creep.amount = amount;
      creep.t0 = performance.now();
      S.creepOn = true; // goal() → khung đọc
      S.camTw = beginCamTween('creep', 4 * READER_FIRE_S, creepCurve(amount), false);
      return true;
    },
    /** r84: huỷ nhích (huỷ giữ) → camera về khung thường. */
    readCreepCancel() {
      creepCancel(true);
    },
    get creeping() {
      return creep.on;
    },
    /**
     * Vào khung đọc: rect = ô tấm đọc (px client {x,y,w,h}), k = tiến độ cuộn lúc mở. Trả thời lượng tiến vào (s) — lớp đọc
     * canh nhịp hiện tấm theo đó; 0 = không vào được (không có bia).
     */
    readEnter({ rect, k = 0, mode = 'flat', gap = 0.15, archRise = 0, dur: durIn } = {}) {
      if (!S.live || S.tx || !rect) return 0;
      R.rect = rect;
      R.mode = mode === '3d' ? '3d' : 'flat';
      R.archRise = archRise;
      R.shadowK = 0;
      R.slide = 0;
      R.k = R.kf = Math.min(1, Math.max(0, k));
      if (!S.readOn) R.fov0 = camera.fov;
      solve();
      if (!R.sol) return 0;
      R.gapWant = gap;
      fitGap(gap);
      R.panel = panelGeom();
      computeGoal();
      if (S.rubOn) K.setRubMode?.(false);
      S.readOn = true;
      S.distRelax = Math.min(readGoal.dist, R.sol.d) * 0.6;
      applyDistLimits();
      controls.enabled = false;
      killInertia();
      const dur = reduceMotion ? READ_IN_RM : Number.isFinite(durIn) && durIn > 0 ? durIn : READ_IN;
      // r84: đường cong theo cài đặt; đang nhích vào → đi tiếp từ đúng chỗ + đúng vận tốc (số hạng k·t(1 − t)²: đạo hàm lúc đầu = k,
      // bằng 0 ở hai đầu)
      const E = EASE_INOUT[topt(getSettings(), 'readerEaseIn')];
      let curve = E;
      const tw = S.camTw;
      if (creep.on && tw?.kind === 'creep' && !reduceMotion) {
        const h = 1e-3;
        const sc = tw.curve(tw.t);
        const vs = (tw.curve(Math.min(1, tw.t + h)) - tw.curve(Math.max(0, tw.t - h))) / (2 * h) / tw.dur; // quãng / s
        const k = Math.min(0.8, Math.max(0, (vs * dur) / Math.max(0.05, 1 - sc)));
        curve = (t) => E(t) + k * t * (1 - t) * (1 - t);
        R.creepK = { s: +sc.toFixed(4), v: +vs.toFixed(4), k: +k.toFixed(4) };
      } else R.creepK = null;
      creep.on = false;
      S.creepOn = false;
      S.camTw = beginCamTween('read', dur, curve, false);
      R.t0 = performance.now();
      return dur;
    },
    /**
     * r78: nguồn cuộn DUY NHẤT — fn(dt) → { k } (bộ tích phân của lớp đọc, bước đúng một lần mỗi khung, ngay trước khi đặt camera).
     * null = thôi.
     */
    readSetSource(fn) {
      R.source = typeof fn === 'function' ? fn : null;
    },
    /** r78: hình học tấm 3D (xem panelGeom) · null khi kiểu phẳng / chưa vào. */
    readPanel3D() {
      return R.mode === '3d' && S.readOn ? R.panel : null;
    },
    /** r78: ma trận thế giới của bia đang đọc (khay bia) — lớp đọc gắn tấm 3D theo nó. */
    readFrame() {
      if (!S.live) return null;
      S.live.lift.updateWorldMatrix(true, false);
      return S.live.lift.matrixWorld;
    },
    /** r78: độ đậm bóng tấm trên mặt đá 0..1 (lớp đọc lái theo độ hiện của tấm). */
    readShadow(k) {
      R.shadowK = Math.min(1, Math.max(0, Number(k) || 0));
    },
    /**
     * r82b: đường cắt dưới của tấm đọc lúc trượt (tấm không bao giờ vẽ lên đầu rùa / mai — camera còn xa thì đáy tấm lọt khung):
     * điểm CAO NHẤT trên màn của (a) hộp đầu rùa (cầu đầu × HEAD_K — đúng hộp mà luật camera giữ dưới mép khung lúc đọc) và (b)
     * chân mặt bia (khung mặt). Lúc nghỉ cả hai luôn ở dưới mép khung (luật của solve) → đường cắt ngoài khung, tấm như cũ.
     * (Đáy ô chữ face-fields y0 KHÔNG dùng: lúc đọc Đề danh nó còn trong khung — cắt ở đó đổi dáng tấm lúc nghỉ.)
     * Trả { screenY (px client, camera hiện tại), panelY (cao độ trên MẶT PHẲNG TẤM 3D che đúng điểm đó — toạ độ bia) } | null.
     */
    readFaceCut() {
      if (!S.live) return null;
      const B = K.bounds;
      const F = K.scanFrame?.() ?? { left: B.slabL, right: B.slabR, bottom: B.bandBottom, top: B.yMax };
      const zF = B.zFront;
      const lift = S.live.lift;
      lift.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const cr = cRect();
      _t.copy(camera.position);
      lift.worldToLocal(_t);
      const zP = R.panel ? R.panel.z : zF;
      let screenY = Infinity;
      let panelY = -Infinity;
      const take = (x, y, z) => {
        _c.set(x, y, z).applyMatrix4(lift.matrixWorld).project(camera);
        if (_c.z > 1) return; // sau camera
        screenY = Math.min(screenY, cr.top + ((1 - _c.y) / 2) * cr.height);
        const dz = z - _t.z;
        if (Math.abs(dz) > 1e-6) panelY = Math.max(panelY, _t.y + ((y - _t.y) * (zP - _t.z)) / dz);
      };
      take((F.left + F.right) / 2, F.bottom, zF);
      for (const [x, y, z] of headPoints(S.live.head)) take(x, y, z);
      return Number.isFinite(screenY) && Number.isFinite(panelY) ? { screenY, panelY } : null;
    },
    /** r82: tấm 3D đang hạ thấp dy (đơn vị bia, dọc trục đứng của bia; 0 = ở chỗ nghỉ) — bóng tấm trên đá dời theo. */
    readSlide(dy) {
      const v = Math.max(0, Number(dy) || 0);
      if (v === R.slide) return;
      R.slide = v;
      shadowStep(); // lớp đọc gọi ngay trước lượt vẽ của khung này → bóng cùng khung với tấm
    },
    /**
     * r78: tiến độ đoạn camera vào / ra — { kind, t, dur } | null. t = tiến độ THỜI GIAN 0..1 (tuyến tính; camera đi theo
     * easeInOutCubic(t)). r82: đồng hồ chung của nhịp tấm trượt / chữ hiện (reader.js) và các móc 'reader:*'.
     */
    readTween() {
      const k = S.camTw?.kind;
      return k === 'read' || k === 'read-out' ? { kind: k, t: S.camTw.t, dur: S.camTw.dur, curve: S.camTw.curve } : null;
    },
    /** Ô tấm đọc đổi (đổi cỡ khung) → giải lại. Trả hình học tấm 3D mới (hoặc null). */
    readLayout(rect, { archRise } = {}) {
      if (!S.readOn || !rect) return null;
      R.rect = rect;
      if (Number.isFinite(archRise)) R.archRise = archRise;
      solve();
      fitGap(R.gapWant ?? R.gap);
      R.panel = panelGeom();
      computeGoal();
      return R.panel;
    },
    /** Rời khung đọc → camera về khung đích thường (focus / nghỉ). Trả thời lượng (s). */
    readExit({ dur: durOut } = {}) {
      if (!S.readOn) return 0;
      S.readOn = false;
      S.readGoalOk = false;
      controls.enabled = true;
      killInertia();
      const dur = reduceMotion ? READ_OUT_RM : Number.isFinite(durOut) && durOut > 0 ? durOut : READ_OUT;
      if (!S.tx) S.camTw = beginCamTween('read-out', dur, EASE_INOUT[topt(getSettings(), 'readerEaseOut')], false);
      return dur;
    },
    get reading() {
      return S.readOn;
    },
    /** Kiểm thử: lời giải + hình chiếu hiện tại (px client) của đỉnh vòm, chân mặt bia, hộp đầu rùa, hai mép mặt bia. */
    readProbe() {
      const s = R.sol;
      if (!S.live) return null;
      const cr = cRect();
      const B = K.bounds;
      const F = K.scanFrame?.() ?? { left: B.slabL, right: B.slabR, bottom: B.bandBottom, top: B.yMax };
      const lift = S.live.lift;
      lift.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const scr = (x, y, z) => {
        _c.set(x, y, z).applyMatrix4(lift.matrixWorld).project(camera);
        return { x: +(cr.left + ((_c.x + 1) / 2) * cr.width).toFixed(1), y: +(cr.top + ((1 - _c.y) / 2) * cr.height).toFixed(1), behind: _c.z > 1 };
      };
      const zF = B.zFront;
      const cx = (F.left + F.right) / 2;
      let headBox = null;
      {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y, z] of headPoints(S.live.head)) {
          const q = scr(x, y, z);
          if (q.behind) continue;
          x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
        }
        if (Number.isFinite(x0)) headBox = { x0: +x0.toFixed(1), x1: +x1.toFixed(1), y0: +y0.toFixed(1), y1: +y1.toFixed(1) };
      }
      // mai rùa trong khung: bắn tia qua dải dưới mép tấm (giữa tấm ± 30 %, 3 hàng) — có tia trúng rùa (dưới chân mặt bia,
      // trước mặt phẳng trước) là thấy mai
      let shell = 0;
      if (raycaster && R.rect) {
        const pb = R.rect.y + R.rect.h;
        const inv = _m.copy(lift.matrixWorld).invert();
        for (const fy of [0.35, 0.65, 0.92])
          for (const fx of [-0.3, -0.15, 0, 0.15, 0.3]) {
            const px = R.rect.x + R.rect.w * (0.5 + fx);
            const py = pb + (cr.top + cr.height - pb) * fy;
            _n.set(((px - cr.left) / cr.width) * 2 - 1, 1 - ((py - cr.top) / cr.height) * 2);
            raycaster.setFromCamera(_n, camera);
            const hits = raycaster.intersectObject(S.live.inst, true);
            if (!hits.length) continue;
            const q = _c.copy(hits[0].point).applyMatrix4(inv);
            if (q.y < F.bottom - 0.004) shell++;
          }
      }
      _t.copy(camera.position);
      lift.worldToLocal(_t);
      return {
        on: S.readOn,
        creep: creep.on,
        creepK: R.creepK ?? null,
        tw: S.camTw?.kind ?? null,
        twT: S.camTw ? +S.camTw.t.toFixed(4) : null,
        twDur: S.camTw ? S.camTw.dur : null,
        slide: +R.slide.toFixed(5),
        k: +R.k.toFixed(4),
        kf: +R.kf.toFixed(4),
        mode: R.mode,
        panel: R.panel ? { ...R.panel } : null,
        shadow: (() => {
          const u = S.live?.polish?.uniforms;
          return u ? { a: u.uPanelSh.value.toArray().map((v) => +v.toFixed(4)), b: u.uPanelSh2.value.toArray().map((v) => +v.toFixed(4)), k: +u.uPanelSh3.value.x.toFixed(3) } : null;
        })(),
        // r78: hình chiếu mép trên / mép phải của tấm 3D và của bóng nó trên mặt đá — thị sai thật: khoảng lệch đổi khi camera đi
        edges: (() => {
          const u = S.live?.polish?.uniforms;
          const g = R.panel;
          if (!g || !u || !(u.uPanelSh3.value.x > 0)) return null;
          const [cx0, hw, top] = u.uPanelSh.value.toArray();
          const [, sx, sy] = u.uPanelSh2.value.toArray();
          const zf = u.uPanelSh3.value.y;
          const my = top - 0.25 * (top - g.bottom);
          return {
            panelTop: scr(cx0, top, g.z), shadowTop: scr(cx0 - sx, top - sy, zf),
            panelRight: scr(cx0 + hw, my, g.z), shadowRight: scr(cx0 + hw - sx, my - sy, zf),
          };
        })(),
        fov: +camera.fov.toFixed(3),
        fov0: +R.fov0.toFixed(3),
        sol: s && { d: +s.d.toFixed(4), y0: +s.y0.toFixed(4), y1: +s.y1.toFixed(4), fov: s.fov, ok: s.ok, why: s.why },
        camLocal: { x: +_t.x.toFixed(4), y: +_t.y.toFixed(4), z: +_t.z.toFixed(4) },
        gap: R.gap != null ? +R.gap.toFixed(4) : null, // r88: khoảng tấm đọc 3D – mặt bia (đơn vị bia)
        apex: scr(cx, F.top, zF),
        faceBottom: scr(cx, F.bottom, zF),
        left: scr(F.left, (F.top + F.bottom) / 2, zF),
        right: scr(F.right, (F.top + F.bottom) / 2, zF),
        head: headBox,
        shell,
        rect: R.rect,
        view: { w: cr.width, h: cr.height },
      };
    },
    /** DEV / kiểm thử: bộ bám tới đích ngay (không chờ). */
    readSnap() {
      if (!S.readOn) return;
      R.kf = R.k;
      computeGoal();
      if (S.camTw?.kind === 'read') S.camTw = null;
      camera.position.copy(readGoal.pos);
      controls.target.copy(readGoal.target);
      camera.fov = R.fov;
      camera.updateProjectionMatrix();
    },
  };
  return { readGoal, readStep, api };
}
