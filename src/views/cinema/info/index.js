// Sổ đăng ký các "kiểu hiện thông tin" của chế độ Điện ảnh + InfoCtx dùng chung.
//
// Nạp lười (dynamic import) đúng kiểu đang chọn trong settings.cinemaInfo; đổi cài đặt thì
// huỷ kiểu cũ và gắn kiểu mới ngay, không tải lại trang. Mọi lời gọi vào layout đều được bọc
// try/catch: một kiểu hỏng không được kéo sập vòng lặp vẽ của cả view.
// Hợp đồng: ./contract.js.
import { onSettings, getSettings, CINEMA_INFO_OPTIONS } from '../../../core/settings.js';
import { STELE_ANATOMY } from '../../../data/anatomy.js';
import { factsOf } from '../facts.js';

/** @type {Record<string, () => Promise<{createInfoLayout:(ctx:object)=>object}>>} */
const LOADERS = {
  screens: () => import('./screens.js'),
  light: () => import('./light.js'),
  spread: () => import('./spread.js'),
};

const normalizeId = (id) => (LOADERS[id] ? id : CINEMA_INFO_OPTIONS[0]?.id ?? 'screens');
/** r71 → r72: kiểu Bình phong + thông tin mở rộng cho bia có dữ liệu văn bia (một thiết kế) — 'rich' | null (tắt). */
const richOf = (s, id) => (id === 'screens' && s.cinemaInfoRich !== false ? 'rich' : null);

/**
 * @param {{
 *   stage: {info: object},
 *   hudRoot: HTMLElement,
 *   pointer: () => {x:number,y:number,active:boolean},
 *   safeArea?: () => {top:number,right:number,bottom:number,left:number},
 *   reduceMotion: boolean,
 *   onError?: (err:unknown) => void,
 * }} opts
 */
export function createInfoHost({ stage, hudRoot, pointer, safeArea, reduceMotion, onError, pin, hasStele, gotoStele }) {
  const S = stage.info;
  let framingUsed = false;

  /** MỘT ctx cho mọi kiểu (xem InfoCtx trong contract.js). Toạ độ màn hình = px CSS client. */
  const ctx = Object.freeze({
    THREE: S.THREE,
    scene: S.scene,
    camera: S.camera,
    renderer: S.renderer,
    css3d: S.css3d,
    hudRoot,
    plane: S.plane,
    planeMatrix: S.planeMatrix,
    metrics: S.metrics,
    angleFade: S.angleFade,
    opacity: S.opacity,
    steleScreenRect: S.steleScreenRect,
    /** r74: khung đọc toàn văn — camera sát mặt bia theo ô tấm đọc + tiến độ cuộn (xem stage/read.js). */
    readView: S.readView ?? null,
    /** r74: quét bản dập trên mặt bia (xem stage/scan.js). */
    scan: S.scan ?? null,
    /** r76: người xem đang tự cầm camera (xoay / zoom) — kiểu thông tin đo "khung ứng dụng" khi false. */
    cameraUserMoved: S.cameraUserMoved ?? (() => false),
    requestFraming(req) {
      framingUsed = !!req;
      S.requestFraming(req);
    },
    pointer,
    anatomy: STELE_ANATOMY,
    facts: factsOf,
    reduceMotion: !!reduceMotion,
    // --- ngoài hợp đồng gốc, thêm cho tiện ---
    /** Đơn vị thế giới ứng với 1 px CSS trên mặt phẳng bia, ở khung mặc định. */
    worldPerPx: S.worldPerPx,
    /** Chuẩn bị Object3D gắn dưới plane(): không đổ bóng, không soi sàn, vẽ sau sàn. */
    prepareOverlay: S.prepareOverlay,
    /** Điểm thế giới (Vector3) → px CSS client: {x, y, behind}. */
    worldToScreen: S.worldToScreen,
    /**
     * Vùng phải chừa ra (px client tính từ từng mép khung nhìn): hàng điều khiển trên, cụm HUD
     * dưới, và khi điều khiển bằng tay thì hai dải mép chứa đích nam châm lùi/tới.
     * Rẻ (đo lười, nhớ tới lần đổi cỡ), gọi mỗi lần đặt chỗ là được.
     */
    safeArea: typeof safeArea === 'function' ? safeArea : () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    /**
     * r71: giữ thông tin đang hiện bất kể con trỏ (lớp đọc toàn văn / bảng vàng phủ màn hình): true = ghim; false = thôi ghim
     * nhưng không ẩn ngay (luật rê thường quyết định tiếp).
     */
    pinInfo: (on) => pin?.(!!on),
    /** r75: bia có trong ứng dụng không (liên kết năm tới bia khác chỉ bấm được khi có). */
    hasStele: (id) => !!hasStele?.(id),
    /** r75: đi tới bia khác (view lướt tới — như bấm dòng thời gian). */
    gotoStele: gotoStele ? (id) => gotoStele(id) : null,
  });

  const report = (where, err) => {
    console.error(`[cinema/info] lỗi ở ${where}`, err);
    onError?.(err);
  };
  const call = (where, fn) => {
    try {
      return fn();
    } catch (err) {
      report(where, err);
      return undefined;
    }
  };

  let id = null;
  /** r71: phương án thông tin mở rộng đang gắn cùng kiểu (null = không) — xem richOf */
  let rich = null;
  /** @type {object|null} */
  let layout = null;
  let token = 0;
  let disposed = false;
  let entry = null;
  let want = false; // view đang muốn thông tin hiện
  /** @type {Promise<void>} */
  let ready = Promise.resolve();
  let updateErrors = 0;
  let updateBroken = null;

  /** Trả mọi thứ một kiểu có thể đã đổi về mặc định (gọi sau khi kiểu đó dispose). */
  function resetShared() {
    call('reset', () => {
      if (framingUsed) S.requestFraming(null);
    });
    framingUsed = false;
    // Dọn phần DOM / CSS3D một kiểu lỡ bỏ quên.
    call('reset-dom', () => hudRoot.replaceChildren());
    call('reset-css3d', () => S.clearCss3d());
  }

  function unmountLayout() {
    const old = layout;
    layout = null;
    if (!old) return;
    call(`${id}.dispose`, () => old.dispose());
    resetShared();
  }

  function mountLayout(next, nextRich = null) {
    const my = ++token;
    unmountLayout();
    id = next;
    rich = nextRich;
    ready = Promise.all([LOADERS[next](), nextRich ? import('./rich/host.js') : null])
      .then(([mod, richMod]) => {
        if (disposed || my !== token) return;
        const base = call(`${next}.create`, () => mod.createInfoLayout(ctx));
        if (!base) return;
        // r71: bia có dữ liệu văn bia → kiểu giàu thông tin; bia khác → kiểu gốc (một InfoLayout gộp hai)
        const made = richMod ? call(`${next}+rich.create`, () => richMod.createRichHost(ctx, base)) ?? base : base;
        layout = made;
        if (entry) call(`${next}.setEntry`, () => layout.setEntry(entry));
        // Đổi kiểu ngay lúc thông tin đang hiện → kiểu mới hiện luôn cho người dùng thấy.
        if (want && entry) call(`${next}.show`, () => layout.show(entry));
      })
      .catch((err) => {
        if (my === token) report(`import ${next}`, err);
      });
    return ready;
  }

  const offSettings = onSettings((s) => {
    const next = normalizeId(s.cinemaInfo);
    const nextRich = richOf(s, next);
    if (next !== id || nextRich !== rich) mountLayout(next, nextRich);
  });
  if (id == null) {
    const s0 = getSettings();
    const next = normalizeId(s0.cinemaInfo);
    mountLayout(next, richOf(s0, next));
  }

  return {
    ctx,
    get id() {
      return id;
    },
    /** r71 → r72: thông tin mở rộng đang bật ('rich') hay không (null). */
    get rich() {
      return rich;
    },
    /** r71: bia này đang dùng kiểu giàu thông tin (tên trên thân bia nhường chỗ cho tấm trái lúc focus). */
    richFor(bid) {
      return !!layout?.richFor && !!call(`${id}.richFor`, () => layout.richFor(bid));
    },
    /** r71: lớp phủ của kiểu giàu thông tin đang mở (đọc toàn văn) — view không nhận phím / không đổi bia. */
    get overlayOpen() {
      return !!layout?.overlayOpen && !!call(`${id}.overlayOpen`, () => layout.overlayOpen());
    },
    /** r84: đóng lớp phủ đọc toàn văn (xem thử chuyển cảnh). */
    closeFull(why = 'preview') {
      return !!layout?.closeFull && !!call(`${id}.closeFull`, () => layout.closeFull(why));
    },
    /** r73: tải sẵn thông tin đầy đủ (bắt đầu giữ hai ngón trên bia). */
    prepareFull(e) {
      if (e) entry = e;
      if (layout?.prepareFull) call(`${id}.prepareFull`, () => layout.prepareFull(entry));
    },
    /** r72: mở thông tin đầy đủ của bia (lớp đọc toàn màn hình) — false nếu bia / kiểu không có. */
    openFull(e, at = 'top', opts = {}) {
      if (e) entry = e;
      return !!layout?.openFull && !!call(`${id}.openFull`, () => layout.openFull(entry, at, opts));
    },
    /** Kiểu đã gắn xong (import + create) hay chưa. */
    get mounted() {
      return !!layout;
    },
    /** Promise xong khi kiểu đang chọn đã gắn (DEV / kiểm thử). */
    whenReady: () => ready,

    show(e) {
      want = true;
      if (e) entry = e;
      if (layout && entry) call(`${id}.show`, () => layout.show(entry));
    },
    hide() {
      want = false;
      if (layout) call(`${id}.hide`, () => layout.hide());
    },
    /** Đổi bia (khi đang ẩn). */
    setEntry(e) {
      entry = e;
      if (layout) call(`${id}.setEntry`, () => layout.setEntry(e));
    },
    isVisible() {
      return !!layout && !!call(`${id}.isVisible`, () => layout.isVisible());
    },
    /**
     * Chỗ kiểu thông tin chiếm, để stage kẹp zoom khi hover: framing = kiểu tự xin khung camera ("Trang
     * triển lãm"), extent = nửa bề ngang (đơn vị mặt phẳng bia) nếu kiểu biết (bình phong, chữ ánh sáng).
     */
    zoomGuard() {
      const extent = layout?.extent ? call(`${id}.extent`, () => layout.extent()) : null;
      return { framing: id === 'spread' || framingUsed, extent: Number.isFinite(extent) ? extent : null };
    },
    /** DEV (r71): thao tác của kiểu giàu thông tin đang gắn (null nếu không có). */
    devRich: () => (import.meta.env.DEV ? layout?.devRich?.() ?? null : null),
    /** DEV: trạng thái hình học của kiểu đang gắn (nếu kiểu có debugState) — ghi vết chuyển cảnh. */
    debugState() {
      return layout?.debugState ? call(`${id}.debugState`, () => layout.debugState()) : null;
    },
    /** x, y: px CSS client. */
    hitTest(x, y) {
      return !!layout && !!call(`${id}.hitTest`, () => layout.hitTest(x, y));
    },
    update(dt) {
      if (!layout || updateBroken === layout) return;
      try {
        layout.update(dt);
        updateErrors = 0;
      } catch (err) {
        // Hỏng liên tục mỗi khung → ngừng gọi update() của kiểu này, không xả lỗi 60 lần/giây.
        if (++updateErrors >= 5) updateBroken = layout;
        report(`${id}.update`, err);
      }
    },
    dispose() {
      disposed = true;
      token++;
      offSettings();
      unmountLayout();
    },
  };
}
