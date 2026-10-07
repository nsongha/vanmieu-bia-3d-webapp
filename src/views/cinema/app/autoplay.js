// Điện ảnh › tự chuyển — ▶ tay (Space) và tự trình chiếu khi rảnh (kiosk)
//
// setPlaying / autoStep / hoverQuiet / presentNow; đếm giờ rảnh (noteInteraction, canAutoStart) + listener
// thao tác bất kỳ trên window. Nhịp khung (đếm AUTO_MS, tự bật khi rảnh) nằm ở vòng khung hình của index.js.
//
// Tách cơ học từ index.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem index.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps.
// Giữ (S — module này ghi chính): playing*, autoMs*, autoMode*, lastInteract*, idleStopT*, realMoveT*, autoQuietT*, presentGraceUntil*
//   (* khai báo + giá trị đầu nằm ở index.js, giữ thứ tự khởi tạo cũ)
// Đọc / ghi S của nơi khác: alive, loading, errorOn, panelOpen, pointerDown, booting
import {
  AUTO_TOGGLE_GRACE_MS, PRESENT_NOW_GRACE_MS
} from './config.js';

export function installAutoplay(S, K, deps) {
  const {
    host, hud, inputMode, lastMove, navLocked, presence, rub, setPanel, stage, step, tutorial
  } = deps;

  // ---- Tự động chuyển
  function setPlaying(v, mode = 'manual') {
    S.playing = v;
    S.autoMode = v ? mode : null;
    S.autoMs = 0;
    if (v) {
      S.autoQuietT = performance.now(); // r26: con trỏ đang nằm yên trên bia lúc bật → không hover
      if (host.dataset.hot === '1') host.dataset.hot = '0'; // r27: con trỏ "bấm được" thôi ngay, không chờ khung vẽ kế
    } else S.presentGraceUntil = 0;
    hud.setPlaying(v);
    hud.setAutoNote(S.autoMode === 'idle');
    if (v) hud.setAutoProgress(0);
    if (mode !== 'idle') hud.wake();
  }
  /** Space của người dùng (r26: nút ▶ đã bỏ). Cú bấm đó vừa dừng tự trình chiếu (thao tác = dừng) → giữ dừng, không bật ▶ tay. */
  function togglePlayUser() {
    if (performance.now() - S.idleStopT < AUTO_TOGGLE_GRACE_MS) return;
    setPlaying(!S.playing);
  }
  /** Lượt tự chuyển sang bia kế (▶ tay / tự trình chiếu). r26: đang lướt → chờ (gọi lại khung sau), không chen ngang. */
  function autoStep() {
    if (navLocked()) return false;
    S.autoQuietT = performance.now(); // bia mới lướt tới dưới con trỏ đứng yên → không hover
    step(1, true);
    return true;
  }
  /**
   * r26: đang tự chuyển và con trỏ chưa rê / bấm / lăn thật lần nào kể từ lượt tự chuyển gần nhất → không vào trạng thái
   * hover (thông tin, đèn bục, vòng camera chính diện, con trỏ "bấm được"). Tự trình chiếu khi rảnh: thao tác thật là dừng
   * luôn → hover chạy lại như thường từ chính lần rê đó. ▶ tay (Space): rê thật → hover như cũ (và tạm dừng tự chuyển).
   */
  function hoverQuiet() {
    return S.playing && S.realMoveT <= S.autoQuietT;
  }
  /**
   * r26: bảng cài đặt → "Trình chiếu ngay": bật tự trình chiếu (như khi rảnh, kể cả lúc đã tắt tự bật khi rảnh) ngay bây
   * giờ + đóng bảng. Rê chuột / tay trong PRESENT_NOW_GRACE_MS sau cú bấm (đưa chuột ra khỏi bảng) chưa tính là thao tác;
   * bấm / phím / lăn thì vẫn dừng ngay như thường.
   */
  function presentNow() {
    if (!S.alive || S.booting) return;
    if (hud.settingsOpen) hud.closeSettings();
    if (presence.pinned) presence.pin(false);
    if (S.panelOpen) setPanel(false);
    setPlaying(true, 'idle');
    S.presentGraceUntil = performance.now() + PRESENT_NOW_GRACE_MS;
  }

  // ---- Tự trình chiếu khi rảnh (r19) -------------------------------------------------------------------------------
  /** Người dùng vừa thao tác (chuột / chạm / phím / bánh xe / tay đã "nhận"): hẹn lại giờ rảnh; tự trình chiếu → dừng. */
  function noteInteraction() {
    S.lastInteract = performance.now();
    if (S.autoMode === 'idle') {
      S.idleStopT = S.lastInteract;
      setPlaying(false); // lượt lướt đang chạy vẫn chạy nốt (không huỷ chuyển cảnh)
    }
  }
  /** Có được tự bật trình chiếu lúc này không (ngoài điều kiện rảnh). */
  function canAutoStart() {
    return (
      !S.booting &&
      !S.loading &&
      !S.errorOn &&
      !S.panelOpen &&
      !S.pointerDown &&
      !document.hidden &&
      !document.body.dataset.modal &&
      !hud.settingsOpen &&
      !rub.active &&
      !stage.rub.leaving &&
      !stage.showingProxy &&
      !stage.transitioning &&
      !presence.pinned &&
      !tutorial.active
    );
  }
  const onAnyPointer = (e) => {
    // Chrome phát "pointermove" giả (toạ độ không đổi) khi bố cục dưới con trỏ đứng yên thay đổi — không phải thao tác.
    if (e.type === 'pointermove') {
      // r22: tay đang nắm quyền — chuột rung nhẹ (chưa đủ để lớp cử chỉ trả quyền cho chuột) không phải thao tác
      if (inputMode.muted(e)) return;
      if (e.clientX === lastMove.x && e.clientY === lastMove.y) return;
      lastMove.x = e.clientX;
      lastMove.y = e.clientY;
      if (performance.now() < S.presentGraceUntil) return; // r26: vừa bấm "Trình chiếu ngay" (xem PRESENT_NOW_GRACE_MS)
    }
    S.realMoveT = performance.now(); // r26: xem hoverQuiet()
    noteInteraction();
  };
  const onAnyKey = () => noteInteraction();
  window.addEventListener('pointermove', onAnyPointer, { capture: true, passive: true });
  window.addEventListener('pointerdown', onAnyPointer, { capture: true, passive: true });
  window.addEventListener('wheel', onAnyPointer, { capture: true, passive: true });
  window.addEventListener('keydown', onAnyKey, true);

  function resetAuto() {
    S.autoMs = 0;
    if (S.playing) hud.setAutoProgress(0);
  }
  return {
    autoStep, canAutoStart, hoverQuiet, noteInteraction, onAnyKey, onAnyPointer, presentNow, resetAuto, setPlaying,
    togglePlayUser,
  };
}
