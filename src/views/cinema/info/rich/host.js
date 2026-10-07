// r71 — bản thử THÔNG TIN MỞ RỘNG cho kiểu "Bình phong" (người dùng: "trên bục … mặt sau cần ghi năm dựng bia và tên người
// soạn bia. Bên trái: tên vua (to, dòng trên), triều đại, niên hiệu (nhỏ dòng dưới) tổng số thi / tổng số đỗ. danh hiệu và
// tên những người đỗ (danh sách rút gọn và danh sách đầy đủ khi expand) (lúc focus thì thông tin đang chạy trên mặt bia sẽ
// chuyển qua đây). Bên phải: lời giới thiệu về bia … nút đọc đầy đủ … 2 phương án … trải nghiệm của 1 phòng trình chiếu
// trưng bày chứ không phải web app").
//
// Gộp HAI InfoLayout sau một: bia có dữ liệu văn bia (src/data/stele-info — r79: cả 82 bia) → kiểu giàu thông tin (r72: một
// thiết kế — tấm sơn mài trong cảnh + lớp đọc toàn màn hình, lacquer.js); bia khác → bình phong gốc. Mỗi lần show chọn theo
// bia; kiểu kia (nếu đang hiện) gập / mờ nốt trên tấm bia của nó như khi rời chuột.
import { hasSteleInfo, loadSteleInfo, peekSteleInfo } from '../../../../data/stele-info.js';

/**
 * @param {import('../contract.js').InfoCtx & {pinInfo:(on:boolean)=>void}} ctx
 * @param {import('../contract.js').InfoLayout & {extent?:()=>number|null}} base  bình phong gốc
 */
export function createRichHost(ctx, base) {
  /** @type {any} */
  let rich = null;
  let disposed = false;
  let entry = null;
  let want = false;
  /** layout đang được yêu cầu hiện (base | rich) */
  let cur = base;

  const infoOf = (e) => (e ? peekSteleInfo(e.id) : null);
  const useRich = (e) => !!rich && !!infoOf(e);

  /** Xong khi kiểu giàu thông tin (tấm + lớp đọc) đã dựng — mở thông tin đầy đủ trước lúc đó thì chờ nó, không bỏ qua. */
  const richReady = import('./lacquer.js')
    .then((m) => {
      if (disposed) return;
      rich = m.createRichLayout(ctx);
      if (entry) rich.setEntry(entry, infoOf(entry));
      if (want && entry) api.show(entry); // đang hiện bình phong gốc cho bia giàu thông tin → chuyển sang
    })
    .catch((err) => console.error('[cinema/info] không nạp được kiểu thông tin mở rộng', err));

  /** Tải dữ liệu của bia (một lần) — xong mà bia vẫn đang được xem + đang hiện → chuyển sang kiểu giàu thông tin. */
  function prefetch(e) {
    if (!e || !hasSteleInfo(e.id) || infoOf(e)) return;
    const id = e.id;
    loadSteleInfo(id).then((info) => {
      if (disposed || !info || entry?.id !== id) return;
      rich?.setEntry(entry, info);
      if (want) api.show(entry);
    });
  }

  const api = {
    show(e) {
      want = true;
      if (e) entry = e;
      prefetch(entry);
      const next = useRich(entry) ? rich : base;
      if (next !== cur) cur.hide();
      cur = next;
      if (cur === rich) rich.show(entry, infoOf(entry));
      else base.show(entry);
    },
    hide() {
      want = false;
      base.hide();
      rich?.hide();
    },
    setEntry(e) {
      if (!e) return;
      entry = e;
      base.setEntry(e);
      rich?.setEntry(e, infoOf(e));
      prefetch(e);
    },
    isVisible: () => base.isVisible() || !!rich?.isVisible(),
    update(dt) {
      base.update(dt);
      rich?.update(dt);
    },
    hitTest(x, y) {
      return !!rich?.hitTest(x, y) || base.hitTest(x, y);
    },
    extent() {
      const l = useRich(entry) ? rich : base;
      return l.extent ? l.extent() : null;
    },
    /** Tên trên thân bia nhường chỗ lúc focus (tấm trái đã có danh sách người đỗ). */
    richFor: (id) => !!rich && !!id && !!peekSteleInfo(id),
    overlayOpen: () => !!rich?.overlayOpen?.(),
    closeFull: (why) => !!rich?.closeFull?.(why), // r84: xem thử chuyển cảnh
    /**
     * r72: mở thông tin đầy đủ (giữ hai ngón trên bia 2 s): bia có dữ liệu văn bia → lớp đọc toàn màn hình ở `at`; chưa tải
     * xong → tải rồi mở (nếu bia vẫn là bia đó); bia khác → false (view hiện thông tin thường).
     */
    openFull(e, at = 'top', opts = {}) {
      if (e) entry = e;
      if (!entry || !hasSteleInfo(entry.id)) return false;
      const id = entry.id;
      if (rich && infoOf(entry)) {
        rich.setEntry(entry, infoOf(entry));
        return !!rich.openFull(at, opts);
      }
      // r73: chưa có tấm / dữ liệu (bia vừa tới, chunk chưa về) → chờ CẢ HAI rồi mở — không lặng lẽ bỏ qua
      Promise.all([loadSteleInfo(id), richReady]).then(([info]) => {
        if (disposed || !info || entry?.id !== id || !rich) return;
        rich.setEntry(entry, info);
        rich.openFull(at, opts);
      });
      return true;
    },
    /** r73: chuẩn bị mở thông tin đầy đủ (bắt đầu giữ hai ngón): tải sẵn dữ liệu bia — mở lúc 'fire' là tức thì. */
    prepareFull(e) {
      if (e) entry = e;
      if (entry && hasSteleInfo(entry.id)) loadSteleInfo(entry.id);
    },
    dispose() {
      disposed = true;
      rich?.dispose();
      base.dispose();
    },
  };
  if (import.meta.env.DEV) {
    api.debugState = () => ({ cur: cur === rich ? 'rich' : 'base', rich: rich?.debugState?.() ?? null, base: base.debugState?.() ?? null });
    /** DEV: thao tác của kiểu giàu thông tin (đề danh, đọc toàn văn…) — xem lacquer.js api.dev */
    api.devRich = () => rich?.dev ?? null;
  }
  return api;
}
