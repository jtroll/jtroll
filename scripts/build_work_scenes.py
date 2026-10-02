"""Build the Work carousel's animated-scene layers (assets/scenes/).

    python3 scripts/build_work_scenes.py RAW_DIR

RAW_DIR holds layer exports from the portfolio Figma file (Scratch page),
exported as PNG with the other layers hidden:
  rl/plate.png          work_01_rl, rings (Ellipse 1/2) hidden, 3x
  premeta/shield.png, robot.png, ideo.png      the three logos, 3x
  mada/<name>.png       work_05_mada layers, 2x: forbes motherjones glenn oprah
                        npr usatoday bbc nyt logo, leaves (Carrot mic > Leaves)
                        and mic (Carrot mic with Leaves hidden)
  sofi/plate_raw.png    work_00_sofi with the hand hidden, 2x
  sofi/hand.png         the hand, 2x
Cruise is a single photo, so it is cut from assets/work_cruise.webp.

Every scene recomposites to its flat assets/work_*.webp at rest; the box
numbers printed here are what assets/work-scenes.js uses.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'scenes')


def load(path, mode='RGBA'):
    return np.asarray(Image.open(path).convert(mode)).astype(np.float32)


def save(arr, name, plate=False, lossless=False):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = Image.fromarray(np.clip(arr, 0, 255).round().astype('uint8'))
    if lossless:
        im.save(path, 'WEBP', lossless=True, method=6)
    elif plate:
        im.convert('RGB').save(path, 'WEBP', quality=90, method=6)
    else:
        im.convert('RGBA').save(path, 'WEBP', quality=92, alpha_quality=100, method=6)


def fill_holes(mask):
    ff = mask.astype(np.uint8).copy()
    cv2.floodFill(ff, np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), np.uint8), (0, 0), 1)
    return mask.astype(np.uint8) | (1 - ff)


# ---------- Neural interfaces: rings drawn unclipped ----------
# Figma clips the outer ring at the frame edge, which would show when it
# swells, so both are redrawn: 24px inside-aligned strokes, layer blur
# (Figma radius 12 ~ sigma 5), at the strength fitted to Figma's own render.
def ring(w, h, rot, col, k, scale=3, ss=4, stroke=24, sigma=5, pad=90):
    ext = max(w, h) / 2 + stroke + pad / scale
    size = int(np.ceil(ext * 2 * scale))
    hi = np.zeros((size * ss, size * ss), np.uint8)
    axes = (int(round((w / 2 - 12) * scale * ss)), int(round((h / 2 - 12) * scale * ss)))
    cv2.ellipse(hi, (size * ss // 2, size * ss // 2), axes, -rot, 0, 360, 255,
                thickness=int(round(stroke * scale * ss)), lineType=cv2.LINE_AA)
    a = cv2.resize(hi.astype(np.float32) / 255, (size, size), interpolation=cv2.INTER_AREA)
    a = cv2.GaussianBlur(a, (0, 0), sigma * scale) * k
    ys, xs = np.where(a > 1 / 512)
    c = size / 2  # trim symmetrically about the center, so it stays centered
    ry = max(c - ys.min(), ys.max() + 1 - c)
    rx = max(c - xs.min(), xs.max() + 1 - c)
    a = a[int(np.floor(c - ry)):int(np.ceil(c + ry)), int(np.floor(c - rx)):int(np.ceil(c + rx))]
    return np.dstack([np.full_like(a, v * 255) for v in col] + [a * 255])


def build_rl(raw):
    save(load(f'{raw}/rl/plate.png', 'RGB'), 'rl/plate.webp', plate=True)
    cx, cy = 284.1, 194.45  # ring center, in the 580x386 frame
    for name, (w, h, col, k) in {
        'ring-inner': (79.15234375, 285.5302734375, (0.4625, 0.04625, 0.37522), 0.1896),
        'ring-outer': (146.0596923828125, 389.81707763671875, (0.52448, 0.01979, 0.79167), 0.0948),
    }.items():
        im = ring(w, h, 18.69710866688, col, k)
        H, W = im.shape[:2]
        print(name, 'box %', [round(v, 3) for v in (
            (cx * 3 - W / 2) / 1740 * 100, (cy * 3 - H / 2) / 1158 * 100, W / 1740 * 100, H / 1158 * 100)])
        save(im, f'rl/{name}.webp')


# ---------- Pre-Meta: the shield gets a page-coloured fill ----------
def build_premeta(raw):
    s = load(f'{raw}/premeta/shield.png')
    inside = fill_holes(s[..., 3] > 8) - (s[..., 3] > 8)
    a = s[..., 3:] / 255
    rgb = s[..., :3] * a + np.array([250, 248, 245], np.float32) * (1 - a)
    save(np.dstack([rgb, np.maximum(s[..., 3], inside * 255)]), 'premeta/shield.webp')
    for n in ('robot', 'ideo'):
        save(load(f'{raw}/premeta/{n}.png'), f'premeta/{n}.webp')


def build_mada(raw):
    for n in ('forbes', 'motherjones', 'glenn', 'oprah', 'npr', 'usatoday', 'bbc', 'nyt', 'logo', 'leaves', 'mic'):
        save(load(f'{raw}/mada/{n}.png'), f'mada/{n}.webp')


# ---------- SoFi: lift the hand's shadow out of the photo ----------
def build_sofi(raw):
    P = load(f'{raw}/sofi/plate_raw.png', 'RGB')
    H, W = P.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    hsv = cv2.cvtColor(P.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    coral = ((hsv[..., 0] < 12) | (hsv[..., 0] > 170)) & (hsv[..., 1] > 80)
    V = P.max(2)
    # lighting of the coral field: a smooth fit to its lit pixels
    lit = coral & (V > 215)
    X = np.stack([np.ones_like(xx), xx / W, yy / H, (xx / W) ** 2, (yy / H) ** 2, xx / W * yy / H], -1)
    field = np.zeros_like(P)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(X[lit], P[..., c][lit], rcond=None)
        field[..., c] = X @ coef
    # the phone's shadow is a tilted rounded rectangle; the hand's shadow
    # hangs below its bottom edge
    line = 623 + 0.52 * (xx - 695)
    shad = (coral & (yy > line + 3) & (V < field.max(2) - 12)).astype(np.uint8)
    shad = cv2.morphologyEx(shad, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(shad)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 200]).astype(np.uint8)
    m = cv2.dilate(keep, np.ones((7, 7), np.uint8)).astype(np.float32)
    m *= (coral | cv2.dilate(coral.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool))
    m *= np.clip((yy - (line + 1)) / 4, 0, 1)
    m = cv2.GaussianBlur(m, (0, 0), 1.2)
    # repaint: the lighting fit plus grain matched to the photo's
    patch = (P - field)[700:770, 880:1150]
    sd = patch.std((0, 1))
    rng = np.random.default_rng(7)
    n1 = cv2.GaussianBlur(rng.normal(size=(H, W)).astype(np.float32), (0, 0), 0.7)
    n3 = cv2.GaussianBlur(rng.normal(size=(H, W, 3)).astype(np.float32), (0, 0), 0.7)
    grain = (n1 / n1.std())[..., None] * sd * 0.85 + n3 / n3.std() * sd * 0.5
    C = P * (1 - m[..., None]) + (field + grain) * m[..., None]
    C = np.where(m[..., None] > 0, np.maximum(C, P), C)  # never darker than the photo
    save(C, 'sofi/plate.webp', plate=True)
    # the shadow layer, drawn with "darken": the photo's own pixels, plus a
    # short run up into the phone's shadow so small lifts open no seam
    col = P.copy()
    ext = np.zeros_like(m)
    for x in range(500, 720):
        yc = int(np.ceil(line[0, x] + 5))
        if yc < H and m[yc, x] >= 0.5:
            col[yc - 26:yc, x] = P[yc, x]
            ext[yc - 26:yc, x] = 1
    coralE = cv2.erode(coral.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    ext = cv2.GaussianBlur(ext * coralE, (0, 0), 1.0) * coralE
    alpha = np.clip(cv2.GaussianBlur(cv2.dilate(m, np.ones((5, 5), np.uint8)), (0, 0), 1.5), 0, 1)
    alpha *= cv2.GaussianBlur(cv2.dilate(coral.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1)
    alpha = np.maximum(alpha, ext)
    alpha = np.where(m > 0, 1, alpha)
    col = np.where(alpha[..., None] > 0, np.maximum(col, P), col)
    ys, xs = np.where(alpha > 0.004)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    print('sofi shadow box px', x0, y0, x1 - x0, y1 - y0, 'of', W, H)
    save(np.dstack([col, alpha * 255])[y0:y1, x0:x1], 'sofi/shadow.webp', lossless=True)
    # the hand runs on 42px below the frame
    h = load(f'{raw}/sofi/hand.png')
    last = h[-3].copy()
    last[..., 3] = np.where(last[..., 3] > 8, 255, 0)
    save(np.concatenate([h[:-2], np.repeat(last[None], 42, 0)], 0), 'sofi/hand.webp')


# ---------- Cruise: cut the car out of the photo ----------
def build_cruise():
    P = load(os.path.join(ROOT, 'assets', 'work_cruise.webp'), 'RGB')
    H, W = P.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    flat = np.array([22, 29, 40], np.float32)  # the backdrop above the floor
    body = ((np.abs(P - flat).max(2) > 9) & (yy >= 230) & (yy <= 556) & (xx >= 180) & (xx <= 960)).astype(np.uint8)
    body = cv2.morphologyEx(body, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(body)
    body = fill_holes(lab == 1 + np.argmax(st[1:, 4])).astype(np.float32)
    # contact shadow under the car rides along with it (kept clear of the logo)
    x0, x1 = 196, 905
    sk = ((xx >= x0) & (xx <= x1) & (yy >= 480) & (yy <= 606)).astype(np.float32)
    sk *= np.clip((606 - yy) / 44, 0, 1) * np.clip((xx - x0) / 28, 0, 1) * np.clip((x1 - xx) / 28, 0, 1)
    alpha = np.clip(np.maximum(cv2.GaussianBlur(cv2.dilate(body, np.ones((5, 5), np.uint8)), (0, 0), 1.0), sk), 0, 1)
    # plate: inpaint the hole at quarter size (smooth), backdrop exact above the floor
    hole = ((cv2.dilate(body, np.ones((13, 13), np.uint8)) > 0) | (sk > 0.002)).astype(np.uint8)
    src = P.copy()
    src[((xx - 998) ** 2 + (yy - 612) ** 2) < 74 ** 2] = np.median(P[(yy > 600) & (yy < 680) & (xx > 860) & (xx < 920)], 0)
    small = cv2.resize(src, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    hs = cv2.dilate(cv2.resize(hole, (W // 4, H // 4), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
    inp = cv2.GaussianBlur(cv2.inpaint(np.clip(small, 0, 255).astype(np.uint8), hs, 6, cv2.INPAINT_TELEA).astype(np.float32), (0, 0), 1.5)
    up = cv2.resize(inp, (W, H), interpolation=cv2.INTER_CUBIC)
    wf = np.clip((yy - 470) / 90, 0, 1)[..., None]
    fill = flat * (1 - wf) + up * wf + np.random.default_rng(3).normal(size=(H, W, 1)).astype(np.float32) * 0.75 * wf
    reg = np.clip(cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 2.5), 0, 1)[..., None]
    save(P * (1 - reg) + fill * reg, 'cruise/plate.webp', plate=True)
    ys, xs = np.where(alpha > 0.004)
    cx0, cx1, cy0, cy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    print('cruise car box px', cx0, cy0, cx1 - cx0, cy1 - cy0)
    save(np.dstack([P, alpha * 255])[cy0:cy1, cx0:cx1], 'cruise/car.webp')

    def disc(cx, cy, R, feather, name, box=None):
        if box:
            X0, Y0, X1, Y1 = box[0], box[1], box[0] + box[2], box[1] + box[3]
        else:
            X0, Y0 = int(np.floor(cx - R - 2)), int(np.floor(cy - R - 2))
            X1, Y1 = int(np.ceil(cx + R + 2)), int(np.ceil(cy + R + 2))
        ry, rx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
        a = np.clip((R - np.sqrt((rx - cx) ** 2 + (ry - cy) ** 2)) / feather + 0.5, 0, 1)
        print(name, 'box px', X0, Y0, X1 - X0, Y1 - Y0)
        save(np.dstack([P[Y0:Y1, X0:X1], a * 255]), name)

    # hubs (four-fold; centers found by rotational self-match), 47px radius
    disc(334.5, 499.0, 47, 2, 'cruise/wheel-rear.webp')
    disc(814.5, 499.0, 47, 2, 'cruise/wheel-front.webp')
    disc(1007.5, 619.5, 83.5, 3, 'cruise/logo.webp', box=(921, 533, 174, 174))


if __name__ == '__main__':
    raw = sys.argv[1]
    build_rl(raw)
    build_premeta(raw)
    build_mada(raw)
    build_sofi(raw)
    build_cruise()
