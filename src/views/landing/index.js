// Màn hình chọn chế độ xem — 3 thẻ, mỗi thẻ mang sắc thái thiết kế của chính view đó.
import './landing.css';
import { ensureFont, FONT } from '../../core/fonts.js';
import { thumbUrl } from '../../core/loader.js';
import { DATA } from '../../data/index.js';

const MODES = [
  {
    key: 'gallery', num: '01', name: 'Trưng bày',
    tagline: 'Catalogue bảo tàng — sáng, thanh lịch: mô hình ở giữa, chú giải hai bên.',
    hint: 'Dòng thời gian dưới chân · mũi tên ← → đổi bia',
  },
  {
    key: 'cinema', num: '02', name: 'Điện ảnh',
    tagline: 'Toàn màn hình, nền tối, ánh sáng kịch tính, tự xoay — trải nghiệm trình chiếu.',
    hint: 'Lướt / phím mũi tên đổi bia · tự trình chiếu',
  },
  {
    key: 'lab', num: '03', name: 'Nghiên cứu',
    tagline: 'Bàn làm việc kỹ thuật — ánh sáng xiên đọc chữ khắc, chế độ đất sét, so sánh 2 bia.',
    hint: 'Dòng thời gian bên trái · bảng công cụ bên phải',
  },
];

export async function mount(root, ctx) {
  ensureFont(FONT.playfair);
  ensureFont(FONT.plexMono);
  const sample = ctx.bia[Math.floor(ctx.bia.length / 2)];
  const y0 = ctx.bia[0]?.year;
  const y1 = ctx.bia[ctx.bia.length - 1]?.year;
  const withData = ctx.bia.filter((b) => b.hasData).length;
  // v2 (82 bia): toàn bộ đã có mô hình 3D, chỉ một phần có tư liệu lịch sử đầy đủ.
  // v1 (lùi về khi thiếu models-v2): đúng 10 bia mẫu, bia nào cũng có đủ tư liệu.
  const sub = DATA.source === 'v2'
    ? `${ctx.bia.length} tấm bia (${y0}–${y1}), quét 3D cấp độ 3 — ${withData} bia đã có đầy đủ tư liệu lịch sử. Chọn một chế độ xem.`
    : `${ctx.bia.length} tấm bia mẫu (${y0}–${y1}), quét 3D cấp độ 3. Chọn một chế độ xem.`;
  root.innerHTML = `
    <main class="landing">
      <header class="landing__head">
        <p class="landing__kicker">Văn Miếu – Quốc Tử Giám · Hà Nội</p>
        <h1 class="landing__title">Bia Tiến sĩ <em>3D</em></h1>
        <p class="landing__sub">${sub}</p>
      </header>
      <ul class="landing__modes">
        ${MODES.map((m) => `
          <li>
            <a class="mode mode--${m.key}" href="#/${m.key}" data-mode="${m.key}">
              <span class="mode__num">${m.num}</span>
              <span class="mode__name">${m.name}</span>
              <span class="mode__tag">${m.tagline}</span>
              <span class="mode__hint">${m.hint}</span>
              <img class="mode__img" src="${thumbUrl(sample)}" alt="" loading="lazy" onerror="this.style.display='none'">
            </a>
          </li>`).join('')}
      </ul>
      <footer class="landing__foot">Dữ liệu 3D: “Xây dựng nội dung số 3D cấp độ 3 (82 bia)”. Mô hình đã tối ưu cho web (meshopt + KTX2, nhiều mức chi tiết).</footer>
    </main>`;
  return { unmount() { root.replaceChildren(); } };
}
