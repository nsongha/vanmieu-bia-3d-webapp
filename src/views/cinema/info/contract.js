// HỢP ĐỒNG giữa chế độ Điện ảnh và các "kiểu hiện thông tin" (info layouts).
// Mỗi kiểu là một module riêng trong thư mục này: screens.js · light.js · spread.js,
// export `createInfoLayout(ctx)` trả về một InfoLayout. index.js chọn theo settings.cinemaInfo.
//
// Toạ độ "mặt phẳng bia" (plane-local): nhóm `ctx.plane()` nằm ở mặt trước phiến bia của khay
// hiện tại, đung đưa/quay theo bia. Trục: +X = bên phải người xem ở góc chính diện, +Y = lên
// (y = 0 là mặt sàn), +Z = hướng ra khỏi mặt bia (về phía người xem). Đơn vị: bia cao 1.
//
// Đường vẽ: layout được thêm Object3D vào ctx.plane() (WebGL, bị che đúng bởi đá) và/hoặc
// CSS3DObject vào ctx.css3d.scene (DOM thật: chữ sắc, bấm được, nhưng luôn vẽ TRÊN canvas — không
// bị đá che). Muốn CSS3DObject bám mặt phẳng bia: mỗi khung copy ctx.plane().matrixWorld rồi nhân
// offset cục bộ (xem ctx.planeMatrix()). Lớp HUD màn hình: ctx.hudRoot (DOM, position:absolute, inset:0).
//
// Vòng đời do chế độ Điện ảnh điều khiển (hover bia):
//   show(entry)  → hiện cho bia này (có hoạt ảnh vào)
//   hide()       → ẩn (hoạt ảnh ra, nhanh hơn vào). Chuyển cảnh: hide() gọi ngay khung đầu, phần đang
//                  ra phải đi tiếp TỪ trạng thái hiện tại trên tấm bia cũ (xem metrics(plane)); show()
//                  cho bia mới đến khi phần cũ chưa ra hết thì chờ ra xong rồi mới vào.
//   setEntry(e)  → đổi nội dung khi đang ẩn (đổi bia), không hoạt ảnh
//   update(dt)   → mỗi khung khi layout đang được gắn
//   hitTest(x,y) → true nếu điểm màn hình (CSS px) nằm trên phần thông tin đang hiện
//                  (để việc rê tay/chuột lên thông tin được tính là "vẫn đang hover")
//   dispose()
//
// Quy tắc chung mọi layout phải giữ:
//  - Góc chính diện: bố cục cân đối, chuyên nghiệp; bia là nhân vật chính, không bị che (trừ phần
//    kính trong suốt có chủ đích ở kiểu 'spread').
//  - Số năm khoa thi không còn vẽ riêng trên sân khấu (đã khắc trên bệ): layout nào cần thì tự
//    hiện nó trong phần chữ của mình.
//  - Không hiển thị thông số kỹ thuật file 3D. Chỉ thông tin bia & khoa thi (+ chú giải bộ phận).
//  - Tôn trọng prefers-reduced-motion (thay hoạt ảnh bằng mờ dần đơn giản).
//  - Chữ tiếng Việt đầy đủ dấu, font có subset vietnamese (Be Vietnam Pro, Playfair Display, Bodoni Moda…).
//  - Không cấp phát/đo DOM mỗi khung khi không cần; update() phải rẻ khi đang ẩn.

/**
 * @typedef {Object} SteleMetrics  (toạ độ plane-local)
 * @property {number} slabLeft    mép trái phiến bia (x, âm)
 * @property {number} slabRight   mép phải phiến bia (x, dương)
 * @property {number} height      chiều cao bia (= 1 sau chuẩn hoá)
 * @property {number} bandTop     y đỉnh vùng phiến (≈ vai vòm)
 * @property {number} bandBottom  y chân phiến (ngay trên lưng rùa)
 * @property {number} zFront      z mặt trước phiến (đã là gốc của plane, thường ~0)
 * @property {number} sweepRadius bán kính quét khi đung đưa (world)
 */

/**
 * @typedef {Object} InfoCtx
 * @property {typeof import('three')} THREE
 * @property {import('three').Scene} scene
 * @property {import('three').PerspectiveCamera} camera
 * @property {import('three').WebGLRenderer} renderer
 * @property {{ scene: import('three').Scene, ensure(): void, element: HTMLElement, render(): void }} css3d  (render: vẽ ngay một lượt —
 *           r78 lớp đọc 3D cần phần tử đã gắn vào DOM để đo trước khung kế)
 *           lớp CSS3DRenderer dùng chung (ensure() bật nó lên khi cần; tự render mỗi khung khi có đối tượng)
 * @property {HTMLElement} hudRoot     lớp HUD màn hình (dưới thanh điều khiển của view, trên canvas)
 * @property {() => import('three').Object3D|null} plane      nhóm mặt phẳng của bia hiện tại
 * @property {() => import('three').Matrix4|null} planeMatrix matrixWorld hiện tại của plane (đọc mỗi khung)
 * @property {(plane?:import('three').Object3D|null) => SteleMetrics|null} metrics
 *           số đo của bia mang `plane` (bỏ trống = bia hiện tại). Kiểu nào GIỮ mặt phẳng lúc show() thì phải
 *           hỏi theo chính mặt phẳng đó: lúc chuyển cảnh bia hiện tại đã là bia MỚI, còn phần đang gập / mờ
 *           vẫn nằm trên tấm bia cũ (đi + mờ cùng nó) — đo theo bia mới là nhảy vị trí / cỡ ngay khung đầu.
 * @property {(plane?:import('three').Object3D|null) => number} angleFade  0..1 độ hiện theo góc nhìn (1 = chính
 *           diện) của `plane` (bỏ trống = bia hiện tại). Kiểu gắn mặt phẳng phải nhân vào.
 * @property {(plane?:import('three').Object3D|null) => number} [opacity]  0..1 độ đục của khay mang `plane`
 *           (hiệu ứng chuyển cảnh làm mờ cả khay; 1 ngoài chuyển cảnh, 0 khi khay đã rời cảnh). Kiểu gắn mặt
 *           phẳng nhân vào để mờ cùng tấm bia.
 * @property {(plane?:import('three').Object3D|null) => number} [worldPerPx]  đơn vị thế giới / px CSS ở khung
 *           mặc định của bia mang `plane`.
 * @property {() => {x:number,y:number,w:number,h:number}|null} steleScreenRect  hộp chiếu của bia (CSS px)
 * @property {{enter:(o:{rect:{x:number,y:number,w:number,h:number}, k?:number, mode?:'3d'|'flat', gap?:number, archRise?:number,
 *           dur?:number})=>number, layout:(rect:object, o?:{archRise?:number})=>object|null, exit:(o?:{dur?:number})=>number,
 *           setSource:(fn:((dt:number)=>{k:number}|null)|null)=>void, panel3d:()=>object|null, frame:()=>import('three').Matrix4|null,
 *           shadow:(k:number)=>void, slide:(dy:number)=>void, tween:()=>({kind:string, t:number, dur:number}|null),
 *           on:boolean}|null} [readView]  r74: khung đọc toàn văn — camera sát mặt bia theo ô tấm đọc (px CSS) + tiến độ cuộn 0..1
 *           (stage/read.js). r78: setSource = MỘT nguồn chuyển động (sân khấu gọi fn(dt) mỗi khung trước khi đặt camera, fn trả
 *           {k}); kiểu '3d': panel3d() = hình học tấm CSS3D (toạ độ cục bộ bia: left/top/bottom/z/sigma/wPx/hPx/pxPerK/gap),
 *           frame() = ma trận thế giới của bia, shadow(k) = độ đậm bóng tấm, tween() = tiến độ đoạn camera vào / ra. r80: dur (s) =
 *           thời gian camera tiến vào / lùi ra (cài đặt readerZoomIn / readerZoomOut; giảm chuyển động bỏ qua). r82: slide(dy) = tấm 3D
 *           đang hạ thấp dy (đơn vị bia) lúc trượt mở / đóng (bóng dời theo); tween().t = đồng hồ chung của nhịp tấm / chữ
 * @property {{has:()=>boolean, play:(ms?:number)=>Promise<void>, release:(ms?:number)=>void, prepare:()=>Promise<boolean>, state:object}|null}
 *           [scan]  r74: quét bản dập trên mặt bia (stage/scan.js)
 * @property {(opts:{fit:'window', rect:{x:number,y:number,w:number,h:number}}|null) => void} [requestFraming]
 *           tuỳ chọn cho kiểu HUD: xin view tween camera cho bia vừa khít một ô (null = về khung mặc định)
 * @property {() => {x:number,y:number,active:boolean}} pointer  vị trí tay/chuột hiện tại (CSS px), active khi đang có
 * @property {typeof import('../../../data/anatomy.js').STELE_ANATOMY} anatomy
 * @property {(entry:object) => {label:string,value:string}[]} facts  danh sách "khoa thi / niên hiệu / …" đã định dạng
 * @property {boolean} reduceMotion
 * @property {() => boolean} [cameraUserMoved]  r76: người xem đang tự cầm camera (xoay / zoom), không phải khung ứng dụng lái
 * @property {(id:string) => boolean} [hasStele]  r75: bia `id` có trong ứng dụng
 * @property {((id:string) => void)|null} [gotoStele]  r75: lướt tới bia `id` (như bấm dòng thời gian)
 */

/**
 * @typedef {Object} InfoLayout
 * @property {(entry:object) => void} show
 * @property {() => void} hide
 * @property {(entry:object) => void} setEntry
 * @property {() => boolean} isVisible
 * @property {(dt:number) => void} update
 * @property {(x:number, y:number) => boolean} hitTest
 * @property {() => void} dispose
 */

export {};
