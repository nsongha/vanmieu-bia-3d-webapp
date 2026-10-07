#!/usr/bin/env node
// Ghép ảnh chụp từ trang preview (.captures/v2/<shot>__<model>.png) thành bảng so sánh có nhãn → .captures/v2-<tên>.jpg
//
//   node tools/v2/make-sheets.mjs <tên-bảng> <shot>:<model>[=nhãn] … [--cols=4] [--title="…"] [--crop=x,y,w,h]
// Nhãn mặc định lấy từ public/models/v2/<id>/stele.json (tam giác, MB tải, texture, GPU ước lượng); v1 lấy từ
// src/data/models.generated.json (chỉ đọc).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CAP = path.join(ROOT, '.captures', 'v2');
const V2 = path.join(ROOT, 'models-v2');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mb = (b) => (b / 1e6).toFixed(1);

function v1Label(id) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'models.generated.json'), 'utf8'))[id];
    const gpu = (2048 * 2048 * 4 * 4) / 3 / 1e6;
    return [`v1 (WebP 2048, smooth 25°)`, `${Math.round(d.triangles / 1000)}k tris · ${mb(d.bytes)} MB · GPU≈${(gpu + 5).toFixed(0)} MB`];
  } catch {
    return ['v1', ''];
  }
}

function v2Label(id, model) {
  let e;
  try {
    e = JSON.parse(fs.readFileSync(path.join(V2, id, 'stele.json'), 'utf8'));
  } catch {
    return [model, ''];
  }
  const r = model.startsWith('ab/') ? e.ab?.[model.slice(3)] : e.lods?.[model];
  if (!r) return [model, ''];
  const tex = r.textures.map((t) => `${t.role === 'normal' ? 'N' : 'C'}${t.codec === 'etc1s' ? 'e' : ''}${t.w}`).join('+') || 'no tex';
  const name = model.startsWith('ab/') ? model.slice(3).replace(/^lod0-/, 'LOD0 ').replace(/^lod1-/, 'LOD1 ') : model.toUpperCase();
  return [name, `${Math.round(r.tris / 1000)}k tris · ${tex} · ${mb(r.bytes)} MB · GPU≈${mb(r.gpuBytes.total)} MB`];
}

function labelFor(model, id) {
  if (model === 'v1') return v1Label(id);
  if (model === 'v1proxy') return ['v1 proxy', ''];
  return v2Label(id, model);
}

async function main() {
  const args = process.argv.slice(2);
  const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.join('=')];
  }));
  const [sheet, ...cellsArg] = args.filter((a) => !a.startsWith('--'));
  const cols = Number(opts.cols || 4);
  const crop = opts.crop ? opts.crop.split(',').map(Number) : null;
  const cells = [];
  for (const c of cellsArg) {
    const [spec, custom] = c.split('=');
    const [shot, model] = spec.split(':');
    const file = path.join(CAP, `${shot}__${model.replace(/\//g, '_')}.png`);
    if (!fs.existsSync(file)) throw new Error(`thiếu ảnh ${file}`);
    const id = opts.id || (/(?:bia-)?(1[4-7]\d\d)/.exec(shot) ? `bia-${/(?:bia-)?(1[4-7]\d\d)/.exec(shot)[1]}` : '');
    const [l1, l2] = custom ? [custom, labelFor(model, id)[1]] : labelFor(model, id);
    let img = sharp(file);
    if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
    const buf = await img.png().toBuffer();
    const meta = await sharp(buf).metadata();
    cells.push({ buf, w: meta.width, h: meta.height, l1: `${id ? `${id} · ` : ''}${l1}`, l2 });
  }
  const cw = Math.max(...cells.map((c) => c.w));
  const ch = Math.max(...cells.map((c) => c.h));
  const lh = 46;
  const th = opts.title ? 40 : 0;
  const rows = Math.ceil(cells.length / cols);
  const W = cols * cw + (cols + 1) * 6;
  const H = th + rows * (ch + lh) + (rows + 1) * 6;
  const comps = [];
  cells.forEach((c, i) => {
    const x = 6 + (i % cols) * (cw + 6);
    const y = th + 6 + Math.floor(i / cols) * (ch + lh + 6);
    comps.push({ input: c.buf, left: x, top: y });
    const svg = `<svg width="${cw}" height="${lh}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#26282d"/>` +
      `<text x="8" y="19" font-family="Helvetica, Arial" font-size="16" font-weight="bold" fill="#f2f2f2">${esc(c.l1)}</text>` +
      `<text x="8" y="39" font-family="Helvetica, Arial" font-size="14" fill="#b9bcc4">${esc(c.l2)}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y + ch });
  });
  if (opts.title) {
    comps.push({
      input: Buffer.from(`<svg width="${W}" height="${th}" xmlns="http://www.w3.org/2000/svg"><text x="10" y="27" font-family="Helvetica, Arial" font-size="20" font-weight="bold" fill="#f2f2f2">${esc(opts.title)}</text></svg>`),
      left: 0, top: 0,
    });
  }
  const out = path.join(ROOT, '.captures', `v2-${sheet}.jpg`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#141518' } }).composite(comps).jpeg({ quality: 88 }).toFile(out);
  console.log(`→ ${path.relative(ROOT, out)} (${W}×${H})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
