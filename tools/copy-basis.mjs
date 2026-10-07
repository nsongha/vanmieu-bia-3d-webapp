#!/usr/bin/env node
// Tự phục vụ transcoder Basis Universal của three.js (KTX2Loader cần để giải KTX2 UASTC / ETC1S của mô hình v2):
//   node_modules/three/examples/jsm/libs/basis/{basis_transcoder.js, basis_transcoder.wasm} → public/basis/
// Luôn khớp phiên bản three đang cài (chép lại mỗi lần chạy). App đặt ktx2Loader.setTranscoderPath('basis/') —
// chạy offline (kiosk 24/7), không phụ thuộc CDN. Chạy tự động sau `npm install` (postinstall, sau copy-mediapipe).
// public/basis/ nằm trong .gitignore: không commit, chỉ đi theo bản dựng (Vite chép public/ vào dist/).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/three/examples/jsm/libs/basis');
const DST = resolve(ROOT, 'public/basis');
const FILES = ['basis_transcoder.js', 'basis_transcoder.wasm'];

if (!existsSync(SRC)) {
  // postinstall không được làm hỏng `npm install`
  console.warn('[copy-basis] bỏ qua: không thấy', SRC);
} else {
  rmSync(DST, { recursive: true, force: true });
  mkdirSync(DST, { recursive: true });
  for (const f of FILES) cpSync(resolve(SRC, f), resolve(DST, f));
  const bytes = readdirSync(DST).reduce((n, f) => n + statSync(resolve(DST, f)).size, 0);
  console.log(`[copy-basis] ${FILES.length} tệp · ${(bytes / 1048576).toFixed(1)} MB → public/basis`);
}
