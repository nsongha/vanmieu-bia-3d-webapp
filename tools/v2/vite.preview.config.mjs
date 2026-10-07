// Vite RIÊNG cho trang so sánh v1 / v2 (cổng 5390) — không đụng dev server chính (:5180).
//   npx vite --config tools/v2/vite.preview.config.mjs
// Gốc = tools/v2/preview; /models/** = public/models (v1), /models/v2/** = models-v2/ (v2, ngoài public/), không cache.
// Transcoder Basis tự host: /basis/* đọc thẳng từ node_modules/three/examples/jsm/libs/basis (chạy offline).
// Chụp ảnh: POST /__capture?name=<tên> (body = data URL) → .captures/v2/<tên>.png|jpg.

import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASIS_DIR = path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const CAPTURE_DIR = path.join(ROOT, '.captures', 'v2');
const MODELS_DIR = path.join(ROOT, 'public', 'models');
const V2_DIR = path.join(ROOT, 'models-v2'); // đầu ra v2 NGOÀI public/ (vite build không chép vào dist/)
const TYPES = { '.glb': 'model/gltf-binary', '.json': 'application/json', '.ktx2': 'image/ktx2' };

function v2PreviewPlugin() {
  return {
    name: 'vm-v2-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/basis', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        const file = path.join(BASIS_DIR, name);
        if (!name || name.includes('..') || !existsSync(file)) return next();
        res.setHeader('content-type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.setHeader('content-length', statSync(file).size);
        createReadStream(file).pipe(res);
      });
      // /models/** đọc thẳng từ public/models (v1), /models/v2/** từ models-v2/ (không qua publicDir của Vite).
      server.middlewares.use('/models', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        const file = name.startsWith('v2/') ? path.join(V2_DIR, name.slice(3)) : path.join(MODELS_DIR, name);
        if (!name || name.includes('..') || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.setHeader('content-length', statSync(file).size);
        res.setHeader('cache-control', 'no-store');
        if (req.method === 'HEAD') return res.end();
        createReadStream(file).pipe(res);
      });
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        const url = new URL(req.url, 'http://x');
        const name = (url.searchParams.get('name') || 'capture').replace(/[^a-z0-9_.-]/gi, '_');
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          const m = /^data:image\/(png|jpeg);base64,(.+)$/s.exec(body);
          if (!m) {
            res.statusCode = 400;
            return res.end('bad data url');
          }
          mkdirSync(CAPTURE_DIR, { recursive: true });
          const file = path.join(CAPTURE_DIR, `${name}.${m[1] === 'png' ? 'png' : 'jpg'}`);
          writeFileSync(file, Buffer.from(m[2], 'base64'));
          res.setHeader('content-type', 'text/plain');
          res.end(file);
        });
      });
    },
  };
}

export default defineConfig({
  root: path.join(__dirname, 'preview'),
  publicDir: false,
  cacheDir: path.join(ROOT, 'node_modules', '.vite-v2-preview'),
  server: {
    port: 5390,
    strictPort: true,
    host: '127.0.0.1',
    fs: { allow: [ROOT] },
    // không theo dõi tệp mô hình lớn / đệm
    watch: { ignored: ['**/public/models/**', '**/models-v2/**', '**/.captures/**', '**/node_modules/**'] },
  },
  plugins: [v2PreviewPlugin()],
});
