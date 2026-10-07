// r74 — "Quét bản dập" trên mặt bia (chế độ Điện ảnh).
//
// Giữ hai ngón (V) trên MẶT TRƯỚC phiến bia 2 s: một vạch sáng chạy từ đỉnh vòm xuống chân mặt bia theo tiến độ giữ
// (hand:vhold progress 0→1); chỗ vạch đã qua hiện bản dập chiếu phẳng lên mặt đá (nền mực làm tối đá nhẹ, nét chữ ánh vàng
// ấm mờ). Huỷ giữa chừng → vạch rút ngược lên, tắt trong ~250 ms. Đủ 2 s → bản dập ở lại suốt lúc đọc toàn văn, tắt dần
// sau khi đóng. Nút chuột / nhón ("Đọc toàn văn", "Xem ĐỀ DANH") chạy một lượt quét nhanh ~0,5 s rồi mới zoom (play()).
//
// Vẽ MỘT lượt: shader đá của bia (polish.js — GLSL_SCAN_*) chiếu ảnh theo toạ độ mô hình, chỉ đổi uniform. Bia có bản dập
// (src/data/rubbings.json) nạp ảnh LƯỜI (lúc focus / lúc bắt đầu giữ), nhớ theo bia. Bia chưa có bản dập: chỉ vạch sáng
// quét qua khung mặt đo từ mô hình (cùng nhịp, cùng cảm giác — không có ảnh hiện ra).
// Vẽ theo yêu cầu: đổi uniform làm tăng polish.version → khung tới tự vẽ (lý do 'rub'); đứng yên thì không vẽ.
// r82b → r83 — VỆT bản dập: MỌI bia có bản dập (r83: cả 82 bia ở nguồn v2 — src/data/rubbings.js) chỉ hiện bản dập trong một VỆT
// sau vạch (dài = "Độ dài vệt bản dập" × chiều cao mặt bia, nhạt dần dọc vệt), qua vệt là đá gốc; đủ giờ vạch chạy tiếp quá chân
// mặt bia cho tới khi cả vệt ra khỏi mặt bia — không gì ở lại (r74 "bản dập ở lại suốt lúc đọc" bỏ). Bia có dữ liệu chữ Hán (1442)
// + "Hiệu ứng chữ Hán" bật: chữ sáng sau đuôi vệt rồi bay (glyphs.js đọc vạch / vệt từ đây); tắt hiệu ứng: vạch + vệt, không chữ.
// r85: "Hiệu ứng ánh sáng chữ" (MỌI bia): vạch là đèn xiên trên phù điêu thật + hạt sáng lấy mẫu từ bản đồ nét của ảnh bản dập nạp ở
// đây (setLookSource — không tải lại); hiệu ứng bật thì ảnh bản dập nạp cả khi "Quét bản dập" tắt.
// Tắt "Quét bản dập" mà hiệu ứng chữ Hán chạy: máy trạng thái quét vẫn chạy theo tiến độ giữ (vạch ẩn, không bản dập) — chữ thức /
// sáng theo vạch ẩn đó. Bia không có bản dập (nguồn v1 trừ 1442): chỉ vạch sáng.
// r84 (người dùng: "vạch quét hơi nhanh"): vạch đi theo THỜI GIAN — hết mặt bia trong "Thời gian vệt quét" (scanDuration, mặc
// định 3,2 s), độc lập với 2 s giữ V: giữ V bắn ở 2 s (vạch mới ~62 %), vạch đi tiếp cùng tốc độ lúc camera đã tiến vào, tới khi cả
// vệt ra khỏi mặt bia. Nút đọc: CÙNG lượt quét (mode 'play', preroll()) — bắn (mở lớp đọc) ở cùng mốc 2 s. Độ sáng / bề rộng vạch,
// dáng đuôi vệt: cài đặt (uScanTune của polish.js).
// r83: ảnh bản dập + phép khớp TỪNG KHÚC (giấy co giãn không đều) qua rubbingOf(); nguồn v2 một tệp cho cả hai khe (alpha = mặt nạ
// vòm, R = nét).

import { rubbingOf } from '../../../data/rubbings.js';
import { DEFAULTS, READER_FIRE_S, getSettings, tnum, topt } from '../../../core/settings.js';

const CANCEL_MS = 250;
const RM_SCAN_S = 0.3; // giảm chuyển động: vạch đi hết mặt bia trong ngần này
const RELEASE_MS = 600; // bản dập tắt dần sau khi đóng trình đọc
const NAMES_RATE = 1 / 0.3; // tên trên mặt bia mờ / hiện lại trong ~0,3 s
const TOP_PAD = 0.012; // vạch xuất phát ngay trên đỉnh vòm

const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * @param {object} S trạng thái chung của sân khấu
 * @param {object} K liên kết muộn (bounds, …)
 * @param {{ THREE: typeof import('three'), renderer: import('three').WebGLRenderer, requestRender: (why?: string) => void,
 *   reduceMotion: boolean, slotEntry: Array<{id:string}|null> }} deps
 */
export function installScan(S, K, { THREE, renderer, requestRender, reduceMotion, slotEntry, glyph = null }) {
  /** Ảnh + khung đã chuẩn bị theo bia: { map, stroke, fit, frame, ready, promise }. */
  const looks = new Map();
  const loader = new THREE.TextureLoader();
  const _box = new THREE.Vector4();
  const _box2 = new THREE.Vector4();

  const A = {
    pol: null, // polish đang mang hiệu ứng (bản sao bia)
    id: null,
    mode: 'off', // off · hold · fire · held · cancel · release · play
    p: 0, // tiến độ vạch 0 (đỉnh vòm) → 1 (chân mặt bia)
    glow: 0,
    reveal: 0,
    anim: null, // { from, to, t0, dur, ease, then }
    names: 0, // 0..1 độ mờ tên trên mặt bia
    t: 0, // r84: giây kể từ lúc vạch xuất phát (vạch đi theo thời gian)
    dur: 3.2, // r84: thời gian vạch đi hết mặt bia (chốt lúc xuất phát)
    roll: null, // r84: lượt quét của nút đọc — { resolve } tới mốc bắn
  };
  S.scanNamesK = 0;
  // r77: Cài đặt → "Quét bản dập khi mở toàn văn" (tắt → mọi lời gọi thành không làm gì; đang hiện dở thì tắt NGAY)
  let enabled = true;

  const liveId = () => slotEntry[S.cur]?.id ?? null;
  const dataOf = (id) => rubbingOf(id);
  // r82b: hiệu ứng chữ Hán dùng được trên bia này (cài đặt + dữ liệu) → chế độ vệt; quét chạy cả khi "Quét bản dập" tắt
  const glyphOn = (id = A.id ?? liveId()) => !!glyph?.api.glyphUsable(id);
  const activeFor = (id) => enabled || glyphOn(id);
  /** r82b → r83: chế độ vệt (bản dập chỉ trong vệt sau vạch) — mọi bia có bản dập; độ dài vệt (đơn vị bia). */
  const trailOn = () => enabled && !!dataOf(A.id ?? liveId());
  function trailLen() {
    const F = frameOf(A.id);
    const k = Number(getSettings().glyphTrail ?? DEFAULTS.glyphTrail);
    return Math.max(0.01, k) * (F.top - F.bottom);
  }
  /** r82b: vạch phải đi quá chân mặt bia ngần này (tiến độ) để cả vệt + nhịp sáng chữ ra khỏi mặt bia. */
  function pEnd() {
    if (!glyphOn() && !trailOn()) return 1;
    const F = frameOf(A.id);
    return 1 + ((trailOn() ? trailLen() : 0) + (glyphOn() ? 0.07 : 0.01)) / Math.max(1e-3, F.top + TOP_PAD - F.bottom);
  }

  /**
   * Nạp một ảnh thành texture dữ liệu (độ sáng sRGB đọc thẳng — ngưỡng nền / nét đặt theo đó). maxH: thu nhỏ trước khi đẩy
   * lên GPU (ảnh màu chỉ dùng cho mặt nạ vòm + độ sáng nền — nửa cỡ là đủ, tiết kiệm ~9 MB bộ nhớ GPU).
   */
  function loadTex(url, maxH = 0) {
    return new Promise((resolve) => {
      loader.load(
        new URL(url, document.baseURI).href, // (rubbingOf trả URL tương đối với trang — gốc app / MODELS_BASE)
        (t) => {
          const img = t.image;
          if (maxH > 0 && img?.height > maxH) {
            const cv = document.createElement('canvas');
            cv.height = maxH;
            cv.width = Math.round((img.width * maxH) / img.height);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            t.image = cv;
          }
          t.colorSpace = THREE.NoColorSpace;
          t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() ?? 1);
          t.generateMipmaps = true;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.needsUpdate = true;
          try {
            renderer.initTexture(t); // đẩy lên GPU ngay (lúc rảnh), không để dồn vào khung đầu tiên vạch chạy
          } catch {
            /* ngữ cảnh mất — lần vẽ sau tự đẩy */
          }
          resolve(t);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  /** Khung + phép khớp của bia (không cần ảnh) — null nếu bia chưa có bản dập. */
  function lookOf(id) {
    const d = dataOf(id);
    if (!d) return null;
    let L = looks.get(id);
    if (L) return L;
    // r83: ánh xạ từng khúc (4 mốc mỗi trục; y tăng dần ↔ v ảnh gốc trên trái) — shader lấy mẫu uv = (u, 1 − v) (ảnh lật khi đẩy)
    const m = d.map;
    const kx = new THREE.Vector4(...m.x);
    const ku = new THREE.Vector4(...m.u);
    const ky = new THREE.Vector4(...m.y);
    const kv = new THREE.Vector4(...m.v);
    L = { id, data: d, kx, ku, ky, kv, frame: d.frame, map: null, stroke: null, ready: false, promise: null };
    looks.set(id, L);
    return L;
  }

  /** Nạp lười ảnh bản dập của bia (mặc định bia đang hiện). Trả Promise<boolean> (có ảnh). r82b → r85: + hạt sáng (ánh sáng chữ). */
  function prepare(id = liveId()) {
    if (glyphOn(id)) glyph.api.glyphPrepare(id);
    return prepareLook(id);
  }
  function prepareLook(id) {
    const L = lookOf(id);
    // r83: "Quét bản dập" tắt → không tải ảnh; r85: … trừ khi hiệu ứng ánh sáng chữ chạy (hạt sáng lấy mẫu từ bản đồ nét bản dập)
    if (!L || !(enabled || glyphOn(id))) return Promise.resolve(false);
    if (!L.promise) {
      // v2: một tệp (alpha mặt nạ + R nét) — nạp đủ cỡ một lần, dùng cho cả hai khe; v1 (1442): ảnh màu (nửa cỡ) + ảnh nét
      const single = !L.data.strokes;
      L.promise = Promise.all([loadTex(L.data.tex, single ? 0 : 1024), single ? null : loadTex(L.data.strokes)]).then(([m, st]) => {
        if (S.disposed) {
          m?.dispose();
          st?.dispose();
          return false;
        }
        L.map = m;
        L.stroke = single ? m : st;
        L.ready = !!m;
        if (A.id === id && A.mode !== 'off') {
          apply(true);
          requestRender('scan');
        }
        return L.ready;
      });
    }
    return L.promise;
  }

  /** Khung mặt bia (toạ độ mô hình) của bia đang hiện: theo bản dập nếu có, không thì đo từ mô hình. */
  function frameOf(id = liveId()) {
    const d = dataOf(id);
    if (d?.frame) return d.frame;
    const B = K.bounds;
    const inset = (B.slabR - B.slabL) * 0.03;
    return { left: B.slabL + inset, right: B.slabR - inset, bottom: B.bandBottom, spring: B.bandTop, top: B.yMax, measured: true };
  }

  function barY(p) {
    const F = frameOf(A.id);
    const top = F.top + TOP_PAD;
    return top - Math.min(pEnd(), Math.max(0, p)) * (top - F.bottom);
  }

  /** Ghi trạng thái hiện tại vào shader của bia đang hiện (full = ghi cả ảnh + khung). */
  function apply(full = false) {
    const pol = S.live?.polish ?? null;
    if (A.pol && A.pol !== pol) {
      A.pol.setScan(0, 2, 0, 0, null); // bản sao cũ (đổi LOD / đổi bia) — tắt
      A.pol.setGlyph?.({ trailOn: false });
      full = true;
    }
    A.pol = pol;
    if (!pol) return;
    if (A.mode === 'off') {
      pol.setScan(0, 2, 0, 0, null);
      pol.setGlyph?.({ trailOn: false });
      return;
    }
    const L = lookOf(A.id);
    // r82b: "Quét bản dập" tắt mà hiệu ứng chữ Hán chạy → không vạch / bản dập (0) nhưng vẫn đặt khung + phép khớp cho chữ
    const mode = !enabled ? 0 : L?.ready ? 1 : 2;
    let look = null;
    if (full || !A.looked) {
      const F = frameOf(A.id);
      _box.set(F.left, F.right, F.bottom, F.spring);
      // r84 (người dùng: bản dập là texture TRÊN mặt bia, không chiếu lan sang hình khác): lớp mặt = khoảng cách tới MẶT PHẲNG MẶT BIA
      // đo từ mô hình (rubbings.generated.json plane — dải lệch back / front của mặt đá thật, mép mềm) · không có: mặt phẳng trước
      // zFront, lùi 0,045 / nhô 0,012 · + khối cầu đầu rùa · + pháp tuyến hướng trước + khung mặt (polish.js)
      const pl = dataOf(A.id)?.plane;
      _box2.set(F.top, K.bounds.zFront, pl ? pl.back : 0.045, L?.stroke ? 1 : 0);
      if (pl) pol.setScanPlane?.(pl.z0, pl.kx, pl.ky, pl.front);
      else pol.setScanPlane?.(K.bounds.zFront, 0, 0, 0.012);
      const hd = S.live?.head;
      if (hd?.center && hd.radius > 0) pol.setScanHead?.(hd.center[0], hd.center[1], hd.center[2], hd.radius * 1.1);
      else pol.setScanHead?.(0, 0, 0, 0);
      look = { map: L?.map ?? null, stroke: L?.stroke ?? null, kx: L?.kx, ku: L?.ku, ky: L?.ky, kv: L?.kv, box: _box, box2: _box2 };
      A.looked = true;
    }
    pol.setScan(mode, barY(A.p), A.reveal, A.glow, look);
    // r84: độ sáng / bề rộng vạch · dáng đuôi vệt (cài đặt)
    const set = getSettings();
    pol.setScanTune?.(tnum(set, 'scanBarGlow'), tnum(set, 'scanBarWidth'), topt(set, 'scanTrailFade') === 'crisp' ? 1 : 0);
    // r82b: chế độ vệt thuộc lượt quét (không theo pha của chữ — chữ bay xong mà lượt quét còn 'held' thì vẫn là vệt)
    const tr = trailOn();
    pol.setGlyph?.({ trailOn: tr, trail: tr ? trailLen() : undefined });
  }

  function animate(to, dur, ease = easeOut, then = null) {
    A.anim = { from: { p: A.p, glow: A.glow, reveal: A.reveal }, to, t0: performance.now(), dur: Math.max(1, dur), ease, then };
  }

  /** r84: thời gian vạch đi hết mặt bia (cài đặt; giảm chuyển động: RM_SCAN_S). */
  const scanDurNow = () => (reduceMotion ? RM_SCAN_S : tnum(getSettings(), 'scanDuration'));
  /**
   * Bắt đầu giữ trên mặt bia (hand:vhold start) — r84: vạch xuất phát và đi theo THỜI GIAN (không theo tiến độ giữ). kind 'play':
   * lượt quét của nút đọc (preroll).
   */
  function start(kind = 'hold') {
    const id = liveId();
    if (!id || !S.live || !activeFor(id)) return;
    if (A.id !== id) A.looked = false;
    A.id = id;
    A.mode = kind;
    A.anim = null;
    A.p = 0;
    A.t = 0;
    A.dur = scanDurNow();
    A.glow = 1;
    A.reveal = 1;
    prepare(id);
    apply(true);
  }
  /** Tiến độ giữ 0..1 (hand:vhold progress) — r84: vạch đi theo thời gian (giữ chỉ còn quyết định huỷ / bắn). */
  function progress() {}
  /** Huỷ giữa chừng: vạch rút ngược lên, tắt (~250 ms). r82b: chế độ vệt — vệt (bản dập) mờ hết cùng lúc. */
  function cancel() {
    if (A.mode !== 'hold' && A.mode !== 'play') return;
    A.mode = 'cancel';
    rollDone(false);
    animate({ p: 0, glow: 0, reveal: trailOn() ? 0 : A.reveal }, reduceMotion ? 120 : CANCEL_MS, easeOut, () => off());
  }
  /**
   * Đủ giờ (bắn): r84 — vạch ĐI TIẾP cùng tốc độ (camera đã tiến vào) tới khi cả vệt ra khỏi mặt bia (bia không có vệt: tới chân
   * mặt bia), sáng vạch tan dần trong đoạn cuối; xong → held.
   */
  function fire() {
    if (!activeFor(liveId())) return;
    if (A.mode === 'off' || A.mode === 'cancel' || A.mode === 'release' || A.mode === 'held') start();
    if (A.mode === 'off') return;
    A.anim = null;
    A.mode = 'fire';
    rollDone(true);
  }
  /** Lượt quét xong: r74 — bản dập ở lại; r82b chế độ vệt — vệt đã ra khỏi mặt bia, không gì ở lại. */
  function held() {
    A.mode = 'held';
    if (trailOn()) {
      A.reveal = 0;
      apply();
    }
  }
  function rollDone(ok) {
    const r = A.roll;
    A.roll = null;
    r?.resolve(ok);
  }
  /**
   * r84: lượt quét của nút đọc (chuột / nhón): cùng lượt quét như giữ V (vạch theo thời gian), bắn ở mốc READER_FIRE_S (2 s) —
   * Promise<boolean> (true = đã bắn → mở lớp đọc; false = bị huỷ / đổi bia). Đã đang quét / xong → true ngay.
   */
  function preroll() {
    if (!activeFor(liveId())) return Promise.resolve(false);
    if (A.mode === 'held' || A.mode === 'fire') return Promise.resolve(true);
    if (A.mode === 'hold' || A.mode === 'play') {
      A.mode = 'play';
    } else start('play');
    if (A.mode !== 'play') return Promise.resolve(false);
    rollDone(false);
    return new Promise((resolve) => (A.roll = { resolve }));
  }
  /** (r74 — lượt quét nhanh cũ của nút đọc; r84: = preroll). */
  function play() {
    return preroll();
  }
  /** Sau khi đóng trình đọc: bản dập tắt dần. */
  // r80: ms = thời gian tắt dần (lớp đọc truyền theo thời gian camera lùi — cài đặt readerZoomOut); giảm chuyển động: 150 ms
  function release(ms) {
    if (A.mode === 'off' || A.mode === 'release' || A.mode === 'cancel') return;
    A.mode = 'release';
    animate({ p: 1, glow: 0, reveal: 0 }, reduceMotion ? 150 : Number.isFinite(ms) && ms > 0 ? ms : RELEASE_MS, easeInOut, () => off());
  }
  /** Tắt ngay (đổi bia / huỷ view). */
  function off() {
    rollDone(false);
    A.mode = 'off';
    A.anim = null;
    A.p = 0;
    A.glow = 0;
    A.reveal = 0;
    apply();
  }

  /** Mỗi khung (trước lượt vẽ): chạy hoạt ảnh + mờ / hiện tên trên mặt bia. */
  function step(dt, now = performance.now()) {
    // đổi bia (bia khác lên khay) giữa chừng → tắt
    if (A.mode !== 'off' && A.id && A.id !== liveId()) off();
    // r84: vạch đi theo thời gian (giữ / lượt quét của nút / sau khi bắn)
    if (!A.anim && (A.mode === 'hold' || A.mode === 'play' || A.mode === 'fire')) {
      A.t += Math.max(0, Math.min(0.1, dt || 0));
      const pe = pEnd();
      A.p = Math.min(pe, A.t / Math.max(0.05, A.dur));
      // sáng vạch: đủ tới chân mặt bia, tan dần trong đoạn vạch đi tiếp (đẩy vệt ra khỏi mặt bia)
      A.glow = A.p <= 1 ? 1 : pe > 1 ? Math.max(0, 1 - (A.p - 1) / (pe - 1)) : 0;
      if (A.mode === 'play' && A.t >= (reduceMotion ? A.dur : READER_FIRE_S) - 1e-6) fire();
      if (A.mode === 'fire' && A.p >= pe - 1e-6) held();
      apply();
    }
    if (A.anim) {
      const a = A.anim;
      const t = Math.min(1, (now - a.t0) / a.dur);
      const k = a.ease(t);
      A.p = a.from.p + (a.to.p - a.from.p) * k;
      A.glow = a.from.glow + (a.to.glow - a.from.glow) * k;
      A.reveal = a.from.reveal + (a.to.reveal - a.from.reveal) * k;
      if (t >= 1) {
        A.anim = null;
        a.then?.();
      }
      if (A.mode !== 'off') apply();
    } else if (A.mode !== 'off' && S.live?.polish !== A.pol) apply(true); // đổi LOD giữa lúc đang hiện
    const want = A.mode === 'off' || A.mode === 'release' || A.mode === 'cancel' ? 0 : 1;
    if (A.names !== want) {
      const r = reduceMotion ? 1 : Math.min(1, (dt || 0.016) * NAMES_RATE);
      A.names = want > A.names ? Math.min(want, A.names + r) : Math.max(want, A.names - r);
      S.scanNamesK = easeInOut(A.names);
    }
  }

  // r85: ánh sáng chữ lấy mẫu hạt sáng từ ảnh bản dập ĐÃ nạp ở đây (không tải lại) + khung mặt
  glyph?.setLookSource?.(
    (id) =>
      (dataOf(id) ? prepareLook(id) : Promise.resolve(false)).then((ok) => {
        const L = looks.get(id);
        return ok && L?.ready ? { data: L.data, map: L.map?.image ?? null, stroke: L.stroke?.image ?? null } : null;
      }),
    (id) => frameOf(id),
  );
  // r82b: chữ Hán đọc vạch / vệt mỗi khung
  glyph?.setScanSource(() =>
    A.mode === 'off' || !A.id
      ? null
      : (() => {
          const F = frameOf(A.id);
          // r84: + tốc độ vạch (đơn vị bia / s) — chữ Hán tính đời từng chữ theo vạch
          return { mode: A.mode, barY: barY(A.p), trailOn: trailOn(), trailLen: trailLen(), scanOn: enabled, id: A.id, speed: (F.top + TOP_PAD - F.bottom) / Math.max(0.05, A.dur) };
        })(),
  );

  return {
    scanStep: step,
    api: {
      /** Nạp lười ảnh bản dập (bia đang hiện nếu không nói). r82b: + chữ Hán (cả khi quét tắt). */
      scanPrepare: (id) => (activeFor(id ?? liveId()) ? prepare(id) : Promise.resolve(false)),
      /** r77: bật / tắt quét bản dập (cài đặt). Tắt giữa chừng → tắt hẳn ngay (không để bản dập hiện dở). */
      scanEnable(on) {
        const was = enabled;
        enabled = !!on;
        if (was && !enabled && A.mode !== 'off') off();
      },
      get scanEnabled() {
        return enabled;
      },
      /** Bia có bản dập không (có dữ liệu khớp — ảnh có thể chưa nạp). r82b: hoặc có hiệu ứng chữ Hán. */
      scanHas: (id = liveId()) => !!dataOf(id) || glyphOn(id),
      /** Khung mặt bia (toạ độ mô hình) — dùng cho phép thử "tay ở trên mặt bia". */
      scanFrame: frameOf,
      scanStart: start,
      scanProgress: progress,
      scanCancel: cancel,
      scanFire: fire,
      scanPlay: play,
      scanPreroll: preroll,
      scanRelease: release,
      scanOff: off,
      /** r83 (kiểm thử): bản dập của một bia — có dữ liệu không, đã bắt đầu nạp / nạp xong chưa, URL, nguồn. */
      scanLook(id = liveId()) {
        const d = dataOf(id);
        const L = looks.get(id);
        return { id, has: !!d, src: d?.src ?? null, url: d?.tex ?? null, requested: !!L?.promise, ready: !!L?.ready };
      },
      /** Trạng thái (kiểm thử): mode, p, glow, reveal, ảnh đã nạp. */
      get scanState() {
        const L = looks.get(A.id);
        return { mode: A.mode, t: +A.t.toFixed(3), dur: A.dur, p: +A.p.toFixed(3), glow: +A.glow.toFixed(3), reveal: +A.reveal.toFixed(3), id: A.id, tex: !!L?.ready, url: L?.data?.tex ?? null, src: L?.data?.src ?? null, names: +A.names.toFixed(3), enabled, trail: trailOn(), trailLen: A.id ? +trailLen().toFixed(4) : null, barY: A.mode === 'off' ? null : +barY(A.p).toFixed(4) };
      },
    },
  };
}
