#!/usr/bin/env python3
"""Makes the small pictures the page shows first, so nothing big has to load before you can see something.

Run it from the repo folder after you add or change a picture:

    python3 tools/build_media.py

It reads  data/projects.js   (which pictures are used)
writes    assets/thumb/      small WebP copies: project pictures at 560px, pixel art at its real pixel size
          data/media.js      size, average colour and small copy of every picture
          data/voxel.js      the animated character the cubes build in the Pixel art section

Needs Pillow:  pip install pillow
"""
import json, os, re, sys
from PIL import Image, ImageSequence

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SRC = open('data/projects.js', encoding='utf-8').read()
THUMB = 'assets/thumb'
os.makedirs(THUMB + '/art', exist_ok=True)


def avg_colour(im):
    r, g, b = im.convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
    return '#%02x%02x%02x' % (r, g, b)


def pixel_size(im):
    """Pixel art is usually saved enlarged. Find how many screen pixels one drawn pixel takes (1 = not pixel art)."""
    im = im.convert('RGB')
    w, h = im.size
    for s in range(min(64, w // 8, h // 8), 1, -1):
        if w % s or h % s:
            continue
        small = im.resize((w // s, h // s), Image.NEAREST)
        back = small.resize((w, h), Image.NEAREST)
        a, b = im.tobytes(), back.tobytes()
        if a == b:
            return s
        diff = sum(1 for i in range(0, len(a), 3 * 97) if a[i:i + 3] != b[i:i + 3])      # sample every 97th pixel
        if diff <= (len(a) // (3 * 97)) * 0.004:
            return s
    return 1


def frames_of(im):
    out, dur = [], []
    for f in ImageSequence.Iterator(im):
        out.append(f.convert('RGBA'))
        dur.append(f.info.get('duration', 100) or 100)
    return out, dur


media = {}

# ---------- project pictures ----------
posters = sorted(set(re.findall(r"assets/tex/[\w.\-]+\.(?:jpg|jpeg|png|webp)", SRC)))
for p in posters:
    if not os.path.exists(p):
        print('missing', p); continue
    im = Image.open(p).convert('RGB')
    w, h = im.size
    t = f"{THUMB}/{os.path.splitext(os.path.basename(p))[0]}.webp"
    tw = min(w, 560)
    im.resize((tw, round(h * tw / w)), Image.LANCZOS).save(t, 'WEBP', quality=80, method=6)
    media[p] = {'t': t, 'w': w, 'h': h, 'c': avg_colour(im)}

# ---------- pixel art ----------
art_block = re.search(r"export const ART = \[(.*?)\];", SRC, re.S).group(1)
for name in re.findall(r"'([^']+)'", art_block):
    p = 'images/' + name
    if not os.path.exists(p):
        print('missing', p); continue
    im = Image.open(p)
    w, h = im.size
    n = getattr(im, 'n_frames', 1)
    stem = os.path.splitext(name)[0]
    t = f"{THUMB}/art/{stem}.webp"
    first = im.convert('RGBA') if n == 1 else frames_of(im)[0][0]
    s = pixel_size(first)
    entry = {'t': t, 'w': w, 'h': h, 'c': avg_colour(first)}

    def shrink(f):
        if s > 1:
            lw, lh = w // s, h // s
            k = max(1, min(4, 480 // lw))            # keep it small, but not so small that it blurs on old browsers
            return f.resize((lw, lh), Image.NEAREST).resize((lw * k, lh * k), Image.NEAREST)
        tw = min(w, 440)
        return f.resize((tw, round(h * tw / w)), Image.LANCZOS)

    if s > 1:
        entry['px'] = 1
    done = False
    if n > 1:
        fr, dur = frames_of(im)
        small = [shrink(f) for f in fr]
        small[0].save(t, 'WEBP', save_all=True, append_images=small[1:], duration=dur, loop=0, lossless=True, method=4, minimize_size=True)
        if os.path.getsize(t) <= 260 * 1024:
            entry['a'] = 1                              # the small copy moves too
            done = True
        else:
            entry['a'] = 2                              # too heavy: the small copy is a still, the real one plays on hover
    if not done:
        shrink(first).save(t, 'WEBP', lossless=s > 1, quality=82, method=6)
    media[p] = entry
    print(f"{name:14} {w}x{h} pixel={s:<3} frames={n:<4} -> {os.path.getsize(t) // 1024:>4} KB {'moving' if entry.get('a') == 1 else ''}")

# the avatar in the header is shown at 36px
av = Image.open('assets/tex/avatar512.jpg').convert('RGB')
av.resize((96, 96), Image.LANCZOS).save(f"{THUMB}/avatar.webp", 'WEBP', quality=84, method=6)

with open('data/media.js', 'w', encoding='utf-8') as f:
    f.write('// Made by tools/build_media.py. Do not edit by hand: change the pictures and run the tool again.\n')
    f.write('// t = small copy, w/h = size of the real picture, c = its average colour (shown while it loads),\n')
    f.write('// px = pixel art (kept sharp when enlarged), a = 1 the small copy is animated, 2 only the real one is.\n')
    f.write('export const MEDIA = ' + json.dumps(media, separators=(',', ':')).replace('},', '},\n  ').replace('{"', '{\n  "', 1) + ';\n')

# ---------- the cube character ----------
m = re.search(r"export const VOXEL_ART = \{(.*?)\};", SRC, re.S)
cfg = dict(re.findall(r"(\w+):\s*'?([^,'}]+)'?", m.group(1)))
src = cfg['src'].strip()
skip = int(cfg.get('skip', 0))
im = Image.open(src)
fr, dur = frames_of(im)
lw = int(cfg['grid'])
lh = round(im.size[1] * lw / im.size[0])
small = [f.convert('RGB').resize((lw, lh), Image.NEAREST) for f in fr]
bg = small[0].getpixel((lw - 1, 0))
uniq, seq = [], []
for f in small:
    b = f.tobytes()
    if b not in uniq:
        uniq.append(b)
    seq.append(uniq.index(b))
palette, grids, used = [], [], {}
for b in uniq:
    f = Image.frombytes('RGB', (lw, lh), b)
    g = {}
    for y in range(lh):
        for x in range(skip, lw):
            c = f.getpixel((x, y))
            if c == bg:
                continue
            if c not in palette:
                palette.append(c)
            g[(x, y)] = palette.index(c)
            used[(x, y)] = used.get((x, y), 0) + 1
    grids.append(g)
# pixels used in most frames come first, so if there are ever fewer cubes than pixels the rare ones are dropped
cells = sorted(used, key=lambda k: (-used[k], k[1], k[0]))
x0 = min(x for x, y in cells); y0 = min(y for x, y in cells)
x1 = max(x for x, y in cells); y1 = max(y for x, y in cells)
assert len(palette) < 40, 'too many colours for the cube character'
frames = [''.join(chr(48 + g[c]) if c in g else '.' for c in cells) for g in grids]
voxel = {
    'w': x1 - x0 + 1, 'h': y1 - y0 + 1, 'ms': dur[0],
    'palette': ['#%02x%02x%02x' % c for c in palette],
    'cells': [[x - x0, y - y0] for x, y in cells],
    'frames': frames, 'seq': seq,
}
with open('data/voxel.js', 'w', encoding='utf-8') as f:
    f.write(f"// Made by tools/build_media.py from {src}. One cube per pixel; each frame says which colour every cube has ('.' = hidden).\n")
    f.write('export const VOXEL = ' + json.dumps(voxel, separators=(',', ':')) + ';\n')
print(f"cube character: {src} {lw}x{lh}, {len(cells)} pixels, {len(uniq)} drawings, {len(seq)} steps, {len(palette)} colours")
print('pictures:', len(media), ' thumbs:', sum(os.path.getsize(os.path.join(d, x)) for d, _, fs in os.walk(THUMB) for x in fs) // 1024, 'KB')
