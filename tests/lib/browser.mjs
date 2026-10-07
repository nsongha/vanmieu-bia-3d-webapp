// Trình duyệt cho kiểm thử hành vi: Chrome của máy (kênh 'chrome') qua playwright-core — không tải trình duyệt riêng.
// Hồ sơ tạm mới mỗi lần; cài đặt của app (localStorage 'vm.settings.v1') gieo sẵn trước khi trang chạy.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** --port 5180 · --only a,b · --headed → { port, only: Set|null, headed } (dùng chung cho mọi tệp kiểm thử + trình chạy). */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { port: 5180, only: null, headed: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') out.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) out.port = Number(a.slice(7));
    else if (a === '--only') out.only = new Set(argv[++i].split(','));
    else if (a.startsWith('--only=')) out.only = new Set(a.slice(7).split(','));
    else if (a === '--headed') out.headed = true;
    else out.rest.push(a);
  }
  return out;
}

/**
 * Mở Chrome với hồ sơ tạm.
 * @param {{ width?:number, height?:number, dpr?:number, headed?:boolean, settings?:object, reducedMotion?:boolean, extraArgs?:string[], mobile?:boolean }} opts
 *   mobile (r46): thiết bị cảm ứng (isMobile + hasTouch) → (hover: none) và (pointer: coarse) khớp
 * @returns {Promise<{ ctx, page, close:()=>Promise<void>, errors:string[] }>}
 */
export async function launch(opts = {}) {
  const { width = 1440, height = 900, dpr = 1, headed = false, extraArgs = [] } = opts;
  const args = ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', ...extraArgs];
  if (headed) args.push(`--window-size=${width},${height + 90}`);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-test-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: !headed,
    args,
    viewport: { width, height },
    deviceScaleFactor: dpr,
    ignoreDefaultArgs: ['--enable-automation'],
    ...(opts.mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  if (opts.settings) {
    await ctx.addInitScript((s) => {
      try {
        if (!sessionStorage.getItem('__testSeeded')) {
          localStorage.setItem('vm.settings.v1', JSON.stringify(s));
          sessionStorage.setItem('__testSeeded', '1');
        }
      } catch {}
    }, opts.settings);
  }
  const page = ctx.pages()[0] || (await ctx.newPage());
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  const close = async () => {
    await ctx.close().catch(() => {});
    fs.rmSync(userDataDir, { recursive: true, force: true });
  };
  return { ctx, page, close, errors };
}

/**
 * Mở Điện ảnh ở bia `id`, chờ màn mở đầu xong + các móc DEV cần dùng (tên trong window.__vm, hoặc đường dẫn đầy đủ bắt đầu
 * bằng "__" như "__vmHand.simulateHand"), rồi chờ thêm `settleMs`. query: chuỗi truy vấn (vd. "?handCursor=shown").
 */
export async function openCinema(page, port, { id = 'bia-1554', hooks = ['cinemaTimeline'], settleMs = 2500, timeout = 150000, query = '' } = {}) {
  await page.goto(`http://localhost:${port}/${query}#/cinema/${id}`);
  await page.waitForFunction((hooks) => {
    const b = document.querySelector('.cin-boot');
    if (!b || (b.dataset.state !== 'done' && b.dataset.state !== 'gone')) return false;
    return hooks.every((h) => {
      let o = window;
      for (const k of h.split('.')) o = o?.[k];
      return o != null;
    });
  }, hooks.map((h) => (h.includes('.') || h.startsWith('__') ? h : `__vm.${h}`)), { timeout });
  await allowSyntheticPointerCapture(page);
  await sleep(settleMs);
}

/**
 * Kiểm thử phát sự kiện con trỏ TỔNG HỢP với id của lớp cử chỉ (9001 — HAND_POINTER_IDS). Trình duyệt coi đó là con
 * trỏ không tồn tại → setPointerCapture / releasePointerCapture (OrbitControls, dòng thời gian) ném NotFoundError. Lớp cử
 * chỉ thật tự vá hai hàm này trên canvas trong lúc nó kéo; ở đây vá chung cho các id ≥ 9000 (id khác vẫn ném như thường).
 */
export async function allowSyntheticPointerCapture(page) {
  await page.evaluate(() => {
    if (Element.prototype.__vmSynthCapture) return;
    Element.prototype.__vmSynthCapture = true;
    for (const k of ['setPointerCapture', 'releasePointerCapture']) {
      const orig = Element.prototype[k];
      Element.prototype[k] = function (id) {
        try {
          return orig.call(this, id);
        } catch (e) {
          if (id >= 9000) return undefined;
          throw e;
        }
      };
    }
  });
}
