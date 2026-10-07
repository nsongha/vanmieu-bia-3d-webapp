// Điện ảnh › điều hướng — chọn bia, khoá điều hướng khi đang lướt, ghi hash
//
// step / navUser / select; khoá đổi bia tới khi lượt lướt xong (r26: bấm dồn bị bỏ, không xếp hàng) + tuyến chờ
// (pendingRoute) khi hash đổi giữa chừng; tiếng mõ / gõ khi đổi bia (r32).
//
// Tách cơ học từ index.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem index.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): index*, cur*, navLockT, pendingRoute
//   (* khai báo + giá trị đầu nằm ở index.js, giữ thứ tự khởi tạo cũ)
// Đọc / ghi S của nơi khác: alive, playing, autoMode, errorOn, booting
import { playSound } from '../../../core/sound.js';
import {
  NAV_LOCK_SLACK_MS, NAV_LOCK_START_MS, NAV_QUEUE_ONE
} from './config.js';

export function installNav(S, K, deps) {
  const {
    bia, ctx, host, hud, n, stage, tutorial
  } = deps;

  // ---- Điều hướng
  function step(d, replace) {
    select(S.index + d, replace, d < 0 ? -1 : 1);
  }
  /**
   * r20: người dùng chuyển bia sang một bên (nút, phím ←/→ — cả phím do cú vẩy hai ngón của lớp cử chỉ phát, chạm mép)
   * → mũi tên phía đó loé "đã nhận". r26: đang lướt → bỏ hẳn (không loé, không xếp hàng).
   */
  function navUser(d, fromHand = false) {
    if (tutorial.active) return;
    if (navLocked()) {
      // r51: đang lướt → xếp hàng MỘT lượt (lượt mới thay lượt cũ), chạy khi lướt xong; mũi tên loé "đã nhận" ngay.
      // r52: chỉ chuột / phím — cú vẩy hai ngón (phím tổng hợp của lớp cử chỉ) lúc đang lướt bị BỎ (chờ xong hoạt ảnh)
      if (!NAV_QUEUE_ONE || S.errorOn || fromHand) return;
      S.navQueued = d < 0 ? -1 : 1;
      hud.navFired(d < 0 ? 'prev' : 'next');
      playSound('tok');
      return;
    }
    hud.navFired(d < 0 ? 'prev' : 'next');
    playSound('tok'); // r32: kích hoạt mũi tên (chuột, phím, nhón chọn, cú vẩy hai ngón) — cùng lượt nhón thì chỉ một tiếng
    step(d);
  }

  // ---- r26: khoá đổi bia tới khi lượt lướt xong (NAV_LOCK_*) ------------------------------------------------------
  /** 'wait' = đã đổi bia, chờ chuyển cảnh bắt đầu · 'tx' = đang lướt · null = mở. */
  let navPhase = null;
  S.navLockT = 0;
  /** Địa chỉ mới (lùi / tới của trình duyệt, gõ tay) tới giữa lúc khoá → áp ngay khi mở khoá (chỉ giữ cái cuối). */
  S.pendingRoute = -1;
  /** r51: ‹ › xếp hàng trong lúc khoá (−1 / +1, 0 = không) — chạy ngay khi mở khoá (NAV_QUEUE_ONE; chuột / phím). */
  S.navQueued = 0;
  function navLocked() {
    return stage.transitioning || (navPhase !== null && !S.errorOn);
  }
  function lockNav(phase, ms) {
    navPhase = phase;
    clearTimeout(S.navLockT);
    S.navLockT = window.setTimeout(unlockNav, ms); // lưới an toàn: không bao giờ kẹt khoá
    if (host.dataset.navlock !== '1') host.dataset.navlock = '1'; // mũi tên mờ nhẹ (cinema.css)
  }
  function unlockNav() {
    clearTimeout(S.navLockT);
    S.navLockT = 0;
    navPhase = null;
    if (host.dataset.navlock !== '0') host.dataset.navlock = '0';
    // Địa chỉ đang chờ: áp ở lượt sự kiện SAU — mở khoá thường chạy ngay trong onDone của chuyển cảnh (sân khấu còn đang
    // ở giữa tx.update, xong mới gán tx = null), present() đồng bộ tại đó sẽ bị xoá mất lượt chuyển cảnh mới.
    if (S.pendingRoute >= 0 && S.alive) {
      S.navQueued = 0; // địa chỉ (lùi của trình duyệt…) thắng lượt ‹ › đang chờ
      window.setTimeout(() => {
        if (!S.alive || S.pendingRoute < 0 || navLocked()) return;
        const i = S.pendingRoute;
        S.pendingRoute = -1;
        if (bia[i] && bia[i].id !== S.cur?.id) select(i);
      }, 0);
    } else if (S.navQueued && S.alive) {
      // r51: lượt ‹ › xếp hàng → chạy ở lượt sự kiện SAU (như địa chỉ chờ: đang ở giữa onDone của chuyển cảnh)
      window.setTimeout(() => {
        const d = S.navQueued;
        S.navQueued = 0;
        if (!S.alive || !d || navLocked() || tutorial.active) return;
        hud.navFired(d < 0 ? 'prev' : 'next');
        step(d);
      }, 0);
    }
  }
  // Hợp đồng r20 của sân khấu (cũng là thứ lớp cử chỉ nghe): bắt đầu { active, ms } · xong / bị huỷ { active: false }.
  const onViewTransition = (e) => {
    if (!S.alive) return;
    const d = e.detail || {};
    if (d.active) {
      lockNav('tx', (Number(d.ms) || 0) + NAV_LOCK_SLACK_MS);
      if (!S.booting) playSound('knock', { gain: S.autoMode === 'idle' ? 0.6 : 1 }); // r32: đổi bia — gõ trầm rất khẽ
    }
    else if (navPhase === 'tx') unlockNav(); // (lượt cũ xong trong lúc bia mới còn chờ tải → vẫn giữ khoá 'wait')
  };
  window.addEventListener('view:transition', onViewTransition);

  /**
   * Tự động chuyển bia không nên nhồi lịch sử duyệt web → replaceState.
   * Chốt chặn cuối cùng: view đã rời sân thì không được phép ghi hash nữa, nếu không
   * một luồng async còn sót lại sẽ kéo cả trang quay về #/cinema sau khi đã sang view khác.
   */
  function setHash(id, replace) {
    if (!S.alive) return;
    const target = `#/cinema/${id}`;
    if (location.hash === target) return;
    if (replace && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search + target);
    } else {
      ctx.go('cinema', id);
    }
  }

  function select(i, replace, dir) {
    if (!S.alive || S.booting) return; // mở màn: chưa cho đổi bia
    if (!navLocked()) S.navQueued = 0; // chọn bia khác (dòng thời gian, tự trình chiếu, lượt chờ vừa chạy) → bỏ lượt chờ cũ
    i = ((i % n) + n) % n;
    const entry = bia[i];
    // Hướng chuyển cảnh: theo nút/phím, còn khi bấm thẳng vào một đoạn thì lấy
    // đường ngắn hơn trên vòng 10 bia.
    const way = dir ?? (((i - S.index + n) % n) * 2 <= n ? 1 : -1);
    if (!(replace && S.autoMode === 'idle')) hud.wake(); // tự trình chiếu: HUD giữ yên (nhãn riêng đã báo)
    K.resetAuto();
    if (S.cur && entry.id === S.cur.id) return;

    // Cập nhật trạng thái TRƯỚC khi đụng DOM: HUD có trục trặc thì điều hướng vẫn đi tiếp,
    // lần bấm sau vẫn nhắm đúng bia kế tiếp chứ không kẹt lại.
    S.index = i;
    S.cur = entry;
    K.reliefWindow(); // chữ khắc trên bục của bia đích dựng / đẩy lên GPU NGAY lúc bấm (không chờ bia tải xong)
    try {
      hud.setEntry(entry, i);
      if (S.playing) hud.setAutoProgress(0);
    } catch (err) {
      console.error('[cinema] không cập nhật được HUD', err);
    }
    try {
      setHash(entry.id, replace);
    } catch (err) {
      console.error('[cinema] không đổi được địa chỉ', err);
    }
    // r26: khoá tới khi lượt lướt tới bia này xong (TRƯỚC load: bia đã sẵn thì present() phát view:transition ngay trong
    // lời gọi này → khoá chuyển sang 'tx').
    lockNav('wait', NAV_LOCK_START_MS);
    // Mô hình cũ ở lại sân khấu cho tới khi mô hình mới sẵn sàng (stage.present tự chéo mờ),
    // nên nếu tải hỏng thì vẫn còn gì đó để nhìn.
    K.load(entry, way);
  }
  return {
    navLocked, navUser, onViewTransition, select, step,
  };
}
