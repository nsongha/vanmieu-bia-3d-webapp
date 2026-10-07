// Sân khấu Điện ảnh › ánh sáng: đèn chính (key), đèn rọi trạng thái chưa hover + ánh hắt từ bục, rim theo camera.
//
// Hai trạng thái ánh sáng (settings.cinemaContrast): chưa hover — đèn rọi góc trên trái, tối dần xuống; hover — sáng đều.
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): keyDist, contrast, lightU, lightE, spotLevel, castK, catchMat
// Đọc / ghi S của nơi khác: pedestalOn, catcher
import * as THREE from 'three';
import { createStudioLights, dirFromAngles } from '../../../core/lighting.js';
import { DEFAULTS, getSettings } from '../../../core/settings.js';
import { neverCastShadow } from '../hotspot.js';
import {
  IDLE, IDLE_SPOT, KEY_AIM_Y, KEY_FAR, KEY_NEAR, LIGHT_DIST, LIGHT_TARGET, RIM_EL, RIM_OFFSET, SPILL, SPOT_SHADOW_K,
  SPOT_SHADOW_MAP, clampNum, easeInOutCubic
} from './config.js';

export function installLights(S, K, deps) {
  const {
    camera, renderer, scene
  } = deps;

  // ---- Ánh sáng chuẩn dùng chung. floor:false vì view này có sàn phản chiếu riêng.
  const lights = createStudioLights(scene, renderer, 'cinematic', {
    target: LIGHT_TARGET.clone(),
    distance: LIGHT_DIST,
    floor: false,
  });

  // ---- Đèn rọi trạng thái chưa hover + ánh hắt từ bục (xem IDLE / SPILL). Dựng SẴN lúc mount với
  // cường độ 0 → số đèn không bao giờ đổi. layers.enableAll: lượt ghép ảnh chuyển cảnh lọc đèn theo lớp.
  // Đèn rọi là đèn đổ bóng duy nhất: khoá key preset không đổ bóng (core/lighting áp castShadow theo
  // settings.shadow mỗi lần cài đặt đổi — ở đây phép gán đó thành vô hiệu). Cả hai cờ đặt TRƯỚC mọi lần
  // biên dịch (preheat bên dưới) và không bao giờ đổi nữa: đổi castShadow = đổi biến thể shader.
  neverCastShadow(lights.key);
  // Đổi LOẠI đèn chính một lần lúc mount (trước mọi lần biên dịch): gỡ DirectionalLight của preset khỏi
  // cảnh (core vẫn giữ nó làm chỗ chứa số liệu preset × cài đặt: keyBase, keyMul), thay bằng đèn điểm.
  scene.remove(lights.key, lights.key.target);
  const cineKey = new THREE.PointLight(0xffd9b0, 0, 0, 2);
  cineKey.castShadow = false;
  cineKey.layers.enableAll();
  scene.add(cineKey);
  const keyAim = new THREE.Vector3(0, KEY_AIM_Y, 0);
  const keyCfg = { az: DEFAULTS.keyAzimuth, el: DEFAULTS.keyElevation, falloff: DEFAULTS.keyFalloff };
  S.keyDist = KEY_FAR;
  const idleSpot = new THREE.SpotLight(0xffd9b0, 0, 0, THREE.MathUtils.degToRad(IDLE_SPOT.angle), IDLE_SPOT.penumbra, IDLE_SPOT.decay);
  idleSpot.castShadow = true; // tắt bóng = shadow.intensity 0 + không vẽ shadow map (xem syncSpot / tick)
  idleSpot.shadow.mapSize.set(SPOT_SHADOW_MAP, SPOT_SHADOW_MAP);
  idleSpot.shadow.blurSamples = 8;
  idleSpot.shadow.bias = 0;
  idleSpot.shadow.normalBias = 0.01;
  // near/far ôm từ đỉnh bia gần đèn nhất tới mép chùm trên sàn ở độ cao thấp nhất (30°, chùm 35°).
  idleSpot.shadow.camera.near = 0.5;
  idleSpot.shadow.camera.far = 7;
  const spill = new THREE.PointLight(0xffffff, 0, SPILL.dist, SPILL.decay);
  spill.castShadow = false;
  for (const l of [idleSpot, idleSpot.target, spill]) l.layers.enableAll();
  scene.add(idleSpot, idleSpot.target, spill);
  // Cường độ gốc của các đèn preset (preset × cài đặt người dùng) — chụp lại mỗi khi cài đặt đổi (đèn
  // preset vừa được core áp lại), rồi nhân hệ số trạng thái mỗi khung khi đang đổi.
  const lightBase = { key: 0, fill: 0, hemi: 0, env: 0 };
  const captureLightBase = () => {
    lightBase.key = lights.keyBase;
    lightBase.fill = FILL_BASE;
    lightBase.hemi = lights.hemi.intensity;
    lightBase.env = 'environmentIntensity' in scene ? scene.environmentIntensity : 0;
  };
  const FILL_BASE = lights.fill.intensity;
  captureLightBase();
  S.contrast = clampNum(getSettings().cinemaContrast, 0, 1, DEFAULTS.cinemaContrast);
  S.lightU = 0; // 0 = chưa hover … 1 = hover (tuyến tính)
  S.lightE = -1; // mức kịch tính đã áp lần cuối (−1 = chưa áp)
  // Đèn rọi theo cài đặt (syncSpot): hệ số cường độ + độ đậm bóng.
  S.spotLevel = 1; // settings.spotIntensity 0..2
  S.castK = 1; // settings.cinemaCastShadow 0..1,5 (0 = không có bóng đổ, không vẽ shadow map)
  // Đĩa hứng bóng sàn: đậm theo phần sáng đèn rọi + suy giảm nón (uniform, cập nhật trong placeIdleSpot).
  const catchU = {
    uSpotPos: { value: new THREE.Vector3() },
    uSpotDir: { value: new THREE.Vector3(0, -1, 0) },
    uConeCos: { value: 0.97 },
    uPenCos: { value: 1 },
  };
  S.catchMat = null; // dựng ở phần sàn bên dưới
  function applyIdleLighting(force = false) {
    const e = S.contrast * (1 - easeInOutCubic(S.lightU));
    if (!force && Math.abs(e - S.lightE) < 1e-4) return;
    S.lightE = e;
    const lerp = (k) => 1 - e * (1 - k);
    // Bù d²: độ rọi tại tâm ngắm = cường độ preset × cài đặt, bất kể khoảng cách (keyFalloff).
    cineKey.intensity = lightBase.key * lerp(IDLE.key) * S.keyDist * S.keyDist;
    lights.fill.intensity = lightBase.fill * lerp(IDLE.fill);
    lights.hemi.intensity = lightBase.hemi * lerp(IDLE.hemi);
    if ('environmentIntensity' in scene) scene.environmentIntensity = lightBase.env * lerp(IDLE.env);
    idleSpot.intensity = IDLE_SPOT_I() * e;
    // Bóng sàn nhạt dần CÙNG đèn rọi (hover → không còn bóng nào: đèn đổ bóng đã tắt) — hết bóng thì
    // ẩn hẳn đĩa hứng bóng (bớt một draw call; đổi visible không biên dịch lại).
    if (S.catchMat) {
      S.catchMat.opacity = Math.min(1, SPOT_SHADOW_K * S.castK * S.spotLevel * e);
      S.catcher.visible = S.catchMat.opacity > 0.001;
    }
  }
  // Đèn rọi có thanh cường độ riêng (settings.spotIntensity) → không còn ăn theo "Đèn chính".
  const IDLE_SPOT_I = () => IDLE.spot * S.spotLevel;
  /**
   * Đèn rọi trạng thái chưa hover: nhắm góc trên-trái phiến bia ở tư thế đứng (theo độ nâng của bục).
   * Cập nhật luôn bán kính nhoè bóng + uniform nón của đĩa hứng bóng. Chỉ đổi số (uniform) — không
   * biên dịch lại gì; shadow map vẽ lại là việc của nơi gọi (chỉ khi hướng / góc chùm / điểm ngắm đổi).
   */
  function placeIdleSpot() {
    idleSpot.angle = THREE.MathUtils.degToRad(IDLE_SPOT.angle);
    idleSpot.penumbra = IDLE_SPOT.penumbra;
    idleSpot.target.position.set(IDLE_SPOT.aimX, IDLE_SPOT.aimY + (S.pedestalOn ? K.pedestals[0].lift : 0), IDLE_SPOT.aimZ); // hai bục cùng độ nâng
    idleSpot.position.copy(idleSpot.target.position).addScaledVector(dirFromAngles(IDLE_SPOT.az, IDLE_SPOT.el), IDLE_SPOT.dist);
    idleSpot.target.updateMatrixWorld();
    idleSpot.updateMatrixWorld();
    // texel shadow map tại tâm ngắm = bề ngang chùm (2·dist·tan góc) / số texel → bán kính nhoè theo texel.
    const texel = (2 * IDLE_SPOT.dist * Math.tan(idleSpot.angle)) / SPOT_SHADOW_MAP;
    idleSpot.shadow.radius = THREE.MathUtils.clamp(IDLE_SPOT.blur / texel, 2, 12);
    idleSpot.shadow.normalBias = IDLE_SPOT.normalBias;
    catchU.uSpotPos.value.copy(idleSpot.position);
    catchU.uSpotDir.value.copy(idleSpot.target.position).sub(idleSpot.position).normalize();
    // Như getSpotAttenuation của three: smoothstep(cos góc, cos(góc × (1 − penumbra)), cos θ).
    catchU.uConeCos.value = Math.cos(idleSpot.angle);
    catchU.uPenCos.value = Math.max(Math.cos(idleSpot.angle * (1 - idleSpot.penumbra)), catchU.uConeCos.value + 1e-4);
  }
  const SPOT_HEX = /^#[0-9a-f]{6}$/i;
  /**
   * Cài đặt đèn rọi + bóng đổ → đèn. Trả về true khi shadow map phải vẽ lại: hướng / độ cao / góc chùm
   * đổi (shadow camera dời), hoặc bóng vừa bật lại từ 0 (bản đồ cũ đã lỗi thời). Cường độ, màu, độ
   * mềm mép (penumbra không đổi shadow camera) và độ đậm bóng KHÔNG cần vẽ lại.
   */
  function syncSpot(s) {
    const az = clampNum(Number(s.spotAzimuth), -90, 90, DEFAULTS.spotAzimuth);
    const el = clampNum(Number(s.spotElevation), 30, 88, DEFAULTS.spotElevation);
    const angle = clampNum(Number(s.spotAngle), 6, 35, DEFAULTS.spotAngle);
    const moved = az !== IDLE_SPOT.az || el !== IDLE_SPOT.el || angle !== IDLE_SPOT.angle;
    IDLE_SPOT.az = az;
    IDLE_SPOT.el = el;
    IDLE_SPOT.angle = angle;
    IDLE_SPOT.penumbra = clampNum(Number(s.spotSoftness), 0, 1, DEFAULTS.spotSoftness);
    S.spotLevel = clampNum(Number(s.spotIntensity), 0, 2, DEFAULTS.spotIntensity);
    idleSpot.color.set(SPOT_HEX.test(s.spotColor) ? s.spotColor : '#ffd9b0');
    const was = S.castK;
    S.castK = clampNum(Number(s.cinemaCastShadow), 0, 1.5, DEFAULTS.cinemaCastShadow);
    idleSpot.shadow.intensity = Math.min(1, S.castK);
    placeIdleSpot();
    return moved || (was === 0 && S.castK > 0);
  }
  /** Đèn chính: đặt theo hướng + khoảng cách (keyFalloff) quanh tâm ngắm giữa thân bia. */
  function placeKey() {
    const f = keyCfg.falloff;
    S.keyDist = f > 0 ? Math.min(KEY_FAR, KEY_NEAR / f) : KEY_FAR;
    keyAim.set(0, KEY_AIM_Y + (S.pedestalOn ? K.pedestals[0].lift : 0), 0);
    cineKey.position.copy(keyAim).addScaledVector(dirFromAngles(keyCfg.az, keyCfg.el), S.keyDist);
  }
  /** Cài đặt đèn chính (Điện ảnh) → đèn. Hướng / khoảng cách / màu đều chỉ là số: không biên dịch lại. */
  function syncKey(s) {
    keyCfg.az = clampNum(Number(s.keyAzimuth), -90, 90, DEFAULTS.keyAzimuth);
    keyCfg.el = clampNum(Number(s.keyElevation), 10, 85, DEFAULTS.keyElevation);
    keyCfg.falloff = clampNum(Number(s.keyFalloff), 0, 1, DEFAULTS.keyFalloff);
    cineKey.color.set(SPOT_HEX.test(s.keyColor) ? s.keyColor : '#ffd9b0');
    placeKey();
  }
  const _spill = new THREE.Vector3();
  const _spillDir = new THREE.Vector3();
  let rimAz = NaN;

  const _rimDir = new THREE.Vector3();
  const RIM_EL_RAD = THREE.MathUtils.degToRad(RIM_EL);

  /** Rim luôn chếch sau lưng vật thể so với camera → viền sáng tách khối khỏi nền ở mọi góc. */
  function trackRim() {
    const az = THREE.MathUtils.radToDeg(
      Math.atan2(camera.position.x - K.controls.target.x, camera.position.z - K.controls.target.z),
    );
    if (Number.isFinite(rimAz) && Math.abs(az - rimAz) < 0.5) return;
    rimAz = az;
    // Nội tuyến thay cho placeLight(): hàm đó tạo Vector3 mới mỗi lần gọi.
    const a = THREE.MathUtils.degToRad(az + RIM_OFFSET);
    const ce = Math.cos(RIM_EL_RAD);
    _rimDir.set(Math.sin(a) * ce, Math.sin(RIM_EL_RAD), Math.cos(a) * ce);
    lights.rim.position.copy(LIGHT_TARGET).addScaledVector(_rimDir, LIGHT_DIST);
    lights.rim.target.position.copy(LIGHT_TARGET);
    lights.rim.target.updateMatrixWorld();
  }
  return {
    _spill, _spillDir, applyIdleLighting, captureLightBase, catchU, cineKey, idleSpot, keyAim, keyCfg, lights,
    placeIdleSpot, placeKey, spill, syncKey, syncSpot, trackRim,
  };
}
