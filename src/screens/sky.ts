// The sky over the Home scene: where the light is at this minute of the day, and
// what last night's sleep did to the weather. Pure numbers and colours, no
// browser in it, so tools/sky.test.mjs can check them.
//
// The old scene had four fixed skies (morning, day, dusk, night) with a hard
// jump between them. This is continuous: the palette is blended between
// keyframes, the sun and moon are placed along an arc by the minute, and the
// stars fade in as the dark deepens.

export interface Palette { sky1: string; sky2: string; far: string; ground: string; ground2: string; pad: string; pad2: string }

/** Keyframes by hour. Colours are the ones the game has always used for each time of day; between them the blend is linear. `dark` is how deep the night is (0 day, 1 night). */
const KEYS: { h: number; dark: number; p: Palette }[] = [
  { h: 0, dark: 1, p: { sky1: '#121a3d', sky2: '#2c3d7a', far: '#2f5b56', ground: '#3d7a5c', ground2: '#336a50', pad: '#2e6a4c', pad2: '#24553d' } },
  { h: 5, dark: 0.9, p: { sky1: '#1b2252', sky2: '#4f4686', far: '#365e5c', ground: '#437a60', ground2: '#386c54', pad: '#33704f', pad2: '#295a42' } },
  { h: 6.5, dark: 0.25, p: { sky1: '#ff9d6c', sky2: '#ffd9a8', far: '#8fbf86', ground: '#a9d388', ground2: '#93c474', pad: '#76b866', pad2: '#58a04e' } },
  { h: 8.5, dark: 0, p: { sky1: '#ffb88a', sky2: '#ffe9c4', far: '#9ccf8e', ground: '#b6e08a', ground2: '#9fd177', pad: '#7cc66a', pad2: '#5aa850' } },
  { h: 11, dark: 0, p: { sky1: '#7cc8ff', sky2: '#c9ecff', far: '#8fd18a', ground: '#b6e08a', ground2: '#9fd177', pad: '#7cc66a', pad2: '#5aa850' } },
  { h: 16, dark: 0, p: { sky1: '#7cc8ff', sky2: '#c9ecff', far: '#8fd18a', ground: '#b6e08a', ground2: '#9fd177', pad: '#7cc66a', pad2: '#5aa850' } },
  { h: 18.5, dark: 0.3, p: { sky1: '#6a5acd', sky2: '#ff9d6c', far: '#6aa07a', ground: '#9fca7c', ground2: '#86b96c', pad: '#6fb060', pad2: '#4f9148' } },
  { h: 20.5, dark: 1, p: { sky1: '#121a3d', sky2: '#2c3d7a', far: '#2f5b56', ground: '#3d7a5c', ground2: '#336a50', pad: '#2e6a4c', pad2: '#24553d' } },
  { h: 24, dark: 1, p: { sky1: '#121a3d', sky2: '#2c3d7a', far: '#2f5b56', ground: '#3d7a5c', ground2: '#336a50', pad: '#2e6a4c', pad2: '#24553d' } },
]

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number]
const mix = (a: string, b: string, t: number): string => {
  const [x, y] = [hex(a), hex(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** The two keyframes a minute falls between, and how far along between them (0 to 1). */
function between(minutes: number): { a: (typeof KEYS)[number]; b: (typeof KEYS)[number]; t: number } {
  const h = (((minutes % 1440) + 1440) % 1440) / 60
  let i = KEYS.findIndex((k) => k.h > h) - 1
  if (i < 0) i = KEYS.length - 2
  const a = KEYS[i], b = KEYS[i + 1]
  return { a, b, t: (h - a.h) / (b.h - a.h) }
}

/** The colours of the scene at a minute of the day (0 to 1439). */
export function paletteAt(minutes: number): Palette {
  const { a, b, t } = between(minutes)
  const out = {} as Palette
  for (const k of Object.keys(a.p) as (keyof Palette)[]) out[k] = mix(a.p[k], b.p[k], t)
  return out
}

/** How dark it is, 0 (full day) to 1 (deep night): the stars and the moon's glow follow it. */
export function darkAt(minutes: number): number {
  const { a, b, t } = between(minutes)
  return a.dark + (b.dark - a.dark) * t
}

export interface Body { kind: 'sun' | 'moon'; /** percent across the sky */ x: number; /** percent down from the top of the sky */ y: number }
/** The sun crosses from 06:00 to 18:30, the moon from 18:30 to 06:00; each rises on the left, tops out in the middle and sets on the right. */
export function bodyAt(minutes: number): Body {
  const m = ((minutes % 1440) + 1440) % 1440
  const day = m >= 360 && m < 1110
  const span = day ? 750 : 690
  const t = day ? (m - 360) / span : ((m - 1110 + 1440) % 1440) / span
  return { kind: day ? 'sun' : 'moon', x: 8 + 84 * t, y: 86 - 70 * Math.sin(Math.PI * t) }
}

export type Weather = 'clear' | 'fair' | 'cloudy' | 'overcast' | 'rain'
export interface Sky { weather: Weather; clouds: number; /** 0 white, 1 storm grey */ gloom: number; rain: boolean; label: string }

/**
 * What last night's sleep did to the sky. With no reading (no band, or it has not
 * arrived) the sky is plain and says nothing about it: a missing night is never
 * a bad one.
 */
export function weatherOf(score: number | null): Sky {
  if (score === null) return { weather: 'fair', clouds: 2, gloom: 0, rain: false, label: 'A fair sky' }
  if (score >= 90) return { weather: 'clear', clouds: 0, gloom: 0, rain: false, label: `Clear: slept ${score}` }
  if (score >= 80) return { weather: 'fair', clouds: 1, gloom: 0, rain: false, label: `Fair: slept ${score}` }
  if (score >= 60) return { weather: 'cloudy', clouds: 3, gloom: 0.2, rain: false, label: `Cloudy: slept ${score}` }
  if (score >= 40) return { weather: 'overcast', clouds: 5, gloom: 0.6, rain: false, label: `Overcast: slept ${score}` }
  return { weather: 'rain', clouds: 5, gloom: 1, rain: true, label: `Rain: slept ${score}` }
}

/** The scene's own scenes (bought with gems) pin the sky: a beach is always noon, a starry night always night, and a cave has no sky at all. */
export const THEME_CLOCK: Record<string, number | null> = { 'theme-beach': 720, 'theme-night': 1380, 'theme-cave': null }
