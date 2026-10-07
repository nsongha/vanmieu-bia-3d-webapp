// r71 → r72 — THÔNG TIN MỞ RỘNG (kiểu Bình phong, bia 1442 — dữ liệu văn bia src/data/stele-info/bia-1442.json nạp lười).
// r72 (người dùng): tấm sơn mài trong cảnh + MỘT lớp đọc toàn màn hình (bài ký → lạc khoản → đề danh), "Xem ĐỀ DANH", bỏ chú
// thích AI trên giao diện, rê vào tên trong đề danh, nắm tay để đóng, giữ hai ngón trên bia 2 s mở thông tin đầy đủ, tên
// khắc chìm trên thân bia lúc nghỉ.
//   0. lúc nghỉ: tên KHẮC trên mặt bia (trang theo giáp, dải tiêu đề, tên thật), trang tự sang; dữ liệu nạp lười
//   A. focus: hai tấm sơn mài (vua, triều, niên hiệu, 450 · 33, tam khôi), nút "Xem ĐỀ DANH" / "Đọc toàn văn", KHÔNG còn chú
//      thích "AI soạn"; tên trên mặt bia tắt
//   B. "Xem ĐỀ DANH" → lớp đọc mở thẳng ở Đề danh (đầu phần ngay dưới dải tên trang, đủ 33 tên, vừa một màn)
//   C. mục lục trái: bấm Bài ký / Lạc khoản / Đề danh → nhảy đúng phần (mục đang đọc sáng); "↑ Đầu trang" hiện khi đã cuộn,
//      bấm về đầu; "Đọc toàn văn" mở ở đầu (thẻ tiêu đề)
//   D. rê vào tên (chuột): tên sáng, các tên khác lùi, thẻ chi tiết (danh hiệu đầy đủ, quê; người có tiểu sử: năm, tiểu sử);
//      tay (hand:frame tổng hợp): tên gần tay nhất được hút + nở nhẹ
//   E. nắm tay giữ ~0,35 s → đóng (vòng quanh nút Đóng đầy dần); nắm thoáng 0,15 s → không đóng; Esc / nút Đóng vẫn được
//   F. 'hand:vhold' fire (giữ hai ngón trên bia 2 s — tổng hợp tới khi lớp cử chỉ r72g phát thật) → lớp đọc mở ở đầu; bia
//      khác (1448 — r79: mọi bia có văn bia) → lớp đọc của chính bia đó; body[data-hand-vhold="1"]
//   G. TAY qua lớp cử chỉ thật (con trỏ ẩn): vùng dính "Xem ĐỀ DANH" → nhón mở ở Đề danh; tới mục "Bài ký" + nhón → nhảy;
//      nắm tay thật → đóng; (r73) GIỮ CHỮ V thật trên bia → hand:vhold start / fire → lớp đọc mở ≤ 200 ms sau fire
//   H. tắt thông tin mở rộng → 1442 dùng bình phong gốc; tên trên mặt bia không tắt lúc focus
// r74 (người dùng): đọc = CAMERA TIẾN SÁT MẶT BIA + tấm đọc trong mờ trên hình chiếu phiến; giữ V trên mặt bia = QUÉT BẢN DẬP.
//   B. (r74) "Xem ĐỀ DANH" → quét nhanh rồi zoom: tấm đọc nằm trong hình chiếu phiến, camera ở phần dưới phiến
//   R. khung đọc: camera chính diện, đỉnh vòm trong khung lúc cuộn 0; cao độ camera giảm dần theo cuộn; cuộn 1 thấy mai rùa,
//      hộp đầu rùa dưới mép tấm; ~10 vị trí cuộn × 1180×820 · 1440×900 · 1920×1080 không lần nào đầu rùa chồng lên tấm;
//      nhảy mục lục → camera đi dài, êm (không nhảy cóc); chữ bật tức thì khi tấm đã hiện (không trước)
//   E. (r74) nắm tay đóng → camera về đúng khung trước khi mở (~1 s), bản dập tắt dần
//   S. quét bản dập (hand:vhold tổng hợp trên mặt bia): start → vạch ở đỉnh, (r84) vạch đi theo thời gian (≈ t / 3,2 s), camera nhích
//      vào khung đọc, tên trên mặt bia
//      mờ đi, camera đứng yên; cancel → rút về, tắt ≤ 0,4 s; fire → (r82b, chữ Hán bật — r83: mọi bia có bản dập) vạch + vệt bản
//      dập đi hết mặt bia, đóng → tắt
// r75 (thông tin thêm của 1442 — chỉ chữ, không huy hiệu):
//   X. tấm trái: dòng tỉ lệ đỗ dưới 450 | 33; tấm phải: "Soạn văn Thân Nhân Trung" rê chuột / tay → thẻ tiểu sử; dải chuyện
//      (chỉ mục vừa ~2 dòng) xoay vòng, dừng khi rê chuột / tay vào; lớp đọc: thẻ tiêu đề có dòng dựng bia, rê người soạn → thẻ;
//      5 ghi chú bên lề (ngoài tấm bên phải, dưới nút Đóng) canh đúng dòng neo, trôi theo cuộn, không chồng nhau / không chạm tấm
//      (ở nhiều vị trí cuộn), rê → mở hết; thuật ngữ giải nghĩa gạch chấm — chuột / tay rê → thẻ nghĩa; "Những người làm nên tấm
//      bia" (3 dòng, Tô Ngại "còn được ghi ở 6 bia khác", không nói là cùng một người); Đề danh: dòng tỉ lệ đỗ, danh hiệu (honors)
//      trên dòng hạng (dữ liệu thử), thẻ Trịnh Thiết Trường có "Xem bia khoa 1448" + "cần đối chiếu"; không chữ "honinh" trong DOM;
//      bấm năm 1448 trong khối người làm bia → lớp đọc đóng, lướt tới bia 1448
// r77:
//   Y. tấm đọc đỉnh vòm: mép trên giữ nguyên, chạy tới đáy khung, độ cong theo cài đặt (0 → chữ nhật), ở độ cong lớn nhất dải
//      tên trang + dòng đầu không bị vòm cắt; mở / đóng (r82 — thay "tấm đi cùng mặt đá" của r77): tấm trượt lên đơn điệu, tới
//      đúng ô nghỉ ngay khung camera dừng, không còn biến hình, chữ hiện đủ; đóng: trượt xuống đơn điệu, mờ hết đúng lúc camera
//      dừng (nhịp chi tiết, 5 chu kỳ, hai kiểu, giảm chuyển động: reader-zoom); không tự cuộn theo vị trí tay; kéo cuộn → ánh vàng mép dưới, dừng →
//      tắt ~0,4 s; tắt "Quét bản dập khi mở toàn văn": giữ V → không vạch / bản dập, vòng trên huy hiệu V hiện, lớp đọc mở ≤ 200 ms
//      sau fire; nút đọc mở ngay (không quét); tắt giữa lúc đang quét → tắt hẳn ngay
// r78 (tấm đọc Nổi 3D mặc định; B / R / X chạy ở kiểu 3D, Y chạy ở kiểu Phẳng = r77):
//   N. tấm là đối tượng CSS3D cố định trong cảnh (transform không đổi khi cuộn), đỉnh vòm đúng chỗ r77 lúc cuộn 0, cuộn cuối
//      đỉnh vòm ra khỏi khung; MỘT nguồn chuyển động: tỉ số độ dời camera / độ dịch chữ không đổi mọi khung (vuốt ném, bánh xe
//      dồn, nhảy mục lục); bóng tấm lệch khác đi khi camera đi; chất liệu đen 0,72 chung; điểm ảnh sau mục lục (tương phản);
//      p95 thời gian khung lúc cuộn ở 1920×1080 · 2560×1440
// node tests/cinema/rich-info.test.mjs --port 5180   (≈ 3 phút)
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';
import { installHand, removeHand } from '../lib/rub-sim.mjs';
import fs from 'node:fs';

// r83: khung mặt bia của bản dập 1442 (nguồn v2 — tools/fit-rubbings.mjs) — đỉnh vòm / chân mặt bia cho các phép kiểm vạch quét
const F1442 = JSON.parse(fs.readFileSync(new URL('../../src/data/rubbings.generated.json', import.meta.url), 'utf8')).steles['bia-1442'].frame;

const { port, headed } = parseArgs();
const report = createReport('rich-info');
const { page, close, errors } = await launch({
  headed,
  width: 1440,
  height: 900,
  // (camera vào 1,4 s như r74 → r79: các nhịp chờ của bộ này; thời gian mặc định 2,8 s kiểm ở reader-zoom.test.mjs)
  settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, readerZoomIn: 1.4, titleFxMode: 'fade' }, // r85: hiệu ứng tiêu đề kiểm ở transition.test.mjs
});
const requested = [];
page.on('request', (r) => {
  if (/stele-info\/.*\.json/.test(r.url())) requested.push(r.url().replace(/^.*\/src\//, 'src/'));
});
await openCinema(page, port, { id: 'bia-1554', hooks: ['cinemaStelePoint', 'cinemaPresence', 'cinemaRich', 'cinemaIdle', 'cinemaScan', 'cinemaRead', 'cinemaCam', '__vmHand.simulateHand'], settleMs: 2500 });
const E = (fn, a) => page.evaluate(fn, a);
const rect = (sel) => E((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom }; }, sel);
const rd = () => E(() => window.__vm.cinemaRich.dev()?.reader?.state() ?? null);
const ovOpen = () => E(() => !!window.__vm.cinemaRich.state().overlay);
/** Độ đục THẬT của tên trên mặt bia (nhân độ đục các tổ tiên tới lớp CSS3D), lớn nhất trong các ô tên. */
const namesAlpha = () => E(() => {
  let best = 0;
  for (const b of document.querySelectorAll('.cin-nm')) {
    let a = 1;
    for (let e = b; e && !e.classList?.contains('cin-css3d'); e = e.parentElement) {
      const cs = getComputedStyle(e);
      a *= +cs.opacity;
      if (cs.display === 'none' || cs.visibility === 'hidden') a = 0;
    }
    best = Math.max(best, a);
  }
  return +best.toFixed(3);
});
const focusStele = async () => {
  const p = await E(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.waitForFunction(() => window.__vm.cinemaPresence().shown, null, { timeout: 6000 }).catch(() => {});
  await sleep(1400);
};
const away = async () => {
  await page.mouse.move(60, 300, { steps: 4 });
  await sleep(2200);
};
const nameCentre = (name) => E((name) => { const el = [...document.querySelectorAll('.dd-p')].find((x) => x.querySelector('.dd-p__n')?.textContent === name); const b = el?.querySelector('.dd-p__n').getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, name);
const R = {};

// ---- 0. lúc nghỉ trên bia 1442
R.lazyBefore = [...requested];
await page.keyboard.press('Home');
await page.waitForFunction(() => window.__vm.cinemaIdle().index === 0, null, { timeout: 8000 }).catch(() => {});
await sleep(3500);
const face = () => E(() => {
  // khay đang hiện: ô tên có độ đục > 0,3
  const vis = (b) => {
    let a = 1;
    for (let e = b; e && !e.classList?.contains('cin-css3d'); e = e.parentElement) {
      const cs = getComputedStyle(e);
      a *= +cs.opacity;
      if (cs.display === 'none' || cs.visibility === 'hidden') a = 0;
    }
    return a > 0.3;
  };
  const box = [...document.querySelectorAll('.cin-nm')].find(vis);
  if (!box) return null;
  // r80: tên đỗ đầu chữ lớn đứng yên + những người còn lại cuộn dọc liên tục
  const hn = box.querySelector('.cin-nm__head .cin-nm__hn');
  const seq = box.querySelector('.cin-nm__seq');
  // r90: mỗi lúc một giáp — danh sách đang cuộn = giáp có tên giáp đang hiện (độ đục cao nhất)
  const lab = [...box.querySelectorAll('.cin-nm__ghl')].sort((a, b) => +getComputedStyle(b).opacity - +getComputedStyle(a).opacity)[0];
  const tr = lab ? box.querySelector(`.cin-nm__grp[data-g="${lab.dataset.g}"]`) : null;
  const cs = hn ? getComputedStyle(hn) : null;
  return {
    top: hn?.textContent ?? null,
    topTitle: box.querySelector('.cin-nm__head .cin-nm__ht')?.textContent ?? null,
    topFs: cs ? parseFloat(cs.fontSize) : 0,
    rowFs: parseFloat(getComputedStyle(box.querySelector('.cin-nm__it:not(.cin-nm__it--tam) .cin-nm__rn') ?? box).fontSize),
    headY: hn?.offsetTop ?? null,
    band: box.querySelector('.cin-nm__ghl[data-g="0"]')?.textContent ?? '', // r90: tên giáp (ô tên giáp cố định) của giáp đầu
    names: [...(seq?.querySelectorAll('.cin-nm__rn') ?? [])].map((e) => e.textContent),
    roll: { on: box.classList.contains('is-roll'), run: box.classList.contains('is-run'), y: tr ? new DOMMatrix(getComputedStyle(tr).transform).m42 : null, anim: tr ? getComputedStyle(tr).animationName : null, ct: tr?.getAnimations()[0]?.currentTime ?? null, T: (tr?.getAnimations()[0]?.effect.getTiming().duration ?? 0) },
    all: box.textContent,
    shadow: cs?.textShadow ?? '',
    font: cs?.fontFamily ?? '',
  };
});
R.face0 = await face();
await sleep(3000);
R.face1 = await face();
R.restAlpha = await namesAlpha();
R.lazyAfter = [...requested];

// ---- A. focus: hai tấm sơn mài
await focusStele();
R.A = await E(() => {
  const L = document.querySelector('.lq-leaf--l');
  const Rr = document.querySelector('.lq-leaf--r');
  const d = window.__vm.cinemaRich.state().dbg;
  return {
    cur: d?.cur,
    alpha: d?.rich?.leaves?.map((l) => l.alpha),
    king: L?.querySelector('.lq-king')?.textContent,
    reign: L?.querySelector('.lq-reign')?.textContent,
    figs: [...(L?.querySelectorAll('.lq-fig__v') ?? [])].map((e) => e.textContent),
    top: [...(L?.querySelectorAll('.lq-top .lq-nm') ?? [])].map((e) => e.textContent),
    names: L?.querySelector('.lq-btn--names .lq-btn__t')?.textContent,
    read: Rr?.querySelector('.lq-btn--read .lq-btn__t')?.textContent,
    ai: /AI soạn/i.test(Rr?.textContent ?? ''),
    intro: Rr?.querySelector('.lq-intro')?.textContent?.length ?? 0,
  };
});
R.Aface = await namesAlpha();

// ---- B. "Xem ĐỀ DANH" → quét nhanh → camera tiến sát mặt bia, lớp đọc ở Đề danh (chuột thật)
R.camFocus = await E(() => window.__vm.cinemaCam().pos);
const nb = await rect('.lq-btn--names');
await page.mouse.move(nb.x, nb.y, { steps: 4 });
await page.mouse.click(nb.x, nb.y);
await sleep(400);
R.Bscan = await E(() => ({ scan: window.__vm.cinemaScan(), open: window.__vm.cinemaRich.state().overlay }));
await sleep(3800); // r84: lượt quét của nút 2 s (vạch theo thời gian + camera nhích) rồi mới zoom
R.B = await E(() => {
  // r78: gốc lớp phủ = .ri-ov.rd; kiểu 3D: tấm + chữ nằm trong .rd--3d (lớp CSS3D) → tìm theo '.rd <con>'
  const ov = document.querySelector('.ri-ov.rd');
  const head = document.querySelector('.rd .dd-head').getBoundingClientRect();
  const pe = document.querySelector('.rd .rd-panel');
  const pr = pe.getBoundingClientRect();
  const cs = getComputedStyle(pe);
  const sheet3 = document.querySelector('.rd--3d');
  // (đầu phần tính từ mép trên Ô đọc trên màn — kiểu 3D: tấm cao hơn khung, đỉnh tấm đã ra khỏi khung khi ở Đề danh)
  const ry = window.__vm.cinemaRich.dev().reader.state().rect?.y ?? pr.top;
  return { open: ov.classList.contains('is-open'), modal: document.body.dataset.modal ?? null, headTop: Math.round(head.top - ry), names: document.querySelectorAll('.rd .dd-p').length, cur: ov.querySelector('.rd-toc__i.is-cur')?.textContent ?? null, text: ov.classList.contains('is-text'), bg: cs.backgroundColor, blur: cs.backdropFilter, blur3: sheet3 ? getComputedStyle(sheet3).backdropFilter : 'none', line: { border: cs.borderTopWidth, shadow: cs.boxShadow, outline: cs.outlineStyle, svg: pe.querySelectorAll('svg').length }, veil: getComputedStyle(ov.querySelector('.ri-ov__veil')).backgroundImage, is3d: !!sheet3 && document.querySelector('.rd .rd-slab')?.parentElement === sheet3 };
});
R.Bread = await E(() => window.__vm.cinemaRead());
R.Bscan2 = await E(() => window.__vm.cinemaScan());

// ---- R. khung đọc: cuộn → camera lên / xuống; đầu rùa không bao giờ chồng lên tấm
const sweep = () => E(async () => {
  const s = document.querySelector('.rd .ri-ov__scroll');
  const max = s.scrollHeight - s.clientHeight;
  const out = [];
  for (let i = 0; i <= 10; i++) {
    s.scrollTop = Math.round((max * i) / 10);
    s.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__vm.cinemaRead('snap');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const p = window.__vm.cinemaRead();
    const pr = document.querySelector('.rd .rd-panel').getBoundingClientRect();
    // (r78 kiểu 3D: tấm cao hơn khung, đáy luôn khuất dưới mép màn → phần THẤY được của tấm)
    out.push({ k: p.k, y: p.camLocal.y, apexY: p.apex.y, footY: p.faceBottom.y, head: p.head, shell: p.shell, left: p.left.x, right: p.right.x, panel: { l: pr.left, r: pr.right, t: pr.top, b: Math.min(pr.bottom, innerHeight) }, vh: innerHeight, fov: p.fov, pitch: p.sol?.ok });
  }
  return out;
});
R.sweep = {};
R.sweep['1440x900'] = await sweep();
for (const [w, hh] of [[1180, 820], [1920, 1080]]) {
  await page.setViewportSize({ width: w, height: hh });
  await sleep(900);
  R.sweep[`${w}x${hh}`] = await sweep();
}
await page.setViewportSize({ width: 1440, height: 900 });
await sleep(900);
// nhảy mục lục "Bài ký" từ Đề danh: camera đi dài, êm — vết cao độ camera mỗi khung
await E(() => { const s = document.querySelector('.rd .ri-ov__scroll'); s.scrollTop = s.scrollHeight; s.dispatchEvent(new Event('scroll')); window.__vm.cinemaRead('snap'); });
await sleep(300);
R.jumpTrace = await E(async () => {
  const b = [...document.querySelectorAll('.rd-toc__i')].find((x) => x.textContent === 'Bài ký');
  const tr = [];
  const t0 = performance.now();
  b.click();
  while (performance.now() - t0 < 2600) {
    await new Promise((r) => requestAnimationFrame(r));
    tr.push({ t: Math.round(performance.now() - t0), y: window.__vm.cinemaRead().camLocal.y });
  }
  return tr;
});
// về lại Đề danh cho phần D
await E(() => [...document.querySelectorAll('.rd-toc__i')].find((x) => x.textContent === 'Đề danh').click());
await sleep(2000);

// ---- D. rê vào tên (chuột thật)
let c = await nameCentre('Nguyễn Trực');
await page.mouse.move(c.x, c.y, { steps: 6 });
await sleep(700);
R.Dbio = await E(() => {
  const card = document.querySelector('.dd-card');
  const hot = document.querySelector('.dd-p.is-hot');
  const other = [...document.querySelectorAll('.dd-p')].find((x) => x !== hot);
  return { hot: hot?.querySelector('.dd-p__n').textContent, card: card.classList.contains('is-on'), bio: card.classList.contains('has-bio'), text: card.textContent, dim: +getComputedStyle(other).opacity, gold: getComputedStyle(hot.querySelector('.dd-p__n')).color, line: getComputedStyle(hot.querySelector('.dd-p__n'), '::after').transform };
});
c = await nameCentre('Bùi Hựu');
await page.mouse.move(c.x, c.y, { steps: 6 });
await sleep(700);
R.Dplain = await E(() => { const card = document.querySelector('.dd-card'); return { hot: document.querySelector('.dd-p.is-hot .dd-p__n')?.textContent, card: card.classList.contains('is-on'), bio: card.classList.contains('has-bio'), text: card.textContent }; });
await page.mouse.move(1380, 860, { steps: 4 });
await sleep(400);
R.Dleave = await E(() => ({ hot: !!document.querySelector('.dd-p.is-hot'), card: document.querySelector('.dd-card').classList.contains('is-on') }));
// tay (hand:frame tổng hợp) gần "Ngô Sĩ Liên"
c = await nameCentre('Ngô Sĩ Liên');
await E((c) => { for (let i = 0; i < 3; i++) window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'open', x: c.x + 30, y: c.y + 20, open5: true } })); }, c);
await sleep(500);
R.Dhand = await E(() => { const hot = document.querySelector('.dd-p.is-hot'); return { hot: hot?.querySelector('.dd-p__n').textContent, byHand: hot?.classList.contains('by-hand'), scale: hot ? getComputedStyle(hot).transform : null, card: document.querySelector('.dd-card').classList.contains('is-on') }; });
await E(() => window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })));

// ---- C. mục lục + đầu trang
const toc = async (label) => {
  const b = await E((label) => { const el = [...document.querySelectorAll('.rd-toc__i')].find((x) => x.textContent === label); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, label);
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.click(b.x, b.y);
  await sleep(1300);
  return rd();
};
R.Cbody = await toc('Bài ký');
R.Ccolo = await toc('Lạc khoản');
R.Ctop = await E(() => document.querySelector('.rd-top').classList.contains('is-on'));
const tb = await rect('.rd-top');
await page.mouse.click(tb.x, tb.y);
await sleep(1600);
R.CtopAfter = await E(() => ({ y: document.querySelector('.rd .ri-ov__scroll').scrollTop, on: document.querySelector('.rd-top').classList.contains('is-on') }));
R.Croll = await toc('Đề danh');

// ---- E. nắm tay giữ → đóng
const fistFor = (ms) => E(async (ms) => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'fist', fist: true, fistProgress: 1, x: 720, y: 450 } }));
    await new Promise((r) => requestAnimationFrame(r));
  }
  const cue = +getComputedStyle(document.querySelector('.ri-ov.rd')).getPropertyValue('--fist') || 0;
  window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'open', fist: false, fistProgress: 0, x: 720, y: 450 } }));
  return cue;
}, ms);
R.Eshort = { cue: await fistFor(150), open: await ovOpen() };
R.Elong = { cue: await fistFor(520) };
await sleep(500);
R.Elong.open = await ovOpen();
R.Elong.modal = await E(() => document.body.dataset.modal ?? null);
R.Elong.shown = await E(() => window.__vm.cinemaPresence().shown);
await sleep(1300);
R.Ecam = { cam: await E(() => window.__vm.cinemaCam()), read: (await E(() => window.__vm.cinemaRead())).on, scan: await E(() => window.__vm.cinemaScan()) };
await E(() => window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })));

// "Đọc toàn văn" mở ở đầu; Esc đóng
await focusStele();
const rb = await rect('.lq-btn--read');
await page.mouse.move(rb.x, rb.y, { steps: 4 });
await page.mouse.click(rb.x, rb.y);
await sleep(2800); // r84: + lượt quét 2 s
R.Cread = { ...(await rd()), y: await E(() => document.querySelector('.rd .ri-ov__scroll').scrollTop) };
await page.keyboard.press('Escape');
await sleep(700);
R.Cesc = await ovOpen();

// ---- S. quét bản dập (hand:vhold tổng hợp — lớp cử chỉ chỉ phát khi V trên MẶT bia) — lúc nghỉ (tên chạy trên mặt bia)
await away();
const vev = (phase, progress) => E(([phase, progress]) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })), [phase, progress]);
R.Scam0 = await E(() => window.__vm.cinemaCam().pos);
R.Sd0 = await E(() => window.__vm.cinemaCam().dist);
const tS0 = await E(() => performance.now());
await vev('start', 0);
await sleep(120);
R.S0 = await E(() => window.__vm.cinemaScan());
for (const k of [0.1, 0.2, 0.3, 0.4, 0.5]) {
  await vev('progress', k);
  await sleep(100);
}
await sleep(350);
R.S5 = { scan: await E(() => window.__vm.cinemaScan()), names: await namesAlpha(), cam: await E(() => window.__vm.cinemaCam().pos), dist: await E(() => window.__vm.cinemaCam().dist), t: (await E(() => performance.now())) - tS0, read: await E(() => window.__vm.cinemaRead()?.creep) };
await vev('cancel', 0.5);
await sleep(420);
R.Scancel = await E(() => window.__vm.cinemaScan());
await vev('start', 0);
await vev('progress', 0.6);
await vev('fire', 1);
await sleep(4800); // r84: vạch đi theo thời gian — bắn ngay lúc đầu → vạch + vệt ra khỏi mặt bia sau ~1,3 × 3,2 s
R.Sfire = { scan: await E(() => window.__vm.cinemaScan()), open: await ovOpen() };
await page.keyboard.press('Escape');
await sleep(1400);
R.Sclose = await E(() => window.__vm.cinemaScan());

// ---- F. giữ hai ngón (hand:vhold tổng hợp)
R.Fflag = await E(() => document.body.dataset.handVhold ?? null);
await away();
await E(() => {
  const ev = (phase, progress) => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase, progress, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } }));
  ev('start', 0);
  ev('progress', 0.5);
  ev('fire', 1);
});
await sleep(1300);
R.F = { open: await ovOpen(), y: await E(() => document.querySelector('.rd .ri-ov__scroll').scrollTop), cur: (await rd())?.cur };
await page.keyboard.press('Escape');
await sleep(700);
await away();
await page.keyboard.press('ArrowRight');
await page.waitForFunction(() => window.__vm.cinemaIdle().index === 1, null, { timeout: 8000 }).catch(() => {});
await sleep(2600);
await E(() => window.dispatchEvent(new CustomEvent('hand:vhold', { detail: { phase: 'fire', progress: 1, x: innerWidth / 2, y: innerHeight / 2, t: performance.now() } })));
await sleep(900);
R.Fother = { open: await ovOpen(), id: await E(() => window.__vm.cinemaRich.dev()?.info?.()?.id ?? null), run: await E(() => document.querySelector('.rd .rd-run')?.textContent ?? null), names: await E(() => document.querySelectorAll('.rd .dd-p').length) };
await page.keyboard.press('Escape');
await sleep(1300);
await away();
await page.keyboard.press('Home');
await page.waitForFunction(() => window.__vm.cinemaIdle().index === 0, null, { timeout: 8000 }).catch(() => {});
await sleep(2600);

// ---- G. tay (lớp cử chỉ thật, con trỏ ẩn)
await page.mouse.move(700, 880);
await installHand(page);
const aimAt = async (pt, ms = 1200) => {
  await E((p) => { window.__A.tgt = p; window.__A.pose = 'open'; }, pt);
  await sleep(ms);
};
const tap = async () => {
  await E(() => { window.__A.pose = 'pinch'; });
  await sleep(180);
  await E(() => { window.__A.pose = 'open'; });
  await sleep(500);
};
await aimAt(await E(() => window.__vm.cinemaStelePoint()), 1800);
await aimAt(await rect('.lq-btn--names'), 1600);
R.Gsticky = await E(() => ({ sticky: document.body.dataset.handSticky ?? null, shown: window.__vm.cinemaPresence().shown }));
await tap();
await sleep(2900); // r84: lượt quét của nút 2 s rồi mới mở
R.Gopen = { open: await ovOpen(), cur: (await rd())?.cur };
const tb2 = await E(() => { const el = [...document.querySelectorAll('.rd-toc__i')].find((x) => x.textContent === 'Bài ký'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await aimAt(tb2, 1200);
R.Gnear = await E(() => !!document.querySelector('.rd-toc__i[data-near]'));
await tap();
await sleep(1200);
R.Gjump = (await rd())?.cur;
await E(() => { window.__A.pose = 'fist'; });
await sleep(1100);
await E(() => { window.__A.pose = 'open'; });
await sleep(600);
R.Gfist = { open: await ovOpen(), modal: await E(() => document.body.dataset.modal ?? null) };
// r73: GIỮ CHỮ V THẬT trên bia (lớp cử chỉ r72g phát hand:vhold) → lớp đọc mở ngay sau 'fire'
await aimAt(await E(() => window.__vm.cinemaStelePoint()), 1600);
await E(() => {
  const V = (window.__V = { fire: -1, modal: -1, start: -1, cancel: [], panel: false });
  window.addEventListener('hand:vhold', (e) => {
    const d = e.detail || {};
    if (d.phase === 'start' && V.start < 0) V.start = performance.now();
    if (d.phase === 'fire' && V.fire < 0) V.fire = performance.now();
    if (d.phase === 'cancel') V.cancel.push(d.why);
  });
  new MutationObserver(() => {
    if (document.body.dataset.modal === 'reader' && V.modal < 0) {
      V.modal = performance.now();
      const ov = document.querySelector('.ri-ov.rd');
      V.panel = !!ov && !ov.hidden && !!document.querySelector('.rd .rd-panel');
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-modal'] });
});
await E(() => { window.__A.tgt = null; window.__A.pose = 'v'; });
await sleep(3400);
R.Gvhold = await E(() => { const V = window.__V; return { started: V.start > 0, fired: V.fire > 0, holdMs: V.fire > 0 && V.start > 0 ? Math.round(V.fire - V.start) : null, latencyMs: V.fire > 0 && V.modal > 0 ? Math.round(V.modal - V.fire) : null, panel: V.panel, cancel: V.cancel, open: window.__vm.cinemaRich.state().overlay, top: document.querySelector('.rd .ri-ov__scroll')?.scrollTop ?? null, log: window.__vm.cinemaVhold?.() ?? null }; });
await E(() => { window.__A.pose = 'open'; });
await page.keyboard.press('Escape');
await sleep(600);
await removeHand(page);

// ---- X. thông tin thêm (r75)
await away();
await page.keyboard.press('Home');
await page.waitForFunction(() => window.__vm.cinemaIdle().index === 0, null, { timeout: 8000 }).catch(() => {});
await sleep(2400);
await focusStele();
const lq = () => E(() => window.__vm.cinemaRich.state().dbg?.rich);
R.X0 = await lq();
const center = (sel) => E((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
// người soạn — chuột
let ap = await center('.lq-author');
await page.mouse.move(ap.x, ap.y, { steps: 4 });
await sleep(450);
R.XauthorMouse = (await lq()).author;
await page.mouse.move(ap.x, ap.y + 160, { steps: 3 });
await sleep(350);
R.XauthorOff = (await lq()).author.on;
// người soạn — tay (hand:frame tổng hợp)
await E((p) => { for (let i = 0; i < 3; i++) window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'open', x: p.x, y: p.y, open5: true } })); }, ap);
await sleep(300);
R.XauthorHand = (await lq()).author.on;
await E(() => window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })));
await sleep(200);
// dải chuyện: chu kỳ 1,2 s (kiểm thử) → đổi mục; rê chuột vào → dừng; rời → chạy tiếp
await E(() => window.__vm.cinemaRich.dev().stripPeriod(1.2));
await page.mouse.move(ap.x, ap.y + 200, { steps: 2 });
const s0 = (await lq()).strip.cur;
await sleep(2200);
const s1 = (await lq()).strip.cur;
const sp = await E(() => { const r = window.__vm.cinemaRich.dev().stripEl().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(sp.x, sp.y, { steps: 3 });
await sleep(300);
const sp0 = (await lq()).strip;
await sleep(2600);
const sp1 = (await lq()).strip;
await page.mouse.move(ap.x, ap.y + 200, { steps: 3 });
await sleep(2400);
const s2 = (await lq()).strip.cur;
await E(() => window.__vm.cinemaRich.dev().stripPeriod());
R.Xstrip = { items: sp0.items, s0, s1, pausedCur: [sp0.cur, sp1.cur], paused: sp0.paused && sp1.paused, s2, text: sp0.text };
// lớp đọc
await E(() => window.__vm.cinemaRich.dev().read());
await sleep(4500);
R.Xcard = await E(() => ({ by: document.querySelector('.rd-by')?.textContent, erect: document.querySelector('.rd-erect')?.textContent }));
ap = await center('.rd-author');
await page.mouse.move(ap.x, ap.y, { steps: 4 });
await sleep(500);
R.XrdAuthor = (await rd())?.hot;
await page.mouse.move(40, 450, { steps: 3 });
await sleep(300);
// ghi chú bên lề ở nhiều vị trí cuộn
R.Xnotes = await E(async () => {
  const s = document.querySelector('.rd .ri-ov__scroll');
  const max = s.scrollHeight - s.clientHeight;
  const close = document.querySelector('.rd .ri-ov__close').getBoundingClientRect();
  const out = [];
  for (let i = 0; i <= 24; i++) {
    s.scrollTop = Math.round((max * i) / 24);
    s.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const st = window.__vm.cinemaRich.dev().reader.state().notes;
    out.push({ k: i / 24, notes: st.map((n) => ({ on: n.on, top: n.top, bottom: n.bottom, left: n.left, ay: n.ay, y: n.y, label: n.label, key: n.key, labelKind: n.labelKind })), panel: st[0]?.panel, closeBottom: close.bottom });
  }
  return out;
});
// theo cuộn: đặt gloss (đoạn 3) giữa tấm, cuộn thêm 120 px → thẻ dời lên đúng 120 px
R.Xfollow = await E(async () => {
  const s = document.querySelector('.rd .ri-ov__scroll');
  const mk = document.querySelectorAll('.rd-p')[2];
  s.scrollTop = mk.offsetTop - 160;
  s.dispatchEvent(new Event('scroll'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const a = window.__vm.cinemaRich.dev().reader.state().notes.find((n) => n.kind === 'gloss');
  s.scrollTop += 120;
  s.dispatchEvent(new Event('scroll'));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = window.__vm.cinemaRich.dev().reader.state().notes.find((n) => n.kind === 'gloss');
  return { a: a && { top: a.top, on: a.on }, b: b && { top: b.top, on: b.on } };
});
// rê chuột lên ghi chú → mở
const gp = await E(() => { const n = window.__vm.cinemaRich.dev().reader.state().notes.find((x) => x.kind === 'gloss'); return n && { x: (n.left + n.right) / 2, y: n.top + 16 }; });
await page.mouse.move(gp.x, gp.y, { steps: 4 });
await sleep(400);
R.XnoteOpen = await E(() => { const n = window.__vm.cinemaRich.dev().reader.state().notes.find((x) => x.kind === 'gloss'); const el = [...document.querySelectorAll('.rd-sn')].find((e) => e.classList.contains('is-open')); return { open: n.open, full: el ? getComputedStyle(el.querySelector('.rd-sn__t')).webkitLineClamp : null, text: el?.textContent ?? '' }; });
// thuật ngữ: chuột
const tp = await center('.rd-term');
await page.mouse.move(tp.x, tp.y, { steps: 4 });
await sleep(500);
R.XtermMouse = (await rd())?.hot;
await page.mouse.move(40, 450, { steps: 3 });
await sleep(350);
// thuật ngữ: tay
const tp2 = await E(() => { const t = [...document.querySelectorAll('.rd-term')].find((x) => x.textContent === 'Đằng lục'); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await E((p) => { for (let i = 0; i < 3; i++) window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'open', x: p.x, y: p.y + 4, open5: true } })); }, tp2);
await sleep(500);
R.XtermHand = (await rd())?.hot;
await E(() => window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } })));
await sleep(200);
// người làm bia
R.Xcredits = await E(() => ({
  h: document.querySelector('.rd-credits__h')?.textContent,
  rows: [...document.querySelectorAll('.rd-cr')].map((r) => ({ role: r.querySelector('.rd-cr__r').textContent, name: r.querySelector('.rd-cr__n').textContent, x: r.querySelector('.rd-cr__x')?.textContent ?? null, links: [...r.querySelectorAll('button.rd-yr')].map((b) => b.textContent) })),
  inColo: !!document.querySelector('.rd-colo .rd-credits'),
}));
// Đề danh: tỉ lệ đỗ, danh hiệu (dữ liệu thử), thẻ Trịnh Thiết Trường
R.Xroll = await E(() => ({ rate: document.querySelector('.dd-rate')?.textContent ?? null, r1: document.querySelector('.dd-tier--1 .dd-p__r')?.textContent }));
R.Xhonors = await E(async () => {
  const dev = window.__vm.cinemaRich.dev();
  const info = dev.info();
  const clone = structuredClone(info);
  clone.laureates[0].honors = ['Danh hiệu thử'];
  clone.laureates[5].honors = ['Danh hiệu thử hai'];
  dev.reader.setInfo(clone);
  const r = [...document.querySelectorAll('.dd-p')].map((li) => li.querySelector('.dd-p__r')?.textContent ?? '');
  dev.reader.setInfo(info);
  return { first: r[0], sixth: r[5], count: r.filter(Boolean).length };
});
await E(() => [...document.querySelectorAll('.rd-toc__i')].find((x) => x.textContent === 'Đề danh').click());
await sleep(2200);
await E(() => { const el = [...document.querySelectorAll('.dd-p')].find((x) => x.querySelector('.dd-p__n')?.textContent === 'Trịnh Thiết Trường'); const s = document.querySelector('.rd .ri-ov__scroll'); s.scrollTop = el.offsetTop + el.closest('.dd').offsetTop - s.clientHeight / 2 + 200; s.dispatchEvent(new Event('scroll')); });
await sleep(900);
const tt = await E(() => { const el = [...document.querySelectorAll('.dd-p')].find((x) => x.querySelector('.dd-p__n')?.textContent === 'Trịnh Thiết Trường'); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
await page.mouse.move(tt.x, tt.y, { steps: 5 });
await sleep(700);
R.Xtt = { hot: (await rd())?.hot, link: await E(() => [...document.querySelectorAll('.dd-card button.rd-yr')].map((b) => b.textContent)), verify: await E(() => document.querySelector('.dd-card .dd-card__verify')?.textContent ?? null) };
R.Xhoninh = await E(() => document.documentElement.outerHTML.toLowerCase().includes('honinh'));
R.Xsame = await E(() => /cùng một người/i.test([...document.querySelectorAll('.rd')].map((e) => e.textContent).join(' ')));
// bấm năm 1448 (người làm bia) → đóng lớp đọc, lướt tới 1448
await E(() => { const s = document.querySelector('.rd .ri-ov__scroll'); const c = document.querySelector('.rd-credits'); s.scrollTop = c.offsetTop - 200; s.dispatchEvent(new Event('scroll')); });
await sleep(1200);
const yb = await E(() => { const b = [...document.querySelectorAll('.rd-credits button.rd-yr')].find((x) => x.textContent === '1448'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(yb.x, yb.y, { steps: 3 });
await page.mouse.click(yb.x, yb.y);
await page.waitForFunction(() => window.__vm.cinemaIdle().id === 'bia-1448', null, { timeout: 8000 }).catch(() => {});
await sleep(600);
R.Xgo = { id: await E(() => window.__vm.cinemaIdle().id), open: await ovOpen(), read: (await E(() => window.__vm.cinemaRead())).on };
await away();
await page.keyboard.press('Home');
await page.waitForFunction(() => window.__vm.cinemaIdle().index === 0, null, { timeout: 8000 }).catch(() => {});
await sleep(2600);

// ---- N. r78: tấm đọc NỔI 3D (mặc định) — MỘT nguồn chuyển động · đối tượng CSS3D cố định trong cảnh · bóng · mục lục có nền
const setS = (k, v) => E(([k, v]) => window.__vm.settings.set(k, v), [k, v]);
await focusStele();
await E(() => window.__vm.cinemaRich.dev().read());
await sleep(4700);
await page.mouse.move(40, 450);
await sleep(300);
const n3 = () => E(() => {
  const sheet3 = document.querySelector('.rd--3d');
  const pe = document.querySelector('.rd .rd-panel');
  const pr = pe.getBoundingClientRect();
  const st = window.__vm.cinemaRich.dev().reader.state();
  const r = window.__vm.cinemaRead();
  const bg = (sel, pseudo) => { const e = document.querySelector(sel); return e ? getComputedStyle(e, pseudo).backgroundColor : null; };
  const toc = document.querySelector('.rd-toc');
  const tb = toc.getBoundingClientRect();
  const tcs = getComputedStyle(toc, '::before');
  return {
    inCss3d: !!sheet3?.closest('.cin-css3d__root'), tf: sheet3?.style.transform ?? '', slabIn3d: document.querySelector('.rd .rd-slab')?.parentElement === sheet3, snIn3d: !!document.querySelector('.rd--3d .rd-sn'),
    mode: st.mode, top: pr.top, bottom: pr.bottom, w: pr.width, vh: innerHeight, rise: st.arch.rise, clip: pe.style.clipPath, offset: st.offset, pos: st.scroll.pos, max: st.scroll.max,
    camY: r.camLocal.y, edges: r.edges, shadowK: r.shadow?.k,
    tocBg: bg('.rd-toc', '::before'), tocRadius: parseFloat(tcs.borderTopLeftRadius), topBg: bg('.rd .rd-top'), closeBg: bg('.rd .ri-ov__close'), snBg: bg('.rd-sn'),
    card: { l: tb.left + parseFloat(tcs.left), t: tb.top + parseFloat(tcs.top), r: tb.right - parseFloat(tcs.right), b: tb.bottom - parseFloat(tcs.bottom) },
    labels: [...document.querySelectorAll('.rd-toc__i')].map((b) => { const q = b.querySelector('.rd-toc__t') ?? b; const x = q.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom, cur: b.classList.contains('is-cur') }; }),
    faceLeft: r.left.x,
  };
});
R.N0 = await n3();
// điểm ảnh sau mục lục (ảnh chụp thật): nền thẻ tối, chữ mục lục tương phản ≥ 4,5 trên phần nền có đá phía sau
{
  const png = (await page.screenshot()).toString('base64');
  R.Npx = await E(async ({ b64, card, labels, faceLeft }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const k = img.width / innerWidth;
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (x, y) => { const i = (Math.round(y * k) * img.width + Math.round(x * k)) * 4; return 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); };
    const inLabel = (x, y) => labels.some((b) => x >= b.l - 14 && x <= b.r + 4 && y >= b.t - 6 && y <= b.b + 6);
    // nền: phần thẻ có đá phía sau (x > mép trái mặt bia), trừ vùng chữ / chấm / đường chỉ
    const bgL = [];
    for (let y = card.t + 18; y < card.b - 18; y += 2) for (let x = Math.max(card.l + 34, faceLeft + 4); x < card.r - 18; x += 2) if (!inLabel(x, y)) bgL.push(L(x, y));
    bgL.sort((a, b) => a - b);
    const bgHi = bgL.length ? bgL[Math.floor(bgL.length * 0.95)] : null;
    const rows = labels.map((b) => {
      let hi = 0;
      for (let y = b.t; y <= b.b; y++) for (let x = b.l; x <= b.r; x++) hi = Math.max(hi, L(x, y));
      return { cur: b.cur, text: +hi.toFixed(3), ratio: +((hi + 0.05) / (bgHi + 0.05)).toFixed(2) };
    });
    // đá quanh thẻ (không có thẻ phía trên) — để thấy thẻ thật sự tối hơn đá
    const out = [];
    for (let y = card.t + 18; y < card.b - 18; y += 3) for (let x = card.r + 8; x < card.r + 40; x += 3) out.push(L(x, y));
    out.sort((a, b) => a - b);
    return { n: bgL.length, bgHi: +(bgHi ?? 0).toFixed(3), stone: +(out[Math.floor(out.length / 2)] ?? 0).toFixed(3), rows };
  }, { b64: png, card: R.N0.card, labels: R.N0.labels, faceLeft: R.N0.faceLeft });
}
// MỘT nguồn chuyển động: vết mỗi khung (độ dịch chữ trong tấm, cao độ camera) khi vuốt ném / cuộn bánh xe dồn / nhảy mục lục
const trace = (ms) => E(async (ms) => {
  const out = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    await new Promise((r) => requestAnimationFrame(r));
    const st = window.__vm.cinemaRich.dev().reader.state();
    out.push({ o: st.offset, y: window.__vm.cinemaRead().camLocal.y, tf: document.querySelector('.rd--3d').style.transform });
  }
  return out;
}, ms);
const pc3 = await E(() => { const r = document.querySelector('.rd .rd-panel').getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(innerHeight, r.bottom) * 0.6 }; });
R.Nyz = R.N0.camY;
{
  const tp = trace(2600);
  await page.mouse.move(pc3.x, pc3.y + 120);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(pc3.x, pc3.y + 120 - i * 32);
    await sleep(16);
  }
  await page.mouse.up();
  R.Nfling = await tp;
}
await sleep(400);
{
  const tp = trace(1800);
  await page.mouse.move(pc3.x, pc3.y);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 140);
    await sleep(35);
  }
  R.Nwheel = await tp;
}
await sleep(400);
{
  const tp = trace(2600);
  await E(() => [...document.querySelectorAll('.rd-toc__i')].find((x) => x.textContent === 'Đề danh').click());
  R.Njump = await tp;
}
await sleep(500);
R.N1 = await n3();
// cuộn tới cuối (đỉnh vòm đã ra khỏi khung)
await E(() => { const s = document.querySelector('.rd .ri-ov__scroll'); s.scrollTop = s.scrollHeight; });
await sleep(900);
R.N2 = await n3();
await E(() => { document.querySelector('.rd .ri-ov__scroll').scrollTop = 0; });
await sleep(900);
// thời gian khung lúc cuộn liên tục (bánh xe mỗi 40 ms, 2,4 s) ở 1920×1080 · 2560×1440 — không đo gì nặng trong vòng đo
const frameTimes = () => E(async () => {
  const s = document.querySelector('.rd .ri-ov__scroll');
  const r = s.getBoundingClientRect();
  const dts = [];
  let last = 0;
  let on = true;
  const loop = (t) => { if (last) dts.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  for (let i = 0; i < 60; i++) {
    s.dispatchEvent(new WheelEvent('wheel', { deltaY: i < 30 ? 90 : -90, clientX: r.left + r.width / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true }));
    await new Promise((res) => setTimeout(res, 40));
  }
  on = false;
  dts.sort((a, b) => a - b);
  const q = (p) => +dts[Math.min(dts.length - 1, Math.floor(dts.length * p))].toFixed(1);
  return { n: dts.length, p50: q(0.5), p95: q(0.95), max: +dts.at(-1).toFixed(1) };
});
R.Nft = {};
for (const [w, hh] of [[1920, 1080], [2560, 1440]]) {
  await page.setViewportSize({ width: w, height: hh });
  await sleep(1200);
  R.Nft[`${w}x${hh}`] = await frameTimes();
}
await page.setViewportSize({ width: 1440, height: 900 });
await sleep(900);
await page.keyboard.press('Escape');
await sleep(1500);

// ---- Y. r77: tấm đọc đỉnh vòm · đi cùng mặt đá · cuộn · tắt quét bản dập — r78: chạy ở kiểu PHẲNG (Phẳng = r77 + nền mới)
await setS('readerMode', 'flat');
await focusStele();
const panelInfo = () => E(() => {
  const p = document.querySelector('.rd .rd-panel').getBoundingClientRect();
  const sc = document.querySelector('.rd .ri-ov__scroll').getBoundingClientRect();
  const run = document.querySelector('.rd .rd-run').getBoundingClientRect();
  const st = window.__vm.cinemaRich.dev().reader.state();
  return { l: p.left, r: p.right, t: p.top, b: p.bottom, w: p.width, vh: innerHeight, clip: document.querySelector('.rd .rd-panel').style.clipPath, arch: st.arch, scrollTop: sc.top, run: { l: run.left, r: run.right, t: run.top }, rect: st.rect, slab: st.slab, settled: st.settled };
});
// vết mở / đóng (r82: tấm TRƯỢT lên / xuống theo đoạn camera — thay "tấm theo dấu chân trên đá" của r77): mép trên tấm trên màn,
// độ hiện, nhịp trượt, chữ mỗi khung
await E(() => {
  const T = (window.__TR = { on: true, rows: [] });
  const rec = () => {
    if (!T.on) return;
    const r = window.__vm.cinemaRead();
    const root = document.querySelector('.ri-ov.rd');
    const pe = document.querySelector('.rd .rd-panel');
    const st = window.__vm.cinemaRich.dev().reader.state();
    const pr = pe?.getBoundingClientRect();
    T.rows.push({ tw: r?.tw, m: st.motion, op: +(st.slab.opacity || (root && !root.hidden && root.classList.contains('is-open') ? 1 : 0)), tr: st.slab.transform, hidden: !!root?.hidden, top: pr ? pr.top : null, fx: st.textFx, text: st.text });
    requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
});
await E(() => window.__vm.cinemaRich.dev().read());
await sleep(4500);
R.Yopen = await E(() => { const r = window.__TR.rows; window.__TR.rows = []; return r; });
R.Y0 = await panelInfo();
// độ cong: lớn nhất → dải tên trang + vùng chữ dưới vòm; phẳng → chữ nhật
await setS('readerArch', 1);
await sleep(250);
R.Ymax = await panelInfo();
await setS('readerArch', 0);
await sleep(250);
R.Yflat = await panelInfo();
await setS('readerArch', 0.55);
await sleep(250);
// không tự cuộn theo vị trí tay (xoè tay ở dải dưới cũ ~0,7 H trong 1,5 s)
R.YnoEdge = await E(async () => {
  const s = document.querySelector('.rd .ri-ov__scroll');
  s.scrollTop = 300;
  await new Promise((r) => setTimeout(r, 450));
  const y0 = s.scrollTop;
  const pr = document.querySelector('.rd .rd-panel').getBoundingClientRect();
  for (let i = 0; i < 45; i++) {
    window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: true, engaged: true, pose: 'open', x: pr.left + pr.width / 2, y: innerHeight * 0.7, open5: true } }));
    await new Promise((r) => setTimeout(r, 33));
  }
  window.dispatchEvent(new CustomEvent('hand:frame', { detail: { detected: false } }));
  return { y0, y1: s.scrollTop, edge: s.dataset.edge ?? null };
});
await sleep(700);
// kéo cuộn (chuột kéo trang) → ánh vàng mép dưới; dừng → tắt ~0,4 s
const pc = await E(() => { const r = document.querySelector('.rd .ri-ov__scroll').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 }; });
const glow = () => E(() => ({ flag: document.querySelector('.ri-ov.rd').dataset.scrolling ?? null, op: +getComputedStyle(document.querySelector('.rd .ri-ov__sheet'), '::after').opacity }));
await page.mouse.move(pc.x, pc.y);
await page.mouse.down();
for (let i = 0; i < 12; i++) {
  await page.mouse.move(pc.x, pc.y - i * 14);
  await sleep(30);
}
R.YglowOn = await glow();
await page.mouse.up();
// (thả ra còn trôi theo đà ~1,5 s — ánh còn trong lúc trôi) → chờ hết trôi + 0,4 s
await E(async () => {
  const s = document.querySelector('.rd .ri-ov__scroll');
  for (let i = 0; i < 40; i++) {
    const v = s.scrollTop;
    await new Promise((r) => setTimeout(r, 150));
    if (s.scrollTop === v) return;
  }
});
await sleep(750);
R.YglowOff = await glow();
// đóng: tấm trượt xuống cùng đoạn camera lùi
await E(() => (window.__TR.rows = []));
await page.keyboard.press('Escape');
await sleep(1600);
R.Yclose = await E(() => { window.__TR.on = false; return window.__TR.rows; });
// tắt quét bản dập
await setS('cinemaRubbingScan', false);
await sleep(200);
R.YoffFlag = await E(() => ({ scanFlag: document.body.dataset.handVholdScan ?? null, enabled: window.__vm.cinemaScan().enabled }));
// nút "Đọc toàn văn" → mở NGAY (không quét)
await focusStele();
const rb2 = await rect('.lq-btn--read');
await page.mouse.move(rb2.x, rb2.y, { steps: 3 });
const tClick = await E(() => performance.now());
await page.mouse.click(rb2.x, rb2.y);
await sleep(150);
R.YoffBtn = { open: await ovOpen(), scan: (await E(() => window.__vm.cinemaScan())).mode, ms: Math.round((await E(() => performance.now())) - tClick) };
await page.keyboard.press('Escape');
await sleep(1300);
// tay thật: giữ V trên mặt bia → vòng trên huy hiệu V hiện, không vạch, lớp đọc mở ≤ 200 ms sau fire
await page.mouse.move(700, 880);
await installHand(page);
await aimAt(await E(() => window.__vm.cinemaStelePoint()), 1600);
await E(() => {
  const V = (window.__V2 = { fire: -1, modal: -1, ring: 0, runFrames: 0, scanModes: new Set() });
  window.addEventListener('hand:vhold', (e) => { if (e.detail?.phase === 'fire' && V.fire < 0) V.fire = performance.now(); });
  new MutationObserver(() => { if (document.body.dataset.modal === 'reader' && V.modal < 0) V.modal = performance.now(); }).observe(document.body, { attributes: true, attributeFilter: ['data-modal'] });
  const rec = () => {
    const c = document.querySelector('.hi-cursor');
    if (c?.dataset.vhold === 'run') {
      V.runFrames++;
      V.ring = Math.max(V.ring, +getComputedStyle(c.querySelector('.hi-vhold')).opacity);
    }
    // r82b: quét tắt mà chữ Hán bật → máy trạng thái quét vẫn chạy (vạch ẩn, chữ sáng theo nó) — "không vạch / bản dập" = uScan.w 0
    const sc = window.__vm.cinemaScan();
    V.scanModes.add(sc.u ? `w${sc.u[3]}` : 'w0');
    if (V.modal < 0) requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
});
await E(() => { window.__A.tgt = null; window.__A.pose = 'v'; });
await sleep(3400);
R.YoffV = await E(() => { const V = window.__V2; return { fired: V.fire > 0, latencyMs: V.fire > 0 && V.modal > 0 ? Math.round(V.modal - V.fire) : null, ring: +V.ring.toFixed(2), runFrames: V.runFrames, scan: [...V.scanModes], open: window.__vm.cinemaRich.state().overlay, face: document.body.dataset.handOverFace ?? null }; });
await E(() => { window.__A.pose = 'open'; });
await page.keyboard.press('Escape');
await sleep(800);
await removeHand(page);
// bật lại; tắt GIỮA LÚC đang quét → tắt hẳn ngay (không để bản dập hiện dở)
await setS('cinemaRubbingScan', true);
await sleep(200);
await away();
await vev('start', 0);
await vev('progress', 0.5);
await sleep(200);
const midScan = (await E(() => window.__vm.cinemaScan())).mode;
await setS('cinemaRubbingScan', false);
await sleep(60);
R.YliveOff = { before: midScan, after: await E(() => window.__vm.cinemaScan()) };
await vev('cancel', 0.5);
await setS('cinemaRubbingScan', true);
await sleep(300);

await setS('readerMode', '3d');

// ---- H. tắt → bình phong gốc
await away();
await E(() => window.__vm.cinemaRich.use(false));
await focusStele();
R.H = await E(() => ({ rich: window.__vm.cinemaRich.state().rich, lq: [...document.querySelectorAll('.lq-leaf')].some((e) => +getComputedStyle(e.parentElement).opacity > 0.5), bp: [...document.querySelectorAll('.bp-leaf')].some((e) => +getComputedStyle(e.parentElement).opacity > 0.5) }));
R.Hface = await namesAlpha();

// ---------------------------------------------------------------------------- kiểm
report.section('0. tên khắc trên mặt bia lúc nghỉ');
// r79: cả 82 bia có văn bia — nạp lười theo bia: lúc mở ở 1554 chỉ tải vài tệp quanh bia đang xem (không tải hết), chưa tải 1442;
// tới 1442 mới tải tệp của 1442
report.check('dữ liệu văn bia nạp lười theo bia: mở ở 1554 → tải tệp của 1554, chưa tải 1442 (không tải cả 82); tới 1442 → tải 1442', R.lazyBefore.some((u) => /bia-1554\.json/.test(u)) && !R.lazyBefore.some((u) => /bia-1442\.json/.test(u)) && R.lazyBefore.length <= 5 && R.lazyAfter.some((u) => /bia-1442\.json/.test(u)), { before: R.lazyBefore, after: R.lazyAfter });
report.check('r80: Trạng nguyên Nguyễn Trực chữ LỚN đứng yên đầu ô (lớn hơn tên thường ≥ 1,5×); 32 người còn lại trong danh sách cuộn, nhãn giáp đầu "Đệ nhất giáp" (r89: nhãn dọc ở lề); không tên mẫu', R.face0?.top === 'Nguyễn Trực' && R.face0.topTitle === 'Trạng nguyên' && R.face0.topFs >= R.face0.rowFs * 1.5 && R.face0.names.length === 32 && R.face0.names.slice(0, 2).join() === 'Nguyễn Như Đổ,Lương Như Hộc' && /Đệ nhất giáp/i.test(R.face0.band) && !/mẫu/i.test(R.face0.all), { ...R.face0, all: undefined, names: R.face0?.names.length });
const shadows = (R.face0?.shadow ?? '').split(/,(?![^(]*\))/).filter((x) => /px/.test(x));
report.check('chữ khắc: chữ có chân (Playfair) + bóng khắc (≥ 2 lớp text-shadow lệch theo đèn), không nhãn "TIẾN SĨ" lặp mỗi tên', /Playfair/.test(R.face0?.font ?? '') && shadows.length >= 2 && !/TIẾN SĨ\s*Nguyễn Hộc/i.test(R.face0?.all ?? ''), { font: R.face0?.font, shadow: R.face0?.shadow });
report.check('r80 → r90: danh sách cuộn theo giáp (hoạt ảnh compositor đang chạy — lịch đi đúng ~3 s sau 3 s); tên đỗ đầu đứng yên; tên hiện rõ lúc nghỉ', R.face1?.roll.on && R.face1.roll.run && /^cin-nm-g-/.test(R.face1.roll.anim) && ((R.face1.roll.ct - R.face0.roll.ct + R.face1.roll.T) % R.face1.roll.T) > 2000 && ((R.face1.roll.ct - R.face0.roll.ct + R.face1.roll.T) % R.face1.roll.T) < 4800 && R.face1.headY === R.face0.headY && R.restAlpha > 0.5, { roll0: R.face0?.roll, roll1: R.face1?.roll, alpha: R.restAlpha });
report.section('A. tấm sơn mài lúc focus');
report.check('hai tấm giàu thông tin mở hẳn (không phải bình phong gốc)', R.A.cur === 'rich' && R.A.alpha?.every((a) => a > 0.95), R.A);
report.check('tấm trái: Lê Thái Tông · Lê sơ · niên hiệu Đại Bảo · 450 / 33 · tam khôi', R.A.king === 'Lê Thái Tông' && /Lê sơ/.test(R.A.reign) && /Đại Bảo/.test(R.A.reign) && R.A.figs.join() === '450,33' && R.A.top.join() === 'Nguyễn Trực,Nguyễn Như Đổ,Lương Như Hộc', R.A);
report.check('nút "Xem ĐỀ DANH" + "Đọc toàn văn"; KHÔNG còn chú thích "AI soạn" trên giao diện', R.A.names === 'Xem ĐỀ DANH' && R.A.read === 'Đọc toàn văn' && !R.A.ai && R.A.intro > 300, { names: R.A.names, read: R.A.read, ai: R.A.ai });
report.check('r80: lúc focus tên trên mặt bia VẪN hiện (không nhường chỗ cho tấm trái nữa)', R.Aface > 0.5, R.Aface);
report.section('B. Xem ĐỀ DANH');
report.check('bấm "Xem ĐỀ DANH": lượt quét bản dập trước (r84: như giữ V — vạch đang chạy theo thời gian, lớp đọc chưa mở)', R.Bscan.scan.mode === 'play' && R.Bscan.scan.p > 0.05 && R.Bscan.scan.p < 1 && !R.Bscan.open, R.Bscan);
// r82b → r83: mọi bia có bản dập → chế độ vệt: quét xong không còn bản dập (vệt đã đi hết mặt bia) — kiểu r74 "ở lại" đã bỏ
report.check('mở lớp đọc thẳng ở Đề danh: đầu phần sát mép trên tấm, đủ 33 tên, mục lục sáng "Đề danh"; lượt quét xong (chế độ vệt — không bản dập ở lại)', R.B.open && R.B.modal === 'reader' && R.B.headTop >= 0 && R.B.headTop <= 140 && R.B.names === 33 && R.B.cur === 'Đề danh' && R.B.text && R.Bscan2.mode === 'held' && R.Bscan2.trail && R.Bscan2.reveal === 0, { ...R.B, scan: R.Bscan2 });
report.check('tấm đọc (r78): nền đen trong mờ ~0,72, KHÔNG nhoè phía sau, KHÔNG viền vàng; KHÔNG màn tối phủ kín; mặc định kiểu Nổi 3D', /^rgba\(0, 0, 0, 0\.72\)$/.test(R.B.bg) && (R.B.blur === 'none' || !R.B.blur) && (R.B.blur3 === 'none' || !R.B.blur3) && R.B.line.border === '0px' && R.B.line.shadow === 'none' && R.B.line.svg === 0 && R.B.line.outline === 'none' && /radial-gradient/.test(R.B.veil) && R.B.is3d, { bg: R.B.bg, blur: R.B.blur, blur3: R.B.blur3, line: R.B.line, is3d: R.B.is3d });
const bp = R.Bread;
report.check('camera tiến sát (chính diện) ở phần dưới phiến (vị trí cuộn của Đề danh); tấm nằm trong hình chiếu phiến (mép bia còn thấy hai bên)', bp.on && !bp.tw && bp.k > 0.6 && bp.left.x < bp.rect.x - 8 && bp.right.x > bp.rect.x + bp.rect.w + 8 && Math.abs((bp.left.x + bp.right.x) / 2 - (bp.rect.x + bp.rect.w / 2)) < 12 && bp.camLocal.z < 1.2, { k: bp.k, left: bp.left.x, right: bp.right.x, rect: bp.rect, cam: bp.camLocal, sol: bp.sol });
report.section('R. khung đọc: cuộn → camera lên / xuống');
for (const [size, sw] of Object.entries(R.sweep)) {
  const [w, hh] = size.split('x').map(Number);
  const mono = sw.every((r, i) => i === 0 || r.y <= sw[i - 1].y + 1e-4) && sw[0].y - sw.at(-1).y > 0.05;
  const overlap = sw.filter((r) => r.head && r.head.y0 < r.panel.b && r.head.y1 > r.panel.t && r.head.x0 < r.panel.r && r.head.x1 > r.panel.l && r.head.y0 < hh);
  report.check(`${size}: cao độ camera giảm dần theo cuộn (${sw[0].y.toFixed(3)} → ${sw.at(-1).y.toFixed(3)})`, mono, sw.map((r) => +r.y.toFixed(4)));
  report.check(`${size}: cuộn 0 → thấy đỉnh vòm (trong khung, trên mép trên tấm)`, sw[0].apexY >= 0 && sw[0].apexY < sw[0].panel.t, { apexY: sw[0].apexY, panelTop: sw[0].panel.t });
  // r77: tấm chạy tới đáy khung → hộp đầu rùa phải ra NGOÀI khung (dưới mép tấm = mép khung); phần dưới phiến vẫn trong khung
  report.check(`${size}: cuộn 1 → phần dưới phiến trong khung (chân mặt bia gần đáy), hộp đầu rùa ngoài khung dưới mép tấm (tấm chạy tới đáy khung)`, sw.at(-1).head && sw.at(-1).head.y0 >= sw.at(-1).panel.b && sw.at(-1).panel.b >= sw.at(-1).vh - 1 && sw.at(-1).footY > sw.at(-1).vh * 0.8 && sw.at(-1).footY < sw.at(-1).vh * 1.15, { foot: sw.at(-1).footY, head: sw.at(-1).head, panelBottom: sw.at(-1).panel.b, vh: sw.at(-1).vh });
  report.check(`${size}: 11 vị trí cuộn — đầu rùa KHÔNG lần nào chồng lên tấm; tấm luôn trong hình chiếu phiến; FOV giữ nguyên`, overlap.length === 0 && sw.every((r) => r.left < r.panel.l && r.right > r.panel.r) && sw.every((r) => Math.abs(r.fov - sw[0].fov) < 1e-3), { overlap: overlap.length, fov: sw[0].fov, first: overlap[0] ?? null });
}
{
  const tr = R.jumpTrace;
  const dys = tr.slice(1).map((r, i) => r.y - tr[i].y);
  const moving = tr.filter((r, i) => i > 0 && Math.abs(r.y - tr[i - 1].y) > 1e-5);
  const span = tr.at(-1).y - tr[0].y;
  const maxStep = Math.max(...dys.map(Math.abs));
  report.check('nhảy mục lục (Đề danh → Bài ký): camera đi dài, êm — ≥ 0,8 s, không bước nào > 12 % quãng đường', span > 0.1 && moving.length && moving.at(-1).t - moving[0].t >= 800 && maxStep < 0.12 * span, { span: +span.toFixed(3), dur: moving.length ? moving.at(-1).t - moving[0].t : 0, maxStepK: +(maxStep / span).toFixed(3) });
}
report.section('C. mục lục · đầu trang');
report.check('bấm "Bài ký" / "Lạc khoản" → nhảy đúng phần (mục đang đọc đổi theo)', R.Cbody?.cur === 'body' && R.Ccolo?.cur === 'colo', { body: R.Cbody?.cur, colo: R.Ccolo?.cur });
report.check('"↑ Đầu trang" hiện khi đã cuộn, bấm → về đầu (thẻ tiêu đề) và ẩn', R.Ctop && R.CtopAfter.y < 5 && !R.CtopAfter.on, { shown: R.Ctop, after: R.CtopAfter });
report.check('bấm "Đề danh" → về Đề danh', R.Croll?.cur === 'roll', R.Croll?.cur);
report.check('"Đọc toàn văn" mở ở đầu; Esc đóng', R.Cread.open && R.Cread.y < 5 && R.Cesc === false, { y: R.Cread.y, esc: R.Cesc });
report.section('D. rê vào tên');
report.check('chuột trên "Nguyễn Trực": tên sáng vàng + gạch mảnh, các tên khác lùi (≤ 0,5), thẻ có tiểu sử (1417–1474, Trạng nguyên)', R.Dbio.hot === 'Nguyễn Trực' && R.Dbio.card && R.Dbio.bio && /1417/.test(R.Dbio.text) && /Trạng nguyên/.test(R.Dbio.text) && R.Dbio.dim <= 0.5 && R.Dbio.line !== 'none' && R.Dbio.line !== 'matrix(0, 0, 0, 1, 0, 0)', R.Dbio);
report.check('chuột trên "Bùi Hựu" (không tiểu sử): thẻ danh hiệu đầy đủ + quê', R.Dplain.hot === 'Bùi Hựu' && R.Dplain.card && !R.Dplain.bio && /Đệ tam giáp/.test(R.Dplain.text) && /Chương Đức/.test(R.Dplain.text), R.Dplain);
report.check('chuột rời → bỏ sáng, thẻ tắt', !R.Dleave.hot && !R.Dleave.card, R.Dleave);
report.check('tay gần "Ngô Sĩ Liên" → tên được hút (by-hand, nở nhẹ), thẻ hiện', R.Dhand.hot === 'Ngô Sĩ Liên' && R.Dhand.byHand && R.Dhand.scale !== 'none' && R.Dhand.card, R.Dhand);
report.section('E. nắm tay để đóng');
report.check('nắm thoáng 0,15 s → không đóng (vòng mới đầy một phần)', R.Eshort.open && R.Eshort.cue > 0 && R.Eshort.cue < 1, R.Eshort);
report.check('nắm giữ ≥ 0,35 s → đóng; hết bảng, thông tin vẫn hiện', !R.Elong.open && R.Elong.modal === null && R.Elong.shown, R.Elong);
{
  const c = R.Ecam.cam;
  report.check('đóng → camera lùi về khung thường (focus / nghỉ) trong ~1 s: hết khung đọc, không còn đoạn lùi, khoảng cách như trước khi mở; bản dập tắt dần', !R.Ecam.read && !/^read/.test(c.camTw ?? '') && c.dist > 1.8 && R.Ecam.scan.mode === 'off', { dist: c.dist, camTw: c.camTw, off: c.off, scan: R.Ecam.scan.mode });
}
report.section('S. quét bản dập (giữ V trên mặt bia)');
report.check(`start: vạch xuất phát ở đỉnh vòm (${F1442.top} + 0,012), ảnh bản dập đã nạp (nạp lười lúc focus 1442)`, R.S0.mode === 'hold' && R.S0.p < 0.06 && R.S0.tex && Math.abs(R.S0.u[0] - (F1442.top + 0.012)) < 0.05 && R.S0.u[3] === 1, R.S0);
// r84: vạch đi theo THỜI GIAN (3,2 s hết mặt bia) — không theo tiến độ giữ; camera nhích vào khung đọc (lắc / vòng hover đứng yên)
report.check(`giữ ${Math.round(R.S5.t)} ms → vạch ở ${R.S5.scan.p} (≈ thời gian / 3,2 s), tên chạy trên mặt bia mờ đi, camera nhích vào (khoảng cách ${R.Sd0} → ${R.S5.dist})`, Math.abs(R.S5.scan.p - R.S5.t / 3200) <= 0.05 && R.S5.scan.frozen && R.S5.names < 0.1 && R.S5.read && R.S5.dist < R.Sd0 - 0.002 && R.S5.dist > R.Sd0 * 0.95, { scan: R.S5.scan, names: R.S5.names, t: R.S5.t, d0: R.Sd0, d: R.S5.dist });
report.check('cancel → vạch rút về, tắt hẳn ≤ 0,42 s', R.Scancel.mode === 'off' && R.Scancel.u[3] === 0, R.Scancel);
// r82b → r83: chế độ VỆT (mọi bia có bản dập): bản dập không ở lại — vạch + vệt đi hết khỏi mặt bia (đuôi vệt dưới chân mặt bia);
// tắt hiệu ứng chữ Hán cũng vậy (glyphs.test.mjs F)
report.check('fire → lớp đọc mở, vạch tan; chế độ vệt (chữ Hán): vạch + cả vệt bản dập đã ra khỏi mặt bia (không ở lại); đóng → tắt', R.Sfire.open && R.Sfire.scan.mode === 'held' && R.Sfire.scan.glow === 0 && R.Sfire.scan.trail && R.Sfire.scan.barY + R.Sfire.scan.trailLen < F1442.bottom && R.Sclose.mode === 'off', { fire: R.Sfire, close: R.Sclose });
report.section('F. giữ hai ngón trên bia (hand:vhold)');
report.check('view khai báo body[data-hand-vhold="1"]', R.Fflag === '1', R.Fflag);
report.check('fire → lớp đọc toàn màn hình mở ở ĐẦU (cả khi đang không focus)', R.F.open && R.F.y < 5, R.F);
report.check('bia khác (1448 — r79: mọi bia có văn bia): fire → lớp đọc mở với văn bia của CHÍNH 1448 (khoa Mậu Thìn, 27 tên)', R.Fother.open && R.Fother.id === 'bia-1448' && /Mậu Thìn/.test(R.Fother.run ?? '') && R.Fother.names === 27, R.Fother);
report.section('G. tay (lớp cử chỉ thật, con trỏ ẩn)');
report.check('tay tới "Xem ĐỀ DANH" → vùng dính info-names, bia vẫn focus; nhón → lớp đọc ở Đề danh', R.Gsticky.sticky === 'info-names' && R.Gsticky.shown && R.Gopen.open && R.Gopen.cur === 'roll', { ...R.Gsticky, ...R.Gopen });
report.check('tay tới mục "Bài ký" (sáng lên) + nhón → nhảy tới Bài ký', R.Gnear && R.Gjump === 'body', { near: R.Gnear, cur: R.Gjump });
report.check('NẮM TAY thật (lớp cử chỉ) → đóng', !R.Gfist.open && R.Gfist.modal === null, R.Gfist);
report.check('GIỮ CHỮ V thật trên bia ~2 s (hand:vhold start → fire) → lớp đọc mở ≤ 200 ms sau fire (tấm đọc có mặt), ở đầu', R.Gvhold.started && R.Gvhold.fired && R.Gvhold.latencyMs != null && R.Gvhold.latencyMs <= 200 && R.Gvhold.panel && R.Gvhold.open && R.Gvhold.top < 5, R.Gvhold);
report.section('X. thông tin thêm (r75)');
report.check('tấm trái: một dòng tỉ lệ đỗ dưới 450 | 33 ("cứ khoảng 14 người dự thi có 1 người đỗ")', R.X0?.rate === 'cứ khoảng 14 người dự thi có 1 người đỗ', R.X0?.rate);
report.check('tấm phải: "Soạn văn Thân Nhân Trung" — chuột rê → thẻ tiểu sử (1419–1499), rời → tắt; tay tới → thẻ', R.XauthorMouse?.on && /1419–1499/.test(R.XauthorMouse.text) && /Tao Đàn/.test(R.XauthorMouse.text) && !R.XauthorOff && R.XauthorHand, { mouse: R.XauthorMouse?.on, off: R.XauthorOff, hand: R.XauthorHand });
report.check('dải chuyện: chỉ mục vừa ~2 dòng (≥ 1), xoay vòng; rê chuột vào → dừng (không đổi mục); rời → chạy tiếp', R.Xstrip.items.length >= 1 && (R.Xstrip.items.length < 2 || (R.Xstrip.s1 !== R.Xstrip.s0 && R.Xstrip.paused && R.Xstrip.pausedCur[0] === R.Xstrip.pausedCur[1] && R.Xstrip.s2 !== R.Xstrip.pausedCur[1])), R.Xstrip);
report.check('lớp đọc — thẻ tiêu đề: "Soạn văn Thân Nhân Trung" + "Dựng bia năm 1484, 42 năm sau khoa thi, cùng đợt với 6 bia khác"; rê người soạn → thẻ tiểu sử', /Soạn văn Thân Nhân Trung/.test(R.Xcard.by ?? '') && R.Xcard.erect === 'Dựng bia năm 1484, 42 năm sau khoa thi, cùng đợt với 6 bia khác' && R.XrdAuthor?.kind === 'author' && R.XrdAuthor.card && /1419–1499/.test(R.XrdAuthor.text), { ...R.Xcard, hot: R.XrdAuthor?.kind });
{
  const all = R.Xnotes;
  const n5 = all[0]?.notes.length;
  let overlap = 0;
  let touch = 0;
  let underClose = 0;
  let misaligned = 0;
  let seen = new Set();
  for (const f of all) {
    const on = f.notes.filter((n) => n.on).sort((a, b) => a.top - b.top);
    for (let i = 1; i < on.length; i++) if (on[i].top < on[i - 1].bottom + 4) overlap++;
    for (const n of on) {
      seen.add(n.key);
      if (n.left < f.panel.right + 4) touch++;
      if (n.top < f.closeBottom) underClose++;
      if (n.top < f.panel.top || n.bottom > f.panel.bottom + 1) touch++;
    }
    // ghi chú đầu (không bị đẩy xuống dưới nút Đóng) canh đúng dòng neo: đỉnh thẻ ≈ đỉnh dòng neo (≤ 6 px)
    const first = on[0];
    if (first && Math.abs(first.y - (first.ay - 3)) < 0.5 && Math.abs(first.top - (f.panel.top + first.ay)) > 6) misaligned++;
  }
  report.check('5 ghi chú bên lề; 25 vị trí cuộn: không chồng nhau, không chạm tấm (ngoài mép phải), luôn dưới nút Đóng, trong chiều cao tấm; canh dòng neo; lần lượt hiện đủ 5', n5 === 5 && overlap === 0 && touch === 0 && underClose === 0 && misaligned === 0 && seen.size === 5, { n5, overlap, touch, underClose, misaligned, seen: [...seen] });
}
{
  // r80: chữ hoa nhỏ tách khỏi câu CHỈ khi nhãn là tiêu đề — "Câu nói nổi tiếng" (tiêu đề) có nhãn; "Vua Lê Thánh Tông đã chuẩn
  // tấu đổi danh hiệu: …" (vế dẫn) và "Khoa thi Nhâm Tuất (1442) là …" (không nhãn) là một câu liền, không nhãn
  const lab = new Map();
  for (const f of R.Xnotes) for (const n of f.notes) lab.set(n.key, n.label);
  const find = (pre) => [...lab.entries()].find(([k]) => k.startsWith(pre));
  const title = find('Câu nói nổi tiếng');
  const inline = find('Vua Lê Thánh Tông');
  const plain = find('Khoa thi Nhâm Tuất');
  report.check('r80: ghi chú bên lề — nhãn chữ hoa nhỏ chỉ khi là tiêu đề ("Câu nói nổi tiếng"); vế dẫn "Vua Lê Thánh Tông … danh hiệu" và câu không nhãn "Khoa thi Nhâm Tuất (1442) …" là một câu liền', title?.[1] === 'Câu nói nổi tiếng' && inline && inline[1] === '' && plain && plain[1] === '', { title, inline, plain });
}
report.check('ghi chú trôi theo cuộn: cuộn 120 px → thẻ giải nghĩa dời lên 120 px', R.Xfollow.a?.on && R.Xfollow.b && Math.abs(R.Xfollow.a.top - R.Xfollow.b.top - 120) <= 2, R.Xfollow);
report.check('rê chuột lên ghi chú → mở hết chữ (thẻ)', R.XnoteOpen.open && R.XnoteOpen.full !== '2' && /Đằng lục \(sao chép bài\)/.test(R.XnoteOpen.text), R.XnoteOpen);
report.check('thuật ngữ gạch chấm: chuột rê "Đề điệu" → thẻ "chịu trách nhiệm toàn bộ"; tay tới "Đằng lục" → thẻ "sao chép bài"', R.XtermMouse?.kind === 'term' && R.XtermMouse.card && /chịu trách nhiệm toàn bộ/.test(R.XtermMouse.text) && R.XtermHand?.kind === 'term' && R.XtermHand.by === 'hand' && /sao chép bài/.test(R.XtermHand.text), { mouse: R.XtermMouse, hand: R.XtermHand });
{
  const c = R.Xcredits;
  const tn = c.rows.find((r) => r.name === 'Tô Ngại');
  report.check('"Những người làm nên tấm bia" cuối Lạc khoản: Soạn văn / Viết chữ / Khắc đá; Tô Ngại "còn được ghi ở 6 bia khác: 1448 · … · 1481" (năm bấm được); không nói "cùng một người"', c.inColo && c.h === 'Những người làm nên tấm bia' && c.rows.map((r) => r.role).join() === 'Soạn văn,Viết chữ,Khắc đá' && tn?.x === 'Tên Tô Ngại còn được ghi ở 6 bia khác: 1448 · 1463 · 1466 · 1475 · 1478 · 1481' && tn.links.length === 6 && !R.Xsame, c);
}
report.check('Đề danh: dòng tỉ lệ đỗ dưới tiêu đề; danh hiệu (honors — dữ liệu thử) nằm trên dòng hạng, ghép với "Trạng nguyên"', R.Xroll.rate === 'cứ khoảng 14 người dự thi có 1 người đỗ' && R.Xroll.r1 === 'Trạng nguyên' && R.Xhonors.first === 'Trạng nguyên · Danh hiệu thử' && R.Xhonors.sixth === 'Danh hiệu thử hai', { ...R.Xroll, honors: R.Xhonors });
report.check('thẻ Trịnh Thiết Trường: "Xem bia khoa 1448" + "cần đối chiếu"', R.Xtt.hot?.name === 'Trịnh Thiết Trường' && R.Xtt.hot.card && R.Xtt.link.join() === 'Xem bia khoa 1448' && R.Xtt.verify === 'cần đối chiếu', R.Xtt);
report.check('không có chữ "honinh" trong DOM', R.Xhoninh === false, R.Xhoninh);
report.check('bấm năm 1448 (người làm bia) → lớp đọc đóng, khung đọc hết, lướt tới bia 1448', R.Xgo.id === 'bia-1448' && !R.Xgo.open && !R.Xgo.read, R.Xgo);
report.section('N. tấm đọc nổi 3D (r78, mặc định)');
{
  const a = R.N0;
  const expRise = 0.55 * 0.62 * (a.w / 2);
  report.check('tấm là đối tượng CSS3D trong lớp CSS3D của cảnh (nền tấm + chữ + cột ghi chú bên lề cùng một mặt phẳng 3D); kiểu mặc định Nổi 3D', a.mode === '3d' && a.inCss3d && a.slabIn3d && a.snIn3d && /matrix3d/.test(a.tf), { mode: a.mode, inCss3d: a.inCss3d, slab: a.slabIn3d, notes: a.snIn3d, tf: a.tf.slice(0, 40) });
  report.check('cuộn 0: đỉnh vòm đúng chỗ r77 (86 px ở 1440×900), cùng độ cong mặc định; tấm phủ tới đáy khung', Math.abs(a.top - 86) <= 1 && Math.abs(a.rise - expRise) < 1 && /A /.test(a.clip) && a.bottom >= a.vh - 1, { top: +a.top.toFixed(1), rise: +a.rise.toFixed(1), exp: +expRise.toFixed(1), bottom: +a.bottom.toFixed(0) });
  report.check('cuộn tới cuối: đỉnh vòm ra khỏi khung (mép trên tấm < 0), tấm vẫn phủ tới đáy khung (không bao giờ thấy đáy tấm)', R.N2.top < 0 && R.N2.bottom >= R.N2.vh - 1, { top: +R.N2.top.toFixed(0), bottom: +R.N2.bottom.toFixed(0), vh: R.N2.vh });
  const tfs = new Set([a.tf, R.N1.tf, R.N2.tf, ...R.Nfling.map((f) => f.tf), ...R.Nwheel.map((f) => f.tf), ...R.Njump.map((f) => f.tf)]);
  report.check('tấm CỐ ĐỊNH trong cảnh: transform của đối tượng CSS3D không đổi ở mọi khung khi cuộn (vuốt / bánh xe / mục lục / cuối trang) trong lúc camera đi', tfs.size === 1 && Math.abs(a.camY - R.N2.camY) > 0.1, { transforms: tfs.size, camY: [+a.camY.toFixed(3), +R.N2.camY.toFixed(3)] });
  const ratio = (tr) => {
    const rs = tr.filter((f) => Math.abs(f.o) > 300).map((f) => (R.Nyz - f.y) / f.o);
    const os = tr.map((f) => f.o);
    if (rs.length < 5) return { n: rs.length, dev: null, range: Math.round(Math.max(...os) - Math.min(...os)) };
    const med = [...rs].sort((x, y) => x - y)[rs.length >> 1];
    return { n: rs.length, frames: tr.length, dev: +Math.max(...rs.map((r) => Math.abs(r / med - 1))).toFixed(4), range: Math.round(Math.max(...os) - Math.min(...os)) };
  };
  const fr = ratio(R.Nfling);
  const wr = ratio(R.Nwheel);
  const jr = ratio(R.Njump);
  report.check('MỘT nguồn chuyển động — vuốt ném: độ dời camera / độ dịch chữ không đổi ở mọi khung (lệch ≤ 1 %)', fr.dev != null && fr.dev <= 0.01 && fr.range > 300, fr);
  report.check('MỘT nguồn chuyển động — bánh xe dồn 8 nấc: tỉ số không đổi ở mọi khung (lệch ≤ 1 %)', wr.dev != null && wr.dev <= 0.01 && wr.range > 300, wr);
  report.check('MỘT nguồn chuyển động — nhảy mục lục (Đề danh): tỉ số không đổi ở mọi khung (lệch ≤ 1 %), đi dài', jr.dev != null && jr.dev <= 0.01 && jr.range > 1000, jr);
  const e0 = a.edges;
  const e2 = R.N2.edges;
  const d0 = e0 && e0.shadowTop.y - e0.panelTop.y;
  const d2 = e2 && e2.shadowTop.y - e2.panelTop.y;
  report.check('bóng tấm trên mặt đá (đèn chính): bật khi đọc; độ lệch bóng so với tấm ĐỔI khi camera đi (thị sai thật)', a.shadowK === 1 && e0 && e2 && Math.abs(d2 - d0) > 10, { k: a.shadowK, top0: +(d0 ?? 0).toFixed(1), top2: +(d2 ?? 0).toFixed(1), right0: e0 && +(e0.shadowRight.x - e0.panelRight.x).toFixed(1) });
  const mat = 'rgba(0, 0, 0, 0.72)';
  report.check('cùng chất liệu đen trong mờ: nền mục lục (bo góc) · "↑ Đầu trang" · nhóm Đóng · ghi chú bên lề', a.tocBg === mat && a.tocRadius >= 8 && a.topBg === mat && a.closeBg === mat && a.snBg === mat, { toc: a.tocBg, r: a.tocRadius, top: a.topBg, close: a.closeBg, sn: a.snBg });
  const px = R.Npx;
  report.check('mục lục trên nền đá: điểm ảnh sau thẻ tối hơn đá quanh thẻ; mọi mục tương phản ≥ 4,5 với phần nền sáng nhất (95 %) có đá phía sau', px.n > 50 && px.bgHi < px.stone * 0.6 && px.rows.length === 3 && px.rows.every((r) => r.ratio >= 4.5), px);
  const ft = R.Nft;
  report.check(`thời gian khung lúc cuộn liên tục: p95 ${ft['1920x1080']?.p95} ms (1920×1080) · ${ft['2560x1440']?.p95} ms (2560×1440) — ≤ 34 ms`, ft['1920x1080']?.p95 <= 34 && ft['2560x1440']?.p95 <= 34, ft);
}
report.section('Y. tấm đọc đỉnh vòm · trượt mở / đóng (r82) · cuộn · tắt quét bản dập (r77 — kiểu Phẳng)');
{
  const y = R.Y0;
  const expRise = 0.55 * 0.62 * (y.w / 2);
  report.check('tấm: mép trên giữ nguyên (ô r74: 86 px ở 1440×900), chạy tới đáy khung, đỉnh vòm theo cài đặt mặc định (≈ tỉ lệ vòm của bia)', Math.abs(y.t - 86) <= 1 && y.b >= y.vh - 1 && /A /.test(y.clip) && Math.abs(y.arch.rise - expRise) < 1 && y.settled && !y.slab.transform, { t: y.t, b: y.b, vh: y.vh, rise: y.arch.rise, clip: y.clip.slice(0, 60) });
  const m = R.Ymax;
  const riseAt = (x) => { const u = Math.min(1, Math.abs(x - (m.l + m.w / 2)) / (m.w / 2)); return m.arch.rise * (1 - Math.sqrt(1 - u * u)); };
  const runOk = m.run.t - m.t >= riseAt(m.run.l) - 1 && m.run.t - m.t >= riseAt(m.run.r) - 1;
  const pad = 56;
  const textOk = m.scrollTop - m.t >= riseAt(m.l + pad * 0.9) - 1;
  report.check('độ cong lớn nhất: vòm cao hơn, dải tên trang + vùng chữ (tới mép nội dung) nằm dưới vòm — không bị cắt', m.arch.rise > y.arch.rise * 1.7 && runOk && textOk, { rise: +m.arch.rise.toFixed(1), inset: m.arch.inset, headIn: m.arch.headIn, run: m.run, scrollTop: m.scrollTop, top: m.t });
  report.check('độ cong 0 → chữ nhật (không vòm), vùng chữ sát mép trên như cũ', R.Yflat.arch.rise === 0 && !/A /.test(R.Yflat.clip) && Math.abs(R.Yflat.scrollTop - R.Yflat.t) <= 1, { clip: R.Yflat.clip.slice(0, 50), scrollTop: R.Yflat.scrollTop, t: R.Yflat.t });
  // r82: tấm trượt (Phẳng: dịch trên màn) — mở: mép trên đi LÊN đơn điệu, tới đúng ô nghỉ ở khung camera dừng, hết biến hình, chữ
  // hiện đủ; đóng: đi XUỐNG đơn điệu suốt đoạn lùi, mờ hết đúng lúc camera dừng
  const slide = (rows, kind, dir) => {
    const idx = rows.map((r, i) => (r.tw === kind ? i : -1)).filter((i) => i >= 0);
    const mv = idx.map((i) => rows[i]).filter((r) => r.top != null && !r.hidden);
    let back = 0;
    // dir 1 (mở): mép trên chỉ được giảm — bước tăng là đi ngược; dir −1 (đóng): ngược lại
    for (let i = 1; i < mv.length; i++) back = Math.max(back, dir * (mv[i].top - mv[i - 1].top));
    const after = idx.length ? rows[idx.at(-1) + 1] : null;
    return { frames: mv.length, back: +back.toFixed(2), span: mv.length ? +Math.abs(mv.at(-1).top - mv[0].top).toFixed(1) : 0, last: idx.length ? rows[idx.at(-1)] : null, after };
  };
  const so = slide(R.Yopen, 'read', 1);
  const aO = so.after;
  report.check('mở: tấm TRƯỢT LÊN đơn điệu trong lúc camera tiến (không khung nào đi xuống), tới đúng ô nghỉ ngay khung camera dừng — hết biến hình, chữ hiện đủ', so.frames >= 20 && so.back <= 0.05 && so.span > 200 && aO && !aO.m && !aO.tr && Math.abs(aO.top - R.Y0.t) < 0.5 && aO.op === 1 && aO.text && aO.fx.every((f) => f.y === 0 && f.o === 1), { frames: so.frames, back: so.back, span: so.span, after: aO && { top: aO.top, tr: aO.tr, op: aO.op, fx: aO.fx, m: aO.m } });
  const sc = slide(R.Yclose, 'read-out', -1);
  report.check('đóng: tấm TRƯỢT XUỐNG đơn điệu cùng đoạn camera lùi, mờ hết đúng lúc camera dừng (khung cuối của đoạn ≤ 0,02), rồi lớp phủ ẩn', sc.frames >= 20 && sc.back <= 0.05 && sc.span > 200 && sc.last?.op <= 0.02 && R.Yclose.at(-1).hidden, { frames: sc.frames, back: sc.back, span: sc.span, lastOp: sc.last?.op, hidden: R.Yclose.at(-1).hidden });
}
report.check('không tự cuộn theo vị trí tay (xoè tay ở dải dưới 1,5 s: vị trí cuộn đứng yên)', R.YnoEdge.y1 === R.YnoEdge.y0 && !R.YnoEdge.edge, R.YnoEdge);
report.check('kéo cuộn → ánh vàng mép dưới hiện; dừng → tắt (~0,4 s)', R.YglowOn.flag === '1' && R.YglowOn.op > 0.5 && R.YglowOff.flag === null && R.YglowOff.op < 0.05, { on: R.YglowOn, off: R.YglowOff });
report.check('tắt "Quét bản dập khi mở toàn văn": view bỏ cờ vòng-ẩn, sân khấu tắt quét; nút "Đọc toàn văn" mở ngay (không quét)', R.YoffFlag.scanFlag === null && R.YoffFlag.enabled === false && R.YoffBtn.open && R.YoffBtn.scan === 'off', { ...R.YoffFlag, btn: R.YoffBtn });
report.check('tắt quét: giữ V thật trên mặt bia → vòng tiến độ trên huy hiệu V HIỆN, không vạch / bản dập, lớp đọc mở ≤ 200 ms sau fire', R.YoffV.fired && R.YoffV.runFrames > 20 && R.YoffV.ring > 0.5 && R.YoffV.scan.every((m) => m === 'w0') && R.YoffV.latencyMs != null && R.YoffV.latencyMs <= 200 && R.YoffV.open, R.YoffV);
report.check('tắt giữa lúc đang quét → tắt hẳn ngay (không bản dập hiện dở)', R.YliveOff.before === 'hold' && R.YliveOff.after.mode === 'off' && R.YliveOff.after.u[3] === 0, R.YliveOff);
report.section('H. tắt thông tin mở rộng');
report.check('1442 dùng bình phong gốc; tên trên mặt bia không tắt lúc focus', R.H.rich === null && !R.H.lq && R.H.bp && R.Hface > 0.3, { ...R.H, face: R.Hface });
await close();
process.exit(report.finish(errors));
