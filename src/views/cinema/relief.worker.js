// Worker dựng bản đồ PHÁP TUYẾN + MÀU cho chữ khắc nổi trên mặt vát của bục (relief.js).
// Nhận mặt nạ chữ (trắng trên đen, có khử răng cưa; hàng 0 = mép TRÊN dải) — dạng ImageBitmap của canvas
// chữ (đọc điểm ảnh NGAY TRONG worker: luồng chính chỉ vẽ chữ) hoặc mảng 1 kênh — trả về hai mảng RGBA đã
// lật hàng (hàng 0 = v = 0 = mép DƯỚI dải) để dùng thẳng làm DataTexture (flipY = false).
//
// r7 — TRƯỜNG KHOẢNG CÁCH thay cho "làm mềm rồi Sobel":
//   · biến đổi khoảng cách Euclid (Felzenszwalb, tách hàng / cột, ĐÚNG đơn vị thế giới: texel theo u và
//     theo v phủ bề rộng thật khác nhau) cho cả trong lẫn ngoài nét; điểm ảnh ở mép (độ phủ 0 < c < 1)
//     lấy khoảng cách dưới texel từ chính độ phủ → mép mượt, không bậc thang;
//   · độ cao = profile(clamp(d / bề rộng gờ + 0,5, 0, 1)) — gờ CĂN GIỮA mép nét (ở nửa độ cao nét đúng
//     bằng nét chữ, đổi độ sắc không làm chữ béo / gầy đi). Bề rộng gờ theo settings.pedestalSharp, dáng
//     mép theo settings.pedestalProfile ('round' tròn · 'bevel' vát thẳng · 'flat' mặt phẳng tường đứng ·
//     'cove' lõm);
//   · Sobel → pháp tuyến không gian tiếp tuyến (u lặp vòng quanh bục, v kẹp ở hai mép);
//   · màu: phần nhô lên (mặt chữ + gờ) màu đá ấm sáng hơn nền; "cavity" trên nền ngay chân gờ tối đi
//     (theo khoảng cách từ chân gờ). Bản đồ màu ra ở nửa bề ngang (mép màu không cần sắc bằng pháp tuyến).

const INF = 1e20;

/** Biến đổi khoảng cách bình phương 1 chiều (Felzenszwalb & Huttenlocher), bước lưới bình phương sp2. */
function edt1d(f, n, sp2, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q * sp2 - (f[v[k]] + v[k] * v[k] * sp2)) / (2 * sp2 * (q - v[k]));
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q * sp2 - (f[v[k]] + v[k] * v[k] * sp2)) / (2 * sp2 * (q - v[k]));
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq * sp2 + f[v[k]];
  }
}

/**
 * Khoảng cách BÌNH PHƯƠNG (đơn vị thế giới) từ mỗi điểm ảnh tới điểm ảnh "hạt giống" gần nhất
 * (seed[i] = 1 → 0). u lặp vòng: đệm `pad` cột mỗi bên lấy từ đầu kia; v kẹp.
 */
function edt2d(seed, w, h, du, dv, pad) {
  const W = w + 2 * pad;
  const n = Math.max(W, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const tmp = new Float64Array(w * h);
  const du2 = du * du;
  const dv2 = dv * dv;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < W; x++) f[x] = seed[row + ((x - pad + w * 4) % w)] ? 0 : INF;
    edt1d(f, W, du2, d, v, z);
    for (let x = 0; x < w; x++) tmp[row + x] = d[x + pad];
  }
  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = tmp[y * w + x];
    edt1d(f, h, dv2, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  return out;
}

/** Dáng mép: t = 0 chân gờ … 1 mặt trên (plateau). */
const PROFILES = {
  // chỏm tròn một phần tư: tường đứng ở chân, vai tròn, mặt trên phẳng
  round: (t) => Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))),
  // vát thẳng
  bevel: (t) => t,
  // mặt phẳng + tường đứng hẹp (như chữ cắt): dốc chỉ trong 30 % giữa bề rộng gờ, hai đầu bo nhẹ
  flat: (t) => {
    const x = Math.min(1, Math.max(0, (t - 0.35) / 0.3));
    return x * x * (3 - 2 * x);
  },
  // lõm: thoải ở chân, dốc dần lên mép trên
  cove: (t) => t * t,
};

self.onmessage = ({ data }) => {
  // su / sv: độ dốc thế giới trên mỗi đơn vị Sobel theo u / v. du / dv: bề rộng thế giới một texel.
  const { id, w, h, height, bitmap, su, sv, du, dv, bevelW, profile, base, tint, cavity } = data;
  try {
    const t0 = performance.now();
    const cov = new Float32Array(w * h);
    if (bitmap) {
      const oc = new OffscreenCanvas(w, h);
      const g = oc.getContext('2d', { willReadFrequently: true });
      if (!g) throw new Error('offscreen-2d');
      g.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const img = g.getImageData(0, 0, w, h).data;
      for (let i = 0; i < cov.length; i++) cov[i] = img[i * 4] / 255;
    } else {
      for (let i = 0; i < cov.length; i++) cov[i] = height[i] / 255;
    }
    const tRead = performance.now();

    // --- trường khoảng cách có dấu (đơn vị thế giới), dương TRONG nét
    const inside = new Uint8Array(w * h);
    const outside = new Uint8Array(w * h);
    for (let i = 0; i < cov.length; i++) {
      const on = cov[i] >= 0.5;
      inside[i] = on ? 1 : 0;
      outside[i] = on ? 0 : 1;
    }
    const reach = Math.max(bevelW, cavity) * 1.5;
    const pad = Math.min(w, Math.ceil(reach / du) + 2);
    const dToOut = edt2d(outside, w, h, du, dv, pad); // điểm TRONG nét → điểm ngoài gần nhất
    const dToIn = edt2d(inside, w, h, du, dv, pad); // điểm NGOÀI nét → điểm trong gần nhất
    const px = 0.5 * (du + dv); // bề rộng một điểm ảnh (xấp xỉ) — nửa texel ở mép
    const sd = new Float32Array(w * h);
    for (let i = 0; i < cov.length; i++) {
      const c = cov[i];
      if (c > 0.02 && c < 0.98) sd[i] = (c - 0.5) * px; // điểm ảnh mép: dưới texel, từ độ phủ
      else if (inside[i]) sd[i] = Math.sqrt(dToOut[i]) - 0.5 * px;
      else sd[i] = -(Math.sqrt(dToIn[i]) - 0.5 * px);
    }
    const tEdt = performance.now();

    // --- độ cao theo dáng mép; gờ căn giữa mép nét
    const prof = PROFILES[profile] ?? PROFILES.round;
    const hgt = new Float32Array(w * h);
    const inv = 1 / Math.max(1e-6, bevelW);
    for (let i = 0; i < hgt.length; i++) hgt[i] = prof(Math.min(1, Math.max(0, sd[i] * inv + 0.5)));

    // --- pháp tuyến (Sobel) + màu
    const normal = new Uint8Array(w * h * 4);
    const cw = w >> 1; // bản đồ màu: nửa bề ngang
    const color = new Uint8Array(cw * h * 4);
    const at = (x, y) => hgt[Math.min(h - 1, Math.max(0, y)) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++) {
      // hàng đích: lật dọc (canvas: hàng 0 ở TRÊN; texture: hàng 0 là v = 0 ở DƯỚI)
      const oy = h - 1 - y;
      for (let x = 0; x < w; x++) {
        // Sobel trong hệ canvas (y xuống) → đổi dấu thành phần dọc để v hướng LÊN.
        const gx =
          at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
        const gyDown =
          at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
        let nx = -gx * su;
        let ny = gyDown * sv;
        let nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        const o = (oy * w + x) * 4;
        normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
        normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        normal[o + 3] = 255;
      }
      // màu ở nửa bề ngang: gộp hai điểm ảnh
      for (let cx = 0; cx < cw; cx++) {
        let m = 0;
        let ao = 0;
        for (let k = 0; k < 2; k++) {
          const i = y * w + 2 * cx + k;
          // mặt chữ = mọi chỗ đã nhô lên (cả phần gờ), mép theo độ cao → không có viền nền tối chạy dọc
          // chân gờ khi gờ rộng (gờ căn giữa mép nét nên nửa dưới của nó nằm NGOÀI nét)
          m += Math.min(1, hgt[i] * 1.25);
          // bóng tiếp xúc: tính từ CHÂN GỜ (không phải mép nét), chỉ trên nền phẳng quanh chữ
          const foot = -sd[i] - 0.5 * bevelW;
          const cav = hgt[i] > 0.001 ? 0 : Math.max(0, 1 - foot / cavity);
          ao += 1 - 0.45 * cav * cav;
        }
        m *= 0.5;
        ao *= 0.5;
        const o = (oy * cw + cx) * 4;
        color[o] = Math.round((base[0] + (tint[0] - base[0]) * m) * ao);
        color[o + 1] = Math.round((base[1] + (tint[1] - base[1]) * m) * ao);
        color[o + 2] = Math.round((base[2] + (tint[2] - base[2]) * m) * ao);
        color[o + 3] = 255;
      }
    }
    const t1 = performance.now();
    self.postMessage(
      {
        id,
        normal,
        color,
        colorW: cw,
        ms: t1 - t0,
        stages: { read: +(tRead - t0).toFixed(1), edt: +(tEdt - tRead).toFixed(1), shade: +(t1 - tEdt).toFixed(1) },
      },
      [normal.buffer, color.buffer],
    );
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
