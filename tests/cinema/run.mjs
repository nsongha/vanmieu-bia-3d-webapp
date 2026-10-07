// Chạy bộ kiểm thử Điện ảnh: mọi tests/cinema/*.test.mjs lần lượt (một Chrome mỗi tệp), gom kết quả.
//   npm run test:cinema -- --port 5180            (máy chủ dev đang chạy: npm run dev)
//   npm run test:cinema -- --port 5180 --only glide,rub-camera
//   npm run test:cinema -- --port 5180 --headed   (xem trình duyệt chạy)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/browser.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const args = parseArgs();
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .filter((f) => !args.only || args.only.has(f.replace('.test.mjs', '')))
  .sort();
if (!files.length) {
  console.error('Không có tệp kiểm thử nào khớp', args.only ? [...args.only].join(',') : '');
  process.exit(2);
}

// máy chủ có đang chạy không
try {
  const r = await fetch(`http://localhost:${args.port}/`);
  if (!r.ok) throw new Error(String(r.status));
} catch (e) {
  console.error(`Không kết nối được http://localhost:${args.port}/ — chạy "npm run dev" (hoặc truyền --port đúng cổng) trước.`);
  process.exit(2);
}

const results = [];
const t0 = Date.now();
for (const f of files) {
  const name = f.replace('.test.mjs', '');
  console.log(`\n==================== ${name} ====================`);
  const started = Date.now();
  const res = await new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(DIR, f), '--port', String(args.port), ...(args.headed ? ['--headed'] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
    let last = null;
    const onLine = (line) => {
      if (line.startsWith('@@RESULT ')) {
        try {
          last = JSON.parse(line.slice(9));
        } catch {}
      } else if (!/Failed to load resource: .* 404/.test(line)) console.log(line);
    };
    let buf = '';
    p.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        onLine(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    p.stderr.on('data', (d) => {
      const s = String(d);
      if (!/Failed to load resource: .* 404/.test(s)) process.stderr.write(s);
    });
    p.on('close', (code) => resolve({ code, last }));
  });
  const secs = Math.round((Date.now() - started) / 1000);
  results.push({ name, secs, code: res.code, ...(res.last ?? { pass: 0, fail: 1, failed: [`không có @@RESULT (mã thoát ${res.code})`] }) });
}

console.log('\n==================== TỔNG KẾT ====================');
let bad = 0;
for (const r of results) {
  const ok = !r.fail && r.code === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(18)} ${String(r.pass).padStart(3)} đạt${r.fail ? ` · ${r.fail} không đạt` : ''}  (${r.secs} s)`);
  for (const f of r.failed ?? []) console.log(`        ✗ ${f}`);
}
console.log(`\n${results.length - bad}/${results.length} tệp đạt · ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(bad ? 1 : 0);
