// Worker dựng MeshBVH (three-mesh-bvh) cho MỘT geometry, ngoài luồng chính.
// Nhận BẢN SAO mảng vị trí + chỉ số (geometry gốc không bị "neuter", vẫn vẽ/đo bình thường),
// dựng ở chế độ indirect (không sắp lại index của geometry), trả về các mảng nút đã tuần tự hoá.
import { BufferGeometry, BufferAttribute, MathUtils } from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/**
 * Mô hình qua meshopt được lượng tử hoá: vị trí Int16 chuẩn hoá, xen kẽ (stride 4). MeshBVH đọc
 * kiểu đó qua getX() từng thành phần — chậm hơn hàng chục lần. Giải lượng tử MỘT lần ra Float32
 * liền mạch (đúng giá trị getX() trả về ở luồng chính) rồi mới dựng cây.
 */
function toFloat32(pos) {
  const src = pos.array;
  const stride = pos.stride || pos.itemSize;
  const off = pos.offset || 0;
  if (!pos.normalized && stride === 3 && off === 0 && src instanceof Float32Array) return src;
  const n = Math.floor((src.length - off) / stride);
  const out = new Float32Array(n * 3);
  for (let i = 0, j = off, k = 0; i < n; i++, j += stride, k += 3) {
    if (pos.normalized) {
      out[k] = MathUtils.denormalize(src[j], src);
      out[k + 1] = MathUtils.denormalize(src[j + 1], src);
      out[k + 2] = MathUtils.denormalize(src[j + 2], src);
    } else {
      out[k] = src[j];
      out[k + 1] = src[j + 1];
      out[k + 2] = src[j + 2];
    }
  }
  return out;
}

self.onmessage = ({ data }) => {
  const { id, pos, index, groups, drawRange } = data;
  try {
    const t0 = performance.now();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(toFloat32(pos), 3, false));
    if (index) g.setIndex(new BufferAttribute(index, 1, false));
    for (const gr of groups || []) g.addGroup(gr.start, gr.count, gr.materialIndex);
    if (drawRange) g.setDrawRange(drawRange.start, drawRange.count);

    const bvh = new MeshBVH(g, { indirect: true, setBoundingBox: false });
    const s = MeshBVH.serialize(bvh, { cloneBuffers: false });
    const ms = performance.now() - t0;
    const transfer = s.roots.slice();
    if (s.indirectBuffer) transfer.push(s.indirectBuffer.buffer);
    self.postMessage({ id, roots: s.roots, indirectBuffer: s.indirectBuffer, ms }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
