// Sân khấu Điện ảnh › bục trưng bày: hai bục (mỗi khay một), cỡ + chữ khắc nổi, bản GPU của bản đồ chữ đẩy theo dải.
//
// Bục một cỡ cho mọi bia (dấu chân lớn nhất cả bộ); chữ khắc dựng trong worker (relief.js), cửa sổ ±1 / ±2 quanh bia đang xem.
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): pedestalOn, pedLights, pedSize, pedText, pedSep, pedLook, pedSettleAt, pedSizeDirty, devPerStele, reliefWin
// Đọc / ghi S của nơi khác: disposed, lumaAt, userMoved, homing, live, cur, bandHeat, bandHeated
import * as THREE from 'three';
import { DEFAULTS, getSettings } from '../../../core/settings.js';
import { PEDESTAL, createPedestal, pedestalRadiusFor } from '../pedestal.js';
import { onReliefEvict, peekRelief, pruneReliefQueue, reliefKey, requestRelief } from '../relief.js';
import { DATA } from '../../../data/index.js';
import {
  clampNum, pedLightsOf, uploadRows
} from './config.js';

export function installPedestal(S, K, deps) {
  const {
    camera, lifts, placeIdleSpot, placeKey, renderer, requestRender, scene, slots, view, whenCalm
  } = deps;
  const pedestals = [createPedestal(), createPedestal()];
  slots[0].add(pedestals[0].group);
  slots[1].add(pedestals[1].group);
  S.pedestalOn = getSettings().cinemaPedestal !== false;
  S.pedLights = pedLightsOf(getSettings());
  S.pedSize = clampNum(getSettings().pedestalSize, 0.95, 1.4, DEFAULTS.pedestalSize);
  S.pedText = clampNum(getSettings().pedestalText, 0.4, 1, DEFAULTS.pedestalText);
  S.pedSep = getSettings().pedestalSep || 'dot'; // dấu ngăn giữa các cụm chữ khắc (relief.js)
  // Độ sắc + dáng mép chữ khắc (settings.pedestalSharp / pedestalProfile): dựng lại bản đồ chữ trong worker.
  const pedLookOf = (s) => ({ sharp: clampNum(Number(s.pedestalSharp), 0, 1, DEFAULTS.pedestalSharp), profile: s.pedestalProfile || DEFAULTS.pedestalProfile });
  S.pedLook = pedLookOf(getSettings());
  // Độ nổi chữ khắc (settings.pedestalRelief 0,2..1,5; 1 = độ nổi đã nướng): nhân độ dốc pháp tuyến.
  const syncReliefDepth = (s) => {
    const k = clampNum(s.pedestalRelief, 0.2, 1.5, DEFAULTS.pedestalRelief);
    for (const pd of pedestals) pd.setReliefDepth(k);
  };
  syncReliefDepth(getSettings());
  S.pedSettleAt = 0; // > 0: hẹn dựng lại chữ nổi / bóng / khung sau khi thanh trượt dừng
  S.pedSizeDirty = false; // cỡ bục đổi → dựng lại hình ở khung kế tiếp (gộp nhiều sự kiện / khung)
  const pedStats = { rebuilds: 0, rebuildMs: 0, settles: 0, reliefRequests: 0 }; // DEV: đếm khi kéo thanh trượt
  // Dấu chân rùa LỚN NHẤT cả bộ (tools/measure-pedestal.mjs) → một cỡ bục cho mọi bia. Bia chưa có
  // trong tệp: đo lúc nạp (measure) và nâng mức này lên nếu lớn hơn.
  const PED_DATA = DATA.pedestal; // r21: dấu chân bục theo nguồn (v2: 82 bia, rộng nhất 1511 → bục lớn hơn ~4 %)
  const footMax = { swept: PED_DATA?.max?.swept ?? 0, base: PED_DATA?.max?.base ?? 0 };
  /** Độ nâng của bia ĐANG HIỂN THỊ (= lòng bục 0,175R0; 0 khi tắt bục). */
  const liftY = () => (S.pedestalOn ? pedestals[S.cur].lift : 0);
  for (let i = 0; i < 2; i++) {
    pedestals[i].group.visible = S.pedestalOn;
    lifts[i].position.y = S.pedestalOn ? pedestals[i].lift : 0;
  }
  // Vệt sáng mặt vát + bóng chân bục trên sàn (pedestal.js): chỉ là uniform / visible.
  const syncPedestalLook = (s) => {
    for (const pd of pedestals) {
      pd.setHighlight({ strength: clampNum(Number(s.pedestalHighlight), 0, 2, DEFAULTS.pedestalHighlight), pos: clampNum(Number(s.pedestalHighlightPos), -90, 90, DEFAULTS.pedestalHighlightPos) });
      pd.setFloorShadow(clampNum(Number(s.pedestalFloorShadow), 0, 1.5, DEFAULTS.pedestalFloorShadow));
    }
  };

  /**
   * Bán kính CHUẨN của bục (pedestalSize = 1), chung cho mọi bia: dấu chân rùa lớn nhất cả bộ (quét
   * xa nhất kể cả đầu/chân + khoảng hở; chân bia nằm gọn trong mép vành). Chưa có tệp số đo → dùng
   * bia đang có.
   */
  S.devPerStele = false; // DEV: bục theo từng bia như trước (để so sánh)
  function pedestalR0() {
    if (S.devPerStele && K.bounds.foot) return pedestalRadiusFor(K.bounds.foot);
    if (footMax.swept > 0) return pedestalRadiusFor(footMax);
    const f = K.bounds.foot;
    return f ? pedestalRadiusFor(f) : K.bounds.r + PEDESTAL.pad;
  }
  /** Bia chưa có trong tệp số đo: nâng dấu chân lớn nhất nếu bia này to hơn. */
  function noteFoot(id, foot) {
    if (!foot || !id || PED_DATA?.steles?.[id]) return;
    footMax.swept = Math.max(footMax.swept, foot.swept);
    footMax.base = Math.max(footMax.base, foot.base);
  }
  /**
   * Xin chữ nổi đúng kích thước dải vát + cỡ chữ hiện tại cho một khay (giữ bản cũ tới khi có). urgent (r19): bia đích
   * vừa lên khay — làn gấp, không chờ lúc yên; không gấp (đổi cỡ bục / cỡ chữ…): chờ lúc yên như trước.
   * Tới lúc có (và bản GPU đẩy xong): chữ đang chờ ('armed') mọc lên; đang hiện sẵn thì chỉ đổi bản đồ.
   */
  function refreshRelief(idx, { urgent = false, fast = false } = {}) {
    const entry = K.slotEntry[idx];
    const ped = pedestals[idx];
    if (!entry) return;
    pedStats.reliefRequests++;
    requestRelief(entry, ped.bandDims, S.pedText, S.pedSep, S.pedLook, urgent ? { urgent: true } : { gate: whenCalm })
      .then((item) => (K.slotEntry[idx] === entry && !S.disposed ? ensureReliefGpu(item, { fast }).done.then((g) => g && [item, g]) : null))
      .then((r) => {
        if (!r || K.slotEntry[idx] !== entry || S.disposed) return;
        ped.setRelief(r[0], r[1]);
        requestRender('relief');
        heatBand(ped);
      })
      .catch((err) => console.warn('[cinema] không dựng được chữ nổi trên bục', err));
  }
  /**
   * Lần đầu mặt vát có bản đồ chữ: biên dịch luôn biến thể đó cho CẢ lượt vẽ vào render target (ghép ảnh lúc chuyển
   * cảnh / gương) — không thì lần lướt đầu tiên dựng shader giữa chừng (khay cũ mờ dần mang chữ).
   */
  function heatBand(ped) {
    if (S.bandHeat) return;
    S.bandHeat = whenCalm()
      .then(() => (S.disposed ? null : view.preheat(ped.group, scene, camera)))
      .then(() => {
        S.bandHeated = true;
        if (!S.disposed) view.primePrograms();
      });
  }
  /** Bản đồ chữ của một bia đã sẵn TRÊN GPU cho khay idx (đúng cỡ dải vát + cài đặt hiện tại) — null nếu chưa. */
  function readyRelief(entry, idx) {
    if (!entry) return null;
    const item = peekRelief(reliefKey(entry, pedestals[idx].bandDims, S.pedText, S.pedSep, S.pedLook).key);
    const g = item && reliefGpu.get(item);
    return g?.ready ? [item, g] : null;
  }
  /**
   * Thanh cỡ bục / cỡ chữ đã dừng: dựng chữ nổi (lúc rảnh + worker), vẽ lại bóng + gương MỘT lần,
   * canh khung lại (bục to/nhỏ đi) — trôi mượt về khung mới nếu người dùng chưa tự xoay camera.
   */
  function settlePedestal() {
    S.pedSettleAt = 0;
    pedStats.settles++;
    refreshRelief(S.cur); // khay kia dựng lại chữ ở lần present() tới
    applyReliefWindow(); // cửa sổ ±2 dựng lại theo cỡ / kiểu chữ mới (bản cũ rơi khỏi LRU dần)
    K.requestShadow();
    K.reflector.invalidate();
    if (!S.pedestalOn || !S.live) return;
    K.computeHome();
    K.computeFit();
    if (!S.userMoved) S.homing = true;
  }

  /** Bật/tắt bục lúc đang chạy: nâng/hạ bia + mặt phẳng nội dung, canh khung lại, đo lại độ sáng ô tên. */
  function setPedestalOn(on) {
    S.pedestalOn = on;
    if (on) applyReliefWindow();
    placeIdleSpot();
    placeKey();
    K.reflector.setStrength(K.dishStrength(getSettings())); // tắt bục = không phản chiếu ở đâu cả
    for (let i = 0; i < 2; i++) {
      pedestals[i].group.visible = on;
      lifts[i].position.y = on ? pedestals[i].lift : 0;
      if (!on) pedestals[i].setLights(0, S.pedLights);
    }
    K.fieldLuma.clear();
    S.lumaAt = 0;
    K.computeHome();
    K.computeFit();
    if (!S.userMoved) K.snapHome();
    else S.homing = true;
    K.requestShadow();
    K.reflector.invalidate();
  }
  // ---- Chữ khắc trên bục (r19): bản GPU của bản đồ chữ, đẩy THEO DẢI ------------------------------------------------
  // relief.js giữ dữ liệu CPU (cửa sổ ±2 bia). Ở đây: bản trên GPU cho bia trên hai khay + ±1 quanh bia đang xem —
  // texture đích chỉ cấp bộ nhớ (texStorage2D), nhận dữ liệu theo dải ≤ 1 MB mỗi khung (texSubImage2D); dải cuối dựng
  // mipmap. Không còn lần đẩy 12 MB một phát (≈ 20–30 ms trên luồng chính) giữa lúc lướt.
  const RELIEF_STRIP_BYTES = 1 << 20;
  /**
   * r55: dải LỚN (4 MB — mỗi texture 2 dải, ~6 khung thay vì ~18; ~0,5 ms CPU mỗi dải) cho chữ của bia hiện TỨC THÌ (giảm
   * chuyển động — không có lượt lướt nào cần giữ nhịp, và không có ~1,6 s lướt để chữ kịp mọc trước khi bia đáp).
   */
  const RELIEF_STRIP_FAST = 4 << 20;
  /** @type {Map<object, {normal:THREE.DataTexture, color:THREE.DataTexture, ready:boolean, dead:boolean, done:Promise<any>, maxMs:number}>} */
  const reliefGpu = new Map();
  function reliefDst(src) {
    const dst = new THREE.DataTexture(null, src.image.width, src.image.height, src.format, src.type);
    dst.source.dataReady = false; // chỉ cấp bộ nhớ
    for (const k of ['colorSpace', 'flipY', 'premultiplyAlpha', 'unpackAlignment', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'name']) dst[k] = src[k];
    dst.generateMipmaps = true; // texStorage2D cấp đủ mọi mức (xem stripUpload)
    dst.needsUpdate = true;
    return dst;
  }
  function ensureReliefGpu(item, { fast = false } = {}) {
    let g = reliefGpu.get(item);
    if (g) {
      if (fast) g.fast = true; // đang đẩy dở theo dải nhỏ → phần còn lại đẩy dải lớn
      return g;
    }
    g = { normal: reliefDst(item.normal), color: reliefDst(item.color), ready: false, dead: false, done: null, maxMs: 0, fast };
    reliefGpu.set(item, g);
    const G = g;
    G.done = (async () => {
      for (const [src, dst] of [
        [item.normal, G.normal],
        [item.color, G.color],
      ]) {
        const W = src.image.width;
        const H = src.image.height;
        await K.nextFrame();
        if (S.disposed || G.dead) return null;
        renderer.initTexture(dst);
        dst.generateMipmaps = false;
        for (let y = 0; y < H; ) {
          await K.nextFrame();
          if (S.disposed || G.dead) return null;
          const t0 = performance.now();
          const rows = Math.max(1, Math.floor((G.fast ? RELIEF_STRIP_FAST : RELIEF_STRIP_BYTES) / (W * 4)));
          const h = Math.min(rows, H - y);
          if (y + h >= H) dst.generateMipmaps = true;
          uploadRows(renderer, src, dst, y, h, y + h >= H); // r41: không qua copyTextureToTexture (gl.getParameter đồng bộ)
          G.maxMs = Math.max(G.maxMs, performance.now() - t0);
          y += h;
        }
      }
      G.ready = true;
      return G;
    })();
    return g;
  }
  function dropReliefGpu(item) {
    const g = reliefGpu.get(item);
    if (!g) return;
    reliefGpu.delete(item);
    g.dead = true;
    g.normal.dispose();
    g.color.dispose();
  }
  const offReliefEvict = onReliefEvict(dropReliefGpu);
  /** Mất / có lại context WebGL: bản GPU (chỉ cấp bộ nhớ, không có dữ liệu CPU) trắng trơn → đẩy lại từ dữ liệu CPU. */
  function reliefContextLost() {
    for (const item of [...reliefGpu.keys()]) dropReliefGpu(item);
    for (const pd of pedestals) {
      const item = pd.relief;
      if (!item) continue;
      ensureReliefGpu(item).done.then((g) => {
        if (g && pd.relief === item) pd.setRelief(item, g);
      });
    }
    applyReliefWindow();
  }
  /** Cửa sổ chữ khắc (setReliefWindow): bia đích + ±1 (dựng + bản GPU) + ±2 (chỉ dựng, dữ liệu CPU). */
  S.reliefWin = { target: null, near: [], far: [] };
  const reliefKeyNow = (entry) => reliefKey(entry, pedestals[S.cur].bandDims, S.pedText, S.pedSep, S.pedLook).key;
  /** Chỉ giữ bản GPU cho bia trên hai khay (đang hiện / đang rời đi) + bia đích + ±1. */
  function trimReliefGpu() {
    const keep = new Set();
    for (const e of [K.slotEntry[0], K.slotEntry[1], S.reliefWin.target, ...S.reliefWin.near]) if (e) keep.add(reliefKeyNow(e));
    for (const pd of pedestals) if (pd.relief) keep.add(pd.relief.key);
    for (const item of [...reliefGpu.keys()]) if (!keep.has(item.key)) dropReliefGpu(item);
  }
  function applyReliefWindow() {
    if (!S.pedestalOn || S.disposed) return;
    const { target, near, far } = S.reliefWin;
    // r41: ngoài bia đích, cửa sổ (±1 bản GPU, ±2 vẽ chữ) chờ lúc YÊN (whenCalm: hết lướt / camera bay + CALM_MS) — việc
    // này từng chạy ngay lúc bấm chuyển (vẽ chữ trên luồng chính 5–10 ms + đẩy dải GPU mỗi khung) → khựng đầu lượt lướt.
    const still = (e) => e === S.reliefWin.target || S.reliefWin.near.includes(e) || K.slotEntry.includes(e);
    const want = (e, gpu) =>
      requestRelief(e, pedestals[S.cur].bandDims, S.pedText, S.pedSep, S.pedLook, e === target ? { urgent: true } : { gate: whenCalm })
        .then(async (item) => {
          if (!gpu || S.disposed) return;
          if (e !== S.reliefWin.target && !K.slotEntry.includes(e)) await whenCalm();
          if (!S.disposed && still(e)) ensureReliefGpu(item);
        })
        .catch(() => {});
    pruneReliefQueue(new Set([target, ...near, ...far].filter(Boolean).map(reliefKeyNow)));
    if (target) want(target, true);
    for (const e of near) want(e, true); // ±1 trước (lần bấm kế tiếp), rồi ±2
    for (const e of far) want(e, false);
    trimReliefGpu();
  }
  /** r55: chữ khắc của `entry` đã sẵn TRÊN GPU cho khay sẽ nhận bia (present() gắn được ngay, không 'armed')? */
  const inIdx = () => (S.live ? 1 - S.cur : S.cur);
  function reliefReady(entry) {
    return !S.pedestalOn || !entry || !!readyRelief(entry, inIdx());
  }
  /**
   * r55: hứa hẹn (true/false) xong khi chữ khắc của `entry` sẵn trên GPU (làn gấp + dải lớn), hoặc sau `ms` — không bao giờ
   * treo bia. View dùng cho lần hiện TỨC THÌ (giảm chuyển động): chữ và bia hiện cùng khung — luật r19 "chữ hiện trước bia".
   */
  function whenReliefReady(entry, ms = 700) {
    if (reliefReady(entry)) return Promise.resolve(true);
    const ready = requestRelief(entry, pedestals[inIdx()].bandDims, S.pedText, S.pedSep, S.pedLook, { urgent: true })
      .then((item) => (S.disposed ? null : ensureReliefGpu(item, { fast: true }).done))
      .then((g) => !!g)
      .catch(() => false);
    return Promise.race([ready, new Promise((r) => setTimeout(() => r(false), ms))]);
  }
  return {
    dropReliefGpu, footMax, heatBand, liftY, noteFoot, offReliefEvict, pedLookOf, pedStats, pedestalR0, pedestals,
    readyRelief, refreshRelief, reliefContextLost, reliefGpu, setPedestalOn, settlePedestal, syncPedestalLook,
    syncReliefDepth, trimReliefGpu,
    api: {
      /**
       * r19: cửa sổ chữ khắc trên bục — view gọi NGAY lúc bấm chuyển (và lúc mở màn). target: bia đích (dựng gấp, không
       * chờ lúc yên); near: ±1 (dựng + đẩy sẵn lên GPU — lần bấm kế tiếp có chữ ngay từ khung lướt đầu); far: ±2 (chỉ
       * dựng sẵn dữ liệu). Bộ nhớ: xem relief.js (CACHE_MAX) và reliefGpu.
       */
      reliefReady,
      whenReliefReady,
      setReliefWindow(target, near = [], far = []) {
        S.reliefWin = { target: target ?? null, near: near.filter(Boolean), far: far.filter(Boolean) };
        applyReliefWindow();
      },
    },
  };
}
