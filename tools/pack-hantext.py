#!/usr/bin/env python3
# r87 → r89 — đóng gói dữ liệu CHỮ HÁN SỐ HOÁ (kiểu chữ sáng "Chữ Hán (số hoá)" của Điện ảnh) cho app:
#   python3 tools/pack-hantext.py <thư mục căn chỉnh, vd. …/hantext/align-1442> public/hantext/bia-1442 [--font <.ttc/.ttf> --index N]
# Vào: chars.json ({ meta, chars[{ ch, col, row, cx, cy, w, h, conf, section }] }) của bước căn chỉnh (atlas đi kèm KHÔNG dùng nữa).
# Ra:  chars.json gọn (chỉ trường app cần + $doc nguồn văn bản + sdf) + atlas.webp DỰNG LẠI ở đây từ font.
#
# r89: atlas là TRƯỜNG KHOẢNG CÁCH CÓ DẤU (SDF) thay cho độ phủ xám — chữ trên đá chỉ ~6–10 px ở khung nghỉ: độ phủ nét mảnh (Songti
# Regular) mip xuống thành ô xám vuông; SDF giữ được hình nét ở cỡ nhỏ (shader tự làm dày nét theo cỡ trên màn), quầng sáng lấy theo
# khoảng cách tới nét (đúng hình chữ, không theo hộp ô). Kênh xám: 0,5 = mép nét, > 0,5 trong nét, ± `spread` texel ↔ 1 / 0.
# Font: ưu tiên mặt đậm cài sẵn (Songti TC Bold → STSong → Songti TC Regular), chữ thiếu trong mặt đã chọn → mặt kế tiếp. Không tải gì.
# r90 (căn chỉnh v2): cx, cy, w, h = HỘP NÉT KHẮC của chữ → mỗi chữ trong atlas một ô SÁT MỰC: `a` = hộp mực (texel, x y w h, đo
# trên hình dựng siêu mẫu), quanh nó còn ≥ SPREAD texel trường khoảng cách (app lấy thêm lề PAD khi vẽ). App vẽ hộp mực phủ hộp nét
# khắc (giãn mỗi trục, lệch tỉ lệ ≤ 1,25 — "一" không thành ô vuông). Cỡ dựng: mực trung vị cao CELL texel.
# r90: chữ src 'recon' (quê quán / tiêu đề giáp DỰNG LẠI từ phiên âm, không có trong nguồn văn bản) KHÔNG BAO GIỜ thành chữ: giữ bản
# ghi (vị trí, để app biết chỗ — vẫn là Nét khắc) nhưng `a` = null, hình chữ chỉ dùng cho recon không vào atlas.
import json, math, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

CELL, PITCH, SPREAD, SS = 48, 64, 6, 4  # mực trung vị (texel), bước ô, tầm SDF (texel), siêu lấy mẫu
PAD = 3  # lề trường khoảng cách app lấy quanh hộp mực (texel) — khử răng cưa mép nét
ATLAS_W = 2048
FACES = [  # (tệp, tên mặt) — thứ tự ưu tiên
    ('/System/Library/Fonts/Supplemental/Songti.ttc', ('Songti TC', 'Bold')),
    ('/System/Library/Fonts/Supplemental/Songti.ttc', ('STSong', 'Regular')),
    ('/System/Library/Fonts/Supplemental/Songti.ttc', ('Songti TC', 'Regular')),
]

args = sys.argv[1:]
src, dst = Path(args[0]), Path(args[1])
if '--font' in args:
    i = args.index('--font')
    FACES = [(args[i + 1], None if '--index' not in args else int(args[args.index('--index') + 1]))]


def open_face(path, want, size):
    if isinstance(want, int) or want is None:
        return ImageFont.truetype(path, size, index=want or 0)
    for k in range(32):
        try:
            f = ImageFont.truetype(path, size, index=k)
        except OSError:
            break
        if f.getname() == want:
            return f
    return None


HI = PITCH * SS
EM = round(CELL / 0.93 * SS)  # mực chữ CJK ~0,93 em (đo trên Songti) → mực trung vị ≈ CELL texel
faces = [(f, f.getname()) for f in (open_face(p, w, EM) for p, w in FACES) if f is not None]
if not faces:
    sys.exit('không mở được font nào')


def render(font, ch, dy=0.0):
    im = Image.new('L', (HI, HI), 0)
    ImageDraw.Draw(im).text((HI / 2, HI / 2 - dy), ch, font=font, fill=255, anchor='mm')
    return np.asarray(im)


def has(font, ch):
    a = render(font, ch)
    return a.any() and not any((a == render(font, z)).all() for z in ('', '\U0010fffd'))


d = json.loads((src / 'chars.json').read_text())
m = d['meta']
RECON = lambda c: c.get('src') == 'recon'
uniq = sorted(set(c['ch'] for c in d['chars'] if not RECON(c)))
pick = {}
for ch in uniq:
    pick[ch] = next((f for f, _ in faces if has(f, ch)), faces[-1][0])
used = sorted({pick[ch].getname() for ch in uniq})
# tâm dọc chung: trung vị tâm mực chữ (anchor 'mm' của PIL lấy giữa ascender / descender, không phải giữa khung chữ CJK)
cys = []
for ch in uniq[::5]:
    ys = np.nonzero((render(pick[ch], ch) > 127).any(1))[0]
    if len(ys):
        cys.append((ys[0] + ys[-1]) / 2 - HI / 2)
DY = float(np.median(cys))

cols = ATLAS_W // PITCH
rows = math.ceil(len(uniq) / cols)
AH = rows * PITCH + (-rows * PITCH) % 4
atlas = np.zeros((AH, ATLAS_W), np.uint8)
cent = (np.arange(PITCH) + 0.5) * SS - 0.5  # tâm texel ra, toạ độ siêu mẫu
gy, gx = np.meshgrid(cent, cent, indexing='ij')
Q = np.stack([gy.ravel(), gx.ravel()], 1).astype(np.float32)
where = {}
for k, ch in enumerate(uniq):
    mk = render(pick[ch], ch, DY) > 127
    inside = mk.reshape(PITCH, SS, PITCH, SS).mean((1, 3)) >= 0.5
    pad = np.pad(mk, 1)
    edge = mk & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    pts = np.argwhere(edge).astype(np.float32)
    if len(pts):
        dmin = np.full(len(Q), np.inf, np.float32)
        for s in range(0, len(pts), 2048):
            P = pts[s:s + 2048]
            dd = ((Q[:, None, 0] - P[None, :, 0]) ** 2 + (Q[:, None, 1] - P[None, :, 1]) ** 2).min(1)
            dmin = np.minimum(dmin, dd)
        dist = np.sqrt(dmin).reshape(PITCH, PITCH) / SS
    else:
        dist = np.full((PITCH, PITCH), SPREAD, np.float32)
    sd = np.where(inside, dist, -dist)
    v = np.clip(0.5 + sd / (2 * SPREAD), 0, 1)
    r, c = divmod(k, cols)
    atlas[r * PITCH:(r + 1) * PITCH, c * PITCH:(c + 1) * PITCH] = np.round(v * 255).astype(np.uint8)
    # hộp mực (texel, phân số — từ mặt nạ siêu mẫu), toạ độ atlas
    ys, xs = np.nonzero(mk)
    if len(ys):
        x0, x1, y0, y1 = xs.min() / SS, (xs.max() + 1) / SS, ys.min() / SS, (ys.max() + 1) / SS
    else:
        x0, x1, y0, y1 = PITCH / 2 - 1, PITCH / 2 + 1, PITCH / 2 - 1, PITCH / 2 + 1
    if min(x0, y0) < SPREAD or max(x1, y1) > PITCH - SPREAD:
        print('cảnh báo: mực sát mép ô', ch, round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1))
    where[ch] = [round(c * PITCH + x0, 2), round(r * PITCH + y0, 2), round(x1 - x0, 2), round(y1 - y0, 2)]

doc = (
    'r87 — chữ Hán số hoá của ' + m['stele'] + ' (Điện ảnh, kiểu chữ sáng "Chữ Hán (số hoá)"). Văn bản: bản của Viện Nghiên cứu Hán Nôm '
    '(qua bản chép trên mạng), đã đối chiếu chéo — CẦN ĐỐI CHIẾU lại với bản gốc; không hiện nguồn cho khách. Căn từng chữ vào lưới '
    'cột / ô trên bản dập: cx, cy, w, h chuẩn hoá theo ảnh bản dập 82 bia (models-v2/rubbings — cạnh dài 1536 px, gốc trên trái), tâm '
    'ô chữ; col = cột theo thứ tự đọc (0 = phải nhất); conf 0..1 = độ tin cậy căn chỉnh (app chỉ đặt chữ ≥ ngưỡng); section = '
    'title | body | colophon | roll-heading | roll-name | roll-hometown; r90 (căn chỉnh v' + str(m.get('version', 1)) + '): cx, cy, w, h = '
    'hộp nét khắc; a = hộp MỰC của chữ trong atlas.webp (texel x, y, w, h) — vẽ phủ hộp nét khắc; src = nguồn chữ (S1=S2 · S2 · recon); '
    'recon = DỰNG LẠI từ phiên âm (không có trong nguồn) → a = null, app KHÔNG BAO GIỜ vẽ thành chữ (chỗ đó là Nét khắc). atlas.webp: '
    'trường khoảng cách có dấu (sdf: 0,5 = mép nét, ± spread texel ↔ 1 / 0), dựng bằng tools/pack-hantext.py từ font ' + ', '.join(' '.join(n) for n in used)
    + ' — font hệ thống Apple, giấy phép phân phối hình chữ chưa rõ: thay bằng font OFL (vd. Noto Serif CJK TC) trước khi triển khai.'
)
out = {
    '$doc': doc,
    'stele': m['stele'],
    'img': m['img'],
    'atlas': [ATLAS_W, AH],
    'sdf': {'cell': CELL, 'spread': SPREAD, 'pad': PAD, 'ink': 'tight', 'font': [' '.join(n) for n in used]},
    'chars': [{**{k: c[k] for k in ('ch', 'col', 'row', 'cx', 'cy', 'w', 'h', 'conf', 'section')}, 'src': c.get('src', 'S1=S2'), 'a': None if RECON(c) else where[c['ch']]} for c in d['chars']],
}
for c in out['chars']:
    c['conf'] = round(c['conf'], 3)
dst.mkdir(parents=True, exist_ok=True)
(dst / 'chars.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
Image.fromarray(atlas).save(dst / 'atlas.webp', lossless=True, method=6)
print(dst, len(out['chars']), 'chữ ·', sum(RECON(c) for c in d['chars']), 'recon (không vẽ) ·', len(uniq), 'hình ·', 'atlas', ATLAS_W, '×', AH, '·', used)
