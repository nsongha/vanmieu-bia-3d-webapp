// Điện ảnh › MẶT BỤC GỢN NHẸ (r63 — người dùng: "bề mặt bục đang phẳng tuyệt đối. tôi muốn nhăn nhẹ mà không ảnh hưởng tới
// performance, render. cho các điều chỉnh vào settings.").
//
// Lòng bục (chỗ rùa đứng) là một gương phẳng nét (stage/reflect.js — reflective-floor.js, REFLECT_SHARP) cộng lên mặt đá /
// kính đen (pedestal.js dishMat). Muốn nó như đá mài tay / sơn mài không phẳng tuyệt đối: MỘT bản đồ pháp tuyến nhỏ, lát
// kín (RIPPLE_TEX², nhiễu gradient fBm 4 quãng, dựng MỘT lần bằng JS lúc cần — không tải gì), có mipmap (xa / sượt thì tự
// dịu, không lấp lánh khi camera đi). Dùng ở hai chỗ, mỗi chỗ đúng MỘT lần đọc texture thêm:
//   · gương lòng bục: lệch toạ độ đọc ảnh phản chiếu theo pháp tuyến (≤ RIPPLE_REFL_PX điểm ảnh thiết bị ở độ nhăn 1) →
//     ảnh bia / rùa trong lòng bục gợn rất nhẹ;
//   · vật liệu lòng bục: nghiêng pháp tuyến (≤ RIPPLE_NORMAL_K ở độ nhăn 1) → chấm phản xạ đèn / môi trường vỡ nhẹ.
// Không thêm lượt vẽ, không chia nhỏ lưới, không đổi nhịp vẽ theo yêu cầu (tĩnh khi rảnh). Độ nhăn 0 → nhánh gợn bị bỏ qua
// (đúng như trước r63, từng điểm ảnh). Hai chỗ dùng CÙNG toạ độ vân (mét, trong hệ của bục) → gợn của ảnh phản chiếu và của
// chấm đèn trùng nhau.
// (Ngoài lòng bục, mặt trên của bục là dải sáng + mặt vát chữ khắc có bản đồ pháp tuyến riêng — không gợn ở đó, kẻo lẫn với
// nét chữ.)
//
// Cài đặt: pedestalRipple (0..1 — "Độ nhăn"), pedestalRippleSize (0..1 — "Kích thước gợn": mịn → rộng, rippleSizeM),
// pedestalRippleDrift ("Chuyển động nhẹ": vân trôi rất chậm — CHỈ nhích ở những khung đang vẽ vì lý do khác, không bao giờ tự
// xin vẽ; rảnh thì đứng yên, vẽ lại thì đi tiếp từ chỗ cũ — không nhảy).
import * as THREE from 'three';
import { rippleSizeM } from '../../core/settings.js';

export { rippleSizeM }; // "Kích thước gợn" (0..1) → cạnh ô vân (m) — settings.js (RIPPLE_SIZE_RANGE_M: ô 10 cm → 1 m, gợn ~3 cm → ~33 cm)
/** Cạnh bản đồ pháp tuyến (điểm ảnh) — lát kín. */
export const RIPPLE_TEX = 256;
/** Độ lệch lớn nhất của ảnh phản chiếu (điểm ảnh thiết bị) ở độ nhăn 1. */
export const RIPPLE_REFL_PX = 16;
/** Độ nghiêng pháp tuyến lớn nhất (tan) ở độ nhăn 1. */
export const RIPPLE_NORMAL_K = 0.5;
/** Tốc độ trôi (ô vân / giây) khi bật "Chuyển động nhẹ" — rất chậm. */
export const RIPPLE_DRIFT = 0.025;

/** Nhiễu gradient (Perlin) fBm lát kín → độ dốc (dh/du, dh/dv) chuẩn hoá về [−1, 1], ghi vào RG (B = 1, A = 1). */
function buildRipple(N) {
  const h = new Float32Array(N * N);
  // (tần số theo số ô trên một cạnh lát, biên độ) — độ DỐC của mỗi quãng ∝ tần số × biên độ: quãng thấp (độ lượn rộng) trội,
  // quãng cao chỉ đủ phá độ trơn tuyệt đối — không thành vân xước / "kim loại chải". Gradient (không phải nhiễu giá trị):
  // không lộ ô vuông của lưới.
  const OCT = [[3, 1], [6, 0.32], [12, 0.09], [24, 0.025]];
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  for (const [f, a] of OCT) {
    const gx = new Float32Array(f * f);
    const gy = new Float32Array(f * f);
    for (let i = 0; i < f * f; i++) {
      const t = rnd() * Math.PI * 2;
      gx[i] = Math.cos(t);
      gy[i] = Math.sin(t);
    }
    const dot = (ci, cj, dx, dy) => {
      const k = (cj % f) * f + (ci % f);
      return gx[k] * dx + gy[k] * dy;
    };
    for (let y = 0; y < N; y++) {
      const v = (y / N) * f;
      const j0 = Math.floor(v);
      const fy = v - j0;
      const sv = fade(fy);
      for (let x = 0; x < N; x++) {
        const u = (x / N) * f;
        const i0 = Math.floor(u);
        const fx = u - i0;
        const su = fade(fx);
        const n00 = dot(i0, j0, fx, fy);
        const n10 = dot(i0 + 1, j0, fx - 1, fy);
        const n01 = dot(i0, j0 + 1, fx, fy - 1);
        const n11 = dot(i0 + 1, j0 + 1, fx - 1, fy - 1);
        const top = n00 + (n10 - n00) * su;
        const bot = n01 + (n11 - n01) * su;
        h[y * N + x] += a * (top + (bot - top) * sv);
      }
    }
  }
  // độ dốc lát kín (sai phân trung tâm, bọc mép)
  const gx = new Float32Array(N * N);
  const gy = new Float32Array(N * N);
  let m = 1e-9;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
      const dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
      gx[i] = dx;
      gy[i] = dy;
      m = Math.max(m, Math.hypot(dx, dy));
    }
  }
  const data = new Uint8Array(N * N * 4);
  const k = 1 / m;
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = Math.round((gx[i] * k * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((gy[i] * k * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  return data;
}

let shared = null;
/** Bản đồ pháp tuyến dùng chung (dựng lười, một lần mỗi trang). renderer: để đặt lọc bất đẳng hướng (nếu có). */
export function rippleTexture(renderer = null) {
  if (shared) return shared;
  const tex = new THREE.DataTexture(buildRipple(RIPPLE_TEX), RIPPLE_TEX, RIPPLE_TEX, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.name = 'cinema-pedestal-ripple';
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter; // xa / sượt: vân dịu dần theo mipmap — không lấp lánh khi camera đi
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
  tex.needsUpdate = true;
  shared = tex;
  return tex;
}
