// A sprite that fails to load never shows as a broken-image box.
//
// Every sprite in the app is an <img> pointing at /sprites/..., which the site hands to a separate
// sprites project. If that host is down, answers with something that is not an image, or simply has
// no file for a form (a few shiny animations do not exist), the browser fires `error` on the image.
// One listener, here, answers it for every image at once: first the same form's plainer pictures, in
// order, then a quiet silhouette. So no screen has to remember to handle it.
//
// `error` does not bubble, so it is caught in the capture phase on the document.

/** What to try after `src` fails: the non-shiny picture, then the still, in that order. Empty when nothing is left. */
export function fallbacksFor(src: string): string[] {
  const m = /^(.*\/sprites\/)(ani|static)(-shiny)?\/([^/?#]+)\.(gif|png)(\?.*)?$/.exec(src)
  if (!m) return []
  const [, base, kind, shiny, name] = m
  const tries = [`${base}ani/${name}.gif`, `${base}static/${name}.png`, `${base}static-shiny/${name}.png`]
  const own = `${base}${kind}${shiny ?? ''}/${name}.${kind === 'ani' ? 'gif' : 'png'}`
  // a shiny that is missing falls back to the ordinary one before the stills; nothing is tried twice
  return tries.filter((t, i) => t !== own && tries.indexOf(t) === i && !(i === 2 && !shiny))
}

/** A neutral stand-in: a round shadow with a question mark, in the app's own purple. */
export const SPRITE_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="56" r="30" fill="#3b2f6b" opacity=".55"/><text x="48" y="68" font-family="sans-serif" font-size="40" font-weight="700" text-anchor="middle" fill="#a99be0">?</text></svg>',
)

const tried = new WeakMap<HTMLImageElement, { shown: string; left: string[] }>()

/** Answer one failed image. Exported so it can be tested without a browser. */
export function recover(img: Pick<HTMLImageElement, 'src' | 'style'> & { dataset?: DOMStringMap }, state: { shown: string; left: string[] } | undefined): { shown: string; left: string[] } | null {
  // a new picture was set on the same element (the page showed another Pokemon): start again from it
  const cur = !state || state.shown !== img.src ? { shown: img.src, left: fallbacksFor(img.src) } : state
  if (cur.shown === SPRITE_PLACEHOLDER) return null
  const next = cur.left[0]
  if (next) { img.src = next; return { shown: next, left: cur.left.slice(1) } }
  // nothing left to try. A sprite gets the silhouette; anything else on the sprites host (an item, a type) is simply hidden
  if (/\/sprites\/(ani|static)/.test(cur.shown)) { img.src = SPRITE_PLACEHOLDER; return { shown: SPRITE_PLACEHOLDER, left: [] } }
  img.style.visibility = 'hidden'
  return null
}

export function installSpriteFallback(): void {
  document.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || !/\/sprites\//.test(img.src)) return
    const after = recover(img, tried.get(img))
    if (after) tried.set(img, { shown: img.src, left: after.left })
  }, true)
}
