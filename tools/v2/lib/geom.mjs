// Model pipeline v2 — hình học: hàn, giản lược, pháp tuyến, tiếp tuyến, lượng tử hoá, ước lượng bộ nhớ GPU.
// Mọi hàm làm việc trên mảng thô (Float32Array / Uint32Array), không phụ thuộc Document — trừ creaseNormals()
// (dựng Primitive tạm để dùng lại NGUYÊN VĂN smoothPrimitive() của tools/smooth-normals.mjs).

import fs from 'node:fs';

import { Document, Primitive } from '@gltf-transform/core';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { generateTangents } from 'mikktspace';

import { smoothPrimitive } from '../../smooth-normals.mjs';

// ---------------------------------------------------------------------------------------------------------------------
// Hàn / nén chỉ số
// ---------------------------------------------------------------------------------------------------------------------

/** Hàn các đỉnh có (vị trí, UV) giống hệt từng bit. Bỏ tam giác suy biến (hai đỉnh trùng VỊ TRÍ). */
export function weldPosUv(P, UV, I) {
  const n = P.length / 3;
  const pu = new Uint32Array(P.buffer, P.byteOffset, P.length);
  const uu = new Uint32Array(UV.buffer, UV.byteOffset, UV.length);
  const map = new Map();
  const remap = new Uint32Array(n);
  const keep = [];
  for (let i = 0; i < n; i++) {
    const key = `${pu[i * 3]},${pu[i * 3 + 1]},${pu[i * 3 + 2]},${uu[i * 2]},${uu[i * 2 + 1]}`;
    let w = map.get(key);
    if (w === undefined) {
      w = keep.length;
      map.set(key, w);
      keep.push(i);
    }
    remap[i] = w;
  }
  const m = keep.length;
  const P2 = new Float32Array(m * 3);
  const UV2 = new Float32Array(m * 2);
  for (let u = 0; u < m; u++) {
    const i = keep[u];
    P2[u * 3] = P[i * 3];
    P2[u * 3 + 1] = P[i * 3 + 1];
    P2[u * 3 + 2] = P[i * 3 + 2];
    UV2[u * 2] = UV[i * 2];
    UV2[u * 2 + 1] = UV[i * 2 + 1];
  }
  const I2 = new Uint32Array(I.length);
  let k = 0;
  let degenerate = 0;
  const same = (a, b) => P2[a * 3] === P2[b * 3] && P2[a * 3 + 1] === P2[b * 3 + 1] && P2[a * 3 + 2] === P2[b * 3 + 2];
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]];
    const b = remap[I[t + 1]];
    const c = remap[I[t + 2]];
    if (same(a, b) || same(b, c) || same(a, c)) {
      degenerate++;
      continue;
    }
    I2[k++] = a;
    I2[k++] = b;
    I2[k++] = c;
  }
  return { P: P2, UV: UV2, I: I2.slice(0, k), degenerate };
}

/** Giữ lại các đỉnh được tam giác dùng tới (thứ tự đỉnh theo lần xuất hiện đầu — tất định). */
export function compact(P, UV, I) {
  const idx = I.slice();
  const [remap, unique] = MeshoptSimplifier.compactMesh(idx);
  const P2 = new Float32Array(unique * 3);
  const UV2 = UV ? new Float32Array(unique * 2) : null;
  for (let v = 0; v < remap.length; v++) {
    const nv = remap[v];
    if (nv === 0xffffffff || nv >= unique) continue;
    P2[nv * 3] = P[v * 3];
    P2[nv * 3 + 1] = P[v * 3 + 1];
    P2[nv * 3 + 2] = P[v * 3 + 2];
    if (UV2) {
      UV2[nv * 2] = UV[v * 2];
      UV2[nv * 2 + 1] = UV[v * 2 + 1];
    }
  }
  return { P: P2, UV: UV2, I: idx };
}

/**
 * Giản lược tới ~targetTris tam giác (meshoptimizer, không di chuyển đỉnh → mọi LOD dùng CHUNG tập vị trí của bản
 * đầy đủ). Đường cắt UV được giữ (meshopt nhận ra đỉnh tách theo UV cùng vị trí = seam, chỉ gộp dọc theo seam).
 * @returns {{ I: Uint32Array, error: number }} error = sai số hình học tuyệt đối (đơn vị mô hình, bia cao 1)
 */
export function simplifyTo(P, I, targetTris) {
  if (I.length / 3 <= targetTris) return { I: I.slice(), error: 0 };
  const [out, err] = MeshoptSimplifier.simplify(I, P, 3, Math.floor(targetTris) * 3, 0.05, []);
  return { I: out, error: err * MeshoptSimplifier.getScale(P, 3) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Pháp tuyến: dùng lại smoothPrimitive() (v1). Nó giả định đầu vào tách theo mặt (bản quét gốc) — nên ta tách thành
// từng góc tam giác trước, rồi để nó hàn lại theo (vị trí, UV, pháp tuyến).
// ---------------------------------------------------------------------------------------------------------------------

/**
 * @param {number} creaseDeg 25 = như v1 (smooth-normals.mjs); 180 = mượt hoàn toàn (không tách đỉnh ở cạnh gãy);
 *   0 = phẳng từng mặt (như bản quét gốc).
 * @returns {{ P: Float32Array, UV: Float32Array|null, N: Float32Array, I: Uint32Array }}
 */
export function creaseNormals(P, UV, I, creaseDeg) {
  const nc = I.length;
  const Pc = new Float32Array(nc * 3);
  const UVc = UV ? new Float32Array(nc * 2) : null;
  for (let c = 0; c < nc; c++) {
    const v = I[c];
    Pc[c * 3] = P[v * 3];
    Pc[c * 3 + 1] = P[v * 3 + 1];
    Pc[c * 3 + 2] = P[v * 3 + 2];
    if (UVc) {
      UVc[c * 2] = UV[v * 2];
      UVc[c * 2 + 1] = UV[v * 2 + 1];
    }
  }
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setAttribute('POSITION', doc.createAccessor().setBuffer(buf).setType('VEC3').setArray(Pc))
    .setAttribute('NORMAL', doc.createAccessor().setBuffer(buf).setType('VEC3').setArray(new Float32Array(nc * 3)))
    .setIndices(doc.createAccessor().setBuffer(buf).setType('SCALAR').setArray(Uint32Array.from({ length: nc }, (_, i) => i)));
  if (UVc) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setBuffer(buf).setType('VEC2').setArray(UVc));
  if (creaseDeg <= 0) {
    // phẳng: pháp tuyến mặt cho từng góc (không gọi smoothPrimitive)
    const N = new Float32Array(nc * 3);
    for (let t = 0; t < nc; t += 3) {
      const n = faceNormal(Pc, t, t + 1, t + 2);
      for (let k = 0; k < 3; k++) N.set(n, (t + k) * 3);
    }
    return { P: Pc, UV: UVc, N, I: Uint32Array.from({ length: nc }, (_, i) => i) };
  }
  smoothPrimitive(prim, { creaseDeg });
  const I2 = prim.getIndices().getArray();
  return {
    P: prim.getAttribute('POSITION').getArray(),
    UV: UVc ? prim.getAttribute('TEXCOORD_0').getArray() : null,
    N: prim.getAttribute('NORMAL').getArray(),
    I: I2 instanceof Uint32Array ? I2 : Uint32Array.from(I2),
  };
}

function faceNormal(P, a, b, c) {
  const e1x = P[b * 3] - P[a * 3], e1y = P[b * 3 + 1] - P[a * 3 + 1], e1z = P[b * 3 + 2] - P[a * 3 + 2];
  const e2x = P[c * 3] - P[a * 3], e2y = P[c * 3 + 1] - P[a * 3 + 1], e2z = P[c * 3 + 2] - P[a * 3 + 2];
  const x = e1y * e2z - e1z * e2y, y = e1z * e2x - e1x * e2z, z = e1x * e2y - e1y * e2x;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// ---------------------------------------------------------------------------------------------------------------------
// Lượng tử hoá (KHR_mesh_quantization) — khung node chung cho MỌI LOD của một bia.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Khung lượng tử: node TRS = (t, identity, s·1). Chọn từ bbox của bản đầy đủ (chứa mọi LOD vì giản lược không dời
 * đỉnh). Bia cao đúng 1 và rộng ≤ 1 → s = 0.5, t.y = 0.5 → y = 0 và y = 1 lượng tử CHÍNH XÁC (±32767).
 */
export function quantFrame(P) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (P[i + k] < min[k]) min[k] = P[i + k];
      if (P[i + k] > max[k]) max[k] = P[i + k];
    }
  }
  const half = [0, 1, 2].map((k) => (max[k] - min[k]) / 2);
  const s = Math.fround(Math.max(0.5, ...half));
  const t = [0, 1, 2].map((k) => Math.fround((min[k] + max[k]) / 2));
  if (Math.abs(min[1]) < 1e-6 && Math.abs(max[1] - 1) < 1e-6) t[1] = 0.5;
  return { t, r: [0, 0, 0, 1], s: [s, s, s], bbox: { min, max } };
}

export const snorm16 = (f) => Math.round(Math.max(-1, Math.min(1, f)) * 32767);
export const unsnorm16 = (q) => Math.max(q / 32767, -1);
export const snorm8 = (f) => Math.round(Math.max(-1, Math.min(1, f)) * 127);
export const unsnorm8 = (q) => Math.max(q / 127, -1);
export const unorm16 = (f) => Math.round(Math.max(0, Math.min(1, f)) * 65535);

/**
 * Pháp tuyến → Int16 chuẩn hoá, chỉ `bits` bit hiệu dụng ở phần CAO, bit thấp = 0 (meshopt nén delta theo byte → byte
 * thấp toàn 0 nén gần như miễn phí). Độ dài vectơ giải lượng tử < 1 một chút — shader chuẩn hoá lại, hướng không đổi.
 */
export function snormBits(f, bits = 10) {
  const scale = 2 ** (bits - 1) - 1;
  const q = Math.round(Math.max(-1, Math.min(1, f)) * scale);
  return q * 2 ** (16 - bits);
}

/** UV [0,1] → Uint16 chuẩn hoá, `bits` bit hiệu dụng, bit thấp = 0 (14 bit ≈ 0,06 texel ở 4096). */
export function unormBits(f, bits = 14) {
  const q = Math.round(Math.max(0, Math.min(1, f)) * (2 ** bits - 1));
  return q * 2 ** (16 - bits);
}

/**
 * Pháp tuyến qua đúng đường meshopt FILTER/OCTAHEDRAL 8 bit (gltf-transform EXT_meshopt_compression method=filter):
 * mã hoá bằng encoder thật rồi giải như bộ giải của three.js (meshopt_decoder: tái dựng z, chuẩn hoá, làm tròn về
 * int8) → trả Int8Array xyz đúng giá trị GPU sẽ thấy. Bake / tiếp tuyến dùng chính giá trị này.
 */
export function octRoundTrip8(N) {
  const n = N.length / 3;
  const src = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; // pháp tuyến nguồn (bake sẵn) có thể chưa đơn vị
    src[i * 4] = N[i * 3] / l;
    src[i * 4 + 1] = N[i * 3 + 1] / l;
    src[i * 4 + 2] = N[i * 3 + 2] / l;
  }
  const enc = new Int8Array(MeshoptEncoder.encodeFilterOct(src, n, 4, 8).buffer);
  const out = new Int8Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = enc[i * 4];
    let y = enc[i * 4 + 1];
    const z = enc[i * 4 + 2] - Math.abs(x) - Math.abs(y);
    const t = z >= 0 ? 0 : z;
    x += x >= 0 ? t : -t;
    y += y >= 0 ? t : -t;
    const l = Math.hypot(x, y, z) || 1;
    const sc = 127 / l;
    out[i * 3] = Math.round(x * sc);
    out[i * 3 + 1] = Math.round(y * sc);
    out[i * 3 + 2] = Math.round(z * sc);
  }
  return out;
}

/**
 * Lượng tử toàn bộ đỉnh; trả mảng số nguyên + mảng float đã GIẢI lượng tử (đúng giá trị GPU thấy) để bake/tiếp tuyến.
 * UV ngoài [0,1] → giữ float (báo lại).
 */
export function quantizeVerts(frame, P, N, UV, { uvBits = 14 } = {}) {
  const n = P.length / 3;
  const Pq = new Int16Array(n * 3);
  const Pd = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const q = snorm16((P[i * 3 + k] - frame.t[k]) / frame.s[k]);
      Pq[i * 3 + k] = q;
      Pd[i * 3 + k] = Math.fround(unsnorm16(q) * frame.s[k] + frame.t[k]);
    }
  }
  let Nq = null;
  let Nd = null;
  if (N) {
    // NORMAL ghi ra = octahedral 8 bit (meshopt filter) → giữ Int8 xyz đúng như GPU giải ra.
    Nq = octRoundTrip8(N);
    Nd = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = unsnorm8(Nq[i * 3]), y = unsnorm8(Nq[i * 3 + 1]), z = unsnorm8(Nq[i * 3 + 2]);
      const l = Math.hypot(x, y, z) || 1;
      Nd[i * 3] = x / l;
      Nd[i * 3 + 1] = y / l;
      Nd[i * 3 + 2] = z / l;
    }
  }
  let UVq = null;
  let UVd = null;
  let uvFloat = false;
  if (UV) {
    for (let i = 0; i < UV.length; i++) if (UV[i] < 0 || UV[i] > 1) uvFloat = true;
    if (uvFloat) {
      UVq = UV;
      UVd = UV;
    } else {
      UVq = new Uint16Array(UV.length);
      UVd = new Float32Array(UV.length);
      for (let i = 0; i < UV.length; i++) {
        UVq[i] = unormBits(UV[i], uvBits);
        UVd[i] = UVq[i] / 65535;
      }
    }
  }
  return { Pq, Pd, Nq, Nd, UVq, UVd, uvFloat };
}

// ---------------------------------------------------------------------------------------------------------------------
// Tiếp tuyến MikkTSpace (khớp bộ bake của Blender) → hàn lại theo mọi thuộc tính.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * @param {object} q kết quả quantizeVerts (dùng giá trị ĐÃ giải lượng tử để tính, lưu bản số nguyên)
 * @returns {{ Pq, Nq, UVq, Tq: Int8Array, I: Uint32Array }}
 */
export function tangentsAndWeld(q, I) {
  const nc = I.length;
  const Pc = new Float32Array(nc * 3);
  const Nc = new Float32Array(nc * 3);
  const UVc = new Float32Array(nc * 2);
  for (let c = 0; c < nc; c++) {
    const v = I[c];
    Pc.set(q.Pd.subarray(v * 3, v * 3 + 3), c * 3);
    Nc.set(q.Nd.subarray(v * 3, v * 3 + 3), c * 3);
    UVc.set(q.UVd.subarray(v * 2, v * 2 + 2), c * 2);
  }
  const T = generateTangents(Pc, Nc, UVc);
  // glTF: đảo dấu w (quy ước UV của glTF — như tangents() của gltf-transform).
  for (let i = 3; i < T.length; i += 4) T[i] *= -1;
  // hàn: khoá = (chỉ số đỉnh gốc, tiếp tuyến lượng tử) — vị trí/pháp tuyến/UV đã xác định bởi chỉ số gốc
  const map = new Map();
  const src = [];
  const tq = [];
  const I2 = new Uint32Array(nc);
  for (let c = 0; c < nc; c++) {
    const t = [snorm8(T[c * 4]), snorm8(T[c * 4 + 1]), snorm8(T[c * 4 + 2]), T[c * 4 + 3] < 0 ? -127 : 127];
    const key = `${I[c]},${t[0]},${t[1]},${t[2]},${t[3]}`;
    let u = map.get(key);
    if (u === undefined) {
      u = src.length;
      map.set(key, u);
      src.push(I[c]);
      tq.push(t);
    }
    I2[c] = u;
  }
  const m = src.length;
  const Pq = new Int16Array(m * 3);
  const Nq = new Int8Array(m * 3);
  const UVq = new (q.UVq.constructor)(m * 2);
  const Tq = new Int8Array(m * 4);
  for (let u = 0; u < m; u++) {
    const v = src[u];
    Pq.set(q.Pq.subarray(v * 3, v * 3 + 3), u * 3);
    Nq.set(q.Nq.subarray(v * 3, v * 3 + 3), u * 3);
    UVq.set(q.UVq.subarray(v * 2, v * 2 + 2), u * 2);
    Tq.set(tq[u], u * 4);
  }
  return { Pq, Nq, UVq, Tq, I: I2 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bộ nhớ GPU ước lượng
// ---------------------------------------------------------------------------------------------------------------------

/** Byte GPU của một accessor đỉnh (WebGL tải nguyên mảng; glTF căn phần tử 4 byte). */
export function attrGpuBytes(count, componentBytes, components) {
  return count * Math.ceil((componentBytes * components) / 4) * 4;
}

/** Texture nén khối 1 byte/px (UASTC → BC7 / ASTC 4×4), + chuỗi mip (×4/3). */
export function texGpuBytes(w, h, bytesPerPx = 1, mips = true) {
  let total = 0;
  let a = w;
  let b = h;
  for (;;) {
    total += Math.max(4, a) * Math.max(4, b) * bytesPerPx;
    if (!mips || (a === 1 && b === 1)) break;
    a = Math.max(1, a >> 1);
    b = Math.max(1, b >> 1);
  }
  return total;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lưu / đọc mảng thô (bộ nhớ đệm giữa các bước — cho phép chạy tiếp)
// ---------------------------------------------------------------------------------------------------------------------

const TYPES = { Float32Array, Uint32Array, Uint16Array, Int16Array, Int8Array, Uint8Array };

export function saveArrays(file, obj, meta = {}) {
  const head = { meta, arrays: [] };
  const parts = [];
  let off = 0;
  for (const [name, arr] of Object.entries(obj)) {
    if (!arr) continue;
    const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    head.arrays.push({ name, type: arr.constructor.name, length: arr.length, offset: off });
    parts.push(bytes);
    off += bytes.length;
    const pad = (8 - (off % 8)) % 8;
    if (pad) {
      parts.push(Buffer.alloc(pad));
      off += pad;
    }
  }
  const json = Buffer.from(JSON.stringify(head));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(json.length);
  const jpad = Buffer.alloc((8 - ((4 + json.length) % 8)) % 8);
  fs.writeFileSync(file, Buffer.concat([len, json, jpad, ...parts]));
}

export function loadArrays(file) {
  const buf = fs.readFileSync(file);
  const jl = buf.readUInt32LE(0);
  const head = JSON.parse(buf.subarray(4, 4 + jl).toString('utf8'));
  const base = 4 + jl + ((8 - ((4 + jl) % 8)) % 8);
  const out = { meta: head.meta };
  for (const a of head.arrays) {
    const T = TYPES[a.type];
    const start = base + a.offset;
    const copy = new Uint8Array(buf.subarray(start, start + a.length * T.BYTES_PER_ELEMENT));
    out[a.name] = new T(copy.buffer, 0, a.length);
  }
  return out;
}
