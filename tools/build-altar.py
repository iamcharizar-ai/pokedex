"""
The Forge altar: turns the picture in assets-src/forge/altar-unlit.png into what the game draws with (sprites/forge/).

    python tools/build-altar.py

Needs Python with numpy, opencv-python and Pillow (like tools/build-badges.py needs Pillow). It writes:

  altar.png        the altar on a transparent background (the magenta keyed out)
  altar-flow.png   the crevices, for the glow shader. R,G = how far along the crevices each point is from its socket
                   (16 bits: R * 256 + G, in sixteenths of a pixel), B = which socket's water reaches it first
                   (60, 150 or 240 for the top, bottom-right and bottom-left sockets, 0 where there is no crevice), A = the crevice (soft edge)
  altar-pour.png   R,G = how far each crevice point is from the centre (the same 16 bits), A = the crevice. The pour into the Key Stone runs on it
  altar-wells.png  the insides of the wells: R, G, B = the three socket wells (top, bottom-right, bottom-left), A = the centre recess
  altar.json       where everything is (as fractions of the picture) and how long each route is

The crevices are found by their colour: one flat very dark navy that nothing else in the picture has. Small breaks in them are bridged, the
distance along the crevices is measured with Dijkstra's algorithm (so the water follows the winding channels, not a straight line), and each
point is given to the socket whose water gets there first.
"""
import heapq
import json
import math
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'forge', 'altar-unlit.png')
OUT = os.path.join(ROOT, 'sprites', 'forge')
SCALE16 = 16            # distance units per pixel in the 16-bit maps
RIM = 80                # how far from a well's edge the crevices may start (the raised stone rim between a well and its first crevice)
BASIN_ID = [60, 150, 240]

os.makedirs(OUT, exist_ok=True)
rgb = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
H, W = rgb.shape[:2]
R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]

# ── the background: the magenta that touches the corner, keyed out ──
magenta = ((R > 150) & (B > 150) & (G < 120)).astype(np.uint8)
ff = magenta.copy()
mask = np.zeros((H + 2, W + 2), np.uint8)
cv2.floodFill(ff, mask, (0, 0), 2)
bg = (ff == 2)
alpha = np.where(bg, 0, 255).astype(np.uint8)
alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8))
alpha = cv2.GaussianBlur(alpha, (0, 0), 0.9)
# take the magenta tint out of the edge pixels
edge = cv2.dilate((alpha < 250).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
spill = np.clip(np.minimum(R, B) - G, 0, None) * edge
out_rgb = np.stack([R - spill, G, B - spill], axis=-1).clip(0, 255).astype(np.uint8)
Image.fromarray(np.dstack([out_rgb, alpha])).save(os.path.join(OUT, 'altar.png'), optimize=True)

# ── the navy: crevices and wells ──
navy = ((abs(R - 11) < 24) & (abs(G - 16) < 24) & (abs(B - 32) < 28) & (~bg)).astype(np.uint8)
opened = cv2.morphologyEx(navy, cv2.MORPH_OPEN, np.ones((61, 61), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(opened)
blobs = sorted([(int(st[i, 4]), tuple(float(v) for v in cen[i]), i) for i in range(1, n) if st[i, 4] > 5000], reverse=True)
assert len(blobs) == 4, f'expected 4 wells (three sockets and the centre), found {len(blobs)}'
centre_blob = blobs[0]
socket_blobs = blobs[1:]
# clockwise from the top: the top socket first, then the right one, then the left one
cx = float(np.mean([b[1][0] for b in socket_blobs])); cy = float(np.mean([b[1][1] for b in socket_blobs]))
socket_blobs.sort(key=lambda b: (math.atan2(b[1][1] - cy, b[1][0] - cx) + math.pi / 2 + 0.3) % (2 * math.pi))   # the 0.3 keeps the top one first
wells = [{'x': b[1][0], 'y': b[1][1], 'r': math.sqrt(b[0] / math.pi), 'i': b[2]} for b in socket_blobs]
centre = {'x': centre_blob[1][0], 'y': centre_blob[1][1], 'r': math.sqrt(centre_blob[0] / math.pi), 'i': centre_blob[2]}

chan = navy.copy()
chan[cv2.dilate((opened > 0).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0] = 0
chan = cv2.morphologyEx(chan, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
chan = cv2.morphologyEx(chan, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))   # bridge hairline breaks
nl, lab2, st2, _ = cv2.connectedComponentsWithStats(chan)
for i in range(1, nl):                                                        # drop specks
    if st2[i, 4] < 250:
        chan[lab2 == i] = 0
chan = cv2.morphologyEx(chan, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)))
chan[(opened > 0)] = 0
nl, lab2, st2, _ = cv2.connectedComponentsWithStats(chan)
areas = sorted([int(st2[i, 4]) for i in range(1, nl)], reverse=True)
print(f'crevice pieces after bridging: {nl - 1}; the biggest holds {100 * areas[0] / sum(areas):.0f}% of the crevice area')

ys, xs = np.nonzero(chan)
yy, xx = np.mgrid[:H, :W]


def seeds_near(c, radius):
    d2 = (xs - c['x']) ** 2 + (ys - c['y']) ** 2
    return np.nonzero(d2 <= (c['r'] + radius) ** 2)[0]


# ── the distance along the crevices (Dijkstra, eight directions) ──
NB = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]


def flood(seed_sets):
    """seed_sets: one array of indices into (ys, xs) for each source. Returns (distance, which source reached it first)."""
    dist = np.full((H, W), np.inf, np.float32)
    owner = np.full((H, W), -1, np.int8)
    heap = []
    for k, idx in enumerate(seed_sets):
        for j in idx:
            y, x = int(ys[j]), int(xs[j])
            dist[y, x] = 0.0
            owner[y, x] = k
            heap.append((0.0, y, x, k))
    heapq.heapify(heap)
    cm = chan > 0
    while heap:
        d, y, x, k = heapq.heappop(heap)
        if d > dist[y, x]:
            continue
        for dy, dx, w in NB:
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and cm[ny, nx]:
                nd = d + w
                if nd < dist[ny, nx]:
                    dist[ny, nx] = nd
                    owner[ny, nx] = k
                    heapq.heappush(heap, (nd, ny, nx, k))
    return dist, owner


socket_seeds = [seeds_near(w, RIM) for w in wells]
for k, s in enumerate(socket_seeds):
    assert len(s), f'socket {k} has no crevice within {RIM}px of its edge'
dist_s, basin = flood(socket_seeds)
dist_c, _ = flood([seeds_near(centre, RIM)])
assert len(seeds_near(centre, RIM)), 'the centre has no crevice near it'

def fill_unreached(dist, reach, also=None):
    """A crevice piece the water cannot reach (a hairline of stone cuts it off) is fed from the nearest crevice that is reached, so it fills in its turn."""
    unreached = (chan > 0) & ~reach
    if not unreached.any():
        return
    src = reach.astype(np.uint8)
    dt, labels = cv2.distanceTransformWithLabels(1 - src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    sy, sx = np.nonzero(src)                       # the labels number the reached pixels in scan order
    ny, nx = sy[labels - 1], sx[labels - 1]
    dist[unreached] = dist[ny, nx][unreached] + dt[unreached]
    if also is not None:
        also[unreached] = also[ny, nx][unreached]


reach = np.isfinite(dist_s) & (chan > 0)
print(f'crevice pixels: {int((chan > 0).sum())}; reached from the sockets directly: {100 * reach.sum() / (chan > 0).sum():.1f}% (the rest are fed from their nearest crevice)')
fill_unreached(dist_s, reach, basin)
reach_c = np.isfinite(dist_c) & (chan > 0)
fill_unreached(dist_c, reach_c)
far_c = float(dist_c[(chan > 0)].max())

basin_max = []
for k in range(3):
    m = (basin == k) & (chan > 0)
    basin_max.append(float(dist_s[m].max()) if m.any() else 0.0)
print('longest route from each socket (px):', [round(v) for v in basin_max], '; to the centre:', round(far_c))
print('crevice pixels given to each socket:', [int(((basin == k) & (chan > 0)).sum()) for k in range(3)])

soft = cv2.GaussianBlur((chan * 255).astype(np.uint8), (0, 0), 1.1)


def enc16(d):
    v = np.clip(np.where(np.isfinite(d), d, 0) * SCALE16, 0, 65535).astype(np.uint32)
    return (v >> 8).astype(np.uint8), (v & 255).astype(np.uint8)


hi, lo = enc16(dist_s)
bid = np.zeros((H, W), np.uint8)
for k in range(3):
    bid[(basin == k) & (chan > 0)] = BASIN_ID[k]
Image.fromarray(np.dstack([hi * (chan > 0), lo * (chan > 0), bid, soft])).save(os.path.join(OUT, 'altar-flow.png'), optimize=True)
hi, lo = enc16(dist_c)
Image.fromarray(np.dstack([hi * (chan > 0), lo * (chan > 0), np.zeros((H, W), np.uint8), soft])).save(os.path.join(OUT, 'altar-pour.png'), optimize=True)

# ── the insides of the wells: true circles, out to the gold ring ──
gold = (R > 150) & (G > 100) & (B < 125) & (R - B > 70)


def inner_radius(w):
    """How far the dark inside reaches from the well's middle before the gold ring: the median over all directions (the ring is round, the old blob was not)."""
    hits = []
    for deg in range(0, 360, 2):
        a = math.radians(deg)
        for r in range(8, 400):
            x, y = int(round(w['x'] + r * math.cos(a))), int(round(w['y'] + r * math.sin(a)))
            if not (0 <= x < W and 0 <= y < H) or gold[y, x]:
                hits.append(r)
                break
    return float(np.median(hits))


for w in wells + [centre]:
    w['r'] = inner_radius(w) - 1.5     # a hair inside the gold
print('well inner radii (px):', [round(w['r'], 1) for w in wells], 'centre', round(centre['r'], 1))


def well_mask(w):
    m = np.zeros((H, W), np.uint8)
    cv2.circle(m, (int(round(w['x'] * 8)), int(round(w['y'] * 8))), int(round(w['r'] * 8)), 255, -1, lineType=cv2.LINE_AA, shift=3)
    return cv2.GaussianBlur(m, (0, 0), 0.7)


Image.fromarray(np.dstack([well_mask(wells[0]), well_mask(wells[1]), well_mask(wells[2]), well_mask(centre)])).save(os.path.join(OUT, 'altar-wells.png'), optimize=True)

meta = {
    'size': [W, H],
    'wells': [{'x': round(w['x'] / W, 5), 'y': round(w['y'] / H, 5), 'r': round(w['r'] / W, 5)} for w in wells],
    'centre': {'x': round(centre['x'] / W, 5), 'y': round(centre['y'] / H, 5), 'r': round(centre['r'] / W, 5)},
    'scale16': SCALE16,
    'basinIds': BASIN_ID,
    'routeMax': [round(v, 1) for v in basin_max],
    'pourMax': round(far_c, 1),
}
with open(os.path.join(OUT, 'altar.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('wrote', sorted(os.listdir(OUT)))
