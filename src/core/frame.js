// Tiện ích khung hình / camera.
import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/** Bounding box thế giới của object. */
export function getBounds(object) {
  _box.setFromObject(object);
  _box.getSize(_size);
  _box.getCenter(_center);
  return { box: _box.clone(), size: _size.clone(), center: _center.clone(), radius: _size.length() / 2 };
}

/**
 * Tính tư thế camera để object vừa khung — KHÔNG thay đổi camera/controls (dùng để tween).
 * @param {THREE.PerspectiveCamera} camera chỉ đọc fov/aspect
 * @param {THREE.Object3D} object
 * @param {{padding?:number, azimuth?:number, elevation?:number, aspect?:number, swept?:boolean, lookAtOffset?:number}} [opts]
 *   azimuth/elevation radian; azimuth 0 = nhìn từ +Z (phía trước), elevation 0 = ngang tầm.
 *   swept: true → tính theo đường kính quét khi object xoay quanh trục Y (turntable), không bị cắt ở mọi góc.
 *   lookAtOffset: dịch điểm nhìn theo trục Y (tỉ lệ chiều cao; dương = nhìn cao hơn → vật thể tụt xuống khung).
 * @returns {{position:THREE.Vector3, target:THREE.Vector3, distance:number, near:number, far:number, center:THREE.Vector3, size:THREE.Vector3}}
 */
export function computeFrame(camera, object, opts = {}) {
  const { padding = 1.15, azimuth = Math.PI / 6, elevation = Math.PI / 14, swept = false, lookAtOffset = 0 } = opts;
  const { box, size, center, radius } = getBounds(object);
  const aspect = opts.aspect ?? camera.aspect;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const width = swept ? Math.hypot(size.x, size.z) : Math.max(size.x, size.z);
  const fitH = (size.y / 2) / Math.tan(vFov / 2);
  const fitW = (width / 2) / Math.tan(hFov / 2);
  let distance = Math.max(fitH, fitW, radius) * padding;

  const dir = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );
  const target = center.clone();
  target.y += lookAtOffset * size.y;

  // Khớp chính xác theo phối cảnh: chiếu 8 góc bbox (hoặc hình trụ quét nếu swept) qua camera thử,
  // co/giãn khoảng cách tới khi điểm xa nhất chạm biên khung (đã trừ padding), rồi căn giữa theo trục dọc.
  const probe = new THREE.PerspectiveCamera(camera.fov, aspect, 0.01, 1000);
  const pts = [];
  if (swept) {
    // Hình trụ bán kính quét quanh trục Y qua tâm bbox: lấy 16 điểm trên 2 vòng đáy/đỉnh.
    const r = width / 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(new THREE.Vector3(center.x + Math.cos(a) * r, box.min.y, center.z + Math.sin(a) * r));
      pts.push(new THREE.Vector3(center.x + Math.cos(a) * r, box.max.y, center.z + Math.sin(a) * r));
    }
  } else {
    for (let i = 0; i < 8; i++) {
      pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    }
  }
  const limit = 1 / padding;
  const v = new THREE.Vector3();
  for (let iter = 0; iter < 6; iter++) {
    probe.position.copy(target).addScaledVector(dir, distance);
    probe.lookAt(target);
    probe.updateMatrixWorld();
    probe.updateProjectionMatrix();
    let maxX = 0, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      v.copy(p).project(probe);
      maxX = Math.max(maxX, Math.abs(v.x));
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    // Căn giữa theo trục dọc: dịch target theo vector "up" của camera.
    const midY = (minY + maxY) / 2;
    if (Math.abs(midY) > 0.005) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(probe.quaternion);
      const worldPerNdc = distance * Math.tan(vFov / 2);
      target.addScaledVector(up, midY * worldPerNdc);
      continue;
    }
    const extent = Math.max(maxX, (maxY - minY) / 2);
    const ratio = extent / limit;
    if (Math.abs(ratio - 1) < 0.01) break;
    distance *= ratio;
  }

  const position = target.clone().addScaledVector(dir, distance);
  return {
    position, target, distance, center, size,
    near: Math.max(0.01, distance / 100),
    far: distance * 20,
  };
}

/**
 * Đặt camera nhìn vào object sao cho vừa khung (áp ngay).
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Object3D} object
 * @param {Parameters<typeof computeFrame>[2] & {controls?:any}} [opts]
 * @returns {{center:THREE.Vector3, distance:number}}
 */
export function frameObject(camera, object, opts = {}) {
  const f = computeFrame(camera, object, opts);
  camera.position.copy(f.position);
  camera.near = f.near;
  camera.far = f.far;
  camera.lookAt(f.target);
  camera.updateProjectionMatrix();
  const { controls } = opts;
  if (controls) {
    controls.target.copy(f.target);
    controls.minDistance = f.distance * 0.15;
    controls.maxDistance = f.distance * 4;
    controls.update();
  }
  return { center: f.target, distance: f.distance };
}
