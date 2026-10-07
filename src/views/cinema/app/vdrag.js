// Điện ảnh › KÉO BIA — r72: CHỈ CÒN NẮM TAY (người dùng: "bỏ gesture 2 ngón cho việc lướt bia. đổi lại thành giữ 2 ngón trên
// mặt bia 2s để mở full info"): hai ngón không cầm / kéo bia nữa — lớp cử chỉ không phát 'hand:vdrag' kind 'v' (r72g), giữ V
// trên bia 2 s là 'hand:vhold' (index.js mở lớp đọc toàn màn hình). Phần dưới (r53–r65) giữ để hiểu cơ học chung: vùng chết,
// 1:1, ngưỡng nhận, hất, lò xo, vòng cầm — nay chỉ nắm tay dùng.
// (Lịch sử) KÉO BIA bằng hai ngón (r53 — r62: kiểu duy nhất của hai ngón ở Điện ảnh, bỏ "Chọn bên rồi vuốt" và cài đặt
// handNavStyle — người dùng: "giơ 2 ngón tay: lúc này user drag cả
// bia và bục … khi đi qua 1 ngưỡng nhất định thì bia cũ sẽ trượt khỏi màn hình, bia mới trượt vào từ phía còn lại";
// "để kéo bia tiếp theo thì user cần phải đưa 2 ngón về giữa khung hình để bắt dính bia tiếp theo. khi dính bia thì đèn
// dưới của bục sáng").
// r56 (người dùng: "… thêm mũi tên như hình đính kèm ở 2 bên bục, gần sát sàn, cũng sáng lên … động tác grab cần respond rõ
// ràng hơn: camera hơi lùi lại nhanh … cảm giác hình ảnh như được nắm bụp. ngưỡng để bia tự trôi cần gần hơn … bia trôi nhanh
// hơn tốc độ tay. cho bằng đi, và tính cách mượt hơn … mũi tên ở hướng tay đang kéo sẽ sáng lên còn mũi tên bên kia mờ đi.
// mũi tên đi theo bục và bia."):
//   · không còn hai mũi tên kính giữa khung — r56: hai mũi tên sát sàn hai bên bục; r62: thay bằng VÒNG CẦM 3D trên sàn
//     (grab-ring.js, như nắm tay — r65: hiện tại chỗ, mờ → rõ + nở nhẹ; sân khấu lái theo stage.setGrab / setGrabSide);
//   · cầm → camera lùi ~7 % nhanh ("nắm bụp", sân khấu); bia bám tay 1:1 trên màn hình ở nhịp khung vẽ (stage.scrubHand);
//     ngưỡng tự nhận gần hơn (COMMIT_DX ≈ 0,085 W quãng tay).
//
// Đầu vào: sự kiện window 'hand:vdrag' của lớp cử chỉ { phase: 'start'|'move'|'end'|'cancel', x (0..1), dx, vx (bề ngang
// màn hình / s), t } — chỉ phát khi kiểu 'drag' đang có hiệu lực ở view có hỗ trợ (<body data-hand-vdrag="1">, đặt ở đây).
//   · CẦM: V giữ trong vùng giữa khung (|x − 0,5| ≤ GRAB_ZONE), gần như đứng yên (< GRAB_STILL), liên tục GRAB_DWELL_MS →
//     cầm; x0 = x lúc cầm; đèn dưới bục sáng dần + vòng cầm 3D (r62) + khay thu nhỏ (sân khấu).
//     V giữ lệch ngoài vùng giữa > HINT_AFTER_MS → gợi ý "Đưa hai ngón về giữa để cầm bia".
//   · KÉO: dx = x − x0; qua DEAD_DX thì bắt đầu lượt Lướt tới bia kề (stage.scrubBegin — kéo sang trái = bia sau vào từ
//     phải, sang phải = bia trước vào từ trái); mỗi mẫu tay → stage.scrubHand(quãng theo chiều kéo − DEAD_DX, vận tốc):
//     bia đi đúng bằng tay trên màn hình. Cặp chevron của vòng phía tay kéo sáng hẳn, phía kia mờ.
//   · NHẬN: quãng tay ≥ COMMIT_DX (tự nhận, không chờ thả) · hoặc thả tay "hất" (vận tốc theo chiều kéo ≥ FLING_VX, quãng ≥
//     FLING_MIN_DX) → điều hướng thường (nav select: chỉ số, địa chỉ, HUD, tải, khoá) — sân khấu nhận lượt kéo làm lượt lướt
//     thật, chạy nốt từ đúng vận tốc bia lúc đó. Nhận xong là HẾT CẦM: kéo bia kế tiếp phải đưa V về giữa cầm lại.
//   · NHẢ / huỷ khác: lò xo về 0, sân khấu như trước; hết cầm (vòng mờ tắt).
//   · Giảm chuyển động: sân khấu không tua lượt lướt — nhận theo ngưỡng quãng tay (hiện tức thì); vòng chỉ mờ → rõ.
//   · Suốt lúc giữ V: trạng thái nghỉ (rest — index.js: không hover / đèn trên / thông tin; camera không vòng chính diện).
// r58 — NẮM TAY KÉO BIA (settings.fistGrab, độc lập với hai kiểu vuốt hai ngón — người dùng: "grab bằng nắm tay. Khi nắm tay
// 100% thì grab bia và bục xong cũng move tương tự như kéo bia … phải đang focus thì mới grab được"; "cách này sẽ không cần giơ
// 2 ngón lên để kích hoạt nhé, độc lập với 2 kiểu vuốt 2 ngón"): cùng sự kiện 'hand:vdrag' với kind 'fist' (lớp cử chỉ: start
// = tay xoè → nắm tay đã xác nhận, không bao giờ từ nhón; end = mở tay). Cầm NGAY ở 'start' nếu bia đang focus (hoặc vừa
// focus — focused()), không vùng giữa (r70: bỏ luật "chế độ xoa đầu rùa nhận nắm tay" — xoa chỉ mở bằng tay xoè xoa thật). Cầm: focus tắt dần (thông
// tin + đèn trên), thay bằng dáng cầm (đèn dưới, khay thu nhỏ, vòng cầm); camera đứng yên đúng chỗ người xem đang nhìn
// (stage.setGrabCamera) — kéo thì đường camera của lượt lướt đi từ chỗ đó theo tay; nhả không nhận → camera trôi về khung. Còn
// lại dùng chung với kéo bia bằng V (vùng chết, One Euro, 1:1, ngưỡng nhận, hất, lò xo, khay cũ giữ cỡ nhỏ). Nhận xong: bia mới
// ở trạng thái nghỉ — cầm tiếp phải focus bia mới rồi xoè / nắm lại. Một lượt cầm một lúc: V hay nắm tay, ai trước người đó.
// Chuột / bàn phím không đổi.
// r62 — hợp đồng thêm với view / lớp cử chỉ:
//   · <body data-stele-grab="v"|"fist"> từ lúc cầm CÓ HIỆU LỰC (V: sau khi dừng ở vùng giữa GRAB_DWELL_MS; nắm tay: lúc nhận)
//     tới khi hết cầm (nhả, lượt kéo được nhận, huỷ) — lớp cử chỉ làm mờ nhanh con trỏ / huy hiệu V đúng lúc vòng bắt đầu;
//   · onNav(kind) — lượt kéo vừa NHẬN đổi bia (index.js: hover của bia mới chờ settings.grabHoverDelay);
//   · grabMoved — lượt cầm này (V hay nắm tay) đã kéo bia đi thật (index.js: hai nút ‹ › thôi hút tay).
import { cachedRoot } from '../../../core/loader.js';
import { getSettings, onSettings } from '../../../core/settings.js';

/** Tay dời quá ngần này (phần bề ngang) sau lúc cầm mới bắt đầu lướt (run tay không nhích bia). */
export const DEAD_DX = 0.012;
/**
 * r57: độ dời tay dùng cho vùng chết / đổi chiều / ngưỡng nhận được làm mượt (EMA τ DX_TAU giây) — run tay ±0,5 % W thô ở
 * 30 Hz vượt DEAD_DX ~1 % số mẫu, từng đủ để bắt đầu lướt khi tay đang giữ yên chỗ cầm.
 */
const DX_TAU = 0.07;
/**
 * r56: quãng TAY (phần bề ngang, tính từ lúc cầm) để tự nhận — bia (bám 1:1) đã dời ~0,07 W: đủ rõ là cố ý kéo, bia mới đã
 * ló ở mép; gần hơn nhiều so với r53 (~0,13 W tay — bia khi đó đã đi ~0,23 W vì chạy nhanh hơn tay).
 */
export const COMMIT_DX = 0.085;
/** Thả tay "hất": vận tốc theo chiều kéo (bề ngang / s) + quãng tay tối thiểu. */
export const FLING_VX = 0.9;
export const FLING_MIN_DX = 0.03;

/**
 * @param {{ host: HTMLElement, stage: any, bia: object[], lods: any, select: (i:number, replace?:boolean, dir?:number) => void,
 *   index: () => number, blocked: () => boolean }} cfg
 */
export function createVdrag({ stage, bia, lods, select, index, blocked, focused = () => false, onNav = () => {} }) {
  const n = bia.length;
  let fistOn = getSettings().fistGrab !== false;
  // r72g: body[data-hand-vdrag="1"] = "view này nhận nắm tay kéo bia" (lớp cử chỉ: bật fistgrab; V không bao giờ vẩy ở đây)
  document.body.dataset.handVdrag = '1';

  const st = { kind: null, moved: false, moveSeq: 0, held: false, grabbed: false, x: 0.5, x0: 0.5, dxF: 0, dir: 0, along: 0, lastVx: 0, spd: 0, lastT: -1 };
  const log = import.meta.env.DEV ? [] : null;
  const note = (ev, o = {}) => {
    if (!log) return;
    log.push({ t: Math.round(performance.now()), ev, ...o });
    if (log.length > 400) log.splice(0, 200);
  };
  let adoptT = 0;
  /** Bản sẽ hiện của bia kề (đúng như load() sẽ chọn): LOD0 đã nung → LOD1 → proxy. */
  function rootFor(entry) {
    const b = lods.best(entry);
    if (b) return { root: b.root, proxy: false };
    const p = cachedRoot(entry.id, 2);
    return p ? { root: p, proxy: true } : null;
  }
  /** r59 → r62: bia của lượt cầm này bắt đầu đi thật (một lần mỗi lượt) — moveSeq tăng (index.js bắt theo sườn). */
  function markMoved() {
    if (st.moved) return;
    st.moved = true;
    st.moveSeq++;
  }
  /** r62: body[data-stele-grab] — loại lượt cầm đang có hiệu lực ('v' | 'fist'), null = gỡ. */
  function grabFlag(kind) {
    const b = document.body.dataset;
    if (kind) {
      if (b.steleGrab !== kind) b.steleGrab = kind;
    } else if ('steleGrab' in b) delete b.steleGrab;
  }
  function ungrab() {
    if (!st.grabbed) return;
    st.grabbed = false;
    st.dir = 0;
    st.along = 0;
    grabFlag(null);
    stage.setGrab(false);
  }
  function commit(vAlong) {
    const dir = st.dir;
    if (stage.scrub) stage.scrubCommit(Math.max(0, vAlong));
    note('commit', { kind: st.kind, dir, v: +vAlong.toFixed(3), along: +st.along.toFixed(4) });
    const kind = st.kind;
    ungrab();
    if (kind === 'fist') stage.setGrabCamera(false); // lượt lướt đã nhận đưa camera về khung bia mới
    select(index() + dir, false, dir);
    onNav(kind); // r62: view — hover của bia mới chờ (settings.grabHoverDelay)
    // điều hướng không tới được present (đang mở màn, lỗi…) → đừng để lượt kéo treo: lò xo về
    clearTimeout(adoptT);
    adoptT = window.setTimeout(() => {
      if (stage.scrub?.mode === 'drag' && !st.grabbed) stage.scrubCancel();
    }, 900);
  }
  function release(vAlong) {
    const sc = stage.scrub;
    const canFling = vAlong >= FLING_VX && st.along >= FLING_MIN_DX && st.dir !== 0;
    if (sc && sc.mode === 'drag') {
      if (canFling) {
        commit(vAlong);
        return;
      }
      stage.scrubCancel();
    } else if (!sc && stage.reduceMotion && canFling) {
      commit(vAlong);
      return;
    }
    note('release', { kind: st.kind, along: +st.along.toFixed(4) });
    ungrab();
  }
  /** r58: nắm tay — cầm ngay nếu bia đang focus; trả lý do bỏ qua (DEV / kiểm thử) hoặc null. */
  // (r65: vòng cầm hiện tại chỗ trên sàn — không còn biến hình từ vòng con trỏ; lớp cử chỉ vẫn gửi cursorX / cursorY / cursorR
  // trong sự kiện, view bỏ qua)
  function fistStart(x, vx) {
    const why = !fistOn ? 'off' : st.held ? 'busy' : !focused() ? 'no-focus' : blocked() ? 'blocked' : stage.transitioning || stage.scrub ? 'transition' : null;
    if (why) {
      note('fist-ignored', { why });
      return why;
    }
    Object.assign(st, { kind: 'fist', held: true, grabbed: true, moved: false, x0: x, x, dxF: 0, dir: 0, along: 0, lastT: -1, spd: 0 });
    grabFlag('fist');
    stage.setGrab(true, { kind: 'fist' });
    stage.setGrabCamera(true);
    note('grab', { kind: 'fist', x0: +x.toFixed(4) });
    onMove(x, vx);
    return null;
  }
  function fistEnd(phase, vx) {
    if (st.kind !== 'fist') return;
    const vAlong = phase === 'end' && st.grabbed ? (st.dir > 0 ? -vx : st.dir < 0 ? vx : 0) : 0;
    if (st.grabbed) release(vAlong);
    stage.setGrabCamera(false);
    st.held = false;
    st.kind = null;
  }

  function onMove(x, vx) {
    const now = performance.now();
    // tốc độ con trỏ tự đo (không dựa vào vx của lớp cử chỉ — có thể chưa làm mượt), EMA τ 90 ms
    let dtS = 0;
    if (st.lastT >= 0) {
      dtS = Math.max(1, now - st.lastT) / 1000;
      const k = 1 - Math.exp(-dtS / 0.09);
      st.spd += (Math.abs(x - st.x) / dtS - st.spd) * k;
    } else st.spd = 0;
    st.lastT = now;
    st.x = x;
    st.lastVx = vx;
    if (!st.grabbed) return; // r72: chỉ nắm tay — cầm ngay ở fistStart
    // ---- đang cầm
    const dx = x - st.x0;
    st.dxF = dtS > 0 ? st.dxF + (dx - st.dxF) * (1 - Math.exp(-dtS / DX_TAU)) : dx;
    const dxF = st.dxF;
    let sc = stage.scrub;
    if (!sc) {
      if (Math.abs(dxF) < DEAD_DX || stage.transitioning || blocked()) return;
      const dir = dxF < 0 ? 1 : -1;
      if (stage.reduceMotion) {
        // giảm chuyển động: không tua — chỉ ngưỡng quãng tay, rồi hiện tức thì (nav select)
        st.dir = dir;
        markMoved();
        st.along = Math.max(0, dir > 0 ? -dxF : dxF);
        stage.setGrabSide(dir > 0 ? 'left' : 'right');
        if (st.along >= COMMIT_DX) commit(dir > 0 ? -vx : vx);
        return;
      }
      const entry = bia[(((index() + dir) % n) + n) % n];
      const r = entry && rootFor(entry);
      if (!r || !stage.scrubBegin(r.root, dir, entry, { proxy: r.proxy })) return;
      st.dir = dir;
      markMoved(); // r59 → r62: bia thật sự bắt đầu đi (nắm tay hay V) → view: hai nút ‹ › thôi hút tay
      stage.setGrabSide(dir > 0 ? 'left' : 'right');
      note('side', { side: dir > 0 ? 'left' : 'right' });
      sc = stage.scrub;
    }
    if (sc.mode !== 'drag') return;
    const along = st.dir > 0 ? -dx : dx; // quãng tay theo chiều đang kéo (thô — sân khấu tự lọc One Euro)
    const alongF = st.dir > 0 ? -dxF : dxF; // … đã làm mượt: đổi chiều không theo run tay
    const vAlong = st.dir > 0 ? -vx : vx;
    if (alongF < -DEAD_DX && sc.k < 0.03) {
      // đổi chiều gần điểm đầu → bỏ lượt này (trả ngay), khung sau bắt đầu chiều kia
      stage.scrubAbort();
      st.dir = 0;
      st.along = 0;
      stage.setGrabSide(null);
      return;
    }
    st.along = Math.max(0, alongF);
    stage.scrubHand(along - DEAD_DX, vAlong);
    if (along >= COMMIT_DX) commit(vAlong); // ngưỡng nhận theo quãng thô (lọc thì nhận trễ ~v × τ); run tay ở đây vô hại
  }

  const onVdrag = (e) => {
    const d = e.detail || {};
    const x = Number(d.x);
    const vx = Number(d.vx) || 0;
    // r72: chỉ nắm tay (kind 'v' — kéo bia hai ngón — đã bỏ; lớp cử chỉ r72g không phát nữa, lỡ có thì bỏ qua)
    if (d.kind !== 'fist') return;
    if (d.phase === 'start') {
      if (Number.isFinite(x)) fistStart(x, vx);
    } else if (d.phase === 'move') {
      if (st.kind === 'fist' && st.grabbed && Number.isFinite(x)) onMove(x, vx);
    } else if (d.phase === 'end' || d.phase === 'cancel') fistEnd(d.phase, vx);
  };
  window.addEventListener('hand:vdrag', onVdrag);
  // r58: tắt "Nắm tay kéo bia" giữa lúc đang cầm → thả (lò xo về)
  const offSettings = onSettings(
    (s) => {
      fistOn = s.fistGrab !== false;
      if (!fistOn && st.kind === 'fist') fistEnd('cancel', 0);
    },
    { immediate: false },
  );

  const api = {
    /** V đang giữ (kiểu kéo bia) — index.js giữ trạng thái nghỉ (không hover). */
    get held() {
      return st.held;
    },
    get grabbed() {
      return st.grabbed;
    },
    /** r58: loại lượt đang giữ — 'v' | 'fist' | null. */
    get grabKind() {
      return st.kind;
    },
    /** r59 → r62: lượt cầm ĐANG CÓ HIỆU LỰC (nắm tay hay V) đã kéo bia đi thật (qua vùng chết). */
    get grabMoved() {
      return st.grabbed && st.moved;
    },
    /** r62: số lần một lượt cầm bắt đầu kéo bia đi thật — index.js bắt theo sườn: hai nút ‹ › thôi hút tay. */
    get moveSeq() {
      return st.moveSeq;
    },
    /** DEV / kiểm thử. */
    get debug() {
      return { kind: st.kind, fistOn, held: st.held, grabbed: st.grabbed, spd: +st.spd.toFixed(3), x0: +st.x0.toFixed(3), along: +st.along.toFixed(4), dir: st.dir, scrub: stage.scrub, grab: stage.grab };
    },
    /** DEV: nhật ký cầm / phía / nhận / nhả. */
    get log() {
      return log ? log.slice() : [];
    },
    destroy() {
      offSettings();
      window.removeEventListener('hand:vdrag', onVdrag);
      if (st.kind === 'fist') stage.setGrabCamera(false);
      clearTimeout(adoptT);
      grabFlag(null);
      if (document.body.dataset.handVdrag === '1') delete document.body.dataset.handVdrag;
      if (st.grabbed) stage.setGrab(false);
      if (import.meta.env.DEV && window.__vm?.cinemaVdrag === api) delete window.__vm.cinemaVdrag;
    },
  };
  if (import.meta.env.DEV) {
    (window.__vm ??= {}).cinemaVdrag = api;
    api.config = { DEAD_DX, COMMIT_DX, FLING_VX, FLING_MIN_DX };
  }
  return api;
}
