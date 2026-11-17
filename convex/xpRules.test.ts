import { describe, expect, it } from "vitest";
import { awardKey, dayKey, levelOf, newAwards, nextStreak, shownStreak, XP } from "./xpRules";

describe("xp rules", () => {
  it("pays each award once", () => {
    const read = { key: awardKey.read("d", "c1"), xp: XP.read };
    const note = { key: awardKey.note("d", "c1"), xp: XP.note };
    expect(newAwards([], [read, note, read])).toEqual([read, note]);
    expect(newAwards([read.key], [read, note])).toEqual([note]);
    expect(awardKey.answer("d", "c1", 2)).not.toBe(awardKey.answer("d", "c1", 3));
  });

  it("levels up every 100 XP", () => {
    expect(levelOf(0)).toEqual({ level: 1, intoLevel: 0 });
    expect(levelOf(99)).toEqual({ level: 1, intoLevel: 99 });
    expect(levelOf(240)).toEqual({ level: 3, intoLevel: 40 });
  });

  it("uses the reader's own day", () => {
    const t = Date.UTC(2026, 10, 17, 3); // 3am UTC = the evening before in California
    expect(dayKey(t)).toBe("2026-11-17");
    expect(dayKey(t, "America/Los_Angeles")).toBe("2026-11-16");
    expect(dayKey(t, "Not/AZone")).toBe("2026-11-17");
  });

  it("streak: same day keeps it, next day adds one, a gap restarts", () => {
    expect(nextStreak(undefined, 0, "2026-11-17")).toBe(1);
    expect(nextStreak("2026-11-17", 3, "2026-11-17")).toBe(3);
    expect(nextStreak("2026-11-16", 3, "2026-11-17")).toBe(4);
    expect(nextStreak("2026-10-31", 3, "2026-11-01")).toBe(4); // across a month
    expect(nextStreak("2026-11-14", 3, "2026-11-17")).toBe(1);
  });

  it("a streak shows until the day after the last active day ends", () => {
    expect(shownStreak(undefined, 0, "2026-11-17")).toBe(0);
    expect(shownStreak("2026-11-16", 4, "2026-11-17")).toBe(4);
    expect(shownStreak("2026-11-15", 4, "2026-11-17")).toBe(0);
  });
});
