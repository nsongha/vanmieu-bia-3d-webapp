// Chữ khắc NỔI trên mặt vát của bục, MỘT dòng:
//
//      BIA TIẾN SĨ  •  1661  •  KHOA THI TÂN SỬU ← số năm Bodoni lớn ở giữa; chữ hoa nhỏ hai bên đứng
//                                                  CHUNG đường chân (baseline) với số năm; dấu ngăn
//                                                  canh giữa theo chiều cao chữ hoa, hai bên cách đều
// Mặt sau cùng bố cục ở cỡ 70%: "NĂM DỰNG BIA • {năm dựng} • {NGƯỜI SOẠN VĂN | ĐỢT n}".
// settings.pedestalText (0,4..1) nhân cỡ CẢ CỤM (1 = số năm cao gần kín mặt vát).
// settings.pedestalSep: dấu ngăn 'dot' | 'diamond' | 'dash' | 'bar' | 'space' — vẽ bằng HÌNH (không
// dùng ký tự font) nên nổi đều như chữ.
// Kỹ thuật nhẹ: raster chữ thành MẶT NẠ (canvas 8192 × 256, u = vòng quanh bục, v = dọc theo mặt vát),
// worker dựng trường khoảng cách → độ cao theo dáng mép (settings.pedestalProfile) và bề rộng gờ
// (settings.pedestalSharp) → Sobel ra bản đồ pháp tuyến + bản đồ màu (mặt chữ màu đá ấm sáng hơn nền
// graphite, chân chữ tối đi như bóng tiếp xúc). Chữ bắt ánh đèn như phù điêu thật.
// Độ phân giải (r7): 8192 texel quanh bục ≈ 0,43 mm / texel ở cỡ bục chuẩn (trước: 4096 ≈ 0,86 mm — ở mức
// zoom gần nhất chưa tới 1 texel / điểm ảnh theo chiều ngang nên gờ sắc bị nhoè). Bản đồ màu nửa bề ngang.
// Dựng trong worker, nhớ theo bia (LRU, đếm tham chiếu). r19: HAI làn — "gấp" (bia đích của lần chuyển vừa bấm: không
// chờ lúc yên, worker riêng) và "nền" (cửa sổ ±2 bia quanh bia đang xem, lần lượt từng bia một); việc nền đang chờ mà
// bị xin gấp thì được đẩy lên ngay. Trên luồng chính chỉ còn vẽ chữ, chia 3 lát ≈ 3–4 ms (không tác vụ dài).
// Texture ở đây là DataTexture có dữ liệu CPU; view tự đẩy lên GPU theo dải (stage.js — reliefGpu).
import * as THREE from 'three';
import { ensureFont, FONT } from '../../core/fonts.js';
import { DEFAULTS } from '../../core/settings.js';

export const RELIEF_W = 8192;
export const RELIEF_H = 256;
/** Dáng mép chữ (settings.pedestalProfile) — xem relief.worker.js. */
export const PROFILE_IDS = Object.freeze(['round', 'bevel', 'flat', 'cove']);
// Bề rộng gờ (đơn vị thế giới, gờ căn giữa mép nét) theo độ sắc 0..1 (settings.pedestalSharp), thang log:
// 0 → 6 mm (vai rộng, mềm) … 1 → 0,5 mm (mép sắc, cỡ 1 texel).
const BW_SOFT = 0.006;
const BW_SHARP = 0.0005;
export const bevelWidthFor = (sharp) => BW_SOFT * Math.pow(BW_SHARP / BW_SOFT, Math.min(1, Math.max(0, sharp)));
const CAVITY_W = 0.003; // bóng tiếp xúc quanh chân chữ tắt dần trong ngần này (đơn vị thế giới)
const YEAR_FRAC = 0.87; // chiều cao nét số năm / bề cao dải vát, ở pedestalText = 1
const BACK_SCALE = 0.7; // mặt sau = 70% mặt trước
const WORD_CAP = 0.4; // chiều cao chữ hoa / chiều cao nét số năm
const WORD_TRACK = '0.14em'; // giãn chữ hoa
const SEP_GAP = 0.6; // khe hai bên dấu ngăn / chiều cao chữ hoa (bằng nhau hai bên)
/** Dấu ngăn: bề ngang chiếm chỗ (× chiều cao chữ hoa c) + cách vẽ quanh tâm (0, 0), đơn vị texel dọc. */
const SEPS = {
  dot: { w: 0.34, draw: (g, c) => { g.beginPath(); g.arc(0, 0, 0.17 * c, 0, Math.PI * 2); g.fill(); } },
  diamond: {
    w: 0.46,
    draw: (g, c) => {
      g.beginPath();
      g.moveTo(0, -0.3 * c);
      g.lineTo(0.23 * c, 0);
      g.lineTo(0, 0.3 * c);
      g.lineTo(-0.23 * c, 0);
      g.closePath();
      g.fill();
    },
  },
  dash: { w: 1.2, draw: (g, c) => g.fillRect(-0.6 * c, -0.07 * c, 1.2 * c, 0.14 * c) },
  bar: { w: 0.13, draw: (g, c) => g.fillRect(-0.065 * c, -0.5 * c, 0.13 * c, c) },
  space: { w: 0.5, draw: null }, // chỉ là khoảng trống rộng ≈ một dấu ngăn + hai khe
};
export const SEP_IDS = Object.freeze(Object.keys(SEPS));
const RELIEF_DEPTH = 0.004; // độ nổi (đơn vị thế giới) — chỉ để tính độ dốc pháp tuyến
const BASE = [43, 43, 47]; // #2b2b2f graphite (sRGB)
const TINT = [146, 135, 117]; // đá ấm sáng hơn cho mặt chữ nổi
const WORD_FONT = (px) => `600 ${px}px "Be Vietnam Pro", system-ui, sans-serif`;
// Chữ số năm: Bodoni Moda 700 (số lining, có subset tiếng Việt — cùng họ với số năm ở các kiểu thông tin).
const YEAR_FONT = (px) => `700 ${px}px "Bodoni Moda", "Playfair Display", Georgia, serif`;
// r19: cửa sổ ±2 quanh bia đang xem (5) + bia vừa rời đi. Mỗi mục giữ dữ liệu CPU 12 MB (pháp tuyến 8192 × 256 RGBA
// 8 MB + màu 4096 × 256 RGBA 4 MB) → ≤ 72 MB; bản GPU (≈ 16 MB / mục gồm mipmap) chỉ có cho bia đang hiện + ±1 + bia
// đang rời đi (stage.js) → ≤ 64 MB.
export const CACHE_MAX = 6;

/** @type {Map<string, {normal:THREE.DataTexture, color:THREE.DataTexture, refs:number, key:string, ms:object}>} */
const cache = new Map();
/** @type {Map<string, {key: string, p: Promise<any>, urgent: boolean, started: boolean, wake: () => void, run: () => Promise<void>, reject: (e: any) => void}>} */
const pending = new Map();
const workers = { fg: null, bg: null };
let seq = 0;
const waiting = new Map();
let yearFontPromise = null;
let offscreenOk = typeof OffscreenCanvas !== 'undefined';
const evictListeners = new Set();
/** Hàng đợi làn nền: mỗi lúc chỉ một bia (raster + worker) — không dồn việc lên luồng chính / CPU. */
const bgQueue = [];
let bgBusy = false;

/** Nhường luồng chính một nhịp (giữa các lát vẽ chữ). */
const yieldTask = () =>
  globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0));

/** Làn 'fg' (gấp) và 'bg' (nền) — hai worker riêng: việc gấp không phải xếp sau việc nền đang chạy trong worker. */
function getWorker(lane) {
  if (workers[lane]) return workers[lane];
  const w = new Worker(new URL('./relief.worker.js', import.meta.url), { type: 'module' });
  w.onmessage = ({ data }) => {
    const done = waiting.get(data.id);
    waiting.delete(data.id);
    done?.(data);
  };
  workers[lane] = w;
  return w;
}

/** Nghe lúc một mục bị đẩy khỏi cache (view giải phóng bản GPU của nó). Trả hàm gỡ. */
export function onReliefEvict(fn) {
  evictListeners.add(fn);
  return () => evictListeners.delete(fn);
}
/** Mục đã dựng xong trong cache (không chạm thứ tự LRU) — null nếu chưa có. */
export function peekRelief(key) {
  return cache.get(key) ?? null;
}

/** Nạp sẵn Bodoni Moda 700 cho chữ số năm (một lần). */
function loadYearFont() {
  yearFontPromise ??= (async () => {
    try {
      await ensureFont(FONT.bodoni); // stylesheet phải có trước, không thì fonts.load() trả về ngay (font dự phòng)
      await document.fonts.load(YEAR_FONT(100), '0123456789');
    } catch {
      /* dùng font dự phòng */
    }
    return { font: YEAR_FONT, family: 'Bodoni Moda' };
  })();
  return yearFontPromise;
}

const upper = (s) => String(s ?? '').toLocaleUpperCase('vi');

/**
 * Chữ khắc trên bục của một bia — { front: [trái, số, phải], back: [trái, số, phải] } (chữ hoa, chưa vẽ). Hàm thuần: dùng
 * cho rasterize và cho kiểm thử (vm.cinemaPedText). Thiếu dữ liệu thì bỏ vế đó, không bao giờ in "NULL" / "UNDEFINED":
 *   mặt trước: BIA TIẾN SĨ • {năm} • KHOA THI {CAN CHI} (không can chi → "VĂN MIẾU – QUỐC TỬ GIÁM")
 *   mặt sau  : biết năm dựng → DỰNG BIA NĂM • {năm dựng} • SOẠN VĂN {TÊN} | NĂM DỰNG BIA • {năm dựng} • ĐỢT {n}
 *              (r79: không người soạn, không đợt → "VĂN MIẾU – QUỐC TỬ GIÁM"); chưa biết → BIA SỐ • {stt} • VĂN MIẾU – QUỐC TỬ GIÁM
 */
export function ringText(entry) {
  const VM = 'VĂN MIẾU – QUỐC TỬ GIÁM';
  const front = ['BIA TIẾN SĨ', String(entry?.year ?? ''), entry?.canChi ? upper(`Khoa thi ${entry.canChi}`) : VM];
  const known = entry?.dung != null;
  const author = entry?.soanVan && !/^\s*không (ghi|rõ)\s*$/iu.test(entry.soanVan) ? entry.soanVan : null;
  let back;
  if (!known) back = ['BIA SỐ', String(entry?.stt ?? ''), VM];
  else if (author) back = ['DỰNG BIA NĂM', String(entry.dung), `SOẠN VĂN ${upper(author)}`];
  else back = ['NĂM DỰNG BIA', String(entry.dung), entry.dot != null ? `ĐỢT ${entry.dot}` : VM];
  return { front, back };
}

/**
 * Raster chữ vào bản đồ độ cao 1 kênh. dims: bề vòng giữa dải + bề dài mặt vát (đơn vị thế giới).
 * scale: settings.pedestalText (cỡ cả cụm mặt trước; mặt sau × BACK_SCALE). sepId: settings.pedestalSep.
 */
async function rasterize(entry, dims, yf, scale, sepId) {
  // Nạp đúng các ký tự sẽ vẽ (font Google chia subset theo unicode-range — tiếng Việt nằm subset riêng).
  const sample = `BIA TIẾN SĨ KHOA THI NĂM DỰNG ĐỢT SỐ VĂN MIẾU – QUỐC TỬ GIÁM ${upper(entry.canChi)} ${upper(entry.soanVan)}`;
  await ensureFont(FONT.beVietnam); // (xem loadYearFont) — trước đây phụ thuộc may rủi vào view đã nạp xong stylesheet
  await Promise.all([document.fonts.load(WORD_FONT(100), sample), document.fonts.load(yf.font(100), '0123456789')]).catch(
    () => {},
  );
  const td = performance.now();
  const W = RELIEF_W;
  const H = RELIEF_H;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  // r16: willReadFrequently — canvas CPU. Canvas GPU phải chờ GPU mỗi lần getImageData (dò vị trí dấu ngăn: sáu lần
  // mỗi bia, vài ms mỗi lần, trên luồng chính); vẽ vài dòng chữ bằng CPU vẫn chỉ vài ms. Điểm ảnh sang worker qua
  // ImageBitmap như cũ.
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  // Texel theo u phủ circ/W, theo v phủ slant/H → nén ngang sx để chữ lên bục đúng tỉ lệ.
  const sx = (W * dims.slant) / (dims.circ * H);
  const inkOf = (m) => ({
    l: m.actualBoundingBoxLeft ?? 0,
    r: m.actualBoundingBoxRight ?? m.width,
    a: m.actualBoundingBoxAscent ?? 0,
    d: m.actualBoundingBoxDescent ?? 0,
  });
  const setSpacing = (v) => {
    try {
      g.letterSpacing = v;
    } catch {
      /* trình duyệt cũ */
    }
  };
  /** Vẽ một dòng sao cho MÉP NÉT (không phải hộp chữ) chạm đúng anchorX; trả về bề ngang nét (px canvas). */
  const line = (text, anchorX, baseline, align) => {
    const m = inkOf(g.measureText(text));
    g.save();
    g.translate(anchorX, 0);
    g.scale(sx, 1);
    // align 'right': mép phải nét tại 0; 'left': mép trái nét tại 0 (bỏ qua giãn chữ thừa ở cuối dòng).
    g.fillText(text, align === 'right' ? -m.r : m.l, baseline);
    g.restore();
    return sx * (m.l + m.r);
  };

  /**
   * Một cụm "chữ • SỐ NĂM • chữ" trên MỘT dòng, căn giữa số năm tại cx (px canvas theo u), cỡ × k.
   * Số năm cao YEAR_FRAC × k dải, căn giữa theo chiều cao dải; chữ hoa hai bên cao WORD_CAP × nét số
   * năm và đứng CHUNG đường chân với số năm; dấu ngăn canh giữa theo chiều cao chữ hoa, khe hai bên
   * bằng nhau. Mọi thứ vẽ trong hệ đã nén ngang sx → lên bục đúng tỉ lệ.
   */
  const cluster = (cx, left, year, right, k) => {
    setSpacing('0px');
    g.font = yf.font(100);
    let b = inkOf(g.measureText(year));
    const ySize = Math.max(6, Math.floor((100 * YEAR_FRAC * k * H) / Math.max(1, b.a + b.d)));
    g.font = yf.font(ySize);
    b = inkOf(g.measureText(year));
    const yInk = b.a + b.d; // chiều cao nét số năm (texel)
    const base = H / 2 + (b.a - b.d) / 2; // đường chân chung (số lining: chân nét = baseline)
    const stroke = Math.max(2, ySize * 0.045); // viền làm dày nét mảnh (xem dưới) — nở mỗi bên stroke/2
    const yearHalf = (sx * (b.l + b.r + stroke)) / 2;
    g.save();
    g.translate(cx, 0);
    g.scale(sx, 1);
    // Nét mảnh (hairline) của số Bodoni mà để nguyên thì sau khi làm mềm độ cao sẽ mất hẳn trên phù
    // điêu (số 4 thành "I") → viền dày thêm cùng màu cho nét mảnh đủ bề để nổi.
    g.lineJoin = 'round';
    g.strokeStyle = '#fff';
    g.lineWidth = stroke;
    // Tâm NÉT số năm đúng tại cx: nét trải [x − l, x + r] → x = (l − r)/2. (Bản trước cộng thêm l —
    // Bodoni có l âm → số năm lệch trái, dấu ngăn hai bên lệch về phía chữ đứng SAU nó.)
    const x = (b.l - b.r) / 2;
    g.strokeText(year, x, base);
    g.fillText(year, x, base);
    g.restore();

    // Chữ: cỡ theo CHIỀU CAO CHỮ HOA (đo "H") → hai bên cùng cỡ dù dấu khác nhau.
    setSpacing(WORD_TRACK);
    g.font = WORD_FONT(100);
    const cap100 = Math.max(1, g.measureText('H').actualBoundingBoxAscent || 72);
    const wSize = Math.max(4, Math.floor((100 * WORD_CAP * yInk) / cap100));
    g.font = WORD_FONT(wSize);
    const cap = (cap100 * wSize) / 100;
    // Dấu ngăn: tâm ở giữa chiều cao chữ hoa, cách mép số năm và mép chữ đúng một khe.
    const S = SEPS[sepId] ?? SEPS.dot;
    const gap = SEP_GAP * cap; // texel dọc (chưa nén)
    const sepOff = sx * (gap + (S.w * cap) / 2); // từ mép số năm tới tâm dấu ngăn (px canvas)
    const textOff = sx * (2 * gap + S.w * cap); // từ mép số năm tới mép chữ (px canvas)
    const xL = cx - yearHalf - textOff;
    const xR = cx + yearHalf + textOff;
    const wl = line(left, xL, base, 'right');
    const wr = line(right, xR, base, 'left');
    // Dấu ngăn: CANH GIỮA KHE THẬT giữa nét số năm và nét chữ ở đúng dải cao độ của dấu ngăn (tâm =
    // nửa chiều cao chữ hoa ± 0,04·cap), đọc từ chính canvas. Hộp nét (bounding box) không dùng được:
    // số "1" Bodoni có chân/cờ chìa ra ở đáy/đỉnh nhưng thân ở giữa thụt vào → khe phía số năm trông
    // rộng hơn hẳn. Mặt sau vẽ hai lần ở mép canvas (x = 0, W) → đo ở bản nằm trong canvas rồi dùng chung.
    const yMid = base - cap / 2;
    const sepX = [-1, 1].map((dir) => cx + dir * (yearHalf + sepOff)); // vị trí theo hộp nét (dự phòng)
    if (S.draw) {
      const band = Math.max(1, Math.round(cap * 0.04)); // vài hàng quanh tâm (số "7" có mép xiên)
      const ry = Math.max(0, Math.round(yMid - band));
      const rh = Math.min(H - ry, 2 * band + 1);
      for (let k = 0; k < 2; k++) {
        // cửa sổ quét: từ vị trí theo hộp nét, rộng ra hai phía tới quá hẳn mép hai phần tử kề bên
        // (thân số "1" thụt vào so với hộp nét tới cả nửa khe) — cả khe lẫn phần thụt
        const gx = sepX[k];
        const half = sx * (2 * gap + S.w * cap) + 12;
        const wx0 = Math.round(gx - half);
        const wx1 = Math.round(gx + half);
        if (wx0 < 0 || wx1 > W) continue; // bản vẽ tràn mép (mặt sau) → giữ vị trí dự phòng
        const px = g.getImageData(wx0, ry, wx1 - wx0, rh).data;
        const ww = wx1 - wx0;
        let edgeL = -Infinity;
        let edgeR = Infinity;
        const c0 = Math.round(gx) - wx0;
        for (let y = 0; y < rh; y++) {
          for (let x = c0; x >= 0; x--) if (px[(y * ww + x) * 4] > 127) { edgeL = Math.max(edgeL, x); break; }
          for (let x = c0; x < ww; x++) if (px[(y * ww + x) * 4] > 127) { edgeR = Math.min(edgeR, x); break; }
        }
        if (Number.isFinite(edgeL) && Number.isFinite(edgeR) && edgeR > edgeL) sepX[k] = wx0 + (edgeL + edgeR + 1) / 2;
      }
      for (let k = 0; k < 2; k++) {
        // mặt sau: bản ở x = W dùng lại độ lệch đo được ở bản x = 0 (và ngược lại) — cùng hình
        g.save();
        g.translate(sepX[k], yMid);
        g.scale(sx, 1);
        S.draw(g, cap);
        g.restore();
      }
    }
    // DEV: đo khe THẬT trên canvas ở đúng hàng tâm dấu ngăn — quét các đoạn có nét quanh mỗi dấu ngăn.
    let gaps = null;
    if (import.meta.env.DEV && S.draw && cx > 0 && cx < W) {
      const yRow = Math.round(base - cap / 2);
      const x0 = Math.max(0, Math.floor(xL - wl) - 4);
      const x1 = Math.min(W, Math.ceil(xR + wr) + 4);
      const row = g.getImageData(x0, yRow, x1 - x0, 1).data;
      const runs = [];
      let start = -1;
      for (let i = 0; i <= x1 - x0; i++) {
        const on = i < x1 - x0 && row[i * 4] > 127;
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          runs.push([x0 + start, x0 + i - 1]);
          start = -1;
        }
      }
      // dấu ngăn = đoạn chứa tâm của nó
      const at = (xc) => runs.findIndex(([a, b]) => xc >= a - 1 && xc <= b + 1);
      gaps = [0, 1].map((j) => {
        const k = at(sepX[j]);
        if (k <= 0 || k >= runs.length - 1) return null;
        return [runs[k][0] - runs[k - 1][1] - 1, runs[k + 1][0] - runs[k][1] - 1]; // [khe trái, khe phải] px canvas
      });
    }
    return {
      gaps,
      yearPx: ySize,
      yearInk: +yInk.toFixed(1),
      wordPx: wSize,
      wordCap: +cap.toFixed(1),
      span: [(xL - wl) / W, (xR + wr) / W],
    };
  };

  // r19: ba cụm = ba lát riêng (mỗi lát vài ms) — dựng được cả giữa lúc lướt mà không rớt khung.
  let drawMs = 0;
  const timed = (fn) => {
    const t = performance.now();
    const r = fn();
    drawMs += performance.now() - t;
    return r;
  };
  // --- Mặt TRƯỚC (u = 0,5 ≡ phương vị 0): BIA TIẾN SĨ • {năm} • KHOA {CAN CHI}
  const ring = ringText(entry);
  const front = timed(() => cluster(W / 2, ring.front[0], ring.front[1], ring.front[2], scale));
  // --- Mặt SAU (u = 0 ≡ 1 ≡ phương vị 180°), cỡ 70%: NĂM DỰNG BIA • {năm dựng} • {SOẠN VĂN}.
  // Chưa có tên người soạn văn → "ĐỢT {n}" cho cân đối; không bịa tên. Vẽ hai lần (x = 0 và x = W)
  // để nối qua mép lặp của texture.
  // r21: bia chưa có dữ liệu lịch sử (v2) → mặt sau là số thứ tự bia ở Văn Miếu (đã biết chắc cho cả 82 bia), không bịa
  // năm dựng / người soạn: "BIA SỐ • 33 • VĂN MIẾU – QUỐC TỬ GIÁM".
  // r71 (người dùng: "mặt sau cần ghi năm dựng bia và tên người soạn bia"): biết người soạn → "DỰNG BIA NĂM • 1484 • SOẠN VĂN
  // THÂN NHÂN TRUNG" (đọc thành hai vế "Dựng bia năm 1484" · "Soạn văn Thân Nhân Trung").
  const [left, mid, right] = ring.back;
  const backs = [];
  for (const cx of [0, W]) {
    await yieldTask();
    backs.push(timed(() => cluster(cx, left, mid, right, scale * BACK_SCALE)));
  }
  // Kiểm tra bố cục: hai cụm trước/sau không được chạm nhau (theo phần vòng u, 0..1).
  const backR = backs[0].span[1]; // mép phải cụm sau (quanh u = 0)
  const backL = backs[1].span[0] - 1; // mép trái cụm sau (quanh u = 1, âm)
  const layout = {
    front: front.span.map((v) => +v.toFixed(3)),
    back: [+backL.toFixed(3), +backR.toFixed(3)],
    clearance: +Math.min(front.span[0] - backR, 1 + backL - front.span[1]).toFixed(3),
  };

  const texel = (f) => ({ yearPx: f.yearPx, yearInk: f.yearInk, wordPx: f.wordPx, wordCap: f.wordCap, sepGaps: f.gaps });
  return { canvas: cv, sx, front: texel(front), back: texel(backs[0]), layout, drawMs, sliceMs: performance.now() - td };
}

function makeTex(data, srgb, w = RELIEF_W) {
  const t = new THREE.DataTexture(data, w, RELIEF_H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function evict() {
  if (cache.size <= CACHE_MAX) return;
  for (const [key, it] of cache) {
    if (cache.size <= CACHE_MAX) break;
    if (it.refs > 0) continue;
    for (const fn of evictListeners) fn(it);
    it.normal.dispose();
    it.color.dispose();
    cache.delete(key);
  }
}

/** Khoá cache của một bản đồ chữ (cùng quy tắc chuẩn hoá tham số như requestRelief). */
export function reliefKey(entry, dims, scale = 0.7, sep = 'dot', look = {}) {
  const k = Math.min(1, Math.max(0.4, Number.isFinite(scale) ? scale : 0.7));
  const sepId = SEPS[sep] ? sep : 'dot';
  const sharp = Math.min(1, Math.max(0, Number.isFinite(look.sharp) ? look.sharp : DEFAULTS.pedestalSharp));
  const profile = PROFILE_IDS.includes(look.profile) ? look.profile : 'round';
  return { key: `${entry.id}|${dims.circ.toFixed(3)}|${dims.slant.toFixed(4)}|${k.toFixed(3)}|${sepId}|${sharp.toFixed(3)}|${profile}`, k, sepId, sharp, profile };
}

function pumpBg() {
  if (bgBusy) return;
  const job = bgQueue.shift();
  if (!job) return;
  bgBusy = true;
  job.run().finally(() => {
    bgBusy = false;
    pumpBg();
  });
}

/**
 * Xin bản đồ chữ nổi cho một bia (Promise; đã có thì trả ngay).
 * @param {object} entry mục bia
 * @param {{circ:number, slant:number}} dims bề vòng giữa dải vát + bề dài mặt vát (đơn vị thế giới)
 * @param {number} [scale] settings.pedestalText (0,4..1)
 * @param {string} [sep] settings.pedestalSep ('dot' | 'diamond' | 'dash' | 'bar' | 'space')
 * @param {{sharp?:number, profile?:string}} [look] settings.pedestalSharp (0..1) + pedestalProfile
 * @param {{gate?: () => Promise<void>, urgent?: boolean}} [opts]
 *   urgent (r19): bia đích của lần chuyển vừa bấm — chạy ngay ở làn gấp (worker riêng), bỏ qua gate; việc cùng bia
 *   đang chờ ở làn nền được đẩy lên. Không gấp: xếp hàng làn nền (lần lượt), chờ gate (nếu có) trước khi vẽ chữ.
 */
export function requestRelief(entry, dims, scale = 0.7, sep = 'dot', look = {}, opts = {}) {
  const { key, k, sepId, sharp, profile } = reliefKey(entry, dims, scale, sep, look);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // LRU: đưa lên cuối
    cache.set(key, hit);
    return Promise.resolve(hit);
  }
  const had = pending.get(key);
  if (had) {
    if (opts.urgent && !had.urgent) {
      had.urgent = true;
      had.wake(); // bỏ chờ gate
      if (!had.started) {
        const i = bgQueue.indexOf(had);
        if (i >= 0) bgQueue.splice(i, 1);
        had.run(); // chạy ngay ngoài hàng đợi nền
      }
    }
    return had.p;
  }
  let resolve;
  let reject;
  const p = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let wake;
  const woken = new Promise((r) => (wake = r));
  const job = { key, p, urgent: !!opts.urgent, started: false, wake, run: null, reject };
  job.run = async () => {
    if (job.started) return;
    job.started = true;
    try {
      // r21: không bao giờ bắt đầu vẽ chữ trong CÙNG tác vụ với nơi xin (thường là lúc bấm chuyển bia) — nhường một nhịp
      await yieldTask();
      if (!job.urgent && opts.gate) await Promise.race([opts.gate(), woken]);
      const lane = job.urgent ? 'fg' : 'bg';
      const t0 = performance.now();
      const yf = await loadYearFont();
      const r = await rasterize(entry, dims, yf, k, sepId);
      const t1 = performance.now();
      const du = dims.circ / RELIEF_W;
      const dv = dims.slant / RELIEF_H;
      const post = (src, transfer) =>
        new Promise((done) => {
          const id = ++seq;
          waiting.set(id, done);
          getWorker(lane).postMessage(
            {
              id,
              w: RELIEF_W,
              h: RELIEF_H,
              ...src,
              su: RELIEF_DEPTH / (8 * du),
              sv: RELIEF_DEPTH / (8 * dv),
              du,
              dv,
              bevelW: bevelWidthFor(sharp),
              profile,
              cavity: CAVITY_W,
              base: BASE,
              tint: TINT,
            },
            transfer,
          );
        });
      // Đọc điểm ảnh (4 MB) + tách kênh trong worker: luồng chính chỉ vẽ chữ rồi chuyển ảnh đi.
      let res = null;
      let readMs = 0;
      if (offscreenOk && typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(r.canvas);
          res = await post({ bitmap: bmp }, [bmp]);
          if (res.error) {
            offscreenOk = false; // worker không có OffscreenCanvas 2D → đọc ở luồng chính từ nay
            res = null;
          }
        } catch {
          offscreenOk = false;
          res = null;
        }
      }
      if (!res) {
        const tr = performance.now();
        const img = r.canvas.getContext('2d').getImageData(0, 0, RELIEF_W, RELIEF_H).data;
        const height = new Uint8Array(RELIEF_W * RELIEF_H);
        for (let i = 0; i < height.length; i++) height[i] = img[i * 4];
        readMs = performance.now() - tr;
        res = await post({ height }, [height.buffer]);
      }
      if (res.error) throw new Error(res.error);
      const item = {
        key,
        normal: makeTex(res.normal, false),
        color: makeTex(res.color, true, res.colorW ?? RELIEF_W),
        refs: 0,
        circ: dims.circ,
        slant: dims.slant,
        scale: k,
        sep: sepId,
        sharp,
        profile,
        bevelMm: +(bevelWidthFor(sharp) * 1000).toFixed(2),
        texels: { normal: [RELIEF_W, RELIEF_H], color: [res.colorW ?? RELIEF_W, RELIEF_H], mmPerTexel: [+(du * 1000).toFixed(3), +(dv * 1000).toFixed(3)] },
        yearFont: yf.family,
        lane,
        ms: { raster: +(t1 - t0).toFixed(1), draw: +r.drawMs.toFixed(1), mainRead: +readMs.toFixed(1), worker: +res.ms.toFixed(1), stages: res.stages, total: +(performance.now() - t0).toFixed(1) },
        canvas: { front: r.front, back: r.back, sx: +r.sx.toFixed(3), layout: r.layout },
      };
      cache.set(key, item);
      evict();
      resolve(item);
    } catch (err) {
      reject(err);
    } finally {
      pending.delete(key);
    }
  };
  pending.set(key, job);
  if (job.urgent) setTimeout(() => job.run(), 0);
  else {
    bgQueue.push(job);
    pumpBg();
  }
  return p;
}

/**
 * r19: bỏ các việc NỀN chưa bắt đầu mà không còn trong cửa sổ (người xem đã đi xa) — hàng đợi không dồn cả chục bia
 * khi bấm liên tục. Promise của việc bị bỏ kết thúc bằng lỗi AbortError.
 */
export function pruneReliefQueue(keepKeys) {
  for (let i = bgQueue.length - 1; i >= 0; i--) {
    const job = bgQueue[i];
    if (job.started || keepKeys.has(job.key)) continue;
    bgQueue.splice(i, 1);
    pending.delete(job.key);
    const err = new Error('relief: bỏ khỏi hàng đợi');
    err.name = 'AbortError';
    job.reject(err);
  }
}

export function acquireRelief(item) {
  if (item) item.refs++;
}
export function releaseRelief(item) {
  if (!item) return;
  item.refs = Math.max(0, item.refs - 1);
  evict();
}
