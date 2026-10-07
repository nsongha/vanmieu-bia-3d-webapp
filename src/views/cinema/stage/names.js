// Sân khấu Điện ảnh › tên người đỗ trên thân bia (lớp CSS3D) + đo độ sáng ô chữ khắc để chọn bảng màu tên.
//
// Một rig tên mỗi khay; độ sáng thật của ô chữ đo trên khung đã vẽ (không chặn — PBO), nhớ theo id bia.
//
// Tách cơ học từ stage.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem stage.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): namesOn, namesStyle, lumaAt, lumaMiss, lumaSig, devNamesLegacy, devInfoLegacy, lumaJob
// Đọc / ghi S của nơi khác: lightU, viewAz, selTarget, metricsCache, live, cur
import * as THREE from 'three';
import { getSettings } from '../../../core/settings.js';
import { createNamesRig, nameField } from '../names.js';
import { faceFieldOf } from '../../../data/index.js';
import { createCss3dLayer } from '../css3d.js';
import {
  ANG_FULL, ANG_ZERO, LUMA_INK, PLANE_EPS
} from './config.js';

export function installNames(S, K, deps) {
  const {
    applyIdleLighting, camera, devRender, fadeStep, opts, planes, renderer, scene, view
  } = deps;
  // Lớp CSS3D dùng chung cho các kiểu hiện thông tin — chỉ có khi view cấp phần tử chứa.
  const css3d = opts.css3dLayer ? createCss3dLayer({ container: opts.css3dLayer, camera }) : null;
  // Tên người đỗ trên thân bia (settings.cinemaNames): MỘT rig cho mỗi khay → đi cùng tấm bia
  // của khay đó qua mọi hiệu ứng chuyển cảnh.
  const namesRigs = css3d ? [0, 1].map(() => createNamesRig({ css3d, planeEps: PLANE_EPS })) : null;
  const slotEntry = [null, null];
  S.namesOn = !!getSettings().cinemaNames;
  S.namesStyle = getSettings().cinemaNamesStyle || 'auto'; // màu chữ tên: 'auto' | 'light' | 'ink' (namesStyleFor)
  // Độ sáng THẬT của ô chữ khắc (đo trên khung hình đã vẽ, sau tone mapping) — một lần mỗi bia,
  // nhớ theo id; đổi đèn/phơi sáng thì đo lại. Quyết định bảng màu tên: 'ink' hay 'light'.
  /** @type {Map<string, {luma:number, tone:'ink'|'light'}>} */
  const fieldLuma = new Map();
  S.lumaAt = 0; // thời điểm sẽ đo (0 = chưa hẹn)
  S.lumaMiss = null; // id bia mà lần đo gần nhất không đo được (ô tên ngoài khung) — xem tick()
  S.lumaSig = '';
  const _keyDir = new THREE.Vector3();

  // ---- Tương phản tên người đỗ (settings.cinemaNamesStyle 'auto' | 'light' | 'ink') ---------------
  // Độ sáng đá sau ô tên đo ở CẢ HAI trạng thái (chưa hover / hover, measureFieldLuma). Chỉ CHỮ đổi theo
  // ánh sáng — không tấm nền, không đèn, không làm sáng đá (người dùng: nền sau chữ trông giả, làm phẳng
  // ánh sáng đã đặt). Tự động: chọn chữ sáng (#fffaf3) hay mực (#1c130b) theo tỉ lệ tương phản CHỈ-CHỮ
  // cao hơn ở phân vị xấu nhất của trạng thái ĐÍCH (chữ sáng: vệt sáng p90; chữ mực: vệt tối p10), đổi cùng
  // nhịp đèn hover. Không đạt 4,5 : 1 thì vẫn là phương án chữ tốt nhất — báo số, không đắp nền cho đủ số.
  const NAME_Y = { light: 0.961, ink: 0.0074 }; // độ chói tương đối (WCAG) của màu chữ tên
  const ratioLight = (y) => (NAME_Y.light + 0.05) / (y + 0.05);
  const ratioInk = (y) => (y + 0.05) / (NAME_Y.ink + 0.05);
  let namesInk = -1; // mức trộn đang vẽ (0..1), -1 = chưa có
  S.devNamesLegacy = false; // DEV: vm.cinemaNamesLegacy(true) — tên kiểu cũ để chụp "trước"
  // DEV: vm.cinemaInfoLegacy(true) — ctx của kiểu hiện thông tin bỏ qua mặt phẳng được hỏi, trả số đo / góc
  // của bia HIỆN TẠI như trước r7 (để chụp "trước": tấm bình phong nhảy lúc chuyển cảnh).
  S.devInfoLegacy = false;
  /** Kiểu chữ tên cho một trạng thái đo (idle / hover): 1 = mực, 0 = sáng. */
  const inkFor = (T) => (ratioInk(T.p10) > ratioLight(T.p90) ? 1 : 0);
  function namesStyleFor(id, dt) {
    const L = id ? fieldLuma.get(id) : null;
    let wantInk;
    if (S.namesStyle === 'ink') wantInk = 1;
    else if (S.namesStyle === 'light') wantInk = 0;
    else if (L?.idle) wantInk = inkFor(S.selTarget ? L.hover : L.idle);
    else wantInk = L ? (L.tone === 'ink' ? 1 : 0) : 0;
    if (namesInk < 0) namesInk = wantInk;
    namesInk = fadeStep(namesInk, wantInk, dt);
    return namesInk;
  }

  /** Dựng tên người đỗ cho khay i theo bia + số đo hiện tại (chỉ khay đang hiển thị). */
  function buildNames(i) {
    if (!namesRigs || !S.namesOn || !S.live || i !== S.cur) return;
    const M = planes[i].M;
    const m = steleMetrics();
    if (!M || !m || !slotEntry[i]) return;
    const known = fieldLuma.get(slotEntry[i].id);
    namesRigs[i].setTone(known ? known.tone : 'light');
    namesRigs[i].build(slotEntry[i], m, M.worldPerPx);
  }

  /**
   * Đo độ sáng ô chữ khắc của bia hiện tại trên CHÍNH khung vừa vẽ (gọi ngay sau renderer.render,
   * trước khi trình duyệt ghép khung → đọc được bộ đệm vẽ dù preserveDrawingBuffer = false).
   * Hình chữ nhật chiếu của ô (co vào 10%), độ chói tương đối (sRGB → tuyến tính → Y) ở hai trạng thái đèn.
   * r16: KHÔNG chặn luồng — hai lượt vẽ đo + lượt trả lại chỉ vẽ trong ô (scissor), điểm ảnh đọc vào bộ đệm PBO
   * (readPixels không đồng bộ) kèm fence; các khung sau hỏi fence (pollFieldLuma), có kết quả mới đọc ra — không có
   * lần chờ GPU nào trên luồng chính. Cùng đường vẽ, cùng điểm ảnh → kết quả y hệt cách đo đồng bộ cũ
   * (measureFieldLumaSync, DEV: __vm.cinemaFieldLumaCheck()).
   */
  const _fp = new THREE.Vector3();
  /** Ô tên của bia hiện tại trên bộ đệm vẽ (px, gốc dưới-trái) — null nếu ngoài khung / quá nhỏ. */
  function fieldRect() {
    const m = steleMetrics();
    if (!m) return null;
    const F = nameField(m);
    const g = planes[S.cur].group;
    g.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    const W = renderer.domElement.width;
    const H = renderer.domElement.height;
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by0 = Infinity;
    let by1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      _fp.set(k & 1 ? F.x1 : F.x0, k & 2 ? F.y1 : F.y0, 0).applyMatrix4(g.matrixWorld).project(camera);
      const px = ((_fp.x + 1) / 2) * W;
      const py = ((_fp.y + 1) / 2) * H; // gốc GL ở dưới-trái
      bx0 = Math.min(bx0, px);
      bx1 = Math.max(bx1, px);
      by0 = Math.min(by0, py);
      by1 = Math.max(by1, py);
    }
    const insetX = (bx1 - bx0) * 0.1;
    const insetY = (by1 - by0) * 0.1;
    const x = Math.max(0, Math.floor(bx0 + insetX));
    const y = Math.max(0, Math.floor(by0 + insetY));
    const w = Math.min(W - x, Math.ceil(bx1 - bx0 - 2 * insetX));
    const h = Math.min(H - y, Math.ceil(by1 - by0 - 2 * insetY));
    return w > 4 && h > 4 ? { x, y, w, h } : null;
  }
  const lin255 = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  // r64: bảng tra sRGB 8 bit → tuyến tính (đã nhân hệ số Y của từng kênh) + biểu đồ tần suất cho phân vị — không còn mảng số
  // thực + sort (15–30 ms mỗi lần đo ở 1440, 51–69 ms ở 4K — lúc hạ bia sau mỗi lượt lướt)
  const LUT_R = new Float32Array(256);
  const LUT_G = new Float32Array(256);
  const LUT_B = new Float32Array(256);
  for (let c = 0; c < 256; c++) {
    const l = lin255(c);
    LUT_R[c] = 0.2126 * l;
    LUT_G[c] = 0.7152 * l;
    LUT_B[c] = 0.0722 * l;
  }
  const HIST_N = 4096;
  const hist = new Uint32Array(HIST_N);
  /** Trung bình + phân vị 10 / 90 % độ chói (đá lốm đốm: chữ mực vướng vệt TỐI, chữ sáng vướng vệt SÁNG). step: bước điểm ảnh. */
  function lumaStats(buf, step = 3) {
    hist.fill(0);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < buf.length; i += 4 * step) {
      const y = LUT_R[buf[i]] + LUT_G[buf[i + 1]] + LUT_B[buf[i + 2]];
      sum += y;
      hist[Math.min(HIST_N - 1, (y * HIST_N) | 0)]++;
      n++;
    }
    const q = (f) => {
      const k = Math.floor(f * Math.max(0, n - 1));
      let acc = 0;
      for (let b = 0; b < HIST_N; b++) {
        acc += hist[b];
        if (acc > k) return (b + 0.5) / HIST_N;
      }
      return 0;
    };
    const mean = sum / Math.max(1, n);
    return { mean: +mean.toFixed(4), p10: +q(0.1).toFixed(4), p90: +q(0.9).toFixed(4) };
  }
  const lumaResult = (idleL, hoverL) => ({ luma: idleL.mean, tone: idleL.mean > LUMA_INK ? 'ink' : 'light', idle: idleL, hover: hoverL });
  /**
   * Vẽ lại ô tên ở mức đèn hover u rồi (read) đọc nó. Chỉ vẽ trong ô (scissor, lề 2 px) — phần còn lại của khung vừa vẽ
   * giữ nguyên; lượt vẽ cuối (u = mức đang có) trả ô về đúng khung đang hiển thị.
   */
  function renderFieldAt(u, R, read) {
    S.lightU = u;
    applyIdleLighting(true);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    read?.();
  }
  function withFieldScissor(R, fn) {
    const pr = renderer.getPixelRatio();
    const sc = renderer.getScissorTest();
    const sm = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false; // bóng đã vẽ ở lượt chính của khung này
    renderer.setScissorTest(true);
    renderer.setScissor((R.x - 2) / pr, (R.y - 2) / pr, (R.w + 4) / pr, (R.h + 4) / pr);
    const keepU = S.lightU;
    try {
      fn();
    } finally {
      S.lightU = keepU;
      renderFieldAt(keepU, R); // ô tên trở lại đúng trạng thái đang hiển thị
      renderer.setScissorTest(sc);
      renderer.setScissor(0, 0, view.width, view.height);
      renderer.shadowMap.needsUpdate = sm;
    }
  }
  S.lumaJob = null; // { id, fence, pbo: [WebGLBuffer, WebGLBuffer], n } — đang chờ GPU
  let lumaPbo = null; // hai bộ đệm PBO dùng lại (cỡ theo lần đo lớn nhất)
  let lumaPboBytes = 0;
  /**
   * r64: số HÀNG điểm ảnh đọc trong ô tên (cách đều) — thay cho cả ô: bộ đệm đọc về nhỏ đi ~R.h / LUMA_ROWS lần (ô cao ~900
   * hàng ở 1440, ~2000 ở 4K) mà vẫn đúng các điểm ảnh của khung đã vẽ (cùng tone mapping / sRGB — không đổi thang đo).
   */
  const LUMA_ROWS = 36;
  /** Bắt đầu đo (không chặn). Trả false nếu không đo được (ô ngoài khung / trình duyệt thiếu WebGL2 fence). */
  function startFieldLuma() {
    const id = slotEntry[S.cur]?.id;
    const R = id ? fieldRect() : null;
    if (!R) return false;
    const gl = renderer.getContext();
    if (typeof gl.fenceSync !== 'function' || !gl.PIXEL_PACK_BUFFER) return !!measureFieldLumaSync();
    const rows = Math.min(R.h, LUMA_ROWS);
    const n = R.w * rows * 4;
    if (!lumaPbo || lumaPboBytes < n) {
      if (lumaPbo) for (const b of lumaPbo) gl.deleteBuffer(b);
      lumaPbo = [gl.createBuffer(), gl.createBuffer()];
      for (const b of lumaPbo) {
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, b);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, n, gl.STREAM_READ);
      }
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      lumaPboBytes = n;
    }
    const readInto = (b) => () => {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, b);
      // r64: LUMA_ROWS hàng cách đều (mỗi hàng một lệnh đọc không đồng bộ vào PBO, nối tiếp nhau)
      for (let k = 0; k < rows; k++) {
        const y = R.y + Math.min(R.h - 1, Math.floor(((k + 0.5) * R.h) / rows));
        gl.readPixels(R.x, y, R.w, 1, gl.RGBA, gl.UNSIGNED_BYTE, k * R.w * 4);
      }
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    };
    withFieldScissor(R, () => {
      renderFieldAt(0, R, readInto(lumaPbo[0]));
      renderFieldAt(1, R, readInto(lumaPbo[1]));
    });
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    S.lumaJob = { id, fence, n, t0: performance.now() };
    return true;
  }
  /** Mỗi khung: fence đã qua → đọc hai PBO (không chờ) → kết quả cho bảng màu tên. */
  function pollFieldLuma() {
    if (!S.lumaJob) return;
    const gl = renderer.getContext();
    const st = gl.clientWaitSync(S.lumaJob.fence, 0, 0);
    if (st === gl.TIMEOUT_EXPIRED) return;
    gl.deleteSync(S.lumaJob.fence);
    const job = S.lumaJob;
    S.lumaJob = null;
    if (st === gl.WAIT_FAILED) return;
    const tRead = performance.now();
    const buf = new Uint8Array(job.n);
    const read = (b) => {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, b);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, buf, 0, job.n);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return lumaStats(buf, 1); // (hàng đã thưa — lấy mọi điểm ảnh của hàng)
    };
    const idleL = read(lumaPbo[0]);
    const hoverL = read(lumaPbo[1]);
    if (devRender) devRender.lumaReadMs = +(performance.now() - tRead).toFixed(2);
    fieldLuma.set(job.id, lumaResult(idleL, hoverL));
    if (devRender) devRender.lumaMs = +(performance.now() - job.t0).toFixed(1);
  }
  /** Cách đo ĐỒNG BỘ cũ (trước r16) — dự phòng khi không có fence, và để DEV so kết quả. */
  function measureFieldLumaSync({ store = true } = {}) {
    const id = slotEntry[S.cur]?.id;
    const R = id ? fieldRect() : null;
    if (!R) return null;
    const gl = renderer.getContext();
    const buf = new Uint8Array(R.w * R.h * 4);
    let idleL = null;
    let hoverL = null;
    withFieldScissor(R, () => {
      renderFieldAt(0, R, () => gl.readPixels(R.x, R.y, R.w, R.h, gl.RGBA, gl.UNSIGNED_BYTE, buf));
      idleL = lumaStats(buf);
      renderFieldAt(1, R, () => gl.readPixels(R.x, R.y, R.w, R.h, gl.RGBA, gl.UNSIGNED_BYTE, buf));
      hoverL = lumaStats(buf);
    });
    const res = lumaResult(idleL, hoverL);
    if (store) fieldLuma.set(id, res);
    return res;
  }

  /**
   * Hệ số hiện theo góc nhìn cho MỘT mặt phẳng khay (cùng luật với angleFactor(), nhưng tính từ
   * ma trận thật của khay → đúng cả khi hiệu ứng chuyển cảnh xoay/dời riêng khay đó).
   */
  function planeAngle(m, ly = 0) {
    const e = m.elements;
    const nl = Math.hypot(e[8], e[9], e[10]) || 1;
    // điểm đo: (0, ly, 0) của mặt phẳng — ly = LINE_Y của bia thì trùng đúng điểm đo của angleFactor()
    const dx0 = camera.position.x - (e[4] * ly + e[12]);
    const dy = camera.position.y - (e[5] * ly + e[13]);
    const dz0 = camera.position.z - (e[6] * ly + e[14]);
    // như angleFactor: đo từ góc nhìn mặc định
    const ca = Math.cos(S.viewAz);
    const sa = Math.sin(S.viewAz);
    const dx = dx0 * ca - dz0 * sa;
    const dz = dx0 * sa + dz0 * ca;
    const len = Math.hypot(dx, dy, dz) || 1;
    const cosA = THREE.MathUtils.clamp((e[8] * dx + e[9] * dy + e[10] * dz) / (nl * len), -1, 1);
    const t = THREE.MathUtils.clamp((THREE.MathUtils.radToDeg(Math.acos(cosA)) - ANG_FULL) / (ANG_ZERO - ANG_FULL), 0, 1);
    return 1 - t * t * (3 - 2 * t);
  }

  /**
   * SteleMetrics (plane-local) theo hợp đồng info/contract.js. `pl` = mặt phẳng khay mà kiểu hiện thông
   * tin đang bám: khay đang RỜI ĐI (chuyển cảnh) trả số đo của chính bia đó, chụp lúc nó còn là bia hiện
   * tại — không bao giờ lấy số đo bia mới đắp lên tấm bia cũ.
   */
  function steleMetrics(pl) {
    if (!S.live) return null;
    const i = pl ? K.slotOfPlane(pl) : S.cur;
    if (i >= 0 && i !== S.cur) return planes[i].metrics ?? null;
    return (planes[S.cur].metrics = S.metricsCache ??= Object.freeze({
      slabLeft: K.bounds.slabL,
      slabRight: K.bounds.slabR,
      height: K.bounds.yMax - K.bounds.yMin,
      bandTop: K.bounds.bandTop,
      bandBottom: K.bounds.bandBottom,
      // Gốc mặt phẳng đặt ở zFront + PLANE_EPS → mặt đá nằm lùi sau gốc đúng PLANE_EPS.
      zFront: -PLANE_EPS,
      sweepRadius: K.bounds.r,
      // r73: nửa bề ngang CẢ tấm bia (rùa rộng hơn phiến) — kiểu thông tin đặt tấm ra ngoài thân rùa
      bodyHalf: K.bounds.xHalf,
      // r81: ô chữ mặt bia đo trên mô hình (dưới dải tiêu đề, trong khung trong, trên đầu rùa) — lớp tên đặt gọn trong ô này
      field: faceFieldOf(slotEntry[S.cur]?.id),
    }));
  }
  return {
    _keyDir, buildNames, css3d, fieldLuma, inkFor, measureFieldLumaSync, namesRigs, namesStyleFor, planeAngle,
    pollFieldLuma, slotEntry, startFieldLuma, steleMetrics,
  };
}
