#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rubbing_clean.py — bản dập 82 bia tiến sĩ Văn Miếu → ảnh "quét bản dập" cho app 3D
==================================================================================

Thế hệ 2 của công cụ làm bia-1442: tự động cho cả 82 bia, ghi đè tay khi cần (rubbings-config.json).

  0. CHỌN ẢNH: mỗi thư mục "<stt>. <năm>" có 2 JPEG — ảnh nhận dạng (bản dập treo trong phòng, người cầm điện thoại
     ghi năm) và ảnh sạch (bản dập lấp kín khung hình). Ảnh nhận dạng luôn có điểm trắng gần thuần (điện thoại, đèn)
     và điểm ngả xanh (sàn, quần áo, tường) — bản dập thì không. Điểm = % trắng + % xanh trên ảnh 1/8; điểm thấp hơn
     là ảnh sạch; độ tin theo khoảng cách hai điểm (pick_clean).
  1. ĐIỂM MÉP (ảnh 1/4, kênh R): quét từng dải hàng / cột từ mép ảnh vào (scan_from_border): tìm thân viền mực (hồ sơ
     làm mượt ≈ bề dày viền tụt dưới 45 % giữa mực và giấy), rồi điểm cắt 50 % giữa giấy lề NGAY TRƯỚC viền và mực.
     Kênh R: vết ố / nếp gấp nâu còn sáng ở kênh đỏ, mực thì tối mọi kênh. Không có lề giấy → cờ 'cut' (viền chạm
     mép ảnh).
  2. NẮN PHỐI CẢNH: đường thẳng bền (cắt tỉa MAD) cho mép trái / phải (30–90 % chiều cao) và đáy → 4 điểm điều khiển =
     giao trái/phải với đáy và với đường song song đáy ở 30 % chiều cao ảnh (H1, Chain).
  3. SỬA XÔ LỆCH GIẤY: trên ảnh đã nắn, đường kẻ khắc dài mạnh nhất ở dải tiêu đề và ở đáy ô chữ (find_hlines: tổng
     đạo hàm dọc theo đường nghiêng — chữ triệt tiêu, đường kẻ liền thì không) phải nằm ngang → ánh xạ từng cột nội
     suy tuyến tính giữa hai đường (Chain.refs). Đo lại mép trên ảnh đã sửa; đáy khung bám đường 'tối trên / sáng
     dưới' gần nhất (±2 % chiều cao) quanh điểm quét.
  4. KHUNG NGOÀI: trái / phải / đáy = trung vị bền của điểm mép; vòm = y = ys − ay·(1 − |u|^p)^(1/q) đối xứng quanh trục
     bia, khớp MSAC tất định trên lưới (p, q) (fit_arch) rồi thử từng nửa riêng (refine_halves — chung đỉnh); chân vòm
     = mép vòm tại 0,75 % bề rộng trong mép bên (quy ước bản 1442). Mép bị ảnh chụp cắt: lấy mép ảnh (cờ
     edge-fallback-*), một bên cắt thì soi đối xứng bề rộng dải khung bên kia (frame-mirrored-*).
  5. MỐC TRONG (detect_inner): viền trong trái/phải = cặp đường dọc mạnh đối xứng trong dải khung; đáy viền trong =
     đường ngang trên cùng đủ mạnh ở 10 % dưới; dải tiêu đề = đường mạnh thấp nhất 10–42 % (mép ô chữ) + đường mạnh
     cách nó 3,5–14 % phía trên; đỉnh vòm trong = đỉnh ngoài + bề dày dải khung bên.
  6. ẢNH (độ phân giải gốc, lấy mẫu MỘT lần qua lưới PIL MESH): làm sạch như bản 1442 (chia ảnh mờ bán kính lớn, giãn
     percentile, gamma + ấm, khử hạt, unsharp) → master màu (masters/, chỉ để tái xuất). Bản đồ nét = kênh Blue trừ nền
     cục bộ → sigmoid, độ lợi chuẩn hoá theo từng bia (phân vị 85 tín hiệu trong mặt nạ → x = 0,8; hiệu chỉnh để phân
     bố trên ngưỡng shader 0,54→0,8 khớp bản 1442 đang chạy).
  7. XUẤT out/bia-<năm>.webp: RGBA với R=G=B = bản đồ nét (nền ép ≥ 0,45), A = mặt nạ khung ngoài (vòm đo được, mép mềm),
     cạnh dài 1536 px, WebP q82 m6. out/bia-<năm>.json: mốc chuẩn hoá (cùng khoá với bia-1442.json + arch_profile_y,
     spring_y_left/right), độ tin, cờ. manifest.json + sheets/ (tờ đối chiếu từng bia, trang 3×2).

Ghi đè tay — rubbings-config.json, khoá = năm ("1442"):
  "source"             tên tệp ảnh sạch (bỏ qua chọn tự động)
  "control_points"     {"TL":[x,y],"TR":..,"BR":..,"BL":..} px ẢNH GỐC — TL/TR trên mép ngoài trái/phải ở cùng một
                       đường ngang của bia, BL/BR = hai góc dưới ngoài
  "no_shear": true     tắt sửa xô lệch; "shear": {top_angle_deg, bottom_angle_deg, top_lo, top_hi, bot_lo, bot_hi}
  "bottom_from_scan"   true = đáy theo trung vị điểm quét (không bám đường thẳng)
  "landmarks_override" toạ độ 'rectified px' = px master + rectify.rectified_px_origin (out/bia-<năm>.json):
                       outer_left_x, outer_right_x, outer_bottom_y, apex_y, spring_y, arch_pq [p,q], inner_left_x,
                       inner_right_x, inner_bottom_y, inner_apex_y, header_top_y, header_bottom_y (mỗi khoá tuỳ chọn)
  "arch_symmetric"     true = bỏ vòm hai nửa; "arch": {"halves": false} tương tự
  "edge_detect" / "clean" / "stroke" / "output"  tham số (xem DEFAULTS); "note" ghi chú

Chạy:
    python3 tools/rubbing_clean.py --all --jobs 5           # cả 82 bia + manifest + tờ đối chiếu (~4 phút, ~2 GB RAM/job)
    python3 tools/rubbing_clean.py --only 1442,1565         # vài bia (manifest gộp với bản cũ)
    python3 tools/rubbing_clean.py --all --analysis --jobs 8  # chỉ dò mốc (nhanh) → sheets/analysis/

Tất định: không có ngẫu nhiên tự do (MSAC lấy mẫu con bằng RNG hạt cố định); chạy lại cho tệp giống hệt với cùng
phiên bản Pillow / libwebp / numpy.
"""

import argparse
import copy
import json
import math
import os
import re
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.dirname(HERE)
DEFAULT_SRC = "/Users/songha/Documents/Projects/vanmieu-bia-3d/data/Bản dập - 85 bia"

DEFAULTS = {
    "analysis_factor": 4,  # ảnh phân tích = 1/4 (JPEG draft)
    "edge_detect": {
        "run": 3,            # số mẫu liên tiếp phải dưới ngưỡng khi quét mép
        "channel": "R",
        "body_frac": 0.005,  # cửa sổ làm mượt khi tìm thân viền mực (≈ bề dày tối thiểu của viền, phần bề rộng ảnh)
    },
    "arch": {"halves": True},  # cho phép hai nửa vòm khác nhau (giấy treo không phẳng)
    "crop_pad_frac": 0.008,  # đệm quanh khung ngoài khi cắt (phần chiều rộng)
    "clean": {
        "flatten_blur_frac": 0.055,
        "denoise_radius": 1.0,
        "unsharp_radius": 3,
        "unsharp_percent": 130,
        "unsharp_threshold": 2,
        "black_pct": 0.5,
        "white_pct": 99.5,
        "warm_gain": [1.02, 1.0, 0.93],
        "gamma": 0.97,
    },
    "stroke": {
        "pre_median_frac": 0.00125,
        "large_blur_frac": 0.015,
        "target_x": 0.80,     # độ lợi chuẩn hoá: phân vị `norm_pct` của tín hiệu (trong mặt nạ) → x (hiệu chỉnh theo bia-1442 đang dùng)
        "norm_pct": 85.0,
        "gain": None,         # số cố định thì bỏ chuẩn hoá
        "bias": 0.0,
        "post_median_frac": 0.00125,
        "floor": 0.45,        # giá trị < floor (nền mực — shader bỏ qua dưới 0,54) ép về floor: nén tốt hơn
    },
    "feather_frac": 0.006,
    "output": {"long_side": 1536, "quality": 82, "method": 6},
}


# ======================================================================================
# helpers (numpy + PIL)
# ======================================================================================

def box1(a, r, axis):
    r = int(r)
    if r < 1:
        return np.asarray(a, np.float32)
    k = 2 * r + 1
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(np.asarray(a, np.float64), pad, mode="edge"), axis=axis)
    hi = [slice(None)] * a.ndim
    lo = [slice(None)] * a.ndim
    hi[axis] = slice(k, None)
    lo[axis] = slice(0, -k)
    return ((c[tuple(hi)] - c[tuple(lo)]) / k).astype(np.float32)




def blur_axis(a, r, axis):
    r = int(r)
    if r < 1:
        return np.asarray(a, np.float32)
    h = max(1, int(round(r * 0.75)))
    return box1(box1(a, h, axis), h, axis)




def erode(m, r):
    return box1(box1(m.astype(np.float32), r, 0), r, 1) > 1 - 1e-4






def robust_line(t, v, iters=12, k=2.5, min_tol=0.75):
    """v = a + b*t, cắt tỉa lặp theo MAD. Trả (a, b, inliers, mad)."""
    t = np.asarray(t, np.float64)
    v = np.asarray(v, np.float64)
    ok = np.isfinite(v)
    keep = ok.copy()
    a = b = 0.0
    mad = float("nan")
    for _ in range(iters):
        if keep.sum() < 3:
            break
        A = np.column_stack([np.ones(int(keep.sum())), t[keep]])
        (a, b), *_ = np.linalg.lstsq(A, v[keep], rcond=None)
        res = np.where(ok, v - (a + b * t), np.inf)
        mad = float(np.median(np.abs(res[keep]))) * 1.4826
        new = ok & (np.abs(res) <= max(k * mad, min_tol))
        if (new == keep).all():
            break
        keep = new
    return float(a), float(b), keep, mad


def crossing(p, start, stop, level, run=3):
    """Chỉ số (dưới pixel) đầu tiên đi từ start → stop mà p < level liên tục `run` mẫu."""
    step = 1 if stop >= start else -1
    n = len(p)
    i = int(start)
    while (i - stop) * step <= 0:
        if 0 <= i < n and p[i] < level:
            good = True
            for j in range(1, run):
                q = i + j * step
                if not (0 <= q < n) or p[q] >= level:
                    good = False
                    break
            if good:
                prev = i - step
                if 0 <= prev < n and p[prev] > p[i]:
                    f = (p[prev] - level) / (p[prev] - p[i])
                    return prev + f * step
                return float(i)
        i += step
    return None


def find_coeffs(dst_pts, src_pts):
    m = []
    for (x, y), (X, Y) in zip(dst_pts, src_pts):
        m.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        m.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
    A = np.array(m, dtype=np.float64)
    B = np.array(src_pts, dtype=np.float64).reshape(8)
    return np.linalg.solve(A, B)


def apply_coeffs(c, x, y):
    a, b, cc, d, e, f, g, h = c
    den = g * x + h * y + 1.0
    return (a * x + b * y + cc) / den, (d * x + e * y + f) / den


def odd(n):
    n = int(round(n))
    return n if n % 2 == 1 else n + 1


def r4(v):
    return float(round(float(v), 4))


def r1(v):
    return float(round(float(v), 1))


# ======================================================================================
# 0. chọn ảnh sạch
# ======================================================================================

def list_steles(src_root):
    out = {}
    for d in sorted(os.listdir(src_root)):
        m = re.match(r"^(\d+)\. (\d{4})$", d)
        if not m:
            continue
        files = sorted(f for f in os.listdir(os.path.join(src_root, d)) if f.lower().endswith((".jpg", ".jpeg")))
        out[m.group(2)] = {"stt": int(m.group(1)), "folder": d, "files": files}
    return out


def id_photo_score(path):
    """% điểm trắng gần thuần + % điểm ngả xanh trên ảnh 1/8 — cao = ảnh nhận dạng (phòng, điện thoại)."""
    im = Image.open(path)
    im.draft("RGB", (im.size[0] // 8, im.size[1] // 8))
    a = np.asarray(im.convert("RGB"), np.float32)
    V = a.max(-1)
    mn = a.min(-1)
    sat = (V - mn) / np.maximum(V, 1)
    white = (mn > 215) & (sat < 0.15)
    blue = (a[..., 2] > a[..., 0] + 8) & (V > 40)
    return float(white.mean() * 100), float(blue.mean() * 100)


def pick_clean(src_root, info):
    scores = []
    for f in info["files"]:
        w, b = id_photo_score(os.path.join(src_root, info["folder"], f))
        scores.append({"file": f, "white_pct": round(w, 3), "blue_pct": round(b, 3), "score": round(w + b, 3)})
    order = sorted(scores, key=lambda s: (s["score"], s["file"]))
    clean, other = order[0], order[-1]
    margin = other["score"] - clean["score"]
    conf = max(0.0, min(1.0, margin / 0.5)) if clean["score"] < 0.1 else max(0.0, min(1.0, margin / (other["score"] + 1e-6)))
    flags = []
    if len(info["files"]) != 2:
        flags.append("file-count-%d" % len(info["files"]))
    if conf < 0.6:
        flags.append("pick-ambiguous")
    return {"clean": clean["file"], "id_photo": other["file"] if other is not clean else None,
            "scores": scores, "confidence": round(conf, 3), "flags": flags}


# ======================================================================================
# 1-3. hình học
# ======================================================================================

def load_small(path, f):
    im = Image.open(path)
    full = im.size
    im.draft("RGB", (max(1, full[0] // f), max(1, full[1] // f)))
    im = im.convert("RGB")
    return im, full


def luminance(arr):
    return arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114


def scan_from_border(p, run=3, min_contrast=12.0, deep=0.45, level=0.5, body=9, edge_w=5):
    """Hồ sơ p bắt đầu ở mép ảnh (chỉ số 0) đi vào trong. Mép khung ngoài:
      1) Ki = phân vị 15 cả hồ sơ (mức mực); Pg = max 1/4 đầu (mức giấy);
      2) thân viền: k = chỗ đầu tiên mà hồ sơ LÀM MƯỢT cửa sổ `body` (≈ bề dày tối thiểu của viền) tụt dưới
         Ki + deep·(Pg − Ki) liên tục `run` mẫu — nếp gấp / vết bẩn mảnh trên lề giấy bị làm mượt mất, viền mực
         loang lổ (phong hoá) vẫn đủ tối;
      3) Pp = max (làm mượt) trên [0, k) — mức giấy lề NGAY TRƯỚC viền;
      4) mép = điểm cắt Ki + level·(Pp − Ki) gần k nhất về phía ngoài, trên hồ sơ làm mượt nhẹ (`edge_w`).
    Trả (vị trí | None, độ tương phản, cờ); cờ 'cut' khi không có lề (viền chạm mép ảnh)."""
    ps = blur_axis(np.asarray(p, np.float32), 1, 0)
    n = len(ps)
    Ki = float(np.percentile(ps, 15))
    Pg = float(ps[:max(4, n // 4)].max())
    if Pg - Ki < min_contrast:
        return None, Pg - Ki, "lowcontrast"
    pb = box1(ps, max(1, body // 2), 0)
    k = crossing(pb, 0, n - 1, Ki + deep * (Pg - Ki), run)
    if k is None:
        return None, Pg - Ki, "nocross"
    k = int(k) + body // 2  # cửa sổ làm mượt kéo điểm tụt ra ngoài nửa cửa sổ
    k = min(k, n - 1)
    pe = box1(ps, max(1, edge_w // 2), 0)
    if k < 2:
        return 0.0, Pg - Ki, "cut"
    Pp = float(pe[:k].max())
    c = Pp - Ki
    if c < min_contrast:
        return 0.0, c, "cut"
    lev = Ki + level * c
    # đi ngược từ k ra ngoài tới khi hồ sơ (làm mượt nhẹ) vượt mức cắt
    i = k
    while i > 0 and pe[i] < lev:
        i -= 1
    if pe[i] < lev:
        return 0.0, c, "cut"
    if i + 1 < n and pe[i] != pe[i + 1]:
        x = i + (pe[i] - lev) / (pe[i] - pe[i + 1])
    else:
        x = float(i)
    if x <= 1.5:
        return x, c, "cut"
    return x, c, None


def border_scans(g, cfg):
    """Quét từ 4 mép ảnh vào: điểm mép khung ngoài (toạ độ ảnh nhỏ). Trả dict side → list (x, y, contrast, flag)."""
    H, W = g.shape
    run = cfg["edge_detect"]["run"]
    bh = max(3, int(round(H * 0.008)))
    bw = max(3, int(round(W * 0.01)))
    pts = {"L": [], "R": [], "T": [], "B": []}
    nW = int(W * 0.25)
    body = odd(max(3, W * cfg["edge_detect"].get("body_frac", 0.005)))
    for y0 in range(0, H - bh + 1, bh):
        p = g[y0:y0 + bh].mean(0)
        yc = y0 + (bh - 1) / 2.0
        x, c, f = scan_from_border(p[:nW], run, body=body)
        pts["L"].append((np.nan if x is None else x, yc, c, f))
        x, c, f = scan_from_border(p[::-1][:nW], run, body=body)
        pts["R"].append((np.nan if x is None else W - 1 - x, yc, c, f))
    nT = int(H * 0.5)
    nB = int(H * 0.15)
    for x0 in range(0, W - bw + 1, bw):
        p = g[:, x0:x0 + bw].mean(1)
        xc = x0 + (bw - 1) / 2.0
        y, c, f = scan_from_border(p[:nT], run, body=body)
        pts["T"].append((xc, np.nan if y is None else y, c, f))
        y, c, f = scan_from_border(p[::-1][:nB], run, body=body)
        pts["B"].append((xc, np.nan if y is None else H - 1 - y, c, f))
    return {k: np.array([(a, b, c) for a, b, c, _ in v], np.float64) for k, v in pts.items()}, \
           {k: [f for *_, f in v] for k, v in pts.items()}


def fit_side_line(P, flags, axis, lo, hi, border_val):
    """P: mảng (x, y, c). axis='v' (mép dọc: x = a + b*y, lấy y trong [lo,hi]) hoặc 'h' (mép ngang: y = a + b*x)."""
    if axis == "v":
        t, v = P[:, 1], P[:, 0]
    else:
        t, v = P[:, 0], P[:, 1]
    sel = (t >= lo) & (t <= hi)
    fl = [flags[i] for i in np.nonzero(sel)[0]]
    n = int(sel.sum())
    n_cut = sum(1 for f in fl if f == "cut")
    good = sel & np.isfinite(v) & np.array([f is None for f in flags])
    res = dict(n=n, n_cut=n_cut, n_ok=int(good.sum()))
    if n == 0 or n_cut > 0.4 * n or good.sum() < max(6, 0.3 * n):
        res.update(a=float(border_val), b=0.0, n_in=0, mad=float("nan"), src="border", cut=n_cut > 0.4 * max(n, 1))
        return res
    a, b, keep, mad = robust_line(t[good], v[good])
    res.update(a=a, b=b, n_in=int(keep.sum()), mad=mad, src="edge", cut=False)
    return res


def control_points_from_lines(lines, H, ref_y):
    la, lb = lines["left"]["a"], lines["left"]["b"]
    ra, rb = lines["right"]["a"], lines["right"]["b"]
    bc, bd = lines["bottom"]["a"], lines["bottom"]["b"]

    def inter(xa, xb, yc, yd):
        x = (xa + xb * yc) / (1 - xb * yd)
        return x, yc + yd * x

    BL = inter(la, lb, bc, bd)
    BR = inter(ra, rb, bc, bd)
    xm = 0.5 * (BL[0] + BR[0])
    c2 = ref_y - bd * xm
    TL = inter(la, lb, c2, bd)
    TR = inter(ra, rb, c2, bd)
    return {"TL": TL, "TR": TR, "BR": BR, "BL": BL}


def arch_F(u, p, q):
    u = np.clip(np.abs(u), 0, 1)
    return np.power(np.clip(1 - np.power(u, p), 0, 1), 1.0 / q)


ARCH_P = [round(0.9 + 0.1 * i, 2) for i in range(32)]  # 0.9 … 4 (vòm thật: cung tròn / elip / nhọn nhẹ)
ARCH_Q = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0]


def fit_arch(pts_top, pts_side, cx, hw, tol):
    """Khớp mép vòm: y = ys − ay·(1 − |u|^p)^(1/q), u = (x − cx)/hw (đối xứng quanh trục bia).
    pts_top: điểm từ quét cột, pts_side: điểm từ quét hàng ở vùng vòm. MSAC tất định: với mỗi (p, q) trên lưới, giả
    thuyết (ys, ay) từ các cặp điểm (một gần đỉnh |u| < 0,55, một ở vai) → điểm số = Σ max(0, 1 − (d/tol)²) với d =
    khoảng cách vuông góc xấp xỉ; giả thuyết tốt nhất tinh chỉnh bằng bình phương tối thiểu trên điểm trong.
    Chịu được cả dải điểm rác (mép ảnh, nếp gấp) mà bình phương tối thiểu cắt tỉa không chịu được."""
    T = np.asarray(pts_top, np.float64).reshape(-1, 2)
    S = np.asarray(pts_side, np.float64).reshape(-1, 2)
    X = np.concatenate([T[:, 0], S[:, 0]])
    Y = np.concatenate([T[:, 1], S[:, 1]])
    u = (X - cx) / hw
    ok = np.abs(u) < 0.995
    X, Y, u = X[ok], Y[ok], u[ok]
    n = len(X)
    if n < 8:
        return None
    au = np.abs(u)
    near = np.nonzero(au < 0.55)[0]
    far = np.nonzero(au >= 0.55)[0]
    if len(near) < 2 or len(far) < 2:
        return None
    I, J = np.meshgrid(near, far, indexing="ij")
    I, J = I.ravel(), J.ravel()
    if len(I) > 1500:
        sel = np.random.default_rng(12345).choice(len(I), 1500, replace=False)
        sel.sort()
        I, J = I[sel], J[sel]
    uu = np.clip(au, 1e-4, 0.9995)

    def dist(ys, ay, F, dF):
        r = Y[None, :] - (ys[:, None] - ay[:, None] * F[None, :])
        slope = ay[:, None] * dF[None, :] / hw
        return np.abs(r) / np.sqrt(1.0 + slope * slope)

    best = None
    for p in ARCH_P:
        for q in ARCH_Q:
            F = arch_F(u, p, q)
            base = np.clip(1 - uu ** p, 1e-6, 1)
            dF = (1.0 / q) * base ** (1.0 / q - 1) * (-p * uu ** (p - 1))
            den = F[J] - F[I]
            good = np.abs(den) > 1e-3
            ay = (Y[I] - Y[J])[good] / den[good]
            ys = Y[I][good] + ay * F[I][good]
            keep = ay > 0
            ay, ys = ay[keep], ys[keep]
            if len(ay) == 0:
                continue
            D = dist(ys, ay, F, dF)
            sc = np.maximum(0.0, 1.0 - (D / tol) ** 2).sum(1)
            k = int(np.argmax(sc))
            ys0, ay0 = float(ys[k]), float(ay[k])
            # tinh chỉnh
            for _ in range(4):
                d = dist(np.array([ys0]), np.array([ay0]), F, dF)[0]
                inl = d < tol
                if inl.sum() < 6:
                    break
                A_ = np.column_stack([np.ones(int(inl.sum())), -F[inl]])
                (ys1, ay1), *_ = np.linalg.lstsq(A_, Y[inl], rcond=None)
                if ay1 <= 0:
                    break
                ys0, ay0 = float(ys1), float(ay1)
            d = dist(np.array([ys0]), np.array([ay0]), F, dF)[0]
            score = float(np.maximum(0.0, 1.0 - (d / tol) ** 2).sum())
            inl = d < tol
            if best is None or score > best["score"] + 1e-9:
                best = dict(p=p, q=q, ys=ys0, ay=ay0, score=score, n=int(n), n_in=int(inl.sum()),
                            mad=float(np.median(d[inl])) * 1.4826 if inl.any() else 99.0)
    return best


def arch_y(x, A, cx, hw):
    """Mép vòm tại x. A có thể có 'halves' {'L': {p,q,ys,ay}, 'R': ...} (hai nửa riêng, chung đỉnh) — giấy bản dập
    treo không phẳng hay làm hai vai vòm lệch nhau."""
    x = np.asarray(x, np.float64)
    u = (x - cx) / hw
    if A.get("halves"):
        hl, hr = A["halves"]["L"], A["halves"]["R"]
        yl = hl["ys"] - hl["ay"] * arch_F(u, hl["p"], hl["q"])
        yr = hr["ys"] - hr["ay"] * arch_F(u, hr["p"], hr["q"])
        return np.where(u < 0, yl, yr)
    return A["ys"] - A["ay"] * arch_F(u, A["p"], A["q"])


def refine_halves(pts_top, pts_side, cx, hw, A, tol, gain=1.12):
    """Sau khớp đối xứng: khớp lại từng nửa vòm (chung đỉnh, (p, q, ay) riêng). Nhận nửa mới nếu điểm số MSAC của
    nửa đó tăng ≥ 12 %. Trả dict halves hoặc None."""
    P = np.concatenate([np.asarray(pts_top, np.float64).reshape(-1, 2), np.asarray(pts_side, np.float64).reshape(-1, 2)])
    if len(P) < 12:
        return None
    X, Y = P[:, 0], P[:, 1]
    u = (X - cx) / hw
    apex = A["ys"] - A["ay"]
    out = {}
    changed = False

    def score_of(uu, yy, p, q, ay):
        F = arch_F(uu, p, q)
        au = np.clip(np.abs(uu), 1e-4, 0.9995)
        base = np.clip(1 - au ** p, 1e-6, 1)
        dF = (1.0 / q) * base ** (1.0 / q - 1) * (-p * au ** (p - 1))
        d = np.abs(yy - (apex + ay - ay * F)) / np.sqrt(1.0 + (ay * dF / hw) ** 2)
        return float(np.maximum(0.0, 1.0 - (d / tol) ** 2).sum()), d

    for side, sel in (("L", (u < -0.03) & (u > -0.995)), ("R", (u > 0.03) & (u < 0.995))):
        uu, yy = u[sel], Y[sel]
        base_sc, _ = score_of(uu, yy, A["p"], A["q"], A["ay"])
        best = dict(p=A["p"], q=A["q"], ys=A["ys"], ay=A["ay"], score=base_sc)
        if len(uu) >= 8:
            for p in ARCH_P:
                for q in ARCH_Q:
                    F = arch_F(uu, p, q)
                    ok = (1 - F) > 0.05
                    if ok.sum() < 3:
                        continue
                    hyps = np.unique(np.round((yy[ok] - apex) / (1 - F[ok]), 2))
                    hyps = hyps[hyps > 0]
                    if len(hyps) > 200:
                        hyps = hyps[np.linspace(0, len(hyps) - 1, 200).astype(int)]
                    for ay in hyps:
                        sc, d = score_of(uu, yy, p, q, ay)
                        if sc > best["score"] + 1e-9:
                            best = dict(p=p, q=q, ys=apex + float(ay), ay=float(ay), score=sc)
        if best["score"] >= gain * base_sc + 1.0 and (best["p"], best["q"], best["ay"]) != (A["p"], A["q"], A["ay"]):
            changed = True
        else:
            best = dict(p=A["p"], q=A["q"], ys=A["ys"], ay=A["ay"], score=base_sc)
        out[side] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in best.items()}
    return out if changed else None


def scan_image(small, cfg):
    """Kênh dùng để dò mép khung: R (mặc định) — giấy và vết ố/nếp gấp nâu còn sáng ở kênh đỏ, mực đen thì tối ở mọi
    kênh → tách mực / vết ố rõ hơn độ sáng."""
    a = np.asarray(small, np.float32)
    ch = cfg["edge_detect"].get("channel", "R")
    if ch == "R":
        return a[..., 0].copy()
    if ch == "V":
        return a.max(-1)
    return luminance(a)


def detect_outer(small, cfg):
    """Ảnh nhỏ (1/4) chưa nắn → đường thẳng + điểm điều khiển (toạ độ ảnh nhỏ) + điểm mép."""
    g = scan_image(small, cfg)
    H, W = g.shape
    P, F = border_scans(g, cfg)
    lines = {
        "left": fit_side_line(P["L"], F["L"], "v", 0.35 * H, 0.90 * H, 0.0),
        "right": fit_side_line(P["R"], F["R"], "v", 0.35 * H, 0.90 * H, W - 1.0),
    }
    # đáy: các cột nằm giữa hai đường bên (bỏ 12 % mỗi phía — góc dưới hay rách / cong)
    xl = lines["left"]["a"] + lines["left"]["b"] * 0.8 * H
    xr = lines["right"]["a"] + lines["right"]["b"] * 0.8 * H
    span = xr - xl
    lines["bottom"] = fit_side_line(P["B"], F["B"], "h", xl + 0.12 * span, xr - 0.12 * span, H - 1.0)
    return dict(g=g, P=P, F=F, lines=lines, H=H, W=W)


def robust_median(v, k=3.0):
    v = np.asarray(v, np.float64)
    v = v[np.isfinite(v)]
    if len(v) == 0:
        return float("nan"), float("nan"), 0, 0
    m = float(np.median(v))
    mad = float(np.median(np.abs(v - m))) * 1.4826
    keep = np.abs(v - m) <= max(k * mad, 0.75)
    m2 = float(np.median(v[keep]))
    mad2 = float(np.median(np.abs(v[keep] - m2))) * 1.4826
    return m2, mad2, int(keep.sum()), int(len(v))


class Chain:
    """Phép biến đổi nguồn (ảnh nhỏ, toạ độ chỉ số pixel) ↔ 'r2' (đơn vị ảnh nhỏ, khung đã nắn thẳng).
    H1: phối cảnh nguồn → r1 (TL=(0,0), BR=(Wd,Hd)). M: r1 ↔ r2, sửa xô lệch giấy: các đường tham chiếu ngang
    (đường kẻ dải tiêu đề, đáy khung) y = c + t·(x − cx) trong r1 → nằm ngang tại y = c trong r2; giữa hai đường
    nội suy tuyến tính theo y (từng cột), ngoài cùng thì ngoại suy."""

    def __init__(self, fwd, inv, cx):
        self.fwd, self.inv, self.cx = fwd, inv, cx
        self.refs = None  # list (c, t) sắp theo c tăng dần, ≥ 2 đường

    def _lines_at(self, x):
        x = np.asarray(x, np.float64)
        return [c + t * (x - self.cx) for c, t in self.refs]

    def r1_to_r2(self, x, y):
        x = np.asarray(x, np.float64)
        y = np.asarray(y, np.float64)
        if not self.refs:
            return x, y
        Ls = self._lines_at(x)
        cs = [c for c, _ in self.refs]
        v = np.empty_like(y)
        done = np.zeros(y.shape, bool)
        K = len(self.refs)
        for k in range(K - 1):
            a, b = Ls[k], Ls[k + 1]
            sel = (y <= b) if k < K - 2 else np.ones(y.shape, bool)
            sel &= ~done
            if k == 0:
                pass  # đoạn đầu: ngoại suy phía trên
            s = (y - a) / (b - a)
            v = np.where(sel, cs[k] + s * (cs[k + 1] - cs[k]), v)
            done |= sel
        return x, v

    def r2_to_r1(self, u, v):
        u = np.asarray(u, np.float64)
        v = np.asarray(v, np.float64)
        if not self.refs:
            return u, v
        Ls = self._lines_at(u)
        cs = [c for c, _ in self.refs]
        y = np.empty_like(v)
        done = np.zeros(v.shape, bool)
        K = len(self.refs)
        for k in range(K - 1):
            sel = (v <= cs[k + 1]) if k < K - 2 else np.ones(v.shape, bool)
            sel &= ~done
            s = (v - cs[k]) / (cs[k + 1] - cs[k])
            y = np.where(sel, Ls[k] + s * (Ls[k + 1] - Ls[k]), y)
            done |= sel
        return u, y

    def src_to_r2(self, x, y):
        x1, y1 = apply_coeffs(self.fwd, np.asarray(x, np.float64), np.asarray(y, np.float64))
        return self.r1_to_r2(x1, y1)

    def r2_to_src(self, u, v):
        x1, y1 = self.r2_to_r1(u, v)
        return apply_coeffs(self.inv, x1, y1)


def warp_mesh(img, chain, box, out_size, src_scale=1.0, step=48, resample=Image.BICUBIC, fill=(0, 0, 0)):
    """Dựng ảnh đích kích thước out_size phủ vùng r2 'box' = (u0, v0, u1, v1) (toạ độ LIÊN TỤC của ảnh nhỏ, tức
    chỉ số + 0,5). Ảnh nguồn img ở tỉ lệ src_scale so với ảnh nhỏ (ảnh gốc: 4). Lưới tứ giác PIL MESH."""
    u0, v0, u1, v1 = box
    OW, OH = out_size
    kx = (u1 - u0) / OW
    ky = (v1 - v0) / OH
    xs = list(range(0, OW, step)) + [OW]
    ys = list(range(0, OH, step)) + [OH]
    X, Y = np.meshgrid(np.array(xs, np.float64), np.array(ys, np.float64))
    U = u0 + X * kx - 0.5  # → chỉ số ảnh nhỏ
    V = v0 + Y * ky - 0.5
    sx_, sy_ = chain.r2_to_src(U, V)
    SX = (sx_ + 0.5) * src_scale  # → toạ độ liên tục ảnh nguồn
    SY = (sy_ + 0.5) * src_scale
    mesh = []
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            bbox = (xs[i], ys[j], xs[i + 1], ys[j + 1])
            quad = (SX[j, i], SY[j, i], SX[j + 1, i], SY[j + 1, i],
                    SX[j + 1, i + 1], SY[j + 1, i + 1], SX[j, i + 1], SY[j, i + 1])
            mesh.append((bbox, tuple(float(q) for q in quad)))
    return img.transform((OW, OH), Image.MESH, mesh, resample=resample, fillcolor=fill)


def find_hlines(g, x0, x1, y0, y1, angles, n=6, min_sep=6, valid=None):
    """Đường kẻ ngang mạnh (khắc liền cả bề ngang) trong vùng: tổng đạo hàm dọc có dấu dọc theo đường y = y0' +
    tanθ·(x − cx). Chữ triệt tiêu nhau, đường kẻ thì không. Trả list (y tại cx, góc độ, cường độ có dấu)."""
    H, W = g.shape
    gs = blur_axis(g, 2, 1)
    gy = np.zeros_like(gs)
    gy[1:-1] = gs[2:] - gs[:-2]
    if valid is not None:
        gy[~erode(valid, 3)] = 0.0  # ngoài ảnh chụp (nền đen của canvas) không tính
    xs = np.arange(int(max(0, x0)), int(min(W, x1)))
    if len(xs) < 20:
        return []
    cx = 0.5 * (x0 + x1)
    ys = np.arange(int(max(1, y0)), int(min(H - 1, y1)))
    if len(ys) < 3:
        return []
    S = np.zeros((len(angles), len(ys)))
    for i, th in enumerate(angles):
        t = math.tan(math.radians(th))
        yy = ys[:, None] + t * (xs[None, :] - cx)
        yi = np.clip(np.round(yy).astype(int), 0, H - 1)
        S[i] = gy[yi, xs[None, :]].mean(1)
    A = np.abs(S)
    order = np.argsort(-A.ravel(), kind="stable")
    picked = []
    for idx in order:
        i, j = divmod(int(idx), A.shape[1])
        if any(abs(ys[j] - yy) < min_sep for yy, _, _ in picked):
            continue
        picked.append((float(ys[j]), float(angles[i]), float(S[i, j])))
        if len(picked) >= n:
            break
    return picked


def measure_frame(D, chain, cfg, Wd, Hd, bottom_line=None):
    """Điểm mép (nguồn) → r2 → trái / phải / đáy / vòm + độ tin. bottom_line = (y, độ tin) từ dò đường thẳng."""
    H, W = D["H"], D["W"]
    F = D["F"]
    P = {}
    for k, v in D["P"].items():
        u, w_ = chain.src_to_r2(v[:, 0], v[:, 1])
        P[k] = np.column_stack([u, w_])
    okf = {k: np.array([fl is None for fl in F[k]]) & np.isfinite(P[k][:, 0]) & np.isfinite(P[k][:, 1]) for k in P}
    conf, flags, mads = {}, [], {}

    def border_line(pts_src):
        u, v = chain.src_to_r2(pts_src[:, 0], pts_src[:, 1])
        return np.column_stack([u, v])

    def side(key, name, border_x):
        Q, ok = P[key], okf[key]
        body = (Q[:, 1] > 0.05 * Hd) & (Q[:, 1] < 0.93 * Hd)
        cut = np.array([fl == "cut" for fl in F[key]]) & body
        n_body = int(body.sum())
        if n_body and cut.sum() > 0.4 * n_body:
            ys_ = np.linspace(0.3 * H, 0.9 * H, 20)
            m, mad, _, _ = robust_median(border_line(np.column_stack([np.full_like(ys_, border_x), ys_]))[:, 0])
            flags.append("edge-fallback-" + name)
            conf[name] = 0.2
            mads[name] = mad
            return m
        m, mad, n_in, n = robust_median(Q[ok & body, 0])
        conf[name] = round(float(max(0.0, min(1.0, n_in / max(1, n_body)))) * math.exp(-mad / (0.004 * Wd)), 3)
        mads[name] = mad
        return m

    left_x = side("L", "left", 0.0)
    right_x = side("R", "right", W - 1.0)
    w = right_x - left_x
    Q, ok = P["B"], okf["B"]
    mid = (Q[:, 0] > left_x + 0.12 * w) & (Q[:, 0] < right_x - 0.12 * w)
    cut = np.array([fl == "cut" for fl in F["B"]]) & mid
    if bottom_line is not None:
        bottom_y, mad = bottom_line[0], float("nan")
        conf["bottom"] = round(float(bottom_line[1]), 3)
    elif mid.sum() and cut.sum() > 0.4 * mid.sum():
        xs_ = np.linspace(0.3 * W, 0.7 * W, 20)
        bottom_y, mad, _, _ = robust_median(border_line(np.column_stack([xs_, np.full_like(xs_, H - 1.0)]))[:, 1])
        flags.append("edge-fallback-bottom")
        conf["bottom"] = 0.2
    else:
        bottom_y, mad, n_in, n = robust_median(Q[ok & mid, 1])
        conf["bottom"] = round(float(min(1.0, n_in / max(1, mid.sum())) * math.exp(-mad / (0.006 * Wd))), 3)
    mads["bottom"] = mad

    cx, hw = 0.5 * (left_x + right_x), 0.5 * w
    Qt, okt = P["T"], okf["T"]
    inside_t = (Qt[:, 0] > left_x + 0.01 * w) & (Qt[:, 0] < right_x - 0.01 * w)
    selt = okt & inside_t & (Qt[:, 1] < 0.3 * Hd)
    Ql, Qr = P["L"], P["R"]
    sell = okf["L"] & (Ql[:, 1] < 0.2 * Hd) & (Ql[:, 0] > left_x + 0.006 * w) & (Ql[:, 0] < cx)
    selr = okf["R"] & (Qr[:, 1] < 0.2 * Hd) & (Qr[:, 0] < right_x - 0.006 * w) & (Qr[:, 0] > cx)
    side_pts = np.concatenate([Ql[sell], Qr[selr]])
    A = fit_arch(Qt[selt], side_pts, cx, hw, tol=0.006 * Wd)
    if A is None:
        flags.append("arch-fail")
        A = dict(p=2.0, q=2.0, ys=0.0, ay=0.6 * w, score=99.0, n=0, n_in=0, mad=99.0)
    conf["arch"] = round(float(min(1.0, A["n_in"] / max(1, 0.8 * A["n"])) * math.exp(-A["mad"] / (0.006 * Wd))), 3)
    if A["n"] > 0 and cfg["arch"].get("halves", True):
        H2 = refine_halves(Qt[selt], side_pts, cx, hw, A, tol=0.006 * Wd)
        if H2:
            A["halves"] = H2
            flags.append("arch-asymmetric")
    # chân vòm: nơi mép vòm (mô hình) lùi vào trong 0,75 % bề rộng so với mép bên (quy ước của bản 1442)
    spring_l = float(arch_y(left_x + 0.0075 * w, A, cx, hw))
    spring_r = float(arch_y(right_x - 0.0075 * w, A, cx, hw))
    spring = 0.5 * (spring_l + spring_r)
    return dict(left=left_x, right=right_x, bottom=bottom_y, cx=cx, hw=hw, arch=A, spring=spring,
                spring_lr=(spring_l, spring_r), apex_y=A["ys"] - A["ay"], conf=conf, flags=flags, mads=mads,
                pts=dict(P=P, okf=okf, selt=selt, side=side_pts))


def line_consensus(cand, rel=0.55, max_dang=1.0):
    """Các đường mạnh gần bằng đường mạnh nhất và cùng hướng → (y trung bình, góc trung vị, cường độ, n)."""
    if not cand:
        return None
    s0 = abs(cand[0][2])
    good = [c for c in cand if abs(c[2]) >= rel * s0 and abs(c[1] - cand[0][1]) <= max_dang]
    return (float(np.mean([c[0] for c in good])), float(np.median([c[1] for c in good])), s0, len(good))


def analyze(src_path, cfg, ov):
    """Dò toàn bộ hình học trên ảnh 1/4. Trả (small, geo, img2, valid2) — img2 = ảnh nhỏ đã nắn (r2) trên canvas."""
    f = cfg["analysis_factor"]
    small, full = load_small(src_path, f)
    scale = 2 ** round(math.log2(full[0] / small.size[0]))  # draft: hệ số đúng (4)
    D = detect_outer(small, cfg)
    H, W = D["H"], D["W"]
    flags = []
    if ov.get("control_points"):
        cps = {k: ((v[0] + 0.5) / scale - 0.5, (v[1] + 0.5) / scale - 0.5) for k, v in ov["control_points"].items()}
        cp_src = "override"
    else:
        cps = control_points_from_lines(D["lines"], H, 0.3 * H)
        cp_src = "auto"
    TL, TR, BR, BL = cps["TL"], cps["TR"], cps["BR"], cps["BL"]
    dist = lambda p, q: math.hypot(p[0] - q[0], p[1] - q[1])
    Wd = 0.5 * (dist(TL, TR) + dist(BL, BR))
    Hd = 0.5 * (dist(TL, BL) + dist(TR, BR))
    rect_pts = [(0, 0), (Wd, 0), (Wd, Hd), (0, Hd)]
    fwd = find_coeffs([TL, TR, BR, BL], rect_pts)
    inv = find_coeffs(rect_pts, [TL, TR, BR, BL])
    chain = Chain(fwd, inv, 0.5 * Wd)

    def canvas_of(g_):
        pad = 0.05 * Wd
        return (g_["left"] - pad + 0.5, g_["apex_y"] - pad + 0.5, g_["right"] + pad + 0.5, g_["bottom"] + pad + 0.5)

    def render(g_):
        box = canvas_of(g_)
        OW, OH = int(round(box[2] - box[0])), int(round(box[3] - box[1]))
        im = warp_mesh(small, chain, box, (OW, OH))
        valid = np.asarray(warp_mesh(Image.new("L", small.size, 255), chain, box, (OW, OH),
                                     resample=Image.BILINEAR, fill=0)) > 250
        return im, valid, box, (-box[0] + 0.5, -box[1] + 0.5)

    g1 = measure_frame(D, chain, cfg, Wd, Hd)
    sc = ov.get("shear") if isinstance(ov.get("shear"), dict) else {}
    shear = None
    if cfg.get("shear_correct", True) and not ov.get("no_shear"):
        # --- sửa xô lệch giấy: đường kẻ khắc dài ở dải tiêu đề (trên) và ở khung trong đáy (dưới) phải nằm ngang
        im1, valid1, box1, (ox, oy) = render(g1)
        gg = luminance(np.asarray(im1, np.float32))
        Ht = g1["bottom"] - g1["apex_y"]
        w = g1["right"] - g1["left"]
        x0_, x1_ = g1["left"] + ox + 0.15 * w, g1["right"] + ox - 0.15 * w
        angles = np.round(np.arange(-7.0, 7.0001, 0.1), 2)
        sep = max(4, int(0.012 * Ht))
        ct = find_hlines(gg, x0_, x1_, g1["apex_y"] + oy + sc.get("top_lo", 0.08) * Ht,
                         g1["apex_y"] + oy + sc.get("top_hi", 0.42) * Ht, angles, n=4, min_sep=sep, valid=valid1)
        cb = find_hlines(gg, x0_, x1_, g1["bottom"] + oy - sc.get("bot_hi", 0.14) * Ht,
                         g1["bottom"] + oy - sc.get("bot_lo", 0.015) * Ht, angles, n=4, min_sep=sep, valid=valid1)
        top = line_consensus(ct)
        bot = line_consensus(cb)
        shear = dict(top=None, bottom=None)
        refs = []
        if top and top[2] >= 6.0:
            ang = float(sc.get("top_angle_deg", top[1]))
            refs.append((top[0] - oy, math.tan(math.radians(ang))))
            shear["top"] = dict(y=round(top[0] - oy, 1), angle_deg=round(ang, 2), strength=round(top[2], 1), n=top[3])
        else:
            flags.append("no-header-line")
        if bot and bot[2] >= 6.0:
            ang = float(sc.get("bottom_angle_deg", bot[1]))
            refs.append((bot[0] - oy, math.tan(math.radians(ang))))
            shear["bottom"] = dict(y=round(bot[0] - oy, 1), angle_deg=round(ang, 2), strength=round(bot[2], 1), n=bot[3])
        else:
            flags.append("no-inner-bottom-line")
        if len(refs) == 1:
            # chỉ một đường: đường còn lại = đáy khung (giữ nguyên hướng của nắn phối cảnh)
            refs.append((g1["bottom"], 0.0) if shear["top"] else (g1["apex_y"], 0.0))
        if len(refs) == 2:
            refs.sort()
            if refs[1][0] - refs[0][0] > 0.2 * Ht:
                chain.refs = refs
    g2 = measure_frame(D, chain, cfg, Wd, Hd)

    # --- đáy khung: điểm quét (trung vị) bám vào đường 'tối trên / sáng dưới' gần nhất (±2 % chiều cao) trên r2
    bl = None
    im2, valid2, box2, (ox, oy) = render(g2)
    if "edge-fallback-bottom" not in g2["flags"] and not ov.get("bottom_from_scan"):
        gg = luminance(np.asarray(im2, np.float32))
        Ht = g2["bottom"] - g2["apex_y"]
        w = g2["right"] - g2["left"]
        cand = find_hlines(gg, g2["left"] + ox + 0.1 * w, g2["right"] + ox - 0.1 * w,
                           g2["bottom"] + oy - 0.03 * Ht, g2["bottom"] + oy + 0.03 * Ht,
                           np.round(np.arange(-1.0, 1.0001, 0.1), 2), n=8, min_sep=max(3, int(0.005 * Ht)), valid=valid2)
        pos = [c for c in cand if c[2] >= 6.0 and abs(c[0] - oy - g2["bottom"]) <= 0.02 * Ht]
        if pos:
            best = min(pos, key=lambda c: abs(c[0] - oy - g2["bottom"]))
            bl = dict(y=round(best[0] - oy, 1), angle_deg=best[1], strength=round(best[2], 1),
                      scan_y=round(g2["bottom"], 1))
            g2 = measure_frame(D, chain, cfg, Wd, Hd, bottom_line=(best[0] - oy, min(1.0, best[2] / 20.0)))
            im2, valid2, box2, (ox, oy) = render(g2)
    geo = g2
    geo["flags"] = flags + geo["flags"]
    geo.update(scale=scale, full_size=full, small_size=small.size, Wd=Wd, Hd=Hd, chain=chain, cps_small=cps,
               cp_src=cp_src, shear=shear, lines=D["lines"], box=box2, offset=(ox, oy), bottom_line=bl)
    return small, geo, im2, valid2


def detect_inner(img2, valid2, geo, ov):
    """Mốc trong trên ảnh r2 (đã nắn): viền trong trái/phải/đáy (mép ô chữ), dải tiêu đề (trên/dưới), đỉnh vòm trong.
    Quy ước (giống bia-1442): mép ô chữ = đường kẻ dài mạnh TRONG CÙNG của dải khung mỗi phía (≥ 50–60 % đường
    mạnh nhất vùng đó); trái/phải ghép cặp đối xứng; đỉnh dải tiêu đề = mép dưới đường viền trên của dải (đường mạnh
    thấp nhất cách mép ô chữ 3,5–14 % chiều cao); đỉnh vòm trong = đỉnh vòm ngoài + bề dày dải khung bên (bám đường
    ngang gần đó nếu có)."""
    ox, oy = geo["offset"]
    g = luminance(np.asarray(img2, np.float32))
    Ht = geo["bottom"] - geo["apex_y"]
    w = geo["right"] - geo["left"]
    L, R = geo["left"] + ox, geo["right"] + ox
    top = geo["apex_y"] + oy
    bot = geo["bottom"] + oy
    angs = np.round(np.arange(-0.6, 0.6001, 0.2), 2)
    conf, flags, cands = {}, [], {}

    # --- trái / phải (đường dọc dài trên thân ô chữ)
    gT = np.ascontiguousarray(g.T)
    vT = np.ascontiguousarray(valid2.T)
    yb0, yb1 = top + 0.35 * Ht, bot - 0.15 * Ht
    vl = find_hlines(gT, yb0, yb1, L + 0.03 * w, L + 0.16 * w, angs, n=8, min_sep=3, valid=vT)
    vr = find_hlines(gT, yb0, yb1, R - 0.16 * w, R - 0.03 * w, angs, n=8, min_sep=3, valid=vT)
    cl = [((c[0] - L) / w, abs(c[2])) for c in vl]
    cr = [((R - c[0]) / w, abs(c[2])) for c in vr]
    cands["left"], cands["right"] = [(round(a, 4), round(b, 1)) for a, b in cl], [(round(a, 4), round(b, 1)) for a, b in cr]
    il = ir = None
    if cl and cr:
        tl = 0.5 * max(s for _, s in cl)
        tr = 0.5 * max(s for _, s in cr)
        sl = [c for c in cl if c[1] >= tl]
        sr = [c for c in cr if c[1] >= tr]
        pairs = [(a, b) for a in sl for b in sr if abs(a[0] - b[0]) <= 0.012]
        if pairs:
            a, b = max(pairs, key=lambda p: (round(0.5 * (p[0][0] + p[1][0]), 3), p[0][1] + p[1][1]))
            il, ir = a[0], b[0]
            conf["inner_lr"] = round(min(1.0, (a[1] + b[1]) / 80.0) * (1.0 - abs(a[0] - b[0]) / 0.024), 3)
        else:
            il = max(sl)[0]
            ir = max(sr)[0]
            conf["inner_lr"] = 0.3
            flags.append("inner-lr-asym")
    if il is None:
        il = ir = 0.085
        conf["inner_lr"] = 0.0
        flags.append("inner-lr-missing")
    inner_left = geo["left"] + il * w
    inner_right = geo["right"] - ir * w
    xi0, xi1 = inner_left + ox + 0.04 * w, inner_right + ox - 0.04 * w

    # --- đáy viền trong (đường ngang trên cùng đủ mạnh trong 10 % chiều cao trên đáy khung)
    hb = find_hlines(g, xi0, xi1, bot - 0.10 * Ht, bot - 0.008 * Ht, angs, n=8, min_sep=3, valid=valid2)
    cands["bottom"] = [(round((c[0] - top) / Ht, 4), round(c[2], 1)) for c in hb]
    if hb:
        t = 0.5 * max(abs(c[2]) for c in hb)
        strong = [c for c in hb if abs(c[2]) >= t]
        yb = min(c[0] for c in strong)
        inner_bottom = yb - oy
        conf["inner_bottom"] = round(min(1.0, max(abs(c[2]) for c in hb) / 40.0), 3)
    else:
        inner_bottom = geo["bottom"] - il * w
        conf["inner_bottom"] = 0.0
        flags.append("inner-bottom-missing")

    # --- dải tiêu đề: mép ô chữ (đường mạnh thấp nhất 12–42 % chiều cao từ đỉnh) và mép trên dải
    hh = find_hlines(g, xi0, xi1, top + 0.10 * Ht, top + 0.42 * Ht, angs, n=12, min_sep=3, valid=valid2)
    cands["header"] = [(round((c[0] - top) / Ht, 4), round(c[2], 1)) for c in hh]
    text_top = header_top = None
    if hh:
        smax = max(abs(c[2]) for c in hh)
        strong = [c for c in hh if abs(c[2]) >= 0.6 * smax]
        yt = max(c[0] for c in strong)
        text_top = yt - oy
        up = [c for c in hh if abs(c[2]) >= 0.45 * smax and yt - 0.14 * Ht <= c[0] <= yt - 0.035 * Ht]
        down = [c for c in hh if abs(c[2]) >= 0.45 * smax and yt + 0.035 * Ht <= c[0] <= yt + 0.14 * Ht]
        if up:
            header_top = max(c[0] for c in up) - oy
            conf["header"] = round(min(1.0, smax / 40.0), 3)
        elif down:
            # đường mạnh nhất là đường TRÊN của dải tiêu đề (đường dưới yếu hơn) → mép ô chữ = đường thấp nhất bên dưới
            header_top = yt - oy
            yt = max(c[0] for c in down)
            text_top = yt - oy
            conf["header"] = round(0.7 * min(1.0, smax / 40.0), 3)
            flags.append("header-from-top-line")
        else:
            conf["header"] = 0.3
            flags.append("header-top-missing")
        conf["text_top"] = round(min(1.0, smax / 40.0), 3)
    if text_top is None:
        text_top = geo["apex_y"] + 0.25 * Ht
        conf["text_top"] = 0.0
        flags.append("text-top-missing")
    if header_top is None:
        header_top = text_top - 0.08 * Ht

    # --- đỉnh vòm trong
    band = 0.5 * (il + ir) * w
    est = geo["apex_y"] + band
    cx = geo["cx"] + ox
    ha = find_hlines(g, cx - 0.12 * w, cx + 0.12 * w, est + oy - 0.02 * Ht, est + oy + 0.02 * Ht, angs, n=4, min_sep=3,
                     valid=valid2)
    if ha and abs(ha[0][2]) >= 15:
        inner_apex = min(ha, key=lambda c: abs(c[0] - oy - est))[0] - oy
        conf["inner_apex"] = 0.6
    else:
        inner_apex = est
        conf["inner_apex"] = 0.3
    out = dict(inner_left=inner_left, inner_right=inner_right, inner_bottom=inner_bottom, inner_apex=inner_apex,
               header_top=header_top, header_bottom=text_top)
    return out, conf, flags, cands


COLORS = {"outer": (255, 40, 40), "inner": (0, 200, 255), "header": (60, 255, 60), "spring": (255, 220, 0)}


def draw_landmarks(img, geo, inner, offset, k=1.0, lw=2):
    """Vẽ mốc (toạ độ r2) lên ảnh: điểm ảnh = (r2 + offset)·k."""
    d = ImageDraw.Draw(img)
    ox, oy = offset
    X = lambda x: (x + ox) * k
    Y = lambda y: (y + oy) * k
    L, R, B = geo["left"], geo["right"], geo["bottom"]
    xs = np.linspace(L, R, 160)
    ys = arch_y(xs, geo["arch"], geo["cx"], geo["hw"])
    poly = [(X(L), Y(B))] + [(X(x), Y(y)) for x, y in zip(xs, ys)] + [(X(R), Y(B)), (X(L), Y(B))]
    d.line(poly, fill=COLORS["outer"], width=lw)
    sp = geo["spring"]
    for x in (L, R):
        d.line([(X(x) - 14 * lw, Y(sp)), (X(x) + 14 * lw, Y(sp))], fill=COLORS["spring"], width=lw + 1)
    i = inner
    d.line([(X(i["inner_left"]), Y(i["header_top"])), (X(i["inner_left"]), Y(i["inner_bottom"])),
            (X(i["inner_right"]), Y(i["inner_bottom"])), (X(i["inner_right"]), Y(i["header_top"]))],
           fill=COLORS["inner"], width=lw)
    ax = geo["cx"]
    d.line([(X(ax) - 30 * lw, Y(i["inner_apex"])), (X(ax) + 30 * lw, Y(i["inner_apex"]))], fill=COLORS["inner"], width=lw)
    for yy in (i["header_top"], i["header_bottom"]):
        d.line([(X(i["inner_left"]), Y(yy)), (X(i["inner_right"]), Y(yy))], fill=COLORS["header"], width=lw)
    d.ellipse([X(ax) - 4 * lw, Y(geo["apex_y"]) - 4 * lw, X(ax) + 4 * lw, Y(geo["apex_y"]) + 4 * lw],
              outline=COLORS["outer"], width=lw)
    return img


# ======================================================================================
# 4. làm sạch + mặt nạ + bản đồ nét
# ======================================================================================

def flatten_and_clean(im_rgb, c):
    """Như bản 1442: chia ảnh mờ bán kính lớn (phẳng tông), giãn percentile, gamma + ấm nhẹ, khử hạt, unsharp."""
    w, h = im_rgb.size
    blur_r = max(8, int(min(w, h) * c["flatten_blur_frac"]))
    arr = np.asarray(im_rgb, dtype=np.float32)
    bg = np.asarray(im_rgb.filter(ImageFilter.GaussianBlur(blur_r)), dtype=np.float32)
    bg = np.clip(bg, 8, 255)
    flat = arr / bg
    mean_bg = bg.reshape(-1, 3).mean(axis=0)
    flat *= mean_bg[None, None, :]
    del arr, bg
    # giãn tương phản: một cặp percentile chung cho cả 3 kênh (như bản 1442 — giữ đúng tông ấm đã duyệt)
    sub = flat[::4, ::4]
    lo = float(np.percentile(sub, c["black_pct"]))
    hi = float(np.percentile(sub, c["white_pct"]))
    flat -= lo
    flat *= 255.0 / max(1e-3, hi - lo)
    np.clip(flat, 0, 255, out=flat)
    gain = np.array(c["warm_gain"], dtype=np.float32)
    flat = 255.0 * np.power(flat / 255.0, c["gamma"]) * gain[None, None, :]
    out = Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8), "RGB")
    del flat
    if c["denoise_radius"] > 0:
        out = out.filter(ImageFilter.GaussianBlur(c["denoise_radius"]))
    return out.filter(ImageFilter.UnsharpMask(radius=c["unsharp_radius"], percent=c["unsharp_percent"],
                                              threshold=c["unsharp_threshold"]))


def outer_polygon(geo, X, Y, n=240):
    L, R, B = geo["left"], geo["right"], geo["bottom"]
    xs = np.linspace(L, R, n)
    ys = arch_y(xs, geo["arch"], geo["cx"], geo["hw"])
    return [(X(L), Y(B))] + [(X(x), Y(y)) for x, y in zip(xs, ys)] + [(X(R), Y(B))]


def build_mask(size, poly, feather):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    if feather > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return m


def build_stroke_map(im_rgb, inside, s):
    """Kênh Blue trừ nền cục bộ → sigmoid. Độ lợi chuẩn hoá theo từng bia: phân vị `norm_pct` của tín hiệu dương
    (trong mặt nạ) → x = target_x. Trả (ảnh L, độ lợi, phân vị)."""
    w, h = im_rgb.size
    short = min(w, h)
    B_img = im_rgb.split()[2]
    pre = odd(max(1, short * s["pre_median_frac"]))
    if pre > 1:
        B_img = B_img.filter(ImageFilter.MedianFilter(pre))
    Barr = np.asarray(B_img, dtype=np.float32)
    large_r = max(4, int(short * s["large_blur_frac"]))
    local_bg = np.asarray(B_img.filter(ImageFilter.GaussianBlur(large_r)), dtype=np.float32)
    signal = (Barr - local_bg) / 255.0
    sel = signal[inside]
    pct = float(np.percentile(sel, s["norm_pct"])) if sel.size > 100 else 0.1
    gain = float(s["gain"]) if s.get("gain") else s["target_x"] / max(pct, 0.01)
    x = (signal - s["bias"]) * gain
    soft = 1.0 / (1.0 + np.exp(-x))
    out = Image.fromarray(np.clip(soft * 255.0 + 0.5, 0, 255).astype(np.uint8), "L")
    post = odd(max(1, short * s["post_median_frac"]))
    if post > 1:
        out = out.filter(ImageFilter.MedianFilter(post))
    return out, gain, pct


# ======================================================================================
# 5. xuất
# ======================================================================================

def load_config(path):
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return {k: v for k, v in data.items() if not k.startswith("$")}
    return {}


def merged_cfg(ov):
    cfg = copy.deepcopy(DEFAULTS)
    for k in ("edge_detect", "clean", "stroke", "arch", "output"):
        if isinstance(ov.get(k), dict):
            cfg[k].update(ov[k])
    for k in ("crop_pad_frac", "feather_frac", "shear_correct"):
        if k in ov:
            cfg[k] = ov[k]
    return cfg


def apply_overrides(geo, inner, ov, scale):
    """landmarks_override: toạ độ pixel ẢNH ĐÃ NẮN độ phân giải gốc (= r2 × scale) — xem 'rectified_px' trong json."""
    lo = ov.get("landmarks_override") or {}
    used = []
    g = lambda k: float(lo[k]) / scale
    for key, tgt in (("outer_left_x", "left"), ("outer_right_x", "right"), ("outer_bottom_y", "bottom")):
        if key in lo:
            geo[tgt] = g(key)
            used.append(key)
    if "outer_left_x" in lo or "outer_right_x" in lo:
        geo["cx"] = 0.5 * (geo["left"] + geo["right"])
        geo["hw"] = 0.5 * (geo["right"] - geo["left"])
    A = geo["arch"]
    if any(k in lo for k in ("arch_pq", "apex_y", "spring_y")) or ov.get("arch_symmetric"):
        A.pop("halves", None)
        geo["flags"] = [f for f in geo["flags"] if f != "arch-asymmetric"]
        if ov.get("arch_symmetric"):
            used.append("arch_symmetric")
    if "arch_pq" in lo:
        A["p"], A["q"] = float(lo["arch_pq"][0]), float(lo["arch_pq"][1])
        used.append("arch_pq")
    if "apex_y" in lo or "spring_y" in lo:
        apex = g("apex_y") if "apex_y" in lo else geo["apex_y"]
        if "spring_y" in lo:
            sp = g("spring_y")
            # chân vòm quy ước tại u = 1 − 0,0075/0,5 → giải ys, ay sao cho đỉnh = apex, F(u_s)·ay = ys − sp
            u_s = 1.0 - 0.015
            Fs = float(arch_F(np.array([u_s]), A["p"], A["q"])[0])
            ay = (sp - apex) / (1.0 - Fs)
            A["ys"], A["ay"] = apex + ay, ay
            used.append("spring_y")
        else:
            A["ys"] = apex + A["ay"]
        used.append("apex_y") if "apex_y" in lo else None
    geo["apex_y"] = A["ys"] - A["ay"]
    wd = geo["right"] - geo["left"]
    sl = float(arch_y(geo["left"] + 0.0075 * wd, A, geo["cx"], geo["hw"]))
    sr = float(arch_y(geo["right"] - 0.0075 * wd, A, geo["cx"], geo["hw"]))
    geo["spring_lr"] = (sl, sr)
    geo["spring"] = 0.5 * (sl + sr)
    for key, tgt in (("inner_left_x", "inner_left"), ("inner_right_x", "inner_right"), ("inner_bottom_y", "inner_bottom"),
                     ("inner_apex_y", "inner_apex"), ("header_top_y", "header_top"), ("header_bottom_y", "header_bottom")):
        if key in lo:
            inner[tgt] = g(key)
            used.append(key)
    return used


def mirror_cut_side(geo, inner, flags, cap=0.015):
    """Một bên khung bị ảnh chụp cắt (edge-fallback, mép = mép ảnh) và bên kia đo được: lấy bề rộng dải khung bên kia
    (mép ngoài → viền trong) đối xứng sang, nếu nó rộng hơn (khung thật nằm ngoài ảnh), tối đa `cap`·bề rộng."""
    fl = geo["flags"]
    w = geo["right"] - geo["left"]
    cut_l, cut_r = "edge-fallback-left" in fl, "edge-fallback-right" in fl
    if cut_l == cut_r or "inner-lr-missing" in flags:
        return
    if cut_l:
        band = geo["right"] - inner["inner_right"]
        new = inner["inner_left"] - band
        if geo["left"] - cap * w <= new < geo["left"]:
            geo["left"] = new
            flags.append("frame-mirrored-left")
    else:
        band = inner["inner_left"] - geo["left"]
        new = inner["inner_right"] + band
        if geo["right"] < new <= geo["right"] + cap * w:
            geo["right"] = new
            flags.append("frame-mirrored-right")
    if flags and flags[-1].startswith("frame-mirrored"):
        geo["cx"] = 0.5 * (geo["left"] + geo["right"])
        geo["hw"] = 0.5 * (geo["right"] - geo["left"])
        wd = geo["right"] - geo["left"]
        sl = float(arch_y(geo["left"] + 0.0075 * wd, geo["arch"], geo["cx"], geo["hw"]))
        sr = float(arch_y(geo["right"] - 0.0075 * wd, geo["arch"], geo["cx"], geo["hw"]))
        geo["spring_lr"] = (sl, sr)
        geo["spring"] = 0.5 * (sl + sr)
        geo["apex_y"] = float(arch_y(np.array([geo["cx"]]), geo["arch"], geo["cx"], geo["hw"])[0])


def frame_vs_photo(geo):
    """Khung ngoài (đã chốt) so với mép ảnh chụp: 'frame-outside-photo-*' = một phần khung nằm NGOÀI ảnh (bị cắt,
    mặt nạ ngoại suy), 'frame-at-photo-edge-*' = khung sát mép ảnh (≤ 2 px ảnh 1/4, chỉ để biết)."""
    W, H = geo["small_size"]
    ch = geo["chain"]
    L, R, B = geo["left"], geo["right"], geo["bottom"]
    xs = np.linspace(L, R, 80)
    parts = {
        "top": (xs, arch_y(xs, geo["arch"], geo["cx"], geo["hw"])),
        "left": (np.full(40, L), np.linspace(geo["spring"], B, 40)),
        "right": (np.full(40, R), np.linspace(geo["spring"], B, 40)),
        "bottom": (xs, np.full(80, B)),
    }
    flags = []
    for name, (u, v) in parts.items():
        x, y = ch.r2_to_src(u, v)
        out = np.maximum.reduce([-x, x - (W - 1), -y, y - (H - 1)])
        worst = float(np.max(out))
        if worst > 1.5:
            flags.append("frame-outside-photo-%s(%.1f%%)" % (name, 100 * worst / max(W, H)))
        elif worst > -2.0:
            flags.append("frame-at-photo-edge-" + name)
    return flags


def process(year, src_root, out_dir, masters_dir, sheets_dir, config, pick=None, analysis_only=False):
    t0 = time.time()
    steles = list_steles(src_root)
    info = steles[year]
    ov = config.get(year, {})
    cfg = merged_cfg(ov)
    pick = pick or pick_clean(src_root, info)
    clean_file = ov.get("source") or pick["clean"]
    src_path = os.path.join(src_root, info["folder"], clean_file)

    small, geo, img2, valid2 = analyze(src_path, cfg, ov)
    inner, iconf, iflags, cands = detect_inner(img2, valid2, geo, ov)
    scale = geo["scale"]
    mirror_cut_side(geo, inner, iflags)
    used = apply_overrides(geo, inner, ov, scale)
    used = [k for k in ("source", "control_points", "no_shear", "shear", "bottom_from_scan", "arch", "edge_detect",
                        "clean", "stroke", "output") if k in ov] + used

    # --- khung cắt (r2, toạ độ liên tục ảnh nhỏ) và kích thước ảnh gốc đã nắn
    w = geo["right"] - geo["left"]
    pad = cfg["crop_pad_frac"] * w
    u0, v0 = geo["left"] - pad + 0.5, geo["apex_y"] - pad + 0.5
    u1, v1 = geo["right"] + pad + 0.5, geo["bottom"] + pad + 0.5
    MW, MH = int(round((u1 - u0) * scale)), int(round((v1 - v0) * scale))
    u1, v1 = u0 + MW / scale, v0 + MH / scale  # master px = (r2 + 0,5 − u0)·scale chính xác
    nx = lambda x: (x + 0.5 - u0) / (u1 - u0)  # r2 (chỉ số ảnh nhỏ) → chuẩn hoá trong ảnh cắt
    ny = lambda y: (y + 0.5 - v0) / (v1 - v0)

    A = geo["arch"]
    prof_x = np.linspace(geo["left"], geo["right"], 41)
    prof_y = arch_y(prof_x, A, geo["cx"], geo["hw"])
    lm = {
        "outer_frame": {
            "left": r4(nx(geo["left"])), "right": r4(nx(geo["right"])), "bottom": r4(ny(geo["bottom"])),
            "arch_apex": [r4(nx(geo["cx"])), r4(ny(geo["apex_y"]))], "spring_y": r4(ny(geo["spring"])),
            "spring_y_left": r4(ny(geo["spring_lr"][0])), "spring_y_right": r4(ny(geo["spring_lr"][1])),
            "arch_profile_y": [r4(ny(v)) for v in prof_y],
        },
        "inner_border": {
            "left": r4(nx(inner["inner_left"])), "right": r4(nx(inner["inner_right"])),
            "bottom": r4(ny(inner["inner_bottom"])), "apex": [r4(nx(geo["cx"])), r4(ny(inner["inner_apex"]))],
        },
        "header_band": {
            "top": r4(ny(inner["header_top"])), "bottom": r4(ny(inner["header_bottom"])),
            "left": r4(nx(inner["inner_left"])), "right": r4(nx(inner["inner_right"])),
        },
        "text_field": {
            "top": r4(ny(inner["header_bottom"])), "bottom": r4(ny(inner["inner_bottom"])),
            "left": r4(nx(inner["inner_left"])), "right": r4(nx(inner["inner_right"])),
        },
    }
    conf = dict(geo["conf"])
    conf.update(iconf)
    flags = list(dict.fromkeys(geo["flags"] + iflags + frame_vs_photo(geo)))
    low = [k for k, v in conf.items() if v < 0.35 and k != "inner_apex"]
    if used:
        flags.append("override:" + ",".join(used))
    rec = {
        "stele": "bia-" + year, "stt": info["stt"], "folder": info["folder"], "source_file": clean_file,
        "pick": pick, "confidence": conf, "low_confidence": low, "flags": flags,
        "arch_model": {"p": A["p"], "q": A["q"], "halves": A.get("halves")},
        "shear": geo.get("shear"), "bottom_line": geo.get("bottom_line"), "inner_candidates": cands,
        "master_size": [MW, MH], "landmarks_normalized": lm,
    }
    if analysis_only:
        if sheets_dir:
            os.makedirs(os.path.join(sheets_dir, "analysis"), exist_ok=True)
            im = img2.copy()
            draw_landmarks(im, geo, inner, geo["offset"], 1.0, 2)
            head = Image.new("RGB", (im.width, 28), (28, 28, 28))
            d = ImageDraw.Draw(head)
            fl = [f for f in flags if "photo-edge" not in f]
            d.text((4, 4), "bia-%s %s %s" % (year, ("LOW " + ",".join(low)) if low else "", " ".join(fl)), fill=(255, 255, 0),
                   font=_font(16))
            cell = Image.new("RGB", (im.width, im.height + 28))
            cell.paste(head, (0, 0))
            cell.paste(im, (0, 28))
            cell.save(os.path.join(sheets_dir, "analysis", "cell-%s.jpg" % year), quality=85)
        rec["time_s"] = round(time.time() - t0, 1)
        return rec, (small, geo, img2, inner)

    # --- ảnh gốc đã nắn + cắt (một lần lấy mẫu từ ảnh gốc)
    full = Image.open(src_path).convert("RGB")
    fill = tuple(int(v) for v in np.median(np.asarray(small, np.uint8).reshape(-1, 3), axis=0))
    master_raw = warp_mesh(full, geo["chain"], (u0, v0, u1, v1), (MW, MH), src_scale=scale, step=64, fill=fill)
    del full
    cleaned = flatten_and_clean(master_raw, cfg["clean"])
    del master_raw
    k = MW / (u1 - u0)
    X = lambda x: (x + 0.5 - u0) * k
    Y = lambda y: (y + 0.5 - v0) * k
    poly = outer_polygon(geo, X, Y)

    # --- bản đồ nét: tính ở 2× cỡ xuất (đủ mịn, nhanh) rồi thu về cỡ xuất
    long_side = cfg["output"]["long_side"]
    s_out = long_side / max(MW, MH)
    OW, OH = int(round(MW * s_out)), int(round(MH * s_out))
    s_work = min(1.0, 2.0 * s_out)
    WW, WH = int(round(MW * s_work)), int(round(MH * s_work))
    work = cleaned.resize((WW, WH), Image.LANCZOS) if s_work < 1.0 else cleaned
    poly_w = [(x * s_work, y * s_work) for x, y in poly]
    mask_w = build_mask((WW, WH), poly_w, 0)
    inside = np.asarray(mask_w) > 127
    st_cfg = dict(cfg["stroke"])
    stroke_w, gain, pct = build_stroke_map(work, inside, st_cfg)
    rec["stroke_gain"] = round(gain, 2)
    rec["stroke_signal_pct"] = round(pct, 4)

    feather_full = cfg["feather_frac"] * MW
    poly_o = [(x * s_out, y * s_out) for x, y in poly]
    alpha_o = build_mask((OW, OH), poly_o, feather_full * s_out)
    stroke_o = stroke_w.resize((OW, OH), Image.LANCZOS)
    floor = int(round(cfg["stroke"]["floor"] * 255))
    sa = np.asarray(stroke_o, np.uint8).copy()
    sa[sa < floor] = floor
    am = np.asarray(alpha_o, np.uint8)
    sa[am == 0] = floor
    stroke_o = Image.fromarray(sa, "L")

    os.makedirs(out_dir, exist_ok=True)
    webp_path = os.path.join(out_dir, "bia-%s.webp" % year)
    rgba = Image.merge("RGBA", (stroke_o, stroke_o, stroke_o, alpha_o))
    rgba.save(webp_path, "WEBP", quality=cfg["output"]["quality"], method=cfg["output"]["method"], exact=False)

    # master màu (chỉ để tái xuất — không giao): JPEG q95 4:4:4 (mặt nạ = đa giác trong json)
    if masters_dir:
        os.makedirs(masters_dir, exist_ok=True)
        cleaned.save(os.path.join(masters_dir, "bia-%s-master.jpg" % year), quality=95, subsampling=0)

    json_data = {
        "stele": "bia-" + year,
        "format": "bia-<năm>.webp: xám + alpha — độ sáng (R=G=B) = bản đồ nét (nền ≈ %.2f, nét → 1; shader lấy ngưỡng "
                  "~0,54→0,8), alpha = mặt nạ khung ngoài (vòm). Toạ độ chuẩn hoá u,v ∈ 0..1, gốc trên-trái, theo "
                  "ảnh này (cũng = ảnh master)." % cfg["stroke"]["floor"],
        "source_file": clean_file,
        "output_size": {"width": OW, "height": OH},
        "master_size": {"width": MW, "height": MH},
        "perspective_control_points_src_px": {
            kk: [r1((vv[0] + 0.5) * scale - 0.5), r1((vv[1] + 0.5) * scale - 0.5)] for kk, vv in geo["cps_small"].items()},
        "rectify": {
            "control_points_from": geo["cp_src"],
            "shear_refs": [[r1(c * scale), round(math.degrees(math.atan(t)), 3)] for c, t in (geo["chain"].refs or [])],
            "rectified_px_origin": [r1((u0 - 0.5) * scale), r1((v0 - 0.5) * scale)],
            "rectified_px_note": "landmarks_override (rubbings-config.json) dùng toạ độ 'rectified px' = master px + origin",
        },
        "arch_model": {"p": A["p"], "q": A["q"], "asymmetric": bool(A.get("halves")),
                       "formula": "y = spring0 − (spring0 − apex)·(1 − |u|^p)^(1/q), u = (x − cx)/(nửa bề rộng); "
                                  "landmarks_normalized.outer_frame.arch_profile_y = mép vòm lấy mẫu tại 41 điểm "
                                  "cách đều từ left → right (đã gồm vòm hai nửa lệch nếu có) — dùng cái này"},
        "confidence": conf,
        "flags": flags,
        "landmarks_normalized": lm,
    }
    with open(os.path.join(out_dir, "bia-%s.json" % year), "w", encoding="utf-8") as fh:
        json.dump(json_data, fh, ensure_ascii=False, indent=1)

    # --- tờ đối chiếu từng bia
    if sheets_dir:
        os.makedirs(os.path.join(sheets_dir, "stele"), exist_ok=True)
        sheet = contact_sheet(src_path, small, cleaned, alpha_o, stroke_o, geo, inner, (u0, v0, k), year, rec)
        sheet.save(os.path.join(sheets_dir, "stele", "bia-%s.jpg" % year), quality=84)
        # ảnh nhỏ dùng cho trang tổng
        cell = review_cell(cleaned, alpha_o, stroke_o, geo, inner, (u0, v0, k), year, rec)
        cell.save(os.path.join(sheets_dir, "stele", "cell-%s.jpg" % year), quality=88)
    rec["output_bytes"] = os.path.getsize(webp_path)
    rec["output_size"] = [OW, OH]
    rec["time_s"] = round(time.time() - t0, 1)
    return rec, None


def checker(size, cs=24):
    im = Image.new("RGB", size, (60, 60, 60))
    d = ImageDraw.Draw(im)
    for yy in range(0, size[1], cs):
        for xx in range(0, size[0], cs):
            if ((xx // cs) + (yy // cs)) % 2 == 0:
                d.rectangle([xx, yy, xx + cs - 1, yy + cs - 1], fill=(85, 85, 85))
    return im


def _font(sz):
    for p in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def lm_panel(cleaned, geo, inner, crop, ph, lw=2):
    u0, v0, k = crop
    s = ph / cleaned.height
    base = cleaned.resize((int(round(cleaned.width * s)), ph), Image.LANCZOS)
    kk = k * s
    draw_landmarks(base, geo, inner, (0.5 - u0, 0.5 - v0), kk, lw)
    return base


def contact_sheet(src_path, small, cleaned, alpha_o, stroke_o, geo, inner, crop, year, rec, ph=1000):
    def rh(im, h):
        return im.resize((max(1, int(round(im.width * h / im.height))), h), Image.LANCZOS)
    p1 = rh(small, ph)
    c = rh(cleaned, ph).convert("RGBA")
    a = alpha_o.resize(c.size, Image.LANCZOS)
    c.putalpha(a)
    p2 = Image.alpha_composite(checker(c.size).convert("RGBA"), c).convert("RGB")
    p3 = stroke_o.resize(c.size, Image.LANCZOS).convert("RGB")
    p3 = Image.composite(p3, Image.new("RGB", p3.size, (0, 0, 0)), a)
    p4 = lm_panel(cleaned, geo, inner, crop, ph)
    gap = 8
    head = 46
    W_ = p1.width + p2.width + p3.width + p4.width + 3 * gap
    sheet = Image.new("RGB", (W_, ph + head), (28, 28, 28))
    x = 0
    for p in (p1, p2, p3, p4):
        sheet.paste(p, (x, head))
        x += p.width + gap
    d = ImageDraw.Draw(sheet)
    f = _font(18)
    d.text((8, 4), "bia-%s  %s  conf %s" % (year, rec["source_file"], ", ".join("%s %.2f" % kv for kv in rec["confidence"].items())), fill=(255, 255, 255), font=f)
    d.text((8, 25), "flags: %s" % (", ".join(rec["flags"]) or "—"), fill=(255, 210, 0), font=f)
    return sheet


def review_cell(cleaned, alpha_o, stroke_o, geo, inner, crop, year, rec, ph=1100):
    p1 = lm_panel(cleaned, geo, inner, crop, ph, lw=2)
    a = alpha_o.resize((p1.width, ph), Image.LANCZOS)
    st_ = stroke_o.resize((p1.width, ph), Image.LANCZOS).convert("RGB")
    p2 = Image.composite(st_, Image.new("RGB", st_.size, (0, 0, 60)), a)
    head = 30
    cell = Image.new("RGB", (p1.width * 2 + 6, ph + head), (28, 28, 28))
    cell.paste(p1, (0, head))
    cell.paste(p2, (p1.width + 6, head))
    d = ImageDraw.Draw(cell)
    low = rec["low_confidence"]
    fl = [f for f in rec["flags"] if not f.startswith("override")]
    txt = "bia-%s" % year + ("   LOW: " + ",".join(low) if low else "") + ("   " + ",".join(fl) if fl else "")
    d.text((6, 5), txt, fill=(255, 255, 255) if not low else (255, 120, 120), font=_font(18))
    return cell


# ======================================================================================
# CLI
# ======================================================================================

def _job(args):
    year, src, out, masters, sheets, config, analysis_only = args
    try:
        rec, _ = process(year, src, out, masters, sheets, config, analysis_only=analysis_only)
        return year, rec, None
    except Exception as e:  # báo lỗi, không dừng cả lô
        import traceback
        return year, None, "%s\n%s" % (e, traceback.format_exc())


def make_pages(sheets_dir, years, cols=3, rows=2):
    cells = [(y, os.path.join(sheets_dir, "stele", "cell-%s.jpg" % y)) for y in years]
    cells = [(y, p) for y, p in cells if os.path.exists(p)]
    per = cols * rows
    pages = []
    for old in os.listdir(sheets_dir):
        if old.startswith("page-") and old.endswith(".jpg"):
            os.remove(os.path.join(sheets_dir, old))
    for pi in range(0, len(cells), per):
        chunk = cells[pi:pi + per]
        ims = [Image.open(p) for _, p in chunk]
        cw = max(im.width for im in ims)
        ch = max(im.height for im in ims)
        sheet = Image.new("RGB", (cols * cw + (cols - 1) * 12, rows * ch + (rows - 1) * 12), (12, 12, 12))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % cols) * (cw + 12), (i // cols) * (ch + 12)))
        name = os.path.join(sheets_dir, "page-%02d_%s-%s.jpg" % (pi // per + 1, chunk[0][0], chunk[-1][0]))
        sheet.save(name, quality=85)
        pages.append(name)
    return pages


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--work", default=WORK, help="thư mục làm việc (out/, masters/, sheets/, manifest.json)")
    ap.add_argument("--config", default=None, help="mặc định <work>/rubbings-config.json")
    ap.add_argument("--only", default=None, help="danh sách năm, cách nhau dấu phẩy")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--jobs", type=int, default=1)
    ap.add_argument("--analysis", action="store_true", help="chỉ dò mốc (không làm ảnh gốc)")
    ap.add_argument("--no-masters", action="store_true")
    args = ap.parse_args()

    work = os.path.abspath(args.work)
    out = os.path.join(work, "out")
    masters = None if args.no_masters else os.path.join(work, "masters")
    sheets = os.path.join(work, "sheets")
    config = load_config(args.config or os.path.join(work, "rubbings-config.json"))
    steles = list_steles(args.src)
    if args.only:
        years = [y.strip() for y in args.only.split(",") if y.strip()]
    elif args.all:
        years = sorted(steles)
    else:
        ap.error("cần --only hoặc --all")
    jobs = [(y, args.src, out, masters, sheets, config, args.analysis) for y in years]
    results, errors = {}, {}
    if args.jobs > 1:
        from concurrent.futures import ProcessPoolExecutor
        with ProcessPoolExecutor(max_workers=args.jobs) as ex:
            for y, rec, err in ex.map(_job, jobs):
                print(y, "ERROR" if err else "ok", (rec or {}).get("time_s", ""), flush=True)
                (errors if err else results)[y] = err or rec
    else:
        for j in jobs:
            y, rec, err = _job(j)
            print(y, "ERROR" if err else "ok", (rec or {}).get("time_s", ""), flush=True)
            (errors if err else results)[y] = err or rec
    for y, e in errors.items():
        print("---", y, e, file=sys.stderr)

    if args.analysis:
        for y in sorted(results):
            r = results[y]
            print(y, r["flags"], r["low_confidence"], r["confidence"].get("arch"))
        adir = os.path.join(sheets, "analysis")
        cells = sorted(f for f in os.listdir(adir) if f.startswith("cell-"))
        for old in os.listdir(adir):
            if old.startswith("page-"):
                os.remove(os.path.join(adir, old))
        for pi in range(0, len(cells), 6):
            ims = [Image.open(os.path.join(adir, c)) for c in cells[pi:pi + 6]]
            hh = max(i.height for i in ims)
            ims = [i.resize((int(i.width * hh / i.height), hh)) for i in ims]
            W_ = sum(i.width + 8 for i in ims)
            pg = Image.new("RGB", (W_, hh), (0, 0, 0))
            x = 0
            for i in ims:
                pg.paste(i, (x, 0))
                x += i.width + 8
            pg.save(os.path.join(adir, "page-%02d.jpg" % (pi // 6 + 1)), quality=85)
        return

    # manifest: gộp với bản cũ (chạy --only không xoá bia khác); bỏ trường thời gian (tất định)
    man_path = os.path.join(work, "manifest.json")
    man = {"steles": {}}
    if os.path.exists(man_path):
        with open(man_path, encoding="utf-8") as fh:
            man = json.load(fh)
    for y, r in results.items():
        r = {k: v for k, v in r.items() if k not in ("time_s", "inner_candidates")}
        man["steles"]["bia-" + y] = r
    man["steles"] = dict(sorted(man["steles"].items()))
    st = man["steles"].values()
    man["summary"] = {
        "count": len(man["steles"]),
        "auto": sorted(k for k, v in man["steles"].items() if not any(f.startswith("override") for f in v["flags"])),
        "with_overrides": sorted(k for k, v in man["steles"].items() if any(f.startswith("override") for f in v["flags"])),
        "low_confidence": {k: v["low_confidence"] for k, v in man["steles"].items() if v["low_confidence"]},
        "pick_ambiguous": sorted(k for k, v in man["steles"].items() if v["pick"]["flags"]),
        "total_output_bytes": int(sum(v.get("output_bytes", 0) for v in st)),
    }
    man["$doc"] = ("Ảnh sạch chọn tự động (điểm ảnh nhận dạng = % trắng gần thuần + % ngả xanh, ảnh 1/8), độ tin "
                   "từng mốc (0..1), cờ. Sinh bởi tools/rubbing_clean.py — không sửa tay.")
    with open(man_path, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(man.items())), fh, ensure_ascii=False, indent=1)
    all_years = sorted(k[4:] for k in man["steles"])
    pages = make_pages(sheets, all_years)
    print("pages:", len(pages), "errors:", len(errors))


if __name__ == "__main__":
    main()
