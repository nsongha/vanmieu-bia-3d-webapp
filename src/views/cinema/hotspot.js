// Tiện ích cho các tấm phẳng gắn lên mặt phẳng bia.
//   · neverCastShadow() — khoá cứng castShadow = false.
// (Vệt sáng trán bia khi rê chuột đã bỏ: khách hàng không thích đốm sáng trên mặt bia —
//  thay bằng đèn bục khi thông tin hiện — pedestal.js.)

/**
 * Khoá cứng castShadow = false. Engine chuyển cảnh bàn giao bóng đổ bằng cách duyệt
 * CẢ khay và bật castShadow cho mọi mesh; một tấm phẳng trong suốt mà đổ bóng thì sẽ
 * in lên sàn nguyên một hình chữ nhật.
 */
export function neverCastShadow(mesh) {
  Object.defineProperty(mesh, 'castShadow', {
    configurable: true,
    get: () => false,
    set: () => {},
  });
}
