# Forge assets: drop your generated pictures here

The prompts, sizes and the order to make them in are in `FORGE-EXPERIENCE.md`, section 9. Save each as a PNG with exactly these names:

| File | What |
|---|---|
| `altar-unlit.png` | the altar, dark and dormant, wide crevices in one flat navy (2048 x 2048, transparent background) |
| `altar-lit-grooves.png` | *optional:* an edit of the altar: only the crevices glowing white |
| `altar-lit-sockets.png` | *optional:* an edit of the altar: only the three socket wells glowing white |
| `altar-lit-centre.png` | *optional:* an edit of the altar: only the centre recess glowing white |
| `floor.png` | optional: a seamless dark flagstone tile (1024 x 1024) |

The three lit pictures must be **edits of the one altar you chose** (same geometry), not new generations.
These are the source files; the build turns them into the pictures and maps the game uses.

`candidates/` holds the round 1 altars (A: geometric, B: organic) that the regeneration starts from; see the round 1 review in `FORGE-EXPERIENCE.md`.

The shards and the Key Stone are not generated: the forge uses the game's own icons (`sprites/items`).
