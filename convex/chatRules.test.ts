import { describe, expect, test } from "vitest";
import {
  cleanAnswer,
  DAILY_LIMIT,
  filterCitations,
  keywords,
  parseChatAnswer,
  parseNoteResult,
  passageBlock,
  pickPassages,
  quotaStatus,
  summaryPassages,
} from "./chatRules";

const H = 60 * 60 * 1000;

describe("quotaStatus (5 a day, rolling 24 hours)", () => {
  const now = 1_000_000_000_000;
  test("counts only the last 24 hours", () => {
    const s = quotaStatus([now - 25 * H, now - 3 * H, now - 1 * H], now);
    expect(s).toMatchObject({ used: 2, left: 3, resetAt: null });
  });
  test("at the limit, says when the oldest one expires", () => {
    const times = [10, 8, 6, 4, 2].map((h) => now - h * H);
    const s = quotaStatus(times, now);
    expect(s.left).toBe(0);
    expect(s.resetAt).toBe(now - 10 * H + 24 * H);
  });
  test("an expired question frees a slot", () => {
    const times = [26, 8, 6, 4, 2].map((h) => now - h * H);
    expect(quotaStatus(times, now).left).toBe(DAILY_LIMIT - 4);
  });
});

describe("keywords", () => {
  test("drops filler words and keeps the topic", () => {
    expect(keywords("What does the author say about the habit loop?")).toBe("habit loop");
  });
  test("dedupes, lowercases and caps the count", () => {
    expect(keywords("Habit HABIT habit")).toBe("habit");
    expect(keywords("alpha beta gamma delta", 2)).toBe("alpha beta");
  });
  test("a question of only filler gives nothing to search", () => expect(keywords("What is it?")).toBe(""));
});

describe("pickPassages", () => {
  const hits = Array.from({ length: 10 }, (_, i) => ({ page: 10 + i, text: `page ${10 + i}` }));
  test("without a chapter, keeps search order", () => {
    expect(pickPassages(hits, null, 3).map((p) => p.page)).toEqual([10, 11, 12]);
  });
  test("pages in the current chapter are boosted above weaker matches elsewhere", () => {
    const picked = pickPassages(hits, { startPage: 16, endPage: 19 }, 4).map((p) => p.page);
    expect(picked).toContain(16);
    expect(picked[0]).toBe(10); // a strong match elsewhere still wins
  });
  test("numbers passages from 1 and trims long text", () => {
    const [p] = pickPassages([{ page: 1, text: "x".repeat(5000) }], null);
    expect(p.n).toBe(1);
    expect(p.text.length).toBe(1800);
  });
});

describe("summaryPassages", () => {
  test("trims every page evenly to fit the budget", () => {
    const pages = Array.from({ length: 30 }, (_, i) => ({ page: i + 1, text: "x".repeat(3000) }));
    const out = summaryPassages(pages, 24000);
    expect(out).toHaveLength(30);
    expect(out.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(24000);
    expect(out[29].page).toBe(30);
  });
  test("a summary numbers its passages by page, so [5] means page 5", () => {
    const out = summaryPassages([{ page: 4, text: "a" }, { page: 5, text: "b" }]);
    expect(out.map((p) => [p.n, p.page])).toEqual([[4, 4], [5, 5]]);
  });
  test("passageBlock labels each passage with its number and page", () => {
    expect(passageBlock([{ n: 2, page: 7, text: "hello" }])).toBe("[2] (page 7)\nhello");
  });
});

describe("citations are checked", () => {
  test("filterCitations keeps only real, unique passage numbers", () => {
    expect(filterCitations([1, "2", 2, 9, 0, 1.5, "x"], 3)).toEqual([1, 2]);
    expect(filterCitations("nope", 3)).toEqual([]);
  });
  test("cleanAnswer removes markers that point nowhere and tidies spaces", () => {
    expect(cleanAnswer("Habits loop [1] and reward [7].", 3)).toBe("Habits loop [1] and reward.");
    expect(cleanAnswer("Both [1, 2] agree [5, 2].", 3)).toBe("Both [1][2] agree [2].");
  });
  test("a list of valid numbers works too, and a removed marker leaves no gap before punctuation", () => {
    expect(filterCitations([4, 5, 9], [4, 5, 6])).toEqual([4, 5]);
    expect(cleanAnswer("Sleep helps [5] . Rereading is weaker [9].", [4, 5, 6])).toBe("Sleep helps [5]. Rereading is weaker.");
  });
  test("parseChatAnswer merges inline markers with the cited list and rejects junk", () => {
    expect(parseChatAnswer({ answer: "A loop [1].", citations: [2, 9] }, 3)).toEqual({ answer: "A loop [1].", citations: [1, 2] });
    expect(parseChatAnswer({ answer: "  " }, 3)).toBeNull();
    expect(parseChatAnswer(null, 3)).toBeNull();
    expect(parseChatAnswer({ answer: 5 }, 3)).toBeNull();
  });
});

describe("parseNoteResult", () => {
  test("the verdict follows the checks, and corrections only appear for wrong claims", () => {
    const r = parseNoteResult(
      {
        summary: "Mostly right [1].",
        checks: [
          { claim: "Habits have three parts", status: "supported", correction: "ignored", citations: [1] },
          { claim: "Rewards come first", status: "incorrect", correction: "The cue comes first [2].", citations: [2, 9] },
          { claim: "Bad status", status: "maybe" },
          { status: "supported" },
        ],
      },
      3
    );
    expect(r?.verdict).toBe("has_issues");
    expect(r?.checks).toHaveLength(2);
    expect(r?.checks[0].correction).toBeUndefined();
    expect(r?.checks[1]).toMatchObject({ correction: "The cue comes first [2].", citations: [2] });
  });
  test("all supported is accurate; nothing checkable is cannot_judge; junk is null", () => {
    expect(parseNoteResult({ checks: [{ claim: "x", status: "supported", citations: [1] }] }, 3)?.verdict).toBe("accurate");
    expect(parseNoteResult({ checks: [{ claim: "x", status: "not_in_book" }] }, 3)?.verdict).toBe("has_issues");
    expect(parseNoteResult({ checks: [] }, 3)?.verdict).toBe("cannot_judge");
    expect(parseNoteResult({}, 3)).toBeNull();
  });
});
