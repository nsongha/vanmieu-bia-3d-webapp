import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync, createReadStream, statSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

/**
 * Dev-only: POST /__capture?name=xxx với body = data URL (image/png|jpeg)
 * → ghi file .captures/xxx.png. Dùng để kiểm tra hình ảnh tự động (xem src/core/renderer.js: capture()).
 */
function captureEndpoint() {
  return {
    name: 'vm-capture-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        const url = new URL(req.url, 'http://x');
        const name = (url.searchParams.get('name') || 'capture').replace(/[^a-z0-9_-]/gi, '_');
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          const m = /^data:image\/(png|jpeg);base64,(.+)$/s.exec(body);
          if (!m) { res.statusCode = 400; return res.end('bad data url'); }
          const dir = resolve(process.cwd(), '.captures');
          mkdirSync(dir, { recursive: true });
          const file = resolve(dir, `${name}.${m[1] === 'png' ? 'png' : 'jpg'}`);
          writeFileSync(file, Buffer.from(m[2], 'base64'));
          res.setHeader('content-type', 'text/plain');
          res.end(file);
        });
      });
    },
  };
}

/**
 * Dev-only: phục vụ clip kiểm thử cử chỉ ở /test/<tên> từ thư mục `test-clips/` (NGOÀI public/,
 * để không bị copy vào bản build). Hỗ trợ Range để <video> tua/loop được.
 */
function testClips() {
  return {
    name: 'vm-test-clips',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/test', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        if (!name || name.includes('..')) return next();
        const file = resolve(process.cwd(), 'test-clips', name);
        if (!existsSync(file)) return next();
        const size = statSync(file).size;
        const type = extname(file) === '.webm' ? 'video/webm' : 'video/mp4';
        const range = req.headers.range;
        if (range) {
          const m = /bytes=(\d*)-(\d*)/.exec(range);
          const start = m && m[1] ? parseInt(m[1], 10) : 0;
          const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
          res.writeHead(206, {
            'content-type': type,
            'content-range': `bytes ${start}-${end}/${size}`,
            'accept-ranges': 'bytes',
            'content-length': end - start + 1,
          });
          return createReadStream(file, { start, end }).pipe(res);
        }
        res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
        return createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * r21 — mô hình v2 (82 bia, LOD0/1/2 + KTX2) ở `models-v2/` (gốc repo, NGOÀI public/ → `vite build` không chép vào
 * dist/). Dev + preview: phục vụ /models-v2/** thẳng từ thư mục đó — MIME đúng, Range (tải dở / huỷ), ETag +
 * Last-Modified + Cache-Control. App đọc từ import.meta.env.VITE_MODELS_BASE (mặc định 'models-v2/'); thiếu thư mục
 * (bản clone mới) → catalog.json 404 → app tự lùi về 10 bia v1 trong public/models.
 */
const MODEL_TYPES = { '.glb': 'model/gltf-binary', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.png': 'image/png', '.jpg': 'image/jpeg' };
function modelsV2() {
  const dir = resolve(process.cwd(), 'models-v2');
  const handler = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
    if (!rel || rel.includes('..')) return next();
    const file = resolve(dir, rel);
    if (!file.startsWith(dir + '/') || !existsSync(file)) {
      res.statusCode = 404;
      return res.end();
    }
    const st = statSync(file);
    if (!st.isFile()) return next();
    const size = st.size;
    const etag = `W/"${size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const common = {
      'content-type': MODEL_TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'accept-ranges': 'bytes',
      etag,
      'last-modified': st.mtime.toUTCString(),
      // json (danh mục) đổi khi dựng lại → hỏi lại; glb / ảnh gần như bất biến → giữ 1 ngày, vẫn xác thực bằng ETag
      'cache-control': extname(file) === '.json' ? 'no-cache' : 'public, max-age=86400',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, common);
      return res.end();
    }
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? Math.min(size - 1, parseInt(m[2], 10)) : size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { 'content-range': `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, { ...common, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...common, 'content-length': size });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  };
  return {
    name: 'vm-models-v2',
    configureServer(server) {
      server.middlewares.use('/models-v2', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/models-v2', handler);
    },
  };
}

export default defineConfig({
  base: './',
  server: { port: 5180, host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  plugins: [captureEndpoint(), testClips(), modelsV2()],
});
