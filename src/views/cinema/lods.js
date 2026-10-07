// r21 — chính sách mức chi tiết (LOD) + bộ nhớ của Điện ảnh với 82 bia v2 (xem core/loader.js, src/data/index.js).
//
// Ngân sách ~350 MB GPU:
//   · LOD2 (proxy ~6k tam giác, ~30 KB): cả 82 bia, nạp trong lúc vạch tải mở màn (~2,5 MB).
//   · LOD1 (25 %, base 1024 KTX2 ETC1S, ~0,5 MB · ~2 MB GPU): ±3 quanh bia đầu trong lúc vạch tải; sau đó cả 82 bia,
//     lần lượt theo khoảng cách tới bia đang xem, chờ lúc sân khấu yên (whenCalm) — không bao giờ bị đẩy ra.
//   · LOD0 (~150k tam giác, base 4096 + normal 2048, ~16 MB · ~30 MB GPU): bia đang xem ±WINDOW, nạp THEO CHIỀU ĐANG
//     ĐI trước; ngoài cửa sổ thì đẩy ra (LRU, giữ tối đa KEEP_LOD0 = cửa sổ).
// Hiển thị (index.js): LOD0 đã nung → LOD0; không thì LOD1; không thì LOD2 + vẻ chờ (r19). LOD2 → LOD1 / LOD0: quét hiện;
// LOD1 → LOD0: thay tại chỗ lúc yên (stage.swapLod, mờ chéo 250 ms). Không bao giờ thay giữa lúc lướt.
import { loadLod, cachedRoot, cancelLoad, evictLod, residentLods, hasLod, touchLod } from '../../core/loader.js';

const WINDOW = 2;
const KEEP_LOD0 = WINDOW * 2 + 1;
const LOD1_BOOT = 3;

/**
 * @param {{ bia: object[], stage: object, alive: () => boolean, lowPower?: boolean }} cfg
 */
export function createLodManager({ bia, stage, alive, lowPower = false }) {
  const n = bia.length;
  const v2 = bia.some((e) => hasLod(e, 1));
  const at = (i) => bia[((i % n) + n) % n];
  let center = 0;
  let dir = 1;
  let winToken = 0;
  let winIdle = Promise.resolve();
  let lod1Started = false;
  let stopped = false;
  const stats = { lod0Loads: 0, lod0Evicted: 0, lod1Loads: 0, swaps: 0 };

  /** Cửa sổ LOD0 hiện tại, theo thứ tự ưu tiên: bia đang xem, rồi các bia theo chiều đang đi, rồi phía sau. */
  function windowOrder() {
    const out = [at(center)];
    for (let k = 1; k <= WINDOW; k++) out.push(at(center + dir * k));
    for (let k = 1; k <= WINDOW; k++) out.push(at(center - dir * k));
    return out.filter((e, i, a) => a.indexOf(e) === i);
  }

  /** Bản tốt nhất đem lên sân khấu NGAY được: LOD0 đã nung → LOD1 (đã tải) → null (dùng LOD2 / chờ). */
  function best(entry) {
    const r0 = cachedRoot(entry.id, 0);
    if (r0 && stage.isWarm(r0)) return { root: r0, lod: 0 };
    const r1 = v2 ? cachedRoot(entry.id, 1) : null;
    if (r1) return { root: r1, lod: 1 };
    return null;
  }

  /** Đẩy LOD0 ra khỏi bộ nhớ: ngoài cửa sổ, không đang hiện / rời đi, cũ nhất trước; giữ tối đa KEEP_LOD0. */
  function evictLod0() {
    const want = new Set(windowOrder().map((e) => e.id));
    const busy = new Set(stage.busyIds);
    const res = residentLods(0).sort((a, b) => a.used - b.used);
    let count = res.length;
    for (const r of res) {
      if (count <= (v2 ? KEEP_LOD0 : Infinity)) break;
      if (want.has(r.id) || busy.has(r.id)) continue;
      const root = cachedRoot(r.id, 0);
      if (!stage.forget(root)) continue;
      if (evictLod(r.id, 0)) {
        count--;
        stats.lod0Evicted++;
      }
    }
  }

  async function runWindow(token) {
    const list = windowOrder();
    // lượt tải LOD0 đang chạy dở cho bia ngoài cửa sổ → huỷ (băng thông dồn cho bia sắp xem)
    const want = new Set(list.map((e) => e.id));
    for (const e of bia) if (!want.has(e.id)) cancelLoad(e.id, 0);
    // r41: focus() chạy TRƯỚC stage.present() trong cùng tác vụ bấm chuyển — nhường một nhịp để chuyển cảnh đã bắt đầu, nếu
    // không whenCalm() bên dưới thấy sân khấu "còn yên" và cho tải ngay giữa lượt lướt.
    await new Promise((r) => setTimeout(r, 0));
    for (const e of list) {
      if (token !== winToken || stopped || !alive()) return;
      if (!hasLod(e, 0)) continue;
      touchLod(e.id, 0);
      let root = cachedRoot(e.id, 0);
      // r41: bia ngoài bia đang xem (bia vừa vào cửa sổ ±2 khi bấm chuyển) — chờ lúc YÊN (whenCalm: hết lướt / camera bay +
      // CALM_MS; tay đang điều khiển thì chờ thêm) mới tải: lượt tải LOD0 (~16 MB đọc theo mảnh, ghép byte, rồi GLTF parse —
      // JSON, Blob + object URL ảnh… một tác vụ 25–35 ms trên luồng chính) từng rơi đúng đầu lượt lướt. Phần parse còn mang
      // cổng riêng (gate) — lượt tải dài hơn lúc yên thì parse vẫn không chen vào lượt lướt kế tiếp. Nung (preheat) vốn chờ yên.
      const calmGate = e === list[0] ? null : () => stage.whenCalm();
      if (!root && calmGate) {
        await calmGate();
        if (token !== winToken || stopped || !alive()) return;
        root = cachedRoot(e.id, 0);
      }
      if (!root) {
        root = await loadLod(e, 0, undefined, calmGate ? { gate: calmGate } : {}).catch(() => null);
        if (!root) continue;
        stats.lod0Loads++;
      }
      if (token !== winToken || stopped || !alive()) return;
      if (!stage.isWarm(root)) await stage.preheat(root, { keep: true, entry: e }).catch(() => {});
      evictLod0(); // sau mỗi bản mới: giữ đúng trần (không đợi cả cửa sổ xong — lướt nhanh thì cửa sổ luôn bị thay)
    }
    if (token === winToken) evictLod0();
  }

  /** LOD1 cả bộ, lần lượt theo khoảng cách tới bia đang xem, lúc yên; nhường cửa sổ LOD0 đi trước. */
  async function runLod1All() {
    for (;;) {
      if (stopped || !alive()) return;
      await winIdle;
      await stage.whenCalm();
      if (stopped || !alive()) return;
      let next = null;
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const e = bia[i];
        if (!hasLod(e, 1) || cachedRoot(e.id, 1)) continue;
        const d = Math.min(Math.abs(i - center), n - Math.abs(i - center));
        if (d < bestD) {
          bestD = d;
          next = e;
        }
      }
      if (!next) return;
      const root = await loadLod(next, 1).catch(() => null);
      if (!root) continue;
      stats.lod1Loads++;
      if (stopped || !alive()) return;
      await stage.preheat(root, { entry: next }).catch(() => {});
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  return {
    v2,
    stats,
    best,
    /**
     * Bia đang xem đổi (bấm chuyển / mở màn): dời cửa sổ LOD0 (tải + nung theo chiều đang đi, đẩy ra phần ngoài cửa sổ),
     * và (lần đầu) bắt đầu nạp LOD1 cả bộ.
     */
    focus(index, direction = 1) {
      center = index;
      dir = direction < 0 ? -1 : 1;
      evictLod0(); // cửa sổ vừa dời: bản LOD0 ngoài cửa sổ (không đang hiện / rời đi) ra ngay
      const token = ++winToken;
      winIdle = runWindow(token).catch(() => {});
      if (v2 && !lod1Started && !lowPower) {
        lod1Started = true;
        runLod1All();
      }
    },
    /** Đẩy LOD0 ngoài cửa sổ ra ngay (view gọi khi một lần chuyển cảnh vừa xong — bia rời đi hết bản sao). */
    evictNow() {
      evictLod0();
    },
    /** Các bia LOD1 nạp trong lúc vạch tải mở màn (±LOD1_BOOT quanh bia đầu). */
    bootLod1(index) {
      if (!v2) return [];
      const out = [];
      for (let k = -LOD1_BOOT; k <= LOD1_BOOT; k++) if (k) out.push(at(index + k));
      return out.filter((e, i, a) => a.indexOf(e) === i);
    },
    /** DEV: số bản đang nằm trong bộ nhớ theo LOD. */
    resident() {
      return { lod0: residentLods(0).length, lod1: residentLods(1).length, lod2: residentLods(2).length };
    },
    stop() {
      stopped = true;
      winToken++;
    },
  };
}
