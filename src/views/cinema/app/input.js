// Điện ảnh › nhập liệu — chuột, chạm, phím, bánh xe, khung tay (hand:frame)
//
// Con trỏ → NDC sân khấu, bấm / kéo / chạm mép (TAP_*, DRAG_TAKEOVER_PX, EDGE), phím tắt, xoa đầu rùa bằng chuột,
// khung tay từ lớp cử chỉ (hand:frame → toạ độ, nhón, hai ngón). Gắn listener ngay khi cài; gỡ ở unmount (index.js).
//
// Tách cơ học từ index.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem index.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps.
// Giữ (S — module này ghi chính): pointerDown*, gesture*, wheelUntil*, camTakeN* (r54)
//   (* khai báo + giá trị đầu nằm ở index.js, giữ thứ tự khởi tạo cũ)
// Đọc / ghi S của nơi khác: alive, realMoveT, presentGraceUntil, panelOpen
import { HAND_POINTER_IDS } from '../input-mode.js';
import { playSound } from '../../../core/sound.js';
import {
  DRAG_TAKEOVER_PX, EDGE, RUB_NAV_DAMP_MS, TAP_MS, TAP_SLOP, WHEEL_LINGER_MS, gestureOn
} from './config.js';

export function installInput(S, K, deps) {
  const {
    fineMQ, forgetLayout, hand, host, hud, inputMode, mouse, n, navLocked, navUser, noteInteraction, presence, rect,
    rub, select, setPanel, stage, stageEl, togglePlayUser, tutorial
  } = deps;

  // ---- Nhập liệu
  /** Toạ độ px client → NDC của sân khấu. */
  const toNdc = (x, y) => {
    const r = rect();
    return [((x - r.left) / Math.max(1, r.width)) * 2 - 1, -(((y - r.top) / Math.max(1, r.height)) * 2 - 1)];
  };
  /** Con trỏ đang ở trên canvas hoặc trên lớp thông tin (không phải HUD / cài đặt / bảng). */
  const overScene = (t) => stageEl.contains(t) || hud.el.css3d.contains(t) || hud.el.hudRoot.contains(t);

  /** Các con trỏ đang nhấn trên sân khấu: id → điểm nhấn (px client). */
  const presses = new Map();
  let pressTook = false;
  const onPointerMove = (e) => {
    // r22: tay đang nắm quyền → chuột THẬT chỉ được ghi nhớ vị trí (để đánh giá lại khi quyền về chuột), không hover.
    if (inputMode.muted(e)) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.known = true;
      return;
    }
    hud.wake();
    // Kéo quá ngưỡng (một ngón / chuột / nhón tay, hay ngón thứ hai lúc chụm) → người dùng cầm camera.
    const p0 = presses.get(e.pointerId);
    if (p0 && !pressTook && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) > DRAG_TAKEOVER_PX) {
      pressTook = true;
      S.camTakeN++; // r54: người dùng cầm camera (presence: giữ focus sau khi xoay)
      stage.markInteraction();
      stage.cancelHoming();
    }
    if (!HAND_POINTER_IDS.has(e.pointerId) && rub.mouseMove(e.clientX, e.clientY) === 'orbit' && e.buttons) {
      // r70: nhấn trên đầu rùa rồi kéo đi (không xoa) → xoay camera như nhấn chỗ khác: phát lại pointerdown tại đây cho
      // OrbitControls + onDown (pha bắt của xoa bỏ qua đúng cú này)
      stage.canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, button: 0, buttons: e.buttons, clientX: e.clientX, clientY: e.clientY, bubbles: true, cancelable: true, composed: true, view: window }));
    }
    if (e.pointerType === 'touch') return; // cảm ứng không có "rê" — chỉ chạm
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.known = true;
    mouse.active = true;
    if (!overScene(e.target)) {
      stage.clearPointer();
      return;
    }
    const [nx, ny] = toNdc(e.clientX, e.clientY);
    // Đang kéo: tia chỉ cần cho lúc thả tay → bắn thưa, không mỗi khung.
    stage.setPointer(nx, ny, S.pointerDown);
  };

  const onPointerLeave = () => {
    mouse.active = false;
    mouse.known = false;
    rub.mouseLeave();
    stage.clearPointer();
  };


  const onDown = (e) => {
    // Nhấn chưa phải cầm camera: chỉ khi kéo quá DRAG_TAKEOVER_PX (onPointerMove) mới huỷ hoạt ảnh camera.
    // Tính cả nút phải / giữa (OrbitControls kéo = dời khung).
    if (!presses.size) {
      pressTook = false;
      stage.pressStart();
    }
    presses.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.button != null && e.button > 0) return;
    S.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType };
    S.pointerDown = true;
    host.dataset.drag = '1';
    // Bảo đảm tài liệu đang giữ focus bàn phím (tránh trường hợp ← / → rơi vào hư không).
    try {
      stageEl.focus({ preventScroll: true });
    } catch {}
    hud.wake();
  };

  /** Nhả / huỷ một con trỏ; hết con trỏ nhấn → sân khấu thôi giữ camera. */
  const endPress = (e) => {
    presses.delete(e.pointerId);
    if (!presses.size) {
      pressTook = false;
      stage.pressEnd();
    }
  };

  const onUp = (e) => {
    endPress(e);
    const ru = rub.pointerUp(e); // hết một lượt xoa / thử xoa để mở bằng chuột (pointerdown đã bị nuốt ở pha bắt)
    if (ru === 'tap') {
      // r70: bấm gọn trên đầu rùa không còn vào chế độ xoa — như bấm vào bia (hiện thông tin / tấm trượt cảm ứng)
      const [nx, ny] = toNdc(e.clientX, e.clientY);
      if (stage.hitTest(nx, ny)) {
        if (e.pointerType === 'touch') setPanel(true, 'tap');
        else presence.force();
      }
      return;
    }
    if (ru) return;
    const g = S.gesture;
    S.pointerDown = false;
    host.dataset.drag = '0';
    S.gesture = null;
    if (!g || e.pointerId !== g.id) return;
    hud.wake();
    const dt = performance.now() - g.t;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    // Thả tay: bắn tia NGAY tại chỗ thả, để luật "hết thao tác mà không còn rê" dùng đúng vị trí.
    if (g.type !== 'touch' && overScene(e.target)) {
      const [nx, ny] = toNdc(e.clientX, e.clientY);
      stage.setPointer(nx, ny, false);
    }
    // r26: bỏ "vuốt ngang nhanh → đổi bia" (chuột, véo–kéo của tay, cảm ứng): kéo nhanh chỉ còn là xoay quỹ đạo.
    // Đổi bia: hai mũi tên, phím ← / →, dòng thời gian, cú vẩy hai ngón của lớp cử chỉ.
    const handOnNow = gestureOn();
    // Chạm mép trái/phải (cảm ứng) → lùi/tới (không khi đang xoa đầu rùa).
    if (!rub.active && !handOnNow && g.type !== 'mouse' && dt < TAP_MS && adx < TAP_SLOP && ady < TAP_SLOP) {
      const hr = host.getBoundingClientRect();
      const rel = (g.x - hr.left) / Math.max(1, hr.width);
      if (rel < EDGE) {
        navUser(-1);
        return;
      }
      if (rel > 1 - EDGE) {
        navUser(1);
        return;
      }
    }
    // Bấm gọn vào tấm bia: chạm (cảm ứng) → tấm trượt DOM; chuột / bút / tay → hiện thông tin ngay.
    if (adx < TAP_SLOP && ady < TAP_SLOP && dt < 600) {
      // Xoa đầu rùa: đang ở chế độ thì cú bấm bị nuốt (không thoát — r10). (r70: bấm không còn vào chế độ.)
      if (!HAND_POINTER_IDS.has(e.pointerId) && rub.tap(e.clientX, e.clientY)) return;
      const [nx, ny] = toNdc(e.clientX, e.clientY);
      if (stage.hitTest(nx, ny)) {
        if (g.type === 'touch') setPanel(true, 'tap');
        else presence.force();
      }
    }
  };

  const onCancel = (e) => {
    endPress(e);
    S.gesture = null;
    S.pointerDown = false;
    host.dataset.drag = '0';
  };

  const onWheel = () => {
    hud.wake();
    rub.activity();
    S.wheelUntil = performance.now() + WHEEL_LINGER_MS;
    S.camTakeN++; // r54
    stage.markInteraction();
    stage.cancelHoming();
  };

  /** Tên phím chuẩn hoá — một số trình duyệt / công cụ tự động chỉ gửi code hoặc keyCode. */
  function keyName(e) {
    const k = e.key;
    if (k && k !== 'Unidentified') return k === 'Spacebar' ? ' ' : k;
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'Home' || c === 'End' || c === 'Escape') return c;
    if (c === 'Space') return ' ';
    switch (e.keyCode) {
      case 37: return 'ArrowLeft';
      case 39: return 'ArrowRight';
      case 36: return 'Home';
      case 35: return 'End';
      case 27: return 'Escape';
      case 32: return ' ';
      default: return '';
    }
  }

  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (tutorial.active) return; // r32: đang hướng dẫn — ứng dụng không nhận phím (Esc do tutorial.js lo)
    if (document.body.dataset.modal === 'reader') return; // r71: lớp đọc toàn văn / bảng vàng tự lo phím (info/rich/overlay.js)
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''))) return;
    // Bảng thông tin đang mở: để phím mũi tên cuộn nội dung trong bảng.
    if (t?.closest?.('.cin-setwrap')) return;
    if (S.panelOpen && t?.closest?.('.cin-panel')) return;

    let handled = true;
    const k = keyName(e);
    rub.activity();
    // Xoa đầu rùa: phím mũi tên do cử chỉ tay phát (không phải bàn phím thật) ngay sau khi xoa → bỏ (giảm độ nhạy).
    if (rub.active && !e.isTrusted && (k === 'ArrowLeft' || k === 'ArrowRight') && rub.rubbedWithin(RUB_NAV_DAMP_MS)) {
      e.preventDefault();
      return;
    }
    switch (k) {
      // r52: phím tổng hợp (lớp cử chỉ — cú vẩy hai ngón) lúc đang lướt: bỏ, không xếp hàng như chuột / phím thật
      case 'ArrowLeft': navUser(-1, !e.isTrusted); break;
      case 'ArrowRight': navUser(1, !e.isTrusted); break;
      case 'Home': if (!navLocked()) select(0); break;
      case 'End': if (!navLocked()) select(n - 1); break;
      case 'Escape':
        if (hud.settingsOpen) hud.closeSettings();
        else if (rub.active) rub.exit('esc');
        else if (S.panelOpen) setPanel(false);
        else if (presence.shown || presence.pinned) presence.pin(false);
        else handled = false;
        break;
      case 'i':
      case 'I':
        // Bàn phím: bật/tắt thông tin (ghim, không phụ thuộc con trỏ). Màn cảm ứng: tấm trượt.
        if (fineMQ && !fineMQ.matches) setPanel(!S.panelOpen, 'key');
        else presence.pin(!presence.pinned);
        break;
      case ' ':
        if (t && t.closest?.('button, a')) handled = false;
        else togglePlayUser();
        break;
      default:
        handled = false;
    }
    hud.wake();
    if (handled) e.preventDefault();
  };

  host.addEventListener('pointermove', onPointerMove, { passive: true });
  host.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('resize', forgetLayout, { passive: true });
  stageEl.addEventListener('pointerdown', onDown);
  // Pha BẮT: trong chế độ xoa, nhấn chuột / chạm trúng đầu rùa là xoa — nuốt sự kiện trước khi tới canvas
  // (OrbitControls không xoay) và trước onDown (không tính là nhấn / kéo camera).
  const onRubDown = (e) => {
    if (HAND_POINTER_IDS.has(e.pointerId)) return;
    if (rub.pointerDownCapture(e)) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  stageEl.addEventListener('pointerdown', onRubDown, true);
  stageEl.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);

  // Cử chỉ tay: chỉ nhận khi lớp cử chỉ đang theo dõi (body.gesture-on). Việc bắn tia do sân
  // khấu giải MỘT lần mỗi khung; ở đây chỉ ghi lại vị trí + tư thế. Nhón-kéo trên canvas thì lớp
  // cử chỉ còn phát pointerdown/move/up thật lên canvas → onDown/onUp ở trên cũng thấy.
  const clearHand = () => {
    hand.active = false;
    hand.pinch = false;
    hand.v = false;
    stage.clearHandPointer();
  };
  const onHandFrame = (e) => {
    if (!S.alive || !gestureOn()) return;
    const d = e.detail || {};
    // r19: bàn tay đã "nhận" (con trỏ đang khoá / chế độ điều hướng hai ngón / đang xoa) là đang thao tác; tay người
    // đi ngang chưa nhận thì không tính.
    if ((d.engaged || d.nav || document.body.dataset.handBusy || rub.active) && performance.now() >= S.presentGraceUntil) {
      S.realMoveT = performance.now(); // r26: xem hoverQuiet()
      noteInteraction();
    }
    if (!d.detected) {
      clearHand();
      rub.handLost();
      return;
    }
    rub.handFrame(d);
    hand.active = true;
    hand.x = d.x;
    hand.y = d.y;
    // r32: một cú nhón (cạnh lên, tay đã nhận) = một tiếng mõ; đang hướng dẫn thì tutorial.js tự phát khi chọn trúng
    const pinchNow = d.pose === 'pinch';
    if (pinchNow && !hand.pinch && d.engaged !== false && !tutorial.active) playSound('tok');
    hand.pinch = pinchNow;
    hand.v = !!d.v; // r72g: đang giữ chữ V (điểm tay = tâm huy hiệu V) — giữ trên bia 2 s mở thông tin đầy đủ (index.js)
    hand.hover = d.hover !== false; // r29g: lớp cử chỉ báo tay được rê vùng (xoè đủ 5 ngón, không nhón / kéo, đã yên sau cú nhón)
    const [nx, ny] = toNdc(d.x, d.y);
    // Đang nhón: tia chỉ cần cho lúc thả → bắn thưa.
    stage.setHandPointer(nx, ny, hand.pinch);
  };
  window.addEventListener('hand:frame', onHandFrame);
  return {
    clearHand, onCancel, onDown, onHandFrame, onKey, onPointerLeave, onPointerMove, onRubDown, onUp, onWheel, overScene,
    toNdc,
  };
}
