// Điện ảnh › mở màn — màn tối + vạch tiến độ tới khi lần đầu mọi thứ đã sẵn
//
// Bia đầu (tải → nung → lên sân khấu sau màn), hai hàng xóm, mọi proxy, font, chữ nổi trên bục, bố cục thông tin
// hover (primeInfo) — tiến độ thật theo byte + trọng số từng bước; quá BOOT_CAP_MS thì mở màn luôn.
//
// Tách cơ học từ index.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem index.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): booting
// Đọc / ghi S của nơi khác: alive, index, token, loading, errorOn
import { FONT, ensureFont } from '../../../core/fonts.js';
import { loadLod, loadProxy } from '../../../core/loader.js';

export function installBoot(S, K, deps) {
  const {
    afterPresent, bia, host, hud, info, loadFull, lods, neighboursOf, reliefWindow, stage
  } = deps;

  // ---- Mở màn (r16) ---------------------------------------------------------------------------------------------
  // Màn tối + vạch vàng mảnh che sân khấu cho tới khi đã sẵn: bia đầu (tải → nung → lên sân khấu phía sau màn, chuyển
  // cảnh chạy luôn phía sau), hai hàng xóm, MỌI proxy (+ chương trình shader proxy), font, chữ nổi trên bục, tên người
  // đỗ + độ sáng ô tên, bố cục thông tin hover (dựng + vẽ một lần). Tiến độ thật: byte tải về + trọng số từng bước.
  const BOOT_CAP_MS = 20000; // quá ngần này thì mở màn luôn (bước nào chưa xong cứ chạy tiếp phía sau)
  const PRIME_INFO_MS = 1100; // hiện thử bố cục thông tin ngần này (≥ hoạt ảnh vào dài nhất của các kiểu)
  S.booting = false;
  const frames = (k) =>
    new Promise((r) => {
      let i = 0;
      const f = () => (++i >= k ? r() : requestAnimationFrame(f));
      requestAnimationFrame(f);
    });
  /** Nạp + tải trước mọi mặt chữ Điện ảnh dùng (chữ trên bục vẽ bằng canvas — cần font thật ngay lần đầu). */
  async function primeFonts() {
    await Promise.all([ensureFont(FONT.bodoni), ensureFont(FONT.beVietnam), ensureFont(FONT.playfair)]);
    if (!document.fonts?.load) return;
    const vi = 'Đỗ Như Hiến · Tiến sĩ Hoàng giáp · ĐẦU KHOA NĂM DỰNG BIA 0123456789';
    const faces = [
      '300 16px "Be Vietnam Pro"',
      '400 16px "Be Vietnam Pro"',
      '500 16px "Be Vietnam Pro"',
      '600 16px "Be Vietnam Pro"',
      '400 16px "Playfair Display"',
      '600 16px "Playfair Display"',
      '700 16px "Playfair Display"',
      'italic 400 16px "Playfair Display"',
      '700 16px "Bodoni Moda"',
      '900 16px "Bodoni Moda"',
    ];
    await Promise.all(faces.map((f) => document.fonts.load(f, vi).catch(() => {})));
  }
  /**
   * Bố cục thông tin hover: hiện một lần SAU màn tối (dựng DOM, tính kiểu + bố cục, raster chữ) rồi ẩn — lần hover
   * thật đầu tiên không phải trả các chi phí lần đầu đó (rớt khung).
   */
  async function primeInfo(entry) {
    await info.whenReady();
    if (!S.alive || !info.mounted) return;
    info.setEntry(entry);
    hud.setBoot('prime'); // bộ ghép lớp phải VẼ thật các lớp dưới màn tối (kính mờ / blur) — xem cinema.css
    info.show(entry);
    // cho hoạt ảnh vào chạy hết (tấm mở hẳn, chữ hiện) — mọi lớp, chữ, hiệu ứng đều được vẽ ít nhất một lần
    const tIn = performance.now();
    while (S.alive && performance.now() - tIn < PRIME_INFO_MS) await frames(2);
    info.hide();
    const t0 = performance.now();
    while (S.alive && info.isVisible() && performance.now() - t0 < 1500) await frames(2);
    hud.setBoot('unprime');
    await stage.whenCalm(); // kiểu 'spread' tự xin khung camera khi hiện — chờ camera về chỗ
  }

  async function boot(entry) {
    S.booting = true;
    const my = S.token;
    host.dataset.ready = '1';
    hud.setBoot(0);
    reliefWindow(); // chữ khắc bia đầu (gấp) + cửa sổ ±2 dựng song song với lúc tải
    const parts = new Map();
    let shown = 0;
    const draw = () => {
      let W = 0;
      let S = 0;
      for (const p of parts.values()) {
        W += p.w;
        S += p.w * p.f;
      }
      const k = W ? S / W : 0;
      if (k > shown + 0.002) {
        shown = k;
        hud.setBoot(k);
      }
    };
    /** Một phần của tiến độ, trọng số w (≈ byte, hoặc "byte tương đương" cho bước không tải gì). */
    const part = (key, w) => {
      const p = { w: Math.max(1, w), f: 0 };
      parts.set(key, p);
      return (f) => {
        if (!(f >= 0)) return;
        p.f = Math.max(p.f, Math.min(1, f));
        draw();
      };
    };
    const KB = 1024;
    const bytesOf = (e) => e?.stats?.bytes ?? 2.5e6;
    const soft = (p) =>
      p.catch((err) => {
        if (S.alive) console.warn('[cinema] mở màn: một bước chuẩn bị lỗi', err);
      });
    // v1: hai hàng xóm LOD0 · v2 (r21): LOD1 của ±3 bia (nhẹ) — LOD0 của cửa sổ ±2 tải nền sau mở màn (lods.focus)
    const nbs = (lods.v2 ? lods.bootLod1(S.index) : neighboursOf(S.index)).filter((e, i, a) => e.id !== entry.id && a.findIndex((x) => x.id === e.id) === i);
    const nbLod = lods.v2 ? 1 : 0;
    const withProxy = bia.filter((e) => e.proxy);
    // Trọng số: byte thật cho phần tải; "byte tương đương" cho bước không tải gì, ước theo thời gian của nó trên máy
    // kiosk (vd. hạ bia xuống bục + dựng chữ nổi + đo ô tên ≈ thời gian tải một bia).
    const MB = 1024 * KB;
    const pFonts = part('fonts', 0.3 * MB);
    const pFirst = part('first', bytesOf(entry));
    const pFirstHeat = part('firstHeat', 1 * MB);
    const pSettle = part('settle', 3.5 * MB);
    const pInfo = part('info', 0.8 * MB);
    const pNb = nbs.map((e) => [part(`nb:${e.id}`, nbLod ? e.lods?.[1]?.bytes || 0.5 * MB : bytesOf(e)), part(`nbHeat:${e.id}`, (nbLod ? 0.15 : 0.6) * MB)]);
    const pProxy = withProxy.map((e) => part(`px:${e.id}`, e.proxyBytes || 60 * KB));
    const pProxyHeat = part('pxHeat', 0.2 * MB);

    const fontsP = soft(primeFonts().then(() => pFonts(1)));
    const firstP = loadFull(entry, pFirst).then(async (root) => {
      pFirst(1);
      await stage.preheat(root, { entry, urgent: true });
      pFirstHeat(1);
      if (!S.alive || my !== S.token) return;
      stage.present(root, 1, entry);
      performance.mark?.('vm:first-present'); // đo khởi động (r21) — rẻ, giữ cả ở bản build
      K.resetAuto();
      await fontsP; // chữ nổi trên bục raster bằng font thật
      const iv = window.setInterval(() => pSettle(stage.settleProgress), 100);
      try {
        await stage.whenSettled();
      } finally {
        clearInterval(iv);
      }
      pSettle(1);
    });
    const nbP = nbs.map((e, i) =>
      soft(
        (nbLod ? loadLod(e, 1, pNb[i][0]) : loadFull(e, pNb[i][0])).then(async (root) => {
          pNb[i][0](1);
          await stage.preheat(root, { keep: !nbLod, entry: e, urgent: true });
          pNb[i][1](1);
        }),
      ),
    );
    const proxyP = soft(
      Promise.all(withProxy.map((e, i) => loadProxy(e, pProxy[i]).then((r) => (pProxy[i](1), r)))).then(async (roots) => {
        if (roots[0] && S.alive) await stage.preheatProxy(roots[0]);
        // r21: số đo phiến của mọi bia tính sẵn trên proxy (nhẹ) — present() không phải quét đỉnh lúc bấm chuyển
        for (let i = 0; i < roots.length && S.alive; i++) {
          stage.premeasure(roots[i]);
          if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
        }
        pProxyHeat(1);
      }),
    );
    let cap = 0;
    const capP = new Promise((r) => (cap = window.setTimeout(r, BOOT_CAP_MS)));
    let failed = null;
    try {
      await Promise.race([firstP, capP]);
    } catch (err) {
      failed = err;
    }
    if (!failed) {
      await Promise.race([Promise.all([fontsP, ...nbP, proxyP]), capP]);
      await Promise.race([soft(primeInfo(entry).then(() => pInfo(1))), capP]);
      // mọi chương trình shader dựng lười trong lúc mở màn (gương, ghép ảnh, đèn bục…) → "dùng lần đầu" ngay
      await frames(2);
      stage.primePrograms();
    }
    clearTimeout(cap);
    if (!S.alive) return;
    for (const p of parts.values()) p.f = failed ? p.f : 1;
    draw();
    if (!failed) await new Promise((r) => setTimeout(r, 260)); // vạch chạy nốt tới cuối rồi mới mờ
    if (!S.alive) return;
    hud.setBoot('done');
    performance.mark?.('vm:boot-done');
    // HUD hiện cùng cảnh (rồi tự ẩn sau 3 s như thường): các lớp kính mờ của nó được vẽ lần đầu ngay lúc này, không phải
    // ở lần di chuột đầu tiên (trùng lúc hover → rớt khung).
    hud.wake();
    S.booting = false;
    S.loading = false;
    if (failed) {
      S.errorOn = true;
      hud.showError(entry, failed);
      return;
    }
    lods.focus(S.index, 1); // r21: cửa sổ LOD0 ±2 + LOD1 cả bộ, nền, lúc yên
    afterPresent();
  }
  return {
    boot,
  };
}
