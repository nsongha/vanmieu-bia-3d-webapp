// Hằng số của chế độ Điện ảnh — index.js + app/*.js (C: tách nguyên văn từ phần đầu index.js).

export const AUTO_MS = 10000; // tự chuyển bia sau 10 giây — r62: mặc định / dự phòng; thật sự theo settings.cinemaAutoDwell
// r19 — tự trình chiếu khi rảnh (kiosk): settings.cinemaIdleAutoplay / cinemaIdleAfter. r39 (người dùng: "tắt thông tin lúc
// autoplay", không bật đèn bục / đèn chính, không zoom vào chính diện): tự trình chiếu chỉ còn lướt → dừng AUTO_MS → lướt,
// khung nhìn mặc định + ánh sáng thường; không còn pha "trình chiếu như đang hover" (r19: land → hold → out, cinemaAutoInfo).
export const IDLE_AFTER_S = [15, 30, 60, 120];
export const AUTO_TOGGLE_GRACE_MS = 800; // cú bấm ▶ / Space vừa dừng tự trình chiếu → không bật lại thành ▶ tay
// r26: "Trình chiếu ngay" (bảng cài đặt) — rê chuột ngay sau cú bấm (đưa chuột ra khỏi bảng) chưa tính là thao tác
export const PRESENT_NOW_GRACE_MS = 2500;
// r26: đổi bia KHOÁ cho tới khi lượt lướt xong — bấm dồn (nút, phím, vẩy tay, dòng thời gian, tự chuyển) bị bỏ, không
// xếp hàng, nên bia không còn nhảy vị trí giữa chừng. Chờ chuyển cảnh BẮT ĐẦU tối đa NAV_LOCK_START_MS (bia phải tải có
// vạch tiến độ → thôi khoá, người xem đi tiếp được); đang lướt: khoá theo thời lượng thật + NAV_LOCK_SLACK_MS (lưới an
// toàn — bình thường mở khoá ngay khi sân khấu báo xong, view:transition { active: false }).
export const NAV_LOCK_START_MS = 1500;
export const NAV_LOCK_SLACK_MS = 600;
// r51: ‹ › (chuột, phím, vẩy hai ngón) tới trong lúc đang lướt → XẾP HÀNG MỘT lượt (lượt sau thay lượt trước), chạy ngay khi
// lướt xong — không còn "bấm mà không ăn" (khách tưởng hụt, đưa tay về thử lại, …). Nhiều cú trong một lượt lướt vẫn chỉ
// thêm một bia (không dồn chuỗi dài). false = như r26 (bỏ hẳn). Dòng thời gian / Home / End lúc khoá: vẫn bỏ như r26.
export const NAV_QUEUE_ONE = true;
export const gestureOn = () => false;
// Lăn chuột / zoom không có sự kiện "kết thúc": coi như còn thao tác ngần này sau cú lăn cuối.
export const WHEEL_LINGER_MS = 300;
// Đích nam châm hai mép (điều khiển bằng tay): vùng mép mỗi bên = lề 16 + đường kính 88 + lề 16,
// các kiểu hiện thông tin phải chừa ra (ctx.safeArea). Sáng dần trong MAG_RANGE px quanh mép đích.
export const MAG_RANGE = 160;
export const TAP_MS = 280;
export const TAP_SLOP = 12;
/**
 * Kéo quá ngần này (px, bất kỳ con trỏ nào đang nhấn) mới là "cầm camera" — huỷ hoạt ảnh camera tự động (rời /
 * vào hover, chuyển cảnh, tự về khung). Nhấn–nhả tại chỗ (bấm) không bao giờ huỷ / dừng hoạt ảnh.
 */
export const DRAG_TAKEOVER_PX = 5;
export const EDGE = 0.12; // 12% mép trái/phải = lùi/tới (chỉ cảm ứng)
/** Xoa đầu rùa: vẩy hai ngón đổi bia bị bỏ qua nếu vừa xoa trong ngần này (bàn tay xoa hăng không lỡ đổi bia). */
export const RUB_NAV_DAMP_MS = 800;
export const LOAD_TIMEOUT_MS = 25000; // tải quá lâu → coi như lỗi, hiện nút thử lại
