// Sân khấu Điện ảnh › camera: khung mặc định + khung xin riêng, hover (vòng chính diện, zoom, dời), tween, vùng giữ hover.
//
// OrbitControls + giới hạn khoảng cách; camera tự về khung khi rảnh; người dùng cầm camera (markInteraction) thì thôi lái.
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): distRelax, framingRect, canvasRect, fitMix, devLatchOff, press, frameDt, angleNow, devRayMode
// Đọc / ghi S của nơi khác: viewAz, hoverFront, hoverZoom, zoomEff, zoomGuard, effAz, yawNow, camTw, pedestalOn, fresnelRef, pointerActive,
//   handActive, frameNo, metricsCache, source, userMoved, homing, lastInteract, autoRotate, vw, vh, live, tx, cur,
//   rubOn, rubGoalOk
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { computeFrame } from '../../../core/frame.js';
import { DEFAULTS } from '../../../core/settings.js';
import { hasBVH } from '../bvh.js';
import {
  ANG_FULL, ANG_ZERO, AZIMUTH, ELEVATION, HOVER_FADE, HOVER_ORBIT, HOVER_RETURN, LATCH_PAD_BOT, LATCH_PAD_X,
  LATCH_PAD_Y, LINE_Y, PADDING, PLANE_EPS, PROFILE_BINS, RING, SAFE_BOTTOM_TALL, SAFE_BOTTOM_WIDE, SAFE_SIDE,
  SAFE_TOP, SAFE_TOP_TALL, SLAB_HI, SLAB_LO, STACK_W, STELE_X, SWAY_A, TOP_BAR_CLEAR, clampNum, easeInOutCubic,
  easeLeave, schlick
} from './config.js';

export function installCamera(S, K, deps) {
  const {
    STELE_BOT_NDC, STELE_TOP_NDC, _hnd, _mv, _ndc, camera, holder, homeBand, homeNdc, liftY, lifts, noteFoot, orbit,
    pedestals, planes, raycaster, reduceMotion, renderer, steleNdc, topInset, viewTw, viewYaw
  } = deps;

  // Camera "nháp": chỉ dùng để chiếu bóng của khối lên màn hình khi canh khung.
  const probe = new THREE.PerspectiveCamera(38, 1, 0.01, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.6;
  controls.minPolarAngle = THREE.MathUtils.degToRad(42);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(96);

  // r44g — ZOOM BẰNG TAY MƯỢT NHƯ NHÓN KÉO XOAY. Lớp cử chỉ (zoom sâu: đưa tay ra / vào lúc nhón) phát mỗi khung camera
  // (~30 / s) MỘT wheel TỔNG HỢP theo mức đổi cỡ bàn tay. OrbitControls áp dolly của wheel NGAY và TRỌN trong một update —
  // không có quán tính như xoay (xoay: pointermove dồn vào sphericalDelta, damping nhả dần mỗi khung vẽ) → khoảng cách
  // camera đứng yên ở ~nửa số khung vẽ rồi nhảy một bậc mỗi khung tay (đo trên camera giả, hand2 33–47 s: 59 % tick đứng
  // yên trong lúc zoom, nhón kéo xoay 6,5 %). Ở đây wheel TỔNG HỢP (isTrusted = false: lớp cử chỉ, mô phỏng) không đổi
  // bán kính ngay mà dồn vào handZoom.pend (log bán kính, cùng công thức _getZoomScale); mỗi update nhả dần theo THỜI GIAN
  // thật (hằng số HAND_ZOOM_TAU) → camera đi liền mạch giữa hai khung tay, đủ tổng như cũ. Lăn chuột / bàn di THẬT: y
  // như cũ. Chạm biên min / maxDistance thì bỏ phần còn dồn (không "dính" ở biên).
  const HAND_ZOOM_TAU = (import.meta.env.DEV && Number(new URLSearchParams(location.search).get('handZoomTau'))) || 0.09;
  // r76: lăn chuột / bàn di THẬT cũng không nhảy bậc nữa (người dùng: tấm sơn mài ẩn khi zoom "cắt quá gắt" — một nấc lăn
  // đưa camera tới ngay trong MỘT khung, độ hiện theo khung camera nhảy theo). Mỗi nấc dồn vào wheel.pend, camera đi theo bằng lò
  // xo tắt dần tới hạn (WHEEL_W rad/s — xong ~95 % sau ~160 ms, khởi đầu êm từ vận tốc 0) → mọi thứ theo khung camera (độ hiện
  // tấm, vùng giữ hover…) đi liền qua nhiều khung. Nhón / đưa tay (wheel tổng hợp) giữ nguyên nhịp HAND_ZOOM_TAU.
  const WHEEL_W = (import.meta.env.DEV && Number(new URLSearchParams(location.search).get('wheelW'))) || 30;
  const handZoom = { pend: 0, t: performance.now() };
  const wheelZoom = { pend: 0, v: 0 };
  const baseCustomWheel = controls._customWheelEvent.bind(controls);
  controls._customWheelEvent = (e) => {
    const ev = baseCustomWheel(e);
    ev.smooth = e.isTrusted === false;
    return ev;
  };
  const baseMouseWheel = controls._handleMouseWheel.bind(controls);
  controls._handleMouseWheel = (ev) => {
    if (!ev.deltaY) return baseMouseWheel(ev);
    // deltaY < 0: bán kính × s (s = 0,95^(zoomSpeed·|deltaY|/100) < 1) · deltaY > 0: bán kính ÷ s
    const d = Math.sign(ev.deltaY) * -Math.log(controls._getZoomScale(ev.deltaY));
    if (ev.smooth) handZoom.pend += d;
    else wheelZoom.pend += d; // r76: lăn chuột thật — lò xo (xem WHEEL_W)
    controls.update();
  };
  const baseUpdate = controls.update.bind(controls);
  controls.update = (deltaTime = null) => {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - handZoom.t) / 1000));
    handZoom.t = now;
    // như stage.tick với _scale: đang nhấn chưa kéo quá ngưỡng / đang bay về sau khi xoa → không zoom theo tay / bánh xe
    if ((handZoom.pend !== 0 || wheelZoom.pend !== 0 || wheelZoom.v !== 0) && ((S.press && !S.press.took) || S.camTw?.kind === 'rub-out')) {
      handZoom.pend = 0;
      wheelZoom.pend = wheelZoom.v = 0;
    }
    if (handZoom.pend === 0 && wheelZoom.pend === 0 && wheelZoom.v === 0) return baseUpdate(deltaTime);
    let step = 0;
    if (handZoom.pend !== 0) {
      let hs = handZoom.pend * (1 - Math.exp(-dt / HAND_ZOOM_TAU));
      if (Math.abs(handZoom.pend - hs) < 1e-4) hs = handZoom.pend;
      handZoom.pend -= hs;
      step += hs;
    }
    if (wheelZoom.pend !== 0 || wheelZoom.v !== 0) {
      // lò xo tắt dần tới hạn trên phần còn lại (log bán kính), bước con ≤ 1/240 s
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      let ws = 0;
      for (let i = 0; i < n; i++) {
        wheelZoom.v += (WHEEL_W * WHEEL_W * wheelZoom.pend - 2 * WHEEL_W * wheelZoom.v) * h;
        const d = wheelZoom.v * h;
        wheelZoom.pend -= d;
        ws += d;
      }
      if (Math.abs(wheelZoom.pend) < 2e-4 && Math.abs(wheelZoom.v) < 5e-3) {
        ws += wheelZoom.pend;
        wheelZoom.pend = wheelZoom.v = 0;
      }
      step += ws;
    }
    const r0 = camera.position.distanceTo(controls.target);
    controls._scale *= Math.exp(step);
    const out = baseUpdate(deltaTime);
    const r1 = camera.position.distanceTo(controls.target);
    if (r0 > 0 && Math.abs(Math.log(r1 / r0) - step) > 1e-6) {
      handZoom.pend = 0; // min / maxDistance đã kẹp
      wheelZoom.pend = wheelZoom.v = 0;
    }
    return out;
  };
  // Giới hạn khoảng cách của OrbitControls đi qua MỘT chỗ: khung mặc định / khung xin riêng đặt giá trị gốc,
  // chế độ xoa đầu rùa nới minDistance (camera cận đầu rùa gần hơn nhiều) — đặt lại giá trị gốc lúc đang ở chế
  // độ đó (đổi cỡ khung…) không được kéo camera ra xa.
  const distBase = { min: 0, max: Infinity };
  S.distRelax = 0; // > 0: minDistance nới tới ngần này (chế độ xoa)
  function applyDistLimits() {
    controls.minDistance = S.distRelax > 0 ? Math.min(distBase.min, S.distRelax) : distBase.min;
    controls.maxDistance = distBase.max;
  }
  function setDistLimits(min, max) {
    distBase.min = min;
    distBase.max = max;
    applyDistLimits();
  }

  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 2 };
  // Khung mặc định tính ở CHÍNH DIỆN (computeHome) — home = khung này xoay quanh trục bia một góc viewAz.
  const home0 = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  /** @type {{x:number,y:number,w:number,h:number}|null} ô đích của kiểu hiện thông tin, px CSS của khung nhìn */
  S.framingRect = null;
  const _yAxis = new THREE.Vector3(0, 1, 0);
  /**
   * Khung đích hiện tại = khung chính diện (home0) xoay quanh trục bia một góc effAz: góc mặc định
   * (viewAz), kéo dần về 0 khi hover (orbitU, nếu bật cinemaHoverFront). Cả cụm bục + bia KHÔNG xoay.
   */
  function applyHomeAz() {
    const f = S.hoverFront ? orbit.f : 0;
    S.effAz = S.viewAz * (1 - f);
    home.target.copy(home0.target).applyAxisAngle(_yAxis, S.effAz);
    // zoom khi hover: tiến dọc hướng nhìn, khoảng cách × (1 − zoomEff × f)
    home.pos.copy(home0.pos).sub(home0.target).multiplyScalar(1 - S.zoomEff * f).applyAxisAngle(_yAxis, S.effAz).add(home.target);
    // r27z: zoom lớn → cả khung (tâm nhìn + camera) dời LÊN vừa đủ để đỉnh bia còn dưới STELE_TOP_NDC; phần bị cắt rơi
    // xuống bục / sàn. Liên tục theo f (không giật khi vào / ra hover, cả khi rời giữa chừng).
    const lift = zoomLift(S.zoomEff * f);
    if (lift > 0) {
      home.target.y += lift;
      home.pos.y += lift;
    }
    if (S.framingRect) computeFit();
  }
  /**
   * Mức zoom khi hover THỰC SỰ dùng với mức muốn z0 + phần kẹp đang giới hạn:
   *  (1) 'stele' — r27z: chỉ TẤM BIA (rùa + thân + đỉnh) phải còn trong dải an toàn của khung mặc định (bục / sàn được
   *      cắt ở dưới — khung dời lên theo zoom, zoomLift). Trước r27z kẹp theo cả bục (đáy bục ở NDC ≈ 0,9 → mọi mức trên
   *      ~7 % bị cắt về 7 %, thanh trượt "không tác dụng").
   *  (2) 'info' — kiểu thông tin đang hiện vẫn vừa vùng an toàn: tấm bình phong / cột chữ ánh sáng (extent — nửa bề ngang,
   *      đơn vị mặt phẳng) + lề 28 px;
   *  (3) 'framing' — "Trang triển lãm" tự xin khung → zoom 0.
   */
  function zoomCap(z0) {
    let z = z0;
    let by = null;
    if (!(z > 0)) return { z: 0, by: null };
    const lim = (v, why) => {
      if (v < z) {
        z = v;
        by = why;
      }
    };
    if (steleNdc.ok) {
      // đỉnh bia: quanh NDC 0,94 (zoomLift lo — giữa mép trên trống); đáy rùa: trong KHUNG (NDC ≥ −0,94), được xuống
      // dưới dải an toàn dưới (dòng thời gian mờ, tự ẩn); ngang: trong dải an toàn hai bên. Đo THẬT bằng camera thử ở khung
      // chính diện đã zoom + dời (phối cảnh: đáy rùa gần camera phóng mạnh hơn tâm nhìn — ước lượng tuyến tính hụt ~0,09 NDC)
      // rồi chia đôi tìm mức lớn nhất còn vừa.
      const fits = (zz) => {
        const e = steleExtentAt(zz);
        return e.b >= -STELE_BOT_NDC && e.t <= Math.max(homeBand.top, STELE_TOP_NDC) + 0.03 && e.x <= homeBand.x;
      };
      if (!fits(z)) {
        let lo = 0;
        let hi = z;
        for (let i = 0; i < 14; i++) {
          const m = (lo + hi) / 2;
          if (fits(m)) lo = m;
          else hi = m;
        }
        lim(lo, 'stele');
      }
    } else {
      if (homeNdc.y > 0) lim(1 - homeNdc.y / 0.97, 'stele');
      if (homeNdc.x > 0) lim(1 - homeNdc.x / 0.97, 'stele');
    }
    const g = S.zoomGuard?.();
    if (g?.framing) return { z: 0, by: 'framing' };
    const M = livePlane().M;
    if (g && Number.isFinite(g.extent) && g.extent > 0 && M) {
      const halfWorld = (S.vw * 0.5) * M.worldPerPx; // nửa bề ngang khung ở độ sâu mặt phẳng, khung mặc định
      lim(1 - (g.extent + 28 * M.worldPerPx) / halfWorld, 'info');
    }
    return { z: Math.max(0, z), by };
  }
  function zoomLimit() {
    return zoomCap(S.hoverZoom).z;
  }
  const _zt = new THREE.Vector3();
  /** r27z: biên NDC của tấm bia (đỉnh, đáy rùa, nửa bề ngang) nhìn từ khung chính diện đã zoom z + dời zoomLift(z). */
  function steleExtentAt(z) {
    probe.aspect = camera.aspect;
    probe.fov = camera.fov;
    _zt.copy(home0.target);
    _zt.y += zoomLift(z);
    probe.position.copy(home0.pos).sub(home0.target).multiplyScalar(1 - z).add(_zt);
    probe.near = 0.01;
    probe.far = 100;
    probe.updateProjectionMatrix();
    probe.lookAt(_zt);
    probe.updateMatrixWorld(true);
    let t = -Infinity;
    let b = Infinity;
    let x = 0;
    for (let i = 0; i < _pts.length; i++) {
      if (i % 4 > 1) continue;
      _corner.copy(_pts[i]).project(probe);
      if (_corner.y > t) t = _corner.y;
      if (_corner.y < b) b = _corner.y;
      if (Math.abs(_corner.x) > x) x = Math.abs(_corner.x);
    }
    return { t, b, x };
  }
  /**
   * r27z: độ dời LÊN (đơn vị thế giới, cả tâm nhìn lẫn camera) ở mức zoom zf để đỉnh bia còn dưới STELE_TOP_NDC:
   * điểm có NDC y ở khung mặc định → (y − p) / (1 − zf) sau zoom + dời p (NDC ở độ sâu tâm nhìn) → p nhỏ nhất =
   * đỉnh bia − đỉnh dải × (1 − zf); 0 khi còn chỗ (zoom nhỏ: khung như cũ). Đáy rùa còn trong dải nhờ zoomCap (1).
   */
  function zoomLift(zf) {
    if (!steleNdc.ok || !(zf > 0)) return 0;
    const p = steleNdc.top - Math.max(homeBand.top, STELE_TOP_NDC) * (1 - zf);
    return p > 0 ? (p * homeBand.dist * homeBand.halfTan) / homeBand.cosEl : 0;
  }
  /** Một bước hover-camera: đổi đích → đoạn mới khớp vị trí + vận tốc hiện có. */
  function orbitStep(dt, want) {
    if (want !== orbit.want) {
      orbit.want = want;
      const D = reduceMotion ? HOVER_FADE.reduced : want ? HOVER_ORBIT : HOVER_RETURN;
      orbit.seg = { f0: orbit.f, v0: orbit.v, target: want, D, t: 0, curve: want ? easeInOutCubic : easeLeave };
      orbit.segs++; // DEV: số lần đổi hướng vòng hover (cinemaCamTrace)
      if (want) S.zoomEff = zoomLimit(); // chốt mức zoom lúc bắt đầu vào (kiểu thông tin đã biết)
    }
    const sg = orbit.seg;
    if (!sg) return false;
    sg.t = Math.min(sg.D, sg.t + dt);
    const tau = sg.t / sg.D;
    // vị trí theo đường cong + số hạng khớp vận tốc lúc bắt đầu (c(0) = 0, c'(0) = 1, c(1) = c'(1) = 0)
    let f = sg.f0 + (sg.target - sg.f0) * sg.curve(tau) + sg.v0 * sg.D * tau * (1 - tau) * (1 - tau);
    f = Math.min(1, Math.max(0, f));
    orbit.v = dt > 0 ? (f - orbit.f) / dt : 0;
    orbit.f = f;
    if (tau >= 1) {
      orbit.seg = null;
      orbit.f = sg.target;
      orbit.v = 0;
    }
    return true;
  }
  /**
   * Nhóm viewYaw quay theo phương vị THẬT của camera quanh trục bia → trục X của hai khay (hướng lướt /
   * trượt khi chuyển cảnh) luôn là trục ngang của khung hình, kể cả khi người dùng đang xoay tay tới 60°.
   * Bia + bục xoay ngược lại đúng góc đó (bục thêm cả góc lắc) → cả cụm đứng yên trong thế giới; lúc
   * không chuyển cảnh hai khay ở gốc toạ độ nên phép quay này không thấy được.
   */
  function syncYaw() {
    S.yawNow = Math.atan2(camera.position.x, camera.position.z);
    viewYaw.rotation.y = S.yawNow;
    for (let i = 0; i < 2; i++) {
      lifts[i].rotation.y = -S.yawNow;
      pedestals[i].group.rotation.y = -holder.rotation.y - S.yawNow;
    }
  }
  /**
   * settings.cinemaViewAngle → góc đích. Lần đầu (mount) áp ngay; về sau trôi VIEW_TWEEN giây
   * (easeInOutCubic) từ góc đang có — camera đi theo khung chỉ khi người dùng không tự xoay.
   */
  let viewAzInit = false;
  function setViewAngle(deg) {
    const to = THREE.MathUtils.degToRad(clampNum(Number(deg), -45, 45, DEFAULTS.cinemaViewAngle));
    if (!viewAzInit) {
      viewAzInit = true;
      S.viewAz = viewTw.from = viewTw.to = to;
      viewTw.t = 1;
      applyHomeAz();
      return;
    }
    if (Math.abs(to - viewTw.to) < 1e-6) return;
    viewTw.from = S.viewAz;
    viewTw.to = to;
    viewTw.t = reduceMotion ? 1 : 0;
    if (reduceMotion) {
      S.viewAz = to;
      applyHomeAz();
      if (!S.userMoved) snapHome();
    }
  }

  /** Đo hộp bao của bản gốc (chưa vào cảnh nên ma trận là cục bộ). */
  /**
   * r21: số đo phiến + dấu chân của một bia (quét đỉnh — ~5–7 ms với LOD0) — tính MỘT lần mỗi bia (id) và nhớ lại;
   * gọi được sẵn lúc rảnh (premeasure / preheat) để present() không phải quét giữa lúc bấm chuyển.
   */
  function slabOf(obj, b = null) {
    const slabKey = obj.userData?.proxyOf ?? obj.name ?? obj;
    let slab = K.slabCache.get(slabKey);
    if (slab) return slab;
    b ??= new THREE.Box3().setFromObject(obj);
    if (b.isEmpty() || !isFinite(b.min.x)) return null;
    const rx = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
    const yMin = b.min.y;
    const yMax = Math.max(b.min.y + 0.05, b.max.y);
    const xHalf = Math.max(0.05, rx);
    const r0 = Math.max(0.05, Math.hypot(rx, Math.max(Math.abs(b.min.z), Math.abs(b.max.z))));
    const h = yMax - yMin;
    const lo = yMin + SLAB_LO * h;
    const hi = yMin + SLAB_HI * h;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const pMin = new Float32Array(PROFILE_BINS).fill(Infinity);
    const pMax = new Float32Array(PROFILE_BINS).fill(-Infinity);
    const qMin = new Float32Array(PROFILE_BINS).fill(Infinity); // bề dày (z) từng lát
    const qMax = new Float32Array(PROFILE_BINS).fill(-Infinity);
    // Dấu chân trên sàn: tâm hộp bao (x, z) + khoảng cách ngang xa nhất tới tâm đó (mọi cao độ,
    // kể cả đầu/đuôi rùa). Vòng quay CÙNG bia (con của holder) nên không cần tính cả biên độ lắc.
    const fcx = (b.min.x + b.max.x) / 2;
    const fcz = (b.min.z + b.max.z) / 2;
    let fr2 = 0;
    let sw2 = 0; // bán kính QUÉT quanh trục lắc (gốc toạ độ) — cỡ bục
    let bs2 = 0; // như trên nhưng chỉ phần CHÂN (3% dưới cùng) — phải nằm gọn trong lòng bục
    const footY = yMin + 0.03 * h;
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      const pos = o.isMesh ? o.geometry?.attributes?.position : null;
      if (!pos) return;
      const step = Math.max(1, Math.floor(pos.count / 60000)); // ≤ 60k mẫu mỗi mesh
      for (let i = 0; i < pos.count; i += step) {
        _slab.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const bin = Math.min(PROFILE_BINS - 1, Math.max(0, Math.floor(((_slab.y - yMin) / h) * PROFILE_BINS)));
        if (_slab.x < pMin[bin]) pMin[bin] = _slab.x;
        if (_slab.x > pMax[bin]) pMax[bin] = _slab.x;
        if (_slab.z < qMin[bin]) qMin[bin] = _slab.z;
        if (_slab.z > qMax[bin]) qMax[bin] = _slab.z;
        const dx = _slab.x - fcx;
        const dz = _slab.z - fcz;
        if (dx * dx + dz * dz > fr2) fr2 = dx * dx + dz * dz;
        const r2 = _slab.x * _slab.x + _slab.z * _slab.z;
        if (r2 > sw2) sw2 = r2;
        if (_slab.y < footY && r2 > bs2) bs2 = r2;
        if (_slab.y < lo || _slab.y > hi) continue;
        if (_slab.x < x0) x0 = _slab.x;
        if (_slab.x > x1) x1 = _slab.x;
        if (_slab.z < z0) z0 = _slab.z;
        if (_slab.z > z1) z1 = _slab.z;
      }
    });
    slab = isFinite(x0) ? { l: x0, r: x1, z: z1, zb: z0 } : { l: -xHalf, r: xHalf, z: b.max.z, zb: b.min.z };
    Object.assign(slab, bandOf(pMin, pMax, qMin, qMax, slab.r - slab.l, isFinite(z0) ? z1 - z0 : 0.15, yMin, h));
    slab.foot = {
      cx: fcx,
      cz: fcz,
      r: fr2 > 0 ? Math.sqrt(fr2) : r0,
      swept: sw2 > 0 ? Math.sqrt(sw2) : r0,
      base: bs2 > 0 ? Math.sqrt(bs2) : r0,
    };
    K.slabCache.set(slabKey, slab);
    noteFoot(obj.userData?.proxyOf ?? obj.name, slab.foot);
    return slab;
  }

  function measure(obj) {
    const b = new THREE.Box3().setFromObject(obj);
    if (b.isEmpty() || !isFinite(b.min.x)) return;
    const rx = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
    const rz = Math.max(Math.abs(b.min.z), Math.abs(b.max.z));
    K.bounds.r = Math.max(0.05, Math.hypot(rx, rz));
    K.bounds.yMin = b.min.y;
    K.bounds.yMax = Math.max(b.min.y + 0.05, b.max.y);
    K.bounds.xHalf = Math.max(0.05, rx);
    K.bounds.box.copy(b);

    // Mặt trước + hai mép THÂN BIA: chỉ quét đỉnh trong dải 45–80% chiều cao, để đầu
    // rùa chìa ra phía trước không kéo mặt phẳng ra xa, và mép rùa rộng hơn không
    // làm lệch khe hở hai bên. Cùng lượt quét đó dựng luôn hồ sơ bề ngang theo từng lát
    // cao độ, từ đó dò ra vai vòm (bandTop) và chân phiến (bandBottom). (r21: slabOf — nhớ theo id bia.)
    const slab = slabOf(obj, b);
    if (!slab) return;
    K.bounds.slabL = slab.l;
    K.bounds.slabR = slab.r;
    K.bounds.zFront = slab.z;
    K.bounds.bandTop = slab.top;
    K.bounds.bandBottom = slab.bottom;
    K.bounds.zBack = slab.zb;
    K.bounds.profile = slab.profile;
    K.bounds.hitSlab.min.set(slab.l, slab.bottom, slab.zb);
    K.bounds.hitSlab.max.set(slab.r, K.bounds.yMax, slab.z);
    K.bounds.hitBase.min.set(b.min.x, K.bounds.yMin, b.min.z);
    K.bounds.hitBase.max.set(b.max.x, slab.bottom, b.max.z);
    K.bounds.foot = slab.foot;
    S.metricsCache = null;
  }

  /**
   * Dải PHIẾN BIA theo cao độ, từ hồ sơ từng lát cắt ngang: đi từ giữa dải đo ra hai phía.
   *  · Đi LÊN: còn là phiến chừng nào bề NGANG lát ≈ bề ngang thân bia; vòm trán bia thu hẹp
   *    lại → dừng (vai vòm).
   *  · Đi XUỐNG: rùa đội bia ở Văn Miếu rộng xấp xỉ phiến theo chiều ngang nhưng DÀI hẳn theo
   *    chiều sâu (đầu → đuôi) → dừng khi bề DÀY lát vượt hẳn bề dày phiến (lưng rùa).
   */
  function bandOf(pMin, pMax, qMin, qMax, slabW, slabD, y0, h) {
    const width = (i) => (pMax[i] >= pMin[i] ? pMax[i] - pMin[i] : NaN);
    const depth = (i) => (qMax[i] >= qMin[i] ? qMax[i] - qMin[i] : NaN);
    const wide = (i) => width(i) >= slabW * 0.9 && width(i) <= slabW * 1.12;
    const thin = (i) => depth(i) <= slabD * 1.35;
    const binOf = (f) => Math.min(PROFILE_BINS - 1, Math.floor(f * PROFILE_BINS));
    let bot = binOf((SLAB_LO + SLAB_HI) / 2);
    while (bot > 0 && wide(bot - 1) && thin(bot - 1)) bot--;
    let top = binOf((SLAB_LO + SLAB_HI) / 2);
    while (top < PROFILE_BINS - 1 && wide(top + 1)) top++;
    const r3 = (v) => +v.toFixed(3);
    const profile = Array.from({ length: PROFILE_BINS }, (_, i) => [
      r3(width(i) / Math.max(1e-6, slabW)),
      r3(depth(i) / Math.max(1e-6, slabD)),
    ]);
    return {
      bottom: y0 + (bot / PROFILE_BINS) * h,
      top: y0 + ((top + 1) / PROFILE_BINS) * h,
      profile,
    };
  }

  const _v = new THREE.Vector3();
  const _slab = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  // Khi bàn xoay quay, khối quét thành một hình TRỤ chứ không phải hình hộp:
  // lấy vành trên + vành dưới của trụ mới ra đúng bóng trên màn hình
  // (dùng 8 đỉnh hộp sẽ thừa một hệ số √2 và đẩy camera ra xa oan).
  // Vành trụ quét của bia (2 × RING) + vành trên/dưới của bục (2 × RING).
  const _pts = Array.from({ length: RING * 4 }, () => new THREE.Vector3());

  /**
   * Tính lại khung camera mặc định (không đụng camera thật).
   * Lấy computeFrame(swept) làm mốc, rồi chiếu vành trụ quét lên màn hình và
   * nới/thu khoảng cách + nhích mục tiêu tới khi cả khối nằm gọn trong vùng an toàn —
   * kể cả phần phối cảnh phóng to của mặt gần (chân rùa chìa về phía camera).
   */
  const _right = new THREE.Vector3();
  const _corner = new THREE.Vector3();
  /**
   * Số đo bố cục mặt phẳng cho một độ sâu (camera → mặt phẳng, dọc hướng nhìn).
   * Mọi kích thước đều theo tỉ lệ khung hình ở đúng độ sâu đó.
   */
  function makeMetrics(depth, stacked) {
    const perH = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const h = K.bounds.yMax - K.bounds.yMin;
    return {
      stacked,
      // đơn vị thế giới ứng với 1 px màn hình, ĐÚNG ở độ sâu mặt phẳng tại khung mặc định
      worldPerPx: perH / Math.max(1, S.vh),
      lineY: K.bounds.yMin + LINE_Y * h,
      slabL: K.bounds.slabL,
      slabR: K.bounds.slabR,
      zFront: K.bounds.zFront,
    };
  }

  /** Đặt mặt phẳng nội dung của MỘT khay đúng mặt trước phiến bia của khay đó. */
  function placeSlot(sp) {
    if (sp.M) sp.group.position.set(0, 0, sp.M.zFront + PLANE_EPS);
  }

  /** Mặt phẳng của khay đang hiển thị. */
  const livePlane = () => planes[S.cur];
  /** Chỉ số khay mang mặt phẳng `pl` (-1 nếu không phải mặt phẳng khay nào). */
  const slotOfPlane = (pl) => (pl === planes[0].group ? 0 : pl === planes[1].group ? 1 : -1);

  /**
   * Tính lại khung camera mặc định (không đụng camera thật).
   * Lấy computeFrame(swept) làm mốc, rồi chiếu vành trụ quét + bốn góc tấm chữ số
   * lên màn hình và nới/thu khoảng cách + nhích mục tiêu tới khi cả cụm nằm gọn
   * trong vùng an toàn — kể cả phần phối cảnh phóng to của mặt gần.
   */
  function computeHome() {
    // HUD dưới xếp chồng (điện thoại dọc) thì chiếm nhiều chiều cao hơn → chừa dải rộng hơn.
    const stacked = S.vw <= STACK_W;
    const target = new THREE.Vector3();
    let dist;

    if (S.source) {
      const seed = computeFrame(camera, S.source, {
        padding: PADDING,
        azimuth: AZIMUTH,
        elevation: ELEVATION,
        swept: true,
      });
      target.copy(seed.target);
      target.y += liftY(); // computeFrame đo bản gốc (chưa nâng lên bục)
      _dir.copy(seed.position).sub(seed.target).normalize();
      dist = seed.distance;
    } else {
      target.set(0, (K.bounds.yMin + K.bounds.yMax) / 2, 0);
      _dir.set(
        Math.sin(AZIMUTH) * Math.cos(ELEVATION),
        Math.sin(ELEVATION),
        Math.cos(AZIMUTH) * Math.cos(ELEVATION),
      );
      dist = 2.2;
    }

    const L = liftY();
    // Bục của bia đang hiển thị (đứng yên, không lắc) cũng phải nằm gọn trong khung.
    const pedR = S.pedestalOn ? pedestals[S.cur].R : 0;
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      _pts[k * 4].set(K.bounds.r * c, K.bounds.yMin + L, K.bounds.r * sn);
      _pts[k * 4 + 1].set(K.bounds.r * c, K.bounds.yMax + L, K.bounds.r * sn);
      _pts[k * 4 + 2].set(pedR * c, 0, pedR * sn);
      _pts[k * 4 + 3].set(pedR * c, L, pedR * sn);
    }

    const xLim = 1 - SAFE_SIDE;
    // Màn dọc: hàng điều khiển trên chiếm nhiều chiều cao — lấy chiều cao ĐO ĐƯỢC của hàng đó
    // (không đoán) để đỉnh bia luôn nằm dưới nó TOP_BAR_CLEAR px.
    const topFrac = stacked
      ? THREE.MathUtils.clamp((topInset() + TOP_BAR_CLEAR) / Math.max(1, S.vh), SAFE_TOP_TALL, 0.3)
      : SAFE_TOP;
    const yTop = 1 - 2 * topFrac;
    const yBot = -1 + 2 * (stacked ? SAFE_BOTTOM_TALL : SAFE_BOTTOM_WIDE);
    const yMid = (yTop + yBot) / 2;
    const ySpan = yTop - yBot;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

    probe.aspect = camera.aspect;
    probe.fov = camera.fov;

    const place = () => {
      probe.position.copy(target).addScaledVector(_dir, dist);
      probe.near = Math.max(0.01, dist / 100);
      probe.far = dist * 20;
      probe.updateProjectionMatrix();
      probe.lookAt(target);
      probe.updateMatrixWorld(true);
      // Vector "sang phải" nằm ngang của khung hình.
      // Lưu ý: _dir hướng từ MỤC TIÊU RA camera, tức ngược hướng nhìn, nên phải đảo dấu.
      _right.set(_dir.z, 0, -_dir.x).normalize();
    };

    const lp = livePlane();
    const lineRef = K.bounds.yMin + LINE_Y * (K.bounds.yMax - K.bounds.yMin) + L;
    const metricsNow = () => {
      // độ sâu từ camera tới mặt phẳng, đo dọc hướng nhìn
      const d =
        (probe.position.x - 0) * _dir.x +
        (probe.position.y - lineRef) * _dir.y +
        (probe.position.z - K.bounds.zFront) * _dir.z;
      return makeMetrics(Math.max(0.1, d), stacked);
    };

    for (let it = 0; it < 8; it++) {
      place();
      let loX = Infinity;
      let hiX = -Infinity;
      let loY = Infinity;
      let hiY = -Infinity;
      let loS = Infinity; // riêng tấm bia — dùng để ghim tâm bố cục
      let hiS = -Infinity;
      const scan = (p) => {
        _corner.copy(p).project(probe);
        if (_corner.x < loX) loX = _corner.x;
        if (_corner.x > hiX) hiX = _corner.x;
        if (_corner.y < loY) loY = _corner.y;
        if (_corner.y > hiY) hiY = _corner.y;
      };
      for (const p of _pts) {
        scan(p);
        if (_corner.x < loS) loS = _corner.x;
        if (_corner.x > hiS) hiS = _corner.x;
      }

      // Ngang: đưa TÂM BIA tới mốc STELE_X, rồi mới xét xem có gì tràn vùng an toàn.
      const driftX = STELE_X * 2 - 1 - (loS + hiS) / 2;
      const driftY = yMid - (hiY + loY) / 2;
      const spanX = Math.max(Math.abs(loX + driftX), Math.abs(hiX + driftX)) / xLim;
      const scale = Math.max(spanX, (hiY - loY) / ySpan);
      target.addScaledVector(_right, -driftX * dist * halfTan * probe.aspect);
      target.y -= driftY * dist * halfTan;
      dist *= THREE.MathUtils.clamp(scale, 0.7, 1.7);
      if (Math.abs(scale - 1) < 0.004 && Math.abs(driftX) < 0.004 && Math.abs(driftY) < 0.004) break;
    }
    place();
    // Biên NDC của bia + bục ở khung mặc định (tâm nhìn chiếu vào (0, 0)) — giới hạn zoom khi hover.
    homeNdc.x = 0;
    homeNdc.y = 0;
    // r27z: riêng tấm bia (điểm 4k: đáy rùa, 4k+1: đỉnh — vành quét) + dải an toàn đã dùng để đặt khung này
    steleNdc.top = -Infinity;
    steleNdc.bot = Infinity;
    steleNdc.x = 0;
    for (let i = 0; i < _pts.length; i++) {
      _corner.copy(_pts[i]).project(probe);
      homeNdc.x = Math.max(homeNdc.x, Math.abs(_corner.x));
      homeNdc.y = Math.max(homeNdc.y, Math.abs(_corner.y));
      if (i % 4 < 2) {
        steleNdc.top = Math.max(steleNdc.top, _corner.y);
        steleNdc.bot = Math.min(steleNdc.bot, _corner.y);
        steleNdc.x = Math.max(steleNdc.x, Math.abs(_corner.x));
      }
    }
    steleNdc.ok = Number.isFinite(steleNdc.top) && Number.isFinite(steleNdc.bot) && steleNdc.top > steleNdc.bot;
    homeBand.top = yTop;
    homeBand.bot = yBot;
    homeBand.x = xLim;
    homeBand.dist = dist;
    homeBand.halfTan = halfTan;
    homeBand.cosEl = Math.max(0.2, Math.sqrt(Math.max(0, 1 - _dir.y * _dir.y)));

    // Mặt phẳng của khay đang hiển thị: áp NGAY. Khay đang rời đi giữ nguyên số đo riêng của nó
    // và ra khỏi khung cùng tấm bia của mình.
    const M = metricsNow();
    lp.M = M;
    lp.afFresh = true; // r19: bia mới trên khay → độ hiện theo góc lấy thẳng giá trị đích ở lần đo kế tiếp
    placeSlot(lp);

    home0.pos.copy(probe.position);
    home0.target.copy(target);
    home.dist = dist;
    // Fresnel lòng bục kính: góc nhìn xuống lòng bục ở khung mặc định là mốc (settings.reflection giữ nghĩa).
    _mv.set(0, S.pedestalOn ? pedestals[S.cur].lift : 0, 0);
    _mv.subVectors(probe.position, _mv);
    S.fresnelRef = schlick(_mv.y / Math.max(1e-6, _mv.length()));
    applyHomeAz(); // home = khung chính diện xoay quanh trục bia một góc effAz
    camera.near = probe.near;
    camera.far = probe.far;
    camera.updateProjectionMatrix();
    setDistLimits(dist * 0.5, dist * 1.75);
  }

  // ---- Khung theo yêu cầu của kiểu hiện thông tin (ctx.requestFraming) -----------------
  // Kiểu HUD có thể xin camera dời/zoom để tấm bia vừa khít một ô trên màn hình. Khung này
  // thay chỗ khung mặc định làm "đích về" (cả lúc tự trôi về sau khi người dùng xoay), cho
  // tới khi được trả lại bằng requestFraming(null).
  // framingRect ({x,y,w,h} px CSS | null): khai báo sớm cạnh home0 (applyHomeAz đọc nó ngay lượt cài đặt đầu).
  const fit = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 2 };
  const _fitPts = Array.from({ length: 32 }, () => new THREE.Vector3());
  S.canvasRect = null;
  const cRect = () => (S.canvasRect ??= renderer.domElement.getBoundingClientRect());
  // Khung xin riêng TRỘN DẦN với khung mặc định (fitMix 0..1): xin khung → vào HOVER_ORBIT easeInOutCubic, trả
  // khung → về HOVER_RETURN easeLeave — đúng nhịp camera hover / rời. Trước đây goal() đổi phắt giữa hai khung,
  // mà lúc camera đang vòng hover (homeDirty) camera đặt thẳng vào goal() mỗi khung → nhảy khoảng cách ngay
  // khung đầu khi "Trang triển lãm" hiện / ẩn.
  S.fitMix = 0;
  const fitTw = { from: 0, to: 0, t: 1, dur: 1, curve: easeInOutCubic };
  const fitWant = () => (S.framingRect && fit.active ? 1 : 0);
  const _goal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 2 };
  const goal = () => {
    if ((S.readOn || S.creepOn) && S.readGoalOk) return K.readGoal; // r74 khung đọc toàn văn (stage/read.js) · r84: + lúc nhích vào
    if (S.rubOn && S.rubGoalOk) return K.rubGoal;
    if (S.fitMix <= 0) return home;
    if (S.fitMix >= 1) return fit;
    _goal.pos.lerpVectors(home.pos, fit.pos, S.fitMix);
    _goal.target.lerpVectors(home.target, fit.target, S.fitMix);
    _goal.dist = home.dist + (fit.dist - home.dist) * S.fitMix;
    return _goal;
  };
  /** Một bước trộn khung xin riêng; true = đích camera vừa đổi. */
  function fitStep(dt) {
    const want = fitWant();
    if (want !== fitTw.to) {
      fitTw.from = S.fitMix;
      fitTw.to = want;
      fitTw.t = 0;
      fitTw.dur = reduceMotion ? 1e-3 : want ? HOVER_ORBIT : HOVER_RETURN;
      fitTw.curve = want ? easeInOutCubic : easeLeave;
    }
    if (fitTw.t >= 1) return false;
    fitTw.t = Math.min(1, fitTw.t + dt / fitTw.dur);
    S.fitMix = fitTw.from + (fitTw.to - fitTw.from) * fitTw.curve(fitTw.t);
    return true;
  }

  function computeFit() {
    fit.active = false;
    if (!S.framingRect) return;
    const r = cRect();
    const W = Math.max(1, r.width);
    const H = Math.max(1, r.height);
    const nx0 = ((S.framingRect.x - r.left) / W) * 2 - 1;
    const nx1 = ((S.framingRect.x + S.framingRect.w - r.left) / W) * 2 - 1;
    const ny0 = 1 - ((S.framingRect.y + S.framingRect.h - r.top) / H) * 2; // mép dưới ô
    const ny1 = 1 - ((S.framingRect.y - r.top) / H) * 2; // mép trên ô
    if (!(nx1 - nx0 > 0.02 && ny1 - ny0 > 0.02)) return;
    // 8 góc hộp bia ở cả ba tư thế lắc (−A, 0, +A): ô đích chứa trọn biên độ đung đưa.
    const b = K.bounds.box;
    const angles = S.autoRotate && !reduceMotion ? [-SWAY_A, 0, SWAY_A] : [0];
    const L = liftY();
    let n = 0;
    for (const a of angles) {
      const c = Math.cos(a);
      const sn = Math.sin(a);
      for (let k = 0; k < 8; k++) {
        const x = k & 1 ? b.max.x : b.min.x;
        const y = k & 2 ? b.max.y : b.min.y;
        const z = k & 4 ? b.max.z : b.min.z;
        _fitPts[n++].set(x * c + z * sn, y + L, -x * sn + z * c);
      }
    }
    // Bục (đứng yên): 8 điểm quanh vành dưới — ô đích chứa cả bục.
    if (S.pedestalOn) {
      const pr = pedestals[S.cur].R;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        _fitPts[n++].set(pr * Math.cos(a), 0, pr * Math.sin(a));
      }
    }
    const target = fit.target.copy(home.target);
    _dir.copy(home.pos).sub(home.target).normalize(); // cùng hướng nhìn chính diện với khung mặc định
    let dist = home.dist;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const cxT = (nx0 + nx1) / 2;
    const cyT = (ny0 + ny1) / 2;
    probe.aspect = camera.aspect;
    probe.fov = camera.fov;
    for (let it = 0; it < 12; it++) {
      probe.position.copy(target).addScaledVector(_dir, dist);
      probe.near = Math.max(0.01, dist / 100);
      probe.far = dist * 20;
      probe.updateProjectionMatrix();
      probe.lookAt(target);
      probe.updateMatrixWorld(true);
      _right.set(_dir.z, 0, -_dir.x).normalize();
      let loX = Infinity;
      let hiX = -Infinity;
      let loY = Infinity;
      let hiY = -Infinity;
      for (let i = 0; i < n; i++) {
        _corner.copy(_fitPts[i]).project(probe);
        if (_corner.x < loX) loX = _corner.x;
        if (_corner.x > hiX) hiX = _corner.x;
        if (_corner.y < loY) loY = _corner.y;
        if (_corner.y > hiY) hiY = _corner.y;
      }
      const driftX = cxT - (loX + hiX) / 2;
      const driftY = cyT - (loY + hiY) / 2;
      const scale = Math.max((hiX - loX) / (nx1 - nx0), (hiY - loY) / (ny1 - ny0));
      target.addScaledVector(_right, -driftX * dist * halfTan * probe.aspect);
      target.y -= driftY * dist * halfTan;
      dist *= THREE.MathUtils.clamp(scale, 0.6, 1.8);
      if (Math.abs(scale - 1) < 0.003 && Math.abs(driftX) < 0.003 && Math.abs(driftY) < 0.003) break;
    }
    fit.pos.copy(target).addScaledVector(_dir, dist);
    fit.dist = dist;
    fit.active = true;
    setDistLimits(Math.min(home.dist * 0.5, dist * 0.8), Math.max(home.dist * 1.75, dist * 1.25));
    camera.near = Math.min(camera.near, Math.max(0.01, dist / 100));
    camera.far = Math.max(camera.far, dist * 20);
    camera.updateProjectionMatrix();
  }

  // ---- Camera lái theo thời gian (xem camTw) ---------------------------------------------------
  const _sph = new THREE.Spherical();
  const _twT = new THREE.Vector3();
  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // Trạng thái quỹ đạo (tâm nhìn + toạ độ cầu quanh nó) của khung VỪA VẼ và vận tốc của nó — tween vào / ra chế
  // độ xoa khớp vận tốc lúc bắt đầu (camera còn quán tính xoay, đang tự trôi về khung, đang vòng hover… đi tiếp
  // êm rồi mới rẽ, không khựng dừng phắt ở khung đầu).
  const camMotion = { ok: false, T: new THREE.Vector3(), r: 0, pol: 0, az: 0, vT: new THREE.Vector3(), vr: 0, vpol: 0, vaz: 0 };
  const _cmS = new THREE.Spherical();
  const _cmV = new THREE.Vector3();
  function trackCamMotion(dt) {
    _cmS.setFromVector3(_cmV.copy(camera.position).sub(controls.target));
    const M = camMotion;
    if (M.ok && dt > 1e-4 && dt <= 0.1) {
      // trung bình trượt ~60 ms: một nấc lăn chuột (bước nhảy trong MỘT khung) không thành "vận tốc" lớn
      const a = 1 - Math.exp(-dt / 0.06);
      _cmV.copy(controls.target).sub(M.T).divideScalar(dt);
      M.vT.lerp(_cmV, a);
      M.vr += ((_cmS.radius - M.r) / dt - M.vr) * a;
      M.vpol += ((_cmS.phi - M.pol) / dt - M.vpol) * a;
      M.vaz += (wrapPi(_cmS.theta - M.az) / dt - M.vaz) * a;
    } else {
      M.vT.set(0, 0, 0);
      M.vr = M.vpol = M.vaz = 0;
    }
    M.T.copy(controls.target);
    M.r = _cmS.radius;
    M.pol = _cmS.phi;
    M.az = _cmS.theta;
    M.ok = true;
  }
  /**
   * Chụp trạng thái camera hiện tại (toạ độ cầu quanh tâm nhìn) làm điểm xuất phát của tween. matchVel: cộng
   * số hạng v0·D·τ(1 − τ)² (bằng 0 và phẳng ở hai đầu, đạo hàm theo thời gian lúc đầu = v0) để đi tiếp đúng vận
   * tốc camera đang có.
   */
  function beginCamTween(kind, dur = 1, curve = easeInOutCubic, matchVel = false) {
    _sph.setFromVector3(_v.copy(camera.position).sub(controls.target));
    killInertia();
    S.homing = false;
    const tw = { kind, dur, curve, t: 0, T0: controls.target.clone(), r0: _sph.radius, pol0: _sph.phi, az0: _sph.theta, v: null };
    if (matchVel && camMotion.ok && !reduceMotion) {
      const M = camMotion;
      // Số hạng khớp vận tốc dời camera thêm tối đa v·D·4/27 (đỉnh của τ(1 − τ)² ở τ = 1/3) — kẹp để camera chỉ "đi
      // tiếp một chút rồi rẽ", không vọt xa: tâm nhìn / bán kính ≤ 8 % bán kính, mỗi góc ≤ 6°.
      const w = (dur * 4) / 27;
      const cap = (v, lim) => (Math.abs(v * w) > lim ? (Math.sign(v) * lim) / w : v);
      const lin = 0.08 * _sph.radius;
      const ang = THREE.MathUtils.degToRad(6);
      const vT = M.vT.clone();
      if (vT.length() * w > lin) vT.setLength(lin / w);
      tw.v = { T: vT, r: cap(M.vr, lin), pol: cap(M.vpol, ang), az: cap(M.vaz, ang) };
    }
    return tw;
  }
  /** Một bước: nội suy từ trạng thái lúc bắt đầu tới khung đích HIỆN TẠI (khung có thể đang trôi). */
  function stepCamTween(dt) {
    let p;
    if (S.camTw.kind === 'tx') p = S.tx ? S.tx.progress : 1;
    else {
      S.camTw.t = Math.min(1, S.camTw.t + dt / Math.max(1e-3, S.camTw.dur));
      p = S.camTw.t;
    }
    const k = S.camTw.curve(p);
    const g = goal();
    _sph.setFromVector3(_v.copy(g.pos).sub(g.target));
    _twT.copy(S.camTw.T0).lerp(g.target, k);
    let r = S.camTw.r0 + (_sph.radius - S.camTw.r0) * k;
    let pol = S.camTw.pol0 + (_sph.phi - S.camTw.pol0) * k;
    let az = S.camTw.az0 + wrapPi(_sph.theta - S.camTw.az0) * k;
    if (S.camTw.v && p < 1) {
      const w = S.camTw.dur * p * (1 - p) * (1 - p);
      _twT.addScaledVector(S.camTw.v.T, w);
      r = Math.max(r * 0.5, r + S.camTw.v.r * w);
      pol = THREE.MathUtils.clamp(pol + S.camTw.v.pol * w, 0.02, Math.PI - 0.02);
      az += S.camTw.v.az * w;
    }
    camera.position.setFromSphericalCoords(r, pol, az).add(_twT);
    controls.target.copy(_twT);
    if (p >= 1) {
      // Tới khung cận đầu rùa: camera thuộc về người dùng (không gì kéo nó về khung cận nữa — xem tick()).
      S.userMoved = S.camTw.kind === 'rub';
      S.camTw = null;
      S.homing = false;
    }
  }

  // ---- Vùng giữ hover (LATCH_PAD_*) ------------------------------------------------------------
  const latch = { frame: -1, x0: 0, x1: 0, y0: 0, y1: 0 };
  const _latchT = new THREE.Vector3();
  function latchRect() {
    if (latch.frame === S.frameNo) return latch;
    latch.frame = S.frameNo;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    probe.aspect = camera.aspect;
    probe.fov = camera.fov;
    // r30: chỉ TẤM BIA (vành quét: đáy rùa + đỉnh — điểm 4k, 4k+1), không bục / sàn: khung 3/4, khung chính diện, và khung
    // hover (chính diện đã zoom + dời lên — r27z: bia ở đó to hơn, đáy rùa thấp hơn). Rời xuống dưới đáy rùa của MỌI khung
    // đó thì thôi hover, camera trôi về cũng không đưa bia trở lại dưới con trỏ → không nhấp nháy ở mép dưới.
    for (const az of [S.viewAz, 0]) {
      probe.position.copy(home0.pos).applyAxisAngle(_yAxis, az);
      _latchT.copy(home0.target).applyAxisAngle(_yAxis, az);
      probe.near = 0.01;
      probe.far = 100;
      probe.updateProjectionMatrix();
      probe.lookAt(_latchT);
      probe.updateMatrixWorld(true);
      for (let i = 0; i < _pts.length; i++) {
        if (i % 4 > 1) continue;
        _corner.copy(_pts[i]).project(probe);
        if (_corner.x < x0) x0 = _corner.x;
        if (_corner.x > x1) x1 = _corner.x;
        if (_corner.y < y0) y0 = _corner.y;
        if (_corner.y > y1) y1 = _corner.y;
      }
    }
    const zf = S.hoverFront ? S.zoomEff : 0;
    if (zf > 0 && steleNdc.ok) {
      const e = steleExtentAt(zf);
      x0 = Math.min(x0, -e.x);
      x1 = Math.max(x1, e.x);
      y0 = Math.min(y0, e.b);
      y1 = Math.max(y1, e.t);
    }
    latch.x0 = x0 - LATCH_PAD_X;
    latch.x1 = x1 + LATCH_PAD_X;
    latch.y0 = y0 - LATCH_PAD_BOT;
    latch.y1 = y1 + LATCH_PAD_Y;
    return latch;
  }
  /** Điểm NDC nằm trong vùng giữ hover (hợp khung 3/4 + chính diện, đã nới). */
  function inLatch(ndc) {
    if (!S.live) return false;
    const L = latchRect();
    return ndc.x >= L.x0 && ndc.x <= L.x1 && ndc.y >= L.y0 && ndc.y <= L.y1;
  }
  S.devLatchOff = false; // DEV: tắt vùng giữ hover để so sánh (vm.cinemaLatch(false))
  // r30g: tay đang ở trong vùng của một vùng dính (body[data-hand-area] — 1/3 dưới của dòng thời gian) → vùng giữ không giữ
  // hover cho tay (tia trúng bia vẫn thắng — index.js onStele)
  const handInLatch = () => S.handActive && !document.body.dataset.handArea && inLatch(_hnd);
  const pointerInLatch = () => !S.devLatchOff && ((S.pointerActive && inLatch(_ndc)) || handInLatch());

  /** Đặt camera đúng vào khung đích (khung xin riêng nếu có, không thì khung mặc định). */
  function snapHome() {
    if (S.rubOn) return; // chế độ xoa: camera của người dùng / đoạn vào đang chạy — không giật về khung nào
    S.camTw = null;
    S.fitMix = fitTw.from = fitTw.to = fitWant();
    fitTw.t = 1;
    const g = goal();
    camera.position.copy(g.pos);
    controls.target.copy(g.target);
    controls.update();
    S.homing = false;
    S.userMoved = false;
  }

  /**
   * Người dùng THỰC SỰ cầm camera (kéo quá ngưỡng, lăn chuột, nhón xoay / zoom bằng tay): thôi lái tự động
   * (vào / rời hover, hội tụ lúc chuyển cảnh, tự về khung) và không giành lại. Một cú BẤM (nhấn rồi nhả,
   * không kéo quá ngưỡng) KHÔNG được gọi hàm này — xem pressStart().
   */
  function markInteraction() {
    S.lastInteract = performance.now();
    if (S.press) S.press.took = true;
    // r35: đang bay về sau khi rời chế độ xoa (RUB_OUT) → đoạn về KHÔNG bị cắt ngang. Thao tác vừa dùng để thoát thường
    // còn dư (lăn / zoom tay ra quá ngưỡng rồi vẫn lăn thêm vài nấc, nhón kéo còn dở): trước đây nó huỷ đoạn về, camera
    // đứng lại giữa đường (gần + cao, cụt đỉnh bia) và — con trỏ còn trên đầu rùa giữ camera "thức" — không bao giờ về
    // khung. Tới nơi (~2 s) camera lại thuộc về người dùng như thường.
    if (S.camTw?.kind === 'rub-out') return;
    S.userMoved = true;
    S.camTw = null; // người dùng cầm camera: thôi lái về khung, không giành lại
    S.homing = false;
  }
  /**
   * Nhấn chuột / chạm / nhón xuống canvas — CHƯA phải là cầm camera. Trong lúc nhấn mà chưa kéo quá ngưỡng
   * (view gọi markInteraction() khi quá ngưỡng), mọi xoay / dời / zoom mà OrbitControls tích luỹ bị xoá mỗi
   * khung → hoạt ảnh camera đang chạy (rời hover 2,5 s, vào hover, chuyển cảnh) đi tiếp đúng đường cong;
   * quá ngưỡng thì OrbitControls cầm lái từ đúng tư thế đang vẽ, không nhảy.
   */
  S.press = null;
  function pressStart() {
    S.lastInteract = performance.now(); // như trước: nhấn tạm dừng lắc (không liên quan hoạt ảnh camera)
    S.press = { took: false };
  }
  function pressEnd() {
    S.press = null;
  }

  /**
   * Huỷ việc tự về khung — chỉ gọi khi người dùng THỰC SỰ kéo/zoom.
   * Một cú bấm chuột đơn thuần không được phép bỏ dở cú về khung sau khi đổi bia,
   * nếu không mô hình mới sẽ nằm lại ở khung của mô hình cũ và trông bé đi.
   */
  function cancelHoming() {
    S.homing = false;
  }
  // KHÔNG nghe 'start' của OrbitControls: sự kiện đó bắn ngay lúc pointerdown / wheel, nên một cú bấm đơn
  // thuần cũng thành "cầm camera" và làm camera đứng khựng giữa hoạt ảnh. View tự gọi markInteraction() khi
  // kéo quá ngưỡng / lăn chuột.

  function killInertia() {
    handZoom.pend = 0; // r44g
    wheelZoom.pend = wheelZoom.v = 0; // r76
    if (controls._sphericalDelta?.set) {
      controls._sphericalDelta.set(0, 0, 0);
      controls._panOffset?.set(0, 0, 0);
    } else {
      const d = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = d;
    }
  }

  /**
   * Hệ số hiển thị theo GÓC THẬT giữa pháp tuyến mặt phẳng nội dung (sau khi đung đưa)
   * và hướng từ tâm mặt phẳng tới camera. Một luật duy nhất phủ cả xoay ngang, nhìn
   * từ trên cao xuống và nhìn từ phía sau. Holder chỉ quay quanh trục Y ở gốc toạ độ
   * nên tính thẳng bằng lượng giác, không cần cập nhật ma trận.
   */
  function angleFactor() {
    const th = holder.rotation.y;
    const sn = Math.sin(th);
    const cs = Math.cos(th);
    const L = livePlane().M;
    const zf = L ? L.zFront : K.bounds.zFront;
    const ly = (L ? L.lineY : K.bounds.yMin + LINE_Y * (K.bounds.yMax - K.bounds.yMin)) + liftY();
    const dx0 = camera.position.x - zf * sn;
    const dy = camera.position.y - ly;
    const dz0 = camera.position.z - zf * cs;
    // Góc TÍNH TỪ GÓC NHÌN MẶC ĐỊNH (settings.cinemaViewAngle): quay hướng tới camera ngược lại viewAz
    // → ở khung 3/4 mặc định thông tin vẫn hiện đủ; chỉ khi người dùng xoay xa khỏi khung đó mới mờ.
    const ca = Math.cos(S.viewAz);
    const sa = Math.sin(S.viewAz);
    const dx = dx0 * ca - dz0 * sa;
    const dz = dx0 * sa + dz0 * ca;
    const len = Math.hypot(dx, dy, dz) || 1;
    const cosA = THREE.MathUtils.clamp((sn * dx + cs * dz) / len, -1, 1);
    const deg = THREE.MathUtils.radToDeg(Math.acos(cosA));
    const t = THREE.MathUtils.clamp((deg - ANG_FULL) / (ANG_ZERO - ANG_FULL), 0, 1);
    return 1 - t * t * (3 - 2 * t);
  }

  /**
   * r19: độ hiện theo góc của thông tin — lọc theo thời gian + trễ. Đích (hàm smoothstep ĐƠN ĐIỆU của góc nhìn) có thể
   * chạy nhanh (camera tự về khung: cả dải 24°→42° trong ~0,15 s) hoặc dao động nhỏ quanh một mức (quán tính camera,
   * lò xo lắc, vòng hover) → trước đây độ đục tấm thông tin nhảy / rung theo. Ở đây:
   *   · trễ FADE_HYST: đích đổi chiều mà chưa vượt quá ngần này so với mức đang hiện → giữ nguyên (không rung ngược);
   *   · bám theo đích bằng hàm mũ FADE_TAU giây → mọi lần hiện / mờ đều êm, không giật trong một hai khung;
   *   · đích là 0 / 1 và đã sát → chốt đúng 0 / 1.
   */
  const FADE_TAU = 0.16;
  const FADE_HYST = 0.04;
  S.frameDt = 1 / 60;
  function fadeFollow(v, target, dt) {
    if (!Number.isFinite(v)) return target;
    const d = target - v;
    if (Math.abs(d) < 0.002 || ((target === 0 || target === 1) && Math.abs(d) < 0.01)) return target;
    if (Math.abs(d) < FADE_HYST && target > 0 && target < 1) return v; // trễ: dao động nhỏ không làm độ hiện rung
    return v + d * (1 - Math.exp(-Math.max(0, dt) / FADE_TAU));
  }

  // Góc nhìn tính MỘT lần mỗi khung (tick) — ctx.angleFade() chỉ đọc lại.
  S.angleNow = 1;
  const _lastCam = new THREE.Vector3();
  const _w2s = new THREE.Vector3();

  const _probeNdc = new THREE.Vector2();
  /** DEV: thống kê chi phí bắn tia (số lần, tổng ms, lần chậm nhất). */
  const rayStats = { n: 0, ms: 0, max: 0, box: 0 };
  /** DEV: ép đường bắn tia để đo — 'auto' (thật), 'full' (đường cũ), 'box' (hộp thô). */
  S.devRayMode = 'auto';
  const _inv = new THREE.Matrix4();
  const _ray = new THREE.Ray();
  // r74: giao điểm GẦN NHẤT của lượt tia gần nhất (hitStele) — điểm + pháp tuyến thế giới — để hỏi "tia trúng MẶT bia không"
  // (faceOfHit) mà không bắn tia lần hai
  const _hit = { ok: false, hasN: false, p: new THREE.Vector3(), n: new THREE.Vector3() };
  const _fp = new THREE.Vector3();
  const _fn = new THREE.Vector3();
  const _fc = new THREE.Vector3();
  const _plane = new THREE.Plane();
  const _hSph = new THREE.Sphere();
  const _fMat = new THREE.Matrix4();
  /**
   * Điểm NDC có trúng tấm bia đang hiển thị không (chỉ xét khay hiện tại).
   * Có cây BVH → tia xuyên lưới thật, dừng ở giao điểm đầu (≪ 0,5 ms). Chưa có (vài trăm ms sau
   * khi bia hiện lên) → thử hai hộp thô phiến + đế trong toạ độ của khay. KHÔNG BAO GIỜ bắn tia
   * xuyên nguyên lưới hàng trăm nghìn tam giác trong vòng vẽ nữa.
   */
  function hitStele(nx, ny) {
    if (!S.live) return false;
    const t0 = import.meta.env.DEV ? performance.now() : 0;
    _probeNdc.set(nx, ny);
    raycaster.setFromCamera(_probeNdc, camera);
    if (!S.live.bvh) S.live.bvh = hasBVH(S.live.inst);
    let hit;
    if (import.meta.env.DEV && S.devRayMode === 'full') {
      // DEV: đường CŨ (tia xuyên nguyên lưới) — chỉ để đo so sánh trong cùng điều kiện.
      const saved = [];
      S.live.inst.traverse((o) => {
        if (o.isMesh && o.geometry.boundsTree) {
          saved.push([o.geometry, o.geometry.boundsTree]);
          o.geometry.boundsTree = null;
        }
      });
      raycaster.firstHitOnly = false;
      hit = raycaster.intersectObject(S.live.inst, true).length > 0;
      raycaster.firstHitOnly = true;
      for (const [g, t] of saved) g.boundsTree = t;
    } else if (S.live.bvh && !(import.meta.env.DEV && S.devRayMode === 'box')) {
      const hits = raycaster.intersectObject(S.live.inst, true);
      hit = hits.length > 0;
      _hit.ok = hit;
      _hit.hasN = false;
      if (hit) {
        _hit.p.copy(hits[0].point);
        if (hits[0].face) {
          _hit.n.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld);
          _hit.hasN = true;
        }
      }
    } else {
      S.live.lift.updateWorldMatrix(true, false);
      _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(S.live.lift.matrixWorld).invert());
      hit = _ray.intersectsBox(K.bounds.hitSlab) || _ray.intersectsBox(K.bounds.hitBase);
      // (hộp thô: không có điểm trên lưới — faceOfHit tự lấy giao điểm với mặt trước phiến)
      _hit.ok = hit;
      _hit.hasN = false;
      if (hit) {
        // r74: đầu rùa chìa ra TRƯỚC mặt phiến — tia qua cầu đầu rùa thì không phải mặt bia (hộp thô không thấy đầu rùa)
        const hd = S.live.head;
        if (hd?.center && hd.radius > 0) {
          _hSph.center.set(hd.center[0], hd.center[1], hd.center[2]);
          _hSph.radius = hd.radius * 1.1;
          if (_ray.intersectsSphere(_hSph)) _hit.ok = false;
        }
        _plane.set(_fn.set(0, 0, 1), -K.bounds.zFront);
        if (_hit.ok && _ray.intersectPlane(_plane, _hit.p)) _hit.p.applyMatrix4(S.live.lift.matrixWorld);
        else _hit.ok = false;
      }
      if (import.meta.env.DEV) rayStats.box++;
    }
    // (r30: rê lên BỤC không còn là rê lên bia — chỉ tấm bia: rùa + phiến + trán. 1/3 dưới màn hình dành cho dòng thời gian.)
    if (import.meta.env.DEV) {
      const ms = performance.now() - t0;
      rayStats.n++;
      rayStats.ms += ms;
      if (ms > rayStats.max) rayStats.max = ms;
    }
    return hit;
  }

  /**
   * r74 — tia gần nhất (hitStele) trúng MẶT TRƯỚC của phiến bia? Toạ độ bia (lift-local, bia cao 1, mặt trước +Z): trong bề
   * ngang phiến (slabL..slabR, chừa mép 2 %), từ chân mặt bia (khung bản dập nếu bia có — stage/scan.js; không thì chân phiến
   * đo được, bandBottom) tới đỉnh trán (yMax), sát mặt
   * trước (zFront − FACE_BACK … zFront + FACE_FRONT: đầu rùa chìa ra trước bị loại), pháp tuyến hướng ra trước (z cục bộ ≥
   * FACE_NZ) và hướng về camera. Hộp thô (chưa có cây BVH): chỉ xét vị trí trên mặt phẳng trước.
   */
  const FACE_BACK = 0.06;
  const FACE_FRONT = 0.035;
  const FACE_NZ = 0.35;
  function faceOfHit() {
    if (!S.live || !_hit.ok) return false;
    const B = K.bounds;
    S.live.lift.updateWorldMatrix(true, false);
    _fMat.copy(S.live.lift.matrixWorld).invert();
    _fp.copy(_hit.p).applyMatrix4(_fMat);
    const inset = (B.slabR - B.slabL) * 0.02;
    if (_fp.x < B.slabL + inset || _fp.x > B.slabR - inset) return false;
    // chân mặt bia: theo khung bản dập nếu bia có (1442: 0,197 — mặt khắc xuống tận lưng rùa), không thì chân phiến đo được
    const F = K.scanFrame?.();
    const yLo = F && !F.measured ? F.bottom : B.bandBottom;
    if (_fp.y < yLo - 0.005 || _fp.y > B.yMax + 0.005) return false;
    if (_fp.z < B.zFront - FACE_BACK || _fp.z > B.zFront + FACE_FRONT) return false;
    if (_hit.hasN) {
      if (_fc.copy(camera.position).sub(_hit.p).dot(_hit.n) <= 0) return false;
      _fn.copy(_hit.n).transformDirection(_fMat);
      if (_fn.z < FACE_NZ) return false;
    }
    return true;
  }

  /**
   * r84: điểm NDC (x, y) nằm trong hình chiếu của MẶT BIA (khung mặt — bản dập / đo) nới rộng: mỗi bên + 18 % cỡ chiếu + 0,05 NDC.
   * Lớp cử chỉ giữ lượt giữ V đã bắt đầu trên mặt bia khi tay còn trong vùng này (camera nhích vào làm mặt bia trôi dưới tay —
   * phép thử tia từng khung có thể trượt ra mép / đầu rùa mà tay không hề đi).
   */
  const _fq = new THREE.Vector3();
  function faceNearNdc(x, y) {
    if (!S.live) return false;
    const F = K.scanFrame?.();
    const B = K.bounds;
    if (!F || !B) return false;
    S.live.lift.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of [[F.left, F.bottom], [F.right, F.bottom], [F.left, F.top], [F.right, F.top]]) {
      _fq.set(px, py, B.zFront).applyMatrix4(S.live.lift.matrixWorld).project(camera);
      if (_fq.z > 1) continue;
      x0 = Math.min(x0, _fq.x); x1 = Math.max(x1, _fq.x); y0 = Math.min(y0, _fq.y); y1 = Math.max(y1, _fq.y);
    }
    if (!Number.isFinite(x0)) return false;
    const mx = (x1 - x0) * 0.18 + 0.05;
    const my = (y1 - y0) * 0.18 + 0.05;
    return x >= x0 - mx && x <= x1 + mx && y >= y0 - my && y <= y1 + my;
  }

  /** Hộp chiếu của cả tấm bia (rùa + phiến + trán) lên màn hình, px CSS khung nhìn. */
  const _sr = { x: 0, y: 0, w: 0, h: 0 };
  let srFrame = -1;
  let srOk = false;
  function steleScreenRect() {
    if (!S.live) return null;
    if (srFrame === S.frameNo) return srOk ? { ..._sr } : null;
    srFrame = S.frameNo;
    S.live.lift.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    const b = K.bounds.box;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < 8; k++) {
      _corner
        .set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z)
        .applyMatrix4(S.live.lift.matrixWorld)
        .project(camera);
      if (_corner.x < x0) x0 = _corner.x;
      if (_corner.x > x1) x1 = _corner.x;
      if (_corner.y < y0) y0 = _corner.y;
      if (_corner.y > y1) y1 = _corner.y;
    }
    const r = cRect();
    srOk = Number.isFinite(x0 + x1 + y0 + y1);
    _sr.x = r.left + ((x0 + 1) / 2) * r.width;
    _sr.w = ((x1 - x0) / 2) * r.width;
    _sr.y = r.top + ((1 - y1) / 2) * r.height;
    _sr.h = ((y1 - y0) / 2) * r.height;
    return srOk ? { ..._sr } : null;
  }
  return {
    _corner, _lastCam, _pts, _v, _w2s, _yAxis, angleFactor, applyDistLimits, applyHomeAz, beginCamTween, cRect,
    cancelHoming, computeFit, computeHome, controls, distBase, faceOfHit, faceNearNdc, fadeFollow, fit, fitStep, goal, handInLatch, hitStele,
    home, home0, inLatch, killInertia, latchRect, livePlane, markInteraction, measure, orbitStep, pointerInLatch,
    pressEnd, pressStart, rayStats, setDistLimits, setViewAngle, slabOf, slotOfPlane, snapHome, steleScreenRect,
    stepCamTween, syncYaw, trackCamMotion, zoomCap, zoomLift, zoomLimit,
  };
}
