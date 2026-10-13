// Things the player has just been shown by the screen that did them, so the
// news window does not tell them a second time (forging a Mega plays its own
// reveal; the `mega` moment would otherwise open a window straight after).
// Lives only as long as the page: another device, or a reload, still hears of it.
export const told = new Set<string>()
