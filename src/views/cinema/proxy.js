// Proxy của bia (r16) — chỗ đứng tạm khi người xem lướt nhanh hơn tốc độ tải mô hình đầy đủ.
//
// Lưới rút gọn vài nghìn tam giác (tools/make-proxies.mjs, core/loader.loadProxy), CÙNG phép biến đổi với bia đầy đủ
// nên đặt thẳng vào khay. Chất liệu: đất sét graphite mờ (không texture) — đọc được hình khối, rõ là bản phác.
// r19 — "đang chờ" (người dùng: bỏ các vạch ngang; lúc chờ cần một chuyển động nhẹ nhàng), hai biến thể (stage chọn):
//   · 'rim'     viền vàng theo góc nhìn THỞ chậm (chu kỳ 2,4 s, 0,3 ↔ 0,75) + phần "đầy" sáng dịu dâng lên theo tiến độ
//               tải (byte) — không biết tổng thì trôi lên chậm; lúc quét hiện, đá thật nối tiếp từ dưới lên;
//   · 'outline' đường bao vàng mảnh đứng yên + một dải sáng mềm trôi chậm từ chân lên đỉnh (4,8 s một lượt).
// Mọi mức do stage tính mỗi khung (setWait) — vẻ chờ hiện / tắt dần (cubic vào-ra), không nháy (≤ 0,5 Hz).
// Khi bia đầy đủ tới: quét hiện từ dưới lên (stage.upgrade) — proxy chỉ còn phần TRÊN vạch quét, sát vạch sáng nhẹ.
import * as THREE from 'three';

const PROXY_COLOR = 0x4a4640; // sRGB — đá graphite ấm, sáng hơn nền để khối còn đọc được dưới đèn kịch tính
const RIM_GLOW = 0.22; // viền (biến thể 'rim') ở mức thở 1 — thực tế 0,3..0,75 × ngần này
const FILL_GLOW = 0.022; // phần "đầy" theo tiến độ tải (biến thể 'rim')
const OUTLINE_GLOW = 0.16; // đường bao (biến thể 'outline')
const BAND_GLOW = 0.1; // dải sáng trôi (biến thể 'outline')
const BAND_W = 0.07; // nửa bề cao dải sáng trôi (đơn vị mô hình)
const GOLD = new THREE.Color(0xd9b36c); // --gold (tuyến tính sau khi set từ hex)

const VERT_COMMON = /* glsl */ `
uniform mat4 uProxyFromMesh;
varying vec3 vProxyPos;
`;
const FRAG_COMMON = /* glsl */ `
uniform vec4 uReveal; // x = cao độ vạch quét (toạ độ mô hình), y = bật (> 0,5), z = bề dày vệt sáng, w = độ sáng
uniform vec4 uWait; // x = độ hiện vẻ chờ (0..1, đã ease), y = mức viền (thở), z = cao độ mép "đầy" / dải trôi, w = biến thể (0 rim, 1 outline)
uniform vec4 uWait2; // x = bề mềm mép "đầy", y = độ sáng phần "đầy"
uniform vec3 uProxyGold;
varying vec3 vProxyPos;
`;

/**
 * Vật liệu proxy cho một bản sao. `fromMesh` = ma trận lưới → toạ độ mô hình; `uReveal` dùng chung cho mọi lưới của
 * bản sao. Một chương trình cho mọi proxy (customProgramCacheKey cố định).
 */
function makeMaterial(fromMesh, uReveal, uWait, uWait2) {
  const m = new THREE.MeshStandardMaterial({ color: PROXY_COLOR, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uProxyFromMesh = fromMesh;
    sh.uniforms.uReveal = uReveal;
    sh.uniforms.uWait = uWait;
    sh.uniforms.uWait2 = uWait2;
    sh.uniforms.uProxyGold = { value: GOLD };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vProxyPos = (uProxyFromMesh * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}`)
      // phần DƯỚI vạch quét đã là đá thật — proxy không vẽ ở đó
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (uReveal.y > 0.5 && vProxyPos.y < uReveal.x) discard;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  {
    // viền theo góc nhìn (khối tách khỏi nền tối)
    float fres = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
    vec3 wait;
    if (uWait.w < 0.5) {
      // 'rim': viền thở + phần "đầy" dâng theo tiến độ tải (mép mềm)
      float fill = 1.0 - smoothstep(uWait.z - uWait2.x, uWait.z + uWait2.x, vProxyPos.y);
      wait = uProxyGold * (pow(fres, 3.0) * ${RIM_GLOW.toFixed(3)} * uWait.y + fill * uWait2.y * (0.6 + 0.4 * fres));
    } else {
      // 'outline': đường bao mảnh + dải sáng mềm trôi lên
      float t = (vProxyPos.y - uWait.z) / ${BAND_W.toFixed(3)};
      wait = uProxyGold * (smoothstep(0.55, 0.92, fres) * ${OUTLINE_GLOW.toFixed(3)} + exp(-t * t) * ${BAND_GLOW.toFixed(3)} * (0.35 + 0.65 * fres));
    }
    totalEmissiveRadiance += wait * uWait.x;
    if (uReveal.y > 0.5) totalEmissiveRadiance += uProxyGold * (uReveal.w * exp(-(vProxyPos.y - uReveal.x) / max(uReveal.z, 1e-4)));
  }`,
      );
  };
  m.customProgramCacheKey = () => 'cinema-proxy-v2';
  return m;
}

/**
 * Bản sao proxy đặt được vào khay (vật liệu riêng mỗi bản sao — uniform quét hiện riêng).
 * @param {THREE.Object3D} root bản gốc từ loader.loadProxy (không sửa)
 */
export function createProxyInstance(root) {
  const inst = root.clone(true);
  inst.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(inst.matrixWorld).invert();
  const uReveal = { value: new THREE.Vector4(0, 0, 0.006, 0.5) };
  const uWait = { value: new THREE.Vector4(0, 0.5, 0, 0) };
  const uWait2 = { value: new THREE.Vector4(0.05, FILL_GLOW, 0, 0) };
  inst.traverse((o) => {
    if (!o.isMesh) return;
    const fromMesh = { value: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) };
    o.material = makeMaterial(fromMesh, uReveal, uWait, uWait2);
    o.castShadow = true;
    o.receiveShadow = true;
  });
  inst.userData.isProxy = true;
  inst.userData.proxy = {
    /** Quét hiện: y = cao độ vạch (toạ độ mô hình), on = bật. */
    setReveal(y, on, width, glow) {
      const R = uReveal.value;
      R.set(y, on ? 1 : 0, width ?? R.z, glow ?? R.w);
    },
    /**
     * r19 vẻ "đang chờ": look = độ hiện (0..1, đã ease), rim = mức viền thở (0..1), y = cao độ mép "đầy" (rim) hoặc tâm
     * dải trôi (outline) — toạ độ mô hình, variant 'rim' | 'outline', soft = bề mềm mép "đầy", fill = hệ số độ sáng phần đầy.
     */
    setWait(look, rim, y, variant = 'rim', soft = 0.05, fill = 1) {
      uWait.value.set(look, rim, y, variant === 'outline' ? 1 : 0);
      uWait2.value.set(soft, FILL_GLOW * fill, 0, 0);
    },
  };
  return inst;
}

/** Giải phóng vật liệu riêng của một bản sao proxy (lưới dùng chung với bản gốc trong loader). */
export function disposeProxyInstance(inst) {
  inst?.traverse((o) => {
    if (o.isMesh) o.material?.dispose();
  });
}
