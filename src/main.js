// Router theo hash: #/ (chọn chế độ) · #/gallery[/id] · #/cinema[/id] · #/lab[/id]
import { BIA, byId, initData } from './data/index.js';
import { ensureFont, FONT } from './core/fonts.js';
import { initFpsMeter } from './core/fps-meter.js';

ensureFont(FONT.beVietnam);
initFpsMeter(); // đồng hồ FPS góc trên trái (Cài đặt → Hiển thị → Gỡ lỗi)

const root = document.getElementById('app');

const routes = {
  '': () => import('./views/cinema/index.js'),
  cinema: () => import('./views/cinema/index.js'),
};

const TITLES = {
  '': 'Điện ảnh · Bia Tiến sĩ Văn Miếu',
  cinema: 'Điện ảnh · Bia Tiến sĩ Văn Miếu',
};

/** @type {{unmount?:()=>void, update?:(params:string[])=>void}|null} */
let current = null;
let currentName = null;
let gen = 0;            // thế hệ mount: mỗi lần đổi view tăng 1, các await cũ tự huỷ khi thấy lệch
let mountingName = null; // view đang mount dở (để đổi tham số trong lúc chờ import không mount lần 2)

function parse() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name = '', ...params] = hash.split('/').filter(Boolean);
  return { name: routes[name] ? name : '', params };
}

/** Điều hướng: go('gallery', 'bia-1442') → #/gallery/bia-1442 */
export function go(name, ...params) {
  location.hash = '#/' + [name, ...params].filter(Boolean).join('/');
}

function makeCtx(params) {
  return {
    bia: BIA,
    byId,
    params,
    go,
    /** id bia từ tham số đầu tiên (nếu hợp lệ). */
    selected: byId(params[0]),
  };
}

async function render() {
  const { name, params } = parse();
  document.title = TITLES[name] ?? TITLES[''];

  // Cùng view, chỉ đổi tham số (vd: chọn bia khác) → để view tự cập nhật, không remount.
  if (current && name === currentName && current.update) {
    current.update(params);
    return;
  }
  // Cùng view đang mount dở (import chưa xong) → không mount lần 2; sau khi mount xong sẽ update theo hash mới.
  if (mountingName === name && !current) return;

  const myGen = ++gen;
  current?.unmount?.();
  current = null;
  currentName = null;
  mountingName = name;
  root.replaceChildren();
  root.className = 'view view-' + (name || 'cinema');
  document.body.dataset.view = name || 'cinema';

  const mod = await routes[name]();
  if (myGen !== gen) return; // đã chuyển sang view khác trong lúc chờ import
  const view = await mod.mount(root, makeCtx(params));
  if (myGen !== gen) { view?.unmount?.(); return; } // bị vượt trong lúc mount → dọn ngay, không để view mồ côi
  current = view;
  currentName = name;
  mountingName = null;
  // Hash đổi tham số trong lúc mount → đồng bộ lại.
  const now = parse();
  if (now.name === name && now.params.join('/') !== params.join('/')) current.update?.(now.params);
}

window.addEventListener('hashchange', render);
// r21: chọn nguồn danh mục (82 bia v2 / 10 bia v1) trước khi mount view đầu tiên — BIA là mảng sống.
initData().finally(render);
