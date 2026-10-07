// r79 — QUÉT CẢ 82 BIA (dữ liệu mở rộng của mọi bia — tools/extract-stele-info.mjs): với từng bia, ở mỗi cỡ khung:
//   · lúc nghỉ: tên khắc trên thân bia — không "null / undefined", đủ người đỗ qua các trang (không thiếu / lặp), tên không
//     tràn ô, dải tiêu đề giáp có chữ; chữ khắc trên bục (mặt trước / sau) không "NULL / UNDEFINED"; HUD (nút bia trước / sau,
//     dòng trạng thái, dòng thời gian — cả aria-label) không "null / undefined / NaN"
//   · focus: hai tấm sơn mài hiện đủ; không phần tử nào tràn khỏi tấm / khỏi ô của nó; lời giới thiệu trọn vẹn; dải chuyện (nếu
//     có) không chạm lời giới thiệu; dòng tam khôi (hoặc tên đầu của giáp cao nhất khi không có tam khôi) và số người các giáp
//     sau khớp dữ liệu; hai số dự thi / đỗ (số chính xác hoặc chữ nguồn như "hơn 750"; "Không ghi" → bỏ); không "null /
//     undefined / NaN / Không ghi"
//   · lớp đọc: đúng các phần (Bài ký — hoặc "Mô tả bia" khi nội dung là bài mô tả —, Lạc khoản, Đề danh), số tên Đề danh = số
//     người đỗ, tên giáp lấy từ dữ liệu, lời dẫn danh sách (roll[].preface), ghi chú không neo liệt kê sau Bài ký, ghi chú bên
//     lề không chồng nhau ở 12 vị trí cuộn, khối người làm bia không có "Không ghi", liên kết năm chỉ tới bia có trong nguồn
//     hiện tại; không "null / undefined / NaN", không "honinh"
// r80: tên trên thân bia = người đỗ đầu (đúng người, chữ lớn đứng yên, một dòng, ≤ ½ ô) + những người còn lại cuộn dọc (đủ
//   số, không tràn; dài hơn ô thì hoạt ảnh cuộn đang chạy và thật sự dời); tên vẫn hiện lúc focus; chữ hoa nhỏ tách khỏi câu ghi
//   chú (ghi chú bên lề, "Ghi chú" sau Bài ký, dải chuyện) CHỈ khi là nhãn tiêu đề (labelKind 'title').
// r83: BẢN DẬP cả 82 bia (nguồn v2 — models-v2/rubbings/, phép khớp src/data/rubbings.generated.json), ở cỡ khung đầu: mỗi bia
//   · có dữ liệu (nguồn v2, URL models-v2/rubbings/<id>.webp); tới bia (chưa focus) → CHƯA tải ảnh; focus → tải đúng MỘT lần, ảnh
//     sẵn sàng; lượt quét (r84: như nút đọc — 2 s rồi bắn, vạch đi tiếp) → vạch có ảnh (uScan.w = 1), chế độ vệt; xong lượt → không
//     gì ở lại (reveal 0)
//   · phép khớp: 4 mốc mỗi trục tăng dần, phần dư căn chỉnh (đường ngang + chữ dải tiêu đề — tools/fit-rubbings.mjs) ≤ 9 ‰
//   · quay lại bia đã focus → không tải lại
//   · r85: hiệu ứng ánh sáng chữ chạy trên mọi bia (hạt sáng lấy mẫu từ bản đồ nét, đèn xiên bật lúc quét), không lỗi trang
//   · r84 CỔNG LỚP MẶT (bản dập là texture trên mặt bia, không chiếu lan sang hình khác): đang quét (camera đứng yên, vệt 0,6, vạch
//     ~94 %) — lõi hình đầu rùa (81 / 82 bia có đầu rùa chồng lên mặt bia khi nhìn chính diện) không đổi điểm ảnh, mặt bia ngay trên
//     có đổi; mỗi 6 bia (+ 1442, 1664) ở khung 3/4 lúc nghỉ: hông phải phiến không đổi
//   · LÙI VỀ v1 (trình duyệt riêng, models-v2/catalog.json → 404): chỉ 1442 có bản dập (public/rubbings — ảnh + bản đồ nét),
//     9 bia mẫu còn lại không có (quét chỉ vạch, không tải gì), không lỗi trang
// Tóm tắt lỗi theo bia in ở cuối (và --json <tệp>).
// node tests/cinema/all-steles.test.mjs --port 5180 [--sizes 1440x900,1920x1080] [--only bia-1514,bia-1565] [--json out.json]
//   [--rubbings-only | --no-rubbings]   (≈ 12 phút mỗi cỡ khung + ≈ 6 phút phần bản dập)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const { port, headed } = parseArgs();
const SIZES = (arg('--sizes') ?? '1440x900,1920x1080').split(',').map((s) => s.split('x').map(Number));
const ONLY = arg('--only')?.split(',') ?? null;
const JSON_OUT = arg('--json');
const RUB_ONLY = argv.includes('--rubbings-only');
const RUB = !argv.includes('--no-rubbings');
const RUB_GEN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/rubbings.generated.json'), 'utf8'));
const RESID_MAX = 0.009; // phần dư căn chỉnh lớn nhất cho phép (đơn vị bia — bia cao ≈ 1)
const INFO_DIR = path.join(ROOT, 'src/data/stele-info');
const IDS = fs
  .readdirSync(INFO_DIR)
  .filter((f) => /^bia-\d+\.json$/.test(f))
  .map((f) => f.slice(0, -5))
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
  .filter((id) => !ONLY || ONLY.includes(id));
// chỗ vênh CỦA DỮ LIỆU đã ghi trong docs/kiem-duyet-du-lieu.md (không phải lỗi giao diện): số đỗ ≠ số tên trong danh sách
const KNOWN_PASSED_MISMATCH = new Set(['bia-1724']);
const INFO = Object.fromEntries(IDS.map((id) => [id, JSON.parse(fs.readFileSync(path.join(INFO_DIR, `${id}.json`), 'utf8'))]));

/** Kỳ vọng dựng từ dữ liệu (không từ giao diện). */
const VAGUE = /^\s*(không ghi|không rõ)\s*$/iu;
function expect(info) {
  const tiersNon = (info.tiers ?? []).filter((t) => (info.laureates ?? []).some((l) => l.tier === t.tier));
  const t1 = (info.laureates ?? []).filter((l) => l.tier === tiersNon[0]?.tier);
  const notes = (info.notes ?? []).filter((n) => n && typeof n === 'object' && n.text);
  const loose = notes.filter((n) => !n.anchor);
  const desc = info.content?.kind === 'description';
  const secs = [desc ? 'Mô tả bia' : 'Bài ký'];
  if ((info.content?.colophon ?? []).length || (info.credits ?? []).length) secs.push('Lạc khoản');
  if (tiersNon.length) secs.push('Đề danh');
  return {
    top: Math.min(3, t1.length),
    tierLabels: tiersNon.map((t) => t.label),
    tierCounts: tiersNon.slice(1).map((t) => (info.laureates ?? []).filter((l) => l.tier === t.tier).length),
    names: (info.laureates ?? []).length,
    passed: KNOWN_PASSED_MISMATCH.has(info.id) ? null : info.passed,
    candidates: info.candidates ?? (info.candidatesRaw && !VAGUE.test(info.candidatesRaw) ? info.candidatesRaw : null),
    prefaces: (info.content?.roll ?? []).map((g) => g.preface).filter(Boolean),
    loose: loose.length,
    secs,
    desc,
    canChi: info.canChiTitle ?? info.canChi,
    canChiNote: info.canChiNote ?? null,
    // r80: tên đỗ đầu (đứng yên, chữ lớn) = người đầu danh sách; số tên cuộn = số còn lại; nhãn chữ hoa nhỏ chỉ được là nhãn TIÊU ĐỀ
    topName: (info.laureates ?? [])[0]?.name ?? null,
    rollN: Math.max(0, (info.laureates ?? []).length - 1),
    titleLabels: [...new Set(notes.filter((n) => n.label && n.labelKind === 'title').map((n) => n.label))],
  };
}

const report = createReport('all-steles');
const { page, close, errors } = await launch({
  headed,
  width: SIZES[0][0],
  height: SIZES[0][1],
  // (quét nội dung: camera vào 1,4 s như trước r80 cho nhanh — thời gian mặc định 2,8 s kiểm ở reader-zoom.test.mjs)
  settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, cinemaRubbingScan: false, glyphFx: false, readerZoomIn: 1.4, titleFxMode: 'fade' }, // r85: hiệu ứng tiêu đề kiểm ở transition.test.mjs; r86: ánh sáng chữ tắt tới lượt bản dập (r85: hiệu ứng bật thì focus tải bản dập kể cả khi "Quét bản dập" tắt — lượt bản dập cần "chưa tải trước focus")
});
await openCinema(page, port, { id: IDS[0], hooks: ['cinemaStelePoint', 'cinemaPresence', 'cinemaRich', 'cinemaIdle', 'cinemaInfo', 'cinemaRead', 'cinemaPedText', 'cinemaTxProgress', 'cinemaLoop', 'cinemaTick', 'cinemaHead', 'cinemaGlyphs', 'cinemaBounds', 'cinemaLods', 'cinemaReveal'], settleMs: 3000 });
const E = (fn, a) => page.evaluate(fn, a);
const source = await E(() => ({ n: document.querySelectorAll('.cin-tl__tick').length }));

// ---- dò trong trang
// (phân biệt hoa thường: "gian nan", "…nAn…" của hai chữ dính nhau không phải lỗi; "honinh" thì mọi kiểu chữ)
const BAD = '\\b(null|undefined|NaN)\\b|[Hh][Oo][Nn][Ii][Nn][Hh]';
const probeRest = (exp) =>
  E(
    async ({ exp, BAD }) => {
      const bad = new RegExp(BAD);
      const out = { errs: [] };
      const vis = (b) => {
        let a = 1;
        for (let e = b; e && !e.classList?.contains('cin-css3d'); e = e.parentElement) {
          const cs = getComputedStyle(e);
          a *= +cs.opacity;
          if (cs.display === 'none' || cs.visibility === 'hidden') a = 0;
        }
        return a;
      };
      const boxes = [...document.querySelectorAll('.cin-nm')].map((b) => ({ b, a: vis(b) })).sort((x, y) => y.a - x.a);
      const box = boxes[0]?.a > 0.3 ? boxes[0].b : null;
      if (!box) out.errs.push('tên trên thân bia: không thấy ô tên');
      else {
        if (bad.test(box.textContent)) out.errs.push(`tên trên thân bia: có "${box.textContent.match(bad)[0]}"`);
        // r80: người đỗ đầu — chữ lớn, đứng yên đầu ô
        const hn = box.querySelector('.cin-nm__head .cin-nm__hn');
        if (!hn || hn.textContent.trim() !== exp.topName) out.errs.push(`tên trên thân bia: tên đỗ đầu "${hn?.textContent ?? '—'}" ≠ "${exp.topName}"`);
        const head = box.querySelector('.cin-nm__head');
        if (head && head.offsetHeight > box.clientHeight * 0.5) out.errs.push(`tên trên thân bia: phần tên đỗ đầu cao ${head.offsetHeight}/${box.clientHeight} px`);
        if (hn && hn.scrollWidth > hn.clientWidth + 1) out.errs.push(`tên trên thân bia: tên đỗ đầu tràn ngang`);
        // những người còn lại: đủ người (r90: các danh sách giáp), không tràn ngang
        const seq = box.querySelector('.cin-nm__seq');
        const names = seq ? [...seq.querySelectorAll('.cin-nm__rn')].map((e) => e.textContent.trim()) : [];
        if (names.length !== exp.rollN) out.errs.push(`tên trên thân bia: ${names.length} tên cuộn ≠ ${exp.rollN}`);
        for (const rn of [...(seq?.querySelectorAll('.cin-nm__rn, .cin-nm__rt') ?? []), ...box.querySelectorAll('.cin-nm__ghl')]) {
          if (rn.scrollWidth > rn.clientWidth + 1 || rn.offsetWidth > box.clientWidth + 1) {
            out.errs.push(`tên trên thân bia: "${rn.textContent}" tràn ngang (${rn.scrollWidth}/${Math.min(rn.clientWidth, box.clientWidth)} px)`);
            break;
          }
        }
        const roll = box.querySelector('.cin-nm__roll');
        // r90: mỗi lúc một giáp — có danh sách thì luôn có lịch cuộn chạy (hoạt ảnh mỗi danh sách giáp, đồng hồ đi)
        const g0 = box.querySelector('.cin-nm__grp');
        out.box = { h: box.clientHeight, head: head?.offsetHeight ?? 0, roll: roll?.clientHeight ?? 0 };
        out.roll = { need: !!g0, on: box.classList.contains('is-roll'), run: box.classList.contains('is-run'), groups: box.querySelectorAll('.cin-nm__grp').length };
        if (out.roll.need && !(out.roll.on && out.roll.run)) out.errs.push(`tên trên thân bia: có danh sách mà không cuộn (${JSON.stringify(out.roll)})`);
        if (out.roll.need) {
          const a = g0.getAnimations()[0];
          const c0 = a?.currentTime ?? null;
          await new Promise((r) => setTimeout(r, 700));
          const c1 = a?.currentTime ?? null;
          if (!(c0 != null && c1 > c0 + 300)) out.errs.push(`tên trên thân bia: cuộn không chạy (${c0} → ${c1})`);
        }
      }
      const ped = window.__vm.cinemaPedText();
      out.ped = ped.text ?? null;
      if (ped.text && /\b(NULL|UNDEFINED|NAN)\b/.test(ped.text.join(' | '))) out.errs.push(`chữ trên bục: "${ped.text.join(' | ')}"`);
      // HUD: chữ + aria-label
      const hud = document.querySelector('.cinema');
      const texts = [...hud.querySelectorAll('.cin-nv, .cin-tl, [class*="status"], .cin-hud')].map((e) => e.textContent).join(' ');
      const labels = [...hud.querySelectorAll('[aria-label], [aria-valuetext], [title]')].filter((e) => !e.closest('.ri-ov, .rd--3d, .lq-leaf')).map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('aria-valuetext') ?? ''} ${e.getAttribute('title') ?? ''}`).join(' ');
      const m = `${texts} ${labels}`.match(/\b(null|undefined|NaN)\b/);
      if (m) out.errs.push(`HUD: có "${m[0]}" — …${`${texts} ${labels}`.slice(Math.max(0, m.index - 60), m.index + 20)}…`);
      const status = document.querySelector('.cin-status')?.textContent ?? '';
      out.status = status;
      if (exp.canChi && !status.includes(exp.canChi) && status) out.errs.push(`HUD: dòng trạng thái không có can chi "${exp.canChi}"`);
      return out;
    },
    { exp, BAD }
  );

const probeLeaves = (exp) =>
  E(
    ({ exp, BAD }) => {
      const bad = new RegExp(BAD);
      const out = { errs: [] };
      const L = document.querySelector('.lq-leaf--l');
      const R = document.querySelector('.lq-leaf--r');
      const dbg = window.__vm.cinemaRich.state().dbg?.rich;
      if (!L || !R || !dbg?.leaves?.every((l) => l.alpha > 0.9)) {
        out.errs.push(`tấm sơn mài: chưa hiện đủ (${JSON.stringify(dbg?.leaves ?? null)})`);
        return out;
      }
      // toạ độ bố cục (không biến hình CSS3D) của el trong leaf
      const rel = (el, root) => {
        let x = 0;
        let y = 0;
        for (let e = el; e && e !== root; e = e.offsetParent) {
          x += e.offsetLeft;
          y += e.offsetTop;
          if (!e.offsetParent) break;
        }
        return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight };
      };
      for (const [nm, lf] of [
        ['trái', L],
        ['phải', R],
      ]) {
        const txt = lf.textContent;
        const m = txt.match(bad) || txt.match(/Không ghi|Không rõ/);
        if (m) out.errs.push(`tấm ${nm}: có "${m[0]}"`);
        const W = lf.clientWidth;
        const H = lf.clientHeight;
        for (const el of lf.querySelectorAll('.lq-head *, .lq-body *, .lq-foot *')) {
          if (!el.offsetParent || el.closest('.lq-strip__m, .lq-card') || getComputedStyle(el).visibility === 'hidden' || el.closest('[hidden]')) continue;
          if (getComputedStyle(el).display === 'inline') continue; // hộp của phần tử inline xuống dòng không đo được bằng offset*
          const r = rel(el, lf);
          if (r.l < -1 || r.t < -1 || r.r > W + 1 || r.b > H + 1) {
            out.errs.push(`tấm ${nm}: "${el.className || el.tagName}" tràn khỏi tấm (${Math.round(r.l)},${Math.round(r.t)}–${Math.round(r.r)},${Math.round(r.b)} / ${W}×${H})`);
            break;
          }
        }
        for (const box of lf.querySelectorAll('.lq-head, .lq-body, .lq-foot')) {
          if (box.scrollHeight > box.clientHeight + 2) out.errs.push(`tấm ${nm}: ${box.className} tràn dọc (${box.scrollHeight}/${box.clientHeight})`);
        }
        for (const el of lf.querySelectorAll('.lq-king, .lq-reign, .lq-nw, .lq-by, .lq-top__i, .lq-more, .lq-figs, .lq-rate, .lq-btn__t')) {
          if (el.scrollWidth > el.clientWidth + 3) {
            out.errs.push(`tấm ${nm}: "${el.textContent.slice(0, 40)}" tràn ngang (${el.scrollWidth}/${el.clientWidth})`);
            break;
          }
        }
      }
      // lời giới thiệu trọn vẹn + dải chuyện không chạm
      const intro = R.querySelector('.lq-intro');
      if (!intro || !intro.textContent.trim()) out.errs.push('tấm phải: không có lời giới thiệu');
      else {
        if (intro.scrollHeight > intro.clientHeight + 2) out.errs.push(`tấm phải: lời giới thiệu bị cắt (${intro.scrollHeight}/${intro.clientHeight})`);
        const strip = R.querySelector('.lq-strip');
        if (strip && !strip.hidden && strip.offsetTop < intro.offsetTop + intro.offsetHeight + 4) out.errs.push('tấm phải: dải chuyện chạm lời giới thiệu');
        const body = R.querySelector('.lq-body');
        if (intro.offsetTop + intro.offsetHeight > body.clientHeight - 4) out.errs.push(`tấm phải: lời giới thiệu tràn khỏi thân tấm (${intro.offsetTop + intro.offsetHeight}/${body.clientHeight})`);
        out.strip = strip && !strip.hidden ? dbg.strip.items.length : 0;
      }
      // tam khôi / tên đầu giáp cao nhất · số người các giáp sau
      const tops = [...L.querySelectorAll('.lq-top__i')];
      if (tops.length !== exp.top || tops.some((li) => !li.querySelector('.lq-nm')?.textContent.trim())) out.errs.push(`tấm trái: ${tops.length} dòng đỗ đầu ≠ ${exp.top}`);
      const more = [...L.querySelectorAll('.lq-more b')].map((b) => Number(b.textContent));
      if (more.join() !== exp.tierCounts.join()) out.errs.push(`tấm trái: số người các giáp sau ${more.join('/')} ≠ ${exp.tierCounts.join('/')}`);
      const figs = [...L.querySelectorAll('.lq-fig__v')].map((b) => b.textContent.trim());
      out.figs = figs;
      if (figs.some((f) => f === '—' || !f)) out.errs.push(`tấm trái: ô số "—" / trống (${figs.join(' | ')})`);
      // r80: tên trên mặt bia ở lại lúc focus
      {
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
        if (best < 0.5) out.errs.push(`tên trên thân bia: tắt lúc focus (độ đục ${best.toFixed(2)})`);
      }
      // r80: dải chuyện — ghi chú chỉ có nhãn khi nhãn là tiêu đề
      const sk = dbg.strip?.kinds ?? [];
      (dbg.strip?.items ?? []).forEach((lab, i) => {
        if (sk[i] === 'note' && lab && !exp.titleLabels.includes(lab)) out.errs.push(`ghi chú: dải chuyện tách nhãn "${lab}" không phải tiêu đề`);
      });
      const title = R.querySelector('.lq-title')?.textContent ?? '';
      if (exp.canChi && !title.includes(exp.canChi)) out.errs.push(`tấm phải: tiêu đề không có can chi "${exp.canChi}"`);
      if (exp.canChiNote && !R.querySelector('.lq-cc')) out.errs.push('tấm phải: can chi không có chú thích');
      return out;
    },
    { exp, BAD }
  );

const probeReader = (exp) =>
  E(
    async ({ exp, BAD }) => {
      const bad = new RegExp(BAD);
      const out = { errs: [] };
      const st = window.__vm.cinemaRich.dev().reader.state();
      if (!st.open) {
        out.errs.push('lớp đọc: không mở');
        return out;
      }
      const all = [...document.querySelectorAll('.rd')];
      const text = all.map((e) => e.textContent).join(' ');
      const m = text.match(bad);
      if (m) out.errs.push(`lớp đọc: có "${m[0]}" — …${text.slice(Math.max(0, m.index - 50), m.index + 20)}…`);
      const toc = [...document.querySelectorAll('.rd-toc__i')].map((b) => b.textContent.trim());
      if (toc.join() !== exp.secs.join()) out.errs.push(`lớp đọc: mục lục ${toc.join('/')} ≠ ${exp.secs.join('/')}`);
      const over = document.querySelector('.rd .rd-over');
      if (exp.desc && over) out.errs.push('lớp đọc: bài mô tả mà vẫn ghi "Toàn văn bia"');
      if (!exp.desc && over?.textContent !== 'Toàn văn bia') out.errs.push('lớp đọc: thiếu dòng "Toàn văn bia"');
      const names = document.querySelectorAll('.rd .dd-p').length;
      if (names !== exp.names) out.errs.push(`Đề danh: ${names} tên ≠ ${exp.names} người đỗ`);
      if (exp.passed != null && names !== exp.passed) out.errs.push(`Đề danh: ${names} tên ≠ passed ${exp.passed}`);
      const labels = [...document.querySelectorAll('.rd .dd-tier__l')].map((e) => e.textContent.trim());
      if (labels.join('|') !== exp.tierLabels.join('|')) out.errs.push(`Đề danh: tên giáp ${labels.join('|')} ≠ ${exp.tierLabels.join('|')}`);
      const pre = [...document.querySelectorAll('.rd .dd-preface')].map((e) => e.textContent.trim());
      if (pre.length !== exp.prefaces.length) out.errs.push(`Đề danh: ${pre.length} lời dẫn danh sách ≠ ${exp.prefaces.length}`);
      const loose = document.querySelectorAll('.rd .rd-loose__i').length;
      if (loose !== exp.loose) out.errs.push(`ghi chú không neo: ${loose} ≠ ${exp.loose}`);
      const looseSec = document.querySelector('.rd .rd-loose');
      if (looseSec && looseSec.previousElementSibling?.classList.contains('rd-body') !== true) out.errs.push('ghi chú không neo: không nằm ngay sau Bài ký');
      // r80: chữ hoa nhỏ tách khỏi câu ghi chú CHỈ khi là nhãn tiêu đề (ghi chú bên lề · danh sách "Ghi chú" sau Bài ký)
      for (const el of document.querySelectorAll('.rd .rd-sn__l, .rd .rd-loose__l')) {
        const lab = el.textContent.trim();
        if (!exp.titleLabels.includes(lab)) out.errs.push(`ghi chú: nhãn "${lab}" (${el.className}) không phải tiêu đề`);
      }
      const cr = document.querySelector('.rd .rd-credits')?.textContent ?? '';
      if (/Không ghi|Không rõ/.test(cr)) out.errs.push('người làm bia: có "Không ghi"');
      for (const b of document.querySelectorAll('.rd button.rd-yr')) if (!window.__vm.cinemaInfo.ctx.hasStele(b.dataset.id)) out.errs.push(`liên kết năm ${b.textContent} → bia ${b.dataset.id} không có trong nguồn`);
      const sub = document.querySelector('.rd .dd-sub')?.textContent ?? '';
      if (/—|\s{2}|năm thứ\s*$/.test(sub)) out.errs.push(`Đề danh: dòng phụ "${sub}"`);
      if (exp.canChi && !(document.querySelector('.rd .rd-run')?.textContent ?? '').includes(exp.canChi)) out.errs.push(`lớp đọc: dải tên trang không có can chi "${exp.canChi}"`);
      if (exp.canChiNote && !document.querySelector('.rd .rd-cc')) out.errs.push('lớp đọc: can chi không có chú thích');
      // ghi chú bên lề: 12 vị trí cuộn — không chồng nhau, không dưới nút Đóng
      const s = document.querySelector('.rd .ri-ov__scroll');
      const max = s.scrollHeight - s.clientHeight;
      const closeB = document.querySelector('.rd .ri-ov__close').getBoundingClientRect().bottom;
      let ov = 0;
      let under = 0;
      for (let i = 0; i <= 11; i++) {
        s.scrollTop = Math.round((max * i) / 11);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const on = window.__vm.cinemaRich.dev().reader.state().notes.filter((n) => n.on && n.bottom > 0 && n.top < innerHeight).sort((a, b) => a.top - b.top);
        for (let j = 1; j < on.length; j++) if (on[j].top < on[j - 1].bottom + 2) ov++;
        for (const n of on) if (n.top < closeB) under++;
      }
      if (ov) out.errs.push(`ghi chú bên lề: chồng nhau ${ov} lần / 12 vị trí cuộn`);
      if (under) out.errs.push(`ghi chú bên lề: lên trên nút Đóng ${under} lần`);
      s.scrollTop = 0;
      out.notes = window.__vm.cinemaRich.dev().reader.state().notes.length;
      return out;
    },
    { exp, BAD }
  );

// ---- chạy
const fails = {}; // `${size} ${id}` → [lỗi]
const add = (key, errs) => {
  if (errs?.length) (fails[key] ??= []).push(...errs);
};
const stepMs = [];
const stats = {}; // `${size} ${id}` → số đo phụ (ô tên trên thân bia…)
for (const [W, H] of RUB_ONLY ? [] : SIZES) {
  await page.setViewportSize({ width: W, height: H });
  await sleep(800);
  for (const id of IDS) {
    const t0 = Date.now();
    const key = `${W}x${H} ${id}`;
    const exp = expect(INFO[id]);
    // tới bia (như bấm năm trên dòng thời gian), chờ hết chuyển cảnh + thông tin mở rộng của bia đã nạp
    await page.mouse.move(W / 2, H - 20);
    await E(async (id) => {
      if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
      const t0 = performance.now();
      while (performance.now() - t0 < 12000) {
        await new Promise((r) => setTimeout(r, 100));
        if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0 && window.__vm.cinemaRich.dev()?.info?.()?.id === id && window.__vm.cinemaPedText().ok) break;
      }
    }, id);
    await sleep(900);
    try {
      const pr = await probeRest(exp);
      add(key, pr.errs);
      (stats[key] ??= {}).names = { ...pr.box, roll: pr.roll };
    } catch (e) {
      add(key, [`lúc nghỉ: lỗi dò ${e.message.split('\n')[0]}`]);
    }
    // focus
    const p = await E(() => window.__vm.cinemaStelePoint());
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await E(async () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 5000) {
        await new Promise((r) => setTimeout(r, 100));
        const d = window.__vm.cinemaRich.state().dbg?.rich;
        if (d?.interactive && d.leaves.every((l) => l.alpha > 0.95)) break;
      }
    });
    await sleep(500);
    try {
      add(key, (await probeLeaves(exp)).errs);
    } catch (e) {
      add(key, [`tấm sơn mài: lỗi dò ${e.message.split('\n')[0]}`]);
    }
    // can chi có ghi chú (1514): chuột rê lên chữ can chi ở tiêu đề tấm phải → thẻ ghi chú nguyên văn
    if (exp.canChiNote) {
      const c = await E(() => { const r = document.querySelector('.lq-cc')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (c) {
        await page.mouse.move(c.x, c.y, { steps: 3 });
        await sleep(450);
        const cc = await E(() => window.__vm.cinemaRich.state().dbg?.rich?.cc);
        if (!cc?.on || !cc.text.includes(exp.canChiNote)) add(key, [`tấm phải: rê can chi không hiện thẻ ghi chú (${JSON.stringify(cc)})`]);
        await page.mouse.move(p.x, p.y, { steps: 3 });
        await sleep(300);
      }
    }
    // lớp đọc
    await E(() => window.__vm.cinemaRich.read());
    await E(async () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 5000) {
        await new Promise((r) => setTimeout(r, 100));
        if (window.__vm.cinemaRich.dev().reader.state().settled) break;
      }
    });
    await page.mouse.move(W - 20, H / 2);
    await sleep(300);
    if (exp.canChiNote) {
      const c = await E(() => { const r = document.querySelector('.rd .rd-cc')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (c) {
        await page.mouse.move(c.x, c.y, { steps: 3 });
        await sleep(600);
        const hot = await E(() => window.__vm.cinemaRich.dev().reader.state().hot);
        if (hot?.kind !== 'term' || !hot.card || !hot.text.includes(exp.canChiNote)) add(key, [`lớp đọc: rê can chi không hiện thẻ ghi chú (${JSON.stringify(hot)})`]);
        await page.mouse.move(W - 20, H / 2);
        await sleep(300);
      }
    }
    try {
      add(key, (await probeReader(exp)).errs);
    } catch (e) {
      add(key, [`lớp đọc: lỗi dò ${e.message.split('\n')[0]}`]);
    }
    await page.keyboard.press('Escape');
    await E(async () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 4000) {
        await new Promise((r) => setTimeout(r, 100));
        if (!window.__vm.cinemaRich.state().overlay && !window.__vm.cinemaRead()?.on && !window.__vm.cinemaRead()?.tw) break;
      }
    });
    await page.mouse.move(W / 2, H - 20);
    stepMs.push(Date.now() - t0);
    process.stdout.write(`${key} ${fails[key] ? `✗ ${fails[key].length}` : '✓'} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
  }
}

// ---- r83: bản dập (cỡ khung đầu)
const rubReqs = [];
page.on('request', (r) => {
  const m = r.url().match(/rubbings\/(bia-\d+)[^/]*\.webp/);
  if (m) rubReqs.push({ id: m[1], url: r.url() });
});
const rubFails = {};
const gate = {}; // r84: cổng lớp mặt — id → { head, face, side }
/** Ảnh vùng (px client) → mảng RGBA. */
const crop = async (b) => {
  const png = await page.screenshot({ clip: { x: b.x0, y: b.y0, width: Math.max(4, b.x1 - b.x0), height: Math.max(4, b.y1 - b.y0) } });
  return E(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(0, 0, img.width, img.height).data);
  }, png.toString('base64'));
};
const dstat = (a, b) => {
  const d = [];
  for (let i = 0; i < a.length; i += 4) d.push(Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])));
  d.sort((x, y) => x - y);
  return { n: d.length, p99: d[Math.floor(d.length * 0.99)] ?? null, mean: +(d.reduce((s, v) => s + v, 0) / Math.max(1, d.length)).toFixed(2) };
};
/** Vùng cần so (px client): lõi hình đầu rùa · ô mặt bia ngay trên đầu (đối chứng) · hông phải phiến. */
const gateBoxes = () => E(() => {
  const P = (x, y, z) => window.__vm.cinemaGlyphs('project', [x, y, z]);
  const box = (pts, k = 0) => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const dx = (x1 - x0) * k, dy = (y1 - y0) * k;
    return { x0: Math.round(x0 + dx), x1: Math.round(x1 - dx), y0: Math.round(y0 + dy), y1: Math.round(y1 - dy) };
  };
  const h = window.__vm.cinemaHead().head;
  const B = window.__vm.cinemaBounds();
  const F = B.frame;
  // lõi hình đầu: nửa DƯỚI tâm cầu đầu (đỉnh đầu thật thấp hơn đỉnh khối cầu — tránh lẫn mặt bia sau đầu)
  const r = h.radius;
  const head = box([[-0.35 * r, 0], [0.35 * r, 0], [-0.35 * r, -0.55 * r], [0.35 * r, -0.55 * r]].map(([dx, dy]) => P(h.center[0] + dx, h.center[1] + dy, h.center[2])));
  const fy = Math.min(F.top - 0.1, h.center[1] + h.radius * 2.2);
  const face = box([[-0.05, fy - 0.03], [0.05, fy + 0.03]].map(([x, y]) => P((F.left + F.right) / 2 + x, y, B.zFront)));
  const side = box([[B.zFront - 0.03, F.bottom + 0.12], [B.zFront - 0.12, F.bottom + 0.12], [B.zFront - 0.03, F.spring - 0.05], [B.zFront - 0.12, F.spring - 0.05]].map(([z, y]) => P(B.slabR + 0.002, y, z)), 0.2);
  return { head, face, side };
});
/** Đang quét (camera đứng yên): ảnh trước / sau ở các vùng. */
const gateRun = async (keys) => {
  // mô hình đã ở LOD cao nhất (đổi LOD giữa hai ảnh = cả rùa đổi điểm ảnh)
  await E(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      const l = window.__vm.cinemaLods(), rv = window.__vm.cinemaReveal();
      if (l.liveLod === 0 && !rv.proxy && !rv.revealing) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  await E(() => window.__vm.cinemaLoop(false));
  // camera tới hẳn khung (vòng hover / về khung 3/4 còn dở) — 3 s giờ mô phỏng, rồi mới chụp
  await E(() => { for (let i = 0; i < 180; i++) window.__vm.cinemaTick(1 / 60); });
  await sleep(100);
  const bx = await gateBoxes();
  const ref = {};
  if (process.env.GATE_DUMP) await page.screenshot({ path: `${process.env.GATE_DUMP}/${await E(() => window.__vm.cinemaIdle().id)}-${keys[0]}-ref.png` });
  for (const k of keys) ref[k] = await crop(bx[k]);
  await E(() => { window.__vm.cinemaScan('start'); for (let i = 0; i < 180; i++) window.__vm.cinemaTick(1 / 60); });
  const out = { scan: await E(() => { const s = window.__vm.cinemaScan(); return { p: s.p, w: s.u?.[3] }; }), fx: await E(() => window.__vm.cinemaGlyphs().shader?.on ?? null) };
  if (process.env.GATE_DUMP) await page.screenshot({ path: `${process.env.GATE_DUMP}/${await E(() => window.__vm.cinemaScan().id)}-${keys[0]}-on.png` });
  for (const k of keys) out[k] = dstat(ref[k], await crop(bx[k]));
  await E(() => { window.__vm.cinemaScan('off'); window.__vm.cinemaTick(1 / 60); window.__vm.cinemaLoop(true); });
  out.boxes = bx;
  return out;
};
const rubAdd = (id, e) => (rubFails[id] ??= []).push(e);
const rubStat = { n: 0, ms: [] };
const gotoRest = (id) =>
  E(async (id) => {
    if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
    const t0 = performance.now();
    while (performance.now() - t0 < 12000) {
      await new Promise((r) => setTimeout(r, 100));
      if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0) break;
    }
  }, id);
const v2 = await E(() => !!window.__vm.cinemaLods?.()?.v2);
if (RUB && v2) {
  const [W, H] = SIZES[0];
  await page.setViewportSize({ width: W, height: H });
  await E(() => window.__vm.settings.set('cinemaRubbingScan', true));
  await E(() => window.__vm.settings.set('glyphFx', true));
  await E(() => window.__vm.settings.set('cinemaNames', false)); // r84: tên trên mặt bia cuộn bằng CSS — tắt để so điểm ảnh
  await E(() => window.__vm.settings.set('readerCreep', 0));
  await sleep(500);
  for (const id of IDS) {
    const t0 = Date.now();
    const g = RUB_GEN.steles?.[id];
    if (!g) {
      rubAdd(id, 'bản dập: không có trong rubbings.generated.json');
      continue;
    }
    // phép khớp (tĩnh): 4 mốc mỗi trục tăng dần, phần dư ≤ ngưỡng
    const asc = (a) => a.length === 4 && a.every((t, i) => i === 0 || t > a[i - 1]);
    if (!asc(g.map.u) || !asc(g.map.x) || !asc(g.map.y) || !asc([...g.map.v].reverse())) rubAdd(id, `bản dập: mốc khớp không tăng dần ${JSON.stringify(g.map)}`);
    if (!(g.resid?.max <= RESID_MAX)) rubAdd(id, `bản dập: phần dư căn chỉnh ${(g.resid?.max * 1000).toFixed(1)} ‰ > ${RESID_MAX * 1000} ‰`);
    // tới bia, chưa focus → chưa tải
    await page.mouse.move(W / 2, H - 20);
    await gotoRest(id);
    await sleep(400);
    const before = rubReqs.filter((r) => r.id === id).length;
    const lk0 = await E((id) => window.__vm.cinemaScan('look', id), id);
    if (!lk0.has || lk0.src !== 'v2' || !lk0.url?.endsWith(`rubbings/${id}.webp`) || !/models-v2\//.test(lk0.url)) rubAdd(id, `bản dập: dữ liệu ${JSON.stringify(lk0)}`);
    if (before || lk0.requested) rubAdd(id, `bản dập: đã tải trước khi focus (${before} yêu cầu)`);
    // focus → tải một lần, sẵn sàng
    const p = await E(() => window.__vm.cinemaStelePoint());
    await page.mouse.move(p.x, p.y, { steps: 4 });
    const lk1 = await E(async (id) => {
      const t0 = performance.now();
      while (performance.now() - t0 < 8000) {
        await new Promise((r) => setTimeout(r, 100));
        const l = window.__vm.cinemaScan('look', id);
        if (l.ready) return { ...l, ms: Math.round(performance.now() - t0) };
      }
      return window.__vm.cinemaScan('look', id);
    }, id);
    if (!lk1.ready) rubAdd(id, `bản dập: focus mà ảnh không sẵn sàng sau 8 s (${JSON.stringify(lk1)})`);
    else rubStat.ms.push(lk1.ms);
    // r84: cổng lớp mặt — lõi đầu rùa không đổi, mặt bia ngay trên đổi (camera đứng yên; tên trên mặt bia tắt — cuộn bằng CSS)
    await sleep(2500); // focus hiện đủ (hover theo giờ thật — đèn / camera / tấm sơn mài) rồi mới dừng vòng vẽ
    await E(() => window.__vm.settings.set('glyphTrail', 0.6));
    gate[id] = await gateRun(['head', 'face']);
    // r85: hiệu ứng ánh sáng chữ chạy trên bia này — hạt sáng lấy mẫu từ bản đồ nét, đèn xiên bật lúc quét
    const lx = await E(() => { const g = window.__vm.cinemaGlyphs(); return { ready: g.ready, src: g.src, count: g.count }; });
    if (!lx.ready || lx.src !== 'stroke' || !(lx.count > 100)) rubAdd(id, `ánh sáng chữ: ${JSON.stringify(lx)}`);
    if (gate[id].fx !== 1) rubAdd(id, `ánh sáng chữ: đèn xiên không bật lúc quét (${gate[id].fx})`);
    await E(() => window.__vm.settings.set('glyphTrail', window.__vm.settings.defaults.glyphTrail));
    // quét nhanh: vạch có ảnh (w = 1), chế độ vệt; xong → không gì ở lại
    const sc = await E(async () => {
      window.__vm.cinemaScan('play', 300);
      await new Promise((r) => setTimeout(r, 150));
      const mid = window.__vm.cinemaScan();
      const t0 = performance.now();
      let end = mid;
      // r84: lượt quét của nút = 2 s rồi bắn, vạch đi tiếp tới khi vệt ra khỏi mặt bia (~1,3 × 3,2 s)
      while (performance.now() - t0 < 7000) {
        await new Promise((r) => setTimeout(r, 100));
        end = window.__vm.cinemaScan();
        if (end.mode === 'held') break;
      }
      window.__vm.cinemaScan('off');
      return { mid: { mode: mid.mode, w: mid.u?.[3], trail: mid.trail, tex: mid.tex, id: mid.id }, end: { mode: end.mode, reveal: end.reveal } };
    });
    if (sc.mid.mode !== 'play' || sc.mid.w !== 1 || !sc.mid.trail || !sc.mid.tex || sc.mid.id !== id) rubAdd(id, `bản dập: lúc quét ${JSON.stringify(sc.mid)}`);
    if (sc.end.mode !== 'held' || sc.end.reveal !== 0) rubAdd(id, `bản dập: xong lượt quét ${JSON.stringify(sc.end)}`);
    await page.mouse.move(W / 2, H - 20);
    await sleep(300);
    const after = rubReqs.filter((r) => r.id === id).length;
    if (after !== 1) rubAdd(id, `bản dập: ${after} yêu cầu tải (cần đúng 1)`);
    // r84: hông phiến ở khung 3/4 lúc nghỉ (mỗi 6 bia + 1442, 1664) — bản dập đã nạp
    if (IDS.indexOf(id) % 6 === 0 || id === 'bia-1442' || id === 'bia-1664') {
      await sleep(2600); // camera về khung 3/4
      await E(() => window.__vm.settings.set('glyphTrail', 0.6));
      gate[id].side = (await gateRun(['side'])).side;
      await E(() => window.__vm.settings.set('glyphTrail', window.__vm.settings.defaults.glyphTrail));
    }
    rubStat.n++;
    process.stdout.write(`bản dập ${id} ${rubFails[id] ? `✗ ${rubFails[id].length}` : '✓'} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
  }
  // quay lại bia đầu (đã focus) → không tải lại
  const id0 = IDS[0];
  const n0 = rubReqs.filter((r) => r.id === id0).length;
  await gotoRest(id0);
  const p0 = await E(() => window.__vm.cinemaStelePoint());
  await page.mouse.move(p0.x, p0.y, { steps: 4 });
  await sleep(1200);
  rubStat.again = { id: id0, before: n0, after: rubReqs.filter((r) => r.id === id0).length, ready: (await E((id) => window.__vm.cinemaScan('look', id), id0)).ready };
  await page.mouse.move(SIZES[0][0] / 2, SIZES[0][1] - 20);
}

// ---- r83: lùi về v1 (models-v2 không với tới) — trình duyệt riêng
let V1 = null;
if (RUB) {
  const b = await launch({ headed, width: 1440, height: 900, settings: { autoRotate: false, cinemaIdleAutoplay: false, handTutorial: false, tutorialFirstLoad: false, cinemaInfo: 'screens', cinemaInfoRich: true, cinemaRubbingScan: true } });
  await b.ctx.route('**/models-v2/catalog.json', (r) => r.fulfill({ status: 404, body: '' }));
  const reqs = [];
  b.ctx.on('request', (r) => {
    if (/rubbings\//.test(r.url())) reqs.push(r.url().replace(/^https?:\/\/[^/]+\//, ''));
  });
  await openCinema(b.page, port, { id: 'bia-1554', hooks: ['cinemaStelePoint', 'cinemaIdle', 'cinemaInfo', 'cinemaScan', 'cinemaLods', 'cinemaTxProgress'], settleMs: 2500 });
  const E1 = (fn, a) => b.page.evaluate(fn, a);
  const go = async (id) => {
    await b.page.mouse.move(720, 880);
    await E1(async (id) => {
      if (window.__vm.cinemaIdle().id !== id) window.__vm.cinemaInfo.ctx.gotoStele(id);
      const t0 = performance.now();
      while (performance.now() - t0 < 15000) {
        await new Promise((r) => setTimeout(r, 100));
        if (window.__vm.cinemaIdle().id === id && window.__vm.cinemaTxProgress() < 0) break;
      }
    }, id);
    await sleep(500);
    const p = await E1(() => window.__vm.cinemaStelePoint());
    await b.page.mouse.move(p.x, p.y, { steps: 4 });
    await sleep(1500);
    const sc = await E1(async () => {
      window.__vm.cinemaScan('play', 300);
      await new Promise((r) => setTimeout(r, 150));
      const s = window.__vm.cinemaScan();
      await new Promise((r) => setTimeout(r, 1500));
      window.__vm.cinemaScan('off');
      return { mode: s.mode, w: s.u?.[3], trail: s.trail };
    });
    return { look: await E1((id) => window.__vm.cinemaScan('look', id), id), sc };
  };
  V1 = { v2: await E1(() => !!window.__vm.cinemaLods?.()?.v2), ids: await E1(() => window.__vm.cinemaInfo.ctx.steles?.map?.((s) => s.id) ?? null) };
  V1.s1554 = await go('bia-1554');
  V1.req1554 = reqs.length;
  V1.s1442 = await go('bia-1442');
  V1.req1442 = [...reqs];
  V1.s1727 = await go('bia-1727');
  V1.reqEnd = [...reqs];
  V1.errors = b.errors;
  await b.close();
}

// ---- kiểm
if (RUB && v2) {
  report.section(`r83 · bản dập ${IDS.length} bia (nguồn v2)`);
  const list = Object.entries(rubFails).flatMap(([id, es]) => es.map((e) => `${id}: ${e}`));
  const ms = rubStat.ms.sort((a, b) => a - b);
  const res = IDS.map((id) => RUB_GEN.steles?.[id]?.resid?.max ?? 1).sort((a, b) => a - b);
  report.info('phần dư căn chỉnh (‰)', { median: +(res[Math.floor(res.length / 2)] * 1000).toFixed(1), p90: +(res[Math.floor(res.length * 0.9)] * 1000).toFixed(1), max: +(res.at(-1) * 1000).toFixed(1), readyMs: { median: ms[Math.floor(ms.length / 2)], max: ms.at(-1) } });
  report.check(`mỗi bia: dữ liệu v2 · chưa tải trước focus · focus → đúng 1 lần tải, sẵn sàng · quét có ảnh, chế độ vệt, không gì ở lại · phần dư ≤ ${RESID_MAX * 1000} ‰ · (r85) ánh sáng chữ chạy (${rubStat.n}/${IDS.length} bia)`, rubStat.n === IDS.length && list.length === 0, list.slice(0, 20));
  report.check('quay lại bia đã focus → không tải lại', rubStat.again && rubStat.again.after === rubStat.again.before && rubStat.again.ready, rubStat.again);
  const gs = Object.entries(gate);
  const badHead = gs.filter(([, g]) => !(g.scan.w === 1 && g.head.n > 60 && g.head.p99 <= 3 && g.face.mean > 2 * Math.max(0.5, g.head.mean))).map(([id, g]) => `${id}: đầu p99 ${g.head.p99} TB ${g.head.mean} · mặt TB ${g.face.mean} · w ${g.scan.w}`);
  report.check(`cổng lớp mặt: đang quét (vệt 0,6, vạch ~94 %) — lõi đầu rùa không đổi điểm ảnh (Δ sRGB p99 ≤ 3), mặt bia ngay trên có đổi (${gs.length} bia)`, gs.length === IDS.length && badHead.length === 0, badHead.slice(0, 12));
  const sides = gs.filter(([, g]) => g.side);
  const badSide = sides.filter(([, g]) => !(g.side.n > 60 && g.side.p99 <= 3)).map(([id, g]) => `${id}: hông p99 ${g.side.p99} TB ${g.side.mean}`);
  report.check(`cổng lớp mặt: hông phải phiến ở khung 3/4 không đổi điểm ảnh khi quét (${sides.length} bia)`, sides.length >= Math.min(IDS.length, 2) && badSide.length === 0, badSide.length ? badSide : sides.map(([id, g]) => `${id} p99 ${g.side.p99}`).slice(0, 6));
}
if (RUB) {
  report.section('r83 · lùi về v1 (models-v2/catalog.json → 404)');
  const s = V1;
  const r1442 = s.req1442.filter((u) => /rubbings\/bia-1442/.test(u));
  report.check('nguồn v1; 1554 (không bản dập): không tải gì, quét chỉ vạch (uScan.w = 2), không chế độ vệt', !s.v2 && !s.s1554.look.has && s.req1554 === 0 && s.s1554.sc.w === 2 && !s.s1554.sc.trail, { v2: s.v2, look: s.s1554.look, req: s.req1554, sc: s.s1554.sc });
  report.check('1442: bản dập v1 từ public/rubbings (ảnh + bản đồ nét, không qua models-v2), sẵn sàng, quét có ảnh + chế độ vệt', s.s1442.look.has && s.s1442.look.src === 'v1' && s.s1442.look.ready && r1442.length === 2 && r1442.every((u) => !u.includes('models-v2')) && s.s1442.sc.w === 1 && s.s1442.sc.trail, { look: s.s1442.look, req: r1442, sc: s.s1442.sc });
  report.check('1727 (v1, không bản dập): không tải thêm gì, quét chỉ vạch; không lỗi trang', !s.s1727.look.has && s.reqEnd.length === s.req1442.length && s.s1727.sc.w === 2 && s.errors.length === 0, { look: s.s1727.look, reqs: s.reqEnd, sc: s.s1727.sc, errors: s.errors });
}
if (!RUB_ONLY) report.section(`Quét ${IDS.length} bia × ${SIZES.map((s) => s.join('×')).join(' · ')} (nguồn: ${source.n} bia trên dòng thời gian)`);
const byKind = new Map();
for (const [key, errs] of Object.entries(fails)) for (const e of errs) {
  const kind = e.split(':')[0];
  if (!byKind.has(kind)) byKind.set(kind, []);
  byKind.get(kind).push(`${key}: ${e}`);
}
const KINDS = ['tên trên thân bia', 'chữ trên bục', 'HUD', 'tấm sơn mài', 'tấm trái', 'tấm phải', 'lớp đọc', 'Đề danh', 'ghi chú', 'ghi chú không neo', 'ghi chú bên lề', 'người làm bia', 'liên kết năm'];
for (const k of RUB_ONLY ? [] : new Set([...KINDS, ...byKind.keys()])) {
  const list = byKind.get(k) ?? [];
  report.check(`${k}: không lỗi ở mọi bia`, list.length === 0, list.slice(0, 12));
}
const perStele = {};
for (const [key, errs] of Object.entries(fails)) perStele[key] = errs;
console.log(`\nTóm tắt theo bia (${Object.keys(perStele).length} bia·cỡ có lỗi / ${IDS.length * SIZES.length}):`);
for (const [key, errs] of Object.entries(perStele)) console.log(`  ${key}: ${errs.join(' · ')}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ sizes: SIZES, ids: IDS, fails: perStele, stats, msPerStele: Math.round(stepMs.reduce((a, b) => a + b, 0) / Math.max(1, stepMs.length)) }, null, 1));
await close();
process.exit(report.finish(errors));
