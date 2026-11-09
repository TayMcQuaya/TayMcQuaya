#!/usr/bin/env python3
"""One-off: cuts the girl out of images/art10.gif, frame by frame, for the cube character on the home page.

    python3 tools/cutout_schoolgirl.py        (needs: pip install pillow numpy scipy)

writes assets/voxel/schoolgirl.png: every frame of her alone on a see-through background, side by side in one
picture, at her drawn size (one pixel per drawn pixel) and in a fixed set of colours. It prints the line to put
in data/projects.js; tools/build_media.py then turns the picture into data/voxel.js.

The numbers in here are tuned by eye for this one drawing. For another artwork with a busy background they will
need changing; an artwork on a flat background needs none of this (build_media.py reads it directly).
"""
import os
import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SRC, OUT = 'images/art10.gif', 'assets/voxel/schoolgirl.png'
P = 3                               # one drawn pixel is 3x3 screen pixels
BOX = (70, 48, 134, 182)            # where she stands, in drawn pixels: left, top, right, bottom
S8 = np.ones((3, 3), bool)

im = Image.open(SRC)
raw = [np.asarray(f.convert('RGB')).astype(np.int32) for f in ImageSequence.Iterator(im)]
ms = im.info.get('duration', 100)

# line the 3x3 grid up with the drawing, then shrink every frame to drawn pixels (the middle value of each block)
best = None
for oy in range(P):
    for ox in range(P):
        b = raw[0][oy:oy + P * 180, ox:ox + P * 190].reshape(180, P, 190, P, 3)
        v = np.abs(b - b[:, 1:2, :, 1:2, :]).sum()
        if best is None or v < best[0]:
            best = (v, ox, oy)
_, ox, oy = best


def drawn(a):
    h, w = (a.shape[0] - oy) // P, (a.shape[1] - ox) // P
    b = a[oy:oy + h * P, ox:ox + w * P].reshape(h, P, w, P, 3).transpose(0, 2, 1, 3, 4).reshape(h, w, P * P, 3)
    return np.median(b, axis=2).astype(np.int32)


x0, y0, x1, y1 = BOX
C = np.array([drawn(a)[y0:y1, x0:x1] for a in raw])
F, H, W, _ = C.shape
lum = lambda c: (c[..., 0] * 299 + c[..., 1] * 587 + c[..., 2] * 114) // 1000
green = lambda c: (c[..., 1] > c[..., 0] + 22) & (c[..., 1] > c[..., 2] + 22)
skin = lambda c: (c[..., 0] > 205) & (c[..., 0] - c[..., 2] > 45) & (c[..., 1] > 150)


def biggest(m):
    lab, n = ndi.label(m, S8)
    if n > 1:
        m = lab == (1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))))
    return m


# A: flood the scene in from the edges of the box. Her dark outline, the green trim and her skin stop it.
R = []
for c in C:
    dark, sk = (lum(c) < 125) | green(c), skin(c)
    lab, n = ndi.label(~ndi.binary_dilation(dark, S8) & ~sk)
    edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
    reach = np.isin(lab, list(edge))
    R.append(reach | (ndi.binary_dilation(reach, S8) & ~reach & ~dark & ~sk))
R = np.array(R)

# B: what the scene looks like behind her, from the frames where a pixel is plainly scene
bg, known = np.zeros((H, W, 3)), np.zeros((H, W), bool)
for y in range(H):
    for x in range(W):
        r = R[:, y, x]
        if r.sum() >= 3:
            bg[y, x] = np.median(C[r, y, x, :], axis=0)
            known[y, x] = True

M = []
for f, c in enumerate(C):
    L, g, s = lum(c), green(c), skin(c)
    same = known & (np.abs(c - bg).sum(axis=2) < 48) & ~s & ~g
    m = ~R[f] & ~same
    # the left sleeve is as white as the school behind it, so it borrows the outline of the right one
    rows, shift = slice(43, 58), W - 1 - 61            # her middle is at x=30.5
    mir = np.zeros_like(m[rows]); mir[:, :W - shift] = m[rows][:, ::-1][:, shift:]
    left = np.zeros_like(mir); left[:, :23] = mir[:, :23]
    m[rows] |= left
    # thin lines of the scene that stay stuck to her (the gate rail at her hips): mid-grey or brown,
    # not part of a solid area, and not the outline of skin or of something green
    solid = ndi.binary_opening(m, S8)
    gone = same | ((L > 70) & (L < 200) & ~g & ~s & ~solid & ~ndi.binary_dilation((g | s) & m, S8))
    # the blue-grey gate bars caught between her arms and her body (not in her face: her eyes shine in that colour)
    bars = (c[..., 2] > c[..., 0] + 10) & (L > 120) & (L < 185) & (np.abs(c[..., 1] - (c[..., 0] + c[..., 2]) // 2) < 14)
    bars[:44] = False
    gone |= bars
    gone[rows] &= ~left
    # leftovers of the speech bubble next to her hair
    sel = np.zeros_like(m); sel[:42, :] = True; sel[:42, 20:42] = False
    gone |= sel & (L > 185)
    m &= ~gone
    # one-pixel whiskers of the roof line beside her neck
    up, down = np.roll(m, 1, axis=0), np.roll(m, -1, axis=0)
    whisk = m & ~up & ~down
    whisk[:38] = False; whisk[48:] = False; whisk[:, 20:42] = False
    m &= ~whisk
    m = biggest(m)
    M.append(ndi.binary_fill_holes(m) & ~gone)
M = np.array(M)

# a fixed set of colours for all frames. The red of her eyes is only a few pixels, so it gets its own
# colours first; otherwise the common colours would swallow it and her eyes would turn brown.
px = C[M].astype(np.uint8)
isred = (px[:, 0].astype(int) > px[:, 1].astype(int) + 45) & (px[:, 0].astype(int) > px[:, 2].astype(int) + 30) & (px[:, 0] < 215)


def colours(p, n):
    q = Image.fromarray(p.reshape(-1, 1, 3)).quantize(n, method=Image.MEDIANCUT, dither=Image.NONE)
    return np.array(q.getpalette()[:n * 3]).reshape(-1, 3)


pal = np.unique(np.vstack([colours(px[isred], 5), colours(px[~isred], 57)]), axis=0)

ys, xs = np.where(M.any(axis=0))
bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
frames = []
for f in range(F):
    c = C[f][by0:by1, bx0:bx1]
    k = np.abs(c[:, :, None, :] - pal[None, None, :, :]).sum(axis=3).argmin(axis=2)
    a = np.dstack([pal[k], M[f][by0:by1, bx0:bx1] * 255]).astype(np.uint8)
    a[a[..., 3] == 0] = 0
    frames.append(Image.fromarray(a, 'RGBA'))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
fw, fh, per_row = bx1 - bx0, by1 - by0, 16
sheet = Image.new('RGBA', (fw * per_row, fh * -(-F // per_row)), (0, 0, 0, 0))
for f, fr in enumerate(frames):
    sheet.paste(fr, ((f % per_row) * fw, (f // per_row) * fh))
sheet.save(OUT, optimize=True)
print(f"{OUT}: {F} frames of {fw}x{fh}, {len(pal)} colours, {int(M.any(axis=0).sum())} pixels used, {os.path.getsize(OUT) // 1024} KB")
print(f"export const VOXEL_ART = {{ src: '{OUT}', fw: {fw}, fh: {fh}, count: {F}, ms: {ms} }};")
