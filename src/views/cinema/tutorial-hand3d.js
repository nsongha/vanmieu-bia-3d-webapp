// r68 — BÀN TAY HOẠT HÌNH 3D cho hướng dẫn cử chỉ (người dùng: "cùng xương tay đấy bạn có thể làm thành hình bàn tay hoạt hình
// như trong ảnh được không?" — ảnh tham khảo: bàn tay đất sét mềm, ngón tròn mập, cổ tay áo). Dựng THẲNG từ 21 điểm mốc (không
// dùng mô hình tải về — không có tệp / giấy phép nào kèm theo): mỗi đốt ngón là một viên nang thon (khối trụ côn + cầu ở hai
// khớp), lòng bàn tay là hợp của các nang mập từ cổ tay tới từng khớp gốc ngón + một khối dẹt lấp giữa + một "đệm lòng bàn tay"
// sáng hơn (đọc ra là LÒNG bàn tay hướng về người xem), cổ tay áo tròn mềm màu vàng nhạt + viền trong màu ngà. Vật liệu mềm như
// đất sét (sheen) dưới ánh sáng ấm: đèn bán cầu + đèn chính + đèn ven phía sau.
//
// Một bộ vẽ WebGL NHỎ (canvas riêng 512 × 512, không gắn vào trang) — vẽ xong chép ngay sang canvas 2D của nơi dùng (khung tròn
// bước 1, ô hình động tác): vị trí / cỡ / độ mờ / thu thành con trỏ vẫn do canvas 2D lo như với khung xương. Chỉ tạo khi hướng
// dẫn mở và cần vẽ (tutorial.js getHand), huỷ hẳn khi đóng (dispose + forceContextLoss) — hướng dẫn đóng thì không có gì.
// Điểm vào: [x, y, z] cùng đơn vị hai trục (x đã nhân tỉ lệ khung), z DƯƠNG = về phía người xem.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import HANDS from '../../data/tutorial-hands.json';

// ---- (r69g) DÁNG NGÓN HỢP GIẢI PHẪU (người dùng: "các ngón khi nắm đang bị gập ngược phần tip, thực tế ngón tay sẽ cong đều
// nên tips phải cong tự nhiên vào trong"). Độ sâu của từng đốt chỉ biết ĐỘ LỚN (đốt ngắn lại trên ảnh = chĩa về / ra xa người
// xem — dữ liệu ghi chỉ có x, y; z của MediaPipe thì nhiễu), còn DẤU thì mơ hồ: chọn dấu cho từng đốt (8 cách mỗi ngón) sao cho
// mọi khớp chỉ GẬP về phía lòng bàn tay (không ưỡn ngược quá vài độ), không gập quá ~115°, và khớp đầu ngón (DIP) gập theo khớp
// giữa (PIP) ~2/3 khi mơ hồ; còn ưỡn thì kéo về. Lòng bàn tay hướng về người xem (+z). Góc gập: dương = về phía lòng bàn tay.
const CH = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
/** Chiều dài đốt chuẩn (đơn vị cổ tay → khớp gốc ngón giữa) — từ dáng xoè của dữ liệu ghi (khi tay sống không có độ sâu). */
const REST = (() => {
  const f = HANDS.seqs.pinch[0];
  const u = Math.hypot(f[9][0] - f[0][0], f[9][1] - f[0][1]);
  return CH.map((c) => c.slice(1).map((b, i) => Math.hypot(f[b][0] - f[c[i]][0], f[b][1] - f[c[i]][1]) / u));
})();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3(0, 0, 1);
const V3 = () => new THREE.Vector3();
/** vùng nhớ tạm của solveFingers (không cấp mới mỗi khung) */
const SF = { L: V3(), up: V3(), v: [V3(), V3(), V3()], w: [V3(), V3(), V3()], dn: [V3(), V3(), V3()], prev: V3(), d: V3(), t1: V3(), Lt: V3(), t2: V3(), t3: V3() };
const flexOf = (a, b, L) => (Math.atan2(_a.crossVectors(a, b).dot(L), a.dot(b)) * 180) / Math.PI;
/**
 * Sửa dáng ngón tại chỗ (P: 21 điểm — đơn vị bàn tay, y lên, z về phía người xem). Trả góc gập đã sửa của từng khớp
 * { thumbIP, fingers: [[MCP, PIP, DIP] × 4] }. Không có độ sâu (mọi z ≈ 0) → ước lượng từ độ co ngắn (dấu chọn ở dưới).
 */
export function solveFingers(P) {
  if (P.every((p) => Math.abs(p.z) < 1e-4)) {
    const u = P[9].distanceTo(P[0]) || 1;
    CH.forEach((c, ci) => {
      for (let i = 1; i < 4; i++) {
        const a = P[c[i - 1]];
        const b = P[c[i]];
        const L = Math.hypot(b.x - a.x, b.y - a.y) / u;
        const L0 = REST[ci][i - 1];
        b.z = a.z + 0.95 * u * Math.sqrt(Math.max(0, L0 * L0 - L * L));
      }
    });
  }
  const out = { thumbIP: 0, fingers: [] };
  const { L, up, v, w, dn, prev, d, t1, Lt, t2, t3 } = SF;
  for (let ci = 1; ci < 5; ci++) {
    const c = CH[ci];
    up.subVectors(P[c[0]], P[0]).normalize();
    L.crossVectors(up, _n).normalize();
    for (let i = 0; i < 3; i++) v[i].subVectors(P[c[i + 1]], P[c[i]]);
    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      for (let i = 0; i < 3; i++) {
        w[i].copy(v[i]);
        if (mask & (1 << i)) w[i].z = -w[i].z;
        dn[i].copy(w[i]).normalize();
      }
      const a = [flexOf(up, dn[0], L), flexOf(dn[0], dn[1], L), flexOf(dn[1], dn[2], L)];
      let cost = 0;
      for (const x of a) cost += Math.max(0, -8 - x) * 10 + Math.max(0, x - 115) * 2;
      cost += 0.3 * Math.abs(a[2] - 0.67 * a[1]) + 0.02 * mask; // (hoà: giữ dấu gốc)
      if (!best || cost < best.cost) best = { cost, mask, a };
    }
    // dựng lại ngón theo dấu đã chọn; khớp còn ưỡn quá −5° → kéo về (DIP theo PIP ~2/3)
    prev.copy(up);
    const ang = [];
    for (let i = 0; i < 3; i++) {
      w[i].copy(v[i]);
      if (best.mask & (1 << i)) w[i].z = -w[i].z;
      const len = w[i].length();
      d.copy(w[i]).normalize();
      let a = flexOf(prev, d, L);
      if (a < -5) {
        const target = i === 2 ? Math.max(0, 0.67 * ang[1]) : 0;
        d.copy(prev).applyAxisAngle(L, (target * Math.PI) / 180);
        a = target;
      }
      ang.push(Math.round(a));
      P[c[i + 1]].copy(P[c[i]]).addScaledVector(d, len);
      prev.copy(d);
    }
    out.fingers.push(ang);
  }
  // ngón cái: khớp IP (2→3 so với 3→4) không ưỡn quá −10°
  {
    t1.subVectors(P[3], P[2]).normalize();
    Lt.crossVectors(t1, _n).normalize();
    t2.subVectors(P[4], P[3]);
    const len = t2.length();
    let a = flexOf(t1, t3.copy(t2).normalize(), Lt);
    if (a < -10) {
      t2.z = -t2.z;
      a = flexOf(t1, t3.copy(t2).normalize(), Lt);
      if (a < -10) {
        t2.copy(t1).multiplyScalar(len);
        a = 0;
      }
      P[4].copy(P[3]).add(t2);
    }
    out.thumbIP = Math.round(a);
  }
  return out;
}

// ---- (A) bàn tay có xương da từ mô hình "generic hand" của WebXR Input Profiles (MIT — public/hands/LICENSE-webxr-input-
// profiles.md): 25 khớp phẳng (không lồng nhau) như XRHandMeshModel; mỗi khung đặt vị trí khớp = điểm mốc, hướng khớp = hướng
// đốt (tới khớp kế) + trục ngang của bàn tay, giữ đúng quy ước trục của mô hình bằng cách so với tư thế gốc (bind pose). Chưa
// tải xong / lỗi tải → (B) bàn tay dựng bằng khối (bên dưới).
const HAND_URL = (side) => `${import.meta.env.BASE_URL}hands/generic-hand-${side}.glb`;
const FINGER_NAMES = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
/** 25 khớp WebXR: [tên, điểm mốc (−1 = khớp gốc bàn tay suy ra từ cổ tay → khớp gốc ngón), khớp kế (chỉ hướng), trục tham chiếu]. */
const JOINTS = [
  ['wrist', 0, -1, 'hand'],
  ['thumb-metacarpal', 1, 2, 'n'],
  ['thumb-phalanx-proximal', 2, 3, 'n'],
  ['thumb-phalanx-distal', 3, 4, 'n'],
  ['thumb-tip', 4, -2, 'n'],
];
FINGER_NAMES.forEach((f, i) => {
  const b = 5 + i * 4; // khớp gốc ngón (MCP) của ngón này
  const j0 = JOINTS.length;
  JOINTS.push([`${f}-metacarpal`, -1, j0 + 1, 'lat', b], [`${f}-phalanx-proximal`, b, j0 + 2, 'lat'], [`${f}-phalanx-intermediate`, b + 1, j0 + 3, 'lat'], [`${f}-phalanx-distal`, b + 2, j0 + 4, 'lat'], [`${f}-tip`, b + 3, -2, 'lat']);
});

const RES = 512; // cạnh ảnh vẽ (px thiết bị)
const S = 1.8; // nửa cạnh khung nhìn (đơn vị bàn tay: cổ tay → khớp gốc ngón giữa = 1)
const DY = 0.25; // tâm khung nhìn hạ dưới tâm lòng bàn tay ngần này (chừa chỗ cổ tay áo)

// bán kính ở từng điểm mốc (ngón mập, đầu ngón tròn)
const R = [0.27, 0.19, 0.135, 0.123, 0.117, 0.13, 0.106, 0.1, 0.097, 0.135, 0.109, 0.103, 0.099, 0.13, 0.103, 0.097, 0.093, 0.12, 0.091, 0.087, 0.083];
// nang: đốt ngón + lòng bàn tay (cổ tay → gốc ngón, màng ngón cái, hàng khớp gốc)
const BONES = [
  [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [17, 18], [18, 19], [19, 20],
  [0, 1], [0, 5], [0, 9], [0, 13], [0, 17], [1, 5], [5, 9], [9, 13], [13, 17],
];
/** DEV / kiểm thử: góc gập sau khi sửa của một dáng (pts: 21 × [x, y, z] như draw() nhận — y xuống, z về phía người xem). */
export function flexOfPose(pts) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const i of [0, 5, 9, 13, 17]) {
    cx += pts[i][0] / 5;
    cy += pts[i][1] / 5;
    cz += (pts[i][2] ?? 0) / 5;
  }
  const u = Math.hypot(pts[9][0] - pts[0][0], pts[9][1] - pts[0][1], (pts[9][2] ?? 0) - (pts[0][2] ?? 0)) || 1;
  return solveFingers(pts.map((p) => new THREE.Vector3((p[0] - cx) / u, -(p[1] - cy) / u, ((p[2] ?? 0) - cz) / u)));
}
const SKIN = '#f2c4a0';
const PAD = '#f9d8c0';
const CUFF = '#c9a86b'; // vàng nhạt trầm — cùng họ màu vàng của Điện ảnh
const BAND = '#f3ebdc';

const counts = { created: 0, disposed: 0 };
/** DEV / kiểm thử: số bộ vẽ đã tạo / huỷ (đang sống = created − disposed). */
export const hand3dCounts = () => ({ ...counts, live: counts.created - counts.disposed });

/** Khối trụ côn dùng chung cho mọi nang: bán kính hai đầu theo từng bản sao (thuộc tính aR), trục +Y từ đầu a tới đầu b. */
function taperMaterial(base) {
  base.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz *= mix(aR.x, aR.y, position.y + 0.5);');
  };
  return base;
}
function cuffGeometry(radius, half, edge) {
  const pts = [new THREE.Vector2(0.001, -half)];
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * edge, cy + Math.sin(a) * edge));
    }
  };
  arc(radius - edge, -half + edge, -Math.PI / 2, 0);
  arc(radius - edge, half - edge, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(0.001, half));
  return new THREE.LatheGeometry(pts, 40);
}

export function createHand3D() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  counts.created++;
  renderer.setPixelRatio(1);
  renderer.setSize(RES, RES, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-S, S, S, -S, -20, 20);
  cam.position.set(0, 0, 10);
  scene.add(new THREE.HemisphereLight('#fff3e4', '#5a3f30', 1.35));
  const key = new THREE.DirectionalLight('#ffffff', 1.9);
  key.position.set(-1.2, 1.8, 2.4);
  const fill = new THREE.DirectionalLight('#ffd6b4', 0.55);
  fill.position.set(1.6, -0.7, 1.4);
  const rim = new THREE.DirectionalLight('#ffe0a8', 1.5);
  rim.position.set(0.7, 1.1, -2.0);
  scene.add(key, fill, rim);

  const soft = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, sheen: 0.9, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fff1e2'), ...extra });
  const mSkin = soft(SKIN);
  const mTaper = taperMaterial(soft(SKIN));
  const mPad = soft(PAD, { roughness: 0.7 });
  const mCuff = soft(CUFF, { roughness: 0.55, sheenColor: new THREE.Color('#fff4d6') });
  const mBand = soft(BAND, { roughness: 0.75 });

  const gSph = new THREE.SphereGeometry(1, 28, 18);
  const gCyl = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  const aR = new THREE.InstancedBufferAttribute(new Float32Array(BONES.length * 2), 2);
  gCyl.setAttribute('aR', aR);
  const joints = new THREE.InstancedMesh(gSph, mSkin, 21);
  const bones = new THREE.InstancedMesh(gCyl, mTaper, BONES.length);
  joints.frustumCulled = bones.frustumCulled = false;
  const slab = new THREE.Mesh(gSph, mSkin);
  const pad = new THREE.Mesh(gSph, mPad);
  const gCuff = cuffGeometry(0.46, 0.21, 0.1);
  const gBand = cuffGeometry(0.39, 0.1, 0.06);
  const cuff = new THREE.Mesh(gCuff, mCuff);
  const band = new THREE.Mesh(gBand, mBand);
  for (const m of [slab, pad, cuff, band]) m.matrixAutoUpdate = false;
  scene.add(joints, bones, slab, pad, cuff, band);
  const proc = [joints, bones, slab, pad];

  // ---- (A) mô hình có xương da (tải lười, cả hai bàn tay — ~95 KB mỗi tệp)
  const models = { left: null, right: null };
  let loadFailed = false;
  const mModel = soft(SKIN);
  mModel.onBeforeCompile = (sh) => {
    // "phồng" dọc pháp tuyến (trong không gian tư thế gốc, trước khi gắn xương) — ngón mập, tròn như đất sét
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * 0.0032;');
  };
  const loader = new GLTFLoader();
  const fr = (ref, dir, out) => {
    // khung đốt: y = hướng đốt, x = trục tham chiếu vuông góc với đốt, z = x × y
    const x = ex.copy(ref).addScaledVector(dir, -ref.dot(dir));
    if (x.lengthSq() < 1e-8) x.set(1, 0, 0).addScaledVector(dir, -dir.x);
    x.normalize();
    const z = ez.crossVectors(x, dir).normalize();
    return out.setFromRotationMatrix(m4.makeBasis(x, dir, z));
  };
  const HF = { q: null, e1: new THREE.Vector3(), e3: new THREE.Vector3() };
  const dirTmp = new THREE.Vector3();
  function handFrame(pos, out) {
    // khung bàn tay: e2 = cổ tay → khớp gốc ngón giữa, e1 = khớp gốc ngón út → ngón trỏ (vuông góc e2), e3 = e1 × e2
    const e2 = ey.subVectors(pos[jIdx.middleProx], pos[0]).normalize();
    const e1 = ex.subVectors(pos[jIdx.indexProx], pos[jIdx.pinkyProx]);
    e1.addScaledVector(e2, -e1.dot(e2)).normalize();
    const e3 = ez.crossVectors(e1, e2).normalize();
    HF.e1.copy(e1);
    HF.e3.copy(e3);
    HF.q = out.setFromRotationMatrix(m4.makeBasis(e1, e2, e3));
    return HF;
  }
  const jIdx = { middleProx: JOINTS.findIndex((j) => j[0] === 'middle-finger-phalanx-proximal'), indexProx: JOINTS.findIndex((j) => j[0] === 'index-finger-phalanx-proximal'), pinkyProx: JOINTS.findIndex((j) => j[0] === 'pinky-finger-phalanx-proximal') };
  const dirOf = (pos, j) => {
    const nx = JOINTS[j][2];
    return nx === -2 ? v.subVectors(pos[j], pos[j - 1]).normalize() : v.subVectors(pos[nx], pos[j]).normalize();
  };
  function setupModel(g) {
    let skinned = null;
    g.scene.traverse((o) => {
      if (o.isSkinnedMesh) skinned = o;
    });
    if (!skinned) throw new Error('không thấy lưới có xương');
    skinned.material = mModel;
    skinned.frustumCulled = false;
    const bonesM = JOINTS.map(([name]) => g.scene.getObjectByName(name));
    if (bonesM.some((b) => !b)) throw new Error('thiếu khớp');
    const arm = bonesM[0].parent;
    const bindPos = bonesM.map((b) => b.position.clone());
    const bindQ = bonesM.map((b) => b.quaternion.clone());
    const unit = bindPos[jIdx.middleProx].distanceTo(bindPos[0]); // cổ tay → khớp gốc ngón giữa (m)
    // khớp gốc bàn tay: tỉ lệ dọc cổ tay → khớp gốc ngón (theo mô hình)
    const metaT = JOINTS.map((j, k) => (j[1] === -1 ? bindPos[0].distanceTo(bindPos[k]) / bindPos[0].distanceTo(bindPos[k + 1]) : 0));
    const H0 = handFrame(bindPos, new THREE.Quaternion());
    const H = { q: H0.q.clone(), e1: H0.e1.clone(), e3: H0.e3.clone() };
    const qa = new THREE.Quaternion();
    const conj = JOINTS.map((j, k) => {
      if (k === 0) return H.q.clone().invert().multiply(bindQ[0]);
      const ref = j[3] === 'n' ? H.e3 : H.e1;
      return fr(ref, dirOf(bindPos, k).clone(), qa).clone().invert().multiply(bindQ[k]);
    });
    arm.scale.setScalar(1 / unit);
    arm.updateMatrixWorld(true);
    g.scene.visible = false;
    scene.add(g.scene);
    return { root: g.scene, arm, bones: bonesM, conj, unit, metaT, pos: bindPos.map((p) => p.clone()) };
  }
  for (const side of ['left', 'right']) {
    loader.load(
      HAND_URL(side),
      (g) => {
        if (dead) return;
        try {
          models[side] = setupModel(g);
        } catch (e) {
          loadFailed = true;
          console.warn('[tutorial-hand3d] mô hình bàn tay hỏng:', e?.message ?? e);
        }
      },
      undefined,
      () => {
        loadFailed = true;
      },
    );
  }
  let side = 'right';
  const qH = new THREE.Quaternion();
  const qF = new THREE.Quaternion();
  /** Đặt tư thế cho mô hình (điểm P — đơn vị bàn tay, đã tính ở pose()). */
  function poseModel(m) {
    const pos = m.pos;
    JOINTS.forEach((j, k) => {
      if (j[1] >= 0) pos[k].copy(P[j[1]]);
    });
    JOINTS.forEach((j, k) => {
      if (j[1] === -1) pos[k].copy(P[0]).lerp(P[j[4]], m.metaT[k]);
    });
    const H = handFrame(pos, qH);
    JOINTS.forEach((j, k) => {
      const b = m.bones[k];
      b.position.copy(pos[k]).multiplyScalar(m.unit);
      if (k === 0) b.quaternion.copy(H.q).multiply(m.conj[0]);
      else b.quaternion.copy(fr(j[3] === 'n' ? H.e3 : H.e1, dirTmp.copy(dirOf(pos, k)), qF)).multiply(m.conj[k]);
    });
    m.root.updateMatrixWorld(true);
  }

  const P = Array.from({ length: 21 }, () => new THREE.Vector3());
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const ex = new THREE.Vector3();
  const ey = new THREE.Vector3();
  const ez = new THREE.Vector3(0, 0, 1);
  const b1 = new THREE.Vector3();
  const b2 = new THREE.Vector3();
  const b3 = new THREE.Vector3();
  const b4 = new THREE.Vector3();
  let renders = 0;
  let lastFlex = null;
  const drawLog = []; // DEV / đo: [thời điểm, nơi vẽ ('live' | 'demo'), ms]
  let msSum = 0;
  let msMax = 0;
  let dead = false;

  function pose(pts, u) {
    // tâm lòng bàn tay (cổ tay + 4 khớp gốc) → gốc toạ độ, đổi về đơn vị bàn tay (÷ u); y lên trên (ảnh: y xuống)
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const i of [0, 5, 9, 13, 17]) {
      cx += pts[i][0] / 5;
      cy += pts[i][1] / 5;
      cz += (pts[i][2] ?? 0) / 5;
    }
    for (let i = 0; i < 21; i++) P[i].set((pts[i][0] - cx) / u, -(pts[i][1] - cy) / u - DY, ((pts[i][2] ?? 0) - cz) / u);
    lastFlex = solveFingers(P); // (r69g) ngón chỉ gập về phía lòng bàn tay
    // khớp
    for (let i = 0; i < 21; i++) {
      m4.compose(P[i], q.identity(), s.setScalar(R[i]));
      joints.setMatrixAt(i, m4);
    }
    joints.instanceMatrix.needsUpdate = true;
    // nang thon
    BONES.forEach(([a, b], k) => {
      v.subVectors(P[b], P[a]);
      const len = Math.max(1e-4, v.length());
      q.setFromUnitVectors(UP, v.multiplyScalar(1 / len));
      m4.compose(ex.addVectors(P[a], P[b]).multiplyScalar(0.5), q, s.set(1, len, 1));
      bones.setMatrixAt(k, m4);
      aR.setXY(k, R[a], R[b]);
    });
    bones.instanceMatrix.needsUpdate = true;
    aR.needsUpdate = true;
    // khối dẹt lấp giữa lòng bàn tay + đệm lòng bàn tay (sáng hơn, nhô về phía người xem)
    ey.subVectors(P[9], P[0]);
    const hl = ey.length();
    ey.normalize();
    ex.subVectors(P[17], P[5]);
    const hw = ex.length();
    ex.addScaledVector(ey, -ex.dot(ey)).normalize();
    const zn = v.crossVectors(ex, ey).normalize();
    if (zn.z < 0) zn.negate();
    const mid = s.copy(P[0]).lerp(P[9], 0.5); // (r69g: trước đây .add(v.set(0,0,0)) xoá luôn pháp tuyến zn — cùng biến v)
    m4.makeBasis(b1.copy(ex).multiplyScalar(hw * 0.62 + 0.12), b2.copy(ey).multiplyScalar(hl * 0.5 + 0.08), b3.copy(zn).multiplyScalar(0.2));
    m4.setPosition(mid);
    slab.matrix.copy(m4);
    m4.makeBasis(b1.copy(ex).multiplyScalar(hw * 0.42 + 0.06), b2.copy(ey).multiplyScalar(hl * 0.36), b3.copy(zn).multiplyScalar(0.1));
    m4.setPosition(b4.copy(mid).addScaledVector(ey, -0.04).addScaledVector(zn, 0.13));
    pad.matrix.copy(m4);
    // cổ tay áo: dọc cẳng tay (từ khớp gốc ngón giữa → cổ tay, đi tiếp)
    const fw = v.subVectors(P[0], P[9]).normalize();
    q.setFromUnitVectors(UP, fw);
    cuff.matrix.compose(ex.copy(P[0]).addScaledVector(fw, 0.4), q, s.setScalar(1));
    band.matrix.compose(ex.copy(P[0]).addScaledVector(fw, 0.16), q, s.setScalar(1));
  }

  return {
    /**
     * Vẽ bàn tay (pts: 21 × [x, y, z], đơn vị bất kỳ, z dương = về phía người xem) lên ctx 2D: tâm lòng bàn tay ở (cx, cy) px,
     * k px / đơn vị của pts, độ đậm alpha.
     */
    draw(ctx, pts, cx, cy, k, alpha = 1) {
      if (dead || !pts || pts.length < 21) return;
      const t0 = performance.now();
      const u = Math.hypot(pts[9][0] - pts[0][0], pts[9][1] - pts[0][1], (pts[9][2] ?? 0) - (pts[0][2] ?? 0)) || 1;
      pose(pts, u);
      // (A) nếu đã có mô hình đúng tay (tay trái / phải theo chiều khung bàn tay trên ảnh đã lật gương — lòng bàn tay hướng về
      // người xem — tay phải thì ngón cái ở bên phải): (cổ tay → gốc ngón trỏ) × (cổ tay → gốc ngón út), y lên, > 0 = tay phải
      const cz2 = (P[5].x - P[0].x) * (P[17].y - P[0].y) - (P[5].y - P[0].y) * (P[17].x - P[0].x);
      if (Math.abs(cz2) > 0.02) side = cz2 > 0 ? 'right' : 'left';
      const m = models[side];
      for (const o of proc) o.visible = !m;
      if (models.left) models.left.root.visible = m === models.left;
      if (models.right) models.right.root.visible = m === models.right;
      if (m) poseModel(m);
      renderer.render(scene, cam);
      const half = S * k * u;
      ctx.globalAlpha = alpha;
      // (tâm lòng bàn tay nằm DY dưới tâm ảnh → tâm ảnh đặt DY phía trên (cx, cy))
      ctx.drawImage(renderer.domElement, cx - half, cy - DY * k * u - half, 2 * half, 2 * half);
      ctx.globalAlpha = 1;
      const t1 = performance.now();
      const ms = t1 - t0;
      drawLog.push([+t1.toFixed(1), ctx.canvas?.classList?.contains('cin-tut__skel') ? 'live' : 'demo', +ms.toFixed(3)]);
      if (drawLog.length > 600) drawLog.shift();
      renders++;
      msSum += ms;
      msMax = Math.max(msMax, ms);
    },
    drawLog: () => drawLog.slice(),
    stats: () => ({ flex: lastFlex, renders, totalMs: +msSum.toFixed(2), avgMs: renders ? +(msSum / renders).toFixed(3) : 0, maxMs: +msMax.toFixed(3), model: models[side] ? `gltf-${side}` : loadFailed ? 'procedural (tải lỗi)' : 'procedural', loaded: { left: !!models.left, right: !!models.right } }),
    resetStats() {
      renders = 0;
      msSum = 0;
      msMax = 0;
    },
    dispose() {
      if (dead) return;
      dead = true;
      for (const g of [gSph, gCyl, gCuff, gBand]) g.dispose();
      for (const m of [mSkin, mTaper, mPad, mCuff, mBand, mModel]) m.dispose();
      for (const md of Object.values(models)) {
        md?.root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
        });
      }
      joints.dispose();
      bones.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      counts.disposed++;
    },
  };
}
