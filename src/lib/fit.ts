// Pixel art is drawn at a whole-number scale, or not at all. A sprite stretched by 1.4 makes some of its
// pixels one screen pixel wide and some two, and one shrunk by 0.83 loses rows of them. Everything that
// sizes a sprite asks here first. Pure numbers, no browser, so tools/fit.test.mjs can check them.

/**
 * The whole-number scale for a picture of `w` x `h` pixels in a box of `box` pixels: the nearest whole
 * number to what would fill it, stepped down while the result would overflow the box by more than `slack`.
 * Never below 1: a picture larger than its box is drawn at its own size, never shrunk.
 */
export function wholeScale(w: number, h: number, box: number, slack = 1.3): number {
  const m = Math.max(w, h)
  if (!(m > 0) || !(box > 0)) return 1
  let k = Math.max(1, Math.round(box / m))
  while (k > 1 && m * k > box * slack) k--
  return k
}

/** The drawn part of a sprite: left, top, right, bottom (sprites/bbox.json), in its 96px file. */
export type Box = [number, number, number, number]

/**
 * A sprite on a card's art field (the full-art card, MonCard): enlarged so what is drawn fills about the same share
 * of the field whatever its size (a Goldeen is small in its file, an Onix is not), feet standing near the banner.
 * `w` x `h` is the field. A scale within a hair of a whole number is made whole and drawn as it is; any other is
 * drawn from a 4x hard-edged copy shrunk smoothly (`smooth`: see useBig in lib/pixel.tsx), never stretched by a fraction.
 */
export function fullFit(box: Box, w: number, h: number): { x: number; y: number; k: number; smooth: boolean } {
  const [l, t, r, b] = box
  let k = Math.max(1, Math.min(3.6, Math.min((w * 0.82) / Math.max(1, r - l), (h * 0.64) / Math.max(1, b - t))))
  const whole = Math.abs(k - Math.round(k)) < 0.1
  if (whole) k = Math.round(k)
  const x = Math.round(-((l + r) / 2 - 48) * k)
  const y = Math.round(h * 0.8 - (h / 2 + (b - 48) * k))
  return { x, y, k, smooth: !whole }
}
