# Cuts the gym badge sheet into one picture per badge, in public/sprites/badges/.
#
#   python tools/build-badges.py <badge sheet .png>
#
# The sheet's small copy (top left) is a grid of 16x16 badges, 17 px apart,
# one region per row: Kanto, Johto, Hoenn, Sinnoh, (a row of extras), Unova,
# Kalos. Alola, Galar and Paldea are not on it; the app draws plain shapes for
# those. Needs Pillow.
import os
import sys
from PIL import Image

ROWS = {1: 0, 2: 1, 3: 2, 4: 3, 5: 5, 6: 6}  # region number -> row of the sheet
CELL, PITCH, ORIGIN = 16, 17, 1

sheet = Image.open(sys.argv[1]).convert('RGBA')
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sprites', 'badges')
os.makedirs(dest, exist_ok=True)
made = 0
for region, row in ROWS.items():
    for col in range(8):
        x, y = ORIGIN + PITCH * col, ORIGIN + PITCH * row
        cell = sheet.crop((x, y, x + CELL, y + CELL))
        if cell.getbbox() is None:
            raise SystemExit(f'empty cell for region {region}, badge {col + 1}: is this the right sheet?')
        cell.save(os.path.join(dest, f'{region}-{col + 1}.png'))
        made += 1
print(f'{made} badges written to {os.path.normpath(dest)}')
