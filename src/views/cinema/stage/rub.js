// Sân khấu Điện ảnh › xoa đầu rùa (phần sân khấu): shader độ bóng, khung camera cận đầu rùa, tia trúng đầu rùa.
//
// Giao diện + nhận biết cử chỉ xoa ở rub.js (views/cinema); đây là phần 3D: camera, trạng thái từng bia, lưu độ bóng.
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps.
// Giữ (S — module này ghi chính): rubEnabled, rubOn, rubK, rubGoalOk
// Đọc / ghi S của nơi khác: viewAz, camTw, distRelax, lastInteract, live, retiring, tx
import * as THREE from 'three';
import { DEFAULTS, getSettings, onSettings } from '../../../core/settings.js';
import { hasBVH } from '../bvh.js';
import { REGION_HEAD_K, createPolish, regionDist } from '../polish.js';
import { loadRub, onRubCleared, saveRub } from '../../../core/rub-store.js';
import {
  RUB_AZ, RUB_EL, RUB_FILL, RUB_FILL_W, RUB_IN, RUB_OUT, clampNum, easeLeave, headOf
} from './config.js';

export function installRub(S, K, deps) {
  const {
    _yAxis, applyDistLimits, beginCamTween, cRect, camera, controls, distBase, home0, raycaster, reduceMotion, warm
  } = deps;

  S.rubEnabled = getSettings().cinemaRub !== false;
  /** Màu (tuyến tính) + độ bóng ở chỗ xoa bóng tối đa (settings.rubColor / rubGloss) — chỉ là uniform. */
  const rubLook = { color: new THREE.Color(DEFAULTS.rubColor), gloss: DEFAULTS.rubGloss, key: '' };
  function readRubLook(s) {
    const hex = typeof s.rubColor === 'string' && /^#[0-9a-f]{6}$/i.test(s.rubColor) ? s.rubColor : DEFAULTS.rubColor;
    const gloss = clampNum(Number(s.rubGloss), 0, 1, DEFAULTS.rubGloss);
    const key = `${hex}|${gloss}`;
    if (key === rubLook.key) return false;
    rubLook.key = key;
    rubLook.color.set(hex); // THREE.Color.set(hex) giải sRGB → tuyến tính (ColorManagement)
    rubLook.gloss = gloss;
    return true;
  }
  readRubLook(getSettings());
  function applyRubLook(polish) {
    polish?.setLook(rubLook.color, rubLook.gloss);
  }
  /** Trạng thái xoa của bản sao vừa lên sân khấu: đầu rùa, độ bóng (nạp từ localStorage), số lượt xoa. */
  function rubStateFor(inst, id) {
    const polish = inst.userData.polish ?? createPolish(THREE);
    const head = headOf(id);
    const saved = loadRub(id);
    polish.load(saved.p);
    if (!S.rubEnabled) polish.uniforms.uPolishN.value = 0;
    return { id, head, polish, rubN: saved.n, rubDirty: false };
  }

  const _rubC = new THREE.Vector3();
  const _rubV = new THREE.Vector3();
  const _rubS = new THREE.Spherical();
  /** Tâm đầu rùa của bia hiện tại trong toạ độ thế giới (false nếu bia không có đầu rùa). */
  function headWorld(out) {
    if (!S.live?.head) return false;
    S.live.inst.updateWorldMatrix(true, false);
    out.set(S.live.head.center[0], S.live.head.center[1], S.live.head.center[2]).applyMatrix4(S.live.inst.matrixWorld);
    return true;
  }
  /** Khung cận đầu rùa — tính mỗi khung trong chế độ (đầu rùa theo lắc / chuyển cảnh nếu có). */
  function computeRubGoal() {
    S.rubGoalOk = headWorld(_rubC);
    if (!S.rubGoalOk) return;
    const r = S.live.head.radius;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let d = r / (RUB_FILL * halfTan);
    d = Math.max(d, r / (RUB_FILL_W * halfTan * Math.max(0.2, camera.aspect)));
    // phía 3/4 chốt MỘT lần lúc vào (khung đích không bao giờ đổi phía giữa chừng)
    if (!S.rubOn || !rubSide) rubSide = S.viewAz < 0 ? -1 : 1;
    const az = THREE.MathUtils.degToRad(RUB_AZ * rubSide);
    const el = THREE.MathUtils.degToRad(RUB_EL);
    rubGoal.target.copy(_rubC);
    rubGoal.pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(_rubC);
    rubGoal.dist = d;
  }
  /** Vào / rời chế độ xoa đầu rùa: camera, ánh sáng, lắc. Độ nhạy xoay / zoom giữ nguyên (r10). */
  function setRubMode(on) {
    on = !!on && S.rubEnabled && !!S.live?.head && !S.tx;
    if (on === S.rubOn) return S.rubOn;
    if (on) {
      computeRubGoal();
      if (!S.rubGoalOk) return false;
      S.rubOn = true;
      S.distRelax = rubGoal.dist * 0.6;
      applyDistLimits();
      S.camTw = beginCamTween('rub', reduceMotion ? 1e-3 : RUB_IN, easeLeave, true);
    } else {
      S.rubOn = false;
      rubSide = 0;
      S.live?.polish?.setBrush(null);
      // khoảng cách: minDistance gốc trả lại khi camera đã lùi quá nó (rubRestoreStep) — không giật
      if (!S.tx) S.camTw = beginCamTween('rub-out', reduceMotion ? 1e-3 : RUB_OUT, easeLeave, true);
    }
    return S.rubOn;
  }
  /** Trả giới hạn khoảng cách của OrbitControls khi camera đã ra khỏi vùng cận (gọi mỗi khung). */
  function rubRestoreStep() {
    if (S.rubOn || S.readOn || S.distRelax <= 0) return; // r74: khung đọc cũng nới minDistance
    if (camera.position.distanceTo(controls.target) >= distBase.min - 1e-4) {
      S.distRelax = 0;
      applyDistLimits();
    }
  }
  const _rubNdc = new THREE.Vector2();
  const _rubRay = new THREE.Ray();
  const _rubInv = new THREE.Matrix4();
  /**
   * Điểm NDC có chạm ĐẦU RÙA không: tia xuyên lưới (cây BVH) tới giao điểm gần nhất, rồi xét nằm trong hình cầu
   * đầu rùa. Chưa có cây BVH → giao với chính hình cầu đó. Trả về { x, y, z (toạ độ mô hình), k (khoảng cách
   * tới tâm / bán kính) } hoặc null.
   */
  function rubHit(nx, ny, raw = false) {
    if (!S.live?.head || S.tx) return null;
    _rubNdc.set(nx, ny);
    raycaster.setFromCamera(_rubNdc, camera);
    const h = S.live.head;
    let p = null;
    if (!S.live.bvh) S.live.bvh = hasBVH(S.live.inst);
    S.live.inst.updateWorldMatrix(true, false);
    if (S.live.bvh) {
      const hits = raycaster.intersectObject(S.live.inst, true);
      if (hits.length) p = _rubV.copy(hits[0].point).applyMatrix4(_rubInv.copy(S.live.inst.matrixWorld).invert());
    } else {
      _rubRay.copy(raycaster.ray).applyMatrix4(_rubInv.copy(S.live.inst.matrixWorld).invert());
      // Chưa có cây BVH (đang dựng trong worker): giao với cầu đầu thu nhỏ (0,9 bán kính) — gần đúng mặt đầu rùa.
      _rubC.set(h.center[0], h.center[1], h.center[2]);
      p = _rubRay.intersectSphere({ center: _rubC, radius: h.radius * 0.9 }, _rubV);
    }
    if (!p) return null;
    const k = Math.hypot(p.x - h.center[0], p.y - h.center[1], p.z - h.center[2]) / h.radius;
    const d = regionDist(h, p.x, p.y, p.z); // < 0: trong vùng đầu + cổ (đã cắt dưới cằm)
    if (raw) return { x: p.x, y: p.y, z: p.z, k, d, bvh: !!S.live.bvh };
    return d <= 0 ? { x: p.x, y: p.y, z: p.z, k } : null;
  }
  /** Tâm + bán kính đầu rùa trên màn hình (px client) — vòng nở lúc mở khoá, vùng giữ tay, ngưỡng dao động. */
  const _rubScr = { x: 0, y: 0, r: 0, front: true };
  function rubScreen() {
    if (!headWorld(_rubC)) return null;
    camera.updateMatrixWorld();
    _rubV.copy(_rubC).project(camera);
    if (_rubV.z > 1) return null;
    const rc = cRect();
    _rubScr.x = rc.left + ((_rubV.x + 1) / 2) * rc.width;
    _rubScr.y = rc.top + ((1 - _rubV.y) / 2) * rc.height;
    const depth = _rubS.setFromVector3(_rubV.copy(_rubC).sub(camera.position)).radius;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    _rubScr.r = (S.live.head.radius / Math.max(1e-3, depth * halfTan)) * (rc.height / 2);
    // Đầu rùa quay về phía camera? (mặt trước mô hình = +Z thế giới khi không lắc)
    _rubScr.front = camera.position.z - _rubC.z > -0.05;
    return { ..._rubScr };
  }
  /**
   * Độ "zoom sát" tới đầu rùa: khoảng cách camera → tâm đầu rùa chia cho khoảng cách đó ở KHUNG MẶC ĐỊNH (góc nhìn
   * mặc định, chưa hover). 1 = khung mặc định; nhỏ hơn = đang ở gần hơn (zoom / xoay xuống). Dùng cho điều kiện mở
   * khoá "Xoa đầu rùa" (rub.js) — không phụ thuộc cỡ khung hình.
   */
  const _rubHome = new THREE.Vector3();
  function rubZoomK() {
    if (!headWorld(_rubC)) return Infinity;
    _rubHome.copy(home0.pos).applyAxisAngle(_yAxis, S.viewAz);
    return camera.position.distanceTo(_rubC) / Math.max(1e-3, _rubHome.distanceTo(_rubC));
  }
  /** rubZoomK() của chính khung cận đầu rùa (camera ở khung đó) — rub.js đặt ngưỡng "zoom ra để thoát" theo nó. */
  function rubGoalZoomK() {
    if (!S.rubGoalOk || !headWorld(_rubC)) return Infinity;
    _rubHome.copy(home0.pos).applyAxisAngle(_yAxis, S.viewAz);
    return rubGoal.dist / Math.max(1e-3, _rubHome.distanceTo(_rubC));
  }
  const offRubCleared = onRubCleared(() => {
    for (const s of [S.live, S.retiring]) {
      if (!s?.polish) continue;
      s.polish.clear();
      s.rubN = 0;
      s.rubDirty = false;
    }
    for (const w of warm.values()) w.inst.userData.polish?.clear();
  });
  function saveLiveRub() {
    if (!S.live?.id || !S.live.rubDirty) return;
    S.live.rubDirty = false;
    saveRub(S.live.id, { n: S.live.rubN, p: S.live.polish.serialize() });
  }
  // Cài đặt "Xoa đầu rùa": tắt → rời chế độ, ẩn độ bóng (vẫn giữ trong bộ nhớ); bật lại → hiện lại.
  const offRubSettings = onSettings((s) => {
    if (readRubLook(s)) {
      for (const st of [S.live, S.retiring]) applyRubLook(st?.polish);
      for (const w of warm.values()) applyRubLook(w.inst.userData.polish);
    }
    const on = s.cinemaRub !== false;
    if (on === S.rubEnabled) return;
    S.rubEnabled = on;
    if (!on && S.rubOn) setRubMode(false);
    for (const st of [S.live, S.retiring]) {
      if (!st?.polish) continue;
      if (on) st.polish.load(st.polish.serialize());
      else st.polish.uniforms.uPolishN.value = 0;
    }
  });
  // Xoa đầu rùa: đang ở chế độ thì khung đích là khung cận đầu rùa (tính mỗi khung — xem computeRubGoal).
  S.rubOn = false;
  S.rubK = 0; // 0..1 tuyến tính: lắc tắt dần khi vào chế độ
  S.rubGoalOk = false;
  let rubSide = 0;
  const brushCol = new THREE.Color(0xd9b36c); // vòng brush — ghi đè bằng --gold (rub.js)
  const rubGoal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 1 };
  return {
    applyRubLook, computeRubGoal, headWorld, offRubCleared, offRubSettings, rubGoal, rubRestoreStep, rubScreen,
    rubStateFor, rubZoomK, saveLiveRub, setRubMode,
    api: {
      /**
       * Xoa đầu rùa (r8). Chế độ (camera cận, đèn sáng đều, lắc tắt) do sân khấu lo; nhận biết cử chỉ xoa +
       * giao diện ở rub.js (view điều khiển).
       */
      rub: {
        /** Bia hiện tại có đầu rùa, tính năng đang bật, không đang chuyển cảnh. */
        get available() {
          return S.rubEnabled && !!S.live?.head && !S.tx && !S.live.proxy && !S.live.reveal;
        },
        get active() {
          return S.rubOn;
        },
        /** Camera đã tới khung cận (hết đoạn vào) — trước đó chưa cho xoa. */
        get settled() {
          return S.rubOn && !(S.camTw && S.camTw.kind === 'rub');
        },
        /** Vừa rời chế độ, camera còn đang bay về khung (RUB_OUT) — view giữ thông tin hover ẩn tới lúc tới nơi. */
        get leaving() {
          return !S.rubOn && !!S.camTw && S.camTw.kind === 'rub-out';
        },
        get id() {
          return S.live?.id ?? null;
        },
        setMode: (on) => setRubMode(on),
        screen: () => rubScreen(),
        hit: (nx, ny, raw) => rubHit(nx, ny, raw),
        /** Bán kính đầu rùa (đơn vị mô hình) — cỡ vết xoa tính theo nó. Vùng xoa = regionK × bán kính này. */
        get headRadius() {
          return S.live?.head?.radius ?? 0;
        },
        regionHeadK: REGION_HEAD_K,
        /** Albedo trung bình (tuyến tính) của đầu rùa trên bản quét của bia hiện tại (null nếu không đọc được). */
        get headAlbedo() {
          return S.live?.inst?.userData.headAlbedo ?? null;
        },
        /** Khoảng cách camera → đầu rùa / khoảng cách đó ở khung mặc định (điều kiện mở khoá). */
        zoomK: () => rubZoomK(),
        /** zoomK() tại khung cận đầu rùa. */
        goalZoomK: () => rubGoalZoomK(),
        /**
         * Vòng brush (r10) chiếu lên mặt đá dưới con trỏ: p = điểm chạm (toạ độ mô hình) hoặc null (ẩn), radius = bán
         * kính vết xoa (đơn vị mô hình, đúng cỡ vết), k = độ sáng (để yên ~0,35 · đang xoa 1).
         */
        setBrush(p, radius, k) {
          if (!S.live?.polish) return;
          if (p) S.live.polish.setBrushColor(brushCol);
          S.live.polish.setBrush(p, radius, k);
        },
        /** Màu vòng brush (chuỗi CSS — view truyền --gold của Điện ảnh). */
        setBrushColor(css) {
          try {
            brushCol.set(css);
          } catch {
            /* màu không đọc được → giữ màu cũ */
          }
        },
        /** DEV: tô vùng xoa (đầu + cổ) lên đá, 0..1. */
        setRegionTint(k) {
          S.live?.polish?.setRegionTint(k);
        },
        /** Đang thử mở khoá (giữ con trỏ trên đầu rùa): camera không tự trôi về khung trong lúc đó. */
        keepAwake() {
          S.lastInteract = performance.now();
        },
        /** Hiệu ứng mở khoá trên đầu rùa (uniform): lung linh 0..1, vị trí vệt loé, thời gian (s). */
        setFx(shimmer, glintPos, time) {
          S.live?.polish?.setFx(shimmer, glintPos, time);
        },
        /** Thêm độ bóng tại điểm (toạ độ mô hình) → { before, after } của vết nhận. */
        deposit(p, r, amount) {
          if (!S.live?.polish || !S.rubEnabled) return null;
          S.live.rubDirty = true;
          return S.live.polish.deposit(p.x, p.y, p.z, r, amount);
        },
        /** Độ bóng hiện có tại điểm (toạ độ mô hình), 0..1. */
        polishAt: (p) => (S.live?.polish ? S.live.polish.at(p.x, p.y, p.z) : 0),
        get count() {
          return S.live?.rubN ?? 0;
        },
        addCount(n = 1) {
          if (!S.live) return 0;
          S.live.rubN += n;
          S.live.rubDirty = true;
          return S.live.rubN;
        },
        save: () => saveLiveRub(),
        stats: () => (S.live?.polish ? { ...S.live.polish.stats(), n: S.live.rubN } : null),
      },
    },
  };
}
