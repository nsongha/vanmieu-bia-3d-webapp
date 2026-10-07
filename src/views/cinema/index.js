// Chế độ "Điện ảnh" — toàn màn hình, nền tối, mỗi lúc một tấm bia,
// bàn xoay chậm, bục khắc số năm, HUD tự ẩn.
// Hợp đồng: mount(root, ctx) → { unmount(), update(params) }
// C (tách module): thân mount chia theo trách nhiệm — app/nav.js (chọn bia + khoá khi đang lướt + hash), app/loading.js
// (tải bia / LOD / hàng xóm), app/boot.js (mở màn), app/autoplay.js (▶ tay + tự trình chiếu khi rảnh), app/input.js
// (chuột / chạm / phím / bánh xe / tay), app/dev.js (móc DEV), app/config.js (hằng số). Ở đây còn: dựng HUD / sân khấu /
// thông tin / LOD / hướng dẫn / xoa, vòng khung hình (onBeforeRender / onFrame), tấm thông tin cảm ứng, cài đặt, API.
// Trạng thái dùng chung: S (đầu mount, gom theo module ghi chính); hàm cố định truyền qua deps, dùng sớm qua K.
import './cinema.css';
import { FONT, ensureFont } from '../../core/fonts.js';
import { releaseCpuReleased } from '../../core/loader.js';
import { createLodManager } from './lods.js';
import { isLowPowerDevice, onSettings, AUTO_DWELL_OPTIONS, READER_FIRE_S, getSettings, tnum } from '../../core/settings.js';
import { cinemaBg } from './stage.js';
import { createHud } from './hud.js';
import { createStage } from './stage.js';
import { createInfoHost } from './info/index.js';
import { createPresence } from './presence.js';
import { createRubMode } from './rub.js';
import { HAND_POINTER_IDS, watchInputMode } from './input-mode.js';
import { createTutorial } from './tutorial.js';
import { createVdrag } from './app/vdrag.js';
import { playSound } from '../../core/sound.js';
import {
  AUTO_MS, IDLE_AFTER_S, MAG_RANGE, gestureOn
} from './app/config.js';
import { installNav } from './app/nav.js';
import { installLoading } from './app/loading.js';
import { installBoot } from './app/boot.js';
import { installAutoplay } from './app/autoplay.js';
import { installInput } from './app/input.js';
import { installDev } from './app/dev.js';

/**
 * Bản mount còn sống gần nhất của view này.
 *
 * Router đặt `current = null` TRƯỚC `await import(...)`, nên hai hashchange cùng trỏ vào
 * #/cinema chen nhau trong khoảng chờ đó sẽ mount hai lần mà chỉ unmount một. Bản đầu
 * thành mồ côi: DOM bị thay nhưng vòng lặp, listener window và bộ tự chuyển bia của nó
 * vẫn chạy với alive = true — rồi tự ghi lại hash và kéo cả trang quay về #/cinema.
 * Giữ sổ đăng ký ở đây để mount sau luôn dọn sạch mount trước.
 * @type {{unmount:()=>void}|null}
 */
let activeInstance = null;

export async function mount(root, ctx) {
  // ---- Trạng thái dùng chung giữa các module (C): mỗi nhóm là của module ghi chính; module khác đọc / ghi qua S.x.
  const S = {
    // gốc (index.js): dựng HUD / sân khấu / thông tin / LOD / hướng dẫn / xoa, vòng khung hình, tấm thông tin cảm ứng, dọn dẹp
    alive: undefined, idleCfg: undefined, panelOpen: undefined,
    // nav: điều hướng: chọn bia, khoá khi đang lướt, hash
    index: undefined, cur: undefined, navLockT: undefined, pendingRoute: undefined,
    // loading: tải bia, nâng LOD, tải trước hàng xóm
    token: undefined, loading: undefined, errorOn: undefined, bailT: undefined, stopPrefetch: undefined,
    // boot: mở màn
    booting: undefined,
    // autoplay: tự chuyển (▶ tay) + tự trình chiếu khi rảnh
    playing: undefined, autoMs: undefined, autoDwellMs: undefined, autoDwellCur: undefined, autoMode: undefined, lastInteract: undefined, idleStopT: undefined,
    realMoveT: undefined, autoQuietT: undefined, presentGraceUntil: undefined,
    // input: nhập liệu: chuột / chạm / phím / bánh xe / tay
    pointerDown: undefined, gesture: undefined, wheelUntil: undefined, camTakeN: undefined,
    // dev: móc DEV (window.__vm)
    devLog: undefined, devInfoTrace: undefined,
  };
  /** Hàm / đối tượng cố định dùng TRƯỚC khi nơi tạo ra nó được cài (gán ngay khi có). */
  const K = {};
  // Dọn bản mồ côi (nếu có) trước khi dựng bản mới — xem chú thích ở activeInstance.
  const orphan = activeInstance;
  activeInstance = null;
  if (orphan) {
    try {
      orphan.unmount();
    } catch (err) {
      console.error('[cinema] không dọn được bản mount cũ', err);
    }
  }

  ensureFont(FONT.bodoni);
  ensureFont(FONT.beVietnam);

  const bia = ctx.bia;
  const n = bia.length;
  const reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  S.alive = true;
  S.index = 0;
  S.cur = null;
  S.token = 0;
  S.playing = false;
  S.autoMs = 0;
  // r62: thời gian dừng mỗi bia (settings.cinemaAutoDwell, giây → ms) — tự trình chiếu khi rảnh VÀ ▶ tay; đổi cài đặt áp từ lượt
  // dừng kế tiếp (autoDwellCur chốt lúc một lượt dừng bắt đầu — S.autoMs về 0)
  S.autoDwellMs = AUTO_MS;
  S.autoDwellCur = AUTO_MS;
  // r19: ai bật tự chuyển — 'manual' (▶ bấm tay: chạy tới khi bấm dừng) | 'idle' (tự bật khi rảnh: thao tác đầu tiên là dừng)
  S.autoMode = null;
  S.lastInteract = performance.now();
  S.idleStopT = -1e9;
  S.idleCfg = { on: true, after: 30 };
  // r26: đang tự chuyển mà con trỏ ĐỨNG YÊN kể từ lượt tự chuyển gần nhất → không vào trạng thái hover (bia lướt tới dưới
  // con trỏ không bật đèn / thông tin / vòng camera). realMoveT = lần rê / bấm / lăn thật gần nhất; autoQuietT = lúc bật tự
  // chuyển hoặc lượt tự chuyển gần nhất. presentGraceUntil: xem PRESENT_NOW_GRACE_MS.
  S.realMoveT = -1e9;
  S.autoQuietT = 0;
  S.presentGraceUntil = 0;
  const lastMove = { x: NaN, y: NaN };
  S.loading = false;
  S.errorOn = false;
  S.panelOpen = false;
  S.pointerDown = false;
  S.gesture = null;
  let revealT = 0;
  S.bailT = 0;
  let offSettings = null;
  S.stopPrefetch = null;
  const fineMQ = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
  // Con trỏ: chuột và bàn tay theo dõi riêng (px CSS client); ctx.pointer() trả nguồn đang dùng.
  const mouse = { x: 0, y: 0, active: false, known: false };
  const hand = { x: 0, y: 0, active: false, pinch: false, v: false };
  const pointerOut = { x: 0, y: 0, active: false };
  S.wheelUntil = 0;
  S.camTakeN = 0; // r54: số lần người dùng cầm camera (kéo quá ngưỡng / lăn / zoom tay) — presence: giữ focus sau khi xoay
  let camTakeSeen = 0;
  // Luật hiện/ẩn thông tin theo con trỏ (presence.js) + bia mà kiểu thông tin đang giữ.
  const presence = createPresence();
  let infoEntry = null;
  /** DEV: nhật ký hiện/ẩn có mốc thời gian (cho giả lập chuột / tay). */
  S.devLog = null;
  let devBlocked = false;
  /** DEV: ghi vết thông tin mỗi khung (vm.cinemaInfoTrace(true) bật · (false) trả mảng và tắt). */
  S.devInfoTrace = null;

  const handlers = {
    prev: () => navUser(-1),
    next: () => navUser(1),
    select: (i) => {
      if (tutorial.active || navLocked()) return; // dòng thời gian: đang lướt → bỏ cú bấm (r26); đang hướng dẫn (r32)
      if (!S.cur || bia[((i % n) + n) % n]?.id !== S.cur.id) playSound('tok'); // r32: chọn mốc = một tiếng mõ
      select(i);
    },
    presentNow: () => presentNow(), // r26: bảng cài đặt → "Trình chiếu ngay"
    previewTransition: (kind) => previewTransition(kind), // r84: bảng cài đặt → "Xem thử chuyển cảnh"
    currentStele: () => S.cur?.id ?? null, // r87: bảng cài đặt — "Chữ Hán (số hoá)" chỉ hiện ở bia có văn bản căn chỉnh
    // r32: bảng cài đặt → Cử chỉ → "Xem hướng dẫn"
    startTutorial: () => {
      if (hud.settingsOpen) hud.closeSettings();
      tutorial.start('manual');
    },
    hoverZoomCap: () => stage.hoverZoomCap(), // r27z: bảng cài đặt → gợi ý "giới hạn ở N %" dưới thanh Zoom khi hover
    toggleInfo: () => setPanel(!S.panelOpen), // FAB — chỉ có trên màn cảm ứng
    closeInfo: () => setPanel(false),
    retry: () => {
      if (S.cur) load(S.cur, 1);
    },
  };

  const hud = createHud(root, { bia, handlers });

  // r22: tay ↔ chuột (xem input-mode.js). Sang tay: chuột đứng yên thôi giữ hover / hiện diện / thẻ dòng thời gian.
  // Về chuột: đánh giá lại NGAY vị trí chuột đã biết (như một lần rê), không chờ lần di kế tiếp.
  const inputMode = watchInputMode((mode) => {
    if (!S.alive) return;
    hud.setInputMode(mode);
    if (mode !== 'hand') resetMagnet(); // r27: chuột giành quyền → mũi tên thôi "hút" theo tay ngay (không chờ khung vẽ kế)
    if (mode === 'hand') {
      mouse.active = false;
      rub.mouseLeave();
      stage.clearPointer();
      return;
    }
    if (!mouse.known) return;
    const t = document.elementFromPoint(mouse.x, mouse.y);
    mouse.active = true;
    if (!t || !overScene(t)) {
      stage.clearPointer();
      return;
    }
    const [nx, ny] = toNdc(mouse.x, mouse.y);
    stage.setPointer(nx, ny, S.pointerDown);
  });
  hud.setInputMode(inputMode.mode);
  const host = hud.el.host;
  const stageEl = hud.el.stage;
  // Hạt phim là một lớp phủ toàn màn hình có mix-blend-mode → máy yếu thì bỏ hẳn.
  hud.el.host.dataset.grain = isLowPowerDevice() ? 'off' : 'on';
  stageEl.tabIndex = -1; // nhận focus khi bấm chuột, nhưng không nằm trong thứ tự Tab
  // Hình chữ nhật của sân khấu được nhớ lại: pointermove không nên đo DOM mỗi lần.
  let stageRect = null;
  const rect = () => (stageRect ??= stageEl.getBoundingClientRect());
  // Vùng các kiểu hiện thông tin phải chừa (px client): hàng trên, cụm HUD dưới, và — khi điều
  // khiển bằng tay — hai dải mép chứa đích nam châm. Đo lười, đo lại sau mỗi lần đổi cỡ.
  let safeCache = null;
  let magCentres = null;
  let magK = [-1, -1];
  /** r27: mức gần của tay tới hai mũi tên về 0 ngay (đổi sang chuột, trang bị ẩn) — không chờ vòng vẽ. */
  function resetMagnet() {
    if (magK[0] > 0 || magK[1] > 0) hud.setMagnetNear(0, 0);
    if (magK[0] >= 0) magK = [0, 0];
  }
  const onMagVisibility = () => {
    if (document.hidden) resetMagnet();
  };
  document.addEventListener('visibilitychange', onMagVisibility);
  const forgetLayout = () => {
    stageRect = null;
    safeCache = null;
    magCentres = null;
  };
  /**
   * Nút "i" (FAB — màn cảm ứng / khung hẹp) đang hiện thì chừa cả nó: cộng vào lề PHẢI hoặc lề
   * DƯỚI, bên nào mất ít diện tích hơn (FAB ở giữa mép phải → gần như luôn là lề phải).
   */
  const fabInset = () => {
    const fab = hud.el.fab;
    if (!fab || getComputedStyle(fab).display === 'none') return null;
    const r = fab.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    const hr = host.getBoundingClientRect();
    const right = hr.right - r.left + 8;
    const bottom = hr.bottom - r.top + 8;
    return right * hr.height <= bottom * hr.width ? { right, bottom: 0 } : { right: 0, bottom };
  };
  const safeArea = () => {
    safeCache ??= { top: hud.topInset(), bottom: hud.bottomInset(), fab: fabInset() };
    // r20: mũi tên hai bên hiện với mọi cách điều khiển → luôn chừa dải mép theo kiểu mũi tên đang chọn
    const side = hud.navInset();
    const f = safeCache.fab;
    return {
      top: safeCache.top,
      right: Math.max(side, f ? f.right : 0),
      bottom: Math.max(safeCache.bottom, f ? f.bottom : 0),
      left: side,
    };
  };

  const stage = createStage(stageEl, {
    reduceMotion,
    topInset: () => hud.topInset(),
    onHover: (on) => {
      host.dataset.hot = on && !hoverQuiet() ? '1' : '0'; // r26: tự chuyển + con trỏ đứng yên → không đổi con trỏ "bấm được"
    },
    css3dLayer: hud.el.css3d,
  });

  /**
   * Nguồn con trỏ đang dùng. r22: theo chế độ nhập (input-mode.js) — 'hand': chỉ tay; 'mouse' (chuột thật vừa đi đủ xa /
   * bấm / lăn): chuột trước, tay (thấy mà chưa nhận quyền) chỉ khi chuột không ở trên sân khấu. Trước r22: tay luôn hơn chuột.
   */
  const pointerSource = () => {
    const handOn = hand.active && gestureOn();
    if (inputMode.hand) return handOn ? 'hand' : null;
    return mouse.active ? 'mouse' : handOn ? 'hand' : null;
  };
  const pointerNow = () => {
    const src = pointerSource();
    const p = src === 'hand' ? hand : mouse;
    pointerOut.x = p.x;
    pointerOut.y = p.y;
    pointerOut.active = !!src;
    return pointerOut;
  };

  // Kiểu hiện thông tin (settings.cinemaInfo) — nạp lười, đổi cài đặt là đổi ngay.
  const info = createInfoHost({
    stage,
    hudRoot: hud.el.hudRoot,
    pointer: () => ({ ...pointerNow() }),
    safeArea,
    reduceMotion,
    // r71: lớp đọc toàn văn / bảng vàng phủ màn hình → ghim thông tin; đóng → thôi ghim, không ẩn ngay
    pin: (on) => (on ? presence.pin(true) : presence.unpinSoft()),
    // r75: liên kết tới bia khác trong thông tin mở rộng (năm trong "Những người làm nên tấm bia", thẻ Đề danh)
    hasStele: (id) => bia.some((b) => b.id === id),
    gotoStele: (id) => {
      const i = bia.findIndex((b) => b.id === id);
      if (i >= 0) handlers.select(i);
    },
  });
  // (r71 → r79: tên trên thân bia nhường chỗ lúc focus — r80: người dùng muốn tên ở lại; stage.setNamesHandoff không dùng)
  // r21: LOD + bộ nhớ (82 bia v2 · v1 thì chỉ cửa sổ LOD0)
  const lods = createLodManager({ bia, stage, alive: () => S.alive, lowPower: isLowPowerDevice() });
  // Zoom khi hover (stage) được kẹp theo chỗ kiểu thông tin đang chọn chiếm (bình phong / cột chữ hai bên).
  stage.setZoomGuard(() => info.zoomGuard());

  // "Xoa đầu rùa" (r8): chế độ + nhận biết cử chỉ xoa + giao diện (rub.js); camera / đèn / độ bóng ở sân khấu.
  // r32: hướng dẫn cử chỉ 3 bước cho khách mới (tutorial.js) — lúc chạy, ứng dụng bên dưới đứng yên
  const tutorial = createTutorial({
    host: hud.el.host,
    presenting: () => S.playing,
    blocked: () => S.booting || rub.active || hud.settingsOpen || S.errorOn,
    onStart: () => {
      if (S.playing) setPlaying(false);
      if (presence.pinned) presence.pin(false);
      if (S.panelOpen) setPanel(false);
      noteInteraction();
    },
    onEnd: () => {
      S.lastInteract = performance.now(); // tự trình chiếu đếm lại từ lúc đóng
    },
  });

  const rub = createRubMode({
    stage,
    host,
    toNdc: (x, y) => toNdc(x, y),
    safeArea: () => safeArea(),
    reduceMotion,
    focused: () => presence.shown,
    onChange: (on) => {
      host.dataset.rub = on ? '1' : '0';
      hud.wake();
      if (on) presence.pin(false);
    },
  });
  // (r46 → r62: bỏ "nắm tay giữ 3 s để mở hướng dẫn" (guide.js) — nút "Hướng dẫn" ở hàng trên (hud.js) vẫn mở được)
  // r53: kéo bia bằng hai ngón (app/vdrag.js — r62: kiểu duy nhất của hai ngón ở Điện ảnh); điều hướng khi nhận qua nav select
  // thường.
  // r58: + nắm tay kéo bia (settings.fistGrab) — cầm được khi bia đang focus (hoặc vừa focus trong FIST_FOCUS_GRACE_MS: lúc
  // khép tay thành nắm, con trỏ tay xê dịch có thể làm rời focus một nhịp trước khi lớp cử chỉ xác nhận nắm tay)
  let focusSeenAt = -1e9;
  const FIST_FOCUS_GRACE_MS = 600;
  // r67: body[data-hand-over] — trễ khi rời (xem onBeforeRender)
  let handOverOffAt = -1;
  let handFaceOffAt = -1; // r74: body[data-hand-over-face]
  const HAND_OVER_OFF_MS = 100;
  // r62 (người dùng: "khi vừa transition lướt bằng nắm tay xong đến lúc tay trở về thì nút pre/next đang không bị hút dính. có
  // thể làm tương tự với hover không? tôi thấy nếu user muốn kéo liên tục mà tay vừa trở về (mở) đã bị chờ animation của hover
  // làm phải chờ thì cũng hơi phiền. nếu vừa nắm kéo để lướt thì hãy cho hover chờ 2s. cho vào setting 1 khoảng ngắn để tôi
  // finetune."): lượt kéo (nắm tay / hai ngón) vừa NHẬN đổi bia → hover (focus: đèn, thông tin, camera chính diện + zoom) của bia
  // mới CHỜ settings.grabHoverDelay giây, tính từ lúc tay (đã thả) nằm trên bia mới. Trong lúc chờ, tay trên bia = "SẴN SÀNG CẦM":
  // body[data-stele-focus="1"] (lớp cử chỉ nhận nắm tay kéo bia tiếp, vdrag.focused()) nhưng không có dáng focus nào. Tay rời
  // bia (quá GRAB_HOVER_OFF_MS) → thôi chờ, lần sau hover như thường; đủ giờ mà tay còn trên bia → hover thường bắt đầu. Lúc tay
  // chưa về tới bia: thôi chờ khi chuột / phím, tay rời khung GRAB_HOVER_GONE_MS, tay vào dòng thời gian. Lượt cầm đầu tiên (chưa
  // kéo gì) vẫn cần focus thường.
  //   phase: null (không chờ) · 'pending' (vừa nhận, tay chưa ở trên bia mới) · 'on' (tay trên bia — đang đếm từ t0)
  const grabHover = { phase: null, t0: 0, offAt: -1, goneAt: -1, delayMs: 2000, grabReady: false, why: '' };
  const GRAB_HOVER_OFF_MS = 250; // tay trượt khỏi mép bia thoáng qua (run tay / lúc khép nắm tay) không tính là rời
  const GRAB_HOVER_GONE_MS = 3000;
  const clearGrabHover = (why) => {
    if (!grabHover.phase) return;
    Object.assign(grabHover, { phase: null, t0: 0, offAt: -1, goneAt: -1, grabReady: false, why });
    S.devLog?.push({ t: Math.round(performance.now() - S.devLog.t0), event: 'grab-hover-end', why });
  };
  const armGrabHover = (kind) => {
    if (!(grabHover.delayMs > 0)) return;
    Object.assign(grabHover, { phase: 'pending', t0: 0, offAt: -1, goneAt: -1, grabReady: false, why: kind });
    S.devLog?.push({ t: Math.round(performance.now() - S.devLog.t0), event: 'grab-hover-arm', kind });
  };
  const vdrag = createVdrag({
    stage,
    hud,
    bia,
    lods,
    select: (i, replace, dir) => select(i, replace, dir),
    index: () => S.index,
    blocked: () => S.booting || S.errorOn || tutorial.active || rub.active || hud.settingsOpen || !!document.body.dataset.modal,
    focused: () => presence.shown || grabHover.grabReady || performance.now() - focusSeenAt < FIST_FOCUS_GRACE_MS,
    // r62: lượt kéo vừa nhận đổi bia → hover của bia mới chờ (grabHover)
    onNav: (kind) => armGrabHover(kind),
  });
  // r72 (người dùng: "bỏ gesture 2 ngón cho việc lướt bia. đổi lại thành giữ 2 ngón trên mặt bia 2s để mở full info"): khai báo
  // body[data-hand-vhold="1"] → lớp cử chỉ (r72g) phát 'hand:vhold' { phase: start | progress | fire | cancel, progress, x, y }
  // khi giữ chữ V trên bia (chỉ đếm lúc body[data-hand-over="stele"] — tia từ huy hiệu V trúng bia / bục, xem onBeforeRender),
  // vòng đầy trên huy hiệu V do lớp cử chỉ vẽ. 'fire' (2 s) → mở thông tin đầy đủ: bia có văn bia → lớp đọc toàn màn hình từ
  // đầu; bia khác → hiện thông tin thường ngay (không có gì hơn để mở).
  document.body.dataset.handVhold = '1';
  // r74: chỉ giữ V trên MẶT bia (body[data-hand-over-face]) — lớp cử chỉ đọc cờ khai báo này (thư viện / lab không đặt)
  document.body.dataset.handVholdFace = '1';
  /** DEV (r73): vết giữ V — pha, lý do bỏ qua, lúc mở (xem vm.cinemaVhold). */
  const vholdLog = import.meta.env.DEV ? [] : null;
  // r74: giữ V = QUÉT BẢN DẬP trên mặt bia (stage/scan.js): vạch sáng chạy xuống theo tiến độ giữ, chỗ đã qua hiện bản dập;
  // huỷ → vạch rút lên; đủ giờ → bản dập ở lại suốt lúc đọc. Trong lúc giữ camera + lắc đứng yên (vholdHolding → holdFreeze).
  let vholdHolding = false;
  let scanPrepFor = null;
  const onVhold = (e) => {
    const d = e.detail || {};
    S.devLog?.push({ t: Math.round(performance.now() - S.devLog.t0), event: 'vhold', phase: d.phase, why: d.why ?? null });
    if (!S.alive) return;
    const blockedNow = () => (S.booting ? 'booting' : S.errorOn ? 'error' : tutorial.active ? 'tutorial' : rub.active ? 'rub' : hud.settingsOpen ? 'settings' : info.overlayOpen ? 'open' : '');
    // r73: bắt đầu giữ → tải sẵn dữ liệu bia (lúc 'fire' mở ngay)
    if (d.phase === 'start') {
      info.prepareFull(bia[S.index]);
      if (!blockedNow()) {
        vholdHolding = true;
        stage.scanStart();
        // r84: camera nhích vào khung đọc ngay từ lúc bắt đầu giữ (cài đặt readerCreep; bắn → đoạn tiến vào đi tiếp từ đó)
        if (info.richFor?.(bia[S.index]?.id) !== false) stage.readCreepStart();
      }
      return;
    }
    if (d.phase === 'progress') {
      if (vholdHolding) stage.scanProgress(d.progress ?? 0);
      return;
    }
    if (d.phase === 'cancel') {
      vholdHolding = false;
      stage.scanCancel();
      stage.readCreepCancel(); // r84: nhích về khung thường
      return;
    }
    if (d.phase !== 'fire') return;
    vholdHolding = false;
    const skip = blockedNow();
    let opened = false;
    if (!skip) {
      noteInteraction();
      if (S.playing) setPlaying(false);
      stage.scanFire(); // vạch về chân mặt bia rồi tan — bản dập ở lại (tắt khi đóng lớp đọc)
      opened = info.openFull(bia[S.index], 'top');
      if (!opened) {
        presence.showFor(4000);
        stage.scanRelease(); // bia chưa có lớp đọc: vạch sáng tan luôn
        stage.readCreepCancel();
      }
    } else {
      stage.scanCancel();
      stage.readCreepCancel();
    }
    vholdLog?.push({ t: Math.round(performance.now()), skip, opened, id: bia[S.index]?.id });
  };
  if (import.meta.env.DEV) (window.__vm ??= {}).cinemaVhold = () => vholdLog.slice(-10);

  /**
   * r84 (người dùng: tự chỉnh chuyển cảnh mà không cần cử chỉ): "▶ Xem thử chuyển cảnh" trong bảng cài đặt — chạy cả lượt trên bia
   * đang hiện như giữ V thật: giữ 2 s (vạch quét + camera nhích vào, camera / lắc đứng yên như lúc giữ) → mở → đọc ~2 s → đóng.
   * Bảng cài đặt ẩn tạm suốt lượt (hud.previewHide), hiện lại khi tấm sơn mài / HUD đã trở lại. kind 'open': chỉ giữ + mở (bảng hiện
   * lại khi người xem tự đóng lớp đọc) · 'close': mở nhanh (0,6 s, không quét) rồi đóng theo cài đặt. Trả Promise<boolean>.
   */
  let preview = null;
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitEvent = (type, ms) =>
    new Promise((resolve) => {
      const on = () => {
        clearTimeout(tm);
        window.removeEventListener(type, on);
        resolve(true);
      };
      const tm = setTimeout(() => {
        window.removeEventListener(type, on);
        resolve(false);
      }, ms);
      window.addEventListener(type, on);
    });
  async function previewTransition(kind = 'full') {
    if (preview || !S.alive || S.booting || S.errorOn || tutorial.active || rub.active || info.overlayOpen) return false;
    const e = bia[S.index];
    if (!e) return false;
    preview = { kind, phase: 'start', t0: performance.now() };
    hud.previewHide(true);
    let ok = false;
    try {
      if (S.playing) setPlaying(false);
      noteInteraction();
      info.prepareFull(e);
      await sleepMs(220); // bảng mờ đi
      if (kind !== 'close') {
        preview.phase = 'hold';
        vholdHolding = true; // camera + lắc đứng yên như giữ V thật (trừ đoạn nhích)
        stage.scanStart();
        stage.readCreepStart();
        await sleepMs(READER_FIRE_S * 1000);
        vholdHolding = false;
        if (!S.alive || bia[S.index] !== e) throw new Error('đổi bia');
        stage.scanFire();
        preview.phase = 'open';
        if (!info.openFull(e, 'top')) {
          stage.scanRelease();
          stage.readCreepCancel();
          return false;
        }
      } else {
        preview.phase = 'open';
        if (!info.openFull(e, 'top', { zoomIn: 0.6 })) return false;
      }
      await waitEvent('reader:opened', 12000);
      preview.phase = 'read';
      if (kind === 'open') {
        // chỉ mở: chờ người xem tự đóng (Đóng / Esc / nắm tay)
        while (S.alive && info.overlayOpen) await sleepMs(200);
      } else {
        await sleepMs(kind === 'close' ? 700 : 2000);
        preview.phase = 'close';
        info.closeFull('preview');
      }
      await waitEvent('reader:closed', 12000);
      // tấm sơn mài + HUD trở lại ở readerHoldK × thời gian lùi — bảng cài đặt hiện lại sau đó
      await sleepMs(Math.round(tnum(getSettings(), 'readerHoldK') * tnum(getSettings(), 'readerZoomOut') * 1000 * 0.3) + 150);
      ok = true;
    } catch {
      stage.scanCancel();
      stage.readCreepCancel();
    } finally {
      vholdHolding = false;
      hud.previewHide(false);
      preview = null;
    }
    return ok;
  }
  if (import.meta.env.DEV) (window.__vm ??= {}).cinemaPreview = () => (preview ? { ...preview, t: Math.round(performance.now() - preview.t0) } : null);
  window.addEventListener('hand:vhold', onVhold);
  // r59 → r60: nắm tay kéo bia — bia bắt đầu đi thật (qua vùng chết) → hai nút ‹ › vẫn HIỆN nhưng không hút tay (người dùng:
  // "2 nút next/ prev không cần hide mà chỉ cần không cho hút hover của cursor cho đến lúc tay user về trên bia rùa"):
  // body[data-hand-fistnav="hold"] — vùng dính của hai nút nhường (hud.js data-hand-sticky-yield "fistnav=hold"), không sáng
  // dần theo tay (near() bên dưới). Thôi giữ khi tay (đã thả) quay về bia (tia của tay trúng tấm bia), hoặc dự phòng: tay rời
  // khung ~3 s · chuột · phím. r62: kéo bia hai ngón cũng giữ như vậy (cùng luật — tên thuộc tính giữ nguyên); cú cầm không kéo
  // đi thì không giữ.
  let navHold = false;
  let navHoldGoneAt = -1;
  let moveSeqSeen = 0;
  const NAV_HOLD_GONE_MS = 3000;
  const releaseNavHold = () => {
    navHold = false;
    navHoldGoneAt = -1;
    if (document.body.dataset.handFistnav) delete document.body.dataset.handFistnav;
  };
  // chuột thật / phím: thôi giữ hai nút + thôi chờ hover (người xem đã chuyển sang cách điều khiển khác)
  const onGrabHoldKey = () => {
    if (navHold) releaseNavHold();
    clearGrabHover('key');
  };
  const onGrabHoldPointer = (e) => {
    if ((!navHold && !grabHover.phase) || e.pointerType !== 'mouse' || HAND_POINTER_IDS.has(e.pointerId)) return;
    if (e.movementX || e.movementY) {
      if (navHold) releaseNavHold();
      clearGrabHover('mouse');
    }
  };
  window.addEventListener('keydown', onGrabHoldKey, true);
  window.addEventListener('pointermove', onGrabHoldPointer, { passive: true });
  // ---- nav (app/nav.js)
  const {
    navLocked, navUser, onViewTransition, select, step
  } = installNav(S, K, {
    bia, ctx, host, hud, n, stage, tutorial
  });
  // ---- loading (app/loading.js)
  const {
    afterPresent, load, loadFull, neighboursOf, reliefWindow
  } = installLoading(S, K, {
    bia, hud, lods, n, reduceMotion, stage
  });
  Object.assign(K, { load, reliefWindow });
  // ---- boot (app/boot.js)
  const {
    boot
  } = installBoot(S, K, {
    afterPresent, bia, host, hud, info, loadFull, lods, neighboursOf, reliefWindow, stage
  });
  // ---- autoplay (app/autoplay.js)
  const {
    autoStep, canAutoStart, hoverQuiet, noteInteraction, onAnyKey, onAnyPointer, presentNow, resetAuto, setPlaying,
    togglePlayUser
  } = installAutoplay(S, K, {
    host, hud, inputMode, lastMove, navLocked, presence, rub, setPanel, stage, step, tutorial
  });
  Object.assign(K, { resetAuto });

  /** Tấm trượt DOM (màn cảm ứng): mở/đóng. Máy có chuột dùng kiểu hiện thông tin khi rê lên bia. */
  function setPanel(v, reason = '') {
    if (v) {
      if (S.panelOpen || !S.cur) return;
      S.panelOpen = true;
      hud.setPanel(true);
      hud.wake();
      S.devLog?.push({ t: Math.round(performance.now() - S.devLog.t0), event: 'sheet-open', reason });
      return;
    }
    if (!S.panelOpen) return;
    hud.setPanel(false);
    S.panelOpen = false;
    S.devLog?.push({ t: Math.round(performance.now() - S.devLog.t0), event: 'sheet-close', reason });
  }
  // ---- input (app/input.js)
  const {
    clearHand, onCancel, onDown, onHandFrame, onKey, onPointerLeave, onPointerMove, onRubDown, onUp, onWheel, overScene,
    toNdc
  } = installInput(S, K, {
    fineMQ, forgetLayout, hand, host, hud, inputMode, mouse, n, navLocked, navUser, noteInteraction, presence, rect,
    rub, select, setPanel, stage, stageEl, togglePlayUser, tutorial
  });

  // ---- Thông tin bia: luật hiện/ẩn chạy NGAY TRƯỚC lượt vẽ (cùng nhịp với kiểu hiện thông tin)
  stage.onBeforeRender((dt, now) => {
    if (!S.alive) return;
    if (hand.active && !gestureOn()) clearHand();
    const src = pointerSource();
    const p = src === 'hand' ? hand : mouse;
    const onStele = src === 'hand' ? stage.handHit : src === 'mouse' ? stage.mouseHit : false;
    // r30g: tia của TAY trúng tấm bia → vùng dính dòng thời gian (1/3 dưới) nhường cho bia (data-hand-sticky-yield="stele")
    const handStele = src === 'hand' && !!stage.handHit;
    if (handStele !== document.body.hasAttribute('data-hand-stele')) document.body.toggleAttribute('data-hand-stele', handStele);
    // r67 (người dùng: "cursor sẽ có màu vàng và out line hơi dày hơn khi ở trên bia đá + bục. khi di chuyển khỏi thì sẽ có màu xám
    // và viền mỏng hơn"): body[data-hand-over="stele"] — tia của CON TRỎ TAY trúng bia (rùa + phiến + trán) hoặc bục (thân +
    // lòng bục) của bia đang hiện; lớp cử chỉ tô con trỏ theo cờ này. Chỉ tay (chuột không đổi), không phụ thuộc focus (cả lúc
    // chờ hover sau khi kéo, lúc nghỉ). Tay đang ở vùng dính HUD (dòng thời gian / mũi tên) → không tính. Rời: trễ HAND_OVER_OFF_MS
    // (mép bia / bục không chớp); mất tay → gỡ ngay.
    const overRaw = hand.active && gestureOn() && !document.body.dataset.handSticky && (!!stage.handHit || !!stage.handPedHit);
    if (overRaw) {
      handOverOffAt = -1;
      if (document.body.dataset.handOver !== 'stele') document.body.dataset.handOver = 'stele';
    } else if (document.body.dataset.handOver) {
      if (!hand.active || !gestureOn()) delete document.body.dataset.handOver;
      else if (handOverOffAt < 0) handOverOffAt = now;
      else if (now - handOverOffAt >= HAND_OVER_OFF_MS) {
        handOverOffAt = -1;
        delete document.body.dataset.handOver;
      }
    }
    // r74 (người dùng: giữ hai ngón chỉ trên MẶT BIA): body[data-hand-over-face="1"] — tia của tay trúng mặt trước phiến bia (không
    // rùa / bục / hông / lưng phiến); cùng độ trễ rời như trên. Lớp cử chỉ (vhold.js) chỉ đếm giữ V khi có cờ này (view khai báo
    // body[data-hand-vhold-face="1"]).
    const faceRaw = overRaw && !!stage.handFace;
    if (faceRaw) {
      handFaceOffAt = -1;
      if (document.body.dataset.handOverFace !== '1') document.body.dataset.handOverFace = '1';
    } else if (document.body.dataset.handOverFace) {
      if (!hand.active || !gestureOn()) delete document.body.dataset.handOverFace;
      else if (handFaceOffAt < 0) handFaceOffAt = now;
      else if (now - handFaceOffAt >= HAND_OVER_OFF_MS) {
        handFaceOffAt = -1;
        delete document.body.dataset.handOverFace;
      }
    }
    // r84: body[data-hand-over-face-near="1"] — tay trong hình chiếu MẶT BIA nới rộng (stage.handFaceNear): lớp cử chỉ (vhold.js) giữ
    // lượt giữ V đã bắt đầu trên mặt bia khi tay còn ở đây (camera nhích vào làm mặt bia trôi dưới tay — không huỷ vì tia trượt mép)
    const nearRaw = hand.active && gestureOn() && !document.body.dataset.handSticky && !!stage.handFaceNear;
    if (nearRaw !== (document.body.dataset.handOverFaceNear === '1')) {
      if (nearRaw) document.body.dataset.handOverFaceNear = '1';
      else delete document.body.dataset.handOverFaceNear;
    }
    // Đang hiện: còn trong vùng giữ hover (bia ở cả khung 3/4 lẫn chính diện, nới rộng) vẫn tính là hover —
    // camera vòng về chính diện khi hover làm bia trượt khỏi con trỏ, không được vì thế mà ẩn rồi hiện lại.
    const inLatch = presence.shown && (src === 'hand' ? stage.handLatch : src === 'mouse' ? stage.mouseLatch : false);
    // r26: tự chuyển + con trỏ đứng yên từ lượt tự chuyển gần nhất → không hover (xem hoverQuiet)
    const quiet = hoverQuiet();
    // r27: ba đích rê loại trừ nhau — bia · dòng thời gian · hai mũi tên. Tay đang ở một vùng dính (dòng thời gian / mũi
    // tên — body[data-hand-sticky], lớp cử chỉ đặt lúc vào, gỡ lúc ra) → bia thôi hover: đèn, thông tin, camera chính diện
    // (cả lúc lướt). Ra khỏi vùng về lại bia → hover lại qua độ trễ rê bình thường (presence). Chuột: trên dòng thời gian /
    // mũi tên vốn đã không bắn tia vào bia (overScene → clearPointer).
    // r71: vùng dính của CHÍNH tấm thông tin (nút "Xem đủ…", "Đọc toàn văn" — tên "info-…") thì vẫn là đang ở bia
    const stuck = document.body.dataset.handSticky;
    const handInHud = src === 'hand' && !!stuck && !stuck.startsWith('info-');
    // r53: đang giữ hai ngón (kéo bia) → nghỉ: không hover / đèn / thông tin, camera không vòng chính diện
    // r58: nắm tay kéo bia — đang cầm thì nghỉ như V (focus tắt dần, thay bằng dáng "cầm"), bất kể nguồn con trỏ khung này
    const vHeld = vdrag.held && (src === 'hand' || vdrag.grabKind === 'fist');
    // r62: chờ hover sau khi kéo đổi bia (grabHover — xem chỗ khai báo)
    let hoverHeld = false;
    grabHover.grabReady = false;
    if (grabHover.phase) {
      if (!(grabHover.delayMs > 0)) clearGrabHover('off');
      else if (vdrag.held) {
        // đang giữ nắm tay / V (lượt cầm mới, hoặc tay chưa mở sau lượt vừa nhận): đếm lại từ lúc thả, tay trên bia
        Object.assign(grabHover, { phase: 'pending', t0: 0, offAt: -1, goneAt: -1 });
        hoverHeld = true;
      } else if (src === 'mouse') clearGrabHover('mouse');
      else if (src === 'hand' && onStele) {
        grabHover.offAt = -1;
        grabHover.goneAt = -1;
        if (grabHover.phase === 'pending') {
          grabHover.phase = 'on';
          grabHover.t0 = now;
        }
        if (now - grabHover.t0 >= grabHover.delayMs) clearGrabHover('delay'); // đủ giờ: hover thường bắt đầu ngay khung này
        else hoverHeld = grabHover.grabReady = true;
      } else if (grabHover.phase === 'on') {
        // tay rời bia (thoáng qua thì vẫn sẵn sàng cầm)
        if (grabHover.offAt < 0) grabHover.offAt = now;
        if (now - grabHover.offAt >= GRAB_HOVER_OFF_MS) clearGrabHover('left');
        else hoverHeld = grabHover.grabReady = true;
      } else {
        // chưa về tới bia mới (còn đang lướt / tay còn ở bên)
        if (!hand.active) {
          if (grabHover.goneAt < 0) grabHover.goneAt = now;
          else if (now - grabHover.goneAt >= GRAB_HOVER_GONE_MS) clearGrabHover('gone');
        } else grabHover.goneAt = -1;
        if (grabHover.phase && document.body.dataset.handSticky === 'timeline') clearGrabHover('timeline');
        hoverHeld = !!grabHover.phase;
      }
    }
    stage.setPointerQuiet(quiet || handInHud || vHeld || hoverHeld);
    const hot = quiet || !stage.mouseHit ? '0' : '1';
    if (host.dataset.hot !== hot) host.dataset.hot = hot;
    // r72g → r73: đang giữ chữ V (giữ trên bia 2 s = mở thông tin đầy đủ) — hand:frame v: true, hover: false: không tạo focus
    // mới; V TRÊN bia giữ focus đang có (thông tin không gập giữa lúc đang giữ); V ngoài bia trung tính (như tay vắng — luật
    // rời / giữ-sau-khi-xoay đếm như thường)
    const vHold = src === 'hand' && hand.v;
    const hovering = vHold
      ? presence.shown && (onStele || inLatch) && !quiet && !handInHud && !vHeld
      : !quiet && !handInHud && !vHeld && !hoverHeld && !!src && (onStele || inLatch || info.hitTest(p.x, p.y));
    const interacting = S.pointerDown || hand.pinch || now < S.wheelUntil;
    // Đang tải / chuyển cảnh / lỗi / tấm trượt cảm ứng đang mở → thông tin ẩn ngay.
    // r32: đang hướng dẫn → bia không hover, không xoa (ứng dụng bên dưới đứng yên)
    const busy = S.loading || S.errorOn || S.panelOpen || stage.transitioning || tutorial.active;
    // Xoa đầu rùa: xoa để mở (trứng phục sinh — r70), vào / ra, nhận biết xoa (dùng trạng thái hiện thông tin của khung trước).
    // handBusy: bàn tay đang làm việc khác — nhón (xoay), chữ V, cầm / kéo bia, chờ hover sau khi kéo, vùng dính HUD → không
    // bao giờ tính là xoa để mở.
    const rubHandBusy = hand.pinch || vdrag.held || !!grabHover.phase || !!document.body.dataset.handNav || !!document.body.dataset.steleGrab || !!document.body.dataset.handSticky;
    rub.update(dt, now, { shown: presence.shown, blocked: busy, gesture: gestureOn(), handBusy: rubHandBusy });
    // r28 → r70: đang xoa để mở trên đầu rùa → vòng camera hover + lắc đứng yên, đầu rùa không trượt khỏi tay / chuột
    // (trước đây vòng chính diện + zoom lúc hover bắt đầu kéo đầu rùa đi ~75 px trong 0,5 s)
    stage.setHoldFreeze(rub.holding || vholdHolding); // r74: … và lúc đang giữ V quét bản dập (camera không trôi)
    // … và trong chế độ xoa, thông tin hover cũng ẩn — cả lúc camera còn đang bay về khung sau khi rời chế độ (hiện
    // giữa đường thì đích camera đổi theo vòng hover + dựng thông tin rơi vào giữa hoạt ảnh).
    const blocked = busy || rub.active || stage.rub.leaving;
    // r31g: đang xoa đầu rùa / camera đang bay về sau khi xoa → lớp tay tắt hẳn các vùng dính (mũi tên, dòng thời gian)
    const zonesOff = rub.active || stage.rub.leaving;
    if (zonesOff !== document.body.hasAttribute('data-hand-zones-off')) document.body.toggleAttribute('data-hand-zones-off', zonesOff);
    hud.setRubHidden(zonesOff); // r34: … và hai mũi tên + dòng thời gian ẩn hẳn (cả với chuột)
    // r54: giữ focus sau khi xoay (presence.js) — khung này có cầm camera không · mất nguồn con trỏ · rời có chủ ý (giơ hai ngón
    // để đổi bia / kéo bia, trình chiếu đã đi — không chờ đếm)
    const orbiting = S.camTakeN !== camTakeSeen;
    camTakeSeen = S.camTakeN;
    const exit = quiet || vHeld || !!document.body.dataset.handNav;
    const change = presence.update(now, { hovering, source: src, interacting, blocked, orbiting, gone: !src, exit });
    stage.setFocusHold(presence.orbitHeld); // camera giữ góc người xem vừa chọn (không tự về khung khi rảnh, không lắc)
    // r58: bia đang focus — hoặc đang nắm tay cầm bia (focus đã tắt dần nhưng nắm tay vẫn thuộc về "cầm bia" tới khi mở tay)
    // → body[data-stele-focus="1"] (hợp đồng với lớp cử chỉ + guide.js: nắm tay lúc này không là Esc / không đếm 3 s mở hướng
    // dẫn / không vòng nắm tay)
    // r62: … hoặc tay đang "sẵn sàng cầm" trên bia mới trong lúc chờ hover (grabHover)
    if (presence.shown || grabHover.grabReady) focusSeenAt = now;
    // r74: focus trên bia có bản dập → nạp lười ảnh bản dập (một lần mỗi bia, nhớ trong stage/scan.js) — giữ V là có ngay
    if (presence.shown && S.cur && S.cur.id !== scanPrepFor) {
      scanPrepFor = S.cur.id;
      if (stage.scanHas(S.cur.id)) stage.scanPrepare(S.cur.id);
    }
    // r86: mỗi lần focus lại gọi lại (nạp đã nhớ — rẻ): bật "Quét bản dập" / ánh sáng chữ sau một lần focus lúc cả hai tắt vẫn nạp
    if (!presence.shown) scanPrepFor = null;
    // r59 → r62: hai nút ‹ › lúc kéo bia (nắm tay / hai ngón) — bắt theo sườn: lượt cầm vừa kéo bia đi thật
    if (vdrag.moveSeq !== moveSeqSeen) {
      moveSeqSeen = vdrag.moveSeq;
      if (!navHold) {
        navHold = true;
        navHoldGoneAt = -1;
        document.body.dataset.handFistnav = 'hold';
      }
    }
    if (navHold && !vdrag.held) {
      if (src === 'hand' && onStele) releaseNavHold(); // tia của tay trúng tấm bia (không tính vùng giữ hover — rộng quá)
      else if (!hand.active) {
        if (navHoldGoneAt < 0) navHoldGoneAt = now;
        else if (now - navHoldGoneAt >= NAV_HOLD_GONE_MS) releaseNavHold();
      } else navHoldGoneAt = -1;
    }
    // (+ ân hạn FIST_FOCUS_GRACE_MS sau khi rời focus — cùng luật vdrag dùng để nhận cú nắm tay: hai bên luôn khớp nhau)
    const steleFocus = presence.shown || vdrag.grabKind === 'fist' || grabHover.grabReady || now - focusSeenAt < FIST_FOCUS_GRACE_MS;
    if (steleFocus !== (document.body.dataset.steleFocus === '1')) {
      if (steleFocus) document.body.dataset.steleFocus = '1';
      else delete document.body.dataset.steleFocus;
    }
    // Bia đổi trong lúc ẩn → đưa nội dung mới cho kiểu thông tin khi mọi hoạt ảnh đã xong.
    if (!blocked && S.cur && infoEntry !== S.cur && !presence.shown) {
      infoEntry = S.cur;
      info.setEntry(S.cur);
    }
    if (change === 'show' && S.cur) {
      infoEntry = S.cur;
      info.show(S.cur);
      stage.setSelected(true); // đèn bục (dải sáng + vũng sàn + tia), cùng nhịp với thông tin
      // r50: rê TAY lên bia, thông tin hiện (đủ lâu) = một thao tác làm xong — lớp cử chỉ đánh giá khách mới (core/hand/coach.js)
      if (src === 'hand') window.dispatchEvent(new CustomEvent('hand:did', { detail: { kind: 'focus', on: true } }));
    } else if (change === 'hide') {
      window.dispatchEvent(new CustomEvent('hand:did', { detail: { kind: 'focus', on: false } }));
      info.hide();
      stage.setSelected(false);
    }
    if (S.devLog) {
      if (change) S.devLog.push({ t: Math.round(now - S.devLog.t0), event: change, src, hovering, interacting, latched: presence.latched, hold: presence.holdState(now) });
      if (blocked !== devBlocked) S.devLog.push({ t: Math.round(now - S.devLog.t0), event: blocked ? 'blocked' : 'unblocked' });
    }
    devBlocked = blocked;
    info.update(dt);
    // DEV: ghi vết thông tin mỗi khung (vm.cinemaInfoTrace) — vị trí / góc gập / độ đục qua chuyển cảnh.
    if (import.meta.env.DEV && S.devInfoTrace) {
      const c = info.ctx.camera.position;
      S.devInfoTrace.push({
        t: Math.round(now - S.devInfoTrace.t0),
        tx: +(window.__vm?.cinemaTxProgress?.() ?? -1).toFixed(4),
        shown: presence.shown,
        cam: [c.x, c.y, c.z].map((v) => +v.toFixed(4)),
        info: info.debugState(),
      });
    }
  });

  // ---- Vòng lặp
  let wasTx = false;
  stage.onFrame((dt) => {
    if (!S.alive) return;
    const now = performance.now();
    // r21: chuyển cảnh vừa xong → bia rời đi đã trả bản sao → LOD0 ngoài cửa sổ ra khỏi bộ nhớ ngay
    const txNow = stage.transitioning;
    if (wasTx && !txNow) lods.evictNow();
    wasTx = txNow;
    // r19: rảnh đủ lâu → tự trình chiếu (▶ + Lướt) — r39: mỗi bia dừng AUTO_MS (r62: settings.cinemaAutoDwell), không thông
    // tin / hiệu ứng hover
    if (!S.playing && S.idleCfg.on && now - S.lastInteract >= S.idleCfg.after * 1000 && canAutoStart()) setPlaying(true, 'idle');
    if (S.playing && !S.loading && !S.errorOn && !S.panelOpen && !presence.shown && !S.pointerDown && !document.hidden) {
      if (S.autoMs === 0) S.autoDwellCur = S.autoDwellMs; // r62: lượt dừng mới → chốt thời gian dừng theo cài đặt hiện tại
      S.autoMs += dt * 1000;
      hud.setAutoProgress(Math.min(1, S.autoMs / S.autoDwellCur));
      if (S.autoMs >= S.autoDwellCur && autoStep()) S.autoMs = 0; // r26: đang khoá → đợi lượt lướt xong rồi mới đi
    }
    hud.tickVisibility(now, S.panelOpen || S.errorOn || S.pointerDown);
    // Đích nam châm: sáng dần khi con trỏ tay tiến lại (chỉ ghi style khi mức đổi).
    if (gestureOn()) {
      magCentres ??= hud.magnetCentres();
      // khoảng cách tới MÉP nút (mũi tên cao, hẹp — không tính theo tâm). r27: chỉ khi TAY đang nắm quyền (chuột giành
      // lại thì tay còn trong khung cũng không giữ mũi tên ở dáng "đang rê") và trang đang hiện.
      // r29: đang nhón–kéo camera (hay nhấn giữ trên sân khấu) → con trỏ tay đi ngang mũi tên không làm nó sáng /
      // gập / hút vào (vùng dính do lớp cử chỉ lo: không vào khi đang nhón / kéo)
      // r45g: 1/3 dưới màn hình thuộc dòng thời gian (mờ dần trong 5vh trên đường 2/3 — không nhảy), và tay đang ở dòng thời
      // gian (dính / trong vùng của nó) thì mũi tên không sáng / gập theo tay — như vùng dính của mũi tên (hud.js)
      const low = Math.min(1, Math.max(0, ((innerHeight * 2) / 3 - hand.y) / (innerHeight * 0.05)));
      const onTl = document.body.dataset.handSticky === 'timeline' || document.body.dataset.handArea === 'timeline';
      const near = (c) =>
        hand.active && hand.hover !== false && inputMode.hand && !document.hidden && !S.pointerDown && !hand.pinch && !tutorial.active && !hud.rubHidden && !document.body.hasAttribute('data-hand-zones-unarmed') && !onTl && !navHold
          ? low * Math.min(1, Math.max(0, 1 - Math.hypot(Math.max(c.left - hand.x, 0, hand.x - c.right), Math.max(c.top - hand.y, 0, hand.y - c.bottom)) / MAG_RANGE))
          : 0;
      const a = Math.round(near(magCentres.prev) * 20) / 20;
      const b = Math.round(near(magCentres.next) * 20) / 20;
      if (a !== magK[0] || b !== magK[1]) {
        magK = [a, b];
        hud.setMagnetNear(a, b);
      }
    } else if (magCentres) {
      magCentres = null; // đo lại lần bật cử chỉ sau (lúc tắt thì đích không có kích thước)
      // r27: tắt cử chỉ giữa lúc tay đang tiến lại → mũi tên về nghỉ (trước đây --hand treo ở mức cuối)
      if (magK[0] > 0 || magK[1] > 0) hud.setMagnetNear(0, 0);
      magK = [-1, -1];
    }
  });

  // Màu nền phía CSS (canvas do stage lo) — giữ cho mép ngoài canvas cùng tông.
  let navStyle = '';
  let tlStyle = '';
  offSettings = onSettings((s) => {
    const ns = s.cinemaArrows || 'gold';
    if (ns !== navStyle) {
      navStyle = ns;
      hud.setNavStyle(ns);
      forgetLayout(); // dải mép chừa cho thông tin + vị trí đích nam châm đổi theo kiểu
    }
    // r43: kiểu dòng thời gian (Thước khắc · Sợi chỉ)
    const ts = s.cinemaTimeline || 'ruler';
    if (ts !== tlStyle) {
      tlStyle = ts;
      hud.setTimelineStyle(ts);
      forgetLayout(); // chiều cao cụm HUD dưới đổi theo kiểu dòng thời gian
    }
    // r77: quét bản dập khi mở toàn văn — tắt: không vạch / bản dập (đang hiện dở thì tắt ngay), vòng đếm trên huy hiệu V như
    // r72g (body[data-hand-vhold-scan] vắng → cinema.css không ẩn vòng)
    const scanOn = s.cinemaRubbingScan !== false;
    stage.scanEnable(scanOn);
    if (scanOn) document.body.dataset.handVholdScan = '1';
    else delete document.body.dataset.handVholdScan;
    // r62: chờ hover sau khi kéo đổi bia (giây → ms)
    const gd = Number(s.grabHoverDelay);
    grabHover.delayMs = Number.isFinite(gd) ? Math.max(0, gd) * 1000 : 2000;
    // r62: "Mỗi bia" (giây) — lạ → mặc định AUTO_MS
    const dw = Number(s.cinemaAutoDwell);
    S.autoDwellMs = AUTO_DWELL_OPTIONS.includes(dw) ? dw * 1000 : AUTO_MS;
    const after = Number(s.cinemaIdleAfter);
    S.idleCfg = { on: s.cinemaIdleAutoplay !== false, after: IDLE_AFTER_S.includes(after) ? after : 30 };
    if (!S.idleCfg.on && S.autoMode === 'idle') setPlaying(false);
    const bg = cinemaBg(s.bg?.cinema);
    host.style.setProperty('--bg', bg);
    document.body.style.setProperty('--cin-bg', bg);
  });

  hud.setPlaying(false);
  stage.start();

  // ---- Bia mở đầu: theo tham số URL, không có thì lấy bia đầu tiên.
  const startIdx = Math.max(0, bia.findIndex((b) => b.id === ctx.params?.[0]));
  S.index = startIdx;
  S.cur = bia[startIdx];
  hud.setEntry(S.cur, startIdx);
  ctx.go('cinema', S.cur.id);
  // Mở màn (r16): màn tối + vạch tải che sân khấu tới khi mọi thứ lần đầu đã sẵn (xem boot()).
  boot(S.cur);
  // ---- dev (app/dev.js)
  installDev(S, K, {
    clearHand, hud, info, lods, presence, rub, setPanel, stage, step, toNdc, tutorial
  });
  if (import.meta.env.DEV) {
    /**
     * DEV (r62): chờ hover sau khi kéo đổi bia — phase, ms đã đếm trên bia, còn lại, sẵn sàng cầm, giữ hai nút ‹ ›.
     * r70: { arm: 'fist' | 'v' } → bật chờ như vừa kéo đổi bia xong (thử xoa đầu rùa không mở trong lúc chờ).
     */
    (window.__vm ??= {}).cinemaGrabHover = (o) => {
      if (o?.arm) armGrabHover(o.arm);
      const now = performance.now();
      const on = grabHover.phase === 'on';
      return { phase: grabHover.phase, delayMs: grabHover.delayMs, elapsed: on ? Math.round(now - grabHover.t0) : 0, left: on ? Math.max(0, Math.round(grabHover.delayMs - (now - grabHover.t0))) : grabHover.phase ? grabHover.delayMs : 0, grabReady: grabHover.grabReady, why: grabHover.why, navHold };
    };
  }

  const api = {
    update(params) {
      const id = params?.[0];
      if (!id || (S.cur && id === S.cur.id)) return;
      const i = bia.findIndex((b) => b.id === id);
      if (i < 0) return;
      // r26: địa chỉ đổi (lùi / tới của trình duyệt) giữa lúc đang lướt → áp ngay khi lượt lướt xong (unlockNav), không
      // bỏ — địa chỉ và bia đang hiện không được lệch nhau.
      if (navLocked()) {
        S.pendingRoute = i;
        return;
      }
      S.pendingRoute = -1;
      select(i);
    },
    unmount() {
      // Hạ cờ TRƯỚC mọi thứ khác: từ giây phút này mọi continuation đang bay đều tự huỷ.
      S.alive = false;
      S.token++;
      if (activeInstance === api) activeInstance = null;
      clearTimeout(revealT);
      clearTimeout(S.bailT);
      revealT = 0;
      S.bailT = 0;

      // Mỗi bước dọn dẹp chạy độc lập: một bước ném lỗi cũng không được để sót
      // listener nào ở lại (listener sót = view đã chết vẫn lái được cả trang).
      const steps = [
        () => offSettings?.(),
        () => S.stopPrefetch?.(),
        () => lods.stop(),
        () => document.body.style.removeProperty('--cin-bg'),
        () => host.removeEventListener('pointermove', onPointerMove),
        () => host.removeEventListener('pointerleave', onPointerLeave),
        () => window.removeEventListener('resize', forgetLayout),
        () => stageEl.removeEventListener('pointerdown', onDown),
        () => stageEl.removeEventListener('pointerdown', onRubDown, true),
        () => rub.dispose(),
        () => stageEl.removeEventListener('wheel', onWheel),
        () => window.removeEventListener('pointerup', onUp),
        () => window.removeEventListener('pointercancel', onCancel),
        () => window.removeEventListener('keydown', onKey, true),
        () => window.removeEventListener('hand:frame', onHandFrame),
        () => document.body.removeAttribute('data-hand-stele'), // r30g
        () => document.body.removeAttribute('data-hand-over'), // r67
        () => document.body.removeAttribute('data-stele-focus'), // r58
        () => {
          // r59 → r62
          releaseNavHold();
          clearGrabHover('unmount');
          window.removeEventListener('keydown', onGrabHoldKey, true);
          window.removeEventListener('pointermove', onGrabHoldPointer);
        },
        () => document.body.removeAttribute('data-hand-zones-off'), // r31g
        () => window.removeEventListener('view:transition', onViewTransition),
        () => document.removeEventListener('visibilitychange', onMagVisibility),
        () => clearTimeout(S.navLockT),
        () => window.removeEventListener('pointermove', onAnyPointer, true),
        () => window.removeEventListener('pointerdown', onAnyPointer, true),
        () => window.removeEventListener('wheel', onAnyPointer, true),
        () => window.removeEventListener('keydown', onAnyKey, true),
        () => inputMode.destroy(),
        () => tutorial.destroy(),
        () => vdrag.destroy(),
        () => {
          window.removeEventListener('hand:vhold', onVhold);
          if (document.body.dataset.handVhold === '1') delete document.body.dataset.handVhold;
          if (document.body.dataset.handVholdFace === '1') delete document.body.dataset.handVholdFace;
          delete document.body.dataset.handVholdScan;
          delete document.body.dataset.handOverFace;
          delete document.body.dataset.handOverFaceNear;
          delete document.body.dataset.handOver;
        },
        () => {
          if (import.meta.env.DEV && window.__vm) {
            for (const k of ['cinemaTx', 'cinemaInfo', 'cinemaRich', 'cinemaRub', 'cinemaInfoTrace', 'cinemaLoop', 'cinemaStep', 'cinemaStelePoint', 'cinemaMouseSim', 'cinemaHandSim', 'cinemaNavSim', 'cinemaPerf', 'cinemaIdle', 'cinemaPresence', 'cinemaGrabHover', 'cinemaVhold', 'cinemaLods', 'cinemaTimeline', 'cinemaSticky', 'cinemaStickyPinch']) delete window.__vm[k];
          }
        },
        () => stage.onFrame(null),
        () => stage.onBeforeRender(null),
        () => info.dispose(),
        () => stage.stop(),
        () => stage.dispose(),
        () => releaseCpuReleased(), // r21: bản gốc đã nhả dữ liệu CPU texture chỉ dùng được với renderer của view này
        () => hud.destroy(),
        () => root.replaceChildren(),
      ];
      for (const fn of steps) {
        try {
          fn();
        } catch (err) {
          console.error('[cinema] lỗi khi dọn dẹp', err);
        }
      }
    },
  };

  activeInstance = api;
  return api;
}
