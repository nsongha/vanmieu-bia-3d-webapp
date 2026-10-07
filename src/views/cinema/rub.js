// "Xoa đầu rùa" — điều khiển chế độ + giao diện. Ở Văn Miếu, sĩ tử xoa đầu rùa đá cầu may; đây là bản ảo.
//
// r9 → r70 — TRỨNG PHỤC SINH (như game / "Ready Player One"): không có gợi ý nào hiện sẵn. r70 (người dùng: "phần xoa đầu rùa
// hơi dễ kích hoạt. tôi muốn nó là easter egg để user khám phá" — chọn "Xoa thật mới mở"): CHỈ một động tác xoa thật trên đầu rùa
// mới mở; bỏ hẳn bước "mở khoá" (zoom sát + giữ 3 s → dòng mời), vòng đếm xoè tay giữ 3 s, cách bắt đầu bằng nắm tay
// (settings.rubHandStart) và <body data-hand-fist="claim">. Để yên / rê / focus / zoom không bao giờ tự vào.
//  · VÀO (ngoài chế độ): bia đang focus HOẶC đầu rùa đủ to trên màn (bán kính ≥ ARM_HEAD_MIN_PX) — xa thì không. Tay: TÂM
//    LÒNG BÀN TAY (xoè đủ 5 ngón, tay đã nhận, không nhón / V / đang cầm kéo bia / đang chờ hover sau khi kéo / đang ở vùng
//    dính HUD) quanh đầu rùa (hình tròn ARM_STAY_K × bán kính đầu, chuỗi phải từng chạm vùng xoa — tia xuyên lưới) và XOA qua
//    lại hoặc xoay tròn (cùng bộ nhận biết rubDetection.ts: đổi chiều có trễ, biên độ vừa phải, gọn quanh đầu). Chuột: NHẤN GIỮ
//    trên đầu rùa rồi xoa (bấm gọn không làm gì — cú bấm như bấm vào bia thường). Mỗi NHỊP = một lần qua–lại (hai lần đổi
//    chiều trên trục chính; xoay một vòng cũng là một nhịp), các nhịp nối liền (ngưng quá ARM_BREAK_MS là về 0), ARM_STROKES
//    nhịp trong ARM_WINDOW_MS → vào. Phản hồi KHÔNG chữ, không số: nhịp 1 — một ánh loé nhỏ trên đầu rùa; nhịp 2 — đầu rùa lung
//    linh rõ hơn; nhịp 3 — vệt loé quét ngang + vòng sáng mảnh nở ra (như "mở khoá" cũ), rồi vào chế độ (camera bay tới khung
//    cận như trước). Ngưng xoa → ánh tắt dần về 0 trong ~1 s. Không còn "đã khám phá" theo phiên: khách nào cũng tự xoa ra.
//  · XOA: tay xoè + tâm lòng bàn tay chiếu trúng vùng xoa (đầu + cổ, tia xuyên lưới) + chuyển động QUA LẠI
//    (rubDetection.ts); chuột: nhấn giữ trên đầu rùa rồi xoa qua lại, cùng luật. Mỗi lần tay đi qua, mọi vết dọc
//    đường nhận đúng settings.rubStrength độ bóng (chia theo quãng đường / bán kính vết) — "≈ N lượt để bóng tối
//    đa" tính được. Cỡ vết = settings.rubRadius × bán kính đầu rùa ("Cỡ brush"); trong chế độ một vòng mảnh đúng cỡ
//    đó chiếu lên mặt đá dưới con trỏ / lòng bàn tay (mờ khi để yên, sáng lên khi đang nhận là xoa).
//  · r11 — dùng TAY trong chế độ: vòng brush trên mặt đá LÀ con trỏ (vòng tròn của lớp cử chỉ ẩn đi — <body
//    data-hand-cursor="surface">), đặt đúng tâm lòng bàn tay = chỗ độ bóng rơi xuống; chỉ vào đá ngoài vùng xoa → vòng
//    mờ trên chỗ đó; chỉ ra nền → một chấm nhỏ mờ.
//  · r10 — CAMERA TỰ DO trong chế độ: nhấn trên đầu rùa = xoa; kéo chỗ khác = xoay; lăn = zoom (tốc độ thường);
//    camera không bao giờ tự về khung cận.
//  · RA: Esc · nút × · zoom ra quá ngưỡng (zoomExitK) · rảnh (mọi thao tác đều tính: IDLE_MS_MOUSE, hoặc
//    IDLE_MS_HAND khi đang dùng tay mà tay đã rời khung hình) · đổi bia. Bấm ra ngoài đầu rùa KHÔNG thoát nữa.
import { createRubDetector } from '../../core/rubDetection.ts';
import { DEFAULTS, getSettings, onSettings } from '../../core/settings.js';

/** Rảnh (không thao tác gì — di chuột, lăn, phím, kéo xoay, xoa) ngần này → thoát (chuột). */
const IDLE_MS_MOUSE = 20000;
/** … khi đang dùng TAY (lần thao tác cuối là bàn tay) mà tay đã rời khung hình. */
const IDLE_MS_HAND = 9000;
/** Cờ body[data-hand-busy="rub"] giữ thêm ngần này sau lần ghi xoa bằng tay cuối (khoảng nghỉ giữa các nhịp). */
const HAND_BUSY_LINGER_MS = 400;
/** Thoát khi zoom ra xa hơn max(ZOOM_EXIT_MIN_K, ngần này × zoomK của khung cận) — sau khi đã ở trong ngưỡng. */
const ZOOM_EXIT_K = 1.3;
/** Vòng brush (vàng --gold, viền tối mảnh): độ đậm khi để yên / đang xoa / (tay) chỉ ra ngoài vùng xoa; nhịp đổi (s). */
const BRUSH_IDLE = 0.6;
const BRUSH_RUB = 1;
const BRUSH_OFF = 0.3;
const BRUSH_TAU = 0.12;
/** Ngưỡng zoom-ra-để-thoát tối thiểu (tỉ lệ khoảng cách camera → đầu rùa so với khung mặc định) — xem zoomExit. */
export const ZOOM_EXIT_MIN_K = 0.62;
/** Vệt loé lúc vào (nhịp thứ ARM_STROKES): quét ngang đầu rùa trong ngần này (ms). */
const GLINT_MS = 900;
/** Mốc độ bóng của một vết để loé nhẹ. */
const GLINT_AT = [0.34, 0.67, 0.999];
/** r70 — "xoa thật mới mở": số nhịp (qua–lại) nối liền để vào; cả chuỗi gọn trong ARM_WINDOW_MS. */
const ARM_STROKES = 3;
const ARM_WINDOW_MS = 2500;
/** Ngưng xoa (không có lần đổi chiều mới) quá ngần này → chuỗi về 0, ánh tắt dần. Xoa chậm ~1 nhịp / s vẫn nối liền. */
const ARM_BREAK_MS = 550;
/** Đầu rùa đủ to trên màn (bán kính, px) để xoa mở được khi bia CHƯA focus (focus thì luôn được). ~1440×900: khung mặc
 *  định 51–66 px, focus 57–73 px → lúc nghỉ phải focus (rê lên bia) hoặc zoom lại gần. */
const ARM_HEAD_MIN_PX = 75;
/** Tâm lòng bàn tay / chuột trong hình tròn đầu rùa × ARM_STAY_K (tối thiểu ARM_STAY_MIN_PX) mới là mẫu đủ điều kiện. */
const ARM_STAY_K = 1.6;
const ARM_STAY_MIN_PX = 60;
/** r70b — camera đang trôi (vừa focus: đầu rùa lướt ~75 px, to thêm ~10 % trong ~0,65 s) không làm rơi lượt xoa:
 *  mẫu đủ điều kiện nếu gần đầu rùa ở VỊ TRÍ HIỆN TẠI, ở bất kỳ vị trí nào của nó trong ARM_TRAIL_MS vừa qua (người xoa
 *  bám theo đầu rùa chậm một nhịp), hoặc ở chỗ nó đứng lúc chuỗi xoa chạm vùng xoa lần đầu (neo, sống ARM_WINDOW_MS — tay
 *  cứ xoa tại chỗ trong khi đầu rùa trôi đi); bộ nhận biết chạy trong TOẠ ĐỘ GẮN ĐẦU RÙA (tay − tâm đầu rùa chiếu khung
 *  này, quy về bán kính ARM_REF_PX) — camera trôi / zoom không thành chuyển động giả của tay. */
const ARM_TRAIL_MS = 600;
const ARM_REF_PX = 64;
/** Ánh trên đầu rùa theo số nhịp (0, 1, 2): lung linh 0..1; lên theo τ ARM_FX_TAU, tắt dần trong ARM_FADE_MS. */
const ARM_FX = [0, 0.2, 0.46];
const ARM_FX_TAU = 0.16;
const ARM_FADE_MS = 450; // (+ ARM_BREAK_MS chờ ngưng hẳn → ánh về 0 ~1 s sau lần đổi chiều cuối)
/** Nhịp cuối: vệt loé + vòng nở, vào chế độ sau ngần này (ms). */
const ARM_ENTER_MS = 240;
/** Vừa thoát: ngần này (ms) chưa xoa mở lại được (tay còn đang xoa lúc Esc / rảnh / zoom ra). */
const ARM_REST_MS = 1500;
/** Chuột: nhấn trên đầu rùa rồi thả gần như tại chỗ, nhanh = bấm gọn (view xử lý như bấm vào bia). */
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 600;
/** Nhấn trên đầu rùa rồi kéo đi một mạch (chưa đổi chiều lần nào) quá max(ORBIT_HANDOFF_MIN_PX, ORBIT_HANDOFF_K × bán kính
 *  đầu) hoặc ra khỏi vùng đầu rùa → không phải xoa: trả cú nhấn lại cho xoay camera (view phát lại pointerdown tại chỗ đó). */
const ORBIT_HANDOFF_K = 1.5;
const ORBIT_HANDOFF_MIN_PX = 50;
/** Trong chế độ: bàn tay trong vòng này quanh đầu rùa (trên màn) mới tính là xoa (xoa hăng tay lệch ra vẫn tính). */
const STAY_K = 2.2;
const STAY_MIN_PX = 90;
const SAVE_EVERY_MS = 2000;

/** Chú thích trong chế độ (ngoài chế độ không có chữ nào — r70). */
const TEXT = {
  mouse: 'Click để xoa đầu rùa',
  handRub: 'Xoè tay để xoa đầu rùa',
  close: 'Thoát xoa đầu rùa',
};

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * @param {{
 *   stage: any,
 *   host: HTMLElement,
 *   toNdc: (x:number, y:number) => [number, number],
 *   safeArea: () => {top:number,right:number,bottom:number,left:number},
 *   reduceMotion: boolean,
 *   onChange?: (active:boolean, reason:string) => void,
 * }} opts
 */
export function createRubMode({ stage, host, toNdc, safeArea, reduceMotion, onChange, focused = () => false }) {
  const R = stage.rub;
  const det = createRubDetector();
  const armDet = createRubDetector(); // r70: xoa để MỞ (ngoài chế độ) — cùng luật "đang xoa" với trong chế độ

  // ---------------------------------------------------------------- DOM
  const layer = el('div', 'cin-rub', host);
  layer.setAttribute('aria-hidden', 'true');
  const dot = el('i', 'cin-rub__dot', layer); // (tay, trong chế độ) lòng bàn tay chỉ ra nền: chấm nhỏ thay con trỏ
  let dotOn = false;
  const cap = el('div', 'cin-rub__cap', layer);
  cap.setAttribute('role', 'status');
  const line = el('p', 'cin-rub__line', cap, TEXT.mouse);
  const close = el('button', 'cin-rub__close', cap, '×');
  close.type = 'button';
  close.setAttribute('aria-label', TEXT.close);
  close.setAttribute('data-magnet', '');
  close.addEventListener('click', () => exit('close'));

  // ---------------------------------------------------------------- trạng thái
  let active = false;
  let source = 'mouse'; // cách vào chế độ: 'hand' | 'mouse'
  let lastAct = 0;
  let lastActSrc = 'mouse'; // nguồn của lần thao tác cuối: 'mouse' (chuột / phím / lăn / kéo) | 'hand'
  let zoomExit = { armed: false, k: Infinity }; // ngưỡng zoom-ra-để-thoát (chốt khi camera tới khung cận)
  let brushK = 0;
  let brushOn = false;
  let lastSave = 0;
  let counted = 0; // số lượt xoa đã cộng của chuỗi xoa hiện tại (chain của bộ nhận biết)
  let countedChain = -1;
  let lastRubAt = -1e9;
  let rubbingNow = false;
  // Đặt document.body.dataset.handBusy = 'rub' khi lượt xoa bằng TAY đang được ghi nhận, giữ thêm HAND_BUSY_LINGER_MS
  // sau lần ghi cuối (khoảng nghỉ giữa hai nhịp xoa không tắt cờ). Ai đọc: lớp cử chỉ (con trỏ tay không "đón trước" —
  // core/hand/cursor.js), dòng thời gian (không bắt hover — timeline-shared.js), app/input.js (tính là đang thao tác).
  // (r42: luật giành quyền giữa hai bàn tay ở kiosk đã bỏ cùng chế độ một tay.) Chuột không cần.
  let handBusyAt = -1;
  let lastHit = null; // điểm chạm trước (toạ độ mô hình) của chuỗi xoa hiện tại — quãng đường đi qua
  const hand = { active: false, open5: false, engaged: false, pinch: false, x: 0, y: 0, cx: 0, cy: 0 };
  const mouse = { x: 0, y: 0, active: false };
  /** Chuột đang nhấn để xoa (id con trỏ) — chỉ trong chế độ, nhấn trúng đầu rùa. */
  let mouseRub = null;
  let surfaceWanted = false; // (khung này) ẩn vòng con trỏ của lớp cử chỉ
  let glintT = -1; // ms kể từ lúc vệt loé vào chế độ bắt đầu, −1 = không
  let fxOn = false;
  let capOn = false;
  // r70 — xoa để mở: nguồn đang thử ('hand' | 'mouse' | null), mốc các nhịp đã đếm trong chuỗi, chuỗi đã chạm vùng xoa chưa,
  // lần cuối bộ nhận biết còn "đang xoa", ánh hiện tại, mốc vào chế độ (sau nhịp cuối), chuột đang nhấn để thử (id, gốc)
  const arm = { src: null, strokes: [], counted: 0, chain: -1, touched: false, anchor: null, revs: 0, revAt: -1e9, fx: 0, fadeFrom: 0, fadeAt: -1, enterAt: -1, restUntil: -1e9, why: '' };
  let mouseArm = null; // { id, x0, y0, t0, moved, rubbed }
  const headTrail = []; // r70b: đầu rùa trên màn trong ARM_TRAIL_MS vừa qua — { t, x, y, r }
  let handoffId = null; // pointerId vừa trả cho xoay camera — pointerdown phát lại của nó không bị bắt lại
  let lastCtx = { shown: false, blocked: true, gesture: false, handBusy: false };
  const stats = { deposits: 0, rubFrames: 0, enters: 0, exits: [], armStrokes: 0, activations: 0 };
  /** Đồng hồ riêng (ms), cộng dồn dt của từng khung: mọi cửa sổ thời gian (dao động, rảnh, rời tay, mở khoá) đo
   *  theo khung THẬT đã vẽ — khung bị trễ / tab bị bóp nhịp không làm lệch luật, và kiểm thử bơm khung là tất định. */
  let clock = 0;

  // Cài đặt: độ mạnh / bán kính vết xoa; tắt tính năng → thoát.
  const cfg = { strength: DEFAULTS.rubStrength, radius: DEFAULTS.rubRadius, on: true };
  const readCfg = (s) => {
    const n = (v, a, b, d) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d);
    cfg.strength = n(s.rubStrength, 0.001, 0.1, DEFAULTS.rubStrength);
    cfg.radius = n(s.rubRadius, 0.1, 1, DEFAULTS.rubRadius);
    const on = s.cinemaRub !== false;
    if (!on && cfg.on) {
      if (active) exit('disabled');
      disarm(true);
    }
    cfg.on = on;
  };
  readCfg(getSettings());
  const offSettings = onSettings((s) => readCfg(s));
  // Màu vòng brush = vàng nhấn của Điện ảnh (token --gold trong cinema.css).
  try {
    const gold = getComputedStyle(host).getPropertyValue('--gold').trim();
    if (gold) R.setBrushColor?.(gold);
  } catch {
    /* không đọc được style → màu mặc định của sân khấu (cũng là --gold) */
  }

  /** <body>: ẩn vòng con trỏ của lớp cử chỉ (trong chế độ: vòng brush thay). */
  function syncBody() {
    setSurfaceCursor(surfaceWanted);
  }

  /**
   * Vòng brush trên mặt đá (uniform ở sân khấu): hit = điểm chạm (toạ độ mô hình) hoặc null; off = điểm nằm ngoài
   * vùng xoa (chỉ tay mới hiện — vòng mờ).
   */
  function setBrush(hit, dt, rubbing = false, show = true, off = false) {
    if (!hit) brushK = 0; // rời mặt đá: ẩn ngay; quay lại thì hiện dần
    const want = hit && show ? (rubbing ? BRUSH_RUB : off ? BRUSH_OFF : BRUSH_IDLE) : 0;
    brushK = reduceMotion ? want : brushK + (want - brushK) * Math.min(1, dt / BRUSH_TAU);
    if (hit && brushK > 0.004) {
      R.setBrush(hit, R.headRadius * cfg.radius, brushK);
      brushOn = true;
    } else if (brushOn) {
      R.setBrush(null);
      brushOn = false;
    }
  }

  function setDot(on, x = 0, y = 0) {
    if (on) dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (on !== dotOn) {
      dotOn = on;
      dot.classList.toggle('is-on', on);
    }
  }

  /** Lớp cử chỉ: trong chế độ, vòng brush trên đá thay vòng con trỏ (handInput.css). */
  function setSurfaceCursor(on) {
    if (on) document.body.dataset.handCursor = 'surface';
    else if (document.body.dataset.handCursor === 'surface') delete document.body.dataset.handCursor;
  }

  function glint(x, y) {
    if (reduceMotion) return;
    const g = el('i', 'cin-rub__glint', layer);
    g.style.left = `${x}px`;
    g.style.top = `${y}px`;
    const kill = () => g.remove();
    g.addEventListener('animationend', kill, { once: true });
    setTimeout(kill, 1400);
  }

  /** Nét trang trí lúc vào (nhịp cuối của xoa để mở): một vòng sáng mảnh nở ra quanh đầu rùa rồi tan (không âm thanh). */
  function bloom(s) {
    if (reduceMotion || !s) return;
    const b = el('i', 'cin-rub__bloom', layer);
    const d = Math.max(60, s.r * 2.6);
    b.style.left = `${s.x}px`;
    b.style.top = `${s.y}px`;
    b.style.width = `${d}px`;
    b.style.height = `${d}px`;
    const kill = () => b.remove();
    b.addEventListener('animationend', kill, { once: true });
    setTimeout(kill, 2000);
  }

  /** Dòng chú thích + nút ×: chú thích theo nguồn nhập đang dùng. */
  function setCaption(on, txt) {
    if (line.textContent !== txt) line.textContent = txt;
    if (on !== capOn) {
      capOn = on;
      if (on) {
        const s = safeArea();
        cap.style.bottom = `${Math.round(s.bottom + 20)}px`;
      }
      layer.classList.toggle('is-cap', on);
      layer.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
  }

  function setFx(shimmer, glintPos) {
    const on = shimmer > 0 || Math.abs(glintPos) < 1.5;
    if (!on && !fxOn) return;
    fxOn = on;
    R.setFx(shimmer, glintPos, clock / 1000);
  }

  /**
   * r70: bỏ chuỗi xoa-để-mở (nguồn đổi, ngưng xoa, bị chặn, vừa vào / thoát). fade: ánh tắt dần từ mức đang có (ARM_FADE_MS)
   * — false: tắt ngay.
   */
  function disarm(fade = true, why = '') {
    arm.src = null;
    arm.strokes.length = 0;
    arm.counted = 0;
    arm.touched = false;
    arm.anchor = null;
    arm.enterAt = -1;
    if (why) arm.why = why;
    armDet.reset();
    if (fade && arm.fx > 0.001) {
      arm.fadeFrom = arm.fx;
      arm.fadeAt = clock;
    } else {
      arm.fx = 0;
      arm.fadeAt = -1;
    }
  }

  /** r70: một nhịp xoa-để-mở vừa được đếm (level = số nhịp trong cửa sổ). */
  function armStroke(level, s) {
    stats.armStrokes++;
    arm.fadeAt = -1;
    if (level === 1 && s) glint(s.x, s.y); // nhịp 1: một ánh loé nhỏ trên đầu rùa
    if (level >= ARM_STROKES) {
      // nhịp cuối: vệt loé quét ngang + vòng sáng mảnh nở ra → vào chế độ sau ARM_ENTER_MS
      stats.activations++;
      glintT = 0;
      bloom(s);
      arm.enterAt = clock;
    }
  }

  function enter(src) {
    if (active || !R.available) return false;
    if (!R.setMode(true)) return false;
    active = true;
    source = src;
    lastAct = clock;
    lastActSrc = src === 'hand' ? 'hand' : 'mouse';
    zoomExit = { armed: false, k: Infinity };
    counted = 0;
    lastHit = null;
    det.reset();
    // chuột đang nhấn để xoa mở → xoa tiếp luôn trong chế độ (không phải nhấn lại)
    if (mouseArm) {
      mouseRub = mouseArm.id;
      mouseArm = null;
    }
    disarm(false);
    // (vệt loé của nhịp cuối — nếu có — chạy nốt trong chế độ; lung linh của lúc thử về 0)
    setFx(0, glintT >= 0 ? -1.3 : -9);
    setSurfaceCursor(true);
    layer.classList.add('is-active');
    stats.enters++;
    onChange?.(true, src);
    return true;
  }

  /** at = mốc lượt xoa bằng tay gần nhất (ms), −1 = không có → gỡ cờ (chỉ khi cờ còn là của view này). */
  function setHandBusy(at) {
    handBusyAt = at;
    const b = document.body.dataset;
    if (at >= 0) {
      if (b.handBusy !== 'rub') b.handBusy = 'rub';
    } else if (b.handBusy === 'rub') delete b.handBusy;
  }

  function exit(reason = 'exit') {
    if (!active) return;
    active = false;
    mouseRub = null;
    rubbingNow = false;
    setHandBusy(-1);
    lastHit = null;
    det.reset();
    setBrush(null, 0);
    setDot(false);
    surfaceWanted = false;
    syncBody();
    if (R.active) R.setMode(false);
    R.save();
    layer.classList.remove('is-active');
    setCaption(false, TEXT.mouse);
    disarm(false);
    arm.restUntil = clock + ARM_REST_MS; // tay còn đang xoa lúc Esc / rảnh / zoom ra → không vào lại ngay
    stats.exits.push(reason);
    onChange?.(false, reason);
  }

  /** Trong chế độ: một thao tác chuột / phím / lăn / kéo — đồng hồ rảnh đếm lại. */
  function touch() {
    if (!active) return;
    lastAct = clock;
    lastActSrc = 'mouse';
  }

  /** Điểm (px client) có nằm trong hình tròn đầu rùa × k (tối thiểu minPx) không. */
  const inHead = (s, x, y, k, minPx) => !!s && Math.hypot(x - s.x, y - s.y) <= Math.max(minPx, s.r * k);

  /** Điểm px (x, y) chạm vùng xoa? Tia xuyên lưới → điểm (toạ độ mô hình) hoặc null. */
  function probe(x, y) {
    const [nx, ny] = toNdc(x, y);
    return R.hit(nx, ny);
  }
  /** Như probe() nhưng nhận MỌI mặt của bia (kèm d: khoảng cách tới vùng xoa, ≤ 0 = trong vùng) — null = nền. */
  function probeAny(x, y) {
    const [nx, ny] = toNdc(x, y);
    return R.hit(nx, ny, true);
  }

  function rubStep(dt, now, x, y, ok, s) {
    const hit = ok ? probe(x, y) : null;
    const r = det.push(now, x, y, !!hit, s ? s.r : 120);
    rubbingNow = r.rubbing && !!hit;
    if (!rubbingNow) {
      if (r.reason === 'ineligible') lastHit = null;
      return { hit, reading: r };
    }
    lastAct = now;
    lastRubAt = now;
    stats.rubFrames++;
    // Camera còn đang bay tới khung cận thì chưa bôi (tia vẫn đúng, nhưng để người xem thấy đầu rùa trước).
    if (R.settled) {
      // Mỗi lần tay đi QUA một chỗ, vết ở đó nhận đúng cfg.strength: chia theo quãng đường trong khung / bán kính
      // vết (vết gộp trong vòng ½ bán kính → một lần đi qua dài ~1 bán kính trong vòng đó).
      const rs = R.headRadius * cfg.radius;
      if (lastHit && rs > 0) {
        const d = Math.min(rs, Math.hypot(hit.x - lastHit.x, hit.y - lastHit.y, hit.z - lastHit.z));
        const res = R.deposit(hit, rs, (cfg.strength * d) / rs);
        if (res) {
          stats.deposits++;
          for (const g of GLINT_AT) if (res.before < g && res.after >= g) glint(x, y);
        }
      }
      lastHit = { x: hit.x, y: hit.y, z: hit.z };
    }
    // Lượt xoa: mỗi hai lần đổi chiều trên trục chính (một nhịp qua–lại) là một lượt — đếm theo chuỗi (lưu, không hiện).
    if (r.chain !== countedChain) {
      countedChain = r.chain;
      counted = 0;
    }
    const laps = Math.floor(r.totalReversals / 2);
    if (laps > counted) {
      R.addCount(laps - counted);
      counted = laps;
    }
    return { hit, reading: r };
  }

  /**
   * Mỗi khung (view gọi trước lượt vẽ).
   * @param {number} dt s
   * @param {number} _now ms
   * @param {{ shown:boolean, blocked:boolean, gesture:boolean }} ctx
   */
  function update(dt, _now, ctx) {
    surfaceWanted = false;
    lastCtx = ctx;
    updateMode(dt, ctx);
    syncBody();
  }

  /**
   * r70 — một khung XOA ĐỂ MỞ (ngoài chế độ). Trả true khi đang thử (view: giữ camera / đầu rùa đứng yên dưới tay).
   * s = R.screen() (đầu rùa trên màn). Chỉ khi: bia focus hoặc đầu rùa đủ to; tay (xoè, đã nhận, không nhón / bận) hoặc chuột
   * đang nhấn trên đầu rùa; mẫu = tâm lòng bàn tay / chuột trong hình tròn đầu rùa × ARM_STAY_K.
   */
  function armStep(step, now, ctx, s, handOk) {
    if (arm.enterAt >= 0) return true; // nhịp cuối đã loé: vào chế độ sau ARM_ENTER_MS dù tay / chuột vừa rời
    if (s) {
      headTrail.push({ t: now, x: s.x, y: s.y, r: s.r });
      while (headTrail.length && now - headTrail[0].t > ARM_TRAIL_MS) headTrail.shift();
    } else headTrail.length = 0;
    const big = !!s?.front && (ctx.shown || s.r >= ARM_HEAD_MIN_PX);
    let src = null;
    let x = 0;
    let y = 0;
    if (mouseArm) {
      src = 'mouse';
      x = mouse.x;
      y = mouse.y;
    } else if (handOk && hand.open5 && hand.engaged && !hand.pinch && !ctx.handBusy) {
      src = 'hand';
      x = hand.x;
      y = hand.y;
    }
    const why = !big ? 'small' : now < arm.restUntil ? 'rest' : !src ? 'no-src' : '';
    if (why) {
      if (arm.src || arm.strokes.length) disarm(true, why);
      arm.why = why;
      return !!mouseArm;
    }
    if (arm.src && arm.src !== src) disarm(true, 'src');
    arm.src = src;
    arm.why = '';
    // gần đầu rùa khung này, gần chỗ nó vừa ở (camera đang trôi, tay bám theo chậm), hoặc gần neo của chuỗi này
    if (arm.anchor && now - arm.anchor.t > ARM_WINDOW_MS) arm.anchor = null;
    const near = inHead(s, x, y, ARM_STAY_K, ARM_STAY_MIN_PX) || headTrail.some((h) => inHead(h, x, y, ARM_STAY_K, ARM_STAY_MIN_PX)) ||
      (!!arm.anchor && inHead(arm.anchor, x, y, ARM_STAY_K, ARM_STAY_MIN_PX));
    // chuỗi phải từng chạm VÙNG XOA thật (đầu + cổ, tia xuyên lưới) — lượn quanh mép hình tròn không đủ
    if (near && !arm.touched && probe(x, y)) {
      arm.touched = true;
      arm.anchor = { t: now, x: s.x, y: s.y, r: s.r };
    }
    // toạ độ gắn đầu rùa (quy về bán kính ARM_REF_PX): camera lướt / zoom khi vừa focus không cộng vào chuyển động của tay
    const k = ARM_REF_PX / Math.max(1, s.r);
    const r = armDet.push(now, (x - s.x) * k, (y - s.y) * k, near, ARM_REF_PX);
    if (mouseArm && r.totalReversals > 0) mouseArm.rubbed = true; // đã đổi chiều: đang xoa, không trả cho xoay nữa
    if (r.reason === 'ineligible' && !near) {
      // rời đầu rùa (quá cửa sổ ân hạn của bộ nhận biết → nó tự xoá chuỗi)
      if (arm.strokes.length && now - arm.revAt > ARM_BREAK_MS) disarm(true, 'left');
      return arm.strokes.length > 0 || !!mouseArm;
    }
    if (r.chain !== arm.chain) {
      arm.chain = r.chain;
      arm.counted = 0;
      arm.revs = 0;
    }
    if (r.totalReversals !== arm.revs) {
      arm.revs = r.totalReversals;
      arm.revAt = now;
    }
    if (r.rubbing && arm.touched) {
      const n = Math.floor(r.totalReversals / 2);
      if (n > arm.counted) {
        for (let k = arm.counted; k < n; k++) arm.strokes.push(now);
        arm.counted = n;
        while (arm.strokes.length && now - arm.strokes[0] > ARM_WINDOW_MS) arm.strokes.shift();
        if (arm.enterAt < 0) armStroke(Math.min(ARM_STROKES, arm.strokes.length), s);
      }
    }
    if (arm.strokes.length && now - arm.revAt > ARM_BREAK_MS) disarm(true, 'stopped');
    return arm.strokes.length > 0 || !!mouseArm || arm.enterAt >= 0;
  }

  /** r70: ánh trên đầu rùa theo số nhịp (lên êm), tắt dần khi bỏ chuỗi; vệt loé của nhịp cuối chạy riêng (glintT). */
  function armFxStep(dt) {
    let want = ARM_FX[Math.min(ARM_FX.length - 1, arm.strokes.length)] ?? 0;
    if (arm.enterAt >= 0) want = ARM_FX[ARM_FX.length - 1];
    if (arm.fadeAt >= 0) {
      const k = Math.min(1, (clock - arm.fadeAt) / ARM_FADE_MS);
      arm.fx = arm.fadeFrom * (1 - k);
      if (k >= 1) arm.fadeAt = -1;
    } else if (reduceMotion) arm.fx = want;
    else arm.fx += (want - arm.fx) * Math.min(1, dt / ARM_FX_TAU);
    if (arm.fx < 0.002 && want === 0 && arm.fadeAt < 0) arm.fx = 0;
  }

  function updateMode(dt, ctx) {
    const step = Math.min(0.1, Math.max(0, dt)) * 1000;
    clock += step;
    const now = clock;
    // Sân khấu tự rời chế độ (đổi bia, tắt tính năng) → đồng bộ giao diện.
    if (active && !R.active) exit('stage');
    const available = cfg.on && R.available && !ctx.blocked;
    const handOk = ctx.gesture && hand.active;
    // Vệt loé của nhịp cuối (xoa để mở): quét ngang đầu rùa một lượt — chạy cả khi đã vào chế độ (camera đang bay tới).
    let glintPos = -9;
    let glintShimmer = 0;
    if (glintT >= 0) {
      glintT += step;
      const k = Math.min(1, glintT / GLINT_MS);
      glintShimmer = 0.6 * (1 - k);
      glintPos = -1.3 + 2.6 * easeInOut(k);
      if (k >= 1) glintT = -1;
    }

    if (!active) {
      setCaption(false, TEXT.mouse);
      setBrush(null, dt);
      setDot(false);
      if (!available) {
        if (arm.src || arm.strokes.length || mouseArm) disarm(true, 'blocked');
        armFxStep(dt);
        setFx(Math.max(arm.fx, glintShimmer), glintPos);
        return;
      }
      // r70: xoa để mở — không tốn tia nào khi không có tay xoè / chuột nhấn trên đầu rùa (armStep tự thoát sớm)
      const s = R.screen();
      const trying = armStep(step, now, ctx, s, handOk);
      if (trying) R.keepAwake?.(); // camera không tự trôi về khung giữa lúc đang xoa
      armFxStep(dt);
      setFx(Math.max(arm.fx, glintShimmer), glintPos);
      if (arm.enterAt >= 0 && now - arm.enterAt >= ARM_ENTER_MS) {
        const src = arm.src ?? 'hand';
        if (!enter(src)) disarm(false, 'enter-failed');
      }
      return;
    }
    setFx(glintShimmer, glintPos);

    // ---- trong chế độ
    surfaceWanted = true;
    const s = R.screen();
    setCaption(true, handOk ? TEXT.handRub : TEXT.mouse);
    const settled = R.settled;
    let rubbing = false;
    let brushHit = null;
    let brushOff = false;
    let handPt = null;
    if (mouseRub != null) {
      const r = rubStep(dt, now, mouse.x, mouse.y, true, s);
      rubbing = r.reading.rubbing;
      brushHit = r.hit;
    } else if (handOk) {
      // bàn tay còn trong khung hình = đang thao tác (rời khung → đếm IDLE_MS_HAND)
      lastAct = now;
      lastActSrc = 'hand';
      // Điểm xoa = tâm lòng bàn tay (đã lọc One Euro ở lớp cử chỉ) — vòng brush đặt ĐÚNG điểm đó (r11).
      const inStay = inHead(s, hand.x, hand.y, STAY_K, STAY_MIN_PX);
      const r = rubStep(dt, now, hand.x, hand.y, hand.open5 && inStay, s);
      rubbing = r.reading.rubbing;
      if (rubbingNow && settled) handBusyAt = now; // lượt xoa bằng tay đang được ghi (đã có vết)
      brushHit = r.hit;
      if (!brushHit) {
        const any = probeAny(hand.x, hand.y);
        if (any) {
          brushHit = any;
          brushOff = !(any.d <= 0);
        }
      }
      handPt = [hand.x, hand.y];
    } else {
      det.push(now, 0, 0, false, 1);
      lastHit = null;
      rubbingNow = false;
      if (mouse.active) brushHit = probe(mouse.x, mouse.y); // (không có bàn tay trong khung → chuột)
    }
    // vòng brush: chỉ sau khi camera đã tới khung cận (lúc bay tới, mặt đá trôi dưới con trỏ — để yên cho gọn). Tay:
    // chưa có vòng trên đá (đang bay tới / chỉ ra nền) → chấm nhỏ ở lòng bàn tay, bàn tay không bao giờ "mất".
    setBrush(brushHit, dt, rubbing, settled, brushOff);
    setDot(!!handPt && !(settled && brushHit), handPt?.[0], handPt?.[1]);

    // Zoom ra quá ngưỡng (sau khi đã vào trong ngưỡng) → thoát, camera về khung như thường.
    if (settled && mouseRub == null) {
      const z = R.zoomK();
      if (!Number.isFinite(zoomExit.k)) zoomExit.k = Math.max(ZOOM_EXIT_MIN_K, (R.goalZoomK?.() ?? 0) * ZOOM_EXIT_K);
      if (z <= zoomExit.k) zoomExit.armed = true;
      else if (zoomExit.armed) {
        exit('zoom-out');
        return;
      }
    }
    setHandBusy(handBusyAt >= 0 && now - handBusyAt <= HAND_BUSY_LINGER_MS ? handBusyAt : -1);
    const idleLimit = lastActSrc === 'hand' ? IDLE_MS_HAND : IDLE_MS_MOUSE;
    if (now - lastAct > idleLimit && mouseRub == null) {
      exit('idle');
      return;
    }
    if (now - lastSave > SAVE_EVERY_MS) {
      lastSave = now;
      R.save();
    }
  }

  // ---------------------------------------------------------------- nhập liệu (view chuyển vào)
  return {
    get active() {
      return active;
    },
    get rubbing() {
      return rubbingNow;
    },
    /**
     * r28 → r70: đang XOA ĐỂ MỞ trên đầu rùa (chưa vào chế độ): đã có nhịp trong chuỗi / chuột đang nhấn trên đầu rùa / nhịp
     * cuối vừa loé. View cho sân khấu dừng vòng camera hover + lắc trong lúc này (stage.setHoldFreeze) — đầu rùa đứng yên
     * dưới tay tới khi vào / ngưng.
     */
    get holding() {
      if (active) return false;
      return arm.strokes.length > 0 || !!mouseArm || arm.enterAt >= 0;
    },
    /** Vừa xoa trong ms vừa rồi (để giảm độ nhạy vẩy đổi bia bằng tay). */
    rubbedWithin: (ms) => clock - lastRubAt < ms,
    enter,
    exit,
    update,
    /** Có người thao tác (chuột / phím / lăn / kéo xoay) — trong chế độ: chưa rảnh. */
    activity() {
      touch();
    },
    /** Khung tay (sự kiện hand:frame đã lọc ở view). Tâm lòng bàn tay dùng cho xoa + vào chế độ. */
    handFrame(d) {
      hand.active = !!d.detected;
      hand.open5 = !!d.open5;
      hand.engaged = d.engaged !== false;
      hand.pinch = d.pose === 'pinch' || !!d.pinch;
      hand.x = Number.isFinite(d.palmX) ? d.palmX : d.x;
      hand.y = Number.isFinite(d.palmY) ? d.palmY : d.y;
      hand.cx = d.x;
      hand.cy = d.y;
    },
    handLost() {
      hand.active = false;
      hand.open5 = false;
      hand.pinch = false;
    },
    /**
     * Chuột / chạm di chuyển. r70: đang nhấn thử xoa để mở mà kéo đi một mạch (chưa đổi chiều) ra xa → 'orbit': view trả cú
     * nhấn cho xoay camera (phát lại pointerdown tại chỗ này — pointerDownCapture bỏ qua đúng một lần). Còn lại → null.
     */
    mouseMove(x, y) {
      if (active && (x !== mouse.x || y !== mouse.y)) touch();
      if (mouseArm && Math.hypot(x - mouseArm.x0, y - mouseArm.y0) > TAP_SLOP_PX) mouseArm.moved = true;
      mouse.x = x;
      mouse.y = y;
      mouse.active = true;
      if (mouseArm && !mouseArm.rubbed && !arm.strokes.length && arm.enterAt < 0) {
        const s = R.screen();
        // dời so với đầu rùa (camera trôi không tính là kéo), ra khỏi vùng đầu rùa (khung này lẫn chỗ nó vừa ở)
        const far = !s?.front || Math.hypot(x - s.x - (mouseArm.x0 - mouseArm.hx), y - s.y - (mouseArm.y0 - mouseArm.hy)) > Math.max(ORBIT_HANDOFF_MIN_PX, ORBIT_HANDOFF_K * s.r) ||
          !(inHead(s, x, y, ARM_STAY_K, ARM_STAY_MIN_PX) || headTrail.some((h) => inHead(h, x, y, ARM_STAY_K, ARM_STAY_MIN_PX)));
        if (far) {
          handoffId = mouseArm.id;
          mouseArm = null;
          disarm(true, 'drag');
          return 'orbit';
        }
      }
      return null;
    },
    /** Con trỏ chuột rời sân khấu → ẩn vòng brush. */
    mouseLeave() {
      mouse.active = false;
    },
    /**
     * pointerdown (pha bắt, trên sân khấu): nhấn trúng đầu rùa → NUỐT sự kiện (OrbitControls không xoay camera). Trong chế
     * độ: xoa bằng chuột. r70 — ngoài chế độ (bia focus hoặc đầu rùa đủ to): bắt đầu THỬ xoa để mở (nhấn giữ rồi xoa qua lại;
     * bấm gọn thì pointerUp trả 'tap' — view xử lý như bấm vào bia). Trả về true nếu đã nhận.
     */
    pointerDownCapture(e) {
      if (handoffId != null && e.pointerId === handoffId) {
        handoffId = null; // pointerdown phát lại sau khi trả cú kéo cho xoay camera (mouseMove → 'orbit')
        return false;
      }
      if (active) touch(); // nhấn đâu cũng là thao tác (kéo xoay ngoài đầu rùa: OrbitControls lo)
      if (e.button != null && e.button > 0) return false;
      if (!active) {
        if (!cfg.on || !R.available || lastCtx.blocked || clock < arm.restUntil) return false;
        const s = R.screen();
        // focus đọc thẳng (focused()) — ctx của khung trước có thể trễ một khung ngay lúc bia vừa focus
        if (!s?.front || !(lastCtx.shown || focused() || s.r >= ARM_HEAD_MIN_PX)) return false;
        if (!probe(e.clientX, e.clientY)) return false;
        disarm(false);
        mouseArm = { id: e.pointerId, x0: e.clientX, y0: e.clientY, hx: s.x, hy: s.y, t0: clock, moved: false };
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        return true;
      }
      if (!probe(e.clientX, e.clientY)) return false;
      mouseRub = e.pointerId;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      lastAct = clock;
      lastHit = null;
      det.reset();
      return true;
    },
    /** Thả chuột: true = đã nhận (hết một lượt xoa / thử); 'tap' = bấm gọn trên đầu rùa (view xử lý như bấm vào bia). */
    pointerUp(e) {
      if (e.pointerId === handoffId) handoffId = null;
      if (mouseArm && (e.pointerId === mouseArm.id || e.pointerId == null)) {
        const tapLike = !mouseArm.moved && clock - mouseArm.t0 <= TAP_MAX_MS && !arm.strokes.length;
        mouseArm = null;
        if (arm.enterAt < 0) disarm(true, 'release');
        return tapLike ? 'tap' : true;
      }
      if (mouseRub != null && (e.pointerId === mouseRub || e.pointerId == null)) {
        mouseRub = null;
        lastHit = null;
        det.reset();
        counted = 0;
        R.save();
        return true;
      }
      return false;
    },
    /**
     * Bấm gọn (không kéo) ở (x, y): ngoài chế độ KHÔNG làm gì (r70 — bấm không vào chế độ nữa) → null (view xử lý như
     * thường). Trong chế độ: bấm đâu cũng KHÔNG thoát (r10 — người dùng tự do chọn chỗ xoa / xoay quanh), chỉ nuốt cú bấm.
     */
    tap() {
      if (!active) return null;
      touch();
      return 'stay';
    },
    /** DEV (tương thích kiểm thử cũ): không còn bước mở khoá (r70) — không làm gì. */
    unlock: () => true,
    lock: () => false,
    /** DEV / kiểm thử. */
    debug: () => ({
      active,
      source,
      zoomK: +R.zoomK().toFixed(3),
      caption: capOn ? line.textContent : null,
      // r70: xoa để mở — nguồn, số nhịp trong cửa sổ, ánh, chuột đang nhấn thử, vì sao không thử được (small / rest / no-src…)
      arm: { src: arm.src, strokes: arm.strokes.length, fx: +arm.fx.toFixed(3), touched: arm.touched, mouse: !!mouseArm, entering: arm.enterAt >= 0, why: arm.why },
      body: { cursor: document.body.dataset.handCursor ?? null },
      idleMs: Math.round(clock - lastAct),
      idleSrc: lastActSrc,
      idleLimit: lastActSrc === 'hand' ? IDLE_MS_HAND : IDLE_MS_MOUSE,
      zoomExit: { armed: zoomExit.armed, k: Number.isFinite(zoomExit.k) ? +zoomExit.k.toFixed(3) : null },
      brush: { on: brushOn, k: +brushK.toFixed(3), dot: dotOn },
      lastDeposit: lastHit ? { ...lastHit } : null,
      rubbing: rubbingNow,
      mouseRub: mouseRub != null,
      cfg: { ...cfg },
      hand: { ...hand },
      ...stats,
      exits: [...stats.exits],
      stage: R.stats(),
    }),
    dispose() {
      if (active) exit('dispose');
      setHandBusy(-1);
      surfaceWanted = false;
      syncBody();
      offSettings();
      setFx(0, -9);
      layer.remove();
    },
  };
}
