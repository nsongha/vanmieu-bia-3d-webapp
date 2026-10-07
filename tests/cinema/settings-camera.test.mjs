// Cài đặt → Cử chỉ → Camera (r33): danh sách thả xuống tự vẽ — đóng: lựa chọn đang dùng ("Tự động · <camera>"), mở: các
// camera + nhãn (tích hợp / ảo / iPhone / chưa kết nối), chuột, bàn phím (Enter / ↑↓ / Esc / Tab), bấm ra ngoài, click
// tổng hợp (= cú chạm–thả của lớp cử chỉ), cắm / rút thiết bị lúc đang mở, gợi ý iPhone gấp gọn, bỏ mã USB khỏi tên;
// (r50) mở danh sách → dò lại thiết bị (thiết bị tới muộn không báo devicechange vẫn hiện). Danh sách camera giả lập bằng
// sự kiện hand:cameras + enumerateDevices giả (cùng danh sách). node tests/cinema/settings-camera.test.mjs --port 5180
import { launch, openCinema, parseArgs, sleep } from '../lib/browser.mjs';
import { createReport } from '../lib/report.mjs';

const { port, headed } = parseArgs();
const report = createReport('settings-camera');
const { page, close, errors } = await launch({ headed, settings: { autoRotate: false, cinemaIdleAutoplay: false } });
await openCinema(page, port, { hooks: ['settings'], settleMs: 2500 });
const E = (fn, a) => page.evaluate(fn, a);
await page.click('.cin-gear'); await sleep(400);
await page.getByRole('tab', { name: 'Cử chỉ' }).click(); await sleep(300);
const cams = { labelled: true, autoLabel: 'FaceTime HD Camera (3A71:F4B5)', activeId: 'a', activeLabel: 'FaceTime HD Camera (3A71:F4B5)', width: 640, height: 480, cameras: [
  { id: 'a', label: 'FaceTime HD Camera (3A71:F4B5)', kind: 'tích hợp', rank: 1 },
  { id: 'b', label: 'OBS Virtual Camera', kind: 'USB', rank: 3 },
  { id: 'c', label: 'Camo Camera', kind: 'USB', rank: 3 },
  { id: 'd', label: 'iPhone của Hà Camera', kind: 'iPhone', rank: 2 },
] };
// enumerateDevices giả = đúng danh sách đang giả lập (mở danh sách thả xuống dò lại thiết bị — r50)
await E(() => {
  window.__fakeDevs = [];
  navigator.mediaDevices.enumerateDevices = async () => window.__fakeDevs.map((c) => ({ deviceId: c.id, kind: 'videoinput', label: c.label, groupId: '' }));
});
const fake = (c) => E((c) => { window.__fakeDevs = c.cameras; window.dispatchEvent(new CustomEvent('hand:cameras', { detail: c })); }, c);
await fake(cams);
await sleep(200);
const S = () => E(() => {
  const b = document.querySelector('.sp-dd__btn');
  const l = document.querySelector('.sp-dd__list');
  const opts = [...l.querySelectorAll('.sp-dd__opt')];
  return {
    btn: b.querySelector('.sp-dd__val').textContent + (b.querySelector('.sp-dd__tag').textContent ? ` [${b.querySelector('.sp-dd__tag').textContent}]` : ''),
    expanded: b.getAttribute('aria-expanded'), open: !l.hidden,
    opts: opts.map((o) => `${o.getAttribute('aria-selected') === 'true' ? '✓' : ' '}${o.querySelector('.sp-dd__val').textContent}${o.querySelector('.sp-dd__tag') ? ' [' + o.querySelector('.sp-dd__tag').textContent + ']' : ''}`),
    rowH: opts.map((o) => Math.round(o.getBoundingClientRect().height)), magnets: opts.every((o) => o.hasAttribute('data-magnet')) && b.hasAttribute('data-magnet'),
    focus: document.activeElement?.className ?? null, focusText: document.activeElement?.querySelector?.('.sp-dd__val')?.textContent ?? null,
    now: document.querySelector('.sp-cam > .sp-desc').textContent,
    setting: { id: window.__vm.settings.get().gestureCameraId, label: window.__vm.settings.get().gestureCameraLabel },
    panelOpen: !document.querySelector('.cin-setwrap').hidden,
    btnH: Math.round(b.getBoundingClientRect().height),
  };
});
const R = {};
R.closed = await S();
// chuột: mở, chọn OBS
await page.click('.sp-dd__btn'); await sleep(150);
R.openMouse = await S();
await page.getByRole('option', { name: /OBS Virtual Camera/ }).click(); await sleep(150);
R.pickedMouse = await S();
// bấm ra ngoài đóng
await page.click('.sp-dd__btn'); await sleep(120);
await page.click('.sp-title'); await sleep(120);
R.outside = (await S()).open;
// phím: Enter mở (tiêu điểm ở mục đang chọn), ↓ ↓, Enter chọn; mở lại, Esc đóng danh sách (bảng vẫn mở), Esc nữa đóng bảng
await E(() => document.querySelector('.sp-dd__btn').focus());
await page.keyboard.press('Enter'); await sleep(120);
const k1 = await S();
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await sleep(80);
const k2 = await S();
await page.keyboard.press('Enter'); await sleep(150);
const k3 = await S();
await page.keyboard.press('ArrowDown'); await sleep(120); // ↓ trên nút đóng → mở
const k4 = await S();
await page.keyboard.press('Escape'); await sleep(120);
const k5 = await S();
R.keys = { enterOpens: k1.open, focusOnSelected: k1.focusText, afterDownDown: k2.focusText, enterPicks: k3.setting, closedAfterPick: !k3.open, focusBackOnBtn: k3.focus, arrowOpens: k4.open, escClosesListOnly: !k5.open && k5.panelOpen };
await page.keyboard.press('Escape'); await sleep(200);
R.keys.secondEscClosesPanel = !(await E(() => !document.querySelector('.cin-setwrap').hidden));
// tay: mở lại bảng; lớp cử chỉ "nhón" = click tổng hợp lên đích nam châm
await page.click('.cin-gear'); await sleep(300);
await page.getByRole('tab', { name: 'Cử chỉ' }).click(); await sleep(200);
await fake(cams); await sleep(120);
await E(() => document.querySelector('.sp-dd__btn').click()); await sleep(120);
const h1 = await S();
await E(() => [...document.querySelectorAll('.sp-dd__opt')].find((o) => o.textContent.includes('Tự động')).click()); await sleep(150);
R.hand = { opened: h1.open, afterPick: await S() };
// cắm / rút thiết bị lúc đang mở: vẫn mở; camera đã chọn vắng mặt → "chưa kết nối"
await E(() => window.__vm.settings.set('gestureCameraLabel', 'Camo Camera'));
await E(() => window.__vm.settings.set('gestureCameraId', 'c'));
await E(() => document.querySelector('.sp-dd__btn').click()); await sleep(100);
await fake({ ...cams, cameras: cams.cameras.filter((x) => x.id !== 'c') }); await sleep(150);
R.deviceChange = await S();
await E(() => document.querySelector('.sp-dd__btn').click()); await sleep(100);
// gợi ý iPhone gấp gọn
R.discClosed = await E(() => !document.querySelector('.sp-disc').open);
await page.click('.sp-disc > summary'); await sleep(100);
R.discOpens = await E(() => document.querySelector('.sp-disc').open);
await E(() => window.__vm.settings.set('gestureCameraId', '')); await E(() => window.__vm.settings.set('gestureCameraLabel', ''));
// trùng tên sau khi bỏ mã USB → giữ mã để phân biệt
await fake({ ...cams, cameras: [...cams.cameras, { id: 'e', label: 'USB Camera (1111:2222)', kind: 'USB', rank: 2 }, { id: 'f', label: 'USB Camera (3333:4444)', kind: 'USB', rank: 2 }] }); await sleep(120);
R.dupNames = (await S()).opts;
// thiết bị tới muộn (không có sự kiện nào): mở danh sách → dò lại → hiện ra
await E(() => { window.__fakeDevs = [...window.__fakeDevs, { id: 'g', label: 'SongHa’s iPhone Camera' }]; });
await E(() => document.querySelector('.sp-dd__btn').click()); await sleep(250);
R.late = (await S()).opts;
await E(() => document.querySelector('.sp-dd__btn').click()); await sleep(100);

// ---------------------------------------------------------------------------- kiểm
report.check('đóng: "Tự động · FaceTime HD Camera" (bỏ mã USB)', R.closed.btn === 'Tự động · FaceTime HD Camera' && !R.closed.open && R.closed.expanded === 'false', R.closed.btn);
report.check('đóng: dòng "Đang dùng: … · 640×480" giữ nguyên', R.closed.now === 'Đang dùng: FaceTime HD Camera (3A71:F4B5) · 640×480', R.closed.now);
report.check('mở bằng chuột: 5 mục + nhãn, mục đang chọn có dấu', JSON.stringify(R.openMouse.opts) === JSON.stringify(['✓Tự động [FaceTime HD Camera]', ' FaceTime HD Camera [tích hợp]', ' OBS Virtual Camera [ảo]', ' Camo Camera [ảo]', ' iPhone của Hà Camera [iPhone]']), R.openMouse.opts);
report.check('hàng cao ≥ 44 px, nút + mục đều là đích nam châm', R.openMouse.rowH.every((v) => v >= 44) && R.closed.btnH >= 44 && R.openMouse.magnets, { rows: R.openMouse.rowH, btn: R.closed.btnH });
report.check('chọn bằng chuột → lưu id + tên, đóng, nhãn "ảo"', R.pickedMouse.setting.id === 'b' && R.pickedMouse.btn === 'OBS Virtual Camera [ảo]' && !R.pickedMouse.open, R.pickedMouse.setting);
report.check('bấm ra ngoài → đóng', R.outside === false);
report.check('phím: Enter mở, tiêu điểm ở mục đang chọn', R.keys.enterOpens && R.keys.focusOnSelected === 'OBS Virtual Camera');
report.check('phím: ↓↓ + Enter chọn, đóng, tiêu điểm về nút', R.keys.afterDownDown === 'iPhone của Hà Camera' && R.keys.enterPicks.id === 'd' && R.keys.closedAfterPick && R.keys.focusBackOnBtn === 'sp-dd__btn', R.keys);
report.check('phím: ↓ trên nút mở; Esc chỉ đóng danh sách; Esc nữa đóng bảng', R.keys.arrowOpens && R.keys.escClosesListOnly && R.keys.secondEscClosesPanel);
report.check('click tổng hợp (tay): mở + chọn "Tự động"', R.hand.opened && R.hand.afterPick.setting.id === '' && R.hand.afterPick.btn === 'Tự động · FaceTime HD Camera');
report.check('rút thiết bị lúc đang mở: vẫn mở, camera đã chọn → "chưa kết nối"', R.deviceChange.open && R.deviceChange.btn === 'Camo Camera [chưa kết nối]' && R.deviceChange.opts.at(-1) === '✓Camo Camera [chưa kết nối]', R.deviceChange.opts);
report.check('gợi ý iPhone: gấp sẵn, bấm mở', R.discClosed && R.discOpens);
report.check('mở danh sách → dò lại thiết bị: iPhone tới muộn (không báo devicechange) hiện ra', R.late.includes(' SongHa’s iPhone Camera [iPhone]'), R.late);
report.check('trùng tên sau khi bỏ mã USB → giữ mã để phân biệt', R.dupNames.includes(' USB Camera (1111:2222) [USB]') && R.dupNames.includes(' USB Camera (3333:4444) [USB]'), R.dupNames.slice(-2));
await close();
process.exit(report.finish(errors));
