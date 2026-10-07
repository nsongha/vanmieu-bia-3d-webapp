// Hạt phim (film grain): sinh 1 ô nhiễu 128×128 bằng canvas, dùng lại cho mọi lần mount.
let cached = null;

/** @returns {string} data URL của ô nhiễu xám (alpha đặc, độ mờ do CSS quyết định). */
export function grainTile() {
  if (cached) return cached;
  const S = 128;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: false });
    const img = g.createImageData(S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // Nhiễu quanh mức xám trung tính (128) để blend "overlay" gần như không đổi màu.
      const v = 108 + ((Math.random() * 40) | 0);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    cached = cv.toDataURL('image/png');
  } catch {
    cached = '';
  }
  return cached;
}
