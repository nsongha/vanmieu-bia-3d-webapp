// Sàn phản chiếu mềm — "ảnh chụp sản phẩm trên mặt satin".
//
// Dựng trên Reflector của three (examples/jsm/objects/Reflector.js): mỗi khung hình nó
// vẽ cảnh một lần nữa từ CAMERA ẢO lật qua mặt phẳng gương vào một render target
// (uniform `tDiffuse` + `textureMatrix` để chiếu ngược lên mặt sàn).
// Ta giữ nguyên lượt vẽ đó nhưng THAY vật liệu: thay vì gương nét, dùng ShaderMaterial
// riêng làm 3 việc:
//   1. nhoè ảnh phản chiếu bằng 12 mẫu Poisson (bán kính nở dần ra mép → xa điểm tiếp
//      xúc thì mờ hơn, đúng cảm giác mặt nhám mịn);
//   2. pha ảnh đã nhoè lên màu nền sàn theo `strength`;
//   3. nhân alpha với một vệt mờ toả tròn từ tâm → KHÔNG BAO GIỜ thấy mép đĩa.
//
// Chi phí: lượt gương vẽ lại toàn cảnh (≈ số tam giác của mô hình) vào RT vuông
// `resolution`. Xem `interval` và `setResolution` để hạ tải trên máy yếu.
//
// Cũng dùng cho mặt phản chiếu KHÔNG phải sàn (Điện ảnh: lòng bục dưới chân rùa): `parent` + `y`
// gắn đĩa vào một nhóm (đi theo mọi phép biến đổi của nhóm), `blend: 'add'` cộng ảnh phản chiếu
// lên bề mặt bên dưới như một lớp bóng (giữ nguyên bóng đổ của bề mặt đó), `exclude` ẩn thêm vật
// thể chỉ trong lượt gương này.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { isLowPowerDevice } from './settings.js';
import { activeFading, setGroupColorWrite } from './transitions.js';

// 12 mẫu Poisson trên đĩa đơn vị (phân bố đều, không tạo vân) — kernel nhoè.
const POISSON = `
  const vec2 POISSON[12] = vec2[12](
    vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696,  0.457),
    vec2(-0.203,  0.621), vec2( 0.962, -0.195), vec2( 0.473, -0.480),
    vec2( 0.519,  0.767), vec2( 0.185, -0.893), vec2( 0.507,  0.064),
    vec2( 0.896,  0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598)
  );
`;

/**
 * Shader thay cho Reflector.ReflectorShader — GIỮ NGUYÊN 3 uniform mà Reflector cần
 * (color, tDiffuse, textureMatrix) và thêm các uniform điều khiển độ nhoè / độ mạnh.
 */
const SoftReflectorShader = {
  name: 'SoftReflectorShader',
  uniforms: {
    color: { value: null },          // Reflector gán
    tDiffuse: { value: null },       // Reflector gán
    textureMatrix: { value: null },  // Reflector gán
    uStrength: { value: 0.35 },
    uBlur: { value: 1 },
    uFade: { value: 0.72 },
    uRadius: { value: 3 },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    // r63 (REFLECT_RIPPLE — lòng bục Điện ảnh): gợn nhẹ — bản đồ pháp tuyến lát kín, độ lệch (px thiết bị), toạ độ vân
    tRipple: { value: null },
    uRipplePx: { value: 0 },
    uRippleScale: { value: 1 },
    uRippleOff: { value: new THREE.Vector2() },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    uniform float uRadius;
    varying vec4 vUv;
    varying vec2 vLocal;   // toạ độ trên đĩa, chuẩn hoá: |vLocal| = 0 ở tâm, 1 ở mép

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vLocal = position.xy / max( uRadius, 1e-4 );  // CircleGeometry nằm trong mặt phẳng XY
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uBlur;
    uniform float uFade;
    uniform vec2 uTexel;
    varying vec4 vUv;
    varying vec2 vLocal;
    #ifdef REFLECT_RIPPLE
      uniform sampler2D tRipple;
      uniform float uRipplePx;
      uniform float uRippleScale;
      uniform vec2 uRippleOff;
    #endif

    #include <logdepthbuf_pars_fragment>
    ${POISSON}

    // Bán kính kernel (tính theo texel của RT) khi uBlur = 1.
    const float BLUR_TEXELS = 9.0;

    // vUv là toạ độ CHIẾU (chia cho w ở trong texture2DProj) → muốn dịch đúng 1 texel
    // trên màn hình thì phải nhân độ dịch với vUv.w.
    vec4 tap( vec2 offset ) {
      return texture2DProj( tDiffuse, vec4( vUv.xy + offset * vUv.w, vUv.zw ) );
    }

    void main() {
      #include <logdepthbuf_fragment>

      float r = length( vLocal );

      #ifdef REFLECT_SHARP
        // Gương phẳng NÉT: một lần đọc, không nhoè.
        #ifdef REFLECT_RIPPLE
          // r63: mặt gợn nhẹ — lệch toạ độ đọc theo pháp tuyến của vân (≤ uRipplePx điểm ảnh thiết bị); vân theo mét trong hệ
          // của bục: (x, −y) của đĩa = (x, z) của bục (đĩa nằm ngang: xoay −90° quanh x). uRipplePx 0 → đọc đúng như cũ.
          vec4 pv = vUv;
          if ( uRipplePx > 0.0 ) {
            vec2 rn = texture2D( tRipple, vec2( vLocal.x, - vLocal.y ) * uRippleScale + uRippleOff ).xy * 2.0 - 1.0;
            pv.xy += rn * uRipplePx * uTexel * vUv.w;
          }
          vec4 sum = texture2DProj( tDiffuse, pv );
        #else
          vec4 sum = texture2DProj( tDiffuse, vUv );
        #endif
      #else
        // Xa tâm ⇒ xa điểm tiếp xúc ⇒ nhoè hơn (mặt nhám tán xạ theo khoảng cách).
        float spread = uBlur * BLUR_TEXELS * ( 0.35 + 1.05 * r );

        vec4 sum = vec4( 0.0 );
        for ( int i = 0; i < 12; i ++ ) {
          sum += tap( POISSON[ i ] * uTexel * spread );
        }
        sum /= 12.0;
      #endif

      // Nền của lượt gương trong suốt (view dùng canvas alpha) → alpha chính là ĐỘ PHỦ
      // của những gì thực sự có mặt để phản chiếu. Chia ngược ra màu thật.
      float cov = clamp( sum.a, 0.0, 1.0 );
      vec3 refl = sum.rgb / max( sum.a, 1e-4 );

      // Vệt mờ toả tròn: alpha về 0 đúng ở uFade × bán kính đĩa (uFade ≤ 0: không mờ mép).
      float fade = uFade > 0.0 ? 1.0 - smoothstep( 0.0, uFade, r ) : 1.0;

      #ifdef REFLECT_ADD
        // Lớp bóng: CỘNG ảnh phản chiếu (đã nhân độ phủ) lên bề mặt bên dưới — không thay màu nó.
        vec3 rgb = sum.rgb * clamp( uStrength, 0.0, 1.0 ) * fade;
        if ( max( rgb.r, max( rgb.g, rgb.b ) ) <= 0.0 ) discard;
        gl_FragColor = vec4( rgb, 1.0 );
      #else
        vec3 rgb = mix( color, refl, clamp( uStrength, 0.0, 1.0 ) );
        float alpha = fade * cov * clamp( uStrength * 2.0, 0.0, 1.0 );

        gl_FragColor = vec4( rgb, alpha );
        if ( gl_FragColor.a <= 0.0 ) discard;
      #endif

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/**
 * Đĩa sàn phản chiếu mờ ở y = 0, tự thêm vào `scene`.
 *
 * @param {THREE.WebGLRenderer} renderer dùng để giới hạn kích thước RT theo khả năng GPU
 * @param {THREE.Scene} scene cảnh chứa sàn (cũng là cảnh được vẽ lại trong lượt gương)
 * @param {THREE.Camera} camera camera mặc định của view (chỉ dùng để bỏ lượt vẽ khi
 *   máy quay tụt xuống dưới mặt sàn; camera thật lấy từ chính lượt render)
 * @param {{radius?:number, color?:THREE.ColorRepresentation, strength?:number, blur?:number,
 *          fade?:number, resolution?:number, clipBias?:number, interval?:number}} [opts]
 *   strength 0 = tắt hẳn (ẩn mesh, không tốn lượt vẽ nào).
 *   fade: alpha về 0 ở fade × radius.
 *   interval (THÊM, mặc định 1): chỉ cập nhật ảnh phản chiếu mỗi N khung — ảnh đã nhoè
 *   nên 2–3 khung một lần gần như không nhận ra, nhưng tiết kiệm đúng N lần lượt vẽ.
 *   parent (mặc định scene) + y (mặc định 0): gắn đĩa vào nhóm này, ở cao độ y trong hệ của nhóm.
 *   blend: 'over' (mặc định — sàn: pha lên màu `color`, alpha theo độ phủ) | 'add' (cộng lên bề mặt dưới).
 *   exclude: () => Iterable<Object3D> — ẩn thêm các vật này chỉ trong lượt gương.
 *   swap: () => Iterable<[Object3D, Object3D]> (r21) — trong lượt gương: ẩn vật thứ nhất, HIỆN vật thứ hai (bản LOD1 nhẹ
 *     thay bản LOD0 — ảnh phản chiếu mờ / tối không phân biệt được, rẻ hơn ~4 lần số tam giác).
 *   renderOrder (mặc định -2), name.
 *   gate: () => boolean — trả false để HOÃN lượt gương của khung này (vẫn giữ cờ cần vẽ lại, không
 *   tính vào nhịp `interval`); vd. view dời lượt gương sang khung không vẽ shadow map.
 *   sharp: true — gương nét (một lần đọc, bỏ nhoè Poisson). fade ≤ 0: không mờ mép.
 *   samples (mặc định 0): MSAA cho render target của lượt gương (gương nét thì cần để khỏi răng cưa);
 *   chỉ bật khi GPU ghi được vào bộ đệm half-float (EXT_color_buffer_float/half_float).
 *   fitToScreen: { max?: number, margin?: number } — render target CHỈ phủ khung chữ nhật mà đĩa chiếm
 *   trên màn hình (camera ảo dùng phép chiếu lệch trục thu vào khung đó) và có kích thước = khung đó
 *   × DPR (tối đa `max`, mặc định 1024) → ảnh nét từng điểm ảnh mà không phải vẽ cả khung hình.
 *   `scale` (mặc định 1) nhân thêm vào cỡ RT đó: 0,5 = nửa độ phân giải mỗi chiều (1/4 số điểm ảnh) — ảnh
 *   phản chiếu cộng mờ lên đá thì mắt không phân biệt được, lượt gương rẻ đi về fill-rate.
 * @returns {{mesh: THREE.Mesh, setStrength(v:number):void, setColor(c:THREE.ColorRepresentation):void,
 *            setBlur(v:number):void, setResolution(n:number):void, dispose():void}}
 */
export function createReflectiveFloor(renderer, scene, camera, opts = {}) {
  const radius = opts.radius ?? 3;
  const fade = opts.fade ?? 0.72;
  const clipBias = opts.clipBias ?? 0.003;
  const low = isLowPowerDevice();
  // Mặc định cập nhật cách khung (2) — ảnh đã nhoè nên không nhận ra, tiết kiệm nửa lượt vẽ.
  const interval = Math.max(1, Math.round(opts.interval ?? (low ? 3 : 2)));
  // Chỉ vẽ lại khi camera hoặc vật thể theo dõi (opts.track) đổi vị trí, hoặc khi invalidate().
  let track = opts.track ?? null;
  let dirty = true;
  const lastCam = new THREE.Matrix4();
  const lastTrack = new THREE.Matrix4();
  let strength = opts.strength ?? 0.35;
  let blur = opts.blur ?? 1.0;

  const maxTex = renderer?.capabilities?.maxTextureSize ?? 2048;
  const clampRes = (n) => THREE.MathUtils.clamp(Math.round(n), 64, Math.min(2048, maxTex));
  let resolution = clampRes(opts.resolution ?? (low ? 192 : 384));
  let rtW = resolution;
  let rtH = resolution;

  const geometry = new THREE.CircleGeometry(radius, 96);
  const parent = opts.parent ?? scene;
  const exclude = opts.exclude ?? null;
  const swap = opts.swap ?? null;
  const shown = [];
  const gate = opts.gate ?? null;
  const fit = opts.fitToScreen ?? null;
  let fitScale = THREE.MathUtils.clamp(Number(fit?.scale) || 1, 0.25, 1);
  // Cỡ RT thật = cỡ khớp khung (rtW × rtH, theo điểm ảnh màn hình) × fitScale.
  const scaled = (n) => (fit ? Math.max(16, Math.round(n * fitScale)) : n);
  const additive = opts.blend === 'add';

  // Gương nhoè: multisample 0 (ảnh sẽ được nhoè ngay sau đó, MSAA chỉ tốn băng thông). Gương nét: opts.samples.
  const ext = renderer?.extensions;
  const halfOk = !!(ext && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')));
  const msaa = halfOk ? Math.max(0, Math.round(opts.samples ?? 0)) : 0;
  const mesh = new Reflector(geometry, {
    clipBias,
    textureWidth: scaled(resolution),
    textureHeight: scaled(resolution),
    color: new THREE.Color(opts.color ?? 0x000000),
    shader: SoftReflectorShader,
    multisample: msaa,
  });
  mesh.name = opts.name ?? 'reflective-floor';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = opts.y ?? 0;
  mesh.renderOrder = opts.renderOrder ?? -2; // sàn: vẽ trước mọi thứ trong suốt khác (hồ sáng của Điện ảnh: -1)
  mesh.visible = strength > 0;
  mesh.userData.noReflect = true; // phòng khi có sàn thứ hai: không tự soi nhau

  const material = mesh.material;
  material.transparent = true;
  material.depthWrite = false;
  if (additive) {
    material.defines = { ...(material.defines || {}), REFLECT_ADD: '' };
    material.blending = THREE.AdditiveBlending;
  }
  if (opts.sharp) material.defines = { ...(material.defines || {}), REFLECT_SHARP: '' };
  // r63: gợn nhẹ (chỉ gương nét — lòng bục Điện ảnh): bật chương trình có nhánh gợn; độ nhăn 0 thì nhánh bị bỏ qua
  if (opts.ripple && opts.sharp) material.defines = { ...(material.defines || {}), REFLECT_RIPPLE: '' };
  const U = material.uniforms;
  U.uStrength.value = strength;
  U.uBlur.value = blur;
  U.uFade.value = fade;
  U.uRadius.value = radius;
  U.uTexel.value.set(1 / resolution, 1 / resolution);

  parent.add(mesh);

  /* ---------- loại trừ vật thể khỏi lượt gương ---------- */
  // Reflector tự ẩn chính nó. Ngoài ra ẩn mọi object gắn cờ userData.noReflect
  // (đĩa hứng bóng, decal hồ sáng… — chúng nằm sát mặt sàn nên soi lại chỉ ra vệt bẩn).
  const hidden = [];
  const _eye = new THREE.Vector3();
  const _plane = new THREE.Vector3();
  // fitToScreen: camera "thay" truyền cho Reflector — cùng vị trí/hướng camera thật, phép chiếu thu vào
  // khung của đĩa (Reflector chỉ đọc matrixWorld, projectionMatrix, far, viewport của camera).
  const fitCam = fit ? new THREE.PerspectiveCamera() : null;
  const _p = new THREE.Vector3();
  const _db = new THREE.Vector2();
  const _S = new THREE.Matrix4();
  const RIM_SAMPLES = 24;
  const lastFit = { x0: 0, x1: 0, y0: 0, y1: 0, ok: false }; // chẩn đoán (DEV): khung NDC lần khớp gần nhất
  let fitOn = true; // DEV: tắt khớp khung (so sánh)
  /** Khung NDC đĩa chiếm trên màn hình (null = không thấy). Đặt fitCam + cỡ RT tương ứng. */
  function fitFrustum(rnd, cam) {
    mesh.updateWorldMatrix(true, false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < RIM_SAMPLES; i++) {
      const a = (i / RIM_SAMPLES) * Math.PI * 2;
      _p.set(Math.cos(a) * radius, Math.sin(a) * radius, 0).applyMatrix4(mesh.matrixWorld).project(cam);
      if (_p.z > 1) continue; // sau camera
      x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x);
      y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y);
    }
    const m = fit.margin ?? 0.02;
    x0 = Math.max(-1, x0 - m); y0 = Math.max(-1, y0 - m);
    x1 = Math.min(1, x1 + m); y1 = Math.min(1, y1 + m);
    lastFit.x0 = x0; lastFit.x1 = x1; lastFit.y0 = y0; lastFit.y1 = y1; lastFit.ok = x1 > x0 && y1 > y0;
    if (!(x1 > x0 && y1 > y0)) return false;
    // NDC khung [x0,x1]×[y0,y1] → [−1,1]²: S · P
    // r24 — LẬT X: camera ảo của Reflector (three) dựng bằng lookAt (phép quay thuần) chứ không phải phép đối xứng thật,
    // nên ảnh của nó lật ngang so với gương thật: điểm trên mặt gương mà camera thật thấy ở x thì camera ảo thấy ở −x
    // (y giữ nguyên). Khung phải khớp cho camera ẢO là [−x1, −x0]. Trước r24 dùng [x0, x1]: đĩa ở giữa khung (đối xứng
    // quanh x = 0) thì trùng nhau nên không lộ; đĩa trượt lệch sang một bên lúc Lướt thì khung ảo lệch khỏi ảnh phản chiếu
    // → ảnh bị cắt, kéo vệt ngang (lấy mẫu kẹp mép RT) rồi mất hẳn — đúng mô tả của người dùng.
    // Tổng quát (ma trận chiếu có lệch trục P[8]): x' = −x − 2·P[8].
    let fx0 = x0, fx1 = x1;
    if (mirrorX) {
      const off = 2 * cam.projectionMatrix.elements[8];
      fx0 = -x1 - off;
      fx1 = -x0 - off;
    }
    const sx = 2 / (fx1 - fx0), sy = 2 / (y1 - y0);
    _S.set(sx, 0, 0, -sx * (fx0 + fx1) / 2, 0, sy, 0, -sy * (y0 + y1) / 2, 0, 0, 1, 0, 0, 0, 0, 1);
    fitCam.projectionMatrix.multiplyMatrices(_S, cam.projectionMatrix);
    fitCam.projectionMatrixInverse.copy(fitCam.projectionMatrix).invert();
    fitCam.matrixWorld.copy(cam.matrixWorld);
    fitCam.matrixWorldInverse.copy(cam.matrixWorldInverse);
    fitCam.far = cam.far;
    // Cỡ RT = khung × kích thước bộ đệm vẽ (đã gồm DPR), trần `max`. Tăng ngay; chỉ giảm khi nhỏ đi rõ
    // (> 25 %) để lắc / trôi camera không cấp phát lại liên tục.
    rnd.getDrawingBufferSize(_db);
    const cap = Math.min(fit.max ?? 1024, maxTex);
    const w = THREE.MathUtils.clamp(Math.ceil(((x1 - x0) / 2) * _db.x / 16) * 16, 64, cap);
    const h = THREE.MathUtils.clamp(Math.ceil(((y1 - y0) / 2) * _db.y / 16) * 16, 64, cap);
    const grow = w > rtW || h > rtH;
    const shrink = w < rtW * 0.75 || h < rtH * 0.75;
    if (grow || shrink) {
      rtW = w;
      rtH = h;
      // fit.scale < 1: RT nhỏ hơn khung đĩa trên màn hình (vd. 0,5 = 1/4 số điểm ảnh). uTexel vẫn theo cỡ
      // ĐẦY ĐỦ → bán kính nhoè (nếu có) giữ nguyên trên màn hình, chỉ thưa mẫu hơn.
      mesh.getRenderTarget().setSize(scaled(w), scaled(h));
      U.uTexel.value.set(1 / w, 1 / h);
    }
    return true;
  }
  // r24 — lượt gương tự viết (thay Reflector.onBeforeRender của three, giống hệt trừ MỘT chỗ): mặt phẳng cắt gần xiên
  // (Lengyel) cần góc Q của khối nhìn chọn theo DẤU CỦA MẶT PHẲNG TRONG KHÔNG GIAN CLIP (C' = M⁻ᵀ·C). three lấy dấu trong
  // không gian camera — chỉ đúng với khối nhìn gần đối xứng. Khối nhìn đã khớp khung đĩa (fitToScreen) lệch trục mạnh khi
  // đĩa trượt ra mép lúc Lướt → chọn nhầm góc → mặt phẳng xa nghiêng cắt mất bia trong ảnh phản chiếu (ảnh bị cắt thành
  // vệt ngang rồi mất hẳn ở bục ra; bục vào thì hiện vệt rồi mới hiện đủ — "stretch rồi biến mất"). Tính đúng Q thì khớp
  // khung vẫn giữ được (RT chỉ phủ đĩa, nhẹ fill-rate) mà ảnh phản chiếu luôn đủ.
  const vcam = mesh.camera;
  const texM = U.textureMatrix.value;
  const _rp = new THREE.Vector3();
  const _cp = new THREE.Vector3();
  const _rot = new THREE.Matrix4();
  const _n = new THREE.Vector3();
  const _view = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _tgt = new THREE.Vector3();
  const _mplane = new THREE.Plane();
  const _clip = new THREE.Vector4();
  const _cc = new THREE.Vector4();
  const _q = new THREE.Vector4();
  const _Pinv = new THREE.Matrix4();
  const _PinvT = new THREE.Matrix4();
  let obliqueFix = true; // DEV: false = công thức gốc của three (so sánh)
  let mirrorX = true; // DEV: false = khung không lật (lỗi trước r24, để tái hiện)
  function mirrorPass(rnd, scn, camera) {
    _rp.setFromMatrixPosition(mesh.matrixWorld);
    _cp.setFromMatrixPosition(camera.matrixWorld);
    _rot.extractRotation(mesh.matrixWorld);
    _n.set(0, 0, 1).applyMatrix4(_rot);
    _view.subVectors(_rp, _cp);
    if (_view.dot(_n) > 0) return false; // gương quay lưng lại camera
    _view.reflect(_n).negate().add(_rp);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_cp);
    _tgt.subVectors(_rp, _look).reflect(_n).negate().add(_rp);
    vcam.position.copy(_view);
    vcam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n);
    vcam.lookAt(_tgt);
    vcam.far = camera.far;
    vcam.updateMatrixWorld();
    vcam.projectionMatrix.copy(camera.projectionMatrix);
    texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    texM.multiply(vcam.projectionMatrix);
    texM.multiply(vcam.matrixWorldInverse);
    texM.multiply(mesh.matrixWorld);
    // mặt phẳng gương trong hệ camera ảo → hàng 3 của ma trận chiếu (mặt phẳng cắt gần = mặt gương)
    _mplane.setFromNormalAndCoplanarPoint(_n, _rp).applyMatrix4(vcam.matrixWorldInverse);
    _clip.set(_mplane.normal.x, _mplane.normal.y, _mplane.normal.z, _mplane.constant);
    const P = vcam.projectionMatrix;
    const e = P.elements;
    if (obliqueFix) {
      _Pinv.copy(P).invert();
      _PinvT.copy(_Pinv).transpose();
      _cc.copy(_clip).applyMatrix4(_PinvT); // mặt phẳng trong không gian clip
      _q.set(Math.sign(_cc.x), Math.sign(_cc.y), 1, 1).applyMatrix4(_Pinv); // góc xa của khối nhìn, phía đối diện mặt phẳng
    } else {
      _q.set((Math.sign(_clip.x) + e[8]) / e[0], (Math.sign(_clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    }
    _clip.multiplyScalar(2 / _clip.dot(_q));
    e[2] = _clip.x;
    e[6] = _clip.y;
    e[10] = _clip.z + 1 - clipBias;
    e[14] = _clip.w;
    mesh.visible = false;
    const prevRT = rnd.getRenderTarget();
    const xr = rnd.xr.enabled;
    const sau = rnd.shadowMap.autoUpdate;
    rnd.xr.enabled = false;
    rnd.shadowMap.autoUpdate = false; // lượt gương không vẽ lại shadow map (xem ghi chú bên dưới)
    try {
      rnd.setRenderTarget(mesh.getRenderTarget());
      rnd.state.buffers.depth.setMask(true);
      if (rnd.autoClear === false) rnd.clear();
      rnd.render(scn, vcam);
    } finally {
      rnd.xr.enabled = xr;
      rnd.shadowMap.autoUpdate = sau;
      rnd.setRenderTarget(prevRT);
      if (camera.viewport !== undefined) rnd.state.viewport(camera.viewport);
      mesh.visible = true;
    }
    return true;
  }
  let frame = 0;
  let disposed = false;
  let passes = 0; // số lượt gương đã vẽ (DEV: ghi vết từng khung)

  mesh.onBeforeRender = function (rnd, scn, cam, geo, mat, group) {
    if (disposed || strength <= 0 || !mesh.visible) return;
    // Máy quay ở dưới/ngang mặt sàn: không thấy phản chiếu → giữ nguyên ảnh cũ.
    const eye = cam ?? camera;
    if (eye && eye.isCamera && eye.getWorldPosition(_eye).y <= mesh.getWorldPosition(_plane).y + 1e-4) return;
    // Không có gì đổi (camera tĩnh, vật thể tĩnh) → giữ ảnh cũ, không tốn lượt vẽ.
    // So sánh có dung sai: OrbitControls damping làm camera nhích vi lượng (~1e-8) mãi không dừng.
    const moved = dirty
      || (eye && matrixChanged(eye.matrixWorld, lastCam))
      || (track && matrixChanged(track.matrixWorld, lastTrack));
    if (!moved) return;
    if (gate && !gate()) return;
    if (interval > 1 && (frame++ % interval) !== 0) return;

    scn.traverse(collect);
    if (exclude) {
      for (const o of exclude()) {
        if (o && o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      }
    }
    if (swap) {
      for (const [hi, lo] of swap()) {
        if (!hi?.visible || !lo || lo.visible) continue;
        hi.visible = false;
        hidden.push(hi);
        lo.visible = true;
        shown.push(lo);
      }
    }
    try {
      // LƯU Ý (đã kiểm tra trong three r180): Reflector đặt renderer.shadowMap.autoUpdate = false
      // quanh lượt gương, mà WebGLShadowMap.render() thoát ngay khi autoUpdate === false
      // → lượt gương KHÔNG vẽ lại shadow map, không cần đụng tới shadowMap.enabled.
      // Không tắt shadowMap.enabled: cờ này nằm trong khoá cache chương trình nhưng KHÔNG
      // nằm trong danh sách needsProgramChange của WebGLRenderer.setProgram, nên vật liệu
      // biên dịch trong lượt gương có thể kẹt ở biến thể "không bóng" và làm hỏng lượt chính.
      // Khay đang ghép ảnh (colorWrite tắt ở lượt chính) → bật lại chỉ trong pass gương để còn phản chiếu.
      for (const g of activeFading) setGroupColorWrite(g, true);
      try {
        let passCam = cam;
        if (fit && fitOn && eye && eye.isPerspectiveCamera) {
          if (!fitFrustum(rnd, eye)) return; // đĩa ngoài khung hình: giữ ảnh cũ
          passCam = fitCam;
        }
        if (mirrorPass(rnd, scn, passCam)) passes++;
      } finally {
        for (const g of activeFading) setGroupColorWrite(g, false);
      }
      dirty = false;
      if (eye) lastCam.copy(eye.matrixWorld);
      if (track) lastTrack.copy(track.matrixWorld);
    } finally {
      for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
      hidden.length = 0;
      for (let i = 0; i < shown.length; i++) shown[i].visible = false;
      shown.length = 0;
    }
  };

  function matrixChanged(a, b, eps = 1e-5) {
    const ae = a.elements, be = b.elements;
    for (let i = 0; i < 16; i++) if (Math.abs(ae[i] - be[i]) > eps) return true;
    return false;
  }

  function collect(o) {
    if (o.visible && o.userData && o.userData.noReflect === true && o !== mesh) {
      o.visible = false;
      hidden.push(o);
    }
  }

  return {
    mesh,
    /** Buộc vẽ lại ảnh phản chiếu ở khung tới (gọi khi đổi/di chuyển mô hình mà không dùng track). */
    invalidate() { dirty = true; },
    /** Object3D (vd. holder của mô hình) — đổi matrixWorld là phản chiếu tự vẽ lại. */
    setTrack(obj) { track = obj ?? null; dirty = true; },
    /** 0 = tắt hẳn (ẩn mesh, bỏ luôn lượt gương). */
    setStrength(v) {
      strength = THREE.MathUtils.clamp(Number(v) || 0, 0, 1);
      U.uStrength.value = strength;
      mesh.visible = strength > 0;
    },
    /**
     * r63 (opts.ripple): gợn nhẹ của mặt gương — { texture (bản đồ pháp tuyến lát kín), px (độ lệch lớn nhất, điểm ảnh thiết
     * bị; 0 = phẳng như cũ), scale (số ô vân trên một bán kính đĩa), offset (Vector2 — dùng chung, người gọi đổi tại chỗ) }.
     * Chỉ đổi uniform — không vẽ lại lượt gương (gợn áp lúc dán ảnh lên đĩa).
     */
    setRipple({ texture, px, scale, offset } = {}) {
      if (texture !== undefined) U.tRipple.value = texture;
      if (Number.isFinite(px)) U.uRipplePx.value = Math.max(0, px);
      if (Number.isFinite(scale)) U.uRippleScale.value = scale;
      if (offset) U.uRippleOff.value = offset;
    },
    /** Màu nền sàn (ảnh phản chiếu được pha lên trên màu này). */
    setColor(c) { U.color.value.set(c); },
    setBlur(v) { blur = Math.max(0, Number(v) || 0); U.uBlur.value = blur; },
    /** Đổi cạnh render target (vuông). Texture giữ nguyên, chỉ cấp phát lại bộ nhớ GPU. */
    setResolution(n) {
      dirty = true;
      const size = clampRes(n);
      if (size === resolution) return;
      resolution = size;
      rtW = rtH = size;
      mesh.getRenderTarget().setSize(scaled(size), scaled(size));
      U.uTexel.value.set(1 / size, 1 / size);
    },
    /** Đổi fitToScreen.scale lúc chạy (DEV so sánh) — cỡ RT đổi ngay, ảnh vẽ lại ở lượt gương kế tiếp. */
    setFitScale(k) {
      if (!fit) return;
      fitScale = THREE.MathUtils.clamp(Number(k) || 1, 0.25, 1);
      mesh.getRenderTarget().setSize(scaled(rtW), scaled(rtH));
      dirty = true;
    },
    /** DEV: false = mặt phẳng cắt xiên theo công thức gốc của three (tái hiện lỗi r24). */
    setObliqueFix(on) {
      obliqueFix = !!on;
      dirty = true;
    },
    /** DEV: false = khung khớp không lật X (tái hiện lỗi "ảnh phản chiếu kéo vệt rồi mất" trước r24). */
    setMirrorX(on) {
      mirrorX = !!on;
      dirty = true;
    },
    /** DEV: bật / tắt khớp khung màn hình (so sánh). */
    setFitEnabled(on) {
      fitOn = !!on;
      dirty = true;
    },
    /** Khung NDC của lần khớp gần nhất (chẩn đoán). */
    get fitRect() {
      return { ...lastFit };
    },
    /** Số lượt gương đã vẽ từ lúc tạo (chẩn đoán). */
    get passes() {
      return passes;
    },
    /** Cỡ render target hiện tại [rộng, cao] (px) — cỡ thật, đã nhân fitToScreen.scale. */
    get renderTargetSize() {
      const rt = mesh.getRenderTarget();
      return [rt.width, rt.height];
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.parent?.remove(mesh);
      mesh.dispose();       // render target + material
      geometry.dispose();
    },
  };
}
