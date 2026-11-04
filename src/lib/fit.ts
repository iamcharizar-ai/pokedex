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
