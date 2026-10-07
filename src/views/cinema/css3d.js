// Lớp CSS3D dùng chung cho các kiểu hiện thông tin (ctx.css3d).
//
// CSS3DRenderer của three: phần tử DOM thật (chữ sắc, bấm được, đọc được bằng trình đọc màn hình)
// được đặt trong không gian 3D bằng matrix3d. Lớp này:
//   · chỉ dựng renderer khi có ai gọi ensure() — không kiểu nào cần thì không tốn gì;
//   · chỉ vẽ khi trong scene có đối tượng visible, cộng thêm ĐÚNG MỘT lượt sau khi đối tượng
//     cuối cùng tắt (CSS3DRenderer chỉ ẩn phần tử — display:none — trong lúc render; ngừng vẽ
//     ngay thì phần tử vừa tắt sẽ đứng lì trên màn hình);
//   · gốc DOM không nhận chuột (pointer-events: none) để không nuốt thao tác kéo của canvas.
import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/** Hệ số phóng thế giới của lớp CSS3D (xem createCss3dLayer). */
export const CSS_WORLD_K = 1000;

/**
 * @param {{container:HTMLElement, camera:THREE.PerspectiveCamera}} opts
 */
export function createCss3dLayer({ container, camera }) {
  const scene = new THREE.Scene();
  // r19: vẽ CSS3D trong thế giới PHÓNG TO K lần (scene.scale = K, camera CSS = camera thật với vị trí × K) — ảnh y hệt
  // (phép chiếu phối cảnh không đổi khi phóng đều cả cảnh lẫn camera), nhưng ma trận của từng phần tử không còn tỉ lệ
  // cực nhỏ (≈ 0,002 đơn vị / px) đặt cạnh phối cảnh cỡ nghìn px. Chrome ghép lớp 3D bằng số thực 32 bit: với tỉ lệ nhỏ
  // như vậy, ở một số góc nhìn xiên nó tính sai vùng thấy được của tấm và BỎ cả tấm trong một khung (tấm thông tin
  // "nhấp nháy" dù độ đục / vị trí trong DOM không đổi). Người dùng lớp này vẫn làm việc bằng đơn vị thế giới như cũ.
  scene.scale.setScalar(CSS_WORLD_K);
  const cssCam = new THREE.PerspectiveCamera();
  cssCam.matrixAutoUpdate = false;
  cssCam.matrixWorldAutoUpdate = false;
  function syncCamera() {
    cssCam.projectionMatrix.copy(camera.projectionMatrix);
    cssCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    cssCam.matrixWorld.copy(camera.matrixWorld);
    const e = cssCam.matrixWorld.elements;
    e[12] *= CSS_WORLD_K;
    e[13] *= CSS_WORLD_K;
    e[14] *= CSS_WORLD_K;
    cssCam.matrixWorldInverse.copy(cssCam.matrixWorld).invert();
    cssCam.view = camera.view;
  }
  /** @type {CSS3DRenderer|null} */
  let renderer = null;
  let w = 0;
  let h = 0;
  let hadVisible = false;

  function ensure() {
    if (renderer) return;
    renderer = new CSS3DRenderer();
    const root = renderer.domElement;
    root.classList.add('cin-css3d__root');
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    container.appendChild(root);
    if (w > 0 && h > 0) renderer.setSize(w, h);
  }

  /**
   * Gỡ sạch scene. Sự kiện 'removed' (nơi CSS3DObject tự gỡ phần tử DOM) chỉ bắn cho đúng
   * đối tượng bị gỡ, KHÔNG cho con của nó → tự gỡ phần tử của cả cây.
   * keepOwned: giữ lại đối tượng của chính view (userData.cinemaOwned, vd. tên trên thân bia).
   */
  function dropAll(keepOwned = false) {
    for (const o of [...scene.children]) {
      if (keepOwned && o.userData.cinemaOwned) continue;
      o.traverse((c) => c.element?.remove?.());
      scene.remove(o);
    }
  }

  function anyVisible() {
    const list = scene.children;
    for (let i = 0; i < list.length; i++) if (list[i].visible) return true;
    return false;
  }

  return {
    scene,
    /** Phần tử chứa lớp (luôn tồn tại, kể cả trước ensure()). */
    element: container,
    ensure,
    get enabled() {
      return !!renderer;
    },
    /** Gọi mỗi khung SAU lượt vẽ WebGL. Rảnh (không có gì visible) thì không làm gì. */
    render() {
      if (!renderer) return;
      const vis = anyVisible();
      if (!vis && !hadVisible) return;
      hadVisible = vis;
      camera.updateMatrixWorld();
      syncCamera();
      renderer.render(scene, cssCam);
    },
    setSize(W, H) {
      w = W;
      h = H;
      renderer?.setSize(W, H);
    },
    /** Gỡ mọi đối tượng một kiểu bỏ quên (khi đổi kiểu hiện thông tin). */
    clear() {
      dropAll(true);
      hadVisible = true; // vẽ thêm một lượt để phần tử vừa gỡ/ẩn không đứng lì trên màn hình
    },
    dispose() {
      dropAll();
      renderer?.domElement.remove();
      renderer = null;
    },
  };
}
