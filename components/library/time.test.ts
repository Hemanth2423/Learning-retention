import { describe, expect, test } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-11-17T12:00:00").getTime();
const ago = (ms: number) => timeAgo(now - ms, now);

describe("timeAgo", () => {
  test("reads naturally at each scale", () => {
    expect(ago(20_000)).toBe("just now");
    expect(ago(60_000)).toBe("1 minute ago");
    expect(ago(5 * 60_000)).toBe("5 minutes ago");
    expect(ago(2 * 3600_000)).toBe("2 hours ago");
    expect(ago(30 * 3600_000)).toBe("yesterday");
    expect(ago(3 * 86400_000)).toBe("3 days ago");
    expect(ago(20 * 86400_000)).toMatch(/Oct/);
  });
});
