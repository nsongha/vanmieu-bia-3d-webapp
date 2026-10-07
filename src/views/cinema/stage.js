// Sân khấu 3D của chế độ "Điện ảnh": nền gần như đen, hồ sáng trên sàn,
// bàn xoay chậm, camera tự về khung mặc định, chuyển cảnh mềm giữa các bia.
// Ánh sáng dùng bộ chuẩn chung (core/lighting.js, preset 'cinematic').
// Không đụng tới DOM ngoài phần tử chứa canvas.
// C (tách module): thân createStage chia theo trách nhiệm — stage/lights.js (đèn chính, đèn rọi, rim), stage/pedestal.js
// (bục + chữ khắc nổi), stage/reflect.js (gương lòng bục, bóng tiếp xúc, hồ sáng sàn), stage/names.js (tên người đỗ),
// stage/camera.js (khung mặc định / xin riêng, hover, tween), stage/lod.js (LOD, proxy, nung sẵn), stage/transition.js
// (present + Lướt), stage/rub.js (xoa đầu rùa), stage/dev.js (móc DEV), stage/config.js (hằng số + hàm thuần).
// Ở đây còn: cảnh gốc, bia sống / khay, vòng vẽ, API. Trạng thái dùng chung: S (đầu createStage, gom theo module ghi
// chính); hàm cố định truyền qua deps, dùng sớm qua K.
import * as THREE from 'three';
import { createRenderer } from '../../core/renderer.js';
import { disposeInstance } from '../../core/loader.js';
import { bindLightsToSettings } from '../../core/lighting.js';
import { DEFAULTS, getSettings, isLowPowerDevice, onSettings } from '../../core/settings.js';
import { neverCastShadow } from './hotspot.js';
import { pruneReliefQueue } from './relief.js';
import { disposeProxyInstance } from './proxy.js';
import { requestBVH } from './bvh.js';
import { ensureCompositeTarget, warmComposite } from '../../core/transitions.js';
import { ensurePolishNormals } from './polish.js';
import {
  CALM_MS, ELEVATION, HAND_CALM_MAX_MS, HOVER_FADE, HOVER_RETURN, IDLE_CAM, IDLE_SPIN, PED_SETTLE_MS, RAY_REFRESH_MS,
  RUB_SWAY, SPILL, SWAY_A, SWAY_HOLD_IN, SWAY_HOLD_W, SWAY_PERIOD, SWAY_RAMP, SWAY_RESUME_F, SWAY_SETTLE, VIEW_TWEEN,
  bgDarkK, cinemaBg, clampNum, easeInOutCubic, easeLeave, fogColorFor, headOf, pedLightsOf
} from './stage/config.js';
import { installCamera } from './stage/camera.js';
import { installLights } from './stage/lights.js';
import { installPedestal } from './stage/pedestal.js';
import { installReflect } from './stage/reflect.js';
import { installNames } from './stage/names.js';
import { installLod } from './stage/lod.js';
import { installTransition } from './stage/transition.js';
import { installRub } from './stage/rub.js';
import { installScan } from './stage/scan.js';
import { installRead } from './stage/read.js';
import { installGlyphs } from './stage/glyphs.js';
import { installStageDev } from './stage/dev.js';
import { createGrabRing } from './grab-ring.js';
export { cinemaBg } from './stage/config.js';

/**
 * @param {HTMLElement} container phần tử chứa canvas
 * @param {{reduceMotion?:boolean}} [opts]
 */
export function createStage(container, opts = {}) {
  // ---- Trạng thái dùng chung giữa các module (C): mỗi nhóm là của module ghi chính; module khác đọc / ghi qua S.x.
  const S = {
    // gốc (stage.js): cảnh gốc, camera + hover, chuyển cảnh / khay, vòng vẽ
    viewAz: undefined, hoverFront: undefined, holdFreeze: undefined, hoverZoom: undefined, zoomEff: undefined,
    zoomGuard: undefined, effAz: undefined, yawNow: undefined, camTw: undefined, txSway: undefined,
    renderOnDemand: undefined, catcher: undefined, selTarget: undefined, pointerActive: undefined,
    handActive: undefined, frameNo: undefined, metricsCache: undefined, source: undefined, userMoved: undefined,
    homing: undefined, everPresented: undefined, lastInteract: undefined, devTrace: undefined, devCamTrace: undefined,
    focusHold: undefined, grabCam: undefined, grabBusy: false, grabPrecompiled: false,
    swayT: undefined, swayT0: undefined, swayRamp: undefined, swayOffset: undefined, autoRotate: undefined,
    vw: undefined, vh: undefined, live: undefined, retiring: undefined, tx: undefined, cur: undefined,
    // camera: camera: khung mặc định, hover (vòng chính diện + zoom), tween, vùng giữ hover, cầm camera
    distRelax: undefined, framingRect: undefined, canvasRect: undefined, fitMix: undefined, devLatchOff: undefined,
    press: undefined, frameDt: undefined, angleNow: undefined, devRayMode: undefined,
    // lights: đèn chính (key), đèn rọi + ánh hắt, hai trạng thái ánh sáng
    keyDist: undefined, contrast: undefined, lightU: undefined, lightE: undefined, spotLevel: undefined,
    castK: undefined, catchMat: undefined,
    // pedestal: bục trưng bày: cỡ, chữ khắc (bản GPU theo dải), đèn bục
    pedestalOn: undefined, pedLights: undefined, pedSize: undefined, pedText: undefined, pedSep: undefined,
    pedLook: undefined, pedSettleAt: undefined, pedSizeDirty: undefined, devPerStele: undefined, reliefWin: undefined,
    // reflect: gương lòng bục, bóng tiếp xúc, hồ sáng + đĩa hứng bóng
    devDish: undefined, devMirrorMode: undefined, disposed: undefined, devContactOff: undefined, reflBase: undefined,
    dishGlass: undefined, fresnelRef: undefined, mirrorScaleNow: undefined, mirrorScalePin: undefined,
    mirrorLod: undefined,
    // names: tên người đỗ trên thân bia, đo độ sáng ô chữ
    namesOn: undefined, namesStyle: undefined, lumaAt: undefined, lumaMiss: undefined, lumaSig: undefined,
    devNamesLegacy: undefined, devInfoLegacy: undefined, lumaJob: undefined,
    // lod: LOD / proxy / quét hiện, nung sẵn + đẩy texture theo dải
    lodFade: undefined, proxyLook: undefined, bandHeat: undefined, bandHeated: undefined, keepGen: undefined,
    proxyKeeper: undefined, bgBusy: undefined,
    // rub: chế độ xoa đầu rùa (phần sân khấu): khung cận, tia đầu rùa, độ bóng
    rubEnabled: undefined, rubOn: undefined, rubK: undefined, rubGoalOk: undefined,
    // scan / read (r74): quét bản dập trên mặt bia, khung đọc toàn văn (camera sát mặt bia)
    scanNamesK: undefined, readNamesK: 0, readOn: undefined, readGoalOk: undefined,
  };
  /** Hàm / đối tượng cố định dùng TRƯỚC khi nơi tạo ra nó được cài (gán ngay khi có). */
  const K = {};
  const reduceMotion = !!opts.reduceMotion;
  const topInset = typeof opts.topInset === 'function' ? opts.topInset : () => 0;

  // exposure do createStudioLights quyết định (preset 'cinematic' → 1.15).
  const view = createRenderer(container, { shadows: true, maxDpr: 2 });
  const renderer = view.renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070a);
  // Tuyến tính, bắt đầu từ 5 đơn vị: mô hình (~2–3 đơn vị) hoàn toàn không bị sương
  // làm xám, chỉ phần sàn xa mới tan dần. Màu tính lại theo nền + exposure.
  scene.fog = new THREE.Fog(0x16161a, 5, 14);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  camera.position.set(0.72, 0.62, 1.9);
  // ---- lights (stage/lights.js)
  const {
    _spill, _spillDir, applyIdleLighting, captureLightBase, catchU, cineKey, idleSpot, keyAim, keyCfg, lights,
    placeIdleSpot, placeKey, spill, syncKey, syncSpot, trackRim
  } = installLights(S, K, {
    camera, renderer, scene
  });

  // ---- Khối đung đưa: holder mang góc lắc, hai khay A/B do engine chuyển cảnh điều khiển.
  const holder = new THREE.Group();
  // Góc nhìn mặc định (settings.cinemaViewAngle) là THUẦN chuyển động camera: cả cụm bục + rùa + bia giữ
  // nguyên hướng thật trong thế giới, ta chỉ nhìn nó từ bên. holder nằm trong nhóm quay đúng góc đó chỉ để
  // trục X của hai khay (hướng lướt / trượt của hiệu ứng chuyển cảnh) luôn là trục "ngang khung hình" của
  // camera mặc định; bia (lifts) và bục (mỗi khung) được xoay NGƯỢC lại → không gì xoay theo góc nhìn.
  const viewYaw = new THREE.Group();
  viewYaw.name = 'cinema-view-yaw';
  scene.add(viewYaw);
  viewYaw.add(holder);
  S.viewAz = THREE.MathUtils.degToRad(clampNum(Number(getSettings().cinemaViewAngle), -45, 45, DEFAULTS.cinemaViewAngle));
  const viewTw = { from: S.viewAz, to: S.viewAz, t: 1 };
  S.hoverFront = getSettings().cinemaHoverFront !== false;
  let pointerQuiet = false; // r26: tự chuyển + con trỏ đứng yên → con trỏ trong vùng bia KHÔNG giữ chính diện lúc lướt
  // r28: đang GIỮ trên đầu rùa (vòng đếm xoè tay / nắm tay vào chế độ xoa, giữ con trỏ mở khoá — rub.js holding) → vòng
  // camera hover (vòng chính diện + zoom + dời), lắc, tween / tự trôi của camera đứng yên tại chỗ: đầu rùa không trượt khỏi
  // tay. Nhả ra → đi tiếp từ đúng chỗ đã dừng, từ vận tốc 0 (setHoldFreeze).
  S.holdFreeze = false;
  S.creepOn = false; // r84: camera đang nhích vào khung đọc (stage/read.js) — goal() trả khung đọc
  // Hover-camera: f = 0 khung mặc định (viewAz, khoảng cách chuẩn) … 1 = chính diện + zoom (đã qua easing);
  // v = vận tốc (f / s); seg = đoạn đang chạy (từ f0 / v0 tới đích trong D giây theo curve).
  const orbit = { f: 0, v: 0, want: 0, seg: null, segs: 0 };
  S.hoverZoom = clampNum(Number(getSettings().cinemaHoverZoom), 0, 0.25, DEFAULTS.cinemaHoverZoom);
  S.zoomEff = S.hoverZoom; // sau khi kẹp cho vừa khung + kiểu thông tin (zoomLimit)
  S.zoomGuard = null; // () => ({ framing:boolean, extent:number|null }) — index.js gắn (kiểu thông tin)
  const homeNdc = { x: 0, y: 0 }; // biên NDC của bia + bục ở khung mặc định (computeHome)
  // r27z: riêng TẤM BIA (rùa + thân + đỉnh — vành quét) ở khung mặc định + dải an toàn của khung đó (computeHome): zoom khi
  // hover chỉ phải giữ tấm bia trong khung, bục / sàn được cắt ở dưới (khung hover dời lên theo zoom — zoomLift)
  const steleNdc = { ok: false, top: 0, bot: 0, x: 0 };
  const homeBand = { top: 1, bot: -1, x: 1, dist: 2, halfTan: 0.5, cosEl: 1 };
  const STELE_BOT_NDC = 0.94; // r27z: đáy rùa không xuống quá NDC −0,94 khi zoom hover
  // r27z: đỉnh bia nhắm NDC 0,94 (giữa mép trên trống — thương hiệu / chế độ ở hai góc; phối cảnh đẩy thật lên ~0,955)
  const STELE_TOP_NDC = 0.94;
  S.effAz = S.viewAz; // phương vị khung đích hiện tại = viewAz × (1 − f)
  S.yawNow = S.viewAz; // góc nhóm viewYaw = phương vị camera quanh trục bia (mỗi khung, syncYaw)
  /**
   * Camera đang được lái tới khung đích trong một khoảng thời gian (null = không):
   *   'tx'     — chuyển cảnh: từ trạng thái camera hiện có về khung đích, cùng nhịp (tiến độ) chuyển cảnh;
   *   'return' — rời hover sau khi người dùng đã tự xoay: về khung 3/4 trong HOVER_RETURN (easeLeave).
   * Nội suy trong toạ độ cầu quanh tâm nhìn (bán kính, góc cao, phương vị ngắn nhất) + dời tâm nhìn.
   * Người dùng chạm vào camera (kéo / nhón / cuộn) → bỏ ngay, không giành lại.
   */
  S.camTw = null;
  S.txSway = null; // chuyển cảnh: góc lắc lúc bắt đầu, tắt dần theo tiến độ (không nhảy)
  let prevSel = false;
  // r48: lượt lướt đang chạy + lúc nó BẮT ĐẦU có đang focus không (xem wantFront trong tick)
  let txSeen = null;
  let txFocus = false;
  /** @type {[THREE.Group, THREE.Group]} */
  const slots = [new THREE.Group(), new THREE.Group()];
  holder.add(slots[0], slots[1]);
  // Khay chưa từng chứa bia thì ẩn (engine chuyển cảnh tự bật/ẩn khay từ lần chuyển đầu tiên) —
  // nếu không, bục của khay rỗng sẽ chồng khít lên bục của bia đang hiển thị (và một bục trống
  // hiện một mình trong lúc bia đầu tiên còn đang tải).
  slots[0].visible = false;
  slots[1].visible = false;
  // Trong mỗi khay: "lift" nâng bia + mặt phẳng nội dung lên đúng chiều cao bục (plane-local y = 0 vẫn
  // là mặt bia đứng → mọi kiểu hiện thông tin không phải đổi gì), và BỤC nằm thẳng trong khay (đi cùng
  // bia qua mọi hiệu ứng chuyển cảnh) nhưng xoay ngược góc lắc mỗi khung → bục đứng yên, chữ khắc
  // luôn nhìn ra trước, chỉ bia đung đưa phía trên.
  const lifts = [new THREE.Group(), new THREE.Group()];
  slots[0].add(lifts[0]);
  slots[1].add(lifts[1]);
  // ---- pedestal (stage/pedestal.js)
  const {
    dropReliefGpu, footMax, heatBand, liftY, noteFoot, offReliefEvict, pedLookOf, pedStats, pedestalR0, pedestals,
    readyRelief, refreshRelief, reliefContextLost, reliefGpu, setPedestalOn, settlePedestal, syncPedestalLook,
    syncReliefDepth, trimReliefGpu, api: pedestalApi
  } = installPedestal(S, K, {
    camera, lifts, placeIdleSpot, placeKey, renderer, requestRender, scene, slots, view, whenCalm
  });
  Object.assign(K, { pedestals });
  // ---- Vẽ theo yêu cầu (r15) ------------------------------------------------------------------------------------
  // Vòng lặp vẫn chạy mỗi khung (logic rẻ: lắc, tween, hover, luật hiện thông tin, CSS3D), nhưng lượt vẽ WebGL chỉ chạy
  // khi khung này KHÁC khung đã vẽ: canvas giữ nguyên ảnh cũ → rảnh tay tĩnh = 0 khung GPU. Hai loại nguồn:
  //   · yêu cầu tường minh (requestRender): đổi cài đặt, đổi cỡ, present / bỏ bia, chữ nổi bục vừa có, gương cần vẽ lại
  //     (reflector.invalidate — mọi chỗ đổi ánh sáng / bục đều gọi), bóng cần vẽ lại, tab hiện lại, context khôi phục;
  //   · trạng thái so với khung đã vẽ (renderReason): chuyển cảnh, đồng hồ FPS bật, đo độ sáng ô tên, bục đang có tia
  //     chạy (uTime), uniform độ bóng / vòng brush đổi (polish.version), camera (ma trận — gồm quán tính, tween, hover
  //     vòng, zoom), tư thế các khay / bục / lắc / đèn (poseSig).
  let renderWhy = 'init'; // lý do tường minh đang chờ ('' = không có)
  // Con trỏ (chuột / tay) đang di trên sân khấu → vẽ mỗi khung thêm POINTER_WARM_MS: giữ GPU "ấm". Sau một lúc không
  // vẽ, GPU hạ xung — khung nặng đầu tiên (vd. vào hover: đèn + gương vẽ lại) tốn ~1,3–2× và rớt 1–3 khung. Hover /
  // chuyển cảnh bằng chuột luôn bắt đầu bằng di chuột, nên lúc đó GPU đã chạy đủ nhịp. Để yên tay = vẫn 0 khung.
  let warmUntil = 0;
  const POINTER_WARM_MS = 400;
  S.renderOnDemand = true; // DEV: __vm.cinemaRenderOnDemand(false) → vẽ mọi khung như trước (so sánh)
  let fpsOn = !!getSettings().showFps; // đồng hồ FPS đo khung THẬT → bật thì vẽ mọi khung
  const devRender = import.meta.env.DEV ? { rendered: 0, skipped: 0, why: {}, t0: performance.now() } : null;
  /** Xin vẽ lại ở khung tới (gộp: nhiều lời xin trong một khung = một lượt vẽ). */
  function requestRender(reason = 'request') {
    if (!renderWhy) renderWhy = reason;
  }
  const _rCam = new THREE.Matrix4();
  const _rProj = new THREE.Matrix4();
  let rPose = new Float64Array(0);
  let rPoseNext = new Float64Array(0);
  let rPolish = null;
  let rPolishV = -1;
  const sigLights = [];
  function matChanged(a, b, eps) {
    const ae = a.elements, be = b.elements;
    for (let i = 0; i < 16; i++) if (Math.abs(ae[i] - be[i]) > eps) return true;
    return false;
  }
  /** Chữ ký tư thế: mọi transform / độ đục / hiện-ẩn mà tick() hay chuyển cảnh đụng tới + cường độ / màu mọi đèn. */
  function poseSig() {
    if (!sigLights.length) scene.traverse((o) => o.isLight && sigLights.push(o));
    const need = 40 + sigLights.length * 7;
    if (rPoseNext.length < need) rPoseNext = new Float64Array(need);
    const out = rPoseNext;
    let k = 0;
    out[k++] = holder.rotation.y;
    out[k++] = viewYaw.rotation.y;
    for (let i = 0; i < 2; i++) {
      const sl = slots[i];
      const lf = lifts[i];
      const pg = pedestals[i].group;
      out[k++] = sl.visible ? 1 : 0;
      out[k++] = sl.position.x;
      out[k++] = sl.position.y;
      out[k++] = sl.position.z;
      out[k++] = sl.rotation.x;
      out[k++] = sl.rotation.y;
      out[k++] = sl.rotation.z;
      out[k++] = sl.scale.x;
      out[k++] = sl.scale.y;
      out[k++] = sl.scale.z;
      out[k++] = sl.userData.__opacity ?? 1;
      out[k++] = lf.position.y;
      out[k++] = lf.rotation.y;
      out[k++] = lf.children.length;
      out[k++] = pg.visible ? 1 : 0;
      out[k++] = pg.rotation.y;
    }
    for (const l of sigLights) {
      out[k++] = l.visible ? l.intensity : -1;
      out[k++] = l.color.r;
      out[k++] = l.color.g;
      out[k++] = l.color.b;
      out[k++] = l.position.x;
      out[k++] = l.position.y;
      out[k++] = l.position.z;
    }
    return k;
  }
  /** Khung này có cần vẽ không — trả lý do ('' = giữ ảnh cũ). */
  function renderReason(force, shadowVisible, lumaWait) {
    if (force) return 'force';
    if (!S.renderOnDemand) return 'always';
    if (renderWhy) return renderWhy;
    if (S.tx) return 'tx';
    if (S.live?.reveal) return 'reveal';
    if (S.live?.wait && S.live.proxy && !reduceMotion) return 'proxyWait'; // r19: viền thở / phần "đầy" / dải trôi
    if (fpsOn) return 'fps';
    if (lumaWait) return 'luma';
    if (shadowWanted && shadowVisible) return 'shadow';
    for (let i = 0; i < 2; i++) if (slots[i].visible && pedestals[i].group.visible && pedestals[i].animating) return 'rays';
    if (S.live?.polish && (S.live.polish !== rPolish || S.live.polish.version !== rPolishV)) return 'rub';
    if (warmUntil && performance.now() < warmUntil) return 'pointer';
    camera.updateMatrixWorld();
    if (matChanged(camera.matrixWorld, _rCam, 1e-6) || matChanged(camera.projectionMatrix, _rProj, 1e-9)) return 'camera';
    const n = poseSig();
    if (n !== rPose.length) return 'motion';
    // dung sai 1e-6 (rad / đơn vị / cường độ): đuôi quán tính OrbitControls nhích ~1e-9 mỗi khung mãi — không thấy được
    for (let i = 0; i < n; i++) if (Math.abs(rPoseNext[i] - rPose[i]) > 1e-6) return 'motion';
    return '';
  }
  /** Ghi lại trạng thái của khung VỪA vẽ (mốc so sánh cho các khung sau). */
  function noteRendered(why) {
    renderWhy = '';
    camera.updateMatrixWorld();
    _rCam.copy(camera.matrixWorld);
    _rProj.copy(camera.projectionMatrix);
    const n = poseSig();
    if (rPose.length !== n) rPose = new Float64Array(n);
    rPose.set(rPoseNext.subarray(0, n));
    rPolish = S.live?.polish ?? null;
    rPolishV = rPolish ? rPolish.version : -1;
    if (devRender) {
      devRender.rendered++;
      devRender.why[why] = (devRender.why[why] || 0) + 1;
    }
  }
  const onVisible = () => {
    if (!document.hidden) requestRender('visible');
  };
  document.addEventListener('visibilitychange', onVisible);
  const onCtxRestored = () => {
    reliefContextLost();
    requestRender('context');
  };
  renderer.domElement.addEventListener('webglcontextrestored', onCtxRestored);

  // Shadow map do RIÊNG view này quyết định: core/lighting đặt needsUpdate = true ở MỌI lần đổi cài
  // đặt (kể cả kéo cường độ / màu đèn rọi) → tick() ghi đè cờ đó ngay trước lượt vẽ bằng shadowWanted.
  let shadowWanted = true;
  const requestShadow = () => {
    shadowWanted = true;
  };
  Object.assign(K, { requestShadow });
  S.catcher = null; // dựng ở phần sàn bên dưới
  syncSpot(getSettings());
  syncKey(getSettings());
  syncPedestalLook(getSettings());
  applyIdleLighting(true);

  // ---- Sàn: 2 lớp chồng lên nhau ở y ≈ 0 (không còn gương sàn — phản chiếu nằm ở lòng bục)
  //   -2 decal hồ sáng, cộng sáng, noReflect
  //   -1 đĩa hứng bóng của đèn rọi (ShadowMaterial × nón đèn), noReflect
  const _bgCol = new THREE.Color();
  scene.background.set(cinemaBg(getSettings().bg?.cinema)); // hệ số độ tối nền: ở lượt onSettings đầu tiên
  // ---- reflect (stage/reflect.js)
  const {
    _dp, _mv, attachMirrorLod, catchGeo, contact, contactDecals, detachMirrorLod, devDishSample, devRestore,
    dishStrength, mirrors, pool, poolGeo, poolMat, reflector, stepRipple, syncContact, syncMirrorFresnel, syncMirrorScale,
    syncMirrors, syncRipple, ripple
  } = installReflect(S, K, {
    applyIdleLighting, camera, catchU, lifts, pedestals, renderer, requestRender, scene, slots, view
  });
  Object.assign(K, { dishStrength, reflector });

  // Mỗi khay chuyển cảnh mang MỘT mặt phẳng nội dung (những gì kiểu hiện thông tin / tên người
  // đỗ gắn lên). Engine di chuyển/xoay/co giãn/ghép ảnh cả khay như một khối, nên mọi thứ trên
  // mặt phẳng hưởng trọn mọi hiệu ứng mà không cần viết thêm gì.
  function makeSlotPlane() {
    const group = new THREE.Group();
    group.name = 'cinema-plane';
    // metrics: SteleMetrics của bia trên khay này (chụp lúc nó là bia hiện tại); af: độ hiện theo góc, mỗi khung
    return { group, M: null, metrics: null, af: 1, afFrame: -1, afFresh: true };
  }
  /**
   * r19: độ hiện theo góc của khay i ở khung này — đích planeAngle() (smoothstep đơn điệu của góc) qua bộ lọc
   * thời gian + trễ fadeFollow(); đo ≤ 1 lần / khung. Dùng chung cho tấm thông tin (ctx.angleFade) và tên trên thân bia.
   */
  function planeFade(i) {
    const P = planes[i];
    if (P.afFrame !== S.frameNo) {
      P.afFrame = S.frameNo;
      P.group.updateWorldMatrix(true, false);
      const target = planeAngle(P.group.matrixWorld, P.M ? P.M.lineY : 0);
      P.af = P.afFresh || reduceMotion ? target : fadeFollow(P.af, target, S.frameDt);
      P.afFresh = false;
    }
    return P.af;
  }
  const planes = [makeSlotPlane(), makeSlotPlane()];
  lifts[0].add(planes[0].group);
  lifts[1].add(planes[1].group);
  // Trạng thái "đang chọn" (thông tin đang hiện): đèn bục (dải trên + dải dưới + vũng sáng sàn +
  // tia) bật dần 500 ms (cubic), tắt 300 ms.
  S.selTarget = false;
  // Mức "đang chọn" RIÊNG cho từng bục (khay): chuyển cảnh thì bục cũ tắt dần 400 ms trên chính nó, bục
  // mới đi theo trạng thái hover (vào 500 ms) — không còn cảnh bục cũ bị cắt phụt khi đổi khay.
  const selU = [0, 0]; // 0..1 tuyến tính
  const selNow = [0, 0]; // đã làm mượt (easeInOutCubic)
  const selWas = [0, 0];
  /** Một bước của mức hover tuyến tính u về đích want (0 / 1) theo HOVER_FADE. */
  // r53: "cầm" bia (kéo bia bằng tay) — đèn dưới bục của bia đang cầm; mức đèn dưới tuyệt đối lúc cầm hẳn (không theo
  // pedestalBottomGlow — mặc định 0,2 quá mờ để làm tín hiệu "đã dính")
  const grab = { on: false, u: 0, tray: 0, side: null, held: false, kind: 'v' };
  const GRAB_GLOW = 0.55;
  // r56: … + hai mũi tên sát sàn hai bên bục — r62: thay bằng VÒNG CẦM 3D (grab-ring.js) cho cả hai cách kéo.
  // r57: "nắm bụp" = khay đang cầm (bia + bục + mũi tên + đèn dưới) THU NHỎ ~2,5 % quanh chân bục (người dùng: "việc zoom out
  // camera khi grab làm bia tiếp theo khi trượt vào cũng bị zoom out, rồi reset zoom … khá lộn xộn. hay là dùng scale cho bia
  // hiện tại để bia mới vào full size, grab thì mới scale nhỏ xuống 2-3%") — thay camera lùi của r56; camera đứng yên suốt
  // cầm → kéo → nhận. Lò xo hơi thiếu cản khi thu (~0,17 s, nảy ~4 % biên độ), tới hạn khi trả (~0,7 s). Đã nhận: khay cũ giữ
  // cỡ nhỏ khi rời đi; bia mới luôn đủ cỡ.
  const GRAB_SCALE = 0.975;
  // r64: dir — hướng của lần đổi đích gần nhất (−1 thu / +1 trả), giữ tới khi dừng (xem bước lò xo trong tick)
  const gscale = { x: 1, v: 0, want: 1, dir: 0 };
  // r59: nắm tay kéo bia — VÒNG CẦM 3D quanh bia (grab-ring.js) thay cho hai mũi tên sàn; r62: kéo bia hai ngón cũng dùng vòng
  // (bỏ hẳn mũi tên sàn pedestal-arrows.js — người dùng: "dùng cái này thay cho mũi tên của "kéo bia"")
  const grings = [createGrabRing(), createGrabRing()];
  slots[0].add(grings[0].group);
  slots[1].add(grings[1].group);
  /**
   * r64: biên dịch sẵn vòng cầm + đèn bục (dải / quầng trên + dưới, vũng sàn — lúc cầm đèn dưới bật) cho cả vẽ màn hình lẫn
   * RT ghép ảnh — lượt cầm đầu tiên không trả 14–18 ms dựng chương trình (và không va lúc MediaPipe đang khởi động). Lưới đang
   * ẩn: hiện TẠM đúng quanh lượt compile đồng bộ. Chạy một lần khi sân khấu yên lần đầu.
   */
  function precompileGrab() {
    if (S.disposed || !view.compileNow) return;
    const items = [...grings.map((g) => g.mesh), ...pedestals.flatMap((p) => p.lightParts)];
    const was = items.map((o) => o.visible);
    const rt = ensureCompositeTarget(renderer).rt;
    const jobs = [];
    try {
      for (const o of items) o.visible = true;
      for (const o of items) {
        jobs.push(view.compileNow(o, camera, scene));
        jobs.push(view.compileNow(o, camera, scene, rt));
      }
    } finally {
      items.forEach((o, i) => (o.visible = was[i]));
    }
    return Promise.all(jobs).then(() => (S.grabPrecompiled = true));
  }
  // r88: ánh sáng lúc đọc (xem tick) — mức pha (đã làm mềm) lúc đoạn tiến vào bắt đầu
  const readLight = { u0: null, mode: null };
  /** Nghịch đảo của easeInOutCubic trên [0, 1]. */
  const easeInOutCubicInv = (y) => {
    const v = Math.min(1, Math.max(0, y));
    return v < 0.5 ? Math.cbrt(v / 4) : 1 - Math.cbrt(2 * (1 - v)) / 2;
  };
  const fadeStep = (u, want, dt) => {
    if (u === want) return u;
    const dur = reduceMotion ? HOVER_FADE.reduced : want > u ? HOVER_FADE.in : HOVER_FADE.out;
    return want > u ? Math.min(1, u + dt / dur) : Math.max(0, u - dt / dur);
  };
  // ---- names (stage/names.js)
  const {
    _keyDir, buildNames, css3d, fieldLuma, inkFor, measureFieldLumaSync, namesRigs, namesStyleFor, planeAngle,
    pollFieldLuma, slotEntry, startFieldLuma, steleMetrics
  } = installNames(S, K, {
    applyIdleLighting, camera, devRender, fadeStep, opts, planes, renderer, scene, view
  });
  Object.assign(K, { fieldLuma, slotEntry });
  // Rê chuột / tay lên tấm bia: bắn tia nhiều nhất một lần mỗi nguồn mỗi khung.
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true; // three-mesh-bvh: dừng ở giao điểm gần nhất
  const _ndc = new THREE.Vector2();
  const _hnd = new THREE.Vector2();
  S.pointerActive = false;
  let pointerDirty = false;
  let mouseHit = false;
  let mouseRayAt = 0;
  let mouseLazy = false; // đang kéo: bắn tia thưa (RAY_REFRESH_MS) thay vì mỗi khung
  S.handActive = false;
  let handLazy = false;
  let handDirty = false;
  let handHit = false;
  // r67: tia của TAY trúng BỤC của bia đang hiện (thân + lòng bục) — cùng nhịp tia với handHit (index.js: body[data-hand-over])
  let handPedHit = false;
  // r74: tia của TAY trúng MẶT TRƯỚC phiến bia (không rùa, bục, hông / lưng phiến) — index.js: body[data-hand-over-face]
  let handFace = false;
  let handFaceNear = false; // r84: tay trong hình chiếu mặt bia nới rộng (giữ lượt giữ V đã bắt đầu — faceNearNdc)
  const _pedRc = new THREE.Raycaster();
  const _pedRay = new THREE.Ray();
  const _pedInv = new THREE.Matrix4();
  const _pedNdc = new THREE.Vector2();
  /**
   * r67: tia qua điểm NDC có trúng bục của khay đang hiện không — giải tích: bục là khối tròn xoay quanh trục y của nhóm bục
   * (bán kính ngoài R, cao H) → tia (đổi sang hệ nhóm bục — gồm cả xoay / dời / co của khay) giao hình trụ R × [0, H] (mặt bên
   * hoặc nắp trên). Rẻ: không duyệt lưới.
   */
  function hitPedestal(nx, ny) {
    if (!S.pedestalOn || !S.live) return false;
    const pd = pedestals[S.cur];
    if (!pd || !pd.group.visible || !slots[S.cur].visible) return false;
    _pedNdc.set(nx, ny);
    _pedRc.setFromCamera(_pedNdc, camera);
    pd.group.updateWorldMatrix(true, false);
    _pedRay.copy(_pedRc.ray).applyMatrix4(_pedInv.copy(pd.group.matrixWorld).invert());
    const R = pd.R;
    const H = pd.H;
    const o = _pedRay.origin;
    const d = _pedRay.direction;
    // nắp trên (y = H)
    if (Math.abs(d.y) > 1e-9) {
      const t = (H - o.y) / d.y;
      if (t > 0) {
        const x = o.x + d.x * t;
        const z = o.z + d.z * t;
        if (x * x + z * z <= R * R) return true;
      }
    }
    // mặt bên: (ox + t·dx)² + (oz + t·dz)² = R², 0 ≤ y ≤ H
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-12) return false;
    const b = 2 * (o.x * d.x + o.z * d.z);
    const c = o.x * o.x + o.z * o.z - R * R;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (t <= 0) continue;
      const y = o.y + d.y * t;
      if (y >= 0 && y <= H) return true;
    }
    return false;
  }
  let handRayAt = 0;
  let hoverOn = false;
  S.frameNo = 0;
  /** Người nghe trước lượt vẽ (kiểu hiện thông tin cập nhật ở đây — xem tick()). */
  let beforeRenderCb = null;
  const onHover = typeof opts.onHover === 'function' ? opts.onHover : null;
  // ---- camera (stage/camera.js)
  const {
    _corner, _lastCam, _pts, _v, _w2s, _yAxis, angleFactor, applyDistLimits, applyHomeAz, beginCamTween, cRect,
    cancelHoming, computeFit, computeHome, controls, distBase, faceOfHit, faceNearNdc, fadeFollow, fit, fitStep, goal, handInLatch, hitStele,
    home, home0, inLatch, killInertia, latchRect, livePlane, markInteraction, measure, orbitStep, pointerInLatch,
    pressEnd, pressStart, rayStats, setDistLimits, setViewAngle, slabOf, slotOfPlane, snapHome, steleScreenRect,
    stepCamTween, syncYaw, trackCamMotion, zoomCap, zoomLift, zoomLimit
  } = installCamera(S, K, {
    STELE_BOT_NDC, STELE_TOP_NDC, _hnd, _mv, _ndc, camera, holder, homeBand, homeNdc, liftY, lifts, noteFoot, orbit,
    pedestals, planes, raycaster, reduceMotion, renderer, steleNdc, topInset, viewTw, viewYaw
  });
  Object.assign(K, { computeFit, computeHome, controls, home, slotOfPlane, snapHome });
  // Hộp bao "an toàn khi xoay" của mô hình hiện tại (bán kính quét quanh trục Y).
  const bounds = {
    r: 0.31,
    yMin: 0,
    yMax: 1,
    xHalf: 0.3,
    zFront: 0.3,
    slabL: -0.3,
    slabR: 0.3,
    bandTop: 0.8, // vai vòm: nơi phiến bắt đầu thu hẹp thành trán bia
    bandBottom: 0.25, // chân phiến: ngay trên lưng rùa
    zBack: 0.2, // mặt sau phiến
    box: new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 1, 0.3)),
    // Hộp thô để bắt chuột khi cây BVH chưa dựng xong: phiến (trên lưng rùa) + khối đế (rùa).
    hitSlab: new THREE.Box3(),
    hitBase: new THREE.Box3(),
  };
  Object.assign(K, { bounds });
  /** SteleMetrics (plane-local) của bia hiện tại — dựng lại sau mỗi lần đo. */
  S.metricsCache = null;
  /** Số đo thân bia theo từng bản gốc — quét đỉnh chỉ một lần cho mỗi bia. */
  const slabCache = new Map(); // r21: theo id bia (xem measure)
  Object.assign(K, { slabCache });
  /** @type {THREE.Object3D|null} bản gốc trong cache — chỉ đọc để canh khung. */
  S.source = null;

  S.userMoved = false;
  S.homing = false;
  S.focusHold = false; // r54: focus đang giữ sau khi người xem xoay / zoom (index.js: presence.orbitHeld)
  // r58: nắm tay kéo bia — cầm từ lúc đang focus: camera đứng yên ĐÚNG CHỖ người xem đang nhìn (không về khung, không vòng hover
  // về); kéo thì đường camera của lượt lướt đi từ chỗ đó theo tiến độ tay; nhả mà không nhận → trôi về khung như rời hover
  S.grabCam = false;
  let grabReturn = false;
  S.everPresented = false;
  S.lastInteract = -1e9;
  /** DEV: tắt riêng từng nguồn sáng của trạng thái "đang chọn" để chẩn đoán chói. */
  const devSel = { strips: 1, spill: 1 };
  /** DEV: vết theo khung của các mức sáng hover (cinemaLightTrace). */
  S.devTrace = null;
  S.devCamTrace = null; // DEV: vm.cinemaCamTrace — vị trí / tâm nhìn / thời gian mỗi khung
  // "Yên" (r10): không camera tween, không chuyển cảnh, không ở chế độ xoa, đủ CALM_MS. Việc nặng chạy nền (nạp trước
  // + nung sẵn 9 bia còn lại: mỗi bia một tác vụ 50–200 ms trên luồng chính) chờ lúc yên — không rơi vào giữa đường
  // camera bay vào đầu rùa / lúc đang xoa.
  let calmSince = 0;
  let handHoldSince = 0; // r23: lúc bắt đầu giữ việc nền vì tay đang điều khiển (0 = không giữ)
  const calmWaiters = [];
  /** Hứa hẹn xong khi sân khấu "yên" (không camera tween / chuyển cảnh / chế độ xoa) đủ CALM_MS — xem calmSince. */
  function whenCalm() {
    const now = performance.now();
    if (S.disposed || (calmSince && !S.camTw && !S.tx && !S.rubOn && !orbit.seg && !S.grabBusy && now >= warmUntil && now - calmSince >= CALM_MS && document.body.dataset.handActive !== '1')) return Promise.resolve();
    return new Promise((r) => calmWaiters.push(r));
  }
  /**
   * DEV: tắt riêng từng nguồn sáng NGAY TRƯỚC lượt vẽ và trả lại ngay sau (không đụng trạng thái chuyển
   * hover) — chẩn đoán vệt sáng: key · fill · rim · hemi · env (môi trường, cả cảnh) · pedEnv
   * (envMapIntensity của đá bục — KHÔNG có tác dụng: three bỏ qua envMapIntensity của vật liệu khi môi
   * trường đến từ scene.environment, chỉ scene.environmentIntensity tính) · spot · spill · mirror.
   */
  const devMute = new Set();
  function devMuteApply() {
    const undo = [];
    const set = (o, k, v) => {
      undo.push([o, k, o[k]]);
      o[k] = v;
    };
    for (const m of devMute) {
      if (m === 'key') set(cineKey, 'intensity', 0);
      else if (m === 'fill') set(lights.fill, 'intensity', 0);
      else if (m === 'rim') {
        set(lights.rim, 'intensity', 0);
        for (let i = 0; i < 2; i++) pedestals[i].updateView(camera, lights.rim); // bỏ luôn phần trừ rim trên đá bục
      }
      else if (m === 'hemi') set(lights.hemi, 'intensity', 0);
      else if (m === 'env') set(scene, 'environmentIntensity', 0);
      else if (m === 'spot') set(idleSpot, 'intensity', 0);
      else if (m === 'spill') set(spill, 'intensity', 0);
      else if (m === 'mirror') for (const mm of mirrors) set(mm.mesh, 'visible', false);
      else if (m === 'pedEnv')
        for (const pd of pedestals) for (const mat of Object.values(pd.materials)) set(mat, 'envMapIntensity', 0);
    }
    return () => {
      for (let i = undo.length - 1; i >= 0; i--) undo[i][0][undo[i][1]] = undo[i][2];
    };
  }
  let frameCb = null;
  let shadowTick = 0;
  S.swayT = 0; // pha lắc (giây) — đóng băng khi người dùng đang thao tác
  S.swayT0 = 0; // mốc pha: bia mới luôn vào ở tư thế chính diện
  S.swayRamp = 0; // 0..1, tăng/giảm dần nên vận tốc không nhảy bậc
  S.swayOffset = 0; // góc còn dư lúc đổi mốc pha, tắt dần → đổi bia không giật
  const swaySpring = { y: 0, v: 0, t: 0 }; // (r13) góc lắc đang tắt dần về 0 khi hover / xoa giữ lắc lại (rad, rad/s, s)
  let swayHeld = false;
  S.autoRotate = getSettings().autoRotate !== false;

  // Đèn ăn theo cài đặt chung; rồi tới lượt cảnh (nền / sương / gương / bóng).
  // Thứ tự đăng ký quan trọng: bindLightsToSettings áp exposure TRƯỚC, nhờ vậy
  // màu sương tính ở dưới đã dùng đúng exposure mới.
  const offLights = bindLightsToSettings(lights);
  const offSettings = onSettings((s, path) => {
    requestRender('settings');
    fpsOn = !!s.showFps;
    // Chỉ đổi cài đặt bục (đang kéo thanh trượt) → không xin vẽ lại bóng / gương mỗi sự kiện:
    // phần bục tự lo (một lần khi dừng tay).
    const pedOnly = typeof path === 'string' && path.startsWith('pedestal');
    // Nền + sương + hồ sáng sàn nhân hệ số độ tối nền (settings.cinemaBgDark) — không đụng đèn bia / bục.
    const bgK = bgDarkK(clampNum(Number(s.cinemaBgDark), 0, 1, DEFAULTS.cinemaBgDark));
    const bg = _bgCol.set(cinemaBg(s.bg?.cinema)).multiplyScalar(bgK);
    scene.background.copy(bg);
    // Sương pha màu TRƯỚC tone mapping → phải dùng bản đã giải ngược, nếu không phần sàn xa sẽ tối
    // hơn nền một cách thấy rõ.
    const pre = fogColorFor(bg, renderer.toneMappingExposure);
    scene.fog.color.copy(pre);
    poolMat.uniforms.uK.value = bgK;
    S.dishGlass = clampNum(Number(s.dishGlass), 0, 1, DEFAULTS.dishGlass);
    for (const pd of pedestals) pd.setDishGlass(S.dishGlass);
    syncRipple(s); // r63: mặt lòng bục gợn nhẹ (chỉ uniform — lượt vẽ đã xin ở đầu hàm)
    reflector.setStrength(dishStrength(s));
    setViewAngle(s.cinemaViewAngle);
    S.hoverZoom = clampNum(Number(s.cinemaHoverZoom), 0, 0.25, DEFAULTS.cinemaHoverZoom);
    if (orbit.want) S.zoomEff = zoomLimit(); // kéo thanh zoom lúc đang hover: áp ngay (đã kẹp)
    const hf = s.cinemaHoverFront !== false;
    if (hf !== S.hoverFront) {
      S.hoverFront = hf;
      applyHomeAz();
      if (!S.userMoved && !S.camTw) snapHome(); // bật / tắt giữa lúc đang hover: về khung mới ngay (hiếm)
    }
    syncContact(s);
    // Đèn rọi: hướng / góc chùm đổi → shadow map vẽ lại (một lần mỗi khung dù sự kiện dồn dập).
    const spotMoved = syncSpot(s);
    syncKey(s);
    syncPedestalLook(s);
    // Đèn preset vừa được core áp lại theo cài đặt → chụp gốc mới rồi áp lại trạng thái chưa hover / hover.
    captureLightBase();
    S.contrast = clampNum(s.cinemaContrast, 0, 1, DEFAULTS.cinemaContrast);
    applyIdleLighting(true);
    S.autoRotate = s.autoRotate !== false;
    // Shadow map chỉ phụ thuộc hình khối + vị trí / nón đèn rọi: lần đầu / đặt lại mặc định, hoặc đèn
    // rọi dời. Bục bật/tắt, cỡ bục tự xin (setPedestalOn / settlePedestal). Cường độ, màu, phơi sáng,
    // độ đậm bóng … chỉ là uniform → không vẽ lại.
    if (path == null || spotMoved) requestShadow();
    if (!pedOnly) {
      reflector.invalidate();
    } else if (path !== 'pedestalSize' && path !== 'pedestalText') {
      reflector.invalidate(); // màu / độ sáng đèn bục: gương soi lại (không cần bóng)
    }
    // Đèn / phơi sáng đổi → độ sáng mặt đá đổi → đo lại.
    const sig = `${s.exposure}|${s.key}|${s.env}|${s.spotIntensity}|${s.spotColor}|${s.spotAngle}|${s.spotSoftness}|${s.spotAzimuth}|${s.spotElevation}`;
    if (sig !== S.lumaSig) {
      S.lumaSig = sig;
      fieldLuma.clear();
      S.lumaAt = 0;
    }
    S.namesStyle = s.cinemaNamesStyle || 'auto';
    const names = !!s.cinemaNames;
    if (namesRigs && names !== S.namesOn) {
      S.namesOn = names;
      if (names) buildNames(S.cur);
      else for (const r of namesRigs) r.clear();
    }
    // Bục: màu / độ sáng đèn áp ở khung kế tiếp (tick); bật/tắt bục thì nâng/hạ bia + canh khung lại.
    S.pedLights = pedLightsOf(s);
    const size = clampNum(s.pedestalSize, 0.95, 1.4, DEFAULTS.pedestalSize);
    const text = clampNum(s.pedestalText, 0.4, 1, DEFAULTS.pedestalText);
    if (size !== S.pedSize) {
      S.pedSize = size;
      S.pedSizeDirty = true; // hình bục: khung kế tiếp
      S.pedSettleAt = performance.now() + PED_SETTLE_MS; // chữ nổi / bóng / khung: khi dừng tay
    }
    syncReliefDepth(s);
    const sep = s.pedestalSep || 'dot';
    const look = pedLookOf(s);
    if (look.sharp !== S.pedLook.sharp || look.profile !== S.pedLook.profile) {
      S.pedLook = look;
      S.pedSettleAt = performance.now() + PED_SETTLE_MS; // dựng lại chữ nổi như khi đổi cỡ chữ
    }
    if (sep !== S.pedSep) {
      S.pedSep = sep;
      S.pedSettleAt = performance.now() + PED_SETTLE_MS; // dựng lại chữ nổi như khi đổi cỡ chữ
    }
    if (text !== S.pedText) {
      S.pedText = text;
      S.pedSettleAt = performance.now() + PED_SETTLE_MS;
    }
    const ped = s.cinemaPedestal !== false;
    if (ped !== S.pedestalOn) setPedestalOn(ped);
  });
  // Bục: MỘT cỡ cho mọi bia (R0 × pedestalSize) — đặt ngay từ đầu (r19): bản đồ chữ của cửa sổ bia quanh bia đầu tiên
  // được dựng trước cả lần present() đầu, theo đúng kích thước dải vát sẽ dùng.
  for (const pd of pedestals) pd.setSize(pedestalR0(), S.pedSize);
  S.vw = view.width; // bề ngang khung nhìn — quyết định HUD dưới xếp chồng hay nằm ngang
  S.vh = view.height;

  /** @typedef {{inst:THREE.Object3D, slot:THREE.Group}} Shot */
  /** @type {Shot|null} bia đang hiển thị */
  S.live = null;
  /** @type {Shot|null} bia đang rời đi trong khay kia */
  S.retiring = null;
  /** @type {{update(dt:number):boolean, cancel():void}|null} */
  S.tx = null;
  S.cur = 0; // khay đang giữ bia hiện tại
  let txHold = false; // DEV: ghim tiến độ chuyển cảnh để chụp
  // ---- lod (stage/lod.js)
  const {
    TEX_KEYS, endLodFade, endReveal, isSettled, nextFrame, polishNormalStats, preheatStats, prepareInstance,
    preparedRoots, settledWaiters, stepLodFade, stepProxyWait, stepReveal, stripTex, stripUpload, takeInstance,
    texturesOf, trimWarm, useStripTextures, warm, warmInstance, api: lodApi
  } = installLod(S, K, {
    attachMirrorLod, bounds, camera, contact, contactDecals, fieldLuma, namesRigs, pedestals, preheatNow, reduceMotion,
    reflector, renderer, requestRender, requestShadow, scene, slabOf, slotEntry, view
  });
  Object.assign(K, { nextFrame, prepareInstance, preparedRoots });
  // ---- transition (stage/transition.js)
  const {
    drop, scrubOwns, scrubStep, api: transitionApi
  } = installTransition(S, K, {
    _v, attachMirrorLod, beginCamTween, buildNames, camera, computeFit, computeHome, contact, contactDecals,
    detachMirrorLod, endLodFade, endReveal, goal, heatBand, holder, liftY, lifts, measure, namesRigs, pedestalR0,
    pedestals, planes, readyRelief, reduceMotion, reflector, refreshRelief, requestRender, requestShadow, slotEntry,
    slots, snapHome, steleMetrics, stepProxyWait, swaySpring, syncMirrors, takeInstance, warm
  });
  // ---- rub (stage/rub.js)
  const {
    applyRubLook, computeRubGoal, headWorld, offRubCleared, offRubSettings, rubGoal, rubRestoreStep, rubScreen,
    rubStateFor, rubZoomK, saveLiveRub, setRubMode, api: rubApi
  } = installRub(S, K, {
    _yAxis, applyDistLimits, beginCamTween, cRect, camera, controls, distBase, home0, raycaster, reduceMotion, warm
  });
  Object.assign(K, { applyRubLook, rubGoal, rubStateFor, saveLiveRub, setRubMode });
  // ---- r82b chữ Hán (stage/glyphs.js) — đọc vạch / vệt của quét bản dập, nghe sự kiện mở / đóng của lớp đọc
  const { glyphStep, setScanSource, setLookSource, api: glyphApi, dispose: glyphDispose } = installGlyphs(S, K, { THREE, renderer, camera, reduceMotion, slotEntry, cRect });
  // ---- r74 quét bản dập (stage/scan.js)
  const { scanStep, api: scanApi } = installScan(S, K, { THREE, renderer, requestRender, reduceMotion, slotEntry, glyph: { setScanSource, setLookSource, api: glyphApi } });
  Object.assign(K, { scanFrame: scanApi.scanFrame });
  // ---- r74 khung đọc toàn văn (stage/read.js)
  const { readGoal, readStep, api: readApi } = installRead(S, K, { THREE, camera, controls, beginCamTween, applyDistLimits, killInertia, cRect, reduceMotion, raycaster, keyLight: () => cineKey.position });
  Object.assign(K, { readGoal });

  computeHome();
  snapHome();

  // r80 (người dùng: "đóng toàn văn lần đầu lùi êm, các lần sau giật về nhanh"): renderer.js đổi DPR thích ứng ~220 ms sau MỌI
  // lần nhả chuột / nhón (kể cả bấm nút Đóng) → gọi lại đây với CÙNG cỡ CSS; trước r80 lần gọi đó snapHome() — huỷ đoạn camera
  // đang chạy (lùi khỏi khung đọc, vào / rời hover) và đặt camera thẳng vào khung đích trong một khung. Nay: cùng cỡ → chỉ vẽ
  // lại; đổi cỡ thật mà đang có đoạn camera → để đoạn đó tự tới khung mới (goal() tính lại mỗi khung), không giật.
  let cssWH = '';
  view.onResize((w, h) => {
    requestRender('resize'); // đổi cỡ canvas xoá trắng bộ đệm vẽ
    const key = `${w}x${h}`;
    if (key === cssWH) return;
    cssWH = key;
    S.vw = w;
    S.vh = h;
    S.canvasRect = null;
    css3d?.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    computeHome();
    computeFit();
    buildNames(S.cur); // cỡ ô tên theo px phụ thuộc khung nhìn
    if (!S.userMoved && !S.camTw) snapHome();
  });
  css3d?.setSize(S.vw, S.vh);

  /**
   * DEV: đưa cảnh về đúng khung mặc định để đo — kết thúc chuyển cảnh, lắc = 0, camera
   * về chỗ, và giữ lắc đứng yên trong lúc __vm.snap() chạy đồng bộ các khung.
   */
  function devHome(pose) {
    S.tx?.cancel();
    S.tx = null;
    txHold = false;
    S.swayT0 = S.swayT;
    S.swayOffset = 0;
    S.swayRamp = 0;
    swaySpring.y = swaySpring.v = 0;
    holder.rotation.y = 0;
    S.lastInteract = performance.now();
    snapHome();
    // Tuỳ chọn: quay camera quanh mục tiêu khung mặc định (độ) để kiểm tra luật mờ theo góc.
    // zoom (< 1 = lại gần) + tx / ty (dời tâm nhìn, đơn vị thế giới): cận cảnh mặt bia để so chữ khắc.
    if (pose && (pose.az || pose.el || pose.zoom || pose.tx || pose.ty)) {
      // az tính từ góc nhìn mặc định (settings.cinemaViewAngle)
      const az = S.viewAz + THREE.MathUtils.degToRad(pose.az || 0);
      const el = THREE.MathUtils.degToRad(pose.el ?? THREE.MathUtils.radToDeg(ELEVATION));
      controls.target.copy(home.target).add(_v.set(pose.tx || 0, pose.ty || 0, 0).applyAxisAngle(_yAxis, S.viewAz));
      camera.position
        .copy(controls.target)
        .add(_v.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(home.dist * (pose.zoom || 1)));
      controls.update();
      // capture() gọi resize() trước tiên → onResize sẽ tự về khung nếu coi như chưa ai
      // đụng vào camera. Đánh dấu là đã di chuyển để tư thế thử nghiệm được giữ nguyên.
      S.userMoved = true;
    }
    requestShadow();
    reflector.invalidate();
  }
  /** DEV: ghim chuyển cảnh đang chạy ở đúng tiến độ p (0..1) để chụp giữa chặng. */
  function devHoldTx(p) {
    if (!S.tx) return false;
    const target = THREE.MathUtils.clamp(p, 0, 0.999);
    if (target > S.tx.progress) S.tx.update((target - S.tx.progress) * S.tx.duration);
    txHold = true;
    return S.tx.progress;
  }
  function devReleaseTx() {
    txHold = false;
  }
  /** DEV: toạ độ px khung nhìn (client) của giữa thân bia (cho giả lập cử chỉ tay/chuột). */
  function devSteleScreenPoint() {
    const L = livePlane().M;
    const y = bounds.yMin + 0.6 * (bounds.yMax - bounds.yMin) + liftY();
    camera.updateMatrixWorld();
    // Toạ độ trên bia → thế giới qua ma trận của khay bia (lift: đã gồm độ nâng + phép xoay ngược góc nhìn).
    lifts[S.cur].updateWorldMatrix(true, false);
    _v.set((bounds.slabL + bounds.slabR) / 2, y - liftY(), L ? L.zFront : bounds.zFront).applyMatrix4(lifts[S.cur].matrixWorld).project(camera);
    const r = cRect();
    return { x: r.left + ((_v.x + 1) / 2) * r.width, y: r.top + ((1 - _v.y) / 2) * r.height };
  }
  // ---- dev (stage/dev.js)
  installStageDev(S, K, {
    TEX_KEYS, _corner, _dp, _pts, _v, applyDistLimits, applyIdleLighting, bounds, camera, cineKey, computeFit,
    computeHome, contact, contactDecals, controls, devHoldTx, devHome, devMute, devReleaseTx, devRender, devRestore,
    devSel, fieldLuma, footMax, goal, headWorld, holder, home, homeBand, homeNdc, idleSpot, inkFor, keyCfg, killInertia,
    latchRect, lifts, lights, markInteraction, measureFieldLumaSync, mirrors, orbit, pedStats, pedestalR0, pedestals,
    placeIdleSpot, polishNormalStats, pool, preheatStats, rayStats, reflector, refreshRelief, reliefGpu, renderer,
    requestRender, requestShadow, rubGoal, rubScreen, rubZoomK, scene, selNow, selU, setRubMode, slotEntry, slots,
    snapHome, spill, steleNdc, stripTex, swaySpring, syncContact, syncMirrorScale, syncMirrors, syncSpot, tick, view,
    zoomCap, zoomLift, zoomLimit
  });

  /** Một lần nung (xem api.preheat): chia lát, mỗi lát một tác vụ sau một khung hình. */
  async function preheatNow(root3d, { keep = false, entry = null, urgent = false } = {}) {
    if (!isLowPowerDevice()) requestBVH(root3d);
    // (r19: chữ nổi trên bục không còn dựng ở đây — cửa sổ chữ khắc setReliefWindow lo, theo vị trí bia đang xem.)
    // r16: chia thành từng LÁT, mỗi lát một tác vụ riêng sau một khung hình (không còn một tác vụ 50–70 ms): pháp tuyến
    // mượt vùng đầu rùa · bản sao + vật liệu · từng texture lên GPU · biên dịch (thường, rồi biến thể quét hiện) · bóng
    // tiếp xúc. Giữa các lát, sân khấu đang động (vừa bấm đổi bia / hover…) thì chờ yên lại rồi mới làm tiếp (urgent:
    // không chờ — mở màn, màn tối đang che).
    const T = import.meta.env.DEV ? { id: root3d.name, steps: [] } : null;
    const step = (name, fn) => {
      const t0 = performance.now();
      const r = fn();
      T?.steps.push([name, +(performance.now() - t0).toFixed(1)]);
      return r;
    };
    const slice = async () => {
      await nextFrame();
      if (!urgent) await whenCalm();
    };
    step('normals', () => ensurePolishNormals(THREE, root3d, headOf(root3d.name)));
    step('measure', () => slabOf(root3d)); // r21: số đo phiến sẵn → present() không quét đỉnh
    await slice();
    if (S.disposed) return;
    // Biên dịch ĐÚNG biến thể sẽ vẽ: bản sao đã clone vật liệu + tinh chỉnh + gắn shader độ bóng (r8) — bản
    // gốc của loader không mang shader đó. Bản sao được giữ lại (warm) cho present() dùng luôn, nên chương
    // trình không bị giải phóng giữa lúc biên dịch và lúc hiện.
    // keep: hàng xóm của bia đang hiện (view gọi cho bia trước / sau) — không bị đẩy khỏi bộ đệm tới lần present() sau.
    const w = step('instance', () => warmInstance(root3d, keep));
    w.busy++; // đang nung: không huỷ vật liệu giữa lúc chờ link (trimWarm)
    try {
      for (const tex of texturesOf(w.inst)) {
        const t0 = performance.now();
        const dst = await stripUpload(tex, slice);
        if (S.disposed) return;
        if (!dst && !renderer.properties.has(tex)) {
          await slice();
          step('texture', () => renderer.initTexture(tex)); // không chia dải được → một lần như cũ
        } else T?.steps.push(['texture-strips', +(performance.now() - t0).toFixed(0)]);
      }
      // bản sao nung sẵn + bia đang / vừa hiện của cùng bản gốc → texture theo dải
      useStripTextures(w.inst);
      if (S.live) useStripTextures(S.live.inst);
      if (S.retiring) useStripTextures(S.retiring.inst);
      await slice();
      if (S.disposed) return;
      const t0 = performance.now();
      await view.preheat(w.inst, scene, camera);
      T?.steps.push(['compile', +(performance.now() - t0).toFixed(1)]);
      // r21: LOD1 → LOD0 tại chỗ vẽ bản LOD1 cũ ở dạng TRONG SUỐT (mờ dần) — biến thể chương trình khác (OPAQUE) → biên
      // dịch sẵn (mọi LOD1 dùng chung chương trình: chỉ lần đầu tốn).
      if ((root3d.userData.lod ?? 0) === 1) {
        await slice();
        if (S.disposed) return;
        const ms = [];
        w.inst.traverse((o) => {
          if (o.isMesh && o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) ms.push(m);
        });
        for (const m of ms) m.transparent = true;
        try {
          await view.preheat(w.inst, scene, camera);
        } finally {
          for (const m of ms) m.transparent = false;
        }
      }
      // Biến thể quét hiện (r16, VM_REVEAL) của CÙNG vật liệu: biên dịch luôn bây giờ → lúc quét không dựng shader.
      const pol = w.inst.userData.polish;
      if (pol) {
        await slice();
        if (S.disposed) return;
        pol.setRevealVariant(true);
        try {
          await view.preheat(w.inst, scene, camera);
        } finally {
          pol.setRevealVariant(false);
        }
      }
      // r41: vẽ thử bản sao MỘT lần như lượt ghép ảnh sẽ vẽ nó (ô 8 × 8 giữa RT ghép ảnh) — lần vẽ đầu của một bia mới tốn
      // thêm 12–25 ms GPU, trước r41 rơi đúng khung bia hiện ra trong lượt lướt (~8 % tiến độ); nay rơi vào lúc nung (yên).
      await slice();
      if (S.disposed) return;
      step('warmDraw', () => warmComposite(renderer, scene, camera, w.inst));
      // Lúc rảnh sau khi tải: nướng luôn bóng tiếp xúc (một lượt vẽ mô hình + hai lượt nhoè 256²)
      // → present() không phải làm gì thêm.
      await slice();
      if (S.disposed) return;
      step('contact', () => contact.bake(root3d));
      w.done = true;
      preparedRoots.add(root3d);
    } finally {
      w.busy--;
    }
    if (S.disposed) return;
    trimWarm();
    await slice();
    if (S.disposed) return;
    step('prime', () => view.primePrograms());
    if (T) preheatStats.push(T);
  }

  // ---- Vòng lặp
  // Vòng rAF: vẽ theo yêu cầu (renderReason), trừ lúc renderer đang bơm khung cho capture()/bench() (DEV).
  const frameTick = (dt) => tick(dt, view.forcing);
  Object.assign(K, { frameTick });
  /**
   * Một khung. `force` (mặc định true — mọi lời gọi trực tiếp, vd. DEV đo / chụp, đều vẽ): bỏ qua vẽ theo yêu cầu.
   */
  function tick(dt, force = true) {
    const now = performance.now();
    S.frameDt = dt;
    pollFieldLuma();
    // r64: lượt kéo / lướt đang chạy → vòng vẽ theo dõi khung trễ, trần 120 → 60 cho hết lượt nếu quá ngân sách (core/renderer)
    view.setTransitionBusy?.(transitionApi.scrub?.mode === 'drag' ? 'drag' : S.tx || transitionApi.scrub ? 'glide' : null);
    const idle = (now - S.lastInteract) / 1000;

    // Lắc: pha chỉ chạy khi rảnh tay, và tăng/giảm tốc dần trong SWAY_RAMP giây.
    // Pha liên tục ⇒ dừng rồi lắc lại không hề có cú giật vị trí.
    // Chuyển cảnh: góc lắc lúc bắt đầu tắt dần THEO TIẾN ĐỘ chuyển cảnh (cùng easing), biên độ lắc của
    // bia mới tăng dần từ 0 → không nhảy lúc bắt đầu, không bật lúc kết thúc.
    let swayAmp = S.tx && S.txSway ? easeInOutCubic(S.tx.progress) : 1;
    // r28: giữ trên đầu rùa → lắc / lò xo / vòng camera hover / tween camera không chạy (bước thời gian 0) — xem holdFreeze
    const frozen = S.holdFreeze && !S.rubOn && !S.readOn && !S.tx;
    const sdt = frozen ? 0 : dt;
    // Hover (camera vòng về chính diện) / xoa đầu rùa: giữ lắc lại — xem SWAY_HOLD_W. Giữ tới khi vòng camera đã về gần
    // hết (hysteresis: hover chập chờn giữa chừng không nhả rồi bắt lại).
    // r54: … và lúc focus còn giữ sau khi người xem tự xoay / zoom (bia đứng yên đúng góc họ chọn)
    const holdSway = (S.hoverFront && (orbit.want === 1 || orbit.f > SWAY_RESUME_F)) || S.rubOn || S.readOn || S.focusHold || S.grabCam;
    if (holdSway && !swayHeld) {
      swayHeld = true;
      const ph = ((S.swayT - S.swayT0) / SWAY_PERIOD) * Math.PI * 2;
      const w = (Math.PI * 2) / SWAY_PERIOD;
      swaySpring.y += SWAY_A * swayAmp * Math.sin(ph);
      swaySpring.v += SWAY_A * swayAmp * Math.cos(ph) * w * S.swayRamp;
      swaySpring.t = 0;
      S.swayT0 = S.swayT; // pha 0: lúc lắc lại bắt đầu từ chính diện, vận tốc tăng dần từ 0
      S.swayRamp = 0;
    } else if (!holdSway && swayHeld) swayHeld = false;
    const wantSway = !reduceMotion && S.autoRotate && idle > IDLE_SPIN && !swayHeld;
    S.swayRamp = THREE.MathUtils.clamp(S.swayRamp + ((wantSway ? 1 : -1) * sdt) / SWAY_RAMP, 0, 1);
    const swaying = S.swayRamp > 0.001;
    if (swaying) S.swayT += sdt * S.swayRamp;
    if (swaySpring.y !== 0 || swaySpring.v !== 0) {
      // lò xo tắt dần tới hạn (Euler bán ẩn, bước con ≤ 1/120 s cho chắc)
      // độ cứng tăng êm trong SWAY_HOLD_IN giây đầu → gia tốc cũng liền (không chỉ vận tốc)
      const n = Math.max(1, Math.ceil(sdt * 120));
      const h = sdt / n;
      for (let i = 0; i < n; i++) {
        swaySpring.t += h;
        const e = Math.min(1, swaySpring.t / SWAY_HOLD_IN);
        const w = SWAY_HOLD_W * e * e * (3 - 2 * e);
        swaySpring.v += (-2 * w * swaySpring.v - w * w * swaySpring.y) * h;
        swaySpring.y += swaySpring.v * h;
      }
      if (Math.abs(swaySpring.y) < 1e-5 && Math.abs(swaySpring.v) < 1e-4) swaySpring.y = swaySpring.v = 0;
    }
    if (S.tx && S.txSway) {
      S.swayOffset = S.txSway.from * (1 - swayAmp);
    } else {
      S.txSway = null;
      if (S.swayOffset !== 0) {
        S.swayOffset *= Math.exp(-SWAY_SETTLE * sdt);
        if (Math.abs(S.swayOffset) < 2e-4) S.swayOffset = 0;
      }
    }
    // Xoa đầu rùa: mức vào chế độ (tên người đỗ mờ đi cùng nhịp); lắc đã được giữ ở trên.
    S.rubK = THREE.MathUtils.clamp(S.rubK + ((S.rubOn ? 1 : -1) * dt) / RUB_SWAY, 0, 1);
    holder.rotation.y =
      SWAY_A * swayAmp * Math.sin(((S.swayT - S.swayT0) / SWAY_PERIOD) * Math.PI * 2) + S.swayOffset + swaySpring.y;
    const holderMoving = swaying || S.swayOffset !== 0 || swaySpring.y !== 0;

    // Chuyển cảnh (core/transitions.js) — engine tự lo tư thế + opacity của hai khay.
    let tweening = false;
    if (S.tx) {
      // Bàn giao đổ bóng giữa hai khay do chính engine lo (mỗi hiệu ứng một thời lượng).
      // r53: lượt kéo bia bằng tay (stage/transition.js scrub) — tiến độ do tay / đoạn chạy nốt / lò xo đặt, không tự chạy
      const running = scrubOwns() ? scrubStep(dt) : txHold || S.tx.update(dt);
      if (!running && S.tx) {
        S.tx = null;
        requestRender('tx'); // khung cuối: khay cũ ẩn, khay mới đục hẳn
        trimReliefGpu(); // khay cũ đã rời: bản GPU chữ của nó (nếu ngoài ±1) trả lại
        // Con trỏ đứng yên suốt lúc chuyển → bắn tia lại ngay cho bia mới.
        pointerDirty = S.pointerActive;
        handDirty = S.handActive;
      }
      tweening = true;
    }

    // Rê chuột / tay: bắn tia nhiều nhất MỘT lần mỗi nguồn mỗi khung, bỏ qua khi đang chuyển cảnh.
    // Con trỏ đứng yên mà bia đung đưa / camera trôi thì thứ nằm dưới nó vẫn đổi → bắn lại
    // theo nhịp RAY_REFRESH_MS thay vì mỗi khung (tia xuyên lưới hàng trăm nghìn tam giác).
    const camMoving = _lastCam.distanceToSquared(camera.position) > 1e-10;
    _lastCam.copy(camera.position);
    if (holderMoving || camMoving) {
      if (S.pointerActive && now - mouseRayAt > RAY_REFRESH_MS) pointerDirty = true;
      if (S.handActive && now - handRayAt > RAY_REFRESH_MS) handDirty = true;
    }
    if (S.tx) {
      mouseHit = false;
      handHit = false;
      handPedHit = false;
      handFace = false;
    } else {
      if (pointerDirty && !(mouseLazy && now - mouseRayAt < RAY_REFRESH_MS)) {
        pointerDirty = false;
        mouseRayAt = now;
        mouseHit = S.pointerActive && hitStele(_ndc.x, _ndc.y);
      }
      if (handDirty && !(handLazy && now - handRayAt < RAY_REFRESH_MS)) {
        handDirty = false;
        handRayAt = now;
        handHit = S.handActive && hitStele(_hnd.x, _hnd.y);
        handFace = handHit && faceOfHit(); // r74: cùng lượt tia, không bắn thêm
        handPedHit = S.handActive && !handHit && hitPedestal(_hnd.x, _hnd.y); // r67 (trúng bia thì khỏi thử bục)
      }
    }
    // r84: mỗi khung (rẻ — chiếu 4 góc khung mặt): camera nhích vào làm mặt bia trôi dưới tay
    handFaceNear = !S.tx && S.handActive && faceNearNdc(_hnd.x, _hnd.y);
    if (mouseHit !== hoverOn) {
      hoverOn = mouseHit;
      onHover?.(mouseHit); // con trỏ chuột "bấm được" chỉ theo chuột
    }

    const angle = angleFactor();
    S.angleNow = reduceMotion ? angle : fadeFollow(S.angleNow, angle, dt);


    // Bục đứng yên dưới bia đang lắc: xoay ngược góc lắc của holder VÀ góc nhóm viewYaw → bục thẳng hàng
    // với bia trong thế giới; khung 3/4 chỉ là camera đi vòng sang bên, chữ trên bục quay đi cùng cả cụm
    // như một bệ thật.
    pedestals[0].group.rotation.y = -holder.rotation.y - S.yawNow;
    pedestals[1].group.rotation.y = -holder.rotation.y - S.yawNow;

    // Thanh cỡ bục: dựng lại hình (gộp mọi sự kiện trong khung thành một lần) — rẻ; gương vẽ lại
    // theo vì bục nằm sát mặt gương. Chữ nổi / bóng / khung camera: một lần khi dừng tay.
    if (S.pedSizeDirty) {
      S.pedSizeDirty = false;
      const t0 = performance.now();
      const r0 = pedestalR0();
      for (let i = 0; i < 2; i++) pedestals[i].setSize(r0, S.pedSize);
      syncMirrors();
      pedStats.rebuilds++;
      pedStats.rebuildMs = Math.max(pedStats.rebuildMs, performance.now() - t0);
      reflector.invalidate();
    }
    if (S.pedSettleAt > 0 && performance.now() >= S.pedSettleAt) settlePedestal();

    // "Đang chọn" (thông tin hiện): đèn bục bật 500 ms, tắt 300 ms (cubic); đang chuyển
    // cảnh → tắt nhanh ×3.
    // "Đang chọn" (thông tin hiện): đèn của TỪNG bục theo nhịp HOVER_FADE. Chỉ bục đang hiển thị (và
    // không đang chuyển cảnh) được bật; bục vừa rời khay tắt dần trên chính nó.
    let selMoved = false;
    for (let i = 0; i < 2; i++) {
      const want = i === S.cur && S.selTarget && !S.tx ? 1 : 0;
      const u = fadeStep(selU[i], want, dt);
      if (u !== selU[i]) {
        selU[i] = u;
        selMoved = true;
      }
      selNow[i] = easeInOutCubic(selU[i]);
    }
    // Dải sáng + vũng sáng nằm sát mặt gương: còn đổi thì ảnh phản chiếu phải vẽ lại theo.
    if (selMoved) reflector.invalidate();
    // Ánh sáng bia: chưa hover (kịch tính) ↔ hover (sáng đều), cùng nhịp HOVER_FADE. Theo ĐÚNG tín hiệu
    // hover — lúc chuyển cảnh lớp thông tin tự ẩn nên tắt dần 400 ms. Chỉ đổi cường độ (applyIdleLighting).
    // r88 (người dùng): ĐỌC TOÀN VĂN dùng ánh sáng LÚC NGHỈ (đèn rọi cố định, xiên — tương phản + nét khắc rõ hơn). Đoạn camera tiến
    // vào: chuyển từ ánh sáng lúc bắt đầu (thường là focus) sang nghỉ theo ĐÚNG tiến độ + đường cong của camera (mức pha ánh sáng =
    // đường cong camera — applyIdleLighting tự làm mềm bằng easeInOutCubic nên ở đây đặt nghịch đảo của nó); đang đọc: nghỉ; lùi ra:
    // chuyển về trạng thái view trở lại (focus nếu còn focus) theo đoạn lùi. Ngoài lúc đọc: như cũ (HOVER_FADE).
    const lightWant = S.selTarget || S.rubOn ? 1 : 0;
    const tw = S.camTw;
    let lu;
    if (tw?.kind === 'read' && !S.tx) {
      readLight.u0 ??= easeInOutCubic(S.lightU);
      const c = Math.min(1, Math.max(0, tw.curve(tw.t)));
      lu = Math.min(S.lightU, easeInOutCubicInv(readLight.u0 * (1 - c)));
      readLight.mode = 'in';
    } else if (S.readOn) {
      lu = 0;
      readLight.mode = 'read';
    } else if (tw?.kind === 'read-out' && !S.tx) {
      readLight.u0 = null;
      const c = Math.min(1, Math.max(0, tw.curve(tw.t)));
      lu = Math.max(S.lightU, easeInOutCubicInv(lightWant * c));
      readLight.mode = 'out';
    } else {
      readLight.u0 = null;
      readLight.mode = null;
      lu = fadeStep(S.lightU, lightWant, dt);
    }
    if (lu !== S.lightU) {
      S.lightU = lu;
      applyIdleLighting();
      reflector.invalidate(); // lòng bục soi lại mô hình vừa đổi sáng
    }
    // r53: tay đang CẦM bia (kéo bia, app/vdrag.js) → đèn dưới của bục bia đó sáng dần (chỉ đèn dưới — không phải dáng focus)
    const gu = fadeStep(grab.u, grab.on ? 1 : 0, dt);
    const grabMoved = gu !== grab.u;
    grab.u = gu;
    const grabK = [grab.tray === 0 ? easeInOutCubic(gu) : 0, grab.tray === 1 ? easeInOutCubic(gu) : 0];
    if (grabMoved) reflector.invalidate();
    // r56 → r62: vòng cầm 3D — bật theo cầm (khay đang cầm, cả nắm tay lẫn hai ngón); đã nhận: giữ nguyên trên khay rời đi,
    // tắt hẳn khi lướt xong
    const commitHold = transitionApi.scrub?.mode === 'commit';
    for (let i = 0; i < 2; i++) {
      const mine = i === grab.tray;
      const hold = mine && !grab.on && commitHold;
      const a = grings[i];
      if (mine && grab.held && !hold && !grab.on) a.off(); // lướt nhận xong: khay cũ đã rời khung
      if (a.update(dt, camera, { on: mine && grab.on, side: grab.side, hold, reduceMotion })) requestRender('grab-ring');
    }
    // r57: cỡ khay đang cầm — áp SAU bước chuyển cảnh của khung này (engine đặt lại scale 1 mỗi bước)
    {
      const want = !reduceMotion && (grab.on || (commitHold && !grab.on)) ? GRAB_SCALE : 1;
      if (grab.held && !commitHold && !grab.on) {
        gscale.x = 1; // lướt nhận xong: khay cũ đã rời khung (engine trả về gốc) — khay sẵn sàng đủ cỡ cho bia sau
        gscale.v = 0;
      } else if (gscale.x !== want || gscale.v !== 0) {
        // r64: hướng lò xo chốt theo LẦN ĐỔI ĐÍCH (thu nhanh hơi nảy / trả tới hạn) — trước đây theo vị trí tức thời: nảy quá
        // 0,975 một chút là chuyển sang lò xo trả chậm, bò về ~1,2 s (bóng + gương vẽ lại suốt lúc cầm)
        if (want !== gscale.want) {
          gscale.want = want;
          gscale.dir = want < gscale.x ? -1 : 1;
        }
        const down = gscale.dir < 0;
        const w = down ? 18 : 7.5;
        const z = down ? 0.72 : 1;
        const n = Math.max(1, Math.ceil(dt * 240));
        const h = dt / n;
        for (let i = 0; i < n; i++) {
          gscale.v += (w * w * (want - gscale.x) - 2 * z * w * gscale.v) * h;
          gscale.x += gscale.v * h;
        }
        // dừng khi lệch dưới điểm ảnh (2e-4 × bia ~1,5 m ≈ 0,3 mm) và gần như đứng yên
        const settled = Math.abs(gscale.x - want) < 2e-4 && Math.abs(gscale.v) < 2e-3;
        if (settled) {
          gscale.x = want;
          gscale.v = 0;
          requestShadow(); // bóng đổ vẽ lại MỘT lần khi khay dừng cỡ (không mỗi khung lúc lò xo chạy)
        }
        slots[grab.tray].scale.setScalar(gscale.x);
        reflector.invalidate(); // gương lòng bục theo khay vừa đổi cỡ
        requestRender('grab-scale');
      }
      if (gscale.x !== 1) slots[grab.tray].scale.setScalar(gscale.x); // đang kéo / chạy nốt: engine vừa đặt 1
    }
    grab.held = !grab.on && commitHold;
    if (selNow[0] > 0 || selNow[1] > 0 || selWas[0] > 0 || selWas[1] > 0 || grabMoved || grabK[0] > 0 || grabK[1] > 0) {
      // Ghi lại mỗi khung khi đang bật: màu / độ sáng đổi trong cài đặt thì áp ngay.
      for (let i = 0; i < 2; i++) pedestals[i].setLights((S.pedestalOn ? selNow[i] : 0) * devSel.strips, S.pedLights, S.pedestalOn ? grabK[i] * GRAB_GLOW : 0);
      // Ánh hắt từ vòng sáng trên (MỘT đèn điểm): theo bục đang sáng hơn, ngay dưới mặt lòng bục ở phía
      // vòng sáng hướng về camera.
      const j = selNow[0] >= selNow[1] ? 0 : 1;
      const pk = S.pedestalOn ? selNow[j] : 0;
      spill.intensity = SPILL.i * S.pedLights.topGlow * pk * devSel.spill;
      if (spill.intensity > 0) {
        const pd = pedestals[j];
        pd.group.updateWorldMatrix(true, false);
        _spill.setFromMatrixPosition(pd.group.matrixWorld);
        _spillDir.set(camera.position.x - _spill.x, 0, camera.position.z - _spill.z).normalize();
        spill.position
          .copy(_spill)
          .addScaledVector(_spillDir, pd.dishR * SPILL.ring)
          .setY(_spill.y + pd.lift - SPILL.below);
        spill.color.set(S.pedLights.topColor);
      }
      selWas[0] = selNow[0];
      selWas[1] = selNow[1];
    }
    pedestals[0].update(dt);
    pedestals[1].update(dt);
    // Quét hiện bia đầy đủ thay proxy (r16) — gương lòng bục soi lại theo.
    if (S.live?.reveal) {
      stepReveal(S.live, dt);
      reflector.invalidate();
    } else if (S.live?.proxy) stepProxyWait(S.live, dt);
    // r21: bản LOD1 cho lượt gương — gắn khi LOD1 của bia đang hiện vừa nung xong (nạp nền sau khi bia đã lên)
    else if (S.live && !S.live.lo && !S.tx && (S.live.lod ?? 0) === 0 && (S.frameNo & 31) === 0) attachMirrorLod(S.live);
    if (settledWaiters.length && isSettled()) for (const r of settledWaiters.splice(0)) r();

    // Bóng: shadowMap.autoUpdate = false trong core → chỉ xin vẽ lại đúng lúc khối ĐỘNG.
    //  · chuyển cảnh: mỗi khung (mô hình mờ dần + dâng lên, bóng đổi nhanh)
    //  · lắc: cách khung một lần — 40° trong 26 s thì bóng gần như đứng yên
    //  · rảnh tay / tắt tự xoay / giảm chuyển động: không xin lần nào
    if (tweening) {
      requestShadow();
      reflector.invalidate();
    } else if (holderMoving) {
      if ((shadowTick++ & 1) === 0) requestShadow();
    }

    // ---- Camera
    //  1) góc mặc định vừa đổi trong cài đặt → trôi VIEW_TWEEN;
    //  2) hover ↔ chính diện (orbitU, HOVER_ORBIT) — lúc chuyển cảnh: giữ chính diện nếu con trỏ vẫn ở vùng bia;
    //  3) lái camera: tween ('tx' / 'return') → theo đúng khung đích (khung đang trôi) → tự về khung khi rảnh.
    let homeDirty = false;
    if (viewTw.t < 1) {
      viewTw.t = Math.min(1, viewTw.t + dt / VIEW_TWEEN);
      S.viewAz = viewTw.from + (viewTw.to - viewTw.from) * easeInOutCubic(viewTw.t);
      homeDirty = true;
    }
    // Vòng chính diện + zoom (camera hover) theo CÙNG cổng với đèn + thông tin (S.selTarget — index.js: presence.shown).
    // Ngoại lệ duy nhất: lượt lướt bắt đầu LÚC ĐANG FOCUS (vd. chuột đang rê bia rồi bấm phím →) và con trỏ còn ở vùng bia
    // → giữ chính diện suốt lượt lướt (liền mạch, focus lại ngay sau đó). r48: trước đây nhánh này không xét lúc bắt đầu —
    // lướt từ rest (vẩy hai ngón V, tay còn nằm trên vùng bia) cũng vòng về chính diện + zoom mà không đèn / thông tin
    // ("nửa focus"), rồi mới về rest → người dùng phải chờ thêm một nhịp.
    if (S.tx !== txSeen) {
      txSeen = S.tx;
      txFocus = !!S.tx && (S.selTarget || prevSel) && !scrubOwns(); // r53: kéo bia bằng tay — luôn rest
    }
    const wantFront = S.hoverFront && (Math.abs(S.viewAz) > 1e-4 || S.hoverZoom > 0) && (S.selTarget || (S.tx && txFocus && !pointerQuiet && pointerInLatch())) ? 1 : 0;
    if (orbitStep(sdt, wantFront)) homeDirty = true;
    // r48b: rời focus trong một lượt lướt KHÔNG liền mạch (vẩy V, bấm mũi tên…) → vòng camera về rest xong trước ~60 %
    // lượt lướt (không phải đường về thường HOVER_RETURN 2,5 s — bia mới tới còn đang chính diện / zoom = "chờ thêm một
    // nhịp"). Cùng easing với lướt (easeInOutCubic), bắt đầu từ vận tốc đang có (số hạng v0 của orbitStep) → không giật.
    if (S.tx && !wantFront && !reduceMotion && orbit.seg && orbit.seg.target === 0 && orbit.seg.txFast !== S.tx) {
      const p = S.tx.progress;
      const left = p < 0.5 ? (0.6 - p) * S.tx.duration : Math.max(0.15, (1 - p) * S.tx.duration * 0.7);
      if (orbit.seg.D - orbit.seg.t > left + 0.02) orbit.seg = { f0: orbit.f, v0: orbit.v, target: 0, D: left, t: 0, curve: easeInOutCubic, txFast: S.tx };
      else orbit.seg.txFast = S.tx;
    }
    if (homeDirty) applyHomeAz();
    if (fitStep(sdt)) homeDirty = true; // sau applyHomeAz: khung xin riêng đã tính theo góc hover hiện tại
    if (S.rubOn) {
      computeRubGoal(); // đầu rùa có thể còn trôi theo lắc đang tắt dần
      if (S.rubK < 1) homeDirty = true;
    }
    rubRestoreStep();
    readStep(dt); // r74: bộ bám cuộn của khung đọc + FOV (đích camera = khung đọc khi S.readOn — goal())
    if (S.live?.polish) S.live.polish.flush();
    // Rời hover sau khi người dùng đã tự xoay / zoom trong lúc hover → về khung 3/4 như thường lệ.
    if (prevSel && !S.selTarget && S.userMoved && !S.camTw && !S.tx && !S.rubOn && !S.readOn && !S.grabCam) S.camTw = beginCamTween('return', HOVER_RETURN, easeLeave);
    // r58: nhả nắm tay (không nhận / lò xo về xong) → camera từ chỗ người xem đang nhìn trôi về khung như rời hover
    if (grabReturn && !S.grabCam && !S.tx) {
      grabReturn = false;
      if (S.userMoved && !S.camTw && !S.rubOn) S.camTw = beginCamTween('return', HOVER_RETURN, easeLeave);
    }
    prevSel = S.selTarget;
    if (S.camTw) {
      // r35: đoạn bay về sau khi xoa không dừng theo "giữ trên đầu rùa" (r28) — nhịp loé còn dư lúc vừa vào rồi ra ngay
      // r84: camera nhích vào lúc đang giữ V (giữ = đứng yên, trừ đoạn nhích + về) — 'creep' / 'creep-back'
      if (!frozen || S.camTw.kind === 'rub-out' || S.camTw.kind === 'creep' || S.camTw.kind === 'creep-back') stepCamTween(dt);
    } else if (S.readOn) {
      // r74 khung đọc: camera bám đúng khung đọc (đích đã êm — bộ bám cuộn tới hạn trong readStep)
      if (S.readGoalOk) {
        camera.position.copy(readGoal.pos);
        controls.target.copy(readGoal.target);
      }
    } else if (S.rubOn) {
      // Chế độ xoa, đã tới khung cận (hoặc người dùng cầm camera giữa đường): camera HOÀN TOÀN tự do — không đặt
      // lại vào khung đích, không tự trôi về khung khi rảnh (r10: "reset về 1 góc camera cố định sau vài giây").
    } else if (!S.userMoved && homeDirty) {
      const g = goal();
      camera.position.copy(g.pos);
      controls.target.copy(g.target);
      S.homing = false;
    } else if (!frozen && (S.homing || (idle > IDLE_CAM && !S.focusHold && !S.grabCam))) {
      // r54: focus còn giữ sau khi người xem tự xoay / zoom → không tự trôi về khung khi rảnh (rời focus mới về, 'return')
      // Tự trôi về khung đích (khung mặc định, hoặc khung một kiểu hiện thông tin xin). Chỉ camera động
      // thì bóng KHÔNG đổi (đèn rọi đứng yên trong không gian) → không xin vẽ lại shadow map.
      const g = goal();
      const tol = g.dist * 0.0015;
      if (camera.position.distanceTo(g.pos) > tol || controls.target.distanceTo(g.target) > tol) {
        const k = reduceMotion ? 1 : 1 - Math.exp(-2.4 * dt);
        camera.position.lerp(g.pos, k);
        controls.target.lerp(g.target, k);
      } else if (S.homing || S.userMoved) snapHome();
    }
    // r64: nắm tay đang cầm (camera ghim đúng chỗ — S.grabCam): khung "nhà" còn trôi (vòng hover / khung xin riêng trả về
    // ~2,5 s sau khi focus tắt) nhưng camera KHÔNG theo → không có gì trong ảnh phản chiếu đổi. Trước r64: gương vẽ lại mỗi
    // khung suốt lúc cầm — mỗi lượt gương đổi biến thể chương trình (RT ↔ màn hình) của vật liệu bục → three xét lại chương
    // trình ~7 lần / khung. (Camera thật sự đi thì gương tự thấy qua ma trận camera.)
    if (homeDirty && !S.grabCam) reflector.invalidate();
    // Đang nhấn mà chưa kéo quá ngưỡng: bỏ phần xoay / dời OrbitControls tích luỹ → camera đi đúng đường tự động.
    // r35: … và suốt đoạn bay về sau khi xoa (kéo / lăn / zoom tay lúc đó không đẩy camera lệch khỏi đường về).
    if ((S.press && !S.press.took) || S.camTw?.kind === 'rub-out') {
      killInertia();
      if (controls._scale !== undefined) controls._scale = 1;
    }
    controls.update();
    trackCamMotion(dt);
    // r13: cả vòng camera hover / rời hover. r16: con trỏ (chuột / tay) vừa di trong POINTER_WARM_MS cũng chưa "yên" — việc
    // nền chia lát (nung bia, raster chữ nổi) không bắt đầu lát mới khi người xem sắp hover / bấm.
    // r64: đang cầm bia / đang tua lượt kéo cũng là chưa yên (S.grabBusy — whenCalm đọc cờ này)
    S.grabBusy = grab.on || !!transitionApi.scrub;
    if (S.camTw || S.tx || S.rubOn || S.readOn || orbit.seg || now < warmUntil || S.grabBusy) calmSince = 0;
    else if (!calmSince) calmSince = now;
    // r23: tay đang điều khiển → giữ việc nền (nạp / nung / tải texture) để luồng chính rảnh cho khung camera; tối đa
    // HAND_CALM_MAX_MS mỗi lượt để việc nền không đói hẳn khi tay ở lâu trước camera.
    const handHold = document.body.dataset.handActive === '1';
    if (calmWaiters.length && calmSince && now - calmSince >= CALM_MS) {
      if (handHold && !handHoldSince) handHoldSince = now;
      if (!handHold || now - handHoldSince >= HAND_CALM_MAX_MS) {
        handHoldSince = 0;
        for (const r of calmWaiters.splice(0)) r();
      }
    } else handHoldSince = 0; // r64: hết yên (hoặc không ai chờ) → đếm giữ-tay lại từ đầu ở lần yên sau — không tích luỹ qua các lượt kéo liên tiếp rồi nhả việc nền giữa lúc cầm
    syncYaw();
    // DEV: ghi vết mỗi khung (cinemaLightTrace) — nhịp bật/tắt của mọi ánh sáng theo hover.
    if (import.meta.env.DEV && S.devTrace) {
      const g0 = pedestals[0].lightGain;
      const g1 = pedestals[1].lightGain;
      S.devTrace.push({
        t: Math.round(now - S.devTrace.t0),
        sel: S.selTarget ? 1 : 0,
        hit: mouseHit || handHit ? 1 : 0,
        latch: pointerInLatch() ? 1 : 0,
        cur: S.cur,
        tx: S.tx ? +(S.tx.progress ?? 0).toFixed(3) : -1,
        top: [+g0.top.toFixed(3), +g1.top.toFixed(3)],
        bottom: [+g0.bottom.toFixed(3), +g1.bottom.toFixed(3)],
        mix: +(1 - S.lightE / Math.max(1e-6, S.contrast)).toFixed(3),
        e: +S.lightE.toFixed(3),
        spill: +spill.intensity.toFixed(4),
        camAz: +THREE.MathUtils.radToDeg(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z)).toFixed(2),
        camDist: +camera.position.distanceTo(controls.target).toFixed(4),
        yaw: +THREE.MathUtils.radToDeg(holder.rotation.y).toFixed(3),
        orbit: +orbit.f.toFixed(4),
        tw: S.camTw ? S.camTw.kind : '',
      });
    }
    trackRim();
    syncMirrorScale();
    if (S.dishGlass > 0 && S.reflBase > 0) syncMirrorFresnel();
    // Vệt sáng mặt vát theo camera + trừ phần rim trên đá bục (uniform, mỗi khay đang hiện).
    if (S.pedestalOn) for (let i = 0; i < 2; i++) if (slots[i].visible) pedestals[i].updateView(camera, lights.rim);

    scanStep(dt, now); // r74 quét bản dập: đổi uniform → polish.version → khung này vẽ (lý do 'rub')
    glyphStep(dt, now); // r82b chữ Hán: đồng hồ lấp lánh / bay đổi uniform → khung này vẽ (chỉ lúc hiệu ứng chạy)
    // Kiểu hiện thông tin cập nhật NGAY TRƯỚC lượt vẽ, với ma trận của đúng khung này:
    // vật thể WebGL nó gắn lên mặt phẳng và phần tử CSS3D bám mặt phẳng cùng khớp một nhịp.
    S.frameNo++;
    if (beforeRenderCb) {
      camera.updateMatrixWorld();
      scene.updateMatrixWorld();
      beforeRenderCb(dt, now);
    }

    // Chuyển cảnh mờ dần bằng GHÉP ẢNH: engine vẽ khay đang mờ vào render target rồi dán
    // lên khung — vật liệu giữ nguyên độ đục nên không còn nhìn xuyên qua thân bia.
    // Shadow map: vẽ lại đúng khi view này xin (requestShadow) VÀ bóng đang thấy được (bật + đèn rọi
    // đang sáng) — ghi đè mọi yêu cầu khác (core/lighting xin ở mỗi lần đổi cài đặt). Bóng tắt, hover
    // (đèn rọi tắt) hay Tương phản 0: KHÔNG có lượt shadow map nào; yêu cầu còn treo được giữ lại để
    // bản đồ vẽ lại đúng khung đầu tiên đèn rọi sáng trở lại.
    const shadowVisible = S.castK > 0 && idleSpot.intensity > 0;
    // Độ sáng ô chữ khắc: hẹn đo ~350 ms sau khi bia mới đã yên (chuyển cảnh xong, không còn proxy / quét hiện), đo
    // NGAY sau lượt vẽ WebGL của khung đó (khung đó bắt buộc vẽ — đọc điểm ảnh của bộ đệm vừa vẽ), rồi đổi bảng màu tên.
    // Đo không chặn (startFieldLuma / pollFieldLuma). Trong lúc chờ vẫn vẽ mỗi khung (GPU không hạ xung trước khung đo).
    // Lần đo trước của bia này không đo được (ô tên ngoài khung) → không giữ vẽ.
    let lumaDue = false;
    let lumaWait = false;
    // r64: KHÔNG đo lúc tay đang điều khiển (body[data-hand-active]) hay đang cầm / sẵn sàng cầm bia — lượt đo (ba lượt vẽ
    // cắt ô + đọc điểm ảnh) rơi đúng lúc người xem kéo bia tiếp; tay rời thì đo (bảng màu tên dùng mặc định tới lúc đó)
    const lumaHold = document.body.dataset.handActive === '1' || !!document.body.dataset.steleGrab || grab.on;
    if (lumaHold && S.lumaAt) S.lumaAt = 0;
    if (!lumaHold && namesRigs && S.namesOn && !S.tx && S.live && !S.live.proxy && !S.live.reveal && !S.lumaJob && slotEntry[S.cur] && !fieldLuma.has(slotEntry[S.cur].id)) {
      if (!S.lumaAt) S.lumaAt = now + 350;
      else lumaDue = now >= S.lumaAt;
      lumaWait = S.lumaMiss !== slotEntry[S.cur].id;
    }
    const why = renderReason(force, shadowVisible, lumaWait || lumaDue);
    if (why) {
      if (shadowVisible) {
        renderer.shadowMap.needsUpdate = shadowWanted;
        shadowWanted = false;
      } else {
        renderer.shadowMap.needsUpdate = false;
      }
      const unmute = import.meta.env.DEV && devMute.size ? devMuteApply() : null;
      stepRipple(dt); // r63: vân lòng bục trôi (nếu bật) — chỉ ở khung đang vẽ, không tự xin vẽ
      if (S.tx) S.tx.render(renderer, scene, camera);
      else renderer.render(scene, camera);
      if (S.lodFade) stepLodFade(dt);
      unmute?.();
      noteRendered(why);
      if (import.meta.env.DEV && S.devDish) devDishSample(why);
    } else {
      // Không vẽ: canvas giữ ảnh khung trước. Yêu cầu bóng còn treo giữ nguyên cho lượt vẽ sau; ma trận thế giới
      // vẫn phải mới (bắn tia hover, tên CSS3D bám mặt bia đọc chúng).
      renderer.shadowMap.needsUpdate = false;
      if (!beforeRenderCb) scene.updateMatrixWorld();
      if (devRender) devRender.skipped++;
    }
    if (lumaDue && why) {
      // Vẽ lại riêng ô tên ở 2 mức đèn + trả về trạng thái hiện tại, đọc không đồng bộ — xem startFieldLuma.
      S.lumaAt = 0;
      if (!startFieldLuma()) S.lumaMiss = slotEntry[S.cur].id;
    }
    // Tên trên thân bia: ma trận thế giới của hai khay vừa được cập nhật trong lượt vẽ trên.
    if (namesRigs && S.namesOn) {
      _keyDir.copy(cineKey.position).sub(keyAim).normalize();
      for (let i = 0; i < 2; i++) {
        const rig = namesRigs[i];
        if (!rig.built) continue;
        const slot = slots[i];
        // r7: không còn làm mờ tên khi hover (người dùng: "bật đèn tên mờ, khó đọc") — tương phản do màu
        // chữ liên tục theo ánh sáng lo (namesStyleFor); không có nền nào sau chữ.
        let op = slot.visible ? (slot.userData.__opacity ?? 1) * planeFade(i) : 0;
        // Xoa đầu rùa: camera cận đầu rùa → cột tên trên thân bia phóng to lừng lững phía trên → mờ đi cùng nhịp lắc.
        if (S.rubK > 0) op *= 1 - easeInOutCubic(S.rubK);
        // r80 (người dùng): tên KHÔNG còn tắt lúc focus (r71 → r79 nhường chỗ cho tấm thông tin — nay ở lại trên mặt bia)
        // r74: đang quét / đang hiện bản dập → tên trên mặt bia mờ đi (bản dập là chữ thật trên đá)
        if (i === S.cur && S.scanNamesK > 0) op *= 1 - S.scanNamesK;
        // r80: đọc toàn văn (tấm đọc che mặt đá — cả khi tắt quét bản dập) → tên mờ đi; đóng → hiện lại cùng đoạn lùi
        if (i === S.cur) {
          const want = S.readOn ? 1 : 0;
          const k0 = S.readNamesK;
          S.readNamesK = Math.abs(want - k0) < 0.002 ? want : k0 + (want - k0) * (reduceMotion ? 1 : 1 - Math.exp(-dt / 0.22));
          if (S.readNamesK !== want) requestRender('names');
          if (S.readNamesK > 0) op *= 1 - S.readNamesK;
        }
        if (i === S.cur) {
          const ink = namesStyleFor(slotEntry[i]?.id, dt);
          if (import.meta.env.DEV && S.devNamesLegacy) {
            // DEV: cách cũ (trước r7) để chụp so sánh — màu chốt theo độ sáng lúc CHƯA hover, tên mờ 65 %
            // khi hover.
            const L = fieldLuma.get(slotEntry[i]?.id);
            rig.setStyle(L?.tone === 'ink' ? 1 : 0);
            op *= 1 - 0.65 * selNow[S.cur];
          } else rig.setStyle(ink);
        }
        rig.update(planes[i].group.matrixWorld, op, _keyDir);
      }
    }
    css3d?.render();
    frameCb?.(dt, now);
    if (import.meta.env.DEV && S.devCamTrace) {
      const p = camera.position;
      const t = controls.target;
      S.devCamTrace.push({
        t: +(now - S.devCamTrace.t0).toFixed(1),
        dt: +(dt * 1000).toFixed(2),
        cpu: +(performance.now() - now).toFixed(2),
        p: [+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)],
        T: [+t.x.toFixed(5), +t.y.toFixed(5), +t.z.toFixed(5)],
        tw: S.camTw ? `${S.camTw.kind}:${(S.camTw.t ?? 0).toFixed(3)}` : '',
        rub: S.rubOn ? 1 : 0,
        dpr: +renderer.getPixelRatio().toFixed(3),
        prog: renderer.info.programs?.length ?? -1,
        // r13: hover ↔ lắc
        yaw: +THREE.MathUtils.radToDeg(holder.rotation.y).toFixed(4),
        az: +THREE.MathUtils.radToDeg(Math.atan2(p.x - t.x, p.z - t.z)).toFixed(4),
        dist: +p.distanceTo(t).toFixed(5),
        of: +orbit.f.toFixed(4),
        want: orbit.want,
        segs: orbit.segs,
        sel: S.selTarget ? 1 : 0,
        hit: mouseHit || handHit ? 1 : 0,
        latch: pointerInLatch() ? 1 : 0,
        ramp: +S.swayRamp.toFixed(3),
        spring: +THREE.MathUtils.radToDeg(swaySpring.y).toFixed(4),
        held: swayHeld ? 1 : 0,
        um: S.userMoved ? 1 : 0,
        fit: +S.fitMix.toFixed(3),
      });
    }
  }

  const api = {
    get canvas() {
      return renderer.domElement;
    },
    get hasModel() {
      return !!S.live;
    },
    start() {
      requestRender('start');
      view.start(frameTick);
    },
    stop() {
      view.stop();
    },
    onFrame(cb) {
      frameCb = cb;
    },
    markInteraction,
    pressStart,
    pressEnd,
    cancelHoming,
    killInertia,
    /** r16: bản sao của bia này đã nung xong (present() không còn việc nặng nào: dựng bản sao, đẩy texture, biên dịch). */
    isWarm(root3d) {
      if (!root3d) return false;
      if (preparedRoots.has(root3d)) return true;
      const w = warm.get(root3d);
      return !!w && w.busy === 0 && !!w.done;
    },
    /** r16: bia đang hiện là proxy (hoặc đang quét hiện bia đầy đủ thay proxy). */
    get showingProxy() {
      return !!S.live && (S.live.proxy || !!S.live.reveal);
    },
    /** Hứa hẹn xong khi bia hiện tại đã hạ xuống, có chữ nổi trên bục và đã đo ô tên (vạch tải mở màn chờ cái này). */
    whenSettled() {
      if (S.disposed || isSettled()) return Promise.resolve();
      return new Promise((r) => settledWaiters.push(r));
    },
    /** Tiến độ 0..1 tới lúc "đã dọn xong" (whenSettled): chuyển cảnh 60 % · chữ nổi trên bục 20 % · đo ô tên 20 %. */
    get settleProgress() {
      if (!S.live) return 0;
      let k = S.tx ? 0.6 * S.tx.progress : 0.6;
      if (!S.pedestalOn || pedestals[S.cur].relief) k += 0.2;
      const id = slotEntry[S.cur]?.id;
      if (!(namesRigs && S.namesOn) || S.live.proxy || !id || fieldLuma.has(id) || S.lumaMiss === id) k += 0.2;
      return S.live.reveal ? Math.min(k, 0.99) : k;
    },
    /** Đang chạy chuyển cảnh giữa hai bia. */
    get transitioning() {
      return !!S.tx;
    },
    /** Hứa hẹn xong khi sân khấu "yên" (không camera tween / chuyển cảnh / chế độ xoa) đủ CALM_MS — xem calmSince. */
    whenCalm,
    /**
     * Người nghe chạy mỗi khung NGAY TRƯỚC lượt vẽ WebGL, khi ma trận thế giới của khung này
     * đã được cập nhật (kiểu hiện thông tin cập nhật ở đây).
     */
    onBeforeRender(cb) {
      beforeRenderCb = typeof cb === 'function' ? cb : null;
    },
    /**
     * Con trỏ của cử chỉ tay (NDC); sân khấu bắn tia ở khung kế tiếp.
     * lazy = đang nhón/kéo: chỉ bắn lại mỗi RAY_REFRESH_MS.
     */
    setHandPointer(nx, ny, lazy = false) {
      warmUntil = performance.now() + POINTER_WARM_MS;
      _hnd.set(nx, ny);
      S.handActive = true;
      handDirty = true;
      handLazy = !!lazy;
    },
    clearHandPointer() {
      if (!S.handActive && !handHit) return;
      S.handActive = false;
      handHit = false;
      handPedHit = false;
      handFace = false;
      handDirty = false;
    },
    /** Tay đang ở trên tấm bia hiện tại (giải ở khung gần nhất). */
    get handHit() {
      return handHit;
    },
    /** r74: tay đang ở trên MẶT TRƯỚC phiến bia (không rùa / bục / hông / lưng phiến — giải ở khung gần nhất). */
    get handFace() {
      return handFace;
    },
    /** r84: tay trong hình chiếu mặt bia nới rộng (xem faceNearNdc). */
    get handFaceNear() {
      return handFaceNear;
    },
    /** r67: tay đang ở trên BỤC của bia hiện tại (thân + lòng bục; khi không trúng bia — giải ở khung gần nhất). */
    get handPedHit() {
      return handPedHit;
    },
    /** Chuột đang ở trên tấm bia hiện tại (giải ở khung gần nhất). */
    get mouseHit() {
      return mouseHit;
    },
    /**
     * Chuột / tay nằm trong VÙNG GIỮ HOVER (hợp hình chiếu bia + bục ở khung 3/4 lẫn chính diện, nới rộng):
     * lớp thông tin đang hiện thì còn trong vùng này vẫn tính là hover → camera vòng về chính diện làm bia
     * trượt khỏi con trỏ cũng không ẩn → không có vòng lặp hover ↔ rời.
     */
    /**
     * Kiểu hiện thông tin cho biết nó chiếm bao nhiêu chỗ để kẹp zoom khi hover:
     * fn() → { framing: kiểu này tự xin khung camera, extent: nửa bề ngang (đơn vị mặt phẳng bia) | null }.
     */
    setZoomGuard(fn) {
      S.zoomGuard = typeof fn === 'function' ? fn : null;
    },
    /** r71: (id bia) → true: tên trên thân bia tắt dần theo mức hover. r80: không còn dùng (tên ở lại lúc focus). */
    setNamesHandoff(fn) {
      S.namesHandoff = typeof fn === 'function' ? fn : null;
    },
    /** DEV / báo cáo: mức zoom khi hover thực dùng với kiểu thông tin hiện tại. */
    get hoverZoomEffective() {
      return zoomLimit();
    },
    /** r27z: mức zoom khi hover tối đa dùng được lúc này (thanh trượt tới 25 %) + phần kẹp: 'stele' | 'info' | 'framing' | null. */
    hoverZoomCap() {
      const c = zoomCap(0.25);
      return { cap: +c.z.toFixed(3), by: c.by };
    },
    get mouseLatch() {
      return !S.devLatchOff && S.pointerActive && inLatch(_ndc);
    },
    get handLatch() {
      return !S.devLatchOff && handInLatch();
    },
    devSteleScreenPoint,
    /** Vị trí con trỏ theo NDC; sân khấu tự bắn tia ở khung kế tiếp (lazy: như setHandPointer). */
    setPointer(nx, ny, lazy = false) {
      warmUntil = performance.now() + POINTER_WARM_MS;
      _ndc.set(nx, ny);
      S.pointerActive = true;
      pointerDirty = true;
      mouseLazy = !!lazy;
    },
    clearPointer() {
      if (!S.pointerActive && !mouseHit) return;
      S.pointerActive = false;
      pointerDirty = true;
    },
    /** Kiểm tra ngay lập tức (dùng cho cú bấm): điểm NDC có trúng tấm bia không. */
    hitTest(nx, ny) {
      return !S.tx && hitStele(nx, ny);
    },
    /**
     * Thông tin bia đang HIỆN (mọi kiểu) → bật hiệu ứng "đang chọn": hai dải sáng của bục (+ quầng,
     * vũng sàn, tia). Vào 500 ms / ra 300 ms; tự tắt trong lúc chuyển cảnh.
     */
    setSelected(on) {
      S.selTarget = !!on;
    },
    /** r54: focus đang giữ sau khi người xem xoay / zoom — camera giữ góc đó (không tự về khung khi rảnh, không lắc). */
    setFocusHold(on) {
      S.focusHold = !!on;
    },
    /**
     * r53: tay đang CẦM bia (kéo bia) → đèn dưới của bục bia đó sáng dần (vào 500 ms / ra 400 ms, như HOVER_FADE). Bia đang
     * cầm = bia đang hiện lúc cầm (kéo đi thì là bia đang rời — khay cũ).
     */
    setGrab(on, { kind = 'fist' } = {}) {
      on = !!on;
      if (on && !grab.on) {
        grab.tray = S.cur;
        grab.side = null;
        grab.kind = kind === 'v' ? 'v' : 'fist'; // r72: chỉ còn nắm tay cầm bia ('v' giữ cho tương thích DEV)
        const ring = grings[grab.tray];
        ring.setRadius(pedestals[grab.tray].R);
        // r65: vòng hiện TẠI CHỖ (sàn quanh chân bục — mờ → rõ + nở nhẹ), không còn biến hình từ con trỏ
        ring.begin(camera, reduceMotion);
      }
      grab.on = on;
    },
    /**
     * r58: nắm tay kéo bia — cầm từ lúc đang focus (on): camera giữ ĐÚNG tư thế đang có (coi như người xem cầm camera: không
     * về khung, không vòng hover về, không lắc); vòng hover (chính diện + zoom) đặt về 0 NGAY trong khung đích — chỉ đổi đích,
     * camera không nhảy — nên lượt lướt (nếu kéo) đi từ đúng chỗ đang nhìn tới khung nghỉ của bia mới theo tiến độ tay. Nhả
     * (off): lượt lướt đã nhận tự đưa camera về khung bia mới; không nhận → trôi về khung (HOVER_RETURN) khi lò xo về xong.
     */
    setGrabCamera(on) {
      on = !!on;
      if (on === S.grabCam) return;
      S.grabCam = on;
      if (on) {
        grabReturn = false;
        S.userMoved = true;
        S.homing = false;
        if (S.camTw && S.camTw.kind !== 'tx') S.camTw = null; // đang vào / rời hover dở → dừng tại chỗ
        orbit.want = 0;
        orbit.seg = null;
        orbit.f = 0;
        orbit.v = 0;
        applyHomeAz();
        computeFit();
      } else grabReturn = true;
    },
    /** r56: phía tay đang kéo ('left' | 'right' | null) — cặp chevron của vòng cầm phía đó sáng hẳn, phía kia mờ. */
    setGrabSide(side) {
      grab.side = side === 'left' || side === 'right' ? side : null;
    },
    get grab() {
      return {
        on: grab.on,
        u: +grab.u.toFixed(3),
        tray: grab.tray,
        side: grab.side,
        bottom: +pedestals[grab.tray].lightGain.bottom.toFixed(3),
        top: +pedestals[grab.tray].lightGain.top.toFixed(3),
        scale: +gscale.x.toFixed(4),
        kind: grab.kind,
        rings: grings.map((a) => a.state),
      };
    },
    /** r56: giảm chuyển động — kéo bia không tua lượt lướt (view nhận theo ngưỡng, hiện tức thì). */
    get reduceMotion() {
      return reduceMotion;
    },
    /** r26: tự chuyển mà con trỏ đứng yên → con trỏ nằm trong vùng bia không còn giữ camera chính diện lúc lướt. */
    setPointerQuiet(on) {
      pointerQuiet = !!on;
    },
    /**
     * r28: đang giữ trên đầu rùa để mở khoá / vào chế độ xoa → camera hover + lắc đứng yên tại chỗ (xem holdFreeze). Vào:
     * xoá vận tốc (lắc, lò xo, vòng hover) — nhả ra thì đi tiếp từ đúng chỗ đã dừng, tăng tốc từ 0 (không giật).
     */
    setHoldFreeze(on) {
      on = !!on;
      if (on === S.holdFreeze) return;
      S.holdFreeze = on;
      if (on) {
        S.swayRamp = 0; // pha lắc đứng yên (góc giữ nguyên) — lắc lại tăng tốc dần từ 0
        swaySpring.v = 0;
        orbit.v = 0;
      } else if (orbit.seg) {
        // đoạn vòng hover đang dở: đi tiếp TỪ CHỖ ĐANG ĐỨNG, vận tốc 0, thời lượng theo quãng còn lại
        const sg = orbit.seg;
        const rest = Math.abs(sg.target - orbit.f);
        orbit.seg = { ...sg, f0: orbit.f, v0: 0, t: 0, D: sg.D * THREE.MathUtils.clamp(rest, 0.35, 1) };
      }
      requestRender('hold');
    },
    /**
     * Các phần của InfoCtx do sân khấu cung cấp (xem info/contract.js); info/index.js ghép
     * thêm phần của view (hudRoot, pointer, facts, anatomy) thành MỘT ctx.
     */
    info: {
      THREE,
      scene,
      camera,
      renderer,
      css3d: css3d ? { scene: css3d.scene, ensure: css3d.ensure, element: css3d.element, render: () => css3d.render() } : null,
      clearCss3d: () => css3d?.clear(),
      plane: () => (S.live ? livePlane().group : null),
      planeMatrix() {
        if (!S.live) return null;
        const g = livePlane().group;
        g.updateWorldMatrix(true, false); // luôn mới — kể cả khi gọi ngoài vòng lặp
        return g.matrixWorld;
      },
      metrics: (pl) => steleMetrics(S.devInfoLegacy ? null : pl),
      /**
       * Độ hiện theo góc nhìn. Có `pl` (mặt phẳng kiểu hiện thông tin đang bám) → đo từ ma trận thật của
       * khay đó (đúng cả khi chuyển cảnh dời / xoay riêng khay); không có → bia hiện tại.
       */
      angleFade(pl) {
        const i = pl && !S.devInfoLegacy ? slotOfPlane(pl) : -1;
        if (i < 0) return S.angleNow;
        return planeFade(i);
      },
      /** Độ đục của khay mang mặt phẳng `pl` (hiệu ứng chuyển cảnh làm mờ cả khay); 1 ngoài chuyển cảnh. */
      opacity(pl) {
        const i = pl ? slotOfPlane(pl) : S.cur;
        if (i < 0 || S.devInfoLegacy) return 1;
        const s = slots[i];
        return s.visible ? (s.userData.__opacity ?? 1) : 0;
      },
      steleScreenRect,
      /**
       * r74 khung đọc toàn văn (stage/read.js): enter({rect, k, mode, gap, archRise}) → thời lượng tiến vào (s) · layout(rect, o) ·
       * exit(o) → thời lượng lùi về (s).
       */
      readView: {
        enter: (o) => readApi.readEnter(o),
        layout: (rect, o) => readApi.readLayout(rect, o),
        /** r78: nguồn cuộn duy nhất (bộ tích phân lớp đọc) · hình học tấm 3D · ma trận bia · bóng tấm · tiến độ đoạn camera. */
        setSource: (fn) => readApi.readSetSource(fn),
        panel3d: () => readApi.readPanel3D(),
        frame: () => readApi.readFrame(),
        shadow: (k) => readApi.readShadow(k),
        /** r82: tấm 3D đang hạ thấp dy (đơn vị bia) lúc trượt mở / đóng — bóng tấm dời theo. */
        slide: (dy) => readApi.readSlide(dy),
        /** r82b: đường cắt dưới của tấm lúc trượt (đỉnh hộp đầu rùa / chân mặt bia — tấm không vẽ lên đầu rùa / mai). */
        faceCut: () => readApi.readFaceCut(),
        tween: () => readApi.readTween(),
        exit: (o) => readApi.readExit(o),
        get on() {
          return S.readOn;
        },
      },
      /** r76: người xem đang tự cầm camera (xoay / zoom) — khác với camera do ứng dụng lái (khung nghỉ / focus / tween). */
      cameraUserMoved: () => !!S.userMoved,
      /** r74 quét bản dập (stage/scan.js): has() · play(ms) → Promise · release() · state. */
      scan: {
        get enabled() {
          return scanApi.scanEnabled;
        },
        has: () => scanApi.scanHas(),
        play: (ms) => scanApi.scanPlay(ms),
        // r84: lượt quét của nút đọc = lượt giữ V (vạch theo thời gian + camera nhích vào); Promise<boolean> bắn ở 2 s
        preroll: () => {
          const pr = scanApi.scanPreroll();
          readApi.readCreepStart();
          return pr.then((ok) => {
            if (!ok) readApi.readCreepCancel();
            return ok;
          });
        },
        release: (ms) => scanApi.scanRelease(ms),
        prepare: () => scanApi.scanPrepare(),
        get state() {
          return scanApi.scanState;
        },
      },
      requestFraming(req) {
        const r = req && req.rect;
        if (r && [r.x, r.y, r.w, r.h].every(Number.isFinite)) {
          S.framingRect = { x: r.x, y: r.y, w: r.w, h: r.h };
          computeFit();
        } else {
          S.framingRect = null;
          fit.active = false;
          setDistLimits(home.dist * 0.5, home.dist * 1.75);
        }
        S.homing = true;
        if (reduceMotion) snapHome();
      },
      /** Đơn vị thế giới ứng với 1 px CSS ở độ sâu mặt phẳng, tại khung mặc định. */
      worldPerPx: (pl) => {
        const i = pl && !S.devInfoLegacy ? slotOfPlane(pl) : S.cur;
        return planes[i < 0 ? S.cur : i].M?.worldPerPx ?? 0.001;
      },
      /** Điểm thế giới → px CSS client ({x, y, behind}). */
      worldToScreen(v, out = { x: 0, y: 0, behind: false }) {
        camera.updateMatrixWorld();
        _w2s.copy(v).project(camera);
        const r = cRect();
        out.x = r.left + ((_w2s.x + 1) / 2) * r.width;
        out.y = r.top + ((1 - _w2s.y) / 2) * r.height;
        out.behind = _w2s.z > 1;
        return out;
      },
      /**
       * Gọi cho mọi Object3D gắn dưới plane(): khoá không đổ bóng (engine chuyển cảnh bật
       * castShadow cho CẢ khay lúc bàn giao bóng), không nhận bóng, không soi xuống sàn,
       * vẽ sau các lớp sàn.
       */
      prepareOverlay(obj) {
        obj?.traverse((o) => {
          o.userData.noReflect = true;
          if (o.isMesh || o.isLine || o.isPoints || o.isSprite) {
            neverCastShadow(o);
            o.receiveShadow = false;
            if (o.renderOrder === 0) o.renderOrder = 1;
          }
        });
        return obj;
      },
    },
    dispose() {
      S.disposed = true;
      glyphDispose();
      document.removeEventListener('visibilitychange', onVisible);
      renderer.domElement.removeEventListener('webglcontextrestored', onCtxRestored);
      for (const r of calmWaiters.splice(0)) r();
      for (const f of devRestore) f();
      view.stop();
      if (import.meta.env.DEV && window.__vm?.cinemaHome === devHome) {
        for (const k of ['cinemaHome', 'cinemaHoldTx', 'cinemaReleaseTx', 'cinemaTxProgress', 'cinemaCam', 'cinemaTick', 'cinemaProfile', 'cinemaRayStats', 'cinemaBvh', 'cinemaSelect', 'cinemaSelectForce', 'cinemaFieldLuma', 'cinemaPedestal', 'cinemaPedText', 'cinemaGrabProbe', 'cinemaGrabRingChev', 'cinemaPedestalPoint', 'cinemaScrubTune', 'cinemaDrawCalls', 'cinemaGpuTime', 'cinemaFrameCost', 'cinemaShellProbe', 'cinemaDishProbe', 'cinemaMirrorMode', 'cinemaLightFade', 'cinemaShadowRate', 'cinemaShadowCost', 'cinemaClipProbe', 'cinemaMute', 'cinemaLightTrace', 'cinemaLatch', 'cinemaNamesLegacy', 'cinemaInfoLegacy', 'cinemaNamesContrast', 'cinemaHead', 'cinemaRubState', 'cinemaRubMode', 'cinemaRubDeposit', 'cinemaOrbit', 'cinemaPolishNormals', 'cinemaPolishNormalsBench', 'cinemaRenderStats', 'cinemaRenderOnDemand', 'cinemaMirrorScale', 'cinemaFieldLumaCheck', 'cinemaReveal', 'cinemaTextGrow', 'cinemaPreheatStats', 'cinemaBusy', 'cinemaRelief', 'cinemaProxyLook', 'cinemaProxyWait', 'cinemaGpuEstimate', 'cinemaMirrorLod', 'cinemaScan', 'cinemaRead', 'cinemaFaceAt', 'cinemaNamesLayout', 'cinemaBounds']) delete window.__vm[k];
      }
      offSettings();
      offLights();
      saveLiveRub();
      offRubCleared();
      offRubSettings();
      for (const w of warm.values()) disposeInstance(w.inst);
      warm.clear();
      disposeProxyInstance(S.proxyKeeper);
      S.proxyKeeper = null;
      for (const e of stripTex.values()) e.dst.dispose();
      stripTex.clear();
      offReliefEvict();
      pruneReliefQueue(new Set()); // việc nền chưa chạy của view này: bỏ
      for (const item of [...reliefGpu.keys()]) dropReliefGpu(item);
      for (const r of settledWaiters.splice(0)) r();
      controls.dispose();
      S.tx?.cancel();
      S.tx = null;
      endLodFade();
      drop(S.live);
      drop(S.retiring);
      S.live = null;
      S.retiring = null;
      scene.remove(holder);
      for (let i = 0; i < 2; i++) lifts[i].remove(planes[i].group);
      for (let i = 0; i < 2; i++) {
        pedestals[i].dispose();
        slots[i].remove(lifts[i]);
      }
      namesRigs?.forEach((r) => r.dispose());
      scene.remove(idleSpot, idleSpot.target, spill, cineKey);
      cineKey.dispose();
      idleSpot.dispose();
      spill.dispose();
      css3d?.dispose();
      S.source = null;
      reflector.dispose();
      for (const d of contactDecals) d.dispose();
      contact.dispose();
      scene.remove(pool, S.catcher);
      poolGeo.dispose();
      poolMat.dispose();
      catchGeo.dispose();
      S.catchMat.dispose();
      lights.dispose();
      view.dispose();
    },
  };
  // API của các module (getter giữ nguyên — không trải bằng ...)
  for (const part of [pedestalApi, lodApi, transitionApi, rubApi, scanApi, readApi, glyphApi]) Object.defineProperties(api, Object.getOwnPropertyDescriptors(part));
  // r64: biên dịch sẵn vòng cầm + đèn bục lúc sân khấu yên lần đầu (xem precompileGrab)
  whenCalm().then(() => precompileGrab());
  if (import.meta.env.DEV) {
    const vm = (window.__vm ??= { renderers: new Set() });
    const _gp = new THREE.Vector3();
    const _gh = new THREE.Vector3();
    /**
     * DEV (r56): kéo bia — vị trí màn hình (phần bề ngang) của tâm bia ĐANG CẦM (khay cũ khi đang kéo / chạy nốt) và của bia
     * đang hiện, mức camera lùi, trạng thái vòng cầm (r62: thay hai mũi tên sát sàn), lượt kéo. Rẻ — đọc được mỗi khung.
     */
    vm.cinemaGrabProbe = () => {
      const sx = (slot) => {
        if (!slot) return null;
        slot.getWorldPosition(_gp);
        holder.getWorldPosition(_gh);
        _gp.sub(_gh).add(goal().target).project(camera);
        return +((_gp.x + 1) / 2).toFixed(5);
      };
      const held = slots[grab.tray];
      held?.getWorldPosition(_gp);
      const heldX = held ? +_gp.x.toFixed(4) : null;
      const rc = renderer.domElement.getBoundingClientRect();
      return { heldX, sxHeld: sx(held), sxLive: sx(S.live?.slot), scales: slots.map((g) => +g.scale.x.toFixed(4)), heldTray: grab.tray, camDist: +camera.position.distanceTo(controls.target).toFixed(4), kind: grab.kind, rings: grings.map((a) => a.state), ringPx: grings[grab.tray].project(camera, rc), sc: transitionApi.scrub };
    };
    /** DEV (r60): góc chevron của vòng cầm (độ, so với hướng về camera) — so phương án. */
    vm.cinemaGrabRingChev = (deg) => grings.forEach((g) => g.setChevDeg(deg));
    /**
     * DEV (r67): điểm màn hình (px client) trên MẶT TRƯỚC thân bục của bia đang hiện (phía camera, giữa thân đứng) — kiểm thử
     * body[data-hand-over].
     */
    vm.cinemaPedestalPoint = () => {
      const pd = pedestals[S.cur];
      pd.group.updateWorldMatrix(true, false);
      const c = new THREE.Vector3().setFromMatrixPosition(pd.group.matrixWorld);
      const dir = new THREE.Vector3(camera.position.x - c.x, 0, camera.position.z - c.z).normalize();
      const p = c.clone().addScaledVector(dir, pd.R * 0.97 * pd.group.getWorldScale(new THREE.Vector3()).x);
      p.y = c.y + pd.H * 0.3;
      p.project(camera);
      const rc = renderer.domElement.getBoundingClientRect();
      return { x: rc.left + ((p.x + 1) / 2) * rc.width, y: rc.top + ((1 - p.y) / 2) * rc.height };
    };
    /** DEV (r64): trần thích ứng lúc kéo / lướt (core/renderer) + đã biên dịch sẵn vòng cầm / đèn bục chưa. */
    vm.cinemaCapInfo = () => ({ ...view.capInfo, grabPrecompiled: S.grabPrecompiled });
    /** DEV (r63): mặt lòng bục gợn nhẹ — trạng thái đã áp ở gương + vật liệu lòng bục của hai bục. */
    vm.cinemaRipple = () => ({
      k: ripple.k,
      sizeM: +ripple.sizeM.toFixed(4),
      drift: ripple.drift,
      off: [+ripple.off.x.toFixed(5), +ripple.off.y.toFixed(5)],
      mirrors: mirrors.map((m) => { const u = m.mesh.material.uniforms; return { px: +u.uRipplePx.value.toFixed(3), scale: +u.uRippleScale.value.toFixed(3), tex: !!u.tRipple.value, ripple: 'REFLECT_RIPPLE' in (m.mesh.material.defines || {}) }; }),
      dish: pedestals.map((p) => p.ripple),
      tex: ripple.tex ? { size: ripple.tex.image.width, mipmaps: ripple.tex.generateMipmaps && ripple.tex.minFilter === THREE.LinearMipmapLinearFilter, repeat: ripple.tex.wrapS === THREE.RepeatWrapping, aniso: ripple.tex.anisotropy } : null,
    });
    /** DEV (r56): chỉnh bộ bám của kéo bia ({ w, predict, ff, vtau } — xem stage/transition.js TUNE). */
    vm.cinemaScrubTune = (o) => transitionApi.scrubTune(o);
    /** DEV (r74): quét bản dập — trạng thái + điều khiển tay (start / progress p / cancel / fire / play / release / off; r83: look id). */
    vm.cinemaScan = (cmd, a) => {
      if (cmd === 'start') scanApi.scanStart();
      else if (cmd === 'progress') scanApi.scanProgress(a);
      else if (cmd === 'cancel') scanApi.scanCancel();
      else if (cmd === 'fire') scanApi.scanFire();
      else if (cmd === 'play') scanApi.scanPlay(a);
      else if (cmd === 'release') scanApi.scanRelease();
      else if (cmd === 'off') scanApi.scanOff();
      else if (cmd === 'prepare') return scanApi.scanPrepare();
      else if (cmd === 'look') return scanApi.scanLook(a); // r83: bản dập của bia a (có / đã nạp / URL / nguồn)
      const u = S.live?.polish?.uniforms;
      return { ...scanApi.scanState, u: u ? u.uScan.value.toArray().map((v) => +v.toFixed(4)) : null, frozen: S.holdFreeze };
    };
    /**
     * DEV (r82b): chữ Hán — trạng thái (pha, số sprite, đồng hồ, uniform shader, URL đã nạp); ('at', i) → toạ độ bia chữ i;
     * ('sprite', n) → vị trí màn hình + độ hiện sprite n; ('prepare') → nạp; ('project', [x, y]) → px client của điểm mặt bia.
     */
    vm.cinemaGlyphs = (cmd, a) => {
      if (cmd === 'at') return glyphApi.glyphAt(a);
      if (cmd === 'sprite') return glyphApi.glyphSpriteProbe(a);
      if (cmd === 'prepare') return glyphApi.glyphPrepare();
      if (cmd === 'times') return glyphApi.glyphTimes(); // r84: nhịp từng sprite (tiến độ camera)
      if (cmd === 'han') return glyphApi.glyphHanCheck(a ?? 0); // r87: chữ Hán số hoá — ô dưới ngưỡng không có chữ · r89 ('han', n): + n ô mẫu
      if (cmd === 'quad') {
        // r87: sprite a vẽ riêng (quad tô kín) → rộng / cao / độ lấp đầy trên màn (đo tỉ lệ + góc xoay thật); vẽ lại khung thường
        const [n, sc] = Array.isArray(a) ? a : [a, 1];
        const r = glyphApi.glyphQuadPx(n, sc);
        tick(0);
        return r;
      }
      if (cmd === 'project') {
        if (!S.live) return null;
        S.live.lift.updateWorldMatrix(true, false);
        camera.updateMatrixWorld();
        const v = new THREE.Vector3(a[0], a[1], a[2] ?? K.bounds.zFront).applyMatrix4(S.live.lift.matrixWorld).project(camera);
        const cr = cRect();
        return { x: cr.left + ((v.x + 1) / 2) * cr.width, y: cr.top + ((1 - v.y) / 2) * cr.height };
      }
      return glyphApi.glyphState;
    };
    /**
     * DEV (r81): ô chữ mặt bia + bố cục lớp tên của bia hiện tại — toạ độ mặt phẳng (= mô hình x, y) và hình chiếu lên màn (px
     * client, hộp bao 4 góc): ô (field), đường dưới dải tiêu đề (band, y màn ở giữa ô), ô lớp tên (box), khối tên đỗ đầu (head),
     * vùng cuộn (roll).
     */
    vm.cinemaNamesLayout = () => {
      const i = S.cur;
      const lay = namesRigs?.[i]?.layout?.() ?? null;
      const m = steleMetrics();
      const field = m?.field ?? null;
      const pw = planes[i].group;
      pw.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const cr = cRect();
      const v = new THREE.Vector3();
      const scr = (x, y) => {
        v.set(x, y, 0).applyMatrix4(pw.matrixWorld).project(camera);
        return { x: cr.left + ((v.x + 1) / 2) * cr.width, y: cr.top + ((1 - v.y) / 2) * cr.height };
      };
      const box = (r) => {
        if (!r) return null;
        const p = [scr(r.x0, r.y0), scr(r.x1, r.y0), scr(r.x0, r.y1), scr(r.x1, r.y1)];
        const xs = p.map((q) => q.x);
        const ys = p.map((q) => q.y);
        return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
      };
      return {
        id: slotEntry[i]?.id ?? null,
        field,
        lay,
        screen: { field: box(field), band: field ? scr((field.x0 + field.x1) / 2, field.band ?? field.y1).y : null, box: box(lay?.box), head: box(lay?.head), roll: box(lay?.roll) },
        x0: lay?.box.x0,
        x1: lay?.box.x1,
        head: lay?.head ?? null,
        roll: lay?.roll ?? null,
        rollPlan: namesRigs?.[i]?.roll ?? null, // r90: lịch cuộn theo giáp (chu kỳ, từng giáp, các lần đổi tên giáp)
      };
    };
    /** DEV (r74): điểm px client (x, y) có trên MẶT TRƯỚC phiến không (cùng phép thử của tay) + điểm trúng (toạ độ bia). */
    vm.cinemaFaceAt = (x, y) => {
      const r = cRect();
      const nx = ((x - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((y - r.top) / r.height) * 2;
      const hit = hitStele(nx, ny);
      const face = hit && faceOfHit();
      return { hit, face, bvh: !!S.live?.bvh, head: S.live?.head ? { c: S.live.head.center, r: S.live.head.radius } : null };
    };
    /** DEV (r85): vật liệu của bia đang hiện — có normal map không, số đỉnh (đèn xiên dựa vào pháp tuyến shading). */
    vm.cinemaMaterials = () => {
      const out = [];
      S.live?.inst?.traverse((o) => {
        if (!o.isMesh) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        out.push({ name: o.name, verts: o.geometry.attributes.position?.count ?? 0, normalMap: !!m?.normalMap, nmSize: m?.normalMap?.image ? [m.normalMap.image.width, m.normalMap.image.height] : null, map: m?.map?.image ? [m.map.image.width, m.map.image.height] : null, type: m?.type });
      });
      return out;
    };
    /** DEV (r84): hộp + mặt trước của bia đang hiện (toạ độ bia) + khung mặt bản dập — kiểm thử cổng độ sâu (hông phiến, đầu rùa). */
    vm.cinemaBounds = () => {
      const B = K.bounds;
      return B ? { slabL: B.slabL, slabR: B.slabR, yMin: B.yMin, yMax: B.yMax, zFront: B.zFront, zBack: B.zBack ?? null, bandBottom: B.bandBottom, frame: K.scanFrame?.() ?? null } : null;
    };
    /** DEV (r74): khung đọc — hình chiếu đỉnh vòm / chân mặt bia / hộp đầu rùa + lời giải; 'snap' = bộ bám tới đích ngay. */
    vm.cinemaRead = (cmd) => {
      if (cmd === 'snap') readApi.readSnap();
      else if (cmd && typeof cmd === 'object' && 'shadow' in cmd) readApi.readShadow(cmd.shadow); // r78: bật / tắt bóng tấm (so ảnh)
      return readApi.readProbe();
    };
  }
  return api;
}
