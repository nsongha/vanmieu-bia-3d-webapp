#!/usr/bin/env node
// r78 — gộp lời giới thiệu (AI soạn) từ các tệp { "<năm>": { text: [...], sources: [...], chars? } } vào tools/stele-intros.json,
// có KIỂM TRA trước khi nhận từng mục (mục không đạt thì bỏ, giữ bản đang có nếu có):
//   · năm có trong data/82-van-bia-tien-si.json; text là mảng câu không rỗng
//   · độ dài text.join(' ') ≤ MAX_CHARS (534 = độ dài lời giới thiệu 1442 đang dùng)
//   · MỌI con số trong text (bỏ dấu chấm / phẩy phân cách nghìn: "1.400" = "1400") có mặt trong dữ liệu nguồn của CHÍNH mục đó.
//     Tính là "có mặt" cả: tháng viết bằng chữ trong nguồn ("tháng hai" = 2, "tháng tư" = 4, "tháng chạp" = 12…) và số người
//     đếm từ danh sách laureates của mục (tổng, từng giáp — vd "4 người còn lại đỗ Đệ tam giáp" khi giáp 3 có 4 tên)
//   · MỌI chuỗi trong ngoặc kép (“…”, "…", «…», '…') có NGUYÊN VĂN trong dữ liệu nguồn của mục đó (bỏ dấu câu / "…" ở cuối);
//     trích có lược bỏ ("A... B" / "A … B") thì từng đoạn A, B phải có nguyên văn và đúng thứ tự
// Dữ liệu nguồn của một mục = mọi chuỗi trong mục đó (title, content, historical_notes, biographies, laureates, contributors, số liệu).
// Không sửa chữ của lời giới thiệu; `chars` được tính lại. Kết quả xác định (khóa sắp theo năm).
//
// Chạy: node tools/merge-intros.mjs <intros-A.json> [<intros-B.json> …] [--dry]
//       rồi: node tools/extract-stele-info.mjs --all   (sinh lại stele-info + catalog.mota)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/82-van-bia-tien-si.json');
const OUT = path.join(ROOT, 'tools/stele-intros.json');
const MAX_CHARS = 534;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('dùng: node tools/merge-intros.mjs <intros-*.json> … [--dry]');
  process.exit(2);
}

const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const byYear = new Map(all.map((e) => [String(Number(e.year)), e]));

/** Mọi chuỗi / số trong một mục nguồn, nối lại (NFC). */
function sourceText(e) {
  const out = [];
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(e);
  return out.join('\n').normalize('NFC');
}
const normNum = (s) => s.replace(/[.,](?=\d{3}\b)/g, '');
const numbersOf = (s) => new Set((s.match(/\d+(?:[.,]\d{3})*/g) || []).map(normNum));
const MONTH_WORD = { 'giêng': 1, 'hai': 2, 'ba': 3, 'tư': 4, 'năm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10, 'mười một': 11, 'một': 11, 'mười hai': 12, 'chạp': 12 };
/** Số được phép ngoài chữ số của nguồn: tháng viết bằng chữ, số người đếm từ laureates (tổng / từng giáp). */
function derivedNumbers(e, src) {
  const out = new Set();
  for (const m of src.toLocaleLowerCase('vi').matchAll(/tháng\s+(mười một|mười hai|giêng|chạp|mười|hai|ba|tư|năm|sáu|bảy|tám|chín|một)(?![\p{L}])/gu)) out.add(String(MONTH_WORD[m[1]]));
  const L = e.laureates ?? [];
  out.add(String(L.length));
  for (const t of ['Đệ nhất giáp', 'Đệ nhị giáp', 'Đệ tam giáp']) out.add(String(L.filter((l) => String(l.rank ?? '').startsWith(t)).length));
  return out;
}
const QUOTE_RE = /“([^”]+)”|"([^"]+)"|«([^»]+)»|(?<![\p{L}])'([^']{4,})'(?![\p{L}])/gu;
const squash = (s) => s.replace(/\s+/g, ' ').trim();

function validate(year, entry) {
  const errs = [];
  const e = byYear.get(year);
  if (!e) return [`năm ${year} không có trong dữ liệu`];
  if (!entry || !Array.isArray(entry.text) || !entry.text.length || entry.text.some((t) => typeof t !== 'string' || !t.trim())) return ['text phải là mảng câu không rỗng'];
  const text = entry.text.map((t) => t.normalize('NFC'));
  const joined = text.join(' ');
  if (joined.length > MAX_CHARS) errs.push(`dài ${joined.length} > ${MAX_CHARS} ký tự`);
  const src = sourceText(e);
  const srcNums = new Set([...numbersOf(src), ...derivedNumbers(e, src)]);
  const badNums = [...numbersOf(joined)].filter((n) => !srcNums.has(n));
  if (badNums.length) errs.push(`số không có trong nguồn: ${badNums.join(', ')}`);
  const srcSq = squash(src);
  for (const m of joined.matchAll(QUOTE_RE)) {
    const q = squash(m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/[\s.,;:!?…]+$/u, '');
    // trích có lược bỏ: từng đoạn phải có nguyên văn, đúng thứ tự
    const parts = q.split(/\s*(?:\.\.\.|…)\s*/u).map((x) => x.replace(/^[\s.,;:]+|[\s.,;:!?]+$/gu, '')).filter(Boolean);
    let at = 0;
    const ok = parts.every((x) => {
      const i = srcSq.indexOf(x, at);
      if (i < 0) return false;
      at = i + x.length;
      return true;
    });
    if (q && !ok) errs.push(`trích dẫn không có nguyên văn trong nguồn: “${q.slice(0, 80)}${q.length > 80 ? '…' : ''}”`);
  }
  return errs;
}

const cur = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const merged = { ...cur };
const report = { ok: [], rejected: [], replaced: [] };
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(data)) {
    if (!/^\d{4}$/.test(k)) continue;
    const errs = validate(k, v);
    if (errs.length) {
      report.rejected.push({ year: Number(k), file: path.basename(f), errs });
      continue;
    }
    const text = v.text.map((t) => t.normalize('NFC'));
    if (merged[k] && JSON.stringify(merged[k].text) !== JSON.stringify(text)) report.replaced.push(Number(k));
    merged[k] = { text, sources: v.sources ?? [], chars: text.join(' ').length };
    report.ok.push(Number(k));
  }
}
// Kiểm tra lại cả các mục đang có (vd 1442) — chỉ báo, không bỏ
const existingBad = Object.entries(cur).filter(([k]) => /^\d{4}$/.test(k) && !report.ok.includes(Number(k))).map(([k, v]) => ({ year: Number(k), errs: validate(k, v) })).filter((x) => x.errs.length);

const out = {};
if (merged.$comment) out.$comment = merged.$comment;
for (const k of Object.keys(merged).filter((x) => /^\d{4}$/.test(x)).sort((a, b) => a - b)) {
  const v = merged[k];
  out[k] = { text: v.text, sources: v.sources ?? [], chars: v.text.join(' ').length };
}
if (!DRY) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');

const missing = [...byYear.keys()].filter((y) => !out[y]).map(Number);
console.log(`${DRY ? '[dry] ' : ''}nhận ${report.ok.length} mục · bỏ ${report.rejected.length} · thay bản cũ ${report.replaced.length} · tổng ${Object.keys(out).filter((k) => /^\d{4}$/.test(k)).length}/${byYear.size} bia có lời giới thiệu`);
for (const r of report.rejected) console.log(`  ✗ ${r.year} (${r.file}): ${r.errs.join(' | ')}`);
for (const r of existingBad) console.log(`  ! mục đang có ${r.year}: ${r.errs.join(' | ')}`);
if (missing.length) console.log(`  thiếu: ${missing.join(', ')}`);
if (report.rejected.length) process.exitCode = 1;
