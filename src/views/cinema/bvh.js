// Bắn tia nhanh bằng three-mesh-bvh.
//
// · Vá prototype của three MỘT lần khi module này được nạp: BufferGeometry.computeBoundsTree /
//   disposeBoundsTree, Mesh.raycast = acceleratedRaycast (mesh nào chưa có cây thì acceleratedRaycast
//   tự rơi về raycast gốc của three — các view khác không đổi hành vi).
// · Cây BVH dựng cho TỪNG geometry, gắn thẳng lên geometry.boundsTree. Loader dùng chung geometry
//   giữa mọi bản sao (instantiate) và giữ cache suốt phiên → dựng một lần, dùng lại qua mọi view và
//   mọi lần mount. Chỉ bỏ cây khi chính geometry bị dispose.
// · Dựng NGOÀI luồng chính: worker (bvh.worker.js) nhận BẢN SAO mảng vị trí/chỉ số, dựng ở chế độ
//   indirect (không sắp lại index của geometry → không phải đẩy lại buffer lên GPU), trả về các mảng
//   nút. Luồng chính chỉ tốn phần chép mảng + gắn cây, chạy trong requestIdleCallback.
//   Không tạo được worker → dựng ngay trên luồng chính trong lúc rảnh (một lần giật, vẫn hơn mỗi
//   120 ms một lần).
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

if (THREE.Mesh.prototype.raycast !== acceleratedRaycast) {
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

/** @type {WeakMap<THREE.BufferGeometry, Promise<boolean>>} */
const pending = new WeakMap();
/** @type {{geometry:THREE.BufferGeometry, resolve:(ok:boolean)=>void}[]} */
const queue = [];
/** @type {Worker|null} */
let worker = null;
let workerBroken = false;
let running = false;
let seq = 0;
const waiting = new Map();

/** DEV/đo đạc: mỗi lần dựng một dòng. */
export const bvhStats = [];

const idle = (fn) =>
  typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 60);

function getWorker() {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(new URL('./bvh.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const done = waiting.get(data.id);
      waiting.delete(data.id);
      done?.(data);
    };
    worker.onerror = (e) => {
      console.warn('[cinema/bvh] worker lỗi, chuyển sang dựng trên luồng chính', e?.message || e);
      workerBroken = true;
      worker?.terminate();
      worker = null;
      for (const [id, done] of waiting) {
        waiting.delete(id);
        done({ id, error: 'worker' });
      }
    };
  } catch (err) {
    console.warn('[cinema/bvh] không tạo được worker', err);
    workerBroken = true;
    worker = null;
  }
  return worker;
}

const trisOf = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

function geometriesOf(root) {
  const set = new Set();
  root?.traverse((o) => {
    if (o.isMesh && !o.userData.noBVH && o.geometry?.attributes?.position) set.add(o.geometry);
  });
  return [...set];
}

/** Mọi mesh trong cây đều đã có BVH chưa. */
export function hasBVH(root) {
  let ok = !!root;
  root?.traverse((o) => {
    // Lưới phụ gắn vào bản sao bia (decal bóng tiếp xúc, dấu DEV…) đánh dấu userData.noBVH: không bắn tia vào,
    // không cần cây. Trước r8 decal bóng tiếp xúc làm hàm này luôn trả false → tia hover luôn rơi về hộp thô.
    if (ok && o.isMesh && !o.userData.noBVH && !o.geometry?.boundsTree) ok = false;
  });
  return ok;
}

/**
 * Xin dựng BVH cho mọi geometry trong root (bỏ qua cái đã có / đang chờ).
 * urgent: chen lên đầu hàng đợi (bia đang hiển thị).
 * @returns {Promise<boolean>} true khi mọi geometry đều đã có cây
 */
export function requestBVH(root, { urgent = false } = {}) {
  const list = geometriesOf(root);
  if (!list.length) return Promise.resolve(false);
  return Promise.all(list.map((g) => ensure(g, urgent))).then((r) => r.every(Boolean));
}

function ensure(geometry, urgent) {
  if (geometry.boundsTree) return Promise.resolve(true);
  let p = pending.get(geometry);
  if (p) {
    if (urgent) {
      const i = queue.findIndex((j) => j.geometry === geometry);
      if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
    }
    return p;
  }
  p = new Promise((resolve) => {
    const job = { geometry, resolve };
    if (urgent) queue.unshift(job);
    else queue.push(job);
  });
  pending.set(geometry, p);
  geometry.addEventListener('dispose', onGeometryDispose);
  pump();
  return p;
}

/** Geometry bị giải phóng → bỏ cây + huỷ việc đang chờ. */
function onGeometryDispose(e) {
  const g = e.target;
  g.removeEventListener('dispose', onGeometryDispose);
  g.userData.__bvhDead = true;
  g.boundsTree = null;
  pending.delete(g);
  const i = queue.findIndex((j) => j.geometry === g);
  if (i >= 0) queue.splice(i, 1)[0].resolve(false);
}

function pump() {
  if (running || !queue.length) return;
  running = true;
  idle(() => {
    const job = queue.shift();
    if (!job) {
      running = false;
      return;
    }
    run(job)
      .catch((err) => {
        console.warn('[cinema/bvh] không dựng được cây', err);
        job.resolve(false);
      })
      .finally(() => {
        running = false;
        pump();
      });
  });
}

async function run({ geometry, resolve }) {
  if (geometry.boundsTree || geometry.userData.__bvhDead) {
    resolve(!!geometry.boundsTree);
    return;
  }
  const t0 = performance.now();
  const w = getWorker();
  if (!w) {
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true, setBoundingBox: false });
    const ms = performance.now() - t0;
    bvhStats.push({ tris: trisOf(geometry), mode: 'main', mainMs: +ms.toFixed(1), totalMs: +ms.toFixed(1) });
    resolve(true);
    return;
  }

  const pos = geometry.attributes.position;
  const posMsg = pos.isInterleavedBufferAttribute
    ? { array: pos.data.array.slice(), stride: pos.data.stride, offset: pos.offset, itemSize: pos.itemSize, normalized: pos.normalized }
    : { array: pos.array.slice(), itemSize: pos.itemSize, normalized: pos.normalized };
  const index = geometry.index ? geometry.index.array.slice() : null;
  const msg = {
    id: ++seq,
    pos: posMsg,
    index,
    groups: geometry.groups.map((g) => ({ start: g.start, count: g.count, materialIndex: g.materialIndex })),
    drawRange: { start: geometry.drawRange.start, count: geometry.drawRange.count },
  };
  const copyMs = performance.now() - t0;
  const transfer = [posMsg.array.buffer];
  if (index) transfer.push(index.buffer);
  const res = await new Promise((done) => {
    waiting.set(msg.id, done);
    w.postMessage(msg, transfer);
  });

  if (geometry.userData.__bvhDead) {
    resolve(false);
    return;
  }
  if (res.error) {
    if (workerBroken) {
      // Worker chết giữa chừng → dựng lại trên luồng chính ở lượt rảnh sau.
      pending.delete(geometry);
      ensure(geometry, true).then(resolve);
      return;
    }
    throw new Error(res.error);
  }
  const t1 = performance.now();
  geometry.boundsTree = MeshBVH.deserialize(
    { version: 1, roots: res.roots, index: null, indirectBuffer: res.indirectBuffer },
    geometry,
    { setIndex: false, indirect: true },
  );
  const attachMs = performance.now() - t1;
  bvhStats.push({
    tris: trisOf(geometry),
    mode: 'worker',
    copyMs: +copyMs.toFixed(2),
    workerMs: +res.ms.toFixed(1),
    attachMs: +attachMs.toFixed(2),
    totalMs: +(performance.now() - t0).toFixed(1),
  });
  resolve(true);
}

/**
 * DEV: đo thời gian dựng BVH đồng bộ trên luồng chính cho một cây (dựng bản bỏ đi, không gắn vào
 * geometry, không đổi index). Chỉ để so sánh — ĐỪNG gọi trong vòng vẽ.
 */
export function measureSyncBuild(root) {
  return geometriesOf(root).map((g) => {
    const t0 = performance.now();
    new MeshBVH(g, { indirect: true, setBoundingBox: false });
    return { tris: trisOf(g), ms: +(performance.now() - t0).toFixed(1) };
  });
}

/** DEV: dựng lại (bỏ đi) trong worker để đo thời gian worker lúc máy rảnh. */
export async function measureWorkerBuild(root) {
  const w = getWorker();
  if (!w) return null;
  const out = [];
  for (const geometry of geometriesOf(root)) {
    const pos = geometry.attributes.position;
    const t0 = performance.now();
    const msg = {
      id: ++seq,
      pos: pos.isInterleavedBufferAttribute
        ? { array: pos.data.array.slice(), stride: pos.data.stride, offset: pos.offset, itemSize: pos.itemSize, normalized: pos.normalized }
        : { array: pos.array.slice(), itemSize: pos.itemSize, normalized: pos.normalized },
      index: geometry.index ? geometry.index.array.slice() : null,
      groups: [],
      drawRange: null,
    };
    const copyMs = performance.now() - t0;
    const res = await new Promise((done) => {
      waiting.set(msg.id, done);
      w.postMessage(msg, [msg.pos.array.buffer, ...(msg.index ? [msg.index.buffer] : [])]);
    });
    out.push({ tris: trisOf(geometry), copyMs: +copyMs.toFixed(1), workerMs: +res.ms.toFixed(1), roundTripMs: +(performance.now() - t0).toFixed(1) });
  }
  return out;
}
