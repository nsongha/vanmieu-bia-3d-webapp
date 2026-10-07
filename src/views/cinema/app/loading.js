// Điện ảnh › tải bia — tải bia đích (proxy → LOD / đầy đủ), nâng LOD khi sẵn, tải trước hàng xóm
//
// load / upgradeWhenReady / upgradeLod0 / afterPresent / warm + cửa sổ chữ khắc trên bục (reliefWindow);
// huỷ lượt tải cũ khi người xem đã đi tiếp (cancelStale), hết giờ → lỗi + nút thử lại.
//
// Tách cơ học từ index.js (C): mã + chú thích giữ nguyên văn. Trạng thái dùng chung ở S (xem index.js);
// hàm / đối tượng cố định của nơi khác nhận qua deps, cái có muộn qua K.
// Giữ (S — module này ghi chính): token*, loading*, errorOn*, bailT*, stopPrefetch*
//   (* khai báo + giá trị đầu nằm ở index.js, giữ thứ tự khởi tạo cũ)
// Đọc / ghi S của nơi khác: alive, index, booting
import { cachedRoot, cancelLoad, hasLod, isCached, isProxyCached, loadBia, loadLod, loadProxy, prefetchAll } from '../../../core/loader.js';
import { isLowPowerDevice } from '../../../core/settings.js';
import {
  LOAD_TIMEOUT_MS
} from './config.js';

/**
 * r55: lần hiện TỨC THÌ chờ chữ khắc của bia đích tối đa ngần này (dựng ~0,35–0,4 s + đẩy GPU dải lớn ~0,1 s ở máy phát
 * triển); quá hạn thì vẫn hiện bia, chữ mọc khi tới.
 */
const TEXT_WAIT_MS = 700;

export function installLoading(S, K, deps) {
  const {
    bia, hud, lods, n, reduceMotion, stage
  } = deps;

  // ---- Tải bia (r16) -------------------------------------------------------------------------------------------
  /** id bia đầy đủ đang tải dở do view tự xin (bia đang xem + hàng xóm) — lướt qua rồi thì huỷ (cancelStale). */
  const fullLoads = new Set();
  const neighboursOf = (i) => [bia[(i + 1) % n], bia[(i - 1 + n) % n]];
  /** r19: cửa sổ chữ khắc trên bục quanh bia đang xem — đích + ±1 (lên GPU sẵn) + ±2 (dựng sẵn dữ liệu). */
  function reliefWindow() {
    const at = (d) => bia[(((S.index + d) % n) + n) % n];
    stage.setReliefWindow(at(0), [at(1), at(-1)], [at(2), at(-2)]);
  }
  function loadFull(entry, onProgress) {
    fullLoads.add(entry.id);
    const p = loadBia(entry, onProgress);
    const done = () => fullLoads.delete(entry.id);
    p.then(done, done);
    return p;
  }
  /**
   * Người xem đã đi tiếp: huỷ mọi lượt tải bia đầy đủ view đã xin mà không phải bia đích — lướt nhanh qua nhiều bia
   * thì chỉ bia cuối được tải trọn (băng thông dồn hết cho nó); hàng xóm của nó tải lại sau (afterPresent → warm).
   */
  function cancelStale(entry) {
    if (lods.v2) return; // r21: cửa sổ LOD0 tự huỷ phần ngoài cửa sổ (lods.focus) — hàng xóm gần không bị huỷ oan
    for (const id of [...fullLoads]) {
      if (id === entry.id) continue;
      cancelLoad(id);
      fullLoads.delete(id);
    }
  }

  /**
   * r55: lần hiện TỨC THÌ (giảm chuyển động) không có ~1,6 s lướt để chữ khắc trên bục kịp dựng rồi mọc trước khi
   * bia đáp — chữ phải hiện TRƯỚC bia (luật r19: chữ cho khách biết đang ở năm nào lúc mô hình còn tải). Chữ bia đích chưa
   * sẵn trên GPU → giữ bia cũ, chờ chữ (làn gấp + dải lớn, tối đa TEXT_WAIT_MS) rồi mới hiện: chữ và bia cùng khung. Đã sẵn
   * (±1 dựng + đẩy sẵn lúc yên) → hiện ngay trong lời gọi này như cũ. Lượt lướt thường không đổi.
   */
  function presentWithText(entry, now, my, go) {
    if (!now || S.booting || stage.reliefReady(entry)) return go();
    stage.whenReliefReady(entry, TEXT_WAIT_MS).then(() => {
      if (S.alive && my === S.token) go();
    });
  }

  function load(entry, dir = 1) {
    if (!S.alive) return;
    const my = ++S.token;
    S.loading = true;
    S.errorOn = false;
    hud.clearError();
    cancelStale(entry);
    clearTimeout(S.bailT);
    // r21: cửa sổ LOD0 (±2, theo chiều đang đi) dời theo bia đích — tải / nung / đẩy ra nền, lúc yên
    if (!S.booting) lods.focus(S.index, dir);

    // r21: bản tốt nhất đem lên NGAY: LOD0 đã nung → LOD1 (nhẹ; nâng lên LOD0 tại chỗ lúc yên — upgradeLod0)
    const b = lods.best(entry);
    const now = reduceMotion; // r55: hiện tức thì (không lướt)
    if (b) {
      S.loading = false;
      hud.setLoading(null);
      presentWithText(entry, now, my, () => {
        try {
          stage.present(b.root, dir, entry);
        } catch (err) {
          S.errorOn = true;
          hud.showError(entry, err);
          return;
        }
        K.resetAuto();
        if (b.lod === 1) upgradeLod0(entry, my);
        else afterPresent();
      });
      return;
    }

    // Bia chưa SẴN (chưa tải xong, hoặc đã tải mà chưa nung — present() khi đó phải dựng bản sao, đẩy texture 4096²,
    // biên dịch ngay giữa lúc lướt) nhưng proxy đã có → lướt NGAY bằng proxy; bản thật tải / nung song song, tới lúc
    // sân khấu yên thì quét hiện từ dưới lên (upgradeWhenReady).
    if (isProxyCached(entry.id)) {
      S.loading = false;
      hud.setLoading(null);
      loadProxy(entry)
        .then((proot) => {
          if (!S.alive || my !== S.token) return;
          presentWithText(entry, now, my, () => {
            try {
              stage.present(proot, dir, entry, { proxy: true });
            } catch (err) {
              S.errorOn = true;
              hud.showError(entry, err);
              return;
            }
            K.resetAuto();
            upgradeWhenReady(entry, my);
          });
        })
        .catch(() => {});
      return;
    }

    let settled = false;
    // v2: chưa có gì (hiếm — proxy nạp hết lúc mở màn) → tải LOD1 (nhẹ) với vạch tải, rồi nâng lên LOD0
    const firstLod = lods.v2 && hasLod(entry, 1) ? 1 : 0;
    const bar = firstLod === 1 ? !cachedRoot(entry.id, 1) : !isCached(entry.id); // đã có trong cache thì khỏi nháy vạch tải
    hud.setLoading(bar ? 0 : null);

    const finish = () => {
      settled = true;
      S.loading = false;
      clearTimeout(S.bailT);
      hud.setLoading(null);
    };

    const fail = (err) => {
      if (!S.alive || my !== S.token || settled) return;
      finish();
      if (err?.name === 'AbortError') return;
      S.errorOn = true;
      hud.showError(entry, err);
    };

    // Không bao giờ để kẹt: tải treo quá lâu cũng phải rơi về thẻ lỗi + nút thử lại.
    S.bailT = window.setTimeout(() => fail(new Error('Quá thời gian chờ tải mô hình')), LOAD_TIMEOUT_MS);

    const onProg = (f) => {
      if (bar && S.alive && my === S.token && !settled) hud.setLoading(f);
    };
    (firstLod === 1 ? loadLod(entry, 1, onProg) : loadFull(entry, onProg))
      .then((root3d) => {
        if (!S.alive || my !== S.token || settled) return;
        finish();
        presentWithText(entry, now, my, () => {
          try {
            stage.present(root3d, dir, entry);
          } catch (err) {
            S.errorOn = true;
            hud.showError(entry, err);
            return;
          }
          K.resetAuto();
          if (firstLod === 1) upgradeLod0(entry, my);
          else afterPresent();
        });
      })
      .catch(fail);
  }

  /**
   * Đang hiện PROXY (LOD2) của `entry`: chờ bản thật (v2: LOD1 — nhẹ, tới nhanh; LOD0 nếu đã có sẵn trong bộ nhớ · v1:
   * bản đầy đủ) tải xong, rồi (lúc yên — không nung / đẩy texture lên GPU giữa lúc lướt) nung sẵn và quét hiện. Hiện LOD1
   * thì tiếp tục nâng lên LOD0 (upgradeLod0). Người xem đã đi tiếp (token đổi) → thôi; bản đã tải vẫn nằm trong cache.
   */
  async function upgradeWhenReady(entry, my) {
    const still = () => S.alive && my === S.token;
    let root;
    try {
      const prog = (f) => still() && stage.setProxyProgress(entry.id, f);
      if (cachedRoot(entry.id, 0) || !(lods.v2 && hasLod(entry, 1))) {
        // r19: tiến độ byte → phần "đầy" của proxy dâng theo (stage.setProxyProgress)
        root = await loadFull(entry, prog);
      } else root = await loadLod(entry, 1, prog);
    } catch (err) {
      if (still() && err?.name !== 'AbortError') {
        S.errorOn = true;
        hud.showError(entry, err);
      }
      return;
    }
    if (!still()) return;
    await stage.whenCalm();
    if (!still()) return;
    await stage.preheat(root, { entry, keep: true });
    if (!still()) return;
    await stage.whenCalm();
    if (!still() || !stage.upgrade(root, entry)) return;
    if ((root.userData.lod ?? 0) === 1) upgradeLod0(entry, my);
    else afterPresent();
  }

  /**
   * r21: bia đang hiện ở LOD1 → tải + nung LOD0, rồi thay tại chỗ lúc sân khấu yên (không chuyển cảnh, không quét hiện,
   * không xoa đầu rùa; stage.swapLod mờ chéo 250 ms). Người xem đi tiếp → thôi (LOD0 vẫn nằm trong cửa sổ nếu gần).
   */
  async function upgradeLod0(entry, my) {
    const still = () => S.alive && my === S.token;
    let root;
    try {
      root = await loadFull(entry);
    } catch {
      return;
    }
    if (!still()) return;
    await stage.preheat(root, { entry, keep: true }).catch(() => {});
    for (let tries = 0; tries < 200; tries++) {
      if (!still()) return;
      await stage.whenCalm();
      if (!still()) return;
      if (stage.liveLod === 0) break;
      if (stage.showingProxy) {
        // còn đang quét hiện LOD1 → chờ xong
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      if (stage.swapLod(root, entry)) {
        lods.stats.swaps++;
        break;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    if (still()) afterPresent();
  }

  /** Bia đã lên sân khấu: v1 — nung sẵn hai hàng xóm, lặng lẽ kéo nốt các bia còn lại lúc rảnh (v2: cửa sổ LOD lo). */
  function afterPresent() {
    if (lods.v2) return;
    warm(bia[(S.index + 1) % n]);
    warm(bia[(S.index - 1 + n) % n]);
    if (!S.stopPrefetch && !isLowPowerDevice()) {
      S.stopPrefetch = prefetchAll(bia, {
        // r10: parse / nung sẵn chờ lúc sân khấu yên — không khựng giữa đường camera bay hay lúc đang xoa
        gate: () => stage.whenCalm(),
        // chờ nung xong mới nạp bia kế (việc nền lần lượt, không chồng lên nhau)
        onLoaded: (root, e) => (S.alive ? stage.preheat(root, { entry: e }) : undefined),
      });
    }
  }

  /** Nạp trước hàng xóm rồi nung sẵn shader + texture (+ chữ nổi trên bục) lên GPU (hết khựng lúc chuyển). */
  function warm(entry) {
    if (!S.alive) return;
    loadFull(entry)
      .then(async (root3d) => {
        await stage.whenCalm(); // nung sẵn (tác vụ dài trên luồng chính) chờ hết chuyển cảnh / camera bay
        // người xem đã đi xa (không còn là hàng xóm) → thôi, không nung bia cũ
        if (!S.alive || !neighboursOf(S.index).some((e) => e.id === entry.id)) return;
        stage.preheat(root3d, { keep: true, entry }); // hàng xóm: giữ bản nung sẵn tới lần đổi bia sau
      })
      .catch(() => {});
  }
  return {
    afterPresent, load, loadFull, neighboursOf, reliefWindow,
  };
}
