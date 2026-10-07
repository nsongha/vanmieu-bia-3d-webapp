// Ánh sáng "chụp sản phẩm / điện ảnh" cho đá cổ.
// Đá vôi/đá xanh của bia: dielectric, roughness cao, màu xám–be. Muốn thấy chữ khắc & hoa văn thì cần:
//  1. Một nguồn key LỚN & MỀM đặt chếch (softbox) → bóng đổ mềm, gradient dài trên mặt cong.
//  2. Fill lạnh, yếu, từ phía đối diện → không "chết" phần tối nhưng vẫn giữ tương phản.
//  3. Rim từ sau → tách vật thể khỏi nền, viền sáng mỏng trên mép bia & mai rùa.
//  4. Môi trường phản xạ (PMREM) có dải sáng lớn → vi bóng (micro-shading) trên bề mặt sần.
import * as THREE from 'three';
import { onSettings } from './settings.js';

/** @typedef {'catalogue'|'cinematic'|'lab'} LightPreset */

const PRESETS = {
  // Sáng, sạch, trung tính-ấm — cho nền giấy (Trưng bày).
  catalogue: {
    exposure: 1.0, envIntensity: 0.65,
    hemi: { sky: 0xf6f0e6, ground: 0x8a7d6c, intensity: 0.38 },
    key: { color: 0xffe9d2, intensity: 1.9, az: -42, el: 44, shadow: true },
    fill: { color: 0xdfe8ff, intensity: 0.45, az: 62, el: 20 },
    rim: { color: 0xffffff, intensity: 1.3, az: 158, el: 32 },
    floorShadow: 0.3,
  },
  // Tối, kịch tính — key mạnh & thấp hơn, rim mạnh, fill rất yếu (Điện ảnh).
  cinematic: {
    exposure: 1.15, envIntensity: 0.35,
    hemi: { sky: 0x3a3d48, ground: 0x0a0a0c, intensity: 0.25 },
    key: { color: 0xffd9b0, intensity: 3.4, az: -48, el: 38, shadow: true },
    fill: { color: 0x9fb6ff, intensity: 0.35, az: 70, el: 10 },
    rim: { color: 0xcfe0ff, intensity: 2.4, az: 150, el: 28 },
    floorShadow: 0.6,
  },
  // Trung tính, ổn định — để ánh sáng xiên của người dùng quyết định (Nghiên cứu).
  lab: {
    exposure: 1.0, envIntensity: 0.5,
    hemi: { sky: 0xeef0ec, ground: 0x9a9a94, intensity: 0.42 },
    key: { color: 0xfff1e0, intensity: 1.9, az: -40, el: 45, shadow: true },
    fill: { color: 0xe4ecff, intensity: 0.45, az: 55, el: 20 },
    rim: { color: 0xffffff, intensity: 0.8, az: 165, el: 30 },
    floorShadow: 0.22,
  },
};

/**
 * Vector hướng từ góc phương vị/độ cao (độ). az 0 = từ phía +Z (trước), tăng theo chiều kim đồng hồ nhìn từ trên.
 */
export function dirFromAngles(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** Đặt DirectionalLight quanh target theo góc (dùng cho "ánh sáng xiên"). */
export function placeLight(light, azDeg, elDeg, distance = 3, target = new THREE.Vector3(0, 0.5, 0)) {
  light.position.copy(target).addScaledVector(dirFromAngles(azDeg, elDeg), distance);
  light.target.position.copy(target);
  light.target.updateMatrixWorld();
}

function softbox(w, h, color, intensity) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  return mesh;
}

/**
 * Môi trường studio dựng thủ công: 3 softbox (key/fill/rim) + trần + nền gradient, → PMREM.
 * Trả về texture để gán scene.environment (và tuỳ chọn scene.background).
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ tone?: 'warm'|'neutral'|'cool', floor?: number }} [opts] floor = độ sáng nền (0..1)
 */
const _envCache = new Map();

export function createStudioEnvironment(renderer, opts = {}) {
  const tone = opts.tone ?? 'neutral';
  const cacheKey = `${tone}:${opts.floor ?? 0.25}`;
  if (_envCache.has(cacheKey)) return _envCache.get(cacheKey);
  const tex = buildStudioEnvironment(renderer, tone, opts.floor ?? 0.25);
  _envCache.set(cacheKey, tex);
  return tex;
}

function buildStudioEnvironment(renderer, tone, floorTone) {
  const tint = tone === 'warm' ? 0xfff1e0 : tone === 'cool' ? 0xe6eeff : 0xffffff;
  const scene = new THREE.Scene();

  // Phòng: hộp lớn, mặt trong xám tối, sàn sáng hơn một chút để "bật" mặt dưới.
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(10, 8, 10),
    new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 1, metalness: 0, side: THREE.BackSide }),
  );
  room.position.y = 3;
  scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(floorTone) }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.98;
  scene.add(floor);

  // Key softbox: lớn, chếch trái-trên-trước.
  const key = softbox(3.2, 2.4, tint, 14);
  key.position.set(-3.2, 3.6, 3.0);
  key.lookAt(0, 0.6, 0);
  scene.add(key);
  // Fill: rộng, yếu, lạnh nhẹ, bên phải.
  const fill = softbox(4.0, 3.0, 0xe4ecff, 3.5);
  fill.position.set(4.0, 1.8, 1.5);
  fill.lookAt(0, 0.6, 0);
  scene.add(fill);
  // Rim: dải hẹp phía sau-trên-phải.
  const rim = softbox(0.7, 3.6, 0xffffff, 18);
  rim.position.set(2.0, 3.2, -3.8);
  rim.lookAt(0, 0.6, 0);
  scene.add(rim);
  // Trần: mảng sáng mờ → highlight trên đỉnh bia & mai rùa.
  const top = softbox(2.0, 2.0, tint, 4);
  top.position.set(0, 6.6, 0);
  top.lookAt(0, 0, 0);
  scene.add(top);
  // Đèn để MeshStandardMaterial của phòng có chút gradient (không cần chính xác).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.6));

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt.texture;
}

/**
 * Bộ đèn trực tiếp (có bóng) theo preset. Mọi đèn đặt quanh target (0, 0.5, 0) — tâm bia cao 1 đơn vị.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {LightPreset} preset
 * @param {{ target?: THREE.Vector3, distance?: number, floor?: boolean, environment?: boolean, envTone?: 'warm'|'neutral'|'cool' }} [opts]
 * @returns {{ key: THREE.DirectionalLight, fill: THREE.DirectionalLight, rim: THREE.DirectionalLight, hemi: THREE.HemisphereLight, floor: THREE.Mesh|null, env: THREE.Texture|null, keyBase:number, keyMul:number, floorShadowMax:number, apply(preset:LightPreset):void, applyUserSettings(settings:object):void, setRaking(az:number, el:number, intensity?:number):void, dispose():void }}
 */
export function createStudioLights(scene, renderer, preset = 'catalogue', opts = {}) {
  const target = opts.target ?? new THREE.Vector3(0, 0.5, 0);
  const distance = opts.distance ?? 4;
  const P = PRESETS[preset] ?? PRESETS.catalogue;

  const hemi = new THREE.HemisphereLight(P.hemi.sky, P.hemi.ground, P.hemi.intensity);
  const key = new THREE.DirectionalLight(P.key.color, P.key.intensity);
  const fill = new THREE.DirectionalLight(P.fill.color, P.fill.intensity);
  const rim = new THREE.DirectionalLight(P.rim.color, P.rim.intensity);
  for (const l of [key, fill, rim]) scene.add(l, l.target);
  scene.add(hemi);

  // Bóng mềm cho key: shadow camera ôm sát khối 1.6 đơn vị quanh bia.
  key.castShadow = true;
  // VSM 1024²: penumbra mềm thật, nhoè trên shadow map (rẻ) thay vì lấy mẫu nhiều lần mỗi fragment.
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.blurSamples = 8;
  const sc = key.shadow.camera;
  // Ôm khối 1 đơn vị + bóng đổ trên sàn khi key thấp (bóng vươn ~2 đơn vị).
  sc.left = -1.6; sc.right = 1.6; sc.top = 1.6; sc.bottom = -1.4; sc.near = 0.5; sc.far = distance * 2.5;
  // Đã so ảnh chụp: VSM bias 0 / normalBias 0.015 / radius 6 cho bóng mềm, không rỗ, không bleeding đáng kể.
  key.shadow.bias = 0;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 6;

  let floor = null;
  if (opts.floor !== false) {
    floor = new THREE.Mesh(
      new THREE.CircleGeometry(3, 64),
      new THREE.ShadowMaterial({ opacity: P.floorShadow, color: 0x1a140e }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.0005;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  let env = null;
  if (opts.environment !== false) {
    env = createStudioEnvironment(renderer, { tone: opts.envTone ?? (preset === 'cinematic' ? 'warm' : 'neutral') });
    scene.environment = env;
    if ('environmentIntensity' in scene) scene.environmentIntensity = P.envIntensity;
  }
  renderer.toneMappingExposure = P.exposure;

  // Preset đang dùng + cài đặt người dùng gần nhất — mọi con số của người dùng là
  // HỆ SỐ NHÂN lên preset, nên phải nhớ cả hai để áp lại khi một trong hai đổi.
  let current = PRESETS[preset] ? preset : 'catalogue';
  /** @type {object|null} */
  let user = null;
  let keyMul = 1;

  function apply(name) {
    current = PRESETS[name] ? name : 'catalogue';
    const Q = PRESETS[current];
    hemi.color.set(Q.hemi.sky); hemi.groundColor.set(Q.hemi.ground); hemi.intensity = Q.hemi.intensity;
    key.color.set(Q.key.color); key.intensity = Q.key.intensity; placeLight(key, Q.key.az, Q.key.el, distance, target);
    fill.color.set(Q.fill.color); fill.intensity = Q.fill.intensity; placeLight(fill, Q.fill.az, Q.fill.el, distance, target);
    rim.color.set(Q.rim.color); rim.intensity = Q.rim.intensity; placeLight(rim, Q.rim.az, Q.rim.el, distance, target);
    if (floor) floor.material.opacity = Q.floorShadow;
    if ('environmentIntensity' in scene) scene.environmentIntensity = Q.envIntensity;
    renderer.toneMappingExposure = Q.exposure;
    // Đổi preset KHÔNG được làm mất chỉnh tay của người dùng.
    if (user) applyUserSettings(user);
  }

  const mul = (v, d = 1) => (Number.isFinite(+v) ? +v : d);

  /**
   * Phủ cài đặt người dùng (core/settings.js) lên preset hiện tại.
   * Gọi lại được bao nhiêu lần tuỳ ý; không truyền gì thì áp lại bộ gần nhất.
   * @param {{exposure?:number, key?:number, env?:number, shadow?:'off'|'soft'|'sharp', shadowOpacity?:number}} [settings]
   */
  function applyUserSettings(settings) {
    renderer.shadowMap.needsUpdate = true;
    if (settings) user = settings;
    if (!user) return;
    const Q = PRESETS[current] ?? PRESETS.catalogue;
    const env = mul(user.env);
    keyMul = mul(user.key);

    renderer.toneMappingExposure = Q.exposure * mul(user.exposure);
    key.intensity = Q.key.intensity * keyMul;
    hemi.intensity = Q.hemi.intensity * env;
    if ('environmentIntensity' in scene) scene.environmentIntensity = Q.envIntensity * env;

    const mode = user.shadow === 'off' || user.shadow === 'sharp' ? user.shadow : 'soft';
    key.castShadow = mode !== 'off';
    // VSMShadowMap: shadow.radius = bán kính nhoè trên shadow map → 6 mềm, 2 sắc nét.
    if (mode !== 'off') key.shadow.radius = mode === 'sharp' ? 2 : 6;
    if (floor) {
      floor.visible = mode !== 'off';
      floor.material.opacity = Q.floorShadow * mul(user.shadowOpacity);
    }
  }

  apply(preset);

  const api = {
    key, fill, rim, hemi, floor, env,
    apply,
    applyUserSettings,
    /** Hệ số "Đèn chính" người dùng đang đặt (settings.key) — nhân thêm vào cường độ tự tính. */
    get keyMul() { return keyMul; },
    /** Cường độ đèn chính theo preset × cài đặt: giá trị key.intensity khi chưa có raking. */
    get keyBase() { return (PRESETS[current] ?? PRESETS.catalogue).key.intensity * keyMul; },
    /** Độ đậm bóng sàn tối đa theo preset × cài đặt (view nhân với hệ số fade của mình). */
    get floorShadowMax() {
      return (PRESETS[current] ?? PRESETS.catalogue).floorShadow * (user ? mul(user.shadowOpacity) : 1);
    },
    /** Ánh sáng xiên: đưa key xuống thấp theo góc người dùng chọn, giảm fill/hemi để bóng kéo dài. */
    setRaking(az, el, intensity = 3) {
      placeLight(key, az, el, distance, target);
      key.intensity = intensity;
      renderer.shadowMap.needsUpdate = true;
    },
    dispose() {
      for (const l of [key, fill, rim]) { scene.remove(l, l.target); l.dispose(); }
      scene.remove(hemi); hemi.dispose();
      if (floor) { scene.remove(floor); floor.geometry.dispose(); floor.material.dispose(); }
      if (env && scene.environment === env) scene.environment = null; // env dùng chung (cache), không dispose
      if (import.meta.env.DEV) window.__vm?.lights?.delete(api);
    },
  };
  if (import.meta.env.DEV) ((window.__vm ??= {}).lights ??= new Set()).add(api); // hook chỉnh tham số khi test
  return api;
}

/**
 * Nối bộ đèn với kho cài đặt dùng chung: áp ngay và mỗi khi người dùng chỉnh.
 * @param {{applyUserSettings:(s:object)=>void}} lights kết quả createStudioLights
 * @returns {() => void} huỷ đăng ký
 */
export function bindLightsToSettings(lights) {
  return onSettings((s) => lights.applyUserSettings(s));
}

/**
 * Tinh chỉnh vật liệu quét 3D (photogrammetry) cho ánh sáng studio:
 * texture đã "nướng" sẵn bóng nhẹ nên giữ roughness cao, không metal, envMap vừa phải.
 */
export function tuneScanMaterial(root, { envMapIntensity = 0.8, roughness = 0.92 } = {}) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if ('roughness' in m) m.roughness = roughness;
    if ('metalness' in m) m.metalness = 0;
    if ('envMapIntensity' in m) m.envMapIntensity = envMapIntensity;
    m.forceSinglePass = true; // xem loader.js: tránh vẽ 2 pass cho DoubleSide + transparent
    m.needsUpdate = true;
  });
}

export { PRESETS as LIGHT_PRESETS };
