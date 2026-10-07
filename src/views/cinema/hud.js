// Lớp giao diện của chế độ "Điện ảnh": hàng trên (quay lại, tên trang, đổi chế độ, nút Cài đặt),
// dòng thời gian (r26: bỏ cụm đếm + nút ‹ › ▶ góc dưới phải), hai mũi tên hai bên (cũng là đích nam
// châm của tay), nút "i" + bảng thông tin cho màn cảm ứng, thẻ lỗi / thanh tải, lớp hiệu ứng phim
// (vignette, hạt, viền). Tự ẩn khi không có thao tác. Số năm + thông tin bia KHÔNG nằm ở đây: số năm
// khắc trên bục, thông tin do các kiểu hiện thông tin (info/*) lo khi rê lên bia.
import { factsOf, PENDING } from './facts.js';
import { createSettingsButton, createSettingsPanel } from '../../core/settings-panel.js';
import { grainTile } from './grain.js';
import { createTimeline } from './timeline.js';
import { thumbUrl } from '../../core/loader.js';
import { playSound } from '../../core/sound.js';

const ICON = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
// r20 — hai mũi tên hai bên (chuyển bia trước / sau), MỘT cấu trúc DOM cho cả 3 kiểu (settings.cinemaArrows, CSS lo
// hình): 'gold' Chỉ vàng · 'glass' Kính khắc · 'seal' Ấn triện. Mỗi nút mang năm + can chi của bia KẾ BÊN đó (vòng
// quanh 10 bia — không có đầu / cuối), dùng cho chuột, cảm ứng, bàn phím, và con trỏ tay (data-magnet); loé khi nhận.
// (r62: bỏ dạng "chế độ hai ngón" — hand:nav / nhắm rồi vẩy; hai ngón ở Điện ảnh là kéo bia, app/vdrag.js.)
export const NAV_STYLES = Object.freeze(['gold', 'glass', 'seal']);
const CHEV = {
  prev: '<svg class="cin-nv__chev" viewBox="0 0 12 24" aria-hidden="true"><path d="M9 3 3 12l6 9"/></svg>',
  next: '<svg class="cin-nv__chev" viewBox="0 0 12 24" aria-hidden="true"><path d="M3 3l6 9-6 9"/></svg>',
};
// r22 — Chỉ vàng tinh chỉnh: viên thoi trên sợi chỉ + chevron mảnh, vệt sáng chạy dọc sợi chỉ một lần khi rê. r26 (người
// dùng): bỏ chữ dẫn "Bia trước / Bia sau", vạch ngang giữa năm và can chi, bóng ảnh bia kế bên — chỉ còn năm + can chi.
// r26b: sợi chỉ tách thành hai "cánh" (.cin-nv__arm — trên / dưới viên thoi, mỗi cánh: lõi + vệt loé <i> + vệt tiến độ hai
// ngón <b>) quay quanh viên thoi thành một mũi tên rất mở. Chỉ kiểu Chỉ vàng dùng; Kính khắc / Ấn triện ẩn đi.
function navButton(dir) {
  // r24: mỗi mũi tên là một vùng "dính" của tay (lớp cử chỉ: data-hand-sticky) — đệm theo trục ngang (mép màn hình)
  // r45g (người dùng: "tay đang ở 1/3 dưới màn hình thì không bị hút lên 2 nút next/prev … chỉ hút khi tay đang mở và không
  // hover ở timeline"): vùng cắt đáy 33.4vh (1/3 dưới thuộc hẳn dòng thời gian) + nhường khi tay đang dính dòng thời gian
  // (body[data-hand-sticky="timeline"] — vùng giữ của nó lên tới 60 %): tay lia tới hai đầu dòng thời gian không bị hút lên.
  // r59 → r62: kéo bia (nắm tay / hai ngón) vừa làm bia đi → vùng dính nhường (body[data-hand-fistnav="hold"], index.js) tới
  // khi tay về trên bia
  return `<button class="cin-nv cin-nv--${dir}" type="button" data-dir="${dir}" data-magnet data-fired="0" data-dim="0" data-near="0" data-hand-sticky="nav-${dir}" data-hand-sticky-reach="18vw" data-hand-sticky-pad="0 100vh" data-hand-sticky-clip="10vh 0 33.4vh 0" data-hand-sticky-yield="sticky=timeline fistnav=hold" data-hand-sticky-box-shape="chevron" data-hand-sticky-box-dir="${dir === 'prev' ? 'left' : 'right'}">
      <span class="cin-nv__frame" aria-hidden="true"><span class="cin-nv__ghost"></span><span class="cin-nv__fill"></span><span class="cin-nv__sheen"></span><span class="cin-nv__glint"></span><span class="cin-nv__arm cin-nv__arm--up"><i></i><b></b></span><span class="cin-nv__arm cin-nv__arm--dn"><i></i><b></b></span><span class="cin-nv__mark">${CHEV[dir]}<i class="cin-nv__gem"></i></span><span class="cin-nv__digits"></span></span>
      <span class="cin-nv__label" aria-hidden="true"><span class="cin-nv__year"></span><span class="cin-nv__cc"></span><span class="cin-nv__hint">chạm ngón cái vào ngón trỏ để chuyển</span></span>
    </button>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * @param {HTMLElement} root phần tử gốc của view (#app) — HUD tự tạo phần tử `.cinema` bên trong
 * @param {{bia:any[], handlers:Record<string, Function>}} cfg
 */
export function createHud(root, cfg) {
  const { bia, handlers } = cfg;
  const total = bia.length;

  const host = document.createElement('div');
  host.className = 'cinema';
  host.dataset.hud = 'on';
  host.dataset.panel = 'off';
  host.dataset.loading = '0';
  host.dataset.drag = '0';
  const tile = grainTile();
  if (tile) host.style.setProperty('--cin-grain', `url("${tile}")`);

  host.innerHTML = `
    <div class="cin-stage"></div>
    <div class="cin-css3d"></div>
    <div class="cin-fx" aria-hidden="true">
      <div class="cin-vignette"></div>
      <div class="cin-grain"></div>
      <div class="cin-bar cin-bar--t"></div>
      <div class="cin-bar cin-bar--b"></div>
    </div>
    <div class="cin-hudroot"></div>
    <div class="cin-handfx" data-hand-cursor-layer aria-hidden="true" style="position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden"></div>
    <div class="cin-load" data-mode="off" aria-hidden="true"><i></i></div>
    <div class="cin-hud">
      <div class="cin-top">
        <div class="cin-brand">
          <a class="cin-back" href="#" data-magnet>← back</a>
        </div>
        <div class="cin-tr">
        </div>
      </div>
      <div class="cin-bottom">
        <div class="cin-prog"></div>
      </div>
    </div>
    <p class="cin-autonote" aria-hidden="true"><span class="cin-autonote__dot" aria-hidden="true"></span>Tự trình chiếu · chạm hoặc giơ tay để điều khiển</p>
    <div class="cin-nav" data-handnav="0">${navButton('prev')}${navButton('next')}</div>
    <button class="cin-fab" type="button" aria-expanded="false" aria-controls="cin-detail" aria-label="Thông tin tấm bia">
      <span class="cin-fab__i" aria-hidden="true">i</span>
      <span class="cin-fab__x" aria-hidden="true">${ICON.close}</span>
    </button>
    <div class="cin-setwrap" hidden></div>
    <div class="cin-scrim"></div>
    <aside class="cin-panel" id="cin-detail" tabindex="-1" aria-label="Thông tin tấm bia" inert>
      <div class="cin-panel__head">
        <span class="cin-panel__grip" aria-hidden="true"></span>
        <button class="cin-panel__x" type="button" aria-label="Đóng thông tin tấm bia">${ICON.close}</button>
      </div>
      <div class="cin-panel__in"></div>
    </aside>
    <div class="cin-err" hidden>
      <div class="cin-err__card">
        <p class="cin-err__k">Không tải được mô hình</p>
        <p class="cin-err__id"></p>
        <p class="cin-err__msg"></p>
        <button class="cin-err__go" type="button" data-magnet>Thử lại</button>
      </div>
    </div>
    <p class="cin-status sr-only" aria-live="polite"></p>
    <div class="cin-boot" data-state="off" role="progressbar" aria-label="Đang chuẩn bị" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <p class="cin-boot__k">Đang chuẩn bị</p>
      <div class="cin-boot__track"><i></i></div>
    </div>`;

  root.appendChild(host);

  const $ = (sel) => host.querySelector(sel);
  const el = {
    host,
    stage: $('.cin-stage'),
    hud: $('.cin-hud'),
    css3d: $('.cin-css3d'),
    hudRoot: $('.cin-hudroot'),
    top: $('.cin-top'),
    load: $('.cin-load'),
    loadBar: $('.cin-load > i'),
    boot: $('.cin-boot'),
    bootBar: $('.cin-boot__track > i'),
    tr: $('.cin-tr'),
    setwrap: $('.cin-setwrap'),
    prog: $('.cin-prog'),
    autoNote: $('.cin-autonote'),
    fab: $('.cin-fab'),
    panel: $('.cin-panel'),
    panelIn: $('.cin-panel__in'),
    panelX: $('.cin-panel__x'),
    panelHead: $('.cin-panel__head'),
    scrim: $('.cin-scrim'),
    err: $('.cin-err'),
    errId: $('.cin-err__id'),
    errMsg: $('.cin-err__msg'),
    errGo: $('.cin-err__go'),
    status: $('.cin-status'),
    bottom: $('.cin-bottom'),
    nav: $('.cin-nav'),
    magPrev: $('.cin-nv--prev'),
    magNext: $('.cin-nv--next'),
  };
  const navBtn = { prev: el.magPrev, next: el.magNext };
  // r21: dòng thời gian 1442 → 1779 (82 bia) thay thanh 10 đoạn
  const timeline = createTimeline({
    bia,
    onPick: (i) => handlers.select(i),
    onKind: (k) => {
      host.dataset.tl = k; // r24: 'concept' (Thước khắc — một thanh ba tầng, cao hơn) | 'line' (Sợi chỉ; r43 đưa lại)
    },
    // (r26: cụm đếm + nút góc phải đã bỏ → thước phóng 1,3× ở chế độ dính chỉ còn giới hạn là mép khung hình)
  });
  el.prog.appendChild(timeline.el);
  // r24: cả dòng thời gian là một vùng dính của tay (đệm theo trục dọc — thước nằm sát mép dưới)
  timeline.el.dataset.handSticky = 'timeline';
  timeline.el.dataset.handStickyAxis = 'y';
  // r30g → r37g: vùng dính của tay = 15 % dưới màn hình (vào từ 85 % chiều cao — người dùng: "để vào timeline cần nhỏ hơn …
  // tránh dễ trigger"), ra vẫn khi lên quá 60 % như trước ("40vh"), hết bề ngang
  timeline.el.dataset.handStickyPad = '100vw 0';
  timeline.el.dataset.handStickyReachY = '15vh';
  timeline.el.dataset.handStickyExitReachY = '40vh';
  timeline.el.dataset.handStickyYield = 'stele'; // tia của tay trúng bia (index.js: body[data-hand-stele]) → bia thắng
  timeline.el.dataset.handStickyItems = '.cin-tl__tick'; // r30g: lớp tay chọn mốc (nấc, tinh chỉnh, nhón = mốc trước lúc khép)
  host.dataset.nav = 'gold';
  // Hợp đồng với lớp cử chỉ (r20): view tự lo điều hướng hai ngón → lớp cử chỉ không vẽ nút kính chung (r62: Điện ảnh luôn
  // kéo bia — hand:vdrag; giữ khai báo này để lớp cử chỉ không bao giờ dựng nút kính ở đây). Gỡ lúc huỷ HUD nếu giá trị vẫn là
  // của view.
  document.body.dataset.handNavUi = 'view';

  // r62: bỏ chế độ V "nhắm rồi vẩy" (vnav-arrows.js, hand:nav) — ở Điện ảnh hai ngón là kéo bia (app/vdrag.js, vòng cầm 3D)
  /**
   * r27: canh chừng các trạng thái do tay giữ (vùng dính): lớp cử chỉ phát hand:sticky MỖI khung khi còn ở trạng thái đó —
   * không nhận khung nào quá HAND_STALE_MS (mất tay đột ngột, trang bị ẩn, cử chỉ tắt, lớp cử chỉ trục trặc) → mũi tên tự về
   * nghỉ, không bao giờ kẹt dáng dính.
   */
  const HAND_STALE_MS = 600;
  /** Nhịp "đã nhận" một lần trên nút phía `dir` (bấm chuột, phím ←/→, nhón chọn — data-fired, r20): đặt lại để chạy lại nếu
   *  hai lần sát nhau. */
  const firedT = { prev: 0, next: 0 };
  function navFired(dir) {
    const b = navBtn[dir];
    if (!b) return;
    clearTimeout(firedT[dir]);
    b.dataset.fired = '0';
    void b.offsetWidth;
    b.dataset.fired = '1';
    firedT[dir] = window.setTimeout(() => {
      b.dataset.fired = '0';
    }, 900);
  }

  // ---- Bánh răng + bảng cài đặt (bảng dùng chung, chỉ khoác màu của view này)
  const gear = createSettingsButton({ label: 'Cài đặt hiển thị', onClick: () => toggleSettings() });
  gear.classList.add('cin-gear');
  gear.setAttribute('aria-expanded', 'false');
  gear.setAttribute('data-magnet', ''); // lớp cử chỉ hút con trỏ tay vào + nhón-chạm để bấm
  gear.style.display = 'none';
  el.tr.appendChild(gear);

  let sCount = 0;
  let sTimeout;
  let gearHideTimeout;
  const onSKey = (e) => {
    if (e.key === 's' || e.key === 'S') {
      sCount++;
      clearTimeout(sTimeout);
      if (sCount >= 5) {
        gear.style.display = '';
        clearTimeout(gearHideTimeout);
        if (!settingsUi) openSettings();
        sCount = 0;
      } else {
        sTimeout = setTimeout(() => { sCount = 0; }, 1000);
      }
    } else {
      sCount = 0;
    }
  };
  document.addEventListener('keydown', onSKey);

  /** @type {{el:HTMLElement, destroy():void}|null} */
  let settingsUi = null;
  /** r84: bảng cài đặt đang ẩn tạm vì "Xem thử chuyển cảnh" (bảng giữ nguyên trạng thái, hiện lại sau lượt xem thử). */
  let previewHidden = false;

  function placeSettings() {
    const hr = host.getBoundingClientRect();
    const tr = el.tr.getBoundingClientRect();
    el.setwrap.style.top = `${Math.max(8, Math.round(tr.bottom - hr.top + 10))}px`;
  }

  function onOutsideSettings(e) {
    if (!settingsUi || previewHidden) return;
    const t = e.target;
    if (el.setwrap.contains(t) || gear.contains(t)) return;
    closeSettings();
  }

  function openSettings() {
    if (settingsUi) return;
    el.setwrap.hidden = false;
    settingsUi = createSettingsPanel({ view: 'cinema', host: el.setwrap, onClose: closeSettings, actions: { presentNow: () => handlers.presentNow?.(), hoverZoomCap: () => handlers.hoverZoomCap?.(), startTutorial: () => handlers.startTutorial?.(), previewTransition: (kind) => handlers.previewTransition?.(kind), currentStele: () => handlers.currentStele?.() ?? null } });
    host.dataset.settings = 'on';
    gear.setAttribute('aria-expanded', 'true');
    placeSettings();
    window.addEventListener('resize', placeSettings);
    document.addEventListener('pointerdown', onOutsideSettings, true);
    pinned = true;
    wake();
    settingsUi.el.focus?.({ preventScroll: true });
  }

  function closeSettings() {
    if (!settingsUi) return;
    settingsUi.destroy();
    settingsUi = null;
    el.setwrap.hidden = true;
    host.dataset.settings = 'off';
    gear.setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', placeSettings);
    document.removeEventListener('pointerdown', onOutsideSettings, true);
    pinned = host.dataset.panel === 'on';
    wake();
    gear.focus({ preventScroll: true });
    
    // Auto hide gear button after 10 seconds of closing
    clearTimeout(gearHideTimeout);
    gearHideTimeout = setTimeout(() => {
      gear.style.display = 'none';
    }, 10000);
  }

  function toggleSettings() {
    if (settingsUi) closeSettings();
    else openSettings();
  }

  // ---- Bảng chi tiết: giữ tiêu điểm trong cụm (bảng + nút "i" đang ở dạng ×)
  /** true khi bảng đang ở dạng tấm trượt từ đáy (màn hẹp) — lúc đó FAB bị ẩn đi. */
  let sheetMode = false;
  /** Trên máy có chuột không có FAB: thông tin hiện khi rê lên bia (xem presence.js). */
  let fabUsable = true;

  function panelFocusables() {
    const list = [...el.panel.querySelectorAll('a[href], button:not([disabled])')];
    if (fabUsable && !sheetMode) list.push(el.fab);
    return list;
  }

  function onPanelKey(e) {
    if (e.key !== 'Tab' || host.dataset.panel !== 'on') return;
    const list = panelFocusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const a = document.activeElement;
    if (!el.panel.contains(a) && a !== el.fab) {
      e.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey && a === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && a === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function onOutsidePanel(e) {
    if (host.dataset.panel !== 'on') return;
    const t = e.target;
    if (el.panel.contains(t) || el.fab.contains(t)) return;
    handlers.closeInfo();
  }

  let current = null;
  let currentIndex = 0;

  // ---- Sự kiện điều khiển
  const onClick = (e) => {
    // Đích "nam châm" hai mép (chỉ hiện khi điều khiển bằng tay).
    const nv = e.target.closest?.('.cin-nv');
    if (nv && host.contains(nv)) return nv.dataset.dir === 'prev' ? handlers.prev() : handlers.next();
  };
  host.addEventListener('click', onClick);
  const onClose = () => handlers.closeInfo();
  const onRetry = () => handlers.retry();
  el.scrim.addEventListener('click', onClose);
  el.fab.addEventListener('click', () => handlers.toggleInfo());
  el.panelX.addEventListener('click', onClose);
  el.errGo.addEventListener('click', onRetry);

  // ---- Tự ẩn HUD
  let lastActivity = performance.now();
  let pinned = false;
  let shown = true;

  const onFocusIn = (e) => {
    const inPanel = !!e.target.closest?.('.cin-panel');
    const visible = typeof e.target.matches === 'function' && e.target.matches(':focus-visible');
    pinned = inPanel || visible;
    if (pinned) wake();
  };
  const onFocusOut = (e) => {
    if (!e.relatedTarget || !host.contains(e.relatedTarget)) pinned = host.dataset.panel === 'on';
  };
  host.addEventListener('focusin', onFocusIn);
  host.addEventListener('focusout', onFocusOut);
  // Trạng thái cử chỉ được nhớ lại, không đọc DOM trong vòng lặp vẽ.
  let gestureOn = document.body.classList.contains('gesture-on');
  const syncGesture = () => { gestureOn = document.body.classList.contains('gesture-on'); };
  // r34: đang xoa đầu rùa (và lúc camera còn bay về sau khi thoát) — hai mũi tên + dòng thời gian ẩn hẳn, không nhận chuột /
  // tay: host[data-rubhud] '1' = ẩn · 'back' = đang hiện lại (cinema.css). index.js gọi setRubHidden mỗi khung.
  let rubHud = false;
  let rubBackT = 0;
  const onHandFrame = (e) => {
    if (!gestureOn) syncGesture();
    wake();
    const d = e?.detail;
    // r29g: nhón / kéo / hai ngón → không hover · r32: đang hướng dẫn cử chỉ (body[data-hand-tutorial]) → dòng thời gian yên
    const tut = document.body.dataset.handTutorial === 'on';
    timeline.handAt(d?.detected && d.hover !== false && !tut && !rubHud ? d.x : null, d?.y);
  };
  const onHandStatus = () => {
    queueMicrotask(syncGesture);
  };
  window.addEventListener('hand:frame', onHandFrame);
  window.addEventListener('hand:status', onHandStatus);
  // r24 — chế độ dính của tay (lớp cử chỉ phát hand:sticky mỗi khung tay khi con trỏ đứng trong vùng đệm của một phần tử
  // [data-hand-sticky]): mũi tên phóng 1,3× vào trong + trạng thái "sẵn sàng"; dòng thời gian vào chế độ chọn bằng tay.
  const stickyNav = { prev: false, next: false };
  const stickyStaleT = { prev: 0, next: 0 };
  /** Mức gần của tay tới nút (--hand, index.js → setMagnetNear) — data-near theo đúng mức đó (ngưỡng như setMagnetNear). */
  const handNearOf = (b) => parseFloat(b.style.getPropertyValue('--hand')) || 0;
  function setNavSticky(dir, on) {
    clearTimeout(stickyStaleT[dir]);
    if (on) stickyStaleT[dir] = window.setTimeout(() => setNavSticky(dir, false), HAND_STALE_MS);
    if (stickyNav[dir] === on) return;
    stickyNav[dir] = on;
    const b = navBtn[dir];
    b.classList.toggle('is-sticky', on);
    // vào: vệt sáng chạy dọc sợi chỉ một lần (Chỉ vàng) · ra (r27): data-near về theo mức gần thật — trước đây giữ '1' tới
    // lần mức gần đổi kế tiếp (tay rời vùng dính mà không qua vùng nam châm thì treo mãi, lần dính sau không loé lại)
    b.dataset.near = on || handNearOf(b) > 0.6 ? '1' : '0';
  }
  // r32b: "tạch" rất nhẹ mỗi lần tiêu điểm dòng thời gian đổi khi tay XOÈ rê trong vùng dính (chưa chọn) — theo đúng nấc
  // mục của lớp cử chỉ (d.focus). Không khi đang nhón / khép ngón (d.pinch, d.focusFrozen) hay vừa nhón xong, không với
  // chuột. Lướt nhanh: sound.js tự thưa (≥ 36 ms) + nhỏ dần.
  const tlTick = { focus: null, pinchAt: -1e9 };
  function timelineTick(d) {
    if (!d.active) {
      tlTick.focus = null;
      return;
    }
    const now = performance.now();
    if (d.pinch || d.focusFrozen) tlTick.pinchAt = now;
    const f = Number.isInteger(d.focus) && d.focus >= 0 ? d.focus : null;
    const was = tlTick.focus;
    tlTick.focus = f;
    if (f === null || was === null || f === was) return; // vừa vào vùng: mốc đầu không kêu
    if (d.pinch || d.focusFrozen || now - tlTick.pinchAt < 300 || host.dataset.input !== 'hand') return;
    playSound('tick');
  }
  const onHandSticky = (e) => {
    const d = e.detail || {};
    wake();
    if (rubHud && d.active) return; // r34: đang ẩn vì chế độ xoa — không vào vùng (tin "ra" vẫn cho qua để dọn trạng thái)
    if (d.name === 'timeline') {
      timeline.sticky(d);
      timelineTick(d);
    } else if (d.name === 'nav-prev' || d.name === 'nav-next') {
      // r27: chuột đang nắm quyền → không giữ dáng dính (lớp cử chỉ còn dính cũng vậy — tay quay lại là vào lại ngay)
      setNavSticky(d.name === 'nav-prev' ? 'prev' : 'next', !!d.active && host.dataset.input === 'hand');
    }
  };
  /** r27: bỏ mọi trạng thái do tay giữ trên hai mũi tên (đổi sang chuột, trang bị ẩn). */
  function dropHandStates() {
    setNavSticky('prev', false);
    setNavSticky('next', false);
  }
  const onVisibility = () => {
    if (document.hidden) dropHandStates();
  };
  document.addEventListener('visibilitychange', onVisibility);
  // r27: bấm chuột vào mũi tên KHÔNG lấy tiêu điểm — trước đây nút giữ tiêu điểm sau cú bấm, phím ← / → kế tiếp làm trình
  // duyệt bật :focus-visible → khung quanh số năm + dáng "đang rê" treo lại tới khi bấm chỗ khác. Bàn phím (Tab) vẫn vào
  // được như thường; tay (click tổng hợp) vốn không lấy tiêu điểm.
  const onNavMouseDown = (e) => {
    if (e.button === 0 && e.target.closest?.('.cin-nv')) e.preventDefault();
  };
  host.addEventListener('mousedown', onNavMouseDown);
  window.addEventListener('hand:sticky', onHandSticky);

  let bootGoneT = 0;
  function wake() {
    lastActivity = performance.now();
    if (!shown) {
      shown = true;
      host.dataset.hud = 'on';
    }
  }

  function tickVisibility(now, forceShow) {
    // Điều khiển bằng tay: con trỏ không "di chuyển" theo nghĩa thường → không bao giờ tự ẩn.
    const want = gestureOn || !!settingsUi || !!forceShow || pinned || now - lastActivity < 3000;
    if (want === shown) return;
    shown = want;
    host.dataset.hud = want ? 'on' : 'off';
  }

  // ---- Bảng thông tin
  function panelHtml(b) {
    const row = (f) => `<div class="cin-row"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`;
    const rows = factsOf(b);
    return `
      <p class="cin-panel__year">${b.year}</p>
      <h2 class="cin-panel__h">${esc(b.title)}</h2>
      ${b.mota ? `<p class="cin-panel__p">${esc(b.mota)}</p>` : `<p class="cin-panel__p is-pending">${PENDING}</p>`}
      <dl class="cin-rows">${rows.map(row).join('')}</dl>`;
  }

  return {
    el,
    wake,
    tickVisibility,
    /**
     * Khoảng cách từ mép trên khung nhìn tới đáy cụm điều khiển phía trên (px).
     * Sân khấu dùng con số ĐO ĐƯỢC này để đỉnh bia luôn nằm dưới hàng trên ở màn dọc —
     * chắc chắn hơn hằng số phỏng đoán, vì chiều cao hàng trên đổi theo cỡ chữ,
     * theo việc hàng có xuống dòng hay không, và theo viền phim.
     */
    topInset() {
      try {
        return Math.max(0, el.top.getBoundingClientRect().bottom - host.getBoundingClientRect().top);
      } catch {
        return 0;
      }
    },


    /**
     * Khoảng cách từ đáy khung nhìn lên mép trên cụm HUD dưới (px) — vùng các kiểu hiện thông
     * tin phải chừa ra. Đo lại khi đổi cỡ khung (view gọi khi cần, không gọi mỗi khung).
     */
    bottomInset() {
      try {
        return Math.max(0, host.getBoundingClientRect().bottom - el.bottom.getBoundingClientRect().top);
      } catch {
        return 0;
      }
    },

    /** Hình chữ nhật (px client) của hai mũi tên — độ "gần" của con trỏ tay tính tới mép nút (nút cao, hẹp). */
    magnetCentres() {
      const c = (b) => {
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: 0, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return { prev: c(el.magPrev), next: c(el.magNext) };
    },
    /** Kiểu dòng thời gian (settings.cinemaTimeline) — 'ruler' | 'line' (r43). Màn hẹp luôn dựng Sợi chỉ. */
    setTimelineStyle(style) {
      timeline.setStyle(style);
    },
    /** DEV / thử nghiệm: dòng thời gian (tickRect, chapterRect, kind). */
    get timeline() {
      return timeline;
    },
    /** r22: chế độ nhập 'hand' | 'mouse' (input-mode.js) — CSS tắt hiệu ứng rê chuột, thẻ dòng thời gian bỏ chuột. */
    setInputMode(mode) {
      host.dataset.input = mode === 'hand' ? 'hand' : 'mouse';
      timeline.setMouseMuted(mode === 'hand' || rubHud);
      if (mode !== 'hand') dropHandStates(); // r27: chuột nắm quyền giữa lúc tay đang dính / đang hai ngón
    },
    /**
     * r34: ẩn / hiện hai mũi tên + dòng thời gian cho chế độ xoa đầu rùa (index.js: rub.active || stage.rub.leaving, mỗi
     * khung). Ẩn: mờ ra 250 ms, không nhận chuột / tay, bỏ mọi dáng rê / dính đang treo. Hiện: mờ vào 400 ms — vào lại chế độ
     * giữa chừng thì cứ thế mờ ra từ độ mờ đang có (CSS transition), không nháy.
     */
    setRubHidden(on) {
      on = !!on;
      if (on === rubHud) return;
      rubHud = on;
      clearTimeout(rubBackT);
      if (on) {
        host.dataset.rubhud = '1';
        setNavSticky('prev', false);
        setNavSticky('next', false);
        timeline.handAt(null);
        timeline.setMouseMuted(true);
      } else {
        host.dataset.rubhud = 'back';
        timeline.setMouseMuted(host.dataset.input === 'hand');
        wake(); // vừa hiện lại (camera bay về xong ~2 s sau khi thoát) → HUD tự ẩn đếm lại từ đây, không mờ đi ngay sau đó
        rubBackT = window.setTimeout(() => {
          if (!rubHud) delete host.dataset.rubhud;
        }, 450);
      }
    },
    get rubHidden() {
      return rubHud;
    },
    /** r20: kiểu mũi tên hai bên (settings.cinemaArrows). */
    setNavStyle(style) {
      host.dataset.nav = NAV_STYLES.includes(style) ? style : 'gold';
      // (r33: bỏ đệm / bo riêng cho khối dính — r31g: lớp cử chỉ vẽ khối hình chevron theo data-hand-sticky-box-shape / -dir)
    },
    /** r20: bề rộng dải mép mà mũi tên chiếm lúc nghỉ (px) — kiểu hiện thông tin chừa ra. */
    navInset() {
      const v = parseFloat(getComputedStyle(host).getPropertyValue('--nv-zone'));
      return Number.isFinite(v) ? v : 0;
    },
    navFired,

    /** Độ "gần" của con trỏ tay tới từng đích (0..1) → sáng dần khi tay tiến lại. */
    setMagnetNear(prev, next) {
      el.magPrev.style.setProperty('--hand', String(prev));
      el.magNext.style.setProperty('--hand', String(next));
      // r22: tay tiến sát (như rê chuột) → vệt sáng chạy dọc sợi chỉ một lần (Chỉ vàng)
      const near = (b, v) => {
        const k = v > 0.6 ? '1' : v < 0.4 ? '0' : b.dataset.near;
        if (b.dataset.near !== k) b.dataset.near = k;
      };
      near(el.magPrev, prev);
      near(el.magNext, next);
    },

    get settingsOpen() {
      return !!settingsUi && !previewHidden;
    },
    closeSettings,
    /**
     * r84: ẩn / hiện lại bảng cài đặt quanh lượt "Xem thử chuyển cảnh" — bảng không bị huỷ (tab, cuộn giữ nguyên), không nhận
     * chuột / tay, không tính là bảng đang mở (lớp đọc, giữ V, dấu body[data-modal] chạy như thường).
     */
    previewHide(on) {
      on = !!on && !!settingsUi;
      if (on === previewHidden) return;
      previewHidden = on;
      el.setwrap.classList.toggle('is-preview-hidden', on);
      el.setwrap.toggleAttribute('inert', on);
      host.dataset.settings = settingsUi ? (on ? 'preview' : 'on') : 'off';
      wake();
    },
    get settingsPreviewHidden() {
      return previewHidden;
    },

    /** Đổi bia đang hiển thị (i = chỉ số trong mảng đã sắp theo năm). */
    setEntry(b, i) {
      current = b;
      currentIndex = i;
      // Hai mũi tên: năm + can chi của bia kế bên (vòng quanh — bia đầu thì "trước" là bia cuối)
      for (const [dir, d] of [
        ['prev', -1],
        ['next', 1],
      ]) {
        const nb = bia[(((i + d) % total) + total) % total];
        const btn = navBtn[dir];
        if (!nb || !btn) continue;
        const y = String(nb.year);
        btn.querySelector('.cin-nv__year').textContent = y;
        btn.querySelector('.cin-nv__cc').textContent = nb.canChi ?? '';
        btn.querySelector('.cin-nv__digits').innerHTML = [...y].map((ch) => `<i>${esc(ch)}</i>`).join('');
        // URL tuyệt đối: url() tương đối trong biến CSS được phân giải theo tệp CSS dùng nó (bản build: assets/)
        btn.style.setProperty('--thumb', `url("${new URL(thumbUrl(nb, true), document.baseURI).href}")`); // r21: thumb nhỏ v2
        btn.setAttribute('aria-label', `${dir === 'prev' ? 'Bia trước' : 'Bia tiếp theo'} — khoa ${nb.canChi ?? ''} ${y}`);
        btn.disabled = total < 2; // chỉ một bia: không có gì để chuyển
      }

      timeline.setCurrent(i);
      timeline.setProgress(-1);

      // r21: bia chưa có dữ liệu lịch sử — chỉ đọc phần đã biết (không "undefined")
      // r79: phần nào không có (vd. 1589 không có tên vua — cố ý để trống) thì bỏ, không bao giờ in "null"
      const reign = [b.nienHieu, b.vua].filter(Boolean).join(', ');
      el.status.textContent = `Bia ${i + 1} trên ${total}. ${b.title}.${reign ? ` ${reign}.` : ''}`;
      if (host.dataset.panel === 'on') el.panelIn.innerHTML = panelHtml(b);
    },

    /** Vạch chạy của đoạn hiện tại khi tự động chuyển (p = 0..1). */
    setAutoProgress(p) {
      timeline.setProgress(p);
    },

    /** r19: nhãn "Tự trình chiếu" (tự bật khi rảnh) — hiện / ẩn dần, cả lúc HUD tự ẩn. */
    setAutoNote(on) {
      host.dataset.auto = on ? 'idle' : '';
      el.autoNote.setAttribute('aria-hidden', on ? 'false' : 'true');
    },

    setPlaying(on) {
      host.dataset.play = on ? '1' : '0';
      if (!on) timeline.setProgress(-1);
    },

    /**
     * Mở màn (r16): màn tối + vạch vàng mảnh + nhãn ngắn che sân khấu. f 0..1 = tiến độ thật (byte + bước);
     * 'done' = mờ đi (≈ 0,7 s) rồi thôi chặn thao tác; 'prime' / 'unprime' = màn tối trong suốt 1,5 % lúc dựng thử
     * bố cục thông tin (xem cinema.css).
     */
    setBoot(f) {
      const b = el.boot;
      if (f === 'prime' || f === 'unprime') {
        b.dataset.prime = f === 'prime' ? '1' : '0';
        return;
      }
      if (f === 'done') {
        b.dataset.state = 'done';
        b.setAttribute('aria-valuenow', '100');
        host.dataset.boot = 'done';
        // mờ xong → gỡ hẳn khỏi cây ghép lớp (lớp phủ toàn màn hình trong suốt vẫn tốn công ghép mỗi khung)
        clearTimeout(bootGoneT);
        bootGoneT = setTimeout(() => (b.dataset.state = 'gone'), 900);
        return;
      }
      if (b.dataset.state === 'off') {
        b.dataset.state = 'on';
        host.dataset.boot = 'on';
      }
      const k = Math.max(0, Math.min(1, Number(f) || 0));
      el.bootBar.style.transform = `scaleX(${k.toFixed(4)})`;
      b.setAttribute('aria-valuenow', String(Math.round(k * 100)));
    },

    /** f: 0..1 tiến độ tải · số âm = không rõ tổng · null = xong, ẩn vạch. */
    setLoading(f) {
      if (f == null) {
        host.dataset.loading = '0';
        el.load.dataset.mode = 'off';
        el.loadBar.style.transform = 'scaleX(0)';
        return;
      }
      host.dataset.loading = '1';
      if (f < 0) {
        el.load.dataset.mode = 'wait';
        el.loadBar.style.transform = '';
      } else {
        el.load.dataset.mode = 'on';
        el.loadBar.style.transform = `scaleX(${Math.max(0.03, Math.min(1, f))})`;
      }
    },

    setPanel(open) {
      host.dataset.panel = open ? 'on' : 'off';
      el.fab.setAttribute('aria-expanded', String(open));
      el.fab.setAttribute('aria-label', open ? 'Đóng thông tin tấm bia' : 'Thông tin tấm bia');
      if (open) {
        if (current) el.panelIn.innerHTML = panelHtml(current);
        el.panel.removeAttribute('inert');
        el.panelIn.scrollTop = 0;
        // Nút đóng chỉ hiện ở dạng tấm trượt; đọc một lần lúc mở là đủ.
        // Phải đo trên chính hàng đầu: getComputedStyle của nút vẫn trả về 'grid'
        // ngay cả khi cha nó đang display:none.
        sheetMode = getComputedStyle(el.panelHead).display !== 'none';
        fabUsable = getComputedStyle(el.fab).display !== 'none';
        document.addEventListener('keydown', onPanelKey, true);
        document.addEventListener('pointerdown', onOutsidePanel, true);
        const first = sheetMode ? el.panelX : panelFocusables()[0];
        (first ?? el.panel).focus({ preventScroll: true });
      } else {
        const inside = el.panel.contains(document.activeElement);
        el.panel.setAttribute('inert', '');
        document.removeEventListener('keydown', onPanelKey, true);
        document.removeEventListener('pointerdown', onOutsidePanel, true);
        sheetMode = false;
        // Không có FAB (máy dùng chuột) thì trả tiêu điểm về chính sân khấu.
        const back = fabUsable ? el.fab : el.stage;
        if (inside) {
          back.focus({ preventScroll: true });
          // FAB vừa hiện lại sau tấm trượt — nếu trình duyệt chưa kịp tính lại kiểu
          // thì focus() im lặng thất bại, thử lại ở khung sau.
          if (document.activeElement !== back) {
            requestAnimationFrame(() => {
              if (host.dataset.panel === 'off') back.focus({ preventScroll: true });
            });
          }
        }
      }
      pinned = open;
      wake();
    },

    showError(b, err) {
      el.errId.textContent = `${b.id} · ${b.title}`;
      const m = err?.message ? String(err.message).slice(0, 140) : '';
      el.errMsg.textContent = `Chưa có tệp mô hình hoặc kết nối bị gián đoạn.${m ? ` (${m})` : ''}`;
      el.err.hidden = false;
      host.dataset.loading = '0';
      el.load.dataset.mode = 'off';
      wake();
    },

    clearError() {
      el.err.hidden = true;
    },

    destroy() {
      clearTimeout(bootGoneT);
      const steps = [
        () => closeSettings(),
        () => window.removeEventListener('hand:frame', onHandFrame),
        () => window.removeEventListener('hand:status', onHandStatus),
        () => window.removeEventListener('hand:sticky', onHandSticky),
        () => {
          if (document.body.dataset.handNavUi === 'view') delete document.body.dataset.handNavUi;
        },
        () => clearTimeout(firedT.prev),
        () => clearTimeout(firedT.next),
        () => clearTimeout(stickyStaleT.prev),
        () => clearTimeout(stickyStaleT.next),
        () => document.removeEventListener('visibilitychange', onVisibility),
        () => host.removeEventListener('mousedown', onNavMouseDown),
        () => host.removeEventListener('click', onClick),
        () => timeline.destroy(),
        () => clearTimeout(rubBackT),
        () => host.removeEventListener('focusin', onFocusIn),
        () => host.removeEventListener('focusout', onFocusOut),
        () => document.removeEventListener('keydown', onPanelKey, true),
        () => document.removeEventListener('pointerdown', onOutsidePanel, true),
        () => {
          document.removeEventListener('keydown', onSKey);
          clearTimeout(gearHideTimeout);
        },
        () => el.scrim.removeEventListener('click', onClose),
        () => el.panelX.removeEventListener('click', onClose),
        () => el.errGo.removeEventListener('click', onRetry),
        // Hai listener dưới đây do openSettings gắn lên document/window — closeSettings()
        // ở trên đã gỡ, gọi lại lần nữa cho chắc nếu bước đó ném lỗi.
        () => document.removeEventListener('pointerdown', onOutsideSettings, true),
        () => window.removeEventListener('resize', placeSettings),
        () => host.remove(),
      ];
      for (const fn of steps) {
        try {
          fn();
        } catch (err) {
          console.error('[cinema] lỗi khi dọn HUD', err);
        }
      }
    },
  };
}
