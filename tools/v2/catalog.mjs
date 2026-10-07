#!/usr/bin/env node
// Khung danh mục 82 bia cho app: models-v2/catalog.json, sắp theo năm thi. Mỗi mục CHỈ có trường suy ra được chắc chắn:
//   id (bia-<năm>), stt (số thứ tự thư mục quét), year, folder (tên thư mục nguồn), canChi (tính từ năm theo chu kỳ
//   can chi 60 năm), hasData (r79: bia có mục trong src/data/catalog.generated.json — dữ liệu văn bia, tools/extract-stele-info.mjs;
//   src/data/index.js tự tính lại hasData theo tệp đó, trường này chỉ để tham khảo).
// KHÔNG bịa trường lịch sử nào khác (niên hiệu, vua, đầu khoa… người dùng sẽ cung cấp sau).
// Kiểm tra: can chi tính ra khớp 10 mục của bia.json; stt khớp; năm / stt không trùng; stt đủ 1..82.
//   node tools/v2/catalog.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'models-v2', 'catalog.json');

export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
/** Năm 4 (công nguyên) là Giáp Tý → can = (năm − 4) mod 10, chi = (năm − 4) mod 12. */
export function canChi(year) {
  const k = year - 4;
  return `${CAN[((k % 10) + 10) % 10]} ${CHI[((k % 12) + 12) % 12]}`;
}

const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8')).steles;
// r79: hasData theo dữ liệu văn bia đã trích (cùng quy tắc src/data/index.js), không theo bia.json (chỉ còn 10 bia v1)
const catalogGen = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'catalog.generated.json'), 'utf8')); // chỉ đọc
const known = new Set(Object.keys(catalogGen).filter((k) => !k.startsWith('$')));

const entries = Object.values(sources)
  .map((s) => ({ id: `bia-${s.year}`, stt: s.stt, year: s.year, folder: s.folder, canChi: canChi(s.year), hasData: known.has(`bia-${s.year}`) }))
  .sort((a, b) => a.year - b.year);

const dup = (key) => {
  const m = new Map();
  for (const e of entries) m.set(e[key], [...(m.get(e[key]) ?? []), e.id]);
  return [...m.entries()].filter(([, ids]) => ids.length > 1).map(([k, ids]) => ({ [key]: k, ids }));
};
const checks = {
  canChiVsBiaJson: bia.map((b) => ({ id: b.id, biaJson: b.canChi, computed: canChi(b.year), ok: b.canChi === canChi(b.year) })),
  sttVsBiaJson: bia.map((b) => {
    const e = entries.find((x) => x.id === b.id);
    return { id: b.id, biaJson: b.stt, catalog: e?.stt ?? null, ok: e?.stt === b.stt };
  }),
  duplicateYears: dup('year'),
  duplicateStt: dup('stt'),
  missingStt: Array.from({ length: 82 }, (_, i) => i + 1).filter((n) => !entries.some((e) => e.stt === n)),
  biaJsonNotInCatalog: bia.filter((b) => !entries.some((e) => e.id === b.id)).map((b) => b.id),
};
const ok = checks.canChiVsBiaJson.every((c) => c.ok) && checks.sttVsBiaJson.every((c) => c.ok) &&
  !checks.duplicateYears.length && !checks.duplicateStt.length && !checks.missingStt.length && !checks.biaJsonNotInCatalog.length;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  $comment: 'Sinh bởi tools/v2/catalog.mjs — khung danh mục 82 bia (sắp theo năm). Chỉ trường suy ra chắc chắn; dữ liệu lịch sử (niên hiệu, vua, đầu khoa, mô tả…) do người dùng bổ sung sau. hasData = có mục trong src/data/catalog.generated.json (dữ liệu văn bia).',
  generated: new Date().toISOString(),
  count: entries.length,
  canChiRule: 'năm 4 = Giáp Tý; can = CAN[(năm−4) mod 10], chi = CHI[(năm−4) mod 12]',
  checks: { ok, ...checks },
  steles: entries,
}, null, 1)}\n`);

console.log(`→ ${path.relative(ROOT, OUT)}: ${entries.length} bia (${entries[0].year}–${entries.at(-1).year}), hasData ${entries.filter((e) => e.hasData).length}`);
console.log(`can chi khớp bia.json: ${checks.canChiVsBiaJson.filter((c) => c.ok).length}/${bia.length}` +
  checks.canChiVsBiaJson.filter((c) => !c.ok).map((c) => ` ✗ ${c.id} ${c.biaJson} ≠ ${c.computed}`).join(''));
console.log(`stt khớp bia.json: ${checks.sttVsBiaJson.filter((c) => c.ok).length}/${bia.length} · năm trùng: ${checks.duplicateYears.length} · stt trùng: ${checks.duplicateStt.length} · stt thiếu: ${checks.missingStt.join(',') || 0}`);
if (!ok) process.exit(1);
