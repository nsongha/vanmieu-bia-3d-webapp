// Luật HIỆN / ẨN thông tin bia theo con trỏ — một bộ máy trạng thái thuần (không đụng DOM),
// giống hệt nhau cho chuột và cử chỉ tay. Chế độ Điện ảnh gọi update() mỗi khung.
//
//   · "Đang rê" = con trỏ nằm trên tấm bia hiện tại (tia bắn trúng lưới) HOẶC trên phần thông tin
//     đang hiện (layout.hitTest) HOẶC — khi thông tin ĐANG hiện — trong vùng giữ hover của sân khấu
//     (hợp hình chiếu bia + bục ở khung 3/4 lẫn chính diện, nới rộng; xem stage.mouseLatch).
//   · r7: KHÔNG còn thời gian chờ. Hiện ngay khung tia bắn trúng bia (chuột); tay chờ DWELL_HAND_MS
//     (rất ngắn — lướt tay ngang qua bia không bật đèn). Ẩn ngay khung con trỏ ra khỏi vùng trên (hoặc
//     rời khung hình). Chống nhấp nháy bằng KHÔNG GIAN (vùng giữ hover không đổi trong lúc camera vòng
//     về chính diện), không bằng thời gian — đèn / camera / thông tin bắt đầu ngay, tự có nhịp 500 / 400 ms.
//   · Chốt khi thao tác: bắt đầu kéo chuột / nhón-kéo / zoom TRONG LÚC đang
//     rê và thông tin đang hiện → giữ nguyên suốt thao tác, con trỏ đi đâu cũng vậy.
//   · Hết thao tác mà không còn rê → ẩn (HIDE_MS); rê lại thì thôi.
//   · Bị chặn (đang tải / chuyển cảnh / lỗi / tấm trượt cảm ứng đang mở) → ẩn NGAY.
//     Hết chặn mà con trỏ vẫn trên bia → hiện lại ngay (cho bia mới).
//   · Ghim (phím I hoặc bấm vào bia): hiện ngay; ghim bằng phím thì giữ tới khi bỏ ghim.
//   · r54 — GIỮ SAU KHI XOAY (người dùng: "khi user đang hand drag để xem các góc khác nhau của bia, thả tay hoặc cursor
//     trượt ra ngoài rất dễ bị mất focus (đèn tắt, camera reset)"): thao tác bắt đầu lúc đang hiện mà thực sự cầm camera
//     (xoay / zoom — input.orbiting) → từ đó tới khi rời focus, không còn rê KHÔNG ẩn ngay nữa: chỉ ẩn khi con trỏ ở ngoài
//     liên tục HOLD_OUT_MS, hoặc mất nguồn con trỏ (tay rời khung / chuột rời trang) HOLD_GONE_MS; rê lại bia (vùng giữ,
//     thông tin) là huỷ đếm. Rời có chủ ý thì ẩn NGAY: chuyển cảnh (blocked), giơ hai ngón / kéo bia (input.exit), Esc /
//     nắm tay = Esc (pin(false)). Không xoay thì luật rê như cũ.

export const DWELL_MOUSE_MS = 0;
// Tay: 100 ms — bộ lọc One Euro đã khử rung nên đứng yên trên bia không nhấp nháy, nhưng tay lướt ngang
// màn hình (đi tới nút, tới mép) quét qua bia chỉ trong vài khung → không đáng bật đèn + vòng camera.
export const DWELL_HAND_MS = 100;
export const HIDE_MS = 0;
/**
 * r54: sau khi xoay lúc đang focus — con trỏ ở ngoài bia (vùng giữ + thông tin) liên tục ngần này mới rời focus. Rời hover
 * thường là tức thì (HIDE_MS 0); 3 s đủ cho tay nhả nhón / trôi khỏi bia rồi đưa lại, hay chuột kéo xoay xong còn nằm xa bia,
 * mà vẫn không giữ đèn quá lâu khi người xem đã thật sự quay sang việc khác (tới mũi tên, dòng thời gian).
 */
export const HOLD_OUT_MS = 3000;
/** r54: … mất nguồn con trỏ (tay rời khung hình quá cầu nối của lớp cử chỉ / chuột rời trang) ngần này → rời focus. */
export const HOLD_GONE_MS = 2000;

/**
 * @typedef {Object} PresenceInput
 * @property {boolean} hovering
 * @property {'mouse'|'hand'|null} source nguồn con trỏ đang dùng
 * @property {boolean} interacting đang kéo / nhón / zoom
 * @property {boolean} blocked
 * @property {boolean} [orbiting] r54: khung này người dùng vừa cầm camera (kéo quá ngưỡng / lăn / zoom)
 * @property {boolean} [gone] r54: không có nguồn con trỏ (tay mất khỏi khung / chuột rời trang)
 * @property {boolean} [exit] r54: rời có chủ ý — giơ hai ngón (điều hướng / kéo bia), trình chiếu đã đi
 */

export function createPresence() {
  let shown = false;
  let reported = false; // trạng thái đã báo ra ngoài lần gần nhất
  let dwellT0 = 0;
  let hideT0 = 0;
  /** r71: sau khi đóng lớp đọc / bảng vàng — còn giữ thông tin tới lúc này dù con trỏ không ở trên bia (kịp đưa tay về) */
  let graceUntil = 0;
  let latched = false;
  let wasInteracting = false;
  let pinned = false; // ghim bằng phím: bỏ qua mọi bộ đếm
  let forced = false; // bấm vào bia: hiện ngay, rồi theo luật rê như thường
  let orbited = false; // r54: đã xoay / zoom trong lúc focus (tới khi rời focus)
  let outT0 = 0; // r54: lúc con trỏ ra ngoài (đang giữ sau khi xoay)
  let goneT0 = 0; // r54: lúc mất nguồn con trỏ (đang giữ sau khi xoay)
  const clearHold = () => {
    orbited = false;
    outT0 = 0;
    goneT0 = 0;
  };
  // (r39: bỏ "presenting" — tự trình chiếu r19 từng hiện thông tin như đang hover; nay tự trình chiếu không hiện thông tin)

  return {
    get shown() {
      return shown;
    },
    get latched() {
      return latched;
    },
    get pinned() {
      return pinned;
    },
    /** r54: đang focus và đã xoay / zoom trong lúc focus — camera giữ góc của người xem (sân khấu không tự về khung). */
    get orbitHeld() {
      return shown && orbited;
    },
    /** r54 DEV / kiểm thử: trạng thái giữ sau khi xoay. */
    holdState(now = performance.now()) {
      return { orbited, counting: shown && orbited && outT0 > 0, outMs: outT0 ? Math.round(now - outT0) : 0, goneMs: goneT0 ? Math.round(now - goneT0) : 0 };
    },

    /**
     * @param {number} now performance.now()
     * @param {PresenceInput} input
     * @returns {'show'|'hide'|null} thay đổi cần áp cho layout (null = giữ nguyên)
     */
    update(now, input) {
      const { hovering, interacting, blocked } = input;
      const report = () => {
        if (shown === reported) return null;
        reported = shown;
        return shown ? 'show' : 'hide';
      };

      if (blocked) {
        graceUntil = 0;
        shown = false;
        dwellT0 = 0;
        hideT0 = 0;
        latched = false;
        forced = false;
        clearHold();
        wasInteracting = interacting;
        return report();
      }

      if (interacting && !wasInteracting) {
        // r54: đang giữ sau khi xoay (con trỏ ngoài bia) cũng là đang focus — kéo xoay tiếp từ đó vẫn chốt
        latched = shown && (hovering || orbited);
        dwellT0 = 0;
      } else if (!interacting && wasInteracting) {
        latched = false;
      }
      wasInteracting = interacting;
      if (input.exit) {
        // r54: rời có chủ ý → không giữ (ẩn ngay theo luật rê bên dưới)
        graceUntil = 0;
        clearHold();
        latched = false;
      } else if (latched && input.orbiting) orbited = true;

      if (pinned || forced) {
        shown = true;
        dwellT0 = 0;
        hideT0 = 0;
        // Bấm vào bia chỉ "đốt cháy" thời gian chờ; từ đây lại theo luật rê bình thường.
        if (forced && !hovering) forced = false;
      } else if (hovering || latched || now < graceUntil) {
        if (hovering) graceUntil = 0;
        hideT0 = 0;
        outT0 = 0;
        goneT0 = 0;
        if (!shown) {
          if (interacting) dwellT0 = 0;
          else {
            if (!dwellT0) dwellT0 = now;
            const need = input.source === 'hand' ? DWELL_HAND_MS : DWELL_MOUSE_MS;
            if (need <= 0 || now - dwellT0 >= need) {
              shown = true;
              dwellT0 = 0;
            }
          }
        }
      } else if (shown && orbited) {
        // r54: giữ sau khi xoay — đếm thời gian ở ngoài / mất con trỏ
        dwellT0 = 0;
        if (!outT0) outT0 = now;
        if (input.gone) {
          if (!goneT0) goneT0 = now;
        } else goneT0 = 0;
        if (now - outT0 >= HOLD_OUT_MS || (goneT0 && now - goneT0 >= HOLD_GONE_MS)) {
          shown = false;
          hideT0 = 0;
        }
      } else {
        dwellT0 = 0;
        if (shown) {
          if (!hideT0) hideT0 = now;
          if (HIDE_MS <= 0 || now - hideT0 >= HIDE_MS) {
            shown = false;
            hideT0 = 0;
          }
        }
      }
      if (!shown) clearHold();
      return report();
    },

    /** Bấm/chạm gọn vào bia: hiện ngay, không chờ. */
    force() {
      forced = true;
    },

    /** Ghim/bỏ ghim (phím I). Bỏ ghim là ẩn NGAY (đang rê thì lại hiện sau DWELL). */
    pin(on) {
      pinned = !!on;
      graceUntil = 0;
      forced = false;
      hideT0 = 0;
      dwellT0 = 0;
      if (!pinned) {
        shown = false;
        clearHold(); // r54: Esc / nắm tay = Esc — rời có chủ ý
      }
    },

    /**
     * r71: thôi ghim nhưng KHÔNG ẩn ngay (đóng lớp đọc toàn văn / bảng vàng — thông tin vẫn đang hiện): luật rê thường
     * quyết định tiếp (con trỏ không ở trên bia thì ẩn sau độ trễ như thường).
     */
    unpinSoft(graceMs = 2500) {
      pinned = false;
      forced = false;
      hideT0 = 0;
      dwellT0 = 0;
      graceUntil = performance.now() + graceMs;
    },

    /**
     * r72: hiện NGAY và giữ ít nhất ms (giữ hai ngón trên bia mà bia không có gì hơn để mở) — sau đó theo luật rê thường.
     */
    showFor(ms = 4000) {
      forced = true;
      hideT0 = 0;
      dwellT0 = 0;
      graceUntil = performance.now() + ms;
    },

    /** Về trạng thái ẩn, quên mọi bộ đếm (rời view). */
    reset() {
      shown = false;
      reported = false;
      dwellT0 = 0;
      hideT0 = 0;
      latched = false;
      forced = false;
      clearHold();
    },
  };
}
