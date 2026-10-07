// Điện ảnh › móc DEV — window.__vm.cinema* cho kiểm thử / đo đạc (chỉ chạy khi import.meta.env.DEV)
//
// Giả lập chuột / tay / vẩy, ghi vết thông tin + hiện/ẩn, trạng thái rảnh / tự trình chiếu, hướng dẫn, xoa.
// Bản build bỏ hẳn (khối if (import.meta.env.DEV) bị loại).
//
// Tách cơ học từ index.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem index.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps.
// Giữ (S — module này ghi chính): devLog*, devInfoTrace*
//   (* khai báo + giá trị đầu nằm ở index.js, giữ thứ tự khởi tạo cũ)
// Đọc / ghi S của nơi khác: index, cur, playing, autoMode, lastInteract, idleCfg, panelOpen
import { loadStats } from '../../../core/loader.js';
import { setSetting } from '../../../core/settings.js';

export function installDev(S, K, deps) {
  const {
    clearHand, hud, info, lods, presence, rub, setPanel, stage, step, toNdc, tutorial
  } = deps;

  if (import.meta.env.DEV) {
    const vm = (window.__vm ??= { renderers: new Set() });
    /** Sang bia kế rồi ghim chuyển cảnh (Lướt) ở tiến độ p. (Tham số đầu còn giữ cho tương thích — chỉ còn 'glide'.) */
    vm.cinemaTx = async (_effect = 'glide', p = 0.5) => {
      step(1);
      // Không dùng requestAnimationFrame: khung trình duyệt có thể đang ẩn (chụp headless).
      for (let i = 0; i < 200 && vm.cinemaTxProgress?.() < 0; i++) {
        await new Promise((r) => setTimeout(r, i < 20 ? 0 : 25));
      }
      return vm.cinemaHoldTx?.(p);
    };

    // ---- Thông tin bia: đổi kiểu, đọc trạng thái, ghim, và ctx để thử tay.
    vm.cinemaInfo = {
      /** Đổi kiểu hiện thông tin (qua đúng đường cài đặt thật) và chờ gắn xong. */
      use: async (id) => {
        setSetting('cinemaInfo', id);
        await info.whenReady();
        return vm.cinemaInfo.state();
      },
      state: () => ({
        id: info.id,
        mounted: info.mounted,
        shown: presence.shown,
        visible: info.isVisible(),
        pinned: presence.pinned,
        latched: presence.latched,
        hudRootNodes: hud.el.hudRoot.childElementCount,
        css3dObjects: info.ctx.css3d?.scene.children.length ?? 0,
      }),
      pin: (on = true) => presence.pin(on),
      ctx: info.ctx,
    };
    /** DEV: dừng / chạy lại vòng vẽ (để bơm từng khung bằng vm.cinemaTick khi chụp theo khung). */
    vm.cinemaLoop = (on = true) => (on ? stage.start() : stage.stop(), !!on);
    /** DEV: sang bia kế / trước như bấm nút (không đổi kiểu chuyển cảnh). */
    vm.cinemaStep = (d = 1) => step(d);
    // (r62: bỏ cinemaHandNav / cinemaHandNavMock — Điện ảnh không còn chế độ "nhắm rồi vẩy" hand:nav)
    /** DEV (r19): trạng thái tự trình chiếu; { idleMs } giả như đã rảnh ngần này (thử nhanh). */
    /** DEV (r21): trạng thái LOD — số lần tải / đẩy ra, số bản trong bộ nhớ theo LOD, LOD đang hiện, byte đã tải. */
    /** DEV (r23): dòng thời gian (kính lúp: .magnify, tickRect, kind). */
    vm.cinemaTimeline = hud.timeline;
    /**
     * DEV (r24): giả lập hợp đồng "dính" của lớp cử chỉ — đặt body[data-hand-sticky] + phát hand:sticky như lớp cử chỉ.
     * cinemaSticky('timeline', { rel: { x: .3 } }) · cinemaSticky('nav-next', { active: false }) · cinemaStickyPinch()
     */
    /** DEV (r32): hướng dẫn cử chỉ — start('manual'|'auto') / stop(why) / state(). */
    vm.cinemaTutorial = { start: (w = 'manual') => tutorial.start(w), stop: (w = 'dev') => tutorial.stop(w), state: () => tutorial.debug() };
    vm.cinemaSticky = (name, d = {}) => {
      const active = d.active !== false;
      if (active) document.body.dataset.handSticky = name;
      else if (document.body.dataset.handSticky === name) delete document.body.dataset.handSticky;
      window.dispatchEvent(new CustomEvent('hand:sticky', { detail: { name, active, x: 0, y: 0, rel: { x: 0.5, y: 0.5 }, pinch: false, t: performance.now(), ...d, ...(active ? {} : { why: 'dev' }) } }));
      return document.querySelector('[data-hand-focus]')?.dataset.i ?? null;
    };
    /** DEV (r24): cú nhón ở chế độ dính — bấm [data-hand-focus] trong phần tử dính, không có thì bấm chính phần tử. */
    vm.cinemaStickyPinch = () => {
      const name = document.body.dataset.handSticky;
      // (r27: :not(body) — body cũng mang data-hand-sticky="<tên>" lúc đang dính, trước đây bị bấm nhầm vào body)
      const zone = name ? document.querySelector(`[data-hand-sticky="${name}"]:not(body)`) : null;
      const t = zone?.querySelector('[data-hand-focus]') ?? zone;
      t?.click();
      return t ? (t.dataset.i ?? t.dataset.dir ?? name) : null;
    };
    vm.cinemaLods = () => ({ ...lods.stats, resident: lods.resident(), liveLod: stage.liveLod, loadedMB: +(loadStats.bytes / 2 ** 20).toFixed(1), files: loadStats.files, evicted: loadStats.evicted, v2: lods.v2 });
    vm.cinemaIdle = (o = {}) => {
      if (o.idleMs != null) S.lastInteract = performance.now() - o.idleMs;
      // r62: + lượt dừng hiện tại (ms đã đếm / thời gian dừng đã chốt / tiến độ trên dòng thời gian)
      return { playing: S.playing, autoMode: S.autoMode, idleS: +((performance.now() - S.lastInteract) / 1000).toFixed(1), cfg: { ...S.idleCfg }, shown: presence.shown, index: S.index, id: S.cur?.id ?? null, autoMs: Math.round(S.autoMs), dwellMs: S.autoDwellCur, dwellSetMs: S.autoDwellMs, progress: +Math.min(1, S.autoMs / S.autoDwellCur).toFixed(3) };
    };
    /** DEV (r54): luật hiện / ẩn thông tin — đang hiện, ghim, chốt, giữ sau khi xoay (đếm ra ngoài / mất con trỏ). */
    /**
     * r71 → r72: thông tin mở rộng — trạng thái + thao tác: use(true|false) bật / tắt, names() "Xem ĐỀ DANH", read() đọc toàn
     * văn, close() đóng lớp đọc, open(at) mở thẳng lớp đọc ('top' | 'roll' — như giữ hai ngón trên bia).
     */
    vm.cinemaRich = {
      use: async (on = true) => {
        setSetting('cinemaInfoRich', on !== false && on !== 'off');
        await info.whenReady();
        await new Promise((r) => setTimeout(r, 60));
        return { rich: info.rich, id: info.id };
      },
      state: () => ({ rich: info.rich, id: info.id, overlay: info.overlayOpen, dbg: info.debugState?.() ?? null }),
      dev: () => info.devRich(),
      names: () => info.devRich()?.names?.(),
      read: () => info.devRich()?.read?.(),
      close: () => info.devRich()?.close?.(),
      open: (at = 'top') => info.openFull(null, at),
    };
    vm.cinemaPresence = () => ({ shown: presence.shown, pinned: presence.pinned, latched: presence.latched, held: presence.orbitHeld, ...presence.holdState() });
    /** DEV: điểm màn hình (px client) trên thân bia hiện tại. */
    vm.cinemaStelePoint = () => stage.devSteleScreenPoint();
    /** DEV (r13): điểm px client có trúng tấm bia không (tia xuyên lưới, như hover). */
    vm.cinemaHitAt = (x, y) => stage.hitTest(...toNdc(x, y));
    vm.cinemaInfoTrace = (on = true) => {
      if (on) {
        S.devInfoTrace = [];
        S.devInfoTrace.t0 = performance.now();
        return true;
      }
      const out = S.devInfoTrace ?? [];
      S.devInfoTrace = null;
      return out;
    };

    /**
     * Chạy một kịch bản con trỏ theo THỜI GIAN THẬT. Vòng vẽ của sân khấu tạm dừng và được bơm
     * tay mỗi ~16 ms (đúng cả khi khung trình duyệt bị ẩn và rAF đứng yên); giữa các khung nhường
     * luồng để promise (tải bia) chạy được. Trả về mốc các pha + nhật ký hiện/ẩn (ms).
     */
    const runSim = async (phases) => {
      stage.stop();
      S.devLog = [];
      S.devLog.t0 = performance.now();
      const marks = [];
      let last = S.devLog.t0;
      try {
        for (const ph of phases) {
          const p0 = performance.now();
          marks.push({ t: Math.round(p0 - S.devLog.t0), phase: ph.name });
          ph.enter?.();
          for (;;) {
            const now = performance.now();
            if (now - p0 >= ph.ms) break;
            if (now - last >= 16) {
              ph.at?.((now - p0) / ph.ms);
              vm.cinemaTick?.((now - last) / 1000);
              last = now;
            }
            await new Promise((r) => setTimeout(r, 2));
          }
        }
      } finally {
        stage.start();
      }
      const log = S.devLog;
      S.devLog = null;
      return { marks, log: [...log] };
    };

    /** Sự kiện con trỏ tổng hợp lên canvas (như lớp cử chỉ làm), chịu được thiếu pointer capture. */
    const SIM_ID = 7771;
    const firePointer = (type, x, y, buttons) =>
      stage.canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: SIM_ID,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
        }),
      );
    const patchCapture = () => {
      const c = stage.canvas;
      const saved = ['setPointerCapture', 'releasePointerCapture'].map((k) => [k, Object.getOwnPropertyDescriptor(c, k)]);
      for (const [k] of saved) {
        const orig = c[k];
        c[k] = function (id) {
          try {
            return orig.call(this, id);
          } catch {
            return undefined; // con trỏ tổng hợp không "sống" trong trình duyệt → bỏ qua
          }
        };
      }
      return () => {
        for (const [k, d] of saved) {
          if (d) Object.defineProperty(c, k, d);
          else delete c[k];
        }
      };
    };

    /**
     * Chuột: rê lên bia hoverMs → (mode 'drag') nhấn trên bia, kéo ra xa dx px trong dragMs, thả
     * ngoài bia → đứng yên ngoài bia afterMs. (mode 'leave') rê lên bia rồi dời ra ngoài, không kéo.
     */
    vm.cinemaMouseSim = async ({ hoverMs = 800, dragMs = 800, afterMs = 900, dx = -480, mode = 'drag' } = {}) => {
      presence.pin(false);
      const P = stage.devSteleScreenPoint();
      const restore = patchCapture();
      let x = P.x;
      const phases = [{ name: 'hover', ms: hoverMs, at: () => firePointer('pointermove', P.x, P.y, 0) }];
      if (mode === 'drag') {
        phases.push({
          name: 'drag',
          ms: dragMs,
          enter: () => firePointer('pointerdown', P.x, P.y, 1),
          at: (f) => {
            x = P.x + dx * f;
            firePointer('pointermove', x, P.y, 1);
          },
        });
        phases.push({
          name: 'released-off-stele',
          ms: afterMs,
          enter: () => firePointer('pointerup', P.x + dx, P.y, 0),
          at: () => firePointer('pointermove', P.x + dx, P.y, 0),
        });
      } else {
        phases.push({ name: 'left-stele', ms: afterMs, at: () => firePointer('pointermove', P.x + dx, P.y, 0) });
      }
      try {
        const r = await runSim(phases);
        return { mode, stelePx: { x: Math.round(P.x), y: Math.round(P.y) }, ...r };
      } finally {
        restore();
      }
    };

    /**
     * Tay: bàn tay mở trên bia hoverMs → nhón và kéo ngang dx px trong dragMs (lớp cử chỉ thật
     * cũng phát pointerdown/move lên canvas) → nhả tay ở ngoài bia, giữ bàn tay mở afterMs.
     */
    vm.cinemaHandSim = async ({ hoverMs = 1000, dragMs = 1000, afterMs = 900, dx = -480, restDx = null, restMs = 10000 } = {}) => {
      const hadClass = document.body.classList.contains('gesture-on');
      document.body.classList.add('gesture-on');
      presence.pin(false);
      if (S.panelOpen) setPanel(false, 'dev-reset');
      const P = stage.devSteleScreenPoint();
      const restore = patchCapture();
      const hf = (x, y, pose) =>
        window.dispatchEvent(new CustomEvent('hand:frame', { detail: { x, y, detected: true, pose } }));
      try {
        // restDx: bàn tay MỞ nằm yên ở P.x + restDx suốt restMs (thử vòng lặp hover ↔ camera ở mép bia).
        if (restDx != null) {
          const r = await runSim([
            { name: 'hover-open-hand', ms: hoverMs, at: () => hf(P.x, P.y, 'open') },
            { name: 'rest-at-edge', ms: restMs, at: () => hf(P.x + restDx, P.y, 'open') },
          ]);
          return { stelePx: { x: Math.round(P.x), y: Math.round(P.y) }, ...r };
        }
        const r = await runSim([
          { name: 'hover-open-hand', ms: hoverMs, at: () => hf(P.x, P.y, 'open') },
          {
            name: 'pinch-drag-away',
            ms: dragMs,
            enter: () => {
              hf(P.x, P.y, 'pinch');
              firePointer('pointerdown', P.x, P.y, 1);
            },
            at: (f) => {
              const x = P.x + dx * f;
              hf(x, P.y, 'pinch');
              firePointer('pointermove', x, P.y, 1);
            },
          },
          {
            name: 'released-off-stele',
            ms: afterMs,
            enter: () => {
              firePointer('pointerup', P.x + dx, P.y, 0);
              hf(P.x + dx, P.y, 'open');
            },
            at: () => hf(P.x + dx, P.y, 'open'),
          },
        ]);
        return { stelePx: { x: Math.round(P.x), y: Math.round(P.y) }, ...r };
      } finally {
        restore();
        clearHand();
        if (!hadClass) document.body.classList.remove('gesture-on');
      }
    };

    /**
     * Đo thời gian khung (CPU của một tick) khi con trỏ chuột NẰM YÊN trên tấm bia đang đung đưa
     * (onStele=false: nằm yên ngoài bia). Vòng vẽ tạm dừng, khung được bơm tay mỗi ~16 ms.
     * warmMs đầu tiên để lắc kịp chạy (rảnh tay 4 s + tăng tốc 1,2 s) — không tính.
     */
    vm.cinemaPerf = async ({ warmMs = 5800, ms = 6000, onStele = true } = {}) => {
      presence.pin(false);
      vm.cinemaHome?.();
      const P = stage.devSteleScreenPoint();
      const x = onStele ? P.x : 40;
      const y = onStele ? P.y : 120;
      const restore = patchCapture();
      firePointer('pointermove', x, y, 0);
      stage.stop();
      const frames = [];
      let rays = null;
      let sway = [Infinity, -Infinity];
      try {
        const t0 = performance.now();
        let last = t0;
        for (;;) {
          const now = performance.now();
          if (now - t0 >= warmMs + ms) break;
          if (now - last >= 16) {
            if (now - t0 >= warmMs && !rays) {
              vm.cinemaRayStats?.(true);
              rays = true;
            }
            const a = performance.now();
            vm.cinemaTick?.((now - last) / 1000);
            const d = performance.now() - a;
            if (rays) {
              frames.push(d);
              const s = vm.cinemaRayStats?.().swayDeg ?? 0;
              if (s < sway[0]) sway[0] = s;
              if (s > sway[1]) sway[1] = s;
            }
            last = now;
          }
          await new Promise((r) => setTimeout(r, 2));
        }
        rays = vm.cinemaRayStats?.(true);
      } finally {
        stage.start();
        restore();
      }
      const sorted = [...frames].sort((a, b) => a - b);
      const q = (p) => +sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(2);
      return {
        onStele,
        frames: frames.length,
        p50: q(0.5),
        p95: q(0.95),
        p99: q(0.99),
        max: +sorted[sorted.length - 1].toFixed(2),
        mean: +(frames.reduce((s, v) => s + v, 0) / frames.length).toFixed(2),
        swayDeg: sway,
        rays: { n: rays.n, avgMs: +rays.avg.toFixed(3), maxMs: +rays.max.toFixed(3), boxFallback: rays.box },
        hovered: stage.mouseHit,
      };
    };

    /** Chuột đứng yên trên bia, đang hiện → sang bia kế: phải ẩn ngay, xong chuyển cảnh thì hiện lại sau DWELL. */
    /**
     * DEV: "Xoa đầu rùa" — trạng thái, vào / ra thẳng, và hai kịch bản xoa chạy theo THỜI GIAN THẬT qua đúng đường
     * nhập liệu (runSim bơm khung):
     *   hand({ pose, motion, rubMs, freq, ampK, offHeadK, afterMs, enter }) — sự kiện hand:frame tổng hợp;
     *     pose: 'open' (xoè 5 ngón) | 'pinch' | 'fist'; motion: 'rub' (qua lại) | 'sweep' (lướt một lượt) |
     *     'still' (đặt yên) | 'circle'; offHeadK: dời tâm xoa ra ngoài đầu rùa ngần này × bán kính (0 = trên đầu);
     *     enter: false → không vào chế độ trước (thử xoa khi chưa vào).
     *   mouse({ rubMs, freq, ampK, offHeadK, motion }) — vào chế độ, rồi nhấn giữ + xoa (pointer tổng hợp).
     * r70: hai kịch bản này đo XOA TRONG CHẾ ĐỘ nên vào thẳng (rub.enter) — bơm khung đồng bộ không có focus (độ trễ rê
     * theo giờ thật); cách MỞ thật (xoa vài nhịp) thử bằng tryRub bên dưới.
     * Biên độ / độ lệch tính theo bán kính đầu rùa trên màn hình lúc đó (camera đang bay thì bám theo).
     */
    /**
     * Kịch bản bơm khung ĐỒNG BỘ (60 khung/giây ảo): vòng vẽ dừng, mỗi khung chạy at() rồi một lượt vẽ. Luật xoa
     * đo thời gian theo dt của khung (rub.js) → kết quả tất định, không phụ thuộc tab bị bóp nhịp hẹn giờ.
     */
    const pumpSync = (phases, fps = 60) => {
      stage.stop();
      const marks = [];
      let frame = 0;
      try {
        for (const ph of phases) {
          marks.push({ frame, phase: ph.name });
          ph.enter?.();
          const n = Math.max(1, Math.round((ph.ms / 1000) * fps));
          for (let i = 0; i < n; i++) {
            ph.at?.(n === 1 ? 1 : i / (n - 1), i);
            vm.cinemaTick?.(1 / fps);
            ph.after?.(i);
            frame++;
          }
        }
      } finally {
        stage.start();
      }
      return { marks, frames: frame };
    };
    vm.cinemaRub = {
      state: () => rub.debug(),
      enter: (src = 'mouse') => rub.enter(src),
      exit: (why = 'dev') => rub.exit(why),
      head: () => stage.rub.screen(),
      /** Điểm px client có chạm đầu rùa không (tia xuyên lưới) → toạ độ mô hình + k, hoặc null. */
      probe: (x, y, raw = false) => stage.rub.hit(...toNdc(x, y), raw),
      /** Độ bóng (0..1, như shader) tại điểm px client trên đầu rùa. */
      polishAt: (x, y) => {
        const h = stage.rub.hit(...toNdc(x, y));
        return h ? stage.rub.polishAt(h) : null;
      },
      /** Albedo trung bình đầu rùa (tuyến tính) của bia hiện tại — đo từ texture quét. */
      albedo: () => stage.rub.headAlbedo,
      /** (r70: không còn bước mở khoá — giữ cho kiểm thử cũ, không làm gì.) */
      unlock: () => rub.unlock(),
      lock: () => rub.lock(),
      /**
       * r70 — thử XOA ĐỂ MỞ như người dùng, THEO GIỜ THẬT (mỗi khung vẽ một mẫu — focus / độ trễ rê cần thời gian thật): src 'hand' (tâm lòng bàn tay, xoè / pose) |
       * 'mouse' (nhấn giữ trên đầu rùa); motion 'rub' (qua lại) · 'circle' (xoay tròn) · 'still' (để yên) · 'sweep' (lướt
       * qua một lượt) · 'drift' (lượn chậm quanh đầu rùa); aimMs: tay xoè để yên trên đầu rùa trước (cho focus tới);
       * strokes: dừng sau đúng số nhịp này (freq = nhịp / s → ms = strokes / freq) rồi đứng yên afterMs. Trả vết mỗi khung
       * (t ms, pha, active, số nhịp, ánh fx, vì sao không thử được, nguồn, focus, đang loé nhịp cuối, chú thích).
       * r70b: untilFocus → pha rê dừng ngay khung đầu tiên bia focus (aimMs là trần) — bắt đầu xoa đúng lúc camera đang lướt vào
       * khung focus; track: false → tâm xoa đứng yên ở chỗ đầu rùa lúc bắt đầu xoa (tay không bám theo đầu rùa đang trôi).
       * Trả thêm glide (đầu rùa dời bao nhiêu px / cỡ đổi bao nhiêu trong lúc xoa) và focusLeadMs (focus → bắt đầu xoa).
       */
      tryRub: async ({ src = 'hand', motion = 'rub', ms = 2400, strokes = 0, freq = 2.2, ampK = 0.5, pose = 'open', aimMs = 700, afterMs = 1200, release = true, untilFocus = false, track = true } = {}) => {
        const hadClass = document.body.classList.contains('gesture-on');
        if (src === 'hand') document.body.classList.add('gesture-on');
        // chế độ nhập như lớp cử chỉ đặt khi tay / chuột nắm quyền (chuột thật vừa rê → 'mouse' thì tay tổng hợp bị bỏ qua hover)
        const prevInput = document.body.dataset.input;
        document.body.dataset.input = src === 'hand' ? 'hand' : 'mouse';
        presence.pin(false);
        const restore = patchCapture();
        let base = null;
        const at = () => (base = stage.rub.screen() ?? base ?? { x: innerWidth / 2, y: innerHeight / 2, r: 60 });
        const hf = (px, py, p) => {
          // r72g: 'v' = đang giữ chữ V (hover: false, v: true — như lớp cử chỉ báo)
          const d = { x: px, y: py, detected: true, engaged: true, pose: p === 'pinch' ? 'pinch' : p === 'fist' ? 'fist' : 'open', open5: p === 'open', palmX: px, palmY: py, fistProgress: 0, fist: false, ...(p === 'v' ? { v: true, hover: false } : {}) };
          window.dispatchEvent(new CustomEvent('hand:frame', { detail: d }));
        };
        const ID = 7772;
        const fire = (type, x, y, buttons) => stage.canvas.dispatchEvent(new PointerEvent(type, { pointerId: ID, pointerType: 'mouse', isPrimary: true, button: 0, buttons, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, view: window }));
        const up = (x, y) => {
          fire('pointerup', x, y, 0);
          window.dispatchEvent(new PointerEvent('pointerup', { pointerId: ID, pointerType: 'mouse', clientX: x, clientY: y }));
        };
        const put = (x, y, buttons = 1) => (src === 'hand' ? hf(x, y, pose) : fire('pointermove', x, y, buttons));
        const rows = [];
        const T0 = performance.now();
        const rec = (name) => {
          const d = rub.debug();
          rows.push({ t: Math.round(performance.now() - T0), ph: name, active: d.active, strokes: d.arm.strokes, fx: d.arm.fx, why: d.arm.why, src: d.arm.src, shown: presence.shown, entering: d.arm.entering, cap: d.caption });
        };
        const moveMs = strokes > 0 ? (strokes / freq) * 1000 : ms;
        const s0 = at();
        let last = [s0.x, s0.y];
        const phases = [];
        // rê lên đầu rùa trước (tay xoè / chuột không nhấn) — focus tới như người dùng thật
        let focusAt = -1;
        let c0 = null; // đầu rùa lúc bắt đầu xoa
        let c1 = null; // … lúc xoa xong
        if (aimMs > 0) phases.push({ name: 'aim', ms: aimMs, until: () => untilFocus && presence.shown, at: () => { const s = at(); last = [s.x, s.y]; put(s.x, s.y, 0); }, after: () => { if (focusAt < 0 && presence.shown) focusAt = performance.now(); rec('aim'); } });
        let tMove = -1;
        phases.push({
          name: motion,
          ms: moveMs,
          enter: () => {
            tMove = performance.now();
            c0 = { ...at() };
            if (src === 'mouse') fire('pointermove', c0.x, c0.y, 0), fire('pointerdown', c0.x, c0.y, 1);
          },
          at: (f) => {
            const s = track ? at() : c0;
            c1 = { ...at() };
            const tt = (f * moveMs) / 1000;
            const A = ampK * s.r;
            let x = s.x;
            let y = s.y;
            if (motion === 'rub') { x = s.x + A * Math.sin(2 * Math.PI * freq * tt); y = s.y + 0.15 * A * Math.sin(4 * Math.PI * freq * tt); }
            else if (motion === 'circle') { x = s.x + A * Math.cos(2 * Math.PI * freq * tt); y = s.y + A * Math.sin(2 * Math.PI * freq * tt); }
            else if (motion === 'sweep') x = s.x - 3 * s.r + 6 * s.r * f;
            else if (motion === 'drift') { x = s.x + 1.2 * s.r * Math.sin(2 * Math.PI * 0.35 * tt); y = s.y + 0.6 * s.r * Math.cos(2 * Math.PI * 0.27 * tt); }
            last = [x, y];
            put(x, y);
          },
          after: () => rec(motion),
        });
        phases.push({ name: 'after', ms: afterMs, enter: () => { if (src === 'mouse' && release) up(last[0], last[1]); }, at: () => { if (src === 'hand') put(last[0], last[1]); }, after: () => rec('after') });
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        try {
          for (const ph of phases) {
            ph.enter?.();
            const t0 = performance.now();
            for (;;) {
              const f = Math.min(1, (performance.now() - t0) / Math.max(1, ph.ms));
              ph.at?.(f);
              await frame();
              ph.after?.();
              if (f >= 1 || ph.until?.()) break;
            }
          }
          const glide = c0 && c1 ? { dx: Math.round(c1.x - c0.x), dy: Math.round(c1.y - c0.y), rK: +(c1.r / c0.r).toFixed(3) } : null;
          const focusLeadMs = focusAt >= 0 && tMove >= 0 ? Math.round(tMove - focusAt) : null;
          return { head0: s0 && { x: Math.round(s0.x), y: Math.round(s0.y), r: Math.round(s0.r) }, rows, rub: rub.debug(), glide, focusLeadMs };
        } finally {
          if (src === 'mouse' && !release) up(last[0], last[1]);
          restore();
          if (src === 'hand') {
            clearHand();
            rub.handLost();
          }
          if (!hadClass) document.body.classList.remove('gesture-on');
          if (prevInput === undefined) delete document.body.dataset.input;
          else document.body.dataset.input = prevInput;
        }
      },
      hand: async ({ pose = 'open', motion = 'rub', rubMs = 3000, freq = 2.5, ampK = 0.55, offHeadK = 0, offYK = 0, afterMs = 400, enter = true, settleMs = 1300, sample = 0 } = {}) => {
        const hadClass = document.body.classList.contains('gesture-on');
        document.body.classList.add('gesture-on');
        presence.pin(false);
        const restore = patchCapture();
        let base = null;
        const at = () => {
          const s = stage.rub.screen() ?? base ?? { x: innerWidth / 2, y: innerHeight / 2, r: 60 };
          base = s;
          return s;
        };
        const hf = (px, py, p, extra = {}) => {
          const d = { x: px - 60, y: py - 90, detected: true, engaged: true, pose: p === 'pinch' ? 'pinch' : p === 'fist' ? 'fist' : 'open', open5: p === 'open', palmX: px, palmY: py, fistProgress: 0, fist: false, ...extra };
          window.dispatchEvent(new CustomEvent('hand:frame', { detail: d }));
        };
        const s0 = stage.rub.screen();
        const phases = [];
        if (enter && !rub.active) {
          // vào thẳng, tay xoè đặt yên trên đầu rùa chờ camera tới khung cận
          phases.push({ name: 'enter', ms: settleMs, enter: () => rub.enter('hand'), at: () => { const s = at(); hf(s.x, s.y, 'open'); } });
        }
        const samples = [];
        const every = sample > 0 ? Math.round(sample * 60) : 0;
        phases.push({
          name: `${motion}-${pose}`,
          ms: rubMs,
          // DEV: mỗi `sample` giây ghi lượt xoa + độ bóng tại tâm vùng xoa (đo "bao nhiêu lượt để bóng tối đa")
          after: (i) => {
            if (!every || (i + 1) % every) return;
            const s = at();
            const h = stage.rub.hit(...toNdc(s.x + offHeadK * s.r, s.y + offYK * s.r));
            const st = stage.rub.stats();
            samples.push({ s: +(((i + 1) / 60).toFixed(2)), laps: st?.n ?? 0, polish: h ? +stage.rub.polishAt(h).toFixed(3) : null, max: st?.max ?? 0 });
          },
          at: (f) => {
            const s = at();
            const tt = f * rubMs / 1000;
            const cx = s.x + offHeadK * s.r;
            const cy = s.y + offYK * s.r;
            const A = ampK * s.r;
            let x = cx;
            let y = cy;
            if (motion === 'rub') { x = cx + A * Math.sin(2 * Math.PI * freq * tt); y = cy + 0.15 * A * Math.sin(2 * Math.PI * freq * 2 * tt); }
            else if (motion === 'circle') { x = cx + A * Math.cos(2 * Math.PI * freq * tt); y = cy + A * Math.sin(2 * Math.PI * freq * tt); }
            else if (motion === 'sweep') { x = cx - 2 * A + 4 * A * Math.min(1, f * 2); }
            hf(x, y, pose);
          },
        });
        if (afterMs > 0) phases.push({ name: 'hand-away', ms: afterMs, at: () => hf(40, innerHeight - 40, 'open') });
        try {
          const r = pumpSync(phases);
          return { head0: s0 && { x: Math.round(s0.x), y: Math.round(s0.y), r: Math.round(s0.r) }, marks: r.marks, rub: rub.debug(), samples };
        } finally {
          restore();
          clearHand();
          rub.handLost();
          if (!hadClass) document.body.classList.remove('gesture-on');
        }
      },
      mouse: async ({ rubMs = 3000, freq = 2.5, ampK = 0.55, offHeadK = 0, motion = 'rub', enter = true, settleMs = 1300 } = {}) => {
        presence.pin(false);
        const restore = patchCapture();
        let base = null;
        const at = () => (base = stage.rub.screen() ?? base ?? { x: innerWidth / 2, y: innerHeight / 2, r: 60 });
        const ID = 7771;
        const fire = (type, x, y, buttons) =>
          stage.canvas.dispatchEvent(new PointerEvent(type, { pointerId: ID, pointerType: 'mouse', isPrimary: true, button: 0, buttons, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, view: window }));
        const up = (x, y) => {
          fire('pointerup', x, y, 0);
          window.dispatchEvent(new PointerEvent('pointerup', { pointerId: ID, pointerType: 'mouse', clientX: x, clientY: y }));
        };
        const phases = [];
        if (enter && !rub.active) phases.push({ name: 'enter', ms: settleMs, enter: () => rub.enter('mouse'), at: () => {} });
        let last = null;
        phases.push({
          name: `press-${motion}`,
          ms: rubMs,
          enter: () => { const s = at(); last = [s.x + offHeadK * s.r, s.y]; fire('pointermove', last[0], last[1], 0); fire('pointerdown', last[0], last[1], 1); },
          at: (f) => {
            const s = at();
            const tt = f * rubMs / 1000;
            const cx = s.x + offHeadK * s.r;
            const A = ampK * s.r;
            let x = cx;
            let y = s.y;
            if (motion === 'rub') x = cx + A * Math.sin(2 * Math.PI * freq * tt);
            else if (motion === 'sweep') x = cx - 2 * A + 4 * A * Math.min(1, f * 2);
            last = [x, y];
            fire('pointermove', x, y, 1);
          },
        });
        phases.push({ name: 'release', ms: 200, enter: () => up(last[0], last[1]), at: () => {} });
        try {
          const r = pumpSync(phases);
          return { marks: r.marks, rub: rub.debug() };
        } finally {
          restore();
        }
      },
    };

    vm.cinemaNavSim = async ({ hoverMs = 700, afterMs = 2600 } = {}) => {
      presence.pin(false);
      const P = stage.devSteleScreenPoint();
      let txSeen = false;
      let txEnd = -1;
      const r = await runSim([
        { name: 'hover', ms: hoverMs, at: () => firePointer('pointermove', P.x, P.y, 0) },
        {
          name: 'navigate-next',
          ms: afterMs,
          enter: () => step(1),
          at: () => {
            if (stage.transitioning) txSeen = true;
            else if (txSeen && txEnd < 0) txEnd = Math.round(performance.now() - S.devLog.t0);
          },
        },
      ]);
      return { stelePx: { x: Math.round(P.x), y: Math.round(P.y) }, txEndMs: txEnd, ...r };
    };
  }
  return {
  };
}
