#!/usr/bin/env node
// Renders public/thumbs/<id>.webp (800x1000 portrait, transparent) for each model,
// via Blender background mode (tools/render-thumb.py) + sharp for PNG -> WebP.
//
// Usage:
//   node tools/render-thumbs.mjs                 # all models, using cached intermediates
//   node tools/render-thumbs.mjs bia-1661         # just one
//
// Normally invoked from tools/prepare-models.mjs (which passes the intermediate GLB
// paths it just wrote). Run standalone to re-render a thumbnail after tweaking an
// azimuth/elevation override below, reusing the intermediate GLB already sitting in
// the scratch dir from a previous prepare-models run.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BLENDER_BIN = '/Applications/Blender.app/Contents/MacOS/Blender';
const RENDER_SCRIPT = path.join(__dirname, 'render-thumb.py');
const THUMBS_DIR = path.join(PROJECT_ROOT, 'public', 'thumbs');
const SCRATCH_DIR = process.env.PIPELINE_SCRATCH_DIR || path.join(os.tmpdir(), 'vanmieu-bia-3d-pipeline');

const DEFAULT_AZIMUTH = 30;
const DEFAULT_ELEVATION = 15;

// No more per-model azimuth overrides: prepare-models.mjs's bake step now rotates
// every model's geometry itself (slab thin-axis -> Z, inscribed front -> +Z), so a
// single camera setting works for all 10. azimuth 0 = camera on +Z looking at -Z
// (straight at the front face); positive azimuth moves the camera toward +X.
function overrideFor(_id) {
  return { azimuth: DEFAULT_AZIMUTH, elevation: DEFAULT_ELEVATION };
}

async function renderOne(id, intermediatePath, { log = console.log } = {}) {
  if (!fs.existsSync(intermediatePath)) {
    throw new Error(`[${id}] intermediate GLB not found at ${intermediatePath} (run prepare-models.mjs first)`);
  }
  const { azimuth, elevation } = overrideFor(id);
  const pngPath = path.join(SCRATCH_DIR, `${id}-thumb.png`);

  const args = [
    '--background',
    '--python',
    RENDER_SCRIPT,
    '--',
    intermediatePath,
    pngPath,
    String(azimuth),
    String(elevation),
  ];

  const t0 = Date.now();
  try {
    await execFileAsync(BLENDER_BIN, args, { maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  } catch (err) {
    log(`  ! [${id}] Blender render failed: ${err.message}`);
    throw err;
  }

  await fsp.mkdir(THUMBS_DIR, { recursive: true });
  const webpPath = path.join(THUMBS_DIR, `${id}.webp`);
  await sharp(pngPath).webp({ quality: 85 }).toFile(webpPath);

  const seconds = (Date.now() - t0) / 1000;
  log(`  [${id}] thumb rendered (azimuth=${azimuth}, elevation=${elevation}) in ${seconds.toFixed(1)}s -> ${webpPath}`);
  return { id, webpPath, pngPath, azimuth, elevation };
}

async function renderThumbs(models, opts = {}) {
  console.log('\n=== render-thumbs ===');
  const results = [];
  for (const { id, intermediatePath } of models) {
    // eslint-disable-next-line no-await-in-loop
    const r = await renderOne(id, intermediatePath ?? path.join(SCRATCH_DIR, `${id}.glb`), opts);
    results.push(r);
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const { MODELS } = await import('./prepare-models.mjs').catch(() => ({ MODELS: null }));
  const ids = args.length ? args : (MODELS ? Object.keys(MODELS) : []);
  if (!ids.length) {
    console.error('No model ids given and could not load MODELS from prepare-models.mjs. Usage: node tools/render-thumbs.mjs [id...]');
    process.exit(1);
  }
  const models = ids.map((id) => ({ id, intermediatePath: path.join(SCRATCH_DIR, `${id}.glb`) }));
  await renderThumbs(models);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { renderThumbs, SCRATCH_DIR };
