// One way to say a small thing (UI-AUDIT-2026-11-04 §4.4: there were three toasts). Anything can call `note`;
// Toasts.tsx, mounted once at the top of the app, shows it in the same rail as the day's small news.
// A note answers something you just did (a move that cannot be made), so unlike news it never waits for a
// window to close; a newer note replaces the one before it.
const NOTE = 'pokedex:note'

export interface Note { text: string; bad: boolean }

/** Say something short: what just happened, or why it could not (`bad` gives it the red edge). */
export const note = (text: string, bad = false): void => { window.dispatchEvent(new CustomEvent<Note>(NOTE, { detail: { text, bad } })) }

/** Listen for notes; returns the way to stop. */
export function onNote(f: (n: Note) => void): () => void {
  const h = (e: Event) => f((e as CustomEvent<Note>).detail)
  window.addEventListener(NOTE, h)
  return () => window.removeEventListener(NOTE, h)
}
