// Rules for the small "Test your understanding" tab. Pure so they can be tested.

export const HOLD_MS = 3000; // how long the tab stays open once scrolling starts
export const PAUSE_MS = 700; // scrolling that stops this long counts as stopped, so the next scroll is a new start

// A scroll "starts" when the last scroll event was more than PAUSE_MS ago (or there was none).
export function scrollStarts(lastScrollAt: number | null, now: number): boolean {
  return lastScrollAt === null || now - lastScrollAt > PAUSE_MS;
}

// The tab opens when scrolling starts, unless it's already open or the reader is selecting text.
export function shouldExpand(input: { lastScrollAt: number | null; now: number; expanded: boolean; selecting: boolean }): boolean {
  return !input.expanded && !input.selecting && scrollStarts(input.lastScrollAt, input.now);
}
