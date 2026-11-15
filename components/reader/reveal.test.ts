import { describe, expect, test } from "vitest";
import { HOLD_MS, PAUSE_MS, scrollStarts, shouldExpand } from "./reveal";

describe("the test tab's reveal rules", () => {
  test("opens for the first scroll", () => {
    expect(shouldExpand({ lastScrollAt: null, now: 1000, expanded: false, selecting: false })).toBe(true);
  });
  test("keeps scrolling is not a new start, so it doesn't reopen after closing", () => {
    expect(scrollStarts(1000, 1000 + PAUSE_MS - 1)).toBe(false);
    expect(shouldExpand({ lastScrollAt: 4000, now: 4100, expanded: false, selecting: false })).toBe(false);
  });
  test("reopens after a pause", () => {
    expect(shouldExpand({ lastScrollAt: 1000, now: 1000 + PAUSE_MS + 1, expanded: false, selecting: false })).toBe(true);
  });
  test("stays quiet while the reader is selecting text, or when already open", () => {
    expect(shouldExpand({ lastScrollAt: null, now: 1000, expanded: false, selecting: true })).toBe(false);
    expect(shouldExpand({ lastScrollAt: null, now: 1000, expanded: true, selecting: false })).toBe(false);
  });
  test("stays open for 3 seconds", () => expect(HOLD_MS).toBe(3000));
});
