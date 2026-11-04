import { describe, expect, test } from "vitest";
import { cleanChecks, cleanVisual } from "./lessonRules";

const q = (level: string | undefined, question: string, answerIndex = 0) => ({
  level: level as "apply" | undefined,
  question,
  options: ["right", "wrong 1", "wrong 2", "wrong 3"],
  answerIndex,
  explanation: "because",
});

describe("question rules", () => {
  test("drops questions that ask about the source instead of the idea", () => {
    const out = cleanChecks([q("apply", "According to the source, what is X?"), q("easier", "What is X?")]);
    expect(out).toBeNull(); // no usable "apply" question left
  });

  test("labels unlabelled questions by position and keeps the right answer after shuffling", () => {
    const out = cleanChecks([q(undefined, "A team sees Y. What applies?"), q(undefined, "What is X?"), q(undefined, "Edge case?")]);
    expect(out?.map((c) => c.level)).toEqual(["apply", "easier", "stretch"]);
    for (const c of out!) expect(c.options[c.answerIndex]).toBe("right");
  });

  test("falls back to the pillar's sub-ideas when the visual is malformed", () => {
    const v = cleanVisual({ kind: "matrix", title: "x" }, "Pillar", [{ title: "A", detail: "a", children: [] }]);
    expect(v.kind).toBe("hierarchy");
  });
});
