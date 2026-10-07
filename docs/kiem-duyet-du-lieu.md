# Kiểm duyệt dữ liệu văn bia

Dữ liệu 82 văn bia (`data/82-van-bia-tien-si.json`, không đưa vào git) được nhập tay và biên tập từ nhiều nguồn, nên có chỗ vênh do sai sót khi nhập liệu. App **không tự sửa** những chỗ này. App hiển thị đúng như dữ liệu và ghi lại ở đây để người kiểm duyệt đính chính khi cần.

Sau khi sửa tệp JSON nguồn, chạy lại:

```bash
node tools/extract-stele-info.mjs --all
```

Công cụ sẽ tạo lại `src/data/stele-info/*.json`, `catalog.generated.json` và `laureates.generated.json`, đồng thời in bảng kiểm tra và danh sách chỗ vênh.

## Quy ước đánh dấu

- `$verify: "cần đối chiếu"`: trường KHÔNG có trong dữ liệu mà được suy ra.
  - Tên vua suy từ niên hiệu (`ERA_KING`).
  - Triều đại suy từ năm thi, khi dữ liệu ghi mơ hồ như "Nhà Lê", "Hậu Lê".
  - Liên kết sang bia khác suy từ năm được nhắc trong tiểu sử.
- `$verify: "AI soạn, cần đối chiếu"`: lời giới thiệu ngắn, được viết CHỈ từ nội dung và ghi chú của chính bia đó (`tools/stele-intros.json`, mỗi câu có ghi nguồn).
- "Tên X còn được ghi ở N bia khác": chỉ nói tên trùng trong dữ liệu, không khẳng định là cùng một người.

## Quyết định hiển thị

- **1514.** Tiêu đề bia ghi "khoa Quý Mùi", nhưng năm 1514 là Giáp Tuất. App hiện theo **tiêu đề trên bia (Quý Mùi)**, kèm chú giải nguyên văn ghi chú của dữ liệu: "Khoa thi Quý Mùi (1513) nhưng được tổ chức vào năm Giáp Tuất (1514)…".
- **1565.** Trường `content` là đoạn mô tả hiện đại (kích thước, hoa văn rồng), không phải bản dịch văn bia. App ghi phần này là "Mô tả bia", không gọi là toàn văn. **Chờ bổ sung bản dịch văn bia.**
- **1589.** Niên hiệu Hưng Trị thường được coi là của nhà Mạc, nhưng văn bia ghi "Thế Tông Nghị hoàng đế" và ghi chú ghi "đời vua Lê Thế Tông". Tên vua để trống.

## Chỗ vênh cần đối chiếu

| Bia | Chỗ vênh |
|---|---|
| 1442 | `contributors.engraver` ghi "Tô Ngại", nhưng lạc khoản ghi "Tô Ngại vâng sắc viết chữ triện". |
| 1442 | Nguyễn Như Đổ 1424–1525 (thọ 101 tuổi). |
| 1466 | `historical_notes` diễn ý "…là rường cột của triều đình", không có nguyên văn trong `content`. |
| 1475 | Người đỗ thứ 35: danh sách trong văn bia ghi "NGUYỄN LI CHÂU", `laureates` ghi "Nguyễn Ly Châu". |
| 1478 | `historical_notes` ghi "6 năm", `content` ghi "Bảy năm sau" (1478 → 1484 là 6 năm). |
| 1481 | `content` ghi "chỉ tuyển chọn được 31 người", nhưng `passed_count`, `historical_notes` và `laureates` đều là 40. |
| 1487 | `content` ghi "(1486)" cạnh "Đinh Mùi niên hiệu Hồng Đức thứ 18", còn `year` là 1487. |
| 1502 | `erection_year` có hai năm: "1502 (Cảnh Thống 5) và 1536 (Đại Chính 7)". |
| 1529 | `content` ghi "Đỗ Tông", danh sách và `laureates` ghi "Đỗ Tổng". |
| 1580 | Năm dựng ghi "Thịnh Đức thứ 1 (1658)", trong khi các bia cùng đợt ghi Thịnh Đức 1 = 1653. Có thể gõ nhầm; hiện `dot` để trống. |
| 1595 | Tiêu đề ghi "Ất Mùi", một dòng trong `content` ghi "Ất Sửu". |
| 1610 | "Hoằng Định năm thứ 12" không khớp các bia cùng niên hiệu; ghi chú của dữ liệu nói nên là năm 11. |
| 1619 | Tiêu đề không có can chi. |
| 1623 | Danh hiệu không ghi giáp, nên giáp 3 là suy ra (`tierVerify`). |
| 1646 | Người soạn "Hàn lâm viện Đãi chế Tham tụng (Không ghi rõ tên)". |
| 1685 | Tiêu đề ghi "Chính Hòa năm thứ 6", nhưng `content` và `historical_notes` ghi "năm thứ 10". |
| 1697 | `content` ghi dựng bia "niên hiệu Thịnh Đức thứ 13 (1717)", nhưng Thịnh Đức không có năm 13; các bia cùng đợt ghi "Vĩnh Thịnh thứ 13 (1717)". Lời giới thiệu chỉ ghi năm 1717. |
| 1724 | `passed_count` là 18, nhưng danh sách chỉ có 17 người. |
| 1727 | Văn bia thiếu dòng tiêu đề "Đệ tam giáp". |
| 1577, 1667 | Cả văn bia nằm trên một dòng (công cụ tự tách theo câu). |
| 10 bia | Triều đại ghi mơ hồ, đã suy từ năm thi: 1487, 1511, 1518, 1736, 1754, 1766, 1769, 1772, 1775, 1778. |
| 41 bia | Số sĩ tử dự thi "Không ghi" (app chỉ hiện số người đỗ): 1478, 1487, 1496, 1511, 1518, 1554, 1565, 1577, 1580, 1583, 1589, 1592, 1598, 1602, 1607, 1610, 1616, 1628, 1631, 1646, 1650, 1656, 1659, 1664, 1667, 1688, 1710, 1731, 1736, 1746, 1752, 1754, 1757, 1760, 1763, 1766, 1769, 1772, 1775, 1778, 1779. |
| 1583 | Tiêu đề gõ nhầm "TIẾS SĨ" (app hiện đúng như dữ liệu). |

## Số liệu mẫu cũ đã thay bằng dữ liệu (10 bia mẫu)

Số liệu cũ của `bia.json` do AI điền, chưa kiểm chứng, đã được thay bằng dữ liệu văn bia:

- **1727:** năm dựng 1727 → 1733; số người đỗ 5 → 10.
- **Thêm người đỗ đầu:** 1604, 1661, 1680, 1727, 1779.
- **Thêm người soạn văn:** 9 bia.
