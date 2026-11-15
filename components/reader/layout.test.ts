import { describe, expect, test } from "vitest";
import { clampRightWidth, defaultRightWidth } from "./layout";

describe("right panel width", () => {
  test("starts at one third of the window", () => {
    expect(defaultRightWidth(1500)).toBe(500);
    expect(defaultRightWidth(1920)).toBe(640);
  });
  test("never goes below 360px, even on a small window", () => {
    expect(defaultRightWidth(900)).toBe(360);
    expect(clampRightWidth(100, 1500)).toBe(360);
  });
  test("can be dragged up to 60% of the window, no further", () => {
    expect(clampRightWidth(800, 1500)).toBe(800);
    expect(clampRightWidth(1400, 1500)).toBe(900);
  });
});
