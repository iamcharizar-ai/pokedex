# Cuts the gym badge sheet into one picture per badge, in sprites/badges/.
#
#   python tools/build-badges.py tools/badges-sheet.png
#
# The sheet's small copy (top left) is a grid of 16x16 badges, 17 px apart,
# one region per row: Kanto, Johto, Hoenn, Sinnoh, a mixed row, Unova, Kalos.
# The mixed row starts with the four Orange Islands badges (Coral-Eye, Sea
# Ruby, Spike Shell, Jade Star); its last two are left out. Alola, Galar and
# Paldea are not on it; the app draws plain shapes for those. Needs Pillow.
# The sheet used is kept beside this script as badges-sheet.png.
import os
import sys
from PIL import Image

ROWS = {1: 0, 2: 1, 3: 2, 4: 3, 5: 5, 6: 6}  # region number -> row of the sheet
CELL, PITCH, ORIGIN = 16, 17, 1

sheet = Image.open(sys.argv[1]).convert('RGBA')
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sprites', 'badges')
os.makedirs(dest, exist_ok=True)
made = 0
# the Orange Islands: the first four of the fifth row
for col in range(4):
    x, y = ORIGIN + PITCH * col, ORIGIN + PITCH * 4
    sheet.crop((x, y, x + CELL, y + CELL)).save(os.path.join(dest, f'orange-{col + 1}.png'))
    made += 1
for region, row in ROWS.items():
    for col in range(8):
        x, y = ORIGIN + PITCH * col, ORIGIN + PITCH * row
        cell = sheet.crop((x, y, x + CELL, y + CELL))
        if cell.getbbox() is None:
            raise SystemExit(f'empty cell for region {region}, badge {col + 1}: is this the right sheet?')
        cell.save(os.path.join(dest, f'{region}-{col + 1}.png'))
        made += 1
print(f'{made} badges written to {os.path.normpath(dest)}')
