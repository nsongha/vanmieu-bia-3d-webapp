// BÓNG TIẾP XÚC của rùa trên mặt bục (hoặc trên sàn khi tắt bục) — kiểu "ambient occlusion" nướng sẵn.
//
// Nướng MỘT lần cho mỗi bia (lúc preheat, tức là lúc rảnh sau khi tải; chưa kịp thì lúc present):
//   1. camera trực giao đặt DƯỚI mô hình, nhìn thẳng lên → mỗi texel thấy điểm THẤP NHẤT của mô hình
//      tại (x, z) đó; shader ghi độ che = 1 − smoothstep(0, BAND, cao độ trên mặt đứng) — chân / yếm /
//      bụng rùa sát mặt đỡ ≈ 1, cao hơn BAND = 0 (vỏ quét thường hở đáy: từ dưới nhìn lên thấy mặt
//      trong của vỏ, cao → không che; chỉ vành chân sát đất che — đúng chỗ cần tối nhất);
//   2. nhoè Gauss tách hai lượt (ngang, dọc) → quầng tối lan ra một đoạn ngắn quanh chỗ tiếp xúc; lượt
//      dọc giữ lại một phần bản sắc nét → đậm nhất đúng ở đường tiếp xúc rồi nhạt nhanh;
//   3. giữ lại render target cuối (256², 8 bit) làm texture cho một tấm decal nằm ngay trên mặt đỡ.
// Sau khi nướng: 0 lượt vẽ thêm mỗi khung (decal là 1 draw call nhỏ, không nhận/đổ bóng, không soi gương).
//
// Decal là con của CHÍNH bản sao bia (lắc cùng rùa, không cùng bục đang xoay ngược), trộn kiểu "tối
// đi" (màu đen, alpha = độ che) và vẽ SAU đĩa gương lòng bục → làm tối cả ảnh phản chiếu dưới chân rùa.
import * as THREE from 'three';
import { neverCastShadow } from './hotspot.js';

const RES = 256;
const BAND = 0.035; // cao độ (đơn vị gốc mô hình, bia cao 1) mà từ đó trở lên không còn che
const MARGIN = 0.06; // decal rộng hơn dấu chân chừng này mỗi phía (chỗ cho quầng lan ra)
const BLUR_TEXELS = 20; // bán kính nhoè (texel ≈ 0,004 đơn vị) — mép mai rùa thường chìa ra ngoài chỗ chạm đất,
//                          quầng phải lan quá phần chìa đó mới thấy được
const SHARP_KEEP = 0.7; // phần bản sắc nét giữ lại trong lượt cuối
export const CONTACT_EPS = 0.0012; // decal nhô trên mặt đỡ (trên đĩa gương lòng bục)

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;
// Gauss tách lượt: 17 lần đọc cách nhau 2 texel (lọc song tuyến lấp giữa), σ = bán kính / 2,5.
const blurFrag = /* glsl */ `
  uniform sampler2D tSrc;
  uniform sampler2D tSharp;
  uniform vec2 uDir; // một texel theo hướng nhoè
  uniform float uRadius; // texel
  uniform float uKeep;
  varying vec2 vUv;
  void main() {
    float sigma = max( uRadius / 2.5, 0.5 );
    float sum = 0.0;
    float wsum = 0.0;
    for ( int i = -8; i <= 8; i ++ ) {
      float x = float( i ) * uRadius / 8.0;
      float w = exp( - 0.5 * x * x / ( sigma * sigma ) );
      sum += texture2D( tSrc, vUv + uDir * x ).r * w;
      wsum += w;
    }
    float s = sum / wsum;
    // lượt cuối: giữ một phần bản sắc nét → đậm nhất đúng ở đường tiếp xúc
    if ( uKeep > 0.0 ) s = max( s, texture2D( tSharp, vUv ).r * uKeep );
    gl_FragColor = vec4( s, s, s, 1.0 );
  }
`;

/**
 * @param {THREE.WebGLRenderer} renderer
 */
export function createContactShadows(renderer) {
  // r21: MỘT bản đồ cho mỗi BIA (mọi LOD + proxy cùng dáng, cùng phép biến đổi → bóng tiếp xúc như nhau; bản đồ nhoè
  // 256² không phân biệt nổi 6k hay 150k tam giác) — khoá = id bia; LRU CACHE_MAX mục, RT bị đẩy ra được giải phóng.
  // Trước đây: WeakMap theo bản gốc → mỗi LOD một RT và RT của bản gốc đã bỏ không bao giờ được giải phóng.
  const CACHE_MAX = 24;
  /** @type {Map<string, {rt:THREE.WebGLRenderTarget, tex:THREE.Texture, half:number, y0:number, ms:number}>} */
  const cache = new Map();
  const owned = new Set(); // mọi render target đã tạo → giải phóng khi rời view
  const keyOf = (root) => root?.userData?.proxyOf ?? root?.name ?? '';
  /** Đang gắn vào decal nào đó (không đẩy ra). */
  const inUse = new Set();
  function evict() {
    for (const [k, it] of cache) {
      if (cache.size <= CACHE_MAX) break;
      if (inUse.has(it.tex)) continue;
      cache.delete(k);
      owned.delete(it.rt);
      it.rt.dispose();
    }
  }

  const rtOpts = { type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false, generateMipmaps: false };
  const mk = (depth) => {
    const rt = new THREE.WebGLRenderTarget(RES, RES, { ...rtOpts, depthBuffer: depth });
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;
    return rt;
  };
  // Hai RT làm việc dùng chung cho mọi lần nướng; RT kết quả thì mỗi bia một cái.
  const rtSharp = mk(true);
  const rtTmp = mk(false);

  const heightMat = new THREE.ShaderMaterial({
    uniforms: { uY0: { value: 0 }, uBand: { value: BAND } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vec4 w = modelMatrix * vec4( position, 1.0 );
        vY = w.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uY0;
      uniform float uBand;
      varying float vY;
      void main() {
        float o = 1.0 - smoothstep( 0.0, uBand, vY - uY0 );
        gl_FragColor = vec4( o, o, o, 1.0 );
      }`,
    side: THREE.DoubleSide,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: {
      tSrc: { value: null },
      tSharp: { value: null },
      uDir: { value: new THREE.Vector2() },
      uRadius: { value: BLUR_TEXELS },
      uKeep: { value: 0 },
    },
    vertexShader: quadVert,
    fragmentShader: blurFrag,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bakeScene = new THREE.Scene();
  bakeScene.overrideMaterial = heightMat;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 2);
  const _box = new THREE.Box3();
  const _clr = new THREE.Color();

  /**
   * Nướng (hoặc lấy từ cache) bản đồ bóng tiếp xúc cho BẢN GỐC của một bia (từ loader — không nằm
   * trong cảnh, ma trận gốc đơn vị). Trả về { tex, half } — decal vuông cạnh 2·half quanh trục bia.
   */
  function bake(root) {
    const key = keyOf(root);
    const hit = key ? cache.get(key) : null;
    if (hit) {
      cache.delete(key); // LRU: lên cuối
      cache.set(key, hit);
      return hit;
    }
    const t0 = performance.now();
    root.updateMatrixWorld(true);
    _box.setFromObject(root);
    if (_box.isEmpty()) return null;
    const half =
      Math.max(Math.abs(_box.min.x), Math.abs(_box.max.x), Math.abs(_box.min.z), Math.abs(_box.max.z)) + MARGIN;
    const y0 = _box.min.y;
    // Camera dưới mặt đứng, nhìn thẳng lên: phải màn hình = +x, trên màn hình = +z → texel (u, v) ↔ (x, z).
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 0.001;
    cam.far = BAND * 4 + 0.02;
    cam.position.set(0, y0 - 0.01, 0);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, y0 + 1, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    heightMat.uniforms.uY0.value = y0;

    const rtOut = mk(false);
    owned.add(rtOut);

    // Trạng thái renderer: không để lượt nướng "ăn" cờ vẽ lại shadow map của khung sắp tới.
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(_clr);
    const prevClr = _clr.clone();
    const sm = renderer.shadowMap;
    const prevSmAuto = sm.autoUpdate;
    const prevSmNeeds = sm.needsUpdate;
    sm.autoUpdate = false;
    sm.needsUpdate = false;
    const parent = root.parent; // bản gốc từ loader: không có cha; phòng khi có thì trả lại đúng chỗ
    try {
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 1);
      bakeScene.add(root);
      renderer.setRenderTarget(rtSharp);
      renderer.render(bakeScene, cam);
      bakeScene.remove(root);
      if (parent) parent.add(root);
      // nhoè ngang → rtTmp, nhoè dọc (+ giữ nét) → rtOut
      blurMat.uniforms.tSrc.value = rtSharp.texture;
      blurMat.uniforms.uDir.value.set(1 / RES, 0);
      blurMat.uniforms.uKeep.value = 0;
      renderer.setRenderTarget(rtTmp);
      renderer.render(quadScene, quadCam);
      blurMat.uniforms.tSrc.value = rtTmp.texture;
      blurMat.uniforms.tSharp.value = rtSharp.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / RES);
      blurMat.uniforms.uKeep.value = SHARP_KEEP;
      renderer.setRenderTarget(rtOut);
      renderer.render(quadScene, quadCam);
    } finally {
      if (root.parent === bakeScene) bakeScene.remove(root);
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAuto;
      renderer.setClearColor(prevClr, prevAlpha);
      sm.autoUpdate = prevSmAuto;
      sm.needsUpdate = prevSmNeeds;
    }
    // DEV: chờ GPU làm xong để số đo gồm cả thời gian vẽ (bản build không chặn luồng).
    if (import.meta.env.DEV) renderer.getContext().finish();
    const item = { rt: rtOut, tex: rtOut.texture, half, y0, ms: +(performance.now() - t0).toFixed(2) };
    if (key) {
      cache.set(key, item);
      evict();
    }
    return item;
  }

  /** Một decal cho mỗi khay; gắn lại vào bản sao bia mỗi lần present(). */
  function createDecal() {
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2); // nằm trong mặt XZ; position.xz ∈ [−1, 1]
    const mat = new THREE.ShaderMaterial({
      uniforms: { tOcc: { value: null }, uStrength: { value: 0.8 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xz * 0.5 + 0.5; // khớp lượt nướng: u ↔ +x, v ↔ +z
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tOcc;
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          float o = pow( texture2D( tOcc, vUv ).r, 0.6 ); // đuôi quầng dài + đậm hơn ở sát chân (vẫn mềm)
          // mép decal luôn = 0 (quầng không bao giờ bị cắt thẳng)
          vec2 e = min( vUv, 1.0 - vUv );
          o *= smoothstep( 0.0, 0.04, min( e.x, e.y ) );
          // Độ đậm (settings.contactShadow 0..1,5): ≤ 1 nhân thẳng; > 1 đậm thêm theo 1 − (1 − o)^k — quầng
          // dày lên mà alpha không bao giờ vượt 1 (render target float của lượt ghép ảnh không kẹp alpha).
          float a = uStrength <= 1.0 ? o * uStrength : 1.0 - pow( max( 1.0 - o, 0.0 ), uStrength );
          if ( a < 0.003 ) discard;
          gl_FragColor = vec4( 0.0, 0.0, 0.0, a ); // "tối đi": đích × (1 − a)
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'cinema-contact-shadow';
    mesh.renderOrder = 2; // sau đĩa gương lòng bục (1) → làm tối cả ảnh phản chiếu dưới chân rùa
    neverCastShadow(mesh); // engine chuyển cảnh bật castShadow cho cả khay lúc bàn giao bóng
    mesh.receiveShadow = false;
    mesh.userData.noReflect = true;
    mesh.raycast = () => {}; // rê chuột lên lòng bục không tính là rê lên bia
    mesh.userData.noBVH = true; // gắn vào bản sao bia nhưng không phải lưới của bia (bvh.js / hasBVH)
    mesh.visible = false;
    return {
      mesh,
      /** Gắn vào bản sao bia `inst` với bản đồ đã nướng của bản gốc `root`. */
      attach(inst, item) {
        if (mat.uniforms.tOcc.value) inUse.delete(mat.uniforms.tOcc.value);
        if (!item) {
          mat.uniforms.tOcc.value = null;
          mesh.visible = false;
          return;
        }
        mat.uniforms.tOcc.value = item.tex;
        inUse.add(item.tex);
        mesh.scale.set(item.half, 1, item.half);
        mesh.position.set(0, item.y0 + CONTACT_EPS, 0);
        inst.add(mesh);
        mesh.visible = true;
      },
      setStrength(v) {
        mat.uniforms.uStrength.value = v;
      },
      dispose() {
        mesh.parent?.remove(mesh);
        geo.dispose();
        mat.dispose();
      },
    };
  }

  return {
    bake,
    createDecal,
    /** Thời gian nướng (ms, luồng chính — gồm gửi lệnh GPU) của bản gốc, nếu đã nướng. */
    info(root) {
      const it = cache.get(keyOf(root));
      return it ? { half: +it.half.toFixed(3), ms: it.ms } : null;
    },
    /** DEV: ảnh bản đồ độ che đã nướng (data URL PNG; hàng trên = +z). */
    debugImage(root) {
      const it = cache.get(keyOf(root));
      if (!it) return null;
      const buf = new Uint8Array(RES * RES * 4);
      renderer.readRenderTargetPixels(it.rt, 0, 0, RES, RES, buf);
      const cv = document.createElement('canvas');
      cv.width = RES;
      cv.height = RES;
      const g = cv.getContext('2d');
      const img = g.createImageData(RES, RES);
      for (let y = 0; y < RES; y++) img.data.set(buf.subarray((RES - 1 - y) * RES * 4, (RES - y) * RES * 4), y * RES * 4);
      g.putImageData(img, 0, 0);
      return cv.toDataURL('image/png');
    },
    dispose() {
      for (const rt of owned) rt.dispose();
      owned.clear();
      rtSharp.dispose();
      rtTmp.dispose();
      heightMat.dispose();
      blurMat.dispose();
      quad.geometry.dispose();
    },
  };
}
