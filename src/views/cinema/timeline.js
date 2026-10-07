// Dòng thời gian của Điện ảnh (82 bia) — bộ bọc chọn kiểu (settings.cinemaTimeline):
//
//   'ruler'   Thước khắc (r24): thanh chia đoạn triều đại, mốc năm thi phía trên (nhô lên kiểu dock khi rê / lăn / tay), mốc
//             năm dựng phía dưới, tiêu điểm = ô năm thi + năm dựng. timeline-concept.js (+ CSS theo data-style).
//   'line'    Sợi chỉ (r21 → r23): một sợi chỉ năm + thẻ khi rê — kiểu tối giản, cũng là bản thu gọn trên điện thoại
//             (≤ 760 px, mọi kiểu). timeline-line.js.
// B bỏ Dải lụa / Bia ký (và tạm cả Sợi chỉ + bản thu gọn điện thoại); r43 (người dùng: "giữ Sợi chỉ & thước khắc") đưa
// Sợi chỉ lại cùng bản thu gọn trên điện thoại như HEAD v0.5.12.
// Phần tử gốc (.cin-tl) giữ nguyên qua các lần đổi kiểu / đổi cỡ màn — HUD gắn nó một lần (kèm các thuộc tính vùng dính
// của tay: data-hand-sticky…, data-hand-sticky-items='.cin-tl__tick' — cả hai kiểu đều có vạch .cin-tl__tick theo thứ tự
// bia); bên trong dựng lại, kiểu cũ gỡ hết listener + thuộc tính của nó (destroy).
// Chung: đích nam châm cho tay trên mốc năm thi (data-magnet), nhãn theo vạch nam châm đang hút (data-hi-captured); chế
// độ tay (r22) chuột thật không mở nhãn; r24 chế độ dính của tay (hand:sticky 'timeline', HUD chuyển sự kiện vào đây).
import { createLineTimeline } from './timeline-line.js';
import { createConceptTimeline } from './timeline-concept.js';

export const TIMELINE_STYLES = Object.freeze(['ruler', 'line']);
export const TIMELINE_DEFAULT = 'ruler';
const PHONE_MQ = '(max-width: 760px)';

/**
 * @param {{ bia: object[], onPick: (i: number) => void, style?: string, onKind?: (kind: 'line'|'concept') => void,
 *   stickyLimits?: () => ({left:number,right:number}) }} cfg
 */
export function createTimeline({ bia, onPick, style = TIMELINE_DEFAULT, onKind, stickyLimits }) {
  const phoneMq = typeof matchMedia === 'function' ? matchMedia(PHONE_MQ) : null;
  const el = document.createElement('div');
  el.className = 'cin-tl';
  const norm = (s) => (TIMELINE_STYLES.includes(s) ? s : TIMELINE_DEFAULT);
  let want = norm(style);
  let built = '';
  let impl = null;
  let current = 0;
  let progress = -1;
  let mouseMuted = false;

  function build() {
    const k = phoneMq?.matches ? 'line' : want;
    if (k === built && impl) return;
    impl?.destroy();
    built = k;
    impl = k === 'line' ? createLineTimeline(el, { bia, onPick, stickyLimits }) : createConceptTimeline(el, { bia, onPick, stickyLimits });
    el.dataset.kind = k === 'line' ? 'line' : 'concept';
    impl.setCurrent(current);
    impl.setProgress(progress);
    impl.setMouseMuted(mouseMuted);
    onKind?.(el.dataset.kind);
  }
  const onMq = () => build();
  phoneMq?.addEventListener?.('change', onMq);
  build();

  return {
    el,
    /** Kiểu đang chọn (settings) / kiểu đang dựng thật (điện thoại: 'line'). */
    get style() {
      return want;
    },
    get kind() {
      return built;
    },
    setStyle(s) {
      const next = norm(s);
      if (next === want) return;
      want = next;
      build();
    },
    setCurrent(i) {
      current = i;
      impl.setCurrent(i);
    },
    setProgress(p) {
      progress = p;
      impl.setProgress(p);
    },
    setMouseMuted(on) {
      mouseMuted = !!on;
      impl.setMouseMuted(mouseMuted);
    },
    handAt(x, y) {
      impl.handAt(x, y);
    },
    /** r24: sự kiện hand:sticky của vùng 'timeline' (lớp cử chỉ) — chi tiết xem timeline-concept.js / timeline-line.js. */
    sticky(d) {
      impl.sticky(d);
    },
    tickRect(i) {
      return impl.tickRect(i);
    },
    markRect(y) {
      return impl.markRect?.(y) ?? null;
    },
    secRect(id) {
      return impl.secRect?.(id) ?? null;
    },
    /** DEV / thử nghiệm: kính lúp + tiêu điểm hiện tại. */
    get magnify() {
      return impl.magnify;
    },
    destroy() {
      impl?.destroy();
      impl = null;
      phoneMq?.removeEventListener?.('change', onMq);
    },
  };
}
