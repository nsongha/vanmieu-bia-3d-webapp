// Chuyển cảnh giữa hai bia — dùng chung cho cả 3 view. Độ mờ được GHÉP ẢNH (xem renderComposite),
// view gọi `tx.render(renderer, scene, camera)` thay cho renderer.render khi có chuyển cảnh.
//
// View giữ hai "khay" (THREE.Group) cố định dưới holder đung đưa/quay của mình, mỗi khay
// bọc MỘT bản mô hình. Chuyển cảnh chỉ đụng tới position/rotation/scale của hai khay và
// opacity vật liệu của con cháu chúng — không đụng camera, không đụng scene.
//
// Mọi hiệu ứng chạy theo dt do view bơm vào (giây), KHÔNG dùng performance.now(),
// nên chạy đúng cả dưới bộ chụp ảnh headless của core/renderer.js (capture()).
import * as THREE from 'three';

// ---- Mờ dần bằng GHÉP ẢNH (composite) --------------------------------------------------------
// Pha trộn alpha từng tam giác làm lộ lớp bề mặt trùng nhau/mặt trong của scan (nhìn xuyên).
// Thay vào đó, mỗi khay đang mờ được vẽ ĐỤC vào một render target riêng (đúng độ sâu), rồi dán
// lên khung hình với alpha = opacity của khay. Dùng qua tx.render(renderer, scene, camera).
const _rtByRenderer = new WeakMap();
const _v2 = new THREE.Vector2();
const _v4a = new THREE.Vector4();
const _v4b = new THREE.Vector4();
const _clr = new THREE.Color();
const LAYER_OUT = 1;
const LAYER_IN = 2;
/** Các khay đang được ghép ảnh trong khung hiện tại (reflective-floor.js bật lại ghi màu cho chúng trong pass gương). */
export const activeFading = new Set();
export function setGroupColorWrite(group, on) { setColorWrite(group, on); }
/** DEV (r22): composite = false → vẽ thẳng cả khay đang mờ (bỏ ghép ảnh) để so sánh hai đường vẽ ở cùng một khung. */
export const txDebug = { composite: true, opacity: null };

const COMPOSITE_VERT = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
// r22: render target ghép ảnh ở KHÔNG GIAN HIỂN THỊ (đã tone-map + mã hoá sRGB, như bộ đệm màn hình) — xem
// ensureCompositeTarget. Ghép ảnh chỉ còn nhân độ đục (premultiplied), không tone-map / đổi không gian màu lần nữa.
const COMPOSITE_FRAG = `
uniform sampler2D tex; uniform float uOpacity; uniform vec2 uRes;
void main(){
  gl_FragColor = texture2D(tex, gl_FragCoord.xy / uRes) * uOpacity; // premultiplied: nhân cả màu lẫn alpha
}`;

/** Tài nguyên ghép ảnh cho một renderer (tạo lười, tái dùng). */
export function ensureCompositeTarget(renderer) {
  let R = _rtByRenderer.get(renderer);
  if (!R) {
    const rt = new THREE.WebGLRenderTarget(4, 4, {
      samples: 4,                                  // MSAA cho mép mô hình
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: true,
      stencilBuffer: false,
      // r15: độ sâu chỉ dùng TRONG lượt vẽ vào RT (khay che chính nó); ghép ảnh chỉ đọc màu → không cần
      // giải MSAA độ sâu sau mỗi lượt (bỏ một lần blit độ sâu cỡ màn hình mỗi khay mỗi khung, ảnh y hệt).
      resolveDepthBuffer: false,
    });
    // r22: khay vẽ vào RT y hệt vẽ ra màn hình — three chỉ bật tone mapping + mã hoá màu đầu ra (theo texture.colorSpace)
    // cho RT "của XR" (isXRRenderTarget; WebXRManager dùng đúng cờ này cho bộ đệm cuối). Trước đây RT tuyến tính rồi
    // tone-map khi ghép: các lớp CỘNG / NHÂN trên mặt đá (gương lòng bục cộng, bóng tiếp xúc nhân…) trộn trong không
    // gian tuyến tính thay vì không gian hiển thị như khi vẽ thẳng → khay "nhảy" sáng / tối đúng khung nó hết mờ (độ đục
    // chạm 1 → vẽ thẳng) hay bắt đầu mờ. Nay hai đường vẽ cho cùng một ảnh (và RT 8 bit sRGB ít vệt bậc ở vùng tối hơn).
    // RGBA8 thường (không SRGB8_ALPHA8): lưu nguyên giá trị đã mã hoá, GPU không giải mã khi đọc / không mã hoá khi resolve.
    rt.texture.internalFormat = 'RGBA8';
    rt.isXRRenderTarget = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: rt.texture }, uOpacity: { value: 1 }, uRes: { value: new THREE.Vector2(4, 4) } },
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const qscene = new THREE.Scene();
    qscene.add(quad);
    const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    R = { rt, mat, qscene, qcam };
    _rtByRenderer.set(renderer, R);
  }
  renderer.getDrawingBufferSize(_v2);
  if (R.rt.width !== _v2.x || R.rt.height !== _v2.y) { R.rt.setSize(_v2.x, _v2.y); R.mat.uniforms.uRes.value.set(_v2.x, _v2.y); }
  return R;
}

function setLayer(group, layer) {
  group?.traverse((o) => { o.layers.set(layer); });
}
function setColorWrite(group, on) {
  group?.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.colorWrite = on;
  });
}
const _litScenes = new WeakSet();
function ensureLightLayers(scene) {
  if (_litScenes.has(scene)) return;
  _litScenes.add(scene);
  scene.traverse((o) => { if (o.isLight) { o.layers.enable(LAYER_OUT); o.layers.enable(LAYER_IN); } });
}

/**
 * r41 — vẽ THỬ một vật thể (bản sao bia đã nung, chưa vào cảnh) đúng như lượt ghép ảnh sẽ vẽ nó khi bia hiện dần trong lượt
 * lướt (cùng chương trình, cùng RT ghép ảnh, cùng đèn), vào một ô 8 × 8 giữa RT: lần vẽ ĐẦU của từng bia tốn thêm 11–25 ms
 * GPU (đo r41 bằng timer query từng khung: mỗi lượt lướt tới bia chưa từng hiện, lướt về bia đã hiện thì không) — nay rơi
 * vào lúc nung (yên). (Chạm riêng texture / bộ đệm đỉnh bằng vật liệu khác thì KHÔNG hết — phải vẽ bằng đúng vật liệu.)
 * Trả false nếu không làm được (không có scene / camera).
 */
export function warmComposite(renderer, scene, camera, object) {
  if (!renderer || !scene || !camera || !object) return false;
  const R = ensureCompositeTarget(renderer);
  ensureLightLayers(scene);
  const parent = object.parent;
  if (!parent) scene.add(object);
  const prevRT = renderer.getRenderTarget();
  const prevMask = camera.layers.mask;
  const prevBg = scene.background;
  const prevAutoClear = renderer.autoClear;
  const prevShadow = renderer.shadowMap.needsUpdate;
  const vp = R.rt.viewport.clone();
  const sc = R.rt.scissor.clone();
  const st = R.rt.scissorTest;
  try {
    setLayer(object, LAYER_IN);
    camera.layers.set(LAYER_IN);
    scene.background = null;
    renderer.shadowMap.needsUpdate = false;
    renderer.autoClear = true;
    renderer.setRenderTarget(R.rt);
    // cả khung (vật thể nằm đúng chỗ trong ảnh) nhưng chỉ tô một ô 8 × 8 ở giữa — đủ để lấy mẫu texture, gần như không tốn tô
    const w = R.rt.width;
    const h = R.rt.height;
    R.rt.viewport.set(0, 0, w, h);
    R.rt.scissor.set(Math.max(0, (w >> 1) - 4), Math.max(0, (h >> 1) - 4), 8, 8);
    R.rt.scissorTest = true;
    renderer.setRenderTarget(R.rt);
    renderer.render(scene, camera);
  } finally {
    setLayer(object, 0);
    if (!parent) scene.remove(object);
    R.rt.viewport.copy(vp);
    R.rt.scissor.copy(sc);
    R.rt.scissorTest = st;
    camera.layers.mask = prevMask;
    scene.background = prevBg;
    renderer.autoClear = prevAutoClear;
    renderer.shadowMap.needsUpdate = prevShadow;
    renderer.setRenderTarget(prevRT);
  }
  return true;
}

/**
 * Vẽ một khung hình có ghép ảnh cho các khay đang mờ.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {Array<{group:THREE.Object3D, opacity:number, layer:number}>} fading
 */
function renderComposite(renderer, scene, camera, fading) {
  const R = ensureCompositeTarget(renderer);
  ensureLightLayers(scene);
  const vp = renderer.getViewport(_v4a).clone();
  const sc = renderer.getScissor(_v4b).clone();
  const scTest = renderer.getScissorTest();
  const prevAutoClear = renderer.autoClear;
  const prevBg = scene.background;
  const prevMask = camera.layers.mask;
  const prevClearAlpha = renderer.getClearAlpha();
  const prevClear = renderer.getClearColor(_clr).clone();

  // 1) Lượt chính: khay đang mờ vẫn ở lớp 0 nhưng KHÔNG ghi màu → vẫn đổ bóng và ghi độ sâu, không hiện màu.
  //    (reflective-floor.js bật lại ghi màu riêng trong pass gương để phản chiếu không bị mất.)
  activeFading.clear();
  for (const f of fading) { setColorWrite(f.group, false); activeFading.add(f.group); }
  renderer.render(scene, camera);
  activeFading.clear();
  for (const f of fading) setColorWrite(f.group, true);

  // 2) Từng khay: vẽ đục vào RT (chỉ khay đó + đèn), rồi dán lên khung với alpha = opacity.
  scene.background = null;
  for (const f of fading) {
    setLayer(f.group, f.layer);
    camera.layers.set(f.layer);
    renderer.setRenderTarget(R.rt);
    // Viewport/scissor của màn hình tính theo pixel CSS; của render target tính theo pixel thiết bị.
    const pr = renderer.getPixelRatio();
    R.rt.viewport.copy(vp).multiplyScalar(pr); R.rt.scissor.copy(sc).multiplyScalar(pr); R.rt.scissorTest = scTest;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    setLayer(f.group, 0);

    renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(scTest);
    renderer.autoClear = false;
    R.mat.uniforms.tex.value = R.rt.texture;
    R.mat.uniforms.uOpacity.value = f.opacity;
    camera.layers.mask = prevMask;
    renderer.render(R.qscene, R.qcam);
  }
  camera.layers.mask = prevMask;
  scene.background = prevBg;
  renderer.setClearColor(prevClear, prevClearAlpha);
  renderer.autoClear = prevAutoClear;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Tiến độ của một đoạn con [a, b] trong tiến độ tổng t. */
const sub = (t, a, b) => clamp01((t - a) / (b - a));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Đặt opacity cho mọi vật liệu trong nhóm. Danh sách vật liệu được thu MỘT LẦN rồi
 * nhớ ở `group.userData.__mats` (thu lại khi con đầu tiên của nhóm đổi, tức là view
 * đã thay mô hình trong khay). Muốn ép thu lại: `delete group.userData.__mats`.
 * @param {THREE.Object3D|null} group
 * @param {number} value 0..1
 */
export function applyOpacity(group, value) {
  if (!group) return;
  // Không đụng vật liệu: độ mờ được ghép ảnh trong tx.render (xem đầu file). Chỉ ghi nhớ + ẩn khi = 0.
  group.userData.__opacity = value;
  group.visible = value > 0.002;
}

/** Trả khay về tư thế gốc + opacity cho trước. */
function neutral(group, opacity) {
  if (!group) return;
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);
  applyOpacity(group, opacity);
}

/**
 * Hiệu ứng chuyển cảnh — chỉ còn "Lướt" (B: Mờ dần / Trượt ngang / Xoay nửa vòng / Nhô lên / Thu phóng đã bỏ).
 * `inStart` = mốc (0..1) mà bia MỚI bắt đầu xuất hiện — khi không có bia cũ (lần đầu)
 * tiến độ được dời để không phải ngồi nhìn khung trống.
 * `step(t, o, i, dir)`: t = tiến độ tuyến tính 0..1, o = khay cũ (có thể null), i = khay mới.
 */
const EFFECTS = {
  // "Camera lướt" sang bia kế: bia cũ đi ra khỏi khung, bia mới vào từ ngoài mép đối diện.
  // Biên độ = khoảng cách để rời hẳn khung ở góc nhìn vuông góc (tính từ camera thật, xem frameExitOffset);
  // camera chéo thì có thể chưa ra hết khung → có fade ở hai đầu.
  glide: {
    inStart: 0,
    duration: 1.6,
    step(t, o, i, dir, ctx) {
      const amp = ctx?.amp ?? 1.6;
      const k = easeInOutCubic(t);
      if (o) {
        o.position.x = -amp * dir * k;                       // bia cũ trôi ra (sang trái khi đi tới)
        applyOpacity(o, 1 - sub(t, 0.5, 0.92));
      }
      i.position.x = amp * dir * (1 - k);                    // bia mới vào từ mép đối diện
      applyOpacity(i, sub(t, 0.08, 0.5));
    },
  },
};

/** Danh sách id hiệu ứng có thật (để view kiểm tra giá trị lưu trong cài đặt). */
export const TRANSITION_EFFECTS = Object.freeze(Object.keys(EFFECTS));

/**
 * Tạo một lần chuyển cảnh. Trạng thái khung 0 được áp NGAY khi tạo (bia mới không
 * kịp loé lên đục trước khi hiệu ứng bắt đầu).
 *
 * @param {string} name id hiệu ứng — chỉ còn 'glide'; tham số giữ cho tương thích, giá trị nào cũng chạy Lướt
 * @param {{outHolder?:THREE.Group|null, inHolder:THREE.Group, dir?:number,
 *          duration?:number, onDone?:()=>void}} opts
 *   outHolder: khay bia cũ, null nếu đây là bia đầu tiên.
 *   dir: +1 = sang bia sau, −1 = bia trước (đảo chiều các hiệu ứng có hướng).
 *   duration: GIÂY (mặc định: thời lượng của hiệu ứng; số > 20 được hiểu là mili-giây).
 *   onDone: gọi đúng MỘT lần, khi xong hoặc khi cancel() — chỗ để view huỷ bia cũ.
 *   camera (tuỳ chọn): PerspectiveCamera của view — hiệu ứng "glide" dùng để tính biên độ rời khung.
 * @returns {{update(dt:number):boolean, seek(p:number):boolean, cancel():void, done:boolean, name:string}}
 */
/**
 * Khoảng dịch theo trục X để một bia (nửa rộng ~0.6) ra khỏi khung hoàn toàn khi camera nhìn vuông góc,
 * ở khoảng cách hiện tại của camera tới bia. Không có camera → 1.6.
 */
export function frameExitOffset(camera, center = _center, halfWidth = 0.6) {
  if (!camera || !camera.isPerspectiveCamera) return 1.6;
  const dist = camera.position.distanceTo(center);
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect * dist;
  return halfW + halfWidth + 0.15;
}
const _center = new THREE.Vector3(0, 0.5, 0);

export function createTransition(name, opts = {}) {
  const effect = EFFECTS.glide;
  const out = opts.outHolder ?? null;
  const inn = opts.inHolder;
  const dir = (opts.dir ?? 1) < 0 ? -1 : 1;
  // Ngữ cảnh cho hiệu ứng cần biết khung hình (glide): biên độ tính từ camera lúc bắt đầu.
  const ctx = { amp: frameExitOffset(opts.camera) };
  let duration = Number(opts.duration);
  if (!Number.isFinite(duration) || duration <= 0) duration = effect.duration;
  else if (duration > 20) duration /= 1000; // ai đó đưa mili-giây


  const onDone = opts.onDone;

  // Không có bia cũ → bỏ qua phần mở đầu dành cho nó, chạy thẳng phần của bia mới.
  const t0 = out ? 0 : effect.inStart;

  let elapsed = 0;
  let done = false;

  // Bóng đổ không theo opacity: chuyển bóng từ bia cũ sang bia mới ở giữa chừng, tránh 2 bóng chồng.
  let shadowHanded = false;
  function setCast(group, on) {
    group?.traverse((o) => { if (o.isMesh) o.castShadow = on; });
  }
  if (out && inn) setCast(inn, false);

  function step(raw) {
    const t = t0 + (1 - t0) * clamp01(raw);
    if (out) { out.position.set(0, 0, 0); out.rotation.set(0, 0, 0); out.scale.setScalar(1); }
    inn.position.set(0, 0, 0); inn.rotation.set(0, 0, 0); inn.scale.setScalar(1);
    effect.step(t, out, inn, dir, ctx);
    // bàn giao đổ bóng ở nửa chặng — hai chiều (r53: kéo bia bằng tay có thể lùi qua mốc này)
    const hand = t >= 0.5;
    if (out && hand !== shadowHanded) { shadowHanded = hand; setCast(out, !hand); setCast(inn, hand); }
  }

  function finish() {
    if (done) return;
    done = true;
    if (!shadowHanded) { shadowHanded = true; setCast(out, false); setCast(inn, true); }
    neutral(inn, 1);
    neutral(out, 0);   // khay cũ về tư thế gốc (ẩn): view có thể tái dùng ngay
    api.done = true;
    onDone?.();
  }

  const api = {
    name: 'glide',
    done: false,
    /** Thời lượng (giây) của lần chuyển này — view dùng để canh mốc hiện chữ, v.v. */
    duration,
    /** r56: biên độ Lướt (đơn vị thế giới — khay dời ±amp theo trục khay) — kéo bia bám 1:1 theo màn hình. */
    get amp() { return ctx.amp; },
    /** Tiến độ 0..1. */
    get progress() { return clamp01(elapsed / duration); },
    /**
     * Tiến một khung. Trả true khi CÒN chạy, false khi đã xong (gọi thêm cũng vô hại).
     * @param {number} dt giây
     */
    update(dt) {
      if (done) return false;
      elapsed += Math.max(0, Number(dt) || 0);
      const raw = elapsed / duration;
      if (raw >= 1) { finish(); return false; }
      step(raw);
      return true;
    },
    /**
     * r53: đặt thẳng tiến độ p (0..1, cả tiến lẫn lùi — kéo bia bằng tay). p ≥ 1 → xong (onDone). Trả true khi CÒN chạy.
     * @param {number} p
     */
    seek(p) {
      if (done) return false;
      const raw = Math.max(0, Number(p) || 0);
      elapsed = Math.min(1, raw) * duration;
      if (raw >= 1) { finish(); return false; }
      step(raw);
      return true;
    },
    /** Nhảy thẳng tới trạng thái cuối (bia mới nguyên vẹn, bia cũ trong suốt) + gọi onDone. */
    cancel() { finish(); },
    /**
     * Vẽ khung hình thay cho renderer.render(scene, camera) trong lúc chuyển cảnh:
     * khay đang mờ được ghép ảnh (không pha trộn tam giác → không nhìn xuyên).
     */
    render(renderer, scene, camera) {
      const fading = [];
      const op = (g) => (txDebug.opacity != null && g?.visible && (g.userData.__opacity ?? 1) < 1 ? txDebug.opacity : g?.userData.__opacity ?? 1);
      const fades = (g) => g && g.visible && (g.userData.__opacity ?? 1) < 1;
      if (fades(out)) fading.push({ group: out, opacity: op(out), layer: LAYER_OUT });
      if (fades(inn)) fading.push({ group: inn, opacity: op(inn), layer: LAYER_IN });
      if (!fading.length || !txDebug.composite) { renderer.render(scene, camera); return; }
      renderComposite(renderer, scene, camera, fading);
    },
  };

  if (inn) step(0);
  return api;
}
