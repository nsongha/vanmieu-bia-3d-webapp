// Model pipeline v2 — chạy tiến trình con (Blender, basisu) với độ ưu tiên thấp (nice -n 10), ghi log.

import { spawn } from 'node:child_process';

export const BLENDER_BIN = process.env.BLENDER_BIN || '/Applications/Blender.app/Contents/MacOS/Blender';
export const BASISU_BIN = process.env.BASISU_BIN || 'basisu';
export const NICE = Number(process.env.V2_NICE ?? 10);

/**
 * Chạy `cmd args` dưới `nice -n NICE`. Trả { code, stdout, stderr, ms }. Ném lỗi nếu mã thoát ≠ 0.
 * @param {(line:string)=>void} [onLine] nhận từng dòng stdout/stderr (để ghi log)
 */
export function run(cmd, args, { onLine, timeoutMs = 60 * 60 * 1000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const child = spawn('nice', ['-n', String(NICE), cmd, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let pending = '';
    const feed = (chunk, isErr) => {
      const s = chunk.toString();
      if (isErr) stderr += s;
      else stdout += s;
      if (!onLine) return;
      pending += s;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const l of lines) if (l.trim()) onLine(l);
    };
    child.stdout.on('data', (c) => feed(c, false));
    child.stderr.on('data', (c) => feed(c, true));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (onLine && pending.trim()) onLine(pending);
      const r = { code, stdout, stderr, ms: Date.now() - t0 };
      if (code !== 0) {
        const tail = (stderr || stdout).split('\n').slice(-15).join('\n');
        reject(Object.assign(new Error(`${cmd} thoát mã ${code}\n${tail}`), r));
      } else resolve(r);
    });
  });
}

/**
 * Mã hoá PNG → KTX2 UASTC LDR 4×4 + Zstandard (mipmap đầy đủ).
 * @param {'color'|'normal'} kind color: sRGB; normal: -normal_map (tuyến tính, không RDO selector, mip tuyến tính) +
 *   -mip_renorm (chuẩn hoá lại vectơ sau khi lọc mip). Giữ 3 kênh RGB (glTF normalTexture đọc XYZ) — KHÔNG dùng
 *   -separate_rg_to_color_alpha vì three.js / glTF không tự dựng lại Z từ 2 kênh.
 * @param {{ rdo?: number, level?: number, zstd?: number, threads?: number, deterministic?: boolean }} o
 */
export async function encodeKtx2(inPng, outKtx2, kind, o = {}, onLine) {
  const args = ['-uastc', '-uastc_level', String(o.level ?? 2), '-ktx2', '-mipmap', '-ktx2_zstandard_level', String(o.zstd ?? 18)];
  if (kind === 'normal') args.push('-normal_map', '-mip_renorm', ...(o.renorm ? ['-renorm'] : []));
  else args.push('-srgb');
  if (o.rdo && o.rdo > 0) {
    args.push('-uastc_rdo_l', String(o.rdo));
    if (o.deterministic !== false) args.push('-uastc_rdo_m');
  }
  if (o.threads) args.push('-max_threads', String(o.threads));
  if (o.stats) args.push('-stats');
  args.push('-output_file', outKtx2, inPng);
  const r = await run(BASISU_BIN, args, { onLine });
  const psnr = [...r.stdout.matchAll(/RGB(?:A)?\s+Avg:.*?PSNR:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  return { ms: r.ms, psnr: psnr.length ? psnr[0] : null, stdout: r.stdout };
}
