// Danh mục bia cho mọi view.
//
// r21 — hai nguồn, chọn lúc khởi động (initData(), main.js chờ trước khi mount view đầu tiên):
//   · v2 (mặc định): 82 bia từ `models-v2/` (tools/v2/): catalog.json (id, stt, năm, can chi) + manifest.json
//     (LOD0 / LOD1 / LOD2: tệp, byte, GPU ước lượng) + heads / pedestal đo trên LOD0 v2.
//   · v1 (tự lùi về khi không với tới catalog / manifest — bản clone mới không có ~1,28 GB models-v2): 10 bia mẫu trong
//     public/models (+ proxy) theo danh sách bia.json (id, stt, năm, can chi), số đo trong src/data/*.generated.json.
//     Không lỗi, không cảnh báo đỏ.
// r78 — chi tiết lịch sử (niên hiệu, vua, đợt / năm dựng, số đỗ, đỗ đầu, người soạn, mô tả, triều) cho CẢ HAI nguồn lấy từ
// catalog.generated.json (tools/extract-stele-info.mjs, rút từ dữ liệu văn bia của người dùng — 82 bia). Bia có mục ở đó thì
// hasData = true. Trường suy ra (vua theo niên hiệu, mô tả = câu đầu lời giới thiệu AI soạn, triều mơ hồ suy từ năm) có
// "$verify" trong tệp đó — cần đối chiếu. Các giá trị AI cũ của bia.json (chưa kiểm chứng) đã bỏ.
// Gốc URL mô hình v2: import.meta.env.VITE_MODELS_BASE (mặc định 'models-v2/', tương đối với trang).
import raw from './bia.json';
// r78: trường danh mục rút từ dữ liệu văn bia (tools/extract-stele-info.mjs → catalog.generated.json), khóa theo id bia.
import CATALOG from './catalog.generated.json';
// Sinh bởi tools/prepare-models.mjs ({} nếu chưa chạy pipeline).
import generated from './models.generated.json';
// Proxy (lưới rút gọn không texture, cùng phép biến đổi) — tools/make-proxies.mjs ({} nếu chưa chạy).
import proxies from './proxies.generated.json';
import HEADS_V1 from './heads.generated.json';
import PED_V1 from './pedestal.generated.json';
import HEAD_OVERRIDES from './heads.overrides.json';
// r81: ô chữ mặt bia (đo trên mô hình — tools/measure-face-fields.mjs) + sửa tay
import FACE_FIELDS from './face-fields.generated.json';
import FACE_FIELDS_OVR from './face-fields.overrides.json';

export const DOT_LABEL = {
  1: 'Đợt 1 · dựng 1484–1536',
  2: 'Đợt 2 · dựng 1653',
  3: 'Đợt 3 · dựng 1717–1780',
};

/** Gốc URL của mô hình v2 (luôn kết thúc bằng '/'). */
export const MODELS_BASE = String(import.meta.env.VITE_MODELS_BASE || 'models-v2/').replace(/\/?$/, '/');

/**
 * @typedef {{ url:string, bytes:number, gpu:number, tris:number }} LodInfo
 * @typedef {{ id:string, stt:number, year:number, canChi:string, hasData:boolean, nienHieu?:string|null, vua?:string|null,
 *   dot?:1|2|3|null, dung?:number|null, soDo?:number|null, dauKhoa?:string|null, mota?:string, soanVan?:string|null,
 *   dynasty?:string|null, canChiCalc?:string,
 *   title:string, file:string, thumb:string, thumbSm:string, stats:object|null, proxy:string|null, proxyBytes:number,
 *   lods: { 0: LodInfo|null, 1: LodInfo|null, 2: LodInfo|null } }} Bia
 */

/** Nguồn đang dùng + số đo (đầu rùa, dấu chân bục) khớp với nguồn đó. */
export const DATA = {
  /** 'v1' | 'v2' */
  source: 'v1',
  heads: withHeadOverrides(HEADS_V1),
  pedestal: PED_V1,
  /** manifest.json v2 (null ở v1) */
  manifest: null,
  /** lý do lùi về v1 (DEV / chẩn đoán) */
  fallbackReason: '',
};

/** @type {Bia[]} theo năm — MỘT mảng sống: initData() thay nội dung tại chỗ (mọi nơi đã import vẫn thấy bản mới). */
export const BIA = [];

const byIdMap = new Map();
export const byId = (id) => byIdMap.get(id) ?? null;
export const indexOf = (id) => BIA.findIndex((b) => b.id === id);

function setList(list) {
  BIA.length = 0;
  BIA.push(...list.sort((a, b) => a.year - b.year));
  byIdMap.clear();
  for (const b of BIA) byIdMap.set(b.id, b);
}

/** Trường danh mục lấy từ catalog.generated.json (giữ null — giao diện đã xử lý null / thiếu). */
const DETAIL_FIELDS = ['nienHieu', 'vua', 'dot', 'dung', 'soDo', 'dauKhoa', 'soanVan', 'mota', 'dynasty'];
/**
 * r79 (người dùng): can chi HIỆN như tiêu đề bia ghi (canChiTitle của catalog.generated — vd. 1514 "Quý Mùi"); can chi tính từ
 * năm chỉ còn là dữ liệu (canChiCalc). Bia khác: tiêu đề khớp năm → giữ nguyên.
 */
function canChiOf(id, calc) {
  const t = !id || id.startsWith('$') ? null : CATALOG[id]?.canChiTitle;
  return t ? { canChi: t, canChiCalc: calc } : { canChi: calc };
}
/** Chi tiết lịch sử của một bia, hoặc null nếu dữ liệu văn bia chưa có bia này. */
function detailsOf(id) {
  const c = !id || id.startsWith('$') ? null : CATALOG[id];
  if (!c) return null;
  const out = {};
  for (const k of DETAIL_FIELDS) if (k in c) out[k] = c[k];
  return out;
}

/**
 * r81: ô chữ trên mặt bia `id` (toạ độ mô hình: x0 / x1 = hai đường dọc khung trong, y1 = đường khắc dưới dải tiêu đề, y0 = đáy
 * khung trong — không thấp hơn đỉnh đầu rùa) — số dò (face-fields.generated.json) ghi đè bởi phần sửa tay; chỉ dùng khi đúng
 * nguồn mô hình đã đo (toạ độ mô hình v1 ≠ v2). null → lớp tên dùng ô ước lượng cũ (names.js).
 */
export function faceFieldOf(id) {
  if (!id || DATA.source !== FACE_FIELDS.source) return null;
  const g = FACE_FIELDS.steles?.[id];
  const o = FACE_FIELDS_OVR.source === DATA.source ? FACE_FIELDS_OVR.steles?.[id] : null;
  if (!g && !o) return null;
  const f = { ...(g ?? {}), ...(o ?? {}), override: !!o };
  // đường dải tiêu đề: sửa tay y1 mà không ghi band → band theo y1 (band ≡ mép trên ô)
  f.band = o?.band ?? o?.y1 ?? f.band ?? f.y1;
  return ['x0', 'x1', 'y0', 'y1'].every((k) => Number.isFinite(f[k])) && f.x1 > f.x0 && f.y1 > f.y0 ? f : null;
}

/** Đầu rùa đo tự động + phần sửa tay (heads.overrides.json — toạ độ mô hình, đo bằng __vm.cinemaHead() trong DEV). */
function withHeadOverrides(heads) {
  const steles = { ...(heads?.steles ?? {}) };
  for (const [id, ov] of Object.entries(HEAD_OVERRIDES.steles ?? {})) {
    if (!ov || id.startsWith('$')) continue;
    steles[id] = { ...(steles[id] ?? {}), ...ov, source: 'override' };
  }
  return { ...(heads ?? {}), steles };
}

function v1List() {
  return raw.map((b) => ({
    ...b,
    ...(detailsOf(b.id) ?? {}),
    hasData: !!detailsOf(b.id),
    ...canChiOf(b.id, b.canChi),
    title: `Bia Tiến sĩ khoa ${canChiOf(b.id, b.canChi).canChi} (${b.year})`,
    file: `models/${b.id}.glb`,
    thumb: `thumbs/${b.id}.webp`,
    thumbSm: `thumbs/${b.id}.webp`,
    stats: generated[b.id] ?? null,
    proxy: proxies[b.id]?.file ?? null,
    proxyBytes: proxies[b.id]?.bytes ?? 0,
    lods: {
      0: { url: `models/${b.id}.glb`, bytes: generated[b.id]?.bytes ?? 0, gpu: 0, tris: generated[b.id]?.triangles ?? 0 },
      1: null,
      2: proxies[b.id]?.file ? { url: proxies[b.id].file, bytes: proxies[b.id].bytes ?? 0, gpu: 0, tris: proxies[b.id].triangles ?? 0 } : null,
    },
  }));
}

function v2List(catalog, manifest) {
  const M = manifest.steles ?? {};
  return catalog.steles.map((c) => {
    // r78: không dùng c.hasData của catalog.json (chỉ phản ánh 10 bia của bia.json cũ) — có mục trong catalog.generated là có
    const d = detailsOf(c.id);
    const m = M[c.id] ?? {};
    const lod = (n) => {
      const L = m.lods?.[`lod${n}`];
      const file = L?.file ?? `${c.id}/lod${n}.glb`;
      return { url: MODELS_BASE + file, bytes: L?.bytes ?? 0, gpu: L?.gpuBytes?.total ?? 0, tris: L?.tris ?? 0 };
    };
    const thumb = MODELS_BASE + (m.thumb?.file ?? `thumbs/${c.id}.webp`);
    const thumbSm = MODELS_BASE + (m.thumb?.sm?.file ?? `thumbs/${c.id}.sm.webp`);
    const L0 = lod(0);
    const L2 = lod(2);
    return {
      // chi tiết lịch sử (catalog.generated.json) — ghi đè bởi catalog.json cho các trường chung
      ...(d ?? {}),
      id: c.id,
      stt: c.stt,
      year: c.year,
      ...canChiOf(c.id, c.canChi),
      hasData: !!d,
      title: `Bia Tiến sĩ khoa ${canChiOf(c.id, c.canChi).canChi} (${c.year})`,
      file: L0.url,
      thumb,
      thumbSm,
      stats: { bytes: L0.bytes, triangles: L0.tris },
      proxy: L2.url,
      proxyBytes: L2.bytes,
      lods: { 0: L0, 1: lod(1), 2: L2 },
    };
  });
}

// Khởi đầu: v1 (đồng bộ) — đổi sang v2 trong initData() nếu với tới được.
setList(v1List());

const fetchJson = async (url, ms = 6000) => {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl?.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const type = res.headers.get('content-type') || '';
    // máy chủ SPA trả index.html cho đường dẫn lạ → không phải JSON
    if (type && !/json/i.test(type)) throw new Error(`không phải JSON — ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
};

let inited = null;
/**
 * Chọn nguồn dữ liệu (một lần). v2 khi catalog.json + manifest.json đọc được và hợp lệ; ngược lại giữ v1.
 * @returns {Promise<'v1'|'v2'>}
 */
export function initData() {
  inited ??= (async () => {
    try {
      const [catalog, manifest] = await Promise.all([fetchJson(`${MODELS_BASE}catalog.json`), fetchJson(`${MODELS_BASE}manifest.json`)]);
      if (!Array.isArray(catalog?.steles) || !catalog.steles.length || !manifest?.steles) throw new Error('catalog / manifest không hợp lệ');
      const [heads, ped] = await Promise.all([
        fetchJson(`${MODELS_BASE}heads.generated.json`).catch(() => null),
        fetchJson(`${MODELS_BASE}pedestal.generated.json`).catch(() => null),
      ]);
      setList(v2List(catalog, manifest));
      DATA.source = 'v2';
      DATA.manifest = manifest;
      // Số đo v2 (đo trên LOD0 v2); thiếu tệp nào thì dùng tạm bản v1 cho phần đó
      if (heads?.steles) DATA.heads = withHeadOverrides(heads);
      if (ped?.steles) DATA.pedestal = ped;
    } catch (err) {
      DATA.source = 'v1';
      DATA.fallbackReason = String(err?.message || err);
      if (import.meta.env.DEV) console.info('[data] dùng 10 bia v1 —', DATA.fallbackReason);
    }
    return DATA.source;
  })();
  return inited;
}
