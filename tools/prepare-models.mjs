#!/usr/bin/env node
// Prepares the 10 sample stele (bia tien si) GLB scans for the web viewer:
// dedup/prune/weld -> simplify to a triangle budget -> bake placement (centered,
// standing on y=0, 1 unit tall) -> write an uncompressed intermediate (for Blender
// thumbnails) -> compress textures to WebP, quantize, meshopt-encode -> write the
// final public/models/<id>.glb, and collect stats into src/data/models.generated.json.
//
// Usage:
//   node tools/prepare-models.mjs                # process all 10 models
//   node tools/prepare-models.mjs bia-1661        # process just one
//   node tools/prepare-models.mjs bia-1661 bia-1680
//
// After the model files are written, also renders thumbnails (tools/render-thumbs.mjs)
// unless SKIP_THUMBS=1 is set in the environment.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  weld,
  simplify,
  textureCompress,
  quantize,
  meshopt,
  transformMesh,
  getBounds,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { smoothGlbFile } from './smooth-normals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const SOURCE_DIR =
  '/Users/songha/Documents/Projects/2.3. Xây dựng nội dung số 3D Cấp độ 3 (82 bia)';

const MODELS_DIR = path.join(PROJECT_ROOT, 'public', 'models');
const DATA_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'models.generated.json');

// Where uncompressed intermediates (for Blender thumbnail rendering) are written.
// Override with PIPELINE_SCRATCH_DIR for a specific run; defaults to the OS temp dir
// so the script works standalone on any machine.
const SCRATCH_DIR = process.env.PIPELINE_SCRATCH_DIR || path.join(os.tmpdir(), 'vanmieu-bia-3d-pipeline');

const execFileAsync = promisify(execFile);
const BLENDER_BIN = '/Applications/Blender.app/Contents/MacOS/Blender';
const PREDECIMATE_SCRIPT = path.join(__dirname, 'predecimate.py');

const TRIANGLE_BUDGET = 350_000;
const SIMPLIFY_ERROR = 0.001;

// id -> source path, relative to SOURCE_DIR. bia-1661 is listed first: it's the
// smallest model (11.5 MB) and is meant to be processed first so other agents/tools
// can start testing against it while the rest of the batch runs.
const MODELS = {
  'bia-1661': '11-1661/11-1661.glb',
  // "1442 final/.../01.glb" is a crude blocky model (31k tris, no surface
  // detail); "bia 2.1 (1442)/2.glb" is a proper baked low-poly (71k tris) with
  // both a baseColor and a normalTexture (material "Default.005") -- much
  // closer in quality to the other 9 scans.
  'bia-1442': '81-1442/bia 2.1 (1442)/2.glb',
  'bia-1463': '33-1463/33.glb',
  'bia-1487': '17-1487/17.glb',
  'bia-1514': '35-1514/NEW/35.glb',
  'bia-1554': '5-1554/NEW/5.glb',
  'bia-1604': '10-1604/10-1604.glb',
  'bia-1680': '16-1680/new/16.glb',
  'bia-1727': '30-1727/30-1727.glb',
  'bia-1779': '52-1779/52.glb',
};

// Per-model overrides for the simplify() error threshold. The default (0.001) can
// stop simplification far short of the triangle budget on very high-detail scans,
// since MeshoptSimplifier quits early once the error bound is hit rather than
// pushing on to the target ratio. bia-1463 (1.08M source triangles) needed this:
// with the default error it only reduced to ~1.05M tris (17.65 MB final). Loosen
// per id here rather than globally, since a looser bound trades visual fidelity
// for file size.
const SIMPLIFY_OVERRIDES = {
  // Superseded by PRE_DECIMATE below: with the Blender pre-decimate step, the
  // mesh handed to gltf-transform is already under the triangle budget, so
  // simplify() doesn't run at all for bia-1463 and this override is unused. Left
  // here (harmless) in case PRE_DECIMATE for this id is ever removed again --
  // error 0.005 and even 0.01 changed nothing on the raw scan (see below).
  'bia-1463': { error: 0.01 },
};

// Per-model Blender pre-decimation, run before the normal gltf-transform pipeline.
// meshoptimizer's simplify() operates on exact glTF vertex topology, where every
// UV/normal seam is a split vertex; on a mesh split almost everywhere (bia-1463:
// 2.1M welded vertices for 1.08M triangles) it can barely find a valid interior
// edge to collapse no matter the error budget (verified: error 0.005 through 0.4
// all produced the same ~1.05M triangles). Blender's Decimate modifier (COLLAPSE)
// instead collapses edges on the underlying mesh connectivity, which isn't split
// by UV seams, so it can actually reach a useful triangle count. The ratio is a
// fraction of the pre-decimate triangle count to keep; add more ids here as needed.
const PRE_DECIMATE = {
  'bia-1463': 0.32,
};

async function runPredecimate(id, srcPath, ratio, log) {
  const outPath = path.join(SCRATCH_DIR, `${id}-predecimate.glb`);
  await fsp.mkdir(SCRATCH_DIR, { recursive: true });
  log(`  pre-decimating with Blender (ratio=${ratio})...`);
  const t0 = Date.now();
  const { stdout } = await execFileAsync(
    BLENDER_BIN,
    ['--background', '--python', PREDECIMATE_SCRIPT, '--', srcPath, outPath, String(ratio)],
    { maxBuffer: 64 * 1024 * 1024, timeout: 300_000 },
  );
  const summaryLine = stdout.split('\n').find((l) => l.includes('[predecimate]'));
  log(`  ${summaryLine ?? '(no summary line found in Blender output)'} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return outPath;
}

// -----------------------------------------------------------------------------
// mat4 helpers (column-major, glTF/OpenGL convention: v' = M * v)
// -----------------------------------------------------------------------------

function mat4Identity() {
  // eslint-disable-next-line prettier/prettier
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function mat4Multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

/** v' = s * (v - (cx, cy, cz)) */
function mat4FromCenterScale(cx, cy, cz, s) {
  // eslint-disable-next-line prettier/prettier
  return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -s * cx, -s * cy, -s * cz, 1];
}

// -----------------------------------------------------------------------------
// glTF-Transform IO
// -----------------------------------------------------------------------------

async function createIO() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    });
}

function countGeometry(doc) {
  let triangles = 0;
  let vertices = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      const vertCount = position ? position.getCount() : 0;
      vertices += vertCount;
      triangles += indices ? Math.round(indices.getCount() / 3) : Math.round(vertCount / 3);
    }
  }
  return { triangles, vertices };
}

// -----------------------------------------------------------------------------
// bia-1727 special case: two meshes ("30-1727" / "30-1727.001") with identical
// vertex counts (953,574 each) -- likely a duplicated object baked twice with
// different materials/textures. Verify by sampling positions; if identical, keep
// only the mesh using the JPEG-textured material "30-1727" and drop the other.
// -----------------------------------------------------------------------------

async function handleDuplicateGeometry(doc, id, log) {
  if (id !== 'bia-1727') return;

  const meshes = doc.getRoot().listMeshes();
  const meshA = meshes.find((m) => m.getName() === '30-1727');
  const meshB = meshes.find((m) => m.getName() === '30-1727.001');
  if (!meshA || !meshB) {
    log(`  ! bia-1727: expected meshes "30-1727" / "30-1727.001" not found (have: ${meshes.map((m) => m.getName()).join(', ')}) -- skipping dedup check`);
    return;
  }

  const primA = meshA.listPrimitives()[0];
  const primB = meshB.listPrimitives()[0];
  const posA = primA?.getAttribute('POSITION');
  const posB = primB?.getAttribute('POSITION');

  let identical = false;
  if (posA && posB && posA.getCount() === posB.getCount()) {
    const n = posA.getCount();
    const samples = 1000;
    let maxDiff = 0;
    const va = [0, 0, 0];
    const vb = [0, 0, 0];
    for (let s = 0; s < samples; s++) {
      const i = Math.floor((s * n) / samples);
      posA.getElement(i, va);
      posB.getElement(i, vb);
      const d = Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]);
      if (d > maxDiff) maxDiff = d;
    }
    identical = maxDiff < 1e-5;
    log(
      `  bia-1727: "${meshA.getName()}" and "${meshB.getName()}" both have ${n} vertices; sampled ${samples} positions, max delta = ${maxDiff.toExponential(3)} -> ${identical ? 'IDENTICAL geometry (duplicated object)' : 'DIFFERENT geometry'}`,
    );
  } else {
    log(
      `  bia-1727: vertex counts differ (${posA?.getCount() ?? 'n/a'} vs ${posB?.getCount() ?? 'n/a'}) -- treating as different geometry`,
    );
  }

  const baseColorMime = (mesh) => {
    const mat = mesh.listPrimitives()[0]?.getMaterial();
    const tex = mat?.getBaseColorTexture();
    return tex ? tex.getMimeType() : null;
  };

  if (!identical) {
    log('  bia-1727: keeping both meshes (geometries are not duplicates).');
    return;
  }

  const mimeA = baseColorMime(meshA);
  const mimeB = baseColorMime(meshB);
  const keepA = mimeA === 'image/jpeg';
  const keepMesh = keepA ? meshA : meshB;
  const dropMesh = keepA ? meshB : meshA;
  const keepMat = keepMesh.listPrimitives()[0]?.getMaterial();

  log(
    `  bia-1727: dropping duplicate mesh "${dropMesh.getName()}" (material "${dropMesh.listPrimitives()[0]?.getMaterial()?.getName()}", texture ${keepA ? mimeB : mimeA}); keeping "${keepMesh.getName()}" (material "${keepMat?.getName()}", texture ${keepA ? mimeA : mimeB})`,
  );

  for (const node of doc.getRoot().listNodes()) {
    if (node.getMesh() === dropMesh) node.dispose();
  }
  dropMesh.dispose();

  // Clean up the now-orphaned material/texture from the dropped mesh before weld().
  await doc.transform(prune());
}

// -----------------------------------------------------------------------------
// Bake node transforms into vertex data, then normalize: center X/Z at 0,
// min Y at 0, uniform scale so the Y extent (height) = 1.0. Final node
// transforms are identity.
//
// The 10 source files are not consistently oriented (the slab's thin axis is
// +/-Z for most, but +/-X for bia-1604/1661/1727, and the inscribed "front"
// face can point either way), so after the center+scale bake we also bake a
// Y-axis rotation: align the slab's thin axis to Z, then orient so the front
// (the face the turtle's head points toward) faces +Z. This runs entirely on
// the already-baked (node-transform-identity) mesh data, still before the
// intermediate GLB is written.
// -----------------------------------------------------------------------------

function mat4RotateY(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // v' = M*v: x' = x*cos + z*sin, y' = y, z' = -x*sin + z*cos
  // eslint-disable-next-line prettier/prettier
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

/** Bakes `matrix` into every distinct mesh reachable from `scene` (node transforms
 * are assumed already identity, so this is just "apply once per unique mesh"). */
function bakeMeshMatrix(scene, matrix) {
  const seen = new Set();
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh || seen.has(mesh)) return;
    seen.add(mesh);
    transformMesh(mesh, matrix);
  });
}

/** Collects [x,y,z] positions (post-bake, i.e. already in final normalized space)
 * from every primitive in the scene whose y satisfies `yPredicate`. */
function collectPositions(scene, yPredicate) {
  const pts = [];
  const v = [0, 0, 0];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const n = pos.getCount();
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v);
        if (yPredicate(v[1])) pts.push([v[0], v[1], v[2]]);
      }
    }
  });
  return pts;
}

const STELE_BAND = [0.45, 0.8]; // y range treated as "the slab" for axis/front detection
const TURTLE_BAND_MAX_Y = 0.22; // y range treated as "the turtle base"
const SLAB_EIGENVALUE_RATIO_MIN = 2; // below this, the xz cross-section isn't slab-like

/** Eigen-decomposition of the symmetric 2x2 matrix [[a,b],[b,c]]. Returns
 * eigenvalues l1 >= l2 and their (unit) eigenvectors as [x,z] pairs. */
function eigenSym2x2(a, b, c) {
  const tr = a + c;
  const det = a * c - b * b;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  function eigenvector(lambda) {
    // (a - lambda) x + b z = 0  =>  v proportional to (b, lambda - a)
    let x, z;
    if (Math.abs(b) > 1e-12) {
      x = b;
      z = lambda - a;
    } else {
      // Already diagonal: pick the axis whose diagonal entry equals this eigenvalue.
      [x, z] = Math.abs(a - lambda) <= Math.abs(c - lambda) ? [1, 0] : [0, 1];
    }
    const len = Math.hypot(x, z) || 1;
    return [x / len, z / len];
  }
  return { l1, l2, v1: eigenvector(l1), v2: eigenvector(l2) };
}

/** Step 1: find the rotation (radians, about Y) that aligns the stele band's
 * thin (least-variance) axis to +Z. Returns null if the xz cross-section isn't
 * slab-like enough to trust (eigenvalue ratio < SLAB_EIGENVALUE_RATIO_MIN). */
function computeSlabRotation(scene, id, log) {
  const pts = collectPositions(scene, (y) => y >= STELE_BAND[0] && y <= STELE_BAND[1]);
  if (pts.length < 10) {
    log(`  ! [${id}] only ${pts.length} vertices in the stele band (y in [${STELE_BAND}]) -- skipping orientation rotation`);
    return null;
  }

  let mx = 0;
  let mz = 0;
  for (const [x, , z] of pts) {
    mx += x;
    mz += z;
  }
  mx /= pts.length;
  mz /= pts.length;

  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, , z] of pts) {
    const dx = x - mx;
    const dz = z - mz;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }

  const { l1, l2, v2: normal } = eigenSym2x2(sxx, sxz, szz);
  const ratio = l2 > 1e-12 ? l1 / l2 : Infinity;
  if (ratio < SLAB_EIGENVALUE_RATIO_MIN) {
    log(
      `  ! [${id}] stele-band xz eigenvalue ratio ${ratio.toFixed(2)} < ${SLAB_EIGENVALUE_RATIO_MIN} -- section isn't slab-like, skipping orientation rotation (needs a visual check)`,
    );
    return null;
  }

  const [nx, nz] = normal;
  // Rotation mapping (nx,nz) -> (0,+1): theta = atan2(-nx, nz) (see derivation in
  // the coordinator write-up / commit notes -- verified against mat4RotateY above).
  const theta = Math.atan2(-nx, nz);
  log(
    `  [${id}] slab axis: eigenvalue ratio=${ratio.toFixed(2)}, normal=(${nx.toFixed(3)},${nz.toFixed(3)}) -> rotate ${((theta * 180) / Math.PI).toFixed(1)} deg about Y`,
  );
  return theta;
}

// Manual final say on front sign, filled in after visually inspecting rendered
// thumbnails. +1 = front is already +Z (no flip), -1 = front is -Z (flip needed).
// Takes precedence over both heuristics below.
const FRONT_OVERRIDE = {
  // Texture-contrast ratio was only 1.14 (below the 1.25 decisive threshold: +Z
  // std=14.13 n=49538, -Z std=16.05 n=104627 -- -Z *was* higher, just not by
  // enough to trust), so it fell back to the head-protrusion heuristic, which
  // -- like before -- picked +Z and was wrong (confirmed by rendering both
  // sides: -Z has the carved inscription + visible turtle head, +Z is blank).
  'bia-1727': -1,
  // Texture-contrast was decisive (ratio 2.18) but wrong here: +Z std=23.72 came
  // from only 9,323 samples (this is the smallest model, one primitive/texture,
  // "dan gian"/folk-style carving that's fainter than the others) vs -Z's 29,337
  // samples at std=10.88. Confirmed by rendering both sides: -Z has the carved
  // inscription + turtle head, +Z is blank.
  'bia-1661': -1,
};

function stddev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Mean absolute difference between consecutive samples (in collection order) --
 * a cheap proxy for "how much local contrast" independent of overall spread,
 * used as a secondary signal when std is inconclusive. */
function meanAbsDiffConsecutive(arr) {
  if (arr.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < arr.length; i++) sum += Math.abs(arr[i] - arr[i - 1]);
  return sum / (arr.length - 1);
}

async function decodeTextureLuminance(texture, size = 1024) {
  const image = texture.getImage();
  if (!image) return null;
  const { data, info } = await sharp(Buffer.from(image))
    .resize(size, size, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function sampleLuminance(lum, u, v) {
  let x = Math.round(u * (lum.width - 1));
  let y = Math.round(v * (lum.height - 1)); // glTF UV origin is top-left, same as image row order
  x = Math.min(Math.max(x, 0), lum.width - 1);
  y = Math.min(Math.max(y, 0), lum.height - 1);
  return lum.data[y * lum.width + x];
}

/** Texture-contrast front signal: at Van Mieu, every stele's back is blank
 * stone and the front carries carved text/ornament, so the front should have
 * much higher baseColor luminance variance. Classifies stele-band vertices by
 * (post slab-rotation) normal.z sign, samples baseColor luminance at each
 * vertex's UV, and compares std (+ mean-abs-diff of consecutive samples as a
 * secondary check) between the +Z-facing and -Z-facing groups. Returns
 * { flip, decisive, stdPos, stdNeg, madPos, madNeg, nPos, nNeg } -- `flip` is
 * only meaningful when `decisive` is true.
 */
async function computeTextureFrontSignal(scene, id, log) {
  const lumCache = new Map(); // Texture -> decoded luminance buffer (or null)
  const posLum = [];
  const negLum = [];
  const v = [0, 0, 0];
  const n = [0, 0, 0];
  const uv = [0, 0];

  const nodes = [];
  scene.traverse((node) => nodes.push(node));

  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      const texture = material?.getBaseColorTexture();
      if (!texture) continue;
      if (!lumCache.has(texture)) {
        // eslint-disable-next-line no-await-in-loop
        lumCache.set(texture, await decodeTextureLuminance(texture));
      }
      const lum = lumCache.get(texture);
      if (!lum) continue;

      const pos = prim.getAttribute('POSITION');
      const nrm = prim.getAttribute('NORMAL');
      const uvAttr = prim.getAttribute('TEXCOORD_0');
      if (!pos || !nrm || !uvAttr) continue;

      const count = pos.getCount();
      for (let i = 0; i < count; i++) {
        pos.getElement(i, v);
        if (v[1] < STELE_BAND[0] || v[1] > STELE_BAND[1]) continue;
        nrm.getElement(i, n);
        if (n[2] > 0.6) {
          uvAttr.getElement(i, uv);
          posLum.push(sampleLuminance(lum, uv[0], uv[1]));
        } else if (n[2] < -0.6) {
          uvAttr.getElement(i, uv);
          negLum.push(sampleLuminance(lum, uv[0], uv[1]));
        }
      }
    }
  }

  const stdPos = stddev(posLum);
  const stdNeg = stddev(negLum);
  const madPos = meanAbsDiffConsecutive(posLum);
  const madNeg = meanAbsDiffConsecutive(negLum);
  log(
    `  [${id}] texture-contrast signal: +Z std=${stdPos.toFixed(2)} mad=${madPos.toFixed(2)} (n=${posLum.length}), -Z std=${stdNeg.toFixed(2)} mad=${madNeg.toFixed(2)} (n=${negLum.length})`,
  );

  const result = { decisive: false, flip: false, stdPos, stdNeg, madPos, madNeg, nPos: posLum.length, nNeg: negLum.length };
  if (posLum.length < 30 || negLum.length < 30) {
    log(`  ! [${id}] too few textured stele-band samples (+Z=${posLum.length}, -Z=${negLum.length}) for a texture-contrast decision`);
    return result;
  }

  const lo = Math.min(stdPos, stdNeg) || 1e-6;
  const hi = Math.max(stdPos, stdNeg);
  const ratio = hi / lo;
  if (ratio >= 1.25) {
    result.decisive = true;
    result.flip = stdNeg > stdPos; // higher-contrast side is the front
    log(`  [${id}] texture-contrast ratio=${ratio.toFixed(2)} >= 1.25 -- decisive, front is ${result.flip ? '-Z' : '+Z'}`);
  } else {
    log(`  [${id}] texture-contrast ratio=${ratio.toFixed(2)} < 1.25 -- inconclusive, falling back to head-protrusion heuristic`);
  }
  return result;
}

/** Step 2 (fallback): after the slab is aligned to Z, decide whether the front
 * (the side the turtle's head protrudes toward) is +Z or -Z. Returns true if a
 * 180 deg flip is needed. NOTE: empirically unreliable when the stele isn't
 * centred on the turtle (see computeTextureFrontSignal, which is tried first);
 * kept as a fallback for when the texture signal is inconclusive. */
function computeFrontFlip(scene, id, log) {
  const stelePts = collectPositions(scene, (y) => y >= STELE_BAND[0] && y <= STELE_BAND[1]);
  let z0 = 0;
  for (const [, , z] of stelePts) z0 += z;
  z0 /= stelePts.length || 1;

  const turtlePts = collectPositions(scene, (y) => y <= TURTLE_BAND_MAX_Y);
  if (turtlePts.length < 10) {
    log(`  ! [${id}] only ${turtlePts.length} vertices in the turtle band (y <= ${TURTLE_BAND_MAX_Y}) -- assuming +Z is already the front`);
    return false;
  }

  let extentPos = 0;
  let extentNeg = 0;
  for (const [, , z] of turtlePts) {
    const d = z - z0;
    if (d > extentPos) extentPos = d;
    if (-d > extentNeg) extentNeg = -d;
  }
  const flip = extentNeg > extentPos;
  log(
    `  [${id}] front-sign check (turtle protrusion from stele-band centre z=${z0.toFixed(3)}): +Z=${extentPos.toFixed(3)}, -Z=${extentNeg.toFixed(3)} -> front is ${flip ? '-Z, flipping 180 deg' : '+Z, no flip needed'}`,
  );
  return flip;
}

async function bakePlacement(doc, id, log) {
  const scene = doc.getRoot().listScenes()[0];
  if (!scene) throw new Error(`[${id}] no scene found`);

  const bounds = getBounds(scene);
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const minY = bounds.min[1];
  const extentY = bounds.max[1] - bounds.min[1];
  if (!(extentY > 1e-8)) throw new Error(`[${id}] degenerate Y extent (${extentY})`);
  const scale = 1 / extentY;
  const M = mat4FromCenterScale(cx, minY, cz, scale);

  // Pass 1: snapshot world matrices before touching anything.
  const tasks = [];
  const seenMeshes = new Set();
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    if (seenMeshes.has(mesh)) {
      log(`  ! [${id}] mesh "${mesh.getName()}" is referenced by multiple nodes (instancing) -- bake will only be correct for one instance`);
    }
    seenMeshes.add(mesh);
    tasks.push({ mesh, worldMatrix: node.getWorldMatrix() });
  });

  // Pass 2: bake normalization * worldMatrix into vertex data.
  for (const { mesh, worldMatrix } of tasks) {
    transformMesh(mesh, mat4Multiply(M, worldMatrix));
  }

  // Pass 3: reset every node's local transform to identity.
  scene.traverse((node) => {
    node.setMatrix(mat4Identity());
  });

  // Orientation normalization: slab thin-axis -> Z, front -> +Z. Operates on the
  // already-centered/scaled, node-transform-identity mesh data above, and keeps
  // baking directly into vertex data (node transforms stay identity throughout).
  const theta = computeSlabRotation(scene, id, log);
  if (theta !== null) {
    bakeMeshMatrix(scene, mat4RotateY(theta));

    let flip;
    if (FRONT_OVERRIDE[id] !== undefined) {
      flip = FRONT_OVERRIDE[id] === -1;
      log(`  [${id}] front sign: FRONT_OVERRIDE=${FRONT_OVERRIDE[id]} -> front is ${flip ? '-Z' : '+Z'} (manual)`);
    } else {
      // eslint-disable-next-line no-await-in-loop
      const texSignal = await computeTextureFrontSignal(scene, id, log);
      if (texSignal.decisive) {
        flip = texSignal.flip;
      } else {
        flip = computeFrontFlip(scene, id, log);
      }
    }
    if (flip) {
      bakeMeshMatrix(scene, mat4RotateY(Math.PI));
    }
    // Re-center x/z: rotation about the Y axis through the origin preserves
    // centering exactly, but redo it defensively (float drift, etc.).
    const rotatedBounds = getBounds(scene);
    const rcx = (rotatedBounds.min[0] + rotatedBounds.max[0]) / 2;
    const rcz = (rotatedBounds.min[2] + rotatedBounds.max[2]) / 2;
    if (Math.abs(rcx) > 1e-6 || Math.abs(rcz) > 1e-6) {
      bakeMeshMatrix(scene, mat4FromCenterScale(rcx, 0, rcz, 1));
    }
  }

  const finalBounds = getBounds(scene);
  return {
    x: finalBounds.max[0] - finalBounds.min[0],
    y: finalBounds.max[1] - finalBounds.min[1],
    z: finalBounds.max[2] - finalBounds.min[2],
  };
}

// -----------------------------------------------------------------------------
// Per-model pipeline
// -----------------------------------------------------------------------------

async function processModel(id, io, { log = console.log } = {}) {
  const relSrc = MODELS[id];
  if (!relSrc) throw new Error(`unknown model id "${id}"`);
  const srcPath = path.join(SOURCE_DIR, relSrc);
  const sourceBytes = fs.statSync(srcPath).size;

  const t0 = Date.now();
  log(`\n=== ${id} <- ${relSrc} (${(sourceBytes / 1e6).toFixed(1)} MB) ===`);

  let readPath = srcPath;
  if (PRE_DECIMATE[id]) {
    readPath = await runPredecimate(id, srcPath, PRE_DECIMATE[id], log);
  }

  const doc = await io.read(readPath);

  await doc.transform(dedup(), prune());
  await handleDuplicateGeometry(doc, id, log);
  await doc.transform(weld());

  const before = countGeometry(doc);
  let after = before;
  if (before.triangles > TRIANGLE_BUDGET) {
    const ratio = Math.min(1, TRIANGLE_BUDGET / before.triangles);
    const error = SIMPLIFY_OVERRIDES[id]?.error ?? SIMPLIFY_ERROR;
    if (SIMPLIFY_OVERRIDES[id]) log(`  using simplify error override ${error} for ${id} (default ${SIMPLIFY_ERROR})`);
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error }));
    after = countGeometry(doc);
  }

  const size = await bakePlacement(doc, id, log);

  await fsp.mkdir(SCRATCH_DIR, { recursive: true });
  const intermediatePath = path.join(SCRATCH_DIR, `${id}.glb`);
  await io.write(intermediatePath, doc);

  // Normal maps are non-color (linear) data -- encode them separately at higher
  // quality (and never resize below 2048) so normal-mapped surface detail (e.g.
  // bia-1442) survives compression. Everything else (baseColor, etc.) keeps the
  // standard settings. No special color-space handling is needed either way:
  // textureCompress just re-encodes pixel bytes, it doesn't touch which glTF
  // slot references the texture (which is what makes normalTexture linear) or
  // apply any gamma/sRGB curve of its own.
  const hasNormalMap = doc.getRoot().listMaterials().some((m) => m.getNormalTexture());
  if (hasNormalMap) {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 95, slots: /^normalTexture$/ }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 82, slots: /^(?!normalTexture$).*/ }),
      quantize(),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
  } else {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 82 }),
      quantize(),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
  }

  await fsp.mkdir(MODELS_DIR, { recursive: true });
  const finalPath = path.join(MODELS_DIR, `${id}.glb`);
  await io.write(finalPath, doc);
  // Bước cuối (r14): pháp tuyến mượt + hàn đỉnh (tools/smooth-normals.mjs) — bản quét nguồn mang pháp tuyến phẳng từng
  // mặt ("giấy vò" dưới ánh sáng xiên). Hình học / texture giữ nguyên từng bit; bỏ qua id trong SKIP của script đó.
  const smooth = await smoothGlbFile(finalPath, { log: (m) => log(`  ${m.trim()}`) });
  if (smooth.skipped) log(`  smooth normals: skipped (${smooth.skipped})`);

  const finalBytes = fs.statSync(finalPath).size;
  const seconds = (Date.now() - t0) / 1000;

  log(
    `  triangles ${before.triangles.toLocaleString()} -> ${after.triangles.toLocaleString()}` +
      (after.triangles !== before.triangles ? '' : ' (under budget, not simplified)') +
      `; size (x,y,z) = ${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}`,
  );
  log(
    `  ${(sourceBytes / 1e6).toFixed(1)} MB -> ${(finalBytes / 1e6).toFixed(2)} MB in ${seconds.toFixed(1)}s -> ${finalPath}`,
  );

  return {
    id,
    sourceBytes,
    bytes: finalBytes,
    trianglesBefore: before.triangles,
    triangles: after.triangles,
    vertices: smooth.vertsAfter ?? after.vertices,
    size,
    seconds,
    intermediatePath,
  };
}

// -----------------------------------------------------------------------------
// Stats file (merge, so partial runs don't clobber other entries)
// -----------------------------------------------------------------------------

async function mergeStats(results) {
  let existing = {};
  try {
    existing = JSON.parse(await fsp.readFile(DATA_FILE, 'utf8'));
  } catch {
    existing = {};
  }
  for (const r of results) {
    existing[r.id] = {
      file: `models/${r.id}.glb`,
      bytes: r.bytes,
      sourceBytes: r.sourceBytes,
      triangles: r.triangles,
      vertices: r.vertices,
      size: { x: r.size.x, y: 1, z: r.size.z },
    };
  }
  await fsp.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fsp.writeFile(DATA_FILE, JSON.stringify(existing, null, 2) + '\n');
  return existing;
}

function printSummary(results) {
  const rows = results.map((r) => ({
    id: r.id,
    'src MB': (r.sourceBytes / 1e6).toFixed(1),
    'final MB': (r.bytes / 1e6).toFixed(2),
    'tris before': r.trianglesBefore.toLocaleString(),
    'tris after': r.triangles.toLocaleString(),
    sec: r.seconds.toFixed(1),
  }));
  console.log('\n=== prepare-models summary ===');
  console.table(rows);
  const big = results.filter((r) => r.bytes > 6.5e6);
  if (big.length) {
    console.log(
      `! over ~6 MB target: ${big.map((r) => `${r.id} (${(r.bytes / 1e6).toFixed(2)} MB)`).join(', ')}`,
    );
  }
}

// -----------------------------------------------------------------------------
// CLI entry
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const ids = args.length ? args : Object.keys(MODELS);
  for (const id of ids) {
    if (!MODELS[id]) {
      console.error(`Unknown model id "${id}". Known ids: ${Object.keys(MODELS).join(', ')}`);
      process.exit(1);
    }
  }

  const io = await createIO();
  const results = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const r = await processModel(id, io);
    results.push(r);
  }

  await mergeStats(results);
  printSummary(results);

  if (!process.env.SKIP_THUMBS) {
    const { renderThumbs } = await import('./render-thumbs.mjs');
    await renderThumbs(
      results.map((r) => ({ id: r.id, intermediatePath: r.intermediatePath })),
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { MODELS, SCRATCH_DIR, SOURCE_DIR, FRONT_OVERRIDE, bakePlacement, handleDuplicateGeometry, countGeometry, createIO };
