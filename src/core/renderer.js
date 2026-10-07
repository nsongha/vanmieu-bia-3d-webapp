// WebGLRenderer + vòng lặp render + resize theo container.
import * as THREE from 'three';
import { registerRenderer } from './loader.js';
import { getSettings, maxFps, onSettings } from './settings.js';
import { markFrame, setFpsNote } from './fps-meter.js';

/** Trần chờ của preheat(): quá ngần này (ms) coi như xong — xem ghi chú ở preheat(). */
const PREHEAT_MAX_MS = 8000;

/**
 * @param {HTMLElement} container phần tử chứa canvas (position: relative/absolute, kích thước do CSS)
 * @param {{alpha?:boolean, shadows?:boolean, toneMapping?:THREE.ToneMapping, exposure?:number, maxDpr?:number}} [opts]
 */
export function createRenderer(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: opts.alpha ?? false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  });
  // DPR trần 1.5: retina vẫn nét, số pixel giảm ~44% so với DPR 2 (kèm MSAA rất tốn fill-rate).
  const maxDpr = Math.min(opts.maxDpr ?? 1.5, 1.5);
  const baseDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(baseDpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Bản build: bỏ kiểm tra log biên dịch lúc DÙNG LẦN ĐẦU mỗi chương trình (getProgramInfoLog + 2 × getShaderInfoLog
  // là lời gọi đồng bộ sang tiến trình GPU, vài ms mỗi chương trình — rơi đúng khung hover / chuyển cảnh đầu tiên).
  // DEV giữ nguyên để lỗi shader còn hiện ra.
  renderer.debug.checkShaderErrors = !!import.meta.env.DEV;
  renderer.toneMapping = opts.toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1;
  renderer.shadowMap.enabled = !!opts.shadows;
  // VSM: bóng mềm thật (radius/blurSamples có tác dụng — PCFSoft bỏ qua radius) và rẻ hơn ở fragment.
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // Shadow map chỉ vẽ lại khi có yêu cầu (requestShadowUpdate) — cảnh tĩnh không tốn thêm 1 lượt vẽ mô hình mỗi khung.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  registerRenderer(renderer); // r21: KTX2Loader dò định dạng nén GPU hỗ trợ (một lần)
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
  container.appendChild(renderer.domElement);

  const resizeCbs = new Set();
  let w = 1, h = 1;
  // r47: đổi cỡ bộ đệm vẽ (setSize — kể cả chỉ đổi DPR lúc kéo / nhón, setInteracting) XOÁ canvas về đen. Khung rAF kế tiếp
  // PHẢI vẽ, không được bị trần FPS bỏ qua — trước r47, trần 60 trên màn 120 Hz (hay trần 30 trên màn 60 Hz) để khung đó
  // trình chiếu canvas trống: "ô chữ nhật đen loé" mỗi lần nhón (bắt đầu kéo, và ~220 ms sau khi thả — DPR trả lại).
  let drawNext = false;
  function resize() {
    const r = container.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    drawNext = true;
    resizeCbs.forEach((cb) => cb(w, h));
  }
  // r47: ResizeObserver gọi SAU các callback rAF của khung, ngay trước lúc vẽ màn hình → bộ đệm vừa xoá sẽ được trình chiếu
  // (một khung đen khi đổi cỡ cửa sổ / vào toàn màn hình). Vòng vẽ đang chạy → vẽ NGAY một khung (bước thời gian 0, bắt buộc
  // vẽ) trong chính callback này.
  const ro = new ResizeObserver(() => {
    resize();
    if (!raf || !frameCb) return;
    forcing++;
    try {
      frameCb(0, clock.elapsedTime);
    } finally {
      forcing--;
    }
  });
  ro.observe(container);
  resize();
  // Tab ẩn (không có rendering opportunity) → ResizeObserver không gọi; đo lại sau 1 tick cho chắc.
  const t0 = setTimeout(resize, 0);

  // DPR thích ứng: hạ độ phân giải khi đang kéo/lăn chuột, trả lại sau khi dừng — thao tác luôn mượt.
  let interactTimer = 0;
  let interacting = false;
  function setInteracting(on) {
    if (opts.adaptiveDpr === false) return;
    clearTimeout(interactTimer);
    if (on) {
      if (!interacting) { interacting = true; renderer.setPixelRatio(Math.max(1, baseDpr * 0.7)); resize(); }
      return;
    }
    // r80: chỉ trả DPR khi ĐÃ hạ (pointerup ở bất cứ đâu — nút HUD, nút Đóng… — không còn gây một lần resize thừa)
    if (!interacting) return;
    interactTimer = setTimeout(() => {
      interacting = false;
      renderer.setPixelRatio(baseDpr);
      resize();
    }, 220);
  }
  const el = renderer.domElement;
  const onDown = () => setInteracting(true);
  const onUp = () => setInteracting(false);
  const onWheel = () => { setInteracting(true); setInteracting(false); };
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: true });

  let raf = 0;
  let frameCb = null;
  let forcing = 0; // > 0 trong lúc capture()/bench() bơm khung — mọi khung phải thực sự vẽ

  /**
   * Như renderer.compileAsync nhưng không bao giờ ném / treo khi vật liệu bị huỷ giữa chừng, và làm luôn phần "dùng
   * lần đầu" của chương trình khi đã link xong (xem trong check()) — khung hiện vật thể lần đầu không phải trả nữa.
   * compileAsync của three hỏi properties.get(material).currentProgram.isReady() mỗi 10 ms: vật liệu huỷ giữa
   * lúc chờ (bản sao bia bị đẩy khỏi bộ nhớ đệm, view unmount) → currentProgram undefined → TypeError trong
   * setTimeout (không bắt được) và lời hứa không bao giờ xong. Ở đây vật liệu đã huỷ / không có chương trình
   * thì thôi chờ nó.
   * `target`: render target đặt TẠM chỉ quanh lượt compile đồng bộ (biến thể tone map / không gian màu của RT).
   * KHÔNG giữ nó suốt lúc chờ link: vòng vẽ chạy xen giữa sẽ vẽ nhầm vào RT thay vì màn hình.
   */
  function compileSafe(object, camera, scene, target) {
    let mats;
    if (target !== undefined) {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      try {
        mats = renderer.compile(object, camera, scene);
      } finally {
        renderer.setRenderTarget(prev);
      }
    } else mats = renderer.compile(object, camera, scene);
    const props = renderer.properties;
    const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
    return new Promise((resolve) => {
      const check = () => {
        for (const m of mats) {
          const mp = props.get(m);
          const prog = mp.currentProgram;
          if (prog && !prog.isReady()) continue;
          mats.delete(m);
          // "Dùng lần đầu" ngay bây giờ (lúc rảnh) thay vì ở khung vẽ đầu tiên: three đọc log biên dịch + bảng
          // uniform / attribute (lời gọi đồng bộ sang GPU, 2–12 ms mỗi chương trình) ở lần getUniforms() đầu tiên.
          if (mp.programs) for (const pr of mp.programs.values()) if (pr.isReady()) pr.getUniforms();
        }
        if (!mats.size) resolve();
        else setTimeout(check, 10);
      };
      if (parallel) check();
      else setTimeout(check, 10);
    });
  }
  // r40: trần khung hình (Cài đặt → Hiển thị → FPS tối đa). rAF vẫn chạy theo tần số màn hình; lượt nào tới sớm hơn lịch
  // (mỗi 1/trần giây) thì bỏ qua — không gọi frameCb, không vẽ. Lịch cộng dồn (nextAt += bước) nên màn 144 Hz trần 60 vẫn
  // ra đúng ~60 lượt / s; trễ quá một bước thì đặt lại lịch từ bây giờ. dt của lượt chạy = thời gian THẬT từ lượt chạy trước
  // (clock.getDelta chỉ gọi ở lượt chạy) → mọi chuyển động theo dt giữ đúng tốc độ ở mọi trần.
  let userCapMs = 1000 / maxFps(getSettings());
  let capMs = userCapMs;
  let nextAt = 0;
  // r64 — TRẦN THÍCH ỨNG lúc chuyển bia (người dùng: "fps drop khi nắm và kéo lướt"): trần 120 mà khung của lượt kéo / lướt
  // (view báo qua setTransitionBusy) vượt ngân sách 120 (≥ ADAPT_LATE_N khung trễ > 1,5 × bước trong ADAPT_WIN khung gần
  // nhất — canvas lớn / GPU yếu: 4K rơi 21–24 % khung) → chạy trần 60 CHO HẾT lượt đó rồi trả 120. Lượt LƯỚT kế tiếp trong
  // ADAPT_MEMORY_MS sau một lần phải hạ → vào 60 ngay từ đầu (khỏi rơi khung lúc dò lại); lúc KÉO (bia theo tay — nhẹ hơn
  // lướt nhiều) thì chỉ hạ khi chính lượt kéo đó trễ. Màn ≤ ~66 Hz: không làm gì (120 vốn đã là tần số màn hình). Đồng hồ FPS
  // (gỡ lỗi) hiện "120→60 (lướt)".
  const ADAPT_FPS = 60;
  const ADAPT_WIN = 20;
  const ADAPT_LATE_N = 3;
  const ADAPT_MEMORY_MS = 30000;
  const adapt = { busy: null, limited: false, late: [], lastLimitedAt: -1e9, rafMs: 16.7, lastRaf: 0 };
  function applyCap() {
    const ms = adapt.limited ? Math.max(userCapMs, 1000 / ADAPT_FPS) : userCapMs;
    if (ms !== capMs) {
      capMs = ms;
      nextAt = 0;
    }
    setFpsNote(adapt.limited ? `${Math.round(1000 / userCapMs)}→${ADAPT_FPS} (lướt)` : null);
  }
  function setLimited(on) {
    if (on === adapt.limited) return;
    adapt.limited = on;
    if (on) adapt.lastLimitedAt = performance.now();
    applyCap();
  }
  /** Có đáng thích ứng không: trần người dùng > 60 và màn hình thật sự nhanh hơn ~66 Hz. */
  const adaptable = () => userCapMs < 1000 / ADAPT_FPS - 0.5 && adapt.rafMs < 15;
  const offCap = onSettings((s) => {
    const ms = 1000 / maxFps(s);
    if (ms === userCapMs) return;
    userCapMs = ms;
    if (!adaptable()) adapt.limited = false;
    applyCap();
    nextAt = 0;
  });
  const clock = new THREE.Clock();
  function loop(now = performance.now()) {
    raf = requestAnimationFrame(loop);
    // r64: nhịp rAF thật của màn hình (EMA — cả lượt bị trần bỏ qua)
    if (adapt.lastRaf) {
      const d = now - adapt.lastRaf;
      if (d > 2 && d < 100) adapt.rafMs += (d - adapt.rafMs) * 0.05;
    }
    adapt.lastRaf = now;
    // dung sai: dao động mốc rAF quanh nhịp màn hình (không bỏ nhầm lượt đúng hạn)
    const forced = drawNext;
    if (!forced && nextAt && now < nextAt - Math.min(2, capMs * 0.25)) return;
    drawNext = false;
    // khung bắt buộc (vừa đổi cỡ) lệch lịch → lịch đếm lại từ khung này (không để một khoảng gần gấp đôi ngay sau nó)
    nextAt = !forced && nextAt && now - nextAt < capMs ? nextAt + capMs : now + capMs;
    markFrame(now);
    if (import.meta.env.DEV) window.__fgTick?.(); // DEV: công cụ đo khung ngoài (đánh dấu lượt vòng vẽ THỰC SỰ chạy)
    const dt = Math.min(clock.getDelta(), 0.1);
    // r64: đang chuyển bia ở trần > 60 → đếm khung trễ
    if (adapt.busy !== null && !adapt.limited && adaptable()) {
      adapt.late.push(dt * 1000 > capMs * 1.5 ? 1 : 0);
      if (adapt.late.length > ADAPT_WIN) adapt.late.shift();
      if (adapt.late.reduce((a, b) => a + b, 0) >= ADAPT_LATE_N) setLimited(true);
    }
    frameCb?.(dt, clock.elapsedTime);
  }

  const api = {
    renderer,
    get width() { return w; },
    /** Yêu cầu vẽ lại shadow map ở khung tới (gọi khi đổi mô hình, mô hình/đèn di chuyển). */
    requestShadowUpdate() { renderer.shadowMap.needsUpdate = true; },
    /** Bật/tắt chế độ tương tác (hạ DPR tạm thời) — thường không cần gọi, đã tự bắt pointer/wheel. */
    setInteracting,
    get height() { return h; },
    /** Đăng ký callback khi container đổi kích thước (w, h theo CSS px). */
    onResize(cb) { resizeCbs.add(cb); cb(w, h); return () => resizeCbs.delete(cb); },
    /** Bắt đầu vòng lặp: cb(dt giây, elapsed giây). */
    start(cb) { frameCb = cb; if (!raf) { clock.start(); nextAt = 0; loop(); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    /**
     * r64: biên dịch NGAY (đồng bộ lúc gọi — vật thể đang ẩn thì người gọi hiện TẠM quanh lời gọi này) + chờ link xong, không
     * ném / treo; target: biến thể vẽ vào render target (vd. RT ghép ảnh của chuyển cảnh).
     */
    compileNow(object, camera, scene, target) {
      return compileSafe(object, camera, scene, target);
    },
    /** r40: trần khung hình đang áp (lượt / giây) — Cài đặt → Hiển thị → FPS tối đa (r64: kể cả trần thích ứng lúc lướt). */
    get maxFps() { return Math.round(1000 / capMs); },
    /**
     * r64: view báo lượt đang chạy (mỗi khung được; chỉ đổi khi khác trước): null | 'drag' (bia theo tay) | 'glide' (lướt — kể
     * cả lượt kéo đã nhận chạy nốt) — trần thích ứng (xem ADAPT_*): hết lượt → trả trần người dùng; vào 'glide' ngay sau một lần
     * phải hạ (≤ ADAPT_MEMORY_MS) → 60 từ đầu; đã hạ giữa lúc kéo thì giữ 60 qua phần lướt của chính lượt đó.
     */
    setTransitionBusy(mode) {
      mode = mode === 'drag' || mode === 'glide' ? mode : null;
      if (mode === adapt.busy) return;
      const was = adapt.busy;
      adapt.busy = mode;
      adapt.late.length = 0;
      if (!mode) setLimited(false);
      else if (mode === 'glide' && adaptable() && performance.now() - adapt.lastLimitedAt < ADAPT_MEMORY_MS) setLimited(true);
      else if (!was) setLimited(false);
    },
    /** r64 DEV / kiểm thử: trạng thái trần thích ứng. */
    get capInfo() {
      return { userFps: Math.round(1000 / userCapMs), fps: Math.round(1000 / capMs), limited: adapt.limited, busy: adapt.busy, rafMs: +adapt.rafMs.toFixed(2), adaptable: adaptable(), lastLimitedAgoMs: adapt.lastLimitedAt > 0 ? Math.round(performance.now() - adapt.lastLimitedAt) : null };
    },
    /**
     * Nạp trước texture + biên dịch shader của object lên GPU (dùng cho bia kế tiếp đã preload)
     * để khi hiện không bị khựng khung. Trả về Promise (không reject).
     * @param {THREE.Object3D} object đối tượng (đã instantiate) sẽ hiển thị trong `scene`
     */
    preheat(object, scene, camera) {
      object.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
            if (m[k]) renderer.initTexture(m[k]);
          }
        }
      });
      // Biên dịch cả biến thể vẽ vào render target (dùng khi ghép ảnh lúc chuyển cảnh) để không khựng lần đầu.
      const work = Promise.resolve()
        .then(() => compileSafe(object, camera, scene))
        .then(async () => {
          const { ensureCompositeTarget } = await import('./transitions.js');
          await compileSafe(object, camera, scene, ensureCompositeTarget(renderer).rt);
        })
        .catch(() => {});
      // Lưới an toàn: chờ link quá PREHEAT_MAX_MS thì coi như xong (nạp trước các bia sau không đứng chờ mãi).
      let timer = 0;
      return Promise.race([work, new Promise((r) => (timer = setTimeout(r, PREHEAT_MAX_MS)))]).finally(() => clearTimeout(timer));
    },
    /**
     * r16: làm phần "dùng lần đầu" cho MỌI chương trình đã link xong mà chưa từng vẽ (vd. biến thể gương / ghép ảnh
     * của vật liệu dựng lười): three đọc bảng uniform / attribute (lời gọi đồng bộ sang GPU, 2–12 ms mỗi chương trình) ở
     * lần vẽ đầu — làm bây giờ, lúc rảnh. Trả số chương trình đã làm.
     */
    primePrograms() {
      let n = 0;
      for (const p of renderer.info.programs ?? []) {
        if (p.__vmPrimed || !p.isReady()) continue;
        p.getUniforms();
        p.__vmPrimed = true;
        n++;
      }
      return n;
    },
    /** Vẽ BẮT BUỘC ở mọi khung đang chạy (DEV capture / bench) — view vẽ theo yêu cầu phải nhìn cờ này. */
    get forcing() {
      return forcing > 0;
    },
    /**
     * DEV: đo chi phí khung hình — vẽ `frames` khung rồi gl.finish() để tính cả thời gian GPU.
     * Trả về ms/khung, số draw call và tam giác trung bình mỗi khung.
     */
    bench({ frames = 40, dt = 1 / 60 } = {}) {
      resize();
      const gl = renderer.getContext();
      forcing++;
      try {
        frameCb?.(dt, clock.elapsedTime);
      } finally {
        forcing--;
      }
      gl.finish();
      const prevAuto = renderer.info.autoReset;
      renderer.info.autoReset = false;
      renderer.info.reset();
      const t0 = performance.now();
      forcing++;
      try {
        for (let i = 0; i < frames; i++) frameCb?.(dt, clock.elapsedTime + i * dt);
      } finally {
        forcing--;
      }
      gl.finish();
      const ms = (performance.now() - t0) / frames;
      const r = renderer.info.render;
      const out = { msPerFrame: +ms.toFixed(2), fps: +(1000 / ms).toFixed(1), calls: Math.round(r.calls / frames), triangles: Math.round(r.triangles / frames), dpr: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height], shadowType: renderer.shadowMap.type };
      renderer.info.autoReset = prevAuto;
      renderer.info.reset();
      return out;
    },
    /**
     * DEV: vẽ `frames` khung liên tiếp (mô phỏng thời gian trôi, kể cả khi tab ẩn/rAF dừng)
     * rồi trả về data URL của canvas. scale < 1 để giảm dung lượng.
     */
    capture({ frames = 1, dt = 1 / 60, scale = 0.5, type = 'image/jpeg', quality = 0.85, bg = null } = {}) {
      resize();
      forcing++;
      try {
        for (let i = 0; i < frames; i++) frameCb?.(dt, clock.elapsedTime + i * dt);
      } finally {
        forcing--;
      }
      const src = renderer.domElement;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(src.width * scale));
      c.height = Math.max(1, Math.round(src.height * scale));
      const ctx = c.getContext('2d');
      // Nền: màu truyền vào, hoặc màu nền CSS của container (canvas alpha → tránh ra đen).
      const fill = bg ?? getComputedStyle(container).backgroundColor;
      if (fill && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') { ctx.fillStyle = fill; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL(type, quality);
    },
    dispose() {
      this.stop();
      offCap();
      if (adapt.limited) setFpsNote(null);
      clearTimeout(t0);
      clearTimeout(interactTimer);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      ro.disconnect();
      if (import.meta.env.DEV) window.__vm?.renderers?.delete(api);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  if (import.meta.env.DEV) {
    // Sổ đăng ký renderer đang sống, cho kiểm thử tự động: window.__vm.snap('ten')
    const vm = (window.__vm ??= {});
    (vm.renderers ??= new Set()).add(api);
    vm.bench ??= (opts = {}) => { const list = [...vm.renderers]; return list[list.length - 1]?.bench(opts); };
    vm.snap ??= async (name = 'capture', opts = {}) => {
      const list = [...vm.renderers];
      const r = list[list.length - 1];
      if (!r) throw new Error('no renderer');
      const dataUrl = r.capture(opts);
      const res = await fetch(`/__capture?name=${encodeURIComponent(name)}`, { method: 'POST', body: dataUrl });
      return res.text();
    };
  }
  return api;
}
