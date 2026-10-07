// Font tự host (kiosk chạy OFFLINE, không còn request ra ngoài): file css + woff2 nằm ở
// public/fonts/<slug>/, mỗi family chỉ mang 2 subset latin + vietnamese (đủ dấu tiếng Việt),
// giấy phép OFL (OFL.txt cạnh font, lấy từ kho google/fonts). Nạp theo yêu cầu của từng view
// (chỉ 1 lần mỗi href) giống cơ chế Google Fonts cũ, chỉ khác nguồn CSS.
/** @type {Map<string, Promise<void>>} href → xong khi stylesheet đã nạp (hoặc lỗi / quá STYLESHEET_WAIT_MS) */
const loaded = new Map();
const STYLESHEET_WAIT_MS = 5000;

/**
 * @param {string} href URL CSS font cục bộ (public/fonts/<slug>/<slug>.css)
 * @returns {Promise<void>} xong khi các @font-face của stylesheet đã có trong document.fonts — chỉ SAU lúc đó
 *   document.fonts.load(...) mới thật sự tải font; gọi sớm hơn thì nó trả về ngay (không có mặt chữ nào khớp) và
 *   canvas vẽ bằng font dự phòng (vd. chữ nổi trên bục lệch vị trí). Không bao giờ reject.
 */
export function ensureFont(href) {
  if (loaded.has(href)) return loaded.get(href);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const ready = new Promise((resolve) => {
    const t = setTimeout(resolve, STYLESHEET_WAIT_MS);
    const done = () => {
      clearTimeout(t);
      resolve();
    };
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
  });
  loaded.set(href, ready);
  document.head.appendChild(link);
  return ready;
}

// Các font hỗ trợ tiếng Việt đầy đủ (subset vietnamese vendor sẵn trong public/fonts/):
const BASE = import.meta.env.BASE_URL; // './' khi build, '/' khi dev
export const FONT = {
  beVietnam: BASE + 'fonts/be-vietnam-pro/be-vietnam-pro.css',
  playfair: BASE + 'fonts/playfair-display/playfair-display.css',
  cormorant: BASE + 'fonts/cormorant-garamond/cormorant-garamond.css',
  lora: BASE + 'fonts/lora/lora.css',
  plexMono: BASE + 'fonts/ibm-plex-mono/ibm-plex-mono.css',
  plexSans: BASE + 'fonts/ibm-plex-sans/ibm-plex-sans.css',
  // LƯU Ý: Bodoni Moda KHÔNG có subset vietnamese — chỉ dùng cho chữ số / Latin trơn.
  bodoni: BASE + 'fonts/bodoni-moda/bodoni-moda.css',
};
