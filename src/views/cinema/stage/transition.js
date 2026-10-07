// Sân khấu Điện ảnh › chuyển cảnh: present() — đưa bia (bản thật hoặc proxy) lên khay trống, chuyển cảnh Lướt từ khay cũ, camera trôi về khung đích song song.
//
// Khay A/B do engine chuyển cảnh (core/transitions.js) điều khiển; thời lượng theo cài đặt Thời gian lướt (r35).
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): —
// Đọc / ghi S của nơi khác: camTw, txSway, pedestalOn, pedSize, lumaAt, source, everPresented, swayT, swayT0, swayOffset, live, retiring, tx,
//   cur, keepGen, rubOn
import * as THREE from 'three';
import { disposeInstance } from '../../../core/loader.js';
import { getSettings, glideSeconds } from '../../../core/settings.js';
import { createTransition } from '../../../core/transitions.js';
import { createProxyInstance, disposeProxyInstance } from '../proxy.js';
import { hasBVH, requestBVH } from '../bvh.js';

export function installTransition(S, K, deps) {
  const {
    _v, attachMirrorLod, beginCamTween, buildNames, camera, computeFit, computeHome, contact, contactDecals,
    detachMirrorLod, endLodFade, endReveal, goal, heatBand, holder, liftY, lifts, measure, namesRigs, pedestalR0,
    pedestals, planes, readyRelief, reduceMotion, reflector, refreshRelief, requestRender, requestShadow, slotEntry,
    slots, snapHome, steleMetrics, stepProxyWait, swaySpring, syncMirrors, takeInstance, warm
  } = deps;

  function drop(shot) {
    if (!shot) return;
    detachMirrorLod(shot);
    endReveal(shot);
    shot.inst.parent?.remove(shot.inst);
    delete shot.slot.userData.__mats; // engine sẽ thu lại danh sách vật liệu cho bia sau
    if (shot.proxy) disposeProxyInstance(shot.inst);
    else disposeInstance(shot.inst);
    requestShadow();
    reflector.invalidate();
  }
  /**
   * Đưa mô hình mới vào cảnh (root là group dùng chung từ loader — không sửa trực tiếp).
   * Mô hình cũ mờ đi chồng lên lúc mô hình mới dâng lên, nên sân khấu không bao giờ trống.
   * scrubbing (r53): lượt lướt do tay kéo (kéo bia) — chưa báo view:transition (chưa khoá điều hướng) tới khi được nhận
   * (present() của đúng bia đó — xem scrub bên dưới); tiến độ do scrubStep đặt, không tự chạy.
   */
  function presentCore(root3d, dir = 1, entry = null, { proxy = false } = {}, scrubbing = false) {
        // Số đo của bia đang hiển thị giữ lại cho khay của nó: thông tin đang gập / mờ trên tấm bia cũ trong
        // lúc chuyển cảnh vẫn đo theo đúng bia cũ (steleMetrics(pl)).
        if (S.live) planes[S.cur].metrics = steleMetrics();
        S.keepGen++; // hàng xóm cũ hết được giữ trong bộ đệm bản nung sẵn (view nung hàng xóm mới sau khi chuyển xong)
        requestRender('present');
        // Đo trên bản gốc (chưa vào cảnh) để không dính tư thế do hiệu ứng đặt.
        S.source = root3d;
        measure(root3d);
  
        // Dọn nốt lần chuyển cảnh trước: cancel() nhảy tới trạng thái cuối và gọi onDone
        // (huỷ bia cũ), nên sau dòng này chắc chắn chỉ còn MỘT bia trong khay `cur`.
        S.tx?.cancel();
        S.tx = null;
  
        // Rời chế độ xoa đầu rùa (nếu đang ở): camera đi thẳng theo chuyển cảnh; độ bóng bia cũ ghi lại.
        if (S.rubOn) K.setRubMode(false);
        K.saveLiveRub();
        endReveal(S.live); // đang quét hiện dở → xong ngay (bia cũ rời đi nguyên vẹn)
        endLodFade(); // r21: đang mờ bản LOD1 cũ sau khi thay LOD0 → bỏ ngay
        // proxy (r16): bản rút gọn không texture đứng chỗ bia khi bia đầy đủ chưa tải xong — quét hiện sau (upgrade).
        const inst = proxy ? createProxyInstance(root3d) : takeInstance(root3d);
        const contactMap = contact.bake(root3d); // thường đã nướng lúc preheat → chỉ tra cache
        // Chỉ đặt cờ đổ/nhận bóng. transparent/opacity/visible thuộc về engine chuyển cảnh
        // (loader đã để sẵn transparent: true nên preheat biên dịch đúng biến thể sẽ vẽ).
        inst.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.castShadow = true;
          o.receiveShadow = true;
        });
  
        const nextIdx = S.live ? 1 - S.cur : S.cur;
        slotEntry[nextIdx] = entry;
        contactDecals[nextIdx].attach(inst, contactMap); // lắc cùng rùa, nằm ngay trên mặt đỡ
        S.lumaAt = 0; // bia mới → hẹn đo lại sau khi chuyển cảnh xong
        namesRigs?.[nextIdx].clear(); // tên của bia từng ở khay này (hai bia trước) — bỏ
        const inSlot = slots[nextIdx];
        const inPlane = planes[nextIdx];
        delete inSlot.userData.__mats; // ép engine thu lại danh sách vật liệu của khay
        lifts[nextIdx].add(inst); // bia đứng trên bục (lift = chiều cao bục, 0 khi tắt bục)
        // Bục: MỘT cỡ cho mọi bia (R0 × pedestalSize). Chữ nổi dựng lúc rảnh (worker), nhớ theo bia —
        // tới lúc có thì gắn vào dải vát.
        const ped = pedestals[nextIdx];
        ped.setSize(pedestalR0(), S.pedSize);
        syncMirrors();
        lifts[nextIdx].position.y = S.pedestalOn ? ped.lift : 0; // bia đứng ở lòng bục (0,175R0)
        // r19: chữ khắc hiện TRƯỚC bia — đã dựng sẵn (cửa sổ ±1 / bia đã xem) thì có ngay từ khung lướt đầu tiên, không hoạt
        // ảnh; chưa kịp thì dải vát trơn, chữ mọc lên ngay khi bản đồ tới (kể cả giữa lúc lướt). Không phát lại lúc hạ xuống.
        const rr = S.pedestalOn ? readyRelief(entry, nextIdx) : null;
        if (rr) {
          ped.setRelief(rr[0], rr[1]);
          ped.textShow();
          heatBand(ped);
        } else {
          ped.setRelief(null);
          ped.textHide();
          ped.textPlay({ instant: reduceMotion }); // chưa có bản đồ → 'armed': mọc khi tới
          refreshRelief(nextIdx, { urgent: true, fast: reduceMotion }); // r55: hiện tức thì → đẩy GPU dải lớn
        }
  
        S.retiring = S.live;
        S.live = { inst, slot: inSlot, lift: lifts[nextIdx], plane: inPlane, bvh: hasBVH(inst), proxy, lod: proxy ? 2 : root3d.userData.lod ?? 0, root: root3d, reveal: null, wait: proxy ? { t: 0, level: 0, target: -1, hold: null } : null, ...K.rubStateFor(inst, entry?.id ?? root3d.name) };
        if (proxy) stepProxyWait(S.live, 0); // khung đầu: vẻ chờ ở 0 (hiện dần từ đây)
        S.cur = nextIdx;
        if (!proxy) attachMirrorLod(S.live);
        // Cây BVH của bia đang hiển thị: chen đầu hàng đợi (dựng trong worker, lúc rảnh sau khi
        // bia đã lên hình). Tới lúc có cây, hitStele() tự chuyển từ hộp thô sang tia xuyên lưới.
        if (!S.live.bvh) requestBVH(root3d, { urgent: true });
  
        // Bắt đầu TỪ TRẠNG THÁI HIỆN TẠI: góc lắc đang có tắt dần theo tiến độ chuyển cảnh (tick), pha lắc
        // của bia mới bắt đầu ở 0 với biên độ tăng dần — hai khay dùng chung holder nên không có cú giật.
        S.txSway = { from: holder.rotation.y };
        S.swayOffset = holder.rotation.y;
        S.swayT0 = S.swayT;
        swaySpring.y = swaySpring.v = 0; // (góc lò xo đã nằm trong holder.rotation.y → txSway.from)
        // Khung đích của bia mới TRƯỚC khi tạo chuyển cảnh (biên độ lướt cần khoảng cách camera ở khung đích).
        computeHome();
        computeFit();
  
        const outgoing = S.retiring;
        // Biên độ "Lướt" = khoảng rời hẳn khung — tính theo camera XA hơn giữa camera hiện tại (có thể
        // đang zoom sát) và khung đích mà camera sẽ trôi về trong lúc chuyển → bia ra / vào trọn ở cả hai.
        const ampCam = camera.clone();
        const g0 = goal();
        _v.set(0, 0.5 + liftY(), 0);
        if (g0.pos.distanceTo(_v) > camera.position.distanceTo(_v)) ampCam.position.copy(g0.pos);
        const txOpts = {
          outHolder: outgoing ? outgoing.slot : null,
          inHolder: inSlot,
          dir,
          camera: ampCam, // hiệu ứng "Lướt" lấy biên độ rời khung từ camera này
          onDone: () => {
            if (outgoing) drop(outgoing);
            if (S.retiring === outgoing) S.retiring = null;
            requestShadow();
            reflector.invalidate();
            // r20 (hợp đồng với lớp cử chỉ): hết chuyển cảnh — chạy cả khi bị huỷ (bấm tiếp, về khung DEV, rời view)
            window.dispatchEvent(new CustomEvent('view:transition', { detail: { active: false } }));
          },
        };
        // Giảm chuyển động: rút còn tức thời, chạy hết ngay trong khung này.
        // r35: "Lướt" chạy theo cài đặt Thời gian lướt (0,8–2,4 s) — đọc lúc bắt đầu, lượt đang chạy không đổi nhịp giữa chừng;
        // mọi thứ canh theo chuyển cảnh (khoá đổi bia, lớp cử chỉ qua view:transition.ms, camera trôi, bàn giao bóng, tự
        // trình chiếu, nâng LOD / quét hiện chờ whenCalm) đều theo tx.duration / tx.progress, không theo 1,6 s.
        if (reduceMotion) txOpts.duration = 0.001;
        else txOpts.duration = glideSeconds(getSettings());
        S.tx = createTransition('glide', txOpts);
        // r20: lớp cử chỉ giữ lượt điều hướng thứ hai cho tới khi chuyển cảnh này xong (thời lượng thật, không tra bảng)
        if (!scrubbing) window.dispatchEvent(new CustomEvent('view:transition', { detail: { active: true, ms: S.tx.duration * 1000 } }));
        const txDuration = S.tx.duration;
        if (reduceMotion) {
          S.tx.update(1);
          S.tx = null;
        }
  
        requestShadow();
        reflector.invalidate();
  
        buildNames(S.cur); // sau computeHome: cần tỉ lệ px ↔ đơn vị của khung mặc định mới
        // Camera: KHÔNG về khung trước rồi mới chuyển — trôi từ trạng thái hiện tại (xoay / zoom / dời tay)
        // về khung đích SONG SONG với chuyển cảnh, cùng tiến độ + easing; đang ở khung sẵn thì không đổi gì.
        if (!S.everPresented || !S.tx) snapHome();
        else S.camTw = beginCamTween('tx');
        S.everPresented = true;
        return txDuration;
  }

  // ---- r53: KÉO BIA bằng tay (settings.handNavStyle 'drag', app/vdrag.js) ------------------------------------------------
  // Tay (hai ngón) kéo cả bia + bục: đúng lượt "Lướt" tới bia kề (present như thường) nhưng tiến độ do tay đặt — tới / lùi
  // (tx.seek). Nhận (commit): app gọi điều hướng thường (nav select → load → present của ĐÚNG bia + chiều + bản đó) →
  // present() nhận lượt kéo đang dở làm lượt lướt thật: báo view:transition (khoá điều hướng), chạy nốt từ tiến độ hiện tại.
  // Nhả / huỷ: lò xo về 0 rồi trả sân khấu về đúng như trước (bia cũ ở lại, bản sao bia kề trả lại bộ đệm nung sẵn). Không
  // đổi trạng thái app (chỉ số bia, địa chỉ, HUD) trước khi nhận.
  //
  // r56 (người dùng: "bia trôi nhanh hơn tốc độ tay. cho bằng đi, và tính cách mượt hơn, bây giờ giật quá"):
  //   · 1:1 THEO MÀN HÌNH: tay dời s (phần bề ngang) → bia (điểm giữa khung — tâm bia) dời ĐÚNG s trên màn hình. Bảng s(k)
  //     dựng lúc bắt đầu: chiếu tâm bia ở phần quãng k của Lướt (khay dời −amp·dir·k theo trục khay) qua camera thật → nghịch
  //     bảng mỗi khung (k → tiến độ qua nghịch easing). Trước: tuyến tính theo tay với DX_FULL 0,34 W → bia đi ~1,8 × tay.
  //   · MƯỢT: mẫu tay 30 / s, khung vẽ 60–120 / s → bám theo NHỊP KHUNG VẼ: đích = mẫu cuối + v × tuổi mẫu (≤ ~1 nhịp mẫu),
  //     bộ bám tắt dần tới hạn (TUNE.w) có vận tốc tay nạp thẳng (feed-forward; v tự đo từ hai mẫu liền nhau) — không bậc
  //     thang, không trễ cố định ở tốc độ đều. Trước: lọc mũ τ 35 ms trên đích bậc thang 30 Hz (bước mỗi khung lệch 10 × giữa khung có / không có mẫu).
  //   · NHẬN: giữ đúng vận tốc bia lúc nhận (= tay), rồi Hermite bậc ba theo phần quãng k tới đích (vận tốc cuối 0) — không
  //     vọt / khựng vận tốc lúc nhận. Nhả: lò xo tắt dần tới hạn theo quãng màn hình về 0.
  /** @type {null|object} */
  let scrub = null;
  let lastTable = null;
  const easeInv = (u) => (u < 0.5 ? Math.cbrt(u / 4) : 1 - Math.cbrt(2 * (1 - u)) / 2); // nghịch easeInOutCubic
  /**
   * Bộ bám (DEV chỉnh được: __vm.cinemaScrubTune): w — ω bộ bám tới hạn (/s); predict — ngoại suy mẫu tay tối đa (ms, ~một
   * nhịp mẫu 33 ms); ff — hệ số vận tốc nạp thẳng (1 = đủ: tốc độ đều không trễ; < 1 bớt vọt quá lúc tay dừng).
   */
  // r57: chọn theo đo (tests/cinema/vdrag.test.mjs I): run σ 0,3–0,5 % W khi giữ yên → bia rung 0,1–0,5 px RMS (r56: 3,2–6,6
  // px); kéo thường (TB 0,23 W/s) trễ ~52–56 ms (r56: 56); kéo chậm (TB 0,09 W/s) ~52 ms; đổi chiều liên tục (kịch bản A) trễ
  // ~90 ms (r56 ~48 — cái giá của lọc nặng quanh chỗ tay dừng, người dùng chấp nhận "tăng độ trễ để đỡ jiggle").
  // Bộ bám nhanh hơn r56 (w 22 → 28, ff 0,8 → 0,9, predict 24 → 30 ms) vì mẫu tay đã được lọc trước.
  const TUNE = { w: 28, predict: 30, ff: 0.9, vtau: 25, fcmin: 0.22, beta: 150, win: 320, vth: 0.045, band: 0 };
  /**
   * r57 (người dùng: "khi grab thì tuy vẫn di chuyển theo tay nhưng có thể cần tăng độ trễ để đỡ bị jiggle tại chỗ"): lọc One
   * Euro trên MẪU TAY (trước bộ bám nhịp khung) — cắt tần theo tốc độ tay: fc = fcmin + beta · max(0, |v| − vth) (Hz; v: vận tốc
   * tay = quãng DỜI RÒNG trong cửa sổ win ms / win, bề ngang / s — run tay dao động quanh một chỗ nên dời ròng nhỏ, kéo chậm
   * có chủ ý (~0,1 W/s) thì dời ròng đều — phân biệt tốt hơn đạo hàm đã lọc). Tay gần đứng yên (run ±0,3–0,5 % W) → fc ≈ fcmin: lọc nặng, bia đứng; tay đi có chủ
   * ý → fc lớn: gần như không trễ thêm. Liên tục theo tốc độ — không có bậc khi rời vùng đứng yên. Vận tốc nạp thẳng cho bộ
   * bám lấy từ đầu ra ĐÃ LỌC (run tay không còn đẩy bia). band (phần bề ngang): vùng chết mềm sau bộ lọc — đầu ra chỉ dời khi
   * lệch khỏi nó quá band (đi theo, trễ đúng band; không có bậc).
   */
  const oeAlpha = (dt, fc) => 1 / (1 + 1 / (2 * Math.PI * Math.max(1e-3, fc) * dt));
  const RETURN_W = 13; // /s — lò xo nhả (tới hạn): ~0,45 s về chỗ
  const TABLE_N = 64;
  const scrubOwns = () => !!scrub && scrub.tx === S.tx && !!S.tx;
  const _pt = new THREE.Vector3();
  const _dw = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  /**
   * Bảng quãng MÀN HÌNH (phần bề ngang, dương theo chiều bia đi) của tâm bia theo phần quãng k ∈ [0, 1] của Lướt, với camera
   * lúc này. Đơn điệu tăng (ép).
   */
  function buildScreenTable(amp, dir) {
    const c = goal().target;
    holder.getWorldQuaternion(_q);
    _dw.set(-amp * dir, 0, 0).applyQuaternion(_q);
    camera.updateMatrixWorld();
    const k = new Float32Array(TABLE_N + 1);
    const sx = new Float32Array(TABLE_N + 1);
    for (let i = 0; i <= TABLE_N; i++) {
      k[i] = i / TABLE_N;
      _pt.copy(c).addScaledVector(_dw, k[i]).project(camera);
      sx[i] = (_pt.x + 1) / 2;
    }
    const sgn = sx[TABLE_N] >= sx[0] ? 1 : -1;
    const s = new Float32Array(TABLE_N + 1);
    for (let i = 1; i <= TABLE_N; i++) s[i] = Math.max(s[i - 1] + 1e-5, sgn * (sx[i] - sx[0]));
    return { k, s, sgn, sMax: s[TABLE_N] };
  }
  /** Nghịch bảng: quãng màn hình s → phần quãng k (nội suy tuyến tính). */
  function kOfS(tb, sv) {
    if (sv <= 0) return 0;
    if (sv >= tb.sMax) return 1;
    let lo = 0;
    let hi = TABLE_N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tb.s[m] <= sv) lo = m;
      else hi = m;
    }
    return tb.k[lo] + ((sv - tb.s[lo]) / Math.max(1e-9, tb.s[hi] - tb.s[lo])) * (tb.k[hi] - tb.k[lo]);
  }
  /** dk/ds ở quãng s (độ dốc bảng). */
  function slopeKS(tb, sv) {
    const d = 0.004;
    return (kOfS(tb, sv + d) - kOfS(tb, Math.max(0, sv - d))) / (sv + d - Math.max(0, sv - d));
  }
  function scrubBegin(root3d, dir, entry, { proxy = false } = {}) {
    if (scrub || S.tx || reduceMotion || !root3d || !S.live) return false;
    const prev = { cur: S.cur, source: S.source, keepGen: S.keepGen, entryIn: slotEntry[1 - S.cur] };
    presentCore(root3d, dir, entry, { proxy }, true);
    if (!S.tx) return false;
    const table = buildScreenTable(S.tx.amp ?? 1.6, dir);
    lastTable = table;
    scrub = { tx: S.tx, dir, entry, root: root3d, proxy: !!proxy, mode: 'drag', k: 0, p: 0, s: 0, v: 0, tgt: { s: 0, v: 0, at: performance.now(), n: 0 }, oe: { n: 0, x: 0, y: 0, raw: 0, dx: 0, v: 0, t: 0, fc: 0 }, table, prev, c: null };
    return true;
  }
  /** Trả sân khấu về đúng như trước lượt kéo (tiến độ ≈ 0): bia cũ lại là bia đang hiện, bản sao bia kề trả bộ đệm. */
  function revertScrub() {
    const sc = scrub;
    scrub = null;
    if (!sc || S.tx !== sc.tx) return;
    const shot = S.live;
    S.tx = null; // KHÔNG finish() — onDone sẽ huỷ bia cũ
    S.live = S.retiring;
    S.retiring = null;
    S.cur = sc.prev.cur;
    slotEntry[1 - S.cur] = sc.prev.entryIn;
    if (shot) {
      detachMirrorLod(shot);
      endReveal(shot);
      shot.inst.parent?.remove(shot.inst);
      delete shot.slot.userData.__mats;
      shot.slot.visible = false;
      if (shot.proxy) disposeProxyInstance(shot.inst);
      else if (warm && !warm.has(sc.root)) warm.set(sc.root, { inst: shot.inst, busy: 0, gen: sc.prev.keepGen, done: true });
      else disposeInstance(shot.inst);
    }
    // bia cũ: đủ đục, về gốc, đổ bóng (engine đã đặt đúng ở tiến độ 0 — đặt lại cho chắc)
    if (S.live) {
      const g = S.live.slot;
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      g.userData.__opacity = 1;
      g.visible = true;
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
    }
    S.keepGen = sc.prev.keepGen;
    S.source = sc.prev.source;
    if (S.source) measure(S.source);
    S.txSway = null;
    if (S.camTw?.kind === 'tx') S.camTw = null;
    computeHome();
    computeFit();
    buildNames(S.cur);
    requestShadow();
    reflector.invalidate();
    requestRender('scrub');
  }
  function seekK(sc, k) {
    sc.k = Math.min(1, Math.max(0, k));
    sc.p = easeInv(sc.k);
    return S.tx.seek(sc.p);
  }
  /** Một khung của lượt kéo (tick, thay tx.update): trả true khi còn chạy; false khi đã xong (nhận: tới đích · huỷ: đã trả). */
  function scrubStep(dt) {
    const sc = scrub;
    const n = Math.max(1, Math.ceil(dt * 240)); // bước con 240 Hz — ổn định ở mọi nhịp khung
    const h = dt / n;
    if (sc.mode === 'drag') {
      const now = performance.now();
      const T = sc.tgt;
      const P = TUNE.predict / 1000;
      const age0 = Math.min(P, Math.max(0, now - T.at - dt * 1000) / 1000);
      const w = TUNE.w;
      const vf = T.v * TUNE.ff;
      for (let i = 1; i <= n; i++) {
        const age = Math.min(P, age0 + i * h);
        const goalS = T.s + vf * age;
        sc.v += (w * w * (goalS - sc.s) + 2 * w * (vf - sc.v)) * h;
        sc.s += sc.v * h;
      }
      const cap = sc.table.sMax * 0.98;
      if (sc.s < 0) {
        sc.s = 0;
        if (sc.v < 0) sc.v = 0;
      } else if (sc.s > cap) sc.s = cap;
      seekK(sc, kOfS(sc.table, sc.s));
      return true;
    }
    if (sc.mode === 'commit') {
      // Hermite bậc ba theo phần quãng k: bắt đầu đúng (k0, vận tốc k lúc nhận), tới 1 với vận tốc 0
      const C = sc.c;
      C.t += dt;
      const u = Math.min(1, C.t / C.T);
      const m = C.m;
      const hv = m * u + (3 - 2 * m) * u * u + (m - 2) * u * u * u;
      if (u >= 1) {
        scrub = null;
        sc.k = 1;
        return S.tx.seek(1); // false: xong (onDone: bỏ bia cũ, view:transition active false)
      }
      return seekK(sc, C.k0 + C.D * hv);
    }
    // 'cancel': lò xo tắt dần tới hạn theo quãng màn hình về 0, bắt đầu từ vận tốc đang có
    const w = RETURN_W;
    for (let i = 0; i < n; i++) {
      sc.v += (-w * w * sc.s - 2 * w * sc.v) * h;
      sc.s += sc.v * h;
    }
    if (sc.s <= 0.0004 && Math.abs(sc.v) < 0.01) {
      S.tx.seek(0);
      revertScrub();
      return false;
    }
    seekK(sc, kOfS(sc.table, Math.max(0, sc.s)));
    return true;
  }
  /** Bắt đầu đoạn chạy nốt (nhận): vận tốc màn hình v0 (phần bề ngang / s) → vận tốc k, Hermite tới k = 1. */
  function startCommit(sc, v0) {
    const k0 = sc.k;
    const D = Math.max(1e-4, 1 - k0);
    const kv0 = Math.max(0, v0) * slopeKS(sc.table, sc.s);
    const nat = S.tx.duration; // thời lượng lướt thường (cài đặt Thời gian lướt)
    // thời lượng: 1,5·D / vận tốc (đoạn giảm tốc đều từ đúng vận tốc tay) — kẹp trong [0,3 s, D × thời lượng lướt]
    const T = Math.min(Math.max(0.3, D * nat), Math.max(0.3, (1.5 * D) / Math.max(1e-3, kv0)));
    const m = Math.min(3, (kv0 * T) / D); // độ dốc chuẩn hoá ở đầu (≤ 3: không vượt đích)
    sc.c = { t: 0, T, D, k0, m, v0: +v0.toFixed(3) };
    sc.mode = 'commit';
  }

  return {
    drop,
    scrubOwns,
    scrubStep,
    api: {
      present(root3d, dir = 1, entry = null, opts = {}) {
        // r53: đúng bia + chiều + bản của lượt kéo đang dở → nhận làm lượt lướt thật (chạy nốt từ tiến độ hiện tại)
        if (scrub && scrubOwns()) {
          if (scrub.mode !== 'cancel' && scrub.entry?.id === entry?.id && scrub.dir === dir && scrub.root === root3d && scrub.proxy === !!opts.proxy) {
            if (scrub.mode === 'drag') startCommit(scrub, scrub.v); // app chưa gọi scrubCommit: giữ vận tốc đang có
            const left = scrub.c ? scrub.c.T : S.tx.duration * (1 - scrub.p);
            window.dispatchEvent(new CustomEvent('view:transition', { detail: { active: true, ms: left * 1000, scrub: true } }));
            return left;
          }
          // bia / bản khác (bấm phím, dòng thời gian, bản tốt hơn vừa nung xong giữa lúc kéo…): bỏ lượt kéo, lướt như thường
          revertScrub();
        } else if (scrub) scrub = null;
        return presentCore(root3d, dir, entry, opts);
      },
      /** r53: bắt đầu kéo tới bia kề (dir +1 = bia sau, vào từ phải). root / proxy: bản sẽ hiện (như load() chọn). */
      scrubBegin,
      /**
       * r56: mẫu tay — s = quãng tay theo chiều kéo (phần bề ngang màn hình, 0 = điểm bắt đầu kéo, có thể âm khi lùi),
       * v = vận tốc tay theo chiều kéo (phần bề ngang / s). Bia bám 1:1 trên màn hình ở nhịp khung vẽ (scrubStep).
       */
      scrubHand(sv, vv = 0) {
        if (!scrub || scrub.mode !== 'drag') return;
        const now = performance.now();
        const s1 = Number(sv) || 0;
        const O = scrub.oe;
        if (!O.n) {
          // mẫu đầu (tay vừa ra khỏi vùng chết — đang đi có chủ ý): vận tốc của lớp cử chỉ làm vận tốc ban đầu → cắt tần cao ngay
          Object.assign(O, { n: 1, x: s1, y: s1, raw: s1, dx: Number(vv) || 0, v: Number(vv) || 0, t: now, fc: 0, hist: [{ t: now, s: s1 }], vw: Math.abs(Number(vv) || 0) });
        } else {
          const dt = Math.min(0.12, Math.max(0.005, (now - O.t) / 1000));
          // tốc độ dời ròng trong cửa sổ win ms (mẫu cũ nhất còn trong cửa sổ; cửa sổ chưa đầy → dùng mẫu đầu)
          O.hist.push({ t: now, s: s1 });
          while (O.hist.length > 2 && now - O.hist[1].t >= TUNE.win) O.hist.shift();
          const h0 = O.hist[0];
          const vw = now - h0.t > 1 ? Math.abs(s1 - h0.s) / ((now - h0.t) / 1000) : O.vw;
          O.vw += (vw - O.vw) * (1 - Math.exp(-(dt * 1000) / 40));
          O.dx = O.vw;
          O.fc = TUNE.fcmin + TUNE.beta * Math.max(0, O.vw - TUNE.vth);
          O.x += (s1 - O.x) * oeAlpha(dt, O.fc);
          // vùng chết mềm: đầu ra y chỉ đi khi lệch khỏi đầu ra lọc quá band
          const y0 = O.y;
          const d = O.x - O.y;
          if (d > TUNE.band) O.y = O.x - TUNE.band;
          else if (d < -TUNE.band) O.y = O.x + TUNE.band;
          // vận tốc đầu ra (nạp thẳng cho bộ bám), làm mượt nhẹ (vtau ms)
          O.v += ((O.y - y0) / dt - O.v) * (1 - Math.exp(-(dt * 1000) / TUNE.vtau));
          O.raw = s1;
          O.t = now;
          O.n++;
        }
        scrub.tgt = { s: O.y, v: O.v, at: now, n: O.n };
      },
      /** r53 → r56: nhận (app gọi điều hướng ngay sau). v: vận tốc tay lúc thả (hất) — lấy lớn hơn vận tốc bia đang có. */
      scrubCommit(v = null) {
        if (!scrub || scrub.mode === 'cancel') return false;
        if (scrub.mode === 'drag') startCommit(scrub, Math.max(scrub.v, Number.isFinite(v) ? v : 0));
        return true;
      },
      /** r53 → r56: nhả / huỷ → lò xo về 0 (theo quãng màn hình) rồi trả sân khấu như trước. */
      scrubCancel() {
        if (!scrub || scrub.mode !== 'drag') return false;
        scrub.mode = 'cancel';
        scrub.v = Math.min(0, scrub.v); // đang đi tới mà nhả: không vọt thêm — lò xo từ đứng yên
        return true;
      },
      /** r53: bỏ ngay lượt kéo (đổi chiều gần điểm đầu): trả sân khấu như trước, không lò xo. */
      scrubAbort() {
        if (!scrub || !scrubOwns() || scrub.mode === 'commit') return false;
        S.tx.seek(0);
        revertScrub();
        return true;
      },
      /** r53: lượt kéo đang có ('drag' | 'commit' | 'cancel' | null) + tiến độ (DEV / kiểm thử). */
      get scrub() {
        return scrub && scrubOwns()
          ? { mode: scrub.mode, p: +scrub.p.toFixed(4), k: +scrub.k.toFixed(4), s: +scrub.s.toFixed(4), v: +scrub.v.toFixed(3), hs: +scrub.oe.x.toFixed(4), fc: +scrub.oe.fc.toFixed(2), dir: scrub.dir, id: scrub.entry?.id ?? null, commit: scrub.c ? { T: +scrub.c.T.toFixed(3), m: +scrub.c.m.toFixed(3), v0: scrub.c.v0 } : null }
          : null;
      },
      /** r56 DEV: chỉnh bộ bám ({ w, predict, ff, vtau }) — trả giá trị đang dùng. */
      scrubTune(o = {}) {
        if (import.meta.env.DEV) for (const k of Object.keys(TUNE)) if (Number.isFinite(o[k])) TUNE[k] = o[k];
        return { ...TUNE };
      },
      /** r56 DEV / kiểm thử: bảng quãng màn hình của lượt kéo gần nhất ({ k[], s[] } — phần bề ngang theo phần quãng k). */
      get scrubTable() {
        return lastTable ? { k: [...lastTable.k], s: [...lastTable.s].map((v) => +v.toFixed(5)), sMax: +lastTable.sMax.toFixed(4) } : null;
      },
    },
  };
}
