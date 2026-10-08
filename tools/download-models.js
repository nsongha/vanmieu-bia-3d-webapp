import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const BASE_URL = 'https://pub-bcf6c209410d41c09a90010a4d615f88.r2.dev/models-v2/';
const TARGET_DIR = path.resolve(process.cwd(), 'models-v2');

// Read the files list generated from the master copy
const filesListUrl = new URL('./models-files.json', import.meta.url);
const files = JSON.parse(fs.readFileSync(filesListUrl, 'utf-8'));

async function downloadFile(file) {
  const fileUrl = BASE_URL + file.split('/').map(encodeURIComponent).join('/');
  const destPath = path.join(TARGET_DIR, file);
  
  if (fs.existsSync(destPath)) {
    // Skip if already exists to allow resuming
    return;
  }
  
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  
  const destStream = fs.createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), destStream);
}

async function main() {
  console.log(`Downloading ${files.length} files to models-v2/ ...`);
  const concurrency = 15;
  let active = 0;
  let index = 0;
  let downloaded = 0;
  let skipped = 0;
  
  return new Promise((resolve, reject) => {
    function next() {
      if (index >= files.length && active === 0) return resolve();
      while (active < concurrency && index < files.length) {
        const file = files[index++];
        active++;
        downloadFile(file).then(() => {
          if (fs.existsSync(path.join(TARGET_DIR, file))) {
            downloaded++;
          }
          if ((downloaded + skipped) % 50 === 0) {
            console.log(`Progress: ${downloaded + skipped}/${files.length}...`);
          }
          active--;
          next();
        }).catch(err => {
          console.error(`Error downloading ${file}:`, err.message);
          active--;
          next();
        });
      }
    }
    next();
  });
}

main().then(() => console.log('Download complete!')).catch(err => console.error(err));
