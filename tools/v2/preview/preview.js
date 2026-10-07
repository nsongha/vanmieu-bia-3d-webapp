// So sánh v1 / v2 (LOD0 · LOD1 · LOD2 · biến thể A/B) cạnh nhau, cùng camera, cùng bộ đèn "lab" của app
// (src/core/lighting.js — chỉ import, không sửa) + đèn key xiên chỉnh được.
//
// URL: ?id=bia-1554&m=v1,ab/lod0-tfull-n0-c25-u4096,lod0,lod1,lod2&view=carving&cols=3&w=560&h=560&dpr=1
//   m: v1 | v1proxy | lod0 | lod1 | lod2 | ab/<tên biến thể> | bia-XXXX/lod0 (bia khác)   (v2 đọc models-v2/<id>/…)
//   view: front | front34 | carving | left | head | lod1   (camera + đèn xiên mặc định cho từng góc)
//   az/el/i: ghi đè đèn key.
// Hook kiểm thử: window.__v2 = { ready, shoot(name), setView(v), setLight(az, el, i), info() }

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createStudioLights, tuneScanMaterial } from '../../../src/core/lighting.js';

const q = new URLSearchParams(location.search);
const ID = q.get('id') || 'bia-1554';
const MODELS = (q.get('m') || 'v1,lod0,lod1,lod2').split(',').filter(Boolean);
const COLS = Number(q.get('cols') || Math.min(MODELS.length, 4));
const CW = Number(q.get('w') || 520);
const CH = Number(q.get('h') || 520);
const DPR = Number(q.get('dpr') || 1);
const ROWS = Math.ceil(MODELS.length / COLS);

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(DPR);
renderer.setSize(COLS * CW, ROWS * CH);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.setScissorTest(true);

const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

const camera = new THREE.PerspectiveCamera(30, CW / CH, 0.005, 50);
const controls = new OrbitControls(camera, canvas);
controls.addEventListener('change', () => draw());

// "bia-1554/lod0" = mô hình của bia khác (bảng QA nhiều bia, cùng camera).
const urlFor = (m) =>
  /^bia-\d{4}\//.test(m) ? `/models/v2/${m}.glb`
    : m === 'v1' ? `/models/${ID}.glb`
    : m === 'v1proxy' ? `/models/proxy/${ID}.glb`
      : m.startsWith('ab/') ? `/models/v2/${ID}/${m}.glb`
        : `/models/v2/${ID}/${m}.glb`;

/** @type {{name:string, scene:THREE.Scene, lights:any, root:THREE.Object3D|null, stats:object, label:HTMLElement}[]} */
const cells = [];
const wrap = document.getElementById('wrap');
const statusEl = document.getElementById('status');
let steleInfo = null;

// ---------------------------------------------------------------------------------------------------------------------
// Góc nhìn: camera + đèn xiên mặc định. Mốc hình học (mặt trước phiến bia, mép trái, đầu rùa) đo trên mô hình đầu tiên.
// ---------------------------------------------------------------------------------------------------------------------
const marks = { frontZ: 0.05, leftX: -0.25, head: [0, 0.12, 0.3] };

function measureMarks(root) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let frontZ = -Infinity;
  let leftX = Infinity;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      box.expandByPoint(v);
      if (v.y > 0.62 && v.y < 0.82 && Math.abs(v.x) < 0.12) frontZ = Math.max(frontZ, v.z);
      if (v.y > 0.6 && v.y < 0.8) leftX = Math.min(leftX, v.x);
    }
  });
  marks.frontZ = frontZ;
  marks.leftX = leftX;
  if (steleInfo?.measure?.head?.center) marks.head = steleInfo.measure.head.center;
}

const VIEWS = {
  front: () => ({ pos: [0, 0.5, 2.45], target: [0, 0.48, 0], az: -35, el: 28, i: 2.6 }),
  front34: () => ({ pos: [Math.sin(0.35) * 2.2, 0.62, Math.cos(0.35) * 2.2], target: [0, 0.5, 0], az: -40, el: 40, i: 1.9 }),
  lod1: () => ({ pos: [Math.sin(0.35) * 2.2, 0.62, Math.cos(0.35) * 2.2], target: [0, 0.5, 0], az: -40, el: 40, i: 1.9 }),
  carving: () => ({ pos: [0.02, 0.72, marks.frontZ + 0.26], target: [0.02, 0.72, marks.frontZ], az: -80, el: 10, i: 3.2 }),
  left: () => ({ pos: [marks.leftX - 0.42, 0.66, 0.06], target: [marks.leftX, 0.66, 0.0], az: -12, el: 14, i: 3.2 }),
  head: () => {
    const h = marks.head;
    return { pos: [h[0] + 0.16, h[1] + 0.07, h[2] + 0.34], target: h, az: -45, el: 32, i: 2.8 };
  },
};
let view = q.get('view') || 'front';
const light = { az: -35, el: 28, i: 2.6 };

function applyView(name, keepLight = false) {
  view = name;
  const v = VIEWS[name]();
  camera.fov = name === 'lod1' ? 38 : 30;
  camera.position.set(...v.pos);
  controls.target.set(...v.target);
  camera.updateProjectionMatrix();
  controls.update();
  if (!keepLight) {
    light.az = Number(q.get('az') ?? v.az);
    light.el = Number(q.get('el') ?? v.el);
    light.i = Number(q.get('i') ?? v.i);
  }
  applyLight();
}

function applyLight() {
  for (const c of cells) c.lights.setRaking(light.az, light.el, light.i);
  document.getElementById('az').value = light.az;
  document.getElementById('el').value = light.el;
  document.getElementById('int').value = light.i;
  document.getElementById('azv').textContent = light.az;
  document.getElementById('elv').textContent = light.el;
  document.getElementById('intv').textContent = light.i;
  draw();
}

// ---------------------------------------------------------------------------------------------------------------------
// Nạp
// ---------------------------------------------------------------------------------------------------------------------
function statsOf(root) {
  let tris = 0;
  let verts = 0;
  const tex = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    verts += g.attributes.position.count;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const k of ['map', 'normalMap']) {
      const t = o.material?.[k];
      if (t) tex.set(k, `${t.image?.width ?? '?'}${t.isCompressedTexture ? 'ktx2' : ''}`);
    }
  });
  return { tris, verts, tex: Object.fromEntries(tex) };
}

async function loadCell(i, name) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1e22);
  const lights = createStudioLights(scene, renderer, 'lab', { floor: true });
  const label = document.createElement('div');
  label.className = 'lbl';
  label.style.left = `${(i % COLS) * CW + 6}px`;
  label.style.top = `${Math.floor(i / COLS) * CH + 6}px`;
  label.textContent = `${name} …`;
  wrap.appendChild(label);
  const cell = { name, scene, lights, root: null, stats: {}, label };
  cells[i] = cell;
  const url = urlFor(name);
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const bytes = Number(res.headers.get('content-length')) || 0;
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    let hasMat = false;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && (o.material.map || o.material.color)) hasMat = !!o.material.map;
    });
    if (!hasMat) {
      root.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xb9b1a5, roughness: 0.9 }); });
    }
    tuneScanMaterial(root, { envMapIntensity: 0.8, roughness: 0.92 });
    scene.add(root);
    cell.root = root;
    cell.stats = { ...statsOf(root), bytes, loadMs: Math.round(performance.now() - t0) };
    const s = cell.stats;
    label.textContent = `${name}\n${(s.tris / 1000).toFixed(0)}k tris · ${(s.verts / 1000).toFixed(0)}k verts · ${(bytes / 1e6).toFixed(2)} MB\n${Object.entries(s.tex).map(([k, v]) => `${k} ${v}`).join(' · ') || 'no texture'}`;
  } catch (e) {
    label.textContent = `${name}\nLỖI: ${e.message}`;
    console.error(name, e);
  }
}

function draw() {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c) continue;
    const x = (i % COLS) * CW;
    const yTop = Math.floor(i / COLS) * CH;
    const y = ROWS * CH - yTop - CH; // gốc viewport WebGL ở dưới
    renderer.setViewport(x, y, CW, CH);
    renderer.setScissor(x, y, CW, CH);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(c.scene, camera);
  }
}

/** Chụp từng ô thành PNG riêng: .captures/v2/<name>__<mô hình>.png */
async function shoot(name) {
  draw();
  const out = [];
  const tmp = document.createElement('canvas');
  tmp.width = CW * DPR;
  tmp.height = CH * DPR;
  const g = tmp.getContext('2d');
  for (let i = 0; i < cells.length; i++) {
    const x = (i % COLS) * CW * DPR;
    const y = Math.floor(i / COLS) * CH * DPR;
    g.clearRect(0, 0, tmp.width, tmp.height);
    g.drawImage(canvas, x, y, CW * DPR, CH * DPR, 0, 0, CW * DPR, CH * DPR);
    const file = `${name}__${cells[i].name.replace(/\//g, '_')}`;
    const r = await fetch(`/__capture?name=${encodeURIComponent(file)}`, { method: 'POST', body: tmp.toDataURL('image/png') });
    out.push(await r.text());
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Khởi động + thanh điều khiển
// ---------------------------------------------------------------------------------------------------------------------
async function init() {
  try {
    steleInfo = await (await fetch(`/models/v2/${ID}/stele.json`)).json();
  } catch {
    steleInfo = null;
  }
  const idSel = document.getElementById('id');
  for (const id of ['bia-1514', 'bia-1554', 'bia-1727']) idSel.add(new Option(id, id, false, id === ID));
  idSel.onchange = () => { q.set('id', idSel.value); location.search = q.toString(); };
  const viewSel = document.getElementById('view');
  for (const v of Object.keys(VIEWS)) viewSel.add(new Option(v, v, false, v === view));
  viewSel.onchange = () => applyView(viewSel.value);
  const mIn = document.getElementById('models');
  mIn.value = MODELS.join(',');
  mIn.onchange = () => { q.set('m', mIn.value); location.search = q.toString(); };
  for (const [k, id] of [['az', 'az'], ['el', 'el'], ['i', 'int']]) {
    document.getElementById(id).oninput = (e) => { light[k] = Number(e.target.value); applyLight(); };
  }
  statusEl.textContent = `nạp ${MODELS.length} mô hình…`;
  await Promise.all(MODELS.map((m, i) => loadCell(i, m)));
  const first = cells.find((c) => c.root);
  if (first) measureMarks(first.root);
  applyView(view);
  statusEl.textContent = `${ID} · ${view} · KTX2 → ${ktx2.workerConfig ? Object.entries(ktx2.workerConfig).filter(([, v]) => v).map(([k]) => k.replace('Supported', '')).join('/') : '?'}`;
  draw();
}

const ready = init();
window.__v2 = {
  ready,
  shoot: async (name) => { await ready; return shoot(name); },
  setView: (v) => applyView(v),
  setLight: (az, el, i) => { Object.assign(light, { az, el, i: i ?? light.i }); applyLight(); },
  setCamera: (pos, target) => { camera.position.set(...pos); controls.target.set(...target); controls.update(); draw(); },
  info: () => ({ id: ID, view, light: { ...light }, marks, camera: { pos: camera.position.toArray(), target: controls.target.toArray() }, cells: cells.map((c) => ({ name: c.name, ...c.stats })), ktx2: ktx2.workerConfig }),
  draw,
};
