// Sân khấu Điện ảnh › móc DEV (window.__vm.cinema*) — chỉ bản dev.
//
// Đo đạc, chụp giữa chặng, ép trạng thái cho kiểm thử (tests/cinema).
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): —
// Đọc / ghi S của nơi khác: keyDist, contrast, lightU, lightE, spotLevel, castK, catchMat, holdFreeze, hoverZoom, zoomEff, zoomGuard, camTw,
//   pedestalOn, pedSize, pedText, pedSep, pedLook, pedSettleAt, renderOnDemand, catcher, devDish, devMirrorMode,
//   devContactOff, mirrorScaleNow, mirrorScalePin, selTarget, namesStyle, lumaAt, distRelax, source, userMoved, homing,
//   lastInteract, devTrace, devCamTrace, swayT, swayT0, swayRamp, swayOffset, devPerStele, live, retiring, tx, cur,
//   mirrorLod, proxyLook, bgBusy, reliefWin, rubEnabled, fitMix, rubOn, rubGoalOk, devLatchOff, devRayMode,
//   devNamesLegacy, devInfoLegacy
import * as THREE from 'three';
import { residentRoots } from '../../../core/loader.js';
import { DEFAULTS, getSettings, setSetting } from '../../../core/settings.js';
import { txDebug } from '../../../core/transitions.js';
import { neverCastShadow } from '../hotspot.js';
import { DISH_COLOR, DISH_ENV, DISH_MAT_DEFAULTS, DISH_SPEC_CAP, PEDESTAL, PEDESTAL_DEFAULTS } from '../pedestal.js';
import { CACHE_MAX as RELIEF_CACHE_MAX, ringText } from '../relief.js';
import { bvhStats, hasBVH, measureSyncBuild, measureWorkerBuild } from '../bvh.js';
import { REGION_HEAD_K, REGION_NECK_K, ensurePolishNormals, regionBounds } from '../polish.js';
import {
  IDLE, IDLE_DEFAULTS, IDLE_SPOT, IDLE_SPOT_DEFAULTS, LUMA_INK, PROFILE_BINS, SPILL, SPILL_DEFAULTS, SWAY_A,
  SWAY_PERIOD, clampNum, headOf
} from './config.js';

export function installStageDev(S, K, deps) {
  const {
    TEX_KEYS, _corner, _dp, _pts, _v, applyDistLimits, applyIdleLighting, bounds, camera, cineKey, computeFit,
    computeHome, contact, contactDecals, controls, devHoldTx, devHome, devMute, devReleaseTx, devRender, devRestore,
    devSel, fieldLuma, footMax, goal, headWorld, holder, home, homeBand, homeNdc, idleSpot, inkFor, keyCfg, killInertia,
    latchRect, lifts, lights, markInteraction, measureFieldLumaSync, mirrors, orbit, pedStats, pedestalR0, pedestals,
    placeIdleSpot, polishNormalStats, pool, preheatStats, rayStats, reflector, refreshRelief, reliefGpu, renderer,
    requestRender, requestShadow, rubGoal, rubScreen, rubZoomK, scene, selNow, selU, setRubMode, slotEntry, slots,
    snapHome, spill, steleNdc, stripTex, swaySpring, syncContact, syncMirrorScale, syncMirrors, syncSpot, tick, view,
    zoomCap, zoomLift, zoomLimit
  } = deps;
  if (import.meta.env.DEV) {
    const vm = (window.__vm ??= { renderers: new Set() });
    vm.cinemaHome = devHome;
    vm.cinemaHoldTx = devHoldTx;
    /** r22: ghép ảnh khay đang mờ (true, mặc định) / vẽ thẳng (false) — so sánh hai đường vẽ ở cùng một khung. */
    vm.cinemaTxComposite = (on = true, opacity = null) => {
      txDebug.composite = !!on;
      txDebug.opacity = opacity;
      requestRender('dev');
      return txDebug.composite;
    };
    vm.cinemaReleaseTx = devReleaseTx;
    vm.cinemaTxProgress = () => (S.tx ? S.tx.progress : -1);
    /** DEV (r35): camera thật so với khung đích hiện tại (goal) + các cờ lái camera — kiểm "về đúng khung" sau khi xoa. */
    vm.cinemaCam = () => {
      const g = goal();
      const r3 = (v) => v.toArray().map((x) => +x.toFixed(4));
      return { pos: r3(camera.position), target: r3(controls.target), fov: camera.fov, goalPos: r3(g.pos), goalTarget: r3(g.target), off: +camera.position.distanceTo(g.pos).toFixed(4), offT: +controls.target.distanceTo(g.target).toFixed(4), dist: +camera.position.distanceTo(controls.target).toFixed(4), homeDist: +home.dist.toFixed(4), camTw: S.camTw?.kind ?? null, camTwT: S.camTw ? +S.camTw.t.toFixed(3) : null, userMoved: S.userMoved, homing: S.homing, frozen: S.holdFreeze, rubOn: S.rubOn, sel: S.selTarget, fitMix: +S.fitMix.toFixed(3), orbitF: +orbit.f.toFixed(3), idleS: +((performance.now() - S.lastInteract) / 1000).toFixed(2), minDist: +controls.minDistance.toFixed(4) };
    };
    /** Chi phí bắn tia từ lần reset gần nhất; reset=true để xoá sau khi đọc. */
    vm.cinemaRayStats = (reset = false) => {
      const r = { ...rayStats, avg: rayStats.n ? rayStats.ms / rayStats.n : 0, swayDeg: +THREE.MathUtils.radToDeg(holder.rotation.y).toFixed(2) };
      if (reset) Object.assign(rayStats, { n: 0, ms: 0, max: 0, box: 0 });
      return r;
    };
    /** "Đang chọn": tiến độ + cường độ đèn + kích thước bục hiện tại. */
    vm.cinemaSelect = () => ({
      target: S.selTarget,
      u: +selU[S.cur].toFixed(3),
      amount: +selNow[S.cur].toFixed(3),
      slots: selU.map((v) => +v.toFixed(3)),
      hoverZoom: { setting: S.hoverZoom, effective: +zoomLimit().toFixed(4), by: zoomCap(S.hoverZoom).by, cap25: zoomCap(0.25), ndc: { x: +homeNdc.x.toFixed(3), y: +homeNdc.y.toFixed(3) }, stele: { top: +steleNdc.top.toFixed(3), bot: +steleNdc.bot.toFixed(3), x: +steleNdc.x.toFixed(3) }, band: { top: +homeBand.top.toFixed(3), bot: +homeBand.bot.toFixed(3) }, liftNow: +zoomLift(S.zoomEff * orbit.f).toFixed(4), f: +orbit.f.toFixed(3), steleNow: (() => {
        // r27z DEV: biên NDC của tấm bia / bục với camera THẬT lúc này (kiểm "bia còn trong khung" khi zoom)
        let t = -Infinity, b = Infinity, pb = Infinity;
        for (let i = 0; i < _pts.length; i++) {
          _corner.copy(_pts[i]).project(camera);
          if (i % 4 < 2) { t = Math.max(t, _corner.y); b = Math.min(b, _corner.y); } else pb = Math.min(pb, _corner.y);
        }
        return { top: +t.toFixed(3), bot: +b.toFixed(3), pedBot: +pb.toFixed(3) };
      })(), guard: S.zoomGuard?.() ?? null },
      rim: +lights.rim.intensity.toFixed(3),
      light: {
        e: +S.lightE.toFixed(3),
        u: +S.lightU.toFixed(3),
        contrast: S.contrast,
        key: +cineKey.intensity.toFixed(3),
        keyLight: { ...keyCfg, dist: +S.keyDist.toFixed(3), pos: cineKey.position.toArray().map((v) => +v.toFixed(3)), color: '#' + cineKey.color.getHexString() },
        fill: +lights.fill.intensity.toFixed(3),
        hemi: +lights.hemi.intensity.toFixed(3),
        env: +(scene.environmentIntensity ?? 0).toFixed(3),
        spot: +idleSpot.intensity.toFixed(3),
        spill: +spill.intensity.toFixed(3),
      },
      spot: {
        az: IDLE_SPOT.az,
        el: IDLE_SPOT.el,
        angle: IDLE_SPOT.angle,
        penumbra: IDLE_SPOT.penumbra,
        level: S.spotLevel,
        color: '#' + idleSpot.color.getHexString(),
        pos: idleSpot.position.toArray().map((v) => +v.toFixed(3)),
        target: idleSpot.target.position.toArray().map((v) => +v.toFixed(3)),
        castShadow: idleSpot.castShadow,
        keyCastShadow: lights.key.castShadow,
        shadowIntensity: idleSpot.shadow.intensity,
        shadowRadius: +idleSpot.shadow.radius.toFixed(2),
        shadowFov: +idleSpot.shadow.camera.fov.toFixed(2),
        cast: S.castK,
        catchOpacity: +S.catchMat.opacity.toFixed(3),
        catcherVisible: S.catcher.visible,
      },
      pedestal: S.pedestalOn && {
        R0: +pedestals[S.cur].R0.toFixed(4),
        R: +pedestals[S.cur].R.toFixed(4),
        H: +pedestals[S.cur].H.toFixed(4),
        swept: bounds.foot && +bounds.foot.swept.toFixed(4),
        base: bounds.foot && +bounds.foot.base.toFixed(4),
        dishR: +pedestals[S.cur].dishR.toFixed(4),
        lift: +pedestals[S.cur].lift.toFixed(4),
      },
    });
    /**
     * DEV: số draw call mỗi khung (trung bình), đo bằng renderer.info với autoReset tắt để cộng cả
     * lượt gương + bóng. sway = true: ép bia đang lắc (như lúc rảnh tay).
     */
    vm.cinemaDrawCalls = ({ frames = 60, sway = false, mirror = false } = {}) => {
      view.stop();
      const info = renderer.info;
      const auto = info.autoReset;
      info.autoReset = false;
      if (sway) S.lastInteract = performance.now() - 20000;
      else S.lastInteract = performance.now();
      for (let i = 0; i < 120; i++) tick(1 / 60); // cho lắc kịp tăng tốc / dừng hẳn
      let calls = 0;
      let tris = 0;
      const per = [];
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      // readPixels 1 điểm ảnh buộc chờ GPU vẽ xong (gl.finish không chặn trên Chrome) → thời gian gồm GPU
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sync();
      const t0 = performance.now();
      const ft = [];
      for (let i = 0; i < frames; i++) {
        info.reset();
        const tf = performance.now();
        if (mirror) reflector.invalidate(); // ép lượt gương mỗi khung: đo riêng chi phí của nó
        tick(1 / 60);
        sync();
        ft.push(performance.now() - tf);
        per.push(info.render.calls);
        calls += info.render.calls;
        tris += info.render.triangles;
      }
      const ms = (performance.now() - t0) / frames;
      ft.sort((a, b) => a - b);
      const pct = (f) => +ft[Math.min(ft.length - 1, Math.floor(f * (ft.length - 1)))].toFixed(2);
      info.autoReset = auto;
      view.start(K.frameTick);
      return { calls: +(calls / frames).toFixed(1), min: Math.min(...per), max: Math.max(...per), triangles: Math.round(tris / frames), msPerFrame: +ms.toFixed(2), msP50: pct(0.5), msP95: pct(0.95), msMax: +ft[ft.length - 1].toFixed(2), sway: +THREE.MathUtils.radToDeg(holder.rotation.y).toFixed(1) };
    };
    /**
     * DEV: độ chói TƯƠNG ĐỐI của đỉnh mai rùa trên khung vừa vẽ. Bắn tia thẳng xuống ở hai điểm
     * trước phiến bia (trái/phải đầu rùa) → chiếu ra màn hình → đọc cửa sổ 14×8 px mỗi điểm.
     * off: { strips, spill } = true để tắt riêng nguồn đó. hover: trạng thái "đang chọn".
     */
    vm.cinemaShellProbe = ({ hover = false, off = {}, crop = null, az = 0 } = {}) => {
      if (!S.live) return null;
      Object.assign(devSel, { strips: 1, spill: 1 });
      for (const k of Object.keys(off)) devSel[k] = off[k] ? 0 : 1;
      view.stop();
      S.selTarget = !!hover;
      S.lastInteract = performance.now(); // không lắc
      holder.rotation.y = 0;
      S.swayT0 = S.swayT; // pha lắc = 0 → bia chính diện (không thì tick đặt lại góc lắc đang đóng băng)
      S.swayOffset = 0;
      S.swayRamp = 0;
      swaySpring.y = swaySpring.v = 0;
      for (let i = 0; i < 60; i++) tick(1 / 60);
      snapHome();
      if (az) devHome({ az });
      const zs = bounds.zFront + 0.07;
      const W = renderer.domElement.width;
      const H = renderer.domElement.height;
      const rc = new THREE.Raycaster();
      const pts = [];
      S.live.lift.updateWorldMatrix(true, false);
      for (const xs of [-0.17, 0.17]) {
        const o = new THREE.Vector3(xs, 3, zs).applyMatrix4(S.live.lift.matrixWorld);
        rc.set(o, new THREE.Vector3(0, -1, 0));
        const hit = rc.intersectObject(S.live.inst, true)[0];
        if (hit) pts.push(hit.point.clone());
      }
      tick(1 / 60);
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const lin = (c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const read = (p, w, h) => {
        const v = p.clone().project(camera);
        const x = Math.round(((v.x + 1) / 2) * W - w / 2);
        const y = Math.round(((v.y + 1) / 2) * H - h / 2);
        const buf = new Uint8Array(w * h * 4);
        gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 4) sum += 0.2126 * lin(buf[i]) + 0.7152 * lin(buf[i + 1]) + 0.0722 * lin(buf[i + 2]);
        return sum / (w * h);
      };
      const shell = pts.length ? pts.reduce((s, p) => s + read(p, 14, 8), 0) / pts.length : null;
      // mặt trước phiến bia (giữa thân) — hiệu ứng "đang chọn" không được làm "phẳng" mặt trước
      const face = read(new THREE.Vector3((bounds.slabL + bounds.slabR) / 2, bounds.yMin + 0.55 * (bounds.yMax - bounds.yMin), bounds.zFront).applyMatrix4(S.live.lift.matrixWorld), 24, 24);
      // mặt bên phiến (phía camera khi az ≠ 0) và đỉnh vòm
      const zMid = (bounds.zFront + bounds.zBack) / 2;
      const sideX = az > 0 ? bounds.slabR : bounds.slabL;
      const side = az ? read(new THREE.Vector3(sideX, bounds.yMin + 0.55 * (bounds.yMax - bounds.yMin), zMid).applyMatrix4(S.live.lift.matrixWorld), 4, 16) : null;
      const crest = read(new THREE.Vector3((bounds.slabL + bounds.slabR) / 2, bounds.yMax - 0.004, zMid).applyMatrix4(S.live.lift.matrixWorld), 16, 4);
      let cropUrl = null;
      if (crop && pts.length) {
        const c = pts[0].clone().add(pts[1] ?? pts[0]).multiplyScalar(0.5).project(camera);
        const cw = 360;
        const ch = 200;
        const x = Math.round(((c.x + 1) / 2) * W - cw / 2);
        const y = Math.round(((c.y + 1) / 2) * H - ch * 0.4);
        const buf = new Uint8Array(cw * ch * 4);
        gl.readPixels(x, y, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const cv = document.createElement('canvas');
        cv.width = cw;
        cv.height = ch;
        const g2 = cv.getContext('2d');
        const img = g2.createImageData(cw, ch);
        for (let row = 0; row < ch; row++) img.data.set(buf.subarray((ch - 1 - row) * cw * 4, (ch - row) * cw * 4), row * cw * 4);
        g2.putImageData(img, 0, 0);
        cropUrl = cv.toDataURL('image/png');
      }
      Object.assign(devSel, { strips: 1, spill: 1 });
      view.start(K.frameTick);
      if (az) devHome();
      return { shell: shell == null ? null : +shell.toFixed(4), face: +face.toFixed(4), side: side == null ? null : +side.toFixed(4), crest: +crest.toFixed(4), hits: pts.length, cropUrl };
    };
    /**
     * DEV: độ chói TƯƠNG ĐỐI của lòng bục (vành ngoài, chỗ không bị rùa che) trên khung vừa vẽ, cho
     * từng bục đang hiện: 24 điểm quanh r = 0,93·bán kính lòng bục, mỗi điểm cửa sổ 3×3 px.
     * Không đổi tư thế camera / chuyển cảnh — gọi sau khi đặt sẵn tư thế cần đo.
     */
    vm.cinemaDishProbe = () => {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const W = renderer.domElement.width;
      const H = renderer.domElement.height;
      const lin = (c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const buf = new Uint8Array(9 * 4);
      const out = [];
      for (let i = 0; i < 2; i++) {
        const pd = pedestals[i];
        if (!slots[i].visible || !pd.group.visible) continue;
        pd.group.updateWorldMatrix(true, false);
        const vals = [];
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          const r = pd.dishR * 0.93;
          _v.set(Math.cos(a) * r, pd.lift + 0.002, Math.sin(a) * r).applyMatrix4(pd.group.matrixWorld).project(camera);
          if (_v.z > 1 || Math.abs(_v.x) > 0.98 || Math.abs(_v.y) > 0.98) continue;
          const x = Math.round(((_v.x + 1) / 2) * W) - 1;
          const y = Math.round(((_v.y + 1) / 2) * H) - 1;
          gl.readPixels(x, y, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let l = 0;
          for (let j = 0; j < 36; j += 4) l += (0.2126 * lin(buf[j]) + 0.7152 * lin(buf[j + 1]) + 0.0722 * lin(buf[j + 2])) / 9;
          vals.push(l);
        }
        vals.sort((p, q) => p - q);
        const q = (f) => +(vals[Math.min(vals.length - 1, Math.floor(f * (vals.length - 1)))] ?? 0).toFixed(3);
        out.push({ idx: i, cur: i === S.cur, n: vals.length, p50: q(0.5), p75: q(0.75), max: q(1) });
      }
      return out;
    };
    /** Độ sáng ô chữ khắc đã đo (theo id bia) + ngưỡng chọn 'ink'. */
    // DEV: đếm số lần shadow map THỰC SỰ được vẽ lại (bọc WebGLShadowMap.render).
    let shadowRenders = 0;
    const smRender = renderer.shadowMap.render;
    renderer.shadowMap.render = function (...a) {
      if (this.enabled && (this.autoUpdate || this.needsUpdate) && a[0]?.length) shadowRenders++;
      return smRender.apply(this, a);
    };
    devRestore.push(() => (renderer.shadowMap.render = smRender));
    /**
     * DEV: chạy chuyển trạng thái ánh sáng chưa hover → hover (hoặc ngược lại) bằng khung bơm tay,
     * camera + bia đứng yên; trả về số lần vẽ lại shadow map trong lúc chuyển + số chương trình shader.
     */
    vm.cinemaLightFade = ({ to = true, frames = 60 } = {}) => {
      view.stop();
      S.lastInteract = performance.now();
      holder.rotation.y = 0;
      S.swayT0 = S.swayT;
      S.swayOffset = 0;
      S.swayRamp = 0;
      swaySpring.y = swaySpring.v = 0;
      for (let i = 0; i < 30; i++) tick(1 / 60);
      const p0 = renderer.info.programs?.length ?? 0;
      const s0 = shadowRenders;
      S.selTarget = !!to;
      const trace = [];
      for (let i = 0; i < frames; i++) {
        tick(1 / 60);
        if (i % 6 === 0) trace.push(+S.lightE.toFixed(3));
      }
      const out = { shadowRenders: shadowRenders - s0, programsBefore: p0, programsAfter: renderer.info.programs?.length ?? 0, lightU: +S.lightU.toFixed(3), eTrace: trace };
      view.start(K.frameTick);
      return out;
    };
    /**
     * DEV: số lần shadow map THỰC SỰ vẽ lại trong `frames` khung bơm tay (dt 1/60), camera đứng yên.
     *  mode 'idle'  — rảnh, không lắc (tự xoay tắt tạm)
     *  mode 'sway'  — đang lắc như lúc rảnh tay
     *  mode 'drag'  — kéo thanh trượt `path` qua lại giữa from ↔ to, MỘT sự kiện input mỗi khung
     *                 (như kéo chuột 60 Hz), qua đúng đường setSetting của bảng Cài đặt.
     * Trả về số lần / khung và quy ra / giây ở 60 và 120 Hz; giá trị cài đặt được trả lại như cũ.
     */
    vm.cinemaShadowRate = ({ mode = 'idle', frames = 120, path = 'spotAzimuth', from = -60, to = -20, step = 1 } = {}) => {
      view.stop();
      const keep = getSettings()[path];
      if (mode === 'sway') S.lastInteract = performance.now() - 20000;
      else {
        S.lastInteract = performance.now();
        holder.rotation.y = 0;
        S.swayT0 = S.swayT;
        S.swayOffset = 0;
        S.swayRamp = 0;
        swaySpring.y = swaySpring.v = 0;
      }
      for (let i = 0; i < 120; i++) tick(1 / 60);
      const s0 = shadowRenders;
      const p0 = renderer.info.programs?.length ?? 0;
      let v = from;
      let dir = Math.sign(to - from) || 1;
      for (let i = 0; i < frames; i++) {
        if (mode === 'sway') S.lastInteract = performance.now() - 20000;
        else S.lastInteract = performance.now();
        if (mode === 'drag') {
          v += dir * step;
          if ((dir > 0 && v >= Math.max(from, to)) || (dir < 0 && v <= Math.min(from, to))) dir = -dir;
          setSetting(path, +v.toFixed(4));
        }
        tick(1 / 60);
      }
      const n = shadowRenders - s0;
      if (mode === 'drag') setSetting(path, keep);
      const out = {
        mode,
        path: mode === 'drag' ? path : undefined,
        frames,
        renders: n,
        perFrame: +(n / frames).toFixed(3),
        perSec60: +((n / frames) * 60).toFixed(1),
        perSec120: +((n / frames) * 120).toFixed(1),
        programsBefore: p0,
        programsAfter: renderer.info.programs?.length ?? 0,
      };
      S.lastInteract = performance.now();
      view.start(K.frameTick);
      return out;
    };
    /**
     * DEV: chi phí khung hình bóng đổ BẬT so với TẮT, đo xen kẽ từng khối nhỏ để nhiễu GPU (máy đang
     * bận việc khác) chia đều cho hai bên. Mỗi khối `block` khung, bơm tay dt 1/60, readPixels chờ GPU.
     * sway = true: đang lắc (bóng vẽ lại cách khung); forceShadow = true: ép vẽ shadow map MỌI khung
     * (giá riêng của một lượt shadow map = hiệu hai trung vị). Trả về p50 / p95 (ms) mỗi bên.
     */
    vm.cinemaShadowCost = ({ blocks = 12, block = 30, sway = true, forceShadow = false } = {}) => {
      view.stop();
      const keep = getSettings().cinemaCastShadow;
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t = { on: [], off: [] };
      const r0 = shadowRenders;
      const cnt = { on: 0, off: 0 };
      const pin = () => {
        if (sway) S.lastInteract = performance.now() - 20000;
        else {
          S.lastInteract = performance.now();
          holder.rotation.y = 0;
        }
      };
      pin();
      for (let i = 0; i < 90; i++) tick(1 / 60);
      for (let b = 0; b < blocks * 2; b++) {
        const side = b % 2 === 0 ? 'on' : 'off';
        setSetting('cinemaCastShadow', side === 'on' ? keep || 1 : 0);
        pin();
        tick(1 / 60); // khung chuyển tiếp (bóng bật lại → vẽ lại) — không tính
        sync();
        const s0 = shadowRenders;
        for (let i = 0; i < block; i++) {
          pin();
          if (forceShadow) requestShadow();
          const tf = performance.now();
          tick(1 / 60);
          sync();
          t[side].push(performance.now() - tf);
        }
        cnt[side] += shadowRenders - s0;
      }
      setSetting('cinemaCastShadow', keep);
      S.lastInteract = performance.now();
      view.start(K.frameTick);
      const q = (a, f) => +[...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(f * (a.length - 1)))].toFixed(2);
      return {
        sway,
        forceShadow,
        frames: t.on.length,
        on: { p50: q(t.on, 0.5), p95: q(t.on, 0.95), shadowRenders: cnt.on },
        off: { p50: q(t.off, 0.5), p95: q(t.off, 0.95), shadowRenders: cnt.off },
        totalShadowRenders: shadowRenders - r0,
      };
    };
    /**
     * DEV: điểm ảnh CHÁY trên bia ở khung vừa vẽ: đọc cả khung, chỉ xét hộp chiếu của phiến bia (trên
     * chân phiến) và của rùa (dưới). max = kênh lớn nhất (0..255); nearWhite = tỉ lệ điểm ảnh có kênh
     * lớn nhất ≥ 250 trong số điểm ảnh có vật (độ sáng > nền).
     */
    vm.cinemaClipProbe = ({ modelOnly = true } = {}) => {
      if (!S.live) return null;
      // modelOnly: chỉ vẽ mô hình (ẩn bục, sàn, gương, decal) — đèn vẫn nguyên → đo đúng điểm ảnh của bia/rùa
      const hide = modelOnly ? [pedestals[0].group, pedestals[1].group, pool, S.catcher, ...contactDecals.map((d) => d.mesh)] : [];
      const was = hide.map((o) => o.visible);
      for (const o of hide) o.visible = false;
      renderer.render(scene, camera);
      hide.forEach((o, i) => (o.visible = was[i]));
      const gl = renderer.getContext();
      const W = renderer.domElement.width;
      const H = renderer.domElement.height;
      const buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      S.live.lift.updateWorldMatrix(true, false);
      const rect = (y0, y1) => {
        let x0 = Infinity, x1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (const x of [bounds.box.min.x, bounds.box.max.x])
          for (const y of [y0, y1])
            for (const z of [bounds.box.min.z, bounds.box.max.z]) {
              _v.set(x, y, z).applyMatrix4(S.live.lift.matrixWorld).project(camera);
              x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); v0 = Math.min(v0, _v.y); v1 = Math.max(v1, _v.y);
            }
        return [Math.max(0, Math.floor(((x0 + 1) / 2) * W)), Math.min(W, Math.ceil(((x1 + 1) / 2) * W)), Math.max(0, Math.floor(((v0 + 1) / 2) * H)), Math.min(H, Math.ceil(((v1 + 1) / 2) * H))];
      };
      const stat = ([x0, x1, y0, y1]) => {
        let max = 0, n = 0, hot = 0;
        for (let y = y0; y < y1; y += 2)
          for (let x = x0; x < x1; x += 2) {
            const o = (y * W + x) * 4;
            const m = Math.max(buf[o], buf[o + 1], buf[o + 2]);
            if (m < 40) continue; // nền / bóng tối
            n++;
            if (m > max) max = m;
            if (m >= 250) hot++;
          }
        return { max, nearWhite: +(hot / Math.max(1, n)).toFixed(4), n };
      };
      // Lưới 3×3 độ chói trung bình (tuyến tính) trên hộp phiến bia: hàng 0 = trên. Để đo độ "rơi" sáng.
      const lin = (c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const grid = ([x0, x1, y0, y1]) => {
        const out = [];
        for (let gy = 2; gy >= 0; gy--) {
          const row = [];
          for (let gx = 0; gx < 3; gx++) {
            let sum = 0, n = 0;
            const ax = x0 + ((x1 - x0) * gx) / 3, bx = x0 + ((x1 - x0) * (gx + 1)) / 3;
            const ay = y0 + ((y1 - y0) * gy) / 3, by = y0 + ((y1 - y0) * (gy + 1)) / 3;
            for (let y = Math.floor(ay); y < by; y += 3)
              for (let x = Math.floor(ax); x < bx; x += 3) {
                const o = (y * W + x) * 4;
                if (Math.max(buf[o], buf[o + 1], buf[o + 2]) < 40) continue;
                sum += 0.2126 * lin(buf[o]) + 0.7152 * lin(buf[o + 1]) + 0.0722 * lin(buf[o + 2]);
                n++;
              }
            row.push(+(sum / Math.max(1, n)).toFixed(3));
          }
          out.push(row);
        }
        return out;
      };
      const slabR = rect(bounds.bandBottom, bounds.yMax);
      const turtleR = rect(bounds.yMin, bounds.bandBottom);
      const tg = grid(turtleR);
      return { slab: stat(slabR), turtle: stat(turtleR), slabGrid: grid(slabR), turtleMean: +(tg.flat().reduce((a, b) => a + b, 0) / 9).toFixed(3) };
    };
    /** DEV: chế độ gương lòng bục: 'every' (mặc định: mỗi khung động, MSAA 4) | 'throttled' (cách cũ). */
    vm.cinemaMirrorMode = (mode = 'every') => {
      S.devMirrorMode = mode;
      for (const m of mirrors) {
        const rt = m.mesh.getRenderTarget();
        const want = mode === 'throttled' ? 0 : 4;
        if (rt.samples !== want) {
          rt.samples = want;
          rt.dispose(); // three tạo lại bộ đệm với số mẫu mới ở lần dùng tới
        }
        m.invalidate();
      }
      return mode;
    };
    vm.cinemaFieldLuma = () => ({ threshold: LUMA_INK, byId: Object.fromEntries(fieldLuma) });
    /** r16: đo lại ĐỒNG BỘ (cách cũ) ô tên của bia hiện tại và so với kết quả đo không chặn đã lưu. */
    vm.cinemaFieldLumaCheck = () => {
      const id = slotEntry[S.cur]?.id;
      const stored = id ? fieldLuma.get(id) ?? null : null;
      const sync = measureFieldLumaSync({ store: false });
      return { id, stored, sync, same: !!stored && !!sync && JSON.stringify(stored) === JSON.stringify(sync) };
    };
    /**
     * DEV: tỉ lệ tương phản CHỈ-CHỮ (WCAG) của tên / nhãn trên mặt đá đã đo, chưa hover / hover, cho mọi bia
     * đã đo: kiểu đang dùng (auto) và kiểu trước r7 (màu chốt lúc chưa hover, tên mờ 65 % khi hover —
     * trộn trong sRGB như trình duyệt, đá coi như xám trung tính cùng độ chói). worst = phân vị xấu nhất.
     */
    vm.cinemaNamesContrast = () => {
      const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const enc = (y) => (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055);
      const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const Y = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
      const over = (rgb, a, yBg) => { const g = enc(yBg); return Y(rgb.map((c) => a * c + (1 - a) * g)); };
      const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const C = { name: { light: hex('#fffaf3'), ink: hex('#1c130b') }, label: { light: hex('#f5ddb0'), ink: hex('#33230f') } };
      const C0 = { name: { light: hex('#fbf3e6'), ink: hex('#2a1d12') }, label: { light: hex('#ecd09a'), ink: hex('#4a3210') } }; // trước r7
      const r2 = (v) => +v.toFixed(2);
      const out = {};
      for (const [id, L] of fieldLuma) {
        if (!L.idle) continue;
        const row = {};
        for (const st of ['idle', 'hover']) {
          const T = L[st];
          const ink = S.namesStyle === 'ink' ? 1 : S.namesStyle === 'light' ? 0 : inkFor(T);
          const tone = ink ? 'ink' : 'light';
          const worstY = ink ? T.p10 : T.p90;
          const legacyTone = L.tone === 'ink' ? 'ink' : 'light';
          const legacyA = st === 'hover' ? 0.35 : 1;
          const lWorst = legacyTone === 'ink' ? T.p10 : T.p90;
          row[st] = {
            stone: { p10: T.p10, mean: T.mean, p90: T.p90 },
            style: tone,
            name: { worst: r2(cr(Y(C.name[tone]), worstY)), mean: r2(cr(Y(C.name[tone]), T.mean)) },
            label: { worst: r2(cr(Y(C.label[tone]), worstY)), mean: r2(cr(Y(C.label[tone]), T.mean)) },
            before: {
              style: legacyTone,
              name: { worst: r2(cr(over(C0.name[legacyTone], legacyA, lWorst), lWorst)), mean: r2(cr(over(C0.name[legacyTone], legacyA, T.mean), T.mean)) },
              label: { worst: r2(cr(over(C0.label[legacyTone], legacyA, lWorst), lWorst)), mean: r2(cr(over(C0.label[legacyTone], legacyA, T.mean), T.mean)) },
            },
          };
        }
        out[id] = row;
      }
      return out;
    };
    /** Ép bật/tắt hiệu ứng "đang chọn" ngay trong khung này (đo từng pha bằng __vm.snap). */
    /** DEV: bắt đầu / dừng ghi vết mỗi khung các mức sáng hover (dải trên / dưới hai bục, mix, spill). */
    vm.cinemaLightTrace = (on = true) => {
      if (on) {
        S.devTrace = [];
        S.devTrace.t0 = performance.now();
        return true;
      }
      const out = S.devTrace ?? [];
      S.devTrace = null;
      return out;
    };
    /** DEV: tên người đỗ kiểu cũ (trước r7) để chụp so sánh. */
    vm.cinemaNamesLegacy = (on = true) => (S.devNamesLegacy = !!on);
    vm.cinemaInfoLegacy = (on = true) => (S.devInfoLegacy = !!on);
    /**
     * DEV: đầu rùa của bia hiện tại — { id, head (toạ độ mô hình), world, screen }; marker: true → vẽ quả cầu
     * lưới đánh dấu vùng đầu (để soát tools/measure-heads.mjs), false → gỡ.
     */
    let devHeadMarker = null;
    vm.cinemaHead = ({ marker } = {}) => {
      if (marker !== undefined) {
        if (devHeadMarker) {
          devHeadMarker.parent?.remove(devHeadMarker);
          devHeadMarker.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
          });
          devHeadMarker = null;
        }
        if (marker && S.live?.head) {
          const h = S.live.head;
          devHeadMarker = new THREE.Mesh(
            new THREE.SphereGeometry(h.radius * REGION_HEAD_K, 24, 16),
            new THREE.MeshBasicMaterial({ color: 0xff3b30, wireframe: true, transparent: true, opacity: 0.55, depthTest: false }),
          );
          devHeadMarker.renderOrder = 50;
          devHeadMarker.position.set(h.center[0], h.center[1], h.center[2]);
          // cổ (r10): viên thuốc dọc trục cổ — lưới vàng mảnh (vùng xoa thật tô ở shader: vm.cinemaRubRegion)
          const nk = h.neck;
          if (nk?.axis && nk.length > 0) {
            const neck = new THREE.Mesh(
              new THREE.CapsuleGeometry(h.radius * REGION_NECK_K, nk.length, 8, 20),
              new THREE.MeshBasicMaterial({ color: 0xffd60a, wireframe: true, transparent: true, opacity: 0.35, depthTest: false }),
            );
            neck.renderOrder = 49;
            const ax = new THREE.Vector3(...nk.axis);
            neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
            neck.position.copy(ax).multiplyScalar(nk.length / 2);
            devHeadMarker.add(neck);
          }
          const dot = new THREE.Mesh(new THREE.SphereGeometry(h.radius * 0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd60a, depthTest: false }));
          dot.renderOrder = 51;
          devHeadMarker.add(dot);
          neverCastShadow(devHeadMarker);
          devHeadMarker.userData.noReflect = true;
          devHeadMarker.traverse((o) => {
            o.raycast = () => {};
            o.userData.noBVH = true;
          });
          S.live.inst.add(devHeadMarker);
        }
      }
      const w = new THREE.Vector3();
      return { id: S.live?.id, head: S.live?.head ?? null, region: S.live?.head ? regionBounds(S.live.head) : null, world: headWorld(w) ? w.toArray().map((v) => +v.toFixed(4)) : null, screen: rubScreen(), zoomK: +rubZoomK().toFixed(3) };
    };
    /** DEV: xoay camera quanh tâm nhìn hiện tại (độ) như người dùng kéo — để chụp vệt sáng trượt trên chỗ bóng. */
    vm.cinemaOrbit = (dAz = 0, dEl = 0) => {
      markInteraction();
      const off = camera.position.clone().sub(controls.target);
      const sp = new THREE.Spherical().setFromVector3(off);
      sp.theta += THREE.MathUtils.degToRad(dAz);
      sp.phi = THREE.MathUtils.clamp(sp.phi - THREE.MathUtils.degToRad(dEl), controls.minPolarAngle, controls.maxPolarAngle);
      camera.position.setFromSpherical(sp).add(controls.target);
      killInertia();
      controls.update();
      return +THREE.MathUtils.radToDeg(sp.theta).toFixed(2);
    };
    /** DEV: bật / tắt chế độ xoa trực tiếp ở sân khấu (không qua giao diện — xem vm.cinemaRub trong index.js). */
    vm.cinemaRubMode = (on = true) => setRubMode(on);
    /** DEV: thử tham số vùng xoa cho bia đang hiện ({ center, radius, neck }) — chỉ bản đang sống, không lưu. */
    vm.cinemaHeadTune = (h) => {
      if (!S.live?.polish) return null;
      if (h) {
        S.live.head = h;
        S.live.polish.setHead(h);
        reflector.invalidate();
      }
      return S.live.head;
    };
    /** DEV: tô vùng xoa (đầu 1,1× + cổ, cắt dưới cằm) lên đá của bia hiện tại (k 0..1, 0 = tắt). */
    vm.cinemaRubRegion = (k = 1) => {
      S.live?.polish?.setRegionTint(k);
      reflector.invalidate();
      return !!S.live?.polish;
    };
    /** DEV: ghi vết camera mỗi khung (vào / ra chế độ xoa): cinemaCamTrace(true) bắt đầu, cinemaCamTrace(false) → mảng. */
    /** DEV (r13): bỏ giới hạn khoảng cách gần của camera (chụp cận mặt đá — cinemaHome({ zoom: rất nhỏ })). */
    vm.cinemaFreeCam = (on = true) => {
      S.distRelax = on ? 0.01 : 0;
      applyDistLimits();
      return controls.minDistance;
    };
    /** DEV (r13): đặt pha lắc (độ, 0..360 của một chu kỳ SWAY_PERIOD) + coi như đã rảnh lâu → đang lắc hết biên độ. */
    vm.cinemaSwayPhase = (deg = 0) => {
      S.swayT = S.swayT0 + (((deg % 360) + 360) % 360) / 360 * SWAY_PERIOD;
      S.swayRamp = 1;
      swaySpring.y = swaySpring.v = 0;
      S.lastInteract = performance.now() - 60000;
      return { yaw: +THREE.MathUtils.radToDeg(SWAY_A * Math.sin(((S.swayT - S.swayT0) / SWAY_PERIOD) * Math.PI * 2)).toFixed(3) };
    };
    vm.cinemaCamTrace = (on = true) => {
      if (on) {
        S.devCamTrace = [];
        S.devCamTrace.t0 = performance.now();
        return true;
      }
      const out = S.devCamTrace ?? [];
      S.devCamTrace = null;
      return out;
    };
    /** DEV: thêm độ bóng tay tại điểm toạ độ mô hình (mặc định: tâm đầu rùa). */
    vm.cinemaRubDeposit = (amount = 0.5, p = null, rK = 0.3) => {
      if (!S.live?.head) return null;
      const c = p ?? { x: S.live.head.center[0], y: S.live.head.center[1], z: S.live.head.center[2] };
      S.live.rubDirty = true;
      return S.live.polish.deposit(c.x, c.y, c.z, S.live.head.radius * rK, amount);
    };
    /** DEV: trạng thái xoa — chế độ, độ bóng (số vết / tổng / mạnh nhất), số lượt, khung cận. */
    vm.cinemaPolishNormals = () => polishNormalStats.slice();
    /** DEV: đo lại (lúc rảnh) thời gian tính pháp tuyến mượt cho bản gốc của bia hiện tại. */
    vm.cinemaPolishNormalsBench = () => {
      if (!S.source) return null;
      const out = [];
      for (let k = 0; k < 3; k++) {
        S.source.traverse((o) => o.isMesh && o.geometry.deleteAttribute('aPolishN'));
        const t0 = performance.now();
        const n = ensurePolishNormals(THREE, S.source, headOf(S.source.name));
        out.push({ ms: +(performance.now() - t0).toFixed(1), n });
      }
      let verts = 0;
      const attrs = [];
      S.source.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        verts += g.getAttribute('position').count;
        for (const k of ['position', 'normal']) {
          const a = g.getAttribute(k);
          attrs.push({ k, interleaved: !!a.isInterleavedBufferAttribute, type: (a.array ?? a.data?.array)?.constructor?.name, normalized: a.normalized, stride: a.data?.stride });
        }
      });
      return { id: S.source.name, verts, runs: out, attrs };
    };
    vm.cinemaRubState = () => ({
      on: S.rubOn,
      available: S.rubEnabled && !!S.live?.head && !S.tx,
      settled: S.rubOn && !(S.camTw && S.camTw.kind === 'rub'),
      stats: S.live?.polish ? { ...S.live.polish.stats(), n: S.live.rubN } : null,
      goal: S.rubGoalOk ? { pos: rubGoal.pos.toArray().map((v) => +v.toFixed(4)), dist: +rubGoal.dist.toFixed(4) } : null,
      cam: { az: +THREE.MathUtils.radToDeg(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z)).toFixed(2), dist: +camera.position.distanceTo(controls.target).toFixed(4) },
      camPos: camera.position.toArray().map((v) => +v.toFixed(5)),
      target: controls.target.toArray().map((v) => +v.toFixed(5)),
      tw: S.camTw ? { kind: S.camTw.kind, t: +(S.camTw.t ?? 0).toFixed(3) } : null,
      brush: S.live?.polish ? (({ x, y, z, w }) => ({ x, y, z, r: w, k: S.live.polish.uniforms.uRubBrushK.value }))(S.live.polish.uniforms.uRubBrush.value) : null,
      userMoved: S.userMoved,
      limits: { min: +controls.minDistance.toFixed(3), max: +controls.maxDistance.toFixed(3), rot: controls.rotateSpeed, zoom: controls.zoomSpeed },
    });
    /** DEV: bật / tắt vùng giữ hover (chống vòng lặp hover ↔ camera xoay) để so sánh. */
    vm.cinemaLatch = (on = true) => {
      S.devLatchOff = !on;
      return { latch: !S.devLatchOff, rect: S.live ? { ...latchRect() } : null };
    };
    /** DEV: tắt nguồn sáng khi vẽ (xem devMute): cinemaMute(['rim', 'fill']) · cinemaMute() = bật lại hết. */
    vm.cinemaMute = (list = []) => {
      devMute.clear();
      for (const k of list) devMute.add(k);
      reflector.invalidate();
      return [...devMute];
    };
    vm.cinemaSelectForce = (on = true) => {
      S.selTarget = !!on;
      return { target: S.selTarget, u: selU[S.cur] };
    };
    /**
     * Cỡ chữ khắc TRÊN MÀN HÌNH (px CSS) ở mặt trước bục, khung hiện tại: chiếu hai đầu nét (theo v
     * của bản đồ chữ) ở phương vị 0 ra màn hình. Mặt sau cùng hình học → nhân tỉ lệ texel sau/trước.
     */
    /**
     * DEV: texel bản đồ chữ trên MỖI ĐIỂM ẢNH THIẾT BỊ ở giữa chữ mặt trước (u = 0,5, giữa mặt vát), theo
     * camera hiện tại: > 1 = texture dư chi tiết, < 1 = texture là giới hạn độ sắc (bị phóng to).
     */
    const texelsPerPx = () => {
      const p = pedestals[S.cur];
      const rel = p.relief;
      if (!rel) return null;
      const [a, b] = p.bandEnds;
      p.group.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const W = rel.texels?.normal?.[0] ?? 4096;
      const H = rel.texels?.normal?.[1] ?? 256;
      const dpr = renderer.getPixelRatio();
      const px = (phi, v) => {
        const r = a[0] + (b[0] - a[0]) * v;
        const h = a[1] + (b[1] - a[1]) * v;
        _v.set(r * Math.sin(phi), h, r * Math.cos(phi)).applyMatrix4(p.group.matrixWorld).project(camera);
        return [((_v.x + 1) / 2) * view.width * dpr, ((1 - _v.y) / 2) * view.height * dpr];
      };
      const d = (p0, p1) => Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const n = 16; // đo trên 16 texel cho đỡ nhiễu
      const du = d(px(0, 0.5), px((n * 2 * Math.PI) / W, 0.5)) / n;
      const dv = d(px(0, 0.5 - n / (2 * H)), px(0, 0.5 + n / (2 * H))) / n;
      return { u: +(1 / du).toFixed(2), v: +(1 / dv).toFixed(2), texW: W, texH: H, dpr };
    };
    const textPx = () => {
      const p = pedestals[S.cur];
      const rel = p.relief;
      if (!rel) return null;
      const [a, b] = p.bandEnds;
      p.group.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const at = (v) => {
        const r = a[0] + (b[0] - a[0]) * v;
        const h = a[1] + (b[1] - a[1]) * v;
        _v.set(0, h, r).applyMatrix4(p.group.matrixWorld).project(camera);
        return ((1 - _v.y) / 2) * view.height;
      };
      const span = (texels) => Math.abs(at(0.5 - texels / 512) - at(0.5 + texels / 512)); // RELIEF_H = 256
      const f = rel.canvas.front;
      const k = rel.canvas.back;
      return {
        view: `${view.width}×${view.height}`,
        scale: rel.scale,
        front: { year: +span(f.yearInk).toFixed(1), wordCap: +span(f.wordCap).toFixed(1) },
        back: { year: +span(k.yearInk).toFixed(1), wordCap: +span(k.wordCap).toFixed(1) },
      };
    };
    /** Chiều cao bia trên màn hình (px CSS) ở tư thế hiện tại: chiếu chân + đỉnh trên trục bia. */
    const steleHeightPx = () => {
      if (!S.live) return null;
      S.live.lift.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      const y = (v) => {
        _v.set(0, v, bounds.zFront).applyMatrix4(S.live.lift.matrixWorld).project(camera);
        return ((1 - _v.y) / 2) * view.height;
      };
      return +(y(bounds.yMin) - y(bounds.yMax)).toFixed(1);
    };
    /** Bục + chữ nổi của khay hiện tại (thời gian dựng, font số năm, cỡ chữ trong texture). */
    const pedInfo = () => {
      const p = pedestals[S.cur];
      const rel = p.relief;
      const foot = bounds.foot;
      return {
        on: S.pedestalOn,
        cfg: { ...PEDESTAL },
        light: { idle: { ...IDLE }, idleSpot: { ...IDLE_SPOT }, spill: { ...SPILL } },
        size: S.pedSize,
        text: S.pedText,
        sep: S.pedSep,
        look: { ...S.pedLook },
        footMax: { ...footMax },
        R0: +p.R0.toFixed(4),
        R: +p.R.toFixed(4),
        H: +p.H.toFixed(4),
        lift: +p.lift.toFixed(4),
        dishR: +p.dishR.toFixed(4),
        rimR: +p.rimR.toFixed(4),
        // chân rùa bia này so với mép vành (> 0 = nằm gọn trong lòng bục)
        baseClear: foot ? +(p.rimR - foot.base).toFixed(4) : null,
        sweptClear: foot ? +(p.R - foot.swept).toFixed(4) : null,
        band: { circ: +p.bandDims.circ.toFixed(4), slant: +p.bandDims.slant.toFixed(4) },
        relief: rel ? { key: rel.key, ms: rel.ms, canvas: rel.canvas, yearFont: rel.yearFont } : null,
        textPx: textPx(),
        texelsPerPx: texelsPerPx(),
        steleHeightPx: steleHeightPx(),
        stats: { ...pedStats, rebuildMs: +pedStats.rebuildMs.toFixed(2) },
        contact: S.source ? contact.info(S.source) : null,
        dishMat: pedestals[S.cur].dishMaterial,
        mirrors: mirrors.map((m) => ({ visible: m.mesh.visible, inScene: !!m.mesh.parent?.visible, rt: m.renderTargetSize })),
      };
    };
    /**
     * Tinh chỉnh tỉ lệ bục TỨC THÌ (không sửa mã): { pad, hr, slope, dish, strip } — xem PEDESTAL_DEFAULTS
     * trong pedestal.js — và { size, text } (thử pedestalSize / pedestalText KHÔNG ghi vào cài đặt).
     * tune('reset') về mặc định (size/text về giá trị trong cài đặt). Dựng lại cả hai bục (một cỡ chung),
     * nâng/hạ bia, canh khung lại và xin chữ nổi theo kích thước dải vát mới.
     */
    const tune = (params = {}) => {
      if (params === 'reset') {
        Object.assign(PEDESTAL, PEDESTAL_DEFAULTS);
        Object.assign(IDLE, IDLE_DEFAULTS);
        Object.assign(IDLE_SPOT, IDLE_SPOT_DEFAULTS);
        Object.assign(SPILL, SPILL_DEFAULTS);
        syncSpot(getSettings()); // hướng / góc / độ mềm lấy lại từ cài đặt
        applyIdleLighting(true);
        for (const pd of pedestals) pd.setDishMaterial({ ...DISH_MAT_DEFAULTS, cap: DISH_SPEC_CAP, env: DISH_ENV, color: DISH_COLOR });
        S.devPerStele = false;
        S.devContactOff = false;
        syncContact(getSettings());
        S.pedSize = clampNum(getSettings().pedestalSize, 0.95, 1.4, DEFAULTS.pedestalSize);
        S.pedText = clampNum(getSettings().pedestalText, 0.4, 1, DEFAULTS.pedestalText);
      } else {
        for (const k of Object.keys(PEDESTAL_DEFAULTS)) {
          const v = Number(params[k]);
          if (Number.isFinite(v)) PEDESTAL[k] = v;
        }
        if (Number.isFinite(params.size)) S.pedSize = clampNum(params.size, 0.85, 1.3, 1);
        if (typeof params.perStele === 'boolean') S.devPerStele = params.perStele;
        if (params.idle) Object.assign(IDLE, params.idle);
        if (params.idleSpot) Object.assign(IDLE_SPOT, params.idleSpot);
        if (params.spill) Object.assign(SPILL, params.spill);
        if (params.idle || params.idleSpot || params.spill) {
          placeIdleSpot();
          applyIdleLighting(true);
        }
        const dm = { roughness: params.dishRough, metalness: params.dishMetal, env: params.dishEnv, cap: params.dishCap, color: params.dishColor, rimCut: params.dishRimCut, envUp: params.dishEnvUp, sheen: params.dishSheen, sheenColor: params.dishSheenColor };
        if (Object.values(dm).some((v) => v != null)) {
          for (const pd of pedestals) pd.setDishMaterial(dm);
          reflector.invalidate();
        }
        if (typeof params.topReflect === 'boolean') {
          for (const pd of pedestals) pd.topStripMesh.userData.noReflect = !params.topReflect;
          reflector.invalidate();
        }
        if (typeof params.contact === 'boolean') {
          S.devContactOff = !params.contact;
          syncContact(getSettings());
        }
        if (Number.isFinite(params.text)) S.pedText = clampNum(params.text, 0.4, 1, 0.7);
      }
      if (S.live) {
        const r0 = pedestalR0();
        for (let i = 0; i < 2; i++) {
          pedestals[i].setSize(r0, S.pedSize, true);
          lifts[i].position.y = S.pedestalOn ? pedestals[i].lift : 0;
        }
        syncMirrors();
        refreshRelief(S.cur);
        S.pedSettleAt = 0;
        fieldLuma.clear();
        S.lumaAt = 0;
        computeHome();
        computeFit();
        if (!S.userMoved) snapHome();
        else S.homing = true;
        requestShadow();
        reflector.invalidate();
      }
      return pedInfo();
    };
    /**
     * Đi đúng đường cài đặt thật (như thanh trượt trong bảng Cài đặt): { pedestalSize: 1.2, … }
     * (pedestal*, spot*, reflection, shadow, shadowOpacity, contactShadow, cinemaCastShadow, cinemaPedestal,
     * transition, cinemaContrast, key, exposure, env). Trả về thời gian xử lý đồng bộ (ms) của lần ghi.
     */
    const set = (patch = {}) => {
      const t0 = performance.now();
      const ok = (k) =>
        k.startsWith('pedestal') ||
        k.startsWith('spot') ||
        k.startsWith('key') ||
        ['reflection', 'shadow', 'shadowOpacity', 'contactShadow', 'cinemaCastShadow', 'cinemaPedestal', 'cinemaContrast', 'key', 'exposure', 'env'].includes(k);
      for (const [k, v] of Object.entries(patch)) if (ok(k)) setSetting(k, v);
      return +(performance.now() - t0).toFixed(2);
    };
    /** DEV: ảnh bản đồ bóng tiếp xúc đã nướng của bia hiện tại (data URL). */
    const contactMap = () => (S.source ? contact.debugImage(S.source) : null);
    vm.cinemaPedestal = Object.assign(pedInfo, { tune, set, contactMap });
    /**
     * DEV (r55): chữ khắc trên bục của bia đang hiện — nhẹ, đọc được mỗi khung. ok = bục có bản đồ chữ CỦA ĐÚNG bia đang
     * hiện và chữ không ẩn (hiện / đang mọc).
     */
    vm.cinemaPedText = () => {
      const p = pedestals[S.cur];
      const id = slotEntry[S.cur]?.id ?? null;
      const rid = p.relief?.key?.split('|')[0] ?? null;
      const W = S.reliefWin;
      const win = { target: W.target?.id ?? null, near: W.near.map((e) => e.id), far: W.far.map((e) => e.id), eager: !!W.eager };
      const ring = slotEntry[S.cur] ? ringText(slotEntry[S.cur]) : null;
      return { id, relief: rid, state: p.textState, ok: !!id && rid === id && (p.textState === 'shown' || p.textState === 'growing' || p.textState === 'pinned'), win, text: ring ? [...ring.front, ...ring.back] : null };
    };
    /**
     * DEV: thời gian GPU mỗi khung (ms, EXT_disjoint_timer_query_webgl2) — rảnh hoặc đang lắc.
     * Bất đồng bộ: chờ kết quả truy vấn về. { frames, sway, mirror } như cinemaDrawCalls.
     */
    // r85: warm = số khung chạy trước khi đo (0 = đo ngay — vd. đo giữa lượt hiệu ứng đang chạy)
    /**
     * DEV (r85): giá một khung theo đồng hồ tường — tick + đọc 1 điểm ảnh (chặn tới khi GPU vẽ xong khung) — ms mỗi khung.
     * Đồng hồ GPU (cinemaGpuTime) của Chromium không đầu trên macOS cộng cả phần chờ hàng đợi (tăng dần rồi tụt), không
     * dùng được để so bật / tắt; phép đo này ổn định hơn (gồm cả JS của khung).
     */
    vm.cinemaFrameCost = ({ frames = 90, warm = 20, raw = false } = {}) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      view.stop();
      S.lastInteract = performance.now();
      for (let i = 0; i < warm; i++) tick(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const out = [];
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        tick(1 / 60);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        out.push(performance.now() - t0);
      }
      view.start(K.frameTick);
      const sorted = [...out].sort((a, b) => a - b);
      return {
        n: out.length,
        mean: +(out.reduce((a, b) => a + b, 0) / out.length).toFixed(3),
        p50: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
        ...(raw ? { raw: out.map((v) => +v.toFixed(2)) } : {}),
      };
    };
    /**
     * DEV (r90): đồng bộ vạch quét ↔ chữ sáng — `frames` khung (tick dt, vẽ đồng bộ), mỗi khung đọc điểm ảnh ngay sau khi vẽ (ô
     * (2r+1)², độ chói lớn nhất, 0..255) tại hình chiếu của các điểm mặt bia `pts` ([x, y] toạ độ bia) + vị trí vạch (uScan.x) và
     * đường sáng chữ (uLitY / uTrace2.x) của khung đó — dò khung chữ bắt đầu sáng so với khung mép dẫn vạch qua tâm chữ.
     */
    vm.cinemaLitTrace = ({ pts = [], frames = 120, dt = 1 / 60, r = 1 } = {}) => {
      if (!S.live) return null;
      const gl = renderer.getContext();
      const n = 2 * r + 1;
      const buf = new Uint8Array(n * n * 4);
      const v = new THREE.Vector3();
      view.stop();
      const rows = [];
      for (let f = 0; f < frames; f++) {
        tick(dt);
        const W = gl.drawingBufferWidth;
        const H = gl.drawingBufferHeight;
        S.live.lift.updateWorldMatrix(true, false);
        camera.updateMatrixWorld();
        const lum = pts.map(([x, y]) => {
          v.set(x, y, K.bounds.zFront).applyMatrix4(S.live.lift.matrixWorld).project(camera);
          const px = Math.round(((v.x + 1) / 2) * W);
          const py = Math.round(((v.y + 1) / 2) * H);
          gl.readPixels(px - r, py - r, n, n, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let m = 0;
          for (let i = 0; i < n * n; i++) m = Math.max(m, 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2]);
          return +m.toFixed(1);
        });
        const U = S.live.polish?.uniforms;
        rows.push({ lum, bar: U ? +U.uScan.value.x.toFixed(5) : null, litT: U ? +U.uTrace2.value.x.toFixed(5) : null });
      }
      view.start(K.frameTick);
      return rows;
    };
    vm.cinemaGpuTime = async ({ frames = 90, sway = false, mirror = false, warm = 120, raw = false, sync = false } = {}) => {
      const gl = renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return null;
      view.stop();
      S.lastInteract = sway ? performance.now() - 20000 : performance.now();
      for (let i = 0; i < warm; i++) tick(1 / 60);
      const qs = [];
      for (let i = 0; i < frames; i++) {
        if (mirror) reflector.invalidate();
        const q = gl.createQuery();
        if (sync) gl.finish(); // r85: hàng đợi GPU rỗng trước khung đo — đồng hồ không cộng phần chờ của khung trước
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        tick(1 / 60);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        if (sync) gl.finish();
        qs.push(q);
      }
      view.start(K.frameTick);
      const out = [];
      for (let tries = 0; tries < 200 && out.length < qs.length; tries++) {
        await new Promise((r) => setTimeout(r, 16));
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) return { disjoint: true };
        while (out.length < qs.length && gl.getQueryParameter(qs[out.length], gl.QUERY_RESULT_AVAILABLE)) {
          out.push(gl.getQueryParameter(qs[out.length], gl.QUERY_RESULT) / 1e6);
        }
      }
      for (const q of qs) gl.deleteQuery(q);
      if (!out.length) return null;
      const sorted = [...out].sort((a, b) => a - b);
      return {
        n: out.length,
        mean: +(out.reduce((a, b) => a + b, 0) / out.length).toFixed(3),
        p50: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
        ...(raw ? { raw: out.map((v) => +v.toFixed(3)) } : {}),
      };
    };
    /**
     * DEV (r63): đọc điểm ảnh WebGL vùng lòng bục của bia đang hiện (khung chữ nhật bao đĩa gương trên màn hình) sau MỘT khung
     * vẽ bắt buộc — lớp DOM (hạt phim, tên CSS3D) không lẫn vào. key: lưu lại để so; diff: so với bản đã lưu tên đó →
     * { max, over2, over8, n } (chênh lệch lớn nhất trên một kênh, số điểm ảnh lệch > 2 / > 8).
     */
    const dishBufs = new Map();
    vm.cinemaDishPixels = ({ key = null, diff = null } = {}) => {
      tick(1 / 60);
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const W = renderer.domElement.width;
      const H = renderer.domElement.height;
      const m = mirrors[S.cur].mesh;
      m.updateWorldMatrix(true, false);
      const p = new THREE.Vector3();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        p.set(Math.cos(a), Math.sin(a), 0).applyMatrix4(m.matrixWorld).project(camera);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      const X = Math.max(0, Math.floor(((x0 + 1) / 2) * W));
      const Y = Math.max(0, Math.floor(((y0 + 1) / 2) * H));
      const w = Math.min(W, Math.ceil(((x1 + 1) / 2) * W)) - X;
      const h = Math.min(H, Math.ceil(((y1 + 1) / 2) * H)) - Y;
      const buf = new Uint8Array(Math.max(0, w * h * 4));
      if (w > 0 && h > 0) gl.readPixels(X, Y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const out = { x: X, y: Y, w, h };
      if (key) dishBufs.set(key, buf);
      if (diff) {
        const b = dishBufs.get(diff);
        if (!b || b.length !== buf.length) return { ...out, error: 'không có bản so / khác cỡ' };
        let max = 0, over2 = 0, over8 = 0;
        for (let i = 0; i < buf.length; i += 4) {
          const d = Math.max(Math.abs(buf[i] - b[i]), Math.abs(buf[i + 1] - b[i + 1]), Math.abs(buf[i + 2] - b[i + 2]));
          if (d > max) max = d;
          if (d > 2) over2++;
          if (d > 8) over8++;
        }
        Object.assign(out, { max, over2, over8, n: buf.length / 4 });
      }
      return out;
    };
    /** Cây BVH: nhật ký dựng (worker/luồng chính), đo dựng đồng bộ để so sánh, và bia hiện tại đã có cây chưa. */
    vm.cinemaBvh = {
      stats: () => bvhStats.slice(),
      ready: () => !!S.live && hasBVH(S.live.inst),
      syncBuildMs: () => (S.source ? measureSyncBuild(S.source) : null),
      workerBuildMs: () => (S.source ? measureWorkerBuild(S.source) : null),
      mode: (m = 'auto') => (S.devRayMode = m),
    };
    /** Hồ sơ bề ngang (bề ngang lát / bề ngang thân bia, từ chân lên đỉnh) + dải phiến đo được. */
    vm.cinemaProfile = () => ({
      bins: PROFILE_BINS,
      slab: [+bounds.slabL.toFixed(4), +bounds.slabR.toFixed(4)],
      band: [+bounds.bandBottom.toFixed(3), +bounds.bandTop.toFixed(3)],
      height: +(bounds.yMax - bounds.yMin).toFixed(4),
      profile: bounds.profile,
    });
    // Chạy tay MỘT khung (khi khung trình duyệt bị ẩn thì requestAnimationFrame đứng yên). Luôn vẽ (force).
    vm.cinemaTick = (dt = 1 / 60) => tick(dt);
    /**
     * r15 vẽ theo yêu cầu: số khung đã vẽ / bỏ qua (theo lý do) từ lần đặt lại. reset = true → đặt lại sau khi đọc.
     * { rendered, skipped, why: { lý do: số khung }, sec, gpuFps (khung vẽ / giây), onDemand }
     */
    vm.cinemaRenderStats = (reset = false) => {
      const sec = (performance.now() - devRender.t0) / 1000;
      const out = { rendered: devRender.rendered, skipped: devRender.skipped, why: { ...devRender.why }, sec: +sec.toFixed(2), gpuFps: +(devRender.rendered / Math.max(1e-3, sec)).toFixed(2), onDemand: S.renderOnDemand };
      if (reset) {
        devRender.rendered = devRender.skipped = 0;
        devRender.why = {};
        devRender.t0 = performance.now();
      }
      return out;
    };
    /** Bật / tắt vẽ theo yêu cầu (tắt = vẽ mọi khung như trước r15) — để so sánh. */
    vm.cinemaRenderOnDemand = (on = true) => {
      S.renderOnDemand = !!on;
      requestRender('dev');
      return S.renderOnDemand;
    };
    /** DEV (r19): vẻ chờ của proxy — 'rim' | 'outline'; trả biến thể đang dùng. */
    vm.cinemaProxyLook = (v) => {
      if (v === 'rim' || v === 'outline') S.proxyLook = v;
      requestRender('dev');
      return S.proxyLook;
    };
    /** DEV (r19): ghim vẻ chờ của proxy đang hiện ở { t (giây), level (0..1) } để chụp; null = thả. */
    vm.cinemaProxyWait = (hold) => {
      if (S.live?.wait) S.live.wait.hold = hold ? { t: hold.t ?? 0, level: hold.level ?? 0 } : null;
      requestRender('dev');
      return S.live?.wait ? { t: +S.live.wait.t.toFixed(2), level: +S.live.wait.level.toFixed(3), target: S.live.wait.target, look: S.proxyLook } : null;
    };
    /**
     * r16 DEV: quét hiện — p (0..1) ghim tiến độ lượt quét đang chạy để chụp (null = chạy tiếp); trả trạng thái.
     */
    vm.cinemaReveal = (p) => {
      const r = S.live?.reveal;
      if (r && p !== undefined) {
        r.hold = p == null ? null : THREE.MathUtils.clamp(p, 0, 0.999);
        requestRender('dev');
      }
      return { proxy: !!S.live?.proxy, revealing: !!r, t: r ? +(r.t / Math.max(1e-6, r.dur)).toFixed(3) : null, hold: r?.hold ?? null };
    };
    /** r16 DEV: chữ khắc trên bục của bia hiện tại — t (giây từ lúc mọc) ghim để chụp; 'play' phát lại; trả trạng thái. */
    /** r16 DEV: việc nền còn dở (số lần nung đang chờ / chạy). */
    vm.cinemaBusy = () => S.bgBusy;
    /** r16 DEV: thời gian (ms) từng lát của các lần nung gần nhất; reset = true → xoá. */
    vm.cinemaPreheatStats = (reset = false) => {
      const out = preheatStats.slice(-12);
      if (reset) preheatStats.length = 0;
      return out;
    };
    /**
     * DEV (r21): ước lượng bộ nhớ GPU từ texture + geometry ĐANG SỐNG trên GPU của renderer này: mọi bản gốc trong cache
     * loader (LOD0/1/2) + cảnh (bục, sàn, gương…) + bản đồ chữ khắc. Texture chỉ tính khi đã lên GPU; texture nén = byte
     * dữ liệu mip thật; geometry = byte các thuộc tính + index (chỉ tính lưới đã vẽ ít nhất một lần).
     */
    /** DEV (r21): lượt gương vẽ bản LOD1 thay LOD0 (true, mặc định) / như cũ (false) — so sánh ảnh + thời gian GPU. */
    vm.cinemaMirrorLod = (on) => {
      if (on !== undefined) {
        S.mirrorLod = !!on;
        reflector.invalidate();
        requestRender('dev');
      }
      return { on: S.mirrorLod, live: !!S.live?.lo };
    };
    vm.cinemaGpuEstimate = () => {
      const texSeen = new Set();
      const geoSeen = new Set();
      let tex = 0;
      let geo = 0;
      const texBytes = (t) => {
        if (!t || texSeen.has(t)) return 0;
        texSeen.add(t);
        const p = renderer.properties.get(t);
        if (!p?.__webglTexture) return 0;
        if (t.isCompressedTexture && t.mipmaps?.length) return t.mipmaps.reduce((a, m) => a + (m.data?.byteLength ?? 0), 0) || t.image.width * t.image.height * (4 / 3);
        const w = t.image?.width ?? t.width ?? 0;
        const h = t.image?.height ?? t.height ?? 0;
        return w * h * 4 * (t.generateMipmaps || t.minFilter >= THREE.NearestMipmapNearestFilter ? 4 / 3 : 1);
      };
      const geoBytes = (g) => {
        if (!g || geoSeen.has(g)) return 0;
        geoSeen.add(g);
        let b = g.index?.array?.byteLength ?? 0;
        for (const k in g.attributes) b += g.attributes[k].array?.byteLength ?? 0;
        return b;
      };
      const walk = (root) =>
        root.traverse((o) => {
          if (!o.isMesh) return;
          geo += geoBytes(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (!m) continue;
            for (const k of [...TEX_KEYS, 'envMap', 'alphaMap']) tex += texBytes(m[k]);
          }
        });
      const byLod = { 0: 0, 1: 0, 2: 0 };
      const counts = { 0: 0, 1: 0, 2: 0 };
      for (const r of residentRoots()) {
        const t0 = tex;
        const g0 = geo;
        walk(r.root);
        // texture đẩy theo dải (bản đích trên GPU thay cho texture gốc của bản gốc này)
        r.root.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of TEX_KEYS) if (m[k] && stripTex.get(m[k])?.dst) tex += texBytes(stripTex.get(m[k]).dst);
        });
        byLod[r.lod] += tex - t0 + (geo - g0);
        counts[r.lod]++;
      }
      walk(scene);
      for (const g of reliefGpu.values()) {
        tex += texBytes(g.normal);
        tex += texBytes(g.color);
      }
      const MB = (v) => +(v / 2 ** 20).toFixed(1);
      return { totalMB: MB(tex + geo), texMB: MB(tex), geoMB: MB(geo), byLodMB: { 0: MB(byLod[0]), 1: MB(byLod[1]), 2: MB(byLod[2]) }, resident: counts, info: { ...renderer.info.memory } };
    };
    /** DEV (r19): cửa sổ chữ khắc — bản GPU đang giữ (sẵn chưa, lát đẩy lâu nhất), trạng thái chữ hai khay. */
    vm.cinemaRelief = () => ({
      cacheMax: RELIEF_CACHE_MAX,
      win: { target: S.reliefWin.target?.id ?? null, near: S.reliefWin.near.map((e) => e.id), far: S.reliefWin.far.map((e) => e.id) },
      gpu: [...reliefGpu].map(([it, g]) => ({ id: it.key.split('|')[0], ready: g.ready, maxMs: +g.maxMs.toFixed(2), lane: it.lane, fast: !!g.fast })),
      gpuMB: +([...reliefGpu.keys()].reduce((a, it) => a + (it.normal.image.width + it.color.image.width) * 256 * 4 * (4 / 3), 0) / 2 ** 20).toFixed(1),
      slots: [0, 1].map((i) => ({ id: slotEntry[i]?.id ?? null, text: pedestals[i].textState, relief: pedestals[i].relief?.key.split('|')[0] ?? null, cur: i === S.cur })),
    });
    vm.cinemaTextGrow = (t) => {
      const pd = pedestals[S.cur];
      if (t === 'play') {
        pd.textHide();
        pd.textPlay();
      } else if (t === 'hide') pd.textHide();
      else if (Number.isFinite(t)) pd.textPin(t);
      requestRender('dev');
      return pd.textState;
    };
    /**
     * r22 — ghi vết độ sáng lòng bục TỪNG KHUNG (đọc điểm ảnh ngay sau lượt vẽ): ~450 điểm cố định trên đĩa gương của mỗi
     * khay (theo đĩa khi nó trượt), trung bình độ sáng cả đĩa + nửa trước (phía camera — nơi ảnh phản chiếu nằm).
     * cinemaDishTrace({ crops }) bật; cinemaDishTrace(false) tắt và trả các khung.
     */
    /** r24 DEV: khung bục đang xem trên màn hình (px CSS) — vòng ngoài ở sàn và ở mép trên — để đặt dòng thời gian. */
    vm.cinemaPedestalRect = () => {
      const r = renderer.domElement.getBoundingClientRect();
      const pd = pedestals[S.cur];
      pd.group.updateWorldMatrix(true, false);
      const R = pd.rimR ?? pd.dishR / 0.755;
      let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
      for (const h of [0, pd.lift]) {
        for (let k = 0; k < 64; k++) {
          const a = (k / 64) * Math.PI * 2;
          _dp.set(Math.cos(a) * R, h, Math.sin(a) * R).applyMatrix4(pd.group.matrixWorld).project(camera);
          const x = r.left + ((_dp.x + 1) / 2) * r.width;
          const y = r.top + ((1 - _dp.y) / 2) * r.height;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      return { x0: Math.round(x0), x1: Math.round(x1), y0: Math.round(y0), y1: Math.round(y1), vw: r.width, vh: r.height };
    };
    /** r24: trạng thái gương hai khay + khung đĩa trên màn hình (px CSS) — cho ghi hình / cắt ảnh theo đĩa. */
    vm.cinemaMirrorDebug = () => {
      const r = renderer.domElement.getBoundingClientRect();
      return mirrors.map((m, i) => {
        if (!slots[i].visible || !m.mesh.visible) return { i, visible: false };
        m.mesh.updateWorldMatrix(true, false);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2;
          _dp.set(Math.cos(a), Math.sin(a), 0).applyMatrix4(m.mesh.matrixWorld).project(camera);
          const x = r.left + ((_dp.x + 1) / 2) * r.width;
          const y = r.top + ((1 - _dp.y) / 2) * r.height;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        const sh = [S.live, S.retiring].find((s) => s?.slot === slots[i]);
        return { i, cur: i === S.cur, visible: true, op: +(slots[i].userData.__opacity ?? 1).toFixed(3), rect: [x0, y0, x1, y1].map((v) => Math.round(v)), fit: m.fitRect, rt: m.renderTargetSize, passes: m.passes, lo: !!sh?.lo, id: sh?.id ?? null };
      });
    };
    /** r24 DEV: { fit, cull, oblique } — tắt khớp khung / frustum culling của bia / sửa mặt phẳng cắt xiên (so sánh). */
    vm.cinemaMirrorTest = ({ fit = true, cull = true, oblique = true, flip = true } = {}) => {
      for (const m of mirrors) {
        m.setFitEnabled(fit);
        m.setObliqueFix(oblique);
        m.setMirrorX(flip);
      }
      for (const sl of slots) sl.traverse((o) => { if (o.isMesh) { o.userData.__fc ??= o.frustumCulled; o.frustumCulled = cull ? o.userData.__fc : false; } });
      reflector.invalidate();
      return { fit, cull, oblique, flip };
    };
    /** r24 DEV: toạ độ clip (lượt gương gần nhất) của 8 góc hộp bao bia trên khay i — góc nào bị mặt phẳng nào cắt. */
    vm.cinemaMirrorClip = (i = S.cur) => {
      const sh = [S.live, S.retiring].find((x) => x?.slot === slots[i]);
      if (!sh) return null;
      const box = new THREE.Box3().setFromObject(sh.inst);
      const vc = mirrors[i].mesh.camera;
      const M = new THREE.Matrix4().multiplyMatrices(vc.projectionMatrix, vc.matrixWorldInverse);
      const out = [];
      for (let k = 0; k < 8; k++) {
        const v = new THREE.Vector4(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z, 1).applyMatrix4(M);
        out.push([v.x / v.w, v.y / v.w, v.z / v.w, v.w].map((x) => +x.toFixed(3)));
      }
      // đỉnh thật (lấy mẫu) của bản đang được vẽ trong lượt gương (lo nếu có, không thì inst)
      const src = sh.lo ?? sh.inst;
      src.updateWorldMatrix(true, true);
      const cnt = { n: 0, inside: 0, far: 0, near: 0, side: 0 };
      const v = new THREE.Vector4();
      src.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 3000));
        for (let k = 0; k < pos.count; k += step) {
          v.set(pos.getX(k), pos.getY(k), pos.getZ(k), 1).applyMatrix4(o.matrixWorld).applyMatrix4(M);
          cnt.n++;
          const x = v.x / v.w, y = v.y / v.w, z = v.z / v.w;
          if (z > 1) {
            cnt.far++;
            if (Math.abs(x) <= 1 && Math.abs(y) <= 1) cnt.farIn = (cnt.farIn ?? 0) + 1;
          }
          else if (z < -1) cnt.near++;
          else if (Math.abs(x) > 1 || Math.abs(y) > 1) cnt.side++;
          else cnt.inside++;
        }
      });
      return { P: Array.from(vc.projectionMatrix.elements, (x) => +x.toFixed(4)), corners: out, verts: cnt, src: sh.lo ? 'lo' : 'inst' };
    };
    /**
     * r74 DEV: ảnh CHÍNH DIỆN TRỰC GIAO của bia hiện tại (chỉ bia, đèn chiếu xiên cho rõ nét khắc) → dataURL + khung toạ độ bia
     * (lift-local) của ảnh — để khớp bản dập với khung khắc trên mặt đá (vẽ chồng, dò toạ độ khung).
     */
    vm.cinemaOrthoFront = ({ w = 900, pad = 0.02, yFrom = null, light = 'rake' } = {}) => {
      if (!S.live) return null;
      const B = bounds;
      const x0 = B.slabL - pad;
      const x1 = B.slabR + pad;
      // (r81: yFrom 'min' = từ chân mô hình — cả rùa / đế, để dò khung chữ mà không phụ thuộc bandBottom)
      const y0 = yFrom === 'min' ? B.yMin : yFrom ?? B.bandBottom - 0.06;
      const y1 = B.yMax + pad;
      const h = Math.round((w * (y1 - y0)) / (x1 - x0));
      const qs = new THREE.Scene();
      const clone = S.live.inst.clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.scale.set(1, 1, 1);
      clone.updateMatrixWorld(true);
      qs.add(clone);
      // r81: light 'depth' = ảnh ĐỘ SÂU (z toạ độ bia) thay màu: R = z chuẩn hoá trong [zFront − 0,25, zFront + 0,75], G = phần lẻ
      // (độ phân giải ~4 µm) — tách mặt bia (phẳng) khỏi rùa / đầu rùa / đế (nhô ra trước)
      let depthMat = null;
      if (light === 'depth') {
        depthMat = new THREE.ShaderMaterial({
          uniforms: { zLo: { value: B.zFront - 0.25 }, zHi: { value: B.zFront + 0.75 } },
          vertexShader: 'varying float vz; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vz = wp.z; gl_Position = projectionMatrix * viewMatrix * wp; }',
          fragmentShader: 'uniform float zLo; uniform float zHi; varying float vz; void main(){ float t = clamp((vz - zLo) / (zHi - zLo), 0.0, 1.0) * 255.0; gl_FragColor = vec4(floor(t) / 255.0, fract(t), 0.0, 1.0); }',
        });
        qs.overrideMaterial = depthMat;
      }
      qs.add(new THREE.AmbientLight(0xffffff, light === 'flat' ? 2.2 : 0.55));
      if (light !== 'flat' && light !== 'depth') {
        const d = new THREE.DirectionalLight(0xffffff, 2.4);
        d.position.set(-0.8, 1.2, 1.6);
        qs.add(d);
      }
      const cam = new THREE.OrthographicCamera(x0, x1, y1, y0, 0.01, 10);
      cam.position.set(0, 0, 3);
      cam.lookAt(0, 0, 0);
      // (khối bao chỉ gồm mô hình, không nâng / xoay — toạ độ ảnh = toạ độ bia)
      cam.position.set(0, 0, 3);
      // (độ sâu: đích tuyến tính — đích sRGB mã hoá lại byte khi ghi)
      const rt = new THREE.WebGLRenderTarget(w, h, depthMat ? {} : { colorSpace: THREE.SRGBColorSpace });
      const prev = renderer.getRenderTarget();
      const prevTone = renderer.toneMapping;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(qs, cam);
      const buf = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      renderer.setRenderTarget(prev);
      renderer.toneMapping = prevTone;
      rt.dispose();
      if (depthMat) depthMat.dispose();
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const id = new ImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w * 4; x++) id.data[y * w * 4 + x] = x % 4 === 3 ? 255 : buf[(h - 1 - y) * w * 4 + x];
      cv.getContext('2d').putImageData(id, 0, 0);
      requestRender?.('dev');
      return { w, h, url: cv.toDataURL('image/png'), rect: { x0, x1, y0, y1 }, depth: depthMat ? { zLo: B.zFront - 0.25, zHi: B.zFront + 0.75 } : null, head: S.live.head ? { c: [...S.live.head.center], r: S.live.head.radius } : null, bounds: { slabL: B.slabL, slabR: B.slabR, bandTop: B.bandTop, bandBottom: B.bandBottom, yMax: B.yMax, yMin: B.yMin, zFront: B.zFront } };
    };
    /** r24: nội dung render target gương khay i (dataURL) — xem ảnh phản chiếu THẬT được vẽ gì. */
    vm.cinemaMirrorPeek = (i = S.cur) => {
      const rt = mirrors[i].mesh.getRenderTarget();
      const w = rt.width, h = rt.height;
      const buf = new Uint8Array(w * h * 4);
      // RT gương là MSAA → chép texture đã resolve sang một RT thường bằng một quad rồi mới đọc
      const tmp = new THREE.WebGLRenderTarget(w, h);
      const qs = new THREE.Scene();
      const qm = new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false, transparent: false });
      qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), qm));
      const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(tmp);
      renderer.render(qs, qc);
      renderer.readRenderTargetPixels(tmp, 0, 0, w, h, buf);
      renderer.setRenderTarget(prev);
      tmp.dispose();
      qm.dispose();
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const id = new ImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w * 4; x++) id.data[y * w * 4 + x] = x % 4 === 3 ? 255 : Math.min(255, buf[(h - 1 - y) * w * 4 + x] * 3);
      cv.getContext('2d').putImageData(id, 0, 0);
      return { w, h, url: cv.toDataURL() };
    };
    vm.cinemaDishTrace = (opt = {}) => {
      if (opt === false) {
        const out = S.devDish;
        S.devDish = null;
        return out;
      }
      S.devDish = { t0: performance.now(), rows: [], crops: opt.crops ? [] : null, cropW: opt.cropW ?? 200, passes: mirrors.map((m) => m.passes) };
      return true;
    };
    /** Ghim tỉ lệ render target gương lòng bục (1 = như trước r15); null = tự động theo độ cận camera. */
    vm.cinemaMirrorScale = (k = null) => {
      S.mirrorScalePin = k == null ? null : THREE.MathUtils.clamp(Number(k) || 1, 0.25, 1);
      syncMirrorScale();
      return S.mirrorScaleNow;
    };
  }
  return {
  };
}
