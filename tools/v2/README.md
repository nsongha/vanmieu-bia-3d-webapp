# Model pipeline v2 — LOD0 / LOD1 / LOD2 cho 82 bia

## Tệp nằm ở đâu

`models-v2/` ở gốc repo, **khoảng 1,28 GB**. Thư mục này nằm trong `.gitignore` (không đưa vào git) và **nằm ngoài `public/`**, nên `vite build` không chép nó vào `dist/`.

```
models-v2/
  manifest.json            mọi bia: nguồn, đặt để, node TRS, bbox, lod0/1/2 (bytes, tris, verts, texture, GPU ước lượng), cờ, thumbnail
  catalog.json             82 mục theo năm: id, stt, year, folder, canChi, hasData (chưa có dữ liệu lịch sử)
  heads.generated.json     đầu rùa đo trên LOD0 (cùng định dạng src/data/heads.generated.json)
  pedestal.generated.json  dấu chân bục đo trên LOD0 (cùng định dạng src/data/pedestal.generated.json)
  thumbs/<id>.webp         800×1000, nền trong suốt (EEVEE, az 30°, el 15° — như v1)
  thumbs/<id>.sm.webp      240×300, cho UI (xem trước ở mũi tên, rê chuột trên dòng thời gian)
  <id>/lod0.glb            ~150k tris · base KTX2 UASTC 4096 · normal map 2048 · TANGENT
  <id>/lod1.glb            25% LOD0 · base KTX2 ETC1S 1024
  <id>/lod2.glb            proxy ~6k tris, chỉ POSITION + NORMAL (hợp đồng tools/make-proxies.mjs)
  <id>/stele.json          mục của bia đó trong manifest
```

Mọi LOD của một bia dùng **cùng node transform** (T = (0, 0.5, 0), S = 0.5). Bia đứng trên y = 0, cao đúng 1, mặt chữ quay về +Z. Nhờ vậy đổi LOD không làm mô hình xê dịch.

Runtime cần:
- `GLTFLoader`, cộng `KTX2Loader` với `setTranscoderPath('basis/')`: `tools/copy-basis.mjs` chép transcoder vào `public/basis/` ở bước postinstall.
- `MeshoptDecoder`.

## Phục vụ

- **Dev:** một middleware Vite ở `/models-v2/` đọc thẳng từ `models-v2/`, giống `test-clips/` trong `vite.config.js`. Middleware này do agent runtime thêm sau.
  - Trang so sánh `tools/v2/preview/` có sẵn một middleware mẫu trong `vite.preview.config.mjs`, phục vụ `/models/v2/**`.
- **Production / kiosk:** app đọc từ một base URL cấu hình được, ví dụ `MODELS_V2_BASE`, trỏ tới:
  - máy chủ tĩnh / CDN, hoặc
  - thư mục đi kèm bản đóng gói kiosk (chép `models-v2/` cạnh `dist/`).

  Gói đầy đủ cần mọi `lod*.glb`, `thumbs/`, `manifest.json` và `catalog.json`. Không cần `stele.json`, vì manifest đã chứa nội dung của nó.
- **Tải lúc mở app** (LOD1 + LOD2 của cả 82 bia, cộng LOD0 cho ±2 bia): khoảng 120 MB, xấu nhất 134 MB. VRAM khoảng 330 MB.

## Dựng lại / chạy tiếp

```sh
node tools/v2/inventory.mjs            # kiểm kê 82 thư mục nguồn (chỉ đọc) → tools/v2/sources.json
node tools/v2/build.mjs --all          # 2 bia song song, nice; bia đã xong (done.json khớp tham số) được bỏ qua
node tools/v2/build.mjs bia-1554 --force
node tools/v2/thumbs.mjs               # thumbnail (bỏ qua bia đã có, mới hơn lod0)
node tools/v2/catalog.mjs              # catalog.json + kiểm tra can chi / năm trùng
node tools/v2/build.mjs --manifest     # gộp stele.json + thumbs/index.json → manifest.json
node tools/v2/verify.mjs               # kiểm hợp đồng LOD (TRS, tập con, đứng y=0 cao 1)
node tools/v2/qa-sheet.mjs             # bảng QA 82 bia (cần ảnh chụp từ trang preview)
```

- **Tham số:** nằm ở `DEFAULTS` trong `build.mjs`. Đổi tham số thì mọi bia sẽ được dựng lại.
- **Bộ nhớ đệm:** `~/.cache/vanmieu-bia-3d/v2/`. Bia xong thì chỉ giữ `*.meta.json` + `done.json`, khoảng 40 KB mỗi bia. Log nằm ở `logs/`.
- **Chặn đĩa:** còn trống dưới 4 GB (`V2_MIN_FREE_GB`) thì dừng sạch với mã 3. Chạy lại lệnh cũ để tiếp tục.
- **Thời gian:** khoảng 2,5 phút mỗi bia, phần lớn là mã hoá UASTC 4096 đơn luồng để kết quả tất định. Cả 82 bia mất khoảng 105 phút với 2 job.

## Trường hợp riêng

- **1442, 1448:** nguồn là low-poly **bake sẵn** có normal map. LOD0 là chính low-poly đó (71k / 40k tam giác), giữ nguyên pháp tuyến và normal map, chuyển sang KTX2 cùng thông số.
  - `82-1448/Biaso81.obj` (2,93 triệu tam giác) chỉ là bản quét phần rùa của 1448, không có phiến bia, nên không dùng làm nguồn. Xem `.captures/v2-ident-biaso81.jpg`.
- **1637:** sai số giản lược ở 150k là 3,6e-4, vượt 3e-4, nên LOD0 được nâng lên **200k**. Đây là bia duy nhất bị nâng.
- **Nguồn ít hơn 150k tam giác, giữ nguyên:** 1739, 1610, 1661, 1673, 1703.
- **Texture nguồn chỉ 2048**, nên base colour LOD0 cũng dừng ở 2048: 1763, 1731, 1529, 1643, 1718. Manifest ghi ở `flags.textureCapped`.
- **Mặt trước:** v1 đã sửa tay 1727 và 1661 trong `FRONT_OVERRIDE` (`tools/prepare-models.mjs`). v2 sửa thêm 7 bia trong `V2_FRONT_OVERRIDE` (`build.mjs`): 1739, 1667, 1673, 1637, 1478, 1676, 1721.
  - Cả 7 bia này đều bị heuristic chọn nhầm mặt; đã soát bằng ảnh `.captures/v2-front-suspects.jpg` và `v2-front-fixed.jpg`.
  - Thêm bia mới thì luôn soát bảng `qa-sheet.mjs`: nhìn từ +Z phải thấy đầu rùa và mặt chữ.
- **41-1731:** các tệp trong thư mục mang tên `42.*`, nhưng đây là bia khác hẳn 42-1529. Xem `.captures/v2-ident-1731-vs-1529.jpg`.
