// Sân khấu Điện ảnh › phản chiếu + bóng: gương lòng bục (mỗi bục một đĩa), bóng tiếp xúc, hồ sáng sàn, đĩa hứng bóng đèn rọi.
//
// Gương chỉ vẽ lại khi camera / bia / bục đổi; lượt gương dùng bản LOD1 (nhẹ) của bia (r21).
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): devDish, devMirrorMode, disposed, devContactOff, reflBase, dishGlass, fresnelRef, mirrorScaleNow, mirrorScalePin,
//   mirrorLod
// Đọc / ghi S của nơi khác: catchMat, pedestalOn, catcher, live, retiring, tx, cur, rubOn, frameNo
import * as THREE from 'three';
import { cachedRoot, disposeInstance } from '../../../core/loader.js';
import { createReflectiveFloor } from '../../../core/reflective-floor.js';
import { DEFAULTS, getSettings } from '../../../core/settings.js';
import { createContactShadows } from '../contact.js';
import { RIPPLE_DRIFT, RIPPLE_REFL_PX, rippleSizeM, rippleTexture } from '../ripple.js';
import {
  DISH_EPS, DISH_FULL_FAR, DISH_FULL_NEAR, DISH_RT_MAX, DISH_RT_SCALE, DITHER_GLSL, FLOOR_R, clampNum,
  makePoolMaterial, schlick
} from './config.js';

export function installReflect(S, K, deps) {
  const {
    applyIdleLighting, camera, catchU, lifts, pedestals, renderer, requestRender, scene, slots, view
  } = deps;

  // ---- Lòng bục phản chiếu: mỗi bục một đĩa gương gắn vào nhóm của CHÍNH bục đó (đi theo bục qua
  // lắc ngược + mọi hiệu ứng chuyển cảnh). Lượt gương của bục i chỉ vẽ khay của nó (ẩn khay kia) →
  // lúc chuyển cảnh hai bục cùng phản chiếu, mỗi lượt chỉ tốn một tấm bia; lúc rảnh chỉ khay đang
  // hiện là thấy được → một lượt, và chỉ khi camera / bia / bục đổi (track = lift của khay).
  const dishStrength = (s) => (S.pedestalOn ? THREE.MathUtils.clamp(Number(s.reflection) || 0, 0, 1) : 0);
  // r63: mặt lòng bục gợn nhẹ (ripple.js) — cùng một bản đồ vân + độ trôi cho cả hai bục (gương + vật liệu lòng bục)
  const rip = { k: -1, sizeM: 0, drift: false, off: new THREE.Vector2(), tex: null };
  const mirrors = [0, 1].map((i) => {
    const m = createReflectiveFloor(renderer, scene, camera, {
      parent: pedestals[i].group,
      y: pedestals[i].lift + DISH_EPS,
      radius: 1, // co giãn theo bán kính lòng bục (syncMirrors)
      fade: 0, // không mờ mép
      blend: 'add',
      sharp: true,
      fitToScreen: { max: DISH_RT_MAX, scale: DISH_RT_SCALE },
      samples: 4, // gương nét → khử răng cưa ở mép chân rùa
      interval: 1, // có gì động là vẽ lại NGAY khung đó — ảnh phản chiếu không bao giờ trễ nhịp bia
      // DEV: so sánh với cách cũ (cách 4 khung mới vẽ lại) — __vm.cinemaMirrorMode('throttled')
      gate: import.meta.env.DEV ? () => devMirrorGate() : null,
      strength: dishStrength(getSettings()),
      track: lifts[i],
      exclude: () => (K.glyphFx ? [slots[1 - i], K.glyphFx] : [slots[1 - i]]), // r82b: sprite chữ Hán không soi xuống gương
      swap: () => mirrorPairs(i), // r21: lượt gương vẽ bản LOD1 (nhẹ) thay LOD0 của bia trên khay này
      renderOrder: 1, // sau mặt đá lòng bục, trước decal bóng tiếp xúc (2)
      name: 'cinema-dish-mirror',
      ripple: true, // r63: chương trình có nhánh gợn (độ nhăn 0 → bỏ qua)
    });
    // Nền đặc của view: chỉ trong lượt gương mới bỏ nền và xoá bằng alpha 0 → độ phủ (alpha) chỉ có
    // ở những gì thực sự nằm trên lòng bục, phần còn lại cộng 0.
    // r38: vòng brush + lung linh / vệt loé mở khoá của chế độ xoa (vẽ trong shader đá) KHÔNG soi xuống gương — tắt tạm
    // trong lượt gương (hideHelpers), lượt chính vẫn thấy như cũ.
    const inner = m.mesh.onBeforeRender;
    m.mesh.onBeforeRender = function (rnd, scn, cam, geo, mat, grp) {
      // r40: tay đang điều khiển (body[data-hand-active]) + đang lướt → gương vẽ lại CÁCH KHUNG, nhường GPU cho nhận diện
      // tay. Khung bỏ qua giữ ảnh + ma trận chiếu của khung trước (cờ "cần vẽ" còn nguyên → khung sau vẽ): ảnh gắn theo
      // đĩa, bia đi cùng bục nên không lệch nhau — chỉ thị sai của camera trôi chậm trong một khung.
      if (S.tx && (S.frameNo & 1) === 1 && document.body.dataset.handActive === '1') return;
      const bg = scn.background;
      const alpha = rnd.getClearAlpha();
      scn.background = null;
      rnd.setClearAlpha(0);
      const restoreHelpers = hideRubHelpers();
      try {
        inner.call(this, rnd, scn, cam, geo, mat, grp);
      } finally {
        scn.background = bg;
        rnd.setClearAlpha(alpha);
        restoreHelpers?.();
      }
    };
    return m;
  });
  /** r38: tắt tạm nét trợ giúp của chế độ xoa trên các bia đang ở sân khấu (lượt gương) → hàm khôi phục | null. */
  function hideRubHelpers() {
    const a = S.live?.polish?.hideHelpers() ?? null;
    const b = S.retiring?.polish && S.retiring.polish !== S.live?.polish ? S.retiring.polish.hideHelpers() : null;
    if (!a && !b) return null;
    return () => {
      a?.();
      b?.();
    };
  }
  /** Đĩa gương khớp lòng bục hiện tại (cao độ + bán kính đổi theo cỡ bục). */
  function syncMirrors() {
    for (let i = 0; i < 2; i++) {
      const r = pedestals[i].dishR;
      mirrors[i].mesh.position.y = pedestals[i].lift + DISH_EPS;
      mirrors[i].mesh.scale.set(r, r, 1);
      mirrors[i].invalidate();
    }
    if (rip.tex) applyRipple(); // số ô vân trên một bán kính đĩa theo bán kính mới
  }
  /** r63: đẩy trạng thái gợn xuống vật liệu lòng bục + gương của hai bục (chỉ uniform). */
  function applyRipple() {
    rip.tex ??= rippleTexture(renderer);
    for (let i = 0; i < 2; i++) {
      pedestals[i].setRipple({ texture: rip.tex, strength: rip.k, sizeM: rip.sizeM, offset: rip.off });
      mirrors[i].setRipple({ texture: rip.tex, px: rip.k * RIPPLE_REFL_PX, scale: pedestals[i].dishR / rip.sizeM, offset: rip.off });
    }
  }
  /** r63: cài đặt "Mặt bục" — Độ nhăn (pedestalRipple), Kích thước gợn (pedestalRippleSize), Chuyển động nhẹ (pedestalRippleDrift). */
  function syncRipple(s) {
    const k = clampNum(Number(s.pedestalRipple), 0, 1, DEFAULTS.pedestalRipple);
    const sizeM = rippleSizeM(clampNum(Number(s.pedestalRippleSize), 0, 1, DEFAULTS.pedestalRippleSize));
    rip.drift = !!s.pedestalRippleDrift;
    if (k === rip.k && sizeM === rip.sizeM) return;
    rip.k = k;
    rip.sizeM = sizeM;
    applyRipple();
  }
  /**
   * r63: "Chuyển động nhẹ" — vân trôi rất chậm. CHỈ gọi ở khung ĐANG vẽ (stage tick, ngay trước lượt vẽ) → không bao giờ tự
   * xin vẽ: rảnh thì vân đứng yên, vẽ lại thì đi tiếp từ chỗ cũ (không nhảy). Bọc trong [0, 1) — vân lát kín.
   */
  function stepRipple(dt) {
    if (!rip.drift || rip.k <= 0) return;
    const d = Math.min(0.05, Math.max(0, dt)) * RIPPLE_DRIFT;
    rip.off.set((rip.off.x + d * 0.8) % 1, (rip.off.y + d * 0.6) % 1);
  }
  syncMirrors();
  // ---- Bóng tiếp xúc (contact.js): một decal cho mỗi khay, gắn vào bản sao bia lúc present().
  // DEV: 'throttled' = mô phỏng cách cũ (vẽ gương 1/4 số khung động, không MSAA) để đo so sánh.
  // DEV r22: ghi vết độ sáng lòng bục từng khung (vm.cinemaDishTrace)
  S.devDish = null;
  const _dp = new THREE.Vector3();
  const _dbuf = new THREE.Vector2();
  const DISH_PTS = (() => {
    const pts = [[0, 0]];
    for (let j = 0; j < 12; j++) {
      const r = ((j + 0.5) / 12) * 0.95;
      const n = Math.max(8, Math.round(72 * r));
      for (let k = 0; k < n; k++) pts.push([r * Math.cos((k / n) * Math.PI * 2), r * Math.sin((k / n) * Math.PI * 2)]);
    }
    return pts;
  })();
  function devDishSample(why) {
    const gl = renderer.getContext();
    renderer.getDrawingBufferSize(_dbuf);
    const W = _dbuf.x;
    const H = _dbuf.y;
    const row = { t: +(performance.now() - S.devDish.t0).toFixed(1), why, tx: S.tx ? +(S.tx.progress ?? 0).toFixed(4) : -1, cur: S.cur, scale: S.mirrorScaleNow, d: [] };
    for (let i = 0; i < 2; i++) {
      const m = mirrors[i];
      const passes = m.passes;
      const dp = passes - S.devDish.passes[i];
      S.devDish.passes[i] = passes;
      if (!slots[i].visible || !m.mesh.visible || !pedestals[i].group.visible) {
        row.d.push(null);
        continue;
      }
      m.mesh.updateWorldMatrix(true, false);
      const px = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [u, v] of DISH_PTS) {
        _dp.set(u, v, 0).applyMatrix4(m.mesh.matrixWorld).project(camera);
        const x = Math.floor(((_dp.x + 1) / 2) * W);
        const y = Math.floor(((_dp.y + 1) / 2) * H);
        px.push([x, y]);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (!(x1 >= x0 && y1 >= y0)) {
        row.d.push({ off: 1, dp });
        continue;
      }
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      const buf = new Uint8Array(bw * bh * 4);
      gl.readPixels(x0, y0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const cy = px[0][1];
      let sa = 0, na = 0, sf = 0, nf = 0, sr = 0, nr = 0;
      for (let q = 0; q < px.length; q++) {
        const [x, y] = px[q];
        if (x < x0 || y < y0 || x > x1 || y > y1) continue;
        const o = ((y - y0) * bw + (x - x0)) * 4;
        const L = (0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2]) / 255;
        sa += L;
        na++;
        if (y < cy) {
          sf += L;
          nf++;
          // vành ngoài nửa trước (r ≥ 0,7): chỉ mặt lòng bục, không dính rùa / bia
          if (Math.hypot(DISH_PTS[q][0], DISH_PTS[q][1]) >= 0.7) {
            sr += L;
            nr++;
          }
        }
      }
      const sh = [S.live, S.retiring].find((s) => s?.slot === slots[i]);
      row.d.push({
        L: +(sa / Math.max(1, na)).toFixed(4),
        F: nf ? +(sf / nf).toFixed(4) : null,
        R: nr ? +(sr / nr).toFixed(4) : null,
        n: na,
        dp,
        rt: m.renderTargetSize.join('x'),
        op: +(slots[i].userData.__opacity ?? 1).toFixed(3),
        lo: sh?.lo ? 1 : 0,
        lod: sh?.lod ?? null,
        x: Math.round((x0 + x1) / 2),
      });
      if (S.devDish.crops && i === S.cur) {
        const cw = Math.min(S.devDish.cropW, bw);
        const k = cw / bw;
        const ch = Math.max(1, Math.round(bh * k));
        const cv = document.createElement('canvas');
        cv.width = bw;
        cv.height = bh;
        const id = new ImageData(bw, bh);
        for (let yy = 0; yy < bh; yy++) id.data.set(buf.subarray((bh - 1 - yy) * bw * 4, (bh - yy) * bw * 4), yy * bw * 4);
        cv.getContext('2d').putImageData(id, 0, 0);
        const c2 = document.createElement('canvas');
        c2.width = cw;
        c2.height = ch;
        c2.getContext('2d').drawImage(cv, 0, 0, cw, ch);
        S.devDish.crops.push({ t: row.t, tx: row.tx, url: c2.toDataURL('image/png') });
      }
    }
    S.devDish.rows.push(row);
  }
  S.devMirrorMode = 'every';
  let devMirrorTick = 0;
  const devMirrorGate = () => S.devMirrorMode !== 'throttled' || (devMirrorTick++ & 3) === 0;
  const devRestore = []; // DEV: gỡ các móc đo khi rời view
  S.disposed = false; // preheat() trả promise: nướng xong sau khi view đã huỷ thì bỏ qua
  const contact = createContactShadows(renderer);
  const contactDecals = [contact.createDecal(), contact.createDecal()];
  S.devContactOff = false; // DEV: tune({ contact: false }) để chụp "trước"
  const syncContact = (s) => {
    const k = S.devContactOff ? 0 : clampNum(Number(s.contactShadow), 0, 1.5, DEFAULTS.contactShadow);
    for (const d of contactDecals) {
      d.setStrength(k);
      d.mesh.material.visible = k > 0; // ẩn hẳn (không draw call) khi tắt bóng tiếp xúc
    }
  };
  syncContact(getSettings());
  // Biên dịch trước những vật liệu chỉ hiện khi rê chuột / sau lần present đầu (đèn bục, gương lòng
  // bục, decal bóng tiếp xúc) — cả biến thể vẽ thẳng lẫn biến thể ghép ảnh chuyển cảnh — để lần
  // hover đầu tiên không phải biên dịch shader (compile duyệt cả vật đang ẩn).
  view.preheat(pedestals[0].group, scene, camera);
  view.preheat(contactDecals[0].mesh, scene, camera);
  // Giữ tên cũ cho mọi chỗ gọi "gương vẽ lại" trong file này.
  // Độ phản chiếu GỐC (settings.reflection, 0 khi tắt bục) — mỗi khung nhân thêm Fresnel theo góc nhìn
  // của từng bục khi lòng bục là kính (dishGlass > 0), xem syncMirrorFresnel().
  S.reflBase = 0;
  S.dishGlass = 0;
  S.fresnelRef = schlick(Math.sin(THREE.MathUtils.degToRad(14))); // góc nhìn xuống lòng bục ở khung mặc định (tính lại ở computeHome)
  const mirrorK = [-1, -1];
  const _mv = new THREE.Vector3();
  function syncMirrorFresnel(force = false) {
    for (let i = 0; i < 2; i++) {
      let k = S.reflBase;
      if (k > 0 && S.dishGlass > 0) {
        pedestals[i].group.getWorldPosition(_mv);
        _mv.y += pedestals[i].lift;
        _mv.subVectors(camera.position, _mv);
        const f = schlick(_mv.y / Math.max(1e-6, _mv.length())) / S.fresnelRef;
        k = THREE.MathUtils.clamp(k * (1 + (f - 1) * S.dishGlass), 0, 1);
      }
      if (force || Math.abs(k - mirrorK[i]) > 0.002) {
        if (mirrorK[i] <= 0 && k > 0) mirrors[i].invalidate(); // gương vừa bật lại: ảnh cũ đã lỗi thời
        mirrorK[i] = k;
        mirrors[i].setStrength(k);
      }
    }
  }
  // Tỉ lệ RT gương theo độ cận của camera (xem DISH_RT_SCALE). DEV: __vm.cinemaMirrorScale(k) ghim tỉ lệ, (null) = tự động.
  S.mirrorScaleNow = DISH_RT_SCALE;
  S.mirrorScalePin = null;
  function syncMirrorScale() {
    let k = S.mirrorScalePin;
    if (k == null) {
      const d = camera.position.distanceTo(K.controls.target) / Math.max(1e-6, K.home.dist);
      k = S.rubOn || d < (S.mirrorScaleNow === 1 ? DISH_FULL_FAR : DISH_FULL_NEAR) ? 1 : DISH_RT_SCALE;
    }
    if (k === S.mirrorScaleNow) return;
    S.mirrorScaleNow = k;
    for (const m of mirrors) m.setFitScale(k);
    reflector.invalidate();
  }
  const reflector = {
    invalidate() {
      for (const m of mirrors) m.invalidate();
      requestRender('mirror'); // gương chỉ vẽ lại trong lượt vẽ chính
    },
    setStrength(v) {
      S.reflBase = v;
      syncMirrorFresnel(true);
    },
    dispose() {
      for (const m of mirrors) m.dispose();
    },
  };

  const poolGeo = new THREE.CircleGeometry(FLOOR_R, 96);
  const poolMat = makePoolMaterial();
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.0008;
  pool.renderOrder = -2;
  pool.userData.noReflect = true; // nằm sát mặt gương — soi lại chỉ ra vệt bẩn
  scene.add(pool);

  // Đĩa hứng bóng của đèn rọi: ShadowMaterial × suy giảm nón của đèn tại điểm sàn (bóng chỉ có ở nơi
  // đèn rọi thật sự chiếu tới; shadow camera của spot là hình chóp VUÔNG ôm nón → không để lộ mép vuông).
  // Độ đậm (opacity) theo phần sáng đèn rọi — applyIdleLighting.
  const catchGeo = new THREE.CircleGeometry(FLOOR_R, 64);
  S.catchMat = new THREE.ShadowMaterial({ opacity: 0, color: 0x120d08 });
  S.catchMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, catchU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCatchW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvCatchW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSpotPos;\nuniform vec3 uSpotDir;\nuniform float uConeCos;\nuniform float uPenCos;\nvarying vec3 vCatchW;')
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        'float cone = smoothstep( uConeCos, uPenCos, dot( normalize( vCatchW - uSpotPos ), uSpotDir ) );\n\tgl_FragColor = vec4( color, opacity * cone * ( 1.0 - getShadowMask() ) );',
      )
      .replace('void main() {', DITHER_GLSL + '\nvoid main() {')
      // alpha nhân trước (trộn One / OneMinusSrcAlpha) + nhiễu dương ≈ 1/255 sau cùng: dải bóng mềm trên
      // hồ sáng tối không còn vòng bậc 8 bit.
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n\tgl_FragColor.rgb = gl_FragColor.rgb * gl_FragColor.a + cinDither() * smoothstep( 0.0, 0.01, gl_FragColor.a );');
  };
  S.catchMat.customProgramCacheKey = () => 'cinema-spot-catcher-v2';
  S.catchMat.blending = THREE.CustomBlending;
  S.catchMat.blendEquation = THREE.AddEquation;
  S.catchMat.blendSrc = THREE.OneFactor;
  S.catchMat.blendDst = THREE.OneMinusSrcAlphaFactor;
  // r19: KHÔNG ghi độ sâu. ShadowMaterial mặc định ghi → đĩa (y 0,0016) che mất bóng chân bục của pedestal.js
  // (y 0,0012, ngay dưới nó) mỗi khi thứ tự vẽ lớp trong suốt đặt đĩa TRƯỚC — thứ tự đó do độ sâu gốc vật thể quyết định:
  // camera hạ thấp nhìn ngang / hơi ngước (gốc đĩa xa hơn gốc bục) hoặc bục trượt về phía camera lúc Lướt → bóng chân
  // bục biến mất. Mọi lớp sàn chỉ là lớp phủ (không lớp nào cần độ sâu của đĩa); bục / bia vẫn che chúng như cũ.
  S.catchMat.depthWrite = false;
  S.catcher = new THREE.Mesh(catchGeo, S.catchMat);
  S.catcher.rotation.x = -Math.PI / 2;
  S.catcher.position.y = 0.0016;
  S.catcher.renderOrder = -1;
  S.catcher.receiveShadow = true;
  S.catcher.userData.noReflect = true;
  scene.add(S.catcher);
  applyIdleLighting(true); // độ đậm bóng sàn ban đầu (+ ẩn đĩa khi chưa có bóng)

  // ---- r21: bản LOD1 chỉ dùng trong lượt gương lòng bục -------------------------------------------------------
  // Ảnh phản chiếu trong lòng bục (mờ, tối, nửa độ phân giải) không phân biệt được LOD0 (~150k tam giác, 4096 + normal)
  // với LOD1 (25 %, 1024) → lượt gương vẽ bản LOD1 (ẩn ở mọi lượt khác). Không dùng lúc xoa đầu rùa (độ bóng vừa xoa
  // chỉ có trên bản chính). Bóng đổ vẫn từ LOD0 (VSM vẽ cả vật NHẬN bóng vào shadow map → không thay riêng được).
  S.mirrorLod = true;
  function mirrorPairs(i) {
    const out = [];
    if (!S.mirrorLod || S.rubOn) return out;
    for (const sh of [S.live, S.retiring]) if (sh?.lo && sh.slot === slots[i]) out.push([sh.inst, sh.lo]);
    return out;
  }
  function attachMirrorLod(shot) {
    if (!shot || (shot !== S.live && shot !== S.retiring)) return; // khay đã bỏ (drop gọi endReveal)
    detachMirrorLod(shot);
    if (!shot || shot.proxy || shot.reveal || (shot.lod ?? 0) !== 0 || !shot.id) return;
    const r1 = cachedRoot(shot.id, 1);
    // chỉ bản LOD1 đã nung (texture trên GPU, chương trình đã biên dịch) — không để lượt gương đầu tiên phải làm việc đó
    if (!r1 || !K.preparedRoots.has(r1)) return;
    const lo = K.prepareInstance(r1);
    lo.visible = false;
    lo.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = true;
    });
    const st = K.rubStateFor(lo, shot.id); // độ bóng đã xoa (từ bộ nhớ lưu) cũng có trong ảnh phản chiếu
    lo.userData.polish = st.polish;
    shot.lift.add(lo);
    shot.lo = lo;
    reflector.invalidate();
  }
  function detachMirrorLod(shot) {
    if (!shot?.lo) return;
    shot.lo.parent?.remove(shot.lo);
    disposeInstance(shot.lo);
    shot.lo = null;
  }
  return {
    _dp, _mv, attachMirrorLod, catchGeo, contact, contactDecals, detachMirrorLod, devDishSample, devRestore,
    dishStrength, mirrors, pool, poolGeo, poolMat, reflector, stepRipple, syncContact, syncMirrorFresnel, syncMirrorScale,
    syncMirrors, syncRipple, ripple: rip,
  };
}
