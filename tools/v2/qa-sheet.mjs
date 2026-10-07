#!/usr/bin/env node
// Bảng QA toàn bộ bia v2: ghép ảnh chính diện LOD0 (.captures/v2/qa__bia-XXXX_lod0.png, chụp bằng trang preview với
// m=bia-XXXX/lod0,… view=front) thành một tờ có nhãn STT-năm + cờ, và in danh sách bất thường tự động từ manifest:
//   · bbox: đáy y=0, cao đúng 1; bề ngang / sâu lệch xa trung vị;
//   · mặt trước +Z: nguồn quyết định (texture-contrast / head-protrusion / override) + tỉ lệ tương phản;
//   · đầu rùa dò được không, dấu chân (pedestal) lệch xa trung vị; ngân sách LOD0 bị nâng; texture bị kẹp 2048; bake sẵn.
//   node tools/v2/qa-sheet.mjs [--cols=10] [--out=.captures/v2-qa-all.jpg]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CAP = path.join(ROOT, '.captures', 'v2');
const opts = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const cols = Number(opts.cols || 10);
const out = path.resolve(ROOT, opts.out || '.captures/v2-qa-all.jpg');
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'models-v2', 'manifest.json'), 'utf8'));
const steles = Object.values(man.steles).sort((a, b) => a.stt - b.stt);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// ---- bất thường tự động
const mx = median(steles.map((e) => e.bbox.size[0]));
const mz = median(steles.map((e) => e.bbox.size[2]));
const msw = median(steles.map((e) => e.measure.pedestal.swept));
// Mức: 'err' (bbox sai, thiếu ảnh, không có đầu rùa) → ô đỏ; 'front' (mặt trước quyết định yếu) → ô vàng — phase 2 đã
// soát bằng mắt TẤT CẢ 82 bia (ảnh +Z thấy đầu rùa + mặt chữ; 7 bia sai đã sửa bằng V2_FRONT_OVERRIDE); 'info' → không tô.
const issues = {};
const level = {};
const rank = { info: 0, front: 1, err: 2 };
const add = (id, s, lv = 'info') => {
  (issues[id] ??= []).push(s);
  if (rank[lv] > rank[level[id] ?? 'info']) level[id] = lv;
  else level[id] ??= lv;
};
for (const e of steles) {
  const b = e.bbox;
  if (Math.abs(b.min[1]) > 1e-4 || Math.abs(b.size[1] - 1) > 1e-4) add(e.id, `bbox y ${b.min[1]}..${b.max[1]}`, 'err');
  if (Math.abs(b.size[0] / mx - 1) > 0.25) add(e.id, `rộng ${b.size[0].toFixed(3)} (trung vị ${mx.toFixed(3)})`);
  if (Math.abs(b.size[2] / mz - 1) > 0.25) add(e.id, `sâu ${b.size[2].toFixed(3)} (trung vị ${mz.toFixed(3)})`);
  if (b.size[2] < b.size[0]) add(e.id, `sâu < rộng (${b.size[2].toFixed(3)} < ${b.size[0].toFixed(3)}): trục bia/rùa có thể sai`, 'err');
  const p = e.placement;
  if (p.frontSource === 'override') add(e.id, `mặt trước: sửa tay (FRONT_OVERRIDE ${p.frontOverride})`);
  else if (p.frontSource !== 'texture-contrast') add(e.id, `mặt trước theo ${p.frontSource}${p.textureContrastRatio ? ` (tương phản ${p.textureContrastRatio})` : ''}`, 'front');
  else if (p.textureContrastRatio < 1.5) add(e.id, `mặt trước theo tương phản ${p.textureContrastRatio} (sát ngưỡng 1,25)`, 'front');
  if (!e.measure.head) add(e.id, 'không dò được đầu rùa', 'err');
  else if (e.measure.head.center[2] < 0.2) add(e.id, `đầu rùa z=${e.measure.head.center[2]} (thấp — mặt trước?)`);
  if (Math.abs(e.measure.pedestal.swept / msw - 1) > 0.15) add(e.id, `bán kính quét ${e.measure.pedestal.swept} (trung vị ${msw.toFixed(3)})`);
  if (e.flags.budgetRaised) add(e.id, `LOD0 nâng lên ${e.flags.budgetRaised}`);
  if (e.flags.blenderDecimate) add(e.id, 'giản lược bằng Blender Decimate');
}

// ---- tờ ảnh
const cells = [];
let cw = 0;
let ch = 0;
for (const e of steles) {
  const f = path.join(CAP, `qa__${e.id}_lod0.png`);
  if (!fs.existsSync(f)) {
    add(e.id, 'thiếu ảnh QA', 'err');
    continue;
  }
  const meta = await sharp(f).metadata();
  cw = Math.max(cw, meta.width);
  ch = Math.max(ch, meta.height);
  cells.push({ e, f });
}
const lh = 40;
const rows = Math.ceil(cells.length / cols);
const W = cols * (cw + 4) + 4;
const H = 44 + rows * (ch + lh + 4) + 4;
const comps = [];
cells.forEach(({ e, f }, i) => {
  const x = 4 + (i % cols) * (cw + 4);
  const y = 44 + Math.floor(i / cols) * (ch + lh + 4);
  comps.push({ input: f, left: x, top: y });
  const tags = [
    e.flags.prebaked ? 'bake sẵn' : null,
    e.flags.textureCapped ? 'tex 2048' : null,
    e.flags.budgetRaised ? `${e.flags.budgetRaised / 1000}k` : null,
    e.flags.sourceBelowBudget ? `nguồn ${Math.round(e.source.tris / 1000)}k` : null,
    e.placement.frontSource === 'override' ? 'mặt: override' : e.placement.frontSource === 'texture-contrast' ? null : `mặt: ${e.placement.frontSource}`,
  ].filter(Boolean).join(' · ');
  const fill = { err: '#6a2420', front: '#4d4420' }[level[e.id]] ?? '#26282d';
  const svg = `<svg width="${cw}" height="${lh}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${fill}"/>` +
    `<text x="6" y="17" font-family="Helvetica, Arial" font-size="15" font-weight="bold" fill="#f2f2f2">${e.stt}-${e.year}</text>` +
    `<text x="6" y="34" font-family="Helvetica, Arial" font-size="11.5" fill="#c9ccd3">${esc(tags || `${Math.round(e.lods.lod0.tris / 1000)}k · ${(e.lods.lod0.bytes / 1e6).toFixed(1)} MB`)}</text></svg>`;
  comps.push({ input: Buffer.from(svg), left: x, top: y + ch });
});
comps.push({
  input: Buffer.from(`<svg width="${W}" height="40" xmlns="http://www.w3.org/2000/svg"><text x="8" y="27" font-family="Helvetica, Arial" font-size="21" font-weight="bold" fill="#f2f2f2">v2 LOD0 — ${cells.length} bia, chính diện (camera +Z, key az −35° el 28°). Nhãn vàng = mặt trước quyết định yếu (đã soát bằng mắt: đúng) · đỏ = lỗi</text></svg>`),
  left: 0, top: 0,
});
await sharp({ create: { width: W, height: H, channels: 3, background: '#141518' } }).composite(comps).jpeg({ quality: 84 }).toFile(out);
console.log(`→ ${path.relative(ROOT, out)} (${W}×${H}, ${cells.length} ô)`);
console.log(`\nBất thường (${Object.keys(issues).length} bia):`);
for (const e of steles) if (issues[e.id]) console.log(`  [${level[e.id]}] ${e.stt}-${e.year}: ${issues[e.id].join(' | ')}`);
console.log(`\nlỗi: ${Object.values(level).filter((l) => l === 'err').length} · mặt trước yếu (đã soát): ${Object.values(level).filter((l) => l === 'front').length}`);
