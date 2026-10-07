// Điện ảnh › VÒNG CẦM 3D — kéo bia bằng nắm tay VÀ hai ngón (r59 → r65).
//
// Người dùng (r59): "khi nắm tay, cursor đang là circle 2D, biến thành circle 3D rộng ôm quanh bia rùa, song song với sàn (và
// mặt bục), kèm 2 cặp chevron hướng về 2 bên. design cho hiện đại giúp tôi nhé." (r60): "mũi tên nằm bẹt cùng mặt phẳng với vòng
// tròn. cho setting vị trí vòng tròn vào setting, trong đó điều khiển được cao thấp, center là ngang với 50% height khi focus.
// transition của cursor fade đơn giản thôi: xoay nghiêng 90 ngang + scale up, move đường ngắn nhất." (r61, sau khi thử các độ
// cao): "cho xuống sàn đi, để trên cao không hay như tôi nghĩ." (r62): "Vòng 3D khi nắm tay: cho chevron bold và outline. bỏ
// dash. dùng cái này thay cho mũi tên của "kéo bia"." + "tôi thích hiệu ứng ánh sáng thở nhẹ quanh vòng tròn 3D như bây giờ,
// tăng contrast, để nhìn rõ hơn vì line đang khá mảnh. tiện tăng width của line vòng tròn đó lên x2 đi xem sao." (r65):
// "chưa bỏ transition từ cursor sang vòng 3D, lúc để cursor cao trên bia tôi vẫn thấy 1 vòng tròn lao nhanh xuống sàn và scale
// lên thành vòng 3D." → BỎ HẲN biến hình từ con trỏ.
//
// Hình: vòng SÁNG NẰM TRÊN SÀN quanh chân bục (bán kính RING_K × R bục — ôm cả bia, rùa, bục) — dùng cho CẢ nắm tay lẫn kéo
// bia hai ngón (r62: thay hai mũi tên sàn pedestal-arrows.js):
//   · nét chính: một đường vàng (r62: dày ×2 — ≈ 4 px ở cung trước) lõi sáng + quầng mềm hẹp, lót một viền tối rất nhẹ bên
//     dưới (tách khỏi vũng sáng sàn — tăng tương phản, không nhoè); r62: bỏ vòng vạch (dash) bên ngoài — chỉ một vòng sạch;
//   · chiều sâu: cung phía sau nhạt dần (và bị bia / bục che theo độ sâu) → đọc thành vòng 3D quanh bia; cung trước rõ hơn;
//   · hai cặp chevron NẰM TRONG MẶT PHẲNG VÒNG (r60), ngay ngoài vòng ở ±CHEV_DEG so với hướng về camera (lệch về phía trước so
//     với hai mép ±90° — ở đúng mép, phối cảnh ép chevron nằm thành "//"), chỉ ra ngoài theo bán kính: «« bên trái, »» bên
//     phải; r62: chevron ĐẬM (thân dày) vẽ bằng ĐƯỜNG VIỀN (nét viền cân với nét vòng, lòng chỉ ánh rất nhạt); phía tay đang
//     kéo sáng hẳn, phía kia mờ;
//   · chuyển động nhàn: một vệt sáng chạy quanh vòng (~7 s — r62: rõ hơn), cặp chevron thở ra ngoài (~2,4 s).
// HIỆN RA (r65): vòng hiện ĐÚNG CHỖ của nó — nằm trên sàn quanh chân bục, không bao giờ đi từ con trỏ (con trỏ / huy hiệu V tự
// mờ nhanh ở lớp cử chỉ khi view báo cầm — body[data-stele-grab]): trong IN_S (ease-out) mờ → rõ + nở nhẹ IN_SCALE → 1, cặp
// chevron hiện theo sau một nhịp (vòng trước, chevron sau — nhẹ nhàng, có thứ tự). Nhả: mờ tắt + nở nhẹ ra ngoài. Giảm chuyển
// động: chỉ mờ → rõ (không nở). Cầm lại lúc vòng còn đang mờ tắt dở → sáng lại tại chỗ (không nở lại từ đầu). Nằm trong KHAY
// (đi theo bia + bục khi kéo / nhận); đã nhận: theo khay cũ rời đi, tắt khi lướt xong.
//
// const ring = createGrabRing(); slot.add(ring.group)
//   ring.setRadius(R)
//   ring.begin(camera, reduceMotion) · ring.update(dt, camera, { on, side, hold, reduceMotion })
//   ring.off() · ring.state · ring.project(camera, rect) · ring.dispose()
import * as THREE from 'three';
import { neverCastShadow } from './hotspot.js';

const GOLD = [217 / 255, 179 / 255, 108 / 255]; // --nv-gold
const WARM = [1, 0.945, 0.84]; // đỉnh vệt sáng — vàng trắng ấm
const RING_K = 1.1; // bán kính vòng / R bục
export const CHEV_DEG = 72; // chevron ở ±72° so với hướng về camera (xem chú thích đầu tệp)
/** r65: hiện ra — thời gian (s), cỡ lúc đầu (so với cỡ thật). */
const IN_S = 0.28;
const IN_SCALE = 0.92;
const IN_S_REDUCED = 0.25; // giảm chuyển động: chỉ mờ → rõ
const FADE_OUT = 0.26;
const DIM = 0.3;
const IDLE = 0.78;
const HALF = 1.42; // nửa cạnh mặt phẳng / bán kính vòng (chứa chevron đậm + quầng)
/** r62: nửa bề dày nét vòng (m, thế giới) — ×2 so với r59 (1,3 mm); quầng (m). */
const LINE_HALF_M = 0.0026;
const GLOW_M = 0.012;
const Y0 = 0.0026; // độ cao vòng (sàn): trên vũng sáng sàn (0,0012), đĩa hứng bóng (0,0016)

const vert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy * ${HALF.toFixed(2)};
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Toạ độ vP: đơn vị = bán kính vòng. Khi nằm ngang: (x, y) cục bộ = (x, −z) của nhóm; "trước" (về camera) = −y.
const frag = /* glsl */ `
  varying vec2 vP;
  uniform float uW;      // nửa bề dày nét (đơn vị bán kính)
  uniform float uGlow;   // bề rộng quầng
  uniform float uAlpha, uIntL, uIntR, uTime, uBreath, uChevA;
  uniform vec2 uCh;      // (sin, cos) của góc chevron
  uniform vec3 uGold, uWarm;
  // khoảng cách có dấu tới chevron ĐẬM: hai thanh (nửa dày t) từ mũi (tip, 0) lùi về (tip − a, ±b) — q = (theo bán kính, ngang)
  float chevron(vec2 q, float tip, float a, float b, float t) {
    vec2 p = vec2(q.x - tip, abs(q.y));
    vec2 e = vec2(-a, b);
    float h = clamp(dot(p, e) / dot(e, e), 0.0, 1.0);
    return length(p - e * h) - t;
  }
  void main() {
    float r = length(vP);
    float aa = max(fwidth(r), 1e-5);
    float dMain = abs(r - 1.0) - uW;
    float ang = atan(vP.y, vP.x);
    float cMain = 1.0 - smoothstep(-aa, aa, dMain);
    float glow = exp(-pow(max(dMain, 0.0) / uGlow, 2.0));
    // vệt sáng chạy quanh vòng (~7 s) — r62: rõ hơn (lõi sáng hẳn lên, quầng dày lên theo vệt)
    float sweep = pow(0.5 + 0.5 * cos(ang - uTime * 0.9), 8.0);
    // cung sau nhạt dần: y > 0 là phía xa camera; r62: cung trước rõ hơn một chút so với cung sau
    float depth = mix(1.0, 0.26, smoothstep(-0.3, 0.75, vP.y));
    float ring = (cMain * (0.8 + 0.75 * sweep) + glow * (0.16 + 0.3 * sweep)) * depth;
    // viền tối rất nhẹ ôm nét (tách khỏi sàn sáng — tăng tương phản)
    float under = (1.0 - smoothstep(-aa, aa, abs(r - 1.0) - uW * 2.6)) * 0.3 * depth;
    // chevron trong mặt phẳng vòng: bên (trái x < 0 / phải x > 0), hướng bán kính ở góc ±uCh so với "trước" (0, −1)
    float side = vP.x < 0.0 ? -1.0 : 1.0;
    vec2 dir = vec2(side * uCh.x, -uCh.y);
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 q = vec2(dot(vP, dir), dot(vP, perp));
    float t0 = 1.09 + uBreath;
    float ct = 0.021;              // nửa bề dày thân chevron (đậm)
    float ca = 0.062, cb = 0.092;  // độ sâu / nửa sải của mỗi chevron
    float tip1 = t0 + ca + ct + 0.012;
    float s1 = chevron(q, tip1, ca, cb, ct);
    float s2 = chevron(q, tip1 + 0.088, ca, cb, ct);
    float w = uW * 0.85;           // nửa bề dày nét viền (cân với nét vòng)
    float a1 = max(fwidth(s1), 1e-5);
    float a2 = max(fwidth(s2), 1e-5);
    float o1 = 1.0 - smoothstep(-a1, a1, abs(s1) - w);
    float o2 = 1.0 - smoothstep(-a2, a2, abs(s2) - w);
    float f1 = 1.0 - smoothstep(-a1, a1, s1);
    float f2 = 1.0 - smoothstep(-a2, a2, s2);
    float cChev = max(o1, o2 * 0.62) + max(f1, f2 * 0.62) * 0.12;
    float glowC = exp(-pow(max(min(s1, s2), 0.0) / (uGlow * 0.7), 2.0)) * 0.22;
    float inten = side < 0.0 ? uIntL : uIntR;
    float chev = (cChev + glowC) * inten * uChevA;
    float under2 = max(1.0 - smoothstep(-a1, a1, s1 - w * 2.2), (1.0 - smoothstep(-a2, a2, s2 - w * 2.2)) * 0.62) * 0.26 * inten * uChevA;
    float lit = ring + chev;
    float a = clamp(lit + max(under, under2) * (1.0 - clamp(lit, 0.0, 1.0)), 0.0, 1.0) * uAlpha;
    if (a < 0.003) discard;
    vec3 col = mix(uGold, uWarm, clamp(sweep * 0.7 * cMain + max(o1, o2) * inten * 0.35, 0.0, 1.0));
    // màu đã nhân alpha (blend One / OneMinusSrcAlpha): phần sáng = lit, phần viền tối chỉ có alpha (không màu)
    gl_FragColor = vec4(col * min(lit, 1.0) * uAlpha, a);
  }
`;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function createGrabRing() {
  const group = new THREE.Group(); // gốc = tâm sàn của khay; xoay quanh y để "trước" hướng về camera
  group.name = 'cinema-grab-ring';
  const U = {
    uW: { value: 0.004 },
    uGlow: { value: 0.02 },
    uAlpha: { value: 0 },
    uIntL: { value: IDLE },
    uIntR: { value: IDLE },
    uTime: { value: 0 },
    uBreath: { value: 0 },
    uChevA: { value: 1 },
    uCh: { value: new THREE.Vector2(Math.sin((CHEV_DEG * Math.PI) / 180), Math.cos((CHEV_DEG * Math.PI) / 180)) },
    uGold: { value: new THREE.Vector3(...GOLD) },
    uWarm: { value: new THREE.Vector3(...WARM) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.renderOrder = -0.3;
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  neverCastShadow(mesh);
  mesh.userData.noReflect = true;
  mesh.visible = false;
  group.add(mesh);

  // inK: tiến độ hiện ra 0..1 (r65 — thay tiến độ biến hình từ con trỏ); reduced: lượt hiện này không nở (giảm chuyển động)
  const st = { on: false, alpha: 0, inK: 1, reduced: false, l: IDLE, r: IDLE, side: null, time: 0, out: 0 };
  let Ra = 0.72;
  // lưới nằm NGANG trên sàn quanh chân bục (tâm = tâm khay), cố định — chỉ cỡ + độ hiện đổi
  mesh.rotation.set(-Math.PI / 2, 0, 0);
  mesh.position.set(0, Y0, 0);
  const _c = new THREE.Vector3();
  const _o = new THREE.Vector3();
  const _v = new THREE.Vector3();

  function faceCamera(camera) {
    const parent = group.parent;
    if (!parent || !camera) return;
    parent.updateWorldMatrix(true, false);
    _c.copy(camera.position);
    parent.worldToLocal(_c);
    _o.copy(group.position);
    group.rotation.y = Math.atan2(_c.x - _o.x, _c.z - _o.z);
    group.updateMatrixWorld(true);
  }
  /** Cỡ + bề dày nét theo tiến độ hiện ra (ease-out: nở IN_SCALE → 1) và nhịp nở khi nhả (out). */
  function pose() {
    const k = easeOutCubic(st.inK);
    const grow = st.reduced ? 1 : IN_SCALE + (1 - IN_SCALE) * k;
    const rad = Ra * grow * (1 + st.out * 0.04);
    mesh.scale.setScalar(rad * HALF);
    // nét / quầng giữ bề dày THẾ GIỚI (r62: nửa nét 2,6 mm → nét ~4 px ở cung trước; quầng 12 mm)
    U.uW.value = LINE_HALF_M / rad;
    U.uGlow.value = GLOW_M / rad;
    // chevron hiện theo sau vòng một nhịp (từ 35 % tiến độ hiện ra)
    U.uChevA.value = Math.min(1, Math.max(0, (st.inK - 0.35) / 0.65));
  }

  return {
    group,
    /** r64: lưới của vòng (biên dịch sẵn lúc khởi động — stage precompileGrab). */
    mesh,
    setRadius(R) {
      Ra = R * RING_K;
    },
    /** r65: bắt đầu hiện ra tại chỗ (sàn quanh chân bục). Vòng còn đang mờ tắt dở → sáng lại, không nở lại từ đầu. */
    begin(camera, reduceMotion = false) {
      faceCamera(camera);
      st.on = true;
      st.out = 0;
      st.reduced = !!reduceMotion;
      if (st.alpha > 0.05) {
        st.inK = 1;
        return;
      }
      st.alpha = 0;
      st.inK = 0;
    },
    update(dt, camera, { on = false, side = null, hold = false, reduceMotion = false } = {}) {
      if (!hold) {
        if (!on && st.on) st.out = 0;
        st.on = on;
        st.side = side;
      }
      const want = st.on || hold ? 1 : 0;
      if (want > 0 && st.inK < 1) {
        // hiện ra: độ hiện theo cùng đường ease-out với cỡ (mờ → rõ + nở nhẹ trong IN_S)
        st.inK = Math.min(1, st.inK + dt / (st.reduced || reduceMotion ? IN_S_REDUCED : IN_S));
        st.alpha = Math.max(st.alpha, easeOutCubic(st.inK));
      } else if (want > st.alpha) st.alpha = Math.min(1, st.alpha + dt / (reduceMotion ? IN_S_REDUCED : IN_S));
      else if (want < st.alpha) {
        st.alpha = Math.max(0, st.alpha - dt / FADE_OUT);
        if (!reduceMotion) st.out = Math.min(1, st.out + dt / FADE_OUT); // nhả: nở nhẹ khi mờ
      }
      if (!hold) {
        const tl = st.side === 'left' ? 1 : st.side === 'right' ? DIM : IDLE;
        const tr = st.side === 'right' ? 1 : st.side === 'left' ? DIM : IDLE;
        const k = 1 - Math.exp(-dt / 0.09);
        st.l = reduceMotion ? tl : st.l + (tl - st.l) * k;
        st.r = reduceMotion ? tr : st.r + (tr - st.r) * k;
      }
      st.time += dt;
      U.uTime.value = reduceMotion ? 0 : st.time;
      // cặp chevron thở ra ngoài (~2,4 s) — mạnh hơn khi đang kéo về một phía
      U.uBreath.value = reduceMotion ? 0 : (0.5 - 0.5 * Math.cos((st.time * 2 * Math.PI) / 2.4)) * (st.side ? 0.02 : 0.012);
      U.uAlpha.value = st.alpha;
      U.uIntL.value = st.l;
      U.uIntR.value = st.r;
      mesh.visible = st.alpha > 0.003;
      if (!mesh.visible) return false;
      faceCamera(camera);
      pose();
      return true;
    },
    /** DEV: góc chevron (độ, so với hướng về camera) — so phương án. */
    setChevDeg(deg) {
      const a = (Number(deg) * Math.PI) / 180;
      U.uCh.value.set(Math.sin(a), Math.cos(a));
    },
    off() {
      st.on = false;
      st.alpha = 0;
      st.inK = 1;
      st.out = 0;
      U.uAlpha.value = 0;
      mesh.visible = false;
    },
    /**
     * DEV / kiểm thử: độ hiện, tiến độ hiện ra (inK), cỡ so với cỡ thật (scale), hai phía, vị trí nhóm (x thế giới), tâm (toạ độ
     * khay), độ nghiêng (ny: nằm ngang → 1).
     */
    get state() {
      group.getWorldPosition(_o);
      _v.set(0, 0, 1).applyQuaternion(mesh.quaternion); // pháp tuyến mặt phẳng (toạ độ nhóm): nằm ngang → (0, 1, 0)
      return { alpha: +st.alpha.toFixed(3), inK: +st.inK.toFixed(3), scale: +(mesh.scale.x / (Ra * HALF)).toFixed(4), left: +st.l.toFixed(3), right: +st.r.toFixed(3), visible: mesh.visible, wx: +_o.x.toFixed(4), y: +mesh.position.y.toFixed(4), pos: mesh.position.toArray().map((v) => +v.toFixed(4)), ny: +_v.y.toFixed(3), chevDeg: CHEV_DEG };
    },
    /** Tâm + bán kính (px) của vòng trên màn hình lúc này — bán kính đo theo trục x của lưới. */
    project(camera, rect) {
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(_c);
      const toPx = (w) => {
        _v.copy(w).project(camera);
        return [rect.left + ((_v.x + 1) / 2) * rect.width, rect.top + ((1 - _v.y) / 2) * rect.height];
      };
      const c = toPx(_c);
      _o.set(1 / HALF, 0, 0).applyMatrix4(mesh.matrixWorld);
      const e = toPx(_o);
      return { x: +c[0].toFixed(1), y: +c[1].toFixed(1), r: +Math.hypot(e[0] - c[0], e[1] - c[1]).toFixed(1) };
    },
    dispose() {
      group.parent?.remove(group);
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
