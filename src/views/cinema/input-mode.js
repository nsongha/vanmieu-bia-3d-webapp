// r22 — chế độ nhập của Điện ảnh: tay hay chuột đang "nắm quyền".
//
// Lớp cử chỉ (core/handInput.js, agent cử chỉ) đặt document.body.dataset.input = 'hand' | 'mouse' (tay nhận → 'hand';
// chuột thật di > ~8 px → 'mouse'), ẩn con trỏ hệ điều hành bằng CSS và phát window 'input:mode' { mode }. Ở đây: khi
// 'hand', chuột THẬT bị bỏ qua cho hover / hiện diện / thẻ dòng thời gian — con chuột nằm yên trên bia không giữ trạng
// thái hover, không giành với tay. Con trỏ tổng hợp của lớp cử chỉ (nhón kéo) vẫn đi qua như thường.
// Nghe cả hai nguồn (sự kiện + MutationObserver trên thuộc tính) — bên nào tới trước cũng được, trùng thì bỏ.

/** Con trỏ tổng hợp của lớp cử chỉ tay (core/hand/actions.js: SYNTH_POINTER_ID — nhón kéo). */
export const HAND_POINTER_IDS = new Set([9001]);

const readMode = () => (document.body?.dataset.input === 'hand' ? 'hand' : 'mouse');

/**
 * @param {(mode: 'hand'|'mouse') => void} onChange gọi khi chế độ ĐỔI (không gọi lúc tạo)
 * @returns {{ readonly mode: 'hand'|'mouse', readonly hand: boolean, muted(e: PointerEvent): boolean, destroy(): void }}
 */
export function watchInputMode(onChange) {
  let mode = readMode();
  const set = (m) => {
    const next = m === 'hand' ? 'hand' : 'mouse';
    if (next === mode) return;
    mode = next;
    onChange?.(mode);
  };
  const onEvt = (e) => set(e.detail?.mode ?? readMode());
  window.addEventListener('input:mode', onEvt);
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(() => set(readMode())) : null;
  mo?.observe(document.body, { attributes: true, attributeFilter: ['data-input'] });
  return {
    get mode() {
      return mode;
    },
    get hand() {
      return mode === 'hand';
    },
    /** Sự kiện con trỏ này là chuột THẬT đang bị tắt (chế độ tay; không phải con trỏ tổng hợp của tay, không phải chạm). */
    muted(e) {
      return mode === 'hand' && !!e && e.pointerType !== 'touch' && !HAND_POINTER_IDS.has(e.pointerId);
    },
    destroy() {
      window.removeEventListener('input:mode', onEvt);
      mo?.disconnect();
    },
  };
}
