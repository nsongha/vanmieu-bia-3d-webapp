// Sân khấu Điện ảnh › LOD + tải: thay LOD1 → LOD0 tại chỗ, proxy + quét hiện, nung sẵn (preheat) + đẩy texture theo dải.
//
// Việc nền chỉ chạy lúc sân khấu yên (whenCalm); bản sao bia dựng sẵn cho hàng xóm (warm).
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): lodFade, proxyLook, bandHeat, bandHeated, keepGen, proxyKeeper, bgBusy
// Đọc / ghi S của nơi khác: pedestalOn, disposed, namesOn, lumaAt, lumaMiss, source, live, retiring, tx, cur, rubOn
import * as THREE from 'three';
import { disposeInstance, instantiate } from '../../../core/loader.js';
import { tuneScanMaterial } from '../../../core/lighting.js';
import { createProxyInstance, disposeProxyInstance } from '../proxy.js';
import { hasBVH, requestBVH } from '../bvh.js';
import { createPolish, ensurePolishNormals, measureHeadAlbedo } from '../polish.js';
import {
  PROXY_BAND_S, PROXY_BREATH_S, PROXY_DRIFT_S, PROXY_FILL_SOFT, PROXY_FILL_TAU, PROXY_WAIT_IN, REVEAL_EDGE,
  REVEAL_GLOW, REVEAL_LINE, REVEAL_PAD, REVEAL_S, easeInOutCubic, headOf, uploadRows
} from './config.js';

export function installLod(S, K, deps) {
  const {
    attachMirrorLod, bounds, camera, contact, contactDecals, fieldLuma, namesRigs, pedestals, preheatNow, reduceMotion,
    reflector, renderer, requestRender, requestShadow, scene, slabOf, slotEntry, view
  } = deps;

  // ---- r21: LOD1 → LOD0 tại chỗ (swapLod): bản LOD1 cũ đè lên, mờ dần -------------------------------------------
  const LOD_FADE = 0.25; // giây
  /** @type {{inst: THREE.Object3D, t: number, dur: number, mats: THREE.Material[]}|null} */
  S.lodFade = null;
  function beginLodFade(old) {
    endLodFade();
    const mats = [];
    old.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.castShadow = false; // bóng đã do bản mới đổ
      o.renderOrder = 5; // vẽ sau bản mới (lớp trong suốt)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.transparent = true;
        m.depthWrite = false;
        m.polygonOffset = true; // hai bản gần như trùng mặt → kéo bản đè về phía camera, không "đánh nhau" độ sâu
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -8;
        mats.push(m);
      }
    });
    S.lodFade = { inst: old, t: 0, dur: reduceMotion ? 0 : LOD_FADE, mats };
    if (!S.lodFade.dur) endLodFade();
    else requestRender('lodswap');
  }
  function stepLodFade(dt) {
    const f = S.lodFade;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    if (k >= 1) {
      endLodFade();
      requestRender('lodswap');
      return;
    }
    const a = 1 - easeInOutCubic(k);
    for (const m of f.mats) m.opacity = a;
    requestRender('lodswap');
  }
  function endLodFade() {
    const f = S.lodFade;
    if (!f) return;
    S.lodFade = null;
    f.inst.parent?.remove(f.inst);
    disposeInstance(f.inst);
  }

  // ---- Proxy + quét hiện (r16) --------------------------------------------------------------------------------
  /**
   * Bắt đầu quét hiện trên khay đang hiển thị: bia đầy đủ `full` (đã nung) vào CÙNG khay với proxy; vạch quét chạy từ
   * chân lên đỉnh — dưới vạch là đá thật (polish VM_REVEAL), trên vạch còn proxy; vệt sáng mảnh ở vạch.
   */
  function beginReveal(shot, proxyInst) {
    const y0 = bounds.yMin - REVEAL_PAD;
    const y1 = bounds.yMax + REVEAL_PAD;
    shot.reveal = { proxyInst, t: 0, dur: reduceMotion ? 0 : REVEAL_S, y0, y1 };
    // Bóng: proxy (cùng dáng) đổ bóng suốt lượt quét; bia đầy đủ nhận lại cờ đổ bóng khi quét xong.
    shot.inst.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    stepReveal(shot, 0);
  }
  function stepReveal(shot, dt) {
    const r = shot.reveal;
    if (!r) return;
    if (r.hold != null) r.t = r.hold * r.dur; // DEV: __vm.cinemaReveal(p) ghim tiến độ để chụp
    else r.t += dt;
    const k = r.dur > 0 ? Math.min(1, r.t / r.dur) : 1;
    if (k >= 1) {
      endReveal(shot);
      return;
    }
    const y = r.y0 + (r.y1 - r.y0) * easeInOutCubic(k);
    // r19: vệt sáng ở vạch quét hiện / tắt dần ở hai đầu (không loé lúc proxy nhường chỗ, không tắt phụt lúc xong)
    const glow = REVEAL_GLOW * easeInOutCubic(Math.min(1, k / REVEAL_EDGE)) * easeInOutCubic(Math.min(1, (1 - k) / REVEAL_EDGE));
    shot.polish?.setReveal(y, true, REVEAL_LINE, glow);
    r.proxyInst.userData.proxy?.setReveal(y, true, REVEAL_LINE, glow);
    stepProxyWait(shot, dt, r.proxyInst, k);
  }
  /**
   * r19: vẻ "đang chờ" của proxy (proxy.js setWait) — mỗi khung. look: hiện dần PROXY_WAIT_IN (cubic vào-ra), lúc quét
   * hiện tắt dần theo tiến độ quét; 'rim': viền thở (0,3 ↔ 0,75, PROXY_BREATH_S) + phần "đầy" dâng theo tiến độ tải
   * (không biết tổng → trôi chậm; lúc quét: đầy hẳn, đá thật nối tiếp từ dưới lên); 'outline': đường bao + dải trôi.
   * Giảm chuyển động: viền đứng yên, không phần "đầy" / dải trôi.
   */
  function stepProxyWait(shot, dt, inst = shot?.inst, revealK = -1) {
    const w = shot?.wait;
    const api = inst?.userData.proxy;
    if (!w || !api) return;
    if (w.hold) {
      w.t = w.hold.t;
      w.level = w.hold.level;
    } else {
      w.t += dt;
      let tgt = w.target >= 0 ? w.target : 0.85 * (1 - Math.exp(-w.t / PROXY_DRIFT_S));
      if (revealK >= 0) tgt = 1;
      if (tgt > w.level) w.level += (tgt - w.level) * (1 - Math.exp(-dt / PROXY_FILL_TAU)); // chỉ dâng, không tụt
    }
    const kIn = reduceMotion ? 1 : easeInOutCubic(Math.min(1, w.t / PROXY_WAIT_IN));
    const look = kIn * (revealK >= 0 ? 1 - easeInOutCubic(revealK) : 1);
    const H = bounds.yMax - bounds.yMin;
    if (S.proxyLook === 'outline') {
      const u = reduceMotion ? -1 : (w.t / PROXY_BAND_S) % 1;
      const y = u < 0 ? bounds.yMin - 10 : bounds.yMin - 0.15 + (H + 0.3) * u;
      api.setWait(look, 1, y, 'outline');
    } else {
      const rim = reduceMotion ? 0.5 : 0.525 - 0.225 * Math.cos((2 * Math.PI * w.t) / PROXY_BREATH_S);
      const y = bounds.yMin - PROXY_FILL_SOFT + (H + 2 * PROXY_FILL_SOFT) * w.level;
      api.setWait(look, rim, y, 'rim', PROXY_FILL_SOFT, reduceMotion ? 0 : 1);
    }
  }
  S.proxyLook = 'rim'; // r19: vẻ chờ của proxy — 'rim' (mặc định) | 'outline' (DEV: vm.cinemaProxyLook)
  /** Kết thúc quét hiện (xong, hoặc bị cắt ngang bởi chuyển cảnh / huỷ): bỏ proxy, bia đầy đủ vẽ đủ + đổ bóng. */
  function endReveal(shot) {
    const r = shot?.reveal;
    if (!r) return;
    shot.reveal = null;
    queueMicrotask(() => attachMirrorLod(shot));
    shot.polish?.setReveal(0, false);
    r.proxyInst.parent?.remove(r.proxyInst);
    disposeProxyInstance(r.proxyInst);
    const cast = shot.slot?.visible !== false;
    shot.inst.traverse((o) => {
      if (o.isMesh) o.castShadow = cast;
    });
    requestShadow();
    reflector.invalidate();
    requestRender('reveal');
    if (shot === S.live) S.lumaAt = 0; // proxy không đo độ sáng ô tên — đo lại trên đá thật
  }

  S.bandHeat = null; // r16: biến thể "mặt vát có chữ" đã nung cho mọi đích vẽ (xem refreshRelief)
  S.bandHeated = false;
  /** Chờ sân khấu "đã dọn xong" cho bia hiện tại: hết chuyển cảnh, có chữ nổi trên bục, đã đo ô tên (nếu bật tên). */
  const settledWaiters = [];
  function isSettled() {
    if (!S.live || S.tx || S.live.reveal) return false;
    if (S.pedestalOn && (!pedestals[S.cur].relief || !S.bandHeated)) return false;
    if (namesRigs && S.namesOn && !S.live.proxy && slotEntry[S.cur] && !fieldLuma.has(slotEntry[S.cur].id) && S.lumaMiss !== slotEntry[S.cur].id) return false;
    return true;
  }

  // ---- Xoa đầu rùa (r8): bản sao có shader độ bóng, trạng thái từng bia, khung camera cận đầu rùa -------------
  /** Bản sao đã chuẩn bị sẵn (preheat) theo bản gốc — present() lấy dùng luôn. Giữ ít: mỗi bản chỉ là cây
   *  Object3D + vật liệu clone (lưới / texture dùng chung với bản gốc).
   *  r15: trần MỀM. KHÔNG đẩy ra (huỷ vật liệu) bản sao đang nung dở (busy — huỷ giữa lúc chờ link là gốc của lỗi
   *  "isReady" cũ), bản sao hàng xóm của bia hiện tại (gen === keepGen), hay bản sao đang là chủ DUY NHẤT của một
   *  chương trình shader (vd. bia có normalMap: huỷ nó là three giải phóng luôn chương trình → lần lướt tới bia đó
   *  phải biên dịch lại giữa chừng, khung 25–47 ms). Mỗi bản giữ thêm chỉ tốn vài KB bộ nhớ CPU. */
  const WARM_MAX = 4;
  /** @type {Map<THREE.Object3D, {inst:THREE.Object3D, busy:number, gen:number}>} bản gốc → bản sao nung sẵn */
  const warm = new Map();
  S.keepGen = 0; // tăng mỗi present(): bản sao nung với keep ở thế hệ hiện tại = hàng xóm của bia đang hiện
  S.proxyKeeper = null; // r16: một bản sao proxy ngoài cảnh — giữ chương trình shader proxy sống (preheatProxy)
  /**
   * Bản gốc đã nung trọn một lần: pháp tuyến vùng đầu, texture trên GPU, chương trình shader, bóng tiếp xúc đều nằm ở
   * phần DÙNG CHUNG (geometry / texture / chương trình) → dựng lại bản sao cho lần hiện sau chỉ còn vài ms.
   */
  const preparedRoots = new WeakSet();
  let preheatChain = Promise.resolve(); // hàng đợi các lần nung nền (api.preheat)
  const preheatPending = new Map(); // r21: bản gốc → lượt nung đang chờ / chạy
  S.bgBusy = 0; // số lần nung đang chờ / đang chạy (DEV: vm.cinemaBusy)
  /** DEV: thời gian từng lát của mỗi lần nung (vm.cinemaPreheatStats). */
  const preheatStats = [];
  /** Hết khung hình hiện tại rồi mới chạy tiếp (một tác vụ mới SAU lượt vẽ) — chia việc nặng thành lát. */
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
  /** Các texture (không trùng) của một cây vật thể. */
  function texturesOf(root) {
    const out = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of TEX_KEYS) if (m[k]) out.add(m[k]);
    });
    return out;
  }
  // ---- Đẩy texture quét (2048²) lên GPU THEO DẢI (r16) ---------------------------------------------------------
  // Một lần texImage2D cả ảnh là một tác vụ 30–45 ms trên luồng chính (rớt khung nếu trùng lúc người xem hover / bấm).
  // Thay vào đó: một texture đích (DataTexture, chỉ cấp bộ nhớ — texStorage2D) nhận ảnh theo từng dải STRIP_ROWS hàng,
  // mỗi dải một tác vụ riêng sau một khung (copyTextureToTexture → texSubImage2D một vùng của ImageBitmap); dải cuối
  // dựng mipmap. Vật liệu của CÁC BẢN SAO Điện ảnh đổi sang texture đích (bản gốc trong loader giữ ảnh gốc cho view
  // khác — mỗi view một context WebGL). Kết quả lấy mẫu y hệt (cùng định dạng sRGB8_ALPHA8, cùng mipmap).
  const STRIP_ROWS = 256;
  /** @type {Map<THREE.Texture, {dst: THREE.DataTexture, ready: boolean, done: Promise<THREE.DataTexture|null>}>} */
  const stripTex = new Map();
  // r21: texture NÉN (KTX2 v2 → BC7 / ASTC / ETC — khối 4 × 4): một lần compressedTexImage2D cả chuỗi mip 4096² là
  // tác vụ 50–70 ms. Texture đích (CompressedTexture, source.dataReady = false → three chỉ cấp bộ nhớ texStorage2D cho
  // đủ mức mip) nhận dữ liệu theo DẢI HÀNG KHỐI ≤ STRIP_BYTES mỗi lát (compressedTexSubImage2D qua
  // copyTextureToTexture với một nguồn giả chỉ chứa dải đó); các mức mip nhỏ gộp chung một lát.
  const STRIP_BYTES = 1 << 20;
  function stripUploadCompressed(src, slice) {
    const mips = src.mipmaps;
    if (!mips?.length || !mips[0]?.data) return Promise.resolve(null);
    const meta = mips.map((m) => ({ data: null, width: m.width, height: m.height }));
    const dst = new THREE.CompressedTexture(meta, mips[0].width, mips[0].height, src.format, src.type);
    for (const k of ['colorSpace', 'flipY', 'premultiplyAlpha', 'unpackAlignment', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'channel', 'name']) dst[k] = src[k];
    dst.generateMipmaps = false;
    dst.source.dataReady = false;
    dst.needsUpdate = true;
    const e = { dst, ready: false, done: null };
    e.done = (async () => {
      await slice();
      if (S.disposed) return null;
      // Cấp bộ nhớ (texStorage2D) + GHI LẠI định dạng trong thật (sRGB hay tuyến tính: copyTextureToTexture của three
      // r180 đổi định dạng KHÔNG theo colorSpace → texture sRGB nhận sai định dạng, GPU bỏ dữ liệu → ô lỗi màu tím ASTC).
      const gl = renderer.getContext();
      let internalFormat = 0;
      const storage = gl.texStorage2D;
      gl.texStorage2D = function (t, l, f, w, h) {
        internalFormat = f;
        return storage.call(this, t, l, f, w, h);
      };
      try {
        renderer.initTexture(dst);
      } finally {
        gl.texStorage2D = storage;
      }
      const glTex = renderer.properties.get(dst).__webglTexture;
      if (!internalFormat || !glTex) {
        // không cấp theo kiểu texStorage (WebGL1 / trình duyệt lạ) → bỏ bản đích, đẩy texture gốc một lần như cũ
        dst.dispose();
        stripTex.delete(src);
        return null;
      }
      let budget = 0;
      let checked = !import.meta.env.DEV;
      for (let L = 0; L < mips.length; L++) {
        const m = mips[L];
        const blockRows = Math.ceil(m.height / 4);
        const rowBytes = m.data.byteLength / blockRows;
        const whole = !Number.isInteger(rowBytes) || m.data.byteLength <= STRIP_BYTES;
        const per = whole ? blockRows : Math.max(1, Math.floor(STRIP_BYTES / rowBytes));
        for (let br = 0; br < blockRows; br += per) {
          const nb = Math.min(per, blockRows - br);
          const bytes = whole ? m.data.byteLength : nb * rowBytes;
          if (budget + bytes > STRIP_BYTES && budget > 0) {
            await slice();
            if (S.disposed) return null;
            budget = 0;
          }
          const h = whole ? m.height : Math.min(m.height - br * 4, nb * 4);
          const data = whole ? m.data : m.data.subarray(br * rowBytes, br * rowBytes + nb * rowBytes);
          renderer.state.bindTexture(gl.TEXTURE_2D, glTex);
          gl.compressedTexSubImage2D(gl.TEXTURE_2D, L, 0, whole ? 0 : br * 4, m.width, h, internalFormat, data);
          renderer.state.unbindTexture();
          if (!checked) {
            checked = true;
            const err = gl.getError();
            if (err) console.warn('[cinema] đẩy texture nén theo dải lỗi GL', err.toString(16));
          }
          budget += bytes;
        }
      }
      e.ready = true;
      // r21: dữ liệu CPU (mip đã giải mã, ~28 MB mỗi LOD0 · ~1,4 MB mỗi LOD1) không còn cần cho renderer này: mọi bản
      // sao dùng bản đích (useStripTextures) → nhả cho GC. Bản gốc được đánh dấu: rời view thì loader bỏ nó (view khác —
      // renderer khác — sẽ tải lại từ bộ đệm HTTP), xem releaseCpuReleased().
      src.mipmaps = mips.map((m) => ({ data: null, width: m.width, height: m.height }));
      src.userData.cpuReleased = true;
      return dst;
    })();
    stripTex.set(src, e);
    return e.done;
  }
  function stripUpload(src, slice) {
    const had = stripTex.get(src);
    if (had) return had.done;
    if (src.isCompressedTexture) return renderer.properties.has(src) ? Promise.resolve(null) : stripUploadCompressed(src, slice);
    const img = src.image;
    // chỉ ảnh (ImageBitmap / ảnh DOM) chưa lên GPU; texture khác để three tự lo. r21: texture nén (KTX2 → BC7 / ASTC /
    // ETC) đẩy theo mức mip đã nén — không chia dải được theo kiểu này (preheat đẩy một lần, xem 'texture').
    if (!img || !(img.width > 0) || img.data || src.isCompressedTexture || renderer.properties.has(src)) return Promise.resolve(null);
    const dst = new THREE.DataTexture(null, img.width, img.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    dst.source.dataReady = false; // chỉ cấp bộ nhớ, không có dữ liệu CPU
    for (const k of ['colorSpace', 'flipY', 'premultiplyAlpha', 'unpackAlignment', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'channel', 'name']) dst[k] = src[k];
    dst.generateMipmaps = src.generateMipmaps;
    dst.needsUpdate = true;
    const e = { dst, ready: false, done: null };
    e.done = (async () => {
      renderer.initTexture(dst); // texStorage2D đủ mọi mức mipmap — rẻ
      const mips = dst.generateMipmaps;
      dst.generateMipmaps = false; // chỉ dựng mipmap ở dải cuối
      for (let y = 0; y < img.height; y += STRIP_ROWS) {
        await slice();
        if (S.disposed) return null;
        const h = Math.min(STRIP_ROWS, img.height - y);
        if (y + h >= img.height) dst.generateMipmaps = mips;
        uploadRows(renderer, src, dst, y, h, y + h >= img.height); // r41: không qua copyTextureToTexture (gl.getParameter đồng bộ)
      }
      e.ready = true;
      return dst;
    })();
    stripTex.set(src, e);
    return e.done;
  }
  /** Vật liệu của một bản sao: texture gốc nào đã có bản trên GPU theo dải thì đổi sang bản đó. */
  function useStripTextures(inst) {
    inst?.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const k of TEX_KEYS) {
          const e = m[k] && stripTex.get(m[k]);
          if (e?.ready) m[k] = e.dst;
        }
      }
    });
  }
  /** DEV: thời gian tính pháp tuyến mượt vùng đầu rùa theo bia. */
  const polishNormalStats = [];
  function prepareInstance(root3d) {
    // Pháp tuyến mượt vùng đầu rùa (thuộc tính riêng trên geometry dùng chung) — một lần mỗi bia, TRƯỚC khi
    // biên dịch (thuộc tính có mặt từ lần vẽ đầu).
    const t0 = import.meta.env.DEV ? performance.now() : 0;
    const smoothed = ensurePolishNormals(THREE, root3d, headOf(root3d.name));
    if (import.meta.env.DEV && smoothed) polishNormalStats.push({ id: root3d.name, smoothed, ms: +(performance.now() - t0).toFixed(1) });
    const inst = instantiate(root3d, { cloneMaterials: true });
    tuneScanMaterial(inst, { envMapIntensity: 0.6 });
    // Albedo trung bình đầu rùa trên texture quét: mẫu số để màu "đá bóng" (settings.rubColor) ra đúng màu đã chọn.
    inst.userData.headAlbedo = measureHeadAlbedo(THREE, root3d, headOf(root3d.name));
    const polish = createPolish(THREE);
    polish.attach(inst, headOf(root3d.name));
    K.applyRubLook(polish);
    inst.userData.polish = polish;
    useStripTextures(inst);
    return inst;
  }
  function warmInstance(root3d, keep = false) {
    let w = warm.get(root3d);
    if (w) warm.delete(root3d); // lên cuối hàng (mới dùng nhất)
    else w = { inst: prepareInstance(root3d), busy: 0, gen: -1 };
    if (keep) w.gen = S.keepGen;
    warm.set(root3d, w);
    trimWarm();
    return w;
  }
  /** Bản sao là chủ DUY NHẤT của ít nhất một chương trình shader (huỷ nó = three giải phóng chương trình đó). */
  function soleProgramOwner(inst) {
    let sole = false;
    inst.traverse((o) => {
      if (sole || !o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const progs = renderer.properties.get(m).programs;
        if (progs) for (const pr of progs.values()) if (pr.usedTimes <= 1) sole = true;
      }
    });
    return sole;
  }
  function trimWarm() {
    if (warm.size <= WARM_MAX) return;
    for (const [k, w] of warm) {
      if (warm.size <= WARM_MAX) break;
      if (w.busy > 0 || w.gen === S.keepGen || soleProgramOwner(w.inst)) continue;
      warm.delete(k);
      disposeInstance(w.inst);
    }
  }
  function takeInstance(root3d) {
    const w = warm.get(root3d);
    warm.delete(root3d);
    return w ? w.inst : prepareInstance(root3d);
  }
  return {
    TEX_KEYS, endLodFade, endReveal, isSettled, nextFrame, polishNormalStats, preheatStats, prepareInstance,
    preparedRoots, settledWaiters, stepLodFade, stepProxyWait, stepReveal, stripTex, stripUpload, takeInstance,
    texturesOf, trimWarm, useStripTextures, warm, warmInstance,
    api: {
      /**
       * Biên dịch shader + nạp texture lên GPU trước, để lúc hiện lên không khựng. Máy khoẻ thì xếp
       * luôn việc dựng cây BVH (worker, lúc rảnh) → bia kế tiếp có tia nhanh ngay từ khung đầu.
       * r16: các lần nung nền chạy LẦN LƯỢT (hàng đợi) — hai lần nung song song dồn lát của nhau vào cùng một khung;
       * urgent (mở màn, màn tối đang che) thì chạy ngay. opts: { keep, entry, urgent } — xem preheatNow.
       */
      preheat(root3d, opts = {}) {
        // r21: một bản gốc chỉ nung MỘT lần cùng lúc (cửa sổ LOD0 và lượt nâng cấp bia đang xem có thể cùng xin)
        const had = preheatPending.get(root3d);
        if (had) {
          if (opts.keep) warmInstance(root3d, true);
          return had;
        }
        S.bgBusy++;
        const run = opts.urgent ? preheatNow(root3d, opts) : preheatChain.then(() => (S.disposed ? null : preheatNow(root3d, opts)));
        const p = run.finally(() => {
          S.bgBusy--;
          preheatPending.delete(root3d);
        });
        preheatPending.set(root3d, p);
        if (!opts.urgent) preheatChain = p.catch(() => {});
        return p;
      },
      /** r16: "dùng lần đầu" mọi chương trình đã link mà chưa vẽ (xem renderer.primePrograms) — gọi lúc rảnh. */
      primePrograms() {
        return view.primePrograms();
      },
      /** r21: tính sẵn số đo phiến của một bia (thường trên proxy, ~0,3 ms) — present() về sau chỉ tra bảng. */
      premeasure(root3d) {
        if (root3d && !S.disposed) slabOf(root3d);
      },
      /** r19: tiến độ tải (byte, 0..1; < 0 = chưa biết tổng) của bia đầy đủ mà proxy đang đứng chờ — phần "đầy" dâng theo. */
      setProxyProgress(id, f) {
        if (!S.live?.proxy || !S.live.wait || slotEntry[S.cur]?.id !== id) return;
        S.live.wait.target = f >= 0 ? Math.min(1, f) : -1;
      },
      /**
       * r16: nung chương trình của vật liệu proxy (một chương trình cho mọi proxy) + nướng bóng tiếp xúc của proxy này.
       * Giữ lại MỘT bản sao proxy ngoài cảnh để chương trình không bị giải phóng trước lần dùng đầu.
       */
      preheatProxy(root3d) {
        if (!S.proxyKeeper) S.proxyKeeper = createProxyInstance(root3d);
        const inst = S.proxyKeeper;
        return view.preheat(inst, scene, camera).then(() => {
          if (!S.disposed) contact.bake(root3d);
        });
      },
      /**
       * r16: bia đầy đủ đã tải + nung xong cho bia đang hiện bằng PROXY → quét hiện từ dưới lên (REVEAL_S). Trả false nếu
       * bia hiện tại không còn là proxy của bia này (người xem đã đi tiếp).
       */
      upgrade(root3d, entry = null) {
        const shot = S.live;
        if (!shot || !shot.proxy || shot.reveal || S.tx || (entry && shot.id !== entry.id)) return false;
        requestRender('reveal');
        const full = takeInstance(root3d);
        full.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.castShadow = true;
          o.receiveShadow = true;
        });
        shot.lift.add(full);
        contactDecals[S.cur].attach(full, contact.bake(root3d)); // bóng tiếp xúc theo dáng đá thật
        const proxyInst = shot.inst;
        Object.assign(shot, K.rubStateFor(full, shot.id), { inst: full, proxy: false, bvh: hasBVH(full), lod: root3d.userData.lod ?? 0, root: root3d });
        if (!shot.bvh) requestBVH(root3d, { urgent: true });
        S.source = root3d;
        delete shot.slot.userData.__mats;
        beginReveal(shot, proxyInst);
        return true;
      },
      /**
       * r21: bia đang hiện ở LOD1 → thay bằng LOD0 (đã nung) NGAY TẠI CHỖ, lúc sân khấu yên (không chuyển cảnh, không quét
       * hiện, không ở chế độ xoa). Bản LOD1 nằm đè lên trên (vẽ sau, polygonOffset kéo về phía camera, không ghi độ sâu)
       * rồi mờ dần LOD_FADE giây → texture 1024 → 4096 + normal map "nét dần" thay vì bật phắt; vật nằm TRƯỚC bia (mép
       * lòng bục) vẫn che đúng vì bản đè vẫn thử độ sâu với cảnh. Trả false nếu không thay được lúc này.
       */
      swapLod(root3d, entry = null) {
        const shot = S.live;
        if (!shot || shot.proxy || shot.reveal || S.tx || S.rubOn || S.lodFade || (entry && shot.id !== entry.id)) return false;
        if (shot.root === root3d) return false;
        K.saveLiveRub(); // bản sao mới nạp lại độ bóng đã xoa từ bộ nhớ lưu
        const old = shot.inst;
        const full = takeInstance(root3d);
        full.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.castShadow = true;
          o.receiveShadow = true;
        });
        shot.lift.add(full);
        contactDecals[S.cur].attach(full, contact.bake(root3d));
        Object.assign(shot, K.rubStateFor(full, shot.id), { inst: full, bvh: hasBVH(full), lod: root3d.userData.lod ?? 0, root: root3d });
        if (!shot.bvh) requestBVH(root3d, { urgent: true });
        S.source = root3d;
        delete shot.slot.userData.__mats;
        beginLodFade(old);
        attachMirrorLod(shot);
        requestShadow();
        reflector.invalidate();
        return true;
      },
      /** r21: mức chi tiết của bia đang hiện (0 / 1 / 2 = proxy; null nếu chưa có). */
      get liveLod() {
        return S.live ? (S.live.proxy ? 2 : S.live.lod ?? 0) : null;
      },
      /** r21: id bia đang hiện + đang rời đi (bản gốc của chúng không được giải phóng). */
      get busyIds() {
        return [S.live?.id, S.retiring?.id].filter(Boolean);
      },
      /**
       * r21: quên mọi thứ view giữ riêng cho một bản gốc sắp bị loader giải phóng (bản sao nung sẵn, texture đẩy theo
       * dải). Trả false nếu bản gốc đang được dùng (bia đang hiện / đang rời đi / đang nung) — khi đó KHÔNG được giải phóng.
       */
      forget(root3d) {
        if (!root3d) return true;
        if ([S.live, S.retiring].some((sh) => sh && (sh.root === root3d || sh.inst?.userData.srcRoot === root3d))) return false;
        if (S.lodFade?.inst.userData.srcRoot === root3d) return false;
        const w = warm.get(root3d);
        if (w) {
          if (w.busy > 0) return false;
          warm.delete(root3d);
          disposeInstance(w.inst);
        }
        root3d.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const k of TEX_KEYS) {
              const e = m[k] && stripTex.get(m[k]);
              if (!e) continue;
              stripTex.delete(m[k]);
              e.dst.dispose();
            }
          }
        });
        return true;
      },
    },
  };
}
