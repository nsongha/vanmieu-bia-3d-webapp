// Nạp GLB (EXT_meshopt_compression; v1: texture WebP · v2: KTX2 UASTC / ETC1S) với cache theo (id, LOD).
//
// r21 — mô hình v2: mỗi bia ba mức chi tiết (src/data/index.js → bia.lods): LOD0 (~150k tam giác, base 4096 + normal
// 2048), LOD1 (25 %, base 1024, không normal map), LOD2 (proxy ~6k tam giác, không vật liệu). Mọi LOD cùng node
// transform → đổi LOD không xê dịch. v1 (10 bia): LOD0 = models/<id>.glb, LOD2 = proxy, không có LOD1.
// Bộ nhớ: bản gốc (root) trong cache giữ geometry + texture DÙNG CHUNG cho mọi bản sao (instantiate); đếm số bản sao
// đang sống (uses) — evictLod() chỉ giải phóng (dispose geometry / vật liệu / texture → GPU) khi không còn bản sao nào.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Giải nén meshopt trong worker (GLTFLoader dùng decodeGltfBufferAsync khi có worker) → parse một bia không còn
// là tác vụ dài trên luồng chính (khựng khung nếu rơi đúng lúc chuyển cảnh / camera bay). 2–4 worker theo số nhân.
// Tạo lười ở lần nạp đầu tiên.
const MESHOPT_WORKERS = Math.min(4, Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
let workersOn = false;
function ensureDecodeWorkers() {
  if (workersOn) return;
  workersOn = true;
  try {
    MeshoptDecoder.useWorkers(MESHOPT_WORKERS);
  } catch {
    /* không tạo được worker (CSP…) → giải nén ngay trên luồng chính như cũ */
  }
}
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const base = import.meta.env.BASE_URL || './';

// KTX2 (Basis Universal, v2): transcoder tự host ở public/basis/ (tools/copy-basis.mjs — offline). Định dạng đích
// (BC7 / ASTC / ETC…) phụ thuộc GPU → cần một renderer để dò (detectSupport); view gọi registerRenderer() ngay khi tạo
// renderer (core/renderer.js). Giải mã Basis chạy trong worker của KTX2Loader.
let ktx2 = null;
let ktxResolve = null;
const ktxReady = new Promise((r) => (ktxResolve = r));
/** Gắn KTX2Loader theo khả năng GPU của renderer đầu tiên (một lần; mọi renderer cùng trình duyệt như nhau). */
export function registerRenderer(renderer) {
  if (ktx2 || !renderer) return;
  try {
    ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).setWorkerLimit(2).detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2);
  } catch (err) {
    console.warn('[loader] không dựng được KTX2Loader', err);
  }
  ktxResolve();
}

/**
 * Lượt nạp theo (id, LOD): promise dùng chung + bộ đếm byte (cho vạch tải) + AbortController (huỷ lượt nạp cũ khi
 * người xem đã lướt qua — cancelLoad) + số bản sao đang sống (uses) + lần dùng gần nhất (LRU của view).
 * @typedef {{promise: Promise<THREE.Group>, ctrl: AbortController|null, loaded: number, total: number,
 *   done: boolean, fetching: boolean, listeners: Set<(f:number)=>void>, root?: THREE.Group, lod: number,
 *   id: string, used: number}} LoadEntry
 */
/** @type {Record<number, Map<string, LoadEntry>>} LOD → id → lượt nạp */
const tables = { 0: new Map(), 1: new Map(), 2: new Map() };
/** id đã nạp xong LOD0 (promise đã resolve). */
const ready = new Set();
/** Tổng byte đã tải (DEV / đo khởi động). */
export const loadStats = { bytes: 0, files: 0, evicted: 0 };

/** URL của một LOD (null nếu bia không có mức đó — v1 không có LOD1). */
export function lodUrl(bia, lod) {
  const L = bia?.lods?.[lod];
  if (L?.url) return L.url;
  if (lod === 0) return bia?.file ?? null;
  if (lod === 2) return bia?.proxy ?? null;
  return null;
}
/** Bia có mức chi tiết này không. */
export const hasLod = (bia, lod) => !!lodUrl(bia, lod);

/**
 * Tải một tệp với tiến độ theo byte (luồng fetch), có thể huỷ. `e.loaded/e.total` cập nhật dần; mọi người nghe trong
 * `e.listeners` nhận tỉ lệ 0..1 (−1 nếu máy chủ không báo tổng).
 */
async function fetchBytes(url, e) {
  const res = await fetch(url, { signal: e.ctrl?.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  e.total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer();
    e.loaded = e.total = buf.byteLength;
    loadStats.bytes += buf.byteLength;
    return buf;
  }
  const reader = res.body.getReader();
  const parts = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    e.loaded += value.byteLength;
    loadStats.bytes += value.byteLength;
    const f = e.total ? Math.min(1, e.loaded / e.total) : -1;
    for (const cb of e.listeners) cb(f);
  }
  const out = new Uint8Array(e.loaded);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  if (!e.total) e.total = e.loaded;
  return out.buffer;
}

/** Chuẩn hoá vật liệu một bia vừa parse (một lần mỗi bia, trước khi view instantiate). */
function tuneLoaded(root, id) {
  root.name = id;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material?.map) o.material.map.anisotropy = 8;
    // Vật liệu DoubleSide + transparent (khi crossfade) bị three vẽ 2 pass (mặt sau rồi mặt trước)
    // → mô hình 300k tam giác tốn gấp đôi ở mọi lượt (kể cả pass phản chiếu). Ép 1 pass.
    if (o.material) {
      const m = o.material;
      m.forceSinglePass = true;
      // Vật liệu ĐỤC: độ mờ khi chuyển cảnh được ghép ảnh (core/transitions.js), không pha trộn alpha.
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
    }
  });
  return root;
}

/**
 * Tải + parse một GLB (một LOD của một bia).
 * gate (r41, tuỳ chọn): () => Promise — chờ nó (sau khi tải xong, TRƯỚC khi parse) để phần parse trên luồng chính rơi vào lúc
 * view rảnh; chỉ lượt nạp đầu tiên của một bia + LOD mang gate (lượt sau dùng chung lời hứa đó).
 */
function startLoad(lod, id, url, after, gate) {
  const table = tables[lod];
  /** @type {LoadEntry} */
  const e = { promise: null, ctrl: typeof AbortController === 'function' ? new AbortController() : null, loaded: 0, total: 0, done: false, fetching: true, listeners: new Set(), lod, id, used: 0 };
  ensureDecodeWorkers();
  e.promise = fetchBytes(url, e)
    .then(async (buf) => {
      e.fetching = false; // từ đây không huỷ nữa (parse cục bộ, ngắn) — xem cancelLoad
      loadStats.files++;
      // KTX2 cần KTX2Loader đã dò GPU (registerRenderer) — tệp không có KTX2 thì parse ngay
      if (!ktx2 && lod !== 2 && url.indexOf('models-v2') >= 0) await ktxReady;
      if (gate) await gate();
      return gltfLoader.parseAsync(buf, '');
    })
    .then((gltf) => {
      e.done = true;
      e.ctrl = null;
      for (const cb of e.listeners) cb(1);
      e.listeners.clear();
      e.root = after(gltf.scene);
      e.root.userData.lod = lod;
      e.root.userData.uses = 0;
      e.used = performance.now();
      return e.root;
    })
    .catch((err) => {
      if (table.get(id) === e) table.delete(id);
      e.listeners.clear();
      throw err;
    });
  table.set(id, e);
  return e;
}

/** Đưa người nghe tiến độ vào một lượt nạp (đang chạy dở vẫn nhận phần còn lại). */
function listen(e, onProgress) {
  if (!onProgress) return;
  if (e.done) onProgress(1);
  else {
    e.listeners.add(onProgress);
    onProgress(e.total ? e.loaded / e.total : e.loaded ? -1 : 0);
  }
}

/**
 * Nạp một mức chi tiết của một bia (cache theo id + LOD). Các view nên `instantiate()` bản gốc trả về (geometry /
 * texture dùng chung, không tốn thêm GPU). Mô hình đã chuẩn hoá: đứng trên y = 0, tâm x/z = 0, cao 1, mặt chữ +Z.
 * @param {object} bia mục bia (src/data/index.js)
 * @param {0|1|2} lod
 * @param {(fraction:number)=>void} [onProgress] 0..1 theo byte (−1 nếu không biết tổng)
 * @param {{gate?: () => Promise<any>}} [opts] gate (r41): chờ trước khi parse — xem startLoad
 * @returns {Promise<THREE.Group>} reject nếu bia không có mức này
 */
export function loadLod(bia, lod, onProgress, opts = {}) {
  const key = bia.id;
  let e = tables[lod]?.get(key);
  if (!e) {
    const url = lodUrl(bia, lod);
    if (!url) return Promise.reject(new Error(`không có LOD${lod} cho ${key}`));
    e = startLoad(lod, key, /^([a-z]+:)?\/\//i.test(url) || url.startsWith('/') ? url : base + url, (root) => {
      if (lod === 2) {
        root.name = `${key}#proxy`;
        root.userData.proxyOf = key;
        return root;
      }
      if (lod === 0) ready.add(key);
      return tuneLoaded(root, key);
    }, opts.gate);
  }
  listen(e, onProgress);
  return e.promise;
}

/**
 * Nạp mô hình ĐẦY ĐỦ (LOD0) của một bia — như trước r21. Tải bằng fetch (luồng, có tiến độ theo byte và huỷ được —
 * cancelLoad); giải nén meshopt trong worker, texture giải mã ngoài luồng chính (ImageBitmap / worker KTX2).
 */
export function loadBia(bia, onProgress) {
  return loadLod(bia, 0, onProgress);
}

/**
 * Huỷ lượt nạp ĐANG CHẠY của một bia (người xem đã lướt qua bia đó) — promise của nó reject (AbortError), lần
 * nạp sau tải lại từ đầu. Đã nạp xong thì không làm gì. Trả true nếu đã huỷ.
 */
export function cancelLoad(id, lod = 0) {
  const e = tables[lod]?.get(id);
  if (!e || e.done || !e.fetching || !e.ctrl) return false;
  tables[lod].delete(id);
  e.ctrl.abort();
  return true;
}

/** Bản gốc của một LOD ĐÃ nạp xong (đồng bộ), hoặc null. Đánh dấu "vừa dùng" cho LRU. */
export function cachedRoot(id, lod = 0) {
  const e = tables[lod]?.get(id);
  if (!e?.done) return null;
  e.used = performance.now();
  return e.root ?? null;
}

/** Tiến độ byte hiện tại của một lượt nạp: { loaded, total, done } (null nếu chưa có lượt nào). */
export function loadState(id, lod = 0) {
  const e = tables[lod]?.get(id);
  return e ? { loaded: e.loaded, total: e.total, done: e.done } : null;
}

/**
 * Proxy của bia (v2: LOD2 · v1: models/proxy/<id>.glb — tools/make-proxies.mjs): lưới rút gọn vài nghìn tam giác, chỉ
 * vị trí + pháp tuyến, CÙNG phép biến đổi với bia đầy đủ → đặt thẳng vào chỗ bia. View gắn vật liệu riêng.
 * @returns {Promise<THREE.Group>} reject nếu bia không có proxy
 */
export function loadProxy(bia, onProgress) {
  return loadLod(bia, 2, onProgress);
}

/** Proxy đã nạp xong? */
export function isProxyCached(id) {
  return !!tables[2].get(id)?.done;
}

/** true nếu LOD (mặc định LOD0) đã nạp xong và nằm trong cache (không cần hiện progress). */
export function isCached(id, lod = 0) {
  return lod === 0 ? ready.has(id) && !!tables[0].get(id)?.done : !!tables[lod]?.get(id)?.done;
}

/** Nạp trước (không chờ) — dùng cho prev/next. */
export function preloadBia(bia, lod = 0) {
  loadLod(bia, lod).catch(() => {});
}

/** URL tuyệt đối tới thumbnail (sm = bản nhỏ 240 × 300 cho giao diện; v1 chỉ có một cỡ). */
export function thumbUrl(bia, sm = false) {
  const t = sm ? bia.thumbSm ?? bia.thumb : bia.thumb;
  return /^([a-z]+:|\/)/i.test(t) ? t : base + t;
}

/**
 * Trả về clone dùng chung geometry/material (vật liệu clone riêng để view có thể sửa). Đếm bản sao đang sống trên bản
 * gốc (disposeInstance trả lại) — evictLod() không bao giờ giải phóng một bản gốc còn bản sao.
 */
export function instantiate(root, { cloneMaterials = false } = {}) {
  const inst = root.clone(true);
  if (cloneMaterials) {
    inst.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.userData.ownedByView = true;
      }
    });
  }
  root.userData.uses = (root.userData.uses ?? 0) + 1;
  inst.userData.srcRoot = root;
  return inst;
}

/** Giải phóng vật liệu đã clone (không đụng tới geometry/texture dùng chung trong cache) + trả lượt dùng bản gốc. */
export function disposeInstance(inst) {
  if (!inst) return;
  inst.traverse((o) => {
    if (o.isMesh && o.material?.userData?.ownedByView) o.material.dispose();
  });
  const src = inst.userData.srcRoot;
  if (src && !inst.userData.released) {
    inst.userData.released = true;
    src.userData.uses = Math.max(0, (src.userData.uses ?? 1) - 1);
  }
}

const TEX_PROPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'bumpMap', 'alphaMap', 'lightMap'];
/** Giải phóng GPU của một bản gốc: geometry, vật liệu, texture (mọi renderer đang giữ bản trên GPU đều nhận sự kiện). */
function disposeRoot(root) {
  const geos = new Set();
  const mats = new Set();
  const texs = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry) geos.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      mats.add(m);
      for (const k of TEX_PROPS) if (m[k]?.isTexture) texs.add(m[k]);
    }
  });
  for (const g of geos) g.dispose();
  for (const t of texs) t.dispose();
  for (const m of mats) m.dispose();
  // Nhả dữ liệu CPU (mảng đỉnh / mip nén) cho GC: bản gốc không dùng lại nữa
  for (const t of texs) {
    if (t.mipmaps) t.mipmaps = [];
    if (t.image?.data) t.image = { width: t.image.width, height: t.image.height, data: null };
  }
}

/**
 * Bỏ một LOD khỏi cache và giải phóng GPU — CHỈ khi không còn bản sao nào đang sống (uses = 0). Lượt nạp đang chạy dở
 * thì huỷ. Trả true nếu đã bỏ.
 * @param {(root: THREE.Group) => void} [beforeDispose] view dọn phần riêng của nó (bản sao nung sẵn, BVH…) trước
 */
export function evictLod(id, lod, beforeDispose) {
  const e = tables[lod]?.get(id);
  if (!e) return false;
  if (!e.done) return cancelLoad(id, lod);
  const root = e.root;
  if (root && (root.userData.uses ?? 0) > 0) return false;
  tables[lod].delete(id);
  if (lod === 0) ready.delete(id);
  if (root) {
    beforeDispose?.(root);
    disposeRoot(root);
  }
  loadStats.evicted++;
  return true;
}

/**
 * Các LOD đã nạp xong: [{ id, lod, uses, used (performance.now lần dùng gần nhất), bytes }] — cho chính sách bộ nhớ của view.
 */
export function residentLods(lod) {
  const out = [];
  for (const L of lod == null ? [0, 1, 2] : [lod]) {
    for (const [id, e] of tables[L]) if (e.done) out.push({ id, lod: L, uses: e.root?.userData.uses ?? 0, used: e.used, bytes: e.total });
  }
  return out;
}

/**
 * r21: bỏ khỏi cache mọi bản gốc có texture đã nhả dữ liệu CPU (view đã đẩy lên GPU của RIÊNG nó rồi nhả — xem
 * cinema/stage.js stripUploadCompressed): renderer của view kế tiếp không đẩy lại được → phải tải lại (bộ đệm HTTP).
 * Gọi khi view rời đi, SAU khi view đã huỷ mọi bản sao. Trả số bản gốc đã bỏ.
 */
export function releaseCpuReleased() {
  let n = 0;
  for (const L of [0, 1, 2]) {
    for (const [id, e] of [...tables[L]]) {
      if (!e.done || !e.root) continue;
      let released = false;
      e.root.traverse((o) => {
        if (released || !o.isMesh || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of TEX_PROPS) if (m?.[k]?.userData?.cpuReleased) released = true;
      });
      if (released && evictLod(id, L)) n++;
    }
  }
  return n;
}

/** DEV (r21): mọi bản gốc đang nằm trong cache: [{ id, lod, root }]. */
export function residentRoots() {
  const out = [];
  for (const L of [0, 1, 2]) for (const [id, e] of tables[L]) if (e.done && e.root) out.push({ id, lod: L, root: e.root });
  return out;
}

/** Chạm "vừa dùng" (LRU) cho một LOD đã nạp. */
export function touchLod(id, lod) {
  const e = tables[lod]?.get(id);
  if (e) e.used = performance.now();
}

/**
 * Nạp dần TẤT CẢ bia lúc rảnh (tuần tự, có nghỉ giữa các bia) để đổi bia không bao giờ phải chờ mạng/parse.
 * @param {Array<object>} entries
 * @param {{ onLoaded?:(root:THREE.Group, entry:object)=>void|Promise<void>, gapMs?:number, gate?:()=>Promise<void>,
 *   lod?: 0|1|2 }} [opts]
 *   onLoaded: chỗ để view preheat (rc.preheat(root, scene, camera)).
 *   gate: chờ trước mỗi bước nặng (parse, preheat) — view cho chờ lúc camera đang bay / đang tương tác.
 *   lod (r21): mức chi tiết nạp trước (mặc định LOD0; view v2 dùng LOD1 — nạp LOD0 cả 82 bia là ~1,2 GB).
 * @returns {() => void} hàm huỷ
 */
export function prefetchAll(entries, opts = {}) {
  let cancelled = false;
  const gap = opts.gapMs ?? 250;
  const lod = opts.lod ?? 0;
  const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, gap)));
  (async () => {
    for (const e of entries) {
      if (cancelled) return;
      if (!hasLod(e, lod)) continue;
      if (!isCached(e.id, lod)) {
        try {
          await opts.gate?.();
          if (cancelled) return;
          const root = await loadLod(e, lod);
          if (cancelled) return;
          await opts.gate?.();
          if (cancelled) return;
          await opts.onLoaded?.(root, e);
        } catch { /* bỏ qua bia lỗi, đi tiếp */ }
      }
      await idle();
      await new Promise((r) => setTimeout(r, gap));
    }
  })();
  return () => { cancelled = true; };
}

/**
 * Mức chi tiết mặc định cho view "một bia" (Trưng bày / Nghiên cứu): v2 có LOD1 → nạp trước LOD1 (nhẹ), LOD0 chỉ cho
 * bia đang xem; v1 → LOD0 như cũ.
 */
export const prefetchLod = (entries) => (entries?.some((e) => hasLod(e, 1)) ? 1 : 0);
